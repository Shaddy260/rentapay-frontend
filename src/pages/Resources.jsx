import { useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './Resources.css';

// Guide content - single source of truth also used to build the
// downloadable PDF (see scripts/build_guide_pdf.py). Editing a section
// here and only here keeps the webpage and PDF in sync.
import intro from '../content/guide/01-intro.md?raw';
import pricing from '../content/guide/02-pricing.md?raw';
import paymentFlow from '../content/guide/03-how-payments-flow.md?raw';
import landlordPortal from '../content/guide/04-landlord-portal.md?raw';
import tenantPortal from '../content/guide/05-tenant-portal.md?raw';
import gettingStarted from '../content/guide/06-getting-started.md?raw';
import faq from '../content/guide/07-faq.md?raw';
import securityDeposits from '../content/guide/08-security-deposits.md?raw';
import utilitySubmetering from '../content/guide/09-utility-submetering.md?raw';
import tenantRatings from '../content/guide/10-tenant-ratings-reputation.md?raw';
import disputesComplaintsCommunity from '../content/guide/11-disputes-complaints-community.md?raw';
import gmAndBa from '../content/guide/12-general-manager-brand-ambassador.md?raw';
import securityAndPrivacy from '../content/guide/13-security-and-privacy.md?raw';
import notificationsAndReminders from '../content/guide/14-notifications-and-reminders.md?raw';
import reportsAndDataExport from '../content/guide/15-reports-and-data-export.md?raw';
import paymentPlansAndVacating from '../content/guide/16-payment-plans-and-vacating.md?raw';
import glossary from '../content/guide/17-glossary.md?raw';
import troubleshooting from '../content/guide/18-troubleshooting.md?raw';
import supportChannels from '../content/guide/19-support-channels.md?raw';
import stayingUpToDate from '../content/guide/20-staying-up-to-date.md?raw';
import mobileAndDevices from '../content/guide/21-mobile-and-devices.md?raw';
import statusPageAndReliability from '../content/guide/22-status-page-and-reliability.md?raw';
import automaticRentCollection from '../content/guide/23-automatic-rent-collection.md?raw';

import landlordDashboardOverview from '../content/guide/images/real/landlord-dashboard-overview.png';
import landlordUnitsOverdue from '../content/guide/images/real/landlord-units-overdue.png';
import landlordUnitsPaidVacant from '../content/guide/images/real/landlord-units-paid-vacant.png';
import landlordUnitDetail from '../content/guide/images/real/landlord-unit-detail.png';
import landlordSidebarMenu from '../content/guide/images/real/landlord-sidebar-menu.png';
import landlordSidebarFinances from '../content/guide/images/real/landlord-sidebar-finances.png';
import tenantPortalImg from '../content/guide/images/real/tenant-portal.png';
import tenantSidebarMenu from '../content/guide/images/real/tenant-sidebar-menu.png';

// Maps the relative image paths used inside the markdown files to their
// bundled URLs, so the same .md source works both here and in the PDF
// build script (which resolves the same relative paths from disk).
const IMAGE_MAP = {
  './images/real/landlord-dashboard-overview.png': landlordDashboardOverview,
  './images/real/landlord-units-overdue.png': landlordUnitsOverdue,
  './images/real/landlord-units-paid-vacant.png': landlordUnitsPaidVacant,
  './images/real/landlord-unit-detail.png': landlordUnitDetail,
  './images/real/landlord-sidebar-menu.png': landlordSidebarMenu,
  './images/real/landlord-sidebar-finances.png': landlordSidebarFinances,
  './images/real/tenant-portal.png': tenantPortalImg,
  './images/real/tenant-sidebar-menu.png': tenantSidebarMenu,
};

const SECTIONS = [
  { id: 'intro', label: 'What is RentaPay', body: intro },
  { id: 'pricing', label: 'Pricing', body: pricing },
  { id: 'payment-flow', label: 'How payments flow', body: paymentFlow },
  { id: 'landlord-portal', label: 'Landlord, Manager & Caretaker portal', body: landlordPortal },
  { id: 'tenant-portal', label: 'Tenant portal', body: tenantPortal },
  { id: 'security-deposits', label: 'Security deposits', body: securityDeposits },
  { id: 'utility-submetering', label: 'Utility submetering', body: utilitySubmetering },
  { id: 'tenant-ratings', label: 'Tenant ratings & reputation', body: tenantRatings },
  { id: 'disputes-community', label: 'Disputes, complaints & community', body: disputesComplaintsCommunity },
  { id: 'gm-ba', label: 'General Managers & Brand Ambassadors', body: gmAndBa },
  { id: 'security-privacy', label: 'Security & privacy', body: securityAndPrivacy },
  { id: 'notifications', label: 'Notifications & reminders', body: notificationsAndReminders },
  { id: 'reports-data-export', label: 'Reports, documents & data export', body: reportsAndDataExport },
  { id: 'payment-plans-vacating', label: 'Payment plans & giving notice', body: paymentPlansAndVacating },
  { id: 'automatic-rent-collection', label: 'Automatic rent collection', body: automaticRentCollection },
  { id: 'getting-started', label: 'Getting started', body: gettingStarted },
  { id: 'troubleshooting', label: 'Troubleshooting', body: troubleshooting },
  { id: 'support-channels', label: 'How to reach support', body: supportChannels },
  { id: 'staying-up-to-date', label: 'Staying up to date', body: stayingUpToDate },
  { id: 'status-page', label: 'Status page & reliability', body: statusPageAndReliability },
  { id: 'mobile-and-devices', label: 'Using RentaPay on any device', body: mobileAndDevices },
  { id: 'faq', label: 'FAQ', body: faq },
  { id: 'glossary', label: 'Glossary', body: glossary },
];

function GuideImage({ src, alt }) {
  const resolved = IMAGE_MAP[src] || src;
  return <img src={resolved} alt={alt} className="resources-page__img" loading="lazy" />;
}

export default function Resources() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="resources-page">
      <header className="resources-page__header">
        <Link to="/" className="resources-page__brand">RentaPay</Link>

        <button
          className="resources-page__nav-toggle"
          onClick={() => setNavOpen((v) => !v)}
          aria-expanded={navOpen}
          aria-label="Toggle contents menu"
        >
          Contents
        </button>

        <nav className={`resources-page__nav ${navOpen ? 'is-open' : ''}`}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={() => setNavOpen(false)}>{s.label}</a>
          ))}
          <span className="resources-page__nav-divider" aria-hidden="true" />
          <Link to="/terms" onClick={() => setNavOpen(false)}>Terms</Link>
          <Link to="/privacy" onClick={() => setNavOpen(false)}>Privacy</Link>
        </nav>

        <a
          className="resources-page__download"
          href="/downloads/rentapay-guide.pdf"
          download
        >
          ⬇ Download PDF
        </a>
      </header>

      <main className="resources-page__main">
        <div className="resources-page__hero">
          <h1>Understand RentaPay</h1>
          <p>
            How RentaPay works for landlords, property managers and caretakers, and
            tenants - pricing, setup, and what each portal looks like. Read it here,
            or download it as a PDF using the button above.
          </p>
        </div>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="resources-page__section">
            <ReactMarkdown
              components={{
                img: ({ src, alt }) => <GuideImage src={src} alt={alt} />,
              }}
            >
              {s.body}
            </ReactMarkdown>
          </section>
        ))}

        <section id="legal" className="resources-page__section resources-page__legal">
          <h2>Policies</h2>
          <p>
            Our Terms &amp; Conditions and Privacy Policy are kept up to date on their
            own pages, independent of this guide, so you're always reading the current
            version.
          </p>
          <div className="resources-page__legal-links">
            <Link to="/terms">Terms &amp; Conditions →</Link>
            <Link to="/privacy">Privacy Policy →</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
