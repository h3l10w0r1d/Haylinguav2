// src/adventures/AdventureVoiceChat.jsx
// A compact spoken conversation with an adventure NPC. The learner talks (mic +
// VAD), we POST each turn to /conversation/turn with the NPC's persona/goal/voice
// so Claude plays that character, and the reply is spoken back via Azure hy-AM.
// When the AI marks the goal complete (is_complete) we call onComplete and the
// scripted adventure flow resumes. A "Skip" button guarantees the learner is
// never stuck if the mic is unavailable. Mirrors AIConversation.jsx's proven
// VAD loop, kept self-contained so the live conversation screen stays untouched.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { newTrackedAudio } from '../lib/audioRegistry';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';
const ORANGE = '#FF7A1A';
const VAD_THRESHOLD = 0.012;
const SILENCE_MS = 1700;
const MAX_RECORD_MS = 28000;

function getToken() {
  return localStorage.getItem('hay_token') || localStorage.getItem('access_token') || '';
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export default function AdventureVoiceChat({ npc, ai, onComplete, onClose }) {
  const [status, setStatus] = useState('idle');        // idle|listening|recording|processing
  const [npcLine, setNpcLine] = useState(null);        // { text, translation }
  const [youSaid, setYouSaid] = useState('');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const sessionId = useRef(`adv-${npc.id}-${Math.floor(performance.now())}`).current;
  const messagesRef = useRef([]);        // [{role, content}]
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const silenceT = useRef(null);
  const maxT = useRef(null);
  const rafRef = useRef(null);
  const speechRef = useRef(false);
  const vadBars = useRef(null);
  const statusRef = useRef('idle');
  const speakingRef = useRef(false);
  const doneRef = useRef(false);
  const mutedRef = useRef(false);
  const sendRef = useRef(null);
  const listenRef = useRef(null);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const stopVAD = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(silenceT.current);
    clearTimeout(maxT.current);
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { ctxRef.current?.close(); } catch { /* noop */ }
    streamRef.current = null; ctxRef.current = null;
  }, []);

  const finish = useCallback(() => {
    doneRef.current = true;
    stopVAD();
    audioRef.current?.pause();
    onComplete?.();
  }, [stopVAD, onComplete]);

  const playThenListen = useCallback((url, complete) => {
    setStatus('idle');
    if (!url || mutedRef.current) {
      if (complete) return finish();
      setTimeout(() => listenRef.current?.(), 300);
      return;
    }
    audioRef.current?.pause();
    const audio = newTrackedAudio(url);
    audioRef.current = audio;
    setSpeaking(true);
    audio.play().catch(() => setSpeaking(false));
    const onDone = () => {
      setSpeaking(false);
      if (complete) finish();
      else if (!doneRef.current) setTimeout(() => listenRef.current?.(), 250);
    };
    audio.onended = onDone;
    audio.onerror = onDone;
  }, [finish]);

  const sendTurn = useCallback(async ({ user_audio_b64 = null, user_text = null } = {}) => {
    setStatus('processing');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/conversation/turn`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          scenario_id: 'cafe',
          messages: messagesRef.current,
          user_text: user_text || undefined,
          user_audio_b64: user_audio_b64 || undefined,
          user_level: 'beginner',
          generate_video: false,
          persona_name: npc.name,
          persona_desc: ai.personaDesc,
          goal: ai.goal,
          voice: ai.voice || 'male',
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const said = data.user_transcription || user_text;
      if (said) { setYouSaid(said); messagesRef.current.push({ role: 'user', content: said }); }
      if (data.assistant_text) {
        messagesRef.current.push({ role: 'assistant', content: data.assistant_text });
        setNpcLine({ text: data.assistant_text, translation: data.translation });
      }
      playThenListen(data.audio_url, data.is_complete);
    } catch (e) {
      setError('Conversation unavailable — you can skip to continue.');
      setStatus('idle');
    }
  }, [sessionId, npc.name, ai, playThenListen]);
  useEffect(() => { sendRef.current = sendTurn; }, [sendTurn]);

  const startListening = useCallback(async () => {
    if (statusRef.current !== 'idle' || speakingRef.current || doneRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopVAD();
        if (!speechRef.current || chunksRef.current.length === 0) {
          setStatus('idle'); setTimeout(() => listenRef.current?.(), 500); return;
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 600) { setStatus('idle'); setTimeout(() => listenRef.current?.(), 500); return; }
        sendRef.current?.({ user_audio_b64: await blobToBase64(blob) });
      };
      rec.start(200);
      recRef.current = rec;
      speechRef.current = false;
      setStatus('listening');

      const buf = new Float32Array(analyser.fftSize);
      const baseH = [0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6];
      let frame = 0;
      const check = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        if (++frame % 2 === 0) {
          const bars = vadBars.current?.children;
          if (bars) {
            const color = speechRef.current ? ORANGE : '#34C759';
            for (let i = 0; i < bars.length; i++) {
              bars[i].style.height = `${Math.max(3, Math.min(24, rms * 350 * baseH[i]))}px`;
              bars[i].style.background = color;
            }
          }
        }
        if (rms > VAD_THRESHOLD) {
          if (!speechRef.current) { speechRef.current = true; setStatus('recording'); }
          clearTimeout(silenceT.current);
          silenceT.current = setTimeout(() => {
            if (recRef.current?.state === 'recording') { recRef.current.stop(); setStatus('processing'); }
          }, SILENCE_MS);
        }
        rafRef.current = requestAnimationFrame(check);
      };
      rafRef.current = requestAnimationFrame(check);
      maxT.current = setTimeout(() => {
        if (recRef.current?.state === 'recording') { recRef.current.stop(); setStatus('processing'); }
      }, MAX_RECORD_MS);
    } catch {
      setError('Microphone blocked — allow mic access, or skip to continue.');
      setStatus('idle');
    }
  }, [stopVAD]);
  useEffect(() => { listenRef.current = startListening; }, [startListening]);

  // Open the conversation (NPC speaks first).
  useEffect(() => {
    sendTurn({ user_text: '' });
    return () => { doneRef.current = true; stopVAD(); audioRef.current?.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const micTap = () => {
    if (speaking || status === 'processing') return;
    if (status === 'listening' || status === 'recording') {
      if (recRef.current?.state === 'recording') recRef.current.stop();
    } else if (status === 'idle') {
      startListening();
    }
  };

  const label = { idle: 'Tap the mic to speak', listening: 'Listening…', recording: 'Keep talking…', processing: 'Thinking…' }[status];

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0007', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 7 }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: '20px 20px 0 0', padding: '16px 18px 24px', boxShadow: '0 -6px 24px #0003' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: ORANGE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{npc.name[0]}</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{npc.name}</div>
          <span style={{ fontSize: 11, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>Live chat</span>
          <button onClick={() => setMuted((m) => !m)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#999' }} aria-label="Mute">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', fontSize: 20, cursor: 'pointer', lineHeight: 1 }} aria-label="Close">×</button>
        </div>

        {npcLine ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, lineHeight: 1.5, color: '#1a1a1a' }}>{npcLine.text}</div>
            {npcLine.translation && <div style={{ fontSize: 13, color: '#aaa', marginTop: 3 }}>{npcLine.translation}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: '#999', marginBottom: 12 }}>Connecting…</div>
        )}

        {youSaid && <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>🗣️ <span style={{ fontStyle: 'italic' }}>{youSaid}</span></div>}
        {error && <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>{error}</div>}

        {/* Mic + VAD bars */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div ref={vadBars} style={{ display: 'flex', alignItems: 'center', gap: 3, height: 26 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} style={{ width: 4, height: 3, borderRadius: 2, background: '#34C759' }} />)}
          </div>
          <button
            onClick={micTap}
            style={{ width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer', background: status === 'recording' ? '#ef4444' : ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px #0003', opacity: speaking || status === 'processing' ? 0.6 : 1 }}
            aria-label="Speak"
          >
            <Mic size={26} color="#fff" />
          </button>
          <div style={{ fontSize: 12, color: '#999' }}>{speaking ? `${npc.name} is speaking…` : label}</div>
        </div>

        <button onClick={finish} style={{ width: '100%', marginTop: 16, background: '#f3ede4', color: '#7a6a58', border: 'none', borderRadius: 12, padding: '11px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <SkipForward size={15} /> Skip / I'm done
        </button>
      </div>
    </div>
  );
}
