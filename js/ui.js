// ============================================================
// ui.js — Primitivos de interfaz de usuario
//
// ¿Qué hay acá?
//   • toast()         → notificación flotante temporal
//   • confirmar()     → diálogo de confirmación reutilizable
//   • abrirModal() / cerrarModal() → control de modales
//   • UIHelper        → escritura segura en el DOM (sin throws)
//
// Depende de: nada (es la capa más baja de UI)
// ============================================================

// ── Toast (notificación temporal) ───────────────────────────
// tipo: 'ok' | 'err' | 'info' | 'warn'
function toast(msg, tipo) {
  tipo = tipo || 'ok';
  var c = document.getElementById('toast-container');
  if (!c) return;

  var t = document.createElement('div');
  t.className = 'toast toast-' + tipo;
  t.setAttribute('role', 'status');

  var icons = { ok: '✓', err: '✗', info: 'ℹ', warn: '⚠' };
  t.innerHTML =
    '<div class="toast-icon" aria-hidden="true">' + (icons[tipo] || '•') + '</div>' +
    '<span>' + msg + '</span>';

  c.appendChild(t);
  setTimeout(function() {
    t.style.animation = 'toastOut .3s ease forwards';
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
  }, 2800);
}

// ── Modal de confirmación ────────────────────────────────────
// msg puede contener HTML básico (<strong>, <br>)
function confirmar(msg, callback) {
  var body = document.getElementById('confirm-body');
  var btn  = document.getElementById('confirm-ok-btn');
  var extra = document.getElementById('confirm-extra-btn');
  if (!body || !btn) return;

  if (extra) {
    extra.style.display = 'none';
    extra.textContent = '';
  }

  body.innerHTML = '<p>' + msg + '</p>';
  btn.textContent = 'Confirmar';
  btn.onclick = function() { cerrarModal('modal-confirm'); callback(); };
  abrirModal('modal-confirm');
}

// ── Diálogo con múltiples opciones ───────────────────────────
// Permite hasta dos botones de acción además de cancelar
function confirmarOpciones(msg, opciones) {
  var body = document.getElementById('confirm-body');
  var btnOk = document.getElementById('confirm-ok-btn');
  var btnEx = document.getElementById('confirm-extra-btn');
  if (!body || !btnOk || !btnEx) return;

  body.innerHTML = '<p>' + msg + '</p>';
  
  // Botón principal
  btnOk.textContent = opciones.ok.texto;
  btnOk.onclick = function() { cerrarModal('modal-confirm'); opciones.ok.callback(); };

  // Botón extra
  btnEx.style.display = 'inline-block';
  btnEx.textContent = opciones.extra.texto;
  if (opciones.extra.style) {
    Object.keys(opciones.extra.style).forEach(function(k) {
      btnEx.style[k] = opciones.extra.style[k];
    });
  }
  btnEx.onclick = function() { cerrarModal('modal-confirm'); opciones.extra.callback(); };

  abrirModal('modal-confirm');
}

// ── Control de modales ───────────────────────────────────────
function abrirModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  // Foco automático al primer campo interactivo
  setTimeout(function() {
    var f = el.querySelector('button, input, select, textarea');
    if (f) f.focus();
  }, 100);
}

function cerrarModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// ── UIHelper — escritura defensiva en el DOM ─────────────────
// Todos los accesos al DOM deberían pasar por acá.
// Regla: si el elemento no existe → console.warn silencioso, sin throw.
var UIHelper = {

  // Escribe textContent en un elemento por ID
  setText: function(id, text, context) {
    var el = document.getElementById(id);
    if (!el) {
      console.warn('[UIHelper] Elemento no encontrado:', id, context || '');
      return;
    }
    el.textContent = String(text);
  },

  // Agrega o remueve una clase CSS de un elemento por ID
  toggleClass: function(id, className, force) {
    var el = document.getElementById(id);
    if (!el) {
      console.warn('[UIHelper] Elemento no encontrado para toggleClass:', id);
      return;
    }
    el.classList.toggle(className, force);
  },

  // Aplica display a todos los elementos que coincidan con un selector
  setDisplayAll: function(selector, displayVal) {
    try {
      document.querySelectorAll(selector).forEach(function(el) {
        el.style.display = displayVal;
      });
    } catch (e) {
      console.warn('[UIHelper] Selector inválido:', selector, e);
    }
  },

  // Inyecta el avatar (iniciales) en #s-avatar a partir del nombre de sesión.
  // Acepta: "Prof. Apellido", "Apellido, Nombre" o cualquier string.
  setAvatar: function(display) {
    var el = document.getElementById('s-avatar');
    if (!el) {
      console.warn('[UIHelper] Elemento no encontrado: s-avatar');
      return;
    }
    if (typeof display !== 'string' || !display.trim()) {
      el.textContent = '?';
      return;
    }
    // Quitar prefijos honoríficos antes de extraer iniciales
    var cleaned  = display.replace(/^(Prof\.|Dr\.|Lic\.|Ing\.)\s*/i, '').trim();
    var parts    = cleaned.split(/[\s,\.]+/).filter(function(p) { return p.length > 0; });
    var initials = '';
    if (parts.length >= 2) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1) {
      initials = parts[0].substring(0, 2).toUpperCase();
    } else {
      initials = '?';
    }
    el.textContent = initials;
  },
};
