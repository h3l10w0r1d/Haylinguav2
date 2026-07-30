// src/AdventurePlayer.jsx
// Full-screen "Adventure": a walkable Kenney-tiled scene (Phaser, lazily
// imported so it stays a separate chunk) with React overlays on top — goal
// banner, an on-screen D-pad for touch, the NPC dialogue sheet, and a win
// screen. Movement/interaction flow through a mutable `controls` object the
// scene reads each frame; the scene calls back via `bridge`.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Volume2, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getAdventure, mergeAdventure, fetchAdventureOverrides } from './adventures/adventures';
import { buildAdventureGame } from './adventures/adventureGame';
import AdventureVoiceChat from './adventures/AdventureVoiceChat';
import { GlossaryText } from './exercises/WordHint';
import { WordBankStep, ListenStep, BlankStep, SpeakStep, MatchStep } from './adventures/AdventureExercises';
import { ttsFetch } from './exercises/tts';
import { newTrackedAudio } from './lib/audioRegistry';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';
const ORANGE = '#FF7A1A';

export default function AdventurePlayer() {
  const { adventureId } = useParams();
  const navigate = useNavigate();
  const base = useMemo(() => getAdventure(adventureId), [adventureId]);
  // `adventure` is the code base with any CMS language override merged in. Null
  // until the override fetch resolves, so the game boots once (no re-boot flash).
  const [adventure, setAdventure] = useState(null);

  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const controls = useRef({ dx: 0, dy: 0, interact: false, paused: false });

  const [ready, setReady] = useState(false);
  const [nearNpc, setNearNpc] = useState(null);
  const [dialog, setDialog] = useState(null);   // { npc, idx, wrongId }
  const [doneGoals, setDoneGoals] = useState(() => new Set());
  const [won, setWon] = useState(false);
  const [items, setItems] = useState([]);   // inventory: passport, ticket, boarding pass…
  const [xpAwarded, setXpAwarded] = useState(null);
  // Multi-location adventures: `scenes` is a list of locations you travel
  // between; a single-map adventure is treated as one scene. `active` is the
  // current location and drives the Phaser map/NPCs.
  const scenes = useMemo(() => (adventure ? (adventure.scenes || [adventure]) : []), [adventure]);
  const [sceneIdx, setSceneIdx] = useState(0);
  const active = scenes[sceneIdx] || null;
  const [transition, setTransition] = useState(null);   // { toLabel } between locations

  // ── Resolve CMS override, then merge over the code base ──────────────────────
  useEffect(() => {
    if (!base) return;
    let alive = true;
    setAdventure(null);
    setSceneIdx(0);
    setItems((base.startItems || []).map((i) => ({ ...i })));   // items you begin with
    fetchAdventureOverrides(API_BASE).then((all) => {
      if (alive) setAdventure(all[base.id] ? mergeAdventure(base, all[base.id]) : base);
    });
    return () => { alive = false; };
  }, [base]);

  // ── Boot Phaser (rebuilds when the active location changes) ─────────────────
  useEffect(() => {
    if (!active || !hostRef.current) return;
    let cancelled = false;
    let game;
    setReady(false);
    (async () => {
      const Phaser = (await import('phaser')).default;
      if (cancelled || !hostRef.current) return;
      game = buildAdventureGame(Phaser, {
        parent: hostRef.current,
        adventure: active,
        controls: controls.current,
        bridge: {
          onReady: () => setReady(true),
          onNear: (npc) => setNearNpc(npc),
          onInteract: (npc) => openDialog(npc),
        },
      });
      gameRef.current = game;
    })();
    return () => {
      cancelled = true;
      try { (game || gameRef.current)?.destroy(true); } catch { /* noop */ }
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ── Keyboard controls ───────────────────────────────────────────────────────
  useEffect(() => {
    const keys = new Set();
    const recompute = () => {
      const c = controls.current;
      c.dx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
      c.dy = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    };
    const down = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (k === ' ' || k === 'Enter') controls.current.interact = true;
      keys.add(k); recompute();
    };
    const up = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === ' ' || k === 'Enter') controls.current.interact = false;
      keys.delete(k); recompute();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── Objective beacon: point at the NPC for the next incomplete goal ──────────
  useEffect(() => {
    const g = gameRef.current;
    if (!ready || !active || !g) return;
    if (dialog || won || transition) { g.setWaypoint?.(null); return; }
    const npc = active.npcs.find((n) => n.completes && !doneGoals.has(n.completes)) || active.npcs.find((n) => !n.optional);
    g.setWaypoint?.(npc?.id || null);
  }, [ready, active, doneGoals, dialog, won, transition]);

  // ── Dialogue flow ────────────────────────────────────────────────────────────
  function openDialog(npc) {
    controls.current.paused = true;
    controls.current.interact = false;
    gameRef.current?.setWaypoint?.(null);
    gameRef.current?.focusNpc?.(npc.id);   // cinematic zoom to the NPC
    setDialog({ npc, idx: 0, wrongId: null });
    speak(npc.dialogue[0]);
  }

  function speak(step) {
    const text = step?.line || step?.options?.find((o) => o.correct)?.text;
    if (!step?.line) return;              // only auto-voice NPC lines
    // Pin Azure — its hy-AM voices handle Armenian far better than ElevenLabs.
    ttsFetch(API_BASE, { text: step.line, provider: 'azure' })
      .then((url) => newTrackedAudio(url).play())
      .catch(() => {});
  }

  function advance(npc, nextIdx) {
    if (nextIdx >= npc.dialogue.length) return finishDialog(npc);
    setDialog({ npc, idx: nextIdx, wrongId: null });
    speak(npc.dialogue[nextIdx]);
  }

  function finishDialog(npc) {
    controls.current.paused = false;
    gameRef.current?.unfocus?.();
    setDialog(null);
    gameRef.current?.markNpcDone?.(npc.id);
    if (!npc.completes) return;
    const next = new Set(doneGoals);
    next.add(npc.completes);
    setDoneGoals(next);
    // Is this location finished? (all its goal-NPCs done)
    const sceneDone = active.npcs.filter((n) => n.completes).every((n) => next.has(n.completes));
    if (!sceneDone) return;
    if (sceneIdx < scenes.length - 1) {
      // Travel to the next location.
      const nextScene = scenes[sceneIdx + 1];
      setTimeout(() => setTransition({ toLabel: nextScene.label || nextScene.title, n: sceneIdx + 2, total: scenes.length }), 350);
    } else {
      setTimeout(fireWin, 250);
    }
  }

  function goToNextScene() {
    setTransition(null);
    setNearNpc(null);
    setDialog(null);
    controls.current.paused = false;
    setSceneIdx((i) => i + 1);   // active changes → the boot effect rebuilds the map
  }

  function fireWin() {
    setWon(true);
    gameRef.current?.setWaypoint?.(null);
    confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 } });
    // Record completion + earn XP (first time only). Best-effort.
    const token = localStorage.getItem('hay_token') || localStorage.getItem('access_token') || '';
    fetch(`${API_BASE}/adventures/${base.id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setXpAwarded(d.awarded_xp); })
      .catch(() => {});
  }

  function closeDialog() {
    controls.current.paused = false;
    controls.current.interact = false;
    gameRef.current?.unfocus?.();
    setDialog(null);
  }

  if (!base) {
    return (
      <div style={fullCenter}>
        <p style={{ color: '#666' }}>Adventure not found.</p>
        <button style={primaryBtn} onClick={() => navigate('/adventures')}>Back to Adventures</button>
      </div>
    );
  }

  const step = dialog && active ? active.npcs.find((n) => n.id === dialog.npc.id)?.dialogue[dialog.idx] : null;
  const adv = adventure || base;   // banner renders from base until the merge resolves
  // Progress shown in the top bar: locations for a multi-scene trip, else goals.
  const progressItems = adventure?.scenes
    ? adventure.scenes.map((s) => ({ id: s.id, label: s.label || s.title, done: (s.npcs || []).filter((n) => n.completes).every((n) => doneGoals.has(n.completes)) }))
    : (adv.goals || []).map((g) => ({ id: g.id, label: g.label, done: doneGoals.has(g.id) }));
  const locationLabel = adventure?.scenes ? (active?.label || active?.title) : null;
  // A "pure line" (NPC just speaks) shows as an in-world speech bubble; anything
  // interactive (choose/give/receive/exercise) uses the bottom sheet.
  const isPureLine = !!step && step.line != null && !step.receive && !step.options
    && !step.give && !step.ai && !step.wordbank && !step.blank && !step.listen;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#18240f', zIndex: 40, display: 'flex', justifyContent: 'center' }}>
     <div style={{ position: 'relative', width: '100%', maxWidth: 520, height: '100%', overflow: 'hidden', background: '#4f6a2c', userSelect: 'none', touchAction: 'none' }}>
      {/* Phaser canvas host */}
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Loading */}
      {!ready && <div style={fullCenter}><div style={{ color: '#fff', fontSize: 16 }}>Loading adventure…</div></div>}

      {/* Top bar: back + goals */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'linear-gradient(#0007, #0000)' }}>
        <button onClick={() => navigate('/adventures')} style={iconBtn} aria-label="Back">
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
            {adv.emoji} {adv.title}{locationLabel ? <span style={{ fontWeight: 500, opacity: 0.85 }}> · 📍 {locationLabel}</span> : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {progressItems.map((it) => (
              <span key={it.id} style={{ fontSize: 11, color: '#fff', opacity: it.done ? 1 : 0.85, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 13, height: 13, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: it.done ? '#22c55e' : '#ffffff44', fontSize: 9 }}>{it.done ? '✓' : ''}</span>
                <span style={{ textDecoration: it.done ? 'line-through' : 'none' }}>{it.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Shopping-list / quest checklist — ticks off as you collect the items. */}
      {adv.checklist?.length > 0 && !won && !dialog && !transition && (
        <div style={{ position: 'absolute', top: 62, left: 12, background: '#fffdf9', border: '1px solid #ecdfce', borderRadius: 12, padding: '9px 11px', boxShadow: '0 3px 10px #0002', maxWidth: 190 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#7a6a58', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>🧾 Ցուցակ</div>
          {adv.checklist.map((c) => {
            const have = items.some((it) => it.id === c.id);
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: have ? '#22a06b' : '#8a7a68', marginBottom: 2 }}>
                <span style={{ width: 15, height: 15, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: have ? '#22c55e' : '#eee4d6', color: '#fff', fontSize: 10 }}>{have ? '✓' : ''}</span>
                <span style={{ textDecoration: have ? 'line-through' : 'none' }}>{c.icon} {c.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Inventory "bag" — what you're carrying (passport, boarding pass…) */}
      {items.length > 0 && !won && (
        <div style={{ position: 'absolute', top: 8, right: 10, display: 'flex', gap: 4, background: '#0007', padding: '5px 7px', borderRadius: 12 }}>
          {items.map((it) => (
            <div key={it.id} title={it.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 30 }}>
              <span style={{ fontSize: 19, lineHeight: 1 }}>{it.icon}</span>
            </div>
          ))}
        </div>
      )}

      {/* "Talk" prompt when near an NPC and not in dialogue */}
      {nearNpc && !dialog && !won && !transition && (
        <div style={{ position: 'absolute', left: '50%', bottom: 132, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1a1a1a', padding: '7px 13px', borderRadius: 20, boxShadow: '0 3px 10px #0004', fontWeight: 600, fontSize: 13 }}>
          <MessageCircle size={15} color={ORANGE} /> Talk to {nearNpc.name}
        </div>
      )}

      {/* On-screen controls (touch) */}
      {!dialog && !won && !transition && (
        <>
          <DPad controls={controls} />
          <button
            onPointerDown={() => { controls.current.interact = true; }}
            onPointerUp={() => { controls.current.interact = false; }}
            onPointerLeave={() => { controls.current.interact = false; }}
            style={talkBtn}
            aria-label="Talk"
          >
            <MessageCircle size={26} color="#fff" />
          </button>
        </>
      )}

      {/* Free spoken AI conversation with the NPC (scripted flow pauses here) */}
      {dialog && step?.ai && (
        <AdventureVoiceChat
          npc={dialog.npc}
          ai={step.ai}
          onComplete={() => advance(dialog.npc, dialog.idx + 1)}
          onClose={closeDialog}
        />
      )}

      {/* NPC speaking — an in-world-style speech bubble near the top, over the
          (camera-framed) character, with tappable Armenian words. */}
      {dialog && step && isPureLine && (
        <div style={{ position: 'absolute', top: 64, left: 12, right: 12, display: 'flex', justifyContent: 'center', zIndex: 6, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', position: 'relative', maxWidth: 380, background: '#fff', borderRadius: 18, padding: '13px 15px', boxShadow: '0 6px 20px #0005' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: ORANGE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>{dialog.npc.name[0]}</div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#1a1a1a' }}>{dialog.npc.name}</div>
              <button onClick={() => speak(step)} style={{ ...iconBtnLight, marginLeft: 'auto', padding: 4 }} aria-label="Play"><Volume2 size={15} color={ORANGE} /></button>
            </div>
            <div style={{ fontSize: 18, lineHeight: 1.5, color: '#1a1a1a' }}><GlossaryText text={step.line} /></div>
            {step.tr && <div style={{ fontSize: 12.5, color: '#aaa', marginTop: 4 }}>{step.tr}</div>}
            <button style={{ ...primaryBtn, width: '100%', marginTop: 12, padding: '9px 14px' }} onClick={() => advance(dialog.npc, dialog.idx + 1)}>Շարունակել</button>
            {/* little tail pointing down toward the character */}
            <div style={{ position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '10px solid #fff' }} />
          </div>
        </div>
      )}

      {/* Dialogue sheet (interactive steps) */}
      {dialog && step && !step.ai && !isPureLine && (
        <div style={sheetWrap}>
          <div style={sheet}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: ORANGE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                {dialog.npc.name[0]}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{dialog.npc.name}</div>
              <button onClick={closeDialog} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#999', fontSize: 20, cursor: 'pointer', lineHeight: 1 }} aria-label="Close">×</button>
            </div>

            {step.note ? (
              /* Cultural "did you know?" card. */
              <>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: ORANGE, textTransform: 'uppercase', marginBottom: 6 }}>{step.note.emoji || '🇦🇲'} Did you know?</div>
                {step.note.title && <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>{step.note.title}</div>}
                <div style={{ fontSize: 14.5, lineHeight: 1.55, color: '#444' }}>{step.note.body}</div>
                <button style={{ ...primaryBtn, width: '100%', marginTop: 16 }} onClick={() => advance(dialog.npc, dialog.idx + 1)}>Հասկացա</button>
              </>
            ) : step.speak ? (
              <SpeakStep step={step} onCorrect={() => advance(dialog.npc, dialog.idx + 1)} />
            ) : step.match ? (
              <MatchStep step={step} onCorrect={() => advance(dialog.npc, dialog.idx + 1)} />
            ) : step.wordbank ? (
              <WordBankStep step={step} onCorrect={() => advance(dialog.npc, dialog.idx + 1)} />
            ) : step.listen ? (
              <ListenStep step={step} onCorrect={() => advance(dialog.npc, dialog.idx + 1)} />
            ) : step.blank ? (
              <BlankStep step={step} onCorrect={() => advance(dialog.npc, dialog.idx + 1)} />
            ) : step.give ? (
              /* Present an item from your bag — the boarding-pass / passport hand-over. */
              <>
                <div style={{ fontSize: 15, color: '#1a1a1a', fontWeight: 600 }}>{step.give}</div>
                {step.tr && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{step.tr}</div>}
                <div style={{ fontSize: 11, color: '#999', margin: '10px 0 8px' }}>Tap the right item from your bag:</div>
                {items.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '9px 11px' }}>
                    Your bag is empty — you may need to get this somewhere first.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {items.map((it) => {
                      const isWrong = dialog.wrongId === it.id;
                      return (
                        <button
                          key={it.id}
                          onClick={() => {
                            if (it.id === step.itemId) advance(dialog.npc, dialog.idx + 1);
                            else setDialog((d) => ({ ...d, wrongId: it.id }));
                          }}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 78,
                            padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                            border: `2px solid ${isWrong ? '#ef4444' : '#e6ddd3'}`,
                            background: isWrong ? '#fff1f1' : '#fff',
                            animation: isWrong ? 'advShake 0.3s' : 'none',
                          }}
                        >
                          <span style={{ fontSize: 26 }}>{it.icon}</span>
                          <span style={{ fontSize: 12, color: '#1a1a1a' }}>{it.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : step.receive ? (
              /* An NPC hands you an item — adds it to your bag on "Take". */
              <>
                {step.line && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontSize: 18, lineHeight: 1.5, color: '#1a1a1a', flex: 1 }}><GlossaryText text={step.line} /></div>
                      <button onClick={() => speak(step)} style={iconBtnLight} aria-label="Play"><Volume2 size={18} color={ORANGE} /></button>
                    </div>
                    {step.tr && <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{step.tr}</div>}
                  </>
                )}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 12px' }}>
                  <span style={{ fontSize: 26 }}>{step.receive.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Added to your bag</div>
                    <div style={{ fontSize: 15, color: '#1a1a1a' }}>{step.receive.label}</div>
                  </div>
                </div>
                <button
                  style={{ ...primaryBtn, width: '100%', marginTop: 16 }}
                  onClick={() => {
                    setItems((prev) => (prev.some((p) => p.id === step.receive.id) ? prev : [...prev, { ...step.receive }]));
                    advance(dialog.npc, dialog.idx + 1);
                  }}
                >
                  Վերցնել
                </button>
              </>
            ) : step.line ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 18, lineHeight: 1.5, color: '#1a1a1a', flex: 1 }}><GlossaryText text={step.line} /></div>
                  <button onClick={() => speak(step)} style={iconBtnLight} aria-label="Play"><Volume2 size={18} color={ORANGE} /></button>
                </div>
                {step.tr && <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>{step.tr}</div>}
                <button style={{ ...primaryBtn, width: '100%', marginTop: 16 }} onClick={() => advance(dialog.npc, dialog.idx + 1)}>
                  Շարունակել
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#666', fontWeight: 600, marginBottom: 10 }}>{step.choose}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {step.options.map((o, i) => {
                    const id = `${dialog.idx}-${i}`;
                    const isWrong = dialog.wrongId === id;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          if (o.correct) advance(dialog.npc, dialog.idx + 1);
                          else setDialog((d) => ({ ...d, wrongId: id }));
                        }}
                        style={{
                          textAlign: 'left', padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                          border: `2px solid ${isWrong ? '#ef4444' : '#e6ddd3'}`,
                          background: isWrong ? '#fff1f1' : '#fff',
                          animation: isWrong ? 'advShake 0.3s' : 'none',
                        }}
                      >
                        <div style={{ fontSize: 16, color: '#1a1a1a' }}>{o.text}</div>
                        {o.tr && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{o.tr}</div>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Travelling between locations */}
      {transition && !won && (
        <div style={fullCenter}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '28px 26px', maxWidth: 340, textAlign: 'center', boxShadow: '0 12px 40px #0005' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🚕</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#22a06b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Location complete ✓</div>
            <h2 style={{ margin: '0 0 6px', fontSize: 19, color: '#1a1a1a' }}>Next stop {transition.n}/{transition.total}</h2>
            <p style={{ margin: '0 0 20px', color: '#777', fontSize: 15 }}>📍 {transition.toLabel}</p>
            <button style={{ ...primaryBtn, width: '100%' }} onClick={goToNextScene}>Գնա՛նք ({'Let’s go'})</button>
          </div>
        </div>
      )}

      {/* Win screen */}
      {won && (
        <div style={fullCenter}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '30px 26px', maxWidth: 340, textAlign: 'center', boxShadow: '0 12px 40px #0005' }}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: '#fff4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Trophy size={32} color={ORANGE} />
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#1a1a1a' }}>Adventure complete! 🎉</h2>
            <p style={{ margin: '0 0 16px', color: '#777', fontSize: 14 }}>Nicely done — all in Armenian.</p>
            {xpAwarded > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff7ed', color: '#b45309', border: '1px solid #fed7aa', borderRadius: 999, padding: '6px 14px', fontWeight: 800, fontSize: 15, marginBottom: 18 }}>
                +{xpAwarded} XP
              </div>
            )}
            <button style={{ ...primaryBtn, width: '100%', marginTop: xpAwarded > 0 ? 0 : 4 }} onClick={() => navigate('/adventures')}>Done</button>
          </div>
        </div>
      )}

      <style>{`@keyframes advShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}`}</style>
     </div>
    </div>
  );
}

// ── On-screen D-pad ────────────────────────────────────────────────────────────
function DPad({ controls }) {
  const set = (dx, dy) => () => { controls.current.dx = dx; controls.current.dy = dy; };
  const clear = () => { controls.current.dx = 0; controls.current.dy = 0; };
  const btn = (label, dx, dy, style) => (
    <button
      onPointerDown={set(dx, dy)}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      style={{ ...dpadBtn, ...style }}
      aria-label={label}
    >{label}</button>
  );
  return (
    <div style={{ position: 'absolute', left: 18, bottom: 22, width: 132, height: 132 }}>
      {btn('▲', 0, -1, { left: 46, top: 0 })}
      {btn('◀', -1, 0, { left: 0, top: 46 })}
      {btn('▶', 1, 0, { left: 92, top: 46 })}
      {btn('▼', 0, 1, { left: 46, top: 92 })}
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const primaryBtn = { background: ORANGE, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer' };
const iconBtn = { background: '#ffffff22', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex' };
const iconBtnLight = { background: '#fff4ec', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex', flexShrink: 0 };
const fullCenter = { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', background: '#0006', zIndex: 5 };
const dpadBtn = { position: 'absolute', width: 40, height: 40, borderRadius: 10, border: 'none', background: '#ffffffcc', color: '#333', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px #0003' };
const talkBtn = { position: 'absolute', right: 26, bottom: 46, width: 64, height: 64, borderRadius: '50%', border: 'none', background: ORANGE, boxShadow: '0 4px 12px #0004', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const sheetWrap = { position: 'absolute', inset: 0, background: '#0004', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 6 };
const sheet = { width: '100%', maxWidth: 460, background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px 18px 26px', boxShadow: '0 -6px 24px #0003' };
