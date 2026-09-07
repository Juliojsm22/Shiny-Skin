from flask import Blueprint, jsonify
from models import db, Product, Order, Invoice, InventoryMovement
from sqlalchemy import func
from datetime import datetime, timedelta

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/kpis', methods=['GET'])
def get_kpis():
    hoy = datetime.utcnow().date()
    inicio_mes = hoy.replace(day=1)

    ventas_hoy = db.session.query(func.sum(Order.total)).filter(
        func.date(Order.fecha) == hoy,
        Order.estado.in_(['entregado', 'confirmado'])
    ).scalar() or 0

    ventas_mes = db.session.query(func.sum(Order.total)).filter(
        Order.fecha >= inicio_mes,
        Order.estado.in_(['entregado', 'confirmado'])
    ).scalar() or 0

    pedidos_pendientes = Order.query.filter_by(estado='pendiente').count()
    pedidos_hoy = Order.query.filter(func.date(Order.fecha) == hoy).count()

    total_productos = Product.query.filter_by(activo=True).count()
    stock_critico = Product.query.filter(
        Product.activo == True,
        Product.stock <= Product.stock_minimo
    ).count()

    total_facturas = Invoice.query.filter_by(estado='emitida').count()

    return jsonify({
        'ventas_hoy': round(ventas_hoy, 2),
        'ventas_mes': round(ventas_mes, 2),
        'pedidos_pendientes': pedidos_pendientes,
        'pedidos_hoy': pedidos_hoy,
        'total_productos': total_productos,
        'stock_critico': stock_critico,
        'facturas_pendientes': total_facturas
    })


@dashboard_bp.route('/ventas-semana', methods=['GET'])
def ventas_semana():
    resultado = []
    for i in range(6, -1, -1):
        dia = datetime.utcnow().date() - timedelta(days=i)
        total = db.session.query(func.sum(Order.total)).filter(
            func.date(Order.fecha) == dia,
            Order.estado.in_(['entregado', 'confirmado'])
        ).scalar() or 0
        resultado.append({'fecha': dia.strftime('%d/%m'), 'total': round(total, 2)})
    return jsonify(resultado)


@dashboard_bp.route('/top-productos', methods=['GET'])
def top_productos():
    from models import OrderItem
    top = db.session.query(
        OrderItem.nombre_producto,
        func.sum(OrderItem.cantidad).label('total_vendido'),
        func.sum(OrderItem.subtotal).label('ingresos')
    ).group_by(OrderItem.nombre_producto).order_by(
        func.sum(OrderItem.cantidad).desc()
    ).limit(5).all()

    return jsonify([{
        'producto': t[0], 'total_vendido': t[1], 'ingresos': round(t[2], 2)
    } for t in top])


@dashboard_bp.route('/stock-critico', methods=['GET'])
def productos_stock_critico():
    productos = Product.query.filter(
        Product.activo == True,
        Product.stock <= Product.stock_minimo
    ).order_by(Product.stock.asc()).limit(10).all()
    return jsonify([p.to_dict() for p in productos])
