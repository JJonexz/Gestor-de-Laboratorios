// ============================================================
// incidencias.js — Registro de incidencias y mantenimiento
// v2.1 - Modal pre-definido en HTML, selects poblados al abrir
// ============================================================

var INCID_KEY = 'gestor_eest1_incidencias';

var TIPOS_INCID = {
  equipo:   { label: 'Equipo roto / no funciona',  icon: '🖥️', color: 'var(--red)',   severo: true  },
  red:      { label: 'Problemas de red / internet', icon: '📡', color: 'var(--amber)', severo: false },
  insumo:   { label: 'Falta de insumos',            icon: '📦', color: 'var(--amber)', severo: false },
  limpieza: { label: 'Problema de limpieza',         icon: '🧹', color: 'var(--blue)',  severo: false },
  software: { label: 'Error de software / sistema',  icon: '💾', color: 'var(--amber)', severo: false },
  acceso:   { label: 'Problema de acceso / llave',   icon: '🔑', color: 'var(--red)',   severo: true  },
  otro:     { label: 'Otro',                          icon: '⚠️', color: 'var(--navy)',  severo: false }
};

var ESTADOS_INCID = {
  pendiente:  { label: 'Pendiente',  color: 'var(--red)',   bg: 'var(--red-dim)'   },
  en_proceso: { label: 'En proceso', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  resuelto:   { label: 'Resuelto',   color: 'var(--green)', bg: 'var(--green-dim)' }
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
  var profeId  = (window.SESSION && window.SESSION.id) ? window.SESSION.id : 1;
  var nombre   = (window.SESSION && (window.SESSION.nombre || window.SESSION.apellido)) || 'Usuario';
  var lista    = getIncidencias();
  var nueva = {
    id:                 Date.now(),
    labId:              datos.labId,
    tipo:               datos.tipo,
    descripcion:        datos.descripcion,
    estado:             'pendiente',
    reportadoPor:       profeId,
    reportadoNombre:    nombre,
    fechaCreacion:      new Date().toISOString(),
    fechaActualizacion: new Date().toISOString(),
    notas:              '',
    bloquearLab:        datos.bloquearLab || false
  };
  lista.unshift(nueva);
  saveIncidencias(lista);
  actualizarBadgeIncidencias();

  if (typeof crearNotificacion === 'function') {
    crearNotificacion(
      'incidencia',
      'Nueva incidencia — Lab.' + datos.labId,
      (TIPOS_INCID[datos.tipo] ? TIPOS_INCID[datos.tipo].label : datos.tipo) + ': ' + datos.descripcion.slice(0, 60),
      null,
      { labId: datos.labId }
    );
  }
  return nueva;
}

function actualizarEstadoIncidencia(id, nuevoEstado, notas) {
  var lista = getIncidencias();
  var incid = lista.find(function(i) { return i.id === id; });
  if (!incid) return;
  incid.estado             = nuevoEstado;
  incid.notas              = notas || incid.notas;
  incid.fechaActualizacion = new Date().toISOString();
  if (nuevoEstado === 'resuelto') incid.bloquearLab = false;
  saveIncidencias(lista);
  actualizarBadgeIncidencias();
  toast('Estado actualizado a "' + ((ESTADOS_INCID[nuevoEstado] || {}).label || nuevoEstado) + '"', 'ok');
  renderIncidencias();
}

function eliminarIncidencia(id) {
  saveIncidencias(getIncidencias().filter(function(i) { return i.id !== id; }));
  actualizarBadgeIncidencias();
  renderIncidencias();
}

// ── Consultas ─────────────────────────────────────────────────
function getIncidenciasActivas() {
  return getIncidencias().filter(function(i) { return i.estado !== 'resuelto'; });
}

function labTieneIncidenciaActiva(labId) {
  return getIncidencias().some(function(i) {
    return i.labId === labId && i.estado !== 'resuelto' && i.bloquearLab;
  });
}

// ── Badge ─────────────────────────────────────────────────────
function actualizarBadgeIncidencias() {
  var count = getIncidenciasActivas().length;
  var badge = document.getElementById('incid-badge');
  if (badge) {
    badge.textContent  = count > 9 ? '9+' : String(count);
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

// ── Modal (usa HTML pre-definido, solo puebla los selects) ────
function abrirModalIncidencia(labId) {
  // Poblar select de laboratorios (siempre actualizado)
  var selLab = document.getElementById('incid-lab');
  if (selLab) {
    selLab.innerHTML = (LABS || []).map(function(l) {
      return '<option value="' + l.id + '">' + l.nombre + '</option>';
    }).join('');
    if (labId) selLab.value = labId;
  }

  // Poblar select de tipos
  var selTipo = document.getElementById('incid-tipo');
  if (selTipo && !selTipo.options.length) {
    selTipo.innerHTML = Object.keys(TIPOS_INCID).map(function(k) {
      return '<option value="' + k + '">' + TIPOS_INCID[k].label + '</option>';
    }).join('');
  }

  // Mostrar/ocultar opción de bloqueo según rol
  var bloquearWrap = document.getElementById('incid-bloquear-wrap');
  if (bloquearWrap) {
    bloquearWrap.style.display = (typeof esDirectivo === 'function' && esDirectivo()) ? 'block' : 'none';
  }

  // Limpiar campos anteriores
  var desc = document.getElementById('incid-desc');
  if (desc) desc.value = '';
  var chk = document.getElementById('incid-bloquear');
  if (chk) chk.checked = false;

  abrirModal('modal-incidencia');
}

function guardarIncidencia() {
  var labId    = (document.getElementById('incid-lab')      || {}).value || '';
  var tipo     = (document.getElementById('incid-tipo')     || {}).value || '';
  var desc     = ((document.getElementById('incid-desc')    || {}).value || '').trim();
  var bloquear = !!(document.getElementById('incid-bloquear') || {}).checked;

  if (!labId || !tipo || !desc) {
    toast('Completá todos los campos', 'err');
    return;
  }

  crearIncidencia({ labId: labId, tipo: tipo, descripcion: desc, bloquearLab: bloquear });
  cerrarModal('modal-incidencia');
  toast('Incidencia registrada. El equipo directivo fue notificado.', 'ok');
  renderIncidencias();
  if (typeof renderSidebar === 'function') renderSidebar(); // actualiza badge en lab card
}

// ── Render tabla ──────────────────────────────────────────────
function renderIncidencias() {
  var el = document.getElementById('incidencias-tbody');
  if (!el) return;

  var filtro   = (document.getElementById('incid-filtro-estado') || {}).value || 'activas';
  var lista    = getIncidencias();
  var filtrada = lista.filter(function(i) {
    if (filtro === 'activas')   return i.estado !== 'resuelto';
    if (filtro === 'resueltas') return i.estado === 'resuelto';
    return true;
  });

  actualizarBadgeIncidencias();

  if (!filtrada.length) {
    el.innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">' +
      (filtro === 'activas' ? '✅ No hay incidencias activas. ¡Todo en orden!' : 'No hay registros.') +
      '</td></tr>';
    return;
  }

  el.innerHTML = filtrada.map(function(i) {
    var tipo   = TIPOS_INCID[i.tipo]     || { label: i.tipo,    icon: '⚠️', color: 'var(--navy)' };
    var estado = ESTADOS_INCID[i.estado] || { label: i.estado,  color: 'var(--navy)', bg: 'var(--navy-faint)' };
    var lab    = (LABS || []).find(function(l) { return l.id === i.labId; });
    var fecha  = i.fechaCreacion
      ? new Date(i.fechaCreacion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '—';

    return (
      '<tr' + (i.bloquearLab && i.estado !== 'resuelto' ? ' style="background:#fff5f5"' : '') + '>' +
        '<td>' +
          '<span style="font-size:.85rem">' + tipo.icon + '</span> ' +
          '<span style="color:' + tipo.color + ';font-size:.78rem">' + _esc(tipo.label) + '</span>' +
          (i.bloquearLab && i.estado !== 'resuelto'
            ? ' <span class="orient-badge" style="background:var(--red-dim);color:var(--red);font-size:.7rem">🔴 Lab bloqueado</span>'
            : '') +
        '</td>' +
        '<td><strong>' + _esc(lab ? lab.nombre : 'Lab.' + i.labId) + '</strong></td>' +
        '<td style="font-size:.78rem;max-width:180px">' +
          _esc(i.descripcion.slice(0, 90)) + (i.descripcion.length > 90 ? '…' : '') +
        '</td>' +
        '<td style="font-size:.78rem">' +
          _esc(i.reportadoNombre || '—') +
          '<br><span style="color:var(--muted)">' + fecha + '</span>' +
        '</td>' +
        '<td>' +
          '<span style="background:' + estado.bg + ';color:' + estado.color + ';padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600">' +
            estado.label +
          '</span>' +
        '</td>' +
        '<td>' +
          '<select class="form-control" style="font-size:.75rem;padding:3px 6px;min-width:0" ' +
            'onchange="actualizarEstadoIncidencia(' + i.id + ', this.value, \'\')">' +
            Object.keys(ESTADOS_INCID).map(function(k) {
              return '<option value="' + k + '"' + (i.estado === k ? ' selected' : '') + '>' +
                ESTADOS_INCID[k].label + '</option>';
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

function _esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function iniciarIncidencias() {
  actualizarBadgeIncidencias();
}
