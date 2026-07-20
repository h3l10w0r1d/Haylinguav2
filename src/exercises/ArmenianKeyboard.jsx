// src/exercises/ArmenianKeyboard.jsx
// On-screen Armenian character picker for typing exercises, so a learner
// without an Armenian keyboard layout installed isn't blocked from typing
// the answer at all. Appends to the current value — simple and reliable
// across every typing exercise kind rather than requiring cursor-position
// plumbing through each one's input element.
import { useState } from "react";
import { Keyboard, Delete, ChevronDown, ChevronUp } from "lucide-react";

const ROWS = [
  ["ա", "բ", "գ", "դ", "ե", "զ", "է", "ը", "թ", "ժ", "ի", "լ", "խ"],
  ["ծ", "կ", "հ", "ձ", "ղ", "ճ", "մ", "յ", "ն", "շ", "ո", "չ", "պ"],
  ["ջ", "ռ", "ս", "վ", "տ", "ր", "ց", "ւ", "փ", "ք", "օ", "ֆ", "և"],
];

export default function ArmenianKeyboard({ value, onChange, className = "" }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300"
      >
        <Keyboard className="h-3.5 w-3.5" />
        {open ? "Hide Armenian keyboard" : "Show Armenian keyboard"}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open ? (
        <div className="rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
          {ROWS.map((row, i) => (
            <div key={i} className="mb-1 flex justify-center gap-1 last:mb-0">
              {row.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => onChange((value || "") + ch)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:scale-90 hover:bg-brand-50 dark:bg-[#18181b] dark:text-stone-200 dark:ring-white/[0.08] dark:hover:bg-white/[0.06]"
                >
                  {ch}
                </button>
              ))}
            </div>
          ))}
          <div className="mt-1 flex justify-center gap-1">
            <button
              type="button"
              onClick={() => onChange((value || "") + " ")}
              className="h-8 max-w-[200px] flex-1 rounded-lg bg-white text-xs font-bold text-slate-500 shadow-sm ring-1 ring-slate-200 transition active:scale-95 hover:bg-brand-50 dark:bg-[#18181b] dark:text-stone-400 dark:ring-white/[0.08]"
            >
              space
            </button>
            <button
              type="button"
              onClick={() => onChange((value || "").slice(0, -1))}
              aria-label="Backspace"
              className="grid h-8 w-10 place-items-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition active:scale-90 hover:bg-cardinal-50 hover:text-cardinal-600 dark:bg-[#18181b] dark:text-stone-400 dark:ring-white/[0.08]"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
