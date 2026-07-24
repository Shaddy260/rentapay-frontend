import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Button from '../components/Button.jsx';
import HelpButton from '../components/HelpButton.jsx';
import ChatWidget from '../components/ChatWidget.jsx';
import AccountMenu from '../components/AccountMenu.jsx';
import TenantContactCard from '../components/TenantContactCard.jsx';
import Countdown from '../components/Countdown.jsx';
import PortalSidebar from '../components/PortalSidebar.jsx';
import BottomNav from '../components/BottomNav.jsx';
import GlobalSearch from '../components/GlobalSearch.jsx';
import Skeleton from '../components/Skeleton.jsx';
import OnboardingChecklist from '../components/OnboardingChecklist.jsx';
import { downloadCsv } from '../utils/downloadCsv.js';
import AddPropertyModal from '../components/AddPropertyModal.jsx';
import BulkRentChangeModal from '../components/BulkRentChangeModal.jsx';
import LandlordStatistics from '../components/LandlordStatistics.jsx';
import PaymentHistoryPanel from '../components/PaymentHistoryPanel.jsx';
import Faq from '../components/Faq.jsx';
import AnnouncementBell from '../components/AnnouncementBell.jsx';
import { useSharedPoll } from '../utils/sharedPoll.js';
import PendingPaymentsBell from '../components/PendingPaymentsBell.jsx';
import PaymentMethodBadge from '../components/PaymentMethodBadge.jsx';
import TenantListExport from '../components/TenantListExport.jsx';
import { initPushSubscription } from '../utils/push.js';
import { roleLabel } from '../utils/roleLabel.js';
import BroadcastPanel from '../components/BroadcastPanel.jsx';
import ArchivedTenantsPanel from '../components/ArchivedTenantsPanel.jsx';
import FirstTimeCredentialsPanel from '../components/FirstTimeCredentialsPanel.jsx';
import PendingPaymentConfirmations from '../components/PendingPaymentConfirmations.jsx';
import ComplaintsPanel from '../components/ComplaintsPanel.jsx';
import AttentionFeed from '../components/AttentionFeed.jsx';
import MaintenanceManagePanel from '../components/MaintenanceManagePanel.jsx';
import ExpensesPanel from '../components/ExpensesPanel.jsx';
import DueDatesCalendar from '../components/DueDatesCalendar.jsx';
import '../components/Countdown.css';
import './Dashboard.css';

const STATUS_LABELS = {
  occupied: { label: 'Occupied', dotClass: 'status-dot--occupied' },
  notice_given: { label: 'Notice given', dotClass: 'status-dot--notice' },
  vacant: { label: 'Vacant', dotClass: 'status-dot--vacant' },
  maintenance: { label: 'Maintenance', dotClass: 'status-dot--maintenance' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [units, setUnits] = useState([]);
  const [unitSearch, setUnitSearch] = useState('');

  // FIX (direct request): "start with the ones occupied and with
  // tenants with overdues as you move to those who have paid - this
  // will ease management" - units used to render in whatever order
  // the database happened to return them, so an overdue tenant buried
  // on page 3 was just as easy to miss as one you'd already handled.
  const sortWeight = (unit) => {
    const activeTenant = (unit.tenants || []).find((t) => t.is_active);
    const isOverdue = activeTenant && Number(activeTenant.balance_due) > 0;
    if (isOverdue) return 0; // overdue tenants first, always
    if (activeTenant) return 1; // occupied and paid up, next
    if (unit.status === 'notice_given') return 2;
    return 3; // vacant/maintenance last - nothing urgent to manage there
  };

  const visibleUnits = useMemo(() => {
    if (!units) return [];
    const q = unitSearch.trim().toLowerCase();
    const filtered = q
      ? units.filter((unit) => {
          const tenantNames = (unit.tenants || []).map((t) => t.full_name || '').join(' ');
          return `${unit.unit_name} ${tenantNames}`.toLowerCase().includes(q);
        })
      : units;
    return [...filtered].sort((a, b) => sortWeight(a) - sortWeight(b));
  }, [units, unitSearch]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // FIX (flagged, now addressed): landlords with very large unit
  // counts rendered the ENTIRE list with no pagination - fine for
  // dozens of units, sluggish in the hundreds (every single unit-card
  // link, tenant badge, and conditional render all mounted to the DOM
  // at once). Simple page-size cap instead of pulling in a
  // virtualization library - much lower risk, and dozens-to-low-
  // hundreds is the actual range real landlords are in.
  const UNITS_PAGE_SIZE = 60;
  const [unitsPageSize, setUnitsPageSize] = useState(UNITS_PAGE_SIZE);
  useEffect(() => {
    setUnitsPageSize(UNITS_PAGE_SIZE); // back to page 1 whenever the search changes
  }, [unitSearch]);
  const unitsToRender = useMemo(() => visibleUnits.slice(0, unitsPageSize), [visibleUnits, unitsPageSize]);
  const [bulkRemindStatus, setBulkRemindStatus] = useState('');
  const [drillDown, setDrillDown] = useState(null);
  const [paidPayments, setPaidPayments] = useState(null);
  const [paidLoading, setPaidLoading] = useState(false);
  const [properties, setProperties] = useState([]);
  const [onboardingDismissedAt, setOnboardingDismissedAt] = useState(null);
  const [activePropertyId, setActivePropertyId] = useState(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showBulkRentModal, setShowBulkRentModal] = useState(false);
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'statistics'
  const [showAnnouncementComposer, setShowAnnouncementComposer] = useState(false);
  const token = sessionStorage.getItem('rentapay_token');
  const [messagesBadge, setMessagesBadge] = useState(0);

  // Sidebar "Messages" badge - PendingPaymentsBell in the header already
  // covers payments; this covers unread chat threads the same way, so
  // the sidebar item shows something's waiting without opening it.
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
    if (!token) return undefined;
    loadMessagesBadge();
    window.addEventListener('rentapay:pending-payments-changed', loadMessagesBadge);
    return () => window.removeEventListener('rentapay:pending-payments-changed', loadMessagesBadge);
  }, [token, loadMessagesBadge]);

  // FIX: used to be its own independent setInterval(loadMessagesBadge,
  // 20000) - now rides the shared tick alongside the header bells.
  useSharedPoll(loadMessagesBadge, 20000);

  // A property manager sees this exact same dashboard, scoped to the
  // landlord who added them, with a handful of landlord-only actions
  // hidden (adding/removing managers, buying more properties/
  // subscription changes) - see auth.middleware.js requireLandlordOnly.
  const role = sessionStorage.getItem('rentapay_role');
  const isManager = role === 'manager';
  const roleLevel = sessionStorage.getItem('rentapay_role_level');
  const isCaretaker = isManager && roleLevel === 'caretaker';

  function openDrillDown(kind) {
    setDrillDown(kind);
    if (kind === 'paid' && paidPayments === null) {
      setPaidLoading(true);
      api
        .getPaymentsThisMonth(token, activePropertyId)
        .then((res) => setPaidPayments(res.payments || []))
        .catch((err) => setError(err.message))
        .finally(() => setPaidLoading(false));
    }
  }

  function load(propertyId, { retriedAfterNotAssigned = false } = {}) {
    if (!token) {
      navigate('/login');
      return;
    }
    setLoading(true);
    // FIX (direct request): "when a landlord shifts to another
    // apartment and reloads the page, it brings him back to his first
    // apartment - it should remain there unless he shifts himself."
    // On the very first load of this session (no propertyId argument
    // passed in at all - not even undefined from a manual switch),
    // check for a property the user picked earlier in this browser
    // session before ever falling back to "just pick the first one".
    if (propertyId === undefined) {
      const remembered = sessionStorage.getItem('rentapay_active_property_id');
      if (remembered) propertyId = remembered;
    }
    Promise.all([api.getDashboard(token, propertyId), api.listUnits(token, propertyId)])
      .then(([dashboardData, unitsData]) => {
        setSummary(dashboardData);
        setProperties(dashboardData.properties || []);
        setOnboardingDismissedAt(dashboardData.onboardingDismissedAt || null);
        // FIX ("there should be nothing like All Apartments - only one
        // at a time"): a landlord with more than one property used to
        // land on a merged "all properties" view by default, which is
        // exactly the mixed-up list the landlord doesn't want. If
        // nothing is selected yet and there's at least one property,
        // pick the first one and reload scoped to just that property.
        let resolvedPropertyId = dashboardData.activePropertyId || null;
        // The remembered ID might belong to a property this account no
        // longer has access to (revoked, or it was a different
        // account's session leftover on a shared browser) - only trust
        // it if it's still actually in this account's property list.
        if (!resolvedPropertyId && propertyId && (dashboardData.properties || []).some((p) => p.id === propertyId)) {
          resolvedPropertyId = propertyId;
        }
        if (!resolvedPropertyId && (dashboardData.properties || []).length > 0) {
          const firstPropertyId = dashboardData.properties[0].id;
          // BUG FIX: this used to just call load(firstPropertyId) and
          // return - but the OUTER promise chain's .finally() below
          // still ran immediately after this .then() finished, flipping
          // loading back to false before the recursive call's own fetch
          // had come back. That let the page render past the loading
          // guard with units still at its initial null, crashing on
          // units.length ("white screen" bug). Returning the recursive
          // call's promise makes the outer .finally() actually wait for
          // it to settle before touching `loading`.
          return load(firstPropertyId);
        }
        setActivePropertyId(resolvedPropertyId);
        if (resolvedPropertyId) sessionStorage.setItem('rentapay_active_property_id', resolvedPropertyId);
        setUnits(unitsData.units || []);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          sessionStorage.removeItem('rentapay_token');
          sessionStorage.removeItem('rentapay_role');
          sessionStorage.removeItem('rentapay_role_level');
          if (err.accountRevoked) {
            sessionStorage.setItem('rentapay_logout_message', err.message);
          }
          navigate('/login');
          return;
        }
        // FIX (direct request: "a manager/caretaker keeps seeing 'you
        // don't have access to this property' until they're given
        // access to the first apartment the landlord added" - it
        // should never matter WHICH property they're assigned to):
        // if the requested property was rejected specifically because
        // this account isn't assigned to it (as opposed to some other
        // failure), drop the stale remembered id and retry ONE time
        // with no propertyId at all, which falls through to "resolve
        // my own actually-assigned property" server-side. Guarded by
        // an explicit flag (not by whether propertyId happened to be
        // truthy - that used to mean a request that was ALREADY
        // running with no propertyId, and still got rejected, never
        // got a retry at all) so this always gives one honest retry
        // and never loops a second time.
        if (err instanceof ApiError && err.raw?.notAssigned && !retriedAfterNotAssigned) {
          sessionStorage.removeItem('rentapay_active_property_id');
          load(undefined, { retriedAfterNotAssigned: true });
          return;
        }
        setError(err.message || 'Failed to load dashboard.');
      })
      .finally(() => setLoading(false));
  }

  function switchProperty(propertyId) {
    setSwitcherOpen(false);
    setPaidPayments(null); // drop cached "who paid" list - it's scoped to the old property
    if (propertyId) sessionStorage.setItem('rentapay_active_property_id', propertyId);
    else sessionStorage.removeItem('rentapay_active_property_id');
    load(propertyId || undefined);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Live push" - registers the service worker and subscribes this
  // browser for urgent-tier push notifications (payment-confirmation
  // requests, vacate notices, tenant messages). Safe no-op if the
  // browser doesn't support it or the person declines the permission
  // prompt - see utils/push.js.
  useEffect(() => {
    initPushSubscription(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  
  async function handleBulkRemind() {
    setBulkRemindStatus('Sending…');
    try {
      const res = await api.sendBulkReminders(token);
      setBulkRemindStatus(res.message);
    } catch (err) {
      setBulkRemindStatus(`Failed: ${err.message}`);
    }
  }

  function handleDownloadReport() {
    // Builds a CSV client-side from data already loaded - no backend
    // report-generation endpoint exists yet (flagged honestly rather
    // than wiring a button to a 404). Covers the blueprint 11.2 "view
    // payment reports" need today; a real PDF/server-generated report
    // is a reasonable next increment.
    const headers = ['Unit', 'Status', 'Tenant', 'Rent (KES)', 'Balance Due (KES)'];
    const rows = [];
    for (const unit of units) {
      const activeTenant = (unit.tenants || []).find((t) => t.is_active);
      rows.push([unit.unit_name, unit.status, activeTenant?.full_name || '—', unit.rent_amount, activeTenant?.balance_due || 0]);
    }
    downloadCsv('rentapay-report', headers, rows);
  }

  if (loading) {
    return (
      <div className="dashboard-page dashboard-page--loading">
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page dashboard-page--loading">
        <div className="dashboard-error-card">
          <h2>Couldn't load your dashboard</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  const sub = summary.subscription || {};
  const daysLeft = sub.daysLeft;
  // FIX: was always `daysLeft / 365`, so a 1-month plan's bar barely
  // moved even right after paying. Now scaled against the actual plan
  // length purchased (periodMonths) - a fresh 1-month plan shows a
  // full bar, a fresh 12-month plan also shows a full bar, and both
  // empty out correctly over their own real length.
  const totalPlanDays = (sub.periodMonths || 1) * 30;
  const pctRemaining = daysLeft != null ? Math.max(0, Math.min(100, Math.round((daysLeft / totalPlanDays) * 100))) : null;
  const isUrgent = daysLeft != null && daysLeft <= 14;
  // Distinct, more alarming color once truly close to lockout (<=5
  // days) - separate from the general "urgent" <=14-day amber state.
  const isCritical = daysLeft != null && daysLeft <= 5;
  // Subscription lapsed entirely - the landlord can log in, but the
  // dashboard itself is gated behind a non-dismissible renew prompt
  // (direct request: don't pause any underlying activity - tenants,
  // billing jobs, reminders all keep running exactly as before - this
  // only blocks the LANDLORD's own dashboard view until they renew).
  const subscriptionExpired = sub.status === 'expired' || (daysLeft != null && daysLeft <= 0);

  return (
    <div className="dashboard-page">
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeView}
        items={[
          { key: 'dashboard', label: 'Dashboard', icon: '🏠', onClick: () => setActiveView('dashboard') },
          { key: 'due-dates', label: 'Due Dates', icon: '📅', onClick: () => setActiveView('due-dates') },
          { key: 'statistics', label: 'Financial Statistics', icon: '📊', onClick: () => setActiveView('statistics') },
          { key: 'payment-history', label: 'Payment History', icon: '📄', onClick: () => setActiveView('payment-history') },
          { key: 'pending-confirmations', label: 'Pending Payments', icon: '✅', onClick: () => setActiveView('pending-confirmations') },
          { key: 'archived-tenants', label: 'Archived Tenants', icon: '🗄️', onClick: () => setActiveView('archived-tenants') },
          { key: 'first-time-credentials', label: 'First-Time Login Details', icon: '🔑', onClick: () => setActiveView('first-time-credentials') },
          { key: 'tenant-lists', label: 'Tenant Lists', icon: '📋', onClick: () => setActiveView('tenant-lists') },
          // FIX (direct request: "help requests should be available to
          // all roles, not just tenants") - ComplaintsPanel already
          // worked for any role on the backend (submitHelpRequest
          // reads req.user.role/roleLevel, whoever is logged in); it
          // just was never actually rendered anywhere outside
          // TenantPortal.jsx. Same component, same admin-side "Help
          // Requests" tab it already lands in - just wired up here too.
          { key: 'maintenance', label: 'Maintenance', icon: '🔧', onClick: () => setActiveView('maintenance') },
          { key: 'expenses', label: 'Expenses', icon: '🧾', onClick: () => setActiveView('expenses') },
          { key: 'complaints', label: 'Help / Complaints', icon: '🆘', onClick: () => setActiveView('complaints') },
          { key: 'messages', label: 'Messages', icon: '💬', badge: messagesBadge, onClick: () => setChatOpen(true) },
          { key: 'broadcast', label: 'Broadcast', icon: '📣', onClick: () => setShowAnnouncementComposer(true) },
          { key: 'settings', label: 'Settings', icon: '⚙️', onClick: () => navigate('/settings') },
          // Subscription/billing changes are landlord-only.
          ...(isManager ? [] : [{ key: 'subscription', label: 'Manage subscription', icon: '💳', onClick: () => navigate('/subscription') }]),
          // FAQs always last (direct request, applies to every portal's sidebar).
          { key: 'faq', label: 'FAQs', icon: '❓', onClick: () => setActiveView('faq') },
        ]}
      />

      <BottomNav
        activeKey={activeView}
        items={[
          { key: 'dashboard', label: 'Home', icon: '🏠', onClick: () => setActiveView('dashboard') },
          { key: 'pending-confirmations', label: 'Payments', icon: '✅', onClick: () => setActiveView('pending-confirmations') },
          { key: 'maintenance', label: 'Maintenance', icon: '🔧', onClick: () => setActiveView('maintenance') },
          { key: 'messages', label: 'Messages', icon: '💬', onClick: () => setChatOpen(true) },
        ]}
      />

      <header className="dashboard-header">
        <div className="dashboard-header__left">
          <button type="button" className="portal-topbar__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="dashboard-header__brand-block">
            <div className="dashboard-header__brand">RentaPay</div>
            <div className="dashboard-header__role-label">{roleLabel(role, roleLevel, summary?.viewerGender)}</div>
          </div>
        </div>

        <div className="property-switcher">
          <button
            type="button"
            className="property-switcher__trigger"
            onClick={() => setSwitcherOpen((o) => !o)}
          >
            <span className="property-switcher__icon">🏢</span>
            <span className="property-switcher__label">
              {properties.find((p) => p.id === activePropertyId)?.name || 'Select property'}
            </span>
            <span className="property-switcher__caret">▾</span>
          </button>
          {switcherOpen && (
            <div className="property-switcher__menu" role="menu">
              {properties.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`property-switcher__item ${activePropertyId === p.id ? 'is-active' : ''}`}
                  onClick={() => switchProperty(p.id)}
                >
                  <span className="property-switcher__item-name">{p.name}</span>
                  {p.location && <span className="property-switcher__item-sub">{p.location}</span>}
                  {/* FIX (direct request): "every apartment of the
                      landlord should specifically show the number of
                      units he paid for... under no circumstance
                      should they show the same number" - only shown
                      once a property has its own independent
                      subscription (unit_limit set); a property still
                      on the original shared clock doesn't show a
                      figure here that could misleadingly look
                      apartment-specific. */}
                  {p.unit_limit != null && (
                    <span className="property-switcher__item-sub">
                      {p.unit_limit} units paid for
                      {p.subscription_expires_at && (
                        p.subscription_status === 'expired' || new Date(p.subscription_expires_at) <= new Date()
                          ? ' · subscription expired'
                          : ` · renews ${new Date(p.subscription_expires_at).toLocaleDateString()}`
                      )}
                    </span>
                  )}
                </button>
              ))}
              <div className="property-switcher__divider" />
              {!isManager && (
                <button
                  type="button"
                  className="property-switcher__item property-switcher__item--add"
                  onClick={() => { setSwitcherOpen(false); setShowAddProperty(true); }}
                >
                  + Add a property
                </button>
              )}
            </div>
          )}
        </div>

        <GlobalSearch token={token} />

        {summary && (
          <div className="dashboard-header__account">
            {/* Bell sits immediately next to the profile picture/name -
                both live at the extreme top-right now, nothing else
                floating in between. Photo update/removal moved into
                the account menu dropdown itself (see AccountMenu) so
                there's only ever one avatar+name control in the
                header, not two overlapping ones. */}
            <PendingPaymentsBell token={token} onOpenPendingPayments={() => setActiveView('pending-confirmations')} />
            <AnnouncementBell token={token} role={isManager ? 'manager' : 'landlord'} propertyId={activePropertyId} />
            <AccountMenu
              name={summary.viewerName}
              photoUrl={summary.viewerPhotoUrl}
              role={isManager ? 'manager' : 'landlord'}
              token={token}
              onPhotoChange={(newUrl) => setSummary((s) => ({ ...s, viewerPhotoUrl: newUrl }))}
            />
          </div>
        )}
      </header>

      {!isManager && (
        <OnboardingChecklist
          token={token}
          dismissed={!!onboardingDismissedAt}
          onDismissed={() => setOnboardingDismissedAt(new Date().toISOString())}
          steps={[
            {
              key: 'add-property',
              label: 'Add your first property',
              done: properties.length > 0,
              actionLabel: 'Add a property',
              onAction: () => setShowAddProperty(true),
            },
            {
              key: 'add-unit',
              label: 'Add a unit',
              done: units.length > 0,
              actionLabel: 'Add a unit',
              onAction: () => navigate('/units/new'),
            },
            {
              key: 'first-tenant',
              label: 'Get your first tenant set up',
              done: units.some((u) => (u.tenants || []).some((t) => t.is_active)),
              actionLabel: units.length > 0 ? 'Add a tenant' : undefined,
              onAction: units.length > 0
                ? () => navigate(`/units/${(units.find((u) => u.status === 'vacant') || units[0]).id}/add-tenant`)
                : undefined,
            },
          ]}
        />
      )}

      {showAnnouncementComposer && (
        <BroadcastPanel
          token={token}
          role={isManager ? 'manager' : 'landlord'}
          properties={summary?.properties || []}
          onClose={() => setShowAnnouncementComposer(false)}
        />
      )}

      {/* Sidebar's "Messages" item opens this with no launcher button of
          its own, same pattern as the tenant portal. */}
      <ChatWidget token={token} role={isManager ? 'manager' : 'landlord'} roleLevel={roleLevel} hideLauncher controlledOpen={chatOpen} onOpenChange={setChatOpen} />

      {showAddProperty && !isManager && (
        <AddPropertyModal
          token={token}
          onClose={() => setShowAddProperty(false)}
          onDone={(newPropertyId) => { setShowAddProperty(false); load(newPropertyId); }}
        />
      )}

      {showBulkRentModal && (
        <BulkRentChangeModal
          token={token}
          properties={properties}
          onClose={() => setShowBulkRentModal(false)}
          onDone={() => load(activePropertyId)}
        />
      )}

      {subscriptionExpired && (
        <div className="subscription-gate">
          <div className="subscription-gate__text">
            <strong>
              {sub.scopedToPropertyId ? 'This apartment\u2019s subscription has ended.' : 'Your RentaPay subscription has ended.'}
            </strong>{' '}
            {isManager
              ? "The landlord's RentaPay subscription has ended. Contact them to renew it."
              : sub.scopedToPropertyId
                ? "Renew this apartment's subscription to keep managing it. Your other apartments keep working normally."
                : "Renew your subscription to keep managing your property. Your tenants' portals keep working normally in the meantime - this only affects your own dashboard."}
          </div>
          <div className="subscription-gate__actions">
            {properties.length > 1 && (
              <select
                className="subscription-gate__switch-select"
                aria-label="Switch to another apartment"
                value=""
                onChange={(e) => { if (e.target.value) load(e.target.value); }}
              >
                <option value="" disabled>Switch apartment…</option>
                {properties.filter((p) => p.id !== activePropertyId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {!isManager && <Button variant="primary" onClick={() => navigate('/subscription')}>Renew now</Button>}
          </div>
        </div>
      )}

      {activeView === 'due-dates' ? (
        <main className="dashboard-main">
          <DueDatesCalendar token={token} />
        </main>
      ) : activeView === 'statistics' ? (
        <main className="dashboard-main">
          <LandlordStatistics token={token} propertyId={activePropertyId} />
        </main>
      ) : activeView === 'payment-history' ? (
        <main className="dashboard-main">
          <PaymentHistoryPanel token={token} propertyId={activePropertyId} propertyIdReady={!loading} canDelete={!isCaretaker} />
        </main>
      ) : activeView === 'pending-confirmations' ? (
        <main className="dashboard-main">
          <PendingPaymentConfirmations token={token} canConfirmReject={!isCaretaker} subscriptionExpired={subscriptionExpired} propertyId={activePropertyId} />
        </main>
      ) : activeView === 'archived-tenants' ? (
        <main className="dashboard-main">
          <ArchivedTenantsPanel token={token} />
        </main>
      ) : activeView === 'first-time-credentials' ? (
        <main className="dashboard-main">
          <FirstTimeCredentialsPanel token={token} viewerRole={isCaretaker ? 'caretaker' : isManager ? 'manager' : 'landlord'} />
        </main>
      ) : activeView === 'tenant-lists' ? (
        <main className="dashboard-main">
          {activePropertyId ? (
            <TenantListExport
              token={token}
              propertyId={activePropertyId}
              propertyName={properties.find((p) => p.id === activePropertyId)?.name}
            />
          ) : (
            <p className="dashboard-main__empty">Select an apartment above to see its tenant lists.</p>
          )}
        </main>
      ) : activeView === 'maintenance' ? (
        <main className="dashboard-main">
          <MaintenanceManagePanel token={token} propertyId={activePropertyId} />
        </main>
      ) : activeView === 'expenses' ? (
        <main className="dashboard-main">
          <ExpensesPanel token={token} propertyId={activePropertyId} canEdit={!isCaretaker} />
        </main>
      ) : activeView === 'complaints' ? (
        <main className="dashboard-main">
          <ComplaintsPanel token={token} name={summary?.viewerName} defaultPhone={sessionStorage.getItem('rentapay_phone')} />
        </main>
      ) : activeView === 'faq' ? (
        <main className="dashboard-main">
          <Faq audience="landlord" />
        </main>
      ) : (
      <main className="dashboard-main">
        <AttentionFeed
          token={token}
          onOpenTenant={(tenantId, unitId) => { if (unitId) navigate(`/units/${unitId}`); }}
          onOpenPendingPayments={() => setActiveView('pending-confirmations')}
        />
        {/* Signature element: subscription countdown */}
        <section className={`subscription-bar ${isUrgent ? 'subscription-bar--urgent' : ''} ${isCritical ? 'subscription-bar--critical' : ''}`}>
          <div className="subscription-bar__info">
            <span className="subscription-bar__plan">{sub.plan ? sub.plan[0].toUpperCase() + sub.plan.slice(1) : 'Plan'} plan</span>
            <span className="subscription-bar__days">
              {sub.expiresAt ? <>{daysLeft != null && daysLeft <= 0 ? 'Expired' : <><Countdown target={sub.expiresAt} expiredLabel="Expired" /> left</>}</> : 'No active subscription'}
            </span>
          </div>
          {pctRemaining != null && (
            <div className="subscription-bar__track">
              <div className={`subscription-bar__fill ${isCritical ? 'subscription-bar__fill--critical' : ''}`} style={{ width: `${pctRemaining}%` }} />
            </div>
          )}
          {isUrgent && (
            <div className="subscription-bar__warning-row">
              <span className={`subscription-bar__warning ${isCritical ? 'subscription-bar__warning--critical' : ''}`}>
                {isCritical ? `⚠️ Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left — renew now to avoid losing access` : 'Renew soon to avoid losing access'}
              </span>
              <Link to="/subscription" className="subscription-bar__renew-link">Renew now →</Link>
            </div>
          )}
        </section>

        {/* Payment method now sits directly under the subscription
            counter (was previously up in the header, where it was easy
            to lose track of / got hidden on narrow screens) so it's
            visible at a glance every time, for landlord, manager, and
            caretaker alike. */}
        <div className="payment-method-row">
          <PaymentMethodBadge token={token} shape="rectangle" propertyId={activePropertyId} />
        </div>

        {/* Metrics row - blueprint 11.1 full set. All six are now
            clickable (item B, extended per request to the landlord
            dashboard too) - each opens a drill-down using data already
            on the page (units + their tenants), except "Paid this
            month" which fetches the actual payment records. */}
        <section className="metrics-row">
          <button type="button" className="metric-card metric-card--clickable" onClick={() => openDrillDown('units')}>
            <span className="metric-card__label">Total units</span>
            <span className="metric-card__value">{summary.activeUnits ?? summary.totalUnits}</span>
            {summary.frozenUnits > 0 && (
              <span className="metric-card__sub">🔒 {summary.frozenUnits} frozen (subscription covers fewer units)</span>
            )}
          </button>
          <button type="button" className="metric-card metric-card--good metric-card--clickable" onClick={() => openDrillDown('paid')}>
            <span className="metric-card__label">Paid this month</span>
            <span className="metric-card__value">KES {Number(summary.paidThisMonth?.total || 0).toLocaleString()}</span>
            <span className="metric-card__sub">{summary.paidThisMonth?.count || 0} payments</span>
          </button>
          <button type="button" className="metric-card metric-card--warn metric-card--clickable" onClick={() => openDrillDown('overdue')}>
            <span className="metric-card__label">Overdue</span>
            <span className="metric-card__value">KES {Number(summary.overdue?.total || 0).toLocaleString()}</span>
            <span className="metric-card__sub">{summary.overdue?.count || 0} tenants</span>
          </button>
          <button type="button" className="metric-card metric-card--clickable" onClick={() => openDrillDown('notice')}>
            <span className="metric-card__label">Notice given</span>
            <span className="metric-card__value">{summary.noticeGiven || 0}</span>
          </button>
          <button type="button" className="metric-card metric-card--clickable" onClick={() => openDrillDown('vacant')}>
            <span className="metric-card__label">Vacant units</span>
            <span className="metric-card__value">{summary.vacant || 0}</span>
          </button>
          <button type="button" className="metric-card metric-card--clickable" onClick={() => openDrillDown('revenue')}>
            <span className="metric-card__label">Expected monthly revenue</span>
            <span className="metric-card__value">KES {Number(summary.expectedRevenue || 0).toLocaleString()}</span>
          </button>
        </section>

        {drillDown && (
          <div className="drilldown-panel__backdrop" onClick={() => setDrillDown(null)}>
          <section className="drilldown-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drilldown-panel__header">
              <h2>
                {drillDown === 'units' && 'All units'}
                {drillDown === 'paid' && 'Payments received this month'}
                {drillDown === 'overdue' && 'Tenants with an outstanding balance'}
                {drillDown === 'notice' && 'Units with notice given'}
                {drillDown === 'vacant' && 'Vacant units'}
                {drillDown === 'revenue' && 'Expected monthly revenue - by unit'}
              </h2>
              <div className="drilldown-panel__header-actions">
                <button
                  className="ghost-link"
                  onClick={() => {
                    if (drillDown === 'paid') {
                      downloadCsv(
                        'rentapay-payments-this-month',
                        ['Date', 'Tenant', 'Unit', 'Amount (KES)', 'Method'],
                        (paidPayments || []).map((p) => [
                          p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-GB') : '',
                          p.tenants?.full_name || '',
                          p.units?.unit_name || '',
                          p.amount,
                          p.payment_method,
                        ])
                      );
                    } else if (drillDown === 'units') {
                      downloadCsv(
                        'rentapay-units',
                        ['Unit', 'Status', 'Tenant', 'Rent (KES)'],
                        units.map((u) => {
                          const activeTenant = (u.tenants || []).find((t) => t.is_active);
                          return [u.unit_name, STATUS_LABELS[u.status]?.label || u.status, activeTenant?.full_name || '', u.rent_amount];
                        })
                      );
                    } else if (drillDown === 'overdue') {
                      downloadCsv(
                        'rentapay-overdue-tenants',
                        ['Tenant', 'Unit', 'Balance Owed (KES)'],
                        units
                          .flatMap((u) => (u.tenants || []).filter((t) => t.is_active && Number(t.balance_due) > 0).map((t) => ({ ...t, unitName: u.unit_name })))
                          .map((t) => [t.full_name, t.unitName, t.balance_due])
                      );
                    } else if (drillDown === 'notice') {
                      downloadCsv(
                        'rentapay-notice-given',
                        ['Unit', 'Tenant'],
                        units
                          .filter((u) => u.status === 'notice_given')
                          .map((u) => [u.unit_name, (u.tenants || []).find((t) => t.is_active)?.full_name || ''])
                      );
                    } else if (drillDown === 'vacant') {
                      downloadCsv(
                        'rentapay-vacant-units',
                        ['Unit', 'Rent (KES)'],
                        units.filter((u) => u.status === 'vacant').map((u) => [u.unit_name, u.rent_amount])
                      );
                    } else if (drillDown === 'revenue') {
                      downloadCsv(
                        'rentapay-expected-revenue',
                        ['Unit', 'Status', 'Counted', 'Rent (KES)'],
                        units.map((u) => {
                          const counted = u.status === 'occupied' || u.status === 'notice_given';
                          return [u.unit_name, STATUS_LABELS[u.status]?.label || u.status, counted ? 'Yes' : 'No', u.rent_amount];
                        })
                      );
                    }
                  }}
                >
                  Download
                </button>
                <button className="drilldown-panel__close" onClick={() => setDrillDown(null)}>Close ✕</button>
              </div>
            </div>

            {drillDown === 'paid' && (
              <>
                {paidLoading && <Skeleton rows={3} />}
                {!paidLoading && (paidPayments || []).length === 0 && <p>No payments received yet this month.</p>}
                {!paidLoading && (paidPayments || []).length > 0 && (
                  <div className="drilldown-table-wrap">
                  <table className="drilldown-table">
                    <thead><tr><th></th><th>Date</th><th>Tenant</th><th>Unit</th><th>Amount</th><th>Method</th></tr></thead>
                    <tbody>
                      {paidPayments.map((p) => (
                        <tr key={p.id}>
                          <td><TenantContactCard tenant={{ ...p.tenants, unit_name: p.units?.unit_name }} size={28} /></td>
                          <td>{new Date(p.paid_at).toLocaleDateString('en-GB')}</td>
                          <td>{p.tenants?.full_name || '—'}</td>
                          <td>{p.units?.unit_name || '—'}</td>
                          <td>KES {Number(p.amount).toLocaleString()}</td>
                          <td>{p.payment_method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </>
            )}

            {drillDown === 'units' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th></th><th>Unit</th><th>Status</th><th>Tenant</th><th>Rent</th></tr></thead>
                <tbody>
                  {units.map((u) => {
                    const activeTenant = (u.tenants || []).find((t) => t.is_active);
                    return (
                      <tr key={u.id}>
                        <td>{activeTenant && <TenantContactCard tenant={{ ...activeTenant, unit_name: u.unit_name }} size={28} />}</td>
                        <td>{u.unit_name}</td>
                        <td>{STATUS_LABELS[u.status]?.label || u.status}</td>
                        <td>{activeTenant?.full_name || '—'}</td>
                        <td>KES {Number(u.rent_amount).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}

            {drillDown === 'overdue' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th></th><th>Tenant</th><th>Unit</th><th>Balance owed</th></tr></thead>
                <tbody>
                  {units
                    .flatMap((u) => (u.tenants || []).filter((t) => t.is_active && Number(t.balance_due) > 0).map((t) => ({ ...t, unitName: u.unit_name })))
                    .map((t) => (
                      <tr key={t.id}>
                        <td><TenantContactCard tenant={{ ...t, unit_name: t.unitName }} size={28} /></td>
                        <td>{t.full_name}</td>
                        <td>{t.unitName}</td>
                        <td className="drilldown-table__owing">KES {Number(t.balance_due).toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            )}

            {drillDown === 'notice' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th></th><th>Unit</th><th>Tenant</th></tr></thead>
                <tbody>
                  {units
                    .filter((u) => u.status === 'notice_given')
                    .map((u) => {
                      const activeTenant = (u.tenants || []).find((t) => t.is_active);
                      return (
                        <tr key={u.id}>
                          <td>{activeTenant && <TenantContactCard tenant={{ ...activeTenant, unit_name: u.unit_name }} size={28} />}</td>
                          <td>{u.unit_name}</td>
                          <td>{activeTenant?.full_name || '—'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              </div>
            )}

            {drillDown === 'vacant' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th>Unit</th><th>Rent</th></tr></thead>
                <tbody>
                  {units
                    .filter((u) => u.status === 'vacant')
                    .map((u) => (
                      <tr key={u.id}>
                        <td>{u.unit_name}</td>
                        <td>KES {Number(u.rent_amount).toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
            )}

            {drillDown === 'revenue' && (
              <div className="drilldown-table-wrap">
              <table className="drilldown-table">
                <thead><tr><th>Unit</th><th>Status</th><th>Counted?</th><th>Rent</th></tr></thead>
                <tbody>
                  {units.map((u) => {
                    const counted = u.status === 'occupied' || u.status === 'notice_given';
                    return (
                      <tr key={u.id}>
                        <td>{u.unit_name}</td>
                        <td>{STATUS_LABELS[u.status]?.label || u.status}</td>
                        <td>{counted ? 'Yes' : 'No - no tenant to pay it'}</td>
                        <td>KES {Number(u.rent_amount).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </section>
          </div>
        )}

        {/* Quick actions - blueprint 11.1 */}
        <section className="quick-actions">
          {!isCaretaker && (
            subscriptionExpired ? (
              <button
                className="quick-action-btn"
                disabled
                title="This apartment's subscription has expired - renew it to add units."
              >
                + Add unit
              </button>
            ) : (
              <Link to="/units/new" className="quick-action-btn">+ Add unit</Link>
            )
          )}
          <Link to="/settings" className="quick-action-btn">Settings</Link>
          <button
            className="quick-action-btn"
            onClick={handleBulkRemind}
            disabled={subscriptionExpired}
            title={subscriptionExpired ? "This apartment's subscription has expired - renew it to send reminders." : undefined}
          >
            Send bulk reminder
          </button>
          <button className="quick-action-btn" onClick={handleDownloadReport}>Download report</button>
          {!isCaretaker && (
            <button className="quick-action-btn" onClick={() => setShowBulkRentModal(true)}>Bulk rent change</button>
          )}
          <HelpButton role={isManager ? 'manager' : 'landlord'} token={token} renderAs="quick-action-btn" />
          <ChatWidget token={token} role={isManager ? 'manager' : 'landlord'} roleLevel={roleLevel} label="Messages" />
        </section>
        {bulkRemindStatus && <p className="quick-actions__status">{bulkRemindStatus}</p>}

        {/* Unit grid */}
        <section className="units-section">
          <div className="units-section__header">
            <h2>Your units</h2>
            {units.length > 0 && (
              <input
                type="search"
                className="units-search-input"
                placeholder="Search by unit or tenant name…"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
              />
            )}
          </div>

          {units.length === 0 && !summary.unitLimit ? (
            <div className="units-empty">
              <p>No units yet. Units you added during setup will appear here once they're saved.</p>
            </div>
          ) : (
            <div className="units-grid">
              {visibleUnits.length === 0 && unitSearch && (
                <p className="units-empty__search-hint">No units or tenants match "{unitSearch}".</p>
              )}
              {unitsToRender.map((unit) => {
                const statusInfo = STATUS_LABELS[unit.status] || STATUS_LABELS.vacant;
                const activeTenant = (unit.tenants || []).find((t) => t.is_active);
                const isOverdue = activeTenant && Number(activeTenant.balance_due) > 0;

                // Frozen = this unit was removed from the subscription's
                // covered count (self-downgrade on renewal, or an admin
                // adjustment) - greyed out and read-only until the
                // landlord renews/upgrades back up past this unit count.
                // The tenant that was here (if any) was archived, never
                // deleted - see /archived-tenants.
                if (unit.is_frozen) {
                  return (
                    <div className="unit-card unit-card--frozen" key={unit.id} title="Frozen - your current subscription covers fewer units than you have. Renew or upgrade to unlock.">
                      <div className="unit-card__top">
                        <span className="unit-card__name">{unit.unit_name}</span>
                        <span className="status-dot status-dot--frozen" title="Frozen" />
                      </div>
                      <span className="unit-card__status-label">🔒 Frozen</span>
                      <span className="unit-card__tenant">Locked by your subscription</span>
                      <Link to="/subscription" className="unit-card__add-tenant" onClick={(e) => e.stopPropagation()}>
                        Renew to unlock →
                      </Link>
                    </div>
                  );
                }

                return (
                  <Link to={`/units/${unit.id}`} className={`unit-card ${isOverdue ? 'unit-card--overdue' : ''}`} key={unit.id}>
                    <div className="unit-card__top">
                      <span className="unit-card__name">{unit.unit_name}</span>
                      <span className={`status-dot ${statusInfo.dotClass}`} title={statusInfo.label} />
                    </div>
                    <span className="unit-card__status-label">{isOverdue ? 'Overdue' : statusInfo.label}</span>
                    <span className="unit-card__tenant">
                      {activeTenant ? (
                        <>
                          <TenantContactCard tenant={{ ...activeTenant, unit_name: unit.unit_name }} size={24} />
                          {activeTenant.full_name}
                        </>
                      ) : (
                        'No tenant'
                      )}
                    </span>
                    <span className="unit-card__rent">KES {Number(unit.rent_amount).toLocaleString()}</span>
                    {isOverdue && (
                      <span className="unit-card__balance">Owes KES {Number(activeTenant.balance_due).toLocaleString()}</span>
                    )}
                    {/* Spec §7: small badge when a scout has an active
                        (non-expired, non-placed) referral logged for
                        this unit - no separate new UI needed elsewhere,
                        it's just this one line on the existing card. */}
                    {unit.activeScoutReferral && (
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '0.75em',
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: '#FFF8E1',
                          color: '#8D6E00',
                          marginTop: 4,
                        }}
                      >
                        🔎 Scout referral — {new Date(unit.activeScoutReferral.sharedAt).toLocaleDateString('en-GB')}
                      </span>
                    )}
                    {unit.status === 'vacant' && (
                      <span
                        className="unit-card__add-tenant"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/units/${unit.id}/add-tenant`); }}
                      >
                        + Add Tenant
                      </span>
                    )}
                  </Link>
                );
              })}

              {visibleUnits.length > unitsPageSize && (
                <button
                  type="button"
                  className="unit-card unit-card--show-more"
                  onClick={() => setUnitsPageSize((s) => s + UNITS_PAGE_SIZE)}
                >
                  Show {Math.min(UNITS_PAGE_SIZE, visibleUnits.length - unitsPageSize)} more ({visibleUnits.length - unitsPageSize} remaining)
                </button>
              )}

              {/* Empty placeholder slots for quota the landlord has
                  paid for but not yet used. Not part of the original
                  blueprint - a deliberate addition requested directly,
                  so the subscription's per-unit billing ceiling is
                  visible on the dashboard itself, not just inferred
                  from a number on a billing page. */}
              {Array.from({ length: Math.max(0, (summary.unitLimit || 0) - units.length) }).map((_, i) => (
                <Link to="/units/new" className="unit-card unit-card--placeholder" key={`placeholder-${i}`}>
                  <span className="unit-card__placeholder-icon">+</span>
                  <span className="unit-card__placeholder-text">Unused slot</span>
                  <span className="unit-card__placeholder-sub">Tap to add a unit</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      )}
    </div>
  );
}
