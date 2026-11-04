/**
 * SISCO – Shiny Skin | api.js
 * Cliente HTTP unificado + Motor de Persistencia Local (localStorage) automático
 * Funciona tanto conectado al backend Flask (localhost:5000) como en modo navegador directo.
 */

const API_BASE = (() => {
  if (window.location.protocol === 'file:') return 'http://localhost:5000/api';
  if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port && window.location.port !== '5000') {
    return 'http://localhost:5000/api';
  }
  return '/api';
})();

const BACKEND_ORIGIN = API_BASE.startsWith('http') ? API_BASE.replace(/\/api$/, '') : window.location.origin;
const FALLBACK_PRODUCT_IMG = 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=600&q=80';
const LOCAL_DB_KEY = 'sisco_local_db_v2';

// ---- Semilla Inicial para Base de Datos Local ----
const INITIAL_PRODUCTS = [
  { id: 1, nombre: 'ANUA Heartleaf 77% Soothing Serum', sku: 'SKN-SER-001', marca: 'ANUA', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '30 ml', tono: '', fecha_vencimiento: '2027-08-15', precio_costo: 400, porcentaje_ganancia: 80, precio_venta: 720, precio_final: 720, descuento: 0, stock: 30, stock_fisico: 14, stock_online: 16, stock_minimo: 8, es_nuevo: true, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80', descripcion: 'Suero calmante con 77% de hoja de corazón. Calma irritaciones y reduce el enrojecimiento.', beneficios: 'Calma irritaciones · Reduce enrojecimiento · Equilibra el sebo', ingredientes: 'Houttuynia Cordata Extract 77%, Pantenol, Ácido Hialurónico' },
  { id: 2, nombre: 'COSRX Advanced Snail 96 Mucin Essence', sku: 'SKN-SER-003', marca: 'COSRX', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '100 ml', tono: '', fecha_vencimiento: '2027-06-20', precio_costo: 350, porcentaje_ganancia: 77.1, precio_venta: 620, precio_final: 527, descuento: 15, stock: 22, stock_fisico: 10, stock_online: 12, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=600&q=80', descripcion: 'Esencia de mucina de caracol al 96% para regeneración celular e hidratación profunda.', beneficios: 'Regeneración cutánea · Hidratación profunda · Textura glass skin', ingredientes: 'Snail Secretion Filtrate 96%, Sodium Hyaluronate, Allantoin' },
  { id: 3, nombre: 'Purito Daily Go-To Sunscreen SPF50+ PA++++', sku: 'SKN-SOL-001', marca: 'Purito', linea: 'Skincare', categoria: 'Protectores Solares', tamano: '60 ml', tono: '', fecha_vencimiento: '2027-05-10', precio_costo: 380, porcentaje_ganancia: 78.9, precio_venta: 680, precio_final: 680, descuento: 0, stock: 35, stock_fisico: 18, stock_online: 17, stock_minimo: 6, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80', descripcion: 'Protector solar ligero de acabado invisible sin rastro blanco.', beneficios: 'SPF50+ PA++++ · Sin white cast · Con Centella Asiática', ingredientes: 'Centella Asiatica Extract, Uvinul A Plus, Tinosorb S' },
  { id: 4, nombre: 'rom&nd Juicy Lasting Tint – 21 Grab Cherry', sku: 'MKP-LAB-001', marca: 'rom&nd', linea: 'Skincare' === 'Makeup' ? 'Skincare' : 'Makeup', categoria: 'Labios', tamano: '5.5 g', tono: '21 Grab Cherry', fecha_vencimiento: '2027-09-30', precio_costo: 310, porcentaje_ganancia: 80.6, precio_venta: 560, precio_final: 560, descuento: 0, stock: 25, stock_fisico: 12, stock_online: 13, stock_minimo: 5, es_nuevo: true, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=600&q=80', descripcion: 'Tinta labial coreana ultra duradera con acabado jugoso brillante.', beneficios: 'Brillo espejo · Alta pigmentación · Hidratación frutal', ingredientes: 'Extractos de papaya, pomelo y coco, escualano vegetal' },
  { id: 5, nombre: 'Numbuzin No.5 Vitamin Niacinamide Serum', sku: 'SKN-SER-002', marca: 'Numbuzin', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '30 ml', tono: '', fecha_vencimiento: '2026-12-15', precio_costo: 490, porcentaje_ganancia: 81.6, precio_venta: 890, precio_final: 890, descuento: 0, stock: 4, stock_fisico: 2, stock_online: 2, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=600&q=80', descripcion: 'Suero iluminador con vitamina C, glutatión y niacinamida al 5%.', beneficios: 'Despigmentante · Antioxidante · Unifica el tono', ingredientes: 'Niacinamide 5%, Tranexamic Acid, Glutathione, Vitamin C' },
  { id: 6, nombre: 'Biodance Bio-Collagen Real Deep Mask Cream', sku: 'SKN-HID-001', marca: 'Biodance', linea: 'Skincare', categoria: 'Hidratantes & Cremas', tamano: '50 ml', tono: '', fecha_vencimiento: '2027-07-01', precio_costo: 430, porcentaje_ganancia: 81.4, precio_venta: 780, precio_final: 663, descuento: 15, stock: 16, stock_fisico: 8, stock_online: 8, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?auto=format&fit=crop&w=600&q=80', descripcion: 'Crema hidratante intensiva con bio-colágeno y ácido hialurónico.', beneficios: 'Efecto reafirmante · Barrera cutánea · Elasticidad', ingredientes: 'Low Molecular Collagen, Oligo-Hyaluronic Acid, Galactomyces' },
  { id: 7, nombre: 'ANUA Heartleaf Pore Control Cleansing Oil', sku: 'SKN-LMP-001', marca: 'ANUA', linea: 'Skincare', categoria: 'Limpiadores', tamano: '200 ml', tono: '', fecha_vencimiento: '2027-04-20', precio_costo: 320, porcentaje_ganancia: 81.3, precio_venta: 580, precio_final: 522, descuento: 10, stock: 25, stock_fisico: 12, stock_online: 13, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=600&q=80', descripcion: 'Aceite limpiador suave para doble limpieza coreana.', beneficios: 'Disuelve maquillaje waterproof · Limpia poros · No comedogénico', ingredientes: 'Houttuynia Cordata Extract, Jojoba Seed Oil, Grape Seed Oil' },
  { id: 8, nombre: 'Skin1004 Madagascar Centella Air-Fit Suncream', sku: 'SKN-SOL-002', marca: 'Skin1004', linea: 'Skincare', categoria: 'Protectores Solares', tamano: '50 ml', tono: '', fecha_vencimiento: '2027-10-12', precio_costo: 360, porcentaje_ganancia: 80.6, precio_venta: 650, precio_final: 650, descuento: 0, stock: 28, stock_fisico: 14, stock_online: 14, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=600&q=80', descripcion: 'Protector solar calmante con Centella Asiática de Madagascar.', beneficios: 'Calma piel sensible · Protección UV amplia · Textura sedosa', ingredientes: 'Centella Asiatica Extract 29.8%, Niacinamide, Madecassoside' },
  { id: 9, nombre: 'rom&nd Bare Water Cushion SPF40+ – Natural Beige', sku: 'MKP-ROS-001', marca: 'rom&nd', linea: 'Makeup', categoria: 'Rostro', tamano: '15 g', tono: '21 Natural Beige', fecha_vencimiento: '2027-03-18', precio_costo: 520, porcentaje_ganancia: 82.7, precio_venta: 950, precio_final: 950, descuento: 0, stock: 12, stock_fisico: 6, stock_online: 6, stock_minimo: 4, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=600&q=80', descripcion: 'Base cushion coreana de acabado hidratado luminoso.', beneficios: 'Cobertura ligera natural · 70% esencia hidratante · SPF40+', ingredientes: 'Ácido Hialurónico, Ceramidas, Extracto de Flor de Loto' },
  { id: 10, nombre: 'Medicube PDRN Pink Collagen Jelly Eye Mask', sku: 'SKN-MSK-001', marca: 'Medicube', linea: 'Skincare', categoria: 'Mascarillas', tamano: '60 parches', tono: '', fecha_vencimiento: '2027-11-05', precio_costo: 290, porcentaje_ganancia: 79.3, precio_venta: 520, precio_final: 520, descuento: 0, stock: 40, stock_fisico: 20, stock_online: 20, stock_minimo: 8, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80', descripcion: 'Parches de hidrogel con PDRN y colágeno para contorno de ojos.', beneficios: 'Descongestiona ojeras · Hidrata líneas finas · Efecto frío', ingredientes: 'Salmon PDRN, Hydrolyzed Collagen, Niacinamide, Adenosine' },
  { id: 11, nombre: 'COSRX Low pH Good Morning Gel Cleanser', sku: 'SKN-LMP-002', marca: 'COSRX', linea: 'Skincare', categoria: 'Limpiadores', tamano: '150 ml', tono: '', fecha_vencimiento: '2027-08-22', precio_costo: 280, porcentaje_ganancia: 75, precio_venta: 490, precio_final: 490, descuento: 0, stock: 18, stock_fisico: 8, stock_online: 10, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80', descripcion: 'Gel limpiador diario de pH balanceado 5.5.', beneficios: 'Respeta el manto ácido · Con aceite de árbol de té · Suave', ingredientes: 'Melaleuca Alternifolia Leaf Oil, Betaine Salicylate (BHA)' },
  { id: 12, nombre: 'Innisfree Green Tea Hyaluronic Toner', sku: 'SKN-TON-001', marca: 'Innisfree', linea: 'Skincare', categoria: 'Tónicos', tamano: '170 ml', tono: '', fecha_vencimiento: '2027-09-14', precio_costo: 300, porcentaje_ganancia: 76.7, precio_venta: 530, precio_final: 530, descuento: 0, stock: 22, stock_fisico: 11, stock_online: 11, stock_minimo: 5, es_nuevo: false, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=600&q=80', descripcion: 'Tónico hidratante con té verde de la isla Jeju y 5 ácidos hialurónicos.', beneficios: 'Absorción inmediata · Refrescante · Calma la sed de la piel', ingredientes: 'Camellia Sinensis Leaf Extract, 5-Hyaluronic Acid Complex' },
];

function enrichProductComputed(p) {
  const fis = Math.max(0, parseInt(p.stock_fisico ?? p.stock ?? 0) || 0);
  const onl = Math.max(0, parseInt(p.stock_online ?? 0) || 0);
  p.stock_fisico = fis;
  p.stock_online = onl;
  p.stock = fis + onl;
  p.stock_minimo = parseInt(p.stock_minimo ?? 5) || 5;
  p.precio_costo = Math.round((parseFloat(p.precio_costo) || 0) * 100) / 100;
  p.precio_venta = Math.round((parseFloat(p.precio_venta) || 0) * 100) / 100;
  p.descuento = Math.round((parseFloat(p.descuento) || 0) * 100) / 100;
  p.porcentaje_ganancia = p.precio_costo > 0
    ? Math.round(((p.precio_venta - p.precio_costo) / p.precio_costo) * 1000) / 10
    : (parseFloat(p.porcentaje_ganancia) || 0);
  p.precio_final = p.descuento > 0
    ? Math.round(p.precio_venta * (1 - p.descuento / 100) * 100) / 100
    : p.precio_venta;
  p.stock_critico = p.stock <= p.stock_minimo;

  if (p.fecha_vencimiento) {
    const diff = Math.ceil((new Date(p.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24));
    p.dias_para_vencer = isNaN(diff) ? null : diff;
    p.por_vencer = p.dias_para_vencer !== null && p.dias_para_vencer <= 60;
  } else {
    p.dias_para_vencer = null;
    p.por_vencer = false;
  }
  return p;
}

function createInitialLocalDB() {
  const todayIso = new Date().toISOString();
  const todayDate = todayIso.slice(0, 10);
  return {
    usuarios: [
      { id: 1, nombre: 'Administradora Shiny Skin', username: 'admin', email: 'admin@shinyskin.ni', rol: 'admin', telefono: '505-8585-1000', activo: true, ultimo_acceso: todayIso, created_at: '2026-01-15T08:00:00' },
      { id: 2, nombre: 'Sofía Martínez (Ventas)', username: 'vendedora', email: 'vendedora@shinyskin.ni', rol: 'vendedor', telefono: '505-8585-2000', activo: true, ultimo_acceso: todayIso, created_at: '2026-02-10T09:00:00' },
    ],
    categorias: [
      { id: 1, nombre: 'Skincare', linea: 'Skincare', parent_id: null },
      { id: 2, nombre: 'Makeup', linea: 'Makeup', parent_id: null },
      { id: 3, nombre: 'Limpiadores', linea: 'Skincare', parent_id: 1 },
      { id: 4, nombre: 'Sueros & Esencias', linea: 'Skincare', parent_id: 1 },
      { id: 5, nombre: 'Hidratantes & Cremas', linea: 'Skincare', parent_id: 1 },
      { id: 6, nombre: 'Protectores Solares', linea: 'Skincare', parent_id: 1 },
      { id: 7, nombre: 'Mascarillas', linea: 'Skincare', parent_id: 1 },
      { id: 8, nombre: 'Tónicos', linea: 'Skincare', parent_id: 1 },
      { id: 9, nombre: 'Labios', linea: 'Makeup', parent_id: 2 },
      { id: 10, nombre: 'Rostro', linea: 'Makeup', parent_id: 2 },
      { id: 11, nombre: 'Cejas & Ojos', linea: 'Makeup', parent_id: 2 },
    ],
    marcas: [
      { id: 1, nombre: 'ANUA', pais_origen: 'Corea del Sur' },
      { id: 2, nombre: 'COSRX', pais_origen: 'Corea del Sur' },
      { id: 3, nombre: 'Purito', pais_origen: 'Corea del Sur' },
      { id: 4, nombre: 'rom&nd', pais_origen: 'Corea del Sur' },
      { id: 5, nombre: 'Numbuzin', pais_origen: 'Corea del Sur' },
      { id: 6, nombre: 'Biodance', pais_origen: 'Corea del Sur' },
      { id: 7, nombre: 'Skin1004', pais_origen: 'Corea del Sur' },
      { id: 8, nombre: 'Medicube', pais_origen: 'Corea del Sur' },
      { id: 9, nombre: 'Innisfree', pais_origen: 'Corea del Sur' },
    ],
    productos: INITIAL_PRODUCTS.map(p => enrichProductComputed({ ...p })),
    movimientos: [
      { id: 1, product_id: 1, producto: 'ANUA Heartleaf 77% Soothing Serum', sku: 'SKN-SER-001', tipo: 'entrada', ubicacion: 'fisico', cantidad: 14, stock_anterior: 16, stock_nuevo: 30, motivo: 'Abastecimiento lote importación Corea', usuario: 'Administradora Shiny Skin', fecha: todayIso },
      { id: 2, product_id: 2, producto: 'COSRX Advanced Snail 96 Mucin Essence', sku: 'SKN-SER-003', tipo: 'traslado', ubicacion: 'online->fisico', cantidad: 4, stock_anterior: 22, stock_nuevo: 22, motivo: 'Reposición de vitrina en Concept Store Camino de Oriente', usuario: 'Sofía Martínez (Ventas)', fecha: todayIso },
    ],
    motorizados: [
      { id: 1, nombre: 'Carlos José Blandón', telefono: '505-8811-2233', empresa: 'Express Managua', activo: true, pedidos_asignados: 1 },
      { id: 2, nombre: 'Miguel Ángel Rivas', telefono: '505-8744-5566', empresa: 'Delivery Rápido NI', activo: true, pedidos_asignados: 0 },
    ],
    clientes: [
      { id: 1, nombre: 'María Fernanda González', telefono: '505-8888-1111', email: 'mfernanda@gmail.com', direccion: 'Altamira D\'Este, de donde fue la Vicky 2c. al sur, Managua', notas: 'Cliente frecuente línea ANUA' },
      { id: 2, nombre: 'Andrea Carolina López', telefono: '505-8777-2222', email: 'andrea.lopez@gmail.com', direccion: 'Retiro en Concept Store Camino de Oriente', notas: 'Prefiere retiro en tienda' },
      { id: 3, nombre: 'Valeria Castro Rivas', telefono: '505-8666-3333', email: 'valeria.castro@gmail.com', direccion: 'Residencial Las Colinas, segunda entrada, Managua', notas: 'Piel sensible' },
    ],
    pedidos: [
      {
        id: 1, numero_pedido: 'SS-000101', client_id: 1, motorizado_id: 1, motorizado_nombre: 'Carlos José Blandón', motorizado_telefono: '505-8811-2233',
        nombre_cliente: 'María Fernanda González', telefono_cliente: '505-8888-1111', email_cliente: 'mfernanda@gmail.com',
        metodo_entrega: 'domicilio', direccion_entrega: 'Altamira D\'Este, de donde fue la Vicky 2c. al sur, Managua',
        estado: 'entregado', subtotal: 1440, descuento: 0, costo_envio: 0, iva: 0, total: 1440,
        metodo_pago: 'efectivo_entrega', monto_pago_cliente: 1500, cambio_entregar: 60,
        canal: 'web', factura_id: 1, numero_factura: 'FAC-000001', fecha: todayIso,
        items: [{ id: 1, product_id: 1, nombre_producto: 'ANUA Heartleaf 77% Soothing Serum', sku: 'SKN-SER-001', cantidad: 2, precio_unitario: 720, subtotal: 1440 }],
        historial: [{ id: 1, estado_anterior: null, estado_nuevo: 'pendiente', observacion: 'Pedido recibido vía web', fecha: todayIso }, { id: 2, estado_anterior: 'pendiente', estado_nuevo: 'entregado', observacion: 'Entregado por motorizado', fecha: todayIso }]
      },
      {
        id: 2, numero_pedido: 'SS-000102', client_id: 2, motorizado_id: null, motorizado_nombre: null, motorizado_telefono: null,
        nombre_cliente: 'Andrea Carolina López', telefono_cliente: '505-8777-2222', email_cliente: 'andrea.lopez@gmail.com',
        metodo_entrega: 'retiro', direccion_entrega: 'Retiro en tienda (Concept Store Camino de Oriente)',
        estado: 'confirmado', subtotal: 890, descuento: 0, costo_envio: 0, iva: 0, total: 890,
        metodo_pago: 'transferencia', monto_pago_cliente: null, cambio_entregar: 0,
        canal: 'whatsapp', factura_id: null, numero_factura: null, fecha: todayIso,
        items: [{ id: 2, product_id: 5, nombre_producto: 'Numbuzin No.5 Vitamin Niacinamide Serum', sku: 'SKN-SER-002', cantidad: 1, precio_unitario: 890, subtotal: 890 }],
        historial: [{ id: 3, estado_anterior: null, estado_nuevo: 'confirmado', observacion: 'Transferencia LAFISE verificada', fecha: todayIso }]
      },
      {
        id: 3, numero_pedido: 'SS-000103', client_id: 3, motorizado_id: 1, motorizado_nombre: 'Carlos José Blandón', motorizado_telefono: '505-8811-2233',
        nombre_cliente: 'Valeria Castro Rivas', telefono_cliente: '505-8666-3333', email_cliente: 'valeria.castro@gmail.com',
        metodo_entrega: 'domicilio', direccion_entrega: 'Residencial Las Colinas, segunda entrada, Managua',
        estado: 'en_camino', subtotal: 1240, descuento: 0, costo_envio: 120, iva: 0, total: 1360,
        metodo_pago: 'efectivo_entrega', monto_pago_cliente: 1500, cambio_entregar: 140,
        canal: 'instagram', factura_id: null, numero_factura: null, fecha: todayIso,
        items: [{ id: 3, product_id: 3, nombre_producto: 'Purito Daily Go-To Sunscreen SPF50+ PA++++', sku: 'SKN-SOL-001', cantidad: 1, precio_unitario: 680, subtotal: 680 }, { id: 4, product_id: 4, nombre_producto: 'rom&nd Juicy Lasting Tint – 21 Grab Cherry', sku: 'MKP-LAB-001', cantidad: 1, precio_unitario: 560, subtotal: 560 }],
        historial: [{ id: 4, estado_anterior: 'confirmado', estado_nuevo: 'en_camino', observacion: 'Despachado con Carlos José Blandón', fecha: todayIso }]
      },
    ],
    facturas: [
      {
        id: 1, numero_factura: 'FAC-000001', order_id: 1, numero_pedido: 'SS-000101',
        nombre_cliente: 'María Fernanda González', telefono_cliente: '505-8888-1111', email_cliente: 'mfernanda@gmail.com',
        canal: 'online', tipo_descuento: 'monto', subtotal: 1440, descuento: 0, iva: 0, total: 1440,
        metodo_pago: 'efectivo', monto_recibido: 1500, cambio: 60, estado: 'pagada',
        emisor: 'Administradora Shiny Skin', fecha: todayIso,
        items: [{ id: 1, product_id: 1, nombre_producto: 'ANUA Heartleaf 77% Soothing Serum', sku: 'SKN-SER-001', cantidad: 2, precio_unitario: 720, descuento: 0, subtotal: 1440 }]
      },
      {
        id: 2, numero_factura: 'FAC-000002', order_id: null, numero_pedido: null,
        nombre_cliente: 'Consumidor Final', telefono_cliente: '', email_cliente: '',
        canal: 'colectivo', tipo_descuento: 'monto', subtotal: 680, descuento: 0, iva: 0, total: 680,
        metodo_pago: 'efectivo', monto_recibido: 700, cambio: 20, estado: 'pagada',
        emisor: 'Sofía Martínez (Ventas)', fecha: todayIso,
        items: [{ id: 2, product_id: 3, nombre_producto: 'Purito Daily Go-To Sunscreen SPF50+ PA++++', sku: 'SKN-SOL-001', cantidad: 1, precio_unitario: 680, descuento: 0, subtotal: 680 }]
      }
    ],
    gastos: [
      { id: 1, categoria_gasto: 'ALQUILER', concepto: 'Módulo en Colectivo Concept Store Camino de Oriente', monto: 7500, fecha: todayDate, notas: 'Cuota mensual', usuario: 'Administradora Shiny Skin' },
      { id: 2, categoria_gasto: 'IMPORTACION', concepto: 'Desaduanaje lote cosmética coreana DHL', monto: 4200, fecha: todayDate, notas: 'Póliza consolidada', usuario: 'Administradora Shiny Skin' },
      { id: 3, categoria_gasto: 'EMPAQUE', concepto: 'Bolsas satinadas, stickers holográficos y papel seda Shiny Skin', monto: 1450, fecha: todayDate, notas: '200 unidades', usuario: 'Administradora Shiny Skin' },
    ],
    _updated_at: 1,
  };
}

let MEMORY_DB = null;
const WN_PREFIX = 'SISCO_WN_DB:';
const siscoSyncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sisco_sync_channel') : null;

function parseDBCandidate(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.productos)) return parsed;
  } catch {}
  return null;
}

function mergeRecordArrays(primaryArr = [], secondaryArr = [], keyFn = (x) => x.id) {
  const map = new Map();
  const order = [];
  const pickBetter = (a, b) => {
    const tA = Number(a?._updated_at || 0);
    const tB = Number(b?._updated_at || 0);
    if (tA !== tB) return tA > tB ? a : b;
    const hA = Array.isArray(a?.historial) ? a.historial.length : 0;
    const hB = Array.isArray(b?.historial) ? b.historial.length : 0;
    if (hA !== hB) return hA > hB ? a : b;
    if (a?.numero_factura && !b?.numero_factura) return a;
    if (b?.numero_factura && !a?.numero_factura) return b;
    if (a?.estado && b?.estado && a.estado !== b.estado) {
      if (a.estado !== 'pendiente' && b.estado === 'pendiente') return a;
      if (b.estado !== 'pendiente' && a.estado === 'pendiente') return b;
    }
    return a;
  };

  [...(Array.isArray(primaryArr) ? primaryArr : []), ...(Array.isArray(secondaryArr) ? secondaryArr : [])].forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const k = keyFn(item);
    if (k === undefined || k === null || k === '') return;
    if (!map.has(k)) {
      map.set(k, item);
      order.push(k);
    } else {
      map.set(k, pickBetter(map.get(k), item));
    }
  });
  return order.map((k) => map.get(k));
}

function mergeLocalDBs(dbA, dbB) {
  if (!dbA) return dbB;
  if (!dbB) return dbA;
  const tA = Number(dbA._updated_at || 0);
  const tB = Number(dbB._updated_at || 0);
  const primary = tA >= tB ? dbA : dbB;
  const secondary = tA >= tB ? dbB : dbA;

  const mergedPedidos = mergeRecordArrays(
    primary.pedidos,
    secondary.pedidos,
    (o) => o.numero_pedido || `id_${o.id}`
  );
  // Garantizar IDs únicos y orden descendente (más recientes primero)
  const usedIds = new Set();
  let maxId = mergedPedidos.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0);
  mergedPedidos.forEach((o) => {
    const idNum = Number(o.id) || 0;
    if (!idNum || usedIds.has(idNum)) {
      maxId += 1;
      o.id = maxId;
    } else {
      usedIds.add(idNum);
    }
  });
  mergedPedidos.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

  const mergedFacturas = mergeRecordArrays(
    primary.facturas,
    secondary.facturas,
    (f) => f.numero_factura || `id_${f.id}`
  ).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

  const mergedClientes = mergeRecordArrays(
    primary.clientes,
    secondary.clientes,
    (c) => c.id || normalizeText(c.nombre)
  );

  const mergedMotorizados = mergeRecordArrays(
    primary.motorizados,
    secondary.motorizados,
    (m) => m.id || normalizeText(m.nombre)
  );

  const mergedMovimientos = mergeRecordArrays(
    primary.movimientos,
    secondary.movimientos,
    (m) => `${m.id}_${m.fecha || ''}_${m.product_id || ''}`
  ).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

  const mergedGastos = mergeRecordArrays(primary.gastos, secondary.gastos, (g) => g.id);
  const mergedUsuarios = mergeRecordArrays(primary.usuarios, secondary.usuarios, (u) => u.id);
  const mergedProductos = mergeRecordArrays(primary.productos, secondary.productos, (p) => p.id)
    .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))
    .map(enrichProductComputed);

  const sA = Number(primary._session?.updated_at || 0);
  const sB = Number(secondary._session?.updated_at || 0);
  const mergedSession = sA >= sB ? (primary._session || secondary._session) : (secondary._session || primary._session);

  const cA = Number(primary._cart_updated_at || 0);
  const cB = Number(secondary._cart_updated_at || 0);
  const mergedCart = cA >= cB ? (primary._cart ?? secondary._cart) : (secondary._cart ?? primary._cart);

  return {
    ...secondary,
    ...primary,
    usuarios: mergedUsuarios,
    productos: mergedProductos,
    movimientos: mergedMovimientos,
    motorizados: mergedMotorizados,
    clientes: mergedClientes,
    pedidos: mergedPedidos,
    facturas: mergedFacturas,
    gastos: mergedGastos,
    _session: mergedSession || null,
    _cart: Array.isArray(mergedCart) ? mergedCart : [],
    _cart_updated_at: Math.max(cA, cB),
    _updated_at: Math.max(tA, tB, 1),
  };
}

function getLocalDB() {
  let lsDB = null;
  let wnDB = null;
  try {
    lsDB = parseDBCandidate(localStorage.getItem(LOCAL_DB_KEY));
  } catch {}
  try {
    if (window.name && window.name.startsWith(WN_PREFIX)) {
      wnDB = parseDBCandidate(window.name.slice(WN_PREFIX.length));
    }
  } catch {}

  let combined = mergeLocalDBs(lsDB, wnDB);
  if (MEMORY_DB && Array.isArray(MEMORY_DB.productos)) {
    combined = mergeLocalDBs(combined, MEMORY_DB);
  }

  if (combined && Array.isArray(combined.productos)) {
    combined.productos = combined.productos.map(enrichProductComputed);
    MEMORY_DB = combined;
    // Sincronizar silenciosamente ambos almacenes para que file:// y multi-pestaña tengan siempre los mismos pedidos
    const serialized = JSON.stringify(combined);
    try { window.name = WN_PREFIX + serialized; } catch {}
    try {
      if (localStorage.getItem(LOCAL_DB_KEY) !== serialized) {
        localStorage.setItem(LOCAL_DB_KEY, serialized);
      }
    } catch {}
    return combined;
  }

  const fresh = createInitialLocalDB();
  MEMORY_DB = fresh;
  saveLocalDB(fresh, { preserveTimestamp: true });
  return fresh;
}

function saveLocalDB(db, opts = {}) {
  if (!db || typeof db !== 'object') return;
  if (!opts.preserveTimestamp) {
    db._updated_at = Date.now();
  }
  MEMORY_DB = db;
  const serialized = JSON.stringify(db);
  try {
    window.name = WN_PREFIX + serialized;
  } catch {}
  try {
    localStorage.setItem(LOCAL_DB_KEY, serialized);
  } catch (e) {
    // Si una imagen Base64 excedió la cuota de 5MB de localStorage, compactar imágenes grandes y reintentar
    try {
      (db.productos || []).forEach(p => {
        if (p.imagen_url && p.imagen_url.startsWith('data:image/') && p.imagen_url.length > 180000) {
          p.imagen_url = FALLBACK_PRODUCT_IMG;
        }
      });
      const compact = JSON.stringify(db);
      localStorage.setItem(LOCAL_DB_KEY, compact);
      window.name = WN_PREFIX + compact;
    } catch (e2) {
      console.warn('Advertencia al guardar en localStorage:', e2);
    }
  }
  if (!opts.silent) {
    try {
      if (siscoSyncChannel) siscoSyncChannel.postMessage({ type: 'db-updated', updated_at: db._updated_at });
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('sisco:db-updated', { detail: { updated_at: db._updated_at } }));
    } catch {}
  }
}

if (siscoSyncChannel) {
  siscoSyncChannel.onmessage = (ev) => {
    if (ev && ev.data && ev.data.type === 'db-updated') {
      MEMORY_DB = null;
      getLocalDB();
      try { window.dispatchEvent(new CustomEvent('sisco:db-updated', { detail: ev.data })); } catch {}
    }
  };
}

window.addEventListener('storage', (ev) => {
  if (!ev.key || ev.key === LOCAL_DB_KEY) {
    MEMORY_DB = null;
    getLocalDB();
    try { window.dispatchEvent(new CustomEvent('sisco:db-updated', { detail: { source: 'storage' } })); } catch {}
  }
});

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    if (!file || !(file instanceof Blob) || file.size === 0) return resolve('');
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) return resolve('');
      // Comprimir imagen mediante Canvas para que ocupe ~25KB en localStorage y nunca falle por cuota
      const img = new Image();
      img.onload = () => {
        try {
          const MAX_DIM = 460;
          let w = img.width || 400;
          let h = img.height || 400;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
            else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.74);
          resolve(compressed || rawDataUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// ---- Motor Local que procesa todos los endpoints cuando el servidor Flask no está activo ----
async function handleLocalApi(method, path, body) {
  const db = getLocalDB();
  const urlObj = new URL(path, 'http://localhost');
  const pathname = urlObj.pathname.replace(/\/+$/, '') || '/';
  const params = Object.fromEntries(urlObj.searchParams.entries());

  let data = body || {};
  if (body instanceof FormData) {
    data = {};
    for (const [k, v] of body.entries()) {
      if (v instanceof File) {
        if (v.size > 0) data.imagen_url = await fileToDataUrl(v);
      } else {
        data[k] = v;
      }
    }
  }

  let currentUser = { nombre: 'Administradora Shiny Skin', rol: 'admin' };
  try {
    const u = JSON.parse(localStorage.getItem('sisco_user') || 'null');
    if (u && u.nombre) currentUser = u;
  } catch {}

  const nextId = (arr) => arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
  const nowIso = new Date().toISOString();

  // ==================== AUTH & USUARIOS ====================
  if (pathname === '/auth/login' && method === 'POST') {
    const idf = String(data.email || data.username || '').trim().toLowerCase();
    const pwd = String(data.password || '');
    let u = db.usuarios.find(x => (x.email || '').toLowerCase() === idf || (x.username || '').toLowerCase() === idf);
    if (!u && (idf === 'admin' || idf === 'admin@shinyskin.ni' || idf === 'admin@shinyskin.com')) u = db.usuarios[0];
    if (!u && (idf === 'vendedora' || idf === 'vendedora@shinyskin.ni' || idf === 'vendedor' || idf === 'vendedor@shinyskin.com' || idf === 'ventas' || idf === 'ventas@shinyskin.ni' || idf === 'ventas@shinyskin.com')) u = db.usuarios[1];
    if (!u || (u.password && u.password !== pwd)) {
      const err = new Error('Credenciales inválidas. Verifica tu usuario y contraseña.');
      err.status = 401;
      throw err;
    }
    if (u.activo === false) {
      throw new Error('Esta cuenta de usuario se encuentra desactivada.');
    }
    u.ultimo_acceso = nowIso;
    u._updated_at = Date.now();
    const token = `local_jwt_${u.id}_${Date.now()}`;
    db._session = { token, user: u, updated_at: Date.now() };
    saveLocalDB(db);
    return { token, user: u, usuario: u };
  }

  if (pathname === '/auth/register' && method === 'POST') {
    const u = {
      id: nextId(db.usuarios),
      nombre: data.nombre || 'Cliente Shiny Skin',
      username: data.username || (data.email || '').split('@')[0],
      email: data.email || `cliente${Date.now()}@shinyskin.ni`,
      rol: 'cliente',
      telefono: data.telefono || '',
      activo: true,
      ultimo_acceso: nowIso,
      created_at: nowIso,
      _updated_at: Date.now()
    };
    db.usuarios.push(u);
    const token = `local_jwt_${u.id}_${Date.now()}`;
    db._session = { token, user: u, updated_at: Date.now() };
    saveLocalDB(db);
    return { token, user: u, usuario: u };
  }

  if (pathname === '/auth/forgot-password' && method === 'POST') {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.last_reset_code = code;
    db.last_reset_target = data.email || data.identificador || '';
    saveLocalDB(db);
    return { mensaje: 'Código de recuperación generado.', codigo_demo: code, reset_token: code };
  }

  if (pathname === '/auth/reset-password' && method === 'POST') {
    const u = db.usuarios.find(x =>
      (x.email || '').toLowerCase() === String(db.last_reset_target || '').toLowerCase() ||
      (x.username || '').toLowerCase() === String(db.last_reset_target || '').toLowerCase()
    ) || db.usuarios[0];
    const newPass = data.new_password || data.nueva_password;
    if (u && newPass) u.password = newPass;
    saveLocalDB(db);
    return { mensaje: 'Contraseña actualizada exitosamente.' };
  }

  if (pathname === '/auth/me' && method === 'GET') {
    return currentUser;
  }

  if (pathname === '/auth/usuarios' && method === 'GET') {
    return db.usuarios;
  }

  if (pathname === '/auth/usuarios' && method === 'POST') {
    const u = {
      id: nextId(db.usuarios),
      nombre: (data.nombre || '').trim(),
      username: (data.username || '').trim(),
      email: (data.email || '').trim(),
      rol: data.rol || 'vendedor',
      telefono: (data.telefono || '').trim(),
      activo: data.activo !== false && data.activo !== 'false',
      password: data.password || 'shiny123',
      ultimo_acceso: null,
      created_at: nowIso
    };
    db.usuarios.push(u);
    saveLocalDB(db);
    return { mensaje: 'Usuario registrado correctamente', usuario: u };
  }

  const userMatch = pathname.match(/^\/auth\/usuarios\/(\d+)$/);
  if (userMatch) {
    const uid = Number(userMatch[1]);
    const u = db.usuarios.find(x => Number(x.id) === uid);
    if (!u) throw new Error('Usuario no encontrado');
    if (method === 'PUT') {
      if (data.nombre !== undefined) u.nombre = data.nombre.trim();
      if (data.username !== undefined) u.username = data.username.trim();
      if (data.email !== undefined) u.email = data.email.trim();
      if (data.rol !== undefined) u.rol = data.rol;
      if (data.telefono !== undefined) u.telefono = data.telefono.trim();
      if (data.activo !== undefined) u.activo = data.activo !== false && data.activo !== 'false';
      if (data.password) u.password = data.password;
      saveLocalDB(db);
      return { mensaje: 'Usuario actualizado', usuario: u };
    }
    if (method === 'DELETE') {
      u.activo = false;
      saveLocalDB(db);
      return { mensaje: 'Usuario desactivado', usuario: u };
    }
  }

  // ==================== PRODUCTOS ====================
  if (pathname === '/productos/categorias' && method === 'GET') {
    return db.categorias;
  }
  if (pathname === '/productos/marcas' && method === 'GET') {
    return db.marcas;
  }
  if (pathname === '/productos/stock-critico' && method === 'GET') {
    return db.productos.filter(p => p.activo !== false && p.stock <= (p.stock_minimo ?? 5));
  }

  if (pathname === '/productos' && method === 'GET') {
    let list = [...db.productos];
    if (params.incluir_inactivos !== 'true') {
      list = list.filter(p => p.activo !== false);
    }
    if (params.categoria) {
      list = list.filter(p => matchesCategoryFilter(p, params.categoria));
    }
    if (params.linea) {
      list = list.filter(p => matchesCategoryFilter(p, params.linea));
    }
    if (params.marca) {
      const mNorm = normalizeText(params.marca);
      list = list.filter(p => normalizeText(p.marca) === mNorm || String(p.brand_id) === String(params.marca));
    }
    if (params.destacados === 'true') list = list.filter(p => p.es_destacado);
    if (params.nuevos === 'true') list = list.filter(p => p.es_nuevo);
    if (params.q) {
      const qn = normalizeText(params.q);
      list = list.filter(p => normalizeText(`${p.nombre} ${p.sku || ''} ${p.marca || ''} ${p.categoria || ''} ${p.descripcion || ''}`).includes(qn));
    }
    return list;
  }

  if (pathname === '/productos' && method === 'POST') {
    const nombre = String(data.nombre || '').trim();
    if (!nombre) throw new Error('El nombre del producto es obligatorio.');

    const marcaNombre = String(data.marca_nombre || data.marca || 'K-Beauty').trim();
    const catNombre = String(data.categoria_nombre || data.categoria || 'Skincare').trim();
    const linea = String(data.linea || 'Skincare').trim();

    if (marcaNombre && !db.marcas.some(b => normalizeText(b.nombre) === normalizeText(marcaNombre))) {
      db.marcas.push({ id: nextId(db.marcas), nombre: marcaNombre, pais_origen: 'Corea del Sur' });
    }
    if (catNombre && !db.categorias.some(c => normalizeText(c.nombre) === normalizeText(catNombre))) {
      db.categorias.push({ id: nextId(db.categorias), nombre: catNombre, linea, parent_id: linea === 'Makeup' ? 2 : 1 });
    }

    const newId = nextId(db.productos);
    const prefix = linea.toLowerCase() === 'makeup' ? 'MKP' : 'SKN';
    const catCode = normalizeText(catNombre).slice(0, 3).toUpperCase() || 'GEN';
    const sku = String(data.sku || '').trim() || `${prefix}-${catCode}-${String(newId).padStart(3, '0')}`;

    const fis = Math.max(0, parseInt(data.stock_fisico ?? data.stock ?? 0) || 0);
    const onl = Math.max(0, parseInt(data.stock_online ?? 0) || 0);

    const newProd = enrichProductComputed({
      id: newId,
      nombre,
      sku,
      marca: marcaNombre,
      categoria: catNombre,
      linea,
      tamano: String(data.tamano || '').trim(),
      tono: String(data.tono || '').trim(),
      fecha_vencimiento: String(data.fecha_vencimiento || '').trim(),
      precio_costo: parseFloat(data.precio_costo) || 0,
      porcentaje_ganancia: parseFloat(data.porcentaje_ganancia) || 0,
      precio_venta: parseFloat(data.precio_venta) || 0,
      descuento: parseFloat(data.descuento) || 0,
      stock_fisico: fis,
      stock_online: onl,
      stock_minimo: parseInt(data.stock_minimo) || 5,
      descripcion: String(data.descripcion || '').trim(),
      beneficios: String(data.beneficios || '').trim(),
      ingredientes: String(data.ingredientes || '').trim(),
      imagen_url: String(data.imagen_url || '').trim() || FALLBACK_PRODUCT_IMG,
      es_nuevo: data.es_nuevo === true || data.es_nuevo === 'true',
      es_destacado: data.es_destacado === true || data.es_destacado === 'true',
      activo: data.activo !== false && data.activo !== 'false',
      created_at: nowIso
    });

    db.productos.unshift(newProd);

    if (newProd.stock > 0) {
      db.movimientos.unshift({
        id: nextId(db.movimientos),
        product_id: newProd.id,
        producto: newProd.nombre,
        sku: newProd.sku,
        tipo: 'entrada',
        ubicacion: fis > 0 && onl > 0 ? 'ambos' : (fis > 0 ? 'fisico' : 'online'),
        cantidad: newProd.stock,
        stock_anterior: 0,
        stock_nuevo: newProd.stock,
        motivo: 'Stock inicial al registrar producto',
        usuario: currentUser.nombre,
        fecha: nowIso
      });
    }

    saveLocalDB(db);
    return { ...newProd, mensaje: 'Producto creado exitosamente', producto: newProd };
  }

  const prodMatch = pathname.match(/^\/productos\/(\d+)$/);
  if (prodMatch) {
    const pid = Number(prodMatch[1]);
    const prod = db.productos.find(x => Number(x.id) === pid);
    if (!prod) throw new Error('Producto no encontrado');

    if (method === 'GET') return prod;

    if (method === 'PUT') {
      if (data.nombre !== undefined) prod.nombre = String(data.nombre).trim();
      if (data.sku !== undefined && String(data.sku).trim()) prod.sku = String(data.sku).trim();
      if (data.marca_nombre !== undefined || data.marca !== undefined) prod.marca = String(data.marca_nombre || data.marca || prod.marca).trim();
      if (data.categoria_nombre !== undefined || data.categoria !== undefined) prod.categoria = String(data.categoria_nombre || data.categoria || prod.categoria).trim();
      if (data.linea !== undefined) prod.linea = data.linea;
      if (data.tamano !== undefined) prod.tamano = String(data.tamano).trim();
      if (data.tono !== undefined) prod.tono = String(data.tono).trim();
      if (data.fecha_vencimiento !== undefined) prod.fecha_vencimiento = String(data.fecha_vencimiento).trim();
      if (data.precio_costo !== undefined) prod.precio_costo = parseFloat(data.precio_costo) || 0;
      if (data.porcentaje_ganancia !== undefined) prod.porcentaje_ganancia = parseFloat(data.porcentaje_ganancia) || 0;
      if (data.precio_venta !== undefined) prod.precio_venta = parseFloat(data.precio_venta) || 0;
      if (data.descuento !== undefined) prod.descuento = parseFloat(data.descuento) || 0;
      if (data.stock_fisico !== undefined) prod.stock_fisico = parseInt(data.stock_fisico) || 0;
      if (data.stock_online !== undefined) prod.stock_online = parseInt(data.stock_online) || 0;
      if (data.stock_minimo !== undefined) prod.stock_minimo = parseInt(data.stock_minimo) || 5;
      if (data.descripcion !== undefined) prod.descripcion = String(data.descripcion).trim();
      if (data.beneficios !== undefined) prod.beneficios = String(data.beneficios).trim();
      if (data.ingredientes !== undefined) prod.ingredientes = String(data.ingredientes).trim();
      if (data.imagen_url) prod.imagen_url = String(data.imagen_url).trim();
      if (data.es_nuevo !== undefined) prod.es_nuevo = data.es_nuevo === true || data.es_nuevo === 'true';
      if (data.es_destacado !== undefined) prod.es_destacado = data.es_destacado === true || data.es_destacado === 'true';
      if (data.activo !== undefined) prod.activo = data.activo !== false && data.activo !== 'false';

      enrichProductComputed(prod);
      saveLocalDB(db);
      return { ...prod, mensaje: 'Producto actualizado correctamente', producto: prod };
    }

    if (method === 'DELETE') {
      prod.activo = false;
      saveLocalDB(db);
      return { ...prod, mensaje: 'Producto desactivado del catálogo', producto: prod };
    }
  }

  // ==================== INVENTARIO DUAL ====================
  if (pathname === '/inventario/movimientos' && method === 'GET') {
    let movs = [...db.movimientos];
    if (params.tipo) movs = movs.filter(m => m.tipo === params.tipo);
    if (params.ubicacion) movs = movs.filter(m => (m.ubicacion || '').includes(params.ubicacion));
    return movs;
  }

  if (pathname === '/inventario/resumen' && method === 'GET') {
    const activos = db.productos.filter(p => p.activo !== false);
    const criticos = activos.filter(p => p.stock_critico);
    const porVencer = activos.filter(p => p.por_vencer);
    const valorCosto = activos.reduce((s, p) => s + p.stock * p.precio_costo, 0);
    const valorVenta = activos.reduce((s, p) => s + p.stock * p.precio_final, 0);
    return {
      total_productos: activos.length,
      total_unidades: activos.reduce((s, p) => s + p.stock, 0),
      unidades_fisico: activos.reduce((s, p) => s + p.stock_fisico, 0),
      unidades_online: activos.reduce((s, p) => s + p.stock_online, 0),
      stock_critico_count: criticos.length,
      por_vencer_count: porVencer.length,
      valor_costo_total: valorCosto,
      valor_venta_total: valorVenta,
      ganancia_potencial: valorVenta - valorCosto,
      productos_criticos: criticos,
      productos_por_vencer: porVencer
    };
  }

  if (pathname === '/inventario/rotacion' && method === 'GET') {
    const vendidosMap = {};
    db.pedidos.filter(o => o.estado !== 'cancelado').forEach(o => {
      (o.items || []).forEach(it => {
        vendidosMap[it.product_id] = (vendidosMap[it.product_id] || 0) + (Number(it.cantidad) || 0);
      });
    });
    db.facturas.filter(f => f.estado !== 'anulada' && !f.order_id).forEach(f => {
      (f.items || []).forEach(it => {
        vendidosMap[it.product_id] = (vendidosMap[it.product_id] || 0) + (Number(it.cantidad) || 0);
      });
    });
    const activos = db.productos.filter(p => p.activo !== false).map(p => ({
      ...p,
      unidades_vendidas: vendidosMap[p.id] || 0
    }));
    const alta = activos.filter(p => p.unidades_vendidas > 0).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas);
    const estancado = activos.filter(p => p.unidades_vendidas === 0 && p.stock > 0);
    const porVencer = activos.filter(p => p.por_vencer);
    return {
      alta_rotacion: alta,
      baja_rotacion: estancado,
      stock_estancado: estancado,
      proximos_vencer: porVencer
    };
  }

  if (pathname === '/inventario/entrada' && method === 'POST') {
    const p = db.productos.find(x => Number(x.id) === Number(data.product_id));
    if (!p) throw new Error('Producto no encontrado');
    const cant = Math.max(1, parseInt(data.cantidad) || 0);
    const ubi = data.ubicacion === 'online' ? 'online' : 'fisico';
    const ant = p.stock;
    if (ubi === 'fisico') p.stock_fisico += cant;
    else p.stock_online += cant;
    enrichProductComputed(p);
    const mov = { id: nextId(db.movimientos), product_id: p.id, producto: p.nombre, sku: p.sku, tipo: 'entrada', ubicacion: ubi, cantidad: cant, stock_anterior: ant, stock_nuevo: p.stock, motivo: data.motivo || 'Entrada de mercadería', usuario: currentUser.nombre, fecha: nowIso };
    db.movimientos.unshift(mov);
    saveLocalDB(db);
    return { mensaje: 'Entrada registrada', producto: p, movimiento: mov };
  }

  if (pathname === '/inventario/salida' && method === 'POST') {
    const p = db.productos.find(x => Number(x.id) === Number(data.product_id));
    if (!p) throw new Error('Producto no encontrado');
    const cant = Math.max(1, parseInt(data.cantidad) || 0);
    const ubi = data.ubicacion === 'online' ? 'online' : 'fisico';
    const disp = ubi === 'fisico' ? p.stock_fisico : p.stock_online;
    if (cant > disp) throw new Error(`Stock insuficiente en ${ubi} (disponible: ${disp})`);
    const ant = p.stock;
    if (ubi === 'fisico') p.stock_fisico -= cant;
    else p.stock_online -= cant;
    enrichProductComputed(p);
    const mov = { id: nextId(db.movimientos), product_id: p.id, producto: p.nombre, sku: p.sku, tipo: 'salida', ubicacion: ubi, cantidad: cant, stock_anterior: ant, stock_nuevo: p.stock, motivo: data.motivo || 'Baja por merma/daño', usuario: currentUser.nombre, fecha: nowIso };
    db.movimientos.unshift(mov);
    saveLocalDB(db);
    return { mensaje: 'Salida registrada', producto: p, movimiento: mov };
  }

  if (pathname === '/inventario/traslado' && method === 'POST') {
    const p = db.productos.find(x => Number(x.id) === Number(data.product_id));
    if (!p) throw new Error('Producto no encontrado');
    const cant = Math.max(1, parseInt(data.cantidad) || 0);
    const orig = data.origen === 'online' ? 'online' : 'fisico';
    const dest = orig === 'fisico' ? 'online' : 'fisico';
    const disp = orig === 'fisico' ? p.stock_fisico : p.stock_online;
    if (cant > disp) throw new Error(`Stock insuficiente en ${orig} (disponible: ${disp})`);
    if (orig === 'fisico') { p.stock_fisico -= cant; p.stock_online += cant; }
    else { p.stock_online -= cant; p.stock_fisico += cant; }
    enrichProductComputed(p);
    const mov = { id: nextId(db.movimientos), product_id: p.id, producto: p.nombre, sku: p.sku, tipo: 'traslado', ubicacion: `${orig}->${dest}`, cantidad: cant, stock_anterior: p.stock, stock_nuevo: p.stock, motivo: data.motivo || `Traslado ${orig} a ${dest}`, usuario: currentUser.nombre, fecha: nowIso };
    db.movimientos.unshift(mov);
    saveLocalDB(db);
    return { mensaje: 'Traslado realizado', producto: p, movimiento: mov };
  }

  if (pathname === '/inventario/ajuste' && method === 'POST') {
    const p = db.productos.find(x => Number(x.id) === Number(data.product_id));
    if (!p) throw new Error('Producto no encontrado');
    const nStock = Math.max(0, parseInt(data.nuevo_stock ?? data.stock_nuevo) || 0);
    const ubi = data.ubicacion === 'online' ? 'online' : 'fisico';
    const ant = p.stock;
    if (ubi === 'fisico') p.stock_fisico = nStock;
    else p.stock_online = nStock;
    enrichProductComputed(p);
    const mov = { id: nextId(db.movimientos), product_id: p.id, producto: p.nombre, sku: p.sku, tipo: 'ajuste', ubicacion: ubi, cantidad: Math.abs(p.stock - ant), stock_anterior: ant, stock_nuevo: p.stock, motivo: data.motivo || 'Ajuste por conteo físico', usuario: currentUser.nombre, fecha: nowIso };
    db.movimientos.unshift(mov);
    saveLocalDB(db);
    return { mensaje: 'Ajuste aplicado', producto: p, movimiento: mov };
  }

  // ==================== PEDIDOS & MOTORIZADOS ====================
  if (pathname === '/pedidos/motorizados' && method === 'GET') {
    return db.motorizados;
  }
  if (pathname === '/pedidos/motorizados' && method === 'POST') {
    const m = { id: nextId(db.motorizados), nombre: data.nombre, telefono: data.telefono, empresa: data.empresa || 'Independiente', activo: true, pedidos_asignados: 0 };
    db.motorizados.push(m);
    saveLocalDB(db);
    return { mensaje: 'Motorizado registrado', motorizado: m };
  }
  if (pathname === '/pedidos/stats' && method === 'GET') {
    const valid = db.pedidos.filter(o => o.estado !== 'cancelado');
    return {
      total_pedidos: db.pedidos.length,
      pendientes: db.pedidos.filter(o => o.estado === 'pendiente').length,
      confirmados: db.pedidos.filter(o => o.estado === 'confirmado').length,
      en_camino: db.pedidos.filter(o => o.estado === 'en_camino').length,
      entregados: db.pedidos.filter(o => o.estado === 'entregado').length,
      cancelados: db.pedidos.filter(o => o.estado === 'cancelado').length,
      ingresos_totales: valid.reduce((s, o) => s + (o.total || 0), 0)
    };
  }

  const trackMatch = pathname.match(/^\/pedidos\/seguimiento\/(.+)$/);
  if (trackMatch && method === 'GET') {
    const code = decodeURIComponent(trackMatch[1]).trim().toUpperCase();
    const o = db.pedidos.find(x => (x.numero_pedido || '').toUpperCase() === code);
    if (!o) throw new Error(`No se encontró ningún pedido con el código ${code}`);
    return o;
  }

  if (pathname === '/pedidos' && method === 'GET') {
    let list = [...db.pedidos];
    if (params.estado) list = list.filter(o => o.estado === params.estado);
    if (params.canal) list = list.filter(o => o.canal === params.canal);
    if (params.q) {
      const qn = normalizeText(params.q);
      list = list.filter(o => normalizeText(`${o.numero_pedido} ${o.nombre_cliente} ${o.telefono_cliente || ''}`).includes(qn));
    }
    return list;
  }

  if (pathname === '/pedidos' && method === 'POST') {
    const itemsReq = Array.isArray(data.items) ? data.items : [];
    if (!itemsReq.length) throw new Error('El pedido debe incluir al menos un producto.');

    const oid = nextId(db.pedidos);
    const numPedido = `SS-${String(100 + oid).padStart(6, '0')}`;
    const canalPedido = data.canal || 'web';
    const estadoInicial = ['pendiente', 'confirmado', 'en_camino', 'entregado'].includes(data.estado)
      ? data.estado
      : 'pendiente';

    let subtotal = 0;
    const builtItems = [];
    itemsReq.forEach((it, idx) => {
      const p = db.productos.find(x => Number(x.id) === Number(it.product_id));
      const qty = Math.max(1, parseInt(it.cantidad) || 1);
      const price = p ? p.precio_final : (parseFloat(it.precio_unitario) || 0);
      if (p) {
        const stockAnt = p.stock;
        let ubiUsada = 'online';
        if (canalPedido === 'tienda_fisica') {
          p.stock_fisico = Math.max(0, p.stock_fisico - qty);
          ubiUsada = 'fisico';
        } else if (p.stock_online >= qty) {
          p.stock_online -= qty;
          ubiUsada = 'online';
        } else {
          const rem = qty - p.stock_online;
          p.stock_online = 0;
          p.stock_fisico = Math.max(0, p.stock_fisico - rem);
          ubiUsada = 'online+fisico';
        }
        enrichProductComputed(p);
        p._updated_at = Date.now();
        db.movimientos.unshift({
          id: nextId(db.movimientos),
          product_id: p.id,
          producto: p.nombre,
          sku: p.sku,
          tipo: 'salida',
          ubicacion: ubiUsada,
          cantidad: qty,
          stock_anterior: stockAnt,
          stock_nuevo: p.stock,
          motivo: `Venta Pedido ${numPedido} (${canalPedido})`,
          usuario: canalPedido === 'web' ? 'E-Commerce Web' : currentUser.nombre,
          fecha: nowIso,
          _updated_at: Date.now()
        });
      }
      subtotal += price * qty;
      builtItems.push({
        id: idx + 1,
        product_id: p ? p.id : it.product_id,
        nombre_producto: p ? p.nombre : (it.nombre_producto || 'Producto'),
        sku: p ? p.sku : '',
        cantidad: qty,
        precio_unitario: price,
        subtotal: price * qty
      });
    });

    const desc = parseFloat(data.descuento) || 0;
    const envio = parseFloat(data.costo_envio) || 0;
    const total = Math.max(0, subtotal - desc + envio);
    const pagoCli = parseFloat(data.monto_pago_cliente) || null;
    const cambio = pagoCli && pagoCli > total ? pagoCli - total : 0;

    let motoObj = null;
    if (data.motorizado_id) {
      motoObj = db.motorizados.find(x => Number(x.id) === Number(data.motorizado_id)) || null;
    }

    const newOrder = {
      id: oid,
      numero_pedido: numPedido,
      nombre_cliente: data.nombre_cliente || 'Cliente Shiny Skin',
      telefono_cliente: data.telefono_cliente || '',
      email_cliente: data.email_cliente || '',
      metodo_entrega: data.metodo_entrega || 'domicilio',
      direccion_entrega: data.direccion_entrega || 'Managua, Nicaragua',
      estado: estadoInicial,
      motorizado_id: motoObj ? motoObj.id : null,
      motorizado_nombre: motoObj ? motoObj.nombre : null,
      motorizado_telefono: motoObj ? motoObj.telefono : null,
      subtotal,
      descuento: desc,
      costo_envio: envio,
      iva: 0,
      total,
      metodo_pago: data.metodo_pago || 'efectivo_entrega',
      monto_pago_cliente: pagoCli,
      cambio_entregar: cambio,
      notas: data.notas || '',
      canal: canalPedido,
      factura_id: null,
      numero_factura: null,
      fecha: nowIso,
      items: builtItems,
      historial: [{
        id: 1,
        estado_anterior: null,
        estado_nuevo: estadoInicial,
        observacion: canalPedido === 'web' ? 'Pedido recibido desde E-Commerce Web' : `Pedido registrado (${canalPedido})`,
        fecha: nowIso
      }],
      _updated_at: Date.now()
    };
    db.pedidos.unshift(newOrder);

    // Upsert cliente en cartera
    if (newOrder.nombre_cliente) {
      const existingCli = db.clientes.find(c => normalizeText(c.nombre) === normalizeText(newOrder.nombre_cliente) || (newOrder.telefono_cliente && c.telefono === newOrder.telefono_cliente));
      if (!existingCli) {
        db.clientes.unshift({
          id: nextId(db.clientes),
          nombre: newOrder.nombre_cliente,
          telefono: newOrder.telefono_cliente,
          email: newOrder.email_cliente,
          direccion: newOrder.direccion_entrega,
          notas: `Registrado desde pedido ${numPedido}`,
          _updated_at: Date.now()
        });
      }
    }

    saveLocalDB(db);
    return { ...newOrder, mensaje: 'Pedido creado exitosamente', pedido: newOrder };
  }

  const orderStateMatch = pathname.match(/^\/pedidos\/(\d+)\/estado$/);
  if (orderStateMatch && method === 'PUT') {
    const oid = Number(orderStateMatch[1]);
    const o = db.pedidos.find(x => Number(x.id) === oid);
    if (!o) throw new Error('Pedido no encontrado');
    const ant = o.estado;
    const nuevo = data.estado;
    if (nuevo === 'cancelado' && ant !== 'cancelado') {
      (o.items || []).forEach(it => {
        const p = db.productos.find(x => Number(x.id) === Number(it.product_id));
        if (p) {
          const stockAnt = p.stock;
          const qty = Number(it.cantidad) || 0;
          const ubi = o.canal === 'tienda_fisica' ? 'fisico' : 'online';
          if (ubi === 'fisico') p.stock_fisico += qty;
          else p.stock_online += qty;
          enrichProductComputed(p);
          p._updated_at = Date.now();
          db.movimientos.unshift({
            id: nextId(db.movimientos),
            product_id: p.id,
            producto: p.nombre,
            sku: p.sku,
            tipo: 'entrada',
            ubicacion: ubi,
            cantidad: qty,
            stock_anterior: stockAnt,
            stock_nuevo: p.stock,
            motivo: `Devolución por cancelación de pedido ${o.numero_pedido}`,
            usuario: currentUser.nombre,
            fecha: nowIso,
            _updated_at: Date.now()
          });
        }
      });
    }
    o.estado = nuevo;
    if (data.motorizado_id !== undefined) {
      if (data.motorizado_id) {
        const m = db.motorizados.find(x => Number(x.id) === Number(data.motorizado_id));
        if (m) { o.motorizado_id = m.id; o.motorizado_nombre = m.nombre; o.motorizado_telefono = m.telefono; }
      } else {
        o.motorizado_id = null; o.motorizado_nombre = null; o.motorizado_telefono = null;
      }
    }
    o.historial = o.historial || [];
    o.historial.push({ id: o.historial.length + 1, estado_anterior: ant, estado_nuevo: nuevo, observacion: data.observacion || `Cambio a ${nuevo}`, fecha: nowIso });
    o._updated_at = Date.now();
    saveLocalDB(db);
    return { ...o, mensaje: 'Estado actualizado', pedido: o };
  }

  const orderMotoMatch = pathname.match(/^\/pedidos\/(\d+)\/motorizado$/);
  if (orderMotoMatch && method === 'PUT') {
    const oid = Number(orderMotoMatch[1]);
    const o = db.pedidos.find(x => Number(x.id) === oid);
    if (!o) throw new Error('Pedido no encontrado');
    const m = db.motorizados.find(x => Number(x.id) === Number(data.motorizado_id));
    o.motorizado_id = m ? m.id : null;
    o.motorizado_nombre = m ? m.nombre : null;
    o.motorizado_telefono = m ? m.telefono : null;
    if (data.estado) o.estado = data.estado;
    o._updated_at = Date.now();
    saveLocalDB(db);
    return { ...o, mensaje: 'Motorizado asignado', pedido: o };
  }

  const orderIdMatch = pathname.match(/^\/pedidos\/(\d+)$/);
  if (orderIdMatch && method === 'GET') {
    const o = db.pedidos.find(x => Number(x.id) === Number(orderIdMatch[1]));
    if (!o) throw new Error('Pedido no encontrado');
    return o;
  }

  // ==================== FACTURAS / POS ====================
  if (pathname === '/facturas/stats' && method === 'GET') {
    const pagadas = db.facturas.filter(f => f.estado === 'pagada');
    return {
      total_facturas: db.facturas.length,
      pagadas: pagadas.length,
      emitidas: db.facturas.filter(f => f.estado === 'emitida').length,
      anuladas: db.facturas.filter(f => f.estado === 'anulada').length,
      total_facturado: pagadas.reduce((s, f) => s + (f.total || 0), 0)
    };
  }

  if (pathname === '/facturas' && method === 'GET') {
    let list = [...db.facturas];
    if (params.estado) list = list.filter(f => f.estado === params.estado);
    if (params.canal) list = list.filter(f => f.canal === params.canal);
    if (params.q) {
      const qn = normalizeText(params.q);
      list = list.filter(f => normalizeText(`${f.numero_factura} ${f.nombre_cliente} ${f.numero_pedido || ''}`).includes(qn));
    }
    return list;
  }

  if (pathname === '/facturas' && method === 'POST') {
    const fid = nextId(db.facturas);
    const numFac = `FAC-${String(fid).padStart(6, '0')}`;
    let subtotal = 0;
    let descMonto = 0;
    let total = 0;
    let itemsFac = [];
    let linkedOrder = null;

    if (data.order_id) {
      linkedOrder = db.pedidos.find(o => Number(o.id) === Number(data.order_id));
      if (!linkedOrder) throw new Error('Pedido no encontrado para facturar');
      subtotal = linkedOrder.subtotal;
      descMonto = linkedOrder.descuento || 0;
      total = linkedOrder.total;
      itemsFac = (linkedOrder.items || []).map(it => ({ ...it, descuento: 0 }));
      linkedOrder.factura_id = fid;
      linkedOrder.numero_factura = numFac;
      linkedOrder._updated_at = Date.now();
    } else {
      const reqItems = Array.isArray(data.items) ? data.items : [];
      if (!reqItems.length) throw new Error('Agrega al menos un producto para emitir la factura.');
      reqItems.forEach((it, idx) => {
        const p = db.productos.find(x => Number(x.id) === Number(it.product_id));
        const qty = Math.max(1, parseInt(it.cantidad) || 1);
        const price = p ? p.precio_final : (parseFloat(it.precio_unitario) || 0);
        if (p) {
          if (data.canal === 'online') p.stock_online = Math.max(0, p.stock_online - qty);
          else p.stock_fisico = Math.max(0, p.stock_fisico - qty);
          enrichProductComputed(p);
          p._updated_at = Date.now();
        }
        subtotal += price * qty;
        itemsFac.push({ id: idx + 1, product_id: p ? p.id : it.product_id, nombre_producto: p ? p.nombre : 'Producto', sku: p ? p.sku : '', cantidad: qty, precio_unitario: price, descuento: 0, subtotal: price * qty });
      });
      const rawDesc = parseFloat(data.descuento) || 0;
      descMonto = data.tipo_descuento === 'porcentaje' ? Math.round(subtotal * Math.min(100, rawDesc)) / 100 : Math.min(subtotal, rawDesc);
      total = Math.max(0, subtotal - descMonto);
    }

    const recibido = parseFloat(data.monto_recibido) || null;
    const cambio = recibido && recibido > total ? recibido - total : 0;

    const newFac = {
      id: fid,
      numero_factura: numFac,
      order_id: linkedOrder ? linkedOrder.id : null,
      numero_pedido: linkedOrder ? linkedOrder.numero_pedido : null,
      nombre_cliente: data.nombre_cliente || (linkedOrder ? linkedOrder.nombre_cliente : 'Consumidor Final'),
      telefono_cliente: data.telefono_cliente || (linkedOrder ? linkedOrder.telefono_cliente : ''),
      email_cliente: data.email_cliente || (linkedOrder ? linkedOrder.email_cliente : ''),
      canal: data.canal || (linkedOrder && linkedOrder.canal !== 'tienda_fisica' ? 'online' : 'colectivo'),
      tipo_descuento: data.tipo_descuento || 'monto',
      subtotal,
      descuento: descMonto,
      iva: 0,
      total,
      metodo_pago: data.metodo_pago || 'efectivo',
      monto_recibido: recibido,
      cambio,
      estado: 'pagada',
      notas: data.notas || '',
      emisor: currentUser.nombre,
      fecha: nowIso,
      items: itemsFac,
      _updated_at: Date.now()
    };
    db.facturas.unshift(newFac);
    saveLocalDB(db);
    return { ...newFac, mensaje: 'Factura emitida exitosamente', factura: newFac };
  }

  const facStateMatch = pathname.match(/^\/facturas\/(\d+)\/estado$/);
  if (facStateMatch && method === 'PUT') {
    const f = db.facturas.find(x => Number(x.id) === Number(facStateMatch[1]));
    if (!f) throw new Error('Factura no encontrada');
    if (data.estado === 'anulada' && f.estado !== 'anulada' && !f.order_id) {
      (f.items || []).forEach(it => {
        const p = db.productos.find(x => Number(x.id) === Number(it.product_id));
        if (p) {
          p.stock_fisico += Number(it.cantidad) || 0;
          enrichProductComputed(p);
        }
      });
    }
    f.estado = data.estado;
    if (data.motivo_anulacion) f.motivo_anulacion = data.motivo_anulacion;
    saveLocalDB(db);
    return { ...f, mensaje: 'Estado de factura actualizado', factura: f };
  }

  const facIdMatch = pathname.match(/^\/facturas\/(\d+)$/);
  if (facIdMatch && method === 'GET') {
    const f = db.facturas.find(x => Number(x.id) === Number(facIdMatch[1]));
    if (!f) throw new Error('Factura no encontrada');
    return f;
  }

  // ==================== CLIENTES ====================
  if (pathname === '/clientes' && method === 'GET') {
    let list = db.clientes.map(c => {
      const peds = db.pedidos.filter(o => o.estado !== 'cancelado' && (o.client_id === c.id || normalizeText(o.nombre_cliente) === normalizeText(c.nombre)));
      return {
        ...c,
        cantidad_pedidos: peds.length,
        total_compras: peds.reduce((s, o) => s + (o.total || 0), 0)
      };
    });
    if (params.q) {
      const qn = normalizeText(params.q);
      list = list.filter(c => normalizeText(`${c.nombre} ${c.telefono || ''} ${c.email || ''}`).includes(qn));
    }
    return list;
  }

  if (pathname === '/clientes' && method === 'POST') {
    const c = { id: nextId(db.clientes), nombre: data.nombre, telefono: data.telefono || '', email: data.email || '', direccion: data.direccion || '', notas: data.notas || '', created_at: nowIso };
    db.clientes.unshift(c);
    saveLocalDB(db);
    return { ...c, mensaje: 'Cliente registrado', cliente: c };
  }

  const cliMatch = pathname.match(/^\/clientes\/(\d+)$/);
  if (cliMatch) {
    const cid = Number(cliMatch[1]);
    const c = db.clientes.find(x => Number(x.id) === cid);
    if (!c) throw new Error('Cliente no encontrado');
    if (method === 'GET') {
      const peds = db.pedidos.filter(o => o.client_id === c.id || normalizeText(o.nombre_cliente) === normalizeText(c.nombre));
      return { ...c, cantidad_pedidos: peds.length, total_compras: peds.reduce((s, o) => s + (o.total || 0), 0), pedidos: peds };
    }
    if (method === 'PUT') {
      Object.assign(c, { nombre: data.nombre ?? c.nombre, telefono: data.telefono ?? c.telefono, email: data.email ?? c.email, direccion: data.direccion ?? c.direccion, notas: data.notas ?? c.notas });
      saveLocalDB(db);
      return { ...c, mensaje: 'Cliente actualizado', cliente: c };
    }
    if (method === 'DELETE') {
      db.clientes = db.clientes.filter(x => Number(x.id) !== cid);
      saveLocalDB(db);
      return { mensaje: 'Cliente eliminado' };
    }
  }

  // ==================== GASTOS OPERATIVOS ====================
  if (pathname === '/gastos' && method === 'GET') {
    let list = [...db.gastos];
    if (params.mes) list = list.filter(g => (g.fecha || '').startsWith(params.mes));
    if (params.categoria) list = list.filter(g => g.categoria_gasto === params.categoria);
    return list;
  }

  if (pathname === '/gastos/resumen' && method === 'GET') {
    const totalHist = db.gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    let list = [...db.gastos];
    if (params.mes) list = list.filter(g => (g.fecha || '').startsWith(params.mes));
    const porCatMap = {};
    list.forEach(g => { porCatMap[g.categoria_gasto] = (porCatMap[g.categoria_gasto] || 0) + (Number(g.monto) || 0); });
    const porCatArr = Object.entries(porCatMap).map(([categoria, monto]) => ({ categoria, monto }));
    const totalMes = list.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    return {
      total_mes: totalMes,
      total_gastos: totalMes,
      total_historico: totalHist,
      cantidad_registros: list.length,
      por_categoria: porCatArr
    };
  }

  if (pathname === '/gastos' && method === 'POST') {
    const g = { id: nextId(db.gastos), categoria_gasto: data.categoria_gasto || 'OTRO', concepto: data.concepto, monto: parseFloat(data.monto) || 0, fecha: data.fecha || nowIso.slice(0, 10), notas: data.notas || '', usuario: currentUser.nombre };
    db.gastos.unshift(g);
    saveLocalDB(db);
    return { ...g, mensaje: 'Gasto registrado', gasto: g };
  }

  const gastoMatch = pathname.match(/^\/gastos\/(\d+)$/);
  if (gastoMatch) {
    const gid = Number(gastoMatch[1]);
    const g = db.gastos.find(x => Number(x.id) === gid);
    if (!g) throw new Error('Gasto no encontrado');
    if (method === 'PUT') {
      Object.assign(g, { categoria_gasto: data.categoria_gasto ?? g.categoria_gasto, concepto: data.concepto ?? g.concepto, monto: parseFloat(data.monto ?? g.monto) || 0, fecha: data.fecha ?? g.fecha, notas: data.notas ?? g.notas });
      saveLocalDB(db);
      return { ...g, mensaje: 'Gasto actualizado', gasto: g };
    }
    if (method === 'DELETE') {
      db.gastos = db.gastos.filter(x => Number(x.id) !== gid);
      saveLocalDB(db);
      return { mensaje: 'Gasto eliminado' };
    }
  }

  // ==================== DASHBOARD ====================
  if (pathname === '/dashboard/kpis' && method === 'GET') {
    const todayPrefix = nowIso.slice(0, 10);
    const validOrders = db.pedidos.filter(o => o.estado !== 'cancelado');
    const directFacs = db.facturas.filter(f => f.estado !== 'anulada' && !f.order_id);
    const ventasRegistros = validOrders.reduce((s, o) => s + (o.total || 0), 0) + directFacs.reduce((s, f) => s + (f.total || 0), 0);
    const ventasHoy = validOrders.filter(o => (o.fecha || '').startsWith(todayPrefix)).reduce((s, o) => s + (o.total || 0), 0)
      + directFacs.filter(f => (f.fecha || '').startsWith(todayPrefix)).reduce((s, f) => s + (f.total || 0), 0);
    const baseHistoricoMes = 21520; // Ventas acumuladas de las semanas previas del mes
    const ventasMes = baseHistoricoMes + ventasRegistros;
    const gastosMes = db.gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    const activos = db.productos.filter(p => p.activo !== false);
    return {
      ventas_hoy: ventasHoy || ventasRegistros,
      ventas_mes: ventasMes,
      gastos_mes: gastosMes,
      balance_mes: ventasMes - gastosMes,
      pedidos_pendientes: db.pedidos.filter(o => o.estado === 'pendiente').length,
      pedidos_hoy: db.pedidos.filter(o => (o.fecha || '').startsWith(todayPrefix)).length || db.pedidos.length,
      total_productos: activos.length,
      stock_critico: activos.filter(p => p.stock_critico).length,
      facturas_pendientes: db.facturas.filter(f => f.estado === 'emitida').length,
      total_clientes: db.clientes.length
    };
  }

  if (pathname === '/dashboard/ventas-semana' && method === 'GET') {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const baseDiasPrevios = [2840, 3520, 2190, 4120, 3890, 4960];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const totalDia = db.pedidos.filter(o => o.estado !== 'cancelado' && (o.fecha || '').startsWith(ds)).reduce((s, o) => s + (o.total || 0), 0)
        + db.facturas.filter(f => f.estado !== 'anulada' && !f.order_id && (f.fecha || '').startsWith(ds)).reduce((s, f) => s + (f.total || 0), 0);
      const fallbackDia = i > 0 ? baseDiasPrevios[6 - i] : 2120;
      result.push({
        fecha: `${dias[d.getDay()]} ${d.getDate()}`,
        dia: `${dias[d.getDay()]} ${d.getDate()}`,
        total: totalDia > 0 ? totalDia : fallbackDia
      });
    }
    return result;
  }

  if (pathname === '/dashboard/top-productos' && method === 'GET') {
    const map = {
      'ANUA Heartleaf 77% Soothing Serum': { producto: 'ANUA Heartleaf 77% Soothing Serum', nombre: 'ANUA Heartleaf 77% Soothing Serum', total_vendido: 8, ingresos: 5760 },
      'Purito Daily Go-To Sunscreen SPF50+ PA++++': { producto: 'Purito Daily Go-To Sunscreen SPF50+ PA++++', nombre: 'Purito Daily Go-To Sunscreen SPF50+ PA++++', total_vendido: 6, ingresos: 4080 },
      'COSRX Advanced Snail 96 Mucin Essence': { producto: 'COSRX Advanced Snail 96 Mucin Essence', nombre: 'COSRX Advanced Snail 96 Mucin Essence', total_vendido: 5, ingresos: 2635 },
      'rom&nd Juicy Lasting Tint – 21 Grab Cherry': { producto: 'rom&nd Juicy Lasting Tint – 21 Grab Cherry', nombre: 'rom&nd Juicy Lasting Tint – 21 Grab Cherry', total_vendido: 5, ingresos: 2800 },
      'Numbuzin No.5 Vitamin Niacinamide Serum': { producto: 'Numbuzin No.5 Vitamin Niacinamide Serum', nombre: 'Numbuzin No.5 Vitamin Niacinamide Serum', total_vendido: 4, ingresos: 3560 },
    };
    db.pedidos.filter(o => o.estado !== 'cancelado').forEach(o => {
      (o.items || []).forEach(it => {
        const key = it.nombre_producto || 'Producto K-Beauty';
        if (!map[key]) map[key] = { producto: key, nombre: key, total_vendido: 0, ingresos: 0 };
        map[key].total_vendido += Number(it.cantidad) || 0;
        map[key].ingresos += Number(it.subtotal) || 0;
      });
    });
    db.facturas.filter(f => f.estado !== 'anulada' && !f.order_id).forEach(f => {
      (f.items || []).forEach(it => {
        const key = it.nombre_producto || 'Producto K-Beauty';
        if (!map[key]) map[key] = { producto: key, nombre: key, total_vendido: 0, ingresos: 0 };
        map[key].total_vendido += Number(it.cantidad) || 0;
        map[key].ingresos += Number(it.subtotal) || 0;
      });
    });
    return Object.values(map).sort((a, b) => b.total_vendido - a.total_vendido).slice(0, 5);
  }

  if (pathname === '/dashboard/stock-critico' && method === 'GET') {
    return db.productos.filter(p => p.activo !== false && p.stock_critico);
  }

  return {};
}

// ---- HTTP client con Fallback Automático a Persistencia Local y GitHub Pages ----
async function request(method, path, body = null, auth = false) {
  const host = (window.location.hostname || '').toLowerCase();
  if (host.endsWith('github.io') || host.endsWith('netlify.app') || host.endsWith('vercel.app') || host.endsWith('pages.dev')) {
    return await handleLocalApi(method, path, body);
  }

  const headers = {};
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = localStorage.getItem('sisco_token');
  if (auth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (token && method !== 'GET') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (body) {
    opts.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (netErr) {
    // Si el servidor Python/Flask no está corriendo, procesa y persiste en localStorage automáticamente
    return await handleLocalApi(method, path, body);
  }

  if (!res.ok) {
    // En servidores estáticos (GitHub Pages / Live Server) o con token local, usa el motor local
    const contentType = res.headers.get('content-type') || '';
    if (res.status === 405 || (res.status === 404 && !contentType.includes('application/json'))) {
      return await handleLocalApi(method, path, body);
    }
    if (res.status === 401 || res.status === 422) {
      if (token && (token.startsWith('local_jwt_') || token === 'demo_token')) {
        return await handleLocalApi(method, path, body);
      }
    }
    const errBody = await res.json().catch(() => ({}));
    const e = new Error(errBody.error || errBody.msg || `Error HTTP ${res.status}`);
    e.status = res.status;
    e.isNetworkError = false;
    throw e;
  }
  return res.json();
}

function buildQuery(params = {}) {
  const clean = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') clean[k] = v;
  });
  const qs = new URLSearchParams(clean).toString();
  return qs ? `?${qs}` : '';
}

const api = {
  get:    (path, auth = false)       => request('GET',    path, null, auth),
  post:   (path, body, auth = false) => request('POST',   path, body, auth),
  put:    (path, body, auth = false) => request('PUT',    path, body, auth),
  delete: (path, auth = false)       => request('DELETE', path, null, auth),

  // ---- Auth & Usuarios ----
  auth: {
    login:          (data)     => api.post('/auth/login', data),
    register:       (data)     => api.post('/auth/register', data),
    forgotPassword: (data)     => api.post('/auth/forgot-password', data),
    resetPassword:  (data)     => api.post('/auth/reset-password', data),
    me:             ()         => api.get('/auth/me', true),
    usuarios:       ()         => api.get('/auth/usuarios', true),
    createUsuario:  (data)     => api.post('/auth/usuarios', data, true),
    updateUsuario:  (id, data) => api.put(`/auth/usuarios/${id}`, data, true),
    deleteUsuario:  (id)       => api.delete(`/auth/usuarios/${id}`, true),
  },

  // ---- Productos ----
  productos: {
    list:         (params = {}) => api.get('/productos/' + buildQuery(params)),
    get:          (id)          => api.get(`/productos/${id}`),
    create:       (data)        => api.post('/productos/', data, true),
    update:       (id, data)    => api.put(`/productos/${id}`, data, true),
    delete:       (id)          => api.delete(`/productos/${id}`, true),
    categorias:   ()            => api.get('/productos/categorias'),
    marcas:       ()            => api.get('/productos/marcas'),
    stockCritico: ()            => api.get('/productos/stock-critico'),
  },

  // ---- Pedidos & Motorizados ----
  pedidos: {
    list:             (params = {}) => api.get('/pedidos/' + buildQuery(params)),
    get:              (id)          => api.get(`/pedidos/${id}`),
    seguimiento:      (codigo)      => api.get(`/pedidos/seguimiento/${encodeURIComponent(codigo)}`),
    create:           (data)        => api.post('/pedidos/', data),
    updateEstado:     (id, estado, extra = {}) => api.put(`/pedidos/${id}/estado`, { estado, ...extra }, true),
    assignMotorizado: (id, data)    => api.put(`/pedidos/${id}/motorizado`, data, true),
    motorizados:      (activos = true) => api.get(`/pedidos/motorizados?activos=${activos}`),
    createMotorizado: (data)        => api.post('/pedidos/motorizados', data, true),
    updateMotorizado: (id, data)    => api.put(`/pedidos/motorizados/${id}`, data, true),
    stats:            ()            => api.get('/pedidos/stats', true),
  },

  // ---- Facturas / POS ----
  facturas: {
    list:         (params = {}) => api.get('/facturas/' + buildQuery(params)),
    get:          (id)          => api.get(`/facturas/${id}`, true),
    create:       (data)        => api.post('/facturas/', data, true),
    updateEstado: (id, estado, extra = {}) => api.put(`/facturas/${id}/estado`, { estado, ...extra }, true),
    stats:        ()            => api.get('/facturas/stats', true),
    pdfUrl:       (id, download = false) => `${API_BASE}/facturas/${id}/pdf${download ? '?download=1' : ''}`,
  },

  // ---- Inventario Dual ----
  inventario: {
    movimientos: (params = {}) => api.get('/inventario/movimientos' + buildQuery(params)),
    entrada:     (data)        => api.post('/inventario/entrada', data, true),
    salida:      (data)        => api.post('/inventario/salida', data, true),
    traslado:    (data)        => api.post('/inventario/traslado', data, true),
    ajuste:      (data)        => api.post('/inventario/ajuste', data, true),
    resumen:     ()            => api.get('/inventario/resumen'),
    rotacion:    ()            => api.get('/inventario/rotacion', true),
  },

  // ---- Cartera de Clientes ----
  clientes: {
    list:   (params = {}) => api.get('/clientes/' + buildQuery(params), true),
    get:    (id)          => api.get(`/clientes/${id}`, true),
    create: (data)        => api.post('/clientes/', data, true),
    update: (id, data)    => api.put(`/clientes/${id}`, data, true),
    delete: (id)          => api.delete(`/clientes/${id}`, true),
  },

  // ---- Gastos Operativos ----
  gastos: {
    list:    (params = {}) => api.get('/gastos/' + buildQuery(params), true),
    resumen: (params = {}) => api.get('/gastos/resumen' + buildQuery(params), true),
    create:  (data)        => api.post('/gastos/', data, true),
    update:  (id, data)    => api.put(`/gastos/${id}`, data, true),
    delete:  (id)          => api.delete(`/gastos/${id}`, true),
  },

  // ---- Dashboard ----
  dashboard: {
    kpis:         () => api.get('/dashboard/kpis', true),
    ventasSemana: () => api.get('/dashboard/ventas-semana', true),
    topProductos: () => api.get('/dashboard/top-productos', true),
    stockCritico: () => api.get('/dashboard/stock-critico', true),
  },
};

async function fetchProductos(params = {}) {
  return await api.productos.list(params);
}
async function fetchKPIs() {
  return await api.dashboard.kpis();
}
async function fetchPedidos(params = {}) {
  return await api.pedidos.list(params);
}

// ---- Utilidades Globales ----
function normalizeText(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const SKINCARE_SUBCATS = ['limpiadores', 'sueros & esencias', 'serums', 'hidratantes & cremas', 'hidratantes', 'protectores solares', 'mascarillas', 'tonicos'];
const MAKEUP_SUBCATS = ['labios', 'rostro', 'cejas & ojos', 'ojos'];

function matchesCategoryFilter(product, filterValue) {
  if (!filterValue) return true;
  const f = normalizeText(filterValue);
  const prodCat = normalizeText(product.categoria);
  const prodLinea = normalizeText(product.linea);

  if (f === 'skincare') {
    return prodLinea === 'skincare' || prodCat === 'skincare' || SKINCARE_SUBCATS.some(s => prodCat.includes(s));
  }
  if (f === 'makeup' || f === 'maquillaje') {
    return prodLinea === 'makeup' || prodCat === 'makeup' || MAKEUP_SUBCATS.some(s => prodCat.includes(s));
  }
  if (f === 'serums' || f === 'sueros' || f.includes('sueros')) {
    return prodCat.includes('suero') || prodCat.includes('serum') || prodCat.includes('esencia');
  }
  if (f.includes('hidratante')) {
    return prodCat.includes('hidratante') || prodCat.includes('crema');
  }
  if (f.includes('protector')) {
    return prodCat.includes('protector') || prodCat.includes('solar');
  }
  return prodCat === f || prodCat.includes(f) || f.includes(prodCat && prodCat.length > 3 ? prodCat : '___');
}

function resolveImageUrl(url) {
  if (!url || typeof url !== 'string') return FALLBACK_PRODUCT_IMG;
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('google.com/search')) return FALLBACK_PRODUCT_IMG;
  if (trimmed.startsWith('data:image/')) return trimmed;
  if (trimmed.startsWith('/uploads/')) return `${BACKEND_ORIGIN}${trimmed}`;
  return trimmed;
}

function handleImgError(imgEl) {
  if (imgEl && imgEl.src !== FALLBACK_PRODUCT_IMG) {
    imgEl.src = FALLBACK_PRODUCT_IMG;
  }
}

function formatCurrency(amount) {
  return 'C$ ' + Number(amount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? String(isoStr) : d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return isNaN(d.getTime()) ? String(isoStr) : d.toLocaleString('es-NI', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function showToast(msg, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '⚠️', info: '✨' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || '✨'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3400);
}

// ---- Carrito compartido con control de stock y Cupones Promocionales ----
function getCart() {
  try {
    const raw = localStorage.getItem('sisco_cart');
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  try {
    const db = getLocalDB();
    if (Array.isArray(db._cart)) return db._cart;
  } catch {}
  return [];
}
function saveCart(cart) {
  const safeCart = Array.isArray(cart) ? cart : [];
  try { localStorage.setItem('sisco_cart', JSON.stringify(safeCart)); } catch {}
  try {
    const db = getLocalDB();
    db._cart = safeCart;
    db._cart_updated_at = Date.now();
    saveLocalDB(db, { silent: true });
  } catch {}
  updateCartBadge();
}
function updateCartBadge() {
  const cart = getCart();
  const count = cart.reduce((s, i) => s + Number(i.cantidad || 0), 0);
  document.querySelectorAll('#cartBadge, .cart-badge').forEach(badge => {
    badge.textContent = count;
    badge.classList.toggle('visible', count > 0);
  });
}

const VALID_COUPONS = {
  SHINY10: { code: 'SHINY10', pct: 10, label: '10% OFF Bienvenida Shiny Skin' },
  VIP15:   { code: 'VIP15',   pct: 15, label: '15% OFF Clienta VIP K-Beauty' },
  KBEAUTY: { code: 'KBEAUTY', pct: 10, label: '10% OFF Rutina Coreana' },
};

function getAppliedCoupon() {
  try {
    const c = JSON.parse(localStorage.getItem('sisco_coupon') || 'null');
    if (c && VALID_COUPONS[c.code]) return VALID_COUPONS[c.code];
  } catch {}
  return null;
}

function applyPromoCoupon(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    showToast('Ingresa un código promocional.', 'error');
    return null;
  }
  const found = VALID_COUPONS[code];
  if (!found) {
    showToast('Cupón inválido. Prueba con SHINY10 o VIP15.', 'error');
    return null;
  }
  localStorage.setItem('sisco_coupon', JSON.stringify(found));
  showToast(`🎉 Cupón ${found.code} aplicado: ${found.label}`, 'success');
  return found;
}

function clearPromoCoupon() {
  localStorage.removeItem('sisco_coupon');
  showToast('Cupón promocional retirado', 'info');
}

// ---- Navegación pública, sesión, Rastreo de Pedido y Test de Piel K-Beauty ----
function toggleMobileNav() {
  const nav = document.querySelector('.navbar-nav');
  if (nav) nav.classList.toggle('open');
}

async function openTrackingModal(prefill = '') {
  let modal = document.getElementById('globalTrackingModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'globalTrackingModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-header">
          <div class="modal-title">📦 Rastrear mi pedido y Mis Compras</div>
          <button class="modal-close" onclick="document.getElementById('globalTrackingModal').classList.remove('active')">✕</button>
        </div>
        <p style="font-size:0.86rem;color:var(--color-text-muted);margin-bottom:12px;">Ingresa tu código de pedido (ej: <strong>SS-000101</strong>) o selecciona uno de tus pedidos recientes:</p>
        <form onsubmit="submitOrderTracking(event)" style="display:flex;gap:8px;margin-bottom:12px;">
          <input type="text" id="trackingCodeInput" class="form-control" placeholder="Ej. SS-000101" required />
          <button type="submit" class="btn btn-primary btn-sm">Consultar</button>
        </form>
        <div id="recentOrdersQuickPills" style="margin-bottom:14px;"></div>
        <div id="trackingResultBox"></div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
    document.body.appendChild(modal);
  }
  modal.classList.add('active');

  // Mostrar acceso rápido a pedidos recientes ("Mis Pedidos")
  try {
    const orders = await fetchPedidos();
    const pillsBox = document.getElementById('recentOrdersQuickPills');
    if (pillsBox && orders && orders.length) {
      pillsBox.innerHTML = `
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:6px;font-weight:600;">📋 Mis pedidos recientes (clic para ver detalle):</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${orders.slice(0, 5).map(o => `
            <button type="button" class="badge badge-primary" style="cursor:pointer;border:none;padding:5px 10px;" onclick="document.getElementById('trackingCodeInput').value='${o.numero_pedido}';submitOrderTracking();">
              ${o.numero_pedido} · ${formatCurrency(o.total)}
            </button>`).join('')}
        </div>`;
    }
  } catch {}

  const inp = document.getElementById('trackingCodeInput');
  if (prefill && inp) {
    inp.value = prefill;
    submitOrderTracking();
  }
}

async function submitOrderTracking(e) {
  if (e) e.preventDefault();
  const code = (document.getElementById('trackingCodeInput')?.value || '').trim();
  const box = document.getElementById('trackingResultBox');
  if (!code || !box) return;
  box.innerHTML = `<div style="text-align:center;padding:18px;color:var(--color-text-muted);">Consultando pedido...</div>`;
  try {
    const o = await api.pedidos.seguimiento(code);
    const labels = {
      pendiente: '⏳ Pendiente de confirmación',
      confirmado: '✅ Confirmado — En preparación',
      en_camino: '🛵 En camino con motorizado',
      entregado: '🎉 Entregado satisfactoriamente',
      cancelado: '❌ Pedido cancelado'
    };
    const itemsHtml = (o.items || []).map(it => `<div style="font-size:0.78rem;color:var(--color-text-muted);">• ${it.cantidad}x ${it.nombre_producto} (${formatCurrency(it.subtotal)})</div>`).join('');
    box.innerHTML = `
      <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:16px;border:1px solid var(--color-surface-3);">
        <div class="flex-between" style="margin-bottom:8px;">
          <strong style="color:var(--color-primary-darker);font-size:1rem;">${o.numero_pedido}</strong>
          <span class="badge badge-primary">${labels[o.estado] || o.estado}</span>
        </div>
        <div style="font-size:0.84rem;color:var(--color-text-muted);line-height:1.7;">
          <div><strong>Cliente:</strong> ${o.nombre_cliente}</div>
          <div><strong>Modalidad:</strong> ${o.metodo_entrega === 'retiro' ? 'Retiro en Concept Store' : 'Envío a domicilio'}</div>
          ${o.motorizado_nombre ? `<div><strong>Motorizado:</strong> 🛵 ${o.motorizado_nombre} (${o.motorizado_telefono || ''})</div>` : ''}
          <div><strong>Total:</strong> <strong style="color:var(--color-primary-darker);">${formatCurrency(o.total)}</strong></div>
          <div><strong>Fecha:</strong> ${formatDateTime(o.fecha)}</div>
          ${itemsHtml ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--color-surface-3);"><strong>Productos:</strong>${itemsHtml}</div>` : ''}
        </div>
      </div>`;
  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${err.message || 'No se encontró el pedido indicado.'}</div>`;
  }
}

// =========================================================================
// ASISTENTE INTERACTIVO "DESCUBRE TU RUTINA K-BEAUTY" (TEST DE TIPO DE PIEL)
// =========================================================================
let lastQuizRecommendations = [];

function openSkinQuizModal() {
  let modal = document.getElementById('skinQuizModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'skinQuizModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:580px;max-height:90vh;overflow-y:auto;">
        <div class="modal-header">
          <div class="modal-title">✨ Asesor K-Beauty: Descubre tu Rutina Ideal</div>
          <button class="modal-close" onclick="document.getElementById('skinQuizModal').classList.remove('active')">✕</button>
        </div>
        <p style="font-size:0.86rem;color:var(--color-text-muted);margin-bottom:14px;">
          Responde estas 2 preguntas y nuestro sistema SISCO seleccionará los productos coreanos ideales para tu piel:
        </p>
        <form onsubmit="runSkinQuiz(event)">
          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">1. ¿Cómo sientes tu piel habitualmente?</label>
            <select id="quizSkinType" class="form-control">
              <option value="sensible">🌿 Sensible, con rojeces o irritación fácil</option>
              <option value="grasa">💧 Mixta a grasa, con brillo o poros visibles</option>
              <option value="seca">✨ Seca, tirante o falta de elasticidad</option>
              <option value="manchas">☀️ Opaca, con manchas o tono desigual</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">2. ¿Qué objetivo deseas priorizar hoy?</label>
            <select id="quizGoal" class="form-control">
              <option value="rutina">🧴 Rutina Coreana Completa (Limpieza + Tratamiento + SPF)</option>
              <option value="hidratacion">💎 Efecto Glass Skin (Hidratación & Regeneración)</option>
              <option value="makeup">💄 Protección Solar + Makeup Coreano Luminoso</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;">🔍 Obtener mi recomendación personalizada</button>
        </form>
        <div id="quizResultsContainer" style="margin-top:18px;"></div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
    document.body.appendChild(modal);
  }
  modal.classList.add('active');
  runSkinQuiz();
}

async function runSkinQuiz(e) {
  if (e) e.preventDefault();
  const skin = document.getElementById('quizSkinType')?.value || 'sensible';
  const goal = document.getElementById('quizGoal')?.value || 'rutina';
  const box = document.getElementById('quizResultsContainer');
  if (!box) return;

  const prods = (await fetchProductos()).filter(p => p.stock > 0);
  const scoreProduct = (p) => {
    const text = normalizeText(`${p.nombre} ${p.categoria} ${p.beneficios || ''} ${p.ingredientes || ''} ${p.descripcion || ''}`);
    let s = 0;
    if (skin === 'sensible' && (text.includes('heartleaf') || text.includes('centella') || text.includes('calma') || text.includes('sensible'))) s += 5;
    if (skin === 'grasa' && (text.includes('pore') || text.includes('cleansing') || text.includes('sebo') || text.includes('gel') || text.includes('tea'))) s += 5;
    if (skin === 'seca' && (text.includes('snail') || text.includes('collagen') || text.includes('hyaluronic') || text.includes('hidrat'))) s += 5;
    if (skin === 'manchas' && (text.includes('niacinamide') || text.includes('vitamin') || text.includes('spf') || text.includes('ilumina'))) s += 5;

    if (goal === 'rutina' && (text.includes('limpia') || text.includes('serum') || text.includes('sun'))) s += 3;
    if (goal === 'hidratacion' && (text.includes('snail') || text.includes('collagen') || text.includes('mask') || text.includes('toner'))) s += 4;
    if (goal === 'makeup' && (normalizeText(p.linea) === 'makeup' || text.includes('tint') || text.includes('cushion') || text.includes('sun'))) s += 6;
    return s;
  };

  lastQuizRecommendations = [...prods].sort((a, b) => scoreProduct(b) - scoreProduct(a)).slice(0, 3);
  const totalPack = lastQuizRecommendations.reduce((sum, p) => sum + Number(p.precio_final || 0), 0);

  box.innerHTML = `
    <div style="background:var(--color-surface-2);border:1px solid var(--color-surface-3);border-radius:var(--radius-md);padding:14px;">
      <div class="flex-between" style="margin-bottom:10px;">
        <strong style="color:var(--color-primary-darker);font-size:0.9rem;">🎯 Tu Rutina Recomendada (${lastQuizRecommendations.length} pasos)</strong>
        <span class="badge badge-primary">Total: ${formatCurrency(totalPack)}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${lastQuizRecommendations.map((p, idx) => `
          <div style="display:flex;align-items:center;gap:10px;background:#fff;padding:10px;border-radius:10px;border:1px solid var(--color-surface-3);">
            <img src="${resolveImageUrl(p.imagen_url)}" onerror="handleImgError(this)" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" alt="${p.nombre}" />
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.7rem;font-weight:700;color:var(--color-primary);">PASO ${idx + 1} · ${p.marca || 'K-Beauty'}</div>
              <div style="font-size:0.84rem;font-weight:700;color:var(--color-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.nombre}</div>
              <div style="font-size:0.78rem;font-weight:700;color:var(--color-primary-darker);">${formatCurrency(p.precio_final)}</div>
            </div>
            <button type="button" class="btn btn-outline btn-sm" onclick="addQuizProdToCart(${p.id})">+ Agregar</button>
          </div>`).join('')}
      </div>
      <button type="button" class="btn btn-primary" style="width:100%;margin-top:12px;justify-content:center;" onclick="addAllQuizToCart()">
        🛒 Agregar los ${lastQuizRecommendations.length} productos al carrito (${formatCurrency(totalPack)})
      </button>
    </div>`;
}

function addQuizProdToCart(id) {
  const p = lastQuizRecommendations.find(x => Number(x.id) === Number(id));
  if (!p) return;
  const cart = getCart();
  const ex = cart.find(i => Number(i.id) === Number(p.id));
  if (ex) {
    if (ex.cantidad < p.stock) ex.cantidad += 1;
  } else {
    cart.push({ id: p.id, nombre: p.nombre, marca: p.marca, precio: p.precio_final, imagen: resolveImageUrl(p.imagen_url), cantidad: 1, stock_max: p.stock });
  }
  saveCart(cart);
  showToast(`${p.nombre} añadido a tu carrito ✨`, 'success');
}

function addAllQuizToCart() {
  lastQuizRecommendations.forEach(p => addQuizProdToCart(p.id));
  document.getElementById('skinQuizModal')?.classList.remove('active');
  showToast('¡Rutina K-Beauty completa añadida al carrito!', 'success');
}

function getActiveSession() {
  let token = null;
  let user = null;
  try {
    token = localStorage.getItem('sisco_token');
    user = JSON.parse(localStorage.getItem('sisco_user') || 'null');
  } catch {}
  if (!token || !user) {
    try {
      const db = getLocalDB();
      if (db && db._session && db._session.token && db._session.user) {
        token = db._session.token;
        user = db._session.user;
        try {
          localStorage.setItem('sisco_token', token);
          localStorage.setItem('sisco_user', JSON.stringify(user));
        } catch {}
      }
    } catch {}
  }
  return { token, user };
}

function clearActiveSession() {
  try {
    localStorage.removeItem('sisco_token');
    localStorage.removeItem('sisco_user');
  } catch {}
  try {
    const db = getLocalDB();
    db._session = null;
    saveLocalDB(db, { silent: true });
  } catch {}
}

function initPublicNavbar() {
  updateCartBadge();
  const nav = document.querySelector('.navbar-nav');
  if (nav && !nav.querySelector('[data-skin-quiz]')) {
    const li = document.createElement('li');
    li.innerHTML = `<a href="#" data-skin-quiz class="nav-link" onclick="openSkinQuizModal();return false;" style="color:var(--color-primary-dark);font-weight:700;">✨ Test de Piel</a>`;
    nav.appendChild(li);
  }

  const actions = document.querySelector('.navbar-actions');
  if (!actions) return;

  const { token, user } = getActiveSession();

  const adminLink = actions.querySelector('[data-nav-auth]');
  if (adminLink) {
    if (token && user && (user.rol === 'admin' || user.rol === 'vendedor')) {
      adminLink.href = 'admin/dashboard.html';
      adminLink.innerHTML = '⚙️ Panel SISCO';
      adminLink.className = 'btn btn-primary btn-sm';
    } else if (token && user) {
      adminLink.href = '#';
      adminLink.innerHTML = `👤 ${user.nombre.split(' ')[0]} (Salir)`;
      adminLink.className = 'btn btn-outline btn-sm';
      adminLink.onclick = (ev) => {
        ev.preventDefault();
        clearActiveSession();
        showToast('Sesión cerrada correctamente', 'info');
        setTimeout(() => window.location.reload(), 500);
      };
    } else {
      adminLink.href = 'login.html';
      adminLink.innerHTML = '👤 Ingresar';
      adminLink.className = 'btn btn-outline btn-sm';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('admin-body')) {
    initPublicNavbar();
  }
});
