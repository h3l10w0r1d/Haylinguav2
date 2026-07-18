// src/PrivacyPolicyPage.jsx — Privacy Policy. Public, unauthenticated page.
import StaticPageShell, { Prose } from "./StaticPageShell";

const UPDATED = "July 19, 2026";

export default function PrivacyPolicyPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      updated={UPDATED}
      intro="What we collect, why we collect it, and the choices you have. We keep this as short and honest as a privacy policy can be."
    >
      <Prose>
        <h2>1. What we collect</h2>
        <p>When you use Haylingua, we collect:</p>
        <ul>
          <li><strong>Account info</strong> — email, name/username, and password (hashed — we never store it in plain text). If you sign in with Google, Facebook, or Telegram, we receive your name, email, and profile picture from that provider.</li>
          <li><strong>Learning data</strong> — lessons completed, exercise answers, streaks, XP, hearts, gems, and review history, so the app can track your progress and schedule reviews.</li>
          <li><strong>Profile content you add</strong> — bio, avatar, banner image, and any public profile settings you choose.</li>
          <li><strong>Usage &amp; device data</strong> — pages visited and basic interaction events (via Umami, a privacy-focused analytics tool) and session behavior (via Microsoft Clarity) so we can see what's confusing or broken. Neither tool sells data or builds cross-site ad profiles from it.</li>
          <li><strong>Payment data</strong> — if you subscribe to Premium, our payment provider processes your card details directly; we receive only confirmation of payment, not your full card number.</li>
        </ul>

        <h2>2. How we use it</h2>
        <ul>
          <li>To run the app: save your progress, calculate streaks, schedule spaced-repetition reviews, and show your position on leaderboards</li>
          <li>To communicate with you: account verification, password resets, streak reminders, and product updates (you can turn off non-essential emails in Settings)</li>
          <li>To improve Haylingua: understanding which lessons or exercises people struggle with or drop off on</li>
          <li>To keep the app safe: detecting abuse, fraud, or violations of our <a href="/terms">Terms &amp; Conditions</a></li>
        </ul>

        <h2>3. Who we share it with</h2>
        <p>
          We don't sell your personal data. We share it only with the services that help us run
          Haylingua, each bound to use it only for that purpose:
        </p>
        <ul>
          <li><strong>Brevo</strong> — sends transactional emails (verification, password reset) and, if you haven't opted out, product/marketing emails</li>
          <li><strong>Our payment provider</strong> — processes Premium subscription payments (Visa, Mastercard, ArCa, Telcell)</li>
          <li><strong>Umami &amp; Microsoft Clarity</strong> — anonymized/aggregated product analytics</li>
          <li><strong>Google, Facebook, Telegram</strong> — only if you choose to sign in with one of them</li>
        </ul>
        <p>We may also disclose data if required by law, or to protect the rights and safety of Haylingua and our users.</p>

        <h2>4. Cookies and local storage</h2>
        <p>
          We use cookies and browser local storage to keep you logged in, remember your theme (light/dark)
          and preferences, and power analytics. See our <a href="/cookie-policy">Cookie Policy</a> for the
          full breakdown and how to control them.
        </p>

        <h2>5. Data retention</h2>
        <p>
          We keep your account and learning data for as long as your account is active. If you delete your
          account, we remove your personal data within a reasonable period, except where we're required to
          keep certain records (e.g. payment history) for legal or accounting purposes.
        </p>

        <h2>6. Your rights</h2>
        <p>You can, at any time:</p>
        <ul>
          <li>Access or update your profile information directly in the app</li>
          <li>Request a copy of your data</li>
          <li>Request deletion of your account and associated data</li>
          <li>Opt out of marketing emails (a link is in every marketing email, or turn it off in Settings)</li>
        </ul>
        <p>
          To exercise any of these, email <a href="mailto:info@haylingua.am">info@haylingua.am</a> or use
          our <a href="/contact">contact form</a>.
        </p>

        <h2>7. Children's privacy</h2>
        <p>
          Haylingua isn't directed at children under 13, and we don't knowingly collect personal data from
          anyone under that age. If you believe a child has created an account, contact us and we'll remove it.
        </p>

        <h2>8. Security</h2>
        <p>
          We use industry-standard measures — encrypted connections (HTTPS), hashed passwords, and access
          controls on our systems — to protect your data. No system is 100% secure, but we take reasonable
          steps to keep yours safe.
        </p>

        <h2>9. Changes to this policy</h2>
        <p>
          If we make material changes to how we handle your data, we'll notify you in the app or by email
          before the change takes effect.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about this policy or your data? Reach us at{" "}
          <a href="mailto:info@haylingua.am">info@haylingua.am</a> or via our <a href="/contact">contact page</a>.
        </p>
      </Prose>
    </StaticPageShell>
  );
}
