// src/RefundPolicyPage.jsx — Refund & Cancellation Policy. Public page.
import StaticPageShell, { Prose } from "./StaticPageShell";

const UPDATED = "July 19, 2026";

export default function RefundPolicyPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      updated={UPDATED}
      intro="Straightforward rules for canceling Premium and requesting a refund."
    >
      <Prose>
        <h2>1. Free trial</h2>
        <p>
          New Premium subscriptions typically start with a 14-day free trial (the exact length is shown
          at signup). You won't be charged during the trial, and you can cancel anytime before it ends
          with no cost. If you don't cancel, the paid subscription begins automatically when the trial
          ends.
        </p>

        <h2>2. Cancelling your subscription</h2>
        <p>
          You can cancel anytime from <strong>Profile → Premium</strong> in the app, or by emailing{" "}
          <a href="mailto:info@haylingua.am">info@haylingua.am</a>. Cancelling stops future renewals —
          you keep Premium access until the end of the period you already paid for, then your account
          reverts to the free plan (your streak, XP, and progress are kept either way).
        </p>

        <h2>3. Refunds</h2>
        <p>We'll issue a full refund if:</p>
        <ul>
          <li>You were charged in error or charged twice for the same period</li>
          <li>You cancel within <strong>48 hours</strong> of a charge and haven't substantially used the Premium features unlocked by it</li>
          <li>A technical fault on our side prevented you from using Premium for a meaningful part of the billing period</li>
        </ul>
        <p>
          Outside of those cases, subscription charges are generally non-refundable for the period
          already billed — you can still cancel at any time to stop future charges. We review every
          request individually and will always work with you in good faith if something's gone wrong.
        </p>

        <h2>4. How to request a refund</h2>
        <p>
          Email <a href="mailto:info@haylingua.am">info@haylingua.am</a> or use our{" "}
          <a href="/contact">contact form</a> with your account email and the date of the charge.
          We aim to respond within 2 business days, and approved refunds are returned to your original
          payment method (Visa, Mastercard, ArCa, or Telcell) within 5–10 business days, depending on
          your bank.
        </p>

        <h2>5. Chargebacks</h2>
        <p>
          If you have a billing issue, please reach out to us first — most issues are resolved faster
          that way than through a bank chargeback, and a chargeback may result in your account being
          suspended while it's investigated.
        </p>

        <h2>6. Changes to this policy</h2>
        <p>
          We may update this policy as our pricing or plans change. The version in effect at the time of
          your purchase is the one that applies to that purchase.
        </p>

        <h2>7. Contact</h2>
        <p>
          Questions about a charge or cancellation? Reach us at{" "}
          <a href="mailto:info@haylingua.am">info@haylingua.am</a> or via our <a href="/contact">contact page</a>.
        </p>
      </Prose>
    </StaticPageShell>
  );
}
