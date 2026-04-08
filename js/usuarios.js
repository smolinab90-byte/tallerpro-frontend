/**
 * usuarios.js — Módulo de Gestión de Usuarios y Control de Acceso
 */

// ── API ───────────────────────────────────────────────────────────────────────
const UsuariosAPI = {
  listar:    ()          => API.apiGet('/usuarios/'),
  obtener:   (id)        => API.apiGet(`/usuarios/${id}`),
  crear:     (data)      => API.apiPost('/usuarios/', data),
  actualizar:(id, data)  => API.apiPut(`/usuarios/${id}`, data),
  eliminar:  (id)        => API.apiDelete(`/usuarios/${id}`),
  me:        ()          => API.apiGet('/usuarios/me'),
};
window.API.UsuariosAPI = UsuariosAPI;

// ── Control de acceso ─────────────────────────────────────────────────────────
const ROL_CONFIG = {
  admin:     { label: 'Administrador', color: '#5B3DA8', bg: '#EEE8FB', icon: '👑' },
  tecnico:   { label: 'Técnico',       color: '#0F6E56', bg: '#E1F5EE', icon: '🔧' },
  recepcion: { label: 'Recepción',     color: '#185FA5', bg: '#E6F1FB', icon: '📋' },
};

// Permisos por módulo y rol
const PERMISOS = {
  admin:     ['dashboard','ots','ot-detalle','clientes','vehiculos','historial','cotizaciones','agenda','kanban','inventario','precompras','ia','usuarios','perfil'],
  tecnico:   ['dashboard','ots','ot-detalle','clientes','vehiculos','historial','cotizaciones','agenda','kanban','inventario','precompras','ia','perfil'],
  recepcion: ['dashboard','ots','ot-detalle','clientes','vehiculos','historial','agenda','kanban','perfil'],
};

function getRol() {
  const user = API.Auth.getUser();
  return user?.rol || 'recepcion';
}

function tienePermiso(pagina) {
  const rol = getRol();
  return (PERMISOS[rol] || PERMISOS.recepcion).includes(pagina);
}

function puedeEditar(recurso) {
  const rol = getRol();
  const restricciones = {
    recepcion: ['inventario', 'precompras', 'cambiar_estado', 'eliminar_ot'],
    tecnico:   ['usuarios', 'reportes'],
  };
  return !(restricciones[rol] || []).includes(recurso);
}

// Aplicar visibilidad en el sidebar según rol
function aplicarPermisosUI() {
  const rol = getRol();
  const permitidos = PERMISOS[rol] || PERMISOS.recepcion;

  // Ocultar items del sidebar no permitidos
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    const page = item.dataset.page;
    if (!permitidos.includes(page)) {
      item.style.display = 'none';
    }
  });

  // Mostrar sección usuarios solo para admin
  const navUsuarios = document.getElementById('navUsuarios');
  if (navUsuarios) {
    navUsuarios.style.display = rol === 'admin' ? '' : 'none';
  }
}

window.tienePermiso  = tienePermiso;
window.puedeEditar   = puedeEditar;
window.aplicarPermisosUI = aplicarPermisosUI;
window.getRol        = getRol;

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO GESTIÓN DE USUARIOS (solo admin)
// ══════════════════════════════════════════════════════════════════════════════
let _usuarioActual = null;

async function renderUsuarios() {
  if (!tienePermiso('usuarios')) {
    document.getElementById('mainContent').innerHTML = `
      <div class="empty-state" style="padding:80px 20px">
        <div class="empty-icon">🔒</div>
        <div class="empty-title">Acceso restringido</div>
        <div class="empty-sub">Solo los administradores pueden gestionar usuarios.</div>
      </div>`;
    return;
  }

  const usuarios = await UsuariosAPI.listar();

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Gestión de usuarios</div>
        <div class="page-subtitle">${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} registrado${usuarios.length !== 1 ? 's' : ''}</div>
      </div>
      <button class="btn btn-primary" onclick="abrirModalUsuario()">+ Nuevo usuario</button>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Estado</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Acciones</th>
        </tr></thead>
        <tbody>
          ${usuarios.length === 0
            ? `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Sin usuarios</div></div></td></tr>`
            : usuarios.map(u => {
                const r = ROL_CONFIG[u.rol] || ROL_CONFIG.tecnico;
                const yo = API.Auth.getUser()?.id === u.id;
                return `<tr style="${!u.activo ? 'opacity:.5' : ''}">
                  <td>
                    <span style="background:${u.activo ? '#E1F5EE' : '#F1EFE8'};color:${u.activo ? '#0F6E56' : '#B4B2A9'};padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500">
                      ${u.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td style="font-weight:500">${u.nombre}${yo ? ' <span style="font-size:10px;color:var(--text-ter)">(tú)</span>' : ''}</td>
                  <td style="font-size:13px;color:var(--text-sec)">${u.email}</td>
                  <td>
                    <span style="background:${r.bg};color:${r.color};padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500">
                      ${r.icon} ${r.label}
                    </span>
                  </td>
                  <td>
                    <div style="display:flex;gap:5px">
                      <button class="btn btn-sm" onclick="abrirModalUsuario(${JSON.stringify(u).replace(/"/g, '&quot;')})">Editar</button>
                      ${!yo ? `<button class="btn btn-sm" style="color:${u.activo ? '#A32D2D' : '#0F6E56'}"
                        onclick="${u.activo ? `desactivarUsuario(${u.id})` : `activarUsuario(${u.id})`}">
                        ${u.activo ? 'Desactivar' : 'Activar'}
                      </button>` : ''}
                    </div>
                  </td>
                </tr>`;
              }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Modal Usuario -->
    <div class="modal-overlay hidden" id="modalUsuario">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="modalUsuarioTitle">Nuevo usuario</span>
          <button class="modal-close" onclick="cerrarModalUsuario()">×</button>
        </div>
        <div id="modalUsuarioForm"></div>
        <div class="modal-footer">
          <button class="btn" onclick="cerrarModalUsuario()">Cancelar</button>
          <button class="btn btn-primary" id="btnGuardarUsuario" onclick="guardarUsuario()">Guardar</button>
        </div>
      </div>
    </div>
  `;
}

function abrirModalUsuario(u = null) {
  _usuarioActual = u;
  const esNuevo = !u;
  document.getElementById('modalUsuarioTitle').textContent = esNuevo ? 'Nuevo usuario' : 'Editar usuario';

  document.getElementById('modalUsuarioForm').innerHTML = `
    <div class="form-grid" style="padding:0 0 4px">
      <div class="form-group"><label>Nombre completo *</label>
        <input type="text" id="uNombre" value="${u?.nombre||''}" placeholder="Juan Técnico"></div>
      <div class="form-group"><label>Email *</label>
        <input type="email" id="uEmail" value="${u?.email||''}" placeholder="juan@taller.cl"></div>
      <div class="form-group"><label>Rol *</label>
        <select id="uRol">
          ${Object.entries(ROL_CONFIG).map(([val, cfg]) =>
            `<option value="${val}"${u?.rol===val?' selected':''}>${cfg.icon} ${cfg.label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>${esNuevo ? 'Contraseña *' : 'Nueva contraseña (opcional)'}</label>
        <input type="password" id="uPassword" placeholder="${esNuevo ? 'Mínimo 6 caracteres' : 'Dejar vacío para no cambiar'}">
      </div>
      ${!esNuevo ? `
      <div class="form-group full" style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:10px;margin-top:4px">
        <div style="font-size:12px;color:var(--text-sec);margin-bottom:8px">
          ℹ️ Cambiar contraseña como admin no requiere la contraseña actual del usuario.
        </div>
      </div>` : ''}
    </div>
  `;
  document.getElementById('modalUsuario').classList.remove('hidden');
}

function cerrarModalUsuario() {
  document.getElementById('modalUsuario')?.classList.add('hidden');
  _usuarioActual = null;
}

async function guardarUsuario() {
  const btn = document.getElementById('btnGuardarUsuario');
  ui.loading(btn, true);
  try {
    const nombre   = document.getElementById('uNombre').value.trim();
    const email    = document.getElementById('uEmail').value.trim();
    const rol      = document.getElementById('uRol').value;
    const password = document.getElementById('uPassword').value.trim();

    if (!nombre || !email) {
      ui.toast('Nombre y email son obligatorios', 'warning');
      ui.loading(btn, false);
      return;
    }

    if (!_usuarioActual && !password) {
      ui.toast('La contraseña es obligatoria para nuevos usuarios', 'warning');
      ui.loading(btn, false);
      return;
    }

    const payload = { nombre, email, rol };
    if (password) payload.nueva_password = password;

    if (!_usuarioActual) {
      payload.password = password;
      await UsuariosAPI.crear(payload);
      ui.toast('Usuario creado');
    } else {
      await UsuariosAPI.actualizar(_usuarioActual.id, payload);
      ui.toast('Usuario actualizado');
    }

    cerrarModalUsuario();
    await renderUsuarios();
  } catch(e) { ui.toast(e.message, 'error'); }
  ui.loading(btn, false);
}

async function desactivarUsuario(id) {
  if (!confirm('¿Desactivar este usuario? No podrá iniciar sesión.')) return;
  try {
    await UsuariosAPI.actualizar(id, { activo: false });
    ui.toast('Usuario desactivado');
    await renderUsuarios();
  } catch(e) { ui.toast(e.message, 'error'); }
}

async function activarUsuario(id) {
  try {
    await UsuariosAPI.actualizar(id, { activo: true });
    ui.toast('Usuario activado');
    await renderUsuarios();
  } catch(e) { ui.toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// PERFIL PROPIO (todos los roles)
// ══════════════════════════════════════════════════════════════════════════════
async function renderPerfil() {
  const user = API.Auth.getUser();
  const rol = ROL_CONFIG[user?.rol] || ROL_CONFIG.tecnico;

  document.getElementById('mainContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Mi perfil</div>
        <div class="page-subtitle">${rol.icon} ${rol.label}</div>
      </div>
    </div>

    <div class="card mb-16" style="max-width:480px">
      <div class="card-title">Información de la cuenta</div>
      <div class="form-grid">
        <div class="form-group"><label>Nombre</label>
          <input type="text" id="pNombre" value="${user?.nombre||''}"></div>
        <div class="form-group"><label>Email</label>
          <input type="email" id="pEmail" value="${user?.email||''}"></div>
        <div class="form-group full">
          <label>Rol actual</label>
          <div style="padding:8px 12px;background:${rol.bg};color:${rol.color};border-radius:var(--border-radius-md);font-size:13px;font-weight:500">
            ${rol.icon} ${rol.label}
          </div>
        </div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="guardarPerfil()">Guardar cambios</button>
      </div>
    </div>

    <div class="card" style="max-width:480px">
      <div class="card-title">Cambiar contraseña</div>
      <div class="form-grid">
        <div class="form-group full"><label>Contraseña actual</label>
          <input type="password" id="pPassActual" placeholder="Tu contraseña actual"></div>
        <div class="form-group"><label>Nueva contraseña</label>
          <input type="password" id="pPassNueva" placeholder="Mínimo 6 caracteres"></div>
        <div class="form-group"><label>Confirmar nueva</label>
          <input type="password" id="pPassConfirm" placeholder="Repetir nueva contraseña"></div>
      </div>
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="cambiarPasswordPerfil()">Cambiar contraseña</button>
      </div>
    </div>
  `;
}

async function guardarPerfil() {
  const user = API.Auth.getUser();
  try {
    const payload = {
      nombre: document.getElementById('pNombre').value.trim(),
      email:  document.getElementById('pEmail').value.trim(),
    };
    await UsuariosAPI.actualizar(user.id, payload);
    // Actualizar localStorage
    const updated = await UsuariosAPI.me();
    API.Auth.setUser(updated);
    document.getElementById('userName').textContent = updated.nombre;
    document.getElementById('userAvatar').textContent = updated.nombre.charAt(0).toUpperCase();
    ui.toast('Perfil actualizado');
  } catch(e) { ui.toast(e.message, 'error'); }
}

async function cambiarPasswordPerfil() {
  const actual   = document.getElementById('pPassActual').value.trim();
  const nueva    = document.getElementById('pPassNueva').value.trim();
  const confirm  = document.getElementById('pPassConfirm').value.trim();

  if (!actual || !nueva) { ui.toast('Completa todos los campos', 'warning'); return; }
  if (nueva !== confirm) { ui.toast('Las contraseñas no coinciden', 'warning'); return; }
  if (nueva.length < 6)  { ui.toast('Mínimo 6 caracteres', 'warning'); return; }

  try {
    const user = API.Auth.getUser();
    await UsuariosAPI.actualizar(user.id, {
      password_actual: actual,
      nueva_password:  nueva,
    });
    document.getElementById('pPassActual').value = '';
    document.getElementById('pPassNueva').value  = '';
    document.getElementById('pPassConfirm').value = '';
    ui.toast('Contraseña actualizada');
  } catch(e) { ui.toast(e.message, 'error'); }
}

// Exponer globalmente
window.renderUsuarios       = renderUsuarios;
window.renderPerfil         = renderPerfil;
window.abrirModalUsuario    = abrirModalUsuario;
window.cerrarModalUsuario   = cerrarModalUsuario;
window.guardarUsuario       = guardarUsuario;
window.desactivarUsuario    = desactivarUsuario;
window.activarUsuario       = activarUsuario;
window.guardarPerfil        = guardarPerfil;
window.cambiarPasswordPerfil = cambiarPasswordPerfil;
