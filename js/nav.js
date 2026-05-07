// ============================================================
// nav.js — Navegación de la aplicación
//
// ¿Qué hay acá?
//   • Cambio entre páginas (calendario, mis-reservas, admin)
//   • Menú hamburguesa y menú de sesión
//   • Cerrar sesión
//   • Filtros de orientación y laboratorio
//   • Toggle collapse/expand de sidebar
//
// Depende de: config.js, ui.js
// ============================================================

// ── Toggle Sidebar ───────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const btn = document.getElementById('toggleBtn');
let collapsed = false;

if (btn && sidebar) {
  btn.addEventListener('click', () => {
    collapsed = !collapsed;
    sidebar.classList.toggle('collapsed', collapsed);
    btn.setAttribute('aria-label', collapsed ? 'Mostrar panel lateral' : 'Ocultar panel lateral');
  });
}

// ── Días del calendario ──────────────────────────────────────
function navDia(dir) {
  diaActual = Math.max(0, Math.min(4, diaActual + dir));
  renderCalendario();
}

function irDia(d) {
  diaActual = d;
  renderCalendario();
}

// ── Páginas ──────────────────────────────────────────────────
function irA(pagina) {
  // Desactivar página actual
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn, .mobile-nav-btn').forEach(function(b) {
    b.classList.remove('active');
    b.setAttribute('aria-current', 'false');
  });

  // Activar la nueva página
  var pg = document.getElementById('page-' + pagina);
  if (pg) pg.classList.add('active');

  document.querySelectorAll('[data-page="' + pagina + '"]').forEach(function(b) {
    b.classList.add('active');
    b.setAttribute('aria-current', 'page');
  });

  // Renderizados específicos por página
  if (pagina === 'admin')        renderAdmin();
  if (pagina === 'mis-reservas') renderMisReservas();
  if (pagina === 'incidencias')  { if (typeof renderIncidencias === 'function') renderIncidencias(); }
  if (pagina === 'fechas-especiales') { if (typeof renderCalendarioEscolar === 'function') renderCalendarioEscolar(); }
  if (pagina === 'estadisticas') {
    var contenedor = document.getElementById('estadisticas-contenido');
    if (contenedor) contenedor.innerHTML = '';
    renderEstadisticas();
  }

  closeMobileNav();
}

// ── Menú hamburguesa (mobile) ────────────────────────────────
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

// ── Menú de sesión ───────────────────────────────────────────
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

// ── Cerrar sesión ────────────────────────────────────────────
function cerrarSesion() {
  confirmar('¿Cerrar sesión y volver al inicio?', function() {
    sessionStorage.removeItem('SAEP_session_data');
    window.location.replace('login.html');
  });
}

// ── Filtros de orientación ────────────────────────────────────
function selOrient(el, orient) {
  document.querySelectorAll('.orient-tab').forEach(function(t) {
    t.classList.remove('sel');
    t.setAttribute('aria-selected', 'false');
  });
  el.classList.add('sel');
  el.setAttribute('aria-selected', 'true');
  filtroOrient = orient;
  renderCalendario();
}

// ── Filtro de búsqueda de laboratorio ─────────────────────────
function setLabSearch(query) {
  filtroBusquedaLab = query.toLowerCase().trim();
  renderCalendario();
}

// ── Filtro de laboratorio ─────────────────────────────────────
function setLabFilter(labId) {
  filtroLab = labId;

  // Actualizar estado visual de las lab-cards en el sidebar
  document.querySelectorAll('.lab-card').forEach(function(c) {
    c.classList.toggle('sel', c.dataset.labId === labId);
  });

  // Actualizar botones de filtro rápido
  document.querySelectorAll('.lab-filter-btn').forEach(function(b) {
    b.classList.remove('active');
  });
  var todosBtn = document.getElementById('filt-todos');
  if (todosBtn) todosBtn.classList.toggle('active', labId === 'todos');

  document.querySelectorAll('[data-lab-filter]').forEach(function(b) {
    b.classList.toggle('active', b.dataset.labFilter === labId);
  });

  renderCalendario();
}
