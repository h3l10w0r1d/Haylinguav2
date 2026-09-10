// src/cms/FilterRuleBuilder.jsx — shared field/operator/value row editor for
// a {field, operator, value} filter list, used by both AutomationEditor
// (trigger filters + condition branches, once those ship) and CmsSegments
// (segment membership filters). One implementation of this UI, not two —
// mirrors backend/automations.py's KNOWN_OPERATORS + _FIELD_RESOLVERS
// whitelist, so what an admin can pick here is exactly what the engine can
// evaluate.
import { Plus, X } from "lucide-react";

export const FIELDS = [
  { value: "users.current_streak", label: "Current streak (days)" },
  { value: "users.streak_last_activity_date", label: "Last streak activity (date)" },
  { value: "users.gems", label: "Gems" },
  { value: "users.bonus_xp", label: "Bonus XP" },
  { value: "users.is_premium", label: "Is Premium" },
  { value: "users.last_active_at", label: "Last active at" },
];

export const OPERATORS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "older_than_days", label: "older than (days)" },
  { value: "in_segment", label: "in segment" },
];

const inputCls =
  "w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

export default function FilterRuleBuilder({ filters, onChange, segments = [] }) {
  const list = Array.isArray(filters) ? filters : [];

  function update(i, patch) {
    onChange(list.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }
  function remove(i) {
    onChange(list.filter((_, j) => j !== i));
  }
  function add() {
    onChange([...list, { field: FIELDS[0].value, operator: "eq", value: "" }]);
  }

  return (
    <div className="space-y-2">
      {list.map((f, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <select value={f.field || ""} onChange={(e) => update(i, { field: e.target.value })} className={inputCls + " max-w-[13rem]"}>
            {FIELDS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <select value={f.operator || "eq"} onChange={(e) => update(i, { operator: e.target.value })} className={inputCls + " max-w-[9rem]"}>
            {OPERATORS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          {f.operator === "in_segment" ? (
            <select value={f.value || ""} onChange={(e) => update(i, { value: Number(e.target.value) || "" })} className={inputCls + " max-w-[13rem]"}>
              <option value="">Choose a segment…</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <input
              value={f.value ?? ""}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="Value"
              className={inputCls + " max-w-[9rem]"}
            />
          )}
          <button type="button" onClick={() => remove(i)} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-cardinal-500 ring-1 ring-slate-200 hover:bg-cardinal-50">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-brand-600 ring-1 ring-brand-100 hover:bg-brand-50">
        <Plus className="h-3.5 w-3.5" /> Add filter
      </button>
    </div>
  );
}
