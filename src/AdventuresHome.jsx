// src/AdventuresHome.jsx
// The Adventures hub — a grid of walk-through-a-scene quests. Standalone,
// full-screen (its own header, no global nav), mirroring the AI Conversation
// entry point. Cards route into /adventures/:id which mounts the Phaser scene.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { ADVENTURES, mergeAdventure, fetchAdventureOverrides } from './adventures/adventures';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';
const ORANGE = '#FF7A1A';

export default function AdventuresHome() {
  const navigate = useNavigate();
  // Show CMS-overridden titles/blurbs in the list; fall back to code defaults.
  const [list, setList] = useState(ADVENTURES);
  useEffect(() => {
    let alive = true;
    fetchAdventureOverrides(API_BASE).then((all) => {
      if (alive) setList(ADVENTURES.map((a) => (all[a.id] ? mergeAdventure(a, all[a.id]) : a)));
    });
    return () => { alive = false; };
  }, []);
  return (
    <div style={{ minHeight: '100dvh', background: '#faf6f0' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '18px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button onClick={() => navigate(-1)} style={{ background: '#fff', border: '1px solid #eadfd2', borderRadius: 10, padding: 7, cursor: 'pointer', display: 'flex' }} aria-label="Back">
            <ArrowLeft size={20} color="#7a6a58" />
          </button>
          <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a1a' }}>Adventures</h1>
        </div>
        <p style={{ color: '#8a7a68', fontSize: 14, margin: '0 0 20px 46px' }}>
          Step into a scene and use your Armenian to get things done.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/adventures/${a.id}`)}
              style={{
                textAlign: 'left', cursor: 'pointer', border: '1px solid #eadfd2', background: '#fff',
                borderRadius: 18, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 2px 8px #0000000a',
              }}
            >
              <div style={{ height: 96, background: 'linear-gradient(135deg,#8fc24a,#5a9c3a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46 }}>
                {a.emoji}
              </div>
              <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{a.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ORANGE, background: '#fff1e6', borderRadius: 6, padding: '2px 6px' }}>{a.cefr}</span>
                </div>
                <div style={{ fontSize: 13, color: '#8a7a68', lineHeight: 1.45, flex: 1 }}>{a.blurb}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: ORANGE, fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                  <Play size={14} /> Start
                </div>
              </div>
            </button>
          ))}

        </div>
      </div>
    </div>
  );
}
