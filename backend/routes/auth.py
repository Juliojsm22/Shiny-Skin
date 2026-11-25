import secrets
from datetime import timedelta
from flask import Blueprint, jsonify, request
from models import db, User, PasswordResetToken
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from routes.utils import admin_required, now_ni_naive, _extract_uid, validate_full_name, validate_ni_phone

auth_bp = Blueprint('auth', __name__)


def _issue_token(user: User) -> str:
    return create_access_token(
        identity=str(user.id),
        additional_claims={
            'email': user.email,
            'rol': user.rol,
            'nombre': user.nombre
        }
    )


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    nombre, err_n = validate_full_name(data.get('nombre'), required=True, field_label='El nombre completo')
    if err_n:
        return jsonify({'error': err_n}), 400
    telefono, err_t = validate_ni_phone(data.get('telefono'), required=False, field_label='El teléfono / WhatsApp')
    if err_t:
        return jsonify({'error': err_t}), 400
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Por favor completa correo electrónico y contraseña.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres.'}), 400
    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({'error': 'Este correo electrónico ya está registrado.'}), 400

    base_user = email.split('@')[0]
    username = base_user
    suffix = 1
    while User.query.filter(db.func.lower(User.username) == username.lower()).first():
        username = f'{base_user}{suffix}'
        suffix += 1

    user = User(
        nombre=nombre,
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        telefono=telefono,
        direccion=(data.get('direccion') or '').strip() or None,
        rol='cliente',
        ultimo_acceso=now_ni_naive()
    )
    db.session.add(user)
    db.session.commit()
    token = _issue_token(user)
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get('email') or data.get('username') or '').strip().lower()
    password = data.get('password') or ''

    if not identifier or not password:
        return jsonify({'error': 'Ingresa tu correo o usuario y contraseña.'}), 400

    user = User.query.filter(
        (db.func.lower(User.email) == identifier) |
        (db.func.lower(User.username) == identifier)
    ).first()

    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Credenciales incorrectas. Verifica tu correo/usuario y contraseña.'}), 401
    if not user.activo:
        return jsonify({'error': 'Tu cuenta se encuentra desactivada. Contacta a la administración.'}), 403

    user.ultimo_acceso = now_ni_naive()
    db.session.commit()
    token = _issue_token(user)
    return jsonify({'token': token, 'user': user.to_dict()})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    uid = _extract_uid(get_jwt_identity())
    user = db.session.get(User, uid) if uid else None
    if not user or not user.activo:
        return jsonify({'error': 'Usuario no encontrado o inactivo.'}), 404
    return jsonify(user.to_dict())


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """FRQ-0004 / UC3: Solicitud de recuperación de contraseña."""
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'Ingresa tu correo electrónico registrado.'}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user:
        return jsonify({'error': 'No se encontró ninguna cuenta asociada a ese correo.'}), 404

    code = ''.join(secrets.choice('0123456789') for _ in range(6))
    reset = PasswordResetToken(
        user_id=user.id,
        token=code,
        expires_at=now_ni_naive() + timedelta(minutes=30),
        used=False
    )
    db.session.add(reset)
    db.session.commit()

    return jsonify({
        'message': 'Se ha generado tu código temporal de recuperación (válido por 30 minutos).',
        'codigo_demo': code
    })


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """FRQ-0004 / UC3: Restablecimiento de contraseña mediante código temporal."""
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    token = (data.get('token') or '').strip()
    new_password = data.get('new_password') or ''

    if not email or not token or len(new_password) < 6:
        return jsonify({'error': 'Verifica el correo, el código de 6 dígitos y una nueva contraseña (mín. 6 caracteres).'}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user:
        return jsonify({'error': 'Cuenta no encontrada.'}), 404

    reset = PasswordResetToken.query.filter_by(user_id=user.id, token=token, used=False).first()
    if not reset or reset.expires_at < now_ni_naive():
        return jsonify({'error': 'El código de recuperación es inválido o ha expirado.'}), 400

    user.password_hash = generate_password_hash(new_password)
    reset.used = True
    db.session.commit()
    return jsonify({'message': 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.'})


# ---- Administración de Usuarios (FRQ-0003 / HU-14 / UC2) ----
@auth_bp.route('/usuarios', methods=['GET'])
@admin_required
def get_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@auth_bp.route('/usuarios', methods=['POST'])
@admin_required
def create_user_admin():
    data = request.get_json(silent=True) or {}
    nombre, err_n = validate_full_name(data.get('nombre'), required=True, field_label='El nombre completo')
    if err_n:
        return jsonify({'error': err_n}), 400
    telefono, err_t = validate_ni_phone(data.get('telefono'), required=False, field_label='El teléfono')
    if err_t:
        return jsonify({'error': err_t}), 400
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    rol = data.get('rol', 'vendedor')

    if not email or len(password) < 6:
        return jsonify({'error': 'Nombre, correo y contraseña (mín. 6 caracteres) son obligatorios.'}), 400
    if rol not in ('admin', 'vendedor', 'cliente'):
        return jsonify({'error': 'Rol no válido.'}), 400
    if User.query.filter(db.func.lower(User.email) == email).first():
        return jsonify({'error': 'Ya existe un usuario con ese correo electrónico.'}), 400

    username = (data.get('username') or email.split('@')[0]).strip().lower()
    if User.query.filter(db.func.lower(User.username) == username).first():
        username = f"{username}_{secrets.randbelow(999)}"

    user = User(
        nombre=nombre,
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        rol=rol,
        telefono=telefono,
        direccion=(data.get('direccion') or '').strip() or None,
        activo=bool(data.get('activo', True))
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@auth_bp.route('/usuarios/<int:user_id>', methods=['PUT'])
@admin_required
def update_user_admin(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado.'}), 404
    data = request.get_json(silent=True) or {}

    if 'nombre' in data and (data['nombre'] or '').strip():
        nombre, err_n = validate_full_name(data['nombre'], required=True, field_label='El nombre completo')
        if err_n:
            return jsonify({'error': err_n}), 400
        user.nombre = nombre
    if 'username' in data and (data['username'] or '').strip():
        new_username = data['username'].strip().lower()
        existing_u = User.query.filter(db.func.lower(User.username) == new_username, User.id != user.id).first()
        if existing_u:
            return jsonify({'error': f'El nombre de usuario "{new_username}" ya está en uso.'}), 400
        user.username = new_username
    if 'email' in data and (data['email'] or '').strip():
        new_email = data['email'].strip().lower()
        existing = User.query.filter(db.func.lower(User.email) == new_email, User.id != user.id).first()
        if existing:
            return jsonify({'error': 'Ese correo ya pertenece a otra cuenta.'}), 400
        user.email = new_email
    if 'rol' in data and data['rol'] in ('admin', 'vendedor', 'cliente'):
        user.rol = data['rol']
    if 'telefono' in data:
        telefono, err_t = validate_ni_phone(data['telefono'], required=False, field_label='El teléfono')
        if err_t:
            return jsonify({'error': err_t}), 400
        user.telefono = telefono
    if 'direccion' in data:
        user.direccion = (data['direccion'] or '').strip() or None
    if 'activo' in data:
        user.activo = bool(data['activo'])
    if data.get('password'):
        if len(data['password']) < 6:
            return jsonify({'error': 'La nueva contraseña debe tener al menos 6 caracteres.'}), 400
        user.password_hash = generate_password_hash(data['password'])

    db.session.commit()
    return jsonify(user.to_dict())


@auth_bp.route('/usuarios/<int:user_id>', methods=['DELETE'])
@admin_required
def deactivate_user_admin(user_id):
    current_id = _extract_uid(get_jwt_identity())
    if current_id == user_id:
        return jsonify({'error': 'No puedes desactivar tu propia cuenta activa.'}), 400
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Usuario no encontrado.'}), 404
    user.activo = not user.activo
    db.session.commit()
    estado_txt = 'activado' if user.activo else 'desactivado'
    return jsonify({'message': f'Usuario {estado_txt} correctamente.', 'user': user.to_dict()})
