import os
from dotenv import load_dotenv

load_dotenv()


def _normalize_db_url(url: str) -> str:
    if not url:
        return ''
    # Compatibilidad con Render / Heroku (postgres:// -> postgresql://)
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    # Compatibilidad automática SQLAlchemy 2.0/2.1 y Python 3.11–3.14 (psycopg v3 o psycopg2)
    if url.startswith('postgresql://'):
        try:
            import psycopg  # noqa: F401
            return url.replace('postgresql://', 'postgresql+psycopg://', 1)
        except ImportError:
            try:
                import psycopg2  # noqa: F401
                return url.replace('postgresql://', 'postgresql+psycopg2://', 1)
            except ImportError:
                return url
    return url


_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_SQLITE_URI = f"sqlite:///{os.path.join(_BASE_DIR, 'sisco.db')}"
_RAW_DATABASE_URL = _normalize_db_url(os.getenv('DATABASE_URL', '').strip())
_RESOLVED_DB_URI = (
    _RAW_DATABASE_URL
    if _RAW_DATABASE_URL.startswith(('postgresql', 'sqlite://'))
    else _DEFAULT_SQLITE_URI
)


def _build_engine_options(db_uri: str) -> dict:
    if db_uri.startswith('postgresql'):
        return {
            'pool_pre_ping': True,
            'pool_recycle': 280,
        }
    return {
        'connect_args': {
            'timeout': 15,
            'check_same_thread': False,
        }
    }


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'sisco-shinyskin-app-secret-key-2026-managua-ni')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'sisco-shinyskin-jwt-secret-key-2026-managua-ni')
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')

    SQLALCHEMY_DATABASE_URI = _RESOLVED_DB_URI
    SQLALCHEMY_ENGINE_OPTIONS = _build_engine_options(_RESOLVED_DB_URI)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_ACCESS_TOKEN_EXPIRES = False  # Sesión persistente para operación continua en tienda
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # Máx 8 MB por imagen subida

    # Configuración comercial de Shiny Skin (Régimen Cuota Fija - Nicaragua)
    STORE_NAME = 'Shiny Skin'
    STORE_ADDRESS = 'Concept Store, Camino de Oriente, Managua, Nicaragua'
    STORE_PHONE = '+505 8888-0000'
    STORE_CURRENCY = 'C$'
    STORE_COUNTRY = 'Nicaragua'
    IVA_RATE = float(os.getenv('IVA_RATE', '0.0'))  # 0% adicional en régimen Cuota Fija (Ley 842)


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': ProductionConfig if os.getenv('RENDER') or os.getenv('FLASK_ENV') == 'production' else DevelopmentConfig
}
