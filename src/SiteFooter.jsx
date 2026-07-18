// src/SiteFooter.jsx — modern site footer for the marketing landing page.
// Light + dark aware (Tailwind class strategy). Includes the accepted payment
// methods (Visa, Mastercard, ArCa, Telcell) as simplified, recognizable marks
// on white chips (payment logos are designed for a light background, so the
// chips stay light in both themes for legibility).
import { Instagram, Facebook, Send, Mail, ShieldCheck } from "lucide-react";

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
function ArcaMark() {
  return (
    <svg viewBox="0 0 48 16" className="h-3 w-auto" role="img" aria-label="ArCa">
      <text x="24" y="13" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
            fontSize="13" fontWeight="800" letterSpacing="0.2" fill="#E4002B">ArCa</text>
    </svg>
  );
}
function TelcellMark() {
  return (
    <svg viewBox="0 0 58 16" className="h-3 w-auto" role="img" aria-label="Telcell">
      <text x="29" y="13" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
            fontSize="12" fontWeight="800" letterSpacing="0.2" fill="#E6017A">telcell</text>
    </svg>
  );
}

function PayChip({ label, children }) {
  return (
    <div
      title={label}
      aria-label={label}
      className="flex h-8 w-[54px] items-center justify-center rounded-md bg-white ring-1 ring-slate-200 dark:ring-white/15"
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

function FooterCol({ title, links }) {
  return (
    <div>
      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-stone-500">{title}</div>
      <ul className="mt-3 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <a
              href={href}
              {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
              className="text-sm font-semibold text-slate-600 transition hover:text-brand-600 dark:text-stone-300 dark:hover:text-brand-400"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-100 bg-slate-50 dark:border-white/[0.07] dark:bg-[#0d0d0f]">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-pom-500 font-display text-lg font-extrabold text-white">Հ</span>
              <span className="font-display text-lg font-extrabold text-slate-800 dark:text-white">Haylingua</span>
            </div>
            <p className="mt-3 max-w-xs text-sm font-medium leading-relaxed text-slate-500 dark:text-stone-400">
              Learn Armenian the playful way — bite-sized lessons, real audio, and streaks that keep you coming back.
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
            title="Learn"
            links={[["How it works", "#how"], ["Features", "#features"], ["FAQ", "#faq"]]}
          />
          <FooterCol
            title="Company"
            links={[["About us", "/about"], ["Blog", "https://blog.haylingua.am"], ["Contact", "mailto:info@haylingua.am"]]}
          />

          {/* Payments / trust */}
          <div className="col-span-2 md:col-span-1">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-stone-500">We accept</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <PayChip label="Visa"><VisaMark /></PayChip>
              <PayChip label="Mastercard"><MastercardMark /></PayChip>
              <PayChip label="ArCa"><ArcaMark /></PayChip>
              <PayChip label="Telcell"><TelcellMark /></PayChip>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-stone-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure, encrypted checkout
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 pt-6 dark:border-white/[0.06] sm:flex-row">
          <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">
            © {year} Haylingua. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold text-slate-400 dark:text-stone-500">
            <a href="mailto:info@haylingua.am" className="transition hover:text-slate-700 dark:hover:text-stone-200">Contact</a>
            <span className="text-slate-300 dark:text-stone-700">·</span>
            <span>Made with ❤️ in Armenia</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
