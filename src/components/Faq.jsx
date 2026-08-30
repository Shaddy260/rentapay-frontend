import React, { useState } from 'react';
import { HELP_EMAIL, HELP_WHATSAPP, HELP_CALL } from './HelpButton.jsx';
import './Faq.css';
import InfoTip from './InfoTip.jsx';

// FAQ content, grouped by section. Written from each audience's point
// of view rather than one generic list, since a tenant, landlord, and
// admin all land here with different questions. `audiences` controls
// which portal(s) a question shows up in.
const FAQ_ITEMS = [
  {
    section: 'How RentaPay works',
    audiences: ['landlord', 'tenant', 'admin', 'guest'],
    items: [
      {
        q: 'What is RentaPay?',
        a: 'RentaPay is a property management and operations platform built for the Kenyan market. Landlords track properties, units, and tenants in one place, and can bring on property managers or caretakers with their own scoped access; tenants view their balance and account from their phone. Rent payments are one part of this - by default tenants pay via M-Pesa (Paybill, Till, or Send Money) and submit their code for a landlord, manager, or caretaker to review, or, where a landlord has connected their own Safaricom Business Paybill/Till, a tenant gets a real M-Pesa prompt and the payment confirms itself automatically - alongside the day-to-day work of running a property.',
      },
      {
        q: 'How does a rent payment actually move through the system?',
        a: "It depends on whether the landlord has switched on automatic rent collection. By default, a tenant pays via M-Pesa - Paybill, Till, or Send Money to the number their landlord has on file - then submits the M-Pesa transaction code, amount, and payer details in their portal; a landlord, manager, or caretaker reviews and confirms it (usually within a few minutes to a few hours), the tenant's balance updates, and a receipt is sent. Where a landlord has connected their own Business Paybill or Till under Settings, a tenant instead taps \"Pay Rent,\" gets a real M-Pesa prompt on their phone, enters their PIN, and the moment Safaricom confirms it, the balance updates itself - no review step, and no waiting. If a tenant overpays, the extra amount is carried forward and reduces next month's balance rather than being lost.",
      },
      {
        q: 'Can rent collection be fully automatic?',
        a: "Yes. A landlord who owns a genuine Safaricom Business Paybill or Till can connect it under Settings, in a handful of guided steps - RentaPay verifies it automatically with a small real test push to the landlord's own phone, no waiting on RentaPay staff. Once it's on, every tenant payment triggers a real M-Pesa prompt and confirms itself the moment Safaricom reports it back, with nobody checking a transaction code by hand - set it up once and it keeps running for as long as the account is active. It's entirely optional and reversible: manual confirmation stays available to switch back to at any time, without affecting any payment history already on record. Pochi la Biashara and a bank's own paybill don't qualify, since Safaricom can't issue API access for either.",
      },
    ],
  },
  {
    section: 'Creating an account',
    audiences: ['landlord'],
    items: [
      {
        q: 'How do I create a landlord account?',
        a: 'Tap "Sign up as a landlord" on the login page, enter your details and property information, then complete the subscription payment via M-Pesa to activate your account. You\'ll set up your units and can start adding tenants right away.',
      },
      {
        q: 'How do I add another property?',
        a: 'Open the property switcher at the top of your dashboard and choose "Add a property." You\'ll enter the new property\'s details and unit count, complete payment for it, and you can then switch between all your properties from that same menu.',
      },
    ],
  },
  {
    section: 'Onboarding tenants',
    audiences: ['landlord'],
    items: [
      {
        q: 'How do I onboard a tenant?',
        a: "Open a vacant unit and choose \"Add Tenant.\" Enter their details, and they'll immediately receive their login by email with a temporary password they must change on first login. Their first month's rent is billed to their balance right away.",
      },
      {
        q: 'What does a tenant see when they log in?',
        a: "Their balance due, next due date, payment history, statistics, and a way to pay directly via M-Pesa. They can also see the contact details you've set (yours, or your property manager's/caretaker's, whichever you've assigned) and submit a vacating notice if they plan to move out.",
      },
    ],
  },
  {
    section: 'Late payment penalty',
    audiences: ['landlord', 'tenant', 'guest'],
    items: [
      {
        q: 'How does the late payment penalty work?',
        a: "It's entirely optional and off by default - a landlord turns it on once for their whole account in Settings -> Finances (not per property or per unit), and sets the rate (per day or per week), an optional cap, and whether it also applies to unpaid utility charges. Once enabled, there's no grace period: it starts accruing the day after the due date, calculated on whatever balance is still unpaid, and recalculates automatically as partial payments come in. A landlord or property manager can waive it or set a custom amount for a specific tenant and month at any time, always with a reason attached. A tenant can see the exact formula and current penalty amount in their own portal, shown as its own separate line item, never hidden inside the total.",
      },
      {
        q: 'Can a landlord set a different late payment penalty for each of my units or properties?',
        a: "No - it's one setting per landlord account, applied the same way across every property and unit that landlord manages. There's no separate configuration screen per property.",
      },
    ],
  },
  {
    section: 'Onboarding property managers & caretakers',
    audiences: ['landlord', 'guest'],
    items: [
      {
        q: "What's the difference between a Property Manager and a Caretaker?",
        a: 'A Property Manager gets their own login and shares almost all of your access (units, tenants, day-to-day operations, payments, even subscription management), scoped to the properties you assign them - except they can\'t add/remove other managers or touch billing. A Caretaker gets a lighter login: the same portal, but blocked from removing tenants, transferring tenants, changing rent or due dates, or adding/removing units. Both are added from Settings, the same way you add a tenant.',
      },
      {
        q: 'How do I add a property manager or caretaker?',
        a: 'In Settings, use "Add a property manager," choose whether they\'re a Manager or Caretaker, pick which properties they can access, and they\'ll receive their own login details by email with a temporary password to change on first use.',
      },
    ],
  },
  {
    section: 'Access & security',
    audiences: ['landlord', 'tenant', 'admin', 'guest'],
    items: [
      {
        q: 'What happens if my access is removed?',
        a: "If a landlord, manager, or tenant's access is removed or their account is deactivated, they're logged out immediately on their very next action - not just whenever they happen to log out themselves - and any further login attempt is blocked with a clear message.",
      },
      {
        q: 'Who can see my payment and contact details?',
        a: "Only your own landlord (and any property manager or caretaker they've assigned to your property) and RentaPay's admin team can see your account details. Other tenants and other landlords never can.",
      },
      {
        q: 'How is my data kept secure?',
        a: 'Passwords are never stored in plain text, every login is protected by rate-limiting against repeated guesses, and every action a manager or caretaker takes is scoped strictly to the properties they\'ve been assigned - they can never see or touch another landlord\'s data.',
      },
    ],
  },
  {
    section: 'Trust & support',
    audiences: ['landlord', 'tenant', 'admin', 'guest'],
    items: [
      {
        q: 'Why should I trust RentaPay with my property operations?',
        a: "RentaPay is built to run your property's day-to-day operations - tenants, units, managers - with the same care as its payment handling. Rent payments run through M-Pesa directly, so RentaPay never holds your money, in either mode: by default a tenant sends payment and submits their M-Pesa code, which a landlord/manager/caretaker reviews and confirms against the real M-Pesa receipt number; where a landlord connects their own Business Paybill/Till, the same confirmation happens automatically straight from Safaricom instead. Either way, every transaction stays independently verifiable.",
      },
      {
        q: 'How do I get help if something goes wrong?',
        a: `Use the Help button available on every page to chat directly with our support team, or reach us at ${HELP_EMAIL}, WhatsApp ${HELP_WHATSAPP}, or call ${HELP_CALL}.`,
      },
    ],
  },
  // FIX (item 8, BA Portal Help): the BA Portal had no FAQ content at
  // all - every other portal does. These questions are the ones
  // specific to being a Brand Ambassador (referrals, qualification,
  // payout) rather than duplicating the general "how RentaPay works"
  // section above, which BAs also see since it's tagged for every
  // audience.
  {
    section: 'How RentaPay works',
    audiences: ['brand_ambassador'],
    items: [
      {
        q: 'What is RentaPay?',
        a: 'RentaPay is a property management and operations platform built for the Kenyan market. As a Brand Ambassador, your role is to bring landlords onto the platform and earn a payout for each one who qualifies.',
      },
    ],
  },
  {
    section: 'Referrals & attribution',
    audiences: ['brand_ambassador'],
    items: [
      {
        q: 'How does a landlord get attributed to me?',
        a: 'Two ways: they sign up using your referral link (it takes them straight to the signup form with your code already attached), or they type your referral code into the "Referral code (optional)" field on the signup page themselves. Either way, their account is tagged to you automatically the moment they register - no manual step needed on your end.',
      },
      {
        q: 'What if I onboarded a landlord in the field without the link or code?',
        a: 'Use "Log landlord" under My Onboarded Landlords to log them manually by phone and/or email. If they later show up in our system under those details, the record is matched and attributed to you.',
      },
    ],
  },
  {
    section: 'Qualification & payout',
    audiences: ['brand_ambassador'],
    items: [
      {
        q: 'When does a referred landlord "qualify" and how am I paid?',
        a: "A referral qualifies once the landlord meets the base activity requirement (minimum consecutive months active and minimum units). Your payout for that referral is a combination of the landlord's unit-volume bracket and your current commission tier - both are shown on your Earnings page with a breakdown of exactly which bracket/tier applied to each payout.",
      },
      {
        q: 'Where can I see why I was paid a specific amount?',
        a: 'Open Earnings in the sidebar - every payout shows the tier/bracket that applied, not just a final number.',
      },
    ],
  },
];

export default function Faq({ audience = 'tenant' }) {
  const [openKey, setOpenKey] = useState(null);

  const sections = FAQ_ITEMS.filter((s) => s.audiences.includes(audience));

  return (
    <section className="faq-panel">
      <h2>Frequently Asked Questions</h2>
      <InfoTip text={<>How RentaPay works, how to get set up, and how access &amp; security work.</>} />

      {sections.map((section) => (
        <div key={section.section} className="faq-panel__section">
          <h3>{section.section}</h3>
          {section.items.map((item, i) => {
            const key = `${section.section}-${i}`;
            const isOpen = openKey === key;
            return (
              <div key={key} className={`faq-item ${isOpen ? 'faq-item--open' : ''}`}>
                <button
                  type="button"
                  className="faq-item__question"
                  onClick={() => setOpenKey(isOpen ? null : key)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <span className="faq-item__caret">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && <p className="faq-item__answer">{item.a}</p>}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
