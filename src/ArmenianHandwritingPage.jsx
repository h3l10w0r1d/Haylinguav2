// src/ArmenianHandwritingPage.jsx — free printable Armenian handwriting
// worksheets. Pick a set of letters, choose the options, print.
//
// AUDIENCE: diaspora parents and Saturday-school teachers, which shapes two
// decisions. First, the output is paper — the whole point is something a
// child works on away from a screen, so the "app" is really a print-layout
// generator. Second, that audience links to resources they like, which is
// why this page exists at all: a worksheet PDF earns inbound links in a way
// an interactive widget doesn't.
//
// WHY BROWSER PRINT AND NOT A PDF LIBRARY: generating a real PDF client-side
// (jsPDF/pdf-lib) means embedding an Armenian-capable font as base64 — a
// large payload on a page whose job is to be lightweight, and a font that
// would then be a second source of truth for how Armenian renders. Printing
// the DOM instead reuses Noto Sans Armenian, already loaded site-wide, and
// the browser's own "Save as PDF" gives the same file with none of the
// weight. The cost is that layout lives in @media print CSS, which cannot
// be seen in the normal viewport — hence the on-screen preview below is the
// same markup, scaled, so what you see really is what prints.
//
// The letter data comes from lib/armenianAlphabet.js, which is extracted
// from the course's own lessons — read the provenance note there before
// changing any glyph or romanization.
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Printer } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import RelatedBlogPosts from "./lib/RelatedBlogPosts";
import { PATH_TO_TAGS } from "./lib/blogTopics";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";
import { ALPHABET, VOWELS, CONSONANTS } from "./lib/armenianAlphabet";

const PATH = "/armenian-handwriting-worksheets";

// Screen styles keep the preview honest (same markup, just scaled down);
// the @media print block is what actually reaches paper. Colours are fixed
// greys rather than theme tokens on purpose — a worksheet is printed on
// white regardless of whether the visitor is browsing in dark mode.
const PRINT_CSS = `
.hw-sheet { font-family: "Noto Sans Armenian", "Noto Sans", sans-serif; color: #111; background: #fff; }
.hw-sheet__title { display: flex; align-items: flex-end; justify-content: space-between;
  gap: 1rem; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
.hw-sheet__h { font-size: 15px; font-weight: 800; letter-spacing: .01em; }
.hw-sheet__sub { font-size: 11px; color: #555; margin-top: 2px; }
.hw-sheet__name { font-size: 11px; color: #555; white-space: nowrap; }
.hw-sheet__foot { margin-top: 14px; text-align: center; font-size: 9px; color: #888; }

.hw-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; }
.hw-block__head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 3px; }
.hw-block__n { font-size: 10px; color: #999; min-width: 16px; font-variant-numeric: tabular-nums; }
.hw-block__glyphs { font-size: 19px; font-weight: 700; }
.hw-block__translit { font-size: 11px; color: #666; font-style: italic; }

/* One practice line, built like real handwriting paper rather than a row of
   boxes. Three horizontal references, top to bottom:
     - ascender line (faint, solid)    where tall letters reach
     - midline       (grey, dashed)    the x-height most letters stop at
     - baseline      (dark, solid)     what letters sit ON
   Below the baseline is descender room, which Armenian genuinely needs —
   ղ, ջ, փ, ք and ց all drop below the line, and a layout that puts the
   baseline flush at the bottom of the row clips every one of them.
   Geometry is absolute rather than a background gradient because the
   earlier gradient version put the baseline at the row's bottom edge and
   the letters straddled it. */
.hw-line { position: relative; height: 52px; margin-bottom: 6px; display: flex; align-items: flex-start; }
.hw-line--ruled::before,
.hw-line--ruled::after,
.hw-line--ruled > .hw-rule { content: ""; position: absolute; left: 0; right: 0; }
.hw-line--ruled::before { top: 8px;  border-top: 1px solid #e6e6e6; }   /* ascender */
.hw-line--ruled::after  { top: 38px; border-top: 1.5px solid #333; }    /* baseline */
.hw-line--ruled > .hw-rule { top: 23px; border-top: 1px dashed #cfcfcf; } /* midline */

/* line-height pins the glyph's own baseline to the 38px rule above, so the
   letters rest on the line and their descenders fall into the 14px below. */
.hw-slot { flex: 1; text-align: center; font-size: 30px; line-height: 47px; color: transparent; }
/* Tracing copies: mid grey, always printable. Deliberately a solid fill and
   not -webkit-text-stroke — outline text is prettier on screen but drops out
   on plenty of printers, and a worksheet that prints blank is worthless. */
.hw-slot--trace { color: #c4c4c4; }

@media print {
  @page { size: A4 portrait; margin: 12mm 12mm 10mm; }
  .hw-screen, header, footer, nav { display: none !important; }
  html, body { background: #fff !important; }
  .hw-sheet {
    max-width: none !important; margin: 0 !important; padding: 0 !important;
    border-radius: 0 !important; box-shadow: none !important; --tw-ring-shadow: 0 0 !important;
  }
  .hw-sheet__title { position: running(head); }
  /* Force the greys to survive "background graphics off", which is the
     default in most print dialogs and would otherwise wipe the guide lines. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;


const SETS = {
  all: () => ALPHABET,
  vowels: () => VOWELS,
  consonants: () => CONSONANTS,
  first10: () => ALPHABET.slice(0, 10),
  second10: () => ALPHABET.slice(10, 20),
  third10: () => ALPHABET.slice(20, 30),
  last9: () => ALPHABET.slice(30),
};

// How many traceable (faded) copies lead each practice line before the blank
// space starts. Three is the usual convention on handwriting paper: enough
// to establish the stroke, few enough that most of the line is real practice.
const TRACE_PER_LINE = 3;
const SLOTS_PER_LINE = 9;

function PracticeLine({ glyph, rule }) {
  return (
    <div className={`hw-line ${rule ? "hw-line--ruled" : ""}`}>
      {rule && <span className="hw-rule" aria-hidden="true" />}
      {Array.from({ length: SLOTS_PER_LINE }).map((_, i) => (
        <span key={i} className={`hw-slot ${i < TRACE_PER_LINE ? "hw-slot--trace" : ""}`}>
          {i < TRACE_PER_LINE ? glyph : " "}
        </span>
      ))}
    </div>
  );
}

function LetterBlock({ letter, showCase, rows, rule }) {
  const glyphs = showCase === "both" ? [letter.upper, letter.lower]
    : showCase === "upper" ? [letter.upper] : [letter.lower];
  return (
    <section className="hw-block">
      <header className="hw-block__head">
        <span className="hw-block__n">{letter.n}</span>
        <span className="hw-block__glyphs">{letter.upper}&nbsp;&nbsp;{letter.lower}</span>
        <span className="hw-block__translit">{letter.translit}</span>
      </header>
      {glyphs.map((g) => (
        Array.from({ length: rows }).map((_, r) => (
          <PracticeLine key={`${g}-${r}`} glyph={g} rule={rule} />
        ))
      ))}
    </section>
  );
}

export default function ArmenianHandwritingPage() {
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const navigate = useNavigate();
  const lp = useCallback((p) => localizedPath(p, locale), [locale]);

  const [setKey, setSetKey] = useState("all");
  const [showCase, setShowCase] = useState("both");
  const [rows, setRows] = useState(2);
  const [rule, setRule] = useState(true);

  const letters = useMemo(() => (SETS[setKey] || SETS.all)(), [setKey]);

  const faq = useMemo(() => {
    const v = t("armenianHandwriting.faq", { returnObjects: true });
    return Array.isArray(v) ? v : [];
  }, [t]);

  usePageMeta(t("armenianHandwriting.meta.title"), t("armenianHandwriting.meta.description"), {
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianHandwriting.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianHandwriting.breadcrumb.current"), item: `https://www.haylingua.am${PATH}` },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: PATH })).concat([{ locale: "", path: PATH }]),
  });

  const Choice = ({ value, current, onPick, children }) => (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`rounded-xl px-3 py-1.5 text-sm font-extrabold transition ${
        current === value
          ? "bg-brand-500 text-white shadow-btn-brand"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-300 dark:hover:bg-white/[0.1]"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f11]">
      <style>{PRINT_CSS}</style>
      <div className="hw-screen">
        <SiteNav />
      </div>

      <main>
        <section className="hw-screen px-5 pb-8 pt-12 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
              {t("armenianHandwriting.hero.heading")}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-base font-semibold text-slate-500 dark:text-stone-400">
              {t("armenianHandwriting.hero.subtext")}
            </p>
          </div>

          {/* Controls */}
          <div className="mx-auto mt-8 max-w-3xl rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
                  {t("armenianHandwriting.controls.letters")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.keys(SETS).map((k) => (
                    <Choice key={k} value={k} current={setKey} onPick={setSetKey}>
                      {t(`armenianHandwriting.sets.${k}`)}
                    </Choice>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
                  {t("armenianHandwriting.controls.case")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["both", "upper", "lower"].map((c) => (
                    <Choice key={c} value={c} current={showCase} onPick={setShowCase}>
                      {t(`armenianHandwriting.case.${c}`)}
                    </Choice>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
                  {t("armenianHandwriting.controls.rows")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 2, 3].map((r) => (
                    <Choice key={r} value={r} current={rows} onPick={setRows}>{r}</Choice>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
                  {t("armenianHandwriting.controls.guides")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[true, false].map((v) => (
                    <Choice key={String(v)} value={v} current={rule} onPick={setRule}>
                      {t(`armenianHandwriting.guides.${v ? "on" : "off"}`)}
                    </Choice>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => window.print()} className="btn3d bg-brand-500 text-white shadow-btn-brand">
                <Printer className="h-5 w-5" />
                {t("armenianHandwriting.controls.print")}
              </button>
              <span className="text-sm font-semibold text-slate-400 dark:text-stone-500">
                {t("armenianHandwriting.controls.sheetCount", { count: letters.length })}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-400 dark:text-stone-500">
              {t("armenianHandwriting.controls.pdfHint")}
            </p>
          </div>
        </section>

        {/* The worksheet itself. Identical markup on screen and on paper —
            the preview is scaled, not a separate rendering. */}
        <section className="px-5 pb-12">
          <div className="hw-sheet mx-auto max-w-3xl rounded-[1.5rem] bg-white p-6 ring-1 ring-slate-200 dark:ring-white/[0.08] sm:p-8">
            <div className="hw-sheet__title">
              <div>
                <div className="hw-sheet__h">{t("armenianHandwriting.sheet.title")}</div>
                <div className="hw-sheet__sub">{t("armenianHandwriting.sheet.subtitle")}</div>
              </div>
              <div className="hw-sheet__name">{t("armenianHandwriting.sheet.nameLine")}</div>
            </div>
            {letters.map((l) => (
              <LetterBlock key={l.n} letter={l} showCase={showCase} rows={rows} rule={rule} />
            ))}
            <div className="hw-sheet__foot">haylingua.am{PATH}</div>
          </div>
        </section>

        {/* ---------- SEO body ---------- */}
        <div className="hw-screen">
          <section className="border-t border-slate-100 px-5 py-14 dark:border-white/[0.06]">
            <div className="mx-auto max-w-3xl">
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
                {t("armenianHandwriting.about.heading")}
              </h2>
              {["p1", "p2", "p3"].map((k) => (
                <p key={k} className="mt-4 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
                  {t(`armenianHandwriting.about.${k}`)}
                </p>
              ))}
            </div>
          </section>

          <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
                {t("armenianHandwriting.faqHeading")}
              </h2>
              <div className="mt-7 space-y-3">
                {faq.map((f, i) => (
                  <details key={i} className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                    <summary className="cursor-pointer list-none font-display text-base font-extrabold text-slate-800 dark:text-white">{f.q}</summary>
                    <p className="mt-2.5 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="px-5 py-14">
            <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
              {[["/armenian-alphabet", "alphabet"], ["/armenian-text-to-speech", "reader"], ["/armenian-typing", "typing"]].map(([to, key]) => (
                <Link key={key} to={lp(to)} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                  <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{t(`armenianHandwriting.keepGoing.${key}.title`)}</div>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{t(`armenianHandwriting.keepGoing.${key}.text`)}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="px-5 pb-16">
            <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
              <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("armenianHandwriting.cta.heading")}</h2>
              <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t("armenianHandwriting.cta.subtext")}</p>
              <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
                {t("armenianHandwriting.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
              </button>
            </div>
          </section>

          <RelatedBlogPosts tags={PATH_TO_TAGS["/armenian-alphabet"]} />
        </div>
      </main>

      <div className="hw-screen">
        <SiteFooter />
      </div>
    </div>
  );
}
