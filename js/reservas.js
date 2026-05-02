// ============================================================
// reservas.js — Reservas y solicitudes
//
// ¿Qué hay acá?
//   • poblarSelectsReserva()        → llena los <select> del modal
//   • abrirModalReserva/Slot()      → apertura del modal
//   • checkConflict()               → aviso de conflicto en tiempo real
//   • getModulosParaPeriodo()       → expande "turno completo" o multi-hora
//   • guardarReserva()              → lógica de creación (directivo vs profe)
//   • verDetalle()                  → modal de detalle de una reserva
//   • verDetalleSolicitud()         → modal de detalle para el admin
//   • aceptarSolicitud()            → aprueba una solicitud pendiente
//   • rechazarSolicitud()           → rechaza una solicitud pendiente
//
// Depende de: config.js, helpers.js, ui.js, db.js
// ============================================================

// ── Población de selects del modal ───────────────────────────
function poblarSelectsReserva() {
  // Laboratorios disponibles
  ['f-lab', 'espera-lab'].forEach(function(sid) {
    var sel = document.getElementById(sid);
    if (!sel) return;
    sel.innerHTML =
      '<option value="">Seleccionar laboratorio…</option>' +
      LABS.filter(function(l) { return !l.ocupado; })
          .map(function(l) { return '<option value="' + l.id + '">' + l.nombre + '</option>'; })
          .join('');
  });

  // Días de la semana actual
  ['f-dia', 'espera-dia'].forEach(function(sid) {
    var sel = document.getElementById(sid);
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar día…</option>';
    for (var d = 0; d < 5; d++) {
      var f = getDiaDate(semanaOffset, d);
      sel.innerHTML += '<option value="' + d + '">' + DIAS_SEMANA[d] + ' ' + formatFecha(f) + '</option>';
    }
  });

  // Módulos agrupados por turno
  ['f-modulo', 'espera-modulo'].forEach(function(sid) {
    var sel = document.getElementById(sid);
    if (!sel) return;
    var opts       = '<option value="">Seleccionar módulo…</option>';
    var turnoActual = '';
    MODULOS_CLASE.forEach(function(m) {
      if (m.turno !== turnoActual) {
        if (turnoActual) opts += '</optgroup>';
        opts += '<optgroup label="' + m.turno + '">';
        turnoActual = m.turno;
      }
      opts += '<option value="' + m.id + '">' + m.label + ' (' + m.inicio + '–' + m.fin + ')</option>';
    });
    if (turnoActual) opts += '</optgroup>';
    sel.innerHTML = opts;
  });

  // Período de reserva (1h, 2h, 4h, turno completo)
  var fPeriodo = document.getElementById('f-periodo');
  if (fPeriodo) {
    var opts =
      '<option value="1">1 hora (módulo individual)</option>' +
      '<option value="2">2 horas consecutivas</option>' +
      '<option value="4">4 horas consecutivas</option>';
    TURNOS_CONFIG.forEach(function(t) {
      opts += '<option value="turno_' + t.label + '">' + t.icon + ' Turno completo ' + t.label + ' (' + t.modulos.length + ' hs)</option>';
    });
    fPeriodo.innerHTML = opts;
  }

  // Orientaciones
  var fOrient = document.getElementById('f-orient');
  if (fOrient) {
    fOrient.innerHTML = Object.keys(ORIENTACIONES).map(function(k) {
      var o = ORIENTACIONES[k];
      return '<option value="' + k + '">' + o.emoji + ' ' + o.nombre + '</option>';
    }).join('');
  }

  // Profesores (solo para directivos)
  ['f-profe', 'edit-profe'].forEach(function(sid) {
    var sel = document.getElementById(sid);
    if (!sel) return;
    var sorted = [].concat(PROFESORES).sort(function(a, b) {
      return a.apellido.localeCompare(b.apellido);
    });
    sel.innerHTML =
      '<option value="">Seleccionar docente…</option>' +
      sorted.map(function(p) {
        return '<option value="' + p.id + '">Prof. ' + p.apellido + ', ' + p.nombre + ' — ' + p.materia + '</option>';
      }).join('');
  });
}

// ── Abrir modal (botón "Nueva reserva") ──────────────────────
function abrirModalReserva() {
  poblarSelectsReserva();

  // Limpiar campos
  ['f-lab', 'f-dia', 'f-curso', 'f-secuencia'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var orient = document.getElementById('f-orient');  if (orient) orient.value = 'info';
  var fmod   = document.getElementById('f-modulo');  if (fmod)   fmod.value = '';
  var fper   = document.getElementById('f-periodo'); if (fper)   fper.value = '1';
  var cw     = document.getElementById('conflict-warning'); if (cw) cw.classList.remove('show');

  // Checkbox de reserva anual (solo para directivos)
  var anualWrap = document.getElementById('f-anual-wrap');
  var anualChk  = document.getElementById('f-anual');
  if (anualWrap) anualWrap.style.display = esDirectivo() ? 'block' : 'none';
  if (anualChk)  anualChk.checked = false;

  // Selector de docente (solo para directivos)
  var profeWrap = document.getElementById('f-profe-wrap');
  var profeSel  = document.getElementById('f-profe');
  if (profeWrap) profeWrap.style.display = esDirectivo() ? 'block' : 'none';
  if (profeSel)  profeSel.value = '';

  abrirModal('modal-reserva');
}

// ── Abrir modal con día/módulo/lab pre-seleccionados ─────────
function abrirModalReservaSlot(dia, modulo, lab) {
  poblarSelectsReserva();

  var fLab = document.getElementById('f-lab');
  var fDia = document.getElementById('f-dia');
  var fMod = document.getElementById('f-modulo');
  if (fLab) fLab.value = lab;
  if (fDia) fDia.value = dia;
  if (fMod) fMod.value = modulo;

  var fCurso = document.getElementById('f-curso');
  var fSeq   = document.getElementById('f-secuencia');
  if (fCurso) fCurso.value = '';
  if (fSeq)   fSeq.value   = '';

  var orient = document.getElementById('f-orient');
  if (orient) orient.value = 'info';

  checkConflict();

  // Checkbox de reserva anual (solo para directivos)
  var anualWrap = document.getElementById('f-anual-wrap');
  var anualChk  = document.getElementById('f-anual');
  if (anualWrap) anualWrap.style.display = esDirectivo() ? 'block' : 'none';
  if (anualChk)  anualChk.checked = false;

  // Selector de docente (solo para directivos)
  var profeWrap = document.getElementById('f-profe-wrap');
  var profeSel  = document.getElementById('f-profe');
  if (profeWrap) profeWrap.style.display = esDirectivo() ? 'block' : 'none';
  if (profeSel)  profeSel.value = '';

  abrirModal('modal-reserva');
}

// ── Verificación de conflicto en tiempo real ─────────────────
function checkConflict() {
  var lab = document.getElementById('f-lab');
  var dia = document.getElementById('f-dia');
  var mod = document.getElementById('f-modulo');
  var cw  = document.getElementById('conflict-warning');
  if (!lab || !dia || !mod || !cw) return;
  if (!lab.value || dia.value === '' || mod.value === '') { cw.classList.remove('show'); return; }

  var conflict = RESERVAS.find(function(r) {
    return r.semanaOffset === semanaOffset
      && r.dia    === parseInt(dia.value)
      && r.modulo === parseInt(mod.value)
      && r.lab    === lab.value;
  });
  var solConflict = SOLICITUDES.find(function(s) {
    return s.semanaOffset === semanaOffset
      && s.dia    === parseInt(dia.value)
      && s.modulo === parseInt(mod.value)
      && s.lab    === lab.value
      && s.estado === 'pendiente';
  });
  cw.classList.toggle('show', !!(conflict || solConflict));
}

// ── Expande un período a una lista de IDs de módulos ─────────
// periodoVal: '1' | '2' | '4' | 'turno_Mañana' | 'turno_Tarde' | ...
function getModulosParaPeriodo(moduloBase, periodoVal) {
  if (typeof periodoVal === 'string' && periodoVal.indexOf('turno_') === 0) {
    var turnoNombre = periodoVal.replace('turno_', '');
    var tc = TURNOS_CONFIG.find(function(t) { return t.label === turnoNombre; });
    return tc ? tc.modulos : [moduloBase];
  }
  var n = parseInt(periodoVal) || 1;
  if (n === 1) return [moduloBase];
  var idx = MODULOS_CLASE.findIndex(function(m) { return m.id === moduloBase; });
  if (idx < 0) return [moduloBase];
  return MODULOS_CLASE.slice(idx, idx + n).map(function(m) { return m.id; });
}

// ── Guardar reserva ──────────────────────────────────────────
function guardarReserva() {
  var lab       = document.getElementById('f-lab').value;
  var dia       = document.getElementById('f-dia').value;
  var modulo    = document.getElementById('f-modulo').value;
  var curso     = document.getElementById('f-curso').value.trim();
  var secuencia = document.getElementById('f-secuencia').value.trim();
  var orient    = document.getElementById('f-orient').value;
  var periodoEl = document.getElementById('f-periodo');
  var periodo   = periodoEl ? periodoEl.value : '1';

  var anualChk = document.querySelector('#modal-reserva #f-anual');
  var esAnual  = esDirectivo() && anualChk !== null && anualChk.checked;

  if (!lab || dia === '' || modulo === '' || !curso || !secuencia) {
    toast('Por favor completá todos los campos.', 'err');
    return;
  }

  var modulosAReservar = getModulosParaPeriodo(parseInt(modulo), periodo);

  // Semanas a cubrir: una sola, o ~40 si es reserva anual
  var semanaBase       = parseInt(semanaOffset, 10);
  var semanasAReservar = [semanaBase];
  if (esAnual) {
    semanasAReservar = [];
    for (var sw = semanaBase; sw < semanaBase + 40; sw++) semanasAReservar.push(sw);
  }

  // Validación de conflictos (solo para reserva puntual)
  if (!esAnual) {
    for (var mi = 0; mi < modulosAReservar.length; mi++) {
      var m = modulosAReservar[mi];
      var conflicto = RESERVAS.find(function(r) {
        return r.semanaOffset === semanaOffset && r.dia === parseInt(dia) && r.modulo === m && r.lab === lab;
      });
      if (conflicto) { toast('El módulo ' + getModulo(m).label + ' ya está reservado en esta semana.', 'warn'); return; }
      var solicPendiente = SOLICITUDES.find(function(s) {
        return s.semanaOffset === semanaOffset && s.dia === parseInt(dia) && s.modulo === m && s.lab === lab && s.estado === 'pendiente';
      });
      if (solicPendiente) { toast('El módulo ' + getModulo(m).label + ' ya tiene solicitud pendiente.', 'warn'); return; }
    }
  }

  if (esDirectivo()) {
    // Directivo: crea reservas directamente (omite slots ya ocupados en modo anual)
    var totalCreadas = 0;
    semanasAReservar.forEach(function(sem) {
      modulosAReservar.forEach(function(m) {
        var yaExiste = RESERVAS.find(function(r) {
          return r.semanaOffset === sem && r.dia === parseInt(dia) && r.modulo === m && r.lab === lab;
        });
        if (yaExiste) return;
        nextId++;
        RESERVAS.push({
          id:           nextId,
          semanaOffset: parseInt(sem, 10),
          dia:          parseInt(dia, 10),
          modulo:       m,
          lab:          lab,
          curso:        curso,
          orient:       orient,
          profeId:      esAnual ? 'institucional' : (esDirectivo() && document.getElementById('f-profe').value ? parseInt(document.getElementById('f-profe').value) : getCurrentProfId()),
          secuencia:    secuencia,
          cicloClases:  1,
          renovaciones: 0,
          anual:        esAnual,
        });
        totalCreadas++;
      });
    });

    try {
      saveDB();
    } catch (e) {
      toast('Error al guardar: almacenamiento lleno. Intentá exportar y limpiar la BD.', 'err');
      console.error('[guardarReserva] saveDB falló:', e);
      return;
    }

    cerrarModal('modal-reserva');
    toast(
      esAnual
        ? 'Reserva anual creada: ' + totalCreadas + ' entradas para ~40 semanas.'
        : 'Reserva creada (' + totalCreadas + ' módulo' + (totalCreadas > 1 ? 's' : '') + ').',
      'ok'
    );

  } else {
    // Profesor: crea solicitudes pendientes de aprobación
    modulosAReservar.forEach(function(m) {
      nextId++;
      SOLICITUDES.push({
        id:               nextId,
        semanaOffset:     semanaOffset,
        dia:              parseInt(dia),
        modulo:           m,
        lab:              lab,
        curso:            curso,
        orient:           orient,
        profeId:          getCurrentProfId(),
        secuencia:        secuencia,
        cicloClases:      1,
        estado:           'pendiente',
        esRenovacion:     false,
        renovacionNum:    0,
        anual:            false,
      });
    });
    cerrarModal('modal-reserva');
    saveDB();
    toast('Solicitud enviada (' + modulosAReservar.length + ' módulo' + (modulosAReservar.length > 1 ? 's' : '') + ').', 'info');
  }

  renderAll();
}

// ── Modal de detalle de reserva ──────────────────────────────
function verDetalle(reservaId) {
  var r = RESERVAS.find(function(x) { return x.id === reservaId; });
  if (!r) return;

  var p     = getProfe(r.profeId);
  var ori   = ORIENTACIONES[r.orient];
  var fecha = getDiaDate(r.semanaOffset, r.dia);
  var mod   = getModulo(r.modulo);
  var pct   = (r.cicloClases / 3) * 100;
  var barClass = r.cicloClases === 3 ? 'danger' : r.cicloClases === 2 ? 'warn' : 'ok';

  var body = document.getElementById('modal-detalle-body');
  if (body) {
    body.innerHTML =
      '<div class="detail-row"><div class="detail-label">Docente</div><div class="detail-value">Prof. ' + p.apellido + ', ' + p.nombre + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Laboratorio</div><div class="detail-value">' + getLab(r.lab).nombre + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Fecha / Módulo</div><div class="detail-value">' + DIAS_LARGO[r.dia] + ' ' + formatFecha(fecha) + ' · ' + mod.label + ' (' + mod.inicio + '–' + mod.fin + ')</div></div>' +
      '<div class="detail-row"><div class="detail-label">Curso</div><div class="detail-value">' + r.curso + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Orientación</div><div class="detail-value"><span class="orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></div></div>' +
      '<div class="detail-row"><div class="detail-label">Secuencia</div><div class="detail-value" style="font-style:italic;color:var(--muted);">"' + r.secuencia + '"</div></div>' +
      '<div style="margin-top:14px;">' +
        '<div class="ciclo-bar-label">' +
          '<span style="font-size:12px;font-weight:700;">Ciclo didáctico</span>' +
          '<span style="font-size:11px;color:var(--muted);">Clase ' + r.cicloClases + ' de 3' +
            (r.renovaciones ? '&nbsp;&nbsp;<span style="font-weight:700;color:var(--navy);">Renovación ' + r.renovaciones + '/1</span>' : '') +
          '</span>' +
        '</div>' +
        '<div class="ciclo-bar"><div class="ciclo-bar-fill ' + barClass + '" style="width:' + pct + '%"></div></div>' +
      '</div>';
  }

  var footer = document.getElementById('modal-detalle-footer');
  if (footer) {
    var isOwn    = esDirectivo() || r.profeId === getCurrentProfId();
    var renovBtn = '';
    if (isOwn && r.cicloClases >= 3 && esDirectivo()) {
      var renov = r.renovaciones || 0;
      renovBtn = renov >= 1
        ? '<button class="btn-ok" onclick="cerrarModal(\'modal-detalle\');renovarReserva(' + r.id + ')">🔄 Nueva reserva</button>'
        : '<button class="btn-ok" onclick="renovarReserva(' + r.id + ');cerrarModal(\'modal-detalle\')">↻ Solicitar renovación</button>';
    }
    footer.innerHTML =
      '<button class="btn-cancel" onclick="cerrarModal(\'modal-detalle\')">Cerrar</button>' +
      renovBtn +
      (isOwn ? '<button class="btn-ok" style="background:var(--navy-light);" onclick="cerrarModal(\'modal-detalle\');editarReserva(' + r.id + ')">✎ Editar</button>' : '') +
      (isOwn ? '<button class="btn-danger" onclick="cerrarModal(\'modal-detalle\');cancelarReserva(' + r.id + ')">Cancelar reserva</button>' : '');
  }

  abrirModal('modal-detalle');
}

// ── Modal de detalle de solicitud (vista admin) ──────────────
function verDetalleSolicitud(solId) {
  var s = SOLICITUDES.find(function(x) { return x.id === solId; });
  if (!s) return;

  var p     = getProfe(s.profeId);
  var ori   = ORIENTACIONES[s.orient];
  var fecha = getDiaDate(s.semanaOffset, s.dia);
  var mod   = getModulo(s.modulo);

  var body = document.getElementById('modal-detalle-body');
  if (body) {
    body.innerHTML =
      '<div class="pending-alert" role="status">⏳ ' +
        (s.esRenovacion
          ? 'Solicitud de <strong>renovación semana ' + s.renovacionNum + '/1</strong> — pendiente de aprobación.'
          : 'Esta solicitud está <strong>pendiente de aprobación</strong>.') +
      '</div>' +
      '<div class="detail-row"><div class="detail-label">Docente</div><div class="detail-value">Prof. ' + p.apellido + ', ' + p.nombre + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Laboratorio</div><div class="detail-value">' + getLab(s.lab).nombre + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Fecha / Módulo</div><div class="detail-value">' + DIAS_LARGO[s.dia] + ' ' + formatFecha(fecha) + ' · ' + mod.label + ' (' + mod.inicio + '–' + mod.fin + ')</div></div>' +
      '<div class="detail-row"><div class="detail-label">Curso</div><div class="detail-value">' + s.curso + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Orientación</div><div class="detail-value"><span class="orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></div></div>' +
      '<div class="detail-row"><div class="detail-label">Secuencia</div><div class="detail-value" style="font-style:italic;color:var(--muted);">"' + s.secuencia + '"</div></div>';
  }

  var footer = document.getElementById('modal-detalle-footer');
  if (footer) {
    footer.innerHTML =
      '<button class="btn-cancel" onclick="cerrarModal(\'modal-detalle\')">Cerrar</button>' +
      '<button class="btn-danger" onclick="cerrarModal(\'modal-detalle\');rechazarSolicitud(' + s.id + ')">✕ Rechazar</button>' +
      '<button class="btn-ok" onclick="cerrarModal(\'modal-detalle\');aceptarSolicitud(' + s.id + ')">✓ Aprobar</button>';
  }

  abrirModal('modal-detalle');
}

// ── Aprobar solicitud ─────────────────────────────────────────
function aceptarSolicitud(solId) {
  if (modoUsuario !== 'admin') { toast('Solo el directivo puede aprobar solicitudes.', 'err'); return; }

  var s = SOLICITUDES.find(function(x) { return x.id === solId; });
  if (!s) return;

  var conflicto = RESERVAS.find(function(r) {
    return r.semanaOffset === s.semanaOffset && r.dia === s.dia && r.modulo === s.modulo && r.lab === s.lab;
  });
  if (conflicto) { toast('Ese turno fue ocupado mientras estaba pendiente.', 'warn'); return; }

  if (s.esRenovacion && s.reservaOriginalId) {
    // Renovación: reiniciar ciclo en la reserva original
    var rOrig = RESERVAS.find(function(x) { return x.id === s.reservaOriginalId; });
    if (rOrig) {
      rOrig.cicloClases  = 1;
      rOrig.renovaciones = (rOrig.renovaciones || 0) + 1;
    } else {
      nextId++;
      RESERVAS.push({
        id: nextId, semanaOffset: s.semanaOffset, dia: s.dia, modulo: s.modulo, lab: s.lab,
        curso: s.curso, orient: s.orient, profeId: s.profeId, secuencia: s.secuencia,
        cicloClases: 1, renovaciones: s.renovacionNum || 1,
      });
    }
    SOLICITUDES = SOLICITUDES.filter(function(x) { return x.id !== solId; });
    saveDB();
    toast('Renovación semana ' + s.renovacionNum + '/1 aprobada.', 'ok');
    renderAll();
    return;
  }

  // Solicitud nueva → crear reserva
  // Validar conflicto con nuevo módulo antes de aprobar
  if (typeof validarConflicto === 'function') {
    var conf = validarConflicto(s.lab, s.dia, s.modulo, s.semanaOffset, s.profeId, null);
    if (conf) {
      toast('Conflicto: ' + conf.mensaje, 'err');
      if (typeof mostrarAlertaConflicto === 'function') mostrarAlertaConflicto(conf, s);
      return;
    }
  }
  nextId++;
  var nuevaReserva = {
    id: nextId, semanaOffset: s.semanaOffset, dia: s.dia, modulo: s.modulo, lab: s.lab,
    curso: s.curso, orient: s.orient, profeId: s.profeId, secuencia: s.secuencia,
    cicloClases: 1, renovaciones: 0,
  };
  RESERVAS.push(nuevaReserva);
  SOLICITUDES = SOLICITUDES.filter(function(x) { return x.id !== solId; });
  saveDB();
  // Notificar al docente
  if (typeof notifSolicitudAprobada === 'function') notifSolicitudAprobada(s);
  // Emitir sync
  if (typeof emitirSync === 'function') emitirSync('reserva_aprobada', { reservaId: nuevaReserva.id, lab: s.lab });
  toast('Solicitud aprobada. Reserva confirmada.', 'ok');
  renderAll();
}

// ── Rechazar solicitud ────────────────────────────────────────
function rechazarSolicitud(solId) {
  if (modoUsuario !== 'admin') { toast('Solo el directivo puede rechazar solicitudes.', 'err'); return; }

  var s = SOLICITUDES.find(function(x) { return x.id === solId; });
  if (!s) return;

  var p = getProfe(s.profeId);
  confirmar('¿Rechazar la solicitud de <strong>Prof. ' + p.apellido + '</strong> — ' + s.curso + '?', function() {
    SOLICITUDES = SOLICITUDES.filter(function(x) { return x.id !== solId; });
    saveDB();
    if (typeof notifSolicitudRechazada === 'function') notifSolicitudRechazada(s, '');
    if (typeof emitirSync === 'function') emitirSync('solicitud_rechazada', { solicitudId: solId });
    toast('Solicitud rechazada.', 'info');
    renderAll();
  });
}

// ── Editar reserva existente ─────────────────────────────────
// Abre el modal de edición con los datos de la reserva pre-cargados.
// El profe solo puede editar sus propias reservas; el admin puede editar cualquiera.
function editarReserva(reservaId) {
  var r = RESERVAS.find(function(x) { return x.id === reservaId; });
  if (!r) return;

  var isOwn = esDirectivo() || r.profeId === getCurrentProfId();
  if (!isOwn) { toast('No tenés permiso para editar esta reserva.', 'err'); return; }

  // Llenar los campos del modal de edición
  document.getElementById('edit-reserva-id').value     = reservaId;
  document.getElementById('edit-curso').value          = r.curso;
  document.getElementById('edit-secuencia').value      = r.secuencia;
  document.getElementById('edit-orient').value         = r.orient;

  // Info de contexto (solo lectura)
  var mod   = getModulo(r.modulo);
  var lab   = getLab(r.lab);
  var p     = getProfe(r.profeId);
  document.getElementById('edit-info-contexto').innerHTML =
    '<strong>' + lab.nombre + '</strong> · ' + DIAS_LARGO[r.dia] + ' · ' + mod.label +
    ' (' + mod.inicio + '–' + mod.fin + ')' +
    (esDirectivo() ? ' · Prof. ' + p.apellido : '');

  // Selector de docente (solo para directivos)
  poblarSelectsReserva(); // poblar opciones del <select>
  var editProfeWrap = document.getElementById('edit-profe-wrap');
  var editProfeSel  = document.getElementById('edit-profe');
  if (editProfeWrap) editProfeWrap.style.display = esDirectivo() ? 'block' : 'none';
  if (editProfeSel)  editProfeSel.value = r.profeId;

  // Selector de scope: solo para directivos que editan reservas con ciclo > 1 o anuales
  var scopeWrap = document.getElementById('edit-scope-wrap');
  if (scopeWrap) {
    var showScope = esDirectivo() && (r.anual || r.cicloClases > 1);
    scopeWrap.style.display = showScope ? 'block' : 'none';
    if (showScope) {
      var optSiguientes = document.getElementById('opt-siguientes');
      var optAnual      = document.getElementById('opt-anual');
      if (optSiguientes) optSiguientes.style.display = r.anual ? 'none' : 'block';
      if (optAnual)      optAnual.style.display      = r.anual ? 'block' : 'none';
      var scopeSel = document.getElementById('edit-scope');
      if (scopeSel) scopeSel.value = 'puntual'; // default
    }
  }

  abrirModal('modal-editar-reserva');
}

// Guarda los cambios del modal de edición.
// El scope ('puntual' o 'siguientes') determina cuántas reservas se actualizan.
function guardarEdicionReserva() {
  var reservaId = parseInt(document.getElementById('edit-reserva-id').value);
  var r = RESERVAS.find(function(x) { return x.id === reservaId; });
  if (!r) return;

  var nuevoCurso     = document.getElementById('edit-curso').value.trim();
  var nuevaSecuencia = document.getElementById('edit-secuencia').value.trim();
  var nuevaOrient    = document.getElementById('edit-orient').value;
  var scopeSel       = document.getElementById('edit-scope');
  var scope          = scopeSel ? scopeSel.value : 'puntual';

  // Docente asignado (solo directivos pueden cambiarlo)
  var editProfeSel = document.getElementById('edit-profe');
  var nuevoProfeId = (esDirectivo() && editProfeSel && editProfeSel.value)
    ? parseInt(editProfeSel.value)
    : null;

  if (!nuevoCurso || !nuevaSecuencia) {
    toast('Completá el curso y la secuencia.', 'err');
    return;
  }

  // Buscar todas las reservas "hermanas" del mismo bloque horario
  // (mismo día, lab, profe, semana y curso original → forman un bloque multi-hora)
  // Guardar valores originales ANTES de mutar (r puede ser parte del array)
  var cursoOriginal   = r.curso;
  var profeIdOriginal = r.profeId;

  if (scope === 'anual' && esDirectivo()) {
    // Actualiza esta reserva, sus hermanas de bloque, y todas las anuales del año
    var actualizadas = 0;
    RESERVAS.forEach(function(x) {
      if (
        x.lab     === r.lab     &&
        x.dia     === r.dia     &&
        x.profeId === profeIdOriginal &&
        x.curso   === cursoOriginal &&
        x.anual   === true
      ) {
        x.curso     = nuevoCurso;
        x.secuencia = nuevaSecuencia;
        x.orient    = nuevaOrient;
        if (nuevoProfeId) x.profeId = nuevoProfeId;
        actualizadas++;
      }
    });
    saveDB();
    cerrarModal('modal-editar-reserva');
    toast(actualizadas + ' reserva(s) anual(es) actualizada(s).', 'ok');
  } else if (scope === 'siguientes' && esDirectivo()) {
    // Actualiza esta reserva, sus hermanas de bloque, y todas las futuras del mismo lab+dia+profe
    var actualizadas = 0;
    RESERVAS.forEach(function(x) {
      if (
        x.lab     === r.lab     &&
        x.dia     === r.dia     &&
        x.profeId === profeIdOriginal &&
        x.curso   === cursoOriginal &&
        x.semanaOffset >= r.semanaOffset
      ) {
        x.curso     = nuevoCurso;
        x.secuencia = nuevaSecuencia;
        x.orient    = nuevaOrient;
        if (nuevoProfeId) x.profeId = nuevoProfeId;
        actualizadas++;
      }
    });
    saveDB();
    cerrarModal('modal-editar-reserva');
    toast(actualizadas + ' reserva(s) actualizada(s).', 'ok');
  } else {
    // Puntual: actualiza todas las horas del mismo bloque en esta semana
    var actualizadas = 0;
    RESERVAS.forEach(function(x) {
      if (
        x.semanaOffset === r.semanaOffset &&
        x.dia          === r.dia          &&
        x.lab          === r.lab          &&
        x.profeId      === profeIdOriginal &&
        x.curso        === cursoOriginal
      ) {
        x.curso     = nuevoCurso;
        x.secuencia = nuevaSecuencia;
        x.orient    = nuevaOrient;
        if (nuevoProfeId) x.profeId = nuevoProfeId;
        actualizadas++;
      }
    });
    saveDB();
    cerrarModal('modal-editar-reserva');
    toast(actualizadas + ' módulo(s) actualizado(s).', 'ok');
  }

  renderAll();
}
