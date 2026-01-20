// src/cms/api.js

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

/**
 * Create a CMS API client bound to a token (cmsKey).
 * Backend expects: X-CMS-Token: <token>
 */
export function createCmsApi(cmsKey) {
  async function req(path, opts = {}) {
    const url = `${API_BASE}${path}`;

    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "X-CMS-Token": cmsKey,
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

  // Lessons
  const listLessons = () => req("/cms/lessons");
  const getLesson = (lessonId) => req(`/cms/lessons/${lessonId}`);
  const createLesson = (payload) =>
    req("/cms/lessons", { method: "POST", body: JSON.stringify(payload) });
  const updateLesson = (lessonId, payload) =>
    req(`/cms/lessons/${lessonId}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteLesson = (lessonId) =>
    req(`/cms/lessons/${lessonId}`, { method: "DELETE" });

  // Exercises
  const listExercises = (lessonId) => req(`/cms/lessons/${lessonId}/exercises`);

  // IMPORTANT: create goes to /cms/exercises with lesson_id in body
  const createExercise = (lessonId, payload) =>
    req("/cms/exercises", {
      method: "POST",
      body: JSON.stringify({ ...payload, lesson_id: Number(lessonId) }),
    });

  const updateExercise = (exerciseId, payload) =>
    req(`/cms/exercises/${exerciseId}`, { method: "PUT", body: JSON.stringify(payload) });

  const deleteExercise = (exerciseId) =>
    req(`/cms/exercises/${exerciseId}`, { method: "DELETE" });

  return {
    listLessons,
    getLesson,
    createLesson,
    updateLesson,
    deleteLesson,

    listExercises,
    createExercise,
    updateExercise,
    deleteExercise,
  };
}

/**
 * Shared singleton client (so other components can just import cmsApi).
 * CmsShell must call setCmsApiClient(createCmsApi(cmsKey)).
 */
export let cmsApi = null;

export function setCmsApiClient(client) {
  cmsApi = client;
}
