from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    rol = db.Column(db.String(20), default='cliente')  # admin, vendedor, cliente
    telefono = db.Column(db.String(20))
    direccion = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True)
    ultimo_acceso = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    orders = db.relationship('Order', backref='usuario_cliente', lazy=True, foreign_keys='Order.user_id')

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'username': self.username,
            'email': self.email,
            'rol': self.rol,
            'telefono': self.telefono,
            'direccion': self.direccion,
            'activo': self.activo,
            'ultimo_acceso': self.ultimo_acceso.isoformat() if self.ultimo_acceso else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(120), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User')


class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    linea = db.Column(db.String(30), nullable=True)  # Skincare, Makeup
    descripcion = db.Column(db.Text)
    icono = db.Column(db.String(50))
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    subcategorias = db.relationship('Category', backref=db.backref('parent', remote_side=[id]))
    products = db.relationship('Product', backref='categoria', lazy=True)

    @property
    def linea_efectiva(self):
        if self.linea:
            return self.linea
        if self.parent:
            return self.parent.nombre
        return self.nombre

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'linea': self.linea_efectiva,
            'descripcion': self.descripcion,
            'icono': self.icono,
            'parent_id': self.parent_id
        }


class Brand(db.Model):
    __tablename__ = 'brands'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    pais_origen = db.Column(db.String(50))
    descripcion = db.Column(db.Text)
    products = db.relationship('Product', backref='marca', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'pais_origen': self.pais_origen,
            'descripcion': self.descripcion
        }


class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), nullable=False)
    sku = db.Column(db.String(50), unique=True, nullable=True)
    descripcion = db.Column(db.Text)
    beneficios = db.Column(db.Text)
    ingredientes = db.Column(db.Text)
    tamano = db.Column(db.String(50), nullable=True)  # Ej: 50 ml, 200 ml, 4 g
    tono = db.Column(db.String(60), nullable=True)    # Ej: 21 Natural Beige, Dusty Rose
    fecha_vencimiento = db.Column(db.String(20), nullable=True)  # YYYY-MM-DD
    precio_costo = db.Column(db.Float, nullable=False, default=0)
    porcentaje_ganancia = db.Column(db.Float, nullable=True, default=0)
    precio_venta = db.Column(db.Float, nullable=False, default=0)
    descuento = db.Column(db.Float, default=0)  # porcentaje 0-100
    stock = db.Column(db.Integer, default=0)
    stock_fisico = db.Column(db.Integer, default=0)  # Concept Store (Camino de Oriente)
    stock_online = db.Column(db.Integer, default=0)  # E-commerce y redes sociales
    stock_minimo = db.Column(db.Integer, default=5)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'))
    imagen_url = db.Column(db.String(500))
    imagen_url2 = db.Column(db.String(500))
    es_nuevo = db.Column(db.Boolean, default=False)
    es_destacado = db.Column(db.Boolean, default=False)
    activo = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    movements = db.relationship('InventoryMovement', backref='producto', lazy=True)

    def sync_stock(self):
        """Mantiene sincronizado el stock total con stock_fisico + stock_online."""
        fis = max(0, int(self.stock_fisico or 0))
        onl = max(0, int(self.stock_online or 0))
        self.stock_fisico = fis
        self.stock_online = onl
        self.stock = fis + onl

    @property
    def precio_final(self):
        desc = float(self.descuento or 0)
        venta = float(self.precio_venta or 0)
        if desc > 0:
            return round(venta * (1 - desc / 100), 2)
        return round(venta, 2)

    @property
    def stock_critico(self):
        return (self.stock or 0) <= (self.stock_minimo if self.stock_minimo is not None else 5)

    @property
    def linea_nombre(self):
        if not self.categoria:
            return None
        return self.categoria.linea_efectiva

    @property
    def dias_para_vencer(self):
        if not self.fecha_vencimiento:
            return None
        try:
            exp = datetime.strptime(self.fecha_vencimiento[:10], '%Y-%m-%d').date()
            return (exp - date.today()).days
        except Exception:
            return None

    def to_dict(self):
        dias_venc = self.dias_para_vencer
        return {
            'id': self.id,
            'nombre': self.nombre,
            'sku': self.sku,
            'descripcion': self.descripcion,
            'beneficios': self.beneficios,
            'ingredientes': self.ingredientes,
            'tamano': self.tamano,
            'tono': self.tono,
            'fecha_vencimiento': self.fecha_vencimiento,
            'dias_para_vencer': dias_venc,
            'por_vencer': dias_venc is not None and dias_venc <= 60,
            'precio_costo': round(float(self.precio_costo or 0), 2),
            'porcentaje_ganancia': round(float(self.porcentaje_ganancia or 0), 2),
            'precio_venta': round(float(self.precio_venta or 0), 2),
            'descuento': round(float(self.descuento or 0), 2),
            'precio_final': self.precio_final,
            'stock': self.stock or 0,
            'stock_fisico': self.stock_fisico if self.stock_fisico is not None else (self.stock or 0),
            'stock_online': self.stock_online if self.stock_online is not None else 0,
            'stock_minimo': self.stock_minimo if self.stock_minimo is not None else 5,
            'stock_critico': self.stock_critico,
            'category_id': self.category_id,
            'categoria': self.categoria.nombre if self.categoria else None,
            'linea': self.linea_nombre,
            'brand_id': self.brand_id,
            'marca': self.marca.nombre if self.marca else None,
            'pais_origen': self.marca.pais_origen if self.marca else None,
            'imagen_url': self.imagen_url,
            'imagen_url2': self.imagen_url2,
            'es_nuevo': bool(self.es_nuevo),
            'es_destacado': bool(self.es_destacado),
            'activo': bool(self.activo),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class InventoryMovement(db.Model):
    __tablename__ = 'inventory_movements'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    tipo = db.Column(db.String(20))  # entrada, salida, venta, anulacion, traslado, ajuste
    ubicacion = db.Column(db.String(20), default='online')  # fisico, online, ambos
    cantidad = db.Column(db.Integer, nullable=False)
    stock_anterior = db.Column(db.Integer)
    stock_nuevo = db.Column(db.Integer)
    motivo = db.Column(db.String(200))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    usuario = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'producto': self.producto.nombre if self.producto else None,
            'sku': self.producto.sku if self.producto else None,
            'tipo': self.tipo,
            'ubicacion': self.ubicacion or 'general',
            'cantidad': self.cantidad,
            'stock_anterior': self.stock_anterior,
            'stock_nuevo': self.stock_nuevo,
            'motivo': self.motivo,
            'usuario': self.usuario.nombre if self.usuario else 'Sistema',
            'fecha': self.fecha.isoformat() if self.fecha else None
        }


class Client(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    telefono = db.Column(db.String(25), nullable=True)
    email = db.Column(db.String(150), nullable=True)
    direccion = db.Column(db.Text, nullable=True)
    notas = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    orders = db.relationship('Order', backref='cliente_cartera', lazy=True)

    def to_dict(self, include_orders=False):
        ordenes_validas = [o for o in self.orders if o.estado != 'cancelado']
        data = {
            'id': self.id,
            'nombre': self.nombre,
            'telefono': self.telefono,
            'email': self.email,
            'direccion': self.direccion,
            'notas': self.notas,
            'cantidad_pedidos': len(ordenes_validas),
            'total_compras': round(sum(o.total or 0 for o in ordenes_validas), 2),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_orders:
            data['pedidos'] = [o.to_dict() for o in sorted(self.orders, key=lambda x: x.fecha or datetime.min, reverse=True)]
        return data


class Motorizado(db.Model):
    __tablename__ = 'motorizados'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    telefono = db.Column(db.String(25), nullable=False)
    empresa = db.Column(db.String(80), nullable=True)
    activo = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    orders = db.relationship('Order', backref='motorizado', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'telefono': self.telefono,
            'empresa': self.empresa or 'Independiente',
            'activo': bool(self.activo),
            'pedidos_asignados': len([o for o in self.orders if o.estado == 'en_camino'])
        }


class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    numero_pedido = db.Column(db.String(20), unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True)
    motorizado_id = db.Column(db.Integer, db.ForeignKey('motorizados.id'), nullable=True)
    nombre_cliente = db.Column(db.String(100))
    telefono_cliente = db.Column(db.String(20))
    email_cliente = db.Column(db.String(150))
    metodo_entrega = db.Column(db.String(20), default='domicilio')  # domicilio, retiro
    direccion_entrega = db.Column(db.Text)
    estado = db.Column(db.String(30), default='pendiente')
    # pendiente, confirmado, en_camino, entregado, cancelado
    subtotal = db.Column(db.Float, default=0)
    descuento = db.Column(db.Float, default=0)
    costo_envio = db.Column(db.Float, default=0)
    iva = db.Column(db.Float, default=0)
    total = db.Column(db.Float, default=0)
    metodo_pago = db.Column(db.String(50), default='efectivo_entrega')
    monto_pago_cliente = db.Column(db.Float, nullable=True)
    cambio_entregar = db.Column(db.Float, default=0)
    notas = db.Column(db.Text)
    canal = db.Column(db.String(30), default='web')  # web, whatsapp, instagram, tienda_fisica
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    fecha_entrega = db.Column(db.DateTime, nullable=True)
    items = db.relationship('OrderItem', backref='pedido', lazy=True, cascade='all, delete-orphan')
    invoice = db.relationship('Invoice', backref='pedido', lazy=True, uselist=False)
    historial = db.relationship('OrderStatusHistory', backref='pedido', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'numero_pedido': self.numero_pedido,
            'client_id': self.client_id,
            'motorizado_id': self.motorizado_id,
            'motorizado_nombre': self.motorizado.nombre if self.motorizado else None,
            'motorizado_telefono': self.motorizado.telefono if self.motorizado else None,
            'nombre_cliente': self.nombre_cliente,
            'telefono_cliente': self.telefono_cliente,
            'email_cliente': self.email_cliente,
            'metodo_entrega': self.metodo_entrega or 'domicilio',
            'direccion_entrega': self.direccion_entrega,
            'estado': self.estado,
            'subtotal': round(float(self.subtotal or 0), 2),
            'descuento': round(float(self.descuento or 0), 2),
            'costo_envio': round(float(self.costo_envio or 0), 2),
            'iva': round(float(self.iva or 0), 2),
            'total': round(float(self.total or 0), 2),
            'metodo_pago': self.metodo_pago,
            'monto_pago_cliente': round(float(self.monto_pago_cliente), 2) if self.monto_pago_cliente else None,
            'cambio_entregar': round(float(self.cambio_entregar or 0), 2),
            'notas': self.notas,
            'canal': self.canal,
            'factura_id': self.invoice.id if self.invoice else None,
            'numero_factura': self.invoice.numero_factura if self.invoice else None,
            'fecha': self.fecha.isoformat() if self.fecha else None,
            'fecha_entrega': self.fecha_entrega.isoformat() if self.fecha_entrega else None,
            'items': [item.to_dict() for item in self.items],
            'historial': [h.to_dict() for h in sorted(self.historial, key=lambda x: x.fecha or datetime.min)]
        }


class OrderItem(db.Model):
    __tablename__ = 'order_items'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'))
    nombre_producto = db.Column(db.String(200))
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)
    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'nombre_producto': self.nombre_producto,
            'sku': self.product.sku if self.product else None,
            'cantidad': self.cantidad,
            'precio_unitario': round(float(self.precio_unitario or 0), 2),
            'subtotal': round(float(self.subtotal or 0), 2)
        }


class OrderStatusHistory(db.Model):
    __tablename__ = 'order_status_history'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    estado_anterior = db.Column(db.String(30), nullable=True)
    estado_nuevo = db.Column(db.String(30), nullable=False)
    observacion = db.Column(db.String(200), nullable=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'estado_anterior': self.estado_anterior,
            'estado_nuevo': self.estado_nuevo,
            'observacion': self.observacion,
            'fecha': self.fecha.isoformat() if self.fecha else None
        }


class Invoice(db.Model):
    __tablename__ = 'invoices'
    id = db.Column(db.Integer, primary_key=True)
    numero_factura = db.Column(db.String(25), unique=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    nombre_cliente = db.Column(db.String(100))
    telefono_cliente = db.Column(db.String(25), nullable=True)
    email_cliente = db.Column(db.String(150))
    canal = db.Column(db.String(20), default='colectivo')  # colectivo, online
    tipo_descuento = db.Column(db.String(15), default='monto')  # monto, porcentaje
    subtotal = db.Column(db.Float, default=0)
    descuento = db.Column(db.Float, default=0)
    iva = db.Column(db.Float, default=0)
    total = db.Column(db.Float, default=0)
    metodo_pago = db.Column(db.String(30), default='efectivo')  # efectivo, transferencia, tarjeta
    monto_recibido = db.Column(db.Float, nullable=True)
    cambio = db.Column(db.Float, default=0)
    estado = db.Column(db.String(20), default='pagada')  # emitida, pagada, anulada
    motivo_anulacion = db.Column(db.String(200), nullable=True)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    notas = db.Column(db.Text)
    items = db.relationship('InvoiceItem', backref='factura', lazy=True, cascade='all, delete-orphan')
    emisor = db.relationship('User')

    def to_dict(self):
        # Si no tiene invoice_items propios pero viene de un pedido, mostrar los items del pedido
        rendered_items = [it.to_dict() for it in self.items]
        if not rendered_items and self.pedido:
            rendered_items = [it.to_dict() for it in self.pedido.items]
        return {
            'id': self.id,
            'numero_factura': self.numero_factura,
            'order_id': self.order_id,
            'numero_pedido': self.pedido.numero_pedido if self.pedido else None,
            'nombre_cliente': self.nombre_cliente or 'Consumidor Final',
            'telefono_cliente': self.telefono_cliente,
            'email_cliente': self.email_cliente,
            'canal': self.canal or 'colectivo',
            'tipo_descuento': self.tipo_descuento or 'monto',
            'subtotal': round(float(self.subtotal or 0), 2),
            'descuento': round(float(self.descuento or 0), 2),
            'iva': round(float(self.iva or 0), 2),
            'total': round(float(self.total or 0), 2),
            'metodo_pago': self.metodo_pago or 'efectivo',
            'monto_recibido': round(float(self.monto_recibido), 2) if self.monto_recibido is not None else None,
            'cambio': round(float(self.cambio or 0), 2),
            'estado': self.estado,
            'motivo_anulacion': self.motivo_anulacion,
            'notas': self.notas,
            'emisor': self.emisor.nombre if self.emisor else 'Caja Shiny Skin',
            'fecha': self.fecha.isoformat() if self.fecha else None,
            'items': rendered_items
        }


class InvoiceItem(db.Model):
    __tablename__ = 'invoice_items'
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)
    nombre_producto = db.Column(db.String(200), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False, default=1)
    precio_unitario = db.Column(db.Float, nullable=False, default=0)
    descuento = db.Column(db.Float, default=0)
    subtotal = db.Column(db.Float, nullable=False, default=0)
    product = db.relationship('Product')

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'nombre_producto': self.nombre_producto,
            'sku': self.product.sku if self.product else None,
            'cantidad': self.cantidad,
            'precio_unitario': round(float(self.precio_unitario or 0), 2),
            'descuento': round(float(self.descuento or 0), 2),
            'subtotal': round(float(self.subtotal or 0), 2)
        }


class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    categoria_gasto = db.Column(db.String(30), nullable=False, default='OTRO')
    # IMPORTACION, ENVIO, EMPAQUE, PUBLICIDAD, ALQUILER, OTRO
    concepto = db.Column(db.String(200), nullable=False)
    monto = db.Column(db.Float, nullable=False)
    fecha = db.Column(db.String(20), nullable=False)  # YYYY-MM-DD
    notas = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    usuario = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'categoria_gasto': self.categoria_gasto,
            'concepto': self.concepto,
            'monto': round(float(self.monto or 0), 2),
            'fecha': self.fecha,
            'notas': self.notas,
            'usuario': self.usuario.nombre if self.usuario else 'Administrador',
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
