// src/cms/CmsAchievements.jsx — build & manage achievement badges. A
// manually ordered table; each badge opens in a side-sheet editor with a
// live preview.
import { useEffect, useMemo, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Crown, Eye, EyeOff, Flame, Pencil, Plus, Star, Target, Trash2, Trophy, Zap } from "lucide-react";
import CmsLayout from "./CmsLayout";
import {
  Button, DataTable, EditorSheet, EmptyState, Field, Input, ReorderButtons,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusPill,
  cn as cx, isDirty, notify, useConfirm,
} from "./ui";

const ICONS = { star: Star, crown: Crown, flame: Flame, zap: Zap, target: Target };
const ICON_OPTS = ["star", "crown", "flame", "zap", "target"];
const METRICS = [
  { value: "lessons_completed", label: "Lessons completed", unit: "lessons" },
  { value: "chapters_completed", label: "Chapters completed", unit: "chapters" },
  { value: "streak_days", label: "Day streak", unit: "days" },
  { value: "days_active", label: "Days practiced (total)", unit: "days" },
  { value: "total_xp", label: "Total XP", unit: "XP" },
  { value: "correct_answers", label: "Correct answers", unit: "answers" },
  { value: "friends_count", label: "Friends added", unit: "friends" },
  { value: "gems", label: "Gems owned", unit: "gems" },
];
const METRIC_UNIT = Object.fromEntries(METRICS.map((m) => [m.value, m.unit]));

// Curated badge colours (icon-tile background).
const COLORS = ["#F59E0B", "#FF7A1A", "#E11D48", "#22B07D", "#0EA5E9", "#8B5CF6", "#0D9488", "#EC4899", "#475569", "#FACC15"];
const DEFAULT_COLOR = "#F59E0B";

const EMPTY_BADGE = { title: "", description: "", metric: "lessons_completed", threshold: "1", reward_xp: "20", icon: "star", color: DEFAULT_COLOR };

function badgeToFields(a) {
  return {
    title: a.title || "",
    description: a.description || "",
    icon: a.icon || "star",
    color: a.color || DEFAULT_COLOR,
    metric: a.metric || "lessons_completed",
    threshold: String(a.threshold ?? 1),
    reward_xp: String(a.reward_xp ?? 0),
  };
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((c) => {
        const on = String(value || "").toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            aria-label={`Colour ${c}`}
            aria-pressed={on}
            className={cx("h-7 w-7 rounded-full ring-2 ring-offset-1 transition", on ? "ring-slate-800" : "ring-transparent hover:ring-slate-300")}
            style={{ background: c }}
          />
        );
      })}
    </div>
  );
}

function BadgeTile({ icon, color, size = "md" }) {
  const I = ICONS[icon] || Star;
  return (
    <div
      className={cx("grid shrink-0 place-items-center rounded-lg text-white", size === "lg" ? "h-12 w-12" : "h-9 w-9")}
      style={{ background: color || DEFAULT_COLOR }}
    >
      <I className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
    </div>
  );
}

function IconPicker({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {ICON_OPTS.map((ic) => {
        const I = ICONS[ic];
        const on = value === ic;
        return (
          <button
            key={ic}
            type="button"
            onClick={() => onChange(ic)}
            title={ic}
            aria-label={`Icon ${ic}`}
            aria-pressed={on}
            className={cx(
              "grid h-9 w-9 place-items-center rounded-lg ring-1 transition",
              on ? "bg-brand-50 text-brand-600 ring-brand-300" : "bg-white text-slate-400 ring-slate-200 hover:text-slate-600"
            )}
          >
            <I className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function ruleText(d) {
  const unit = METRIC_UNIT[d.metric] || "";
  const goal = Number(d.threshold) || 0;
  const reward = Number(d.reward_xp) || 0;
  return `Unlocks at ${goal} ${unit}, then the learner claims +${reward} XP once.`;
}

export default function CmsAchievements() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const confirm = useConfirm();
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [editor, setEditor] = useState(null); // { id, title, key, initial, fields }
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const data = await api.listAchievements();
    setItems(Array.isArray(data) ? data : []);
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      await refresh();
    } catch (err) {
      setLoadError(err.message || "Failed to load achievements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function openNew() {
    setEditor({ id: null, initial: EMPTY_BADGE, fields: EMPTY_BADGE });
  }

  function openEdit(a) {
    const fields = badgeToFields(a);
    setEditor({ id: a.id, title: a.title, key: a.key, initial: fields, fields });
  }

  function setField(patch) {
    setEditor((e) => ({ ...e, fields: { ...e.fields, ...patch } }));
  }

  async function save() {
    const f = editor.fields;
    if (!f.title.trim()) {
      notify("A badge needs a title", "err");
      return;
    }
    const payload = {
      title: f.title.trim(),
      description: f.description.trim(),
      icon: f.icon,
      color: f.color || DEFAULT_COLOR,
      metric: f.metric,
      threshold: Number(f.threshold) || 1,
      reward_xp: Number(f.reward_xp) || 0,
    };
    setSaving(true);
    try {
      if (editor.id == null) await api.createAchievement(payload);
      else await api.updateAchievement(editor.id, payload);
      notify(editor.id == null ? "Achievement created" : "Achievement saved");
      setEditor(null);
      await refresh();
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(a) {
    try {
      await api.updateAchievement(a.id, { is_active: !a.is_active });
      notify(a.is_active ? "Achievement hidden" : "Achievement active");
      await refresh();
    } catch (err) {
      notify(err.message || "Update failed", "err");
    }
  }

  async function remove(a) {
    if (!(await confirm({ title: `Delete "${a.title}"?`, description: "Learners who already claimed it keep their XP." }))) return false;
    try {
      await api.deleteAchievement(a.id);
      notify("Achievement deleted");
      await refresh();
      return true;
    } catch (err) {
      notify(err.message || "Delete failed", "err");
      return false;
    }
  }

  async function move(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    const [it] = next.splice(idx, 1);
    next.splice(j, 0, it);
    setItems(next);
    setReordering(true);
    try {
      await api.reorderAchievements(next.map((a) => a.id));
    } catch (err) {
      notify(err.message || "Reorder failed", "err");
      await refresh().catch(() => {});
    } finally {
      setReordering(false);
    }
  }

  const columns = [
    {
      key: "order",
      header: <span className="sr-only">Order</span>,
      headerClassName: "w-[4.5rem]",
      className: "py-1",
      cell: (a) => <ReorderButtons index={items.indexOf(a)} count={items.length} onMove={move} disabled={reordering} label="achievement" />,
    },
    {
      key: "title",
      header: "Badge",
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <BadgeTile icon={a.icon} color={a.color} />
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900">{a.title || "Untitled"}</div>
            {a.description && <div className="truncate text-xs text-slate-500">{a.description}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "metric",
      header: "Goal",
      hideBelow: "md",
      cell: (a) => (
        <span className="whitespace-nowrap text-slate-600">
          <span className="tabular-nums">{a.threshold}</span> {METRIC_UNIT[a.metric] || a.metric}
        </span>
      ),
    },
    {
      key: "reward_xp",
      header: "Reward",
      align: "right",
      hideBelow: "sm",
      cell: (a) => <span className="whitespace-nowrap tabular-nums text-slate-700">+{a.reward_xp ?? 0} XP</span>,
    },
    {
      key: "is_active",
      header: "Status",
      cell: (a) => <StatusPill tone={a.is_active ? "success" : "neutral"}>{a.is_active ? "Active" : "Hidden"}</StatusPill>,
    },
  ];

  const rowActions = (a) => [
    { label: "Edit", icon: Pencil, onSelect: openEdit },
    { label: a.is_active ? "Hide" : "Activate", icon: a.is_active ? EyeOff : Eye, onSelect: toggleActive },
    { label: "Delete", icon: Trash2, destructive: true, onSelect: remove },
  ];

  const f = editor?.fields;
  const editingBadge = editor?.id != null ? items.find((x) => x.id === editor.id) : null;

  return (
    <CmsLayout
      active="achievements"
      title="Achievements"
      description="Badges a learner unlocks when a stat reaches a goal, then claims a one-time XP reward."
      actions={<Button onClick={openNew}><Plus /> New achievement</Button>}
    >
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={loadError}
        onRetry={load}
        onRowClick={openEdit}
        rowActions={rowActions}
        emptyState={
          <EmptyState
            icon={Trophy}
            title="No achievements yet"
            description="Create the first badge learners can unlock."
            action={<Button size="sm" onClick={openNew}><Plus /> New achievement</Button>}
          />
        }
      />

      <EditorSheet
        open={!!editor}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        size="md"
        title={editor?.id == null ? "New achievement" : editor?.title || "Edit achievement"}
        description={editor?.key ? <span className="font-mono text-xs">key: {editor.key}</span> : null}
        dirty={!!editor && isDirty(editor.initial, editor.fields)}
        saving={saving}
        onSave={save}
        saveLabel={editor?.id == null ? "Create achievement" : "Save changes"}
        saveDisabled={!f?.title?.trim()}
        onDelete={editingBadge ? async () => { if (await remove(editingBadge)) setEditor(null); } : undefined}
      >
        {f && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
              <BadgeTile icon={f.icon} color={f.color} size="lg" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-900">{f.title || "Badge title"}</div>
                <div className="text-xs text-slate-500">{f.description || ruleText(f)}</div>
              </div>
            </div>

            <Field label="Title" required hint="Shown on the badge">
              <Input value={f.title} onChange={(e) => setField({ title: e.target.value })} placeholder="e.g. Word Collector" />
            </Field>
            <Field label="Description" hint="The line under the title">
              <Input value={f.description} onChange={(e) => setField({ description: e.target.value })} placeholder="e.g. Earn 500 XP" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
              <Field label="Icon">
                <IconPicker value={f.icon} onChange={(icon) => setField({ icon })} />
              </Field>
              <Field label="Colour">
                <ColorPicker value={f.color} onChange={(color) => setField({ color })} />
              </Field>
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-4">
              <Field label="What counts">
                <Select value={f.metric} onValueChange={(metric) => setField({ metric })}>
                  <SelectTrigger aria-label="Metric"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METRICS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Goal to unlock" hint={`Reach this many ${METRIC_UNIT[f.metric]}`}>
                  <Input type="number" min="1" value={f.threshold} onChange={(e) => setField({ threshold: e.target.value })} />
                </Field>
                <Field label="Reward" hint="XP granted once, on claim">
                  <Input type="number" min="0" value={f.reward_xp} onChange={(e) => setField({ reward_xp: e.target.value })} />
                </Field>
              </div>
              <p className="text-xs text-slate-500">{ruleText(f)}</p>
            </div>
          </div>
        )}
      </EditorSheet>
    </CmsLayout>
  );
}
