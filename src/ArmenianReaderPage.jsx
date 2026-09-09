// src/ArmenianReaderPage.jsx — free Armenian text-to-speech reader. Paste any
// Armenian text, hear it in a native hy-AM voice, share the result as a link.
//
// Public and usable logged out on purpose (same acquisition logic as the
// typing trainer): the fastest way to be useful to someone who has Armenian
// text they can't pronounce is to not ask them for anything first.
//
// COST MODEL — read backend/tts_limits.py before changing anything here.
// /tts bills per character, so this page is the front end of a metered
// resource, not a free toy. Three things follow from that and are load-
// bearing, not decoration:
//
//   1. The meter is shown BEFORE you spend. The character counter turns
//      warning-coloured as you approach the per-request cap and the daily
//      bar is always visible, so the limit is a visible budget rather than
//      an error you discover after pasting an essay.
//   2. Limits are quoted from the server (GET /tts/quota), never hardcoded
//      here. If the caps are retuned by env var the UI follows automatically
//      instead of promising numbers the backend won't honour.
//   3. Replays never re-request. A (text, voice) pair that has already been
//      synthesised is kept as an object URL in `audioCache` for the life of
//      the page, so listening to the same sentence ten times costs one
//      request. Without this, the natural learner behaviour — replay, replay,
//      replay — would burn a day's allowance in a minute.
//
// The 401/429 paths are the conversion moment, not a dead end: the server
// sends a machine-readable `reason`, and each one gets its own copy and a
// sign-in call to action ("sign in for 5x more" beats "Error 429").
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Loader2, Pause, Play, Share2, Check, Volume2 } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import RelatedBlogPosts from "./lib/RelatedBlogPosts";
import { PATH_TO_TAGS } from "./lib/blogTopics";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const PATH = "/armenian-text-to-speech";

// A share link carries the text in the URL. Percent-encoded Armenian costs 6
// characters per letter, so the full 1500-char signed-in cap would produce a
// ~9KB URL that several clients silently truncate. Anything longer than this
// gets the copy button disabled with an explanation rather than a link that
// quietly loses its ending.
const MAX_SHAREABLE_CHARS = 400;

function getToken() {
  try {
    return localStorage.getItem("hay_token") || localStorage.getItem("access_token") || "";
  } catch {
    return "";
  }
}

// Locale-invariant sample text — the point is to hear Armenian, so these stay
// Armenian in every locale (same treatment as the vocabulary pages' word lists).
const SAMPLES = [
  { key: "greeting", text: "Բարև ձեզ։ Ինչպե՞ս եք այսօր։ Ես ուրախ եմ ձեզ հետ ծանոթանալու համար։" },
  { key: "poem", text: "Ես իմ անուշ Հայաստանի արևահամ բառն եմ սիրում, մեր հին սազի ողբանվագ լացակումած լարն եմ սիրում։" },
  { key: "news", text: "Երևանում այսօր եղանակը արևոտ է։ Ջերմաստիճանը կկազմի քսաներկու աստիճան։" },
];

export default function ArmenianReaderPage() {
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const navigate = useNavigate();
  const lp = useCallback((p) => localizedPath(p, locale), [locale]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [text, setText] = useState(() => (searchParams.get("t") || "").slice(0, 2000));
  const [voice, setVoice] = useState("female");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null); // { reason, message }
  const [copied, setCopied] = useState(false);
  const [quota, setQuota] = useState(null);

  const audioRef = useRef(null);
  // (text, voice) -> object URL. Replays are free; see the header note.
  const audioCache = useRef(new Map());

  const signedIn = !!quota?.signed_in;
  const perRequest = quota?.per_request ?? 300;
  const perDay = quota?.per_day ?? 5000;
  const used = quota?.used ?? 0;
  const chars = text.trim().length;
  const overLimit = chars > perRequest;
  const usedPct = perDay > 0 ? Math.min(100, Math.round((used / perDay) * 100)) : 0;

  const loadQuota = useCallback(() => {
    const token = getToken();
    fetch(`${API_BASE}/tts/quota`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setQuota(d))
      .catch(() => {});
  }, []);

  useEffect(() => { loadQuota(); }, [loadQuota]);

  // Release every blob URL the cache is holding when the page goes away.
  useEffect(() => {
    const cache = audioCache.current;
    return () => {
      if (audioRef.current) audioRef.current.pause();
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const faq = useMemo(() => {
    const rows = t("armenianReader.faq", { returnObjects: true });
    return Array.isArray(rows) ? rows : [];
  }, [t]);

  usePageMeta(t("armenianReader.meta.title"), t("armenianReader.meta.description"), {
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianReader.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianReader.breadcrumb.current"), item: `https://www.haylingua.am${PATH}` },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: PATH })).concat([{ locale: "", path: PATH }]),
  });

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(false);
  }, []);

  const playUrl = useCallback((url) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    a.src = url;
    a.onended = () => setPlaying(false);
    a.onerror = () => { setPlaying(false); setError({ reason: "playback", message: t("armenianReader.errors.playback") }); };
    setPlaying(true);
    a.play().catch(() => setPlaying(false));
  }, [t]);

  const speak = useCallback(async () => {
    const value = text.trim();
    if (!value || loading) return;
    if (playing) { stop(); return; }
    setError(null);

    const cacheKey = `${voice}::${value}`;
    const cached = audioCache.current.get(cacheKey);
    if (cached) { playUrl(cached); return; }

    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: value, voice }),
      });

      if (!res.ok) {
        // tts_limits sends a structured `detail` so the UI can tell "sign in"
        // apart from "you're out for today". Anything else falls back to a
        // generic message rather than showing a raw status code.
        let detail = null;
        try {
          const body = await res.json();
          detail = typeof body?.detail === "object" ? body.detail : null;
        } catch { /* non-JSON error body */ }
        setError(detail?.reason
          ? { reason: detail.reason, message: detail.message, limit: detail.limit }
          : { reason: "generic", message: t("armenianReader.errors.generic") });
        loadQuota();
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioCache.current.set(cacheKey, url);
      playUrl(url);
      loadQuota();
    } catch {
      setError({ reason: "generic", message: t("armenianReader.errors.generic") });
    } finally {
      setLoading(false);
    }
  }, [text, voice, loading, playing, stop, playUrl, loadQuota, t]);

  const shareable = chars > 0 && chars <= MAX_SHAREABLE_CHARS;
  const copyShareLink = useCallback(() => {
    if (!shareable) return;
    const url = `${window.location.origin}${lp(PATH)}?t=${encodeURIComponent(text.trim())}`;
    // Keep the address bar in step with what was copied, so a reload or a
    // browser-level share reproduces the same reading.
    setSearchParams({ t: text.trim() }, { replace: true });
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    // navigator.clipboard exists but can still reject (permission denied,
    // non-user-gesture, some embedded webviews). Swallowing that leaves the
    // button doing visibly nothing, so fall back to the old execCommand path
    // and, failing that, say plainly that the link is in the address bar —
    // which the setSearchParams above has already made true.
    const fallback = () => {
      try {
        const el = document.createElement("textarea");
        el.value = url;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        if (ok) { done(); return; }
      } catch { /* fall through */ }
      setError({ reason: "clipboard", message: t("armenianReader.errors.clipboard") });
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done).catch(fallback);
    else fallback();
  }, [shareable, text, lp, setSearchParams, t]);

  const quotaExhausted = error?.reason === "daily_quota";
  const needsAuth = error?.reason === "auth_required_for_voice";

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f11]">
      <SiteNav />

      <main>
        {/* ---------- Tool ---------- */}
        <section className="px-5 pb-10 pt-12 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Volume2 className="h-3.5 w-3.5" />
              {t("armenianReader.badge")}
            </div>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
              {t("armenianReader.hero.heading")}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-base font-semibold text-slate-500 dark:text-stone-400">
              {t("armenianReader.hero.subtext")}
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-3xl rounded-[1.75rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08] sm:p-7">
            <label htmlFor="reader-text" className="sr-only">{t("armenianReader.tool.label")}</label>
            <textarea
              id="reader-text"
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null); }}
              rows={6}
              dir="ltr"
              placeholder={t("armenianReader.tool.placeholder")}
              className={`w-full resize-y rounded-2xl border-2 bg-slate-50 px-4 py-3.5 text-lg font-semibold leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white dark:bg-white/[0.04] dark:text-white dark:placeholder:text-stone-500 dark:focus:bg-white/[0.06] ${
                overLimit ? "border-cardinal-400" : "border-slate-200 dark:border-white/[0.08]"
              }`}
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">
                {["female", "male"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setVoice(v); stop(); }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-extrabold transition ${
                      voice === v
                        ? "bg-white text-brand-600 shadow-sm dark:bg-white/[0.1] dark:text-brand-400"
                        : "text-slate-500 hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200"
                    }`}
                  >
                    {t(`armenianReader.tool.voice.${v}`)}
                  </button>
                ))}
              </div>

              <div className={`text-sm font-extrabold tabular-nums ${
                overLimit ? "text-cardinal-500" : chars > perRequest * 0.8 ? "text-amber-500" : "text-slate-400 dark:text-stone-500"
              }`}>
                {chars} / {perRequest}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={speak}
                disabled={!chars || overLimit || loading}
                className="btn3d bg-brand-500 text-white shadow-btn-brand disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" />
                  : playing ? <Pause className="h-5 w-5" />
                  : <Play className="h-5 w-5" />}
                {loading ? t("armenianReader.tool.loading")
                  : playing ? t("armenianReader.tool.stop")
                  : t("armenianReader.tool.listen")}
              </button>

              <button
                type="button"
                onClick={copyShareLink}
                disabled={!shareable}
                title={!shareable && chars > MAX_SHAREABLE_CHARS ? t("armenianReader.tool.shareTooLong") : undefined}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 px-4 py-2.5 text-sm font-extrabold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.1] dark:text-stone-300 dark:hover:border-white/20"
              >
                {copied ? <Check className="h-4 w-4 text-brand-500" /> : <Share2 className="h-4 w-4" />}
                {copied ? t("armenianReader.tool.copied") : t("armenianReader.tool.share")}
              </button>
            </div>

            {overLimit && (
              <p className="mt-3 text-sm font-bold text-cardinal-500">
                {signedIn
                  ? t("armenianReader.tool.overLimitUser", { limit: perRequest })
                  : t("armenianReader.tool.overLimitAnon", { limit: perRequest })}
              </p>
            )}

            {error && (
              <div className={`mt-4 rounded-2xl px-4 py-3.5 ${
                quotaExhausted || needsAuth
                  ? "bg-brand-50 dark:bg-brand-500/10"
                  : "bg-cardinal-50 dark:bg-cardinal-500/10"
              }`}>
                <p className={`text-sm font-bold ${
                  quotaExhausted || needsAuth ? "text-brand-700 dark:text-brand-300" : "text-cardinal-600 dark:text-cardinal-300"
                }`}>
                  {error.message || t("armenianReader.errors.generic")}
                </p>
                {(quotaExhausted || needsAuth) && !signedIn && (
                  <Link to="/login" className="btn3d mt-3 bg-brand-500 text-white shadow-btn-brand !py-2 text-sm">
                    {t("armenianReader.tool.signInCta")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                )}
              </div>
            )}

            {/* Daily allowance. Always visible, not only once it's spent —
                a budget you can see is a budget you can plan around. */}
            {quota && (
              <div className="mt-6 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
                  <span>{t("armenianReader.quota.label")}</span>
                  <span className="tabular-nums">{used.toLocaleString()} / {perDay.toLocaleString()}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                  <div
                    className={`h-full rounded-full transition-all ${usedPct >= 90 ? "bg-cardinal-500" : "bg-brand-500"}`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-stone-500">
                  {signedIn ? t("armenianReader.quota.signedIn") : t("armenianReader.quota.anon")}
                </p>
              </div>
            )}
          </div>

          {/* Samples */}
          <div className="mx-auto mt-6 max-w-3xl">
            <div className="text-center text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
              {t("armenianReader.samples.label")}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {SAMPLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { setText(s.text); setError(null); stop(); }}
                  className="rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                >
                  <div className="text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                    {t(`armenianReader.samples.${s.key}`)}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-600 dark:text-stone-300">{s.text}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- SEO body ---------- */}
        <section className="border-t border-slate-100 px-5 py-14 dark:border-white/[0.06]">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianReader.about.heading")}
            </h2>
            <p className="mt-4 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t("armenianReader.about.p1")}
            </p>
            <p className="mt-4 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t("armenianReader.about.p2")}
            </p>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianReader.faqHeading")}
            </h2>
            <div className="mt-7 space-y-3">
              {faq.map((f, i) => (
                <details key={i} className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                  <summary className="cursor-pointer list-none font-display text-base font-extrabold text-slate-800 dark:text-white">
                    {f.q}
                  </summary>
                  <p className="mt-2.5 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-14">
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
            <Link to={lp("/armenian-pronunciation")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{t("armenianReader.keepGoing.pronunciation.title")}</div>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{t("armenianReader.keepGoing.pronunciation.text")}</p>
            </Link>
            <Link to={lp("/armenian-alphabet")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{t("armenianReader.keepGoing.alphabet.title")}</div>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{t("armenianReader.keepGoing.alphabet.text")}</p>
            </Link>
            <Link to={lp("/armenian-typing")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{t("armenianReader.keepGoing.typing.title")}</div>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{t("armenianReader.keepGoing.typing.text")}</p>
            </Link>
          </div>
        </section>

        <section className="px-5 pb-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("armenianReader.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t("armenianReader.cta.subtext")}</p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("armenianReader.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>

        {/* Borrows the pronunciation page's tags rather than claiming its own:
            the reader has no blog tag of its own, and "how Armenian sounds" is
            exactly the cluster a visitor here wants to read next. */}
        <RelatedBlogPosts tags={PATH_TO_TAGS["/armenian-pronunciation"]} />
      </main>

      <SiteFooter />
    </div>
  );
}
