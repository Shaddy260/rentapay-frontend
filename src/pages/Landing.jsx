import React from 'react';
import { Link } from 'react-router-dom';
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
          <Link to="/login" className="landing__nav-link">Log in</Link>
          <Link to="/register" className="landing__nav-cta">Get started</Link>
        </nav>
      </header>

      <section className="landing__hero">
        <div className="landing__hero-blob landing__hero-blob--a" aria-hidden="true" />
        <div className="landing__hero-blob landing__hero-blob--b" aria-hidden="true" />

        <div className="landing__hero-content">
          <span className="landing__eyebrow">Built for Kenyan landlords &amp; tenants</span>
          <h1>Management made simple.</h1>
          <p className="landing__hero-sub">
            Collect rent over M-Pesa, track every unit, and keep landlords and
            tenants on the same page — all from one place, on any phone.
          </p>
          <div className="landing__hero-actions">
            <Link to="/register" className="landing__btn landing__btn--primary">Get started free</Link>
            <Link to="/find-a-house" className="landing__btn landing__btn--secondary">Browse listings</Link>
          </div>
          <p className="landing__hero-note">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </section>

      <section className="landing__audiences">
        <div className="landing__audience-card">
          <span className="landing__audience-icon">🏢</span>
          <h3>Landlords &amp; managers</h3>
          <p>Add properties and units, track who&apos;s paid, send reminders, and get an M-Pesa STK push straight to your tenants&apos; phones.</p>
          <Link to="/register" className="landing__audience-link">Sign up as a landlord →</Link>
        </div>
        <div className="landing__audience-card">
          <span className="landing__audience-icon">🧾</span>
          <h3>Tenants</h3>
          <p>See your balance, pay rent instantly, raise a maintenance request, and message your landlord — no more chasing receipts.</p>
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
        <h2>Everything rent management should be</h2>
        <div className="landing__feature-grid">
          <div className="landing__feature">
            <span className="landing__feature-icon">💳</span>
            <h4>Instant M-Pesa payments</h4>
            <p>STK push rent collection with automatic receipts and reconciliation.</p>
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
      </section>

      <section className="landing__final-cta">
        <h2>Ready to get started?</h2>
        <p>It takes a few minutes to set up your first property.</p>
        <Link to="/register" className="landing__btn landing__btn--primary">Get started free</Link>
      </section>

      <footer className="landing__footer">
        <div className="landing__footer-brand">RentaPay</div>
        <div className="landing__footer-links">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/status">System Status</Link>
        </div>
      </footer>
    </div>
  );
}
