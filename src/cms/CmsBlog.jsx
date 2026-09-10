// src/cms/CmsBlog.jsx — authoring UI for the first-party blog (blog_posts
// table). Separate from blog.haylingua.am (external, Ghost-hosted, not
// managed here). Structurally mirrors CmsItems.jsx: token/api-client setup,
// a "new post" creation form, and a list of existing posts each editable
// inline — both built on the same PostEditor (Markdown toolbar, drag-and-
// drop image upload, alt text, live SEO checklist).
import { useEffect, useMemo, useRef, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, Eye, EyeOff, ExternalLink, ImagePlus, Loader2, CheckCircle2, AlertTriangle, XCircle, Newspaper } from "lucide-react";
import CmsLayout from "./CmsLayout";
import { TOOLBAR_ACTIONS, insertAtCursor, analyzeBlogSeo } from "./markdownEditor";
import {
  Button, EmptyState, ListState, ListToolbar, Note, Pagination, SearchInput, SectionCard,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  cn as cx, inputCls, notify, textareaCls, useConfirm, useListQuery,
} from "./ui";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

const emptyFields = () => ({
  slug: "", title: "", meta_description: "", excerpt: "", body_markdown: "",
  cover_image_url: "", cover_image_alt: "", author_name: "Haylingua", tagsText: "", is_published: false,
  scheduledAt: "", // datetime-local string; blank = publish immediately when is_published is checked
  locale: "en", translation_group: "", // translation_group links locale variants of the same post (keyed by the English slug)
});

// datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's local time; the
// API wants/returns a real ISO timestamp. Both conversions live here so the
// rest of the file just deals with one or the other, never juggling both.
function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const STATUS_ICON = { good: CheckCircle2, warn: AlertTriangle, bad: XCircle };
const STATUS_CLS = {
  good: "text-grass-600",
  warn: "text-gold-600",
  bad: "text-cardinal-600",
};

function SeoChecklist({ fields }) {
  const { checks, score, total } = useMemo(() => analyzeBlogSeo(fields), [fields]);
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">SEO checklist</div>
        <div className="text-xs font-bold text-slate-400">{score}/{total}</div>
      </div>
      <ul className="space-y-1.5">
        {checks.map((c) => {
          const Icon = STATUS_ICON[c.status];
          return (
            <li key={c.id} className="flex items-start gap-2 text-xs">
              <Icon className={cx("mt-0.5 h-3.5 w-3.5 shrink-0", STATUS_CLS[c.status])} />
              <span>
                <span className="font-bold text-slate-700">{c.label}:</span>{" "}
                <span className="text-slate-500">{c.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MarkdownToolbar({ onAction }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-t-2xl border-b border-slate-200 bg-slate-50 p-1.5">
      {TOOLBAR_ACTIONS.map((a) => (
        <button
          key={a.key}
          type="button"
          title={a.title}
          onClick={() => onAction(a)}
          className="grid h-7 w-8 place-items-center rounded-lg text-xs font-extrabold text-slate-600 hover:bg-white hover:shadow-sm"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// One editor, used both for the "New post" form and each existing row's
// inline edit — toolbar + drag-and-drop body image upload + cover image
// upload with alt text + live SEO checklist, all driven off the same
// `fields` shape.
function PostEditor({ fields, onChange, api, onUploadError }) {
  const bodyRef = useRef(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingBody, setUploadingBody] = useState(false);
  const [dragOverBody, setDragOverBody] = useState(false);

  function patch(p) {
    onChange({ ...fields, ...p });
  }

  function applyToolbarAction(action) {
    const el = bodyRef.current;
    if (!el) return;
    const { value, selStart, selEnd } = action.apply(fields.body_markdown || "", el.selectionStart, el.selectionEnd);
    patch({ body_markdown: value });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  async function uploadCoverFile(file) {
    if (!file) return;
    setUploadingCover(true);
    try {
      const { url } = await api.uploadBlogImage(file);
      patch({ cover_image_url: url });
    } catch (err) {
      onUploadError?.(err.message || "Cover image upload failed");
    } finally {
      setUploadingCover(false);
    }
  }

  async function uploadBodyFile(file) {
    if (!file) return;
    setUploadingBody(true);
    try {
      const { url } = await api.uploadBlogImage(file);
      const alt = window.prompt("Alt text for this image (for accessibility & SEO):", "") || "";
      const el = bodyRef.current;
      const md = `![${alt}](${url})`;
      if (el) {
        const { value, selStart, selEnd } = insertAtCursor(fields.body_markdown || "", el.selectionStart, el.selectionEnd, md);
        patch({ body_markdown: value });
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(selStart, selEnd);
        });
      } else {
        patch({ body_markdown: (fields.body_markdown || "") + `\n\n${md}\n` });
      }
    } catch (err) {
      onUploadError?.(err.message || "Image upload failed");
    } finally {
      setUploadingBody(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={fields.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Title" className={cx(inputCls, "font-bold")} />
          <input value={fields.slug} onChange={(e) => patch({ slug: e.target.value })} placeholder="Slug (auto from title if blank)" className={inputCls} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            value={fields.locale || "en"}
            onChange={(e) => patch({ locale: e.target.value })}
            className={inputCls}
            title="Language this post is written in"
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <input
            value={fields.translation_group || ""}
            onChange={(e) => patch({ translation_group: e.target.value })}
            placeholder="Translation group (English slug — links language variants together)"
            className={inputCls}
          />
        </div>
        <input value={fields.meta_description} onChange={(e) => patch({ meta_description: e.target.value })} placeholder="Meta description (for search results)" className={inputCls} />
        <input value={fields.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} placeholder="Excerpt (shown on the blog listing)" className={inputCls} />

        {/* Cover image: upload, or paste a URL directly */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) uploadCoverFile(f);
          }}
          className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-2 ring-dashed ring-slate-200"
        >
          {fields.cover_image_url ? (
            <img src={fields.cover_image_url} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-slate-200 text-slate-400">
              <ImagePlus className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <input value={fields.cover_image_url} onChange={(e) => patch({ cover_image_url: e.target.value })} placeholder="Cover image URL, or drop/choose a file" className={cx(inputCls, "!py-1.5 text-xs")} />
              <label className="shrink-0 cursor-pointer rounded-xl bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                {uploadingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Choose"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => uploadCoverFile(e.target.files?.[0])} />
              </label>
            </div>
            <input value={fields.cover_image_alt} onChange={(e) => patch({ cover_image_alt: e.target.value })} placeholder="Cover image alt text" className={cx(inputCls, "!py-1.5 text-xs")} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input value={fields.author_name} onChange={(e) => patch({ author_name: e.target.value })} placeholder="Author" className={inputCls} />
          <input value={fields.tagsText} onChange={(e) => patch({ tagsText: e.target.value })} placeholder="Tags, comma-separated" className={inputCls} />
        </div>

        <label className="block text-xs font-bold text-slate-500">
          Publish date <span className="font-semibold text-slate-400">— leave blank to publish immediately when checked below</span>
          <input
            type="datetime-local"
            value={fields.scheduledAt}
            onChange={(e) => patch({ scheduledAt: e.target.value })}
            className={cx(inputCls, "mt-1.5 !py-2")}
          />
        </label>

        {/* Body: toolbar + drag-and-drop image upload onto the textarea */}
        <div>
          <MarkdownToolbar onAction={applyToolbarAction} />
          <div
            className="relative"
            onDragOver={(e) => { e.preventDefault(); setDragOverBody(true); }}
            onDragLeave={() => setDragOverBody(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverBody(false);
              const f = e.dataTransfer.files?.[0];
              if (f) uploadBodyFile(f);
            }}
          >
            <textarea
              ref={bodyRef}
              value={fields.body_markdown}
              onChange={(e) => patch({ body_markdown: e.target.value })}
              placeholder="Body (Markdown) — drag an image in to upload it"
              rows={14}
              className={cx(textareaCls, "rounded-t-none font-mono text-xs", dragOverBody && "ring-brand-400")}
            />
            {(dragOverBody || uploadingBody) && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-b-2xl bg-brand-500/10 text-sm font-extrabold text-brand-700">
                {uploadingBody ? <Loader2 className="h-5 w-5 animate-spin" /> : "Drop image to upload"}
              </div>
            )}
          </div>
        </div>
      </div>

      <SeoChecklist fields={fields} />
    </div>
  );
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
  const [loadError, setLoadError] = useState(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [draft, setDraft] = useState(emptyFields());
  const confirm = useConfirm();

  // Paging/search/filters live in the URL, and the list is fetched from the
  // server per page — an English post has a row per locale, so this table
  // grows ~7x faster than the post count.
  const list = useListQuery();
  const localeFilter = list.get("locale") || "";
  const statusFilter = list.get("status") || "all";

  const showToast = notify;

  async function refresh() {
    const res = await api.listBlogPosts(localeFilter, {
      page: list.page,
      pageSize: list.pageSize,
      q: list.q,
      status: statusFilter === "all" ? undefined : statusFilter,
    });
    // NB: not named `list` — that's the useListQuery handle this function
    // reads above, and shadowing it here would be a TDZ ReferenceError.
    const rows = Array.isArray(res?.posts) ? res.posts : [];
    setTotal(Number(res?.total ?? rows.length));
    setPosts(rows);
    const e = {};
    rows.forEach((p) => {
      e[p.id] = {
        slug: p.slug || "", title: p.title || "", meta_description: p.meta_description || "",
        excerpt: p.excerpt || "", cover_image_url: p.cover_image_url || "", cover_image_alt: p.cover_image_alt || "",
        author_name: p.author_name || "Haylingua",
        tagsText: Array.isArray(p.tags) ? p.tags.join(", ") : "",
        is_published: !!p.is_published,
        body_markdown: p.body_markdown || "",
        scheduledAt: isoToLocalInput(p.published_at),
        locale: p.locale || "en", translation_group: p.translation_group || "",
      };
    });
    setEdits(e);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        await refresh();
      } catch (err) {
        setLoadError(err.message || "Failed to load posts");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, localeFilter, statusFilter, list.page, list.pageSize, list.q]);

  async function importPlannedPosts() {
    setSeeding(true);
    try {
      const res = await api.seedBlogPosts();
      await refresh();
      const n = res?.posts_inserted ?? 0;
      showToast(n > 0 ? `Imported ${n} new post${n === 1 ? "" : "s"}` : "Already imported — nothing new to add");
    } catch (err) {
      showToast(err.message || "Import failed", "err");
    } finally {
      setSeeding(false);
    }
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
        cover_image_alt: draft.cover_image_alt.trim() || null,
        author_name: draft.author_name.trim() || "Haylingua",
        tags: draft.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        is_published: draft.is_published,
        published_at: localInputToIso(draft.scheduledAt),
        locale: draft.locale || "en",
        translation_group: draft.translation_group.trim() || null,
      });
      setDraft(emptyFields());
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
      await api.updateBlogPost(p.id, {
        slug: e.slug, title: e.title, meta_description: e.meta_description || null,
        excerpt: e.excerpt || null, body_markdown: e.body_markdown,
        cover_image_url: e.cover_image_url || null, cover_image_alt: e.cover_image_alt || null,
        author_name: e.author_name || "Haylingua",
        tags: (e.tagsText || "").split(",").map((t) => t.trim()).filter(Boolean),
        is_published: !!e.is_published,
        published_at: localInputToIso(e.scheduledAt),
        locale: e.locale || "en",
        translation_group: (e.translation_group || "").trim() || null,
      });
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
    if (!(await confirm({ title: `Delete "${p.title}"?`, description: "This can't be undone." }))) return;
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
        <Note tone="brand" className="justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              This is Haylingua's first-party blog at /blog — separate from the external
              blog.haylingua.am (Ghost). Body is Markdown. Publishing sets the article's
              publish date once and never resets it on later edits.
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={importPlannedPosts}
              disabled={seeding}
              title="Publishes the planned SEO content batch (greetings, alphabet, dialects, numbers, travel phrases, FAQs) — safe to click more than once, already-imported posts are skipped."
              className="shrink-0"
            >
              {seeding ? <Loader2 className="animate-spin" /> : <Plus />}
              Import planned posts
            </Button>
          </div>
        </Note>

        <SectionCard title="New post">
          <PostEditor fields={draft} onChange={setDraft} api={api} onUploadError={(m) => showToast(m, "err")} />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 ring-2 ring-slate-200">
              <input type="checkbox" checked={draft.is_published} onChange={(e) => setDraft({ ...draft, is_published: e.target.checked })} />
              {draft.scheduledAt ? "Publish (using date above)" : "Publish immediately"}
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
        </SectionCard>

        <ListToolbar
          search={<SearchInput value={list.q} onChange={(q) => list.set({ q })} placeholder="Search title or slug…" />}
          filters={
            <>
              <Select value={localeFilter || "all"} onValueChange={(v) => list.set({ locale: v === "all" ? "" : v, page: 1 })}>
                <SelectTrigger className="h-9 w-[9.5rem] rounded-xl text-xs font-bold" aria-label="Filter by language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All languages</SelectItem>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => list.set({ status: v === "all" ? "" : v, page: 1 })}>
                <SelectTrigger className="h-9 w-[8.5rem] rounded-xl text-xs font-bold" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="draft">Drafts</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          count={total}
          countLabel="post"
        />

        <ListState
          loading={loading}
          error={loadError}
          onRetry={() => { setLoading(true); refresh().catch((e) => setLoadError(e.message)).finally(() => setLoading(false)); }}
          empty={posts.length === 0}
          rows={4}
          emptyState={
            <EmptyState
              icon={Newspaper}
              title={list.q || localeFilter || statusFilter !== "all" ? "No posts match these filters" : "No posts yet"}
              description={list.q || localeFilter || statusFilter !== "all" ? "Try a different search or filter." : "Create your first post above."}
              action={
                list.q || localeFilter || statusFilter !== "all" ? (
                  <Button variant="outline" size="sm" onClick={() => list.set({ q: "", locale: "", status: "", page: 1 })}>Clear filters</Button>
                ) : null
              }
            />
          }
        >
          <div className="space-y-4">
            {posts.map((p) => {
              const e = edits[p.id] || emptyFields();
              const isScheduled = p.is_published && p.published_at && new Date(p.published_at) > new Date();
              const isLive = p.is_published && !isScheduled;
              return (
                <div key={p.id} className={cx("rounded-3xl bg-white p-4 ring-1 shadow-sm", p.is_published ? "ring-slate-200" : "ring-slate-200 opacity-80")}>
                  <PostEditor
                    fields={e}
                    onChange={(next) => setEdits((prev) => ({ ...prev, [p.id]: next }))}
                    api={api}
                    onUploadError={(m) => showToast(m, "err")}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => togglePost(p)}
                        disabled={busy}
                        className={cx(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                          isLive
                            ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100"
                            : isScheduled
                            ? "bg-gold-50 text-gold-700 ring-gold-200 hover:bg-gold-100"
                            : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200"
                        )}
                      >
                        {isLive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {isLive ? "Published" : isScheduled ? `Scheduled · ${new Date(p.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Draft"}
                      </button>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold uppercase text-slate-500 ring-1 ring-slate-200">
                        {p.locale || "en"}
                      </span>
                      {isLive && (
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
              );
            })}
          </div>
          <Pagination
            className="mt-4"
            page={list.page}
            pageSize={list.pageSize}
            total={total}
            onPageChange={(p) => list.set({ page: p })}
            onPageSizeChange={(n) => list.set({ pageSize: n })}
          />
        </ListState>
      </div>
    </CmsLayout>
  );
}
