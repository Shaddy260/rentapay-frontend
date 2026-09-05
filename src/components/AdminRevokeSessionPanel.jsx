import { useState } from 'react';
import { api } from '../api/client.js';
import Button from './Button.jsx';
import './AdminRevokeSessionPanel.css';

/**
 * SECURITY FEATURE: lets an admin kill ONE specific leaked/stolen
 * session token by its jti, without suspending the whole account
 * (setLandlordStatus/suspendAccountPermanently do that - blunt, and
 * logs the person out of every device, not just the compromised one).
 *
 * Typical use: a landlord or tenant reports "someone's using my
 * account" - support asks them roughly when it happened, greps the
 * server logs for that account's requests around that time (every log
 * line is tagged with userId/userRole - see logger.js), and pastes
 * the jti from the relevant line here.
 *
 * Collapsed by default, same "tucked away, not a prominent settings
 * page" treatment as AdminChangePasswordPanel - this is a rare,
 * support-driven action, not something that needs to be front and
 * center on the dashboard.
 */
export default function AdminRevokeSessionPanel({ token }) {
  const [open, setOpen] = useState(false);
  const [jti, setJti] = useState('');
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!jti.trim()) {
      setError('jti is required. Copy it from the server log line for the session you want to kill.');
      return;
    }
    setBusy(true);
    try {
      await api.revokeSession(
        {
          jti: jti.trim(),
          userId: userId.trim() || undefined,
          userRole: userRole.trim() || undefined,
          reason: reason.trim() || undefined,
        },
        token
      );
      setSuccess('Session revoked. That one token can no longer be used - every other session on the account is unaffected.');
      setJti('');
      setUserId('');
      setUserRole('');
      setReason('');
    } catch (err) {
      setError(err.message || 'Failed to revoke session.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-revoke-session">
      <button type="button" className="admin-revoke-session__toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Revoke a leaked session'}
      </button>
      {open && (
        <form className="admin-revoke-session__form" onSubmit={handleSubmit}>
          <p className="admin-revoke-session__hint">
            Kills ONE specific session token (e.g. a leaked/stolen login someone reported) without logging the
            account out everywhere else. Find the jti in the server logs for that account around the time in
            question.
          </p>
          {error && <p className="admin-revoke-session__error">{error}</p>}
          {success && <p className="admin-revoke-session__success">{success}</p>}
          <label>
            <span>Token jti *</span>
            <input type="text" value={jti} onChange={(e) => setJti(e.target.value)} placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6" required />
          </label>
          <label>
            <span>Account id (optional, for the record)</span>
            <input type="text" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="landlord/tenant id" />
          </label>
          <label>
            <span>Account role (optional, for the record)</span>
            <input type="text" value={userRole} onChange={(e) => setUserRole(e.target.value)} placeholder="landlord / tenant / manager..." />
          </label>
          <label>
            <span>Reason (optional)</span>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Tenant reported a leaked login link" />
          </label>
          <Button type="submit" variant="primary" loading={busy}>Revoke this session</Button>
        </form>
      )}
    </div>
  );
}
