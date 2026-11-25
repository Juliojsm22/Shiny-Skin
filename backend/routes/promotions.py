import re
from flask import Blueprint, jsonify, request
from models import db, StorePromotion
from routes.utils import admin_required, get_current_user_obj, now_ni_naive

promotions_bp = Blueprint('promotions', __name__)

CODE_RE = re.compile(r'^[A-Z0-9_-]{2,30}$')


def get_or_create_store_promotion() -> StorePromotion:
    promo = StorePromotion.query.order_by(StorePromotion.id.asc()).first()
    if not promo:
        promo = StorePromotion(
            activo=False,
            codigo='SHINY10',
            porcentaje=10.0,
            descripcion='Descuento especial en toda la tienda'
        )
        db.session.add(promo)
        db.session.commit()
    return promo


@promotions_bp.route('/', methods=['GET'])
def get_public_promotion():
    """Devuelve el descuento general de la tienda solo cuando la Administradora lo tiene habilitado."""
    promo = StorePromotion.query.order_by(StorePromotion.id.asc()).first()
    if not promo or not promo.activo or not promo.codigo or (promo.porcentaje or 0) <= 0:
        return jsonify({
            'activo': False,
            'codigo': None,
            'porcentaje': 0,
            'descripcion': ''
        })
    return jsonify({
        'activo': True,
        'codigo': promo.codigo.strip().upper(),
        'porcentaje': round(float(promo.porcentaje), 2),
        'descripcion': promo.descripcion or f'{round(float(promo.porcentaje), 2):g}% OFF en toda la tienda'
    })


@promotions_bp.route('/admin', methods=['GET'])
@admin_required
def get_admin_promotion():
    """Devuelve la configuración completa del descuento general para la Administradora."""
    promo = get_or_create_store_promotion()
    return jsonify(promo.to_dict())


@promotions_bp.route('/', methods=['PUT'])
@admin_required
def update_store_promotion():
    """Permite a la Administradora habilitar, editar o deshabilitar el descuento general de toda la tienda."""
    data = request.get_json(silent=True) or {}
    promo = get_or_create_store_promotion()
    user = get_current_user_obj()

    activo = bool(data.get('activo', False))
    raw_code = (data.get('codigo') if data.get('codigo') is not None else promo.codigo or 'SHINY10')
    codigo = str(raw_code).strip().upper().replace(' ', '')

    if activo:
        if not codigo or not CODE_RE.match(codigo):
            return jsonify({
                'error': 'El código de descuento debe tener entre 2 y 30 caracteres (solo letras, números, guion o guion bajo).'
            }), 400
    elif codigo and not CODE_RE.match(codigo):
        return jsonify({
            'error': 'Formato de código inválido. Usa solo letras y números (ej. SHINY10).'
        }), 400

    raw_pct = data.get('porcentaje', promo.porcentaje)
    try:
        porcentaje = round(float(raw_pct), 2)
    except (TypeError, ValueError):
        return jsonify({'error': 'El porcentaje de descuento debe ser un número válido.'}), 400

    if activo and (porcentaje <= 0 or porcentaje > 90):
        return jsonify({'error': 'El porcentaje de descuento debe estar entre 1% y 90%.'}), 400
    if not activo and (porcentaje < 0 or porcentaje > 90):
        return jsonify({'error': 'El porcentaje de descuento debe estar entre 0% y 90%.'}), 400

    descripcion = str(data.get('descripcion') if data.get('descripcion') is not None else (promo.descripcion or '')).strip()[:180]
    if not descripcion and porcentaje > 0:
        descripcion = f'{porcentaje:g}% OFF en toda la tienda Shiny Skin'

    promo.activo = activo
    if codigo:
        promo.codigo = codigo
    promo.porcentaje = porcentaje
    promo.descripcion = descripcion
    promo.updated_at = now_ni_naive()
    promo.updated_by = user.nombre if user else 'Administradora'

    db.session.commit()
    return jsonify(promo.to_dict())
