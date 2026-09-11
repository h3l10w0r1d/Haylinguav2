// src/cms/CmsChapters.jsx — manage chapters (lesson groups on the learner
// roadmap). A manually ordered table; each chapter opens in a side-sheet
// editor (icon, tint, title, description).
import { useEffect, useMemo, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { BookOpen, ChevronDown, Ear, Eye, EyeOff, ImagePlus, Layers, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import CmsLayout from "./CmsLayout";
import {
  Button, DataTable, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  EditorSheet, EmptyState, Field, Input, ReorderButtons, StatusPill,
  cn as cx, isDirty, notify, useConfirm,
} from "./ui";
import IconPicker from "./IconPicker";
import { LucideGlyph } from "../lib/lucideIcons";

function ChapterIconGlyph({ name, className, fallback = null }) {
  if (!name) return fallback;
  return <LucideGlyph name={name} className={className} fallback={fallback} />;
}

// Same 7 accent tones the learner-facing Dashboard's Chip/ACCENT already
// uses — picking one here just sets which of those existing tints the
// chapter's icon renders in, nothing new to keep in sync elsewhere.
const ICON_TONES = [
  { key: "brand", swatch: "bg-brand-500" },
  { key: "grass", swatch: "bg-grass-500" },
  { key: "amber", swatch: "bg-amber-500" },
  { key: "feather", swatch: "bg-feather-500" },
  { key: "cardinal", swatch: "bg-cardinal-500" },
  { key: "pom", swatch: "bg-pom-500" },
  { key: "gold", swatch: "bg-gold-500" },
];
const TONE_CHIP = {
  brand: "bg-brand-50 text-brand-600",
  grass: "bg-grass-50 text-grass-600",
  amber: "bg-amber-50 text-amber-600",
  feather: "bg-feather-50 text-feather-600",
  cardinal: "bg-cardinal-50 text-cardinal-600",
  pom: "bg-pom-50 text-pom-600",
  gold: "bg-gold-100 text-gold-700",
};

const EMPTY_CHAPTER = { title: "", description: "", icon: "", icon_color: "brand" };

function chapterToFields(c) {
  return { title: c.title || "", description: c.description || "", icon: c.icon || "", icon_color: c.icon_color || "brand" };
}

export default function CmsChapters() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const confirm = useConfirm();
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editor, setEditor] = useState(null); // { id, title, lessonCount, initial, fields }
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function refresh() {
    const data = await api.listChapters();
    setChapters(Array.isArray(data) ? data : []);
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      await refresh();
    } catch (err) {
      setLoadError(err.message || "Failed to load chapters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function openNew() {
    setEditor({ id: null, initial: EMPTY_CHAPTER, fields: EMPTY_CHAPTER });
  }

  function openEdit(c) {
    const fields = chapterToFields(c);
    setEditor({ id: c.id, title: c.title, initial: fields, fields });
  }

  function setField(patch) {
    setEditor((e) => ({ ...e, fields: { ...e.fields, ...patch } }));
  }

  async function save() {
    const f = editor.fields;
    if (!f.title.trim()) {
      notify("A chapter needs a title", "err");
      return;
    }
    const payload = {
      title: f.title.trim(),
      description: f.description.trim(),
      icon: f.icon || null,
      icon_color: f.icon_color || "brand",
    };
    setSaving(true);
    try {
      if (editor.id == null) await api.createChapter(payload);
      else await api.updateChapter(editor.id, payload);
      notify(editor.id == null ? "Chapter created" : "Chapter saved");
      setEditor(null);
      await refresh();
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(c) {
    try {
      await api.updateChapter(c.id, { is_published: !c.is_published });
      notify(c.is_published ? "Chapter hidden" : "Chapter published");
      await refresh();
    } catch (err) {
      notify(err.message || "Update failed", "err");
    }
  }

  async function remove(c) {
    const n = c.lesson_count || 0;
    if (!(await confirm({ title: `Delete "${c.title}"?`, description: `Its ${n} lesson${n === 1 ? "" : "s"} will be unassigned, not deleted.` }))) return false;
    try {
      await api.deleteChapter(c.id);
      notify("Chapter deleted");
      await refresh();
      return true;
    } catch (err) {
      notify(err.message || "Delete failed", "err");
      return false;
    }
  }

  async function move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= chapters.length) return;
    const next = chapters.slice();
    const [it] = next.splice(idx, 1);
    next.splice(j, 0, it);
    setChapters(next); // optimistic
    setReordering(true);
    try {
      await api.reorderChapters(next.map((c) => c.id));
    } catch (err) {
      notify(err.message || "Reorder failed", "err");
      await refresh().catch(() => {});
    } finally {
      setReordering(false);
    }
  }

  async function seed() {
    if (!(await confirm({ title: "Add the starter curriculum?", description: "Adds the built-in 10-chapter Armenian basics. This won't touch your existing chapters.", confirmText: "Add", destructive: false }))) return;
    setSeeding(true);
    try {
      const res = await api.seedCurriculum();
      await refresh();
      notify(res?.created ? `Added ${res.chapters} chapters · ${res.exercises} exercises` : "Starter curriculum already present");
    } catch (err) {
      notify(err.message || "Seeding failed", "err");
    } finally {
      setSeeding(false);
    }
  }

  async function seedSounds() {
    if (!(await confirm({
      title: "Add Phase 0 (Sounds)?",
      description:
        "4 chapters of pure listening/speaking practice that come before the alphabet. This also " +
        "hides (not deletes) the older duplicate alphabet/greetings chapters that collide in " +
        "position with the starter curriculum, and shifts existing chapters to make room.",
      confirmText: "Add",
      destructive: false,
    }))) return;
    setSeeding(true);
    try {
      const res = await api.seedSounds();
      await refresh();
      notify(
        res?.created
          ? `Added ${res.chapters} chapters · ${res.exercises} exercises${res.hidden_chapters ? ` · hid ${res.hidden_chapters} duplicate chapter(s)` : ""}`
          : "Sounds phase already present"
      );
    } catch (err) {
      notify(err.message || "Seeding failed", "err");
    } finally {
      setSeeding(false);
    }
  }

  const columns = [
    {
      key: "order",
      header: <span className="sr-only">Order</span>,
      headerClassName: "w-[4.5rem]",
      className: "py-1",
      cell: (c) => <ReorderButtons index={chapters.indexOf(c)} count={chapters.length} onMove={move} disabled={reordering} label="chapter" />,
    },
    {
      key: "title",
      header: "Chapter",
      cell: (c) => {
        const idx = chapters.indexOf(c);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TONE_CHIP[c.icon_color] || TONE_CHIP.brand)}>
              <ChapterIconGlyph name={c.icon} className="h-4 w-4" fallback={<span className="text-sm font-semibold">{idx + 1}</span>} />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-900">{c.title}</div>
              {c.description && <div className="truncate text-xs text-slate-500">{c.description}</div>}
            </div>
          </div>
        );
      },
    },
    {
      key: "lesson_count",
      header: "Lessons",
      align: "right",
      hideBelow: "sm",
      cell: (c) => (
        <span className="inline-flex items-center gap-1 tabular-nums text-slate-600">
          <BookOpen className="h-3.5 w-3.5 text-slate-400" /> {c.lesson_count ?? 0}
        </span>
      ),
    },
    {
      key: "is_published",
      header: "Status",
      cell: (c) => <StatusPill tone={c.is_published ? "success" : "neutral"}>{c.is_published ? "Published" : "Hidden"}</StatusPill>,
    },
  ];

  const rowActions = (c) => [
    { label: "Edit", icon: Pencil, onSelect: openEdit },
    { label: c.is_published ? "Hide" : "Publish", icon: c.is_published ? EyeOff : Eye, onSelect: togglePublished },
    { label: "Delete", icon: Trash2, destructive: true, onSelect: remove },
  ];

  const f = editor?.fields;
  const editingChapter = editor?.id != null ? chapters.find((x) => x.id === editor.id) : null;

  return (
    <CmsLayout
      active="chapters"
      title="Chapters"
      description="Lesson groups on the learner roadmap, in the order learners meet them."
      actions={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={seeding}>
                Add curriculum <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={seedSounds}>
                <Ear className="mr-2 h-4 w-4 text-slate-400" /> Sounds-first phase
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={seed}>
                <Sparkles className="mr-2 h-4 w-4 text-slate-400" /> Starter curriculum
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openNew}><Plus /> New chapter</Button>
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={chapters}
        loading={loading}
        error={loadError}
        onRetry={load}
        onRowClick={openEdit}
        rowActions={rowActions}
        emptyState={
          <EmptyState
            icon={Layers}
            title="No chapters yet"
            description="Create one, or add the starter curriculum from the header."
            action={<Button size="sm" onClick={openNew}><Plus /> New chapter</Button>}
          />
        }
      />

      <EditorSheet
        open={!!editor}
        onOpenChange={(open) => { if (!open) { setPickerOpen(false); setEditor(null); } }}
        size="md"
        title={editor?.id == null ? "New chapter" : editor?.title || "Edit chapter"}
        description={
          editingChapter
            ? `${editingChapter.lesson_count ?? 0} lesson${editingChapter.lesson_count === 1 ? "" : "s"} in this chapter`
            : "New chapters start hidden until you publish them."
        }
        dirty={!!editor && isDirty(editor.initial, editor.fields)}
        saving={saving}
        onSave={save}
        saveLabel={editor?.id == null ? "Create chapter" : "Save changes"}
        saveDisabled={!f?.title?.trim()}
        onDelete={editingChapter ? async () => { if (await remove(editingChapter)) setEditor(null); } : undefined}
      >
        {f && (
          <div className="space-y-4">
            <Field label="Icon" hint="Pick an icon and the tint it renders in on the roadmap">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className={cx(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-lg ring-1 ring-slate-200 transition hover:ring-slate-300",
                    TONE_CHIP[f.icon_color] || TONE_CHIP.brand
                  )}
                  title="Choose icon"
                  aria-label="Choose icon"
                >
                  <ChapterIconGlyph name={f.icon} className="h-5 w-5" fallback={<ImagePlus className="h-5 w-5 text-slate-400" />} />
                </button>
                <div className="flex items-center gap-1.5">
                  {ICON_TONES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setField({ icon_color: t.key })}
                      aria-label={`Tint ${t.key}`}
                      aria-pressed={f.icon_color === t.key}
                      className={cx(
                        "h-5 w-5 rounded-full ring-2 ring-offset-1 transition",
                        t.swatch,
                        f.icon_color === t.key ? "ring-slate-500" : "ring-transparent"
                      )}
                      title={t.key}
                    />
                  ))}
                </div>
                {f.icon && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setField({ icon: "" })}>Remove icon</Button>
                )}
              </div>
            </Field>
            <Field label="Title" required>
              <Input value={f.title} onChange={(e) => setField({ title: e.target.value })} placeholder="e.g. The Alphabet" />
            </Field>
            <Field label="Description" hint="Optional">
              <Input value={f.description} onChange={(e) => setField({ description: e.target.value })} />
            </Field>

            {/* Rendered inside the sheet on purpose: the picker is a plain
                fixed overlay, and outside the modal sheet it would sit behind
                it and count as an outside click. */}
            <IconPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              currentIcon={f.icon}
              onSelect={(name) => setField({ icon: name })}
            />
          </div>
        )}
      </EditorSheet>
    </CmsLayout>
  );
}
