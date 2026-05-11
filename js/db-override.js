// ============================================================
// db-override.js — Overrides para conectar app.js con SQL API
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
  var curso    = document.getElementById('f-curso').value.trim();
  var materia  = document.getElementById('f-materia') ? document.getElementById('f-materia').value.trim() : '';
  var secuencia = document.getElementById('f-secuencia').value.trim();
  var orient   = UIHelper.getOrientValues('f-orient-group');

  if (materia) secuencia = '[' + materia + '] ' + secuencia;
  var periodoEl = document.getElementById('f-periodo');
  var periodo  = periodoEl ? periodoEl.value : '1';
  var anualChk = document.querySelector('#modal-reserva #f-anual');
  var esAnual  = esDirectivo() && anualChk !== null && anualChk.checked;

  if (!lab || dia === '' || modulo === '' || !curso || !secuencia) {
    toast('Por favor completa todos los campos.', 'err'); return;
  }

  var modulosAReservar = getModulosParaPeriodo(parseInt(modulo), periodo);
  var semanaBase = parseInt(semanaOffset, 10);
  var semanasAReservar = [semanaBase];
  if (esAnual) {
    semanasAReservar = [];
    for (var sw = semanaBase; sw < semanaBase + 40; sw++) semanasAReservar.push(sw);
  }

  if (!esAnual) {
    for (var mi = 0; mi < modulosAReservar.length; mi++) {
      var m = modulosAReservar[mi];
      var conflicto = RESERVAS.find(function(r) {
        return r.semanaOffset === semanaOffset && r.dia === parseInt(dia) && r.modulo === m && r.lab === lab;
      });
      if (conflicto) { toast('El modulo ' + getModulo(m).label + ' ya esta reservado.', 'warn'); return; }
      var solicPendiente = SOLICITUDES.find(function(s) {
        return s.semanaOffset === semanaOffset && s.dia === parseInt(dia) && s.modulo === m && s.lab === lab && s.estado === 'pendiente';
      });
      if (solicPendiente) { toast('El modulo ' + getModulo(m).label + ' ya tiene solicitud pendiente.', 'warn'); return; }
    }
  }

  var profeSel = document.getElementById('f-profe');
  var profeId = (esDirectivo() && profeSel && profeSel.value)
    ? parseInt(profeSel.value)
    : (window.SESSION ? window.SESSION.profeId : getCurrentProfId());

  cerrarModal('modal-reserva');

  if (esDirectivo()) {
    var promises = [];
    semanasAReservar.forEach(function(sem) {
      modulosAReservar.forEach(function(m) {
        var yaExiste = RESERVAS.find(function(r) {
          return r.semanaOffset === sem && r.dia === parseInt(dia) && r.modulo === m && r.lab === lab;
        });
        if (yaExiste) return;
        promises.push(apiPost('reservas', {
          semanaOffset: sem, dia: parseInt(dia), modulo: m, lab: lab, curso: curso,
          orient: orient, profeId: profeId, secuencia: secuencia, cicloClases: 1,
          renovaciones: 0, anual: esAnual ? 1 : 0
        }));
      });
    });
    Promise.all(promises).then(function(nuevas) {
      nuevas.forEach(function(r) { RESERVAS.push(r); });
      toast(esAnual
        ? 'Reserva anual creada: ' + nuevas.length + ' entradas.'
        : 'Reserva creada (' + nuevas.length + ' modulo' + (nuevas.length > 1 ? 's' : '') + ').', 'ok');
      renderAll();
    }).catch(function(e) { toast('Error al guardar: ' + e.message, 'err'); });
  } else {
    var promises2 = [];
    modulosAReservar.forEach(function(m) {
      promises2.push(apiPost('solicitudes', {
        semanaOffset: semanaOffset, dia: parseInt(dia), modulo: m, lab: lab, curso: curso,
        orient: orient, profeId: (window.SESSION ? window.SESSION.profeId : getCurrentProfId()), secuencia: secuencia, cicloClases: 1,
        estado: 'pendiente', esRenovacion: 0, renovacionNum: 0
      }));
    });
    Promise.all(promises2).then(function(nuevas) {
      nuevas.forEach(function(s) { SOLICITUDES.push(s); });
      toast('Solicitud enviada (' + nuevas.length + ' modulo' + (nuevas.length > 1 ? 's' : '') + ').', 'info');
      renderAll();
    }).catch(function(e) { toast('Error al enviar solicitud: ' + e.message, 'err'); });
  }
};

// ── aceptarSolicitud ─────────────────────────────────────────
aceptarSolicitud = function(solId) {
  if (modoUsuario !== 'admin') { toast('Solo el directivo puede aprobar solicitudes.', 'err'); return; }
  var s = SOLICITUDES.find(function(x) { return x.id === solId; });
  if (!s) return;
  var conflicto = RESERVAS.find(function(r) {
    return r.semanaOffset === s.semanaOffset && r.dia === s.dia && r.modulo === s.modulo && r.lab === s.lab;
  });
  if (conflicto) { toast('Ese turno fue ocupado mientras estaba pendiente.', 'warn'); return; }

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
        cicloClases: 1, renovaciones: s.renovacionNum || 1, anual: 0
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
    cicloClases: 1, renovaciones: 0, anual: 0
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
  }).then(function() {
    var total = RESERVAS.length;
    RESERVAS = RESERVAS.filter(function(x) {
      return !(x.lab === reservaBase.lab && x.dia === reservaBase.dia &&
               x.profeId === reservaBase.profeId && x.curso === reservaBase.curso && x.anual);
    });
    toast('Se eliminaron ' + (total - RESERVAS.length) + ' reserva(s) anuales.', 'ok');
    renderAll();
  }).catch(function(e) { toast('Error: ' + e.message, 'err'); });
};

// ── guardarEdicionReserva ────────────────────────────────────
guardarEdicionReserva = function() {
  var reservaId = parseInt(document.getElementById('edit-reserva-id').value);
  var r = RESERVAS.find(function(x) { return x.id === reservaId; });
  if (!r) return;

  var nuevoCurso    = document.getElementById('edit-curso').value.trim();
  var nuevaSecuencia = document.getElementById('edit-secuencia').value.trim();
  var nuevaOrient   = UIHelper.getOrientValues('edit-orient-group');
  var scopeSel      = document.getElementById('edit-scope');
  var scope         = scopeSel ? scopeSel.value : 'puntual';
  var editProfeSel  = document.getElementById('edit-profe');
  var nuevoProfeId  = (esDirectivo() && editProfeSel && editProfeSel.value)
    ? parseInt(editProfeSel.value) : null;

  if (!nuevoCurso || !nuevaSecuencia) { toast('Completa el curso y la secuencia.', 'err'); return; }

  var cursoOriginal   = r.curso;
  var profeIdOriginal = r.profeId;

  var afectadas = RESERVAS.filter(function(x) {
    if (scope === 'anual') {
      return x.lab === r.lab && x.dia === r.dia && x.profeId === profeIdOriginal && x.curso === cursoOriginal && x.anual;
    } else if (scope === 'siguientes') {
      return x.lab === r.lab && x.dia === r.dia && x.profeId === profeIdOriginal && x.curso === cursoOriginal && x.semanaOffset >= r.semanaOffset;
    } else {
      return x.semanaOffset === r.semanaOffset && x.dia === r.dia && x.lab === r.lab && x.profeId === profeIdOriginal && x.curso === cursoOriginal;
    }
  });

  var promises = afectadas.map(function(x) {
    var upd = Object.assign({}, x, { curso: nuevoCurso, secuencia: nuevaSecuencia, orient: nuevaOrient });
    if (nuevoProfeId) upd.profeId = nuevoProfeId;
    return apiPut('reservas/' + x.id, upd).then(function(act) {
      Object.assign(x, act);
    });
  });

  Promise.all(promises).then(function() {
    cerrarModal('modal-editar-reserva');
    toast(afectadas.length + ' reserva(s) actualizada(s).', 'ok');
    renderAll();
  }).catch(function(e) { toast('Error al editar: ' + e.message, 'err'); });
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
