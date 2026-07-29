// src/Leaderboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowUp, ArrowDown, Clock, Trophy, Users, Zap, ChevronRight, Medal } from "lucide-react";
import { CrownBadge } from "./lib/PremiumBadge";
import AvatarFrame from "./lib/avatarFrame";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

const TIER_COLORS = ["#CD7F32","#A9B4C2","#F5B301","#1CB0F6","#E11D48","#22B07D","#9B5DE5","#D8DEE9","#3B4252","#34D5E0"];
const TIER_NAMES  = ["Bronze","Silver","Gold","Sapphire","Ruby","Emerald","Amethyst","Pearl","Obsidian","Diamond"];

function resolveUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/static/")) return `${API_BASE}${s}`;
  if (s.startsWith("static/")) return `${API_BASE}/${s}`;
  return s;
}

function useTicker(seconds) {
  const [left, setLeft] = useState(Math.max(0, Number(seconds) || 0));
  const ref = useRef(null);
  useEffect(() => { setLeft(Math.max(0, Number(seconds) || 0)); }, [seconds]);
  useEffect(() => {
    ref.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(ref.current);
  }, []);
  return left;
}

function fmtLeft(s) {
  s = Math.max(0, Number(s) || 0);
  if (s >= 2 * 86400) return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h left`;
  if (s >= 86400) return `1d ${Math.floor((s % 86400) / 3600)}h left`;
  if (s >= 3600) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}h ${m}m left`; }
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s left`;
  return s > 0 ? `${s}s left` : "Ending soon";
}

function Gem({ color, size = 48, locked = false }) {
  const c = locked ? "#CBD5E1" : color;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ opacity: locked ? 0.4 : 1 }} aria-hidden>
      <polygon points="16,9 32,9 39,19 24,43 9,19" fill={c} />
      <polygon points="16,9 32,9 24,19" fill="#ffffff" opacity="0.35" />
      <polygon points="32,9 39,19 24,19" fill="#000000" opacity="0.14" />
      <polygon points="9,19 24,19 24,43"  fill="#000000" opacity="0.06" />
      <polygon points="39,19 24,19 24,43" fill="#000000" opacity="0.14" />
      <polygon points="16,9 32,9 39,19 24,43 9,19" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.8" />
    </svg>
  );
}

function Avatar({ name, url, size = "h-12 w-12", text = "text-lg", isPremium = false, frameStyle = null }) {
  const src = resolveUrl(url);
  return (
    <div className={`relative grid ${size} shrink-0 place-items-center overflow-visible`}>
      <AvatarFrame frameStyle={frameStyle} sizeClass={size} radius="9999px" thickness={2.5}>
        <div className={`grid h-full w-full place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-400 to-pom-500 font-display ${text} font-extrabold text-white ` + (!frameStyle && isPremium ? "ring-2 ring-gold-400" : "")}>
          {src ? <img src={src} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : (name?.[0] || "U").toUpperCase()}
        </div>
      </AvatarFrame>
      {isPremium && <CrownBadge size="h-4 w-4" iconSize="h-2.5 w-2.5" />}
    </div>
  );
}

function RankBadge({ rank }) {
  const colors = { 1: "#F5B301", 2: "#A9B4C2", 3: "#CD7F32" };
  if (colors[rank]) return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold text-white" style={{ background: colors[rank] }}>{rank}</div>
  );
  return <div className="w-8 shrink-0 text-center font-display text-sm font-extrabold text-slate-400 dark:text-stone-500">{rank}</div>;
}

function Podium({ entries }) {
  const [first, second, third] = [entries[0], entries[1], entries[2]];
  const rankColors = ["#F5B301", "#A9B4C2", "#CD7F32"];

  const card = (e, rank) => {
    if (!e) return <div className="flex-1" />;
    const to = e.is_self ? "/profile" : e.username ? `/u/${encodeURIComponent(e.username)}` : null;
    const isFirst = rank === 1;
    const color = rankColors[rank - 1];
    const inner = (
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative">
          <Avatar name={e.name} url={e.avatar_url} size={isFirst ? "h-16 w-16" : "h-12 w-12"} text={isFirst ? "text-2xl" : "text-lg"} isPremium={e.is_premium} frameStyle={e.active_frame_style} />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 grid h-5 w-5 place-items-center rounded-full font-display text-[11px] font-extrabold text-white ring-2 ring-white" style={{ background: color }}>
            {rank}
          </div>
        </div>
        <div className="mt-3 max-w-[80px] truncate text-center font-display text-xs font-extrabold text-slate-700 dark:text-stone-200">{e.name}</div>
        <div className="font-display text-sm font-extrabold tabular-nums" style={{ color }}>{e.weekly_xp.toLocaleString()} XP</div>
        <div className={`w-full rounded-t-xl ${isFirst ? "h-20" : rank === 2 ? "h-14" : "h-10"}`} style={{ background: color, opacity: 0.12 }} />
      </div>
    );
    return (
      <div className="flex flex-1 flex-col items-center justify-end">
        {to ? <Link to={to} className="flex w-full flex-col items-center gap-1.5 transition hover:scale-105">{inner}</Link> : inner}
      </div>
    );
  };

  return (
    <div className="flex items-end justify-center gap-2 px-4 pb-0 pt-8">
      {card(second, 2)}
      {card(first,  1)}
      {card(third,  3)}
    </div>
  );
}

function Row({ entry }) {
  const to = entry.is_self ? "/profile" : entry.username ? `/u/${encodeURIComponent(entry.username)}` : null;
  const isSelf = entry.is_self;
  const inner = (
    <>
      <RankBadge rank={entry.rank} />
      <Avatar name={entry.name} url={entry.avatar_url} size="h-10 w-10" text="text-base" isPremium={entry.is_premium} frameStyle={entry.active_frame_style} />
      <div className="min-w-0 flex-1">
        <div className={`truncate font-display text-sm font-extrabold ${isSelf ? "text-brand-600 dark:text-brand-400" : "text-slate-800 dark:text-white"}`}>
          {entry.name}
          {isSelf && <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">You</span>}
        </div>
      </div>
      <div className={`font-display text-sm font-extrabold tabular-nums ${isSelf ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-stone-500"}`}>
        {entry.weekly_xp.toLocaleString()} XP
      </div>
      {to ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-stone-600" /> : null}
    </>
  );
  const base = `flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${isSelf ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:ring-brand-500/30" : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`;
  if (!to) return <div className={base}>{inner}</div>;
  return <Link to={to} className={base + " active:scale-[0.99]"}>{inner}</Link>;
}

function ZoneDivider({ type }) {
  const promote = type === "promote";
  return (
    <div className={`my-1.5 flex items-center gap-2 rounded-xl px-2 py-1 ${promote ? "bg-grass-50 dark:bg-grass-500/15" : "bg-cardinal-50 dark:bg-cardinal-500/15"}`}>
      <div className={`h-0.5 flex-1 rounded-full ${promote ? "bg-grass-300 dark:bg-grass-500/30" : "bg-cardinal-200 dark:bg-cardinal-500/30"}`} />
      <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide ${promote ? "text-grass-600 dark:text-grass-400" : "text-cardinal-500 dark:text-cardinal-400"}`}>
        {promote ? <ArrowUp className="h-3.5 w-3.5" strokeWidth={3} /> : <ArrowDown className="h-3.5 w-3.5" strokeWidth={3} />}
        {promote ? "Promotion zone" : "Demotion zone"}
      </span>
      <div className={`h-0.5 flex-1 rounded-full ${promote ? "bg-grass-300 dark:bg-grass-500/30" : "bg-cardinal-200 dark:bg-cardinal-500/30"}`} />
    </div>
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [tab, setTab]         = useState("league");
  const secondsLeft = useTicker(data?.seconds_left);

  useEffect(() => {
    const t = getToken();
    if (!t) { setLoading(false); setError(true); return; }
    fetch(`${API_BASE}/me/league`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const tier      = data?.tier ?? 0;
  const maxTier   = data?.max_tier ?? 9;
  const tierColor = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)];
  const tierName  = data?.tier_name || TIER_NAMES[tier] || "Bronze";
  const list      = tab === "friends" ? (data?.friends || []) : (data?.division || []);
  const promoteTop   = data?.promote_top || 0;
  const demoteBottom = tab === "league" ? (data?.demote_bottom || 0) : 0;
  const showZones    = tab === "league" && data?.joined && promoteTop > 0;
  // A league with fewer members than the promotion cutoff has no one who
  // misses it — the divider has no boundary to sit at, so it never rendered.
  const everyonePromotes = showZones && list.length > 0 && list.length <= promoteTop;
  const selfEntry    = list.find((e) => e.is_self);
  const topThree     = list.slice(0, 3);
  const rest         = list.slice(3);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500" />
        <span className="font-semibold text-slate-500 dark:text-stone-400">Loading league…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cardinal-50 dark:bg-cardinal-500/15">
          <Zap className="h-8 w-8 text-cardinal-500" />
        </div>
        <div className="mt-4 font-display text-lg font-extrabold text-slate-800 dark:text-white">Couldn't load leaderboard</div>
        <p className="mt-1.5 text-sm font-semibold text-slate-500 dark:text-stone-400">Check your connection and try again.</p>
        <button onClick={() => window.location.reload()} className="btn3d btn3d-brand mt-5 uppercase">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/30 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <div className="mx-auto max-w-2xl px-4 py-8">

        {/* ── Hero header ── */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${tierColor}ee 0%, ${tierColor}99 100%)` }}
        >
          <div className="absolute -right-8 -top-8 opacity-15 pointer-events-none">
            <Gem color="#ffffff" size={140} />
          </div>
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-widest opacity-70">Current League</div>
              <h1 className="mt-0.5 font-display text-3xl font-extrabold leading-tight">{tierName} League</h1>
              {selfEntry && (
                <div className="mt-1 text-sm font-bold opacity-80">
                  Rank #{selfEntry.rank} · {selfEntry.weekly_xp.toLocaleString()} XP this week
                </div>
              )}
            </div>
            <Gem color="#ffffff" size={60} />
          </div>

          {/* Tier progress bar */}
          <div className="mt-4 flex items-center gap-1">
            {Array.from({ length: maxTier + 1 }, (_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  background: i <= tier ? "#ffffff" : "rgba(255,255,255,0.25)",
                  flex: i === tier ? 2 : 1,
                }}
              />
            ))}
          </div>

          {/* Countdown */}
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-black/20 px-3 py-1.5 text-xs font-extrabold backdrop-blur-sm">
            <Clock className="h-3.5 w-3.5" />
            {fmtLeft(secondsLeft)}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="mt-4 flex gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/[0.06]">
          {[
            { id: "league",  label: "League",  icon: Trophy },
            { id: "friends", label: "Friends", icon: Users, disabled: !data?.has_friends },
          ].map(({ id, label, icon: Icon, disabled }) => (
            <button
              key={id}
              onClick={() => !disabled && setTab(id)}
              disabled={disabled}
              title={disabled ? "Add friends to compete" : ""}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-extrabold transition ${
                tab === id ? "bg-white text-slate-800 shadow-sm dark:bg-[#18181b] dark:text-white"
                : disabled ? "cursor-not-allowed text-slate-300 dark:text-stone-600"
                : "text-slate-500 hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="mt-4">
          {tab === "league" && !data?.joined ? (
            <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/15">
                <Trophy className="h-8 w-8 text-brand-500" />
              </div>
              <div className="mt-4 font-display text-lg font-extrabold text-slate-800 dark:text-white">Join this week's league</div>
              <p className="mt-1.5 text-sm font-semibold text-slate-500 dark:text-stone-400">
                Earn XP in a lesson to enter the <span className="text-brand-600 dark:text-brand-400">{tierName}</span> division and start climbing.
              </p>
              <button onClick={() => navigate("/dashboard")} className="btn3d btn3d-brand mt-6 uppercase">Start a lesson</button>
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 dark:bg-white/[0.04]">
                <Medal className="h-8 w-8 text-slate-300 dark:text-stone-600" />
              </div>
              <div className="mt-3 font-display text-base font-extrabold text-slate-800 dark:text-white">
                {tab === "friends" ? "No friends in the league yet" : "No one here yet — be first!"}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Podium — top 3 */}
              {topThree.length >= 2 && (
                <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden dark:bg-[#18181b] dark:ring-white/[0.08]">
                  <Podium entries={topThree} />
                  {showZones && !everyonePromotes && promoteTop <= 3 && (
                    <div className="px-3 pb-2"><ZoneDivider type="promote" /></div>
                  )}
                </div>
              )}

              {/* Rows 4+ */}
              {rest.length > 0 && (
                <div className="rounded-3xl bg-white p-2 ring-1 ring-slate-200 shadow-sm sm:p-3 dark:bg-[#18181b] dark:ring-white/[0.08]">
                  {rest.map((e, i) => {
                    const globalIdx = i + 3;
                    return (
                      <React.Fragment key={e.user_id ?? i}>
                        {showZones && !everyonePromotes && promoteTop > 3 && globalIdx === promoteTop && <ZoneDivider type="promote" />}
                        <Row entry={e} />
                        {showZones && demoteBottom > 0 && globalIdx === list.length - demoteBottom - 1 && globalIdx >= promoteTop && (
                          <ZoneDivider type="demote" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Small league: everyone qualifies for promotion — no cutoff to draw a line at. */}
              {everyonePromotes && (
                <div className="flex items-center justify-center gap-1.5 rounded-2xl bg-grass-50 px-4 py-2.5 text-center text-xs font-extrabold uppercase tracking-wide text-grass-600 dark:bg-grass-500/15 dark:text-grass-400">
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={3} />
                  Everyone here advances this week!
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sticky self-rank pill when user is far down the list ── */}
        {selfEntry && selfEntry.rank > 10 && (
          <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 pointer-events-none">
            <div className="flex items-center gap-3 rounded-2xl bg-brand-600 px-4 py-2.5 text-white shadow-xl ring-1 ring-brand-700 pointer-events-auto">
              <Avatar name={selfEntry.name} url={selfEntry.avatar_url} size="h-7 w-7" text="text-sm" frameStyle={selfEntry.active_frame_style} />
              <span className="font-display text-sm font-extrabold">#{selfEntry.rank} · {selfEntry.weekly_xp.toLocaleString()} XP</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
