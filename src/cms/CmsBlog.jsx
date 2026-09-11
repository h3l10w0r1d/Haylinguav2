// src/cms/CmsBlog.jsx — authoring UI for the first-party blog (blog_posts
// table). Separate from blog.haylingua.am (external, Ghost-hosted, not
// managed here). Posts are a server-paged table; clicking one (or "New post")
// opens the PostEditor (Markdown toolbar, drag-and-drop image upload, alt
// text, live SEO checklist) in a side sheet that guards unsaved edits.
import { useEffect, useMemo, useRef, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import {
  AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Newspaper, Pencil, Plus, Trash2, XCircle,
} from "lucide-react";
import CmsLayout from "./CmsLayout";
import { TOOLBAR_ACTIONS, insertAtCursor, analyzeBlogSeo } from "./markdownEditor";
import {
  Badge, Button, DataTable, EditorSheet, EmptyState, ListToolbar, Pagination, SearchInput,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusPill, Switch,
  cn as cx, inputCls, isDirty, notify, textareaCls, useConfirm, useListQuery,
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

// The one post editor, shown in the side sheet for both new and existing
// posts — toolbar + drag-and-drop body image upload + cover image
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
    <div className="space-y-5">
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [total, setTotal] = useState(0);
  const [seeding, setSeeding] = useState(false);
  // { id: null | number, initial, fields } while the editor sheet is open.
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  // Paging/search/filters live in the URL, and the list is fetched from the
  // server per page — an English post has a row per locale, so this table
  // grows ~7x faster than the post count.
  const list = useListQuery();
  const localeFilter = list.get("locale") || "";
  const statusFilter = list.get("status") || "all";
  const filtered = !!(list.q || localeFilter || statusFilter !== "all");

  async function refresh() {
    const res = await api.listBlogPosts(localeFilter, {
      page: list.page,
      pageSize: list.pageSize,
      q: list.q,
      status: statusFilter === "all" ? undefined : statusFilter,
    });
    const rows = Array.isArray(res?.posts) ? res.posts : [];
    setTotal(Number(res?.total ?? rows.length));
    setPosts(rows);
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      await refresh();
    } catch (err) {
      setLoadError(err.message || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, localeFilter, statusFilter, list.page, list.pageSize, list.q]);

  function openNew() {
    const fields = emptyFields();
    setEditor({ id: null, initial: fields, fields });
  }

  function openEdit(p) {
    const fields = postToFields(p);
    setEditor({ id: p.id, title: p.title, initial: fields, fields });
  }

  async function importPlannedPosts() {
    setSeeding(true);
    try {
      const res = await api.seedBlogPosts();
      await refresh();
      const n = res?.posts_inserted ?? 0;
      notify(n > 0 ? `Imported ${n} new post${n === 1 ? "" : "s"}` : "Already imported — nothing new to add");
    } catch (err) {
      notify(err.message || "Import failed", "err");
    } finally {
      setSeeding(false);
    }
  }

  async function save() {
    if (!editor) return;
    const f = editor.fields;
    const slug = f.slug.trim() || slugify(f.title);
    if (!f.title.trim() || !slug) {
      notify("A post needs a title", "err");
      return;
    }
    const payload = {
      slug,
      title: f.title.trim(),
      meta_description: f.meta_description.trim() || null,
      excerpt: f.excerpt.trim() || null,
      body_markdown: f.body_markdown,
      cover_image_url: f.cover_image_url.trim() || null,
      cover_image_alt: f.cover_image_alt.trim() || null,
      author_name: f.author_name.trim() || "Haylingua",
      tags: f.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      is_published: !!f.is_published,
      published_at: localInputToIso(f.scheduledAt),
      locale: f.locale || "en",
      translation_group: (f.translation_group || "").trim() || null,
    };
    setSaving(true);
    try {
      if (editor.id == null) await api.createBlogPost(payload);
      else await api.updateBlogPost(editor.id, payload);
      setEditor(null);
      notify(editor.id == null ? "Post created" : "Post saved");
      await refresh();
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  async function togglePost(p) {
    try {
      await api.updateBlogPost(p.id, { is_published: !p.is_published });
      notify(p.is_published ? "Unpublished" : "Published");
      await refresh();
    } catch (err) {
      notify(err.message || "Update failed", "err");
    }
  }

  async function removePost(p) {
    if (!(await confirm({ title: `Delete "${p.title}"?`, description: "This can't be undone." }))) return false;
    try {
      await api.deleteBlogPost(p.id);
      notify("Post deleted");
      await refresh();
      return true;
    } catch (err) {
      notify(err.message || "Delete failed", "err");
      return false;
    }
  }

  const columns = [
    {
      key: "title",
      header: "Post",
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          {p.cover_image_url ? (
            <img src={p.cover_image_url} alt="" className="hidden h-9 w-14 shrink-0 rounded-md object-cover sm:block" />
          ) : (
            <div className="hidden h-9 w-14 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-300 sm:grid">
              <Newspaper className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900">{p.title || "Untitled"}</div>
            <div className="truncate text-xs text-slate-500">/blog/{p.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: "locale",
      header: "Language",
      hideBelow: "sm",
      cell: (p) => <Badge variant="outline" className="uppercase">{p.locale || "en"}</Badge>,
    },
    { key: "status", header: "Status", cell: (p) => <StatusBadge post={p} /> },
    {
      key: "published_at",
      header: "Date",
      hideBelow: "md",
      cell: (p) => <span className="text-xs tabular-nums text-slate-500">{formatDate(p.published_at || p.created_at)}</span>,
    },
  ];

  const rowActions = (p) => {
    const live = postStatus(p) === "published";
    return [
      { label: "Edit", icon: Pencil, onSelect: openEdit },
      { label: p.is_published ? "Unpublish" : "Publish now", icon: p.is_published ? EyeOff : Eye, onSelect: togglePost },
      ...(live ? [{ label: "View live", icon: ExternalLink, onSelect: () => window.open(`/blog/${p.slug}`, "_blank", "noopener") }] : []),
      { label: "Delete", icon: Trash2, destructive: true, onSelect: removePost },
    ];
  };

  const f = editor?.fields;
  const editingPost = editor?.id != null ? posts.find((p) => p.id === editor.id) : null;

  return (
    <CmsLayout
      active="blog"
      title="Blog"
      description="Haylingua's own blog at /blog (not blog.haylingua.am). Posts are written in Markdown."
      actions={
        <>
          <Button
            variant="outline"
            onClick={importPlannedPosts}
            disabled={seeding}
            title="Adds the planned SEO content batch (greetings, alphabet, dialects, numbers, travel phrases, FAQs). Safe to run again: posts already imported are skipped."
          >
            {seeding ? <Loader2 className="animate-spin" /> : null}
            Import planned posts
          </Button>
          <Button onClick={openNew}>
            <Plus /> New post
          </Button>
        </>
      }
    >
      <ListToolbar
        search={<SearchInput value={list.q} onChange={(q) => list.set({ q })} placeholder="Search title or slug…" />}
        filters={
          <>
            <Select value={localeFilter || "all"} onValueChange={(v) => list.set({ locale: v === "all" ? "" : v, page: 1 })}>
              <SelectTrigger className="h-9 w-[9.5rem] text-sm" aria-label="Filter by language">
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
              <SelectTrigger className="h-9 w-[8.5rem] text-sm" aria-label="Filter by status">
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

      <DataTable
        columns={columns}
        rows={posts}
        loading={loading}
        error={loadError}
        onRetry={load}
        onRowClick={openEdit}
        rowActions={rowActions}
        emptyState={
          <EmptyState
            icon={Newspaper}
            title={filtered ? "No posts match these filters" : "No posts yet"}
            description={filtered ? "Try a different search or filter." : "Write the first one, or import the planned SEO batch."}
            action={
              filtered ? (
                <Button variant="outline" size="sm" onClick={() => list.set({ q: "", locale: "", status: "", page: 1 })}>Clear filters</Button>
              ) : (
                <Button size="sm" onClick={openNew}><Plus /> New post</Button>
              )
            }
          />
        }
      />
      {!loading && !loadError && posts.length > 0 && (
        <Pagination
          className="mt-4"
          page={list.page}
          pageSize={list.pageSize}
          total={total}
          onPageChange={(p) => list.set({ page: p })}
          onPageSizeChange={(n) => list.set({ pageSize: n })}
        />
      )}

      <EditorSheet
        open={!!editor}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        size="xl"
        title={editor?.id == null ? "New post" : editor?.title || "Edit post"}
        description={
          editingPost && postStatus(editingPost) === "published" ? (
            <a href={`/blog/${editingPost.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
              /blog/{editingPost.slug} <ExternalLink className="h-3 w-3" />
            </a>
          ) : editor?.id == null ? "Publishing sets the post's date once; later edits never reset it." : null
        }
        dirty={!!editor && isDirty(editor.initial, editor.fields)}
        saving={saving}
        onSave={save}
        saveLabel={editor?.id == null ? "Create post" : "Save changes"}
        saveDisabled={!f?.title?.trim()}
        onDelete={
          editingPost
            ? async () => { if (await removePost(editingPost)) setEditor(null); }
            : undefined
        }
        footerStart={
          f && (
            <label className="ml-1 flex items-center gap-2 text-sm text-slate-700">
              <Switch checked={!!f.is_published} onCheckedChange={(v) => setEditor((e) => ({ ...e, fields: { ...e.fields, is_published: v } }))} />
              {f.is_published ? (f.scheduledAt ? "Publish on date" : "Published") : "Draft"}
            </label>
          )
        }
      >
        {f && (
          <PostEditor
            fields={f}
            onChange={(next) => setEditor((e) => ({ ...e, fields: next }))}
            api={api}
            onUploadError={(m) => notify(m, "err")}
          />
        )}
      </EditorSheet>
    </CmsLayout>
  );
}

function postToFields(p) {
  return {
    slug: p.slug || "", title: p.title || "", meta_description: p.meta_description || "",
    excerpt: p.excerpt || "", body_markdown: p.body_markdown || "",
    cover_image_url: p.cover_image_url || "", cover_image_alt: p.cover_image_alt || "",
    author_name: p.author_name || "Haylingua",
    tagsText: Array.isArray(p.tags) ? p.tags.join(", ") : "",
    is_published: !!p.is_published,
    scheduledAt: isoToLocalInput(p.published_at),
    locale: p.locale || "en", translation_group: p.translation_group || "",
  };
}

function postStatus(p) {
  if (!p.is_published) return "draft";
  return p.published_at && new Date(p.published_at) > new Date() ? "scheduled" : "published";
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ post }) {
  const status = postStatus(post);
  if (status === "published") return <StatusPill tone="success">Published</StatusPill>;
  if (status === "scheduled") {
    return (
      <StatusPill tone="warning">
        Scheduled · {new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </StatusPill>
    );
  }
  return <StatusPill>Draft</StatusPill>;
}
