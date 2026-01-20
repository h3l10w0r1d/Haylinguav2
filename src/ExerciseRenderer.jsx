import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ExerciseRenderer
 * Props:
 *  - exercise: { kind, prompt, expected_answer, sentence_before, sentence_after, config }
 *  - onCorrect: () => void
 *  - onWrong: (msg?: string) => void
 *  - onSkip: () => void
 *  - apiBaseUrl?: string (optional)
 *
 * Notes:
 *  - "config" can be a JSON string or object. We normalize to object.
 *  - We keep UX consistent: prompt -> interaction -> Check button -> feedback.
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

/** Wrap presses to make them robust + always log */
function pressWrap(handler, label) {
  return (e) => {
    try {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      console.log(`[UI] press: ${label}`);
      handler?.(e);
    } catch (err) {
      console.error(`[UI] press error: ${label}`, err);
    }
  };
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
    <div className="text-lg md:text-xl font-semibold text-slate-900">{children}</div>
  );
}

function Muted({ children, className }) {
  return <div className={cx("text-sm text-slate-600", className)}>{children}</div>;
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
  debugName,
}) {
  const label = debugName || (typeof children === "string" ? children : "PrimaryButton");
  const onPress = pressWrap(onClick, label);

  return (
    <button
      type={type}
      onPointerUp={onPress}
      onClick={onPress}
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
  debugName,
}) {
  const label =
    debugName || (typeof children === "string" ? children : "SecondaryButton");
  const onPress = pressWrap(onClick, label);

  return (
    <button
      type={type}
      onPointerUp={onPress}
      onClick={onPress}
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
            type="button"
            onPointerUp={pressWrap(() => onSelect(idx), `Choice:${idx}`)}
            onClick={pressWrap(() => onSelect(idx), `Choice:${idx}`)}
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
      type="button"
      onPointerUp={pressWrap(onClick, "Pill")}
      onClick={pressWrap(onClick, "Pill")}
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

export default function ExerciseRenderer({ exercise, onCorrect, onWrong, onSkip, apiBaseUrl }) {
  const cfg = useMemo(() => normalizeConfig(exercise?.config), [exercise?.config]);

  // Generic state
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);

  // Audio state (for TTS-based types)
  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);

  // Reset state whenever exercise changes
  useEffect(() => {
    setSelectedIndex(null);
    setInputValue("");
    setBusy(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id, exercise?.kind]);

  const prompt = exercise?.prompt || "";
  const expected = exercise?.expected_answer;

  function wrong(msg) {
    onWrong?.(msg);
  }

  function correct() {
    onCorrect?.();
  }

  // -------------------------
  // Existing kinds (kept)
  // -------------------------

  // 1) char_intro
  if (exercise?.kind === "char_intro") {
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
          <PrimaryButton debugName="CharIntro:Continue" onClick={correct}>
            Continue
          </PrimaryButton>
          <SecondaryButton debugName="CharIntro:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // 2) char_mcq_sound (UI-only sound button — preserved)
  if (exercise?.kind === "char_mcq_sound") {
    const options = cfg.options ?? [];
    const correctIndex = Number(cfg.correctIndex ?? -1);

    const canCheck = selectedIndex !== null;

    return (
      <Card>
        <Title>{prompt || "Pick the correct sound"}</Title>
        <Muted className="mt-2">
          Letter: <span className="font-semibold text-slate-800">{cfg.letter ?? ""}</span>
        </Muted>

        <div className="mt-4">
          <SecondaryButton
            debugName="CharMcqSound:PlaySound"
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
            debugName="CharMcqSound:Check"
            disabled={!canCheck}
            onClick={() => {
              if (selectedIndex === correctIndex) correct();
              else wrong("Try again.");
            }}
          >
            Check
          </PrimaryButton>
          <SecondaryButton debugName="CharMcqSound:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // 3) letter_recognition
  if (exercise?.kind === "letter_recognition") {
    const choices = cfg.choices ?? cfg.options ?? [];
    const answer = expected ?? cfg.answer ?? "";

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
            debugName="LetterRecognition:Check"
            disabled={!canCheck}
            onClick={() => {
              const pick = choices[selectedIndex] ?? "";
              if (normalizeText(pick) === normalizeText(answer)) correct();
              else wrong("Not quite. Try again.");
            }}
          >
            Check
          </PrimaryButton>
          <SecondaryButton debugName="LetterRecognition:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // 4) char_build_word
  if (exercise?.kind === "char_build_word") {
    const tiles = cfg.tiles ?? [];
    const solution = cfg.solutionIndices ?? [];
    const targetWord = cfg.targetWord;

    const [chosen, setChosen] = useState([]);
    const [used, setUsed] = useState(() => new Set());

    useEffect(() => {
      setChosen([]);
      setUsed(new Set());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exercise?.id, exercise?.kind]);

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
            <SecondaryButton debugName="BuildWord:Reset" onClick={reset} disabled={chosen.length === 0}>
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
            debugName="BuildWord:Check"
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
          <SecondaryButton debugName="BuildWord:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // 5) letter_typing
  if (exercise?.kind === "letter_typing") {
    const answer = expected ?? cfg.answer ?? "";

    const canCheck = normalizeText(inputValue).length > 0;

    return (
      <Card>
        <Title>{prompt || "Type the letter"}</Title>

        <div className="mt-4">
          <InlineInput value={inputValue} onChange={setInputValue} placeholder="Type here…" />
        </div>

        <div className="mt-6 space-y-3">
          <PrimaryButton
            debugName="LetterTyping:Check"
            disabled={!canCheck}
            onClick={() => {
              if (normalizeText(inputValue) === normalizeText(answer)) correct();
              else wrong("Incorrect. Check the letter form and try again.");
            }}
          >
            Check
          </PrimaryButton>
          <SecondaryButton debugName="LetterTyping:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // 6) word_spelling
  if (exercise?.kind === "word_spelling") {
    const answer = expected ?? cfg.answer ?? "";
    const hint = cfg.hint;

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
            debugName="WordSpelling:Check"
            disabled={!canCheck}
            onClick={() => {
              if (normalizeText(inputValue) === normalizeText(answer)) correct();
              else wrong("Almost — try again.");
            }}
          >
            Check
          </PrimaryButton>
          <SecondaryButton debugName="WordSpelling:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // -------------------------
  // New kinds (added)
  // -------------------------

  // A) fill_blank
  if (exercise?.kind === "fill_blank") {
    const before = cfg.before ?? exercise?.sentence_before ?? "";
    const after = cfg.after ?? exercise?.sentence_after ?? "";
    const placeholder = cfg.placeholder ?? "…";
    const answer = expected ?? cfg.answer ?? "";

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
            debugName="FillBlank:Check"
            disabled={!canCheck}
            onClick={() => {
              if (normalizeText(inputValue) === normalizeText(answer)) correct();
              else wrong("Not quite. Try the missing word again.");
            }}
          >
            Check
          </PrimaryButton>
          <SecondaryButton debugName="FillBlank:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // B) translate_mcq
  if (exercise?.kind === "translate_mcq") {
    const sentence = cfg.sentence ?? "";
    const choices = cfg.choices ?? cfg.options ?? [];
    const answerIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : null;
    const answerText = expected ?? cfg.answer ?? null;

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
            debugName="TranslateMCQ:Check"
            disabled={!canCheck}
            onClick={() => {
              if (answerIndex !== null) {
                if (selectedIndex === answerIndex) correct();
                else wrong("Wrong choice. Try again.");
                return;
              }
              const pick = choices[selectedIndex] ?? "";
              if (answerText && normalizeText(pick) === normalizeText(answerText)) correct();
              else wrong("Wrong choice. Try again.");
            }}
          >
            Check
          </PrimaryButton>
          <SecondaryButton debugName="TranslateMCQ:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // C) true_false
  if (exercise?.kind === "true_false") {
    const statement = cfg.statement ?? "";
    const correctBool = Boolean(cfg.correct);

    const canCheck = selectedIndex !== null; // 0 = false, 1 = true

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
            type="button"
            onPointerUp={pressWrap(() => setSelectedIndex(0), "TrueFalse:False")}
            onClick={pressWrap(() => setSelectedIndex(0), "TrueFalse:False")}
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
            type="button"
            onPointerUp={pressWrap(() => setSelectedIndex(1), "TrueFalse:True")}
            onClick={pressWrap(() => setSelectedIndex(1), "TrueFalse:True")}
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
            debugName="TrueFalse:Check"
            disabled={!canCheck}
            onClick={() => {
              const pick = selectedIndex === 1;
              if (pick === correctBool) correct();
              else wrong("Nope — think about the meaning.");
            }}
          >
            Check
          </PrimaryButton>
          <SecondaryButton debugName="TrueFalse:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // D) sentence_order
  if (exercise?.kind === "sentence_order") {
    const tokens = cfg.tokens ?? [];
    const solution = cfg.solution ?? null;
    const solutionIndices = cfg.solutionIndices ?? null;

    const [picked, setPicked] = useState([]);
    const [available, setAvailable] = useState(tokens);

    useEffect(() => {
      setPicked([]);
      setAvailable(tokens);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exercise?.id, exercise?.kind]);

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
            debugName="SentenceOrder:Check"
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
          <SecondaryButton debugName="SentenceOrder:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // E) match_pairs
  if (exercise?.kind === "match_pairs") {
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
          Matched: <span className="font-semibold text-slate-800">{currentMatches}</span> /{" "}
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
                  type="button"
                  disabled={done}
                  onPointerUp={pressWrap(() => setSelectedLeft(idx), `MatchPairs:Left:${idx}`)}
                  onClick={pressWrap(() => setSelectedLeft(idx), `MatchPairs:Left:${idx}`)}
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
                  type="button"
                  disabled={done || selectedLeft === null}
                  onPointerUp={pressWrap(() => {
                    if (selectedLeft === null) return;
                    tryMatch(selectedLeft, idx);
                  }, `MatchPairs:Right:${idx}`)}
                  onClick={pressWrap(() => {
                    if (selectedLeft === null) return;
                    tryMatch(selectedLeft, idx);
                  }, `MatchPairs:Right:${idx}`)}
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
          <SecondaryButton debugName="MatchPairs:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // F) audio_choice_tts
  if (exercise?.kind === "audio_choice_tts") {
    const ttsText = cfg.ttsText ?? cfg.text ?? "";
    const promptText = cfg.promptText ?? prompt ?? "Listen and choose";
    const choices = cfg.choices ?? cfg.options ?? [];
    const answerIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : null;
    const answerText = expected ?? cfg.answer ?? null;

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
          <PrimaryButton debugName="AudioChoiceTTS:Play" onClick={play} disabled={busy || !ttsText}>
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
            debugName="AudioChoiceTTS:Check"
            disabled={!canCheck}
            onClick={() => {
              if (answerIndex !== null) {
                selectedIndex === answerIndex ? correct() : wrong("Wrong choice. Try again.");
                return;
              }
              const pick = choices[selectedIndex] ?? "";
              if (answerText && normalizeText(pick) === normalizeText(answerText)) correct();
              else wrong("Wrong choice. Try again.");
            }}
          >
            Check
          </PrimaryButton>
          <SecondaryButton debugName="AudioChoiceTTS:Skip" onClick={onSkip}>
            Skip
          </SecondaryButton>
        </div>
      </Card>
    );
  }

  // -------------------------
  // Unknown kind fallback
  // -------------------------
  return (
    <Card>
      <Title>Unknown exercise type</Title>
      <Muted className="mt-2">
        kind: <span className="font-mono">{String(exercise?.kind)}</span>
      </Muted>
      {prompt && <Muted className="mt-2">{prompt}</Muted>}
      <div className="mt-6 space-y-3">
        <PrimaryButton debugName="UnknownKind:Skip" onClick={onSkip}>
          Skip
        </PrimaryButton>
      </div>
    </Card>
  );
}
