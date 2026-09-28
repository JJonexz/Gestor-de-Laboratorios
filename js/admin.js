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
  // Los contadores salen de api.php/stats (COUNT/GROUP BY en SQL).
  // Antes se calculaban recorriendo RESERVAS entera en el cliente.
  pintarStatsAdmin();
  if (typeof apiGet === 'function') {
    apiGet('stats').then(function(st) {
      ADMIN_STATS = st;
      pintarStatsAdmin();
      renderProfesores();   // la columna "Reservas" depende de st.porProfe
    }).catch(function(e) {
      console.warn('[Admin] No se pudieron cargar los contadores:', e.message);
    });
  }

  poblarFiltroLabsAdmin();
  renderSyncHorarios();
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
// Escribe los contadores del encabezado con lo que haya en ADMIN_STATS.
function pintarStatsAdmin() {
  var st = ADMIN_STATS || {};
  var pendientes = (st.pendientes !== undefined)
    ? st.pendientes
    : SOLICITUDES.filter(function(s) { return s.estado === 'pendiente'; }).length;
  var valores = [
    st.reservas !== undefined ? st.reservas : '…',
    pendientes,
    st.docentes !== undefined ? st.docentes : '…',
    st.labs     !== undefined ? st.labs     : LABS.length
  ];
  ['s-semana', 's-pendientes', 's-docs', 's-labs'].forEach(function(id, i) {
    var el = document.getElementById(id);
    if (el) el.textContent = valores[i];
  });
}

// ── Sincronizacion gestor -> `horarios` ────────────────────
// `horarios` es el horario oficial de la escuela: una unica grilla semanal.
// El servidor la actualiza solo despues de cada cambio en las reservas de la
// semana en curso, y una vez al empezar cada semana. Desde aca se puede ver
// si quedo alguna diferencia y forzarla a mano.
var ORIGEN_SYNC = { auto: 'automática semanal', manual: 'manual', cambio: 'tras un cambio en el gestor' };

function renderSyncHorarios() {
  var el = document.getElementById('sync-horarios-info');
  if (!el) return;
  apiGet('sync-horarios').then(function(st) {
    var u = st.ultima;
    el.innerHTML = u
      ? 'Semana <strong>' + st.semana + '</strong> (lunes ' + u.lunes + '): última sincronización el ' +
        u.ejecutado_en + ' (' + (ORIGEN_SYNC[u.origen] || u.origen) + ').<br>' +
        // Los contadores son el acumulado de la semana, no de la última corrida.
        '<span style="color:var(--muted);">Acumulado de la semana: ' + u.insertados + ' clase(s) agregada(s) · ' +
        u.actualizados + ' cambio(s) de aula · ' + u.eliminados + ' quitada(s).</span>'
      : 'Semana <strong>' + st.semana + '</strong> (lunes ' + st.lunes + '): <strong>aún no sincronizada</strong>. ' +
        'Se ejecuta sola la primera vez que se abre la app en la semana.';
  }).catch(function(e) {
    el.textContent = 'No se pudo leer el estado de sincronización: ' + e.message;
  });
}

// Muestra que cambiaria, sin escribir nada.
function previsualizarSyncHorarios() {
  var el = document.getElementById('sync-horarios-info');
  if (el) el.textContent = 'Calculando diferencias\u2026';
  apiPost('sync-horarios', { dryRun: true }).then(function(d) {
    var total = d.insertados + d.actualizados + d.eliminados;
    if (el) {
      el.innerHTML = total === 0
        ? '✅ <strong>Sin diferencias</strong>: el horario oficial ya coincide con el gestor (' +
          d.en_gestor + ' clases).'
        : '<strong>' + total + ' cambio(s) pendiente(s)</strong> para la semana ' + d.semana + ':<br>' +
          '<span style="color:var(--muted);">' + d.insertados + ' a agregar · ' +
          d.actualizados + ' con cambio de aula · ' + d.eliminados + ' a quitar. ' +
          'Gestor: ' + d.en_gestor + ' clases · horario oficial: ' + d.en_horarios + '.</span>';
    }
  }).catch(function(e) {
    if (el) el.textContent = 'Error al previsualizar: ' + e.message;
    toast('Error al previsualizar: ' + e.message, 'err');
  });
}

// Aplica los cambios aunque la semana ya se haya sincronizado.
function sincronizarHorariosAhora() {
  apiPost('sync-horarios', { dryRun: true }).then(function(d) {
    var total = d.insertados + d.actualizados + d.eliminados;
    if (total === 0) {
      toast('El horario oficial ya está al día.', 'info');
      renderSyncHorarios();
      return;
    }
    confirmar(
      'Se van a aplicar <strong>' + total + '</strong> cambio(s) al horario oficial:<br>' +
      d.insertados + ' clase(s) a agregar, ' + d.actualizados + ' cambio(s) de aula y ' +
      d.eliminados + ' a quitar.<br><small>Afecta la tabla <code>horarios</code> del sistema escolar.</small>',
      function() {
        apiPost('sync-horarios', { forzar: true, origen: 'manual' }).then(function(r) {
          toast('Horario oficial actualizado: ' + r.insertados + ' agregadas, ' +
                r.actualizados + ' con cambio de aula, ' + r.eliminados + ' quitadas.', 'ok');
          renderSyncHorarios();
        }).catch(function(e) { toast('Error al sincronizar: ' + e.message, 'err'); });
      }
    );
  }).catch(function(e) { toast('Error al previsualizar: ' + e.message, 'err'); });
}

// Llena el filtro de laboratorio de la tabla de reservas (una sola vez).
function poblarFiltroLabsAdmin() {
  var sel = document.getElementById('admin-filter-lab');
  if (!sel || sel.dataset.poblado === '1' || !LABS.length) return;
  sel.innerHTML = '<option value="todos">Todos los laboratorios</option>' +
    LABS.map(function(l) {
      return '<option value="' + l.id + '">' + l.nombre + '</option>';
    }).join('');
  sel.dataset.poblado = '1';
}

function renderSolicitudesAdmin() {
  var el = document.getElementById('solicitudes-tbody');
  if (!el) return;

  var solic = SOLICITUDES.filter(function(s) { return s.estado === 'pendiente'; });
  var count = document.getElementById('solicitudes-count');

  if (!solic.length) {
    if (count) count.textContent = '';
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">No hay solicitudes pendientes.</td></tr>';
    return;
  }

  // Agrupar solicitudes
  var groups = [];
  solic.sort(function(a, b) {
    return a.modulo - b.modulo; // Asegurar orden para consecutivos
  });

  // Indice por clave: groups.find() dentro del forEach era O(n^2).
  var porClave = {};
  solic.forEach(function(s) {
    var key = [s.semanaOffset, s.dia, s.lab, s.curso, s.orient, s.profeId, s.secuencia, s.esRenovacion].join('|');
    var group = porClave[key];

    if (group) {
      group.solicitudes.push(s);
      group.modulos.push(s.modulo);
    } else {
      group = {
        key: key,
        solicitudes: [s],
        modulos: [s.modulo],
        s: s // reference to first one for rendering
      };
      porClave[key] = group;
      groups.push(group);
    }
  });

  if (count) count.textContent = groups.length ? '(' + groups.length + ')' : '';

  el.innerHTML = groups.map(function(g) {
    var s = g.s;
    var p     = getProfe(s.profeId);
    var ori   = ORIENTACIONES[s.orient];
    var fecha = getDiaDate(s.semanaOffset, s.dia);
    
    // Mostrar modulos combinados
    var modString = g.modulos.map(function(m) { return getModulo(m).label; }).join(', ');
    var modInicio = getModulo(Math.min.apply(null, g.modulos)).inicio;
    var modFin = getModulo(Math.max.apply(null, g.modulos)).fin;

    var renovBadge = s.esRenovacion
      ? '&nbsp;<span style="font-size:9px;font-weight:700;background:var(--navy);color:#fff;padding:1px 4px;border-radius:3px;">RENOV ' + s.renovacionNum + '/1</span>'
      : '';
    var rowStyle = s.esRenovacion ? ' style="background:#eff6ff"' : '';
    
    var jsonIds = JSON.stringify(g.solicitudes.map(function(x) { return x.id; }));

    return (
      '<tr' + rowStyle + '>' +
        '<td>Prof. ' + p.apellido + '</td>' +
        '<td>Lab.' + s.lab + renovBadge + '</td>' +
        '<td>' + DIAS_SEMANA[s.dia] + ' ' + formatFecha(fecha) + '</td>' +
        '<td><div title="' + modString + '">' + g.modulos.length + ' mod(s) (' + modInicio + '–' + modFin + ')</div></td>' +
        '<td>' + s.curso + '</td>' +
        '<td><span class="orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></td>' +
        '<td>' +
          '<div class="table-actions">' +
            '<button class="tbl-btn ok" onclick=\'aceptarSolicitudGrupo(' + jsonIds + ')\'>✓ Aprobar</button>' +
            '<button class="tbl-btn danger" onclick=\'rechazarSolicitudGrupo(' + jsonIds + ')\'>✕ Rechazar</button>' +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');
}

// ── Tabla de docentes con búsqueda ────────────────────────────
function renderProfesores() {
  var qEl   = document.getElementById('search-prof');
  var q     = qEl ? qEl.value.toLowerCase() : '';
  var tbody = document.getElementById('prof-tbody');
  if (!tbody) return;

  var filtered = PROFESORES.filter(function(p) {
    return (p.apellido + ' ' + p.nombre + ' ' + p.materia).toLowerCase().indexOf(q) >= 0;
  });

  // Paginación
  var totalPags = Math.max(1, Math.ceil(filtered.length / PROFS_PER_PAGE));
  if (pagActualProfesores > totalPags) pagActualProfesores = totalPags;
  if (pagActualProfesores < 1) pagActualProfesores = 1;

  var inicio = (pagActualProfesores - 1) * PROFS_PER_PAGE;
  var fin    = inicio + PROFS_PER_PAGE;
  var slice  = filtered.slice(inicio, fin);

  // El conteo de reservas por docente viene de api.php/stats (GROUP BY).
  // Antes era un RESERVAS.filter por fila visible, en cada tecla del buscador.
  var porProfe = (ADMIN_STATS && ADMIN_STATS.porProfe) || null;

  tbody.innerHTML = slice.map(function(p) {
    var ori      = ORIENTACIONES[p.orientacion] || ORIENTACIONES.bas;
    var reservas = porProfe ? (porProfe[String(p.id)] || 0) : '–';
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

  // Actualizar info de paginación
  var info = document.getElementById('prof-pag-info');
  if (info) info.textContent = 'Página ' + pagActualProfesores + ' de ' + totalPags + ' (' + filtered.length + ' total)';
}

function cambiarPaginaProfesores(dir) {
  var qEl = document.getElementById('search-prof');
  var q   = qEl ? qEl.value.toLowerCase() : '';

  var filtered   = PROFESORES.filter(function(p) {
    return (p.apellido + ' ' + p.nombre + ' ' + p.materia).toLowerCase().indexOf(q) >= 0;
  });
  var totalPags  = Math.max(1, Math.ceil(filtered.length / PROFS_PER_PAGE));
  pagActualProfesores += dir;
  if (pagActualProfesores < 1) pagActualProfesores = 1;
  if (pagActualProfesores > totalPags) pagActualProfesores = totalPags;
  renderProfesores();
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
          '<div class="lab-config-sub">' + l.capacidad + ' equipos · ' +
          'Grupos: ' + getLabMaxGrupos(l.id) + ' · ' +
          (l.notas || 'Sin notas') + '</div>' +
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
  var tbody = document.getElementById('admin-reservas-tbody');
  if (!tbody) return;

  var filterEl = document.getElementById('admin-filter-orient');
  var filterO  = filterEl ? filterEl.value : 'all';
  var labEl    = document.getElementById('admin-filter-lab');
  var filterL  = labEl ? labEl.value : 'todos';

  if (pagActualReservas < 1) pagActualReservas = 1;
  var offset = (pagActualReservas - 1) * RESERVAS_PER_PAGE;

  var qs = 'reservas?limit=' + RESERVAS_PER_PAGE + '&offset=' + offset;
  if (filterO && filterO !== 'all')   qs += '&orient=' + encodeURIComponent(filterO);
  if (filterL && filterL !== 'todos') qs += '&lab=' + encodeURIComponent(filterL);

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">Cargando\u2026</td></tr>';

  apiGet(qs).then(function(res) {
    var filas = (res && res.rows) || [];
    var total = (res && res.total) || 0;

    // Las acciones (ver detalle, cancelar) buscan por id en RESERVAS.
    // Mergeamos la pagina visible para que sigan funcionando aunque
    // esas semanas esten fuera de la ventana cargada.
    var vistos = {};
    RESERVAS.forEach(function(r) { vistos[r.id] = true; });
    var agregadas = 0;
    filas.forEach(function(r) { if (!vistos[r.id]) { RESERVAS.push(r); agregadas++; } });
    if (agregadas && typeof invalidarIndices === 'function') invalidarIndices();

    pintarPaginacionReservas(total);

    if (!filas.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">No hay reservas.</td></tr>';
      return;
    }

    tbody.innerHTML = filas.map(filaReservaAdmin).join('');
  }).catch(function(e) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--red);padding:20px;">Error al cargar las reservas: ' + e.message + '</td></tr>';
  });
}

function filaReservaAdmin(r) {
  var p     = getProfe(r.profeId);
  var ori   = ORIENTACIONES[r.orient] || ORIENTACIONES.bas;
  var fecha = getDiaDate(r.semanaOffset, r.dia);
  var mod   = getModulo(r.modulo);
  var ciclo = r.cicloClases || 1;
  var pct   = Math.min(100, (ciclo / MAX_SEMANAS_SEGUIDAS) * 100);
  var anual = Number(r.anual) === 1;
  // Las series anuales creadas desde el gestor van sin docente ('institucional'),
  // pero las importadas del horario escolar s\u00ed tienen docente real.
  var esInstitucional = String(r.profeId) === 'institucional' || !r.profeId;

  return (
    '<tr>' +
      '<td>' +
        (esInstitucional ? '<span title="Reserva institucional">\ud83d\udcc6 Institucional</span>' : 'Prof. ' + p.apellido) +
        (anual ? ' <span class="orient-badge" style="font-size:9px;" title="Serie de todo el a\u00f1o lectivo">ANUAL</span>' : '') +
      '</td>' +
      '<td>' + getLab(r.lab).nombre + '</td>' +
      '<td>' + DIAS_SEMANA[r.dia] + ' ' + formatFecha(fecha) + '</td>' +
      '<td>' + mod.label + '</td>' +
      '<td>' + r.curso + '</td>' +
      '<td><span class="orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></td>' +
      '<td>' +
        (anual
          ? '<span style="font-size:11px;color:var(--muted);">Anual</span>'
          : '<div style="display:flex;align-items:center;gap:6px;">' +
              '<div style="width:40px;background:var(--border);border-radius:20px;height:5px;overflow:hidden;">' +
                '<div style="width:' + pct + '%;height:100%;background:var(--navy);border-radius:20px;"></div>' +
              '</div>' +
              '<span style="font-size:11px;color:var(--muted);">' + ciclo + '/' + MAX_SEMANAS_SEGUIDAS + '</span>' +
            '</div>') +
      '</td>' +
      '<td>' +
        '<div class="table-actions">' +
          '<button class="tbl-btn" onclick="verDetalle(' + r.id + ')">\ud83d\udc41 Ver</button>' +
          '<button class="tbl-btn danger" onclick="cancelarReserva(' + r.id + ')">\ud83d\uddd1</button>' +
        '</div>' +
      '</td>' +
    '</tr>'
  );
}

function pintarPaginacionReservas(total) {
  var info = document.getElementById('admin-reservas-pag-info');
  if (!info) return;
  var totalPags = Math.max(1, Math.ceil(total / RESERVAS_PER_PAGE));
  if (pagActualReservas > totalPags) pagActualReservas = totalPags;
  info.textContent = 'Pagina ' + pagActualReservas + ' de ' + totalPags + ' (' + total + ' reservas)';
  info.dataset.totalPags = String(totalPags);
}

function cambiarPaginaReservas(dir) {
  var info = document.getElementById('admin-reservas-pag-info');
  var totalPags = info && info.dataset.totalPags ? parseInt(info.dataset.totalPags, 10) : 1;
  var nueva = pagActualReservas + dir;
  if (nueva < 1 || nueva > totalPags) return;
  pagActualReservas = nueva;
  renderAdminReservas();
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
  UIHelper.setOrientValues('doc-orient-group', 'info');
  abrirModal('modal-docente');
}

function editarDocente(id) {
  var p = getProfe(id);
  editDocenteId = id;
  document.getElementById('modal-docente-title').textContent = '✏️ Editar docente';
  document.getElementById('doc-apellido').value = p.apellido;
  document.getElementById('doc-nombre').value   = p.nombre;
  document.getElementById('doc-materia').value  = p.materia;
  UIHelper.setOrientValues('doc-orient-group', p.orientacion);
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
  var labMg = document.getElementById('lab-max-grupos'); if (labMg) labMg.value = 1;
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
  var labMg = document.getElementById('lab-max-grupos');
  if (labMg) labMg.value = getLabMaxGrupos(editLabId);
  abrirModal('modal-lab');
}

function guardarLab() {
  var nombre     = document.getElementById('lab-nombre').value.trim();
  var capacidad  = parseInt(document.getElementById('lab-capacidad').value) || 0;
  var estado     = document.getElementById('lab-estado').value;
  var notas      = document.getElementById('lab-notas').value.trim();
  var maxGrupos  = parseInt(document.getElementById('lab-max-grupos').value) || 1;
  if (maxGrupos < 1) maxGrupos = 1;

  if (!nombre) { toast('Ingresá un nombre para el espacio.', 'err'); return; }

  if (editLabId) {
    var l = LABS.find(function(x) { return x.id === editLabId; });
    setLabMaxGrupos(id, maxGrupos); // persiste en LABS_CONFIG / localStorage
    toast('Espacio actualizado.', 'ok');
  } else {
    var newId = String.fromCharCode(65 + LABS.length);
    LABS.push({ id: newId, nombre: nombre, capacidad: capacidad, ocupado: estado === 'ocupado', notas: notas, max_grupos: maxGrupos });
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
