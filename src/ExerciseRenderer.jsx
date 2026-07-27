import React, { useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";
import {
  normalizeConfig,
  normalizeText,
  cx,
  Card,
  Title,
  Muted,
  PrimaryButton,
  SecondaryButton,
  ChoiceGrid,
  Pill,
  InlineInput,
} from "./exercises/ui";
import { ttsFetch } from "./exercises/tts";
import { GlossaryText, useNewWords, normWord, hasArmenian } from "./exercises/WordHint";
import { writeHearts } from "./lib/hearts";
import { newTrackedAudio } from "./lib/audioRegistry";
import { FooterSlot } from "./exercises/FooterSlot";
import ArmenianKeyboard from "./exercises/ArmenianKeyboard";
import SpeechBubbleMascot from "./exercises/SpeechBubbleMascot";
import { mascotFaceUrl } from "./lib/mascotFaces";
import { translitArmenian } from "./lib/translit";

// Renders a prompt heading with inline word-hint tooltips. Every Armenian word
// is tappable for an on-demand translation even with no authored glossary;
// authored `glossary` entries (exercise.config.glossary: { word: definition })
// just show instantly instead of hitting the lookup. English scaffolding in
// the prompt stays plain text (GlossaryText only makes Armenian words tappable).
function PromptTitle({ text, glossary }) {
  if (!text) return null;
  return (
    <Title>
      <GlossaryText text={text} glossary={glossary} />
    </Title>
  );
}


/**
 * Variant A: component-per-kind.
 * Fixes "Minified React error #310" (hooks used conditionally) by moving
 * each exercise kind into its own component.
 *
 * Props:
 *  - exercise: {
 *      id, kind, prompt, expected_answer, sentence_before, sentence_after, config,
 *      options?: [{ id, text, is_correct, side, match_key }]
 *    }
 *  - onCorrect: () => void
 *  - onWrong: (msg?: string) => void
 *  - onSkip: () => void
 *  - onAnswer: (payload) => void   // parent receives result and advances
 *  - apiBaseUrl?: string
 */


/** Shared helper so all components keep exact behavior */
function useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit }) {
  // NOTE: we do NOT advance to the next exercise immediately.
  // We first persist the attempt, show a Result screen, and only then call onAnswer() from ExerciseRenderer.

  function wrong(msg, extra = {}) {
    onWrong?.(msg);
    submit?.({ isCorrect: false, message: msg, ...(extra || {}) });
  }

  function correct(extra = {}) {
    onCorrect?.();
    submit?.({ isCorrect: true, ...(extra || {}) });
  }

  function skip(extra = {}) {
    onSkip?.();
    // Skip should NOT count as correct for lesson completion logic.
    submit?.({ skipped: true, isCorrect: false, ...(extra || {}) });
  }

  return { wrong, correct, skip };
}
const DEFAULT_API_BASE = "https://haylinguav2.onrender.com";
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "").trim() || DEFAULT_API_BASE;

function getToken() {
  return (
    localStorage.getItem("hay_token") ||
    localStorage.getItem("access_token") ||
    null
  );
}

// Shared by every "speak" exercise kind: watches the live mic stream and
// calls onSilence() once the learner has spoken and then gone quiet for a
// beat — so recording stops itself instead of requiring a tap. Also a hard
// max-duration cap in case silence detection never fires (background noise,
// a mic that never dips below threshold, etc.). Returns a cleanup function.
function attachSilenceAutoStop(stream, onSilence, { speakThreshold = 0.045, silenceMs = 1100, maxMs = 15000 } = {}) {
  let stopped = false;
  let hasSpoken = false;
  let silenceStartedAt = null;
  let rafId = null;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return () => {};

  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  const startedAt = Date.now();

  function tick() {
    if (stopped) return;
    analyser.getByteTimeDomainData(data);
    // RMS of the (centered) waveform — cheap, reliable-enough voice-activity signal.
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    const now = Date.now();
    if (rms >= speakThreshold) {
      hasSpoken = true;
      silenceStartedAt = null;
    } else if (hasSpoken) {
      if (silenceStartedAt === null) silenceStartedAt = now;
      else if (now - silenceStartedAt >= silenceMs) {
        finish();
        return;
      }
    }

    if (now - startedAt >= maxMs) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function finish() {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    onSilence();
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    try { source.disconnect(); } catch {}
    try { ctx.close(); } catch {}
  };
}

async function postAttempt({
  exerciseId,
  isCorrect,
  answerText = null,
  selectedIndices = null,
  msSpent = null,
  combo = null,
}) {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/me/exercises/${exerciseId}/attempt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        is_correct: !!isCorrect,
        answer_text: answerText,
        selected_indices: Array.isArray(selectedIndices) ? selectedIndices : null,
        time_ms: Number.isFinite(msSpent) ? Math.max(0, Math.floor(msSpent)) : null,
        combo: Number.isFinite(combo) ? Math.max(0, Math.floor(combo)) : null,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[postAttempt] failed:", res.status, txt);
      return;
    }

    // Update hearts everywhere (header / shell / lesson gate) if returned.
    const data = await res.json().catch(() => null);
    if (data && typeof data === "object") writeHearts(data);
    return data;
  } catch (e) {
    console.warn("[postAttempt] error:", e);
    return null;
  }
}

async function postExerciseLog({ exerciseId, event, payload = {} }) {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/me/exercises/${exerciseId}/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        event: event || "client_event",
        payload: payload || {},
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[postExerciseLog] failed:", res.status, txt);
    }
  } catch (e) {
    console.warn("[postExerciseLog] error:", e);
  }
}
/* -------------------------------------------------------
   NEW helpers: DB-backed exercise_options compatibility
-------------------------------------------------------- */

// Prefer DB-backed options (exercise.options) if present; fallback to cfg
function getChoices(exercise, cfg) {
  const opts = Array.isArray(exercise?.options) ? exercise.options : [];
  if (opts.length) return opts.map((o) => String(o?.text ?? ""));
  const fromCfg = cfg.choices ?? cfg.options ?? [];
  return Array.isArray(fromCfg) ? fromCfg.map((x) => String(x ?? "")) : [];
}

// For MCQ: get correct index from DB options if available, else cfg.answerIndex or expected_answer
function getSingleCorrectIndex(exercise, cfg, choices) {
  const opts = Array.isArray(exercise?.options) ? exercise.options : [];
  if (opts.length) {
    const i = opts.findIndex((o) => !!o?.is_correct);
    return i >= 0 ? i : null;
  }
  if (Number.isFinite(cfg.answerIndex)) return Number(cfg.answerIndex);
  // If expected_answer matches one choice, accept that
  const expected = exercise?.expected_answer;
  if (expected != null) {
    const j = choices.findIndex((c) => normalizeText(c) === normalizeText(expected));
    return j >= 0 ? j : null;
  }
  return null;
}

// For multi-select: read correct indices from DB options OR cfg
function getCorrectIndices(exercise, cfg, choices) {
  const opts = Array.isArray(exercise?.options) ? exercise.options : [];
  if (opts.length) {
    const idxs = [];
    opts.forEach((o, i) => {
      if (o?.is_correct) idxs.push(i);
    });
    return idxs;
  }

  if (Array.isArray(cfg.correctIndices)) return cfg.correctIndices.map((n) => Number(n));

  if (Array.isArray(cfg.correctAnswers)) {
    return cfg.correctAnswers
      .map((ans) => choices.findIndex((c) => normalizeText(c) === normalizeText(ans)))
      .filter((i) => i >= 0);
  }

  // fallback: if expected_answer is a JSON array string, support it
  const expected = exercise?.expected_answer;
  if (typeof expected === "string" && expected.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(expected);
      if (Array.isArray(arr)) {
        return arr
          .map((ans) => choices.findIndex((c) => normalizeText(c) === normalizeText(ans)))
          .filter((i) => i >= 0);
      }
    } catch {
      // ignore
    }
  }

  return [];
}

/* -------------------------
   Individual Kind Components
-------------------------- */

// 1) char_intro — no result sheet, no Skip button
function ExCharIntro({ exercise, cfg, submit }) {
  const prompt = exercise?.prompt || "";
  const letter = cfg.letter ?? "";
  const lower = cfg.lower ?? "";
  const transliteration = cfg.transliteration ?? "";
  const hint = cfg.hint ?? "";
  const exampleWord = cfg.exampleWord ?? "";
  const exampleMeaning = cfg.exampleMeaning ?? "";
  const exampleEmoji = cfg.exampleEmoji ?? "";

  const [playing, setPlaying] = useState(false);
  const didAutoplayRef = useRef(false);

  async function playLetter() {
    if (!letter) return;
    setPlaying(true);
    try {
      const url = await ttsFetch(API_BASE, {
        text: exampleWord || letter,
        exerciseId: exercise?.id,
        targetKey: "letter",
      });
      const a = newTrackedAudio(url);
      a.onended = () => setPlaying(false);
      a.play();
    } catch (e) {
      console.error("TTS failed", e);
      setPlaying(false);
    }
  }

  useEffect(() => {
    didAutoplayRef.current = false;
  }, [exercise?.id]);

  useEffect(() => {
    if (didAutoplayRef.current || !letter) return;
    didAutoplayRef.current = true;
    playLetter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id, letter]);

  return (
    <Card>
      <Title>{prompt || "New letter"}</Title>

      <button
        type="button"
        onClick={playLetter}
        className="animate-pop mt-4 flex w-full items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-brand-50 to-white px-6 py-6 ring-2 ring-brand-100 transition active:scale-[0.99] dark:from-brand-500/10 dark:to-white/[0.03] dark:ring-brand-500/30"
        aria-label="Hear the letter"
      >
        <div className="flex items-baseline gap-4">
          <div className="text-6xl md:text-7xl font-black text-slate-900 dark:text-white">{letter}</div>
          <div className="text-3xl md:text-4xl font-extrabold text-slate-700 dark:text-stone-200">{lower}</div>
        </div>
        <div className={cx(
          "grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-500 text-white shadow-node transition",
          playing && "animate-pulse"
        )}>
          🔊
        </div>
      </button>

      {exampleWord && (
        <div className="mt-3 flex items-center gap-2 text-lg">
          <span className="text-2xl">{exampleEmoji}</span>
          <span className="font-extrabold text-slate-800 dark:text-white">{exampleWord}</span>
          {exampleMeaning && <span className="text-slate-500 dark:text-stone-400">— {exampleMeaning}</span>}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 dark:bg-white/[0.04] dark:ring-white/[0.08]">
        {transliteration && (
          <Muted>
            Sounds like:{" "}
            <span className="font-semibold text-slate-800 dark:text-stone-200">{transliteration}</span>
          </Muted>
        )}
        {hint && <Muted className="mt-2">{hint}</Muted>}
      </div>

      <FooterSlot>
        <PrimaryButton onClick={() => submit?.({ isCorrect: true, autoAdvance: true, xpEarned: 0 })}>
          Continue
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// 2) char_mcq_sound (UI-only play button — preserved)
function ExCharMcqSound({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const options = cfg.options ?? [];
  // ER-2/ER-3: use getSingleCorrectIndex so DB-backed exercise.options.is_correct is respected
  const correctIndexFromDb = getSingleCorrectIndex(exercise, cfg, options);
  const correctIndex = correctIndexFromDb !== null
    ? correctIndexFromDb
    : (Number.isFinite(Number(cfg.correctIndex)) ? Number(cfg.correctIndex) : -1);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setSelectedIndex(null);
    setGraded(null);
  }, [exercise?.id]);

  const canCheck = selectedIndex !== null;

  return (
    <Card>
      <Title>{prompt || "Pick the correct sound"}</Title>
      <Muted className="mt-2">
        Letter: <span className="font-semibold text-slate-800 dark:text-white">{cfg.letter ?? ""}</span>
      </Muted>

      <div className="mt-4">
        <SecondaryButton
          onClick={() =>
            wrong("Sound playback is not wired for this kind. Use audio_choice_tts for real TTS.")
          }
        >
          🔊 Play sound
        </SecondaryButton>
      </div>

      <div className="mt-4">
        <ChoiceGrid
          choices={options}
          selected={selectedIndex}
          onSelect={setSelectedIndex}
          columns={2}
          graded={graded}
        />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck || !!graded}
          onClick={() => {
            setGraded({ correct: correctIndex, picked: selectedIndex });
            if (selectedIndex === correctIndex) correct();
            else wrong("Try again.");
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}



// 3) letter_recognition
function ExLetterRecognition({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const choices = getChoices(exercise, cfg);

  const correctIndices = getCorrectIndices(exercise, cfg, choices);
  const isMulti =
    !!cfg.multi ||
    correctIndices.length > 1 ||
    (typeof prompt === "string" && prompt.toLowerCase().includes("select all"));

  const singleAnswerText =
    typeof expected === "string" && !expected.trim().startsWith("[") ? expected : (cfg.answer ?? "");

  const [selected, setSelected] = useState(isMulti ? [] : null);
  const submittedRef = useRef(false); // ER-17: guard against double-submission

  const didAutoplayRef = useRef(false);

  async function playTarget(targetKey, text) {
    if (!text) return;
    try {
      const url = await ttsFetch(API_BASE, {
        text,
        exerciseId: exercise?.id,
        targetKey,
      });
      const a = newTrackedAudio(url);
      a.play();
    } catch (e) {
      console.error("TTS failed", e);
    }
  }

  useEffect(() => {
    if (!exercise?.id) return;
    if (cfg?.autoplay === false) return;
    if (didAutoplayRef.current) return;
    didAutoplayRef.current = true;

    const p = (prompt || "").trim();
    const e = (singleAnswerText || "").trim();

    const speak = (p && p.length <= 18) ? p : ((e && e.length <= 18) ? e : "");
    if (speak) playTarget("prompt", speak);
  }, [exercise?.id]);

  useEffect(() => {
    setSelected(isMulti ? [] : null);
    didAutoplayRef.current = false; // ER-5: reset autoplay ref on exercise change
    submittedRef.current = false; // ER-17: reset submission guard
  }, [exercise?.id, isMulti]);

  const canCheck = isMulti ? (Array.isArray(selected) && selected.length > 0) : selected !== null;
  // ER-17: submittedRef used in onClick guard below (not in disabled to avoid extra render)

  function arraysEqualAsSets(a, b) {
    const aa = Array.isArray(a) ? a.map(Number) : [];
    const bb = Array.isArray(b) ? b.map(Number) : [];
    if (aa.length !== bb.length) return false;
    const s = new Set(aa);
    for (const x of bb) if (!s.has(x)) return false;
    return true;
  }

  return (
    <Card>
      <Title>{prompt || (isMulti ? "Select all correct answers" : "Choose the correct answer")}</Title>

      <div className="mt-4">
        <ChoiceGrid
          choices={choices}
          selected={selected}
          onSelect={(next) => {
            setSelected(next);
            if (!isMulti && Number.isFinite(next)) {
              const idx = Number(next);
              const txt = choices[idx] ?? "";
              playTarget(`choice_${idx}`, txt);
            }
          }}
          columns={2}
          multi={isMulti}
        />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (submittedRef.current) return; // ER-17: prevent double-submission
            submittedRef.current = true;
            if (isMulti) {
              const picked = Array.isArray(selected) ? selected : [];
              const extra = {
                selectedIndices: picked,
                answerText: picked.map((i) => choices[i] ?? "").join(", "),
              };

              if (correctIndices.length === 0) {
                wrong("This exercise is missing correct answers in config.", extra);
                return;
              }

              if (arraysEqualAsSets(picked, correctIndices)) correct(extra);
              else wrong("Not quite. Try again.", extra);
              return;
            }

            const idx = selected;
            const pick = choices[idx] ?? "";
            const extra = { selectedIndices: [idx], answerText: pick };

            if (correctIndices.length === 1) {
              if (idx === correctIndices[0]) correct(extra);
              else wrong("Not quite. Try again.", extra);
              return;
            }

            if (normalizeText(pick) === normalizeText(singleAnswerText)) correct(extra);
            else wrong("Not quite. Try again.", extra);
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// 4) char_build_word
function ExCharBuildWord({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";

  const tiles = cfg.tiles ?? [];
  const solution = cfg.solutionIndices ?? [];
  const targetWord = cfg.targetWord;

  const [chosen, setChosen] = useState([]);
  const [used, setUsed] = useState(new Set());

  useEffect(() => {
    setChosen([]);
    setUsed(new Set());
  }, [exercise?.id]);

  const built = chosen.map((i) => tiles[i]).join("");
  const canCheck = chosen.length > 0;

  function reset() {
    setChosen([]);
    setUsed(new Set());
  }

  return (
    <Card>
      <Title>{prompt || "Build the word"}</Title>
      {targetWord && (
        <Muted className="mt-2">
          Target: <span className="font-semibold text-slate-800 dark:text-stone-200">{targetWord}</span>
        </Muted>
      )}

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 dark:bg-white/[0.04] dark:ring-white/[0.08]">
        <div className="text-2xl font-extrabold text-slate-900 dark:text-white min-h-[2.5rem]">
          {built || "…"}
        </div>
        <div className="mt-3 flex gap-2">
          <SecondaryButton onClick={reset} disabled={chosen.length === 0}>
            Reset
          </SecondaryButton>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tiles.map((t, idx) => {
          const isUsed = used.has(idx);
          return (
            <Pill
              key={idx}
              disabled={isUsed}
              onClick={() => {
                if (isUsed) return;
                const next = new Set(used);
                next.add(idx);
                setUsed(next);
                setChosen((prev) => [...prev, idx]);
              }}
            >
              {t}
            </Pill>
          );
        })}
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            // ER-4: if solutionIndices absent but targetWord set, compare built word to target
            const solutionIndices = solution.length > 0 ? solution : null;
            const ok = solutionIndices
              ? (solutionIndices.length === chosen.length &&
                 solutionIndices.every((v, i) => Number(v) === Number(chosen[i])))
              : (built.trim() === (targetWord ?? "").trim());
            if (ok) correct({ selectedIndices: chosen, answerText: built });
            else wrong("The order is off. Try again.", { selectedIndices: chosen, answerText: built });
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// 5) letter_typing
function ExLetterTyping({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;
  const answer = expected ?? cfg.answer ?? "";

  const [inputValue, setInputValue] = useState("");
  const submittedRef = useRef(false); // ER-18: guard against double-submission
  useEffect(() => { setInputValue(""); submittedRef.current = false; }, [exercise?.id]);

  const canCheck = normalizeText(inputValue).length > 0;

  return (
    <Card>
      <Title>{prompt || "Type the letter"}</Title>

      <div className="mt-4">
        <InlineInput value={inputValue} onChange={setInputValue} placeholder="Type here…" />
        <ArmenianKeyboard value={inputValue} onChange={setInputValue} className="mt-3" />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (submittedRef.current) return; // ER-18: prevent double-submission
            submittedRef.current = true;
            if (normalizeText(inputValue) === normalizeText(answer)) correct({ answerText: inputValue });
            else wrong("Incorrect. Check the letter form and try again.", { answerText: inputValue });
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// 6) word_spelling
function ExWordSpelling({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;
  const answer = expected ?? cfg.answer ?? "";
  const hint = cfg.hint;

  const [inputValue, setInputValue] = useState("");
  const submittedRef = useRef(false); // ER-18: guard against double-submission
  useEffect(() => { setInputValue(""); submittedRef.current = false; }, [exercise?.id]);

  const canCheck = normalizeText(inputValue).length > 0;

  return (
    <Card>
      <Title>{prompt || "Spell the word"}</Title>
      {hint && <Muted className="mt-2">Hint: {hint}</Muted>}

      <div className="mt-4">
        <InlineInput value={inputValue} onChange={setInputValue} placeholder="Type the word…" />
        <ArmenianKeyboard value={inputValue} onChange={setInputValue} className="mt-3" />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (submittedRef.current) return; // ER-18: prevent double-submission
            submittedRef.current = true;
            if (normalizeText(inputValue) === normalizeText(answer)) correct({ answerText: inputValue });
            else wrong("Almost — try again.");
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// A) fill_blank
function ExFillBlank({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const before = cfg.before ?? exercise?.sentence_before ?? "";
  const after = cfg.after ?? exercise?.sentence_after ?? "";
  const placeholder = cfg.placeholder ?? "…";
  const answer = expected ?? cfg.answer ?? "";

  const [inputValue, setInputValue] = useState("");
  const submittedRef = useRef(false); // ER-19: guard against double-submission
  useEffect(() => { setInputValue(""); submittedRef.current = false; }, [exercise?.id]);

  const canCheck = normalizeText(inputValue).length > 0;

  return (
    <Card>
      <PromptTitle text={prompt || "Fill in the blank"} glossary={cfg.glossary} />

      <div className="mt-4">
        <SpeechBubbleMascot
          character={mascotCharacter}
          text={
            <>
              {before}{" "}
              <span className="rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                {placeholder}
              </span>{" "}
              {after}
            </>
          }
        />
      </div>

      <div className="mt-4">
        <InlineInput
          value={inputValue}
          onChange={setInputValue}
          placeholder="Type the missing word…"
        />
        <ArmenianKeyboard value={inputValue} onChange={setInputValue} className="mt-3" />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (submittedRef.current) return; // ER-19: prevent double-submission
            submittedRef.current = true;
            if (normalizeText(inputValue) === normalizeText(answer)) correct({ answerText: inputValue });
            else wrong("Not quite. Try the missing word again.", { answerText: inputValue });
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// B) translate_mcq (now supports exercise.options DB-backed)
function ExTranslateMcq({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const sentence = cfg.sentence ?? "";
  const choices = getChoices(exercise, cfg);
  const correctIndexFromDbOrCfg = getSingleCorrectIndex(exercise, cfg, choices);
  const answerText = expected ?? cfg.answer ?? null;

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [graded, setGraded] = useState(null);
  useEffect(() => { setSelectedIndex(null); setGraded(null); }, [exercise?.id]);

  const canCheck = selectedIndex !== null;

  return (
    <Card>
      <PromptTitle text={prompt || "Choose the correct translation"} glossary={cfg.glossary} />

      {sentence && (
        <div className="mt-4">
          <SpeechBubbleMascot
            character={mascotCharacter}
            text={<GlossaryText text={sentence} glossary={cfg.glossary} />}
          />
        </div>
      )}

      <div className="mt-4">
        <ChoiceGrid
          choices={choices}
          selected={selectedIndex}
          onSelect={setSelectedIndex}
          columns={1}
          graded={graded}
        />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck || !!graded}
          onClick={() => {
            const pick = choices[selectedIndex] ?? "";
            const extra = {
              selectedIndices: [selectedIndex],
              answerText: pick,
            };
            const ci = correctIndexFromDbOrCfg !== null ? correctIndexFromDbOrCfg : choices.findIndex((c) => normalizeText(c) === normalizeText(answerText));
            setGraded({ correct: ci, picked: selectedIndex });

            if (correctIndexFromDbOrCfg !== null) {
              if (selectedIndex === correctIndexFromDbOrCfg) correct(extra);
              else wrong("Wrong choice. Try again.", extra);
              return;
            }

            // fallback text compare
            if (answerText && normalizeText(pick) === normalizeText(answerText)) correct(extra);
            else wrong("Wrong choice. Try again.", extra);
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// C) true_false
function ExTrueFalse({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const statement = cfg.statement ?? "";
  // ER-9: explicit check — don't treat null/undefined as false (which makes "False" always correct)
  const correctBool = cfg.correct === true || cfg.correct === 1 || String(cfg.correct).toLowerCase() === 'true';

  const [selectedIndex, setSelectedIndex] = useState(null);
  useEffect(() => setSelectedIndex(null), [exercise?.id]);

  const canCheck = selectedIndex !== null; // 0=false 1=true

  return (
    <Card>
      <Title>{prompt || "True or False"}</Title>

      {statement && (
        <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 dark:bg-white/[0.04] dark:ring-white/[0.08]">
          <div className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white">{statement}</div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setSelectedIndex(0)}
          className={cx(
            "rounded-xl px-4 py-3 font-semibold ring-1 transition",
            selectedIndex === 0
              ? "bg-orange-50 ring-orange-300 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300"
              : "bg-white ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.06]"
          )}
        >
          False
        </button>
        <button
          onClick={() => setSelectedIndex(1)}
          className={cx(
            "rounded-xl px-4 py-3 font-semibold ring-1 transition",
            selectedIndex === 1
              ? "bg-orange-50 ring-orange-300 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300"
              : "bg-white ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.06]"
          )}
        >
          True
        </button>
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            const pick = selectedIndex === 1;
            if (pick === correctBool) correct({ selectedIndices: [selectedIndex], answerText: pick ? "true" : "false" });
            else wrong("Nope — think about the meaning.", { selectedIndices: [selectedIndex], answerText: pick ? "true" : "false" });
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// D) sentence_order
function ExSentenceOrder({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const rawTokens = cfg.tokens ?? [];
  const solution = cfg.solution ?? null;
  const solutionIndices = cfg.solutionIndices ?? null;

  // Wrap each token in a keyed object so duplicate words stay distinguishable.
  // ER-7: store original index as `.k` so grading works even with duplicate words
  const initialAvailable = React.useMemo(
    () => rawTokens.map((t, i) => ({ t, k: i, key: `${i}-${t}` })),
    [exercise?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState(initialAvailable);

  async function playTarget(targetKey, text) {
    try {
      const url = await ttsFetch(API_BASE, {
        text,
        exerciseId: exercise?.id,
        targetKey,
      });
      const a = newTrackedAudio(url);
      a.play();
    } catch (e) {
      console.error("TTS failed", e);
    }
  }

  useEffect(() => {
    setPicked([]);
    setAvailable(initialAvailable);
  }, [exercise?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canCheck = picked.length > 0;

  function removePicked(idx) {
    const item = picked[idx];
    setPicked((p) => p.filter((_, i) => i !== idx));
    setAvailable((a) => [...a, item]);
  }

  function addToken(idx) {
    const item = available[idx];
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setPicked((p) => [...p, item]);
  }

  return (
    <Card>
      <PromptTitle text={prompt || "Put the sentence in order"} glossary={cfg.glossary} />

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 min-h-[4.5rem] dark:bg-white/[0.04] dark:ring-white/[0.08]">
        <div className="flex flex-wrap gap-2">
          {picked.length === 0 ? (
            <Muted>Tap words below to build the sentence…</Muted>
          ) : (
            picked.map((item, i) => (
              <Pill key={item.key} onClick={() => removePicked(i)} active>
                <span className="mr-2">{item.t}</span>
                <button
                  type="button"
                  className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/60 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const idx = rawTokens.indexOf(item.t);
                    playTarget(idx >= 0 ? `token_${idx}` : "token", item.t);
                  }}
                  title="Hear"
                >
                  🔊
                </button>
              </Pill>
            ))
          )}
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-4 py-2 text-sm hover:bg-slate-100 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.08]"
          onClick={() => {
            const sentence = picked.map((it) => it.t).join(" ").trim();
            const fallback = Array.isArray(solution) ? solution.join(" ") : rawTokens.join(" ");
            playTarget("sentence", sentence || fallback);
          }}
        >
          🔊 Play sentence
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {available.map((item, i) => (
          <Pill key={item.key} onClick={() => addToken(i)}>
            <span className="mr-2">{item.t}</span>
            <button
              type="button"
              className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/60 hover:bg-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = rawTokens.indexOf(item.t);
                playTarget(idx >= 0 ? `token_${idx}` : "token", item.t);
              }}
              title="Hear"
            >
              🔊
            </button>
          </Pill>
        ))}
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            const pickedTexts = picked.map((it) => it.t);
            if (Array.isArray(solution)) {
              const ok =
                solution.length === pickedTexts.length &&
                solution.every((v, i) => normalizeText(v) === normalizeText(pickedTexts[i]));
              ok ? correct() : wrong("Word order is incorrect. Try again.");
              return;
            }

            if (Array.isArray(solutionIndices)) {
              // ER-7: use stored .k index to avoid indexOf collisions with duplicate words
              const builtIndices = picked.map((it) => it.k ?? rawTokens.indexOf(it.t));
              const ok =
                solutionIndices.length === builtIndices.length &&
                solutionIndices.every((v, i) => Number(v) === Number(builtIndices[i]));
              ok ? correct() : wrong("Word order is incorrect. Try again.");
              return;
            }

            const builtSentence = pickedTexts.join(" ");
            const answer = expected ?? cfg.answer ?? "";
            if (normalizeText(builtSentence) === normalizeText(answer)) correct();
            else wrong("Word order is incorrect. Try again.");
          }}
        >
          Check
        </PrimaryButton>

      </FooterSlot>
    </Card>
  );
}

// E) match_pairs
function ExMatchPairs({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";

  const pairs = Array.isArray(cfg.pairs) ? cfg.pairs : [];
  const left = pairs.map((p) => p.left);
  const right = pairs.map((p) => p.right);

  const shuffledRight = useMemo(() => {
    const arr = [...right];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matchedLeft, setMatchedLeft] = useState(new Set());
  const [matchedRight, setMatchedRight] = useState(new Set());
  const [matchedPairs, setMatchedPairs] = useState([]);

  useEffect(() => {
    setSelectedLeft(null);
    setMatchedLeft(new Set());
    setMatchedRight(new Set());
    setMatchedPairs([]);
  }, [exercise?.id]);

  const totalMatches = pairs.length;
  const currentMatches = matchedLeft.size;

  function tryMatch(lIdx, rIdx) {
    const l = left[lIdx];
    const r = shuffledRight[rIdx];

    const correctPair = pairs.find((p) => normalizeText(p.left) === normalizeText(l));
    if (correctPair && normalizeText(correctPair.right) === normalizeText(r)) {
      const nl = new Set(matchedLeft);
      nl.add(lIdx);
      setMatchedLeft(nl);

      const nr = new Set(matchedRight);
      nr.add(rIdx);
      setMatchedRight(nr);

      setSelectedLeft(null);

      // Accumulate the matched pairs so the server can verify the full mapping.
      const nextPairs = [...matchedPairs, { left: l, right: r }];
      setMatchedPairs(nextPairs);

      if (nl.size === totalMatches) {
        correct({ answerText: JSON.stringify(nextPairs) });
      }
    } else {
      // ER-8: don't fire a network request for each wrong intermediate click;
      // just reset selection so the user can try again (visual feedback only).
      setSelectedLeft(null);
    }
  }

  return (
    <Card>
      <Title>{prompt || "Match the pairs"}</Title>
      <Muted className="mt-2">
        Matched:{" "}
        <span className="font-semibold text-slate-800 dark:text-white">{currentMatches}</span> /{" "}
        {totalMatches}
      </Muted>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {left.map((t, idx) => {
            const done = matchedLeft.has(idx);
            const active = selectedLeft === idx;
            return (
              <button
                key={idx}
                disabled={done}
                onClick={() => setSelectedLeft(idx)}
                className={cx(
                  "w-full rounded-xl px-4 py-3 font-semibold text-left ring-1 transition",
                  done
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed dark:bg-white/[0.03] dark:text-stone-600 dark:ring-white/[0.06]"
                    : active
                    ? "bg-orange-50 text-orange-800 ring-orange-300 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/40"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.06]"
                )}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {shuffledRight.map((t, idx) => {
            const done = matchedRight.has(idx);
            return (
              <button
                key={idx}
                disabled={done || selectedLeft === null}
                onClick={() => {
                  if (selectedLeft === null) return;
                  tryMatch(selectedLeft, idx);
                }}
                className={cx(
                  "w-full rounded-xl px-4 py-3 font-semibold text-left ring-1 transition",
                  done
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed dark:bg-white/[0.03] dark:text-stone-600 dark:ring-white/[0.06]"
                    : selectedLeft === null
                    ? "bg-white text-slate-300 ring-slate-200 cursor-not-allowed dark:bg-white/[0.03] dark:text-stone-600 dark:ring-white/[0.08]"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.06]"
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 space-y-3">
      </div>
    </Card>
  );
}

// F) audio_choice_tts (now supports exercise.options DB-backed)
function ExAudioChoiceTts({
  exercise,
  cfg,
  onCorrect,
  onWrong,
  onSkip,
  onAnswer,
  apiBaseUrl,
  submit,
  mascotCharacter = "armen",
}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const ttsText = cfg.ttsText ?? cfg.text ?? "";
  const promptText = cfg.promptText ?? prompt ?? "Listen and choose";
  const choices = getChoices(exercise, cfg);
  const correctIndexFromDbOrCfg = getSingleCorrectIndex(exercise, cfg, choices);
  const answerText = expected ?? cfg.answer ?? null;

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [graded, setGraded] = useState(null);
  const [busy, setBusy] = useState(false);

  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    setSelectedIndex(null);
    setGraded(null);
    setBusy(false);

    // ER-12: pause and clear src before revoking the blob URL
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const canCheck = selectedIndex !== null;

  async function play() {
    if (!ttsText) return;
    try {
      setBusy(true);
      const url = await ttsFetch(apiBaseUrl, {
        text: ttsText,
        exerciseId: exercise?.id,
      });
      setAudioUrl(url);
      const audio = newTrackedAudio(url);
      audioRef.current = audio;
      await audio.play();
    } catch {
      wrong("Could not play audio. Check ElevenLabs key / /tts endpoint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Title>Listen and choose</Title>

      <div className="mt-4">
        <SpeechBubbleMascot
          character={mascotCharacter}
          text={promptText}
          onPlay={play}
          busy={busy}
          playDisabled={!ttsText}
        />
        {!ttsText && <Muted className="mt-2">Missing config.ttsText</Muted>}
      </div>

      <div className="mt-4">
        <ChoiceGrid
          choices={choices}
          selected={selectedIndex}
          onSelect={setSelectedIndex}
          columns={2}
          graded={graded}
        />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck || !!graded}
          onClick={() => {
            const pick = choices[selectedIndex] ?? "";
            // Send selection so the server can re-grade authoritatively.
            const extra = { selectedIndices: [selectedIndex], answerText: pick };
            const ci = correctIndexFromDbOrCfg !== null ? correctIndexFromDbOrCfg : choices.findIndex((c) => normalizeText(c) === normalizeText(answerText));
            setGraded({ correct: ci, picked: selectedIndex });
            if (correctIndexFromDbOrCfg !== null) {
              selectedIndex === correctIndexFromDbOrCfg ? correct(extra) : wrong("Wrong choice. Try again.", extra);
              return;
            }
            if (answerText && normalizeText(pick) === normalizeText(answerText)) correct(extra);
            else wrong("Wrong choice. Try again.", extra);
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

/**
 * multi_select
 */
function ExMultiSelect({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });

  const prompt = exercise?.prompt || "Select all correct answers";

  const choices = getChoices(exercise, cfg);
  const correctIdxs = getCorrectIndices(exercise, cfg, choices);

  const minSelect = Number.isFinite(cfg.minSelect) ? Number(cfg.minSelect) : 1;
  const maxSelect = Number.isFinite(cfg.maxSelect)
    ? Number(cfg.maxSelect)
    : choices.length;
  // Only show an explicit count when the config actually constrains it; the
  // common "select all that apply" case shouldn't reveal how many are correct.
  const hasExplicitLimit = Number.isFinite(cfg.minSelect) || Number.isFinite(cfg.maxSelect);

  const [selectedSet, setSelectedSet] = useState(() => new Set());

  useEffect(() => {
    setSelectedSet(new Set());
  }, [exercise?.id]);

  function toggle(i) {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else {
        if (next.size >= maxSelect) return next;
        next.add(i);
      }
      return next;
    });
  }

  const selectedArray = Array.from(selectedSet).sort((a, b) => a - b);
  const canCheck = selectedArray.length >= minSelect;

  function isCorrectSelection() {
    const target = [...correctIdxs].sort((a, b) => a - b);
    if (target.length === 0) return false;
    if (target.length !== selectedArray.length) return false;
    return target.every((v, idx) => Number(v) === Number(selectedArray[idx]));
  }

  return (
    <Card>
      <Title>{prompt}</Title>
      <Muted className="mt-2">
        {hasExplicitLimit
          ? `Select ${minSelect}${maxSelect < choices.length ? `–${maxSelect}` : ""} option(s).`
          : "Select all that apply."}
      </Muted>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {choices.map((c, idx) => {
          const active = selectedSet.has(idx);
          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              className={cx(
                "rounded-xl px-4 py-3 text-left font-semibold transition ring-1",
                active
                  ? "bg-orange-50 ring-orange-300 text-orange-800 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/40"
                  : "bg-white ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.06]"
              )}
            >
              {active ? "✅ " : ""}
              {c}
            </button>
          );
        })}
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            // Send selection so the server can re-grade authoritatively.
            const extra = {
              selectedIndices: selectedArray,
              answerText: selectedArray.map((i) => choices[i] ?? "").join(", "),
            };
            if (isCorrectSelection()) correct(extra);
            else wrong("Not quite. Try selecting the correct set.", extra);
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// G) speak — record speech, transcribe via backend (hispeech.ai), compare
// ----- Per-word pronunciation feedback (shared by speak / speak_line) -----
// Aligns what the learner said against the target and marks each target word
// matched/missed, so "we heard …" becomes actionable: nail the green ones,
// re-try the red ones.
function _spNorm(s) {
  return String(s || "").normalize("NFD").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}
function _spSim(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}
function alignSpokenWords(target, transcript) {
  const origTokens = String(target || "").trim().split(/\s+/).filter(Boolean);
  const avail = _spNorm(transcript).split(" ").filter(Boolean);
  return origTokens.map((tok) => {
    const w = _spNorm(tok);
    let best = 0, bi = -1;
    avail.forEach((s, i) => { if (s == null) return; const sim = _spSim(w, s); if (sim > best) { best = sim; bi = i; } });
    const matched = w.length > 0 && best >= 0.72;
    if (matched && bi >= 0) avail[bi] = null; // consume so a word can't match twice
    return { token: tok, matched };
  });
}
function SpokenWordFeedback({ target, transcript, hideScript }) {
  const words = useMemo(() => alignSpokenWords(target, transcript), [target, transcript]);
  if (!target || !transcript || !words.length) return null;
  const hit = words.filter((w) => w.matched).length;
  return (
    <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-stone-400">
        Your pronunciation · {hit}/{words.length} words
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-lg font-extrabold leading-relaxed">
        {words.map(({ token, matched }, i) => (
          <span key={i} className={matched
            ? "text-grass-600 dark:text-grass-400"
            : "text-cardinal-500 underline decoration-wavy decoration-cardinal-300 dark:text-cardinal-400"}>
            {hideScript ? translitArmenian(token) : token}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExSpeak({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, apiBaseUrl, submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Say the phrase out loud";
  const target = String(exercise?.expected_answer ?? cfg.answer ?? cfg.target ?? cfg.phrase ?? "").trim();
  const lang = cfg.language_code || cfg.lang || "hye";
  const hint = String(cfg.transliteration || cfg.romanization || "").trim();
  // Lessons before the alphabet is taught (the "Sounds:" chapters) mark
  // their exercises hideScript so the bubble headline is the romanized
  // hint, not the raw Armenian script — showing untaught letters as the
  // thing to read would contradict those lessons' own "you haven't
  // learned the letters yet" framing.
  const hideScript = !!cfg.hideScript;

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [showHint, setShowHint] = useState(false);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const silenceCleanupRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setRecording(false);
    setBusy(false);
    setTranscript("");
    setError("");
    setShowHint(false);
    let cancelled = false;
    // Auto-play the target word/phrase first, then start the mic once
    // playback finishes — the learner hears it before being asked to
    // repeat it, instead of having to tap 🔊 themselves. Sequenced (not
    // parallel) so the mic isn't actively recording while the TTS audio
    // is playing out loud, which risks it picking itself up.
    (async () => {
      const audio = await playTarget();
      if (cancelled) return;
      if (audio) {
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
          setTimeout(resolve, 4000); // fallback if playback is blocked/stalls
        });
      }
      if (!cancelled) startRec();
    })();
    return () => {
      cancelled = true;
      silenceCleanupRef.current?.();
      silenceCleanupRef.current = null;
      // Drop the onstop handler so leaving mid-recording doesn't fire a
      // transcribe request for an unmounted exercise, then release the mic
      // immediately — otherwise the recorder can outlive this component and
      // the browser's mic indicator stays lit after the learner has left.
      if (mrRef.current) {
        mrRef.current.onstop = null;
        try { mrRef.current.stop(); } catch {}
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  async function startRec() {
    setError("");
    setTranscript("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported in this browser.");
      return;
    }
    try {
      // Mono + noise suppression keeps the upload small and the transcript
      // cleaner — speech doesn't need stereo or a high bitrate, and a
      // smaller file both uploads and transcribes faster.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        silenceCleanupRef.current?.();
        silenceCleanupRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size) await transcribe(blob);
      };
      mrRef.current = mr;
      mr.start();
      setRecording(true);
      // Listens to the live stream and stops recording on its own once the
      // learner has spoken and gone quiet, instead of requiring a tap.
      silenceCleanupRef.current = attachSilenceAutoStop(stream, () => stopRec());
    } catch {
      setError("Microphone access was blocked.");
    }
  }

  function stopRec() {
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;
    try { mrRef.current?.stop(); } catch {}
    setRecording(false);
  }

  async function transcribe(blob) {
    setBusy(true);
    setError("");
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append("audio", blob, "speech.webm");
      if (lang) fd.append("language_code", lang);
      // Lets the backend route short (1-2 word) utterances to Azure and
      // full sentences to hispeech.ai — A/B tested against real Armenian
      // recordings in the CMS's STT Lab, neither provider wins both.
      const targetWordCount = target.trim().split(/\s+/).filter(Boolean).length;
      if (targetWordCount > 0) fd.append("word_count", String(targetWordCount));
      const res = await fetch(`${API_BASE}/me/exercises/transcribe`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) { setError("Couldn’t understand that — try again."); return; }
      const data = await res.json().catch(() => null);
      setTranscript(String(data?.text || "").trim());
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function playTarget() {
    if (!target) return null;
    try {
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text: target, exerciseId: exercise?.id });
      const a = newTrackedAudio(url);
      a.play();
      return a;
    } catch (e) {
      console.error("TTS failed", e);
      return null;
    }
  }

  const canCheck = !!transcript.trim() && !busy && !recording;

  return (
    <Card>
      <Title>{prompt}</Title>

      {/* Duolingo "Repeat after…" layout: speech bubble on top with a tail
          pointing down at the character standing beneath it. */}
      {target ? (
        <div className="mt-4 flex flex-col items-center">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-white/[0.05] dark:ring-white/[0.08]">
            <span
              aria-hidden="true"
              className="absolute -bottom-1.5 left-10 h-3.5 w-3.5 rotate-45 rounded-[3px] bg-slate-50 ring-1 ring-slate-200 dark:bg-white/[0.05] dark:ring-white/[0.08]"
            />
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={playTarget}
                aria-label="Listen"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 active:translate-y-0.5"
              >
                🔊
              </button>
              <div className="min-w-0 flex-1 text-xl font-extrabold text-slate-800 dark:text-white">
                {hideScript && hint ? hint : <GlossaryText text={target} glossary={cfg.glossary} />}
              </div>
              {hint && !hideScript ? (
                <button
                  type="button"
                  onClick={() => setShowHint((v) => !v)}
                  aria-label="Show pronunciation hint"
                  className="shrink-0 text-xs font-bold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:text-stone-500 dark:hover:text-stone-300"
                >
                  {showHint ? "Hide hint" : "Hint"}
                </button>
              ) : null}
            </div>
            {showHint && hint && !hideScript ? (
              <div className="mt-2 text-sm font-semibold text-slate-500 dark:text-stone-400">
                Sounds like: <span className="text-slate-700 dark:text-stone-200">{hint}</span>
              </div>
            ) : null}
          </div>
          <img
            src={mascotFaceUrl(mascotCharacter, "neutral")}
            alt=""
            aria-hidden="true"
            className="mt-2 h-28 w-28 object-contain sm:mt-3 sm:h-44 sm:w-44"
          />
        </div>
      ) : null}

      <div className="mt-3 flex flex-col items-center sm:mt-5">
        <button
          type="button"
          onClick={recording ? stopRec : startRec}
          disabled={busy}
          className={
            "relative grid h-16 w-16 place-items-center rounded-3xl text-white shadow-node transition active:translate-y-1 sm:h-20 sm:w-20 " +
            (recording ? "bg-cardinal-500" : busy ? "bg-slate-300" : "bg-brand-500")
          }
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {recording && (
            <>
              <span className="absolute inset-0 rounded-3xl bg-cardinal-400 animate-ping opacity-75" />
              <span className="absolute -inset-2 rounded-[1.75rem] ring-4 ring-cardinal-200" />
            </>
          )}
          <Mic className="relative h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
        </button>
        <div className="mt-2 text-sm font-bold text-slate-500">
          {recording ? "Listening…" : busy ? "Transcribing…" : "Tap the mic to speak"}
        </div>
      </div>

      {transcript ? (
        <div className="mt-3 rounded-2xl bg-feather-50 px-4 py-2.5 ring-1 ring-feather-100 sm:mt-5 sm:py-4 dark:bg-feather-500/10 dark:ring-feather-500/25">
          <div className="text-xs font-bold uppercase tracking-wide text-feather-600 dark:text-feather-300">We heard</div>
          <div className="mt-0.5 text-lg font-extrabold text-slate-800 dark:text-white">
            {hideScript ? translitArmenian(transcript) : transcript}
          </div>
        </div>
      ) : null}

      {transcript && target ? (
        <SpokenWordFeedback target={target} transcript={transcript} hideScript={hideScript} />
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div>
      ) : null}

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            // Strip all punctuation, collapse whitespace, lowercase.
            // Also normalise to NFD so Armenian composed/decomposed variants compare equal.
            const normalize = (s) =>
              s.normalize("NFD")
               .toLowerCase()
               .replace(/[^\p{L}\p{N}\s]/gu, "")
               .replace(/\s+/g, " ")
               .trim();
            const t = normalize(transcript);
            const g = normalize(target);
            // Levenshtein similarity: accept if ≥85 % of characters match.
            // Handles trailing punctuation from STT, minor phonetic differences, and
            // Unicode variant code points that look identical but differ by 1–2 chars.
            function similarity(a, b) {
              if (!a.length && !b.length) return 1;
              const m = a.length, n = b.length;
              let prev = Array.from({ length: n + 1 }, (_, j) => j);
              for (let i = 1; i <= m; i++) {
                const cur = [i];
                for (let j = 1; j <= n; j++) {
                  cur[j] = a[i - 1] === b[j - 1]
                    ? prev[j - 1]
                    : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
                }
                prev = cur;
              }
              return 1 - prev[n] / Math.max(m, n);
            }
            const ok = !!g && similarity(t, g) >= 0.85;
            if (ok) correct({ answerText: transcript });
            else wrong("Not quite — listen and try again.", { answerText: transcript });
          }}
        >
          Check
        </PrimaryButton>
        <button
          type="button"
          onClick={() => submit?.({ autoAdvance: true, xpEarned: 0 })}
          className="w-full text-center text-sm font-bold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          🔇 Can’t speak right now — skip
        </button>
      </FooterSlot>
    </Card>
  );
}

// H) listen_type — dictation: hear TTS audio, type what you heard
function ExListenType({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, apiBaseUrl, submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Type what you hear";
  const target = String(exercise?.expected_answer ?? cfg.ttsText ?? cfg.text ?? cfg.answer ?? "").trim();
  const accepted = Array.isArray(cfg.acceptedAnswers) ? cfg.acceptedAnswers : [];
  const hint = cfg.hint;

  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const didAutoplay = useRef(false);

  useEffect(() => {
    setValue("");
    didAutoplay.current = false;
  }, [exercise?.id]);

  async function play(rate = 1) {
    if (!target) return;
    try {
      setBusy(true);
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text: target, exerciseId: exercise?.id });
      const a = newTrackedAudio(url);
      a.playbackRate = rate;
      await a.play();
    } catch (e) {
      console.error("TTS failed", e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!exercise?.id || !target || didAutoplay.current) return;
    if (cfg?.autoplay === false) return;
    didAutoplay.current = true;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const canCheck = normalizeText(value).length > 0;

  return (
    <Card>
      <Title>{prompt}</Title>

      <div className="mt-3">
        <SpeechBubbleMascot
          character={mascotCharacter}
          text="Listen carefully…"
          onPlay={() => play(1)}
          onSlow={() => play(0.6)}
          busy={busy}
          playDisabled={!target}
        />
      </div>

      {hint ? <Muted className="mt-3">Hint: {hint}</Muted> : null}

      <div className="mt-4">
        <InlineInput value={value} onChange={setValue} placeholder="Type what you heard…" />
        <ArmenianKeyboard value={value} onChange={setValue} className="mt-3" />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            const t = normalizeText(value);
            const ok = [target, ...accepted].some((a) => {
              const na = normalizeText(a);
              return na && na === t;
            });
            if (ok) correct({ answerText: value });
            else wrong("Not quite — listen again and try.", { answerText: value });
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// I-b) listen_image — hear a word (TTS) and pick the matching picture. Pure
// listening→meaning, no text shown; pairs the Azure hy-AM voice with the
// emoji/photo tiles. Config: { ttsText, choices:[{emoji|image,label}], answerIndex }.
function ExListenImage({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, apiBaseUrl, submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Which one do you hear?";
  const target = String(exercise?.expected_answer ?? cfg.ttsText ?? cfg.text ?? "").trim();
  const items = Array.isArray(cfg.choices) ? cfg.choices : [];
  const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;

  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(null);
  const [busy, setBusy] = useState(false);
  const didAutoplay = useRef(false);

  useEffect(() => { setSel(null); setGraded(null); didAutoplay.current = false; }, [exercise?.id]);

  async function play(rate = 1) {
    if (!target) return;
    try {
      setBusy(true);
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text: target, exerciseId: exercise?.id });
      const a = newTrackedAudio(url); a.playbackRate = rate; await a.play();
    } catch (e) { console.error("TTS failed", e); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!exercise?.id || !target || didAutoplay.current) return;
    if (cfg?.autoplay === false) return;
    didAutoplay.current = true; play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  return (
    <Card>
      <Title>{prompt}</Title>
      <div className="mt-3">
        <SpeechBubbleMascot
          character={mascotCharacter}
          text="Tap 🔊 and choose the picture…"
          onPlay={() => play(1)}
          onSlow={() => play(0.6)}
          busy={busy}
          playDisabled={!target}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((it, idx) => {
          const active = sel === idx;
          const isRight = graded && idx === correctIndex;
          const isWrong = graded && active && idx !== correctIndex;
          return (
            <button
              key={idx}
              type="button"
              disabled={!!graded}
              onClick={() => setSel(idx)}
              className={cx(
                "overflow-hidden rounded-2xl ring-2 transition",
                isRight ? "ring-grass-400" : isWrong ? "ring-cardinal-400" : active ? "ring-brand-400" : "ring-slate-200 dark:ring-white/[0.08]"
              )}
            >
              <div className="grid aspect-square w-full place-items-center bg-slate-50 dark:bg-white/[0.04]">
                {it?.emoji
                  ? <span className="text-6xl leading-none sm:text-7xl">{it.emoji}</span>
                  : it?.image
                  ? <img src={exImgUrl(it.image)} alt={it?.label || ""} className="h-full w-full object-cover" />
                  : <span className="text-xs font-semibold text-slate-300 dark:text-stone-600">no image</span>}
              </div>
            </button>
          );
        })}
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={sel === null || !!graded}
          onClick={() => {
            setGraded({ correct: correctIndex, picked: sel });
            const it = items[sel] || {};
            const extra = { selectedIndices: [sel], answerText: it.label || it.emoji || "" };
            sel === correctIndex ? correct(extra) : wrong("Not quite — listen again.", extra);
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// I) word_bank — translate by tapping word tiles (with distractors)
function ExWordBank({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit, apiBaseUrl, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Translate this";
  const source = cfg.sentence ?? cfg.prompt ?? "";
  const tiles = Array.isArray(cfg.tiles) ? cfg.tiles : [];
  const solution = Array.isArray(cfg.solution) ? cfg.solution : [];
  // Voice the source only when it's the Armenian sentence being translated —
  // no point reading an English prompt aloud (config can force it off).
  const canHear = cfg.audio !== false && hasArmenian(source);

  const [picked, setPicked] = useState([]); // [{ t, key }]
  const [available, setAvailable] = useState([]);
  const [useKeyboard, setUseKeyboard] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const newWords = useNewWords(solution);

  async function play(rate = 1) {
    if (!canHear) return;
    try {
      setBusy(true);
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text: source, exerciseId: exercise?.id });
      const a = newTrackedAudio(url); a.playbackRate = rate; await a.play();
    } catch (e) { console.error("TTS failed", e); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    setPicked([]);
    setAvailable(tiles.map((t, i) => ({ t, key: `${i}-${t}` })));
    setTyped("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const built = useKeyboard ? typed : picked.map((p) => p.t).join(" ");
  const canCheck = useKeyboard ? normalizeText(typed).length > 0 : picked.length > 0;

  function add(idx) {
    const item = available[idx];
    if (!item) return;
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setPicked((p) => [...p, item]);
  }
  function remove(idx) {
    const item = picked[idx];
    if (!item) return;
    setPicked((p) => p.filter((_, i) => i !== idx));
    setAvailable((a) => [...a, item]);
  }

  return (
    <Card>
      <PromptTitle text={prompt} glossary={cfg.glossary} />

      {source ? (
        <div className="mt-4">
          <SpeechBubbleMascot
            character={mascotCharacter}
            text={<GlossaryText text={source} glossary={cfg.glossary} newWords={newWords} />}
            onPlay={canHear ? () => play(1) : undefined}
            onSlow={canHear ? () => play(0.6) : undefined}
            busy={busy}
            playDisabled={!canHear}
          />
        </div>
      ) : null}

      {useKeyboard ? (
        <div className="mt-4">
          <InlineInput value={typed} onChange={setTyped} placeholder="Type your answer…" />
          <ArmenianKeyboard value={typed} onChange={setTyped} className="mt-3" />
        </div>
      ) : (
        <>
          <div className="wordbank-lines mt-4 flex min-h-[7rem] flex-wrap content-start gap-x-2 gap-y-2 px-1">
            {picked.length === 0 ? (
              <Muted className="self-end pb-1">Tap words to build your answer…</Muted>
            ) : (
              picked.map((p, i) => (
                <Pill key={p.key} active className="tile-pop" onClick={() => remove(i)}>
                  {p.t}
                </Pill>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {available.map((p, i) => {
              const hint = cfg.glossary?.[p.t] || cfg.glossary?.[p.t?.toLowerCase()];
              const isNew = newWords.has(normWord(p.t));
              return (
                <Pill key={p.key} onClick={() => add(i)}>
                  <span className="flex items-center gap-1">
                    {p.t}
                    {hint ? (
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-100 text-[8px] font-extrabold text-brand-600" title={hint}>i</span>
                    ) : null}
                    {isNew ? (
                      <span className="text-[8px] font-black uppercase leading-none text-grass-600">new</span>
                    ) : null}
                  </span>
                </Pill>
              );
            })}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setUseKeyboard((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
      >
        {useKeyboard ? "🔤 Use the word bank" : "⌨️ Type with keyboard (harder)"}
      </button>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            const picks = useKeyboard ? built.trim().split(/\s+/) : picked.map((p) => p.t);
            const ok =
              solution.length === picks.length &&
              solution.every((v, i) => normalizeText(v) === normalizeText(picks[i]));
            const altOk = normalizeText(built) === normalizeText(solution.join(" "));
            if (ok || altOk) correct({ answerText: built });
            else wrong("Not quite — check the word order.", { answerText: built });
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// J) select_missing_word — complete the sentence (cloze multiple choice)
function ExSelectMissingWord({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Complete the sentence";
  const before = cfg.before ?? exercise?.sentence_before ?? "";
  const after = cfg.after ?? exercise?.sentence_after ?? "";
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const answerText = exercise?.expected_answer ?? cfg.answer ?? null;

  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(null);
  useEffect(() => { setSel(null); setGraded(null); }, [exercise?.id]);

  const canCheck = sel !== null;

  return (
    <Card>
      <Title>{prompt}</Title>

      <div className="mt-4">
        <SpeechBubbleMascot
          character={mascotCharacter}
          text={
            <>
              <GlossaryText text={before} glossary={cfg.glossary} />{" "}
              <span
                className={cx(
                  "rounded-lg px-2 py-1 ring-1",
                  sel !== null ? "bg-orange-50 text-orange-800 ring-orange-300" : "bg-white text-slate-400 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]"
                )}
              >
                {sel !== null ? (choices[sel] ?? "…") : "…"}
              </span>{" "}
              <GlossaryText text={after} glossary={cfg.glossary} />
            </>
          }
        />
      </div>

      <div className="mt-4">
        <ChoiceGrid choices={choices} selected={sel} onSelect={setSel} columns={1} graded={graded} />
      </div>

      <FooterSlot>
        <PrimaryButton
          disabled={!canCheck || !!graded}
          onClick={() => {
            const pick = choices[sel] ?? "";
            const extra = { selectedIndices: [sel], answerText: pick };
            const ci = correctIndex !== null ? correctIndex : choices.findIndex((c) => normalizeText(c) === normalizeText(answerText));
            setGraded({ correct: ci, picked: sel });
            if (correctIndex !== null) {
              sel === correctIndex ? correct(extra) : wrong("Not quite. Try again.", extra);
              return;
            }
            if (answerText && normalizeText(pick) === normalizeText(answerText)) correct(extra);
            else wrong("Not quite. Try again.", extra);
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

function exImgUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (s.startsWith("/static/") || s.startsWith("/uploads/")) return `${API_BASE}${s}`;
  return s;
}

// K) listen_word_bank — hear a sentence (TTS) and tap word tiles to rebuild it
function ExListenWordBank({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, apiBaseUrl, submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Tap what you hear";
  const target = String(cfg.ttsText ?? cfg.text ?? exercise?.expected_answer ?? "").trim();
  const tiles = Array.isArray(cfg.tiles) ? cfg.tiles : [];
  const solution = Array.isArray(cfg.solution) && cfg.solution.length ? cfg.solution : (target ? target.split(/\s+/) : []);

  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState([]);
  const didAutoplay = useRef(false);

  useEffect(() => {
    setPicked([]);
    setAvailable(tiles.map((t, i) => ({ t, key: `${i}-${t}` })));
    didAutoplay.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  async function play(rate = 1) {
    if (!target) return;
    try {
      setBusy(true);
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text: target, exerciseId: exercise?.id });
      const a = newTrackedAudio(url);
      a.playbackRate = rate;
      await a.play();
    } catch (e) {
      console.error("TTS failed", e);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!exercise?.id || !target || didAutoplay.current) return;
    if (cfg?.autoplay === false) return;
    didAutoplay.current = true;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const built = picked.map((p) => p.t).join(" ");
  function add(i) { const it = available[i]; if (!it) return; setAvailable((a) => a.filter((_, x) => x !== i)); setPicked((p) => [...p, it]); }
  function remove(i) { const it = picked[i]; if (!it) return; setPicked((p) => p.filter((_, x) => x !== i)); setAvailable((a) => [...a, it]); }

  return (
    <Card>
      <Title>{prompt}</Title>
      <div className="mt-3">
        <SpeechBubbleMascot
          character={mascotCharacter}
          text="Listen carefully…"
          onPlay={() => play(1)}
          onSlow={() => play(0.6)}
          busy={busy}
          playDisabled={!target}
        />
      </div>
      <div className="wordbank-lines mt-4 flex min-h-[7rem] flex-wrap content-start gap-x-2 gap-y-2 px-1">
        {picked.length === 0 ? <Muted className="self-end pb-1">Tap the words you heard…</Muted> : picked.map((p, i) => <Pill key={p.key} active className="tile-pop" onClick={() => remove(i)}>{p.t}</Pill>)}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">{available.map((p, i) => <Pill key={p.key} onClick={() => add(i)}>{p.t}</Pill>)}</div>
      <FooterSlot>
        <PrimaryButton disabled={picked.length === 0} onClick={() => {
          const picks = picked.map((p) => p.t);
          const ok = solution.length === picks.length && solution.every((v, i) => normalizeText(v) === normalizeText(picks[i]));
          const alt = normalizeText(built) === normalizeText(solution.join(" "));
          (ok || alt) ? correct({ answerText: built }) : wrong("Not quite — listen again.", { answerText: built });
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// L) dialogue_mcq — complete the conversation by choosing the missing reply
function ExDialogueMcq({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Complete the conversation";
  const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const answerText = exercise?.expected_answer ?? cfg.answer ?? null;
  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(null);
  useEffect(() => { setSel(null); setGraded(null); }, [exercise?.id]);

  return (
    <Card>
      <Title>{prompt}</Title>
      <div className="mt-4 space-y-2">
        {lines.map((l, i) => {
          const mine = l?.from === "you" || l?.from === "me";
          return (
            <div key={i} className={"flex " + (mine ? "justify-end" : "justify-start")}>
              <div className={"max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-semibold " + (mine ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-800 dark:bg-white/[0.06] dark:text-white")}>{l?.text}</div>
            </div>
          );
        })}
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300">
            {sel !== null ? (choices[sel] ?? "…") : "…"}
          </div>
        </div>
      </div>
      <div className="mt-4"><ChoiceGrid choices={choices} selected={sel} onSelect={setSel} columns={1} graded={graded} /></div>
      <FooterSlot>
        <PrimaryButton disabled={sel === null || !!graded} onClick={() => {
          const pick = choices[sel] ?? "";
          const extra = { selectedIndices: [sel], answerText: pick };
          const ci = correctIndex !== null ? correctIndex : choices.findIndex((c) => normalizeText(c) === normalizeText(answerText));
          setGraded({ correct: ci, picked: sel });
          if (correctIndex !== null) { sel === correctIndex ? correct(extra) : wrong("Not quite. Try again.", extra); return; }
          if (answerText && normalizeText(pick) === normalizeText(answerText)) correct(extra); else wrong("Not quite. Try again.", extra);
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// M) dialogue_order — arrange the conversation lines in the right order
function ExDialogueOrder({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Put the conversation in order";
  const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
  const solution = Array.isArray(cfg.solution) ? cfg.solution : [];
  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState([]);
  useEffect(() => {
    setPicked([]);
    setAvailable(lines.map((t, i) => ({ t, key: `${i}-${t}` })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);
  const built = picked.map((p) => p.t).join(" ");
  function add(i) { const it = available[i]; if (!it) return; setAvailable((a) => a.filter((_, x) => x !== i)); setPicked((p) => [...p, it]); }
  function remove(i) { const it = picked[i]; if (!it) return; setPicked((p) => p.filter((_, x) => x !== i)); setAvailable((a) => [...a, it]); }

  return (
    <Card>
      <Title>{prompt}</Title>
      <div className="mt-4 min-h-[3rem] space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
        {picked.length === 0 ? <Muted>Tap the lines in the right order…</Muted> : picked.map((p, i) => (
          <button key={p.key} type="button" onClick={() => remove(i)} className="tile-pop block w-full rounded-2xl bg-white px-4 py-2.5 text-left text-sm font-semibold text-slate-800 ring-1 ring-brand-200 dark:bg-white/[0.03] dark:text-white dark:ring-brand-500/40">{i + 1}. {p.t}</button>
        ))}
      </div>
      <div className="mt-4 space-y-2">{available.map((p, i) => (
        <button key={p.key} type="button" onClick={() => add(i)} className="block w-full rounded-2xl bg-white px-4 py-2.5 text-left text-sm font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-white/[0.03] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.06]">{p.t}</button>
      ))}</div>
      <FooterSlot>
        <PrimaryButton disabled={picked.length === 0} onClick={() => {
          const picks = picked.map((p) => p.t);
          const ok = solution.length === picks.length && solution.every((v, i) => normalizeText(v) === normalizeText(picks[i]));
          ok ? correct({ answerText: built }) : wrong("Not in order yet — try again.", { answerText: built });
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// N) image_select — pick the correct picture
function ExImageSelect({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Which one is it?";
  const items = Array.isArray(cfg.choices) ? cfg.choices : [];
  // ER-15: also check exercise.options for correct answer when cfg.answerIndex absent
  const correctIndex = Number.isFinite(cfg.answerIndex)
    ? Number(cfg.answerIndex)
    : (items.findIndex((o) => o?.is_correct) >= 0
        ? items.findIndex((o) => o?.is_correct)
        : (exercise?.options?.findIndex((o) => o?.is_correct) ?? -1));
  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(false);
  useEffect(() => { setSel(null); setGraded(false); }, [exercise?.id]);

  return (
    <Card>
      <Title>{prompt}</Title>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {items.map((it, i) => {
          const active = sel === i;
          const isCorrect = graded && i === correctIndex;
          const isWrongPick = graded && active && i !== correctIndex;
          const ring = isCorrect
            ? "ring-grass-500"
            : isWrongPick
            ? "ring-cardinal-500"
            : active
            ? "ring-brand-400"
            : "ring-slate-200 hover:ring-brand-300 dark:ring-white/[0.08]";
          return (
            <button key={i} type="button" disabled={graded} onClick={() => setSel(i)}
              className={"overflow-hidden rounded-2xl ring-2 transition " + ring + (graded ? " pointer-events-none" : "")}>
              <div className="grid aspect-square w-full place-items-center bg-slate-50 dark:bg-white/[0.04]">
                {it?.emoji
                  ? <span className="text-6xl leading-none sm:text-7xl">{it.emoji}</span>
                  : it?.image
                  ? <img src={exImgUrl(it.image)} alt={it?.label || ""} className="h-full w-full object-cover" />
                  : <span className="text-xs font-semibold text-slate-300 dark:text-stone-600">no image</span>}
              </div>
              {/* Labels are hidden for picture-select (they'd give the answer);
                  only shown when a choice deliberately carries a caption. */}
              {it?.label && !it?.emoji ? <div className={"px-2 py-1.5 text-center text-sm font-bold " + (active ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "text-slate-700 dark:text-stone-200")}>{it.label}</div> : null}
            </button>
          );
        })}
      </div>
      <FooterSlot>
        <PrimaryButton disabled={sel === null || graded} onClick={() => {
          const it = items[sel] || {};
          const extra = { selectedIndices: [sel], answerText: it.label || it.emoji || "" };
          setGraded(true);
          (correctIndex >= 0 && sel === correctIndex) ? correct(extra) : wrong("Not quite. Try again.", extra);
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// O) reading_comprehension — read a passage, answer a question
function ExReadingComprehension({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Read and answer";
  const passage = cfg.passage ?? cfg.text ?? "";
  const question = cfg.question ?? "";
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(null);
  useEffect(() => { setSel(null); setGraded(null); }, [exercise?.id]);

  return (
    <Card>
      <Title>{prompt}</Title>
      {passage ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-base leading-relaxed text-slate-800 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08]">{passage}</div> : null}
      {question ? <div className="mt-4 font-display text-lg font-extrabold text-slate-800 dark:text-white">{question}</div> : null}
      <div className="mt-3"><ChoiceGrid choices={choices} selected={sel} onSelect={setSel} columns={1} graded={graded} /></div>
      <FooterSlot>
        <PrimaryButton disabled={sel === null || !!graded} onClick={() => {
          const pick = choices[sel] ?? "";
          const extra = { selectedIndices: [sel], answerText: pick };
          setGraded({ correct: correctIndex, picked: sel });
          (correctIndex !== null && sel === correctIndex) ? correct(extra) : wrong("Not quite — re-read the passage.", extra);
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// P) minimal_pairs — "which word did you hear?"
const _MINIMAL_PAIRS_BUBBLES = [
  "Listen carefully…", "Tune your ear!", "What do you hear?", "New sound incoming!", "Here it comes…",
];

function ExMinimalPairs({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, apiBaseUrl, submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Which word did you hear?";
  const target = String(cfg.ttsText ?? cfg.text ?? "").trim();
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const emoji = cfg.emoji ?? "";
  const meaning = cfg.meaning ?? "";
  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(null);
  const [busy, setBusy] = useState(false);
  const didAutoplay = useRef(false);
  useEffect(() => { setSel(null); setGraded(null); didAutoplay.current = false; }, [exercise?.id]);
  const bubbleText = _MINIMAL_PAIRS_BUBBLES[Number(exercise?.id ?? 0) % _MINIMAL_PAIRS_BUBBLES.length];

  async function play(rate = 1) {
    if (!target) return;
    try {
      setBusy(true);
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text: target, exerciseId: exercise?.id });
      const a = newTrackedAudio(url);
      a.playbackRate = rate;
      await a.play();
    } catch (e) { console.error("TTS failed", e); } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!exercise?.id || !target || didAutoplay.current) return;
    if (cfg?.autoplay === false) return;
    didAutoplay.current = true;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  return (
    <Card>
      <Title>{prompt}</Title>
      <div className="mt-3">
        <SpeechBubbleMascot
          character={mascotCharacter}
          text={bubbleText}
          onPlay={() => play(1)}
          onSlow={() => play(0.6)}
          busy={busy}
          playDisabled={!target}
        />
      </div>
      <div className="mt-4"><ChoiceGrid choices={choices} selected={sel} onSelect={setSel} columns={2} graded={graded} /></div>
      {graded && emoji ? (
        <div className="animate-pop mt-4 flex items-center gap-2 rounded-xl bg-feather-50 px-4 py-3 ring-1 ring-feather-100 dark:bg-feather-500/10 dark:ring-feather-500/25">
          <span className="text-2xl">{emoji}</span>
          <span className="text-sm font-semibold text-feather-700 dark:text-feather-300">
            You just heard the word for “{meaning}”!
          </span>
        </div>
      ) : null}
      <FooterSlot>
        <PrimaryButton disabled={sel === null || !!graded} onClick={() => {
          const pick = choices[sel] ?? "";
          const extra = { selectedIndices: [sel], answerText: pick };
          setGraded({ correct: correctIndex, picked: sel });
          (correctIndex !== null && sel === correctIndex) ? correct(extra) : wrong("Not quite — listen again.", extra);
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// Q) flashcard — active recall: flip the card, then continue (info-style)
function ExFlashcard({ exercise, cfg, submit }) {
  const front = cfg.front ?? exercise?.prompt ?? "";
  const back = cfg.back ?? cfg.translation ?? "";
  const hint = cfg.hint ?? cfg.transliteration ?? "";
  const emoji = cfg.emoji ?? "";
  // A "meet the word" intro card (picture + audio + word + meaning, no flip)
  // whenever the card carries audio or a picture; otherwise the classic
  // tap-to-flip memory card.
  const audioText = cfg.audioText ?? "";
  const isIntro = !!audioText || !!emoji;

  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const didAutoplay = useRef(false);
  useEffect(() => { setFlipped(false); didAutoplay.current = false; }, [exercise?.id]);

  async function play() {
    const text = audioText || front;
    if (!text) return;
    try {
      setBusy(true);
      const url = await ttsFetch(API_BASE, { text, exerciseId: exercise?.id, targetKey: "word" });
      newTrackedAudio(url).play();
    } catch (e) { console.error("TTS failed", e); } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!isIntro || didAutoplay.current || !exercise?.id) return;
    didAutoplay.current = true;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  if (isIntro) {
    return (
      <Card>
        <Title>New word</Title>
        <button
          type="button"
          onClick={play}
          aria-label="Hear the word"
          className="animate-pop mt-5 grid min-h-[13rem] w-full place-items-center gap-2 rounded-3xl bg-gradient-to-br from-brand-50 to-white px-6 py-8 text-center ring-2 ring-brand-100 transition active:scale-[0.99] dark:from-brand-500/10 dark:to-white/[0.03] dark:ring-brand-500/30"
        >
          {emoji ? <span className="text-7xl leading-none sm:text-8xl">{emoji}</span> : null}
          <span className="flex items-center gap-2">
            <span className={"grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-white " + (busy ? "animate-pulse" : "")}>🔊</span>
            <span className="font-display text-3xl font-extrabold text-slate-800 dark:text-white">{front}</span>
          </span>
          {hint ? <span className="text-sm font-semibold text-slate-500 dark:text-stone-400">{hint}</span> : null}
          {back ? <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{back}</span> : null}
        </button>
        <FooterSlot>
          <PrimaryButton onClick={() => submit?.({ isCorrect: true, autoAdvance: true, xpEarned: 0 })}>Continue</PrimaryButton>
        </FooterSlot>
      </Card>
    );
  }

  return (
    <Card>
      <Title>{exercise?.prompt && cfg.front ? exercise.prompt : "Do you remember this?"}</Title>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="mt-5 grid min-h-[10rem] w-full place-items-center rounded-3xl bg-gradient-to-br from-brand-50 to-white px-6 py-8 text-center ring-2 ring-brand-100 transition active:scale-[0.99] dark:from-brand-500/10 dark:to-white/[0.03] dark:ring-brand-500/30"
      >
        <div className="font-display text-3xl font-extrabold text-slate-800 dark:text-white">{flipped ? back : front}</div>
        <div className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">{flipped ? "answer" : "tap to flip"}</div>
        {flipped && hint ? <div className="mt-2 text-sm font-semibold text-slate-500 dark:text-stone-400">{hint}</div> : null}
      </button>
      <FooterSlot>
        <PrimaryButton onClick={() => submit?.({ isCorrect: true, autoAdvance: true, xpEarned: 0 })}>Continue</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// R) categorize — sort each word into the right bucket
function ExCategorize({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Sort each into the right group";
  const buckets = Array.isArray(cfg.buckets) ? cfg.buckets : [];
  const items = Array.isArray(cfg.items) ? cfg.items : [];

  // ER-16: use item index (not text) as key to avoid collisions with duplicate texts
  // assign: { [itemIndex]: bucketName, __activeIdx: number | null }
  const [assign, setAssign] = useState({}); // itemIndex (string) -> bucket
  useEffect(() => setAssign({}), [exercise?.id]);

  const unassignedIndices = items.map((_, i) => i).filter((i) => !(String(i) in assign));
  const allDone = items.length > 0 && unassignedIndices.length === 0;
  const activeIdx = assign.__activeIdx ?? null;

  return (
    <Card>
      <Title>{prompt}</Title>

      {/* unassigned chips */}
      <div className="mt-4 flex min-h-[3rem] flex-wrap gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
        {unassignedIndices.length === 0 ? <Muted>All sorted — tap Check.</Muted> : unassignedIndices.map((i) => (
          <Pill key={i} onClick={() => {
            setAssign((a) => ({ ...a, __activeIdx: i }));
          }} active={activeIdx === i}>{items[i].text}</Pill>
        ))}
      </div>

      {/* buckets */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {buckets.map((b) => {
          const inBucketIndices = Object.entries(assign).filter(([k, v]) => k !== '__activeIdx' && v === b).map(([k]) => Number(k));
          return (
            <button
              key={b}
              type="button"
              onClick={() => {
                if (activeIdx === null) return;
                setAssign((a) => { const n = { ...a, [String(activeIdx)]: b }; delete n.__activeIdx; return n; });
              }}
              className="rounded-2xl bg-white p-3 text-left ring-2 ring-slate-200 transition hover:ring-brand-300 dark:bg-white/[0.03] dark:ring-white/[0.08] dark:hover:ring-brand-500/40"
            >
              <div className="font-display text-sm font-extrabold text-slate-800 dark:text-white">{b}</div>
              <div className="mt-2 flex min-h-[2rem] flex-wrap gap-1.5">
                {inBucketIndices.length === 0 ? <span className="text-xs font-semibold text-slate-300 dark:text-stone-600">tap a word, then this group</span> : inBucketIndices.map((i) => (
                  <span key={i} onClick={(e) => { e.stopPropagation(); setAssign((a) => { const n = { ...a }; delete n[String(i)]; return n; }); }}
                    className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">{items[i].text} ✕</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <FooterSlot>
        <PrimaryButton disabled={!allDone} onClick={() => {
          // ER-16: use index-keyed assign to correctly evaluate duplicate-text items
          const built = items.map((it, i) => ({ text: it.text, bucket: assign[String(i)] }));
          const ok = items.every((it, i) => normalizeText(assign[String(i)]) === normalizeText(it.bucket));
          ok ? correct({ answerText: JSON.stringify(built) }) : wrong("Not quite — check your groups.", { answerText: JSON.stringify(built) });
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// S) highlight_grammar — tap the word(s) that match the rule
function ExHighlightGrammar({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Tap the right word(s)";
  const tokens = Array.isArray(cfg.tokens) ? cfg.tokens : [];
  const correctIdx = (Array.isArray(cfg.correctIndices) ? cfg.correctIndices : []).map(Number);

  const [picked, setPicked] = useState(new Set());
  const [graded, setGraded] = useState(false);
  useEffect(() => { setPicked(new Set()); setGraded(false); }, [exercise?.id]);

  function toggle(i) {
    if (graded) return;
    setPicked((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }

  return (
    <Card>
      <Title>{prompt}</Title>
      <div className="mt-5 flex flex-wrap gap-2">
        {tokens.map((t, i) => {
          const on = picked.has(i);
          const isCorrect = graded && correctIdx.includes(i);
          const isWrong = graded && on && !correctIdx.includes(i);
          return (
            <button key={i} type="button" onClick={() => toggle(i)}
              className={cx(
                "rounded-2xl px-4 py-2.5 text-lg font-bold ring-2 transition",
                isCorrect ? "bg-grass-50 text-grass-700 ring-grass-400 dark:bg-grass-500/15 dark:text-grass-300 dark:ring-grass-500/40" : isWrong ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-400 dark:bg-cardinal-500/15 dark:text-cardinal-300 dark:ring-cardinal-500/40" : on ? "bg-feather-50 text-feather-700 ring-feather-400 dark:bg-feather-500/15 dark:text-feather-300 dark:ring-feather-500/40" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.06]"
              )}>{t}</button>
          );
        })}
      </div>
      <FooterSlot>
        <PrimaryButton disabled={picked.size === 0 || graded} onClick={() => {
          const sel = Array.from(picked).sort((a, b) => a - b);
          const target = [...correctIdx].sort((a, b) => a - b);
          const ok = sel.length === target.length && sel.every((v, i) => v === target[i]);
          setGraded(true);
          ok ? correct({ selectedIndices: sel, answerText: sel.map((i) => tokens[i]).join(", ") })
             : wrong("Not quite — tap again.", { selectedIndices: sel, answerText: sel.map((i) => tokens[i]).join(", ") });
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// T) conjugation — fill the verb paradigm
function ExConjugation({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Complete the forms";
  const verb = cfg.verb ?? "";
  const cells = Array.isArray(cfg.cells) ? cfg.cells : [];

  const [vals, setVals] = useState([]);
  useEffect(() => setVals(cells.map(() => "")), [exercise?.id]);

  const canCheck = vals.length === cells.length && vals.every((v) => normalizeText(v).length > 0);

  return (
    <Card>
      <Title>{prompt}</Title>
      {verb ? <Muted className="mt-2">Verb: <span className="font-extrabold text-slate-800 dark:text-white">{verb}</span></Muted> : null}
      <div className="mt-4 space-y-2">
        {cells.map((c, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-sm font-extrabold text-slate-600 dark:text-stone-300">{c.label}</div>
            <input
              value={vals[i] ?? ""}
              onChange={(e) => setVals((arr) => arr.map((v, x) => (x === i ? e.target.value : v)))}
              placeholder="…"
              className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 font-bold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:outline-none focus:ring-brand-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
            />
          </div>
        ))}
      </div>
      <FooterSlot>
        <PrimaryButton disabled={!canCheck} onClick={() => {
          const ok = cells.every((c, i) => normalizeText(vals[i]) === normalizeText(c.answer));
          const extra = { answerText: JSON.stringify(vals) };
          ok ? correct(extra) : wrong("Some forms are off — try again.", extra);
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// U) speak_line — say your line in a conversation
function ExSpeakLine({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, apiBaseUrl, submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Say your line";
  const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
  const target = String(exercise?.expected_answer ?? cfg.target ?? cfg.answer ?? "").trim();
  const lang = cfg.language_code || cfg.lang || "hye";
  const hint = String(cfg.transliteration || cfg.romanization || "").trim();
  const hideScript = !!cfg.hideScript; // see ExSpeak — pre-alphabet lessons only

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [showHint, setShowHint] = useState(false);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const silenceCleanupRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setRecording(false); setBusy(false); setTranscript(""); setError(""); setShowHint(false);
    let cancelled = false;
    // Auto-play the line first, then start the mic once playback finishes
    // — see ExSpeak's effect for why this is sequenced, not parallel.
    (async () => {
      const audio = await playLine(target);
      if (cancelled) return;
      if (audio) {
        await new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
          setTimeout(resolve, 4000);
        });
      }
      if (!cancelled) startRec();
    })();
    return () => {
      cancelled = true;
      silenceCleanupRef.current?.();
      silenceCleanupRef.current = null;
      // See ExSpeak's cleanup for why: drop onstop so an unmount mid-
      // recording doesn't transcribe into nowhere, then release the mic
      // immediately so it doesn't stay lit after the learner leaves.
      if (mrRef.current) {
        mrRef.current.onstop = null;
        try { mrRef.current.stop(); } catch {}
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  async function startRec() {
    setError(""); setTranscript("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Recording isn't supported here."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        silenceCleanupRef.current?.();
        silenceCleanupRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size) await transcribe(blob);
      };
      mrRef.current = mr; mr.start(); setRecording(true);
      silenceCleanupRef.current = attachSilenceAutoStop(stream, () => stopRec());
    } catch { setError("Microphone access was blocked."); }
  }
  function stopRec() {
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;
    try { mrRef.current?.stop(); } catch {}
    setRecording(false);
  }
  async function transcribe(blob) {
    setBusy(true); setError("");
    try {
      const token = getToken();
      const fd = new FormData(); fd.append("audio", blob, "speech.webm"); if (lang) fd.append("language_code", lang);
      // Lets the backend route short (1-2 word) utterances to Azure and
      // full sentences to hispeech.ai — A/B tested in the CMS's STT Lab.
      const targetWordCount = target.trim().split(/\s+/).filter(Boolean).length;
      if (targetWordCount > 0) fd.append("word_count", String(targetWordCount));
      const res = await fetch(`${API_BASE}/me/exercises/transcribe`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      if (!res.ok) { setError("Couldn’t understand that — try again."); return; }
      const data = await res.json().catch(() => null);
      setTranscript(String(data?.text || "").trim());
    } catch { setError("Network error. Try again."); } finally { setBusy(false); }
  }
  async function playLine(text) {
    if (!text) return null;
    try {
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text, exerciseId: exercise?.id });
      const a = newTrackedAudio(url);
      a.play();
      return a;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  const canCheck = !!transcript.trim() && !busy && !recording;

  return (
    <Card>
      <Title>{prompt}</Title>
      <div className="mt-4 space-y-2">
        {lines.map((l, i) => {
          const mine = l?.from === "you" || l?.from === "me";
          return (
            <div key={i} className={"flex " + (mine ? "justify-end" : "justify-start")}>
              <div className={"max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-semibold " + (mine ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-800 dark:bg-white/[0.06] dark:text-white")}>{l?.text}</div>
            </div>
          );
        })}
      </div>

      {target ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">Your line</div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">{hideScript && hint ? hint : target}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              {hint && !hideScript ? (
                <button type="button" onClick={() => setShowHint((v) => !v)} className="btn3d btn3d-neutral text-sm" aria-label="Show pronunciation hint">
                  💬 {showHint ? "Hide" : "Hint"}
                </button>
              ) : null}
              <button type="button" onClick={() => playLine(target)} className="btn3d btn3d-neutral text-sm">🔊 Listen</button>
            </div>
          </div>
          {showHint && hint && !hideScript ? (
            <div className="mt-3 text-sm font-semibold text-slate-500 dark:text-stone-400">
              Sounds like: <span className="text-slate-700 dark:text-stone-200">{hint}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col items-center sm:mt-5">
        <button type="button" onClick={recording ? stopRec : startRec} disabled={busy}
          className={"relative grid h-16 w-16 place-items-center rounded-3xl text-white shadow-node transition active:translate-y-1 sm:h-20 sm:w-20 " + (recording ? "bg-cardinal-500" : busy ? "bg-slate-300" : "bg-brand-500")}
          aria-label={recording ? "Stop" : "Record"}>
          {recording && (
            <>
              <span className="absolute inset-0 rounded-3xl bg-cardinal-400 animate-ping opacity-75" />
              <span className="absolute -inset-2 rounded-[1.75rem] ring-4 ring-cardinal-200" />
            </>
          )}
          <Mic className="relative h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
        </button>
        <div className="mt-2 text-sm font-bold text-slate-500">{recording ? "Listening…" : busy ? "Transcribing…" : "Tap the mic to speak"}</div>
      </div>

      {transcript ? (
        <div className="mt-3 rounded-2xl bg-feather-50 px-4 py-2.5 ring-1 ring-feather-100 sm:mt-5 sm:py-4 dark:bg-feather-500/10 dark:ring-feather-500/25">
          <div className="text-xs font-bold uppercase tracking-wide text-feather-600 dark:text-feather-300">We heard</div>
          <div className="mt-0.5 text-lg font-extrabold text-slate-800 dark:text-white">
            {hideScript ? translitArmenian(transcript) : transcript}
          </div>
        </div>
      ) : null}

      {transcript && target ? (
        <SpokenWordFeedback target={target} transcript={transcript} hideScript={hideScript} />
      ) : null}
      {error ? <div className="mt-3 rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div> : null}

      <FooterSlot>
        <PrimaryButton disabled={!canCheck} onClick={() => {
          // ER-10: remove substring match — require normalized exact equality only
          // Normalize to NFD first (matches ExSpeak) so visually-identical Armenian
          // text in different Unicode composition forms (STT output vs. stored
          // target) doesn't fail a byte-level equality check.
          const normalize = (s) => s.normalize("NFD").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
          const t = normalize(transcript); const g = normalize(target);
          const ok = !!g && t === g;
          ok ? correct({ answerText: transcript }) : wrong("Not quite — listen and try again.", { answerText: transcript });
        }}>Check</PrimaryButton>
        <button
          type="button"
          onClick={() => submit?.({ autoAdvance: true, xpEarned: 0 })}
          className="w-full text-center text-sm font-bold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
        >
          🔇 Can’t speak right now — skip
        </button>
      </FooterSlot>
    </Card>
  );
}

// V-1) trace_letter — handwrite an Armenian letter over a faint guide. Grades by
// pixel overlap against the glyph rendered in the app font, so it needs NO
// authored stroke-path data — every one of the 39 letters works from just the
// character. The single biggest week-one barrier for a non-Latin script.
const _TRACE_FONT = 'bold {S}px "Baloo 2","Noto Sans Armenian",ui-sans-serif,system-ui,sans-serif';
function ExTraceLetter({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit, apiBaseUrl }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const letter = String(cfg.letter ?? cfg.char ?? exercise?.prompt ?? "").trim();
  const romanization = cfg.romanization ?? cfg.roman ?? "";
  const audioText = cfg.audioText ?? letter;
  const SIZE = 300;
  const glyphFont = _TRACE_FONT.replace("{S}", String(Math.round(SIZE * 0.72)));

  const drawRef = useRef(null);
  const ghostRef = useRef(null);
  const audioRef = useRef(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  useEffect(() => {
    const r = dpr();
    [drawRef, ghostRef].forEach((ref) => {
      const c = ref.current; if (!c) return;
      c.width = SIZE * r; c.height = SIZE * r;
      const ctx = c.getContext("2d"); ctx.setTransform(r, 0, 0, r, 0, 0);
    });
    const paintGhost = () => {
      const g = ghostRef.current?.getContext("2d"); if (!g) return;
      g.clearRect(0, 0, SIZE, SIZE);
      g.fillStyle = "rgba(120,120,120,0.20)";
      g.textAlign = "center"; g.textBaseline = "middle"; g.font = glyphFont;
      g.fillText(letter, SIZE / 2, SIZE / 2 + SIZE * 0.02);
    };
    drawRef.current?.getContext("2d").clearRect(0, 0, SIZE, SIZE);
    setDirty(false);
    paintGhost();
    // repaint once webfonts settle so the guide matches the grading mask
    if (document.fonts?.ready) document.fonts.ready.then(paintGhost);
  }, [exercise?.id, letter]); // eslint-disable-line

  const at = (e) => {
    const rect = drawRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };
  const stroke = (x, y, down) => {
    const ctx = drawRef.current.getContext("2d");
    if (down) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineWidth = 26; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#e07b39"; }
    ctx.lineTo(x, y); ctx.stroke();
  };
  const onDown = (e) => { e.preventDefault(); drawing.current = true; const { x, y } = at(e); stroke(x, y, true); stroke(x + 0.01, y + 0.01, false); setDirty(true); };
  const onMove = (e) => { if (!drawing.current) return; e.preventDefault(); const { x, y } = at(e); stroke(x, y, false); };
  const onUp = () => { drawing.current = false; };
  const clear = () => { drawRef.current.getContext("2d").clearRect(0, 0, SIZE, SIZE); setDirty(false); };

  async function play() {
    try {
      const res = await fetch(`${apiBaseUrl || ""}/tts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: audioText }) });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.play().catch(() => {}); }
    } catch {}
  }

  function grade() {
    const r = dpr(); const W = SIZE * r, H = SIZE * r;
    const m = document.createElement("canvas"); m.width = W; m.height = H;
    const mc = m.getContext("2d"); mc.setTransform(r, 0, 0, r, 0, 0);
    mc.fillStyle = "#000"; mc.textAlign = "center"; mc.textBaseline = "middle"; mc.font = glyphFont;
    mc.fillText(letter, SIZE / 2, SIZE / 2 + SIZE * 0.02);
    const mData = mc.getImageData(0, 0, W, H).data;
    const dData = drawRef.current.getContext("2d").getImageData(0, 0, W, H).data;
    let maskN = 0, drawN = 0, covered = 0;
    for (let i = 3; i < mData.length; i += 4) {
      const mm = mData[i] > 60, dd = dData[i] > 30;
      if (mm) maskN++;
      if (dd) drawN++;
      if (mm && dd) covered++;
    }
    if (maskN === 0) { correct({ answerText: `trace:${letter}` }); return; } // font missing — don't punish
    const coverage = covered / maskN;
    const drawnRatio = drawN / maskN;
    const ok = coverage >= 0.55 && drawnRatio <= 2.6;
    ok
      ? correct({ answerText: `trace:${letter}` })
      : wrong(coverage < 0.55 ? "Trace over the whole letter." : "Stay on the letter — don't scribble.", { answerText: `trace:${letter}` });
  }

  return (
    <Card>
      <Title>Trace the letter</Title>
      <div className="mt-1 flex items-center justify-center gap-3">
        <span className="font-display text-3xl font-black text-slate-800 dark:text-white">{letter}</span>
        {romanization ? <span className="font-bold text-slate-400 dark:text-stone-500">/{romanization}/</span> : null}
        <button type="button" onClick={play} className="grid h-9 w-9 place-items-center rounded-full bg-feather-50 text-feather-600 ring-1 ring-feather-200 transition active:scale-95 dark:bg-feather-500/15 dark:text-feather-400 dark:ring-feather-500/20" aria-label="Play sound">🔊</button>
      </div>
      <div className="relative mx-auto mt-4" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
        <canvas ref={ghostRef} style={{ position: "absolute", inset: 0, width: SIZE, height: SIZE }} className="rounded-3xl bg-slate-50 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]" />
        <canvas ref={drawRef} style={{ position: "absolute", inset: 0, width: SIZE, height: SIZE, touchAction: "none", cursor: "crosshair" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
      </div>
      <div className="mt-2 text-center">
        <button type="button" onClick={clear} className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300">Clear</button>
      </div>
      <audio ref={audioRef} className="hidden" />
      <FooterSlot>
        <PrimaryButton disabled={!dirty} onClick={grade}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// V0) inflect — produce the inflected form of a base word (case / tense /
// person / definiteness). The core morphology drill: shows a base word and a
// grammatical target, learner types the transformed form. Grades against the
// expected form + accepted variants; on a miss it reveals the correct form so
// the drill teaches, not just tests.
function ExInflect({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Change the word to the form shown";
  const base = cfg.base ?? cfg.word ?? "";
  const baseGloss = cfg.baseGloss ?? cfg.gloss ?? "";
  const target = cfg.target ?? cfg.form ?? cfg.instruction ?? "";
  const targetGloss = cfg.targetGloss ?? "";
  const accepted = [
    String(exercise?.expected_answer ?? "").trim(),
    String(cfg.answer ?? "").trim(),
    ...(Array.isArray(cfg.acceptedAnswers) ? cfg.acceptedAnswers : []),
    ...(Array.isArray(cfg.answers) ? cfg.answers : []),
  ].filter(Boolean);
  const correctForm = accepted[0] || "";

  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [exercise?.id]);
  const canCheck = normalizeText(value).length > 0;

  const check = () => {
    const t = normalizeText(value);
    const ok = accepted.some((a) => normalizeText(a) === t);
    ok
      ? correct({ answerText: value })
      : wrong(correctForm ? `The correct form is «${correctForm}».` : "Not quite.", { answerText: value });
  };

  return (
    <Card>
      <Title>{prompt}</Title>

      {/* base → target transform header */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-center">
        <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
          <div className="font-display text-2xl font-extrabold text-slate-800 dark:text-white">{base}</div>
          {baseGloss ? <div className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-stone-500">{baseGloss}</div> : null}
        </div>
        <span className="text-2xl font-black text-brand-400">→</span>
        <div className="rounded-2xl border-2 border-dashed border-brand-300 px-4 py-3 dark:border-brand-500/40">
          <div className="text-sm font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">{target || "?"}</div>
          {targetGloss ? <div className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-stone-500">{targetGloss}</div> : null}
        </div>
      </div>

      <div className="mt-5">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canCheck) check(); }}
          placeholder="Type the form…"
          autoComplete="off" autoCorrect="off" spellCheck={false}
          className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-center text-xl font-extrabold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-base placeholder:font-semibold placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
        />
        <ArmenianKeyboard value={value} onChange={setValue} className="mt-3" />
      </div>

      <FooterSlot>
        <PrimaryButton disabled={!canCheck} onClick={check}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// V) write_translate — open-ended writing (graded vs accepted answers)
function ExWriteTranslate({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, submit, mascotCharacter = "armen" }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "Write your answer";
  const source = cfg.source ?? cfg.sentence ?? "";
  const accepted = [
    String(exercise?.expected_answer ?? "").trim(),
    ...(Array.isArray(cfg.acceptedAnswers) ? cfg.acceptedAnswers : []),
    ...(Array.isArray(cfg.answers) ? cfg.answers : []),
  ].filter(Boolean);
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [exercise?.id]);
  const canCheck = normalizeText(value).length > 0;

  return (
    <Card>
      <Title>{prompt}</Title>
      {source ? (
        <div className="mt-4">
          <SpeechBubbleMascot
            character={mascotCharacter}
            text={<GlossaryText text={source} glossary={cfg.glossary} />}
          />
        </div>
      ) : null}
      <div className="mt-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Write your translation…"
          rows={3}
          className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-lg font-bold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:font-semibold placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
        />
        <ArmenianKeyboard value={value} onChange={setValue} className="mt-3" />
      </div>
      <FooterSlot>
        <PrimaryButton disabled={!canCheck} onClick={() => {
          const t = normalizeText(value);
          const ok = accepted.some((a) => normalizeText(a) === t);
          ok ? correct({ answerText: value }) : wrong("Not an accepted answer — check spelling & word order.", { answerText: value });
        }}>Check</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// W) story — a short narrated dialogue (chat bubbles, audio + tappable words
// per line) followed by a comprehension question. A "Stories-lite": context and
// listening/reading together, graded on understanding. Config:
// { title?, lines:[{speaker, text, translation}], question, choices, answerIndex }
function ExStory({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, apiBaseUrl, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const title = cfg.title || exercise?.prompt || "Read the story";
  const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
  const question = cfg.question || "";
  const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
  const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;

  // First distinct speaker sits on the left, the next on the right (chat style).
  const speakers = [];
  lines.forEach((l) => { const s = l?.speaker || ""; if (!speakers.includes(s)) speakers.push(s); });

  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(null);
  const [busyIdx, setBusyIdx] = useState(-1);
  useEffect(() => { setSel(null); setGraded(null); }, [exercise?.id]);

  async function playLine(i) {
    const text = lines[i]?.text; if (!text) return;
    try {
      setBusyIdx(i);
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text, exerciseId: exercise?.id });
      const a = newTrackedAudio(url); await a.play();
    } catch (e) { console.error("TTS failed", e); }
    finally { setBusyIdx(-1); }
  }

  return (
    <Card>
      <Title>{title}</Title>

      <div className="mt-4 space-y-3">
        {lines.map((l, i) => {
          const right = speakers.indexOf(l?.speaker || "") === 1;
          return (
            <div key={i} className={cx("flex", right ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-2xl px-4 py-3 ring-1",
                right ? "bg-brand-50 ring-brand-100 dark:bg-brand-500/10 dark:ring-brand-500/25"
                      : "bg-slate-50 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]")}>
                {l?.speaker ? (
                  <div className="mb-0.5 flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">{l.speaker}</span>
                    <button type="button" onClick={() => playLine(i)} disabled={busyIdx === i}
                      className="grid h-6 w-6 place-items-center rounded-full text-feather-500 hover:bg-feather-50 disabled:opacity-50 dark:hover:bg-feather-500/15" aria-label="Play line">🔊</button>
                  </div>
                ) : null}
                <div className="text-base font-bold text-slate-800 dark:text-white">
                  <GlossaryText text={l?.text || ""} glossary={cfg.glossary} />
                </div>
                {l?.translation ? (
                  <div className="mt-0.5 text-sm font-semibold text-slate-400 dark:text-stone-500">{l.translation}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {question ? (
        <div className="mt-6">
          <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{question}</div>
          <div className="mt-3">
            <ChoiceGrid choices={choices} selected={sel} onSelect={setSel} columns={1} graded={graded} />
          </div>
        </div>
      ) : null}

      <FooterSlot>
        <PrimaryButton
          disabled={sel === null || !!graded}
          onClick={() => {
            setGraded({ correct: correctIndex, picked: sel });
            const extra = { selectedIndices: [sel], answerText: choices[sel] ?? "" };
            sel === correctIndex ? correct(extra) : wrong("Re-read the story and try again.", extra);
          }}
        >
          Check
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

// X) radio — DuoRadio-style long-form listening: a short narrated piece split
// into segments, each played as audio (no text shown) then checked with a
// comprehension question; the text + translation are revealed only after you
// answer. Audio-first listening + comprehension. Config:
// { title?, segments:[{ text, translation?, question, choices, answerIndex }] }
function ExRadio({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer, apiBaseUrl, submit }) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const title = cfg.title || exercise?.prompt || "Listen to the show";
  const segments = Array.isArray(cfg.segments) ? cfg.segments : [];
  const M = segments.length;

  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const scoreRef = useRef(0);
  const seg = segments[idx] || {};
  const answerIndex = Number.isFinite(seg.answerIndex) ? Number(seg.answerIndex) : 0;

  useEffect(() => { setIdx(0); setSel(null); setRevealed(false); scoreRef.current = 0; }, [exercise?.id]);

  async function play(rate = 1) {
    const text = seg?.text; if (!text) return;
    try {
      setBusy(true);
      const url = await ttsFetch(apiBaseUrl || API_BASE, { text, exerciseId: exercise?.id });
      const a = newTrackedAudio(url); a.playbackRate = rate; await a.play();
    } catch (e) { console.error("TTS failed", e); }
    finally { setBusy(false); }
  }

  // Auto-play each segment as it becomes current.
  useEffect(() => { setSel(null); setRevealed(false); if (seg?.text) play(); /* eslint-disable-next-line */ }, [idx, exercise?.id]);

  const graded = revealed ? { correct: answerIndex, picked: sel } : null;

  function onPrimary() {
    if (!revealed) {
      if (sel === answerIndex) scoreRef.current += 1;
      setRevealed(true);
      return;
    }
    if (idx + 1 >= M) {
      const need = Math.ceil(M * 0.6);
      const pass = scoreRef.current >= need;
      const payload = { answerText: `radio ${scoreRef.current}/${M}` };
      pass ? correct(payload) : wrong(`You got ${scoreRef.current}/${M} — listen again.`, payload);
    } else {
      setIdx((i) => i + 1);
    }
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <Title>{title}</Title>
        <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-feather-500 dark:text-feather-400">Part {idx + 1} / {M}</span>
      </div>

      <div className="mt-3">
        <SpeechBubbleMascot
          character="armen"
          text={revealed
            ? <span><GlossaryText text={seg?.text || ""} glossary={cfg.glossary} />{seg?.translation ? <span className="mt-0.5 block text-sm font-semibold text-slate-400 dark:text-stone-500">{seg.translation}</span> : null}</span>
            : "🎧 Listen…"}
          onPlay={() => play(1)}
          onSlow={() => play(0.6)}
          busy={busy}
          playDisabled={!seg?.text}
        />
      </div>

      {seg?.question ? (
        <div className="mt-5">
          <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{seg.question}</div>
          <div className="mt-3">
            <ChoiceGrid choices={Array.isArray(seg.choices) ? seg.choices : []} selected={sel}
              onSelect={(i) => { if (!revealed) setSel(i); }} columns={1} graded={graded} />
          </div>
        </div>
      ) : null}

      <FooterSlot>
        <PrimaryButton disabled={!revealed && sel === null} onClick={onPrimary}>
          {!revealed ? "Check" : (idx + 1 >= M ? "Finish" : "Next part")}
        </PrimaryButton>
      </FooterSlot>
    </Card>
  );
}

/* -------------------------
   Main Renderer (no hooks)
-------------------------- */

export default function ExerciseRenderer({
  exercise,
  onCorrect,
  onWrong,
  onSkip,
  onAnswer,
  apiBaseUrl,
  submit,
  combo = 0,
  mascotCharacter = "armen",
  // When false, grading stays entirely client-side: no attempt is POSTed, so
  // no hearts are spent and no SRS state is written. Used by the level
  // assessment, where re-answering already-learned material must not cost the
  // learner hearts or disturb their review schedule.
  persist = true,
}) {
  const cfg = useMemo(() => normalizeConfig(exercise?.config), [exercise?.config]);
  const kind = String(exercise?.kind || "").trim();
  const exerciseStartRef = useRef(Date.now());

  useEffect(() => {
    exerciseStartRef.current = Date.now();
  }, [exercise?.id]);

  async function handleAnswer(payload) {
    const timeSpentMs = Date.now() - exerciseStartRef.current;
    const isCorrect = payload?.isCorrect === true || payload?.is_correct === true;
    const skipped = payload?.skipped === true;

    const answerText =
      payload?.answerText ??
      payload?.answer_text ??
      payload?.chosen_answer ??
      payload?.student_answer ??
      null;
    const selectedIndices =
      payload?.selectedIndices ?? payload?.selected_indices ?? null;

    const attempt = persist
      ? await postAttempt({
          exerciseId: exercise.id,
          isCorrect,
          answerText,
          selectedIndices,
          msSpent: timeSpentMs,
          combo,
        })
      : null;

    // Server is authoritative: a forgiven typo comes back is_correct:true even
    // though the client graded it wrong. Trust the server verdict when present.
    const serverCorrect =
      attempt && typeof attempt.is_correct === "boolean"
        ? attempt.is_correct
        : isCorrect;
    const isTypo = attempt?.typo === true;

    if (persist) {
      await postExerciseLog({
        exerciseId: exercise.id,
        event: "answered",
        payload: {
          lesson_id: exercise.lesson_id,
          kind: exercise.kind,
          is_correct: isCorrect,
          time_ms: timeSpentMs,
        },
      });
    }

    // Trust server delta when we got a response (delta may legitimately be 0
    // for exercises already answered correctly before — no XP farming).
    // Only fall back to local exercise.xp when the request failed entirely.
    const earnedDelta = attempt != null
      ? Math.max(0, Number(attempt.earned_xp_delta ?? 0))
      : (serverCorrect && !skipped ? Number(exercise?.xp ?? 0) : 0);

    const resultPayload = {
      isCorrect: serverCorrect,
      skipped,
      xpEarned: Math.max(0, Math.floor(earnedDelta)),
      comboBonusXp: Math.max(0, Number(attempt?.combo_bonus_xp ?? 0)),
      typo: isTypo,
      correctAnswer: attempt?.correct_answer ?? null,
      // Carry the exercise + the learner's answer so the result sheet can offer
      // an "Explain my mistake" (GPT-4o) action on wrong answers.
      exerciseId: exercise.id,
      userAnswer: answerText,
      message: payload?.message ?? null,
      hearts:
        Number.isFinite(attempt?.hearts_current) ? attempt.hearts_current : undefined,
      autoAdvance: payload?.autoAdvance === true,
      // Flag that the attempt was already posted to the server by handleAnswer,
      // so the parent (e.g. gradeAndAdvance in PracticeMode) can skip re-posting.
      _synced: attempt != null,
    };

    onAnswer?.(resultPayload);
  }

  const internalSubmit = submit ?? handleAnswer;
  const fallbackHelpers = useAnswerHelpers({
    onCorrect,
    onWrong,
    onSkip,
    onAnswer,
    submit: internalSubmit,
  });

  if (kind === "char_intro") {
    return (
      <ExCharIntro
        exercise={exercise}
        cfg={cfg}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "char_mcq_sound") {
    return (
      <ExCharMcqSound
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "letter_recognition") {
    return (
      <ExLetterRecognition
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "char_build_word") {
    return (
      <ExCharBuildWord
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "letter_typing") {
    return (
      <ExLetterTyping
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "word_spelling") {
    return (
      <ExWordSpelling
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "fill_blank") {
    return (
      <ExFillBlank
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer} mascotCharacter={mascotCharacter}
      />
    );
  }

  if (kind === "translate_mcq") {
    return (
      <ExTranslateMcq
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer} mascotCharacter={mascotCharacter}
      />
    );
  }

  if (kind === "true_false") {
    return (
      <ExTrueFalse
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "sentence_order") {
    return (
      <ExSentenceOrder
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "match_pairs") {
    return (
      <ExMatchPairs
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "audio_choice_tts") {
    return (
      <ExAudioChoiceTts
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        apiBaseUrl={apiBaseUrl} submit={handleAnswer} mascotCharacter={mascotCharacter} />
    );
  }

  if (kind === "multi_select") {
    return (
      <ExMultiSelect
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer}
      />
    );
  }

  if (kind === "speak") {
    return (
      <ExSpeak
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        apiBaseUrl={apiBaseUrl}
        submit={handleAnswer}
        mascotCharacter={mascotCharacter}
      />
    );
  }

  if (kind === "listen_image") {
    return <ExListenImage exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} apiBaseUrl={apiBaseUrl} mascotCharacter={mascotCharacter} />;
  }

  if (kind === "listen_type") {
    return (
      <ExListenType
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        apiBaseUrl={apiBaseUrl}
        submit={handleAnswer} mascotCharacter={mascotCharacter}
      />
    );
  }

  if (kind === "word_bank") {
    return (
      <ExWordBank
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer} apiBaseUrl={apiBaseUrl} mascotCharacter={mascotCharacter}
      />
    );
  }

  if (kind === "select_missing_word") {
    return (
      <ExSelectMissingWord
        exercise={exercise}
        cfg={cfg}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        onAnswer={onAnswer}
        submit={handleAnswer} mascotCharacter={mascotCharacter}
      />
    );
  }

  if (kind === "listen_word_bank") {
    return <ExListenWordBank exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} apiBaseUrl={apiBaseUrl} submit={handleAnswer} mascotCharacter={mascotCharacter} />;
  }
  if (kind === "dialogue_mcq") {
    return <ExDialogueMcq exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} />;
  }
  if (kind === "dialogue_order") {
    return <ExDialogueOrder exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} />;
  }
  if (kind === "image_select") {
    return <ExImageSelect exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} />;
  }
  if (kind === "reading_comprehension") {
    return <ExReadingComprehension exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} />;
  }
  if (kind === "story") {
    return <ExStory exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} apiBaseUrl={apiBaseUrl} />;
  }
  if (kind === "radio") {
    return <ExRadio exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} apiBaseUrl={apiBaseUrl} />;
  }
  if (kind === "minimal_pairs") {
    return <ExMinimalPairs exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} apiBaseUrl={apiBaseUrl} submit={handleAnswer} mascotCharacter={mascotCharacter} />;
  }
  if (kind === "flashcard") {
    return <ExFlashcard exercise={exercise} cfg={cfg} submit={handleAnswer} />;
  }
  if (kind === "categorize") {
    return <ExCategorize exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} />;
  }
  if (kind === "highlight_grammar") {
    return <ExHighlightGrammar exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} />;
  }
  if (kind === "conjugation") {
    return <ExConjugation exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} />;
  }
  if (kind === "speak_line") {
    return <ExSpeakLine exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} apiBaseUrl={apiBaseUrl} submit={handleAnswer} mascotCharacter={mascotCharacter} />;
  }
  if (kind === "trace_letter") {
    return <ExTraceLetter exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} apiBaseUrl={apiBaseUrl} />;
  }

  if (kind === "inflect") {
    return <ExInflect exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} />;
  }

  if (kind === "write_translate") {
    return <ExWriteTranslate exercise={exercise} cfg={cfg} onCorrect={onCorrect} onWrong={onWrong} onSkip={onSkip} onAnswer={onAnswer} submit={handleAnswer} mascotCharacter={mascotCharacter} />;
  }

  // Fallback for unknown exercise kinds
  return (
    <Card>
      <Title>Unknown exercise type</Title>
      <Muted className="mt-2">
        kind: <span className="font-mono">{String(exercise?.kind)}</span>
      </Muted>
      {exercise?.prompt && <Muted className="mt-2">{exercise.prompt}</Muted>}
      <FooterSlot>
        <PrimaryButton onClick={fallbackHelpers.skip}>Skip</PrimaryButton>
      </FooterSlot>
    </Card>
  );
}
