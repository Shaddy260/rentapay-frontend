import React from 'react';
import { Link } from 'react-router-dom';
import HeroPhotoBackground from '../components/HeroPhotoBackground.jsx';
import PlatformReviews from '../components/PlatformReviews.jsx';
import InstallAppBanner from '../components/InstallAppBanner.jsx';
import DownloadAppSection from '../components/DownloadAppSection.jsx';
import './Landing.css';

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
  return (
    <div className="landing">
      <header className="landing__nav">
        <div className="landing__nav-brand">RentaPay</div>
        <nav className="landing__nav-links">
          <Link to="/find-a-house" className="landing__nav-link">Browse listings</Link>
          <Link to="/resources" className="landing__nav-link">Resources</Link>
        </nav>
        <div className="landing__nav-actions">
          <DownloadAppSection />
          <Link to="/login" className="landing__nav-login">Log in</Link>
          <Link to="/register" className="landing__nav-cta">Get started</Link>
        </div>
      </header>

      <section className="landing__hero">
        <div className="landing__hero-blob landing__hero-blob--a" aria-hidden="true" />
        <div className="landing__hero-blob landing__hero-blob--b" aria-hidden="true" />
        <HeroPhotoBackground />

        <div className="landing__hero-inner">
          <div className="landing__hero-content">
            <span className="landing__eyebrow">✦ Premium property management, built for Kenya</span>
            <h1>Management made simple.</h1>
            <p className="landing__hero-sub">
              Easily manage your properties and tenants, take M-Pesa payments,
              and monitor every unit in real time — all from one place, on any
              phone.
            </p>
            <p className="landing__hero-sub landing__hero-sub--gold">
              Searching for a home? Discover vacant units in your preferred
              location in seconds.
            </p>
            <div className="landing__hero-actions">
              <Link to="/register" className="landing__btn landing__btn--primary">Get started</Link>
              <Link to="/find-a-house" className="landing__btn landing__btn--secondary">Browse listings</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FIX (direct request: "when I search for it it does not offer
          a button to download"): InstallAppBanner previously only
          rendered on the Login page. Someone finding RentaPay through
          a Google search lands here on Landing, at "/", not on
          /login - so they never saw an install/download option at
          all, no matter how long they stayed on the site. Placing it
          here means the very first page a new visitor sees offers it.
          It also self-hides once the app is already installed, and a
          person can dismiss it (14-day snooze) without it blocking
          anything below. */}
      <InstallAppBanner />

      <section className="landing__audiences">
        <div className="landing__audience-card">
          <span className="landing__audience-icon">🏢</span>
          <h3>Landlords &amp; managers</h3>
          <p>Add properties and units, track who&apos;s paid, send reminders, and see every rent payment reconciled the moment your tenant submits their M-Pesa code.</p>
          <Link to="/register" className="landing__audience-link">Sign up as a landlord →</Link>
        </div>
        <div className="landing__audience-card">
          <span className="landing__audience-icon">🧾</span>
          <h3>Tenants</h3>
          <p>See your balance, submit your M-Pesa payment code, raise a maintenance request, and message your landlord — no more chasing receipts.</p>
          <Link to="/login" className="landing__audience-link">Log in to your portal →</Link>
        </div>
        <div className="landing__audience-card">
          <span className="landing__audience-icon">🔎</span>
          <h3>Looking for a place?</h3>
          <p>Browse vacant units by county and constituency, and reach out directly on WhatsApp — completely free, no account needed.</p>
          <Link to="/find-a-house" className="landing__audience-link">Browse listings →</Link>
        </div>
      </section>

      <section className="landing__features">
        <div className="landing__features-inner">
          <h2>Everything rent management should be</h2>
          <div className="landing__feature-grid">
            <div className="landing__feature">
              <span className="landing__feature-icon">💳</span>
              <h4>M-Pesa payments, reconciled automatically</h4>
              <p>Tenants pay via Paybill, Till, or Send Money and submit their code - matched to their account with automatic receipts.</p>
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

      {/* FEATURE (direct request: "Download RentaPay App" button on the
          landing page, serving a real APK). Separate, additional path
          from InstallAppBanner above - that one triggers the browser's
          native PWA install prompt; this one is a plain static-file
          download of the signed TWA-wrapped APK for people who want the
          app directly, since there's no Play Store listing yet.
          FIX (direct request): moved into the top nav next to Log in /
          Get started as a small pill - see DownloadAppSection.jsx. */}

      <PlatformReviews />

      <footer className="landing__footer">
        <div className="landing__footer-brand">RentaPay</div>
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
