// src/cms/FilterRuleBuilder.jsx — shared filter-group editor (one AND/OR
// toggle + a list of {field, operator, value} rows), used by CmsSegments
// (segment membership) and StepListEditor (trigger filters + condition
// branches). One implementation of this UI, not two — mirrors
// backend/automations.py's evaluate_when exactly: KNOWN_OPERATORS/
// _FIELD_RESOLVERS whitelist, and the same {op: "and"|"or", rules: [...]}
// shape (one level of grouping, not nested groups — same "cap the
// complexity" call made for the step editor's branch nesting).
import { Plus, X } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui";

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

// Accepts either shape a saved campaign/segment might have — a bare array
// (legacy, always-AND) or {op, rules} — and always normalizes to {op, rules}
// so every onChange from here on writes the canonical shape going forward.
export function normalizeGroup(group) {
  if (Array.isArray(group)) return { op: "and", rules: group };
  if (group && typeof group === "object") return { op: group.op === "or" ? "or" : "and", rules: Array.isArray(group.rules) ? group.rules : [] };
  return { op: "and", rules: [] };
}

export default function FilterRuleBuilder({ group, onChange, segments = [] }) {
  const { op, rules } = normalizeGroup(group);

  function update(i, patch) {
    onChange({ op, rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  }
  function remove(i) {
    onChange({ op, rules: rules.filter((_, j) => j !== i) });
  }
  function add() {
    onChange({ op, rules: [...rules, { field: FIELDS[0].value, operator: "eq", value: "" }] });
  }
  function setOp(nextOp) {
    onChange({ op: nextOp, rules });
  }

  return (
    <div className="space-y-2">
      {rules.length > 1 && (
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500">
          <span>Match</span>
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-slate-200">
            {["and", "or"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setOp(v)}
                className={
                  "px-2.5 py-1 uppercase tracking-wide transition " +
                  (op === v ? "bg-brand-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50")
                }
              >
                {v}
              </button>
            ))}
          </div>
          <span>of the following</span>
        </div>
      )}
      {rules.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <Select value={r.field || FIELDS[0].value} onValueChange={(v) => update(i, { field: v })}>
            <SelectTrigger className="h-9 w-auto min-w-[10rem] max-w-[13rem] rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>{FIELDS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={r.operator || "eq"} onValueChange={(v) => update(i, { operator: v })}>
            <SelectTrigger className="h-9 w-auto min-w-[7rem] max-w-[9rem] rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>{OPERATORS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
          </Select>
          {r.operator === "in_segment" ? (
            <Select value={r.value ? String(r.value) : ""} onValueChange={(v) => update(i, { value: Number(v) || "" })}>
              <SelectTrigger className="h-9 w-auto min-w-[10rem] max-w-[13rem] rounded-xl text-xs font-bold"><SelectValue placeholder="Choose a segment…" /></SelectTrigger>
              <SelectContent>{segments.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Input
              value={r.value ?? ""}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="Value"
              className="h-9 max-w-[9rem]"
            />
          )}
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} className="h-8 w-8 shrink-0 text-cardinal-500 hover:text-cardinal-600">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="text-brand-600">
        <Plus className="h-3.5 w-3.5" /> Add filter
      </Button>
    </div>
  );
}
