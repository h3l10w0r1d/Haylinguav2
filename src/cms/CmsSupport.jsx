// src/cms/CmsSupport.jsx — support admin: look up users & resolve common issues.
// CMS-admin only (uses the CMS bearer token; backend gates with require_cms_admin).
import React, { useState } from "react";
import { Search, Crown, Heart, MailCheck, Loader2, User, ArrowLeft, Check, X } from "lucide-react";
import { getCmsToken } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function CmsSupport() {
  const token = getCmsToken();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

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
    if (!q.trim()) return;
    setErr(""); setSearching(true); setDetail(null);
    try {
      const d = await api(`/cms/support/users?q=${encodeURIComponent(q.trim())}`);
      setResults(d?.users || []);
    } catch (e) { setErr(e.message); } finally { setSearching(false); }
  }

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

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200">
          <p className="font-semibold text-slate-600">Log in to the CMS to use Support.</p>
          <a href="/cms/login" className="mt-4 inline-block rounded-xl bg-orange-600 px-5 py-2.5 font-semibold text-white">CMS login</a>
        </div>
      </div>
    );
  }

  const Stat = ({ label, value }) => (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-800">{value}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <a href="/cms" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" /> CMS
          </a>
          <div className="font-bold text-slate-900">Support</div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        <form onSubmit={search} className="relative mb-5">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email, username, or user ID…"
            className="w-full rounded-2xl bg-white py-3.5 pl-12 pr-28 font-semibold text-slate-800 ring-2 ring-slate-200 focus:outline-none focus:ring-orange-400"
          />
          <button type="submit" disabled={searching} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </button>
        </form>

        {err ? <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 ring-1 ring-rose-100">{err}</div> : null}

        {!detail ? (
          <div className="space-y-2">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => openUser(u.id)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition hover:ring-orange-300"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><User className="h-5 w-5" /></div>
                  <div>
                    <div className="font-bold text-slate-800">{u.display_name || u.username || "—"}</div>
                    <div className="text-sm text-slate-500">{u.email} · #{u.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.is_premium ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Premium</span> : null}
                  <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + (u.email_verified ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                    {u.email_verified ? "Verified" : "Unverified"}
                  </span>
                </div>
              </button>
            ))}
            {results.length === 0 && !searching ? <div className="py-10 text-center text-sm font-semibold text-slate-400">Search for a user to get started.</div> : null}
          </div>
        ) : (
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <button onClick={() => setDetail(null)} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-4 w-4" /> Back to results
            </button>

            {loadingDetail ? (
              <div className="flex items-center gap-2 py-6 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><User className="h-6 w-6" /></div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">{detail.display_name || detail.username || "—"}</div>
                    <div className="text-sm text-slate-500">{detail.email} · #{detail.id}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="XP" value={detail.total_xp} />
                  <Stat label="Lessons" value={detail.lessons_completed} />
                  <Stat label="Streak" value={detail.current_streak} />
                  <Stat label="Hearts" value={detail.is_premium ? "∞" : `${detail.hearts_current}/${detail.hearts_max}`} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className={"rounded-full px-2.5 py-1 " + (detail.is_premium ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500")}>{detail.is_premium ? "Premium" : "Free"}</span>
                  <span className={"rounded-full px-2.5 py-1 " + (detail.email_verified ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>{detail.email_verified ? "Email verified" : "Email unverified"}</span>
                  {detail.totp_enabled ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">2FA on</span> : null}
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button
                    disabled={busy === "premium"}
                    onClick={() => act("premium", `/cms/support/users/${detail.id}/premium`, { body: JSON.stringify({ active: !detail.is_premium }) })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
                  >
                    {busy === "premium" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                    {detail.is_premium ? "Revoke premium" : "Grant premium"}
                  </button>
                  <button
                    disabled={busy === "hearts"}
                    onClick={() => act("hearts", `/cms/support/users/${detail.id}/hearts-refill`)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"
                  >
                    {busy === "hearts" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />} Refill hearts
                  </button>
                  {!detail.email_verified ? (
                    <button
                      disabled={busy === "verify"}
                      onClick={() => act("verify", `/cms/support/users/${detail.id}/verify-email`)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 sm:col-span-2"
                    >
                      {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />} Mark email verified
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
