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
  const seedSounds = () => req("/cms/seed/sounds", { method: "POST" });

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

  // Item definitions (marketplace: frames, name tags, avatar-builder unlocks)
  const listItemDefinitions = (category) => req(`/cms/item-definitions${category ? `?category=${encodeURIComponent(category)}` : ""}`);
  const createItemDefinition = (payload) => req("/cms/item-definitions", { method: "POST", body: JSON.stringify(payload) });
  const updateItemDefinition = (id, payload) => req(`/cms/item-definitions/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteItemDefinition = (id) => req(`/cms/item-definitions/${id}`, { method: "DELETE" });
  const reorderItemDefinitions = (order) => req("/cms/item-definitions/reorder", { method: "POST", body: JSON.stringify({ order }) });

  // Premium pricing plans
  const listPremiumPlans = () => req("/cms/premium-plans");
  const createPremiumPlan = (payload) => req("/cms/premium-plans", { method: "POST", body: JSON.stringify(payload) });
  const updatePremiumPlan = (id, payload) => req(`/cms/premium-plans/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deletePremiumPlan = (id) => req(`/cms/premium-plans/${id}`, { method: "DELETE" });
  const reorderPremiumPlans = (order) => req("/cms/premium-plans/reorder", { method: "POST", body: JSON.stringify({ order }) });
  const getChestConfig = () => req("/cms/shop/chest");
  const setChestConfig = (rewards, rarities) => req("/cms/shop/chest", { method: "PUT", body: JSON.stringify({ rewards, rarities }) });

  // Affiliate program
  const listAffiliates = () => req("/cms/affiliates");
  const getAffiliatesAnalytics = () => req("/cms/affiliates/analytics");
  const approveAffiliate = (id) => req(`/cms/affiliates/${id}/approve`, { method: "POST" });
  const updateAffiliate = (id, payload) => req(`/cms/affiliates/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const listAffiliateReferrals = (id) => req(`/cms/affiliates/${id}/referrals`);
  const markReferralPaid = (referralId) => req(`/cms/affiliate-referrals/${referralId}/mark-paid`, { method: "POST" });

  // Careers: job vacancies
  const listVacancies = () => req("/cms/vacancies");
  const createVacancy = (payload) => req("/cms/vacancies", { method: "POST", body: JSON.stringify(payload) });
  const updateVacancy = (id, payload) => req(`/cms/vacancies/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteVacancy = (id) => req(`/cms/vacancies/${id}`, { method: "DELETE" });
  const reorderVacancies = (order) => req("/cms/vacancies/reorder", { method: "POST", body: JSON.stringify({ order }) });

  // Adventures: language overrides (map of adventureId -> override blob)
  const listAdventureOverrides = () => req("/cms/adventures");
  const saveAdventureOverride = (id, data) => req(`/cms/adventures/${id}`, { method: "PUT", body: JSON.stringify(data) });
  const resetAdventureOverride = (id) => req(`/cms/adventures/${id}`, { method: "DELETE" });
  // Fully CMS-authored adventures (the no-code builder).
  const listCustomAdventures = () => req("/cms/custom-adventures");
  const saveCustomAdventure = (id, data, published) => req(`/cms/custom-adventures/${id}`, { method: "PUT", body: JSON.stringify({ data, published }) });
  const deleteCustomAdventure = (id) => req(`/cms/custom-adventures/${id}`, { method: "DELETE" });

  // Careers: application form fields
  const listVacancyFields = (vacancyId) => req(`/cms/vacancies/${vacancyId}/fields`);
  const createVacancyField = (vacancyId, payload) => req(`/cms/vacancies/${vacancyId}/fields`, { method: "POST", body: JSON.stringify(payload) });
  const updateVacancyField = (fieldId, payload) => req(`/cms/vacancy-fields/${fieldId}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteVacancyField = (fieldId) => req(`/cms/vacancy-fields/${fieldId}`, { method: "DELETE" });
  const reorderVacancyFields = (vacancyId, order) => req(`/cms/vacancies/${vacancyId}/fields/reorder`, { method: "POST", body: JSON.stringify({ order }) });

  // Careers: applications
  const listApplications = (vacancyId) => req(`/cms/vacancies/${vacancyId}/applications`);
  const getApplication = (id) => req(`/cms/applications/${id}`);
  const updateApplicationStatus = (id, status) => req(`/cms/applications/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
  // Downloads need the Bearer token, which a plain <a href> can't send — fetch
  // as a blob and trigger the save via a temporary object URL instead.
  const downloadApplicationFile = async (applicationId, kind, filename) => {
    const res = await fetch(`${API_BASE}/cms/applications/${applicationId}/files/${kind}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Community forum
  const listForumCategories = () => req("/cms/forum/categories");
  const createForumCategory = (payload) => req("/cms/forum/categories", { method: "POST", body: JSON.stringify(payload) });
  const updateForumCategory = (id, payload) => req(`/cms/forum/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteForumCategory = (id) => req(`/cms/forum/categories/${id}`, { method: "DELETE" });
  const reorderForumCategories = (order) => req("/cms/forum/categories/reorder", { method: "POST", body: JSON.stringify({ order }) });
  const listForumThreadsAdmin = (categoryId) => req(`/cms/forum/threads${categoryId ? `?category_id=${categoryId}` : ""}`);
  const updateForumThread = (id, payload) => req(`/cms/forum/threads/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteForumThread = (id) => req(`/cms/forum/threads/${id}`, { method: "DELETE" });
  const listForumThreadPosts = (threadId) => req(`/cms/forum/threads/${threadId}/posts`);
  const deleteForumPost = (id) => req(`/cms/forum/posts/${id}`, { method: "DELETE" });

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
  const generateExercises = (topic, kinds, count) =>
    req("/cms/ai/generate-exercises", {
      method: "POST",
      body: JSON.stringify({ topic, kinds, count }),
    });
  const bulkImportLessons = (rows) =>
    req("/cms/lessons/bulk-import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
  const getLessonExerciseStats = (lessonId) => req(`/cms/lessons/${lessonId}/exercise-stats`);
  const getLessonPreviewLink = (lessonId) =>
    req(`/cms/lessons/${lessonId}/preview-link`, { method: "POST" });

  // Options
  const listOptions = (exerciseId) => req(`/cms/exercises/${exerciseId}/options`);
  const createOption = (payload) =>
    req("/cms/options", { method: "POST", body: JSON.stringify(payload) });
  const updateOption = (optionId, payload) =>
    req(`/cms/options/${optionId}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteOption = (optionId) =>
    req(`/cms/options/${optionId}`, { method: "DELETE" });

  // Team / invites
  // Voice Lab
  const listVoices = () => req("/cms/voices");

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

  // Repetitive-mistake exercises (auto-disabled)
  const listRepetitiveMistakes = () => req("/cms/exercises/repetitive-mistakes");
  const restoreExercise = (exerciseId) =>
    req(`/cms/exercises/${exerciseId}/restore`, { method: "POST" });

  return {
    getAccount,
    updateAccount,
    listRepetitiveMistakes,
    restoreExercise,
    changePassword,
    changeEmail,
    disable2FA,
    listChapters,
    createChapter,
    updateChapter,
    deleteChapter,
    reorderChapters,
    seedCurriculum,
    seedSounds,
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
    listItemDefinitions,
    createItemDefinition,
    updateItemDefinition,
    deleteItemDefinition,
    reorderItemDefinitions,
    listPremiumPlans,
    createPremiumPlan,
    updatePremiumPlan,
    deletePremiumPlan,
    reorderPremiumPlans,
    getChestConfig,
    setChestConfig,
    listVacancies,
    createVacancy,
    updateVacancy,
    deleteVacancy,
    reorderVacancies,
    listAdventureOverrides,
    saveAdventureOverride,
    resetAdventureOverride,
    listCustomAdventures,
    saveCustomAdventure,
    deleteCustomAdventure,
    listAffiliates,
    getAffiliatesAnalytics,
    approveAffiliate,
    updateAffiliate,
    listAffiliateReferrals,
    markReferralPaid,
    listVacancyFields,
    createVacancyField,
    updateVacancyField,
    deleteVacancyField,
    reorderVacancyFields,
    listApplications,
    getApplication,
    updateApplicationStatus,
    downloadApplicationFile,
    listForumCategories,
    createForumCategory,
    updateForumCategory,
    deleteForumCategory,
    reorderForumCategories,
    listForumThreadsAdmin,
    updateForumThread,
    deleteForumThread,
    listForumThreadPosts,
    deleteForumPost,
    listExercises,
    reorderExercises,
    getExercise,
    createExercise,
    updateExercise,
    deleteExercise,
    generateExercises,
    bulkImportLessons,
    getLessonExerciseStats,
    getLessonPreviewLink,
    listOptions,
    createOption,
    updateOption,
    deleteOption,
    listTeam,
    inviteTeam,
    listVoices,
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
