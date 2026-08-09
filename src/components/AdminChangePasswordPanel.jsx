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
 * reaches this is already a logged-in admin; the backend additionally
 * requires the CURRENT password before accepting a new one, so a
 * stolen admin token alone can't lock the real admin out.
 */
export default function AdminChangePasswordPanel({ token }) {
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
      await api.changeAdminPassword({ currentPassword, newPassword }, token);
      setSuccess('Password changed. Use it next time you log in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Failed to change admin password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-change-password">
      <button type="button" className="admin-change-password__toggle" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Change admin password'}
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
