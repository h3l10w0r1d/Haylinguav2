// src/cms/AdventureStepEditor.jsx
// The dialogue/step builder used inside the adventure builder. Each NPC has an
// ordered list of steps; this renders one editor per step (typed by kind) plus
// add / reorder / delete. The emitted step objects match exactly what the game
// reads in AdventurePlayer.jsx / AdventureExercises.jsx.
import { ArrowUp, ArrowDown, Trash2, Plus, Volume2 } from "lucide-react";
import { ttsFetch } from "../exercises/tts";
import { newTrackedAudio } from "../lib/audioRegistry";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const inp = "w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200 focus:ring-brand-400 focus:outline-none";
const lbl = "text-[10px] font-bold uppercase tracking-wide text-slate-400";

// Every step kind the builder can create, with a factory for a blank one.
export const STEP_KINDS = [
  { kind: "line", label: "NPC line", make: () => ({ line: "", tr: "" }) },
  { kind: "choose", label: "Multiple choice", make: () => ({ choose: "", options: [{ text: "", tr: "", correct: true }, { text: "", tr: "", correct: false }] }) },
  { kind: "wordbank", label: "Word bank", make: () => ({ wordbank: "", answer: [], tr: "" }) },
  { kind: "listen", label: "Listen & pick", make: () => ({ listen: "", options: [{ text: "", tr: "", correct: true }, { text: "", tr: "", correct: false }] }) },
  { kind: "blank", label: "Fill the blank", make: () => ({ blank: "", before: "", after: "", options: [{ text: "", correct: true }, { text: "", correct: false }], tr: "" }) },
  { kind: "speak", label: "Speaking", make: () => ({ speak: "", phrase: "", tr: "" }) },
  { kind: "match", label: "Match pairs", make: () => ({ match: "", pairs: [{ a: "", b: "" }, { a: "", b: "" }] }) },
  { kind: "note", label: "Cultural note", make: () => ({ note: { emoji: "🇦🇲", title: "", body: "" } }) },
  { kind: "give", label: "Give an item", make: () => ({ give: "", itemId: "", tr: "" }) },
  { kind: "receive", label: "Receive an item", make: () => ({ receive: { id: "", label: "", icon: "🎁" }, line: "", tr: "" }) },
  { kind: "ai", label: "AI voice chat", make: () => ({ ai: { personaDesc: "", goal: "", voice: "female" } }) },
];

// Infer a step's kind from its shape (steps are stored untagged, like the code).
export function stepKind(s) {
  if (s.ai) return "ai";
  if (s.note) return "note";
  if (s.receive) return "receive";
  if (s.give != null) return "give";
  if (s.wordbank != null) return "wordbank";
  if (s.listen != null) return "listen";
  if (s.blank != null) return "blank";
  if (s.speak != null) return "speak";
  if (s.match != null) return "match";
  if (s.options && s.choose != null) return "choose";
  return "line";
}

function play(text, voice) {
  if (!text) return;
  ttsFetch(API_BASE, { text, voice: voice || "female", provider: "azure" })
    .then((u) => newTrackedAudio(u).play()).catch(() => {});
}

function ArmInput({ value, onChange, placeholder, voice }) {
  return (
    <div className="flex items-center gap-1">
      <input className={inp} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value ? <button type="button" onClick={() => play(value, voice)} className="rounded-lg bg-brand-50 p-2 text-brand-500" title="Hear it"><Volume2 className="h-4 w-4" /></button> : null}
    </div>
  );
}

// Options list with a single "correct" radio (used by choose & listen).
function OptionsEditor({ options, onChange, withTr = true }) {
  const set = (i, patch) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : (patch.correct ? { ...o, correct: false } : o))));
  return (
    <div className="space-y-2">
      {options.map((o, i) => (
        <div key={i} className={"rounded-xl p-2 ring-1 " + (o.correct ? "bg-grass-50 ring-grass-200" : "bg-slate-50 ring-slate-200")}>
          <div className="mb-1 flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
              <input type="radio" checked={!!o.correct} onChange={() => set(i, { correct: true })} /> correct
            </label>
            {options.length > 2 && (
              <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} className="ml-auto text-slate-400 hover:text-cardinal-500"><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <input className={inp} value={o.text ?? ""} onChange={(e) => set(i, { text: e.target.value })} placeholder="Armenian option" />
          {withTr && <input className={inp + " mt-1 text-slate-500"} value={o.tr ?? ""} onChange={(e) => set(i, { tr: e.target.value })} placeholder="English translation" />}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...options, withTr ? { text: "", tr: "", correct: false } : { text: "", correct: false }])} className="text-xs font-bold text-brand-500"><Plus className="mr-1 inline h-3.5 w-3.5" />Option</button>
    </div>
  );
}

function StepBody({ step, kind, onChange, voice }) {
  const p = (patch) => onChange({ ...step, ...patch });
  switch (kind) {
    case "line":
    case "receive":
      return (
        <div className="space-y-2">
          {kind === "receive" && (
            <div className="grid grid-cols-3 gap-2">
              <input className={inp} value={step.receive.icon ?? ""} onChange={(e) => p({ receive: { ...step.receive, icon: e.target.value } })} placeholder="Icon 🎁" />
              <input className={inp} value={step.receive.id ?? ""} onChange={(e) => p({ receive: { ...step.receive, id: e.target.value } })} placeholder="item id" />
              <input className={inp} value={step.receive.label ?? ""} onChange={(e) => p({ receive: { ...step.receive, label: e.target.value } })} placeholder="Label" />
            </div>
          )}
          <div><div className={lbl}>Armenian line</div><ArmInput value={step.line} onChange={(v) => p({ line: v })} placeholder="Armenian line" voice={voice} /></div>
          <div><div className={lbl}>Translation</div><input className={inp} value={step.tr ?? ""} onChange={(e) => p({ tr: e.target.value })} placeholder="English translation" /></div>
        </div>
      );
    case "choose":
      return (
        <div className="space-y-2">
          <div className={lbl}>Prompt</div>
          <input className={inp} value={step.choose ?? ""} onChange={(e) => p({ choose: e.target.value })} placeholder="e.g. How do you ask politely?" />
          <OptionsEditor options={step.options} onChange={(options) => p({ options })} />
        </div>
      );
    case "listen":
      return (
        <div className="space-y-2">
          <div className={lbl}>Prompt</div>
          <input className={inp} value={step.listen ?? ""} onChange={(e) => p({ listen: e.target.value })} placeholder="Listen and choose what you heard." />
          <div className="text-[10px] text-slate-400">The correct option's Armenian is what plays aloud.</div>
          <OptionsEditor options={step.options} onChange={(options) => p({ options })} />
        </div>
      );
    case "blank":
      return (
        <div className="space-y-2">
          <div className={lbl}>Prompt</div>
          <input className={inp} value={step.blank ?? ""} onChange={(e) => p({ blank: e.target.value })} placeholder="Fill in the blank." />
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} value={step.before ?? ""} onChange={(e) => p({ before: e.target.value })} placeholder="Text before ___" />
            <input className={inp} value={step.after ?? ""} onChange={(e) => p({ after: e.target.value })} placeholder="Text after ___" />
          </div>
          <OptionsEditor options={step.options} onChange={(options) => p({ options })} withTr={false} />
          <input className={inp + " text-slate-500"} value={step.tr ?? ""} onChange={(e) => p({ tr: e.target.value })} placeholder="Full-sentence translation" />
        </div>
      );
    case "wordbank":
      return (
        <div className="space-y-2">
          <div className={lbl}>Prompt</div>
          <input className={inp} value={step.wordbank ?? ""} onChange={(e) => p({ wordbank: e.target.value })} placeholder="Build the sentence: …" />
          <div className={lbl}>Answer words (space-separated — order matters)</div>
          <ArmInput value={(step.answer || []).join(" ")} onChange={(v) => p({ answer: v.split(/\s+/).filter(Boolean) })} placeholder="Ես ուզում եմ մեկ սուրճ" voice={voice} />
          <input className={inp + " text-slate-500"} value={step.tr ?? ""} onChange={(e) => p({ tr: e.target.value })} placeholder="Translation" />
        </div>
      );
    case "speak":
      return (
        <div className="space-y-2">
          <div className={lbl}>Prompt</div>
          <input className={inp} value={step.speak ?? ""} onChange={(e) => p({ speak: e.target.value })} placeholder="Say it out loud:" />
          <div className={lbl}>Phrase to say</div>
          <ArmInput value={step.phrase} onChange={(v) => p({ phrase: v })} placeholder="Armenian phrase" voice={voice} />
          <input className={inp + " text-slate-500"} value={step.tr ?? ""} onChange={(e) => p({ tr: e.target.value })} placeholder="Translation" />
        </div>
      );
    case "match":
      return (
        <div className="space-y-2">
          <div className={lbl}>Prompt</div>
          <input className={inp} value={step.match ?? ""} onChange={(e) => p({ match: e.target.value })} placeholder="Match the pairs." />
          {step.pairs.map((pr, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={inp} value={pr.a ?? ""} onChange={(e) => p({ pairs: step.pairs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} placeholder="Armenian" />
              <span className="text-slate-300">↔</span>
              <input className={inp} value={pr.b ?? ""} onChange={(e) => p({ pairs: step.pairs.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)) })} placeholder="English" />
              {step.pairs.length > 2 && <button type="button" onClick={() => p({ pairs: step.pairs.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-cardinal-500"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          ))}
          <button type="button" onClick={() => p({ pairs: [...step.pairs, { a: "", b: "" }] })} className="text-xs font-bold text-brand-500"><Plus className="mr-1 inline h-3.5 w-3.5" />Pair</button>
        </div>
      );
    case "note":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <input className={inp} value={step.note.emoji ?? ""} onChange={(e) => p({ note: { ...step.note, emoji: e.target.value } })} placeholder="🇦🇲" />
            <input className={inp + " col-span-3"} value={step.note.title ?? ""} onChange={(e) => p({ note: { ...step.note, title: e.target.value } })} placeholder="Note title" />
          </div>
          <textarea className={inp + " min-h-[64px]"} value={step.note.body ?? ""} onChange={(e) => p({ note: { ...step.note, body: e.target.value } })} placeholder="Cultural note body…" />
        </div>
      );
    case "give":
      return (
        <div className="space-y-2">
          <div className={lbl}>Prompt</div>
          <input className={inp} value={step.give ?? ""} onChange={(e) => p({ give: e.target.value })} placeholder="Give the officer your passport." />
          <input className={inp} value={step.itemId ?? ""} onChange={(e) => p({ itemId: e.target.value })} placeholder="Required item id (e.g. passport)" />
          <input className={inp + " text-slate-500"} value={step.tr ?? ""} onChange={(e) => p({ tr: e.target.value })} placeholder="Translation" />
        </div>
      );
    case "ai":
      return (
        <div className="space-y-2">
          <div className={lbl}>Character description (who the AI plays)</div>
          <input className={inp} value={step.ai.personaDesc ?? ""} onChange={(e) => p({ ai: { ...step.ai, personaDesc: e.target.value } })} placeholder="a warm café barista in Yerevan" />
          <div className={lbl}>Goal (how the conversation should flow & end)</div>
          <textarea className={inp + " min-h-[64px]"} value={step.ai.goal ?? ""} onChange={(e) => p({ ai: { ...step.ai, goal: e.target.value } })} placeholder="Ask what they need, help over a few turns, then say goodbye." />
          <select className={inp} value={step.ai.voice ?? "female"} onChange={(e) => p({ ai: { ...step.ai, voice: e.target.value } })}>
            <option value="female">Female voice</option>
            <option value="male">Male voice</option>
          </select>
        </div>
      );
    default:
      return null;
  }
}

export default function StepList({ steps, onChange, voice }) {
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const setStep = (i, s) => onChange(steps.map((x, j) => (j === i ? s : x)));
  const del = (i) => onChange(steps.filter((_, j) => j !== i));
  const add = (kind) => onChange([...steps, STEP_KINDS.find((k) => k.kind === kind).make()]);

  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const kind = stepKind(s);
        const meta = STEP_KINDS.find((k) => k.kind === kind);
        return (
          <div key={i} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600">{i + 1}. {meta?.label || kind}</span>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => del(i)} className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-cardinal-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <StepBody step={s} kind={kind} voice={voice} onChange={(ns) => setStep(i, ns)} />
          </div>
        );
      })}
      {steps.length === 0 && <div className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-400">No steps yet — add the first one below.</div>}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
        <span className="mr-1 self-center text-[10px] font-bold uppercase text-slate-400">Add step:</span>
        {STEP_KINDS.map((k) => (
          <button key={k.kind} type="button" onClick={() => add(k.kind)} className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 hover:ring-brand-300">
            + {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
