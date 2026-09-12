// src/cms/api.js

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export function getCmsToken() {
  return localStorage.getItem("hay_cms_token") || "";
}

// Reads a non-secret claim out of the CMS access token without a JWT
// library — we only ever read a claim already set by the server, never
// verify the signature client-side (the backend does that on every
// request). Used to gate CRM UI (Save/Delete/etc.) by crm_role without an
// extra round trip; the real enforcement is server-side
// (routes_automations.require_crm_editor) regardless of what this reads.
export function getCmsClaim(name, fallback = null) {
  const token = getCmsToken();
  if (!token) return fallback;
  try {
    const payloadB64 = token.split(".")[1];
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return payload[name] ?? fallback;
  } catch {
    return fallback;
  }
}

// Optional hook fired by req() on a 401 before it throws — the CMS auth gate
// (src/cms/CmsRequireAuth.jsx) registers a handler that clears the stale
// token and bounces to /cms/login, so an expired session redirects instead
// of every page showing "Request failed (401)". Null by default, so callers
// that never register one (e.g. the CRM pages) keep today's behavior.
export let onCmsUnauthorized = null;
export function setCmsUnauthorizedHandler(fn) {
  onCmsUnauthorized = typeof fn === "function" ? fn : null;
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
      if (res.status === 401 && onCmsUnauthorized) {
        try { onCmsUnauthorized(); } catch {}
      }
      const msg =
        (data && data.detail) ||
        (typeof data === "string" ? data : `Request failed (${res.status})`);
      throw new Error(msg);
    }

    return data;
  }

  // Builds "?a=1&b=x" from an object, dropping empty/undefined values — so
  // callers can pass a sparse options object and old zero-arg call sites keep
  // producing the same bare URL they always did.
  const qs = (o) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) {
      if (v === undefined || v === null || v === "") continue;
      p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

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

  // Blog (first-party — separate from blog.haylingua.am)
  // Bypasses req() deliberately: a multipart upload must NOT carry a
  // Content-Type header set by us — the browser sets it (with the correct
  // boundary) when the body is a FormData instance, and req() always
  // defaults to application/json whenever a body is present.
  const uploadBlogImage = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/cms/blog/upload-image`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.detail) || "Upload failed");
    return data;
  };
  const seedBlogPosts = () => req("/cms/seed/blog-posts", { method: "POST" });
  // listBlogPosts(locale) still works; the options object adds server-side
  // paging/search/status filtering (see GET /cms/blog in routes_cms.py).
  // Response: { posts, total, page, page_size }.
  const listBlogPosts = (locale, { page, pageSize, q, status } = {}) =>
    req(`/cms/blog${qs({ locale, q, status, page, page_size: pageSize })}`);
  const getBlogPost = (id) => req(`/cms/blog/${id}`);
  const createBlogPost = (payload) => req("/cms/blog", { method: "POST", body: JSON.stringify(payload) });
  const updateBlogPost = (id, payload) => req(`/cms/blog/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteBlogPost = (id) => req(`/cms/blog/${id}`, { method: "DELETE" });

  // Premium pricing plans
  const listPremiumPlans = () => req("/cms/premium-plans");
  const createPremiumPlan = (payload) => req("/cms/premium-plans", { method: "POST", body: JSON.stringify(payload) });
  const updatePremiumPlan = (id, payload) => req(`/cms/premium-plans/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deletePremiumPlan = (id) => req(`/cms/premium-plans/${id}`, { method: "DELETE" });
  const reorderPremiumPlans = (order) => req("/cms/premium-plans/reorder", { method: "POST", body: JSON.stringify({ order }) });
  const getChestConfig = () => req("/cms/shop/chest");
  const setChestConfig = (rewards, rarities) => req("/cms/shop/chest", { method: "PUT", body: JSON.stringify({ rewards, rarities }) });

  // Affiliate program
  // All four take an optional trailing options object for server-side
  // paging/filtering; the old positional call forms still work.
  // Responses: {affiliates|referrals|applications|threads, total, page, page_size}.
  const listAffiliates = ({ page, pageSize, q, status } = {}) =>
    req(`/cms/affiliates${qs({ q, status, page, page_size: pageSize })}`);
  const getAffiliatesAnalytics = () => req("/cms/affiliates/analytics");
  const approveAffiliate = (id) => req(`/cms/affiliates/${id}/approve`, { method: "POST" });
  const updateAffiliate = (id, payload) => req(`/cms/affiliates/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const listAffiliateReferrals = (id, { page, pageSize } = {}) =>
    req(`/cms/affiliates/${id}/referrals${qs({ page, page_size: pageSize })}`);
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
  const listApplications = (vacancyId, { page, pageSize, q, status } = {}) =>
    req(`/cms/vacancies/${vacancyId}/applications${qs({ q, status, page, page_size: pageSize })}`);
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

  // Learner support panel. These replace the private fetch helper
  // CmsSupport.jsx used to carry — which sent Content-Type on GETs (the
  // CORS-preflight footgun documented in req() above) and couldn't take
  // part in the shared 401 handling.
  // searchSupportUsers/listSupportReports return {users|reports, total, page, page_size}.
  const searchSupportUsers = ({ q, page, pageSize } = {}) =>
    req(`/cms/support/users${qs({ q, page, page_size: pageSize })}`);
  const getSupportUser = (userId) => req(`/cms/support/users/${userId}`);
  const listSupportReports = ({ status = "open", page, pageSize } = {}) =>
    req(`/cms/support/reports${qs({ status, page, page_size: pageSize })}`);
  const resolveSupportReport = (reportId) =>
    req(`/cms/support/reports/${reportId}/resolve`, { method: "POST" });
  // One of the fixed support actions below, POSTed for a single learner:
  // premium | hearts-refill | restore-last-streak | restore-max-streak |
  // verify-email | grant-bonus.
  const listUserNotes = (userId) => req(`/cms/support/users/${userId}/notes`);
  const addUserNote = (userId, body) =>
    req(`/cms/support/users/${userId}/notes`, { method: "POST", body: JSON.stringify({ body }) });
  const deleteUserNote = (userId, noteId) =>
    req(`/cms/support/users/${userId}/notes/${noteId}`, { method: "DELETE" });
  const supportUserAction = (userId, action, payload) =>
    req(`/cms/support/users/${userId}/${action}`, {
      method: "POST",
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    });

  // Community forum
  const listForumCategories = () => req("/cms/forum/categories");
  const createForumCategory = (payload) => req("/cms/forum/categories", { method: "POST", body: JSON.stringify(payload) });
  const updateForumCategory = (id, payload) => req(`/cms/forum/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteForumCategory = (id) => req(`/cms/forum/categories/${id}`, { method: "DELETE" });
  const reorderForumCategories = (order) => req("/cms/forum/categories/reorder", { method: "POST", body: JSON.stringify({ order }) });
  const listForumThreadsAdmin = (categoryId, { page, pageSize, q } = {}) =>
    req(`/cms/forum/threads${qs({ category_id: categoryId, q, page, page_size: pageSize })}`);
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
  const setTeamCrmRole = (id, crmRole) =>
    req(`/cms/team/${id}/crm-role`, { method: "PUT", body: JSON.stringify({ crm_role: crmRole }) });

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

  // Marketing automation: triggered campaigns + segments
  const listAutomations = ({ page, pageSize, q, status } = {}) =>
    req(`/cms/automations${qs({ page, page_size: pageSize, q, status })}`);
  const getAutomation = (id) => req(`/cms/automations/${id}`);
  const createAutomation = (payload) => req("/cms/automations", { method: "POST", body: JSON.stringify(payload) });
  const updateAutomation = (id, payload) => req(`/cms/automations/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteAutomation = (id) => req(`/cms/automations/${id}`, { method: "DELETE" });
  const listAutomationEnrollments = (id, { page = 1, pageSize = 50, status } = {}) =>
    req(`/cms/automations/${id}/enrollments?page=${page}&page_size=${pageSize}${status ? `&status=${encodeURIComponent(status)}` : ""}`);
  const listAutomationSends = (id, { page = 1, pageSize = 50, status } = {}) =>
    req(`/cms/automations/${id}/sends?page=${page}&page_size=${pageSize}${status ? `&status=${encodeURIComponent(status)}` : ""}`);
  const testRunAutomation = (id, userId, force = false) =>
    req(`/cms/automations/${id}/test-run`, { method: "POST", body: JSON.stringify({ user_id: userId, force }) });
  const getAutomationStepStats = (id) => req(`/cms/automations/${id}/step-stats`);
  const getAutomationAnalytics = (id) => req(`/cms/automations/${id}/analytics`);
  const listUserEnrollments = (userId) => req(`/cms/automations/enrollments/by-user/${userId}`);
  const exitEnrollment = (enrollmentId) => req(`/cms/automations/enrollments/${enrollmentId}/exit`, { method: "POST" });
  const sendNowAutomation = (id) => req(`/cms/automations/${id}/send-now`, { method: "POST" });
  const listSegments = () => req("/cms/segments");
  const getSegment = (id) => req(`/cms/segments/${id}`);
  const createSegment = (payload) => req("/cms/segments", { method: "POST", body: JSON.stringify(payload) });
  const updateSegment = (id, payload) => req(`/cms/segments/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteSegment = (id) => req(`/cms/segments/${id}`, { method: "DELETE" });
  const listEmailTemplates = () => req("/cms/email-templates");
  const createEmailTemplate = (payload) => req("/cms/email-templates", { method: "POST", body: JSON.stringify(payload) });
  const updateEmailTemplate = (id, payload) => req(`/cms/email-templates/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  const deleteEmailTemplate = (id) => req(`/cms/email-templates/${id}`, { method: "DELETE" });
  const previewSegmentCount = (id) => req(`/cms/segments/${id}/preview-count`);

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
    uploadBlogImage,
    seedBlogPosts,
    listBlogPosts,
    getBlogPost,
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
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
    searchSupportUsers,
    getSupportUser,
    listSupportReports,
    resolveSupportReport,
    supportUserAction,
    listUserNotes,
    addUserNote,
    deleteUserNote,
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
    setTeamCrmRole,
    listVoices,
    listAutomations,
    getAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    listAutomationEnrollments,
    listAutomationSends,
    testRunAutomation,
    getAutomationStepStats,
    getAutomationAnalytics,
    listUserEnrollments,
    exitEnrollment,
    sendNowAutomation,
    listSegments,
    getSegment,
    createSegment,
    updateSegment,
    deleteSegment,
    listEmailTemplates,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    previewSegmentCount,
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
