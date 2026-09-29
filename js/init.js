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
function refreshCurrentView() {
  if (typeof renderCalendario === 'function') renderCalendario();
  var activePage = document.querySelector('.page.active');
  if (!activePage) return;
  if (activePage.id === 'page-mis-reservas' && typeof renderMisReservas === 'function') {
    renderMisReservas();
  } else if (activePage.id === 'page-admin' && typeof renderAdmin === 'function') {
    renderAdmin();
  } else if (activePage.id === 'page-fechas-especiales' && typeof renderCalendarioEscolar === 'function') {
    renderCalendarioEscolar();
  } else if (activePage.id === 'page-estadisticas' && typeof renderEstadisticas === 'function') {
    renderEstadisticas();
  } else if (activePage.id === 'page-incidencias' && typeof renderIncidencias === 'function') {
    renderIncidencias();
  }
}

function renderAll() {
  refreshCurrentView();
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
  // session.tipo viene de usuarios2: 'Administrador' o 'Director'
  var tipoRol = session.role === 'admin' ? (session.tipo || 'Directivo') : 'Docente';
  UIHelper.setText('s-role',  tipoRol.toLowerCase(),                                 'header rol');
  UIHelper.setText('sm-name', session.display,                                       'dropdown nombre');
  UIHelper.setText('sm-role', tipoRol,                                               'dropdown rol largo');
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
    // Cerrar modal al hacer click en el overlay.
    // Siempre via cerrarModal() para que restaure el scroll del body.
    if (e.target.classList.contains('modal-overlay')) cerrarModal(e.target.id);
  });

  // Cerrar modales con Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(function(m) {
        cerrarModal(m.id);
      });
    }
  });

  // Detección de conflicto en tiempo real (modal de reserva)
  ['f-lab', 'f-dia', 'f-modulo'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', checkConflict);
  });

  // Filtro de turno: ahora manejado por botones con onclick="setTurnoFilter(...)"

  // ── 7. Cargar datos ────────────────────────────────────────
  // Prioridad 1: localStorage (persiste entre recargas del navegador)
  // Prioridad 2: archivos JSON (primer uso o después de resetear)
  var fromLS = loadFromLocalStorage();
    if (fromLS) {
      if (typeof initLabsConfig === 'function') initLabsConfig();
      renderCalendario();
    } else {
      loadFromJSON(function() {
        if (typeof initLabsConfig === 'function') initLabsConfig();
        renderCalendario();
      });
    }

  // ── 8. Inicializar módulos nuevos ─────────────────────────
  // Sincronizacion semanal del horario oficial (tabla `horarios`).
  // Corre una sola vez por semana: la primera vez que alguien abre la app.
  // El servidor rechaza la repeticion (clave unica por semana), asi que
  // varias pestanas abiertas a la vez no la duplican.
  if (typeof sincronizarHorariosSiCorresponde === 'function') sincronizarHorariosSiCorresponde();

  if (typeof iniciarPollingNotif === 'function') iniciarPollingNotif();
  if (typeof iniciarSyncPestanas === 'function') iniciarSyncPestanas();
  if (typeof iniciarIncidencias  === 'function') iniciarIncidencias();

}); // fin DOMContentLoaded

// ── Verificar rol (menú de usuario) ──────────────────────────
// Diagnóstico sin consola: compara el rol que ve la página con el que le
// asigna el servidor. Si difieren, mover una reserva toma el camino de
// docente (borra la reserva y crea una solicitud) aunque arriba diga directivo.
function verificarRol() {
  function esc(v) {
    return String(v === undefined ? '(sin definir)' : v === null ? '(vacío)' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function fila(label, valor, ok) {
    var color = ok === true ? 'var(--green)' : ok === false ? 'var(--red)' : 'inherit';
    return '<div class="detail-row"><div class="detail-label">' + label + '</div>' +
      '<div class="detail-value" style="color:' + color + '">' + valor + '</div></div>';
  }

  var s = window.SESSION || {};
  var cliente = {
    rolSesion: s.role,
    tipoSesion: s.tipo,
    roleSaep: window.ROLE,
    esDirectivo: esDirectivo()
  };
  var scriptRes = Array.prototype.slice.call(document.scripts)
    .map(function (x) { return x.src; })
    .filter(function (x) { return x.indexOf('reservas.js') >= 0; })[0] || '';
  var version = (scriptRes.split('?v=')[1]) || '(sin versión)';

  var body = document.getElementById('modal-rol-body');
  body.innerHTML = '<div class="empty-state">Consultando al servidor…</div>';
  abrirModal('modal-rol');

  apiGet('whoami').then(function (sv) {
    var conclusion;
    if (cliente.esDirectivo && sv.esDirectivo) {
      conclusion = '✅ Página y servidor te reconocen como directivo. Mover una reserva debería editarla (PUT), no borrarla.';
    } else if (!cliente.esDirectivo && sv.esDirectivo) {
      conclusion = cliente.roleSaep
        ? '❌ El servidor te reconoce como directivo, pero la página usa el rol que carga SAEP (window.ROLE = "' +
          esc(cliente.roleSaep) + '"), que el gestor no reconoce. Por eso mover borra la reserva.'
        : '❌ El servidor te reconoce como directivo, pero la sesión guardada es de docente. Cerrá sesión y volvé a entrar.';
    } else if (cliente.esDirectivo && !sv.esDirectivo) {
      conclusion = '⚠️ La página te trata como directivo pero el servidor no: las acciones de directivo van a ser rechazadas. ' +
        'Cerrá sesión y volvé a entrar.';
    } else if (!sv.tabla_usuarios2) {
      conclusion = '❌ En esta base no existe la tabla usuarios2, así que nadie es directivo.';
    } else if (sv.error_usuarios2) {
      conclusion = '❌ La tabla usuarios2 existe pero no se pudo leer (¿columnas distintas de usuario / tipo?).';
    } else if (!sv.filas_usuarios2.length) {
      conclusion = '❌ Tu usuario (' + esc(sv.usuario_header) + ') no figura en usuarios2.';
    } else {
      conclusion = '❌ Figurás en usuarios2 pero el tipo no es exactamente "Administrador" ni "Director".';
    }

    body.innerHTML =
      '<p style="margin:0 0 12px;font-weight:600;">' + conclusion + '</p>' +
      '<div style="font-size:12px;color:var(--muted);margin:6px 0;">En la página</div>' +
      fila('¿Directivo?', cliente.esDirectivo ? 'Sí' : 'No', cliente.esDirectivo) +
      fila('Rol de la sesión', esc(cliente.rolSesion)) +
      fila('Tipo de la sesión', esc(cliente.tipoSesion)) +
      fila('Rol de SAEP (window.ROLE)', esc(cliente.roleSaep)) +
      fila('Versión de reservas.js', esc(version)) +
      '<div style="font-size:12px;color:var(--muted);margin:12px 0 6px;">En el servidor</div>' +
      fila('¿Directivo?', sv.esDirectivo ? 'Sí' : 'No', sv.esDirectivo) +
      fila('Usuario enviado', esc(sv.usuario_header)) +
      fila('Está en personal', sv.en_personal ? 'Sí' : 'No', sv.en_personal) +
      fila('Existe usuarios2', sv.tabla_usuarios2 ? 'Sí' : 'No', sv.tabla_usuarios2) +
      fila('Tipo en usuarios2', sv.filas_usuarios2.length
        ? sv.filas_usuarios2.map(function (t) { return '"' + esc(t) + '"'; }).join(', ')
        : '(ninguno)') +
      (sv.error_usuarios2 ? fila('Error', esc(sv.error_usuarios2), false) : '');
  }).catch(function (e) {
    body.innerHTML =
      '<p style="margin:0 0 12px;font-weight:600;">❌ No se pudo consultar al servidor: ' + esc(e.message) + '</p>' +
      '<p style="margin:0;">Si dice "Not found", el api.php del servidor es una versión anterior: subí el actual.</p>' +
      fila('¿Directivo en la página?', cliente.esDirectivo ? 'Sí' : 'No', cliente.esDirectivo) +
      fila('Rol de la sesión', esc(cliente.rolSesion)) +
      fila('Rol de SAEP (window.ROLE)', esc(cliente.roleSaep)) +
      fila('Versión de reservas.js', esc(version));
  });
}
