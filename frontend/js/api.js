/**
 * SISCO – Shiny Skin | api.js (v2.1)
 * Cliente HTTP unificado multi-dispositivo + detección real de servidor +
 * respaldo de demostración local únicamente cuando no existe backend configurado.
 */

function resolveApiConfig() {
  // 1. Permitir enlazar backend vía parámetro ?api=https://tu-servidor.onrender.com
  try {
    const urlParam = new URLSearchParams(window.location.search).get('api');
    if (urlParam && /^https?:\/\//i.test(urlParam.trim())) {
      const clean = urlParam.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
      localStorage.setItem('sisco_api_server_url', clean);
    }
  } catch {}

  // 2. Configuración explícita en frontend/js/config.js
  const fromConfig = (window.SISCO_CONFIG && window.SISCO_CONFIG.API_SERVER_URL)
    ? String(window.SISCO_CONFIG.API_SERVER_URL).trim().replace(/\/+$/, '').replace(/\/api$/i, '')
    : '';

  // 3. URL guardada manualmente desde el Panel Admin
  let fromStorage = '';
  try {
    const saved = (localStorage.getItem('sisco_api_server_url') || '').trim();
    if (/^https?:\/\//i.test(saved)) {
      fromStorage = saved.replace(/\/+$/, '').replace(/\/api$/i, '');
    }
  } catch {}

  const explicitOrigin = fromConfig || fromStorage;
  if (explicitOrigin) {
    return {
      apiBase: `${explicitOrigin}/api`,
      backendOrigin: explicitOrigin,
      isStaticWithoutBackend: false,
      isFileProtocol: false
    };
  }

  const host = (window.location.hostname || '').toLowerCase();
  const isStaticHost =
    host.endsWith('github.io') ||
    host.endsWith('netlify.app') ||
    host.endsWith('vercel.app') ||
    host.endsWith('pages.dev');

  if (isStaticHost) {
    return {
      apiBase: null,
      backendOrigin: window.location.origin,
      isStaticWithoutBackend: true,
      isFileProtocol: false
    };
  }

  if (window.location.protocol === 'file:') {
    return {
      apiBase: 'http://localhost:5000/api',
      backendOrigin: 'http://localhost:5000',
      isStaticWithoutBackend: false,
      isFileProtocol: true
    };
  }

  // Si se abre con Live Server (5500, 3000, etc.) en localhost o en IP Wi-Fi LAN (192.168.x.x)
  if (window.location.port && !['5000', '80', '443'].includes(window.location.port)) {
    const origin = `${window.location.protocol}//${window.location.hostname}:5000`;
    return {
      apiBase: `${origin}/api`,
      backendOrigin: origin,
      isStaticWithoutBackend: false,
      isFileProtocol: false
    };
  }

  // Despliegue integrado: Flask sirve frontend + /api en el mismo dominio (Render, VPS, LAN, localhost:5000)
  return {
    apiBase: '/api',
    backendOrigin: window.location.origin,
    isStaticWithoutBackend: false,
    isFileProtocol: false
  };
}

const SISCO_NET = resolveApiConfig();
const API_BASE = SISCO_NET.apiBase || '/api';
const BACKEND_ORIGIN = SISCO_NET.backendOrigin;
const FALLBACK_PRODUCT_IMG = 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=600&q=80';
const LOCAL_DB_KEY = 'sisco_local_db_v2';
const MY_ORDERS_KEY = 'sisco_my_orders_v1';

window.SISCO_MODE = SISCO_NET.isStaticWithoutBackend ? 'local' : 'checking';
window.SISCO_SERVER_INFO = null;

// ---- Escape HTML anti-XSS ----
function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- Normalización segura de números de WhatsApp (Nicaragua + Internacional) ----
function formatWhatsAppPhone(rawPhone) {
  const raw = String(rawPhone || '').trim();
  if (!raw) return '';
  const hasIntlPrefix = raw.startsWith('+') || raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (raw.startsWith('00')) digits = digits.replace(/^00/, '');
  if (hasIntlPrefix) return digits;
  // Número local estándar de Nicaragua (8 dígitos, incluso si empieza por 505)
  if (digits.length === 8) return '505' + digits;
  // Número de Nicaragua ya con código 505 (11 dígitos)
  if (digits.length === 11 && digits.startsWith('505')) return digits;
  return digits;
}

function getStoreWhatsApp() {
  const cfg = (window.SISCO_CONFIG && window.SISCO_CONFIG.STORE_WHATSAPP) || '50588880000';
  return formatWhatsAppPhone(cfg) || '50588880000';
}

// ---- Descuento General de Tienda (habilitado únicamente por la Administradora) ----
let _activeStorePromoCache = null;

function getCachedStorePromo() {
  if (_activeStorePromoCache && _activeStorePromoCache.activo && _activeStorePromoCache.codigo && Number(_activeStorePromoCache.porcentaje) > 0) {
    return _activeStorePromoCache;
  }
  return null;
}

function setCachedStorePromo(promo) {
  if (promo && promo.activo && promo.codigo && Number(promo.porcentaje) > 0) {
    _activeStorePromoCache = {
      activo: true,
      codigo: String(promo.codigo).trim().toUpperCase(),
      porcentaje: Number(promo.porcentaje),
      descripcion: promo.descripcion || `${Number(promo.porcentaje)}% OFF en toda la tienda`
    };
    // Si había un cupón guardado en el navegador que ya no coincide, limpiarlo o sincronizar porcentaje
    try {
      const saved = JSON.parse(localStorage.getItem('sisco_coupon') || 'null');
      if (saved) {
        if (String(saved.code || '').toUpperCase() === _activeStorePromoCache.codigo) {
          localStorage.setItem('sisco_coupon', JSON.stringify({
            code: _activeStorePromoCache.codigo,
            pct: _activeStorePromoCache.porcentaje,
            label: _activeStorePromoCache.descripcion
          }));
        } else {
          localStorage.removeItem('sisco_coupon');
        }
      }
    } catch {}
  } else {
    _activeStorePromoCache = { activo: false, codigo: null, porcentaje: 0, descripcion: '' };
    try { localStorage.removeItem('sisco_coupon'); } catch {}
  }
  return getCachedStorePromo();
}

async function fetchActiveStorePromo() {
  try {
    const res = await api.promocion.get();
    return setCachedStorePromo(res);
  } catch {
    return setCachedStorePromo(null);
  }
}

// ---- Semilla Inicial para Base de Datos Local (solo modo demo sin servidor) ----
const INITIAL_PRODUCTS = [
  { id: 1, nombre: 'ANUA Heartleaf 77% Soothing Serum', sku: 'SKN-SER-001', marca: 'ANUA', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '30 ml', tono: '', fecha_vencimiento: '2027-08-15', precio_costo: 400, porcentaje_ganancia: 80, precio_venta: 720, precio_final: 720, descuento: 0, stock: 30, stock_fisico: 14, stock_online: 16, stock_minimo: 8, es_nuevo: true, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80', descripcion: 'Suero calmante con 77% de hoja de corazón. Calma irritaciones y reduce el enrojecimiento.', beneficios: 'Calma irritaciones · Reduce enrojecimiento · Equilibra el sebo', ingredientes: 'Houttuynia Cordata Extract 77%, Pantenol, Ácido Hialurónico' },
  { id: 2, nombre: 'COSRX Advanced Snail 96 Mucin Essence', sku: 'SKN-SER-003', marca: 'COSRX', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '100 ml', tono: '', fecha_vencimiento: '2027-06-20', precio_costo: 350, porcentaje_ganancia: 77.1, precio_venta: 620, precio_final: 527, descuento: 15, stock: 22, stock_fisico: 10, stock_online: 12, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=600&q=80', descripcion: 'Esencia de mucina de caracol al 96% para regeneración celular e hidratación profunda.', beneficios: 'Regeneración cutánea · Hidratación profunda · Textura glass skin', ingredientes: 'Snail Secretion Filtrate 96%, Sodium Hyaluronate, Allantoin' },
  { id: 3, nombre: 'Purito Daily Go-To Sunscreen SPF50+ PA++++', sku: 'SKN-SOL-001', marca: 'Purito', linea: 'Skincare', categoria: 'Protectores Solares', tamano: '60 ml', tono: '', fecha_vencimiento: '2027-05-10', precio_costo: 380, porcentaje_ganancia: 78.9, precio_venta: 680, precio_final: 680, descuento: 0, stock: 35, stock_fisico: 18, stock_online: 17, stock_minimo: 6, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80', descripcion: 'Protector solar ligero de acabado invisible sin rastro blanco.', beneficios: 'SPF50+ PA++++ · Sin white cast · Con Centella Asiática', ingredientes: 'Centella Asiatica Extract, Uvinul A Plus, Tinosorb S' },
  { id: 4, nombre: 'rom&nd Juicy Lasting Tint – 21 Grab Cherry', sku: 'MKP-LAB-001', marca: 'rom&nd', linea: 'Makeup', categoria: 'Labios', tamano: '5.5 g', tono: '21 Grab Cherry', fecha_vencimiento: '2027-09-30', precio_costo: 310, porcentaje_ganancia: 80.6, precio_venta: 560, precio_final: 560, descuento: 0, stock: 25, stock_fisico: 12, stock_online: 13, stock_minimo: 5, es_nuevo: true, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=600&q=80', descripcion: 'Tinta labial coreana ultra duradera con acabado jugoso brillante.', beneficios: 'Brillo espejo · Alta pigmentación · Hidratación frutal', ingredientes: 'Extractos de papaya, pomelo y coco, escualano vegetal' },
  { id: 5, nombre: 'Numbuzin No.5 Vitamin Niacinamide Serum', sku: 'SKN-SER-002', marca: 'Numbuzin', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '30 ml', tono: '', fecha_vencimiento: '2026-12-15', precio_costo: 490, porcentaje_ganancia: 81.6, precio_venta: 890, precio_final: 890, descuento: 0, stock: 4, stock_fisico: 2, stock_online: 2, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=600&q=80', descripcion: 'Suero iluminador con vitamina C, glutatión y niacinamida al 5%.', beneficios: 'Despigmentante · Antioxidante · Unifica el tono', ingredientes: 'Niacinamide 5%, Tranexamic Acid, Glutathione, Vitamin C' },
  { id: 6, nombre: 'Biodance Bio-Collagen Real Deep Mask Cream', sku: 'SKN-HID-001', marca: 'Biodance', linea: 'Skincare', categoria: 'Hidratantes & Cremas', tamano: '50 ml', tono: '', fecha_vencimiento: '2027-07-01', precio_costo: 430, porcentaje_ganancia: 81.4, precio_venta: 780, precio_final: 663, descuento: 15, stock: 16, stock_fisico: 8, stock_online: 8, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?auto=format&fit=crop&w=600&q=80', descripcion: 'Crema hidratante intensiva con bio-colágeno y ácido hialurónico.', beneficios: 'Efecto reafirmante · Barrera cutánea · Elasticidad', ingredientes: 'Low Molecular Collagen, Oligo-Hyaluronic Acid, Galactomyces' },
  { id: 7, nombre: 'ANUA Heartleaf Pore Control Cleansing Oil', sku: 'SKN-LMP-001', marca: 'ANUA', linea: 'Skincare', categoria: 'Limpiadores', tamano: '200 ml', tono: '', fecha_vencimiento: '2027-04-20', precio_costo: 320, porcentaje_ganancia: 81.3, precio_venta: 580, precio_final: 522, descuento: 10, stock: 25, stock_fisico: 12, stock_online: 13, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=600&q=80', descripcion: 'Aceite limpiador suave para doble limpieza coreana.', beneficios: 'Disuelve maquillaje waterproof · Limpia poros · No comedogénico', ingredientes: 'Houttuynia Cordata Extract, Jojoba Seed Oil, Grape Seed Oil' },
  { id: 8, nombre: 'Skin1004 Madagascar Centella Air-Fit Suncream', sku: 'SKN-SOL-002', marca: 'Skin1004', linea: 'Skincare', categoria: 'Protectores Solares', tamano: '50 ml', tono: '', fecha_vencimiento: '2027-10-12', precio_costo: 360, porcentaje_ganancia: 80.6, precio_venta: 650, precio_final: 650, descuento: 0, stock: 28, stock_fisico: 14, stock_online: 14, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=600&q=80', descripcion: 'Protector solar calmante con Centella Asiática de Madagascar.', beneficios: 'Calma piel sensible · Protección UV amplia · Textura sedosa', ingredientes: 'Centella Asiatica Extract 29.8%, Niacinamide, Madecassoside' },
  { id: 9, nombre: 'rom&nd Bare Water Cushion SPF40+ – Natural Beige', sku: 'MKP-ROS-001', marca: 'rom&nd', linea: 'Makeup', categoria: 'Rostro', tamano: '15 g', tono: '21 Natural Beige', fecha_vencimiento: '2027-03-18', precio_costo: 520, porcentaje_ganancia: 82.7, precio_venta: 950, precio_final: 950, descuento: 0, stock: 12, stock_fisico: 6, stock_online: 6, stock_minimo: 4, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=600&q=80', descripcion: 'Base cushion coreana de acabado hidratado luminoso.', beneficios: 'Cobertura ligera natural · 70% esencia hidratante · SPF40+', ingredientes: 'Ácido Hialurónico, Ceramidas, Extracto de Flor de Loto' },
  { id: 10, nombre: 'Medicube PDRN Pink Collagen Jelly Eye Mask', sku: 'SKN-MSK-001', marca: 'Medicube', linea: 'Skincare', categoria: 'Mascarillas', tamano: '60 parches', tono: '', fecha_vencimiento: '2027-11-05', precio_costo: 290, porcentaje_ganancia: 79.3, precio_venta: 520, precio_final: 520, descuento: 0, stock: 40, stock_fisico: 20, stock_online: 20, stock_minimo: 8, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80', descripcion: 'Parches de hidrogel con PDRN y colágeno para contorno de ojos.', beneficios: 'Descongestiona ojeras · Hidrata líneas finas · Efecto frío', ingredientes: 'Salmon PDRN, Hydrolyzed Collagen, Niacinamide, Adenosine' },
  { id: 11, nombre: 'COSRX Low pH Good Morning Gel Cleanser', sku: 'SKN-LMP-002', marca: 'COSRX', linea: 'Skincare', categoria: 'Limpiadores', tamano: '150 ml', tono: '', fecha_vencimiento: '2027-08-22', precio_costo: 280, porcentaje_ganancia: 75, precio_venta: 490, precio_final: 490, descuento: 0, stock: 18, stock_fisico: 8, stock_online: 10, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80', descripcion: 'Gel limpiador diario de pH balanceado 5.5.', beneficios: 'Respeta el manto ácido · Con aceite de árbol de té · Suave', ingredientes: 'Melaleuca Alternifolia Leaf Oil, Betaine Salicylate (BHA)' },
  { id: 12, nombre: 'Innisfree Green Tea Hyaluronic Toner', sku: 'SKN-TON-001', marca: 'Innisfree', linea: 'Skincare', categoria: 'Tónicos', tamano: '170 ml', tono: '', fecha_vencimiento: '2027-09-14', precio_costo: 300, porcentaje_ganancia: 76.7, precio_venta: 530, precio_final: 530, descuento: 0, stock: 22, stock_fisico: 11, stock_online: 11, stock_minimo: 5, es_nuevo: false, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=600&q=80', descripcion: 'Tónico hidratante con té verde de la isla Jeju y 5 ácidos hialurónicos.', beneficios: 'Absorción inmediata · Refrescante · Calma la sed de la piel', ingredientes: 'Camellia Sinensis Leaf Extract, 5-Hyaluronic Acid Complex' },
];

function getLocalDateYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalMonthYM(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function enrichProductComputed(p) {
  const fis = Math.max(0, parseInt(p.stock_fisico ?? p.stock ?? 0) || 0);
  const onl = Math.max(0, parseInt(p.stock_online ?? 0) || 0);
  p.stock_fisico = fis;
  p.stock_online = onl;
  p.stock = fis + onl;
  p.stock_minimo = parseInt(p.stock_minimo ?? 5);
  if (isNaN(p.stock_minimo)) p.stock_minimo = 5;
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
  p.alerta_stock = p.stock_critico;

  if (p.fecha_vencimiento) {
    const diff = Math.ceil((new Date(p.fecha_vencimiento + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24));
    p.dias_para_vencer = isNaN(diff) ? null : diff;
    p.vencido = p.dias_para_vencer !== null && p.dias_para_vencer < 0;
    p.por_vencer = p.dias_para_vencer !== null && p.dias_para_vencer <= 60;
  } else {
    p.dias_para_vencer = null;
    p.vencido = false;
    p.por_vencer = false;
  }
  return p;
}

function createInitialLocalDB() {
  const todayIso = new Date().toISOString();
  const todayDate = getLocalDateYMD();
  return {
    usuarios: [
      { id: 1, nombre: 'Administradora Shiny Skin', username: 'admin', email: 'admin@shinyskin.ni', rol: 'admin', telefono: '505-8585-1000', activo: true, ultimo_acceso: todayIso, created_at: '2026-01-15T08:00:00' },
      { id: 2, nombre: 'Sofía Martínez (Ventas)', username: 'ventas', email: 'ventas@shinyskin.ni', rol: 'vendedor', telefono: '505-8585-2000', activo: true, ultimo_acceso: todayIso, created_at: '2026-02-10T09:00:00' },
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

function getLocalDB() {
  let lsDB = null;
  let wnDB = null;
  try { lsDB = parseDBCandidate(localStorage.getItem(LOCAL_DB_KEY)); } catch {}
  try {
    if (window.name && window.name.startsWith(WN_PREFIX)) {
      wnDB = parseDBCandidate(window.name.slice(WN_PREFIX.length));
    }
  } catch {}

  const chosen = lsDB && wnDB
    ? (Number(lsDB._updated_at || 0) >= Number(wnDB._updated_at || 0) ? lsDB : wnDB)
    : (lsDB || wnDB || MEMORY_DB);

  if (chosen && Array.isArray(chosen.productos)) {
    chosen.productos = chosen.productos.map(enrichProductComputed);
    MEMORY_DB = chosen;
    return chosen;
  }

  const fresh = createInitialLocalDB();
  MEMORY_DB = fresh;
  saveLocalDB(fresh, { preserveTimestamp: true, silent: true });
  return fresh;
}

function saveLocalDB(db, opts = {}) {
  if (!db || typeof db !== 'object') return;
  if (!opts.preserveTimestamp) db._updated_at = Date.now();
  MEMORY_DB = db;
  const serialized = JSON.stringify(db);
  try { window.name = WN_PREFIX + serialized; } catch {}
  try {
    localStorage.setItem(LOCAL_DB_KEY, serialized);
  } catch (e) {
    try {
      (db.productos || []).forEach(p => {
        if (p.imagen_url && p.imagen_url.startsWith('data:image/') && p.imagen_url.length > 180000) {
          p.imagen_url = FALLBACK_PRODUCT_IMG;
        }
      });
      const compact = JSON.stringify(db);
      localStorage.setItem(LOCAL_DB_KEY, compact);
      window.name = WN_PREFIX + compact;
    } catch {}
  }
  if (!opts.silent) {
    const detail = { updated_at: db._updated_at, newOrder: opts.newOrder || null };
    try { if (siscoSyncChannel) siscoSyncChannel.postMessage({ type: opts.newOrder ? 'new-order' : 'db-updated', ...detail }); } catch {}
    try { window.dispatchEvent(new CustomEvent('sisco:db-updated', { detail })); } catch {}
    if (opts.newOrder) {
      try { window.dispatchEvent(new CustomEvent('sisco:new-order', { detail: opts.newOrder })); } catch {}
    }
  }
}

if (siscoSyncChannel) {
  siscoSyncChannel.onmessage = (ev) => {
    if (!ev || !ev.data) return;
    if (ev.data.type === 'db-updated' || ev.data.type === 'new-order') {
      MEMORY_DB = null;
      getLocalDB();
      try { window.dispatchEvent(new CustomEvent('sisco:db-updated', { detail: ev.data })); } catch {}
      if (ev.data.type === 'new-order' && ev.data.newOrder) {
        try { window.dispatchEvent(new CustomEvent('sisco:new-order', { detail: ev.data.newOrder })); } catch {}
      }
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
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.74) || rawDataUrl);
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

// ---- Motor Local de Demostración (usado SOLO sin servidor backend) ----
async function handleLocalApi(method, path, body) {
  window.SISCO_MODE = 'local';
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

  const { user: activeUser } = getActiveSession();
  const currentUser = activeUser || { nombre: 'Administradora Shiny Skin', rol: 'admin' };
  const nextId = (arr) => arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
  const nowIso = new Date().toISOString();
  const todayPrefix = getLocalDateYMD();

  // ==================== AUTH & USUARIOS ====================
  if (pathname === '/auth/login' && method === 'POST') {
    const idf = String(data.email || data.username || '').trim().toLowerCase();
    const pwd = String(data.password || '');
    let u = db.usuarios.find(x => (x.email || '').toLowerCase() === idf || (x.username || '').toLowerCase() === idf);
    if (!u && ['admin', 'admin@shinyskin.ni', 'admin@shinyskin.com'].includes(idf)) u = db.usuarios[0];
    if (!u && ['ventas', 'vendedora', 'vendedor', 'ventas@shinyskin.ni', 'vendedora@shinyskin.ni', 'vendedor@shinyskin.com'].includes(idf)) u = db.usuarios[1];
    const expectedPwd = u?.password || (u?.rol === 'admin' ? 'admin123' : (u?.rol === 'vendedor' ? 'ventas123' : ''));
    if (!u || (expectedPwd && expectedPwd !== pwd)) {
      const err = new Error('Credenciales inválidas. Verifica tu usuario y contraseña.');
      err.status = 401;
      throw err;
    }
    if (u.activo === false) throw new Error('Esta cuenta de usuario se encuentra desactivada.');
    u.ultimo_acceso = nowIso;
    saveLocalDB(db, { silent: true });
    return { token: `local_jwt_${u.id}_${Date.now()}`, user: u, usuario: u };
  }

  if (pathname === '/auth/register' && method === 'POST') {
    const email = String(data.email || '').trim().toLowerCase();
    if (!email || !data.nombre || String(data.password || '').length < 6) {
      throw new Error('Completa nombre, correo y contraseña (mín. 6 caracteres).');
    }
    if (db.usuarios.some(x => (x.email || '').toLowerCase() === email)) {
      throw new Error('Este correo electrónico ya está registrado.');
    }
    const u = {
      id: nextId(db.usuarios),
      nombre: data.nombre.trim(),
      username: data.username || email.split('@')[0],
      email,
      password: data.password,
      rol: 'cliente',
      telefono: data.telefono || '',
      activo: true,
      ultimo_acceso: nowIso,
      created_at: nowIso
    };
    db.usuarios.push(u);
    saveLocalDB(db, { silent: true });
    return { token: `local_jwt_${u.id}_${Date.now()}`, user: u, usuario: u };
  }

  if (pathname === '/auth/forgot-password' && method === 'POST') {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.last_reset_code = code;
    db.last_reset_target = data.email || data.identificador || '';
    saveLocalDB(db, { silent: true });
    return { message: 'Código de recuperación generado.', codigo_demo: code, reset_token: code };
  }

  if (pathname === '/auth/reset-password' && method === 'POST') {
    const u = db.usuarios.find(x =>
      (x.email || '').toLowerCase() === String(data.email || db.last_reset_target || '').toLowerCase()
    ) || db.usuarios[0];
    const newPass = data.new_password || data.nueva_password;
    if (u && newPass) u.password = newPass;
    saveLocalDB(db, { silent: true });
    return { message: 'Contraseña actualizada exitosamente.' };
  }

  if (pathname === '/auth/me' && method === 'GET') return currentUser;
  if (pathname === '/auth/usuarios' && method === 'GET') return db.usuarios;

  if (pathname === '/auth/usuarios' && method === 'POST') {
    const u = {
      id: nextId(db.usuarios),
      nombre: (data.nombre || '').trim(),
      username: (data.username || (data.email || '').split('@')[0]).trim().toLowerCase(),
      email: (data.email || '').trim().toLowerCase(),
      rol: data.rol || 'vendedor',
      telefono: (data.telefono || '').trim(),
      activo: data.activo !== false && data.activo !== 'false',
      password: data.password || 'shiny123',
      ultimo_acceso: null,
      created_at: nowIso
    };
    db.usuarios.push(u);
    saveLocalDB(db);
    return { message: 'Usuario registrado correctamente', usuario: u };
  }

  const userMatch = pathname.match(/^\/auth\/usuarios\/(\d+)$/);
  if (userMatch) {
    const uid = Number(userMatch[1]);
    const u = db.usuarios.find(x => Number(x.id) === uid);
    if (!u) throw new Error('Usuario no encontrado');
    if (method === 'PUT') {
      if (data.nombre !== undefined) u.nombre = data.nombre.trim();
      if (data.username !== undefined && data.username.trim()) u.username = data.username.trim().toLowerCase();
      if (data.email !== undefined) u.email = data.email.trim().toLowerCase();
      if (data.rol !== undefined) u.rol = data.rol;
      if (data.telefono !== undefined) u.telefono = data.telefono.trim();
      if (data.activo !== undefined) u.activo = data.activo !== false && data.activo !== 'false';
      if (data.password) u.password = data.password;
      saveLocalDB(db);
      return { message: 'Usuario actualizado', usuario: u };
    }
    if (method === 'DELETE') {
      u.activo = !u.activo;
      saveLocalDB(db);
      return { message: `Usuario ${u.activo ? 'activado' : 'desactivado'} correctamente.`, user: u, usuario: u };
    }
  }

  // ==================== PRODUCTOS ====================
  if (pathname === '/productos/categorias' && method === 'GET') return db.categorias;
  if (pathname === '/productos/marcas' && method === 'GET') return db.marcas;
  if (pathname === '/productos/stock-critico' && method === 'GET') {
    return db.productos.filter(p => p.activo !== false && p.stock <= (p.stock_minimo ?? 5));
  }

  if (pathname === '/productos' && method === 'GET') {
    let list = [...db.productos];
    if (params.incluir_inactivos !== 'true') list = list.filter(p => p.activo !== false);
    if (params.categoria) list = list.filter(p => matchesCategoryFilter(p, params.categoria));
    if (params.linea) list = list.filter(p => matchesCategoryFilter(p, params.linea));
    if (params.marca) {
      const mNorm = normalizeText(params.marca);
      list = list.filter(p => normalizeText(p.marca) === mNorm || String(p.brand_id) === String(params.marca));
    }
    if (params.destacado === 'true' || params.destacados === 'true') list = list.filter(p => p.es_destacado);
    if (params.nuevo === 'true' || params.nuevos === 'true') list = list.filter(p => p.es_nuevo);
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
      id: newId, nombre, sku, marca: marcaNombre, categoria: catNombre, linea,
      tamano: String(data.tamano || '').trim(),
      tono: String(data.tono || '').trim(),
      fecha_vencimiento: String(data.fecha_vencimiento || '').trim(),
      precio_costo: parseFloat(data.precio_costo) || 0,
      porcentaje_ganancia: parseFloat(data.porcentaje_ganancia) || 0,
      precio_venta: parseFloat(data.precio_venta) || 0,
      descuento: parseFloat(data.descuento) || 0,
      stock_fisico: fis, stock_online: onl,
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
        id: nextId(db.movimientos), product_id: newProd.id, producto: newProd.nombre, sku: newProd.sku,
        tipo: 'entrada', ubicacion: fis > 0 && onl > 0 ? 'ambos' : (fis > 0 ? 'fisico' : 'online'),
        cantidad: newProd.stock, stock_anterior: 0, stock_nuevo: newProd.stock,
        motivo: 'Stock inicial al registrar producto', usuario: currentUser.nombre, fecha: nowIso
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
      stock_critico: criticos.length,
      stock_critico_count: criticos.length,
      sin_stock: activos.filter(p => p.stock === 0).length,
      por_vencer_count: porVencer.length,
      valor_inventario: valorCosto,
      valor_costo_total: valorCosto,
      valor_venta_total: valorVenta,
      ganancia_potencial: valorVenta - valorCosto
    };
  }

  if (pathname === '/inventario/rotacion' && method === 'GET') {
    const vendidosMap = {};
    db.pedidos.filter(o => o.estado !== 'cancelado').forEach(o => {
      (o.items || []).forEach(it => { vendidosMap[it.product_id] = (vendidosMap[it.product_id] || 0) + (Number(it.cantidad) || 0); });
    });
    db.facturas.filter(f => f.estado !== 'anulada' && !f.order_id).forEach(f => {
      (f.items || []).forEach(it => { vendidosMap[it.product_id] = (vendidosMap[it.product_id] || 0) + (Number(it.cantidad) || 0); });
    });
    const activos = db.productos.filter(p => p.activo !== false).map(p => ({ ...p, unidades_vendidas: vendidosMap[p.id] || 0 }));
    return {
      alta_rotacion: activos.filter(p => p.unidades_vendidas > 0).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas),
      baja_rotacion: activos.filter(p => p.unidades_vendidas === 0 && p.stock > 0),
      stock_estancado: activos.filter(p => p.unidades_vendidas === 0 && p.stock > 0),
      proximos_vencer: activos.filter(p => p.dias_para_vencer !== null && p.dias_para_vencer <= 90)
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
    return { message: 'Entrada registrada', producto: p, movimiento: mov };
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
    return { message: 'Salida registrada', producto: p, movimiento: mov };
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
    return { message: 'Traslado realizado', producto: p, movimiento: mov };
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
    return { message: 'Ajuste aplicado', producto: p, movimiento: mov };
  }

  // ==================== PEDIDOS & MOTORIZADOS ====================
  if (pathname === '/pedidos/motorizados' && method === 'GET') return db.motorizados;
  if (pathname === '/pedidos/motorizados' && method === 'POST') {
    const m = { id: nextId(db.motorizados), nombre: data.nombre, telefono: data.telefono, empresa: data.empresa || 'Independiente', activo: true, pedidos_asignados: 0 };
    db.motorizados.push(m);
    saveLocalDB(db);
    return { message: 'Motorizado registrado', motorizado: m };
  }

  if (pathname === '/pedidos/alertas' && method === 'GET') {
    const sinceId = params.since_id !== undefined ? Number(params.since_id) : null;
    const latestId = db.pedidos.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0);
    const pendingOrders = db.pedidos.filter(o => o.estado === 'pendiente');
    const newOrders = sinceId !== null ? db.pedidos.filter(o => Number(o.id) > sinceId) : [];
    return {
      server_time: nowIso,
      latest_order_id: latestId,
      pending_count: pendingOrders.length,
      en_camino_count: db.pedidos.filter(o => o.estado === 'en_camino').length,
      new_orders: newOrders,
      pending_orders: pendingOrders.slice(0, 15)
    };
  }

  if (pathname === '/pedidos/stats' && method === 'GET') {
    const valid = db.pedidos.filter(o => ['confirmado', 'en_camino', 'entregado'].includes(o.estado));
    return {
      total: db.pedidos.length,
      total_pedidos: db.pedidos.length,
      pendientes: db.pedidos.filter(o => o.estado === 'pendiente').length,
      confirmados: db.pedidos.filter(o => o.estado === 'confirmado').length,
      en_camino: db.pedidos.filter(o => o.estado === 'en_camino').length,
      entregados: db.pedidos.filter(o => o.estado === 'entregado').length,
      cancelados: db.pedidos.filter(o => o.estado === 'cancelado').length,
      ingresos_total: valid.reduce((s, o) => s + (o.total || 0), 0)
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
    const estadoInicial = ['pendiente', 'confirmado', 'en_camino', 'entregado'].includes(data.estado) ? data.estado : 'pendiente';

    let subtotal = 0;
    const builtItems = [];
    for (let idx = 0; idx < itemsReq.length; idx++) {
      const it = itemsReq[idx];
      const p = db.productos.find(x => Number(x.id) === Number(it.product_id));
      const qty = Math.max(1, parseInt(it.cantidad) || 1);
      if (p && p.stock < qty) {
        throw new Error(`Stock insuficiente para "${p.nombre}" (disponible: ${p.stock}, solicitado: ${qty}).`);
      }
      const price = p ? p.precio_final : (parseFloat(it.precio_unitario) || 0);
      if (p) {
        const ant = p.stock;
        let ubi = 'online';
        if (canalPedido === 'tienda_fisica') { p.stock_fisico = Math.max(0, p.stock_fisico - qty); ubi = 'fisico'; }
        else if (p.stock_online >= qty) { p.stock_online -= qty; ubi = 'online'; }
        else { const rem = qty - p.stock_online; p.stock_online = 0; p.stock_fisico = Math.max(0, p.stock_fisico - rem); ubi = 'online'; }
        enrichProductComputed(p);
        db.movimientos.unshift({
          id: nextId(db.movimientos), product_id: p.id, producto: p.nombre, sku: p.sku,
          tipo: 'venta', ubicacion: ubi, cantidad: qty, stock_anterior: ant, stock_nuevo: p.stock,
          motivo: `Pedido ${numPedido} (${canalPedido})`, usuario: canalPedido === 'web' ? 'E-Commerce Web' : currentUser.nombre, fecha: nowIso
        });
      }
      subtotal += price * qty;
      builtItems.push({ id: idx + 1, product_id: p ? p.id : it.product_id, nombre_producto: p ? p.nombre : (it.nombre_producto || 'Producto'), sku: p ? p.sku : '', cantidad: qty, precio_unitario: price, subtotal: price * qty });
    }

    let desc = parseFloat(data.descuento) || 0;
    if (data.cupon) {
      const promo = db.promocion || { activo: false };
      const codeReq = String(data.cupon).trim().toUpperCase();
      if (!promo.activo || !promo.codigo || Number(promo.porcentaje || 0) <= 0) {
        throw new Error('Actualmente no hay un descuento general habilitado en la tienda.');
      }
      if (codeReq !== String(promo.codigo).trim().toUpperCase()) {
        throw new Error(`El código de descuento "${codeReq}" no es válido o no está activo.`);
      }
      desc = Math.round(subtotal * Number(promo.porcentaje)) / 100;
    }
    const base = Math.max(0, subtotal - desc);
    const envio = data.metodo_entrega === 'retiro' ? 0 : (data.costo_envio !== undefined ? (parseFloat(data.costo_envio) || 0) : (base >= 1500 ? 0 : 100));
    const total = Math.max(0, base + envio);
    const pagoCli = parseFloat(data.monto_pago_cliente) || null;
    const cambio = pagoCli && pagoCli >= total ? pagoCli - total : 0;
    const motoObj = data.motorizado_id ? db.motorizados.find(x => Number(x.id) === Number(data.motorizado_id)) : null;

    const newOrder = {
      id: oid, numero_pedido: numPedido,
      nombre_cliente: data.nombre_cliente || 'Cliente Shiny Skin',
      telefono_cliente: data.telefono_cliente || '',
      email_cliente: data.email_cliente || '',
      metodo_entrega: data.metodo_entrega || 'domicilio',
      direccion_entrega: data.direccion_entrega || 'Managua, Nicaragua',
      estado: estadoInicial,
      motorizado_id: motoObj ? motoObj.id : null,
      motorizado_nombre: motoObj ? motoObj.nombre : null,
      motorizado_telefono: motoObj ? motoObj.telefono : null,
      subtotal, descuento: desc, costo_envio: envio, iva: 0, total,
      metodo_pago: data.metodo_pago || 'efectivo_entrega',
      monto_pago_cliente: pagoCli, cambio_entregar: cambio,
      notas: data.notas || '', canal: canalPedido,
      factura_id: null, numero_factura: null, fecha: nowIso,
      items: builtItems,
      historial: [{ id: 1, estado_anterior: null, estado_nuevo: estadoInicial, observacion: `Pedido registrado (${canalPedido})`, fecha: nowIso }]
    };
    db.pedidos.unshift(newOrder);

    if (newOrder.nombre_cliente) {
      const existingCli = db.clientes.find(c => normalizeText(c.nombre) === normalizeText(newOrder.nombre_cliente) || (newOrder.telefono_cliente && c.telefono === newOrder.telefono_cliente));
      if (!existingCli) {
        db.clientes.unshift({
          id: nextId(db.clientes), nombre: newOrder.nombre_cliente,
          telefono: newOrder.telefono_cliente, email: newOrder.email_cliente,
          direccion: newOrder.direccion_entrega, notas: `Registrado desde pedido ${numPedido}`
        });
      }
    }
    saveLocalDB(db, { newOrder });
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
          if (o.canal === 'tienda_fisica') p.stock_fisico += Number(it.cantidad) || 0;
          else p.stock_online += Number(it.cantidad) || 0;
          enrichProductComputed(p);
          db.movimientos.unshift({
            id: nextId(db.movimientos), product_id: p.id, producto: p.nombre, sku: p.sku,
            tipo: 'anulacion', ubicacion: o.canal === 'tienda_fisica' ? 'fisico' : 'online',
            cantidad: Number(it.cantidad) || 0, stock_anterior: stockAnt, stock_nuevo: p.stock,
            motivo: `Cancelación de pedido ${o.numero_pedido}`, usuario: currentUser.nombre, fecha: nowIso
          });
        }
      });
    }
    o.estado = nuevo;
    if (data.motorizado_id !== undefined) {
      const m = data.motorizado_id ? db.motorizados.find(x => Number(x.id) === Number(data.motorizado_id)) : null;
      o.motorizado_id = m ? m.id : null;
      o.motorizado_nombre = m ? m.nombre : null;
      o.motorizado_telefono = m ? m.telefono : null;
    }
    o.historial = o.historial || [];
    o.historial.push({ id: o.historial.length + 1, estado_anterior: ant, estado_nuevo: nuevo, observacion: data.observacion || `Cambio a ${nuevo}`, fecha: nowIso });
    saveLocalDB(db);
    return { ...o, mensaje: 'Estado actualizado', pedido: o };
  }

  const orderMotoMatch = pathname.match(/^\/pedidos\/(\d+)\/motorizado$/);
  if (orderMotoMatch && method === 'PUT') {
    const o = db.pedidos.find(x => Number(x.id) === Number(orderMotoMatch[1]));
    if (!o) throw new Error('Pedido no encontrado');
    const m = db.motorizados.find(x => Number(x.id) === Number(data.motorizado_id));
    o.motorizado_id = m ? m.id : null;
    o.motorizado_nombre = m ? m.nombre : null;
    o.motorizado_telefono = m ? m.telefono : null;
    if (data.pasar_en_camino && ['pendiente', 'confirmado'].includes(o.estado)) o.estado = 'en_camino';
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
    const totalIng = pagadas.reduce((s, f) => s + (Number(f.total) || 0), 0);
    const ingHoy = pagadas.filter(f => String(f.fecha || '').slice(0, 10) === todayPrefix).reduce((s, f) => s + (Number(f.total) || 0), 0);
    const emitidas = db.facturas.filter(f => f.estado === 'emitida').length;
    return {
      total_facturas: db.facturas.length,
      pagadas: pagadas.length,
      emitidas,
      pendientes_pago: emitidas,
      anuladas: db.facturas.filter(f => f.estado === 'anulada').length,
      total_facturado: totalIng,
      total_ingresos: totalIng,
      ingresos_hoy: ingHoy
    };
  }

  if (pathname === '/facturas' && method === 'GET') {
    let list = [...db.facturas];
    if (params.estado) list = list.filter(f => f.estado === params.estado);
    if (params.canal) list = list.filter(f => f.canal === params.canal);
    if (params.fecha_desde) list = list.filter(f => String(f.fecha || '').slice(0, 10) >= params.fecha_desde);
    if (params.fecha_hasta) list = list.filter(f => String(f.fecha || '').slice(0, 10) <= params.fecha_hasta);
    if (params.q) {
      const qn = normalizeText(params.q);
      list = list.filter(f => normalizeText(`${f.numero_factura} ${f.nombre_cliente} ${f.numero_pedido || ''}`).includes(qn));
    }
    return list;
  }

  if (pathname === '/facturas' && method === 'POST') {
    const fid = nextId(db.facturas);
    const numFac = `FAC-${String(fid).padStart(6, '0')}`;
    let subtotal = 0, descMonto = 0, total = 0, itemsFac = [], linkedOrder = null;

    if (data.order_id) {
      linkedOrder = db.pedidos.find(o => Number(o.id) === Number(data.order_id));
      if (!linkedOrder) throw new Error('Pedido no encontrado para facturar');
      subtotal = linkedOrder.subtotal;
      descMonto = linkedOrder.descuento || 0;
      total = linkedOrder.total;
      itemsFac = (linkedOrder.items || []).map(it => ({ ...it, descuento: 0 }));
      linkedOrder.factura_id = fid;
      linkedOrder.numero_factura = numFac;
      if (linkedOrder.estado === 'pendiente') linkedOrder.estado = 'confirmado';
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
      id: fid, numero_factura: numFac,
      order_id: linkedOrder ? linkedOrder.id : null,
      numero_pedido: linkedOrder ? linkedOrder.numero_pedido : null,
      nombre_cliente: data.nombre_cliente || (linkedOrder ? linkedOrder.nombre_cliente : 'Consumidor Final'),
      telefono_cliente: data.telefono_cliente || (linkedOrder ? linkedOrder.telefono_cliente : ''),
      email_cliente: data.email_cliente || (linkedOrder ? linkedOrder.email_cliente : ''),
      canal: data.canal || (linkedOrder && linkedOrder.canal !== 'tienda_fisica' ? 'online' : 'colectivo'),
      tipo_descuento: data.tipo_descuento || 'monto',
      subtotal, descuento: descMonto, iva: 0, total,
      metodo_pago: data.metodo_pago || 'efectivo',
      monto_recibido: recibido, cambio, estado: 'pagada',
      notas: data.notas || '', emisor: currentUser.nombre, fecha: nowIso, items: itemsFac
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
        if (p) { p.stock_fisico += Number(it.cantidad) || 0; enrichProductComputed(p); }
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
      return { ...c, cantidad_pedidos: peds.length, total_compras: peds.reduce((s, o) => s + (o.total || 0), 0) };
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
    const totalMes = list.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    return {
      total_mes: totalMes, total_gastos: totalMes, total_historico: totalHist,
      cantidad_registros: list.length,
      por_categoria: Object.entries(porCatMap).map(([categoria, monto]) => ({ categoria, monto }))
    };
  }

  if (pathname === '/gastos' && method === 'POST') {
    const g = { id: nextId(db.gastos), categoria_gasto: data.categoria_gasto || 'OTRO', concepto: data.concepto, monto: parseFloat(data.monto) || 0, fecha: data.fecha || todayPrefix, notas: data.notas || '', usuario: currentUser.nombre };
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

  // ==================== DASHBOARD & BACKUP LOCAL ====================
  if (pathname === '/dashboard/backup' && method === 'GET') {
    return { ...db, source: 'local_browser', exported_at: nowIso };
  }
  if (pathname === '/dashboard/restore' && method === 'POST') {
    if (!data || !Array.isArray(data.productos)) throw new Error('Archivo de respaldo inválido.');
    saveLocalDB(data);
    return { message: 'Respaldo restaurado en navegador local.' };
  }

  if (pathname === '/dashboard/kpis' && method === 'GET') {
    const validOrders = db.pedidos.filter(o => ['confirmado', 'en_camino', 'entregado'].includes(o.estado));
    const directFacs = db.facturas.filter(f => f.estado === 'pagada' && !f.order_id);
    const ventasMes = validOrders.reduce((s, o) => s + (o.total || 0), 0) + directFacs.reduce((s, f) => s + (f.total || 0), 0);
    const ventasHoy = validOrders.filter(o => String(o.fecha || '').slice(0, 10) === todayPrefix).reduce((s, o) => s + (o.total || 0), 0)
      + directFacs.filter(f => String(f.fecha || '').slice(0, 10) === todayPrefix).reduce((s, f) => s + (f.total || 0), 0);
    const gastosMes = db.gastos.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    const activos = db.productos.filter(p => p.activo !== false);
    return {
      ventas_hoy: ventasHoy, ventas_mes: ventasMes, gastos_mes: gastosMes, balance_mes: ventasMes - gastosMes,
      pedidos_pendientes: db.pedidos.filter(o => o.estado === 'pendiente').length,
      pedidos_hoy: db.pedidos.filter(o => String(o.fecha || '').slice(0, 10) === todayPrefix).length,
      total_productos: activos.length,
      stock_critico: activos.filter(p => p.stock_critico).length,
      facturas_pendientes: db.facturas.filter(f => f.estado === 'emitida').length,
      total_clientes: db.clientes.length
    };
  }

  if (pathname === '/dashboard/ventas-semana' && method === 'GET') {
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = getLocalDateYMD(d);
      const totalDia = db.pedidos.filter(o => ['confirmado', 'en_camino', 'entregado'].includes(o.estado) && String(o.fecha || '').slice(0, 10) === ds).reduce((s, o) => s + (o.total || 0), 0)
        + db.facturas.filter(f => f.estado === 'pagada' && !f.order_id && String(f.fecha || '').slice(0, 10) === ds).reduce((s, f) => s + (f.total || 0), 0);
      result.push({ fecha: `${dias[d.getDay()]} ${d.getDate()}`, total: totalDia });
    }
    return result;
  }

  if (pathname === '/dashboard/top-productos' && method === 'GET') {
    const map = {};
    db.pedidos.filter(o => o.estado !== 'cancelado').forEach(o => {
      (o.items || []).forEach(it => {
        const key = it.nombre_producto || 'Producto';
        if (!map[key]) map[key] = { producto: key, nombre: key, total_vendido: 0, ingresos: 0 };
        map[key].total_vendido += Number(it.cantidad) || 0;
        map[key].ingresos += Number(it.subtotal) || 0;
      });
    });
    db.facturas.filter(f => f.estado === 'pagada' && !f.order_id).forEach(f => {
      (f.items || []).forEach(it => {
        const key = it.nombre_producto || 'Producto';
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

  // ---- Promoción / Descuento General de Tienda (Local Demo) ----
  if (!db.promocion) {
    db.promocion = { activo: false, codigo: 'SHINY10', porcentaje: 10, descripcion: 'Descuento especial en toda la tienda' };
  }
  if ((pathname === '/promocion' || pathname === '/promocion/') && method === 'GET') {
    if (!db.promocion.activo || !db.promocion.codigo || Number(db.promocion.porcentaje) <= 0) {
      return { activo: false, codigo: null, porcentaje: 0, descripcion: '' };
    }
    return { ...db.promocion };
  }
  if (pathname === '/promocion/admin' && method === 'GET') {
    return { ...db.promocion };
  }
  if ((pathname === '/promocion' || pathname === '/promocion/') && method === 'PUT') {
    const activo = !!data.activo;
    const codigo = String(data.codigo !== undefined ? data.codigo : db.promocion.codigo || 'SHINY10').trim().toUpperCase().replace(/\s+/g, '');
    const porcentaje = Math.round((parseFloat(data.porcentaje !== undefined ? data.porcentaje : db.promocion.porcentaje) || 0) * 100) / 100;
    if (activo && (!codigo || codigo.length < 2)) throw new Error('Ingresa un código de descuento válido.');
    if (activo && (porcentaje <= 0 || porcentaje > 90)) throw new Error('El porcentaje debe estar entre 1% y 90%.');
    db.promocion = {
      activo,
      codigo: codigo || 'SHINY10',
      porcentaje,
      descripcion: String(data.descripcion !== undefined ? data.descripcion : (db.promocion.descripcion || '')).trim() || `${porcentaje}% OFF en toda la tienda Shiny Skin`,
      updated_at: nowIso,
      updated_by: currentUser.nombre || 'Administradora'
    };
    saveLocalDB(db);
    return { ...db.promocion };
  }

  return {};
}

// ---- Cliente HTTP real con reintento para Cold Start y separación estricta Servidor vs Demo Local ----
async function request(method, path, body = null, auth = false) {
  if (SISCO_NET.isStaticWithoutBackend) {
    return await handleLocalApi(method, path, body);
  }

  const headers = {};
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const { token } = getActiveSession();
  if (token && (auth || method !== 'GET')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (body) {
    opts.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const url = `${API_BASE}${path}`;
  let res;
  let lastNetErr = null;
  const maxAttempts = (method === 'POST' && path.startsWith('/pedidos')) ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(url, opts);
      lastNetErr = null;
      break;
    } catch (netErr) {
      lastNetErr = netErr;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1800));
      }
    }
  }

  if (lastNetErr) {
    // Si se abrió como archivo local file:// sin Python activo, permitir modo demo local
    if (SISCO_NET.isFileProtocol) {
      return await handleLocalApi(method, path, body);
    }
    // En un sitio web real (HTTP/HTTPS), NUNCA ocultar una falla al crear un pedido fingiendo éxito local
    if (method === 'POST' && path.startsWith('/pedidos')) {
      const e = new Error('No pudimos conectar con el servidor de Shiny Skin para registrar tu pedido. Revisa tu conexión e inténtalo nuevamente.');
      e.isNetworkError = true;
      e.status = 0;
      throw e;
    }
    // En endpoints de lectura o demo local si el backend de desarrollo está apagado en localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return await handleLocalApi(method, path, body);
    }
    const e = new Error('El servidor de Shiny Skin no responde en este momento. Intenta recargar en unos segundos.');
    e.isNetworkError = true;
    e.status = 0;
    throw e;
  }

  // Si llegamos aquí, el servidor HTTP respondió
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    // Live Server sin backend corriendo devuelve 404/405 en HTML plano
    if ((res.status === 405 || res.status === 404) && !contentType.includes('application/json') && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || SISCO_NET.isFileProtocol)) {
      return await handleLocalApi(method, path, body);
    }

    // Si el servidor real rechaza el token (401/422), NO mostrar datos falsos locales: pedir login real
    if ((res.status === 401 || res.status === 422) && auth) {
      window.SISCO_MODE = 'server';
      const isAdminPage = document.body && document.body.classList.contains('admin-body');
      if (isAdminPage && !window._SISCO_REDIRECTING_AUTH) {
        window._SISCO_REDIRECTING_AUTH = true;
        clearActiveSession();
        window.location.replace('../login.html?reason=expired&next=' + encodeURIComponent(window.location.pathname));
      }
    }

    const errBody = await res.json().catch(() => ({}));
    const e = new Error(errBody.error || errBody.msg || `Error HTTP ${res.status}`);
    e.status = res.status;
    e.isNetworkError = false;
    throw e;
  }

  window.SISCO_MODE = 'server';
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

  health: async () => {
    if (SISCO_NET.isStaticWithoutBackend) {
      window.SISCO_MODE = 'local';
      return { status: 'local', mode: 'local', database: 'localStorage', realtime_sse: false };
    }
    try {
      const r = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
      if (r.ok) {
        const info = await r.json();
        window.SISCO_MODE = 'server';
        window.SISCO_SERVER_INFO = info;
        return info;
      }
    } catch {}
    window.SISCO_MODE = 'local';
    return { status: 'offline', mode: 'local', database: 'localStorage', realtime_sse: false };
  },

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
    list:             (params = {}) => api.get('/pedidos/' + buildQuery(params), true),
    get:              (id)          => api.get(`/pedidos/${id}`, true),
    seguimiento:      (codigo)      => api.get(`/pedidos/seguimiento/${encodeURIComponent(codigo)}`),
    create:           (data)        => api.post('/pedidos/', data),
    updateEstado:     (id, estado, extra = {}) => api.put(`/pedidos/${id}/estado`, { estado, ...extra }, true),
    assignMotorizado: (id, data)    => api.put(`/pedidos/${id}/motorizado`, data, true),
    motorizados:      (activos = true) => api.get(`/pedidos/motorizados?activos=${activos}`, true),
    createMotorizado: (data)        => api.post('/pedidos/motorizados', data, true),
    updateMotorizado: (id, data)    => api.put(`/pedidos/motorizados/${id}`, data, true),
    stats:            ()            => api.get('/pedidos/stats', true),
    alertas:          (sinceId)     => api.get('/pedidos/alertas' + (sinceId !== undefined && sinceId !== null ? `?since_id=${sinceId}` : ''), true),
    streamUrl:        ()            => {
      const { token } = getActiveSession();
      if (!token || SISCO_NET.isStaticWithoutBackend) return null;
      return `${API_BASE}/pedidos/stream?token=${encodeURIComponent(token)}`;
    },
  },

  // ---- Facturas / POS ----
  facturas: {
    list:         (params = {}) => api.get('/facturas/' + buildQuery(params), true),
    get:          (id)          => api.get(`/facturas/${id}`, true),
    create:       (data)        => api.post('/facturas/', data, true),
    updateEstado: (id, estado, extra = {}) => api.put(`/facturas/${id}/estado`, { estado, ...extra }, true),
    stats:        ()            => api.get('/facturas/stats', true),
    pdfUrl:       (id, download = false) => {
      const { token } = getActiveSession();
      const qs = new URLSearchParams();
      if (download) qs.set('download', '1');
      if (token) qs.set('token', token);
      const suffix = qs.toString();
      return `${API_BASE}/facturas/${id}/pdf${suffix ? '?' + suffix : ''}`;
    },
  },

  // ---- Inventario Dual ----
  inventario: {
    movimientos: (params = {}) => api.get('/inventario/movimientos' + buildQuery(params), true),
    entrada:     (data)        => api.post('/inventario/entrada', data, true),
    salida:      (data)        => api.post('/inventario/salida', data, true),
    traslado:    (data)        => api.post('/inventario/traslado', data, true),
    ajuste:      (data)        => api.post('/inventario/ajuste', data, true),
    resumen:     ()            => api.get('/inventario/resumen', true),
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

  // ---- Dashboard & Respaldo BD ----
  dashboard: {
    kpis:         () => api.get('/dashboard/kpis', true),
    ventasSemana: () => api.get('/dashboard/ventas-semana', true),
    topProductos: () => api.get('/dashboard/top-productos', true),
    stockCritico: () => api.get('/dashboard/stock-critico', true),
    backup:       () => api.get('/dashboard/backup', true),
    restore:      (data) => api.post('/dashboard/restore', data, true),
  },

  // ---- Promoción / Descuento General de Tienda ----
  promocion: {
    get:      ()     => api.get('/promocion'),
    getAdmin: ()     => api.get('/promocion/admin', true),
    update:   (data) => api.put('/promocion', data, true),
  },
};

async function fetchProductos(params = {}) { return await api.productos.list(params); }
async function fetchKPIs() { return await api.dashboard.kpis(); }
async function fetchPedidos(params = {}) { return await api.pedidos.list(params); }

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

  if (f === 'skincare') return prodLinea === 'skincare' || prodCat === 'skincare' || SKINCARE_SUBCATS.some(s => prodCat.includes(s));
  if (f === 'makeup' || f === 'maquillaje') return prodLinea === 'makeup' || prodCat === 'makeup' || MAKEUP_SUBCATS.some(s => prodCat.includes(s));
  if (f === 'serums' || f === 'sueros' || f.includes('sueros')) return prodCat.includes('suero') || prodCat.includes('serum') || prodCat.includes('esencia');
  if (f.includes('hidratante')) return prodCat.includes('hidratante') || prodCat.includes('crema');
  if (f.includes('protector')) return prodCat.includes('protector') || prodCat.includes('solar');
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
  toast.innerHTML = `<span>${icons[type] || '✨'}</span><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3600);
}

// ---- Historial privado de pedidos del propio cliente (Ley 787) ----
function getMyLocalOrders() {
  try {
    const arr = JSON.parse(localStorage.getItem(MY_ORDERS_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveMyLocalOrder(order) {
  if (!order || !order.numero_pedido) return;
  try {
    const list = getMyLocalOrders().filter(o => o.numero_pedido !== order.numero_pedido);
    list.unshift({
      numero_pedido: order.numero_pedido,
      total: Number(order.total || 0),
      fecha: order.fecha || new Date().toISOString()
    });
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

// ---- Sesión activa ----
function getActiveSession() {
  let token = null;
  let user = null;
  try {
    token = localStorage.getItem('sisco_token');
    user = JSON.parse(localStorage.getItem('sisco_user') || 'null');
  } catch {}
  return { token, user };
}

function clearActiveSession() {
  try {
    localStorage.removeItem('sisco_token');
    localStorage.removeItem('sisco_user');
  } catch {}
}

// ---- Carrito compartido con control de stock y Cupones Promocionales ----
function getCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem('sisco_cart') || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveCart(cart) {
  try { localStorage.setItem('sisco_cart', JSON.stringify(Array.isArray(cart) ? cart : [])); } catch {}
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

function getAppliedCoupon() {
  const activePromo = getCachedStorePromo();
  if (!activePromo) return null;
  try {
    const c = JSON.parse(localStorage.getItem('sisco_coupon') || 'null');
    if (c && String(c.code || '').trim().toUpperCase() === activePromo.codigo) {
      return {
        code: activePromo.codigo,
        pct: activePromo.porcentaje,
        label: activePromo.descripcion
      };
    }
  } catch {}
  return null;
}

function applyPromoCoupon(rawCode) {
  const activePromo = getCachedStorePromo();
  if (!activePromo) {
    showToast('Actualmente no hay un descuento general habilitado en la tienda.', 'error');
    return null;
  }
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    showToast('Ingresa o selecciona el código de descuento.', 'error');
    return null;
  }
  if (code !== activePromo.codigo) {
    showToast(`Código inválido. El código activo es ${activePromo.codigo}.`, 'error');
    return null;
  }
  const applied = {
    code: activePromo.codigo,
    pct: activePromo.porcentaje,
    label: activePromo.descripcion
  };
  localStorage.setItem('sisco_coupon', JSON.stringify(applied));
  showToast(`🎉 Descuento ${applied.code} (-${applied.pct}%) aplicado`, 'success');
  return applied;
}

function clearPromoCoupon(silent = false) {
  localStorage.removeItem('sisco_coupon');
  if (!silent) showToast('Descuento retirado', 'info');
}

// ---- Navegación pública, Rastreo Seguro y Test de Piel K-Beauty ----
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
          <div class="modal-title">📦 Rastrear mi pedido</div>
          <button class="modal-close" onclick="document.getElementById('globalTrackingModal').classList.remove('active')">✕</button>
        </div>
        <p style="font-size:0.86rem;color:var(--color-text-muted);margin-bottom:12px;">Ingresa tu código de pedido (ej: <strong>SS-000101</strong>) para ver el estado en tiempo real:</p>
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

  // Mostrar SOLO pedidos hechos desde ESTE dispositivo (privacidad Ley 787)
  const myOrders = getMyLocalOrders();
  const pillsBox = document.getElementById('recentOrdersQuickPills');
  if (pillsBox) {
    if (myOrders.length) {
      pillsBox.innerHTML = `
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin-bottom:6px;font-weight:600;">📋 Tus pedidos recientes en este dispositivo:</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${myOrders.slice(0, 5).map(o => `
            <button type="button" class="badge badge-primary" style="cursor:pointer;border:none;padding:5px 10px;" onclick="document.getElementById('trackingCodeInput').value='${escapeHtml(o.numero_pedido)}';submitOrderTracking();">
              ${escapeHtml(o.numero_pedido)} · ${formatCurrency(o.total)}
            </button>`).join('')}
        </div>`;
    } else {
      pillsBox.innerHTML = '';
    }
  }

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
    const itemsHtml = (o.items || []).map(it => `<div style="font-size:0.78rem;color:var(--color-text-muted);">• ${it.cantidad}x ${escapeHtml(it.nombre_producto)} (${formatCurrency(it.subtotal)})</div>`).join('');
    box.innerHTML = `
      <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:16px;border:1px solid var(--color-surface-3);">
        <div class="flex-between" style="margin-bottom:8px;">
          <strong style="color:var(--color-primary-darker);font-size:1rem;">${escapeHtml(o.numero_pedido)}</strong>
          <span class="badge badge-primary">${labels[o.estado] || escapeHtml(o.estado)}</span>
        </div>
        <div style="font-size:0.84rem;color:var(--color-text-muted);line-height:1.7;">
          <div><strong>Cliente:</strong> ${escapeHtml(o.nombre_cliente)}</div>
          <div><strong>Modalidad:</strong> ${o.metodo_entrega === 'retiro' ? 'Retiro en Concept Store' : 'Envío a domicilio'}</div>
          ${o.motorizado_nombre ? `<div><strong>Motorizado:</strong> 🛵 ${escapeHtml(o.motorizado_nombre)}</div>` : ''}
          <div><strong>Total:</strong> <strong style="color:var(--color-primary-darker);">${formatCurrency(o.total)}</strong></div>
          <div><strong>Fecha:</strong> ${formatDateTime(o.fecha)}</div>
          ${itemsHtml ? `<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--color-surface-3);"><strong>Productos:</strong>${itemsHtml}</div>` : ''}
        </div>
      </div>`;
  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message || 'No se encontró el pedido indicado.')}</div>`;
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
            <img src="${resolveImageUrl(p.imagen_url)}" onerror="handleImgError(this)" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" alt="${escapeHtml(p.nombre)}" />
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.7rem;font-weight:700;color:var(--color-primary);">PASO ${idx + 1} · ${escapeHtml(p.marca || 'K-Beauty')}</div>
              <div style="font-size:0.84rem;font-weight:700;color:var(--color-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.nombre)}</div>
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

function initPublicNavbar() {
  updateCartBadge();
  const nav = document.querySelector('.navbar-nav');
  if (nav && !nav.querySelector('[data-skin-quiz]')) {
    const a = document.createElement('a');
    a.href = '#';
    a.setAttribute('data-skin-quiz', '');
    a.className = 'nav-link';
    a.style.cssText = 'color:var(--color-primary-dark);font-weight:700;';
    a.textContent = '✨ Test de Piel';
    a.onclick = (ev) => { ev.preventDefault(); openSkinQuizModal(); };
    nav.appendChild(a);
  }

  const actions = document.querySelector('.navbar-actions');
  if (!actions) return;

  const { token, user } = getActiveSession();
  const adminLink = actions.querySelector('[data-nav-auth]');
  if (adminLink) {
    if (token && user && user.rol === 'admin') {
      adminLink.href = 'admin/dashboard.html';
      adminLink.innerHTML = '⚙️ Panel SISCO';
      adminLink.className = 'btn btn-primary btn-sm';
    } else if (token && user && user.rol === 'vendedor') {
      adminLink.href = 'admin/pedidos.html';
      adminLink.innerHTML = '🛍️ Panel Ventas';
      adminLink.className = 'btn btn-primary btn-sm';
    } else if (token && user) {
      adminLink.href = '#';
      adminLink.textContent = `👤 ${(user.nombre || 'Cuenta').split(' ')[0]} (Salir)`;
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

  // Mostrar aviso sutil en la barra superior solo si el admin habilitó un descuento general en la tienda
  fetchActiveStorePromo().then(promo => {
    const bar = document.querySelector('.top-notice-bar');
    if (!bar || !promo || !promo.activo || bar.querySelector('[data-promo-notice]')) return;
    const span = document.createElement('span');
    span.setAttribute('data-promo-notice', '1');
    span.innerHTML = ` · 🎉 <strong>${escapeHtml(promo.porcentaje)}% OFF</strong> en toda la tienda con el código <strong>${escapeHtml(promo.codigo)}</strong>`;
    bar.appendChild(span);
  }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('admin-body')) {
    initPublicNavbar();
  }
});
