// src/CareersApplyPage.jsx — job application form. Fields shown here are a
// fixed set (name, email, LinkedIn, CV, cover letter) plus whatever
// CMS-defined custom questions the admin attached to this vacancy
// (src/cms/CmsCareers.jsx). Submits multipart/form-data since it can include
// file uploads.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft, UploadCloud, Send, Loader2, CheckCircle2, AlertTriangle, FileText,
} from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import Turnstile from "./lib/Turnstile";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function FileInput({ label, required, value, onChange, hint }) {
  const inputRef = useRef(null);
  return (
    <div>
      <label className="text-sm font-bold text-slate-700 dark:text-stone-200">
        {label} {required && <span className="text-cardinal-500">*</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-stone-500">{hint}</p>}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1.5 flex w-full items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-500 ring-2 ring-slate-200 transition hover:bg-slate-100 dark:bg-white/[0.04] dark:text-stone-400 dark:ring-white/[0.08] dark:hover:bg-white/[0.06]"
      >
        {value ? <FileText className="h-4 w-4 shrink-0 text-brand-500" /> : <UploadCloud className="h-4 w-4 shrink-0" />}
        <span className="truncate">{value ? value.name : "Choose a file (PDF, DOC, DOCX)"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="hidden"
      />
    </div>
  );
}

export default function CareersApplyPage() {
  const { vacancyId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [cv, setCv] = useState(null);
  const [coverLetter, setCoverLetter] = useState(null);
  const [answers, setAnswers] = useState({});
  const [answerFiles, setAnswerFiles] = useState({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/careers/vacancies/${vacancyId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [vacancyId]);

  async function onSubmit(e) {
    e.preventDefault();
    if (status === "sending" || !name.trim() || !email.trim() || !cv || !turnstileToken) return;
    setStatus("sending");
    setErrorMsg("");

    const form = new FormData();
    form.append("name", name.trim());
    form.append("email", email.trim());
    form.append("linkedin_url", linkedinUrl.trim());
    form.append("turnstile_token", turnstileToken);
    form.append("cv", cv);
    if (coverLetter) form.append("cover_letter", coverLetter);
    (data?.fields || []).forEach((f) => {
      if (f.field_type === "file") {
        if (answerFiles[f.id]) form.append(`field_${f.id}`, answerFiles[f.id]);
      } else {
        form.append(`field_${f.id}`, answers[f.id] || "");
      }
    });

    try {
      const res = await fetch(`${API_BASE}/careers/vacancies/${vacancyId}/apply`, { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.detail || "Something went wrong — please try again.");
      setStatus("sent");
    } catch (err) {
      setStatus("idle");
      setErrorMsg(err.message || "Something went wrong — please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link to="/careers" className="inline-flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-brand-500 dark:text-stone-500">
          <ChevronLeft className="h-4 w-4" /> Careers
        </Link>

        {error ? (
          <div className="mt-6 rounded-3xl bg-cardinal-50 p-8 text-center text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200 dark:bg-cardinal-500/10 dark:text-cardinal-300 dark:ring-cardinal-500/25">
            This role isn't open anymore — check <Link to="/careers" className="underline">Careers</Link> for current openings.
          </div>
        ) : data === null ? (
          <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : status === "sent" ? (
          <div className="mt-6 rounded-3xl bg-grass-50 p-8 text-center ring-1 ring-grass-200 dark:bg-grass-500/10 dark:ring-grass-500/25">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-grass-600 dark:text-grass-400" />
            <div className="font-display text-xl font-extrabold text-slate-800 dark:text-white">Application sent</div>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-stone-400">
              Thanks for applying to {data.vacancy.title} — we read every application ourselves and will be in touch.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Apply — {data.vacancy.title}</h1>
            <p className="mt-1.5 text-sm font-semibold text-slate-500 dark:text-stone-400">{data.vacancy.location} · {data.vacancy.employment_type}</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-stone-200">Your name <span className="text-cardinal-500">*</span></label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200}
                    className="mt-1.5 w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06]" />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700 dark:text-stone-200">Email <span className="text-cardinal-500">*</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200}
                    className="mt-1.5 w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06]" />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 dark:text-stone-200">LinkedIn profile</label>
                <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" maxLength={500}
                  className="mt-1.5 w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500" />
              </div>

              <FileInput label="CV / résumé" required value={cv} onChange={setCv} />
              <FileInput label="Motivation letter" value={coverLetter} onChange={setCoverLetter} hint="Optional, but a good way to stand out." />

              {(data.fields || []).map((f) => (
                <div key={f.id}>
                  {f.field_type === "file" ? (
                    <FileInput label={f.label} required={f.is_required} value={answerFiles[f.id]} onChange={(file) => setAnswerFiles((prev) => ({ ...prev, [f.id]: file }))} />
                  ) : (
                    <>
                      <label className="text-sm font-bold text-slate-700 dark:text-stone-200">
                        {f.label} {f.is_required && <span className="text-cardinal-500">*</span>}
                      </label>
                      {f.field_type === "textarea" ? (
                        <textarea
                          value={answers[f.id] || ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          required={f.is_required}
                          rows={4}
                          maxLength={5000}
                          data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false"
                          className="mt-1.5 w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 dark:bg-white/[0.04] dark:text-stone-200 dark:ring-white/[0.08] dark:focus:bg-white/[0.06]"
                        />
                      ) : (
                        <input
                          type={f.field_type === "url" ? "url" : "text"}
                          value={answers[f.id] || ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          required={f.is_required}
                          maxLength={2000}
                          className="mt-1.5 w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06]"
                        />
                      )}
                    </>
                  )}
                </div>
              ))}

              <Turnstile onVerify={setTurnstileToken} />

              {errorMsg && (
                <div className="flex items-center gap-2 text-sm font-bold text-cardinal-600 dark:text-cardinal-400">
                  <AlertTriangle className="h-4 w-4" /> {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending" || !name.trim() || !email.trim() || !cv || !turnstileToken}
                className="btn3d btn3d-brand w-full justify-center text-base disabled:opacity-60"
              >
                {status === "sending" ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-5 w-5" /> Submit application</>}
              </button>
            </form>
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
