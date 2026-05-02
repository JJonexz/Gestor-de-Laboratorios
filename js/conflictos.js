// ============================================================
// conflictos.js — Detección de conflictos y sincronización
//
// Funcionalidades:
//   • Validación de conflictos antes de aprobar solicitudes
//   • Detección de condiciones de carrera con timestamp
//   • Sincronización entre pestañas via StorageEvent
//   • Indicador de estado de sincronización en el header
//   • Lock optimista para reservas concurrentes
//
// Depende de: config.js, db.js, notificaciones.js
// ============================================================

var LOCK_KEY     = 'gestor_eest1_locks';
var SYNC_KEY     = 'gestor_eest1_sync';
var LOCK_TTL_MS  = 10000; // 10 segundos máximo de lock
var _syncHandler = null;

// ── Locks optimistas ─────────────────────────────────────────
function getLocks() {
  try {
    var raw = localStorage.getItem(LOCK_KEY);
    var locks = raw ? JSON.parse(raw) : {};
    // Limpiar locks vencidos
    var now = Date.now();
    var limpio = false;
    Object.keys(locks).forEach(function(k) {
      if (now - locks[k].ts > LOCK_TTL_MS) { delete locks[k]; limpio = true; }
    });
    if (limpio) localStorage.setItem(LOCK_KEY, JSON.stringify(locks));
    return locks;
  } catch(e) { return {}; }
}

function lockKey(lab, dia, modulo, semanaOffset) {
  return [lab, dia, modulo, semanaOffset || 0].join('_');
}

function adquirirLock(lab, dia, modulo, semanaOffset) {
  var key = lockKey(lab, dia, modulo, semanaOffset);
  var locks = getLocks();
  var sesion = getSesionActualConflicto();
  var userId = sesion ? (sesion.profeId || 'anon') : 'anon';

  if (locks[key] && locks[key].user !== userId) {
    return false; // Slot bloqueado por otro usuario
  }
  locks[key] = { user: userId, ts: Date.now() };
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(locks)); } catch(e) {}
  return true;
}

function liberarLock(lab, dia, modulo, semanaOffset) {
  var key = lockKey(lab, dia, modulo, semanaOffset);
  var locks = getLocks();
  delete locks[key];
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(locks)); } catch(e) {}
}

// ── Validación de conflicto ──────────────────────────────────
// Retorna null si está libre, o { tipo, mensaje } si hay conflicto
function validarConflicto(lab, dia, modulo, semanaOffset, solicitanteId, ignorarId) {
  semanaOffset = semanaOffset || 0;

  // 1. Verificar reservas existentes
  var conflictoReserva = RESERVAS.find(function(r) {
    return r.lab === lab &&
           r.dia === dia &&
           r.modulo === modulo &&
           r.semanaOffset === semanaOffset &&
           r.id !== ignorarId;
  });
  if (conflictoReserva) {
    var p = getProfe(conflictoReserva.profeId);
    return {
      tipo: 'reserva',
      mensaje: 'El Lab.' + lab + ' ya tiene una reserva confirmada para ese módulo' +
               (p ? ' (Prof. ' + p.apellido + ')' : '') + '.'
    };
  }

  // 2. Verificar solicitudes pendientes para el mismo slot
  var conflictoSolic = SOLICITUDES.find(function(s) {
    return s.lab === lab &&
           s.dia === dia &&
           s.modulo === modulo &&
           s.semanaOffset === semanaOffset &&
           s.estado === 'pendiente' &&
           s.profeId !== solicitanteId;
  });
  if (conflictoSolic) {
    var p2 = getProfe(conflictoSolic.profeId);
    return {
      tipo: 'solicitud',
      mensaje: 'Otro docente' + (p2 ? ' (Prof. ' + p2.apellido + ')' : '') +
               ' ya solicitó ese turno y está pendiente de aprobación.'
    };
  }

  // 3. Verificar lock activo
  var locks = getLocks();
  var key = lockKey(lab, dia, modulo, semanaOffset);
  var sesion = getSesionActualConflicto();
  var userId = sesion ? (sesion.profeId || 'anon') : 'anon';
  if (locks[key] && locks[key].user !== userId) {
    return {
      tipo: 'lock',
      mensaje: 'Otro usuario está procesando ese turno en este momento. Intentá en unos segundos.'
    };
  }

  return null; // Sin conflicto
}

// ── Aprobar solicitud con validación atómica ─────────────────
// Reemplaza la función aceptarSolicitud en reservas.js
function aceptarSolicitudSegura(id) {
  var s = SOLICITUDES.find(function(x) { return x.id === id; });
  if (!s) { toast('Solicitud no encontrada', 'err'); return; }
  if (s.estado !== 'pendiente') { toast('Esta solicitud ya fue procesada', 'err'); return; }

  // Adquirir lock antes de validar
  if (!adquirirLock(s.lab, s.dia, s.modulo, s.semanaOffset)) {
    toast('Otro administrador está procesando este turno. Esperá un momento.', 'err');
    return;
  }

  // Validar conflicto en el momento de aprobar
  var conflicto = validarConflicto(s.lab, s.dia, s.modulo, s.semanaOffset, s.profeId, null);
  if (conflicto) {
    liberarLock(s.lab, s.dia, s.modulo, s.semanaOffset);
    toast('Conflicto detectado: ' + conflicto.mensaje, 'err');
    mostrarAlertaConflicto(conflicto, s);
    return;
  }

  // Aprobar: crear reserva y actualizar solicitud
  try {
    s.estado = 'aprobada';
    var nuevaReserva = {
      id:           nextId++,
      semanaOffset: s.semanaOffset,
      dia:          s.dia,
      modulo:       s.modulo,
      lab:          s.lab,
      curso:        s.curso,
      orient:       s.orient,
      profeId:      s.profeId,
      secuencia:    s.secuencia,
      cicloClases:  s.cicloClases || 1,
      renovaciones: s.esRenovacion ? (s.renovacionNum || 0) : 0
    };
    RESERVAS.push(nuevaReserva);
    saveDB();

    // Notificar al docente
    notifSolicitudAprobada(s);

    // Notificar a quienes están en lista de espera para ese slot
    var enEspera = LISTA_ESPERA.filter(function(e) {
      return e.lab === s.lab && e.dia === s.dia && e.modulo === s.modulo;
    });

    // Emitir evento de sincronización para otras pestañas
    emitirSync('reserva_aprobada', { reservaId: nuevaReserva.id, lab: s.lab, dia: s.dia, modulo: s.modulo });

    liberarLock(s.lab, s.dia, s.modulo, s.semanaOffset);
    toast('Turno aprobado y asignado a ' + (getProfe(s.profeId) ? getProfe(s.profeId).apellido : 'docente'), 'ok');
    renderAdmin();
    renderCalendario();
  } catch(e) {
    liberarLock(s.lab, s.dia, s.modulo, s.semanaOffset);
    toast('Error al procesar la solicitud: ' + e.message, 'err');
  }
}

// ── Rechazar con notificación ────────────────────────────────
function rechazarSolicitudSegura(id, motivo) {
  var s = SOLICITUDES.find(function(x) { return x.id === id; });
  if (!s) { toast('Solicitud no encontrada', 'err'); return; }

  s.estado = 'rechazada';
  s.motivoRechazo = motivo || '';
  saveDB();

  notifSolicitudRechazada(s, motivo);

  // Notificar a quien sigue en lista de espera para ese slot
  var siguienteEspera = LISTA_ESPERA.find(function(e) {
    return e.lab === s.lab && e.dia === s.dia && e.modulo === s.modulo;
  });
  if (siguienteEspera) {
    notifEsperaLiberada(siguienteEspera);
  }

  emitirSync('solicitud_rechazada', { solicitudId: id });
  toast('Solicitud rechazada', 'info');
  renderAdmin();
}

// ── Modal de conflicto ───────────────────────────────────────
function mostrarAlertaConflicto(conflicto, solicitud) {
  var mod = getModulo(solicitud.modulo);
  var msg = document.getElementById('confirm-body');
  if (msg) {
    msg.innerHTML =
      '<div style="background:var(--red-dim);border:1px solid var(--red);border-radius:8px;padding:12px;margin-bottom:10px">' +
        '<strong style="color:var(--red)">⚡ ' + conflicto.tipo.toUpperCase() + '</strong>' +
        '<p style="margin:6px 0 0;color:var(--red)">' + conflicto.mensaje + '</p>' +
      '</div>' +
      '<p>La solicitud de <strong>' + (getProfe(solicitud.profeId) ? getProfe(solicitud.profeId).apellido : 'Docente') + '</strong> ' +
      'para Lab.' + solicitud.lab + ' · ' + (mod ? mod.label : '') + ' no puede aprobarse.</p>' +
      '<p style="color:var(--muted);font-size:.8rem">Podés rechazarla manualmente o asignar un turno alternativo.</p>';
  }
  var okBtn = document.getElementById('confirm-ok-btn');
  if (okBtn) {
    okBtn.textContent = 'Rechazar solicitud';
    okBtn.onclick = function() {
      rechazarSolicitudSegura(solicitud.id, 'Conflicto de horario detectado automáticamente');
      cerrarModal('modal-confirm');
    };
  }
  abrirModal('modal-confirm');
}

// ── Sincronización entre pestañas ────────────────────────────
function emitirSync(evento, datos) {
  try {
    var payload = { evento: evento, datos: datos, ts: Date.now() };
    localStorage.setItem(SYNC_KEY, JSON.stringify(payload));
    // Remover inmediatamente para que el próximo cambio siempre dispare el evento
    setTimeout(function() {
      try { localStorage.removeItem(SYNC_KEY); } catch(e) {}
    }, 100);
  } catch(e) {}
}

function manejarSync(ev) {
  if (ev.key !== SYNC_KEY || !ev.newValue) return;
  try {
    var payload = JSON.parse(ev.newValue);
    var evento = payload.evento;

    if (evento === 'reserva_aprobada' || evento === 'solicitud_rechazada') {
      // Recargar datos y re-renderizar
      loadFromLocalStorage();
      if (typeof renderCalendario === 'function') renderCalendario();
      var pAdmin = document.getElementById('page-admin');
      if (pAdmin && pAdmin.classList.contains('active')) renderAdmin();
      actualizarBadgeNotif && actualizarBadgeNotif();
      mostrarIndicadorSync('Actualizado desde otra pestaña');
    }
  } catch(e) {}
}

function iniciarSyncPestanas() {
  if (_syncHandler) window.removeEventListener('storage', _syncHandler);
  _syncHandler = manejarSync;
  window.addEventListener('storage', _syncHandler);
}

// ── Indicador de sincronización ──────────────────────────────
function mostrarIndicadorSync(mensaje) {
  var ind = document.getElementById('sync-indicator');
  if (!ind) return;
  ind.textContent = '⟳ ' + mensaje;
  ind.style.opacity = '1';
  clearTimeout(ind._hideTimer);
  ind._hideTimer = setTimeout(function() {
    ind.style.opacity = '0';
  }, 3000);
}

function actualizarIndicadorSync() {
  var ind = document.getElementById('sync-indicator');
  if (!ind) return;
  var ahora = new Date().toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'});
  ind.title = 'Última actualización: ' + ahora;
}

// ── Verificar si un slot está bloqueado (para UI) ────────────
function estaEnConflicto(lab, dia, modulo, semanaOffset) {
  return !!validarConflicto(lab, dia, modulo, semanaOffset || 0, null, null);
}
