from flask import Blueprint, jsonify, request
from models import db, Order, OrderItem, Product, InventoryMovement
from datetime import datetime
import random, string

orders_bp = Blueprint('orders', __name__)


def generar_numero_pedido():
    return 'SS-' + ''.join(random.choices(string.digits, k=6))


@orders_bp.route('/', methods=['GET'])
def get_orders():
    estado = request.args.get('estado')
    canal = request.args.get('canal')
    query = Order.query
    if estado:
        query = query.filter_by(estado=estado)
    if canal:
        query = query.filter_by(canal=canal)
    orders = query.order_by(Order.fecha.desc()).all()
    return jsonify([o.to_dict() for o in orders])


@orders_bp.route('/<int:id>', methods=['GET'])
def get_order(id):
    order = Order.query.get_or_404(id)
    return jsonify(order.to_dict())


@orders_bp.route('/', methods=['POST'])
def create_order():
    data = request.get_json()
    items_data = data.get('items', [])

    subtotal = 0
    order_items = []

    for item_data in items_data:
        product = Product.query.get(item_data['product_id'])
        if not product or product.stock < item_data['cantidad']:
            return jsonify({'error': f'Stock insuficiente para {product.nombre if product else "producto"}'}), 400
        
        precio = product.precio_final
        item_subtotal = precio * item_data['cantidad']
        subtotal += item_subtotal
        
        order_items.append(OrderItem(
            product_id=product.id,
            nombre_producto=product.nombre,
            cantidad=item_data['cantidad'],
            precio_unitario=precio,
            subtotal=item_subtotal
        ))

    descuento = data.get('descuento', 0)
    base_iva = subtotal - descuento
    iva = round(base_iva * 0.15, 2)
    total = round(base_iva + iva, 2)

    order = Order(
        numero_pedido=generar_numero_pedido(),
        user_id=data.get('user_id'),
        nombre_cliente=data['nombre_cliente'],
        telefono_cliente=data.get('telefono_cliente'),
        email_cliente=data.get('email_cliente'),
        direccion_entrega=data.get('direccion_entrega'),
        subtotal=round(subtotal, 2),
        descuento=descuento,
        iva=iva,
        total=total,
        metodo_pago=data.get('metodo_pago', 'efectivo_entrega'),
        notas=data.get('notas'),
        canal=data.get('canal', 'web'),
        items=order_items
    )
    db.session.add(order)

    # Reducir stock
    for item_data in items_data:
        product = Product.query.get(item_data['product_id'])
        mov = InventoryMovement(
            product_id=product.id, tipo='salida',
            cantidad=item_data['cantidad'],
            stock_anterior=product.stock,
            stock_nuevo=product.stock - item_data['cantidad'],
            motivo=f'Venta pedido {order.numero_pedido}'
        )
        product.stock -= item_data['cantidad']
        db.session.add(mov)

    db.session.commit()
    return jsonify(order.to_dict()), 201


@orders_bp.route('/<int:id>/estado', methods=['PUT'])
def update_estado(id):
    order = Order.query.get_or_404(id)
    data = request.get_json()
    estados_validos = ['pendiente', 'confirmado', 'en_camino', 'entregado', 'cancelado']
    nuevo_estado = data.get('estado')
    if nuevo_estado not in estados_validos:
        return jsonify({'error': 'Estado no válido'}), 400
    order.estado = nuevo_estado
    db.session.commit()
    return jsonify(order.to_dict())


@orders_bp.route('/stats', methods=['GET'])
def order_stats():
    from sqlalchemy import func
    total = Order.query.count()
    pendientes = Order.query.filter_by(estado='pendiente').count()
    entregados = Order.query.filter_by(estado='entregado').count()
    cancelados = Order.query.filter_by(estado='cancelado').count()
    ingresos = db.session.query(func.sum(Order.total)).filter_by(estado='entregado').scalar() or 0
    return jsonify({
        'total': total, 'pendientes': pendientes,
        'entregados': entregados, 'cancelados': cancelados,
        'ingresos_total': round(ingresos, 2)
    })
