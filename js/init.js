// ============================================================
// init.js — Inicialización de la aplicación
//
// ¿Qué hay acá?
//   • renderAll()        → re-renderiza la vista activa + calendario
//   • DOMContentLoaded   → todo el ciclo de arranque en un solo lugar:
//       1. Validar sesión (sessionStorage)
//       2. Publicar window.SESSION y modoUsuario
//       3. Inyectar UI de usuario (avatar, nombre, rol)
//       4. Calcular día inicial
//       5. Registrar eventos globales (click fuera de modal, Escape, filtros)
//       6. Cargar datos (localStorage → JSON si no hay nada guardado)
//
// Depende de: todos los demás módulos
// ============================================================

// ── Re-renderizado general ───────────────────────────────────
// Llamar después de cualquier cambio de datos para mantener la UI sincronizada.
function renderAll() {
  renderCalendario();
  var activePage = document.querySelector('.page.active');
  if (activePage) {
    if (activePage.id === 'page-mis-reservas') renderMisReservas();
    if (activePage.id === 'page-admin')        renderAdmin();
  }
}

// ── Arranque ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

  // ── 1. Leer sessionStorage ─────────────────────────────────
  var SESSION_KEY = 'SAEP_session_data';
  var raw = null;

  try {
    raw = sessionStorage.getItem(SESSION_KEY);
  } catch (storageErr) {
    // sessionStorage puede estar bloqueado en modo privado de algunos navegadores
    console.warn('[INIT] sessionStorage no disponible:', storageErr);
    window.location.replace('login.html');
    return;
  }

  // Sin sesión → redirigir al login
  if (!raw) {
    window.location.replace('login.html');
    return;
  }

  // ── 2. Parsear y validar el payload de sesión ──────────────
  var session = null;
  try {
    session = JSON.parse(raw);
  } catch (parseErr) {
    console.warn('[INIT] Sesión corrupta, limpiando storage:', parseErr);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('login.html');
    return;
  }

  if (!session || typeof session.role !== 'string' || typeof session.display !== 'string') {
    console.warn('[INIT] Payload de sesión inválido:', session);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('login.html');
    return;
  }

  // ── 3. Publicar sesión y modo de usuario ───────────────────
  window.SESSION = session;
  modoUsuario = (['admin', 'director', 'subdirector'].indexOf(session.role) >= 0) ? 'admin' : 'prof';

  // ── 4. Inyectar UI de sesión (usa UIHelper para no romper si falta el elemento) ──
  UIHelper.setAvatar(session.display);
  UIHelper.setText('s-name',  session.display,                                       'header nombre');
  UIHelper.setText('s-role',  session.role === 'admin' ? 'directivo' : 'docente',    'header rol');
  UIHelper.setText('sm-name', session.display,                                       'dropdown nombre');
  UIHelper.setText('sm-role', session.role === 'admin' ? 'Directivo / Administrador' : 'Docente', 'dropdown rol largo');
  UIHelper.toggleClass('s-role', 'admin', session.role === 'admin');

  // Mostrar/ocultar elementos exclusivos de admin
  UIHelper.setDisplayAll('.admin-only', esDirectivo() ? '' : 'none');

  // ── 5. Día inicial según el día de la semana real ──────────
  var dow = new Date().getDay();
  // 0=dom → 4 (mostramos el último día hábil)
  // 6=sáb → 0 (adelantamos al lunes siguiente)
  // 1-5   → índice 0-4
  diaActual = (dow === 0) ? 4 : (dow === 6) ? 0 : dow - 1;
  diaActual = Math.max(0, Math.min(4, diaActual));

  // ── 6. Eventos globales ────────────────────────────────────
  // Cerrar menú de sesión al hacer click fuera
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.session-widget')) closeSessionMenu();
    // Cerrar modal al hacer click en el overlay
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  });

  // Cerrar modales con Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(function(m) {
        m.classList.remove('open');
      });
    }
  });

  // Detección de conflicto en tiempo real (modal de reserva)
  ['f-lab', 'f-dia', 'f-modulo'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', checkConflict);
  });

  // Filtro de turno en el calendario
  var ftEl = document.getElementById('filtro-turno');
  if (ftEl) {
    ftEl.addEventListener('change', function() {
      filtroTurno = ftEl.value;
      renderCalendario();
    });
  }

  // ── 7. Cargar datos ────────────────────────────────────────
  // Prioridad 1: localStorage (persiste entre recargas del navegador)
  // Prioridad 2: archivos JSON (primer uso o después de resetear)
  var fromLS = loadFromLocalStorage();
  if (fromLS) {
    renderCalendario();
  } else {
    loadFromJSON(function() {
      renderCalendario();
    });
  }

  // ── 8. Inicializar módulos nuevos ─────────────────────────
  if (typeof iniciarPollingNotif === 'function') iniciarPollingNotif();
  if (typeof iniciarSyncPestanas === 'function') iniciarSyncPestanas();
  if (typeof iniciarIncidencias  === 'function') iniciarIncidencias();

}); // fin DOMContentLoaded
