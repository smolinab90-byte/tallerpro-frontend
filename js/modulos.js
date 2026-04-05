/**
 * modulos.js — Módulos de Recepción de OT y Precompra
 * Se carga después de pages.js
 */

// ── API CALLS ─────────────────────────────────────────────────────────────────
const RecepcionAPI = {
  obtener:    (ordenId)        => API.apiGet(`/ordenes/${ordenId}/recepcion`),
  crear:      (ordenId, data)  => API.apiPost(`/ordenes/${ordenId}/recepcion`, data),
  actualizar: (ordenId, data)  => API.apiPut(`/ordenes/${ordenId}/recepcion`, data),
  subirFoto:  (ordenId, itemId, fd) => API.apiUpload(`/ordenes/${ordenId}/recepcion/foto/${itemId}`, fd),
};

const PrecompraAPI = {
  listar:    (params={})  => { const qs = new URLSearchParams(params).toString(); return API.apiGet(`/precompras/${qs?`?${qs}`:''}`); },
  obtener:   (id)         => API.apiGet(`/precompras/${id}`),
  crear:     (data)       => API.apiPost('/precompras/', data),
  actualizar:(id, data)   => API.apiPut(`/precompras/${id}`, data),
  eliminar:  (id)         => API.apiDelete(`/precompras/${id}`),
  subirFoto: (id, itemId, fd) => API.apiUpload(`/precompras/${id}/foto/${itemId}`, fd),
  descargarPDF: (id, marca, modelo) => API.apiDownloadPDF(`/precompras/${id}/pdf`, `Precompra_${id}_${marca}_${modelo}.pdf`),
};

// Exponer en window.API
window.API.RecepcionAPI  = RecepcionAPI;
window.API.PrecompraAPI  = PrecompraAPI;

// ── COLORES SEMÁFORO ──────────────────────────────────────────────────────────
const SEMAFORO = {
  bueno:    { bg: '#E1F5EE', color: '#0F6E56', label: 'Bueno' },
  regular:  { bg: '#FAEEDA', color: '#854F0B', label: 'Regular' },
  malo:     { bg: '#FCEBEB', color: '#A32D2D', label: 'Malo' },
  no_aplica:{ bg: '#F1EFE8', color: '#888780', label: 'N/A' },
};

const ESTADO_REC = {
  ok:          { bg: '#E1F5EE', color: '#0F6E56', label: 'OK' },
  observacion: { bg: '#FAEEDA', color: '#854F0B', label: 'Observación' },
  dano:        { bg: '#FCEBEB', color: '#A32D2D', label: 'Daño' },
};

const RECOMENDACION = {
  comprar:    { bg: '#E1F5EE', color: '#0F6E56', label: 'Recomendado comprar' },
  evaluar:    { bg: '#FAEEDA', color: '#854F0B', label: 'Evaluar con cautela' },
  no_comprar: { bg: '#FCEBEB', color: '#A32D2D', label: 'No recomendado' },
};

function badgeSemaforo(cal) {
  const s = SEMAFORO[cal] || SEMAFORO.no_aplica;
  return `<span style="background:${s.bg};color:${s.color};padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500">${s.label}</span>`;
}

function badgeEstadoRec(estado) {
  const s = ESTADO_REC[estado] || ESTADO_REC.ok;
  return `<span style="background:${s.bg};color:${s.color};padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500">${s.label}</span>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — RECEPCIÓN DE OT
// ══════════════════════════════════════════════════════════════════════════════

async function renderRecepcionOT(ordenId) {
  const content = document.getElementById('mainContent');
  content.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-tertiary)"><div class="spinner spinner-dark"></div></div>`;

  const data = await RecepcionAPI.obtener(ordenId);
  const existe = data.existe !== false;

  // Construir estado local de ítems
  let itemsState = [];
  if (existe && data.items) {
    itemsState = data.items;
  } else {
    // Construir desde secciones vacías
    (data.secciones || []).forEach(s => {
      s.items.forEach(it => {
        itemsState.push({ seccion: s.seccion, descripcion: it.descripcion, estado: 'ok', observacion: '', foto_url: null });
      });
    });
  }

  // Agrupar por sección
  const secciones = {};
  itemsState.forEach(it => {
    if (!secciones[it.seccion]) secciones[it.seccion] = [];
    secciones[it.seccion].push(it);
  });

  const resumenBadges = () => {
    const ok  = itemsState.filter(i => i.estado === 'ok').length;
    const obs = itemsState.filter(i => i.estado === 'observacion').length;
    const dno = itemsState.filter(i => i.estado === 'dano').length;
    return `<span style="background:#E1F5EE;color:#0F6E56;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:500;margin-right:6px">OK: ${ok}</span>
            <span style="background:#FAEEDA;color:#854F0B;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:500;margin-right:6px">Observaciones: ${obs}</span>
            <span style="background:#FCEBEB;color:#A32D2D;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:500">Daños: ${dno}</span>`;
  };

  content.innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-sm btn-ghost" onclick="abrirOT(${ordenId})">← Volver a OT</button>
        <div>
          <div class="page-title">Recepción del vehículo</div>
          <div class="page-subtitle">Checklist de ingreso — OT #${String(ordenId).padStart(5,'0')}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="guardarRecepcion(${ordenId}, ${existe})">Guardar recepción</button>
      </div>
    </div>

    <div class="card mb-16">
      <div class="card-title">Datos de ingreso</div>
      <div class="form-grid">
        <div class="form-group">
          <label>Km al ingreso</label>
          <input type="number" id="recKm" value="${data.km_ingreso||''}" placeholder="95000">
        </div>
        <div class="form-group">
          <label>Nivel de combustible</label>
          <select id="recCombustible">
            ${['vacio','1/4','1/2','3/4','lleno'].map(v=>`<option value="${v}"${data.combustible_nivel===v?' selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group full">
          <label>Observaciones generales al ingreso</label>
          <textarea id="recObsGeneral" rows="2" placeholder="Estado general del vehículo al ingreso...">${data.observaciones_generales||''}</textarea>
        </div>
      </div>
    </div>

    <div class="card mb-16" style="background:var(--color-background-secondary)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="card-title" style="margin-bottom:0">Resumen checklist</div>
        <div id="resumenBadges">${resumenBadges()}</div>
      </div>
    </div>

    ${Object.entries(secciones).map(([seccion, items]) => `
      <div class="card mb-16">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin-bottom:0">${seccion}</div>
        </div>
        ${items.map((it, idx) => {
          const globalIdx = itemsState.indexOf(it);
          return `
          <div style="border:1px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:12px;margin-bottom:8px" id="item-row-${globalIdx}">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <span style="font-size:13px;font-weight:500;flex:1">${it.descripcion}</span>
              <div style="display:flex;gap:4px">
                ${['ok','observacion','dano'].map(e => {
                  const s = ESTADO_REC[e];
                  const active = it.estado === e;
                  return `<button onclick="setEstadoItem(${globalIdx}, '${e}')"
                    style="padding:4px 10px;border-radius:99px;font-size:11px;font-weight:500;cursor:pointer;border:1.5px solid ${active?s.color:s.bg};background:${active?s.bg:'transparent'};color:${s.color};transition:all .12s"
                    id="btn-estado-${globalIdx}-${e}">${s.label}</button>`;
                }).join('')}
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start">
              <input type="text" id="obs-item-${globalIdx}" value="${it.observacion||''}"
                placeholder="Observación (opcional)..."
                style="font-size:12px"
                onchange="updateItemObs(${globalIdx}, this.value)">
              <div>
                ${it.foto_url
                  ? `<img src="${it.foto_url.startsWith('http')?it.foto_url:'https://tallerpro-backend-production.up.railway.app'+it.foto_url}"
                       style="width:60px;height:60px;object-fit:cover;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-tertiary);cursor:pointer"
                       onclick="verFoto('${it.foto_url}')">`
                  : `<label style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:60px;height:60px;border:1px dashed var(--color-border-secondary);border-radius:var(--border-radius-md);cursor:pointer;font-size:10px;color:var(--color-text-tertiary);gap:2px">
                      <span style="font-size:18px">+</span><span>Foto</span>
                      <input type="file" accept="image/*" style="display:none" onchange="subirFotoItem(${ordenId}, ${it.id||'null'}, ${globalIdx}, this)">
                    </label>`}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `).join('')}
  `;

  // Guardar estado en window para acceso desde funciones
  window._recepcionItems = itemsState;
  window._recepcionOrdenId = ordenId;
}

function setEstadoItem(idx, estado) {
  window._recepcionItems[idx].estado = estado;
  // Actualizar UI de botones
  ['ok','observacion','dano'].forEach(e => {
    const btn = document.getElementById(`btn-estado-${idx}-${e}`);
    if (!btn) return;
    const s = ESTADO_REC[e];
    const active = e === estado;
    btn.style.border = `1.5px solid ${active ? s.color : s.bg}`;
    btn.style.background = active ? s.bg : 'transparent';
  });
  // Actualizar resumen
  const resDiv = document.getElementById('resumenBadges');
  if (resDiv) {
    const ok  = window._recepcionItems.filter(i => i.estado === 'ok').length;
    const obs = window._recepcionItems.filter(i => i.estado === 'observacion').length;
    const dno = window._recepcionItems.filter(i => i.estado === 'dano').length;
    resDiv.innerHTML = `
      <span style="background:#E1F5EE;color:#0F6E56;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:500;margin-right:6px">OK: ${ok}</span>
      <span style="background:#FAEEDA;color:#854F0B;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:500;margin-right:6px">Obs: ${obs}</span>
      <span style="background:#FCEBEB;color:#A32D2D;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:500">Daños: ${dno}</span>`;
  }
}

function updateItemObs(idx, val) {
  if (window._recepcionItems) window._recepcionItems[idx].observacion = val;
}

async function subirFotoItem(ordenId, itemId, idx, input) {
  if (!input.files[0]) return;
  try {
    const fd = new FormData();
    fd.append('foto', input.files[0]);
    if (itemId) {
      await RecepcionAPI.subirFoto(ordenId, itemId, fd);
    }
    ui.toast('Foto agregada');
    // Recargar la sección
    renderRecepcionOT(ordenId);
  } catch(e) { ui.toast(e.message, 'error'); }
}

async function guardarRecepcion(ordenId, existe) {
  const btn = event.target;
  ui.loading(btn, true);
  try {
    const payload = {
      km_ingreso: parseInt(document.getElementById('recKm')?.value) || null,
      combustible_nivel: document.getElementById('recCombustible')?.value,
      observaciones_generales: document.getElementById('recObsGeneral')?.value,
      items: window._recepcionItems || [],
    };
    if (existe) {
      await RecepcionAPI.actualizar(ordenId, payload);
    } else {
      await RecepcionAPI.crear(ordenId, payload);
    }
    ui.toast('Recepción guardada');
  } catch(e) { ui.toast(e.message, 'error'); }
  ui.loading(btn, false);
}

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO 2 — PRECOMPRA
// ══════════════════════════════════════════════════════════════════════════════

async function renderPrecompras() {
  const data = await PrecompraAPI.listar();
  const pcs = data.items || [];

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Precompra</div>
        <div class="page-subtitle">Inspecciones técnicas previas a compra de vehículo usado</div>
      </div>
      <button class="btn btn-primary" onclick="abrirNuevaPrecompra()">+ Nueva precompra</button>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Vehículo</th><th>Km</th><th>Resultado</th><th>Puntaje</th><th>Acciones</th></tr></thead>
      <tbody>
        ${pcs.length === 0
          ? `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">Sin precompras registradas</div><div class="empty-sub"><a onclick="abrirNuevaPrecompra()" style="color:var(--green);cursor:pointer">Crear la primera</a></div></div></td></tr>`
          : pcs.map(pc => {
              const p = pc.puntaje || {bueno:0,regular:0,malo:0,total:0};
              const r = RECOMENDACION[pc.recomendacion] || RECOMENDACION.evaluar;
              return `<tr>
                <td class="mono fw-600">${pc.numero}</td>
                <td style="font-size:11px;color:var(--text-sec)">${ui.fmtFecha(pc.fecha)}</td>
                <td>${pc.cliente_nombre}</td>
                <td class="mono">${pc.marca} ${pc.modelo} ${pc.anio||''}</td>
                <td class="mono">${pc.km_actual ? pc.km_actual.toLocaleString('es-CL')+' km' : '—'}</td>
                <td><span style="background:${r.bg};color:${r.color};padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500">${r.label}</span></td>
                <td style="font-size:11px">
                  <span style="color:#0F6E56">✓${p.bueno}</span>
                  <span style="color:#854F0B;margin:0 4px">~${p.regular}</span>
                  <span style="color:#A32D2D">✗${p.malo}</span>
                </td>
                <td style="display:flex;gap:5px">
                  <button class="btn btn-sm" onclick="abrirPrecompra(${pc.id})">Ver</button>
                  <button class="btn btn-sm btn-primary" onclick="descargarPrecompraPDF(${pc.id},'${pc.marca}','${pc.modelo}')">↓ PDF</button>
                </td>
              </tr>`;
            }).join('')}
      </tbody></table>
    </div>`;
}

let _precompraItems = [];
let _precompraId = null;

async function abrirNuevaPrecompra() {
  // Cargar secciones predefinidas
  _precompraId = null;
  _precompraItems = [];

  // Secciones hardcodeadas (mismo orden que backend)
  const SECCIONES = [
    {seccion:"Motor",       items:["Nivel de aceite","Color del aceite","Nivel refrigerante","Fugas visibles","Ruidos anormales","Estado correa distribución"]},
    {seccion:"Transmisión", items:["Cambio de marchas","Fugas caja","Nivel aceite caja","Estado caja automática"]},
    {seccion:"Frenos",      items:["Pastillas delanteras","Pastillas traseras","Discos delanteros","Discos traseros","Líquido de frenos","Freno de mano"]},
    {seccion:"Suspensión",  items:["Amortiguadores del.","Amortiguadores tras.","Rótulas y terminales","Bujes y silent-block","Dirección"]},
    {seccion:"Carrocería",  items:["Panel delantero","Capot","Guardabarro izq.","Guardabarro der.","Puertas","Panel trasero","Techo","Pintura"]},
    {seccion:"Neumáticos",  items:["Neumático del. izq.","Neumático del. der.","Neumático tras. izq.","Neumático tras. der.","Rueda repuesto"]},
    {seccion:"Eléctrico",   items:["Batería","Alternador","Luces delanteras","Luces traseras","Panel instrumentos","Aire acondicionado"]},
    {seccion:"Interior",    items:["Tapiz y tapizado","Cinturones seguridad","Airbags testigo","Audio y pantallas","Alzavidrios","Kilometraje coherente"]},
    {seccion:"OBD/Scanner", items:["Códigos DTC activos","Códigos DTC pendientes","Estado ECU"]},
  ];

  SECCIONES.forEach(s => {
    s.items.forEach(desc => {
      _precompraItems.push({ seccion: s.seccion, descripcion: desc, calificacion: 'no_aplica', observacion: '' });
    });
  });

  renderFormPrecompra(null);
}

async function abrirPrecompra(id) {
  const pc = await PrecompraAPI.obtener(id);
  _precompraId = id;
  _precompraItems = pc.items || [];
  renderFormPrecompra(pc);
}

function renderFormPrecompra(pc) {
  const es_nuevo = !pc;
  const secciones = {};
  _precompraItems.forEach((it, idx) => {
    if (!secciones[it.seccion]) secciones[it.seccion] = [];
    secciones[it.seccion].push({...it, _idx: idx});
  });

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-sm btn-ghost" onclick="navTo('precompras')">← Volver</button>
        <div>
          <div class="page-title">${es_nuevo ? 'Nueva precompra' : `Precompra ${pc.numero}`}</div>
          <div class="page-subtitle">${es_nuevo ? 'Inspección técnica de vehículo usado' : `${pc.marca} ${pc.modelo} — ${pc.cliente_nombre}`}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        ${!es_nuevo ? `<button class="btn" onclick="descargarPrecompraPDF(${pc.id},'${pc?.marca||''}','${pc?.modelo||''}')">↓ PDF</button>` : ''}
        <button class="btn btn-primary" id="btnGuardarPC" onclick="guardarPrecompra()">
          ${es_nuevo ? 'Crear precompra' : 'Guardar cambios'}
        </button>
      </div>
    </div>

    <!-- Datos básicos -->
    <div class="card mb-16">
      <div class="card-title">Datos del solicitante</div>
      <div class="form-grid">
        <div class="form-group"><label>Nombre del cliente *</label><input type="text" id="pcCliNombre" value="${pc?.cliente_nombre||''}" placeholder="Juan Pérez"></div>
        <div class="form-group"><label>Teléfono</label><input type="tel" id="pcCliTel" value="${pc?.cliente_tel||''}" placeholder="+56 9 1234 5678"></div>
        <div class="form-group full"><label>Email</label><input type="email" id="pcCliEmail" value="${pc?.cliente_email||''}" placeholder="juan@email.com"></div>
      </div>
    </div>

    <div class="card mb-16">
      <div class="card-title">Datos del vehículo a inspeccionar</div>
      <div class="form-grid">
        <div class="form-group"><label>Marca *</label><input type="text" id="pcMarca" value="${pc?.marca||''}" placeholder="Toyota"></div>
        <div class="form-group"><label>Modelo *</label><input type="text" id="pcModelo" value="${pc?.modelo||''}" placeholder="Corolla"></div>
        <div class="form-group"><label>Año</label><input type="number" id="pcAnio" value="${pc?.anio||''}" placeholder="2015"></div>
        <div class="form-group"><label>Patente</label><input type="text" id="pcPatente" value="${pc?.patente||''}" placeholder="ABCD12" oninput="this.value=this.value.toUpperCase()"></div>
        <div class="form-group"><label>Kilometraje actual</label><input type="number" id="pcKm" value="${pc?.km_actual||''}" placeholder="120000"></div>
        <div class="form-group"><label>Precio venta ($)</label><input type="number" id="pcPrecio" value="${pc?.precio_venta||''}" placeholder="5000000"></div>
        <div class="form-group"><label>Color</label><input type="text" id="pcColor" value="${pc?.color||''}" placeholder="Blanco"></div>
        <div class="form-group"><label>VIN / N° chasis</label><input type="text" id="pcVIN" value="${pc?.vin||''}" placeholder="JT..."></div>
        <div class="form-group"><label>Técnico responsable</label><input type="text" id="pcTecnico" value="${pc?.tecnico_nombre||''}" placeholder="Nombre del técnico"></div>
        <div class="form-group"><label>Fecha inspección</label><input type="date" id="pcFecha" value="${pc?.fecha||new Date().toISOString().split('T')[0]}"></div>
      </div>
    </div>

    <!-- Checklist por sección -->
    <div class="card mb-16" style="background:var(--color-background-secondary)">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="card-title" style="margin-bottom:0">Inspección técnica</div>
        <div id="pcResumen" style="font-size:12px;color:var(--text-sec)"></div>
      </div>
    </div>

    ${Object.entries(secciones).map(([seccion, items]) => `
      <div class="card mb-16">
        <div class="card-title">${seccion}</div>
        ${items.map(it => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--color-border-tertiary)">
            <span style="flex:1;font-size:13px">${it.descripcion}</span>
            <div style="display:flex;gap:4px">
              ${['bueno','regular','malo','no_aplica'].map(cal => {
                const s = SEMAFORO[cal];
                const active = it.calificacion === cal;
                return `<button onclick="setPCCal(${it._idx},'${cal}')"
                  style="padding:3px 8px;border-radius:99px;font-size:11px;font-weight:500;cursor:pointer;border:1.5px solid ${active?s.color:s.bg};background:${active?s.bg:'transparent'};color:${s.color};transition:all .12s"
                  id="pc-cal-${it._idx}-${cal}">${s.label}</button>`;
              }).join('')}
            </div>
            <input type="text" value="${it.observacion||''}" placeholder="Obs..."
              style="width:140px;font-size:11px"
              onchange="updatePCObs(${it._idx}, this.value)">
          </div>
        `).join('')}
      </div>
    `).join('')}

    <!-- Conclusión y resultado -->
    <div class="card mb-16">
      <div class="card-title">Conclusión y recomendación</div>
      <div class="form-group full" style="margin-bottom:14px">
        <label>Conclusión técnica</label>
        <textarea id="pcConclusion" rows="4" placeholder="Resumen técnico de la inspección. Principales hallazgos, sistemas en mal estado, riesgos...">${pc?.conclusion||''}</textarea>
      </div>
      <div class="form-group">
        <label>Recomendación final</label>
        <div style="display:flex;gap:8px;margin-top:4px">
          ${['comprar','evaluar','no_comprar'].map(r => {
            const s = RECOMENDACION[r];
            const active = (pc?.recomendacion||'evaluar') === r;
            return `<button onclick="setPCRecom('${r}')"
              style="flex:1;padding:10px;border-radius:var(--border-radius-md);font-size:12px;font-weight:500;cursor:pointer;border:2px solid ${active?s.color:s.bg};background:${active?s.bg:'transparent'};color:${s.color};transition:all .12s"
              id="pc-recom-${r}">${s.label}</button>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  window._pcRecomendacion = pc?.recomendacion || 'evaluar';
  actualizarResumenPC();
}

function setPCCal(idx, cal) {
  _precompraItems[idx].calificacion = cal;
  ['bueno','regular','malo','no_aplica'].forEach(c => {
    const btn = document.getElementById(`pc-cal-${idx}-${c}`);
    if (!btn) return;
    const s = SEMAFORO[c];
    const active = c === cal;
    btn.style.border = `1.5px solid ${active ? s.color : s.bg}`;
    btn.style.background = active ? s.bg : 'transparent';
  });
  actualizarResumenPC();
}

function updatePCObs(idx, val) {
  _precompraItems[idx].observacion = val;
}

function setPCRecom(r) {
  window._pcRecomendacion = r;
  ['comprar','evaluar','no_comprar'].forEach(rv => {
    const btn = document.getElementById(`pc-recom-${rv}`);
    if (!btn) return;
    const s = RECOMENDACION[rv];
    const active = rv === r;
    btn.style.border = `2px solid ${active ? s.color : s.bg}`;
    btn.style.background = active ? s.bg : 'transparent';
  });
}

function actualizarResumenPC() {
  const div = document.getElementById('pcResumen');
  if (!div) return;
  const b = _precompraItems.filter(i => i.calificacion === 'bueno').length;
  const r = _precompraItems.filter(i => i.calificacion === 'regular').length;
  const m = _precompraItems.filter(i => i.calificacion === 'malo').length;
  div.innerHTML = `<span style="color:#0F6E56;font-weight:500">✓ Bueno: ${b}</span> &nbsp;
                   <span style="color:#854F0B;font-weight:500">~ Regular: ${r}</span> &nbsp;
                   <span style="color:#A32D2D;font-weight:500">✗ Malo: ${m}</span>`;
}

async function guardarPrecompra() {
  const btn = document.getElementById('btnGuardarPC');
  ui.loading(btn, true);
  try {
    const payload = {
      cliente_nombre: document.getElementById('pcCliNombre').value.trim(),
      cliente_tel:    document.getElementById('pcCliTel').value.trim() || null,
      cliente_email:  document.getElementById('pcCliEmail').value.trim() || null,
      marca:          document.getElementById('pcMarca').value.trim(),
      modelo:         document.getElementById('pcModelo').value.trim(),
      anio:           parseInt(document.getElementById('pcAnio').value) || null,
      patente:        document.getElementById('pcPatente').value.trim().toUpperCase() || null,
      km_actual:      parseInt(document.getElementById('pcKm').value) || null,
      precio_venta:   parseInt(document.getElementById('pcPrecio').value) || null,
      color:          document.getElementById('pcColor').value.trim() || null,
      vin:            document.getElementById('pcVIN').value.trim() || null,
      tecnico_nombre: document.getElementById('pcTecnico').value.trim() || null,
      fecha:          document.getElementById('pcFecha').value,
      conclusion:     document.getElementById('pcConclusion').value.trim() || null,
      recomendacion:  window._pcRecomendacion || 'evaluar',
      items:          _precompraItems,
    };

    if (!payload.cliente_nombre || !payload.marca || !payload.modelo) {
      ui.toast('Completa cliente, marca y modelo', 'warning');
      ui.loading(btn, false);
      return;
    }

    if (_precompraId) {
      await PrecompraAPI.actualizar(_precompraId, payload);
      ui.toast('Precompra actualizada');
    } else {
      const pc = await PrecompraAPI.crear(payload);
      _precompraId = pc.id;
      ui.toast(`Precompra ${pc.numero} creada`);
    }
  } catch(e) { ui.toast(e.message, 'error'); }
  ui.loading(btn, false);
}

async function descargarPrecompraPDF(id, marca, modelo) {
  try {
    ui.toast('Generando PDF…');
    await PrecompraAPI.descargarPDF(id, marca, modelo);
  } catch(e) { ui.toast(e.message, 'error'); }
}

// Helpers globales para llamar desde pages.js
window.renderRecepcionOT   = renderRecepcionOT;
window.renderPrecompras    = renderPrecompras;
window.abrirNuevaPrecompra = abrirNuevaPrecompra;
window.abrirPrecompra      = abrirPrecompra;
window.guardarPrecompra    = guardarPrecompra;
window.descargarPrecompraPDF = descargarPrecompraPDF;
window.guardarRecepcion    = guardarRecepcion;
window.setEstadoItem       = setEstadoItem;
window.updateItemObs       = updateItemObs;
window.setPCCal            = setPCCal;
window.updatePCObs         = updatePCObs;
window.setPCRecom          = setPCRecom;
