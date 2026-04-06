/**
 * pages.js — Lógica de todas las vistas conectadas al backend TallerPro
 */

// ── Estado global ─────────────────────────────────────────────────────────────
let currentPage   = "dashboard";
let currentOTId   = null;
let otFiltroEstado= "todas";
let agendaMes     = new Date().getMonth();
let agendaAnio    = new Date().getFullYear();

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!API.Auth.isLogged()) { window.location.href = "/login.html"; return; }
  const user = API.Auth.getUser();
  if (user) {
    document.getElementById("userName").textContent = user.nombre.split(" ")[0];
    document.getElementById("userAvatar").textContent = user.nombre[0].toUpperCase();
  }
  document.getElementById("app").style.display = "";
  await navTo("dashboard");
});

// ── Navegación ────────────────────────────────────────────────────────────────
async function navTo(page) {
  currentPage = page;
  document.querySelectorAll(".nav-item").forEach(el => {
    el.classList.toggle("active", el.dataset.page === page);
  });
  const content = document.getElementById("mainContent");
  content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-ter)"><div class="spinner spinner-dark"></div></div>';
  try {
    switch (page) {
      case "dashboard":    await renderDashboard(); break;
      case "ots":          await renderOTs(); break;
      case "ot-detalle":   await renderOTDetalle(currentOTId); break;
      case "clientes":     await renderClientes(); break;
      case "vehiculos":    await renderVehiculos(); break;
      case "historial":    await renderHistorial(); break;
      case "cotizaciones": await renderCotizaciones(); break;
      case "agenda":       await renderAgenda(); break;
      case "ia":           renderIA(); break;
      case "precompras":   await renderPrecompras(); break;
      default:             content.innerHTML = "<p>Página no encontrada</p>";
    }
  } catch (e) {
    content.innerHTML = `<div class="card"><p style="color:var(--red)">Error al cargar: ${e.message}</p></div>`;
  }
}

function doLogout() {
  API.Auth.logout();
  window.location.href = "/login.html";
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const d = await API.DashboardAPI.stats();
  const k = d.kpis;
  document.getElementById("navBadgeOT").textContent = k.ot_abiertas;

  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-subtitle">${new Date().toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="openModalOT()">+ Nueva OT</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">OT abiertas</div><div class="stat-value stat-blue">${k.ot_abiertas}</div><div class="stat-sub">en proceso</div></div>
      <div class="stat-card"><div class="stat-label">Pendiente aprobación</div><div class="stat-value stat-amber">${k.ot_cotizadas}</div><div class="stat-sub">cotizaciones</div></div>
      <div class="stat-card"><div class="stat-label">Listos para entregar</div><div class="stat-value stat-green">${k.ot_terminadas}</div><div class="stat-sub">vehículos</div></div>
      <div class="stat-card"><div class="stat-label">Clientes</div><div class="stat-value">${k.total_clientes}</div><div class="stat-sub">registrados</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card">
        <div class="card-title">OT recientes</div>
        <div class="table-wrap" style="border:none;box-shadow:none">
          <table><thead><tr><th>OT</th><th>Patente</th><th>Cliente</th><th>Estado</th></tr></thead>
          <tbody>
            ${d.ot_recientes.map(o => `
              <tr class="clickable" onclick="abrirOT(${o.id})">
                <td class="mono">${o.numero}</td>
                <td class="mono fw-600">${o.patente}</td>
                <td class="truncate" style="max-width:120px">${o.cliente_nombre||"—"}</td>
                <td>${ui.badge(o.estado)}</td>
              </tr>`).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--text-ter)">Sin OT registradas</td></tr>`}
          </tbody></table>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-title">Vehículos en taller</div>
          ${d.vehiculos_activos.length === 0
            ? `<div class="empty-state" style="padding:16px"><div class="empty-icon">🔧</div>Sin vehículos activos</div>`
            : d.vehiculos_activos.map(o => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="abrirOT(${o.id})">
                <div><div class="mono fw-600">${o.patente}</div><div class="text-sm text-sec">${o.cliente_nombre||"—"}</div></div>
                ${ui.badge(o.estado)}
              </div>`).join("")}
        </div>
        <div class="card">
          <div class="card-title">Próximos recordatorios</div>
          ${d.proximos_eventos.length === 0
            ? `<div class="empty-state" style="padding:16px"><div class="empty-icon">📅</div>Sin eventos próximos</div>`
            : d.proximos_eventos.map(e => `
              <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
                <div style="text-align:center;min-width:36px">
                  <div style="font-size:18px;font-weight:600;color:var(--green)">${new Date(e.fecha+"T00:00:00").getDate()}</div>
                  <div class="text-sm text-ter">${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][new Date(e.fecha+"T00:00:00").getMonth()]}</div>
                </div>
                <div><div style="font-size:13px;font-weight:500">${e.titulo}</div>${e.hora?`<div class="text-sm text-ter">${e.hora}</div>`:""}</div>
              </div>`).join("")}
        </div>
      </div>
    </div>`;
}

// ── ÓRDENES DE TRABAJO ─────────────────────────────────────────────────────────
async function renderOTs() {
  const params = otFiltroEstado !== "todas" ? { estado: otFiltroEstado } : {};
  const data = await API.OrdenesAPI.listar(params);
  const ots  = data.items || [];

  const estados = ["todas","recibido","diagnosticando","cotizado","aprobado","reparando","terminado","entregado"];
  const filtros = estados.map(e => `
    <button class="status-btn${otFiltroEstado===e?" active":""}" onclick="setOTFiltro('${e}')">${e==="todas"?"Todas":e}</button>
  `).join("");

  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Órdenes de trabajo</div><div class="page-subtitle">${data.total} registros</div></div>
      <button class="btn btn-primary" onclick="openModalOT()">+ Nueva OT</button>
    </div>
    <div class="status-flow mb-16">${filtros}</div>
    <div class="table-wrap">
      <table><thead><tr><th>N° OT</th><th>Fecha</th><th>Patente</th><th>Cliente</th><th>Trabajo</th><th>Técnico</th><th>Estado</th><th></th></tr></thead>
      <tbody>${ots.map(o => `
        <tr>
          <td><span class="mono fw-600" style="cursor:pointer;color:var(--green)" onclick="abrirOT(${o.id})">${o.numero}</span></td>
          <td class="text-sm text-sec">${ui.fmtFecha(o.fecha_ingreso)}</td>
          <td class="mono fw-600">${o.patente}</td>
          <td>${o.cliente_nombre||"—"}</td>
          <td class="truncate" style="max-width:180px">${o.trabajo_solicitado}</td>
          <td class="text-sm text-sec">${o.tecnico_nombre||"—"}</td>
          <td>${ui.badge(o.estado)}</td>
          <td><button class="btn btn-sm" onclick="abrirOT(${o.id})">Ver</button></td>
        </tr>`).join("") || `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🔧</div><div class="empty-title">Sin órdenes de trabajo</div><div class="empty-sub"><a onclick="openModalOT()">Crear la primera OT</a></div></div></td></tr>`}
      </tbody></table>
    </div>`;
}

async function setOTFiltro(estado) {
  otFiltroEstado = estado;
  await renderOTs();
}

// ── OT DETALLE ────────────────────────────────────────────────────────────────
async function abrirOT(id) {
  currentOTId = id;
  await navTo("ot-detalle");
}

async function renderOTDetalle(id) {
  const ot = await API.OrdenesAPI.obtener(id);

  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-sm btn-ghost" onclick="navTo('ots')">← Volver</button>
        <button class="btn btn-sm" onclick="renderRecepcionOT(${ot.id})">📋 Recepción</button>
        <button class="btn btn-sm" onclick="renderRecepcionOT(${ot.id})">📋 Recepción</button>
        <div>
          <div class="page-title">${ot.numero} — ${ot.patente}</div>
          <div class="page-subtitle">${ot.cliente_nombre||""} · ${ot.vehiculo_desc||""}</div>
        </div>
      </div>
      <div class="page-actions">
        ${ot.items && ot.items.length > 0
          ? `<button class="btn" onclick="descargarPDF(${ot.id},'${ot.patente}')">↓ Cotización PDF</button>` : ""}
        <button class="btn btn-primary" id="btnGuardarOT" onclick="guardarOT()">Guardar cambios</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="detail-block"><div class="detail-label">Cliente</div><div class="detail-value">${ot.cliente_nombre||"—"}</div></div>
      <div class="detail-block"><div class="detail-label">Vehículo</div><div class="detail-value mono">${ot.patente}</div></div>
      <div class="detail-block"><div class="detail-label">Km ingreso</div><div class="detail-value mono">${ot.km_ingreso ? ot.km_ingreso.toLocaleString("es-CL") : "—"}</div></div>
      <div class="detail-block"><div class="detail-label">Técnico</div><div class="detail-value">${ot.tecnico_nombre||"—"}</div></div>
    </div>

    <div class="tabs">
      <div class="tab active" onclick="switchTab('tab-diag',this)">Diagnóstico</div>
      <div class="tab" onclick="switchTab('tab-cot',this)">Cotización</div>
      <div class="tab" onclick="switchTab('tab-fotos',this)">Fotos</div>
      <div class="tab" onclick="switchTab('tab-estado',this)">Estado</div>
    </div>

    <!-- TAB DIAGNÓSTICO -->
    <div id="tab-diag">
      <div class="card mb-16">
        <div class="card-title">Falla reportada por el cliente</div>
        <textarea id="otFallaCliente" rows="2" placeholder="Descripción de la falla según el cliente…">${ot.falla_cliente||""}</textarea>
      </div>
      <div class="card">
        <div class="card-title">Diagnóstico técnico</div>
        <div class="form-grid">
          <div class="form-group full">
            <label>Observaciones técnicas</label>
            <textarea id="otObsTec" rows="4" placeholder="Inspección visual, pruebas, hallazgos…">${ot.obs_tecnica||""}</textarea>
          </div>
          <div class="form-group">
            <label>Códigos DTC (separados por coma)</label>
            <input type="text" id="otDTC" value="${ot.dtc_codes||""}" placeholder="P0301, P0171…" class="mono">
          </div>
          <div class="form-group">
            <label>Sistema afectado</label>
            <select id="otSistema">
              ${["","Motor","Transmisión","Frenos","Suspensión","Eléctrico","Dirección","Refrigeración","Combustible","Climatización","Otro"]
                .map(s=>`<option${ot.sistema_afectado===s?" selected":""}>${s}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="ai-panel mt-16">
          <div class="ai-header"><div class="ai-dot"></div><span class="ai-title">Apoyo diagnóstico IA</span></div>
          <div class="ai-output" id="aiDiagOut"><span class="ai-loading">Ingresa observaciones y/o DTC, luego presiona Analizar</span></div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-sm btn-primary" onclick="analizarIA()">✦ Analizar con IA</button>
            <button class="btn btn-sm" onclick="resumirWhatsApp()">📱 Resumen WhatsApp</button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB COTIZACIÓN -->
    <div id="tab-cot" class="hidden">
      <div class="card">
        <div class="card-title">Agregar ítem</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          <select id="itemTipo" style="width:130px"><option value="repuesto">Repuesto</option><option value="mano_obra">Mano de obra</option></select>
          <input type="text" id="itemDesc" placeholder="Descripción" style="flex:1;min-width:160px">
          <input type="text" id="itemCodigo" placeholder="Código parte" style="width:110px">
          <input type="number" id="itemQty" placeholder="Cant." style="width:70px" value="1">
          <input type="number" id="itemPrecio" placeholder="Precio unit." style="width:120px">
          <button class="btn btn-primary btn-sm" onclick="agregarItem()">Agregar</button>
        </div>
        <div id="itemsList"></div>
        <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px" id="totalesSection"></div>
        ${ot.items && ot.items.length > 0
          ? `<div style="margin-top:14px"><button class="btn btn-sm" onclick="descargarPDF(${ot.id},'${ot.patente}')">↓ Descargar cotización PDF</button></div>` : ""}
      </div>
    </div>

    <!-- TAB FOTOS -->
    <div id="tab-fotos" class="hidden">
      <div class="card">
        <div class="card-title">Registro fotográfico</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <select id="fotoEtapa" style="width:130px"><option value="ingreso">Ingreso</option><option value="proceso">En proceso</option><option value="entrega">Entrega</option></select>
          <input type="text" id="fotoDesc" placeholder="Descripción de la foto (opcional)" style="flex:1">
        </div>
        <div class="photos-grid" id="fotosGrid"></div>
        <input type="file" id="fotoInput" accept="image/*" multiple style="display:none" onchange="subirFotos(this)">
      </div>
    </div>

    <!-- TAB ESTADO -->
    <div id="tab-estado" class="hidden">
      <div class="card mb-16">
        <div class="card-title">Cambiar estado</div>
        <div class="status-flow mb-12" id="statusFlow"></div>
        <div id="historialEstados"></div>
      </div>
      <div class="card">
        <div class="card-title">Notas de entrega / pendientes</div>
        <textarea id="otNotasEntrega" rows="3" placeholder="Qué quedó pendiente, recomendaciones para próxima visita…">${ot.notas_entrega||""}</textarea>
      </div>
    </div>`;

  // Renderizar ítems, fotos y estado
  renderItems(ot.items || []);
  renderFotos(ot.fotos || []);
  renderStatusFlow(ot.estado, ot.historial_estados || []);
}

function switchTab(tabId, el) {
  ["tab-diag","tab-cot","tab-fotos","tab-estado"].forEach(t => {
    document.getElementById(t)?.classList.toggle("hidden", t !== tabId);
  });
  document.querySelectorAll(".tabs .tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
}

async function guardarOT() {
  const btn = document.getElementById("btnGuardarOT");
  ui.loading(btn, true);
  try {
    await API.OrdenesAPI.actualizar(currentOTId, {
      falla_cliente: document.getElementById("otFallaCliente")?.value,
      obs_tecnica:   document.getElementById("otObsTec")?.value,
      dtc_codes:     document.getElementById("otDTC")?.value,
      sistema_afectado: document.getElementById("otSistema")?.value,
      notas_entrega: document.getElementById("otNotasEntrega")?.value,
    });
    ui.toast("Cambios guardados");
  } catch (e) { ui.toast(e.message, "error"); }
  ui.loading(btn, false);
}

async function cambiarEstado(estado) {
  try {
    await API.OrdenesAPI.cambiarEstado(currentOTId, estado);
    const ot = await API.OrdenesAPI.obtener(currentOTId);
    renderStatusFlow(ot.estado, ot.historial_estados || []);
    ui.toast(`Estado: ${estado}`);
  } catch (e) { ui.toast(e.message, "error"); }
}

function renderStatusFlow(estadoActual, historial) {
  const estados = ["recibido","diagnosticando","cotizado","aprobado","reparando","terminado","entregado"];
  const flow = document.getElementById("statusFlow");
  if (flow) {
    flow.innerHTML = estados.map(e =>
      `<button class="status-btn${estadoActual===e?" active":""}" onclick="cambiarEstado('${e}')">${e}</button>`
    ).join("");
  }
  const hEl = document.getElementById("historialEstados");
  if (hEl && historial.length) {
    hEl.innerHTML = `<div style="margin-top:12px;font-size:12px;color:var(--text-sec)">` +
      [...historial].reverse().slice(0,8).map(h =>
        `${ui.badge(h.estado)} <span style="color:var(--text-ter)">${new Date(h.fecha).toLocaleString("es-CL")}</span>`
      ).join(" ← ") + `</div>`;
  }
}

// ── ITEMS (cotización) ────────────────────────────────────────────────────────
async function agregarItem() {
  const desc   = document.getElementById("itemDesc").value.trim();
  const tipo   = document.getElementById("itemTipo").value;
  const qty    = parseFloat(document.getElementById("itemQty").value) || 1;
  const precio = parseFloat(document.getElementById("itemPrecio").value);
  const codigo = document.getElementById("itemCodigo").value.trim();

  if (!desc || !precio) { ui.toast("Completa descripción y precio", "warning"); return; }
  try {
    await API.OrdenesAPI.agregarItem(currentOTId, { tipo, descripcion: desc, cantidad: qty, precio_unitario: precio, codigo_parte: codigo || null });
    const ot = await API.OrdenesAPI.obtener(currentOTId);
    renderItems(ot.items || []);
    document.getElementById("itemDesc").value = "";
    document.getElementById("itemPrecio").value = "";
    document.getElementById("itemCodigo").value = "";
    document.getElementById("itemQty").value = "1";
    ui.toast("Ítem agregado");
  } catch (e) { ui.toast(e.message, "error"); }
}

async function eliminarItem(itemId) {
  if (!confirm("¿Eliminar este ítem?")) return;
  try {
    await API.OrdenesAPI.eliminarItem(currentOTId, itemId);
    const ot = await API.OrdenesAPI.obtener(currentOTId);
    renderItems(ot.items || []);
    ui.toast("Ítem eliminado");
  } catch (e) { ui.toast(e.message, "error"); }
}

function renderItems(items) {
  const el = document.getElementById("itemsList");
  if (!el) return;
  const repuestos = items.filter(i => i.tipo === "repuesto");
  const mo        = items.filter(i => i.tipo === "mano_obra");
  const totalRep  = repuestos.reduce((s,i) => s + i.subtotal, 0);
  const totalMO   = mo.reduce((s,i) => s + i.subtotal, 0);
  const total     = totalRep + totalMO;

  el.innerHTML = items.length === 0
    ? `<div style="color:var(--text-ter);font-size:13px;padding:8px 0">Sin ítems. Agrega repuestos o mano de obra.</div>`
    : items.map(i => `
      <div class="item-row">
        <span class="item-tag ${i.tipo==="repuesto"?"item-tag-rep":"item-tag-mo"}">${i.tipo==="repuesto"?"REP":"M/O"}</span>
        <span class="item-desc">${i.descripcion}${i.codigo_parte?` <span class="text-mono text-ter">${i.codigo_parte}</span>`:""}</span>
        <span class="item-qty">${i.cantidad}</span>
        <span class="item-price">${ui.fmtCLP(i.subtotal)}</span>
        <span class="item-del" onclick="eliminarItem(${i.id})" title="Eliminar">×</span>
      </div>`).join("");

  const tot = document.getElementById("totalesSection");
  if (tot && items.length > 0) {
    tot.innerHTML = `
      ${repuestos.length && mo.length ? `
        <div class="total-row"><span>Subtotal repuestos</span><span class="mono">${ui.fmtCLP(totalRep)}</span></div>
        <div class="total-row"><span>Subtotal mano de obra</span><span class="mono">${ui.fmtCLP(totalMO)}</span></div>
      `:""}<div class="total-row final"><span>Total cotización</span><span>${ui.fmtCLP(total)}</span></div>`;
  }
}

// ── FOTOS ─────────────────────────────────────────────────────────────────────
async function subirFotos(input) {
  const etapa = document.getElementById("fotoEtapa")?.value || "ingreso";
  const desc  = document.getElementById("fotoDesc")?.value || "";
  for (const file of input.files) {
    const fd = new FormData();
    fd.append("foto", file);
    fd.append("etapa", etapa);
    if (desc) fd.append("descripcion", desc);
    try {
      await API.OrdenesAPI.subirFoto(currentOTId, fd);
    } catch (e) { ui.toast(`Error subiendo ${file.name}: ${e.message}`, "error"); }
  }
  input.value = "";
  const ot = await API.OrdenesAPI.obtener(currentOTId);
  renderFotos(ot.fotos || []);
  ui.toast("Foto(s) subida(s)");
}

async function eliminarFoto(fotoId) {
  if (!confirm("¿Eliminar esta foto?")) return;
  try {
    await API.OrdenesAPI.eliminarFoto(currentOTId, fotoId);
    const ot = await API.OrdenesAPI.obtener(currentOTId);
    renderFotos(ot.fotos || []);
  } catch (e) { ui.toast(e.message, "error"); }
}

function renderFotos(fotos) {
  const grid = document.getElementById("fotosGrid");
  if (!grid) return;
  const fotoUrl = url => url.startsWith("http") ? url : `http://localhost:5000${url}`;
  grid.innerHTML = fotos.map(f => `
    <div class="photo-thumb">
      <img src="${fotoUrl(f.url)}" alt="${f.descripcion||f.etapa}" loading="lazy">
      <button class="photo-del" onclick="eliminarFoto(${f.id})">×</button>
    </div>`).join("") + `
    <div class="photo-add" onclick="document.getElementById('fotoInput').click()">
      <span class="photo-add-icon">+</span><span>Agregar foto</span>
    </div>`;
}

// ── PDF ───────────────────────────────────────────────────────────────────────
async function descargarPDF(ordenId, patente) {
  try {
    ui.toast("Generando PDF…");
    await API.OrdenesAPI.descargarPDF(ordenId, patente);
  } catch (e) { ui.toast(e.message, "error"); }
}

// ── IA ────────────────────────────────────────────────────────────────────────
async function analizarIA() {
  const out = document.getElementById("aiDiagOut");
  out.innerHTML = '<span class="ai-loading">Analizando diagnóstico…</span>';
  try {
    const res = await API.IAAPI.diagnostico({
      orden_id: currentOTId,
      falla_cliente: document.getElementById("otFallaCliente")?.value,
      obs_tecnica:   document.getElementById("otObsTec")?.value,
      dtc_codes:     document.getElementById("otDTC")?.value,
      sistema_afectado: document.getElementById("otSistema")?.value,
    });
    out.textContent = res.diagnostico;
  } catch (e) { out.innerHTML = `<span style="color:var(--red)">${e.message}</span>`; }
}

async function resumirWhatsApp() {
  const out = document.getElementById("aiDiagOut");
  out.innerHTML = '<span class="ai-loading">Generando resumen…</span>';
  try {
    const res = await API.IAAPI.resumenWhatsApp(currentOTId);
    out.innerHTML = `<strong style="font-size:11px;color:#3C3489">Resumen para WhatsApp:</strong>\n\n${res.mensaje}`;
  } catch (e) { out.innerHTML = `<span style="color:var(--red)">${e.message}</span>`; }
}

// ── CLIENTES ──────────────────────────────────────────────────────────────────
async function renderClientes(q = "") {
  const clientes = await API.ClientesAPI.listar(q);
  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Clientes</div><div class="page-subtitle">${clientes.length} registrados</div></div>
      <button class="btn btn-primary" onclick="openModalCliente()">+ Nuevo cliente</button>
    </div>
    <div style="margin-bottom:14px">
      <input type="text" placeholder="Buscar por nombre, RUT, teléfono…" style="width:320px"
        oninput="renderClientes(this.value)" value="${q}">
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Nombre</th><th>RUT</th><th>Teléfono</th><th>Email</th><th>Vehículos</th><th>OT</th><th></th></tr></thead>
      <tbody>${clientes.map(c => `
        <tr>
          <td><strong>${c.nombre}</strong></td>
          <td class="mono text-sec">${c.rut||"—"}</td>
          <td>${c.telefono}</td>
          <td class="text-sm text-sec">${c.email||"—"}</td>
          <td style="text-align:center">${c.total_vehiculos??0}</td>
          <td style="text-align:center">${c.total_ordenes??0}</td>
          <td><button class="btn btn-sm btn-danger" onclick="eliminarCliente(${c.id})">Eliminar</button></td>
        </tr>`).join("") || `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">Sin clientes</div></div></td></tr>`}
      </tbody></table>
    </div>`;
}

async function crearCliente() {
  const btn = document.getElementById("btnCrearCli");
  ui.loading(btn, true);
  try {
    await API.ClientesAPI.crear({
      nombre:       document.getElementById("cNombre").value.trim(),
      rut:          document.getElementById("cRut").value.trim() || null,
      telefono:     document.getElementById("cTel").value.trim(),
      email:        document.getElementById("cEmail").value.trim() || null,
      direccion:    document.getElementById("cDir").value.trim() || null,
      observaciones:document.getElementById("cObs").value.trim() || null,
    });
    closeModal("modalCliente");
    ui.toast("Cliente creado");
    await renderClientes();
  } catch (e) { ui.toast(e.message, "error"); }
  ui.loading(btn, false);
}

async function eliminarCliente(id) {
  if (!confirm("¿Eliminar este cliente?")) return;
  try { await API.ClientesAPI.eliminar(id); ui.toast("Cliente eliminado"); await renderClientes(); }
  catch (e) { ui.toast(e.message, "error"); }
}

// ── VEHÍCULOS ─────────────────────────────────────────────────────────────────
async function renderVehiculos() {
  const vehiculos = await API.VehiculosAPI.listar();
  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Vehículos</div><div class="page-subtitle">${vehiculos.length} registrados</div></div>
      <button class="btn btn-primary" onclick="openModalVehiculo()">+ Nuevo vehículo</button>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Patente</th><th>Marca</th><th>Modelo</th><th>Año</th><th>Motor</th><th>Cliente</th><th>OT historial</th><th></th></tr></thead>
      <tbody>${vehiculos.map(v => `
        <tr>
          <td><span class="mono fw-600" style="color:var(--green)">${v.patente}</span></td>
          <td>${v.marca}</td>
          <td>${v.modelo}</td>
          <td class="mono">${v.anio||"—"}</td>
          <td class="text-sm text-sec">${v.motor||"—"}</td>
          <td>${v.cliente_nombre||"—"}</td>
          <td style="text-align:center">${v.total_ordenes??0} OT</td>
          <td><button class="btn btn-sm btn-danger" onclick="eliminarVehiculo(${v.id})">Eliminar</button></td>
        </tr>`).join("") || `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🚗</div><div class="empty-title">Sin vehículos</div></div></td></tr>`}
      </tbody></table>
    </div>`;
}

async function crearVehiculo() {
  const btn = document.getElementById("btnCrearVeh");
  ui.loading(btn, true);
  try {
    await API.VehiculosAPI.crear({
      patente:     document.getElementById("vPat").value.trim().toUpperCase(),
      cliente_id:  parseInt(document.getElementById("vCliSel").value),
      marca:       document.getElementById("vMarca").value.trim(),
      modelo:      document.getElementById("vModelo").value.trim(),
      anio:        parseInt(document.getElementById("vAnio").value) || null,
      color:       document.getElementById("vColor").value.trim() || null,
      motor:       document.getElementById("vMotor").value.trim() || null,
      combustible: document.getElementById("vCombustible").value || null,
      transmision: document.getElementById("vTrans").value || null,
      vin:         document.getElementById("vVIN").value.trim() || null,
      observaciones:document.getElementById("vObs").value.trim() || null,
    });
    closeModal("modalVehiculo");
    ui.toast("Vehículo creado");
    await renderVehiculos();
  } catch (e) { ui.toast(e.message, "error"); }
  ui.loading(btn, false);
}

async function eliminarVehiculo(id) {
  if (!confirm("¿Eliminar este vehículo?")) return;
  try { await API.VehiculosAPI.eliminar(id); ui.toast("Vehículo eliminado"); await renderVehiculos(); }
  catch (e) { ui.toast(e.message, "error"); }
}

// ── HISTORIAL ─────────────────────────────────────────────────────────────────
async function renderHistorial(q = "") {
  const params = q ? { q } : {};
  if (q && q.length <= 6) params.patente = q.toUpperCase();

  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Historial técnico</div></div>
    </div>
    <div style="margin-bottom:16px">
      <input type="text" id="histQ" placeholder="Buscar por patente o nombre de cliente…" style="width:320px"
        value="${q}" oninput="renderHistorial(this.value)">
    </div>
    <div id="histContent"><div style="text-align:center;padding:40px;color:var(--text-ter)"><div class="spinner spinner-dark"></div></div></div>`;

  try {
    // Buscar vehículos que coincidan
    const vehiculos = await API.VehiculosAPI.listar(q ? { q } : {});
    const hEl = document.getElementById("histContent");

    if (vehiculos.length === 0) {
      hEl.innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div><div class="empty-title">Sin resultados</div></div>`;
      return;
    }

    const cards = await Promise.all(vehiculos.slice(0, 20).map(async v => {
      const vd = await API.VehiculosAPI.obtener(v.id);
      if (!vd.historial || vd.historial.length === 0) return "";
      return `<div class="card mb-16">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div>
            <span class="mono fw-600" style="font-size:16px;color:var(--green)">${v.patente}</span>
            <span class="text-sec" style="margin-left:8px">${v.marca} ${v.modelo} ${v.anio||""}</span>
          </div>
          <span class="text-sec text-sm">👤 ${v.cliente_nombre||"—"}</span>
        </div>
        ${vd.historial.map(o => `
          <div class="historial-item">
            <div class="historial-date">${ui.fmtFecha(o.fecha_ingreso)} — ${o.numero}</div>
            <div class="historial-title">${o.trabajo_solicitado}</div>
            ${o.obs_tecnica ? `<div class="historial-desc">${o.obs_tecnica.substring(0,150)}${o.obs_tecnica.length>150?"…":""}</div>` : ""}
            ${o.dtc_codes ? `<div style="margin-top:4px">${o.dtc_codes.split(",").map(d=>`<span class="dtc-tag">${d.trim()}</span>`).join("")}</div>` : ""}
            <div style="margin-top:6px;display:flex;align-items:center;gap:8px">
              ${ui.badge(o.estado)}
              ${o.total > 0 ? `<span class="text-sm text-sec mono">${ui.fmtCLP(o.total)}</span>` : ""}
              <span style="cursor:pointer;font-size:12px;color:var(--green);margin-left:auto" onclick="abrirOT(${o.id})">Ver OT →</span>
            </div>
          </div>`).join("")}
      </div>`;
    }));
    hEl.innerHTML = cards.join("") || `<div class="empty-state"><div class="empty-icon">◷</div>Sin historial registrado</div>`;
  } catch(e) {
    document.getElementById("histContent").innerHTML = `<p style="color:var(--red)">${e.message}</p>`;
  }
}

// ── COTIZACIONES ──────────────────────────────────────────────────────────────
async function renderCotizaciones() {
  const data = await API.OrdenesAPI.listar({ per_page: 100 });
  const conItems = (data.items || []).filter(o => o.total > 0);

  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Cotizaciones</div><div class="page-subtitle">${conItems.length} con ítems cargados</div></div>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>OT</th><th>Vehículo</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>${conItems.map(o => `
        <tr>
          <td class="mono fw-600">${o.numero}</td>
          <td class="mono">${o.patente}</td>
          <td>${o.cliente_nombre||"—"}</td>
          <td class="mono fw-600" style="color:var(--green)">${ui.fmtCLP(o.total)}</td>
          <td>${ui.badge(o.estado)}</td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-sm" onclick="abrirOT(${o.id})">Ver OT</button>
            <button class="btn btn-sm btn-primary" onclick="descargarPDF(${o.id},'${o.patente}')">↓ PDF</button>
          </td>
        </tr>`).join("") || `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Sin cotizaciones</div><div class="empty-sub">Las OT con ítems cargados aparecen aquí</div></div></td></tr>`}
      </tbody></table>
    </div>`;
}

// ── AGENDA ────────────────────────────────────────────────────────────────────
async function renderAgenda() {
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const eventos = await API.EventosAPI.listar({ mes: agendaMes + 1, anio: agendaAnio });
  const proximos = await API.EventosAPI.listar({ proximos: 10 });

  const eventMap = {};
  eventos.forEach(e => {
    if (!eventMap[e.fecha]) eventMap[e.fecha] = [];
    eventMap[e.fecha].push(e);
  });

  const firstDay = new Date(agendaAnio, agendaMes, 1);
  let dow = firstDay.getDay(); if (dow === 0) dow = 7;
  const daysInMonth = new Date(agendaAnio, agendaMes + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  let cells = "";
  for (let i = 1; i < dow; i++) cells += `<div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${agendaAnio}-${String(agendaMes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const evs = eventMap[ds] || [];
    cells += `<div class="cal-cell${ds===todayStr?" today":""}" onclick="clickDia('${ds}')">
      <div class="cal-date">${d}</div>
      ${evs.map(e=>`<div class="cal-event" title="${e.titulo}">${e.hora?e.hora+" ":""}${e.titulo}</div>`).join("")}
    </div>`;
  }

  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Agenda</div></div>
      <button class="btn btn-primary" onclick="openModalEvento()">+ Nuevo evento</button>
    </div>
    <div class="card mb-16">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <button class="btn btn-sm" onclick="cambiarMes(-1)">←</button>
        <span style="font-weight:600;font-size:15px">${meses[agendaMes]} ${agendaAnio}</span>
        <button class="btn btn-sm" onclick="cambiarMes(1)">→</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px">
        ${["L","M","X","J","V","S","D"].map(d=>`<div style="text-align:center;font-size:11px;color:var(--text-ter);padding:4px">${d}</div>`).join("")}
      </div>
      <div class="cal-grid">${cells}</div>
    </div>
    <div class="card">
      <div class="card-title">Próximos eventos</div>
      <div id="eventosList">
        ${proximos.length === 0
          ? `<div class="empty-state" style="padding:16px"><div class="empty-icon">📅</div>Sin eventos próximos</div>`
          : proximos.map(e => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="text-align:center;min-width:40px">
                <div style="font-size:18px;font-weight:600;color:var(--green)">${new Date(e.fecha+"T00:00:00").getDate()}</div>
                <div class="text-sm text-ter">${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][new Date(e.fecha+"T00:00:00").getMonth()]}</div>
              </div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:500">${e.titulo}</div>
                ${e.descripcion?`<div class="text-sm text-sec">${e.descripcion}</div>`:""}
              </div>
              ${e.hora?`<span class="text-sm text-sec">${e.hora}</span>`:""}
              <button class="btn btn-sm btn-danger" onclick="eliminarEvento(${e.id})">×</button>
            </div>`).join("")}
      </div>
    </div>`;
}

async function cambiarMes(d) {
  agendaMes += d;
  if (agendaMes > 11) { agendaMes = 0; agendaAnio++; }
  if (agendaMes < 0)  { agendaMes = 11; agendaAnio--; }
  await renderAgenda();
}

function clickDia(fecha) {
  document.getElementById("evFecha").value = fecha;
  openModalEvento();
}

async function crearEvento() {
  const btn = document.getElementById("btnCrearEv");
  ui.loading(btn, true);
  try {
    await API.EventosAPI.crear({
      titulo:      document.getElementById("evTitulo").value.trim(),
      fecha:       document.getElementById("evFecha").value,
      hora:        document.getElementById("evHora").value || null,
      tipo:        document.getElementById("evTipo").value,
      descripcion: document.getElementById("evDesc").value.trim() || null,
    });
    closeModal("modalEvento");
    ui.toast("Evento creado");
    await renderAgenda();
  } catch (e) { ui.toast(e.message, "error"); }
  ui.loading(btn, false);
}

async function eliminarEvento(id) {
  try { await API.EventosAPI.eliminar(id); ui.toast("Evento eliminado"); await renderAgenda(); }
  catch (e) { ui.toast(e.message, "error"); }
}

// ── ASISTENTE IA ──────────────────────────────────────────────────────────────
function renderIA() {
  document.getElementById("mainContent").innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Asistente IA</div><div class="page-subtitle">Diagnóstico, tiempos, repuestos y soporte técnico</div></div>
    </div>
    <div class="card mb-16">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
        <button class="btn" onclick="promptIA('¿Cuáles son las causas más comunes del código DTC P0301 en motores de gasolina?')">Consultar DTC</button>
        <button class="btn" onclick="promptIA('Dame un checklist de inspección para un vehículo con ruido en suspensión delantera')">Checklist inspección</button>
        <button class="btn" onclick="promptIA('¿Cuánto tiempo toma un cambio de embrague en un vehículo compacto? ¿Qué repuestos se necesitan?')">Estimar trabajo</button>
        <button class="btn" onclick="promptIA('¿Qué diferencia hay entre una falla intermitente y una falla activa en un DTC?')">Fallas intermitentes</button>
        <button class="btn" onclick="promptIA('Dame los pasos para diagnosticar una batería débil vs un alternador defectuoso')">Sistema eléctrico</button>
        <button class="btn" onclick="promptIA('¿Cuándo debo recomendar un cambio de correa de distribución vs cadena?')">Distribución</button>
      </div>
      <textarea id="iaInput" rows="3" placeholder="Consulta al asistente: DTC, diagnóstico, tiempos de trabajo, repuestos…"></textarea>
      <div style="margin-top:10px">
        <button class="btn btn-primary" id="btnIA" onclick="consultarIA()">✦ Consultar</button>
      </div>
    </div>
    <div class="ai-panel hidden" id="iaPanel">
      <div class="ai-header"><div class="ai-dot"></div><span class="ai-title">Respuesta del asistente</span></div>
      <div class="ai-output" id="iaOutput"></div>
    </div>`;
}

function promptIA(txt) {
  document.getElementById("iaInput").value = txt;
  consultarIA();
}

async function consultarIA() {
  const q   = document.getElementById("iaInput").value.trim();
  const btn = document.getElementById("btnIA");
  if (!q) return;
  document.getElementById("iaPanel").classList.remove("hidden");
  document.getElementById("iaOutput").innerHTML = '<span class="ai-loading">Consultando asistente técnico…</span>';
  ui.loading(btn, true);
  try {
    const res = await API.IAAPI.consulta(q);
    document.getElementById("iaOutput").textContent = res.respuesta;
  } catch (e) {
    document.getElementById("iaOutput").innerHTML = `<span style="color:var(--red)">${e.message}</span>`;
  }
  ui.loading(btn, false);
}

// ── MODALS ────────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id){ document.getElementById(id).classList.add("hidden"); }

async function openModalOT() {
  const clientes = await API.ClientesAPI.listar();
  const sel = document.getElementById("otCliSel");
  sel.innerHTML = `<option value="">Seleccionar cliente…</option>` +
    clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
  document.getElementById("otFecha").value = new Date().toISOString().split("T")[0];
  document.getElementById("otTrabajo").value = "";
  document.getElementById("otKm").value = "";
  document.getElementById("otTecnico").value = "";
  document.getElementById("otVehSel").innerHTML = `<option value="">Primero seleccione cliente</option>`;
  openModal("modalOT");
}

async function loadVehsByCliente() {
  const cid = document.getElementById("otCliSel").value;
  if (!cid) return;
  const vehs = await API.VehiculosAPI.listar({ cliente_id: cid });
  const sel  = document.getElementById("otVehSel");
  sel.innerHTML = vehs.length === 0
    ? `<option value="">Sin vehículos registrados</option>`
    : vehs.map(v => `<option value="${v.id}">${v.patente} — ${v.marca} ${v.modelo}</option>`).join("");
}

async function crearOT() {
  const btn = document.getElementById("btnCrearOT");
  ui.loading(btn, true);
  try {
    const ot = await API.OrdenesAPI.crear({
      cliente_id:        parseInt(document.getElementById("otCliSel").value),
      vehiculo_id:       parseInt(document.getElementById("otVehSel").value),
      trabajo_solicitado:document.getElementById("otTrabajo").value.trim(),
      km_ingreso:        parseInt(document.getElementById("otKm").value) || null,
      tecnico_id:        null,
      fecha_ingreso:     document.getElementById("otFecha").value,
      estado:            document.getElementById("otEstado").value,
    });
    closeModal("modalOT");
    ui.toast(`OT ${ot.numero} creada`);
    await abrirOT(ot.id);
  } catch (e) { ui.toast(e.message, "error"); }
  ui.loading(btn, false);
}

async function openModalCliente() {
  ["cNombre","cRut","cTel","cEmail","cDir","cObs"].forEach(id => { const el = document.getElementById(id); if(el) el.value=""; });
  openModal("modalCliente");
}

async function openModalVehiculo() {
  const clientes = await API.ClientesAPI.listar();
  const sel = document.getElementById("vCliSel");
  sel.innerHTML = `<option value="">Seleccionar…</option>` + clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join("");
  ["vPat","vMarca","vModelo","vAnio","vColor","vMotor","vVIN","vObs"].forEach(id => { const el = document.getElementById(id); if(el) el.value=""; });
  openModal("modalVehiculo");
}

function openModalEvento() {
  if (!document.getElementById("evFecha").value)
    document.getElementById("evFecha").value = new Date().toISOString().split("T")[0];
  document.getElementById("evTitulo").value = "";
  document.getElementById("evDesc").value = "";
  openModal("modalEvento");
}

// ── BÚSQUEDA GLOBAL ───────────────────────────────────────────────────────────
let _searchTimer = null;
async function handleGlobalSearch(q) {
  clearTimeout(_searchTimer);
  if (q.length < 2) { hideSearchDrop(); return; }
  _searchTimer = setTimeout(async () => {
    try {
      const [clientes, vehiculos, ots] = await Promise.all([
        API.ClientesAPI.listar(q),
        API.VehiculosAPI.listar({ q }),
        API.OrdenesAPI.listar({ q }),
      ]);
      const results = [
        ...vehiculos.slice(0,3).map(v => ({ type:"VEH", label:`${v.patente} — ${v.marca} ${v.modelo}`, action: () => { renderHistorial(v.patente); hideSearchDrop(); } })),
        ...clientes.slice(0,3).map(c => ({ type:"CLI", label:c.nombre, action: () => { navTo("clientes"); hideSearchDrop(); } })),
        ...(ots.items||[]).slice(0,3).map(o => ({ type:"OT", label:`${o.numero} · ${o.patente} (${o.estado})`, action: () => { abrirOT(o.id); hideSearchDrop(); } })),
      ];
      const drop = document.getElementById("searchDrop");
      drop.innerHTML = results.length === 0
        ? `<div class="search-result" style="color:var(--text-ter)">Sin resultados</div>`
        : results.map((r,i) => `
            <div class="search-result" onclick="window._sr[${i}].action()">
              <span class="search-result-type">${r.type}</span>
              ${r.label}
            </div>`).join("");
      window._sr = results;
      drop.classList.remove("hidden");
    } catch {}
  }, 300);
}

function showSearchDrop() {
  const q = document.getElementById("globalSearch").value;
  if (q.length >= 2) handleGlobalSearch(q);
}
function hideSearchDrop() {
  document.getElementById("searchDrop")?.classList.add("hidden");
}
