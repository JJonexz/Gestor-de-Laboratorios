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
// Mapeo id_horas (BD) -> id modulo del gestor (sin recreos)
var ID_HORAS_A_MODULO = { 1: 0, 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 9, 9: 10, 10: 11, 11: 12, 12: 14, 13: 15 };
var DIA_STR_A_NUM = { 'LUN': 0, 'MAR': 1, 'MIE': 2, 'JUE': 3, 'VIE': 4 };

// Retorna horarios fijos (de cupof) para un slot dia+modulo
function getHorariosFijosSlot(diaNum, moduloId) {
  if (typeof HORARIOS_FIJOS === 'undefined' || !HORARIOS_FIJOS.length) return [];
  return HORARIOS_FIJOS.filter(function (h) {
    return DIA_STR_A_NUM[h.dia] === diaNum &&
      ID_HORAS_A_MODULO[parseInt(h.id_horas)] === moduloId;
  });
}

function renderSidebar() {
  // Lab cards
  var sl = document.getElementById('sidebar-labs');
  if (sl) {
    sl.innerHTML = LABS.map(function (l) {
      var sel = filtroLab === l.id ? 'sel' : '';
      var statusCls = l.ocupado ? 'status-ocup' : 'status-libre';
      var dotCls = l.ocupado ? 'dot-ocup' : 'dot-libre';
      var statusTxt = l.ocupado ? 'En mantenimiento' : 'Disponible';
      return (
        (function () {
          var tieneIncid = (typeof labTieneIncidenciaActiva === 'function') && labTieneIncidenciaActiva(l.id);
          var incidCls = tieneIncid ? ' incidencia-activa' : '';
          return (
            '<div class="lab-card ' + sel + incidCls + '" data-lab-id="' + l.id + '" ' +
            'onclick="setLabFilter(\'' + l.id + '\')" role="button" tabindex="0">' +
            '<div class="lab-card-name">' + l.nombre + '</div>' +
            '<div class="lab-card-status ' + statusCls + '">' +
            '<span class="dot ' + dotCls + '"></span>' + statusTxt +
            '</div>' +
            (tieneIncid ? '<div class="lab-incid-badge">⚠️ Incidencia activa</div>' : '') +
            '<div style="margin-top:6px">' +
            '<button class="tbl-btn" style="font-size:.7rem;padding:2px 7px" ' +
            'onclick="event.stopPropagation();abrirModalIncidencia(\'' + l.id + '\')">' +
            '+ Reportar problema' +
            '</button>' +
            '</div>' +
            '</div>'
          );
        })()
      );
    }).join('');
  }

  // Mini estadísticas
  var reservasSemana = RESERVAS.filter(function (r) { return r.semanaOffset === semanaOffset; });
  var totalEspera = LISTA_ESPERA.filter(function (e) { return e.semanaOffset === semanaOffset; }).length;
  var ms = document.getElementById('mini-stats');
  if (ms) {
    var libres = LABS.filter(function (l) { return !l.ocupado; }).length
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
    pl.innerHTML = PAUTAS.map(function (p) {
      return '<div class="pauta-item"><span class="chk">✓</span>' + p + '</div>';
    }).join('');
  }

  // Botones de filtro rápido por lab
  var lfb = document.getElementById('lab-filter-btns');
  if (lfb) {
    lfb.innerHTML = LABS.map(function (l) {
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
    var fecha = getDiaDate(semanaOffset, d);
    var hoy = esHoy(semanaOffset, d);
    var activo = d === diaActual;
    html +=
      '<button class="day-nav-btn' + (activo ? ' active' : '') + (hoy ? ' hoy' : '') + '" ' +
      'onclick="irDia(' + d + ')">' +
      '<span class="day-nav-nombre">' + DIAS_SEMANA[d] + '</span>' +
      '<span class="day-nav-fecha">' + formatFecha(fecha) + '</span>' +
      (hoy ? '<span class="day-nav-hoy-dot"></span>' : '') +
      '</button>';
  }
  container.innerHTML = html;
}

// ── Grilla principal del calendario ─────────────────────────
function renderCalendario() {
  renderSidebar();

  // Título de la semana
  var start = getSemanaStart(semanaOffset);
  var end = new Date(start); end.setDate(end.getDate() + 4);
  var titleEl = document.getElementById('cal-title-text');
  if (titleEl) {
    var fechaDia = getDiaDate(semanaOffset, diaActual);
    titleEl.innerHTML =
      DIAS_LARGO[diaActual] + ' ' + formatFecha(fechaDia) +
      '&nbsp;<span style="color:var(--muted);font-weight:400;font-size:13px;">' + fechaDia.getFullYear() + '</span>' +
      '&nbsp;<span style="color:var(--muted);font-weight:400;font-size:12px;">· Sem. ' + formatFecha(start) + '–' + formatFecha(end) + '</span>';
  }

  renderDayNav();

  var reservasDia = RESERVAS.filter(function (r) {
    return r.semanaOffset === semanaOffset && r.dia === diaActual;
  });
  var solicDia = SOLICITUDES.filter(function (s) {
    return s.semanaOffset === semanaOffset && s.dia === diaActual && s.estado === 'pendiente';
  });

  var grid = document.getElementById('cal-body');
  if (!grid) return;

  // Verificar si el día actual está bloqueado por el calendario escolar
  var eventoDelDia = (typeof getEventoEnDia === 'function') ? getEventoEnDia(semanaOffset, diaActual) : null;
  var diaEstaHabilitado = (typeof esDiaHabilitado === 'function') ? esDiaHabilitado(semanaOffset, diaActual) : true;

  // Mostrar banner de día bloqueado si aplica
  var bannerEl = document.getElementById('cal-dia-banner');
  if (!bannerEl) {
    bannerEl = document.createElement('div');
    bannerEl.id = 'cal-dia-banner';
    grid.parentNode.insertBefore(bannerEl, grid);
  }
  if (eventoDelDia && !diaEstaHabilitado) {
    var evCfg = (typeof TIPOS_EVENTO !== 'undefined' && TIPOS_EVENTO[eventoDelDia.tipo]) || {};
    bannerEl.innerHTML =
      '<div style="background:' + (evCfg.color || '#e63946') + '20;border:1px solid ' + (evCfg.color || '#e63946') + ';border-radius:8px;padding:8px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">' +
      '<span style="font-size:1.1rem">🚫</span>' +
      '<div><strong style="color:' + (evCfg.color || '#e63946') + '">' + (evCfg.label || 'Día bloqueado') + '</strong>' +
      ' — ' + eventoDelDia.titulo + '</div>' +
      '</div>';
  } else if (eventoDelDia) {
    var evCfg2 = (typeof TIPOS_EVENTO !== 'undefined' && TIPOS_EVENTO[eventoDelDia.tipo]) || {};
    bannerEl.innerHTML =
      '<div style="background:#0891b220;border:1px solid #0891b2;border-radius:8px;padding:8px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">' +
      '<span>📌</span><strong>' + eventoDelDia.titulo + '</strong>' +
      '</div>';
  } else {
    bannerEl.innerHTML = '';
  }

  var labsFiltrados = LABS.filter(function (l) {
    var matchLab = filtroLab === 'todos' || filtroLab === l.id;
    var matchSearch = filtroBusquedaLab === '' || l.nombre.toLowerCase().indexOf(filtroBusquedaLab) !== -1 || l.id.toString().toLowerCase().indexOf(filtroBusquedaLab) !== -1;
    return matchLab && matchSearch;
  }).sort(function(a, b) {
    // Ordenar por ID (alfanumérico)
    return String(a.id).localeCompare(String(b.id));
  });

  // Filtro de turno
  var turnosFiltrados = filtroTurno === 'todos'
    ? TURNOS_CONFIG
    : TURNOS_CONFIG.filter(function (tc) { return tc.label === filtroTurno; });

  // ── Construcción del HTML de la tabla ──────────────────────
  // Armamos la secuencia de columnas en orden cronológico:
  // para cada turno intercalamos módulos de clase y el recreo en su lugar correcto.
  var columnas = []; // { tipo:'clase'|'recreo', mod, turno }
  turnosFiltrados.forEach(function (tc) {
    // Todos los módulos del turno (clase + recreo) ordenados por id
    var todosLosModulos = tc.modulos.map(function (mid) {
      return MODULOS.find(function (m) { return m.id === mid; });
    }).filter(Boolean).sort(function (a, b) { return a.id - b.id; });

    todosLosModulos.forEach(function (mod) {
      columnas.push({ tipo: mod.tipo, mod: mod, turno: tc.label, icon: tc.icon });
    });
  });

  var html = '<div class="at-wrap"><table class="at-table" role="grid"><thead>';

  // Fila 1: spans de turno con colspan correcto (contando solo clases)
  html += '<tr><th class="at-corner" rowspan="2">Espacio</th>';
  turnosFiltrados.forEach(function (tc) {
    var claseCount = columnas.filter(function (c) { return c.turno === tc.label; }).length;
    if (!claseCount) return;
    html += '<th class="at-turno-span" colspan="' + claseCount + '">' +
      '<span class="at-turno-icon">' + tc.icon + '</span>' + tc.label + '</th>';
  });
  html += '</tr>';

  // Fila 2: hora de cada columna (clase o recreo intercalados)
  html += '<tr>';
  columnas.forEach(function (col) {
    if (col.tipo === 'recreo') {
      var recInfo = RECREOS.find(function (r) { return r.modulo === col.mod.id; });
      html +=
        '<th class="at-recreo-col-header at-recreo-hora" title="' + (recInfo ? recInfo.evento : 'Recreo') + '">' +
        '<span style="font-size:9px;display:block;line-height:1.3;">' + col.mod.inicio + '</span>' +
        '<button class="at-recreo-edit" onclick="editarRecreo(' + col.mod.id + ')" title="Editar recreo">✏️</button>' +
        '</th>';
    } else {
      var lbl = col.mod.label
        .replace('° Mañana', '°M')
        .replace('° Tarde', '°T')
        .replace('° Vespert.', '°V');
      html +=
        '<th class="at-hora-header">' +
        '<span class="at-hora-ini">' + col.mod.inicio + '–' + col.mod.fin + '</span>' +
        '<span class="at-hora-num">' + lbl + '</span>' +
        '</th>';
    }
  });
  html += '</tr></thead><tbody>';

  // Filas de laboratorios
  labsFiltrados.forEach(function (lab, labIdx) {
    html += '<tr class="at-row' + (labIdx % 2 === 1 ? ' at-row-alt' : '') + '">';
    html +=
      '<td class="at-lab-cell">' +
      '<div class="at-lab-name">' + lab.nombre + '</div>' +
      '<div class="at-lab-status ' + (lab.ocupado ? 'at-status-ocup' : 'at-status-libre') + '">' +
      (lab.ocupado ? 'Mantenimiento' : 'Disponible') +
      '</div>' +
      '</td>';

    columnas.forEach(function (col) {
      var mid = col.mod.id;

      if (col.tipo === 'recreo') {
        var recInfo = RECREOS.find(function (r) { return r.modulo === mid; });
        html += '<td class="at-recreo-cell" title="' + (recInfo ? recInfo.evento : 'Recreo') + '"></td>';
        return;
      }

      // Celda de módulo de clase
      var rs = reservasDia.filter(function (x) { return x.modulo === mid && x.lab === lab.id; });
      var s = solicDia.find(function (x) { return x.modulo === mid && x.lab === lab.id; });
      var maxG = getLabMaxGrupos(lab.id);
      // Horarios fijos (cursos de BD) para este slot
      var hf = getHorariosFijosSlot(diaActual, mid).filter(function (h) {
        return String(h.id_salones) === String(lab.id);
      });
      // Total de ítems en el slot (fijos + reservas)
      var totalEnSlot = hf.length + rs.length;
      var tdCls = hf.length > 0 ? ' at-cell-fijo' : '';
      html += '<td class="at-event-cell' + tdCls + '">';

      // Usar stack siempre que haya más de 1 ítem o haya espacio libre
      var usaStack = totalEnSlot > 1 || totalEnSlot < maxG || (hf.length > 0 && rs.length > 0);
      if (usaStack) html += '<div class="at-cell-stack">';

      // Mostrar horarios fijos dentro del stack
      if (hf.length > 0) {
        hf.forEach(function (h) {
          var cursoLbl = h.curso_label || (h.curso_ano ? h.curso_ano + '° ' + (h.curso_division || '') : 'Curso');
          var matAbrev = h.materia_abrev || h.materia_nombre || '';
          var aulaCod = h.aula_codigo || h.aula_numero || h.id_salones;

          // Habilitado para todos por ahora (si querés restringirlo a admins, cambiá a: var puedeEditarFijo = esDirectivo(); )
          var puedeEditarFijo = true;

          html += '<div class="at-event ev-fijo drag-target" title="Horario fijo: ' + cursoLbl + ' — ' + (h.materia_nombre || '') + ' — Aula ' + aulaCod + '" ' +
            (puedeEditarFijo ? 'role="button" tabindex="0" draggable="true" ondragstart="dragReservaStart(event,' + h.id + ',\'fijo\')" ondragend="dragReservaEnd(event)" onclick="verDetalleFijo(' + h.id + ')" ondragover="dragOverLibre(event)" ondragleave="dragLeaveLibre(event)" ondrop="dropReserva(event,' + diaActual + ',' + mid + ',\'' + lab.id + '\')"' : '') + '>' +
            '<div class="at-ev-curso">' + cursoLbl + '</div>' +
            (matAbrev ? '<div class="at-ev-prof at-ev-materia">' + matAbrev + '</div>' : '') +
            '<div class="at-ev-aula">🏫 ' + aulaCod + '</div>' +
            (puedeEditarFijo ? '<div class=\"at-ev-edit-hint drag-hint\">⠿</div>' : '') +
            '</div>';
        });
      }

      // Mostrar reservas normales dentro del mismo stack
      if (rs.length > 0) {
        var rendered = 0;
        rs.forEach(function (r, rIdx) {
          var oriOk = filtroOrient === 'all' || r.orient === filtroOrient;
          if (!oriOk) return;
          rendered++;
          var orientKey = (r.orient || 'bas').split(',')[0];
          var ori = ORIENTACIONES[orientKey] || ORIENTACIONES['bas'];
          var p = getProfe(r.profeId);
          var puedeEditar = esDirectivo() || r.profeId === getCurrentProfId();
          var _grupoNombre = r.grupoId ? getNombreGrupo(r.grupoId) : '';
          var grupoLabel = (rs.length + hf.length) > 1
            ? (_grupoNombre ? _grupoNombre : String(rIdx + 1))
            : (_grupoNombre ? 'Grupo ' + _grupoNombre : '');
          html +=
            '<div class=\"at-event ' + ori.ev + '\" role=\"button\" tabindex=\"0\" ' +
            (puedeEditar ? 'draggable=\"true\" ondragstart=\"dragReservaStart(event,' + r.id + ')\" ondragend=\"dragReservaEnd(event)\" ' : '') +
            'onclick=\"verDetalle(' + r.id + ')\" title=\"' + r.curso + ' — Prof. ' + p.apellido + (puedeEditar ? ' · Arrastrá para mover' : '') + '\">' +
            '<div class=\"at-ev-curso\">' + r.curso + ' ' + ori.emoji + '</div>' +
            '<div class=\"at-ev-prof\">' + p.apellido + '</div>' +
            (grupoLabel ? '<div class=\"at-ev-grupo\">' + grupoLabel + '</div>' : '') +
            (puedeEditar ? '<div class=\"at-ev-edit-hint drag-hint\">⠿</div>' : '') +
            '</div>';
        });
        if (rendered === 0 && hf.length === 0) {
          html += _celdaLibre(diaActual, mid, lab.id);
        }
      }

      // Mostrar "+" para agregar reserva si hay espacio libre en el slot
      if (totalEnSlot < maxG) {
        if (totalEnSlot === 0 && !s) {
          html += _celdaLibre(diaActual, mid, lab.id);
        } else if (!s) {
          html += '<div class="at-slot-extra">' + _celdaLibre(diaActual, mid, lab.id) + '</div>';
        }
      }

      // Solicitud pendiente (se muestra solo si no hay reservas ni fijos)
      if (s && rs.length === 0 && hf.length === 0) {
        var action = modoUsuario === 'admin'
          ? 'verDetalleSolicitud(' + s.id + ')'
          : 'verDetalle_Pendiente(' + s.id + ')';
        html +=
          '<div class="at-event ev-pendiente" role="button" tabindex="0" ' +
          'onclick="' + action + '" title="Pendiente: ' + s.curso + '">' +
          '<div class="at-ev-curso">' + s.curso + ' ⏳</div>' +
          '</div>';
      }

      if (usaStack) html += '</div>';

      html += '</td>';
    });

    html += '</tr>';
  });

  html += '</tbody></table></div>';
  grid.innerHTML = html;

  renderEsperaCalendario();
  renderVencimientosCalendario();
  renderSolicitudesBadge();
}

// Crea una solicitud de cambio para que el admin apruebe
function crearSolicitudDeCambio(reservaId, nuevoDia, nuevoModulo, nuevoLab) {
  var r = RESERVAS.find(function(x) { return x.id === reservaId; });
  if (!r) return;
  
  var modOrig  = getModulo(r.modulo);
  var modDest  = getModulo(nuevoModulo);
  var labOrig  = getLab(r.lab);
  var labDest  = getLab(nuevoLab);

  var desdeStr = DIAS_SEMANA[r.dia]   + ' · ' + modOrig.label + ' (' + modOrig.inicio + '–' + modOrig.fin + ')' + (r.lab !== nuevoLab ? ' · ' + labOrig.nombre : '');
  var hastaStr = DIAS_SEMANA[nuevoDia] + ' · ' + modDest.label + ' (' + modDest.inicio + '–' + modDest.fin + ')' + (r.lab !== nuevoLab ? ' · ' + labDest.nombre : '');

  confirmar(
    '¿Solicitar cambio de <strong>' + r.curso + '</strong>?<br>' +
    '<small style="color:var(--muted)">De: ' + desdeStr + '</small><br>' +
    '<small style="color:var(--muted)">A:&nbsp;&nbsp; ' + hastaStr + '</small><br>' +
    '<small style="color:var(--orange);font-weight:600;">⏳ Requiere aprobación del directivo</small>',
    function() {
      // Crear solicitud pendiente de cambio
      if (typeof nextId === 'undefined') nextId = 0;
      nextId++;
      var nuevaSolicitud = {
        id: nextId,
        semanaOffset: r.semanaOffset,
        dia: nuevoDia,
        modulo: nuevoModulo,
        lab: nuevoLab,
        curso: r.curso,
        orient: r.orient,
        profeId: r.profeId,
        secuencia: r.secuencia,
        cicloClases: r.cicloClases,
        estado: 'pendiente',
        esRenovacion: false,
        reservaOriginalId: reservaId,
        renovacionNum: 0,
        grupoId: r.grupoId || null
      };
      SOLICITUDES.push(nuevaSolicitud);
      saveDB();
      toast('Solicitud de cambio enviada. Aguardá la aprobación del directivo.', 'info');
      renderAll();
    }
  );
}

// Genera el HTML de una celda libre (helper interno)
function _celdaLibre(dia, modulo, labId) {
  return (
    '<div class="at-event at-libre drag-target" role="button" tabindex="0" ' +
    'onclick="abrirModalReservaSlot(' + dia + ',' + modulo + ',\'' + labId + '\')" ' +
    'ondragover="dragOverLibre(event)" ondragleave="dragLeaveLibre(event)" ondrop="dropReserva(event,' + dia + ',' + modulo + ',\'' + labId + '\')" ' +
    'title="Disponible — clic para reservar">' +
    '<span class="at-ev-plus">+</span>' +
    '</div>'
  );
}

// ── Drag & Drop de reservas ───────────────────────────────────
var _dragReservaId = null;

function dragReservaStart(event, reservaId, tipo) {
  _dragReservaId = tipo === 'fijo' ? 'fijo_' + reservaId : reservaId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', _dragReservaId);
  // Pequeño delay para que el navegador muestre el ghost antes de opacar
  var el = event.currentTarget;
  setTimeout(function () { el.classList.add('dragging'); }, 0);
}

function dragReservaEnd(event) {
  _dragReservaId = null;
  var el = event.currentTarget;
  if (el) el.classList.remove('dragging');
  // Limpiar highlights en targets
  document.querySelectorAll('.drag-over').forEach(function (e) { e.classList.remove('drag-over'); });
}

function dragOverLibre(event) {
  if (_dragReservaId === null) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function dragLeaveLibre(event) {
  event.currentTarget.classList.remove('drag-over');
}

function dropReserva(event, nuevoDia, nuevoModulo, nuevoLab) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  var reservaIdData = _dragReservaId !== null ? _dragReservaId : event.dataTransfer.getData('text/plain');
  if (!reservaIdData) return;

  if (typeof reservaIdData === 'string' && reservaIdData.startsWith('fijo_')) {
    var fijoId = parseInt(reservaIdData.split('_')[1]);
    moverHorarioFijoASlot(fijoId, nuevoDia, nuevoModulo, nuevoLab);
  } else {
    var reservaId = parseInt(reservaIdData);
    var r = RESERVAS.find(function(x) { return x.id === reservaId; });
    if (!r) return;
    
    // Si es profesor, crear solicitud de cambio en lugar de mover directamente
    if (!esDirectivo()) {
      crearSolicitudDeCambio(reservaId, nuevoDia, nuevoModulo, nuevoLab);
    } else {
      // Si es directivo, mover directamente
      moverReservaASlot(reservaId, nuevoDia, nuevoModulo, nuevoLab);
    }
  }
}

// ── Modificar Horarios Fijos (Drag & Drop) ────────────────────────
function moverHorarioFijoASlot(fijoId, nuevoDiaNum, nuevoModulo, nuevoLab) {
  var h = HORARIOS_FIJOS.find(function (x) { return x.id === fijoId; });
  if (!h) return;

  var nuevoDiaStr = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'][nuevoDiaNum];
  var nuevoIdHoras = null;
  // Buscamos el id_horas correspondiente al nuevoModulo
  for (var k in ID_HORAS_A_MODULO) {
    if (ID_HORAS_A_MODULO[k] === nuevoModulo) {
      nuevoIdHoras = parseInt(k);
      break;
    }
  }

  if (!nuevoIdHoras) {
    toast('Este horario no coincide con un módulo académico.', 'err');
    return;
  }

  if (h.dia === nuevoDiaStr && h.id_horas === nuevoIdHoras && h.id_salones == nuevoLab) return;

  var oldDiaStr = h.dia;
  var oldIdHoras = h.id_horas;
  var oldSalones = h.id_salones;

  var modOrig  = getModulo(ID_HORAS_A_MODULO[oldIdHoras] || 0);
  var modDest  = getModulo(nuevoModulo);
  var labOrig  = getLab(oldSalones);
  var labDest  = getLab(nuevoLab);

  var cursoLbl = h.curso_label || (h.curso_ano ? h.curso_ano + '° ' + (h.curso_division || '') : 'Curso');

  var desdeStr = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'].indexOf(oldDiaStr) >= 0 
    ? DIAS_SEMANA[['LUN', 'MAR', 'MIE', 'JUE', 'VIE'].indexOf(oldDiaStr)] + ' · ' + modOrig.label
    : 'Origen desconocido';
  var hastaStr = DIAS_SEMANA[nuevoDiaNum] + ' · ' + modDest.label + ' (' + modDest.inicio + '–' + modDest.fin + ')';

  confirmar(
    '¿Mover horario fijo <strong>' + cursoLbl + '</strong>?<br>' +
    '<small style="color:var(--muted)">De: ' + desdeStr + '</small><br>' +
    '<small style="color:var(--muted)">A:&nbsp;&nbsp; ' + hastaStr + '</small>',
    function() {
      h.dia = nuevoDiaStr;
      h.id_horas = nuevoIdHoras;
      h.id_salones = nuevoLab;
      renderAll();

      apiPut('horarios_fijos/' + h.id, {
        dia: nuevoDiaStr,
        id_horas: nuevoIdHoras,
        id_salones: nuevoLab
      }).then(function () {
        toast('Horario fijo actualizado en base de datos.', 'ok');
      }).catch(function (e) {
        h.dia = oldDiaStr;
        h.id_horas = oldIdHoras;
        h.id_salones = oldSalones;
        renderAll();
        toast('Error al mover horario fijo: ' + e.message, 'err');
      });
    }
  );
}

function verDetalleFijo(fijoId) {
  var h = HORARIOS_FIJOS.find(function (x) { return x.id === fijoId; });
  if (!h) return;

  var cursoLbl = h.curso_label || (h.curso_ano ? h.curso_ano + '° ' + (h.curso_division || '') : 'Curso');
  var matAbrev = h.materia_abrev || h.materia_nombre || '';
  var aulaCod = h.aula_codigo || h.aula_numero || h.id_salones;

  var body = document.getElementById('modal-detalle-body');
  if (body) {
    body.innerHTML =
      '<div class="detail-row"><div class="detail-label">Tipo</div><div class="detail-value"><strong>Horario Fijo (Cupof)</strong></div></div>' +
      '<div class="detail-row"><div class="detail-label">Materia</div><div class="detail-value">' + (h.materia_nombre || matAbrev) + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Curso</div><div class="detail-value">' + cursoLbl + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Laboratorio</div><div class="detail-value">Aula ' + aulaCod + '</div></div>';
  }

  var footer = document.getElementById('modal-detalle-footer');
  if (footer) {
    footer.innerHTML =
      '<button class="btn-cancel" onclick="cerrarModal(\'modal-detalle\')">Cerrar</button>' +
      (esDirectivo() ? '<button class="btn-danger" onclick="cerrarModal(\'modal-detalle\');eliminarHorarioFijo(' + h.id + ')">Eliminar</button>' : '');
  }

  abrirModal('modal-detalle');
}

function eliminarHorarioFijo(fijoId) {
  confirmar('¿Estás seguro de eliminar este horario fijo de la base de datos?', function () {
    apiDelete('horarios_fijos/' + fijoId).then(function () {
      HORARIOS_FIJOS = HORARIOS_FIJOS.filter(function (x) { return x.id !== fijoId; });
      renderAll();
      toast('Horario fijo eliminado.', 'ok');
    }).catch(function (e) {
      toast('Error al eliminar horario fijo: ' + e.message, 'err');
    });
  });
}

// ── Edición de recreos ────────────────────────────────────────
function editarRecreo(moduloId) {
  var rec = RECREOS.find(function (r) { return r.modulo === moduloId; });
  var mod = getModulo(moduloId);
  document.getElementById('modal-recreo-title').textContent = mod.icon + ' ' + mod.label + ' (' + mod.inicio + '–' + mod.fin + ')';
  document.getElementById('recreo-evento').value = rec ? rec.evento : 'Recreo';
  document.getElementById('recreo-notas').value = rec ? rec.notas : '';
  document.getElementById('recreo-modulo-id').value = moduloId;
  abrirModal('modal-recreo');
}

function guardarRecreo() {
  var moduloId = parseInt(document.getElementById('recreo-modulo-id').value);
  var evento = document.getElementById('recreo-evento').value.trim();
  var notas = document.getElementById('recreo-notas').value.trim();
  if (!evento) { toast('Ingresá un nombre para el evento.', 'err'); return; }

  var idx = RECREOS.findIndex(function (r) { return r.modulo === moduloId; });
  if (idx >= 0) {
    RECREOS[idx].evento = evento;
    RECREOS[idx].notas = notas;
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
  var pendientes = SOLICITUDES.filter(function (s) { return s.estado === 'pendiente'; }).length;
  var badge = document.getElementById('admin-badge');
  if (badge) {
    badge.textContent = pendientes || '';
    badge.style.display = pendientes ? 'flex' : 'none';
  }
}

// ── Lista de espera en el sidebar ─────────────────────────────
function renderEsperaCalendario() {
  var el = document.getElementById('espera-lista');
  if (!el) return;

  var espera = LISTA_ESPERA.filter(function (e) { return e.semanaOffset === semanaOffset; });
  if (!espera.length) {
    el.innerHTML = '<div class="empty-state">No hay docentes en lista de espera esta semana.</div>';
    return;
  }

  var bgColors = ['var(--navy)', 'var(--red)', 'var(--green)', 'var(--amber)'];
  var esDir = esDirectivo();

  el.innerHTML = espera.map(function (e, i) {
    var p = getProfe(e.profeId);
    var fecha = getDiaDate(e.semanaOffset, e.dia);
    var mod = getModulo(e.modulo);
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

  var hoyRes = RESERVAS.filter(function (r) { return r.semanaOffset === semanaOffset; });
  if (!hoyRes.length) {
    el.innerHTML = '<div class="empty-state">No hay reservas esta semana.</div>';
    return;
  }

  var sorted = [].concat(hoyRes).sort(function (a, b) { return b.cicloClases - a.cicloClases; });
  var colores = { 3: 'var(--red)', 2: 'var(--amber)', 1: 'var(--green)' };

  el.innerHTML = sorted.slice(0, 6).map(function (r) {
    var p = getProfe(r.profeId);
    var orientKey = (r.orient || 'bas').split(',')[0];
    var ori = ORIENTACIONES[orientKey] || ORIENTACIONES['bas'];
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
