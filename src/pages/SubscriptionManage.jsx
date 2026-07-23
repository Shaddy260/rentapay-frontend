import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PaymentDetailsCard from '../components/PaymentDetailsCard.jsx';
import { api, ApiError } from '../api/client.js';
import './AddTenant.css';

const PERIOD_DISCOUNTS = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };
// Updated per direct request: KES 150 -> 70 -> 50/unit/month
const BASE_RATE = 50;

export default function SubscriptionManage() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [status, setStatus] = useState(null);
  const [periodMonths, setPeriodMonths] = useState(1);
  const [unitsCount, setUnitsCount] = useState(5);
  const [error, setError] = useState('');

  // FIX (direct request: "the manual payment feature... is not
  // persistent, it's not visible until i reload the page and it only
  // appears for like 2 seconds and disappears"): `pending` used to be
  // plain useState, which React wipes on every reload - so the "check
  // your phone" screen (and everything hanging off it, including the
  // manual-pay fallback) only ever existed for the lifetime of that
  // one render. Persisting it to sessionStorage (same pattern as
  // RegisterFlow.jsx's STORAGE_KEY) means a reload, or a tab closed
  // and reopened, lands right back on this screen instead of the bare
  // renewal form - a landlord is never able to "escape" a payment
  // that hasn't been confirmed yet by simply refreshing.
  const PENDING_KEY = 'rentapay_subscription_pending';
  const [pending, setPendingState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw).pending : null;
    } catch {
      return null;
    }
  });
  const [preRenewalSnapshot, setPreRenewalSnapshot] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw).preRenewalSnapshot : null;
    } catch {
      return null;
    }
  });
  // True while a manual payment has been submitted but not yet acted
  // on by an admin, and no STK checkoutRequestId exists for this
  // attempt (i.e. the landlord went straight to "pay manually"
  // without ever tapping "Pay via M-Pesa" first). Gates the same as
  // `pending` does, just for the other payment path.
  const [manualAwaiting, setManualAwaiting] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? !!JSON.parse(raw).manualAwaiting : false;
    } catch {
      return false;
    }
  });
  const [submitting, setSubmitting] = useState(false);

  function setPending(next, snapshot) {
    setPendingState(next);
    if (snapshot !== undefined) setPreRenewalSnapshot(snapshot);
    if (next) setManualAwaiting(false);
    try {
      if (next) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ pending: next, preRenewalSnapshot: snapshot !== undefined ? snapshot : preRenewalSnapshot }));
        // Push a real history entry the moment we enter the payment-
        // waiting screen, so the phone's hardware/browser back button
        // takes the person back to the renewal form (handled by the
        // popstate listener below) instead of skipping straight past
        // this whole page to wherever they were before it.
        window.history.pushState({ rentapaySubscriptionPending: true }, '');
      } else {
        sessionStorage.removeItem(PENDING_KEY);
      }
    } catch {
      // sessionStorage can throw in private-browsing/storage-full edge
      // cases - non-fatal, the payment itself still goes through.
    }
  }

  // Back button while on the "check your phone" / "awaiting
  // confirmation" screen -> return to the renewal form instead of
  // leaving the page entirely.
  useEffect(() => {
    function onPopState() {
      setPendingState(null);
      setManualAwaiting(false);
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* non-fatal */ }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // "Didn't receive the popup? Pay manually" fallback state.
  const [showManualPay, setShowManualPay] = useState(false);
  const [manualForm, setManualForm] = useState({ transactionCode: '', amountPaid: '', mpesaPayerName: '', mpesaPayerPhone: '', mpesaSmsTimestamp: '' });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [myManualPayment, setMyManualPayment] = useState(null);

  function loadMyManualPayment() {
    if (!token) return;
    api.getMyLatestManualSubscriptionPayment(token).then(setMyManualPayment).catch(() => {});
  }
  useEffect(() => { loadMyManualPayment(); }, [token]);

  async function handleManualSubmit(e) {
    e.preventDefault();
    setManualError('');
    if (!manualForm.transactionCode || !manualForm.amountPaid || !manualForm.mpesaPayerName || !manualForm.mpesaPayerPhone) {
      setManualError('Please fill in all fields exactly as shown on your M-Pesa confirmation SMS.');
      return;
    }
    setManualSubmitting(true);
    try {
      await api.submitManualSubscriptionPayment(
        {
          transactionCode: manualForm.transactionCode.trim(),
          amountPaid: Number(manualForm.amountPaid),
          mpesaPayerName: manualForm.mpesaPayerName.trim(),
          mpesaPayerPhone: manualForm.mpesaPayerPhone.trim(),
          mpesaSmsTimestamp: manualForm.mpesaSmsTimestamp ? new Date(manualForm.mpesaSmsTimestamp).toISOString() : null,
          periodMonths: Number(periodMonths),
          unitsCount: Number(unitsCount),
          propertyId: status?.scopedToPropertyId || null,
        },
        token
      );
      setManualForm({ transactionCode: '', amountPaid: '', mpesaPayerName: '', mpesaPayerPhone: '', mpesaSmsTimestamp: '' });
      setShowManualPay(false);
      // FIX (direct request: "when a landlord decides to use either
      // manual or the push...either of them should work...proceed and
      // unlock the account and verify and proceed to the next step"):
      // a landlord can submit the manual form WITHOUT ever tapping
      // "Pay via M-Pesa" first, in which case `pending` (the STK
      // checkoutRequestId) is never set. Previously nothing then
      // watched for an admin to confirm it - the redirect-polling
      // effect below only ever ran when `pending` was truthy, so a
      // manual-only payment could get approved by the admin and the
      // landlord would just never find out until they happened to
      // reload. Snapshotting `status` here (same as handleRenew does
      // for the STK path) and persisting it lets the shared polling
      // effect below pick this path up too, purely by watching
      // whether myManualPayment ever flips off 'pending' - see that
      // effect for the actual redirect logic.
      if (!pending) {
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify({ pending: null, preRenewalSnapshot: status, manualAwaiting: true }));
          window.history.pushState({ rentapaySubscriptionPending: true }, '');
        } catch { /* non-fatal */ }
        setPreRenewalSnapshot(status);
        setManualAwaiting(true);
      }
      loadMyManualPayment();
    } catch (err) {
      setManualError(err instanceof ApiError ? err.message : 'Failed to submit payment.');
    } finally {
      setManualSubmitting(false);
    }
  }

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    const activePropertyId = sessionStorage.getItem('rentapay_active_property_id') || undefined;
    api
      .getSubscriptionStatus(token, activePropertyId)
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
    if ((!pending && !manualAwaiting) || !token) return undefined;

    const interval = setInterval(async () => {
      try {
        const res = await api.getSubscriptionStatus(token, status?.scopedToPropertyId || undefined);
        const renewalLandedAlready =
          preRenewalSnapshot &&
          (res.subscription_status === 'active' &&
            (res.subscription_status !== preRenewalSnapshot.subscription_status ||
              res.subscription_expires_at !== preRenewalSnapshot.subscription_expires_at));

        if (renewalLandedAlready) {
          clearInterval(interval);
          try { sessionStorage.removeItem(PENDING_KEY); } catch { /* non-fatal */ }
          // Full reload (not just a route change) so every part of the
          // dashboard - unit limit, countdown, everything - reflects
          // the renewed subscription fresh from the server.
          window.location.href = '/dashboard';
          return;
        }

        // Manual-only path: a landlord's admin could also REJECT the
        // payment, which never changes subscription_status/expires_at
        // at all - so the check above alone would poll forever. Catch
        // that here and drop back to the form with the rejection
        // banner (myManualPayment already surfaces the reason) instead
        // of silently polling past it.
        if (manualAwaiting && !pending) {
          const latest = await api.getMyLatestManualSubscriptionPayment(token);
          setMyManualPayment(latest);
          if (latest?.status === 'rejected') {
            clearInterval(interval);
            setManualAwaiting(false);
            try { sessionStorage.removeItem(PENDING_KEY); } catch { /* non-fatal */ }
          }
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
  }, [pending, manualAwaiting, token, preRenewalSnapshot]);

  const discount = PERIOD_DISCOUNTS[periodMonths] ?? 0;
  const rate = Math.round(BASE_RATE * (1 - discount) * 100) / 100;
  const totalCost = Math.round(rate * unitsCount * periodMonths * 100) / 100;

  async function handleRenew(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.renewSubscription({ plan: 'starter', periodMonths: Number(periodMonths), unitsCount: Number(unitsCount) }, token);
      setPending({ checkoutRequestId: res.checkoutRequestId, amountDue: res.amountDue }, status);
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
          <button
            type="button"
            className="ghost-link"
            style={{ marginTop: '0.5rem' }}
            onClick={() => { setShowManualPay(true); setPending(null); }}
          >
            Didn't get the prompt? Pay manually instead
          </button>
          <Button variant="primary" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  // FIX (direct request: "when a landlord decides to use either
  // manual or the push...either of them should work...proceed and
  // unlock the account and verify and proceed to the next step"): a
  // manual submission now gates the exact same way an STK push does -
  // the landlord is kept on this locked screen (not the normal form)
  // until an admin actually confirms or rejects it, and the polling
  // effect above takes them straight to a fresh dashboard the moment
  // that happens, with no reload needed.
  if (manualAwaiting && myManualPayment === null) {
    return <div className="add-tenant-page add-tenant-page--center">Loading…</div>;
  }

  if (manualAwaiting && myManualPayment?.status === 'pending') {
    return (
      <div className="add-tenant-page add-tenant-page--center">
        <div className="add-tenant-success">
          <span className="add-tenant-success__icon">⏳</span>
          <h2>Awaiting confirmation</h2>
          <p>
            Your manual payment (transaction {myManualPayment.transaction_code}, KES {Number(myManualPayment.amount_paid).toLocaleString()}) has been
            submitted and is awaiting admin confirmation.
          </p>
          <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>This page will automatically continue to your dashboard once it's confirmed - no need to refresh.</p>
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

      {/* Direct request: STK popups sometimes fail/delay/never arrive -
          this fallback stays visible at all times (it's never hidden
          behind a "pending" state - same fix as the tenant duplicate-
          confirmation bug) so a landlord/manager/caretaker always has
          a way to pay. */}
      <button type="button" className="ghost-link" style={{ marginTop: '0.75rem' }} onClick={() => setShowManualPay((o) => !o)}>
        {showManualPay ? 'Hide manual payment form' : "Didn't receive the popup? Pay manually"}
      </button>

      {myManualPayment?.status === 'pending' && (
        <div className="stk-pending paybill-pending" style={{ marginTop: '1rem' }}>
          <p>⏳ Manual payment submitted, waiting for admin approval.</p>
          <div className="paybill-pending__details">
            <div><span>Transaction code</span><span>{myManualPayment.transaction_code}</span></div>
            <div><span>Amount</span><span>KES {Number(myManualPayment.amount_paid).toLocaleString()}</span></div>
            <div><span>Submitted</span><span>{new Date(myManualPayment.submitted_at).toLocaleString('en-GB')}</span></div>
          </div>
        </div>
      )}
      {myManualPayment?.status === 'rejected' && (
        <div className="paybill-rejected-banner" style={{ marginTop: '1rem' }}>
          <p>❌ Your last manual payment submission was not approved.</p>
          {myManualPayment.rejection_reason && <p className="paybill-rejected-banner__reason">Reason: {myManualPayment.rejection_reason}</p>}
        </div>
      )}

      {showManualPay && (
        <div className="add-tenant-form" style={{ marginTop: '1rem', border: '1px solid var(--color-hairline, #e5e7eb)', borderRadius: 10, padding: '1rem' }}>
          <PaymentDetailsCard note="Once you've paid, fill in the details below exactly as shown on your M-Pesa confirmation SMS - the same way your tenants submit theirs." />
          {manualError && <p className="add-tenant-error">{manualError}</p>}
          <form onSubmit={handleManualSubmit}>
            <label className="form-field__label">Transaction code</label>
            <input required value={manualForm.transactionCode} onChange={(e) => setManualForm((f) => ({ ...f, transactionCode: e.target.value }))} placeholder="e.g. QGH7XYZ123" />

            <label className="form-field__label">Amount paid (KES)</label>
            <input required type="number" min="0" step="0.01" value={manualForm.amountPaid} onChange={(e) => setManualForm((f) => ({ ...f, amountPaid: e.target.value }))} />

            <label className="form-field__label">M-Pesa payer name</label>
            <input required value={manualForm.mpesaPayerName} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerName: e.target.value }))} placeholder="Name shown on the M-Pesa SMS" />

            <label className="form-field__label">Phone number paid from</label>
            <input required value={manualForm.mpesaPayerPhone} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerPhone: e.target.value }))} placeholder="e.g. 0712345678" />

            <label className="form-field__label">M-Pesa SMS time</label>
            <input type="datetime-local" value={manualForm.mpesaSmsTimestamp} onChange={(e) => setManualForm((f) => ({ ...f, mpesaSmsTimestamp: e.target.value }))} />

            <Button type="submit" variant="mpesa" loading={manualSubmitting} style={{ marginTop: '0.75rem' }}>Submit for review</Button>
          </form>
        </div>
      )}

      <p className="add-tenant-subtitle" style={{ marginTop: '2rem' }}>
        Looking for how rent reaches you? Payment method is now managed from <Link to="/settings">Settings</Link>.
      </p>
    </div>
  );
}
