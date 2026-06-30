// src/cms/CmsAchievements.jsx — build & manage achievement badges.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Target, Zap, Crown, Star, Flame, Info } from "lucide-react";
import CmsLayout from "./CmsLayout";

const ICONS = { star: Star, crown: Crown, flame: Flame, zap: Zap, target: Target };
const ICON_OPTS = ["star", "crown", "flame", "zap", "target"];
const METRICS = [
  { value: "lessons_completed", label: "Lessons completed", unit: "lessons" },
  { value: "streak_days", label: "Day streak", unit: "days" },
  { value: "total_xp", label: "Total XP", unit: "XP" },
  { value: "correct_answers", label: "Correct answers", unit: "answers" },
];
const METRIC_UNIT = Object.fromEntries(METRICS.map((m) => [m.value, m.unit]));
const METRIC_LABEL = Object.fromEntries(METRICS.map((m) => [m.value, m.label.toLowerCase()]));

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] font-semibold text-slate-400">{hint}</span> : null}
    </label>
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
            className={cx(
              "grid h-10 w-10 place-items-center rounded-xl ring-2 transition",
              on ? "bg-gold-500 text-white ring-gold-500 shadow-[0_3px_0_0_#B45309]" : "bg-white text-slate-400 ring-slate-200 hover:ring-gold-300"
            )}
          >
            <I className="h-5 w-5" />
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
  return `Unlocks when a learner reaches ${goal} ${unit} · then they claim +${reward} XP (once).`;
}

export default function CmsAchievements() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [items, setItems] = useState([]);
  const [edits, setEdits] = useState({}); // id -> draft
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ title: "", description: "", metric: "lessons_completed", threshold: 1, reward_xp: 20, icon: "star" });

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const data = await api.listAchievements();
    const list = Array.isArray(data) ? data : [];
    setItems(list);
    const e = {};
    list.forEach((a) => {
      e[a.id] = {
        title: a.title || "",
        description: a.description || "",
        icon: a.icon || "star",
        metric: a.metric || "lessons_completed",
        threshold: a.threshold ?? 1,
        reward_xp: a.reward_xp ?? 0,
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
        showToast(err.message || "Failed to load achievements", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function create() {
    const title = draft.title.trim();
    if (!title) return;
    setBusy(true);
    try {
      await api.createAchievement({
        title,
        description: draft.description.trim(),
        metric: draft.metric,
        threshold: Number(draft.threshold) || 1,
        reward_xp: Number(draft.reward_xp) || 0,
        icon: draft.icon,
      });
      setDraft({ title: "", description: "", metric: "lessons_completed", threshold: 1, reward_xp: 20, icon: "star" });
      await refresh();
      showToast("Achievement created");
    } catch (err) {
      showToast(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveOne(a) {
    const e = edits[a.id] || {};
    setBusy(true);
    try {
      await api.updateAchievement(a.id, {
        title: (e.title || "").trim(),
        description: (e.description || "").trim(),
        icon: e.icon,
        metric: e.metric,
        threshold: Number(e.threshold) || 1,
        reward_xp: Number(e.reward_xp) || 0,
      });
      await refresh();
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a) {
    setBusy(true);
    try {
      await api.updateAchievement(a.id, { is_active: !a.is_active });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function remove(a) {
    if (!confirm(`Delete "${a.title}"? Learners who already claimed it keep their XP.`)) return;
    setBusy(true);
    try {
      await api.deleteAchievement(a.id);
      await refresh();
      showToast("Deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function move(idx, dir) {
    const next = items.slice();
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const [it] = next.splice(idx, 1);
    next.splice(j, 0, it);
    setItems(next);
    setBusy(true);
    try {
      await api.reorderAchievements(next.map((a) => a.id));
      await refresh();
    } catch (err) {
      showToast(err.message || "Reorder failed", "err");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function patch(id, p) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  const DraftIcon = ICONS[draft.icon] || Star;

  return (
    <CmsLayout active="achievements" title="Achievements">
      <div className="space-y-5">
        {/* How it works */}
        <div className="flex items-start gap-3 rounded-3xl bg-brand-50 p-4 ring-1 ring-brand-100">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
          <p className="text-sm font-semibold text-slate-600">
            An achievement is a badge a learner <b>unlocks</b> when a chosen stat reaches a goal — then they can <b>claim a one-time XP reward</b>.
            Pick what to measure, the goal to hit, and the reward.
          </p>
        </div>

        {/* Create */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-4 font-display text-base font-bold text-slate-900">New achievement</div>

          {/* Display */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_1fr_1.4fr]">
            <Field label="Badge icon">
              <IconPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
            </Field>
            <Field label="Title" hint="Shown on the badge">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Word Collector" className={inputCls} />
            </Field>
            <Field label="Description" hint="The line under the title">
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="e.g. Earn 500 XP" className={inputCls} />
            </Field>
          </div>

          {/* Rule */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Measure (what counts)">
              <select value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} className={inputCls}>
                {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Goal to unlock" hint={`Reach this many ${METRIC_UNIT[draft.metric]}`}>
              <div className="flex items-center gap-2">
                <input type="number" min="1" value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: e.target.value })} className={cx(inputCls, "flex-1")} />
                <span className="shrink-0 text-xs font-bold text-slate-400">{METRIC_UNIT[draft.metric]}</span>
              </div>
            </Field>
            <Field label="Reward" hint="XP granted once, on claim">
              <div className="flex items-center gap-2">
                <input type="number" min="0" value={draft.reward_xp} onChange={(e) => setDraft({ ...draft, reward_xp: e.target.value })} className={cx(inputCls, "flex-1")} />
                <span className="shrink-0 text-xs font-bold text-slate-400">XP</span>
              </div>
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {/* live preview */}
            <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-500 text-white shadow-[0_3px_0_0_#B45309]">
                <DraftIcon className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="font-display text-sm font-extrabold text-slate-800">{draft.title || "Badge title"}</div>
                <div className="text-xs font-semibold text-slate-500">{draft.description || ruleText(draft)}</div>
              </div>
            </div>
            <button type="button" onClick={create} disabled={busy || !draft.title.trim()} className="btn3d btn3d-brand text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
              <Plus className="h-4 w-4" /> Add achievement
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">
            No achievements yet. Create your first one above.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((a, idx) => {
              const e = edits[a.id] || {};
              const Icon = ICONS[e.icon] || Star;
              return (
                <div key={a.id} className={cx("rounded-3xl bg-white p-4 ring-1 shadow-sm md:p-5", a.is_active ? "ring-slate-200" : "ring-slate-200 opacity-70")}>
                  <div className="flex items-start gap-3">
                    {/* reorder */}
                    <div className="flex flex-col gap-1 pt-1">
                      <button type="button" onClick={() => move(idx, -1)} disabled={busy || idx === 0} title="Move up" className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => move(idx, 1)} disabled={busy || idx === items.length - 1} title="Move down" className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                    </div>

                    <div className="min-w-0 flex-1 space-y-4">
                      {/* preview + actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-3">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-500 text-white shadow-[0_3px_0_0_#B45309]">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="leading-tight">
                            <div className="font-display text-base font-extrabold text-slate-800">{e.title || "Untitled"}</div>
                            <div className="text-xs font-semibold text-slate-500">{e.description || "—"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleActive(a)} disabled={busy}
                            className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 transition",
                              a.is_active ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200")}>
                            {a.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {a.is_active ? "Active" : "Hidden"}
                          </button>
                          <button type="button" onClick={() => saveOne(a)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                          <button type="button" onClick={() => remove(a)} disabled={busy} className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                        </div>
                      </div>

                      {/* display fields */}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[auto_1fr_1.4fr]">
                        <Field label="Badge icon">
                          <IconPicker value={e.icon || "star"} onChange={(icon) => patch(a.id, { icon })} />
                        </Field>
                        <Field label="Title">
                          <input value={e.title || ""} onChange={(ev) => patch(a.id, { title: ev.target.value })} className={inputCls} />
                        </Field>
                        <Field label="Description">
                          <input value={e.description || ""} onChange={(ev) => patch(a.id, { description: ev.target.value })} className={inputCls} />
                        </Field>
                      </div>

                      {/* rule fields */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="Measure (what counts)">
                          <select value={e.metric || "lessons_completed"} onChange={(ev) => patch(a.id, { metric: ev.target.value })} className={inputCls}>
                            {METRICS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </Field>
                        <Field label="Goal to unlock">
                          <div className="flex items-center gap-2">
                            <input type="number" min="1" value={e.threshold ?? 1} onChange={(ev) => patch(a.id, { threshold: ev.target.value })} className={cx(inputCls, "flex-1")} />
                            <span className="shrink-0 text-xs font-bold text-slate-400">{METRIC_UNIT[e.metric] || ""}</span>
                          </div>
                        </Field>
                        <Field label="Reward">
                          <div className="flex items-center gap-2">
                            <input type="number" min="0" value={e.reward_xp ?? 0} onChange={(ev) => patch(a.id, { reward_xp: ev.target.value })} className={cx(inputCls, "flex-1")} />
                            <span className="shrink-0 text-xs font-bold text-slate-400">XP</span>
                          </div>
                        </Field>
                      </div>

                      {/* rule summary */}
                      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                        <span className="text-xs font-semibold text-slate-600">{ruleText(e)}</span>
                        <span className="ml-auto font-mono text-[11px] text-slate-300">key: {a.key}</span>
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
