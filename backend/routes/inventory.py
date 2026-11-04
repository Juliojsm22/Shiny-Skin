from flask import Blueprint, jsonify, request
from sqlalchemy import func
from models import db, Product, InventoryMovement, OrderItem, InvoiceItem
from routes.utils import staff_required, get_current_user_obj

inventory_bp = Blueprint('inventory', __name__)


@inventory_bp.route('/movimientos', methods=['GET'])
def get_movements():
    product_id = request.args.get('product_id', type=int)
    tipo = request.args.get('tipo')
    ubicacion = request.args.get('ubicacion')
    query = InventoryMovement.query
    if product_id:
        query = query.filter_by(product_id=product_id)
    if tipo:
        query = query.filter_by(tipo=tipo)
    if ubicacion:
        query = query.filter_by(ubicacion=ubicacion)
    movs = query.order_by(InventoryMovement.fecha.desc()).limit(250).all()
    return jsonify([m.to_dict() for m in movs])


@inventory_bp.route('/entrada', methods=['POST'])
@staff_required
def entrada_stock():
    """FRQ-0010 / UC5: Entrada manual de inventario por importación o compra."""
    data = request.get_json(silent=True) or {}
    pid = data.get('product_id')
    cantidad = int(data.get('cantidad') or 0)
    ubicacion = (data.get('ubicacion') or 'online').lower()

    if not pid or cantidad <= 0:
        return jsonify({'error': 'Selecciona un producto e ingresa una cantidad mayor a cero.'}), 400

    product = Product.query.get_or_404(pid)
    stock_ant = product.stock or 0
    if ubicacion == 'fisico':
        product.stock_fisico = (product.stock_fisico or 0) + cantidad
    else:
        ubicacion = 'online'
        product.stock_online = (product.stock_online or 0) + cantidad
    product.sync_stock()

    user = get_current_user_obj()
    mov = InventoryMovement(
        product_id=product.id,
        tipo='entrada',
        ubicacion=ubicacion,
        cantidad=cantidad,
        stock_anterior=stock_ant,
        stock_nuevo=product.stock,
        motivo=(data.get('motivo') or 'Entrada de inventario').strip(),
        user_id=user.id if user else data.get('user_id')
    )
    db.session.add(mov)
    db.session.commit()
    return jsonify({
        'message': 'Entrada de inventario registrada exitosamente.',
        'stock_nuevo': product.stock,
        'stock_fisico': product.stock_fisico,
        'stock_online': product.stock_online,
        'movimiento': mov.to_dict()
    })


@inventory_bp.route('/salida', methods=['POST'])
@staff_required
def salida_stock():
    """FRQ-0011 / UC5: Salida manual justificada por merma, daño o vencimiento."""
    data = request.get_json(silent=True) or {}
    pid = data.get('product_id')
    cantidad = int(data.get('cantidad') or 0)
    ubicacion = (data.get('ubicacion') or 'fisico').lower()
    motivo = (data.get('motivo') or 'Salida por merma / daño').strip()

    if not pid or cantidad <= 0:
        return jsonify({'error': 'Selecciona un producto y una cantidad válida a retirar.'}), 400

    product = Product.query.get_or_404(pid)
    stock_ant = product.stock or 0

    if ubicacion == 'fisico':
        disponible = product.stock_fisico or 0
        if cantidad > disponible:
            return jsonify({'error': f'Stock insuficiente en Tienda Física (disponible: {disponible} uds).'}), 400
        product.stock_fisico = disponible - cantidad
    else:
        ubicacion = 'online'
        disponible = product.stock_online or 0
        if cantidad > disponible:
            return jsonify({'error': f'Stock insuficiente en Almacén Online (disponible: {disponible} uds).'}), 400
        product.stock_online = disponible - cantidad

    product.sync_stock()
    user = get_current_user_obj()
    mov = InventoryMovement(
        product_id=product.id,
        tipo='salida',
        ubicacion=ubicacion,
        cantidad=cantidad,
        stock_anterior=stock_ant,
        stock_nuevo=product.stock,
        motivo=motivo,
        user_id=user.id if user else None
    )
    db.session.add(mov)
    db.session.commit()
    return jsonify({
        'message': 'Salida por merma/ajuste registrada.',
        'stock_nuevo': product.stock,
        'stock_fisico': product.stock_fisico,
        'stock_online': product.stock_online,
        'movimiento': mov.to_dict()
    })


@inventory_bp.route('/traslado', methods=['POST'])
@staff_required
def traslado_stock():
    """FRQ-0009: Traslado de existencias entre Concept Store (Físico) y E-commerce (Online)."""
    data = request.get_json(silent=True) or {}
    pid = data.get('product_id')
    cantidad = int(data.get('cantidad') or 0)
    origen = (data.get('origen') or 'online').lower()

    if not pid or cantidad <= 0:
        return jsonify({'error': 'Selecciona producto y cantidad mayor a cero para trasladar.'}), 400

    product = Product.query.get_or_404(pid)
    if origen == 'online':
        if (product.stock_online or 0) < cantidad:
            return jsonify({'error': f'Stock Online insuficiente (disponible: {product.stock_online or 0} uds).'}), 400
        product.stock_online -= cantidad
        product.stock_fisico = (product.stock_fisico or 0) + cantidad
        detalle = 'Traslado: Online → Tienda Física (Colectivo)'
        destino = 'fisico'
    else:
        if (product.stock_fisico or 0) < cantidad:
            return jsonify({'error': f'Stock en Tienda Física insuficiente (disponible: {product.stock_fisico or 0} uds).'}), 400
        product.stock_fisico -= cantidad
        product.stock_online = (product.stock_online or 0) + cantidad
        detalle = 'Traslado: Tienda Física (Colectivo) → Online'
        destino = 'online'

    product.sync_stock()
    user = get_current_user_obj()
    mov = InventoryMovement(
        product_id=product.id,
        tipo='traslado',
        ubicacion=destino,
        cantidad=cantidad,
        stock_anterior=product.stock,
        stock_nuevo=product.stock,
        motivo=data.get('motivo') or detalle,
        user_id=user.id if user else None
    )
    db.session.add(mov)
    db.session.commit()
    return jsonify({
        'message': detalle,
        'stock_nuevo': product.stock,
        'stock_fisico': product.stock_fisico,
        'stock_online': product.stock_online,
        'movimiento': mov.to_dict()
    })


@inventory_bp.route('/ajuste', methods=['POST'])
@staff_required
def ajuste_stock():
    data = request.get_json(silent=True) or {}
    pid = data.get('product_id')
    raw_nuevo = data.get('nuevo_stock') if data.get('nuevo_stock') is not None else data.get('stock_nuevo')
    if not pid or raw_nuevo is None:
        return jsonify({'error': 'Producto y nuevo stock exacto son requeridos.'}), 400

    nuevo_stock = max(0, int(raw_nuevo))
    ubicacion = (data.get('ubicacion') or 'ambos').lower()
    product = Product.query.get_or_404(pid)
    stock_ant = product.stock or 0

    if ubicacion == 'fisico':
        product.stock_fisico = nuevo_stock
    elif ubicacion == 'online':
        product.stock_online = nuevo_stock
    else:
        product.stock_fisico = nuevo_stock // 2
        product.stock_online = nuevo_stock - product.stock_fisico

    product.sync_stock()
    diferencia = product.stock - stock_ant
    user = get_current_user_obj()
    mov = InventoryMovement(
        product_id=product.id,
        tipo='ajuste',
        ubicacion=ubicacion,
        cantidad=abs(diferencia),
        stock_anterior=stock_ant,
        stock_nuevo=product.stock,
        motivo=(data.get('motivo') or 'Conteo físico de inventario').strip(),
        user_id=user.id if user else data.get('user_id')
    )
    db.session.add(mov)
    db.session.commit()
    return jsonify({
        'message': 'Ajuste de inventario aplicado correctamente.',
        'stock_nuevo': product.stock,
        'stock_fisico': product.stock_fisico,
        'stock_online': product.stock_online,
        'movimiento': mov.to_dict()
    })


@inventory_bp.route('/resumen', methods=['GET'])
def resumen():
    activos = Product.query.filter_by(activo=True).all()
    total_productos = len(activos)
    stock_critico = sum(1 for p in activos if 0 < (p.stock or 0) <= (p.stock_minimo or 5))
    sin_stock = sum(1 for p in activos if (p.stock or 0) == 0)
    unidades_fisico = sum(p.stock_fisico or 0 for p in activos)
    unidades_online = sum(p.stock_online or 0 for p in activos)
    valor_inventario = round(sum((p.stock or 0) * (p.precio_costo or 0) for p in activos), 2)
    return jsonify({
        'total_productos': total_productos,
        'stock_critico': stock_critico,
        'sin_stock': sin_stock,
        'unidades_fisico': unidades_fisico,
        'unidades_online': unidades_online,
        'valor_inventario': valor_inventario
    })


@inventory_bp.route('/rotacion', methods=['GET'])
def rotacion_inventario():
    """HU-11 / UC7: Clasificación en Bajo Stock, Sin Stock, Alta Rotación, Stock Estancado y Por Vencer."""
    activos = Product.query.filter_by(activo=True).all()

    # Calcular unidades vendidas por producto (pedidos no cancelados + ventas directas en POS no anuladas)
    from models import Order, Invoice
    ventas_pedidos = dict(
        db.session.query(OrderItem.product_id, func.sum(OrderItem.cantidad))
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.estado != 'cancelado', OrderItem.product_id.isnot(None))
        .group_by(OrderItem.product_id).all()
    )
    ventas_pos = dict(
        db.session.query(InvoiceItem.product_id, func.sum(InvoiceItem.cantidad))
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .filter(Invoice.estado != 'anulada', Invoice.order_id.is_(None), InvoiceItem.product_id.isnot(None))
        .group_by(InvoiceItem.product_id).all()
    )

    sin_stock = []
    bajo_stock = []
    alta_rotacion = []
    estancados = []
    por_vencer = []

    for p in activos:
        vendidos = int((ventas_pedidos.get(p.id) or 0) + (ventas_pos.get(p.id) or 0))
        d = p.to_dict()
        d['unidades_vendidas'] = vendidos

        if (p.stock or 0) == 0:
            sin_stock.append(d)
        elif (p.stock or 0) <= (p.stock_minimo or 5):
            bajo_stock.append(d)

        if vendidos >= 2:
            alta_rotacion.append(d)
        elif vendidos == 0 and (p.stock or 0) > (p.stock_minimo or 5):
            estancados.append(d)

        if d['dias_para_vencer'] is not None and d['dias_para_vencer'] <= 90:
            por_vencer.append(d)

    alta_rotacion.sort(key=lambda x: x['unidades_vendidas'], reverse=True)
    estancados.sort(key=lambda x: x['stock'], reverse=True)

    return jsonify({
        'bajo_stock': bajo_stock,
        'sin_stock': sin_stock,
        'alta_rotacion': alta_rotacion[:10],
        'stock_estancado': estancados,
        'proximos_vencer': por_vencer
    })
