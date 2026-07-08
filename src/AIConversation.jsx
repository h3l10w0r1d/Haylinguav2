// src/AIConversation.jsx
// AI Conversation screen — chat with Aram, an AI Armenian tutor.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';

// ─── helpers ────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('hay_token') || localStorage.getItem('access_token') || '';
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders(), ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── SoundWave animation ────────────────────────────────────────────────────

function SoundWave({ active }) {
  const bars = [0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        height: 28,
        marginTop: 8,
        opacity: active ? 1 : 0,
        transition: 'opacity 0.3s',
      }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: active ? `${h * 24}px` : '4px',
            background: '#FF7A1A',
            borderRadius: 2,
            transition: active ? 'none' : 'height 0.4s',
            animation: active ? `wave-bar-${i % 3} ${0.5 + i * 0.07}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ─── MessageBubble ───────────────────────────────────────────────────────────

function MessageBubble({ role, text, translation, corrections }) {
  const isAram = role === 'assistant';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isAram ? 'flex-start' : 'flex-end',
        gap: 4,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          maxWidth: '82%',
          padding: '10px 14px',
          borderRadius: isAram ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
          background: isAram ? '#fff' : '#FF7A1A',
          color: isAram ? '#1a1a1a' : '#fff',
          fontSize: 15,
          lineHeight: 1.55,
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          border: isAram ? '1px solid #f0e8e0' : 'none',
        }}
      >
        {text}
      </div>
      {isAram && translation && (
        <div style={{ maxWidth: '82%', fontSize: 12, color: '#aaa', paddingLeft: 4, lineHeight: 1.4 }}>
          {translation}
        </div>
      )}
      {isAram && corrections?.length > 0 && (
        <div
          style={{
            maxWidth: '82%',
            fontSize: 12,
            color: '#b85c00',
            background: '#fff4ec',
            border: '1px solid #ffd9b5',
            borderRadius: 8,
            padding: '5px 10px',
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          ✏️ {corrections.join(' ')}
        </div>
      )}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function AIConversation() {
  const navigate = useNavigate();
  const { scenarioId: paramScenarioId } = useParams();

  const [scenarios, setScenarios] = useState([]);
  const [activeScenario, setActiveScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | recording | processing
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState('');
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isComplete, setIsComplete] = useState(false);
  const [scenarioChosen, setScenarioChosen] = useState(false);

  const chatEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  // load scenarios
  useEffect(() => {
    apiFetch('/conversation/scenarios')
      .then((d) => setScenarios(d.scenarios || []))
      .catch((e) => setError(e.message));
  }, []);

  // resolve active scenario from URL param
  useEffect(() => {
    if (!scenarios.length) return;
    const sid = paramScenarioId || 'cafe';
    const found = scenarios.find((s) => s.id === sid) || scenarios[0];
    setActiveScenario(found);
    setScenarioChosen(Boolean(paramScenarioId));
  }, [scenarios, paramScenarioId]);

  // kick off first turn once a scenario is active
  useEffect(() => {
    if (activeScenario && scenarioChosen && messages.length === 0) {
      sendTurn({ user_text: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario, scenarioChosen]);

  // scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // play audio helper
  const playAudio = useCallback((url) => {
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setIsSpeaking(true);
    audio.play().catch(() => setIsSpeaking(false));
    audio.onended = () => setIsSpeaking(false);
    audio.onerror = () => setIsSpeaking(false);
  }, []);

  // cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // main turn handler
  const sendTurn = useCallback(
    async ({ user_text = null, user_audio_b64 = null } = {}) => {
      if (!activeScenario) return;
      setStatus('processing');
      setError('');

      const apiMessages = messages.map((m) => ({ role: m.role, content: m.text }));

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
          setMessages((prev) => [
            ...prev,
            { role: 'user', text: userContent, translation: null, corrections: [] },
          ]);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: data.assistant_text,
            translation: data.translation,
            corrections: data.corrections || [],
          },
        ]);

        setIsComplete(data.is_complete);
        setStatus('idle');

        // Play audio immediately — don't wait for any video
        if (data.audio_url) {
          playAudio(data.audio_url);
        }
      } catch (e) {
        setError(e.message || 'Something went wrong. Please try again.');
        setStatus('idle');
      }
    },
    [activeScenario, messages, sessionId, playAudio],
  );

  // text submit
  const handleTextSubmit = (e) => {
    e?.preventDefault();
    const text = textInput.trim();
    if (!text || status === 'processing' || status === 'recording') return;
    setTextInput('');
    sendTurn({ user_text: text });
  };

  // voice recording
  const startRecording = async () => {
    if (status !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const b64 = await blobToBase64(blob);
        sendTurn({ user_audio_b64: b64 });
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus('recording');
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
      setStatus('processing');
    }
  };

  // scenario picker
  if (!scenarioChosen && scenarios.length > 0) {
    return (
      <ScenarioPicker
        scenarios={scenarios}
        onPick={(s) => {
          setActiveScenario(s);
          setScenarioChosen(true);
        }}
        onBack={() => navigate(-1)}
      />
    );
  }

  const isProcessing = status === 'processing';
  const isRecording = status === 'recording';

  return (
    <>
      <style>{`
        @keyframes wave-bar-0 { from { height: 6px; } to { height: 22px; } }
        @keyframes wave-bar-1 { from { height: 10px; } to { height: 20px; } }
        @keyframes wave-bar-2 { from { height: 4px; } to { height: 18px; } }
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 0.9; }
          70%  { transform: scale(1.18); opacity: 0; }
          100% { transform: scale(1.18); opacity: 0; }
        }
        @keyframes recording-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,80,80,0.4); }
          50%       { box-shadow: 0 0 0 10px rgba(255,80,80,0); }
        }
        @keyframes speaking-glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(255,122,26,0.15); }
          50%       { box-shadow: 0 4px 32px rgba(255,122,26,0.45); }
        }
        @keyframes thinking-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ minHeight: '100dvh', background: '#fdf6f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#fdf6f0' }}>

          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', borderBottom: '1px solid #f0e8e0', position: 'sticky', top: 0, zIndex: 10 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px', borderRadius: 8, color: '#555' }}
              aria-label="Go back"
            >←</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>
                {activeScenario?.icon} {activeScenario?.title_en || 'Conversation'}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{activeScenario?.title}</div>
            </div>
            {isComplete && (
              <span style={{ fontSize: 12, background: '#e8f5e9', color: '#2e7d32', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                ✓ Complete
              </span>
            )}
          </div>

          {/* Aram portrait */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24, paddingBottom: 16, background: '#fff', borderBottom: '1px solid #f0e8e0' }}>
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: '50%',
                overflow: 'hidden',
                position: 'relative',
                background: '#f5ece4',
                boxShadow: '0 4px 20px rgba(255,122,26,0.15)',
                animation: isSpeaking ? 'speaking-glow 0.8s ease-in-out infinite' : 'none',
                transition: 'box-shadow 0.3s',
              }}
            >
              <img
                src="/characters/aram.png"
                alt="Aram"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: isProcessing ? 0.65 : 1,
                  transition: 'opacity 0.3s',
                  filter: isSpeaking ? 'brightness(1.04)' : 'none',
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              {isProcessing && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.4)' }}>
                  <div style={{ width: 32, height: 32, border: '3px solid #FF7A1A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'thinking-spin 0.8s linear infinite' }} />
                </div>
              )}
              {/* pulsing ring when processing */}
              {isProcessing && (
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #FF7A1A', animation: 'pulse-ring 1.2s ease-out infinite', pointerEvents: 'none' }} />
              )}
            </div>

            <div style={{ marginTop: 10, fontWeight: 600, fontSize: 15, color: '#1a1a1a' }}>Արամ</div>

            {/* sound wave bars — animate when speaking */}
            <SoundWave active={isSpeaking} />

            <div style={{ fontSize: 12, color: '#aaa', marginTop: isSpeaking ? 4 : 8, minHeight: 16 }}>
              {isRecording ? '🔴 Listening…' : isProcessing ? 'Thinking…' : isSpeaking ? 'Speaking…' : 'Your Armenian tutor'}
            </div>
          </div>

          {/* chat history */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 && !isProcessing && (
              <div style={{ textAlign: 'center', color: '#bbb', fontSize: 14, marginTop: 40, lineHeight: 1.5 }}>
                {activeScenario ? `🎯 Goal: ${activeScenario.goal}` : 'Starting conversation…'}
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                role={msg.role}
                text={msg.text}
                translation={msg.translation}
                corrections={msg.corrections}
              />
            ))}
            {isProcessing && messages.length > 0 && (
              <div style={{ paddingLeft: 4, paddingBottom: 8 }}>
                <span style={{ color: '#ccc', fontSize: 13 }}>Aram is typing…</span>
              </div>
            )}
            {error && (
              <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 10, padding: '10px 14px', color: '#c0392b', fontSize: 13, marginBottom: 8, lineHeight: 1.4 }}>
                {error}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* input area */}
          {!isComplete && (
            <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #f0e8e0', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                disabled={isProcessing || isSpeaking}
                aria-label="Hold to speak"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: 'none',
                  background: isRecording ? '#ff4444' : '#FF7A1A',
                  color: '#fff',
                  fontSize: 20,
                  cursor: isProcessing || isSpeaking ? 'not-allowed' : 'pointer',
                  opacity: isProcessing || isSpeaking ? 0.45 : 1,
                  flexShrink: 0,
                  animation: isRecording ? 'recording-pulse 1s infinite' : 'none',
                  transition: 'background 0.15s, transform 0.1s, opacity 0.2s',
                  transform: isRecording ? 'scale(1.12)' : 'scale(1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                🎤
              </button>

              <form onSubmit={handleTextSubmit} style={{ flex: 1, display: 'flex', gap: 8 }}>
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type in Armenian…"
                  disabled={isProcessing || isRecording}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 24,
                    border: '1.5px solid #f0e8e0',
                    fontSize: 14,
                    outline: 'none',
                    background: isProcessing || isRecording ? '#f9f5f2' : '#fff',
                    color: '#1a1a1a',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#FF7A1A')}
                  onBlur={(e) => (e.target.style.borderColor = '#f0e8e0')}
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isProcessing || isRecording}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    border: 'none',
                    background: textInput.trim() && !isProcessing ? '#FF7A1A' : '#f0e8e0',
                    color: textInput.trim() && !isProcessing ? '#fff' : '#bbb',
                    fontSize: 18,
                    cursor: !textInput.trim() || isProcessing || isRecording ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    transition: 'background 0.15s, color 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Send"
                >↑</button>
              </form>
            </div>
          )}

          {/* completion */}
          {isComplete && (
            <div style={{ padding: '20px 24px', background: '#fff', borderTop: '1px solid #f0e8e0', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#1a1a1a', marginBottom: 4 }}>Scenario complete!</div>
              <div style={{ color: '#888', fontSize: 14, marginBottom: 16 }}>Great job practising Armenian.</div>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ background: '#FF7A1A', color: '#fff', border: 'none', borderRadius: 24, padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
              >
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
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '4px 8px', borderRadius: 8, color: '#555' }}>←</button>
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
              <span style={{ marginLeft: 'auto', fontSize: 18, color: '#ccc' }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
