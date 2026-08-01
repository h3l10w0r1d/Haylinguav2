// src/cms/CmsAdventures.jsx — edit the LANGUAGE content of Adventures.
// The scene map, NPC positions/sprites and grading live in the frontend code
// (src/adventures/adventures.js); here an editor can reword the title/blurb,
// goal labels, NPC names and every dialogue line/choice without a deploy. On
// save we store the full edited text as a per-adventure override blob; the app
// deep-merges it over the code defaults (structure + which option is correct
// always come from code). "Reset" drops the override back to the built-in text.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Save, RotateCcw, MessageCircle, Volume2, ListChecks, Check, Map as MapIcon, Pencil, ChevronDown } from "lucide-react";
import CmsLayout from "./CmsLayout";
import { ADVENTURES, mergeAdventure } from "../adventures/adventures";
import AdventureMapEditor from "./AdventureMapEditor";

const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";
const labelCls = "text-xs font-bold uppercase tracking-wide text-slate-400";

// Seed an editable draft from the code base + any saved override → effective text.
function seedDraft(base, override) {
  const m = mergeAdventure(base, override || {});
  return {
    title: m.title || "",
    blurb: m.blurb || "",
    goals: Object.fromEntries((m.goals || []).map((g) => [g.id, g.label || ""])),
    npcs: Object.fromEntries(
      (m.npcs || []).map((n) => [
        n.id,
        {
          name: n.name || "",
          steps: n.dialogue.map((s) =>
            s.give
              ? { kind: "give", label: s.give }                              // item hand-over — set in code
              : s.ai
                ? { kind: "ai", label: s.ai.goal || "AI voice conversation" } // free AI chat — set in code
                : (s.wordbank || s.listen || s.blank || s.speak || s.match || s.note)
                  ? { kind: "exercise", label: s.wordbank || s.listen || s.blank || s.speak || s.match || (s.note && (s.note.title || "Cultural note")) } // inline exercise / note — set in code
                  : s.line != null
                    ? { kind: "line", line: s.line, tr: s.tr || "" }         // incl. `receive` (has a line)
                    : { kind: "choose", choose: s.choose || "", options: (s.options || []).map((o) => ({ text: o.text, tr: o.tr || "" })) }
          ),
        },
      ])
    ),
  };
}

// Seed the map-painter draft (structural) from the effective (merged) scene.
// Multi-scene adventures have no top-level map, so they return null (painter
// hidden for those until multi-scene editing is wired).
function seedMapDraft(base, override) {
  if (base.scenes || !base.map) return null;
  const m = mergeAdventure(base, override || {});
  return {
    tileset: m.tileset || "town",
    map: {
      width: m.map.width,
      height: m.map.height,
      ground: m.map.ground.map((r) => r.slice()),
      decor: m.map.decor.map((r) => r.slice()),
    },
    player: { tx: m.player.tx, ty: m.player.ty },
    npcs: Object.fromEntries(
      m.npcs.map((n) => [n.id, { tx: n.tx, ty: n.ty, frame: n.frame, voice: n.voice || "female" }])
    ),
  };
}

// Turn a draft back into the override blob the backend/app expect.
function draftToOverride(draft) {
  return {
    title: draft.title,
    blurb: draft.blurb,
    goals: draft.goals,
    npcs: Object.fromEntries(
      Object.entries(draft.npcs).map(([id, n]) => [
        id,
        {
          name: n.name,
          dialogue: n.steps.map((s) =>
            s.kind === "give" || s.kind === "ai" || s.kind === "exercise"
              ? {}                                                        // placeholder — keeps indices aligned; merge ignores it
              : s.kind === "line"
                ? { line: s.line, tr: s.tr }
                : { choose: s.choose, options: s.options.map((o) => ({ text: o.text, tr: o.tr })) }
          ),
        },
      ])
    ),
  };
}

export default function CmsAdventures() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [drafts, setDrafts] = useState({});         // { [advId]: text draft }
  const [mapDrafts, setMapDrafts] = useState({});   // { [advId]: structural draft | null }
  const [rawOverrides, setRawOverrides] = useState({}); // server blobs (preserve unknown fields)
  const [openMap, setOpenMap] = useState("");       // advId whose scene editor is expanded
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");       // adventure id currently saving
  const [toast, setToast] = useState(null);

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    let overrides = {};
    try {
      const res = await api.listAdventureOverrides();
      overrides = res?.overrides || {};
    } catch {
      showToast("Showing built-in text — saved overrides couldn't be loaded", "err");
    }
    // Always seed the editor from the code defaults so it's usable even if the
    // overrides endpoint is unavailable.
    setRawOverrides(overrides);
    setDrafts(Object.fromEntries(ADVENTURES.map((a) => [a.id, seedDraft(a, overrides[a.id])])));
    setMapDrafts(Object.fromEntries(ADVENTURES.map((a) => [a.id, seedMapDraft(a, overrides[a.id])])));
  }

  useEffect(() => {
    (async () => { setLoading(true); await refresh(); setLoading(false); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  // Immutable draft updater: mutate a shallow clone of one adventure's draft.
  function edit(advId, fn) {
    setDrafts((prev) => {
      const next = { ...prev, [advId]: structuredClone(prev[advId]) };
      fn(next[advId]);
      return next;
    });
  }

  // Update one adventure's structural (map) draft.
  function editMap(advId, next) {
    setMapDrafts((prev) => ({ ...prev, [advId]: next }));
  }

  // Combine the text override + the structural (map) override into a single blob,
  // preserving any unknown fields already on the server. NPC entries are
  // deep-merged so text (name/dialogue) and layout (tx/ty/frame/voice) coexist.
  function buildFullOverride(advId) {
    const textOv = draftToOverride(drafts[advId]);
    const md = mapDrafts[advId];
    const ids = new Set([...Object.keys(textOv.npcs || {}), ...Object.keys(md?.npcs || {})]);
    const npcs = {};
    ids.forEach((id) => { npcs[id] = { ...(textOv.npcs?.[id] || {}), ...(md?.npcs?.[id] || {}) }; });
    const blob = { ...(rawOverrides[advId] || {}), ...textOv, npcs };
    if (md) { blob.tileset = md.tileset; blob.map = md.map; blob.player = md.player; }
    return blob;
  }

  async function save(advId) {
    setBusy(advId);
    try {
      await api.saveAdventureOverride(advId, buildFullOverride(advId));
      showToast("Saved — live for learners on next load");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy("");
    }
  }

  async function reset(advId) {
    if (!window.confirm("Reset this adventure's text back to the built-in defaults? Your CMS edits will be discarded.")) return;
    setBusy(advId);
    try {
      await api.resetAdventureOverride(advId);
      await refresh();
      showToast("Reset to built-in text");
    } catch (err) {
      showToast(err.message || "Reset failed", "err");
    } finally {
      setBusy("");
    }
  }

  return (
    <CmsLayout active="adventures" title="Adventures">
      <div className="space-y-4">
        <div className="rounded-3xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          Edit the words learners read and hear. The scene layout, characters and answer-grading are set in code — here you control the title, goals, character names and every line of dialogue.
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : (
          ADVENTURES.map((base) => {
            const d = drafts[base.id];
            if (!d) return null;
            return (
              <div key={base.id} className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm space-y-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-grass-50 text-grass-600 text-xl">{base.emoji}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-bold text-slate-900">{base.title}</div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-400"><MapIcon className="h-3.5 w-3.5" /> {base.scenes ? `${base.scenes.length} locations` : `${base.map.width}×${base.map.height} scene`} · id "{base.id}"</div>
                  </div>
                  <button type="button" onClick={() => reset(base.id)} disabled={busy === base.id} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <button type="button" onClick={() => save(base.id)} disabled={busy === base.id} className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60">
                    <Save className="h-4 w-4" /> {busy === base.id ? "Saving…" : "Save"}
                  </button>
                </div>

                {/* Title / blurb */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className={labelCls}>Title</div>
                    <input value={d.title} onChange={(e) => edit(base.id, (x) => { x.title = e.target.value; })} className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <div className={labelCls}>Blurb (shown on the card)</div>
                    <input value={d.blurb} onChange={(e) => edit(base.id, (x) => { x.blurb = e.target.value; })} className={inputCls} />
                  </div>
                </div>

                {/* Goals */}
                {(base.goals || []).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><ListChecks className="h-4 w-4 text-brand-500" /> Goals</div>
                    {base.goals.map((g) => (
                      <input key={g.id} value={d.goals[g.id] ?? ""} onChange={(e) => edit(base.id, (x) => { x.goals[g.id] = e.target.value; })} className={inputCls} placeholder={`Goal: ${g.id}`} />
                    ))}
                  </div>
                )}

                {/* Scene layout painter (single-scene adventures only) */}
                {!base.scenes && mapDrafts[base.id] && (
                  <div className="rounded-2xl ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={() => setOpenMap(openMap === base.id ? "" : base.id)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm font-bold text-slate-700"
                    >
                      <Pencil className="h-4 w-4 text-brand-500" /> Scene layout
                      <span className="text-xs font-semibold text-slate-400">{mapDrafts[base.id].map.width}×{mapDrafts[base.id].map.height} · {mapDrafts[base.id].tileset}</span>
                      <ChevronDown className={"ml-auto h-4 w-4 text-slate-400 transition " + (openMap === base.id ? "rotate-180" : "")} />
                    </button>
                    {openMap === base.id && (
                      <div className="border-t border-slate-100 p-4">
                        <AdventureMapEditor base={base} value={mapDrafts[base.id]} onChange={(next) => editMap(base.id, next)} />
                      </div>
                    )}
                  </div>
                )}
                {base.scenes && (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-400 ring-1 ring-slate-200">
                    <MapIcon className="mr-1 inline h-3.5 w-3.5" /> Multi-location adventure — visual layout &amp; dialogue editing for these is coming next.
                  </div>
                )}

                {/* NPCs + dialogue */}
                {(base.npcs || []).map((npc) => {
                  const nd = d.npcs[npc.id];
                  if (!nd) return null;
                  return (
                    <div key={npc.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">{(nd.name || "?")[0]}</div>
                        <div className="flex-1">
                          <div className={labelCls}>Character name</div>
                          <input value={nd.name} onChange={(e) => edit(base.id, (x) => { x.npcs[npc.id].name = e.target.value; })} className={inputCls + " !py-2 max-w-xs"} />
                        </div>
                        {npc.optional && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">optional</span>}
                      </div>

                      {nd.steps.map((s, i) => (
                        <div key={i} className="rounded-xl bg-white p-3 ring-1 ring-slate-200 space-y-2">
                          {s.kind === "give" ? (
                            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                              🎒 Learner hands over an item — <span className="text-slate-400">“{s.label}”</span> (set in code)
                            </div>
                          ) : s.kind === "ai" ? (
                            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                              🎤 Free AI voice conversation — <span className="text-slate-400">“{s.label}”</span> (set in code)
                            </div>
                          ) : s.kind === "exercise" ? (
                            <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                              🧩 Inline exercise — <span className="text-slate-400">“{s.label}”</span> (set in code)
                            </div>
                          ) : s.kind === "line" ? (
                            <>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><Volume2 className="h-3.5 w-3.5" /> {npc.name || "NPC"} says</div>
                              <input value={s.line} onChange={(e) => edit(base.id, (x) => { x.npcs[npc.id].steps[i].line = e.target.value; })} className={inputCls} placeholder="Armenian line" />
                              <input value={s.tr} onChange={(e) => edit(base.id, (x) => { x.npcs[npc.id].steps[i].tr = e.target.value; })} className={inputCls + " !bg-white !ring-1 text-slate-500"} placeholder="English translation" />
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400"><MessageCircle className="h-3.5 w-3.5" /> Learner chooses</div>
                              <input value={s.choose} onChange={(e) => edit(base.id, (x) => { x.npcs[npc.id].steps[i].choose = e.target.value; })} className={inputCls} placeholder="Prompt — e.g. How do you ask politely?" />
                              <div className="space-y-2 pl-1">
                                {s.options.map((o, j) => {
                                  const isCorrect = !!base.npcs.find((n) => n.id === npc.id)?.dialogue[i]?.options?.[j]?.correct;
                                  return (
                                    <div key={j} className={"rounded-xl p-2 ring-1 " + (isCorrect ? "bg-grass-50 ring-grass-200" : "bg-slate-50 ring-slate-200")}>
                                      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                        Option {j + 1}{isCorrect && <span className="inline-flex items-center gap-0.5 text-grass-600"><Check className="h-3 w-3" /> correct answer</span>}
                                      </div>
                                      <input value={o.text} onChange={(e) => edit(base.id, (x) => { x.npcs[npc.id].steps[i].options[j].text = e.target.value; })} className={inputCls + " !py-2 !bg-white"} placeholder="Armenian option" />
                                      <input value={o.tr} onChange={(e) => edit(base.id, (x) => { x.npcs[npc.id].steps[i].options[j].tr = e.target.value; })} className={inputCls + " !py-2 mt-1 !bg-white text-slate-500"} placeholder="English translation" />
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-400">Which option is correct is set in code — reword freely, keep option {(base.npcs.find((n) => n.id === npc.id)?.dialogue[i]?.options?.findIndex((o) => o.correct) ?? 0) + 1} the right answer.</div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {toast && (
        <div className={"fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-4 py-2.5 text-sm font-bold text-white shadow-lg " + (toast.kind === "err" ? "bg-cardinal-500" : "bg-grass-600")}>
          {toast.msg}
        </div>
      )}
    </CmsLayout>
  );
}
