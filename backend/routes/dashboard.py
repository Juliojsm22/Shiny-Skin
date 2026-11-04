from flask import Blueprint, jsonify
from models import db, Product, Order, OrderItem, Invoice, InvoiceItem, Expense, Client
from sqlalchemy import func
from datetime import datetime, timedelta

dashboard_bp = Blueprint('dashboard', __name__)

ESTADOS_PEDIDO_VALIDOS = ('confirmado', 'en_camino', 'entregado')


@dashboard_bp.route('/kpis', methods=['GET'])
def get_kpis():
    hoy = datetime.utcnow().date()
    inicio_mes = hoy.replace(day=1)
    mes_str = hoy.strftime('%Y-%m')

    # Ventas por pedidos (Web, WhatsApp, Instagram, etc.)
    ventas_pedidos_hoy = db.session.query(func.sum(Order.total)).filter(
        func.date(Order.fecha) == hoy,
        Order.estado.in_(ESTADOS_PEDIDO_VALIDOS)
    ).scalar() or 0

    # Ventas directas en POS / Concept Store (sin pedido padre para no duplicar)
    ventas_pos_hoy = db.session.query(func.sum(Invoice.total)).filter(
        func.date(Invoice.fecha) == hoy,
        Invoice.order_id.is_(None),
        Invoice.estado == 'pagada'
    ).scalar() or 0

    ventas_pedidos_mes = db.session.query(func.sum(Order.total)).filter(
        func.date(Order.fecha) >= inicio_mes,
        Order.estado.in_(ESTADOS_PEDIDO_VALIDOS)
    ).scalar() or 0

    ventas_pos_mes = db.session.query(func.sum(Invoice.total)).filter(
        func.date(Invoice.fecha) >= inicio_mes,
        Invoice.order_id.is_(None),
        Invoice.estado == 'pagada'
    ).scalar() or 0

    ventas_hoy = float(ventas_pedidos_hoy) + float(ventas_pos_hoy)
    ventas_mes = float(ventas_pedidos_mes) + float(ventas_pos_mes)

    gastos_mes = db.session.query(func.sum(Expense.monto)).filter(
        Expense.fecha.like(f'{mes_str}%')
    ).scalar() or 0

    pedidos_pendientes = Order.query.filter_by(estado='pendiente').count()
    pedidos_hoy = Order.query.filter(func.date(Order.fecha) == hoy).count()

    total_productos = Product.query.filter_by(activo=True).count()
    stock_critico = Product.query.filter(
        Product.activo.is_(True),
        Product.stock <= Product.stock_minimo
    ).count()

    facturas_pendientes = Invoice.query.filter_by(estado='emitida').count()
    total_clientes = Client.query.count()

    return jsonify({
        'ventas_hoy': round(ventas_hoy, 2),
        'ventas_mes': round(ventas_mes, 2),
        'gastos_mes': round(float(gastos_mes), 2),
        'balance_mes': round(ventas_mes - float(gastos_mes), 2),
        'pedidos_pendientes': pedidos_pendientes,
        'pedidos_hoy': pedidos_hoy,
        'total_productos': total_productos,
        'stock_critico': stock_critico,
        'facturas_pendientes': facturas_pendientes,
        'total_clientes': total_clientes
    })


@dashboard_bp.route('/ventas-semana', methods=['GET'])
def ventas_semana():
    resultado = []
    for i in range(6, -1, -1):
        dia = datetime.utcnow().date() - timedelta(days=i)
        total_ped = db.session.query(func.sum(Order.total)).filter(
            func.date(Order.fecha) == dia,
            Order.estado.in_(ESTADOS_PEDIDO_VALIDOS)
        ).scalar() or 0
        total_pos = db.session.query(func.sum(Invoice.total)).filter(
            func.date(Invoice.fecha) == dia,
            Invoice.order_id.is_(None),
            Invoice.estado == 'pagada'
        ).scalar() or 0
        resultado.append({
            'fecha': dia.strftime('%d/%m'),
            'total': round(float(total_ped) + float(total_pos), 2)
        })
    return jsonify(resultado)


@dashboard_bp.route('/top-productos', methods=['GET'])
def top_productos():
    acumulado = {}

    ped_rows = db.session.query(
        OrderItem.nombre_producto,
        func.sum(OrderItem.cantidad),
        func.sum(OrderItem.subtotal)
    ).join(Order, Order.id == OrderItem.order_id).filter(
        Order.estado != 'cancelado'
    ).group_by(OrderItem.nombre_producto).all()

    for nombre, cant, ing in ped_rows:
        if not nombre:
            continue
        entry = acumulado.setdefault(nombre, {'producto': nombre, 'total_vendido': 0, 'ingresos': 0.0})
        entry['total_vendido'] += int(cant or 0)
        entry['ingresos'] += float(ing or 0)

    pos_rows = db.session.query(
        InvoiceItem.nombre_producto,
        func.sum(InvoiceItem.cantidad),
        func.sum(InvoiceItem.subtotal)
    ).join(Invoice, Invoice.id == InvoiceItem.invoice_id).filter(
        Invoice.order_id.is_(None),
        Invoice.estado == 'pagada',
        InvoiceItem.product_id.isnot(None)
    ).group_by(InvoiceItem.nombre_producto).all()

    for nombre, cant, ing in pos_rows:
        if not nombre:
            continue
        entry = acumulado.setdefault(nombre, {'producto': nombre, 'total_vendido': 0, 'ingresos': 0.0})
        entry['total_vendido'] += int(cant or 0)
        entry['ingresos'] += float(ing or 0)

    top = sorted(acumulado.values(), key=lambda x: (x['total_vendido'], x['ingresos']), reverse=True)[:5]
    for item in top:
        item['ingresos'] = round(item['ingresos'], 2)
    return jsonify(top)


@dashboard_bp.route('/stock-critico', methods=['GET'])
def productos_stock_critico():
    productos = Product.query.filter(
        Product.activo.is_(True),
        Product.stock <= Product.stock_minimo
    ).order_by(Product.stock.asc()).limit(10).all()
    return jsonify([p.to_dict() for p in productos])
