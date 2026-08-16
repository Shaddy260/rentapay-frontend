import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import InstallAppMenuItem from '../components/InstallAppMenuItem.jsx';
import { api, ApiError } from '../api/client.js';
import './Login.css'; // reuses the same card styling as every other login screen - no need to fork it (see Section 3's "same layout pattern and styling" design note)

/**
 * RentaPay — General Manager Sectioned Build Spec, Section 3.
 *
 * General Manager's own dedicated login screen, at its own URL
 * (rentapay.co.ke/manager-account - see App.jsx) - deliberately
 * separate from the shared landlord/manager/tenant screen at /login
 * and from the hidden admin screen. Talks to its own backend endpoint
 * (POST /auth/manager-account/login, see auth.controller.js
 * generalManagerLogin) rather than the unified login() every other
 * account type shares.
 *
 * Visual design note (per spec): same fonts, spacing, button styles,
 * card treatments, and palette as every other account-type login
 * screen - it should not look like a separate product, just served at
 * its own dedicated URL. Modeled directly on AdminPortalAccess.jsx.
 */
export default function ManagerAccountAccess() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.generalManagerLogin({ email, password });
      sessionStorage.setItem('rentapay_token', res.token);
      sessionStorage.setItem('rentapay_role', 'general_manager');
      sessionStorage.setItem('rentapay_gm_pin_set', res.operationsPinSet ? '1' : '0');

      // Same forced-first-login pattern every other role already uses
      // (see ChangePassword.jsx) - a General Manager can't reach
      // anything else until they've replaced their admin-issued temp
      // password. Once that's done (or if it was already done),
      // Section 4 requires an Operations PIN before the dashboard -
      // ChangePassword.jsx's destinationForRole reads the same
      // rentapay_gm_pin_set flag to decide where to send them next.
      if (res.mustChangePassword) {
        navigate('/change-password');
        return;
      }
      navigate(res.operationsPinSet ? '/manager-account/dashboard' : '/manager-account/setup-pin');
    } catch (err) {
      if (err instanceof ApiError && err.lockedDown) {
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay Manager</div>
        <h1>General Manager login</h1>
        <p className="login-page__intro">Sign in with the email and password provided by admin.</p>

        {error && (
          <div className="login-page__error" role="alert">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="gmEmail">Email</label>
            <input
              id="gmEmail"
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="gmPassword">Password</label>
            <PasswordInput
              id="gmPassword"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" loading={loading}>Log in</Button>
        </form>

        {/* Downloadable app shortcut (Section 3): "matching how other
            account types can download a PWA/APK shortcut that opens
            straight to their own login screen" - manifest-manager.json
            (start_url: /manager-account, see index.html's manifest-swap
            script) makes this install a shortcut that opens directly
            back to this exact screen. */}
        <InstallAppMenuItem as="button" className="login-page__resend-link">
          📲 Download shortcut to this login
        </InstallAppMenuItem>
      </div>
    </div>
  );
}
