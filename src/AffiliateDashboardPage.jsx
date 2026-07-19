// src/AffiliateDashboardPage.jsx — self-serve dashboard for approved
// affiliates: referral link, click/referral/conversion stats + a 30-day
// trend, and a payout request. Lives in the authenticated app (HeaderLayout,
// wired in App.jsx) rather than the public marketing site — this is an
// account feature for existing logged-in users, not a landing page.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import {
  Copy, MousePointerClick, Users, CheckCircle2, Wallet, Loader2, Clock, Ban, Send,
} from "lucide-react";
import { getToken, apiFetch } from "./api";

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 font-display text-2xl font-extrabold tabular-nums text-slate-800 dark:text-white">{value}</div>
      <div className="text-xs font-bold text-slate-400 dark:text-stone-500">{label}</div>
    </div>
  );
}

// Turns sparse {day, count} rows into a dense 30-point series so the chart
// doesn't jump around on days with zero activity.
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

export default function AffiliateDashboardPage() {
  const navigate = useNavigate();
  const token = getToken();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | logged_out | none | pending | rejected | suspended | approved | error
  const [copied, setCopied] = useState(false);
  const [payoutEmail, setPayoutEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState("");

  async function load() {
    if (!token) { setState("logged_out"); return; }
    try {
      const d = await apiFetch("/affiliate/me", { token });
      setData(d);
      setPayoutEmail(d.affiliate.payout_email || "");
      setState(d.affiliate.status);
    } catch (err) {
      setState(err.status === 404 ? "none" : "error");
    }
  }

  useEffect(() => { load(); }, [token]);

  const referralLink = data ? `${window.location.origin}/?ref=${data.affiliate.referral_code}` : "";

  function copyLink() {
    navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function savePayoutEmail(e) {
    e.preventDefault();
    setSavingEmail(true);
    setPayoutMsg("");
    try {
      await apiFetch("/affiliate/me", { method: "PUT", token, body: { payout_email: payoutEmail.trim() } });
      setPayoutMsg("Saved");
      setTimeout(() => setPayoutMsg(""), 2000);
    } catch (err) {
      setPayoutMsg(err.message || "Couldn't save");
    } finally {
      setSavingEmail(false);
    }
  }

  async function requestPayout() {
    setRequesting(true);
    setPayoutMsg("");
    try {
      await apiFetch("/affiliate/request-payout", { method: "POST", token });
      await load();
      setPayoutMsg("Payout requested — we'll process it soon.");
    } catch (err) {
      setPayoutMsg(err.message || "Couldn't request payout");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">Affiliate dashboard</h1>

        {state === "loading" && (
          <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        )}

        {state === "logged_out" && (
          <div className="mt-6 rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
            <p className="text-sm font-semibold text-slate-500 dark:text-stone-400">Log in to see your affiliate stats.</p>
            <button onClick={() => navigate("/", { state: { openAuth: "login" } })} className="btn3d btn3d-brand mt-4 text-sm">Log in</button>
          </div>
        )}

        {state === "none" && (
          <div className="mt-6 rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
            <p className="text-sm font-semibold text-slate-500 dark:text-stone-400">You haven't applied to the affiliate program yet.</p>
            <Link to="/affiliates" className="btn3d btn3d-brand mt-4 text-sm">Apply now</Link>
          </div>
        )}

        {state === "pending" && (
          <div className="mt-6 flex items-center gap-3 rounded-3xl bg-brand-50 p-6 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:ring-brand-500/25">
            <Clock className="h-6 w-6 shrink-0 text-brand-500" />
            <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">Your application is under review — we usually get back within a couple of days.</p>
          </div>
        )}

        {(state === "rejected" || state === "suspended") && (
          <div className="mt-6 flex items-center gap-3 rounded-3xl bg-cardinal-50 p-6 ring-1 ring-cardinal-200 dark:bg-cardinal-500/10 dark:ring-cardinal-500/25">
            <Ban className="h-6 w-6 shrink-0 text-cardinal-500" />
            <p className="text-sm font-semibold text-cardinal-700 dark:text-cardinal-300">
              {state === "suspended" ? "Your affiliate account is currently suspended." : "Your application wasn't approved."} Contact <a href="mailto:info@haylingua.am" className="underline">info@haylingua.am</a> with questions.
            </p>
          </div>
        )}

        {state === "error" && (
          <div className="mt-6 rounded-3xl bg-cardinal-50 p-8 text-center text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200 dark:bg-cardinal-500/10 dark:text-cardinal-300 dark:ring-cardinal-500/25">
            Couldn't load your dashboard — try again shortly.
          </div>
        )}

        {state === "approved" && data && (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-3xl bg-white p-4 ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
              <code className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700 dark:text-stone-200">{referralLink}</code>
              <button onClick={copyLink} className="btn3d btn3d-brand shrink-0 !px-4 text-sm">
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard icon={MousePointerClick} label="Link clicks" value={data.clicks} />
              <StatCard icon={Users} label="Signups" value={data.referred_count} />
              <StatCard icon={CheckCircle2} label="Paid conversions" value={data.converted_count} />
              <StatCard icon={Wallet} label="Owed to you" value={`֏${data.pending_commission.toLocaleString()}`} />
            </div>

            <p className="mt-3 text-xs font-semibold text-slate-400 dark:text-stone-500">
              {data.affiliate.commission_rate}% commission per paid subscription. {data.paid_commission > 0 && `֏${data.paid_commission.toLocaleString()} paid out so far.`}
            </p>

            <div className="mt-6 rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">Clicks & signups — last 30 days</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={fillDays(data.clicks_daily, data.signups_daily)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad_myclicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f2994a" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f2994a" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="grad_mysignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#f2994a" strokeWidth={2} fill="url(#grad_myclicks)" dot={false} />
                    <Area type="monotone" dataKey="signups" name="Signups" stroke="#22c55e" strokeWidth={2} fill="url(#grad_mysignups)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payout — investigation-scoped: this records where to send money
                and flags the request for manual review in the CMS. No real
                transfer happens here yet. */}
            <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Get paid</div>
              <form onSubmit={savePayoutEmail} className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  placeholder="Where should we send your payout?"
                  className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08]"
                />
                <button type="submit" disabled={savingEmail} className="btn3d btn3d-neutral text-sm">Save</button>
              </form>
              <button
                type="button"
                onClick={requestPayout}
                disabled={requesting || data.pending_commission <= 0 || !payoutEmail.trim() || !!data.affiliate.payout_requested_at}
                className="btn3d btn3d-brand mt-3 text-sm disabled:opacity-60"
              >
                {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {data.affiliate.payout_requested_at ? "Payout requested" : "Request payout"}
              </button>
              {payoutMsg && <p className="mt-2 text-xs font-bold text-brand-600 dark:text-brand-400">{payoutMsg}</p>}
              {data.pending_commission <= 0 && !data.affiliate.payout_requested_at && (
                <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-stone-500">You'll be able to request a payout once you have commission owed.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
