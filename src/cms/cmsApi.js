// src/cms/cmsApi.js
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

async function reqCms(cmsKey, path, opts = {}) {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      "X-CMS-Token": cmsKey, // ✅ REQUIRED by your backend
      ...(opts.headers || {}),
    },
    body: opts.body,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && data.detail) ||
      (typeof data === "string" ? data : `Request failed (${res.status})`);
    throw new Error(msg);
  }

  return data;
}

// LESSONS
export function cmsListLessons(cmsKey) {
  return reqCms(cmsKey, "/cms/lessons");
}
export function cmsGetLesson(cmsKey, id) {
  return reqCms(cmsKey, `/cms/lessons/${id}`);
}
export function cmsCreateLesson(cmsKey, payload) {
  return reqCms(cmsKey, "/cms/lessons", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function cmsUpdateLesson(cmsKey, id, payload) {
  return reqCms(cmsKey, `/cms/lessons/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function cmsDeleteLesson(cmsKey, id) {
  return reqCms(cmsKey, `/cms/lessons/${id}`, { method: "DELETE" });
}

// EXERCISES
export function cmsListExercises(cmsKey, lessonId) {
  return reqCms(cmsKey, `/cms/lessons/${lessonId}/exercises`);
}

// ✅ Your backend creates exercise via POST /cms/exercises with lesson_id in body
export function cmsCreateExercise(cmsKey, lessonId, payload) {
  return reqCms(cmsKey, "/cms/exercises", {
    method: "POST",
    body: JSON.stringify({ ...payload, lesson_id: Number(lessonId) }),
  });
}

export function cmsUpdateExercise(cmsKey, exerciseId, payload) {
  return reqCms(cmsKey, `/cms/exercises/${exerciseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function cmsDeleteExercise(cmsKey, exerciseId) {
  return reqCms(cmsKey, `/cms/exercises/${exerciseId}`, { method: "DELETE" });
}
