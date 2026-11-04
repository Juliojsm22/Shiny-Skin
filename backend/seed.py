from models import (
    db, User, Category, Brand, Product, Order, OrderItem,
    Invoice, InvoiceItem, InventoryMovement, Client, Motorizado, Expense, OrderStatusHistory
)
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta


def seed_db():
    """Poblar la base de datos con datos iniciales K-beauty y maquillaje importado."""
    if User.query.first():
        return

    print("[SEED] Iniciando seed de SISCO - Shiny Skin...")

    # --- USUARIOS ---
    admin = User(
        nombre='Geoconda Martínez',
        username='admin',
        email='admin@shinyskin.ni',
        password_hash=generate_password_hash('admin123'),
        rol='admin',
        telefono='505-8888-0001',
        direccion='Camino de Oriente, Managua'
    )
    vendedor = User(
        nombre='María Altamirano',
        username='vendedora',
        email='ventas@shinyskin.ni',
        password_hash=generate_password_hash('ventas123'),
        rol='vendedor',
        telefono='505-8888-0002',
        direccion='Concept Store Camino de Oriente'
    )
    cliente1 = User(
        nombre='María González',
        username='maria',
        email='maria@gmail.com',
        password_hash=generate_password_hash('cliente123'),
        rol='cliente',
        telefono='505-8777-1234',
        direccion='Managua, Reparto San Juan'
    )
    cliente2 = User(
        nombre='Andrea López',
        username='andrea',
        email='andrea@gmail.com',
        password_hash=generate_password_hash('cliente123'),
        rol='cliente',
        telefono='505-8777-5678',
        direccion='Managua, Altamira'
    )
    db.session.add_all([admin, vendedor, cliente1, cliente2])
    db.session.flush()

    # --- CATEGORÍAS ---
    skincare = Category(nombre='Skincare', linea='Skincare', descripcion='Rutina de cuidado de la piel', icono='✨')
    makeup = Category(nombre='Makeup', linea='Makeup', descripcion='Maquillaje y color', icono='💄')
    db.session.add_all([skincare, makeup])
    db.session.flush()

    limpiadores = Category(nombre='Limpiadores', linea='Skincare', descripcion='Limpieza facial y doble limpieza', parent_id=skincare.id)
    serums = Category(nombre='Sueros & Esencias', linea='Skincare', descripcion='Tratamientos concentrados', parent_id=skincare.id)
    hidratantes = Category(nombre='Hidratantes & Cremas', linea='Skincare', descripcion='Cremas faciales y barrera cutánea', parent_id=skincare.id)
    protectores = Category(nombre='Protectores Solares', linea='Skincare', descripcion='SPF50+ y pantallas solares ligeras', parent_id=skincare.id)
    mascarillas = Category(nombre='Mascarillas', linea='Skincare', descripcion='Sheet masks y parches de colágeno', parent_id=skincare.id)
    tonicos = Category(nombre='Tónicos', linea='Skincare', descripcion='Tónicos calmantes y equilibrantes', parent_id=skincare.id)
    labios = Category(nombre='Labios', linea='Makeup', descripcion='Tintas, bálsamos y labiales', parent_id=makeup.id)
    rostro_mk = Category(nombre='Rostro', linea='Makeup', descripcion='Bases, cushions, correctores e iluminadores', parent_id=makeup.id)
    ojos = Category(nombre='Cejas & Ojos', linea='Makeup', descripcion='Delineadores y máscaras de pestañas', parent_id=makeup.id)
    db.session.add_all([limpiadores, serums, hidratantes, protectores, mascarillas, tonicos, labios, rostro_mk, ojos])
    db.session.flush()

    # --- MARCAS ---
    anua = Brand(nombre='ANUA', pais_origen='Corea del Sur', descripcion='K-beauty minimalista calmante')
    cosrx = Brand(nombre='COSRX', pais_origen='Corea del Sur', descripcion='Soluciones dermatológicas K-beauty')
    numbuzin = Brand(nombre='Numbuzin', pais_origen='Corea del Sur', descripcion='Sueros numerados personalizados')
    romand = Brand(nombre='rom&nd', pais_origen='Corea del Sur', descripcion='Maquillaje K-beauty en tendencia')
    medicube = Brand(nombre='Medicube', pais_origen='Corea del Sur', descripcion='Skincare clínico avanzado')
    purito = Brand(nombre='Purito', pais_origen='Corea del Sur', descripcion='Clean beauty vegano coreano')
    biodance = Brand(nombre='Biodance', pais_origen='Corea del Sur', descripcion='Bio-colágeno e hidratación profunda')
    skin1004 = Brand(nombre='Skin1004', pais_origen='Corea del Sur', descripcion='Centella asiática de Madagascar')
    innisfree = Brand(nombre='Innisfree', pais_origen='Corea del Sur', descripcion='Ingredientes naturales de la isla Jeju')
    maybelline = Brand(nombre='Maybelline', pais_origen='Estados Unidos', descripcion='Maquillaje americano de alta duración')
    db.session.add_all([anua, cosrx, numbuzin, romand, medicube, purito, biodance, skin1004, innisfree, maybelline])
    db.session.flush()

    # --- PRODUCTOS ---
    productos_data = [
        dict(nombre='ANUA Heartleaf Pore Control Cleansing Oil', sku='SKN-LMP-001',
             descripcion='Aceite limpiador con hoja de corazón que disuelve protector solar, sebo y maquillaje a prueba de agua sin irritar.',
             beneficios='Limpieza profunda · Control de poros · No comedogénico',
             ingredientes='Houttuynia Cordata Extract, Aceite de Jojoba, Aceite de Semilla de Uva',
             tamano='200 ml', fecha_vencimiento='2027-08-15',
             precio_costo=320, porcentaje_ganancia=81.25, precio_venta=580, descuento=10,
             stock_fisico=12, stock_online=13, stock=25, stock_minimo=5,
             category_id=limpiadores.id, brand_id=anua.id, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='COSRX Low pH Good Morning Gel Cleanser', sku='SKN-LMP-002',
             descripcion='Gel limpiador suave de pH bajo que purifica los poros manteniendo la barrera natural de hidratación.',
             beneficios='pH balanceado 5.5 · Apto piel sensible y acneica · Uso diario',
             ingredientes='Tea Tree Leaf Oil, Betaine Salicylate (BHA) 0.5%, Extractos botánicos',
             tamano='150 ml', fecha_vencimiento='2027-06-30',
             precio_costo=280, porcentaje_ganancia=75.0, precio_venta=490,
             stock_fisico=8, stock_online=10, stock=18, stock_minimo=5,
             category_id=limpiadores.id, brand_id=cosrx.id, es_nuevo=True,
             imagen_url='https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='ANUA Heartleaf 77% Soothing Serum', sku='SKN-SER-001',
             descripcion='Suero calmante concentrado con 77% de extracto de hoja de corazón. Ideal para pieles sensibles o con rojeces.',
             beneficios='Calma irritaciones · Reduce enrojecimiento · Equilibra el sebo',
             ingredientes='Houttuynia Cordata Extract 77%, Pantenol, Ácido Hialurónico',
             tamano='30 ml', fecha_vencimiento='2027-09-20',
             precio_costo=400, porcentaje_ganancia=80.0, precio_venta=720,
             stock_fisico=14, stock_online=16, stock=30, stock_minimo=8,
             category_id=serums.id, brand_id=anua.id, es_destacado=True, es_nuevo=True,
             imagen_url='https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='Numbuzin No.5 Vitamin Niacinamide Concentrated Serum', sku='SKN-SER-002',
             descripcion='Suero despigmentante e iluminador con glutatión, vitamina C y niacinamida al 5% para manchas post-acné.',
             beneficios='Ilumina · Unifica el tono · Atenúa manchas oscuras',
             ingredientes='Niacinamida 5%, Vitamina C, Glutatión, Ácido Tranexámico',
             tamano='30 ml', fecha_vencimiento='2027-07-10',
             precio_costo=490, porcentaje_ganancia=81.6, precio_venta=890,
             stock_fisico=2, stock_online=2, stock=4, stock_minimo=5,
             category_id=serums.id, brand_id=numbuzin.id, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='COSRX Advanced Snail 96 Mucin Power Essence', sku='SKN-SER-003',
             descripcion='Esencia icónica con 96% de mucina de caracol filtrada para regeneración intensiva y piel efecto glass skin.',
             beneficios='Regeneración cutánea · Hidratación profunda · Textura luminosa',
             ingredientes='Snail Secretion Filtrate 96%, Sodium Hyaluronate, Allantoin',
             tamano='100 ml', fecha_vencimiento='2027-10-05',
             precio_costo=350, porcentaje_ganancia=77.1, precio_venta=620, descuento=15,
             stock_fisico=10, stock_online=12, stock=22, stock_minimo=6,
             category_id=serums.id, brand_id=cosrx.id, es_destacado=True,
             imagen_url='https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='Biodance Bio-Collagen Real Deep Cream', sku='SKN-HID-001',
             descripcion='Crema reafirmante con bio-colágeno de bajo peso molecular y oligo-ácido hialurónico.',
             beneficios='Firmeza · Elasticidad · Hidratación prolongada 72h',
             ingredientes='Colágeno Hidrolizado, Galactomyces, Niacinamida, Ácido Hialurónico',
             tamano='50 ml', fecha_vencimiento='2027-05-18',
             precio_costo=420, porcentaje_ganancia=85.7, precio_venta=780,
             stock_fisico=7, stock_online=9, stock=16, stock_minimo=5, es_nuevo=True,
             category_id=hidratantes.id, brand_id=biodance.id,
             imagen_url='https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='Purito Daily Go-To Sunscreen SPF50+ PA++++', sku='SKN-SOL-001',
             descripcion='Protector solar híbrido sin rastro blanco ni sensación grasosa, enriquecido con Centella Asiática.',
             beneficios='SPF50+ PA++++ · Cero white-cast · Sin fragancia',
             ingredientes='Centella Asiatica Extract, Madecassoside, Filtros UV fotoestables',
             tamano='60 ml', fecha_vencimiento='2027-04-25',
             precio_costo=380, porcentaje_ganancia=78.9, precio_venta=680,
             stock_fisico=15, stock_online=20, stock=35, stock_minimo=10, es_destacado=True,
             category_id=protectores.id, brand_id=purito.id,
             imagen_url='https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='Skin1004 Madagascar Centella Hyalu-Cica Water-Fit Sun Serum', sku='SKN-SOL-002',
             descripcion='Suero solar ultraligero con complejo Hyalu-Cica que hidrata y protege como una crema hidratante.',
             beneficios='Textura acuosa · Calma rojeces · Fórmula vegana arrecife-seguro',
             ingredientes='Centella Asiatica de Madagascar, Ácido Hialurónico, Extracto de Té Verde',
             tamano='50 ml', fecha_vencimiento='2027-08-30',
             precio_costo=360, porcentaje_ganancia=80.5, precio_venta=650, es_nuevo=True,
             stock_fisico=4, stock_online=3, stock=7, stock_minimo=8,
             category_id=protectores.id, brand_id=skin1004.id,
             imagen_url='https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='Medicube PDRN Pink Collagen Jelly Eye Mask', sku='SKN-MSK-001',
             descripcion='Parches de hidrogel con PDRN y colágeno rosa para iluminar y reafirmar el contorno de ojos.',
             beneficios='Descongestiona bolsas · Ilumina ojeras · Efecto tensor inmediato',
             ingredientes='PDRN, Colágeno Hidrolizado, Niacinamida, Péptidos, Cafeína',
             tamano='60 parches', fecha_vencimiento='2027-06-14',
             precio_costo=290, porcentaje_ganancia=79.3, precio_venta=520, es_destacado=True,
             stock_fisico=18, stock_online=22, stock=40, stock_minimo=10,
             category_id=mascarillas.id, brand_id=medicube.id,
             imagen_url='https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='Innisfree Green Tea Hyaluronic Skin Toner', sku='SKN-TON-001',
             descripcion='Tónico hidratante de absorción inmediata con té verde orgánico de Jeju y 5 tipos de ácido hialurónico.',
             beneficios='Equilibra el pH · Refresca · Hidratación multicapa',
             ingredientes='Extracto de Té Verde Beauty Green Tea, 5x Ácido Hialurónico, Pantenol',
             tamano='170 ml', fecha_vencimiento='2027-10-22',
             precio_costo=290, porcentaje_ganancia=82.8, precio_venta=530,
             stock_fisico=10, stock_online=12, stock=22, stock_minimo=5,
             category_id=tonicos.id, brand_id=innisfree.id,
             imagen_url='https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='rom&nd Juicy Lasting Tint', sku='MKP-LAB-001',
             descripcion='Tinta labial coreana con brillo cristalino tipo jarabe y pigmentación duradera que no reseca.',
             beneficios='Acabado glossy jugoso · Larga duración · Hidratante',
             ingredientes='Escualano, Extractos frutales de cereza y papaya, Aceite de jojoba',
             tamano='5.5 g', tono='21 Grab Cherry', fecha_vencimiento='2027-12-01',
             precio_costo=310, porcentaje_ganancia=80.6, precio_venta=560,
             stock_fisico=12, stock_online=13, stock=25, stock_minimo=5, es_nuevo=True, es_destacado=True,
             category_id=labios.id, brand_id=romand.id,
             imagen_url='https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='rom&nd Zero Matte Lipstick', sku='MKP-LAB-002',
             descripcion='Labial mate aterciopelado ultraligero de textura suave que difumina líneas en los labios.',
             beneficios='Acabado velvet mate · Textura sin peso · Alta pigmentación',
             ingredientes='Aceite de semilla de algodón, Vitamina E, Microesferas difuminadoras',
             tamano='3 g', tono='07 Envy Me / Dusty Rose', fecha_vencimiento='2027-11-20',
             precio_costo=320, porcentaje_ganancia=81.3, precio_venta=580,
             stock_fisico=8, stock_online=10, stock=18, stock_minimo=5,
             category_id=labios.id, brand_id=romand.id,
             imagen_url='https://images.unsplash.com/photo-1631214524020-3c69b4eef11d?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='rom&nd Bare Water Cushion SPF38 PA++++', sku='MKP-ROS-001',
             descripcion='Base cushion hidratante con 70% de esencia acuosa para un acabado fresco, luminoso y natural.',
             beneficios='SPF38 PA++++ · Acabado glow natural · Hidratación 24h',
             ingredientes='10 tipos de Ácido Hialurónico, Agua de flor de durazno, Ceramidas',
             tamano='20 g', tono='21 Natural', fecha_vencimiento='2027-07-19',
             precio_costo=520, porcentaje_ganancia=82.7, precio_venta=950, es_destacado=True,
             stock_fisico=2, stock_online=2, stock=4, stock_minimo=5,
             category_id=rostro_mk.id, brand_id=romand.id,
             imagen_url='https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=600&q=80'),
        dict(nombre='Maybelline Fit Me Matte + Poreless Foundation', sku='MKP-ROS-002',
             descripcion='Base líquida americana matificante que se adapta al tono de piel y difumina poros.',
             beneficios='Control de grasa 16h · Acabado natural mate · No obstruye poros',
             ingredientes='Micro-polvos absorbentes, Vitamina E, Pigmentos minerales',
             tamano='30 ml', tono='128 Warm Nude', fecha_vencimiento='2027-09-10',
             precio_costo=310, porcentaje_ganancia=77.1, precio_venta=549, descuento=5,
             stock_fisico=15, stock_online=15, stock=30, stock_minimo=5, es_destacado=True,
             category_id=rostro_mk.id, brand_id=maybelline.id,
             imagen_url='/uploads/MAYBELLINE_FIT_ME_FOUNDATION.jpg'),
    ]

    all_products = []
    for pd in productos_data:
        p = Product(**pd)
        db.session.add(p)
        all_products.append(p)
    db.session.flush()

    # --- MOTORIZADOS ---
    m1 = Motorizado(nombre='Carlos Mendoza', telefono='505-8812-3456', empresa='Mandaditos Express Managua')
    m2 = Motorizado(nombre='Luis Hernández', telefono='505-8745-9012', empresa='Delivery Rápido NI')
    db.session.add_all([m1, m2])
    db.session.flush()

    # --- CLIENTES ---
    clientes_seed = [
        Client(nombre='María González', telefono='505-8888-1111', email='maria@gmail.com', direccion='Reparto San Juan, de la Iglesia 2c al Sur, Managua'),
        Client(nombre='Andrea López', telefono='505-8777-2222', email='andrea@gmail.com', direccion='Altamira D’Este, calle principal #45, Managua'),
        Client(nombre='Valeria Castro', telefono='505-8666-3333', email='valeria@gmail.com', direccion='Las Colinas, primera entrada, Managua'),
        Client(nombre='Sofía Martínez', telefono='505-8555-4444', email='sofia@gmail.com', direccion='Bello Horizonte, rotonda 1c arriba, Managua'),
        Client(nombre='Daniela Ruiz', telefono='505-8444-5555', email='daniela@gmail.com', direccion='Carretera a Masaya km 11.5, Residencial Las Praderas'),
    ]
    db.session.add_all(clientes_seed)
    db.session.flush()

    # --- PEDIDOS Y FACTURAS DE EJEMPLO ---
    estados = ['entregado', 'entregado', 'confirmado', 'pendiente', 'en_camino']
    canales = ['web', 'whatsapp', 'web', 'instagram', 'whatsapp']
    dias_atras = [5, 3, 2, 1, 0]

    for i, (estado, cl, canal, dias) in enumerate(zip(estados, clientes_seed, canales, dias_atras)):
        prod1 = all_products[i % len(all_products)]
        prod2 = all_products[(i + 2) % len(all_products)]
        sub1 = round(prod1.precio_final * 1, 2)
        sub2 = round(prod2.precio_final * 1, 2)
        subtotal = round(sub1 + sub2, 2)
        total = subtotal

        order = Order(
            numero_pedido=f'SS-{str(i + 1).zfill(6)}',
            client_id=cl.id,
            motorizado_id=m1.id if estado in ('en_camino', 'entregado') else None,
            nombre_cliente=cl.nombre,
            telefono_cliente=cl.telefono,
            email_cliente=cl.email,
            metodo_entrega='domicilio',
            direccion_entrega=cl.direccion,
            estado=estado,
            subtotal=subtotal,
            total=total,
            metodo_pago='efectivo_entrega' if i % 2 == 0 else 'transferencia',
            monto_pago_cliente=(int(total // 500) + 1) * 500 if i % 2 == 0 else None,
            cambio_entregar=round(((int(total // 500) + 1) * 500) - total, 2) if i % 2 == 0 else 0,
            canal=canal,
            fecha=datetime.utcnow() - timedelta(days=dias)
        )
        order.items.append(OrderItem(product_id=prod1.id, nombre_producto=prod1.nombre, cantidad=1, precio_unitario=prod1.precio_final, subtotal=sub1))
        order.items.append(OrderItem(product_id=prod2.id, nombre_producto=prod2.nombre, cantidad=1, precio_unitario=prod2.precio_final, subtotal=sub2))
        order.historial.append(OrderStatusHistory(estado_anterior=None, estado_nuevo=estado, observacion='Pedido inicial de demostración', fecha=order.fecha))
        db.session.add(order)
        db.session.flush()

        if estado == 'entregado':
            inv = Invoice(
                numero_factura=f'FAC-202611-{str(i + 1).zfill(4)}',
                order_id=order.id,
                client_id=cl.id,
                user_id=admin.id,
                nombre_cliente=cl.nombre,
                telefono_cliente=cl.telefono,
                email_cliente=cl.email,
                canal='online',
                subtotal=subtotal,
                total=total,
                metodo_pago='efectivo',
                estado='pagada',
                fecha=order.fecha
            )
            inv.items.append(InvoiceItem(product_id=prod1.id, nombre_producto=prod1.nombre, cantidad=1, precio_unitario=prod1.precio_final, subtotal=sub1))
            inv.items.append(InvoiceItem(product_id=prod2.id, nombre_producto=prod2.nombre, cantidad=1, precio_unitario=prod2.precio_final, subtotal=sub2))
            db.session.add(inv)

    # --- GASTOS OPERATIVOS ---
    db.session.add_all([
        Expense(categoria_gasto='ALQUILER', concepto='Cuota mensual módulo Concept Store Camino de Oriente', monto=5500.00, fecha='2026-10-01', user_id=admin.id),
        Expense(categoria_gasto='IMPORTACION', concepto='Flete aéreo consolidado Seúl - Managua (Lote K-Beauty)', monto=4200.00, fecha='2026-10-12', user_id=admin.id),
        Expense(categoria_gasto='EMPAQUE', concepto='Bolsas kraft y papelería personalizada Shiny Skin', monto=850.00, fecha='2026-10-18', user_id=admin.id),
        Expense(categoria_gasto='PUBLICIDAD', concepto='Campaña Instagram & Facebook Ads', monto=1100.00, fecha='2026-10-25', user_id=admin.id),
    ])

    db.session.commit()
    print("[SEED] Completado exitosamente.")
