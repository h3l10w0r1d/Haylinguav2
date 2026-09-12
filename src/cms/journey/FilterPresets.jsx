// src/cms/journey/FilterPresets.jsx — a plain-language shortcut layer
// above FilterRuleBuilder. FilterRuleBuilder's own field/operator/value
// dropdowns (users.current_streak / gte / 7, etc.) are accurate but
// technical — this renders a row of one-click chips for the audience
// shapes a CRM specialist actually reaches for, each just appending a
// rule in the exact shape FilterRuleBuilder already emits. No parallel
// state: click a chip, the normal rule row (with its own editable
// field/operator/value controls) takes over immediately for fine-tuning.
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../ui";
import FilterRuleBuilder, { normalizeGroup } from "../FilterRuleBuilder";

const PRESETS = [
  { label: "Inactive 7+ days", rule: { field: "users.last_active_at", operator: "older_than_days", value: 7 } },
  { label: "Streak of 3+ days", rule: { field: "users.current_streak", operator: "gte", value: 3 } },
  { label: "Best streak 30+ days", rule: { field: "users.best_streak", operator: "gte", value: 30 } },
  { label: "Has 100+ gems", rule: { field: "users.gems", operator: "gte", value: 100 } },
  { label: "Premium members", rule: { field: "users.is_premium", operator: "eq", value: "true" } },
  { label: "Free (non-premium)", rule: { field: "users.is_premium", operator: "eq", value: "false" } },
  { label: "Email verified", rule: { field: "users.email_verified", operator: "eq", value: "true" } },
  { label: "In a specific segment", rule: { field: "users.gems", operator: "in_segment", value: "" } },
];

// A rule "matches" a preset shape (for deciding whether to auto-expand
// the advanced builder below) if its field+operator pair isn't one of
// the ones a preset chip would produce — i.e. someone already went off
// the beaten path, so don't hide that from them behind a collapsed toggle.
function looksHandWritten(rules) {
  return rules.some((r) => !PRESETS.some((p) => p.rule.field === r.field && p.rule.operator === r.operator));
}

export default function FilterPresets({ group, onChange, segments = [], readOnly = false }) {
  const { op, rules } = normalizeGroup(group);
  const [advancedOpen, setAdvancedOpen] = useState(() => looksHandWritten(rules));

  function addPreset(preset) {
    onChange({ op, rules: [...rules, { ...preset.rule }] });
    setAdvancedOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={readOnly}
            onClick={() => addPreset(p)}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-brand-50 hover:text-brand-600 hover:ring-brand-300 disabled:pointer-events-none disabled:opacity-40"
          >
            + {p.label}
          </button>
        ))}
      </div>

      {rules.length > 0 && !advancedOpen ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setAdvancedOpen(true)} className="h-auto p-0 text-xs font-bold text-slate-400 hover:text-slate-600">
          <ChevronDown className="h-3.5 w-3.5" /> {rules.length} filter{rules.length === 1 ? "" : "s"} added — show/edit details
        </Button>
      ) : rules.length > 0 ? (
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <FilterRuleBuilder group={group} onChange={onChange} segments={segments} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setAdvancedOpen(false)} className="mt-2 h-auto p-0 text-xs font-bold text-slate-400 hover:text-slate-600">
            <ChevronUp className="h-3.5 w-3.5" /> Hide details
          </Button>
        </div>
      ) : null}
    </div>
  );
}
