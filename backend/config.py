import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'sisco-shinyskin-secret-2024')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'sisco-jwt-secret-2024')
    
    # PostgreSQL en Render
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/sisco_shinyskin')
    
    # SQLite para desarrollo local sin PostgreSQL
    SQLALCHEMY_DATABASE_URI = DATABASE_URL if DATABASE_URL.startswith('postgresql') else \
        f"sqlite:///{os.path.join(os.path.dirname(__file__), 'sisco.db')}"
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = False  # Sin expiración para demo
    
    # Config tienda
    STORE_NAME = 'Shiny Skin'
    STORE_CURRENCY = 'C$'
    STORE_COUNTRY = 'Nicaragua'
    IVA_RATE = 0.15  # 15% IVA Nicaragua


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'sisco.db')}"


class ProductionConfig(Config):
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
