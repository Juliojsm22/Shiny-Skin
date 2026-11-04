import os
import uuid
from werkzeug.utils import secure_filename
from flask import Blueprint, jsonify, request
from models import db, Product, Category, Brand, InventoryMovement
from routes.utils import strip_accents, staff_required, admin_required, get_current_user_obj

products_bp = Blueprint('products', __name__)

ALLOWED_IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}

CATEGORY_ALIASES = {
    'skincare': 'skincare',
    'makeup': 'makeup',
    'maquillaje': 'makeup',
    'serums': 'sueros',
    'sueros': 'sueros',
    'protectores': 'protectores',
    'solares': 'protectores',
    'limpiadores': 'limpiadores',
    'hidratantes': 'hidratantes',
    'mascarillas': 'mascarillas',
    'tonicos': 'tonicos',
    'labios': 'labios',
    'rostro': 'rostro',
    'ojos': 'ojos',
}


def save_image_file(file):
    if file and file.filename:
        orig_name = secure_filename(file.filename)
        ext = os.path.splitext(orig_name)[1].lower()
        if ext and ext not in ALLOWED_IMAGE_EXT:
            return None
        unique_name = f"{os.path.splitext(orig_name)[0]}_{uuid.uuid4().hex[:6]}{ext or '.jpg'}"
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, unique_name)
        file.save(file_path)
        return f"/uploads/{unique_name}"
    return None


def _resolve_category(cat_name: str):
    if not cat_name:
        return None
    norm = strip_accents(cat_name)
    for c in Category.query.all():
        if strip_accents(c.nombre) == norm:
            return c
    # Si no existe, crearla bajo Skincare o Makeup según nombre
    linea = 'Makeup' if any(w in norm for w in ('labio', 'rostro', 'ojo', 'makeup', 'maquillaje', 'base', 'rubor')) else 'Skincare'
    new_cat = Category(nombre=cat_name.strip(), linea=linea)
    db.session.add(new_cat)
    db.session.flush()
    return new_cat


def _resolve_brand(brand_name: str, pais_origen: str = None):
    if not brand_name or not brand_name.strip():
        return None
    norm = strip_accents(brand_name)
    for b in Brand.query.all():
        if strip_accents(b.nombre) == norm:
            return b
    new_brand = Brand(nombre=brand_name.strip(), pais_origen=pais_origen or 'Importado')
    db.session.add(new_brand)
    db.session.flush()
    return new_brand


def _parse_bool(val, default=False):
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ('true', '1', 'yes', 'on', 'si', 'sí')


def _generate_unique_sku(nombre: str = '') -> str:
    prefix = 'SKN'
    norm = strip_accents(nombre)
    if any(k in norm for k in ('tint', 'lipstick', 'labial', 'cushion', 'foundation', 'base', 'highlighter', 'blush')):
        prefix = 'MKP'
    idx = Product.query.count() + 1
    while True:
        candidate = f'{prefix}-{str(idx).zfill(4)}'
        if not Product.query.filter_by(sku=candidate).first():
            return candidate
        idx += 1


@products_bp.route('/', methods=['GET'])
def get_products():
    categoria = request.args.get('categoria')
    marca = request.args.get('marca')
    busqueda = request.args.get('q')
    es_nuevo = request.args.get('nuevo')
    es_destacado = request.args.get('destacado')
    incluir_inactivos = request.args.get('incluir_inactivos') == 'true'
    min_precio = request.args.get('min_precio', type=float)
    max_precio = request.args.get('max_precio', type=float)

    query = Product.query
    if not incluir_inactivos:
        query = query.filter_by(activo=True)

    if es_nuevo == 'true':
        query = query.filter(Product.es_nuevo.is_(True))
    if es_destacado == 'true':
        query = query.filter(Product.es_destacado.is_(True))

    products = query.order_by(Product.created_at.desc(), Product.id.desc()).all()

    # Filtrado flexible por categoría/subcategoría/línea, marca, búsqueda y precio final
    result = []
    cat_norm = CATEGORY_ALIASES.get(strip_accents(categoria), strip_accents(categoria)) if categoria else ''
    marca_norm = strip_accents(marca) if marca else ''
    q_norm = strip_accents(busqueda) if busqueda else ''

    for p in products:
        p_dict = p.to_dict()
        if cat_norm and cat_norm != 'all':
            p_cat = strip_accents(p_dict.get('categoria') or '')
            p_linea = strip_accents(p_dict.get('linea') or '')
            if cat_norm not in p_cat and cat_norm != p_linea:
                continue
        if marca_norm:
            if strip_accents(p_dict.get('marca') or '') != marca_norm:
                continue
        if q_norm:
            searchable = ' '.join([
                strip_accents(p.nombre or ''),
                strip_accents(p.sku or ''),
                strip_accents(p_dict.get('marca') or ''),
                strip_accents(p_dict.get('categoria') or ''),
                strip_accents(p.beneficios or ''),
                strip_accents(p.ingredientes or ''),
                strip_accents(p.tono or ''),
            ])
            if q_norm not in searchable:
                continue
        if min_precio is not None and p.precio_final < min_precio:
            continue
        if max_precio is not None and p.precio_final > max_precio:
            continue
        result.append(p_dict)

    return jsonify(result)


@products_bp.route('/<int:id>', methods=['GET'])
def get_product(id):
    product = Product.query.get_or_404(id)
    return jsonify(product.to_dict())


@products_bp.route('/', methods=['POST'])
@staff_required
def create_product():
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        data = request.form.to_dict()
        file = request.files.get('imagen_file') or request.files.get('imagen')
        uploaded_url = save_image_file(file)
        imagen_url = uploaded_url or (data.get('imagen_url') or '').strip() or None
    else:
        data = request.get_json(silent=True) or {}
        imagen_url = (data.get('imagen_url') or '').strip() or None

    nombre = (data.get('nombre') or '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre del producto es obligatorio.'}), 400

    try:
        precio_venta = float(data.get('precio_venta') or 0)
        precio_costo = float(data.get('precio_costo') or 0)
        descuento = float(data.get('descuento') or 0)
        stock_minimo = int(float(data.get('stock_minimo') or 5))
    except ValueError:
        return jsonify({'error': 'Verifica que los precios, descuento y stock sean valores numéricos válidos.'}), 400

    if precio_venta < 0 or precio_costo < 0 or not (0 <= descuento <= 100):
        return jsonify({'error': 'Los precios deben ser positivos y el descuento entre 0% y 100%.'}), 400

    # Manejo de stock dual (físico + online) o stock único
    if 'stock_fisico' in data or 'stock_online' in data:
        stock_fisico = max(0, int(float(data.get('stock_fisico') or 0)))
        stock_online = max(0, int(float(data.get('stock_online') or 0)))
    else:
        total_init = max(0, int(float(data.get('stock') or 0)))
        stock_fisico = total_init // 2
        stock_online = total_init - stock_fisico

    raw_sku = (data.get('sku') or '').strip()
    if raw_sku:
        if Product.query.filter(db.func.lower(Product.sku) == raw_sku.lower()).first():
            return jsonify({'error': f'El código SKU "{raw_sku}" ya está asignado a otro producto.'}), 400
        sku = raw_sku
    else:
        sku = _generate_unique_sku(nombre)

    porcentaje_ganancia = float(data.get('porcentaje_ganancia') or 0)
    if porcentaje_ganancia == 0 and precio_costo > 0 and precio_venta > 0:
        porcentaje_ganancia = round(((precio_venta - precio_costo) / precio_costo) * 100, 2)

    cat = _resolve_category(data.get('categoria') or data.get('categoria_nombre'))
    brand = _resolve_brand(data.get('marca') or data.get('marca_nombre'), data.get('pais_origen'))

    product = Product(
        nombre=nombre,
        sku=sku,
        descripcion=(data.get('descripcion') or '').strip() or None,
        beneficios=(data.get('beneficios') or '').strip() or None,
        ingredientes=(data.get('ingredientes') or '').strip() or None,
        tamano=(data.get('tamano') or '').strip() or None,
        tono=(data.get('tono') or '').strip() or None,
        fecha_vencimiento=(data.get('fecha_vencimiento') or '').strip() or None,
        precio_costo=precio_costo,
        porcentaje_ganancia=porcentaje_ganancia,
        precio_venta=precio_venta,
        descuento=descuento,
        stock_fisico=stock_fisico,
        stock_online=stock_online,
        stock=stock_fisico + stock_online,
        stock_minimo=stock_minimo,
        category_id=cat.id if cat else None,
        brand_id=brand.id if brand else None,
        imagen_url=imagen_url,
        imagen_url2=(data.get('imagen_url2') or '').strip() or None,
        es_nuevo=_parse_bool(data.get('es_nuevo'), False),
        es_destacado=_parse_bool(data.get('es_destacado'), False),
        activo=_parse_bool(data.get('activo'), True)
    )
    db.session.add(product)
    db.session.flush()

    user = get_current_user_obj()
    if product.stock > 0:
        db.session.add(InventoryMovement(
            product_id=product.id,
            tipo='entrada',
            ubicacion='ambos',
            cantidad=product.stock,
            stock_anterior=0,
            stock_nuevo=product.stock,
            motivo=f'Inventario inicial al registrar producto (Físico: {stock_fisico}, Online: {stock_online})',
            user_id=user.id if user else None
        ))

    db.session.commit()
    return jsonify(product.to_dict()), 201


@products_bp.route('/<int:id>', methods=['PUT'])
@staff_required
def update_product(id):
    product = Product.query.get_or_404(id)

    if request.content_type and request.content_type.startswith('multipart/form-data'):
        data = request.form.to_dict()
        file = request.files.get('imagen_file') or request.files.get('imagen')
        if file and file.filename:
            uploaded = save_image_file(file)
            if uploaded:
                data['imagen_url'] = uploaded
    else:
        data = request.get_json(silent=True) or {}

    if 'sku' in data:
        raw_sku = (data.get('sku') or '').strip()
        if raw_sku:
            dup = Product.query.filter(db.func.lower(Product.sku) == raw_sku.lower(), Product.id != product.id).first()
            if dup:
                return jsonify({'error': f'El código SKU "{raw_sku}" ya pertenece a otro producto.'}), 400
            product.sku = raw_sku
        elif not product.sku:
            product.sku = _generate_unique_sku(data.get('nombre') or product.nombre)

    if 'nombre' in data and (data['nombre'] or '').strip():
        product.nombre = data['nombre'].strip()
    for str_field in ('descripcion', 'beneficios', 'ingredientes', 'tamano', 'tono', 'fecha_vencimiento', 'imagen_url', 'imagen_url2'):
        if str_field in data:
            val = (data.get(str_field) or '').strip()
            if str_field == 'imagen_url' and not val and product.imagen_url:
                continue  # No borrar imagen actual si no se envió una nueva
            setattr(product, str_field, val or None)

    for num_field in ('precio_costo', 'precio_venta', 'descuento', 'porcentaje_ganancia'):
        if num_field in data and data[num_field] != '':
            setattr(product, num_field, float(data[num_field]))

    if 'stock_minimo' in data and data['stock_minimo'] != '':
        product.stock_minimo = max(0, int(float(data['stock_minimo'])))

    stock_prev = product.stock or 0
    if 'stock_fisico' in data or 'stock_online' in data:
        if 'stock_fisico' in data and data['stock_fisico'] != '':
            product.stock_fisico = max(0, int(float(data['stock_fisico'])))
        if 'stock_online' in data and data['stock_online'] != '':
            product.stock_online = max(0, int(float(data['stock_online'])))
        product.sync_stock()
    elif 'stock' in data and data['stock'] != '':
        new_total = max(0, int(float(data['stock'])))
        if new_total != stock_prev:
            diff = new_total - stock_prev
            product.stock_online = max(0, (product.stock_online or 0) + diff)
            if (product.stock_fisico or 0) + product.stock_online != new_total:
                product.stock_fisico = max(0, new_total - product.stock_online)
            product.sync_stock()

    if (product.stock or 0) != stock_prev:
        user = get_current_user_obj()
        db.session.add(InventoryMovement(
            product_id=product.id,
            tipo='ajuste',
            ubicacion='ambos',
            cantidad=abs((product.stock or 0) - stock_prev),
            stock_anterior=stock_prev,
            stock_nuevo=product.stock,
            motivo='Actualización desde ficha de producto',
            user_id=user.id if user else None
        ))

    if 'es_nuevo' in data:
        product.es_nuevo = _parse_bool(data['es_nuevo'])
    if 'es_destacado' in data:
        product.es_destacado = _parse_bool(data['es_destacado'])
    if 'activo' in data:
        product.activo = _parse_bool(data['activo'])

    cat_val = data.get('categoria') or data.get('categoria_nombre')
    if cat_val:
        cat = _resolve_category(cat_val)
        if cat:
            product.category_id = cat.id
    marca_val = data.get('marca') or data.get('marca_nombre')
    if marca_val and marca_val.strip():
        brand = _resolve_brand(marca_val, data.get('pais_origen'))
        if brand:
            product.brand_id = brand.id

    if product.precio_costo > 0 and product.precio_venta > 0:
        product.porcentaje_ganancia = round(((product.precio_venta - product.precio_costo) / product.precio_costo) * 100, 2)

    db.session.commit()
    return jsonify(product.to_dict())


@products_bp.route('/<int:id>', methods=['DELETE'])
@admin_required
def delete_product(id):
    product = Product.query.get_or_404(id)
    product.activo = False
    db.session.commit()
    return jsonify({'message': 'Producto dado de baja del catálogo público.', 'product': product.to_dict()})


@products_bp.route('/categorias', methods=['GET'])
def get_categories():
    cats = Category.query.order_by(Category.id.asc()).all()
    return jsonify([c.to_dict() for c in cats])


@products_bp.route('/marcas', methods=['GET'])
def get_brands():
    brands = Brand.query.order_by(Brand.nombre.asc()).all()
    return jsonify([b.to_dict() for b in brands])


@products_bp.route('/stock-critico', methods=['GET'])
def stock_critico():
    products = Product.query.filter(
        Product.activo.is_(True),
        Product.stock <= Product.stock_minimo
    ).order_by(Product.stock.asc()).all()
    return jsonify([p.to_dict() for p in products])
