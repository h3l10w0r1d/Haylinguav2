// src/AffiliateDashboardPage.jsx — self-serve dashboard for approved
// affiliates: referral link, click/referral/conversion stats, commission
// owed vs. paid. Requires the same login used across the rest of the app.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Copy, MousePointerClick, Users, CheckCircle2, Wallet, Loader2, Clock, Ban,
} from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
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

export default function AffiliateDashboardPage() {
  const navigate = useNavigate();
  const token = getToken();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | none | pending | rejected | suspended | approved
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setState("logged_out"); return; }
    apiFetch("/affiliate/me", { token })
      .then((d) => {
        setData(d);
        setState(d.affiliate.status);
      })
      .catch((err) => setState(err.status === 404 ? "none" : "error"));
  }, [token]);

  const referralLink = data ? `${window.location.origin}/?ref=${data.affiliate.referral_code}` : "";

  function copyLink() {
    navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      <div className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Affiliate dashboard</h1>

        {state === "loading" && (
          <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        )}

        {state === "logged_out" && (
          <div className="mt-6 rounded-3xl bg-slate-50 p-8 text-center ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
            <p className="text-sm font-semibold text-slate-500 dark:text-stone-400">Log in to see your affiliate stats.</p>
            <button onClick={() => navigate("/", { state: { openAuth: "login" } })} className="btn3d btn3d-brand mt-4 text-sm">Log in</button>
          </div>
        )}

        {state === "none" && (
          <div className="mt-6 rounded-3xl bg-slate-50 p-8 text-center ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
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
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
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

            <p className="mt-6 text-xs font-semibold text-slate-400 dark:text-stone-500">
              {data.affiliate.commission_rate}% commission per paid subscription. {data.paid_commission > 0 && `֏${data.paid_commission.toLocaleString()} paid out so far.`}
            </p>
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
