// src/cms/journey/StepDetailSheet.jsx — the full editing form for whichever
// node is currently selected, opened as a side Sheet so the canvas nodes
// themselves can stay compact. Switches on step type; embeds
// FilterRuleBuilder unchanged for condition branches.
import FilterRuleBuilder from "../FilterRuleBuilder";
import EmailFields from "./EmailFields";
import { BONUS_KINDS } from "./graph";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  Input, Textarea, Label, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui";

const ACTION_TITLES = {
  send_email: "Send email",
  send_push: "Send push (mobile app)",
  send_web_push: "Send push (web browser)",
  send_brevo: "Send to Brevo",
  grant_bonus: "Grant bonus",
};

function ActionFields({ step, readOnly, onUpdateParams }) {
  const p = step.params || {};
  if (step.action === "send_email") {
    return <EmailFields params={p} readOnly={readOnly} onUpdateParams={onUpdateParams} />;
  }
  if (step.action === "send_push" || step.action === "send_web_push") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={p.title || ""} onChange={(e) => onUpdateParams({ title: e.target.value })} disabled={readOnly} />
        </div>
        <div className="space-y-1.5">
          <Label>Body</Label>
          <Textarea value={p.body || ""} onChange={(e) => onUpdateParams({ body: e.target.value })} rows={4} disabled={readOnly} />
        </div>
        {step.action === "send_web_push" && (
          <div className="space-y-1.5">
            <Label>Link when clicked (optional)</Label>
            <Input value={p.url || ""} onChange={(e) => onUpdateParams({ url: e.target.value })} placeholder="/dashboard" disabled={readOnly} />
            <p className="text-xs font-semibold text-slate-400">Only reaches learners on desktop/mobile web who've enabled browser notifications — not the mobile app.</p>
          </div>
        )}
      </div>
    );
  }
  if (step.action === "send_brevo") {
    return (
      <div className="space-y-1.5">
        <Label>Brevo event name</Label>
        <Input value={p.event_name || ""} onChange={(e) => onUpdateParams({ event_name: e.target.value })} disabled={readOnly} />
      </div>
    );
  }
  if (step.action === "grant_bonus") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <Select value={p.kind || "gems"} onValueChange={(v) => onUpdateParams({ kind: v })} disabled={readOnly}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BONUS_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" min={1} value={p.amount ?? 50} onChange={(e) => onUpdateParams({ amount: Number(e.target.value) || 1 })} disabled={readOnly} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Message (optional)</Label>
          <Input value={p.message || ""} onChange={(e) => onUpdateParams({ message: e.target.value })} placeholder="Shown to the learner" disabled={readOnly} />
        </div>
        <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
          <label className="flex items-center gap-1.5">
            <Checkbox checked={!!p.notify_inapp} onCheckedChange={(v) => onUpdateParams({ notify_inapp: !!v })} disabled={readOnly} /> In-app notification
          </label>
          <label className="flex items-center gap-1.5">
            <Checkbox checked={!!p.notify_email} onCheckedChange={(v) => onUpdateParams({ notify_email: !!v })} disabled={readOnly} /> Email too
          </label>
        </div>
      </div>
    );
  }
  return null;
}

export default function StepDetailSheet({ open, onOpenChange, step, path, segments, readOnly, onUpdateStep, onUpdateParams, onUpdateBranchWhen }) {
  if (!step) return null;

  const title = step.type === "wait" ? "Wait" : step.type === "condition" ? "Condition" : ACTION_TITLES[step.action] || "Step";
  const branches = step.type === "condition" ? (Array.isArray(step.branches) ? step.branches : []) : [];
  // The email composer needs real room (subject/body/HTML/preview) — every
  // other step's form is short fields, the default width suits those fine.
  const wide = step.type === "action" && step.action === "send_email";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={wide ? "w-full overflow-y-auto sm:max-w-xl" : "w-full overflow-y-auto sm:max-w-md"}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {step.type === "wait" && "Suspends this branch until the scheduled cron resumes it."}
            {step.type === "condition" && "Evaluated fresh every time this step is reached, including on resume."}
            {step.type === "action" && "Runs immediately when this step is reached."}
          </SheetDescription>
        </SheetHeader>

        <fieldset disabled={readOnly} className="mt-5 border-0 p-0">
          {step.type === "wait" && (
            <div className="space-y-1.5">
              <Label>Duration (hours)</Label>
              <Input
                type="number"
                min={1}
                value={step.duration_hours ?? 24}
                onChange={(e) => onUpdateStep({ duration_hours: Number(e.target.value) || 1 })}
              />
            </div>
          )}

          {step.type === "condition" && (
            <div className="space-y-4">
              {branches.map((b, i) => (
                <div key={i} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">
                    {b.else ? "Otherwise" : i === 0 ? "If" : "Else if"}
                  </div>
                  {!b.else && (
                    <FilterRuleBuilder group={b.when} onChange={(when) => onUpdateBranchWhen(i, when)} segments={segments} />
                  )}
                  {b.else && <p className="text-xs font-semibold text-slate-400">Matches when no branch above does.</p>}
                </div>
              ))}
            </div>
          )}

          {step.type === "action" && (
            <ActionFields step={step} readOnly={readOnly} onUpdateParams={onUpdateParams} />
          )}
        </fieldset>
      </SheetContent>
    </Sheet>
  );
}
