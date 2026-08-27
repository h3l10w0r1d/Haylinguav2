// src/SiteFooter.jsx — modern site footer for the marketing landing page.
// Light + dark aware (Tailwind class strategy). Includes the accepted payment
// methods as simplified, recognizable marks on white chips (payment logos are
// designed for a light background, so the chips stay light in both themes for
// legibility).
//
// ArCa and Telcell marks are redrawn from their real public brand language
// (colors/motifs confirmed via web research: ArCa = blue + apricot two-tone
// wordmark with an arrow-in-the-"A"; Telcell = apricot wordmark with a
// "1 + pixel square" mark) rather than traced from a downloaded logo file.
// Visa/Mastercard/Google Pay/Apple Pay/Amex are likewise hand-built, minimal
// recreations of their well-known public marks — standard practice for a
// merchant's "accepted payment methods" strip.
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Instagram, Facebook, Send, Mail, ShieldCheck } from "lucide-react";
import { useLocale, localizedPath } from "./i18n";

/* ── Payment marks — simplified, functional "accepted here" indicators ── */
function VisaMark() {
  return (
    <svg viewBox="0 0 48 16" className="h-3 w-auto" role="img" aria-label="Visa">
      <text x="24" y="13" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
            fontSize="15" fontStyle="italic" fontWeight="700" letterSpacing="0.5" fill="#1A1F71">VISA</text>
    </svg>
  );
}
function MastercardMark() {
  return (
    <svg viewBox="0 0 40 24" className="h-[15px] w-auto" role="img" aria-label="Mastercard">
      <circle cx="15" cy="12" r="9" fill="#EB001B" />
      <circle cx="25" cy="12" r="9" fill="#F79E1B" />
      <path d="M20 5.4a9 9 0 000 13.2 9 9 0 000-13.2z" fill="#FF5F00" />
    </svg>
  );
}
// ArCa (Armenian Card) — real brand palette is blue + apricot, with an arrow
// motif linking the two halves of the "A" (2017 rebrand).
function ArcaMark() {
  return (
    <svg viewBox="0 0 48 16" className="h-3 w-auto" role="img" aria-label="ArCa">
      <text x="26" y="12.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
            fontSize="13" fontWeight="800" letterSpacing="0.2">
        <tspan fill="#1B4C8C">Ar</tspan><tspan fill="#F2994A">Ca</tspan>
      </text>
      <path d="M6 11.5L9.5 5l1.4 3-3 6.5z" fill="#F2994A" />
    </svg>
  );
}
// Telcell — real brand color is "heritage apricot"; mark combines a "1"
// figure with a small pixel square (their 2020s rebrand language).
function TelcellMark() {
  return (
    <svg viewBox="0 0 62 16" className="h-3 w-auto" role="img" aria-label="Telcell">
      <rect x="2" y="5.5" width="3.4" height="3.4" rx="0.6" fill="#F2994A" />
      <text x="35" y="12.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
            fontSize="12" fontWeight="800" letterSpacing="0.2" fill="#F2994A">telcell</text>
    </svg>
  );
}
// Google Pay — the standard four-color "G" mark (same path already used for
// the Google sign-in button elsewhere in the app) + the "Pay" wordmark.
function GooglePayMark() {
  return (
    <svg viewBox="0 0 46 18" className="h-3.5 w-auto" role="img" aria-label="Google Pay">
      <g transform="scale(0.88)">
        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
        <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05" />
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
      </g>
      <text x="22" y="13.5" fontFamily="Arial, Helvetica, sans-serif" fontSize="12" fontWeight="600" fill="#5F6368">Pay</text>
    </svg>
  );
}
// Apple Pay — a minimal apple silhouette (rounded body + leaf) + "Pay".
function ApplePayMark() {
  return (
    <svg viewBox="0 0 46 18" className="h-3.5 w-auto" role="img" aria-label="Apple Pay">
      <path
        fill="#000"
        d="M9.6 5.6c-.55.66-1.43 1.18-2.3 1.1-.11-.87.31-1.79.82-2.36.55-.63 1.5-1.1 2.28-1.14.09.9-.27 1.79-.8 2.4zM10.4 6.86c-1.27-.08-2.35.72-2.96.72-.62 0-1.53-.68-2.53-.66-1.3.02-2.5.75-3.16 1.92-1.35 2.34-.35 5.8.97 7.7.64.93 1.4 1.96 2.42 1.92.96-.04 1.33-.62 2.5-.62s1.5.62 2.53.6c1.05-.02 1.71-.94 2.35-1.87.74-1.06 1.04-2.09 1.06-2.14-.02-.01-2.03-.78-2.05-3.1-.02-1.93 1.58-2.86 1.65-2.91-.9-1.33-2.3-1.48-2.78-1.51z"
      />
      <text x="16" y="13.5" fontFamily="Arial, Helvetica, sans-serif" fontSize="12" fontWeight="600" fill="#000">Pay</text>
    </svg>
  );
}
// American Express — the familiar blue-box "AMEX" mark.
function AmexMark() {
  return (
    <svg viewBox="0 0 48 32" className="h-4 w-auto" role="img" aria-label="American Express">
      <rect width="48" height="32" rx="4" fill="#016FD0" />
      <text x="24" y="20.5" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
            fontSize="11" fontWeight="800" letterSpacing="0.4" fill="#fff">AMEX</text>
    </svg>
  );
}

function PayChip({ label, children }) {
  return (
    <div
      title={label}
      aria-label={label}
      className="flex h-8 min-w-[54px] items-center justify-center rounded-md bg-white px-2.5 ring-1 ring-slate-200 dark:ring-white/15"
    >
      {children}
    </div>
  );
}

function SocialLink({ href, label, icon: Icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-brand-600 hover:ring-brand-200 dark:bg-white/[0.06] dark:text-stone-400 dark:ring-white/10 dark:hover:text-brand-400 dark:hover:ring-brand-500/40"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

function FooterCol({ title, links, locale }) {
  const linkCls = "text-sm font-semibold text-slate-600 transition hover:text-brand-600 dark:text-stone-300 dark:hover:text-brand-400";
  return (
    <div>
      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-stone-500">{title}</div>
      <ul className="mt-3 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("http") || href.startsWith("mailto:") ? (
              <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})} className={linkCls}>
                {label}
              </a>
            ) : (
              <Link to={localizedPath(href, locale)} className={linkCls}>{label}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  const { t } = useTranslation("common");
  const locale = useLocale();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-100 bg-slate-50 dark:border-white/[0.07] dark:bg-[#0d0d0f]">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_1fr]">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-pom-500 font-display text-lg font-extrabold text-white">Հ</span>
              <span className="font-display text-lg font-extrabold text-slate-800 dark:text-white">Haylingua</span>
            </div>
            <p className="mt-3 max-w-xs text-sm font-medium leading-relaxed text-slate-500 dark:text-stone-400">
              {t("footer.tagline")}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <SocialLink href="https://www.instagram.com/haylingua" label="Instagram" icon={Instagram} />
              <SocialLink href="https://www.facebook.com/haylingua" label="Facebook" icon={Facebook} />
              <SocialLink href="https://t.me/haylinguabot" label="Telegram" icon={Send} />
              <SocialLink href="mailto:info@haylingua.am" label="Email" icon={Mail} />
            </div>
          </div>

          {/* Link columns */}
          <FooterCol
            locale={locale}
            title={t("footer.product")}
            links={[[t("footer.linkPricing"), "/pricing"], [t("footer.linkHowItWorks"), "/#how"], [t("footer.linkFeatures"), "/#features"], [t("footer.linkFaq"), "/#faq"]]}
          />
          <FooterCol
            locale={locale}
            title={t("footer.company")}
            links={[[t("footer.linkAbout"), "/about"], [t("footer.linkCareers"), "/careers"], [t("footer.linkAffiliates"), "/affiliates"], [t("footer.linkCommunity"), "/community"], [t("footer.linkBlog"), "https://blog.haylingua.am"], [t("footer.linkContact"), "/contact"]]}
          />
          <FooterCol
            locale={locale}
            title={t("footer.legal")}
            links={[[t("footer.linkTerms"), "/terms"], [t("footer.linkPrivacy"), "/privacy"], [t("footer.linkRefund"), "/refund-policy"], [t("footer.linkCookie"), "/cookie-policy"]]}
          />

          {/* Payments / trust */}
          <div className="col-span-2 md:col-span-1">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-stone-500">{t("footer.weAccept")}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <PayChip label="Visa"><VisaMark /></PayChip>
              <PayChip label="Mastercard"><MastercardMark /></PayChip>
              <PayChip label="American Express"><AmexMark /></PayChip>
              <PayChip label="Google Pay"><GooglePayMark /></PayChip>
              <PayChip label="Apple Pay"><ApplePayMark /></PayChip>
              <PayChip label="ArCa"><ArcaMark /></PayChip>
              <PayChip label="Telcell"><TelcellMark /></PayChip>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-stone-500">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("footer.secureCheckout")}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 pt-6 dark:border-white/[0.06] sm:flex-row">
          <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">
            {t("footer.copyright", { year })}
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold text-slate-400 dark:text-stone-500">
            <a href="mailto:info@haylingua.am" className="transition hover:text-slate-700 dark:hover:text-stone-200">{t("footer.linkContact")}</a>
            <span className="text-slate-300 dark:text-stone-700">·</span>
            <span>{t("footer.madeIn")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
