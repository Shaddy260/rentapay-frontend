import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
import './AddTenant.css';

const PERIOD_DISCOUNTS = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };
// Updated per direct request: KES 150 -> 70/unit/month
const BASE_RATE = 70;

export default function SubscriptionManage() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [status, setStatus] = useState(null);
  const [periodMonths, setPeriodMonths] = useState(1);
  const [unitsCount, setUnitsCount] = useState(5);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // { checkoutRequestId, amountDue }
  const [submitting, setSubmitting] = useState(false);
  const [preRenewalSnapshot, setPreRenewalSnapshot] = useState(null); // status right before this renewal, to detect when it actually goes through

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    api
      .getSubscriptionStatus(token)
      .then((res) => {
        setStatus(res);
        setUnitsCount(res.unit_limit || 5);
      })
      .catch((err) => setError(err.message));
  }, [token, navigate]);

  // FIX ("after paying to renew, the portal just hangs on this screen
  // instead of going back to a normal, refreshed dashboard"): there
  // was nothing here watching for the M-Pesa payment to actually land -
  // the person was stuck staring at "check your phone" forever unless
  // they happened to click "Back to dashboard" themselves. This polls
  // subscription status every 3s while waiting, and the moment it
  // changes from what it was right before the renewal was submitted
  // (status flips to active, or the expiry date moves forward), it
  // automatically takes them to a freshly reloaded dashboard.
  useEffect(() => {
    if (!pending || !token) return undefined;

    const interval = setInterval(async () => {
      try {
        const res = await api.getSubscriptionStatus(token);
        const renewalLandedAlready =
          preRenewalSnapshot &&
          (res.subscription_status === 'active' &&
            (res.subscription_status !== preRenewalSnapshot.subscription_status ||
              res.subscription_expires_at !== preRenewalSnapshot.subscription_expires_at));

        if (renewalLandedAlready) {
          clearInterval(interval);
          // Full reload (not just a route change) so every part of the
          // dashboard - unit limit, countdown, everything - reflects
          // the renewed subscription fresh from the server.
          window.location.href = '/dashboard';
        }
      } catch {
        // transient network hiccup while polling - just try again next tick
      }
    }, 3000);

    // Safety net: stop polling after 2 minutes even if the callback
    // never arrives, so this doesn't poll forever in the background.
    const timeout = setTimeout(() => clearInterval(interval), 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pending, token, preRenewalSnapshot]);

  const discount = PERIOD_DISCOUNTS[periodMonths] ?? 0;
  const rate = Math.round(BASE_RATE * (1 - discount) * 100) / 100;
  const totalCost = Math.round(rate * unitsCount * periodMonths * 100) / 100;

  async function handleRenew(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      setPreRenewalSnapshot(status);
      const res = await api.renewSubscription({ plan: 'starter', periodMonths: Number(periodMonths), unitsCount: Number(unitsCount) }, token);
      setPending({ checkoutRequestId: res.checkoutRequestId, amountDue: res.amountDue });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start renewal.');
    } finally {
      setSubmitting(false);
    }
  }



  if (pending) {
    return (
      <div className="add-tenant-page add-tenant-page--center">
        <div className="add-tenant-success">
          <span className="add-tenant-success__icon">📲</span>
          <h2>Check your phone</h2>
          <p>An M-Pesa prompt for KES {pending.amountDue?.toLocaleString()} was sent. Enter your PIN to complete renewal.</p>
          <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>This page will automatically continue to your dashboard once the payment goes through - no need to refresh.</p>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="add-tenant-page">
      <Link to="/dashboard" className="add-tenant-back">← Back to dashboard</Link>
      <h1>Manage subscription</h1>

      {error && <div className="add-tenant-error">{error}</div>}

      {status && (
        <p className="add-tenant-subtitle">
          Current plan: {status.subscription_plan} · {status.daysLeft != null ? `${status.daysLeft} days left` : 'No active subscription'}
        </p>
      )}

      <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Renew or change period</h3>
      <form className="add-tenant-form" onSubmit={handleRenew}>
        <div className="add-tenant-grid">
          <div className="form-field">
            <label className="form-field__label">Units</label>
            <input type="number" min="1" value={unitsCount} onChange={(e) => setUnitsCount(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Period (months)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={periodMonths}
              onChange={(e) => setPeriodMonths(e.target.value)}
            />
            <p className="form-field__hint">Enter any length you want - discounts still apply automatically at 3, 6, and 12 months.</p>
          </div>
        </div>
        <p style={{ fontWeight: 700, marginBottom: '1rem' }}>Total: KES {totalCost.toLocaleString()} (KES {rate}/unit/month)</p>
        <Button type="submit" variant="mpesa" loading={submitting}>Pay via M-Pesa</Button>
      </form>

      <p className="add-tenant-subtitle" style={{ marginTop: '2rem' }}>
        Looking for how rent reaches you? Payment method is now managed from <Link to="/settings">Settings</Link>.
      </p>
    </div>
  );
}
