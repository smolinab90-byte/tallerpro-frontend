/**
 * api.js — Capa de comunicación con el backend TallerPro
 * Todos los módulos del frontend importan desde aquí.
 */

const API_BASE = (window.TALLERPRO_API && !window.TALLERPRO_API.includes('localhost')) ? window.TALLERPRO_API : "https://tallerpro-backend-production.up.railway.app/api";

// ── Token JWT ────────────────────────────────────────────────────────────────
const Auth = {
  getToken:    ()    => localStorage.getItem("tp_token"),
  setToken:    (t)   => localStorage.setItem("tp_token", t),
  removeToken: ()    => localStorage.removeItem("tp_token"),
  getUser:     ()    => { try { return JSON.parse(localStorage.getItem("tp_user")); } catch { return null; } },
  setUser:     (u)   => localStorage.setItem("tp_user", JSON.stringify(u)),
  isLogged:    ()    => !!localStorage.getItem("tp_token"),
  logout:      ()    => { localStorage.removeItem("tp_token"); localStorage.removeItem("tp_user"); },
};

// ── Fetch base ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = Auth.getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    Auth.logout();
    window.location.href = "/tallerpro-frontend/login.html";
    return;
  }

  const data = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const msg = data?.error || data?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function apiGet(path)         { return apiFetch(path, { method: "GET" }); }
async function apiPost(path, body)  { return apiFetch(path, { method: "POST",   body: JSON.stringify(body) }); }
async function apiPut(path, body)   { return apiFetch(path, { method: "PUT",    body: JSON.stringify(body) }); }
async function apiDelete(path)      { return apiFetch(path, { method: "DELETE" }); }

// ── Subida de archivos (multipart) ───────────────────────────────────────────
async function apiUpload(path, formData) {
  const token = Auth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

// ── Descarga PDF ─────────────────────────────────────────────────────────────
async function apiDownloadPDF(path, filename) {
  const token = Auth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename || "cotizacion.pdf";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Módulos de la API ────────────────────────────────────────────────────────

const AuthAPI = {
  login:  (email, password) => apiPost("/auth/login",  { email, password }),
  me:     ()                => apiGet("/auth/me"),
  cambiarPassword: (actual, nueva) => apiPut("/auth/cambiar-password", { password_actual: actual, password_nueva: nueva }),
};

const DashboardAPI = {
  stats: () => apiGet("/dashboard/"),
};

const ClientesAPI = {
  listar:    (q = "")  => apiGet(`/clientes/${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  obtener:   (id)      => apiGet(`/clientes/${id}`),
  crear:     (data)    => apiPost("/clientes/", data),
  actualizar:(id, data)=> apiPut(`/clientes/${id}`, data),
  eliminar:  (id)      => apiDelete(`/clientes/${id}`),
};

const VehiculosAPI = {
  listar:      (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiGet(`/vehiculos/${qs ? `?${qs}` : ""}`);
  },
  porPatente:  (patente) => apiGet(`/vehiculos/patente/${patente}`),
  obtener:     (id)      => apiGet(`/vehiculos/${id}`),
  crear:       (data)    => apiPost("/vehiculos/", data),
  actualizar:  (id, data)=> apiPut(`/vehiculos/${id}`, data),
  eliminar:    (id)      => apiDelete(`/vehiculos/${id}`),
};

const OrdenesAPI = {
  listar:       (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiGet(`/ordenes/${qs ? `?${qs}` : ""}`);
  },
  obtener:      (id)          => apiGet(`/ordenes/${id}`),
  crear:        (data)        => apiPost("/ordenes/", data),
  actualizar:   (id, data)    => apiPut(`/ordenes/${id}`, data),
  cambiarEstado:(id, estado, notas = "") => apiPut(`/ordenes/${id}/estado`, { estado, notas }),
  eliminar:     (id)          => apiDelete(`/ordenes/${id}`),
  // Ítems
  listarItems:  (id)          => apiGet(`/ordenes/${id}/items`),
  agregarItem:  (id, data)    => apiPost(`/ordenes/${id}/items`, data),
  actualizarItem:(id, itemId, data) => apiPut(`/ordenes/${id}/items/${itemId}`, data),
  eliminarItem: (id, itemId)  => apiDelete(`/ordenes/${id}/items/${itemId}`),
  // Fotos
  listarFotos:  (id)          => apiGet(`/ordenes/${id}/fotos`),
  subirFoto:    (id, formData)=> apiUpload(`/ordenes/${id}/fotos`, formData),
  eliminarFoto: (id, fotoId)  => apiDelete(`/ordenes/${id}/fotos/${fotoId}`),
  // PDF
  descargarPDF: (id, patente) => apiDownloadPDF(`/ordenes/${id}/cotizacion.pdf`, `Cotizacion_OT-${String(id).padStart(5,"0")}_${patente}.pdf`),
};

const EventosAPI = {
  listar:    (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiGet(`/eventos/${qs ? `?${qs}` : ""}`);
  },
  crear:     (data)    => apiPost("/eventos/", data),
  actualizar:(id, data)=> apiPut(`/eventos/${id}`, data),
  eliminar:  (id)      => apiDelete(`/eventos/${id}`),
};

const IAAPI = {
  diagnostico:      (data) => apiPost("/ia/diagnostico", data),
  resumenWhatsApp:  (ordenId) => apiPost("/ia/resumen-whatsapp", { orden_id: ordenId }),
  consulta:         (pregunta) => apiPost("/ia/consulta", { pregunta }),
};

// ── Helpers UI ───────────────────────────────────────────────────────────────
function fmtCLP(n) {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function fmtFecha(str) {
  if (!str) return "—";
  const d = new Date(str + (str.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function badge(estado) {
  const map = {
    recibido: "badge-recibido", diagnosticando: "badge-diagnosticando",
    cotizado: "badge-cotizado", aprobado: "badge-aprobado",
    reparando: "badge-reparando", terminado: "badge-terminado",
    entregado: "badge-entregado",
  };
  return `<span class="badge ${map[estado] || ""}">${estado}</span>`;
}

function toast(msg, tipo = "success") {
  const el = document.createElement("div");
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3000);
}

function loading(btn, activo) {
  if (!btn) return;
  if (activo) { btn.dataset.orig = btn.textContent; btn.textContent = "…"; btn.disabled = true; }
  else        { btn.textContent = btn.dataset.orig || btn.textContent; btn.disabled = false; }
}

// ── Guard de autenticación ───────────────────────────────────────────────────
function requireAuth() {
  if (!Auth.isLogged()) {
    window.location.href = "/tallerpro-frontend/login.html";
    return false;
  }
  return true;
}

// Exportar todo globalmente (vanilla JS sin bundler)
window.API = { Auth, AuthAPI, DashboardAPI, ClientesAPI, VehiculosAPI, OrdenesAPI, EventosAPI, IAAPI,
               apiGet, apiPost, apiPut, apiDelete, apiUpload, apiDownloadPDF };
window.ui  = { fmtCLP, fmtFecha, badge, toast, loading };
