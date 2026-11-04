from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import or_, func
from models import (
    db, Order, OrderItem, OrderStatusHistory,
    Product, InventoryMovement, Motorizado
)
from routes.utils import get_current_user_obj, staff_required, upsert_client
from datetime import datetime
import random
import string

orders_bp = Blueprint('orders', __name__)


def generar_numero_pedido():
    for _ in range(20):
        code = 'SS-' + ''.join(random.choices(string.digits, k=6))
        if not Order.query.filter_by(numero_pedido=code).first():
            return code
    return 'SS-' + datetime.utcnow().strftime('%H%M%S')


def _deduct_stock(product: Product, qty: int, canal: str) -> str:
    """Descuenta stock priorizando tienda física u online según el canal, con respaldo cruzado."""
    fis = max(0, int(product.stock_fisico or 0))
    onl = max(0, int(product.stock_online or 0))
    if fis + onl == 0 and (product.stock or 0) > 0:
        onl = int(product.stock)

    if canal == 'tienda_fisica':
        if fis >= qty:
            product.stock_fisico = fis - qty
            product.stock_online = onl
        else:
            restante = qty - fis
            product.stock_fisico = 0
            product.stock_online = max(0, onl - restante)
        ubicacion = 'fisico'
    else:
        if onl >= qty:
            product.stock_online = onl - qty
            product.stock_fisico = fis
        else:
            restante = qty - onl
            product.stock_online = 0
            product.stock_fisico = max(0, fis - restante)
        ubicacion = 'online'

    product.sync_stock()
    return ubicacion


def _restore_stock(product: Product, qty: int, canal: str) -> str:
    if canal == 'tienda_fisica':
        product.stock_fisico = max(0, int(product.stock_fisico or 0)) + qty
        ubicacion = 'fisico'
    else:
        product.stock_online = max(0, int(product.stock_online or 0)) + qty
        ubicacion = 'online'
    product.sync_stock()
    return ubicacion


@orders_bp.route('/', methods=['GET'])
def get_orders():
    estado = request.args.get('estado', '').strip()
    canal = request.args.get('canal', '').strip()
    q = request.args.get('q', '').strip()
    fecha_desde = request.args.get('fecha_desde', '').strip()
    fecha_hasta = request.args.get('fecha_hasta', '').strip()

    query = Order.query
    if estado:
        query = query.filter_by(estado=estado)
    if canal:
        query = query.filter_by(canal=canal)
    if q:
        like_q = f'%{q}%'
        query = query.filter(or_(
            Order.numero_pedido.ilike(like_q),
            Order.nombre_cliente.ilike(like_q),
            Order.telefono_cliente.ilike(like_q)
        ))
    if fecha_desde:
        try:
            dt_desde = datetime.strptime(fecha_desde, '%Y-%m-%d')
            query = query.filter(Order.fecha >= dt_desde)
        except ValueError:
            pass
    if fecha_hasta:
        try:
            dt_hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            query = query.filter(Order.fecha <= dt_hasta)
        except ValueError:
            pass

    orders = query.order_by(Order.fecha.desc()).all()
    return jsonify([o.to_dict() for o in orders])


@orders_bp.route('/seguimiento/<string:codigo>', methods=['GET'])
def seguimiento_pedido(codigo):
    """Consulta pública del estado de un pedido por su código (HU-04 / FRQ-0023)."""
    clean = codigo.strip().upper()
    if not clean.startswith('SS-') and clean.isdigit():
        clean = f'SS-{clean}'
    order = Order.query.filter(func.upper(Order.numero_pedido) == clean).first()
    if not order:
        return jsonify({'error': f'No se encontró ningún pedido con el código {codigo}.'}), 404
    return jsonify(order.to_dict())


@orders_bp.route('/<int:id>', methods=['GET'])
def get_order(id):
    order = db.session.get(Order, id)
    if not order:
        return jsonify({'error': 'Pedido no encontrado.'}), 404
    return jsonify(order.to_dict())


@orders_bp.route('/', methods=['POST'])
def create_order():
    data = request.get_json() or {}
    nombre_cliente = (data.get('nombre_cliente') or '').strip()
    if not nombre_cliente:
        return jsonify({'error': 'El nombre del cliente es obligatorio.'}), 400

    items_data = data.get('items') or []
    if not items_data:
        return jsonify({'error': 'El pedido debe incluir al menos un producto.'}), 400

    # Agrupar cantidades por producto para validar stock real
    agrupados = {}
    for raw in items_data:
        pid = raw.get('product_id') or raw.get('id')
        try:
            pid = int(pid)
            qty = int(raw.get('cantidad', 1))
        except (TypeError, ValueError):
            return jsonify({'error': 'Formato inválido en los productos del pedido.'}), 400
        if qty <= 0:
            return jsonify({'error': 'La cantidad por producto debe ser mayor a cero.'}), 400
        agrupados[pid] = agrupados.get(pid, 0) + qty

    productos_map = {}
    for pid, total_qty in agrupados.items():
        product = db.session.get(Product, pid)
        if not product or not product.activo:
            return jsonify({'error': f'El producto #{pid} no está disponible.'}), 400
        if (product.stock or 0) < total_qty:
            return jsonify({
                'error': f'Stock insuficiente para "{product.nombre}" (disponible: {product.stock}, solicitado: {total_qty}).'
            }), 400
        productos_map[pid] = product

    subtotal = 0.0
    order_items = []
    for pid, qty in agrupados.items():
        product = productos_map[pid]
        precio = product.precio_final
        item_sub = round(precio * qty, 2)
        subtotal += item_sub
        order_items.append(OrderItem(
            product_id=product.id,
            nombre_producto=product.nombre,
            cantidad=qty,
            precio_unitario=precio,
            subtotal=item_sub
        ))

    canal = (data.get('canal') or 'web').strip().lower()
    metodo_entrega = (data.get('metodo_entrega') or 'domicilio').strip().lower()
    if metodo_entrega == 'retiro':
        costo_envio = 0.0
        direccion_entrega = data.get('direccion_entrega') or 'Retiro en Concept Store — Camino de Oriente'
    else:
        costo_envio = max(0.0, float(data.get('costo_envio') or 0))
        direccion_entrega = (data.get('direccion_entrega') or '').strip()

    descuento = max(0.0, float(data.get('descuento') or 0))
    iva_rate = float(current_app.config.get('IVA_RATE', 0.0))
    base_imponible = max(0.0, subtotal - descuento)
    iva = round(base_imponible * iva_rate, 2)
    total = round(base_imponible + costo_envio + iva, 2)

    monto_pago_cliente = data.get('monto_pago_cliente')
    cambio_entregar = 0.0
    if monto_pago_cliente not in (None, ''):
        try:
            monto_pago_cliente = float(monto_pago_cliente)
            if monto_pago_cliente >= total:
                cambio_entregar = round(monto_pago_cliente - total, 2)
        except (TypeError, ValueError):
            monto_pago_cliente = None
    else:
        monto_pago_cliente = None

    user = get_current_user_obj()
    client = upsert_client(
        nombre=nombre_cliente,
        telefono=data.get('telefono_cliente'),
        email=data.get('email_cliente'),
        direccion=direccion_entrega if metodo_entrega == 'domicilio' else None
    )

    estado_inicial = data.get('estado', 'pendiente')
    if estado_inicial not in ('pendiente', 'confirmado', 'en_camino', 'entregado'):
        estado_inicial = 'pendiente'

    numero_pedido = generar_numero_pedido()
    order = Order(
        numero_pedido=numero_pedido,
        user_id=user.id if user else data.get('user_id'),
        client_id=client.id if client else None,
        motorizado_id=data.get('motorizado_id') or None,
        nombre_cliente=nombre_cliente,
        telefono_cliente=(data.get('telefono_cliente') or '').strip() or None,
        email_cliente=(data.get('email_cliente') or '').strip() or None,
        metodo_entrega=metodo_entrega,
        direccion_entrega=direccion_entrega,
        estado=estado_inicial,
        subtotal=round(subtotal, 2),
        descuento=round(descuento, 2),
        costo_envio=round(costo_envio, 2),
        iva=iva,
        total=total,
        metodo_pago=data.get('metodo_pago', 'efectivo_entrega'),
        monto_pago_cliente=monto_pago_cliente,
        cambio_entregar=cambio_entregar,
        notas=data.get('notas'),
        canal=canal,
        fecha_entrega=datetime.utcnow() if estado_inicial == 'entregado' else None,
        items=order_items
    )
    db.session.add(order)
    db.session.flush()

    # Descontar stock y registrar kardex
    for pid, qty in agrupados.items():
        product = productos_map[pid]
        stock_ant = product.stock or 0
        ubicacion = _deduct_stock(product, qty, canal)
        mov = InventoryMovement(
            product_id=product.id,
            tipo='venta',
            ubicacion=ubicacion,
            cantidad=qty,
            stock_anterior=stock_ant,
            stock_nuevo=product.stock,
            motivo=f'Pedido {numero_pedido} ({canal})',
            user_id=user.id if user else None
        )
        db.session.add(mov)

    db.session.add(OrderStatusHistory(
        order_id=order.id,
        user_id=user.id if user else None,
        estado_anterior=None,
        estado_nuevo=estado_inicial,
        observacion=f'Pedido creado vía {canal}'
    ))

    db.session.commit()
    return jsonify(order.to_dict()), 201


@orders_bp.route('/<int:id>/estado', methods=['PUT'])
@staff_required
def update_estado(id):
    order = db.session.get(Order, id)
    if not order:
        return jsonify({'error': 'Pedido no encontrado.'}), 404

    data = request.get_json() or {}
    estados_validos = ['pendiente', 'confirmado', 'en_camino', 'entregado', 'cancelado']
    nuevo_estado = (data.get('estado') or '').strip()
    if nuevo_estado not in estados_validos:
        return jsonify({'error': 'Estado no válido.'}), 400

    estado_anterior = order.estado
    user = get_current_user_obj()

    if 'motorizado_id' in data:
        mid = data.get('motorizado_id')
        order.motorizado_id = int(mid) if mid else None

    if nuevo_estado == estado_anterior:
        db.session.commit()
        return jsonify(order.to_dict())

    # Si pasa a cancelado desde un estado activo -> devolver stock al inventario
    if nuevo_estado == 'cancelado' and estado_anterior != 'cancelado':
        for item in order.items:
            if item.product_id:
                product = db.session.get(Product, item.product_id)
                if product:
                    stock_ant = product.stock or 0
                    ubicacion = _restore_stock(product, item.cantidad, order.canal)
                    db.session.add(InventoryMovement(
                        product_id=product.id,
                        tipo='anulacion',
                        ubicacion=ubicacion,
                        cantidad=item.cantidad,
                        stock_anterior=stock_ant,
                        stock_nuevo=product.stock,
                        motivo=f'Cancelación de pedido {order.numero_pedido}',
                        user_id=user.id if user else None
                    ))
        # Si tenía factura emitida/pagada asociada, anularla también
        if order.invoice and order.invoice.estado != 'anulada':
            order.invoice.estado = 'anulada'
            order.invoice.motivo_anulacion = f'Pedido {order.numero_pedido} cancelado'

    # Si se reactiva un pedido previamente cancelado -> volver a validar y descontar stock
    elif estado_anterior == 'cancelado' and nuevo_estado != 'cancelado':
        for item in order.items:
            if item.product_id:
                product = db.session.get(Product, item.product_id)
                if not product or (product.stock or 0) < item.cantidad:
                    return jsonify({
                        'error': f'No hay stock suficiente de "{item.nombre_producto}" para reactivar el pedido.'
                    }), 400
        for item in order.items:
            if item.product_id:
                product = db.session.get(Product, item.product_id)
                stock_ant = product.stock or 0
                ubicacion = _deduct_stock(product, item.cantidad, order.canal)
                db.session.add(InventoryMovement(
                    product_id=product.id,
                    tipo='venta',
                    ubicacion=ubicacion,
                    cantidad=item.cantidad,
                    stock_anterior=stock_ant,
                    stock_nuevo=product.stock,
                    motivo=f'Reactivación de pedido {order.numero_pedido}',
                    user_id=user.id if user else None
                ))

    order.estado = nuevo_estado
    if nuevo_estado == 'entregado':
        order.fecha_entrega = datetime.utcnow()

    db.session.add(OrderStatusHistory(
        order_id=order.id,
        user_id=user.id if user else None,
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        observacion=data.get('observacion') or f'Cambio de estado: {estado_anterior} -> {nuevo_estado}'
    ))

    db.session.commit()
    return jsonify(order.to_dict())


@orders_bp.route('/<int:id>/motorizado', methods=['PUT'])
@staff_required
def assign_motorizado(id):
    """Asigna o actualiza el motorizado de entrega para un pedido (FRQ-0025 / HU-09)."""
    order = db.session.get(Order, id)
    if not order:
        return jsonify({'error': 'Pedido no encontrado.'}), 404

    data = request.get_json() or {}
    mid = data.get('motorizado_id')
    user = get_current_user_obj()

    if mid:
        moto = db.session.get(Motorizado, int(mid))
        if not moto:
            return jsonify({'error': 'Motorizado no encontrado.'}), 404
        order.motorizado_id = moto.id
        obs = f'Motorizado asignado: {moto.nombre} ({moto.empresa or "Independiente"})'
    else:
        order.motorizado_id = None
        obs = 'Motorizado desasignado'

    if data.get('pasar_en_camino') and order.estado in ('pendiente', 'confirmado'):
        ant = order.estado
        order.estado = 'en_camino'
        db.session.add(OrderStatusHistory(
            order_id=order.id,
            user_id=user.id if user else None,
            estado_anterior=ant,
            estado_nuevo='en_camino',
            observacion=obs
        ))

    db.session.commit()
    return jsonify(order.to_dict())


@orders_bp.route('/motorizados', methods=['GET'])
def list_motorizados():
    solo_activos = request.args.get('activos', 'true').lower() == 'true'
    query = Motorizado.query
    if solo_activos:
        query = query.filter_by(activo=True)
    return jsonify([m.to_dict() for m in query.order_by(Motorizado.nombre).all()])


@orders_bp.route('/motorizados', methods=['POST'])
@staff_required
def create_motorizado():
    data = request.get_json() or {}
    nombre = (data.get('nombre') or '').strip()
    telefono = (data.get('telefono') or '').strip()
    if not nombre or not telefono:
        return jsonify({'error': 'Nombre y teléfono del motorizado son obligatorios.'}), 400
    moto = Motorizado(
        nombre=nombre,
        telefono=telefono,
        empresa=(data.get('empresa') or 'Independiente').strip(),
        activo=bool(data.get('activo', True))
    )
    db.session.add(moto)
    db.session.commit()
    return jsonify(moto.to_dict()), 201


@orders_bp.route('/motorizados/<int:mid>', methods=['PUT'])
@staff_required
def update_motorizado(mid):
    moto = db.session.get(Motorizado, mid)
    if not moto:
        return jsonify({'error': 'Motorizado no encontrado.'}), 404
    data = request.get_json() or {}
    if 'nombre' in data and data['nombre'].strip():
        moto.nombre = data['nombre'].strip()
    if 'telefono' in data and data['telefono'].strip():
        moto.telefono = data['telefono'].strip()
    if 'empresa' in data:
        moto.empresa = (data['empresa'] or '').strip()
    if 'activo' in data:
        moto.activo = bool(data['activo'])
    db.session.commit()
    return jsonify(moto.to_dict())


@orders_bp.route('/stats', methods=['GET'])
def order_stats():
    total = Order.query.count()
    pendientes = Order.query.filter_by(estado='pendiente').count()
    confirmados = Order.query.filter_by(estado='confirmado').count()
    en_camino = Order.query.filter_by(estado='en_camino').count()
    entregados = Order.query.filter_by(estado='entregado').count()
    cancelados = Order.query.filter_by(estado='cancelado').count()
    ingresos = db.session.query(func.sum(Order.total)).filter(
        Order.estado.in_(['confirmado', 'en_camino', 'entregado'])
    ).scalar() or 0
    return jsonify({
        'total': total,
        'pendientes': pendientes,
        'confirmados': confirmados,
        'en_camino': en_camino,
        'entregados': entregados,
        'cancelados': cancelados,
        'ingresos_total': round(float(ingresos), 2)
    })
