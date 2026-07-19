// src/lib/api.js — fetch wrapper for the real Haylingua backend.
// Mirrors the web app's pattern (see src/Dashboard.jsx): same API_BASE_URL,
// same `Authorization: Bearer <token>` header. No SDK, just fetch.
import { getToken } from './authStore';

export const API_BASE_URL = 'https://haylinguav2.onrender.com';

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

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
};
