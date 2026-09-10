// src/cms/CmsSegments.jsx — reusable audience definitions, referenced from
// automation campaign triggers/conditions via the "in_segment" operator
// (see FilterRuleBuilder.jsx + backend/automations.py). A "new segment"
// form + a list of existing ones, each inline-editable, with a live
// match-count preview. Client-paginated (not server) — this list also
// doubles as the full picker source for the "in segment" operator, so the
// frontend always needs every segment, same reasoning the rest of the CMS
// kit uses for small/slow-growing lists like team/achievements.
import { useEffect, useMemo, useState } from "react";
import { createCmsApi, getCmsClaim, getCmsToken } from "./api";
import { Plus, Save, Trash2, UsersRound } from "lucide-react";
import CmsLayout from "./CmsLayout";
import FilterRuleBuilder from "./FilterRuleBuilder";
import {
  Button, EmptyState, Field, FieldRow, Input, ListToolbar, Note, Pagination, SearchInput, SectionCard,
  notify, useClientList, useConfirm, useListQuery,
} from "./ui";

const NEW_SEGMENT_DEFAULT = { name: "", description: "", filters: { op: "and", rules: [] } };

export default function CmsSegments() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  const confirm = useConfirm();
  const canEdit = getCmsClaim("crm_role", "editor") !== "viewer";

  const [segments, setSegments] = useState([]);
  const [edits, setEdits] = useState({});
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(NEW_SEGMENT_DEFAULT);

  const list = useListQuery();
  const { pageRows, total } = useClientList(segments, { q: list.q, searchKeys: ["name", "description"], page: list.page, pageSize: list.pageSize });

  async function refresh() {
    const d = await api.listSegments();
    const rows = Array.isArray(d?.segments) ? d.segments : [];
    setSegments(rows);
    const e = {};
    rows.forEach((s) => {
      e[s.id] = { name: s.name || "", description: s.description || "", filters: s.filters };
    });
    setEdits(e);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        await refresh();
      } catch (err) {
        setLoadError(err?.message || err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function patch(id, p) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  async function createSegment() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await api.createSegment({ name: draft.name.trim(), description: draft.description.trim() || null, filters: draft.filters });
      setDraft(NEW_SEGMENT_DEFAULT);
      await refresh();
      notify("Segment created");
    } catch (err) {
      notify(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveSegment(s) {
    const e = edits[s.id] || {};
    setBusy(true);
    try {
      await api.updateSegment(s.id, { name: (e.name || "").trim(), description: (e.description || "").trim() || null, filters: e.filters });
      await refresh();
      notify("Saved");
    } catch (err) {
      notify(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeSegment(s) {
    const ok = await confirm({
      title: `Delete "${s.name}"?`,
      description: "Campaigns referencing it via \"in segment\" will stop matching on it.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.deleteSegment(s.id);
      await refresh();
      notify("Deleted");
    } catch (err) {
      notify(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function previewCount(id) {
    try {
      const d = await api.previewSegmentCount(id);
      setCounts((prev) => ({ ...prev, [id]: d }));
    } catch (err) {
      notify(err.message || "Preview failed", "err");
    }
  }

  return (
    <CmsLayout active="segments" title="Segments" description="Reusable audiences for Automations campaigns.">
      <div className="space-y-6">
        <Note tone="brand">
          Reference these from an automation's trigger filters or condition steps via "in segment"
          instead of retyping the same filter rules on every campaign.
        </Note>

        {!canEdit && (
          <Note tone="warning">You have view-only CRM access — ask an editor to create or change segments.</Note>
        )}

        {canEdit && (
          <SectionCard title="New segment">
            <FieldRow>
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Premium users" />
              </Field>
              <Field label="Description" hint="Optional">
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
            </FieldRow>
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">Filters</div>
              <FilterRuleBuilder group={draft.filters} onChange={(filters) => setDraft({ ...draft, filters })} segments={segments} />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={createSegment} disabled={busy || !draft.name.trim()}>
                <Plus className="h-4 w-4" /> Add segment
              </Button>
            </div>
          </SectionCard>
        )}

        <SectionCard title="Existing segments">
          <ListToolbar
            search={<SearchInput value={list.q} onChange={(q) => list.set({ q })} placeholder="Search segments…" />}
            count={total}
            countLabel="segment"
          />
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : loadError ? (
            <div className="p-6 text-sm font-semibold text-cardinal-600">{loadError}</div>
          ) : pageRows.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title={list.q ? "No segments match" : "No segments yet"}
              description={list.q ? "Try a different search." : "Create one above to get started."}
              action={list.q ? <Button variant="outline" size="sm" onClick={() => list.set({ q: "" })}>Clear search</Button> : null}
            />
          ) : (
            <div className="space-y-3">
              {pageRows.map((s) => {
                const e = edits[s.id] || {};
                const count = counts[s.id];
                return (
                  <div key={s.id} className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-feather-50 text-feather-600"><UsersRound className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <FieldRow>
                          <Input value={e.name || ""} onChange={(ev) => patch(s.id, { name: ev.target.value })} placeholder="Name" disabled={!canEdit} className="font-bold" />
                          <Input value={e.description || ""} onChange={(ev) => patch(s.id, { description: ev.target.value })} placeholder="Description" disabled={!canEdit} className="text-xs" />
                        </FieldRow>
                        <FilterRuleBuilder group={e.filters} onChange={(filters) => patch(s.id, { filters })} segments={segments} />
                        <div className="flex items-center gap-2 pt-0.5">
                          <Button type="button" variant="ghost" size="sm" onClick={() => previewCount(s.id)} className="h-auto p-0 text-xs font-bold text-brand-600 hover:underline">
                            Preview match count
                          </Button>
                          {count && <span className="text-xs font-semibold text-slate-400">{count.count} of {count.total_users} users match</span>}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex flex-col gap-2">
                          <Button size="sm" onClick={() => saveSegment(s)} disabled={busy}><Save className="h-3.5 w-3.5" /> Save</Button>
                          <Button size="sm" variant="outline" className="text-cardinal-600 hover:text-cardinal-700" onClick={() => removeSegment(s)} disabled={busy}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={list.page} pageSize={list.pageSize} total={total} onPageChange={(p) => list.set({ page: p })} onPageSizeChange={(pageSize) => list.set({ pageSize })} className="mt-4" />
        </SectionCard>
      </div>
    </CmsLayout>
  );
}
