// src/cms/ExerciseEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { cmsApi } from "./api";
import AudioManager from "./AudioManager";

/**
 * Teacher-friendly Exercise Editor
 * - Structured UI per kind
 * - Still supports Advanced JSON editing
 */

const KIND_OPTIONS = [
  { value: "char_intro", label: "Letter intro (char_intro)" },
  { value: "char_mcq_sound", label: "Sound MCQ (char_mcq_sound)" },
  { value: "letter_recognition", label: "Letter recognition (letter_recognition)" },
  { value: "char_build_word", label: "Build word (char_build_word)" },
  { value: "letter_typing", label: "Type letter (letter_typing)" },
  { value: "word_spelling", label: "Spell word (word_spelling)" },

  { value: "fill_blank", label: "Fill blank (fill_blank)" },
  { value: "translate_mcq", label: "Translate MCQ (translate_mcq)" },
  { value: "true_false", label: "True/False (true_false)" },
  { value: "sentence_order", label: "Sentence order (sentence_order)" },
  { value: "match_pairs", label: "Match pairs (match_pairs)" },
  { value: "audio_choice_tts", label: "Audio choice TTS (audio_choice_tts)" },

  { value: "multi_select", label: "Multi-select (multi_select)" },
];

function safeParseJson(text) {
  try {
    const v = JSON.parse(text || "{}");
    return typeof v === "object" && v !== null ? v : {};
  } catch {
    return null;
  }
}

function jsonPretty(obj) {
  return JSON.stringify(obj ?? {}, null, 2);
}

function normalizeStr(x) {
  return String(x ?? "").trim();
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-semibold text-slate-800">{label}</div>
      {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none " +
        "focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      }
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none " +
        "focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      }
    />
  );
}

function Button({ variant = "primary", className = "", ...props }) {
  const base =
    "rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-orange-500 text-white hover:bg-orange-600"
      : variant === "danger"
      ? "bg-rose-500 text-white hover:bg-rose-600"
      : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50";
  return <button {...props} className={`${base} ${styles} ${className}`} />;
}

function ChipsEditor({ items, onChange, placeholder = "Add item..." }) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = normalizeStr(draft);
    if (!v) return;
    onChange([...(items || []), v]);
    setDraft("");
  }

  function remove(idx) {
    const next = (items || []).filter((_, i) => i !== idx);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} />
        <Button type="button" variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(items || []).map((t, idx) => (
          <span
            key={`${t}-${idx}`}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-slate-500 hover:text-slate-900"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function OptionsEditor({ choices, setChoices, correctIndices, setCorrectIndices, mode = "single" }) {
  // mode: "single" (radio) | "multi" (checkbox)
  const [draft, setDraft] = useState("");

  function addChoice() {
    const v = normalizeStr(draft);
    if (!v) return;
    setChoices([...(choices || []), v]);
    setDraft("");
  }

  function removeChoice(i) {
    const next = (choices || []).filter((_, idx) => idx !== i);
    setChoices(next);

    // fix correctIndices after removal
    const updated = (correctIndices || [])
      .filter((x) => x !== i)
      .map((x) => (x > i ? x - 1 : x));
    setCorrectIndices(updated);
  }

  function toggleCorrect(i) {
    if (mode === "single") {
      setCorrectIndices([i]);
      return;
    }
    // multi
    const set = new Set(correctIndices || []);
    if (set.has(i)) set.delete(i);
    else set.add(i);
    setCorrectIndices(Array.from(set).sort((a, b) => a - b));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add option..." />
        <Button type="button" variant="secondary" onClick={addChoice}>
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {(choices || []).map((c, i) => {
          const checked = (correctIndices || []).includes(i);
          return (
            <div
              key={`${c}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <input
                type={mode === "single" ? "radio" : "checkbox"}
                checked={checked}
                onChange={() => toggleCorrect(i)}
              />
              <div className="flex-1 text-sm">{c}</div>
              <Button type="button" variant="secondary" onClick={() => removeChoice(i)}>
                Remove
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function defaultConfigForKind(kind) {
  switch (kind) {
    case "char_intro":
      return { letter: "Ա", lower: "ա", transliteration: "a", hint: "" };
    case "char_mcq_sound":
      return { letter: "Ա", options: ["a", "o", "e", "i"], correctIndex: 0 };
    case "letter_recognition":
      return { choices: ["Ա", "Բ", "Գ", "Դ"], answer: "Ա" };
    case "char_build_word":
      return { tiles: ["Ա", "Ր", "Մ", "Ե", "Ն"], solutionIndices: [0, 1, 2, 3, 4], targetWord: "ԱՐՄԵՆ" };
    case "letter_typing":
      return {};
    case "word_spelling":
      return { hint: "Meaning / hint (optional)" };

    case "fill_blank":
      return { before: "Ես", after: "եմ", placeholder: "…" };
    case "translate_mcq":
      return { sentence: "Hello", choices: ["Բարև", "Ցտեսություն"], answerIndex: 0 };
    case "true_false":
      return { statement: "Բարև means Hello", correct: true };
    case "sentence_order":
      return { tokens: ["Ես", "ուսանող", "եմ"], solution: ["Ես", "ուսանող", "եմ"] };
    case "match_pairs":
      return { pairs: [{ left: "Բարև", right: "Hello" }] };
    case "audio_choice_tts":
      return { ttsText: "Բարև", promptText: "Pick what you heard", choices: ["Բարև", "Շնորհակալություն"], answerIndex: 0 };

    case "multi_select":
      return { question: "Select all correct options", choices: ["Option A", "Option B", "Option C"], correctIndices: [0] };

    default:
      return {};
  }
}

export default function ExerciseEditor({ lessonId, exercise, onSaved, onDeleted, onCancel }) {
  const isNew = !exercise?.id;

  const [kind, setKind] = useState(exercise?.kind || "char_intro");
  const [prompt, setPrompt] = useState(exercise?.prompt || "");
  const [expectedAnswer, setExpectedAnswer] = useState(exercise?.expected_answer || "");
  const [order, setOrder] = useState(exercise?.order ?? 1);
  const [xp, setXp] = useState(exercise?.xp ?? 10);

  const initialCfgObj = useMemo(() => {
    const c = exercise?.config ?? {};
    return typeof c === "string" ? safeParseJson(c) || {} : c;
  }, [exercise]);

  const [configText, setConfigText] = useState(jsonPretty(initialCfgObj || defaultConfigForKind(kind)));
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Re-sync editor state when switching between exercises (or when lesson changes)
  useEffect(() => {
    setKind(exercise?.kind || "char_intro");
    setPrompt(exercise?.prompt || "");
    setExpectedAnswer(exercise?.expected_answer || "");
    setOrder(exercise?.order ?? 1);
    setXp(exercise?.xp ?? 10);

    const c = exercise?.config ?? {};
    const obj = typeof c === "string" ? safeParseJson(c) || {} : c;
    setConfigText(jsonPretty(obj || defaultConfigForKind(exercise?.kind || "char_intro")));

    setShowAdvanced(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id, lessonId]);

  // when kind changes on NEW exercise, reset config to a friendly template
  useEffect(() => {
    if (!isNew) return;
    setConfigText(jsonPretty(defaultConfigForKind(kind)));
    // expected answer resets for kinds that use it
    setExpectedAnswer("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const cfgObj = useMemo(() => safeParseJson(configText), [configText]);
  const cfgValid = cfgObj !== null;

  // AudioManager needs a single "exerciseText" string to generate TTS.
  // Different exercise kinds store the spoken text under different config keys.
  // We do best-effort extraction and fall back to expectedAnswer/prompt.
  function deriveExerciseAudioText() {
    const cfg = cfgObj && typeof cfgObj === "object" ? cfgObj : null;
    if (cfg) {
      const candidates = [
        cfg.ttsText,
        cfg.tts_text,
        cfg.text,
        cfg.word,
        cfg.targetWord,
        cfg.sentence,
        cfg.promptText,
      ];
      const first = candidates.find((v) => typeof v === "string" && v.trim().length);
      if (first) return first;
    }
    if (typeof expectedAnswer === "string" && expectedAnswer.trim()) return expectedAnswer;
    if (typeof prompt === "string" && prompt.trim()) return prompt;
    return "";
  }

  function patchConfig(patch) {
    const current = safeParseJson(configText);
    const obj = current && typeof current === "object" ? current : {};
    const next = { ...obj, ...patch };
    setConfigText(jsonPretty(next));
  }

  function saveConfigObj(obj) {
    setConfigText(jsonPretty(obj));
  }

  async function handleSave() {
    const cfg = safeParseJson(configText);
    if (cfg === null) {
      alert("Config JSON is invalid. Fix it or reset the template.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        kind,
        prompt: prompt || "",
        expected_answer: expectedAnswer || null,
        order: Number(order) || 1,
        xp: Number(xp) || 0,
        config: cfg || {},
      };

      if (isNew) {
        await cmsApi.createExercise(lessonId, payload);
      } else {
        await cmsApi.updateExercise(exercise.id, payload);
      }

      onSaved?.();
    } catch (e) {
      alert(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!exercise?.id) return;
    if (!cmsApi) {
      alert("CMS API is not initialized. Open the CMS through the token route so X-CMS-Token is attached.");
      return;
    }
    if (!confirm("Delete this exercise? This cannot be undone.")) return;

    setSaving(true);
    try {
      await cmsApi.deleteExercise(exercise.id);
      onDeleted?.("Exercise deleted");
    } catch (e) {
      alert(e?.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------
  // Teacher UI per kind
  // -------------------------
  function renderKindUI() {
    if (!cfgValid) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Config JSON is invalid. Open “Advanced” and fix it, or change kind to reset template.
        </div>
      );
    }

    const cfg = cfgObj || {};

    // char_intro
    if (kind === "char_intro") {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Uppercase letter">
            <Input value={cfg.letter ?? ""} onChange={(e) => patchConfig({ letter: e.target.value })} />
          </Field>
          <Field label="Lowercase letter">
            <Input value={cfg.lower ?? ""} onChange={(e) => patchConfig({ lower: e.target.value })} />
          </Field>
          <Field label="Transliteration" hint="Example: a, b, ch...">
            <Input value={cfg.transliteration ?? ""} onChange={(e) => patchConfig({ transliteration: e.target.value })} />
          </Field>
          <Field label="Hint" hint="Short teacher note for the student">
            <Input value={cfg.hint ?? ""} onChange={(e) => patchConfig({ hint: e.target.value })} />
          </Field>
        </div>
      );
    }

    // letter_typing / word_spelling / fill_blank use expectedAnswer
    if (kind === "letter_typing") {
      return (
        <div className="space-y-4">
          <Field label="Correct answer (what student should type)">
            <Input value={expectedAnswer} onChange={(e) => setExpectedAnswer(e.target.value)} />
          </Field>
        </div>
      );
    }

    if (kind === "word_spelling") {
      return (
        <div className="space-y-4">
          <Field label="Correct answer (spelling)">
            <Input value={expectedAnswer} onChange={(e) => setExpectedAnswer(e.target.value)} />
          </Field>
          <Field label="Hint (optional)">
            <Input value={cfg.hint ?? ""} onChange={(e) => patchConfig({ hint: e.target.value })} />
          </Field>
        </div>
      );
    }

    if (kind === "fill_blank") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Text before blank">
              <Input value={cfg.before ?? ""} onChange={(e) => patchConfig({ before: e.target.value })} />
            </Field>
            <Field label="Text after blank">
              <Input value={cfg.after ?? ""} onChange={(e) => patchConfig({ after: e.target.value })} />
            </Field>
          </div>
          <Field label="Blank placeholder" hint="What student sees in the gap">
            <Input value={cfg.placeholder ?? "…"} onChange={(e) => patchConfig({ placeholder: e.target.value })} />
          </Field>
          <Field label="Correct answer (missing word)">
            <Input value={expectedAnswer} onChange={(e) => setExpectedAnswer(e.target.value)} />
          </Field>
        </div>
      );
    }

    // letter_recognition (choices + answer text)
    if (kind === "letter_recognition") {
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      return (
        <div className="space-y-4">
          <Field label="Choices">
            <ChipsEditor items={choices} onChange={(next) => patchConfig({ choices: next })} placeholder="Add a letter..." />
          </Field>
          <Field label="Correct answer (must match one of choices)">
            <Input
              value={expectedAnswer || cfg.answer || ""}
              onChange={(e) => {
                setExpectedAnswer(e.target.value);
                patchConfig({ answer: e.target.value });
              }}
            />
          </Field>
          <div className="text-xs text-slate-500">Tip: keep answer identical to a choice (same letter).</div>
        </div>
      );
    }

    // char_mcq_sound (options + correctIndex)
    if (kind === "char_mcq_sound") {
      const options = Array.isArray(cfg.options) ? cfg.options : [];
      const correctIndex = Number.isFinite(cfg.correctIndex) ? Number(cfg.correctIndex) : 0;

      return (
        <div className="space-y-4">
          <Field label="Letter shown">
            <Input value={cfg.letter ?? ""} onChange={(e) => patchConfig({ letter: e.target.value })} />
          </Field>

          <Field label="Options + correct answer">
            <OptionsEditor
              choices={options}
              setChoices={(next) => patchConfig({ options: next })}
              correctIndices={[correctIndex]}
              setCorrectIndices={(arr) => patchConfig({ correctIndex: arr?.[0] ?? 0 })}
              mode="single"
            />
          </Field>
        </div>
      );
    }

    // translate_mcq (sentence + choices + answerIndex)
    if (kind === "translate_mcq") {
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;

      return (
        <div className="space-y-4">
          <Field label="Sentence to translate">
            <Input value={cfg.sentence ?? ""} onChange={(e) => patchConfig({ sentence: e.target.value })} />
          </Field>

          <Field label="Choices + correct answer">
            <OptionsEditor
              choices={choices}
              setChoices={(next) => patchConfig({ choices: next })}
              correctIndices={[correctIndex]}
              setCorrectIndices={(arr) => patchConfig({ answerIndex: arr?.[0] ?? 0 })}
              mode="single"
            />
          </Field>
        </div>
      );
    }

    // true_false
    if (kind === "true_false") {
      return (
        <div className="space-y-4">
          <Field label="Statement">
            <Input value={cfg.statement ?? ""} onChange={(e) => patchConfig({ statement: e.target.value })} />
          </Field>

          <Field label="Correct answer">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={cfg.correct === true} onChange={() => patchConfig({ correct: true })} />
                True
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={cfg.correct === false} onChange={() => patchConfig({ correct: false })} />
                False
              </label>
            </div>
          </Field>
        </div>
      );
    }

    // sentence_order (tokens + solution)
    if (kind === "sentence_order") {
      const tokens = Array.isArray(cfg.tokens) ? cfg.tokens : [];
      const solution = Array.isArray(cfg.solution) ? cfg.solution : [];

      return (
        <div className="space-y-4">
          <Field label="Tokens (words student will arrange)">
            <ChipsEditor items={tokens} onChange={(next) => patchConfig({ tokens: next })} placeholder="Add token..." />
          </Field>

          <Field label="Correct order (solution)" hint="Add tokens in the correct sequence (must match tokens)">
            <ChipsEditor
              items={solution}
              onChange={(next) => patchConfig({ solution: next })}
              placeholder="Add solution token in order..."
            />
          </Field>

          <div className="text-xs text-slate-500">
            Tip: solution should be same words as tokens, just ordered correctly.
          </div>
        </div>
      );
    }

    // match_pairs (pairs list)
    if (kind === "match_pairs") {
      const pairs = Array.isArray(cfg.pairs) ? cfg.pairs : [{ left: "", right: "" }];

      function updatePair(i, patch) {
        const next = pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
        patchConfig({ pairs: next });
      }

      function addPair() {
        patchConfig({ pairs: [...pairs, { left: "", right: "" }] });
      }

      function removePair(i) {
        const next = pairs.filter((_, idx) => idx !== i);
        patchConfig({ pairs: next.length ? next : [{ left: "", right: "" }] });
      }

      return (
        <div className="space-y-4">
          <Field label="Pairs" hint="Left = Armenian, Right = Translation (or vice versa)">
            <div className="space-y-2">
              {pairs.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <Input value={p.left ?? ""} onChange={(e) => updatePair(i, { left: e.target.value })} placeholder="Left" />
                  <div className="flex gap-2">
                    <Input
                      value={p.right ?? ""}
                      onChange={(e) => updatePair(i, { right: e.target.value })}
                      placeholder="Right"
                    />
                    <Button type="button" variant="secondary" onClick={() => removePair(i)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Button type="button" variant="secondary" onClick={addPair}>
                Add pair
              </Button>
            </div>
          </Field>
        </div>
      );
    }

    // audio_choice_tts
    if (kind === "audio_choice_tts") {
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;

      return (
        <div className="space-y-4">
          <Field label="Prompt text shown to student (optional)">
            <Input
              value={cfg.promptText ?? ""}
              onChange={(e) => patchConfig({ promptText: e.target.value })}
              placeholder="Listen and choose..."
            />
          </Field>

          <Field label="Text that will be spoken (TTS)">
            <Input value={cfg.ttsText ?? ""} onChange={(e) => patchConfig({ ttsText: e.target.value })} placeholder="Բարև" />
          </Field>

          <Field label="Choices + correct answer">
            <OptionsEditor
              choices={choices}
              setChoices={(next) => patchConfig({ choices: next })}
              correctIndices={[correctIndex]}
              setCorrectIndices={(arr) => patchConfig({ answerIndex: arr?.[0] ?? 0 })}
              mode="single"
            />
          </Field>
        </div>
      );
    }

    // char_build_word
    if (kind === "char_build_word") {
      const tiles = Array.isArray(cfg.tiles) ? cfg.tiles : [];
      const solutionIndices = Array.isArray(cfg.solutionIndices) ? cfg.solutionIndices : [];
      return (
        <div className="space-y-4">
          <Field label="Tiles (letters student clicks)">
            <ChipsEditor items={tiles} onChange={(next) => patchConfig({ tiles: next })} placeholder="Add tile..." />
          </Field>

          <Field label="Target word (optional)">
            <Input value={cfg.targetWord ?? ""} onChange={(e) => patchConfig({ targetWord: e.target.value })} placeholder="ԱՐՄԵՆ" />
          </Field>

          <Field label="Solution indices" hint="Indices into tiles array (example: 0,1,2...). Use commas.">
            <Input
              value={(solutionIndices || []).join(",")}
              onChange={(e) => {
                const raw = e.target.value;
                const parts = raw
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .map((x) => Number(x))
                  .filter((n) => Number.isFinite(n));
                patchConfig({ solutionIndices: parts });
              }}
              placeholder="0,1,2,3"
            />
          </Field>
        </div>
      );
    }

    // multi_select (teacher-friendly requirement)
    if (kind === "multi_select") {
      const question = cfg.question ?? "";
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      const correctIndices = Array.isArray(cfg.correctIndices) ? cfg.correctIndices : [];

      return (
        <div className="space-y-4">
          <Field label="Question (what student sees)">
            <Input value={question} onChange={(e) => patchConfig({ question: e.target.value })} />
          </Field>

          <Field label="Choices + correct answers" hint="Tick ALL correct answers">
            <OptionsEditor
              choices={choices}
              setChoices={(next) => patchConfig({ choices: next })}
              correctIndices={correctIndices}
              setCorrectIndices={(arr) => patchConfig({ correctIndices: arr })}
              mode="multi"
            />
          </Field>

          <div className="text-xs text-slate-500">
            This saves as <code className="px-1 rounded bg-slate-100">config.correctIndices</code>.
          </div>
        </div>
      );
    }

    // fallback: still allow teacher editing of config text
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        This kind doesn’t have a guided editor yet. Use Advanced JSON below.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-slate-900">
            {isNew ? "New exercise" : `Edit exercise #${exercise.id}`}
          </div>
          <div className="text-xs text-slate-500">Lesson ID: {lessonId}</div>
        </div>

        <div className="flex gap-2">
          {!isNew ? (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={saving}>
              Delete
            </Button>
          ) : null}
          {onCancel ? (
            <Button type="button" variant="secondary" onClick={() => onCancel?.()} disabled={saving}>
              Cancel
            </Button>
          ) : null}
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Field label="Type (kind)">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Order" hint="Position inside the lesson">
          <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} min={1} />
        </Field>

        <Field label="XP" hint="XP granted for this exercise">
          <Input type="number" value={xp} onChange={(e) => setXp(e.target.value)} min={0} />
        </Field>

        <Field label="Prompt" hint="Short instruction (optional, but recommended)">
          <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Choose the correct..." />
        </Field>
      </div>

      {/* Teacher UI */}
      <div className="space-y-3">
        <div className="text-sm font-extrabold text-slate-900">Exercise setup</div>
        {renderKindUI()}
      </div>

      {/* Pronunciation / Audio (NEW) */}
      <div className="space-y-3">
        <div className="text-sm font-extrabold text-slate-900">Pronunciation (Audio)</div>

        {isNew ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Save the exercise first, then you can add recordings (male/female) or generate AI audio.
          </div>
        ) : (
          <AudioManager
            exerciseId={exercise.id}
            exerciseText={deriveExerciseAudioText()}
          />
        )}
      </div>

      {/* Advanced JSON */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-extrabold text-slate-900">Advanced (JSON)</div>
          <Button type="button" variant="secondary" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? "Hide" : "Show"}
          </Button>
        </div>

        {showAdvanced ? (
          <div className="mt-3 space-y-2">
            {!cfgValid ? (
              <div className="text-sm text-rose-700">Invalid JSON. Fix it below or switch kind to reset template.</div>
            ) : (
              <div className="text-xs text-slate-500">You usually don’t need this. It exists for edge-cases.</div>
            )}

            <Textarea rows={12} value={configText} onChange={(e) => setConfigText(e.target.value)} />

            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setConfigText(jsonPretty(defaultConfigForKind(kind)))}>
                Reset template
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const parsed = safeParseJson(configText);
                  if (parsed === null) return;
                  saveConfigObj(parsed);
                }}
              >
                Prettify
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
