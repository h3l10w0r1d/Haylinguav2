// src/ContactPage.jsx — "Contact us": a real working form that posts to
// backend POST /contact (Turnstile-protected, emails the support inbox via
// Brevo with reply-to set to the visitor). Public, unauthenticated page.
import { useState } from "react";
import { Mail, Send, MapPin, Clock, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import Turnstile from "./lib/Turnstile";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const TOPICS = ["General question", "Billing / Premium", "Bug report", "Partnership", "Something else"];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold text-slate-700 dark:text-stone-200">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl bg-slate-50 px-3.5 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 transition " +
  "focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 " +
  "dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    if (status === "sending") return;
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus("error");
      setErrorMsg("Please fill in your name, email, and message.");
      return;
    }
    if (!turnstileToken) {
      setStatus("error");
      setErrorMsg("Please complete the security check below.");
      return;
    }
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, topic, message, turnstile_token: turnstileToken }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Something went wrong — please try again.");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong — please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
        <div className="text-xs font-extrabold uppercase tracking-wider text-brand-500">Get in touch</div>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Contact us
        </h1>
        <p className="mt-4 max-w-xl text-lg font-semibold text-slate-500 dark:text-stone-400">
          Question about your account, a bug, or just want to say բարև? We read every message ourselves.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          {/* Info column */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-white/[0.07] dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-white">Email</div>
                  <a href="mailto:info@haylingua.am" className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
                    info@haylingua.am
                  </a>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-white/[0.07] dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-feather-50 text-feather-500 dark:bg-feather-500/15 dark:text-feather-400">
                  <Clock className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-white">Response time</div>
                  <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">Usually within 1–2 business days</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-white/[0.07] dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-grass-50 text-grass-600 dark:bg-grass-500/15 dark:text-grass-400">
                  <MapPin className="h-4.5 w-4.5" />
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-white">Based in</div>
                  <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">Yerevan, Armenia</div>
                </div>
              </div>
            </div>
          </div>

          {/* Form column */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.07] dark:bg-[#18181b] sm:p-8">
            {status === "sent" ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-grass-50 text-grass-600 dark:bg-grass-500/15 dark:text-grass-400">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h2 className="mt-4 font-display text-xl font-extrabold text-slate-800 dark:text-white">Message sent</h2>
                <p className="mt-1.5 max-w-sm text-sm font-semibold text-slate-500 dark:text-stone-400">
                  Thanks — we'll get back to you at {email}, usually within 1–2 business days.
                </p>
                <button
                  type="button"
                  onClick={() => { setStatus("idle"); setName(""); setEmail(""); setMessage(""); setTopic(TOPICS[0]); setTurnstileToken(null); }}
                  className="btn3d btn3d-neutral mt-6 text-sm"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name">
                    <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Anahit Petrosyan" autoComplete="name" />
                  </Field>
                  <Field label="Email">
                    <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                  </Field>
                </div>
                <Field label="Topic">
                  <select className={inputCls} value={topic} onChange={(e) => setTopic(e.target.value)}>
                    {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Message">
                  <textarea
                    className={inputCls + " min-h-[140px] resize-y"}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="How can we help?"
                  />
                </Field>

                <div className="pt-1">
                  <Turnstile onVerify={setTurnstileToken} />
                </div>

                {status === "error" && (
                  <div className="flex items-center gap-2 rounded-xl bg-cardinal-50 px-3.5 py-2.5 text-sm font-semibold text-cardinal-600 dark:bg-cardinal-500/10 dark:text-cardinal-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> {errorMsg}
                  </div>
                )}

                <button type="submit" disabled={status === "sending"} className="btn3d btn3d-brand w-full text-sm uppercase disabled:opacity-70">
                  {status === "sending" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send message</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
