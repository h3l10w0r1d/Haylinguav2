// src/TermsPage.jsx — Terms & Conditions. Public, unauthenticated page.
import StaticPageShell, { Prose } from "./StaticPageShell";

const UPDATED = "July 19, 2026";

export default function TermsPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Terms & Conditions"
      updated={UPDATED}
      intro="These terms cover the rules for using Haylingua — please read them before you sign up. By creating an account or using the app, you agree to them."
    >
      <Prose>
        <h2>1. Who we are</h2>
        <p>
          Haylingua ("we", "us", "our") is an Armenian language-learning app operated from Armenia,
          available at <a href="https://www.haylingua.am">haylingua.am</a>. If you have questions about
          these terms, reach us at <a href="mailto:info@haylingua.am">info@haylingua.am</a> or through
          our <a href="/contact">contact page</a>.
        </p>

        <h2>2. Your account</h2>
        <p>
          You need an account to save progress, track streaks, and use Premium features. You can create
          one with an email and password, or by continuing with Google, Facebook, or Telegram. You're
          responsible for keeping your login credentials secure and for all activity under your account.
          You must be at least 13 years old to use Haylingua; if you're under 18, you'll need a parent
          or guardian's permission, especially for any paid purchase.
        </p>
        <p>
          We may suspend or terminate an account that violates these terms, is used for cheating or
          abuse (e.g. farming referral rewards, exploiting bugs for gems/hearts), or that we reasonably
          believe is fraudulent or harmful to other users.
        </p>

        <h2>3. The service</h2>
        <p>
          Haylingua provides interactive lessons, exercises, listening practice, a spaced-repetition
          review system, and gamified progress tracking (streaks, hearts, XP, gems, chests, achievements,
          leaderboards). Free accounts have limited hearts and feature access; <strong>Haylingua Premium</strong>{" "}
          removes those limits and unlocks additional features, described in the app at time of purchase.
        </p>
        <p>
          We're a growing product — lesson content, exercise types, and gamification mechanics may
          change, be added, or be retired over time. We'll try to keep your progress and purchased
          entitlements intact through changes like these.
        </p>

        <h2>4. Subscriptions and payment</h2>
        <p>
          Premium is offered as a recurring subscription (with an optional free trial period, shown at
          signup) or as another plan we may offer in the app. Payment is processed through our payment
          provider using Visa, Mastercard, ArCa, or Telcell — we never see or store your full card
          details. Subscriptions renew automatically at the price shown at checkout unless you cancel
          before the renewal date. See our <a href="/refund-policy">Refund & Cancellation Policy</a> for
          how to cancel and what's refundable.
        </p>

        <h2>5. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Reverse-engineer, scrape, or attempt to extract our lesson content or exercise database in bulk</li>
          <li>Use bots, scripts, or automation to complete lessons, farm rewards, or manipulate leaderboards</li>
          <li>Share, sell, or transfer your account to another person</li>
          <li>Upload content (profile info, bios, messages to friends) that's abusive, hateful, or illegal</li>
          <li>Attempt to disrupt, overload, or gain unauthorized access to our systems</li>
        </ul>

        <h2>6. Content and ownership</h2>
        <p>
          All lesson content, exercises, illustrations, the Haylingua mascot, and app design are owned by
          Haylingua or licensed to us, and are protected by copyright. You may use them for personal
          learning — not for republishing, redistributing, or building a competing product.
        </p>
        <p>
          If you submit content (a profile photo, bio, or messages), you keep ownership of it, but grant
          us a license to display it back to you and, where relevant, to other users (e.g. your public
          profile or the leaderboard) as part of operating the app.
        </p>

        <h2>7. Disclaimers</h2>
        <p>
          Haylingua is provided "as is." We work hard to keep lesson content accurate and the app
          reliable, but we don't guarantee it will be error-free, uninterrupted, or that it will result
          in any particular level of fluency. Language learning outcomes depend on your own effort and
          practice.
        </p>

        <h2>8. Limitation of liability</h2>
        <p>
          To the extent permitted by law, Haylingua isn't liable for indirect, incidental, or
          consequential damages arising from your use of the app. Our total liability for any claim
          related to the service is limited to the amount you paid us in the 3 months before the claim
          arose.
        </p>

        <h2>9. Changes to these terms</h2>
        <p>
          We may update these terms as the product evolves. If a change is material, we'll let you know
          in the app or by email before it takes effect. Continuing to use Haylingua after an update
          means you accept the revised terms.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about these terms? Reach us at <a href="mailto:info@haylingua.am">info@haylingua.am</a>{" "}
          or via our <a href="/contact">contact page</a>.
        </p>
      </Prose>
    </StaticPageShell>
  );
}
