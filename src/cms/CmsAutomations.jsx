// src/cms/CmsAutomations.jsx — campaign list for the marketing-automation
// engine (backend/automations.py). A "new campaign" form + a DataTable of
// existing campaigns, server-paginated (search + status filter) since this
// list can genuinely grow. Step-graph editing itself lives in
// AutomationEditor.jsx (a separate route) — kept split from this list since
// the editor is a much bigger surface (wait/condition/multi-channel-action
// editing).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCmsApi, getCmsClaim, getCmsToken } from "./api";
import { Archive, Pause, Play, Plus, Zap } from "lucide-react";
import CmsLayout from "./CmsLayout";
import {
  Badge, Button, DataTable, ListToolbar, Note, Pagination, Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue, SearchInput, SectionCard, notify, useConfirm, useListQuery,
} from "./ui";

// Only events actually instrumented server-side so far — keep this list in
// sync as more get added. "streak_broke" is detected by a cron scan
// (automations.detect_streak_breaks), not raised inline like the others.
export const EVENT_TYPES = [
  { value: "signup", label: "User signs up" },
  { value: "email_verified", label: "Email verified" },
  { value: "lesson_completed", label: "Lesson completed" },
  { value: "streak_broke", label: "Streak breaks" },
  { value: "purchase", label: "Premium purchase" },
];

const STATUSES = ["draft", "active", "paused", "archived"];
const STATUS_VARIANT = { draft: "outline", active: "secondary", paused: "outline", archived: "outline" };

export default function CmsAutomations() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const canEdit = getCmsClaim("crm_role", "editor") !== "viewer";

  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);

  const list = useListQuery();

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const d = await api.listAutomations({ page: list.page, pageSize: list.pageSize, q: list.q, status: list.get("status") });
      setCampaigns(Array.isArray(d?.campaigns) ? d.campaigns : []);
      setTotal(d?.total || 0);
    } catch (err) {
      setLoadError(err?.message || err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, list.page, list.pageSize, list.q, list.get("status")]);

  async function createCampaign() {
    // Deliberately minimal — name and trigger are the guided wizard's own
    // step 1 now (CampaignWizard.jsx), not asked twice across two
    // different-looking screens. A brand-new draft with zero steps is
    // exactly the signal AutomationEditor.jsx uses to land in guided mode.
    setBusy(true);
    try {
      const res = await api.createAutomation({
        name: "Untitled campaign",
        status: "draft",
        trigger_type: "event",
        trigger_config: { event_type: EVENT_TYPES[0].value, filters: { op: "and", rules: [] } },
        steps: [],
        reenrollment_policy: "skip",
      });
      navigate(`/cms/automations/${res.id}`);
    } catch (err) {
      notify(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(c, status) {
    setBusy(true);
    try {
      await api.updateAutomation(c.id, {
        name: c.name, status, trigger_type: c.trigger_type,
        trigger_config: c.trigger_config, steps: c.steps || [],
        reenrollment_policy: c.reenrollment_policy,
      });
      await refresh();
      notify(status === "active" ? "Campaign activated" : "Campaign paused");
    } catch (err) {
      notify(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function archiveCampaign(c) {
    const ok = await confirm({
      title: `Archive "${c.name}"?`,
      description: "Enrollment/send history is kept.",
      confirmText: "Archive",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteAutomation(c.id);
      await refresh();
      notify("Archived");
    } catch (err) {
      notify(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    {
      key: "name",
      header: "Campaign",
      cell: (c) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900">{c.name}</span>
            <Badge variant={STATUS_VARIANT[c.status]} className="capitalize">{c.status}</Badge>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-slate-400">
            Trigger: {c.trigger_type === "segment" ? "Segment entry" : c.trigger_type === "manual" ? "One-time send" : EVENT_TYPES.find((e) => e.value === c.trigger_config?.event_type)?.label || c.trigger_config?.event_type || "—"}
          </div>
        </div>
      ),
    },
    { key: "active_enrollments", header: "In progress", align: "right", hideBelow: "sm", cell: (c) => <span className="tabular-nums">{c.active_enrollments}</span> },
    { key: "updated_at", header: "Updated", align: "right", hideBelow: "md", cell: (c) => <span className="text-xs text-slate-400">{new Date(c.updated_at).toLocaleDateString()}</span> },
  ];

  const rowActions = (c) => {
    const actions = [];
    if (canEdit) {
      if (c.status === "active") actions.push({ label: "Pause", icon: Pause, onSelect: () => setStatus(c, "paused") });
      else if (c.status !== "archived") actions.push({ label: "Activate", icon: Play, onSelect: () => setStatus(c, "active") });
      if (c.status !== "archived") actions.push({ label: "Archive", icon: Archive, onSelect: () => archiveCampaign(c), destructive: true });
    }
    return actions;
  };

  return (
    <CmsLayout active="automations" title="Automations" description="Triggered, multi-step campaigns that react to user behavior.">
      <div className="space-y-6">
        <Note tone="brand">
          E.g. "on signup, send a welcome email." A campaign starts as a draft; set it to Active once its steps are ready.
        </Note>

        {!canEdit && (
          <Note tone="warning">You have view-only CRM access — ask an editor to create or change campaigns.</Note>
        )}

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={createCampaign} disabled={busy}>
              <Plus className="h-4 w-4" /> New campaign
            </Button>
          </div>
        )}

        <SectionCard title="Campaigns">
          <ListToolbar
            search={<SearchInput value={list.q} onChange={(q) => list.set({ q })} placeholder="Search campaigns…" />}
            count={total}
            countLabel="campaign"
          >
            <Select value={list.get("status") || "all"} onValueChange={(v) => list.set({ status: v === "all" ? "" : v })}>
              <SelectTrigger className="h-9 w-[9rem] text-xs font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </ListToolbar>
          <DataTable
            columns={columns}
            rows={campaigns}
            loading={loading}
            error={loadError}
            onRetry={refresh}
            onRowClick={(c) => navigate(`/cms/automations/${c.id}`)}
            rowActions={canEdit ? rowActions : undefined}
            emptyState={
              <div className="p-8 text-center text-sm font-semibold text-slate-500">
                {list.q || list.get("status") ? "No campaigns match." : "No campaigns yet — create one above."}
              </div>
            }
          />
          <Pagination page={list.page} pageSize={list.pageSize} total={total} onPageChange={(p) => list.set({ page: p })} onPageSizeChange={(pageSize) => list.set({ pageSize })} className="mt-4" />
        </SectionCard>
      </div>
    </CmsLayout>
  );
}
