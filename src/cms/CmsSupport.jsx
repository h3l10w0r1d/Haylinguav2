// src/cms/CmsSupport.jsx
import React, { useState, useEffect } from "react";
import {
  Search, Crown, Heart, MailCheck, Loader2, User, ArrowLeft,
  Flame, Zap, BookOpen, Target, Users, Gem, Shield, Globe, Calendar,
  TrendingUp, Award, Star, Activity, Eye, EyeOff, Check, AlertTriangle,
} from "lucide-react";
import { getCmsToken } from "./api";
import CmsLayout from "./CmsLayout";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const ACH_ICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };
const TIER_LABEL = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

function fmtDate(s, opts = {}) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...opts });
}
function fmtShort(s) { return fmtDate(s, { year: undefined }); }

export default function CmsSupport() {
  const token = getCmsToken();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("users");
  const [reports, setReports] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);

  async function api(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error((typeof d?.detail === "string" && d.detail) || `Request failed (${res.status})`);
    }
    return res.json().catch(() => null);
  }

  async function search(e) {
    e?.preventDefault?.();
    setErr(""); setSearching(true); setDetail(null);
    try { setResults((await api(`/cms/support/users?q=${encodeURIComponent(q.trim())}`))?.users || []); }
    catch (e) { setErr(e.message); } finally { setSearching(false); }
  }
  useEffect(() => { search(); }, []); // eslint-disable-line

  async function openUser(id) {
    setErr(""); setLoadingDetail(true);
    try { setDetail(await api(`/cms/support/users/${id}`)); }
    catch (e) { setErr(e.message); } finally { setLoadingDetail(false); }
  }

  async function act(key, path, opts) {
    setBusy(key); setErr("");
    try { await api(path, { method: "POST", ...opts }); if (detail) await openUser(detail.id); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  }

  async function loadReports() {
    setLoadingReports(true); setErr("");
    try { setReports((await api("/cms/support/reports?status=open"))?.reports || []); }
    catch (e) { setErr(e.message); } finally { setLoadingReports(false); }
  }

  function switchTab(t) {
    setTab(t); setErr("");
    if (t === "reports" && reports === null) loadReports();
  }

  async function resolveReport(id) {
    setBusy("report-" + id);
    try { await api(`/cms/support/reports/${id}/resolve`, { method: "POST" }); setReports((r) => (r || []).filter((x) => x.id !== id)); }
    catch (e) { setErr(e.message); } finally { setBusy(""); }
  }

  if (!token) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
        <p className="font-semibold text-slate-600">Log in to the CMS to use Support.</p>
        <a href="/cms/login" className="btn3d btn3d-brand mt-4 inline-block px-5 py-2.5 font-semibold">CMS login</a>
      </div>
    </div>
  );

  return (
    <CmsLayout active="learners" title="Learners">
      <div className="mb-5 flex gap-2">
        <button onClick={() => { switchTab("users"); setDetail(null); }} className={"rounded-2xl px-4 py-2 text-sm font-bold transition " + (tab === "users" ? "bg-brand-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>Users</button>
        <button onClick={() => switchTab("reports")} className={"rounded-2xl px-4 py-2 text-sm font-bold transition " + (tab === "reports" ? "bg-brand-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
          Reports{Array.isArray(reports) && reports.length ? ` (${reports.length})` : ""}
        </button>
      </div>

      {err ? <div className="mb-4 rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600 ring-1 ring-cardinal-100">{err}</div> : null}

      {tab === "reports" ? (
        <ReportsList reports={reports} loading={loadingReports} busy={busy} onResolve={resolveReport} />
      ) : detail ? (
        loadingDetail ? (
          <div className="flex items-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
        ) : (
          <UserDetail detail={detail} busy={busy} act={act} onBack={() => setDetail(null)} />
        )
      ) : (
        <>
          <form onSubmit={search} className="relative mb-5">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email, username, or user ID…"
              className="w-full rounded-2xl bg-white py-3.5 pl-12 pr-28 font-semibold text-slate-800 ring-2 ring-slate-200 focus:outline-none focus:ring-brand-400" />
            <button type="submit" disabled={searching} className="btn3d btn3d-brand absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 text-sm font-bold">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </button>
          </form>
          <div className="space-y-2">
            {results.map((u) => (
              <button key={u.id} onClick={() => openUser(u.id)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition hover:ring-brand-300">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><User className="h-5 w-5" /></div>
                  <div>
                    <div className="font-bold text-slate-800">{u.display_name || u.username || "—"}</div>
                    <div className="text-sm text-slate-500">{u.email} · #{u.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.is_premium && <Badge color="amber">Premium</Badge>}
                  <Badge color={u.email_verified ? "grass" : "slate"}>{u.email_verified ? "Verified" : "Unverified"}</Badge>
                </div>
              </button>
            ))}
            {searching && !results.length ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : !results.length ? (
              <div className="py-10 text-center text-sm font-semibold text-slate-400">{q.trim() ? "No learners match your search." : "No learners yet."}</div>
            ) : null}
          </div>
        </>
      )}
    </CmsLayout>
  );
}

// ─── User Detail ──────────────────────────────────────────────────────────────
const DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "lessons", label: "Lessons" },
  { id: "achievements", label: "Achievements" },
  { id: "profile", label: "Profile" },
];

function UserDetail({ detail: d, busy, act, onBack }) {
  const [activeTab, setActiveTab] = useState("overview");

  const engagementScore = Math.min(100, Math.round(
    (Math.min(d.total_xp, 2000) / 2000) * 40 +
    (Math.min(d.current_streak, 30) / 30) * 30 +
    (Math.min(d.lessons_completed, 20) / 20) * 30
  ));

  const churnRisk = d.days_since_active == null ? "Unknown"
    : d.days_since_active <= 2 ? "Low"
    : d.days_since_active <= 7 ? "Medium"
    : "High";
  const churnColor = { Low: "text-grass-600", Medium: "text-amber-500", High: "text-cardinal-500", Unknown: "text-slate-400" }[churnRisk];

  return (
    <div className="flex flex-col gap-0 lg:flex-row lg:items-start lg:gap-5">
      {/* ── Left panel ───────────────────────────────────────── */}
      <div className="w-full shrink-0 space-y-3 lg:w-64">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Avatar + identity */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 text-center">
          {d.avatar_url ? (
            <img src={d.avatar_url} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover ring-2 ring-slate-200" />
          ) : (
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-3xl font-extrabold text-white">
              {(d.display_name || d.username || "?")[0].toUpperCase()}
            </div>
          )}
          <div className="mt-3 font-display text-base font-extrabold text-slate-900">{d.display_name || d.username || "—"}</div>
          <div className="text-xs text-slate-400">@{d.username || "—"} · #{d.id}</div>
          <div className="mt-1 text-xs text-slate-400 break-all">{d.email}</div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {d.is_premium && <Badge color="amber">👑 Premium</Badge>}
            <Badge color={d.email_verified ? "grass" : "slate"}>{d.email_verified ? "✓ Verified" : "Unverified"}</Badge>
            {d.totp_enabled && <Badge color="slate">🔐 2FA</Badge>}
            {d.is_hidden && <Badge color="slate">Hidden</Badge>}
          </div>
        </div>

        {/* Key numbers */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 space-y-3">
          <PanelStat icon={<Zap className="h-4 w-4 text-brand-500" />} label="Total XP" value={d.total_xp.toLocaleString()} />
          <PanelStat icon={<Flame className="h-4 w-4 text-orange-500" />} label="Streak" value={`${d.current_streak} days`} />
          <PanelStat icon={<BookOpen className="h-4 w-4 text-sky-500" />} label="Lessons done" value={d.lessons_completed} />
          <PanelStat icon={<Target className="h-4 w-4 text-grass-600" />} label="Accuracy" value={`${d.accuracy_pct}%`} />
          <PanelStat icon={<Gem className="h-4 w-4 text-cyan-400" />} label="Gems" value={d.gems} />
          <PanelStat icon={<TrendingUp className="h-4 w-4 text-purple-500" />} label="Weekly XP" value={d.weekly_xp} />
          <PanelStat icon={<Users className="h-4 w-4 text-pink-500" />} label="Friends" value={d.friends_count} />
          <PanelStat icon={<Heart className="h-4 w-4 text-cardinal-500" />} label="Hearts" value={d.is_premium ? "∞" : `${d.hearts_current}/${d.hearts_max}`} />
        </div>

        {/* Details */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 space-y-2 text-xs">
          <Detail label="Joined" value={fmtDate(d.joined_at)} />
          <Detail label="Last active" value={d.days_since_active != null ? `${d.days_since_active}d ago` : "—"} />
          {d.premium_since && <Detail label="Premium since" value={fmtDate(d.premium_since)} />}
          {d.country && <Detail label="Country" value={d.country} />}
          {d.timezone && <Detail label="Timezone" value={d.timezone} />}
          <Detail label="League" value={TIER_LABEL[d.league_tier] || "Bronze"} />
          <Detail label="Streak freezes" value={d.streak_freezes} />
          <Detail label="Chests" value={d.chests} />
          <Detail label="Days practiced" value={d.days_active} />
          <Detail label="Exercises done" value={(d.exercises_done || 0).toLocaleString()} />
        </div>

        {/* Admin actions */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-3">Admin actions</div>
          <button disabled={busy === "premium"} onClick={() => act("premium", `/cms/support/users/${d.id}/premium`, { body: JSON.stringify({ active: !d.is_premium }) })}
            className={"flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-60 " + (d.is_premium ? "bg-slate-500 hover:bg-slate-600" : "bg-amber-500 hover:bg-amber-600")}>
            {busy === "premium" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            {d.is_premium ? "Revoke premium" : "Grant premium"}
          </button>
          <button disabled={busy === "hearts"} onClick={() => act("hearts", `/cms/support/users/${d.id}/hearts-refill`)}
            className="btn3d btn3d-cardinal flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold disabled:opacity-60">
            {busy === "hearts" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />} Refill hearts
          </button>
          {!d.email_verified && (
            <button disabled={busy === "verify"} onClick={() => act("verify", `/cms/support/users/${d.id}/verify-email`)}
              className="btn3d btn3d-grass flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold disabled:opacity-60">
              {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />} Verify email
            </button>
          )}
        </div>
      </div>

      {/* ── Main panel ───────────────────────────────────────── */}
      <div className="min-w-0 flex-1 mt-4 lg:mt-7">
        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 mb-5">
          {DETAIL_TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={"flex-1 rounded-xl py-2 text-sm font-bold transition " + (activeTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {t.label}
              {t.id === "achievements" && d.achievements?.length ? <span className="ml-1 text-xs opacity-60">({d.achievements.length})</span> : null}
              {t.id === "lessons" && d.lessons_completed ? <span className="ml-1 text-xs opacity-60">({d.lessons_completed})</span> : null}
            </button>
          ))}
        </div>

        {activeTab === "overview" && <OverviewTab d={d} engagementScore={engagementScore} churnRisk={churnRisk} churnColor={churnColor} />}
        {activeTab === "lessons" && <LessonsTab d={d} />}
        {activeTab === "achievements" && <AchievementsTab d={d} />}
        {activeTab === "profile" && <ProfileTab d={d} />}
      </div>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ d, engagementScore, churnRisk, churnColor }) {
  const activity = d.activity || [];
  const activityMap = {};
  activity.forEach((a) => { activityMap[a.day] = a.xp; });
  const today = new Date();
  const days30 = Array.from({ length: 30 }, (_, i) => {
    const dt = new Date(today); dt.setDate(dt.getDate() - (29 - i));
    const key = dt.toISOString().slice(0, 10);
    return { key, xp: activityMap[key] || 0, label: dt.getDate() };
  });
  const maxXp = Math.max(...days30.map((d) => d.xp), 1);

  return (
    <div className="space-y-4">
      {/* Score cards */}
      <div className="grid grid-cols-3 gap-3">
        <ScoreCard
          icon={<Activity className="h-4 w-4 text-brand-500" />}
          label="Engagement score"
          value={engagementScore}
          suffix="/100"
          bar={engagementScore}
          barColor="#F97316"
          sub={engagementScore >= 70 ? "Active learner" : engagementScore >= 40 ? "Moderate" : "Low engagement"}
        />
        <ScoreCard
          icon={<AlertTriangle className="h-4 w-4 text-cardinal-500" />}
          label="Churn risk"
          value={<span className={churnColor + " text-2xl font-extrabold"}>{churnRisk}</span>}
          sub={d.days_since_active != null ? `${d.days_since_active}d since last activity` : "No activity recorded"}
          bar={churnRisk === "High" ? 90 : churnRisk === "Medium" ? 50 : churnRisk === "Low" ? 15 : 0}
          barColor={churnRisk === "High" ? "#E11D48" : churnRisk === "Medium" ? "#F59E0B" : "#22B07D"}
        />
        <ScoreCard
          icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
          label="Accuracy"
          value={`${d.accuracy_pct}%`}
          suffix=""
          bar={d.accuracy_pct}
          barColor="#8B5CF6"
          sub={`${(d.correct_answers || 0).toLocaleString()} correct of ${(d.exercises_done || 0).toLocaleString()}`}
        />
      </div>

      {/* Activity chart */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-display text-sm font-extrabold text-slate-700">30-day activity</div>
          <div className="text-xs font-semibold text-slate-400">{d.days_active} days practiced total</div>
        </div>
        <div className="flex items-end gap-0.5 h-24">
          {days30.map((day) => (
            <div key={day.key} className="group relative flex flex-1 flex-col items-center">
              <div className="w-full rounded-sm transition-all"
                style={{ height: `${Math.max((day.xp / maxXp) * 88, day.xp > 0 ? 6 : 2)}px`, background: day.xp > 0 ? "#F97316" : "#E2E8F0" }} />
              {day.xp > 0 && (
                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 hidden rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white group-hover:block whitespace-nowrap shadow-lg">
                  {day.xp} XP
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[9px] font-semibold text-slate-300">
          <span>30 days ago</span><span>Today</span>
        </div>
      </div>

      {/* Recent lessons */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-sm font-extrabold text-slate-700">Recent lessons</div>
          <span className="text-xs font-semibold text-slate-400">{d.lessons_completed} total</span>
        </div>
        {(d.lesson_history || []).slice(0, 5).length === 0 ? (
          <div className="text-sm font-semibold text-slate-400 py-4 text-center">No lessons completed yet.</div>
        ) : (
          <div className="space-y-2">
            {(d.lesson_history || []).slice(0, 5).map((l, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 ring-1 ring-slate-100">
                <div>
                  <div className="text-sm font-bold text-slate-800">{l.title}</div>
                  <div className="text-xs text-slate-400">{l.chapter_title}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-extrabold text-brand-500">+{l.xp_earned} XP</span>
                  <span className="text-xs text-slate-400">{fmtShort(l.completed_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lessons tab ───────────────────────────────────────────────────────────────
function LessonsTab({ d }) {
  const lessons = d.lesson_history || [];
  if (!lessons.length) return <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 text-sm font-semibold text-slate-400">No lessons completed yet.</div>;
  return (
    <div className="rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-slate-400">Lesson</th>
            <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-slate-400">Chapter</th>
            <th className="px-5 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-slate-400">XP</th>
            <th className="px-5 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-slate-400">Date</th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((l, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition">
              <td className="px-5 py-3 font-semibold text-slate-800">{l.title}</td>
              <td className="px-5 py-3 text-slate-400 text-xs">{l.chapter_title || "—"}</td>
              <td className="px-5 py-3 text-right font-extrabold text-brand-500">+{l.xp_earned}</td>
              <td className="px-5 py-3 text-right text-slate-400 text-xs whitespace-nowrap">{fmtDate(l.completed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Achievements tab ──────────────────────────────────────────────────────────
function AchievementsTab({ d }) {
  const achs = d.achievements || [];
  if (!achs.length) return <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 text-sm font-semibold text-slate-400">No achievements claimed yet.</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {achs.map((a, i) => {
        const Icon = ACH_ICON[a.icon] || Star;
        return (
          <div key={i} className="flex items-center gap-4 rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white"
              style={{ background: a.color || "#F59E0B", boxShadow: "0 4px 0 0 rgba(0,0,0,0.18)" }}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-slate-900">{a.title}</div>
              <div className="text-xs text-slate-400">Claimed {fmtDate(a.claimed_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfileTab({ d }) {
  const rows = [
    ["User ID", `#${d.id}`],
    ["Email", d.email],
    ["Username", d.username || "—"],
    ["Display name", d.display_name || "—"],
    ["First name", d.first_name || "—"],
    ["Last name", d.last_name || "—"],
    ["Bio", d.bio || "—"],
    ["Country", d.country || "—"],
    ["Timezone", d.timezone || "—"],
    ["Joined", fmtDate(d.joined_at)],
    ["Last active", fmtDate(d.last_active_at)],
    ["Email verified", d.email_verified ? "Yes" : "No"],
    ["2FA enabled", d.totp_enabled ? "Yes" : "No"],
    ["Premium", d.is_premium ? `Yes (since ${fmtDate(d.premium_since)})` : "No"],
    ["Profile hidden", d.is_hidden ? "Yes" : "No"],
    ["Friends public", d.friends_public ? "Yes" : "No"],
  ];
  return (
    <div className="rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4 border-b border-slate-50 px-5 py-3 last:border-0">
          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400 shrink-0 pt-0.5">{label}</span>
          <span className="text-sm font-semibold text-slate-700 text-right break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ScoreCard({ icon, label, value, suffix, bar, barColor, sub }) {
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-center gap-2 mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">{icon}{label}</div>
      <div className="font-display text-2xl font-extrabold text-slate-900 leading-none">
        {typeof value === "string" ? value : value}{suffix && <span className="text-sm font-bold text-slate-400 ml-0.5">{suffix}</span>}
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(bar, 100)}%`, background: barColor }} />
      </div>
      <div className="mt-2 text-xs font-semibold text-slate-400">{sub}</div>
    </div>
  );
}

function PanelStat({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">{icon}{label}</div>
      <span className="text-sm font-extrabold text-slate-800">{value}</span>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400 uppercase tracking-wide font-bold" style={{ fontSize: 10 }}>{label}</span>
      <span className="font-semibold text-slate-700 text-right">{value ?? "—"}</span>
    </div>
  );
}

function Badge({ color, children }) {
  const cls = { amber: "bg-amber-50 text-amber-700", grass: "bg-grass-50 text-grass-700", slate: "bg-slate-100 text-slate-600" };
  return <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold " + (cls[color] || cls.slate)}>{children}</span>;
}

function ReportsList({ reports, loading, busy, onResolve }) {
  if (loading) return <div className="flex items-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading reports…</div>;
  if (!reports?.length) return <div className="py-10 text-center text-sm font-semibold text-slate-400">No open reports 🎉</div>;
  const LABEL = { wrong_answer: "Wrong answer", audio: "Audio problem", typo: "Typo", confusing: "Confusing", other: "Other" };
  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="amber">{LABEL[r.reason] || r.reason}</Badge>
                <span className="text-xs font-semibold text-slate-400">{r.lesson_title || "—"} · ex #{r.exercise_id}</span>
              </div>
              {r.exercise_prompt && <div className="mt-1 truncate text-sm font-bold text-slate-800">{r.exercise_prompt}</div>}
              {r.detail && <div className="mt-1 text-sm text-slate-600">"{r.detail}"</div>}
            </div>
            <button disabled={busy === "report-" + r.id} onClick={() => onResolve(r.id)}
              className="btn3d btn3d-grass shrink-0 px-3 py-2 text-sm font-bold disabled:opacity-60">
              {busy === "report-" + r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resolve"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
