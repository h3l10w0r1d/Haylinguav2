// src/cms/analytics/useRenderWidget.jsx
// Dispatches widget id + size → the right card + chart.

import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { SmallKPI, MediumKPI, MdCard, LgCard } from "./widgetShells";
import { WIDGET_MAP } from "./widgetDefs";

// ── Shared palette for donut / bar slices ────────────────────────────────────
const PALETTE = [
  "#E85F00","#10B981","#0EA5E9","#8B5CF6","#F59E0B",
  "#EF4444","#6366F1","#14B8A6","#EC4899","#84CC16",
];

const TT_STYLE = {
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
  fontSize: 11,
  fontWeight: 700,
};

function fmt(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fillDays(rows, key = "count") {
  const map = {};
  (rows || []).forEach((r) => { if (r.day) map[String(r.day).slice(0, 10)] = Number(r[key]) || 0; });
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: map[iso] || 0, day: iso });
  }
  return out;
}

function AreaSpark({ data, color, height = "100%" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad_${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TT_STYLE} formatter={(v) => [fmt(v), ""]} labelStyle={{ color: "#64748b" }} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#grad_${color.replace("#", "")})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BarSpark({ data, color, nameKey = "label", height = "100%" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey={nameKey} tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={TT_STYLE} formatter={(v) => [fmt(v), ""]} />
        <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data, height = "100%" }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TT_STYLE}
          formatter={(v, _, props) => [
            `${fmt(v)} (${((v / total) * 100).toFixed(0)}%)`,
            props.payload?.name || "",
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Legend for donut (side list)
function DonutLegend({ data }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  return (
    <div className="flex flex-col justify-center gap-1 min-w-0">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5 min-w-0">
          <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
          <span className="text-[10px] font-semibold text-slate-600 truncate">{d.name}</span>
          <span className="ml-auto text-[10px] font-extrabold text-slate-400 tabular-nums shrink-0">
            {((d.value / total) * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── HBar for sm distributions ─────────────────────────────────────────────────
function HBarList({ data, color }) {
  const max = Math.max(1, ...data.map((d) => d.value || 0));
  return (
    <div className="space-y-1.5 overflow-y-auto h-full">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-20 shrink-0 text-[10px] font-semibold text-slate-600 truncate">{d.name}</div>
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${((d.value || 0) / max) * 100}%`, background: color }}
            />
          </div>
          <div className="text-[10px] font-extrabold text-slate-500 tabular-nums w-8 text-right">{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Funnel bars ───────────────────────────────────────────────────────────────
function FunnelBars({ data, color }) {
  const max = Math.max(1, ...data.map((d) => d.value || 0));
  return (
    <div className="space-y-2.5 overflow-y-auto h-full">
      {data.map((d, i) => {
        const frac = (d.value || 0) / max;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-xs font-semibold text-slate-600">{d.name}</div>
            <div className="flex-1 h-5 rounded-xl bg-slate-100 overflow-hidden relative">
              <div className="h-full rounded-xl transition-all" style={{ width: `${frac * 100}%`, background: color }} />
              <span className="absolute inset-0 flex items-center pl-2 text-[10px] font-extrabold text-white mix-blend-luminosity">
                {fmt(d.value)}
              </span>
            </div>
            <div className="text-[10px] font-bold text-slate-400 w-8 text-right">
              {data[0]?.value > 0 ? `${((d.value / data[0].value) * 100).toFixed(0)}%` : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main dispatch ─────────────────────────────────────────────────────────────
export function useRenderWidget(analytics) {
  const s = analytics?.summary || {};

  function renderWidget(id, size) {
    const def = WIDGET_MAP[id];
    if (!def) return null;
    const { label, accent } = def;

    // ── KPI widgets ────────────────────────────────────────────────────────
    const kpiMap = {
      w_total_users: { value: s.total_users, sub: `${s.verified_users != null ? fmt(s.verified_users) + " verified" : ""}` },
      w_dau:         { value: s.dau,         sub: s.wau != null ? `WAU ${fmt(s.wau)}` : undefined },
      w_wau:         { value: s.wau,         sub: s.mau != null ? `MAU ${fmt(s.mau)}` : undefined },
      w_mau:         { value: s.mau },
      w_new_30d:     { value: s.new_30d,     sub: s.new_7d != null ? `+${fmt(s.new_7d)} this week` : undefined },
      w_premium:     { value: s.premium_users, sub: s.total_users > 0 ? `${((Number(s.premium_users) / Number(s.total_users)) * 100).toFixed(1)}% of users` : undefined },
    };

    if (kpiMap[id]) {
      const { value, sub } = kpiMap[id];
      if (size === "sm") return <SmallKPI label={label} value={value} sub={sub} accent={accent} />;
      const series = fillDays(analytics?.new_users_daily, "count");
      return <MediumKPI label={label} value={value} sub={sub} accent={accent} sparkData={series} />;
    }

    // ── Trend widgets ──────────────────────────────────────────────────────
    if (id === "w_signups_trend") {
      const series = fillDays(analytics?.new_users_daily, "count");
      if (size === "lg") return (
        <LgCard label={label} sub="Last 30 days" accent={accent}>
          <AreaSpark data={series} color={accent} />
        </LgCard>
      );
      return (
        <MdCard label={label} sub="30d" accent={accent}>
          <AreaSpark data={series} color={accent} />
        </MdCard>
      );
    }

    if (id === "w_dau_trend") {
      const series = fillDays(analytics?.dau_daily, "count");
      if (size === "lg") return (
        <LgCard label={label} sub="Last 30 days" accent={accent}>
          <AreaSpark data={series} color={accent} />
        </LgCard>
      );
      return (
        <MdCard label={label} sub="30d" accent={accent}>
          <AreaSpark data={series} color={accent} />
        </MdCard>
      );
    }

    if (id === "w_lessons_trend") {
      const series = fillDays(analytics?.lessons_daily, "count");
      if (size === "lg") return (
        <LgCard label={label} sub="Last 30 days" accent={accent}>
          <BarSpark data={series} color={accent} />
        </LgCard>
      );
      return (
        <MdCard label={label} sub="30d" accent={accent}>
          <BarSpark data={series} color={accent} />
        </MdCard>
      );
    }

    if (id === "w_exercises_trend") {
      const series = fillDays(analytics?.exercises_daily, "count");
      if (size === "lg") return (
        <LgCard label={label} sub="Last 30 days" accent={accent}>
          <BarSpark data={series} color={accent} />
        </LgCard>
      );
      return (
        <MdCard label={label} sub="30d" accent={accent}>
          <BarSpark data={series} color={accent} />
        </MdCard>
      );
    }

    // ── Content ────────────────────────────────────────────────────────────
    if (id === "w_top_lessons") {
      const data = (analytics?.top_lessons || []).map((l) => ({ name: l.title || `#${l.id}`, value: l.completions || 0 }));
      const card = size === "lg"
        ? <LgCard label={label} sub="By total completions" accent={accent}>{null}</LgCard>
        : <MdCard label={label} sub="Top 10" accent={accent}>{null}</MdCard>;
      const Shell = size === "lg" ? LgCard : MdCard;
      return (
        <Shell label={label} sub={size === "lg" ? "By total completions" : "Top 10"} accent={accent}>
          <HBarList data={data} color={accent} />
        </Shell>
      );
    }

    if (id === "w_chapter_progress") {
      const data = (analytics?.chapter_progress || []).map((c) => ({ name: c.chapter || "—", value: c.unique_learners || 0 }));
      const Shell = size === "lg" ? LgCard : MdCard;
      return (
        <Shell label={label} sub="Unique learners" accent={accent}>
          <HBarList data={data} color={accent} />
        </Shell>
      );
    }

    // ── Learners ────────────────────────────────────────────────────────────
    if (id === "w_onboarding_funnel") {
      const total = Number(s.total_users) || 0;
      const data = [
        { name: "Signed up",      value: total },
        { name: "Email verified",  value: Number(s.verified_users) || 0 },
        { name: "Onboarded",       value: Number(s.onboarded) || 0 },
        { name: "Completed flow",  value: Number(s.completed) || 0 },
      ];
      const Shell = size === "lg" ? LgCard : MdCard;
      return (
        <Shell label={label} sub="Signup → verified → onboarded" accent={accent}>
          <FunnelBars data={data} color={accent} />
        </Shell>
      );
    }

    if (id === "w_churn_health") {
      const churn = analytics?.churn || {};
      const data = [
        { name: "Active 7d",     value: Number(s.dau) || 0 },
        { name: "At-risk 30d",   value: Number(churn.at_risk_30d) || 0 },
        { name: "Churned 30d+",  value: Number(churn.churned) || 0 },
        { name: "Never active",  value: Number(churn.never_active) || 0 },
      ].filter((d) => d.value > 0);
      const Shell = size === "lg" ? LgCard : MdCard;
      return (
        <Shell label={label} sub="Activity recency" accent={accent}>
          <div className="flex gap-3 h-full">
            <div className="flex-1 min-w-0"><DonutChart data={data} /></div>
            <DonutLegend data={data} />
          </div>
        </Shell>
      );
    }

    if (id === "w_streak_dist") {
      const data = (analytics?.streak_dist || []).map((v) => ({
        name: v.bucket === "0" ? "None" : v.bucket,
        value: v.count || 0,
      }));
      const Shell = size === "lg" ? LgCard : MdCard;
      return (
        <Shell label={label} sub="Days" accent={accent}>
          <BarSpark data={data} color={accent} nameKey="name" />
        </Shell>
      );
    }

    // ── Segmentation ────────────────────────────────────────────────────────
    if (id === "w_voice_dist") {
      const data = (analytics?.voice_dist || []).map((v) => ({ name: v.voice_pref || "Unknown", value: v.count || 0 }));
      if (size === "sm") return (
        <SmallKPI label={label} value={data[0]?.name || "—"} sub={`Most common (${fmt(data[0]?.value)})`} accent={accent} />
      );
      return (
        <MdCard label={label} sub="TTS voice chosen" accent={accent}>
          <div className="flex gap-2 h-full">
            <div className="flex-1 min-w-0"><DonutChart data={data} /></div>
            <DonutLegend data={data} />
          </div>
        </MdCard>
      );
    }

    if (id === "w_knowledge_dist") {
      const data = (analytics?.knowledge_dist || []).map((v) => ({ name: v.level || "Unknown", value: v.count || 0 }));
      if (size === "sm") return (
        <SmallKPI label={label} value={data[0]?.name || "—"} sub={`Most common (${fmt(data[0]?.value)})`} accent={accent} />
      );
      return (
        <MdCard label={label} sub="Self-reported at sign-up" accent={accent}>
          <div className="flex gap-2 h-full">
            <div className="flex-1 min-w-0"><DonutChart data={data} /></div>
            <DonutLegend data={data} />
          </div>
        </MdCard>
      );
    }

    if (id === "w_country_dist") {
      const data = (analytics?.country_dist || []).map((v) => ({ name: v.country || "Unknown", value: v.count || 0 }));
      const Shell = size === "lg" ? LgCard : MdCard;
      return (
        <Shell label={label} sub="Top 12" accent={accent}>
          <HBarList data={data} color={accent} />
        </Shell>
      );
    }

    if (id === "w_goal_dist") {
      const data = (analytics?.goal_dist || []).map((v) => ({ name: `${v.goal_min}m`, value: v.count || 0 }));
      if (size === "sm") {
        const top = data[0];
        return <SmallKPI label={label} value={top?.name || "—"} sub={top ? `Most chosen (${fmt(top.value)})` : undefined} accent={accent} />;
      }
      return (
        <MdCard label={label} sub="Minutes/day at sign-up" accent={accent}>
          <BarSpark data={data} color={accent} nameKey="name" />
        </MdCard>
      );
    }

    if (id === "w_auth_methods") {
      const m = analytics?.auth_methods || {};
      const data = [
        { name: "Password",   value: Number(m.password_only) || 0 },
        { name: "Google",     value: Number(m.google_only)   || 0 },
        { name: "Telegram",   value: Number(m.telegram_only) || 0 },
        { name: "Both OAuth", value: Number(m.both_oauth)    || 0 },
      ].filter((d) => d.value > 0);
      if (size === "sm") {
        const top = [...data].sort((a, b) => b.value - a.value)[0];
        return <SmallKPI label={label} value={top?.name || "—"} sub={`Most common (${fmt(top?.value)})`} accent={accent} />;
      }
      return (
        <MdCard label={label} sub="Sign-in method" accent={accent}>
          <div className="flex gap-2 h-full">
            <div className="flex-1 min-w-0"><DonutChart data={data} /></div>
            <DonutLegend data={data} />
          </div>
        </MdCard>
      );
    }

    return null;
  }

  return { renderWidget };
}
