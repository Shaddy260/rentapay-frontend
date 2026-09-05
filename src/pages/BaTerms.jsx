import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

export default function BaTerms() {
  return (
    <div className="legal-page">
      <div className="legal-page__card">
        <Link to="/become-a-ba" className="ghost-link">← Back to application</Link>
        <h1>Brand Ambassador Terms of Engagement</h1>
        <p className="legal-page__updated">
          Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <p>
          These Terms of Engagement ("Terms") govern your participation as a Brand Ambassador ("BA",
          "you") in RentaPay's Brand Ambassador program. They apply in addition to RentaPay's general{' '}
          <Link to="/terms">Terms of Service</Link> and <Link to="/privacy">Privacy Policy</Link>. By
          applying to become a Brand Ambassador, you agree to be bound by these Terms.
        </p>

        <h2>1. What Being a Brand Ambassador Means</h2>
        <p>
          A Brand Ambassador introduces prospective landlords to RentaPay and logs each landlord they
          onboard through their own BA portal. You do not create landlord accounts yourself - every
          landlord you introduce must register their own account independently through RentaPay's normal
          signup flow, either directly or via your personal referral link.
        </p>

        <h2>2. Approval Is Not Automatic</h2>
        <p>
          Submitting an application does not make you a Brand Ambassador. Every application is reviewed
          by RentaPay's team and may be approved or declined at our discretion. You will only receive a
          Brand Ambassador ID, referral link, and login credentials once your application is approved.
        </p>

        <h2>3. Payout Is Conditional, Not Guaranteed on Signup</h2>
        <p>
          You are not owed payment simply because a landlord signs up or because you log a claim for
          them. Payment is earned only once a landlord you onboarded has made a qualifying number of
          consecutive subscription payments (a minimum of two consecutive months by default) and meets a
          minimum unit count, both of which RentaPay may configure or adjust. A landlord's account being
          matched or your claim being logged does not by itself entitle you to payment.
        </p>

        <h2>4. Rate and Commission Changes Are Never Retroactive</h2>
        <p>
          RentaPay may change payout amounts, qualification thresholds, or commission tiers at any time
          for future qualifications. Any such change will never retroactively alter the amount owed for a
          landlord who has already qualified for payout before the change took effect - what you've
          already earned is what you keep.
        </p>

        <h2>5. Accuracy of Information You Submit</h2>
        <p>
          You agree to submit accurate, truthful information about every landlord you claim to have
          onboarded. RentaPay verifies claims against real landlord accounts and may investigate
          suspicious patterns, including inflated claims, duplicate submissions, or unusually rapid
          submissions. Submitting false or misleading claims may result in suspension or permanent removal
          from the program, and forfeiture of any unpaid, unqualified claims tied to that conduct.
        </p>

        <h2>6. Suspension and Offboarding</h2>
        <p>
          RentaPay may suspend your account for a violation of these Terms or suspected fraudulent
          activity; a suspension blocks further activity but does not erase your already-qualified or
          already-paid history. RentaPay may also offboard you from the program entirely at any time. If
          you are offboarded, your referral link will continue to work for any landlord who uses it, but
          you will not earn new payouts for anything after your offboarding date.
        </p>

        <h2>7. Landlord Privacy</h2>
        <p>
          Data you collect about a landlord while onboarding them (name, phone, location, and similar
          details) is handled under RentaPay's existing <Link to="/privacy">Privacy Policy</Link>. A
          landlord's own dashboard, settings, and account never reveal which Brand Ambassador onboarded
          them - this relationship is internal RentaPay bookkeeping used only for payout tracking.
        </p>

        <h2>8. Changes to These Terms</h2>
        <p>
          RentaPay may update these Terms from time to time. Material changes will be communicated to
          active Brand Ambassadors, and continued participation in the program after a change takes effect
          constitutes acceptance of the updated Terms.
        </p>

        <h2>9. Contact</h2>
        <p>
          Questions about the Brand Ambassador program can be sent to{' '}
          <a href="mailto:support@rentapay.co.ke">support@rentapay.co.ke</a> or via WhatsApp at{' '}
          +254710888917.
        </p>
      </div>
    </div>
  );
}
