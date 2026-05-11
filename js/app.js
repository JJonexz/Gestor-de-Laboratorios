// ============================================================
// Gestión de Laboratorios EEST N°1 — app.js v5
// Base de datos: JSON + localStorage (persistencia completa)
// ============================================================

const HOY = new Date();
HOY.setHours(0, 0, 0, 0);

let semanaOffset = 0;
let diaActual = 0;
let filtroOrient = 'all';
let filtroLab = 'todos';
let filtroTurno = 'todos';
let modoUsuario = 'prof';
let editDocenteId = null;
let editLabId = null;
let nextId = 500;

const DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'];
const DIAS_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

const MODULOS = [
  { id: 0, label: '1° Mañana', inicio: '7:20', fin: '8:20', turno: 'Mañana', tipo: 'clase', icon: '🌅' },
  { id: 1, label: '2° Mañana', inicio: '8:20', fin: '9:20', turno: 'Mañana', tipo: 'clase', icon: '🌅' },
  { id: 2, label: 'Recreo M', inicio: '9:20', fin: '9:50', turno: 'Mañana', tipo: 'recreo', icon: '☕' },
  { id: 3, label: '3° Mañana', inicio: '9:50', fin: '10:50', turno: 'Mañana', tipo: 'clase', icon: '🌅' },
  { id: 4, label: '4° Mañana', inicio: '10:50', fin: '11:50', turno: 'Mañana', tipo: 'clase', icon: '🌅' },
  { id: 5, label: '5° Mañana', inicio: '11:50', fin: '12:50', turno: 'Mañana', tipo: 'clase', icon: '🌅' },


  { id: 6, label: '1° Tarde', inicio: '13:00', fin: '14:00', turno: 'Tarde', tipo: 'clase', icon: '☀️' },
  { id: 7, label: '2° Tarde', inicio: '14:00', fin: '15:00', turno: 'Tarde', tipo: 'clase', icon: '☀️' },
  { id: 8, label: 'Recreo T', inicio: '15:00', fin: '15:30', turno: 'Tarde', tipo: 'recreo', icon: '🧃' },
  { id: 9, label: '3° Tarde', inicio: '15:30', fin: '16:30', turno: 'Tarde', tipo: 'clase', icon: '☀️' },
  { id: 10, label: '4° Tarde', inicio: '16:30', fin: '17:30', turno: 'Tarde', tipo: 'clase', icon: '☀️' },

  { id: 11, label: '1° Vespert.', inicio: '17:40', fin: '18:40', turno: 'Vespertino', tipo: 'clase', icon: '🌆' },
  { id: 12, label: '2° Vespert.', inicio: '18:40', fin: '19:40', turno: 'Vespertino', tipo: 'clase', icon: '🌆' },
  { id: 13, label: 'Recreo V', inicio: '19:40', fin: '20:00', turno: 'Vespertino', tipo: 'recreo', icon: '🌙' },
  { id: 14, label: '3° Vespert.', inicio: '20:00', fin: '21:00', turno: 'Vespertino', tipo: 'clase', icon: '🌆' },
  { id: 15, label: '4° Vespert.', inicio: '21:00', fin: '22:00', turno: 'Vespertino', tipo: 'clase', icon: '🌆' },
];

const MODULOS_CLASE = MODULOS.filter(function (m) { return m.tipo === 'clase'; });

const TURNOS_CONFIG = [
  { label: 'Mañana', icon: '🌅', modulos: [0, 1, 2, 3, 4, 5] },
  { label: 'Tarde', icon: '☀️', modulos: [6, 7, 8, 9, 10] },
  { label: 'Vespertino', icon: '🌆', modulos: [11, 12, 13, 14, 15] },
];
const ORIENTACIONES = {
  info: { nombre: 'Informática', ev: 'ev-info', emoji: '💻', ob: 'ob-info' },
  const: { nombre: 'Construcción', ev: 'ev-const', emoji: '🏗️', ob: 'ob-const' },
  tur: { nombre: 'Turismo', ev: 'ev-tur', emoji: '🌐', ob: 'ob-tur' },
  bas: { nombre: 'Básico', ev: 'ev-bas', emoji: '📚', ob: 'ob-bas' },
};

// ============================================================
// BASE DE DATOS — cargada desde JSON, persistida en localStorage
// ============================================================
const LS_KEY = 'gestor_eest1_db';

var LABS = [];
var PROFESORES = [];
var RESERVAS = [];
var SOLICITUDES = [];
var LISTA_ESPERA = [];
var PAUTAS = [];
var RECREOS = [];

function saveDB() {
  try {
    var db = {
      labs: LABS,
      profesores: PROFESORES,
      reservas: RESERVAS,
      solicitudes: SOLICITUDES,
      espera: LISTA_ESPERA,
      pautas: PAUTAS,
      recreos: RECREOS,
      nextId: nextId,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
}

function loadFromLocalStorage() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    var db = JSON.parse(raw);
    if (!db || !db.labs) return false;
    LABS = db.labs || [];
    PROFESORES = db.profesores || [];
    RESERVAS = db.reservas || [];
    SOLICITUDES = db.solicitudes || [];
    LISTA_ESPERA = db.espera || [];
    PAUTAS = db.pautas || [];
    RECREOS = db.recreos || [];
    nextId = db.nextId || 500;
    return true;
  } catch (e) {
    console.warn('Error al leer localStorage:', e);
    return false;
  }
}

function loadFromJSON(callback) {
  var files = [
    { key: 'labs', url: 'data/rooms.json' },
    { key: 'profesores', url: 'data/profesores.json' },
    { key: 'reservas', url: 'data/reservas.json' },
    { key: 'solicitudes', url: 'data/solicitudes.json' },
    { key: 'espera', url: 'data/espera.json' },
    { key: 'pautas', url: 'data/pautas.json' },
    { key: 'recreos', url: 'data/recreos.json' },
  ];
  var results = {};
  var pending = files.length;

  // Normaliza campos numéricos críticos para que === no falle
  function normalizarEntrada(r) {
    return Object.assign({}, r, {
      semanaOffset: parseInt(r.semanaOffset, 10) || 0,
      dia: parseInt(r.dia, 10) || 0,
      modulo: parseInt(r.modulo, 10) || 0,
    });
  }

  function aplicar() {
    LABS = results.labs || [];
    PROFESORES = results.profesores || [];
    RESERVAS = (results.reservas || []).map(normalizarEntrada);
    SOLICITUDES = (results.solicitudes || []).map(normalizarEntrada);
    LISTA_ESPERA = (results.espera || []).map(normalizarEntrada);
    PAUTAS = results.pautas || [];
    RECREOS = results.recreos || [];
    var maxId = 0;
    [RESERVAS, SOLICITUDES, LISTA_ESPERA].forEach(function (arr) {
      arr.forEach(function (x) { if (x.id > maxId) maxId = x.id; });
    });
    nextId = Math.max(500, maxId + 1);
  }

  files.forEach(function (f) {
    fetch(f.url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        results[f.key] = data;
        pending--;
        if (pending === 0) { aplicar(); saveDB(); if (callback) callback(); }
      })
      .catch(function (err) {
        console.warn('Error cargando', f.url, err);
        results[f.key] = [];
        pending--;
        if (pending === 0) { aplicar(); if (callback) callback(); }
      });
  });
}

// ============================================================
// EXPORTAR / IMPORTAR / RESETEAR
// ============================================================
function exportarDB() {
  var db = {
    version: '5',
    exportadoEn: new Date().toISOString(),
    labs: LABS,
    profesores: PROFESORES,
    reservas: RESERVAS,
    solicitudes: SOLICITUDES,
    espera: LISTA_ESPERA,
    pautas: PAUTAS,
    recreos: RECREOS,
  };
  var blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'gestor-laboratorios-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Exportación descargada correctamente.', 'ok');
}

function importarDB() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var db = JSON.parse(ev.target.result);
        if (!db.labs || !db.profesores) { toast('Archivo inválido. Debe ser un backup del sistema.', 'err'); return; }
        confirmar('¿Importar este backup? Se reemplazarán TODOS los datos actuales.', function () {
          LABS = db.labs || [];
          PROFESORES = db.profesores || [];
          RESERVAS = db.reservas || [];
          SOLICITUDES = db.solicitudes || [];
          LISTA_ESPERA = db.espera || [];
          PAUTAS = db.pautas || [];
          RECREOS = db.recreos || [];
          var maxId = 0;
          [RESERVAS, SOLICITUDES, LISTA_ESPERA].forEach(function (arr) {
            arr.forEach(function (x) { if (x.id > maxId) maxId = x.id; });
          });
          nextId = Math.max(500, maxId + 1);
          saveDB();
          toast('Base de datos importada correctamente.', 'ok');
          renderAll();
          renderAdmin();
        });
      } catch (err) {
        toast('Error al leer el archivo JSON.', 'err');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function resetearDB() {
  confirmar('<strong>¿Restaurar datos de fábrica?</strong><br><br>Se eliminarán TODOS los cambios y se cargarán los datos originales de los archivos JSON.', function () {
    localStorage.removeItem(LS_KEY);
    loadFromJSON(function () {
      toast('Base de datos restaurada al estado inicial.', 'ok');
      renderAll();
      renderAdmin();
    });
  });
}

// ============================================================
// HELPERS
// ============================================================
function getModulo(id) { return MODULOS.find(function (m) { return m.id === id; }) || MODULOS[0]; }
function getProfe(id) { return PROFESORES.find(function (p) { return p.id === id; }) || { apellido: '—', nombre: '', orientacion: 'bas', materia: '—' }; }
function getLab(id) { return LABS.find(function (l) { return l.id === id; }) || { nombre: '—', ocupado: false, capacidad: 0, notas: '' }; }
function getCurrentProfId() { return (window.SESSION && window.SESSION.id) ? window.SESSION.id : 1; }

// Helper centralizado de rol — usa window.ROLE (SAEP) con fallback a modoUsuario
function esDirectivo() {
  var r = window.ROLE || (window.SESSION && window.SESSION.role) || modoUsuario;
  return ['admin', 'director', 'subdirector'].indexOf(r) >= 0;
}

function getSemanaStart(offset) {
  offset = offset || 0;
  var d = new Date(HOY);
  var dow = d.getDay();
  var lunesDiff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + lunesDiff + (offset * 7));
  return d;
}
function formatFecha(date) { return date.getDate() + '/' + (date.getMonth() + 1); }
function getDiaDate(offset, dia) { var s = getSemanaStart(offset); s.setDate(s.getDate() + dia); return s; }
function esHoy(offset, dia) { var d = getDiaDate(offset, dia); return d.toDateString() === HOY.toDateString(); }

function toast(msg, tipo) {
  tipo = tipo || 'ok';
  var c = document.getElementById('toast-container');
  if (!c) return;
  var t = document.createElement('div');
  t.className = 'toast toast-' + tipo;
  t.setAttribute('role', 'status');
  var icons = { ok: '✓', err: '✗', info: 'ℹ', warn: '⚠' };
  t.innerHTML = '<div class="toast-icon" aria-hidden="true">' + (icons[tipo] || '•') + '</div><span>' + msg + '</span>';
  c.appendChild(t);
  setTimeout(function () { t.style.animation = 'toastOut .3s ease forwards'; setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300); }, 2800);
}

function confirmar(msg, callback) {
  var body = document.getElementById('confirm-body');
  var btn = document.getElementById('confirm-ok-btn');
  if (!body || !btn) return;
  body.innerHTML = '<p>' + msg + '</p>';
  btn.onclick = function () { cerrarModal('modal-confirm'); callback(); };
  abrirModal('modal-confirm');
}

function abrirModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  setTimeout(function () { var f = el.querySelector('button,input,select,textarea'); if (f) f.focus(); }, 100);
}
function cerrarModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// ============================================================
// NAVEGACIÓN
// ============================================================
function navDia(dir) { diaActual = Math.max(0, Math.min(4, diaActual + dir)); renderCalendario(); }
function irDia(d) { diaActual = d; renderCalendario(); }

function irA(pagina) {
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-btn,.mobile-nav-btn').forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-current', 'false'); });
  var pg = document.getElementById('page-' + pagina);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('[data-page="' + pagina + '"]').forEach(function (b) { b.classList.add('active'); b.setAttribute('aria-current', 'page'); });
  if (pagina === 'admin') renderAdmin();
  if (pagina === 'mis-reservas') renderMisReservas();
  closeMobileNav();
}

function toggleMobileNav() {
  var nav = document.getElementById('mobile-nav');
  var ham = document.getElementById('hamburger');
  if (!nav || !ham) return;
  var isOpen = nav.classList.toggle('open');
  ham.classList.toggle('open', isOpen);
  ham.setAttribute('aria-expanded', String(isOpen));
}
function closeMobileNav() {
  var nav = document.getElementById('mobile-nav');
  var ham = document.getElementById('hamburger');
  if (nav) nav.classList.remove('open');
  if (ham) { ham.classList.remove('open'); ham.setAttribute('aria-expanded', 'false'); }
}
function toggleSessionMenu() {
  var m = document.getElementById('session-menu');
  var t = document.getElementById('session-trigger');
  if (!m) return;
  var isOpen = m.classList.toggle('open');
  if (t) t.setAttribute('aria-expanded', String(isOpen));
}
function closeSessionMenu() {
  var m = document.getElementById('session-menu');
  var t = document.getElementById('session-trigger');
  if (m) m.classList.remove('open');
  if (t) t.setAttribute('aria-expanded', 'false');
}
function cerrarSesion() {
  confirmar('¿Cerrar sesión y volver al inicio?', function () {
    // Misma clave canónica que login.html usa para guardar
    sessionStorage.removeItem('SAEP_session_data');
    // replace() para no dejar index.html en el historial
    window.location.replace('login.html');
  });
}
function selOrient(el, orient) {
  document.querySelectorAll('.orient-tab').forEach(function (t) { t.classList.remove('sel'); t.setAttribute('aria-selected', 'false'); });
  el.classList.add('sel'); el.setAttribute('aria-selected', 'true');
  filtroOrient = orient; renderCalendario();
}
function setLabFilter(labId) {
  filtroLab = labId;
  document.querySelectorAll('.lab-card').forEach(function (c) { c.classList.toggle('sel', c.dataset.labId === labId); });
  document.querySelectorAll('.lab-filter-btn').forEach(function (b) { b.classList.remove('active'); });
  var todosBtn = document.getElementById('filt-todos');
  if (todosBtn) todosBtn.classList.toggle('active', labId === 'todos');
  document.querySelectorAll('[data-lab-filter]').forEach(function (b) { b.classList.toggle('active', b.dataset.labFilter === labId); });
  renderCalendario();
}

// ============================================================
// SIDEBAR
// ============================================================
function renderSidebar() {
  var sl = document.getElementById('sidebar-labs');
  if (sl) {
    sl.innerHTML = LABS.map(function (l) {
      return '<div class="lab-card ' + (filtroLab === l.id ? 'sel' : '') + '" data-lab-id="' + l.id + '" onclick="setLabFilter(\'' + l.id + '\')" role="button" tabindex="0"><div class="lab-card-name">' + l.nombre + '</div><div class="lab-card-status ' + (l.ocupado ? 'status-ocup' : 'status-libre') + '"><span class="dot ' + (l.ocupado ? 'dot-ocup' : 'dot-libre') + '"></span>' + (l.ocupado ? 'En mantenimiento' : 'Disponible') + '</div></div>';
    }).join('');
  }
  var reservasSemana = RESERVAS.filter(function (r) { return r.semanaOffset === semanaOffset; });
  var totalEspera = LISTA_ESPERA.filter(function (e) { return e.semanaOffset === semanaOffset; }).length;
  var ms = document.getElementById('mini-stats');
  if (ms) {
    var libres = LABS.filter(function (l) { return !l.ocupado; }).length * 5 * MODULOS_CLASE.length - reservasSemana.length;
    ms.innerHTML = '<div class="mini-stat az"><div class="mini-stat-n">' + reservasSemana.length + '</div><div class="mini-stat-l">Reservas</div></div><div class="mini-stat rj"><div class="mini-stat-n">' + totalEspera + '</div><div class="mini-stat-l">Espera</div></div><div class="mini-stat vd"><div class="mini-stat-n">' + Math.max(0, libres) + '</div><div class="mini-stat-l">Libres</div></div>';
  }
  var pl = document.getElementById('pautas-list');
  if (pl) pl.innerHTML = PAUTAS.map(function (p) { return '<div class="pauta-item"><span class="chk">✓</span>' + p + '</div>'; }).join('');
  var lfb = document.getElementById('lab-filter-btns');
  if (lfb) lfb.innerHTML = LABS.map(function (l) { return '<button class="lab-filter-btn ' + (filtroLab === l.id ? 'active' : '') + '" data-lab-filter="' + l.id + '" onclick="setLabFilter(\'' + l.id + '\')">Lab. ' + l.id + '</button>'; }).join('');
}

// ============================================================
// CALENDARIO
// ============================================================
function renderDayNav() {
  var container = document.getElementById('day-nav-bar');
  if (!container) return;
  var html = '';
  for (var d = 0; d < 5; d++) {
    var fecha = getDiaDate(semanaOffset, d);
    var hoy = esHoy(semanaOffset, d);
    var activo = d === diaActual;

    // Se corrigió '\') por '')
    html += '<button class="day-nav-btn' + (activo ? ' active' : '') + (hoy ? ' hoy' : '') + '" onclick="irDia(' + d + ')"><span class="day-nav-nombre">' + DIAS_SEMANA[d] + '</span><span class="day-nav-fecha">' + formatFecha(fecha) + '</span>' + (hoy ? '<span class="day-nav-hoy-dot"></span>' : '') + '</button>';
  }
  container.innerHTML = html;
}

function renderCalendario() {
  renderSidebar();
  var start = getSemanaStart(semanaOffset);
  var end = new Date(start); end.setDate(end.getDate() + 4);
  var titleEl = document.getElementById('cal-title-text');
  if (titleEl) {
    var fechaDia = getDiaDate(semanaOffset, diaActual);
    titleEl.innerHTML = DIAS_LARGO[diaActual] + ' ' + formatFecha(fechaDia) + '&nbsp;<span style="color:var(--muted);font-weight:400;font-size:13px;">' + fechaDia.getFullYear() + '</span>&nbsp;<span style="color:var(--muted);font-weight:400;font-size:12px;">· Sem. ' + formatFecha(start) + '–' + formatFecha(end) + '</span>';
  }
  renderDayNav();
  var reservasDia = RESERVAS.filter(function (r) { return r.semanaOffset === semanaOffset && r.dia === diaActual; });
  var solicDia = SOLICITUDES.filter(function (s) { return s.semanaOffset === semanaOffset && s.dia === diaActual && s.estado === 'pendiente'; });
  var grid = document.getElementById('cal-body');
  if (!grid) return;
  var labsFiltrados = LABS.filter(function (l) {
    var matchLab = filtroLab === 'todos' || filtroLab === l.id;
    var matchSearch = filtroBusquedaLab === '' || l.nombre.toLowerCase().indexOf(filtroBusquedaLab) !== -1 || l.id.toString().toLowerCase().indexOf(filtroBusquedaLab) !== -1;
    return matchLab && matchSearch;
  });

  // ── NUEVO: filtro de turno ──────────────────────────────────────────────
  var turnosFiltrados = filtroTurno === 'todos'
    ? TURNOS_CONFIG
    : TURNOS_CONFIG.filter(function (tc) { return tc.label === filtroTurno; });
  // ────────────────────────────────────────────────────────────────────────

  var html = '<div class="at-wrap"><table class="at-table" role="grid"><thead>';
  html += '<tr><th class="at-corner" rowspan="2">Espacio</th>';
  turnosFiltrados.forEach(function (tc) {                                          // ← usa turnosFiltrados
    var cols = tc.modulos.filter(function (mid) { return MODULOS_CLASE.find(function (m) { return m.id === mid; }); });
    if (!cols.length) return;
    html += '<th class="at-turno-span" colspan="' + cols.length + '"><span class="at-turno-icon">' + tc.icon + '</span>' + tc.label + '</th>';
    var recreoMod = MODULOS.find(function (m) { return m.tipo === 'recreo' && m.turno === tc.label; });
    if (recreoMod) html += '<th class="at-recreo-col-header">☕</th>';
  });
  html += '</tr><tr>';
  turnosFiltrados.forEach(function (tc) {                                          // ← usa turnosFiltrados
    var cols = tc.modulos.filter(function (mid) { return MODULOS_CLASE.find(function (m) { return m.id === mid; }); });
    if (!cols.length) return;
    cols.forEach(function (mid) {
      var mod = MODULOS_CLASE.find(function (m) { return m.id === mid; });
      html += '<th class="at-hora-header"><span class="at-hora-ini">' + mod.inicio + '</span><span class="at-hora-num">' + mod.label.replace('° Mañana', '°M').replace('° Tarde', '°T').replace('° Vespert.', '°V') + '</span></th>';
    });
    var recreoMod = MODULOS.find(function (m) { return m.tipo === 'recreo' && m.turno === tc.label; });
    if (recreoMod) {
      var recInfo = RECREOS.find(function (r) { return r.modulo === recreoMod.id; });
      html += '<th class="at-recreo-col-header at-recreo-hora"><span style="font-size:9px;display:block;">' + recreoMod.inicio + '</span><button class="at-recreo-edit" onclick="editarRecreo(' + recreoMod.id + ')" title="' + (recInfo ? recInfo.evento : 'Recreo') + '">✏️</button></th>';
    }
  });
  html += '</tr></thead><tbody>';

  labsFiltrados.forEach(function (lab, labIdx) {
    html += '<tr class="at-row' + (labIdx % 2 === 1 ? ' at-row-alt' : '') + '">';
    html += '<td class="at-lab-cell"><div class="at-lab-name">' + lab.nombre + '</div><div class="at-lab-status ' + (lab.ocupado ? 'at-status-ocup' : 'at-status-libre') + '">' + (lab.ocupado ? 'Mantenimiento' : 'Disponible') + '</div></td>';
    turnosFiltrados.forEach(function (tc) {                                        // ← usa turnosFiltrados
      var cols = tc.modulos.filter(function (mid) { return MODULOS_CLASE.find(function (m) { return m.id === mid; }); });
      if (!cols.length) return;
      cols.forEach(function (mid) {
        var r = reservasDia.find(function (x) { return x.modulo === mid && x.lab === lab.id; });
        var s = solicDia.find(function (x) { return x.modulo === mid && x.lab === lab.id; });
        html += '<td class="at-event-cell">';
        if (r) {
          var oris = (r.orient || 'bas').split(',');
          var oriOk = filtroOrient === 'all' || oris.indexOf(filtroOrient) !== -1;
          if (!oriOk) {
            html += '<div class="at-event at-libre" role="button" tabindex="0" onclick="abrirModalReservaSlot(' + diaActual + ',' + mid + ',\'' + lab.id + '\')" title="Disponible"><span class="at-ev-plus">+</span></div>';
          } else {
            // Usar la orientación del filtro para el color, o la primera si es 'all'
            var colorOriId = (filtroOrient !== 'all') ? filtroOrient : oris[0];
            var ori = ORIENTACIONES[colorOriId] || ORIENTACIONES.bas;
            var p = getProfe(r.profeId);
            html += '<div class="at-event ' + ori.ev + '" role="button" tabindex="0" onclick="verDetalle(' + r.id + ')" title="' + r.curso + ' — Prof. ' + p.apellido + '"><div class="at-ev-curso">' + r.curso + ' ' + ori.emoji + '</div><div class="at-ev-prof">' + p.apellido + '</div></div>';
          }
        } else if (s) {
          var action = modoUsuario === 'admin' ? 'verDetalleSolicitud(' + s.id + ')' : 'verDetalle_Pendiente(' + s.id + ')';
          html += '<div class="at-event ev-pendiente" role="button" tabindex="0" onclick="' + action + '" title="Pendiente: ' + s.curso + '"><div class="at-ev-curso">' + s.curso + ' ⏳</div></div>';
        } else {
          html += '<div class="at-event at-libre" role="button" tabindex="0" onclick="abrirModalReservaSlot(' + diaActual + ',' + mid + ',\'' + lab.id + '\')" title="Disponible — clic para reservar"><span class="at-ev-plus">+</span></div>';
        }
        html += '</td>';
      });
      var recreoMod = MODULOS.find(function (m) { return m.tipo === 'recreo' && m.turno === tc.label; });
      if (recreoMod) {
        var recInfo = RECREOS.find(function (r) { return r.modulo === recreoMod.id; });
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
  if (idx >= 0) { RECREOS[idx].evento = evento; RECREOS[idx].notas = notas; }
  else { RECREOS.push({ modulo: moduloId, evento: evento, notas: notas }); }
  saveDB();
  cerrarModal('modal-recreo');
  toast('Recreo actualizado.', 'ok');
  renderCalendario();
}

function verDetalle_Pendiente(solId) { toast('Esa solicitud está pendiente de aprobación del directivo.', 'info'); }

function renderSolicitudesBadge() {
  var pendientes = SOLICITUDES.filter(function (s) { return s.estado === 'pendiente'; }).length;
  var badge = document.getElementById('admin-badge');
  if (badge) { badge.textContent = pendientes || ''; badge.style.display = pendientes ? 'flex' : 'none'; }
}

function renderEsperaCalendario() {
  var el = document.getElementById('espera-lista');
  if (!el) return;
  var espera = LISTA_ESPERA.filter(function (e) { return e.semanaOffset === semanaOffset; });
  if (!espera.length) { el.innerHTML = '<div class="empty-state">No hay docentes en lista de espera esta semana.</div>'; return; }
  var bgColors = ['var(--navy)', 'var(--red)', 'var(--green)', 'var(--amber)'];
  var esDir = esDirectivo();
  el.innerHTML = espera.map(function (e, i) {
    var p = getProfe(e.profeId); var fecha = getDiaDate(e.semanaOffset, e.dia); var mod = getModulo(e.modulo);
    // R1a: botón Asignar solo para directivos; botón ✕ también solo para directivos
    var acciones = (esDir
      ? '<button class="espera-btn" onclick="promoverEspera(' + e.id + ')">✓ Asignar</button><button class="espera-btn cancel" onclick="quitarEspera(' + e.id + ')">✕</button>'
      : '');
    return '<div class="espera-item"><div class="espera-badge" style="background:' + bgColors[i % 4] + '">' + (i + 1) + '</div><div style="flex:1;min-width:0;"><div class="item-name">Prof. ' + p.apellido + '</div><div class="item-sub">' + DIAS_SEMANA[e.dia] + ' ' + formatFecha(fecha) + ' · ' + mod.label + ' · Lab.' + e.lab + '</div></div><div class="espera-actions">' + acciones + '</div></div>';
  }).join('');
}

function renderVencimientosCalendario() {
  var el = document.getElementById('venc-lista');
  if (!el) return;
  var hoyRes = RESERVAS.filter(function (r) { return r.semanaOffset === semanaOffset; });
  if (!hoyRes.length) { el.innerHTML = '<div class="empty-state">No hay reservas esta semana.</div>'; return; }
  var sorted = [].concat(hoyRes).sort(function (a, b) { return b.cicloClases - a.cicloClases; });
  var colores = { 3: 'var(--red)', 2: 'var(--amber)', 1: 'var(--green)' };
  el.innerHTML = sorted.slice(0, 6).map(function (r) {
    var p = getProfe(r.profeId); var ori = ORIENTACIONES[r.orient];
    return '<div class="list-item"><div class="venc-dot" style="background:' + (colores[r.cicloClases] || 'var(--green)') + '"></div><div style="flex:1;"><div class="item-name">' + r.curso + ' ' + ori.emoji + ' ' + ori.nombre + '</div><div class="item-sub">Clase ' + r.cicloClases + '/3 · Lab.' + r.lab + ' · Prof. ' + p.apellido + '</div></div>' + (r.cicloClases >= 3 ? '<button class="espera-btn" onclick="renovarReserva(' + r.id + ')">↻ Renovar</button>' : '') + '</div>';
  }).join('');
}

function navSemana(dir) { semanaOffset += dir; renderCalendario(); }
function irHoy() {
  semanaOffset = 0;
  var dow = new Date().getDay();
  diaActual = dow === 0 ? 4 : (dow === 6 ? 0 : dow - 1);
  diaActual = Math.max(0, Math.min(4, diaActual));
  renderCalendario();
}

// ============================================================
// DETALLE DE RESERVA
// ============================================================
function verDetalle(reservaId) {
  var r = RESERVAS.find(function (x) { return x.id === reservaId; }); if (!r) return;
  var p = getProfe(r.profeId); var ori = ORIENTACIONES[r.orient];
  var fecha = getDiaDate(r.semanaOffset, r.dia); var mod = getModulo(r.modulo);
  var pct = (r.cicloClases / 3) * 100;
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
      '<div style="margin-top:14px;"><div class="ciclo-bar-label"><span style="font-size:12px;font-weight:700;">Ciclo didáctico</span><span style="font-size:11px;color:var(--muted);">Clase ' + r.cicloClases + ' de 3' + (r.renovaciones ? '&nbsp;&nbsp;<span style="font-weight:700;color:var(--navy);">Renovación ' + r.renovaciones + '/1</span>' : '') + '</span></div><div class="ciclo-bar"><div class="ciclo-bar-fill ' + barClass + '" style="width:' + pct + '%"></div></div></div>';
  }
  var footer = document.getElementById('modal-detalle-footer');
  if (footer) {
    var isOwn = esDirectivo() || r.profeId === getCurrentProfId();
    var renovBtn = '';
    // R1b: botón renovar solo para directivos
    if (isOwn && r.cicloClases >= 3 && esDirectivo()) {
      var renov = r.renovaciones || 0;
      renovBtn = renov >= 1
        ? '<button class="btn-ok" onclick="cerrarModal(\'modal-detalle\');renovarReserva(' + r.id + ')">🔄 Nueva reserva</button>'
        : '<button class="btn-ok" onclick="renovarReserva(' + r.id + ');cerrarModal(\'modal-detalle\')">↻ Solicitar renovación</button>';
    }
    footer.innerHTML = '<button class="btn-cancel" onclick="cerrarModal(\'modal-detalle\')">Cerrar</button>' + renovBtn + (isOwn ? '<button class="btn-ok" style="background:var(--amber);color:#333;" onclick="cerrarModal(\'modal-detalle\');abrirModalReasignar(' + r.id + ')">🔀 Reasignar</button>' : '') + (isOwn ? '<button class="btn-danger" onclick="cerrarModal(\'modal-detalle\');cancelarReserva(' + r.id + ')">Cancelar reserva</button>' : '');
  }
  abrirModal('modal-detalle');
}

function verDetalleSolicitud(solId) {
  var s = SOLICITUDES.find(function (x) { return x.id === solId; }); if (!s) return;
  var p = getProfe(s.profeId); var ori = ORIENTACIONES[s.orient];
  var fecha = getDiaDate(s.semanaOffset, s.dia); var mod = getModulo(s.modulo);
  var body = document.getElementById('modal-detalle-body');
  if (body) {
    body.innerHTML =
      '<div class="pending-alert" role="status">⏳ ' + (s.esRenovacion ? 'Solicitud de <strong>renovación semana ' + s.renovacionNum + '/1</strong> — pendiente de aprobación.' : 'Esta solicitud está <strong>pendiente de aprobación</strong>.') + '</div>' +
      '<div class="detail-row"><div class="detail-label">Docente</div><div class="detail-value">Prof. ' + p.apellido + ', ' + p.nombre + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Laboratorio</div><div class="detail-value">' + getLab(s.lab).nombre + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Fecha / Módulo</div><div class="detail-value">' + DIAS_LARGO[s.dia] + ' ' + formatFecha(fecha) + ' · ' + mod.label + ' (' + mod.inicio + '–' + mod.fin + ')</div></div>' +
      '<div class="detail-row"><div class="detail-label">Curso</div><div class="detail-value">' + s.curso + '</div></div>' +
      '<div class="detail-row"><div class="detail-label">Orientación</div><div class="detail-value"><span class="orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></div></div>' +
      '<div class="detail-row"><div class="detail-label">Secuencia</div><div class="detail-value" style="font-style:italic;color:var(--muted);">"' + s.secuencia + '"</div></div>';
  }
  var footer = document.getElementById('modal-detalle-footer');
  if (footer) {
    footer.innerHTML = '<button class="btn-cancel" onclick="cerrarModal(\'modal-detalle\')">Cerrar</button><button class="btn-danger" onclick="cerrarModal(\'modal-detalle\');rechazarSolicitud(' + s.id + ')">✕ Rechazar</button><button class="btn-ok" onclick="cerrarModal(\'modal-detalle\');aceptarSolicitud(' + s.id + ')">✓ Aprobar</button>';
  }
  abrirModal('modal-detalle');
}

// ============================================================
// APROBAR / RECHAZAR SOLICITUDES
// ============================================================
function aceptarSolicitud(solId) {
  if (modoUsuario !== 'admin') { toast('Solo el directivo puede aprobar solicitudes.', 'err'); return; }
  var s = SOLICITUDES.find(function (x) { return x.id === solId; }); if (!s) return;
  var conflicto = RESERVAS.find(function (r) { return r.semanaOffset === s.semanaOffset && r.dia === s.dia && r.modulo === s.modulo && r.lab === s.lab; });
  if (conflicto) { toast('Ese turno fue ocupado mientras estaba pendiente.', 'warn'); return; }
  if (s.esRenovacion && s.reservaOriginalId) {
    var rOrig = RESERVAS.find(function (x) { return x.id === s.reservaOriginalId; });
    if (rOrig) { rOrig.cicloClases = 1; rOrig.renovaciones = (rOrig.renovaciones || 0) + 1; }
    else { nextId++; RESERVAS.push({ id: nextId, semanaOffset: s.semanaOffset, dia: s.dia, modulo: s.modulo, lab: s.lab, curso: s.curso, orient: s.orient, profeId: s.profeId, secuencia: s.secuencia, cicloClases: 1, renovaciones: s.renovacionNum || 1 }); }
    SOLICITUDES = SOLICITUDES.filter(function (x) { return x.id !== solId; });
    saveDB(); toast('Renovación semana ' + s.renovacionNum + '/1 aprobada.', 'ok'); renderAll(); return;
  }
  nextId++;
  RESERVAS.push({ id: nextId, semanaOffset: s.semanaOffset, dia: s.dia, modulo: s.modulo, lab: s.lab, curso: s.curso, orient: s.orient, profeId: s.profeId, secuencia: s.secuencia, cicloClases: 1, renovaciones: 0 });
  SOLICITUDES = SOLICITUDES.filter(function (x) { return x.id !== solId; });
  saveDB(); toast('Solicitud aprobada. Reserva confirmada.', 'ok'); renderAll();
}
function rechazarSolicitud(solId) {
  if (modoUsuario !== 'admin') { toast('Solo el directivo puede rechazar solicitudes.', 'err'); return; }
  var s = SOLICITUDES.find(function (x) { return x.id === solId; }); if (!s) return;
  var p = getProfe(s.profeId);
  confirmar('¿Rechazar la solicitud de <strong>Prof. ' + p.apellido + '</strong> — ' + s.curso + '?', function () {
    SOLICITUDES = SOLICITUDES.filter(function (x) { return x.id !== solId; });
    saveDB(); toast('Solicitud rechazada.', 'info'); renderAll();
  });
}

// ============================================================
// MODAL RESERVA
// ============================================================
function poblarSelectsReserva() {
  ['f-lab', 'espera-lab'].forEach(function (sid) {
    var sel = document.getElementById(sid); if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar laboratorio…</option>' + LABS.filter(function (l) { return !l.ocupado; }).map(function (l) { return '<option value="' + l.id + '">' + l.nombre + '</option>'; }).join('');
  });
  ['f-dia', 'espera-dia'].forEach(function (sid) {
    var sel = document.getElementById(sid); if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar día…</option>';
    for (var d = 0; d < 5; d++) { var f = getDiaDate(semanaOffset, d); sel.innerHTML += '<option value="' + d + '">' + DIAS_SEMANA[d] + ' ' + formatFecha(f) + '</option>'; }
  });
  ['f-modulo', 'espera-modulo'].forEach(function (sid) {
    var sel = document.getElementById(sid); if (!sel) return;
    var opts = '<option value="">Seleccionar módulo…</option>';
    var turnoActual = '';
    MODULOS_CLASE.forEach(function (m) {
      if (m.turno !== turnoActual) { if (turnoActual) opts += '</optgroup>'; opts += '<optgroup label="' + m.turno + '">'; turnoActual = m.turno; }
      opts += '<option value="' + m.id + '">' + m.label + ' (' + m.inicio + '–' + m.fin + ')</option>';
    });
    if (turnoActual) opts += '</optgroup>';
    sel.innerHTML = opts;
  });
  var fPeriodo = document.getElementById('f-periodo');
  if (fPeriodo) {
    var opts = '<option value="1">1 hora (módulo individual)</option><option value="2">2 horas consecutivas</option><option value="4">4 horas consecutivas</option>';
    TURNOS_CONFIG.forEach(function (t) { opts += '<option value="turno_' + t.label + '">' + t.icon + ' Turno completo ' + t.label + ' (' + t.modulos.length + ' hs)</option>'; });
    fPeriodo.innerHTML = opts;
  }
  var fOrient = document.getElementById('f-orient');
  if (fOrient) {
    fOrient.innerHTML = Object.keys(ORIENTACIONES).map(function (k) { var o = ORIENTACIONES[k]; return '<option value="' + k + '">' + o.emoji + ' ' + o.nombre + '</option>'; }).join('');
  }
}

function abrirModalReserva() {
  poblarSelectsReserva();
  ['f-lab', 'f-dia', 'f-curso', 'f-secuencia'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  UIHelper.setOrientValues('f-orient-group', 'bas');
  var fmod = document.getElementById('f-modulo'); if (fmod) fmod.value = '';
  var fper = document.getElementById('f-periodo'); if (fper) fper.value = '1';
  var cw = document.getElementById('conflict-warning'); if (cw) cw.classList.remove('show');

  // FIX: window.ROLE es undefined en standalone → usar esDirectivo()
  var anualWrap = document.getElementById('f-anual-wrap');
  var anualChk = document.getElementById('f-anual');
  if (anualWrap) anualWrap.style.display = esDirectivo() ? 'block' : 'none';
  if (anualChk) anualChk.checked = false;

  abrirModal('modal-reserva');
}

function abrirModalReservaSlot(dia, modulo, lab) {
  poblarSelectsReserva();
  var fLab = document.getElementById('f-lab');
  var fDia = document.getElementById('f-dia');
  var fMod = document.getElementById('f-modulo');
  if (fLab) fLab.value = lab;
  if (fDia) fDia.value = dia;
  if (fMod) fMod.value = modulo;
  var fCurso = document.getElementById('f-curso');
  var fSeq = document.getElementById('f-secuencia');
  if (fCurso) fCurso.value = '';
  if (fSeq) fSeq.value = '';
  UIHelper.setOrientValues('f-orient-group', 'bas');
  checkConflict();

  // Checkbox anual: AGREGADO A ESTA FUNCIÓN TAMBIÉN
  var anualWrap = document.getElementById('f-anual-wrap');
  var anualChk = document.getElementById('f-anual');
  if (anualWrap) anualWrap.style.display = esDirectivo() ? 'block' : 'none';
  if (anualChk) anualChk.checked = false;

  abrirModal('modal-reserva');
}

function checkConflict() {
  var lab = document.getElementById('f-lab'); var dia = document.getElementById('f-dia'); var mod = document.getElementById('f-modulo'); var cw = document.getElementById('conflict-warning');
  if (!lab || !dia || !mod || !cw) return;
  if (!lab.value || dia.value === '' || mod.value === '') { cw.classList.remove('show'); return; }
  var conflict = RESERVAS.find(function (r) { return r.semanaOffset === semanaOffset && r.dia === parseInt(dia.value) && r.modulo === parseInt(mod.value) && r.lab === lab.value; });
  var solConflict = SOLICITUDES.find(function (s) { return s.semanaOffset === semanaOffset && s.dia === parseInt(dia.value) && s.modulo === parseInt(mod.value) && s.lab === lab.value && s.estado === 'pendiente'; });
  cw.classList.toggle('show', !!(conflict || solConflict));
}

function getModulosParaPeriodo(moduloBase, periodoVal) {
  if (typeof periodoVal === 'string' && periodoVal.indexOf('turno_') === 0) {
    var turnoNombre = periodoVal.replace('turno_', '');
    var tc = TURNOS_CONFIG.find(function (t) { return t.label === turnoNombre; });
    return tc ? tc.modulos : [moduloBase];
  }
  var n = parseInt(periodoVal) || 1;
  if (n === 1) return [moduloBase];
  var idx = MODULOS_CLASE.findIndex(function (m) { return m.id === moduloBase; });
  if (idx < 0) return [moduloBase];
  return MODULOS_CLASE.slice(idx, idx + n).map(function (m) { return m.id; });
}

function guardarReserva() {
  var lab = document.getElementById('f-lab').value;
  var dia = document.getElementById('f-dia').value;
  var modulo = document.getElementById('f-modulo').value;
  var curso = document.getElementById('f-curso').value.trim();
  var secuencia = document.getElementById('f-secuencia').value.trim();
  var orient = document.getElementById('f-orient').value;
  var periodoEl = document.getElementById('f-periodo');
  var periodo = periodoEl ? periodoEl.value : '1';
  var anualChk = document.querySelector('#modal-reserva #f-anual');
  var esAnual = esDirectivo() && anualChk !== null && anualChk.checked;
  console.log("TEST FINAL ->", { esDirectivo: esDirectivo(), existeCheckbox: !!anualChk, estaMarcado: anualChk ? anualChk.checked : false, esAnualFinal: esAnual });

  if (!lab || dia === '' || modulo === '' || !curso || !secuencia) { toast('Por favor completá todos los campos.', 'err'); return; }
  var modulosAReservar = getModulosParaPeriodo(parseInt(modulo), periodo);

  // CORREGIDO: parseInt fuerza tipo en ambos extremos del for y en los sem pusheados
  var semanaBase = parseInt(semanaOffset, 10);
  var semanasAReservar = [semanaBase];
  if (esAnual) {
    semanasAReservar = [];
    for (var sw = semanaBase; sw < semanaBase + 40; sw++) semanasAReservar.push(sw);
  }

  // Error 1 corregido: validación estricta solo si NO es anual
  // Si es anual, el forEach inferior maneja los conflictos silenciosamente
  if (!esAnual) {
    for (var mi = 0; mi < modulosAReservar.length; mi++) {
      var m = modulosAReservar[mi];
      var conflicto = RESERVAS.find(function (r) { return r.semanaOffset === semanaOffset && r.dia === parseInt(dia) && r.modulo === m && r.lab === lab; });
      if (conflicto) { toast('El módulo ' + getModulo(m).label + ' ya está reservado en esta semana.', 'warn'); return; }
      var solicPendiente = SOLICITUDES.find(function (s) { return s.semanaOffset === semanaOffset && s.dia === parseInt(dia) && s.modulo === m && s.lab === lab && s.estado === 'pendiente'; });
      if (solicPendiente) { toast('El módulo ' + getModulo(m).label + ' ya tiene solicitud pendiente.', 'warn'); return; }
    }
  }



  // Cambiamos modoUsuario==='admin' por tu helper esDirectivo()
  if (esDirectivo()) {
    var totalCreadas = 0;
    semanasAReservar.forEach(function (sem) {
      modulosAReservar.forEach(function (m) {
        var yaExiste = RESERVAS.find(function (r) { return r.semanaOffset === sem && r.dia === parseInt(dia) && r.modulo === m && r.lab === lab; });
        if (yaExiste) return;
        nextId++;
        RESERVAS.push({
          id: nextId, semanaOffset: parseInt(sem, 10), dia: parseInt(dia, 10), modulo: m, lab: lab,
          curso: curso, orient: orient,
          profeId: esAnual ? 'institucional' : getCurrentProfId(),
          secuencia: secuencia, cicloClases: 1, renovaciones: 0,
          anual: esAnual
        });
        totalCreadas++;
      });
    });
    try {
      saveDB();
    } catch (e) {
      toast('Error al guardar: almacenamiento lleno. Intentá exportar y limpiar la BD.', 'err');
      console.error('[guardarReserva] saveDB falló:', e);
      return; // no cerrar modal, no renderizar con datos inconsistentes
    }

    cerrarModal('modal-reserva'); // ← movido DESPUÉS de saveDB
    if (esAnual) {
      toast('Reserva anual creada: ' + totalCreadas + ' entradas para ~40 semanas.', 'ok');
    } else {
      toast('Reserva creada (' + totalCreadas + ' módulo' + (totalCreadas > 1 ? 's' : '') + ').', 'ok');
    }

  } else {
    // Profesor: siempre solicitud, nunca anual
    modulosAReservar.forEach(function (m) {
      nextId++;
      SOLICITUDES.push({ id: nextId, semanaOffset: semanaOffset, dia: parseInt(dia), modulo: m, lab: lab, curso: curso, orient: orient, profeId: getCurrentProfId(), secuencia: secuencia, cicloClases: 1, estado: 'pendiente', esRenovacion: false, renovacionNum: 0, anual: false });
    });
    cerrarModal('modal-reserva'); // ← Asegúrate de que el modal también se cierre para el profesor
    saveDB();
    toast('Solicitud enviada (' + modulosAReservar.length + ' módulo' + (modulosAReservar.length > 1 ? 's' : '') + ').', 'info');
  }
  renderAll();
}

// ============================================================
// LISTA DE ESPERA
// ============================================================
function abrirModalEspera() {
  poblarSelectsReserva();
  ['espera-lab', 'espera-dia', 'espera-modulo'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  abrirModal('modal-espera');
}
function guardarEspera() {
  var lab = document.getElementById('espera-lab').value;
  var dia = document.getElementById('espera-dia').value;
  var modulo = document.getElementById('espera-modulo').value;
  if (!lab || dia === '' || modulo === '') { toast('Completá todos los campos.', 'err'); return; }
  var ocupado = RESERVAS.find(function (r) { return r.semanaOffset === semanaOffset && r.dia === parseInt(dia) && r.modulo === parseInt(modulo) && r.lab === lab; });
  if (!ocupado) { toast('Ese turno está disponible. Podés solicitarlo directamente.', 'info'); cerrarModal('modal-espera'); abrirModalReservaSlot(parseInt(dia), parseInt(modulo), lab); return; }
  var yaEnEspera = LISTA_ESPERA.find(function (e) { return e.profeId === getCurrentProfId() && e.lab === lab && e.dia === parseInt(dia) && e.modulo === parseInt(modulo) && e.semanaOffset === semanaOffset; });
  if (yaEnEspera) { toast('Ya estás anotado en espera para ese turno.', 'warn'); cerrarModal('modal-espera'); return; }
  nextId++;
  LISTA_ESPERA.push({ id: nextId, profeId: getCurrentProfId(), lab: lab, dia: parseInt(dia), modulo: parseInt(modulo), semanaOffset: semanaOffset });
  cerrarModal('modal-espera');
  saveDB(); toast('Anotado en lista de espera.', 'ok'); renderAll();
}
function quitarEspera(id) {
  confirmar('¿Querés quitarte de la lista de espera?', function () {
    LISTA_ESPERA = LISTA_ESPERA.filter(function (e) { return e.id !== id; });
    saveDB(); toast('Removido de lista de espera.', 'info'); renderAll();
  });
}
function promoverEspera(id) {
  var e = LISTA_ESPERA.find(function (x) { return x.id === id; }); if (!e) return;
  var ocupado = RESERVAS.find(function (r) { return r.semanaOffset === e.semanaOffset && r.dia === e.dia && r.modulo === e.modulo && r.lab === e.lab; });
  if (ocupado) { toast('Ese turno sigue ocupado.', 'warn'); return; }
  var p = getProfe(e.profeId);
  nextId++;
  RESERVAS.push({ id: nextId, semanaOffset: e.semanaOffset, dia: e.dia, modulo: e.modulo, lab: e.lab, curso: '—', orient: p.orientacion || 'bas', profeId: e.profeId, secuencia: '(asignado desde espera)', cicloClases: 1, renovaciones: 0 });
  LISTA_ESPERA = LISTA_ESPERA.filter(function (x) { return x.id !== id; });
  saveDB(); toast('Turno asignado a Prof. ' + p.apellido + '.', 'ok'); renderAll();
}

// ============================================================
// MIS RESERVAS
// ============================================================
function renderMisReservas() {
  var isAdmin = modoUsuario === 'admin';
  var profId = getCurrentProfId();
  var titleEl = document.getElementById('mis-reservas-title');
  var subEl = document.getElementById('mis-reservas-sub');
  if (titleEl) titleEl.textContent = isAdmin ? 'Todas las reservas' : 'Mis reservas';
  if (subEl) subEl.textContent = isAdmin ? 'Vista directiva · todos los docentes' : (window.SESSION ? window.SESSION.display : '');
  var misRes = isAdmin ? [].concat(RESERVAS).sort(function (a, b) { return a.dia - b.dia || a.modulo - b.modulo; }) : RESERVAS.filter(function (r) { return r.profeId === profId; }).sort(function (a, b) { return a.dia - b.dia || a.modulo - b.modulo; });
  var misSols = isAdmin ? [] : SOLICITUDES.filter(function (s) { return s.profeId === profId && s.estado === 'pendiente'; });
  var strip = document.getElementById('mis-stats-strip');
  if (strip) {
    strip.innerHTML =
      '<div class="stat-card az"><div class="stat-card-n">' + misRes.length + '</div><div class="stat-card-l">' + (isAdmin ? 'Reservas totales' : 'Activas') + '</div></div>' +
      (!isAdmin ? '<div class="stat-card am"><div class="stat-card-n">' + misSols.length + '</div><div class="stat-card-l">Pendientes</div></div>' : '') +
      '<div class="stat-card rj"><div class="stat-card-n">' + misRes.filter(function (r) { return r.cicloClases >= 3; }).length + '</div><div class="stat-card-l">A renovar</div></div>' +
      (isAdmin ? '<div class="stat-card vd"><div class="stat-card-n">' + PROFESORES.length + '</div><div class="stat-card-l">Docentes</div></div>' : '');
  }
  var list = document.getElementById('mis-reservas-list');
  var empty = document.getElementById('mis-reservas-empty');
  if (!list) return;
  if (!misRes.length && !misSols.length) { list.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  var solHtml = '';
  if (misSols.length) {
    solHtml = '<div class="section-label-strip">⏳ Solicitudes pendientes de aprobación</div><div class="reservas-grid">' + misSols.map(function (s) {
      var ori = ORIENTACIONES[s.orient]; var lab = getLab(s.lab); var mod = getModulo(s.modulo);
      return '<div class="reserva-card reserva-card-pending"><div class="reserva-card-stripe ' + s.orient + '"></div><div class="reserva-card-body"><div class="reserva-card-header"><div><div class="reserva-card-title">' + lab.nombre + '</div><div class="reserva-meta"><span class="meta-tag">' + DIAS_LARGO[s.dia] + ' ' + mod.inicio + '</span><span class="meta-tag orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span></div></div><div class="reserva-curso-badge">' + s.curso + '</div></div><div class="reserva-secuencia">"' + s.secuencia + '"</div><div class="pending-status-bar">⏳ Pendiente de aprobación directiva</div></div><div class="reserva-card-footer"><button class="btn-action btn-cancel-r" onclick="cancelarSolicitud(' + s.id + ')">Cancelar solicitud</button></div></div>';
    }).join('') + '</div>';
  }
  var reservasHtml = '';
  if (misRes.length) {
    reservasHtml = '<div class="reservas-grid">' + misRes.map(function (r) {
      var p = getProfe(r.profeId); var ori = ORIENTACIONES[r.orient]; var lab = getLab(r.lab); var mod = getModulo(r.modulo);
      var needsRenew = r.cicloClases >= 3;
      var dots = [1, 2, 3].map(function (i) { var cls = 'empty'; if (i < r.cicloClases) cls = 'done'; else if (i === r.cicloClases) cls = needsRenew ? 'warn' : 'current'; return '<div class="ciclo-dot ' + cls + '"></div>'; }).join('');
      return '<div class="reserva-card"><div class="reserva-card-stripe ' + r.orient + '"></div><div class="reserva-card-body"><div class="reserva-card-header"><div><div class="reserva-card-title">' + lab.nombre + '</div><div class="reserva-meta"><span class="meta-tag">' + DIAS_LARGO[r.dia] + ' ' + mod.inicio + '</span><span class="meta-tag orient-badge ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span>' + (isAdmin ? '<span class="meta-tag">Prof. ' + p.apellido + '</span>' : '') + '</div></div><div class="reserva-curso-badge">' + r.curso + '</div></div><div class="reserva-secuencia">"' + r.secuencia + '"</div><div class="ciclo-wrap"><div class="ciclo-dots">' + dots + '</div><span class="ciclo-text ' + (needsRenew ? 'renew' : '') + '">Clase ' + r.cicloClases + '/3' + (needsRenew ? ((r.renovaciones || 0) >= 1 ? ' · ¡Nueva reserva!' : ' · Renovar ' + ((r.renovaciones || 0) + 1) + '/1') : '') + '</span></div></div><div class="reserva-card-footer"><button class="btn-action btn-detail" onclick="verDetalle(' + r.id + ')">Ver detalle</button>'// DESPUÉS: botón Renovar solo visible para directivos
        + (needsRenew && esDirectivo() ? '<button class="btn-action btn-renew" onclick="renovarReserva(' + r.id + ')">↻ Renovar</button>' : '') + '<button class="btn-action btn-cancel-r" onclick="cancelarReserva(' + r.id + ')">Cancelar</button></div></div>';
    }).join('') + '</div>';
  }
  list.innerHTML = solHtml + reservasHtml;
}

function cancelarSolicitud(solId) {
  var s = SOLICITUDES.find(function (x) { return x.id === solId; }); if (!s) return;
  confirmar('¿Cancelar esta solicitud pendiente?', function () {
    SOLICITUDES = SOLICITUDES.filter(function (x) { return x.id !== solId; });
    saveDB(); toast('Solicitud cancelada.', 'info'); renderAll();
  });
}
function renovarReserva(id) {
  var r = RESERVAS.find(function (x) { return x.id === id; }); if (!r) return;
  if (modoUsuario === 'admin') {
    var puedeNueva = (r.renovaciones || 0) >= 1;
    if (puedeNueva) {
      confirmar('Han pasado 1 semana de renovaciones. ¿Iniciar nuevo ciclo completo de 3 clases?', function () {
        r.cicloClases = 1; r.renovaciones = 0;
        saveDB(); toast('Nuevo ciclo completo iniciado.', 'ok'); renderAll();
      });
    } else {
      confirmar('¿Aprobar renovación por 1 día para ' + getLab(r.lab).nombre + ' — ' + r.curso + '?', function () {
        r.cicloClases = 1; r.renovaciones = (r.renovaciones || 0) + 1;
        saveDB(); toast('Renovación aprobada (semana ' + r.renovaciones + '/1).', 'ok'); renderAll();
      });
    }
    return;
  }
  if ((r.renovaciones || 0) >= 1) { toast('Ya cumpliste 1 semana de renovación. Podés hacer una nueva reserva normalmente.', 'info'); return; }
  var semLabel = (r.renovaciones || 0) + 1;
  confirmar('¿Solicitar renovación semanal ' + semLabel + '/1 para <strong>' + getLab(r.lab).nombre + ' — ' + r.curso + '</strong>?', function () {
    nextId++;
    SOLICITUDES.push({ id: nextId, semanaOffset: semanaOffset, dia: r.dia, modulo: r.modulo, lab: r.lab, curso: r.curso, orient: r.orient, profeId: r.profeId, secuencia: r.secuencia, cicloClases: 1, estado: 'pendiente', esRenovacion: true, reservaOriginalId: r.id, renovacionNum: semLabel });
    saveDB(); toast('Solicitud de renovación semana ' + semLabel + '/1 enviada.', 'info'); renderAll();
  });
}
function cancelarReserva(id) {
  var r = RESERVAS.find(function (x) { return x.id === id; }); if (!r) return;
  var p = getProfe(r.profeId);
  var msg = '¿Cancelar la reserva de <strong>Prof. ' + p.apellido + '</strong> — ' + r.curso + ' el ' + DIAS_LARGO[r.dia] + '?';

  if (r.anual && esDirectivo()) {
    confirmarOpciones('Esta es una <strong>reserva anual</strong>. ¿Deseas eliminar solo esta fecha o toda la serie del año?', {
      ok: { texto: 'Solo esta fecha', callback: function () { ejecutarCancelacionApp(id); } },
      extra: {
        texto: 'Toda la serie anual',
        style: { background: 'var(--red)', borderColor: 'var(--red)' },
        callback: function () { cancelarSerieAnualApp(r); }
      }
    });
  } else {
    confirmar(msg, function () { ejecutarCancelacionApp(id); });
  }
}
function ejecutarCancelacionApp(id) {
  var r = RESERVAS.find(function (x) { return x.id === id; }); if (!r) return;
  RESERVAS = RESERVAS.filter(function (x) { return x.id !== id; });
  saveDB(); toast('Reserva cancelada.', 'info');
  var waiting = LISTA_ESPERA.filter(function (e) { return e.lab === r.lab && e.dia === r.dia && e.modulo === r.modulo; });
  if (waiting.length) setTimeout(function () { toast('Hay ' + waiting.length + ' docente(s) en espera para ese turno.', 'warn'); }, 400);
  renderAll();
}
function cancelarSerieAnualApp(rBase) {
  var cOrig = rBase.curso, pOrig = rBase.profeId, lOrig = rBase.lab, dOrig = rBase.dia;
  var total = RESERVAS.length;
  RESERVAS = RESERVAS.filter(function (x) {
    return !(x.lab === lOrig && x.dia === dOrig && x.profeId === pOrig && x.curso === cOrig && x.anual === true);
  });
  saveDB(); toast('Se eliminaron ' + (total - RESERVAS.length) + ' reservas de la serie anual.', 'ok');
  renderAll();
}

// ============================================================
// ADMIN
// ============================================================
function renderAdmin() {
  var total = RESERVAS.length;
  var pendientes = SOLICITUDES.filter(function (s) { return s.estado === 'pendiente'; }).length;
  var docActivos = new Set(RESERVAS.map(function (r) { return r.profeId; })).size;
  var labs = LABS.length;
  ['s-semana', 's-pendientes', 's-docs', 's-labs'].forEach(function (id, i) {
    var el = document.getElementById(id); if (el) el.textContent = [total, pendientes, docActivos, labs][i];
  });
  renderSolicitudesAdmin(); renderProfesores(); renderLabsConfig(); renderAdminReservas(); renderPautasAdmin();
}

function renderSolicitudesAdmin() {
  var el = document.getElementById('solicitudes-tbody'); if (!el) return;
  var solic = SOLICITUDES.filter(function (s) { return s.estado === 'pendiente'; });
  var count = document.getElementById('solicitudes-count');
  if (count) count.textContent = solic.length ? '(' + solic.length + ')' : '';
  if (!solic.length) { el.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px;">No hay solicitudes pendientes.</td></tr>'; return; }
  el.innerHTML = solic.map(function (s) {
    var oris = (s.orient || 'bas').split(',');
    var orientBadges = oris.map(function (o) {
      var ori = ORIENTACIONES[o] || ORIENTACIONES.bas;
      return '<span class="orient-badge mini ' + ori.ob + '">' + ori.emoji + ' ' + ori.nombre + '</span>';
    }).join('');
    return '<tr' + (s.esRenovacion ? ' style="background:#eff6ff"' : '') + '><td>Prof. ' + p.apellido + '</td><td>Lab.' + s.lab + (s.esRenovacion ? '&nbsp;<span style="font-size:9px;font-weight:700;background:var(--navy);color:#fff;padding:1px 4px;border-radius:3px;">RENOV ' + s.renovacionNum + '/1</span>' : '') + '</td><td>' + DIAS_SEMANA[s.dia] + ' ' + formatFecha(fecha) + '</td><td>' + mod.label + ' (' + mod.inicio + ')</td><td>' + s.curso + '</td><td><div class="orient-badge-group">' + orientBadges + '</div></td><td><div class="table-actions"><button class="tbl-btn ok" onclick="aceptarSolicitud(' + s.id + ')">✓ Aprobar</button><button class="tbl-btn danger" onclick="rechazarSolicitud(' + s.id + ')">✕ Rechazar</button></div></td></tr>';
  }).join('');
}

function renderProfesores() {
  var qEl = document.getElementById('search-prof'); var q = qEl ? qEl.value.toLowerCase() : '';
  var tbody = document.getElementById('prof-tbody'); if (!tbody) return;

  var filtered = PROFESORES.filter(function (p) { return (p.apellido + ' ' + p.nombre + ' ' + p.materia).toLowerCase().indexOf(q) >= 0; });

  // Paginación
  var totalPags = Math.max(1, Math.ceil(filtered.length / PROFS_PER_PAGE));
  if (pagActualProfesores > totalPags) pagActualProfesores = totalPags;

  var inicio = (pagActualProfesores - 1) * PROFS_PER_PAGE;
  var fin = inicio + PROFS_PER_PAGE;
  var slice = filtered.slice(inicio, fin);

  tbody.innerHTML = slice.map(function (p) {
    var oris = (p.orientacion || 'bas').split(',');
    var orientBadges = oris.map(function (o) {
      var ori = ORIENTACIONES[o] || ORIENTACIONES.bas;
      return '<span class="orient-badge mini ' + ori.ob + '">' + ori.emoji + '</span>';
    }).join('');
    var reservas = RESERVAS.filter(function (r) { return r.profeId === p.id; }).length;
    return '<tr><td><strong>' + p.apellido + '</strong>, ' + p.nombre + '</td><td>' + p.materia + '</td><td><div class="orient-badge-group">' + orientBadges + '</div></td><td><strong>' + reservas + '</strong></td><td><div class="table-actions"><button class="tbl-btn" onclick="editarDocente(' + p.id + ')">✏️ Editar</button><button class="tbl-btn danger" onclick="eliminarDocente(' + p.id + ')">🗑</button></div></td></tr>';
  }).join('');

  if (!filtered.length) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">No se encontraron docentes.</td></tr>';

  // Actualizar UI de paginación
  var info = document.getElementById('prof-pag-info');
  if (info) info.textContent = 'Página ' + pagActualProfesores + ' de ' + totalPags + ' (' + filtered.length + ' total)';
}

function cambiarPaginaProfesores(dir) {
  var qEl = document.getElementById('search-prof'); var q = qEl ? qEl.value.toLowerCase() : '';
  var filtered = PROFESORES.filter(function (p) { return (p.apellido + ' ' + p.nombre + ' ' + p.materia).toLowerCase().indexOf(q) >= 0; });

  var totalPags = Math.max(1, Math.ceil(filtered.length / PROFS_PER_PAGE));
  pagActualProfesores += dir;
  if (pagActualProfesores < 1) pagActualProfesores = 1;
  if (pagActualProfesores > totalPags) pagActualProfesores = totalPags;
  renderProfesores();
}

function renderLabsConfig() {
  var el = document.getElementById('labs-config-list'); if (!el) return;
  if (!LABS.length) { el.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;">No hay espacios configurados.</div>'; return; }
  el.innerHTML = LABS.map(function (l) {
    return '<div class="lab-config-card"><div class="lab-config-icon">🖥️</div><div class="lab-config-info"><div class="lab-config-name">' + l.nombre + '</div><div class="lab-config-sub">' + l.capacidad + ' equipos · ' + (l.notas || 'Sin notas') + '</div></div><span class="orient-badge ' + (l.ocupado ? 'ob-err' : 'ob-ok') + '" style="margin-right:8px;">' + (l.ocupado ? 'Mantenimiento' : 'Disponible') + '</span><div class="lab-config-actions"><button class="tbl-btn" onclick="editarLab(\'' + l.id + '\')">✏️ Editar</button><button class="tbl-btn" onclick="toggleEstadoLab(\'' + l.id + '\')">' + (l.ocupado ? '🟢 Liberar' : '🔴 Ocupar') + '</button><button class="tbl-btn danger" onclick="eliminarLab(\'' + l.id + '\')">🗑</button></div></div>';
  }).join('');
}

function renderAdminReservas() {
  var tbody = document.getElementById('admin-reservas-tbody'); if (!tbody) return;
  var filterEl = document.getElementById('admin-filter-orient'); var filterO = filterEl ? filterEl.value : 'all';
  var filtered = RESERVAS.filter(function (r) { return filterO === 'all' || r.orient === filterO; });
  tbody.innerHTML = filtered.map(function (r) {
    var p = getProfe(r.profeId); var oris = (r.orient || 'bas').split(',');
    var orientBadges = oris.map(function (o) {
      var ori = ORIENTACIONES[o] || ORIENTACIONES.bas;
      return '<span class="orient-badge mini ' + ori.ob + '">' + ori.emoji + '</span>';
    }).join('');
    var fecha = getDiaDate(r.semanaOffset, r.dia); var pct = (r.cicloClases / 3) * 100; var mod = getModulo(r.modulo);
    return '<tr><td>Prof. ' + p.apellido + '</td><td>Lab.' + r.lab + '</td><td>' + DIAS_SEMANA[r.dia] + ' ' + formatFecha(fecha) + '</td><td>' + mod.label + '</td><td>' + r.curso + '</td><td><div class="orient-badge-group">' + orientBadges + '</div></td><td><div style="display:flex;align-items:center;gap:6px;"><div style="width:40px;background:var(--border);border-radius:20px;height:5px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:var(--navy);border-radius:20px;"></div></div><span style="font-size:11px;color:var(--muted);">' + r.cicloClases + '/3</span></div></td><td><div class="table-actions"><button class="tbl-btn" onclick="verDetalle(' + r.id + ')">👁 Ver</button><button class="tbl-btn danger" onclick="cancelarReserva(' + r.id + ')">🗑</button></div></td></tr>';
  }).join('');
  if (!filtered.length) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">No hay reservas.</td></tr>';
}

function renderPautasAdmin() {
  var el = document.getElementById('pautas-admin-list'); if (!el) return;
  if (!PAUTAS.length) { el.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:13px;">No hay pautas configuradas.</div>'; return; }
  el.innerHTML = PAUTAS.map(function (p, i) {
    return '<div class="list-item" style="padding:10px 18px;"><span class="chk">✓</span><span style="flex:1;font-size:13px;">' + p + '</span><button class="tbl-btn danger" onclick="eliminarPauta(' + i + ')" style="padding:2px 7px;font-size:11px;">✕</button></div>';
  }).join('');
}

// ============================================================
// CRUD DOCENTES
// ============================================================
function abrirModalDocente() {
  editDocenteId = null;
  document.getElementById('modal-docente-title').textContent = '+ Agregar docente';
  ['doc-apellido', 'doc-nombre', 'doc-materia'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  UIHelper.setOrientValues('doc-orient-group', 'bas');
  abrirModal('modal-docente');
}
function editarDocente(id) {
  var p = getProfe(id); editDocenteId = id;
  document.getElementById('modal-docente-title').textContent = '✏️ Editar docente';
  document.getElementById('doc-apellido').value = p.apellido;
  document.getElementById('doc-nombre').value = p.nombre;
  document.getElementById('doc-materia').value = p.materia;
  UIHelper.setOrientValues('doc-orient-group', p.orientacion);
  abrirModal('modal-docente');
}
function guardarDocente() {
  var apellido = document.getElementById('doc-apellido').value.trim();
  var nombre = document.getElementById('doc-nombre').value.trim();
  var materia = document.getElementById('doc-materia').value.trim();
  var orient = UIHelper.getOrientValues('doc-orient-group');
  if (!apellido || !nombre || !materia) { toast('Completá todos los campos.', 'err'); return; }
  if (editDocenteId) {
    dbEditarProfesor(editDocenteId, { apellido: apellido, nombre: nombre, materia: materia, orientacion: orient }, function () {
      toast('Docente actualizado.', 'ok');
      cerrarModal('modal-docente'); renderAdmin();
    });
  }
  else {
    dbCrearProfesor({ apellido: apellido, nombre: nombre, materia: materia, orientacion: orient }, function () {
      toast('Docente agregado.', 'ok');
      cerrarModal('modal-docente'); renderAdmin();
    });
  }
}
function eliminarDocente(id) {
  var p = getProfe(id);
  confirmar('¿Eliminar a <strong>' + p.apellido + ', ' + p.nombre + '</strong>? Se eliminarán sus reservas.', function () {
    PROFESORES = PROFESORES.filter(function (x) { return x.id !== id; });
    RESERVAS = RESERVAS.filter(function (r) { return r.profeId !== id; });
    SOLICITUDES = SOLICITUDES.filter(function (s) { return s.profeId !== id; });
    saveDB(); toast('Docente eliminado.', 'info'); renderAdmin(); renderCalendario();
  });
}

// ============================================================
// CRUD LABORATORIOS
// ============================================================
function abrirModalLab() {
  editLabId = null;
  document.getElementById('modal-lab-title').textContent = '+ Agregar espacio';
  ['lab-nombre', 'lab-capacidad', 'lab-notas'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var estado = document.getElementById('lab-estado'); if (estado) estado.value = 'libre';
  abrirModal('modal-lab');
}
function editarLab(id) {
  var l = getLab(id); editLabId = id;
  document.getElementById('modal-lab-title').textContent = '✏️ Editar espacio';
  document.getElementById('lab-nombre').value = l.nombre;
  document.getElementById('lab-capacidad').value = l.capacidad || '';
  document.getElementById('lab-estado').value = l.ocupado ? 'ocupado' : 'libre';
  document.getElementById('lab-notas').value = l.notas || '';
  abrirModal('modal-lab');
}
function guardarLab() {
  var nombre = document.getElementById('lab-nombre').value.trim();
  var capacidad = parseInt(document.getElementById('lab-capacidad').value) || 0;
  var estado = document.getElementById('lab-estado').value;
  var notas = document.getElementById('lab-notas').value.trim();
  if (!nombre) { toast('Ingresá un nombre para el espacio.', 'err'); return; }
  if (editLabId) { var l = LABS.find(function (x) { return x.id === editLabId; }); if (l) { l.nombre = nombre; l.capacidad = capacidad; l.ocupado = estado === 'ocupado'; l.notas = notas; } toast('Espacio actualizado.', 'ok'); }
  else { var newId = String.fromCharCode(65 + LABS.length); LABS.push({ id: newId, nombre: nombre, capacidad: capacidad, ocupado: estado === 'ocupado', notas: notas }); toast('Espacio "' + nombre + '" agregado.', 'ok'); }
  cerrarModal('modal-lab'); saveDB(); renderAdmin(); renderCalendario();
}
function toggleEstadoLab(id) {
  var l = LABS.find(function (x) { return x.id === id; }); if (!l) return;
  l.ocupado = !l.ocupado;
  saveDB(); toast('Lab.' + l.id + ': ' + (l.ocupado ? 'En mantenimiento' : 'Disponible') + '.', 'info');
  renderAdmin(); renderSidebar();
}
function eliminarLab(id) {
  var l = getLab(id);
  confirmar('¿Eliminar el espacio <strong>' + l.nombre + '</strong>? Se eliminarán sus reservas.', function () {
    LABS = LABS.filter(function (x) { return x.id !== id; });
    RESERVAS = RESERVAS.filter(function (r) { return r.lab !== id; });
    SOLICITUDES = SOLICITUDES.filter(function (s) { return s.lab !== id; });
    saveDB(); toast('Espacio eliminado.', 'info'); renderAdmin(); renderCalendario();
  });
}

// ============================================================
// PAUTAS
// ============================================================
function abrirModalPauta() { var el = document.getElementById('pauta-texto'); if (el) el.value = ''; abrirModal('modal-pauta'); }
function guardarPauta() {
  var txt = document.getElementById('pauta-texto').value.trim();
  if (!txt) { toast('Ingresá el texto de la pauta.', 'err'); return; }
  PAUTAS.push(txt); cerrarModal('modal-pauta');
  saveDB(); toast('Pauta agregada.', 'ok'); renderAdmin(); renderSidebar();
}
function eliminarPauta(i) {
  confirmar('¿Eliminar la pauta "' + PAUTAS[i] + '"?', function () {
    PAUTAS.splice(i, 1);
    saveDB(); toast('Pauta eliminada.', 'info'); renderAdmin(); renderSidebar();
  });
}

// ============================================================
// RENDER ALL
// ============================================================
function renderAll() {
  renderCalendario();
  var activePage = document.querySelector('.page.active');
  if (activePage) {
    if (activePage.id === 'page-mis-reservas') renderMisReservas();
    if (activePage.id === 'page-admin') renderAdmin();
  }
}

// ============================================================
// MÓDULO DE INYECCIÓN DEFENSIVA DE UI
// Todos los accesos al DOM pasan por aquí.
// Regla: verificar existencia física antes de escribir.
// Si el elemento no existe → console.warn silencioso, sin throw.
// ============================================================
var UIHelper = {

  /**
   * Escribe textContent en un elemento por ID.
   * @param {string} id        - ID del elemento destino
   * @param {string} text      - Texto a inyectar
   * @param {string} [context] - Descripción para el warn (debug)
   */
  setText: function (id, text, context) {
    var el = document.getElementById(id);
    if (!el) {
      console.warn('[UIHelper] Elemento no encontrado:', id, context || '');
      return;
    }
    el.textContent = String(text);
  },

  /**
   * Agrega o remueve una clase CSS de un elemento por ID.
   * @param {string}  id        - ID del elemento destino
   * @param {string}  className - Clase a agregar/remover
   * @param {boolean} force     - true = agregar, false = remover
   */
  toggleClass: function (id, className, force) {
    var el = document.getElementById(id);
    if (!el) {
      console.warn('[UIHelper] Elemento no encontrado para toggleClass:', id);
      return;
    }
    el.classList.toggle(className, force);
  },

  /**
   * Aplica display inline a todos los elementos que coincidan con un selector CSS.
   * @param {string} selector    - Selector CSS (ej: '.admin-only')
   * @param {string} displayVal  - Valor de display ('' para visible, 'none' para oculto)
   */
  setDisplayAll: function (selector, displayVal) {
    try {
      document.querySelectorAll(selector).forEach(function (el) {
        el.style.display = displayVal;
      });
    } catch (e) {
      console.warn('[UIHelper] Selector inválido:', selector, e);
    }
  },

  /**
   * Inyecta el avatar (iniciales) en el elemento de sesión.
   * Extrae las dos primeras letras de apellido y nombre a partir de display.
   * Acepta formato "Prof. Apellido", "Apellido, Nombre" o string libre.
   * @param {string} display - Cadena de nombre a procesar
   */
  setAvatar: function (display) {
    var el = document.getElementById('s-avatar');
    if (!el) {
      console.warn('[UIHelper] Elemento no encontrado: s-avatar');
      return;
    }
    // Sanitizar: si display no es string o está vacío → placeholder
    if (typeof display !== 'string' || !display.trim()) {
      el.textContent = '?';
      return;
    }
    // Eliminar prefijos honoríficos comunes antes de extraer iniciales
    var cleaned = display.replace(/^(Prof\.|Dr\.|Lic\.|Ing\.)\s*/i, '').trim();
    // Separar por espacios, comas o puntos
    var parts = cleaned.split(/[\s,\.]+/).filter(function (p) { return p.length > 0; });
    var initials = '';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1) {
      initials = parts[0].substring(0, 2).toUpperCase();
    } else {
      initials = '?';
    }
    el.textContent = initials;
  }
};

// ============================================================
// INIT — Ciclo de vida completo encapsulado en DOMContentLoaded
// ============================================================
document.addEventListener('DOMContentLoaded', function () {

  // ── 1. EXTRACCIÓN Y VALIDACIÓN DE SESIÓN ──────────────────
  // Toda la lógica de sessionStorage vive aquí, en un único scope.
  var SESSION_KEY = 'SAEP_session_data';
  var raw = null;

  try {
    raw = sessionStorage.getItem(SESSION_KEY);
  } catch (storageErr) {
    // sessionStorage puede estar bloqueado (modo privado de algunos navegadores)
    console.warn('[INIT] sessionStorage no disponible:', storageErr);
    window.location.replace('login.html');
    return; // Detener ejecución del callback, nunca del hilo global
  }

  // Ausencia de clave → sesión inexistente → redirigir sin limpiar
  if (!raw) {
    window.location.replace('login.html');
    return;
  }

  // ── 2. PARSEO DEFENSIVO ───────────────────────────────────
  var session = null;
  try {
    session = JSON.parse(raw);
  } catch (parseErr) {
    // JSON corrupto: limpiar y redirigir
    console.warn('[INIT] Sesión corrupta, limpiando storage:', parseErr);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('login.html');
    return;
  }

  // Validación estructural mínima del payload
  // (cubre el caso de JSON válido pero con campos faltantes)
  if (!session || typeof session.role !== 'string' || typeof session.display !== 'string') {
    console.warn('[INIT] Payload de sesión inválido:', session);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('login.html');
    return;
  }

  // ── 3. PUBLICAR SESIÓN AL SCOPE GLOBAL ────────────────────
  // window.SESSION es el único punto de verdad para el resto de app.js
  window.SESSION = session;
  modoUsuario = (['admin', 'director', 'subdirector'].indexOf(session.role) >= 0) ? 'admin' : 'prof';

  // ── 4. INYECCIÓN DE UI (vía UIHelper, cero asignaciones directas) ──
  UIHelper.setAvatar(session.display);
  UIHelper.setText('s-name', session.display, 'header nombre');
  UIHelper.setText('s-role', session.role === 'admin' ? 'directivo' : 'docente', 'header rol');
  UIHelper.setText('sm-name', session.display, 'dropdown nombre');
  UIHelper.setText('sm-role', session.role === 'admin' ? 'Directivo / Administrador' : 'Docente', 'dropdown rol largo');

  // Clase visual del chip de rol (color admin vs docente)
  UIHelper.toggleClass('s-role', 'admin', session.role === 'admin');

  // Visibilidad de elementos exclusivos de admin
  UIHelper.setDisplayAll('.admin-only', esDirectivo() ? '' : 'none');

  // ── 5. DÍA INICIAL ───────────────────────────────────────
  var dow = new Date().getDay();
  // 0=dom→4(vie), 6=sáb→0(lun), resto→día anterior indexado en 0
  diaActual = (dow === 0) ? 4 : (dow === 6) ? 0 : dow - 1;
  diaActual = Math.max(0, Math.min(4, diaActual));

  // ── 6. EVENTOS GLOBALES ───────────────────────────────────
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.session-widget')) closeSessionMenu();
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(function (m) {
        m.classList.remove('open');
      });
    }
  });

  // Listeners de conflicto en modal de reserva
  ['f-lab', 'f-dia', 'f-modulo'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', checkConflict);
  });
  // Listener filtro de turno → re-renderiza la grilla
  var ftEl = document.getElementById('filtro-turno');
  if (ftEl) {
    ftEl.addEventListener('change', function () {
      filtroTurno = ftEl.value;
      renderCalendario();
    });
  }

  // ── 7. CARGA DE DATOS ─────────────────────────────────────
  // Intento 1: localStorage (persiste entre recargas)
  // Intento 2: archivos JSON (carga inicial o después de reset)
  var fromLS = loadFromLocalStorage();
  if (fromLS) {
    renderCalendario();
  } else {
    loadFromJSON(function () {
      renderCalendario();
    });
  }

}); // fin DOMContentLoaded