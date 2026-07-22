import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Countdown from '../components/Countdown.jsx';
import { api, ApiError } from '../api/client.js';
import { initPushSubscription } from '../utils/push.js';
import ComplaintsPanel from '../components/ComplaintsPanel.jsx';
import AnnouncementBell from '../components/AnnouncementBell.jsx';
import NotificationsBell from '../components/NotificationsBell.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import ChatWidget from '../components/ChatWidget.jsx';
import Faq from '../components/Faq.jsx';
import ScoutStatsPanel from '../components/ScoutStatsPanel.jsx';
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
// Scout has verified their OTP and logged in. Wrapped in the same
// PortalSidebar + BottomNav shell every other portal uses. Overview
// is now a lean dashboard (active/expiring counties + quick links)
// rather than always showing the full pricing/subscribe form below
// it - "Subscribe to Counties" is its own sidebar tab, matching how
// Dashboard.jsx/TenantPortal.jsx put long forms behind their own menu
// item instead of stacking everything on one screen. Messages opens
// the same ChatWidget/scout_landlord threads already wired up in
// ScoutVacancies.jsx, and Help/Complaints/FAQ get their own tabs too.
export default function ScoutPortal() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview | subscribe | complaints | faq
  const [chatOpen, setChatOpen] = useState(false);
  const [messagesBadge, setMessagesBadge] = useState(0);

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

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    function loadMessagesBadge() {
      api
        .listChatThreads(token)
        .then((res) => {
          if (cancelled) return;
          const total = (res.threads || []).reduce((sum, t) => sum + (t.unreadCount || 0), 0);
          setMessagesBadge(total);
        })
        .catch(() => {});
    }
    loadMessagesBadge();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') loadMessagesBadge();
    }, 20000);
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') loadMessagesBadge();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeTab}
        brandName="RentaPay Scout"
        items={[
          { key: 'overview', label: 'Overview', icon: '🏠', onClick: () => setActiveTab('overview') },
          { key: 'vacancies', label: 'Browse Vacancies', icon: '🔎', onClick: () => navigate('/scout-vacancies') },
          { key: 'subscribe', label: 'Subscribe to Counties', icon: '📍', onClick: () => setActiveTab('subscribe') },
          { key: 'messages', label: 'Messages', icon: '💬', badge: messagesBadge, onClick: () => setChatOpen(true) },
          { key: 'complaints', label: 'Help / Complaints', icon: '🆘', onClick: () => setActiveTab('complaints') },
          { key: 'faq', label: 'FAQs', icon: '❓', onClick: () => setActiveTab('faq') },
          {
            key: 'logout',
            label: 'Log out',
            icon: '🚪',
            onClick: () => {
              sessionStorage.removeItem('rentapay_token');
              sessionStorage.removeItem('rentapay_role');
              navigate('/login');
            },
          },
        ]}
      />

      <BottomNav
        activeKey={activeTab}
        items={[
          { key: 'overview', label: 'Home', icon: '🏠', onClick: () => setActiveTab('overview') },
          { key: 'vacancies', label: 'Vacancies', icon: '🔎', onClick: () => navigate('/scout-vacancies') },
          { key: 'complaints', label: 'Help', icon: '🆘', onClick: () => setActiveTab('complaints') },
          { key: 'messages', label: 'Messages', icon: '💬', onClick: () => setChatOpen(true) },
        ]}
      />

      <div className="add-tenant-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="portal-topbar__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
        <h1 style={{ flex: 1, marginBottom: 0 }}>RentaPay Scout</h1>
        <AnnouncementBell token={token} role="scout" />
        <NotificationsBell token={token} />
      </div>

      {mySubscriptions === null ? (
        <p>Loading…</p>
      ) : activeTab === 'complaints' ? (
        <ComplaintsPanel token={token} name={scoutProfile?.full_name} defaultPhone={scoutProfile?.phone} />
      ) : activeTab === 'faq' ? (
        <Faq audience="scout" />
      ) : activeTab === 'subscribe' ? (
        <>
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
              <div className="stk-pending paybill-pending" style={{ marginBottom: 12 }}>
                <div className="paybill-pending__details">
                  <div><span>Paybill</span><span><strong>522522</strong></span></div>
                  <div><span>Account Number</span><span><strong>1341657388</strong></span></div>
                </div>
              </div>
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
      ) : (
        <>
          <ScoutStatsPanel token={token} />
          {activeCounties.length > 0 ? (
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
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <Link to="/scout-vacancies" className="login-page__link-btn">Browse vacant units in my counties →</Link>
                <button type="button" className="login-page__link-btn" onClick={() => setActiveTab('subscribe')}>
                  Add or renew a county →
                </button>
              </div>
            </section>
          ) : (
            <section style={{ marginBottom: 24 }}>
              <p className="tenant-portal-hint" style={{ marginBottom: 16 }}>
                You have no active county subscriptions yet. Subscribe to a county to start seeing its vacant units.
              </p>
              <Button type="button" variant="primary" onClick={() => setActiveTab('subscribe')}>
                Subscribe to a county
              </Button>
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
              <button type="button" className="login-page__link-btn" onClick={() => setActiveTab('subscribe')}>
                Renew a county →
              </button>
            </section>
          )}

          {myManualPayment && myManualPayment.status === 'pending' && (
            <p className="tenant-portal-hint" style={{ marginTop: 16 }}>
              Your manual payment for {myManualPayment.counties.join(', ')} is awaiting admin review.
            </p>
          )}

          {pending && (
            <p className="tenant-portal-hint" style={{ marginTop: 16 }}>
              Check your phone to complete the M-Pesa payment for {pending.counties.join(', ')} (KES {pending.amount}), or{' '}
              <button type="button" className="login-page__link-btn" style={{ display: 'inline' }} onClick={() => setActiveTab('subscribe')}>
                open Subscribe to Counties
              </button>{' '}
              to pay manually instead.
            </p>
          )}
        </>
      )}

      <ChatWidget
        token={token}
        role="scout"
        hideLauncher
        controlledOpen={chatOpen}
        onOpenChange={setChatOpen}
      />
    </div>
  );
}
