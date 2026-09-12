// src/cms/journey/CampaignAnalytics.jsx — the "Analytics" tab's KPI grid.
// Composes the existing site-analytics shell components (src/cms/analytics/
// widgetShells.jsx) directly rather than reinventing chart cards — that
// drag-and-drop widget catalogue machinery is for the multi-widget
// site-wide dashboard, overkill for one campaign's fixed metric set.
import { SmallKPI } from "../analytics/widgetShells";

export default function CampaignAnalytics({ analytics, loading }) {
  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading analytics…</div>;
  }
  if (!analytics) {
    return <div className="p-6 text-sm font-semibold text-slate-500">No data yet.</div>;
  }

  const e = analytics.enrollments || {};
  const email = analytics.email || {};
  const openRate = email.sent ? Math.round(((email.opened || 0) / email.sent) * 1000) / 10 : null;
  const clickRate = email.sent ? Math.round(((email.clicked || 0) / email.sent) * 1000) / 10 : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Enrollments</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SmallKPI label="Total" value={e.total || 0} accent="#0F172A" />
          <SmallKPI label="Active" value={e.active || 0} accent="#1CB0F6" />
          <SmallKPI label="Waiting" value={e.waiting || 0} accent="#FFC800" />
          <SmallKPI label="Completed" value={e.completed || 0} accent="#58CC02" />
          <SmallKPI label="Exited (goal met)" value={e.exited_goal_met || 0} accent="#FF7A1A" />
          <SmallKPI label="Exited (other)" value={e.exited_other || 0} accent="#94A3B8" />
          <SmallKPI label="Failed" value={e.failed || 0} accent="#FF4B4B" />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Email</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <SmallKPI label="Sent" value={email.sent || 0} accent="#FF7A1A" />
          <SmallKPI label="Opened" value={email.opened || 0} sub={openRate != null ? `${openRate}% open rate` : null} accent="#1CB0F6" />
          <SmallKPI label="Clicked" value={email.clicked || 0} sub={clickRate != null ? `${clickRate}% click rate` : null} accent="#58CC02" />
        </div>
      </div>
    </div>
  );
}
