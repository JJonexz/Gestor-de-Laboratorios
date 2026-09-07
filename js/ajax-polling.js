// ============================================================
// ajax-polling.js — Actualización en tiempo real del calendario
//
// Usa AJAX (fetch) para hacer polling al endpoint calendar-poll
// de la API. Detecta cambios mediante un hash MD5 del lado del
// servidor: si no cambió nada, la respuesta es mínima.
//
// Depende de: db.js (apiFetch, apiGet), config.js, helpers.js,
//             calendario.js (renderCalendario), init.js (renderAll)
// ============================================================

(function () {
  'use strict';

  // ── Configuración ──────────────────────────────────────────
  var POLL_INTERVAL     = 10000;  // ms entre cada poll (10 segundos)
  var POLL_INTERVAL_BG  = 30000;  // ms cuando la pestaña está en background
  var POLL_MAX_ERRORS   = 5;      // errores consecutivos antes de pausar
  var POLL_BACKOFF_BASE = 5000;   // ms base para backoff exponencial

  // ── Estado interno ─────────────────────────────────────────
  var _pollTimer      = null;
  var _lastHash       = '';
  var _errorCount     = 0;
  var _polling        = false;
  var _paused         = false;
  var _lastSyncTime   = null;

  // ── Indicador visual de sincronización ─────────────────────
  function _showSyncIndicator(msg, isError) {
    var el = document.getElementById('sync-indicator');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError
      ? 'rgba(239,68,68,.85)'
      : 'rgba(255,255,255,.6)';
    el.style.opacity = '1';
    // Fade out después de 3s
    clearTimeout(el._fadeTimer);
    el._fadeTimer = setTimeout(function () {
      el.style.opacity = '0';
    }, 3000);
  }

  // ── Lógica principal del poll ──────────────────────────────
  function _doPoll() {
    if (_paused || _polling) return;
    _polling = true;

    // Pedimos sólo la ventana de semanas que el calendario tiene cargada.
    var v = (typeof VENTANA_SEMANAS !== 'undefined') ? VENTANA_SEMANAS : { desde: -1, hasta: 4 };
    var url = 'calendar-poll?desde=' + v.desde + '&hasta=' + v.hasta;
    if (_lastHash) url += '&hash=' + encodeURIComponent(_lastHash);

    apiGet(url)
      .then(function (data) {
        _polling = false;
        _errorCount = 0;

        if (!data) return;

        _lastHash = data.hash || '';

        if (data.changed === false) {
          // Sin cambios — solo actualizar timestamp visual
          _lastSyncTime = new Date();
          return;
        }

        // ── Hay cambios: actualizar arrays locales ──────────
        // El servidor ya nos dijo que cambió (el hash difiere), así que no
        // hace falta comparar. Antes se hacía JSON.stringify de todo el
        // dataset dos veces por tick (~30 MB de strings cada 10 segundos).
        var huboActualizacion = false;
        var cambioSolicitudes = false;

        if (data.reservas) { RESERVAS = data.reservas; huboActualizacion = true; }
        if (data.solicitudes) {
          cambioSolicitudes = SOLICITUDES.length !== data.solicitudes.length;
          SOLICITUDES = data.solicitudes;
          huboActualizacion = true;
        }
        if (data.espera) { LISTA_ESPERA = data.espera; huboActualizacion = true; }
        if (data.labs)   { LABS = data.labs; huboActualizacion = true; }

        if (huboActualizacion) {
          if (data.ventana && typeof VENTANA_SEMANAS !== 'undefined') VENTANA_SEMANAS = data.ventana;
          if (typeof SEMANAS_CARGADAS !== 'undefined') SEMANAS_CARGADAS = {};
          if (typeof invalidarIndices === 'function') invalidarIndices();
        }

        // ── Re-renderizar solo si hubo cambios reales ───────
        if (huboActualizacion) {
          _lastSyncTime = new Date();
          _showSyncIndicator('🔄 Calendario actualizado');

          // Solo re-renderizar si no hay un modal abierto (para no interrumpir al usuario)
          var modalAbierto = document.querySelector('.modal-overlay.open');
          if (!modalAbierto) {
            var activa = document.querySelector('.page.active');
            var enAdmin = activa && activa.id === 'page-admin';

            if (typeof renderCalendario === 'function') renderCalendario();

            if (enAdmin) {
              // No rehacemos el panel entero en cada poll: la tabla de reservas
              // está paginada contra el servidor y volver a pedirla cada 10 s
              // sería gratuito para nadie. Sólo refrescamos las solicitudes
              // pendientes, que es lo que el directivo está mirando.
              if (typeof renderSolicitudesAdmin === 'function') renderSolicitudesAdmin();
              if (cambioSolicitudes && typeof pintarStatsAdmin === 'function') pintarStatsAdmin();
            } else if (typeof refreshCurrentView === 'function') {
              refreshCurrentView();
            }
          }
        }
      })
      .catch(function (err) {
        _polling = false;
        _errorCount++;

        if (_errorCount <= 2) {
          console.warn('[AJAX Poll] Error #' + _errorCount + ':', err.message);
        }

        if (_errorCount >= POLL_MAX_ERRORS) {
          _showSyncIndicator('⚠ Sin conexión', true);
          // Backoff exponencial: pausa más larga con cada error
          _pausePolling();
          var backoff = POLL_BACKOFF_BASE * Math.pow(2, Math.min(_errorCount - POLL_MAX_ERRORS, 4));
          setTimeout(function () {
            _errorCount = 0; // reset para reintentar
            _resumePolling();
          }, backoff);
        }
      });
  }

  // ── Inicio / pausa / reanudación del polling ───────────────
  function _startPolling() {
    if (_pollTimer) return;
    _doPoll(); // poll inmediato
    _scheduleNext();
  }

  function _scheduleNext() {
    if (_pollTimer) clearTimeout(_pollTimer);
    var interval = document.hidden ? POLL_INTERVAL_BG : POLL_INTERVAL;
    _pollTimer = setTimeout(function () {
      _doPoll();
      _scheduleNext();
    }, interval);
  }

  function _pausePolling() {
    _paused = true;
    if (_pollTimer) {
      clearTimeout(_pollTimer);
      _pollTimer = null;
    }
  }

  function _resumePolling() {
    _paused = false;
    if (!_pollTimer) _scheduleNext();
  }

  // ── Visibilidad de pestaña ─────────────────────────────────
  // Cuando la pestaña se vuelve visible, hacemos un poll inmediato
  // y aceleramos el intervalo. Cuando se oculta, ralentizamos.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      // Pestaña oculta: ralentizar
      _scheduleNext();
    } else {
      // Pestaña visible: poll inmediato + restaurar intervalo rápido
      _doPoll();
      _scheduleNext();
    }
  });

  // ── Forzar refresh manual (disponible globalmente) ─────────
  window.forceCalendarRefresh = function () {
    _lastHash = ''; // forzar que traiga datos completos
    _doPoll();
    _showSyncIndicator('🔄 Sincronizando...');
  };

  // ── Iniciar automáticamente al cargar DOM ──────────────────
  // Se retrasa un poco para que init.js cargue primero los datos iniciales
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(_startPolling, 2000);
    });
  } else {
    setTimeout(_startPolling, 2000);
  }

  console.log('[AJAX Polling] Actualización en tiempo real activa (cada ' + (POLL_INTERVAL / 1000) + 's).');

})();
