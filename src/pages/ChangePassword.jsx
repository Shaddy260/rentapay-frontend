import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { api, ApiError } from '../api/client.js';
import './Login.css';

/**
 * Reached two ways:
 *  1. Forced, right after a first login with a temp password
 *     (Login.jsx navigates here when res.mustChangePassword is true).
 *  2. Voluntary, from the account menu, any time later.
 *
 * Both cases hit the same backend endpoint and both require the
 * current password - even on the forced first-change, since typing it
 * again here (having just typed it seconds ago on the login screen)
 * is a small enough cost for the security benefit of never accepting
 * a password change on a bare session token alone.
 */
export default function ChangePassword() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('rentapay_token');
  const role = sessionStorage.getItem('rentapay_role');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!token || !role) {
    // No session - can't change a password without knowing whose.
    navigate('/login');
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword({ currentPassword, newPassword }, token);
      setDone(true);
      // Property managers/caretakers use the same portal as the
      // landlord who added them (scoped to that landlord's data) -
      // never the tenant portal. Only an actual tenant goes to /portal.
      setTimeout(() => navigate(role === 'landlord' || role === 'manager' ? '/dashboard' : '/portal'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="login-page">
        <div className="login-page__panel">
          <div className="login-page__brand">RentaPay</div>
          <h1>Password changed</h1>
          <p className="login-page__intro">Taking you to your {role === 'landlord' || role === 'manager' ? 'dashboard' : 'portal'}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay</div>
        <h1>Set a new password</h1>
        <p className="login-page__intro">
          Choose a password you'll remember. At least 8 characters, with an uppercase letter, a number, and a special character.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="currentPassword">Current password</label>
            <PasswordInput id="currentPassword" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="newPassword">New password</label>
            <PasswordInput id="newPassword" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="confirmPassword">Confirm new password</label>
            <PasswordInput id="confirmPassword" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>

          {error && <p className="login-page__error" role="alert">{error}</p>}

          <Button type="submit" disabled={loading} fullWidth>
            {loading ? 'Saving...' : 'Change password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
