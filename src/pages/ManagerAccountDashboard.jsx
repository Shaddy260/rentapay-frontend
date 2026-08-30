import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import PortalSidebar from '../components/PortalSidebar.jsx';
import TenantContactCard from '../components/TenantContactCard.jsx';
import Skeleton from '../components/Skeleton.jsx';
import GmActionConfirmModal from '../components/GmActionConfirmModal.jsx';
import GmActivityLogView from '../components/GmActivityLogView.jsx';
import IncomingItemsBanner from '../components/IncomingItemsBanner.jsx';
import AdminLoyaltyDiscounts from '../components/AdminLoyaltyDiscounts.jsx';
import LandlordManualPaymentConfirmations from '../components/LandlordManualPaymentConfirmations.jsx';
import AdminOnboardedLandlords from '../components/AdminOnboardedLandlords.jsx';
import IncompleteSignupsPanel from '../components/IncompleteSignupsPanel.jsx';
import AdminRatingFlags from '../components/AdminRatingFlags.jsx';
import AdminReportedAccounts from '../components/AdminReportedAccounts.jsx';
import AdminHelpContactSettings from '../components/AdminHelpContactSettings.jsx';
import Faq from '../components/Faq.jsx';
import '../components/GmActionConfirmModal.css';
import { api } from '../api/client.js';
import AdminGlobalSearch from '../components/AdminGlobalSearch.jsx';
import TenantQuickActions from '../components/TenantQuickActions.jsx';
import { GM_PAGE_INDEX } from '../data/pageSearchIndex.js';
// SECTION 5's visual design note ("dashboard, cards, and all visual
// components follow the same card-based layout, spacing, and styling
// already used across the platform's other account dashboards") is
// satisfied by reusing AdminDashboard's stylesheet directly rather
// than forking a near-identical one - the class names below
// (admin-page, admin-metrics, admin-metric-card, admin-table, ...)
// are all defined there.
import './AdminDashboard.css';
import './Login.css';

const MANAGER_PATH = import.meta.env.VITE_MANAGER_PATH || '/manager-account';

// FIX (direct request: "no showing blank white screens with
// skeletons while loading... should be 100 percent cached") - same
// pattern as AdminDashboard.jsx's ADMIN_METRICS_CACHE_KEY (this page
// shares the exact same /api/admin/dashboard endpoint), so a hard
// refresh has real numbers to paint immediately instead of a
// Skeleton in metrics' place.
const GM_METRICS_CACHE_KEY = 'rentapay_gm_metrics_cache';
function readGmMetricsCache() {
  try {
    const raw = sessionStorage.getItem(GM_METRICS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeGmMetricsCache(value) {
  try {
    sessionStorage.setItem(GM_METRICS_CACHE_KEY, JSON.stringify(value));
  } catch {
    // non-fatal
  }
}

/**
 * RentaPay — General Manager Sectioned Build Spec, Section 5 & 6.
 *
 * Section 5: "Once logged in, a General Manager can see everything
 * admin can see across the platform — landlord data, tenant data,
 * Brand Ambassador data, and all operational dashboards — with one
 * specific exception": the financial breakdown / profit section,
 * which simply never appears here (and is rejected server-side if
 * requested directly - see blockGeneralManagerFinancial in the
 * backend).
 *
 * Section 6: landlord/tenant/Brand Ambassador account management -
 * activating, suspending, and any other edit outside the two locked
 * fields (platform unit pricing, BA commission rate, both shown here
 * as view-only) - is now available, each one gated behind
 * GmActionConfirmModal (Operations PIN + a mandatory reason, per the
 * spec: "The login password plays no role here - it's used only to
 * log in. Every edit action requires the Operations PIN to confirm
 * it. Every PIN-confirmed action also requires the General Manager to
 * type a mandatory reason before the action can be submitted.").
 */
export default function ManagerAccountDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('rentapay_token');
  const role = localStorage.getItem('rentapay_role');
  const pinSet = localStorage.getItem('rentapay_gm_pin_set') === '1';
  const canGrantLoyaltyDiscounts = localStorage.getItem('rentapay_gm_can_grant_loyalty_discounts') === '1';
  const canManageManualPayments = localStorage.getItem('rentapay_gm_can_manage_manual_payments') === '1';
  const canManageHelpRequests = localStorage.getItem('rentapay_gm_can_manage_help_requests') === '1';
  const canManageHelpContacts = localStorage.getItem('rentapay_gm_can_manage_help_contacts') === '1';

  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [metrics, setMetrics] = useState(() => readGmMetricsCache());
  const [loading, setLoading] = useState(() => !readGmMetricsCache());
  const [error, setError] = useState('');

  const [landlords, setLandlords] = useState(null);
  const [tenants, setTenants] = useState(null);
  const [units, setUnits] = useState(null);
  const [brandAmbassadors, setBrandAmbassadors] = useState(null);
  const [expiringLandlords, setExpiringLandlords] = useState(null);
  const [helpRequests, setHelpRequests] = useState(null);
  const [manualPaymentsCount, setManualPaymentsCount] = useState(0);
  // FEATURE (direct request - GM dashboard was missing a messages
  // counter entirely, unlike Admin/landlord/manager/caretaker, which
  // all already have one from the same chat threads endpoint).
  const [messagesBadge, setMessagesBadge] = useState(0);
  const [tabError, setTabError] = useState('');
  const [tabLoading, setTabLoading] = useState(false);

  const [landlordSearch, setLandlordSearch] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');

  // SECTION 6 — the two fields locked to admin-only editing, shown
  // here as plain view-only figures. Loaded lazily, once, the first
  // time the Pricing tab is opened - same lazy-load pattern as every
  // other tab on this dashboard.
  const [platformPricing, setPlatformPricing] = useState(null);
  const [baCommissionRate, setBaCommissionRate] = useState(null);

  // SECTION 6 — the one pending PIN-confirmed action (if any). Shape:
  // { kind, label, description, run(pin, reason) } - `run` is called
  // once the modal collects a valid PIN + reason, and does the actual
  // api.* call for whichever action was requested.
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  // Tenant "account actions" (warn/suspend/unsuspend) opened from a
  // Global Search result - see TenantQuickActions.jsx.
  const [tenantQuickActionsTarget, setTenantQuickActionsTarget] = useState(null);

  useEffect(() => {
    if (!token || role !== 'general_manager') {
      navigate(MANAGER_PATH);
      return;
    }
    if (!pinSet) {
      navigate('/manager-account/setup-pin');
      return;
    }
    // Shares the exact same /api/admin/dashboard endpoint admin uses -
    // the backend strips revenueThisMonth/revenueThisYear for this
    // role before the response ever leaves the server, so there's
    // nothing financial to accidentally render here even by mistake.
    api
      .getAdminDashboard(token)
      .then((res) => { setMetrics(res); writeGmMetricsCache(res); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // FEATURE (direct request): every GM sees the pending manual
    // payments count for the notification banner below, regardless of
    // whether they have the confirm mandate - visibility isn't gated,
    // only the confirm/reject action is (see readOnly prop on
    // LandlordManualPaymentConfirmations).
    api.listManualSubscriptionPayments('pending', token).then((res) => setManualPaymentsCount((res || []).length)).catch(() => {});
    api
      .listChatThreads(token)
      .then((res) => setMessagesBadge((res.threads || []).reduce((sum, t) => sum + (t.unreadCount || 0), 0)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role, pinSet]);

  const loadTab = useCallback(
    (tab) => {
      setTabError('');
      setTabLoading(true);
      const done = () => setTabLoading(false);
      const fail = (err) => {
        setTabError(err.message);
        done();
      };
      if (tab === 'landlords') {
        api.listAllLandlords(token).then((res) => { setLandlords(res.landlords || []); done(); }).catch(fail);
      } else if (tab === 'tenants') {
        api.listAllTenantsAdmin(token).then((res) => { setTenants(res.tenants || []); done(); }).catch(fail);
      } else if (tab === 'units') {
        api.listAllUnitsAdmin(token).then((res) => { setUnits(res.units || []); done(); }).catch(fail);
      } else if (tab === 'brand-ambassadors') {
        api.listBrandAmbassadors(null, token).then((res) => { setBrandAmbassadors(res.brandAmbassadors || res.bas || []); done(); }).catch(fail);
      } else if (tab === 'expiring') {
        api.getExpiringLandlords(30, token).then((res) => { setExpiringLandlords(res.landlords || []); done(); }).catch(fail);
      } else if (tab === 'help') {
        api.listHelpRequestsAdmin('open', token).then((res) => { setHelpRequests(res.requests || res.helpRequests || []); done(); }).catch(fail);
      } else if (tab === 'onboarded-landlords' || tab === 'incomplete-signups' || tab === 'loyalty-discounts' || tab === 'manual-payments' || tab === 'rating-flags' || tab === 'reported-accounts' || tab === 'help-contact-settings' || tab === 'faq') {
        // These render their own self-contained components (each does
        // its own fetching), so there's nothing to preload here.
        done();
      } else if (tab === 'pricing') {
        // SECTION 6 — view-only. GET works for a General Manager; the
        // matching PATCH routes stay admin-only server-side, so
        // there's simply no edit affordance rendered for either of
        // these anywhere on this page.
        Promise.all([api.getSubscriptionPricing(token), api.getBaPayoutRules(null, token)])
          .then(([pricingRes, payoutRes]) => {
            setPlatformPricing(pricingRes);
            setBaCommissionRate(payoutRes);
            done();
          })
          .catch(fail);
      } else {
        done();
      }
    },
    [token]
  );

  function goToTab(tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
    if (tab === 'landlords' && landlords === null) loadTab('landlords');
    if (tab === 'tenants' && tenants === null) loadTab('tenants');
    if (tab === 'units' && units === null) loadTab('units');
    if (tab === 'brand-ambassadors' && brandAmbassadors === null) loadTab('brand-ambassadors');
    if (tab === 'expiring' && expiringLandlords === null) loadTab('expiring');
    if (tab === 'help' && helpRequests === null) loadTab('help');
    if (tab === 'pricing' && platformPricing === null) loadTab('pricing');
  }

  // SECTION 6 — opens the PIN+reason modal for a given action, then
  // (once confirmed) runs it, refreshes the affected list, and closes
  // the modal. Every edit action on this page funnels through here so
  // there's exactly one confirmation flow, not one per action type.
  function requestConfirm(action) {
    setConfirmError('');
    setConfirmAction(action);
  }

  async function handleConfirm({ operationsPin, reason }) {
    if (!confirmAction) return;
    setConfirmBusy(true);
    setConfirmError('');
    try {
      await confirmAction.run(operationsPin, reason);
      setConfirmAction(null);
      if (confirmAction.refresh) loadTab(confirmAction.refresh);
    } catch (err) {
      setConfirmError(err.message);
    } finally {
      setConfirmBusy(false);
    }
  }

  function setLandlordStatusAction(landlord, status) {
    requestConfirm({
      label: status === 'suspended' ? 'Suspend landlord' : 'Activate landlord',
      description: `${status === 'suspended' ? 'Suspend' : 'Activate'} ${landlord.full_name}'s account?`,
      refresh: 'landlords',
      run: (operationsPin, reason) => api.setLandlordStatus(landlord.id, { status, operationsPin, reason }, token),
    });
  }

  function suspendBaAction(ba) {
    requestConfirm({
      label: 'Suspend Brand Ambassador',
      description: `Suspend ${ba.full_name}? They will stop qualifying for new payouts until reactivated.`,
      refresh: 'brand-ambassadors',
      run: (operationsPin, reason) => api.suspendBrandAmbassador(ba.id, undefined, token, { operationsPin, reason }),
    });
  }

  function reactivateBaAction(ba) {
    requestConfirm({
      label: 'Reactivate Brand Ambassador',
      description: `Reactivate ${ba.full_name}?`,
      refresh: 'brand-ambassadors',
      run: (operationsPin, reason) => api.reactivateBrandAmbassador(ba.id, undefined, token, { operationsPin, reason }),
    });
  }

  function handleGlobalSearchSelect(result) {
    if (result.role === 'page') {
      if (result.route) navigate(result.route);
      else goToTab(result.tab);
      return;
    }
    if (result.role === 'landlord') {
      goToTab('landlords');
      setLandlordSearch(result.email || result.name);
    } else if (result.role === 'tenant') {
      goToTab('tenants');
      setTenantSearch(result.email || '');
      // FEATURE (direct request): same activate/deactivate/suspend
      // actions a landlord result gets, routed through the GM's
      // existing Operations PIN + reason confirmation flow.
      setTenantQuickActionsTarget(result);
    } else if (result.role === 'manager') {
      goToTab('landlords');
      setLandlordSearch(result.landlordName || '');
    } else if (result.role === 'brand_ambassador') {
      goToTab('brand-ambassadors');
    }
  }

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q || !tenants) return tenants || [];
    return tenants.filter((t) => [t.full_name, t.email, t.primary_phone].filter(Boolean).some((f) => f.toLowerCase().includes(q)));
  }, [tenants, tenantSearch]);

  const filteredLandlords = useMemo(() => {
    const q = landlordSearch.trim().toLowerCase();
    if (!q || !landlords) return landlords || [];
    return landlords.filter((l) =>
      [l.full_name, l.phone, l.email, l.estate_name, l.location, l.county].filter(Boolean).some((f) => f.toLowerCase().includes(q))
    );
  }, [landlords, landlordSearch]);

  function handleLogout() {
    localStorage.removeItem('rentapay_token');
    localStorage.removeItem('rentapay_role');
    localStorage.removeItem('rentapay_gm_pin_set');
    localStorage.removeItem('rentapay_gm_can_grant_loyalty_discounts');
    localStorage.removeItem('rentapay_gm_can_manage_manual_payments');
    localStorage.removeItem('rentapay_gm_can_manage_help_requests');
    localStorage.removeItem('rentapay_gm_can_manage_help_contacts');
    localStorage.removeItem('rentapay_gm_full_name');
    localStorage.removeItem('rentapay_gm_photo_url');
    navigate(MANAGER_PATH);
  }

  if (!token || role !== 'general_manager' || !pinSet) return null;

  // FIX (direct request - same full-page loading blank as
  // AdminDashboard.jsx): render the shell immediately, let the
  // overview tab show a Skeleton in metrics' place instead.
  if (error && !metrics && !loading) {
    return (
      <div className="admin-page admin-page--center">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeTab}
        brandName="RentaPay Manager"
        items={[
          {
            group: 'Overview',
            items: [{ key: 'overview', label: 'Overview', icon: '📊', onClick: () => goToTab('overview') }],
          },
          {
            group: 'Platform Data',
            items: [
              { key: 'landlords', label: 'Landlords', icon: '🏠', onClick: () => goToTab('landlords') },
              { key: 'onboarded-landlords', label: "Today's Onboarded Landlords", icon: '📋', onClick: () => goToTab('onboarded-landlords') },
              { key: 'incomplete-signups', label: 'Incomplete Signups', icon: '🚧', onClick: () => goToTab('incomplete-signups') },
              { key: 'tenants', label: 'Tenants', icon: '👥', onClick: () => goToTab('tenants') },
              { key: 'units', label: 'Units', icon: '🚪', onClick: () => goToTab('units') },
              { key: 'brand-ambassadors', label: 'Brand Ambassadors', icon: '🤝', onClick: () => goToTab('brand-ambassadors') },
              { key: 'expiring', label: 'Expiring Soon', icon: '⏰', onClick: () => goToTab('expiring') },
              // FEATURE (direct request): view-only always; the grant/
              // revoke controls only render if admin has toggled this
              // GM's can_grant_loyalty_discounts on (see AdminLoyaltyDiscounts's readOnly prop below).
              { key: 'loyalty-discounts', label: 'Loyalty Discounts', icon: '🎁', onClick: () => goToTab('loyalty-discounts') },
              // FEATURE (direct request, revised): every GM sees this menu
              // item and the pending list - only confirming/rejecting is
              // gated behind admin's per-GM mandate (see readOnly prop
              // below on LandlordManualPaymentConfirmations).
              { key: 'manual-payments', label: 'Landlord Manual Payments', icon: '💳', badge: manualPaymentsCount, onClick: () => goToTab('manual-payments') },
              { key: 'pricing', label: 'Pricing & Commission', icon: '💳', onClick: () => goToTab('pricing') },
            ],
          },
          {
            group: 'Support',
            items: [
              { key: 'help', label: 'Help Requests', icon: '❓', onClick: () => goToTab('help') },
              { key: 'messages', label: 'Messages', icon: '💬', badge: messagesBadge, onClick: () => navigate('/messages') },
              { key: 'rating-flags', label: 'Rating Flags', icon: '🚩', onClick: () => goToTab('rating-flags') },
              { key: 'reported-accounts', label: 'Reported Accounts', icon: '⛔', onClick: () => goToTab('reported-accounts') },
              { key: 'faq', label: 'FAQs', icon: '📚', onClick: () => goToTab('faq') },
              { key: 'help-contact-settings', label: 'Help & Contact Details', icon: '☎️', onClick: () => goToTab('help-contact-settings') },
            ],
          },
          {
            // System group deliberately excludes Activity Log/First-Time
            // Credentials (direct request: remove activity logs from
            // this account; credentials issuance stays admin-only).
            group: 'System',
            items: [
              { key: 'my-activity', label: 'My Activity', icon: '🕒', onClick: () => goToTab('my-activity') },
            ],
          },
          {
            group: 'Account',
            items: [
              { key: 'settings', label: 'Settings', icon: '⚙️', onClick: () => navigate('/manager-account/settings') },
              { key: 'logout', label: 'Log out', icon: '🚪', onClick: handleLogout },
            ],
          },
        ]}
      />

      <header className="admin-header">
        <div className="admin-header__left">
          <button type="button" className="portal-topbar__hamburger admin-header__hamburger" aria-label="Menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="admin-header__brand">RentaPay <span>Manager</span></div>
        </div>
        <div className="admin-header__search">
          <AdminGlobalSearch token={token} onSelect={handleGlobalSearchSelect} pageIndex={GM_PAGE_INDEX} />
        </div>
        <div className="admin-header__right">
          <button className="admin-header__logout" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="admin-main">
        {error && <p className="admin-banner admin-banner--error">{error}</p>}

        <IncomingItemsBanner
          variant="priority"
          items={[
            { key: 'manual-payments', icon: '💳', label: 'Pending landlord manual payments awaiting confirmation', count: manualPaymentsCount, onClick: () => goToTab('manual-payments') },
          ]}
        />

        <IncomingItemsBanner
          items={[
            { key: 'messages', icon: '💬', label: 'Unread messages', count: messagesBadge, onClick: () => navigate('/messages') },
          ]}
        />

        {activeTab === 'overview' && !metrics && <Skeleton rows={6} />}
        {activeTab === 'overview' && metrics && (
          <section className="admin-metrics">
            <button type="button" className="admin-metric-card admin-metric-card--clickable" onClick={() => goToTab('landlords')}>
              <span className="admin-metric-card__label">Total landlords</span>
              <span className="admin-metric-card__value">{metrics.totalLandlords}</span>
              <span className="admin-metric-card__sub">{metrics.activeLandlords} active · {metrics.suspendedLandlords} suspended</span>
              <span className="admin-metric-card__hint">View list →</span>
            </button>
            <button type="button" className="admin-metric-card admin-metric-card--clickable" onClick={() => goToTab('tenants')}>
              <span className="admin-metric-card__label">Total tenants</span>
              <span className="admin-metric-card__value">{metrics.totalTenants}</span>
              <span className="admin-metric-card__hint">View list →</span>
            </button>
            <button type="button" className="admin-metric-card admin-metric-card--clickable" onClick={() => goToTab('units')}>
              <span className="admin-metric-card__label">Total units</span>
              <span className="admin-metric-card__value">{metrics.totalUnits}</span>
              <span className="admin-metric-card__hint">View list →</span>
            </button>
            <button
              type="button"
              className="admin-metric-card admin-metric-card--clickable admin-metric-card--warn"
              onClick={() => goToTab('expiring')}
            >
              <span className="admin-metric-card__label">Expiring soon (≤7 days)</span>
              <span className="admin-metric-card__value">{metrics.expiringSoon?.length || 0}</span>
              <span className="admin-metric-card__hint">View list →</span>
            </button>
            {/* No revenue/profit card here, on purpose - Section 5. */}
          </section>
        )}

        {activeTab === 'landlords' && (
          <section className="admin-section">
            <div className="admin-section__header-row">
              <h2>All landlords</h2>
              <input
                type="search"
                className="admin-search-input"
                placeholder="Search by name, phone, email, or location…"
                value={landlordSearch}
                onChange={(e) => setLandlordSearch(e.target.value)}
              />
            </div>
            {tabLoading && <Skeleton rows={6} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && landlords && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Estate</th><th>Location</th><th>Plan</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredLandlords.map((l) => (
                      <tr key={l.id}>
                        <td>{l.full_name}</td>
                        <td>{l.phone}</td>
                        <td>{l.email || '—'}</td>
                        <td>{l.estate_name || '—'}</td>
                        <td>{[l.location, l.county].filter(Boolean).join(', ') || '—'}</td>
                        <td>{l.subscription_plan || '—'}</td>
                        <td>{l.subscription_status}</td>
                        <td>{l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString('en-GB') : '—'}</td>
                        <td>
                          {/* SECTION 6 — activate/suspend a landlord, PIN+reason confirmed. */}
                          {l.subscription_status === 'suspended' ? (
                            <button type="button" className="admin-table__action" onClick={() => setLandlordStatusAction(l, 'active')}>Activate</button>
                          ) : (
                            <button type="button" className="admin-table__action admin-table__action--danger" onClick={() => setLandlordStatusAction(l, 'suspended')}>Suspend</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'tenants' && (
          <section className="admin-section">
            <div className="admin-section__header-row">
              <h2>All tenants</h2>
              <input
                type="search"
                className="admin-search-input"
                placeholder="Search by name, phone, or email…"
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
              />
            </div>
            {tabLoading && <Skeleton rows={6} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && tenants && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th></th><th>Name</th><th>Phone</th><th>Landlord</th><th>Unit</th><th>Location</th><th>Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredTenants.map((t) => (
                      <tr key={t.id} className={t.email && tenantSearch && t.email.toLowerCase() === tenantSearch.trim().toLowerCase() ? 'admin-table__row--highlight' : ''}>
                        <td><TenantContactCard tenant={{ ...t, unit_name: t.units?.unit_name }} size={30} /></td>
                        <td>{t.full_name}</td>
                        <td>{t.primary_phone}</td>
                        <td>{t.landlords?.full_name || '—'}</td>
                        <td>{t.units?.unit_name || '—'}</td>
                        <td>{[t.units?.properties?.location || t.landlords?.location, t.units?.properties?.county || t.landlords?.county].filter(Boolean).join(', ') || '—'}</td>
                        <td className={Number(t.balance_due) > 0 ? 'admin-balance--owing' : ''}>KES {Number(t.balance_due || 0).toLocaleString()}</td>
                        <td>{t.is_active ? 'Active' : 'Inactive'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTenants.length === 0 && <p className="admin-section__hint">No tenants match "{tenantSearch}".</p>}
              </div>
            )}
          </section>
        )}

        {activeTab === 'units' && (
          <section className="admin-section">
            <h2>All units</h2>
            {tabLoading && <Skeleton rows={6} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && units && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Unit</th><th>Type</th><th>Landlord</th><th>Location</th><th>Rent (KES)</th><th>Status</th></tr></thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.id}>
                        <td>{u.unit_name}</td>
                        <td>{u.unit_type || '—'}</td>
                        <td>{u.landlords?.full_name || '—'}</td>
                        <td>{[u.properties?.location || u.landlords?.location, u.properties?.county || u.landlords?.county].filter(Boolean).join(', ') || '—'}</td>
                        <td>{Number(u.rent_amount || 0).toLocaleString()}</td>
                        <td>{u.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'brand-ambassadors' && (
          <section className="admin-section">
            <h2>Brand Ambassadors</h2>
            {tabLoading && <Skeleton rows={6} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && brandAmbassadors && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Name</th><th>Code</th><th>Phone</th><th>Email</th><th>Status</th><th>Onboarded</th><th>Actions</th></tr></thead>
                  <tbody>
                    {brandAmbassadors.map((b) => (
                      <tr key={b.id}>
                        <td>{b.full_name}</td>
                        <td>{b.ba_code || b.referral_code || '—'}</td>
                        <td>{b.phone}</td>
                        <td>{b.email || '—'}</td>
                        <td>{b.status}</td>
                        <td>{b.onboarded_at ? new Date(b.onboarded_at).toLocaleDateString('en-GB') : '—'}</td>
                        <td>
                          {/* SECTION 6 — suspend/reactivate a BA, PIN+reason confirmed. Offboard/restore stay admin-only in this build (not part of the day-to-day account management this dashboard exposes). */}
                          {b.status === 'active' && (
                            <button type="button" className="admin-table__action admin-table__action--danger" onClick={() => suspendBaAction(b)}>Suspend</button>
                          )}
                          {b.status === 'suspended' && (
                            <button type="button" className="admin-table__action" onClick={() => reactivateBaAction(b)}>Reactivate</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'expiring' && (
          <section className="admin-section">
            <h2>Subscriptions expiring soon</h2>
            {tabLoading && <Skeleton rows={6} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && expiringLandlords && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Landlord</th><th>Estate</th><th>Phone</th><th>Location</th><th>Expires</th><th></th></tr></thead>
                  <tbody>
                    {expiringLandlords.map((l) => (
                      <tr key={l.id}>
                        <td>{l.full_name}</td>
                        <td>{l.estate_name || '—'}</td>
                        <td>{l.phone}</td>
                        <td>{[l.location, l.county].filter(Boolean).join(', ') || '—'}</td>
                        <td>{l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString('en-GB') : '—'}</td>
                        <td>
                          {l.phone && (
                            <a href={`tel:${l.phone}`} className="admin-table__call-btn" title={`Call ${l.full_name}`} aria-label={`Call ${l.full_name}`}>
                              📞
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'onboarded-landlords' && <AdminOnboardedLandlords token={token} readOnly />}

        {activeTab === 'incomplete-signups' && <IncompleteSignupsPanel token={token} />}

        {activeTab === 'loyalty-discounts' && (
          <AdminLoyaltyDiscounts token={token} readOnly={!canGrantLoyaltyDiscounts} />
        )}

        {activeTab === 'manual-payments' && (
          <LandlordManualPaymentConfirmations token={token} readOnly={!canManageManualPayments} />
        )}

        {activeTab === 'help' && (
          <section className="admin-section">
            <h2>Help requests</h2>
            {tabLoading && <Skeleton rows={6} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && helpRequests && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>When</th><th>From</th><th>Phone</th><th>Message</th><th>Status</th>{canManageHelpRequests && <th>Actions</th>}</tr></thead>
                  <tbody>
                    {helpRequests.map((h) => (
                      <tr key={h.id}>
                        <td>{h.created_at ? new Date(h.created_at).toLocaleString('en-GB') : '—'}</td>
                        <td>{h.name}</td>
                        <td>{h.phone || '—'}</td>
                        <td>{h.message}</td>
                        <td>{h.status}</td>
                        {canManageHelpRequests && (
                          <td>
                            {h.status !== 'resolved' && (
                              <button
                                type="button"
                                className="ghost-link"
                                onClick={() =>
                                  api
                                    .resolveHelpRequest(h.id, {}, token)
                                    .then(() => loadTab('help'))
                                    .catch((err) => setTabError(err.message))
                                }
                              >
                                Resolve
                              </button>
                            )}
                            <button
                              type="button"
                              className="ghost-link"
                              style={{ color: '#b3261e' }}
                              onClick={() =>
                                api
                                  .deleteHelpRequest(h.id, token)
                                  .then(() => loadTab('help'))
                                  .catch((err) => setTabError(err.message))
                              }
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'rating-flags' && <AdminRatingFlags token={token} readOnly />}

        {activeTab === 'reported-accounts' && <AdminReportedAccounts token={token} readOnly />}

        {activeTab === 'faq' && <Faq audience="admin" />}

        {activeTab === 'help-contact-settings' && <AdminHelpContactSettings token={token} readOnly={!canManageHelpContacts} />}

        {activeTab === 'my-activity' && (
          <section className="admin-section">
            <h2>My activity</h2>
            {/* SECTION 8 — this General Manager's own PIN-confirmed
                action history, day/week/month, read-only (no revert
                affordance is ever shown here - that's admin's tool,
                on AdminGeneralManagerLogs.jsx). */}
            <GmActivityLogView
              fetchLogs={({ view, date }) => api.getMyGeneralManagerLogs({ view, date }, token)}
              canRevert={false}
              emptyLabel="You haven't made any PIN-confirmed edits in this period."
            />
          </section>
        )}

        {activeTab === 'pricing' && (
          <section className="admin-section">
            <h2>Platform pricing &amp; commission</h2>
            {/* SECTION 6 — "Locked to admin only - view only for General
                Managers: platform unit pricing, platform Brand
                Ambassador commission rate. General Managers can see
                these current settings but have no ability to change
                them." There is deliberately no edit button anywhere on
                this tab - the matching PATCH routes are admin-only
                server-side regardless. */}
            {tabLoading && <Skeleton rows={2} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && platformPricing && (
              <div className="admin-metrics">
                <div className="admin-metric-card">
                  <span className="admin-metric-card__label">Price per unit / month</span>
                  <span className="admin-metric-card__value">
                    KES {platformPricing.current ? Number(platformPricing.current.base_rate_per_unit_per_month).toLocaleString() : '—'}
                  </span>
                  {platformPricing.upcoming?.[0] && (
                    <span className="admin-metric-card__sub">
                      Changing to KES {Number(platformPricing.upcoming[0].base_rate_per_unit_per_month).toLocaleString()} on{' '}
                      {new Date(platformPricing.upcoming[0].effective_from).toLocaleDateString('en-GB')}
                    </span>
                  )}
                </div>
                <div className="admin-metric-card">
                  <span className="admin-metric-card__label">Brand Ambassador commission</span>
                  <span className="admin-metric-card__value">
                    {baCommissionRate?.global?.current ? `${Number(baCommissionRate.global.current.percentage)}%` : '—'}
                  </span>
                  {baCommissionRate?.global?.upcoming?.[0] && (
                    <span className="admin-metric-card__sub">
                      Changing to {Number(baCommissionRate.global.upcoming[0].percentage)}% on{' '}
                      {new Date(baCommissionRate.global.upcoming[0].effective_from).toLocaleDateString('en-GB')}
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <GmActionConfirmModal
        open={!!confirmAction}
        title={confirmAction?.label}
        description={confirmAction?.description}
        busy={confirmBusy}
        error={confirmError}
        onCancel={() => { setConfirmAction(null); setConfirmError(''); }}
        onConfirm={handleConfirm}
      />

      {tenantQuickActionsTarget && (
        <TenantQuickActions
          token={token}
          tenant={tenantQuickActionsTarget}
          mode="gm"
          requestGmConfirm={(action) => requestConfirm({ ...action, refresh: 'tenants' })}
          onClose={() => setTenantQuickActionsTarget(null)}
        />
      )}
    </div>
  );
}
