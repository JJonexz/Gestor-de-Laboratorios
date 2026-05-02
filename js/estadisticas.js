// ============================================================
// estadisticas.js — Dashboard de estadísticas de uso
//
// Funcionalidades:
//   • Resumen: total reservas, labs, docentes, tasa renovación
//   • Lab más usado (barras)
//   • Uso por orientación (barras horizontales)
//   • Horas pico por módulo (mapa de calor semanal)
//   • Docentes más activos (ranking con avatar)
//   • Historial de uso por semanas
//   • Exportar CSV
//
// Depende de: config.js, helpers.js
// ============================================================

function renderEstadisticas() {
  var el = document.getElementById('estadisticas-contenido') || document.getElementById('page-estadisticas');
  if (!el) return;

  var stats = calcularStats();

  el.innerHTML =
    '<div class="page-header">' +
      '<div class="page-title-wrap">' +
        '<div class="page-title">Estadísticas de uso</div>' +
        '<div class="page-sub">EEST N°1 · Laboratorios informáticos</div>' +
      '</div>' +
      '<button class="btn-action btn-detail" style="font-size:.8rem" onclick="exportarCSV()">↓ Exportar CSV</button>' +
    '</div>' +

    // KPIs
    '<div class="stats-strip" style="margin-bottom:1.5rem">' +
      statCard('az', stats.totalReservas,  'Reservas totales') +
      statCard('vd', stats.labsActivos,    'Labs activos') +
      statCard('am', stats.docentesActivos,'Docentes activos') +
      statCard('rj', pct(stats.tasaRenovacion) + '%', 'Tasa de renovación') +
    '</div>' +

    '<div class="est-grid">' +

      // Labs más usados
      '<div class="admin-section est-card">' +
        '<div class="admin-section-header"><div class="admin-section-title">Uso por laboratorio</div></div>' +
        '<div class="est-bars" id="est-labs">' + renderBarrasLabs(stats) + '</div>' +
      '</div>' +

      // Uso por orientación
      '<div class="admin-section est-card">' +
        '<div class="admin-section-header"><div class="admin-section-title">Reservas por orientación</div></div>' +
        '<div class="est-bars" id="est-orient">' + renderBarrasOrient(stats) + '</div>' +
      '</div>' +

      // Docentes más activos
      '<div class="admin-section est-card">' +
        '<div class="admin-section-header"><div class="admin-section-title">Docentes más activos</div></div>' +
        '<div id="est-docentes">' + renderDocentesTop(stats) + '</div>' +
      '</div>' +

      // Horas pico
      '<div class="admin-section est-card">' +
        '<div class="admin-section-header"><div class="admin-section-title">Horas pico (módulos más usados)</div></div>' +
        '<div id="est-pico">' + renderHorasPico(stats) + '</div>' +
      '</div>' +

    '</div>' +

    // Mapa de calor semanal
    '<div class="admin-section" style="margin-top:1rem">' +
      '<div class="admin-section-header"><div class="admin-section-title">Distribución semanal de reservas</div></div>' +
      '<div id="est-heatmap">' + renderHeatmap(stats) + '</div>' +
    '</div>';
}

// ── Cálculo de estadísticas ──────────────────────────────────
function calcularStats() {
  var reservas = RESERVAS || [];

  // Por lab
  var porLab = {};
  LABS.forEach(function(l) { porLab[l.id] = 0; });
  reservas.forEach(function(r) {
    porLab[r.lab] = (porLab[r.lab] || 0) + 1;
  });

  // Por orientación
  var porOrient = { info:0, const:0, tur:0, bas:0 };
  reservas.forEach(function(r) {
    if (porOrient[r.orient] !== undefined) porOrient[r.orient]++;
  });

  // Por docente
  var porDocente = {};
  reservas.forEach(function(r) {
    porDocente[r.profeId] = (porDocente[r.profeId] || 0) + 1;
  });
  var docentesRanking = Object.keys(porDocente).map(function(id) {
    return { id: parseInt(id), count: porDocente[id] };
  }).sort(function(a,b) { return b.count - a.count; }).slice(0,5);

  // Por módulo (horas pico)
  var porModulo = {};
  reservas.forEach(function(r) {
    porModulo[r.modulo] = (porModulo[r.modulo] || 0) + 1;
  });

  // Mapa día x módulo
  var heatmap = {};
  for (var d = 0; d < 5; d++) {
    heatmap[d] = {};
    MODULOS_CLASE.forEach(function(m) { heatmap[d][m.id] = 0; });
  }
  reservas.forEach(function(r) {
    if (heatmap[r.dia] !== undefined) {
      heatmap[r.dia][r.modulo] = (heatmap[r.dia][r.modulo] || 0) + 1;
    }
  });

  // Renovaciones
  var renovaciones = reservas.filter(function(r) { return r.renovaciones > 0; }).length;
  var tasaRenovacion = reservas.length ? renovaciones / reservas.length : 0;

  // Docentees y labs activos
  var docentesActivos = new Set(reservas.map(function(r) { return r.profeId; })).size;
  var labsActivos = Object.keys(porLab).filter(function(k) { return porLab[k] > 0; }).length;

  return {
    totalReservas: reservas.length,
    labsActivos: labsActivos,
    docentesActivos: docentesActivos,
    tasaRenovacion: tasaRenovacion,
    porLab: porLab,
    porOrient: porOrient,
    docentesRanking: docentesRanking,
    porModulo: porModulo,
    heatmap: heatmap
  };
}

// ── Componentes visuales ─────────────────────────────────────
function statCard(color, valor, label) {
  return '<div class="stat-card ' + color + '"><div class="stat-card-n">' + valor + '</div><div class="stat-card-l">' + label + '</div></div>';
}

function pct(n) { return Math.round(n * 100); }

function renderBarrasLabs(stats) {
  var max = Math.max.apply(null, Object.values(stats.porLab).concat([1]));
  return LABS.map(function(lab) {
    var val = stats.porLab[lab.id] || 0;
    var pct = Math.round(val / max * 100);
    return (
      '<div class="est-bar-row">' +
        '<div class="est-bar-label">' + escStat(lab.nombre) + '</div>' +
        '<div class="est-bar-track">' +
          '<div class="est-bar-fill" style="width:' + pct + '%;background:var(--navy)"></div>' +
        '</div>' +
        '<div class="est-bar-val">' + val + '</div>' +
      '</div>'
    );
  }).join('');
}

function renderBarrasOrient(stats) {
  var orientArr = [
    { key:'info',  label:'Informática',  color:'var(--blue)'  },
    { key:'const', label:'Construcción', color:'var(--red)'   },
    { key:'tur',   label:'Turismo',      color:'var(--green)' },
    { key:'bas',   label:'Básico',       color:'var(--amber)' }
  ];
  var max = Math.max.apply(null, orientArr.map(function(o) { return stats.porOrient[o.key] || 0; }).concat([1]));
  return orientArr.map(function(o) {
    var val = stats.porOrient[o.key] || 0;
    var pct = Math.round(val / max * 100);
    return (
      '<div class="est-bar-row">' +
        '<div class="est-bar-label">' + o.label + '</div>' +
        '<div class="est-bar-track">' +
          '<div class="est-bar-fill" style="width:' + pct + '%;background:' + o.color + '"></div>' +
        '</div>' +
        '<div class="est-bar-val">' + val + '</div>' +
      '</div>'
    );
  }).join('');
}

function renderDocentesTop(stats) {
  if (!stats.docentesRanking.length) return '<div class="notif-empty">Sin datos</div>';
  var max = stats.docentesRanking[0].count || 1;
  return '<div class="est-docentes-list">' +
    stats.docentesRanking.map(function(d, i) {
      var p = getProfe(d.id);
      var nombre = p ? (p.apellido + ', ' + p.nombre) : 'Docente ' + d.id;
      var iniciales = p ? (p.apellido[0] + (p.nombre[0] || '')).toUpperCase() : '?';
      var pct = Math.round(d.count / max * 100);
      var colores = ['var(--navy)','var(--blue)','var(--green)','var(--amber)','var(--red)'];
      return (
        '<div class="est-docente-row">' +
          '<div class="est-rank">' + (i+1) + '</div>' +
          '<div class="est-avatar" style="background:' + colores[i] + '">' + iniciales + '</div>' +
          '<div class="est-doc-info">' +
            '<div class="est-doc-nombre">' + escStat(nombre) + '</div>' +
            '<div class="est-bar-track" style="height:6px;margin-top:4px">' +
              '<div class="est-bar-fill" style="width:' + pct + '%;background:' + colores[i] + ';height:6px;border-radius:3px"></div>' +
            '</div>' +
          '</div>' +
          '<div class="est-bar-val"><strong>' + d.count + '</strong></div>' +
        '</div>'
      );
    }).join('') +
  '</div>';
}

function renderHorasPico(stats) {
  var modOrdenados = Object.keys(stats.porModulo)
    .map(function(id) { return { id: parseInt(id), count: stats.porModulo[id] }; })
    .sort(function(a,b) { return b.count - a.count; })
    .slice(0, 5);
  if (!modOrdenados.length) return '<div class="notif-empty">Sin datos</div>';
  var max = modOrdenados[0].count || 1;
  return modOrdenados.map(function(m) {
    var mod = getModulo(m.id);
    if (!mod) return '';
    var pct = Math.round(m.count / max * 100);
    var colorTurno = mod.turno === 'Mañana' ? 'var(--amber)' : mod.turno === 'Tarde' ? 'var(--blue)' : 'var(--navy)';
    return (
      '<div class="est-bar-row">' +
        '<div class="est-bar-label" style="font-size:.78rem">' + mod.label + '<span style="color:var(--muted);margin-left:4px">(' + mod.inicio + ')</span></div>' +
        '<div class="est-bar-track">' +
          '<div class="est-bar-fill" style="width:' + pct + '%;background:' + colorTurno + '"></div>' +
        '</div>' +
        '<div class="est-bar-val">' + m.count + '</div>' +
      '</div>'
    );
  }).join('');
}

function renderHeatmap(stats) {
  var modulosClase = MODULOS_CLASE;
  var maxVal = 0;
  for (var d = 0; d < 5; d++) {
    modulosClase.forEach(function(m) {
      var v = (stats.heatmap[d] || {})[m.id] || 0;
      if (v > maxVal) maxVal = v;
    });
  }
  maxVal = maxVal || 1;

  var html = '<div class="est-heatmap-wrap"><table class="est-heatmap"><thead><tr><th></th>';
  DIAS_SEMANA.forEach(function(d) { html += '<th>' + d + '</th>'; });
  html += '</tr></thead><tbody>';

  modulosClase.forEach(function(mod) {
    html += '<tr><td class="est-hm-label">' + mod.inicio + '</td>';
    for (var d = 0; d < 5; d++) {
      var v = (stats.heatmap[d] || {})[mod.id] || 0;
      var intensity = v / maxVal;
      var alpha = Math.round(intensity * 100);
      var title = v + ' reserva' + (v !== 1 ? 's' : '') + ' — ' + DIAS_LARGO[d] + ' ' + mod.label;
      html += '<td title="' + escStat(title) + '">' +
        '<div class="est-hm-cell" style="background:rgba(26,58,107,' + (intensity * 0.85).toFixed(2) + ');border-color:rgba(26,58,107,' + (intensity * 0.3 + 0.1).toFixed(2) + ')">' +
          (v > 0 ? '<span class="est-hm-num">' + v + '</span>' : '') +
        '</div></td>';
    }
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// ── Exportar CSV ─────────────────────────────────────────────
function exportarCSV() {
  var rows = [['ID','Lab','Día','Módulo','Hora','Curso','Orientación','Docente','Materia','Ciclo','Renovaciones']];
  RESERVAS.forEach(function(r) {
    var p = getProfe(r.profeId);
    var mod = getModulo(r.modulo);
    var ori = ORIENTACIONES[r.orient];
    rows.push([
      r.id,
      r.lab,
      DIAS_LARGO[r.dia] || r.dia,
      mod ? mod.label : r.modulo,
      mod ? mod.inicio : '',
      r.curso,
      ori ? ori.nombre : r.orient,
      p ? (p.apellido + ', ' + p.nombre) : r.profeId,
      p ? p.materia : '',
      r.cicloClases,
      r.renovaciones || 0
    ]);
  });

  var csv = rows.map(function(row) {
    return row.map(function(cell) {
      var s = String(cell === null || cell === undefined ? '' : cell);
      return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(',');
  }).join('\r\n');

  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'estadisticas_laboratorios_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  toast('CSV exportado correctamente', 'ok');
}

function escStat(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
