import { useState, useEffect, useCallback } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import { buildWaMeLink } from '../utils/whatsapp.js';
import './StatisticsPanel.css';
import './AdminBrandAmbassadors.css';

// RentaPay - General Manager Accounts spec, Section 2. Admin-only
// account creation for the General Manager role - named this way
// specifically to avoid confusion with the existing Property Manager
// role, which is unrelated. There is no self-signup path for this
// role anywhere else in the product; this panel is the only place a
// General Manager account can be created.
export default function GeneralManagersPanel({ token, initialSearch }) {
  const navigate = useNavigate();
  const [view, setView] = useState(initialSearch ? 'roster' : 'applications'); // 'applications' | 'roster'
  const [managers, setManagers] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch || '');

  useEffect(() => {
    if (!initialSearch) return;
    setView('roster');
    setSearch(initialSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch]);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [permBusyId, setPermBusyId] = useState(null); // `${managerId}:${field}` while a toggle PATCH is in flight

  // FIX - onboarding-link submissions now sit here for admin review
  // instead of activating immediately. Mirrors AdminBrandAmbassadors's
  // Pending Applications queue.
  const [applications, setApplications] = useState(null);
  const [appBusyId, setAppBusyId] = useState(null);
  const [rejectReasons, setRejectReasons] = useState({});
  const [approvedInfo, setApprovedInfo] = useState(null);

  const loadApplications = useCallback(() => {
    setApplications(null);
    api
      .listPendingGmApplications(1, token)
      .then((res) => setApplications(res.applications || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load applications.'));
  }, [token]);

  useEffect(() => {
    if (view === 'applications') loadApplications();
  }, [view, loadApplications]);

  async function approveApplication(id) {
    setAppBusyId(id);
    setError('');
    try {
      const res = await api.approveGmApplication(id, token);
      if (res?.tempCredentials) setApprovedInfo(res.tempCredentials);
      loadApplications();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve application.');
    } finally {
      setAppBusyId(null);
    }
  }

  async function rejectApplication(id) {
    setAppBusyId(id);
    setError('');
    try {
      await api.rejectGmApplication(id, rejectReasons[id] || '', token);
      loadApplications();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject application.');
    } finally {
      setAppBusyId(null);
    }
  }

  // Prompt 7 - self-service onboarding link, same rotating-24h pattern
  // as the Brand Ambassador roster's link card (AdminBrandAmbassadors.jsx).
  const [gmLink, setGmLink] = useState(null); // { link, expiresAt, expired } | null while loading
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const loadOnboardingLink = useCallback(() => {
    api
      .getGmOnboardingLink(token)
      .then((res) => setGmLink(res))
      .catch((err) => setLinkError(err instanceof ApiError ? err.message : 'Failed to load the onboarding link.'));
  }, [token]);

  useEffect(() => { loadOnboardingLink(); }, [loadOnboardingLink]);

  async function generateOnboardingLink() {
    setLinkBusy(true);
    setLinkError('');
    try {
      const res = await api.generateGmOnboardingLink(token);
      setGmLink({ link: res.link, expiresAt: res.expiresAt, expired: false });
    } catch (err) {
      setLinkError(err instanceof ApiError ? err.message : 'Failed to generate a new link.');
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyOnboardingLink() {
    if (!gmLink?.link) return;
    try {
      await navigator.clipboard.writeText(gmLink.link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkError('Could not copy automatically - select and copy the link below instead.');
    }
  }

  function load() {
    api.listGeneralManagers(token, search)
      .then((res) => setManagers(res.managers || []))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load General Managers.'));
  }

  useEffect(() => {
    if (view !== 'roster') return;
    setManagers(null);
    const handle = setTimeout(load, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, token, search]);

  // Suspend / reactivate this General Manager's own account (admin-only -
  // a General Manager can never manage another General Manager's account,
  // same as they can't create one). Suspending blocks their next login;
  // it doesn't touch anything they've already done (see Section 7-10's
  // log/revert flow for that).
  async function handleToggleStatus(manager) {
    const nextStatus = manager.is_active ? 'suspended' : 'active';
    const verb = nextStatus === 'suspended' ? 'suspend' : 'reactivate';
    if (!window.confirm(`${verb === 'suspend' ? 'Suspend' : 'Reactivate'} ${manager.full_name}'s General Manager account?${verb === 'suspend' ? ' They will not be able to log in until reactivated.' : ''}`)) return;
    setStatusUpdatingId(manager.id);
    setError('');
    try {
      await api.setGeneralManagerStatus(manager.id, nextStatus, token);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${verb} this General Manager.`);
    } finally {
      setStatusUpdatingId(null);
    }
  }

  // FEATURE (direct request): per-manager toggles for two features
  // outside the default General Manager scope - loyalty discount
  // grants, and landlord manual-payment visibility/confirmation.
  // Optimistic update with rollback on failure, same pattern as
  // handleToggleStatus but scoped to one field instead of replacing
  // the whole manager record.
  async function handleTogglePermission(manager, field, apiField) {
    const busyKey = `${manager.id}:${field}`;
    const nextValue = !manager[field];
    setPermBusyId(busyKey);
    setError('');
    setManagers((prev) => prev.map((m) => (m.id === manager.id ? { ...m, [field]: nextValue } : m)));
    try {
      await api.updateGmPermissions(manager.id, { [apiField]: nextValue }, token);
    } catch (err) {
      setManagers((prev) => prev.map((m) => (m.id === manager.id ? { ...m, [field]: !nextValue } : m)));
      setError(err instanceof ApiError ? err.message : 'Failed to update this permission.');
    } finally {
      setPermBusyId(null);
    }
  }

  return (
    <section className="statistics-panel">
      <div className="u-flex-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="u-m-0">General Managers</h2>
      </div>
      <div className="u-mb-2" />
      <InfoTip text="General Managers are provisioned by admin only - there is no self-signup path for this role. Named separately from Property Managers, which is an unrelated role landlords add to their own properties." />

      <div className="admin-ba__link-card">
        <p className="admin-ba__link-card-title">Onboard a new General Manager</p>
        <InfoTip text={<>
          Generate a link and send it to the person you want to onboard as a General Manager. They'll fill in their
          own details (name, ID number, email - verified via code, phone, gender) and submit - you approve or reject
          it from Pending Applications below, same as Brand Ambassador applications. The link expires 24 hours after
          it's generated; after that (or once you generate a new one) the old one stops working.
        </>} />
        {linkError && <p className="admin-ba__error">{linkError}</p>}
        {!gmLink ? (
          <p className="admin-ba__meta">Loading…</p>
        ) : !gmLink.link || gmLink.expired ? (
          <div className="admin-ba__link-row">
            <p className="admin-ba__meta">No live link right now - generate one to share.</p>
            <Button variant="primary" loading={linkBusy} onClick={generateOnboardingLink}>Generate Link</Button>
          </div>
        ) : (
          <>
            <div className="admin-ba__link-row">
              <input type="text" readOnly value={gmLink.link} onFocus={(e) => e.target.select()} />
              <Button variant="ghost" onClick={copyOnboardingLink}>{linkCopied ? 'Copied!' : 'Copy Link'}</Button>
              <a
                href={buildWaMeLink('', `Onboard as a RentaPay General Manager: ${gmLink.link}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--ghost"
              >
                Share via WhatsApp
              </a>
            </div>
            <Button variant="ghost" loading={linkBusy} onClick={generateOnboardingLink}>Regenerate Link</Button>
          </>
        )}
      </div>

      <div className="admin-ba__filter">
        <button
          type="button"
          className={`admin-ba__filter-btn${view === 'applications' ? ' admin-ba__filter-btn--active' : ''}`}
          onClick={() => setView('applications')}
        >
          Pending Applications
        </button>
        <button
          type="button"
          className={`admin-ba__filter-btn${view === 'roster' ? ' admin-ba__filter-btn--active' : ''}`}
          onClick={() => setView('roster')}
        >
          Full Roster
        </button>
      </div>

      {error && <p className="admin-ba__error">{error}</p>}

      {approvedInfo && (
        <div className="admin-ba__approved-banner">
          <p>
            Approved. Login credentials were sent to {approvedInfo.phone} / {approvedInfo.email}. If delivery fails,
            share manually - temp password: <code>{approvedInfo.tempPassword}</code>
          </p>
          <button type="button" onClick={() => setApprovedInfo(null)}>Dismiss</button>
        </div>
      )}

      {view === 'applications' && (
        !applications ? (
          <Skeleton rows={3} />
        ) : !applications.length ? (
          <p className="admin-ba__empty">No pending applications right now.</p>
        ) : (
          <div className="onboarding-requests__scroll">
            {applications.map((a) => (
              <div key={a.id} className="onboarding-request-card">
                <div className="onboarding-request-card__summary">
                  <strong>{a.full_name}</strong>
                  <span>{a.phone}</span>
                  <span>{a.email}</span>
                  <span>ID: {a.national_id || '-'}</span>
                  <span>Submitted {new Date(a.created_at).toLocaleString()}</span>
                </div>
                <div className="onboarding-request-card__actions">
                  <input
                    type="text"
                    placeholder="Optional rejection reason"
                    value={rejectReasons[a.id] || ''}
                    onChange={(e) => setRejectReasons((prev) => ({ ...prev, [a.id]: e.target.value }))}
                  />
                  <Button variant="ghost" disabled={appBusyId === a.id} onClick={() => rejectApplication(a.id)}>
                    Reject
                  </Button>
                  <Button variant="primary" disabled={appBusyId === a.id} onClick={() => approveApplication(a.id)}>
                    {appBusyId === a.id ? '…' : 'Approve'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {view === 'roster' && (
        <>
          <input
            type="search"
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="admin-search-input u-mb-4 u-max-380"
            aria-label="Search General Managers"
          />

          {managers === null && !error && <Skeleton rows={4} />}
          {managers && managers.length === 0 && <p className="tenant-portal-hint">No General Managers yet.</p>}

          {managers && managers.length > 0 && (
            <ul className="admin-ba__list">
              {managers.map((m) => (
                <li key={m.id} className="admin-ba__item">
                  <div className="admin-ba__row">
                    <span className="admin-ba__name"><Avatar name={m.full_name} size={28} /> {m.full_name}</span>
                    <span className={`admin-ba__status admin-ba__status--${m.is_active ? 'active' : 'suspended'}`}>
                      {m.is_active ? 'active' : 'suspended'}
                    </span>
                  </div>
                  <p className="admin-ba__meta">
                    {m.phone} · {m.email}
                    {m.must_change_password ? ' · Password not yet changed' : ''}
                  </p>
                  <p className="admin-ba__meta">
                    Added {new Date(m.created_at).toLocaleString()}
                  </p>
                  {/* FEATURE (direct request): admin chooses per-GM whether
                      they can grant loyalty discounts and/or see & confirm
                      landlord manual payments. Both default off - see
                      sql/2026-08-general-manager-permission-toggles.sql. */}
                  <div className="admin-ba__meta u-flex-row" style={{ gap: '1.25rem', flexWrap: 'wrap' }}>
                    <label className="u-flex-row" style={{ gap: '0.4rem', alignItems: 'center', fontWeight: 'normal' }}>
                      <input
                        type="checkbox"
                        checked={!!m.can_grant_loyalty_discounts}
                        disabled={permBusyId === `${m.id}:can_grant_loyalty_discounts`}
                        onChange={() => handleTogglePermission(m, 'can_grant_loyalty_discounts', 'canGrantLoyaltyDiscounts')}
                      />
                      Can grant loyalty discounts
                    </label>
                    <label className="u-flex-row" style={{ gap: '0.4rem', alignItems: 'center', fontWeight: 'normal' }}>
                      <input
                        type="checkbox"
                        checked={!!m.can_manage_manual_payments}
                        disabled={permBusyId === `${m.id}:can_manage_manual_payments`}
                        onChange={() => handleTogglePermission(m, 'can_manage_manual_payments', 'canManageManualPayments')}
                      />
                      Can see &amp; confirm manual payments
                    </label>
                    <label className="u-flex-row" style={{ gap: '0.4rem', alignItems: 'center', fontWeight: 'normal' }}>
                      <input
                        type="checkbox"
                        checked={!!m.can_manage_help_requests}
                        disabled={permBusyId === `${m.id}:can_manage_help_requests`}
                        onChange={() => handleTogglePermission(m, 'can_manage_help_requests', 'canManageHelpRequests')}
                      />
                      Can resolve &amp; delete help requests
                    </label>
                    <label className="u-flex-row" style={{ gap: '0.4rem', alignItems: 'center', fontWeight: 'normal' }}>
                      <input
                        type="checkbox"
                        checked={!!m.can_manage_help_contacts}
                        disabled={permBusyId === `${m.id}:can_manage_help_contacts`}
                        onChange={() => handleTogglePermission(m, 'can_manage_help_contacts', 'canManageHelpContacts')}
                      />
                      Can edit Help &amp; Contact details
                    </label>
                  </div>
                  <div className="admin-ba__actions">
                    {/* SECTION 8 - this manager's own dedicated log page. */}
                    <Button
                      variant="ghost"
                      onClick={() => navigate(`/admin-dashboard/general-managers/${m.id}/logs`, { state: { managerName: m.full_name } })}
                    >
                      View activity
                    </Button>
                    <Button
                      variant={m.is_active ? 'danger' : 'ghost'}
                      disabled={statusUpdatingId === m.id}
                      onClick={() => handleToggleStatus(m)}
                    >
                      {statusUpdatingId === m.id ? '…' : m.is_active ? 'Suspend' : 'Activate'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
