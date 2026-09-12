// src/cms/journey/EmailFields.jsx — the "send_email" action's detail form:
// a drag-and-drop block builder (banners/headings/text/buttons/dividers/
// spacers, each with its own background color, compiled to real HTML),
// plain subject/body, a raw-HTML escape hatch, and a Preview tab — all
// going through backend/automations.py's _render_template ({{variable}}
// substitution happens server-side at send time, so the compiler in
// emailBuilder/blocks.js must never touch {{...}} tokens). Recipient is a
// fixed reminder, not a field — the engine always sends to the enrolled
// learner (_action_send_email's `SELECT email ... FROM users WHERE id = :u`).
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Mail, LayoutTemplate } from "lucide-react";
import {
  Input, Textarea, Label, Button, Tabs, TabsList, TabsTrigger, Note,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  notify,
} from "../ui";
import { createCmsApi, getCmsToken } from "../api";
import EmailBuilder from "./emailBuilder/EmailBuilder";
import { compileBlocksToHtml } from "./emailBuilder/blocks";

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
  const blocks = Array.isArray(p.blocks) ? p.blocks : [];
  const [bodyMode, setBodyMode] = useState(blocks.length ? "builder" : p.html_body ? "html" : p.body ? "plain" : "builder");
  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  const htmlRef = useRef(null);

  // This is a leaf component fed only params/onUpdateParams from
  // StepDetailSheet, several levels below AutomationEditor's own api
  // client — builds its own here (same pattern CmsSupport.jsx's
  // NotesTab/AutomationsTab already use) rather than threading a client
  // prop down through JourneyCanvas/StepDetailSheet for one feature.
  const api = useMemo(() => createCmsApi(getCmsToken()), []);
  const [templates, setTemplates] = useState([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    api.listEmailTemplates().then((res) => setTemplates(res?.templates || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAsTemplate() {
    if (!templateName.trim()) return;
    try {
      await api.createEmailTemplate({ name: templateName.trim(), blocks });
      notify("Template saved");
      setTemplateName("");
      setSavingTemplate(false);
      const res = await api.listEmailTemplates();
      setTemplates(res?.templates || []);
    } catch (err) {
      notify(err.message || "Failed to save template", "err");
    }
  }

  function loadTemplate(template) {
    updateBlocks(template.blocks || []);
    setBodyMode("builder");
  }
  // Identifiers only, re-resolved against live `p` at insert-time — never
  // stale values, since typing after a field is focused doesn't re-fire
  // onFocus (the ref would otherwise capture a value snapshot that goes
  // stale on the very next keystroke).
  const lastFocused = useRef({ kind: "body" });

  function updateBlocks(nextBlocks) {
    onUpdateParams({ blocks: nextBlocks, html_body: compileBlocksToHtml(nextBlocks) });
  }

  function insertVariable(token) {
    const active = lastFocused.current;
    const insert = `{{${token}}}`;
    const el = active.el;
    const start = el?.selectionStart;
    const end = el?.selectionEnd;

    if (active.kind === "block") {
      const block = blocks.find((b) => b.id === active.blockId);
      if (!block) return;
      const current = block[active.field] || "";
      const s = start ?? current.length;
      const e = end ?? current.length;
      const next = current.slice(0, s) + insert + current.slice(e);
      updateBlocks(blocks.map((b) => (b.id === active.blockId ? { ...b, [active.field]: next } : b)));
      requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + insert.length, s + insert.length); });
      return;
    }

    const key = active.kind === "subject" ? "subject" : active.kind === "html" ? "html_body" : "body";
    const current = p[key] || "";
    const s = start ?? current.length;
    const e = end ?? current.length;
    const next = current.slice(0, s) + insert + current.slice(e);
    onUpdateParams({ [key]: next });
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(s + insert.length, s + insert.length);
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

  const TemplatePicker = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={readOnly} className="h-7 gap-1 rounded-full px-2.5 text-xs">
          <LayoutTemplate className="h-3 w-3" /> Templates <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-slate-400">Load a saved template</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {templates.length === 0 && (
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">No saved templates yet.</div>
        )}
        {templates.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => loadTemplate(t)}>
            {t.name}
          </DropdownMenuItem>
        ))}
        {blocks.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSavingTemplate(true)}>
              Save current as template…
            </DropdownMenuItem>
          </>
        )}
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
          <div className="flex items-center gap-1.5">
            {TemplatePicker}
            {VariablePicker}
          </div>
        </div>

        {savingTemplate && (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-brand-50/50 px-4 py-2.5">
            <Input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template name"
              className="h-8 flex-1 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") saveAsTemplate(); if (e.key === "Escape") setSavingTemplate(false); }}
            />
            <Button type="button" size="sm" className="h-8" disabled={!templateName.trim()} onClick={saveAsTemplate}>Save</Button>
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => { setSavingTemplate(false); setTemplateName(""); }}>Cancel</Button>
          </div>
        )}

        <div className="space-y-4 bg-white p-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              ref={subjectRef}
              value={p.subject || ""}
              onChange={(e) => onUpdateParams({ subject: e.target.value })}
              onFocus={(e) => { lastFocused.current = { kind: "subject", el: e.target }; }}
              placeholder="Welcome to Haylingua, {{first_name}}!"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-1.5">
            <Tabs value={bodyMode} onValueChange={setBodyMode}>
              <div className="flex items-center justify-between">
                <Label>Body</Label>
                <TabsList className="h-7">
                  <TabsTrigger value="builder" className="h-6 px-2 text-[11px]">Builder</TabsTrigger>
                  <TabsTrigger value="plain" className="h-6 px-2 text-[11px]">Plain text</TabsTrigger>
                  <TabsTrigger value="html" className="h-6 px-2 text-[11px]">HTML</TabsTrigger>
                  <TabsTrigger value="preview" className="h-6 px-2 text-[11px]">Preview</TabsTrigger>
                </TabsList>
              </div>
            </Tabs>

            {bodyMode === "builder" && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <EmailBuilder
                  blocks={blocks}
                  readOnly={readOnly}
                  onChange={updateBlocks}
                  onFocusField={(blockId, field, el) => { lastFocused.current = { kind: "block", blockId, field, el }; }}
                />
                <div className="lg:sticky lg:top-4 lg:self-start">
                  <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Live preview</div>
                  <EmailPreview subject={p.subject} body={p.body} htmlBody={p.html_body} />
                </div>
              </div>
            )}

            {bodyMode === "plain" && (
              <Textarea
                ref={bodyRef}
                value={p.body || ""}
                onChange={(e) => onUpdateParams({ body: e.target.value })}
                onFocus={(e) => { lastFocused.current = { kind: "body", el: e.target }; }}
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
                  onFocus={(e) => { lastFocused.current = { kind: "html", el: e.target }; }}
                  rows={12}
                  placeholder="<p>Hi {{first_name}}, ...</p>"
                  className="font-mono text-xs"
                  disabled={readOnly}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400">
                    {blocks.length ? "Hand-editing here won't update the Builder tab's blocks." : "Sent as the rich version; \"Plain text\" stays the fallback for clients that can't render HTML."}
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
          className="h-72 w-full bg-white"
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
