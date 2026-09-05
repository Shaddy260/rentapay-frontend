import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
import { finalizeLogin } from '../utils/finalizeLogin.js';
import { setDeviceTrustToken } from '../utils/deviceTrust.js';
import './Login.css';

/**
 * Second step of the OPTIONAL per-account 2FA toggle (landlord/
 * tenant/manager/brand_ambassador - see twoFactor.controller.js for
 * where they turn it on for themselves). login() already fully
 * verified the password and returned needsTotp: true instead of a
 * token; this page just collects the 6-digit authenticator code (or a
 * recovery code) and finishes the login with the same finalizeLogin()
 * flow a normal one-step login uses.
 */
export default function VerifyLoginTotp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accountType, accountId, fallbackIdentifier } = location.state || {};

  const [code, setCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!accountType || !accountId) {
    // Landed here directly (refresh, deep link) with no login in
    // progress - nothing to verify against, send them back to log in.
    navigate('/login');
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.verifyLoginTotp({ accountType, accountId, code, rememberDevice });
      if (res.deviceToken) setDeviceTrustToken(accountType, res.deviceToken);
      finalizeLogin(navigate, res, { fallbackIdentifier });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay</div>
        <h1>Enter authenticator code</h1>
        <p className="login-page__intro">Enter the 6-digit code from your authenticator app.</p>

        {error && (
          <div className="login-page__error" role="alert">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="loginTotpCode">6-digit code</label>
            <input
              id="loginTotpCode"
              required
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <label className="login-page__intro" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
            />
            Remember this device for 30 days
          </label>
          <Button type="submit" variant="primary" loading={loading}>Verify</Button>
          <button type="button" className="login-page__resend-link" onClick={() => navigate('/login')} disabled={loading}>
            Back to login
          </button>
        </form>
        <p className="login-page__intro" style={{ marginTop: '0.75rem' }}>
          Lost your device? Enter one of your recovery codes instead of a 6-digit code.
        </p>
      </div>
    </div>
  );
}
