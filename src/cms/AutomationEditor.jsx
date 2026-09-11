// src/cms/AutomationEditor.jsx — single-campaign editor: trigger config +
// step canvas (delegated to journey/JourneyCanvas, a drag-and-drop
// flowchart over the same wait/action/condition step tree), plus server-
// paginated enrollment/send-log tabs so QA has somewhere to look once a
// campaign is live.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createCmsApi, getCmsClaim, getCmsToken } from "./api";
import { ArrowLeft, PlayCircle, Save } from "lucide-react";
import CmsLayout from "./CmsLayout";
import FilterRuleBuilder from "./FilterRuleBuilder";
import JourneyCanvas from "./journey/JourneyCanvas";
import { EVENT_TYPES } from "./CmsAutomations";
import {
  Badge, Button, DataTable, Field, FieldRow, Input, Note, Pagination, SectionCard,
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
  const [eventType, setEventType] = useState(EVENT_TYPES[0].value);
  const [filters, setFilters] = useState({ op: "and", rules: [] });
  const [reenrollPolicy, setReenrollPolicy] = useState("skip");
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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [c, segRes] = await Promise.all([api.getAutomation(id), api.listSegments()]);
        setName(c.name || "");
        setStatus(c.status || "draft");
        setEventType(c.trigger_config?.event_type || EVENT_TYPES[0].value);
        setFilters(c.trigger_config?.filters || { op: "and", rules: [] });
        setReenrollPolicy(c.reenrollment_policy || "skip");
        const loaded = Array.isArray(c.steps) ? c.steps : [];
        setSteps(loaded);
        setLoadedSteps(loaded);
        setSegments(Array.isArray(segRes?.segments) ? segRes.segments : []);
      } catch (err) {
        notify(err.message || "Failed to load campaign", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  async function save() {
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
    setBusy(true);
    try {
      await api.updateAutomation(id, {
        name: name.trim() || "Untitled campaign",
        status,
        trigger_type: "event",
        trigger_config: { event_type: eventType, filters },
        steps,
        reenrollment_policy: reenrollPolicy,
      });
      setLoadedSteps(steps);
      notify("Saved");
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

  useEffect(() => {
    if (tab === "enrollments") refreshEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, enrollList.page, enrollList.pageSize, enrollList.get("status")]);
  useEffect(() => {
    if (tab === "sends") refreshSends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sendList.page, sendList.pageSize, sendList.get("status")]);

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
        </TabsList>
      </Tabs>

      {tab === "edit" && (
        <div className="space-y-6">
          <SectionCard title="Campaign settings">
            <FieldRow>
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Status">
                <Select value={status} onValueChange={setStatus} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["draft", "active", "paused", "archived"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </FieldRow>
          </SectionCard>

          <SectionCard title="Trigger" id="automation-trigger-section">
            <Field label="When this happens">
              <Select value={eventType} onValueChange={setEventType} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>

            <div className="mt-4">
              <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">Only if (optional audience filters)</div>
              <FilterRuleBuilder group={filters} onChange={setFilters} segments={segments} />
            </div>

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
          </SectionCard>

          <SectionCard
            title="Steps"
            description="Drag from the palette to add a step, drag a step onto a + to move it. A condition branches into its own nested steps; a wait suspends until the scheduled cron resumes it, re-checking any condition that follows fresh."
            bodyClassName="h-[70vh] min-h-[520px] overflow-hidden rounded-2xl ring-1 ring-slate-200"
          >
            <JourneyCanvas steps={steps} onChange={setSteps} segments={segments} readOnly={!canEdit} triggerEventType={eventType} />
          </SectionCard>

          {canEdit && (
            <SectionCard title="Test run" description="Runs this campaign's steps against a real user right now, bypassing trigger filters and re-enrollment — for QA only.">
              <div className="flex items-center gap-2">
                <Input value={testUserId} onChange={(e) => setTestUserId(e.target.value)} placeholder="User ID" className="max-w-[10rem]" />
                <Button variant="outline" onClick={testRun} disabled={busy}>
                  <PlayCircle className="h-4 w-4" /> Run
                </Button>
              </div>
            </SectionCard>
          )}
        </div>
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
          />
          <Pagination page={sendList.page} pageSize={sendList.pageSize} total={sendTotal} onPageChange={(p) => sendList.set({ page: p })} onPageSizeChange={(pageSize) => sendList.set({ pageSize })} className="mt-4" />
        </SectionCard>
      )}
    </CmsLayout>
  );
}
