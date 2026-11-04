import os
from dotenv import load_dotenv

load_dotenv()


def _normalize_db_url(url: str) -> str:
    if not url:
        return ''
    # Compatibilidad con Render (postgres:// -> postgresql:// para SQLAlchemy 2.x)
    if url.startswith('postgres://'):
        return url.replace('postgres://', 'postgresql://', 1)
    return url


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'sisco-shinyskin-secret-2026')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'sisco-jwt-secret-2026')

    RAW_DATABASE_URL = _normalize_db_url(os.getenv('DATABASE_URL', ''))

    SQLALCHEMY_DATABASE_URI = (
        RAW_DATABASE_URL
        if RAW_DATABASE_URL.startswith('postgresql://')
        else f"sqlite:///{os.path.join(os.path.dirname(__file__), 'sisco.db')}"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = False  # Sesión persistente para operación continua en tienda
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # Máx 8 MB por imagen subida

    # Configuración comercial de Shiny Skin (Régimen Cuota Fija - Nicaragua)
    STORE_NAME = 'Shiny Skin'
    STORE_ADDRESS = 'Concept Store, Camino de Oriente, Managua, Nicaragua'
    STORE_PHONE = '+505 8888-0000'
    STORE_CURRENCY = 'C$'
    STORE_COUNTRY = 'Nicaragua'
    IVA_RATE = float(os.getenv('IVA_RATE', '0.0'))  # 0% adicional en régimen Cuota Fija (precios finales según Ley 842)


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'sisco.db')}"


class ProductionConfig(Config):
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': ProductionConfig if os.getenv('RENDER') or os.getenv('FLASK_ENV') == 'production' else DevelopmentConfig
}
