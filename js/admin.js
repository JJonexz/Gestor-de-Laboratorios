// ============================================================
// admin.js — Panel de administración
//
// ¿Qué hay acá?
//   • renderAdmin()              → orquesta todas las sub-secciones
//   • renderSolicitudesAdmin()   → tabla de solicitudes pendientes
//   • renderProfesores()         → tabla de docentes con búsqueda
//   • renderLabsConfig()         → lista de espacios configurables
//   • renderAdminReservas()      → tabla completa de reservas
//   • renderPautasAdmin()        → lista de pautas de uso
//
//   CRUD docentes: abrirModalDocente, editarDocente, guardarDocente, eliminarDocente
//   CRUD labs:     abrirModalLab, editarLab, guardarLab, toggleEstadoLab, eliminarLab
//   CRUD pautas:   abrirModalPauta, guardarPauta, eliminarPauta
//
// Depende de: config.js, helpers.js, ui.js, db.js
// ============================================================

// ── Orquestador principal del panel Admin ────────────────────
function renderAdmin() {
  var total      = RESERVAS.length;
  var pendientes = SOLICITUDES.filter(function(s) { return s.estado === 'pendiente'; }).length;
  var docActivos = new Set(RESERVAS.map(function(r) { return r.profeId; })).size;
  var labs       = LABS.length;

  // Estadísticas del encabezado
  ['s-semana', 's-pendientes', 's-docs', 's-labs'].forEach(function(id, i) {
    var el = document.getElementById(id);
    if (el) el.textContent = [total, pendientes, docActivos, labs][i];
  });

  renderSolicitudesAdmin();
  renderProfesores();
  renderLabsConfig();
  renderAdminReservas();
  renderPautasAdmin();
  // Nuevos módulos
  if (typeof renderIncidencias      === 'function') renderIncidencias();
  if (typeof renderCalendarioEscolar === 'function') renderCalendarioEscolar();
  if (typeof actualizarBadgeIncidencias === 'function') actualizarBadgeIncidencias();
}

// ── Tabla de solicitudes pendientes ─────────────────────────
function renderSolicitudesAdmin() {
  var el = document.getElementById('solicitudes-tbody');
  if (!el) return;

  var solic = SOLICITUDES.filter(function(s) { return s.estado === 'pendiente'; });
  var count = document.getElementById('solicitudes-count');
  if (count) count.textContent = solic.length ? '(' + solic.length + ')' : '';

  if (!solic.length) {
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">No hay solicitudes pendientes.</td></tr>';
    return;
  }

  el.innerHTML = solic.map(function(s) {
    var p     = getProfe(s.profeId);
    var ori   = ORIENTACIONES[s.orient];
    var fecha = getDiaDate(s.semanaOffset, s.dia);
    var mod   = getModulo(s.modulo);
    var renovBadge = s.esRenovacion
      ? '&nbsp;<span style="font-size:9px;font-weight:700;background:var(--navy);color:#fff;padding:1px 4px;border-radius:3px;">RENOV ' + s.renovacionNum + '/1</span>'
      : '';
    var rowStyle = s.esRenovacion ? ' style="background:#eff6ff"' : '';
    return (
      '<tr' + rowStyle + '>' +
        '<td>Prof. ' + p.apellido + '</td>' +
        '<td>Lab.' + s.lab + renovBadge + '</td>' +
        '<td>' + DIAS_SEMANA[s.dia] + ' ' + formatFecha(fecha) + '</td>' +
        '<td>' + mod.label + ' (' + mod.inicio + ')</td>' +
        '<td>' + s.curso + '</td>' +
        '<td><span class="orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></td>' +
        '<td>' +
          '<div class="table-actions">' +
            '<button class="tbl-btn ok" onclick="aceptarSolicitud(' + s.id + ')">✓ Aprobar</button>' +
            '<button class="tbl-btn danger" onclick="rechazarSolicitud(' + s.id + ')">✕ Rechazar</button>' +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');
}

// ── Tabla de docentes con búsqueda ────────────────────────────
function renderProfesores() {
  var qEl     = document.getElementById('search-prof');
  var q       = qEl ? qEl.value.toLowerCase() : '';
  var tbody   = document.getElementById('prof-tbody');
  if (!tbody) return;

  var filtered = PROFESORES.filter(function(p) {
    return (p.apellido + ' ' + p.nombre + ' ' + p.materia).toLowerCase().indexOf(q) >= 0;
  });

  tbody.innerHTML = filtered.map(function(p) {
    var ori     = ORIENTACIONES[p.orientacion] || ORIENTACIONES.bas;
    var reservas = RESERVAS.filter(function(r) { return r.profeId === p.id; }).length;
    return (
      '<tr>' +
        '<td><strong>' + p.apellido + '</strong>, ' + p.nombre + '</td>' +
        '<td>' + p.materia + '</td>' +
        '<td><span class="orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></td>' +
        '<td><strong>' + reservas + '</strong></td>' +
        '<td>' +
          '<div class="table-actions">' +
            '<button class="tbl-btn" onclick="editarDocente(' + p.id + ')">✏️ Editar</button>' +
            '<button class="tbl-btn danger" onclick="eliminarDocente(' + p.id + ')">🗑</button>' +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">No se encontraron docentes.</td></tr>';
  }
}

// ── Lista de laboratorios configurables ───────────────────────
function renderLabsConfig() {
  var el = document.getElementById('labs-config-list');
  if (!el) return;

  if (!LABS.length) {
    el.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;">No hay espacios configurados.</div>';
    return;
  }

  el.innerHTML = LABS.map(function(l) {
    var statusBadge = l.ocupado ? 'ob-err' : 'ob-ok';
    var statusTxt   = l.ocupado ? 'Mantenimiento' : 'Disponible';
    var toggleTxt   = l.ocupado ? '🟢 Liberar' : '🔴 Ocupar';
    return (
      '<div class="lab-config-card">' +
        '<div class="lab-config-icon">🖥️</div>' +
        '<div class="lab-config-info">' +
          '<div class="lab-config-name">' + l.nombre + '</div>' +
          '<div class="lab-config-sub">' + l.capacidad + ' equipos · ' + (l.notas || 'Sin notas') + '</div>' +
        '</div>' +
        '<span class="orient-badge ' + statusBadge + '" style="margin-right:8px;">' + statusTxt + '</span>' +
        '<div class="lab-config-actions">' +
          '<button class="tbl-btn" onclick="editarLab(\'' + l.id + '\')">✏️ Editar</button>' +
          '<button class="tbl-btn" onclick="toggleEstadoLab(\'' + l.id + '\')">' + toggleTxt + '</button>' +
          '<button class="tbl-btn danger" onclick="eliminarLab(\'' + l.id + '\')">🗑</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
}

// ── Tabla de todas las reservas ───────────────────────────────
function renderAdminReservas() {
  var tbody   = document.getElementById('admin-reservas-tbody');
  if (!tbody) return;

  var filterEl = document.getElementById('admin-filter-orient');
  var filterO  = filterEl ? filterEl.value : 'all';
  var filtered = RESERVAS.filter(function(r) { return filterO === 'all' || r.orient === filterO; });

  tbody.innerHTML = filtered.map(function(r) {
    var p        = getProfe(r.profeId);
    var ori      = ORIENTACIONES[r.orient];
    var fecha    = getDiaDate(r.semanaOffset, r.dia);
    var mod      = getModulo(r.modulo);
    var pct      = (r.cicloClases / 3) * 100;
    return (
      '<tr>' +
        '<td>Prof. ' + p.apellido + '</td>' +
        '<td>Lab.' + r.lab + '</td>' +
        '<td>' + DIAS_SEMANA[r.dia] + ' ' + formatFecha(fecha) + '</td>' +
        '<td>' + mod.label + '</td>' +
        '<td>' + r.curso + '</td>' +
        '<td><span class="orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></td>' +
        '<td>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<div style="width:40px;background:var(--border);border-radius:20px;height:5px;overflow:hidden;">' +
              '<div style="width:' + pct + '%;height:100%;background:var(--navy);border-radius:20px;"></div>' +
            '</div>' +
            '<span style="font-size:11px;color:var(--muted);">' + r.cicloClases + '/3</span>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<div class="table-actions">' +
            '<button class="tbl-btn" onclick="verDetalle(' + r.id + ')">👁 Ver</button>' +
            '<button class="tbl-btn danger" onclick="cancelarReserva(' + r.id + ')">🗑</button>' +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">No hay reservas.</td></tr>';
  }
}

// ── Lista de pautas de uso ─────────────────────────────────────
function renderPautasAdmin() {
  var el = document.getElementById('pautas-admin-list');
  if (!el) return;

  if (!PAUTAS.length) {
    el.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;">No hay pautas configuradas.</div>';
    return;
  }

  el.innerHTML = PAUTAS.map(function(p, i) {
    return (
      '<div class="list-item" style="padding:10px 18px;">' +
        '<span class="chk">✓</span>' +
        '<span style="flex:1;font-size:13px;">' + p + '</span>' +
        '<button class="tbl-btn danger" onclick="eliminarPauta(' + i + ')" style="padding:2px 7px;font-size:11px;">✕</button>' +
      '</div>'
    );
  }).join('');
}

// ── CRUD Docentes ─────────────────────────────────────────────

function abrirModalDocente() {
  editDocenteId = null;
  document.getElementById('modal-docente-title').textContent = '+ Agregar docente';
  ['doc-apellido', 'doc-nombre', 'doc-materia'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var orient = document.getElementById('doc-orient'); if (orient) orient.value = 'info';
  abrirModal('modal-docente');
}

function editarDocente(id) {
  var p = getProfe(id);
  editDocenteId = id;
  document.getElementById('modal-docente-title').textContent = '✏️ Editar docente';
  document.getElementById('doc-apellido').value = p.apellido;
  document.getElementById('doc-nombre').value   = p.nombre;
  document.getElementById('doc-materia').value  = p.materia;
  document.getElementById('doc-orient').value   = p.orientacion;
  abrirModal('modal-docente');
}

function guardarDocente() {
  var apellido = document.getElementById('doc-apellido').value.trim();
  var nombre   = document.getElementById('doc-nombre').value.trim();
  var materia  = document.getElementById('doc-materia').value.trim();
  var orient   = document.getElementById('doc-orient').value;

  if (!apellido || !nombre || !materia) { toast('Completá todos los campos.', 'err'); return; }

  if (editDocenteId) {
    var p = PROFESORES.find(function(x) { return x.id === editDocenteId; });
    if (p) { p.apellido = apellido; p.nombre = nombre; p.materia = materia; p.orientacion = orient; }
    toast('Docente actualizado.', 'ok');
  } else {
    nextId++;
    PROFESORES.push({ id: nextId, apellido: apellido, nombre: nombre, materia: materia, orientacion: orient });
    toast('Docente agregado.', 'ok');
  }

  cerrarModal('modal-docente');
  saveDB();
  renderAdmin();
}

function eliminarDocente(id) {
  var p = getProfe(id);
  confirmar('¿Eliminar a <strong>' + p.apellido + ', ' + p.nombre + '</strong>? Se eliminarán sus reservas.', function() {
    PROFESORES  = PROFESORES.filter(function(x)  { return x.id !== id; });
    RESERVAS    = RESERVAS.filter(function(r)    { return r.profeId !== id; });
    SOLICITUDES = SOLICITUDES.filter(function(s) { return s.profeId !== id; });
    saveDB();
    toast('Docente eliminado.', 'info');
    renderAdmin();
    renderCalendario();
  });
}

// ── CRUD Laboratorios ─────────────────────────────────────────

function abrirModalLab() {
  editLabId = null;
  document.getElementById('modal-lab-title').textContent = '+ Agregar espacio';
  ['lab-nombre', 'lab-capacidad', 'lab-notas'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var estado = document.getElementById('lab-estado'); if (estado) estado.value = 'libre';
  abrirModal('modal-lab');
}

function editarLab(id) {
  var l = getLab(id);
  editLabId = id;
  document.getElementById('modal-lab-title').textContent = '✏️ Editar espacio';
  document.getElementById('lab-nombre').value    = l.nombre;
  document.getElementById('lab-capacidad').value = l.capacidad || '';
  document.getElementById('lab-estado').value    = l.ocupado ? 'ocupado' : 'libre';
  document.getElementById('lab-notas').value     = l.notas || '';
  abrirModal('modal-lab');
}

function guardarLab() {
  var nombre    = document.getElementById('lab-nombre').value.trim();
  var capacidad = parseInt(document.getElementById('lab-capacidad').value) || 0;
  var estado    = document.getElementById('lab-estado').value;
  var notas     = document.getElementById('lab-notas').value.trim();

  if (!nombre) { toast('Ingresá un nombre para el espacio.', 'err'); return; }

  if (editLabId) {
    var l = LABS.find(function(x) { return x.id === editLabId; });
    if (l) { l.nombre = nombre; l.capacidad = capacidad; l.ocupado = estado === 'ocupado'; l.notas = notas; }
    toast('Espacio actualizado.', 'ok');
  } else {
    var newId = String.fromCharCode(65 + LABS.length); // A, B, C…
    LABS.push({ id: newId, nombre: nombre, capacidad: capacidad, ocupado: estado === 'ocupado', notas: notas });
    toast('Espacio "' + nombre + '" agregado.', 'ok');
  }

  cerrarModal('modal-lab');
  saveDB();
  renderAdmin();
  renderCalendario();
}

function toggleEstadoLab(id) {
  var l = LABS.find(function(x) { return x.id === id; });
  if (!l) return;
  l.ocupado = !l.ocupado;
  saveDB();
  toast('Lab.' + l.id + ': ' + (l.ocupado ? 'En mantenimiento' : 'Disponible') + '.', 'info');
  renderAdmin();
  renderSidebar();
}

function eliminarLab(id) {
  var l = getLab(id);
  confirmar('¿Eliminar el espacio <strong>' + l.nombre + '</strong>? Se eliminarán sus reservas.', function() {
    LABS        = LABS.filter(function(x)        { return x.id !== id; });
    RESERVAS    = RESERVAS.filter(function(r)    { return r.lab !== id; });
    SOLICITUDES = SOLICITUDES.filter(function(s) { return s.lab !== id; });
    saveDB();
    toast('Espacio eliminado.', 'info');
    renderAdmin();
    renderCalendario();
  });
}

// ── CRUD Pautas ───────────────────────────────────────────────

function abrirModalPauta() {
  var el = document.getElementById('pauta-texto');
  if (el) el.value = '';
  abrirModal('modal-pauta');
}

function guardarPauta() {
  var txt = document.getElementById('pauta-texto').value.trim();
  if (!txt) { toast('Ingresá el texto de la pauta.', 'err'); return; }
  PAUTAS.push(txt);
  cerrarModal('modal-pauta');
  saveDB();
  toast('Pauta agregada.', 'ok');
  renderAdmin();
  renderSidebar();
}

function eliminarPauta(i) {
  confirmar('¿Eliminar la pauta "' + PAUTAS[i] + '"?', function() {
    PAUTAS.splice(i, 1);
    saveDB();
    toast('Pauta eliminada.', 'info');
    renderAdmin();
    renderSidebar();
  });
}
