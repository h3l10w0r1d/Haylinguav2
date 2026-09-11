// src/cms/CmsItems.jsx — authoring UI for item_definitions, the live catalog
// behind GET /me/shop's cosmetic listing (avatar frames, profile themes,
// name tags, avatar-builder trait unlocks). Unlike CmsShop.jsx's shop_items
// table, rows created/edited here are what players actually see.
//
// A manually ordered table (filterable by category); each item opens in a
// side-sheet editor.
import { useEffect, useMemo, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Eye, EyeOff, Gem, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import CmsLayout from "./CmsLayout";
import {
  Badge, Button, DataTable, EditorSheet, EmptyState, Field, FieldRow, Input, ListToolbar, Note, ReorderButtons,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusPill, Switch,
  cn as cx, isDirty, notify, useConfirm, useListQuery,
} from "./ui";

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
  emote: "PNG filename stem under public/emotes/kenney/emotes-pack/, e.g. faceHappy, heart, star",
};

const RARITY_TEXT_CLS = {
  common: "text-slate-500", uncommon: "text-grass-600", rare: "text-feather-600",
  epic: "text-purple-600", legendary: "text-gold-600",
};
const DEFAULT_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

const emptyFields = (category = "") => ({
  category, slug: "", title: "", description: "", icon: "", rarity: "common",
  render_key: "", price_gems: "100", tradeable: true, is_active: true,
});

function itemToFields(it) {
  return {
    category: it.category || "", slug: it.slug || "", title: it.title || "",
    description: it.description || "", icon: it.icon || "", rarity: it.rarity || "common",
    render_key: it.render_key || "", price_gems: String(it.price_gems ?? 0),
    tradeable: it.tradeable !== false, is_active: it.is_active !== false,
  };
}

export default function CmsItems() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const confirm = useConfirm();
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rarities, setRarities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [editor, setEditor] = useState(null); // { id, title, initial, fields }
  const [saving, setSaving] = useState(false);

  const list = useListQuery();
  const activeCategory = list.get("category") || "";

  async function refresh() {
    const res = await api.listItemDefinitions(activeCategory || undefined);
    setItems(Array.isArray(res?.items) ? res.items : []);
    setCategories(Array.isArray(res?.categories) ? res.categories : []);
    setRarities(Array.isArray(res?.rarities) ? res.rarities : []);
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      await refresh();
    } catch (err) {
      setLoadError(err.message || "Failed to load items");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeCategory]);

  const rarityOptions = rarities.length ? rarities.map((r) => r.rarity) : DEFAULT_RARITIES;
  const categoryOptions = useMemo(
    () => [...new Set([...categories, ...Object.keys(RENDER_KEY_HINTS)])].sort(),
    [categories]
  );

  function openNew() {
    const fields = emptyFields(activeCategory);
    setEditor({ id: null, initial: fields, fields });
  }

  function openEdit(it) {
    const fields = itemToFields(it);
    setEditor({ id: it.id, title: it.title, initial: fields, fields });
  }

  function setField(patch) {
    setEditor((e) => ({ ...e, fields: { ...e.fields, ...patch } }));
  }

  const f = editor?.fields;
  const missingRequired = f ? ["category", "slug", "title", "render_key"].filter((k) => !String(f[k] || "").trim()) : [];

  async function save() {
    if (missingRequired.length) {
      notify("Category, slug, title and render key are required", "err");
      return;
    }
    const payload = {
      category: f.category.trim(),
      slug: f.slug.trim(),
      title: f.title.trim(),
      description: f.description.trim() || null,
      icon: f.icon.trim() || null,
      rarity: f.rarity,
      render_key: f.render_key.trim(),
      price_gems: Number(f.price_gems) || 0,
      tradeable: !!f.tradeable,
      is_active: !!f.is_active,
    };
    setSaving(true);
    try {
      if (editor.id == null) await api.createItemDefinition(payload);
      else await api.updateItemDefinition(editor.id, payload);
      notify(editor.id == null ? "Item created" : "Item saved");
      setEditor(null);
      await refresh();
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  async function toggleItem(it) {
    try {
      await api.updateItemDefinition(it.id, { is_active: !it.is_active });
      notify(it.is_active ? "Hidden from the shop" : "Now live in the shop");
      await refresh();
    } catch (err) {
      notify(err.message || "Update failed", "err");
    }
  }

  async function removeItem(it) {
    if (!(await confirm({ title: `Delete "${it.title}"?`, description: "This can't be undone." }))) return false;
    try {
      await api.deleteItemDefinition(it.id);
      notify("Item deleted");
      await refresh();
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
      await api.reorderItemDefinitions(next.map((x) => x.id));
    } catch (err) {
      notify(err.message || "Reorder failed", "err");
      await refresh().catch(() => {});
    } finally {
      setReordering(false);
    }
  }

  const columns = [
    {
      key: "order",
      header: <span className="sr-only">Order</span>,
      headerClassName: "w-[4.5rem]",
      className: "py-1",
      cell: (it) => <ReorderButtons index={items.indexOf(it)} count={items.length} onMove={moveItem} disabled={reordering} label="item" />,
    },
    {
      key: "title",
      header: "Item",
      cell: (it) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">{it.title}</div>
          <div className="truncate font-mono text-xs text-slate-500">{it.slug}</div>
        </div>
      ),
    },
    ...(activeCategory
      ? []
      : [{ key: "category", header: "Category", hideBelow: "sm", cell: (it) => <Badge variant="outline" className="font-mono font-normal">{it.category}</Badge> }]),
    {
      key: "rarity",
      header: "Rarity",
      hideBelow: "md",
      cell: (it) => <span className={cx("capitalize", RARITY_TEXT_CLS[it.rarity])}>{it.rarity}</span>,
    },
    {
      key: "price_gems",
      header: "Price",
      align: "right",
      cell: (it) => (
        <span className="inline-flex items-center gap-1 tabular-nums text-slate-700">
          <Gem className="h-3.5 w-3.5 text-feather-500" /> {it.price_gems ?? 0}
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

  const editingItem = editor?.id != null ? items.find((x) => x.id === editor.id) : null;

  return (
    <CmsLayout
      active="items"
      title="Marketplace Items"
      description="The live cosmetic catalog in the app shop. Changes take effect immediately."
      actions={<Button onClick={openNew}><Plus /> New item</Button>}
    >
      <Note tone="brand" className="mb-4">
        Avatar frames, profile themes, name tags and avatar-builder unlocks (clothing graphics, hairstyles, eyebrows).
      </Note>

      <ListToolbar
        filters={
          <Select value={activeCategory || "all"} onValueChange={(v) => list.set({ category: v === "all" ? "" : v })}>
            <SelectTrigger className="h-9 w-[13rem] text-sm" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        count={loading ? undefined : items.length}
        countLabel="item"
      />

      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        error={loadError}
        onRetry={load}
        onRowClick={openEdit}
        rowActions={rowActions}
        emptyState={
          <EmptyState
            icon={Sparkles}
            title={activeCategory ? `No ${activeCategory} items` : "No items yet"}
            description="Add a cosmetic players can buy or trade."
            action={<Button size="sm" onClick={openNew}><Plus /> New item</Button>}
          />
        }
      />

      <EditorSheet
        open={!!editor}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        size="md"
        title={editor?.id == null ? "New marketplace item" : editor?.title || "Edit item"}
        dirty={!!editor && isDirty(editor.initial, editor.fields)}
        saving={saving}
        onSave={save}
        saveLabel={editor?.id == null ? "Create item" : "Save changes"}
        saveDisabled={missingRequired.length > 0}
        onDelete={editingItem ? async () => { if (await removeItem(editingItem)) setEditor(null); } : undefined}
        footerStart={
          f && (
            <label className="ml-1 flex items-center gap-2 text-sm text-slate-700">
              <Switch checked={!!f.is_active} onCheckedChange={(v) => setField({ is_active: v })} />
              {f.is_active ? "Live" : "Hidden"}
            </label>
          )
        }
      >
        {f && (
          <div className="space-y-4">
            <FieldRow>
              <Field label="Category" required hint="Pick a known one or type a new one">
                <Input list="cms-item-categories" value={f.category} onChange={(e) => setField({ category: e.target.value })} className="font-mono" />
                <datalist id="cms-item-categories">
                  {categoryOptions.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Rarity">
                <Select value={f.rarity} onValueChange={(rarity) => setField({ rarity })}>
                  <SelectTrigger aria-label="Rarity" className={cx("capitalize", RARITY_TEXT_CLS[f.rarity])}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rarityOptions.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Title" required>
                <Input value={f.title} onChange={(e) => setField({ title: e.target.value })} />
              </Field>
              <Field label="Slug" required hint="Stable identifier, lowercase">
                <Input value={f.slug} onChange={(e) => setField({ slug: e.target.value })} className="font-mono" />
              </Field>
            </FieldRow>
            <Field label="Description">
              <Input value={f.description} onChange={(e) => setField({ description: e.target.value })} />
            </Field>
            <Field label="Render key" required hint={RENDER_KEY_HINTS[f.category] || "The value the app uses to draw this item"}>
              <Input value={f.render_key} onChange={(e) => setField({ render_key: e.target.value })} className="font-mono" />
            </Field>
            <FieldRow>
              <Field label="Price" hint="In gems">
                <Input type="number" min="0" value={f.price_gems} onChange={(e) => setField({ price_gems: e.target.value })} />
              </Field>
              <Field label="Icon" hint="Optional">
                <Input value={f.icon} onChange={(e) => setField({ icon: e.target.value })} />
              </Field>
            </FieldRow>
            <label className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 ring-slate-200">
              <span>
                <span className="block text-sm font-medium text-slate-800">Tradeable</span>
                <span className="block text-xs text-slate-500">Players can trade this item with friends</span>
              </span>
              <Switch checked={!!f.tradeable} onCheckedChange={(v) => setField({ tradeable: v })} />
            </label>
          </div>
        )}
      </EditorSheet>
    </CmsLayout>
  );
}
