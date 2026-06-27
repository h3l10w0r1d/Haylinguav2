// src/Leaderboard.jsx — Duolingo-style weekly leagues + a friends board.
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { StarMotif } from "./lib/motifs";
import grandma from "./assets/character-grandma.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

// Bronze · Silver · Gold · Sapphire · Ruby · Emerald · Amethyst · Pearl · Obsidian · Diamond
const TIER_COLORS = ["#B45309", "#94A3B8", "#F59E0B", "#1CB0F6", "#E11D48", "#10B981", "#8B5CF6", "#CBD5E1", "#334155", "#22D3EE"];

function resolveUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/static/")) return `${API_BASE}${s}`;
  if (s.startsWith("static/")) return `${API_BASE}/${s}`;
  return s;
}

function Avatar({ name, url }) {
  const src = resolveUrl(url);
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-pom-500 font-display font-extrabold text-white">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      ) : (
        (name?.[0] || "U").toUpperCase()
      )}
    </div>
  );
}

function Row({ entry }) {
  const rankColor =
    entry.rank === 1 ? "text-gold-500" : entry.rank === 2 ? "text-slate-400" : entry.rank === 3 ? "text-amber-700" : "text-slate-400";
  return (
    <div className={"flex items-center gap-3 rounded-2xl px-3 py-2.5 " + (entry.is_self ? "bg-brand-50 ring-1 ring-brand-200" : "")}>
      <div className={"w-6 shrink-0 text-center font-display text-base font-extrabold " + rankColor}>{entry.rank}</div>
      <Avatar name={entry.name} url={entry.avatar_url} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-extrabold text-slate-800">
          {entry.name}
          {entry.is_self ? <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">YOU</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5 font-display text-sm font-extrabold text-slate-700">
        <StarMotif className="h-4 w-4 text-gold-500" />
        {entry.weekly_xp}
      </div>
    </div>
  );
}

function ZoneDivider({ type }) {
  const promote = type === "promote";
  return (
    <div className="my-1 flex items-center gap-2 px-2">
      <div className={"h-0.5 flex-1 rounded-full " + (promote ? "bg-grass-400" : "bg-cardinal-300")} />
      <span className={"inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide " + (promote ? "text-grass-600" : "text-cardinal-500")}>
        {promote ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        {promote ? "Promotion" : "Demotion"} zone
      </span>
      <div className={"h-0.5 flex-1 rounded-full " + (promote ? "bg-grass-400" : "bg-cardinal-300")} />
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
  const tierColor = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)];
  const list = tab === "friends" ? data?.friends || [] : data?.division || [];
  const promoteTop = data?.promote_top || 0;
  const demoteBottom = tab === "league" ? data?.demote_bottom || 0 : 0;
  const showZones = tab === "league" && data?.joined && list.length > promoteTop;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* League header */}
        <div className="rounded-3xl bg-white p-6 text-center ring-1 ring-slate-200 shadow-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white shadow-sm" style={{ background: tierColor }}>
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold text-slate-800">{data?.tier_name || "Bronze"} League</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {Math.max(0, data?.days_left ?? 0)} day{(data?.days_left) === 1 ? "" : "s"} left · Top {promoteTop} promote
          </p>
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
          <div className="rounded-3xl bg-white p-3 ring-1 ring-slate-200 shadow-sm">
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
