// src/AdventuresHome.jsx
// The Adventures hub — a winding "journey" path of walk-through-a-scene quests.
// Each node is locked until the previous adventure is finished, shows the stars
// you earned, and can be replayed. Standalone, full-screen (its own header, no
// global nav). Cards route into /adventures/:id which mounts the Phaser scene.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Lock, RotateCcw, Check } from 'lucide-react';
import { ADVENTURES, mergeAdventure, fetchAdventureOverrides } from './adventures/adventures';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';
const ORANGE = '#FF7A1A';
const getToken = () => localStorage.getItem('hay_token') || localStorage.getItem('access_token') || '';

// Gentle left/right zig-zag so the path winds down the screen like a trail.
const OFFSETS = [0, 62, -62, 46, -46, 62, -62];

export default function AdventuresHome() {
  const navigate = useNavigate();
  const [list, setList] = useState(ADVENTURES);
  const [progress, setProgress] = useState({});   // { [id]: {done, best_stars, plays} }

  useEffect(() => {
    let alive = true;
    // CMS-overridden titles/blurbs (falls back to code defaults).
    fetchAdventureOverrides(API_BASE).then((all) => {
      if (alive) setList(ADVENTURES.map((a) => (all[a.id] ? mergeAdventure(a, all[a.id]) : a)));
    });
    // Per-user progress: which are done, stars earned, replays.
    const token = getToken();
    if (token) {
      fetch(`${API_BASE}/adventures/progress`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : {}))
        .then((p) => { if (alive) setProgress(p || {}); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  const doneCount = list.filter((a) => progress[a.id]?.done).length;

  return (
    <div style={{ minHeight: '100dvh', background: '#faf6f0' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '18px 16px 70px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button onClick={() => navigate('/dashboard')} style={{ background: '#fff', border: '1px solid #eadfd2', borderRadius: 10, padding: 7, cursor: 'pointer', display: 'flex' }} aria-label="Back">
            <ArrowLeft size={20} color="#7a6a58" />
          </button>
          <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a1a' }}>Adventures</h1>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: ORANGE, background: '#fff1e6', borderRadius: 999, padding: '4px 11px' }}>
            {doneCount}/{list.length} done
          </span>
        </div>
        <p style={{ color: '#8a7a68', fontSize: 14, margin: '0 0 22px 46px' }}>
          Step into a scene and use your Armenian to get things done.
        </p>

        {/* The winding path */}
        <div style={{ position: 'relative', maxWidth: 360, margin: '0 auto' }}>
          {/* dashed trail behind the nodes */}
          <div style={{ position: 'absolute', top: 40, bottom: 40, left: '50%', width: 0, borderLeft: '3px dashed #e6dccd', transform: 'translateX(-50%)', zIndex: 0 }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 26 }}>
            {list.map((a, i) => {
              const prog = progress[a.id];
              const done = !!prog?.done;
              const prevDone = i === 0 || progress[list[i - 1].id]?.done;
              const unlocked = i === 0 || prevDone;
              const dx = OFFSETS[i % OFFSETS.length];
              return (
                <PathNode
                  key={a.id}
                  adv={a}
                  dx={dx}
                  done={done}
                  unlocked={unlocked}
                  stars={prog?.best_stars || 0}
                  isNext={unlocked && !done}
                  onClick={() => unlocked && navigate(`/adventures/${a.id}`)}
                />
              );
            })}
          </div>
        </div>
      </div>
      <style>{`@keyframes advPulse{0%,100%{box-shadow:0 0 0 0 #ff7a1a55}70%{box-shadow:0 0 0 12px #ff7a1a00}}`}</style>
    </div>
  );
}

function PathNode({ adv, dx, done, unlocked, stars, isNext, onClick }) {
  const ring = done ? '#22c55e' : unlocked ? ORANGE : '#cfc3b2';
  const bg = done ? 'linear-gradient(135deg,#8fc24a,#5a9c3a)' : unlocked ? 'linear-gradient(135deg,#ffb066,#ff7a1a)' : '#e9e0d2';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateX(${dx}px)`, transition: 'transform .2s' }}>
      <button
        onClick={onClick}
        disabled={!unlocked}
        aria-label={adv.title}
        style={{
          position: 'relative', width: 86, height: 86, borderRadius: '50%', border: `4px solid ${ring}`,
          background: bg, cursor: unlocked ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38, boxShadow: unlocked ? '0 5px 14px #0002' : 'none',
          animation: isNext ? 'advPulse 2s infinite' : 'none',
        }}
      >
        <span style={{ filter: unlocked ? 'none' : 'grayscale(1)', opacity: unlocked ? 1 : 0.6 }}>{adv.emoji}</span>
        {done && (
          <span style={{ position: 'absolute', right: -4, bottom: -4, width: 26, height: 26, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={15} color="#fff" strokeWidth={3} />
          </span>
        )}
        {!unlocked && (
          <span style={{ position: 'absolute', right: -4, bottom: -4, width: 26, height: 26, borderRadius: '50%', background: '#b9ad9b', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={13} color="#fff" />
          </span>
        )}
      </button>

      {/* stars for finished adventures */}
      {done && (
        <div style={{ display: 'flex', gap: 2, marginTop: 7 }}>
          {[1, 2, 3].map((n) => (
            <span key={n} style={{ fontSize: 15, lineHeight: 1, opacity: n <= stars ? 1 : 0.28, filter: n <= stars ? 'none' : 'grayscale(1)' }}>⭐</span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 7, textAlign: 'center', maxWidth: 190 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: unlocked ? '#1a1a1a' : '#a99b87' }}>{adv.title}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: unlocked ? ORANGE : '#b3a48f', background: unlocked ? '#fff1e6' : '#efe7da', borderRadius: 6, padding: '2px 6px' }}>{adv.cefr}</span>
        </div>
        {unlocked && <div style={{ fontSize: 12.5, color: '#8a7a68', lineHeight: 1.4, marginTop: 3 }}>{adv.blurb}</div>}
        {/* call to action */}
        {unlocked && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: done ? '#22a06b' : ORANGE, fontWeight: 800, fontSize: 12.5, marginTop: 5 }}>
            {done ? <><RotateCcw size={13} /> Replay</> : <><Play size={13} /> Start</>}
          </div>
        )}
        {!unlocked && <div style={{ fontSize: 12, color: '#b3a48f', marginTop: 3 }}>Finish the previous adventure to unlock</div>}
      </div>
    </div>
  );
}
