// src/ReportProblem.jsx — flag a problem with the current exercise.
import React, { useState } from "react";
import { Flag, X, Loader2, Check } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

const REASONS = [
  { id: "wrong_answer", label: "The correct answer is wrong" },
  { id: "audio", label: "Audio problem" },
  { id: "typo", label: "Typo or spelling" },
  { id: "confusing", label: "Confusing or unclear" },
  { id: "other", label: "Something else" },
];

export default function ReportProblem({ exerciseId, lessonId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  if (!exerciseId) return null;

  async function submit() {
    if (!reason) return;
    setSending(true);
    try {
      const token = getToken();
      await fetch(`${API_BASE}/me/exercises/${exerciseId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ reason, detail, lesson_id: lessonId }),
      });
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setReason(""); setDetail(""); }, 1100);
    } catch {
      /* best-effort; reports shouldn't block learning */
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a problem"
        title="Report a problem"
        className="text-slate-300 transition hover:text-slate-500"
      >
        <Flag className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            {done ? (
              <div className="py-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-grass-100 text-grass-600">
                  <Check className="h-6 w-6" />
                </div>
                <div className="mt-3 font-display text-lg font-extrabold text-slate-800">Thanks for the report!</div>
                <div className="text-sm font-semibold text-slate-500">We’ll take a look.</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-extrabold text-slate-800">Report a problem</h3>
                  <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setReason(r.id)}
                      className={
                        "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-bold ring-2 transition " +
                        (reason === r.id ? "bg-brand-50 text-brand-700 ring-brand-300" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")
                      }
                    >
                      <span className={"grid h-5 w-5 place-items-center rounded-full ring-2 " + (reason === r.id ? "bg-brand-500 ring-brand-500" : "ring-slate-300")}>
                        {reason === r.id ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                      </span>
                      {r.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Add details (optional)"
                  rows={2}
                  className="mt-3 w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400"
                />

                <div className="mt-4 flex gap-3">
                  <button onClick={() => setOpen(false)} className="btn3d btn3d-neutral flex-1 uppercase">Cancel</button>
                  <button onClick={submit} disabled={!reason || sending} className="btn3d btn3d-brand flex-1 uppercase">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
