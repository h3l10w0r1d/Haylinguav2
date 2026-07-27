// src/cms/CmsExerciseLab.jsx
// Exercise Lab — a sandbox to preview and test every exercise kind. Pick a
// kind, see it rendered live with a sample config, actually answer it and see
// the grading result, and edit the config JSON to try your own content. Uses
// the real renderers (ExerciseRenderer / Phase2Exercise) with no persistence
// (no attempts posted, no hearts spent), so it's safe to click around.
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCmsToken } from "./api";
import CmsLayout from "./CmsLayout";
import { RotateCcw, Play, CheckCircle2, XCircle } from "lucide-react";
import ExerciseRenderer from "../ExerciseRenderer";
import Phase2Exercise from "../Phase2Exercise";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

// Kinds that route through Phase2Exercise (must match LessonPlayer's set).
const PHASE2_KINDS = new Set([
  "translate_mcq", "true_false", "fill_blank", "letter_typing", "word_spelling",
  "sentence_order", "char_build_word", "letter_recognition", "char_mcq_sound",
]);

// Representative sample per kind. Grouped for the picker. `config` is what the
// editor pre-fills; `prompt`/`expected_answer` sit on the exercise row.
const SAMPLES = [
  // ---- Multiple choice & selection ----
  { kind: "translate_mcq", group: "Choice", prompt: "How do you say “Hello”?",
    config: { sentence: "Hello", choices: ["Բարև", "Ցտեսություն", "Շնորհակալություն", "Այո"], answerIndex: 0 } },
  { kind: "select_missing_word", group: "Choice", prompt: "Complete the sentence.",
    config: { before: "Բարև", after: "", choices: ["ձեզ", "շնորհակալ", "այո"], answerIndex: 0 } },
  { kind: "multi_select", group: "Choice", prompt: "Select all the greetings.",
    config: { choices: ["Բարև", "Շնորհակալություն", "Բարի լույս", "Այո"], correctIndices: [0, 2] } },
  { kind: "true_false", group: "Choice", prompt: "True or False?",
    config: { statement: "«Բարև» means “hello”.", correct: true } },
  { kind: "image_select", group: "Choice", prompt: "Which is the cat?",
    config: { choices: [{ emoji: "🐱", label: "cat" }, { emoji: "🐶", label: "dog" }, { emoji: "🐟", label: "fish" }, { emoji: "🍎", label: "apple" }], answerIndex: 0 } },

  // ---- Typing & production ----
  { kind: "fill_blank", group: "Typing", prompt: "Fill in the blank.",
    config: { before: "Ես", after: "եմ", answers: ["ուսանող"] } },
  { kind: "inflect", group: "Typing", prompt: "Change the word to the form shown",
    config: { base: "գիրք", baseGloss: "book", target: "“the …” (definite)", answer: "գիրքը" } },
  { kind: "write_translate", group: "Typing", prompt: "Write in Armenian: “I am a student.”",
    config: { source: "I am a student.", acceptedAnswers: ["Ես ուսանող եմ"] } },

  // ---- Build & order ----
  { kind: "sentence_order", group: "Build", prompt: "Arrange: “I am a student.”",
    config: { tokens: ["Ես", "ուսանող", "եմ"], solution: ["Ես", "ուսանող", "եմ"] } },
  { kind: "word_bank", group: "Build", prompt: "Translate this",
    config: { sentence: "Ես կարդում եմ գիրքը", tiles: ["I", "read", "the", "book", "eat", "man"], solution: ["I", "read", "the", "book"] } },

  // ---- Match & sort ----
  { kind: "match_pairs", group: "Match", prompt: "Match each word to its meaning.",
    config: { pairs: [{ left: "Բարև", right: "Hello" }, { left: "Ջուր", right: "Water" }, { left: "Հաց", right: "Bread" }] } },
  { kind: "categorize", group: "Match", prompt: "Sort: food or drink?",
    config: { buckets: ["Food", "Drink"], items: [{ text: "հաց", bucket: "Food" }, { text: "սուրճ", bucket: "Drink" }, { text: "խնձոր", bucket: "Food" }] } },
  { kind: "highlight_grammar", group: "Match", prompt: "Tap the verb.",
    config: { tokens: ["Ես", "հայերեն", "սովորում", "եմ"], correctIndices: [2] } },

  // ---- Listening & speaking ----
  { kind: "listen_type", group: "Audio", prompt: "Type what you hear",
    config: { ttsText: "Բարև ձեզ", acceptedAnswers: ["Բարև ձեզ"] } },
  { kind: "listen_word_bank", group: "Audio", prompt: "Tap what you hear",
    config: { ttsText: "Ես ուսանող եմ", tiles: ["Ես", "ուսանող", "եմ", "ուսուցիչ"], solution: ["Ես", "ուսանող", "եմ"] } },
  { kind: "listen_image", group: "Audio", prompt: "Which one do you hear?",
    config: { ttsText: "կատու", choices: [{ emoji: "🐱", label: "cat" }, { emoji: "🐶", label: "dog" }, { emoji: "🐟", label: "fish" }, { emoji: "🐦", label: "bird" }], answerIndex: 0 } },
  { kind: "speak", group: "Audio", prompt: "Say the phrase out loud",
    config: { answer: "Բարև ձեզ", romanization: "barev dzez" } },

  // ---- Grammar ----
  { kind: "conjugation", group: "Grammar", prompt: "Conjugate: խոսել (present)",
    config: { verb: "խոսել", cells: [{ label: "Ես (I)", answer: "խոսում եմ" }, { label: "Դու (you)", answer: "խոսում ես" }, { label: "Նա (he/she)", answer: "խոսում է" }] } },

  // ---- Reading, story, radio ----
  { kind: "reading_comprehension", group: "Reading", prompt: "What does the person drink?",
    config: { passage: "Ամեն օր ես սուրճ եմ խմում։", question: "What does the person drink?", choices: ["Coffee", "Tea", "Water", "Milk"], answerIndex: 0 } },
  { kind: "story", group: "Reading", prompt: "At the Café",
    config: { title: "At the Café", lines: [{ speaker: "Անի", text: "Բարև ձեզ։", translation: "Hello." }, { speaker: "Մատուցող", text: "Ի՞նչ եք ուզում։", translation: "What would you like?" }, { speaker: "Անի", text: "Մեկ սուրճ, խնդրում եմ։", translation: "One coffee, please." }], question: "What did Ani order?", choices: ["Coffee", "Tea", "Water", "Bread"], answerIndex: 0 } },
  { kind: "radio", group: "Reading", prompt: "Ani's Day",
    config: { title: "Ani's Day", segments: [{ text: "Ես ուսանող եմ։", translation: "I'm a student.", question: "What is Ani?", choices: ["A student", "A teacher", "A doctor", "A waiter"], answerIndex: 0 }, { text: "Ես հայերեն եմ սովորում։", translation: "I study Armenian.", question: "What does Ani study?", choices: ["Armenian", "English", "Math", "Music"], answerIndex: 0 }] } },

  // ---- Alphabet ----
  { kind: "trace_letter", group: "Alphabet", prompt: "Trace: Ա",
    config: { letter: "Ա", romanization: "a", audioText: "ա" } },
];

let _labId = 0;

export default function CmsExerciseLab() {
  const token = getCmsToken();
  const [idx, setIdx] = useState(0);
  const [configText, setConfigText] = useState(() => JSON.stringify(SAMPLES[0].config, null, 2));
  const [nonce, setNonce] = useState(1);
  const [result, setResult] = useState(null);
  const [p2, setP2] = useState(null);
  const [error, setError] = useState(null);

  const sample = SAMPLES[idx];

  function loadKind(i) {
    setIdx(i);
    setConfigText(JSON.stringify(SAMPLES[i].config, null, 2));
    setResult(null); setP2(null); setError(null);
    setNonce((n) => n + 1);
  }
  function rerun() { setResult(null); setP2(null); setNonce((n) => n + 1); }
  function resetConfig() { setConfigText(JSON.stringify(sample.config, null, 2)); rerun(); }

  // Build the exercise row from the (possibly edited) config JSON.
  const { exercise, isPhase2 } = useMemo(() => {
    let cfg = {};
    try { cfg = JSON.parse(configText); setError(null); }
    catch (e) { setError("Invalid JSON: " + e.message); }
    return {
      exercise: { id: `lab-${sample.kind}-${nonce}`, kind: sample.kind, prompt: sample.prompt,
        expected_answer: sample.expected_answer ?? null, config: cfg },
      isPhase2: PHASE2_KINDS.has(sample.kind),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configText, nonce, idx]);

  const onGraded = (payload) => setResult(payload || {});

  if (!token) return <Navigate to="/cms/login" replace />;

  const groups = [...new Set(SAMPLES.map((s) => s.group))];

  return (
    <CmsLayout active="exercise-lab" title="Exercise Lab" breadcrumb={[{ label: "Exercise Lab" }]}>
      <div className="mx-auto max-w-6xl">
        {/* Kind picker */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <select
            value={idx}
            onChange={(e) => loadKind(Number(e.target.value))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {SAMPLES.map((s, i) => s.group === g ? <option key={s.kind} value={i}>{s.kind}</option> : null)}
              </optgroup>
            ))}
          </select>
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-extrabold text-brand-700">{sample.kind}</span>
          {isPhase2 ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">Phase 2</span> : null}
          <div className="flex-1" />
          <button onClick={rerun} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200">
            <RotateCcw className="h-4 w-4" /> Re-run
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Rendered exercise */}
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            {error ? (
              <div className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-200">{error}</div>
            ) : (
              <div key={exercise.id}>
                {isPhase2 ? (
                  <>
                    <Phase2Exercise exercise={exercise} registerActions={setP2}
                      submit={onGraded} mascotCharacter="armen" />
                    <button
                      disabled={!p2?.canCheck}
                      onClick={() => p2?.onCheck?.()}
                      className="btn3d btn3d-brand mt-5 w-full uppercase disabled:opacity-50"
                    >
                      {p2?.primaryLabel ?? "Check"}
                    </button>
                  </>
                ) : (
                  <ExerciseRenderer exercise={exercise} apiBaseUrl={API_BASE}
                    persist={false} onAnswer={onGraded} combo={0} mascotCharacter="armen" />
                )}
              </div>
            )}

            {result ? (
              <div className={"mt-5 flex items-start gap-2 rounded-xl p-3 text-sm font-bold ring-1 " +
                (result.isCorrect ? "bg-grass-50 text-grass-700 ring-grass-200" : "bg-amber-50 text-amber-700 ring-amber-200")}>
                {result.isCorrect ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
                <div className="min-w-0">
                  <div>{result.isCorrect ? "Correct" : "Not correct"}</div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-[11px] font-mono font-normal text-slate-500">{JSON.stringify(result, null, 1)}</pre>
                  <button onClick={rerun} className="mt-1 text-xs font-extrabold text-brand-600 underline">Reset & try again</button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Config editor */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">config JSON</div>
              <button onClick={resetConfig} className="text-xs font-bold text-slate-400 hover:text-slate-600 underline">reset to sample</button>
            </div>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              spellCheck={false}
              rows={22}
              className="w-full rounded-2xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button onClick={rerun} className="btn3d btn3d-grass mt-3 w-full uppercase">
              <Play className="h-4 w-4" /> Apply & render
            </button>
            <p className="mt-2 text-xs text-slate-400">
              Edit the config and hit Apply to test your own content. Nothing here is saved or counts against hearts.
            </p>
          </div>
        </div>
      </div>
    </CmsLayout>
  );
}
