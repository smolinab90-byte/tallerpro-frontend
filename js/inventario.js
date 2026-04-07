/**
 * inventario.js — Módulo de Inventario de Repuestos
 */

// ── API ───────────────────────────────────────────────────────────────────────
const InventarioAPI = {
  listar:    (params={}) => { const qs=new URLSearchParams(params).toString(); return API.apiGet(`/inventario/${qs?`?${qs}`:''}`); },
  alertas:   ()          => API.apiGet('/inventario/alertas'),
  buscar:    (q)         => API.apiGet(`/inventario/buscar?q=${encodeURIComponent(q)}`),
  obtener:   (id)        => API.apiGet(`/inventario/${id}`),
  crear:     (data)      => API.apiPost('/inventario/', data),
  actualizar:(id, data)  => API.apiPut(`/inventario/${id}`, data),
  eliminar:  (id)        => API.apiDelete(`/inventario/${id}`),
  mover:     (id, data)  => API.apiPost(`/inventario/${id}/movimiento`, data),
  historial: (id)        => API.apiGet(`/inventario/${id}/movimientos`),
};
window.API.InventarioAPI = InventarioAPI;

// ── Semáforo de stock ─────────────────────────────────────────────────────────
function stockColor(actual, minimo) {
  const r = actual / (minimo || 1);
  if (r <= 0)   return { bg: '#FCEBEB', color: '#A32D2D', label: 'Sin stock', dot: '🔴' };
  if (r <= 1)   return { bg: '#FAEEDA', color: '#854F0B', label: 'Stock bajo', dot: '🟡' };
  return         { bg: '#E1F5EE', color: '#0F6E56', label: 'OK',         dot: '🟢' };
}

function fmtStock(n, unidad='unidad') {
  return `${parseFloat(n).toLocaleString('es-CL')} ${unidad}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// LISTA DE INVENTARIO
// ══════════════════════════════════════════════════════════════════════════════
let _invFiltro = {};

async function renderInventario() {
  const data = await InventarioAPI.listar(_invFiltro);
  const items = data.items || [];
  const alertas = data.alertas || 0;

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Inventario de repuestos</div>
        <div class="page-subtitle">${data.total} repuestos registrados${alertas > 0 ? ` · <span style="color:#A32D2D;font-weight:500">⚠ ${alertas} bajo mínimo</span>` : ''}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="renderInventarioAlertas()" ${alertas===0?'disabled':''}>
          ⚠ Alertas (${alertas})
        </button>
        <button class="btn btn-primary" onclick="abrirModalRepuesto()">+ Nuevo repuesto</button>
      </div>
    </div>

    <!-- Filtros -->
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <input type="text" id="invBuscar" placeholder="Buscar código, descripción, marca…" style="width:280px"
        value="${_invFiltro.q||''}" oninput="filtrarInv('q',this.value)">
      <select id="invCat" onchange="filtrarInv('categoria',this.value)" style="width:160px">
        <option value="">Todas las categorías</option>
        ${['Motor','Transmisión','Frenos','Suspensión','Eléctrico','Carrocería','Filtros','Lubricantes','Neumáticos','Climatización','Otro']
          .map(c=>`<option value="${c}"${_invFiltro.categoria===c?' selected':''}>${c}</option>`).join('')}
      </select>
      <button class="btn btn-sm ${_invFiltro.alerta==='1'?'btn-primary':''}" onclick="filtrarInv('alerta',_invFiltro.alerta==='1'?'':'1')">
        Solo bajo mínimo
      </button>
    </div>

    <!-- Tabla -->
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Stock</th><th>Código</th><th>Descripción</th><th>Categoría</th>
          <th>Stock actual</th><th>Mínimo</th><th>P. Costo</th><th>P. Venta</th><th>Margen</th><th>Acciones</th>
        </tr></thead>
        <tbody>
          ${items.length === 0
            ? `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Sin repuestos registrados</div><div class="empty-sub"><a onclick="abrirModalRepuesto()" style="color:var(--green);cursor:pointer">Agregar el primero</a></div></div></td></tr>`
            : items.map(r => {
                const s = stockColor(r.stock_actual, r.stock_minimo);
                return `<tr>
                  <td style="text-align:center">${s.dot}</td>
                  <td class="mono fw-600" style="cursor:pointer;color:var(--green)" onclick="abrirDetalleRepuesto(${r.id})">${r.codigo}</td>
                  <td>${r.descripcion}${r.marca?` <span style="font-size:11px;color:var(--text-sec)">(${r.marca})</span>`:''}</td>
                  <td style="font-size:12px;color:var(--text-sec)">${r.categoria||'—'}</td>
                  <td>
                    <span style="background:${s.bg};color:${s.color};padding:2px 9px;border-radius:99px;font-size:12px;font-weight:500">
                      ${fmtStock(r.stock_actual, r.unidad)}
                    </span>
                  </td>
                  <td class="mono" style="font-size:12px;color:var(--text-sec)">${fmtStock(r.stock_minimo, r.unidad)}</td>
                  <td class="mono" style="font-size:12px">${ui.fmtCLP(r.precio_costo)}</td>
                  <td class="mono" style="font-size:12px;font-weight:500">${ui.fmtCLP(r.precio_venta)}</td>
                  <td style="font-size:12px;color:${r.margen>=30?'#0F6E56':r.margen>=15?'#854F0B':'#A32D2D'};font-weight:500">
                    ${r.margen!==null?r.margen+'%':'—'}
                  </td>
                  <td>
                    <div style="display:flex;gap:5px">
                      <button class="btn btn-sm" onclick="abrirMovimiento(${r.id},'${r.descripcion.replace(/'/g,"\\'")}',${r.stock_actual})">± Stock</button>
                      <button class="btn btn-sm" onclick="abrirDetalleRepuesto(${r.id})">Ver</button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Modal Repuesto -->
    <div class="modal-overlay hidden" id="modalRepuesto">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="modalRepuestoTitle">Nuevo repuesto</span>
          <button class="modal-close" onclick="closeInvModal('modalRepuesto')">×</button>
        </div>
        <div class="form-grid" id="modalRepuestoForm"></div>
        <div class="modal-footer">
          <button class="btn" onclick="closeInvModal('modalRepuesto')">Cancelar</button>
          <button class="btn btn-primary" id="btnGuardarRep" onclick="guardarRepuesto()">Guardar</button>
        </div>
      </div>
    </div>

    <!-- Modal Movimiento -->
    <div class="modal-overlay hidden" id="modalMovimiento">
      <div class="modal modal-sm">
        <div class="modal-header">
          <span class="modal-title">Ajustar stock</span>
          <button class="modal-close" onclick="closeInvModal('modalMovimiento')">×</button>
        </div>
        <div id="modalMovForm"></div>
        <div class="modal-footer">
          <button class="btn" onclick="closeInvModal('modalMovimiento')">Cancelar</button>
          <button class="btn btn-primary" id="btnGuardarMov" onclick="guardarMovimiento()">Confirmar</button>
        </div>
      </div>
    </div>

    <!-- Modal Detalle -->
    <div class="modal-overlay hidden" id="modalDetalle">
      <div class="modal modal-lg">
        <div class="modal-header">
          <span class="modal-title" id="modalDetalleTitle">Detalle repuesto</span>
          <button class="modal-close" onclick="closeInvModal('modalDetalle')">×</button>
        </div>
        <div id="modalDetalleContent"></div>
        <div class="modal-footer">
          <button class="btn" onclick="closeInvModal('modalDetalle')">Cerrar</button>
          <button class="btn btn-primary" onclick="closeInvModal('modalDetalle');abrirModalRepuesto(window._repuestoActual)">Editar</button>
        </div>
      </div>
    </div>
  `;
}

async function renderInventarioAlertas() {
  _invFiltro = { alerta: '1' };
  await renderInventario();
}

function filtrarInv(key, val) {
  if (val) _invFiltro[key] = val;
  else delete _invFiltro[key];
  clearTimeout(window._invTimer);
  window._invTimer = setTimeout(() => renderInventario(), 300);
}

function closeInvModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// ══════════════════════════════════════════════════════════════════════════════
// CREAR / EDITAR REPUESTO
// ══════════════════════════════════════════════════════════════════════════════
window._repuestoActual = null;

function abrirModalRepuesto(rep = null) {
  window._repuestoActual = rep;
  const es_nuevo = !rep;
  document.getElementById('modalRepuestoTitle').textContent = es_nuevo ? 'Nuevo repuesto' : 'Editar repuesto';

  document.getElementById('modalRepuestoForm').innerHTML = `
    <div class="form-group"><label>Código *</label>
      <input type="text" id="rCodigo" value="${rep?.codigo||''}" placeholder="NGK-BKR6EK" oninput="this.value=this.value.toUpperCase()"></div>
    <div class="form-group"><label>Descripción *</label>
      <input type="text" id="rDesc" value="${rep?.descripcion||''}" placeholder="Bujía NGK BKR6EK"></div>
    <div class="form-group"><label>Categoría</label>
      <select id="rCat">
        <option value="">Seleccionar…</option>
        ${['Motor','Transmisión','Frenos','Suspensión','Eléctrico','Carrocería','Filtros','Lubricantes','Neumáticos','Climatización','Otro']
          .map(c=>`<option value="${c}"${rep?.categoria===c?' selected':''}>${c}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>Marca</label>
      <input type="text" id="rMarca" value="${rep?.marca||''}" placeholder="NGK, Denso, Bosch…"></div>
    <div class="form-group"><label>Unidad</label>
      <select id="rUnidad">
        ${['unidad','litro','kg','metro','par'].map(u=>`<option value="${u}"${(rep?.unidad||'unidad')===u?' selected':''}>${u}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>Proveedor</label>
      <input type="text" id="rProveedor" value="${rep?.proveedor||''}" placeholder="Distribuidora X"></div>
    <div class="form-group"><label>Precio costo ($)</label>
      <input type="number" id="rPrecioCosto" value="${rep?.precio_costo||''}" placeholder="0"></div>
    <div class="form-group"><label>Precio venta ($)</label>
      <input type="number" id="rPrecioVenta" value="${rep?.precio_venta||''}" placeholder="0"></div>
    <div class="form-group"><label>${es_nuevo?'Stock inicial':'Stock mínimo (alerta)'}</label>
      <input type="number" id="${es_nuevo?'rStockInicial':'rStockMin'}" value="${es_nuevo?'':rep?.stock_minimo||1}" placeholder="${es_nuevo?'0':'1'}" min="0" step="0.5"></div>
    ${es_nuevo?`<div class="form-group"><label>Stock mínimo (alerta)</label>
      <input type="number" id="rStockMin" value="1" placeholder="1" min="0" step="0.5"></div>`:''}
    <div class="form-group"><label>Ubicación en bodega</label>
      <input type="text" id="rUbicacion" value="${rep?.ubicacion||''}" placeholder="Estante A / Cajón 3"></div>
    <div class="form-group full"><label>Notas</label>
      <textarea id="rNotas" rows="2">${rep?.notas||''}</textarea></div>
  `;
  document.getElementById('modalRepuesto').classList.remove('hidden');
}

async function guardarRepuesto() {
  const btn = document.getElementById('btnGuardarRep');
  ui.loading(btn, true);
  try {
    const payload = {
      codigo:        document.getElementById('rCodigo')?.value.trim().toUpperCase(),
      descripcion:   document.getElementById('rDesc')?.value.trim(),
      categoria:     document.getElementById('rCat')?.value || null,
      marca:         document.getElementById('rMarca')?.value.trim() || null,
      unidad:        document.getElementById('rUnidad')?.value,
      proveedor:     document.getElementById('rProveedor')?.value.trim() || null,
      precio_costo:  parseFloat(document.getElementById('rPrecioCosto')?.value) || 0,
      precio_venta:  parseFloat(document.getElementById('rPrecioVenta')?.value) || 0,
      stock_minimo:  parseFloat(document.getElementById('rStockMin')?.value) || 1,
      ubicacion:     document.getElementById('rUbicacion')?.value.trim() || null,
      notas:         document.getElementById('rNotas')?.value.trim() || null,
    };

    if (!payload.codigo || !payload.descripcion) {
      ui.toast('Código y descripción son obligatorios', 'warning');
      ui.loading(btn, false);
      return;
    }

    if (!window._repuestoActual) {
      payload.stock_inicial = parseFloat(document.getElementById('rStockInicial')?.value) || 0;
      await InventarioAPI.crear(payload);
      ui.toast('Repuesto creado');
    } else {
      await InventarioAPI.actualizar(window._repuestoActual.id, payload);
      ui.toast('Repuesto actualizado');
    }
    closeInvModal('modalRepuesto');
    await renderInventario();
  } catch(e) { ui.toast(e.message, 'error'); }
  ui.loading(btn, false);
}

// ══════════════════════════════════════════════════════════════════════════════
// MOVIMIENTO DE STOCK
// ══════════════════════════════════════════════════════════════════════════════
let _movRepuestoId = null;

function abrirMovimiento(id, descripcion, stockActual) {
  _movRepuestoId = id;
  document.getElementById('modalMovForm').innerHTML = `
    <div style="padding:0 0 14px">
      <div style="font-size:13px;color:var(--text-sec);margin-bottom:12px">${descripcion}</div>
      <div style="font-size:22px;font-weight:500;color:var(--green);margin-bottom:16px">
        Stock actual: ${parseFloat(stockActual).toLocaleString('es-CL')}
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Tipo de movimiento</label>
          <select id="movTipo">
            <option value="entrada">Entrada (compra / devolución)</option>
            <option value="salida">Salida (uso / merma)</option>
            <option value="ajuste">Ajuste (nuevo stock total)</option>
          </select>
        </div>
        <div class="form-group"><label>Cantidad</label>
          <input type="number" id="movCantidad" placeholder="0" min="0.5" step="0.5" value="1">
        </div>
        <div class="form-group full"><label>Motivo</label>
          <input type="text" id="movMotivo" placeholder="Ej: Compra proveedor / Uso en OT-00042…">
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalMovimiento').classList.remove('hidden');
}

async function guardarMovimiento() {
  const btn = document.getElementById('btnGuardarMov');
  ui.loading(btn, true);
  try {
    await InventarioAPI.mover(_movRepuestoId, {
      tipo:     document.getElementById('movTipo').value,
      cantidad: parseFloat(document.getElementById('movCantidad').value),
      motivo:   document.getElementById('movMotivo').value.trim() || null,
    });
    closeInvModal('modalMovimiento');
    ui.toast('Stock actualizado');
    await renderInventario();
  } catch(e) { ui.toast(e.message, 'error'); }
  ui.loading(btn, false);
}

// ══════════════════════════════════════════════════════════════════════════════
// DETALLE CON HISTORIAL
// ══════════════════════════════════════════════════════════════════════════════
async function abrirDetalleRepuesto(id) {
  try {
    const r = await InventarioAPI.obtener(id);
    window._repuestoActual = r;
    const s = stockColor(r.stock_actual, r.stock_minimo);
    const movs = r.movimientos || [];

    document.getElementById('modalDetalleTitle').textContent = `${r.codigo} — ${r.descripcion}`;
    document.getElementById('modalDetalleContent').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
        <div class="detail-block">
          <div class="detail-label">Stock actual</div>
          <div class="detail-value" style="color:${s.color}">${fmtStock(r.stock_actual, r.unidad)}</div>
        </div>
        <div class="detail-block"><div class="detail-label">Stock mínimo</div><div class="detail-value">${fmtStock(r.stock_minimo, r.unidad)}</div></div>
        <div class="detail-block"><div class="detail-label">Precio costo</div><div class="detail-value mono">${ui.fmtCLP(r.precio_costo)}</div></div>
        <div class="detail-block"><div class="detail-label">Precio venta</div><div class="detail-value mono" style="color:var(--green)">${ui.fmtCLP(r.precio_venta)}</div></div>
        <div class="detail-block"><div class="detail-label">Categoría</div><div class="detail-value">${r.categoria||'—'}</div></div>
        <div class="detail-block"><div class="detail-label">Marca</div><div class="detail-value">${r.marca||'—'}</div></div>
        <div class="detail-block"><div class="detail-label">Proveedor</div><div class="detail-value">${r.proveedor||'—'}</div></div>
        <div class="detail-block"><div class="detail-label">Ubicación</div><div class="detail-value">${r.ubicacion||'—'}</div></div>
      </div>

      <div style="font-size:12px;font-weight:600;color:var(--text-sec);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
        Historial de movimientos
      </div>
      ${movs.length === 0
        ? `<div style="color:var(--text-ter);font-size:13px;padding:12px 0">Sin movimientos registrados</div>`
        : `<div style="max-height:260px;overflow-y:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:var(--surface-alt)">
                <th style="padding:6px 10px;text-align:left;border-bottom:0.5px solid var(--border)">Fecha</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:0.5px solid var(--border)">Tipo</th>
                <th style="padding:6px 10px;text-align:right;border-bottom:0.5px solid var(--border)">Cant.</th>
                <th style="padding:6px 10px;text-align:right;border-bottom:0.5px solid var(--border)">Antes</th>
                <th style="padding:6px 10px;text-align:right;border-bottom:0.5px solid var(--border)">Después</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:0.5px solid var(--border)">Motivo / Referencia</th>
              </tr></thead>
              <tbody>
                ${movs.map(m => {
                  const tc = m.tipo==='entrada'?'#0F6E56':m.tipo==='salida'?'#A32D2D':'#854F0B';
                  return `<tr style="border-bottom:0.5px solid var(--border)">
                    <td style="padding:6px 10px;color:var(--text-sec)">${new Date(m.fecha).toLocaleString('es-CL',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td>
                    <td style="padding:6px 10px"><span style="color:${tc};font-weight:500">${m.tipo}</span></td>
                    <td style="padding:6px 10px;text-align:right;font-family:monospace">${parseFloat(m.cantidad).toLocaleString('es-CL')}</td>
                    <td style="padding:6px 10px;text-align:right;font-family:monospace;color:var(--text-sec)">${parseFloat(m.stock_antes).toLocaleString('es-CL')}</td>
                    <td style="padding:6px 10px;text-align:right;font-family:monospace;font-weight:500">${parseFloat(m.stock_despues).toLocaleString('es-CL')}</td>
                    <td style="padding:6px 10px;color:var(--text-sec)">${m.motivo||''}${m.referencia?` <span style="color:var(--green)">${m.referencia}</span>`:''}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
    `;
    document.getElementById('modalDetalle').classList.remove('hidden');
  } catch(e) { ui.toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETAR EN OT (búsqueda de repuesto al tipear código)
// ══════════════════════════════════════════════════════════════════════════════
async function buscarRepuestoEnOT(input) {
  const q = input.value.trim();
  if (q.length < 2) return;
  try {
    const results = await InventarioAPI.buscar(q);
    if (results.length === 0) return;
    // Si hay match exacto por código, autocompletar precio
    const exact = results.find(r => r.codigo === q.toUpperCase());
    if (exact) {
      const precioInput = document.getElementById('itemPrecio');
      const descInput   = document.getElementById('itemDesc');
      if (precioInput && !precioInput.value) precioInput.value = exact.precio_venta;
      if (descInput   && !descInput.value)   descInput.value   = exact.descripcion;
      const s = stockColor(exact.stock_actual, exact.stock_minimo);
      ui.toast(`Stock disponible: ${fmtStock(exact.stock_actual, exact.unidad)} — ${s.label}`);
    }
  } catch(e) {}
}

// Exponer globalmente
window.renderInventario         = renderInventario;
window.renderInventarioAlertas  = renderInventarioAlertas;
window.filtrarInv               = filtrarInv;
window.abrirModalRepuesto       = abrirModalRepuesto;
window.guardarRepuesto          = guardarRepuesto;
window.abrirMovimiento          = abrirMovimiento;
window.guardarMovimiento        = guardarMovimiento;
window.abrirDetalleRepuesto     = abrirDetalleRepuesto;
window.buscarRepuestoEnOT       = buscarRepuestoEnOT;
window.closeInvModal            = closeInvModal;
