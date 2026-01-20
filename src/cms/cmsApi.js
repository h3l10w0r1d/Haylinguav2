// src/cms/cmsApi.js
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

async function req(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const msg = (data && data.detail) || (typeof data === "string" ? data : "Request failed");
    throw new Error(msg);
  }
  return data;
}

// LESSONS
export const cmsListLessons = () => req("/cms/lessons");
export const cmsGetLesson = (id) => req(`/cms/lessons/${id}`);
export const cmsCreateLesson = (payload) =>
  req("/cms/lessons", { method: "POST", body: JSON.stringify(payload) });
export const cmsUpdateLesson = (id, payload) =>
  req(`/cms/lessons/${id}`, { method: "PUT", body: JSON.stringify(payload) });
export const cmsDeleteLesson = (id) =>
  req(`/cms/lessons/${id}`, { method: "DELETE" });

// EXERCISES
export const cmsListExercises = (lessonId) => req(`/cms/lessons/${lessonId}/exercises`);
export const cmsCreateExercise = (lessonId, payload) =>
  req(`/cms/lessons/${lessonId}/exercises`, { method: "POST", body: JSON.stringify(payload) });
export const cmsUpdateExercise = (exerciseId, payload) =>
  req(`/cms/exercises/${exerciseId}`, { method: "PUT", body: JSON.stringify(payload) });
export const cmsDeleteExercise = (exerciseId) =>
  req(`/cms/exercises/${exerciseId}`, { method: "DELETE" });
