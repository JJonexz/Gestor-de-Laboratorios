// ============================================================
// db-override.js — Overrides que conectan los módulos de UI con la API SQL
//
// Se carga DESPUES de todos los demas JS.
// Reemplaza las funciones que mutan arrays + llaman saveDB()
// con versiones que persisten en la API y actualizan el array local.
// ============================================================

// ── guardarReserva ───────────────────────────────────────────
var _guardarReserva_original = guardarReserva;
guardarReserva = function() {
  var lab      = document.getElementById('f-lab').value;
  var dia      = document.getElementById('f-dia').value;
  var modulo   = document.getElementById('f-modulo').value;
  var secuencia = document.getElementById('f-secuencia').value.trim();
  var orient   = UIHelper.getOrientValues('f-orient-group');

  // ── Leer curso y materia desde cupof seleccionado (BDD) o campos manuales ──
  var fCupof = document.getElementById('f-cupof');
  var cupofId = fCupof && fCupof.value ? parseInt(fCupof.value) : null;
  var curso = '', materia = '';
  if (cupofId && fCupof.selectedIndex > 0) {
    var opt = fCupof.options[fCupof.selectedIndex];
    curso   = opt.getAttribute('data-curso') || document.getElementById('f-curso').value.trim();
    materia = opt.getAttribute('data-materia') || (document.getElementById('f-materia') ? document.getElementById('f-materia').value.trim() : '');
  } else {
    curso   = document.getElementById('f-curso').value.trim();
    materia = document.getElementById('f-materia') ? document.getElementById('f-materia').value.trim() : '';
  }

  if (materia) secuencia = '[' + materia + '] ' + secuencia;
  var periodoEl = document.getElementById('f-periodo');
  var periodo  = periodoEl ? periodoEl.value : '1';
  var anualChk = document.querySelector('#modal-reserva #f-anual');
  var esAnual  = esDirectivo() && anualChk !== null && anualChk.checked;

  if (!lab || dia === '' || modulo === '' || !curso || !secuencia) {
    toast('Por favor completa todos los campos.', 'err'); return;
  }

  var diaNum = parseInt(dia, 10);
  var modulosAReservar = getModulosParaPeriodo(parseInt(modulo), periodo);
  var semanaBase = parseInt(semanaOffset, 10);

  // ── Semanas a reservar ────────────────────────────────────
  // Anual: hasta el fin del ciclo lectivo (ultimo viernes de diciembre),
  //        salteando feriados y recesos. Antes eran 40 semanas fijas,
  //        que se pasaban del ciclo.
  // Normal: 1 a 3 semanas consecutivas segun #f-semanas.
  var semanasAReservar;
  if (esAnual) {
    semanasAReservar = getSemanasHastaFinCiclo(semanaBase).filter(function(sem) {
      return typeof esDiaHabilitado !== 'function' || esDiaHabilitado(sem, diaNum);
    });
  } else {
    var fSemanas = document.getElementById('f-semanas');
    var cantSemanas = fSemanas ? parseInt(fSemanas.value, 10) : 1;
    if (isNaN(cantSemanas) || cantSemanas < 1) cantSemanas = 1;
    if (cantSemanas > MAX_SEMANAS_SEGUIDAS) cantSemanas = MAX_SEMANAS_SEGUIDAS;
    semanasAReservar = [];
    for (var sw = semanaBase; sw < semanaBase + cantSemanas; sw++) semanasAReservar.push(sw);
  }

  if (!semanasAReservar.length) {
    toast('No hay semanas habilitadas para reservar en el ciclo lectivo actual.', 'warn');
    return;
  }

  var profeSel = document.getElementById('f-profe');
  var profeId = esAnual
    ? 'institucional'  // Reservas anuales siempre son institucionales
    : (esDirectivo() && profeSel && profeSel.value)
      ? parseInt(profeSel.value)
      : (window.SESSION ? window.SESSION.profeId : getCurrentProfId());

  // ── Regla de 3 semanas seguidas + 1 de espera ─────────────
  if (!esAnual) {
    var motivo = motivoBloqueoLote(profeId, lab, diaNum, modulosAReservar, semanasAReservar);
    if (motivo) { toast(motivo, 'warn'); return; }
  }

  // ── Cupo del salon (solo para reservas puntuales) ─────────
  if (!esAnual) {
    var _maxGrupos = getLabMaxGrupos(lab);
    for (var mi = 0; mi < modulosAReservar.length; mi++) {
      var m = modulosAReservar[mi];
      for (var si = 0; si < semanasAReservar.length; si++) {
        var sem = semanasAReservar[si];
        var enSlot = RESERVAS.filter(function(r) {
          return r.semanaOffset === sem && r.dia === diaNum && r.modulo === m && r.lab === lab;
        }).length;
        var pend = SOLICITUDES.filter(function(s) {
          return s.semanaOffset === sem && s.dia === diaNum && s.modulo === m && s.lab === lab && s.estado === 'pendiente';
        }).length;
        if (enSlot + pend >= _maxGrupos) {
          toast('El modulo ' + getModulo(m).label + ' ya tiene ' + _maxGrupos + ' grupo(s) en la semana del ' +
                formatFecha(getDiaDate(sem, diaNum)) + '.', 'warn');
          return;
        }
      }
    }
  }

  var grupoIdEl = document.getElementById('reserva-grupo');
  var grupoId   = grupoIdEl && grupoIdEl.value !== '' ? parseInt(grupoIdEl.value) : null;

  // ── Armar el lote ─────────────────────────────────────────
  function armarLote() {
    var lote = [];
    semanasAReservar.forEach(function(sem, idxSemana) {
      modulosAReservar.forEach(function(m) {
        // En modo anual salteamos los slots que ya estan completos
        if (esAnual) {
          var ocupados = RESERVAS.filter(function(r) {
            return r.semanaOffset === sem && r.dia === diaNum && r.modulo === m && r.lab === lab;
          }).length;
          if (ocupados >= getLabMaxGrupos(lab)) return;
        }
        lote.push({
          semanaOffset: sem, dia: diaNum, modulo: m, lab: lab, curso: curso,
          orient: orient, profeId: profeId, secuencia: secuencia,
          // cicloClases numera la clase dentro del ciclo de 3 semanas.
          // Antes quedaba fijo en 1 y por eso "Clase X/3" nunca avanzaba.
          cicloClases: esAnual ? 1 : (idxSemana + 1),
          renovaciones: 0, anual: esAnual ? 1 : 0,
          grupoId: grupoId, cupofId: cupofId
        });
      });
    });
    return lote;
  }

  function enviarLote(lote) {
    cerrarModal('modal-reserva');
    dbCrearReservasLote(lote, function(nuevas) {
      toast(esAnual
        ? 'Reserva anual creada: ' + nuevas.length + ' entradas hasta el ' + formatFecha(getFinCicloLectivo(getSemanaStart(semanaBase))) + '.'
        : 'Reserva creada (' + nuevas.length + ' entrada' + (nuevas.length > 1 ? 's' : '') + ').', 'ok');
      renderAll();
    }, function(e) {
      toast('Error al guardar: ' + e.message, 'err');
    });
  }

  if (esDirectivo()) {
    var lote = armarLote();
    if (!lote.length) { toast('Todos los turnos de esa serie ya estan ocupados.', 'warn'); return; }

    if (esAnual) {
      var finCiclo = getFinCicloLectivo(getSemanaStart(semanaBase));
      confirmar(
        'Se crearan <strong>' + lote.length + '</strong> reserva(s) en ' + getLab(lab).nombre +
        ', todos los <strong>' + DIAS_LARGO[diaNum] + '</strong>, hasta el fin del ciclo lectivo (' +
        finCiclo.getDate() + '/' + (finCiclo.getMonth() + 1) + '/' + finCiclo.getFullYear() + ').<br>' +
        '<small>Se saltean feriados, recesos y los turnos ya ocupados.</small>',
        function() { enviarLote(lote); }
      );
      return;
    }
    enviarLote(lote);

  } else {
    // Profesor: crea solicitudes pendientes de aprobacion.
    // Antes esta rama ignoraba las semanas y creaba una sola.
    cerrarModal('modal-reserva');
    var promises2 = [];
    semanasAReservar.forEach(function(sem, idxSemana) {
      modulosAReservar.forEach(function(m) {
        promises2.push(apiPost('solicitudes', {
          semanaOffset: sem, dia: diaNum, modulo: m, lab: lab, curso: curso,
          orient: orient, profeId: (window.SESSION ? window.SESSION.profeId : getCurrentProfId()),
          secuencia: secuencia, cicloClases: (idxSemana + 1), estado: 'pendiente',
          esRenovacion: 0, renovacionNum: 0, grupoId: grupoId, cupofId: cupofId
        }));
      });
    });
    Promise.all(promises2).then(function(nuevas) {
      nuevas.forEach(function(s) { SOLICITUDES.push(s); });
      var msgSem = semanasAReservar.length > 1 ? ' para ' + semanasAReservar.length + ' semanas' : '';
      toast('Solicitud enviada (' + nuevas.length + ' modulo' + (nuevas.length > 1 ? 's' : '') + msgSem + ').', 'info');
      renderAll();
      if (typeof emitirSync === 'function') {
        emitirSync('solicitud_creada', {
          cantidad: nuevas.length,
          profeId: (window.SESSION ? window.SESSION.profeId : null),
          lab: lab,
          dia: diaNum
        });
      }
    }).catch(function(e) { toast('Error al enviar solicitud: ' + e.message, 'err'); });
  }
};

// ── aceptarSolicitud ─────────────────────────────────────────
aceptarSolicitud = function(solId) {
  if (modoUsuario !== 'admin') { toast('Solo el directivo puede aprobar solicitudes.', 'err'); return; }
  var s = SOLICITUDES.find(function(x) { return x.id === solId; });
  if (!s) return;
  var labAcept  = getLab(s.lab);
  var maxAcept = getLabMaxGrupos(s.lab);
  var enSlotAcept = RESERVAS.filter(function(r) {
    return r.semanaOffset === s.semanaOffset && r.dia === s.dia && r.modulo === s.modulo && r.lab === s.lab;
  });
  if (enSlotAcept.length >= maxAcept) { toast('Ese turno ya alcanzó el máximo de ' + maxAcept + ' grupo(s).', 'warn'); return; }

  if (s.esRenovacion && s.reservaOriginalId) {
    var rOrig = RESERVAS.find(function(x) { return x.id === s.reservaOriginalId; });
    if (rOrig) {
      var updData = { cicloClases: 1, renovaciones: (rOrig.renovaciones || 0) + 1 };
      apiPut('reservas/' + rOrig.id, Object.assign({}, rOrig, updData)).then(function(actualizada) {
        Object.assign(rOrig, updData);
        return apiDelete('solicitudes/' + solId);
      }).then(function() {
        SOLICITUDES = SOLICITUDES.filter(function(x) { return x.id !== solId; });
        toast('Renovacion aprobada.', 'ok');
        renderAll();
      }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
    } else {
      apiPost('reservas', {
        semanaOffset: s.semanaOffset, dia: s.dia, modulo: s.modulo, lab: s.lab,
        curso: s.curso, orient: s.orient, profeId: s.profeId, secuencia: s.secuencia,
        cicloClases: 1, renovaciones: s.renovacionNum || 1, anual: 0,
        grupoId: s.grupoId || null, cupofId: s.cupofId || null
      }).then(function(nueva) {
        RESERVAS.push(nueva);
        return apiDelete('solicitudes/' + solId);
      }).then(function() {
        SOLICITUDES = SOLICITUDES.filter(function(x) { return x.id !== solId; });
        toast('Renovacion aprobada.', 'ok');
        renderAll();
      }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
    }
    return;
  }

  apiPost('reservas', {
    semanaOffset: s.semanaOffset, dia: s.dia, modulo: s.modulo, lab: s.lab,
    curso: s.curso, orient: s.orient, profeId: s.profeId, secuencia: s.secuencia,
    // Conservar el numero de clase dentro del ciclo de 3 semanas.
    cicloClases: s.cicloClases || 1, renovaciones: 0, anual: 0,
    grupoId: s.grupoId || null, cupofId: s.cupofId || null
  }).then(function(nueva) {
    RESERVAS.push(nueva);
    if (typeof notifSolicitudAprobada === 'function') notifSolicitudAprobada(s);
    return apiDelete('solicitudes/' + solId);
  }).then(function() {
    SOLICITUDES = SOLICITUDES.filter(function(x) { return x.id !== solId; });
    toast('Solicitud aprobada. Reserva confirmada.', 'ok');
    renderAll();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

// ── rechazarSolicitud ────────────────────────────────────────
rechazarSolicitud = function(solId) {
  if (modoUsuario !== 'admin') { toast('Solo el directivo puede rechazar solicitudes.', 'err'); return; }
  var s = SOLICITUDES.find(function(x) { return x.id === solId; });
  if (!s) return;
  var p = getProfe(s.profeId);
  confirmar('Rechazar la solicitud de Prof. ' + p.apellido + ' - ' + s.curso + '?', function() {
    apiDelete('solicitudes/' + solId).then(function() {
      SOLICITUDES = SOLICITUDES.filter(function(x) { return x.id !== solId; });
      if (typeof notifSolicitudRechazada === 'function') notifSolicitudRechazada(s, '');
      toast('Solicitud rechazada.', 'info');
      renderAll();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
  });
};

// ── ejecutarCancelacion (cancelar reserva) ───────────────────
ejecutarCancelacion = function(id) {
  var r = RESERVAS.find(function(x) { return x.id === id; });
  if (!r) return;
  apiDelete('reservas/' + id).then(function() {
    RESERVAS = RESERVAS.filter(function(x) { return x.id !== id; });
    toast('Reserva cancelada.', 'info');
    var waiting = LISTA_ESPERA.filter(function(e) {
      return e.lab === r.lab && e.dia === r.dia && e.modulo === r.modulo;
    });
    if (waiting.length) setTimeout(function() {
      toast('Hay ' + waiting.length + ' docente(s) en espera para ese turno.', 'warn');
    }, 400);
    renderAll();
  }).catch(function(e) { toast('Error al cancelar: ' + e.message, 'err'); });
};

// ── cancelarSerieAnual ───────────────────────────────────────
cancelarSerieAnual = function(reservaBase) {
  apiDelete('reservas/0/serie', {
    lab: reservaBase.lab, dia: reservaBase.dia,
    profeId: reservaBase.profeId, curso: reservaBase.curso
  }).then(function(res) {
    var total = RESERVAS.length;
    RESERVAS = RESERVAS.filter(function(x) {
      return !(String(x.lab) === String(reservaBase.lab) && x.dia === reservaBase.dia &&
               String(x.profeId) === String(reservaBase.profeId) &&
               x.curso === reservaBase.curso && Number(x.anual) === 1);
    });
    invalidarIndices();
    // El servidor informa cuantas borro de verdad: antes el DELETE casteaba
    // profeId a int ('institucional' -> 0) y no borraba nada, pero la UI las
    // sacaba igual del array y "reaparecian" al recargar.
    var borradas = (res && res.deleted !== undefined) ? res.deleted : (total - RESERVAS.length);
    toast('Se eliminaron ' + borradas + ' reserva(s) anuales.', 'ok');
    renderAll();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

// ── guardarEdicionReserva ───────────────────────────
guardarEdicionReserva = function() {
  // #edit-reserva-id guarda un array JSON de ids (reservas.js), porque una
  // "reserva" en pantalla puede ser un bloque de varios modulos.
  // Antes se leia con parseInt("[402,403]") -> NaN, la busqueda fallaba y la
  // funcion salia con un return silencioso: editar no hacia absolutamente nada.
  var idVal = document.getElementById('edit-reserva-id').value;
  var ids = [];
  try { ids = JSON.parse(idVal); } catch (e) { ids = [parseInt(idVal, 10)]; }
  if (!Array.isArray(ids)) ids = [ids];
  ids = ids.filter(function(n) { return !isNaN(n); });
  if (!ids.length) { toast('No se pudo identificar la reserva a editar.', 'err'); return; }

  var r = RESERVAS.find(function(x) { return x.id === ids[0]; });
  if (!r) { toast('No se encontro la reserva a editar.', 'err'); return; }

  var nuevoCurso    = document.getElementById('edit-curso').value.trim();
  var nuevaSecuencia = document.getElementById('edit-secuencia').value.trim();
  var nuevaOrient   = UIHelper.getOrientValues('edit-orient-group');
  var scopeSel      = document.getElementById('edit-scope');
  var scope         = scopeSel ? scopeSel.value : 'puntual';
  var editProfeSel  = document.getElementById('edit-profe');
  var nuevoProfeId  = (esDirectivo() && editProfeSel && editProfeSel.value)
    ? parseInt(editProfeSel.value) : null;
  var editGrupoEl   = document.getElementById('reserva-grupo');
  var nuevoGrupoId  = editGrupoEl && editGrupoEl.value !== '' ? parseInt(editGrupoEl.value) : null;

  if (!nuevoCurso || !nuevaSecuencia) { toast('Completa el curso y la secuencia.', 'err'); return; }

  var cursoOriginal   = r.curso;
  var profeIdOriginal = r.profeId;

  // Solo un directivo puede propagar mas alla de la reserva editada.
  if (!esDirectivo()) scope = 'puntual';

  // Scopes que propagan ('anual' y 'siguientes'): el UPDATE se resuelve en el
  // servidor, porque el cliente solo tiene en memoria una ventana de semanas y
  // no podria alcanzar al resto de la serie.
  // La serie se identifica por lab + dia + docente + curso, desde esta semana
  // en adelante; las semanas ya pasadas quedan como historico.
  if (scope === 'anual' || scope === 'siguientes') {
    var match = {
      lab: r.lab, dia: r.dia, profeId: profeIdOriginal, curso: cursoOriginal,
      desdeSemana: r.semanaOffset
    };
    // `anual` viaja como 0/1: en la BD es TINYINT, nunca booleano.
    if (scope === 'anual') match.anual = 1;
    var set = { curso: nuevoCurso, secuencia: nuevaSecuencia, orient: nuevaOrient };
    if (nuevoProfeId) set.profeId = nuevoProfeId;
    if (nuevoGrupoId !== null) set.grupoId = nuevoGrupoId;

    dbEditarSerie(match, set, function(actualizadas) {
      cerrarModal('modal-editar-reserva');
      toast(actualizadas + ' reserva(s) de la serie actualizada(s), de esta semana en adelante.', 'ok');
      renderAll();
    }, function(e) {
      toast('Error al editar la serie: ' + e.message, 'err');
    });
    return;
  }

  // Puntual: exactamente el bloque de modulos que se abrio para editar.
  // `ids` ya trae todas las horas del bloque (reservas.js lo guarda como
  // array JSON en #edit-reserva-id).
  var afectadas = RESERVAS.filter(function(x) { return ids.indexOf(x.id) >= 0; });

  if (!afectadas.length) { toast('No hay reservas para actualizar.', 'warn'); return; }

  var lote = afectadas.map(function(x) {
    var upd = Object.assign({}, x, {
      curso: nuevoCurso,
      secuencia: nuevaSecuencia,
      orient: nuevaOrient,
      grupoId: nuevoGrupoId !== null ? nuevoGrupoId : (x.grupoId !== undefined ? x.grupoId : null)
    });
    if (nuevoProfeId) upd.profeId = nuevoProfeId;
    return upd;
  });

  // Una sola request para toda la serie (antes: hasta 40 PUT en paralelo).
  dbEditarReservasLote(lote, function(actualizadas) {
    cerrarModal('modal-editar-reserva');
    var extra = (scope === 'anual' || scope === 'siguientes')
      ? ' (esta semana y las siguientes)' : '';
    toast(actualizadas.length + ' reserva(s) actualizada(s)' + extra + '.', 'ok');
    renderAll();
  }, function(e) {
    toast('Error al editar: ' + e.message, 'err');
  });
};

// ── ejecutarReasignacion ───────────────────────────
// La version de reservas.js solo mutaba los objetos en memoria y llamaba a
// saveDB(), que en modo SQL es un no-op: la reasignacion se perdia al recargar.
ejecutarReasignacion = function() {
  var reservaId = parseInt(document.getElementById('reasignar-reserva-id').value, 10);
  var r = RESERVAS.find(function(x) { return x.id === reservaId; });
  if (!r) { toast('No se encontro la reserva a reasignar.', 'err'); return; }

  var nuevoLab = document.getElementById('reasignar-lab').value;
  var scope    = document.getElementById('reasignar-scope').value;
  if (!nuevoLab) { toast('Selecciona un laboratorio destino.', 'err'); return; }

  var labDestino = getLab(nuevoLab);
  var labOrigen  = getLab(r.lab);
  var aReasignar = obtenerReservasParaReasignar(r, scope);

  var maxDestino = getLabMaxGrupos(nuevoLab);
  var lote = [];
  var omitidas = 0;

  aReasignar.forEach(function(res) {
    var ocupados = RESERVAS.filter(function(x) {
      return x.id !== res.id &&
        x.semanaOffset === res.semanaOffset &&
        x.dia === res.dia &&
        x.modulo === res.modulo &&
        String(x.lab) === String(nuevoLab);
    }).length;
    if (ocupados >= maxDestino) { omitidas++; return; }
    lote.push(Object.assign({}, res, { lab: nuevoLab }));
  });

  // Serie anual: el cambio de laboratorio se resuelve en el servidor para
  // alcanzar todas las semanas, salteando los horarios ya ocupados en destino.
  if (scope === 'anual') {
    dbEditarSerie(
      { lab: r.lab, dia: r.dia, profeId: r.profeId, curso: r.curso, anual: 1, desdeSemana: r.semanaOffset },
      { lab: nuevoLab },
      function(actualizadas) {
        cerrarModal('modal-reasignar');
        toast(actualizadas + ' hora(s) reasignada(s) de ' + labOrigen.nombre + ' a ' + labDestino.nombre + '.', 'ok');
        renderAll();
      },
      function(e) { toast('Error al reasignar: ' + e.message, 'err'); }
    );
    return;
  }

  if (!lote.length) {
    toast('No se pudo reasignar: todos los horarios estan ocupados en ' + labDestino.nombre + '.', 'warn');
    return;
  }

  dbEditarReservasLote(lote, function(actualizadas) {
    cerrarModal('modal-reasignar');
    var msg = actualizadas.length + ' hora(s) reasignada(s) de ' + labOrigen.nombre + ' \u2192 ' + labDestino.nombre + '.';
    if (omitidas) msg += ' (' + omitidas + ' omitida(s) por conflicto)';
    toast(msg, 'ok');
    renderAll();
  }, function(e) {
    toast('Error al reasignar: ' + e.message, 'err');
  });
};

// ── guardarDocente ───────────────────────────────────────────
guardarDocente = function() {
  var apellido    = document.getElementById('doc-apellido').value.trim();
  var nombre      = document.getElementById('doc-nombre').value.trim();
  var materia     = document.getElementById('doc-materia').value.trim();
  var orientacion = UIHelper.getOrientValues('doc-orient-group');

  if (!apellido || !nombre || !materia) { toast('Completa todos los campos del docente.', 'err'); return; }

  var datos = { apellido: apellido, nombre: nombre, materia: materia, orientacion: orientacion };

  if (editDocenteId !== null) {
    apiPut('profesores/' + editDocenteId, datos).then(function(actualizado) {
      var idx = PROFESORES.findIndex(function(p) { return p.id === editDocenteId; });
      if (idx >= 0) PROFESORES[idx] = actualizado;
      cerrarModal('modal-docente');
      editDocenteId = null;
      toast('Docente actualizado.', 'ok');
      renderAdmin();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
  } else {
    apiPost('profesores', datos).then(function(nuevo) {
      PROFESORES.push(nuevo);
      cerrarModal('modal-docente');
      toast('Docente agregado.', 'ok');
      renderAdmin();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
  }
};

// ── eliminarDocente ──────────────────────────────────────────
eliminarDocente = function(id) {
  var p = PROFESORES.find(function(x) { return x.id === id; });
  if (!p) return;
  confirmar('Eliminar al Prof. ' + p.apellido + '? Se eliminaran sus reservas asociadas.', function() {
    apiDelete('profesores/' + id).then(function() {
      PROFESORES = PROFESORES.filter(function(x) { return x.id !== id; });
      RESERVAS   = RESERVAS.filter(function(r) { return r.profeId !== id; });
      toast('Docente eliminado.', 'info');
      renderAdmin();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
  });
};

// ── guardarLab ───────────────────────────────────────────────
guardarLab = function() {
  var nombre    = document.getElementById('lab-nombre').value.trim();
  var capacidad = parseInt(document.getElementById('lab-capacidad').value || '20');
  var notas     = document.getElementById('lab-notas').value.trim();
  var estado    = document.getElementById('lab-estado').value;

  if (!nombre) { toast('Ingresa el nombre del espacio.', 'err'); return; }

  // Si es un lab nuevo, generamos un ID basado en el nombre o correlativo si no hay campo ID
  var id = editLabId;
  if (!id) {
     id = String.fromCharCode(65 + LABS.length); // Fallback: A, B, C...
  }

  var maxGruposEl = document.getElementById('lab-max-grupos');
  var maxGrupos   = maxGruposEl ? parseInt(maxGruposEl.value || '1') : 1;
  // max_grupos NO va a la API — se persiste solo en runtime config
    setLabMaxGrupos(id, maxGrupos);
    var datos = { id: id, nombre: nombre, capacidad: capacidad, notas: notas, ocupado: estado === 'ocupado' ? 1 : 0 };

  if (editLabId !== null) {
    apiPut('labs/' + editLabId, datos).then(function(actualizado) {
      var idx = LABS.findIndex(function(l) { return l.id === editLabId; });
      if (idx >= 0) LABS[idx] = actualizado;
      cerrarModal('modal-lab');
      editLabId = null;
      toast('Laboratorio actualizado.', 'ok');
      renderAdmin();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
  } else {
    apiPost('labs', datos).then(function(nuevo) {
      LABS.push(nuevo);
      cerrarModal('modal-lab');
      toast('Laboratorio agregado.', 'ok');
      renderAdmin();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
  }
};

// ── eliminarLab ──────────────────────────────────────────────
eliminarLab = function(id) {
  var l = LABS.find(function(x) { return x.id === id; });
  if (!l) return;
  confirmar('Eliminar el laboratorio ' + l.nombre + '?', function() {
    apiDelete('labs/' + id).then(function() {
      LABS = LABS.filter(function(x) { return x.id !== id; });
      toast('Laboratorio eliminado.', 'info');
      renderAdmin();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
  });
};

// ── toggleEstadoLab ──────────────────────────────────────────
toggleEstadoLab = function(id) {
  var l = LABS.find(function(x) { return x.id === id; });
  if (!l) return;
  var nuevo = Object.assign({}, l, { ocupado: l.ocupado ? 0 : 1 });
  apiPut('labs/' + id, nuevo).then(function(actualizado) {
    Object.assign(l, actualizado);
    toast('Estado del laboratorio actualizado.', 'ok');
    renderAdmin();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

// ── guardarPauta ─────────────────────────────────────────────
guardarPauta = function() {
  var input = document.getElementById('pauta-texto');
  var texto = input ? input.value.trim() : '';
  if (!texto) { toast('Escribi una pauta.', 'err'); return; }
  apiPost('pautas', { texto: texto }).then(function(nueva) {
    PAUTAS.push(nueva.texto);
    input.value = '';
    cerrarModal('modal-pauta');
    toast('Pauta guardada.', 'ok');
    renderAdmin();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

// ── eliminarPauta ────────────────────────────────────────────
eliminarPauta = function(index) {
  apiGet('pautas').then(function(lista) {
    var pauta = lista[index];
    if (!pauta) throw new Error('Pauta no encontrada');
    return apiDelete('pautas/' + pauta.id);
  }).then(function() {
    PAUTAS.splice(index, 1);
    toast('Pauta eliminada.', 'info');
    renderAdmin();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

// ── agregarEspera ────────────────────────────────────────────
var _agregarEspera_original = typeof agregarEspera !== 'undefined' ? agregarEspera : null;
agregarEspera = function() {
  var lab    = document.getElementById('espera-lab').value;
  var dia    = document.getElementById('espera-dia').value;
  var modulo = document.getElementById('espera-modulo').value;
  if (!lab || dia === '' || modulo === '') { toast('Completa todos los campos.', 'err'); return; }

  var ocupado = RESERVAS.find(function(r) {
    return r.semanaOffset === semanaOffset && r.dia === parseInt(dia) && r.modulo === parseInt(modulo) && r.lab === lab;
  });
  if (!ocupado) { toast('Ese turno esta disponible, reservalo directamente.', 'info'); cerrarModal('modal-espera'); return; }

  var yaEnEspera = LISTA_ESPERA.find(function(e) {
    return e.lab === lab && e.dia === parseInt(dia) && e.modulo === parseInt(modulo) && e.profeId === (window.SESSION ? window.SESSION.profeId : getCurrentProfId()) && e.semanaOffset === semanaOffset;
  });
  if (yaEnEspera) { toast('Ya estas anotado en espera para ese turno.', 'warn'); cerrarModal('modal-espera'); return; }

  apiPost('espera', {
    profeId: (window.SESSION ? window.SESSION.profeId : getCurrentProfId()), lab: lab, dia: parseInt(dia),
    modulo: parseInt(modulo), semanaOffset: semanaOffset
  }).then(function(nueva) {
    LISTA_ESPERA.push(nueva);
    cerrarModal('modal-espera');
    toast('Anotado en lista de espera.', 'ok');
    renderAll();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

// ── quitarEspera ─────────────────────────────────────────────
quitarEspera = function(id) {
  confirmar('Queres quitarte de la lista de espera?', function() {
    apiDelete('espera/' + id).then(function() {
      LISTA_ESPERA = LISTA_ESPERA.filter(function(e) { return e.id !== id; });
      toast('Removido de lista de espera.', 'info');
      renderAll();
    }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
  });
};

// ── Solicitar renovacion (misReservas.js) ───────────────────
var _solicitarRenovacion_original = typeof solicitarRenovacion !== 'undefined' ? solicitarRenovacion : null;
if (typeof solicitarRenovacion !== 'undefined') {
  solicitarRenovacion = function(reservaId) {
    var r = RESERVAS.find(function(x) { return x.id === reservaId; });
    if (!r) return;
    var semLabel = r.renovaciones + 1;
    confirmar(
      'Solicitar renovacion semanal ' + semLabel + '/1 para ' + getLab(r.lab).nombre + ' - ' + r.curso + '?',
      function() {
        apiPost('solicitudes', {
          semanaOffset: semanaOffset, dia: r.dia, modulo: r.modulo, lab: r.lab,
          curso: r.curso, orient: r.orient, profeId: r.profeId, secuencia: r.secuencia,
          cicloClases: 1, estado: 'pendiente', esRenovacion: 1,
          reservaOriginalId: r.id, renovacionNum: semLabel
        }).then(function(nueva) {
          SOLICITUDES.push(nueva);
          toast('Solicitud de renovacion semana ' + semLabel + '/1 enviada.', 'info');
          renderAll();
        }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
      }
    );
  };
}


console.log('[DB Override] Funciones SQL activas.');
// ── guardarDocente — DESHABILITADO (docentes vienen de `personal`) ──────────
guardarDocente = function() {
  toast('Los docentes se gestionan directamente desde la base de datos (tabla personal). No es posible agregar o editar desde aquí.', 'warn');
  cerrarModal('modal-docente');
};

// ── eliminarDocente — solo elimina de la vista local + reservas ───────────
eliminarDocente = function(id) {
  var p = PROFESORES.find(function(x) { return x.id === id; });
  if (!p) return;
  confirmar(
    'Eliminar las reservas de Prof. ' + p.apellido + '?<br><small>El docente permanece en la base de datos escolar.</small>',
    function() {
      // Solo eliminamos sus reservas y solicitudes de los arreglos locales + API
      var promesas = [];
      RESERVAS.filter(function(r) { return r.profeId === id; }).forEach(function(r) {
        promesas.push(apiDelete('reservas/' + r.id));
      });
      SOLICITUDES.filter(function(s) { return s.profeId === id; }).forEach(function(s) {
        promesas.push(apiDelete('solicitudes/' + s.id));
      });
      Promise.all(promesas).then(function() {
        RESERVAS    = RESERVAS.filter(function(r)    { return r.profeId !== id; });
        SOLICITUDES = SOLICITUDES.filter(function(s) { return s.profeId !== id; });
        toast('Reservas del docente eliminadas.', 'info');
        renderAdmin();
      }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
    }
  );
};

// ── guardarLab — solo PUT (ocupado/max_grupos), sin POST ──────────────────
guardarLab = function() {
  var estado      = document.getElementById('lab-estado').value;
  var maxGruposEl = document.getElementById('lab-max-grupos');
  var maxGrupos   = maxGruposEl ? parseInt(maxGruposEl.value || '2') : 2;

  if (!editLabId) {
    toast('Los laboratorios se gestionan desde la tabla salones. Solo se puede editar estado y capacidad de grupos.', 'warn');
    cerrarModal('modal-lab');
    return;
  }

  setLabMaxGrupos(editLabId, maxGrupos);

  var l = LABS.find(function(x) { return x.id === editLabId; });
  var datos = Object.assign({}, l || {}, {
    ocupado: estado === 'ocupado' ? 1 : 0,
    max_grupos: maxGrupos
  });

  apiPut('labs/' + editLabId, datos).then(function(actualizado) {
    var idx = LABS.findIndex(function(x) { return x.id === editLabId; });
    if (idx >= 0) LABS[idx] = actualizado;
    cerrarModal('modal-lab');
    editLabId = null;
    toast('Laboratorio actualizado.', 'ok');
    renderAdmin();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

// ── eliminarLab — deshabilitado ───────────────────────────────────────────
eliminarLab = function(id) {
  toast('Los laboratorios se gestionan desde la tabla salones. Para eliminar un laboratorio, modificá la tabla salones en la base de datos.', 'warn');
};

console.log('[DB Override v2] Personal como fuente de docentes activo.');
