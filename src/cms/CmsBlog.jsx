// src/cms/CmsBlog.jsx — authoring UI for the first-party blog (blog_posts
// table). Separate from blog.haylingua.am (external, Ghost-hosted, not
// managed here). Structurally mirrors CmsItems.jsx: token/api-client setup,
// a "new post" creation form, and a list of existing posts each editable
// inline with a Save/Delete pair.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import CmsLayout from "./CmsLayout";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";
const textareaCls = inputCls + " resize-y";

const emptyDraft = () => ({
  slug: "", title: "", meta_description: "", excerpt: "", body_markdown: "",
  cover_image_url: "", author_name: "Haylingua", tagsText: "", is_published: false,
});

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CmsBlog() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [posts, setPosts] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const res = await api.listBlogPosts();
    const list = Array.isArray(res?.posts) ? res.posts : [];
    setPosts(list);
    const e = {};
    list.forEach((p) => {
      e[p.id] = {
        slug: p.slug || "", title: p.title || "", meta_description: p.meta_description || "",
        excerpt: p.excerpt || "", cover_image_url: p.cover_image_url || "",
        author_name: p.author_name || "Haylingua",
        tagsText: Array.isArray(p.tags) ? p.tags.join(", ") : "",
        is_published: !!p.is_published,
        body_markdown: null, // lazy-loaded on first edit of the body field
      };
    });
    setEdits(e);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load posts", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  function patch(id, p) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  async function loadBody(id) {
    if (edits[id]?.body_markdown != null) return;
    const full = await api.getBlogPost(id);
    patch(id, { body_markdown: full.body_markdown || "" });
  }

  async function createPost() {
    const slug = draft.slug.trim() || slugify(draft.title);
    if (!slug || !draft.title.trim()) return;
    setBusy(true);
    try {
      await api.createBlogPost({
        slug, title: draft.title.trim(),
        meta_description: draft.meta_description.trim() || null,
        excerpt: draft.excerpt.trim() || null,
        body_markdown: draft.body_markdown,
        cover_image_url: draft.cover_image_url.trim() || null,
        author_name: draft.author_name.trim() || "Haylingua",
        tags: draft.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        is_published: draft.is_published,
      });
      setDraft(emptyDraft());
      await refresh();
      showToast("Post created");
    } catch (err) {
      showToast(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function savePost(p) {
    const e = edits[p.id] || {};
    setBusy(true);
    try {
      const payload = {
        slug: e.slug, title: e.title, meta_description: e.meta_description || null,
        excerpt: e.excerpt || null, cover_image_url: e.cover_image_url || null,
        author_name: e.author_name || "Haylingua",
        tags: (e.tagsText || "").split(",").map((t) => t.trim()).filter(Boolean),
        is_published: !!e.is_published,
      };
      if (e.body_markdown != null) payload.body_markdown = e.body_markdown;
      await api.updateBlogPost(p.id, payload);
      await refresh();
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function togglePost(p) {
    setBusy(true);
    try {
      await api.updateBlogPost(p.id, { is_published: !p.is_published });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removePost(p) {
    if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteBlogPost(p.id);
      await refresh();
      showToast("Deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CmsLayout active="blog" title="Blog">
      <div className="space-y-6">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          This is Haylingua's first-party blog at /blog — separate from the external
          blog.haylingua.am (Ghost). Body is Markdown. Publishing sets the article's
          publish date once and never resets it on later edits.
        </div>

        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 font-display text-base font-bold text-slate-900">New post</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" className={inputCls} />
            <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="Slug (auto from title if blank)" className={inputCls} />
            <input value={draft.meta_description} onChange={(e) => setDraft({ ...draft, meta_description: e.target.value })} placeholder="Meta description (for search results)" className={cx(inputCls, "sm:col-span-2")} />
            <input value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} placeholder="Excerpt (shown on the blog listing)" className={cx(inputCls, "sm:col-span-2")} />
            <input value={draft.cover_image_url} onChange={(e) => setDraft({ ...draft, cover_image_url: e.target.value })} placeholder="Cover image URL (optional)" className={inputCls} />
            <input value={draft.tagsText} onChange={(e) => setDraft({ ...draft, tagsText: e.target.value })} placeholder="Tags, comma-separated" className={inputCls} />
          </div>
          <textarea
            value={draft.body_markdown}
            onChange={(e) => setDraft({ ...draft, body_markdown: e.target.value })}
            placeholder="Body (Markdown)"
            rows={10}
            className={cx(textareaCls, "mt-3 font-mono text-xs")}
          />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 ring-2 ring-slate-200">
              <input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />
              Publish immediately
            </label>
            <button
              type="button"
              onClick={createPost}
              disabled={busy || !draft.title.trim()}
              className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>
        </section>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">No posts yet.</div>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => {
              const e = edits[p.id] || {};
              return (
                <div key={p.id} className={cx("rounded-3xl bg-white p-4 ring-1 shadow-sm", p.is_published ? "ring-slate-200" : "ring-slate-200 opacity-80")}>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input value={e.title || ""} onChange={(ev) => patch(p.id, { title: ev.target.value })} className={cx(inputCls, "!py-2 font-bold")} placeholder="Title" />
                      <input value={e.slug || ""} onChange={(ev) => patch(p.id, { slug: ev.target.value })} className={cx(inputCls, "!py-2 text-xs")} title="Slug" />
                      <input value={e.author_name || ""} onChange={(ev) => patch(p.id, { author_name: ev.target.value })} className={cx(inputCls, "!py-2 text-xs")} title="Author" />
                    </div>
                    <input value={e.meta_description || ""} onChange={(ev) => patch(p.id, { meta_description: ev.target.value })} placeholder="Meta description" className={cx(inputCls, "!py-2 text-xs")} />
                    <input value={e.excerpt || ""} onChange={(ev) => patch(p.id, { excerpt: ev.target.value })} placeholder="Excerpt" className={cx(inputCls, "!py-2 text-xs")} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input value={e.cover_image_url || ""} onChange={(ev) => patch(p.id, { cover_image_url: ev.target.value })} placeholder="Cover image URL" className={cx(inputCls, "!py-2 text-xs")} />
                      <input value={e.tagsText || ""} onChange={(ev) => patch(p.id, { tagsText: ev.target.value })} placeholder="Tags, comma-separated" className={cx(inputCls, "!py-2 text-xs")} />
                    </div>
                    <textarea
                      value={e.body_markdown ?? ""}
                      onFocus={() => loadBody(p.id)}
                      onChange={(ev) => patch(p.id, { body_markdown: ev.target.value })}
                      placeholder={e.body_markdown == null ? "Click to load body…" : "Body (Markdown)"}
                      rows={8}
                      className={cx(textareaCls, "font-mono text-xs")}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => togglePost(p)}
                          disabled={busy}
                          className={cx(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                            p.is_published ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200"
                          )}
                        >
                          {p.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          {p.is_published ? "Published" : "Draft"}
                        </button>
                        {p.is_published && (
                          <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" /> View live
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => savePost(p)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                        <button type="button" onClick={() => removePost(p)} disabled={busy} className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className={cx("rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-1", toast.kind === "err" ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200" : "bg-grass-50 text-grass-700 ring-grass-200")}>
            {toast.msg}
          </div>
        </div>
      )}
    </CmsLayout>
  );
}
