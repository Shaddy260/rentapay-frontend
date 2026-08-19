import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import { buildWaMeLink } from '../utils/whatsapp.js';
import './StatisticsPanel.css';
import './AdminBrandAmbassadors.css';

// RentaPay — General Manager Accounts spec, Section 2. Admin-only
// account creation for the General Manager role - named this way
// specifically to avoid confusion with the existing Property Manager
// role, which is unrelated. There is no self-signup path for this
// role anywhere else in the product; this panel is the only place a
// General Manager account can be created.
export default function GeneralManagersPanel({ token }) {
  const navigate = useNavigate();
  const [managers, setManagers] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  // Prompt 7 — self-service onboarding link, same rotating-24h pattern
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
    setManagers(null);
    const handle = setTimeout(load, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search]);

  // Suspend / reactivate this General Manager's own account (admin-only —
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
          own details (name, ID number, email — verified via code, phone, gender) and submit; their account is
          created right away and their login details are emailed to them. The link expires 24 hours after it's
          generated; after that (or once you generate a new one) the old one stops working.
        </>} />
        {linkError && <p className="admin-ba__error">{linkError}</p>}
        {!gmLink ? (
          <p className="admin-ba__meta">Loading…</p>
        ) : !gmLink.link || gmLink.expired ? (
          <div className="admin-ba__link-row">
            <p className="admin-ba__meta">No live link right now — generate one to share.</p>
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

      <input
        type="search"
        placeholder="Search by name, phone, or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="admin-search-input u-mb-4 u-max-380"
        aria-label="Search General Managers"
      />

      {error && <p className="modal-error">{error}</p>}
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
              <div className="admin-ba__actions">
                {/* SECTION 8 — this manager's own dedicated log page. */}
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
    </section>
  );
}
