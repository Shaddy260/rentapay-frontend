import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Countdown from '../components/Countdown.jsx';
import { api, ApiError } from '../api/client.js';
import { initPushSubscription } from '../utils/push.js';
import ComplaintsPanel from '../components/ComplaintsPanel.jsx';
import AnnouncementBell from '../components/AnnouncementBell.jsx';
import AccountMenu from '../components/AccountMenu.jsx';
import Avatar from '../components/Avatar.jsx';
import { useSharedPoll } from '../utils/sharedPoll.js';
import { useInstallPrompt } from '../utils/useInstallPrompt.js';
import '../components/InstallAppMenuItem.css';
import PortalSidebar from '../components/PortalSidebar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import ChatWidget from '../components/ChatWidget.jsx';
import Faq from '../components/Faq.jsx';
import ScoutStatsPanel from '../components/ScoutStatsPanel.jsx';
import PaymentDetailsCard from '../components/PaymentDetailsCard.jsx';
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
  const { canOffer: canOfferInstall, isIOS: installOnIOS, promptInstall } = useInstallPrompt();
  const [showIOSInstallSteps, setShowIOSInstallSteps] = useState(false);
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
  // FEATURE (direct request: "include a searchbar...when scouts are
  // browsing counties to subscribe to"): narrows the checkbox list
  // down as the scout types instead of scrolling through every county.
  const [countySearch, setCountySearch] = useState('');
  const filteredPricing = pricing.filter((c) => c.county.toLowerCase().includes(countySearch.trim().toLowerCase()));

  // FIX (direct request: "the payment flow should also apply to
  // scouts accounts... check whether they receive mpesa popups and
  // make sure its just exactly the same trail as the landlords"):
  // scouts DO get the same STK push, but this screen used to just
  // show a static "check your phone" message with no persistence and
  // no polling at all - a reload wiped it, and there was no way to
  // find out the payment had gone through except manually refreshing
  // and hoping. Same sessionStorage-persistence pattern as
  // SubscriptionManage.jsx now applies here too.
  const PENDING_KEY = 'rentapay_scout_county_pending';
  const [pending, setPendingState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  function setPending(next) {
    setPendingState(next);
    try {
      if (next) {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(next));
        // Same back-button fix as SubscriptionManage.jsx: push a real
        // history entry so a phone's back button returns to the
        // county-selection form instead of skipping past this whole
        // tab/page.
        window.history.pushState({ rentapayScoutPending: true }, '');
      } else {
        sessionStorage.removeItem(PENDING_KEY);
      }
    } catch {
      // non-fatal - sessionStorage can throw in private browsing
    }
  }

  useEffect(() => {
    function onPopState() {
      setPendingState(null);
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* non-fatal */ }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // FIX: this page previously never checked whether the STK push had
  // actually gone through - it just displayed "Check your phone" and
  // sat there. This polls the new self-heal endpoint
  // (checkScoutCountyPaymentStatus, mirroring the landlord
  // subscription-status poll) every 3s while pending, and the moment
  // it's confirmed (by Daraja OR by an admin manually confirming -
  // both flip mySubscriptions/scout_county_payments, so a fresh
  // getMyScoutSubscriptions() call picks either up) moves the scout
  // on automatically - including resuming correctly after a reload,
  // since `pending` above is now restored from sessionStorage first.
  useEffect(() => {
    if (!pending || !token) return undefined;

    const interval = setInterval(async () => {
      try {
        const res = await api.checkScoutCountyPaymentStatus(pending.checkoutRequestId, token);
        if (res.status === 'completed') {
          clearInterval(interval);
          setPending(null);
          window.location.href = '/scout-portal';
        } else if (res.status === 'failed') {
          clearInterval(interval);
          setError(res.reason ? `Payment was not completed: ${res.reason}. You can pay manually below instead.` : 'Payment was not completed (cancelled or insufficient funds). You can pay manually below instead.');
          setPending(null);
          setShowManualPay(true);
        }
      } catch {
        // transient network hiccup - just try again next tick
      }
    }, 3000);

    const timeout = setTimeout(() => clearInterval(interval), 120000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pending, token]);

  const [showManualPay, setShowManualPay] = useState(false);
  const [manualForm, setManualForm] = useState({ transactionCode: '', amountPaid: '', mpesaPayerName: '', mpesaPayerPhone: '', mpesaSmsTimestamp: '' });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState('');
  const [myManualPayment, setMyManualPayment] = useState(null);
  const [scoutProfile, setScoutProfile] = useState(null);
  // FEATURE (direct request: "scouts should have a profile like other
  // portals, be able to set their own profile"): mirrors the simple
  // edit-in-place pattern Settings.jsx uses for landlord contact info,
  // scoped down to what a scout actually has - name, email, bio. Phone
  // isn't editable here (see updateMyContact's comment server-side).
  const [profileDraft, setProfileDraft] = useState({ fullName: '', email: '', bio: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // FIX (direct request: "either manual or the push...either of them
  // should work...proceed and unlock the account"): same gap as
  // SubscriptionManage.jsx - a scout submitting the manual form
  // directly (without ever tapping "Pay with M-Pesa") had nothing
  // watching for an admin's confirmation. This mirrors that fix:
  // gates on the counties just submitted, restored from sessionStorage
  // so a reload doesn't lose it either.
  const MANUAL_AWAITING_KEY = 'rentapay_scout_manual_awaiting';
  const [manualAwaitingCounties, setManualAwaitingCounties] = useState(() => {
    try {
      const raw = sessionStorage.getItem(MANUAL_AWAITING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  function setManualAwaiting(counties) {
    setManualAwaitingCounties(counties);
    try {
      if (counties) {
        sessionStorage.setItem(MANUAL_AWAITING_KEY, JSON.stringify(counties));
        window.history.pushState({ rentapayScoutManualPending: true }, '');
      } else {
        sessionStorage.removeItem(MANUAL_AWAITING_KEY);
      }
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    function onPopState() {
      setManualAwaitingCounties(null);
      try { sessionStorage.removeItem(MANUAL_AWAITING_KEY); } catch { /* non-fatal */ }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Poll every 3s while a manual submission is awaiting review: either
  // it gets confirmed (activateScoutCounties flips those counties to
  // active in getMyScoutSubscriptions - reload straight to a fresh
  // portal, same as the STK path) or rejected (surfaced via the
  // rejection banner below, gate lifted so the form is usable again).
  useEffect(() => {
    if (!manualAwaitingCounties || !token) return undefined;

    const interval = setInterval(async () => {
      try {
        const [subsRes, latestRes] = await Promise.all([
          api.getMyScoutSubscriptions(token),
          api.getMyLatestScoutManualCountyPayment(token),
        ]);
        setMyManualPayment(latestRes);
        const nowActive = new Set((subsRes || []).filter((s) => s.status === 'active').map((s) => s.county));
        const allLanded = manualAwaitingCounties.every((c) => nowActive.has(c));
        if (allLanded) {
          clearInterval(interval);
          setManualAwaiting(null);
          window.location.href = '/scout-portal';
          return;
        }
        if (latestRes?.status === 'rejected') {
          clearInterval(interval);
          setManualAwaiting(null);
        }
      } catch {
        // transient network hiccup - just try again next tick
      }
    }, 3000);

    const timeout = setTimeout(() => clearInterval(interval), 120000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [manualAwaitingCounties, token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    api.getScoutCountyPricing().then((res) => setPricing(res.counties || [])).catch(() => {});
    loadSubscriptions();
    api.getMyLatestScoutManualCountyPayment(token).then(setMyManualPayment).catch(() => {});
    api
      .getMyScoutProfile(token)
      .then((profile) => {
        setScoutProfile(profile);
        setProfileDraft({ fullName: profile?.full_name || '', email: profile?.email || '', bio: profile?.bio || '' });
      })
      .catch(() => {});
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

  const loadMessagesBadge = useCallback(() => {
    if (!token) return;
    api
      .listChatThreads(token)
      .then((res) => {
        const total = (res.threads || []).reduce((sum, t) => sum + (t.unreadCount || 0), 0);
        setMessagesBadge(total);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadMessagesBadge();
  }, [loadMessagesBadge]);

  useSharedPoll(loadMessagesBadge, 20000);

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
      const countiesSubmitted = selectedCounties.length ? selectedCounties : pending?.counties;
      const res = await api.submitScoutManualCountyPayment({ counties: countiesSubmitted, ...manualForm }, token);
      setMyManualPayment(res.confirmation);
      setShowManualPay(false);
      setManualAwaiting(countiesSubmitted);
    } catch (err) {
      setManualError(err instanceof ApiError ? err.message : 'Failed to submit payment.');
    } finally {
      setManualSubmitting(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    if (!profileDraft.fullName.trim()) {
      setProfileError('Full name cannot be empty.');
      return;
    }
    setProfileSaving(true);
    try {
      const updated = await api.updateMyScoutProfile(
        { fullName: profileDraft.fullName, email: profileDraft.email, bio: profileDraft.bio },
        token
      );
      setScoutProfile((p) => ({ ...p, ...updated }));
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Failed to save profile.');
    } finally {
      setProfileSaving(false);
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
          { key: 'profile', label: 'My Profile', icon: '👤', onClick: () => setActiveTab('profile') },
          { key: 'vacancies', label: 'Browse Vacancies', icon: '🔎', onClick: () => navigate('/scout-vacancies') },
          { key: 'subscribe', label: 'Subscribe to Counties', icon: '📍', onClick: () => setActiveTab('subscribe') },
          { key: 'messages', label: 'Messages', icon: '💬', badge: messagesBadge, onClick: () => setChatOpen(true) },
          { key: 'complaints', label: 'Help / Complaints', icon: '🆘', onClick: () => setActiveTab('complaints') },
          { key: 'faq', label: 'FAQs', icon: '❓', onClick: () => setActiveTab('faq') },
          ...(canOfferInstall
            ? [{
                key: 'install-app',
                label: 'Download the App',
                icon: '📲',
                onClick: () => {
                  if (installOnIOS) setShowIOSInstallSteps(true);
                  else promptInstall();
                },
              }]
            : []),
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
        {scoutProfile && (
          <AccountMenu
            name={scoutProfile.full_name}
            photoUrl={scoutProfile.photo_url}
            role="scout"
            phone={scoutProfile.phone}
            token={token}
            onPhotoChange={(newUrl) => setScoutProfile((p) => ({ ...p, photo_url: newUrl }))}
          />
        )}
      </div>

      {showIOSInstallSteps && (
        <div className="install-app-menu-item__ios-modal" onClick={() => setShowIOSInstallSteps(false)}>
          <div className="install-app-menu-item__ios-modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>Install on iPhone/iPad</h4>
            <ol>
              <li>Tap the <strong>Share</strong> icon <span aria-hidden="true">⬆️</span> in Safari's toolbar</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong> in the top right</li>
            </ol>
            <button type="button" onClick={() => setShowIOSInstallSteps(false)}>Got it</button>
          </div>
        </div>
      )}

      {mySubscriptions === null ? (
        <p>Loading…</p>
      ) : activeTab === 'profile' ? (
        <section style={{ maxWidth: 480 }}>
          <h2>My Profile</h2>
          {scoutProfile && (
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={scoutProfile.full_name} photoUrl={scoutProfile.photo_url} size={64} />
              <span style={{ color: '#666', fontSize: '0.9em' }}>
                To change your photo, use the avatar menu at the top right of this page.
              </span>
            </div>
          )}
          <form onSubmit={handleSaveProfile}>
            <div className="form-field">
              <label className="form-field__label">Full name</label>
              <input
                required
                value={profileDraft.fullName}
                onChange={(e) => setProfileDraft((d) => ({ ...d, fullName: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="form-field__label">Phone</label>
              <input value={scoutProfile?.phone || ''} disabled />
              <small style={{ color: '#888' }}>Your phone is your login and can't be changed here.</small>
            </div>
            <div className="form-field">
              <label className="form-field__label">Email</label>
              <input
                type="email"
                value={profileDraft.email}
                onChange={(e) => setProfileDraft((d) => ({ ...d, email: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label className="form-field__label">About / operating area (optional)</label>
              <textarea
                rows={3}
                placeholder="e.g. I mostly scout units around Westlands and Kilimani."
                value={profileDraft.bio}
                onChange={(e) => setProfileDraft((d) => ({ ...d, bio: e.target.value }))}
              />
            </div>
            {profileError && <p className="login-page__error" role="alert">{profileError}</p>}
            {profileSaved && <p className="tenant-portal-hint">✓ Profile updated.</p>}
            <Button type="submit" variant="primary" loading={profileSaving}>Save profile</Button>
          </form>
        </section>
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
              <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>This page will automatically continue once the payment goes through - no need to refresh.</p>
              <button type="button" className="login-page__link-btn" onClick={() => { setShowManualPay(true); setPending(null); }} style={{ marginTop: 10 }}>
                Didn't get the M-Pesa prompt? Pay manually
              </button>
            </section>
          ) : manualAwaitingCounties ? (
            <section>
              <p className="tenant-portal-hint">
                ⏳ Your manual payment for {manualAwaitingCounties.join(', ')} has been submitted and is awaiting admin confirmation.
              </p>
              <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>This page will automatically continue once it's confirmed - no need to refresh.</p>
            </section>
          ) : (
            <form onSubmit={handlePay}>
              <h2>Subscribe to counties</h2>
              <div className="form-field" style={{ maxWidth: 320 }}>
                <label className="form-field__label">Search counties</label>
                <input
                  type="search"
                  placeholder="Type to search…"
                  value={countySearch}
                  onChange={(e) => setCountySearch(e.target.value)}
                />
              </div>
              <div className="form-field">
                {filteredPricing.length === 0 ? (
                  <p style={{ color: '#666' }}>No counties match "{countySearch}".</p>
                ) : (
                  filteredPricing.map((c) => (
                  <label key={c.county} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={selectedCounties.includes(c.county)}
                      disabled={alreadyCovered.has(c.county) && activeCounties.some((s) => s.county === c.county)}
                      onChange={() => toggleCounty(c.county)}
                    />
                    {c.county} — KES {c.annual_price}/year{alreadyCovered.has(c.county) && activeCounties.some((s) => s.county === c.county) ? ' (already active)' : ''}
                  </label>
                  ))
                )}
              </div>
              {selectedCounties.length > 0 && <p><strong>Total: KES {totalCost}/year</strong></p>}
              {error && <p className="login-page__error" role="alert">{error}</p>}
              <Button type="submit" variant="primary" loading={submitting}>Pay with M-Pesa</Button>
            </form>
          )}

          {myManualPayment && myManualPayment.status === 'rejected' && !manualAwaitingCounties && (
            <p className="login-page__error" role="alert" style={{ marginTop: 16 }}>
              ❌ Your last manual payment for {myManualPayment.counties.join(', ')} was not approved
              {myManualPayment.rejection_reason ? `: ${myManualPayment.rejection_reason}` : '.'}
            </p>
          )}

          {showManualPay && !manualAwaitingCounties && (
            <form onSubmit={handleManualSubmit} style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 16 }}>
              <h3>Pay manually to RentaPay's Paybill</h3>
              <PaymentDetailsCard amount={totalCost} note="Fill in the details below exactly as shown on your M-Pesa confirmation SMS." />
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
