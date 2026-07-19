import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Countdown from '../components/Countdown.jsx';
import { api, ApiError } from '../api/client.js';
import { initPushSubscription } from '../utils/push.js';
import ComplaintsPanel from '../components/ComplaintsPanel.jsx';
import AnnouncementBell from '../components/AnnouncementBell.jsx';
import './AddTenant.css';
import './TenantPortal.css';
import './Login.css';
import '../components/Countdown.css';

// One county's total shelf life is exactly 1 year (365 days) - used to
// turn "time left" into a 0-100% progress bar per county, so a scout
// juggling several counties can tell at a glance which is closest to
// lapsing, without reading each date.
const COUNTY_SUBSCRIPTION_DAYS = 365;
function percentRemaining(expiresAt) {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  const pct = (msLeft / (COUNTY_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000)) * 100;
  return Math.max(0, Math.min(100, pct));
}

// Phase 4's final step (county selection + payment), reachable once a
// Scout has verified their OTP and logged in. This intentionally does
// NOT try to be the full Phase 6 portal (sidebar, Browse Vacancies,
// Messages) - it's the minimum needed to get a Scout from "just
// registered" to "has at least one paid county", which is the gate
// everything in Phase 5 depends on. Phase 6 replaces/wraps this with
// the full sidebar layout.
export default function ScoutPortal() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [pricing, setPricing] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState(null);
  const [selectedCounties, setSelectedCounties] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(null); // { checkoutRequestId, amount, counties }

  const [showManualPay, setShowManualPay] = useState(false);
  const [manualForm, setManualForm] = useState({ transactionCode: '', amountPaid: '', mpesaPayerName: '', mpesaPayerPhone: '', mpesaSmsTimestamp: '' });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [myManualPayment, setMyManualPayment] = useState(null);
  const [scoutProfile, setScoutProfile] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    api.getScoutCountyPricing().then((res) => setPricing(res.counties || [])).catch(() => {});
    loadSubscriptions();
    api.getMyLatestScoutManualCountyPayment(token).then(setMyManualPayment).catch(() => {});
    api.getMyScoutProfile(token).then(setScoutProfile).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // "Live push" - see Dashboard.jsx/TenantPortal.jsx's identical
  // effect. New vacancies in a county the scout is actively
  // subscribed to (and county-subscription-expiry reminders) now push
  // here too - see unit.controller.js's updateUnitStatus and
  // scoutSubscriptionReminders.job.js for the two trigger points.
  useEffect(() => {
    initPushSubscription(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function loadSubscriptions() {
    api.getMyScoutSubscriptions(token).then(setMySubscriptions).catch(() => {});
  }

  const activeCounties = (mySubscriptions || []).filter((s) => s.status === 'active');
  const expiredCounties = (mySubscriptions || []).filter((s) => s.status === 'expired');
  const alreadyCovered = new Set((mySubscriptions || []).map((s) => s.county));

  function toggleCounty(county) {
    setSelectedCounties((prev) => (prev.includes(county) ? prev.filter((c) => c !== county) : [...prev, county]));
  }

  const totalCost = pricing.filter((c) => selectedCounties.includes(c.county)).reduce((sum, c) => sum + Number(c.annual_price), 0);

  async function handlePay(e) {
    e.preventDefault();
    setError('');
    if (selectedCounties.length === 0) {
      setError('Select at least one county.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.subscribeScoutCounties({ counties: selectedCounties }, token);
      setPending({ checkoutRequestId: res.checkoutRequestId, amount: res.amount, counties: res.counties });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start payment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    setManualError('');
    if (!manualForm.transactionCode || !manualForm.amountPaid || !manualForm.mpesaPayerName || !manualForm.mpesaPayerPhone) {
      setManualError('Please fill in all fields exactly as shown on your M-Pesa confirmation SMS.');
      return;
    }
    setManualSubmitting(true);
    try {
      const res = await api.submitScoutManualCountyPayment({ counties: selectedCounties.length ? selectedCounties : pending?.counties, ...manualForm }, token);
      setMyManualPayment(res.confirmation);
      setShowManualPay(false);
    } catch (err) {
      setManualError(err instanceof ApiError ? err.message : 'Failed to submit payment.');
    } finally {
      setManualSubmitting(false);
    }
  }

  return (
    <div className="add-tenant-page">
      <div className="add-tenant-header">
        <h1>RentaPay Scout</h1>
        <AnnouncementBell token={token} role="scout" />
      </div>

      {mySubscriptions === null ? (
        <p>Loading…</p>
      ) : (
        <>
          <ComplaintsPanel token={token} name={scoutProfile?.full_name} defaultPhone={scoutProfile?.phone} />

          {activeCounties.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2>My active counties</h2>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {activeCounties.map((s) => {
                  const pct = percentRemaining(s.expires_at);
                  const urgent = pct <= 15;
                  return (
                    <li key={s.county} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                        <strong>{s.county}</strong>
                        <span style={{ fontSize: '0.85em', color: '#666' }}>
                          expires {new Date(s.expires_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      <div style={{ margin: '6px 0' }}>
                        <Countdown target={s.expires_at} expiredLabel="Expired" /> left
                      </div>
                      <div style={{ background: '#eee', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: urgent ? '#B3261E' : '#2E7D32',
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                      {urgent && <small style={{ color: '#B3261E' }}>Renew soon — less than 15% of the year remains.</small>}
                    </li>
                  );
                })}
              </ul>
              <Link to="/scout-vacancies" className="login-page__link-btn">Browse vacant units in my counties →</Link>
            </section>
          )}

          {expiredCounties.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <h2>Expired</h2>
              <ul>
                {expiredCounties.map((s) => (
                  <li key={s.county}>{s.county} — expired {new Date(s.expires_at).toLocaleDateString('en-GB')} (renew below)</li>
                ))}
              </ul>
            </section>
          )}

          {activeCounties.length === 0 && (
            <p className="tenant-portal-hint" style={{ marginBottom: 16 }}>
              You have no active county subscriptions yet. Vacancies in a subscribed county are fully visible; every
              other county still shows a live vacancy count so you can decide what's worth subscribing to.
            </p>
          )}

          {pending ? (
            <section>
              <p className="tenant-portal-hint">
                Check your phone to complete the M-Pesa payment for {pending.counties.join(', ')} (KES {pending.amount}).
              </p>
              <Button type="button" variant="secondary" onClick={loadSubscriptions}>I've paid — refresh</Button>
              <button type="button" className="login-page__link-btn" onClick={() => setShowManualPay(true)} style={{ marginTop: 10 }}>
                Didn't get the M-Pesa prompt? Pay manually
              </button>
            </section>
          ) : (
            <form onSubmit={handlePay}>
              <h2>Subscribe to counties</h2>
              <div className="form-field">
                {pricing.map((c) => (
                  <label key={c.county} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={selectedCounties.includes(c.county)}
                      disabled={alreadyCovered.has(c.county) && activeCounties.some((s) => s.county === c.county)}
                      onChange={() => toggleCounty(c.county)}
                    />
                    {c.county} — KES {c.annual_price}/year{alreadyCovered.has(c.county) && activeCounties.some((s) => s.county === c.county) ? ' (already active)' : ''}
                  </label>
                ))}
              </div>
              {selectedCounties.length > 0 && <p><strong>Total: KES {totalCost}/year</strong></p>}
              {error && <p className="login-page__error" role="alert">{error}</p>}
              <Button type="submit" variant="primary" loading={submitting}>Pay with M-Pesa</Button>
            </form>
          )}

          {myManualPayment && myManualPayment.status === 'pending' && (
            <p className="tenant-portal-hint" style={{ marginTop: 16 }}>
              Your manual payment for {myManualPayment.counties.join(', ')} is awaiting admin review.
            </p>
          )}

          {showManualPay && (
            <form onSubmit={handleManualSubmit} style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <h3>Pay manually to RentaPay's Paybill</h3>
              <div className="form-field">
                <label className="form-field__label">M-Pesa transaction code</label>
                <input required value={manualForm.transactionCode} onChange={(e) => setManualForm((f) => ({ ...f, transactionCode: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-field__label">Amount paid</label>
                <input required type="number" value={manualForm.amountPaid} onChange={(e) => setManualForm((f) => ({ ...f, amountPaid: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-field__label">Payer name (as shown on M-Pesa)</label>
                <input required value={manualForm.mpesaPayerName} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerName: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="form-field__label">Payer phone</label>
                <input required value={manualForm.mpesaPayerPhone} onChange={(e) => setManualForm((f) => ({ ...f, mpesaPayerPhone: e.target.value }))} />
              </div>
              {manualError && <p className="login-page__error" role="alert">{manualError}</p>}
              <Button type="submit" variant="primary" loading={manualSubmitting}>Submit for review</Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
