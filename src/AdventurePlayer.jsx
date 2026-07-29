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
import { getAdventure } from './adventures/adventures';
import { buildAdventureGame } from './adventures/adventureGame';
import { ttsFetch } from './exercises/tts';
import { newTrackedAudio } from './lib/audioRegistry';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';
const ORANGE = '#FF7A1A';

export default function AdventurePlayer() {
  const { adventureId } = useParams();
  const navigate = useNavigate();
  const adventure = useMemo(() => getAdventure(adventureId), [adventureId]);

  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const controls = useRef({ dx: 0, dy: 0, interact: false, paused: false });

  const [ready, setReady] = useState(false);
  const [nearNpc, setNearNpc] = useState(null);
  const [dialog, setDialog] = useState(null);   // { npc, idx, wrongId }
  const [doneGoals, setDoneGoals] = useState(() => new Set());
  const [won, setWon] = useState(false);

  // ── Boot Phaser ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!adventure || !hostRef.current) return;
    let cancelled = false;
    let game;
    (async () => {
      const Phaser = (await import('phaser')).default;
      if (cancelled || !hostRef.current) return;
      game = buildAdventureGame(Phaser, {
        parent: hostRef.current,
        adventure,
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
  }, [adventure]);

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

  // ── Dialogue flow ────────────────────────────────────────────────────────────
  function openDialog(npc) {
    controls.current.paused = true;
    controls.current.interact = false;
    setDialog({ npc, idx: 0, wrongId: null });
    speak(npc.dialogue[0]);
  }

  function speak(step) {
    const text = step?.line || step?.options?.find((o) => o.correct)?.text;
    if (!step?.line) return;              // only auto-voice NPC lines
    ttsFetch(API_BASE, { text: step.line })
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
    setDialog(null);
    if (npc.completes) {
      gameRef.current?.markNpcDone?.(npc.id);
      setDoneGoals((prev) => {
        const next = new Set(prev);
        next.add(npc.completes);
        const allDone = adventure.goals.every((g) => next.has(g.id));
        if (allDone) setTimeout(fireWin, 250);
        return next;
      });
    } else {
      gameRef.current?.markNpcDone?.(npc.id);
    }
  }

  function fireWin() {
    setWon(true);
    confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 } });
  }

  function closeDialog() {
    controls.current.paused = false;
    controls.current.interact = false;
    setDialog(null);
  }

  if (!adventure) {
    return (
      <div style={fullCenter}>
        <p style={{ color: '#666' }}>Adventure not found.</p>
        <button style={primaryBtn} onClick={() => navigate('/adventures')}>Back to Adventures</button>
      </div>
    );
  }

  const step = dialog ? adventure.npcs.find((n) => n.id === dialog.npc.id)?.dialogue[dialog.idx] : null;

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
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{adventure.emoji} {adventure.title}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {adventure.goals.map((g) => (
              <span key={g.id} style={{ fontSize: 11, color: '#fff', opacity: doneGoals.has(g.id) ? 1 : 0.85, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 13, height: 13, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: doneGoals.has(g.id) ? '#22c55e' : '#ffffff44', fontSize: 9 }}>{doneGoals.has(g.id) ? '✓' : ''}</span>
                <span style={{ textDecoration: doneGoals.has(g.id) ? 'line-through' : 'none' }}>{g.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* "Talk" prompt when near an NPC and not in dialogue */}
      {nearNpc && !dialog && !won && (
        <div style={{ position: 'absolute', left: '50%', bottom: 132, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1a1a1a', padding: '7px 13px', borderRadius: 20, boxShadow: '0 3px 10px #0004', fontWeight: 600, fontSize: 13 }}>
          <MessageCircle size={15} color={ORANGE} /> Talk to {nearNpc.name}
        </div>
      )}

      {/* On-screen controls (touch) */}
      {!dialog && !won && (
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

      {/* Dialogue sheet */}
      {dialog && step && (
        <div style={sheetWrap}>
          <div style={sheet}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: ORANGE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                {dialog.npc.name[0]}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{dialog.npc.name}</div>
              <button onClick={closeDialog} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#999', fontSize: 20, cursor: 'pointer', lineHeight: 1 }} aria-label="Close">×</button>
            </div>

            {step.line ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 18, lineHeight: 1.5, color: '#1a1a1a', flex: 1 }}>{step.line}</div>
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

      {/* Win screen */}
      {won && (
        <div style={fullCenter}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '30px 26px', maxWidth: 340, textAlign: 'center', boxShadow: '0 12px 40px #0005' }}>
            <div style={{ width: 62, height: 62, borderRadius: '50%', background: '#fff4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Trophy size={32} color={ORANGE} />
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, color: '#1a1a1a' }}>Adventure complete! 🎉</h2>
            <p style={{ margin: '0 0 20px', color: '#777', fontSize: 14 }}>You ordered a coffee entirely in Armenian.</p>
            <button style={{ ...primaryBtn, width: '100%' }} onClick={() => navigate('/adventures')}>Done</button>
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
