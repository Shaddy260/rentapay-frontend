import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import AccountMenu from '../components/AccountMenu.jsx';
import HelpButton from '../components/HelpButton.jsx';
import ManualPaymentHelp from '../components/ManualPaymentHelp.jsx';
import ChatWidget from '../components/ChatWidget.jsx';
import Countdown from '../components/Countdown.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import UnitInfoCard from '../components/UnitInfoCard.jsx';
import UtilityBillsSection from '../components/UtilityBillsSection.jsx';
import PropertyRulesCard from '../components/PropertyRulesCard.jsx';
import Skeleton from '../components/Skeleton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import StatisticsPanel from '../components/StatisticsPanel.jsx';
import { downloadCsv } from '../utils/downloadCsv.js';
import { initPushSubscription } from '../utils/push.js';
import { useBadgeAlert } from '../utils/useBadgeAlert.js';
import Faq from '../components/Faq.jsx';
import ComplaintsPanel from '../components/ComplaintsPanel.jsx';
import CommunityPanel from '../components/CommunityPanel.jsx';
import DocumentsPanel from '../components/DocumentsPanel.jsx';
import MaintenancePanel from '../components/MaintenancePanel.jsx';
import MyReputationPanel from '../components/MyReputationPanel.jsx';
import DisputeChargeButton from '../components/DisputeChargeButton.jsx';
import PaymentPlanRequest from '../components/PaymentPlanRequest.jsx';
import RateLandlordWidget from '../components/RateLandlordWidget.jsx';
import RatePropertyWidget from '../components/RatePropertyWidget.jsx';
import AnnouncementBell from '../components/AnnouncementBell.jsx';
import SupportChatWidget from '../components/SupportChatWidget.jsx';
import { useSharedPoll } from '../utils/sharedPoll.js';
import PaymentMethodBadge from '../components/PaymentMethodBadge.jsx';
import VirtualAssistant, { buildTenantAssistantSteps } from '../components/VirtualAssistant.jsx';
import { prefetchTenantPortal } from '../utils/prefetchPortal.js';
import TopRefreshBar from '../components/TopRefreshBar.jsx';
import PullToRefresh from '../components/PullToRefresh.jsx';
import '../components/Countdown.css';
import { api, ApiError } from '../api/client.js';
import './TenantPortal.css';

/**
 * Blueprint section 12: Tenant Portal. Covers every row in the
 * blueprint's feature table: rent breakdown, outstanding balance, due
 * date countdown, manual Paybill/Till/phone payment + code submission,
 * payment history, receipt download, vacating notice (submit +
 * cancel), profile view, help.
 */
// Shared pending/rejected/normal payment-action block, used in both
// the normal balance card and the "paid ahead" card so the two never
// drift into different behavior. `myConfirmation` is the tenant's own
// most recent submission (or null) from GET /payments/my-latest-confirmation.
export function PaymentStatusAction({ myConfirmation, payLabel, onPay, onCheck, landlordContact }) {
  // FIX (direct request: "the make payment UI should still be shown
  // all time... right now when a tenant submits a duplicate
  // transaction id there is no way that confirmation window go away,
  // it remains there and the tenant cannot submit another payment"):
  // a duplicate transaction code still gets inserted as a normal
  // 'pending' confirmation (see submitPaybillTransaction - it's
  // flagged for the landlord to review, not auto-rejected), so this
  // component used to swap the Pay button out entirely and strand the
  // tenant on a "waiting for approval" card with no way to act. The
  // Pay button now always renders; the pending/rejected card (if any)
  // shows underneath it instead of replacing it.
  return (
    <div className="pay-actions-wrap">
      <div className="pay-actions">
        <Button variant="mpesa" onClick={onPay}>{payLabel}</Button>
      </div>

      {myConfirmation?.status === 'pending' && (
        <div className="stk-pending paybill-pending">
          <p>⏳ Submitted, waiting for approval.</p>
          <div className="paybill-pending__details">
            <div><span>Transaction code</span><span>{myConfirmation.transaction_code}</span></div>
            <div><span>Amount</span><span>KES {Number(myConfirmation.amount_paid).toLocaleString()}</span></div>
            <div><span>Paid by</span><span>{myConfirmation.mpesa_payer_name}</span></div>
            <div><span>Submitted</span><span>{new Date(myConfirmation.submitted_at).toLocaleString('en-GB')}</span></div>
          </div>
          <button onClick={onCheck}>Check for confirmation</button>
          {/* Tenant payments are verified by the landlord/manager for this
              unit, not an automated system - so set that expectation and
              let a waiting tenant reach that specific person directly. */}
          <ManualPaymentHelp variant="tenant" landlordContact={landlordContact} />
        </div>
      )}

      {myConfirmation?.status === 'rejected' && (
        // "A tenant should receive a banner telling them the payment
        // was rejected, with a way to resubmit right there in the
        // same banner." Red/urgent styling, distinct from the neutral
        // pending banner above. The main Pay button above already
        // covers resubmission too now, so this is a secondary
        // shortcut, not the only way to act.
        <div className="paybill-rejected-banner">
          <p>❌ Your last payment submission was not approved.</p>
          {myConfirmation.rejection_reason && <p className="paybill-rejected-banner__reason">Reason: {myConfirmation.rejection_reason}</p>}
          <Button variant="mpesa" onClick={onPay}>Resubmit payment</Button>
        </div>
      )}
    </div>
  );
}

export default function TenantPortal() {
  const navigate = useNavigate();
  const token = localStorage.getItem('rentapay_token');
  const [messagesBadge, setMessagesBadge] = useState(0);

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

  // PERFORMANCE FIX: see src/utils/prefetchPortal.js - warms up the
  // Messages chunk right after the tenant portal mounts, so tapping
  // Messages resolves instantly instead of hitting App.jsx's
  // full-screen Suspense fallback (which is what made the bottom nav
  // visibly disappear/reappear on that tap).
  useEffect(() => {
    prefetchTenantPortal();
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    loadMessagesBadge();
    window.addEventListener('rentapay:pending-payments-changed', loadMessagesBadge);
    return () => window.removeEventListener('rentapay:pending-payments-changed', loadMessagesBadge);
  }, [token, loadMessagesBadge]);

  useSharedPoll(loadMessagesBadge, 20000);
  useBadgeAlert(messagesBadge, 'You have a new message.');

  const [communityBadge, setCommunityBadge] = useState(0);

  const loadCommunityBadge = useCallback(() => {
    if (!token) return;
    api
      .getCommunityUnreadCount(token)
      .then((res) => setCommunityBadge(res.unreadCount || 0))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    loadCommunityBadge();
    window.addEventListener('rentapay:community-read', loadCommunityBadge);
    return () => window.removeEventListener('rentapay:community-read', loadCommunityBadge);
  }, [token, loadCommunityBadge]);

  useSharedPoll(loadCommunityBadge, 20000);
  useBadgeAlert(communityBadge, 'New activity on your community board.');


  // FIX (direct request: "when i refresh any page... it should have
  // contents already while it loads in the background"). Same
  // approach as Dashboard.jsx: mirror the last-loaded data into
  // sessionStorage and seed state from it synchronously, so a hard
  // refresh (or a fresh mount from route navigation) has real content
  // on screen immediately instead of a blank "Loading…" gate.
  const tenantCache = (() => {
    try {
      const raw = localStorage.getItem('rentapay_tenant_portal_cache');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const [breakdown, setBreakdown] = useState(() => tenantCache?.breakdown || null);
  const [prepayment, setPrepayment] = useState(() => tenantCache?.prepayment || null);
  const [paymentInstructions, setPaymentInstructions] = useState(() => tenantCache?.paymentInstructions || null);
  const [profile, setProfile] = useState(() => tenantCache?.profile || null);
  const [payments, setPayments] = useState(() => tenantCache?.payments || []);
  const [disputedPaymentIds, setDisputedPaymentIds] = useState(new Set());
  const [loading, setLoading] = useState(() => !tenantCache?.profile);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);
  const [receiptError, setReceiptError] = useState('');
  const [downloadingHistoryPdf, setDownloadingHistoryPdf] = useState(false);
  const [historyPdfError, setHistoryPdfError] = useState('');
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState({ secondaryPhone: '', email: '', emergencyContactName: '', emergencyContactPhone: '' });
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [showPaybillModal, setShowPaybillModal] = useState(false);
  // Automatic Rent Collection (landlord-owned STK push) - Phase 2:
  // shown instead of PaybillModal when paymentInstructions.ownStkActive
  // is true. handlePayTap() below picks between the two; falling back
  // to the manual PaybillModal is always available if the STK flow
  // errors out for any reason.
  const [showStkModal, setShowStkModal] = useState(false);
  // FIX ("tenant still shows 'awaiting confirmation' even after the
  // landlord rejected it"): this used to be inferred client-side from
  // sessionStorage + watching for a matching row in payment history,
  // which only ever changes on CONFIRM - a REJECT was invisible. Now
  // sourced directly from GET /payments/my-latest-confirmation on
  // every load(), so pending/confirmed/rejected are all reflected
  // accurately and a rejection shows its own banner immediately.
  const [myConfirmation, setMyConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);

  // Sidebar nav (Dashboard / Statistics / Financials / Complaints),
  // styled after the reference university-portal layout the user
  // shared. Payment history and Your details, which used to live
  // behind a small 2-item dropdown, are now full tabs.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // FIX (spec item 3): TenantSettings.jsx links back here with
    // ?tab=contact so "Go to contact details" actually lands on the
    // Contact & Notice tab instead of always opening on the dashboard.
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get('tab');
    const validTabs = ['dashboard', 'contact', 'financials', 'statistics', 'reputation', 'documents', 'maintenance', 'community', 'complaints', 'faq'];
    return validTabs.includes(requestedTab) ? requestedTab : 'dashboard';
  }); // dashboard | contact | financials | statistics | complaints
  // Virtual Assistant (spec section 1) - see Dashboard.jsx for the
  // matching landlord/manager/caretaker wiring and fuller comments.
  const [assistantAutoOpen, setAssistantAutoOpen] = useState(false);
  const assistantRef = useRef(null);
  // FEATURE REMOVAL (spec item 13): the "Fix notifications on this
  // device" workaround has been removed entirely - not relocated into
  // Tenant Settings, not kept anywhere else. See Settings.jsx for the
  // matching landlord-side removal.

  useEffect(() => {
    if (!token) return;
    api
      .getAssistantStatus(token)
      .then((res) => {
        if (!res.hasSeenAssistant) setAssistantAutoOpen(true);
      })
      .catch(() => {});
  }, [token]);

  function load() {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    Promise.all([
      api.getBalance(token),
      api.getProfile(token),
      api.getPaymentHistory(token),
      api.getMyLatestPaybillConfirmation(token),
      api.listDisputes({ status: 'open' }, token).catch(() => ({ disputes: [] })),
    ])
      .then(([balanceRes, profileRes, historyRes, confirmationRes, disputesRes]) => {
        setBreakdown(balanceRes.breakdown);
        setPrepayment(balanceRes.prepayment);
        setPaymentInstructions(balanceRes.paymentInstructions || null);
        setProfile(profileRes.profile);
        setPayments(historyRes.payments || []);
        setDisputedPaymentIds(new Set((disputesRes.disputes || []).map((d) => d.payment_id)));
        // Drives the pending/rejected banners below - a 'confirmed'
        // record (or none at all) means there's nothing to show and
        // the normal "Pay Rent" button appears instead.
        setMyConfirmation(confirmationRes.confirmation || null);
        try {
          localStorage.setItem('rentapay_tenant_portal_cache', JSON.stringify({
            breakdown: balanceRes.breakdown,
            prepayment: balanceRes.prepayment,
            paymentInstructions: balanceRes.paymentInstructions || null,
            profile: profileRes.profile,
            payments: historyRes.payments || [],
          }));
        } catch {
          // non-fatal
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem('rentapay_token');
      localStorage.removeItem('rentapay_refresh_token');
          localStorage.removeItem('rentapay_role');
          if (err.accountRevoked) {
            localStorage.setItem('rentapay_logout_message', err.message);
          }
          navigate('/login');
          return;
        }
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DIRECT REQUEST: "give tenants the ability to edit their own
  // details rather than contact your landlord thing" - lets the
  // tenant fix their own secondary phone, email, and emergency
  // contact directly, instead of only being told to contact their
  // landlord. Name, ID number, and move-in date stay landlord-managed
  // (see editOwnProfile's comment on the backend for why).
  function startEditingDetails() {
    setDetailsDraft({
      secondaryPhone: profile?.secondary_phone || '',
      email: profile?.email || '',
      emergencyContactName: profile?.emergency_contact_name || '',
      emergencyContactPhone: profile?.emergency_contact_phone || '',
    });
    setDetailsError('');
    setEditingDetails(true);
  }

  async function saveDetails() {
    setSavingDetails(true);
    setDetailsError('');
    try {
      // FIX: email is shown here disabled/locked - display only - but
      // detailsDraft still carries whatever value was loaded into it.
      // Sending that key at all (even unchanged) trips the server's
      // "primary email can't be changed after registration" guard
      // (see editOwnProfile), which was rejecting every save of this
      // form - including just a secondary phone or emergency contact
      // update - with an error about email that had nothing to do
      // with what was actually being edited.
      const { email, ...editablePayload } = detailsDraft;
      await api.updateOwnProfile(editablePayload, token);
      setEditingDetails(false);
      load(); // refresh `profile` with the saved values
    } catch (err) {
      setDetailsError(err.message);
    } finally {
      setSavingDetails(false);
    }
  }

  // "Live push" - see Dashboard.jsx's identical effect for the
  // landlord/manager side. Same safe no-op behavior here.
  useEffect(() => {
    initPushSubscription(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // FIX (same issue as landlord Dashboard.jsx - "loading for 6+
  // seconds every time you go back"): only blank the screen on the
  // genuine first load (profile === null); a re-fetch after that
  // updates in place with no full-screen loading state.
  if (loading && !profile) {
    return (
      <div className="tenant-portal tenant-portal--loading">
        <Skeleton variant="card" count={2} />
        <Skeleton rows={4} />
      </div>
    );
  }

  if (error && !breakdown) {
    return (
      <div className="tenant-portal tenant-portal--loading">
        <p>{error}</p>
        <Button variant="ghost" onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  const unit = profile?.units;
  const dueDate = breakdown?.dueDate ? new Date(breakdown.dueDate) : null;
  // FIX (direct request: "once a tenant has paid, the dashboard banner
  // itself should also have the receipt UI, not just the payment
  // history menu"): payments is already ordered newest-first (see
  // getPaymentHistory), so the first 'completed' row is the tenant's
  // most recent successful payment - the one the banner should offer
  // a receipt for.
  const latestCompletedPayment = payments.find((p) => p.status === 'completed') || null;

  async function handleDownloadReceipt(paymentId) {
    setDownloadingReceiptId(paymentId);
    setReceiptError('');
    try {
      await api.downloadReceiptPdf(paymentId, token);
    } catch (err) {
      setReceiptError(err instanceof ApiError ? err.message : 'Failed to generate receipt.');
    } finally {
      setDownloadingReceiptId(null);
    }
  }

  // Automatic Rent Collection (landlord-owned STK push) - Phase 2:
  // "Pay Rent" branches to a real STK prompt when this landlord has
  // own_stk active (see attachOwnStkStatus on the backend), otherwise
  // falls back to the existing manual Paybill/Till flow unchanged.
  function handlePayTap() {
    if (paymentInstructions?.ownStkActive) {
      setShowStkModal(true);
    } else {
      setShowPaybillModal(true);
    }
  }

  // Whichever of the two (landlord/manager) is applicable for this
  // tenant's apartment - reused by both the header Help button and
  // the "awaiting verification" card's unit-specific Help reveal.
  const landlordContact = profile?.landlords
    ? {
        name: profile.landlords.full_name,
        phone: profile.landlords.phone,
        managerName: unit?.properties?.contact_manager?.full_name || unit?.properties?.caretaker_name,
        managerPhone: unit?.properties?.contact_manager?.phone || unit?.properties?.caretaker_phone,
      }
    : null;

  const assistantSteps = buildTenantAssistantSteps();

  return (
    <PullToRefresh className="tenant-portal" onRefresh={load}>
      <TopRefreshBar active={loading} />
      <VirtualAssistant
        ref={assistantRef}
        steps={assistantSteps}
        autoOpen={assistantAutoOpen}
        onAutoOpenHandled={() => {
          setAssistantAutoOpen(false);
          api.markAssistantSeen(token).catch(() => {});
        }}
        onRequestSidebarOpen={() => setSidebarOpen(true)}
        onRequestSidebarClose={() => setSidebarOpen(false)}
      />
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeTab}
        notificationCount={communityBadge + messagesBadge}
        items={[
          {
            group: 'Overview',
            items: [
              { key: 'dashboard', label: 'Dashboard', icon: '🏠', onClick: () => setActiveTab('dashboard') },
              { key: 'contact', label: 'Contact & Notice', icon: '📇', onClick: () => setActiveTab('contact') },
            ],
          },
          {
            // Naming consistency (spec): landlord "Financial Statistics"
            // / "Payment History" vs tenant "Statistics" / "Financials"
            // were the same two concepts under different labels -
            // unified to the landlord-side terms here (keys unchanged
            // so no routing/behavior changes, labels only).
            group: 'Finances',
            items: [
              { key: 'statistics', label: 'Financial Statistics', icon: '📊', onClick: () => setActiveTab('statistics') },
              { key: 'financials', label: 'Payment History', icon: '🏦', onClick: () => setActiveTab('financials') },
            ],
          },
          {
            group: 'Operations',
            items: [
              { key: 'maintenance', label: 'Maintenance', icon: '🔧', onClick: () => setActiveTab('maintenance') },
              { key: 'community', label: 'Community Board', icon: '🏘️', badge: communityBadge, onClick: () => setActiveTab('community') },
              { key: 'messages', label: 'Messages', icon: '💬', badge: messagesBadge, onClick: () => navigate('/messages') },
            ],
          },
          {
            group: 'Account',
            items: [
              { key: 'reputation', label: 'My Reputation', icon: '⭐', onClick: () => setActiveTab('reputation') },
              { key: 'documents', label: 'Documents', icon: '📄', onClick: () => setActiveTab('documents') },
              { key: 'faq', label: 'FAQs', icon: '❓', onClick: () => setActiveTab('faq') },
              // Naming consistency (spec): same ComplaintsPanel /
              // "Help + Complaints + FAQs" split as the landlord
              // sidebar - label unified to match.
              { key: 'complaints', label: 'Help / Complaints', icon: '⚠️', onClick: () => setActiveTab('complaints') },
              { key: 'virtual-assistant', label: 'Virtual Assistant', icon: '✦', onClick: () => assistantRef.current?.open() },
              // FEATURE (spec item 3): dedicated Tenant Settings page,
              // same pattern as the landlord dashboard's own Settings
              // nav entry (Dashboard.jsx) - a real route, not a tab,
              // since Settings covers account-level stuff that lives
              // outside the tabbed portal content.
              { key: 'settings', label: 'Settings', icon: '⚙️', onClick: () => navigate('/tenant-settings') },
            ],
          },
        ]}
      />

      <BottomNav
        activeKey={activeTab}
        items={[
          { key: 'dashboard', label: 'Home', icon: '🏠', onClick: () => setActiveTab('dashboard') },
          { key: 'financials', label: 'Payments', icon: '🏦', onClick: () => setActiveTab('financials') },
          { key: 'settings', label: 'Settings', icon: '⚙️', onClick: () => navigate('/tenant-settings') },
          { key: 'messages', label: 'Messages', icon: '💬', onClick: () => navigate('/messages') },
        ]}
      />

      <header className="tenant-portal-header portal-topbar">
        <div className="portal-topbar__left">
          <button type="button" className="portal-topbar__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="portal-topbar__brand-block">
            <div className="portal-topbar__brand"><img className="portal-topbar__brand-logo" src="/logo.png" alt="RentaPay" /> RentaPay</div>
            <div className="portal-topbar__role-label">Tenant</div>
          </div>
        </div>
        <div className="portal-topbar__right">
          {profile && (
            <>
              {/* Bell right next to the avatar/name, both pinned to the
                  extreme top-right. Photo update/removal now lives
                  inside the account menu dropdown, so there's a single
                  avatar control here instead of two overlapping ones.
                  This is the single canonical (gold) notification bell -
                  it already merges announcements + per-account
                  notifications into one feed, so a second bell here was
                  a pure duplicate and has been removed for good. */}
              <AnnouncementBell token={token} role="tenant" />
              <AccountMenu
                name={profile.full_name}
                photoUrl={profile.photo_url}
                role="tenant"
                phone={profile.primary_phone}
                token={token}
                onPhotoChange={(newUrl) => setProfile((p) => ({ ...p, photo_url: newUrl }))}
              />
              <HelpButton
                role="tenant"
                token={token}
                landlordContact={landlordContact}
              />
              {/* Full-inbox "Messages" nav item now routes to /messages
                  (Messages.jsx) instead of opening this popup. */}

            </>
          )}
        </div>
      </header>

      <main className="tenant-portal-main">
        {notice && <div className="tenant-portal-banner tenant-portal-banner--ok">{notice}</div>}
        {error && <div className="tenant-portal-banner tenant-portal-banner--error">{error}</div>}

        <section className="tenant-welcome">
          <h1>Hi, {profile?.full_name?.split(' ')[0]}</h1>
          <p className="tenant-welcome__unit">Unit {unit?.unit_name} · {unit?.unit_payment_code}</p>
          <PaymentMethodBadge paymentMethod={paymentInstructions} shape="rectangle" />
        </section>

        {activeTab === 'dashboard' && (
          <>
            <PropertyRulesCard rulesText={unit?.properties?.rules_text} />

            {prepayment?.isAhead ? (
              <section className="balance-card balance-card--ahead">
                <span className="balance-card__label">You've paid ahead</span>
                <span className="balance-card__amount">KES {prepayment.creditAmount?.toLocaleString()}</span>
                <span className="balance-card__due">
                  You've covered the next {prepayment.monthsCovered} month{prepayment.monthsCovered === 1 ? '' : 's'}. Your next payment is KES{' '}
                  {prepayment.nextPaymentAmount?.toLocaleString()}, due on{' '}
                  {new Date(prepayment.nextPaymentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </span>

                {/* Even paid ahead, a tenant may want to submit an early
                    payment (e.g. paying next month's rent now) - this
                    used to have no payment UI at all once ahead. */}
                <PaymentStatusAction
                  myConfirmation={myConfirmation}
                  payLabel="Make a payment"
                  onPay={handlePayTap}
                  onCheck={() => load()}
                  landlordContact={landlordContact}
                />

                {latestCompletedPayment && (
                  <div className="balance-card__receipt">
                    <span className="balance-card__receipt-info">
                      ✓ Last payment: KES {Number(latestCompletedPayment.amount).toLocaleString()} on{' '}
                      {latestCompletedPayment.paid_at ? new Date(latestCompletedPayment.paid_at).toLocaleDateString('en-GB') : '-'}
                    </span>
                    <button
                      className="receipt-link"
                      disabled={downloadingReceiptId === latestCompletedPayment.id}
                      onClick={() => handleDownloadReceipt(latestCompletedPayment.id)}
                    >
                      {downloadingReceiptId === latestCompletedPayment.id ? 'Preparing…' : 'Download receipt'}
                    </button>
                  </div>
                )}
                {receiptError && <p className="modal-error">{receiptError}</p>}
              </section>
            ) : (
              <section className="balance-card">
                <span className="balance-card__label">Rent balance</span>
                <span className="balance-card__amount">KES {Number(breakdown.totalDue).toLocaleString()}</span>
                <span className="balance-card__due">
                  {dueDate && (breakdown.balance > 0 || new Date() <= dueDate) ? (
                    <>Due in <Countdown target={dueDate} expiredLabel="Overdue" /></>
                  ) : (
                    'No balance due'
                  )}
                </span>

                {/* Manual Paybill/Till payment only - STK push removed
                    from the tenant rent-payment flow per product
                    decision. (The landlord's OWN subscription payment
                    to the platform still uses STK via
                    daraja.service.js - that's untouched and unrelated.) */}
                <PaymentStatusAction
                  myConfirmation={myConfirmation}
                  payLabel="Pay Rent"
                  onPay={handlePayTap}
                  onCheck={() => load()}
                  landlordContact={landlordContact}
                />

                {latestCompletedPayment && (
                  <div className="balance-card__receipt">
                    <span className="balance-card__receipt-info">
                      ✓ Last payment: KES {Number(latestCompletedPayment.amount).toLocaleString()} on{' '}
                      {latestCompletedPayment.paid_at ? new Date(latestCompletedPayment.paid_at).toLocaleDateString('en-GB') : '-'}
                    </span>
                    <button
                      className="receipt-link"
                      disabled={downloadingReceiptId === latestCompletedPayment.id}
                      onClick={() => handleDownloadReceipt(latestCompletedPayment.id)}
                    >
                      {downloadingReceiptId === latestCompletedPayment.id ? 'Preparing…' : 'Download receipt'}
                    </button>
                  </div>
                )}
                {receiptError && <p className="modal-error">{receiptError}</p>}

                <button className="balance-card__breakdown-link" onClick={() => setActiveTab('financials')}>
                  View full breakdown &amp; payment history →
                </button>
              </section>
            )}

            {/* Water/electricity bills - entirely separate from rent
                above. Renders nothing if the landlord hasn't set up
                any utility billing for this unit. */}
            <UtilityBillsSection
              token={token}
              paymentInstructions={paymentInstructions}
              rentOwed={prepayment?.isAhead ? 0 : Number(breakdown?.totalDue || 0)}
              landlordContact={landlordContact}
            />

            <UnitInfoCard unit={unit} profile={profile} dueDate={dueDate} />
          </>
        )}

        {activeTab === 'contact' && (
          <>
            {/* Landlord / caretaker / property manager contact. Whoever is
                set as "the contact" for this property (property.
                primary_contact_manager_id, edited from the landlord's
                Settings) is shown here first with the landlord's own
                number always shown too; the caretaker is a separate,
                no-login contact and always shown when set.
                Moved into its own menu tab (was previously stuck in the
                dashboard body) per direct request. */}
            {profile?.landlords && (
              <section className="tenant-section">
                <h2>Contact</h2>
                <div className="contact-card">
                  <div className="contact-card__row">
                    <span className="contact-card__label">Landlord</span>
                    <span className="contact-card__name">{profile.landlords.full_name}</span>
                    <a className="contact-card__phone" href={`tel:${profile.landlords.phone}`}>{profile.landlords.phone}</a>
                  </div>
                  {unit?.properties?.contact_manager && (
                    <div className="contact-card__row">
                      <span className="contact-card__label">Property manager</span>
                      <span className="contact-card__name">{unit.properties.contact_manager.full_name}</span>
                      {unit.properties.contact_manager.phone && (
                        <a className="contact-card__phone" href={`tel:${unit.properties.contact_manager.phone}`}>{unit.properties.contact_manager.phone}</a>
                      )}
                    </div>
                  )}
                  {unit?.properties?.caretaker_name && (
                    <div className="contact-card__row">
                      <span className="contact-card__label">Caretaker</span>
                      <span className="contact-card__name">{unit.properties.caretaker_name}</span>
                      {unit.properties.caretaker_phone && (
                        <a className="contact-card__phone" href={`tel:${unit.properties.caretaker_phone}`}>{unit.properties.caretaker_phone}</a>
                      )}
                    </div>
                  )}
                </div>

                {/* "Text your landlord" - a live chat straight into the
                    landlord's own dashboard, in addition to (not instead
                    of) the tel: links above. */}
                <div className="contact-card__chat">
                  <ChatWidget
                    token={token}
                    role="tenant"
                    label="Text your landlord"
                    directThread={{ threadType: 'landlord_tenant', name: profile.landlords.full_name || 'Your Landlord' }}
                  />
                </div>
              </section>
            )}

            {/* Vacating notice - blueprint 12 rows 8-9, blueprint section 8 */}
            <section className="tenant-section">
              <h2>Vacating notice</h2>
              {profile?.notice_given ? (
                <div className="notice-status">
                  <p>You've given notice to vacate on <strong>{profile.notice_date}</strong>.</p>
                  <Button
                    variant="ghost"
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.cancelVacatingNotice(token);
                        setNotice('Vacating notice cancelled.');
                        load();
                      } catch (err) {
                        setError(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    This was a mistake - Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setShowNoticeModal(true)}>Give Vacating Notice</Button>
              )}
            </section>
          </>
        )}

        {activeTab === 'financials' && (
          <>
            <section className="tenant-section">
              <h2>Financial breakdown</h2>
              {prepayment?.isAhead ? (
                <p className="tenant-portal-hint">
                  You've covered the next {prepayment.monthsCovered} month{prepayment.monthsCovered === 1 ? '' : 's'} (KES{' '}
                  {prepayment.creditAmount?.toLocaleString()} credit). Your next payment is KES {prepayment.nextPaymentAmount?.toLocaleString()}, due on{' '}
                  {new Date(prepayment.nextPaymentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
              ) : (
                <div className="rent-breakdown">
                  <div className="rent-breakdown__row"><span>Monthly rent</span><span>KES {Number(breakdown.rentAmount).toLocaleString()}</span></div>
                  {breakdown.extraCharges?.map((c, i) => (
                    <div className="rent-breakdown__row" key={i}><span>{c.name}</span><span>KES {Number(c.amount).toLocaleString()}</span></div>
                  ))}
                  {breakdown.carriedArrears > 0 && (
                    <div className="rent-breakdown__row"><span>Carried arrears</span><span>KES {Number(breakdown.carriedArrears).toLocaleString()}</span></div>
                  )}
                  {/* Late payment penalty - opt-in per landlord (Settings ->
                      Finances). Always its own labeled line, never folded
                      into another figure, per the build spec. If a
                      landlord/manager has waived or adjusted it, that's
                      shown instead of (or alongside) the raw number so the
                      tenant understands why it differs from the formula. */}
                  {breakdown.lateFeeOverride?.type === 'waive' ? (
                    <div className="rent-breakdown__row rent-breakdown__row--waived">
                      <span>Late payment penalty</span>
                      <span>Waived</span>
                    </div>
                  ) : Number(breakdown.lateFee) > 0 ? (
                    <div className="rent-breakdown__row">
                      <span>
                        Late payment penalty
                        {breakdown.lateFeeOverride && <InfoTip text={`Adjusted by your landlord/manager: ${breakdown.lateFeeOverride.reason || 'no reason given'}`} />}
                      </span>
                      <span>KES {Number(breakdown.lateFee).toLocaleString()}</span>
                    </div>
                  ) : null}
                  <div className="rent-breakdown__row rent-breakdown__row--total"><span>Total due</span><span>KES {Number(breakdown.totalDue).toLocaleString()}</span></div>
                  {breakdown.lateFeeOverride?.type === 'waive' && breakdown.lateFeeOverride.reason && (
                    <p className="tenant-portal-hint tenant-portal-hint--muted">
                      Late payment penalty waived by your {breakdown.lateFeeOverride.appliedBy === 'manager' ? 'property manager' : 'landlord'}: "{breakdown.lateFeeOverride.reason}"
                    </p>
                  )}
                </div>
              )}

              {/* Direct request: "that deposit should be read only to
                  the tenants and should not count as rent" - shown as
                  its own separate card, never mixed into the rent
                  breakdown above, and with no way for a tenant to
                  edit it from here. */}
              {profile?.deposit_amount ? (
                <div className="rent-breakdown u-mt-4">
                  <div className="rent-breakdown__row">
                    <span>Security deposit {profile.deposit_paid_at ? `(paid ${new Date(profile.deposit_paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })})` : ''}</span>
                    <span>KES {Number(profile.deposit_amount).toLocaleString()}</span>
                  </div>
                  <p className="tenant-portal-hint">
                    {profile.deposit_status === 'held' && "Held by your landlord. This is not rent and is not counted toward your balance - it's refundable when you vacate, less any damages."}
                    {profile.deposit_status === 'refunded' && `Fully refunded${profile.deposit_settled_at ? ` on ${new Date(profile.deposit_settled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.`}
                    {profile.deposit_status === 'partially_refunded' && `KES ${Number(profile.deposit_refunded_amount || 0).toLocaleString()} refunded${profile.deposit_deduction_reason ? ` - remainder withheld for: ${profile.deposit_deduction_reason}` : ''}.`}
                    {profile.deposit_status === 'forfeited' && `Withheld${profile.deposit_deduction_reason ? ` - reason: ${profile.deposit_deduction_reason}` : ''}.`}
                  </p>
                </div>
              ) : null}

              {/* BUG FIX (direct request: "there is a misleading text...
                  rentapay does not send stk pushes to tenants to pay
                  rent... tenants pay rent manually and only submit
                  the code"): this text used to say "Pay via M-Pesa
                  STK push straight from the Dashboard tab" for every
                  payment method - stale copy left over from before
                  STK was removed from the tenant rent-payment flow
                  (see the comment above PaymentStatusAction). Nothing
                  here ever sends a tenant an STK prompt; rewritten to
                  match what PaybillModal actually asks for - send the
                  money yourself, then submit the M-Pesa code. */}
              <p className="tenant-portal-hint">
                {paymentInstructions?.method === 'paybill'
                  ? <>Pay via Paybill <strong>{paymentInstructions.paybillNumber}</strong>, Account Number <strong>{paymentInstructions.accountNumber}</strong>, then submit your M-Pesa code below.</>
                  : paymentInstructions?.method === 'till'
                  ? <>Pay via Buy Goods Till Number <strong>{paymentInstructions.tillNumber}</strong>, then submit your M-Pesa code below.</>
                  : paymentInstructions?.method === 'stk' && paymentInstructions.stkPhoneNumber
                  ? <>Send payment via M-Pesa (Send Money) to <strong>{paymentInstructions.stkPhoneNumber}</strong>, then submit your M-Pesa code below.</>
                  : <>Pay via M-Pesa using the details below, then submit your M-Pesa code below.</>}
              </p>
              {paymentInstructions?.description && (
                <p className="tenant-portal-hint">{paymentInstructions.description}</p>
              )}

              <PaymentPlanRequest token={token} totalDue={breakdown?.totalDue} />
            </section>

            <section className="tenant-section">
              <div className="tenant-section__header-row">
                <h2>Payment history</h2>
                {payments.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                      className="ghost-link"
                      onClick={() =>
                        downloadCsv(
                          'rentapay-payment-history',
                          ['Date', 'Amount (KES)', 'Method', 'Status'],
                          payments.map((p) => [
                            p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '-',
                            p.amount,
                            p.payment_method.replace('_', ' '),
                            p.status,
                          ])
                        )
                      }
                    >
                      Download CSV
                    </button>
                    <button
                      className="ghost-link"
                      disabled={downloadingHistoryPdf}
                      onClick={async () => {
                        setDownloadingHistoryPdf(true);
                        setHistoryPdfError('');
                        try {
                          await api.downloadPaymentHistoryPdf(token);
                        } catch (err) {
                          setHistoryPdfError(err instanceof ApiError ? err.message : 'Failed to generate PDF.');
                        } finally {
                          setDownloadingHistoryPdf(false);
                        }
                      }}
                    >
                      {downloadingHistoryPdf ? 'Preparing PDF…' : 'Download PDF'}
                    </button>
                  </div>
                )}
              </div>
              {historyPdfError && <p className="modal-error">{historyPdfError}</p>}
              {receiptError && <p className="modal-error">{receiptError}</p>}
              {payments.length === 0 ? (
                <p className="tenant-portal-hint">No payments yet.</p>
              ) : (
                <div className="payments-table-wrap">
                  <table className="payments-table">
                    <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th><th></th><th></th></tr></thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '-'}</td>
                          <td>KES {Number(p.amount).toLocaleString()}</td>
                          <td>{p.payment_method.replace('_', ' ')}</td>
                          <td><span className={`payment-status payment-status--${p.status}`}>{p.status}</span></td>
                          <td>
                            {p.status === 'completed' && (
                              <button className="receipt-link" disabled={downloadingReceiptId === p.id} onClick={() => handleDownloadReceipt(p.id)}>
                                {downloadingReceiptId === p.id ? 'Preparing…' : 'Receipt'}
                              </button>
                            )}
                          </td>
                          <td>
                            <DisputeChargeButton
                              token={token}
                              role="tenant"
                              paymentId={p.id}
                              initiallyDisputed={disputedPaymentIds.has(p.id)}
                              threadName={profile.landlords?.full_name || 'Your Landlord'}
                              landlordId={profile.landlords?.id}
                              tenantId={profile.id}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="tenant-section">
              <div className="tenant-section__header-row">
                <h2>Your details</h2>
                {!editingDetails && (
                  <button className="ghost-link" onClick={startEditingDetails}>Edit</button>
                )}
              </div>

              {!editingDetails ? (
                <div className="profile-grid">
                  <div><span className="profile-grid__label">Phone</span><span>{profile?.primary_phone}</span></div>
                  <div><span className="profile-grid__label">Secondary phone</span><span>{profile?.secondary_phone || '-'}</span></div>
                  <div><span className="profile-grid__label">Email</span><span>{profile?.email || '-'}</span></div>
                  <div><span className="profile-grid__label">Emergency contact</span><span>{profile?.emergency_contact_name} ({profile?.emergency_contact_phone})</span></div>
                </div>
              ) : (
                <div className="profile-edit-form">
                  {detailsError && <p className="modal-error">{detailsError}</p>}
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="secondaryPhone">Secondary phone</label>
                    <input
                      id="secondaryPhone"
                      value={detailsDraft.secondaryPhone}
                      onChange={(e) => setDetailsDraft((d) => ({ ...d, secondaryPhone: e.target.value }))}
                      placeholder="07XXXXXXXX or 2547XXXXXXXX"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="email"
                      value={detailsDraft.email}
                      disabled
                      title="Your email is permanently locked after registration - not even your landlord, manager, or caretaker can change it."
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="emergencyContactName">Emergency contact name</label>
                    <input
                      id="emergencyContactName"
                      value={detailsDraft.emergencyContactName}
                      onChange={(e) => setDetailsDraft((d) => ({ ...d, emergencyContactName: e.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="emergencyContactPhone">Emergency contact phone</label>
                    <input
                      id="emergencyContactPhone"
                      value={detailsDraft.emergencyContactPhone}
                      onChange={(e) => setDetailsDraft((d) => ({ ...d, emergencyContactPhone: e.target.value }))}
                      placeholder="07XXXXXXXX or 2547XXXXXXXX"
                    />
                  </div>
                  <div className="register-page__actions">
                    <Button type="button" variant="ghost" onClick={() => setEditingDetails(false)} disabled={savingDetails}>Cancel</Button>
                    <Button type="button" variant="primary" loading={savingDetails} onClick={saveDetails}>Save</Button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'statistics' && <StatisticsPanel payments={payments} />}

        {activeTab === 'reputation' && (
          <>
            <MyReputationPanel token={token} tenantId={profile?.id} />
            <RateLandlordWidget token={token} />
            <RatePropertyWidget token={token} />
          </>
        )}

        {activeTab === 'documents' && <DocumentsPanel token={token} canManage={false} isTenant />}

        {activeTab === 'maintenance' && <MaintenancePanel token={token} />}

        {activeTab === 'community' && <CommunityPanel token={token} />}

        {activeTab === 'complaints' && (
          <ComplaintsPanel token={token} name={profile?.full_name} defaultPhone={profile?.primary_phone} />
        )}

        {activeTab === 'faq' && <Faq audience="tenant" />}
      </main>

      {showNoticeModal && (
        <VacatingNoticeModal
          token={token}
          onClose={() => setShowNoticeModal(false)}
          onDone={() => { setShowNoticeModal(false); setNotice('Vacating notice submitted.'); load(); }}
        />
      )}
      {showPaybillModal && (
        <PaybillModal
          paymentInstructions={paymentInstructions}
          amountDue={prepayment?.isAhead ? prepayment.nextPaymentAmount : breakdown?.totalDue}
          token={token}
          onClose={() => setShowPaybillModal(false)}
          onDone={() => { setShowPaybillModal(false); load(); }}
        />
      )}
      {showStkModal && (
        <StkPaymentModal
          amountDue={prepayment?.isAhead ? prepayment.nextPaymentAmount : breakdown?.totalDue}
          defaultPhone={profile?.primary_phone}
          token={token}
          onClose={() => setShowStkModal(false)}
          onDone={() => { setShowStkModal(false); load(); }}
          onFallbackToManual={() => { setShowStkModal(false); setShowPaybillModal(true); }}
        />
      )}
      <SupportChatWidget token={token} />
    </PullToRefresh>
  );
}

function VacatingNoticeModal({ token, onClose, onDone }) {
  const [step, setStep] = useState(1); // 2-step confirmation per blueprint 8
  const [vacatingDate, setVacatingDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await api.submitVacatingNotice({ vacatingDate, reason }, token);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>Give vacating notice</h3>
          <button className="modal-card__close" onClick={onClose}>×</button>
        </div>

        {step === 1 ? (
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!vacatingDate) return;
              setStep(2);
            }}
          >
            <label className="form-field__label">Intended vacating date</label>
            <input
              type="date"
              required
              min={new Date().toISOString().slice(0, 10)}
              value={vacatingDate}
              onChange={(e) => setVacatingDate(e.target.value)}
            />
            <label className="form-field__label">Reason (optional)</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <Button type="submit" variant="primary">Continue</Button>
          </form>
        ) : (
          <div className="modal-form">
            {error && <p className="modal-error">{error}</p>}
            <p>You're about to give notice to vacate on <strong>{vacatingDate}</strong>. Your landlord will be notified immediately.</p>
            <Button variant="ghost" onClick={() => setStep(1)}>This was a mistake - Cancel</Button>
            <Button variant="primary" loading={busy} onClick={confirm}>Confirm notice</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function StkPaymentModal({ amountDue, defaultPhone, token, onClose, onDone, onFallbackToManual }) {
  const [phase, setPhase] = useState('form'); // 'form' | 'pending' | 'failed'
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone || '');
  const [amount, setAmount] = useState(amountDue != null ? String(amountDue) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => clearTimeout(pollRef.current), []);

  async function poll(id) {
    try {
      const res = await api.checkTenantStkStatus(id, token);
      if (res.status === 'completed') {
        onDone();
        return;
      }
      if (res.status === 'failed') {
        setError(res.reason ? `Payment failed: ${res.reason}` : 'The payment did not go through.');
        setPhase('failed');
        return;
      }
      // Still pending - keep polling, same self-heal pattern already
      // used for the subscription STK flow.
      pollRef.current = setTimeout(() => poll(id), 3000);
    } catch {
      pollRef.current = setTimeout(() => poll(id), 4000);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.tenantStkPush({ phoneNumber: phoneNumber.trim(), amount: Number(amount) }, token);
      setPaymentId(res.paymentId);
      setPhase('pending');
      poll(res.paymentId);
    } catch (err) {
      if (err?.data?.fallbackToManual || err instanceof ApiError) {
        setError(err.message || 'Could not start the M-Pesa payment.');
      } else {
        setError('Could not start the M-Pesa payment.');
      }
      setPhase('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={phase === 'pending' ? undefined : onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>Pay Rent</h3>
          {phase !== 'pending' && <button className="modal-card__close" onClick={onClose}>×</button>}
        </div>

        {phase === 'form' && (
          <form className="modal-form" onSubmit={submit}>
            {error && <p className="modal-error">{error}</p>}
            <p className="tenant-portal-hint">You'll get a real M-Pesa prompt on your phone - enter your PIN there to complete payment. No manual review step needed.</p>
            <label className="form-field__label">Phone number to charge</label>
            <input required type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="e.g. 0712345678" />
            <label className="form-field__label">Amount (KES)</label>
            <input required type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button type="submit" variant="mpesa" loading={busy}>Pay</Button>
          </form>
        )}

        {phase === 'pending' && (
          <div className="arc-stk-pending">
            <span className="arc-stk-pending__pulse" aria-hidden="true" />
            <h2>Enter your M-Pesa PIN to complete payment</h2>
            <p>Check your phone for the M-Pesa prompt. This screen updates automatically once payment is confirmed.</p>
          </div>
        )}

        {phase === 'failed' && (
          <div className="modal-form">
            {error && <p className="modal-error">{error}</p>}
            <div className="settings-manager-row__actions">
              <Button variant="primary" onClick={() => setPhase('form')}>Try again</Button>
              <button type="button" className="ghost-link" onClick={onFallbackToManual}>Pay manually instead</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PaybillModal({ paymentInstructions, amountDue, token, onClose, onDone, targetInvoiceId, title }) {
  const [transactionCode, setTransactionCode] = useState('');
  const [amountPaid, setAmountPaid] = useState(amountDue != null ? String(amountDue) : '');
  const [mpesaPayerName, setMpesaPayerName] = useState('');
  const [mpesaPayerPhone, setMpesaPayerPhone] = useState('');
  const [mpesaSmsTimestamp, setMpesaSmsTimestamp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!mpesaSmsTimestamp) {
        setError('M-Pesa SMS time is required - enter the time shown on your payment confirmation SMS.');
        setBusy(false);
        return;
      }
      if (!mpesaPayerPhone.trim()) {
        setError('The phone number you sent the money from is required.');
        setBusy(false);
        return;
      }
      const payload = {
        transactionCode: transactionCode.trim(),
        amountPaid: Number(amountPaid),
        mpesaPayerName: mpesaPayerName.trim(),
        mpesaPayerPhone: mpesaPayerPhone.trim(),
        mpesaSmsTimestamp: new Date(mpesaSmsTimestamp).toISOString(),
        ...(targetInvoiceId ? { targetInvoiceId } : {}),
      };
      const res = await api.submitPaybillTransaction(payload, token);
      if (res.isDuplicate) {
        setError(res.message);
        setBusy(false);
        return;
      }
      onDone({
        transactionCode: payload.transactionCode.toUpperCase(),
        amountPaid: payload.amountPaid,
        mpesaPayerName: payload.mpesaPayerName,
        mpesaPayerPhone: payload.mpesaPayerPhone,
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>{title || 'Pay Rent'}</h3>
          <button className="modal-card__close" onClick={onClose}>×</button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          {error && <p className="modal-error">{error}</p>}
          {/* Direct request: a note the landlord/manager writes once at
              setup, shown right where the tenant taps Pay Rent / Pay
              <utility> - e.g. "Rent due by the 5th, water billed
              separately." Applies to rent and every utility, since both
              flows share this same modal. */}
          {paymentInstructions?.description && (
            <p className="tenant-portal-hint">{paymentInstructions.description}</p>
          )}
          {paymentInstructions?.method === 'paybill' ? (
            <p>Use Paybill <strong>{paymentInstructions.paybillNumber}</strong>, Account Number <strong>{paymentInstructions.accountNumber}</strong>. Once you've paid, fill in the details below exactly as shown on your M-Pesa confirmation SMS.</p>
          ) : paymentInstructions?.method === 'till' ? (
            <p>Use Buy Goods Till Number <strong>{paymentInstructions.tillNumber}</strong>. Once you've paid, fill in the details below exactly as shown on your M-Pesa confirmation SMS.</p>
          ) : paymentInstructions?.method === 'stk' && paymentInstructions.stkPhoneNumber ? (
            <p>Send payment via M-Pesa (Send Money) to <strong>{paymentInstructions.stkPhoneNumber}</strong>. Once you've paid, fill in the details below exactly as shown on your M-Pesa confirmation SMS.</p>
          ) : (
            <p>Fill in the details below exactly as shown on your M-Pesa confirmation SMS.</p>
          )}

          <label className="form-field__label">Transaction code</label>
          <input required value={transactionCode} onChange={(e) => setTransactionCode(e.target.value)} placeholder="e.g. QGH7XYZ123" />

          <label className="form-field__label">Amount paid (KES)</label>
          <input required type="number" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />

          <label className="form-field__label">M-Pesa payer name</label>
          <input required value={mpesaPayerName} onChange={(e) => setMpesaPayerName(e.target.value)} placeholder="Name shown on the M-Pesa SMS" />

          <label className="form-field__label">Phone number you sent the money from</label>
          <input required type="tel" value={mpesaPayerPhone} onChange={(e) => setMpesaPayerPhone(e.target.value)} placeholder="e.g. 0712345678" />

          <label className="form-field__label">M-Pesa SMS time</label>
          <input required type="datetime-local" value={mpesaSmsTimestamp} onChange={(e) => setMpesaSmsTimestamp(e.target.value)} />

          <Button type="submit" variant="primary" loading={busy}>Submit</Button>
        </form>
      </div>
    </div>
  );
}
