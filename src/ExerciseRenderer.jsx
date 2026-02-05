import React, { useEffect, useMemo, useRef, useState } from "react";

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
 *  - onAnswer: (payload) => void   // legacy/compat
 *  - apiBaseUrl?: string
 */

function normalizeConfig(config) {
  if (!config) return {};
  if (typeof config === "string") {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  if (typeof config === "object") return config;
  return {};
}

function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Card({ children, className }) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-white/90 shadow-sm ring-1 ring-black/5 p-4 md:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

function Title({ children }) {
  return (
    <div className="text-lg md:text-xl font-semibold text-slate-900">
      {children}
    </div>
  );
}

function Muted({ children, className }) {
  return (
    <div className={cx("text-sm text-slate-600", className)}>{children}</div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "w-full rounded-xl px-4 py-3 font-semibold transition",
        disabled
          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
          : "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700",
        className
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "w-full rounded-xl px-4 py-3 font-semibold transition ring-1 ring-slate-200",
        disabled
          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
          : "bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100",
        className
      )}
    >
      {children}
    </button>
  );
}

function ChoiceGrid({ choices, selected, onSelect, columns = 2 }) {
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={cx("grid gap-3", colClass)}>
      {choices.map((c, idx) => {
        const isSelected = selected === idx;
        return (
          <button
            key={idx}
            onClick={() => onSelect(idx)}
            className={cx(
              "rounded-xl px-4 py-3 text-left font-semibold transition ring-1",
              isSelected
                ? "bg-orange-50 ring-orange-300 text-orange-800"
                : "bg-white ring-slate-200 hover:bg-slate-50"
            )}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}

function Pill({ children, onClick, disabled, active = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "rounded-full px-4 py-2 text-sm font-semibold ring-1 transition",
        disabled
          ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed"
          : active
          ? "bg-orange-50 text-orange-800 ring-orange-300"
          : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function InlineInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl px-4 py-3 ring-1 ring-slate-200 focus:outline-none focus:ring-orange-300"
    />
  );
}

async function ttsFetch(apiBaseUrl, text) {
  const base =
    apiBaseUrl ||
    import.meta.env.VITE_API_BASE_URL ||
    "https://haylinguav2.onrender.com";

  const res = await fetch(`${base}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error("TTS failed");

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Shared helper so all components keep exact behavior */
function useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit }) {
  // NOTE: we do NOT advance to the next exercise immediately.
  // We first persist the attempt, show a Result screen, and only then call onAnswer() from ExerciseRenderer.
  function wrong(msg) {
    onWrong?.(msg);
    submit?.({ isCorrect: false, message: msg });
  }

  function correct() {
    onCorrect?.();
    submit?.({ isCorrect: true });
  }

  function skip() {
    onSkip?.();
    submit?.({ skipped: true, isCorrect: true });
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

async function postAttempt({
  exerciseId,
  isCorrect,
  answerText = null,
  selectedIndices = null,
  msSpent = null,
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
        attempt_no: 1,
        time_ms: Number.isFinite(msSpent) ? Math.max(0, Math.floor(msSpent)) : null,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn("[postAttempt] failed:", res.status, txt);
      return;
    }

    // Update hearts in header if backend returns them
    const data = await res.json().catch(() => null);
    if (data && typeof data === "object") {
      const hc = data.hearts_current;
      const hm = data.hearts_max;
      if (Number.isFinite(hc) && Number.isFinite(hm)) {
        const next = { current: Number(hc), max: Number(hm) };
        try {
          localStorage.setItem("hay_hearts", JSON.stringify(next));
        } catch {}
        window.dispatchEvent(new CustomEvent("hay_hearts", { detail: next }));
          return data;
  }
    }
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

// 1) char_intro
function ExCharIntro({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const letter = cfg.letter ?? "";
  const lower = cfg.lower ?? "";
  const transliteration = cfg.transliteration ?? "";
  const hint = cfg.hint ?? "";

  return (
    <Card>
      <Title>{prompt || "New letter"}</Title>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-5xl md:text-6xl font-black text-slate-900">{letter}</div>
        <div className="text-3xl md:text-4xl font-extrabold text-slate-700">{lower}</div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
        {transliteration && (
          <Muted>
            Sounds like:{" "}
            <span className="font-semibold text-slate-800">{transliteration}</span>
          </Muted>
        )}
        {hint && <Muted className="mt-2">{hint}</Muted>}
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton onClick={() => correct(0)}>Continue</PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
    </Card>
  );
}

// 2) char_mcq_sound (UI-only play button — preserved)
function ExCharMcqSound({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const options = cfg.options ?? [];
  const correctIndex = Number(cfg.correctIndex ?? -1);
  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => {
    setSelectedIndex(null);
  }, [exercise?.id]);

  const canCheck = selectedIndex !== null;

  return (
    <Card>
      <Title>{prompt || "Pick the correct sound"}</Title>
      <Muted className="mt-2">
        Letter: <span className="font-semibold text-slate-800">{cfg.letter ?? ""}</span>
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
        />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (selectedIndex === correctIndex) correct();
            else wrong("Try again.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
    </Card>
  );
}



// 3) letter_recognition
function ExLetterRecognition({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const choices = cfg.choices ?? cfg.options ?? [];
  const answer = expected ?? cfg.answer ?? "";

  const [selectedIndex, setSelectedIndex] = useState(null);

  useEffect(() => setSelectedIndex(null), [exercise?.id]);

  const canCheck = selectedIndex !== null;

  return (
    <Card>
      <Title>{prompt || "Choose the correct letter"}</Title>

      <div className="mt-4">
        <ChoiceGrid
          choices={choices}
          selected={selectedIndex}
          onSelect={setSelectedIndex}
          columns={2}
        />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            const pick = choices[selectedIndex] ?? "";
            if (normalizeText(pick) === normalizeText(answer)) correct();
            else wrong("Not quite. Try again.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
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
          Target: <span className="font-semibold text-slate-800">{targetWord}</span>
        </Muted>
      )}

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
        <div className="text-2xl font-extrabold text-slate-900 min-h-[2.5rem]">
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

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            const ok =
              solution.length === chosen.length &&
              solution.every((v, i) => Number(v) === Number(chosen[i]));
            if (ok) correct();
            else wrong("The order is off. Try again.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
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
  useEffect(() => setInputValue(""), [exercise?.id]);

  const canCheck = normalizeText(inputValue).length > 0;

  return (
    <Card>
      <Title>{prompt || "Type the letter"}</Title>

      <div className="mt-4">
        <InlineInput value={inputValue} onChange={setInputValue} placeholder="Type here…" />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (normalizeText(inputValue) === normalizeText(answer)) correct();
            else wrong("Incorrect. Check the letter form and try again.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
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
  useEffect(() => setInputValue(""), [exercise?.id]);

  const canCheck = normalizeText(inputValue).length > 0;

  return (
    <Card>
      <Title>{prompt || "Spell the word"}</Title>
      {hint && <Muted className="mt-2">Hint: {hint}</Muted>}

      <div className="mt-4">
        <InlineInput value={inputValue} onChange={setInputValue} placeholder="Type the word…" />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (normalizeText(inputValue) === normalizeText(answer)) correct();
            else wrong("Almost — try again.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
    </Card>
  );
}

// A) fill_blank
function ExFillBlank({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const before = cfg.before ?? exercise?.sentence_before ?? "";
  const after = cfg.after ?? exercise?.sentence_after ?? "";
  const placeholder = cfg.placeholder ?? "…";
  const answer = expected ?? cfg.answer ?? "";

  const [inputValue, setInputValue] = useState("");
  useEffect(() => setInputValue(""), [exercise?.id]);

  const canCheck = normalizeText(inputValue).length > 0;

  return (
    <Card>
      <Title>{prompt || "Fill in the blank"}</Title>

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
        <div className="text-lg md:text-xl font-semibold text-slate-900">
          {before}{" "}
          <span className="px-2 py-1 rounded-lg bg-white ring-1 ring-slate-200">
            {placeholder}
          </span>{" "}
          {after}
        </div>
      </div>

      <div className="mt-4">
        <InlineInput
          value={inputValue}
          onChange={setInputValue}
          placeholder="Type the missing word…"
        />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (normalizeText(inputValue) === normalizeText(answer)) correct();
            else wrong("Not quite. Try the missing word again.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
    </Card>
  );
}

// B) translate_mcq (now supports exercise.options DB-backed)
function ExTranslateMcq({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const sentence = cfg.sentence ?? "";
  const choices = getChoices(exercise, cfg);
  const correctIndexFromDbOrCfg = getSingleCorrectIndex(exercise, cfg, choices);
  const answerText = expected ?? cfg.answer ?? null;

  const [selectedIndex, setSelectedIndex] = useState(null);
  useEffect(() => setSelectedIndex(null), [exercise?.id]);

  const canCheck = selectedIndex !== null;

  return (
    <Card>
      <Title>{prompt || "Choose the correct translation"}</Title>

      {sentence && (
        <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
          <div className="text-lg md:text-xl font-semibold text-slate-900">{sentence}</div>
        </div>
      )}

      <div className="mt-4">
        <ChoiceGrid
          choices={choices}
          selected={selectedIndex}
          onSelect={setSelectedIndex}
          columns={2}
        />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (correctIndexFromDbOrCfg !== null) {
              if (selectedIndex === correctIndexFromDbOrCfg) correct();
              else wrong("Wrong choice. Try again.");
              return;
            }
            // fallback text compare
            const pick = choices[selectedIndex] ?? "";
            if (answerText && normalizeText(pick) === normalizeText(answerText)) correct();
            else wrong("Wrong choice. Try again.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
    </Card>
  );
}

// C) true_false
function ExTrueFalse({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const statement = cfg.statement ?? "";
  const correctBool = Boolean(cfg.correct);

  const [selectedIndex, setSelectedIndex] = useState(null);
  useEffect(() => setSelectedIndex(null), [exercise?.id]);

  const canCheck = selectedIndex !== null; // 0=false 1=true

  return (
    <Card>
      <Title>{prompt || "True or False"}</Title>

      {statement && (
        <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
          <div className="text-lg md:text-xl font-semibold text-slate-900">{statement}</div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => setSelectedIndex(0)}
          className={cx(
            "rounded-xl px-4 py-3 font-semibold ring-1 transition",
            selectedIndex === 0
              ? "bg-orange-50 ring-orange-300 text-orange-800"
              : "bg-white ring-slate-200 hover:bg-slate-50"
          )}
        >
          False
        </button>
        <button
          onClick={() => setSelectedIndex(1)}
          className={cx(
            "rounded-xl px-4 py-3 font-semibold ring-1 transition",
            selectedIndex === 1
              ? "bg-orange-50 ring-orange-300 text-orange-800"
              : "bg-white ring-slate-200 hover:bg-slate-50"
          )}
        >
          True
        </button>
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            const pick = selectedIndex === 1;
            if (pick === correctBool) correct();
            else wrong("Nope — think about the meaning.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
    </Card>
  );
}

// D) sentence_order
function ExSentenceOrder({ exercise, cfg, onCorrect, onWrong, onSkip, onAnswer , submit}) {
  const { correct, wrong, skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  const tokens = cfg.tokens ?? [];
  const solution = cfg.solution ?? null;
  const solutionIndices = cfg.solutionIndices ?? null;

  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState(tokens);

  useEffect(() => {
    setPicked([]);
    setAvailable(tokens);
  }, [exercise?.id, tokens]);

  const canCheck = picked.length > 0;

  function removePicked(idx) {
    const token = picked[idx];
    setPicked((p) => p.filter((_, i) => i !== idx));
    setAvailable((a) => [...a, token]);
  }

  function addToken(idx) {
    const token = available[idx];
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setPicked((p) => [...p, token]);
  }

  return (
    <Card>
      <Title>{prompt || "Put the sentence in order"}</Title>

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 min-h-[4.5rem]">
        <div className="flex flex-wrap gap-2">
          {picked.length === 0 ? (
            <Muted>Tap words below to build the sentence…</Muted>
          ) : (
            picked.map((t, i) => (
              <Pill key={`${t}-${i}`} onClick={() => removePicked(i)} active>
                {t}
              </Pill>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {available.map((t, i) => (
          <Pill key={`${t}-${i}`} onClick={() => addToken(i)}>
            {t}
          </Pill>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (Array.isArray(solution)) {
              const ok =
                solution.length === picked.length &&
                solution.every((v, i) => normalizeText(v) === normalizeText(picked[i]));
              ok ? correct() : wrong("Word order is incorrect. Try again.");
              return;
            }

            if (Array.isArray(solutionIndices)) {
              const builtIndices = picked.map((t) => tokens.indexOf(t));
              const ok =
                solutionIndices.length === builtIndices.length &&
                solutionIndices.every((v, i) => Number(v) === Number(builtIndices[i]));
              ok ? correct() : wrong("Word order is incorrect. Try again.");
              return;
            }

            const builtSentence = picked.join(" ");
            const answer = expected ?? cfg.answer ?? "";
            if (normalizeText(builtSentence) === normalizeText(answer)) correct();
            else wrong("Word order is incorrect. Try again.");
          }}
        >
          Check
        </PrimaryButton>

        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
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

  useEffect(() => {
    setSelectedLeft(null);
    setMatchedLeft(new Set());
    setMatchedRight(new Set());
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

      if (nl.size === totalMatches) correct();
    } else {
      wrong("Not a match. Try again.");
    }
  }

  return (
    <Card>
      <Title>{prompt || "Match the pairs"}</Title>
      <Muted className="mt-2">
        Matched:{" "}
        <span className="font-semibold text-slate-800">{currentMatches}</span> /{" "}
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
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed"
                    : active
                    ? "bg-orange-50 text-orange-800 ring-orange-300"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
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
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed"
                    : selectedLeft === null
                    ? "bg-white text-slate-300 ring-slate-200 cursor-not-allowed"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
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
  const [busy, setBusy] = useState(false);

  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    setSelectedIndex(null);
    setBusy(false);

    if (audioRef.current) {
      audioRef.current.pause();
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
      const url = await ttsFetch(apiBaseUrl, ttsText);
      setAudioUrl(url);
      const audio = new Audio(url);
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
      <Title>{promptText}</Title>
      <Muted className="mt-2">Tap play, then choose the correct option.</Muted>

      <div className="mt-4">
        <PrimaryButton onClick={play} disabled={busy || !ttsText}>
          {busy ? "Loading audio…" : "🔊 Play"}
        </PrimaryButton>
        {!ttsText && <Muted className="mt-2">Missing config.ttsText</Muted>}
      </div>

      <div className="mt-4">
        <ChoiceGrid
          choices={choices}
          selected={selectedIndex}
          onSelect={setSelectedIndex}
          columns={2}
        />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (correctIndexFromDbOrCfg !== null) {
              selectedIndex === correctIndexFromDbOrCfg ? correct() : wrong("Wrong choice. Try again.");
              return;
            }
            const pick = choices[selectedIndex] ?? "";
            if (answerText && normalizeText(pick) === normalizeText(answerText)) correct();
            else wrong("Wrong choice. Try again.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
    </Card>
  );
}

/**
 * multi_select
 * Supports BOTH:
 *  - DB options: exercise.options with is_correct flags (best for CMS)
 *  - JSON config: { choices/options, correctIndices/correctAnswers, minSelect/maxSelect }
 *  - fallback: expected_answer as JSON array string
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

  const [selectedSet, setSelectedSet] = useState(() => new Set());

  useEffect(() => {
    setSelectedSet(new Set());
  }, [exercise?.id]);

  function toggle(i) {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else {
        if (next.size >= maxSelect) return next; // enforce max
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
        Select {minSelect}
        {maxSelect < choices.length ? `–${maxSelect}` : ""} option(s).
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
                  ? "bg-orange-50 ring-orange-300 text-orange-800"
                  : "bg-white ring-slate-200 hover:bg-slate-50"
              )}
            >
              {active ? "✅ " : ""}
              {c}
            </button>
          );
        })}
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (isCorrectSelection()) correct();
            else wrong("Not quite. Try selecting the correct set.");
          }}
        >
          Check
        </PrimaryButton>
        <SecondaryButton onClick={skip}>Skip</SecondaryButton>
      </div>
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
, submit}) {
  
  const cfg = useMemo(() => normalizeConfig(exercise?.config), [exercise?.config]);
  const kind = String(exercise?.kind || "").trim();
const exerciseStartRef = useRef(Date.now());

  // Per-exercise result screen
  const [phase, setPhase] = useState("question");
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    setPhase("question");
    setLastResult(null);
    exerciseStartRef.current = Date.now();
  }, [exercise?.id]);

async function handleAnswer(payload) {
  const timeSpentMs = Date.now() - exerciseStartRef.current;

  // Persist attempt + log
  const attempt = await postAttempt({
    exerciseId: exercise.id,
    isCorrect: !!payload?.is_correct,
    chosenAnswer: payload?.chosen_answer ?? null,
    studentAnswer: payload?.student_answer ?? null,
    timeSpentMs,
  });

  await postExerciseLog({
    lessonId: exercise.lesson_id,
    exerciseId: exercise.id,
    kind: exercise.kind,
    isCorrect: !!payload?.is_correct,
    timeSpentMs,
  });

  // Prepare result data (prefer backend-provided delta)
  const earnedDelta =
    Number(attempt?.earned_xp_delta ?? attempt?.earned_xp_delta) ||
    (payload?.is_correct ? Number(exercise?.xp ?? 0) : 0);

  setLastResult({
    isCorrect: !!payload?.is_correct,
    message: payload?.result_message || null,
    earnedXpDelta: Math.max(0, Math.floor(earnedDelta)),
    hearts_current: attempt?.hearts_current ?? null,
    hearts_max: attempt?.hearts_max ?? null,
    accuracy: attempt?.accuracy ?? null,
    completion_ratio: attempt?.completion_ratio ?? null,
    attempt_id: attempt?.attempt_id ?? null,
  });

  setPhase("result");
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
        submit={handleAnswer}
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
        submit={handleAnswer}
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
        apiBaseUrl={apiBaseUrl} submit={handleAnswer} />
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

  // Fallback
  const { skip } = useAnswerHelpers({ onCorrect, onWrong, onSkip, onAnswer, submit });
  return (
    <Card>
      <Title>Unknown exercise type</Title>
      <Muted className="mt-2">
        kind: <span className="font-mono">{String(exercise?.kind)}</span>
      </Muted>
      {exercise?.prompt && <Muted className="mt-2">{exercise.prompt}</Muted>}
      <div className="mt-6 space-y-3">
        <PrimaryButton onClick={skip}>Skip</PrimaryButton>
      </div>
    </Card>
  );
}
