// src/LessonPlayer.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Keep in sync with App.jsx
const API_BASE = 'https://haylinguav2.onrender.com';

function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  // ---- TTS state ----
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const audioRef = useRef(null);

  // ---------- Fetch lesson ----------
  useEffect(() => {
    let isCancelled = false;

    async function fetchLesson() {
      setLoading(true);
      setError(null);
      setCurrentIndex(0);

      try {
        const res = await fetch(`${API_BASE}/lessons/${slug}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!isCancelled) {
          console.log('Loaded lesson', data);
          setLesson(data);
        }
      } catch (err) {
        console.error('Failed to load lesson', err);
        if (!isCancelled) {
          setLesson(null);
          setError('Lesson not found.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchLesson();

    return () => {
      isCancelled = true;
    };
  }, [slug]);

  // ---------- TTS helper ----------
  async function handlePlayTTS(text) {
    setTtsError(null);

    const clean = (text || '').trim();
    if (!clean) return;

    try {
      setTtsLoading(true);

      // Stop previous sound if any
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean }),
      });

      if (!res.ok) {
        console.error('TTS error status', res.status);
        throw new Error(`TTS failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setTtsLoading(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setTtsLoading(false);
        setTtsError('Could not play audio');
      };
    } catch (err) {
      console.error('TTS request failed', err);
      setTtsLoading(false);
      setTtsError('TTS request failed');
    }
  }

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ---------- Render helpers ----------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">Loading lesson…</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <p className="text-gray-700 mb-4">{error || 'Lesson not found.'}</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 rounded-full bg-orange-600 text-white font-medium hover:bg-orange-700 transition"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : [];
  const currentExercise = exercises[currentIndex] || null;
  const total = exercises.length || 0;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < total - 1;

  const handleNext = () => {
    if (canGoNext) setCurrentIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (canGoPrev) setCurrentIndex((i) => i - 1);
  };

  return (
    <div className="min-h-screen bg-[#FFF7EE]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back link */}
        <button
          className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          onClick={() => navigate('/dashboard')}
        >
          <span>←</span>
          <span>Back to dashboard</span>
        </button>

        {/* Lesson header */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {lesson.title}
            </h1>
            {lesson.description && (
              <p className="text-gray-600 mt-1">{lesson.description}</p>
            )}
          </div>
          {total > 0 && (
            <div className="text-sm text-gray-500">
              {currentIndex + 1} / {total}
            </div>
          )}
        </div>

        {total === 0 || !currentExercise ? (
          <div className="bg-white rounded-3xl shadow-md p-10 text-center">
            <p className="text-gray-700 mb-6">
              This lesson has no exercises yet.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 rounded-full bg-orange-600 text-white font-medium hover:bg-orange-700 transition"
            >
              Back to dashboard
            </button>
          </div>
        ) : (
          <>
            <ExerciseCard
              exercise={currentExercise}
              ttsLoading={ttsLoading}
              ttsError={ttsError}
              onPlayTTS={handlePlayTTS}
            />

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={handlePrev}
                disabled={!canGoPrev}
                className={`px-6 py-3 rounded-full border text-sm font-medium transition ${
                  canGoPrev
                    ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    : 'border-gray-200 text-gray-400 cursor-default'
                }`}
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={!canGoNext}
                className={`px-6 py-3 rounded-full text-sm font-medium transition ${
                  canGoNext
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-200 text-gray-500 cursor-default'
                }`}
              >
                {canGoNext ? 'Next' : 'Done'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Exercise rendering
// ------------------------------------------------------------------

function ExerciseCard({ exercise, ttsLoading, ttsError, onPlayTTS }) {
  const kind = exercise.kind || 'generic';
  const config = exercise.config || {};

  const ttsText =
    config.ttsText ||
    config.letter ||
    exercise.prompt ||
    '';

  return (
    <div className="bg-white rounded-3xl shadow-md p-8">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-orange-600">
          Exercise {exercise.order}
        </div>
        <span className="px-3 py-1 rounded-full bg-orange-50 text-xs font-medium text-orange-700">
          {kind}
        </span>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        {exercise.prompt}
      </h2>

      {/* Letter / content */}
      {kind === 'char_intro' && (
        <CharIntroContent
          config={config}
          ttsText={ttsText}
          onPlayTTS={onPlayTTS}
          ttsLoading={ttsLoading}
        />
      )}

      {kind === 'char_mcq_sound' && (
        <CharMCQSoundContent
          config={config}
          ttsText={ttsText}
          onPlayTTS={onPlayTTS}
          ttsLoading={ttsLoading}
        />
      )}

      {kind === 'char_build_word' && (
        <CharBuildWordContent config={config} />
      )}

      {/* If some unknown kind sneaks in, just show JSON so it doesn't crash */}
      {kind !== 'char_intro' &&
        kind !== 'char_mcq_sound' &&
        kind !== 'char_build_word' && (
          <pre className="mt-4 text-xs bg-gray-100 rounded-xl p-3 text-gray-600 overflow-x-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        )}

      {ttsError && (
        <p className="mt-3 text-xs text-red-500">{ttsError}</p>
      )}
    </div>
  );
}

function CharIntroContent({ config, ttsText, onPlayTTS, ttsLoading }) {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <div className="flex items-baseline gap-3">
        <span className="text-6xl font-semibold text-gray-900">
          {config.letter}
        </span>
        {config.lower && (
          <span className="text-3xl text-gray-500">{config.lower}</span>
        )}
      </div>

      {config.transliteration && (
        <div className="text-sm text-gray-600">
          Pronounced: <span className="font-medium">{config.transliteration}</span>
        </div>
      )}

      {config.hint && (
        <p className="text-sm text-gray-600 max-w-md">{config.hint}</p>
      )}

      <button
        onClick={() => onPlayTTS(ttsText)}
        className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition"
        disabled={ttsLoading}
      >
        {ttsLoading ? (
          <span>Playing…</span>
        ) : (
          <>
            <span>🔊</span>
            <span>Hear the letter</span>
          </>
        )}
      </button>
    </div>
  );
}

function CharMCQSoundContent({ config, ttsText, onPlayTTS, ttsLoading }) {
  const options = Array.isArray(config.options) ? config.options : [];
  const correctIndex = config.correctIndex ?? 0;

  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null

  const handleSelect = (idx) => {
    setSelected(idx);
    if (idx === correctIndex) {
      setFeedback('correct');
    } else {
      setFeedback('wrong');
    }
  };

  let feedbackText = '';
  if (feedback === 'correct') feedbackText = 'Nice! That is the correct sound.';
  if (feedback === 'wrong') feedbackText = 'Not quite. Try listening again.';

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="text-5xl font-semibold text-gray-900">
          {config.letter}
        </div>

        <button
          onClick={() => onPlayTTS(ttsText)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100 transition"
          disabled={ttsLoading}
        >
          {ttsLoading ? (
            <span>Playing…</span>
          ) : (
            <>
              <span>🔊</span>
              <span>Hear the sound</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        {options.map((opt, idx) => {
          const isSelected = selected === idx;
          const isCorrect = idx === correctIndex;

          let border = 'border-gray-200';
          let bg = 'bg-white';
          let text = 'text-gray-800';

          if (feedback && isSelected) {
            if (isCorrect) {
              border = 'border-green-500';
              bg = 'bg-green-50';
              text = 'text-green-800';
            } else {
              border = 'border-red-500';
              bg = 'bg-red-50';
              text = 'text-red-800';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className={`px-4 py-3 rounded-2xl border ${border} ${bg} ${text} font-medium text-sm transition`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {feedback && (
        <p
          className={`text-sm text-center ${
            feedback === 'correct' ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {feedbackText}
        </p>
      )}
    </div>
  );
}

function CharBuildWordContent({ config }) {
  const tiles = Array.isArray(config.tiles) ? config.tiles : [];
  const solutionIndices = Array.isArray(config.solutionIndices)
    ? config.solutionIndices
    : [];

  const [selectedIndices, setSelectedIndices] = useState([]);

  const handleTileClick = (idx) => {
    if (selectedIndices.includes(idx)) return;
    setSelectedIndices((prev) => [...prev, idx]);
  };

  const currentWord = selectedIndices.map((i) => tiles[i]).join('');
  const targetWord = config.targetWord || '';

  const isComplete = selectedIndices.length === solutionIndices.length;
  const isCorrect =
    isComplete &&
    solutionIndices.length > 0 &&
    solutionIndices.every((value, idx) => selectedIndices[idx] === value);

  let statusText = '';
  if (isComplete) {
    statusText = isCorrect
      ? 'Great job! You built the word correctly.'
      : 'That’s not quite right. You can reset and try again.';
  }

  const handleReset = () => {
    setSelectedIndices([]);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-700 text-sm">
          Target: <span className="font-semibold">{targetWord}</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {tiles.map((tile, idx) => {
          const selected = selectedIndices.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => handleTileClick(idx)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-semibold border transition ${
                selected
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-900 border-gray-200 hover:bg-orange-50'
              }`}
            >
              {tile}
            </button>
          );
        })}
      </div>

      <div className="text-center">
        <div className="text-sm text-gray-600 mb-2">You built:</div>
        <div className="text-2xl font-semibold text-gray-900 mb-2">
          {currentWord || '—'}
        </div>

        {statusText && (
          <p
            className={`text-sm ${
              isCorrect ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {statusText}
          </p>
        )}

        {selectedIndices.length > 0 && (
          <button
            onClick={handleReset}
            className="mt-3 inline-flex px-4 py-2 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

export default LessonPlayer;
