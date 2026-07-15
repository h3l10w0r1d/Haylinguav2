// src/cms/CmsPremium.jsx — edit Premium pricing plans shown on /premium.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Crown, X } from "lucide-react";
import CmsLayout from "./CmsLayout";

const INTERVAL_OPTS = [
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
  { value: "lifetime", label: "Lifetime (one-time)" },
];

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

function PerksEditor({ perks, onChange }) {
  const list = Array.isArray(perks) ? perks : [];
  return (
    <div className="space-y-1.5">
      {list.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={p}
            onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder="Perk text"
            className={cx(inputCls, "!py-2")}
          />
          <button
            type="button"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-cardinal-500 ring-1 ring-slate-200 hover:bg-cardinal-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, ""])}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-brand-600 ring-1 ring-brand-100 hover:bg-brand-50"
      >
        <Plus className="h-3.5 w-3.5" /> Add perk
      </button>
    </div>
  );
}

const NEW_PLAN_DEFAULT = { title: "", subtitle: "", price: 1490, currency: "AMD", interval: "month", badge_label: "", perks: [] };

export default function CmsPremium() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [plans, setPlans] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState(NEW_PLAN_DEFAULT);

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const d = await api.listPremiumPlans();
    const list = Array.isArray(d?.plans) ? d.plans : [];
    setPlans(list);
    const e = {};
    list.forEach((p) => {
      e[p.id] = {
        title: p.title || "", subtitle: p.subtitle || "", price: p.price ?? 0,
        currency: p.currency || "AMD", interval: p.interval || "month",
        badge_label: p.badge_label || "", perks: Array.isArray(p.perks) ? p.perks : [],
      };
    });
    setEdits(e);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load plans", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function createPlan() {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await api.createPremiumPlan({
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        price: Number(draft.price) || 0,
        currency: draft.currency.trim() || "AMD",
        interval: draft.interval,
        badge_label: draft.badge_label.trim() || null,
        perks: draft.perks.filter((p) => p.trim()),
      });
      setDraft(NEW_PLAN_DEFAULT);
      await refresh();
      showToast("Plan created");
    } catch (err) {
      showToast(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(p) {
    const e = edits[p.id] || {};
    setBusy(true);
    try {
      await api.updatePremiumPlan(p.id, {
        title: (e.title || "").trim(),
        subtitle: (e.subtitle || "").trim(),
        price: Number(e.price) || 0,
        currency: (e.currency || "AMD").trim() || "AMD",
        interval: e.interval,
        badge_label: (e.badge_label || "").trim() || null,
        perks: (e.perks || []).filter((x) => x.trim()),
      });
      await refresh();
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function togglePlan(p) {
    setBusy(true);
    try {
      await api.updatePremiumPlan(p.id, { is_active: !p.is_active });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(p) {
    if (!confirm(`Delete "${p.title}" plan?`)) return;
    setBusy(true);
    try {
      await api.deletePremiumPlan(p.id);
      await refresh();
      showToast("Deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function movePlan(idx, dir) {
    const next = plans.slice();
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const [m] = next.splice(idx, 1);
    next.splice(j, 0, m);
    setPlans(next);
    setBusy(true);
    try {
      await api.reorderPremiumPlans(next.map((x) => x.id));
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

  return (
    <CmsLayout active="premium" title="Premium Plans">
      <div className="space-y-6">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          These plans render live on /premium. Checkout is still simulated (no real card is charged) — this only
          controls what's shown and which plan_id gets recorded when a user "subscribes".
        </div>

        {/* New plan */}
        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 font-display text-base font-bold text-slate-900">New plan</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title — e.g. Monthly" className={inputCls} />
            <input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="Subtitle — e.g. Billed every month" className={inputCls} />
            <select value={draft.interval} onChange={(e) => setDraft({ ...draft, interval: e.target.value })} className={inputCls}>
              {INTERVAL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="Price" className={inputCls} />
            <input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} placeholder="Currency — AMD" className={inputCls} />
            <input value={draft.badge_label} onChange={(e) => setDraft({ ...draft, badge_label: e.target.value })} placeholder="Badge (optional) — e.g. Best value" className={inputCls} />
          </div>
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">Perks</div>
            <PerksEditor perks={draft.perks} onChange={(perks) => setDraft({ ...draft, perks })} />
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={createPlan} disabled={busy || !draft.title.trim()} className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60">
              <Plus className="h-4 w-4" /> Add plan
            </button>
          </div>
        </section>

        {/* Existing plans */}
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">No plans yet.</div>
        ) : (
          <div className="space-y-3">
            {plans.map((p, idx) => {
              const e = edits[p.id] || {};
              return (
                <div key={p.id} className={cx("rounded-3xl bg-white p-4 ring-1 shadow-sm", p.is_active ? "ring-slate-200" : "ring-slate-200 opacity-70")}>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 pt-1">
                      <button type="button" onClick={() => movePlan(idx, -1)} disabled={busy || idx === 0} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => movePlan(idx, 1)} disabled={busy || idx === plans.length - 1} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-50 text-gold-600"><Crown className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input value={e.title || ""} onChange={(ev) => patch(p.id, { title: ev.target.value })} placeholder="Title" className={cx(inputCls, "!py-2 font-bold")} />
                        <input value={e.subtitle || ""} onChange={(ev) => patch(p.id, { subtitle: ev.target.value })} placeholder="Subtitle" className={cx(inputCls, "!py-2 text-xs")} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <select value={e.interval || "month"} onChange={(ev) => patch(p.id, { interval: ev.target.value })} className={cx(inputCls, "!py-2")}>
                          {INTERVAL_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <input type="number" value={e.price ?? 0} onChange={(ev) => patch(p.id, { price: ev.target.value })} className={cx(inputCls, "!py-2")} placeholder="Price" />
                        <input value={e.currency || "AMD"} onChange={(ev) => patch(p.id, { currency: ev.target.value })} className={cx(inputCls, "!py-2")} placeholder="Currency" />
                        <input value={e.badge_label || ""} onChange={(ev) => patch(p.id, { badge_label: ev.target.value })} className={cx(inputCls, "!py-2")} placeholder="Badge (optional)" />
                      </div>
                      <div>
                        <div className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Perks</div>
                        <PerksEditor perks={e.perks || []} onChange={(perks) => patch(p.id, { perks })} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button type="button" onClick={() => togglePlan(p)} disabled={busy}
                          className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                            p.is_active ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200")}>
                          {p.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          {p.is_active ? "Live" : "Hidden"}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => savePlan(p)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                      <button type="button" onClick={() => removePlan(p)} disabled={busy} className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
