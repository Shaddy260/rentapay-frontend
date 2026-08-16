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
// Property managers/caretakers use the same portal as the landlord who
// added them, tenants get /portal, and a Brand Ambassador (Phase 3)
// gets their own /ba-portal - everyone else falls back to /portal.
function destinationForRole(role) {
  if (role === 'landlord' || role === 'manager') return '/dashboard';
  if (role === 'brand_ambassador') return '/ba-portal';
  // SECTION 3: General Manager's own dashboard doesn't exist yet
  // (that's Section 5+ of the sectioned spec) - routes to the
  // placeholder page so a forced first-login has somewhere real to
  // land instead of falling through to the tenant /portal.
  // SECTION 4: unless they haven't set an Operations PIN yet, in
  // which case onboarding isn't complete - same flag ManagerAccountAccess.jsx
  // writes to sessionStorage right after login.
  if (role === 'general_manager') {
    return sessionStorage.getItem('rentapay_gm_pin_set') === '1' ? '/manager-account/dashboard' : '/manager-account/setup-pin';
  }
  return '/portal';
}

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
      setTimeout(() => navigate(destinationForRole(role)), 1500);
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
          <p className="login-page__intro">Taking you to your {role === 'landlord' || role === 'manager' || role === 'general_manager' ? 'dashboard' : 'portal'}...</p>

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
          Choose a password you'll remember. At least 6 characters — letters, numbers, or both.
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
