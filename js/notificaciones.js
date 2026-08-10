// ============================================================
// notificaciones.js — Sistema de notificaciones en tiempo real
//
// Funcionalidades:
//   • Centro de notificaciones con panel deslizable
//   • Notificaciones persistentes en BD via api.php
//   • Tipos: aprobación, rechazo, espera liberada, vencimiento ciclo,
//            cancelacion_res, cancelacion_sol
//   • Badge con contador en el header
//   • Polling automático cada 15 segundos
//
// Depende de: config.js, helpers.js, db.js (apiFetch)
// ============================================================

var _notifPollInterval = null;
var _cachedNotifs = [];       // cache local para evitar re-fetches innecesarios
var _notifsCargadas = false;
var _notifsFingerprint = '';

function fingerprintNotifs(list) {
  return (list || []).map(function(n) { return n.id; }).join(',');
}

function refreshDataIfNotifsChanged(lista, callback) {
  var fingerprint = fingerprintNotifs(lista);
  if (fingerprint === _notifsFingerprint) {
    if (typeof renderAll === 'function') renderAll();
    if (callback) callback();
    return;
  }
  _notifsFingerprint = fingerprint;
  if (typeof loadFromJSON !== 'function') {
    if (typeof renderAll === 'function') renderAll();
    if (callback) callback();
    return;
  }
  loadFromJSON(function() {
    if (typeof renderAll === 'function') renderAll();
    if (callback) callback();
  });
}

// ── Carga de notificaciones desde API ───────────────────────
function cargarNotificaciones(callback) {
  var sesion = getSesionActualNotif();
  if (!sesion) { _cachedNotifs = []; if (callback) callback([]); return; }
  var qs = sesion.rol === 'admin' ? '?profeId=admin' : '?profeId=' + sesion.profeId;
  apiGet('notificaciones' + qs).then(function(lista) {
    _cachedNotifs = lista || [];
    _notifsCargadas = true;
    refreshDataIfNotifsChanged(_cachedNotifs, function() {
      if (callback) callback(_cachedNotifs);
    });
  }).catch(function() {
    if (callback) callback(_cachedNotifs);
  });
}

function getNotificaciones() {
  return _cachedNotifs;
}

// saveNotificaciones ya no es necesario (persiste en BD), se mantiene como no-op
function saveNotificaciones(lista) { _cachedNotifs = lista; }

// ── Crear notificación (persiste en BD) ──────────────────────
function crearNotificacion(tipo, titulo, cuerpo, profeId, extra) {
  extra = extra || {};
  var datos = {
    tipo:      tipo,
    titulo:    titulo,
    cuerpo:    cuerpo,
    profeId:   profeId !== undefined ? profeId : null,
    labId:     extra.labId     || null,
    reservaId: extra.reservaId || null
  };
  apiPost('notificaciones', datos).then(function(nueva) {
    _cachedNotifs.unshift(nueva);
    if (_cachedNotifs.length > 100) _cachedNotifs = _cachedNotifs.slice(0, 100);
    actualizarBadgeNotif();
    // Toast inmediato si la notificación es para el usuario actual
    var sesion = getSesionActualNotif();
    var esParaMi = sesion && (
      (sesion.rol === 'admin' && profeId === null) ||
      (sesion.profeId == profeId)
    );
    if (esParaMi) {
      var toastTipo = tipo === 'rechazada' || tipo === 'cancelacion_res' || tipo === 'cancelacion_sol'
        ? 'err'
        : tipo === 'aprobada' ? 'ok' : 'info';
      toast(titulo + ': ' + cuerpo, toastTipo);
    }
  }).catch(function(e) {
    // Fallback local si la API falla
    _cachedNotifs.unshift({ id: Date.now(), tipo: tipo, titulo: titulo, cuerpo: cuerpo,
      fecha: new Date().toISOString(), leida: false, profeId: profeId });
    actualizarBadgeNotif();
  });
}

// ── Notificaciones del usuario actual ────────────────────────
function getNotifsPropias() {
  var sesion = getSesionActualNotif();
  if (!sesion) return [];
  var todas = getNotificaciones();
  if (sesion.rol === 'admin') return todas;
  // profeId === null son notificaciones para directivos únicamente; los docentes solo ven las suyas
  return todas.filter(function(n) { return n.profeId !== null && n.profeId === sesion.profeId; });
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
  confirmarOpciones(
    '¿Estás seguro de que deseas eliminar todas las notificaciones?',
    {
      ok: {
        texto: '🗑 Eliminar',
        callback: function() {
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
          toast('Notificaciones eliminadas.', 'ok');
        }
      },
      extra: {
        texto: 'Cancelar',
        style: { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }
      }
    }
  );
}

// ── Renderizado del panel ────────────────────────────────────
var NOTIF_ICONS = {
  aprobada:        { icon: '✓', color: 'var(--green)', bg: 'var(--green-dim)'  },
  rechazada:       { icon: '✕', color: 'var(--red)',   bg: 'var(--red-dim)'    },
  espera_libre:    { icon: '↑', color: 'var(--blue)',  bg: 'var(--blue-dim)'   },
  ciclo_vence:     { icon: '⟳', color: 'var(--amber)', bg: 'var(--amber-dim)'  },
  incidencia:      { icon: '!', color: 'var(--red)',   bg: 'var(--red-dim)'    },
  conflicto:       { icon: '⚡', color: 'var(--amber)', bg: 'var(--amber-dim)'  },
  cancelacion_res: { icon: '✖', color: 'var(--red)',   bg: 'var(--red-dim)'    },
  cancelacion_sol: { icon: '↩', color: 'var(--amber)', bg: 'var(--amber-dim)'  },
  info:            { icon: 'i', color: 'var(--navy)',  bg: 'var(--navy-faint)' }
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

function notifSolicitudAprobada(solicitud, cantModulos) {
  var p = getProfe(solicitud.profeId);
  var mod = getModulo(solicitud.modulo);
  var modLabel = cantModulos && cantModulos > 1
    ? cantModulos + ' módulos (' + mod.inicio + '–…)'
    : mod.label;
  crearNotificacion(
    'aprobada',
    'Turno aprobado',
    'Lab.' + solicitud.lab + ' · ' + DIAS_LARGO[solicitud.dia] + ' ' + modLabel,
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
  cargarNotificaciones(function() {
    actualizarBadgeNotif();
    var panel = document.getElementById('notif-panel');
    if (panel && panel.classList.contains('open')) renderNotifPanel();
  });
  checkCiclosVencimiento();
  if (_notifPollInterval) clearInterval(_notifPollInterval);
  _notifPollInterval = setInterval(function() {
    cargarNotificaciones(function() {
      actualizarBadgeNotif();
      var panel = document.getElementById('notif-panel');
      if (panel && panel.classList.contains('open')) renderNotifPanel();
    });
    checkCiclosVencimiento();
  }, 15000);
}