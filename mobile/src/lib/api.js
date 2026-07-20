// src/lib/api.js — fetch wrapper for the real Haylingua backend.
// Mirrors the web app's pattern (see src/Dashboard.jsx): same API_BASE_URL,
// same `Authorization: Bearer <token>` header. No SDK, just fetch.
import { getToken } from './authStore';

export const API_BASE_URL = 'https://haylinguav2.onrender.com';
// The web app's own static-asset host — preset banner images (e.g.
// "/banners/banner-1.png") are shipped as web frontend assets, not backend
// uploads, so they need a different base than API_BASE_URL to resolve.
const WEB_BASE_URL = 'https://haylingua.am';

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : detail?.message || `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const token = auth ? await getToken() : null;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? data);
  return data;
}

// Multipart upload (avatar/banner) — deliberately bypasses request()'s JSON
// Content-Type so fetch can set its own multipart boundary, same pattern as
// transcribeAudio.js's upload call.
async function upload(path, formData) {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.detail ?? data);
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload,
};

// The backend returns uploaded-image URLs as backend-relative paths
// (e.g. "/static/avatars/u3_abc.png"), same as the web app — resolve them
// to an absolute URL before handing to <Image>. OAuth-provided avatar URLs
// (Google/Facebook) are already absolute and pass through unchanged.
export function resolveUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('data:')) return s;
  // Preset banners ("/banners/banner-N.png") are web frontend assets;
  // everything else relative ("/static/avatars/...", "/static/banners/...")
  // is a backend upload.
  if (s.startsWith('/banners/')) return `${WEB_BASE_URL}${s}`;
  if (s.startsWith('/')) return `${API_BASE_URL}${s}`;
  return s;
}
