from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from models import db, Client, Order
from routes.utils import staff_required, admin_required

clients_bp = Blueprint('clients', __name__)


@clients_bp.route('/', methods=['GET'])
@staff_required
def get_clients():
    """Lista la cartera de clientes con total de compras e historial (HU-05 / UC20)."""
    q = request.args.get('q', '').strip()
    query = Client.query
    if q:
        like_q = f'%{q}%'
        query = query.filter(or_(
            Client.nombre.ilike(like_q),
            Client.telefono.ilike(like_q),
            Client.email.ilike(like_q),
            Client.direccion.ilike(like_q)
        ))
    clients = query.order_by(Client.created_at.desc()).all()
    return jsonify([c.to_dict(include_orders=False) for c in clients])


@clients_bp.route('/<int:id>', methods=['GET'])
@staff_required
def get_client(id):
    client = db.session.get(Client, id)
    if not client:
        return jsonify({'error': 'Cliente no encontrado.'}), 404
    return jsonify(client.to_dict(include_orders=True))


@clients_bp.route('/', methods=['POST'])
@staff_required
def create_client():
    data = request.get_json() or {}
    nombre = (data.get('nombre') or '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre del cliente es obligatorio.'}), 400

    telefono = (data.get('telefono') or '').strip() or None
    email = (data.get('email') or '').strip().lower() or None

    if telefono and Client.query.filter_by(telefono=telefono).first():
        return jsonify({'error': f'Ya existe un cliente registrado con el teléfono {telefono}.'}), 400

    client = Client(
        nombre=nombre,
        telefono=telefono,
        email=email,
        direccion=(data.get('direccion') or '').strip() or None,
        notas=(data.get('notas') or '').strip() or None
    )
    db.session.add(client)
    db.session.commit()
    return jsonify(client.to_dict()), 201


@clients_bp.route('/<int:id>', methods=['PUT'])
@staff_required
def update_client(id):
    client = db.session.get(Client, id)
    if not client:
        return jsonify({'error': 'Cliente no encontrado.'}), 404

    data = request.get_json() or {}
    if 'nombre' in data and (data['nombre'] or '').strip():
        client.nombre = data['nombre'].strip()
    if 'telefono' in data:
        client.telefono = (data['telefono'] or '').strip() or None
    if 'email' in data:
        client.email = (data['email'] or '').strip().lower() or None
    if 'direccion' in data:
        client.direccion = (data['direccion'] or '').strip() or None
    if 'notas' in data:
        client.notas = (data['notas'] or '').strip() or None

    db.session.commit()
    return jsonify(client.to_dict(include_orders=True))


@clients_bp.route('/<int:id>', methods=['DELETE'])
@admin_required
def delete_client(id):
    client = db.session.get(Client, id)
    if not client:
        return jsonify({'error': 'Cliente no encontrado.'}), 404
    # Desvincular pedidos históricos sin borrarlos
    for o in Order.query.filter_by(client_id=client.id).all():
        o.client_id = None
    db.session.delete(client)
    db.session.commit()
    return jsonify({'mensaje': 'Cliente eliminado correctamente.'})

