// src/cms/CmsAffiliates.jsx — approve affiliate applications, adjust
// commission rates, and track referrals/payouts.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import {
  Check, ChevronRight, Percent, MousePointerClick, Users, DollarSign,
  Copy, Ban, RotateCcw, Wallet, Mail,
} from "lucide-react";
import CmsLayout from "./CmsLayout";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";
const STATUS_TONE = {
  pending: "bg-brand-50 text-brand-700 ring-brand-200",
  approved: "bg-grass-50 text-grass-700 ring-grass-200",
  suspended: "bg-cardinal-50 text-cardinal-700 ring-cardinal-200",
  rejected: "bg-slate-100 text-slate-500 ring-slate-200",
};

// Turns sparse {day, count} backend rows into a dense 30-point series so the
// chart doesn't jump around on days with zero activity.
function fillDays(clicksRows, signupsRows) {
  const clickMap = {}, signupMap = {};
  (clicksRows || []).forEach((r) => { clickMap[String(r.day).slice(0, 10)] = Number(r.count) || 0; });
  (signupsRows || []).forEach((r) => { signupMap[String(r.day).slice(0, 10)] = Number(r.count) || 0; });
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, clicks: clickMap[iso] || 0, signups: signupMap[iso] || 0 });
  }
  return out;
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
      <Icon className="h-3.5 w-3.5 text-slate-400" /> {value} <span className="font-semibold text-slate-400">{label}</span>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-500"><Icon className="h-4.5 w-4.5" /></div>
      <div className="mt-2 font-display text-xl font-extrabold tabular-nums text-slate-800">{value}</div>
      <div className="text-xs font-bold text-slate-400">{label}</div>
    </div>
  );
}

function AnalyticsSummary({ api, showToast }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getAffiliatesAnalytics().then(setData).catch((err) => showToast(err.message || "Failed to load analytics", "err"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;
  const series = fillDays(data.clicks_daily, data.signups_daily);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard icon={Users} label="Approved affiliates" value={data.approved_count} />
        <SummaryCard icon={MousePointerClick} label="Total clicks" value={data.total_clicks} />
        <SummaryCard icon={Users} label="Total referred" value={data.total_referred} />
        <SummaryCard icon={Check} label="Converted" value={data.total_converted} />
        <SummaryCard icon={Wallet} label="Owed" value={`֏${data.total_pending_commission.toLocaleString()}`} />
        <SummaryCard icon={DollarSign} label="Paid out" value={`֏${data.total_paid_commission.toLocaleString()}`} />
      </div>
      <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">Clicks & signups — last 30 days</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad_clicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f2994a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f2994a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad_signups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#f2994a" strokeWidth={2} fill="url(#grad_clicks)" dot={false} />
              <Area type="monotone" dataKey="signups" name="Signups" stroke="#22c55e" strokeWidth={2} fill="url(#grad_signups)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ReferralsPanel({ affiliate, api, showToast }) {
  const [referrals, setReferrals] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await api.listAffiliateReferrals(affiliate.id);
    setReferrals(Array.isArray(res?.referrals) ? res.referrals : []);
  }

  useEffect(() => {
    refresh().catch((err) => showToast(err.message || "Failed to load referrals", "err"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliate.id]);

  async function markPaid(id) {
    setBusy(true);
    try {
      await api.markReferralPaid(id);
      await refresh();
    } catch (err) {
      showToast(err.message || "Failed to update", "err");
    } finally {
      setBusy(false);
    }
  }

  if (referrals === null) return <div className="border-t border-slate-100 p-4 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="border-t border-slate-100 p-4">
      {referrals.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-center text-xs font-semibold text-slate-400">No referrals yet.</div>
      ) : (
        <div className="space-y-1.5">
          {referrals.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{r.username}</span>
              <span className="text-xs font-semibold text-slate-400">{r.email}</span>
              <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase", r.converted_at ? "bg-grass-50 text-grass-700" : "bg-slate-100 text-slate-500")}>
                {r.converted_at ? "converted" : "signed up"}
              </span>
              {r.commission_amount != null && (
                <span className="text-xs font-extrabold text-slate-600 tabular-nums">֏{Number(r.commission_amount).toLocaleString()}</span>
              )}
              {r.converted_at && r.commission_amount != null && (
                r.payout_status === "paid" ? (
                  <span className="rounded-full bg-grass-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-grass-700">Paid</span>
                ) : (
                  <button type="button" onClick={() => markPaid(r.id)} disabled={busy} className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-brand-600 ring-1 ring-brand-200 hover:bg-brand-50">
                    Mark paid
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CmsAffiliates() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [rateEdits, setRateEdits] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2800);
  }

  async function refresh() {
    const res = await api.listAffiliates();
    const list = Array.isArray(res?.affiliates) ? res.affiliates : [];
    setAffiliates(list);
    const r = {};
    list.forEach((a) => { r[a.id] = a.commission_rate; });
    setRateEdits(r);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load affiliates", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function approve(a) {
    setBusy(true);
    try {
      await api.approveAffiliate(a.id);
      await refresh();
      showToast(`Approved — referral link is live`);
    } catch (err) {
      showToast(err.message || "Approve failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(a, status) {
    setBusy(true);
    try {
      await api.updateAffiliate(a.id, { status });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveRate(a) {
    setBusy(true);
    try {
      await api.updateAffiliate(a.id, { commission_rate: Number(rateEdits[a.id]) || 0 });
      await refresh();
      showToast("Commission rate saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  function copyLink(code) {
    const link = `${window.location.origin}/?ref=${code}`;
    navigator.clipboard?.writeText(link);
    showToast("Referral link copied");
  }

  return (
    <CmsLayout active="affiliates" title="Affiliates">
      <div className="space-y-6">
        <AnalyticsSummary api={api} showToast={showToast} />
      <div className="space-y-3">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : affiliates.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">No applications yet.</div>
        ) : (
          affiliates.map((a) => (
            <div key={a.id} className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-extrabold text-slate-800">{a.applied_name}</span>
                    <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ring-1", STATUS_TONE[a.status])}>{a.status}</span>
                    {a.payout_requested_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-gold-700 ring-1 ring-gold-200">
                        <Wallet className="h-3 w-3" /> Payout requested
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-400">{a.applied_email} · {a.applied_platform}{a.applied_audience ? ` · ${a.applied_audience}` : ""}</div>
                  {a.applied_message && <p className="mt-2 text-xs font-medium text-slate-500">{a.applied_message}</p>}

                  {a.status === "approved" && (
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <button type="button" onClick={() => copyLink(a.referral_code)} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100">
                        <Copy className="h-3.5 w-3.5" /> {a.referral_code}
                      </button>
                      <Stat icon={MousePointerClick} label="clicks" value={a.click_count} />
                      <Stat icon={Users} label={`referred (${a.converted_count} paid)`} value={a.referred_count} />
                      <Stat icon={DollarSign} label="owed" value={`֏${Number(a.pending_commission).toLocaleString()}`} />
                      {a.payout_email && <Stat icon={Mail} label="payout email" value={a.payout_email} />}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {a.status === "pending" && (
                    <button type="button" onClick={() => approve(a)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Approve</button>
                  )}
                  {a.status === "approved" && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1 rounded-2xl bg-slate-50 px-2 py-1 ring-2 ring-slate-200">
                        <input type="number" step="0.5" value={rateEdits[a.id] ?? a.commission_rate} onChange={(e) => setRateEdits((p) => ({ ...p, [a.id]: e.target.value }))} className="w-14 bg-transparent text-sm font-bold text-slate-700 focus:outline-none" />
                        <Percent className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <button type="button" onClick={() => saveRate(a)} disabled={busy} className="btn3d btn3d-neutral text-xs">Save</button>
                    </div>
                  )}
                  {(a.status === "approved" || a.status === "pending") && (
                    <button type="button" onClick={() => setStatus(a, a.status === "pending" ? "rejected" : "suspended")} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-cardinal-600">
                      <Ban className="h-3.5 w-3.5" /> {a.status === "pending" ? "Reject" : "Suspend"}
                    </button>
                  )}
                  {(a.status === "suspended" || a.status === "rejected") && (
                    <button type="button" onClick={() => setStatus(a, "approved")} disabled={busy || !a.referral_code} className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline disabled:opacity-50">
                      <RotateCcw className="h-3.5 w-3.5" /> Reactivate
                    </button>
                  )}
                  {a.status === "approved" && (
                    <button type="button" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700">
                      <ChevronRight className={cx("h-3.5 w-3.5 transition-transform", expandedId === a.id && "rotate-90")} /> Referrals
                    </button>
                  )}
                </div>
              </div>
              {expandedId === a.id && <ReferralsPanel affiliate={a} api={api} showToast={showToast} />}
            </div>
          ))
        )}
      </div>
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
