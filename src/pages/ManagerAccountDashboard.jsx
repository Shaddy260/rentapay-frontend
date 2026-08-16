import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalSidebar from '../components/PortalSidebar.jsx';
import TenantContactCard from '../components/TenantContactCard.jsx';
import Skeleton from '../components/Skeleton.jsx';
import GmActionConfirmModal from '../components/GmActionConfirmModal.jsx';
import GmActivityLogView from '../components/GmActivityLogView.jsx';
import '../components/GmActionConfirmModal.css';
import { api } from '../api/client.js';
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
  const token = sessionStorage.getItem('rentapay_token');
  const role = sessionStorage.getItem('rentapay_role');
  const pinSet = sessionStorage.getItem('rentapay_gm_pin_set') === '1';

  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [landlords, setLandlords] = useState(null);
  const [tenants, setTenants] = useState(null);
  const [units, setUnits] = useState(null);
  const [brandAmbassadors, setBrandAmbassadors] = useState(null);
  const [expiringLandlords, setExpiringLandlords] = useState(null);
  const [activityLog, setActivityLog] = useState(null);
  const [tabError, setTabError] = useState('');
  const [tabLoading, setTabLoading] = useState(false);

  const [landlordSearch, setLandlordSearch] = useState('');

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
      .then((res) => setMetrics(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
      } else if (tab === 'activity') {
        api.getActivityLog(token).then((res) => { setActivityLog(res.logs || []); done(); }).catch(fail);
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
    if (tab === 'activity' && activityLog === null) loadTab('activity');
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

  const filteredLandlords = useMemo(() => {
    const q = landlordSearch.trim().toLowerCase();
    if (!q || !landlords) return landlords || [];
    return landlords.filter((l) =>
      [l.full_name, l.phone, l.email, l.estate_name, l.location, l.county].filter(Boolean).some((f) => f.toLowerCase().includes(q))
    );
  }, [landlords, landlordSearch]);

  function handleLogout() {
    sessionStorage.removeItem('rentapay_token');
    sessionStorage.removeItem('rentapay_role');
    sessionStorage.removeItem('rentapay_gm_pin_set');
    navigate(MANAGER_PATH);
  }

  if (!token || role !== 'general_manager' || !pinSet) return null;

  if (loading) return <div className="admin-page admin-page--center">Loading dashboard…</div>;
  if (error && !metrics) {
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
              { key: 'tenants', label: 'Tenants', icon: '👥', onClick: () => goToTab('tenants') },
              { key: 'units', label: 'Units', icon: '🚪', onClick: () => goToTab('units') },
              { key: 'brand-ambassadors', label: 'Brand Ambassadors', icon: '🤝', onClick: () => goToTab('brand-ambassadors') },
              { key: 'expiring', label: 'Expiring Soon', icon: '⏰', onClick: () => goToTab('expiring') },
              { key: 'activity', label: 'Activity Log', icon: '🕒', onClick: () => goToTab('activity') },
              { key: 'pricing', label: 'Pricing & Commission', icon: '💳', onClick: () => goToTab('pricing') },
            ],
          },
          {
            group: 'Account',
            items: [
              { key: 'my-activity', label: 'My Activity', icon: '📋', onClick: () => goToTab('my-activity') },
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
        <div className="admin-header__right">
          <button className="admin-header__logout" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      <main className="admin-main">
        {error && <p className="admin-banner admin-banner--error">{error}</p>}

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
            <h2>All tenants</h2>
            {tabLoading && <Skeleton rows={6} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && tenants && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th></th><th>Name</th><th>Phone</th><th>Landlord</th><th>Unit</th><th>Location</th><th>Balance</th><th>Status</th></tr></thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id}>
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
                  <thead><tr><th>Landlord</th><th>Estate</th><th>Phone</th><th>Location</th><th>Expires</th></tr></thead>
                  <tbody>
                    {expiringLandlords.map((l) => (
                      <tr key={l.id}>
                        <td>{l.full_name}</td>
                        <td>{l.estate_name || '—'}</td>
                        <td>{l.phone}</td>
                        <td>{[l.location, l.county].filter(Boolean).join(', ') || '—'}</td>
                        <td>{l.subscription_expires_at ? new Date(l.subscription_expires_at).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activeTab === 'activity' && (
          <section className="admin-section">
            <h2>Platform activity log</h2>
            {tabLoading && <Skeleton rows={6} />}
            {tabError && <p className="admin-banner admin-banner--error">{tabError}</p>}
            {!tabLoading && activityLog && (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>Date</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
                  <tbody>
                    {activityLog.map((a) => (
                      <tr key={a.id}>
                        <td>{a.created_at ? new Date(a.created_at).toLocaleString('en-GB') : '—'}</td>
                        <td>{a.actor_type}</td>
                        <td>{a.action}</td>
                        <td>{a.target_type} {a.target_id ? `#${a.target_id}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

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
            <p className="admin-banner">These two figures are view-only for General Manager accounts.</p>
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
    </div>
  );
}
