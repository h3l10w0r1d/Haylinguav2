// src/cms/CmsShop.jsx — edit marketplace items + chest reward odds.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Gem, Snowflake, Heart, Zap, Gift, Shield, ShieldCheck, TrendingUp, Award, Image } from "lucide-react";
import CmsLayout from "./CmsLayout";

const ICONS = { snowflake: Snowflake, heart: Heart, zap: Zap, gem: Gem, shield: Shield, "shield-check": ShieldCheck, "trending-up": TrendingUp, award: Award, image: Image };
const ICON_OPTS = ["snowflake", "heart", "zap", "gem", "shield", "shield-check", "trending-up", "award", "image"];
const EFFECTS = [
  { value: "streak_freeze",  label: "Grant streak freeze(s) — use amount for qty" },
  { value: "hearts_refill",  label: "Refill hearts" },
  { value: "xp_boost",       label: "Add XP instantly (uses amount)" },
  { value: "streak_repair",  label: "Repair a recently broken streak" },
  { value: "heart_shield",   label: "Shield next lesson from heart loss" },
  { value: "xp_multiplier",  label: "Double XP on next lesson" },
  { value: "avatar_frame",   label: "Unlock avatar frame (cosmetic)" },
  { value: "profile_theme",  label: "Unlock profile banner theme (cosmetic)" },
];

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

export default function CmsShop() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [items, setItems] = useState([]);
  const [edits, setEdits] = useState({});
  const [chest, setChest] = useState([]); // [{gems, weight}]
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ title: "", effect: "streak_freeze", price: 30, effect_amount: 0, icon: "gem" });

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const [si, cc] = await Promise.all([api.listShopItems(), api.getChestConfig()]);
    const list = Array.isArray(si?.items) ? si.items : [];
    setItems(list);
    const e = {};
    list.forEach((it) => {
      e[it.id] = {
        title: it.title || "", description: it.description || "", icon: it.icon || "gem",
        price: it.price ?? 0, effect: it.effect || "streak_freeze", effect_amount: it.effect_amount ?? 0,
      };
    });
    setEdits(e);
    setChest((cc?.rewards || []).map((r) => ({ gems: r.gems, weight: r.weight })));
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load shop", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  const totalWeight = chest.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 1;

  async function createItem() {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await api.createShopItem({
        title: draft.title.trim(), effect: draft.effect, price: Number(draft.price) || 0,
        effect_amount: Number(draft.effect_amount) || 0, icon: draft.icon,
      });
      setDraft({ title: "", effect: "streak_freeze", price: 30, effect_amount: 0, icon: "gem" });
      await refresh();
      showToast("Item created");
    } catch (err) {
      showToast(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(it) {
    const e = edits[it.id] || {};
    setBusy(true);
    try {
      await api.updateShopItem(it.id, {
        title: (e.title || "").trim(), description: (e.description || "").trim(), icon: e.icon,
        price: Number(e.price) || 0, effect: e.effect, effect_amount: Number(e.effect_amount) || 0,
      });
      await refresh();
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(it) {
    setBusy(true);
    try {
      await api.updateShopItem(it.id, { is_active: !it.is_active });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(it) {
    if (!confirm(`Delete "${it.title}" from the shop?`)) return;
    setBusy(true);
    try {
      await api.deleteShopItem(it.id);
      await refresh();
      showToast("Deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(idx, dir) {
    const next = items.slice();
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const [m] = next.splice(idx, 1);
    next.splice(j, 0, m);
    setItems(next);
    setBusy(true);
    try {
      await api.reorderShopItems(next.map((x) => x.id));
      await refresh();
    } catch (err) {
      showToast(err.message || "Reorder failed", "err");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function patch(id, p) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  async function saveChest() {
    setBusy(true);
    try {
      await api.setChestConfig(chest.map((r) => ({ gems: Number(r.gems) || 0, weight: Number(r.weight) || 0 })));
      await refresh();
      showToast("Chest odds saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CmsLayout active="shop" title="Shop & Economy">
      <div className="space-y-8">
        {/* ----- Shop items ----- */}
        <section className="space-y-4">
          <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
            <div className="mb-3 font-display text-base font-bold text-slate-900">New shop item</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.2fr_0.7fr_0.7fr_auto]">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title — e.g. Streak Freeze" className={inputCls} />
              <select value={draft.effect} onChange={(e) => setDraft({ ...draft, effect: e.target.value })} className={inputCls}>
                {EFFECTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} title="Price (gems)" placeholder="Price" className={inputCls} />
              <input type="number" value={draft.effect_amount} onChange={(e) => setDraft({ ...draft, effect_amount: e.target.value })} title="Amount (for XP)" placeholder="Amt" className={inputCls} />
              <button type="button" onClick={createItem} disabled={busy || !draft.title.trim()} className="btn3d btn3d-brand text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500">Amount only applies to “Add XP”. Prices are in gems.</div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">No shop items yet.</div>
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => {
                const e = edits[it.id] || {};
                const Icon = ICONS[e.icon] || Gem;
                return (
                  <div key={it.id} className={cx("rounded-3xl bg-white p-4 ring-1 shadow-sm", it.is_active ? "ring-slate-200" : "ring-slate-200 opacity-70")}>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 pt-1">
                        <button type="button" onClick={() => moveItem(idx, -1)} disabled={busy || idx === 0} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
                        <button type="button" onClick={() => moveItem(idx, 1)} disabled={busy || idx === items.length - 1} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                      </div>
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-feather-50 text-feather-500"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input value={e.title || ""} onChange={(ev) => patch(it.id, { title: ev.target.value })} placeholder="Title" className={cx(inputCls, "!py-2 font-bold")} />
                          <input value={e.description || ""} onChange={(ev) => patch(it.id, { description: ev.target.value })} placeholder="Description" className={cx(inputCls, "!py-2 text-xs")} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <select value={e.icon || "gem"} onChange={(ev) => patch(it.id, { icon: ev.target.value })} className={cx(inputCls, "!py-2")} title="Icon">
                            {ICON_OPTS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                          </select>
                          <select value={e.effect || "streak_freeze"} onChange={(ev) => patch(it.id, { effect: ev.target.value })} className={cx(inputCls, "!py-2")} title="Effect">
                            {EFFECTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                          <input type="number" value={e.price ?? 0} onChange={(ev) => patch(it.id, { price: ev.target.value })} className={cx(inputCls, "!py-2")} title="Price (gems)" placeholder="Price" />
                          <input type="number" value={e.effect_amount ?? 0} onChange={(ev) => patch(it.id, { effect_amount: ev.target.value })} className={cx(inputCls, "!py-2")} title="Amount (XP)" placeholder="Amt" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-feather-50 px-2.5 py-0.5 text-xs font-bold text-feather-600"><Gem className="h-3.5 w-3.5" /> {e.price} gems</span>
                          <button type="button" onClick={() => toggleItem(it)} disabled={busy}
                            className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                              it.is_active ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200")}>
                            {it.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {it.is_active ? "Live" : "Hidden"}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={() => saveItem(it)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                        <button type="button" onClick={() => removeItem(it)} disabled={busy} className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ----- Chest odds ----- */}
        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <Gift className="h-5 w-5 text-gold-500" />
            <div className="font-display text-base font-bold text-slate-900">Chest reward odds</div>
          </div>
          <p className="mb-4 text-sm font-semibold text-slate-500">Each opened chest rolls one of these gem rewards. Higher weight = more likely.</p>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_70px_auto] gap-2 px-1 text-xs font-extrabold uppercase tracking-wide text-slate-400">
              <span>Gems</span><span>Weight</span><span>Chance</span><span />
            </div>
            {chest.map((r, i) => {
              const pct = Math.round(((Number(r.weight) || 0) / totalWeight) * 100);
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_70px_auto] items-center gap-2">
                  <input type="number" value={r.gems} onChange={(ev) => setChest((c) => c.map((x, j) => (j === i ? { ...x, gems: ev.target.value } : x)))} className={cx(inputCls, "!py-2")} />
                  <input type="number" value={r.weight} onChange={(ev) => setChest((c) => c.map((x, j) => (j === i ? { ...x, weight: ev.target.value } : x)))} className={cx(inputCls, "!py-2")} />
                  <span className="text-sm font-extrabold text-slate-600 tabular-nums">{pct}%</span>
                  <button type="button" onClick={() => setChest((c) => c.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-xl text-cardinal-500 ring-1 ring-slate-200 hover:bg-cardinal-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={() => setChest((c) => [...c, { gems: 10, weight: 5 }])} className="btn3d btn3d-neutral text-sm inline-flex items-center gap-2"><Plus className="h-4 w-4" /> Add reward</button>
            <button type="button" onClick={saveChest} disabled={busy || chest.length === 0} className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60"><Save className="h-4 w-4" /> Save odds</button>
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className={cx("rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-1", toast.kind === "err" ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200" : "bg-grass-50 text-grass-700 ring-grass-200")}>
            {toast.msg}
          </div>
        </div>
      )}
    </CmsLayout>
  );
}
