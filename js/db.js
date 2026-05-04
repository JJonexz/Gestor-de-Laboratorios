// ============================================================
// db.js — Base de datos SQL (via api.php)
//
// Reemplaza el sistema anterior de localStorage + JSON.
// Todos los datos se leen y escriben en SQLite a traves de api.php.
//
// API base: ./api.php/<recurso>[/<id>]
// Batch load: ./api.php/all  (una sola request al iniciar)
// ============================================================

var API = './api.php';

// -- Fetch helper --------------------------------------------
function apiFetch(endpoint, options) {
  return fetch(API + '/' + endpoint, Object.assign({
    headers: { 'Content-Type': 'application/json' }
  }, options || {}))
  .then(function(r) {
    if (!r.ok) return r.json().then(function(e) { throw new Error(e.error || 'Error ' + r.status); });
    return r.json();
  })
  .then(function(json) {
    if (!json.ok) throw new Error(json.error || 'Error de API');
    return json.data;
  });
}

function apiGet(ep)          { return apiFetch(ep); }
function apiPost(ep, data)   { return apiFetch(ep, { method: 'POST',   body: JSON.stringify(data) }); }
function apiPut(ep, data)    { return apiFetch(ep, { method: 'PUT',    body: JSON.stringify(data) }); }
function apiDelete(ep, data) { return apiFetch(ep, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined }); }

// -- Carga inicial (un solo request) -------------------------
function loadFromJSON(callback) {
  apiGet('all').then(function(data) {
    LABS         = data.labs        || [];
    PROFESORES   = data.profesores  || [];
    RESERVAS     = data.reservas    || [];
    SOLICITUDES  = data.solicitudes || [];
    LISTA_ESPERA = data.espera      || [];
    PAUTAS       = (data.pautas || []).map(function(p) { return p.texto; });
    RECREOS      = [
      { modulo: 2,  evento: 'Recreo de manana',    notas: '30 min - patio principal' },
      { modulo: 8,  evento: 'Recreo de tarde',      notas: '30 min - patio y cantina' },
      { modulo: 13, evento: 'Recreo vespertino',    notas: '20 min - patio' },
    ];
    nextId = 500;
    if (callback) callback();
  }).catch(function(err) {
    console.error('[DB] Error cargando datos:', err);
    if (typeof toast === 'function')
      toast('Error al conectar con la base de datos. Verificar que api.php este activo.', 'err');
  });
}

// localStorage ya no se usa
function loadFromLocalStorage() { return false; }
function saveDB() { /* persistencia manejada por la API */ }

// -- RESERVAS CRUD -------------------------------------------
function dbCrearReserva(datos, callback) {
  apiPost('reservas', datos).then(function(nueva) {
    RESERVAS.push(nueva);
    if (callback) callback(nueva);
  }).catch(function(e) { toast('Error al guardar reserva: ' + e.message, 'err'); });
}

function dbEditarReserva(id, datos, callback) {
  apiPut('reservas/' + id, datos).then(function(actualizada) {
    var idx = RESERVAS.findIndex(function(r) { return r.id === id; });
    if (idx >= 0) RESERVAS[idx] = actualizada;
    if (callback) callback(actualizada);
  }).catch(function(e) { toast('Error al editar reserva: ' + e.message, 'err'); });
}

function dbEliminarReserva(id, callback) {
  apiDelete('reservas/' + id).then(function() {
    RESERVAS = RESERVAS.filter(function(r) { return r.id !== id; });
    if (callback) callback();
  }).catch(function(e) { toast('Error al eliminar reserva: ' + e.message, 'err'); });
}

function dbEliminarSerieAnual(datos, callback) {
  apiDelete('reservas/0/serie', datos).then(function() {
    RESERVAS = RESERVAS.filter(function(r) {
      return !(r.lab === datos.lab && r.dia === datos.dia &&
               r.profeId === datos.profeId && r.curso === datos.curso && r.anual);
    });
    if (callback) callback();
  }).catch(function(e) { toast('Error al eliminar serie: ' + e.message, 'err'); });
}

// -- SOLICITUDES CRUD ----------------------------------------
function dbCrearSolicitud(datos, callback) {
  apiPost('solicitudes', datos).then(function(nueva) {
    SOLICITUDES.push(nueva);
    if (callback) callback(nueva);
  }).catch(function(e) { toast('Error al enviar solicitud: ' + e.message, 'err'); });
}

function dbActualizarSolicitud(id, datos, callback) {
  apiPut('solicitudes/' + id, datos).then(function(actualizada) {
    var idx = SOLICITUDES.findIndex(function(s) { return s.id === id; });
    if (idx >= 0) SOLICITUDES[idx] = actualizada;
    if (callback) callback(actualizada);
  }).catch(function(e) { toast('Error al actualizar solicitud: ' + e.message, 'err'); });
}

function dbEliminarSolicitud(id, callback) {
  apiDelete('solicitudes/' + id).then(function() {
    SOLICITUDES = SOLICITUDES.filter(function(s) { return s.id !== id; });
    if (callback) callback();
  }).catch(function(e) { toast('Error al eliminar solicitud: ' + e.message, 'err'); });
}

// -- PROFESORES CRUD -----------------------------------------
function dbCrearProfesor(datos, callback) {
  apiPost('profesores', datos).then(function(nuevo) {
    PROFESORES.push(nuevo);
    if (callback) callback(nuevo);
  }).catch(function(e) { toast('Error al guardar docente: ' + e.message, 'err'); });
}

function dbEditarProfesor(id, datos, callback) {
  apiPut('profesores/' + id, datos).then(function(actualizado) {
    var idx = PROFESORES.findIndex(function(p) { return p.id === id; });
    if (idx >= 0) PROFESORES[idx] = actualizado;
    if (callback) callback(actualizado);
  }).catch(function(e) { toast('Error al editar docente: ' + e.message, 'err'); });
}

function dbEliminarProfesor(id, callback) {
  apiDelete('profesores/' + id).then(function() {
    PROFESORES = PROFESORES.filter(function(p) { return p.id !== id; });
    if (callback) callback();
  }).catch(function(e) { toast('Error al eliminar docente: ' + e.message, 'err'); });
}

// -- LABS CRUD -----------------------------------------------
function dbCrearLab(datos, callback) {
  apiPost('labs', datos).then(function(nuevo) {
    LABS.push(nuevo);
    if (callback) callback(nuevo);
  }).catch(function(e) { toast('Error al guardar laboratorio: ' + e.message, 'err'); });
}

function dbEditarLab(id, datos, callback) {
  apiPut('labs/' + id, datos).then(function(actualizado) {
    var idx = LABS.findIndex(function(l) { return l.id === id; });
    if (idx >= 0) LABS[idx] = actualizado;
    if (callback) callback(actualizado);
  }).catch(function(e) { toast('Error al editar laboratorio: ' + e.message, 'err'); });
}

function dbEliminarLab(id, callback) {
  apiDelete('labs/' + id).then(function() {
    LABS = LABS.filter(function(l) { return l.id !== id; });
    if (callback) callback();
  }).catch(function(e) { toast('Error al eliminar laboratorio: ' + e.message, 'err'); });
}

// -- LISTA ESPERA CRUD ---------------------------------------
function dbAgregarEspera(datos, callback) {
  apiPost('espera', datos).then(function(nueva) {
    LISTA_ESPERA.push(nueva);
    if (callback) callback(nueva);
  }).catch(function(e) { toast('Error al anotar en espera: ' + e.message, 'err'); });
}

function dbEliminarEspera(id, callback) {
  apiDelete('espera/' + id).then(function() {
    LISTA_ESPERA = LISTA_ESPERA.filter(function(e) { return e.id !== id; });
    if (callback) callback();
  }).catch(function(e) { toast('Error al quitar de espera: ' + e.message, 'err'); });
}

// -- PAUTAS CRUD ---------------------------------------------
var _PAUTAS_CON_ID = [];  // cache de pautas con ID para poder borrar

function dbCrearPauta(texto, callback) {
  apiPost('pautas', { texto: texto }).then(function(nueva) {
    _PAUTAS_CON_ID.push(nueva);
    PAUTAS.push(nueva.texto);
    if (callback) callback(nueva);
  }).catch(function(e) { toast('Error al guardar pauta: ' + e.message, 'err'); });
}

function dbEliminarPauta(index, callback) {
  apiGet('pautas').then(function(lista) {
    _PAUTAS_CON_ID = lista;
    var pauta = lista[index];
    if (!pauta) throw new Error('Pauta no encontrada');
    return apiDelete('pautas/' + pauta.id);
  }).then(function() {
    PAUTAS.splice(index, 1);
    if (callback) callback();
  }).catch(function(e) { toast('Error al eliminar pauta: ' + e.message, 'err'); });
}

// -- Exportar ------------------------------------------------
function exportarDB() {
  apiGet('all').then(function(data) {
    var blob = new Blob([JSON.stringify(
      Object.assign({ version: '6-sql', exportadoEn: new Date().toISOString() }, data),
      null, 2
    )], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a   = document.createElement('a');
    a.href     = url;
    a.download = 'gestor-laboratorios-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Exportacion descargada correctamente.', 'ok');
  }).catch(function(e) { toast('Error al exportar: ' + e.message, 'err'); });
}

function importarDB() {
  toast('La importacion directa no esta disponible en modo SQL.', 'warn');
}

function resetearDB() {
  if (typeof confirmar === 'function') {
    confirmar('<strong>Recargar datos iniciales?</strong><br><br>Recargara los datos desde la base de datos.',
      function() {
        loadFromJSON(function() {
          toast('Datos recargados.', 'ok');
          if (typeof renderAll === 'function') renderAll();
          if (typeof renderAdmin === 'function') renderAdmin();
        });
      }
    );
  }
}
