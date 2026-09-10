// src/cms/StepListEditor.jsx — recursive step-list editor: wait, the four
// action kinds, and condition (if/else-if/else) steps whose branches each
// hold their own nested step list. Mirrors backend/automations.py's step
// schema exactly (KNOWN_ACTIONS/KNOWN_OPERATORS, the branches[] shape) so
// what an admin builds here is exactly what the engine can execute.
//
// Nesting is capped at depth 2 in the UI (can't add a new condition step
// past that) even though the schema/engine supports deeper nesting — a
// form-based editor strains past a couple of levels, per the plan's
// explicit steer away from a canvas/graph UI.
import { Plus, Trash2, ChevronUp, ChevronDown, Mail, Clock, Bell, Globe, Send, Gift, GitBranch } from "lucide-react";
import FilterRuleBuilder from "./FilterRuleBuilder";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";
const textareaCls = inputCls + " resize-y";

const ACTION_META = {
  send_email: { label: "Send email", icon: Mail, tone: "bg-brand-50 text-brand-500" },
  send_push: { label: "Send push (mobile app)", icon: Bell, tone: "bg-feather-50 text-feather-600" },
  send_web_push: { label: "Send push (web browser)", icon: Globe, tone: "bg-feather-50 text-feather-600" },
  send_brevo: { label: "Send to Brevo", icon: Send, tone: "bg-purple-50 text-purple-600" },
  grant_bonus: { label: "Grant bonus", icon: Gift, tone: "bg-gold-50 text-gold-600" },
};

const BONUS_KINDS = [
  { value: "gems", label: "Gems" },
  { value: "xp", label: "XP" },
  { value: "chests", label: "Chests" },
  { value: "streak_freeze", label: "Streak freeze" },
];

function defaultParams(action) {
  switch (action) {
    case "send_email": return { subject: "", body: "" };
    case "send_push": return { title: "", body: "" };
    case "send_web_push": return { title: "", body: "", url: "" };
    case "send_brevo": return { event_name: "" };
    case "grant_bonus": return { kind: "gems", amount: 50, notify_email: false, notify_inapp: true, message: "" };
    default: return {};
  }
}

export function newStep(kind) {
  if (kind === "wait") return { type: "wait", duration_hours: 24 };
  if (kind === "condition") return { type: "condition", branches: [{ when: [], steps: [] }, { else: true, steps: [] }] };
  return { type: "action", action: kind, params: defaultParams(kind) };
}

function AddButton({ label, icon: Icon, onClick }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function ActionFields({ step, onUpdateParams }) {
  const p = step.params || {};
  if (step.action === "send_email") {
    return (
      <>
        <input value={p.subject || ""} onChange={(e) => onUpdateParams({ subject: e.target.value })} placeholder="Subject" className={inputCls} />
        <textarea value={p.body || ""} onChange={(e) => onUpdateParams({ body: e.target.value })} placeholder={"Body — use {{name}} for the learner's name"} rows={3} className={textareaCls} />
      </>
    );
  }
  if (step.action === "send_push") {
    return (
      <>
        <input value={p.title || ""} onChange={(e) => onUpdateParams({ title: e.target.value })} placeholder="Title" className={inputCls} />
        <textarea value={p.body || ""} onChange={(e) => onUpdateParams({ body: e.target.value })} placeholder="Body" rows={2} className={textareaCls} />
      </>
    );
  }
  if (step.action === "send_web_push") {
    return (
      <>
        <input value={p.title || ""} onChange={(e) => onUpdateParams({ title: e.target.value })} placeholder="Title" className={inputCls} />
        <textarea value={p.body || ""} onChange={(e) => onUpdateParams({ body: e.target.value })} placeholder="Body" rows={2} className={textareaCls} />
        <input value={p.url || ""} onChange={(e) => onUpdateParams({ url: e.target.value })} placeholder="Link when clicked (optional, e.g. /dashboard)" className={inputCls} />
        <p className="text-xs font-semibold text-slate-400">Only reaches learners on desktop/mobile web who've enabled browser notifications — not the mobile app.</p>
      </>
    );
  }
  if (step.action === "send_brevo") {
    return <input value={p.event_name || ""} onChange={(e) => onUpdateParams({ event_name: e.target.value })} placeholder="Brevo event name" className={inputCls} />;
  }
  if (step.action === "grant_bonus") {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <select value={p.kind || "gems"} onChange={(e) => onUpdateParams({ kind: e.target.value })} className={inputCls}>
            {BONUS_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input type="number" min={1} value={p.amount ?? 50} onChange={(e) => onUpdateParams({ amount: Number(e.target.value) || 1 })} className={inputCls} />
        </div>
        <input value={p.message || ""} onChange={(e) => onUpdateParams({ message: e.target.value })} placeholder="Message shown to the learner (optional)" className={inputCls} />
        <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!p.notify_inapp} onChange={(e) => onUpdateParams({ notify_inapp: e.target.checked })} /> In-app notification</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!p.notify_email} onChange={(e) => onUpdateParams({ notify_email: e.target.checked })} /> Email too</label>
        </div>
      </>
    );
  }
  return null;
}

function ConditionEditor({ step, onUpdate, segments, depth }) {
  const branches = Array.isArray(step.branches) ? step.branches : [];

  function updateBranch(i, patch) {
    onUpdate({ branches: branches.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  }
  function addBranch() {
    const elseIdx = branches.findIndex((b) => b.else);
    const insertAt = elseIdx === -1 ? branches.length : elseIdx;
    const next = branches.slice();
    next.splice(insertAt, 0, { when: [], steps: [] });
    onUpdate({ branches: next });
  }
  function removeBranch(i) {
    onUpdate({ branches: branches.filter((_, j) => j !== i) });
  }

  return (
    <div className="space-y-3">
      {branches.map((b, i) => (
        <div key={i} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
              {b.else ? "Otherwise" : i === 0 ? "If" : "Else if"}
            </span>
            {!b.else && (
              <button type="button" onClick={() => removeBranch(i)} className="text-cardinal-500 hover:text-cardinal-600"><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
          {!b.else && (
            <div className="mb-2">
              <FilterRuleBuilder filters={b.when || []} onChange={(when) => updateBranch(i, { when })} segments={segments} />
            </div>
          )}
          <div className="rounded-lg bg-slate-50 p-2">
            <StepListEditor steps={b.steps || []} onChange={(steps) => updateBranch(i, { steps })} segments={segments} depth={depth + 1} />
          </div>
        </div>
      ))}
      <button type="button" onClick={addBranch} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-brand-600 ring-1 ring-brand-100 hover:bg-brand-50">
        <Plus className="h-3.5 w-3.5" /> Add else-if branch
      </button>
    </div>
  );
}

function StepRow({ step, onUpdate, onUpdateParams, onRemove, onMoveUp, onMoveDown, isFirst, isLast, segments, depth }) {
  const isCondition = step.type === "condition";
  const isWait = step.type === "wait";
  const meta = !isCondition && !isWait ? ACTION_META[step.action] : null;
  const Icon = isCondition ? GitBranch : isWait ? Clock : meta?.icon;
  const tone = isCondition ? "bg-cardinal-50 text-cardinal-600" : isWait ? "bg-gold-50 text-gold-600" : meta?.tone;
  const label = isCondition ? "Condition" : isWait ? "Wait" : meta?.label;

  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 pt-1">
          <button type="button" onClick={onMoveUp} disabled={isFirst} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-white disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" onClick={onMoveDown} disabled={isLast} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-white disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
        </div>
        <div className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}>{Icon && <Icon className="h-4 w-4" />}</div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400">{label}</div>
          {isWait && (
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={step.duration_hours ?? 24} onChange={(e) => onUpdate({ duration_hours: Number(e.target.value) || 1 })} className={cx(inputCls, "max-w-[7rem]")} />
              <span className="text-sm font-semibold text-slate-500">hours</span>
            </div>
          )}
          {isCondition && <ConditionEditor step={step} onUpdate={onUpdate} segments={segments} depth={depth} />}
          {!isCondition && !isWait && <ActionFields step={step} onUpdateParams={onUpdateParams} />}
        </div>
        <button type="button" onClick={onRemove} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-cardinal-500 ring-1 ring-slate-200 hover:bg-cardinal-50"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function StepListEditor({ steps, onChange, segments, depth = 0 }) {
  const list = Array.isArray(steps) ? steps : [];

  function update(i, patch) { onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s))); }
  function updateParams(i, patch) { onChange(list.map((s, j) => (j === i ? { ...s, params: { ...s.params, ...patch } } : s))); }
  function remove(i) { onChange(list.filter((_, j) => j !== i)); }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    const [m] = next.splice(i, 1);
    next.splice(j, 0, m);
    onChange(next);
  }
  function add(kind) { onChange([...list, newStep(kind)]); }

  return (
    <div className="space-y-3">
      {list.map((step, i) => (
        <StepRow
          key={i}
          step={step}
          onUpdate={(p) => update(i, p)}
          onUpdateParams={(p) => updateParams(i, p)}
          onRemove={() => remove(i)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          isFirst={i === 0}
          isLast={i === list.length - 1}
          segments={segments}
          depth={depth}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <AddButton label="Email" icon={Mail} onClick={() => add("send_email")} />
        <AddButton label="Push (app)" icon={Bell} onClick={() => add("send_push")} />
        <AddButton label="Push (web)" icon={Globe} onClick={() => add("send_web_push")} />
        <AddButton label="Brevo" icon={Send} onClick={() => add("send_brevo")} />
        <AddButton label="Bonus" icon={Gift} onClick={() => add("grant_bonus")} />
        <AddButton label="Wait" icon={Clock} onClick={() => add("wait")} />
        {depth < 2 && <AddButton label="Condition" icon={GitBranch} onClick={() => add("condition")} />}
      </div>
    </div>
  );
}
