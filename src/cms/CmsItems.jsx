// src/cms/CmsItems.jsx — authoring UI for item_definitions, the live catalog
// behind GET /me/shop's cosmetic listing (avatar frames, profile themes,
// name tags, avatar-builder trait unlocks). Unlike CmsShop.jsx's shop_items
// table, rows created/edited here are what players actually see.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import CmsLayout from "./CmsLayout";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

// render_key hints per category — the DiceBear avataaars option values (or
// CSS class names for name_tag_effect) each category actually recognizes.
// Free text on purpose (category isn't a fixed enum server-side either),
// but this keeps admins from typoing a value the app won't render.
const RENDER_KEY_HINTS = {
  avatar_frame: "A FRAME_STYLES key: gold, silver, bronze, ruby, sapphire, emerald, rainbow",
  profile_theme: "A profile theme key (see ProfilePage.jsx's theme list)",
  name_tag_effect: "A CSS class from src/index.css: nametag-frost, nametag-ember, nametag-royal, nametag-starlight, nametag-prismatic",
  avatar_clothing_graphic: "DiceBear clothesGraphic value: bat, bear, cumbia, deer, diamond, hola, pizza, resist, skull, skullOutline",
  avatar_hairstyle: "DiceBear top value: dreads, frida, shavedSides, theCaesarAndSidePart",
  avatar_eyebrows: "DiceBear eyebrows value: angry, default, raisedExcited, sadConcerned, upDown",
};

const RARITY_TEXT_CLS = {
  common: "text-slate-500", uncommon: "text-grass-600", rare: "text-feather-600",
  epic: "text-purple-600", legendary: "text-gold-600",
};

const emptyDraft = () => ({
  category: "", slug: "", title: "", description: "", icon: "", rarity: "common",
  render_key: "", price_gems: 100, tradeable: true, is_active: true,
});

export default function CmsItems() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rarities, setRarities] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh(category) {
    const res = await api.listItemDefinitions(category || undefined);
    const list = Array.isArray(res?.items) ? res.items : [];
    setItems(list);
    setCategories(Array.isArray(res?.categories) ? res.categories : []);
    setRarities(Array.isArray(res?.rarities) ? res.rarities : []);
    const e = {};
    list.forEach((it) => {
      e[it.id] = {
        category: it.category || "", slug: it.slug || "", title: it.title || "",
        description: it.description || "", icon: it.icon || "", rarity: it.rarity || "common",
        render_key: it.render_key || "", price_gems: it.price_gems ?? 0,
        tradeable: it.tradeable !== false, is_active: it.is_active !== false,
      };
    });
    setEdits(e);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh(activeCategory);
      } catch (err) {
        showToast(err.message || "Failed to load items", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeCategory]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function createItem() {
    if (!draft.category.trim() || !draft.slug.trim() || !draft.title.trim() || !draft.render_key.trim()) return;
    setBusy(true);
    try {
      await api.createItemDefinition({
        ...draft,
        category: draft.category.trim(), slug: draft.slug.trim(), title: draft.title.trim(),
        description: draft.description.trim() || null, icon: draft.icon.trim() || null,
        render_key: draft.render_key.trim(), price_gems: Number(draft.price_gems) || 0,
      });
      setDraft(emptyDraft());
      await refresh(activeCategory);
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
      await api.updateItemDefinition(it.id, {
        category: e.category, slug: e.slug, title: e.title, description: e.description || null,
        icon: e.icon || null, rarity: e.rarity, render_key: e.render_key,
        price_gems: Number(e.price_gems) || 0, tradeable: !!e.tradeable, is_active: !!e.is_active,
      });
      await refresh(activeCategory);
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
      await api.updateItemDefinition(it.id, { is_active: !it.is_active });
      await refresh(activeCategory);
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(it) {
    if (!confirm(`Delete "${it.title}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api.deleteItemDefinition(it.id);
      await refresh(activeCategory);
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
      await api.reorderItemDefinitions(next.map((x) => x.id));
      await refresh(activeCategory);
    } catch (err) {
      showToast(err.message || "Reorder failed", "err");
      await refresh(activeCategory);
    } finally {
      setBusy(false);
    }
  }

  function patch(id, p) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  return (
    <CmsLayout active="items" title="Marketplace Items">
      <div className="space-y-6">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          This is the live catalog behind the in-app shop's cosmetic listing — avatar frames,
          profile themes, name tags, and avatar-builder trait unlocks (clothing graphics,
          hairstyles, eyebrows). Changes here take effect immediately.
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("")}
            className={cx(
              "rounded-2xl px-3.5 py-2 text-xs font-extrabold uppercase tracking-wide transition",
              activeCategory === "" ? "bg-brand-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={cx(
                "rounded-2xl px-3.5 py-2 text-xs font-extrabold uppercase tracking-wide transition",
                activeCategory === c ? "bg-brand-500 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 font-display text-base font-bold text-slate-900">New item</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Category — e.g. avatar_hairstyle"
              list="cms-items-category-options"
              className={inputCls}
            />
            <datalist id="cms-items-category-options">
              {Object.keys(RENDER_KEY_HINTS).map((c) => <option key={c} value={c} />)}
            </datalist>
            <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder="Slug — unique, e.g. hairstyle_dreads" className={inputCls} />
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" className={inputCls} />
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description" className={inputCls} />
            <input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} placeholder="Icon (optional)" className={inputCls} />
            <select value={draft.rarity} onChange={(e) => setDraft({ ...draft, rarity: e.target.value })} className={inputCls}>
              {(rarities.length ? rarities.map((r) => r.rarity) : ["common", "uncommon", "rare", "epic", "legendary"]).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input value={draft.render_key} onChange={(e) => setDraft({ ...draft, render_key: e.target.value })} placeholder="Render key" className={inputCls} />
            <input type="number" value={draft.price_gems} onChange={(e) => setDraft({ ...draft, price_gems: e.target.value })} placeholder="Price (gems)" className={inputCls} />
            <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 ring-2 ring-slate-200">
              <input type="checkbox" checked={draft.tradeable} onChange={(e) => setDraft({ ...draft, tradeable: e.target.checked })} />
              Tradeable
            </label>
          </div>
          {draft.category && RENDER_KEY_HINTS[draft.category] && (
            <div className="mt-2 text-xs font-semibold text-slate-500">{RENDER_KEY_HINTS[draft.category]}</div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={createItem}
              disabled={busy || !draft.category.trim() || !draft.slug.trim() || !draft.title.trim() || !draft.render_key.trim()}
              className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </section>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">No items in this category yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => {
              const e = edits[it.id] || {};
              return (
                <div key={it.id} className={cx("rounded-3xl bg-white p-4 ring-1 shadow-sm", it.is_active ? "ring-slate-200" : "ring-slate-200 opacity-70")}>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 pt-1">
                      <button type="button" onClick={() => moveItem(idx, -1)} disabled={busy || idx === 0} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => moveItem(idx, 1)} disabled={busy || idx === items.length - 1} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input value={e.category || ""} onChange={(ev) => patch(it.id, { category: ev.target.value })} className={cx(inputCls, "!py-2 text-xs")} title="Category" />
                        <input value={e.slug || ""} onChange={(ev) => patch(it.id, { slug: ev.target.value })} className={cx(inputCls, "!py-2 text-xs")} title="Slug" />
                        <input value={e.title || ""} onChange={(ev) => patch(it.id, { title: ev.target.value })} className={cx(inputCls, "!py-2 font-bold")} placeholder="Title" />
                      </div>
                      <input value={e.description || ""} onChange={(ev) => patch(it.id, { description: ev.target.value })} placeholder="Description" className={cx(inputCls, "!py-2 text-xs")} />
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <select value={e.rarity || "common"} onChange={(ev) => patch(it.id, { rarity: ev.target.value })} className={cx(inputCls, "!py-2", RARITY_TEXT_CLS[e.rarity])}>
                          {(rarities.length ? rarities.map((r) => r.rarity) : ["common", "uncommon", "rare", "epic", "legendary"]).map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <input value={e.render_key || ""} onChange={(ev) => patch(it.id, { render_key: ev.target.value })} className={cx(inputCls, "!py-2")} title="Render key" placeholder="render_key" />
                        <input type="number" value={e.price_gems ?? 0} onChange={(ev) => patch(it.id, { price_gems: ev.target.value })} className={cx(inputCls, "!py-2")} title="Price (gems)" placeholder="Price" />
                        <label className="flex items-center gap-1.5 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-2 ring-slate-200">
                          <input type="checkbox" checked={!!e.tradeable} onChange={(ev) => patch(it.id, { tradeable: ev.target.checked })} />
                          Tradeable
                        </label>
                      </div>
                      {RENDER_KEY_HINTS[e.category] && (
                        <div className="text-xs font-semibold text-slate-400">{RENDER_KEY_HINTS[e.category]}</div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => toggleItem(it)}
                          disabled={busy}
                          className={cx(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                            it.is_active ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200"
                          )}
                        >
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
