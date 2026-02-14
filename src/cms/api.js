// src/cms/api.js

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export function getCmsToken() {
  return localStorage.getItem("hay_cms_token") || "";
}

/**
 * Create a CMS API client bound to a CMS access token.
 * Backend expects: Authorization: Bearer <token>
 */
export function createCmsApi(accessToken) {
  async function req(path, opts = {}) {
    const url = `${API_BASE}${path}`;

    const res = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
  const getExercise = (exerciseId) => req(`/cms/exercises/${exerciseId}`);
  const createExercise = (payload) =>
    req("/cms/exercises", { method: "POST", body: JSON.stringify(payload) });
  const updateExercise = (exerciseId, payload) =>
    req(`/cms/exercises/${exerciseId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  const deleteExercise = (exerciseId) =>
    req(`/cms/exercises/${exerciseId}`, { method: "DELETE" });

  // Options
  const listOptions = (exerciseId) => req(`/cms/exercises/${exerciseId}/options`);
  const createOption = (payload) =>
    req("/cms/options", { method: "POST", body: JSON.stringify(payload) });
  const updateOption = (optionId, payload) =>
    req(`/cms/options/${optionId}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteOption = (optionId) =>
    req(`/cms/options/${optionId}`, { method: "DELETE" });

  // Team / invites
  const listTeam = () => req("/cms/team");
  const inviteTeam = (email) =>
    req("/cms/team/invite", { method: "POST", body: JSON.stringify({ email }) });

  return {
    listLessons,
    getLesson,
    createLesson,
    updateLesson,
    deleteLesson,
    listExercises,
    getExercise,
    createExercise,
    updateExercise,
    deleteExercise,
    listOptions,
    createOption,
    updateOption,
    deleteOption,
    listTeam,
    inviteTeam,
  };
}

/**
 * Shared singleton client (so other components can just import cmsApi).
 * CmsShell must call setCmsApiClient(createCmsApi(token)).
 */
export let cmsApi = null;

export function setCmsApiClient(client) {
  cmsApi = client;
}
