import os
import socket
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from sqlalchemy import event
from models import db
from config import config
from events import order_event_bus

from routes.products import products_bp
from routes.orders import orders_bp
from routes.invoices import invoices_bp
from routes.inventory import inventory_bp
from routes.auth import auth_bp
from routes.dashboard import dashboard_bp
from routes.clients import clients_bp
from routes.expenses import expenses_bp
from routes.promotions import promotions_bp
from routes.utils import now_ni


def _get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config.get(config_name, config['default']))
    app.url_map.strict_slashes = False

    frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend')

    # Inicializar extensiones
    db.init_app(app)
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config.get('CORS_ORIGINS', '*')}},
        allow_headers=['Content-Type', 'Authorization', 'Cache-Control'],
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    )
    jwt = JWTManager(app)

    @jwt.unauthorized_loader
    def _unauth(reason):
        return jsonify({'error': 'Autenticación requerida.', 'detalle': reason}), 401

    @jwt.invalid_token_loader
    def _invalid_tok(reason):
        return jsonify({'error': 'Sesión inválida o expirada. Inicia sesión nuevamente.', 'detalle': reason}), 401

    @jwt.expired_token_loader
    def _expired_tok(jwt_header, jwt_payload):
        return jsonify({'error': 'Tu sesión ha expirado. Inicia sesión nuevamente.'}), 401

    # Registrar blueprints REST
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(products_bp, url_prefix='/api/productos')
    app.register_blueprint(orders_bp, url_prefix='/api/pedidos')
    app.register_blueprint(invoices_bp, url_prefix='/api/facturas')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventario')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(clients_bp, url_prefix='/api/clientes')
    app.register_blueprint(expenses_bp, url_prefix='/api/gastos')
    app.register_blueprint(promotions_bp, url_prefix='/api/promocion')

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

    # Health check con estado de base de datos y tiempo real
    @app.route('/api/health')
    def health():
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        db_engine = 'postgresql' if db_uri.startswith('postgresql') else 'sqlite'
        return jsonify({
            'status': 'ok',
            'mode': 'server',
            'sistema': 'SISCO - Shiny Skin',
            'version': '2.1.0',
            'database': db_engine,
            'realtime_sse': True,
            'sse_clients': order_event_bus.subscriber_count,
            'server_time': now_ni().isoformat(),
            'modulos': ['auth', 'productos', 'inventario', 'pedidos', 'facturas', 'clientes', 'gastos', 'dashboard', 'promocion']
        })

    # Servir archivos del frontend (tienda pública + panel admin)
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path.startswith('api/'):
            return jsonify({'error': 'Endpoint de API no encontrado.'}), 404
        clean_path = path.strip('/')
        if clean_path == 'admin':
            return send_from_directory(os.path.join(frontend_dir, 'admin'), 'dashboard.html')
        if clean_path:
            candidate = os.path.join(frontend_dir, clean_path)
            if os.path.isfile(candidate):
                return send_from_directory(frontend_dir, clean_path)
        return send_from_directory(frontend_dir, 'index.html')

    # Optimizar SQLite para concurrencia multi-dispositivo (WAL + busy_timeout + FK)
    with app.app_context():
        if app.config.get('SQLALCHEMY_DATABASE_URI', '').startswith('sqlite:'):
            @event.listens_for(db.engine, 'connect')
            def _set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                try:
                    cursor.execute('PRAGMA journal_mode=WAL')
                    cursor.execute('PRAGMA synchronous=NORMAL')
                    cursor.execute('PRAGMA busy_timeout=15000')
                    cursor.execute('PRAGMA foreign_keys=ON')
                finally:
                    cursor.close()

        db.create_all()
        from migrate_db import run_schema_migrations, run_data_migrations
        run_schema_migrations()
        from seed import seed_db
        seed_db()
        run_data_migrations()

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    lan_ip = _get_lan_ip()
    print('=' * 64)
    print('  SISCO - Shiny Skin | Servidor Omnicanal en Vivo (v2.1)')
    print(f'  Local (esta PC):        http://localhost:{port}')
    print(f'  Otros dispositivos LAN: http://{lan_ip}:{port}')
    print(f'  Panel Administrativo:   http://localhost:{port}/admin/dashboard.html')
    print('=' * 64)
    app.run(debug=app.config.get('DEBUG', True), host='0.0.0.0', port=port, threaded=True)
