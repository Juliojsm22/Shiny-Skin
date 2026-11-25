/**
 * SISCO – Shiny Skin | admin-common.js (v2.1)
 * - Guardián de seguridad (NFR-0012)
 * - Sidebar unificado de 8 módulos
 * - Sistema de Notificaciones Llamativas en Tiempo Real (SSE + Polling + Audio + Escritorio + Título parpadeante)
 * - Exportador Excel/CSV, Reporte Ejecutivo PDF y Respaldo Real BD (NFR-0016)
 */

(function () {
  const sess = typeof getActiveSession === 'function'
    ? getActiveSession()
    : { token: localStorage.getItem('sisco_token'), user: (() => { try { return JSON.parse(localStorage.getItem('sisco_user') || 'null'); } catch { return null; } })() };

  const { token, user } = sess;

  // Redirección obligatoria si no es personal autorizado (admin o vendedor)
  if (!token || !user || !['admin', 'vendedor'].includes(user.rol)) {
    window.location.replace('../login.html?next=' + encodeURIComponent(window.location.pathname));
    return;
  }

  window.SISCO_USER = user;
  window.IS_ADMIN = user.rol === 'admin';
})();

function logout() {
  stopOrderLiveWatcher();
  if (typeof clearActiveSession === 'function') {
    clearActiveSession();
  } else {
    localStorage.removeItem('sisco_token');
    localStorage.removeItem('sisco_user');
  }
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
      <div class="sidebar-section">Catálogo &amp; CRM</div>
      ${renderGroup(itemsCatalogo)}
      <div class="sidebar-section">Finanzas &amp; Acceso</div>
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
        <div class="sidebar-avatar" id="userAvatar">${escapeHtml(initial)}</div>
        <div style="min-width:0;">
          <div class="sidebar-user-name" id="userName" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(user.nombre)}</div>
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

  // Inyectar controles de tiempo real (Estado conexión + Sonido + Campana) en la barra superior
  if (topbar && !document.getElementById('adminNotifBtn')) {
    let actionsEl = topbar.querySelector('.topbar-actions');
    if (!actionsEl) {
      actionsEl = document.createElement('div');
      actionsEl.className = 'topbar-actions';
      topbar.appendChild(actionsEl);
    }

    const connPill = document.createElement('button');
    connPill.type = 'button';
    connPill.id = 'adminConnPill';
    connPill.className = 'conn-pill';
    connPill.title = 'Estado de conexión multi-dispositivo y configuración de alertas';
    connPill.onclick = openRealtimeConfigModal;
    connPill.innerHTML = `<span class="conn-dot"></span><span id="adminConnLabel">Conectando...</span>`;

    const soundBtn = document.createElement('button');
    soundBtn.type = 'button';
    soundBtn.id = 'adminSoundBtn';
    soundBtn.className = 'btn-admin-secondary';
    soundBtn.style.cssText = 'padding:7px 10px;border-radius:10px;font-size:0.86rem;';
    soundBtn.onclick = toggleAdminSound;

    const notifBtn = document.createElement('button');
    notifBtn.type = 'button';
    notifBtn.id = 'adminNotifBtn';
    notifBtn.className = 'btn-admin-secondary';
    notifBtn.style.cssText = 'position:relative;padding:7px 12px;border-radius:10px;display:inline-flex;align-items:center;gap:6px;font-size:0.88rem;';
    notifBtn.title = 'Centro de Alertas y Notificaciones SISCO';
    notifBtn.onclick = openNotificationsModal;
    notifBtn.innerHTML = `🔔 <span id="adminNotifBadge" style="display:none;background:#ef4444;color:#fff;font-size:0.7rem;font-weight:800;padding:1px 6px;border-radius:99px;line-height:1.3;">0</span>`;

    actionsEl.insertBefore(notifBtn, actionsEl.firstChild);
    actionsEl.insertBefore(soundBtn, notifBtn);
    actionsEl.insertBefore(connPill, soundBtn);
    updateSoundButtonUI();
  }

  // Inyectar Franja Persistente de Pedidos Pendientes justo debajo de la topbar
  if (topbar && !document.getElementById('siscoPendingBanner')) {
    const banner = document.createElement('div');
    banner.id = 'siscoPendingBanner';
    banner.className = 'sisco-pending-banner';
    topbar.insertAdjacentElement('afterend', banner);
  }

  // Inyectar Stack Flotante para Tarjetas de Nuevo Pedido
  if (!document.getElementById('siscoOrderAlertStack')) {
    const stack = document.createElement('div');
    stack.id = 'siscoOrderAlertStack';
    stack.className = 'sisco-order-alert-stack';
    document.body.appendChild(stack);
  }

  initOrderLiveWatcher();
}

// =========================================================================
// MOTOR DE SONIDO (WEB AUDIO API — SIN ARCHIVOS EXTERNOS, FUNCIONA OFFLINE)
// =========================================================================
let _siscoAudioCtx = null;
let _siscoAudioBlocked = false;

function isSoundEnabled() {
  try {
    const v = localStorage.getItem('sisco_sound_enabled');
    return v === null ? true : v === 'true';
  } catch { return true; }
}

function updateSoundButtonUI() {
  const btn = document.getElementById('adminSoundBtn');
  if (!btn) return;
  const on = isSoundEnabled();
  btn.textContent = on ? '🔊' : '🔇';
  btn.title = on ? 'Sonido de nuevos pedidos ACTIVADO (clic para silenciar)' : 'Sonido SILENCIADO (clic para activar)';
  btn.style.opacity = on ? '1' : '0.6';
}

function unlockSiscoAudio() {
  try {
    const AudioContextCls = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCls) return null;
    if (!_siscoAudioCtx) _siscoAudioCtx = new AudioContextCls();
    if (_siscoAudioCtx.state === 'suspended') {
      _siscoAudioCtx.resume().then(() => { _siscoAudioBlocked = false; }).catch(() => {});
    }
    return _siscoAudioCtx;
  } catch { return null; }
}

// Desbloquear audio en el primer clic/tecla del personal
['click', 'keydown', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, () => unlockSiscoAudio(), { once: true, passive: true });
});

function toggleAdminSound() {
  const next = !isSoundEnabled();
  try { localStorage.setItem('sisco_sound_enabled', String(next)); } catch {}
  updateSoundButtonUI();
  if (next) {
    unlockSiscoAudio();
    playNewOrderChime(true);
    showToast('🔊 Sonido de alerta de pedidos activado', 'success');
  } else {
    showToast('🔇 Sonido de alertas silenciado', 'info');
  }
}

function playNewOrderChime(shortPreview = false) {
  if (!isSoundEnabled() && !shortPreview) return false;
  try {
    const ctx = unlockSiscoAudio();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      _siscoAudioBlocked = true;
      return false;
    }
    _siscoAudioBlocked = false;

    const now = ctx.currentTime;
    // Melodía clara tipo timbre comercial (Do5 -> Mi5 -> Sol5 -> Do6) + repetición breve
    const notes = shortPreview
      ? [{ f: 523.25, t: 0.00, d: 0.16 }, { f: 659.25, t: 0.13, d: 0.18 }, { f: 1046.5, t: 0.27, d: 0.32 }]
      : [
          { f: 587.33, t: 0.00, d: 0.16 },
          { f: 783.99, t: 0.14, d: 0.16 },
          { f: 1046.5, t: 0.28, d: 0.26 },
          { f: 1174.6, t: 0.56, d: 0.16 },
          { f: 1567.9, t: 0.70, d: 0.36 },
        ];

    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.0001, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.28, now + n.t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.03);
    });
    return true;
  } catch {
    return false;
  }
}

// =========================================================================
// MOTOR DE VIGILANCIA EN TIEMPO REAL (SSE + POLLING RESILIENTE + ALERTAS)
// =========================================================================
let _liveWatcherStarted = false;
let _sseSource = null;
let _sseConnected = false;
let _sseReconnectTimer = null;
let _pollInterval = null;
let _chimeReminderInterval = null;
let _titleFlashInterval = null;
let _originalDocTitle = document.title;
let _lastSeenOrderId = null;
const _activeAlertOrders = new Map(); // id -> order object

function _getSessionSet(key) {
  try { return new Set(JSON.parse(sessionStorage.getItem(key) || '[]')); }
  catch { return new Set(); }
}
function _addToSessionSet(key, val) {
  try {
    const s = _getSessionSet(key);
    s.add(String(val));
    sessionStorage.setItem(key, JSON.stringify([...s].slice(-120)));
  } catch {}
}

function updateConnectionPill(state, extraText = '') {
  const pill = document.getElementById('adminConnPill');
  const lbl = document.getElementById('adminConnLabel');
  if (!pill || !lbl) return;
  pill.classList.remove('live', 'local');
  if (state === 'sse') {
    pill.classList.add('live');
    lbl.textContent = 'En Vivo (Tiempo Real)';
  } else if (state === 'server') {
    pill.classList.add('live');
    lbl.textContent = extraText || 'Servidor Activo';
  } else {
    pill.classList.add('local');
    lbl.textContent = 'Modo Local (1 PC)';
  }
}

function stopOrderLiveWatcher() {
  if (_sseSource) { try { _sseSource.close(); } catch {} _sseSource = null; }
  _sseConnected = false;
  if (_sseReconnectTimer) { clearTimeout(_sseReconnectTimer); _sseReconnectTimer = null; }
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  if (_chimeReminderInterval) { clearInterval(_chimeReminderInterval); _chimeReminderInterval = null; }
  if (_titleFlashInterval) { clearInterval(_titleFlashInterval); _titleFlashInterval = null; document.title = _originalDocTitle; }
  _liveWatcherStarted = false;
}

async function initOrderLiveWatcher() {
  if (_liveWatcherStarted) {
    refreshAdminNotifications();
    return;
  }
  _liveWatcherStarted = true;
  _originalDocTitle = document.title;

  // 1. Verificar salud real del servidor
  const health = await api.health();
  const isServerOnline = health && health.mode === 'server';
  updateConnectionPill(isServerOnline ? 'server' : 'local');

  // 2. Carga inicial de alertas y estado pendiente
  await pollOrderAlerts({ initial: true });
  await refreshAdminNotifications();

  // 3. Conectar SSE en tiempo real si el servidor backend está activo
  if (isServerOnline && typeof EventSource !== 'undefined') {
    connectOrderSSE();
  }

  // 4. Polling de respaldo infalible (5s si SSE no está abierto, 15s como red de seguridad si SSE está activo)
  let tick = 0;
  _pollInterval = setInterval(() => {
    tick++;
    if (_sseConnected && tick % 3 !== 0) return;
    pollOrderAlerts({ initial: false });
  }, 5000);

  // Sincronización instantánea al volver a la pestaña
  window.addEventListener('focus', () => pollOrderAlerts({ initial: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pollOrderAlerts({ initial: false });
  });

  // Escuchar eventos locales en modo demostración multi-pestaña
  window.addEventListener('sisco:new-order', (ev) => {
    if (ev && ev.detail && ev.detail.id) {
      handleIncomingOrder(ev.detail);
      pollOrderAlerts({ initial: false });
    }
  });
  window.addEventListener('sisco:db-updated', () => {
    refreshAdminNotifications();
  });
}

function connectOrderSSE() {
  const url = api.pedidos.streamUrl();
  if (!url) return;
  if (_sseSource) { try { _sseSource.close(); } catch {} }

  try {
    const es = new EventSource(url);
    _sseSource = es;

    es.addEventListener('connected', () => {
      _sseConnected = true;
      updateConnectionPill('sse');
    });

    es.addEventListener('new_order', (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        const order = parsed.data || parsed;
        if (order && order.id) {
          _lastSeenOrderId = Math.max(Number(_lastSeenOrderId || 0), Number(order.id));
          handleIncomingOrder(order);
          pollOrderAlerts({ initial: false, skipNewTrigger: true });
          window.dispatchEvent(new CustomEvent('sisco:orders-changed', { detail: { type: 'new_order', order } }));
        }
      } catch {}
    });

    es.addEventListener('order_updated', (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        const order = parsed.data || parsed;
        if (order && order.id && order.estado !== 'pendiente') {
          dismissOrderAlertCard(order.id, true);
        }
        pollOrderAlerts({ initial: false, skipNewTrigger: true });
        refreshAdminNotifications();
        window.dispatchEvent(new CustomEvent('sisco:orders-changed', { detail: { type: 'order_updated', order } }));
      } catch {}
    });

    es.onerror = () => {
      _sseConnected = false;
      try { es.close(); } catch {}
      _sseSource = null;
      if (window.SISCO_MODE === 'server') {
        updateConnectionPill('server', 'Servidor (Sync 5s)');
        if (!_sseReconnectTimer) {
          _sseReconnectTimer = setTimeout(() => {
            _sseReconnectTimer = null;
            connectOrderSSE();
          }, 8000);
        }
      }
    };
  } catch {
    _sseConnected = false;
  }
}

async function pollOrderAlerts({ initial = false, skipNewTrigger = false } = {}) {
  try {
    const res = await api.pedidos.alertas(initial ? null : _lastSeenOrderId);
    if (!res) return;

    const latestId = Number(res.latest_order_id || 0);
    const pendingOrders = Array.isArray(res.pending_orders) ? res.pending_orders : [];
    const pendingCount = Number(res.pending_count ?? pendingOrders.length);

    if (initial) {
      _lastSeenOrderId = latestId;
      // Si hay pedidos pendientes recientes (últimos 20 min) no vistos en esta sesión, mostrar alerta de inmediato al abrir el panel
      const acked = _getSessionSet('sisco_acked_order_ids');
      const nowMs = Date.now();
      pendingOrders.forEach(o => {
        const createdMs = o.fecha ? new Date(o.fecha).getTime() : 0;
        const isRecent = !isNaN(createdMs) && (nowMs - createdMs) <= 20 * 60 * 1000;
        if (isRecent && !acked.has(String(o.id))) {
          handleIncomingOrder(o, { isInitialCatchup: true });
        }
      });
    } else {
      if (latestId > Number(_lastSeenOrderId || 0)) {
        _lastSeenOrderId = latestId;
      }
      if (!skipNewTrigger && Array.isArray(res.new_orders) && res.new_orders.length) {
        let triggeredAny = false;
        res.new_orders.forEach(o => {
          if (o && o.id) {
            handleIncomingOrder(o);
            triggeredAny = true;
          }
        });
        if (triggeredAny) {
          window.dispatchEvent(new CustomEvent('sisco:orders-changed', { detail: { type: 'new_order', orders: res.new_orders } }));
        }
      }
    }

    // Limpiar tarjetas activas de pedidos que ya fueron atendidos por otro miembro del personal
    const pendingIds = new Set(pendingOrders.map(o => String(o.id)));
    for (const [idStr] of _activeAlertOrders.entries()) {
      if (!pendingIds.has(String(idStr)) && !String(idStr).startsWith('test_')) {
        dismissOrderAlertCard(idStr, true);
      }
    }

    updatePendingVisuals(pendingCount, pendingOrders, Number(res.en_camino_count || 0));
  } catch {}
}

function updatePendingVisuals(pendingCount, pendingOrders = [], enCaminoCount = 0) {
  // 1. Badge lateral en "Pedidos & Envíos"
  const badge = document.getElementById('pendingBadge');
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = 'inline-block';
      badge.classList.add('urgent');
    } else {
      badge.style.display = 'none';
      badge.classList.remove('urgent');
    }
  }

  // 2. Campana urgente en topbar
  const bellBtn = document.getElementById('adminNotifBtn');
  if (bellBtn) {
    bellBtn.classList.toggle('has-urgent', pendingCount > 0);
  }

  // 3. Franja persistente de atención bajo la barra superior
  const banner = document.getElementById('siscoPendingBanner');
  if (banner) {
    if (pendingCount > 0) {
      const latest = pendingOrders[0];
      const latestTxt = latest
        ? ` · Último: <strong>${escapeHtml(latest.numero_pedido)}</strong> (${escapeHtml(latest.nombre_cliente)} — <strong>${formatCurrency(latest.total)}</strong>)`
        : '';
      banner.innerHTML = `
        <div class="sisco-pending-banner-left">
          <span class="sisco-alert-bell-shake" style="font-size:1.15rem;">🚨</span>
          <span>
            <strong>ATENCIÓN:</strong> Tienes <strong>${pendingCount}</strong> pedido${pendingCount !== 1 ? 's' : ''} <u>PENDIENTE${pendingCount !== 1 ? 'S' : ''}</u> de confirmar${latestTxt}
          </span>
        </div>
        <div class="sisco-pending-banner-actions">
          ${latest ? `<button type="button" class="sisco-pending-cta" style="background:#10b981;color:#fff;" onclick="confirmOrderFromAlert(${latest.id})">✅ Confirmar ${escapeHtml(latest.numero_pedido)}</button>` : ''}
          <a href="pedidos.html${latest ? `?highlight=${latest.id}` : ''}" class="sisco-pending-cta">🛒 Atender Pedidos →</a>
        </div>`;
      banner.classList.add('active');
    } else {
      banner.classList.remove('active');
      banner.innerHTML = '';
    }
  }

  // Actualizar cache global para el modal de campana
  if (window._SISCO_NOTIFS) {
    window._SISCO_NOTIFS.pendingCount = pendingCount;
    window._SISCO_NOTIFS.enCaminoCount = enCaminoCount;
    window._SISCO_NOTIFS.pendingOrders = pendingOrders;
  }
}

function handleIncomingOrder(order, opts = {}) {
  if (!order || !order.id) return;
  const key = String(order.id);
  const seen = _getSessionSet('sisco_seen_order_ids');
  const acked = _getSessionSet('sisco_acked_order_ids');

  if (!opts.isTest && (acked.has(key) || _activeAlertOrders.has(key))) return;
  if (!opts.isTest && !opts.isInitialCatchup && seen.has(key)) return;

  if (!opts.isTest) _addToSessionSet('sisco_seen_order_ids', key);
  _activeAlertOrders.set(key, order);

  // 1. Sonido inmediato + recordatorio periódico hasta que atiendan
  playNewOrderChime(false);
  ensureChimeReminderRunning();

  // 2. Renderizar tarjeta flotante de alto impacto visual
  renderOrderAlertStack();

  // 3. Parpadeo del título de la pestaña del navegador
  startTitleFlash();

  // 4. Notificación nativa de escritorio (Windows/Mac/Android)
  sendDesktopOrderNotification(order);

  // 5. Refrescar contadores globales
  if (!opts.isTest) refreshAdminNotifications();
}

function renderOrderAlertStack() {
  const stack = document.getElementById('siscoOrderAlertStack');
  if (!stack) return;

  if (_activeAlertOrders.size === 0) {
    stack.innerHTML = '';
    stopTitleFlash();
    stopChimeReminder();
    return;
  }

  const canalLabels = {
    web: '🌐 WEB E-COMMERCE',
    whatsapp: '💬 WHATSAPP',
    instagram: '📸 INSTAGRAM',
    tienda_fisica: '🏬 TIENDA FÍSICA'
  };

  const cardsHtml = [..._activeAlertOrders.values()].slice(0, 4).map(o => {
    const isTest = String(o.id).startsWith('test_');
    const itemsPreview = (o.items || []).slice(0, 4).map(it =>
      `<div>• <strong>${it.cantidad}×</strong> ${escapeHtml(it.nombre_producto)} (${formatCurrency(it.subtotal)})</div>`
    ).join('');
    const waPhone = typeof formatWhatsAppPhone === 'function'
      ? formatWhatsAppPhone(o.telefono_cliente)
      : String(o.telefono_cliente || '').replace(/\D/g, '');
    const waMsg = `Hola *${o.nombre_cliente}* ✨ Recibimos tu pedido *${o.numero_pedido}* en *Shiny Skin* por *${formatCurrency(o.total)}*. ¡En breve te confirmamos el despacho!`;
    const waHref = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMsg)}` : '';

    return `
      <div class="sisco-order-alert-card" data-alert-id="${escapeHtml(o.id)}">
        <div class="sisco-alert-top">
          <div>
            <div class="sisco-alert-badge">
              <span class="sisco-alert-bell-shake">🔔</span>
              ${isTest ? 'PRUEBA DE ALERTA' : '¡NUEVO PEDIDO RECIBIDO!'}
            </div>
            <div class="sisco-alert-code">
              <span>${escapeHtml(o.numero_pedido)}</span>
              <span class="badge" style="background:rgba(56,189,248,0.22);color:#7dd3fc;font-size:0.66rem;">${canalLabels[o.canal] || '🌐 WEB'}</span>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="sisco-alert-total">${formatCurrency(o.total)}</div>
            <div style="font-size:0.7rem;color:rgba(188,210,233,0.75);">${formatDateTime(o.fecha)}</div>
          </div>
        </div>

        <div class="sisco-alert-body">
          <div>👤 <strong>${escapeHtml(o.nombre_cliente)}</strong> ${o.telefono_cliente ? `· 📞 <strong>${escapeHtml(o.telefono_cliente)}</strong>` : ''}</div>
          <div>${o.metodo_entrega === 'retiro' ? '🏬 <strong>Retiro en Concept Store</strong>' : `🛵 <strong>Domicilio:</strong> ${escapeHtml(o.direccion_entrega || 'Por confirmar')}`}</div>
          <div>💳 Pago: <strong>${escapeHtml(o.metodo_pago || 'efectivo')}</strong>${o.monto_pago_cliente ? ` · Paga con ${formatCurrency(o.monto_pago_cliente)} (Vuelto: <strong style="color:#fbbf24;">${formatCurrency(o.cambio_entregar)}</strong>)` : ''}</div>
          ${itemsPreview ? `<div class="sisco-alert-items">${itemsPreview}</div>` : ''}
        </div>

        ${_siscoAudioBlocked ? `
          <button type="button" onclick="unlockSiscoAudio();playNewOrderChime(true);renderOrderAlertStack();" style="width:100%;margin-bottom:8px;padding:6px 10px;border-radius:8px;background:rgba(251,191,36,0.22);color:#fde68a;border:1px solid rgba(251,191,36,0.45);font-size:0.76rem;font-weight:700;cursor:pointer;">
            🔊 Haz clic aquí para activar el sonido de alertas
          </button>` : ''}

        <div class="sisco-alert-actions">
          ${!isTest && o.estado === 'pendiente'
            ? `<button type="button" class="sisco-alert-btn-confirm" onclick="confirmOrderFromAlert(${o.id})">✅ Confirmar Pedido Ahora</button>`
            : ''}
          ${!isTest
            ? `<a href="pedidos.html?highlight=${o.id}" class="sisco-alert-btn-sec" onclick="dismissOrderAlertCard('${escapeHtml(o.id)}')">👁 Ver / Gestionar</a>`
            : `<button type="button" class="sisco-alert-btn-sec" onclick="playNewOrderChime(false)">🔊 Repetir Sonido</button>`}
          ${waHref
            ? `<a href="${waHref}" target="_blank" rel="noopener" class="sisco-alert-btn-sec" style="color:#6ee7b7;border-color:rgba(52,211,153,0.4);">💬 WhatsApp</a>`
            : `<button type="button" class="sisco-alert-btn-sec" onclick="dismissOrderAlertCard('${escapeHtml(o.id)}')">✓ Entendido</button>`}
          ${waHref
            ? `<button type="button" class="sisco-alert-btn-sec" style="grid-column:1/-1;opacity:0.85;" onclick="dismissOrderAlertCard('${escapeHtml(o.id)}')">✓ Entendido / Silenciar esta alerta</button>`
            : ''}
        </div>
      </div>`;
  }).join('');

  stack.innerHTML = cardsHtml;
}

async function confirmOrderFromAlert(orderId) {
  try {
    await api.pedidos.updateEstado(orderId, 'confirmado', {
      observacion: 'Pedido confirmado de inmediato desde alerta en vivo SISCO'
    });
    dismissOrderAlertCard(orderId, true);
    showToast('✅ ¡Pedido confirmado! El inventario y el panel ya están actualizados.', 'success');
    await pollOrderAlerts({ initial: false, skipNewTrigger: true });
    await refreshAdminNotifications();
    window.dispatchEvent(new CustomEvent('sisco:orders-changed', { detail: { type: 'order_confirmed', orderId } }));
  } catch (err) {
    showToast(err.message || 'No se pudo confirmar el pedido.', 'error');
  }
}

function dismissOrderAlertCard(orderId, silent = false) {
  const key = String(orderId);
  _activeAlertOrders.delete(key);
  if (!key.startsWith('test_')) {
    _addToSessionSet('sisco_acked_order_ids', key);
  }
  renderOrderAlertStack();
  if (!silent && _activeAlertOrders.size === 0) {
    stopChimeReminder();
    stopTitleFlash();
  }
}

function ensureChimeReminderRunning() {
  if (_chimeReminderInterval) return;
  _chimeReminderInterval = setInterval(() => {
    if (_activeAlertOrders.size > 0 && isSoundEnabled()) {
      playNewOrderChime(true);
    } else if (_activeAlertOrders.size === 0) {
      stopChimeReminder();
    }
  }, 15000);
}

function stopChimeReminder() {
  if (_chimeReminderInterval) {
    clearInterval(_chimeReminderInterval);
    _chimeReminderInterval = null;
  }
}

function startTitleFlash() {
  if (_titleFlashInterval) return;
  let toggle = false;
  _titleFlashInterval = setInterval(() => {
    if (_activeAlertOrders.size === 0) {
      stopTitleFlash();
      return;
    }
    const first = [..._activeAlertOrders.values()][0];
    toggle = !toggle;
    document.title = toggle
      ? `🚨 (${_activeAlertOrders.size}) ¡NUEVO PEDIDO! — Shiny Skin`
      : `🔔 ${first.numero_pedido} · ${formatCurrency(first.total)}`;
  }, 1100);
}

function stopTitleFlash() {
  if (_titleFlashInterval) {
    clearInterval(_titleFlashInterval);
    _titleFlashInterval = null;
  }
  document.title = _originalDocTitle;
}

function sendDesktopOrderNotification(order) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const itemsTxt = (order.items || []).map(i => `${i.cantidad}x ${i.nombre_producto}`).join(', ');
    const n = new Notification(`🚨 ¡Nuevo Pedido ${order.numero_pedido}! (${formatCurrency(order.total)})`, {
      body: `${order.nombre_cliente} · ${order.metodo_entrega === 'retiro' ? 'Retiro en tienda' : 'Domicilio'}\n${itemsTxt}`,
      icon: '../img/SHINY LOGO 1.jpg',
      tag: `sisco-order-${order.id}`,
      requireInteraction: true
    });
    n.onclick = () => {
      window.focus();
      if (!String(order.id).startsWith('test_')) {
        window.location.href = `pedidos.html?highlight=${order.id}`;
      }
      n.close();
    };
  } catch {}
}

async function requestDesktopNotifPermission() {
  if (typeof Notification === 'undefined') {
    showToast('Este navegador no soporta notificaciones de escritorio.', 'error');
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('✅ ¡Notificaciones de escritorio activadas! Recibirás avisos incluso en otras pestañas.', 'success');
  } else {
    showToast('Permiso de notificaciones de escritorio denegado en el navegador.', 'error');
  }
  openRealtimeConfigModal();
}

function triggerTestOrderAlert() {
  unlockSiscoAudio();
  const fakeOrder = {
    id: `test_${Date.now()}`,
    numero_pedido: 'SS-PRUEBA',
    nombre_cliente: 'Clienta de Prueba (Celular)',
    telefono_cliente: '8888-0000',
    canal: 'web',
    metodo_entrega: 'domicilio',
    direccion_entrega: 'Altamira, Managua (Prueba de alerta en vivo)',
    metodo_pago: 'efectivo_entrega',
    monto_pago_cliente: 1500,
    cambio_entregar: 180,
    estado: 'pendiente',
    total: 1320,
    fecha: new Date().toISOString(),
    items: [
      { cantidad: 1, nombre_producto: 'ANUA Heartleaf 77% Soothing Serum', subtotal: 720 },
      { cantidad: 1, nombre_producto: 'Purito Daily Go-To Sunscreen SPF50+', subtotal: 600 }
    ]
  };
  handleIncomingOrder(fakeOrder, { isTest: true });
}

// ---- Modal de Estado del Servidor y Configuración Multi-Dispositivo ----
function openRealtimeConfigModal() {
  let modal = document.getElementById('siscoConnModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'siscoConnModal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  const isLive = window.SISCO_MODE === 'server';
  const dbEngine = window.SISCO_SERVER_INFO?.database || (isLive ? 'sqlite' : 'localStorage');
  const savedRemoteUrl = localStorage.getItem('sisco_api_server_url') || '';
  const notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  modal.innerHTML = `
    <div class="admin-modal" style="max-width:580px;">
      <div class="modal-header">
        <div class="modal-title">📡 Estado Multi-Dispositivo y Alertas en Tiempo Real</div>
        <button class="modal-close" onclick="document.getElementById('siscoConnModal').classList.remove('active')">✕</button>
      </div>

      <div style="padding:14px 16px;border-radius:12px;margin-bottom:16px;background:${isLive ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'};border:1px solid ${isLive ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.45)'};">
        <div style="font-weight:800;font-size:0.95rem;color:${isLive ? '#6ee7b7' : '#fcd34d'};margin-bottom:4px;">
          ${isLive ? '🟢 Conectado al Servidor Real SISCO (Multi-Dispositivo Activo)' : '🟠 Modo Demo Local (Solo este navegador)'}
        </div>
        <div style="font-size:0.8rem;color:rgba(255,255,255,0.78);line-height:1.55;">
          ${isLive
            ? `Cualquier pedido hecho desde celulares, tablets u otras PCs caerá al instante aquí.<br>Base de datos: <strong>${escapeHtml(dbEngine.toUpperCase())}</strong> · Canal en vivo: <strong>${_sseConnected ? 'SSE Tiempo Real ⚡' : 'Polling automático cada 5s'}</strong>`
            : `Actualmente estás en un hosting estático o sin servidor backend conectado. En este modo los pedidos hechos en otros celulares NO llegan aquí. Despliega el backend en <strong>Render</strong> o ejecuta <code>iniciar_servidor.bat</code> y conecta su URL abajo.`}
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
        <button type="button" class="btn-admin-primary" onclick="triggerTestOrderAlert()">🔔 Probar Alerta Llamativa + Sonido</button>
        ${notifPerm !== 'granted' && notifPerm !== 'unsupported'
          ? `<button type="button" class="btn-admin-secondary" onclick="requestDesktopNotifPermission()">🖥️ Activar Alertas de Escritorio (Windows/Móvil)</button>`
          : (notifPerm === 'granted' ? `<span class="badge badge-success" style="padding:8px 12px;">🖥️ Notificaciones de escritorio: ACTIVAS</span>` : '')}
      </div>

      <div style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid var(--admin-border);border-radius:12px;margin-bottom:16px;">
        <div class="admin-form-label" style="margin-bottom:6px;">🌐 Conectar URL de Servidor Backend (opcional, útil para GitHub Pages)</div>
        <div style="font-size:0.75rem;color:rgba(188,210,233,0.68);margin-bottom:8px;">
          Si abres el panel desde GitHub Pages pero tu servidor Python está en Render o en tu red local, ingresa la URL del servidor (ej: <code>https://sisco-shinyskin.onrender.com</code>):
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="url" id="remoteApiUrlInput" class="admin-form-control" style="flex:1;" placeholder="https://sisco-shinyskin.onrender.com" value="${escapeHtml(savedRemoteUrl)}" />
          <button type="button" class="btn-admin-primary" onclick="saveRemoteApiUrl()">Guardar</button>
          ${savedRemoteUrl ? `<button type="button" class="btn-admin-secondary" onclick="clearRemoteApiUrl()">Restablecer</button>` : ''}
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn-admin-secondary" onclick="document.getElementById('siscoConnModal').classList.remove('active')">Cerrar</button>
      </div>
    </div>`;
  modal.classList.add('active');
}

function saveRemoteApiUrl() {
  const val = (document.getElementById('remoteApiUrlInput')?.value || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  if (!val || !/^https?:\/\//i.test(val)) {
    showToast('Ingresa una URL válida que comience con https:// o http://', 'error');
    return;
  }
  localStorage.setItem('sisco_api_server_url', val);
  showToast('Servidor guardado. Recargando conexión...', 'success');
  setTimeout(() => window.location.reload(), 600);
}

function clearRemoteApiUrl() {
  localStorage.removeItem('sisco_api_server_url');
  showToast('Conexión automática restablecida. Recargando...', 'info');
  setTimeout(() => window.location.reload(), 600);
}

// =========================================================================
// CENTRO DE ALERTAS Y NOTIFICACIONES (CAMPANA TOPBAR)
// =========================================================================
async function refreshAdminNotifications() {
  try {
    const [st, prods] = await Promise.all([
      api.pedidos.stats().catch(() => ({ pendientes: 0, en_camino: 0 })),
      fetchProductos().catch(() => [])
    ]);

    const pendingCount = Number(st?.pendientes || 0);
    const badge = document.getElementById('pendingBadge');
    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-block';
        badge.classList.add('urgent');
      } else {
        badge.style.display = 'none';
        badge.classList.remove('urgent');
      }
    }

    const lowStock = (prods || []).filter(p =>
      p.activo !== false && (p.stock_critico || p.alerta_stock || Number(p.stock || 0) <= Number(p.stock_minimo ?? 5))
    );
    const expiring = (prods || []).filter(p =>
      p.activo !== false && (p.por_vencer || p.vencido || (p.dias_para_vencer !== null && p.dias_para_vencer !== undefined && p.dias_para_vencer <= 60))
    );
    const totalAlerts = pendingCount + lowStock.length + expiring.length;

    window._SISCO_NOTIFS = {
      ...(window._SISCO_NOTIFS || {}),
      pendingCount,
      enCaminoCount: Number(st?.en_camino || 0),
      lowStock,
      expiring,
      totalAlerts
    };

    const notifBadge = document.getElementById('adminNotifBadge');
    if (notifBadge) {
      if (totalAlerts > 0) {
        notifBadge.textContent = totalAlerts;
        notifBadge.style.display = 'inline-block';
      } else {
        notifBadge.style.display = 'none';
      }
    }
    const bellBtn = document.getElementById('adminNotifBtn');
    if (bellBtn) bellBtn.classList.toggle('has-urgent', pendingCount > 0);
  } catch {}
}

async function openNotificationsModal() {
  await refreshAdminNotifications();
  const data = window._SISCO_NOTIFS || { pendingCount: 0, enCaminoCount: 0, lowStock: [], expiring: [], totalAlerts: 0 };

  let modal = document.getElementById('siscoNotifModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'siscoNotifModal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  const lowStockHtml = data.lowStock.length
    ? data.lowStock.map(p => `
      <div class="flex-between" style="padding:10px 12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.22);border-radius:10px;margin-bottom:8px;">
        <div>
          <div style="font-weight:700;font-size:0.84rem;color:#fca5a5;">⚠️ ${escapeHtml(p.nombre)}</div>
          <div style="font-size:0.75rem;color:rgba(188,210,233,0.7);">SKU: ${escapeHtml(p.sku || '—')} · Físico: ${p.stock_fisico ?? p.stock} / Online: ${p.stock_online ?? 0} (Mín: ${p.stock_minimo ?? 5})</div>
        </div>
        <a href="inventario.html" class="btn-table btn-table-edit" style="text-decoration:none;">Reabastecer</a>
      </div>`).join('')
    : `<div style="font-size:0.82rem;color:#34d399;padding:8px 0;">✅ Ningún producto en stock crítico.</div>`;

  const expiringHtml = data.expiring.length
    ? data.expiring.map(p => `
      <div class="flex-between" style="padding:10px 12px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.24);border-radius:10px;margin-bottom:8px;">
        <div>
          <div style="font-weight:700;font-size:0.84rem;color:#fcd34d;">⏳ ${escapeHtml(p.nombre)}</div>
          <div style="font-size:0.75rem;color:rgba(188,210,233,0.7);">Vencimiento: <strong>${escapeHtml(p.fecha_vencimiento || '—')}</strong> (${p.vencido ? 'VENCIDO' : `Faltan ${p.dias_para_vencer}d`})</div>
        </div>
        <a href="productos.html" class="btn-table btn-table-view" style="text-decoration:none;">Ver Lote</a>
      </div>`).join('')
    : `<div style="font-size:0.82rem;color:#34d399;padding:8px 0;">✅ Sin lotes próximos a vencer (≤ 60 días).</div>`;

  modal.innerHTML = `
    <div class="admin-modal" style="max-width:560px;">
      <div class="modal-header">
        <div class="modal-title">🔔 Centro de Alertas Operativas SISCO (${data.totalAlerts})</div>
        <button class="modal-close" onclick="document.getElementById('siscoNotifModal').classList.remove('active')">✕</button>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:0.76rem;text-transform:uppercase;letter-spacing:0.06em;color:rgba(188,210,233,0.6);font-weight:700;margin-bottom:8px;">🛒 Pedidos Omnicanal</div>
        <div class="flex-between" style="padding:12px 14px;background:${data.pendingCount > 0 ? 'rgba(245,158,11,0.14)' : 'rgba(56,189,248,0.08)'};border:1px solid ${data.pendingCount > 0 ? 'rgba(251,191,36,0.45)' : 'rgba(56,189,248,0.22)'};border-radius:10px;gap:10px;">
          <div>
            <div style="font-weight:700;font-size:0.88rem;color:#e2f1ff;">
              ${data.pendingCount > 0 ? `🚨 Tienes ${data.pendingCount} pedido(s) pendiente(s) de atención` : '✅ Todos los pedidos están atendidos'}
            </div>
            <div style="font-size:0.76rem;color:rgba(188,210,233,0.7);margin-top:2px;">
              Pedidos en ruta con motorizado: <strong>${data.enCaminoCount}</strong>
            </div>
          </div>
          <a href="pedidos.html" class="btn-admin-primary" style="text-decoration:none;padding:7px 14px;font-size:0.8rem;white-space:nowrap;">Ir a Pedidos</a>
        </div>
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:0.76rem;text-transform:uppercase;letter-spacing:0.06em;color:rgba(188,210,233,0.6);font-weight:700;margin-bottom:8px;">📦 Alertas de Stock Crítico (${data.lowStock.length})</div>
        ${lowStockHtml}
      </div>

      <div style="margin-bottom:18px;">
        <div style="font-size:0.76rem;text-transform:uppercase;letter-spacing:0.06em;color:rgba(188,210,233,0.6);font-weight:700;margin-bottom:8px;">⏳ Control de Vencimientos Cosméticos (${data.expiring.length})</div>
        ${expiringHtml}
      </div>

      <div class="flex-between" style="flex-wrap:wrap;gap:8px;">
        <button type="button" class="btn-admin-secondary" onclick="document.getElementById('siscoNotifModal').classList.remove('active');triggerTestOrderAlert();">🔔 Probar Alerta de Nuevo Pedido</button>
        <button type="button" class="btn-admin-secondary" onclick="document.getElementById('siscoNotifModal').classList.remove('active')">Cerrar</button>
      </div>
    </div>
  `;
  modal.classList.add('active');
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
// MODAL DE RESPALDO Y RESTAURACIÓN DE BASE DE DATOS REAL (NFR-0016)
// =========================================================================
async function openBackupModal() {
  let modal = document.getElementById('siscoBackupModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'siscoBackupModal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `<div class="admin-modal" style="max-width:560px;text-align:center;padding:36px;">Consultando estadísticas reales de la base de datos...</div>`;
  modal.classList.add('active');

  let stats = { productos: 0, pedidos: 0, facturas: 0, clientes: 0, source: 'servidor' };
  try {
    const snap = await api.dashboard.backup();
    stats = {
      productos: (snap.productos || []).length,
      pedidos: (snap.pedidos || []).length,
      facturas: (snap.facturas || []).length,
      clientes: (snap.clientes || []).length,
      source: snap.source === 'server_database' ? 'Base de Datos del Servidor' : 'Almacenamiento Local'
    };
  } catch {
    const db = typeof getLocalDB === 'function' ? getLocalDB() : {};
    stats = {
      productos: (db.productos || []).length,
      pedidos: (db.pedidos || []).length,
      facturas: (db.facturas || []).length,
      clientes: (db.clientes || []).length,
      source: 'Almacenamiento Local'
    };
  }

  const isLocal = window.SISCO_MODE !== 'server';

  modal.innerHTML = `
    <div class="admin-modal" style="max-width:560px;">
      <div class="modal-header">
        <div class="modal-title">🛡️ Respaldo y Restauración de Base de Datos (NFR-0016)</div>
        <button class="modal-close" onclick="document.getElementById('siscoBackupModal').classList.remove('active')">✕</button>
      </div>
      <p style="font-size:0.84rem;color:rgba(188,210,233,0.75);line-height:1.6;margin-bottom:14px;">
        Origen activo: <strong style="color:#34d399;">${escapeHtml(stats.source)}</strong>. Exporta una copia íntegra de catálogo, inventario dual, pedidos, facturas, clientes y gastos, o restaura un respaldo previo.
      </p>

      <div style="background:rgba(188,210,233,0.06);border:1px solid var(--admin-border);border-radius:12px;padding:14px;margin-bottom:18px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center;">
        <div><div style="font-size:1.2rem;font-weight:800;color:#fff;">${stats.productos}</div><div style="font-size:0.72rem;color:var(--color-brand-pastel);">Productos</div></div>
        <div><div style="font-size:1.2rem;font-weight:800;color:#34d399;">${stats.pedidos}</div><div style="font-size:0.72rem;color:var(--color-brand-pastel);">Pedidos</div></div>
        <div><div style="font-size:1.2rem;font-weight:800;color:#60a5fa;">${stats.facturas}</div><div style="font-size:0.72rem;color:var(--color-brand-pastel);">Facturas</div></div>
        <div><div style="font-size:1.2rem;font-weight:800;color:#fbbf24;">${stats.clientes}</div><div style="font-size:0.72rem;color:var(--color-brand-pastel);">Clientes</div></div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--admin-border);border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:#fff;">💾 1. Exportar Copia de Seguridad (JSON)</div>
            <div style="font-size:0.76rem;color:rgba(255,255,255,0.5);">Descarga todos los registros reales actuales en un archivo portable.</div>
          </div>
          <button type="button" class="btn-admin-primary" onclick="exportFullBackupJSON()" style="white-space:nowrap;">⬇️ Descargar Respaldo</button>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--admin-border);border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:#fff;">📂 2. Restaurar desde Archivo de Respaldo</div>
            <div style="font-size:0.76rem;color:rgba(255,255,255,0.5);">Carga un archivo .json previamente exportado.</div>
          </div>
          <label class="btn-admin-secondary" style="cursor:pointer;white-space:nowrap;margin:0;">
            📤 Subir JSON
            <input type="file" accept=".json" style="display:none;" onchange="handleRestoreBackupFile(event)" />
          </label>
        </div>

        ${isLocal ? `
        <div style="background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.25);border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;color:#fca5a5;">🔄 3. Restaurar Datos Limpios de Demostración Local</div>
            <div style="font-size:0.76rem;color:rgba(255,255,255,0.55);">Reinicia los datos de demostración en este navegador.</div>
          </div>
          <button type="button" class="btn-table btn-table-delete" onclick="resetFactoryDemoDB()" style="white-space:nowrap;padding:8px 14px;">Restablecer Demo</button>
        </div>` : ''}
      </div>
    </div>
  `;
}

async function exportFullBackupJSON() {
  try {
    const dbData = await api.dashboard.backup();
    const dateStr = getLocalDateYMD();
    const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `SISCO_ShinySkin_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Copia de seguridad descargada exitosamente', 'success');
  } catch (err) {
    showToast(err.message || 'No se pudo generar el respaldo.', 'error');
  }
}

function handleRestoreBackupFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.productos)) {
        showToast('El archivo seleccionado no es un respaldo válido de SISCO.', 'error');
        return;
      }
      const res = await api.dashboard.restore(parsed);
      showToast(res.message || 'Base de datos restaurada con éxito. Recargando...', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      showToast(err.message || 'Error al restaurar el archivo JSON de respaldo.', 'error');
    }
  };
  reader.readAsText(file);
}

function resetFactoryDemoDB() {
  if (!confirm('¿Restablecer los datos locales de demostración en este navegador?')) return;
  localStorage.removeItem('sisco_local_db_v2');
  try { window.name = ''; } catch {}
  try { MEMORY_DB = null; } catch {}
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

  const validOrders = (orders || []).filter(o => ['confirmado', 'en_camino', 'entregado'].includes(o.estado));
  const directFacs = (facs || []).filter(f => f.estado === 'pagada' && !f.order_id);

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
            <div>Fecha: ${escapeHtml(fechaEmision)}</div>
            <div>Emitido por: ${escapeHtml(user.nombre)}</div>
          </div>
        </div>

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

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
            <div style="font-weight:700;color:#1a4973;margin-bottom:8px;font-size:0.8rem;">2. Ventas por Canal de Atención</div>
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
                <td style="padding:6px 8px;font-weight:600;">${escapeHtml(t.producto || t.nombre)}</td>
                <td style="padding:6px 8px;text-align:center;">${t.total_vendido} uds.</td>
                <td style="padding:6px 8px;text-align:right;font-weight:700;">${formatCurrency(t.ingresos)}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div style="display:flex;justify-content:space-between;margin-top:26px;padding-top:14px;border-top:1px dashed #cbd5e1;font-size:0.75rem;color:#64748b;">
          <div>Firma Responsable de Caja / Administración: ___________________________</div>
          <div>Documento generado por SISCO v2.1</div>
        </div>
      </div>

      <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
        <button type="button" class="btn-admin-secondary" onclick="document.getElementById('siscoExecReportModal').classList.remove('active')">Cerrar</button>
        <button type="button" class="btn-admin-primary" onclick="window.print()">🖨️ Imprimir / Guardar en PDF</button>
      </div>
    </div>
  `;
}
