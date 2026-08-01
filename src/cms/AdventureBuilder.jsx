// src/cms/AdventureBuilder.jsx
// The full no-code adventure builder — creates/edits a COMPLETE adventure
// definition (metadata, scene map, goals, NPCs with dialogue, items) that the
// learner app renders directly. Output shape matches the built-in code
// adventures so AdventurePlayer needs no special-casing.
import { useMemo, useState } from "react";
import { ArrowLeft, Save, Trash2, Plus, Play, AlertTriangle, ListChecks, User, Package } from "lucide-react";
import AdventureMapEditor from "./AdventureMapEditor";
import StepList from "./AdventureStepEditor";

const inp = "w-full rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";
const lbl = "text-[11px] font-bold uppercase tracking-wide text-slate-400";
const CEFR = ["A0", "A1", "A2", "B1", "B2"];

export function blankAdventure(id) {
  const W = 12, H = 10;
  const ground = Array.from({ length: H }, () => Array.from({ length: W }, () => 0));
  const decor = Array.from({ length: H }, () => Array.from({ length: W }, () => -1));
  return {
    id, title: "New Adventure", blurb: "", emoji: "🗺️", cefr: "A1",
    tileset: "town",
    map: { width: W, height: H, ground, decor },
    player: { frame: 98, tx: (W / 2) | 0, ty: H - 2 },
    goals: [{ id: "goal1", label: "First goal" }],
    npcs: [{ id: "npc1", name: "Անուն", frame: 88, tx: (W / 2) | 0, ty: 2, voice: "female", completes: "goal1", optional: false, dialogue: [{ line: "Բարև ձեզ։", tr: "Hello." }] }],
    startItems: [], checklist: [],
    custom: true,
  };
}

// Client-side validation. Returns { errors:[], warnings:[] }. Errors block
// publishing; warnings are advisory. Mirrors the game's expectations.
export function validateAdventure(a) {
  const errors = [], warnings = [];
  if (!/^[a-z0-9][a-z0-9_-]{1,47}$/.test(a.id || "")) errors.push("Id must be lowercase letters, digits, - or _ (2–48 chars).");
  if (!(a.title || "").trim()) errors.push("Give the adventure a title.");
  if (!(a.goals || []).length) errors.push("Add at least one goal.");
  const walkable = (x, y) => a.map.decor?.[y]?.[x] < 0;
  if (!walkable(a.player.tx, a.player.ty)) warnings.push("Player spawn sits on a solid prop — they may be stuck.");
  (a.goals || []).forEach((g) => {
    if (!(a.npcs || []).some((n) => n.completes === g.id)) warnings.push(`No character completes goal “${g.label || g.id}” — it can never be finished.`);
  });
  (a.npcs || []).forEach((n) => {
    if (!walkable(n.tx, n.ty)) warnings.push(`${n.name || n.id} stands on a solid prop.`);
    (n.dialogue || []).forEach((s, i) => {
      if (s.options && (s.choose != null || s.listen != null)) {
        const c = s.options.filter((o) => o.correct).length;
        if (c !== 1) errors.push(`${n.name || n.id} step ${i + 1}: mark exactly one correct option.`);
      }
      if (s.blank != null && s.options && s.options.filter((o) => o.correct).length !== 1) errors.push(`${n.name || n.id} step ${i + 1}: the blank needs one correct option.`);
    });
  });
  return { errors, warnings };
}

let uid = 0;
const nextId = (prefix, existing) => {
  let n = existing.length + 1;
  while (existing.includes(`${prefix}${n}`)) n++;
  uid++;
  return `${prefix}${n}`;
};

export default function AdventureBuilder({ initial, isNew, onSave, onDelete, onClose, busy }) {
  const [adv, setAdv] = useState(initial);
  const [published, setPublished] = useState(!!initial.__published);
  const set = (patch) => setAdv((a) => ({ ...a, ...patch }));

  const { errors, warnings } = useMemo(() => validateAdventure(adv), [adv]);

  // ── Map editor adapter (its value shape ↔ the adventure object) ──────────────
  const mapValue = {
    tileset: adv.tileset,
    map: adv.map,
    player: { tx: adv.player.tx, ty: adv.player.ty },
    npcs: Object.fromEntries(adv.npcs.map((n) => [n.id, { tx: n.tx, ty: n.ty, frame: n.frame, voice: n.voice }])),
  };
  const onMapChange = (v) => setAdv((a) => ({
    ...a,
    tileset: v.tileset,
    map: v.map,
    player: { ...a.player, tx: v.player.tx, ty: v.player.ty },
    npcs: a.npcs.map((n) => (v.npcs[n.id] ? { ...n, tx: v.npcs[n.id].tx, ty: v.npcs[n.id].ty, frame: v.npcs[n.id].frame, voice: v.npcs[n.id].voice } : n)),
  }));

  // ── Goals ────────────────────────────────────────────────────────────────────
  const addGoal = () => set({ goals: [...adv.goals, { id: nextId("goal", adv.goals.map((g) => g.id)), label: "" }] });
  const setGoal = (i, patch) => set({ goals: adv.goals.map((g, j) => (j === i ? { ...g, ...patch } : g)) });
  const delGoal = (i) => set({ goals: adv.goals.filter((_, j) => j !== i) });

  // ── NPCs ─────────────────────────────────────────────────────────────────────
  const addNpc = () => set({
    npcs: [...adv.npcs, { id: nextId("npc", adv.npcs.map((n) => n.id)), name: "Անուն", frame: 88, tx: 2, ty: 2, voice: "female", completes: adv.goals[0]?.id || "", optional: false, dialogue: [] }],
  });
  const setNpc = (i, patch) => set({ npcs: adv.npcs.map((n, j) => (j === i ? { ...n, ...patch } : n)) });
  const delNpc = (i) => set({ npcs: adv.npcs.filter((_, j) => j !== i) });

  // ── Items (startItems + checklist) ────────────────────────────────────────────
  const ItemRows = ({ field, title }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><Package className="h-4 w-4 text-brand-500" /> {title}</div>
      {(adv[field] || []).map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={inp + " !w-16 text-center"} value={it.icon ?? ""} onChange={(e) => set({ [field]: adv[field].map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)) })} placeholder="🎫" />
          <input className={inp} value={it.id ?? ""} onChange={(e) => set({ [field]: adv[field].map((x, j) => (j === i ? { ...x, id: e.target.value } : x)) })} placeholder="item id" />
          <input className={inp} value={it.label ?? ""} onChange={(e) => set({ [field]: adv[field].map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" />
          <button type="button" onClick={() => set({ [field]: adv[field].filter((_, j) => j !== i) })} className="text-slate-400 hover:text-cardinal-500"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => set({ [field]: [...(adv[field] || []), { id: "", label: "", icon: "🎁" }] })} className="text-xs font-bold text-brand-500"><Plus className="mr-1 inline h-3.5 w-3.5" />{title.replace(/s$/, "")}</button>
    </div>
  );

  const canPublish = errors.length === 0;

  return (
    <div className="space-y-4">
      {/* Sticky action bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white p-3 ring-1 ring-slate-200 shadow-sm">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Back</button>
        <div className="text-sm font-bold text-slate-800">{adv.emoji} {adv.title || "Untitled"} <span className="text-xs font-semibold text-slate-400">· {adv.id}</span></div>
        <label className="ml-auto flex items-center gap-1.5 text-xs font-bold text-slate-600">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} disabled={!canPublish} />
          Published {(!canPublish) && <span className="text-cardinal-500">(fix errors first)</span>}
        </label>
        {published && canPublish && (
          <a href={`/adventures/${adv.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-brand-600 ring-1 ring-brand-200 hover:bg-brand-50"><Play className="h-3.5 w-3.5" /> Play-test</a>
        )}
        {!isNew && <button type="button" onClick={() => onDelete(adv.id)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-cardinal-500 ring-1 ring-red-200 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
        <button type="button" disabled={busy} onClick={() => onSave({ ...adv, custom: true }, published && canPublish)} className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60"><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}</button>
      </div>

      {/* Validation */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-1 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
          {errors.map((e, i) => <div key={"e" + i} className="flex items-center gap-1.5 text-xs font-semibold text-cardinal-600"><AlertTriangle className="h-3.5 w-3.5" /> {e}</div>)}
          {warnings.map((w, i) => <div key={"w" + i} className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> {w}</div>)}
        </div>
      )}

      {/* Metadata */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><div className={lbl}>Emoji</div><input className={inp + " text-center"} value={adv.emoji} onChange={(e) => set({ emoji: e.target.value })} /></div>
          <div className="col-span-2"><div className={lbl}>Id {isNew ? "" : "(locked)"}</div><input className={inp} value={adv.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} /></div>
          <div><div className={lbl}>Level</div><select className={inp} value={adv.cefr} onChange={(e) => set({ cefr: e.target.value })}>{CEFR.map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div><div className={lbl}>Title</div><input className={inp} value={adv.title} onChange={(e) => set({ title: e.target.value })} /></div>
        <div><div className={lbl}>Blurb (card subtitle)</div><input className={inp} value={adv.blurb} onChange={(e) => set({ blurb: e.target.value })} /></div>
      </div>

      {/* Goals */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm space-y-2">
        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><ListChecks className="h-4 w-4 text-brand-500" /> Goals</div>
        {adv.goals.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{g.id}</span>
            <input className={inp} value={g.label} onChange={(e) => setGoal(i, { label: e.target.value })} placeholder="Goal label (shown to the learner)" />
            {adv.goals.length > 1 && <button type="button" onClick={() => delGoal(i)} className="text-slate-400 hover:text-cardinal-500"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
        <button type="button" onClick={addGoal} className="text-xs font-bold text-brand-500"><Plus className="mr-1 inline h-3.5 w-3.5" />Goal</button>
      </div>

      {/* Scene map */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm space-y-2">
        <div className="text-sm font-bold text-slate-700">Scene layout</div>
        <AdventureMapEditor npcs={adv.npcs} value={mapValue} onChange={onMapChange} />
      </div>

      {/* Characters + dialogue */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><User className="h-4 w-4 text-brand-500" /> Characters &amp; dialogue</div>
        {adv.npcs.map((npc, i) => (
          <div key={npc.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input className={inp + " !w-40"} value={npc.name} onChange={(e) => setNpc(i, { name: e.target.value })} placeholder="Name" />
              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500">completes
                <select className={inp + " !w-auto !py-1"} value={npc.completes || ""} onChange={(e) => setNpc(i, { completes: e.target.value })}>
                  <option value="">— none —</option>
                  {adv.goals.map((g) => <option key={g.id} value={g.id}>{g.label || g.id}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500"><input type="checkbox" checked={!!npc.optional} onChange={(e) => setNpc(i, { optional: e.target.checked })} /> optional</label>
              <span className="text-[10px] font-semibold text-slate-400">at ({npc.tx},{npc.ty}) · set position in the map above</span>
              {adv.npcs.length > 1 && <button type="button" onClick={() => delNpc(i)} className="ml-auto text-slate-400 hover:text-cardinal-500"><Trash2 className="h-4 w-4" /></button>}
            </div>
            <StepList steps={npc.dialogue || []} voice={npc.voice} onChange={(dialogue) => setNpc(i, { dialogue })} />
          </div>
        ))}
        <button type="button" onClick={addNpc} className="text-xs font-bold text-brand-500"><Plus className="mr-1 inline h-3.5 w-3.5" />Character</button>
      </div>

      {/* Items */}
      <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm grid gap-5 sm:grid-cols-2">
        <ItemRows field="startItems" title="Starting items" />
        <ItemRows field="checklist" title="Shopping checklist" />
      </div>
    </div>
  );
}
