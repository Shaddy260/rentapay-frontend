import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import HeroPhotoBackground from '../components/HeroPhotoBackground.jsx';
import DownloadAppSection from '../components/DownloadAppSection.jsx';
import './Landing.css';

// REDESIGN (Premium Redesign Plan, Phase 2): the hero's headline,
// subtext, and single CTA all swap together based on the audience
// toggle - everything else on the page (how-it-works, testimonials,
// footer) stays static, no page duplication. Landlord is the default
// selection.
const HERO_CONTENT = {
  landlord: {
    eyebrow: "BUILT FOR KENYA's LANDLORDS",
    headline: 'Run your properties like a pro.',
    sub: 'Easily manage your properties and tenants, take M-Pesa payments, and monitor every unit in real time, all from one place, on any phone.',
    ctaLabel: 'Get started',
    ctaTo: '/register',
  },
  seeker: {
    eyebrow: "KENYA'S VACANT UNITS, ONE TAP AWAY",
    headline: 'Home hunting, minus the hustle.',
    sub: 'Browse vacant units by county and constituency, and reach out directly on WhatsApp, completely free, no account needed.',
    ctaLabel: 'Browse listings',
    ctaTo: '/find-a-house',
  },
};

/**
 * FEATURE (direct request: "landing page"). Previously `/` redirected
 * straight to `/login`, so anyone arriving at the domain with no
 * account was immediately asked to log in with no explanation of what
 * RentaPay even is. This is the first thing a new visitor sees:
 * what the product does, who it's for, and clear CTAs into the three
 * places someone can actually go next - sign up as a landlord, log
 * in, or browse listings with no account at all.
 */
export default function Landing() {
  // REDESIGN (Premium Redesign Plan, Phase 2): two-audience hero toggle.
  const [audience, setAudience] = useState('landlord');
  const hero = HERO_CONTENT[audience];

  return (
    <div className="landing">
      {/* REDESIGN (Premium Redesign Plan, Phase 1): nav simplified to
          just Logo | Login - the "Get started" CTA and the browse/
          resources links were competing with the hero's own CTA, and
          the APK download pill moved down into the footer as a proper
          card (see DownloadAppSection below). */}
      <header className="landing__nav">
        <div className="landing__nav-brand">RentaPay</div>
        <div className="landing__nav-actions">
          <Link to="/login" className="landing__nav-login">Log in</Link>
        </div>
      </header>

      <section className="landing__hero">
        <div className="landing__hero-blob landing__hero-blob--a" aria-hidden="true" />
        <div className="landing__hero-blob landing__hero-blob--b" aria-hidden="true" />
        <HeroPhotoBackground />

        <div className="landing__hero-inner">
          <div className="landing__hero-content">
            {/* REDESIGN (Premium Redesign Plan, Phase 2): segmented
                pill toggle near the top of the hero. Toggling only
                swaps the headline/subtext/CTA below - the rotating
                photo background, blobs, and rest of the page are
                untouched. */}
            <div className="landing__audience-toggle" role="tablist" aria-label="I am a...">
              <button
                type="button"
                role="tab"
                aria-selected={audience === 'landlord'}
                className={`landing__audience-toggle-btn${audience === 'landlord' ? ' landing__audience-toggle-btn--active' : ''}`}
                onClick={() => setAudience('landlord')}
              >
                I&apos;m a Landlord
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={audience === 'seeker'}
                className={`landing__audience-toggle-btn${audience === 'seeker' ? ' landing__audience-toggle-btn--active' : ''}`}
                onClick={() => setAudience('seeker')}
              >
                I&apos;m looking for a home
              </button>
            </div>

            <span className="landing__eyebrow">{hero.eyebrow}</span>
            <h1>{hero.headline}</h1>
            <p className="landing__hero-sub">{hero.sub}</p>
            <div className="landing__hero-actions">
              <Link to={hero.ctaTo} className="landing__btn landing__btn--primary">{hero.ctaLabel}</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="landing__audiences">
        <div className="landing__audience-card">
          <span className="landing__audience-icon">🏢</span>
          <h3>Landlords &amp; managers</h3>
          <p>Add properties and units, track who&apos;s paid, send reminders, and reconcile every rent payment&nbsp;- or connect your own Till/Paybill and let it collect and confirm itself, automatically, for good.</p>
          <Link to="/register" className="landing__audience-link">Sign up as a landlord →</Link>
        </div>
        <div className="landing__audience-card">
          <span className="landing__audience-icon">🧾</span>
          <h3>Tenants</h3>
          <p>See your balance, pay rent - instantly by M-Pesa prompt if your landlord has automatic collection on, or by submitting your code otherwise - raise a maintenance request, and message your landlord: no more chasing receipts.</p>
          <Link to="/login" className="landing__audience-link">Log in to your portal →</Link>
        </div>
        <div className="landing__audience-card">
          <span className="landing__audience-icon">🔎</span>
          <h3>Looking for a place?</h3>
          <p>Browse vacant units by county and constituency, and reach out directly on WhatsApp, completely free, no account needed.</p>
          <Link to="/find-a-house" className="landing__audience-link">Browse listings →</Link>
        </div>
      </section>

      <section className="landing__features">
        <div className="landing__features-inner">
          <h2>Everything rent management should be</h2>
          <div className="landing__feature-grid">
            <div className="landing__feature">
              <span className="landing__feature-icon">💳</span>
              <h4>M-Pesa payments, manual or fully automatic</h4>
              <p>Tenants pay via Paybill, Till, or Send Money and submit their code - or, if you connect your own Till/Paybill, they get a real M-Pesa prompt and balances update themselves, automatically.</p>
            </div>
            <div className="landing__feature">
              <span className="landing__feature-icon">📊</span>
              <h4>One dashboard, every property</h4>
              <p>See balances, overdue rent, and occupancy across all your units at a glance.</p>
            </div>
            <div className="landing__feature">
              <span className="landing__feature-icon">💬</span>
              <h4>Built-in messaging</h4>
              <p>Chat with tenants or landlords, post announcements, and share documents.</p>
            </div>
            <div className="landing__feature">
              <span className="landing__feature-icon">🔒</span>
              <h4>Secure by design</h4>
              <p>Bank-grade encryption, fingerprint login, and account-level access control.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing__final-cta">
        <h2>Ready to get started?</h2>
        <p>It takes a few minutes to set up your first property.</p>
        <Link to="/register" className="landing__btn landing__btn--primary">Get started</Link>
      </section>

      {/* REDESIGN (Premium Redesign Plan, Phase 3): testimonials
          section removed entirely - no replacement, the final-cta and
          footer sections simply close the gap. See DownloadAppSection
          below for the footer's "Download the app" card. */}

      <footer className="landing__footer">
        <div className="landing__footer-top">
          <div className="landing__footer-brand">RentaPay</div>
          <DownloadAppSection />
        </div>
        <div className="landing__footer-links">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/resources">Resources</Link>
          <Link to="/status">System Status</Link>
        </div>
      </footer>
    </div>
  );
}
