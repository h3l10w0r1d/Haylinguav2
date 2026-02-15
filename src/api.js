// src/api.js
// Small fetch helper used across FE (student + public pages)

export const API_BASE = (
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "https://haylinguav2.onrender.com"
).replace(/\/$/, "");

// App.jsx uses "hay_token" as the auth token key
export function getToken() {
  return localStorage.getItem("hay_token") || "";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * apiFetch("/me/profile", { token })
 */
export async function apiFetch(path, opts = {}) {
  const {
    method = "GET",
    token = "",
    body = undefined,
    headers = {},
    raw = false,
  } = opts;

  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const h = { ...headers };
  const hasBody = body !== undefined && body !== null;
  if (hasBody && !(body instanceof FormData)) {
    h["content-type"] = h["content-type"] || "application/json";
  }
  if (token) h.authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers: h,
    body: hasBody ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });

  if (raw) return res;

  const text = await res.text();
  const data = safeJsonParse(text);
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || text || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
