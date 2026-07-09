// src/AIConversation.jsx
// Real-time AI conversation — VAD auto-detects speech, loops after Aram speaks.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, Loader2, Mic, Pencil, Send, Target, Trophy } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';

// VAD tuning
const VAD_THRESHOLD = 0.012;  // RMS amplitude to consider as speech
const SILENCE_MS    = 1700;   // silence after speech before auto-send
const MAX_RECORD_MS = 28000;  // hard cap on a single recording

// ─── helpers ────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('hay_token') || localStorage.getItem('access_token') || '';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── MessageBubble ───────────────────────────────────────────────────────────

function MessageBubble({ role, text, translation, corrections }) {
  const isAram = role === 'assistant';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isAram ? 'flex-start' : 'flex-end', gap: 4, marginBottom: 14 }}>
      <div style={{
        maxWidth: '82%', padding: '10px 14px',
        borderRadius: isAram ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
        background: isAram ? '#fff' : '#FF7A1A',
        color: isAram ? '#1a1a1a' : '#fff',
        fontSize: 15, lineHeight: 1.55,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        border: isAram ? '1px solid #f0e8e0' : 'none',
      }}>
        {text}
      </div>
      {isAram && translation && (
        <div style={{ maxWidth: '82%', fontSize: 12, color: '#aaa', paddingLeft: 4, lineHeight: 1.4 }}>
          {translation}
        </div>
      )}
      {isAram && corrections?.length > 0 && (
        <div style={{ maxWidth: '82%', fontSize: 12, color: '#b85c00', background: '#fff4ec', border: '1px solid #ffd9b5', borderRadius: 8, padding: '5px 10px', marginTop: 2, lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
          <Pencil size={11} style={{ marginTop: 1, flexShrink: 0 }} />
          {corrections.join(' ')}
        </div>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function AIConversation() {
  const navigate = useNavigate();
  const { scenarioId: paramScenarioId } = useParams();

  const [scenarios, setScenarios]         = useState([]);
  const [activeScenario, setActiveScenario] = useState(null);
  const [messages, setMessages]           = useState([]);
  // idle | listening | recording | processing
  const [status, setStatus]               = useState('idle');
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [textInput, setTextInput]         = useState('');
  const [error, setError]                 = useState('');
  const [sessionId]                       = useState(() => crypto.randomUUID());
  const [isComplete, setIsComplete]       = useState(false);
  const [scenarioChosen, setScenarioChosen] = useState(false);

  // Stable refs so callbacks never go stale
  const chatEndRef        = useRef(null);
  const audioRef          = useRef(null);
  const messagesRef       = useRef(messages);
  const statusRef         = useRef('idle');
  const isSpeakingRef     = useRef(false);
  const isCompleteRef     = useRef(false);

  // VAD / recording refs
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const audioCtxRef       = useRef(null);
  const analyserRef       = useRef(null);
  const mediaStreamRef    = useRef(null);
  const rafRef            = useRef(null);
  const speechDetectedRef = useRef(false);
  const silenceTimerRef   = useRef(null);
  const maxTimerRef       = useRef(null);

  // DOM refs for 60fps animations (no React re-renders)
  const vadBarsRef        = useRef(null);
  const speakingBarsRef   = useRef(null);

  // Forward-refs for circular-dependency-free callbacks
  const sendTurnRef       = useRef(null);
  const startListeningRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { messagesRef.current   = messages;   }, [messages]);
  useEffect(() => { statusRef.current     = status;     }, [status]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isCompleteRef.current = isComplete; }, [isComplete]);

  // Scroll chat to bottom on new message
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Load scenarios
  useEffect(() => {
    apiFetch('/conversation/scenarios')
      .then((d) => setScenarios(d.scenarios || []))
      .catch((e) => setError(e.message));
  }, []);

  // Resolve active scenario from URL param
  useEffect(() => {
    if (!scenarios.length) return;
    const sid = paramScenarioId || 'cafe';
    const found = scenarios.find((s) => s.id === sid) || scenarios[0];
    setActiveScenario(found);
    setScenarioChosen(Boolean(paramScenarioId));
  }, [scenarios, paramScenarioId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      _stopVAD();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Aram speaking bars animation (direct DOM, 60fps) ─────────────────────
  useEffect(() => {
    if (!isSpeaking) {
      // Reset bars to flat
      const bars = speakingBarsRef.current?.children;
      if (bars) for (const b of bars) { b.style.height = '4px'; b.style.background = '#ddd'; }
      return;
    }
    let running = true;
    const baseH = [0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6];
    let frame = 0;
    const tick = () => {
      frame++;
      const bars = speakingBarsRef.current?.children;
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          const t = (frame * 0.1 + i * 0.7) % (Math.PI * 2);
          const h = 4 + baseH[i] * 18 * (0.5 + 0.5 * Math.sin(t));
          bars[i].style.height = `${h}px`;
          bars[i].style.background = '#FF7A1A';
        }
      }
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, [isSpeaking]);

  // ── Internal VAD teardown (no state changes) ──────────────────────────────
  const _stopVAD = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(silenceTimerRef.current);
    clearTimeout(maxTimerRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    speechDetectedRef.current = false;
    // Reset VAD bars to flat
    const bars = vadBarsRef.current?.children;
    if (bars) for (const b of bars) { b.style.height = '4px'; b.style.background = '#ddd'; }
  }, []);

  // ── Play Aram's audio, then auto-start listening ──────────────────────────
  const playAudioAndListen = useCallback((url, complete = false) => {
    if (!url) {
      if (!complete) setTimeout(() => startListeningRef.current?.(), 300);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    setStatus('idle');
    setIsSpeaking(true);
    audio.play().catch(() => setIsSpeaking(false));
    const onDone = () => {
      setIsSpeaking(false);
      if (!complete && !isCompleteRef.current) {
        setTimeout(() => startListeningRef.current?.(), 250);
      }
    };
    audio.onended = onDone;
    audio.onerror = onDone;
  }, []);

  // ── Main turn handler ─────────────────────────────────────────────────────
  const sendTurn = useCallback(
    async ({ user_text = null, user_audio_b64 = null } = {}) => {
      if (!activeScenario) return;
      setStatus('processing');
      setError('');

      const apiMessages = messagesRef.current.map((m) => ({ role: m.role, content: m.text }));

      try {
        const data = await apiFetch('/conversation/turn', {
          method: 'POST',
          body: JSON.stringify({
            session_id: sessionId,
            character_id: 'aram',
            scenario_id: activeScenario.id,
            messages: apiMessages,
            user_text: user_text || undefined,
            user_audio_b64: user_audio_b64 || undefined,
            user_level: 'beginner',
            generate_video: false,
          }),
        });

        const userContent = data.user_transcription || user_text;
        if (userContent) {
          setMessages((prev) => [...prev, { role: 'user', text: userContent, translation: null, corrections: [] }]);
        }
        setMessages((prev) => [...prev, {
          role: 'assistant',
          text: data.assistant_text,
          translation: data.translation,
          corrections: data.corrections || [],
        }]);

        setIsComplete(data.is_complete);
        playAudioAndListen(data.audio_url, data.is_complete);
      } catch (e) {
        setError(e.message || 'Something went wrong. Please try again.');
        setStatus('idle');
      }
    },
    [activeScenario, sessionId, playAudioAndListen],
  );

  // Keep forward refs in sync
  useEffect(() => { sendTurnRef.current = sendTurn; }, [sendTurn]);

  // ── VAD listening ─────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (statusRef.current !== 'idle' || isSpeakingRef.current || isCompleteRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        _stopVAD();
        if (!speechDetectedRef.current || audioChunksRef.current.length === 0) {
          // No speech captured — restart listening after a short gap
          setStatus('idle');
          setTimeout(() => startListeningRef.current?.(), 500);
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 600) {
          setStatus('idle');
          setTimeout(() => startListeningRef.current?.(), 500);
          return;
        }
        const b64 = await blobToBase64(blob);
        sendTurnRef.current?.({ user_audio_b64: b64 });
      };

      recorder.start(200); // collect audio chunks every 200ms
      mediaRecorderRef.current = recorder;
      speechDetectedRef.current = false;
      setStatus('listening');

      // VAD monitoring loop
      const buf = new Float32Array(analyser.fftSize);
      const baseH = [0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6];
      let frameIdx = 0;

      const check = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);

        // Update VAD bars via direct DOM (no React re-render)
        frameIdx++;
        if (frameIdx % 2 === 0) {
          const bars = vadBarsRef.current?.children;
          if (bars) {
            const color = speechDetectedRef.current ? '#FF7A1A' : '#34C759';
            for (let i = 0; i < bars.length; i++) {
              const h = Math.max(3, Math.min(24, rms * 350 * baseH[i]));
              bars[i].style.height = `${h}px`;
              bars[i].style.background = color;
            }
          }
        }

        if (rms > VAD_THRESHOLD) {
          if (!speechDetectedRef.current) {
            speechDetectedRef.current = true;
            setStatus('recording');
          }
          // Reset silence timer on each voiced frame
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.stop();
              setStatus('processing');
            }
          }, SILENCE_MS);
        }

        rafRef.current = requestAnimationFrame(check);
      };

      rafRef.current = requestAnimationFrame(check);

      // Absolute max duration safety valve
      maxTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setStatus('processing');
        }
      }, MAX_RECORD_MS);

    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.');
      setStatus('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_stopVAD]);

  // Keep startListeningRef always current
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  // Kick off first turn once a scenario is chosen
  useEffect(() => {
    if (activeScenario && scenarioChosen && messages.length === 0) {
      sendTurn({ user_text: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario, scenarioChosen]);

  // ── Manual mic button: tap to toggle ─────────────────────────────────────
  const handleMicTap = () => {
    if (isSpeaking || status === 'processing') return;
    if (status === 'listening' || status === 'recording') {
      // Force-send what we have (or cancel if no speech)
      clearTimeout(silenceTimerRef.current);
      clearTimeout(maxTimerRef.current);
      cancelAnimationFrame(rafRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        if (speechDetectedRef.current) {
          mediaRecorderRef.current.stop();
          setStatus('processing');
        } else {
          mediaRecorderRef.current.stop(); // onstop will restart listening
        }
      }
    } else {
      startListening();
    }
  };

  // ── Text submit ───────────────────────────────────────────────────────────
  const handleTextSubmit = (e) => {
    e?.preventDefault();
    const text = textInput.trim();
    if (!text || status === 'processing' || status === 'recording') return;
    _stopVAD();
    setTextInput('');
    sendTurn({ user_text: text });
  };

  // ── Scenario picker gate ──────────────────────────────────────────────────
  if (!scenarioChosen && scenarios.length > 0) {
    return (
      <ScenarioPicker
        scenarios={scenarios}
        onPick={(s) => { setActiveScenario(s); setScenarioChosen(true); }}
        onBack={() => navigate(-1)}
      />
    );
  }

  const isProcessing = status === 'processing';
  const isListening  = status === 'listening';
  const isRecording  = status === 'recording';

  const micBg = isRecording ? '#FF4444' : isListening ? '#34C759' : '#FF7A1A';
  const statusLabel = isRecording ? 'I hear you…'
    : isProcessing ? 'Thinking…'
    : isSpeaking   ? 'Aram is speaking…'
    : isListening  ? 'Listening…'
    : '';

  return (
    <>
      <style>{`
        @keyframes thinking-spin { to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(1.3); opacity: 0;   }
          100% { transform: scale(1.3); opacity: 0;   }
        }
        @keyframes speaking-glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(255,122,26,0.15); }
          50%       { box-shadow: 0 4px 36px rgba(255,122,26,0.55); }
        }
        @keyframes listen-pulse {
          0%, 100% { box-shadow: 0 0 0 0   rgba(52,199,89,0.55); }
          50%       { box-shadow: 0 0 0 12px rgba(52,199,89,0);   }
        }
        @keyframes record-pulse {
          0%, 100% { box-shadow: 0 0 0 0   rgba(255,68,68,0.55); }
          50%       { box-shadow: 0 0 0 12px rgba(255,68,68,0);   }
        }
      `}</style>

      <div style={{ minHeight: '100dvh', background: '#fdf6f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#fdf6f0' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', borderBottom: '1px solid #f0e8e0', position: 'sticky', top: 0, zIndex: 10 }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, color: '#555', display: 'flex', alignItems: 'center' }} aria-label="Go back"><ArrowLeft size={20} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>{activeScenario?.icon} {activeScenario?.title_en || 'Conversation'}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{activeScenario?.title}</div>
            </div>
            {isComplete && <span style={{ fontSize: 12, background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Complete</span>}
          </div>

          {/* ── Aram portrait ── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20, paddingBottom: 12, background: '#fff', borderBottom: '1px solid #f0e8e0' }}>
            <div style={{
              width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', position: 'relative',
              background: '#f5ece4',
              animation: isSpeaking ? 'speaking-glow 0.8s ease-in-out infinite' : 'none',
              boxShadow: isSpeaking ? undefined : '0 4px 20px rgba(255,122,26,0.12)',
            }}>
              <img
                src="/characters/aram.png"
                alt="Aram"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isProcessing ? 0.6 : 1, transition: 'opacity 0.3s' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              {isProcessing && (
                <>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.4)' }}>
                    <div style={{ width: 28, height: 28, border: '3px solid #FF7A1A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'thinking-spin 0.8s linear infinite' }} />
                  </div>
                  <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #FF7A1A', animation: 'pulse-ring 1.2s ease-out infinite', pointerEvents: 'none' }} />
                </>
              )}
            </div>

            <div style={{ marginTop: 8, fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>Արամ</div>

            {/* Speaking bars (animated via rAF, not React) */}
            <div ref={speakingBarsRef} style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28, marginTop: 6, opacity: isSpeaking ? 1 : 0, transition: 'opacity 0.25s' }}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} style={{ width: 4, height: '4px', background: '#ddd', borderRadius: 2 }} />
              ))}
            </div>

            <div style={{ fontSize: 12, color: '#aaa', marginTop: 2, minHeight: 18 }}>{statusLabel}</div>
          </div>

          {/* ── Chat history ── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 && !isProcessing && (
              <div style={{ textAlign: 'center', color: '#bbb', fontSize: 14, marginTop: 40, lineHeight: 1.5 }}>
                {activeScenario
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Target size={13} /> Goal: {activeScenario.goal}</span>
                  : 'Starting conversation…'}
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} text={msg.text} translation={msg.translation} corrections={msg.corrections} />
            ))}
            {isProcessing && messages.length > 0 && (
              <div style={{ paddingLeft: 4, paddingBottom: 8 }}>
                <span style={{ color: '#ccc', fontSize: 13 }}>Aram is thinking…</span>
              </div>
            )}
            {error && (
              <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 10, padding: '10px 14px', color: '#c0392b', fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>
                {error}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ── Input area ── */}
          {!isComplete && (
            <div style={{ padding: '12px 16px 16px', background: '#fff', borderTop: '1px solid #f0e8e0' }}>

              {/* Mic + live amplitude bars row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <button
                  onClick={handleMicTap}
                  disabled={isProcessing || isSpeaking}
                  aria-label={isListening || isRecording ? 'Stop' : 'Start listening'}
                  style={{
                    width: 52, height: 52, borderRadius: '50%', border: 'none', flexShrink: 0,
                    background: micBg, color: '#fff', fontSize: 22,
                    cursor: isProcessing || isSpeaking ? 'not-allowed' : 'pointer',
                    opacity: isProcessing || isSpeaking ? 0.4 : 1,
                    animation: isRecording ? 'record-pulse 1s infinite' : isListening ? 'listen-pulse 1.8s infinite' : 'none',
                    transition: 'background 0.2s, opacity 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {isProcessing
                    ? <Loader2 size={22} style={{ animation: 'thinking-spin 0.8s linear infinite' }} />
                    : <Mic size={22} />}
                </button>

                {/* Live VAD amplitude (direct DOM, no React re-render) */}
                <div
                  ref={vadBarsRef}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3, height: 28, flex: 1,
                    opacity: (isListening || isRecording) ? 1 : 0,
                    transition: 'opacity 0.3s',
                  }}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} style={{ width: 5, height: '4px', background: '#34C759', borderRadius: 3, transition: 'background 0.1s' }} />
                  ))}
                </div>

                {!(isListening || isRecording) && (
                  <div style={{ flex: 1, fontSize: 12, color: '#bbb', textAlign: 'center' }}>
                    {isProcessing || isSpeaking ? '' : 'Listening starts automatically'}
                  </div>
                )}
              </div>

              {/* Text input fallback */}
              <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: 8 }}>
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Or type in Armenian…"
                  disabled={isProcessing || isRecording}
                  style={{ flex: 1, padding: '9px 14px', borderRadius: 24, border: '1.5px solid #f0e8e0', fontSize: 14, outline: 'none', background: isProcessing || isRecording ? '#f9f5f2' : '#fff', color: '#1a1a1a', transition: 'border-color 0.15s' }}
                  onFocus={(e) => (e.target.style.borderColor = '#FF7A1A')}
                  onBlur={(e)  => (e.target.style.borderColor = '#f0e8e0')}
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing || isRecording}
                  style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: textInput.trim() && !isProcessing ? '#FF7A1A' : '#f0e8e0', color: textInput.trim() && !isProcessing ? '#fff' : '#bbb', fontSize: 17, cursor: !textInput.trim() || isProcessing || isRecording ? 'not-allowed' : 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}
                  aria-label="Send"
                ><Send size={16} /></button>
              </form>
            </div>
          )}

          {/* ── Completion ── */}
          {isComplete && (
            <div style={{ padding: '20px 24px', background: '#fff', borderTop: '1px solid #f0e8e0', textAlign: 'center' }}>
              <div style={{ marginBottom: 8, color: '#FF7A1A' }}><Trophy size={44} /></div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a1a', marginBottom: 4 }}>Scenario complete!</div>
              <div style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>Great job practising Armenian.</div>
              <button onClick={() => navigate('/dashboard')} style={{ background: '#FF7A1A', color: '#fff', border: 'none', borderRadius: 24, padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Back to dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ─── Scenario picker ─────────────────────────────────────────────────────────

function ScenarioPicker({ scenarios, onPick, onBack }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', borderBottom: '1px solid #f0e8e0' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, color: '#555', display: 'flex', alignItems: 'center' }}><ArrowLeft size={20} /></button>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>Choose a Scenario</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px 20px', background: '#fff', borderBottom: '1px solid #f0e8e0' }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', background: '#f5ece4', marginBottom: 12, boxShadow: '0 4px 16px rgba(255,122,26,0.15)' }}>
            <img src="/characters/aram.png" alt="Aram" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a1a' }}>Meet Aram</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
            A friendly 25-year-old from Yerevan who will help you practise Armenian in real-life conversations.
          </div>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              style={{ background: '#fff', border: '1.5px solid #f0e8e0', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF7A1A'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(255,122,26,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f0e8e0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }}>{s.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#1a1a1a' }}>{s.title_en}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 3, fontStyle: 'italic' }}>Goal: {s.goal}</div>
              </div>
              <ChevronRight size={18} style={{ marginLeft: 'auto', color: '#ccc', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
