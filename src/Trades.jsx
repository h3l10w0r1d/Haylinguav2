// src/Trades.jsx — friends-only cosmetic trading: propose, review, accept/decline/cancel.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeftRight, Gem, Check, X, Clock, Inbox, Send, History, AlertCircle,
} from "lucide-react";
import NameTag from "./lib/nameTag";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

const RARITY_LABEL = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
const RARITY_TEXT_CLS = {
  common: "text-slate-500 dark:text-stone-400",
  uncommon: "text-grass-600 dark:text-grass-400",
  rare: "text-feather-600 dark:text-feather-400",
  epic: "text-purple-600 dark:text-purple-400",
  legendary: "text-gold-600 dark:text-gold-400",
};

const TABS = [
  { key: "incoming", label: "Incoming", icon: Inbox },
  { key: "outgoing", label: "Outgoing", icon: Send },
  { key: "new", label: "New trade", icon: ArrowLeftRight },
  { key: "history", label: "History", icon: History },
];

function ItemChip({ item }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
      {item.render_key ? (
        <NameTag renderKey={item.render_key} rarity={item.rarity} className="text-xs font-extrabold">Aa</NameTag>
      ) : null}
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-700 dark:text-stone-200">{item.title}</div>
        {item.rarity ? (
          <div className={"text-[10px] font-extrabold uppercase tracking-wide " + (RARITY_TEXT_CLS[item.rarity] || "")}>
            {RARITY_LABEL[item.rarity] || item.rarity}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OfferCard({ offer, viewerIsRecipient, onAccept, onDecline, onCancel, busy }) {
  // The first column always shows what the proposer put in, the second what
  // the recipient put in — only the label ("They"/"You") depends on which
  // side is viewing, never which array backs each column.
  const proposerItems = offer.proposer_items;
  const recipientItems = offer.recipient_items;
  const proposerGems = offer.proposer_gems;
  const recipientGems = offer.recipient_gems;
  const otherName = viewerIsRecipient ? offer.proposer_name : offer.recipient_name;

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-display text-sm font-extrabold text-slate-800 dark:text-white">
          {viewerIsRecipient ? "From " : "To "}{otherName || "a friend"}
        </div>
        {offer.status !== "pending" ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:bg-white/[0.06] dark:text-stone-400">
            {offer.status}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
            {viewerIsRecipient ? "They offer" : "You offer"}
          </div>
          <div className="space-y-1.5">
            {proposerGems > 0 ? (
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:text-stone-200 dark:ring-white/[0.08]">
                <Gem className="h-3.5 w-3.5 text-feather-500" /> {proposerGems.toLocaleString()}
              </div>
            ) : null}
            {proposerItems.map((it) => <ItemChip key={it.user_item_id} item={it} />)}
            {!proposerGems && proposerItems.length === 0 ? <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">Nothing</div> : null}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
            {viewerIsRecipient ? "For your" : "For their"}
          </div>
          <div className="space-y-1.5">
            {recipientGems > 0 ? (
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:text-stone-200 dark:ring-white/[0.08]">
                <Gem className="h-3.5 w-3.5 text-feather-500" /> {recipientGems.toLocaleString()}
              </div>
            ) : null}
            {recipientItems.map((it) => <ItemChip key={it.user_item_id} item={it} />)}
            {!recipientGems && recipientItems.length === 0 ? <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">Nothing</div> : null}
          </div>
        </div>
      </div>

      {offer.status === "pending" ? (
        <div className="mt-4 flex gap-2">
          {viewerIsRecipient ? (
            <>
              <button disabled={busy} onClick={() => onDecline(offer.id)} className="btn3d btn3d-neutral flex-1 !py-2 text-sm">
                <X className="h-4 w-4" /> Decline
              </button>
              <button disabled={busy} onClick={() => onAccept(offer.id)} className="btn3d btn3d-brand flex-1 !py-2 text-sm">
                <Check className="h-4 w-4" /> Accept
              </button>
            </>
          ) : (
            <button disabled={busy} onClick={() => onCancel(offer.id)} className="btn3d btn3d-neutral flex-1 !py-2 text-sm">
              <X className="h-4 w-4" /> Cancel offer
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NewTradeComposer({ token, friends, initialFriendId, onProposed, showToast }) {
  const [friendId, setFriendId] = useState(initialFriendId || "");
  const [myInventory, setMyInventory] = useState([]);
  const [friendInventory, setFriendInventory] = useState([]);
  const [offeredIds, setOfferedIds] = useState([]);
  const [requestedIds, setRequestedIds] = useState([]);
  const [offeredGems, setOfferedGems] = useState(0);
  const [requestedGems, setRequestedGems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch("/me/inventory", { token });
        const d = await r.json();
        if (!cancelled && r.ok) setMyInventory((d.items || []).filter((i) => i.tradeable !== false));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!friendId) { setFriendInventory([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await apiFetch(`/trades/friends/${friendId}/inventory`, { token });
        const d = await r.json();
        if (!cancelled && r.ok) setFriendInventory(d.items || []);
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [friendId, token]);

  const toggle = (setFn, list, id) => {
    setFn(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submit = async () => {
    if (!friendId) { showToast("error", "Pick a friend first"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/trades/propose", {
        token, method: "POST",
        body: JSON.stringify({
          recipient_id: Number(friendId),
          offered_item_ids: offeredIds,
          offered_gems: Number(offeredGems) || 0,
          requested_item_ids: requestedIds,
          requested_gems: Number(requestedGems) || 0,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        showToast("success", "Trade offer sent!");
        setOfferedIds([]); setRequestedIds([]); setOfferedGems(0); setRequestedGems(0);
        onProposed?.();
      } else {
        showToast("error", d.detail || "Couldn't send that offer");
      }
    } catch {
      showToast("error", "Something went wrong");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-extrabold text-slate-600 dark:text-stone-300">Trade with</label>
        <select
          value={friendId}
          onChange={(e) => { setFriendId(e.target.value); setRequestedIds([]); }}
          className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:outline-none focus:ring-brand-400 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08]"
        >
          <option value="">Choose a friend…</option>
          {friends.map((f) => (
            <option key={f.user_id} value={f.user_id}>{f.name || f.username}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <div className="mb-2 font-display text-sm font-extrabold text-slate-700 dark:text-stone-200">You give</div>
          <input
            type="number" min="0" value={offeredGems}
            onChange={(e) => setOfferedGems(e.target.value)}
            placeholder="Gems"
            className="mb-2 w-full rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-slate-200 focus:outline-none focus:ring-brand-400 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08]"
          />
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {myInventory.length === 0 ? <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">No tradeable items yet.</div> : null}
            {myInventory.map((it) => (
              <button
                key={it.user_item_id}
                type="button"
                onClick={() => toggle(setOfferedIds, offeredIds, it.user_item_id)}
                className={"flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left ring-1 transition " + (offeredIds.includes(it.user_item_id) ? "bg-brand-50 ring-brand-400 dark:bg-brand-500/15" : "bg-slate-50 ring-slate-200 hover:ring-brand-300 dark:bg-white/[0.04] dark:ring-white/[0.08]")}
              >
                {offeredIds.includes(it.user_item_id) ? <Check className="h-4 w-4 shrink-0 text-brand-500" /> : <div className="h-4 w-4 shrink-0" />}
                <span className="truncate text-sm font-bold text-slate-700 dark:text-stone-200">{it.title}</span>
                {it.rarity ? <span className={"ml-auto shrink-0 text-[10px] font-extrabold uppercase " + (RARITY_TEXT_CLS[it.rarity] || "")}>{RARITY_LABEL[it.rarity]}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 font-display text-sm font-extrabold text-slate-700 dark:text-stone-200">You get</div>
          <input
            type="number" min="0" value={requestedGems}
            onChange={(e) => setRequestedGems(e.target.value)}
            placeholder="Gems"
            className="mb-2 w-full rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-slate-200 focus:outline-none focus:ring-brand-400 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08]"
          />
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {!friendId ? (
              <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">Pick a friend to see what they own.</div>
            ) : loading ? (
              <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">Loading…</div>
            ) : friendInventory.length === 0 ? (
              <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">They have no tradeable items yet.</div>
            ) : (
              friendInventory.map((it) => (
                <button
                  key={it.user_item_id}
                  type="button"
                  onClick={() => toggle(setRequestedIds, requestedIds, it.user_item_id)}
                  className={"flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left ring-1 transition " + (requestedIds.includes(it.user_item_id) ? "bg-brand-50 ring-brand-400 dark:bg-brand-500/15" : "bg-slate-50 ring-slate-200 hover:ring-brand-300 dark:bg-white/[0.04] dark:ring-white/[0.08]")}
                >
                  {requestedIds.includes(it.user_item_id) ? <Check className="h-4 w-4 shrink-0 text-brand-500" /> : <div className="h-4 w-4 shrink-0" />}
                  <span className="truncate text-sm font-bold text-slate-700 dark:text-stone-200">{it.title}</span>
                  {it.rarity ? <span className={"ml-auto shrink-0 text-[10px] font-extrabold uppercase " + (RARITY_TEXT_CLS[it.rarity] || "")}>{RARITY_LABEL[it.rarity]}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={submitting || !friendId}
        onClick={submit}
        className="btn3d btn3d-brand w-full !py-3 text-sm disabled:opacity-50"
      >
        <ArrowLeftRight className="h-4 w-4" /> {submitting ? "Sending…" : "Send trade offer"}
      </button>
    </div>
  );
}

export default function Trades() {
  const [searchParams] = useSearchParams();
  const initialFriendId = searchParams.get("with") || "";
  const [tab, setTab] = useState(initialFriendId ? "new" : "incoming");
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [history, setHistory] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const token = getToken();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (type, text) => setToast({ type, text });

  const loadAll = async () => {
    try {
      const [inc, out, hist, fr] = await Promise.all([
        apiFetch("/trades/incoming", { token }),
        apiFetch("/trades/outgoing", { token }),
        apiFetch("/trades/history", { token }),
        apiFetch("/friends", { token }),
      ]);
      const [incD, outD, histD, frD] = await Promise.all([inc.json(), out.json(), hist.json(), fr.json()]);
      if (inc.ok) setIncoming(incD.offers || []);
      if (out.ok) setOutgoing(outD.offers || []);
      if (hist.ok) setHistory(histD.offers || []);
      if (fr.ok) setFriends((Array.isArray(frD) ? frD : []).map((f) => ({ user_id: f.user_id, name: f.name, username: f.username })));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    loadAll();
  }, [token]);

  const act = async (offerId, action) => {
    setBusy(true);
    try {
      const r = await apiFetch(`/trades/${offerId}/${action}`, { token, method: "POST" });
      const d = await r.json();
      if (r.ok) {
        showToast("success", action === "accept" ? "Trade completed!" : `Trade ${action}led`);
        await loadAll();
      } else {
        showToast("error", d.detail || "That trade offer changed — refresh and try again");
        await loadAll();
      }
    } catch {
      showToast("error", "Something went wrong");
    }
    setBusy(false);
  };

  const tabsWithBadges = useMemo(
    () => TABS.map((t) => ({ ...t, badge: t.key === "incoming" ? incoming.length : t.key === "outgoing" ? outgoing.length : 0 })),
    [incoming.length, outgoing.length]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
          <div className={"pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg " + (toast.type === "error" ? "bg-cardinal-500" : "bg-grass-500")}>
            {toast.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
            {toast.text}
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Trades</h1>
          <p className="mt-1 font-semibold text-slate-500 dark:text-stone-400">Swap cosmetics with friends.</p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {tabsWithBadges.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={"flex items-center gap-1.5 rounded-2xl px-4 py-2.5 font-display text-sm font-extrabold transition " + (tab === t.key ? "bg-brand-500 text-white shadow-btn-brand" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-[#18181b] dark:text-stone-400 dark:ring-white/[0.08] dark:hover:bg-white/[0.04]")}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.badge > 0 ? (
                <span className={"ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs " + (tab === t.key ? "bg-white/25" : "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400")}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm sm:p-6 dark:bg-[#18181b] dark:ring-white/[0.08]">
          {!token ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-400 dark:text-stone-500">Log in to trade with friends.</div>
          ) : loading ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
              <p className="font-semibold text-slate-500 dark:text-stone-400">Loading…</p>
            </div>
          ) : tab === "new" ? (
            friends.length === 0 ? (
              <div className="py-12 text-center text-sm font-semibold text-slate-400 dark:text-stone-500">Add some friends first — trades are friends-only.</div>
            ) : (
              <NewTradeComposer token={token} friends={friends} initialFriendId={initialFriendId} onProposed={() => { loadAll(); setTab("outgoing"); }} showToast={showToast} />
            )
          ) : tab === "incoming" ? (
            incoming.length === 0 ? (
              <div className="py-12 text-center text-sm font-semibold text-slate-400 dark:text-stone-500">
                <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-stone-600" />
                No incoming offers.
              </div>
            ) : (
              <div className="space-y-3">
                {incoming.map((o) => (
                  <OfferCard key={o.id} offer={o} viewerIsRecipient busy={busy} onAccept={(id) => act(id, "accept")} onDecline={(id) => act(id, "decline")} />
                ))}
              </div>
            )
          ) : tab === "outgoing" ? (
            outgoing.length === 0 ? (
              <div className="py-12 text-center text-sm font-semibold text-slate-400 dark:text-stone-500">
                <Clock className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-stone-600" />
                No outgoing offers yet.
              </div>
            ) : (
              <div className="space-y-3">
                {outgoing.map((o) => (
                  <OfferCard key={o.id} offer={o} viewerIsRecipient={false} busy={busy} onCancel={(id) => act(id, "cancel")} />
                ))}
              </div>
            )
          ) : (
            history.length === 0 ? (
              <div className="py-12 text-center text-sm font-semibold text-slate-400 dark:text-stone-500">No past trades yet.</div>
            ) : (
              <div className="space-y-3">
                {history.map((o) => (
                  <OfferCard key={o.id} offer={o} viewerIsRecipient={String(o.recipient_id) === String(JSON.parse(localStorage.getItem("hay_user") || "{}").id)} busy={busy} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
