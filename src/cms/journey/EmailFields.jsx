// src/cms/journey/EmailFields.jsx — the "send_email" action's detail form:
// subject/body (+ optional raw-HTML body, sent as the rich version while
// body stays the plain-text fallback — both go through backend/automations.py's
// _render_template), a variable-insert menu, and a Preview tab that renders
// the email with sample data so an editor can see the actual result without
// leaving the panel. Recipient is a fixed reminder, not a field — the
// engine always sends to the enrolled learner (_action_send_email's
// `SELECT email ... FROM users WHERE id = :u`), there's nothing to pick.
import { useRef, useState } from "react";
import { ChevronDown, Mail } from "lucide-react";
import {
  Input, Textarea, Label, Button, Tabs, TabsList, TabsTrigger, Note,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "../ui";

const VARIABLES = [
  { token: "first_name", label: "First name", sample: "Alex" },
  { token: "username", label: "Username", sample: "alex99" },
  { token: "name", label: "Name", sample: "Alex" },
  { token: "email", label: "Email", sample: "alex@example.com" },
];

function withSampleData(text) {
  if (!text) return text;
  let out = text;
  for (const v of VARIABLES) out = out.split(`{{${v.token}}}`).join(v.sample);
  return out;
}

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
      <Note tone="info" icon={Mail} className="text-xs">
        Sent to the enrolled learner's own email address — there's no separate recipient field, an automation email always goes to whoever triggered/matched this campaign.
      </Note>

      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Compose</span>
          {VariablePicker}
        </div>

        <div className="space-y-4 bg-white p-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              ref={subjectRef}
              value={p.subject || ""}
              onChange={(e) => onUpdateParams({ subject: e.target.value })}
              onFocus={() => { lastFocused.current = "subject"; }}
              placeholder="Welcome to Haylingua, {{first_name}}!"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-1.5">
            <Tabs value={bodyMode} onValueChange={setBodyMode}>
              <div className="flex items-center justify-between">
                <Label>Body</Label>
                <TabsList className="h-7">
                  <TabsTrigger value="plain" className="h-6 px-2 text-[11px]">Plain text</TabsTrigger>
                  <TabsTrigger value="html" className="h-6 px-2 text-[11px]">HTML</TabsTrigger>
                  <TabsTrigger value="preview" className="h-6 px-2 text-[11px]">Preview</TabsTrigger>
                </TabsList>
              </div>
            </Tabs>

            {bodyMode === "plain" && (
              <Textarea
                ref={bodyRef}
                value={p.body || ""}
                onChange={(e) => onUpdateParams({ body: e.target.value })}
                onFocus={() => { lastFocused.current = "body"; }}
                rows={8}
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
                  rows={12}
                  placeholder="<p>Hi {{first_name}}, ...</p>"
                  className="font-mono text-xs"
                  disabled={readOnly}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400">
                    Sent as the rich version; "Plain text" stays the fallback for clients that can't render HTML.
                  </p>
                  {!readOnly && p.html_body && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onUpdateParams({ html_body: "" })} className="h-auto shrink-0 p-0 text-xs font-bold text-cardinal-500 hover:underline">
                      Clear HTML
                    </Button>
                  )}
                </div>
              </>
            )}

            {bodyMode === "preview" && (
              <EmailPreview subject={p.subject} body={p.body} htmlBody={p.html_body} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ subject, body, htmlBody }) {
  const renderedSubject = withSampleData(subject) || "(no subject)";
  const hasHtml = !!htmlBody;
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
      <div className="space-y-0.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Subject</div>
        <div className="truncate text-sm font-bold text-slate-800">{renderedSubject}</div>
      </div>
      {hasHtml ? (
        <iframe
          title="Email HTML preview"
          sandbox=""
          srcDoc={withSampleData(htmlBody)}
          className="h-64 w-full bg-white"
        />
      ) : (
        <div className="h-64 overflow-y-auto whitespace-pre-wrap bg-white p-4 text-sm text-slate-700">
          {withSampleData(body) || <span className="text-slate-400">(empty body)</span>}
        </div>
      )}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-400">
        Preview uses sample data (Alex / alex99) — real emails substitute the actual learner's info.
      </div>
    </div>
  );
}
