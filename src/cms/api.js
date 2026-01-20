const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

async function req(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }

  if (!res.ok) {
    const msg = json?.detail || json?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export const cmsApi = {
  // Lessons
  listLessons: () => req(`/cms/lessons`, { method: "GET" }),
  getLesson: (id) => req(`/cms/lessons/${id}`, { method: "GET" }),
  createLesson: (payload) => req(`/cms/lessons`, { method: "POST", body: JSON.stringify(payload) }),
  updateLesson: (id, payload) => req(`/cms/lessons/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteLesson: (id) => req(`/cms/lessons/${id}`, { method: "DELETE" }),

  // Exercises
  listExercises: (lessonId) => req(`/cms/lessons/${lessonId}/exercises`, { method: "GET" }),
  createExercise: (lessonId, payload) =>
    req(`/cms/lessons/${lessonId}/exercises`, { method: "POST", body: JSON.stringify(payload) }),
  updateExercise: (exerciseId, payload) =>
    req(`/cms/exercises/${exerciseId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteExercise: (exerciseId) => req(`/cms/exercises/${exerciseId}`, { method: "DELETE" }),
};
