// ============================================================
// helpers.js — Utilidades puras sin efectos de UI
//
// ¿Qué hay acá?
//   • Lookups de datos (getModulo, getProfe, getLab)
//   • Información de sesión (getCurrentProfId, esDirectivo)
//   • Cálculos de fechas (getSemanaStart, formatFecha, etc.)
//
// Depende de: config.js
// ============================================================

// ── Lookups de datos ────────────────────────────────────────

// Los lookups se hacian con Array.find() en cada llamada. Renderizar una
// tabla de N reservas costaba N x PROFESORES comparaciones (con 813 docentes,
// decenas de millones). Ahora se indexan una vez y se invalidan cuando
// cambia el array de origen (invalidarIndices()).
var _idxProfes  = null;
var _idxLabs    = null;
var _idxModulos = null;

function invalidarIndices() {
  _idxProfes  = null;
  _idxLabs    = null;
  _idxModulos = null;
  if (typeof invalidarIndiceHorariosFijos === 'function') invalidarIndiceHorariosFijos();
}

function getModulo(id) {
  if (!_idxModulos) {
    _idxModulos = {};
    MODULOS.forEach(function(m) { _idxModulos[m.id] = m; });
  }
  return _idxModulos[id] || MODULOS[0];
}

function getProfe(id) {
  if (!_idxProfes) {
    _idxProfes = {};
    PROFESORES.forEach(function(p) { _idxProfes[String(p.id)] = p; });
  }
  return _idxProfes[String(id)]
    || { apellido: '—', nombre: '', orientacion: 'bas', materia: '—' };
}

function getLab(id) {
  if (!_idxLabs) {
    _idxLabs = {};
    LABS.forEach(function(l) { _idxLabs[String(l.id)] = l; });
  }
  return _idxLabs[String(id)]
    || { nombre: '—', ocupado: false, capacidad: 0, notas: '' };
}

// ── Sesión y roles ───────────────────────────────────────────

// Retorna el ID del profesor de la sesión actual
function getCurrentProfId() {
  // In SQL mode, session has profeId; fallback to id for backwards compat
  if (window.SESSION && window.SESSION.profeId) return window.SESSION.profeId;
  return (window.SESSION && window.SESSION.id) ? window.SESSION.id : 1;
}

// Retorna true si el usuario logueado es directivo/admin
// Usa window.ROLE (SAEP) con fallback a la variable local modoUsuario
function esDirectivo() {
  var r = window.ROLE || (window.SESSION && window.SESSION.role) || modoUsuario;
  return ['admin', 'director', 'subdirector'].indexOf(r) >= 0;
}

// ── Cálculo de fechas ────────────────────────────────────────

// Retorna el lunes de la semana según el offset dado
function getSemanaStart(offset) {
  offset = offset || 0;
  var d   = new Date(HOY);
  var dow = d.getDay();
  var lunesDiff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + lunesDiff + (offset * 7));
  return d;
}

// Formatea una fecha como "d/m" (ej: "3/5")
function formatFecha(date) {
  return date.getDate() + '/' + (date.getMonth() + 1);
}

// Retorna el Date del día `dia` (0=Lun) de la semana `offset`
function getDiaDate(offset, dia) {
  var s = getSemanaStart(offset);
  s.setDate(s.getDate() + dia);
  return s;
}

// Retorna true si ese día/offset corresponde a hoy
function esHoy(offset, dia) {
  var d = getDiaDate(offset, dia);
  return d.toDateString() === HOY.toDateString();
}

// ── Ciclo lectivo ─────────────────────────────────

// Último viernes de diciembre del año de `fechaRef` = fin del ciclo lectivo.
// Si `fechaRef` ya pasó ese viernes (enero/febrero, o fin de diciembre),
// devolvemos el del año siguiente: el ciclo lectivo "actual" es el que viene.
function getFinCicloLectivo(fechaRef) {
  var ref = fechaRef ? new Date(fechaRef) : new Date(HOY);
  ref.setHours(0, 0, 0, 0);

  function ultimoViernesDeDiciembre(anio) {
    var d = new Date(anio, 11, 31);       // 31 de diciembre
    d.setHours(0, 0, 0, 0);
    while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
    return d;
  }

  var fin = ultimoViernesDeDiciembre(ref.getFullYear());
  if (ref > fin) fin = ultimoViernesDeDiciembre(ref.getFullYear() + 1);
  return fin;
}

// Lista de semanaOffset desde `semanaBase` hasta el fin del ciclo lectivo,
// inclusive. Una semana entra si su lunes cae en o antes del ultimo viernes.
function getSemanasHastaFinCiclo(semanaBase) {
  var base = parseInt(semanaBase, 10) || 0;
  var fin  = getFinCicloLectivo(getSemanaStart(base));
  var out  = [];
  for (var sw = base; sw < base + 60; sw++) {   // techo duro por seguridad
    if (getSemanaStart(sw) > fin) break;
    out.push(sw);
  }
  return out.length ? out : [base];
}
// ── Runtime config multi-grupo (SIN columna BD) ──────────────
// Se carga desde localStorage al iniciar y se persiste ahí.
(function() {
  try {
    var _lc = localStorage.getItem('LABS_CONFIG');
    if (_lc) window.LABS_CONFIG = JSON.parse(_lc);
  } catch(e) {}
  window.LABS_CONFIG = window.LABS_CONFIG || {};
})();

function getLabMaxGrupos(labId) {
  // Fuente de verdad: LABS_CONFIG (runtime). Nunca leer max_grupos de la BD.
  var cfg = window.LABS_CONFIG && window.LABS_CONFIG[String(labId)];
  if (cfg && cfg.max_grupos) return parseInt(cfg.max_grupos);
  return 2; // default: 2 grupos por slot
}

// Inicializar LABS_CONFIG desde el array LABS apenas estén disponibles
// Llamar después de que la API cargue LABS (en init.js o db-override.js)
function initLabsConfig() {
  // Solo respetar valores guardados explícitamente por el admin (> 1)
  // Ignorar max_grupos de la BD (todos vienen en 1, no refleja la config real)
  var guardada = {};
  try {
    var _lc = localStorage.getItem('LABS_CONFIG');
    if (_lc) guardada = JSON.parse(_lc);
  } catch(e) {}

  window.LABS_CONFIG = {};
  if (typeof LABS === 'undefined' || !LABS.length) return;

  LABS.forEach(function(l) {
    var key = String(l.id);
    // Usar solo si el admin lo configuró explícitamente (> 1)
    var explicit = guardada[key] && parseInt(guardada[key].max_grupos) > 1
      ? parseInt(guardada[key].max_grupos) : null;
    window.LABS_CONFIG[key] = { max_grupos: explicit || 2 };
  });

  try { localStorage.setItem('LABS_CONFIG', JSON.stringify(window.LABS_CONFIG)); } catch(e) {}
}

function setLabMaxGrupos(labId, maxGrupos) {
  window.LABS_CONFIG = window.LABS_CONFIG || {};
  window.LABS_CONFIG[String(labId)] = { max_grupos: parseInt(maxGrupos) || 1 };
  try { localStorage.setItem('LABS_CONFIG', JSON.stringify(window.LABS_CONFIG)); } catch(e) {}
}

// ── Mapeo horas académicas ↔ módulos gestor ────────────────────
// Las tablas cupof/horarios usan id_horas (1-13), gestor usa MODULOS (0-15)
// Este mapeo permite validar conflictos entre horarios académicos y reservas de lab

// Convierte hora académica (1-13) a módulo gestor (0-15)
// Horas académicas: 1-5 Mañana, 6-9 Tarde, 10-13 Vespertino
function horarioAcademicoAModulo(idHoraAcademica) {
  var mapeo = {
    1: 0,   // 1° Mañana
    2: 1,   // 2° Mañana
    3: 3,   // 3° Mañana (salta recreo en modulo 2)
    4: 4,   // 4° Mañana
    5: 5,   // 5° Mañana
    6: 6,   // 1° Tarde
    7: 7,   // 2° Tarde
    8: 9,   // 3° Tarde (salta recreo en modulo 8)
    9: 10,  // 4° Tarde
    10: 11, // 1° Vespertino
    11: 12, // 2° Vespertino
    12: 14, // 3° Vespertino (salta recreo en modulo 13)
    13: 15  // 4° Vespertino
  };
  return mapeo[idHoraAcademica] !== undefined ? mapeo[idHoraAcademica] : null;
}

// Convierte módulo gestor (0-15) a hora académica (1-13)
// Si es recreo o no tiene equivalente, retorna null
function moduloAHorarioAcademico(moduloId) {
  var mapeoInverso = {
    0: 1,
    1: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    9: 8,
    10: 9,
    11: 10,
    12: 11,
    14: 12,
    15: 13
  };
  return mapeoInverso[moduloId] !== undefined ? mapeoInverso[moduloId] : null;
}