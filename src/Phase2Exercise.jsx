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

  // Fix P2-1/P2-2: only shift indices that are strictly out of 0-based range.
  // Old CMS entries used 1-based indices (1..N). A value of exactly opts.length
  // is out of 0-based range and must mean the last item (index n-1).
  // Valid 0-based indices (0..n-1) are used as-is — never shift them.
  if (opts && opts.length > 0 && set.size > 0) {
    const n = opts.length;
    const result = new Set();
    for (const v of set) {
      if (!Number.isFinite(v)) continue;
      if (v >= 0 && v < n) {
        // Valid 0-based index — use as-is
        result.add(Math.round(v));
      } else if (v === n) {
        // Out of 0-based range — must be 1-based index N meaning the last item
        result.add(n - 1);
      }
      // v < 0 or v > n are invalid — skip
    }
    return result;
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

  s = s.replace(/[\u00A0\u202F\u2007]/g, " ");
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF\u00AD]/g, "");
  s = s.replace(/եւ/g, "և");
  s = s.trim().toLowerCase();
  s = s.replace(/\s+/g, " ");

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

  // ===== SURGICAL FIX 1 of 2 =====
  // mcqChoices: true_false MUST return ["True","False"] so the two buttons render
  // and selected=0 means True, selected=1 means False.
  const mcqChoices = useMemo(() => {
    if (kind === "true_false") return ["True", "False"];
    const opts = Array.isArray(exercise?.options) ? exercise.options : null;
    if (opts?.length) return opts.map(getOptionText);
    const c = cfg?.choices ?? cfg?.options;
    if (Array.isArray(c)) return c.map(getOptionText);
    return [];
  }, [exercise?.options, cfg, kind]);
  // ===== END FIX 1 =====

  const correctSet = useMemo(() => buildCorrectIndexSet(exercise, cfg), [exercise, cfg]);
  const correctTextCandidates = useMemo(
    () => getCorrectTextCandidates(exercise, cfg),
    [exercise, cfg]
  );
  const isMulti = kind === "letter_recognition" || kind === "multi_select";

  const [selected, setSelected] = useState(isMulti ? [] : null);

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
    const s = cfg?.correct ?? cfg?.answer ?? cfg?.expected ?? exercise?.expected_answer ?? null;
    return typeof s === "string" ? s.trim() : null;
  }, [cfg, isSentenceOrder, exercise?.expected_answer]);

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
  const audioRef = useRef(null);
  useEffect(() => {
    if (!audioUrl) {
      audioRef.current = null;
      return;
    }
    try {
      audioRef.current = new Audio(audioUrl);
    } catch {
      audioRef.current = null;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
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
    // ===== SURGICAL FIX 2 of 2 =====
    // true_false: cfg.correct is a boolean. correctSet and correctTextCandidates
    // are both empty for boolean configs so we must handle this before them.
    // choices = ["True","False"] → index 0 = True, index 1 = False.
    if (kind === "true_false") {
      const c = cfg?.correct;
      if (c == null) return false; // missing cfg.correct — don't silently grade wrong
      const correctBool = c === true || c === 1 || c === "true" || String(c).toLowerCase() === "true";
      const userPickedTrue = selected === 0;
      return userPickedTrue === correctBool;
    }
    // ===== END FIX 2 =====

    if (isTyping) {
      if (expectedAnswers.length === 0) return false;
      return expectedAnswers.some((a) => eqLoose(a, typed));
    }
    if (isSentenceOrder) {
      const built = orderChosen.map((i) => sentenceTokens[i]).join(" ").trim();
      if (correctSentence) return eqLoose(built, correctSentence);
      return false;
    }
    if (isBuildWord) {
      const built = buildChosen.map((i) => buildTiles[i]).join("").trim();
      if (buildCorrect) return eqLoose(built, buildCorrect);
      return false;
    }
    if (isMulti) {
      const picked = new Set(selected);

      if (correctSet.size > 0) {
        if (picked.size !== correctSet.size) return false;
        for (const i of correctSet) if (!picked.has(i)) return false;
        return true;
      }

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
    if (correctSet.size > 0) return correctSet.has(selIdx);

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

  // Register actions with parent — ref ensures parent always calls the latest onCheck,
  // preventing stale-closure bugs when the user changes their selection between renders
  // (e.g. clicks "False" first, then switches to "True" — without this the registered
  // onCheck would still evaluate with the original "False" selection → both wrong).
  const onCheckRef = useRef(onCheck);
  onCheckRef.current = onCheck;

  // P2-9: keep registerActions in a ref so the effect dep list only contains canCheck.
  // If the parent passes an inline function, removing registerActions from deps prevents
  // an infinite re-registration loop.
  const registerActionsRef = useRef(registerActions);
  useEffect(() => { registerActionsRef.current = registerActions; });

  useEffect(() => {
    registerActionsRef.current?.({
      canCheck,
      onCheck: (...args) => onCheckRef.current(...args),
      primaryLabel: "Check",
    });
  }, [canCheck]); // only canCheck, not registerActions

  // Keyboard shortcuts: Enter = Check, 1-9 to pick option (single-choice)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Enter") {
        // P2-4: don't fire Check when focus is inside a text input
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        if (canCheck) {
          e.preventDefault();
          e.stopPropagation();
          onCheckRef.current();
        }
      }
      // numeric shortcuts for single-choice MCQ
      // P2-5: skip if focus is inside a text input
      if (!isMulti && !isTyping && !isSentenceOrder && !isBuildWord) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
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
  }, [canCheck, isMulti, isTyping, isSentenceOrder, isBuildWord, mcqChoices.length]);

  // ===== UI blocks =====
  if (isTyping) {
    // fill_blank exercises give the missing word only — show the sentence
    // with a visible blank so the learner knows not to type the whole thing.
    const blankBefore = cfg?.before ?? exercise?.sentence_before ?? "";
    const blankAfter = cfg?.after ?? exercise?.sentence_after ?? "";
    const hasBlankContext = kind === "fill_blank" && (blankBefore || blankAfter);
    return (
      <Card>
        <div className="text-slate-800 text-xl font-extrabold leading-snug dark:text-white">{prompt}</div>
        {hasBlankContext ? (
          <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 dark:bg-white/[0.04] dark:ring-white/[0.08]">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {blankBefore}{" "}
              <span className="px-2 py-1 rounded-lg bg-white ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                {cfg?.placeholder ?? "___"}
              </span>{" "}
              {blankAfter}
            </div>
          </div>
        ) : null}
        <div className="mt-4">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your answer"
            className="w-full rounded-2xl bg-slate-50 px-4 py-4 text-lg font-bold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:font-semibold placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {expectedAnswers.length ? (
          <div className="mt-3 text-xs text-slate-500 dark:text-stone-400">
            Tip: capitalization doesn't matter.
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
        <div className="text-slate-800 text-xl font-extrabold leading-snug dark:text-white">{prompt}</div>

        <div className="mt-4 p-3 rounded-2xl bg-white ring-1 ring-slate-200 min-h-[56px] dark:bg-[#18181b] dark:ring-white/[0.08]">
          {built ? (
            <div className="text-slate-800 font-semibold dark:text-white">{built}</div>
          ) : (
            <div className="text-slate-400 font-semibold dark:text-stone-500">Tap words in order…</div>
          )}
          {orderChosen.length ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200"
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
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed dark:bg-white/[0.06] dark:text-stone-500 dark:ring-white/[0.08]"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.04]")
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
        <div className="text-slate-800 text-xl font-extrabold leading-snug dark:text-white">{prompt}</div>

        <div className="mt-4 p-3 rounded-2xl bg-white ring-1 ring-slate-200 min-h-[56px] dark:bg-[#18181b] dark:ring-white/[0.08]">
          {built ? (
            <div className="text-slate-800 text-2xl font-extrabold tracking-wide dark:text-white">{built}</div>
          ) : (
            <div className="text-slate-400 font-semibold dark:text-stone-500">Tap letters to build the word…</div>
          )}
          {buildChosen.length ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200"
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
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed dark:bg-white/[0.06] dark:text-stone-500 dark:ring-white/[0.08]"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 active:scale-[0.99] dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.04]")
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
          <div className="text-slate-800 text-xl font-extrabold leading-snug dark:text-white">{prompt}</div>
          {kind === "char_mcq_sound" && audioRef.current ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                  } catch {}
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white ring-1 ring-slate-200 font-semibold text-slate-700 hover:bg-slate-50 dark:bg-[#18181b] dark:ring-white/[0.08] dark:text-stone-200 dark:hover:bg-white/[0.04]"
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
                  if (kind === "letter_recognition") {
                    const txt = String(c || "").trim();
                    if (txt) playTarget(`choice_${idx}`, txt);
                  }
                } else {
                  setSelected(idx);
                  if (kind === "letter_recognition" || kind === "translate_mcq") {
                    const txt = String(c || "").trim();
                    if (txt) playTarget(`choice_${idx}`, txt);
                  }
                }
              }}
              className={"tile text-lg " + (active ? "tile-selected" : "")}
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold ring-2 " +
                    (active ? "bg-feather-500 text-white ring-feather-500" : "bg-white text-slate-400 ring-slate-200 dark:bg-[#18181b] dark:text-stone-500 dark:ring-white/[0.08]")
                  }
                >
                  {idx + 1}
                </div>
                <div className="leading-snug">{c}</div>
              </div>
              {isMulti && active ? (
                <div className="mt-2 text-xs font-bold text-feather-700 dark:text-feather-400">Selected</div>
              ) : null}
            </button>
          );
        })}
      </div>

      {isMulti ? (
        <div className="mt-4 text-xs text-slate-500 dark:text-stone-400">
          Select all that apply.
        </div>
      ) : (
        <div className="mt-4 text-xs text-slate-500 dark:text-stone-400">
          Tip: press 1–9 to choose, Enter to check.
        </div>
      )}
    </Card>
  );
}
