import React, { useState } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { api, ApiError, storeSessionTokens } from '../api/client.js';
import { getDeviceTrustToken, setDeviceTrustToken } from '../utils/deviceTrust.js';
import { clearStaleAccountCaches } from '../utils/clearStaleCaches.js';
import './Login.css'; // reuses the same card styling - no need to fork it

/**
 * Super Admin login - lives at an unlinked route (see App.jsx), never
 * referenced from any public-facing nav, per blueprint 13.3:
 *   "Secret Admin URL - Hidden URL, not linked anywhere on platform."
 * Two steps: password, then MANDATORY TOTP (authenticator-app) 2FA -
 * matches backend auth.controller.js adminLogin / adminVerifyOTP /
 * confirmAdminTotpSetup. Replaces the old emailed-OTP flow, which had
 * a bug where every code after the first login said "Invalid OTP"
 * even when correct (see adminLogin's backend comment for why) -
 * TOTP has no server-side state to lose between requests, so there's
 * nothing left to resend and no "Resend" button anymore.
 */
export default function AdminPortalAccess() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('password'); // 'password' | 'totpSetup' | 'totp' | 'forgot' | 'reset'
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [totpSetup, setTotpSetup] = useState(null); // { secret, otpauthUrl }
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // FIX (direct request): "when he taps forgot password, first it
  // should ask for email, when email is sent is when it can ask for
  // the code... it should only accept the correct administration
  // email, otherwise no code should ever unlock... only send email if
  // the email is the right one." This used to skip straight to the
  // reset-code screen with no email step at all (single-admin
  // shortcut). Now there's a dedicated 'forgot' stage that asks for
  // the email first; the actual right/wrong check happens server-side
  // (see auth.controller.js adminForgotPassword) and is never exposed
  // to this screen - the response is identical either way, so a
  // wrong email just silently goes nowhere instead of revealing
  // anything.
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resending, setResending] = useState(false);

  function completeLogin(token, refreshToken) {
    // See clearStaleCaches.js - must run before writing the new
    // session, so no page can seed itself from a previous account's
    // stale cached dashboard data.
    clearStaleAccountCaches();
    storeSessionTokens(token, refreshToken || localStorage.getItem('rentapay_pending_admin_refresh_token'));
    localStorage.removeItem('rentapay_pending_admin_refresh_token');
    localStorage.setItem('rentapay_role', 'admin');
    navigate('/admin-dashboard');
  }

  function handleForgotPasswordTap() {
    setError('');
    setMessage('');
    setStage('forgot');
  }

  async function handleForgotEmailSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.adminForgotPassword({ email: resetEmail });
      setStage('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send a reset code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendResetCode() {
    setError('');
    setResending(true);
    try {
      await api.adminForgotPassword({ email: resetEmail });
      setMessage('If that email is correct, a new reset code has been sent.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend the code.');
    } finally {
      setResending(false);
    }
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.adminResetPassword({ otp: resetOtp, newPassword, confirmPassword });
      setResetOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
      setResetEmail('');
      setMessage('Password reset. Log in with your new password.');
      setStage('password');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset the password.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.adminLogin({ password, deviceToken: getDeviceTrustToken('admin') });
      if (res && res.token) {
        // Trusted device - backend skipped straight past 2FA.
        completeLogin(res.token, res.refreshToken);
        return;
      }
      if (res && res.needsTotpSetup) {
        // First time through: no authenticator app linked yet - show
        // the QR code, then require one live code to confirm it.
        setTotpSetup({ secret: res.secret, otpauthUrl: res.otpauthUrl });
        setStage('totpSetup');
        return;
      }
      // needsTotp: true is the only other outcome now - 2FA is
      // mandatory, there's no "otpSkipped" path anymore.
      setStage('totp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSetupSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.confirmAdminTotpSetup({ code, rememberDevice });
      if (res.deviceToken) setDeviceTrustToken('admin', res.deviceToken);
      setRecoveryCodes(res.recoveryCodes);
      setStage('recoveryCodes');
      // Token is already issued at this point (res.token) - stashed
      // until the admin acknowledges the recovery codes below, so a
      // page refresh mid-screen doesn't strand them logged out.
      localStorage.setItem('rentapay_pending_admin_token', res.token);
      if (res.refreshToken) localStorage.setItem('rentapay_pending_admin_refresh_token', res.refreshToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleRecoveryCodesAcknowledged() {
    const token = localStorage.getItem('rentapay_pending_admin_token');
    const pendingRefreshToken = localStorage.getItem('rentapay_pending_admin_refresh_token');
    localStorage.removeItem('rentapay_pending_admin_token');
    completeLogin(token, pendingRefreshToken);
  }

  async function handleTotpSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.adminVerifyOtp({ code, rememberDevice });
      if (res.deviceToken) setDeviceTrustToken('admin', res.deviceToken);
      completeLogin(res.token, res.refreshToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  const titles = {
    password: 'Restricted access',
    totpSetup: 'Set up two-factor authentication',
    totp: 'Enter authenticator code',
    recoveryCodes: 'Save your recovery codes',
    forgot: 'Reset password',
    reset: 'Reset password',
  };
  const intros = {
    password: 'This area is for platform administration only.',
    totpSetup: 'Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc), then enter the 6-digit code it shows.',
    totp: 'Enter the 6-digit code from your authenticator app.',
    recoveryCodes: "If you ever lose access to your authenticator app, use one of these codes instead. Each works once. They won't be shown again.",
    forgot: 'Enter the admin account email. If it matches, a reset code will be sent to it.',
    reset: 'Enter the reset code just sent, then your new password.',
  };

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay Admin</div>
        <h1>{titles[stage]}</h1>
        <p className="login-page__intro">{intros[stage]}</p>

        {error && (
          <div className="login-page__error" role="alert">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        )}

        {message && !error && (
          <div className="login-page__error login-page__error--success" role="status">
            <p>{message}</p>
          </div>
        )}

        {stage === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="adminPassword">Password</label>
              <PasswordInput
                id="adminPassword"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" loading={loading}>Continue</Button>
            <button
              type="button"
              className="login-page__resend-link"
              onClick={handleForgotPasswordTap}
              disabled={loading}
            >
              Forgot password?
            </button>
          </form>
        )}

        {stage === 'totpSetup' && (
          <form onSubmit={handleTotpSetupSubmit}>
            {totpSetup?.otpauthUrl && (
              <div className="login-page__qr">
                <img
                  alt="Scan in your authenticator app"
                  width={200}
                  height={200}
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetup.otpauthUrl)}`}
                />
                <p className="login-page__manual-key">
                  Can't scan? Enter this key manually: <code>{totpSetup.secret}</code>
                </p>
              </div>
            )}
            <div className="form-field">
              <label className="form-field__label" htmlFor="adminTotpSetupCode">6-digit code</label>
              <input
                id="adminTotpSetupCode"
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <label className="login-page__intro" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
              Remember this device for 30 days
            </label>
            <Button type="submit" variant="primary" loading={loading}>Confirm and finish setup</Button>
          </form>
        )}

        {stage === 'totp' && (
          <form onSubmit={handleTotpSubmit}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="adminTotpCode">6-digit code</label>
              <input
                id="adminTotpCode"
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <label className="login-page__intro" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
              Remember this device for 30 days
            </label>
            <Button type="submit" variant="primary" loading={loading}>Verify</Button>
            <p className="login-page__intro" style={{ marginTop: '0.75rem' }}>
              Lost your device? Use one of your recovery codes instead of a 6-digit code.
            </p>
          </form>
        )}

        {stage === 'recoveryCodes' && (
          <div>
            <ul className="login-page__recovery-codes">
              {(recoveryCodes || []).map((rc) => (
                <li key={rc}><code>{rc}</code></li>
              ))}
            </ul>
            <Button type="button" variant="primary" onClick={handleRecoveryCodesAcknowledged}>
              I've saved these codes - continue
            </Button>
          </div>
        )}

        {stage === 'forgot' && (
          <form onSubmit={handleForgotEmailSubmit}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="adminResetEmail">Admin email</label>
              <input
                id="adminResetEmail"
                type="email"
                required
                autoFocus
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" loading={loading}>Send reset code</Button>
            <button
              type="button"
              className="login-page__resend-link"
              onClick={() => { setStage('password'); setError(''); setMessage(''); }}
            >
              Back to login
            </button>
          </form>
        )}

        {stage === 'reset' && (
          <form onSubmit={handleResetPasswordSubmit}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="adminResetOtp">Reset code</label>
              <input
                id="adminResetOtp"
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={resetOtp}
                onChange={(e) => setResetOtp(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="adminNewPassword">New password</label>
              <PasswordInput
                id="adminNewPassword"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="adminConfirmPassword">Confirm new password</label>
              <PasswordInput
                id="adminConfirmPassword"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" loading={loading}>Reset password</Button>
            {/* FIX (direct request): these two links used to run
                together on one line with no separation ("Didn't see
                the code? ResendBack to login") - now stacked, each
                its own row, spaced from the button and each other. */}
            <div className="login-page__reset-links">
              <button type="button" className="login-page__resend-link" onClick={handleResendResetCode} disabled={resending}>
                {resending ? 'Resending…' : "Didn't see the code? Resend"}
              </button>
              <button
                type="button"
                className="login-page__resend-link"
                onClick={() => { setStage('password'); setError(''); setMessage(''); }}
              >
                Back to login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
