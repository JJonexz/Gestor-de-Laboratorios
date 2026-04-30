// ============================================================
// db.js — Base de datos (localStorage + JSON)
//
// ¿Qué hay acá?
//   • saveDB / loadFromLocalStorage   → persistencia en localStorage
//   • loadFromJSON                    → carga inicial desde archivos
//   • exportarDB / importarDB         → backup/restore manual
//   • resetearDB                      → vuelve a los JSON originales
//
// Depende de: config.js (variables globales de datos)
// ============================================================

// ── Guardar todo el estado en localStorage ──────────────────
function saveDB() {
  try {
    var db = {
      labs:        LABS,
      profesores:  PROFESORES,
      reservas:    RESERVAS,
      solicitudes: SOLICITUDES,
      espera:      LISTA_ESPERA,
      pautas:      PAUTAS,
      recreos:     RECREOS,
      nextId:      nextId,
      savedAt:     new Date().toISOString(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('No se pudo guardar en localStorage:', e);
  }
}

// ── Restaurar desde localStorage (retorna true si había datos) ──
function loadFromLocalStorage() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    var db = JSON.parse(raw);
    if (!db || !db.labs) return false;

    LABS         = db.labs        || [];
    PROFESORES   = db.profesores  || [];
    RESERVAS     = db.reservas    || [];
    SOLICITUDES  = db.solicitudes || [];
    LISTA_ESPERA = db.espera      || [];
    PAUTAS       = db.pautas      || [];
    RECREOS      = db.recreos     || [];
    nextId       = db.nextId      || 500;
    return true;
  } catch (e) {
    console.warn('Error al leer localStorage:', e);
    return false;
  }
}

// ── Cargar desde archivos JSON (primer uso o después de reset) ──
function loadFromJSON(callback) {
  var archivos = [
    { key:'labs',        url:'data/labs.json'        },
    { key:'profesores',  url:'data/profesores.json'  },
    { key:'reservas',    url:'data/reservas.json'    },
    { key:'solicitudes', url:'data/solicitudes.json' },
    { key:'espera',      url:'data/espera.json'      },
    { key:'pautas',      url:'data/pautas.json'      },
    { key:'recreos',     url:'data/recreos.json'     },
  ];

  var results = {};
  var pending = archivos.length;

  // Normaliza campos numéricos para evitar fallos con ===
  function normalizar(r) {
    return Object.assign({}, r, {
      semanaOffset: parseInt(r.semanaOffset, 10) || 0,
      dia:          parseInt(r.dia,          10) || 0,
      modulo:       parseInt(r.modulo,       10) || 0,
    });
  }

  function aplicar() {
    LABS         = results.labs        || [];
    PROFESORES   = results.profesores  || [];
    RESERVAS     = (results.reservas    || []).map(normalizar);
    SOLICITUDES  = (results.solicitudes || []).map(normalizar);
    LISTA_ESPERA = (results.espera      || []).map(normalizar);
    PAUTAS       = results.pautas      || [];
    RECREOS      = results.recreos     || [];

    // Calcular nextId a partir del ID más alto existente
    var maxId = 0;
    [RESERVAS, SOLICITUDES, LISTA_ESPERA].forEach(function(arr) {
      arr.forEach(function(x) { if (x.id > maxId) maxId = x.id; });
    });
    nextId = Math.max(500, maxId + 1);
  }

  archivos.forEach(function(f) {
    fetch(f.url)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        results[f.key] = data;
        pending--;
        if (pending === 0) { aplicar(); saveDB(); if (callback) callback(); }
      })
      .catch(function(err) {
        console.warn('Error cargando', f.url, err);
        results[f.key] = [];
        pending--;
        if (pending === 0) { aplicar(); if (callback) callback(); }
      });
  });
}

// ── Exportar backup como archivo JSON ───────────────────────
function exportarDB() {
  var db = {
    version:     '5',
    exportadoEn: new Date().toISOString(),
    labs:        LABS,
    profesores:  PROFESORES,
    reservas:    RESERVAS,
    solicitudes: SOLICITUDES,
    espera:      LISTA_ESPERA,
    pautas:      PAUTAS,
    recreos:     RECREOS,
  };
  var blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'gestor-laboratorios-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Exportación descargada correctamente.', 'ok');
}

// ── Importar backup desde archivo JSON ──────────────────────
function importarDB() {
  var input    = document.createElement('input');
  input.type   = 'file';
  input.accept = 'application/json,.json';

  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;

    var reader    = new FileReader();
    reader.onload = function(ev) {
      try {
        var db = JSON.parse(ev.target.result);
        if (!db.labs || !db.profesores) {
          toast('Archivo inválido. Debe ser un backup del sistema.', 'err');
          return;
        }
        confirmar('¿Importar este backup? Se reemplazarán TODOS los datos actuales.', function() {
          LABS         = db.labs        || [];
          PROFESORES   = db.profesores  || [];
          RESERVAS     = db.reservas    || [];
          SOLICITUDES  = db.solicitudes || [];
          LISTA_ESPERA = db.espera      || [];
          PAUTAS       = db.pautas      || [];
          RECREOS      = db.recreos     || [];

          var maxId = 0;
          [RESERVAS, SOLICITUDES, LISTA_ESPERA].forEach(function(arr) {
            arr.forEach(function(x) { if (x.id > maxId) maxId = x.id; });
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

// ── Resetear a los JSON originales ──────────────────────────
function resetearDB() {
  confirmar(
    '<strong>¿Restaurar datos de fábrica?</strong><br><br>Se eliminarán TODOS los cambios y se cargarán los datos originales de los archivos JSON.',
    function() {
      localStorage.removeItem(LS_KEY);
      loadFromJSON(function() {
        toast('Base de datos restaurada al estado inicial.', 'ok');
        renderAll();
        renderAdmin();
      });
    }
  );
}
