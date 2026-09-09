// src/ArmenianPhrasesPage.jsx — public, unauthenticated SEO landing page:
// traveler-oriented Armenian phrases grouped by situation, targeting the
// "armenian phrases for tourists/travelers" query cluster. Same
// SiteNav/SiteFooter/usePageMeta pattern as ArmenianVocabularyPage.jsx.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import RelatedBlogPosts from "./lib/RelatedBlogPosts";
import { PATH_TO_TAGS } from "./lib/blogTopics";
import { useLocale, localizedPath } from "./i18n";

// [Armenian, romanization, English] — Standard Eastern Armenian, the variety
// actually spoken in Armenia (which is where a traveler using this page is
// going). Polite/formal forms throughout: a visitor addressing a stranger
// should default to formal, and picking the wrong register is a worse first
// impression than a shaky accent. Reference content, so it lives in code
// rather than the translation files — same as the vocabulary page.
const CATEGORIES = [
  {
    key: "essentials",
    phrases: [
      ["Բարև ձեզ", "ba-rev dzez", "Hello (formal)"],
      ["Ցտեսություն", "tse-te-su-tyun", "Goodbye"],
      ["Այո / Ոչ", "a-yo / voch", "Yes / No"],
      ["Շնորհակալություն", "shnor-ha-ka-lu-tyun", "Thank you"],
      ["Խնդրեմ", "khən-drem", "Please / you're welcome"],
      ["Կներեք", "kə-ne-rek'", "Excuse me / sorry"],
      ["Ես չեմ հասկանում", "yes chem has-ka-num", "I don't understand"],
      ["Անգլերեն խոսո՞ւմ եք", "ang-le-ren kho-sum ek'", "Do you speak English?"],
    ],
  },
  {
    key: "gettingAround",
    phrases: [
      ["Որտե՞ղ է…", "vor-tegh e", "Where is…?"],
      ["Ինչքա՞ն հեռու է", "inch-k'an he-ru e", "How far is it?"],
      ["Ձախ / Աջ", "dzakh / aj", "Left / right"],
      ["Ուղիղ", "u-ghigh", "Straight ahead"],
      ["Տաքսի", "tak-si", "Taxi"],
      ["Կանգառ", "kan-gar", "Stop / station"],
      ["Օդանավակայան", "o-da-na-va-ka-yan", "Airport"],
      ["Զուգարան", "zu-ga-ran", "Toilet"],
    ],
  },
  {
    key: "eatingOut",
    phrases: [
      ["Ճաշացանկը, խնդրեմ", "cha-sha-tsan-kə khən-drem", "The menu, please"],
      ["Ջուր", "jur", "Water"],
      ["Սուրճ / Թեյ", "surch / t'ey", "Coffee / tea"],
      ["Ես բուսակեր եմ", "yes bu-sa-ker em", "I'm vegetarian"],
      ["Համեղ է", "ha-megh e", "It's delicious"],
      ["Հաշիվը, խնդրեմ", "ha-shi-və khən-drem", "The bill, please"],
    ],
  },
  {
    key: "shopping",
    phrases: [
      ["Ինչքա՞ն արժե", "inch-k'an ar-zhe", "How much does it cost?"],
      ["Թանկ է", "t'ank e", "It's expensive"],
      ["Դրամ", "dram", "Dram (the currency)"],
      ["Քարտով կարելի՞ է", "k'ar-tov ka-re-li e", "Can I pay by card?"],
      ["Բանկոմատ", "ban-ko-mat", "ATM"],
    ],
  },
  {
    key: "emergencies",
    phrases: [
      ["Օգնությու՛ն", "og-nu-tyun", "Help!"],
      ["Ինձ բժիշկ է պետք", "indz bzhishk e petk'", "I need a doctor"],
      ["Ոստիկանություն", "vos-ti-ka-nu-tyun", "Police"],
      ["Հիվանդանոց", "hi-van-da-nots", "Hospital"],
      ["Ես կորել եմ", "yes ko-rel em", "I'm lost"],
    ],
  },
  {
    key: "smallTalk",
    phrases: [
      ["Ինչպե՞ս եք", "inch-pes ek'", "How are you?"],
      ["Լավ եմ", "lav em", "I'm well"],
      ["Իմ անունը… է", "im a-nu-nə … e", "My name is…"],
      ["Հաճելի է", "ha-che-li e", "Nice to meet you"],
      ["Շատ գեղեցիկ է", "shat ge-ghe-tsik e", "It's very beautiful"],
    ],
  },
];

export default function ArmenianPhrasesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const categoryTitles = t("armenianPhrases.categoryTitles", { returnObjects: true });
  const faq = t("armenianPhrases.faq", { returnObjects: true });
  const keepGoingCards = t("armenianPhrases.keepGoing.cards", { returnObjects: true });

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianPhrases.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianPhrases.breadcrumb.current"), item: "https://www.haylingua.am/armenian-phrases" },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: (Array.isArray(faq) ? faq : []).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  usePageMeta(t("armenianPhrases.meta.title"), t("armenianPhrases.meta.description"), { structuredData });

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main id="main-content">
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("armenianPhrases.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("armenianPhrases.hero.subtitle")}
          </p>
        </header>

        <section className="mx-auto max-w-4xl px-5 pb-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                <h2 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{categoryTitles[cat.key]}</h2>
                <ul className="mt-3 space-y-3">
                  {cat.phrases.map(([arm, rom, en]) => (
                    <li key={arm}>
                      <div className="font-display text-sm font-extrabold text-slate-800 dark:text-white">{arm}</div>
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="font-semibold text-slate-400 dark:text-stone-500">{rom}</span>
                        <span className="text-end font-semibold text-slate-600 dark:text-stone-300">{en}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-brand-50 p-6 text-center dark:bg-brand-500/10">
            <p className="font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t("armenianPhrases.politenessNote")}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-16">
          <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {t("armenianPhrases.faqHeading")}
          </h2>
          <div className="mt-6 space-y-4">
            {(Array.isArray(faq) ? faq : []).map((f) => (
              <div key={f.q} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{f.q}</div>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianPhrases.keepGoing.heading")}
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to={lp("/armenian-vocabulary")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[0].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[0].text}</p>
              </Link>
              <Link to={lp("/armenian-pronunciation")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[1].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[1].text}</p>
              </Link>
              <Link to={lp("/armenian-alphabet")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[2].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[2].text}</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("armenianPhrases.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t("armenianPhrases.cta.subtext")}</p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("armenianPhrases.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>

        <RelatedBlogPosts tags={PATH_TO_TAGS["/armenian-phrases"]} />
      </main>

      <SiteFooter />
    </div>
  );
}
