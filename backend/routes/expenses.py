from flask import Blueprint, jsonify, request
from sqlalchemy import func
from models import db, Expense
from routes.utils import get_current_user_obj, staff_required, admin_required
from datetime import datetime

expenses_bp = Blueprint('expenses', __name__)

CATEGORIAS_VALIDAS = ['IMPORTACION', 'ENVIO', 'EMPAQUE', 'PUBLICIDAD', 'ALQUILER', 'OTRO']


@expenses_bp.route('/', methods=['GET'])
@staff_required
def get_expenses():
    """Lista los gastos operativos filtrables por categoría y rango de fechas (HU-13 / FRQ-0030)."""
    categoria = request.args.get('categoria', '').strip().upper()
    mes = request.args.get('mes', '').strip()  # YYYY-MM
    fecha_desde = request.args.get('fecha_desde', '').strip()
    fecha_hasta = request.args.get('fecha_hasta', '').strip()

    query = Expense.query
    if categoria:
        query = query.filter_by(categoria_gasto=categoria)
    if mes:
        query = query.filter(Expense.fecha.like(f'{mes}%'))
    if fecha_desde:
        query = query.filter(Expense.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Expense.fecha <= fecha_hasta)

    gastos = query.order_by(Expense.fecha.desc(), Expense.id.desc()).all()
    return jsonify([g.to_dict() for g in gastos])


@expenses_bp.route('/resumen', methods=['GET'])
@staff_required
def resumen_gastos():
    hoy_mes = datetime.utcnow().strftime('%Y-%m')
    mes = request.args.get('mes', hoy_mes).strip()

    total_general = db.session.query(func.sum(Expense.monto)).scalar() or 0
    total_mes = db.session.query(func.sum(Expense.monto)).filter(
        Expense.fecha.like(f'{mes}%')
    ).scalar() or 0

    por_categoria_rows = db.session.query(
        Expense.categoria_gasto,
        func.sum(Expense.monto),
        func.count(Expense.id)
    ).filter(Expense.fecha.like(f'{mes}%')).group_by(Expense.categoria_gasto).all()

    return jsonify({
        'mes': mes,
        'total_mes': round(float(total_mes), 2),
        'total_historico': round(float(total_general), 2),
        'por_categoria': [
            {
                'categoria': row[0],
                'monto': round(float(row[1] or 0), 2),
                'cantidad': row[2]
            }
            for row in por_categoria_rows
        ]
    })


@expenses_bp.route('/', methods=['POST'])
@staff_required
def create_expense():
    data = request.get_json() or {}
    concepto = (data.get('concepto') or '').strip()
    categoria = (data.get('categoria_gasto') or 'OTRO').strip().upper()
    if categoria not in CATEGORIAS_VALIDAS:
        categoria = 'OTRO'

    try:
        monto = float(data.get('monto') or 0)
    except (TypeError, ValueError):
        return jsonify({'error': 'El monto del gasto no es válido.'}), 400

    if not concepto or monto <= 0:
        return jsonify({'error': 'Debe indicar un concepto y un monto mayor a cero.'}), 400

    fecha = (data.get('fecha') or datetime.utcnow().strftime('%Y-%m-%d')).strip()[:10]
    user = get_current_user_obj()

    gasto = Expense(
        categoria_gasto=categoria,
        concepto=concepto,
        monto=round(monto, 2),
        fecha=fecha,
        notas=(data.get('notas') or '').strip() or None,
        user_id=user.id if user else None
    )
    db.session.add(gasto)
    db.session.commit()
    return jsonify(gasto.to_dict()), 201


@expenses_bp.route('/<int:id>', methods=['PUT'])
@staff_required
def update_expense(id):
    gasto = db.session.get(Expense, id)
    if not gasto:
        return jsonify({'error': 'Registro de gasto no encontrado.'}), 404

    data = request.get_json() or {}
    if 'categoria_gasto' in data:
        cat = (data['categoria_gasto'] or 'OTRO').strip().upper()
        if cat in CATEGORIAS_VALIDAS:
            gasto.categoria_gasto = cat
    if 'concepto' in data and (data['concepto'] or '').strip():
        gasto.concepto = data['concepto'].strip()
    if 'monto' in data:
        try:
            monto = float(data['monto'])
            if monto > 0:
                gasto.monto = round(monto, 2)
        except (TypeError, ValueError):
            pass
    if 'fecha' in data and (data['fecha'] or '').strip():
        gasto.fecha = data['fecha'].strip()[:10]
    if 'notas' in data:
        gasto.notas = (data['notas'] or '').strip() or None

    db.session.commit()
    return jsonify(gasto.to_dict())


@expenses_bp.route('/<int:id>', methods=['DELETE'])
@admin_required
def delete_expense(id):
    gasto = db.session.get(Expense, id)
    if not gasto:
        return jsonify({'error': 'Registro de gasto no encontrado.'}), 404
    db.session.delete(gasto)
    db.session.commit()
    return jsonify({'mensaje': 'Gasto eliminado correctamente.'})

