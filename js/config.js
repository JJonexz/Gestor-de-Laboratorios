// ============================================================
// config.js — Constantes globales y estado de la aplicación
//
// ¿Qué hay acá?
//   • Variables de estado de UI (semana actual, día, filtros, modo)
//   • Definición de módulos horarios y turnos
//   • Mapa de orientaciones
//   • Arrays de datos (se llenan en db.js al iniciar)
// ============================================================

// ── Estado de navegación ────────────────────────────────────
var HOY = new Date();
HOY.setHours(0, 0, 0, 0);

var semanaOffset = 0;   // 0 = semana actual, +1 = siguiente, etc.
var diaActual = 0;   // 0=Lun … 4=Vie
var filtroOrient = 'all';
var filtroLab = 'todos';
var filtroTurno = 'todos';
var modoUsuario = 'prof';  // 'prof' | 'admin'
var editDocenteId = null;   // ID del docente que se está editando (null = nuevo)
var editLabId = null;   // ID del lab que se está editando (null = nuevo)
var nextId = 500;    // Autoincremental para IDs de reservas/solicitudes
var pagActualProfesores = 1;
var PROFS_PER_PAGE = 30;

// ── Nombres de días ─────────────────────────────────────────
var DIAS_SEMANA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'];
var DIAS_LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// ── Módulos horarios ────────────────────────────────────────
// Cada módulo tiene un id único, etiqueta, horario, turno y tipo (clase|recreo).
var MODULOS = [
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

// Solo los módulos de tipo clase (excluye recreos)
var MODULOS_CLASE = MODULOS.filter(function (m) { return m.tipo === 'clase'; });

// ── Agrupación por turno ────────────────────────────────────
var TURNOS_CONFIG = [
  { label: 'Mañana', icon: '🌅', modulos: [0, 1, 2, 3, 4, 5] },
  { label: 'Tarde', icon: '☀️', modulos: [6, 7, 8, 9, 10] },
  { label: 'Vespertino', icon: '🌆', modulos: [11, 12, 13, 14, 15] },
];

// ── Orientaciones de la escuela ─────────────────────────────
// ev = clase CSS del evento en el calendario
// ob = clase CSS del badge de orientación
var ORIENTACIONES = {
  info: { nombre: 'Informática', ev: 'ev-info', emoji: '💻', ob: 'ob-info' },
  const: { nombre: 'Construcción', ev: 'ev-const', emoji: '🏗️', ob: 'ob-const' },
  tur: { nombre: 'Turismo', ev: 'ev-tur', emoji: '🌐', ob: 'ob-tur' },
  bas: { nombre: 'Básico', ev: 'ev-bas', emoji: '📚', ob: 'ob-bas' },
};

// ── Arrays de datos (se pueblan desde db.js) ────────────────
var LABS = [];
var PROFESORES = [];
var RESERVAS = [];
var SOLICITUDES = [];
var LISTA_ESPERA = [];
var PAUTAS = [];
var RECREOS = [];
var CURSOS = [];
var MATERIAS = [];

// ── Clave de localStorage ───────────────────────────────────
var LS_KEY = 'gestor_eest1_db';
