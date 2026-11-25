from flask import Blueprint, jsonify, request
from models import (
    db, Product, Category, Brand, Order, OrderItem, Invoice, InvoiceItem,
    Expense, Client, Motorizado, InventoryMovement, User
)
from routes.utils import staff_required, admin_required, today_ni, month_ni, now_ni
from sqlalchemy import func
from datetime import timedelta

dashboard_bp = Blueprint('dashboard', __name__)

ESTADOS_PEDIDO_VALIDOS = ('confirmado', 'en_camino', 'entregado')


@dashboard_bp.route('/kpis', methods=['GET'])
@staff_required
def get_kpis():
    hoy = today_ni()
    inicio_mes = hoy.replace(day=1)
    mes_str = month_ni()

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
@staff_required
def ventas_semana():
    resultado = []
    hoy = today_ni()
    for i in range(6, -1, -1):
        dia = hoy - timedelta(days=i)
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
@staff_required
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
@staff_required
def productos_stock_critico():
    productos = Product.query.filter(
        Product.activo.is_(True),
        Product.stock <= Product.stock_minimo
    ).order_by(Product.stock.asc()).limit(10).all()
    return jsonify([p.to_dict() for p in productos])


@dashboard_bp.route('/backup', methods=['GET'])
@admin_required
def export_backup():
    """NFR-0016: Exporta respaldo íntegro de la base de datos real del servidor (sin hashes de contraseña)."""
    return jsonify({
        'sistema': 'SISCO - Shiny Skin',
        'version': '2.1.0',
        'exported_at': now_ni().isoformat(),
        'source': 'server_database',
        'categorias': [c.to_dict() for c in Category.query.order_by(Category.id.asc()).all()],
        'marcas': [b.to_dict() for b in Brand.query.order_by(Brand.id.asc()).all()],
        'productos': [p.to_dict() for p in Product.query.order_by(Product.id.asc()).all()],
        'clientes': [c.to_dict(include_orders=False) for c in Client.query.order_by(Client.id.asc()).all()],
        'motorizados': [m.to_dict() for m in Motorizado.query.order_by(Motorizado.id.asc()).all()],
        'pedidos': [o.to_dict() for o in Order.query.order_by(Order.id.desc()).all()],
        'facturas': [f.to_dict() for f in Invoice.query.order_by(Invoice.id.desc()).all()],
        'gastos': [e.to_dict() for e in Expense.query.order_by(Expense.id.desc()).all()],
        'movimientos': [mv.to_dict() for mv in InventoryMovement.query.order_by(InventoryMovement.id.desc()).limit(500).all()],
        'usuarios': [u.to_dict() for u in User.query.order_by(User.id.asc()).all()],
    })


@dashboard_bp.route('/restore', methods=['POST'])
@admin_required
def restore_backup():
    """NFR-0016: Importa productos, clientes, motorizados y gastos desde un archivo JSON de respaldo."""
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload.get('productos'), list):
        return jsonify({'error': 'El archivo JSON no tiene una estructura válida de respaldo SISCO.'}), 400

    restored = {'productos': 0, 'clientes': 0, 'motorizados': 0, 'gastos': 0}

    for p in payload.get('productos', []):
        sku = (p.get('sku') or '').strip()
        nombre = (p.get('nombre') or '').strip()
        if not nombre:
            continue
        existing = Product.query.filter_by(sku=sku).first() if sku else Product.query.filter_by(nombre=nombre).first()
        if existing:
            existing.precio_costo = float(p.get('precio_costo') or existing.precio_costo or 0)
            existing.precio_venta = float(p.get('precio_venta') or existing.precio_venta or 0)
            existing.descuento = float(p.get('descuento') or 0)
            existing.stock_fisico = max(0, int(p.get('stock_fisico') or 0))
            existing.stock_online = max(0, int(p.get('stock_online') or 0))
            existing.sync_stock()
            existing.activo = bool(p.get('activo', True))
            restored['productos'] += 1

    for c in payload.get('clientes', []):
        nombre = (c.get('nombre') or '').strip()
        if not nombre:
            continue
        tel = (c.get('telefono') or '').strip() or None
        exists = (Client.query.filter_by(telefono=tel).first() if tel else None) or Client.query.filter(db.func.lower(Client.nombre) == nombre.lower()).first()
        if not exists:
            db.session.add(Client(
                nombre=nombre,
                telefono=tel,
                email=(c.get('email') or '').strip() or None,
                direccion=(c.get('direccion') or '').strip() or None,
                notas=(c.get('notas') or '').strip() or None
            ))
            restored['clientes'] += 1

    for m in payload.get('motorizados', []):
        nombre = (m.get('nombre') or '').strip()
        tel = (m.get('telefono') or '').strip()
        if nombre and tel and not Motorizado.query.filter_by(telefono=tel).first():
            db.session.add(Motorizado(nombre=nombre, telefono=tel, empresa=m.get('empresa') or 'Independiente', activo=bool(m.get('activo', True))))
            restored['motorizados'] += 1

    for g in payload.get('gastos', []):
        concepto = (g.get('concepto') or '').strip()
        fecha = (g.get('fecha') or '')[:10]
        monto = float(g.get('monto') or 0)
        if concepto and fecha and monto > 0:
            exists = Expense.query.filter_by(concepto=concepto, fecha=fecha, monto=monto).first()
            if not exists:
                db.session.add(Expense(
                    categoria_gasto=g.get('categoria_gasto') or 'OTRO',
                    concepto=concepto,
                    monto=monto,
                    fecha=fecha,
                    notas=g.get('notas')
                ))
                restored['gastos'] += 1

    db.session.commit()
    return jsonify({
        'message': 'Respaldo restaurado correctamente en la base de datos del servidor.',
        'restored': restored
    })
