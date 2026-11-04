import os
from flask import Flask, jsonify, request, send_from_directory
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
from routes.clients import clients_bp
from routes.expenses import expenses_bp


def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))
    app.url_map.strict_slashes = False

    # Inicializar extensiones
    db.init_app(app)
    CORS(app, origins='*')
    jwt = JWTManager(app)

    @jwt.unauthorized_loader
    def _unauth(reason):
        return jsonify({'error': 'Autenticación requerida.', 'detalle': reason}), 401

    @jwt.invalid_token_loader
    def _invalid_tok(reason):
        return jsonify({'error': 'Sesión inválida o expirada. Inicia sesión nuevamente.', 'detalle': reason}), 401

    # Registrar blueprints REST
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/productos')
    app.register_blueprint(orders_bp, url_prefix='/api/pedidos')
    app.register_blueprint(invoices_bp, url_prefix='/api/facturas')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventario')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(clients_bp, url_prefix='/api/clientes')
    app.register_blueprint(expenses_bp, url_prefix='/api/gastos')

    # Manejadores de errores amigables en JSON para rutas API (NFR-0010)
    @app.errorhandler(404)
    def handle_404(err):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'El recurso solicitado no fue encontrado.'}), 404
        return send_from_directory(frontend_dir, 'index.html')

    @app.errorhandler(413)
    def handle_413(err):
        return jsonify({'error': 'El archivo supera el tamaño máximo permitido (8 MB).'}), 413

    @app.errorhandler(500)
    def handle_500(err):
        db.session.rollback()
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Ocurrió un error interno al procesar la solicitud. Intenta nuevamente.'}), 500
        return 'Error interno del servidor', 500

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
        return jsonify({
            'status': 'ok',
            'sistema': 'SISCO - Shiny Skin',
            'version': '2.0.0',
            'modulos': ['auth', 'productos', 'inventario', 'pedidos', 'facturas', 'clientes', 'gastos', 'dashboard']
        })

    # Crear tablas, migrar columnas existentes y poblar catálogo inicial si está vacío
    with app.app_context():
        db.create_all()
        from migrate_db import run_migrations
        run_migrations()
        from seed import seed_db
        seed_db()

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=app.config.get('DEBUG', True), host='0.0.0.0', port=port)
