// ============================================================
// calendario_escolar.js — Gestión del calendario escolar
//
// Funcionalidades:
//   • Feriados nacionales y locales
//   • Semanas especiales: exámenes, actos, receso
//   • Bloqueo automático de slots en días inhabilitados
//   • Panel de administración para gestionar fechas especiales
//   • Indicadores visuales en el calendario principal
//
// Depende de: config.js, helpers.js

function getSesionActualLocal() {
  if (window.SESSION) return { profeId: window.SESSION.id, nombre: window.SESSION.nombre || window.SESSION.apellido || 'Usuario', rol: window.ROLE || modoUsuario };
  return { profeId: 1, nombre: 'Usuario', rol: modoUsuario };
}
// ============================================================

var CAL_ESC_KEY = 'gestor_eest1_cal_escolar';

// ── Tipos de evento especial ─────────────────────────────────
var TIPOS_EVENTO = {
  feriado:    { label: 'Feriado',        color: '#e63946', bloquea: true  },
  examen:     { label: 'Semana de examen', color: '#d97706', bloquea: true  },
  receso:     { label: 'Receso escolar', color: '#7c3aed', bloquea: true  },
  acto:       { label: 'Acto escolar',   color: '#0891b2', bloquea: false },
  mantenimiento: { label: 'Mantenimiento lab', color: '#64748b', bloquea: true }
};

// ── CRUD de eventos especiales ───────────────────────────────
function getEventosEscolares() {
  try {
    var raw = localStorage.getItem(CAL_ESC_KEY);
    return raw ? JSON.parse(raw) : getEventosDefault();
  } catch(e) { return getEventosDefault(); }
}

function getEventosDefault() {
  // Algunos eventos pre-cargados para el prototipo (año 2025)
  var hoy = new Date();
  var anio = hoy.getFullYear();
  return [
    { id: 1, tipo: 'feriado', titulo: '25 de Mayo — Revolución de Mayo', fecha: anio + '-05-25', labId: null },
    { id: 2, tipo: 'feriado', titulo: '20 de Junio — Día de la Bandera',  fecha: anio + '-06-20', labId: null },
    { id: 3, tipo: 'feriado', titulo: '9 de Julio — Independencia',        fecha: anio + '-07-09', labId: null },
    { id: 4, tipo: 'receso',  titulo: 'Receso de invierno', fechaInicio: anio + '-07-14', fechaFin: anio + '-07-25', labId: null },
    { id: 5, tipo: 'examen',  titulo: 'Mesas de examen febrero/marzo', fechaInicio: (anio+1) + '-02-17', fechaFin: (anio+1) + '-02-28', labId: null },
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
  var lista = getEventosEscolares().filter(function(e) { return e.id !== id; });
  saveEventosEscolares(lista);
}

// ── Consultas ────────────────────────────────────────────────
// Retorna el evento que bloquea una fecha, o null si está libre
function getEventoQueBloquea(fecha) {
  // fecha: objeto Date o string 'YYYY-MM-DD'
  var dateStr = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0,10);
  var lista = getEventosEscolares();
  return lista.find(function(ev) {
    var cfg = TIPOS_EVENTO[ev.tipo];
    if (!cfg || !cfg.bloquea) return false;
    if (ev.fecha) {
      return ev.fecha === dateStr;
    }
    if (ev.fechaInicio && ev.fechaFin) {
      return dateStr >= ev.fechaInicio && dateStr <= ev.fechaFin;
    }
    return false;
  }) || null;
}

// Dado un semanaOffset y dia (0-4 = Lun-Vie), retorna la fecha
function getDateDesdeSemana(semanaOffset, dia) {
  var hoy = new Date();
  hoy.setHours(0,0,0,0);
  var lunes = new Date(hoy);
  var diaSemana = hoy.getDay(); // 0=dom, 1=lun...
  var diffLunes = (diaSemana === 0) ? -6 : 1 - diaSemana;
  lunes.setDate(hoy.getDate() + diffLunes + (semanaOffset * 7));
  lunes.setDate(lunes.getDate() + dia);
  return lunes;
}

function esDiaHabilitado(semanaOffset, dia) {
  var fecha = getDateDesdeSemana(semanaOffset, dia);
  return !getEventoQueBloquea(fecha);
}

function getEventoEnDia(semanaOffset, dia) {
  var fecha = getDateDesdeSemana(semanaOffset, dia);
  var dateStr = fecha.toISOString().slice(0,10);
  var lista = getEventosEscolares();
  return lista.find(function(ev) {
    if (ev.fecha) return ev.fecha === dateStr;
    if (ev.fechaInicio && ev.fechaFin) return dateStr >= ev.fechaInicio && dateStr <= ev.fechaFin;
    return false;
  }) || null;
}

// ── Renderizado panel admin ──────────────────────────────────
function renderCalendarioEscolar() {
  var el = document.getElementById('cal-escolar-body');
  if (!el) return;
  var lista = getEventosEscolares();

  if (!lista.length) {
    el.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Sin eventos registrados</td></tr>';
    return;
  }

  el.innerHTML = lista.sort(function(a,b) {
    var da = a.fecha || a.fechaInicio || '';
    var db = b.fecha || b.fechaInicio || '';
    return da.localeCompare(db);
  }).map(function(ev) {
    var cfg = TIPOS_EVENTO[ev.tipo] || {};
    var fechaStr = ev.fecha ||
      (ev.fechaInicio && ev.fechaFin ? ev.fechaInicio + ' → ' + ev.fechaFin : '—');
    return (
      '<tr>' +
        '<td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + (cfg.color||'#888') + ';margin-right:6px"></span>' +
          (cfg.label || ev.tipo) + '</td>' +
        '<td>' + escCal(ev.titulo) + '</td>' +
        '<td>' + fechaStr + '</td>' +
        '<td>' + (ev.labId ? 'Lab.' + ev.labId : 'Todos los labs') + '</td>' +
        '<td><button class="tbl-btn danger" onclick="confirmarEliminarEvento(' + ev.id + ')">✕ Eliminar</button></td>' +
      '</tr>'
    );
  }).join('');
}

function confirmarEliminarEvento(id) {
  confirmar('¿Eliminar este evento del calendario escolar?', function() {
    eliminarEventoEscolar(id);
    renderCalendarioEscolar();
    if (typeof renderCalendario === 'function') renderCalendario();
    toast('Evento eliminado', 'ok');
  });
}

// ── Modal nuevo evento ───────────────────────────────────────
function abrirModalEventoEscolar() {
  var m = document.getElementById('modal-evento-escolar');
  if (!m) {
    // Crear modal dinámicamente si no existe
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-evento-escolar';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h3>Agregar evento al calendario escolar</h3>' +
          '<button class="modal-close" onclick="cerrarModal(\'modal-evento-escolar\')">✕</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="form-group">' +
            '<label class="form-label">Tipo de evento</label>' +
            '<select class="form-control" id="ev-tipo" onchange="toggleFechaEvento()">' +
              Object.keys(TIPOS_EVENTO).map(function(k) {
                return '<option value="' + k + '">' + TIPOS_EVENTO[k].label + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">Título / descripción</label><input class="form-control" id="ev-titulo" type="text" placeholder="Ej: Feriado nacional 25 de mayo"/></div>' +
          '<div class="form-group" id="ev-fecha-simple">' +
            '<label class="form-label">Fecha</label>' +
            '<input class="form-control" id="ev-fecha" type="date"/>' +
          '</div>' +
          '<div class="form-group" id="ev-fecha-rango" style="display:none">' +
            '<label class="form-label">Fecha de inicio</label><input class="form-control" id="ev-fecha-ini" type="date"/>' +
            '<label class="form-label" style="margin-top:.5rem">Fecha de fin</label><input class="form-control" id="ev-fecha-fin" type="date"/>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Laboratorio afectado (opcional)</label>' +
            '<select class="form-control" id="ev-lab">' +
              '<option value="">Todos los laboratorios</option>' +
              (LABS || []).map(function(l) { return '<option value="' + l.id + '">' + l.nombre + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn-cancel" onclick="cerrarModal(\'modal-evento-escolar\')">Cancelar</button>' +
          '<button class="btn-ok" onclick="guardarEventoEscolar()">Guardar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  }
  abrirModal('modal-evento-escolar');
}

function toggleFechaEvento() {
  var tipo = document.getElementById('ev-tipo');
  if (!tipo) return;
  var esRango = ['receso','examen'].includes(tipo.value);
  var simple = document.getElementById('ev-fecha-simple');
  var rango = document.getElementById('ev-fecha-rango');
  if (simple) simple.style.display = esRango ? 'none' : 'block';
  if (rango)  rango.style.display  = esRango ? 'block' : 'none';
}

function guardarEventoEscolar() {
  var tipo   = (document.getElementById('ev-tipo')   || {}).value;
  var titulo = (document.getElementById('ev-titulo') || {}).value || '';
  var labId  = (document.getElementById('ev-lab')    || {}).value || null;

  if (!tipo || !titulo.trim()) { toast('Completá el tipo y el título', 'err'); return; }

  var esRango = ['receso','examen'].includes(tipo);
  var ev = { tipo: tipo, titulo: titulo.trim(), labId: labId || null };

  if (esRango) {
    var ini = (document.getElementById('ev-fecha-ini') || {}).value;
    var fin = (document.getElementById('ev-fecha-fin') || {}).value;
    if (!ini || !fin) { toast('Indicá las fechas de inicio y fin', 'err'); return; }
    if (ini > fin) { toast('La fecha de inicio debe ser anterior al fin', 'err'); return; }
    ev.fechaInicio = ini; ev.fechaFin = fin;
  } else {
    var fecha = (document.getElementById('ev-fecha') || {}).value;
    if (!fecha) { toast('Indicá la fecha', 'err'); return; }
    ev.fecha = fecha;
  }

  agregarEventoEscolar(ev);
  cerrarModal('modal-evento-escolar');
  renderCalendarioEscolar();
  if (typeof renderCalendario === 'function') renderCalendario();
  toast('Evento agregado al calendario', 'ok');
}

function escCal(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
