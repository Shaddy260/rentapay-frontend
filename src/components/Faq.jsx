import React, { useState } from 'react';
import { HELP_EMAIL, HELP_WHATSAPP } from './HelpButton.jsx';
import './Faq.css';

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
        a: 'RentaPay is a rent management platform built for the Kenyan market. Landlords track units, tenants, and rent collection in one place; tenants pay rent and see their balance from their phone; property managers and caretakers can be given their own limited access. Payments run on M-Pesa - STK push, Paybill, or a manual record by the landlord.',
      },
      {
        q: 'How does a rent payment actually move through the system?',
        a: "A tenant pays via M-Pesa (an STK push prompt straight to their phone, or Paybill using the landlord's own paybill and account number). The payment is confirmed automatically, the tenant's balance updates immediately, and a receipt is sent. If a tenant overpays, the extra amount is carried forward and reduces next month's balance rather than being lost.",
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
        a: "Open a vacant unit and choose \"Add Tenant.\" Enter their details, and they'll immediately receive their login (via SMS, and email if provided) with a temporary password they must change on first login. Their first month's rent is billed to their balance right away.",
      },
      {
        q: 'What does a tenant see when they log in?',
        a: "Their balance due, next due date, payment history, statistics, and a way to pay directly via M-Pesa. They can also see the contact details you've set (yours, or your property manager's/caretaker's, whichever you've assigned) and submit a vacating notice if they plan to move out.",
      },
    ],
  },
  {
    section: 'Onboarding property managers & caretakers',
    audiences: ['landlord', 'guest'],
    items: [
      {
        q: "What's the difference between a Property Manager and a Caretaker?",
        a: 'A Property Manager gets their own login and shares almost all of your access (units, tenants, payments, even subscription management), scoped to the properties you assign them - except they can\'t add/remove other managers or touch billing. A Caretaker gets a lighter login: the same portal, but blocked from removing tenants, transferring tenants, changing rent or due dates, or adding/removing units. Both are added from Settings, the same way you add a tenant.',
      },
      {
        q: 'How do I add a property manager or caretaker?',
        a: 'In Settings, use "Add a property manager," choose whether they\'re a Manager or Caretaker, pick which properties they can access, and they\'ll receive their own login details by SMS with a temporary password to change on first use.',
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
        q: 'Why should I trust RentaPay with my rent payments?',
        a: "All rent payments run through M-Pesa directly - RentaPay never holds your money. Payments are confirmed automatically by Safaricom's own systems, and every transaction gets a real M-Pesa receipt number you can verify independently.",
      },
      {
        q: 'How do I get help if something goes wrong?',
        a: `Use the Help button available on every page to chat directly with our support team, or reach us at ${HELP_EMAIL} or WhatsApp ${HELP_WHATSAPP}.`,
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
      <p className="faq-panel__intro">How RentaPay works, how to get set up, and how access &amp; security work.</p>

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
