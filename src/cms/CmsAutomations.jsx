// src/cms/CmsAutomations.jsx — campaign list for the marketing-automation
// engine (backend/automations.py). Structurally mirrors CmsPremium.jsx: a
// "new campaign" form + a list of existing campaigns, each with inline
// status controls. Step-graph editing itself lives in AutomationEditor.jsx
// (a separate route) since M2/M3 will grow that into wait/condition/
// multi-channel-action editing — kept split from this list from the start.
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Zap, Play, Pause, Archive, ChevronRight } from "lucide-react";
import CmsLayout from "./CmsLayout";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

// Only events actually instrumented server-side so far — keep this list in
// sync as M4 adds purchase/etc. "streak_broke" is detected by a cron scan
// (automations.detect_streak_breaks), not raised inline like the other two.
export const EVENT_TYPES = [
  { value: "signup", label: "User signs up" },
  { value: "lesson_completed", label: "Lesson completed" },
  { value: "streak_broke", label: "Streak breaks" },
  { value: "purchase", label: "Premium purchase" },
];

const STATUS_TONE = {
  draft: "bg-slate-100 text-slate-500 ring-slate-200",
  active: "bg-grass-50 text-grass-700 ring-grass-200",
  paused: "bg-gold-50 text-gold-700 ring-gold-200",
  archived: "bg-slate-100 text-slate-400 ring-slate-200",
};

export default function CmsAutomations() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [newName, setNewName] = useState("");
  const [newEvent, setNewEvent] = useState(EVENT_TYPES[0].value);

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const d = await api.listAutomations();
    setCampaigns(Array.isArray(d?.campaigns) ? d.campaigns : []);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load campaigns", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function createCampaign() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await api.createAutomation({
        name: newName.trim(),
        status: "draft",
        trigger_type: "event",
        trigger_config: { event_type: newEvent, filters: [] },
        steps: [],
        reenrollment_policy: "skip",
      });
      setNewName("");
      showToast("Campaign created");
      navigate(`/cms/automations/${res.id}`);
    } catch (err) {
      showToast(err.message || "Create failed", "err");
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
      showToast(status === "active" ? "Campaign activated" : "Campaign paused");
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function archiveCampaign(c) {
    if (!confirm(`Archive "${c.name}"? Enrollment/send history is kept.`)) return;
    setBusy(true);
    try {
      await api.deleteAutomation(c.id);
      await refresh();
      showToast("Archived");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CmsLayout active="automations" title="Automations">
      <div className="space-y-6">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          Triggered, multi-step campaigns that react to user behavior — e.g. "on signup, send a
          welcome email." A campaign starts as a draft; set it to Active once its steps are ready.
        </div>

        {/* New campaign */}
        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 font-display text-base font-bold text-slate-900">New campaign</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name — e.g. Welcome email" className={inputCls} />
            <select value={newEvent} onChange={(e) => setNewEvent(e.target.value)} className={inputCls}>
              {EVENT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={createCampaign} disabled={busy || !newName.trim()} className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60">
              <Plus className="h-4 w-4" /> Create & edit steps
            </button>
          </div>
        </section>

        {/* Existing campaigns */}
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">No campaigns yet.</div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                    <Zap className="h-5 w-5" />
                  </div>
                  <button type="button" onClick={() => navigate(`/cms/automations/${c.id}`)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-sm font-bold text-slate-900">{c.name}</span>
                      <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1", STATUS_TONE[c.status])}>{c.status}</span>
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-400">
                      Trigger: {c.trigger_config?.event_type || "—"} · {c.active_enrollments} in progress
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.status === "active" ? (
                      <button type="button" onClick={() => setStatus(c, "paused")} disabled={busy} title="Pause" className="grid h-9 w-9 place-items-center rounded-xl text-gold-600 ring-1 ring-slate-200 hover:bg-gold-50"><Pause className="h-4 w-4" /></button>
                    ) : c.status !== "archived" ? (
                      <button type="button" onClick={() => setStatus(c, "active")} disabled={busy} title="Activate" className="grid h-9 w-9 place-items-center rounded-xl text-grass-600 ring-1 ring-slate-200 hover:bg-grass-50"><Play className="h-4 w-4" /></button>
                    ) : null}
                    {c.status !== "archived" && (
                      <button type="button" onClick={() => archiveCampaign(c)} disabled={busy} title="Archive" className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"><Archive className="h-4 w-4" /></button>
                    )}
                    <button type="button" onClick={() => navigate(`/cms/automations/${c.id}`)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 ring-1 ring-slate-200 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className={cx("rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-1", toast.kind === "err" ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200" : "bg-grass-50 text-grass-700 ring-grass-200")}>
            {toast.msg}
          </div>
        </div>
      )}
    </CmsLayout>
  );
}
