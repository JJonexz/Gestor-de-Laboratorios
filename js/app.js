// Proyecto: Gestión de Laboratorios EEST N°1
// Archivo: app.js
// Descripción: Lógica principal. Flujo de aprobación directiva, 8 módulos 7:20–22:00.

const HOY = new Date();
HOY.setHours(0,0,0,0);

let semanaOffset = 0;
let filtroOrient  = 'all';
let filtroLab     = 'todos';
let modoUsuario   = 'prof';
let editDocenteId = null;
let editLabId     = null;
let nextId        = 200;

const DIAS_SEMANA = ['LUN','MAR','MIÉ','JUE','VIE'];
const DIAS_LARGO  = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
const MODULOS_LABEL = [
  '1° Módulo\n7:20',  '2° Módulo\n9:10',  '3° Módulo\n11:00', '4° Módulo\n12:50',
  '5° Módulo\n14:40', '6° Módulo\n16:30', '7° Módulo\n18:20', '8° Módulo\n20:10'
];
const MODULOS_HORA = ['7:20','9:10','11:00','12:50','14:40','16:30','18:20','20:10'];
const TURNOS = [
  { label:'Mañana', modulos:[0,1,2], icon:'🌅' },
  { label:'Tarde',  modulos:[3,4,5], icon:'☀️' },
  { label:'Noche',  modulos:[6,7],   icon:'🌙' },
];
const ORIENTACIONES = {
  info:  { nombre:'Informática',  ev:'ev-info',  emoji:'💻', ob:'ob-info'  },
  const: { nombre:'Construcción', ev:'ev-const', emoji:'🏗️', ob:'ob-const' },
  tur:   { nombre:'Turismo',      ev:'ev-tur',   emoji:'🌐', ob:'ob-tur'   },
  bas:   { nombre:'Básico',       ev:'ev-bas',   emoji:'📚', ob:'ob-bas'   },
};

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
  { id:1,  semanaOffset:0, dia:0, modulo:0, lab:'A', curso:'4°B', orient:'info',  profeId:1, secuencia:'Introducción a Python con Turtle', cicloClases:1 },
  { id:2,  semanaOffset:0, dia:0, modulo:2, lab:'A', curso:'6°A', orient:'const', profeId:2, secuencia:'Diseño asistido con AutoCAD', cicloClases:2 },
  { id:3,  semanaOffset:0, dia:0, modulo:4, lab:'A', curso:'3°A', orient:'const', profeId:2, secuencia:'Planos estructurales digitales', cicloClases:1 },
  { id:4,  semanaOffset:0, dia:1, modulo:0, lab:'B', curso:'2°C', orient:'bas',   profeId:5, secuencia:'Matemática con GeoGebra', cicloClases:2 },
  { id:5,  semanaOffset:0, dia:1, modulo:1, lab:'A', curso:'5°A', orient:'tur',   profeId:3, secuencia:'Diseño de página web turística', cicloClases:1 },
  { id:6,  semanaOffset:0, dia:1, modulo:5, lab:'A', curso:'4°A', orient:'tur',   profeId:3, secuencia:'Reservas online: uso de sistemas', cicloClases:3 },
  { id:7,  semanaOffset:0, dia:2, modulo:0, lab:'A', curso:'3°B', orient:'const', profeId:2, secuencia:'Maquetas 3D con SketchUp', cicloClases:1 },
  { id:8,  semanaOffset:0, dia:2, modulo:1, lab:'B', curso:'6°B', orient:'info',  profeId:4, secuencia:'Configuración de routers Cisco', cicloClases:2 },
  { id:9,  semanaOffset:0, dia:2, modulo:6, lab:'A', curso:'1°A', orient:'bas',   profeId:5, secuencia:'Introducción a la informática', cicloClases:1 },
  { id:10, semanaOffset:0, dia:3, modulo:1, lab:'A', curso:'2°A', orient:'const', profeId:2, secuencia:'Instalaciones eléctricas (simulación)', cicloClases:2 },
  { id:11, semanaOffset:0, dia:3, modulo:3, lab:'B', curso:'2°B', orient:'bas',   profeId:5, secuencia:'Estadística con planilla de cálculo', cicloClases:3 },
  { id:12, semanaOffset:0, dia:3, modulo:7, lab:'B', curso:'3°B', orient:'tur',   profeId:3, secuencia:'Geografía turística digital', cicloClases:1 },
  { id:13, semanaOffset:0, dia:4, modulo:0, lab:'B', curso:'5°A', orient:'info',  profeId:1, secuencia:'Proyecto final de programación', cicloClases:2 },
  { id:14, semanaOffset:0, dia:4, modulo:1, lab:'A', curso:'6°A', orient:'info',  profeId:4, secuencia:'Seguridad en redes — VPN', cicloClases:1 },
  { id:15, semanaOffset:0, dia:4, modulo:6, lab:'B', curso:'4°C', orient:'info',  profeId:1, secuencia:'Algoritmia y estructuras de datos', cicloClases:3 },
];
let SOLICITUDES = [
  { id:101, semanaOffset:0, dia:2, modulo:3, lab:'B', curso:'2°A', orient:'info', profeId:4, secuencia:'Laboratorio de subredes IPv4', cicloClases:1, estado:'pendiente' },
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

// UTILS
function getProfe(id){ return PROFESORES.find(p=>p.id===id)||{apellido:'—',nombre:'',orientacion:'bas',materia:'—'}; }
function getLab(id)  { return LABS.find(l=>l.id===id)||{nombre:'—',ocupado:false,capacidad:0,notas:''}; }
function getModuloLabel(m){ return MODULOS_LABEL[m]?MODULOS_LABEL[m].split('\n')[0]:'—'; }
function getHora(m){ return MODULOS_HORA[m]||''; }
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

// TOAST
function toast(msg,tipo){
  tipo=tipo||'ok';
  const c=document.getElementById('toast-container');
  if(!c) return;
  const t=document.createElement('div');
  t.className='toast toast-'+tipo;
  t.setAttribute('role','status');
  const icons={ok:'✓',err:'✗',info:'ℹ',warn:'⚠'};
  t.innerHTML=`<div class="toast-icon" aria-hidden="true">${icons[tipo]||'•'}</div><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{ t.style.animation='toastOut .3s ease forwards'; setTimeout(()=>{ if(t.parentNode)t.parentNode.removeChild(t); },300); },2800);
}

// CONFIRM
function confirmar(msg,callback){
  const body=document.getElementById('confirm-body');
  const btn=document.getElementById('confirm-ok-btn');
  if(!body||!btn) return;
  body.innerHTML=`<p>${msg}</p>`;
  btn.onclick=function(){ cerrarModal('modal-confirm'); callback(); };
  abrirModal('modal-confirm');
}

// MODALES
function abrirModal(id){
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.add('open');
  setTimeout(()=>{ const f=el.querySelector('button,input,select,textarea'); if(f)f.focus(); },100);
}
function cerrarModal(id){
  const el=document.getElementById(id);
  if(el) el.classList.remove('open');
}

// NAVEGACIÓN
function irA(pagina){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn,.mobile-nav-btn').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-current','false'); });
  const pg=document.getElementById('page-'+pagina);
  if(pg) pg.classList.add('active');
  document.querySelectorAll('[data-page="'+pagina+'"]').forEach(b=>{ b.classList.add('active'); b.setAttribute('aria-current','page'); });
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

// FILTROS
function selOrient(el,orient){
  document.querySelectorAll('.orient-tab').forEach(t=>{ t.classList.remove('sel'); t.setAttribute('aria-selected','false'); });
  el.classList.add('sel');
  el.setAttribute('aria-selected','true');
  filtroOrient=orient;
  renderCalendario();
}
function setLabFilter(labId){
  filtroLab=labId;
  document.querySelectorAll('.lab-card').forEach(c=>{ c.classList.toggle('sel',c.dataset.labId===labId); c.setAttribute('aria-pressed',String(c.dataset.labId===labId)); });
  document.querySelectorAll('.lab-filter-btn').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
  const todosBtn=document.getElementById('filt-todos');
  if(todosBtn){ todosBtn.classList.toggle('active',labId==='todos'); todosBtn.setAttribute('aria-pressed',String(labId==='todos')); }
  document.querySelectorAll('[data-lab-filter]').forEach(b=>{ const a=b.dataset.labFilter===labId; b.classList.toggle('active',a); b.setAttribute('aria-pressed',String(a)); });
  renderCalendario();
}

// SIDEBAR
function renderSidebar(){
  const sl=document.getElementById('sidebar-labs');
  if(sl){
    sl.innerHTML=LABS.map(l=>`
      <div class="lab-card ${filtroLab===l.id?'sel':''}" data-lab-id="${l.id}" onclick="setLabFilter('${l.id}')" role="button" tabindex="0" aria-pressed="${filtroLab===l.id}" onkeydown="if(event.key==='Enter'||event.key===' ')setLabFilter('${l.id}')">
        <div class="lab-card-name">${l.nombre}</div>
        <div class="lab-card-status ${l.ocupado?'status-ocup':'status-libre'}">
          <span class="dot ${l.ocupado?'dot-ocup':'dot-libre'}" aria-hidden="true"></span>${l.ocupado?'En mantenimiento':'Disponible'}
        </div>
      </div>`).join('');
  }
  const reservasSemana=RESERVAS.filter(r=>r.semanaOffset===semanaOffset);
  const totalEspera=LISTA_ESPERA.filter(e=>e.semanaOffset===semanaOffset).length;
  const ms=document.getElementById('mini-stats');
  if(ms){
    ms.innerHTML=`
      <div class="mini-stat az"><div class="mini-stat-n">${reservasSemana.length}</div><div class="mini-stat-l">Reservas</div></div>
      <div class="mini-stat rj"><div class="mini-stat-n">${totalEspera}</div><div class="mini-stat-l">Espera</div></div>
      <div class="mini-stat vd"><div class="mini-stat-n">${LABS.length*5*8-reservasSemana.length}</div><div class="mini-stat-l">Libres</div></div>`;
  }
  const pl=document.getElementById('pautas-list');
  if(pl){
    pl.innerHTML=PAUTAS.map(p=>`<div class="pauta-item"><span class="chk" aria-hidden="true">✓</span>${p}</div>`).join('');
  }
  const lfb=document.getElementById('lab-filter-btns');
  if(lfb){
    lfb.innerHTML=LABS.map(l=>`<button class="lab-filter-btn ${filtroLab===l.id?'active':''}" data-lab-filter="${l.id}" aria-pressed="${filtroLab===l.id}" onclick="setLabFilter('${l.id}')">Lab. ${l.id}</button>`).join('');
  }
}

// CALENDARIO
function renderCalendario(){
  renderSidebar();
  const start=getSemanaStart(semanaOffset);
  const end=new Date(start); end.setDate(end.getDate()+4);
  const titleEl=document.getElementById('cal-title-text');
  if(titleEl) titleEl.innerHTML=`Semana del ${formatFecha(start)} al ${formatFecha(end)}&nbsp;<span style="color:var(--texto-muted);font-weight:400;font-size:15px;">${start.getFullYear()}</span>`;

  const daysHeader=document.getElementById('cal-days-header');
  if(daysHeader){
    let dh=`<div class="day-head day-head-empty" aria-hidden="true"></div>`;
    for(let d=0;d<5;d++){
      const fecha=getDiaDate(semanaOffset,d);
      const hoy=esHoy(semanaOffset,d);
      dh+=`<div class="day-head ${hoy?'hoy':''}">${DIAS_SEMANA[d]}<br><span class="day-fecha">${formatFecha(fecha)}</span></div>`;
    }
    daysHeader.innerHTML=dh;
  }

  const reservasSemana=RESERVAS.filter(r=>r.semanaOffset===semanaOffset);
  const solicSemana=SOLICITUDES.filter(s=>s.semanaOffset===semanaOffset&&s.estado==='pendiente');
  const grid=document.getElementById('cal-body');
  if(!grid) return;

  let html='';
  TURNOS.forEach(function(turno){
    html+=`<div class="turno-divider" role="rowgroup" aria-label="Turno ${turno.label}"><span aria-hidden="true">${turno.icon}</span> ${turno.label}</div>`;
    turno.modulos.forEach(function(m){
      html+=`<div class="cal-row" role="row">`;
      const partes=MODULOS_LABEL[m].split('\n');
      html+=`<div class="time-cell" role="rowheader"><span class="mod-n">${partes[0]}</span><span class="mod-hora">${partes[1]||''}</span></div>`;
      for(let d=0;d<5;d++){
        html+=`<div class="cal-cell" role="gridcell">`;
        for(const lab of LABS){
          if(filtroLab!=='todos'&&filtroLab!==lab.id) continue;
          const r=reservasSemana.find(x=>x.dia===d&&x.modulo===m&&x.lab===lab.id);
          const s=solicSemana.find(x=>x.dia===d&&x.modulo===m&&x.lab===lab.id);
          if(r){
            const oriOk=filtroOrient==='all'||r.orient===filtroOrient;
            if(!oriOk){
              html+=`<div class="event ev-libre" role="button" tabindex="0" onclick="abrirModalReservaSlot(${d},${m},'${lab.id}')" onkeydown="if(event.key==='Enter')abrirModalReservaSlot(${d},${m},'${lab.id}')" aria-label="Disponible Lab.${lab.id}"><div class="event-title">Disponible</div><div class="event-sub">Lab.${lab.id}</div></div>`;
            } else {
              const ori=ORIENTACIONES[r.orient]; const p=getProfe(r.profeId);
              html+=`<div class="event ${ori.ev}" role="button" tabindex="0" onclick="verDetalle(${r.id})" onkeydown="if(event.key==='Enter')verDetalle(${r.id})" aria-label="${r.curso}, ${ori.nombre}, Prof.${p.apellido}"><div class="event-title">${r.curso} <span aria-hidden="true">${ori.emoji}</span></div><div class="event-sub">Lab.${lab.id} · ${p.apellido}</div></div>`;
            }
          } else if(s){
            const ori=ORIENTACIONES[s.orient]; const p=getProfe(s.profeId);
            const action=modoUsuario==='admin'?`verDetalleSolicitud(${s.id})`:`verDetalle_Pendiente(${s.id})`;
            html+=`<div class="event ev-pendiente" role="button" tabindex="0" onclick="${action}" onkeydown="if(event.key==='Enter')${action}" aria-label="Solicitud pendiente ${s.curso}"><div class="event-title">${s.curso} <span aria-hidden="true">⏳</span></div><div class="event-sub">Lab.${lab.id} · Pendiente</div></div>`;
          } else {
            html+=`<div class="event ev-libre" role="button" tabindex="0" onclick="abrirModalReservaSlot(${d},${m},'${lab.id}')" onkeydown="if(event.key==='Enter')abrirModalReservaSlot(${d},${m},'${lab.id}')" aria-label="Disponible Lab.${lab.id} ${DIAS_SEMANA[d]} ${getHora(m)}"><div class="event-title">Disponible</div><div class="event-sub">Lab.${lab.id}</div></div>`;
          }
        }
        html+=`</div>`;
      }
      html+=`</div>`;
    });
  });
  grid.innerHTML=html;
  renderEsperaCalendario();
  renderVencimientosCalendario();
  renderSolicitudesBadge();
}

function verDetalle_Pendiente(solId){ toast('Esa solicitud está pendiente de aprobación del directivo.','info'); }

function renderSolicitudesBadge(){
  const pendientes=SOLICITUDES.filter(s=>s.estado==='pendiente').length;
  const badge=document.getElementById('admin-badge');
  if(badge){ badge.textContent=pendientes||''; badge.style.display=pendientes?'flex':'none'; badge.setAttribute('aria-label',pendientes?`${pendientes} solicitudes pendientes`:''); }
}

function renderEsperaCalendario(){
  const el=document.getElementById('espera-lista');
  if(!el) return;
  const espera=LISTA_ESPERA.filter(e=>e.semanaOffset===semanaOffset);
  if(!espera.length){ el.innerHTML=`<div class="empty-state">No hay docentes en lista de espera esta semana.</div>`; return; }
  const bgColors=['#1A4E8C','#CC2222','#1F7A2E','#B8960C'];
  el.innerHTML=espera.map((e,i)=>{
    const p=getProfe(e.profeId); const fecha=getDiaDate(e.semanaOffset,e.dia);
    return `<div class="espera-item">
      <div class="espera-badge" style="background:${bgColors[i%4]}" aria-hidden="true">${i+1}</div>
      <div style="flex:1;min-width:0;"><div class="item-name">Prof. ${p.apellido}</div><div class="item-sub">${DIAS_SEMANA[e.dia]} ${formatFecha(fecha)} · ${getModuloLabel(e.modulo)} · Lab.${e.lab}</div></div>
      <div class="espera-actions">
        ${modoUsuario==='admin'?`<button class="espera-btn" onclick="promoverEspera(${e.id})" aria-label="Asignar a ${p.apellido}">✓ Asignar</button>`:''}
        <button class="espera-btn cancel" onclick="quitarEspera(${e.id})" aria-label="Quitar de espera">✕</button>
      </div>
    </div>`;
  }).join('');
}

function renderVencimientosCalendario(){
  const el=document.getElementById('venc-lista');
  if(!el) return;
  const hoy=RESERVAS.filter(r=>r.semanaOffset===semanaOffset);
  if(!hoy.length){ el.innerHTML=`<div class="empty-state">No hay reservas esta semana.</div>`; return; }
  const sorted=[...hoy].sort((a,b)=>b.cicloClases-a.cicloClases);
  const colores={3:'var(--rojo)',2:'var(--amarillo)',1:'var(--verde)'};
  el.innerHTML=sorted.slice(0,6).map(r=>{
    const p=getProfe(r.profeId); const ori=ORIENTACIONES[r.orient];
    return `<div class="list-item">
      <div class="venc-dot" style="background:${colores[r.cicloClases]||'var(--verde)'}" aria-hidden="true"></div>
      <div style="flex:1;"><div class="item-name">${r.curso} <span aria-hidden="true">${ori.emoji}</span> ${ori.nombre}</div><div class="item-sub">Clase ${r.cicloClases}/3 · Lab.${r.lab} · Prof.${p.apellido}</div></div>
      ${r.cicloClases>=3?`<button class="espera-btn" onclick="renovarReserva(${r.id})" aria-label="Renovar ${r.curso}">↻</button>`:''}
    </div>`;
  }).join('');
}

function navSemana(dir){ semanaOffset+=dir; renderCalendario(); }
function irHoy(){ semanaOffset=0; renderCalendario(); }

// VER DETALLE — RESERVA CONFIRMADA
function verDetalle(reservaId){
  const r=RESERVAS.find(x=>x.id===reservaId); if(!r) return;
  const p=getProfe(r.profeId); const ori=ORIENTACIONES[r.orient];
  const fecha=getDiaDate(r.semanaOffset,r.dia);
  const pct=(r.cicloClases/3)*100;
  const barClass=r.cicloClases===3?'danger':r.cicloClases===2?'warn':'ok';
  const body=document.getElementById('modal-detalle-body');
  if(body){
    body.innerHTML=`
      <div class="detail-row"><div class="detail-label">Docente</div><div class="detail-value">Prof. ${p.apellido}, ${p.nombre}</div></div>
      <div class="detail-row"><div class="detail-label">Laboratorio</div><div class="detail-value">${getLab(r.lab).nombre}</div></div>
      <div class="detail-row"><div class="detail-label">Fecha / Módulo</div><div class="detail-value">${DIAS_LARGO[r.dia]} ${formatFecha(fecha)} · ${getModuloLabel(r.modulo)} (${getHora(r.modulo)})</div></div>
      <div class="detail-row"><div class="detail-label">Curso</div><div class="detail-value">${r.curso}</div></div>
      <div class="detail-row"><div class="detail-label">Orientación</div><div class="detail-value"><span class="orient-badge ${ori.ob}">${ori.emoji} ${ori.nombre}</span></div></div>
      <div class="detail-row"><div class="detail-label">Secuencia</div><div class="detail-value" style="font-style:italic;color:var(--texto-muted);">"${r.secuencia}"</div></div>
      <div style="margin-top:14px;">
        <div class="ciclo-bar-label"><span style="font-size:12px;font-weight:700;">Ciclo didáctico</span><span style="font-size:11px;color:var(--texto-muted);">Clase ${r.cicloClases} de 3</span></div>
        <div class="ciclo-bar"><div class="ciclo-bar-fill ${barClass}" style="width:${pct}%"></div></div>
      </div>`;
  }
  const footer=document.getElementById('modal-detalle-footer');
  if(footer){
    const isOwn=modoUsuario==='admin'||r.profeId===getCurrentProfId();
    footer.innerHTML=`
      <button class="btn-cancel" onclick="cerrarModal('modal-detalle')">Cerrar</button>
      ${isOwn&&r.cicloClases>=3?`<button class="btn-ok" onclick="renovarReserva(${r.id});cerrarModal('modal-detalle')">↻ Renovar ciclo</button>`:''}
      ${isOwn?`<button class="btn-danger" onclick="cerrarModal('modal-detalle');cancelarReserva(${r.id})">Cancelar reserva</button>`:''}`;
  }
  abrirModal('modal-detalle');
}

// VER DETALLE — SOLICITUD PENDIENTE (solo admin)
function verDetalleSolicitud(solId){
  const s=SOLICITUDES.find(x=>x.id===solId); if(!s) return;
  const p=getProfe(s.profeId); const ori=ORIENTACIONES[s.orient];
  const fecha=getDiaDate(s.semanaOffset,s.dia);
  const body=document.getElementById('modal-detalle-body');
  if(body){
    body.innerHTML=`
      <div class="pending-alert" role="status">⏳ Esta solicitud está <strong>pendiente de aprobación</strong>. Solo el directivo puede aprobarla.</div>
      <div class="detail-row"><div class="detail-label">Docente</div><div class="detail-value">Prof. ${p.apellido}, ${p.nombre}</div></div>
      <div class="detail-row"><div class="detail-label">Laboratorio</div><div class="detail-value">${getLab(s.lab).nombre}</div></div>
      <div class="detail-row"><div class="detail-label">Fecha / Módulo</div><div class="detail-value">${DIAS_LARGO[s.dia]} ${formatFecha(fecha)} · ${getModuloLabel(s.modulo)} (${getHora(s.modulo)})</div></div>
      <div class="detail-row"><div class="detail-label">Curso</div><div class="detail-value">${s.curso}</div></div>
      <div class="detail-row"><div class="detail-label">Orientación</div><div class="detail-value"><span class="orient-badge ${ori.ob}">${ori.emoji} ${ori.nombre}</span></div></div>
      <div class="detail-row"><div class="detail-label">Secuencia</div><div class="detail-value" style="font-style:italic;color:var(--texto-muted);">"${s.secuencia}"</div></div>`;
  }
  const footer=document.getElementById('modal-detalle-footer');
  if(footer){
    footer.innerHTML=`
      <button class="btn-cancel" onclick="cerrarModal('modal-detalle')">Cerrar</button>
      <button class="btn-danger" onclick="cerrarModal('modal-detalle');rechazarSolicitud(${s.id})">✕ Rechazar</button>
      <button class="btn-ok" onclick="cerrarModal('modal-detalle');aceptarSolicitud(${s.id})">✓ Aprobar</button>`;
  }
  abrirModal('modal-detalle');
}

// APROBAR / RECHAZAR (solo directivo)
function aceptarSolicitud(solId){
  if(modoUsuario!=='admin'){ toast('Solo el directivo puede aprobar solicitudes.','err'); return; }
  const s=SOLICITUDES.find(x=>x.id===solId); if(!s) return;
  const conflicto=RESERVAS.find(r=>r.semanaOffset===s.semanaOffset&&r.dia===s.dia&&r.modulo===s.modulo&&r.lab===s.lab);
  if(conflicto){ toast('Ese turno fue ocupado mientras estaba pendiente.','warn'); return; }
  nextId++;
  RESERVAS.push({id:nextId,semanaOffset:s.semanaOffset,dia:s.dia,modulo:s.modulo,lab:s.lab,curso:s.curso,orient:s.orient,profeId:s.profeId,secuencia:s.secuencia,cicloClases:1});
  SOLICITUDES=SOLICITUDES.filter(x=>x.id!==solId);
  toast('Solicitud aprobada. Reserva confirmada.','ok');
  renderAll();
}
function rechazarSolicitud(solId){
  if(modoUsuario!=='admin'){ toast('Solo el directivo puede rechazar solicitudes.','err'); return; }
  const s=SOLICITUDES.find(x=>x.id===solId); if(!s) return;
  const p=getProfe(s.profeId);
  confirmar(`¿Rechazar la solicitud de <strong>Prof. ${p.apellido}</strong> — ${s.curso}?`,function(){
    SOLICITUDES=SOLICITUDES.filter(x=>x.id!==solId);
    toast('Solicitud rechazada.','info');
    renderAll();
  });
}

// POBLAR SELECTS
function poblarSelectsReserva(){
  ['f-lab','espera-lab'].forEach(function(sid){
    const sel=document.getElementById(sid); if(!sel) return;
    sel.innerHTML=`<option value="">Seleccionar...</option>`+LABS.map(l=>`<option value="${l.id}">${l.nombre}</option>`).join('');
  });
  ['f-dia','espera-dia'].forEach(function(sid){
    const sel=document.getElementById(sid); if(!sel) return;
    sel.innerHTML=`<option value="">Seleccionar...</option>`;
    for(let d=0;d<5;d++){ const f=getDiaDate(semanaOffset,d); sel.innerHTML+=`<option value="${d}">${DIAS_SEMANA[d]} ${formatFecha(f)}</option>`; }
  });
}

function abrirModalReserva(){
  poblarSelectsReserva();
  ['f-lab','f-dia','f-modulo','f-curso','f-secuencia'].forEach(function(id){ const el=document.getElementById(id); if(el) el.value=''; });
  const orient=document.getElementById('f-orient'); if(orient) orient.value='info';
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
  const conflict=RESERVAS.find(r=>r.semanaOffset===semanaOffset&&r.dia===parseInt(dia.value)&&r.modulo===parseInt(mod.value)&&r.lab===lab.value);
  const solConflict=SOLICITUDES.find(s=>s.semanaOffset===semanaOffset&&s.dia===parseInt(dia.value)&&s.modulo===parseInt(mod.value)&&s.lab===lab.value&&s.estado==='pendiente');
  cw.classList.toggle('show',!!(conflict||solConflict));
}

// guardarReserva: docentes crean solicitudes pendientes; directivo aprueba directamente
function guardarReserva(){
  const lab=document.getElementById('f-lab').value;
  const dia=document.getElementById('f-dia').value;
  const modulo=document.getElementById('f-modulo').value;
  const curso=document.getElementById('f-curso').value;
  const secuencia=document.getElementById('f-secuencia').value.trim();
  const orient=document.getElementById('f-orient').value;
  if(!lab||dia===''||modulo===''||!curso||!secuencia){ toast('Por favor completá todos los campos.','err'); return; }
  const conflicto=RESERVAS.find(r=>r.semanaOffset===semanaOffset&&r.dia===parseInt(dia)&&r.modulo===parseInt(modulo)&&r.lab===lab);
  if(conflicto){ toast('Ese turno ya está reservado. Podés anotarte en la lista de espera.','warn'); return; }
  const solicPendiente=SOLICITUDES.find(s=>s.semanaOffset===semanaOffset&&s.dia===parseInt(dia)&&s.modulo===parseInt(modulo)&&s.lab===lab&&s.estado==='pendiente');
  if(solicPendiente){ toast('Ya hay una solicitud pendiente para ese turno.','warn'); return; }
  nextId++;
  if(modoUsuario==='admin'){
    RESERVAS.push({id:nextId,semanaOffset:semanaOffset,dia:parseInt(dia),modulo:parseInt(modulo),lab,curso,orient,profeId:getCurrentProfId(),secuencia,cicloClases:1});
    cerrarModal('modal-reserva');
    toast('Reserva creada y aprobada.','ok');
  } else {
    SOLICITUDES.push({id:nextId,semanaOffset:semanaOffset,dia:parseInt(dia),modulo:parseInt(modulo),lab,curso,orient,profeId:getCurrentProfId(),secuencia,cicloClases:1,estado:'pendiente'});
    cerrarModal('modal-reserva');
    toast('Solicitud enviada. El directivo deberá aprobarla.','info');
  }
  renderAll();
}

// LISTA DE ESPERA
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
  const ocupado=RESERVAS.find(r=>r.semanaOffset===semanaOffset&&r.dia===parseInt(dia)&&r.modulo===parseInt(modulo)&&r.lab===lab);
  if(!ocupado){ toast('Ese turno está disponible. Podés solicitarlo directamente.','info'); cerrarModal('modal-espera'); abrirModalReservaSlot(parseInt(dia),parseInt(modulo),lab); return; }
  const yaEnEspera=LISTA_ESPERA.find(e=>e.profeId===getCurrentProfId()&&e.lab===lab&&e.dia===parseInt(dia)&&e.modulo===parseInt(modulo)&&e.semanaOffset===semanaOffset);
  if(yaEnEspera){ toast('Ya estás anotado en espera para ese turno.','warn'); cerrarModal('modal-espera'); return; }
  nextId++;
  LISTA_ESPERA.push({id:nextId,profeId:getCurrentProfId(),lab,dia:parseInt(dia),modulo:parseInt(modulo),semanaOffset:semanaOffset});
  cerrarModal('modal-espera');
  toast('Anotado en lista de espera.','ok');
  renderAll();
}
function quitarEspera(id){
  confirmar('¿Querés quitarte de la lista de espera?',function(){
    LISTA_ESPERA=LISTA_ESPERA.filter(e=>e.id!==id);
    toast('Removido de lista de espera.','info');
    renderAll();
  });
}
function promoverEspera(id){
  const e=LISTA_ESPERA.find(x=>x.id===id); if(!e) return;
  const ocupado=RESERVAS.find(r=>r.semanaOffset===e.semanaOffset&&r.dia===e.dia&&r.modulo===e.modulo&&r.lab===e.lab);
  if(ocupado){ toast('Ese turno sigue ocupado.','warn'); return; }
  const p=getProfe(e.profeId);
  nextId++;
  RESERVAS.push({id:nextId,semanaOffset:e.semanaOffset,dia:e.dia,modulo:e.modulo,lab:e.lab,curso:'—',orient:p.orientacion||'bas',profeId:e.profeId,secuencia:'(asignado desde espera)',cicloClases:1});
  LISTA_ESPERA=LISTA_ESPERA.filter(x=>x.id!==id);
  toast(`Turno asignado a Prof. ${p.apellido}.`,'ok');
  renderAll();
}

// MIS RESERVAS
function renderMisReservas(){
  const isAdmin=modoUsuario==='admin';
  const profId=getCurrentProfId();
  const titleEl=document.getElementById('mis-reservas-title');
  const subEl=document.getElementById('mis-reservas-sub');
  if(titleEl) titleEl.textContent=isAdmin?'Todas las reservas':'Mis reservas';
  if(subEl) subEl.textContent=isAdmin?'Vista directiva · todos los docentes':(window.SESSION?window.SESSION.display:'');
  const misRes=isAdmin?[...RESERVAS].sort((a,b)=>a.dia-b.dia||a.modulo-b.modulo):RESERVAS.filter(r=>r.profeId===profId).sort((a,b)=>a.dia-b.dia||a.modulo-b.modulo);
  const misSols=isAdmin?[]:SOLICITUDES.filter(s=>s.profeId===profId&&s.estado==='pendiente');
  const strip=document.getElementById('mis-stats-strip');
  if(strip){
    strip.innerHTML=`
      <div class="stat-card az"><div class="stat-card-n">${misRes.length}</div><div class="stat-card-l">${isAdmin?'Reservas totales':'Activas'}</div></div>
      ${!isAdmin?`<div class="stat-card am"><div class="stat-card-n">${misSols.length}</div><div class="stat-card-l">Pendientes</div></div>`:''}
      <div class="stat-card rj"><div class="stat-card-n">${misRes.filter(r=>r.cicloClases>=3).length}</div><div class="stat-card-l">A renovar</div></div>`;
  }
  const list=document.getElementById('mis-reservas-list');
  const empty=document.getElementById('mis-reservas-empty');
  if(!list) return;
  if(!misRes.length&&!misSols.length){ list.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  let solHtml='';
  if(misSols.length){
    solHtml=`<div class="section-label-strip">⏳ Solicitudes pendientes de aprobación</div><div class="reservas-grid">`+misSols.map(s=>{
      const ori=ORIENTACIONES[s.orient]; const lab=getLab(s.lab); const fecha=getDiaDate(s.semanaOffset,s.dia);
      return `<div class="reserva-card reserva-card-pending">
        <div class="reserva-card-stripe ${s.orient}"></div>
        <div class="reserva-card-body">
          <div class="reserva-card-header">
            <div><div class="reserva-card-title">${lab.nombre}</div><div class="reserva-meta"><span class="meta-tag">${DIAS_LARGO[s.dia]} ${getHora(s.modulo)}</span><span class="meta-tag orient-badge ${ori.ob}">${ori.emoji} ${ori.nombre}</span></div></div>
            <div class="reserva-curso-badge">${s.curso}</div>
          </div>
          <div class="reserva-secuencia">"${s.secuencia}"</div>
          <div class="pending-status-bar">⏳ Pendiente de aprobación directiva</div>
        </div>
        <div class="reserva-card-footer"><button class="btn-action btn-cancel-r" onclick="cancelarSolicitud(${s.id})">Cancelar solicitud</button></div>
      </div>`;
    }).join('')+`</div>`;
  }
  let reservasHtml='';
  if(misRes.length){
    reservasHtml=`<div class="reservas-grid">`+misRes.map(r=>{
      const p=getProfe(r.profeId); const ori=ORIENTACIONES[r.orient]; const lab=getLab(r.lab);
      const needsRenew=r.cicloClases>=3;
      const dots=[1,2,3].map(i=>{ let cls='empty'; if(i<r.cicloClases)cls='done'; else if(i===r.cicloClases)cls=needsRenew?'warn':'current'; return `<div class="ciclo-dot ${cls}" aria-hidden="true"></div>`; }).join('');
      return `<div class="reserva-card">
        <div class="reserva-card-stripe ${r.orient}"></div>
        <div class="reserva-card-body">
          <div class="reserva-card-header">
            <div><div class="reserva-card-title">${lab.nombre}</div><div class="reserva-meta"><span class="meta-tag">${DIAS_LARGO[r.dia]} ${getHora(r.modulo)}</span><span class="meta-tag orient-badge ${ori.ob}">${ori.emoji} ${ori.nombre}</span>${isAdmin?`<span class="meta-tag">Prof.${p.apellido}</span>`:''}</div></div>
            <div class="reserva-curso-badge">${r.curso}</div>
          </div>
          <div class="reserva-secuencia">"${r.secuencia}"</div>
          <div class="ciclo-wrap"><div class="ciclo-dots" role="img" aria-label="Clase ${r.cicloClases} de 3">${dots}</div><span class="ciclo-text ${needsRenew?'renew':''}">Clase ${r.cicloClases}/3${needsRenew?' · ¡Renovar!':''}</span></div>
        </div>
        <div class="reserva-card-footer">
          <button class="btn-action btn-detail" onclick="verDetalle(${r.id})">Ver detalle</button>
          ${needsRenew?`<button class="btn-action btn-renew" onclick="renovarReserva(${r.id})">↻ Renovar</button>`:''}
          <button class="btn-action btn-cancel-r" onclick="cancelarReserva(${r.id})">Cancelar</button>
        </div>
      </div>`;
    }).join('')+`</div>`;
  }
  list.innerHTML=solHtml+reservasHtml;
}

function cancelarSolicitud(solId){
  const s=SOLICITUDES.find(x=>x.id===solId); if(!s) return;
  confirmar('¿Cancelar esta solicitud pendiente?',function(){
    SOLICITUDES=SOLICITUDES.filter(x=>x.id!==solId);
    toast('Solicitud cancelada.','info');
    renderAll();
  });
}

// RENOVAR / CANCELAR
function renovarReserva(id){
  const r=RESERVAS.find(x=>x.id===id); if(!r) return;
  confirmar(`¿Renovar el turno del ${getLab(r.lab).nombre} — ${r.curso} por 3 clases más?`,function(){
    r.cicloClases=1; toast('Ciclo didáctico renovado.','ok'); renderAll();
  });
}
function renovarDesdeCalendario(id){ renovarReserva(id); }
function cancelarReserva(id){
  const r=RESERVAS.find(x=>x.id===id); if(!r) return;
  const p=getProfe(r.profeId);
  confirmar(`¿Cancelar la reserva de <strong>Prof. ${p.apellido}</strong> — ${r.curso} el ${DIAS_LARGO[r.dia]}?`,function(){
    RESERVAS=RESERVAS.filter(x=>x.id!==id);
    toast('Reserva cancelada.','info');
    const waiting=LISTA_ESPERA.filter(e=>e.lab===r.lab&&e.dia===r.dia&&e.modulo===r.modulo);
    if(waiting.length) setTimeout(function(){ toast(`Hay ${waiting.length} docente(s) en espera para ese turno.`,'warn'); },400);
    renderAll();
  });
}

// ADMIN
function renderAdmin(){
  const total=RESERVAS.length;
  const pendientes=SOLICITUDES.filter(s=>s.estado==='pendiente').length;
  const docActivos=new Set(RESERVAS.map(r=>r.profeId)).size;
  const labs=LABS.length;
  ['s-semana','s-pendientes','s-docs','s-labs'].forEach(function(id,i){
    const el=document.getElementById(id); if(el) el.textContent=[total,pendientes,docActivos,labs][i];
  });
  renderSolicitudesAdmin();
  renderProfesores();
  renderLabsConfig();
  renderAdminReservas();
  renderPautasAdmin();
}

function renderSolicitudesAdmin(){
  const el=document.getElementById('solicitudes-tbody'); if(!el) return;
  const solic=SOLICITUDES.filter(s=>s.estado==='pendiente');
  const count=document.getElementById('solicitudes-count');
  if(count) count.textContent=solic.length?`(${solic.length})`:'';
  if(!solic.length){ el.innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--texto-muted);padding:20px;">No hay solicitudes pendientes.</td></tr>`; return; }
  el.innerHTML=solic.map(s=>{
    const p=getProfe(s.profeId); const ori=ORIENTACIONES[s.orient]; const fecha=getDiaDate(s.semanaOffset,s.dia);
    return `<tr>
      <td>Prof. ${p.apellido}</td><td>Lab.${s.lab}</td><td>${DIAS_SEMANA[s.dia]} ${formatFecha(fecha)}</td>
      <td>${getModuloLabel(s.modulo)} (${getHora(s.modulo)})</td><td>${s.curso}</td>
      <td><span class="orient-badge ${ori.ob}">${ori.emoji} ${ori.nombre}</span></td>
      <td><div class="table-actions">
        <button class="tbl-btn ok" onclick="aceptarSolicitud(${s.id})" aria-label="Aprobar">✓ Aprobar</button>
        <button class="tbl-btn danger" onclick="rechazarSolicitud(${s.id})" aria-label="Rechazar">✕ Rechazar</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderProfesores(){
  const qEl=document.getElementById('search-prof'); const q=qEl?qEl.value.toLowerCase():'';
  const tbody=document.getElementById('prof-tbody'); if(!tbody) return;
  const filtered=PROFESORES.filter(p=>`${p.apellido} ${p.nombre} ${p.materia}`.toLowerCase().includes(q));
  tbody.innerHTML=filtered.map(p=>{
    const ori=ORIENTACIONES[p.orientacion]||ORIENTACIONES.bas;
    const reservas=RESERVAS.filter(r=>r.profeId===p.id).length;
    return `<tr>
      <td><strong>${p.apellido}</strong>, ${p.nombre}</td><td>${p.materia}</td>
      <td><span class="orient-badge ${ori.ob}">${ori.emoji} ${ori.nombre}</span></td><td><strong>${reservas}</strong></td>
      <td><div class="table-actions">
        <button class="tbl-btn" onclick="editarDocente(${p.id})">✏️ Editar</button>
        <button class="tbl-btn danger" onclick="eliminarDocente(${p.id})">🗑 Eliminar</button>
      </div></td>
    </tr>`;
  }).join('');
  if(!filtered.length) tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--texto-muted);padding:20px;">No se encontraron docentes.</td></tr>`;
}

function renderLabsConfig(){
  const el=document.getElementById('labs-config-list'); if(!el) return;
  if(!LABS.length){ el.innerHTML=`<div style="padding:16px 18px;color:var(--texto-muted);font-size:13px;">No hay espacios configurados.</div>`; return; }
  el.innerHTML=LABS.map(l=>`
    <div class="lab-config-card">
      <div class="lab-config-icon" aria-hidden="true">🖥️</div>
      <div class="lab-config-info"><div class="lab-config-name">${l.nombre}</div><div class="lab-config-sub">${l.capacidad} equipos · ${l.notas||'Sin notas'}</div></div>
      <span class="orient-badge ${l.ocupado?'ob-err':'ob-ok'}" style="margin-right:8px;">${l.ocupado?'Mantenimiento':'Disponible'}</span>
      <div class="lab-config-actions">
        <button class="tbl-btn" onclick="editarLab('${l.id}')">✏️ Editar</button>
        <button class="tbl-btn" onclick="toggleEstadoLab('${l.id}')">${l.ocupado?'🟢 Liberar':'🔴 Ocupar'}</button>
        <button class="tbl-btn danger" onclick="eliminarLab('${l.id}')">🗑</button>
      </div>
    </div>`).join('');
}

function renderAdminReservas(){
  const tbody=document.getElementById('admin-reservas-tbody'); if(!tbody) return;
  const filterEl=document.getElementById('admin-filter-orient'); const filterO=filterEl?filterEl.value:'all';
  const filtered=RESERVAS.filter(r=>filterO==='all'||r.orient===filterO);
  tbody.innerHTML=filtered.map(r=>{
    const p=getProfe(r.profeId); const ori=ORIENTACIONES[r.orient]; const fecha=getDiaDate(r.semanaOffset,r.dia); const pct=(r.cicloClases/3)*100;
    return `<tr>
      <td>Prof.${p.apellido}</td><td>Lab.${r.lab}</td><td>${DIAS_SEMANA[r.dia]} ${formatFecha(fecha)}</td>
      <td>${getModuloLabel(r.modulo)} (${getHora(r.modulo)})</td><td>${r.curso}</td>
      <td><span class="orient-badge ${ori.ob}">${ori.emoji} ${ori.nombre}</span></td>
      <td><div style="display:flex;align-items:center;gap:6px;"><div style="width:44px;background:var(--gris-borde);border-radius:20px;height:6px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:var(--azul);border-radius:20px;"></div></div><span style="font-size:11px;color:var(--texto-muted);">${r.cicloClases}/3</span></div></td>
      <td><div class="table-actions">
        <button class="tbl-btn" onclick="verDetalle(${r.id})">👁 Ver</button>
        <button class="tbl-btn danger" onclick="cancelarReserva(${r.id})">🗑</button>
      </div></td>
    </tr>`;
  }).join('');
  if(!filtered.length) tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;color:var(--texto-muted);padding:20px;">No hay reservas.</td></tr>`;
}

function renderPautasAdmin(){
  const el=document.getElementById('pautas-admin-list'); if(!el) return;
  if(!PAUTAS.length){ el.innerHTML=`<div style="padding:16px 18px;color:var(--texto-muted);font-size:13px;">No hay pautas configuradas.</div>`; return; }
  el.innerHTML=PAUTAS.map((p,i)=>`
    <div class="list-item" style="padding:10px 18px;">
      <span class="chk" aria-hidden="true">✓</span>
      <span style="flex:1;font-size:13px;">${p}</span>
      <button class="tbl-btn danger" onclick="eliminarPauta(${i})" style="padding:3px 8px;font-size:11px;">✕</button>
    </div>`).join('');
}

// DOCENTES CRUD
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
  if(editDocenteId){ const p=PROFESORES.find(x=>x.id===editDocenteId); if(p){ p.apellido=apellido; p.nombre=nombre; p.materia=materia; p.orientacion=orient; } toast('Docente actualizado.','ok'); }
  else { nextId++; PROFESORES.push({id:nextId,apellido,nombre,materia,orientacion:orient}); toast('Docente agregado.','ok'); }
  cerrarModal('modal-docente'); renderAdmin();
}
function eliminarDocente(id){
  const p=getProfe(id);
  confirmar(`¿Eliminar a <strong>${p.apellido}, ${p.nombre}</strong>? Se eliminarán sus reservas.`,function(){
    PROFESORES=PROFESORES.filter(x=>x.id!==id); RESERVAS=RESERVAS.filter(r=>r.profeId!==id); SOLICITUDES=SOLICITUDES.filter(s=>s.profeId!==id);
    toast('Docente eliminado.','info'); renderAdmin(); renderCalendario();
  });
}

// LABS CRUD
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
  if(editLabId){ const l=LABS.find(x=>x.id===editLabId); if(l){ l.nombre=nombre; l.capacidad=capacidad; l.ocupado=estado==='ocupado'; l.notas=notas; } toast('Espacio actualizado.','ok'); }
  else { const newId=String.fromCharCode(65+LABS.length); LABS.push({id:newId,nombre,capacidad,ocupado:estado==='ocupado',notas}); toast(`Espacio "${nombre}" agregado.`,'ok'); }
  cerrarModal('modal-lab'); renderAdmin(); renderCalendario();
}
function toggleEstadoLab(id){
  const l=LABS.find(x=>x.id===id); if(!l) return;
  l.ocupado=!l.ocupado;
  toast(`Lab.${l.id}: ${l.ocupado?'En mantenimiento':'Disponible'}.`,'info');
  renderAdmin(); renderSidebar();
}
function eliminarLab(id){
  const l=getLab(id);
  confirmar(`¿Eliminar el espacio <strong>${l.nombre}</strong>? Se eliminarán sus reservas.`,function(){
    LABS=LABS.filter(x=>x.id!==id); RESERVAS=RESERVAS.filter(r=>r.lab!==id); SOLICITUDES=SOLICITUDES.filter(s=>s.lab!==id);
    toast('Espacio eliminado.','info'); renderAdmin(); renderCalendario();
  });
}

// PAUTAS CRUD
function abrirModalPauta(){ const el=document.getElementById('pauta-texto'); if(el) el.value=''; abrirModal('modal-pauta'); }
function guardarPauta(){
  const txt=document.getElementById('pauta-texto').value.trim();
  if(!txt){ toast('Ingresá el texto de la pauta.','err'); return; }
  PAUTAS.push(txt); cerrarModal('modal-pauta'); toast('Pauta agregada.','ok'); renderAdmin(); renderSidebar();
}
function eliminarPauta(i){
  confirmar(`¿Eliminar la pauta "<strong>${PAUTAS[i]}</strong>"?`,function(){
    PAUTAS.splice(i,1); toast('Pauta eliminada.','info'); renderAdmin(); renderSidebar();
  });
}

// RENDER ALL
function renderAll(){
  renderCalendario();
  const activePage=document.querySelector('.page.active');
  if(activePage){
    if(activePage.id==='page-mis-reservas') renderMisReservas();
    if(activePage.id==='page-admin') renderAdmin();
  }
}

// INIT
document.addEventListener('DOMContentLoaded',function(){
  const raw=sessionStorage.getItem('session');
  if(!raw){ window.location.href='login.html'; return; }
  let session;
  try{ session=JSON.parse(raw); }
  catch(e){ window.location.href='login.html'; return; }
  window.SESSION=session;
  modoUsuario=session.role==='admin'?'admin':'prof';

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
