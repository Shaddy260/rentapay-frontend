<<<<<<< HEAD
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
=======
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import ModalShell from './ModalShell.jsx';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import './StatisticsPanel.css';
>>>>>>> origin/main

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
<<<<<<< HEAD
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

=======
  const [showAddModal, setShowAddModal] = useState(false);
  const [justCreated, setJustCreated] = useState(null); // { phone, email, tempPassword } shown once
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

>>>>>>> origin/main
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
<<<<<<< HEAD
=======
        <Button type="button" variant="primary" onClick={() => setShowAddModal(true)}>+ Add General Manager</Button>
>>>>>>> origin/main
      </div>
      <div className="u-mb-2" />
      <InfoTip text="General Managers are provisioned by admin only - there is no self-signup path for this role. Named separately from Property Managers, which is an unrelated role landlords add to their own properties." />

<<<<<<< HEAD
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

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
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
=======
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Added</th>
                <th>Activity</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.id}>
                  <td><Avatar name={m.full_name} size={32} /></td>
                  <td>{m.full_name}</td>
                  <td>{m.phone}</td>
                  <td>{m.email}</td>
                  <td>{m.is_active ? 'Active' : 'Suspended'}{m.must_change_password ? ' · Password not yet changed' : ''}</td>
                  <td>{new Date(m.created_at).toLocaleString()}</td>
                  <td>
                    {/* SECTION 8 — this manager's own dedicated log page. */}
                    <button
                      type="button"
                      className="admin-table__action"
                      onClick={() => navigate(`/admin-dashboard/general-managers/${m.id}/logs`, { state: { managerName: m.full_name } })}
                    >
                      View activity
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`admin-table__action${m.is_active ? ' admin-table__action--danger' : ''}`}
                      disabled={statusUpdatingId === m.id}
                      onClick={() => handleToggleStatus(m)}
                    >
                      {statusUpdatingId === m.id ? '…' : m.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddGeneralManagerModal
          token={token}
          onClose={() => setShowAddModal(false)}
          onCreated={(tempCredentials) => {
            setShowAddModal(false);
            setJustCreated(tempCredentials);
            load();
          }}
        />
      )}

      {justCreated && (
        <ModalShell title="General Manager added" onClose={() => setJustCreated(null)}>
          <p>Login details were emailed to <strong>{justCreated.email}</strong>. As a fallback in case that email doesn't arrive, here are the same details - shown only once:</p>
          <p><strong>Phone:</strong> {justCreated.phone}</p>
          <p><strong>Email:</strong> {justCreated.email}</p>
          <p><strong>Temp password:</strong> <code>{justCreated.tempPassword}</code></p>
          <Button type="button" variant="primary" onClick={() => setJustCreated(null)}>Done</Button>
        </ModalShell>
>>>>>>> origin/main
      )}
    </section>
  );
}
<<<<<<< HEAD
=======

function AddGeneralManagerModal({ token, onClose, onCreated }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.createGeneralManager({ fullName, phone, email, gender: gender || undefined }, token);
      onCreated(res.tempCredentials);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create General Manager account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title="Add General Manager" onClose={onClose}>
      <form className="add-tenant-form" onSubmit={handleSubmit}>
        {error && <div className="add-tenant-error">{error}</div>}
        <div className="form-field">
          <label className="form-field__label">Full name *</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-field__label">Phone *</label>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
        </div>
        <div className="form-field">
          <label className="form-field__label">Email *</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-field">
          <label className="form-field__label">Gender (optional)</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <Button type="submit" variant="primary" loading={submitting}>Create account</Button>
      </form>
    </ModalShell>
  );
}
>>>>>>> origin/main
