// ============================================================
// espera.js — Lista de espera
//
// ¿Qué hay acá?
//   • abrirModalEspera()  → abre el formulario de espera
//   • guardarEspera()     → anota al profe en la lista
//   • quitarEspera()      → el profe (o directivo) se borra de la lista
//   • promoverEspera()    → el directivo asigna un turno libre al primero de la fila
//
// Depende de: config.js, helpers.js, ui.js, db.js, reservas.js (poblarSelectsReserva)
// ============================================================

function abrirModalEspera() {
  poblarSelectsReserva();
  ['espera-lab', 'espera-dia', 'espera-modulo'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  abrirModal('modal-espera');
}

function guardarEspera() {
  var lab    = document.getElementById('espera-lab').value;
  var dia    = document.getElementById('espera-dia').value;
  var modulo = document.getElementById('espera-modulo').value;

  if (!lab || dia === '' || modulo === '') {
    toast('Completá todos los campos.', 'err');
    return;
  }

  // Si el turno está libre, no tiene sentido anotarse en espera
  var ocupado = RESERVAS.find(function(r) {
    return r.semanaOffset === semanaOffset
      && r.dia    === parseInt(dia)
      && r.modulo === parseInt(modulo)
      && r.lab    === lab;
  });
  if (!ocupado) {
    toast('Ese turno está disponible. Podés solicitarlo directamente.', 'info');
    cerrarModal('modal-espera');
    abrirModalReservaSlot(parseInt(dia), parseInt(modulo), lab);
    return;
  }

  // No anotar dos veces al mismo profe para el mismo turno
  var yaEnEspera = LISTA_ESPERA.find(function(e) {
    return e.profeId       === getCurrentProfId()
      && e.lab             === lab
      && e.dia             === parseInt(dia)
      && e.modulo          === parseInt(modulo)
      && e.semanaOffset    === semanaOffset;
  });
  if (yaEnEspera) {
    toast('Ya estás anotado en espera para ese turno.', 'warn');
    cerrarModal('modal-espera');
    return;
  }

  nextId++;
  LISTA_ESPERA.push({
    id:           nextId,
    profeId:      getCurrentProfId(),
    lab:          lab,
    dia:          parseInt(dia),
    modulo:       parseInt(modulo),
    semanaOffset: semanaOffset,
  });

  cerrarModal('modal-espera');
  saveDB();
  toast('Anotado en lista de espera.', 'ok');
  renderAll();
}

function quitarEspera(id) {
  confirmar('¿Querés quitarte de la lista de espera?', function() {
    LISTA_ESPERA = LISTA_ESPERA.filter(function(e) { return e.id !== id; });
    saveDB();
    toast('Removido de lista de espera.', 'info');
    renderAll();
  });
}

function promoverEspera(id) {
  var e = LISTA_ESPERA.find(function(x) { return x.id === id; });
  if (!e) return;

  // Verificar que el turno siga libre
  var ocupado = RESERVAS.find(function(r) {
    return r.semanaOffset === e.semanaOffset && r.dia === e.dia && r.modulo === e.modulo && r.lab === e.lab;
  });
  if (ocupado) { toast('Ese turno sigue ocupado.', 'warn'); return; }

  var p = getProfe(e.profeId);
  nextId++;
  RESERVAS.push({
    id:           nextId,
    semanaOffset: e.semanaOffset,
    dia:          e.dia,
    modulo:       e.modulo,
    lab:          e.lab,
    curso:        '—',
    orient:       p.orientacion || 'bas',
    profeId:      e.profeId,
    secuencia:    '(asignado desde espera)',
    cicloClases:  1,
    renovaciones: 0,
  });

  LISTA_ESPERA = LISTA_ESPERA.filter(function(x) { return x.id !== id; });
  saveDB();
  toast('Turno asignado a Prof. ' + p.apellido + '.', 'ok');
  renderAll();
}
