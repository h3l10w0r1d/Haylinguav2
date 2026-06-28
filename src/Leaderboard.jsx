// src/Leaderboard.jsx — Duolingo-style weekly leagues + a friends board.
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowUp, ArrowDown, Loader2, Clock, ChevronRight } from "lucide-react";
import { StarMotif } from "./lib/motifs";
import grandma from "./assets/character-grandma.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

// Bronze · Silver · Gold · Sapphire · Ruby · Emerald · Amethyst · Pearl · Obsidian · Diamond
const TIER_COLORS = ["#CD7F32", "#A9B4C2", "#F5B301", "#1CB0F6", "#E11D48", "#22B07D", "#9B5DE5", "#D8DEE9", "#3B4252", "#34D5E0"];

function resolveUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/static/")) return `${API_BASE}${s}`;
  if (s.startsWith("static/")) return `${API_BASE}/${s}`;
  return s;
}

function fmtLeft(s) {
  s = Math.max(0, Number(s) || 0);
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)} days`;
  if (s >= 86400) return "1 day";
  if (s >= 3600) return `${Math.floor(s / 3600)} hours`;
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return "ending soon";
}

/** Faceted league gem. `color` for achieved/current tiers, grey when locked. */
function Gem({ color, size = 48, locked = false }) {
  const c = locked ? "#CBD5E1" : color;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ opacity: locked ? 0.55 : 1 }} aria-hidden>
      <polygon points="16,9 32,9 39,19 24,43 9,19" fill={c} />
      <polygon points="16,9 32,9 24,19" fill="#ffffff" opacity="0.32" />
      <polygon points="32,9 39,19 24,19" fill="#000000" opacity="0.16" />
      <polygon points="9,19 24,19 24,43" fill="#000000" opacity="0.06" />
      <polygon points="39,19 24,19 24,43" fill="#000000" opacity="0.16" />
      <polygon points="16,9 32,9 39,19 24,43 9,19" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.8" />
    </svg>
  );
}

function GemCarousel({ tier, maxTier }) {
  const start = Math.max(0, Math.min(tier - 2, maxTier - 4));
  const end = Math.min(maxTier, start + 4);
  const tiers = [];
  for (let i = start; i <= end; i++) tiers.push(i);
  return (
    <div className="flex items-center justify-center gap-2 overflow-hidden py-2">
      {tiers.map((i) => {
        const current = i === tier;
        return (
          <div key={i} className="flex flex-col items-center">
            <Gem color={TIER_COLORS[i]} size={current ? 84 : 46} locked={i > tier} />
            {current ? <div className="mt-1 h-1.5 w-12 rounded-full bg-slate-200" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function RankBadge({ rank }) {
  if (rank <= 3) {
    const c = rank === 1 ? "#F5B301" : rank === 2 ? "#A9B4C2" : "#CD7F32";
    return (
      <div className="relative grid h-9 w-9 shrink-0 place-items-center">
        <span className="absolute bottom-0 left-1.5 h-3.5 w-2 rotate-12 rounded-sm" style={{ background: c, opacity: 0.55 }} />
        <span className="absolute bottom-0 right-1.5 h-3.5 w-2 -rotate-12 rounded-sm" style={{ background: c, opacity: 0.55 }} />
        <span className="relative grid h-7 w-7 place-items-center rounded-full font-display text-xs font-extrabold text-white ring-2 ring-white" style={{ background: c }}>
          {rank}
        </span>
      </div>
    );
  }
  return <div className="w-9 shrink-0 text-center font-display text-base font-extrabold text-slate-400">{rank}</div>;
}

function Avatar({ name, url }) {
  const src = resolveUrl(url);
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-400 to-pom-500 font-display text-lg font-extrabold text-white">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      ) : (
        (name?.[0] || "U").toUpperCase()
      )}
    </div>
  );
}

function Row({ entry }) {
  // Link to the learner's public profile (own row → settings). Rows without a
  // username (no public page) stay non-clickable.
  const to = entry.is_self ? "/profile" : entry.username ? `/u/${encodeURIComponent(entry.username)}` : null;

  const inner = (
    <>
      <RankBadge rank={entry.rank} />
      <Avatar name={entry.name} url={entry.avatar_url} />
      <div className="min-w-0 flex-1">
        <div className={"truncate font-display text-base font-extrabold " + (entry.is_self ? "text-brand-600" : "text-slate-800")}>
          {entry.name}
        </div>
      </div>
      <div className={"font-display text-sm font-extrabold " + (entry.is_self ? "text-brand-600" : "text-slate-400")}>
        {entry.weekly_xp} XP
      </div>
      {to ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" /> : null}
    </>
  );

  const base = "flex items-center gap-3 rounded-2xl px-3 py-2.5 " + (entry.is_self ? "bg-brand-50" : "");

  if (!to) return <div className={base}>{inner}</div>;
  return (
    <Link to={to} className={base + " transition hover:bg-slate-50 active:scale-[0.99]"}>
      {inner}
    </Link>
  );
}

function ZoneDivider({ type }) {
  const promote = type === "promote";
  const color = promote ? "text-grass-600" : "text-cardinal-500";
  const line = promote ? "bg-grass-400" : "bg-cardinal-300";
  return (
    <div className="my-2 flex items-center gap-2 px-2">
      <div className={"h-0.5 flex-1 rounded-full " + line} />
      <span className={"inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide " + color}>
        {promote ? <ArrowUp className="h-4 w-4" strokeWidth={3} /> : <ArrowDown className="h-4 w-4" strokeWidth={3} />}
        {promote ? "Promotion" : "Demotion"} zone
        {promote ? <ArrowUp className="h-4 w-4" strokeWidth={3} /> : <ArrowDown className="h-4 w-4" strokeWidth={3} />}
      </span>
      <div className={"h-0.5 flex-1 rounded-full " + line} />
    </div>
  );
}

function tabCls(active, disabled) {
  return (
    "rounded-2xl py-2.5 font-display text-sm font-extrabold transition " +
    (active ? "bg-brand-500 text-white shadow-btn-brand" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50") +
    (disabled ? " cursor-not-allowed opacity-50" : "")
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("league");

  useEffect(() => {
    const t = getToken();
    fetch(`${API_BASE}/me/league`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tier = data?.tier ?? 0;
  const maxTier = data?.max_tier ?? 9;
  const list = tab === "friends" ? data?.friends || [] : data?.division || [];
  const promoteTop = data?.promote_top || 0;
  const demoteBottom = tab === "league" ? data?.demote_bottom || 0 : 0;
  const showZones = tab === "league" && data?.joined && list.length > promoteTop;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Title + countdown */}
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800">
          {data?.tier_name || "Bronze"} League
        </h1>
        <div className="mt-1 flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-slate-400">
          <Clock className="h-4 w-4" /> {fmtLeft(data?.seconds_left)} left
        </div>

        {/* Gem carousel */}
        <div className="mt-3 border-b border-slate-100 pb-5">
          <GemCarousel tier={tier} maxTier={maxTier} />
        </div>

        {/* Tabs */}
        <div className="my-5 grid grid-cols-2 gap-2">
          <button onClick={() => setTab("league")} className={tabCls(tab === "league")}>League</button>
          <button
            onClick={() => data?.has_friends && setTab("friends")}
            disabled={!data?.has_friends}
            title={data?.has_friends ? "" : "Add friends to compete with them"}
            className={tabCls(tab === "friends", !data?.has_friends)}
          >
            Friends
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-semibold">Loading…</span>
          </div>
        ) : tab === "league" && !data?.joined ? (
          <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-sm">
            <img src={grandma} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
            <div className="mt-3 font-display text-lg font-extrabold text-slate-800">Join this week’s league</div>
            <p className="mt-1 font-semibold text-slate-500">Earn XP in a lesson to enter the {data?.tier_name || "Bronze"} division and start climbing.</p>
            <button onClick={() => navigate("/dashboard")} className="btn3d btn3d-brand mt-5 uppercase">Start a lesson</button>
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center font-semibold text-slate-500 ring-1 ring-slate-200">
            {tab === "friends" ? "No friends in the league yet this week." : "No one here yet — be the first!"}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-2 ring-1 ring-slate-200 shadow-sm sm:p-3">
            {list.map((e, i) => (
              <React.Fragment key={e.user_id ?? i}>
                <Row entry={e} />
                {showZones && i === promoteTop - 1 ? <ZoneDivider type="promote" /> : null}
                {showZones && demoteBottom > 0 && i === list.length - demoteBottom - 1 && i >= promoteTop ? <ZoneDivider type="demote" /> : null}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
