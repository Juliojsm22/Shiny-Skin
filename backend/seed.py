from models import db, User, Category, Brand, Product, Order, OrderItem, Invoice, InventoryMovement
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import random


def seed_db():
    """Poblar la base de datos con datos de prueba K-beauty / Skincare"""

    # Solo ejecutar si no hay datos
    if User.query.first():
        return

    print("[SEED] Iniciando seed de SISCO - Shiny Skin...")

    # --- USUARIOS ---
    admin = User(nombre='Administrador Shiny Skin', email='admin@shinyskin.com',
                 password_hash=generate_password_hash('admin123'), rol='admin', telefono='505-8888-0001')
    vendedor = User(nombre='Vendedora Principal', email='vendedor@shinyskin.com',
                    password_hash=generate_password_hash('vendedor123'), rol='vendedor', telefono='505-8888-0002')
    cliente1 = User(nombre='María González', email='maria@gmail.com',
                    password_hash=generate_password_hash('cliente123'), rol='cliente', telefono='505-8777-1234',
                    direccion='Managua, Reparto San Juan')
    cliente2 = User(nombre='Andrea López', email='andrea@gmail.com',
                    password_hash=generate_password_hash('cliente123'), rol='cliente', telefono='505-8777-5678')
    db.session.add_all([admin, vendedor, cliente1, cliente2])
    db.session.flush()

    # --- CATEGORÍAS ---
    skincare = Category(nombre='Skincare', descripcion='Rutina de cuidado de la piel', icono='✨')
    makeup = Category(nombre='Makeup', descripcion='Maquillaje y color', icono='💄')
    db.session.add_all([skincare, makeup])
    db.session.flush()

    limpiadores = Category(nombre='Limpiadores', descripcion='Limpieza facial y doble limpieza', parent_id=skincare.id)
    serums = Category(nombre='Sueros & Esencias', descripcion='Tratamientos concentrados', parent_id=skincare.id)
    hidratantes = Category(nombre='Hidratantes & Cremas', descripcion='Cremas faciales', parent_id=skincare.id)
    protectores = Category(nombre='Protectores Solares', descripcion='SPF y pantallas solares', parent_id=skincare.id)
    mascarillas = Category(nombre='Mascarillas', descripcion='Sheet masks y mascarillas de arcilla', parent_id=skincare.id)
    tonicos = Category(nombre='Tónicos', descripcion='Tónicos y aguas esenciales', parent_id=skincare.id)
    labios = Category(nombre='Labios', descripcion='Tintas, bálsamos y lápices labiales', parent_id=makeup.id)
    rostro_mk = Category(nombre='Rostro', descripcion='Bases, cushions y correctores', parent_id=makeup.id)
    ojos = Category(nombre='Cejas & Ojos', descripcion='Delineadores y máscaras', parent_id=makeup.id)
    db.session.add_all([limpiadores, serums, hidratantes, protectores, mascarillas, tonicos, labios, rostro_mk, ojos])
    db.session.flush()

    # --- MARCAS ---
    anua = Brand(nombre='ANUA', pais_origen='Corea del Sur', descripcion='K-beauty minimalista')
    cosrx = Brand(nombre='COSRX', pais_origen='Corea del Sur', descripcion='Soluciones para piel problemática')
    numbuzin = Brand(nombre='Numbuzin', pais_origen='Corea del Sur', descripcion='Skincare de lujo coreano')
    romand = Brand(nombre='rom&nd', pais_origen='Corea del Sur', descripcion='Maquillaje K-beauty trendy')
    medicube = Brand(nombre='Medicube', pais_origen='Corea del Sur', descripcion='Skincare clínico')
    purito = Brand(nombre='Purito', pais_origen='Corea del Sur', descripcion='Clean beauty coreano')
    biodance = Brand(nombre='Biodance', pais_origen='Corea del Sur', descripcion='Hidratación avanzada')
    skin1004 = Brand(nombre='Skin1004', pais_origen='Corea del Sur', descripcion='Centella asiatica especialista')
    innisfree = Brand(nombre='Innisfree', pais_origen='Corea del Sur', descripcion='Ingredientes naturales de Jeju')
    db.session.add_all([anua, cosrx, numbuzin, romand, medicube, purito, biodance, skin1004, innisfree])
    db.session.flush()

    # --- PRODUCTOS ---
    productos_data = [
        # Skincare – Limpiadores
        dict(nombre='ANUA Heartleaf Pore Control Cleansing Oil', sku='SKN-LMP-001',
             descripcion='Aceite limpiador con hoja de corazón que disuelve el maquillaje más resistente sin resecar.',
             beneficios='Limpieza profunda · Control de poros · Hidratación post-limpieza',
             precio_costo=320, precio_venta=580, stock=25, stock_minimo=5,
             category_id=limpiadores.id, brand_id=anua.id, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400'),
        dict(nombre='COSRX Low pH Good Morning Gel Cleanser', sku='SKN-LMP-002',
             descripcion='Gel limpiador de bajo pH que limpia suavemente sin alterar el equilibrio de la piel.',
             beneficios='pH balanceado · Sin fragancia · Apto para piel sensible y acneica',
             precio_costo=280, precio_venta=490, stock=18, stock_minimo=5,
             category_id=limpiadores.id, brand_id=cosrx.id, es_nuevo=True,
             imagen_url='https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400'),
        # Skincare – Sueros
        dict(nombre='ANUA Heartleaf 77% Soothing Serum', sku='SKN-SER-001',
             descripcion='Suero calmante con 77% de hoja de corazón. Ideal para pieles irritadas y con acné.',
             beneficios='Calma irritaciones · Reduce enrojecimiento · Controla el sebo',
             precio_costo=400, precio_venta=720, stock=30, stock_minimo=8,
             category_id=serums.id, brand_id=anua.id, es_destacado=True, es_nuevo=True,
             imagen_url='https://images.unsplash.com/photo-1620916297397-a4a5402a3c6c?w=400'),
        dict(nombre='Numbuzin No.5 Vitamin Niacinamide Serum', sku='SKN-SER-002',
             descripcion='Suero iluminador con vitamina C y niacinamida al 5%. Para manchas y piel apagada.',
             beneficios='Ilumina · Unifica el tono · Reduce manchas de hiperpigmentación',
             precio_costo=490, precio_venta=890, stock=14, stock_minimo=5,
             category_id=serums.id, brand_id=numbuzin.id, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1617897903246-719242758050?w=400'),
        dict(nombre='COSRX Advanced Snail 96 Mucin Power Essence', sku='SKN-SER-003',
             descripcion='Esencia de mucina de caracol al 96%. Regeneración celular y super hidratación.',
             beneficios='Regeneración · Hidratación intensa · Minimiza poros',
             precio_costo=350, precio_venta=620, stock=22, stock_minimo=6,
             category_id=serums.id, brand_id=cosrx.id,
             imagen_url='https://images.unsplash.com/photo-1631730359585-5b07fe4eb3f0?w=400'),
        # Skincare – Hidratantes
        dict(nombre='Biodance Bio-Collagen Real Deep Mask Cream', sku='SKN-HID-001',
             descripcion='Crema hidratante intensiva con colágeno y PDRN. Firmeza y plumpness visibles.',
             beneficios='Firmeza · Anti-edad · Hidratación 72h',
             precio_costo=420, precio_venta=780, stock=16, stock_minimo=5,
             category_id=hidratantes.id, brand_id=biodance.id, es_nuevo=True,
             imagen_url='https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=400'),
        dict(nombre='ANUA Heartleaf Quercetinol Pore Deep Cleansing Foam', sku='SKN-HID-002',
             descripcion='Hidratante en gel con quercetina y hoja de corazón para piel mixta a grasa.',
             beneficios='Hidratación ligera · Control de brillo · Antioxidante',
             precio_costo=310, precio_venta=560, stock=20, stock_minimo=5,
             category_id=hidratantes.id, brand_id=anua.id,
             imagen_url='https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400'),
        # Skincare – Protectores
        dict(nombre='Purito Daily Go-To Sunscreen SPF50+ PA++++', sku='SKN-SOL-001',
             descripcion='Protector solar ligero de acabado invisible. Fórmula mineral y química combinada.',
             beneficios='SPF50+ · PA++++ · Sin residuo blanco · Apto todo tipo de piel',
             precio_costo=380, precio_venta=680, stock=35, stock_minimo=10,
             category_id=protectores.id, brand_id=purito.id, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400'),
        dict(nombre='Skin1004 Madagascar Centella Air-Fit Suncream SPF50+', sku='SKN-SOL-002',
             descripcion='Protector solar calmante con centella asiática. Acabado mate natural.',
             beneficios='Calma rojeces · SPF50+ · Sensación ligera · Fórmula vegana',
             precio_costo=360, precio_venta=650, stock=28, stock_minimo=8,
             category_id=protectores.id, brand_id=skin1004.id, es_nuevo=True,
             imagen_url='https://images.unsplash.com/photo-1583241749552-f3b3a95d8a20?w=400'),
        # Skincare – Mascarillas
        dict(nombre='Medicube PDRN Pink Collagen Jelly Eye Mask', sku='SKN-MSK-001',
             descripcion='Parches de gel con PDRN y colágeno para el contorno de ojos. Efecto lifting.',
             beneficios='Reduce ojeras · Anti-bolsas · Efecto tensor · Hidratación intensa',
             precio_costo=290, precio_venta=520, stock=40, stock_minimo=10,
             category_id=mascarillas.id, brand_id=medicube.id, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1599307767787-fd7a135ae5c2?w=400'),
        dict(nombre='ANUA Heartleaf 70% Intense Calming Sheet Mask', sku='SKN-MSK-002',
             descripcion='Sheet mask calmante de hoja de corazón. Perfecta después de la exposición solar.',
             beneficios='Calma · Hidratación express · Reduce poros · Pack 10 unidades',
             precio_costo=250, precio_venta=450, stock=50, stock_minimo=10,
             category_id=mascarillas.id, brand_id=anua.id,
             imagen_url='https://images.unsplash.com/photo-1603706582948-64b9b9f8f9da?w=400'),
        # Makeup – Labios
        dict(nombre='rom&nd Juicy Lasting Tint – 21 Grab Cherry', sku='MKP-LAB-001',
             descripcion='Tinta labial ultra duradera con acabado jugoso. Color intenso que no reseca.',
             beneficios='Duración 12h · Hidratante · 30 tonos disponibles',
             precio_costo=310, precio_venta=560, stock=25, stock_minimo=5,
             category_id=labios.id, brand_id=romand.id, es_nuevo=True, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1631214524020-3c69b4eef11d?w=400'),
        dict(nombre='rom&nd Zero Gram Matte Lipstick – Dusty Rose', sku='MKP-LAB-002',
             descripcion='Labial mate de larga duración con fórmula ultra ligera. Cero sensación en labios.',
             beneficios='Acabado mate · Ultrapigmentado · Fórmula sin peso',
             precio_costo=320, precio_venta=580, stock=18, stock_minimo=5,
             category_id=labios.id, brand_id=romand.id,
             imagen_url='https://images.unsplash.com/photo-1580952375481-eedc791dc706?w=400'),
        # Makeup – Rostro
        dict(nombre='rom&nd Bare Water Cushion SPF40+ PA++ – 21 Natural Beige', sku='MKP-ROS-001',
             descripcion='Cushion de cobertura media-alta con acabado agua natural. Hidratación + color.',
             beneficios='SPF40+ · Acabado natural · Hidratación 24h · Repuesto incluido',
             precio_costo=520, precio_venta=950, stock=12, stock_minimo=4,
             category_id=rostro_mk.id, brand_id=romand.id, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1617897903246-719242758050?w=400'),
        # Tónicos
        dict(nombre='Innisfree Green Tea Hyaluronic Toner', sku='SKN-TON-001',
             descripcion='Tónico hidratante con extracto de té verde de Jeju y ácido hialurónico.',
             beneficios='Hidratación · Antioxidante · Textura ligera · Equilibra el pH',
             precio_costo=290, precio_venta=530, stock=22, stock_minimo=5,
             category_id=tonicos.id, brand_id=innisfree.id,
             imagen_url='https://images.unsplash.com/photo-1629732051695-79eeaeb03e61?w=400'),
    ]

    all_products = []
    for pd in productos_data:
        p = Product(**pd)
        db.session.add(p)
        all_products.append(p)
    db.session.flush()

    # --- PEDIDOS DE EJEMPLO ---
    estados = ['entregado', 'entregado', 'confirmado', 'pendiente', 'en_camino']
    nombres = ['María González', 'Andrea López', 'Valeria Castro', 'Sofía Martínez', 'Daniela Ruiz']
    telefonos = ['505-8888-1111', '505-8777-2222', '505-8666-3333', '505-8555-4444', '505-8444-5555']
    dias_atras = [5, 3, 2, 1, 0]

    for i, (estado, nombre, tel, dias) in enumerate(zip(estados, nombres, telefonos, dias_atras)):
        prod1 = all_products[i % len(all_products)]
        prod2 = all_products[(i + 2) % len(all_products)]
        cant1 = random.randint(1, 2)
        cant2 = random.randint(1, 1)
        sub1 = prod1.precio_venta * cant1
        sub2 = prod2.precio_venta * cant2
        subtotal = sub1 + sub2
        iva = round(subtotal * 0.15, 2)
        total = round(subtotal + iva, 2)

        order = Order(
            numero_pedido=f'SS-{str(i+1).zfill(6)}',
            nombre_cliente=nombre,
            telefono_cliente=tel,
            email_cliente=f'{nombre.split()[0].lower()}@gmail.com',
            direccion_entrega='Managua, Nicaragua',
            estado=estado, subtotal=round(subtotal, 2), iva=iva, total=total,
            metodo_pago='efectivo_entrega', canal='web',
            fecha=datetime.utcnow() - timedelta(days=dias)
        )
        order.items.append(OrderItem(
            product_id=prod1.id, nombre_producto=prod1.nombre,
            cantidad=cant1, precio_unitario=prod1.precio_venta, subtotal=sub1
        ))
        order.items.append(OrderItem(
            product_id=prod2.id, nombre_producto=prod2.nombre,
            cantidad=cant2, precio_unitario=prod2.precio_venta, subtotal=sub2
        ))
        db.session.add(order)

    db.session.commit()
    print("[SEED] Completado: usuarios, categorias, marcas, productos y pedidos de demo cargados.")
