// src/cms/CmsPremium.jsx — Premium pricing plans shown on /premium. A
// manually ordered table; each plan opens in a side-sheet editor.
import { useEffect, useMemo, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Crown, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import CmsLayout from "./CmsLayout";
import {
  Badge, Button, DataTable, EditorSheet, EmptyState, Field, FieldRow, Input, Note, ReorderButtons,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusPill,
  isDirty, notify, useConfirm,
} from "./ui";

const INTERVAL_OPTS = [
  { value: "month", label: "Monthly", suffix: "/ month" },
  { value: "year", label: "Yearly", suffix: "/ year" },
  { value: "lifetime", label: "Lifetime (one-time)", suffix: "once" },
];
const INTERVAL_BY_VALUE = Object.fromEntries(INTERVAL_OPTS.map((o) => [o.value, o]));

const EMPTY_PLAN = { title: "", subtitle: "", price: "1490", currency: "AMD", interval: "month", badge_label: "", perks: [] };

function planToFields(p) {
  return {
    title: p.title || "",
    subtitle: p.subtitle || "",
    price: String(p.price ?? 0),
    currency: p.currency || "AMD",
    interval: p.interval || "month",
    badge_label: p.badge_label || "",
    perks: Array.isArray(p.perks) ? p.perks : [],
  };
}

function PerksEditor({ perks, onChange }) {
  const list = Array.isArray(perks) ? perks : [];
  return (
    <div className="space-y-2">
      {list.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={p}
            onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder="e.g. Unlimited hearts"
            aria-label={`Perk ${i + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove perk"
            className="shrink-0 text-slate-400 hover:text-cardinal-600"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, ""])}>
        <Plus /> Add perk
      </Button>
    </div>
  );
}

export default function CmsPremium() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const confirm = useConfirm();
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reordering, setReordering] = useState(false);
  const [editor, setEditor] = useState(null); // { id, title, initial, fields }
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const d = await api.listPremiumPlans();
    setPlans(Array.isArray(d?.plans) ? d.plans : []);
  }

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      await refresh();
    } catch (err) {
      setLoadError(err.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function openNew() {
    setEditor({ id: null, initial: EMPTY_PLAN, fields: EMPTY_PLAN });
  }

  function openEdit(p) {
    const fields = planToFields(p);
    setEditor({ id: p.id, title: p.title, initial: fields, fields });
  }

  function setField(patch) {
    setEditor((e) => ({ ...e, fields: { ...e.fields, ...patch } }));
  }

  async function save() {
    const f = editor.fields;
    if (!f.title.trim()) {
      notify("A plan needs a title", "err");
      return;
    }
    const payload = {
      title: f.title.trim(),
      subtitle: f.subtitle.trim(),
      price: Number(f.price) || 0,
      currency: f.currency.trim() || "AMD",
      interval: f.interval,
      badge_label: f.badge_label.trim() || null,
      perks: f.perks.map((x) => x.trim()).filter(Boolean),
    };
    setSaving(true);
    try {
      if (editor.id == null) await api.createPremiumPlan(payload);
      else await api.updatePremiumPlan(editor.id, payload);
      notify(editor.id == null ? "Plan created" : "Plan saved");
      setEditor(null);
      await refresh();
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  async function togglePlan(p) {
    try {
      await api.updatePremiumPlan(p.id, { is_active: !p.is_active });
      notify(p.is_active ? "Plan hidden from /premium" : "Plan is live on /premium");
      await refresh();
    } catch (err) {
      notify(err.message || "Update failed", "err");
    }
  }

  async function removePlan(p) {
    if (!(await confirm({ title: `Delete the "${p.title}" plan?`, description: "This can't be undone." }))) return false;
    try {
      await api.deletePremiumPlan(p.id);
      notify("Plan deleted");
      await refresh();
      return true;
    } catch (err) {
      notify(err.message || "Delete failed", "err");
      return false;
    }
  }

  async function movePlan(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= plans.length) return;
    const next = plans.slice();
    const [m] = next.splice(idx, 1);
    next.splice(j, 0, m);
    setPlans(next);
    setReordering(true);
    try {
      await api.reorderPremiumPlans(next.map((x) => x.id));
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
      cell: (p) => <ReorderButtons index={plans.indexOf(p)} count={plans.length} onMove={movePlan} disabled={reordering} label="plan" />,
    },
    {
      key: "title",
      header: "Plan",
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-50 text-gold-600">
            <Crown className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-slate-900">{p.title}</span>
              {p.badge_label && <Badge variant="outline" className="hidden shrink-0 md:inline-flex">{p.badge_label}</Badge>}
            </div>
            {p.subtitle && <div className="truncate text-xs text-slate-500">{p.subtitle}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      cell: (p) => (
        <span className="whitespace-nowrap tabular-nums text-slate-700">
          {Number(p.price || 0).toLocaleString()} {p.currency || "AMD"}{" "}
          <span className="text-slate-400">{INTERVAL_BY_VALUE[p.interval]?.suffix || ""}</span>
        </span>
      ),
    },
    {
      key: "perks",
      header: "Perks",
      hideBelow: "lg",
      align: "right",
      cell: (p) => <span className="tabular-nums text-slate-500">{Array.isArray(p.perks) ? p.perks.length : 0}</span>,
    },
    {
      key: "is_active",
      header: "Status",
      cell: (p) => <StatusPill tone={p.is_active ? "success" : "neutral"}>{p.is_active ? "Live" : "Hidden"}</StatusPill>,
    },
  ];

  const rowActions = (p) => [
    { label: "Edit", icon: Pencil, onSelect: openEdit },
    { label: p.is_active ? "Hide from /premium" : "Show on /premium", icon: p.is_active ? EyeOff : Eye, onSelect: togglePlan },
    { label: "Delete", icon: Trash2, destructive: true, onSelect: removePlan },
  ];

  const f = editor?.fields;
  const editingPlan = editor?.id != null ? plans.find((x) => x.id === editor.id) : null;

  return (
    <CmsLayout
      active="premium"
      title="Premium Plans"
      description="The plans shown on /premium, in this order."
      actions={<Button onClick={openNew}><Plus /> New plan</Button>}
    >
      <Note tone="brand" className="mb-4">
        Checkout is still simulated: no card is charged. These plans only control what /premium shows and which
        plan_id is recorded when a learner subscribes.
      </Note>

      <DataTable
        columns={columns}
        rows={plans}
        loading={loading}
        error={loadError}
        onRetry={load}
        onRowClick={openEdit}
        rowActions={rowActions}
        emptyState={
          <EmptyState
            icon={Crown}
            title="No plans yet"
            description="Create the first plan learners can choose on /premium."
            action={<Button size="sm" onClick={openNew}><Plus /> New plan</Button>}
          />
        }
      />

      <EditorSheet
        open={!!editor}
        onOpenChange={(open) => { if (!open) setEditor(null); }}
        size="md"
        title={editor?.id == null ? "New plan" : editor?.title || "Edit plan"}
        dirty={!!editor && isDirty(editor.initial, editor.fields)}
        saving={saving}
        onSave={save}
        saveLabel={editor?.id == null ? "Create plan" : "Save changes"}
        saveDisabled={!f?.title?.trim()}
        onDelete={editingPlan ? async () => { if (await removePlan(editingPlan)) setEditor(null); } : undefined}
      >
        {f && (
          <div className="space-y-4">
            <FieldRow>
              <Field label="Title" required>
                <Input value={f.title} onChange={(e) => setField({ title: e.target.value })} placeholder="e.g. Monthly" />
              </Field>
              <Field label="Subtitle">
                <Input value={f.subtitle} onChange={(e) => setField({ subtitle: e.target.value })} placeholder="e.g. Billed every month" />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Price">
                <Input type="number" min="0" value={f.price} onChange={(e) => setField({ price: e.target.value })} />
              </Field>
              <Field label="Currency">
                <Input value={f.currency} onChange={(e) => setField({ currency: e.target.value })} placeholder="AMD" />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Billing">
                <Select value={f.interval} onValueChange={(interval) => setField({ interval })}>
                  <SelectTrigger aria-label="Billing interval"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Badge" hint="Optional, e.g. Best value">
                <Input value={f.badge_label} onChange={(e) => setField({ badge_label: e.target.value })} />
              </Field>
            </FieldRow>
            <Field label="Perks" hint="Empty lines are dropped on save">
              <PerksEditor perks={f.perks} onChange={(perks) => setField({ perks })} />
            </Field>
          </div>
        )}
      </EditorSheet>
    </CmsLayout>
  );
}
