import React, { useState } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import InstallAppMenuItem from '../components/InstallAppMenuItem.jsx';
import { api, ApiError } from '../api/client.js';
import { getDeviceTrustToken, setDeviceTrustToken } from '../utils/deviceTrust.js';
import { clearStaleAccountCaches } from '../utils/clearStaleCaches.js';
import '../components/FormField.css';
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
  const [stage, setStage] = useState('login'); // 'login' | 'totpSetup' | 'totp' | 'recoveryCodes' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [managerId, setManagerId] = useState(null);
  const [totpSetup, setTotpSetup] = useState(null); // { secret, otpauthUrl }
  const [code, setCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [pendingSession, setPendingSession] = useState(null); // full login response, stashed until recovery codes are acknowledged

  // FEATURE (direct request): "general manager dont have a way to
  // reset their password ... add it and also add it from the login
  // screen." Same inline stage-switching pattern AdminPortalAccess.jsx
  // already uses for the hidden admin login - no separate URL to find,
  // it all happens right here on the General Manager login screen.
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');

  function completeSession(res) {
    // See clearStaleCaches.js - must run before writing the new
    // session, so no page can seed itself from a previous account's
    // stale cached dashboard data.
    clearStaleAccountCaches();
    localStorage.setItem('rentapay_token', res.token);
    localStorage.setItem('rentapay_role', 'general_manager');
    localStorage.setItem('rentapay_gm_pin_set', res.operationsPinSet ? '1' : '0');
    localStorage.setItem('rentapay_gm_can_grant_loyalty_discounts', res.canGrantLoyaltyDiscounts ? '1' : '0');
    localStorage.setItem('rentapay_gm_can_manage_manual_payments', res.canManageManualPayments ? '1' : '0');
    localStorage.setItem('rentapay_gm_can_manage_help_requests', res.canManageHelpRequests ? '1' : '0');
    localStorage.setItem('rentapay_gm_can_manage_help_contacts', res.canManageHelpContacts ? '1' : '0');
    localStorage.setItem('rentapay_gm_full_name', res.fullName || '');
    if (res.photoUrl) localStorage.setItem('rentapay_gm_photo_url', res.photoUrl);
    else localStorage.removeItem('rentapay_gm_photo_url');

    if (res.mustChangePassword) {
      navigate('/change-password');
      return;
    }
    navigate(res.operationsPinSet ? '/manager-account/dashboard' : '/manager-account/setup-pin');
  }

  function handleForgotPasswordTap() {
    setError('');
    setMessage('');
    setResetEmail(email);
    setStage('forgot');
  }

  async function handleForgotEmailSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.generalManagerForgotPassword({ email: resetEmail });
      setMessage(res.message);
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
      const res = await api.generalManagerForgotPassword({ email: resetEmail });
      setMessage(res.message || 'A new code has been sent, if that email is registered with us.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend the code.');
    } finally {
      setResending(false);
    }
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.generalManagerResetPassword({ email: resetEmail, otp: resetOtp, newPassword });
      setResetOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setEmail(resetEmail);
      setPassword('');
      setMessage('Password reset. You can now log in with your new password.');
      setStage('login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset the password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.generalManagerLogin({ email, password, deviceToken: getDeviceTrustToken('general_manager') });
      // MANDATORY 2FA (direct request): password is correct, but the
      // token isn't issued yet - either the GM needs to scan a QR
      // code for the first time, or just enter a live authenticator
      // code, matching the admin login pattern. If this browser is a
      // trusted device, res.token is already here and 2FA is skipped.
      if (res && res.token) {
        completeSession(res);
        return;
      }
      if (res && res.needsTotpSetup) {
        setManagerId(res.managerId);
        setTotpSetup({ secret: res.secret, otpauthUrl: res.otpauthUrl });
        setStage('totpSetup');
        return;
      }
      setManagerId(res.managerId);
      setStage('totp');
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

  async function handleTotpSetupSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.generalManagerVerifyTotp({ managerId, code, rememberDevice });
      if (res.deviceToken) setDeviceTrustToken('general_manager', res.deviceToken);
      setRecoveryCodes(res.recoveryCodes);
      setPendingSession(res);
      setStage('recoveryCodes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.generalManagerVerifyTotp({ managerId, code, rememberDevice });
      if (res.deviceToken) setDeviceTrustToken('general_manager', res.deviceToken);
      completeSession(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleRecoveryCodesAcknowledged() {
    completeSession(pendingSession);
  }

  const titles = {
    login: 'General Manager login',
    totpSetup: 'Set up two-factor authentication',
    totp: 'Enter authenticator code',
    recoveryCodes: 'Save your recovery codes',
    forgot: 'Reset password',
    reset: 'Reset password',
  };

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay Manager</div>
        <h1>{titles[stage]}</h1>

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

        {stage === 'login' && (
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
          <>
            <p className="login-page__intro">
              Two-factor authentication is required for General Manager accounts. Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc), then enter the 6-digit code it shows.
            </p>
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
                <label className="form-field__label" htmlFor="gmTotpSetupCode">6-digit code</label>
                <input id="gmTotpSetupCode" required autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <label className="login-page__intro" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} />
                Remember this device for 30 days
              </label>
              <Button type="submit" variant="primary" loading={loading}>Confirm and finish setup</Button>
            </form>
          </>
        )}

        {stage === 'totp' && (
          <form onSubmit={handleTotpSubmit}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="gmTotpCode">6-digit code</label>
              <input id="gmTotpCode" required autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
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
          <>
            <p className="login-page__intro">
              Enter your registered email. If it has a General Manager account with us, we'll send a reset code to it.
            </p>
            <form onSubmit={handleForgotEmailSubmit}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="gmResetEmail">Email</label>
                <input
                  id="gmResetEmail"
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
              </div>
              <Button type="submit" variant="primary" loading={loading}>Send reset code</Button>
            </form>
            <button type="button" className="login-page__link-btn" onClick={() => { setStage('login'); setError(''); setMessage(''); }} style={{ marginTop: 16 }}>
              Back to login
            </button>
          </>
        )}

        {stage === 'reset' && (
          <form onSubmit={handleResetPasswordSubmit}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="gmResetOtp">Reset code</label>
              <input id="gmResetOtp" required autoFocus inputMode="numeric" maxLength={6} value={resetOtp} onChange={(e) => setResetOtp(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="gmNewPassword">New password</label>
              <PasswordInput id="gmNewPassword" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="gmConfirmPassword">Confirm new password</label>
              <PasswordInput id="gmConfirmPassword" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" loading={loading}>Reset password</Button>
            <button type="button" className="login-page__resend-link" onClick={handleResendResetCode} disabled={resending}>
              {resending ? 'Resending…' : "Didn't see the code? Resend"}
            </button>
            <button type="button" className="login-page__link-btn" onClick={() => { setStage('login'); setError(''); setMessage(''); }} style={{ marginTop: 16 }}>
              Back to login
            </button>
          </form>
        )}

        {/* Downloadable app shortcut (Section 3): "matching how other
            account types can download a PWA/APK shortcut that opens
            straight to their own login screen" - manifest-manager.json
            (start_url: /manager-account, see index.html's manifest-swap
            script) makes this install a shortcut that opens directly
            back to this exact screen. */}
        {stage === 'login' && (
          <InstallAppMenuItem as="button" className="login-page__resend-link">
            📲 Download shortcut to this login
          </InstallAppMenuItem>
        )}
      </div>
    </div>
  );
}
