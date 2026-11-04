from sqlalchemy import inspect, text
from models import db, Product, Category, Brand, Client, Motorizado, Expense, Order, User


# URLs verificadas de cosméticos en Unsplash para reemplazar URLs rotas o inválidas
VERIFIED_COSMETIC_IMAGES = {
    'SKN-LMP-001': 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=600&q=80',
    'SKN-LMP-002': 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80',
    'SKN-SER-001': 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80',
    'SKN-SER-002': 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=600&q=80',
    'SKN-SER-003': 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=600&q=80',
    'SKN-HID-001': 'https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?auto=format&fit=crop&w=600&q=80',
    'SKN-HID-002': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80',
    'SKN-SOL-001': 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
    'SKN-SOL-002': 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=600&q=80',
    'SKN-MSK-001': 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80',
    'SKN-MSK-002': 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=600&q=80',
    'MKP-LAB-001': 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=600&q=80',
    'MKP-LAB-002': 'https://images.unsplash.com/photo-1631214524020-3c69b4eef11d?auto=format&fit=crop&w=600&q=80',
    'MKP-ROS-001': 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=600&q=80',
    'SKN-TON-001': 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=600&q=80',
}

PRODUCT_DEFAULTS = {
    'SKN-LMP-001': ('200 ml', None, '2027-08-15', 'Houttuynia Cordata Extract, Ethylhexyl Palmitate,aceite de jojoba'),
    'SKN-LMP-002': ('150 ml', None, '2027-06-30', 'Tea Tree Oil, BHA Betaine Salicylate 0.5%, Extractos botánicos'),
    'SKN-SER-001': ('30 ml', None, '2027-09-20', 'Houttuynia Cordata Extract 77%, Pantenol, Ácido Hialurónico'),
    'SKN-SER-002': ('30 ml', None, '2027-07-10', 'Niacinamida 5%, Vitamina C, Glutatión, Ácido Tranexámico'),
    'SKN-SER-003': ('100 ml', None, '2027-10-05', 'Snail Secretion Filtrate 96%, Sodium Hyaluronate, Allantoin'),
    'SKN-HID-001': ('50 ml', None, '2027-05-18', 'Colágeno de bajo peso molecular, PDRN, Ácido Hialurónico Oligo'),
    'SKN-HID-002': ('150 ml', None, '2027-11-12', 'Quercetinol, Houttuynia Cordata, Ácido Salicílico 0.5%'),
    'SKN-SOL-001': ('60 ml', None, '2027-04-25', 'Centella Asiatica, Filtros UV híbridos SPF50+ PA++++'),
    'SKN-SOL-002': ('50 ml', None, '2027-08-30', 'Centella Asiatica de Madagascar, Niacinamida, Óxido de Zinc'),
    'SKN-MSK-001': ('60 parches', None, '2027-06-14', 'PDRN Salmón, Colágeno Hidrolizado, Niacinamida, Péptidos'),
    'SKN-MSK-002': ('25 ml × 10', None, '2027-09-01', 'Houttuynia Cordata 70%, Centella Asiatica, Ceramida NP'),
    'MKP-LAB-001': ('5.5 g', '21 Grab Cherry', '2027-12-01', 'Extracto de frutas rojas, Escualano, Aceite de jojoba'),
    'MKP-LAB-002': ('3 g', 'Dusty Rose', '2027-11-20', 'Aceite de semilla de algodón, Vitamina E, Pigmentos minerales'),
    'MKP-ROS-001': ('15 g × 2', '21 Natural Beige', '2027-07-19', '10 tipos de Ácido Hialurónico, Ceramidas, Agua de flor de durazno'),
    'SKN-TON-001': ('170 ml', None, '2027-10-22', 'Té Verde de Jeju, 5 tipos de Ácido Hialurónico, Pantenol'),
}


def run_migrations():
    """Actualiza de forma segura tablas existentes y limpia inconsistencias previas."""
    inspector = inspect(db.engine)
    existing_tables = set(inspector.get_table_names())

    alter_map = {
        'users': [
            ('username', 'VARCHAR(50)'),
            ('ultimo_acceso', 'TIMESTAMP'),
        ],
        'categories': [
            ('linea', 'VARCHAR(30)'),
        ],
        'products': [
            ('tamano', 'VARCHAR(50)'),
            ('tono', 'VARCHAR(60)'),
            ('fecha_vencimiento', 'VARCHAR(20)'),
            ('porcentaje_ganancia', 'FLOAT DEFAULT 0'),
            ('stock_fisico', 'INTEGER DEFAULT 0'),
            ('stock_online', 'INTEGER DEFAULT 0'),
        ],
        'inventory_movements': [
            ('ubicacion', "VARCHAR(20) DEFAULT 'online'"),
        ],
        'orders': [
            ('client_id', 'INTEGER'),
            ('motorizado_id', 'INTEGER'),
            ('metodo_entrega', "VARCHAR(20) DEFAULT 'domicilio'"),
            ('costo_envio', 'FLOAT DEFAULT 0'),
            ('monto_pago_cliente', 'FLOAT'),
            ('cambio_entregar', 'FLOAT DEFAULT 0'),
            ('fecha_entrega', 'TIMESTAMP'),
        ],
        'invoices': [
            ('client_id', 'INTEGER'),
            ('user_id', 'INTEGER'),
            ('telefono_cliente', 'VARCHAR(25)'),
            ('canal', "VARCHAR(20) DEFAULT 'colectivo'"),
            ('tipo_descuento', "VARCHAR(15) DEFAULT 'monto'"),
            ('metodo_pago', "VARCHAR(30) DEFAULT 'efectivo'"),
            ('monto_recibido', 'FLOAT'),
            ('cambio', 'FLOAT DEFAULT 0'),
            ('motivo_anulacion', 'VARCHAR(200)'),
        ],
    }

    with db.engine.begin() as conn:
        for table_name, cols in alter_map.items():
            if table_name not in existing_tables:
                continue
            current_cols = {c['name'] for c in inspector.get_columns(table_name)}
            for col_name, col_type in cols:
                if col_name not in current_cols:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))

    # Poblar línea en categorías existentes
    skincare_cat = Category.query.filter_by(nombre='Skincare').first()
    makeup_cat = Category.query.filter_by(nombre='Makeup').first()
    for cat in Category.query.all():
        if not cat.linea:
            if cat.nombre in ('Skincare', 'Limpiadores', 'Sueros & Esencias', 'Hidratantes & Cremas', 'Protectores Solares', 'Mascarillas', 'Tónicos'):
                cat.linea = 'Skincare'
            elif cat.nombre in ('Makeup', 'Labios', 'Rostro', 'Cejas & Ojos'):
                cat.linea = 'Makeup'
            elif skincare_cat and cat.parent_id == skincare_cat.id:
                cat.linea = 'Skincare'
            elif makeup_cat and cat.parent_id == makeup_cat.id:
                cat.linea = 'Makeup'

    # Asignar usernames iniciales si faltan
    for u in User.query.all():
        if not u.username and u.email:
            base = u.email.split('@')[0].lower()
            u.username = base

    # Sincronizar stock dual, SKUs vacíos, imágenes rotas y metadatos de productos existentes
    maybelline = Brand.query.filter(Brand.nombre.ilike('maybelline')).first()
    if not maybelline:
        maybelline = Brand(nombre='Maybelline', pais_origen='Estados Unidos', descripcion='Maquillaje de larga duración')
        db.session.add(maybelline)
        db.session.flush()

    ordinary = Brand.query.filter(Brand.nombre.ilike('%ordinary%')).first()
    if not ordinary:
        ordinary = Brand(nombre='The Ordinary', pais_origen='Estados Unidos', descripcion='Fórmulas clínicas dermatológicas')
        db.session.add(ordinary)
        db.session.flush()

    rostro_cat = Category.query.filter_by(nombre='Rostro').first()
    serums_cat = Category.query.filter_by(nombre='Sueros & Esencias').first()

    for p in Product.query.all():
        # Normalizar SKU vacío
        if p.sku is not None and p.sku.strip() == '':
            p.sku = f'SS-PRD-{str(p.id).zfill(3)}'
        # Arreglar productos creados en pruebas previas con nombres/categorías/imágenes incompletas
        if p.nombre and p.nombre.strip().lower() == 'maybelline':
            if p.imagen_url and 'FIT_ME' in p.imagen_url.upper():
                p.nombre = 'Maybelline Fit Me Matte + Poreless Foundation'
                p.sku = 'MKP-ROS-002'
                p.brand_id = maybelline.id
                if rostro_cat:
                    p.category_id = rostro_cat.id
                p.tamano = p.tamano or '30 ml'
                p.tono = p.tono or '128 Warm Nude'
                p.beneficios = p.beneficios or 'Control de brillo · Minimiza poros · Acabado natural mate'
                p.descripcion = p.descripcion or 'Base líquida matificante importada de EE. UU. ideal para piel normal a grasa.'
                if not p.precio_costo or p.precio_costo == 0:
                    p.precio_costo = 310
            elif p.imagen_url and 'Highlighter' in p.imagen_url:
                p.nombre = 'Maybelline Master Chrome Metallic Highlighter'
                p.sku = 'MKP-ROS-003'
                p.brand_id = maybelline.id
                if rostro_cat:
                    p.category_id = rostro_cat.id
                p.tamano = p.tamano or '6.7 g'
                p.tono = p.tono or '100 Molten Gold'
                if not p.precio_venta or p.precio_venta == 0:
                    p.precio_costo = 260
                    p.precio_venta = 480

        if p.imagen_url and 'google.com/search' in p.imagen_url:
            p.imagen_url = 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80'
            p.brand_id = p.brand_id or ordinary.id
            if serums_cat and not p.category_id:
                p.category_id = serums_cat.id
            if p.precio_venta and p.precio_venta < 100:
                p.precio_costo = 310
                p.precio_venta = 550

        if p.sku in VERIFIED_COSMETIC_IMAGES:
            p.imagen_url = VERIFIED_COSMETIC_IMAGES[p.sku]

        if p.sku in PRODUCT_DEFAULTS:
            tam, tono, venc, ing = PRODUCT_DEFAULTS[p.sku]
            if not p.tamano:
                p.tamano = tam
            if not p.tono and tono:
                p.tono = tono
            if not p.fecha_vencimiento:
                p.fecha_vencimiento = venc
            if not p.ingredientes:
                p.ingredientes = ing

        # Inicializar stock_fisico y stock_online si ambos son 0 pero stock > 0
        total_st = int(p.stock or 0)
        fis_st = int(p.stock_fisico or 0)
        onl_st = int(p.stock_online or 0)
        if total_st > 0 and (fis_st + onl_st) == 0:
            p.stock_fisico = total_st // 2
            p.stock_online = total_st - p.stock_fisico
        else:
            p.sync_stock()

        if p.precio_costo and p.precio_costo > 0 and (not p.porcentaje_ganancia or p.porcentaje_ganancia == 0):
            p.porcentaje_ganancia = round(((p.precio_venta - p.precio_costo) / p.precio_costo) * 100, 1)

    # Poblar motorizados iniciales si no existen
    if Motorizado.query.count() == 0:
        db.session.add_all([
            Motorizado(nombre='Carlos Mendoza', telefono='505-8812-3456', empresa='Mandaditos Express Managua', activo=True),
            Motorizado(nombre='Luis Hernández', telefono='505-8745-9012', empresa='Delivery Rápido NI', activo=True),
            Motorizado(nombre='Javier Rivas', telefono='505-8633-7890', empresa='CargoTrans Departamental', activo=True),
        ])

    # Sincronizar cartera de clientes a partir de pedidos existentes si está vacía
    if Client.query.count() == 0:
        seen = {}
        for o in Order.query.all():
            if not o.nombre_cliente:
                continue
            key = (o.telefono_cliente or o.email_cliente or o.nombre_cliente).strip().lower()
            if key not in seen:
                cl = Client(
                    nombre=o.nombre_cliente,
                    telefono=o.telefono_cliente,
                    email=o.email_cliente,
                    direccion=o.direccion_entrega
                )
                db.session.add(cl)
                db.session.flush()
                seen[key] = cl
            o.client_id = seen[key].id

    # Poblar gastos iniciales de demostración si no existen
    if Expense.query.count() == 0:
        admin_user = User.query.filter_by(rol='admin').first()
        uid = admin_user.id if admin_user else None
        db.session.add_all([
            Expense(categoria_gasto='ALQUILER', concepto='Cuota mensual módulo Concept Store Camino de Oriente', monto=5500.00, fecha='2026-10-01', user_id=uid),
            Expense(categoria_gasto='IMPORTACION', concepto='Flete aéreo consolidado Seúl - Miami - Managua (Lote K-Beauty)', monto=4200.00, fecha='2026-10-12', user_id=uid),
            Expense(categoria_gasto='EMPAQUE', concepto='Bolsas kraft, stickers holográficos y papel seda Shiny Skin', monto=850.00, fecha='2026-10-18', user_id=uid),
            Expense(categoria_gasto='PUBLICIDAD', concepto='Pauta promocional Instagram & Facebook Ads Nicaragua', monto=1100.00, fecha='2026-10-25', user_id=uid),
            Expense(categoria_gasto='ENVIO', concepto='Subsidio envíos motorizados promocionales en Managua', monto=640.00, fecha='2026-11-01', user_id=uid),
        ])

    db.session.commit()

