/**
 * pagos.js — Módulo de Pagos por OT
 */

// ── API ───────────────────────────────────────────────────────────────────────
const PagosAPI = {
  listar:    (ordenId)       => API.apiGet(`/ordenes/${ordenId}/pagos`),
  registrar: (ordenId, data) => API.apiPost(`/ordenes/${ordenId}/pagos`, data),
  eliminar:  (ordenId, id)   => API.apiDelete(`/ordenes/${ordenId}/pagos/${id}`),
  deudas:    ()              => API.apiGet('/deudas'),
};
window.API.PagosAPI = PagosAPI;

const METODO_LABEL = {
  efectivo:       '💵 Efectivo',
  transferencia:  '🏦 Transferencia',
  tarjeta_debito: '💳 Débito',
  tarjeta_credito:'💳 Crédito',
  cheque:         '📄 Cheque',
  otro:           '🔹 Otro',
};

// ══════════════════════════════════════════════════════════════════════════════
// TAB PAGOS EN DETALLE OT
// ══════════════════════════════════════════════════════════════════════════════
async function renderTabPagos(ordenId) {
  const container = document.getElementById('tab-pagos-inner') || document.getElementById('tab-pagos');
  if (!container) return;

  try {
    const data = await PagosAPI.listar(ordenId);
    const { total_cotizado, total_pagado, saldo_pendiente, pagos } = data;
    const pct = total_cotizado > 0 ? Math.min(100, Math.round(total_pagado / total_cotizado * 100)) : 0;
    const tieneDeuda = saldo_pendiente > 0;

    container.innerHTML = `
      <!-- Resumen -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        <div class="detail-block">
          <div class="detail-label">Total cotizado</div>
          <div class="detail-value mono">${ui.fmtCLP(total_cotizado)}</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">Total pagado</div>
          <div class="detail-value mono" style="color:var(--green)">${ui.fmtCLP(total_pagado)}</div>
        </div>
        <div class="detail-block">
          <div class="detail-label">Saldo pendiente</div>
          <div class="detail-value mono" style="color:${tieneDeuda ? '#A32D2D' : 'var(--green)'}">
            ${tieneDeuda ? '⚠ ' : '✓ '}${ui.fmtCLP(Math.abs(saldo_pendiente))}
            ${saldo_pendiente < 0 ? ' (overpago)' : ''}
          </div>
        </div>
      </div>

      <!-- Barra de progreso -->
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-sec);margin-bottom:4px">
          <span>Progreso de pago</span><span>${pct}%</span>
        </div>
        <div style="background:var(--color-border-tertiary);border-radius:99px;height:8px;overflow:hidden">
          <div style="height:100%;border-radius:99px;background:${pct>=100?'var(--green)':'var(--amber)'};width:${pct}%;transition:width .3s"></div>
        </div>
      </div>

      <!-- Botón agregar pago -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:var(--text-sec);text-transform:uppercase;letter-spacing:.05em">
          Pagos registrados (${pagos.length})
        </div>
        <button class="btn btn-sm btn-primary" onclick="abrirModalPago(${ordenId})">+ Registrar pago</button>
      </div>

      <!-- Lista de pagos -->
      ${pagos.length === 0
        ? `<div style="text-align:center;padding:24px;color:var(--text-ter);font-size:13px">
             Sin pagos registrados aún
           </div>`
        : pagos.map(p => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:0.5px solid var(--color-border-tertiary)">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500">${ui.fmtCLP(p.monto)}</div>
              <div style="font-size:11px;color:var(--text-sec);margin-top:2px">
                ${METODO_LABEL[p.metodo]||p.metodo}
                ${p.nro_documento ? ` · Doc: ${p.nro_documento}` : ''}
                · ${ui.fmtFecha(p.fecha)}
                · ${p.usuario_nombre}
              </div>
              ${p.notas ? `<div style="font-size:11px;color:var(--text-ter);font-style:italic;margin-top:2px">${p.notas}</div>` : ''}
            </div>
            <button class="btn btn-sm" style="color:#A32D2D" onclick="eliminarPago(${ordenId}, ${p.id})">✕</button>
          </div>`).join('')}

      <!-- Modal pago -->
      <div class="modal-overlay hidden" id="modalPago">
        <div class="modal modal-sm">
          <div class="modal-header">
            <span class="modal-title">Registrar pago</span>
            <button class="modal-close" onclick="cerrarModalPago()">×</button>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Monto *</label>
              <input type="number" id="pagoMonto" placeholder="${Math.max(0, saldo_pendiente) || ''}" value="${saldo_pendiente > 0 ? Math.round(saldo_pendiente) : ''}">
            </div>
            <div class="form-group"><label>Método de pago *</label>
              <select id="pagoMetodo">
                ${Object.entries(METODO_LABEL).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Fecha</label>
              <input type="date" id="pagoFecha" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group"><label>N° Boleta / Factura</label>
              <input type="text" id="pagoDoc" placeholder="B-001234">
            </div>
            <div class="form-group full"><label>Notas</label>
              <textarea id="pagoNotas" rows="2" placeholder="Observaciones del pago..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" onclick="cerrarModalPago()">Cancelar</button>
            <button class="btn btn-primary" id="btnGuardarPago" onclick="guardarPago(${ordenId})">Registrar pago</button>
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div style="color:var(--color-red);padding:16px">Error al cargar pagos: ${e.message}</div>`;
  }
}

function abrirModalPago(ordenId) {
  document.getElementById('modalPago')?.classList.remove('hidden');
}

function cerrarModalPago() {
  document.getElementById('modalPago')?.classList.add('hidden');
}

async function guardarPago(ordenId) {
  const btn = document.getElementById('btnGuardarPago');
  ui.loading(btn, true);
  try {
    const monto = parseFloat(document.getElementById('pagoMonto')?.value);
    if (!monto || monto <= 0) {
      ui.toast('Ingresa un monto válido', 'warning');
      ui.loading(btn, false);
      return;
    }
    await PagosAPI.registrar(ordenId, {
      monto,
      metodo:        document.getElementById('pagoMetodo')?.value,
      fecha:         document.getElementById('pagoFecha')?.value,
      nro_documento: document.getElementById('pagoDoc')?.value?.trim() || null,
      notas:         document.getElementById('pagoNotas')?.value?.trim() || null,
    });
    cerrarModalPago();
    ui.toast('Pago registrado');
    await renderTabPagos(ordenId);
  } catch(e) { ui.toast(e.message, 'error'); }
  ui.loading(btn, false);
}

async function eliminarPago(ordenId, pagoId) {
  if (!confirm('¿Eliminar este pago? Esta acción no se puede deshacer.')) return;
  try {
    await PagosAPI.eliminar(ordenId, pagoId);
    ui.toast('Pago eliminado');
    await renderTabPagos(ordenId);
  } catch(e) { ui.toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO DEUDAS (vista general)
// ══════════════════════════════════════════════════════════════════════════════
async function renderDeudas() {
  const deudas = await PagosAPI.deudas();
  const totalDeuda = deudas.reduce((s, d) => s + d.saldo_pendiente, 0);

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Cuentas por cobrar</div>
        <div class="page-subtitle">${deudas.length} OT con deuda pendiente · Total: <strong>${ui.fmtCLP(totalDeuda)}</strong></div>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>OT</th><th>Cliente</th><th>Patente</th><th>Estado</th>
          <th>Cotizado</th><th>Pagado</th><th>Saldo</th><th>Acciones</th>
        </tr></thead>
        <tbody>
          ${deudas.length === 0
            ? `<tr><td colspan="8">
                <div class="empty-state">
                  <div class="empty-icon">✅</div>
                  <div class="empty-title">Sin deudas pendientes</div>
                </div>
               </td></tr>`
            : deudas.map(d => `
              <tr>
                <td class="mono fw-600">${d.numero}</td>
                <td>${d.cliente_nombre}</td>
                <td class="mono">${d.patente}</td>
                <td><span class="badge badge-${d.estado}">${d.estado}</span></td>
                <td class="mono">${ui.fmtCLP(d.total_cotizado)}</td>
                <td class="mono" style="color:var(--green)">${ui.fmtCLP(d.total_pagado)}</td>
                <td class="mono fw-600" style="color:#A32D2D">${ui.fmtCLP(d.saldo_pendiente)}</td>
                <td>
                  <button class="btn btn-sm btn-primary" onclick="window.currentOTId=${d.orden_id};navTo('ot-detalle')">
                    Ver OT
                  </button>
                </td>
              </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

window.renderTabPagos  = renderTabPagos;
window.abrirModalPago  = abrirModalPago;
window.cerrarModalPago = cerrarModalPago;
window.guardarPago     = guardarPago;
window.eliminarPago    = eliminarPago;
window.renderDeudas    = renderDeudas;
