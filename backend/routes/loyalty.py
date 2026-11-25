import re
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from models import db, User, Order, LoyaltyConfig, LoyaltyTransaction
from routes.utils import (
    admin_required, staff_required, get_current_user_obj, now_ni_naive
)

loyalty_bp = Blueprint('loyalty', __name__)


def get_or_create_loyalty_config() -> LoyaltyConfig:
    cfg = LoyaltyConfig.query.order_by(LoyaltyConfig.id.asc()).first()
    if not cfg:
        cfg = LoyaltyConfig(
            activo=True,
            tasa_cambio=36.62,
            cordobas_por_punto=36.62,
            puntos_por_canje=250,
            valor_canje_usd=10.0,
            valor_canje_cordobas=366.20,
        )
        db.session.add(cfg)
        db.session.commit()
    return cfg


def _clean_digits(phone: str) -> str:
    d = re.sub(r'\D', '', str(phone or ''))
    if len(d) == 11 and d.startswith('505'):
        return d[3:]
    return d


def find_customer_user(user_id=None, telefono: str = None, email: str = None):
    """Encuentra la cuenta registrada del cliente por ID, teléfono normalizado o correo."""
    if user_id:
        try:
            u = db.session.get(User, int(user_id))
            if u and u.activo:
                return u
        except (TypeError, ValueError):
            pass

    if email:
        em = str(email).strip().lower()
        if em:
            u = User.query.filter(db.func.lower(User.email) == em, User.activo.is_(True)).first()
            if u:
                return u

    local_tel = _clean_digits(telefono)
    if len(local_tel) == 8:
        formatted = f'{local_tel[:4]}-{local_tel[4:]}'
        # Buscar coincidencia exacta o por los 8 dígitos locales
        u = User.query.filter(
            User.activo.is_(True),
            or_(
                User.telefono == formatted,
                User.telefono == local_tel,
                User.telefono == f'505{local_tel}',
                User.telefono == f'+505 {formatted}',
                User.telefono.ilike(f'%{local_tel}%')
            )
        ).first()
        if u:
            return u
        for cand in User.query.filter(User.activo.is_(True), User.telefono.isnot(None)).all():
            if _clean_digits(cand.telefono) == local_tel:
                return cand
    return None


def calculate_points_earned(net_products_cordobas: float, cfg: LoyaltyConfig = None) -> int:
    cfg = cfg or get_or_create_loyalty_config()
    if not cfg.activo:
        return 0
    rate = float(cfg.cordobas_por_punto or 36.62)
    if rate <= 0 or net_products_cordobas <= 0:
        return 0
    return int(float(net_products_cordobas) // rate)


def compute_redemption(user: User, bloques_solicitados: int, max_discount_cordobas: float, cfg: LoyaltyConfig = None):
    """
    Valida y calcula un canje de bloques de puntos (ej. 1 bloque = 250 pts = C$ 366.20 / $10).
    Devuelve (puntos_usados, descuento_cordobas, error_msg).
    """
    if not bloques_solicitados or bloques_solicitados <= 0:
        return 0, 0.0, None
    cfg = cfg or get_or_create_loyalty_config()
    if not cfg.activo:
        return 0, 0.0, 'El programa de puntos Club Shiny no está activo en este momento.'
    if not user or not user.activo:
        return 0, 0.0, 'Debes iniciar sesión con tu cuenta para canjear puntos.'

    meta = max(1, int(cfg.puntos_por_canje or 250))
    val_bloque = round(float(cfg.valor_canje_cordobas or 366.20), 2)
    saldo = int(user.puntos_saldo or 0)
    puntos_req = int(bloques_solicitados) * meta

    if saldo < puntos_req:
        return 0, 0.0, f'Puntos insuficientes. Tienes {saldo} pts y necesitas {puntos_req} pts para ese canje.'

    descuento_bruto = round(int(bloques_solicitados) * val_bloque, 2)
    descuento_aplicado = min(round(max(0.0, float(max_discount_cordobas)), 2), descuento_bruto)
    if descuento_aplicado <= 0:
        return 0, 0.0, 'El subtotal actual no permite aplicar canje de puntos.'

    return puntos_req, descuento_aplicado, None


def apply_loyalty_tx(user: User, tipo: str, puntos_delta: int, descripcion: str,
                     monto_relacionado: float = 0.0, order_id=None, invoice_id=None,
                     count_towards_lifetime: bool = False) -> LoyaltyTransaction:
    """Actualiza el saldo de puntos del usuario y registra el movimiento auditable (sin commit)."""
    current = int(user.puntos_saldo or 0)
    new_saldo = max(0, current + int(puntos_delta))
    user.puntos_saldo = new_saldo
    if count_towards_lifetime and puntos_delta > 0:
        user.puntos_acumulados = int(user.puntos_acumulados or 0) + int(puntos_delta)

    tx = LoyaltyTransaction(
        user_id=user.id,
        tipo=tipo,
        puntos=int(puntos_delta),
        saldo_resultante=new_saldo,
        monto_relacionado=round(float(monto_relacionado or 0), 2),
        order_id=order_id,
        invoice_id=invoice_id,
        descripcion=(descripcion or '')[:240],
        fecha=now_ni_naive(),
    )
    db.session.add(tx)
    return tx


def _build_user_points_summary(user: User, cfg: LoyaltyConfig, include_history: bool = False) -> dict:
    saldo = int(user.puntos_saldo or 0)
    acum = int(user.puntos_acumulados or 0)
    meta = max(1, int(cfg.puntos_por_canje or 250))
    val_bloque = round(float(cfg.valor_canje_cordobas or 366.20), 2)
    val_usd = round(float(cfg.valor_canje_usd or 10.0), 2)
    bloques = saldo // meta
    resto = saldo % meta
    faltan = 0 if bloques >= 1 else (meta - saldo)
    progreso_pct = 100 if bloques >= 1 else min(99, round((resto / meta) * 100, 1))

    # Puntos pendientes en pedidos activos aún no marcados como entregados
    pendientes_rows = Order.query.filter(
        Order.user_id == user.id,
        Order.puntos_acreditados.is_(False),
        Order.puntos_ganados > 0,
        Order.estado.in_(['pendiente', 'confirmado', 'en_camino'])
    ).all()
    puntos_pendientes = sum(int(o.puntos_ganados or 0) for o in pendientes_rows)

    data = {
        'user_id': user.id,
        'nombre': user.nombre,
        'email': user.email,
        'telefono': user.telefono,
        'puntos_saldo': saldo,
        'puntos_acumulados': acum,
        'puntos_pendientes': puntos_pendientes,
        'bloques_disponibles': bloques,
        'descuento_disponible': round(bloques * val_bloque, 2),
        'descuento_disponible_usd': round(bloques * val_usd, 2),
        'faltan_puntos': faltan,
        'progreso_pct': progreso_pct,
        'config': cfg.to_dict(),
    }
    if include_history:
        txs = (
            LoyaltyTransaction.query
            .filter_by(user_id=user.id)
            .order_by(LoyaltyTransaction.id.desc())
            .limit(40)
            .all()
        )
        data['movimientos'] = [t.to_dict() for t in txs]
    return data


@loyalty_bp.route('/config', methods=['GET'])
def get_loyalty_config_public():
    """Reglas públicas vigentes del programa Club Shiny Points."""
    cfg = get_or_create_loyalty_config()
    return jsonify(cfg.to_dict())


@loyalty_bp.route('/config', methods=['PUT'])
@admin_required
def update_loyalty_config():
    """Solo la Administradora puede activar/desactivar o modificar la tasa y meta de puntos."""
    data = request.get_json(silent=True) or {}
    cfg = get_or_create_loyalty_config()
    admin = get_current_user_obj()

    activo = bool(data.get('activo', cfg.activo))
    try:
        tasa = round(float(data.get('tasa_cambio', cfg.tasa_cambio or 36.62)), 2)
        meta = int(data.get('puntos_por_canje', cfg.puntos_por_canje or 250))
        val_usd = round(float(data.get('valor_canje_usd', cfg.valor_canje_usd or 10.0)), 2)
    except (TypeError, ValueError):
        return jsonify({'error': 'Los valores numéricos del programa de puntos no son válidos.'}), 400

    if tasa < 1 or tasa > 500:
        return jsonify({'error': 'La tasa de cambio (C$ por $1) debe estar entre 1 y 500.'}), 400
    if meta < 10 or meta > 100000:
        return jsonify({'error': 'La meta de puntos por canje debe ser al menos 10 puntos.'}), 400
    if val_usd < 1 or val_usd > 1000:
        return jsonify({'error': 'El valor del canje en USD debe estar entre $1 y $1,000.'}), 400

    cfg.activo = activo
    cfg.tasa_cambio = tasa
    # 1 punto por cada $1 gastado => cordobas_por_punto = tasa (o custom si se envía explícitamente)
    if data.get('cordobas_por_punto') is not None:
        try:
            cpp = round(float(data['cordobas_por_punto']), 2)
            if cpp < 1 or cpp > 5000:
                return jsonify({'error': 'Córdobas por punto debe ser mayor a 1.'}), 400
            cfg.cordobas_por_punto = cpp
        except (TypeError, ValueError):
            return jsonify({'error': 'Córdobas por punto inválido.'}), 400
    else:
        cfg.cordobas_por_punto = tasa

    cfg.puntos_por_canje = meta
    cfg.valor_canje_usd = val_usd
    if data.get('valor_canje_cordobas') is not None:
        try:
            vcc = round(float(data['valor_canje_cordobas']), 2)
            if vcc < 1:
                return jsonify({'error': 'Valor de canje en Córdobas inválido.'}), 400
            cfg.valor_canje_cordobas = vcc
        except (TypeError, ValueError):
            return jsonify({'error': 'Valor de canje en Córdobas inválido.'}), 400
    else:
        cfg.valor_canje_cordobas = round(val_usd * tasa, 2)

    cfg.updated_at = now_ni_naive()
    cfg.updated_by = admin.nombre if admin else 'Administradora'
    db.session.commit()
    return jsonify(cfg.to_dict())


@loyalty_bp.route('/mi-cuenta', methods=['GET'])
@jwt_required()
def get_my_points():
    """Saldo, progreso, bloques disponibles e historial del usuario con sesión activa."""
    user = get_current_user_obj()
    if not user:
        return jsonify({'error': 'Sesión inválida.'}), 401
    cfg = get_or_create_loyalty_config()
    return jsonify(_build_user_points_summary(user, cfg, include_history=True))


@loyalty_bp.route('/buscar', methods=['GET'])
@staff_required
def search_customer_points():
    """Permite a Caja POS (Admin y Vendedora) buscar una cuenta por teléfono o correo para acreditar/canjear puntos."""
    q = (request.args.get('q') or '').strip()
    if not q:
        return jsonify({'found': False, 'cliente': None})
    cfg = get_or_create_loyalty_config()
    user = find_customer_user(telefono=q, email=q if '@' in q else None)
    if not user:
        like_q = f'%{q}%'
        user = User.query.filter(
            User.activo.is_(True),
            User.rol == 'cliente',
            or_(User.nombre.ilike(like_q), User.email.ilike(like_q))
        ).first()
    if not user:
        return jsonify({'found': False, 'cliente': None, 'config': cfg.to_dict()})
    return jsonify({
        'found': True,
        'cliente': _build_user_points_summary(user, cfg, include_history=False),
        'config': cfg.to_dict(),
    })


@loyalty_bp.route('/clientes', methods=['GET'])
@admin_required
def list_loyalty_members():
    """Lista las cuentas de clientes del Club Shiny Points para administración."""
    cfg = get_or_create_loyalty_config()
    users = (
        User.query
        .filter(User.rol == 'cliente')
        .order_by(User.puntos_saldo.desc(), User.puntos_acumulados.desc(), User.id.desc())
        .all()
    )
    meta = max(1, int(cfg.puntos_por_canje or 250))
    val_bloque = round(float(cfg.valor_canje_cordobas or 366.20), 2)
    members = []
    for u in users:
        saldo = int(u.puntos_saldo or 0)
        bloques = saldo // meta
        members.append({
            'id': u.id,
            'nombre': u.nombre,
            'email': u.email,
            'telefono': u.telefono,
            'activo': bool(u.activo),
            'puntos_saldo': saldo,
            'puntos_acumulados': int(u.puntos_acumulados or 0),
            'bloques_disponibles': bloques,
            'valor_disponible': round(bloques * val_bloque, 2),
        })
    return jsonify({
        'config': cfg.to_dict(),
        'total_miembros': len(members),
        'total_puntos_circulacion': sum(m['puntos_saldo'] for m in members),
        'miembros': members,
    })


@loyalty_bp.route('/ajustar', methods=['POST'])
@admin_required
def adjust_customer_points():
    """Permite a la Administradora otorgar bonos o ajustar manualmente puntos con registro en historial."""
    data = request.get_json(silent=True) or {}
    admin = get_current_user_obj()
    user = find_customer_user(user_id=data.get('user_id'), telefono=data.get('telefono'), email=data.get('email'))
    if not user:
        return jsonify({'error': 'Cuenta de cliente no encontrada.'}), 404
    try:
        puntos = int(data.get('puntos') or 0)
    except (TypeError, ValueError):
        return jsonify({'error': 'La cantidad de puntos debe ser un número entero.'}), 400
    if puntos == 0:
        return jsonify({'error': 'Indica una cantidad de puntos distinta de cero.'}), 400
    motivo = (data.get('motivo') or '').strip() or f'Ajuste manual por {admin.nombre if admin else "Administradora"}'
    tx = apply_loyalty_tx(
        user,
        tipo='ajuste',
        puntos_delta=puntos,
        descripcion=motivo,
        count_towards_lifetime=(puntos > 0),
    )
    db.session.commit()
    return jsonify({
        'message': f'Puntos actualizados correctamente. Nuevo saldo de {user.nombre}: {user.puntos_saldo} pts.',
        'puntos_saldo': user.puntos_saldo,
        'movimiento': tx.to_dict(),
    })
