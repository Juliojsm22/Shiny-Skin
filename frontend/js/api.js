/**
 * SISCO – Shiny Skin | api.js
 * Cliente HTTP unificado, utilidades globales y respaldo offline
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

// ---- HTTP client ----
async function request(method, path, body = null, auth = false) {
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
    const e = new Error('No se pudo conectar con el servidor SISCO.');
    e.isNetworkError = true;
    throw e;
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const e = new Error(errBody.error || `Error HTTP ${res.status}`);
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

// ---- MOCK DATA (respaldo si se abre sin servidor activo) ----
const MOCK_PRODUCTS = [
  { id: 1, nombre: 'ANUA Heartleaf 77% Soothing Serum', sku: 'SKN-SER-001', marca: 'ANUA', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '30 ml', precio_costo: 400, precio_venta: 720, precio_final: 720, descuento: 0, stock: 30, stock_fisico: 14, stock_online: 16, stock_minimo: 8, es_nuevo: true, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80', descripcion: 'Suero calmante con 77% de hoja de corazón. Calma irritaciones y reduce el enrojecimiento.', beneficios: 'Calma irritaciones · Reduce enrojecimiento · Equilibra el sebo', ingredientes: 'Houttuynia Cordata Extract 77%, Pantenol, Ácido Hialurónico' },
  { id: 2, nombre: 'COSRX Advanced Snail 96 Mucin Essence', sku: 'SKN-SER-003', marca: 'COSRX', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '100 ml', precio_costo: 350, precio_venta: 620, precio_final: 527, descuento: 15, stock: 22, stock_fisico: 10, stock_online: 12, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=600&q=80', descripcion: 'Esencia de mucina de caracol al 96% para regeneración celular e hidratación profunda.', beneficios: 'Regeneración cutánea · Hidratación profunda · Textura glass skin', ingredientes: 'Snail Secretion Filtrate 96%, Sodium Hyaluronate, Allantoin' },
  { id: 3, nombre: 'Purito Daily Go-To Sunscreen SPF50+ PA++++', sku: 'SKN-SOL-001', marca: 'Purito', linea: 'Skincare', categoria: 'Protectores Solares', tamano: '60 ml', precio_costo: 380, precio_venta: 680, precio_final: 680, descuento: 0, stock: 35, stock_fisico: 18, stock_online: 17, stock_minimo: 6, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80', descripcion: 'Protector solar ligero de acabado invisible sin rastro blanco.', beneficios: 'SPF50+ PA++++ · Sin white cast · Con Centella Asiática' },
  { id: 4, nombre: 'rom&nd Juicy Lasting Tint – 21 Grab Cherry', sku: 'MKP-LAB-001', marca: 'rom&nd', linea: 'Makeup', categoria: 'Labios', tamano: '5.5 g', tono: '21 Grab Cherry', precio_costo: 310, precio_venta: 560, precio_final: 560, descuento: 0, stock: 25, stock_fisico: 12, stock_online: 13, stock_minimo: 5, es_nuevo: true, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=600&q=80', descripcion: 'Tinta labial coreana ultra duradera con acabado jugoso brillante.' },
  { id: 5, nombre: 'Numbuzin No.5 Vitamin Niacinamide Serum', sku: 'SKN-SER-002', marca: 'Numbuzin', linea: 'Skincare', categoria: 'Sueros & Esencias', tamano: '30 ml', precio_costo: 490, precio_venta: 890, precio_final: 890, descuento: 0, stock: 4, stock_fisico: 2, stock_online: 2, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1617897903246-719242758050?auto=format&fit=crop&w=600&q=80', descripcion: 'Suero iluminador con vitamina C, glutatión y niacinamida al 5%.' },
  { id: 6, nombre: 'Biodance Bio-Collagen Real Deep Mask Cream', sku: 'SKN-HID-001', marca: 'Biodance', linea: 'Skincare', categoria: 'Hidratantes & Cremas', tamano: '50 ml', precio_costo: 430, precio_venta: 780, precio_final: 663, descuento: 15, stock: 16, stock_fisico: 8, stock_online: 8, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1570194065650-d99fb4b8ccb0?auto=format&fit=crop&w=600&q=80', descripcion: 'Crema hidratante intensiva con bio-colágeno y ácido hialurónico.' },
  { id: 7, nombre: 'ANUA Heartleaf Pore Control Cleansing Oil', sku: 'SKN-LMP-001', marca: 'ANUA', linea: 'Skincare', categoria: 'Limpiadores', tamano: '200 ml', precio_costo: 320, precio_venta: 580, precio_final: 522, descuento: 10, stock: 25, stock_fisico: 12, stock_online: 13, stock_minimo: 5, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=600&q=80', descripcion: 'Aceite limpiador suave para doble limpieza coreana.' },
  { id: 8, nombre: 'Skin1004 Madagascar Centella Air-Fit Suncream', sku: 'SKN-SOL-002', marca: 'Skin1004', linea: 'Skincare', categoria: 'Protectores Solares', tamano: '50 ml', precio_costo: 360, precio_venta: 650, precio_final: 650, descuento: 0, stock: 28, stock_fisico: 14, stock_online: 14, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=600&q=80', descripcion: 'Protector solar calmante con Centella Asiática de Madagascar.' },
  { id: 9, nombre: 'rom&nd Bare Water Cushion SPF40+ – Natural Beige', sku: 'MKP-ROS-001', marca: 'rom&nd', linea: 'Makeup', categoria: 'Rostro', tamano: '15 g', tono: '21 Natural Beige', precio_costo: 520, precio_venta: 950, precio_final: 950, descuento: 0, stock: 12, stock_fisico: 6, stock_online: 6, stock_minimo: 4, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=600&q=80', descripcion: 'Base cushion coreana de acabado hidratado luminoso.' },
  { id: 10, nombre: 'Medicube PDRN Pink Collagen Jelly Eye Mask', sku: 'SKN-MSK-001', marca: 'Medicube', linea: 'Skincare', categoria: 'Mascarillas', tamano: '60 parches', precio_costo: 290, precio_venta: 520, precio_final: 520, descuento: 0, stock: 40, stock_fisico: 20, stock_online: 20, stock_minimo: 8, es_nuevo: false, es_destacado: true, activo: true, imagen_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=600&q=80', descripcion: 'Parches de hidrogel con PDRN y colágeno para contorno de ojos.' },
  { id: 11, nombre: 'COSRX Low pH Good Morning Gel Cleanser', sku: 'SKN-LMP-002', marca: 'COSRX', linea: 'Skincare', categoria: 'Limpiadores', tamano: '150 ml', precio_costo: 280, precio_venta: 490, precio_final: 490, descuento: 0, stock: 18, stock_fisico: 8, stock_online: 10, stock_minimo: 5, es_nuevo: true, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80', descripcion: 'Gel limpiador diario de pH balanceado 5.5.' },
  { id: 12, nombre: 'Innisfree Green Tea Hyaluronic Toner', sku: 'SKN-TON-001', marca: 'Innisfree', linea: 'Skincare', categoria: 'Tónicos', tamano: '170 ml', precio_costo: 300, precio_venta: 530, precio_final: 530, descuento: 0, stock: 22, stock_fisico: 11, stock_online: 11, stock_minimo: 5, es_nuevo: false, es_destacado: false, activo: true, imagen_url: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&w=600&q=80', descripcion: 'Tónico hidratante con té verde de la isla Jeju y 5 ácidos hialurónicos.' },
];

const MOCK_KPIS = {
  ventas_hoy: 4280, ventas_mes: 89640, gastos_mes: 14500, balance_mes: 75140,
  pedidos_pendientes: 4, pedidos_hoy: 8, total_productos: 15, stock_critico: 2,
  facturas_pendientes: 2, total_clientes: 18
};

const MOCK_ORDERS = [
  { id: 1, numero_pedido: 'SS-000101', nombre_cliente: 'María Fernanda González', telefono_cliente: '505-8888-1111', metodo_entrega: 'domicilio', direccion_entrega: 'Altamira, Managua', estado: 'entregado', subtotal: 1440, descuento: 0, costo_envio: 0, iva: 0, total: 1440, metodo_pago: 'efectivo_entrega', canal: 'web', fecha: '2026-10-28T10:30:00', items: [] },
  { id: 2, numero_pedido: 'SS-000102', nombre_cliente: 'Andrea Carolina López', telefono_cliente: '505-8777-2222', metodo_entrega: 'retiro', direccion_entrega: 'Concept Store Camino de Oriente', estado: 'confirmado', subtotal: 890, descuento: 0, costo_envio: 0, iva: 0, total: 890, metodo_pago: 'transferencia', canal: 'whatsapp', fecha: '2026-10-30T14:20:00', items: [] },
  { id: 3, numero_pedido: 'SS-000103', nombre_cliente: 'Valeria Castro Rivas', telefono_cliente: '505-8666-3333', metodo_entrega: 'domicilio', direccion_entrega: 'Las Colinas, Managua', estado: 'pendiente', subtotal: 1240, descuento: 0, costo_envio: 120, iva: 0, total: 1360, metodo_pago: 'efectivo_entrega', canal: 'instagram', fecha: '2026-11-01T09:15:00', items: [] },
];

async function fetchProductos(params = {}) {
  try { return await api.productos.list(params); }
  catch (e) { if (e.isNetworkError) return MOCK_PRODUCTS; throw e; }
}
async function fetchKPIs() {
  try { return await api.dashboard.kpis(); }
  catch { return MOCK_KPIS; }
}
async function fetchPedidos(params = {}) {
  try { return await api.pedidos.list(params); }
  catch (e) { if (e.isNetworkError) return MOCK_ORDERS; throw e; }
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

// ---- Carrito compartido con control de stock ----
function getCart() {
  try { return JSON.parse(localStorage.getItem('sisco_cart') || '[]'); }
  catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem('sisco_cart', JSON.stringify(cart));
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

// ---- Navegación pública, sesión y modal de Rastreo de Pedido ----
function toggleMobileNav() {
  const nav = document.querySelector('.navbar-nav');
  if (nav) nav.classList.toggle('open');
}

function openTrackingModal(prefill = '') {
  let modal = document.getElementById('globalTrackingModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'globalTrackingModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:500px;">
        <div class="modal-header">
          <div class="modal-title">📦 Rastrear mi pedido</div>
          <button class="modal-close" onclick="document.getElementById('globalTrackingModal').classList.remove('active')">✕</button>
        </div>
        <p style="font-size:0.88rem;color:var(--color-text-muted);margin-bottom:14px;">Ingresa tu código de pedido (ejemplo: <strong>SS-123456</strong>) para consultar su estado en tiempo real.</p>
        <form onsubmit="submitOrderTracking(event)" style="display:flex;gap:8px;margin-bottom:16px;">
          <input type="text" id="trackingCodeInput" class="form-control" placeholder="Ej. SS-000101" required />
          <button type="submit" class="btn btn-primary btn-sm">Consultar</button>
        </form>
        <div id="trackingResultBox"></div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
    document.body.appendChild(modal);
  }
  modal.classList.add('active');
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
    box.innerHTML = `
      <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:16px;border:1px solid var(--color-surface-3);">
        <div class="flex-between" style="margin-bottom:8px;">
          <strong style="color:var(--color-primary-darker);font-size:1rem;">${o.numero_pedido}</strong>
          <span class="badge badge-primary">${labels[o.estado] || o.estado}</span>
        </div>
        <div style="font-size:0.84rem;color:var(--color-text-muted);line-height:1.7;">
          <div><strong>Cliente:</strong> ${o.nombre_cliente}</div>
          <div><strong>Modalidad:</strong> ${o.metodo_entrega === 'retiro' ? 'Retiro en Concept Store' : 'Envío a domicilio'}</div>
          ${o.motorizado_nombre ? `<div><strong>Motorizado:</strong> ${o.motorizado_nombre} (${o.motorizado_telefono || ''})</div>` : ''}
          <div><strong>Total:</strong> <strong style="color:var(--color-primary-darker);">${formatCurrency(o.total)}</strong></div>
          <div><strong>Fecha:</strong> ${formatDateTime(o.fecha)}</div>
        </div>
      </div>`;
  } catch (err) {
    box.innerHTML = `<div class="alert alert-danger">${err.message || 'No se encontró el pedido indicado.'}</div>`;
  }
}

function initPublicNavbar() {
  updateCartBadge();
  const actions = document.querySelector('.navbar-actions');
  if (!actions) return;

  let user = null;
  try { user = JSON.parse(localStorage.getItem('sisco_user') || 'null'); } catch {}
  const token = localStorage.getItem('sisco_token');

  // Actualizar botón de acceso / panel según sesión real (NFR-0012)
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
        localStorage.removeItem('sisco_token');
        localStorage.removeItem('sisco_user');
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
