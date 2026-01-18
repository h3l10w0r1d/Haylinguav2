// src/LessonPlayer.jsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Volume2 } from 'lucide-react';
import ExerciseRenderer from './ExerciseRenderer';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';

export default function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const audioRef = useRef(null);

  /* -------------------------------------------------------
     FETCH LESSON DATA
  ------------------------------------------------------- */
  useEffect(() => {
    async function fetchLesson() {
      try {
        setLoading(true);
        setLoadError(null);

        const token = localStorage.getItem('token');

        const res = await fetch(`${API_BASE_URL}/lessons/${slug}`, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        });

        if (res.status === 401) {
          alert('Session expired. Please log in again.');
          navigate('/login');
          return;
        }

        if (!res.ok) {
          throw new Error(`Failed to load lesson (${res.status})`);
        }

        const data = await res.json();
        setLesson(data);
        setCurrentIndex(0);
      } catch (err) {
        console.error('Error loading lesson:', err);
        setLoadError(err.message || 'Failed to load lesson');
      } finally {
        setLoading(false);
      }
    }

    fetchLesson();
  }, [slug, navigate]);

  const exercises = lesson?.exercises || [];
  const currentExercise = exercises[currentIndex] || null;
  const isLastExercise =
    exercises.length > 0 && currentIndex === exercises.length - 1;

  const progressPercent =
    exercises.length > 0
      ? ((currentIndex + 1) / exercises.length) * 100
      : 0;

  /* -------------------------------------------------------
     TTS FOR PROMPT
  ------------------------------------------------------- */
  const handlePlayTts = async () => {
    if (!currentExercise || !currentExercise.prompt || isPlayingTts) return;

    try {
      setIsPlayingTts(true);

      const token = localStorage.getItem('token');

      const res = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: currentExercise.prompt,
          // you can tweak language/voice on the backend side
          language_code: 'hy-AM',
        }),
      });

      if (!res.ok) {
        console.error('TTS request failed:', res.status);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.src = url;
      audioRef.current.play().catch((e) => {
        console.error('Audio play error:', e);
      });
    } catch (err) {
      console.error('Error playing TTS:', err);
    } finally {
      setIsPlayingTts(false);
    }
  };

  /* -------------------------------------------------------
     NAVIGATION
  ------------------------------------------------------- */
  const goPrev = () => {
    if (currentIndex === 0) return;
    setCurrentIndex((i) => i - 1);
  };

  const goNext = () => {
    if (currentIndex >= exercises.length - 1) return;
    setCurrentIndex((i) => i + 1);
  };

  /* -------------------------------------------------------
     COMPLETE LESSON (DONE)
  ------------------------------------------------------- */
  const handleCompleteLesson = async () => {
    if (!lesson) return;

    try {
      setIsCompleting(true);
      const token = localStorage.getItem('token');

      const res = await fetch(
        `${API_BASE_URL}/lessons/${lesson.slug}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({}),
        },
      );

      if (res.status === 401) {
        alert('Session expired. Please log in again.');
        navigate('/login');
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        console.error('Failed to complete lesson:', res.status, text);
        alert('Could not complete lesson. Please try again.');
        return;
      }

      const data = await res.json().catch(() => null);
      console.log('Lesson completed:', data);

      // Back to dashboard (previous behaviour)
      navigate('/dashboard');
    } catch (err) {
      console.error('Error completing lesson:', err);
      alert('Could not complete lesson. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  /* -------------------------------------------------------
     RENDER STATES
  ------------------------------------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF7EF] flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading lesson…</p>
      </div>
    );
  }

  if (loadError || !lesson) {
    return (
      <div className="min-h-screen bg-[#FFF7EF] flex flex-col items-center justify-center">
        <p className="text-sm text-red-500 mb-4">
          {loadError || 'Could not load this lesson.'}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  /* -------------------------------------------------------
     MAIN CONTENT
  ------------------------------------------------------- */

  // Decide whether to use the new custom renderer or the old generic block
  const USE_CUSTOM_RENDERER =
    currentExercise &&
    ['char_intro', 'char_mcq_sound', 'char_build_word'].includes(
      currentExercise.kind,
    );

  return (
    <div className="min-h-screen bg-[#FFF7EF]">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex-1 text-center">
          <p className="text-xs text-gray-500 tracking-wide uppercase">
            {lesson.title}
          </p>
          <p className="text-[11px] text-gray-400">
            Exercise {currentIndex + 1} of {exercises.length}
          </p>
        </div>
        <div className="w-12" />
      </div>

      {/* Progress bar */}
      <div className="max-w-4xl mx-auto px-4 mb-4">
        <div className="h-1.5 rounded-full bg-orange-100 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Exercise card */}
      <div className="max-w-4xl mx-auto px-4 pb-10">
        <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8">
          {currentExercise ? (
            USE_CUSTOM_RENDERER ? (
              // NEW custom components (your ExerciseRenderer.jsx)
              <ExerciseRenderer
                exercise={currentExercise}
                onAnswer={() => {
                  // We don't gate navigation on answer yet – this keeps old behaviour.
                }}
              />
            ) : (
              // OLD generic UI (what you had before, including the
              // "This exercise type (...)" line)
              <div className="flex flex-col items-center text-center">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">
                  {currentExercise.prompt}
                </h1>

                <div className="w-full max-w-xl mb-4">
                  <button
                    type="button"
                    onClick={handlePlayTts}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-800">
                      <Volume2 className="w-4 h-4 text-orange-500" />
                      <span>{currentExercise.prompt}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {isPlayingTts ? 'Playing…' : 'Play'}
                    </span>
                  </button>
                </div>

                <p className="text-xs text-gray-500">
                  This exercise type (“{currentExercise.kind}”) has no custom UI
                  yet.
                </p>
              </div>
            )
          ) : (
            <p className="text-sm text-gray-500 text-center">
              No exercises in this lesson.
            </p>
          )}
        </div>

        {/* Navigation buttons (old behaviour) */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="px-5 py-2 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-default"
          >
            &lt; Previous
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={goNext}
              disabled={currentIndex >= exercises.length - 1}
              className="px-6 py-2 rounded-xl bg-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-default"
            >
              Next &gt;
            </button>

            <button
              onClick={handleCompleteLesson}
              disabled={isCompleting}
              className="px-6 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-default"
            >
              {isCompleting ? 'Saving…' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
