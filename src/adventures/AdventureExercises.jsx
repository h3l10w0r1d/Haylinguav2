// src/adventures/AdventureExercises.jsx
// Inline exercise steps for adventures — the "exercise feeling" woven into the
// scene. Each is a self-contained dialogue-sheet body that calls onCorrect()
// to advance the scripted flow. Kinds:
//   wordbank { wordbank, answer:[...], tr }         — tap words to build a sentence
//   listen   { listen, options:[{text,correct}] }   — hear it, pick the match
//   blank    { blank, before, after, options:[...] } — fill the gap
// Grading is client-side (adventures are practice mode). Wrong → red shake.

import { useMemo, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { ttsFetch } from '../exercises/tts';
import { newTrackedAudio } from '../lib/audioRegistry';
import { GlossaryText } from '../exercises/WordHint';

const ORANGE = '#FF7A1A';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';

const chip = (extra) => ({
  padding: '9px 13px', borderRadius: 12, border: '2px solid #e6ddd3', background: '#fff',
  fontSize: 16, color: '#1a1a1a', cursor: 'pointer', ...extra,
});
const primaryBtn = { background: ORANGE, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer' };

function playAzure(text) {
  if (!text) return;
  ttsFetch(API_BASE, { text, provider: 'azure' }).then((u) => newTrackedAudio(u).play()).catch(() => {});
}

// Deterministic shuffle by index so it doesn't reshuffle every render.
function shuffled(arr, seed = 7) {
  const a = arr.map((v, i) => [v, i]);
  a.sort((x, y) => ((x[1] * 9301 + seed * 49297) % 233280) - ((y[1] * 9301 + seed * 49297) % 233280));
  return a.map(([v]) => v);
}

// ── Word bank: tap words in order to build the sentence ──────────────────────
export function WordBankStep({ step, onCorrect }) {
  const answer = step.answer || [];
  const pool = useMemo(() => shuffled(answer.map((w, i) => ({ w, id: i })), answer.length), [step]);
  const [picked, setPicked] = useState([]);   // ids in chosen order
  const [wrong, setWrong] = useState(false);
  const usedIds = new Set(picked);

  const check = () => {
    const built = picked.map((id) => pool.find((p) => p.id === id).w);
    if (built.join(' ') === answer.join(' ')) onCorrect();
    else { setWrong(true); setTimeout(() => setWrong(false), 400); }
  };

  return (
    <>
      <div style={{ fontSize: 13, color: '#666', fontWeight: 600, marginBottom: 10 }}>{step.wordbank}</div>
      {/* assembled line */}
      <div style={{ minHeight: 44, borderBottom: '2px dashed #e0d6c8', display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 8, marginBottom: 12, animation: wrong ? 'advShake 0.3s' : 'none' }}>
        {picked.map((id) => (
          <button key={id} onClick={() => setPicked((p) => p.filter((x) => x !== id))} style={chip({ background: '#fff7f0', borderColor: '#ffd9b5' })}>
            {pool.find((p) => p.id === id).w}
          </button>
        ))}
      </div>
      {/* word bank */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pool.map((p) => (
          <button key={p.id} disabled={usedIds.has(p.id)} onClick={() => setPicked((prev) => [...prev, p.id])}
            style={chip({ opacity: usedIds.has(p.id) ? 0.3 : 1, cursor: usedIds.has(p.id) ? 'default' : 'pointer' })}>
            {p.w}
          </button>
        ))}
      </div>
      <button style={{ ...primaryBtn, width: '100%', marginTop: 16, opacity: picked.length ? 1 : 0.5 }} disabled={!picked.length} onClick={check}>Ստուգել</button>
      {step.tr && <div style={{ fontSize: 12, color: '#bbb', marginTop: 8, textAlign: 'center' }}>{step.tr}</div>}
    </>
  );
}

// ── Listen & pick: hear the Armenian, choose the match ───────────────────────
export function ListenStep({ step, onCorrect }) {
  const [wrongId, setWrongId] = useState(null);
  const audioText = step.audioText || step.options?.find((o) => o.correct)?.text;
  // auto-play once on mount
  const played = useRef(false);
  if (!played.current) { played.current = true; setTimeout(() => playAzure(audioText), 250); }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={() => playAzure(audioText)} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Play">
          <Volume2 size={24} color="#fff" />
        </button>
        <div style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>{step.listen || 'Listen and choose what you heard.'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {step.options.map((o, i) => {
          const isWrong = wrongId === i;
          return (
            <button key={i} onClick={() => (o.correct ? onCorrect() : setWrongId(i))}
              style={chip({ textAlign: 'left', borderColor: isWrong ? '#ef4444' : '#e6ddd3', background: isWrong ? '#fff1f1' : '#fff', animation: isWrong ? 'advShake 0.3s' : 'none' })}>
              {o.text}{o.tr && <span style={{ fontSize: 12, color: '#aaa', marginLeft: 6 }}>{o.tr}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Fill the blank: pick the word for the gap ────────────────────────────────
export function BlankStep({ step, onCorrect }) {
  const [wrongId, setWrongId] = useState(null);
  return (
    <>
      <div style={{ fontSize: 13, color: '#666', fontWeight: 600, marginBottom: 10 }}>{step.blank || 'Fill in the blank.'}</div>
      <div style={{ fontSize: 18, lineHeight: 1.6, color: '#1a1a1a', marginBottom: 14 }}>
        <GlossaryText text={step.before} />{' '}
        <span style={{ display: 'inline-block', minWidth: 54, borderBottom: '2px solid #FF7A1A', textAlign: 'center', color: '#bbb' }}>?</span>{' '}
        <GlossaryText text={step.after} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {step.options.map((o, i) => {
          const isWrong = wrongId === i;
          return (
            <button key={i} onClick={() => (o.correct ? onCorrect() : setWrongId(i))}
              style={chip({ borderColor: isWrong ? '#ef4444' : '#e6ddd3', background: isWrong ? '#fff1f1' : '#fff', animation: isWrong ? 'advShake 0.3s' : 'none' })}>
              {o.text}
            </button>
          );
        })}
      </div>
      {step.tr && <div style={{ fontSize: 12, color: '#bbb', marginTop: 10 }}>{step.tr}</div>}
    </>
  );
}
