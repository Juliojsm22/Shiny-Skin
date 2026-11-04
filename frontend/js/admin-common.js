/**
 * SISCO – Shiny Skin | admin-common.js
 * Guardián de seguridad (NFR-0012), Sidebar unificado de 8 módulos,
 * Exportador Excel/CSV, Reporte Ejecutivo de Cierre PDF y Respaldo BD (NFR-0016)
 */

(function () {
  const token = localStorage.getItem('sisco_token');
  let user = null;
  try { user = JSON.parse(localStorage.getItem('sisco_user') || 'null'); } catch {}

  // Redirección obligatoria si no es personal autorizado (admin o vendedor)
  if (!token || !user || !['admin', 'vendedor'].includes(user.rol)) {
    window.location.replace('../login.html?next=' + encodeURIComponent(window.location.pathname));
    return;
  }

  window.SISCO_USER = user;
  window.IS_ADMIN = user.rol === 'admin';
})();

function logout() {
  localStorage.removeItem('sisco_token');
  localStorage.removeItem('sisco_user');
  window.location.href = '../login.html';
}

function toggleAdminSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('active');
}

function renderAdminSidebar(activePage) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const user = window.SISCO_USER || { nombre: 'Admin Shiny Skin', rol: 'admin' };
  const isAdmin = user.rol === 'admin';
  const roleLabel = isAdmin ? 'Administradora' : 'Vendedora';
  const initial = (user.nombre || 'A')[0].toUpperCase();

  const itemsPrincipal = [
    { id: 'dashboard',   href: 'dashboard.html',   icon: '📊', label: 'Dashboard' },
    { id: 'facturacion', href: 'facturacion.html', icon: '🧾', label: 'POS / Facturación' },
    { id: 'pedidos',     href: 'pedidos.html',     icon: '🛒', label: 'Pedidos & Envíos', badgeId: 'pendingBadge' },
  ];

  const itemsCatalogo = [
    { id: 'productos',   href: 'productos.html',   icon: '🧴', label: 'Productos' },
    { id: 'inventario',  href: 'inventario.html',  icon: '📦', label: 'Inventario Dual' },
    { id: 'clientes',    href: 'clientes.html',    icon: '👥', label: 'Cartera Clientes' },
  ];

  const itemsGestion = [
    { id: 'gastos',      href: 'gastos.html',      icon: '💸', label: 'Gastos Operativos' },
  ];
  if (isAdmin) {
    itemsGestion.push({ id: 'usuarios', href: 'usuarios.html', icon: '🔐', label: 'Usuarios & Roles' });
  }

  const renderGroup = (list) => list.map(it => `
    <a href="${it.href}" class="sidebar-item ${activePage === it.id ? 'active' : ''}">
      <span class="sidebar-icon">${it.icon}</span> ${it.label}
      ${it.badgeId ? `<span class="sidebar-badge" id="${it.badgeId}" style="display:none;">0</span>` : ''}
    </a>
  `).join('');

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <img src="../img/SHINY LOGO 1.jpg" alt="Shiny Skin" />
      <div>
        <div class="logo-text">Shiny <span>Skin</span></div>
        <div class="logo-sub">SISCO · Omnicanal</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section">Operación Diaria</div>
      ${renderGroup(itemsPrincipal)}
      <div class="sidebar-section">Catálogo & CRM</div>
      ${renderGroup(itemsCatalogo)}
      <div class="sidebar-section">Finanzas & Acceso</div>
      ${renderGroup(itemsGestion)}
      <button type="button" class="sidebar-item" onclick="openExecutiveReportModal()" style="width:100%;text-align:left;">
        <span class="sidebar-icon">📄</span> Cierre / Reporte PDF
      </button>
      ${isAdmin ? `
      <button type="button" class="sidebar-item" onclick="openBackupModal()" style="width:100%;text-align:left;">
        <span class="sidebar-icon">🛡️</span> Respaldo BD (NFR-0016)
      </button>` : ''}
      <div class="sidebar-section">Tienda Pública</div>
      <a href="../index.html" class="sidebar-item"><span class="sidebar-icon">🏠</span> Inicio Web</a>
      <a href="../tienda.html" class="sidebar-item"><span class="sidebar-icon">🛍️</span> Ver E-Commerce</a>
      <button type="button" class="sidebar-item" onclick="logout()" style="width:100%;text-align:left;color:#f87171;">
        <span class="sidebar-icon">🚪</span> Cerrar sesión
      </button>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-avatar" id="userAvatar">${initial}</div>
        <div style="min-width:0;">
          <div class="sidebar-user-name" id="userName" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.nombre}</div>
          <div class="sidebar-user-role" id="userRole">${roleLabel}</div>
        </div>
      </div>
    </div>
  `;

  if (!document.getElementById('sidebarBackdrop')) {
    const bd = document.createElement('div');
    bd.id = 'sidebarBackdrop';
    bd.className = 'sidebar-backdrop';
    bd.onclick = toggleAdminSidebar;
    document.body.appendChild(bd);
  }

  const topbar = document.querySelector('.admin-topbar');
  if (topbar && !topbar.querySelector('.admin-menu-toggle')) {
    const titleEl = topbar.querySelector('.topbar-title');
    if (titleEl) {
      const wrap = document.createElement('div');
      wrap.className = 'topbar-left';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-menu-toggle';
      btn.innerHTML = '☰';
      btn.title = 'Abrir menú';
      btn.onclick = toggleAdminSidebar;
      topbar.insertBefore(wrap, titleEl);
      wrap.appendChild(btn);
      wrap.appendChild(titleEl);
    }
  }

  if (!isAdmin) {
    document.querySelectorAll('[data-admin-only]').forEach(el => { el.style.display = 'none'; });
  }

  api.pedidos.stats().then(st => {
    const badge = document.getElementById('pendingBadge');
    if (badge && st && st.pendientes > 0) {
      badge.textContent = st.pendientes;
      badge.style.display = 'inline-block';
    }
  }).catch(() => {});
}

// =========================================================================
// EXPORTADOR UNIVERSAL EXCEL / CSV (con soporte UTF-8 BOM para tildes y C$)
// =========================================================================
function downloadCSVFile(filename, headers, rows) {
  const escapeCSV = (val) => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
    if (str.includes(',') || str.includes('"') || str.includes(';')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = '\uFEFF' + [
    headers.map(escapeCSV).join(','),
    ...rows.map(r => r.map(escapeCSV).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Archivo ${link.download} descargado para Excel`, 'success');
}

// =========================================================================
// MODAL DE RESPALDO Y RESTAURACIÓN DE BASE DE DATOS (NFR-0016)
// =========================================================================
function openBackupModal() {
  let modal = document.getElementById('siscoBackupModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'siscoBackupModal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  const db = typeof getLocalDB === 'function' ? getLocalDB() : {};
  const totalProds = (db.productos || []).length;
  const totalOrders = (db.pedidos || []).length;
  const totalFacs = (db.facturas || []).length;
  const totalClients = (db.clientes || []).length;

  modal.innerHTML = `
    <div class="admin-modal" style="max-width:560px;">
      <div class="modal-header">
        <div class="modal-title">🛡️ Respaldo y Restauración de Base de Datos (NFR-0016)</div>
        <button class="modal-close" onclick="document.getElementById('siscoBackupModal').classList.remove('active')">✕</button>
      </div>
      <p style="font-size:0.84rem;color:rgba(188,210,233,0.75);line-height:1.6;margin-bottom:16px;">
        Cumpliendo con el requisito no funcional <strong>NFR-0016</strong>, este módulo permite exportar una copia de seguridad íntegra del sistema (catálogo, inventario dual, pedidos, facturas, cartera de clientes y gastos) o restaurarla en cualquier otra computadora.
      </p>

      <div style="background:rgba(188,210,233,0.06);border:1px solid var(--admin-border);border-radius:12px;padding:14px;margin-bottom:18px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center;">
        <div><div style="font-size:1.2rem;font-weight:800;color:#fff;">${totalProds}</div><div style="font-size:0.72rem;color:var(--color-brand-pastel);">Productos</div></div>
        <div><div style="font-size:1.2rem;font-weight:800;color:#34d399;">${totalOrders}</div><div style="font-size:0.72rem;color:var(--color-brand-pastel);">Pedidos</div></div>
        <div><div style="font-size:1.2rem;font-weight:800;color:#60a5fa;">${totalFacs}</div><div style="font-size:0.72rem;color:var(--color-brand-pastel);">Facturas</div></div>
        <div><div style="font-size:1.2rem;font-weight:800;color:#fbbf24;">${totalClients}</div><div style="font-size:0.72rem;color:var(--color-brand-pastel);">Clientes</div></div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--admin-border);border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:#fff;">💾 1. Exportar Copia de Seguridad (JSON)</div>
            <div style="font-size:0.76rem;color:rgba(255,255,255,0.5);">Descarga todos los registros actuales en un archivo portable.</div>
          </div>
          <button type="button" class="btn-admin-primary" onclick="exportFullBackupJSON()" style="white-space:nowrap;">⬇️ Descargar Respaldo</button>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--admin-border);border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:#fff;">📂 2. Restaurar desde Archivo de Respaldo</div>
            <div style="font-size:0.76rem;color:rgba(255,255,255,0.5);">Carga un archivo .json previamente exportado desde otra PC.</div>
          </div>
          <label class="btn-admin-secondary" style="cursor:pointer;white-space:nowrap;margin:0;">
            📤 Subir JSON
            <input type="file" accept=".json" style="display:none;" onchange="handleRestoreBackupFile(event)" />
          </label>
        </div>

        <div style="background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.25);border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:#fca5a5;">🔄 3. Restaurar Datos Limpios de Demostración</div>
            <div style="font-size:0.76rem;color:rgba(255,255,255,0.55);">Ideal antes de iniciar una defensa o exposición para dejar el catálogo inicial limpio.</div>
          </div>
          <button type="button" class="btn-table btn-table-delete" onclick="resetFactoryDemoDB()" style="white-space:nowrap;padding:8px 14px;">Restablecer Demo</button>
        </div>
      </div>
    </div>
  `;
  modal.classList.add('active');
}

async function exportFullBackupJSON() {
  let dbData;
  if (typeof getLocalDB === 'function') {
    dbData = getLocalDB();
  } else {
    const [productos, pedidos, facturas, clientes, gastos] = await Promise.all([
      fetchProductos({ incluir_inactivos: 'true' }),
      fetchPedidos(),
      api.facturas.list(),
      api.clientes.list(),
      api.gastos.list()
    ]);
    dbData = { productos, pedidos, facturas, clientes, gastos, exported_at: new Date().toISOString() };
  }
  const dateStr = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SISCO_ShinySkin_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Copia de seguridad descargada exitosamente', 'success');
}

function handleRestoreBackupFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.productos)) {
        showToast('El archivo seleccionado no es un respaldo válido de SISCO.', 'error');
        return;
      }
      if (typeof saveLocalDB === 'function') {
        saveLocalDB(parsed);
      } else {
        localStorage.setItem('sisco_local_db_v2', JSON.stringify(parsed));
      }
      showToast('Base de datos restaurada con éxito. Recargando...', 'success');
      setTimeout(() => window.location.reload(), 700);
    } catch {
      showToast('Error al leer el archivo JSON de respaldo.', 'error');
    }
  };
  reader.readAsText(file);
}

function resetFactoryDemoDB() {
  if (!confirm('¿Restablecer la base de datos a su estado limpio de demostración (12 productos K-Beauty, pedidos y finanzas iniciales)?')) return;
  localStorage.removeItem('sisco_local_db_v2');
  try { window.name = ''; } catch {}
  if (typeof createInitialLocalDB === 'function' && typeof saveLocalDB === 'function') {
    saveLocalDB(createInitialLocalDB());
  }
  showToast('Datos de demostración restablecidos correctamente', 'success');
  setTimeout(() => window.location.reload(), 600);
}

// =========================================================================
// REPORTE EJECUTIVO DE CIERRE DE CAJA Y ESTADO DE RESULTADOS (PDF IMPRIMIBLE)
// =========================================================================
async function openExecutiveReportModal() {
  let modal = document.getElementById('siscoExecReportModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'siscoExecReportModal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `<div class="admin-modal" style="max-width:780px;text-align:center;padding:40px;">Generando Estado de Resultados y Cierre Omnicanal...</div>`;
  modal.classList.add('active');

  const [kpis, prods, orders, facs, gastos, topProds] = await Promise.all([
    fetchKPIs(),
    fetchProductos(),
    fetchPedidos(),
    api.facturas.list().catch(() => []),
    api.gastos.list().catch(() => []),
    api.dashboard.topProductos().catch(() => [])
  ]);

  const validOrders = (orders || []).filter(o => o.estado !== 'cancelado');
  const directFacs = (facs || []).filter(f => f.estado !== 'anulada' && !f.order_id);

  const ventasWeb = validOrders.filter(o => (o.canal || 'web') === 'web').reduce((s, o) => s + (o.total || 0), 0);
  const ventasWA = validOrders.filter(o => o.canal === 'whatsapp').reduce((s, o) => s + (o.total || 0), 0);
  const ventasIG = validOrders.filter(o => o.canal === 'instagram').reduce((s, o) => s + (o.total || 0), 0);
  const ventasPOS = validOrders.filter(o => o.canal === 'tienda_fisica').reduce((s, o) => s + (o.total || 0), 0)
    + directFacs.reduce((s, f) => s + (f.total || 0), 0);

  const totalUnidades = (prods || []).reduce((s, p) => s + (p.stock || 0), 0);
  const totalFisico = (prods || []).reduce((s, p) => s + (p.stock_fisico ?? p.stock ?? 0), 0);
  const totalOnline = (prods || []).reduce((s, p) => s + (p.stock_online ?? 0), 0);
  const costoInv = (prods || []).reduce((s, p) => s + (p.stock || 0) * (p.precio_costo || 0), 0);
  const ventaInv = (prods || []).reduce((s, p) => s + (p.stock || 0) * (p.precio_final || 0), 0);

  const totalGastos = kpis.gastos_mes ?? (gastos || []).reduce((s, g) => s + (g.monto || 0), 0);
  const totalIngresosMes = kpis.ventas_mes ?? (ventasWeb + ventasWA + ventasIG + ventasPOS);
  const utilidadNeta = totalIngresosMes - totalGastos;
  const user = window.SISCO_USER || { nombre: 'Administradora Shiny Skin' };
  const fechaEmision = new Date().toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' });

  modal.innerHTML = `
    <div class="admin-modal" style="max-width:800px;max-height:92vh;overflow-y:auto;">
      <div class="modal-header no-print">
        <div class="modal-title">📄 Reporte Ejecutivo de Cierre y Estado de Resultados</div>
        <button class="modal-close" onclick="document.getElementById('siscoExecReportModal').classList.remove('active')">✕</button>
      </div>

      <div id="printableExecutiveReport" style="background:#ffffff;color:#0f172a;padding:28px;border-radius:16px;font-size:0.84rem;line-height:1.55;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1a4973;padding-bottom:14px;margin-bottom:18px;">
          <div>
            <div style="font-size:1.45rem;font-weight:800;color:#1a4973;letter-spacing:-0.5px;">SHINY SKIN · NICARAGUA</div>
            <div style="font-size:0.8rem;color:#475569;">Sistema Web de Gestión Comercial e Inventario Omnicanal (SISCO)</div>
            <div style="font-size:0.76rem;color:#64748b;">Concept Store Camino de Oriente · Managua, Nicaragua · Régimen Cuota Fija (Ley N.° 842)</div>
          </div>
          <div style="text-align:right;font-size:0.76rem;color:#475569;">
            <div><strong>REPORTE EJECUTIVO GERENCIAL</strong></div>
            <div>Fecha: ${fechaEmision}</div>
            <div>Emitido por: ${user.nombre}</div>
          </div>
        </div>

        <!-- 1. Estado de Resultados Mensual -->
        <div style="font-weight:800;color:#1a4973;text-transform:uppercase;font-size:0.78rem;letter-spacing:0.6px;margin-bottom:8px;">
          1. Estado de Resultados y Balance Operativo del Mes (C$)
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
          <div style="background:#f1f6fb;border:1px solid #cbd5e1;border-radius:10px;padding:12px;">
            <div style="font-size:0.74rem;color:#475569;">Ingresos Brutos del Mes</div>
            <div style="font-size:1.25rem;font-weight:800;color:#1a4973;">${formatCurrency(totalIngresosMes)}</div>
            <div style="font-size:0.72rem;color:#64748b;">Ventas hoy: ${formatCurrency(kpis.ventas_hoy || 0)}</div>
          </div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;">
            <div style="font-size:0.74rem;color:#991b1b;">Egresos Operativos del Mes</div>
            <div style="font-size:1.25rem;font-weight:800;color:#dc2626;">-${formatCurrency(totalGastos)}</div>
            <div style="font-size:0.72rem;color:#7f1d1d;">${(gastos || []).length} partidas registradas</div>
          </div>
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px;">
            <div style="font-size:0.74rem;color:#065f46;">Utilidad Operativa Neta</div>
            <div style="font-size:1.25rem;font-weight:800;color:${utilidadNeta >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(utilidadNeta)}</div>
            <div style="font-size:0.72rem;color:#047857;">Margen neto: ${totalIngresosMes > 0 ? ((utilidadNeta / totalIngresosMes) * 100).toFixed(1) : 0}%</div>
          </div>
        </div>

        <!-- 2. Desglose por Canal y Valorización de Inventario -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
            <div style="font-weight:700;color:#1a4973;margin-bottom:8px;font-size:0.8rem;">2. Ventas Recientes por Canal de Atención</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;">🌐 Tienda Web E-Commerce</td><td style="text-align:right;font-weight:700;">${formatCurrency(ventasWeb)}</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;">💬 WhatsApp Business</td><td style="text-align:right;font-weight:700;">${formatCurrency(ventasWA)}</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;">📸 Instagram Direct</td><td style="text-align:right;font-weight:700;">${formatCurrency(ventasIG)}</td></tr>
              <tr><td style="padding:4px 0;">🏬 Concept Store (Caja POS)</td><td style="text-align:right;font-weight:700;">${formatCurrency(ventasPOS)}</td></tr>
            </table>
          </div>

          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
            <div style="font-weight:700;color:#1a4973;margin-bottom:8px;font-size:0.8rem;">3. Valorización de Inventario Dual (${(prods || []).length} SKUs)</div>
            <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;">Existencias Físico / Online</td><td style="text-align:right;font-weight:700;">${totalFisico} fís. + ${totalOnline} onl. (${totalUnidades} uds.)</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;">Costo Total en Bodega</td><td style="text-align:right;font-weight:700;">${formatCurrency(costoInv)}</td></tr>
              <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:4px 0;">Valor Comercial de Venta</td><td style="text-align:right;font-weight:700;">${formatCurrency(ventaInv)}</td></tr>
              <tr><td style="padding:4px 0;color:#059669;">Ganancia Bruta Proyectada</td><td style="text-align:right;font-weight:800;color:#059669;">+${formatCurrency(ventaInv - costoInv)}</td></tr>
            </table>
          </div>
        </div>

        <!-- 4. Top 5 Productos Más Vendidos -->
        <div style="font-weight:700;color:#1a4973;margin-bottom:6px;font-size:0.8rem;">4. Top 5 Productos de Mayor Rotación</div>
        <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-bottom:16px;">
          <thead>
            <tr style="background:#f1f6fb;color:#1a4973;text-align:left;">
              <th style="padding:6px 8px;">Producto K-Beauty</th>
              <th style="padding:6px 8px;text-align:center;">Unidades Vendidas</th>
              <th style="padding:6px 8px;text-align:right;">Ingresos Generados (C$)</th>
            </tr>
          </thead>
          <tbody>
            ${(topProds || []).map(t => `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:6px 8px;font-weight:600;">${t.producto || t.nombre}</td>
                <td style="padding:6px 8px;text-align:center;">${t.total_vendido} uds.</td>
                <td style="padding:6px 8px;text-align:right;font-weight:700;">${formatCurrency(t.ingresos)}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div style="display:flex;justify-content:space-between;margin-top:26px;padding-top:14px;border-top:1px dashed #cbd5e1;font-size:0.75rem;color:#64748b;">
          <div>Firma Responsable de Caja / Administración: ___________________________</div>
          <div>Documento generado por SISCO v2.0</div>
        </div>
      </div>

      <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
        <button type="button" class="btn-admin-secondary" onclick="document.getElementById('siscoExecReportModal').classList.remove('active')">Cerrar</button>
        <button type="button" class="btn-admin-primary" onclick="window.print()">🖨️ Imprimir / Guardar en PDF</button>
      </div>
    </div>
  `;
}
