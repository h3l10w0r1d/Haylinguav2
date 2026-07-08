// src/cms/CmsAnalytics.jsx — Advanced analytics dashboard for CMS admins
import { useEffect, useState, useCallback } from "react";
import {
  Users, TrendingUp, BookOpen, Zap, Target, RefreshCw,
  Activity, BarChart2, Globe, Mic, AlertTriangle, Shield,
} from "lucide-react";
import CmsLayout from "./CmsLayout";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getCmsToken() {
  try { return localStorage.getItem("hay_cms_token") || ""; } catch { return ""; }
}

async function fetchAnalytics() {
  const res = await fetch(`${API_BASE}/cms/analytics`, {
    headers: { "X-CMS-Token": getCmsToken() },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

function fmt(n, decimals = 0) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  if (decimals === 0) return v.toLocaleString();
  return v.toFixed(decimals);
}

function pct(n) {
  if (n == null) return "—";
  const v = Number(n);
  return Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—";
}

function fillDays(rows, key = "count", days = 30) {
  const map = {};
  (rows || []).forEach((r) => { map[String(r.day).slice(0, 10)] = Number(r[key]) || 0; });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    out.push({ date: iso, value: map[iso] || 0, label });
  }
  return out;
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, tone = "bg-brand-50 text-brand-600", accent }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-4 flex gap-3">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-2xl font-extrabold text-slate-800 tabular-nums leading-tight">
          {value}
        </div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</div>
        {sub && <div className="text-xs font-semibold text-slate-400 mt-0.5">{sub}</div>}
      </div>
      {accent && (
        <div className="ml-auto text-sm font-extrabold text-grass-600 self-start">{accent}</div>
      )}
    </div>
  );
}

// ─── Mini bar chart (reuse ActivityChart logic inline for control) ─────────────

function MiniBarChart({ data, color = "from-brand-600 to-brand-400", height = 120, label = "" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const show = data.filter((_, i) => data.length <= 14 || i % 2 === 0 || i === data.length - 1);

  return (
    <div>
      {label && <div className="mb-2 text-xs font-extrabold text-slate-500 uppercase tracking-wide">{label}</div>}
      <div className="relative" style={{ height }}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ bottom: `${g * 100}%` }} />
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-slate-200" />
        <div className="absolute inset-0 flex items-end gap-0.5">
          {data.map((x, i) => {
            const frac = x.value > 0 ? Math.max(0.03, x.value / max) : 0;
            return (
              <div key={x.date || i} className="group flex h-full flex-1 flex-col items-center justify-end" title={`${x.label}: ${fmt(x.value)}`}>
                {x.value > 0 ? (
                  <div
                    className={`w-full rounded-t-sm bg-gradient-to-t ${color} transition-all`}
                    style={{ height: `calc((100% - 2px) * ${frac})` }}
                  />
                ) : (
                  <div className="h-0.5 w-full rounded-full bg-slate-200" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {data.map((x, i) => {
          const visible = show.some((s) => s.date === x.date);
          return (
            <div key={x.date || i} className="flex-1 text-center">
              {visible && <span className="text-[9px] font-bold text-slate-400">{x.label.replace(/^\d+\//, "")}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Horizontal % bar ─────────────────────────────────────────────────────────

function HBar({ label, value, total, color = "bg-brand-500", badge }) {
  const frac = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-28 shrink-0 text-xs font-semibold text-slate-700 truncate" title={label}>{label}</div>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${frac * 100}%` }} />
      </div>
      <div className="w-10 text-right text-xs font-extrabold text-slate-600 tabular-nums">{fmt(value)}</div>
      {badge && <div className="w-10 text-right text-xs font-semibold text-slate-400">{(frac * 100).toFixed(0)}%</div>}
    </div>
  );
}

// ─── Funnel row ───────────────────────────────────────────────────────────────

function FunnelRow({ label, value, base, color = "bg-brand-500" }) {
  const frac = base > 0 ? Math.min(1, value / base) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 text-sm font-semibold text-slate-700">{label}</div>
      <div className="flex-1 h-6 rounded-xl bg-slate-100 overflow-hidden relative">
        <div className={`h-full rounded-xl ${color} transition-all`} style={{ width: `${frac * 100}%` }} />
        <span className="absolute inset-0 flex items-center pl-2 text-xs font-extrabold text-white mix-blend-luminosity">
          {fmt(value)}
        </span>
      </div>
      <div className="w-12 text-right text-xs font-bold text-slate-500">{(frac * 100).toFixed(0)}%</div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, className = "" }) {
  return (
    <div className={`rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="h-4 w-4 text-brand-500 shrink-0" />}
        <h2 className="font-display text-base font-extrabold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Churn ring ───────────────────────────────────────────────────────────────

function ChurnRing({ active, at_risk, churned, never }) {
  const total = (active || 0) + (at_risk || 0) + (churned || 0) + (never || 0) || 1;
  const segments = [
    { label: "Active (7d)", value: active || 0, color: "bg-grass-500", text: "text-grass-700" },
    { label: "At risk (8–30d)", value: at_risk || 0, color: "bg-gold-400", text: "text-gold-700" },
    { label: "Churned (30d+)", value: churned || 0, color: "bg-cardinal-500", text: "text-cardinal-700" },
    { label: "Never active", value: never || 0, color: "bg-slate-300", text: "text-slate-600" },
  ];
  return (
    <div className="space-y-2.5">
      {segments.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full shrink-0 ${s.color}`} />
          <div className="text-sm font-semibold text-slate-700 flex-1">{s.label}</div>
          <div className={`text-sm font-extrabold tabular-nums ${s.text}`}>{fmt(s.value)}</div>
          <div className="text-xs font-semibold text-slate-400 w-10 text-right">
            {((s.value / total) * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Auth method pills ────────────────────────────────────────────────────────

function AuthPills({ methods }) {
  const total = Object.values(methods || {}).reduce((a, b) => a + (b || 0), 0) || 1;
  const items = [
    { label: "Password", key: "password_only", color: "bg-slate-400" },
    { label: "Google", key: "google_only", color: "bg-sky-500" },
    { label: "Telegram", key: "telegram_only", color: "bg-blue-500" },
    { label: "Both OAuth", key: "both_oauth", color: "bg-brand-500" },
  ];
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <HBar
          key={it.key}
          label={it.label}
          value={(methods || {})[it.key] || 0}
          total={total}
          color={it.color}
          badge
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CmsAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await fetchAnalytics();
      setData(d);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};

  const newUsersSeries = fillDays(data?.new_users_daily || [], "count", 30);
  const dauSeries      = fillDays(data?.dau_daily || [], "count", 30);
  const lessonSeries   = fillDays(data?.lessons_daily || [], "count", 30);
  const exerciseSeries = fillDays(data?.exercises_daily || [], "count", 30);

  const totalUsers = Number(s.total_users) || 0;
  const onboardFunnel = {
    signed_up: totalUsers,
    verified:  Number(s.verified_users) || 0,
    onboarded: Number(s.onboarded) || 0,
    completed: Number(s.completed) || 0,
  };

  return (
    <CmsLayout
      active="analytics"
      title="Analytics"
      breadcrumb={[{ label: "CMS" }, { label: "Analytics" }]}
      actions={
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs font-semibold text-slate-400">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 rounded-2xl bg-cardinal-50 ring-1 ring-cardinal-200 px-4 py-3 text-sm font-semibold text-cardinal-700">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-24 text-slate-400 font-bold text-sm">
          Loading analytics…
        </div>
      )}

      {data && (
        <div className="space-y-6">

          {/* ── KPI row ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={Users}     label="Total users"      value={fmt(s.total_users)}    tone="bg-brand-50 text-brand-600" />
            <KpiCard icon={Activity}  label="DAU"              value={fmt(s.dau)}             tone="bg-grass-50 text-grass-600"
                     sub={s.mau > 0 ? `WAU ${fmt(s.wau)} · MAU ${fmt(s.mau)}` : undefined} />
            <KpiCard icon={TrendingUp} label="New (30d)"       value={fmt(s.new_30d)}         tone="bg-feather-50 text-feather-600"
                     sub={`+${fmt(s.new_7d)} this week`} />
            <KpiCard icon={BookOpen}  label="Lessons today"    value={fmt(s.completions_today)} tone="bg-gold-50 text-gold-600"
                     sub={`${fmt(s.completions_7d)} this week`} />
            <KpiCard icon={Zap}       label="Exercises today"  value={fmt(s.attempts_today)}  tone="bg-cardinal-50 text-cardinal-500"
                     sub={`${pct(s.avg_accuracy)} avg accuracy`} />
            <KpiCard icon={Shield}    label="Premium"          value={fmt(s.premium_users)}   tone="bg-slate-100 text-slate-600"
                     sub={totalUsers > 0 ? `${((Number(s.premium_users) / totalUsers) * 100).toFixed(1)}% of users` : undefined} />
          </div>

          {/* ── Time series ─────────────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-4">
            <Section title="New sign-ups (30 days)" icon={TrendingUp}>
              <MiniBarChart data={newUsersSeries} color="from-brand-600 to-brand-400" height={130} />
            </Section>
            <Section title="Daily active users (30 days)" icon={Activity}>
              <MiniBarChart data={dauSeries} color="from-grass-600 to-grass-400" height={130} />
            </Section>
            <Section title="Lessons completed (30 days)" icon={BookOpen}>
              <MiniBarChart data={lessonSeries} color="from-gold-500 to-gold-300" height={130} />
            </Section>
            <Section title="Exercise attempts (30 days)" icon={Zap}>
              <MiniBarChart data={exerciseSeries} color="from-cardinal-500 to-cardinal-300" height={130} />
            </Section>
          </div>

          {/* ── Funnel + Churn ──────────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-4">
            <Section title="Onboarding funnel" icon={Target}>
              <div className="space-y-2.5">
                <FunnelRow label="Signed up"     value={onboardFunnel.signed_up} base={onboardFunnel.signed_up} color="bg-brand-500" />
                <FunnelRow label="Email verified" value={onboardFunnel.verified}  base={onboardFunnel.signed_up} color="bg-grass-500" />
                <FunnelRow label="Onboarded"      value={onboardFunnel.onboarded} base={onboardFunnel.signed_up} color="bg-gold-400" />
                <FunnelRow label="Completed flow"  value={onboardFunnel.completed} base={onboardFunnel.signed_up} color="bg-feather-500" />
              </div>
            </Section>
            <Section title="User engagement health" icon={AlertTriangle}>
              <ChurnRing
                active={s.dau}
                at_risk={Number(s.at_risk_30d)}
                churned={Number(s.churned)}
                never={Number(s.never_active)}
              />
            </Section>
          </div>

          {/* ── Content performance ─────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-4">
            <Section title="Top lessons by completions" icon={BookOpen}>
              {(data.top_lessons || []).length === 0 ? (
                <p className="text-sm text-slate-400 font-semibold">No lesson data yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.top_lessons.map((l, i) => (
                    <HBar
                      key={l.id || i}
                      label={l.title || `Lesson ${l.id}`}
                      value={l.completions}
                      total={data.top_lessons[0]?.completions || 1}
                      color="bg-brand-500"
                      badge
                    />
                  ))}
                </div>
              )}
            </Section>
            <Section title="Chapters by unique learners" icon={BarChart2}>
              {(data.chapter_progress || []).length === 0 ? (
                <p className="text-sm text-slate-400 font-semibold">No chapter data yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.chapter_progress.map((c, i) => (
                    <HBar
                      key={c.chapter || i}
                      label={c.chapter || `Chapter ${i + 1}`}
                      value={c.unique_learners}
                      total={data.chapter_progress[0]?.unique_learners || 1}
                      color="bg-grass-500"
                      badge
                    />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* ── Segmentation ────────────────────────────────────────────── */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Section title="Voice preference" icon={Mic}>
              {(data.voice_dist || []).length === 0 ? (
                <p className="text-sm text-slate-400 font-semibold">No data yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.voice_dist.map((v, i) => (
                    <HBar
                      key={v.voice_pref || i}
                      label={v.voice_pref || "Unknown"}
                      value={v.count}
                      total={data.voice_dist.reduce((a, x) => a + (x.count || 0), 0)}
                      color={["bg-brand-500","bg-grass-500","bg-cardinal-500"][i % 3]}
                      badge
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Knowledge level" icon={BarChart2}>
              {(data.knowledge_dist || []).length === 0 ? (
                <p className="text-sm text-slate-400 font-semibold">No data yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.knowledge_dist.map((v, i) => (
                    <HBar
                      key={v.level || i}
                      label={v.level || "Unknown"}
                      value={v.count}
                      total={data.knowledge_dist.reduce((a, x) => a + (x.count || 0), 0)}
                      color={["bg-feather-500","bg-gold-400","bg-brand-500","bg-grass-500"][i % 4]}
                      badge
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Daily goal (minutes)" icon={Target}>
              {(data.goal_dist || []).length === 0 ? (
                <p className="text-sm text-slate-400 font-semibold">No data yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.goal_dist.map((v, i) => (
                    <HBar
                      key={v.goal_min || i}
                      label={`${v.goal_min} min`}
                      value={v.count}
                      total={data.goal_dist.reduce((a, x) => a + (x.count || 0), 0)}
                      color="bg-brand-500"
                      badge
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Top countries" icon={Globe}>
              {(data.country_dist || []).length === 0 ? (
                <p className="text-sm text-slate-400 font-semibold">No data yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.country_dist.map((v, i) => (
                    <HBar
                      key={v.country || i}
                      label={v.country || "Unknown"}
                      value={v.count}
                      total={data.country_dist.reduce((a, x) => a + (x.count || 0), 0)}
                      color="bg-brand-500"
                      badge
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Streak distribution" icon={Activity}>
              {(data.streak_dist || []).length === 0 ? (
                <p className="text-sm text-slate-400 font-semibold">No data yet.</p>
              ) : (
                <div className="space-y-0.5">
                  {data.streak_dist.map((v, i) => (
                    <HBar
                      key={v.bucket || i}
                      label={v.bucket === "0" ? "No streak" : `${v.bucket} days`}
                      value={v.count}
                      total={data.streak_dist.reduce((a, x) => a + (x.count || 0), 0)}
                      color={v.bucket === "0" ? "bg-slate-400" : v.bucket === "30+" ? "bg-grass-500" : "bg-brand-500"}
                      badge
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Sign-in methods" icon={Shield}>
              <AuthPills methods={data.auth_methods} />
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
                <div>
                  <span className="font-extrabold text-sky-600">{fmt(s.google_users)}</span>
                  {" "}Google linked
                </div>
                <div>
                  <span className="font-extrabold text-blue-600">{fmt(s.telegram_users)}</span>
                  {" "}Telegram linked
                </div>
              </div>
            </Section>
          </div>

          {/* ── Summary totals ──────────────────────────────────────────── */}
          <Section title="All-time totals" icon={BarChart2}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total XP awarded",       value: fmt(s.total_xp_awarded) },
                { label: "Total lessons completed", value: fmt(s.total_completions) },
                { label: "Total exercise attempts", value: fmt(s.total_attempts) },
                { label: "Overall accuracy",        value: pct(s.avg_accuracy) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3">
                  <div className="font-display text-xl font-extrabold text-slate-800 tabular-nums">
                    {item.value}
                  </div>
                  <div className="text-xs font-bold text-slate-400 mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          </Section>

        </div>
      )}
    </CmsLayout>
  );
}
