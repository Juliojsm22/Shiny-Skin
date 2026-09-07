import os
from werkzeug.utils import secure_filename
from flask import Blueprint, jsonify, request, current_app
from models import db, Product, Category, Brand, InventoryMovement

products_bp = Blueprint('products', __name__)

def save_image_file(file):
    if file and file.filename != '':
        filename = secure_filename(file.filename)
        # Directorio de uploads dentro de frontend (root/frontend/uploads)
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)
        return f"/uploads/{filename}"
    return None

@products_bp.route('/', methods=['GET'])
def get_products():
    categoria = request.args.get('categoria')
    marca = request.args.get('marca')
    busqueda = request.args.get('q')
    es_nuevo = request.args.get('nuevo')
    es_destacado = request.args.get('destacado')
    min_precio = request.args.get('min_precio', type=float)
    max_precio = request.args.get('max_precio', type=float)

    query = Product.query.filter_by(activo=True)

    if categoria:
        query = query.filter(Product.categoria == categoria) # Fallback to string if no relation setup
    if marca:
        query = query.filter(Product.marca == marca)
    if busqueda:
        query = query.filter(Product.nombre.ilike(f'%{busqueda}%'))
    if es_nuevo == 'true':
        query = query.filter(Product.es_nuevo == True)
    if es_destacado == 'true':
        query = query.filter(Product.es_destacado == True)
    if min_precio is not None:
        query = query.filter(Product.precio_venta >= min_precio)
    if max_precio is not None:
        query = query.filter(Product.precio_venta <= max_precio)

    products = query.order_by(Product.created_at.desc()).all()
    return jsonify([p.to_dict() for p in products])


@products_bp.route('/<int:id>', methods=['GET'])
def get_product(id):
    product = Product.query.get_or_404(id)
    return jsonify(product.to_dict())


@products_bp.route('/', methods=['POST'])
def create_product():
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        data = request.form.to_dict()
        file = request.files.get('imagen_file')
        imagen_url = save_image_file(file) or data.get('imagen_url')
    else:
        data = request.get_json()
        imagen_url = data.get('imagen_url')

    # Convertir valores a los tipos correctos para Form Data
    precio_venta = float(data['precio_venta']) if 'precio_venta' in data else 0
    precio_costo = float(data.get('precio_costo', 0))
    stock = int(data.get('stock', 0))
    
    cat = Category.query.filter_by(nombre=data.get('categoria')).first() if data.get('categoria') else None
    brand = Brand.query.filter_by(nombre=data.get('marca')).first() if data.get('marca') else None

    product = Product(
        nombre=data.get('nombre'), sku=data.get('sku'),
        descripcion=data.get('descripcion'), beneficios=data.get('beneficios'),
        ingredientes=data.get('ingredientes'),
        precio_costo=precio_costo,
        precio_venta=precio_venta,
        descuento=int(data.get('descuento', 0)),
        stock=stock,
        stock_minimo=int(data.get('stock_minimo', 5)),
        category_id=cat.id if cat else None,
        brand_id=brand.id if brand else None,
        imagen_url=imagen_url,
        es_nuevo=str(data.get('es_nuevo', '')).lower() == 'true',
        es_destacado=str(data.get('es_destacado', '')).lower() == 'true'
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:id>', methods=['PUT'])
def update_product(id):
    product = Product.query.get_or_404(id)
    
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        data = request.form.to_dict()
        file = request.files.get('imagen_file')
        if file:
            data['imagen_url'] = save_image_file(file)
        
        # Casting manual para FormData
        if 'precio_venta' in data: data['precio_venta'] = float(data['precio_venta'])
        if 'precio_costo' in data: data['precio_costo'] = float(data['precio_costo'])
        if 'stock' in data: data['stock'] = int(data['stock'])
        if 'stock_minimo' in data: data['stock_minimo'] = int(data['stock_minimo'])
        if 'descuento' in data: data['descuento'] = int(data['descuento'])
        if 'es_nuevo' in data: data['es_nuevo'] = str(data['es_nuevo']).lower() == 'true'
        if 'es_destacado' in data: data['es_destacado'] = str(data['es_destacado']).lower() == 'true'
        if 'activo' in data: data['activo'] = str(data['activo']).lower() == 'true'
    else:
        data = request.get_json()

    # Prevenir errores de asignación a relaciones y propiedades calculadas de SQLAlchemy
    cat_str = data.pop('categoria', None)
    marca_str = data.pop('marca', None)
    data.pop('precio_final', None)
    data.pop('stock_critico', None)
    
    if cat_str:
        cat = Category.query.filter_by(nombre=cat_str).first()
        if cat: data['category_id'] = cat.id
    if marca_str:
        brand = Brand.query.filter_by(nombre=marca_str).first()
        if brand: data['brand_id'] = brand.id

    for key, value in data.items():
        if hasattr(product, key):
            setattr(product, key, value)
            
    db.session.commit()
    return jsonify(product.to_dict())


@products_bp.route('/<int:id>', methods=['DELETE'])
def delete_product(id):
    product = Product.query.get_or_404(id)
    product.activo = False
    db.session.commit()
    return jsonify({'message': 'Producto desactivado'})


@products_bp.route('/categorias', methods=['GET'])
def get_categories():
    cats = Category.query.all()
    return jsonify([c.to_dict() for c in cats])


@products_bp.route('/marcas', methods=['GET'])
def get_brands():
    brands = Brand.query.all()
    return jsonify([b.to_dict() for b in brands])


@products_bp.route('/stock-critico', methods=['GET'])
def stock_critico():
    products = Product.query.filter(
        Product.activo == True,
        Product.stock <= Product.stock_minimo
    ).all()
    return jsonify([p.to_dict() for p in products])
