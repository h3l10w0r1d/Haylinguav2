// Thin fetch wrapper: auto-refreshes JWT on 401, retries once.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return localStorage.getItem("hay_token") || localStorage.getItem("access_token") || "";
}

function setToken(token) {
  localStorage.setItem("hay_token", token);
  localStorage.setItem("access_token", token);
}

async function tryRefresh() {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.access_token) {
      setToken(data.access_token);
      return true;
    }
  } catch {
    // network error — don't redirect
  }
  return false;
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
      });
    } else {
      // Refresh failed — clear session and redirect to home
      localStorage.removeItem("hay_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("hay_user");
      window.location.replace("/");
      return res;
    }
  }

  return res;
}
