// ============================================================
// notificaciones.js — Sistema de notificaciones en tiempo real
//
// Funcionalidades:
//   • Centro de notificaciones con panel deslizable
//   • Notificaciones persistentes en localStorage
//   • Tipos: aprobación, rechazo, espera liberada, vencimiento ciclo
//   • Badge con contador en el header
//   • Polling automático cada 15 segundos
//
// Depende de: config.js, helpers.js
// ============================================================

var NOTIF_KEY = 'gestor_eest1_notifs';
var _notifPollInterval = null;

// ── Modelo de notificación ───────────────────────────────────
// { id, tipo, titulo, cuerpo, fecha, leida, profeId, reservaId? }
// Tipos: 'aprobada' | 'rechazada' | 'espera_libre' | 'ciclo_vence' | 'incidencia' | 'conflicto'

function getNotificaciones() {
  try {
    var raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveNotificaciones(lista) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(lista)); } catch(e) {}
}

// ── Crear notificación ───────────────────────────────────────
function crearNotificacion(tipo, titulo, cuerpo, profeId, extra) {
  extra = extra || {};
  var notifs = getNotificaciones();
  var nueva = {
    id:       Date.now() + Math.random(),
    tipo:     tipo,
    titulo:   titulo,
    cuerpo:   cuerpo,
    fecha:    new Date().toISOString(),
    leida:    false,
    profeId:  profeId,
    reservaId: extra.reservaId || null,
    labId:    extra.labId || null
  };
  notifs.unshift(nueva);
  // Máximo 50 notificaciones
  if (notifs.length > 50) notifs = notifs.slice(0, 50);
  saveNotificaciones(notifs);
  actualizarBadgeNotif();
  // Toast inmediato si es para el usuario actual
  var sesion = getSesionActualNotif();
  if (sesion && sesion.profeId === profeId) {
    toast(titulo + ': ' + cuerpo, tipo === 'rechazada' ? 'error' : tipo === 'aprobada' ? 'success' : 'info');
  }
}

// ── Notificaciones del usuario actual ────────────────────────
function getNotifsPropias() {
  var sesion = getSesionActualNotif();
  if (!sesion) return [];
  var todas = getNotificaciones();
  if (sesion.rol === 'admin') return todas;
  return todas.filter(function(n) { return n.profeId === sesion.profeId || n.profeId === null; });
}

function getNoLeidas() {
  return getNotifsPropias().filter(function(n) { return !n.leida; });
}

// ── Badge en el header ───────────────────────────────────────
function actualizarBadgeNotif() {
  var count = getNoLeidas().length;
  var badge = document.getElementById('notif-badge');
  if (!badge) return;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// ── Panel de notificaciones ──────────────────────────────────
function togglePanelNotif() {
  var panel   = document.getElementById('notif-panel');
  var overlay = document.getElementById('notif-overlay');
  if (!panel) return;
  var isOpen = panel.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open', isOpen);
  if (isOpen) {
    renderNotifPanel();
    setTimeout(function() { marcarTodasLeidas(); }, 2000);
  }
}

function cerrarPanelNotif() {
  var panel   = document.getElementById('notif-panel');
  var overlay = document.getElementById('notif-overlay');
  if (panel)   panel.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

function marcarTodasLeidas() {
  var todas = getNotificaciones();
  var sesion = getSesionActualNotif();
  if (!sesion) return;
  todas.forEach(function(n) {
    if (sesion.rol === 'admin' || n.profeId === sesion.profeId || n.profeId === null) {
      n.leida = true;
    }
  });
  saveNotificaciones(todas);
  actualizarBadgeNotif();
}

function limpiarNotificaciones() {
  var todas = getNotificaciones();
  var sesion = getSesionActualNotif();
  if (!sesion) return;
  var filtradas;
  if (sesion.rol === 'admin') {
    filtradas = [];
  } else {
    filtradas = todas.filter(function(n) {
      return n.profeId !== sesion.profeId && n.profeId !== null;
    });
  }
  saveNotificaciones(filtradas);
  renderNotifPanel();
  actualizarBadgeNotif();
}

// ── Renderizado del panel ────────────────────────────────────
var NOTIF_ICONS = {
  aprobada:    { icon: '✓', color: 'var(--green)', bg: 'var(--green-dim)' },
  rechazada:   { icon: '✕', color: 'var(--red)',   bg: 'var(--red-dim)'   },
  espera_libre:{ icon: '↑', color: 'var(--blue)',  bg: 'var(--blue-dim)'  },
  ciclo_vence: { icon: '⟳', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  incidencia:  { icon: '!', color: 'var(--red)',   bg: 'var(--red-dim)'   },
  conflicto:   { icon: '⚡', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  info:        { icon: 'i', color: 'var(--navy)',  bg: 'var(--navy-faint)' }
};

function renderNotifPanel() {
  var body = document.getElementById('notif-list');
  if (!body) return;
  var notifs = getNotifsPropias();

  if (!notifs.length) {
    body.innerHTML = '<div class="notif-empty"><div class="notif-empty-icon">🔔</div><div>Sin notificaciones</div><div class="notif-empty-sub">Todo en orden por ahora</div></div>';
    return;
  }

  body.innerHTML = notifs.map(function(n) {
    var cfg = NOTIF_ICONS[n.tipo] || NOTIF_ICONS.info;
    var fechaRel = tiempoRelativo(n.fecha);
    return (
      '<div class="notif-item' + (n.leida ? ' leida' : '') + '" data-id="' + n.id + '">' +
        '<div class="notif-icon-wrap" style="background:' + cfg.bg + ';color:' + cfg.color + '">' + cfg.icon + '</div>' +
        '<div class="notif-content">' +
          '<div class="notif-titulo">' + escHtml(n.titulo) + '</div>' +
          '<div class="notif-cuerpo">' + escHtml(n.cuerpo) + '</div>' +
          '<div class="notif-fecha">' + fechaRel + '</div>' +
        '</div>' +
        (!n.leida ? '<div class="notif-dot"></div>' : '') +
      '</div>'
    );
  }).join('');
}

function tiempoRelativo(isoStr) {
  var diff = Date.now() - new Date(isoStr).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Ahora mismo';
  if (mins < 60) return 'Hace ' + mins + ' min';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24)  return 'Hace ' + hrs + ' h';
  var dias = Math.floor(hrs / 24);
  return 'Hace ' + dias + ' día' + (dias > 1 ? 's' : '');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getSesionActualNotif() {
  if (window.SESSION) return { profeId: window.SESSION.id, rol: window.ROLE || modoUsuario };
  return { profeId: getCurrentProfId(), rol: modoUsuario };
}

// ── Detección automática de eventos ─────────────────────────
// Genera notificaciones para ciclos didácticos próximos a vencer
function checkCiclosVencimiento() {
  var sesion = getSesionActualNotif();
  if (!sesion) return;
  var profeId = sesion.profeId;
  var hoy = new Date();
  hoy.setHours(0,0,0,0);

  RESERVAS.forEach(function(r) {
    if (r.profeId !== profeId) return;
    // Si cicloClases === 3, debe renovar
    if (r.cicloClases >= 3) {
      var yaNotificado = getNotificaciones().some(function(n) {
        return n.tipo === 'ciclo_vence' && n.reservaId === r.id;
      });
      if (!yaNotificado) {
        var mod = getModulo(r.modulo);
        var dia = DIAS_LARGO[r.dia] || 'día ' + r.dia;
        crearNotificacion(
          'ciclo_vence',
          'Renovar turno',
          'Clase ' + r.cicloClases + '/3 completada — ' + dia + ' ' + mod.label + ' Lab.' + r.lab,
          profeId,
          { reservaId: r.id, labId: r.lab }
        );
      }
    }
  });
}

// ── Hooks para disparar notificaciones desde otros módulos ───
// Llamar desde reservas.js al aprobar/rechazar solicitudes

function notifSolicitudAprobada(solicitud) {
  var p = getProfe(solicitud.profeId);
  var mod = getModulo(solicitud.modulo);
  crearNotificacion(
    'aprobada',
    'Turno aprobado',
    'Lab.' + solicitud.lab + ' · ' + DIAS_LARGO[solicitud.dia] + ' ' + mod.label,
    solicitud.profeId,
    { reservaId: solicitud.id, labId: solicitud.lab }
  );
}

function notifSolicitudRechazada(solicitud, motivo) {
  var mod = getModulo(solicitud.modulo);
  crearNotificacion(
    'rechazada',
    'Turno rechazado',
    'Lab.' + solicitud.lab + ' · ' + DIAS_LARGO[solicitud.dia] + ' ' + mod.label + (motivo ? ' — ' + motivo : ''),
    solicitud.profeId,
    { reservaId: solicitud.id, labId: solicitud.lab }
  );
}

function notifEsperaLiberada(entrada) {
  var mod = getModulo(entrada.modulo);
  crearNotificacion(
    'espera_libre',
    'Turno disponible',
    'Lab.' + entrada.lab + ' · ' + DIAS_LARGO[entrada.dia] + ' ' + mod.label + ' se liberó. Podés solicitarlo ahora.',
    entrada.profeId,
    { labId: entrada.lab }
  );
}

function notifConflictoDetectado(reserva) {
  crearNotificacion(
    'conflicto',
    'Conflicto de horario',
    'Lab.' + reserva.lab + ' ya fue asignado a otro docente en ese módulo.',
    reserva.profeId,
    { reservaId: reserva.id, labId: reserva.lab }
  );
}

// ── Polling automático ───────────────────────────────────────
function iniciarPollingNotif() {
  checkCiclosVencimiento();
  actualizarBadgeNotif();
  if (_notifPollInterval) clearInterval(_notifPollInterval);
  _notifPollInterval = setInterval(function() {
    checkCiclosVencimiento();
    actualizarBadgeNotif();
    // Si el panel está abierto, refrescar
    var panel = document.getElementById('notif-panel');
    if (panel && panel.classList.contains('open')) {
      renderNotifPanel();
    }
  }, 15000);
}
