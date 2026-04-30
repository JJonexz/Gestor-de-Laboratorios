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

  // ── Sección de solicitudes pendientes ──────────────────────
  var solHtml = '';
  if (misSols.length) {
    solHtml =
      '<div class="section-label-strip">⏳ Solicitudes pendientes de aprobación</div>' +
      '<div class="reservas-grid">' +
      misSols.map(function(s) {
        var ori = ORIENTACIONES[s.orient];
        var lab = getLab(s.lab);
        var mod = getModulo(s.modulo);
        return (
          '<div class="reserva-card reserva-card-pending">' +
            '<div class="reserva-card-stripe ' + s.orient + '"></div>' +
            '<div class="reserva-card-body">' +
              '<div class="reserva-card-header">' +
                '<div>' +
                  '<div class="reserva-card-title">' + lab.nombre + '</div>' +
                  '<div class="reserva-meta">' +
                    '<span class="meta-tag">' + DIAS_LARGO[s.dia] + ' ' + mod.inicio + '</span>' +
                    '<span class="meta-tag orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span>' +
                  '</div>' +
                '</div>' +
                '<div class="reserva-curso-badge">' + s.curso + '</div>' +
              '</div>' +
              '<div class="reserva-secuencia">"' + s.secuencia + '"</div>' +
              '<div class="pending-status-bar">⏳ Pendiente de aprobación directiva</div>' +
            '</div>' +
            '<div class="reserva-card-footer">' +
              '<button class="btn-action btn-cancel-r" onclick="cancelarSolicitud(' + s.id + ')">Cancelar solicitud</button>' +
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
      misRes.map(function(r) {
        var p          = getProfe(r.profeId);
        var ori        = ORIENTACIONES[r.orient];
        var lab        = getLab(r.lab);
        var mod        = getModulo(r.modulo);
        var needsRenew = r.cicloClases >= 3;
        var dots = [1, 2, 3].map(function(i) {
          var cls = 'empty';
          if (i < r.cicloClases)      cls = 'done';
          else if (i === r.cicloClases) cls = needsRenew ? 'warn' : 'current';
          return '<div class="ciclo-dot ' + cls + '"></div>';
        }).join('');

        var cicloTxt = 'Clase ' + r.cicloClases + '/3' +
          (needsRenew
            ? ((r.renovaciones || 0) >= 2 ? ' · ¡Nueva reserva!' : ' · Renovar ' + ((r.renovaciones || 0) + 1) + '/2')
            : '');

        return (
          '<div class="reserva-card">' +
            '<div class="reserva-card-stripe ' + r.orient + '"></div>' +
            '<div class="reserva-card-body">' +
              '<div class="reserva-card-header">' +
                '<div>' +
                  '<div class="reserva-card-title">' + lab.nombre + '</div>' +
                  '<div class="reserva-meta">' +
                    '<span class="meta-tag">' + DIAS_LARGO[r.dia] + ' ' + mod.inicio + '</span>' +
                    '<span class="meta-tag orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span>' +
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
              '<button class="btn-action btn-detail" onclick="verDetalle(' + r.id + ')">Ver detalle</button>' +
              (needsRenew && esDirectivo()
                ? '<button class="btn-action btn-renew" onclick="renovarReserva(' + r.id + ')">↻ Renovar</button>'
                : '') +
              '<button class="btn-action btn-cancel-r" onclick="cancelarReserva(' + r.id + ')">Cancelar</button>' +
            '</div>' +
          '</div>'
        );
      }).join('') +
      '</div>';
  }

  list.innerHTML = solHtml + reservasHtml;
}

// ── Cancelar solicitud propia ─────────────────────────────────
function cancelarSolicitud(solId) {
  var s = SOLICITUDES.find(function(x) { return x.id === solId; });
  if (!s) return;
  confirmar('¿Cancelar esta solicitud pendiente?', function() {
    SOLICITUDES = SOLICITUDES.filter(function(x) { return x.id !== solId; });
    saveDB();
    toast('Solicitud cancelada.', 'info');
    renderAll();
  });
}

// ── Renovar ciclo de una reserva ──────────────────────────────
function renovarReserva(id) {
  var r = RESERVAS.find(function(x) { return x.id === id; });
  if (!r) return;

  if (modoUsuario === 'admin') {
    // Directivo: aprueba directamente
    var puedeNueva = (r.renovaciones || 0) >= 2;
    if (puedeNueva) {
      confirmar('Han pasado 2 semanas de renovaciones. ¿Iniciar nuevo ciclo completo de 3 clases?', function() {
        r.cicloClases  = 1;
        r.renovaciones = 0;
        saveDB();
        toast('Nuevo ciclo completo iniciado.', 'ok');
        renderAll();
      });
    } else {
      confirmar('¿Aprobar renovación por 1 día para ' + getLab(r.lab).nombre + ' — ' + r.curso + '?', function() {
        r.cicloClases  = 1;
        r.renovaciones = (r.renovaciones || 0) + 1;
        saveDB();
        toast('Renovación aprobada (semana ' + r.renovaciones + '/2).', 'ok');
        renderAll();
      });
    }
    return;
  }

  // Profesor: envía solicitud de renovación
  if ((r.renovaciones || 0) >= 2) {
    toast('Ya cumpliste 2 semanas de renovación. Podés hacer una nueva reserva normalmente.', 'info');
    return;
  }
  var semLabel = (r.renovaciones || 0) + 1;
  confirmar(
    '¿Solicitar renovación semanal ' + semLabel + '/2 para <strong>' + getLab(r.lab).nombre + ' — ' + r.curso + '</strong>?',
    function() {
      nextId++;
      SOLICITUDES.push({
        id:               nextId,
        semanaOffset:     semanaOffset,
        dia:              r.dia,
        modulo:           r.modulo,
        lab:              r.lab,
        curso:            r.curso,
        orient:           r.orient,
        profeId:          r.profeId,
        secuencia:        r.secuencia,
        cicloClases:      1,
        estado:           'pendiente',
        esRenovacion:     true,
        reservaOriginalId: r.id,
        renovacionNum:    semLabel,
      });
      saveDB();
      toast('Solicitud de renovación semana ' + semLabel + '/2 enviada.', 'info');
      renderAll();
    }
  );
}

// ── Cancelar reserva confirmada ───────────────────────────────
function cancelarReserva(id) {
  var r = RESERVAS.find(function(x) { return x.id === id; });
  if (!r) return;

  var p = getProfe(r.profeId);
  confirmar(
    '¿Cancelar la reserva de <strong>Prof. ' + p.apellido + '</strong> — ' + r.curso + ' el ' + DIAS_LARGO[r.dia] + '?',
    function() {
      RESERVAS = RESERVAS.filter(function(x) { return x.id !== id; });
      saveDB();
      toast('Reserva cancelada.', 'info');

      // Avisar si hay docentes en espera para ese turno
      var waiting = LISTA_ESPERA.filter(function(e) {
        return e.lab === r.lab && e.dia === r.dia && e.modulo === r.modulo;
      });
      if (waiting.length) {
        setTimeout(function() {
          toast('Hay ' + waiting.length + ' docente(s) en espera para ese turno.', 'warn');
        }, 400);
      }

      renderAll();
    }
  );
}
