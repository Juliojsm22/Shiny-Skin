from flask import Blueprint, jsonify, request
from models import db, User
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'El email ya está registrado'}), 400
    user = User(
        nombre=data['nombre'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        telefono=data.get('telefono'),
        rol='cliente'
    )
    db.session.add(user)
    db.session.commit()
    token = create_access_token(identity={'id': user.id, 'email': user.email, 'rol': user.rol})
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'error': 'Credenciales incorrectas'}), 401
    token = create_access_token(identity={'id': user.id, 'email': user.email, 'rol': user.rol})
    return jsonify({'token': token, 'user': user.to_dict()})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    identity = get_jwt_identity()
    user = User.query.get(identity['id'])
    return jsonify(user.to_dict())


@auth_bp.route('/usuarios', methods=['GET'])
@jwt_required()
def get_users():
    identity = get_jwt_identity()
    if identity['rol'] != 'admin':
        return jsonify({'error': 'Acceso denegado'}), 403
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])
