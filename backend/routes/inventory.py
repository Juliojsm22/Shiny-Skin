from flask import Blueprint, jsonify, request
from models import db, Product, InventoryMovement

inventory_bp = Blueprint('inventory', __name__)


@inventory_bp.route('/movimientos', methods=['GET'])
def get_movements():
    product_id = request.args.get('product_id')
    tipo = request.args.get('tipo')
    query = InventoryMovement.query
    if product_id:
        query = query.filter_by(product_id=product_id)
    if tipo:
        query = query.filter_by(tipo=tipo)
    movs = query.order_by(InventoryMovement.fecha.desc()).limit(200).all()
    return jsonify([m.to_dict() for m in movs])


@inventory_bp.route('/entrada', methods=['POST'])
def entrada_stock():
    data = request.get_json()
    product = Product.query.get_or_404(data['product_id'])
    cantidad = data['cantidad']
    stock_ant = product.stock
    product.stock += cantidad
    mov = InventoryMovement(
        product_id=product.id, tipo='entrada',
        cantidad=cantidad, stock_anterior=stock_ant,
        stock_nuevo=product.stock,
        motivo=data.get('motivo', 'Entrada de inventario'),
        user_id=data.get('user_id')
    )
    db.session.add(mov)
    db.session.commit()
    return jsonify({'message': 'Entrada registrada', 'stock_nuevo': product.stock, 'movimiento': mov.to_dict()})


@inventory_bp.route('/ajuste', methods=['POST'])
def ajuste_stock():
    data = request.get_json()
    product = Product.query.get_or_404(data['product_id'])
    nuevo_stock = data['nuevo_stock']
    diferencia = nuevo_stock - product.stock
    stock_ant = product.stock
    mov = InventoryMovement(
        product_id=product.id, tipo='ajuste',
        cantidad=abs(diferencia),
        stock_anterior=stock_ant,
        stock_nuevo=nuevo_stock,
        motivo=data.get('motivo', 'Ajuste manual de inventario'),
        user_id=data.get('user_id')
    )
    product.stock = nuevo_stock
    db.session.add(mov)
    db.session.commit()
    return jsonify({'message': 'Ajuste realizado', 'stock_nuevo': product.stock})


@inventory_bp.route('/resumen', methods=['GET'])
def resumen():
    total_productos = Product.query.filter_by(activo=True).count()
    stock_critico = Product.query.filter(
        Product.activo == True, Product.stock <= Product.stock_minimo
    ).count()
    sin_stock = Product.query.filter(Product.activo == True, Product.stock == 0).count()
    return jsonify({
        'total_productos': total_productos,
        'stock_critico': stock_critico,
        'sin_stock': sin_stock
    })
