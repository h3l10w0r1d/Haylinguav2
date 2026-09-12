// src/cms/AutomationEditor.jsx — single-campaign editor: trigger config +
// step canvas (delegated to journey/JourneyCanvas, a drag-and-drop
// flowchart over the same wait/action/condition step tree), plus server-
// paginated enrollment/send-log tabs so QA has somewhere to look once a
// campaign is live.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createCmsApi, getCmsClaim, getCmsToken } from "./api";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import CmsLayout from "./CmsLayout";
import CampaignWizard from "./journey/CampaignWizard";
import CampaignAnalytics from "./journey/CampaignAnalytics";
import { EVENT_TYPES } from "./CmsAutomations";
import {
  Badge, Button, DataTable, Input, Note, Pagination, SectionCard,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger,
  useConfirm, notify, useListQuery,
} from "./ui";

const ENROLLMENT_STATUSES = ["active", "waiting", "completed", "exited", "failed"];
const SEND_STATUSES = ["sent", "skipped", "failed"];
const SEND_STATUS_VARIANT = { sent: "secondary", failed: "destructive", skipped: "outline" };

export default function AutomationEditor() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const navigate = useNavigate();
  const { id } = useParams();
  const canEdit = getCmsClaim("crm_role", "editor") !== "viewer";
  const confirm = useConfirm();

  const [tab, setTab] = useState("edit"); // edit | enrollments | sends
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [segments, setSegments] = useState([]);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [triggerType, setTriggerType] = useState("event"); // "event" | "segment"
  const [eventType, setEventType] = useState(EVENT_TYPES[0].value);
  const [filters, setFilters] = useState({ op: "and", rules: [] });
  const [segmentId, setSegmentId] = useState("");
  const [reenrollPolicy, setReenrollPolicy] = useState("skip");
  const [goalEnabled, setGoalEnabled] = useState(false);
  const [goal, setGoal] = useState({ op: "and", rules: [] });
  const [steps, setSteps] = useState([]);
  const [loadedSteps, setLoadedSteps] = useState([]);

  const enrollList = useListQuery({ prefix: "enroll_" });
  const [enrollments, setEnrollments] = useState([]);
  const [enrollTotal, setEnrollTotal] = useState(0);
  const [enrollLoading, setEnrollLoading] = useState(false);

  const sendList = useListQuery({ prefix: "sends_" });
  const [sends, setSends] = useState([]);
  const [sendTotal, setSendTotal] = useState(0);
  const [sendLoading, setSendLoading] = useState(false);

  const [testUserId, setTestUserId] = useState("");

  const [stepStats, setStepStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Computed once, from the campaign as first loaded — never recomputed
  // reactively during the session (that would flicker the wizard mid-edit
  // as steps are added). A still-empty draft gets the guided step-by-step
  // flow; anything already set up (or reopened after being saved through
  // it once) gets the free, fully-clickable stepper — see CampaignWizard.jsx.
  const [guided, setGuided] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [c, segRes, stepStatsRes] = await Promise.all([
          api.getAutomation(id), api.listSegments(), api.getAutomationStepStats(id).catch(() => null),
        ]);
        setStepStats(stepStatsRes);
        setName(c.name || "");
        setStatus(c.status || "draft");
        setTriggerType(c.trigger_type === "segment" || c.trigger_type === "manual" ? c.trigger_type : "event");
        setEventType(c.trigger_config?.event_type || EVENT_TYPES[0].value);
        setFilters(c.trigger_config?.filters || { op: "and", rules: [] });
        setSegmentId(c.trigger_config?.segment_id ? String(c.trigger_config.segment_id) : "");
        setReenrollPolicy(c.reenrollment_policy || "skip");
        const loadedGoal = c.goal && (Array.isArray(c.goal) ? c.goal : c.goal.rules) ? c.goal : { op: "and", rules: [] };
        const hasGoalRules = Array.isArray(loadedGoal) ? loadedGoal.length > 0 : (loadedGoal.rules || []).length > 0;
        setGoalEnabled(hasGoalRules);
        setGoal(Array.isArray(loadedGoal) ? { op: "and", rules: loadedGoal } : loadedGoal);
        const loaded = Array.isArray(c.steps) ? c.steps : [];
        setSteps(loaded);
        setLoadedSteps(loaded);
        setSegments(Array.isArray(segRes?.segments) ? segRes.segments : []);
        setGuided((c.status || "draft") === "draft" && loaded.length === 0);
      } catch (err) {
        notify(err.message || "Failed to load campaign", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function save({ silent = false } = {}) {
    // Reordering/inserting ahead of an in-flight enrollment's
    // waiting_step_path can desync its resume point or double/skip a send
    // (see backend/automations.py) — true with the old button-reorder UI
    // too, not new here, but previously invisible. Surface it once at the
    // moment it matters instead of silently letting it happen.
    if (status === "active" && JSON.stringify(steps) !== JSON.stringify(loadedSteps)) {
      const ok = await confirm({
        title: "Active campaign has structural changes",
        description: "Learners currently paused mid-journey may resume at an unexpected step. Continue?",
        confirmText: "Save anyway",
        destructive: true,
      });
      if (!ok) return;
    }
    if ((triggerType === "segment" || triggerType === "manual") && !segmentId) {
      notify("Choose a segment for this trigger", "err");
      return;
    }
    setBusy(true);
    try {
      await api.updateAutomation(id, {
        name: name.trim() || "Untitled campaign",
        status,
        trigger_type: triggerType,
        trigger_config: triggerType === "event" ? { event_type: eventType, filters } : { segment_id: Number(segmentId) },
        steps,
        reenrollment_policy: triggerType === "manual" ? "skip" : reenrollPolicy,
        goal: goalEnabled && goal.rules?.length > 0 ? goal : null,
      });
      setLoadedSteps(steps);
      if (!silent) {
        notify("Saved");
        setGuided(false); // a deliberate Save from Review means setup is done — future visits get the free stepper
      }
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function refreshEnrollments() {
    setEnrollLoading(true);
    try {
      const d = await api.listAutomationEnrollments(id, { page: enrollList.page, pageSize: enrollList.pageSize, status: enrollList.get("status") });
      setEnrollments(Array.isArray(d?.enrollments) ? d.enrollments : []);
      setEnrollTotal(d?.total || 0);
    } catch (err) {
      notify(err.message || "Failed to load enrollments", "err");
    } finally {
      setEnrollLoading(false);
    }
  }
  async function refreshSends() {
    setSendLoading(true);
    try {
      const d = await api.listAutomationSends(id, { page: sendList.page, pageSize: sendList.pageSize, status: sendList.get("status") });
      setSends(Array.isArray(d?.sends) ? d.sends : []);
      setSendTotal(d?.total || 0);
    } catch (err) {
      notify(err.message || "Failed to load send log", "err");
    } finally {
      setSendLoading(false);
    }
  }

  async function refreshAnalytics() {
    setAnalyticsLoading(true);
    try {
      const d = await api.getAutomationAnalytics(id);
      setAnalytics(d);
    } catch (err) {
      notify(err.message || "Failed to load analytics", "err");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "enrollments") refreshEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, enrollList.page, enrollList.pageSize, enrollList.get("status")]);
  useEffect(() => {
    if (tab === "sends") refreshSends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sendList.page, sendList.pageSize, sendList.get("status")]);
  useEffect(() => {
    if (tab === "analytics") refreshAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function testRun() {
    const uid = Number(testUserId);
    if (!Number.isFinite(uid) || uid <= 0) {
      notify("Enter a valid user id", "err");
      return;
    }
    setBusy(true);
    try {
      await api.testRunAutomation(id, uid, true);
      notify(`Test run enrolled user #${uid}`);
      if (tab === "enrollments") refreshEnrollments();
      if (tab === "sends") refreshSends();
    } catch (err) {
      notify(err.message || "Test run failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function resendUser(userId, userLabel) {
    const ok = await confirm({
      title: `Restart this campaign for ${userLabel || `user #${userId}`}?`,
      description: "Re-enrolls them from the very first step, right now — bypassing trigger filters and re-enrollment rules, same as Test run. Any real emails/pushes in the step graph will actually send again.",
      confirmText: "Resend",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.testRunAutomation(id, userId, true);
      notify(`Restarted for ${userLabel || `user #${userId}`}`);
      if (tab === "enrollments") refreshEnrollments();
      if (tab === "sends") refreshSends();
    } catch (err) {
      notify(err.message || "Resend failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function sendNow() {
    const segName = segments.find((s) => String(s.id) === segmentId)?.name || "this segment";
    let count = null;
    try {
      const preview = await api.previewSegmentCount(Number(segmentId));
      count = preview?.count;
    } catch {
      // preview is best-effort — still let the confirm dialog show without a count
    }
    const ok = await confirm({
      title: `Send "${name || "this campaign"}" now?`,
      description: count != null
        ? `This emails ${count} learner${count === 1 ? "" : "s"} currently matching "${segName}", right now. This can't be undone, and the campaign archives afterward.`
        : `This sends to everyone currently matching "${segName}", right now. This can't be undone, and the campaign archives afterward.`,
      confirmText: "Send now",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.sendNowAutomation(id);
      notify(`Sent to ${res?.sent ?? 0} learner${res?.sent === 1 ? "" : "s"}`);
      setStatus("archived");
    } catch (err) {
      notify(err.message || "Send failed", "err");
    } finally {
      setBusy(false);
    }
  }

  const triggerLabel = triggerType === "event"
    ? EVENT_TYPES.find((e) => e.value === eventType)?.label || eventType
    : `Segment: ${segments.find((s) => String(s.id) === segmentId)?.name || "choose one"}`;

  if (loading) {
    return (
      <CmsLayout active="automations" title="Loading…">
        <div className="p-6 text-sm text-slate-500">Loading campaign…</div>
      </CmsLayout>
    );
  }

  return (
    <CmsLayout
      active="automations"
      title={name || "Campaign"}
      breadcrumb={[{ label: "Automations", to: "/cms/automations" }, { label: name || "Edit" }]}
      actions={
        canEdit ? (
          <Button onClick={save} disabled={busy}>
            <Save className="h-4 w-4" /> Save
          </Button>
        ) : null
      }
    >
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cms/automations")} className="text-slate-500">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Button>
      </div>

      {!canEdit && (
        <Note tone="warning" className="mb-5">You have view-only CRM access — ask an editor to make changes.</Note>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="sends">Send log</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "edit" && (
        <CampaignWizard
          guided={guided}
          canEdit={canEdit}
          name={name} setName={setName}
          status={status} setStatus={setStatus}
          triggerType={triggerType} setTriggerType={setTriggerType}
          eventType={eventType} setEventType={setEventType}
          filters={filters} setFilters={setFilters}
          segmentId={segmentId} setSegmentId={setSegmentId}
          reenrollPolicy={reenrollPolicy} setReenrollPolicy={setReenrollPolicy}
          goalEnabled={goalEnabled} setGoalEnabled={setGoalEnabled}
          goal={goal} setGoal={setGoal}
          steps={steps} setSteps={setSteps}
          segments={segments} stepStats={stepStats} triggerLabel={triggerLabel}
          EVENT_TYPES={EVENT_TYPES}
          busy={busy} onSave={save}
          testUserId={testUserId} setTestUserId={setTestUserId} onTestRun={testRun}
          onSendNow={sendNow}
        />
      )}

      {tab === "enrollments" && (
        <SectionCard title="Enrollments">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Select value={enrollList.get("status") || "all"} onValueChange={(v) => enrollList.set({ status: v === "all" ? "" : v })}>
              <SelectTrigger className="h-9 w-[10rem] text-xs font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ENROLLMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs font-semibold text-slate-400">{enrollTotal} total</span>
          </div>
          <DataTable
            columns={[
              { key: "user", header: "User", cell: (e) => <span className="font-semibold text-slate-700">{e.user_name || e.email}</span> },
              { key: "status", header: "Status", cell: (e) => <Badge variant="outline">{e.status}</Badge> },
              { key: "waiting_step_path", header: "Waiting at", hideBelow: "sm", cell: (e) => <span className="tabular-nums">{e.waiting_step_path || "—"}</span> },
              { key: "enrolled_at", header: "Enrolled", hideBelow: "md", cell: (e) => <span className="text-xs text-slate-400">{new Date(e.enrolled_at).toLocaleString()}</span> },
            ]}
            rows={enrollments}
            loading={enrollLoading}
            onRetry={refreshEnrollments}
            emptyState={<div className="p-6 text-center text-sm font-semibold text-slate-500">No enrollments match.</div>}
            rowActions={canEdit ? (e) => [
              { label: "Resend", icon: RotateCcw, onSelect: () => resendUser(e.user_id, e.user_name || e.email) },
            ] : undefined}
          />
          <Pagination page={enrollList.page} pageSize={enrollList.pageSize} total={enrollTotal} onPageChange={(p) => enrollList.set({ page: p })} onPageSizeChange={(pageSize) => enrollList.set({ pageSize })} className="mt-4" />
        </SectionCard>
      )}

      {tab === "sends" && (
        <SectionCard title="Send log">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Select value={sendList.get("status") || "all"} onValueChange={(v) => sendList.set({ status: v === "all" ? "" : v })}>
              <SelectTrigger className="h-9 w-[10rem] text-xs font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {SEND_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs font-semibold text-slate-400">{sendTotal} total</span>
          </div>
          <DataTable
            columns={[
              { key: "user", header: "User", cell: (s) => <span className="font-semibold text-slate-700">{s.user_name || s.email}</span> },
              { key: "action_type", header: "Action", cell: (s) => s.action_type },
              { key: "status", header: "Status", cell: (s) => <Badge variant={SEND_STATUS_VARIANT[s.status] || "outline"}>{s.status}</Badge> },
              { key: "created_at", header: "When", hideBelow: "sm", cell: (s) => <span className="text-xs text-slate-400">{new Date(s.created_at).toLocaleString()}</span> },
            ]}
            rows={sends}
            loading={sendLoading}
            onRetry={refreshSends}
            emptyState={<div className="p-6 text-center text-sm font-semibold text-slate-500">Nothing matches.</div>}
            rowActions={canEdit ? (s) => [
              { label: "Resend", icon: RotateCcw, onSelect: () => resendUser(s.user_id, s.user_name || s.email) },
            ] : undefined}
          />
          <Pagination page={sendList.page} pageSize={sendList.pageSize} total={sendTotal} onPageChange={(p) => sendList.set({ page: p })} onPageSizeChange={(pageSize) => sendList.set({ pageSize })} className="mt-4" />
        </SectionCard>
      )}

      {tab === "analytics" && (
        <SectionCard title="Analytics" description="Per-step counts also show up right on the canvas nodes in the Edit tab.">
          <CampaignAnalytics analytics={analytics} loading={analyticsLoading} />
        </SectionCard>
      )}
    </CmsLayout>
  );
}
