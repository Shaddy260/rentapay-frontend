import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function Terms() {
  return (
    <div className="legal-page">
      <div className="legal-page__card">
        <Link to="/login" className="ghost-link">← Back to login</Link>
        <h1>Terms of Service</h1>
        <p className="legal-page__updated">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <p>
          These Terms of Service ("Terms") govern your access to and use of RentaPay, a
          Kenya-based rent management platform that helps landlords, property managers,
          caretakers, and tenants track rent, payments, maintenance, and communication in one
          place. By creating an account, accessing the RentaPay website or app, or otherwise
          using the service, you agree to be bound by these Terms and by our{' '}
          <Link to="/privacy">Privacy Policy</Link>, which is incorporated into these Terms by
          reference. If you do not agree, please do not use RentaPay.
        </p>
        <p>
          Please read these Terms carefully. They cover what RentaPay is (and is not), how the
          different account roles work, how payments and subscriptions are handled, what
          conduct is and isn't allowed, how disputes and ratings work, and how the relationship
          between you and RentaPay can end.
        </p>

        <h2>1. What RentaPay Is — and Is Not</h2>
        <p>
          RentaPay is a record-keeping, notification, and communication tool for residential
          rentals. It exists to make it easier for landlords and tenants to track balances,
          confirm payments, share documents, request maintenance, and stay in touch — not to
          replace the legal relationship between them.
        </p>
        <p>RentaPay is <strong>not</strong>:</p>
        <ul>
          <li>A bank, deposit-taking institution, lender, or e-money issuer;</li>
          <li>An escrow agent or custodian of rental deposits or rent payments;</li>
          <li>A party to any lease, tenancy agreement, or rental arrangement between a
            landlord and a tenant;</li>
          <li>A letting or estate agency, unless a specific landlord or agent using the
            platform is separately licensed as one in their own right;</li>
          <li>A guarantor of any payment, of a unit's habitability, or of a tenant's or
            landlord's conduct.</li>
        </ul>
        <p>
          Rent amounts, deposits, notice periods, and all other lease terms remain matters
          agreed directly between landlord and tenant, under whatever tenancy agreement (written
          or otherwise) they have entered into, and under applicable Kenyan law, including the
          Landlord and Tenant legislation and county-level regulations that may apply to a given
          property. RentaPay simply helps both sides track and confirm what has already been
          agreed elsewhere.
        </p>

        <h2>2. Eligibility and Accounts</h2>
        <p>
          You must be at least 18 years old and capable of entering into a binding contract
          under Kenyan law to create a RentaPay account. By registering, you confirm that the
          information you provide — including your name, phone number, email address, and (for
          landlords) property and unit details — is accurate and that you will keep it up to
          date.
        </p>
        <p>RentaPay accounts fall into distinct roles, each with different permissions:</p>
        <ul>
          <li><strong>Landlord</strong> — the account that owns a property listing on RentaPay,
            manages subscription billing, and has full visibility into that property's units,
            tenants, and finances.</li>
          <li><strong>Property manager</strong> — added by a landlord to help run one or more
            properties, with permissions the landlord controls.</li>
          <li><strong>Caretaker</strong> — a more limited manager role, typically able to
            confirm payments and handle maintenance and day-to-day tenant contact, but without
            access to sensitive financial controls such as changing rent amounts.</li>
          <li><strong>Tenant</strong> — the account associated with a specific rented unit,
            able to view their own balance and payment history, submit payment proof, raise
            maintenance requests and complaints, and rate their landlord or manager.</li>
        </ul>
        <p>
          A phone number or email address may only be associated with one active account of a
          given role at a time, and the platform uses these identifiers to prevent duplicate or
          impersonating accounts. You are responsible for maintaining the confidentiality of
          your login credentials and for all activity that occurs under your account. Notify us
          promptly if you believe your account has been accessed without your authorization.
        </p>
        <p>
          Landlords are responsible for the accuracy of the property, unit, and rent information
          they enter, and for the conduct of any manager or caretaker accounts they create and
          grant access to their properties. Removing a manager's or caretaker's access is the
          landlord's responsibility and can be done at any time from the landlord's dashboard.
        </p>

        <h2>3. Payments and Subscriptions</h2>
        <p>
          RentaPay supports two broadly different kinds of payment flow, and it's important to
          understand the difference:
        </p>
        <h3>3.1 Rent Payments (Tenant to Landlord)</h3>
        <p>
          A tenant pays rent via M-Pesa — Paybill, Buy Goods Till Number, or Send Money — directly
          to the landlord's own M-Pesa Paybill, Till number, or phone number, never to a
          RentaPay-controlled account, and never via an M-Pesa STK push initiated by RentaPay.
          The tenant then submits proof of payment within RentaPay — the M-Pesa transaction code,
          amount, payer name, payer phone number, and the time shown on their M-Pesa confirmation
          message — for the landlord, manager, or caretaker to review and confirm.
        </p>
        <p>
          RentaPay does not hold, take custody of, guarantee, insure, or have any control over
          rent funds at any point in this process. It records what has been reported and
          confirmed by the parties themselves. A payment being marked "confirmed" in RentaPay
          reflects the landlord's, manager's, or caretaker's own confirmation that they received
          the funds — it is not a guarantee by RentaPay, and RentaPay is not liable for a
          landlord, manager, or caretaker confirming (or failing to confirm) a payment
          incorrectly, whether by mistake or in bad faith. Confirmation is a manual review step
          and is not instantaneous — it may take anywhere from a few minutes to a few hours.
          Payment confirmations, once made, may be disputed through the in-app dispute
          process described in Section 6, but resolution of the underlying rent obligation
          remains between landlord and tenant.
        </p>
        <h3>3.2 Landlord Subscription Fees (Landlord to RentaPay)</h3>
        <p>
          Access to RentaPay's landlord and property-manager features requires an active
          subscription, billed to the landlord's account and processed via M-Pesa STK push to
          RentaPay's own Paybill. Subscription pricing, billing cycles, and any free trial or
          introductory terms are as displayed within the app at the time of purchase or renewal,
          and may change from time to time with notice provided in-app. Failure to renew a
          subscription may result in reduced or suspended access to landlord features (such as
          new tenant onboarding or digest emails) until payment is made,
          though existing tenant and payment records are preserved rather than deleted for
          non-payment alone.
        </p>
        <p>
          Subscription fees are generally non-refundable once a billing period has begun, except
          where required by law or where RentaPay determines, at its discretion, that a refund
          is warranted (for example, a technical error resulting in duplicate billing).
        </p>

        <h2>4. Acceptable Use</h2>
        <p>You agree that you will not, in connection with your use of RentaPay:</p>
        <ul>
          <li>Submit false, fraudulent, or misleading payment information, including confirming
            a payment you have not genuinely verified as received;</li>
          <li>Impersonate another person, or create or maintain an account using another
            person's identity or contact details without their consent;</li>
          <li>Attempt to circumvent, disable, or interfere with any security feature, rate
            limit, or access control of the platform;</li>
          <li>Use the platform to harass, threaten, discriminate against, or unlawfully evict a
            tenant, or to unlawfully withhold a tenant's deposit;</li>
          <li>Use the community board, complaints, or messaging features to post unlawful,
            defamatory, hateful, or sexually explicit content, or content that infringes another
            person's rights;</li>
          <li>Scrape, reverse-engineer, or use automated means to extract data from RentaPay
            beyond your own account's normal use;</li>
          <li>Use RentaPay for any purpose that violates applicable Kenyan law, including
            consumer protection, data protection, and landlord-tenant law.</li>
        </ul>
        <p>
          We reserve the right to investigate suspected violations of these Terms and to
          suspend or terminate accounts that violate them, with or without notice, depending on
          severity.
        </p>

        <h2>5. Tenant Ratings and Portable Reputation</h2>
        <p>
          RentaPay allows landlords, managers, and caretakers to rate tenants on aspects such as
          payment reliability and care of the unit, and separately allows tenants to rate their
          landlord, manager, or the property itself. A tenant's aggregate rating (built from all
          landlords who have rated them, broken down by category and by rater role) is tied to
          the tenant's registered email address, so that it can, at the tenant's own option,
          follow them to a new landlord on the platform, or be shared by the tenant themselves
          (via a link they generate and choose to send) when inquiring about a new vacant unit.
        </p>
        <p>
          Ratings are opinions of the account holder who submits them, not verified facts, and
          RentaPay does not independently confirm their accuracy. Individual written comments
          attached to a rating are visible only to the tenant being rated (on their own account)
          and, where relevant, to RentaPay's moderation team — they are not shown to other
          landlords, even in a tenant's shared reputation summary, which surfaces only the
          aggregate score and category breakdown. A rating you believe is inaccurate, retaliatory,
          or abusive can be flagged for review through the in-app flagging feature, and RentaPay
          may, at its discretion, remove or adjust a rating found to violate these Terms.
        </p>
        <p>
          RentaPay is not responsible for decisions a landlord makes on the basis of a tenant's
          rating history, or for a rating's effect on a tenant's ability to secure a unit.
        </p>

        <h2>6. Disputes, Complaints, and Maintenance Requests</h2>
        <p>
          RentaPay provides in-app tools for tenants to dispute a payment record, raise a
          complaint, or submit a maintenance request, and for landlords/managers to respond to
          these. These tools are provided to make communication easier and to keep a record of
          what was raised and how it was resolved — RentaPay does not adjudicate disputes,
          mediate complaints, or guarantee that a maintenance issue will be addressed within any
          particular timeframe. Serious disputes (for example, over deposit refunds or unlawful
          eviction) are civil matters between landlord and tenant and may need to be pursued
          through Kenya's courts, rent tribunals, or other applicable dispute-resolution bodies
          outside the platform.
        </p>

        <h2>7. Community Board</h2>
        <p>
          Where enabled, RentaPay's community board allows tenants and landlords within a
          property (or area) to post and reply to each other — for example, to share notices or
          arrange informal exchanges. Content posted to the community board is visible to other
          users of that community and is the responsibility of the person who posted it.
          RentaPay may remove content that violates Section 4 (Acceptable Use) but does not
          pre-screen posts before they appear.
        </p>

        <h2>8. Intellectual Property</h2>
        <p>
          The RentaPay name, logo, app, and underlying software are the property of RentaPay and
          its licensors. You are granted a limited, non-exclusive, non-transferable license to
          use the platform for its intended purpose while your account is active. You retain
          ownership of the content you submit (such as unit photos, ratings, and messages), but
          grant RentaPay a license to store, display, and process that content as needed to
          operate the service — for example, showing a unit's photos on the public vacant-unit
          listing page, or including a landlord's portfolio statistics in a digest email.
        </p>

        <h2>9. Service Availability and Changes</h2>
        <p>
          We aim to keep RentaPay available and reliable but do not guarantee uninterrupted or
          error-free operation. Features may be added, changed, or removed over time as the
          platform evolves, and scheduled or emergency maintenance may cause temporary
          unavailability. We will make reasonable efforts to communicate significant changes
          that affect how you use the platform.
        </p>

        <h2>10. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by Kenyan law, RentaPay and its officers, employees,
          and agents will not be liable for indirect, incidental, or consequential damages
          arising from your use of the platform, including but not limited to loss of rental
          income, disputes over deposits, or reliance on a tenant's or landlord's rating.
          RentaPay's total liability for any claim arising from these Terms is limited to the
          subscription fees you paid to RentaPay in the three months preceding the claim, except
          where such a limitation is not permitted by law.
        </p>

        <h2>11. Account Suspension and Termination</h2>
        <p>
          You may stop using RentaPay, or request deletion of your account, at any time (see
          Section 5 of the <Link to="/privacy">Privacy Policy</Link> for how). We may suspend or
          terminate an account that violates these Terms, poses a security risk, or where
          required by law, and will make reasonable efforts to notify the affected account
          holder unless doing so would be inappropriate in the circumstances (for example, in
          cases of suspected fraud).
        </p>

        <h2>12. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the Republic of Kenya. Any dispute arising
          from these Terms or your use of RentaPay that cannot be resolved informally will be
          subject to the exclusive jurisdiction of the Kenyan courts.
        </p>

        <h2>13. Changes to These Terms</h2>
        <p>
          We may update these Terms as the platform evolves — for example, to reflect a new
          feature, a change in applicable law, or feedback from users. Where a change is
          material, we will make reasonable efforts to notify account holders in-app or by
          email ahead of it taking effect. Continued use of RentaPay after a change takes effect
          constitutes acceptance of the updated Terms.
        </p>

        <h2>14. Contact</h2>
        <p>
          For questions about these Terms, or to request account or data deletion, use the Help
          option within the app or contact the RentaPay team directly.
        </p>
      </div>
    </div>
  );
}
