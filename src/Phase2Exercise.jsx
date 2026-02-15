// src/Phase2Exercise.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { Card } from "./exercises/ui";
import { ttsFetch } from "./exercises/tts";

const DEFAULT_API_BASE = "https://haylinguav2.onrender.com";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").trim() || DEFAULT_API_BASE;

// Minimal, UI-first implementation for Phase 2.
// This component renders ONLY the interaction area.
// The bottom action bar is owned by ExerciseShell (LessonPlayer).

function normalizeConfig(cfg) {
  if (!cfg) return {};
  if (typeof cfg === "string") {
    try {
      return JSON.parse(cfg);
    } catch {
      return {};
    }
  }
  return cfg;
}

function getOptionText(opt) {
  if (opt == null) return "";
  if (typeof opt === "string") return opt;
  return opt.text ?? opt.label ?? opt.value ?? String(opt);
}

function buildCorrectIndexSet(exercise, cfg) {
  const set = new Set();
  const opts = Array.isArray(exercise?.options) ? exercise.options : null;

  if (opts) {
    opts.forEach((o, idx) => {
      if (o && (o.is_correct === true || o.isCorrect === true)) set.add(idx);
    });
  }

  const cIdx = cfg?.correctIndices ?? cfg?.correct_indices;
  if (Array.isArray(cIdx)) cIdx.forEach((i) => set.add(Number(i)));
  if (Number.isFinite(cfg?.correctIndex)) set.add(Number(cfg.correctIndex));

  // Common alternates used by different CMS versions
  if (Number.isFinite(cfg?.answerIndex)) set.add(Number(cfg.answerIndex));
  if (Number.isFinite(cfg?.answer_index)) set.add(Number(cfg.answer_index));
  if (Number.isFinite(cfg?.correct_option)) set.add(Number(cfg.correct_option));

  // Sometimes expected_answer is a numeric index in DB
  if (typeof exercise?.expected_answer === "number") set.add(Number(exercise.expected_answer));
  if (typeof cfg?.expected_answer === "number") set.add(Number(cfg.expected_answer));
  if (typeof cfg?.expectedAnswer === "number") set.add(Number(cfg.expectedAnswer));

  // Heuristic: some exercises store indices as 1-based (1..N) while UI is 0-based.
  // If we detect that pattern, shift everything down by 1.
  if (opts && opts.length > 0 && set.size > 0) {
    const vals = Array.from(set).filter((n) => Number.isFinite(n));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const looksOneBased = min >= 1 && max <= opts.length;
    const hasOutOfRange = max >= opts.length;
    if (looksOneBased || hasOutOfRange) {
      const shifted = new Set();
      vals.forEach((n) => shifted.add(n - 1));
      return shifted;
    }
  }

  return set;
}

function getCorrectTextCandidates(exercise, cfg) {
  const out = [];
  const push = (v) => {
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  };
  // very common keys
  push(cfg?.correct);
  push(cfg?.answer);
  push(cfg?.expected);
  push(cfg?.expected_text);
  push(cfg?.correctText);
  push(cfg?.correct_text);
  push(cfg?.correctAnswer);
  push(cfg?.correct_answer);
  push(exercise?.expected_answer);
  return out;
}

function normalizeExpectedAnswers(exercise, cfg) {
  const candidates = [];
  if (typeof cfg?.expected === "string") candidates.push(cfg.expected);
  if (typeof cfg?.expectedAnswer === "string") candidates.push(cfg.expectedAnswer);
  if (typeof cfg?.expected_answer === "string") candidates.push(cfg.expected_answer);
  if (typeof exercise?.expected_answer === "string") candidates.push(exercise.expected_answer);

  if (Array.isArray(cfg?.answers)) candidates.push(...cfg.answers);
  if (Array.isArray(cfg?.acceptedAnswers)) candidates.push(...cfg.acceptedAnswers);
  if (Array.isArray(cfg?.accepted_answers)) candidates.push(...cfg.accepted_answers);
  return candidates
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean);
}

function normStr(x) {
  if (x == null) return "";
  let s = String(x);
  try {
    s = s.normalize("NFC");
  } catch {}
  s = s.trim().toLowerCase();
  // collapse whitespace
  s = s.replace(/\s+/g, " ");
  // Armenian: treat ligature "և" and digraph "եւ" as equivalent
  // Many keyboards / sources vary between these forms.
  s = s.replace(/\u0587/g, "եւ");
  return s;
}

function eqLoose(a, b) {
  return normStr(a) === normStr(b);
}

export default function Phase2Exercise({ exercise, registerActions, submit }) {
  const cfg = useMemo(() => normalizeConfig(exercise?.config), [exercise?.config]);
  const kind = String(exercise?.kind || "").trim();

  // Shared: prompt
  const prompt =
    exercise?.prompt ?? cfg?.prompt ?? cfg?.question ?? cfg?.title ?? "";

  // ===== translate_mcq / char_mcq_sound / true_false (single-choice) =====
  const mcqChoices = useMemo(() => {
    if (kind === "true_false") return ["True", "False"];
    const opts = Array.isArray(exercise?.options) ? exercise.options : null;
    if (opts?.length) return opts.map(getOptionText);
    const c = cfg?.choices ?? cfg?.options;
    if (Array.isArray(c)) return c.map(getOptionText);
    return [];
  }, [exercise?.options, cfg, kind]);

  const correctSet = useMemo(() => buildCorrectIndexSet(exercise, cfg), [exercise, cfg]);
  const correctTextCandidates = useMemo(
    () => getCorrectTextCandidates(exercise, cfg),
    [exercise, cfg]
  );
  const isMulti = kind === "letter_recognition";

  const [selected, setSelected] = useState(isMulti ? [] : null);

  // ===== Duolingo-like auto-audio =====
  // IMPORTANT: this component is used for "letter_recognition" (and other Phase2 kinds)
  // so autoplay must live here (NOT in ExerciseRenderer).
  const didAutoplayRef = useRef(false);

  async function playTarget(targetKey, text) {
    if (!text || !exercise?.id) return;
    try {
      const url = await ttsFetch(API_BASE, {
        text,
        exerciseId: exercise.id,
        targetKey,
      });
      const a = new Audio(url);
      // Some browsers block autoplay audio without a user gesture.
      // Even if play() is blocked, we still want the fetch to happen (it already did).
      a.play().catch(() => {});
    } catch (e) {
      console.error("Audio play failed", e);
    }
  }

  useEffect(() => {
    // reset per exercise
    setSelected(isMulti ? [] : null);
    didAutoplayRef.current = false;
  }, [exercise?.id, isMulti]);

  // Autoplay the prompt for letter recognition (once per exercise)
  useEffect(() => {
    if (!exercise?.id) return;
    if (cfg?.autoplay === false) return;
    if (didAutoplayRef.current) return;

    if (kind !== "letter_recognition") return;

    didAutoplayRef.current = true;
    const p = String(prompt || "").trim();
    // Heuristic: keep it short (usually a letter or short word)
    if (p && p.length <= 18) {
      playTarget("prompt", p);
    }
  }, [exercise?.id, kind]);

  // ===== typing types =====
  const isTyping =
    kind === "letter_typing" ||
    kind === "word_spelling" ||
    kind === "fill_blank";

  const expectedAnswers = useMemo(
    () => normalizeExpectedAnswers(exercise, cfg),
    [exercise, cfg]
  );
  const [typed, setTyped] = useState("");
  useEffect(() => setTyped(""), [exercise?.id]);

  // ===== sentence_order =====
  const isSentenceOrder = kind === "sentence_order";
  const sentenceTokens = useMemo(() => {
    if (!isSentenceOrder) return [];
    const t = cfg?.tokens ?? cfg?.words ?? cfg?.parts;
    if (Array.isArray(t)) return t.map(String);
    if (typeof cfg?.sentence === "string") return cfg.sentence.split(/\s+/).filter(Boolean);
    return [];
  }, [cfg, isSentenceOrder]);
  const correctSentence = useMemo(() => {
    if (!isSentenceOrder) return null;
    const s = cfg?.correct ?? cfg?.answer ?? cfg?.expected;
    return typeof s === "string" ? s.trim() : null;
  }, [cfg, isSentenceOrder]);

  const [orderChosen, setOrderChosen] = useState([]); // array of token indices
  useEffect(() => setOrderChosen([]), [exercise?.id]);

  // ===== char_build_word =====
  const isBuildWord = kind === "char_build_word";
  const buildTiles = useMemo(() => {
    if (!isBuildWord) return [];
    const t = cfg?.tiles ?? cfg?.letters ?? cfg?.parts;
    if (Array.isArray(t)) return t.map(String);
    return [];
  }, [cfg, isBuildWord]);
  const buildCorrect = useMemo(() => {
    if (!isBuildWord) return null;
    const a = cfg?.answer ?? cfg?.correct ?? cfg?.expected;
    return typeof a === "string" ? a.trim() : null;
  }, [cfg, isBuildWord]);
  const [buildChosen, setBuildChosen] = useState([]); // tile indices
  useEffect(() => setBuildChosen([]), [exercise?.id]);

  // ===== audio =====
  const audioUrl = cfg?.audioUrl ?? cfg?.audio_url ?? null;
  const audio = useMemo(() => {
    if (!audioUrl) return null;
    try {
      return new Audio(audioUrl);
    } catch {
      return null;
    }
  }, [audioUrl]);

  // ===== Compute canCheck + handlers =====
  const canCheck = useMemo(() => {
    if (isTyping) return typed.trim().length > 0;
    if (isSentenceOrder) return orderChosen.length > 0;
    if (isBuildWord) return buildChosen.length > 0;
    if (isMulti) return Array.isArray(selected) && selected.length > 0;
    return selected !== null;
  }, [isTyping, typed, isSentenceOrder, orderChosen, isBuildWord, buildChosen, isMulti, selected]);

  const computeIsCorrect = () => {
    if (isTyping) {
      if (expectedAnswers.length === 0) return false;
      return expectedAnswers.some((a) => eqLoose(a, typed));
    }
    if (isSentenceOrder) {
      const built = orderChosen.map((i) => sentenceTokens[i]).join(" ").trim();
      if (correctSentence) return eqLoose(built, correctSentence);
      // fallback: use tokens as-is (rare)
      return false;
    }
    if (isBuildWord) {
      const built = buildChosen.map((i) => buildTiles[i]).join("").trim();
      if (buildCorrect) return eqLoose(built, buildCorrect);
      return false;
    }
    if (isMulti) {
      const picked = new Set(selected);

      // Prefer index-based correctness when available.
      if (correctSet.size > 0) {
        if (picked.size !== correctSet.size) return false;
        for (const i of correctSet) if (!picked.has(i)) return false;
        return true;
      }

      // Fallback: some multi-select exercises (e.g., letter_recognition) store
      // the correct answer(s) as TEXT in config (cfg.answer / cfg.correct), not indices.
      const norm = (v) => String(v ?? "").trim();
      const correctTextSet = new Set(correctTextCandidates.map(norm).filter(Boolean));
      const pickedTextSet = new Set([...picked].map((i) => norm(mcqChoices[i])));
      if (correctTextSet.size === 0) return false;
      if (pickedTextSet.size !== correctTextSet.size) return false;
      for (const t of correctTextSet) if (!pickedTextSet.has(t)) return false;
      return true;
    }
    // single-choice
    if (selected == null) return false;
    const selIdx = Number(selected);
    // Prefer index-based correctness when available
    if (correctSet.size > 0) return correctSet.has(selIdx);

    // Fallback: some exercises store the correct answer as TEXT in config
    // (e.g., cfg.correct = "Goodbye") instead of indices.
    const pickedText = mcqChoices[selIdx] ?? "";
    if (!pickedText) return false;
    if (correctTextCandidates.length === 0) return false;
    return correctTextCandidates.some((t) => eqLoose(t, pickedText));
  };

  const onCheck = () => {
    const isCorrect = computeIsCorrect();
    let answerText = null;
    let selectedIndices = null;

    if (isTyping) {
      answerText = typed;
    } else if (isSentenceOrder) {
      selectedIndices = orderChosen;
      answerText = orderChosen.map((i) => sentenceTokens[i]).join(" ");
    } else if (isBuildWord) {
      selectedIndices = buildChosen;
      answerText = buildChosen.map((i) => buildTiles[i]).join("");
    } else if (isMulti) {
      selectedIndices = selected;
      answerText = selected.map((i) => mcqChoices[i]).join(", ");
    } else {
      selectedIndices = [Number(selected)];
      answerText = mcqChoices[Number(selected)] ?? null;
    }

    submit?.({
      isCorrect,
      answerText,
      selectedIndices,
    });
  };

  const onSkip = () => {
    submit?.({ skipped: true, isCorrect: false });
  };

  // Register actions with parent
  useEffect(() => {
    registerActions?.({
      canCheck,
      onCheck,
      onSkip,
      primaryLabel: "Check",
      secondaryLabel: "Skip",
    });
  }, [registerActions, canCheck]);

  // Keyboard shortcuts: Enter = Check, Esc = Skip, 1-9 to pick option (single-choice)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Enter") {
        if (canCheck) {
          e.preventDefault();
          onCheck();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      }
      // numeric shortcuts for single-choice MCQ
      if (!isMulti && !isTyping && !isSentenceOrder && !isBuildWord) {
        const n = Number(e.key);
        if (Number.isFinite(n) && n >= 1 && n <= 9) {
          const idx = n - 1;
          if (idx < mcqChoices.length) {
            e.preventDefault();
            setSelected(idx);
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canCheck, isMulti, isTyping, isSentenceOrder, isBuildWord, mcqChoices.length, onCheck]);

  // ===== UI blocks =====
  if (isTyping) {
    return (
      <Card>
        <div className="text-slate-800 text-xl font-extrabold leading-snug">{prompt}</div>
        <div className="mt-4">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your answer"
            className="w-full h-12 rounded-xl px-4 text-base font-semibold ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            autoFocus
          />
        </div>
        {expectedAnswers.length ? (
          <div className="mt-3 text-xs text-slate-500">
            Tip: capitalization doesn’t matter.
          </div>
        ) : null}
      </Card>
    );
  }

  if (isSentenceOrder) {
    const picked = new Set(orderChosen);
    const built = orderChosen.map((i) => sentenceTokens[i]).join(" ").trim();
    return (
      <Card>
        <div className="text-slate-800 text-xl font-extrabold leading-snug">{prompt}</div>

        <div className="mt-4 p-3 rounded-2xl bg-white ring-1 ring-slate-200 min-h-[56px]">
          {built ? (
            <div className="text-slate-800 font-semibold">{built}</div>
          ) : (
            <div className="text-slate-400 font-semibold">Tap words in order…</div>
          )}
          {orderChosen.length ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
              onClick={() => setOrderChosen([])}
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {sentenceTokens.map((w, idx) => {
            const isPicked = picked.has(idx);
            return (
              <button
                key={idx}
                type="button"
                disabled={isPicked}
                onClick={() => setOrderChosen((p) => [...p, idx])}
                className={
                  "px-3 py-2 rounded-xl font-semibold ring-1 transition " +
                  (isPicked
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]")
                }
              >
                {w}
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  if (isBuildWord) {
    const picked = new Set(buildChosen);
    const built = buildChosen.map((i) => buildTiles[i]).join("").trim();
    return (
      <Card>
        <div className="text-slate-800 text-xl font-extrabold leading-snug">{prompt}</div>

        <div className="mt-4 p-3 rounded-2xl bg-white ring-1 ring-slate-200 min-h-[56px]">
          {built ? (
            <div className="text-slate-800 text-2xl font-extrabold tracking-wide">{built}</div>
          ) : (
            <div className="text-slate-400 font-semibold">Tap letters to build the word…</div>
          )}
          {buildChosen.length ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
              onClick={() => setBuildChosen([])}
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {buildTiles.map((t, idx) => {
            const isPicked = picked.has(idx);
            return (
              <button
                key={idx}
                type="button"
                disabled={isPicked}
                onClick={() => setBuildChosen((p) => [...p, idx])}
                className={
                  "w-12 h-12 rounded-2xl font-extrabold text-xl ring-1 transition " +
                  (isPicked
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 active:scale-[0.99]")
                }
              >
                {t}
              </button>
            );
          })}
        </div>
      </Card>
    );
  }

  // MCQ / Multi
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-slate-800 text-xl font-extrabold leading-snug">{prompt}</div>
          {kind === "char_mcq_sound" && audio ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    audio.currentTime = 0;
                    audio.play();
                  } catch {}
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Volume2 className="w-4 h-4" />
                Play
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {mcqChoices.map((c, idx) => {
          const active = isMulti
            ? Array.isArray(selected) && selected.includes(idx)
            : selected === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (isMulti) {
                  setSelected((prev) => {
                    const arr = Array.isArray(prev) ? prev : [];
                    return arr.includes(idx) ? arr.filter((x) => x !== idx) : [...arr, idx];
                  });
                  // For multi-select recognition, play the choice when it becomes selected.
                  if (kind === "letter_recognition") {
                    const txt = String(c || "").trim();
                    if (txt) playTarget(`choice_${idx}`, txt);
                  }
                } else {
                  setSelected(idx);
                  // For single-choice recognition-like tasks, play the selected choice.
                  if (kind === "letter_recognition" || kind === "translate_mcq") {
                    const txt = String(c || "").trim();
                    if (txt) playTarget(`choice_${idx}`, txt);
                  }
                }
              }}
              className={
                "rounded-2xl px-4 py-4 text-left font-extrabold ring-1 transition-transform duration-150 " +
                (active
                  ? "bg-orange-50 ring-orange-300 text-orange-800"
                  : "bg-white ring-slate-200 text-slate-800 hover:bg-slate-50") +
                " hover:-translate-y-[1px] active:translate-y-0"
              }
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    "w-6 h-6 rounded-full ring-2 flex items-center justify-center text-xs font-black " +
                    (active ? "ring-orange-400 bg-orange-100" : "ring-slate-200 bg-white")
                  }
                >
                  {idx + 1}
                </div>
                <div className="leading-snug">{c}</div>
              </div>
              {isMulti && active ? (
                <div className="mt-2 text-xs font-semibold text-orange-700">Selected</div>
              ) : null}
            </button>
          );
        })}
      </div>

      {isMulti ? (
        <div className="mt-4 text-xs text-slate-500">
          Select all that apply.
        </div>
      ) : (
        <div className="mt-4 text-xs text-slate-500">
          Tip: press 1–9 to choose, Enter to check.
        </div>
      )}
    </Card>
  );
}
