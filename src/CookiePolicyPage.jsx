// src/CookiePolicyPage.jsx — Cookie Policy. Public, unauthenticated page.
import StaticPageShell, { Prose } from "./StaticPageShell";

const UPDATED = "July 19, 2026";

function CookieTable({ rows }) {
  return (
    <div className="my-4 overflow-x-auto rounded-2xl border border-slate-100 dark:border-white/[0.07]">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-white/[0.07]">
            <th className="px-4 py-2.5 font-extrabold text-slate-700 dark:text-stone-200">Name</th>
            <th className="px-4 py-2.5 font-extrabold text-slate-700 dark:text-stone-200">Purpose</th>
            <th className="px-4 py-2.5 font-extrabold text-slate-700 dark:text-stone-200">Duration</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, purpose, duration]) => (
            <tr key={name} className="border-b border-slate-50 last:border-0 dark:border-white/[0.04]">
              <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-stone-300">{name}</td>
              <td className="px-4 py-2.5 text-slate-600 dark:text-stone-300">{purpose}</td>
              <td className="px-4 py-2.5 text-slate-500 dark:text-stone-400">{duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiePolicyPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Cookie Policy"
      updated={UPDATED}
      intro="What cookies and local storage Haylingua uses, and why — no surprises."
    >
      <Prose>
        <h2>1. What we mean by "cookies"</h2>
        <p>
          This covers browser cookies and similar local storage used to keep you logged in and remember
          your preferences. We use as few as possible and avoid third-party advertising trackers entirely.
        </p>

        <h2>2. Strictly necessary</h2>
        <p>Required for the app to function — you can't disable these without breaking login and core features.</p>
        <CookieTable
          rows={[
            ["hay_token / access_token", "Keeps you signed in", "Until you log out"],
            ["hay_user", "Caches your basic profile so the app loads instantly", "Until you log out"],
            ["hay_onboarding_completed", "Remembers whether you've finished onboarding", "Persistent"],
            ["cf_clearance (Cloudflare Turnstile)", "Anti-bot check on signup/login forms", "Session"],
          ]}
        />

        <h2>3. Preferences</h2>
        <p>Remember choices you've made so you don't have to make them again.</p>
        <CookieTable
          rows={[
            ["hay_theme", "Remembers your light/dark mode choice", "Persistent"],
            ["hay_daily_goal", "Remembers your daily XP goal setting", "Persistent"],
            ["hay_voice_pref", "Remembers your preferred lesson audio voice", "Persistent"],
          ]}
        />

        <h2>4. Analytics</h2>
        <p>
          Help us understand how Haylingua is used so we can fix what's broken and improve what isn't.
        </p>
        <CookieTable
          rows={[
            ["Umami", "Privacy-focused, cookieless page-view analytics — no cross-site tracking", "N/A (no cookie)"],
            ["Microsoft Clarity (_clck, _clsk)", "Anonymized session behavior (clicks, scrolling) to spot UX issues", "Up to 1 year"],
          ]}
        />

        <h2>5. Third-party embeds</h2>
        <p>
          If you use the in-app chat widget (Brevo Conversations) or sign in with Google, Facebook, or
          Telegram, those providers may set their own cookies during that interaction, governed by their
          own privacy policies.
        </p>

        <h2>6. Managing cookies</h2>
        <p>
          Most browsers let you block or delete cookies in their settings. Blocking strictly-necessary
          cookies will prevent you from staying logged in. You can also clear Haylingua's local storage
          at any time via your browser's site data settings — you'll just need to log back in and reset
          your preferences.
        </p>

        <h2>7. Changes to this policy</h2>
        <p>
          If the cookies we use change meaningfully, we'll update this page and, where required, ask for
          your consent again.
        </p>

        <h2>8. Contact</h2>
        <p>
          Questions about cookies on Haylingua? Reach us at{" "}
          <a href="mailto:info@haylingua.am">info@haylingua.am</a> or via our <a href="/contact">contact page</a>.
        </p>
      </Prose>
    </StaticPageShell>
  );
}
