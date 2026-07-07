// src/cms/CmsSupport.jsx
import React, { useState, useEffect } from "react";
import {
  Search, Crown, Heart, MailCheck, Loader2, User, ArrowLeft, Check,
  Flame, Zap, BookOpen, Target, Users, Gem, Shield, Globe, Calendar,
  TrendingUp, Award, Snowflake, Eye, EyeOff, Star,
} from "lucide-react";
import { getCmsToken } from "./api";
import CmsLayout from "./CmsLayout";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const ACH_ICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };
const TIER_LABEL = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

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
    try {
      const d = await api(`/cms/support/users?q=${encodeURIComponent(q.trim())}`);
      setResults(d?.users || []);
    } catch (e) { setErr(e.message); } finally { setSearching(false); }
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
    try { const d = await api("/cms/support/reports?status=open"); setReports(d?.reports || []); }
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

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="font-semibold text-slate-600">Log in to the CMS to use Support.</p>
          <a href="/cms/login" className="btn3d btn3d-brand mt-4 inline-block px-5 py-2.5 font-semibold">CMS login</a>
        </div>
      </div>
    );
  }

  return (
    <CmsLayout active="learners" title="Learners">
      <div>
        <div className="mb-5 flex gap-2">
          <button onClick={() => switchTab("users")} className={"rounded-2xl px-4 py-2 text-sm font-bold transition " + (tab === "users" ? "bg-brand-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>Users</button>
          <button onClick={() => switchTab("reports")} className={"rounded-2xl px-4 py-2 text-sm font-bold transition " + (tab === "reports" ? "bg-brand-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50")}>
            Reports{Array.isArray(reports) && reports.length ? ` (${reports.length})` : ""}
          </button>
        </div>

        {err ? <div className="mb-4 rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600 ring-1 ring-cardinal-100">{err}</div> : null}

        {tab === "reports" ? (
          <ReportsList reports={reports} loading={loadingReports} busy={busy} onResolve={resolveReport} />
        ) : (
          <>
            <form onSubmit={search} className="relative mb-5">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email, username, or user ID…"
                className="w-full rounded-2xl bg-white py-3.5 pl-12 pr-28 font-semibold text-slate-800 ring-2 ring-slate-200 focus:outline-none focus:ring-brand-400"
              />
              <button type="submit" disabled={searching} className="btn3d btn3d-brand absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 text-sm font-bold">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </button>
            </form>

            {!detail ? (
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
                      {u.is_premium ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Premium</span> : null}
                      <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + (u.email_verified ? "bg-grass-50 text-grass-700" : "bg-slate-100 text-slate-500")}>
                        {u.email_verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </button>
                ))}
                {searching && results.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading learners…
                  </div>
                ) : results.length === 0 ? (
                  <div className="py-10 text-center text-sm font-semibold text-slate-400">
                    {q.trim() ? "No learners match your search." : "No learners yet."}
                  </div>
                ) : null}
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
            ) : (
              <UserDetail detail={detail} busy={busy} act={act} onBack={() => setDetail(null)} />
            )}
          </>
        )}
      </div>
    </CmsLayout>
  );
}

function UserDetail({ detail: d, busy, act, onBack }) {
  const accuracy = d.accuracy_pct ?? 0;
  const joinedDate = d.joined_at ? new Date(d.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const lastActive = d.last_active_at ? new Date(d.last_active_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
  const lastLesson = d.last_lesson_at ? new Date(d.last_lesson_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

  // Build 14-day activity grid
  const activityMap = {};
  (d.activity || []).forEach((a) => { activityMap[a.day] = a.xp; });
  const today = new Date();
  const days14 = Array.from({ length: 14 }, (_, i) => {
    const dt = new Date(today); dt.setDate(dt.getDate() - (13 - i));
    const key = dt.toISOString().slice(0, 10);
    return { key, xp: activityMap[key] || 0, label: dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }) };
  });
  const maxXp = Math.max(...days14.map((d) => d.xp), 1);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to results
      </button>

      {/* Header card */}
      <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {d.avatar_url ? (
              <img src={d.avatar_url} alt="" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-slate-200" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-2xl font-extrabold text-white">
                {(d.display_name || d.username || "?")[0].toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-display text-xl font-extrabold text-slate-900">{d.display_name || d.username || "—"}</div>
              <div className="text-sm text-slate-500">@{d.username || "—"} · #{d.id}</div>
              <div className="mt-0.5 text-sm text-slate-400">{d.email}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {d.is_premium && <Chip color="amber">👑 Premium</Chip>}
            {d.email_verified ? <Chip color="grass">✓ Verified</Chip> : <Chip color="slate">Unverified</Chip>}
            {d.totp_enabled && <Chip color="slate">🔐 2FA</Chip>}
            {d.is_hidden && <Chip color="slate"><EyeOff className="inline h-3 w-3" /> Hidden</Chip>}
            {d.country && <Chip color="slate"><Globe className="inline h-3 w-3 mr-0.5" />{d.country}</Chip>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-slate-400">
          <span><Calendar className="inline h-3.5 w-3.5 mr-0.5" />Joined {joinedDate}</span>
          {d.premium_since && <span><Crown className="inline h-3.5 w-3.5 mr-0.5 text-amber-500" />Premium since {new Date(d.premium_since).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
          <span>Last active: {lastActive}</span>
          {d.timezone && <span>🕐 {d.timezone}</span>}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={<Zap className="h-5 w-5 text-brand-500" />} label="Total XP" value={d.total_xp.toLocaleString()} bg="bg-brand-50" />
        <MetricCard icon={<Flame className="h-5 w-5 text-orange-500" />} label="Streak" value={`${d.current_streak} days`} sub={d.streak_freezes > 0 ? `${d.streak_freezes} freeze${d.streak_freezes > 1 ? "s" : ""}` : null} bg="bg-orange-50" />
        <MetricCard icon={<BookOpen className="h-5 w-5 text-sky-500" />} label="Lessons" value={d.lessons_completed} sub={`Last: ${lastLesson}`} bg="bg-sky-50" />
        <MetricCard icon={<Target className="h-5 w-5 text-grass-600" />} label="Accuracy" value={`${accuracy}%`} sub={`${(d.correct_answers || 0).toLocaleString()} correct`} bg="bg-grass-50" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={<Gem className="h-5 w-5 text-sky-400" />} label="Gems" value={d.gems} bg="bg-sky-50" />
        <MetricCard icon={<TrendingUp className="h-5 w-5 text-purple-500" />} label="Weekly XP" value={d.weekly_xp} sub={TIER_LABEL[d.league_tier] || "Bronze"} bg="bg-purple-50" />
        <MetricCard icon={<Users className="h-5 w-5 text-pink-500" />} label="Friends" value={d.friends_count} bg="bg-pink-50" />
        <MetricCard icon={<Heart className="h-5 w-5 text-cardinal-500" />} label="Hearts" value={d.is_premium ? "∞" : `${d.hearts_current}/${d.hearts_max}`} bg="bg-cardinal-50" />
      </div>

      {/* 14-day activity chart */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
        <div className="mb-3 font-display text-sm font-extrabold text-slate-700">14-day activity (XP per day)</div>
        <div className="flex items-end gap-1 h-20">
          {days14.map((day) => (
            <div key={day.key} className="group relative flex flex-1 flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max((day.xp / maxXp) * 64, day.xp > 0 ? 6 : 2)}px`,
                  background: day.xp > 0 ? "#F97316" : "#E2E8F0",
                }}
              />
              {day.xp > 0 && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block whitespace-nowrap">
                  {day.xp} XP
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {days14.map((day) => (
            <div key={day.key} className="flex-1 text-center text-[9px] font-semibold text-slate-300 leading-tight">
              {day.label.split(" ")[0]}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs font-semibold text-slate-400">
          <span>{d.days_active} days practiced total</span>
          <span>{d.exercises_done?.toLocaleString()} exercises done</span>
        </div>
      </div>

      {/* Achievements */}
      {d.achievements?.length > 0 && (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <div className="mb-3 font-display text-sm font-extrabold text-slate-700">Achievements ({d.achievements.length})</div>
          <div className="flex flex-wrap gap-2">
            {d.achievements.map((a, i) => {
              const Icon = ACH_ICON[a.icon] || Star;
              return (
                <div key={i} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <div className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: a.color || "#F59E0B" }}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{a.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin actions */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
        <div className="mb-3 font-display text-sm font-extrabold text-slate-700">Admin actions</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            disabled={busy === "premium"}
            onClick={() => act("premium", `/cms/support/users/${d.id}/premium`, { body: JSON.stringify({ active: !d.is_premium }) })}
            className={"inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition disabled:opacity-60 " + (d.is_premium ? "bg-slate-500 hover:bg-slate-600" : "bg-amber-500 hover:bg-amber-600")}
          >
            {busy === "premium" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            {d.is_premium ? "Revoke premium" : "Grant premium"}
          </button>
          <button
            disabled={busy === "hearts"}
            onClick={() => act("hearts", `/cms/support/users/${d.id}/hearts-refill`)}
            className="btn3d btn3d-cardinal inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold disabled:opacity-60"
          >
            {busy === "hearts" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />} Refill hearts
          </button>
          {!d.email_verified && (
            <button
              disabled={busy === "verify"}
              onClick={() => act("verify", `/cms/support/users/${d.id}/verify-email`)}
              className="btn3d btn3d-grass inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold disabled:opacity-60 sm:col-span-2"
            >
              {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />} Mark email verified
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, bg }) {
  return (
    <div className={"rounded-2xl p-4 ring-1 ring-slate-200 " + (bg || "bg-white")}>
      <div className="mb-2">{icon}</div>
      <div className="font-display text-xl font-extrabold text-slate-900">{value}</div>
      <div className="text-xs font-bold text-slate-500">{label}</div>
      {sub && <div className="mt-0.5 text-xs font-semibold text-slate-400">{sub}</div>}
    </div>
  );
}

function Chip({ color, children }) {
  const colors = {
    amber: "bg-amber-50 text-amber-700",
    grass: "bg-grass-50 text-grass-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold " + (colors[color] || colors.slate)}>{children}</span>;
}

function ReportsList({ reports, loading, busy, onResolve }) {
  if (loading) return <div className="flex items-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading reports…</div>;
  if (!reports || reports.length === 0) return <div className="py-10 text-center text-sm font-semibold text-slate-400">No open reports 🎉</div>;
  const LABEL = { wrong_answer: "Wrong answer", audio: "Audio problem", typo: "Typo", confusing: "Confusing", other: "Other" };
  return (
    <div className="space-y-2">
      {reports.map((r) => (
        <div key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">{LABEL[r.reason] || r.reason}</span>
                <span className="text-xs font-semibold text-slate-400">{r.lesson_title || "—"} · ex #{r.exercise_id}</span>
              </div>
              {r.exercise_prompt ? <div className="mt-1 truncate text-sm font-bold text-slate-800">{r.exercise_prompt}</div> : null}
              {r.detail ? <div className="mt-1 text-sm text-slate-600">"{r.detail}"</div> : null}
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
