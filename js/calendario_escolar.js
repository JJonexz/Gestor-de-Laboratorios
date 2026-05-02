// ============================================================
// calendario_escolar.js — Gestión del calendario escolar
// v2.1 - Modal pre-definido en HTML, selects poblados al abrir
// ============================================================

var CAL_ESC_KEY = 'gestor_eest1_cal_escolar';

var TIPOS_EVENTO = {
  feriado:       { label: 'Feriado',             color: '#e63946', bloquea: true  },
  examen:        { label: 'Semana de examen',     color: '#d97706', bloquea: true  },
  receso:        { label: 'Receso escolar',       color: '#7c3aed', bloquea: true  },
  acto:          { label: 'Acto escolar',         color: '#0891b2', bloquea: false },
  mantenimiento: { label: 'Mantenimiento lab',    color: '#64748b', bloquea: true  }
};

// ── CRUD ─────────────────────────────────────────────────────
function getEventosEscolares() {
  try {
    var raw = localStorage.getItem(CAL_ESC_KEY);
    return raw ? JSON.parse(raw) : getEventosDefault();
  } catch(e) { return getEventosDefault(); }
}

function getEventosDefault() {
  var anio = new Date().getFullYear();
  return [
    { id: 1, tipo: 'feriado', titulo: '25 de Mayo — Revolución de Mayo',   fecha: anio + '-05-25', labId: null },
    { id: 2, tipo: 'feriado', titulo: '20 de Junio — Día de la Bandera',    fecha: anio + '-06-20', labId: null },
    { id: 3, tipo: 'feriado', titulo: '9 de Julio — Independencia',          fecha: anio + '-07-09', labId: null },
    { id: 4, tipo: 'receso',  titulo: 'Receso de invierno',  fechaInicio: anio + '-07-14', fechaFin: anio + '-07-25', labId: null },
    { id: 5, tipo: 'examen',  titulo: 'Mesas de examen febrero/marzo', fechaInicio: (anio + 1) + '-02-17', fechaFin: (anio + 1) + '-02-28', labId: null }
  ];
}

function saveEventosEscolares(lista) {
  try { localStorage.setItem(CAL_ESC_KEY, JSON.stringify(lista)); } catch(e) {}
}

function agregarEventoEscolar(evento) {
  var lista = getEventosEscolares();
  evento.id = Date.now();
  lista.push(evento);
  saveEventosEscolares(lista);
  return evento;
}

function eliminarEventoEscolar(id) {
  saveEventosEscolares(getEventosEscolares().filter(function(e) { return e.id !== id; }));
}

// ── Consultas ─────────────────────────────────────────────────
function getEventoQueBloquea(fecha) {
  var dateStr = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10);
  return getEventosEscolares().find(function(ev) {
    var cfg = TIPOS_EVENTO[ev.tipo];
    if (!cfg || !cfg.bloquea) return false;
    if (ev.fecha) return ev.fecha === dateStr;
    if (ev.fechaInicio && ev.fechaFin) return dateStr >= ev.fechaInicio && dateStr <= ev.fechaFin;
    return false;
  }) || null;
}

function getDateDesdeSemana(semanaOffset, dia) {
  var hoy      = new Date();
  hoy.setHours(0, 0, 0, 0);
  var diaSem   = hoy.getDay();
  var diffLun  = diaSem === 0 ? -6 : 1 - diaSem;
  var lunes    = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffLun + semanaOffset * 7 + dia);
  return lunes;
}

function esDiaHabilitado(semanaOffset, dia) {
  return !getEventoQueBloquea(getDateDesdeSemana(semanaOffset, dia));
}

function getEventoEnDia(semanaOffset, dia) {
  var fecha   = getDateDesdeSemana(semanaOffset, dia);
  var dateStr = fecha.toISOString().slice(0, 10);
  return getEventosEscolares().find(function(ev) {
    if (ev.fecha) return ev.fecha === dateStr;
    if (ev.fechaInicio && ev.fechaFin) return dateStr >= ev.fechaInicio && dateStr <= ev.fechaFin;
    return false;
  }) || null;
}

// ── Render tabla ──────────────────────────────────────────────
function renderCalendarioEscolar() {
  var el = document.getElementById('cal-escolar-body');
  if (!el) return;
  var lista = getEventosEscolares();

  if (!lista.length) {
    el.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Sin eventos registrados</td></tr>';
    return;
  }

  el.innerHTML = lista
    .slice()
    .sort(function(a, b) {
      var da = a.fecha || a.fechaInicio || '';
      var db = b.fecha || b.fechaInicio || '';
      return da.localeCompare(db);
    })
    .map(function(ev) {
      var cfg      = TIPOS_EVENTO[ev.tipo] || { label: ev.tipo, color: '#888' };
      var fechaStr = ev.fecha ||
        (ev.fechaInicio && ev.fechaFin ? ev.fechaInicio + ' → ' + ev.fechaFin : '—');
      return (
        '<tr>' +
          '<td>' +
            '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;' +
              'background:' + cfg.color + ';margin-right:6px;vertical-align:middle"></span>' +
            _escCal(cfg.label) +
          '</td>' +
          '<td>' + _escCal(ev.titulo) + '</td>' +
          '<td>' + fechaStr + '</td>' +
          '<td>' + (ev.labId ? 'Lab.' + ev.labId : 'Todos los labs') + '</td>' +
          '<td>' +
            (esDirectivo() ? '<button class="tbl-btn danger" onclick="confirmarEliminarEvento(' + ev.id + ')">✕ Eliminar</button>' : '') +
          '</td>' +
        '</tr>'
      );
    })
    .join('');
}

function confirmarEliminarEvento(id) {
  confirmar('¿Eliminar este evento del calendario escolar?', function() {
    eliminarEventoEscolar(id);
    renderCalendarioEscolar();
    if (typeof renderCalendario === 'function') renderCalendario();
    toast('Evento eliminado', 'ok');
  });
}

// ── Modal (usa HTML pre-definido, solo puebla los selects) ────
function abrirModalEventoEscolar() {
  // Poblar select de laboratorios (siempre actualizado)
  var selLab = document.getElementById('ev-lab');
  if (selLab) {
    selLab.innerHTML =
      '<option value="">Todos los laboratorios</option>' +
      (LABS || []).map(function(l) {
        return '<option value="' + l.id + '">' + l.nombre + '</option>';
      }).join('');
  }

  // Resetear formulario
  var titulo = document.getElementById('ev-titulo');
  if (titulo) titulo.value = '';
  var fecha  = document.getElementById('ev-fecha');
  if (fecha) fecha.value = '';
  var ini    = document.getElementById('ev-fecha-ini');
  if (ini) ini.value = '';
  var fin    = document.getElementById('ev-fecha-fin');
  if (fin) fin.value = '';
  var tipo   = document.getElementById('ev-tipo');
  if (tipo) { tipo.value = 'feriado'; toggleFechaEvento(); }

  abrirModal('modal-evento-escolar');
}

function toggleFechaEvento() {
  var tipo    = document.getElementById('ev-tipo');
  if (!tipo) return;
  var esRango = (tipo.value === 'receso' || tipo.value === 'examen');
  var simple  = document.getElementById('ev-fecha-simple');
  var rango   = document.getElementById('ev-fecha-rango');
  if (simple) simple.style.display = esRango ? 'none' : 'block';
  if (rango)  rango.style.display  = esRango ? 'block' : 'none';
}

function guardarEventoEscolar() {
  var tipo   = (document.getElementById('ev-tipo')   || {}).value || '';
  var titulo = ((document.getElementById('ev-titulo') || {}).value || '').trim();
  var labId  = (document.getElementById('ev-lab')    || {}).value || null;

  if (!tipo || !titulo) { toast('Completá el tipo y el título', 'err'); return; }

  var esRango = (tipo === 'receso' || tipo === 'examen');
  var ev = { tipo: tipo, titulo: titulo, labId: labId || null };

  if (esRango) {
    var ini = (document.getElementById('ev-fecha-ini') || {}).value;
    var fin = (document.getElementById('ev-fecha-fin') || {}).value;
    if (!ini || !fin) { toast('Indicá las fechas de inicio y fin', 'err'); return; }
    if (ini > fin)    { toast('La fecha de inicio debe ser anterior al fin', 'err'); return; }
    ev.fechaInicio = ini;
    ev.fechaFin    = fin;
  } else {
    var fecha = (document.getElementById('ev-fecha') || {}).value;
    if (!fecha) { toast('Indicá la fecha', 'err'); return; }
    ev.fecha = fecha;
  }

  agregarEventoEscolar(ev);
  cerrarModal('modal-evento-escolar');
  renderCalendarioEscolar();
  if (typeof renderCalendario === 'function') renderCalendario();
  toast('Fecha especial agregada al calendario', 'ok');
}

function _escCal(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
