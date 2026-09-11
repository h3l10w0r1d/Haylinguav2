// src/cms/journey/EmailFields.jsx — the "send_email" action's detail form:
// subject/body (+ optional raw-HTML body, sent as the rich version while
// body stays the plain-text fallback — both go through backend/automations.py's
// _render_template), a variable picker that inserts {{tokens}} at the
// last-focused field's cursor, and a reminder that the recipient is always
// the enrolled learner (the engine has no per-step recipient override —
// see _action_send_email's `SELECT email ... FROM users WHERE id = :u`).
import { useRef, useState } from "react";
import { Mail, Plus } from "lucide-react";
import { Input, Textarea, Label, Button, Tabs, TabsList, TabsTrigger, Note } from "../ui";

const VARIABLES = [
  { token: "first_name", label: "First name" },
  { token: "username", label: "Username" },
  { token: "name", label: "Name" },
  { token: "email", label: "Email" },
];

export default function EmailFields({ params, readOnly, onUpdateParams }) {
  const p = params || {};
  const [bodyMode, setBodyMode] = useState(p.html_body ? "html" : "plain");
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const htmlRef = useRef(null);
  const lastFocused = useRef("body"); // "subject" | "body" | "html"

  function insertVariable(token) {
    const field = lastFocused.current;
    const ref = field === "subject" ? subjectRef : field === "html" ? htmlRef : bodyRef;
    const key = field === "subject" ? "subject" : field === "html" ? "html_body" : "body";
    const el = ref.current;
    const current = p[key] || "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const insert = `{{${token}}}`;
    const next = current.slice(0, start) + insert + current.slice(end);
    onUpdateParams({ [key]: next });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + insert.length;
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="space-y-4">
      <Note tone="info" icon={Mail} className="text-xs">
        Sent to the enrolled learner's own email address — there's no separate recipient field, an automation email always goes to whoever triggered/matched this campaign.
      </Note>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Subject</Label>
        </div>
        <Input
          ref={subjectRef}
          value={p.subject || ""}
          onChange={(e) => onUpdateParams({ subject: e.target.value })}
          onFocus={() => { lastFocused.current = "subject"; }}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Insert:</span>
          {VARIABLES.map((v) => (
            <button
              key={v.token}
              type="button"
              disabled={readOnly}
              onClick={() => insertVariable(v.token)}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:bg-brand-50 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="h-2.5 w-2.5" /> {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Tabs value={bodyMode} onValueChange={setBodyMode}>
          <div className="flex items-center justify-between">
            <Label>Body</Label>
            <TabsList className="h-7">
              <TabsTrigger value="plain" className="h-6 px-2 text-[11px]">Plain text</TabsTrigger>
              <TabsTrigger value="html" className="h-6 px-2 text-[11px]">HTML</TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        {bodyMode === "plain" && (
          <Textarea
            ref={bodyRef}
            value={p.body || ""}
            onChange={(e) => onUpdateParams({ body: e.target.value })}
            onFocus={() => { lastFocused.current = "body"; }}
            rows={6}
            placeholder="Hi {{first_name}}, ..."
            disabled={readOnly}
          />
        )}
        {bodyMode === "html" && (
          <>
            <Textarea
              ref={htmlRef}
              value={p.html_body || ""}
              onChange={(e) => onUpdateParams({ html_body: e.target.value })}
              onFocus={() => { lastFocused.current = "html"; }}
              rows={10}
              placeholder="<p>Hi {{first_name}}, ...</p>"
              className="font-mono text-xs"
              disabled={readOnly}
            />
            <p className="text-xs font-semibold text-slate-400">
              Sent as the rich version of this email; "Plain text" above stays as the fallback for clients that can't render HTML.
            </p>
            {!readOnly && p.html_body && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onUpdateParams({ html_body: "" })} className="h-auto p-0 text-xs font-bold text-cardinal-500 hover:underline">
                Clear HTML version
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
