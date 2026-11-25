import re
import unicodedata
from datetime import datetime, date, timezone, timedelta
from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt, decode_token
from models import db, User, Client

NI_TZ = timezone(timedelta(hours=-6))

FULL_NAME_RE = re.compile(r'^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$')
PHONE_ALLOWED_CHARS_RE = re.compile(r'^\+?[\d\s\-()]+$')
NI_LOCAL_PHONE_RE = re.compile(r'^[2578]\d{7}$')


def validate_full_name(raw_value, required: bool = True, field_label: str = 'El nombre completo'):
    """Valida que el nombre completo contenga únicamente letras (incluyendo tildes/ñ) y espacios."""
    cleaned = ' '.join(str(raw_value or '').strip().split())
    if not cleaned:
        if required:
            return None, f'{field_label} es obligatorio.'
        return None, None
    if len(cleaned) < 2 or len(cleaned) > 100:
        return None, f'{field_label} debe tener entre 2 y 100 caracteres.'
    if not FULL_NAME_RE.match(cleaned):
        return None, f'{field_label} solo debe contener letras y espacios (sin números ni símbolos).'
    return cleaned, None


def validate_ni_phone(raw_value, required: bool = True, field_label: str = 'El número telefónico'):
    """Valida y normaliza números telefónicos de Nicaragua (+505 opcional + 8 dígitos iniciando en 2, 5, 7 u 8)."""
    raw = str(raw_value or '').strip()
    if not raw:
        if required:
            return None, f'{field_label} es obligatorio.'
        return None, None
    err_msg = f'{field_label} debe ser un número de Nicaragua válido (8 dígitos iniciando en 2, 5, 7 u 8, opcional +505).'
    if not PHONE_ALLOWED_CHARS_RE.match(raw):
        return None, err_msg
    digits = re.sub(r'\D', '', raw)
    if raw.startswith('+') and not digits.startswith('505'):
        return None, err_msg
    if len(digits) == 11 and digits.startswith('505'):
        local = digits[3:]
    elif len(digits) == 8:
        local = digits
    else:
        return None, err_msg
    if not NI_LOCAL_PHONE_RE.match(local):
        return None, err_msg
    return f'{local[:4]}-{local[4:]}', None


def now_ni() -> datetime:
    """Fecha y hora actual de Managua, Nicaragua (UTC-6) con tzinfo."""
    return datetime.now(NI_TZ)


def now_ni_naive() -> datetime:
    """Fecha y hora actual de Managua, Nicaragua (UTC-6) sin tzinfo para almacenamiento consistente."""
    return datetime.now(NI_TZ).replace(tzinfo=None)


def today_ni() -> date:
    """Fecha calendario local de Nicaragua (evita reinicio diario a las 6:00 PM)."""
    return datetime.now(NI_TZ).date()


def month_ni() -> str:
    """Mes calendario local de Nicaragua en formato YYYY-MM."""
    return datetime.now(NI_TZ).strftime('%Y-%m')


def strip_accents(value: str) -> str:
    if not value:
        return ''
    return ''.join(
        c for c in unicodedata.normalize('NFD', str(value))
        if unicodedata.category(c) != 'Mn'
    ).lower().strip()


def _extract_uid(identity):
    if isinstance(identity, dict):
        raw = identity.get('id')
    else:
        raw = identity
    try:
        return int(raw) if raw is not None else None
    except (TypeError, ValueError):
        return None


def get_current_user_obj():
    """Devuelve el objeto User autenticado si hay JWT criptográficamente válido, o None."""
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        uid = _extract_uid(identity)
        if not uid:
            return None
        user = db.session.get(User, uid)
        if user and user.activo:
            return user
        return None
    except Exception:
        return None


def get_staff_from_request_or_query():
    """Valida JWT de personal (admin o vendedor) por header Authorization o query ?token= (para SSE/PDF)."""
    user = get_current_user_obj()
    if user and user.rol in ('admin', 'vendedor'):
        return user

    raw_token = (request.args.get('token') or '').strip()
    if not raw_token:
        return None
    try:
        decoded = decode_token(raw_token)
        uid = _extract_uid(decoded.get('sub'))
        if not uid:
            return None
        user = db.session.get(User, uid)
        if user and user.activo and user.rol in ('admin', 'vendedor'):
            return user
    except Exception:
        return None
    return None


def is_staff_request() -> bool:
    """Indica si la solicitud proviene de un usuario autenticado con rol 'admin' o 'vendedor'."""
    user = get_current_user_obj()
    return bool(user and user.rol in ('admin', 'vendedor'))


def staff_required(fn):
    """Permite acceso únicamente a usuarios autenticados con rol 'admin' o 'vendedor'."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({'error': 'Debes iniciar sesión para realizar esta operación.'}), 401

        identity = get_jwt_identity()
        claims = get_jwt()
        uid = _extract_uid(identity)
        rol_claim = identity.get('rol') if isinstance(identity, dict) else claims.get('rol')

        user = db.session.get(User, uid) if uid else None
        if not user or not user.activo:
            return jsonify({'error': 'Sesión inválida o cuenta inactiva. Inicia sesión nuevamente.'}), 401
        rol_real = user.rol or rol_claim
        if rol_real not in ('admin', 'vendedor'):
            return jsonify({'error': 'Acceso restringido al personal autorizado de Shiny Skin.'}), 403
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    """Permite acceso únicamente a usuarios autenticados con rol 'admin'."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception:
            return jsonify({'error': 'Debes iniciar sesión como Administrador.'}), 401

        identity = get_jwt_identity()
        uid = _extract_uid(identity)
        user = db.session.get(User, uid) if uid else None
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
