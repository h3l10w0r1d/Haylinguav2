// src/LessonPlayer.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function LessonPlayer({ lesson }) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [textAnswer, setTextAnswer] = useState('');
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [isPlaying, setIsPlaying] = useState(false);

  if (!lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-700">Lesson not found.</p>
      </div>
    );
  }

  const exercises = lesson.exercises || [];
  const current = exercises[currentIndex];

  const goBack = () => {
    navigate('/dashboard');
  };

  const goNext = () => {
    setSelectedOptions([]);
    setTextAnswer('');
    setFeedback(null);
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Later: call backend to mark lesson complete, update XP, etc.
      navigate('/dashboard');
    }
  };

  // ---------- TTS helper ----------

  const playTTS = async (text, voiceId) => {
    if (!text) return;
    try {
      setIsPlaying(true);

      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId || undefined,
        }),
      });

      if (!res.ok) {
        console.error('TTS failed', res.status);
        setIsPlaying(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsPlaying(false);
      };
      audio.play().catch((err) => {
        console.error('Audio play failed', err);
        setIsPlaying(false);
      });
    } catch (err) {
      console.error('TTS error', err);
      setIsPlaying(false);
    }
  };

  // ---------- UI for different exercise kinds ----------

  const renderBody = () => {
    if (!current) return null;

    const cfg = current.config || {};

    // 1) Intro letter – big glyph + “Play”
    if (current.kind === 'char_intro') {
      const displayLetter = cfg.letter || '?';
      const lower = cfg.lower || '';
      const translit = cfg.transliteration || '';
      const hint = cfg.hint || '';
      const ttsText = cfg.ttsText || displayLetter; // what we actually send to TTS

      return (
        <div className="flex flex-col items-center gap-6">
          <div className="text-8xl leading-none mb-2">{displayLetter}</div>
          {lower && (
            <div className="text-4xl text-orange-700 mb-1">
              {lower}
            </div>
          )}
          {translit && (
            <div className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm">
              Pronounced: {translit}
            </div>
          )}

          {hint && <p className="text-gray-600 text-center max-w-md">{hint}</p>}

          <button
            type="button"
            onClick={() => playTTS(ttsText, cfg.voiceId)}
            className="mt-4 px-6 py-3 rounded-full bg-orange-600 text-white font-medium shadow-md hover:bg-orange-700 transition flex items-center gap-2"
          >
            {isPlaying ? (
              <>
                <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                Playing…
              </>
            ) : (
              <>
                <span className="w-0 h-0 border-l-[10px] border-l-white border-y-[7px] border-y-transparent" />
                Play audio
              </>
            )}
          </button>
        </div>
      );
    }

    // 2) Multiple choice “which sound?” (also uses TTS)
    if (current.kind === 'char_mcq_sound') {
      const options = cfg.options || [];
      const correctIndex = cfg.correctIndex ?? 0;
      const letter = cfg.letter || '';
      const ttsText = cfg.ttsText || letter;

      const handleSelect = (idx) => {
        setSelectedOptions([idx]);
        const correct = idx === correctIndex;
        setFeedback(correct ? 'correct' : 'wrong');
      };

      return (
        <div className="flex flex-col gap-6 items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="text-7xl">{letter}</div>
            <button
              type="button"
              onClick={() => playTTS(ttsText, cfg.voiceId)}
              className="px-5 py-2 rounded-full bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition flex items-center gap-2"
            >
              {isPlaying ? (
                <>
                  <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                  Playing…
                </>
              ) : (
                <>
                  <span className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent" />
                  Play sound
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {options.map((opt, idx) => {
              const isSelected = selectedOptions.includes(idx);
              const isCorrect = idx === correctIndex;
              let border = 'border-gray-300';
              if (feedback && isSelected) {
                border = isCorrect ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50';
              }
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className={`px-4 py-3 rounded-xl border ${border} text-gray-800 hover:border-orange-500 transition text-sm`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={`mt-2 text-sm ${feedback === 'correct' ? 'text-green-600' : 'text-red-600'}`}>
              {feedback === 'correct' ? 'Nice! 🎉' : 'Not quite – try re-listening to the sound.'}
            </div>
          )}
        </div>
      );
    }

    // 3) Fallback – just show the prompt so old lessons still work
    return (
      <div className="text-center text-gray-700">
        <p className="mb-4">{current.prompt}</p>
        <p className="text-xs text-gray-400">
          This exercise kind isn’t wired up to the new UI yet.
        </p>
      </div>
    );
  };

  // ---------- Empty state ----------

  if (!exercises.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <p className="text-gray-700 mb-4">This lesson has no exercises yet.</p>
        <button
          onClick={goBack}
          className="px-6 py-3 rounded-full bg-orange-600 text-white font-medium shadow-md hover:bg-orange-700 transition"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  // ---------- Main layout ----------

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      <div className="max-w-xl w-full mx-auto px-4 py-6">
        {/* Progress header */}
        <div className="mb-6 flex items-center justify-between text-sm text-gray-600">
          <button
            onClick={goBack}
            className="text-orange-600 hover:underline"
          >
            ← Back
          </button>
          <div>
            Exercise {currentIndex + 1} / {exercises.length}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8">
          <h1 className="text-lg font-semibold text-gray-900 mb-4">
            {lesson.title}
          </h1>
          <p className="text-sm text-gray-500 mb-6">{current.prompt}</p>

          {renderBody()}

          {/* Next button */}
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={goNext}
              className="px-6 py-3 rounded-full bg-orange-600 text-white font-medium shadow hover:bg-orange-700 transition"
            >
              {currentIndex === exercises.length - 1 ? 'Finish lesson' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
