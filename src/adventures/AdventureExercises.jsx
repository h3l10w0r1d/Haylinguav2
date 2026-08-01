// src/adventures/AdventureExercises.jsx
// Inline exercise steps for adventures — the "exercise feeling" woven into the
// scene. Each is a self-contained dialogue-sheet body that calls onCorrect()
// to advance the scripted flow. Kinds:
//   wordbank { wordbank, answer:[...], tr }         — tap words to build a sentence
//   listen   { listen, options:[{text,correct}] }   — hear it, pick the match
//   blank    { blank, before, after, options:[...] } — fill the gap
// Grading is client-side (adventures are practice mode). Wrong → red shake.

import { useMemo, useRef, useState } from 'react';
import { Volume2, Mic, SkipForward, Check } from 'lucide-react';
import { ttsFetch } from '../exercises/tts';
import { newTrackedAudio } from '../lib/audioRegistry';
import { GlossaryText } from '../exercises/WordHint';

const ORANGE = '#FF7A1A';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';
const getToken = () => localStorage.getItem('hay_token') || localStorage.getItem('access_token') || '';

const chip = (extra) => ({
  padding: '9px 13px', borderRadius: 12, border: '2px solid #e6ddd3', background: '#fff',
  fontSize: 16, color: '#1a1a1a', cursor: 'pointer', ...extra,
});
const primaryBtn = { background: ORANGE, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontWeight: 700, fontSize: 15, cursor: 'pointer' };

function playAzure(text, voice = 'female') {
  if (!text) return;
  // Fixed voice (not the learner's saved preference) so exercise audio is
  // consistent — an NPC's line is never read back in the wrong voice.
  ttsFetch(API_BASE, { text, voice, provider: 'azure' }).then((u) => newTrackedAudio(u).play()).catch(() => {});
}

// Deterministic shuffle by index so it doesn't reshuffle every render.
function shuffled(arr, seed = 7) {
  const a = arr.map((v, i) => [v, i]);
  a.sort((x, y) => ((x[1] * 9301 + seed * 49297) % 233280) - ((y[1] * 9301 + seed * 49297) % 233280));
  return a.map(([v]) => v);
}

// ── Word bank: tap words in order to build the sentence ──────────────────────
export function WordBankStep({ step, onCorrect, onMistake }) {
  const answer = step.answer || [];
  const pool = useMemo(() => shuffled(answer.map((w, i) => ({ w, id: i })), answer.length), [step]);
  const [picked, setPicked] = useState([]);   // ids in chosen order
  const [wrong, setWrong] = useState(false);
  const usedIds = new Set(picked);

  const check = () => {
    const built = picked.map((id) => pool.find((p) => p.id === id).w);
    if (built.join(' ') === answer.join(' ')) onCorrect();
    else { setWrong(true); onMistake?.(); setTimeout(() => setWrong(false), 400); }
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
export function ListenStep({ step, onCorrect, onMistake }) {
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
            <button key={i} onClick={() => (o.correct ? onCorrect() : (setWrongId(i), onMistake?.()))}
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
export function BlankStep({ step, onCorrect, onMistake }) {
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
            <button key={i} onClick={() => (o.correct ? onCorrect() : (setWrongId(i), onMistake?.()))}
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

// ── Speaking: say the phrase, scored per-word via Azure Pronunciation Assessment ─
// The learner records; the backend returns an overall score plus per-word
// accuracy, so we can colour each word (green solid / amber close / red off) and
// show exactly which words to work on — real feedback a textbook can't give.
const PASS_SCORE = 70;   // overall pron score needed to advance

function wordStyle(w) {
  const acc = w.accuracy || 0;
  const omitted = w.error_type === 'Omission';
  let bg = '#dcfce7', fg = '#15803d', bd = '#86efac';           // good
  if (omitted || acc < 50) { bg = '#fee2e2'; fg = '#b91c1c'; bd = '#fca5a5'; }   // missed
  else if (acc < 80) { bg = '#fef3c7'; fg = '#b45309'; bd = '#fcd34d'; }         // close
  return {
    padding: '4px 9px', borderRadius: 9, fontSize: 17, background: bg, color: fg,
    border: `1.5px solid ${bd}`, textDecoration: omitted ? 'line-through' : 'none',
  };
}

function scoreVerdict(score) {
  if (score >= 90) return { label: 'Գերազանց! 🎉', color: '#15803d' };
  if (score >= PASS_SCORE) return { label: 'Լավ էր! 👍', color: '#16a34a' };
  if (score >= 45) return { label: 'Մոտ էիր — նորից', color: '#b45309' };
  return { label: 'Փորձի՛ր նորից', color: '#dc2626' };
}

export function SpeakStep({ step, onCorrect, onMistake }) {
  const [status, setStatus] = useState('idle');   // idle|recording|checking|result
  const [result, setResult] = useState(null);      // { recognized, pron_score, words, fallback }
  const recRef = useRef(null); const chunksRef = useRef([]); const streamRef = useRef(null); const maxT = useRef(null);
  const scoredWrong = useRef(false);   // count a mistake at most once per step
  const phrase = step.phrase || '';

  const stopTracks = () => { try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ } };

  const start = async () => {
    if (status === 'recording' || status === 'checking') { if (recRef.current?.state === 'recording') recRef.current.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        clearTimeout(maxT.current); stopTracks();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 600) { setStatus('idle'); return; }
        setStatus('checking');
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'speech.webm');
          fd.append('reference_text', phrase);
          const r = await fetch(`${API_BASE}/me/exercises/pronounce`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
          const d = r.ok ? await r.json() : null;
          if (!d) { setStatus('idle'); return; }
          setResult(d); setStatus('result');
          if ((d.pron_score || 0) >= PASS_SCORE) { setTimeout(onCorrect, 1400); }
          else if (!scoredWrong.current) { scoredWrong.current = true; onMistake?.(); }
        } catch { setStatus('idle'); }
      };
      rec.start(); recRef.current = rec; setResult(null); setStatus('recording');
      maxT.current = setTimeout(() => { if (recRef.current?.state === 'recording') recRef.current.stop(); }, 6000);
    } catch { setResult({ blocked: true }); setStatus('result'); }
  };

  const passed = status === 'result' && (result?.pron_score || 0) >= PASS_SCORE;
  const micColor = status === 'recording' ? '#ef4444' : passed ? '#22c55e' : ORANGE;
  const label = { idle: 'Tap the mic and say it', recording: 'Recording… tap to stop', checking: 'Scoring…', result: passed ? 'Nice! 🎉' : 'Tap to try again' }[status];
  const verdict = result && !result.blocked ? scoreVerdict(result.pron_score || 0) : null;

  return (
    <>
      <div style={{ fontSize: 13, color: '#666', fontWeight: 600, marginBottom: 8 }}>{step.speak || 'Say it out loud:'}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 20, lineHeight: 1.4, color: '#1a1a1a', flex: 1 }}><GlossaryText text={phrase} /></div>
        <button onClick={() => playAzure(phrase)} style={{ background: '#fff4ec', border: 'none', borderRadius: 10, padding: 6, cursor: 'pointer' }} aria-label="Play"><Volume2 size={18} color={ORANGE} /></button>
      </div>
      {step.tr && <div style={{ fontSize: 13, color: '#aaa', marginBottom: 10 }}>{step.tr}</div>}

      {/* Per-word feedback + score ring */}
      {verdict && (result.words?.length > 0) && (
        <div style={{ background: '#fbfaf8', border: '1px solid #eee4d6', borderRadius: 14, padding: '12px 13px', margin: '4px 0 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <ScoreRing score={result.pron_score || 0} color={verdict.color} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: verdict.color }}>{verdict.label}</div>
              <div style={{ fontSize: 11.5, color: '#999', marginTop: 2 }}>
                {result.fallback ? 'Word match' : 'Ճշտություն · Accuracy'}{!result.fallback && result.fluency ? ` · Սահունություն ${result.fluency}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {result.words.map((w, i) => (
              <span key={i} style={wordStyle(w)}>{w.word}</span>
            ))}
          </div>
          {result.recognized && <div style={{ fontSize: 12, color: '#999', marginTop: 9 }}>🗣️ <span style={{ fontStyle: 'italic' }}>{result.recognized}</span></div>}
        </div>
      )}
      {result?.blocked && <div style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 11px', margin: '4px 0 8px' }}>Microphone blocked — you can skip.</div>}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <button onClick={start} disabled={status === 'checking'} style={{ width: 64, height: 64, borderRadius: '50%', border: 'none', background: micColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px #0003' }} aria-label="Speak">
          {passed ? <Check size={26} color="#fff" /> : <Mic size={26} color="#fff" />}
        </button>
        <div style={{ fontSize: 12, color: (status === 'result' && !passed) ? '#b45309' : '#999' }}>{label}</div>
      </div>
      {!passed && (
        <button onClick={onCorrect} style={{ width: '100%', marginTop: 14, background: '#f3ede4', color: '#7a6a58', border: 'none', borderRadius: 12, padding: '10px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <SkipForward size={15} /> Skip
        </button>
      )}
    </>
  );
}

// Small circular score gauge (0-100).
function ScoreRing({ score, color }) {
  const r = 20, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="#eee4d6" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 26 26)" />
      <text x="26" y="30" textAnchor="middle" fontSize="15" fontWeight="800" fill={color}>{Math.round(score)}</text>
    </svg>
  );
}

// ── Match pairs: tap Armenian ↔ English until all are matched ─────────────────
export function MatchStep({ step, onCorrect, onMistake }) {
  const pairs = step.pairs || [];
  const left = useMemo(() => shuffled(pairs.map((p, i) => ({ t: p.a, i })), pairs.length), [step]);
  const right = useMemo(() => shuffled(pairs.map((p, i) => ({ t: p.b, i })), pairs.length + 3), [step]);
  const [selL, setSelL] = useState(null);
  const [selR, setSelR] = useState(null);
  const [matched, setMatched] = useState(() => new Set());
  const [bad, setBad] = useState(false);

  const resolve = (l, r) => {
    if (l == null || r == null) return;
    if (l === r) {
      const m = new Set(matched); m.add(l); setMatched(m); setSelL(null); setSelR(null);
      if (m.size === pairs.length) setTimeout(onCorrect, 400);
    } else {
      setBad(true); onMistake?.();
      setTimeout(() => { setBad(false); setSelL(null); setSelR(null); }, 450);
    }
  };

  const cellStyle = (sel, isMatched) => chip({
    width: '100%', textAlign: 'center', fontSize: 15,
    opacity: isMatched ? 0.25 : 1,
    borderColor: sel ? ORANGE : '#e6ddd3',
    background: sel ? '#fff7f0' : '#fff',
    animation: bad && sel ? 'advShake 0.3s' : 'none',
    cursor: isMatched ? 'default' : 'pointer',
  });

  return (
    <>
      <div style={{ fontSize: 13, color: '#666', fontWeight: 600, marginBottom: 10 }}>{step.match || 'Match the pairs.'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {left.map((it) => (
            <button key={`l${it.i}`} disabled={matched.has(it.i)} onClick={() => { setSelL(it.i); resolve(it.i, selR); }} style={cellStyle(selL === it.i, matched.has(it.i))}>{it.t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {right.map((it) => (
            <button key={`r${it.i}`} disabled={matched.has(it.i)} onClick={() => { setSelR(it.i); resolve(selL, it.i); }} style={cellStyle(selR === it.i, matched.has(it.i))}>{it.t}</button>
          ))}
        </div>
      </div>
    </>
  );
}
