/**
 * kanban.js — Tablero Kanban de Producción
 * Drag & drop entre columnas, tarjetas completas, tiempo en estado actual
 */

const KANBAN_ESTADOS = [
  { id: 'recibido',       label: 'Recibido',       color: '#5F5E5A', bg: '#F1EFE8' },
  { id: 'diagnosticando', label: 'Diagnosticando', color: '#185FA5', bg: '#E6F1FB' },
  { id: 'cotizado',       label: 'Cotizado',       color: '#854F0B', bg: '#FAEEDA' },
  { id: 'aprobado',       label: 'Aprobado',       color: '#5B3DA8', bg: '#EEE8FB' },
  { id: 'reparando',      label: 'Reparando',      color: '#0F6E56', bg: '#E1F5EE' },
  { id: 'terminado',      label: 'Terminado',      color: '#1D6FA4', bg: '#E0F2FE' },
  { id: 'entregado',      label: 'Entregado',      color: '#444441', bg: '#EBEBEB' },
];

// ── Tiempo en estado actual ───────────────────────────────────────────────────
function tiempoEnEstado(historial, estadoActual) {
  if (!historial || historial.length === 0) return '—';
  // Buscar la última vez que entró al estado actual
  const entradas = historial.filter(h => h.estado === estadoActual);
  if (entradas.length === 0) return '—';
  const ultima = entradas[entradas.length - 1];
  const desde = new Date(ultima.fecha);
  const ahora = new Date();
  const diff = Math.floor((ahora - desde) / 1000 / 60); // minutos
  if (diff < 60)    return `${diff}m`;
  if (diff < 1440)  return `${Math.floor(diff/60)}h ${diff%60}m`;
  return `${Math.floor(diff/1440)}d ${Math.floor((diff%1440)/60)}h`;
}

// ── Items pendientes (no completados) ────────────────────────────────────────
function itemsPendientes(items) {
  if (!items) return 0;
  return items.filter(i => i.tipo === 'repuesto').length;
}

// ── Renderizar tarjeta ───────────────────────────────────────────────────────
function renderTarjeta(ot) {
  const estado = KANBAN_ESTADOS.find(e => e.id === ot.estado) || KANBAN_ESTADOS[0];
  const tiempo = tiempoEnEstado(ot.historial_estados, ot.estado);
  const items  = ot.items ? ot.items.length : (ot.total > 0 ? '?' : 0);

  return `
    <div class="kanban-card" draggable="true"
         data-id="${ot.id}" data-estado="${ot.estado}"
         onclick="abrirOTdesdeKanban(${ot.id})">
      <div class="kanban-card-header">
        <span class="kanban-card-num">${ot.numero || `OT-${String(ot.id).padStart(5,'0')}`}</span>
        <span class="kanban-card-tiempo" title="Tiempo en estado actual">${tiempo}</span>
      </div>
      <div class="kanban-card-patente">${ot.patente || '—'}</div>
      <div class="kanban-card-cliente">${ot.cliente_nombre || '—'}</div>
      <div class="kanban-card-vehiculo">${ot.vehiculo_desc || ''}</div>
      <div class="kanban-card-footer">
        <span title="Técnico">${ot.tecnico_nombre ? '👤 '+ot.tecnico_nombre.split(' ')[0] : '👤 Sin asignar'}</span>
        <span title="Ítems">${items > 0 ? `📦 ${items} ítem${items>1?'s':''}` : ''}</span>
        <span title="Total">${ot.total > 0 ? ui.fmtCLP(ot.total) : ''}</span>
      </div>
      ${ot.fecha_promesa ? `<div class="kanban-card-promesa" title="Fecha promesa">📅 ${ui.fmtFecha(ot.fecha_promesa)}</div>` : ''}
    </div>
  `;
}

// ── Renderizar Kanban ─────────────────────────────────────────────────────────
async function renderKanban() {
  const content = document.getElementById('mainContent');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Tablero de producción</div>
        <div class="page-subtitle">Vista Kanban — arrastra las OT para cambiar su estado</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" onclick="renderKanban()">↻ Actualizar</button>
        <button class="btn btn-primary" onclick="navTo('ots')">+ Nueva OT</button>
      </div>
    </div>
    <div id="kanbanLoading" style="text-align:center;padding:40px;color:var(--color-text-tertiary)">
      <div class="spinner spinner-dark"></div>
    </div>
    <div id="kanbanBoard" class="kanban-board" style="display:none"></div>
  `;

  try {
    // Cargar todas las OT activas (sin entregadas para no saturar)
    const data = await API.OrdenesAPI.listar({ per_page: 200 });
    const ots = data.items || data || [];

    // Agrupar por estado
    const grupos = {};
    KANBAN_ESTADOS.forEach(e => { grupos[e.id] = []; });
    ots.forEach(ot => {
      if (grupos[ot.estado] !== undefined) {
        grupos[ot.estado].push(ot);
      }
    });

    // Renderizar tablero
    const board = document.getElementById('kanbanBoard');
    board.innerHTML = KANBAN_ESTADOS.map(estado => `
      <div class="kanban-col" data-estado="${estado.id}">
        <div class="kanban-col-header" style="border-top:3px solid ${estado.color}">
          <span class="kanban-col-title" style="color:${estado.color}">${estado.label}</span>
          <span class="kanban-col-count" style="background:${estado.bg};color:${estado.color}">
            ${grupos[estado.id].length}
          </span>
        </div>
        <div class="kanban-col-body" data-estado="${estado.id}">
          ${grupos[estado.id].length === 0
            ? `<div class="kanban-empty">Sin OT</div>`
            : grupos[estado.id].map(ot => renderTarjeta(ot)).join('')}
        </div>
      </div>
    `).join('');

    document.getElementById('kanbanLoading').style.display = 'none';
    board.style.display = 'flex';

    // Inicializar drag & drop
    initDragDrop();

  } catch(e) {
    document.getElementById('kanbanLoading').innerHTML =
      `<div style="color:var(--color-red)">Error al cargar: ${e.message}</div>`;
  }
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
function initDragDrop() {
  let draggedId   = null;
  let draggedEstado = null;

  // Cards — drag start
  document.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedId    = card.dataset.id;
      draggedEstado = card.dataset.estado;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedId);
    });
    card.addEventListener('dragend', e => {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-col-body').forEach(col => {
        col.classList.remove('drag-over');
      });
    });
  });

  // Columns — drop zones
  document.querySelectorAll('.kanban-col-body').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', e => {
      col.classList.remove('drag-over');
    });
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const nuevoEstado = col.dataset.estado;

      if (!draggedId || nuevoEstado === draggedEstado) return;

      // Optimistic UI — mover la tarjeta visualmente
      const card = document.querySelector(`.kanban-card[data-id="${draggedId}"]`);
      if (card) {
        const emptyMsg = col.querySelector('.kanban-empty');
        if (emptyMsg) emptyMsg.remove();
        card.dataset.estado = nuevoEstado;
        col.appendChild(card);
        // Actualizar contadores
        actualizarContadores();
      }

      // API call
      try {
        await API.OrdenesAPI.cambiarEstado(parseInt(draggedId), nuevoEstado);
        ui.toast(`OT movida a ${KANBAN_ESTADOS.find(e=>e.id===nuevoEstado)?.label}`);
        // Refrescar para obtener tiempo actualizado
        setTimeout(() => renderKanban(), 1500);
      } catch(err) {
        ui.toast(err.message, 'error');
        // Revertir si falla
        setTimeout(() => renderKanban(), 500);
      }
      draggedId = null;
      draggedEstado = null;
    });
  });
}

function actualizarContadores() {
  KANBAN_ESTADOS.forEach(estado => {
    const col   = document.querySelector(`.kanban-col[data-estado="${estado.id}"]`);
    if (!col) return;
    const count = col.querySelectorAll('.kanban-card').length;
    const badge = col.querySelector('.kanban-col-count');
    if (badge) badge.textContent = count;
    // Mostrar "Sin OT" si columna quedó vacía
    const body = col.querySelector('.kanban-col-body');
    if (body && count === 0 && !body.querySelector('.kanban-empty')) {
      body.innerHTML = '<div class="kanban-empty">Sin OT</div>';
    }
  });
}

function abrirOTdesdeKanban(id) {
  window.currentOTId = id;
  navTo('ot-detalle');
}

// Exponer globalmente
window.renderKanban        = renderKanban;
window.abrirOTdesdeKanban  = abrirOTdesdeKanban;
