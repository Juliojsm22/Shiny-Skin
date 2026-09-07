from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    rol = db.Column(db.String(20), default='cliente')  # admin, vendedor, cliente
    telefono = db.Column(db.String(20))
    direccion = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    orders = db.relationship('Order', backref='cliente', lazy=True)

    def to_dict(self):
        return {
            'id': self.id, 'nombre': self.nombre, 'email': self.email,
            'rol': self.rol, 'telefono': self.telefono, 'direccion': self.direccion,
            'activo': self.activo, 'created_at': self.created_at.isoformat()
        }


class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text)
    icono = db.Column(db.String(50))
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'), nullable=True)
    subcategorias = db.relationship('Category', backref=db.backref('parent', remote_side=[id]))
    products = db.relationship('Product', backref='categoria', lazy=True)

    def to_dict(self):
        return {
            'id': self.id, 'nombre': self.nombre, 'descripcion': self.descripcion,
            'icono': self.icono, 'parent_id': self.parent_id
        }


class Brand(db.Model):
    __tablename__ = 'brands'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    pais_origen = db.Column(db.String(50))
    descripcion = db.Column(db.Text)
    products = db.relationship('Product', backref='marca', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'nombre': self.nombre, 'pais_origen': self.pais_origen}


class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), nullable=False)
    sku = db.Column(db.String(50), unique=True)
    descripcion = db.Column(db.Text)
    beneficios = db.Column(db.Text)
    ingredientes = db.Column(db.Text)
    precio_costo = db.Column(db.Float, nullable=False, default=0)
    precio_venta = db.Column(db.Float, nullable=False)
    descuento = db.Column(db.Float, default=0)  # porcentaje 0-100
    stock = db.Column(db.Integer, default=0)
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

    @property
    def precio_final(self):
        if self.descuento > 0:
            return round(self.precio_venta * (1 - self.descuento / 100), 2)
        return self.precio_venta

    @property
    def stock_critico(self):
        return self.stock <= self.stock_minimo

    def to_dict(self):
        return {
            'id': self.id, 'nombre': self.nombre, 'sku': self.sku,
            'descripcion': self.descripcion, 'beneficios': self.beneficios,
            'precio_costo': self.precio_costo, 'precio_venta': self.precio_venta,
            'descuento': self.descuento, 'precio_final': self.precio_final,
            'stock': self.stock, 'stock_minimo': self.stock_minimo,
            'stock_critico': self.stock_critico,
            'category_id': self.category_id,
            'categoria': self.categoria.nombre if self.categoria else None,
            'brand_id': self.brand_id,
            'marca': self.marca.nombre if self.marca else None,
            'imagen_url': self.imagen_url, 'imagen_url2': self.imagen_url2,
            'es_nuevo': self.es_nuevo, 'es_destacado': self.es_destacado,
            'activo': self.activo, 'created_at': self.created_at.isoformat()
        }


class InventoryMovement(db.Model):
    __tablename__ = 'inventory_movements'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    tipo = db.Column(db.String(20))  # entrada, salida, ajuste
    cantidad = db.Column(db.Integer, nullable=False)
    stock_anterior = db.Column(db.Integer)
    stock_nuevo = db.Column(db.Integer)
    motivo = db.Column(db.String(200))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    fecha = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'product_id': self.product_id,
            'producto': self.producto.nombre if self.producto else None,
            'tipo': self.tipo, 'cantidad': self.cantidad,
            'stock_anterior': self.stock_anterior, 'stock_nuevo': self.stock_nuevo,
            'motivo': self.motivo, 'fecha': self.fecha.isoformat()
        }


class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    numero_pedido = db.Column(db.String(20), unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    nombre_cliente = db.Column(db.String(100))
    telefono_cliente = db.Column(db.String(20))
    email_cliente = db.Column(db.String(150))
    direccion_entrega = db.Column(db.Text)
    estado = db.Column(db.String(30), default='pendiente')  
    # pendiente, confirmado, en_camino, entregado, cancelado
    subtotal = db.Column(db.Float, default=0)
    descuento = db.Column(db.Float, default=0)
    iva = db.Column(db.Float, default=0)
    total = db.Column(db.Float, default=0)
    metodo_pago = db.Column(db.String(50), default='efectivo_entrega')
    notas = db.Column(db.Text)
    canal = db.Column(db.String(30), default='web')  # web, whatsapp, tienda_fisica
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship('OrderItem', backref='pedido', lazy=True, cascade='all, delete-orphan')
    invoice = db.relationship('Invoice', backref='pedido', lazy=True, uselist=False)

    def to_dict(self):
        return {
            'id': self.id, 'numero_pedido': self.numero_pedido,
            'nombre_cliente': self.nombre_cliente, 'telefono_cliente': self.telefono_cliente,
            'email_cliente': self.email_cliente, 'direccion_entrega': self.direccion_entrega,
            'estado': self.estado, 'subtotal': self.subtotal,
            'descuento': self.descuento, 'iva': self.iva, 'total': self.total,
            'metodo_pago': self.metodo_pago, 'notas': self.notas,
            'canal': self.canal, 'fecha': self.fecha.isoformat(),
            'items': [item.to_dict() for item in self.items]
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
            'id': self.id, 'product_id': self.product_id,
            'nombre_producto': self.nombre_producto,
            'cantidad': self.cantidad, 'precio_unitario': self.precio_unitario,
            'subtotal': self.subtotal
        }


class Invoice(db.Model):
    __tablename__ = 'invoices'
    id = db.Column(db.Integer, primary_key=True)
    numero_factura = db.Column(db.String(20), unique=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'))
    nombre_cliente = db.Column(db.String(100))
    email_cliente = db.Column(db.String(150))
    subtotal = db.Column(db.Float)
    descuento = db.Column(db.Float, default=0)
    iva = db.Column(db.Float, default=0)
    total = db.Column(db.Float)
    estado = db.Column(db.String(20), default='emitida')  # emitida, pagada, anulada
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    notas = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id, 'numero_factura': self.numero_factura,
            'order_id': self.order_id, 'nombre_cliente': self.nombre_cliente,
            'email_cliente': self.email_cliente, 'subtotal': self.subtotal,
            'descuento': self.descuento, 'iva': self.iva, 'total': self.total,
            'estado': self.estado, 'fecha': self.fecha.isoformat()
        }
