import { useState, useEffect } from 'react';
import { api, ApiError } from '../api/client.js';
import Avatar from './Avatar.jsx';
import './StatisticsPanel.css';
import Skeleton from './Skeleton.jsx';
import TapToReveal from './TapToReveal.jsx';

const ROLE_LABELS = { tenant: 'Tenants', manager: 'Managers', caretaker: 'Caretakers' };

// FIRST-TIME LOGIN DETAILS ONLY (direct request: the "Password
// Resets" viewer that used to live alongside this - showing the OTP
// whenever someone requested a forgot-password reset - has been
// removed. Reset codes are still emailed to the account as always;
// there's just no longer an in-app screen for a landlord/manager to
// go read them back. This first-time view stays, since a temp
// password issued at account creation expiring on its own (once the
// person actually logs in and changes it) is a different, lower-risk
// thing to leave visible than a live reset code.
//   - Landlord: first-time logins for tenant/manager/caretaker.
//   - Full manager (role_level='manager'): first-time logins for
//     tenant AND caretaker ONLY - never manager-level rows.
//   - Caretaker: never reaches this panel at all (see Dashboard.jsx).
//
// viewerRole drives all of this: 'landlord' | 'manager'.
export default function FirstTimeCredentialsPanel({ token, viewerRole }) {
  const isLandlord = viewerRole === 'landlord';

  const availableRoles = isLandlord ? ['tenant', 'manager', 'caretaker'] : ['tenant', 'caretaker'];
  const [activeRole, setActiveRole] = useState(availableRoles[0]);

  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    setRows(null);
    const handle = setTimeout(() => {
      api.listFirstTimeCredentials(activeRole, token, search)
        .then((res) => setRows(res.credentials || []))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load.'));
    }, 250); // small debounce so every keystroke doesn't fire a request
    return () => clearTimeout(handle);
  }, [activeRole, token, search]);

  return (
    <section className="statistics-panel">
      <h2>First-Time Login Details</h2>
      <p className="tenant-portal-hint">
        The temp password and OTP each person was given when their account was created - use this if the email
        with their details never reached them. These are the ORIGINAL values from account creation, not their
        current password.
      </p>

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
      {rows === null && !error && <Skeleton rows={4} />}
      {rows && rows.length === 0 && <p className="tenant-portal-hint">No {ROLE_LABELS[activeRole].toLowerCase()} found.</p>}
      {rows && rows.length > 0 && (
        <div className="payments-table-wrap">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Phone</th>
                {activeRole === 'tenant' && <th>Unit</th>}
                <th>Property</th>
                <th>Temp password</th>
                {activeRole === 'tenant' && <th>OTP</th>}
                <th>Created</th>
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
                  {activeRole === 'tenant' && <td>{c.unit_name || '—'}</td>}
                  <td>{c.property_name || '—'}</td>
                  <td><code>{c.temp_password}</code></td>
                  {activeRole === 'tenant' && <td><code>{c.otp}</code></td>}
                  <td>{new Date(c.created_at).toLocaleString()}</td>
                  <td>{c.expires_at ? new Date(c.expires_at).toLocaleString() : 'No expiry — verified automatically'}</td>
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
            <p><strong>Expires:</strong> {selectedPerson.expires_at ? new Date(selectedPerson.expires_at).toLocaleString() : 'No expiry — verified automatically'}</p>
            <TapToReveal className="tenant-portal-hint">
              This picture is pulled live from their profile, so it will always reflect their most recent update - it isn't a snapshot from account creation.
            </TapToReveal>
            <button type="button" className="modal-card__close" onClick={() => setSelectedPerson(null)}>Close</button>
          </div>
        </div>
      )}
    </section>
  );
}
