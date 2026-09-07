import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from models import db
from config import config

from routes.products import products_bp
from routes.orders import orders_bp
from routes.invoices import invoices_bp
from routes.inventory import inventory_bp
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp


def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Inicializar extensiones
    db.init_app(app)
    CORS(app, origins='*')
    JWTManager(app)

    # Registrar blueprints
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/productos')
    app.register_blueprint(orders_bp, url_prefix='/api/pedidos')
    app.register_blueprint(invoices_bp, url_prefix='/api/facturas')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventario')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')

    # Servir archivos del frontend
    frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend')

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path and os.path.exists(os.path.join(frontend_dir, path)):
            return send_from_directory(frontend_dir, path)
        return send_from_directory(frontend_dir, 'index.html')

    # Health check
    @app.route('/api/health')
    def health():
        return {'status': 'ok', 'sistema': 'SISCO - Shiny Skin', 'version': '1.0.0'}

    # Crear tablas y ejecutar seed
    with app.app_context():
        db.create_all()
        from seed import seed_db
        seed_db()

    return app


if __name__ == '__main__':
    app = create_app('development')
    app.run(debug=True, port=5000)
