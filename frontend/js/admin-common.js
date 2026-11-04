/**
 * SISCO – Shiny Skin | admin-common.js
 * Guardián de seguridad (NFR-0012), Sidebar unificado de 8 módulos, menú móvil y cierre de sesión
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

  // Crear backdrop móvil si no existe
  if (!document.getElementById('sidebarBackdrop')) {
    const bd = document.createElement('div');
    bd.id = 'sidebarBackdrop';
    bd.className = 'sidebar-backdrop';
    bd.onclick = toggleAdminSidebar;
    document.body.appendChild(bd);
  }

  // Inyectar botón hamburguesa en topbar si no existe
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

  // Ocultar controles exclusivos de administradora si el rol es vendedor
  if (!isAdmin) {
    document.querySelectorAll('[data-admin-only]').forEach(el => { el.style.display = 'none'; });
  }

  // Actualizar contador de pedidos pendientes en tiempo real
  api.pedidos.stats().then(st => {
    const badge = document.getElementById('pendingBadge');
    if (badge && st && st.pendientes > 0) {
      badge.textContent = st.pendientes;
      badge.style.display = 'inline-block';
    }
  }).catch(() => {});
}

