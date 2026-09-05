import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
import { finalizeLogin } from '../utils/finalizeLogin.js';
import './Login.css';

/**
 * ZERO-TRUST RISK ENGINE (backend: riskEngine.service.js).
 *
 * login() already fully verified the password and returned
 * needsStepUp: true instead of a token - the CONTEXT of the attempt
 * (an unrecognized device, an unusual hour, a run of recent failed
 * attempts) scored high enough to demand a second proof of identity
 * even though this account never opted in to TOTP 2FA. A one-time
 * code was emailed to the account's address; this page collects it
 * and finishes the login exactly like a normal or TOTP-gated one.
 */
export default function VerifyLoginStepUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accountType, accountId, fallbackIdentifier, message } = location.state || {};

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!accountType || !accountId) {
    navigate('/login');
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.verifyLoginStepUp({ accountType, accountId, code });
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
        <h1>Verify it&rsquo;s you</h1>
        <p className="login-page__intro">
          {message || "This sign-in looked unusual, so we sent a verification code to your email."}
        </p>

        {error && (
          <div className="login-page__error" role="alert">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="loginStepUpCode">Verification code</label>
            <input
              id="loginStepUpCode"
              required
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" loading={loading}>Verify</Button>
          <button type="button" className="login-page__resend-link" onClick={() => navigate('/login')} disabled={loading}>
            Back to login
          </button>
        </form>
      </div>
    </div>
  );
}
