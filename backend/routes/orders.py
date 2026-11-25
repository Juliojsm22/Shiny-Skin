from flask import Blueprint, jsonify, request, current_app, Response, stream_with_context
from sqlalchemy import or_, func
from models import (
    db, Order, OrderItem, OrderStatusHistory,
    Product, InventoryMovement, Motorizado, StorePromotion, User
)
from routes.utils import (
    get_current_user_obj, get_staff_from_request_or_query, is_staff_request,
    staff_required, admin_required, upsert_client, now_ni, now_ni_naive,
    validate_full_name, validate_ni_phone
)
from routes.loyalty import (
    get_or_create_loyalty_config, find_customer_user,
    calculate_points_earned, compute_redemption, apply_loyalty_tx
)
from events import order_event_bus
from datetime import datetime
import json
import queue
import random
import string

orders_bp = Blueprint('orders', __name__)

FREE_SHIPPING_THRESHOLD = 1500.0
STANDARD_SHIPPING_COST = 100.0


def generar_numero_pedido():
    for _ in range(25):
        code = 'SS-' + ''.join(random.choices(string.digits, k=6))
        if not Order.query.filter_by(numero_pedido=code).first():
            return code
    return 'SS-' + now_ni().strftime('%H%M%S')


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


def _public_tracking_dict(order: Order) -> dict:
    """Versión pública segura para seguimiento de pedidos (protege PII conforme a Ley 787)."""
    d = order.to_dict()
    # Ocultar datos personales sensibles en consulta pública sin autenticación
    d.pop('email_cliente', None)
    d.pop('telefono_cliente', None)
    if d.get('metodo_entrega') == 'domicilio':
        d['direccion_entrega'] = 'Dirección registrada para entrega a domicilio'
    return d


@orders_bp.route('/', methods=['GET'])
@staff_required
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

    orders = query.order_by(Order.fecha.desc(), Order.id.desc()).all()
    return jsonify([o.to_dict() for o in orders])


@orders_bp.route('/alertas', methods=['GET'])
@staff_required
def get_order_alerts():
    """Endpoint ligero de sincronización en tiempo real para notificaciones inmediatas al personal."""
    since_id = request.args.get('since_id', type=int)

    latest_order = Order.query.order_by(Order.id.desc()).first()
    latest_id = latest_order.id if latest_order else 0

    pending_orders = (
        Order.query
        .filter_by(estado='pendiente')
        .order_by(Order.id.desc())
        .limit(15)
        .all()
    )
    pending_count = Order.query.filter_by(estado='pendiente').count()
    en_camino_count = Order.query.filter_by(estado='en_camino').count()

    new_orders = []
    if since_id is not None and since_id >= 0:
        rows = (
            Order.query
            .filter(Order.id > since_id)
            .order_by(Order.id.desc())
            .limit(20)
            .all()
        )
        new_orders = [o.to_dict() for o in rows]

    return jsonify({
        'server_time': now_ni().isoformat(),
        'latest_order_id': latest_id,
        'pending_count': pending_count,
        'en_camino_count': en_camino_count,
        'new_orders': new_orders,
        'pending_orders': [o.to_dict() for o in pending_orders],
    })


@orders_bp.route('/stream', methods=['GET'])
def stream_orders():
    """Server-Sent Events (SSE): empuja nuevos pedidos al instante al panel administrativo."""
    staff_user = get_staff_from_request_or_query()
    if not staff_user:
        db.session.remove()
        return jsonify({'error': 'Autenticación de personal requerida para alertas en tiempo real.'}), 401

    staff_name = staff_user.nombre
    # CRÍTICO: liberar la sesión/conexión de BD antes de abrir el stream infinito
    # para no dejar transacciones abiertas (idle in transaction) bloqueando PostgreSQL.
    db.session.remove()

    sub_q = order_event_bus.subscribe()

    @stream_with_context
    def event_generator():
        try:
            hello = json.dumps({
                'status': 'connected',
                'staff': staff_name,
                'server_time': now_ni().isoformat(),
            }, ensure_ascii=False)
            yield f"event: connected\ndata: {hello}\n\n"
            while True:
                try:
                    msg = sub_q.get(timeout=20)
                    yield msg
                except queue.Empty:
                    yield f": keepalive {now_ni().isoformat()}\n\n"
        except GeneratorExit:
            pass
        finally:
            order_event_bus.unsubscribe(sub_q)

    return Response(
        event_generator(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
        }
    )


@orders_bp.route('/seguimiento/<string:codigo>', methods=['GET'])
def seguimiento_pedido(codigo):
    """Consulta pública del estado de un pedido por su código (HU-04 / FRQ-0023)."""
    clean = codigo.strip().upper()
    if not clean.startswith('SS-') and clean.isdigit():
        clean = f'SS-{clean}'
    order = Order.query.filter(func.upper(Order.numero_pedido) == clean).first()
    if not order:
        return jsonify({'error': f'No se encontró ningún pedido con el código {codigo}.'}), 404
    if is_staff_request():
        return jsonify(order.to_dict())
    return jsonify(_public_tracking_dict(order))


@orders_bp.route('/<int:id>', methods=['GET'])
@staff_required
def get_order(id):
    order = db.session.get(Order, id)
    if not order:
        return jsonify({'error': 'Pedido no encontrado.'}), 404
    return jsonify(order.to_dict())


@orders_bp.route('/', methods=['POST'])
def create_order():
    data = request.get_json(silent=True) or {}
    staff_caller = is_staff_request()
    user = get_current_user_obj()

    nombre_cliente, err_nombre = validate_full_name(data.get('nombre_cliente'), required=True, field_label='El nombre completo del cliente')
    if err_nombre:
        return jsonify({'error': err_nombre}), 400

    telefono_cliente, err_tel = validate_ni_phone(
        data.get('telefono_cliente'),
        required=(not staff_caller),
        field_label='El teléfono / WhatsApp'
    )
    if err_tel:
        return jsonify({'error': err_tel}), 400
    telefono_cliente = telefono_cliente or ''

    items_data = data.get('items') or []
    if not isinstance(items_data, list) or not items_data:
        return jsonify({'error': 'El pedido debe incluir al menos un producto.'}), 400

    # Agrupar cantidades por producto para validar stock real
    agrupados = {}
    for raw in items_data:
        if not isinstance(raw, dict):
            return jsonify({'error': 'Formato inválido en los productos del pedido.'}), 400
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
    subtotal = round(subtotal, 2)

    canal_raw = (data.get('canal') or 'web').strip().lower()
    if staff_caller and canal_raw in ('web', 'whatsapp', 'instagram', 'tienda_fisica'):
        canal = canal_raw
    else:
        canal = 'web'

    metodo_entrega = (data.get('metodo_entrega') or 'domicilio').strip().lower()
    if metodo_entrega not in ('domicilio', 'retiro'):
        metodo_entrega = 'domicilio'

    # Validación estricta de descuento general de la tienda en servidor
    cupon_code = (data.get('cupon') or '').strip().upper()
    descuento = 0.0
    nota_cupon = ''
    if cupon_code:
        promo = StorePromotion.query.order_by(StorePromotion.id.asc()).first()
        if not promo or not promo.activo or not promo.codigo or (promo.porcentaje or 0) <= 0:
            return jsonify({'error': 'Actualmente no hay un descuento general habilitado en la tienda.'}), 400
        active_code = promo.codigo.strip().upper()
        if cupon_code != active_code:
            return jsonify({'error': f'El código de descuento "{cupon_code}" no es válido o no está activo.'}), 400
        pct = round(float(promo.porcentaje), 2)
        descuento = round(subtotal * (pct / 100.0), 2)
        nota_cupon = f'[Descuento Tienda {active_code}: -{pct:g}%]'
    elif staff_caller:
        try:
            descuento = min(subtotal, max(0.0, round(float(data.get('descuento') or 0), 2)))
        except (TypeError, ValueError):
            return jsonify({'error': 'El descuento indicado no es válido.'}), 400

    # Identificar cuenta registrada del cliente para Club Shiny Points
    loyalty_cfg = get_or_create_loyalty_config()
    if user and not staff_caller:
        customer_user = user
    elif staff_caller:
        customer_user = find_customer_user(
            user_id=data.get('cliente_user_id'),
            telefono=telefono_cliente,
            email=data.get('email_cliente')
        )
        if customer_user and customer_user.rol != 'cliente' and not data.get('cliente_user_id'):
            customer_user = None
    else:
        customer_user = None

    # Canje de puntos Club Shiny (bloques de 250 pts = $10 / C$ 366.20)
    try:
        canjear_bloques = int(data.get('canjear_bloques') or 0)
    except (TypeError, ValueError):
        return jsonify({'error': 'Cantidad de bloques de puntos a canjear inválida.'}), 400
    if canjear_bloques < 0:
        return jsonify({'error': 'Cantidad de bloques de puntos inválida.'}), 400

    base_tras_cupon = max(0.0, round(subtotal - descuento, 2))
    puntos_usados, descuento_puntos, err_pts = compute_redemption(
        customer_user, canjear_bloques, base_tras_cupon, loyalty_cfg
    )
    if err_pts:
        return jsonify({'error': err_pts}), 400

    if descuento_puntos > 0:
        descuento = round(descuento + descuento_puntos, 2)
        nota_pts = f'[Canje Club Shiny: -{puntos_usados} pts / -C$ {descuento_puntos:.2f}]'
        nota_cupon = f'{nota_cupon} {nota_pts}'.strip()

    base_imponible = max(0.0, round(subtotal - descuento, 2))
    puntos_ganados = calculate_points_earned(base_imponible, loyalty_cfg) if customer_user else 0

    # Cálculo seguro del costo de envío y dirección
    if metodo_entrega == 'retiro':
        costo_envio = 0.0
        direccion_entrega = (data.get('direccion_entrega') or '').strip() or 'Retiro en Concept Store — Camino de Oriente'
    else:
        direccion_entrega = (data.get('direccion_entrega') or '').strip()
        if not staff_caller and not direccion_entrega:
            return jsonify({'error': 'Ingresa tu dirección exacta para el envío a domicilio.'}), 400
        if staff_caller and data.get('costo_envio') is not None:
            try:
                costo_envio = max(0.0, round(float(data.get('costo_envio') or 0), 2))
            except (TypeError, ValueError):
                return jsonify({'error': 'El costo de envío indicado no es válido.'}), 400
        else:
            costo_envio = 0.0 if base_imponible >= FREE_SHIPPING_THRESHOLD else STANDARD_SHIPPING_COST

    iva_rate = float(current_app.config.get('IVA_RATE', 0.0))
    iva = round(base_imponible * iva_rate, 2)
    total = round(base_imponible + costo_envio + iva, 2)

    metodo_pago = (data.get('metodo_pago') or 'efectivo_entrega').strip()
    monto_pago_cliente = data.get('monto_pago_cliente')
    cambio_entregar = 0.0
    if monto_pago_cliente not in (None, ''):
        try:
            monto_pago_cliente = round(float(monto_pago_cliente), 2)
        except (TypeError, ValueError):
            return jsonify({'error': 'El monto de pago en efectivo no es válido.'}), 400
        if monto_pago_cliente > 0:
            if metodo_pago == 'efectivo_entrega' and monto_pago_cliente < total:
                return jsonify({'error': f'El monto con el que pagarás (C$ {monto_pago_cliente:.2f}) debe ser al menos C$ {total:.2f}.'}), 400
            cambio_entregar = max(0.0, round(monto_pago_cliente - total, 2))
        else:
            monto_pago_cliente = None
    else:
        monto_pago_cliente = None

    motorizado_id = None
    if staff_caller and data.get('motorizado_id'):
        try:
            mid = int(data.get('motorizado_id'))
            moto = db.session.get(Motorizado, mid)
            if not moto:
                return jsonify({'error': 'El motorizado seleccionado no existe.'}), 400
            motorizado_id = moto.id
        except (TypeError, ValueError):
            return jsonify({'error': 'ID de motorizado inválido.'}), 400

    client = upsert_client(
        nombre=nombre_cliente,
        telefono=telefono_cliente or None,
        email=data.get('email_cliente'),
        direccion=direccion_entrega if metodo_entrega == 'domicilio' else None
    )

    if staff_caller:
        estado_inicial = (data.get('estado') or 'pendiente').strip()
        if estado_inicial not in ('pendiente', 'confirmado', 'en_camino', 'entregado'):
            estado_inicial = 'pendiente'
    else:
        estado_inicial = 'pendiente'

    notas_raw = (data.get('notas') or '').strip()
    notas_final = f'{nota_cupon} {notas_raw}'.strip() if nota_cupon else (notas_raw or None)

    numero_pedido = generar_numero_pedido()
    now_ts = now_ni_naive()
    acreditar_ahora = bool(customer_user and estado_inicial == 'entregado' and puntos_ganados > 0)
    order = Order(
        numero_pedido=numero_pedido,
        user_id=customer_user.id if customer_user else None,
        client_id=client.id if client else None,
        motorizado_id=motorizado_id,
        nombre_cliente=nombre_cliente,
        telefono_cliente=telefono_cliente or None,
        email_cliente=(data.get('email_cliente') or '').strip() or None,
        metodo_entrega=metodo_entrega,
        direccion_entrega=direccion_entrega,
        estado=estado_inicial,
        subtotal=subtotal,
        descuento=descuento,
        costo_envio=costo_envio,
        iva=iva,
        total=total,
        puntos_usados=puntos_usados,
        descuento_puntos=descuento_puntos,
        puntos_ganados=puntos_ganados,
        puntos_acreditados=acreditar_ahora,
        metodo_pago=metodo_pago,
        monto_pago_cliente=monto_pago_cliente,
        cambio_entregar=cambio_entregar,
        notas=notas_final,
        canal=canal,
        fecha=now_ts,
        fecha_entrega=now_ts if estado_inicial == 'entregado' else None,
        items=order_items
    )
    db.session.add(order)
    db.session.flush()

    # Registrar movimientos de puntos (canje inmediato + acreditación si ya nació entregado)
    if customer_user and puntos_usados > 0:
        apply_loyalty_tx(
            customer_user,
            tipo='canjeado',
            puntos_delta=-puntos_usados,
            descripcion=f'Canje en pedido {numero_pedido} (-C$ {descuento_puntos:.2f})',
            monto_relacionado=descuento_puntos,
            order_id=order.id,
        )
    if acreditar_ahora:
        apply_loyalty_tx(
            customer_user,
            tipo='ganado',
            puntos_delta=puntos_ganados,
            descripcion=f'Puntos ganados por pedido {numero_pedido}',
            monto_relacionado=base_imponible,
            order_id=order.id,
            count_towards_lifetime=True,
        )

    # Descontar stock y registrar kardex
    for pid, qty in agrupados.items():
        product = productos_map[pid]
        stock_ant = product.stock or 0
        ubicacion = _deduct_stock(product, qty, canal)
        db.session.add(InventoryMovement(
            product_id=product.id,
            tipo='venta',
            ubicacion=ubicacion,
            cantidad=qty,
            stock_anterior=stock_ant,
            stock_nuevo=product.stock,
            motivo=f'Pedido {numero_pedido} ({canal})',
            user_id=user.id if user else None,
            fecha=now_ts
        ))

    db.session.add(OrderStatusHistory(
        order_id=order.id,
        user_id=user.id if user else None,
        estado_anterior=None,
        estado_nuevo=estado_inicial,
        observacion=f'Pedido recibido vía {canal}' + (f' {nota_cupon}' if nota_cupon else ''),
        fecha=now_ts
    ))

    db.session.commit()

    order_dict = order.to_dict()
    # Emitir notificación instantánea en tiempo real a todos los paneles administrativos abiertos
    try:
        order_event_bus.publish('new_order', order_dict)
    except Exception:
        pass

    return jsonify(order_dict), 201


@orders_bp.route('/<int:id>/estado', methods=['PUT'])
@staff_required
def update_estado(id):
    order = db.session.get(Order, id)
    if not order:
        return jsonify({'error': 'Pedido no encontrado.'}), 404

    data = request.get_json(silent=True) or {}
    estados_validos = ('pendiente', 'confirmado', 'en_camino', 'entregado', 'cancelado')
    nuevo_estado = (data.get('estado') or '').strip()
    if nuevo_estado not in estados_validos:
        return jsonify({'error': 'Estado no válido.'}), 400

    estado_anterior = order.estado
    user = get_current_user_obj()

    if 'motorizado_id' in data:
        mid = data.get('motorizado_id')
        if mid in (None, ''):
            order.motorizado_id = None
        else:
            try:
                moto = db.session.get(Motorizado, int(mid))
                if not moto:
                    return jsonify({'error': 'Motorizado no encontrado.'}), 404
                order.motorizado_id = moto.id
            except (TypeError, ValueError):
                return jsonify({'error': 'ID de motorizado inválido.'}), 400

    if nuevo_estado == estado_anterior:
        db.session.commit()
        order_dict = order.to_dict()
        try:
            order_event_bus.publish('order_updated', order_dict)
        except Exception:
            pass
        return jsonify(order_dict)

    now_ts = now_ni_naive()

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
                        user_id=user.id if user else None,
                        fecha=now_ts
                    ))
        if order.invoice and order.invoice.estado != 'anulada':
            order.invoice.estado = 'anulada'
            order.invoice.motivo_anulacion = f'Pedido {order.numero_pedido} cancelado'

        # Reversión automática de puntos ganados y devolución de puntos canjeados al cancelar
        cust = db.session.get(User, order.user_id) if order.user_id else None
        if cust:
            if order.puntos_acreditados and (order.puntos_ganados or 0) > 0:
                apply_loyalty_tx(
                    cust,
                    tipo='reversion',
                    puntos_delta=-int(order.puntos_ganados),
                    descripcion=f'Reversión de puntos por cancelación de {order.numero_pedido}',
                    order_id=order.id,
                )
                order.puntos_acreditados = False
            if (order.puntos_usados or 0) > 0:
                apply_loyalty_tx(
                    cust,
                    tipo='reversion',
                    puntos_delta=int(order.puntos_usados),
                    descripcion=f'Devolución de puntos canjeados por cancelación de {order.numero_pedido}',
                    monto_relacionado=order.descuento_puntos or 0,
                    order_id=order.id,
                )

    # Si se reactiva un pedido previamente cancelado -> volver a validar y descontar stock
    elif estado_anterior == 'cancelado' and nuevo_estado != 'cancelado':
        cust = db.session.get(User, order.user_id) if order.user_id else None
        if cust and (order.puntos_usados or 0) > 0:
            if int(cust.puntos_saldo or 0) < int(order.puntos_usados):
                return jsonify({
                    'error': f'El cliente ya no cuenta con {order.puntos_usados} puntos para reactivar este pedido.'
                }), 400
            apply_loyalty_tx(
                cust,
                tipo='canjeado',
                puntos_delta=-int(order.puntos_usados),
                descripcion=f'Canje re-aplicado por reactivación de {order.numero_pedido}',
                monto_relacionado=order.descuento_puntos or 0,
                order_id=order.id,
            )
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
                    user_id=user.id if user else None,
                    fecha=now_ts
                ))

    order.estado = nuevo_estado
    if nuevo_estado == 'entregado':
        order.fecha_entrega = now_ts
        # Acreditar puntos Club Shiny al confirmarse la entrega real (anti-fraude)
        if order.user_id and not order.puntos_acreditados and (order.puntos_ganados or 0) > 0:
            cust = db.session.get(User, order.user_id)
            if cust:
                apply_loyalty_tx(
                    cust,
                    tipo='ganado',
                    puntos_delta=int(order.puntos_ganados),
                    descripcion=f'Puntos ganados por pedido entregado {order.numero_pedido}',
                    monto_relacionado=max(0.0, round((order.subtotal or 0) - (order.descuento or 0), 2)),
                    order_id=order.id,
                    count_towards_lifetime=True,
                )
                order.puntos_acreditados = True

    db.session.add(OrderStatusHistory(
        order_id=order.id,
        user_id=user.id if user else None,
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        observacion=data.get('observacion') or f'Cambio de estado: {estado_anterior} -> {nuevo_estado}',
        fecha=now_ts
    ))

    db.session.commit()
    order_dict = order.to_dict()
    try:
        order_event_bus.publish('order_updated', order_dict)
    except Exception:
        pass
    return jsonify(order_dict)


@orders_bp.route('/<int:id>/motorizado', methods=['PUT'])
@staff_required
def assign_motorizado(id):
    """Asigna o actualiza el motorizado de entrega para un pedido (FRQ-0025 / HU-09)."""
    order = db.session.get(Order, id)
    if not order:
        return jsonify({'error': 'Pedido no encontrado.'}), 404

    data = request.get_json(silent=True) or {}
    mid = data.get('motorizado_id')
    user = get_current_user_obj()

    if mid:
        try:
            moto = db.session.get(Motorizado, int(mid))
        except (TypeError, ValueError):
            return jsonify({'error': 'ID de motorizado inválido.'}), 400
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
            observacion=obs,
            fecha=now_ni_naive()
        ))

    db.session.commit()
    order_dict = order.to_dict()
    try:
        order_event_bus.publish('order_updated', order_dict)
    except Exception:
        pass
    return jsonify(order_dict)


@orders_bp.route('/motorizados', methods=['GET'])
@staff_required
def list_motorizados():
    solo_activos = request.args.get('activos', 'true').lower() == 'true'
    query = Motorizado.query
    if solo_activos:
        query = query.filter_by(activo=True)
    return jsonify([m.to_dict() for m in query.order_by(Motorizado.nombre).all()])


@orders_bp.route('/motorizados', methods=['POST'])
@admin_required
def create_motorizado():
    data = request.get_json(silent=True) or {}
    nombre, err_n = validate_full_name(data.get('nombre'), required=True, field_label='El nombre del motorizado')
    if err_n:
        return jsonify({'error': err_n}), 400
    telefono, err_t = validate_ni_phone(data.get('telefono'), required=True, field_label='El teléfono del motorizado')
    if err_t:
        return jsonify({'error': err_t}), 400
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
@admin_required
def update_motorizado(mid):
    moto = db.session.get(Motorizado, mid)
    if not moto:
        return jsonify({'error': 'Motorizado no encontrado.'}), 404
    data = request.get_json(silent=True) or {}
    if 'nombre' in data and (data['nombre'] or '').strip():
        nombre, err_n = validate_full_name(data['nombre'], required=True, field_label='El nombre del motorizado')
        if err_n:
            return jsonify({'error': err_n}), 400
        moto.nombre = nombre
    if 'telefono' in data and (data['telefono'] or '').strip():
        telefono, err_t = validate_ni_phone(data['telefono'], required=True, field_label='El teléfono del motorizado')
        if err_t:
            return jsonify({'error': err_t}), 400
        moto.telefono = telefono
    if 'empresa' in data:
        moto.empresa = (data['empresa'] or '').strip()
    if 'activo' in data:
        moto.activo = bool(data['activo'])
    db.session.commit()
    return jsonify(moto.to_dict())


@orders_bp.route('/stats', methods=['GET'])
@staff_required
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
        'total_pedidos': total,
        'pendientes': pendientes,
        'confirmados': confirmados,
        'en_camino': en_camino,
        'entregados': entregados,
        'cancelados': cancelados,
        'ingresos_total': round(float(ingresos), 2)
    })
