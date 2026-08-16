import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import ModalShell from './ModalShell.jsx';
import Button from './Button.jsx';
import Skeleton from './Skeleton.jsx';
import InfoTip from './InfoTip.jsx';
import './StatisticsPanel.css';

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [justCreated, setJustCreated] = useState(null); // { phone, email, tempPassword } shown once
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

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
        <Button type="button" variant="primary" onClick={() => setShowAddModal(true)}>+ Add General Manager</Button>
      </div>
      <div className="u-mb-2" />
      <InfoTip text="General Managers are provisioned by admin only - there is no self-signup path for this role. Named separately from Property Managers, which is an unrelated role landlords add to their own properties." />

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
      )}
    </section>
  );
}

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
