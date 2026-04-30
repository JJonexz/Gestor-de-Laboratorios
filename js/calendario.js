// ============================================================
// calendario.js — Vista del calendario semanal
//
// ¿Qué hay acá?
//   • renderSidebar()              → panel lateral (labs, stats, pautas)
//   • renderDayNav()               → barra de navegación por día
//   • renderCalendario()           → grilla principal de reservas
//   • renderEsperaCalendario()     → lista de espera en el sidebar
//   • renderVencimientosCalendario() → reservas próximas a vencer
//   • renderSolicitudesBadge()     → badge de notificación en Admin
//   • editarRecreo() / guardarRecreo() → edición de recreos
//   • navSemana() / irHoy()        → navegación de semana
//   • verDetalle_Pendiente()       → info al profe sobre solicitudes
//
// Depende de: config.js, helpers.js, ui.js
// ============================================================

// ── Sidebar ──────────────────────────────────────────────────
function renderSidebar() {
  // Lab cards
  var sl = document.getElementById('sidebar-labs');
  if (sl) {
    sl.innerHTML = LABS.map(function(l) {
      var sel     = filtroLab === l.id ? 'sel' : '';
      var statusCls = l.ocupado ? 'status-ocup' : 'status-libre';
      var dotCls    = l.ocupado ? 'dot-ocup'    : 'dot-libre';
      var statusTxt = l.ocupado ? 'En mantenimiento' : 'Disponible';
      return (
        '<div class="lab-card ' + sel + '" data-lab-id="' + l.id + '" ' +
        'onclick="setLabFilter(\'' + l.id + '\')" role="button" tabindex="0">' +
          '<div class="lab-card-name">' + l.nombre + '</div>' +
          '<div class="lab-card-status ' + statusCls + '">' +
            '<span class="dot ' + dotCls + '"></span>' + statusTxt +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  // Mini estadísticas
  var reservasSemana = RESERVAS.filter(function(r) { return r.semanaOffset === semanaOffset; });
  var totalEspera    = LISTA_ESPERA.filter(function(e) { return e.semanaOffset === semanaOffset; }).length;
  var ms = document.getElementById('mini-stats');
  if (ms) {
    var libres = LABS.filter(function(l) { return !l.ocupado; }).length
      * 5 * MODULOS_CLASE.length
      - reservasSemana.length;
    ms.innerHTML =
      '<div class="mini-stat az"><div class="mini-stat-n">' + reservasSemana.length + '</div><div class="mini-stat-l">Reservas</div></div>' +
      '<div class="mini-stat rj"><div class="mini-stat-n">' + totalEspera + '</div><div class="mini-stat-l">Espera</div></div>' +
      '<div class="mini-stat vd"><div class="mini-stat-n">' + Math.max(0, libres) + '</div><div class="mini-stat-l">Libres</div></div>';
  }

  // Pautas
  var pl = document.getElementById('pautas-list');
  if (pl) {
    pl.innerHTML = PAUTAS.map(function(p) {
      return '<div class="pauta-item"><span class="chk">✓</span>' + p + '</div>';
    }).join('');
  }

  // Botones de filtro rápido por lab
  var lfb = document.getElementById('lab-filter-btns');
  if (lfb) {
    lfb.innerHTML = LABS.map(function(l) {
      var active = filtroLab === l.id ? 'active' : '';
      return (
        '<button class="lab-filter-btn ' + active + '" data-lab-filter="' + l.id + '" ' +
        'onclick="setLabFilter(\'' + l.id + '\')">Lab. ' + l.id + '</button>'
      );
    }).join('');
  }
}

// ── Barra de navegación por día ──────────────────────────────
function renderDayNav() {
  var container = document.getElementById('day-nav-bar');
  if (!container) return;

  var html = '';
  for (var d = 0; d < 5; d++) {
    var fecha  = getDiaDate(semanaOffset, d);
    var hoy    = esHoy(semanaOffset, d);
    var activo = d === diaActual;
    html +=
      '<button class="day-nav-btn' + (activo ? ' active' : '') + (hoy ? ' hoy' : '') + '" ' +
      'onclick="irDia(' + d + ')">' +
        '<span class="day-nav-nombre">' + DIAS_SEMANA[d] + '</span>' +
        '<span class="day-nav-fecha">'  + formatFecha(fecha) + '</span>' +
        (hoy ? '<span class="day-nav-hoy-dot"></span>' : '') +
      '</button>';
  }
  container.innerHTML = html;
}

// ── Grilla principal del calendario ─────────────────────────
function renderCalendario() {
  renderSidebar();

  // Título de la semana
  var start    = getSemanaStart(semanaOffset);
  var end      = new Date(start); end.setDate(end.getDate() + 4);
  var titleEl  = document.getElementById('cal-title-text');
  if (titleEl) {
    var fechaDia = getDiaDate(semanaOffset, diaActual);
    titleEl.innerHTML =
      DIAS_LARGO[diaActual] + ' ' + formatFecha(fechaDia) +
      '&nbsp;<span style="color:var(--muted);font-weight:400;font-size:13px;">' + fechaDia.getFullYear() + '</span>' +
      '&nbsp;<span style="color:var(--muted);font-weight:400;font-size:12px;">· Sem. ' + formatFecha(start) + '–' + formatFecha(end) + '</span>';
  }

  renderDayNav();

  var reservasDia = RESERVAS.filter(function(r) {
    return r.semanaOffset === semanaOffset && r.dia === diaActual;
  });
  var solicDia = SOLICITUDES.filter(function(s) {
    return s.semanaOffset === semanaOffset && s.dia === diaActual && s.estado === 'pendiente';
  });

  var grid = document.getElementById('cal-body');
  if (!grid) return;

  var labsFiltrados = LABS.filter(function(l) {
    return filtroLab === 'todos' || filtroLab === l.id;
  });

  // Filtro de turno
  var turnosFiltrados = filtroTurno === 'todos'
    ? TURNOS_CONFIG
    : TURNOS_CONFIG.filter(function(tc) { return tc.label === filtroTurno; });

  // ── Construcción del HTML de la tabla ──────────────────────
  var html = '<div class="at-wrap"><table class="at-table" role="grid"><thead>';

  // Fila 1: nombres de turno con colspan
  html += '<tr><th class="at-corner" rowspan="2">Espacio</th>';
  turnosFiltrados.forEach(function(tc) {
    var cols = tc.modulos.filter(function(mid) {
      return MODULOS_CLASE.find(function(m) { return m.id === mid; });
    });
    if (!cols.length) return;
    html += '<th class="at-turno-span" colspan="' + cols.length + '">' +
      '<span class="at-turno-icon">' + tc.icon + '</span>' + tc.label + '</th>';
    var recreoMod = MODULOS.find(function(m) { return m.tipo === 'recreo' && m.turno === tc.label; });
    if (recreoMod) html += '<th class="at-recreo-col-header">☕</th>';
  });
  html += '</tr>';

  // Fila 2: hora de cada módulo
  html += '<tr>';
  turnosFiltrados.forEach(function(tc) {
    var cols = tc.modulos.filter(function(mid) {
      return MODULOS_CLASE.find(function(m) { return m.id === mid; });
    });
    if (!cols.length) return;
    cols.forEach(function(mid) {
      var mod = MODULOS_CLASE.find(function(m) { return m.id === mid; });
      var lbl = mod.label
        .replace('° Mañana',   '°M')
        .replace('° Tarde',    '°T')
        .replace('° Vespert.', '°V');
      html +=
        '<th class="at-hora-header">' +
          '<span class="at-hora-ini">' + mod.inicio + '</span>' +
          '<span class="at-hora-num">' + lbl + '</span>' +
        '</th>';
    });
    var recreoMod = MODULOS.find(function(m) { return m.tipo === 'recreo' && m.turno === tc.label; });
    if (recreoMod) {
      var recInfo = RECREOS.find(function(r) { return r.modulo === recreoMod.id; });
      html +=
        '<th class="at-recreo-col-header at-recreo-hora">' +
          '<span style="font-size:9px;display:block;">' + recreoMod.inicio + '</span>' +
          '<button class="at-recreo-edit" onclick="editarRecreo(' + recreoMod.id + ')" ' +
          'title="' + (recInfo ? recInfo.evento : 'Recreo') + '">✏️</button>' +
        '</th>';
    }
  });
  html += '</tr></thead><tbody>';

  // Filas de laboratorios
  labsFiltrados.forEach(function(lab, labIdx) {
    html += '<tr class="at-row' + (labIdx % 2 === 1 ? ' at-row-alt' : '') + '">';
    html +=
      '<td class="at-lab-cell">' +
        '<div class="at-lab-name">' + lab.nombre + '</div>' +
        '<div class="at-lab-status ' + (lab.ocupado ? 'at-status-ocup' : 'at-status-libre') + '">' +
          (lab.ocupado ? 'Mantenimiento' : 'Disponible') +
        '</div>' +
      '</td>';

    turnosFiltrados.forEach(function(tc) {
      var cols = tc.modulos.filter(function(mid) {
        return MODULOS_CLASE.find(function(m) { return m.id === mid; });
      });
      if (!cols.length) return;

      cols.forEach(function(mid) {
        var r = reservasDia.find(function(x) { return x.modulo === mid && x.lab === lab.id; });
        var s = solicDia.find(function(x)    { return x.modulo === mid && x.lab === lab.id; });
        html += '<td class="at-event-cell">';

        if (r) {
          var oriOk = filtroOrient === 'all' || r.orient === filtroOrient;
          if (!oriOk) {
            // Filtro activo pero esta reserva no coincide → mostrar como libre
            html += _celdaLibre(diaActual, mid, lab.id);
          } else {
            var ori = ORIENTACIONES[r.orient];
            var p   = getProfe(r.profeId);
            html +=
              '<div class="at-event ' + ori.ev + '" role="button" tabindex="0" ' +
              'onclick="verDetalle(' + r.id + ')" title="' + r.curso + ' — Prof. ' + p.apellido + '">' +
                '<div class="at-ev-curso">' + r.curso + ' ' + ori.emoji + '</div>' +
                '<div class="at-ev-prof">'  + p.apellido + '</div>' +
              '</div>';
          }
        } else if (s) {
          var action = modoUsuario === 'admin'
            ? 'verDetalleSolicitud(' + s.id + ')'
            : 'verDetalle_Pendiente(' + s.id + ')';
          html +=
            '<div class="at-event ev-pendiente" role="button" tabindex="0" ' +
            'onclick="' + action + '" title="Pendiente: ' + s.curso + '">' +
              '<div class="at-ev-curso">' + s.curso + ' ⏳</div>' +
            '</div>';
        } else {
          html += _celdaLibre(diaActual, mid, lab.id);
        }

        html += '</td>';
      });

      // Celda de recreo
      var recreoMod = MODULOS.find(function(m) { return m.tipo === 'recreo' && m.turno === tc.label; });
      if (recreoMod) {
        var recInfo = RECREOS.find(function(r) { return r.modulo === recreoMod.id; });
        html += '<td class="at-recreo-cell" title="' + (recInfo ? recInfo.evento : 'Recreo') + '"></td>';
      }
    });

    html += '</tr>';
  });

  html += '</tbody></table></div>';
  grid.innerHTML = html;

  renderEsperaCalendario();
  renderVencimientosCalendario();
  renderSolicitudesBadge();
}

// Genera el HTML de una celda libre (helper interno)
function _celdaLibre(dia, modulo, labId) {
  return (
    '<div class="at-event at-libre" role="button" tabindex="0" ' +
    'onclick="abrirModalReservaSlot(' + dia + ',' + modulo + ',\'' + labId + '\')" ' +
    'title="Disponible — clic para reservar">' +
      '<span class="at-ev-plus">+</span>' +
    '</div>'
  );
}

// ── Edición de recreos ────────────────────────────────────────
function editarRecreo(moduloId) {
  var rec = RECREOS.find(function(r) { return r.modulo === moduloId; });
  var mod = getModulo(moduloId);
  document.getElementById('modal-recreo-title').textContent = mod.icon + ' ' + mod.label + ' (' + mod.inicio + '–' + mod.fin + ')';
  document.getElementById('recreo-evento').value    = rec ? rec.evento : 'Recreo';
  document.getElementById('recreo-notas').value     = rec ? rec.notas  : '';
  document.getElementById('recreo-modulo-id').value = moduloId;
  abrirModal('modal-recreo');
}

function guardarRecreo() {
  var moduloId = parseInt(document.getElementById('recreo-modulo-id').value);
  var evento   = document.getElementById('recreo-evento').value.trim();
  var notas    = document.getElementById('recreo-notas').value.trim();
  if (!evento) { toast('Ingresá un nombre para el evento.', 'err'); return; }

  var idx = RECREOS.findIndex(function(r) { return r.modulo === moduloId; });
  if (idx >= 0) {
    RECREOS[idx].evento = evento;
    RECREOS[idx].notas  = notas;
  } else {
    RECREOS.push({ modulo: moduloId, evento: evento, notas: notas });
  }

  saveDB();
  cerrarModal('modal-recreo');
  toast('Recreo actualizado.', 'ok');
  renderCalendario();
}

// ── Info al profe sobre solicitudes pendientes ────────────────
function verDetalle_Pendiente(solId) {
  toast('Esa solicitud está pendiente de aprobación del directivo.', 'info');
}

// ── Badge de notificaciones en el botón Admin ─────────────────
function renderSolicitudesBadge() {
  var pendientes = SOLICITUDES.filter(function(s) { return s.estado === 'pendiente'; }).length;
  var badge = document.getElementById('admin-badge');
  if (badge) {
    badge.textContent   = pendientes || '';
    badge.style.display = pendientes ? 'flex' : 'none';
  }
}

// ── Lista de espera en el sidebar ─────────────────────────────
function renderEsperaCalendario() {
  var el = document.getElementById('espera-lista');
  if (!el) return;

  var espera = LISTA_ESPERA.filter(function(e) { return e.semanaOffset === semanaOffset; });
  if (!espera.length) {
    el.innerHTML = '<div class="empty-state">No hay docentes en lista de espera esta semana.</div>';
    return;
  }

  var bgColors = ['var(--navy)', 'var(--red)', 'var(--green)', 'var(--amber)'];
  var esDir    = esDirectivo();

  el.innerHTML = espera.map(function(e, i) {
    var p     = getProfe(e.profeId);
    var fecha = getDiaDate(e.semanaOffset, e.dia);
    var mod   = getModulo(e.modulo);
    // Botones de acción solo para directivos
    var acciones = esDir
      ? '<button class="espera-btn" onclick="promoverEspera(' + e.id + ')">✓ Asignar</button>' +
        '<button class="espera-btn cancel" onclick="quitarEspera(' + e.id + ')">✕</button>'
      : '';
    return (
      '<div class="espera-item">' +
        '<div class="espera-badge" style="background:' + bgColors[i % 4] + '">' + (i + 1) + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div class="item-name">Prof. ' + p.apellido + '</div>' +
          '<div class="item-sub">' + DIAS_SEMANA[e.dia] + ' ' + formatFecha(fecha) + ' · ' + mod.label + ' · Lab.' + e.lab + '</div>' +
        '</div>' +
        '<div class="espera-actions">' + acciones + '</div>' +
      '</div>'
    );
  }).join('');
}

// ── Reservas próximas a vencer (sidebar) ─────────────────────
function renderVencimientosCalendario() {
  var el = document.getElementById('venc-lista');
  if (!el) return;

  var hoyRes = RESERVAS.filter(function(r) { return r.semanaOffset === semanaOffset; });
  if (!hoyRes.length) {
    el.innerHTML = '<div class="empty-state">No hay reservas esta semana.</div>';
    return;
  }

  var sorted  = [].concat(hoyRes).sort(function(a, b) { return b.cicloClases - a.cicloClases; });
  var colores = { 3: 'var(--red)', 2: 'var(--amber)', 1: 'var(--green)' };

  el.innerHTML = sorted.slice(0, 6).map(function(r) {
    var p   = getProfe(r.profeId);
    var ori = ORIENTACIONES[r.orient];
    return (
      '<div class="list-item">' +
        '<div class="venc-dot" style="background:' + (colores[r.cicloClases] || 'var(--green)') + '"></div>' +
        '<div style="flex:1;">' +
          '<div class="item-name">' + r.curso + ' ' + ori.emoji + ' ' + ori.nombre + '</div>' +
          '<div class="item-sub">Clase ' + r.cicloClases + '/3 · Lab.' + r.lab + ' · Prof. ' + p.apellido + '</div>' +
        '</div>' +
        (r.cicloClases >= 3
          ? '<button class="espera-btn" onclick="renovarReserva(' + r.id + ')">↻ Renovar</button>'
          : '') +
      '</div>'
    );
  }).join('');
}

// ── Navegación de semana ─────────────────────────────────────
function navSemana(dir) {
  semanaOffset += dir;
  renderCalendario();
}

function irHoy() {
  semanaOffset = 0;
  var dow = new Date().getDay();
  diaActual = dow === 0 ? 4 : (dow === 6 ? 0 : dow - 1);
  diaActual = Math.max(0, Math.min(4, diaActual));
  renderCalendario();
}
