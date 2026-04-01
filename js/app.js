// Proyecto: Gestión de Laboratorios EEST N°1
// Archivo: app.js v4 — vista diaria, horarios reales, recreos, períodos multi-hora

const HOY = new Date();
HOY.setHours(0,0,0,0);

let semanaOffset = 0;
let diaActual    = 0; // 0=LUN … 4=VIE
let filtroOrient  = 'all';
let filtroLab     = 'todos';
let modoUsuario   = 'prof';
let editDocenteId = null;
let editLabId     = null;
let nextId        = 200;

const DIAS_SEMANA = ['LUN','MAR','MIÉ','JUE','VIE'];
const DIAS_LARGO  = ['Lunes','Martes','Miércoles','Jueves','Viernes'];

const MODULOS = [
  { id:0,  label:'1° Mañana',  inicio:'7:20',  fin:'8:20',  turno:'Mañana',    tipo:'clase',  icon:'🌅' },
  { id:1,  label:'2° Mañana',  inicio:'8:20',  fin:'9:20',  turno:'Mañana',    tipo:'clase',  icon:'🌅' },
  { id:2,  label:'Recreo M',   inicio:'9:20',  fin:'9:50',  turno:'Mañana',    tipo:'recreo', icon:'☕' },
  { id:3,  label:'3° Mañana',  inicio:'9:50',  fin:'10:50', turno:'Mañana',    tipo:'clase',  icon:'🌅' },
  { id:4,  label:'4° Mañana',  inicio:'10:50', fin:'11:50', turno:'Mañana',    tipo:'clase',  icon:'🌅' },
  { id:5,  label:'5° Mañana',  inicio:'11:50', fin:'12:50', turno:'Mañana',    tipo:'clase',  icon:'🌅' },
  { id:6,  label:'1° Tarde',   inicio:'13:00', fin:'14:00', turno:'Tarde',     tipo:'clase',  icon:'☀️' },
  { id:7,  label:'2° Tarde',   inicio:'14:00', fin:'15:00', turno:'Tarde',     tipo:'clase',  icon:'☀️' },
  { id:8,  label:'Recreo T',   inicio:'15:00', fin:'15:30', turno:'Tarde',     tipo:'recreo', icon:'🧃' },
  { id:9,  label:'3° Tarde',   inicio:'15:30', fin:'16:30', turno:'Tarde',     tipo:'clase',  icon:'☀️' },
  { id:10, label:'4° Tarde',   inicio:'16:30', fin:'17:30', turno:'Tarde',     tipo:'clase',  icon:'☀️' },
  { id:11, label:'1° Vespert.', inicio:'17:40', fin:'18:40', turno:'Vespertino', tipo:'clase',  icon:'🌆' },
  { id:12, label:'2° Vespert.', inicio:'18:40', fin:'19:40', turno:'Vespertino', tipo:'clase',  icon:'🌆' },
  { id:13, label:'Recreo V',   inicio:'19:40', fin:'20:00', turno:'Vespertino', tipo:'recreo', icon:'🌙' },
  { id:14, label:'3° Vespert.', inicio:'20:00', fin:'21:00', turno:'Vespertino', tipo:'clase',  icon:'🌆' },
  { id:15, label:'4° Vespert.', inicio:'21:00', fin:'22:00', turno:'Vespertino', tipo:'clase',  icon:'🌆' },
];

const MODULOS_CLASE = MODULOS.filter(m => m.tipo === 'clase');

const TURNOS_CONFIG = [
  { label:'Mañana',     icon:'🌅', modulos:[0,1,3,4,5] },
  { label:'Tarde',      icon:'☀️', modulos:[6,7,9,10]  },
  { label:'Vespertino', icon:'🌆', modulos:[11,12,14,15] },
];

const ORIENTACIONES = {
  info:  { nombre:'Informática',  ev:'ev-info',  emoji:'💻', ob:'ob-info'  },
  const: { nombre:'Construcción', ev:'ev-const', emoji:'🏗️', ob:'ob-const' },
  tur:   { nombre:'Turismo',      ev:'ev-tur',   emoji:'🌐', ob:'ob-tur'   },
  bas:   { nombre:'Básico',       ev:'ev-bas',   emoji:'📚', ob:'ob-bas'   },
};

let RECREOS = [
  { modulo:2,  evento:'Recreo de mañana',    notas:'30 min · patio' },
  { modulo:8,  evento:'Recreo de tarde',     notas:'30 min · patio' },
  { modulo:13, evento:'Recreo vespertino',   notas:'20 min · patio' },
];

let LABS = [
  { id:'A', nombre:'Lab. Informático A', ocupado:false, capacidad:20, notas:'Windows 11, Packet Tracer' },
  { id:'B', nombre:'Lab. Informático B', ocupado:false, capacidad:24, notas:'Linux Mint, Arduino IDE' },
];
let PROFESORES = [
  { id:1, apellido:'Ces',        nombre:'Roberto', orientacion:'info',  materia:'Programación'   },
  { id:2, apellido:'Di Martino', nombre:'Claudia', orientacion:'const', materia:'Construcciones' },
  { id:3, apellido:'Pieroni',    nombre:'Marcelo', orientacion:'tur',   materia:'Turismo'        },
  { id:4, apellido:'Reichert',   nombre:'Sandra',  orientacion:'info',  materia:'Redes'          },
  { id:5, apellido:'Arnaiz',     nombre:'Gustavo', orientacion:'bas',   materia:'Matemática'     },
];
let RESERVAS = [
  { id:1,  semanaOffset:0, dia:0, modulo:0,  lab:'A', curso:'4°B', orient:'info',  profeId:1, secuencia:'Introducción a Python con Turtle', cicloClases:1 },
  { id:2,  semanaOffset:0, dia:0, modulo:3,  lab:'A', curso:'6°A', orient:'const', profeId:2, secuencia:'Diseño asistido con AutoCAD', cicloClases:2 },
  { id:3,  semanaOffset:0, dia:0, modulo:6,  lab:'A', curso:'3°A', orient:'const', profeId:2, secuencia:'Planos estructurales digitales', cicloClases:1 },
  { id:4,  semanaOffset:0, dia:1, modulo:0,  lab:'B', curso:'2°C', orient:'bas',   profeId:5, secuencia:'Matemática con GeoGebra', cicloClases:2 },
  { id:5,  semanaOffset:0, dia:1, modulo:1,  lab:'A', curso:'5°A', orient:'tur',   profeId:3, secuencia:'Diseño de página web turística', cicloClases:1 },
  { id:6,  semanaOffset:0, dia:1, modulo:10, lab:'A', curso:'4°A', orient:'tur',   profeId:3, secuencia:'Reservas online: uso de sistemas', cicloClases:3 },
  { id:7,  semanaOffset:0, dia:2, modulo:0,  lab:'A', curso:'3°B', orient:'const', profeId:2, secuencia:'Maquetas 3D con SketchUp', cicloClases:1 },
  { id:8,  semanaOffset:0, dia:2, modulo:1,  lab:'B', curso:'6°B', orient:'info',  profeId:4, secuencia:'Configuración de routers Cisco', cicloClases:2 },
  { id:9,  semanaOffset:0, dia:2, modulo:11, lab:'A', curso:'1°A', orient:'bas',   profeId:5, secuencia:'Introducción a la informática', cicloClases:1 },
  { id:10, semanaOffset:0, dia:3, modulo:1,  lab:'A', curso:'2°A', orient:'const', profeId:2, secuencia:'Instalaciones eléctricas (simulación)', cicloClases:2 },
  { id:11, semanaOffset:0, dia:3, modulo:6,  lab:'B', curso:'2°B', orient:'bas',   profeId:5, secuencia:'Estadística con planilla de cálculo', cicloClases:3 },
  { id:12, semanaOffset:0, dia:3, modulo:15, lab:'B', curso:'3°B', orient:'tur',   profeId:3, secuencia:'Geografía turística digital', cicloClases:1 },
  { id:13, semanaOffset:0, dia:4, modulo:0,  lab:'B', curso:'5°A', orient:'info',  profeId:1, secuencia:'Proyecto final de programación', cicloClases:2 },
  { id:14, semanaOffset:0, dia:4, modulo:1,  lab:'A', curso:'6°A', orient:'info',  profeId:4, secuencia:'Seguridad en redes — VPN', cicloClases:1 },
  { id:15, semanaOffset:0, dia:4, modulo:11, lab:'B', curso:'4°C', orient:'info',  profeId:1, secuencia:'Algoritmia y estructuras de datos', cicloClases:3 },
];
let SOLICITUDES = [
  { id:101, semanaOffset:0, dia:2, modulo:6, lab:'B', curso:'2°A', orient:'info', profeId:4, secuencia:'Laboratorio de subredes IPv4', cicloClases:1, estado:'pendiente' },
];
let LISTA_ESPERA = [
  { id:1, profeId:4, lab:'A', dia:3, modulo:1, semanaOffset:0 },
  { id:2, profeId:5, lab:'A', dia:3, modulo:1, semanaOffset:0 },
];
let PAUTAS = [
  'Dejar el aula limpia al salir',
  'Apagar equipos al finalizar',
  'Renovar turno cada 3 clases',
  'Registrar secuencia didáctica',
  'No consumir alimentos en el laboratorio',
];

function getModulo(id){ return MODULOS.find(m=>m.id===id)||MODULOS[0]; }
function getProfe(id){ return PROFESORES.find(p=>p.id===id)||{apellido:'—',nombre:'',orientacion:'bas',materia:'—'}; }
function getLab(id)  { return LABS.find(l=>l.id===id)||{nombre:'—',ocupado:false,capacidad:0,notas:''}; }
function getHora(m){ const mod=getModulo(m); return mod?mod.inicio:''; }
function getCurrentProfId(){ return (window.SESSION&&window.SESSION.id)?window.SESSION.id:1; }

function getSemanaStart(offset){
  offset=offset||0;
  const d=new Date(HOY);
  const dow=d.getDay();
  const lunesDiff=dow===0?-6:1-dow;
  d.setDate(d.getDate()+lunesDiff+(offset*7));
  return d;
}
function formatFecha(date){ return `${date.getDate()}/${date.getMonth()+1}`; }
function getDiaDate(offset,dia){ const s=getSemanaStart(offset); s.setDate(s.getDate()+dia); return s; }
function esHoy(offset,dia){ const d=getDiaDate(offset,dia); return d.toDateString()===HOY.toDateString(); }

function toast(msg,tipo){
  tipo=tipo||'ok';
  const c=document.getElementById('toast-container');
  if(!c) return;
  const t=document.createElement('div');
  t.className='toast toast-'+tipo;
  t.setAttribute('role','status');
  const icons={ok:'✓',err:'✗',info:'ℹ',warn:'⚠'};
  t.innerHTML='<div class="toast-icon" aria-hidden="true">'+( icons[tipo]||'•')+'</div><span>'+msg+'</span>';
  c.appendChild(t);
  setTimeout(function(){ t.style.animation='toastOut .3s ease forwards'; setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },300); },2800);
}

function confirmar(msg,callback){
  const body=document.getElementById('confirm-body');
  const btn=document.getElementById('confirm-ok-btn');
  if(!body||!btn) return;
  body.innerHTML='<p>'+msg+'</p>';
  btn.onclick=function(){ cerrarModal('modal-confirm'); callback(); };
  abrirModal('modal-confirm');
}

function abrirModal(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.add('open');
  setTimeout(function(){ const f=el.querySelector('button,input,select,textarea'); if(f)f.focus(); },100);
}
function cerrarModal(id){
  const el=document.getElementById(id);
  if(el) el.classList.remove('open');
}

function navDia(dir){
  diaActual = Math.max(0, Math.min(4, diaActual + dir));
  renderCalendario();
}
function irDia(d){
  diaActual = d;
  renderCalendario();
}

function irA(pagina){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-btn,.mobile-nav-btn').forEach(function(b){ b.classList.remove('active'); b.setAttribute('aria-current','false'); });
  const pg=document.getElementById('page-'+pagina);
  if(pg) pg.classList.add('active');
  document.querySelectorAll('[data-page="'+pagina+'"]').forEach(function(b){ b.classList.add('active'); b.setAttribute('aria-current','page'); });
  if(pagina==='admin') renderAdmin();
  if(pagina==='mis-reservas') renderMisReservas();
  closeMobileNav();
}
function toggleMobileNav(){
  const nav=document.getElementById('mobile-nav');
  const ham=document.getElementById('hamburger');
  if(!nav||!ham) return;
  const isOpen=nav.classList.toggle('open');
  ham.classList.toggle('open',isOpen);
  ham.setAttribute('aria-expanded',String(isOpen));
}
function closeMobileNav(){
  const nav=document.getElementById('mobile-nav');
  const ham=document.getElementById('hamburger');
  if(nav) nav.classList.remove('open');
  if(ham){ ham.classList.remove('open'); ham.setAttribute('aria-expanded','false'); }
}
function toggleSessionMenu(){
  const m=document.getElementById('session-menu');
  const t=document.getElementById('session-trigger');
  if(!m) return;
  const isOpen=m.classList.toggle('open');
  if(t) t.setAttribute('aria-expanded',String(isOpen));
}
function closeSessionMenu(){
  const m=document.getElementById('session-menu');
  const t=document.getElementById('session-trigger');
  if(m) m.classList.remove('open');
  if(t) t.setAttribute('aria-expanded','false');
}
function cerrarSesion(){
  confirmar('¿Cerrar sesión y volver al inicio?',function(){
    sessionStorage.removeItem('session');
    window.location.href='login.html';
  });
}

function selOrient(el,orient){
  document.querySelectorAll('.orient-tab').forEach(function(t){ t.classList.remove('sel'); t.setAttribute('aria-selected','false'); });
  el.classList.add('sel');
  el.setAttribute('aria-selected','true');
  filtroOrient=orient;
  renderCalendario();
}
function setLabFilter(labId){
  filtroLab=labId;
  document.querySelectorAll('.lab-card').forEach(function(c){ c.classList.toggle('sel',c.dataset.labId===labId); c.setAttribute('aria-pressed',String(c.dataset.labId===labId)); });
  document.querySelectorAll('.lab-filter-btn').forEach(function(b){ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
  const todosBtn=document.getElementById('filt-todos');
  if(todosBtn){ todosBtn.classList.toggle('active',labId==='todos'); todosBtn.setAttribute('aria-pressed',String(labId==='todos')); }
  document.querySelectorAll('[data-lab-filter]').forEach(function(b){ const a=b.dataset.labFilter===labId; b.classList.toggle('active',a); b.setAttribute('aria-pressed',String(a)); });
  renderCalendario();
}

function renderSidebar(){
  const sl=document.getElementById('sidebar-labs');
  if(sl){
    sl.innerHTML=LABS.map(function(l){
      return '<div class="lab-card '+(filtroLab===l.id?'sel':'')+'" data-lab-id="'+l.id+'" onclick="setLabFilter(\''+l.id+'\')" role="button" tabindex="0" aria-pressed="'+(filtroLab===l.id)+'" onkeydown="if(event.key===\'Enter\'||event.key===\' \')setLabFilter(\''+l.id+'\')"><div class="lab-card-name">'+l.nombre+'</div><div class="lab-card-status '+(l.ocupado?'status-ocup':'status-libre')+'"><span class="dot '+(l.ocupado?'dot-ocup':'dot-libre')+'" aria-hidden="true"></span>'+(l.ocupado?'En mantenimiento':'Disponible')+'</div></div>';
    }).join('');
  }
  const reservasSemana=RESERVAS.filter(function(r){ return r.semanaOffset===semanaOffset; });
  const totalEspera=LISTA_ESPERA.filter(function(e){ return e.semanaOffset===semanaOffset; }).length;
  const ms=document.getElementById('mini-stats');
  if(ms){
    ms.innerHTML='<div class="mini-stat az"><div class="mini-stat-n">'+reservasSemana.length+'</div><div class="mini-stat-l">Reservas</div></div><div class="mini-stat rj"><div class="mini-stat-n">'+totalEspera+'</div><div class="mini-stat-l">Espera</div></div><div class="mini-stat vd"><div class="mini-stat-n">'+(LABS.length*5*MODULOS_CLASE.length-reservasSemana.length)+'</div><div class="mini-stat-l">Libres</div></div>';
  }
  const pl=document.getElementById('pautas-list');
  if(pl){
    pl.innerHTML=PAUTAS.map(function(p){ return '<div class="pauta-item"><span class="chk" aria-hidden="true">✓</span>'+p+'</div>'; }).join('');
  }
  const lfb=document.getElementById('lab-filter-btns');
  if(lfb){
    lfb.innerHTML=LABS.map(function(l){ return '<button class="lab-filter-btn '+(filtroLab===l.id?'active':'')+'" data-lab-filter="'+l.id+'" aria-pressed="'+(filtroLab===l.id)+'" onclick="setLabFilter(\''+l.id+'\')">Lab. '+l.id+'</button>'; }).join('');
  }
}

function renderDayNav(){
  const container=document.getElementById('day-nav-bar');
  if(!container) return;
  let html='';
  for(var d=0;d<5;d++){
    const fecha=getDiaDate(semanaOffset,d);
    const hoy=esHoy(semanaOffset,d);
    const activo=d===diaActual;
    html+='<button class="day-nav-btn'+(activo?' active':'')+(hoy?' hoy':'')+'" onclick="irDia('+d+')" aria-pressed="'+activo+'"><span class="day-nav-nombre">'+DIAS_SEMANA[d]+'</span><span class="day-nav-fecha">'+formatFecha(fecha)+'</span>'+(hoy?'<span class="day-nav-hoy-dot"></span>':'')+'</button>';
  }
  container.innerHTML=html;
}

function renderCalendario(){
  renderSidebar();
  const start=getSemanaStart(semanaOffset);
  const end=new Date(start); end.setDate(end.getDate()+4);
  const titleEl=document.getElementById('cal-title-text');
  if(titleEl){
    const fechaDia=getDiaDate(semanaOffset,diaActual);
    titleEl.innerHTML=DIAS_LARGO[diaActual]+' '+formatFecha(fechaDia)+'&nbsp;<span style="color:var(--texto-muted);font-weight:400;font-size:15px;">'+fechaDia.getFullYear()+'</span>&nbsp;<span style="color:var(--texto-muted);font-weight:400;font-size:13px;">· Semana '+formatFecha(start)+'–'+formatFecha(end)+'</span>';
  }
  renderDayNav();

  const reservasDia=RESERVAS.filter(function(r){ return r.semanaOffset===semanaOffset&&r.dia===diaActual; });
  const solicDia=SOLICITUDES.filter(function(s){ return s.semanaOffset===semanaOffset&&s.dia===diaActual&&s.estado==='pendiente'; });
  const grid=document.getElementById('cal-body');
  if(!grid) return;

  // Módulos clase del día (columnas), filtrando recreos
  const modsCols=MODULOS.filter(function(m){ return m.tipo==='clase'; });
  // Agrupar por turno para las columnas de cabecera
  const turnosConfig=TURNOS_CONFIG;

  // Labs (filas)
  const labsFiltrados=LABS.filter(function(l){ return filtroLab==='todos'||filtroLab===l.id; });

  // ---- TABLA: columnas = horas, filas = aulas ----
  let html='<div class="at-wrap"><table class="at-table" role="grid" aria-label="Horario del día"><thead>';

  // Fila 1: grupos de turno (span sobre los módulos de cada turno)
  html+='<tr><th class="at-corner" rowspan="2">Espacio</th>';
  turnosConfig.forEach(function(tc){
    // Solo módulos que están en modsCols
    const cols=tc.modulos.filter(function(mid){ return modsCols.find(function(m){ return m.id===mid; }); });
    if(!cols.length) return;
    // Check if this turno has a recreo between its modules — no, we only show clase cols
    html+='<th class="at-turno-span" colspan="'+cols.length+'"><span class="at-turno-icon">'+tc.icon+'</span>'+tc.label+'</th>';
    // Insert recreo header col if turno has a recreo
    const recreoMod=MODULOS.find(function(m){ return m.tipo==='recreo'&&m.turno===tc.label; });
    if(recreoMod){
      html+='<th class="at-recreo-col-header">☕</th>';
    }
  });
  html+='</tr>';

  // Fila 2: hora de cada módulo (subcolumnas)
  html+='<tr>';
  turnosConfig.forEach(function(tc){
    const cols=tc.modulos.filter(function(mid){ return modsCols.find(function(m){ return m.id===mid; }); });
    if(!cols.length) return;
    cols.forEach(function(mid){
      const mod=modsCols.find(function(m){ return m.id===mid; });
      html+='<th class="at-hora-header"><span class="at-hora-ini">'+mod.inicio+'</span><span class="at-hora-num">'+mod.label.replace('° Mañana','°M').replace('° Tarde','°T').replace('° Vespert.','°V')+'</span></th>';
    });
    const recreoMod=MODULOS.find(function(m){ return m.tipo==='recreo'&&m.turno===tc.label; });
    if(recreoMod){
      const recInfo=RECREOS.find(function(r){ return r.modulo===recreoMod.id; });
      html+='<th class="at-recreo-col-header at-recreo-hora"><span style="font-size:9px;display:block;">'+recreoMod.inicio+'</span><button class="at-recreo-edit" onclick="editarRecreo('+recreoMod.id+')" title="'+(recInfo?recInfo.evento:'Recreo')+'">✏️</button></th>';
    }
  });
  html+='</tr></thead><tbody>';

  // Filas: una por lab
  labsFiltrados.forEach(function(lab, labIdx){
    html+='<tr class="at-row'+(labIdx%2===1?' at-row-alt':'')+'">';
    html+='<td class="at-lab-cell"><div class="at-lab-name">'+lab.nombre+'</div><div class="at-lab-status '+(lab.ocupado?'at-status-ocup':'at-status-libre')+'">'+(lab.ocupado?'Mantenimiento':'Disponible')+'</div></td>';

    turnosConfig.forEach(function(tc){
      const cols=tc.modulos.filter(function(mid){ return modsCols.find(function(m){ return m.id===mid; }); });
      if(!cols.length) return;
      cols.forEach(function(mid){
        const r=reservasDia.find(function(x){ return x.modulo===mid&&x.lab===lab.id; });
        const s=solicDia.find(function(x){ return x.modulo===mid&&x.lab===lab.id; });
        html+='<td class="at-event-cell">';
        if(r){
          const oriOk=filtroOrient==='all'||r.orient===filtroOrient;
          if(!oriOk){
            html+='<div class="at-event at-libre" role="button" tabindex="0" onclick="abrirModalReservaSlot('+diaActual+','+mid+',\''+lab.id+'\')" aria-label="Disponible"><span class="at-ev-plus">+</span></div>';
          } else {
            const ori=ORIENTACIONES[r.orient]; const p=getProfe(r.profeId);
            html+='<div class="at-event '+ori.ev+'" role="button" tabindex="0" onclick="verDetalle('+r.id+')" aria-label="'+r.curso+'"><div class="at-ev-curso">'+r.curso+' '+ori.emoji+'</div><div class="at-ev-prof">'+p.apellido+'</div></div>';
          }
        } else if(s){
          const action=modoUsuario==='admin'?'verDetalleSolicitud('+s.id+')':'verDetalle_Pendiente('+s.id+')';
          html+='<div class="at-event ev-pendiente" role="button" tabindex="0" onclick="'+action+'" aria-label="Pendiente"><div class="at-ev-curso">'+s.curso+' ⏳</div></div>';
        } else {
          html+='<div class="at-event at-libre" role="button" tabindex="0" onclick="abrirModalReservaSlot('+diaActual+','+mid+',\''+lab.id+'\')" aria-label="Libre"><span class="at-ev-plus">+</span></div>';
        }
        html+='</td>';
      });
      // Recreo col para este turno
      const recreoMod=MODULOS.find(function(m){ return m.tipo==='recreo'&&m.turno===tc.label; });
      if(recreoMod){
        const recInfo=RECREOS.find(function(r){ return r.modulo===recreoMod.id; });
        html+='<td class="at-recreo-cell" title="'+(recInfo?recInfo.evento:'Recreo')+'"></td>';
      }
    });
    html+='</tr>';
  });

  html+='</tbody></table></div>';
  grid.innerHTML=html;
  renderEsperaCalendario();
  renderVencimientosCalendario();
  renderSolicitudesBadge();
}
function editarRecreo(moduloId){
  const rec=RECREOS.find(function(r){ return r.modulo===moduloId; });
  const mod=getModulo(moduloId);
  document.getElementById('modal-recreo-title').textContent=mod.icon+' '+mod.label+' ('+mod.inicio+'–'+mod.fin+')';
  document.getElementById('recreo-evento').value=rec?rec.evento:'Recreo';
  document.getElementById('recreo-notas').value=rec?rec.notas:'';
  document.getElementById('recreo-modulo-id').value=moduloId;
  abrirModal('modal-recreo');
}
function guardarRecreo(){
  const moduloId=parseInt(document.getElementById('recreo-modulo-id').value);
  const evento=document.getElementById('recreo-evento').value.trim();
  const notas=document.getElementById('recreo-notas').value.trim();
  if(!evento){ toast('Ingresá un nombre para el evento.','err'); return; }
  const idx=RECREOS.findIndex(function(r){ return r.modulo===moduloId; });
  if(idx>=0){ RECREOS[idx].evento=evento; RECREOS[idx].notas=notas; }
  else { RECREOS.push({modulo:moduloId,evento:evento,notas:notas}); }
  cerrarModal('modal-recreo');
  toast('Recreo actualizado.','ok');
  renderCalendario();
}

function verDetalle_Pendiente(solId){ toast('Esa solicitud está pendiente de aprobación del directivo.','info'); }

function renderSolicitudesBadge(){
  const pendientes=SOLICITUDES.filter(function(s){ return s.estado==='pendiente'; }).length;
  const badge=document.getElementById('admin-badge');
  if(badge){ badge.textContent=pendientes||''; badge.style.display=pendientes?'flex':'none'; badge.setAttribute('aria-label',pendientes?pendientes+' solicitudes pendientes':''); }
}

function renderEsperaCalendario(){
  const el=document.getElementById('espera-lista');
  if(!el) return;
  const espera=LISTA_ESPERA.filter(function(e){ return e.semanaOffset===semanaOffset; });
  if(!espera.length){ el.innerHTML='<div class="empty-state">No hay docentes en lista de espera esta semana.</div>'; return; }
  const bgColors=['#1A4E8C','#CC2222','#1F7A2E','#B8960C'];
  el.innerHTML=espera.map(function(e,i){
    const p=getProfe(e.profeId); const fecha=getDiaDate(e.semanaOffset,e.dia);
    const mod=getModulo(e.modulo);
    return '<div class="espera-item"><div class="espera-badge" style="background:'+bgColors[i%4]+'" aria-hidden="true">'+(i+1)+'</div><div style="flex:1;min-width:0;"><div class="item-name">Prof. '+p.apellido+'</div><div class="item-sub">'+DIAS_SEMANA[e.dia]+' '+formatFecha(fecha)+' · '+mod.label+' · Lab.'+e.lab+'</div></div><div class="espera-actions">'+(modoUsuario==='admin'?'<button class="espera-btn" onclick="promoverEspera('+e.id+')" aria-label="Asignar a '+p.apellido+'">✓ Asignar</button>':'')+'<button class="espera-btn cancel" onclick="quitarEspera('+e.id+')" aria-label="Quitar de espera">✕</button></div></div>';
  }).join('');
}

function renderVencimientosCalendario(){
  const el=document.getElementById('venc-lista');
  if(!el) return;
  const hoyRes=RESERVAS.filter(function(r){ return r.semanaOffset===semanaOffset; });
  if(!hoyRes.length){ el.innerHTML='<div class="empty-state">No hay reservas esta semana.</div>'; return; }
  const sorted=[].concat(hoyRes).sort(function(a,b){ return b.cicloClases-a.cicloClases; });
  const colores={3:'var(--rojo)',2:'var(--amarillo)',1:'var(--verde)'};
  el.innerHTML=sorted.slice(0,6).map(function(r){
    const p=getProfe(r.profeId); const ori=ORIENTACIONES[r.orient];
    return '<div class="list-item"><div class="venc-dot" style="background:'+(colores[r.cicloClases]||'var(--verde)')+'" aria-hidden="true"></div><div style="flex:1;"><div class="item-name">'+r.curso+' '+ori.emoji+' '+ori.nombre+'</div><div class="item-sub">Clase '+r.cicloClases+'/3 · Lab.'+r.lab+' · Prof.'+p.apellido+'</div></div>'+(r.cicloClases>=3?'<button class="espera-btn" onclick="renovarReserva('+r.id+')" aria-label="Renovar">'+(((r.renovaciones||0)>=2)?'🔄':'↻ '+(((r.renovaciones||0)+1)+'º'))+'</button>':'')+'</div>';
  }).join('');
}

function navSemana(dir){ semanaOffset+=dir; renderCalendario(); }
function irHoy(){
  semanaOffset=0;
  const dow=new Date().getDay();
  diaActual=dow===0?4:(dow===6?0:dow-1);
  diaActual=Math.max(0,Math.min(4,diaActual));
  renderCalendario();
}

function verDetalle(reservaId){
  const r=RESERVAS.find(function(x){ return x.id===reservaId; }); if(!r) return;
  const p=getProfe(r.profeId); const ori=ORIENTACIONES[r.orient];
  const fecha=getDiaDate(r.semanaOffset,r.dia);
  const mod=getModulo(r.modulo);
  const pct=(r.cicloClases/3)*100;
  const barClass=r.cicloClases===3?'danger':r.cicloClases===2?'warn':'ok';
  const body=document.getElementById('modal-detalle-body');
  if(body){
    body.innerHTML='<div class="detail-row"><div class="detail-label">Docente</div><div class="detail-value">Prof. '+p.apellido+', '+p.nombre+'</div></div><div class="detail-row"><div class="detail-label">Laboratorio</div><div class="detail-value">'+getLab(r.lab).nombre+'</div></div><div class="detail-row"><div class="detail-label">Fecha / Módulo</div><div class="detail-value">'+DIAS_LARGO[r.dia]+' '+formatFecha(fecha)+' · '+mod.label+' ('+mod.inicio+'–'+mod.fin+')</div></div><div class="detail-row"><div class="detail-label">Curso</div><div class="detail-value">'+r.curso+'</div></div><div class="detail-row"><div class="detail-label">Orientación</div><div class="detail-value"><span class="orient-badge '+ori.ob+'">'+ori.emoji+' '+ori.nombre+'</span></div></div><div class="detail-row"><div class="detail-label">Secuencia</div><div class="detail-value" style="font-style:italic;color:var(--texto-muted);">"'+r.secuencia+'"</div></div><div style="margin-top:14px;"><div class="ciclo-bar-label"><span style="font-size:12px;font-weight:700;">Ciclo didáctico</span><span style="font-size:11px;color:var(--texto-muted);">Clase '+r.cicloClases+' de 3'+(r.renovaciones?'&nbsp;&nbsp;<span style="font-weight:800;color:var(--azul)">Renovación '+r.renovaciones+'/2</span>':'')+'</span></div><div class="ciclo-bar"><div class="ciclo-bar-fill '+barClass+'" style="width:'+pct+'%"></div></div>'+(r.renovaciones>=2?'<div style="margin-top:6px;font-size:11px;color:var(--verde);font-weight:700;">✓ Podés solicitar nueva reserva completa de 3 días.</div>':'')+'</div>';
  }
  const footer=document.getElementById('modal-detalle-footer');
  if(footer){
    const isOwn=modoUsuario==='admin'||r.profeId===getCurrentProfId();
    var renovBtn='';
    if(isOwn&&r.cicloClases>=3){
      const renov=r.renovaciones||0;
      if(renov>=2){
        renovBtn='<button class="btn-ok" onclick="cerrarModal(\'modal-detalle\');renovarReserva('+r.id+')">🔄 Nueva reserva completa</button>';
      } else {
        renovBtn='<button class="btn-ok" onclick="renovarReserva('+r.id+');cerrarModal(\'modal-detalle\')">↻ Solicitar renovación</button>';
      }
    }
    footer.innerHTML='<button class="btn-cancel" onclick="cerrarModal(\'modal-detalle\')">Cerrar</button>'+renovBtn+(isOwn?'<button class="btn-danger" onclick="cerrarModal(\'modal-detalle\');cancelarReserva('+r.id+')">Cancelar reserva</button>':'');
  }
  abrirModal('modal-detalle');
}

function verDetalleSolicitud(solId){
  const s=SOLICITUDES.find(function(x){ return x.id===solId; }); if(!s) return;
  const p=getProfe(s.profeId); const ori=ORIENTACIONES[s.orient];
  const fecha=getDiaDate(s.semanaOffset,s.dia);
  const mod=getModulo(s.modulo);
  const body=document.getElementById('modal-detalle-body');
  if(body){
    body.innerHTML='<div class="pending-alert" role="status">⏳ '+(s.esRenovacion?'Solicitud de <strong>renovación semana '+s.renovacionNum+'/2</strong> — pendiente de aprobación.':'Esta solicitud está <strong>pendiente de aprobación</strong>.')+'</div><div class="detail-row"><div class="detail-label">Docente</div><div class="detail-value">Prof. '+p.apellido+', '+p.nombre+'</div></div><div class="detail-row"><div class="detail-label">Laboratorio</div><div class="detail-value">'+getLab(s.lab).nombre+'</div></div><div class="detail-row"><div class="detail-label">Fecha / Módulo</div><div class="detail-value">'+DIAS_LARGO[s.dia]+' '+formatFecha(fecha)+' · '+mod.label+' ('+mod.inicio+'–'+mod.fin+')</div></div><div class="detail-row"><div class="detail-label">Curso</div><div class="detail-value">'+s.curso+'</div></div><div class="detail-row"><div class="detail-label">Orientación</div><div class="detail-value"><span class="orient-badge '+ori.ob+'">'+ori.emoji+' '+ori.nombre+'</span></div></div><div class="detail-row"><div class="detail-label">Secuencia</div><div class="detail-value" style="font-style:italic;color:var(--texto-muted);">"'+s.secuencia+'"</div></div>';
  }
  const footer=document.getElementById('modal-detalle-footer');
  if(footer){
    footer.innerHTML='<button class="btn-cancel" onclick="cerrarModal(\'modal-detalle\')">Cerrar</button><button class="btn-danger" onclick="cerrarModal(\'modal-detalle\');rechazarSolicitud('+s.id+')">✕ Rechazar</button><button class="btn-ok" onclick="cerrarModal(\'modal-detalle\');aceptarSolicitud('+s.id+')">✓ Aprobar</button>';
  }
  abrirModal('modal-detalle');
}

function aceptarSolicitud(solId){
  if(modoUsuario!=='admin'){ toast('Solo el directivo puede aprobar solicitudes.','err'); return; }
  const s=SOLICITUDES.find(function(x){ return x.id===solId; }); if(!s) return;
  const conflicto=RESERVAS.find(function(r){ return r.semanaOffset===s.semanaOffset&&r.dia===s.dia&&r.modulo===s.modulo&&r.lab===s.lab; });
  if(conflicto){ toast('Ese turno fue ocupado mientras estaba pendiente.','warn'); return; }
  if(s.esRenovacion && s.reservaOriginalId){
    // Es renovación: actualizar la reserva original
    const rOrig=RESERVAS.find(function(x){ return x.id===s.reservaOriginalId; });
    if(rOrig){
      rOrig.cicloClases=1;
      rOrig.renovaciones=(rOrig.renovaciones||0)+1;
    } else {
      // Si la reserva original fue cancelada, crear nueva de 1 día
      nextId++;
      RESERVAS.push({id:nextId,semanaOffset:s.semanaOffset,dia:s.dia,modulo:s.modulo,lab:s.lab,curso:s.curso,orient:s.orient,profeId:s.profeId,secuencia:s.secuencia,cicloClases:1,renovaciones:s.renovacionNum||1});
    }
    SOLICITUDES=SOLICITUDES.filter(function(x){ return x.id!==solId; });
    toast('Renovación semana '+s.renovacionNum+'/2 aprobada. El turno sigue activo por 1 día.','ok');
    renderAll();
    return;
  }
  nextId++;
  RESERVAS.push({id:nextId,semanaOffset:s.semanaOffset,dia:s.dia,modulo:s.modulo,lab:s.lab,curso:s.curso,orient:s.orient,profeId:s.profeId,secuencia:s.secuencia,cicloClases:1,renovaciones:0});
  SOLICITUDES=SOLICITUDES.filter(function(x){ return x.id!==solId; });
  toast('Solicitud aprobada. Reserva confirmada.','ok');
  renderAll();
}
function rechazarSolicitud(solId){
  if(modoUsuario!=='admin'){ toast('Solo el directivo puede rechazar solicitudes.','err'); return; }
  const s=SOLICITUDES.find(function(x){ return x.id===solId; }); if(!s) return;
  const p=getProfe(s.profeId);
  confirmar('¿Rechazar la solicitud de <strong>Prof. '+p.apellido+'</strong> — '+s.curso+'?',function(){
    SOLICITUDES=SOLICITUDES.filter(function(x){ return x.id!==solId; });
    toast('Solicitud rechazada.','info');
    renderAll();
  });
}

function poblarSelectsReserva(){
  ['f-lab','espera-lab'].forEach(function(sid){
    const sel=document.getElementById(sid); if(!sel) return;
    sel.innerHTML='<option value="">Seleccionar...</option>'+LABS.map(function(l){ return '<option value="'+l.id+'">'+l.nombre+'</option>'; }).join('');
  });
  ['f-dia','espera-dia'].forEach(function(sid){
    const sel=document.getElementById(sid); if(!sel) return;
    sel.innerHTML='<option value="">Seleccionar...</option>';
    for(var d=0;d<5;d++){ const f=getDiaDate(semanaOffset,d); sel.innerHTML+='<option value="'+d+'">'+DIAS_SEMANA[d]+' '+formatFecha(f)+'</option>'; }
  });
  ['f-modulo','espera-modulo'].forEach(function(sid){
    const sel=document.getElementById(sid); if(!sel) return;
    let opts='<option value="">Seleccionar módulo…</option>';
    var turnoActual='';
    MODULOS_CLASE.forEach(function(m){
      if(m.turno!==turnoActual){
        if(turnoActual) opts+='</optgroup>';
        opts+='<optgroup label="'+m.turno+'">'; turnoActual=m.turno;
      }
      opts+='<option value="'+m.id+'">'+m.label+' ('+m.inicio+'–'+m.fin+')</option>';
    });
    if(turnoActual) opts+='</optgroup>';
    sel.innerHTML=opts;
  });
  const fPeriodo=document.getElementById('f-periodo');
  if(fPeriodo){
    let opts='<option value="1">1 hora (módulo individual)</option><option value="2">2 horas (2 módulos consecutivos)</option><option value="4">4 horas (4 módulos consecutivos)</option>';
    TURNOS_CONFIG.forEach(function(t){ opts+='<option value="turno_'+t.label+'">'+t.icon+' Turno completo '+t.label+' ('+t.modulos.length+' horas)</option>'; });
    fPeriodo.innerHTML=opts;
  }
}

function abrirModalReserva(){
  poblarSelectsReserva();
  ['f-lab','f-dia','f-curso','f-secuencia'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
  const orient=document.getElementById('f-orient'); if(orient) orient.value='info';
  const fmod=document.getElementById('f-modulo'); if(fmod) fmod.value='';
  const fper=document.getElementById('f-periodo'); if(fper) fper.value='1';
  const cw=document.getElementById('conflict-warning'); if(cw) cw.classList.remove('show');
  abrirModal('modal-reserva');
}
function abrirModalReservaSlot(dia,modulo,lab){
  poblarSelectsReserva();
  const fLab=document.getElementById('f-lab'); const fDia=document.getElementById('f-dia'); const fMod=document.getElementById('f-modulo');
  if(fLab) fLab.value=lab; if(fDia) fDia.value=dia; if(fMod) fMod.value=modulo;
  const fCurso=document.getElementById('f-curso'); const fSeq=document.getElementById('f-secuencia');
  if(fCurso) fCurso.value=''; if(fSeq) fSeq.value='';
  checkConflict();
  abrirModal('modal-reserva');
}

function checkConflict(){
  const lab=document.getElementById('f-lab'); const dia=document.getElementById('f-dia'); const mod=document.getElementById('f-modulo'); const cw=document.getElementById('conflict-warning');
  if(!lab||!dia||!mod||!cw) return;
  if(!lab.value||dia.value===''||mod.value===''){ cw.classList.remove('show'); return; }
  const conflict=RESERVAS.find(function(r){ return r.semanaOffset===semanaOffset&&r.dia===parseInt(dia.value)&&r.modulo===parseInt(mod.value)&&r.lab===lab.value; });
  const solConflict=SOLICITUDES.find(function(s){ return s.semanaOffset===semanaOffset&&s.dia===parseInt(dia.value)&&s.modulo===parseInt(mod.value)&&s.lab===lab.value&&s.estado==='pendiente'; });
  cw.classList.toggle('show',!!(conflict||solConflict));
}

function getModulosParaPeriodo(moduloBase, periodoVal){
  if(typeof periodoVal==='string' && periodoVal.indexOf('turno_')===0){
    const turnoNombre=periodoVal.replace('turno_','');
    const tc=TURNOS_CONFIG.find(function(t){ return t.label===turnoNombre; });
    return tc?tc.modulos:[moduloBase];
  }
  const n=parseInt(periodoVal)||1;
  if(n===1) return [moduloBase];
  const idx=MODULOS_CLASE.findIndex(function(m){ return m.id===moduloBase; });
  if(idx<0) return [moduloBase];
  return MODULOS_CLASE.slice(idx,idx+n).map(function(m){ return m.id; });
}

function guardarReserva(){
  const lab=document.getElementById('f-lab').value;
  const dia=document.getElementById('f-dia').value;
  const modulo=document.getElementById('f-modulo').value;
  const curso=document.getElementById('f-curso').value;
  const secuencia=document.getElementById('f-secuencia').value.trim();
  const orient=document.getElementById('f-orient').value;
  const periodoEl=document.getElementById('f-periodo');
  const periodo=periodoEl?periodoEl.value:'1';
  if(!lab||dia===''||modulo===''||!curso||!secuencia){ toast('Por favor completá todos los campos.','err'); return; }
  const modulosAReservar=getModulosParaPeriodo(parseInt(modulo),periodo);
  for(var mi=0;mi<modulosAReservar.length;mi++){
    const m=modulosAReservar[mi];
    const conflicto=RESERVAS.find(function(r){ return r.semanaOffset===semanaOffset&&r.dia===parseInt(dia)&&r.modulo===m&&r.lab===lab; });
    if(conflicto){ toast('El módulo '+getModulo(m).label+' ya está reservado.','warn'); return; }
    const solicPendiente=SOLICITUDES.find(function(s){ return s.semanaOffset===semanaOffset&&s.dia===parseInt(dia)&&s.modulo===m&&s.lab===lab&&s.estado==='pendiente'; });
    if(solicPendiente){ toast('El módulo '+getModulo(m).label+' ya tiene solicitud pendiente.','warn'); return; }
  }
  cerrarModal('modal-reserva');
  if(modoUsuario==='admin'){
    modulosAReservar.forEach(function(m){ nextId++; RESERVAS.push({id:nextId,semanaOffset:semanaOffset,dia:parseInt(dia),modulo:m,lab:lab,curso:curso,orient:orient,profeId:getCurrentProfId(),secuencia:secuencia,cicloClases:1}); });
    toast('Reserva creada ('+modulosAReservar.length+' módulo'+(modulosAReservar.length>1?'s':'')+').','ok');
  } else {
    modulosAReservar.forEach(function(m){ nextId++; SOLICITUDES.push({id:nextId,semanaOffset:semanaOffset,dia:parseInt(dia),modulo:m,lab:lab,curso:curso,orient:orient,profeId:getCurrentProfId(),secuencia:secuencia,cicloClases:1,estado:'pendiente'}); });
    toast('Solicitud enviada ('+modulosAReservar.length+' módulo'+(modulosAReservar.length>1?'s':'')+').','info');
  }
  renderAll();
}

function abrirModalEspera(){
  poblarSelectsReserva();
  ['espera-lab','espera-dia','espera-modulo'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
  abrirModal('modal-espera');
}
function guardarEspera(){
  const lab=document.getElementById('espera-lab').value;
  const dia=document.getElementById('espera-dia').value;
  const modulo=document.getElementById('espera-modulo').value;
  if(!lab||dia===''||modulo===''){ toast('Completá todos los campos.','err'); return; }
  const ocupado=RESERVAS.find(function(r){ return r.semanaOffset===semanaOffset&&r.dia===parseInt(dia)&&r.modulo===parseInt(modulo)&&r.lab===lab; });
  if(!ocupado){ toast('Ese turno está disponible. Podés solicitarlo directamente.','info'); cerrarModal('modal-espera'); abrirModalReservaSlot(parseInt(dia),parseInt(modulo),lab); return; }
  const yaEnEspera=LISTA_ESPERA.find(function(e){ return e.profeId===getCurrentProfId()&&e.lab===lab&&e.dia===parseInt(dia)&&e.modulo===parseInt(modulo)&&e.semanaOffset===semanaOffset; });
  if(yaEnEspera){ toast('Ya estás anotado en espera para ese turno.','warn'); cerrarModal('modal-espera'); return; }
  nextId++;
  LISTA_ESPERA.push({id:nextId,profeId:getCurrentProfId(),lab:lab,dia:parseInt(dia),modulo:parseInt(modulo),semanaOffset:semanaOffset});
  cerrarModal('modal-espera');
  toast('Anotado en lista de espera.','ok');
  renderAll();
}
function quitarEspera(id){
  confirmar('¿Querés quitarte de la lista de espera?',function(){
    LISTA_ESPERA=LISTA_ESPERA.filter(function(e){ return e.id!==id; });
    toast('Removido de lista de espera.','info'); renderAll();
  });
}
function promoverEspera(id){
  const e=LISTA_ESPERA.find(function(x){ return x.id===id; }); if(!e) return;
  const ocupado=RESERVAS.find(function(r){ return r.semanaOffset===e.semanaOffset&&r.dia===e.dia&&r.modulo===e.modulo&&r.lab===e.lab; });
  if(ocupado){ toast('Ese turno sigue ocupado.','warn'); return; }
  const p=getProfe(e.profeId);
  nextId++;
  RESERVAS.push({id:nextId,semanaOffset:e.semanaOffset,dia:e.dia,modulo:e.modulo,lab:e.lab,curso:'—',orient:p.orientacion||'bas',profeId:e.profeId,secuencia:'(asignado desde espera)',cicloClases:1});
  LISTA_ESPERA=LISTA_ESPERA.filter(function(x){ return x.id!==id; });
  toast('Turno asignado a Prof. '+p.apellido+'.','ok'); renderAll();
}

function renderMisReservas(){
  const isAdmin=modoUsuario==='admin';
  const profId=getCurrentProfId();
  const titleEl=document.getElementById('mis-reservas-title');
  const subEl=document.getElementById('mis-reservas-sub');
  if(titleEl) titleEl.textContent=isAdmin?'Todas las reservas':'Mis reservas';
  if(subEl) subEl.textContent=isAdmin?'Vista directiva · todos los docentes':(window.SESSION?window.SESSION.display:'');
  const misRes=isAdmin?[].concat(RESERVAS).sort(function(a,b){ return a.dia-b.dia||a.modulo-b.modulo; }):RESERVAS.filter(function(r){ return r.profeId===profId; }).sort(function(a,b){ return a.dia-b.dia||a.modulo-b.modulo; });
  const misSols=isAdmin?[]:SOLICITUDES.filter(function(s){ return s.profeId===profId&&s.estado==='pendiente'; });
  const strip=document.getElementById('mis-stats-strip');
  if(strip){
    strip.innerHTML='<div class="stat-card az"><div class="stat-card-n">'+misRes.length+'</div><div class="stat-card-l">'+(isAdmin?'Reservas totales':'Activas')+'</div></div>'+(!isAdmin?'<div class="stat-card am"><div class="stat-card-n">'+misSols.length+'</div><div class="stat-card-l">Pendientes</div></div>':'')+'<div class="stat-card rj"><div class="stat-card-n">'+misRes.filter(function(r){ return r.cicloClases>=3; }).length+'</div><div class="stat-card-l">A renovar</div></div>';
  }
  const list=document.getElementById('mis-reservas-list');
  const empty=document.getElementById('mis-reservas-empty');
  if(!list) return;
  if(!misRes.length&&!misSols.length){ list.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  let solHtml='';
  if(misSols.length){
    solHtml='<div class="section-label-strip">⏳ Solicitudes pendientes de aprobación</div><div class="reservas-grid">'+misSols.map(function(s){
      const ori=ORIENTACIONES[s.orient]; const lab=getLab(s.lab); const fecha=getDiaDate(s.semanaOffset,s.dia); const mod=getModulo(s.modulo);
      return '<div class="reserva-card reserva-card-pending"><div class="reserva-card-stripe '+s.orient+'"></div><div class="reserva-card-body"><div class="reserva-card-header"><div><div class="reserva-card-title">'+lab.nombre+'</div><div class="reserva-meta"><span class="meta-tag">'+DIAS_LARGO[s.dia]+' '+mod.inicio+'</span><span class="meta-tag orient-badge '+ori.ob+'">'+ori.emoji+' '+ori.nombre+'</span></div></div><div class="reserva-curso-badge">'+s.curso+'</div></div><div class="reserva-secuencia">"'+s.secuencia+'"</div><div class="pending-status-bar">⏳ Pendiente de aprobación directiva</div></div><div class="reserva-card-footer"><button class="btn-action btn-cancel-r" onclick="cancelarSolicitud('+s.id+')">Cancelar solicitud</button></div></div>';
    }).join('')+'</div>';
  }
  let reservasHtml='';
  if(misRes.length){
    reservasHtml='<div class="reservas-grid">'+misRes.map(function(r){
      const p=getProfe(r.profeId); const ori=ORIENTACIONES[r.orient]; const lab=getLab(r.lab); const mod=getModulo(r.modulo);
      const needsRenew=r.cicloClases>=3;
      const dots=[1,2,3].map(function(i){ let cls='empty'; if(i<r.cicloClases)cls='done'; else if(i===r.cicloClases)cls=needsRenew?'warn':'current'; return '<div class="ciclo-dot '+cls+'" aria-hidden="true"></div>'; }).join('');
      return '<div class="reserva-card"><div class="reserva-card-stripe '+r.orient+'"></div><div class="reserva-card-body"><div class="reserva-card-header"><div><div class="reserva-card-title">'+lab.nombre+'</div><div class="reserva-meta"><span class="meta-tag">'+DIAS_LARGO[r.dia]+' '+mod.inicio+'</span><span class="meta-tag orient-badge '+ori.ob+'">'+ori.emoji+' '+ori.nombre+'</span>'+(isAdmin?'<span class="meta-tag">Prof.'+p.apellido+'</span>':'')+'</div></div><div class="reserva-curso-badge">'+r.curso+'</div></div><div class="reserva-secuencia">"'+r.secuencia+'"</div><div class="ciclo-wrap"><div class="ciclo-dots" role="img" aria-label="Clase '+r.cicloClases+' de 3">'+dots+'</div><span class="ciclo-text '+(needsRenew?'renew':'')+'">Clase '+r.cicloClases+'/3'+(needsRenew?((r.renovaciones||0)>=2?' · ¡Nueva reserva!':' · Renovar '+(((r.renovaciones||0)+1)+'/2')):'')+'</span></div></div><div class="reserva-card-footer"><button class="btn-action btn-detail" onclick="verDetalle('+r.id+')">Ver detalle</button>'+(needsRenew?'<button class="btn-action btn-renew" onclick="renovarReserva('+r.id+')">↻ Renovar</button>':'')+'<button class="btn-action btn-cancel-r" onclick="cancelarReserva('+r.id+')">Cancelar</button></div></div>';
    }).join('')+'</div>';
  }
  list.innerHTML=solHtml+reservasHtml;
}

function cancelarSolicitud(solId){
  const s=SOLICITUDES.find(function(x){ return x.id===solId; }); if(!s) return;
  confirmar('¿Cancelar esta solicitud pendiente?',function(){
    SOLICITUDES=SOLICITUDES.filter(function(x){ return x.id!==solId; }); toast('Solicitud cancelada.','info'); renderAll();
  });
}
function getRenovacionesActivas(r){
  // Cuenta cuántas solicitudes/reservas de renovación existen para este lab+dia+modulo+profe
  return (r.renovaciones||0);
}
function puedeNuevaReservaCompleta(r){
  // Puede hacer reserva de 3 días si ya pasaron 2 semanas de renovaciones (2 renovaciones aceptadas)
  return (r.renovaciones||0)>=2;
}
function renovarReserva(id){
  const r=RESERVAS.find(function(x){ return x.id===id; }); if(!r) return;
  if(modoUsuario==='admin'){
    // Admin puede renovar directamente
    if(puedeNuevaReservaCompleta(r)){
      confirmar('Han pasado 2 semanas de renovaciones. ¿Iniciar nuevo ciclo completo de 3 clases?',function(){
        r.cicloClases=1; r.renovaciones=0; r.semanaRenovacion=null;
        toast('Nuevo ciclo completo iniciado.','ok'); renderAll();
      });
    } else {
      confirmar('¿Aprobar renovación por 1 día para '+getLab(r.lab).nombre+' — '+r.curso+'?',function(){
        r.cicloClases=1; r.renovaciones=(r.renovaciones||0)+1;
        toast('Renovación aprobada (semana '+(r.renovaciones)+'/2).','ok'); renderAll();
      });
    }
    return;
  }
  // Docente: envía solicitud de renovación
  if(puedeNuevaReservaCompleta(r)){
    toast('Ya cumpliste 2 semanas de renovación. Podés hacer una nueva reserva de 3 días normalmente.','info');
    return;
  }
  const labNombre=getLab(r.lab).nombre;
  const semLabel=(r.renovaciones||0)+1;
  confirmar('¿Solicitar renovación semanal '+semLabel+'/2 para <strong>'+labNombre+' — '+r.curso+'</strong>? El directivo deberá aprobarla.',function(){
    nextId++;
    SOLICITUDES.push({
      id:nextId,
      semanaOffset:semanaOffset,
      dia:r.dia,
      modulo:r.modulo,
      lab:r.lab,
      curso:r.curso,
      orient:r.orient,
      profeId:r.profeId,
      secuencia:r.secuencia,
      cicloClases:1,
      estado:'pendiente',
      esRenovacion:true,
      reservaOriginalId:r.id,
      renovacionNum:semLabel
    });
    toast('Solicitud de renovación semana '+semLabel+'/2 enviada al directivo.','info');
    renderAll();
  });
}
function cancelarReserva(id){
  const r=RESERVAS.find(function(x){ return x.id===id; }); if(!r) return;
  const p=getProfe(r.profeId);
  confirmar('¿Cancelar la reserva de <strong>Prof. '+p.apellido+'</strong> — '+r.curso+' el '+DIAS_LARGO[r.dia]+'?',function(){
    RESERVAS=RESERVAS.filter(function(x){ return x.id!==id; }); toast('Reserva cancelada.','info');
    const waiting=LISTA_ESPERA.filter(function(e){ return e.lab===r.lab&&e.dia===r.dia&&e.modulo===r.modulo; });
    if(waiting.length) setTimeout(function(){ toast('Hay '+waiting.length+' docente(s) en espera para ese turno.','warn'); },400);
    renderAll();
  });
}

function renderAdmin(){
  const total=RESERVAS.length;
  const pendientes=SOLICITUDES.filter(function(s){ return s.estado==='pendiente'; }).length;
  const docActivos=new Set(RESERVAS.map(function(r){ return r.profeId; })).size;
  const labs=LABS.length;
  ['s-semana','s-pendientes','s-docs','s-labs'].forEach(function(id,i){
    const el=document.getElementById(id); if(el) el.textContent=[total,pendientes,docActivos,labs][i];
  });
  renderSolicitudesAdmin(); renderProfesores(); renderLabsConfig(); renderAdminReservas(); renderPautasAdmin();
}

function renderSolicitudesAdmin(){
  const el=document.getElementById('solicitudes-tbody'); if(!el) return;
  const solic=SOLICITUDES.filter(function(s){ return s.estado==='pendiente'; });
  const count=document.getElementById('solicitudes-count');
  if(count) count.textContent=solic.length?'('+solic.length+')':'';
  if(!solic.length){ el.innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--texto-muted);padding:20px;">No hay solicitudes pendientes.</td></tr>'; return; }
  el.innerHTML=solic.map(function(s){
    const p=getProfe(s.profeId); const ori=ORIENTACIONES[s.orient]; const fecha=getDiaDate(s.semanaOffset,s.dia); const mod=getModulo(s.modulo);
    return '<tr'+(s.esRenovacion?' style="background:#eff6ff"':'')+'><td>Prof. '+p.apellido+'</td><td>Lab.'+s.lab+(s.esRenovacion?'&nbsp;<span style="font-size:9px;font-weight:800;background:var(--azul);color:#fff;padding:1px 5px;border-radius:4px;">RENOV '+s.renovacionNum+'/2</span>':'')+'</td><td>'+DIAS_SEMANA[s.dia]+' '+formatFecha(fecha)+'</td><td>'+mod.label+' ('+mod.inicio+')</td><td>'+s.curso+'</td><td><span class="orient-badge '+ori.ob+'">'+ori.emoji+' '+ori.nombre+'</span></td><td><div class="table-actions"><button class="tbl-btn ok" onclick="aceptarSolicitud('+s.id+')" aria-label="Aprobar">✓ Aprobar</button><button class="tbl-btn danger" onclick="rechazarSolicitud('+s.id+')" aria-label="Rechazar">✕ Rechazar</button></div></td></tr>';
  }).join('');
}
function renderProfesores(){
  const qEl=document.getElementById('search-prof'); const q=qEl?qEl.value.toLowerCase():'';
  const tbody=document.getElementById('prof-tbody'); if(!tbody) return;
  const filtered=PROFESORES.filter(function(p){ return (p.apellido+' '+p.nombre+' '+p.materia).toLowerCase().indexOf(q)>=0; });
  tbody.innerHTML=filtered.map(function(p){
    const ori=ORIENTACIONES[p.orientacion]||ORIENTACIONES.bas;
    const reservas=RESERVAS.filter(function(r){ return r.profeId===p.id; }).length;
    return '<tr><td><strong>'+p.apellido+'</strong>, '+p.nombre+'</td><td>'+p.materia+'</td><td><span class="orient-badge '+ori.ob+'">'+ori.emoji+' '+ori.nombre+'</span></td><td><strong>'+reservas+'</strong></td><td><div class="table-actions"><button class="tbl-btn" onclick="editarDocente('+p.id+')">✏️ Editar</button><button class="tbl-btn danger" onclick="eliminarDocente('+p.id+')">🗑 Eliminar</button></div></td></tr>';
  }).join('');
  if(!filtered.length) tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--texto-muted);padding:20px;">No se encontraron docentes.</td></tr>';
}
function renderLabsConfig(){
  const el=document.getElementById('labs-config-list'); if(!el) return;
  if(!LABS.length){ el.innerHTML='<div style="padding:16px 18px;color:var(--texto-muted);font-size:13px;">No hay espacios configurados.</div>'; return; }
  el.innerHTML=LABS.map(function(l){ return '<div class="lab-config-card"><div class="lab-config-icon" aria-hidden="true">🖥️</div><div class="lab-config-info"><div class="lab-config-name">'+l.nombre+'</div><div class="lab-config-sub">'+l.capacidad+' equipos · '+(l.notas||'Sin notas')+'</div></div><span class="orient-badge '+(l.ocupado?'ob-err':'ob-ok')+'" style="margin-right:8px;">'+(l.ocupado?'Mantenimiento':'Disponible')+'</span><div class="lab-config-actions"><button class="tbl-btn" onclick="editarLab(\''+l.id+'\')">✏️ Editar</button><button class="tbl-btn" onclick="toggleEstadoLab(\''+l.id+'\')">'+(l.ocupado?'🟢 Liberar':'🔴 Ocupar')+'</button><button class="tbl-btn danger" onclick="eliminarLab(\''+l.id+'\')">🗑</button></div></div>'; }).join('');
}
function renderAdminReservas(){
  const tbody=document.getElementById('admin-reservas-tbody'); if(!tbody) return;
  const filterEl=document.getElementById('admin-filter-orient'); const filterO=filterEl?filterEl.value:'all';
  const filtered=RESERVAS.filter(function(r){ return filterO==='all'||r.orient===filterO; });
  tbody.innerHTML=filtered.map(function(r){
    const p=getProfe(r.profeId); const ori=ORIENTACIONES[r.orient]; const fecha=getDiaDate(r.semanaOffset,r.dia); const pct=(r.cicloClases/3)*100; const mod=getModulo(r.modulo);
    return '<tr><td>Prof.'+p.apellido+'</td><td>Lab.'+r.lab+'</td><td>'+DIAS_SEMANA[r.dia]+' '+formatFecha(fecha)+'</td><td>'+mod.label+' ('+mod.inicio+')</td><td>'+r.curso+'</td><td><span class="orient-badge '+ori.ob+'">'+ori.emoji+' '+ori.nombre+'</span></td><td><div style="display:flex;align-items:center;gap:6px;"><div style="width:44px;background:var(--gris-borde);border-radius:20px;height:6px;overflow:hidden;"><div style="width:'+pct+'%;height:100%;background:var(--azul);border-radius:20px;"></div></div><span style="font-size:11px;color:var(--texto-muted);">'+r.cicloClases+'/3</span></div></td><td><div class="table-actions"><button class="tbl-btn" onclick="verDetalle('+r.id+')">👁 Ver</button><button class="tbl-btn danger" onclick="cancelarReserva('+r.id+')">🗑</button></div></td></tr>';
  }).join('');
  if(!filtered.length) tbody.innerHTML='<tr><td colspan="8" style="text-align:center;color:var(--texto-muted);padding:20px;">No hay reservas.</td></tr>';
}
function renderPautasAdmin(){
  const el=document.getElementById('pautas-admin-list'); if(!el) return;
  if(!PAUTAS.length){ el.innerHTML='<div style="padding:16px 18px;color:var(--texto-muted);font-size:13px;">No hay pautas configuradas.</div>'; return; }
  el.innerHTML=PAUTAS.map(function(p,i){ return '<div class="list-item" style="padding:10px 18px;"><span class="chk" aria-hidden="true">✓</span><span style="flex:1;font-size:13px;">'+p+'</span><button class="tbl-btn danger" onclick="eliminarPauta('+i+')" style="padding:3px 8px;font-size:11px;">✕</button></div>'; }).join('');
}

function abrirModalDocente(){
  editDocenteId=null;
  document.getElementById('modal-docente-title').textContent='+ Agregar docente';
  ['doc-apellido','doc-nombre','doc-materia'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
  const orient=document.getElementById('doc-orient'); if(orient) orient.value='info';
  abrirModal('modal-docente');
}
function editarDocente(id){
  const p=getProfe(id); editDocenteId=id;
  document.getElementById('modal-docente-title').textContent='✏️ Editar docente';
  document.getElementById('doc-apellido').value=p.apellido;
  document.getElementById('doc-nombre').value=p.nombre;
  document.getElementById('doc-materia').value=p.materia;
  document.getElementById('doc-orient').value=p.orientacion;
  abrirModal('modal-docente');
}
function guardarDocente(){
  const apellido=document.getElementById('doc-apellido').value.trim();
  const nombre=document.getElementById('doc-nombre').value.trim();
  const materia=document.getElementById('doc-materia').value.trim();
  const orient=document.getElementById('doc-orient').value;
  if(!apellido||!nombre||!materia){ toast('Completá todos los campos.','err'); return; }
  if(editDocenteId){ const p=PROFESORES.find(function(x){ return x.id===editDocenteId; }); if(p){ p.apellido=apellido; p.nombre=nombre; p.materia=materia; p.orientacion=orient; } toast('Docente actualizado.','ok'); }
  else { nextId++; PROFESORES.push({id:nextId,apellido:apellido,nombre:nombre,materia:materia,orientacion:orient}); toast('Docente agregado.','ok'); }
  cerrarModal('modal-docente'); renderAdmin();
}
function eliminarDocente(id){
  const p=getProfe(id);
  confirmar('¿Eliminar a <strong>'+p.apellido+', '+p.nombre+'</strong>? Se eliminarán sus reservas.',function(){
    PROFESORES=PROFESORES.filter(function(x){ return x.id!==id; }); RESERVAS=RESERVAS.filter(function(r){ return r.profeId!==id; }); SOLICITUDES=SOLICITUDES.filter(function(s){ return s.profeId!==id; });
    toast('Docente eliminado.','info'); renderAdmin(); renderCalendario();
  });
}
function abrirModalLab(){
  editLabId=null;
  document.getElementById('modal-lab-title').textContent='+ Agregar espacio';
  ['lab-nombre','lab-capacidad','lab-notas'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
  const estado=document.getElementById('lab-estado'); if(estado) estado.value='libre';
  abrirModal('modal-lab');
}
function editarLab(id){
  const l=getLab(id); editLabId=id;
  document.getElementById('modal-lab-title').textContent='✏️ Editar espacio';
  document.getElementById('lab-nombre').value=l.nombre;
  document.getElementById('lab-capacidad').value=l.capacidad||'';
  document.getElementById('lab-estado').value=l.ocupado?'ocupado':'libre';
  document.getElementById('lab-notas').value=l.notas||'';
  abrirModal('modal-lab');
}
function guardarLab(){
  const nombre=document.getElementById('lab-nombre').value.trim();
  const capacidad=parseInt(document.getElementById('lab-capacidad').value)||0;
  const estado=document.getElementById('lab-estado').value;
  const notas=document.getElementById('lab-notas').value.trim();
  if(!nombre){ toast('Ingresá un nombre para el espacio.','err'); return; }
  if(editLabId){ const l=LABS.find(function(x){ return x.id===editLabId; }); if(l){ l.nombre=nombre; l.capacidad=capacidad; l.ocupado=estado==='ocupado'; l.notas=notas; } toast('Espacio actualizado.','ok'); }
  else { const newId=String.fromCharCode(65+LABS.length); LABS.push({id:newId,nombre:nombre,capacidad:capacidad,ocupado:estado==='ocupado',notas:notas}); toast('Espacio "'+nombre+'" agregado.','ok'); }
  cerrarModal('modal-lab'); renderAdmin(); renderCalendario();
}
function toggleEstadoLab(id){
  const l=LABS.find(function(x){ return x.id===id; }); if(!l) return;
  l.ocupado=!l.ocupado; toast('Lab.'+l.id+': '+(l.ocupado?'En mantenimiento':'Disponible')+'.','info');
  renderAdmin(); renderSidebar();
}
function eliminarLab(id){
  const l=getLab(id);
  confirmar('¿Eliminar el espacio <strong>'+l.nombre+'</strong>? Se eliminarán sus reservas.',function(){
    LABS=LABS.filter(function(x){ return x.id!==id; }); RESERVAS=RESERVAS.filter(function(r){ return r.lab!==id; }); SOLICITUDES=SOLICITUDES.filter(function(s){ return s.lab!==id; });
    toast('Espacio eliminado.','info'); renderAdmin(); renderCalendario();
  });
}
function abrirModalPauta(){ const el=document.getElementById('pauta-texto'); if(el) el.value=''; abrirModal('modal-pauta'); }
function guardarPauta(){
  const txt=document.getElementById('pauta-texto').value.trim();
  if(!txt){ toast('Ingresá el texto de la pauta.','err'); return; }
  PAUTAS.push(txt); cerrarModal('modal-pauta'); toast('Pauta agregada.','ok'); renderAdmin(); renderSidebar();
}
function eliminarPauta(i){
  confirmar('¿Eliminar la pauta "<strong>'+PAUTAS[i]+'</strong>"?',function(){
    PAUTAS.splice(i,1); toast('Pauta eliminada.','info'); renderAdmin(); renderSidebar();
  });
}

function renderAll(){
  renderCalendario();
  const activePage=document.querySelector('.page.active');
  if(activePage){
    if(activePage.id==='page-mis-reservas') renderMisReservas();
    if(activePage.id==='page-admin') renderAdmin();
  }
}

document.addEventListener('DOMContentLoaded',function(){
  const raw=sessionStorage.getItem('session');
  if(!raw){ window.location.href='login.html'; return; }
  let session;
  try{ session=JSON.parse(raw); }
  catch(e){ window.location.href='login.html'; return; }
  window.SESSION=session;
  modoUsuario=session.role==='admin'?'admin':'prof';

  const dow=new Date().getDay();
  diaActual=dow===0?4:(dow===6?0:dow-1);
  diaActual=Math.max(0,Math.min(4,diaActual));

  const parts=session.display.replace('Prof. ','').split(' ');
  const initials=parts.length>=2?(parts[0][0]+(parts[1]?parts[1][0]:'')).toUpperCase():session.display.substring(0,2).toUpperCase();

  const avEl=document.getElementById('s-avatar');
  const nameEl=document.getElementById('s-name');
  const roleEl=document.getElementById('s-role');
  const ddName=document.getElementById('sm-name');
  const ddRole=document.getElementById('sm-role');
  if(avEl) avEl.textContent=initials;
  if(nameEl) nameEl.textContent=session.display;
  if(roleEl){ roleEl.textContent=session.role==='admin'?'directivo':'docente'; if(session.role==='admin') roleEl.classList.add('admin'); }
  if(ddName) ddName.textContent=session.display;
  if(ddRole) ddRole.textContent=session.role==='admin'?'Directivo / Administrador':'Docente';

  document.querySelectorAll('.admin-only').forEach(function(el){ el.style.display=session.role==='admin'?'':'none'; });

  document.addEventListener('click',function(e){
    if(!e.target.closest('.session-widget')) closeSessionMenu();
    if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(function(m){ m.classList.remove('open'); });
  });
  ['f-lab','f-dia','f-modulo'].forEach(function(id){ const el=document.getElementById(id); if(el) el.addEventListener('change',checkConflict); });
  renderCalendario();
});
