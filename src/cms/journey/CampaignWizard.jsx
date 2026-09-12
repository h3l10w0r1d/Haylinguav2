// src/cms/journey/CampaignWizard.jsx — the step-by-step campaign editor.
// Purely presentational/step-orchestration: AutomationEditor.jsx keeps
// owning every piece of state, save()/sendNow()/testRun(), and validation
// — this just organizes the exact same fields (previously one long page,
// AutomationEditor.jsx's old tab==="edit" block) into digestible screens.
//
// Two navigation modes:
//  - "guided" (a still-being-set-up draft): forced Next/Back order, a
//    step can't be skipped ahead of until the current one is valid.
//  - "free" (any campaign that's already been through setup once): the
//    left stepper is fully clickable in any order, same fields, no gating
//    — because revisiting a real campaign to tweak one thing shouldn't
//    force a start-to-finish replay.
// Which mode applies is decided by the caller (AutomationEditor) once,
// from the campaign's loaded data, and passed in as the `guided` prop.
import { useState } from "react";
import { Check, ChevronRight, Lock, PlayCircle, Save } from "lucide-react";
import {
  Button, Checkbox, Field, FieldRow, Input, SectionCard,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger,
} from "../ui";
import FilterRuleBuilder from "../FilterRuleBuilder";
import FilterPresets from "./FilterPresets";
import JourneyCanvas from "./JourneyCanvas";
import { summarizeSteps } from "./graph";

const STEP_DEFS = [
  { key: "trigger", label: "Name & trigger" },
  { key: "steps", label: "Build your steps" },
  { key: "goal", label: "Goal (optional)" },
  { key: "review", label: "Review & launch" },
];

function step1Valid({ name, triggerType, segmentId }) {
  if (!name.trim()) return false;
  if (triggerType === "segment" || triggerType === "manual") return !!segmentId;
  return true;
}
function step2Valid({ steps }) {
  return Array.isArray(steps) && steps.length > 0;
}

export default function CampaignWizard(props) {
  const {
    guided, canEdit,
    name, setName, status, setStatus,
    triggerType, setTriggerType, eventType, setEventType, filters, setFilters,
    segmentId, setSegmentId, reenrollPolicy, setReenrollPolicy,
    goalEnabled, setGoalEnabled, goal, setGoal,
    steps, setSteps, segments, stepStats, triggerLabel,
    EVENT_TYPES,
    busy, onSave,
    testUserId, setTestUserId, onTestRun,
    onSendNow,
  } = props;

  const [activeKey, setActiveKey] = useState("trigger");
  const activeIndex = STEP_DEFS.findIndex((s) => s.key === activeKey);

  const validity = {
    trigger: step1Valid({ name, triggerType, segmentId }),
    steps: step2Valid({ steps }),
    goal: true,
    review: true,
  };
  // In guided mode, a step is reachable once every step before it is
  // valid — not just "have you visited it", so you can't tab ahead of an
  // incomplete step and then Back into a false sense of progress.
  const maxReachableIndex = guided
    ? STEP_DEFS.findIndex((s) => !validity[s.key])
    : STEP_DEFS.length - 1;
  const reachableIndex = maxReachableIndex === -1 ? STEP_DEFS.length - 1 : maxReachableIndex;

  function goTo(key) {
    const idx = STEP_DEFS.findIndex((s) => s.key === key);
    if (guided && idx > reachableIndex) return;
    setActiveKey(key);
  }

  async function goNext() {
    if (guided) await onSave({ silent: true });
    const next = STEP_DEFS[activeIndex + 1];
    if (next) setActiveKey(next.key);
  }
  function goBack() {
    const prev = STEP_DEFS[activeIndex - 1];
    if (prev) setActiveKey(prev.key);
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[15rem_1fr]">
      <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {STEP_DEFS.map((s, i) => {
          const locked = guided && i > reachableIndex;
          const current = s.key === activeKey;
          const complete = guided && i < reachableIndex;
          return (
            <button
              key={s.key}
              type="button"
              disabled={locked}
              onClick={() => goTo(s.key)}
              className={
                "flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition disabled:cursor-not-allowed " +
                (current
                  ? "bg-brand-500 text-white shadow-sm"
                  : locked
                  ? "text-slate-300"
                  : "text-slate-500 hover:bg-slate-50")
              }
            >
              <span
                className={
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-extrabold " +
                  (current ? "bg-white/25 text-white" : complete ? "bg-brand-500 text-white" : locked ? "bg-slate-100 text-slate-300" : "bg-slate-100 text-slate-500")
                }
              >
                {locked ? <Lock className="h-3 w-3" /> : complete ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="whitespace-nowrap lg:whitespace-normal">{s.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-5">
        {activeKey === "trigger" && (
          <SectionCard title="Name & trigger" description="What is this campaign called, and what starts it?">
            <div className="space-y-5">
              <Field label="Campaign name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome series" disabled={!canEdit} />
              </Field>

              <div>
                <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">Starts when…</div>
                <Tabs value={triggerType} onValueChange={setTriggerType}>
                  <TabsList>
                    <TabsTrigger value="event" disabled={!canEdit}>When something happens</TabsTrigger>
                    <TabsTrigger value="segment" disabled={!canEdit}>When someone enters a segment</TabsTrigger>
                    <TabsTrigger value="manual" disabled={!canEdit}>Send once, right now</TabsTrigger>
                  </TabsList>
                </Tabs>

                {triggerType === "event" && (
                  <>
                    <p className="mt-2 text-xs font-semibold text-slate-400">Fires the moment a specific thing happens, like a learner signing up.</p>
                    <Field label="When this happens" className="mt-3">
                      <Select value={eventType} onValueChange={setEventType} disabled={!canEdit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EVENT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <div className="mt-4">
                      <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">Only if (optional audience filters)</div>
                      <FilterPresets group={filters} onChange={setFilters} segments={segments} readOnly={!canEdit} />
                    </div>
                  </>
                )}

                {(triggerType === "segment" || triggerType === "manual") && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-400">
                      {triggerType === "segment"
                        ? "Fires when someone newly matches an audience you define in Segments — checked every 15-30 min, not instantly."
                        : "You choose exactly when to send it — once, right now, to everyone currently matching an audience."}
                    </p>
                    <Field label="Segment">
                      <Select value={segmentId} onValueChange={setSegmentId} disabled={!canEdit}>
                        <SelectTrigger><SelectValue placeholder="Choose a segment…" /></SelectTrigger>
                        <SelectContent>
                          {segments.length === 0
                            ? <div className="px-3 py-2 text-xs font-semibold text-slate-400">No segments yet — create one under Segments first.</div>
                            : segments.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}

                {triggerType !== "manual" && (
                  <div className="mt-4">
                    <Field label="If a user triggers this again while already enrolled">
                      <Select value={reenrollPolicy} onValueChange={setReenrollPolicy} disabled={!canEdit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip — wait for the current run to finish</SelectItem>
                          <SelectItem value="allow">Allow — start a new run alongside it</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}
              </div>

              {guided && !validity.trigger && (
                <p className="text-xs font-bold text-cardinal-500">
                  {!name.trim() ? "Give this campaign a name to continue." : "Choose a segment to continue."}
                </p>
              )}
            </div>
          </SectionCard>
        )}

        {activeKey === "steps" && (
          <SectionCard
            title="Build your steps"
            description="Drag from the palette to add a step, drag a step onto a + to move it. A condition branches into its own nested steps; a wait suspends until the scheduled cron resumes it, re-checking any condition that follows fresh."
            bodyClassName="h-[60vh] min-h-[420px] overflow-hidden rounded-2xl ring-1 ring-slate-200"
            actions={
              canEdit && (
                <div className="flex items-center gap-2">
                  <Input value={testUserId} onChange={(e) => setTestUserId(e.target.value)} placeholder="Test with user ID" className="h-8 w-36 text-xs" />
                  <Button variant="outline" size="sm" onClick={onTestRun} disabled={busy}>
                    <PlayCircle className="h-3.5 w-3.5" /> Test
                  </Button>
                </div>
              )
            }
          >
            <JourneyCanvas
              steps={steps}
              onChange={setSteps}
              segments={segments}
              readOnly={!canEdit}
              triggerLabel={triggerLabel}
              stepStats={stepStats}
              onOpenTrigger={() => goTo("trigger")}
            />
          </SectionCard>
        )}
        {activeKey === "steps" && guided && !validity.steps && (
          <p className="text-xs font-bold text-cardinal-500">Add at least one step (like sending an email) before continuing.</p>
        )}

        {activeKey === "goal" && (
          <SectionCard title="Goal (optional)" description="Pull a learner out of the rest of this journey early if they already did the thing you're trying to get them to do.">
            <label className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
              <Checkbox checked={goalEnabled} onCheckedChange={(v) => setGoalEnabled(!!v)} disabled={!canEdit} />
              Exit early when a goal is met
            </label>
            {goalEnabled && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-slate-400">
                  Once any enrolled learner matches these, they're pulled out immediately — no more waits or sends.
                </p>
                <FilterPresets group={goal} onChange={setGoal} segments={segments} readOnly={!canEdit} />
              </div>
            )}
          </SectionCard>
        )}

        {activeKey === "review" && (
          <ReviewStep
            {...props}
            triggerLabel={triggerLabel}
            summary={{
              audienceCount: (filters?.rules || []).length,
              stepLabels: summarizeSteps(steps),
            }}
          />
        )}

        {guided && (
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={goBack} disabled={activeIndex === 0}>Back</Button>
            {activeKey !== "review" ? (
              <Button type="button" onClick={goNext} disabled={!validity[activeKey] || busy}>
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewStep(props) {
  const {
    canEdit, name, status, setStatus, triggerType, segmentId, segments,
    goalEnabled, busy, onSave, summary, triggerLabel,
  } = props;
  const segName = segments.find((s) => String(s.id) === segmentId)?.name;

  return (
    <div className="space-y-5">
      <SectionCard title="Review & launch">
        <div className="space-y-3 text-sm font-semibold text-slate-600">
          <p><span className="font-extrabold text-slate-900">{name || "This campaign"}</span> runs when: {triggerType === "manual" ? "you click Send now (below), to everyone matching" : triggerLabel}{triggerType !== "event" && segName ? ` "${segName}"` : ""}.</p>
          {triggerType === "event" && summary.audienceCount > 0 && (
            <p>Only sent to learners matching {summary.audienceCount} audience filter{summary.audienceCount === 1 ? "" : "s"}.</p>
          )}
          <p>
            It has {summary.stepLabels.length} step{summary.stepLabels.length === 1 ? "" : "s"}:{" "}
            {summary.stepLabels.length > 0 ? summary.stepLabels.join(" → ") : "none yet"}.
          </p>
          {goalEnabled && <p>Learners exit early once they match the goal you set.</p>}
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <FieldRow>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["draft", "active", "paused", "archived"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </FieldRow>
          {canEdit && (
            <Button className="mt-4" onClick={() => onSave({})} disabled={busy}>
              <Save className="h-4 w-4" /> {status === "active" ? "Save & activate" : "Save as draft"}
            </Button>
          )}
        </div>
      </SectionCard>

      {canEdit && triggerType === "manual" && (
        <SectionCard
          title="Send now"
          description={status === "archived" ? "This one-time send already went out — it can't be sent again." : "Emails everyone currently matching the segment above, right now. Can't be undone."}
        >
          <Button onClick={props.onSendNow} disabled={busy || status !== "active" || !segmentId} className="bg-cardinal-500 hover:bg-cardinal-600">
            <PlayCircle className="h-4 w-4" /> Send now
          </Button>
        </SectionCard>
      )}
    </div>
  );
}
