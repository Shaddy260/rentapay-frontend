import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import './StatisticsPanel.css';

const ROLE_LABELS = { tenant: 'Tenants', manager: 'Managers', caretaker: 'Caretakers' };

// Direct request, narrowed by a later direct request to exactly:
//   - Landlord: first-time logins for tenant/manager/caretaker, AND
//     password-reset OTPs for tenant/manager/caretaker. Full access.
//   - Full manager (role_level='manager'): first-time logins for
//     tenant AND caretaker ONLY - never manager-level rows, and NO
//     password-reset access at all.
//   - Caretaker (role_level='caretaker'): first-time logins for
//     tenant ONLY. Nothing else - no manager/caretaker rows, no
//     password-reset access at all.
//
// viewerRole drives all of this: 'landlord' | 'manager' | 'caretaker'.
export default function FirstTimeCredentialsPanel({ token, viewerRole }) {
  const isLandlord = viewerRole === 'landlord';
  const isFullManager = viewerRole === 'manager';
  const isCaretaker = viewerRole === 'caretaker';

  // Only a landlord ever gets the password-reset category at all -
  // managers and caretakers are first-time-login only, per direct
  // request, so there's nothing to toggle for them.
  const [category, setCategory] = useState('first-login'); // 'first-login' | 'password-reset'

  const availableRoles = isLandlord ? ['tenant', 'manager', 'caretaker'] : isFullManager ? ['tenant', 'caretaker'] : ['tenant'];
  const [activeRole, setActiveRole] = useState(availableRoles[0]);

  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);

  const isFirstLogin = category === 'first-login' || !isLandlord;

  useEffect(() => {
    setRows(null);
    const handle = setTimeout(() => {
      const fetcher = isFirstLogin ? api.listFirstTimeCredentials : api.listPasswordResetRequests;
      fetcher(activeRole, token, search)
        .then((res) => setRows(res.credentials || res.requests || []))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load.'));
    }, 250); // small debounce so every keystroke doesn't fire a request
    return () => clearTimeout(handle);
  }, [category, activeRole, token, search, isFirstLogin]);

  return (
    <section className="statistics-panel">
      <h2>{isLandlord ? 'Login & Password-Reset Codes' : 'First-Time Login Details'}</h2>
      <p className="tenant-portal-hint">
        {isFirstLogin
          ? "The temp password and OTP each person was given when their account was created - use this if the email with their details never reached them. These are the ORIGINAL values from account creation, not their current password."
          : 'The OTP sent whenever someone requests a password reset (forgot password). Each code disappears from here automatically once it expires - the same expiry the person sees when entering it.'}
      </p>

      {isLandlord && (
        <div className="login-page__toggle" role="tablist" style={{ marginBottom: 12 }}>
          <button type="button" role="tab" aria-selected={category === 'first-login'} className={category === 'first-login' ? 'is-active' : ''} onClick={() => setCategory('first-login')}>
            First-Time Login
          </button>
          <button type="button" role="tab" aria-selected={category === 'password-reset'} className={category === 'password-reset' ? 'is-active' : ''} onClick={() => setCategory('password-reset')}>
            Password Resets
          </button>
        </div>
      )}

      {availableRoles.length > 1 && (
        <div className="login-page__toggle" role="tablist" style={{ marginBottom: 16 }}>
          {availableRoles.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={activeRole === r} className={activeRole === r ? 'is-active' : ''} onClick={() => setActiveRole(r)}>
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}

      <input
        type="search"
        placeholder={`Search ${ROLE_LABELS[activeRole].toLowerCase()} by name or phone…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 360, padding: '0.6rem 0.75rem', border: '1px solid var(--color-hairline)', borderRadius: '8px', width: '100%' }}
        aria-label="Search first-time credentials"
      />

      {error && <p className="modal-error">{error}</p>}
      {rows === null && !error && <p>Loading…</p>}
      {rows && rows.length === 0 && <p className="tenant-portal-hint">No {ROLE_LABELS[activeRole].toLowerCase()} found.</p>}
      {rows && rows.length > 0 && (
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Phone</th>
                {isFirstLogin && activeRole === 'tenant' && <th>Unit</th>}
                {isFirstLogin && <th>Property</th>}
                {isFirstLogin && <th>Temp password</th>}
                <th>OTP</th>
                <th>{isFirstLogin ? 'Created' : 'Requested'}</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelectedPerson(c)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      aria-label={`View details for ${c.full_name}`}
                      title="Tap to view details"
                    >
                      <Avatar name={c.full_name} photoUrl={c.photo_url} size={32} />
                    </button>
                  </td>
                  <td>{c.full_name}</td>
                  <td>{c.phone}</td>
                  {isFirstLogin && activeRole === 'tenant' && <td>{c.unit_name || '—'}</td>}
                  {isFirstLogin && <td>{c.property_name || '—'}</td>}
                  {isFirstLogin && <td><code>{c.temp_password}</code></td>}
                  <td><code>{c.otp}</code></td>
                  <td>{new Date(c.created_at || c.requested_at).toLocaleString()}</td>
                  <td>{new Date(c.expires_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPerson && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedPerson(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar name={selectedPerson.full_name} photoUrl={selectedPerson.photo_url} size={64} />
              <div>
                <h3 style={{ margin: 0 }}>{selectedPerson.full_name}</h3>
                <p style={{ margin: 0, color: '#666' }}>{ROLE_LABELS[selectedPerson.role] || selectedPerson.role}</p>
              </div>
            </div>
            <p><strong>Phone:</strong> {selectedPerson.phone}</p>
            {selectedPerson.unit_name && <p><strong>Unit:</strong> {selectedPerson.unit_name}</p>}
            {selectedPerson.property_name && <p><strong>Property:</strong> {selectedPerson.property_name}</p>}
            {selectedPerson.landlord_name && <p><strong>Landlord:</strong> {selectedPerson.landlord_name}</p>}
            <p><strong>Expires:</strong> {new Date(selectedPerson.expires_at).toLocaleString()}</p>
            <p className="tenant-portal-hint">
              This picture is pulled live from their profile, so it will always reflect their most recent update - it isn't a snapshot from account creation.
            </p>
            <button type="button" className="modal-card__close" onClick={() => setSelectedPerson(null)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}
