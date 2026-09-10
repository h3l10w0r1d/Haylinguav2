// src/cms/AutomationEditor.jsx — single-campaign editor: trigger config +
// step list (delegated to the recursive StepListEditor, which handles
// wait/action/condition nodes and their nested branches). Also renders the
// enrollment/send-log tabs so QA has somewhere to look once a campaign is
// live.
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { ArrowLeft, Save, PlayCircle } from "lucide-react";
import CmsLayout from "./CmsLayout";
import FilterRuleBuilder from "./FilterRuleBuilder";
import StepListEditor from "./StepListEditor";
import { EVENT_TYPES } from "./CmsAutomations";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

export default function AutomationEditor() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);
  const navigate = useNavigate();
  const { id } = useParams();

  const [tab, setTab] = useState("edit"); // edit | enrollments | sends
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [segments, setSegments] = useState([]);

  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [eventType, setEventType] = useState(EVENT_TYPES[0].value);
  const [filters, setFilters] = useState([]);
  const [reenrollPolicy, setReenrollPolicy] = useState("skip");
  const [steps, setSteps] = useState([]);

  const PAGE_SIZE = 25;
  const [enrollments, setEnrollments] = useState(null);
  const [enrollTotal, setEnrollTotal] = useState(0);
  const [enrollPage, setEnrollPage] = useState(1);
  const [enrollStatusFilter, setEnrollStatusFilter] = useState("");
  const [sends, setSends] = useState(null);
  const [sendTotal, setSendTotal] = useState(0);
  const [sendPage, setSendPage] = useState(1);
  const [sendStatusFilter, setSendStatusFilter] = useState("");
  const [testUserId, setTestUserId] = useState("");

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [c, segRes] = await Promise.all([api.getAutomation(id), api.listSegments()]);
        setName(c.name || "");
        setStatus(c.status || "draft");
        setEventType(c.trigger_config?.event_type || EVENT_TYPES[0].value);
        setFilters(Array.isArray(c.trigger_config?.filters) ? c.trigger_config.filters : []);
        setReenrollPolicy(c.reenrollment_policy || "skip");
        setSteps(Array.isArray(c.steps) ? c.steps : []);
        setSegments(Array.isArray(segRes?.segments) ? segRes.segments : []);
      } catch (err) {
        showToast(err.message || "Failed to load campaign", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function save() {
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
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function loadEnrollments() {
    setTab("enrollments");
    if (enrollments) return;
    try {
      await refreshEnrollments(1, enrollStatusFilter);
    } catch (err) {
      showToast(err.message || "Failed to load enrollments", "err");
    }
  }
  async function loadSends() {
    setTab("sends");
    if (sends) return;
    try {
      await refreshSends(1, sendStatusFilter);
    } catch (err) {
      showToast(err.message || "Failed to load send log", "err");
    }
  }

  async function refreshEnrollments(page, statusFilter) {
    const d = await api.listAutomationEnrollments(id, { page, pageSize: PAGE_SIZE, status: statusFilter || undefined });
    setEnrollments(Array.isArray(d?.enrollments) ? d.enrollments : []);
    setEnrollTotal(d?.total || 0);
    setEnrollPage(page);
  }
  async function refreshSends(page, statusFilter) {
    const d = await api.listAutomationSends(id, { page, pageSize: PAGE_SIZE, status: statusFilter || undefined });
    setSends(Array.isArray(d?.sends) ? d.sends : []);
    setSendTotal(d?.total || 0);
    setSendPage(page);
  }
  function onEnrollStatusFilterChange(v) {
    setEnrollStatusFilter(v);
    refreshEnrollments(1, v).catch((err) => showToast(err.message || "Failed to filter", "err"));
  }
  function onSendStatusFilterChange(v) {
    setSendStatusFilter(v);
    refreshSends(1, v).catch((err) => showToast(err.message || "Failed to filter", "err"));
  }

  async function testRun() {
    const uid = Number(testUserId);
    if (!Number.isFinite(uid) || uid <= 0) {
      showToast("Enter a valid user id", "err");
      return;
    }
    setBusy(true);
    try {
      await api.testRunAutomation(id, uid, true);
      showToast(`Test run enrolled user #${uid}`);
      setSends(null); // force a refetch next time the Sends/Enrollments tab is opened
      setEnrollments(null);
    } catch (err) {
      showToast(err.message || "Test run failed", "err");
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
      breadcrumb={[{ label: "Automations", onClick: () => navigate("/cms/automations") }, { label: name || "Edit" }]}
      actions={
        <button type="button" onClick={save} disabled={busy} className="btn3d btn3d-brand text-sm inline-flex items-center gap-2">
          <Save className="h-4 w-4" /> Save
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={() => navigate("/cms/automations")} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </button>
      </div>

      <div className="mb-5 flex gap-2 border-b border-slate-200">
        {[
          { key: "edit", label: "Edit" },
          { key: "enrollments", label: "Enrollments", onClick: loadEnrollments },
          { key: "sends", label: "Send log", onClick: loadSends },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => (t.onClick ? t.onClick() : setTab(t.key))}
            className={cx(
              "px-3 py-2 text-sm font-bold border-b-2 -mb-px transition",
              tab === t.key ? "border-brand-500 text-brand-700" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "edit" && (
        <div className="space-y-6">
          {/* Campaign settings */}
          <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                  {["draft", "active", "paused", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Trigger */}
          <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
            <div className="mb-3 font-display text-base font-bold text-slate-900">Trigger</div>
            <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">When this happens</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputCls}>
              {EVENT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Only if (optional audience filters)</label>
              <FilterRuleBuilder filters={filters} onChange={setFilters} segments={segments} />
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">If a user triggers this again while already enrolled</label>
              <select value={reenrollPolicy} onChange={(e) => setReenrollPolicy(e.target.value)} className={inputCls}>
                <option value="skip">Skip — wait for the current run to finish</option>
                <option value="allow">Allow — start a new run alongside it</option>
              </select>
            </div>
          </section>

          {/* Steps */}
          <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
            <div className="mb-1 font-display text-base font-bold text-slate-900">Steps</div>
            <p className="mb-3 text-xs font-semibold text-slate-400">
              Run in order. A condition branches into its own nested steps; a wait suspends until
              the scheduled cron resumes it, re-checking any condition that follows fresh.
            </p>
            <StepListEditor steps={steps} onChange={setSteps} segments={segments} />
          </section>

          {/* Test run */}
          <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
            <div className="mb-2 font-display text-base font-bold text-slate-900">Test run</div>
            <p className="mb-3 text-xs font-semibold text-slate-400">
              Runs this campaign's steps against a real user right now, bypassing trigger filters and re-enrollment — for QA only.
            </p>
            <div className="flex items-center gap-2">
              <input value={testUserId} onChange={(e) => setTestUserId(e.target.value)} placeholder="User ID" className={cx(inputCls, "max-w-[10rem]")} />
              <button type="button" onClick={testRun} disabled={busy} className="btn3d btn3d-neutral text-sm inline-flex items-center gap-2">
                <PlayCircle className="h-4 w-4" /> Run
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === "enrollments" && (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <select value={enrollStatusFilter} onChange={(e) => onEnrollStatusFilterChange(e.target.value)} className={cx(inputCls, "!py-2 max-w-[10rem]")}>
              <option value="">All statuses</option>
              {["active", "waiting", "completed", "exited", "failed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs font-semibold text-slate-400">{enrollTotal} total</span>
          </div>
          {!enrollments ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : enrollments.length === 0 ? (
            <div className="text-sm font-semibold text-slate-500">No enrollments match.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Waiting at</th>
                      <th className="pb-2 pr-4">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrollments.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 pr-4 font-semibold text-slate-700">{e.user_name || e.email}</td>
                        <td className="py-2 pr-4">{e.status}</td>
                        <td className="py-2 pr-4 tabular-nums">{e.waiting_step_path || "—"}</td>
                        <td className="py-2 pr-4 text-slate-400">{new Date(e.enrolled_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PageControls page={enrollPage} total={enrollTotal} pageSize={PAGE_SIZE} onPage={(p) => refreshEnrollments(p, enrollStatusFilter)} />
            </>
          )}
        </section>
      )}

      {tab === "sends" && (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <select value={sendStatusFilter} onChange={(e) => onSendStatusFilterChange(e.target.value)} className={cx(inputCls, "!py-2 max-w-[10rem]")}>
              <option value="">All statuses</option>
              {["sent", "skipped", "failed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-xs font-semibold text-slate-400">{sendTotal} total</span>
          </div>
          {!sends ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : sends.length === 0 ? (
            <div className="text-sm font-semibold text-slate-500">Nothing matches.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                      <th className="pb-2 pr-4">User</th>
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sends.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 pr-4 font-semibold text-slate-700">{s.user_name || s.email}</td>
                        <td className="py-2 pr-4">{s.action_type}</td>
                        <td className="py-2 pr-4">
                          <span className={cx(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1",
                            s.status === "sent" ? "bg-grass-50 text-grass-700 ring-grass-200"
                              : s.status === "failed" ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200"
                              : "bg-slate-100 text-slate-500 ring-slate-200"
                          )}>{s.status}</span>
                        </td>
                        <td className="py-2 pr-4 text-slate-400">{new Date(s.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <PageControls page={sendPage} total={sendTotal} pageSize={PAGE_SIZE} onPage={(p) => refreshSends(p, sendStatusFilter)} />
            </>
          )}
        </section>
      )}

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

function PageControls({ page, total, pageSize, onPage }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-center gap-3">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="rounded-lg px-2 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40">Prev</button>
      <span className="text-xs font-semibold text-slate-400">Page {page} of {pageCount}</span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pageCount} className="rounded-lg px-2 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40">Next</button>
    </div>
  );
}
