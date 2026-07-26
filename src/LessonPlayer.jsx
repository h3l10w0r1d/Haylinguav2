// src/LessonPlayer.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import ExerciseRenderer from "./ExerciseRenderer";
import Phase2Exercise from "./Phase2Exercise";
import LessonCompletionScreen from "./LessonCompletionScreen";
import LessonReviewPanel from "./exercises/LessonReviewPanel";
import ExerciseAnalyticsModal from "./ExerciseAnalyticsModal";
import ExerciseShell from "./ExerciseShell";
import { sfx } from "./lib/sfx";
import { readHearts, writeHearts } from "./lib/hearts";
import OutOfHearts from "./OutOfHearts";
import { getPreloadedLesson } from "./lib/lessonPreload";
import { track } from "./lib/analytics";
import { pickMascotCharacter } from "./lib/mascotFaces";

// 🔧 Make sure this matches your backend URL
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("hay_token") ||
    ""
  );
}

// Build a combined step list for "reading" lessons.
function buildReadingExercises(lesson) {
  const cfg = lesson?.config || {};
  const reading = cfg?.reading || {};
  const sections = Array.isArray(reading?.sections) ? reading.sections : [];

  const all = Array.isArray(lesson?.exercises) ? lesson.exercises : [];
  const byId = new Map(all.map((e) => [Number(e?.id), e]));

  const out = [];
  let order = 0;

  const normalizeIds = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);
    }
    if (typeof val === "string") {
      return val
        .split(/[,\s]+/)
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);
    }
    return [];
  };

  sections.forEach((section, idx) => {
    out.push({
      id: `reading_section_${idx}`,
      kind: "reading_section",
      xp: 0,
      prompt: "",
      config: { section },
      sort_order: order++,
      __reading: true,
    });

    const ids = normalizeIds(section?.exercise_ids);
    ids.forEach((id) => {
      const ex = byId.get(Number(id));
      if (ex) out.push({ ...ex, sort_order: order++ });
    });
  });

  return out.length ? out : all;
}

function ReadingSectionCard({ section, userLevel, onNext }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const rate = useMemo(() => {
    const lvl = String(userLevel || '').toLowerCase();
    if (lvl.includes('adv')) return Number(section?.rate_advanced ?? 1.05);
    if (lvl.includes('inter')) return Number(section?.rate_intermediate ?? 1.0);
    return Number(section?.rate_beginner ?? 0.9);
  }, [userLevel, section]);

  const play = async () => {
    try {
      setIsPlaying(true);
      const text = section?.text || '';
      if (!text.trim()) return;

      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        console.warn('TTS failed', res.status);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.playbackRate = rate;
        await audioRef.current.play();
      }
    } finally {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200/80 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-feather-500 dark:text-feather-400">Reading</div>
            <h2 className="mt-1 font-display text-xl font-extrabold text-slate-800 dark:text-white">{section?.title || 'Read and listen'}</h2>
          </div>
          <button
            type="button"
            onClick={play}
            className="btn3d btn3d-feather text-sm"
            disabled={isPlaying}
          >
            {isPlaying ? '🔊 Playing…' : '🔊 Play'}
          </button>
        </div>

        <div className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-slate-700 dark:text-stone-200">
          {section?.text || ''}
        </div>

        <audio ref={audioRef} />

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onNext} className="btn3d btn3d-grass uppercase">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}


export default function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();
  // CMS "Preview" link for a draft lesson: ?preview=<short-lived token>,
  // scoped server-side to this one lesson (see GET /lessons/{slug}).
  const [searchParams] = useSearchParams();
  const previewToken = searchParams.get("preview") || "";

  const progressKey = slug ? `hay_lesson_${slug}` : null;

  const [lesson, setLesson] = useState(null);
  const [userLevel, setUserLevel] = useState(null);
  const [exerciseQueue, setExerciseQueue] = useState([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  // Random per lesson session — picked once, stays the same character for
  // every exercise-feedback face shown during this lesson.
  const [mascotCharacter] = useState(pickMascotCharacter);
  const [comboStreak, setComboStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [lessonXpEarned, setLessonXpEarned] = useState(0);
  const [lessonComboBonus, setLessonComboBonus] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [pendingNext, setPendingNext] = useState(null);
  const pendingNextRef = useRef(null);
  const [renderNonce, setRenderNonce] = useState(0);
  const [hasFinishedAll, setHasFinishedAll] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [heartsState, setHeartsState] = useState(readHearts);

  const [phase2Actions, setPhase2Actions] = useState(null);

  const exerciseStartRef = useRef(Date.now());
  const lessonStartRef = useRef(Date.now());

  // Read-only "step back" review: exercises already completed this lesson,
  // so a learner can scroll back through what they've done without any of
  // it affecting grading/XP/hearts state.
  const [history, setHistory] = useState([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const wrongIdsRef = useRef(new Set());

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  const [exModalOpen, setExModalOpen] = useState(false);
  const [exModalLoading, setExModalLoading] = useState(false);
  const [exModalError, setExModalError] = useState(null);
  const [exModalData, setExModalData] = useState(null);
  const [exModalExerciseId, setExModalExerciseId] = useState(null);

  const currentExercise = useMemo(() => {
    return exerciseQueue[0] || null;
  }, [exerciseQueue]);

  const isReadingSection = String(currentExercise?.kind || "") === "reading_section";

  const PHASE2_KINDS = useMemo(
    () =>
      new Set([
        "translate_mcq",
        "true_false",
        "fill_blank",
        "letter_typing",
        "word_spelling",
        "sentence_order",
        "char_build_word",
        "letter_recognition",
        "char_mcq_sound",
      ]),
    []
  );

  const isPhase2 =
    !!currentExercise &&
    !isReadingSection &&
    PHASE2_KINDS.has(String(currentExercise.kind || "").trim());

  // Kinds whose own body already renders a mascot (speech bubble or the big
  // standing character for speak exercises) — the shell's separate docked
  // desktop mascot would otherwise show the same character twice at once.
  const INLINE_MASCOT_KINDS = useMemo(
    () =>
      new Set([
        "fill_blank",
        "translate_mcq",
        "audio_choice_tts",
        "listen_type",
        "word_bank",
        "select_missing_word",
        "listen_word_bank",
        "minimal_pairs",
        "write_translate",
        "speak",
        "speak_line",
      ]),
    []
  );
  const currentKind = String(currentExercise?.kind || "").trim();
  const hideDockedMascot =
    !!currentExercise &&
    ((!isPhase2 && INLINE_MASCOT_KINDS.has(currentKind)) || (isPhase2 && currentKind === "fill_blank"));

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/me/onboarding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setUserLevel(data?.current_level || data?.level || data?.knowledge_level || null);
      } catch {
        // ignore
      }
    })();
  }, []);

  const [exerciseKey, setExerciseKey] = useState(0);

  useEffect(() => {
    exerciseStartRef.current = Date.now();
    setPhase2Actions(null);
    setHasAnswered(false);
  }, [exerciseKey]);

  async function submitPhase2(payload) {
    if (!currentExercise?.id) return;
    const token = getToken();
    const timeSpentMs = Date.now() - exerciseStartRef.current;
    const isCorrect = payload?.isCorrect === true;
    const skipped = payload?.skipped === true;
    const answerText = payload?.answerText ?? null;
    const selectedIndices = payload?.selectedIndices ?? null;

    let earnedDelta = 0;
    let hearts = undefined;
    let serverCorrect = isCorrect;
    let typo = false;
    let comboBonusXp = 0;
    let correctAnswer = null;

    if (token) {
      try {
        const res = await fetch(`${API_BASE}/me/exercises/${currentExercise.id}/attempt`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_correct: isCorrect,
            skipped,
            answer_text: answerText,
            selected_indices: selectedIndices,
            time_ms: timeSpentMs,
            combo: comboStreak,
          }),
        });

        if (res.ok) {
          const attempt = await res.json();
          earnedDelta = Number(attempt?.earned_xp_delta ?? 0) || 0;
          hearts = Number.isFinite(attempt?.hearts_current)
            ? attempt.hearts_current
            : undefined;
          if (typeof attempt?.is_correct === "boolean") serverCorrect = attempt.is_correct;
          typo = attempt?.typo === true;
          comboBonusXp = Math.max(0, Number(attempt?.combo_bonus_xp ?? 0));
          correctAnswer = attempt?.correct_answer ?? null;
          writeHearts(attempt); // sync header / shell / gate
        } else {
          earnedDelta = isCorrect && !skipped ? Number(currentExercise?.xp ?? 0) : 0;
        }
      } catch (e) {
        earnedDelta = isCorrect && !skipped ? Number(currentExercise?.xp ?? 0) : 0;
      }
    } else {
      earnedDelta = isCorrect && !skipped ? Number(currentExercise?.xp ?? 0) : 0;
    }

    handleStepAnswer({
      isCorrect: serverCorrect,
      skipped,
      xpEarned: Math.max(0, Math.floor(earnedDelta)),
      comboBonusXp,
      typo,
      correctAnswer,
      exerciseId: currentExercise.id,
      userAnswer: answerText,
      hearts,
    });
  }

  // ---------- Hearts (lives) sync ----------
  useEffect(() => {
    const onHearts = (e) => { if (e?.detail) setHeartsState(e.detail); };
    window.addEventListener("hay_hearts", onHearts);
    const token = getToken();
    if (token) {
      fetch(`${API_BASE}/me/hearts`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) writeHearts(d); })
        .catch(() => {});
    }
    return () => window.removeEventListener("hay_hearts", onHearts);
  }, []);

  // Persist remaining exercise IDs so a page refresh resumes from the same spot.
  useEffect(() => {
    if (!progressKey || exerciseQueue.length === 0) return;
    try {
      localStorage.setItem(progressKey, JSON.stringify(exerciseQueue.map((e) => e.id)));
    } catch {}
  }, [exerciseQueue, progressKey]);

  // Clear progress when the lesson is fully completed.
  useEffect(() => {
    if (hasFinishedAll && progressKey) {
      try { localStorage.removeItem(progressKey); } catch {}
    }
  }, [hasFinishedAll, progressKey]);

  // Only block on hearts at lesson entry — once the learner has answered their
  // first exercise they're mid-session and must be allowed to finish.
  const outOfHearts = !hasAnswered && !!heartsState && !heartsState.is_premium && Number(heartsState.current) <= 0;

  // ---------- Load lesson ----------

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const url = previewToken
        ? `${API_BASE}/lessons/${slug}?preview=${encodeURIComponent(previewToken)}`
        : `${API_BASE}/lessons/${slug}`;
      console.log("[LessonPlayer] Loading lesson from:", url);

      try {
        // A preview link always needs a fresh fetch (draft content, short-lived
        // token); otherwise reuse an in-flight/resolved preload from the
        // Dashboard if one exists — it's the same request, just started earlier.
        let data = previewToken ? null : await getPreloadedLesson(slug);

        if (!data) {
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });

          if (!res.ok) {
            const text = await res.text();
            console.error("[LessonPlayer] Failed to load lesson:", res.status, text);
            setLoadError(
              `Failed to load lesson (${res.status}). Check backend logs / URL / CORS.`
            );
            return;
          }

          data = await res.json();
        }
        console.log("[LessonPlayer] Lesson data:", data);

        const normalized = { ...data, lesson_type: data.lesson_type || "standard", config: data.config || {} };

        if (String(normalized.lesson_type) === "reading") {
          const rebuilt = buildReadingExercises(normalized);
          normalized.exercises = rebuilt;
        }

        setLesson(normalized);

        // Restore mid-lesson position from localStorage
        const allExercises = normalized.exercises || [];
        let startQueue = [...allExercises];
        if (progressKey) {
          try {
            const saved = JSON.parse(localStorage.getItem(progressKey) || "null");
            if (Array.isArray(saved) && saved.length > 0 && saved.length < allExercises.length) {
              const savedSet = new Set(saved.map(String));
              const restored = allExercises.filter((e) => savedSet.has(String(e.id)));
              if (restored.length > 0) startQueue = restored;
            }
          } catch {}
        }

        setExerciseQueue(startQueue);
        setOriginalTotal(allExercises.length);
        setHasFinishedAll(false);
        setMistakes(0);
        setLessonXpEarned(0);
        setAnalyticsLoading(false);
        setAnalyticsError(null);
        setAnalyticsData(null);
      } catch (err) {
        console.error("[LessonPlayer] Error loading lesson:", err);
        setLoadError("Network error when loading lesson. Check console and backend.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug, previewToken]);

  // ---------- Handling answers from ExerciseRenderer ----------

  function deriveCorrectAnswer(exercise) {
    if (!exercise) return null;
    const cfg = exercise.config || {};

    // Option-list exercises: find the marked-correct choice
    const opts = cfg.options || exercise.options || [];
    if (opts.length > 0) {
      const hit = opts.find((o) => o?.is_correct === true || o?.isCorrect === true);
      if (hit) return hit.text || hit.label || null;
      const idx = cfg.correctIndex ?? cfg.correct_index;
      if (idx !== undefined) return opts[idx]?.text || null;
    }

    // Text-based: expected_answer or explicit correct_text field
    const explicit = cfg.correct_text || cfg.correctText || cfg.answer;
    if (explicit) return String(explicit);

    // Flat expected_answer on the exercise row itself
    if (exercise.expected_answer) return String(exercise.expected_answer);

    // Array of acceptable answers — show the first
    const arr = cfg.correctAnswers || cfg.correct_answers;
    if (Array.isArray(arr) && arr.length > 0) return String(arr[0]);

    return null;
  }

  const handleStepAnswer = (payload) => {
    if (hasAnswered) return; // guard against double-tap
    const isCorrect = payload?.isCorrect === true;
    const skipped = payload?.skipped === true;
    const autoAdvance = payload?.autoAdvance === true;
    const xpEarned = Number(payload?.xpEarned ?? 0) || 0;

    console.log("[LessonPlayer] Step answered:", {
      queueLength: exerciseQueue.length,
      isCorrect,
      skipped,
      xpEarned,
      payload,
    });

    if (xpEarned > 0) {
      setLessonXpEarned((prev) => prev + xpEarned);
    }
    const comboBonusXp = Number(payload?.comboBonusXp ?? 0) || 0;
    if (comboBonusXp > 0) {
      setLessonComboBonus((prev) => prev + comboBonusXp);
    }

    if (!lesson || !lesson.exercises) return;

    // Intro exercises (char_intro etc.) pass autoAdvance=true — skip the result
    // sheet entirely and move straight to the next step.
    if (autoAdvance) {
      if (exerciseQueue.length <= 1) {
        setExerciseKey((k) => k + 1);
        setHasFinishedAll(true);
      } else {
        setExerciseQueue((q) => q.slice(1));
        setExerciseKey((k) => k + 1);
        setRenderNonce((n) => n + 1);
      }
      return;
    }

    const isLast = exerciseQueue.length <= 1;
    const newCombo = isCorrect ? comboStreak + 1 : 0;

    // Play SFX (after user interaction) — correct chime rises in pitch with combo.
    if (!skipped) {
      if (isCorrect) sfx.correct(newCombo);
      else sfx.wrong();
    }

    // Record for the "review this lesson so far" panel — only once an
    // exercise is actually passed (matches the progress bar advancing);
    // wrong/skipped attempts just mark it so the review badge shows
    // "got there eventually" instead of a clean pass.
    if (isCorrect && currentExercise) {
      setHistory((h) => [
        ...h,
        {
          id: currentExercise.id,
          prompt: currentExercise.prompt,
          userAnswer: payload?.userAnswer ?? null,
          xpEarned,
          wasWrongFirst: wrongIdsRef.current.has(currentExercise.id),
        },
      ]);
    } else if (currentExercise) {
      wrongIdsRef.current.add(currentExercise.id);
    }

    // Track mistakes so the lesson can't be "completed" by getting things wrong:
    // Duolingo-style, any non-correct answer (including a skip) re-shows the
    // exercise — you only advance once you answer correctly.
    setHasAnswered(true);
    setComboStreak(newCombo);

    if (!isCorrect) {
      setMistakes((m) => m + 1);
    }

    // Phase 2.5: unified result sheet. A skip is shown as "not quite" (it does
    // not pass the exercise).
    setResultData({
      isCorrect,
      skipped,
      xpEarned,
      comboBonusXp: Number(payload?.comboBonusXp ?? 0) || 0,
      typo: payload?.typo === true,
      message: payload?.message,
      hearts: payload?.hearts,
      // On a forgiven typo the server sends the intended spelling; otherwise
      // derive the correct answer locally for wrong answers.
      correctAnswer: payload?.typo
        ? payload?.correctAnswer
        : (isCorrect ? null : deriveCorrectAnswer(currentExercise)),
      exerciseId: payload?.exerciseId ?? currentExercise?.id,
      userAnswer: payload?.userAnswer ?? null,
      kind: currentExercise?.kind ?? null,
      combo: isCorrect ? newCombo : 0,
    });

    if (!isCorrect) {
      pendingNextRef.current = { type: "requeue" };
      setPendingNext({ type: "requeue" });
    } else {
      const pn = isLast ? { type: "finish" } : { type: "next" };
      pendingNextRef.current = pn;
      setPendingNext(pn);
    }
    setResultOpen(true);
  };

  const proceedAfterResult = () => {
    const pn = pendingNextRef.current;
    pendingNextRef.current = null;
    setResultOpen(false);
    setResultData(null);
    setPendingNext(null);

    if (!pn) return;
    if (pn.type === "next") {
      setExerciseQueue((q) => q.slice(1));
      setExerciseKey((k) => k + 1);
      setRenderNonce((n) => n + 1);
      return;
    }
    if (pn.type === "requeue") {
      // Wrong answer: push the missed exercise at least 2 positions into the
      // remaining queue (or to the end) so it doesn't immediately come back.
      setExerciseQueue((q) => {
        const rest = q.slice(1);
        const gap = Math.min(2, rest.length);
        return [...rest.slice(0, gap), q[0], ...rest.slice(gap)];
      });
      setExerciseKey((k) => k + 1);
      exerciseStartRef.current = Date.now();
      setPhase2Actions(null);
      setRenderNonce((n) => n + 1);
      return;
    }
    // finish — correct answer on the last remaining exercise
    setExerciseQueue((q) => q.slice(1));
    setExerciseKey((k) => k + 1);
    setHasFinishedAll(true);
  };

  // ---------- Load analytics when finished ----------

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!hasFinishedAll) return;
      if (!lesson?.id) return;

      const token = getToken();
      if (!token) return;

      setAnalyticsLoading(true);
      setAnalyticsError(null);

      const url = `${API_BASE}/me/lessons/${lesson.id}/analytics`;
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("[LessonPlayer] Analytics error:", res.status, text);
          setAnalyticsError(`Failed to load analytics (${res.status}).`);
          return;
        }

        const data = await res.json();
        setAnalyticsData(data);
      } catch (err) {
        console.error("[LessonPlayer] Analytics network error:", err);
        setAnalyticsError("Network error when loading analytics.");
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
  }, [hasFinishedAll, lesson?.id]);

  // ---------- Per-exercise analytics modal ----------

  const fetchExerciseAnalytics = async (exerciseId) => {
    if (!exerciseId) return;
    const token = getToken();
    if (!token) {
      setExModalError("You need to be logged in to view analytics.");
      return;
    }

    setExModalLoading(true);
    setExModalError(null);

    const url = `${API_BASE}/me/exercises/${exerciseId}/analytics`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[LessonPlayer] Exercise analytics error:", res.status, text);
        setExModalError(`Failed to load exercise analytics (${res.status}).`);
        return;
      }
      const data = await res.json();
      setExModalData(data);
    } catch (err) {
      console.error("[LessonPlayer] Exercise analytics network error:", err);
      setExModalError("Network error when loading exercise analytics.");
    } finally {
      setExModalLoading(false);
    }
  };

  const openExerciseAnalytics = (ex) => {
    const id = ex?.exercise_id;
    if (!id) return;
    setExModalExerciseId(id);
    setExModalData(null);
    setExModalError(null);
    setExModalOpen(true);
    fetchExerciseAnalytics(id);
  };

  // ---------- Complete lesson ("Done" button) ----------

  const handleCompleteLesson = async () => {
    if (!lesson || !slug) return;

    const token = getToken();
    if (!token) {
      alert("You need to be logged in. (No token found.)");
      console.warn("[LessonPlayer] No token found when completing lesson.");
      navigate("/");
      return;
    }

    setIsCompleting(true);

    const url = `${API_BASE}/lessons/${slug}/complete`;
    console.log("[LessonPlayer] Completing lesson with:", { url });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[LessonPlayer] Error completing lesson:", res.status, text);

        if (res.status === 401 || res.status === 403) {
          alert("Session expired or unauthorized. Please log in again.");
          localStorage.removeItem("access_token");
          localStorage.removeItem("hay_token");
          navigate("/");
        } else {
          alert(`Could not complete lesson (status ${res.status}). Check backend logs.`);
        }
        return;
      }

      const stats = await res.json();
      console.log("[LessonPlayer] Updated stats from backend:", stats);

      window.dispatchEvent(new CustomEvent("hay_xp_changed", {
        detail: { xp: stats?.total_xp, streak: stats?.streak },
      }));
      track("lesson_completed", { lesson_slug: slug, streak: stats?.streak });

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("[LessonPlayer] Network error completing lesson:", err);
      alert("Network error when completing lesson. Check console / backend.");
    } finally {
      setIsCompleting(false);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0d0d0f]">
        <div className="flex items-center gap-2 font-semibold text-slate-500 dark:text-stone-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading lesson…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-[#0d0d0f]">
        <p className="mb-4 text-center font-semibold text-cardinal-600 dark:text-cardinal-400">{loadError}</p>
        <button onClick={() => navigate("/dashboard")} className="btn3d btn3d-brand uppercase">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-[#0d0d0f]">
        <p className="mb-4 font-semibold text-slate-600 dark:text-stone-300">
          Lesson data is empty. Check the console and backend logs.
        </p>
        <button onClick={() => navigate("/dashboard")} className="btn3d btn3d-brand uppercase">
          Back to dashboard
        </button>
      </div>
    );
  }

  const showDoneFooter = !!hasFinishedAll;
  const totalSteps = originalTotal || 1;
  const completedSteps = originalTotal - exerciseQueue.length;

  const EXERCISE_INSTRUCTIONS = {
    translate_mcq: "Choose the correct translation",
    char_mcq_sound: "Which character makes this sound?",
    audio_choice_tts: "Listen and choose",
    listen_word_bank: "Listen and arrange the words",
    word_bank: "Arrange the words to form the sentence",
    fill_blank: "Fill in the blank",
    select_missing_word: "Choose the missing word",
    listen_type: "Listen and type what you hear",
    dialogue_mcq: "Read the dialogue and choose",
    dialogue_order: "Order the dialogue lines",
    reading_comprehension: "Read the passage and answer",
    minimal_pairs: "Which pronunciation do you hear?",
    image_select: "Choose the matching image",
    categorize: "Sort each item into the correct category",
    conjugation: "Complete the verb table",
    flashcard: "Study this card",
    speak_line: "Speak this line aloud",
    write_translate: "Write the translation",
    highlight_grammar: "Identify the grammar element",
    letter_typing: "Type the character",
    word_spelling: "Spell the word",
    speak: "Speak the word",
    speech_to_text: "Say what you hear",
    true_false: "True or false?",
  };
  const instruction = currentExercise ? (EXERCISE_INSTRUCTIONS[currentExercise.kind] ?? null) : null;

  return (
    <>
      {previewToken && lesson.is_published === false ? (
        <div className="fixed inset-x-0 top-0 z-[70] bg-amber-500 py-1.5 text-center text-xs font-extrabold uppercase tracking-wide text-white shadow-sm">
          Preview — this lesson is still a draft
        </div>
      ) : null}
      <ExerciseShell
      title={lesson.title}
      step={completedSteps}
      total={totalSteps}
      instruction={!showDoneFooter && !outOfHearts && !resultOpen ? instruction : null}
      onBack={() => navigate("/dashboard")}
      primaryLabel={!outOfHearts && !showDoneFooter && !isReadingSection && isPhase2 && !resultOpen ? (phase2Actions?.primaryLabel ?? "Check") : null}
      primaryDisabled={!outOfHearts && !showDoneFooter && !isReadingSection && isPhase2 && !resultOpen ? !phase2Actions?.canCheck : null}
      onPrimary={!outOfHearts && !showDoneFooter && !isReadingSection && isPhase2 && !resultOpen ? phase2Actions?.onCheck : null}
      secondaryLabel={null}
      secondaryDisabled={null}
      onSecondary={null}
      hideFooter={showDoneFooter || isReadingSection || outOfHearts}
      reviewCount={!showDoneFooter ? history.length : 0}
      onReview={() => setReviewOpen(true)}
      mascotCharacter={mascotCharacter}
      hideMascot={hideDockedMascot}
      result={
        resultOpen && resultData
          ? {
              variant: resultData.isCorrect ? "correct" : "wrong",
              xpEarned: resultData.xpEarned,
              comboBonusXp: resultData.comboBonusXp || 0,
              typo: resultData.typo === true,
              correctAnswer: resultData.correctAnswer || null,
              exerciseId: resultData.exerciseId ?? null,
              userAnswer: resultData.userAnswer ?? null,
              kind: resultData.kind ?? null,
              combo: resultData.combo || 0,
              subtext:
                Number.isFinite(resultData.hearts)
                  ? `Hearts left: ${resultData.hearts}`
                  : null,
              detail: resultData.message || null,
              primaryLabel:
                pendingNext?.type === "finish"
                  ? "Finish"
                  : pendingNext?.type === "requeue"
                  ? "Got it"
                  : "Continue",
            }
          : null
      }
      onResultPrimary={proceedAfterResult}
      exerciseId={!isReadingSection ? currentExercise?.id : null}
      lessonId={lesson?.id}
    >
        {/* Out of hearts — gate the lesson until they regen or go premium */}
        {!showDoneFooter && outOfHearts ? (
          <OutOfHearts
            nextRegenSeconds={Number(heartsState?.next_regen_seconds) || 0}
            onGoPremium={() => navigate("/premium")}
            onBack={() => navigate("/dashboard")}
            onRefilled={(state) => writeHearts(state)}
          />
        ) : null}

        {/* Current exercise */}
        {!showDoneFooter && !outOfHearts && currentExercise ? (
          isReadingSection ? (
            <ReadingSectionCard
              section={currentExercise?.config?.section}
              userLevel={userLevel || lesson?.config?.reading_level}
              onNext={() => {
                if (exerciseQueue.length <= 1) {
                  setHasFinishedAll(true);
                  return;
                }
                setExerciseQueue((q) => q.slice(1));
                setRenderNonce((n) => n + 1);
              }}
            />
          ) : isPhase2 ? (
            <Phase2Exercise
              key={`${currentExercise.id}:${renderNonce}`}
              exercise={currentExercise}
              registerActions={setPhase2Actions}
              submit={submitPhase2}
              mascotCharacter={mascotCharacter}
            />
          ) : (
            <ExerciseRenderer
              exercise={currentExercise}
              apiBaseUrl={API_BASE}
              onAnswer={handleStepAnswer}
              combo={comboStreak}
              mascotCharacter={mascotCharacter}
            />
          )
        ) : null}

        {/* Completion screen */}
        {showDoneFooter ? (
          <LessonCompletionScreen
            lesson={lesson}
            mascotCharacter={mascotCharacter}
            sessionXpEarned={lessonXpEarned}
            comboBonusXp={lessonComboBonus}
            mistakes={mistakes}
            timeMs={Date.now() - lessonStartRef.current}
            analytics={analyticsData}
            analyticsLoading={analyticsLoading}
            analyticsError={analyticsError}
            onOpenExercise={openExerciseAnalytics}
            onRetry={async () => {
              const token = getToken();
              if (progressKey) { try { localStorage.removeItem(progressKey); } catch {} }
              if (!token) {
                setExerciseQueue(lesson.exercises ? [...lesson.exercises] : []);
                setOriginalTotal(lesson.exercises?.length || 0);
                setHasFinishedAll(false);
                setHasAnswered(false);
                setComboStreak(0);
                setLessonXpEarned(0);
                setMistakes(0);
                return;
              }

              const url = `${API_BASE}/me/lessons/${lesson.id}/reset`;
              const res = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!res.ok) {
                const text = await res.text();
                alert(`Could not reset lesson (${res.status}). ${text}`);
                return;
              }

              setExerciseQueue(lesson.exercises ? [...lesson.exercises] : []);
              setOriginalTotal(lesson.exercises?.length || 0);
              setHasFinishedAll(false);
              setHasAnswered(false);
              setLessonXpEarned(0);
              setLessonComboBonus(0);
              setMistakes(0);
              setAnalyticsData(null);
              setAnalyticsError(null);
              setAnalyticsLoading(false);
            }}
            onDone={handleCompleteLesson}
            isSaving={isCompleting}
          />
        ) : null}

        {/* Fallback */}
        {!showDoneFooter && !currentExercise ? (
          <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8 dark:bg-[#18181b]">
            <p className="text-slate-700 mb-4 dark:text-stone-200">
              No exercise found (queue empty). Check console logs for
              lesson data and exercise kinds.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm"
            >
              Back to dashboard
            </button>
          </div>
        ) : null}

        <ExerciseAnalyticsModal
          open={exModalOpen}
          onClose={() => {
            setExModalOpen(false);
            setExModalExerciseId(null);
          }}
          loading={exModalLoading}
          error={exModalError}
          data={exModalData}
          onRetry={() => fetchExerciseAnalytics(exModalExerciseId)}
        />

        <LessonReviewPanel
          open={reviewOpen}
          history={history}
          onClose={() => setReviewOpen(false)}
        />
    </ExerciseShell>
    </>
  );
}
