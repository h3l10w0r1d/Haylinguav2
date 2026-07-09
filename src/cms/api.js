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

    // NOTE: Setting "Content-Type: application/json" on GET requests triggers CORS preflight.
    // Some browsers/networks then surface this as a generic "Failed to fetch" even when
    // the backend is reachable. Only set Content-Type when we actually send a JSON body.
    const headers = {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(opts.headers || {}),
    };
    if (opts.body !== undefined && opts.body !== null) {
      // Default to JSON for CMS requests unless caller overrides.
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    }

    let res;
    try {
      res = await fetch(url, {
        method: opts.method || "GET",
        headers,
        body: opts.body,
      });
    } catch (e) {
      // Surface a clearer message to the UI.
      const msg =
        (e && typeof e === "object" && "message" in e && e.message) ||
        "Network error (failed to reach API)";
      throw new Error(String(msg));
    }

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

  // Chapters
  const listChapters = () => req("/cms/chapters");
  const createChapter = (payload) =>
    req("/cms/chapters", { method: "POST", body: JSON.stringify(payload) });
  const updateChapter = (chapterId, payload) =>
    req(`/cms/chapters/${chapterId}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteChapter = (chapterId) =>
    req(`/cms/chapters/${chapterId}`, { method: "DELETE" });
  const reorderChapters = (order) =>
    req("/cms/chapters/reorder", { method: "POST", body: JSON.stringify({ order }) });
  const seedCurriculum = () => req("/cms/seed/curriculum", { method: "POST" });

  // Lessons
  const listLessons = () => req("/cms/lessons");
  const getLesson = (lessonId) => req(`/cms/lessons/${lessonId}`);
  const createLesson = (payload) =>
    req("/cms/lessons", { method: "POST", body: JSON.stringify(payload) });
  const updateLesson = (lessonId, payload) =>
    req(`/cms/lessons/${lessonId}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteLesson = (lessonId) =>
    req(`/cms/lessons/${lessonId}`, { method: "DELETE" });

  // Achievements (CMS builder)
  const listAchievements = () => req("/cms/achievements");
  const createAchievement = (payload) =>
    req("/cms/achievements", { method: "POST", body: JSON.stringify(payload) });
  const updateAchievement = (id, payload) =>
    req(`/cms/achievements/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteAchievement = (id) =>
    req(`/cms/achievements/${id}`, { method: "DELETE" });
  const reorderAchievements = (order) =>
    req("/cms/achievements/reorder", { method: "POST", body: JSON.stringify({ order }) });

  // Email diagnostics
  const emailStatus = () => req("/cms/email/status");
  const sendTestEmail = (to) => req("/cms/email/test", { method: "POST", body: JSON.stringify({ to }) });

  // Shop & economy
  const listShopItems = () => req("/cms/shop/items");
  const createShopItem = (payload) => req("/cms/shop/items", { method: "POST", body: JSON.stringify(payload) });
  const updateShopItem = (id, payload) => req(`/cms/shop/items/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteShopItem = (id) => req(`/cms/shop/items/${id}`, { method: "DELETE" });
  const reorderShopItems = (order) => req("/cms/shop/items/reorder", { method: "POST", body: JSON.stringify({ order }) });
  const getChestConfig = () => req("/cms/shop/chest");
  const setChestConfig = (rewards, rarities) => req("/cms/shop/chest", { method: "PUT", body: JSON.stringify({ rewards, rarities }) });

  // Exercises
  const listExercises = (lessonId) => req(`/cms/lessons/${lessonId}/exercises`);
  const reorderExercises = (order) =>
    req("/cms/exercises/reorder", { method: "POST", body: JSON.stringify({ order }) });
  const getExercise = (exerciseId) => req(`/cms/exercises/${exerciseId}`);
  // Backwards/forwards compatible:
  // - Some callers use createExercise(payload)
  // - ExerciseEditor uses createExercise(lessonId, payload)
  // Ensure lesson_id is always present.
  const createExercise = (lessonIdOrPayload, maybePayload) => {
    const payload = maybePayload ?? lessonIdOrPayload;
    const lessonId = maybePayload !== undefined ? Number(lessonIdOrPayload) : null;
    const finalPayload = {
      ...(payload || {}),
      ...(lessonId !== null && !Number.isNaN(lessonId) ? { lesson_id: lessonId } : {}),
    };
    return req("/cms/exercises", {
      method: "POST",
      body: JSON.stringify(finalPayload),
    });
  };
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

  // Account management
  const getAccount = () => req("/cms/account");
  const updateAccount = (display_name, timezone) =>
    req("/cms/account", { method: "PUT", body: JSON.stringify({ display_name, timezone }) });
  const changePassword = (current_password, new_password) =>
    req("/cms/account/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) });
  const changeEmail = (new_email, password) =>
    req("/cms/account/change-email", { method: "POST", body: JSON.stringify({ new_email, password }) });
  const disable2FA = (code) =>
    req("/cms/account/2fa/disable", { method: "POST", body: JSON.stringify({ code }) });

  return {
    getAccount,
    updateAccount,
    changePassword,
    changeEmail,
    disable2FA,
    listChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    reorderChapters,
    seedCurriculum,
    listLessons,
    getLesson,
    createLesson,
    updateLesson,
    deleteLesson,
    listAchievements,
    createAchievement,
    updateAchievement,
    deleteAchievement,
    reorderAchievements,
    emailStatus,
    sendTestEmail,
    listShopItems,
    createShopItem,
    updateShopItem,
    deleteShopItem,
    reorderShopItems,
    getChestConfig,
    setChestConfig,
    listExercises,
    reorderExercises,
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
