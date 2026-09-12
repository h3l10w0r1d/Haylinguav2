// src/cms/journey/PushFields.jsx — the "send_push" (mobile/APNs) and
// "send_web_push" (browser) action's detail form. Mirrors EmailFields.jsx's
// variable-picker + live-preview treatment, scaled down to a push
// notification's shape (title + body, no HTML/blocks): {{variable}}
// substitution happens server-side at send time
// (backend/automations.py's _action_send_push/_action_send_web_push), so
// this only inserts tokens and renders them against sample data for the
// preview — same VARIABLES vocabulary as email, see templateVariables.js.
import { useRef } from "react";
import { ChevronDown, Bell } from "lucide-react";
import {
  Input, Textarea, Label, Button, Note,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "../ui";
import { VARIABLES, withSampleData } from "./templateVariables";

export default function PushFields({ params, action, readOnly, onUpdateParams }) {
  const p = params || {};
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const lastFocused = useRef({ kind: "title" });

  function insertVariable(token) {
    const active = lastFocused.current;
    const insert = `{{${token}}}`;
    const el = active.el;
    const key = active.kind === "body" ? "body" : "title";
    const current = p[key] || "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + insert + current.slice(end);
    onUpdateParams({ [key]: next });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  }

  const VariablePicker = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={readOnly} className="h-7 gap-1 rounded-full px-2.5 text-xs">
          Insert variable <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-400">Learner data</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {VARIABLES.map((v) => (
          <DropdownMenuItem key={v.token} onSelect={() => insertVariable(v.token)}>
            <span className="font-semibold">{v.label}</span>
            <span className="ml-auto font-mono text-[11px] text-slate-400">{`{{${v.token}}}`}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Compose</span>
          {VariablePicker}
        </div>

        <div className="space-y-4 bg-white p-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              ref={titleRef}
              value={p.title || ""}
              onChange={(e) => onUpdateParams({ title: e.target.value })}
              onFocus={(e) => { lastFocused.current = { kind: "title", el: e.target }; }}
              placeholder="{{streak}}-day streak, {{first_name}}!"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea
              ref={bodyRef}
              value={p.body || ""}
              onChange={(e) => onUpdateParams({ body: e.target.value })}
              onFocus={(e) => { lastFocused.current = { kind: "body", el: e.target }; }}
              rows={4}
              placeholder="You've got {{gems}} gems and you're in {{league}} league — keep it up!"
              disabled={readOnly}
            />
          </div>

          {action === "send_web_push" && (
            <div className="space-y-1.5">
              <Label>Link when clicked (optional)</Label>
              <Input
                value={p.url || ""}
                onChange={(e) => onUpdateParams({ url: e.target.value })}
                placeholder="/dashboard"
                disabled={readOnly}
              />
              <p className="text-xs font-semibold text-slate-400">Only reaches learners on desktop/mobile web who've enabled browser notifications — not the mobile app.</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Live preview</div>
        <PushPreview title={p.title} body={p.body} />
      </div>

      <Note tone="info" icon={Bell} className="text-xs">
        Sent to every device/browser this learner has registered — no separate recipient field, same as email steps.
      </Note>
    </div>
  );
}

function PushPreview({ title, body }) {
  const renderedTitle = withSampleData(title) || "(no title)";
  const renderedBody = withSampleData(body) || "(no body)";
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-100 p-3 ring-1 ring-slate-200">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-white">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 shadow-sm">
        <div className="truncate text-sm font-extrabold text-slate-800">{renderedTitle}</div>
        <div className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-500">{renderedBody}</div>
      </div>
    </div>
  );
}
