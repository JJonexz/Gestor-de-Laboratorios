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

function getModulo(id) {
  return MODULOS.find(function(m) { return m.id === id; }) || MODULOS[0];
}

function getProfe(id) {
  return PROFESORES.find(function(p) { return p.id === id; })
    || { apellido: '—', nombre: '', orientacion: 'bas', materia: '—' };
}

function getLab(id) {
  return LABS.find(function(l) { return l.id === id; })
    || { nombre: '—', ocupado: false, capacidad: 0, notas: '' };
}

// ── Sesión y roles ───────────────────────────────────────────

// Retorna el ID del profesor de la sesión actual
function getCurrentProfId() {
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
