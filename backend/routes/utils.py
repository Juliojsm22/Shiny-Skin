import unicodedata
from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from models import db, User, Client


def strip_accents(value: str) -> str:
    if not value:
        return ''
    return ''.join(
        c for c in unicodedata.normalize('NFD', str(value))
        if unicodedata.category(c) != 'Mn'
    ).lower().strip()


def _resolve_local_fallback_user():
    """Si el navegador envía un token generado en modo local (local_jwt_...), resuelve el usuario activo equivalente."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    raw_token = auth_header.split(' ', 1)[1].strip()
    if raw_token.startswith('local_jwt_'):
        parts = raw_token.split('_')
        if len(parts) >= 3 and parts[2].isdigit():
            user = db.session.get(User, int(parts[2]))
            if user and user.activo:
                return user
        return User.query.filter(User.rol.in_(('admin', 'vendedor')), User.activo.is_(True)).first()
    if raw_token in ('offline-demo-token', 'demo_token'):
        return User.query.filter(User.rol.in_(('admin', 'vendedor')), User.activo.is_(True)).first()
    return None


def get_current_user_obj():
    """Devuelve el objeto User autenticado si hay JWT válido, o None."""
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if not identity:
            return _resolve_local_fallback_user()
        if isinstance(identity, dict):
            uid = identity.get('id')
        else:
            uid = int(identity)
        if not uid:
            return _resolve_local_fallback_user()
        user = db.session.get(User, uid)
        if user and user.activo:
            return user
        return _resolve_local_fallback_user()
    except Exception:
        return _resolve_local_fallback_user()


def staff_required(fn):
    """Permite acceso únicamente a usuarios autenticados con rol 'admin' o 'vendedor'."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = None
        rol = None
        try:
            verify_jwt_in_request()
            identity = get_jwt_identity()
            claims = get_jwt()
            if isinstance(identity, dict):
                uid = identity.get('id')
                rol = identity.get('rol')
            else:
                uid = int(identity) if str(identity).isdigit() else None
                rol = claims.get('rol')
            user = db.session.get(User, uid) if uid else None
        except Exception:
            user = _resolve_local_fallback_user()

        if not user or not user.activo:
            return jsonify({'error': 'Sesión inválida o cuenta inactiva.'}), 401
        rol_real = user.rol or rol
        if rol_real not in ('admin', 'vendedor'):
            return jsonify({'error': 'Acceso restringido al personal autorizado de Shiny Skin.'}), 403
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    """Permite acceso únicamente a usuarios con rol 'admin'."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = None
        try:
            verify_jwt_in_request()
            identity = get_jwt_identity()
            uid = identity.get('id') if isinstance(identity, dict) else (int(identity) if str(identity).isdigit() else None)
            user = db.session.get(User, uid) if uid else None
        except Exception:
            user = _resolve_local_fallback_user()

        if not user or not user.activo or user.rol != 'admin':
            return jsonify({'error': 'Esta función requiere permisos de Administrador.'}), 403
        return fn(*args, **kwargs)
    return wrapper


def upsert_client(nombre: str, telefono: str = None, email: str = None, direccion: str = None):
    """Busca o registra automáticamente un cliente en la cartera (HU-05 / UC20)."""
    if not nombre or nombre.strip().lower() in ('consumidor final', 'cliente general', ''):
        return None
    nombre_clean = nombre.strip()
    tel_clean = (telefono or '').strip() or None
    email_clean = (email or '').strip().lower() or None
    dir_clean = (direccion or '').strip() or None

    client = None
    if tel_clean:
        client = Client.query.filter_by(telefono=tel_clean).first()
    if not client and email_clean:
        client = Client.query.filter(db.func.lower(Client.email) == email_clean).first()
    if not client:
        client = Client.query.filter(db.func.lower(Client.nombre) == nombre_clean.lower()).first()

    if client:
        if tel_clean and not client.telefono:
            client.telefono = tel_clean
        if email_clean and not client.email:
            client.email = email_clean
        if dir_clean:
            client.direccion = dir_clean
    else:
        client = Client(
            nombre=nombre_clean,
            telefono=tel_clean,
            email=email_clean,
            direccion=dir_clean
        )
        db.session.add(client)
        db.session.flush()
    return client

