// ============================================================
// misReservas.js — Vista "Mis reservas"
//
// ¿Qué hay acá?
//   • renderMisReservas()   → lista de reservas y solicitudes del profe
//   • cancelarSolicitud()   → cancela una solicitud pendiente propia
//   • renovarReserva()      → solicita o aprueba renovación de ciclo
//   • cancelarReserva()     → cancela una reserva confirmada
//
// Depende de: config.js, helpers.js, ui.js, db.js
// ============================================================

function renderMisReservas() {
  var isAdmin = modoUsuario === 'admin';
  var profId  = getCurrentProfId();

  // Títulos
  var titleEl = document.getElementById('mis-reservas-title');
  var subEl   = document.getElementById('mis-reservas-sub');
  if (titleEl) titleEl.textContent = isAdmin ? 'Todas las reservas' : 'Mis reservas';
  if (subEl)   subEl.textContent   = isAdmin
    ? 'Vista directiva · todos los docentes'
    : (window.SESSION ? window.SESSION.display : '');

  // Datos a mostrar
  var misRes = isAdmin
    ? [].concat(RESERVAS).sort(function(a, b) { return a.dia - b.dia || a.modulo - b.modulo; })
    : RESERVAS.filter(function(r) { return r.profeId === profId; })
              .sort(function(a, b) { return a.dia - b.dia || a.modulo - b.modulo; });

  var misSols = isAdmin
    ? []
    : SOLICITUDES.filter(function(s) { return s.profeId === profId && s.estado === 'pendiente'; });

  // Tarjetas de estadísticas
  var strip = document.getElementById('mis-stats-strip');
  if (strip) {
    strip.innerHTML =
      '<div class="stat-card az"><div class="stat-card-n">' + misRes.length + '</div><div class="stat-card-l">' + (isAdmin ? 'Reservas totales' : 'Activas') + '</div></div>' +
      (!isAdmin ? '<div class="stat-card am"><div class="stat-card-n">' + misSols.length + '</div><div class="stat-card-l">Pendientes</div></div>' : '') +
      '<div class="stat-card rj"><div class="stat-card-n">' + misRes.filter(function(r) { return r.cicloClases >= 3; }).length + '</div><div class="stat-card-l">A renovar</div></div>' +
      (isAdmin ? '<div class="stat-card vd"><div class="stat-card-n">' + PROFESORES.length + '</div><div class="stat-card-l">Docentes</div></div>' : '');
  }

  var list  = document.getElementById('mis-reservas-list');
  var empty = document.getElementById('mis-reservas-empty');
  if (!list) return;

  if (!misRes.length && !misSols.length) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Función auxiliar para agrupar
  function agrupar(lista) {
    var groups = [];
    lista.forEach(function(item) {
      var key = [item.semanaOffset, item.dia, item.lab, item.curso, item.orient, item.profeId, item.secuencia].join('|');
      var group = groups.find(function(g) { return g.key === key; });
      if (group) {
        group.items.push(item);
        group.modulos.push(item.modulo);
      } else {
        groups.push({
          key: key,
          items: [item],
          modulos: [item.modulo],
          first: item
        });
      }
    });
    return groups;
  }

  // ── Sección de solicitudes pendientes ──────────────────────
  var solHtml = '';
  if (misSols.length) {
    solHtml =
      '<div class="section-label-strip">⏳ Solicitudes pendientes de aprobación</div>' +
      '<div class="reservas-grid">' +
      agrupar(misSols).map(function(g) {
        var s = g.first;
        var oris = (s.orient || 'bas').split(',');
        var firstOri = ORIENTACIONES[oris[0]] || ORIENTACIONES.bas;
        var orientBadges = oris.map(function(o) {
          var ori = ORIENTACIONES[o] || ORIENTACIONES.bas;
          return '<span class="meta-tag orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span>';
        }).join('');
        var lab = getLab(s.lab);
        var modInicio = getModulo(Math.min.apply(null, g.modulos)).inicio;
        var modFin = getModulo(Math.max.apply(null, g.modulos)).fin;
        var modString = g.modulos.length + ' mod(s) (' + modInicio + '–' + modFin + ')';
        var modTooltip = g.modulos.map(function(m) { return getModulo(m).label; }).join(', ');
        var jsonIds = JSON.stringify(g.items.map(function(x) { return x.id; }));

        return (
          '<div class="reserva-card reserva-card-pending">' +
            '<div class="reserva-card-stripe ' + oris[0] + '"></div>' +
            '<div class="reserva-card-body">' +
              '<div class="reserva-card-header">' +
                '<div>' +
                  '<div class="reserva-card-title">' + lab.nombre + '</div>' +
                  '<div class="reserva-meta">' +
                    '<span class="meta-tag" title="' + modTooltip + '">' + DIAS_LARGO[s.dia] + ' ' + modString + '</span>' +
                    orientBadges +
                  '</div>' +
                '</div>' +
                '<div class="reserva-curso-badge">' + s.curso + '</div>' +
              '</div>' +
              '<div class="reserva-secuencia">"' + s.secuencia + '"</div>' +
              '<div class="pending-status-bar">⏳ Pendiente de aprobación directiva</div>' +
            '</div>' +
            '<div class="reserva-card-footer">' +
              '<button class="btn-action btn-cancel-r" onclick=\'cancelarSolicitudGrupo(' + jsonIds + ')\'>Cancelar solicitud</button>' +
            '</div>' +
          '</div>'
        );
      }).join('') +
      '</div>';
  }

  // ── Sección de reservas confirmadas ──────────────────────
  var reservasHtml = '';
  if (misRes.length) {
    reservasHtml =
      '<div class="reservas-grid">' +
      agrupar(misRes).map(function(g) {
        var r          = g.first;
        var p          = getProfe(r.profeId);
        var oris       = (r.orient || 'bas').split(',');
        var firstOri   = ORIENTACIONES[oris[0]] || ORIENTACIONES.bas;
        var orientBadges = oris.map(function(o) {
          var ori = ORIENTACIONES[o] || ORIENTACIONES.bas;
          return '<span class="meta-tag orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span>';
        }).join('');
        var lab        = getLab(r.lab);
        var modInicio  = getModulo(Math.min.apply(null, g.modulos)).inicio;
        var modFin     = getModulo(Math.max.apply(null, g.modulos)).fin;
        var modString  = g.modulos.length + ' mod(s) (' + modInicio + '–' + modFin + ')';
        var modTooltip = g.modulos.map(function(m) { return getModulo(m).label; }).join(', ');
        var jsonIds    = JSON.stringify(g.items.map(function(x) { return x.id; }));
        
        var needsRenew = r.cicloClases >= 3;
        var dots = [1, 2, 3].map(function(i) {
          var cls = 'empty';
          if (i < r.cicloClases)      cls = 'done';
          else if (i === r.cicloClases) cls = needsRenew ? 'warn' : 'current';
          return '<div class="ciclo-dot ' + cls + '"></div>';
        }).join('');

        var cicloTxt = 'Clase ' + r.cicloClases + '/3' +
          (needsRenew
            ? ((r.renovaciones || 0) >= 1 ? ' · ¡Nueva reserva!' : ' · Renovar ' + ((r.renovaciones || 0) + 1) + '/1')
            : '');

        return (
          '<div class="reserva-card">' +
            '<div class="reserva-card-stripe ' + oris[0] + '"></div>' +
            '<div class="reserva-card-body">' +
              '<div class="reserva-card-header">' +
                '<div>' +
                  '<div class="reserva-card-title">' + lab.nombre + '</div>' +
                  '<div class="reserva-meta">' +
                    '<span class="meta-tag" title="' + modTooltip + '">' + DIAS_LARGO[r.dia] + ' ' + modString + '</span>' +
                    orientBadges +
                    (isAdmin ? '<span class="meta-tag">Prof. ' + p.apellido + '</span>' : '') +
                  '</div>' +
                '</div>' +
                '<div class="reserva-curso-badge">' + r.curso + '</div>' +
              '</div>' +
              '<div class="reserva-secuencia">"' + r.secuencia + '"</div>' +
              '<div class="ciclo-wrap">' +
                '<div class="ciclo-dots">' + dots + '</div>' +
                '<span class="ciclo-text ' + (needsRenew ? 'renew' : '') + '">' + cicloTxt + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="reserva-card-footer">' +
              '<button class="btn-action btn-detail" onclick=\'verDetalleGrupo(' + jsonIds + ')\'>Ver</button>' +
              '<button class="btn-action btn-detail" style="background:var(--navy-faint);border-color:var(--navy-light);" onclick=\'editarReservaGrupo(' + jsonIds + ')\'>✎ Editar</button>' +
              (needsRenew && esDirectivo()
                ? '<button class="btn-action btn-renew" onclick=\'renovarReservaGrupo(' + jsonIds + ')\'>↻ Renovar</button>'
                : '') +
              '<button class="btn-action btn-cancel-r" onclick=\'cancelarReservaGrupo(' + jsonIds + ')\'>Cancelar</button>' +
            '</div>' +
          '</div>'
        );
      }).join('') +
      '</div>';
  }

  list.innerHTML = solHtml + reservasHtml;
}

// ── Cancelar solicitud propia ─────────────────────────────────
function cancelarSolicitudGrupo(ids) {
  var s = SOLICITUDES.find(function(x) { return x.id === ids[0]; });
  if (!s) return;
  var p = getProfe(s.profeId);
  var lab = getLab(s.lab);
  confirmar('¿Cancelar esta solicitud pendiente (' + ids.length + ' módulo/s)?', function() {
    var pendiente = ids.length;
    ids.forEach(function(id) {
      dbEliminarSolicitud(id, function() {
        pendiente--;
        if (pendiente === 0) {
          toast('Solicitud cancelada.', 'info');
          // Notificar a directivos que el profesor canceló su solicitud
          if (typeof crearNotificacion === 'function') {
            crearNotificacion(
              'cancelacion_sol',
              'Solicitud cancelada por docente',
              'Prof. ' + (p ? p.apellido : '?') + ' canceló su solicitud en ' + (lab ? lab.nombre : 'Lab.' + s.lab) + ' — ' + DIAS_LARGO[s.dia] + ' (mód. ' + getModulo(s.modulo).label + ')',
              null, // null = visible para admins
              { labId: s.lab }
            );
          }
          renderAll();
        }
      });
    });
  });
}

// ── Renovar ciclo de una reserva ──────────────────────────────
function renovarReservaGrupo(ids) {
  var r = RESERVAS.find(function(x) { return x.id === ids[0]; });
  if (!r) return;

  if (modoUsuario === 'admin') {
    // Directivo: aprueba directamente
    var puedeNueva = (r.renovaciones || 0) >= 1;
    if (puedeNueva) {
      confirmar('Han pasado 1 semana de renovaciones. ¿Iniciar nuevo ciclo completo de 3 clases para ' + ids.length + ' módulo/s?', function() {
        ids.forEach(function(id) {
          var res = RESERVAS.find(function(x) { return x.id === id; });
          if(res) {
            res.cicloClases  = 1;
            res.renovaciones = 0;
          }
        });
        saveDB();
        toast('Nuevo ciclo completo iniciado.', 'ok');
        renderAll();
      });
    } else {
      confirmar('¿Aprobar renovación por 1 día para ' + getLab(r.lab).nombre + ' — ' + r.curso + ' (' + ids.length + ' módulo/s)?', function() {
        ids.forEach(function(id) {
          var res = RESERVAS.find(function(x) { return x.id === id; });
          if(res) {
            res.cicloClases  = 1;
            res.renovaciones = (res.renovaciones || 0) + 1;
          }
        });
        saveDB();
        toast('Renovación aprobada.', 'ok');
        renderAll();
      });
    }
    return;
  }

  // Profesor: envía solicitud de renovación
  if ((r.renovaciones || 0) >= 1) {
    toast('Ya cumpliste 1 semana de renovación. Podés hacer una nueva reserva normalmente.', 'info');
    return;
  }
  var semLabel = (r.renovaciones || 0) + 1;
  confirmar(
    '¿Solicitar renovación semanal ' + semLabel + '/1 para <strong>' + getLab(r.lab).nombre + ' — ' + r.curso + '</strong> (' + ids.length + ' módulo/s)?',
    function() {
      ids.forEach(function(id) {
        var res = RESERVAS.find(function(x) { return x.id === id; });
        if(res) {
          nextId++;
          SOLICITUDES.push({
            id:               nextId,
            semanaOffset:     semanaOffset,
            dia:              res.dia,
            modulo:           res.modulo,
            lab:              res.lab,
            curso:            res.curso,
            orient:           res.orient,
            profeId:          res.profeId,
            secuencia:        res.secuencia,
            cicloClases:      1,
            estado:           'pendiente',
            esRenovacion:     true,
            reservaOriginalId: res.id,
            renovacionNum:    semLabel,
          });
        }
      });
      saveDB();
      toast('Solicitud de renovación semana ' + semLabel + '/1 enviada.', 'info');
      renderAll();
    }
  );
}

// ── Cancelar reserva confirmada ───────────────────────────────
function cancelarReservaGrupo(ids) {
  var r = RESERVAS.find(function(x) { return x.id === ids[0]; });
  if (!r) return;

  var p = getProfe(r.profeId);
  var msg = '¿Cancelar la reserva de <strong>Prof. ' + p.apellido + '</strong> — ' + r.curso + ' el ' + DIAS_LARGO[r.dia] + ' (' + ids.length + ' módulo/s)?';

  // Si es anual y somos directivos, damos opción de borrar todo
  if (r.anual && esDirectivo()) {
    confirmarOpciones(
      'Esta es una <strong>reserva anual</strong>. ¿Deseas eliminar solo esta fecha (' + ids.length + ' módulo/s) o toda la serie del año?',
      {
        ok: {
          texto: 'Solo esta fecha',
          callback: function() { ejecutarCancelacionGrupo(ids); }
        },
        extra: {
          texto: 'Toda la serie anual',
          style: { background: 'var(--red)', borderColor: 'var(--red)' },
          callback: function() { cancelarSerieAnual(r); }
        }
      }
    );
  } else {
    confirmar(msg, function() { ejecutarCancelacionGrupo(ids); });
  }
}

function ejecutarCancelacionGrupo(ids) {
  var primerR = RESERVAS.find(function(x) { return x.id === ids[0]; });
  if (!primerR) return;
  var p = getProfe(primerR.profeId);
  var lab = getLab(primerR.lab);

  var pendiente = ids.length;
  ids.forEach(function(id) {
    dbEliminarReserva(id, function() {
      pendiente--;
      if (pendiente === 0) {
        toast('Reservas canceladas.', 'info');

        // Notificar a directivos que el profesor canceló su reserva
        if (typeof crearNotificacion === 'function') {
          crearNotificacion(
            'cancelacion_res',
            'Reserva cancelada por docente',
            'Prof. ' + (p ? p.apellido : '?') + ' canceló su reserva en ' + (lab ? lab.nombre : 'Lab.' + primerR.lab) + ' — ' + DIAS_LARGO[primerR.dia] + ' (' + ids.length + ' módulo/s)',
            null, // null = visible para admins
            { labId: primerR.lab }
          );
        }

        // Avisar si hay docentes en espera para ese turno
        var waiting = LISTA_ESPERA.filter(function(e) {
          return e.lab === primerR.lab && e.dia === primerR.dia;
        });
        if (waiting.length) {
          setTimeout(function() {
            toast('Hay ' + waiting.length + ' docente(s) en espera para ese día/lab.', 'warn');
          }, 400);
        }
        renderAll();
      }
    });
  });
}

function cancelarSerieAnual(reservaBase) {
  var cursoOriginal   = reservaBase.curso;
  var profeIdOriginal = reservaBase.profeId;
  var labOriginal     = reservaBase.lab;
  var diaOriginal     = reservaBase.dia;

  var idsAEliminar = RESERVAS.filter(function(x) {
    return (
      x.lab     === labOriginal &&
      x.dia     === diaOriginal &&
      x.profeId === profeIdOriginal &&
      x.curso   === cursoOriginal &&
      x.anual   === true
    );
  }).map(function(x) { return x.id; });

  if (!idsAEliminar.length) {
    toast('No se encontraron reservas de la serie.', 'warn');
    return;
  }

  var p = getProfe(profeIdOriginal);
  var lab = getLab(labOriginal);
  var pendiente = idsAEliminar.length;

  idsAEliminar.forEach(function(id) {
    dbEliminarReserva(id, function() {
      pendiente--;
      if (pendiente === 0) {
        toast('Se eliminaron ' + idsAEliminar.length + ' reserva(s) de la serie anual.', 'ok');
        if (typeof crearNotificacion === 'function') {
          crearNotificacion(
            'cancelacion_res',
            'Serie anual cancelada',
            'Prof. ' + (p ? p.apellido : '?') + ' canceló toda la serie anual en ' + (lab ? lab.nombre : 'Lab.' + labOriginal) + ' — ' + DIAS_LARGO[diaOriginal],
            null,
            { labId: labOriginal }
          );
        }
        renderAll();
      }
    });
  });
}