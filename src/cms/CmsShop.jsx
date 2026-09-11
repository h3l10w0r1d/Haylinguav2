// src/cms/CmsShop.jsx — shop items (power-ups bought with gems) + chest
// reward odds. Items are a manually ordered table; clicking one (or "New
// item") opens its editor in a side sheet. Chest odds stay an inline
// settings form with its own Save, loaded separately so saving an item never
// resets unsaved odds.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import {
  Award, Eye, EyeOff, Gem, Gift, Heart, Image, Pencil, Plus, Shield, ShieldCheck, Snowflake, Trash2, TrendingUp, Zap,
} from "lucide-react";
import CmsLayout from "./CmsLayout";
import AvatarFrame from "../lib/avatarFrame";
import {
  Button, DataTable, EditorSheet, EmptyState, Field, FieldRow, Input, Note, ReorderButtons, SectionCard,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusPill,
  cn as cx, inputCls, isDirty, notify, useConfirm,
} from "./ui";

const ICONS = { snowflake: Snowflake, heart: Heart, zap: Zap, gem: Gem, shield: Shield, "shield-check": ShieldCheck, "trending-up": TrendingUp, award: Award, image: Image };
const ICON_OPTS = ["snowflake", "heart", "zap", "gem", "shield", "shield-check", "trending-up", "award", "image"];
const FRAME_STYLE_OPTIONS = ["gold", "silver", "bronze", "ruby", "sapphire", "emerald", "rainbow"];
const EFFECTS = [
  { value: "streak_freeze", label: "Streak freeze", hint: "Grants streak freezes. Amount is how many." },
  { value: "hearts_refill", label: "Hearts refill", hint: "Refills the learner's hearts." },
  { value: "xp_boost", label: "Add XP", hint: "Adds XP instantly. Amount is how much." },
  { value: "streak_repair", label: "Streak repair", hint: "Repairs a recently broken streak." },
  { value: "heart_shield", label: "Heart shield", hint: "The next lesson can't cost hearts." },
  { value: "xp_multiplier", label: "Double XP", hint: "Doubles XP on the next lesson." },
  { value: "avatar_frame", label: "Avatar frame", hint: "Legacy cosmetic. Use Marketplace Items instead." },
  { value: "profile_theme", label: "Profile theme", hint: "Legacy cosmetic. Use Marketplace Items instead." },
];
const EFFECT_BY_VALUE = Object.fromEntries(EFFECTS.map((e) => [e.value, e]));
const TIERS = ["wooden", "silver", "golden", "legendary"];
const TIER_DOT = { wooden: "#B07A45", silver: "#93A7BC", golden: "#FFC800", legendary: "#9B3FE8" };

const EMPTY_ITEM = { title: "", description: "", icon: "gem", price: "30", effect: "streak_freeze", effect_amount: "0", frame_style: "" };

function itemToFields(it) {
  return {
    title: it.title || "",
    description: it.description || "",
    icon: it.icon || "gem",
    price: String(it.price ?? 0),
    effect: it.effect || "streak_freeze",
    effect_amount: String(it.effect_amount ?? 0),
    frame_style: it.frame_style || "",
  };
}

function FrameStylePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FRAME_STYLE_OPTIONS.map((style) => (
        <button
          key={style}
          type="button"
          title={style}
          aria-label={`Frame style ${style}`}
          aria-pressed={value === style}
          onClick={() => onChange(value === style ? "" : style)}
          className={cx(
            "grid place-items-center rounded-full transition",
            value === style ? "ring-2 ring-brand-500 ring-offset-2" : "ring-1 ring-slate-200 hover:ring-slate-300"
          )}
        >
          <AvatarFrame frameStyle={style} size={28} thickness={2.5}>
            <div className="h-full w-full bg-white" />
          </AvatarFrame>
        </button>
      ))}
    </div>
  );
}

function IconChoice({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ICON_OPTS.map((ic) => {
        const I = ICONS[ic];
        const on = value === ic;
        return (
          <button
            key={ic}
            type="button"
            title={ic}
            aria-label={`Icon ${ic}`}
            aria-pressed={on}
            onClick={() => onChange(ic)}
            className={cx(
              "grid h-9 w-9 place-items-center rounded-lg ring-1 transition",
              on ? "bg-brand-50 text-brand-600 ring-brand-300" : "bg-white text-slate-400 ring-slate-200 hover:text-slate-600"
            )}
          >
            <I className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

export default function CmsShop() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const confirm = useConfirm();
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [editor, setEditor] = useState(null); // { id, title, initial, fields }
  const [saving, setSaving] = useState(false);

  const [chest, setChest] = useState([]); // [{gems, weight, rarity}]
  const [rarities, setRarities] = useState([]); // [{rarity, weight, xp_boost_chance}]
  const [chestSaved, setChestSaved] = useState(null);
  const [savingChest, setSavingChest] = useState(false);

  async function refreshItems() {
    const si = await api.listShopItems();
    setItems(Array.isArray(si?.items) ? si.items : []);
  }

  async function loadItems() {
    setLoading(true);
    setLoadError(null);
    try {
      await refreshItems();
    } catch (err) {
      setLoadError(err.message || "Failed to load shop items");
    } finally {
      setLoading(false);
    }
  }

  async function loadChest() {
    try {
      const cc = await api.getChestConfig();
      const c = (cc?.rewards || []).map((r) => ({ gems: String(r.gems), weight: String(r.weight), rarity: r.rarity || "wooden" }));
      const r = (cc?.rarities || []).map((x) => ({ rarity: x.rarity, weight: String(x.weight), xp_boost_chance: String(x.xp_boost_chance) }));
      setChest(c);
      setRarities(r);
      setChestSaved(JSON.stringify({ chest: c, rarities: r }));
    } catch (err) {
      notify(err.message || "Failed to load chest odds", "err");
    }
  }

  useEffect(() => {
    loadItems();
    loadChest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const chestDirty = chestSaved !== null && JSON.stringify({ chest, rarities }) !== chestSaved;
  useEffect(() => {
    if (!chestDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [chestDirty]);

  function openNew() {
    setEditor({ id: null, initial: EMPTY_ITEM, fields: EMPTY_ITEM });
  }

  function openEdit(it) {
    const fields = itemToFields(it);
    setEditor({ id: it.id, title: it.title, initial: fields, fields });
  }

  function setField(patch) {
    setEditor((e) => ({ ...e, fields: { ...e.fields, ...patch } }));
  }

  async function save() {
    const f = editor.fields;
    if (!f.title.trim()) {
      notify("An item needs a title", "err");
      return;
    }
    const payload = {
      title: f.title.trim(),
      description: f.description.trim(),
      icon: f.icon,
      price: Number(f.price) || 0,
      effect: f.effect,
      effect_amount: Number(f.effect_amount) || 0,
      frame_style: f.effect === "avatar_frame" ? f.frame_style || null : null,
    };
    setSaving(true);
    try {
      if (editor.id == null) await api.createShopItem(payload);
      else await api.updateShopItem(editor.id, payload);
      // New items are created hidden (server default), like lessons/chapters.
      notify(editor.id == null ? "Item created. It stays hidden until you show it." : "Item saved");
      setEditor(null);
      await refreshItems();
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(it) {
    try {
      await api.updateShopItem(it.id, { is_active: !it.is_active });
      notify(it.is_active ? "Hidden from the shop" : "Now live in the shop");
      await refreshItems();
    } catch (err) {
      notify(err.message || "Update failed", "err");
    }
  }

  async function removeItem(it) {
    if (!(await confirm({ title: `Delete "${it.title}" from the shop?`, description: "This can't be undone." }))) return false;
    try {
      await api.deleteShopItem(it.id);
      notify("Item deleted");
      await refreshItems();
      return true;
    } catch (err) {
      notify(err.message || "Delete failed", "err");
      return false;
    }
  }

  async function moveItem(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    const [m] = next.splice(idx, 1);
    next.splice(j, 0, m);
    setItems(next);
    setReordering(true);
    try {
      await api.reorderShopItems(next.map((x) => x.id));
    } catch (err) {
      notify(err.message || "Reorder failed", "err");
      await refreshItems().catch(() => {});
    } finally {
      setReordering(false);
    }
  }

  async function saveChest() {
    setSavingChest(true);
    try {
      await api.setChestConfig(
        chest.map((r) => ({ gems: Number(r.gems) || 0, weight: Number(r.weight) || 0, rarity: r.rarity || "wooden" })),
        rarities.map((r) => ({ rarity: r.rarity, weight: Number(r.weight) || 0, xp_boost_chance: Number(r.xp_boost_chance) || 0 })),
      );
      await loadChest();
      notify("Chest odds saved");
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setSavingChest(false);
    }
  }

  const columns = [
    {
      key: "order",
      header: <span className="sr-only">Order</span>,
      headerClassName: "w-[4.5rem]",
      className: "py-1",
      cell: (it) => (
        <ReorderButtons index={items.indexOf(it)} count={items.length} onMove={moveItem} disabled={reordering} label="item" />
      ),
    },
    {
      key: "title",
      header: "Item",
      cell: (it) => {
        const Icon = ICONS[it.icon] || Gem;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-feather-50 text-feather-500">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-900">{it.title}</div>
              {it.description && <div className="truncate text-xs text-slate-500">{it.description}</div>}
            </div>
          </div>
        );
      },
    },
    {
      key: "effect",
      header: "Effect",
      hideBelow: "md",
      cell: (it) => (
        <span className="text-slate-600">
          {EFFECT_BY_VALUE[it.effect]?.label || it.effect}
          {Number(it.effect_amount) > 0 ? <span className="text-slate-400"> · {it.effect_amount}</span> : null}
        </span>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      cell: (it) => (
        <span className="inline-flex items-center gap-1 tabular-nums text-slate-700">
          <Gem className="h-3.5 w-3.5 text-feather-500" /> {it.price}
        </span>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      cell: (it) => <StatusPill tone={it.is_active ? "success" : "neutral"}>{it.is_active ? "Live" : "Hidden"}</StatusPill>,
    },
  ];

  const rowActions = (it) => [
    { label: "Edit", icon: Pencil, onSelect: openEdit },
    { label: it.is_active ? "Hide from shop" : "Show in shop", icon: it.is_active ? EyeOff : Eye, onSelect: toggleItem },
    { label: "Delete", icon: Trash2, destructive: true, onSelect: removeItem },
  ];

  const f = editor?.fields;
  const editingItem = editor?.id != null ? items.find((x) => x.id === editor.id) : null;
  const rarityTotal = rarities.reduce((s, x) => s + (Number(x.weight) || 0), 0) || 1;

  return (
    <CmsLayout
      active="shop"
      title="Shop & Economy"
      description="Power-ups learners buy with gems, and the odds inside reward chests."
      actions={<Button onClick={openNew}><Plus /> New item</Button>}
    >
      <div className="space-y-8">
        <section>
          <Note tone="warning" className="mb-4">
            Avatar frames and profile themes now live in{" "}
            <Link to="/cms/items" className="underline underline-offset-2">Marketplace Items</Link>. Any avatar_frame or
            profile_theme rows below are historical: editing them no longer changes what players see.
          </Note>
          <DataTable
            columns={columns}
            rows={items}
            loading={loading}
            error={loadError}
            onRetry={loadItems}
            onRowClick={openEdit}
            rowActions={rowActions}
            emptyState={
              <EmptyState
                icon={Gem}
                title="No shop items yet"
                description="Add a power-up learners can buy with gems."
                action={<Button size="sm" onClick={openNew}><Plus /> New item</Button>}
              />
            }
          />
        </section>

        <SectionCard
          title={<span className="inline-flex items-center gap-2"><Gift className="h-5 w-5 text-gold-500" /> Chest reward odds</span>}
          description="Opening a chest first rolls a rarity, then a gem reward from that rarity's table. Legendary always pays gems plus an XP boost."
        >
          {rarities.length > 0 && (
            <div className="mb-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Rarity odds</div>
              <div className="space-y-2">
                <div className="grid grid-cols-[110px_1fr_1fr_70px] gap-2 px-1 text-xs text-slate-500">
                  <span>Tier</span><span>Weight</span><span>XP boost %</span><span>Chance</span>
                </div>
                {rarities.map((r, i) => {
                  const pct = Math.round(((Number(r.weight) || 0) / rarityTotal) * 100);
                  return (
                    <div key={r.rarity} className="grid grid-cols-[110px_1fr_1fr_70px] items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium capitalize text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_DOT[r.rarity] || "#94a3b8" }} />
                        {r.rarity}
                      </span>
                      <input type="number" aria-label={`${r.rarity} weight`} value={r.weight} onChange={(ev) => setRarities((c) => c.map((x, j) => (j === i ? { ...x, weight: ev.target.value } : x)))} className={inputCls} />
                      <input type="number" min="0" max="100" aria-label={`${r.rarity} XP boost chance`} value={r.xp_boost_chance} onChange={(ev) => setRarities((c) => c.map((x, j) => (j === i ? { ...x, xp_boost_chance: ev.target.value } : x)))} className={inputCls} />
                      <span className="text-sm tabular-nums text-slate-600">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {TIERS.map((tier) => {
              const rows = chest.map((r, i) => ({ ...r, _i: i })).filter((r) => (r.rarity || "wooden") === tier);
              const tierWeight = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 1;
              return (
                <div key={tier}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      <span className="h-2 w-2 rounded-full" style={{ background: TIER_DOT[tier] }} />
                      {tier} rewards
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setChest((c) => [...c, { gems: "10", weight: "5", rarity: tier }])}>
                      <Plus /> Add
                    </Button>
                  </div>
                  {rows.length === 0 ? (
                    <p className="px-1 text-xs text-slate-400">No rewards. The built-in fallback table applies.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_56px_36px] gap-2 px-1 text-xs text-slate-500">
                        <span>Gems</span><span>Weight</span><span>Chance</span><span />
                      </div>
                      {rows.map((r) => {
                        const pct = Math.round(((Number(r.weight) || 0) / tierWeight) * 100);
                        const i = r._i;
                        return (
                          <div key={i} className="grid grid-cols-[1fr_1fr_56px_36px] items-center gap-2">
                            <input type="number" aria-label="Gems" value={r.gems} onChange={(ev) => setChest((c) => c.map((x, j) => (j === i ? { ...x, gems: ev.target.value } : x)))} className={inputCls} />
                            <input type="number" aria-label="Weight" value={r.weight} onChange={(ev) => setChest((c) => c.map((x, j) => (j === i ? { ...x, weight: ev.target.value } : x)))} className={inputCls} />
                            <span className="text-sm tabular-nums text-slate-600">{pct}%</span>
                            <Button type="button" variant="ghost" size="icon" aria-label="Remove reward" className="text-slate-400 hover:text-cardinal-600" onClick={() => setChest((c) => c.filter((_, j) => j !== i))}>
                              <Trash2 />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            {chestDirty && <span className="text-xs text-slate-500">Unsaved changes</span>}
            {chestDirty && (
              <Button type="button" variant="outline" onClick={loadChest} disabled={savingChest}>Discard</Button>
            )}
            <Button type="button" onClick={saveChest} disabled={savingChest || !chestDirty || chest.length === 0}>
              Save odds
            </Button>
          </div>
        </SectionCard>
      </div>

      <EditorSheet
        open={!!editor}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        size="md"
        title={editor?.id == null ? "New shop item" : editor?.title || "Edit item"}
        description={editor?.id == null ? "New items start hidden. Show them from the table when they're ready." : null}
        dirty={!!editor && isDirty(editor.initial, editor.fields)}
        saving={saving}
        onSave={save}
        saveLabel={editor?.id == null ? "Create item" : "Save changes"}
        saveDisabled={!f?.title?.trim()}
        onDelete={editingItem ? async () => { if (await removeItem(editingItem)) setEditor(null); } : undefined}
      >
        {f && (
          <div className="space-y-4">
            <Field label="Title" required>
              <Input value={f.title} onChange={(e) => setField({ title: e.target.value })} placeholder="e.g. Streak Freeze" />
            </Field>
            <Field label="Description" hint="Shown under the title in the shop">
              <Input value={f.description} onChange={(e) => setField({ description: e.target.value })} />
            </Field>
            <Field label="Icon">
              <IconChoice value={f.icon} onChange={(icon) => setField({ icon })} />
            </Field>
            <Field label="Effect" hint={EFFECT_BY_VALUE[f.effect]?.hint}>
              <Select value={f.effect} onValueChange={(effect) => setField({ effect })}>
                <SelectTrigger aria-label="Effect"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EFFECTS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {f.effect === "avatar_frame" && (
              <Field label="Frame style">
                <FrameStylePicker value={f.frame_style} onChange={(frame_style) => setField({ frame_style })} />
              </Field>
            )}
            <FieldRow>
              <Field label="Price" hint="In gems">
                <Input type="number" min="0" value={f.price} onChange={(e) => setField({ price: e.target.value })} />
              </Field>
              <Field label="Amount" hint="Streak freezes: how many. Add XP: how much.">
                <Input type="number" min="0" value={f.effect_amount} onChange={(e) => setField({ effect_amount: e.target.value })} />
              </Field>
            </FieldRow>
          </div>
        )}
      </EditorSheet>
    </CmsLayout>
  );
}
