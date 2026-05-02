// ============================================================
// incidencias.js — Registro de incidencias y mantenimiento
//
// Funcionalidades:
//   • Reportar incidencia: equipo roto, falta de insumo, red, etc.
//   • Panel de incidencias activas para directivos
//   • Estado: pendiente → en proceso → resuelto
//   • Bloqueo opcional del lab mientras hay incidencia crítica
//   • Badge de incidencias en el panel admin
//
// Depende de: config.js, helpers.js, notificaciones.js

function getSesionActualLocal() {
  if (window.SESSION) return { profeId: window.SESSION.id, nombre: window.SESSION.nombre || window.SESSION.apellido || 'Usuario', rol: window.ROLE || modoUsuario };
  return { profeId: 1, nombre: 'Usuario', rol: modoUsuario };
}
// ============================================================

var INCID_KEY = 'gestor_eest1_incidencias';

// ── Tipos de incidencia ──────────────────────────────────────
var TIPOS_INCID = {
  equipo:   { label: 'Equipo roto / no funciona', icon: '🖥️', color: 'var(--red)',   severo: true  },
  red:      { label: 'Problemas de red / internet', icon: '📡', color: 'var(--amber)', severo: false },
  insumo:   { label: 'Falta de insumos',            icon: '📦', color: 'var(--amber)', severo: false },
  limpieza: { label: 'Problema de limpieza',         icon: '🧹', color: 'var(--blue)',  severo: false },
  software: { label: 'Error de software / sistema',  icon: '💾', color: 'var(--amber)', severo: false },
  acceso:   { label: 'Problema de acceso / llave',   icon: '🔑', color: 'var(--red)',   severo: true  },
  otro:     { label: 'Otro',                          icon: '⚠️', color: 'var(--navy)',  severo: false }
};

var ESTADOS_INCID = {
  pendiente:  { label: 'Pendiente',    color: 'var(--red)',   bg: 'var(--red-dim)'   },
  en_proceso: { label: 'En proceso',   color: 'var(--amber)', bg: 'var(--amber-dim)' },
  resuelto:   { label: 'Resuelto',     color: 'var(--green)', bg: 'var(--green-dim)' }
};

// ── CRUD ─────────────────────────────────────────────────────
function getIncidencias() {
  try {
    var raw = localStorage.getItem(INCID_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveIncidencias(lista) {
  try { localStorage.setItem(INCID_KEY, JSON.stringify(lista)); } catch(e) {}
}

function crearIncidencia(datos) {
  var sesion = getSesionActualLocal();
  var lista = getIncidencias();
  var nueva = {
    id:          Date.now(),
    labId:       datos.labId,
    tipo:        datos.tipo,
    descripcion: datos.descripcion,
    estado:      'pendiente',
    reportadoPor: sesion ? sesion.profeId : null,
    reportadoNombre: sesion ? (sesion.nombre || 'Usuario') : 'Anónimo',
    fechaCreacion: new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    notas:       '',
    bloquearLab: datos.bloquearLab || false
  };
  lista.unshift(nueva);
  saveIncidencias(lista);
  actualizarBadgeIncidencias();

  // Notificar a admins
  crearNotificacion(
    'incidencia',
    'Nueva incidencia — Lab.' + datos.labId,
    TIPOS_INCID[datos.tipo] ? TIPOS_INCID[datos.tipo].label : datos.tipo + ': ' + datos.descripcion.slice(0,60),
    null, // null = visible para todos los admins
    { labId: datos.labId }
  );

  return nueva;
}

function actualizarEstadoIncidencia(id, nuevoEstado, notas) {
  var lista = getIncidencias();
  var incid = lista.find(function(i) { return i.id === id; });
  if (!incid) return;
  incid.estado = nuevoEstado;
  incid.notas = notas || incid.notas;
  incid.fechaActualizacion = new Date().toISOString();
  if (nuevoEstado === 'resuelto') incid.bloquearLab = false;
  saveIncidencias(lista);
  actualizarBadgeIncidencias();
  toast('Estado actualizado a "' + (ESTADOS_INCID[nuevoEstado] || {}).label + '"', 'ok');
  renderIncidencias();
}

function eliminarIncidencia(id) {
  var lista = getIncidencias().filter(function(i) { return i.id !== id; });
  saveIncidencias(lista);
  actualizarBadgeIncidencias();
  renderIncidencias();
}

// ── Consultas de estado ──────────────────────────────────────
function getIncidenciasActivas() {
  return getIncidencias().filter(function(i) { return i.estado !== 'resuelto'; });
}

function labTieneIncidenciaActiva(labId) {
  return getIncidencias().some(function(i) {
    return i.labId === labId && i.estado !== 'resuelto' && i.bloquearLab;
  });
}

function getIncidenciasDeLab(labId) {
  return getIncidencias().filter(function(i) { return i.labId === labId; });
}

// ── Badge en admin ───────────────────────────────────────────
function actualizarBadgeIncidencias() {
  var count = getIncidenciasActivas().length;
  var badge = document.getElementById('incid-badge');
  if (badge) {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

// ── Modal reportar incidencia ────────────────────────────────
function abrirModalIncidencia(labId) {
  var m = document.getElementById('modal-incidencia');
  if (!m) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-incidencia';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML =
      '<div class="modal" style="max-width:480px">' +
        '<div class="modal-header" style="border-bottom:2px solid var(--red)">' +
          '<h3 style="color:var(--red)">⚠️ Reportar incidencia</h3>' +
          '<button class="modal-close" onclick="cerrarModal(\'modal-incidencia\')">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label class="form-label">Laboratorio</label>' +
            '<select class="form-control" id="incid-lab">' +
              (LABS || []).map(function(l) {
                return '<option value="' + l.id + '">' + l.nombre + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Tipo de problema</label>' +
            '<select class="form-control" id="incid-tipo">' +
              Object.keys(TIPOS_INCID).map(function(k) {
                return '<option value="' + k + '">' + TIPOS_INCID[k].label + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Descripción detallada</label>' +
            '<textarea class="form-control" id="incid-desc" rows="3" placeholder="Describí el problema: equipos afectados, síntomas, etc."></textarea>' +
          '</div>' +
          (esDirectivo() ?
          '<div class="form-group">' +
            '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.85rem">' +
              '<input type="checkbox" id="incid-bloquear" style="width:16px;height:16px"/> ' +
              'Marcar el laboratorio como NO DISPONIBLE hasta resolver la incidencia' +
            '</label>' +
          '</div>' : '') +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn-cancel" onclick="cerrarModal(\'modal-incidencia\')">Cancelar</button>' +
          '<button class="btn-ok" style="background:var(--red);border-color:var(--red)" onclick="guardarIncidencia()">Reportar incidencia</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  }

  // Pre-seleccionar lab si viene por parámetro
  if (labId) {
    var sel = document.getElementById('incid-lab');
    if (sel) sel.value = labId;
  }

  abrirModal('modal-incidencia');
}

function guardarIncidencia() {
  var labId  = (document.getElementById('incid-lab')      || {}).value;
  var tipo   = (document.getElementById('incid-tipo')      || {}).value;
  var desc   = (document.getElementById('incid-desc')      || {}).value || '';
  var bloquear = (document.getElementById('incid-bloquear') || {}).checked;

  if (!labId || !tipo || !desc.trim()) {
    toast('Completá todos los campos', 'err');
    return;
  }

  crearIncidencia({ labId: labId, tipo: tipo, descripcion: desc.trim(), bloquearLab: bloquear });
  cerrarModal('modal-incidencia');

  // Limpiar campos
  ['incid-lab','incid-tipo','incid-desc'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var chk = document.getElementById('incid-bloquear');
  if (chk) chk.checked = false;

  toast('Incidencia registrada. El equipo directivo fue notificado.', 'ok');

  // Re-renderizar si estamos en la página de incidencias
  var pIncid = document.getElementById('page-incidencias');
  if (pIncid && pIncid.classList.contains('active')) {
    renderIncidencias();
  }
}

// ── Renderizado panel admin ──────────────────────────────────
function renderIncidencias() {
  var el = document.getElementById('incidencias-tbody');
  if (!el) return;

  var lista = getIncidencias();
  var filtro = (document.getElementById('incid-filtro-estado') || {}).value || 'activas';

  var filtrada = lista.filter(function(i) {
    if (filtro === 'activas') return i.estado !== 'resuelto';
    if (filtro === 'resueltas') return i.estado === 'resuelto';
    return true;
  });

  // Badge count
  var count = document.getElementById('incidencias-count');
  var activas = getIncidenciasActivas().length;
  if (count) count.textContent = activas > 0 ? '(' + activas + ')' : '';

  if (!filtrada.length) {
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">' +
      (filtro === 'activas' ? 'No hay incidencias activas. ¡Todo en orden!' : 'No hay registros.') + '</td></tr>';
    return;
  }

  el.innerHTML = filtrada.map(function(i) {
    var tipo    = TIPOS_INCID[i.tipo]       || { label: i.tipo, icon: '⚠️', color: 'var(--navy)' };
    var estado  = ESTADOS_INCID[i.estado]   || { label: i.estado, color: 'var(--navy)', bg: 'var(--navy-faint)' };
    var lab     = LABS.find(function(l) { return l.id === i.labId; });
    var fecha   = new Date(i.fechaCreacion).toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit'});

    return (
      '<tr' + (i.bloquearLab && i.estado !== 'resuelto' ? ' style="background:#fff5f5"' : '') + '>' +
        '<td>' +
          '<span style="font-size:.8rem">' + tipo.icon + '</span> ' +
          '<span style="color:' + tipo.color + ';font-size:.78rem">' + escIncid(tipo.label) + '</span>' +
          (i.bloquearLab && i.estado !== 'resuelto' ? ' <span class="orient-badge" style="background:var(--red-dim);color:var(--red);font-size:.7rem">🔴 Lab bloqueado</span>' : '') +
        '</td>' +
        '<td><strong>' + (lab ? lab.nombre : 'Lab.' + i.labId) + '</strong></td>' +
        '<td style="font-size:.78rem;max-width:160px">' + escIncid(i.descripcion.slice(0,80)) + (i.descripcion.length > 80 ? '…' : '') + '</td>' +
        '<td style="font-size:.78rem">' + escIncid(i.reportadoNombre) + '<br><span style="color:var(--muted)">' + fecha + '</span></td>' +
        '<td>' +
          '<span style="background:' + estado.bg + ';color:' + estado.color + ';padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600">' +
            estado.label +
          '</span>' +
        '</td>' +
        '<td>' +
          '<select class="form-control" style="font-size:.75rem;padding:3px 6px;min-width:0" ' +
            'onchange="actualizarEstadoIncidencia(' + i.id + ',this.value,\'\')">' +
            Object.keys(ESTADOS_INCID).map(function(k) {
              return '<option value="' + k + '"' + (i.estado === k ? ' selected' : '') + '>' + ESTADOS_INCID[k].label + '</option>';
            }).join('') +
          '</select>' +
        '</td>' +
        '<td>' +
          '<button class="tbl-btn danger" onclick="confirmarEliminarIncidencia(' + i.id + ')">✕</button>' +
        '</td>' +
      '</tr>'
    );
  }).join('');
}

function confirmarEliminarIncidencia(id) {
  confirmar('¿Eliminar este registro de incidencia?', function() {
    eliminarIncidencia(id);
    toast('Incidencia eliminada', 'info');
  });
}

function escIncid(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Inicializar badges al cargar
function iniciarIncidencias() {
  actualizarBadgeIncidencias();
}
