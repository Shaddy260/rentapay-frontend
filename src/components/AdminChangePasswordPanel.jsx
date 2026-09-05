import { useState } from 'react';
import { api } from '../api/client.js';
import PasswordInput from './PasswordInput.jsx';
import Button from './Button.jsx';
import './AdminChangePasswordPanel.css';

/**
 * DIRECT REQUEST: "now that the admin password is hardcoded... there
 * should be a way for an admin to secretly change the password."
 *
 * Collapsed by default and tucked away rather than a prominent
 * settings page - the same "secret by being unlinked, not by being
 * unauthenticated" idea as the admin login URL itself. Anyone who
 * reaches this is already logged in; the backend additionally
 * requires the CURRENT password before accepting a new one, so a
 * stolen token alone can't lock the real account owner out.
 *
 * FIX (direct request: "general manager sees the same dashboard as
 * admin, it should follow the way admin forgets and resets his
 * password"): a General Manager renders this exact same
 * AdminDashboard.jsx (Section 5 - "same data, same endpoints"), so
 * this panel was showing up for them too, but it silently 403'd -
 * api.changeAdminPassword only ever touches the ONE super-admin
 * account, never a General Manager's own. This is now role-aware:
 * admin still changes the admin account's password exactly as
 * before; a General Manager changes their OWN password, hitting the
 * same api.changePassword endpoint ChangePassword.jsx already uses
 * elsewhere - same "type your current password, then a new one"
 * mechanic either way, just pointed at the right account.
 * (Forgetting a password entirely - no current password known - is
 * handled on each role's own login screen, not here: AdminPortalAccess.jsx's
 * "Forgot password?" for admin, ManagerAccountAccess.jsx's for a
 * General Manager.)
 */
export default function AdminChangePasswordPanel({ token, role = 'admin' }) {
  const isGm = role === 'general_manager';
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      if (isGm) await api.changePassword({ currentPassword, newPassword }, token);
      else await api.changeAdminPassword({ currentPassword, newPassword }, token);
      setSuccess('Password changed. Use it next time you log in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-change-password">
      <button type="button" className="admin-change-password__toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : isGm ? 'Change my password' : 'Change admin password'}
      </button>
      {open && (
        <form className="admin-change-password__form" onSubmit={handleSubmit}>
          {error && <p className="admin-change-password__error">{error}</p>}
          {success && <p className="admin-change-password__success">{success}</p>}
          <label>
            <span>Current password</span>
            <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label>
            <span>New password</span>
            <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </label>
          <label>
            <span>Confirm new password</span>
            <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </label>
          <Button type="submit" variant="primary" loading={busy}>Save new password</Button>
        </form>
      )}
    </div>
  );
}
