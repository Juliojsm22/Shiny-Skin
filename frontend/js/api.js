/**
 * SISCO – Shiny Skin | api.js
 * Cliente HTTP para comunicarse con el backend Flask
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

// ---- HTTP client ----
async function request(method, path, body = null, auth = false) {
  const headers = {};
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (auth) {
    const token = localStorage.getItem('sisco_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const opts = { method, headers };
  
  if (body) {
    opts.body = body instanceof FormData ? body : JSON.stringify(body);
  }
  
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

const api = {
  get:    (path, auth = false)        => request('GET',    path, null, auth),
  post:   (path, body, auth = false)  => request('POST',   path, body, auth),
  put:    (path, body, auth = false)  => request('PUT',    path, body, auth),
  delete: (path, auth = false)        => request('DELETE', path, null, auth),

  // ---- Auth ----
  auth: {
    login:    (data) => api.post('/auth/login', data),
    register: (data) => api.post('/auth/register', data),
    me:       ()     => api.get('/auth/me', true),
    usuarios: ()     => api.get('/auth/usuarios', true),
  },

  // ---- Productos ----
  productos: {
    list:        (params = {}) => api.get('/productos/?' + new URLSearchParams(params)),
    get:         (id)          => api.get(`/productos/${id}`),
    create:      (data)        => api.post('/productos/', data, true),
    update:      (id, data)    => api.put(`/productos/${id}`, data, true),
    delete:      (id)          => api.delete(`/productos/${id}`, true),
    categorias:  ()            => api.get('/productos/categorias'),
    marcas:      ()            => api.get('/productos/marcas'),
    stockCritico: ()           => api.get('/productos/stock-critico'),
  },

  // ---- Pedidos ----
  pedidos: {
    list:       (params = {}) => api.get('/pedidos/?' + new URLSearchParams(params)),
    get:        (id)          => api.get(`/pedidos/${id}`),
    create:     (data)        => api.post('/pedidos/', data),
    updateEstado: (id, estado) => api.put(`/pedidos/${id}/estado`, { estado }, true),
    stats:      ()            => api.get('/pedidos/stats', true),
  },

  // ---- Facturas ----
  facturas: {
    list:       (params = {}) => api.get('/facturas/?' + new URLSearchParams(params)),
    get:        (id)          => api.get(`/facturas/${id}`, true),
    create:     (data)        => api.post('/facturas/', data, true),
    updateEstado: (id, estado) => api.put(`/facturas/${id}/estado`, { estado }, true),
    stats:      ()            => api.get('/facturas/stats', true),
  },

  // ---- Inventario ----
  inventario: {
    movimientos: (params = {}) => api.get('/inventario/movimientos?' + new URLSearchParams(params)),
    entrada:     (data)        => api.post('/inventario/entrada', data, true),
    ajuste:      (data)        => api.post('/inventario/ajuste', data, true),
    resumen:     ()            => api.get('/inventario/resumen'),
  },

  // ---- Dashboard ----
  dashboard: {
    kpis:         () => api.get('/dashboard/kpis', true),
    ventasSemana: () => api.get('/dashboard/ventas-semana', true),
    topProductos: () => api.get('/dashboard/top-productos', true),
    stockCritico: () => api.get('/dashboard/stock-critico', true),
  },
};

// ---- MOCK DATA (fallback cuando el backend no está disponible) ----
const MOCK_PRODUCTS = [
  { id: 1, nombre: 'ANUA Heartleaf 77% Soothing Serum', sku: 'SKN-SER-001', marca: 'ANUA', categoria: 'Sueros & Esencias', precio_venta: 720, precio_final: 720, descuento: 0, stock: 30, es_nuevo: true, es_destacado: true, imagen_url: 'https://images.unsplash.com/photo-1620916297397-a4a5402a3c6c?w=400', descripcion: 'Suero calmante con 77% de hoja de corazón. Calma irritaciones y reduce el enrojecimiento.', beneficios: 'Calma irritaciones · Reduce enrojecimiento · Controla el sebo' },
  { id: 2, nombre: 'COSRX Advanced Snail 96 Mucin Essence', sku: 'SKN-SER-003', marca: 'COSRX', categoria: 'Sueros & Esencias', precio_venta: 620, precio_final: 527, descuento: 15, stock: 22, es_nuevo: false, es_destacado: true, imagen_url: 'https://images.unsplash.com/photo-1631730359585-5b07fe4eb3f0?w=400', descripcion: 'Esencia de mucina de caracol al 96%. Regeneración celular y super hidratación.' },
  { id: 3, nombre: 'Purito Daily Go-To Sunscreen SPF50+ PA++++', sku: 'SKN-SOL-001', marca: 'Purito', categoria: 'Protectores Solares', precio_venta: 680, precio_final: 680, descuento: 0, stock: 35, es_nuevo: false, es_destacado: true, imagen_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400', descripcion: 'Protector solar ligero de acabado invisible. Fórmula mineral y química combinada.' },
  { id: 4, nombre: 'rom&nd Juicy Lasting Tint – 21 Grab Cherry', sku: 'MKP-LAB-001', marca: 'rom&nd', categoria: 'Labios', precio_venta: 560, precio_final: 560, descuento: 0, stock: 25, es_nuevo: true, es_destacado: true, imagen_url: 'https://images.unsplash.com/photo-1631214524020-3c69b4eef11d?w=400', descripcion: 'Tinta labial ultra duradera con acabado jugoso.' },
  { id: 5, nombre: 'Numbuzin No.5 Vitamin Niacinamide Serum', sku: 'SKN-SER-002', marca: 'Numbuzin', categoria: 'Sueros & Esencias', precio_venta: 890, precio_final: 890, descuento: 0, stock: 14, es_nuevo: false, es_destacado: true, imagen_url: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=400', descripcion: 'Suero iluminador con vitamina C y niacinamida al 5%.' },
  { id: 6, nombre: 'Biodance Bio-Collagen Real Deep Mask Cream', sku: 'SKN-HID-001', marca: 'Biodance', categoria: 'Hidratantes & Cremas', precio_venta: 780, precio_final: 663, descuento: 15, stock: 16, es_nuevo: true, es_destacado: false, imagen_url: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=400', descripcion: 'Crema hidratante intensiva con colágeno y PDRN.' },
  { id: 7, nombre: 'ANUA Heartleaf Pore Control Cleansing Oil', sku: 'SKN-LMP-001', marca: 'ANUA', categoria: 'Limpiadores', precio_venta: 580, precio_final: 580, descuento: 0, stock: 25, es_nuevo: false, es_destacado: true, imagen_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400', descripcion: 'Aceite limpiador con hoja de corazón.' },
  { id: 8, nombre: 'Skin1004 Madagascar Centella Air-Fit Suncream', sku: 'SKN-SOL-002', marca: 'Skin1004', categoria: 'Protectores Solares', precio_venta: 650, precio_final: 650, descuento: 0, stock: 28, es_nuevo: true, es_destacado: false, imagen_url: 'https://images.unsplash.com/photo-1583241749552-f3b3a95d8a20?w=400', descripcion: 'Protector solar calmante con centella asiática.' },
  { id: 9, nombre: 'rom&nd Bare Water Cushion SPF40+ – Natural Beige', sku: 'MKP-ROS-001', marca: 'rom&nd', categoria: 'Rostro', precio_venta: 950, precio_final: 950, descuento: 0, stock: 12, es_nuevo: false, es_destacado: true, imagen_url: 'https://images.unsplash.com/photo-1599307767787-fd7a135ae5c2?w=400', descripcion: 'Cushion de cobertura media-alta con acabado agua natural.' },
  { id: 10, nombre: 'Medicube PDRN Pink Collagen Jelly Eye Mask', sku: 'SKN-MSK-001', marca: 'Medicube', categoria: 'Mascarillas', precio_venta: 520, precio_final: 520, descuento: 0, stock: 40, es_nuevo: false, es_destacado: true, imagen_url: 'https://images.unsplash.com/photo-1603706582948-64b9b9f8f9da?w=400', descripcion: 'Parches de gel con PDRN y colágeno para el contorno de ojos.' },
  { id: 11, nombre: 'COSRX Low pH Good Morning Gel Cleanser', sku: 'SKN-LMP-002', marca: 'COSRX', categoria: 'Limpiadores', precio_venta: 490, precio_final: 490, descuento: 0, stock: 18, es_nuevo: true, es_destacado: false, imagen_url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400', descripcion: 'Gel limpiador de bajo pH. Apto para piel sensible y acneica.' },
  { id: 12, nombre: 'Innisfree Green Tea Hyaluronic Toner', sku: 'SKN-TON-001', marca: 'Innisfree', categoria: 'Tónicos', precio_venta: 530, precio_final: 530, descuento: 0, stock: 22, es_nuevo: false, es_destacado: false, imagen_url: 'https://images.unsplash.com/photo-1629732051695-79eeaeb03e61?w=400', descripcion: 'Tónico hidratante con extracto de té verde de Jeju.' },
];

const MOCK_KPIS = {
  ventas_hoy: 4280, ventas_mes: 89640, pedidos_pendientes: 7,
  pedidos_hoy: 12, total_productos: 15, stock_critico: 3, facturas_pendientes: 4
};

const MOCK_ORDERS = [
  { id: 1, numero_pedido: 'SS-000001', nombre_cliente: 'María González', telefono_cliente: '505-8888-1111', estado: 'entregado', total: 1437.80, canal: 'web', fecha: '2026-09-01T10:30:00', items: [] },
  { id: 2, numero_pedido: 'SS-000002', nombre_cliente: 'Andrea López', telefono_cliente: '505-8777-2222', estado: 'confirmado', total: 862.40, canal: 'web', fecha: '2026-09-03T14:20:00', items: [] },
  { id: 3, numero_pedido: 'SS-000003', nombre_cliente: 'Valeria Castro', telefono_cliente: '505-8666-3333', estado: 'pendiente', total: 1265.50, canal: 'web', fecha: '2026-09-05T09:15:00', items: [] },
  { id: 4, numero_pedido: 'SS-000004', nombre_cliente: 'Sofía Martínez', telefono_cliente: '505-8555-4444', estado: 'en_camino', total: 690.00, canal: 'web', fecha: '2026-09-05T16:45:00', items: [] },
  { id: 5, numero_pedido: 'SS-000005', nombre_cliente: 'Daniela Ruiz', telefono_cliente: '505-8444-5555', estado: 'pendiente', total: 1100.70, canal: 'web', fecha: '2026-09-06T08:00:00', items: [] },
];

// Intentar usar la API real, con fallback a datos mock
async function fetchProductos(params = {}) {
  try { return await api.productos.list(params); }
  catch { return MOCK_PRODUCTS; }
}
async function fetchKPIs() {
  try { return await api.dashboard.kpis(); }
  catch { return MOCK_KPIS; }
}
async function fetchPedidos(params = {}) {
  try { return await api.pedidos.list(params); }
  catch { return MOCK_ORDERS; }
}

// Utilidades
function formatCurrency(amount) {
  return 'C$ ' + Number(amount).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(isoStr) {
  return new Date(isoStr).toLocaleString('es-NI', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function showToast(msg, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
  const icons = { success: '✅', error: '❌', info: '💬' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || '💬'}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; setTimeout(() => toast.remove(), 300); }, 3200);
}
