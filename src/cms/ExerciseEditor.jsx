// src/cms/ExerciseEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { cmsApi } from "./api";
import AudioTargetsManager from "./AudioTargetsManager";

/**
 * Teacher-friendly Exercise Editor
 * - Structured UI per kind
 * - Still supports Advanced JSON editing
 */

export const KIND_OPTIONS = [
  { value: "char_intro", label: "Letter intro (char_intro)" },
  { value: "char_mcq_sound", label: "Sound MCQ (char_mcq_sound)" },
  { value: "letter_recognition", label: "Letter recognition (letter_recognition)" },
  { value: "char_build_word", label: "Build word (char_build_word)" },
  { value: "letter_typing", label: "Type letter (letter_typing)" },
  { value: "word_spelling", label: "Spell word (word_spelling)" },

  { value: "fill_blank", label: "Fill blank (fill_blank)" },
  { value: "select_missing_word", label: "Complete the sentence (select_missing_word)" },
  { value: "translate_mcq", label: "Translate MCQ (translate_mcq)" },
  { value: "word_bank", label: "Translate — word bank (word_bank)" },
  { value: "listen_type", label: "Listen & type (listen_type)" },
  { value: "listen_word_bank", label: "Tap what you hear (listen_word_bank)" },
  { value: "true_false", label: "True/False (true_false)" },
  { value: "sentence_order", label: "Sentence order (sentence_order)" },
  { value: "dialogue_mcq", label: "Complete the conversation (dialogue_mcq)" },
  { value: "dialogue_order", label: "Order the conversation (dialogue_order)" },
  { value: "match_pairs", label: "Match pairs (match_pairs)" },
  { value: "image_select", label: "Pick the picture (image_select)" },
  { value: "reading_comprehension", label: "Reading comprehension (reading_comprehension)" },
  { value: "minimal_pairs", label: "Which did you hear? (minimal_pairs)" },
  { value: "categorize", label: "Sort into groups (categorize)" },
  { value: "highlight_grammar", label: "Tap the word(s) (highlight_grammar)" },
  { value: "conjugation", label: "Conjugation table (conjugation)" },
  { value: "flashcard", label: "Flashcard (flashcard)" },
  { value: "speak_line", label: "Say your line (speak_line)" },
  { value: "write_translate", label: "Open writing (write_translate)" },
  { value: "audio_choice_tts", label: "Audio choice TTS (audio_choice_tts)" },

  { value: "multi_select", label: "Multi-select (multi_select)" },

  { value: "speak", label: "Speak / pronounce (speak)" },
];

// Groups the ~28 exercise kinds into teacher-facing categories. Used to
// group the exercise picker in LessonEditor's reading-lesson builder.
export const KIND_CATEGORY = {
  char_intro: "Alphabet & Sounds",
  char_mcq_sound: "Alphabet & Sounds",
  letter_recognition: "Alphabet & Sounds",
  char_build_word: "Alphabet & Sounds",
  letter_typing: "Alphabet & Sounds",
  minimal_pairs: "Alphabet & Sounds",

  translate_mcq: "Vocabulary",
  word_bank: "Vocabulary",
  flashcard: "Vocabulary",
  image_select: "Vocabulary",
  categorize: "Vocabulary",

  listen_type: "Listening & Speaking",
  listen_word_bank: "Listening & Speaking",
  audio_choice_tts: "Listening & Speaking",
  speak: "Listening & Speaking",
  speak_line: "Listening & Speaking",

  word_spelling: "Writing & Spelling",
  fill_blank: "Writing & Spelling",
  select_missing_word: "Writing & Spelling",
  write_translate: "Writing & Spelling",

  true_false: "Grammar",
  highlight_grammar: "Grammar",
  conjugation: "Grammar",
  multi_select: "Grammar",

  sentence_order: "Reading & Conversation",
  dialogue_mcq: "Reading & Conversation",
  dialogue_order: "Reading & Conversation",
  match_pairs: "Reading & Conversation",
  reading_comprehension: "Reading & Conversation",
};

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
      <div className="text-sm font-extrabold text-slate-700">{label}</div>
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
        "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 " +
        "focus:bg-white focus:ring-brand-400 focus:outline-none"
      }
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 " +
        "focus:bg-white focus:ring-brand-400 focus:outline-none"
      }
    />
  );
}

function Button({ variant = "primary", className = "", ...props }) {
  const base = "btn3d text-sm";
  const styles =
    variant === "primary"
      ? "btn3d-brand"
      : variant === "danger"
      ? "btn3d-cardinal"
      : "btn3d-neutral";
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
            className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800 ring-1 ring-brand-200"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-brand-500 hover:text-brand-700"
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
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 ring-1 ring-slate-200 shadow-sm"
            >
              <input
                type={mode === "single" ? "radio" : "checkbox"}
                checked={checked}
                onChange={() => toggleCorrect(i)}
                className="accent-brand-500"
              />
              <div className="flex-1 text-sm font-semibold text-slate-800">{c}</div>
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

    case "speak":
      return { acceptedAnswers: [], language_code: "hye" };

    case "listen_type":
      return { ttsText: "Բարև", acceptedAnswers: [], hint: "" };
    case "word_bank":
      return {
        sentence: "Hello, how are you?",
        tiles: ["Բարև", "ինչպես", "ես", "դու", "շնորհակալ"],
        solution: ["Բարև", "ինչպես", "ես"],
      };
    case "select_missing_word":
      return { before: "Ես", after: "ուսանող", choices: ["եմ", "ես", "է"], answerIndex: 0 };

    case "listen_word_bank":
      return { ttsText: "Բարև ինչպես ես", tiles: ["Բարև", "ինչպես", "ես", "դու", "լավ"], solution: ["Բարև", "ինչպես", "ես"] };
    case "dialogue_mcq":
      return {
        lines: [{ from: "them", text: "Բարև! Ինչպե՞ս ես" }],
        choices: ["Լավ եմ, շնորհակալություն", "Ցտեսություն", "Ոչ"],
        answerIndex: 0,
      };
    case "dialogue_order":
      return {
        lines: ["Բարև!", "Ինչպե՞ս ես", "Լավ եմ, շնորհակալություն"],
        solution: ["Բարև!", "Ինչպե՞ս ես", "Լավ եմ, շնորհակալություն"],
      };
    case "image_select":
      return { choices: [{ image: "", label: "խնձոր" }, { image: "", label: "հաց" }, { image: "", label: "ջուր" }, { image: "", label: "կաթ" }], answerIndex: 0 };
    case "reading_comprehension":
      return { passage: "", question: "", choices: ["", ""], answerIndex: 0 };
    case "minimal_pairs":
      return { ttsText: "բար", choices: ["բար", "պար"], answerIndex: 0 };

    case "categorize":
      return { buckets: ["Food", "Drink"], items: [{ text: "հաց", bucket: "Food" }, { text: "ջուր", bucket: "Drink" }, { text: "խնձոր", bucket: "Food" }, { text: "կաթ", bucket: "Drink" }] };
    case "highlight_grammar":
      return { tokens: ["Ես", "սիրում", "եմ", "հայերեն"], correctIndices: [1] };
    case "conjugation":
      return { verb: "լինել (to be)", cells: [{ label: "Ես (I)", answer: "եմ" }, { label: "Դու (you)", answer: "ես" }, { label: "Նա (he/she)", answer: "է" }] };
    case "flashcard":
      return { front: "Շնորհակալություն", back: "Thank you", hint: "" };
    case "speak_line":
      return { lines: [{ from: "them", text: "Բարև! Ինչպե՞ս ես" }], target: "Լավ եմ, շնորհակալություն", language_code: "hye" };
    case "write_translate":
      return { source: "I am learning Armenian", acceptedAnswers: ["Ես հայերեն եմ սովորում", "Ես սովորում եմ հայերեն"] };

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
        <div className="rounded-2xl bg-cardinal-50 p-3 text-sm font-semibold text-cardinal-800 ring-1 ring-cardinal-200">
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

    // speak: student records their voice; we transcribe (ElevenLabs Scribe) and compare.
    if (kind === "speak") {
      const accepted = Array.isArray(cfg.acceptedAnswers) ? cfg.acceptedAnswers : [];
      return (
        <div className="space-y-4">
          <Field
            label="Target phrase (what the student should say)"
            hint="The learner sees this, taps the mic, and speaks it. We transcribe and compare."
          >
            <Input value={expectedAnswer} onChange={(e) => setExpectedAnswer(e.target.value)} placeholder="Բարև Ձեզ" />
          </Field>
          <Field label="Also accept (optional)" hint="Comma-separated alternative phrasings that should also count as correct.">
            <Input
              value={accepted.join(", ")}
              onChange={(e) =>
                patchConfig({
                  acceptedAnswers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="բարև, ողջույն"
            />
          </Field>
          <Field label="Language code" hint="ElevenLabs ISO-639-3 code. Armenian = hye.">
            <Input value={cfg.language_code ?? "hye"} onChange={(e) => patchConfig({ language_code: e.target.value.trim() })} />
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
          <div className="text-xs font-semibold text-slate-500">Tip: keep answer identical to a choice (same letter).</div>
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
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input type="radio" checked={cfg.correct === true} onChange={() => patchConfig({ correct: true })} className="accent-brand-500" />
                True
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <input type="radio" checked={cfg.correct === false} onChange={() => patchConfig({ correct: false })} className="accent-brand-500" />
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

          <div className="text-xs font-semibold text-slate-500">
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
                  className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200 shadow-sm"
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

          <div className="text-xs font-semibold text-slate-500">
            This saves as <code className="px-1 rounded bg-slate-100 text-slate-700">config.correctIndices</code>.
          </div>
        </div>
      );
    }

    // listen_type (dictation): hear audio, type what you heard
    if (kind === "listen_type") {
      const accepted = Array.isArray(cfg.acceptedAnswers) ? cfg.acceptedAnswers : [];
      return (
        <div className="space-y-4">
          <Field label="Text spoken & expected" hint="The student hears this (TTS / recording) and must type it back.">
            <Input value={cfg.ttsText ?? ""} onChange={(e) => patchConfig({ ttsText: e.target.value })} placeholder="Բարև Ձեզ" />
          </Field>
          <Field label="Also accept (optional)" hint="Comma-separated alternative spellings that should also count.">
            <Input
              value={accepted.join(", ")}
              onChange={(e) => patchConfig({ acceptedAnswers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              placeholder="բարև, ողջույն"
            />
          </Field>
          <Field label="Hint (optional)">
            <Input value={cfg.hint ?? ""} onChange={(e) => patchConfig({ hint: e.target.value })} />
          </Field>
          <div className="text-xs font-semibold text-slate-500">Add a recording or generate AI audio below so the student can listen.</div>
        </div>
      );
    }

    // word_bank: translate by tapping word tiles (with distractors)
    if (kind === "word_bank") {
      const tiles = Array.isArray(cfg.tiles) ? cfg.tiles : [];
      const solution = Array.isArray(cfg.solution) ? cfg.solution : [];
      return (
        <div className="space-y-4">
          <Field label="Sentence to translate" hint="Shown above the word bank (e.g. the English prompt).">
            <Input value={cfg.sentence ?? ""} onChange={(e) => patchConfig({ sentence: e.target.value })} placeholder="Hello, how are you?" />
          </Field>
          <Field label="Word tiles" hint="All tappable words — include a few distractors the student must avoid.">
            <ChipsEditor items={tiles} onChange={(next) => patchConfig({ tiles: next })} placeholder="Add a word tile..." />
          </Field>
          <Field label="Correct answer (in order)" hint="The words that form the answer, in sequence. All must appear in the tiles above.">
            <ChipsEditor items={solution} onChange={(next) => patchConfig({ solution: next })} placeholder="Add solution word in order..." />
          </Field>
        </div>
      );
    }

    // select_missing_word: complete the sentence (cloze MCQ)
    if (kind === "select_missing_word") {
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Text before the gap">
              <Input value={cfg.before ?? ""} onChange={(e) => patchConfig({ before: e.target.value })} placeholder="Ես" />
            </Field>
            <Field label="Text after the gap">
              <Input value={cfg.after ?? ""} onChange={(e) => patchConfig({ after: e.target.value })} placeholder="ուսանող" />
            </Field>
          </div>
          <Field label="Choices + correct answer" hint="The word that fills the gap.">
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

    // listen_word_bank: hear a sentence, tap tiles to rebuild it
    if (kind === "listen_word_bank") {
      const tiles = Array.isArray(cfg.tiles) ? cfg.tiles : [];
      const solution = Array.isArray(cfg.solution) ? cfg.solution : [];
      return (
        <div className="space-y-4">
          <Field label="Sentence spoken (TTS) & expected answer" hint="The learner hears this and rebuilds it from tiles.">
            <Input value={cfg.ttsText ?? ""} onChange={(e) => patchConfig({ ttsText: e.target.value })} placeholder="Բարև ինչպես ես" />
          </Field>
          <Field label="Word tiles" hint="Include a few distractor words.">
            <ChipsEditor items={tiles} onChange={(next) => patchConfig({ tiles: next })} placeholder="Add a word tile..." />
          </Field>
          <Field label="Correct order (solution)" hint="The exact words of the sentence, in order.">
            <ChipsEditor items={solution} onChange={(next) => patchConfig({ solution: next })} placeholder="Add solution word in order..." />
          </Field>
        </div>
      );
    }

    // dialogue_mcq: complete the conversation by choosing the missing reply
    if (kind === "dialogue_mcq") {
      const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;
      const updLine = (i, patch) => patchConfig({ lines: lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
      return (
        <div className="space-y-4">
          <Field label="Conversation" hint="Lines shown as a chat. The learner picks the missing reply.">
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={l.from || "them"}
                    onChange={(e) => updLine(i, { from: e.target.value })}
                    className="rounded-2xl bg-slate-50 px-3 py-2.5 text-sm font-semibold ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
                  >
                    <option value="them">Them</option>
                    <option value="you">You</option>
                  </select>
                  <Input value={l.text || ""} onChange={(e) => updLine(i, { text: e.target.value })} placeholder="Line text" />
                  <Button type="button" variant="secondary" onClick={() => patchConfig({ lines: lines.filter((_, idx) => idx !== i) })}>Remove</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => patchConfig({ lines: [...lines, { from: "them", text: "" }] })}>Add line</Button>
            </div>
          </Field>
          <Field label="Reply choices + correct answer">
            <OptionsEditor choices={choices} setChoices={(next) => patchConfig({ choices: next })} correctIndices={[correctIndex]} setCorrectIndices={(arr) => patchConfig({ answerIndex: arr?.[0] ?? 0 })} mode="single" />
          </Field>
        </div>
      );
    }

    // dialogue_order: arrange the conversation lines
    if (kind === "dialogue_order") {
      const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
      const solution = Array.isArray(cfg.solution) ? cfg.solution : [];
      return (
        <div className="space-y-4">
          <Field label="Conversation lines" hint="Shown shuffled to the learner.">
            <ChipsEditor items={lines} onChange={(next) => patchConfig({ lines: next })} placeholder="Add a line..." />
          </Field>
          <Field label="Correct order" hint="The same lines, in the right sequence.">
            <ChipsEditor items={solution} onChange={(next) => patchConfig({ solution: next })} placeholder="Add line in correct order..." />
          </Field>
        </div>
      );
    }

    // image_select: pick the correct picture
    if (kind === "image_select") {
      const items = Array.isArray(cfg.choices) ? cfg.choices : [];
      const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;
      const upd = (i, patch) => patchConfig({ choices: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
      return (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-500">Paste an image URL for each option and tick the correct one.</div>
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
              <input type="radio" checked={correctIndex === i} onChange={() => patchConfig({ answerIndex: i })} className="accent-brand-500" title="Correct" />
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-50">
                {it.image ? <img src={it.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <Input value={it.image || ""} onChange={(e) => upd(i, { image: e.target.value })} placeholder="Image URL (https://…)" />
              <Input value={it.label || ""} onChange={(e) => upd(i, { label: e.target.value })} placeholder="Label" />
              <Button type="button" variant="secondary" onClick={() => patchConfig({ choices: items.filter((_, idx) => idx !== i) })}>✕</Button>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => patchConfig({ choices: [...items, { image: "", label: "" }] })}>Add image option</Button>
        </div>
      );
    }

    // reading_comprehension: passage + question + MCQ
    if (kind === "reading_comprehension") {
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;
      return (
        <div className="space-y-4">
          <Field label="Passage"><Textarea value={cfg.passage ?? ""} onChange={(e) => patchConfig({ passage: e.target.value })} placeholder="Short reading passage…" /></Field>
          <Field label="Question"><Input value={cfg.question ?? ""} onChange={(e) => patchConfig({ question: e.target.value })} placeholder="What does the text say about…?" /></Field>
          <Field label="Answers + correct answer">
            <OptionsEditor choices={choices} setChoices={(next) => patchConfig({ choices: next })} correctIndices={[correctIndex]} setCorrectIndices={(arr) => patchConfig({ answerIndex: arr?.[0] ?? 0 })} mode="single" />
          </Field>
        </div>
      );
    }

    // minimal_pairs: which similar-sounding word did you hear?
    if (kind === "minimal_pairs") {
      const choices = Array.isArray(cfg.choices) ? cfg.choices : [];
      const correctIndex = Number.isFinite(cfg.answerIndex) ? Number(cfg.answerIndex) : 0;
      return (
        <div className="space-y-4">
          <Field label="Word spoken (TTS)" hint="Must match the correct choice exactly.">
            <Input value={cfg.ttsText ?? ""} onChange={(e) => patchConfig({ ttsText: e.target.value })} placeholder="բար" />
          </Field>
          <Field label="Choices + correct (the one that was spoken)">
            <OptionsEditor choices={choices} setChoices={(next) => patchConfig({ choices: next })} correctIndices={[correctIndex]} setCorrectIndices={(arr) => patchConfig({ answerIndex: arr?.[0] ?? 0 })} mode="single" />
          </Field>
        </div>
      );
    }

    // categorize: words sorted into buckets
    if (kind === "categorize") {
      const buckets = Array.isArray(cfg.buckets) ? cfg.buckets : [];
      const items = Array.isArray(cfg.items) ? cfg.items : [];
      const updItem = (i, patch) => patchConfig({ items: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
      return (
        <div className="space-y-4">
          <Field label="Groups (buckets)" hint="The categories learners sort into.">
            <ChipsEditor items={buckets} onChange={(next) => patchConfig({ buckets: next })} placeholder="Add a group..." />
          </Field>
          <Field label="Items + their correct group">
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={it.text || ""} onChange={(e) => updItem(i, { text: e.target.value })} placeholder="Word" />
                  <select value={it.bucket || ""} onChange={(e) => updItem(i, { bucket: e.target.value })} className="rounded-2xl bg-slate-50 px-3 py-2.5 text-sm font-semibold ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none">
                    <option value="">— group —</option>
                    {buckets.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <Button type="button" variant="secondary" onClick={() => patchConfig({ items: items.filter((_, idx) => idx !== i) })}>✕</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => patchConfig({ items: [...items, { text: "", bucket: "" }] })}>Add item</Button>
            </div>
          </Field>
        </div>
      );
    }

    // highlight_grammar: tap the right token(s)
    if (kind === "highlight_grammar") {
      const tokens = Array.isArray(cfg.tokens) ? cfg.tokens : [];
      const correctIndices = Array.isArray(cfg.correctIndices) ? cfg.correctIndices.map(Number) : [];
      const toggle = (i) => {
        const has = correctIndices.includes(i);
        patchConfig({ correctIndices: (has ? correctIndices.filter((x) => x !== i) : [...correctIndices, i]).sort((a, b) => a - b) });
      };
      return (
        <div className="space-y-4">
          <Field label="Sentence tokens" hint="Each chip is a tappable word.">
            <ChipsEditor items={tokens} onChange={(next) => patchConfig({ tokens: next })} placeholder="Add a word..." />
          </Field>
          <Field label="Correct word(s)" hint="Tick the words the learner should tap.">
            <div className="flex flex-wrap gap-2">
              {tokens.map((t, i) => (
                <button key={i} type="button" onClick={() => toggle(i)}
                  className={cx("rounded-2xl px-3 py-2 text-sm font-bold ring-2 transition", correctIndices.includes(i) ? "bg-grass-50 text-grass-700 ring-grass-400" : "bg-white text-slate-600 ring-slate-200")}>{t}</button>
              ))}
            </div>
          </Field>
        </div>
      );
    }

    // conjugation: paradigm table
    if (kind === "conjugation") {
      const cells = Array.isArray(cfg.cells) ? cfg.cells : [];
      const updCell = (i, patch) => patchConfig({ cells: cells.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
      return (
        <div className="space-y-4">
          <Field label="Verb (shown to the learner)">
            <Input value={cfg.verb ?? ""} onChange={(e) => patchConfig({ verb: e.target.value })} placeholder="լինել (to be)" />
          </Field>
          <Field label="Forms" hint="Label (e.g. “Ես (I)”) + the form the learner must type.">
            <div className="space-y-2">
              {cells.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={c.label || ""} onChange={(e) => updCell(i, { label: e.target.value })} placeholder="Ես (I)" />
                  <Input value={c.answer || ""} onChange={(e) => updCell(i, { answer: e.target.value })} placeholder="answer" />
                  <Button type="button" variant="secondary" onClick={() => patchConfig({ cells: cells.filter((_, idx) => idx !== i) })}>✕</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => patchConfig({ cells: [...cells, { label: "", answer: "" }] })}>Add form</Button>
            </div>
          </Field>
        </div>
      );
    }

    // flashcard: front / back
    if (kind === "flashcard") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Front (prompt)"><Input value={cfg.front ?? ""} onChange={(e) => patchConfig({ front: e.target.value })} placeholder="Շնորհակալություն" /></Field>
            <Field label="Back (answer)"><Input value={cfg.back ?? ""} onChange={(e) => patchConfig({ back: e.target.value })} placeholder="Thank you" /></Field>
          </div>
          <Field label="Hint (optional)"><Input value={cfg.hint ?? ""} onChange={(e) => patchConfig({ hint: e.target.value })} /></Field>
        </div>
      );
    }

    // speak_line: say your line in a conversation
    if (kind === "speak_line") {
      const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
      const updLine = (i, patch) => patchConfig({ lines: lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
      return (
        <div className="space-y-4">
          <Field label="Conversation (the lines before the learner speaks)">
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select value={l.from || "them"} onChange={(e) => updLine(i, { from: e.target.value })} className="rounded-2xl bg-slate-50 px-3 py-2.5 text-sm font-semibold ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none">
                    <option value="them">Them</option>
                    <option value="you">You</option>
                  </select>
                  <Input value={l.text || ""} onChange={(e) => updLine(i, { text: e.target.value })} placeholder="Line text" />
                  <Button type="button" variant="secondary" onClick={() => patchConfig({ lines: lines.filter((_, idx) => idx !== i) })}>Remove</Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => patchConfig({ lines: [...lines, { from: "them", text: "" }] })}>Add line</Button>
            </div>
          </Field>
          <Field label="The line the learner must say" hint="They record it; we transcribe and compare.">
            <Input value={cfg.target ?? ""} onChange={(e) => patchConfig({ target: e.target.value })} placeholder="Լավ եմ, շնորհակալություն" />
          </Field>
          <Field label="Language code" hint="ElevenLabs ISO-639-3. Armenian = hye.">
            <Input value={cfg.language_code ?? "hye"} onChange={(e) => patchConfig({ language_code: e.target.value.trim() })} />
          </Field>
        </div>
      );
    }

    // write_translate: open writing graded against accepted answers
    if (kind === "write_translate") {
      const accepted = Array.isArray(cfg.acceptedAnswers) ? cfg.acceptedAnswers : [];
      return (
        <div className="space-y-4">
          <Field label="Prompt to translate / write" hint="Shown above the writing box.">
            <Input value={cfg.source ?? ""} onChange={(e) => patchConfig({ source: e.target.value })} placeholder="I am learning Armenian" />
          </Field>
          <Field label="Accepted answers" hint="List every correct phrasing (order/spelling variations).">
            <ChipsEditor items={accepted} onChange={(next) => patchConfig({ acceptedAnswers: next })} placeholder="Add an accepted answer..." />
          </Field>
          <div className="text-xs font-semibold text-slate-500">Tip: list a few valid variants. (AI grading for free variations can be added later.)</div>
        </div>
      );
    }

    // fallback: still allow teacher editing of config text
    return (
      <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
        This kind doesn’t have a guided editor yet. Use Advanced JSON below.
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 space-y-5 ring-1 ring-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-extrabold text-slate-900">
            {isNew ? "New exercise" : `Edit exercise #${exercise.id}`}
          </div>
          <div className="text-xs font-semibold text-slate-500">Lesson ID: {lessonId}</div>
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
            className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
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
        <div className="font-display text-sm font-extrabold text-slate-900">Exercise setup</div>
        {renderKindUI()}
      </div>

      {/* Pronunciation / Audio (NEW) */}
      <div className="space-y-3">
        <div className="font-display text-sm font-extrabold text-slate-900">Pronunciation (Audio)</div>

        {isNew ? (
          <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            Save the exercise first, then you can add recordings (male/female) or generate AI audio.
          </div>
        ) : (
          <AudioTargetsManager
            exercise={{
              id: exercise.id,
              kind: exercise.kind,
              prompt: exercise.prompt,
              config: exercise.config,
            }}
          />
        )}
      </div>

      {/* Advanced JSON */}
      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-2">
          <div className="font-display text-sm font-extrabold text-slate-900">Advanced (JSON)</div>
          <Button type="button" variant="secondary" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? "Hide" : "Show"}
          </Button>
        </div>

        {showAdvanced ? (
          <div className="mt-3 space-y-2">
            {!cfgValid ? (
              <div className="text-sm font-semibold text-cardinal-700">Invalid JSON. Fix it below or switch kind to reset template.</div>
            ) : (
              <div className="text-xs font-semibold text-slate-500">You usually don’t need this. It exists for edge-cases.</div>
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
