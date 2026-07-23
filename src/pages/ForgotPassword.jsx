import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { api, ApiError } from '../api/client.js';
import './Login.css';

// Detected purely by shape, same helper as Login.jsx - an '@' means
// it's an email, anything else is treated as a phone number, so
// there's no separate toggle for the person to think about.
function isEmailLike(value) {
  return typeof value === 'string' && value.includes('@');
}

/**
 * Two-stage flow, deliberately NOT requiring a token (this is
 * precisely for someone who's locked out and can't get one):
 *  1. 'request' - registered phone or email, sends a code to the
 *     account's email (email is mandatory on every account, so it's
 *     always a valid delivery address even when the person looked
 *     themselves up by phone).
 *  2. 'reset'   - code + new password, actually changes it.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [stage, setStage] = useState('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // PASSWORD RESET UNIFICATION: no account-type tabs anymore - the
  // backend figures out which account(s) this email belongs to.
  // This only ever gets populated in the dual-role case (the same
  // reset code was valid on more than one account type), same pattern
  // as Login.jsx's picker.
  const [accountPickerOptions, setAccountPickerOptions] = useState(null);

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      const credentialField = isEmailLike(identifier) ? { email: identifier } : { phone: identifier };
      const res = await api.requestPasswordReset(credentialField);
      setMessage(res.message || 'A new code has been sent.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend the code.');
    } finally {
      setResending(false);
    }
  }

  async function handleRequestCode(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const credentialField = isEmailLike(identifier) ? { email: identifier } : { phone: identifier };
      const res = await api.requestPasswordReset(credentialField);
      setMessage(res.message);
      setStage('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    await performReset();
  }

  // Shared by the normal reset submit and by the account-picker
  // re-submit (which attaches accountType to resolve the dual-role case).
  async function performReset(pickedAccountType) {
    try {
      const credentialField = isEmailLike(identifier) ? { email: identifier } : { phone: identifier };
      const res = await api.resetPassword(
        pickedAccountType ? { accountType: pickedAccountType, ...credentialField, otp, newPassword } : { ...credentialField, otp, newPassword }
      );

      if (res.needsAccountPicker) {
        setAccountPickerOptions(res.options);
        setLoading(false);
        return;
      }
      setAccountPickerOptions(null);

      setMessage('Password reset. Redirecting you to log in...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  function handleAccountPick(option) {
    setError('');
    setLoading(true);
    performReset(option.accountType);
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay</div>
        <h1>Reset your password</h1>

        {stage === 'request' && (
          <>
            <p className="login-page__intro">Enter the phone number or email you registered with and we'll send a code to your account's email.</p>
            <form onSubmit={handleRequestCode}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="identifier">Phone number or email</label>
                <input
                  id="identifier"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="07XXXXXXXX or you@example.com"
                />
              </div>
              {error && <p className="login-page__error" role="alert">{error}</p>}
              <Button type="submit" disabled={loading} fullWidth>
                {loading ? 'Sending...' : 'Send reset code'}
              </Button>
            </form>
          </>
        )}

        {stage === 'reset' && accountPickerOptions && (
          <div className="login-page__account-picker" role="group" aria-label="Choose which account to reset">
            <p className="login-page__intro" style={{ marginBottom: 'var(--space-3)' }}>
              This code is valid for more than one RentaPay account on this number. Which one are you resetting?
            </p>
            {accountPickerOptions.map((opt) => (
              <Button
                key={opt.accountType}
                type="button"
                variant="secondary"
                fullWidth
                loading={loading}
                onClick={() => handleAccountPick(opt)}
                style={{ marginBottom: 'var(--space-2)' }}
              >
                Continue as {opt.label}
              </Button>
            ))}
            {error && <p className="login-page__error" role="alert">{error}</p>}
            <button
              type="button"
              className="login-page__link-btn"
              onClick={() => { setAccountPickerOptions(null); setLoading(false); }}
              style={{ marginTop: 8 }}
            >
              Back
            </button>
          </div>
        )}

        {stage === 'reset' && !accountPickerOptions && (
          <>
            {message && <p className="tenant-portal-hint" style={{ marginBottom: 12 }}>{message}</p>}
            <form onSubmit={handleReset}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="otp">Reset code</label>
                <input id="otp" required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
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
                {loading ? 'Resetting...' : 'Reset password'}
              </Button>
              <button type="button" className="login-page__link-btn" onClick={handleResend} disabled={resending} style={{ marginTop: 10 }}>
                {resending ? 'Resending…' : "Didn't see the code? Resend"}
              </button>
            </form>
          </>
        )}

        <button type="button" className="login-page__link-btn" onClick={() => navigate('/login')} style={{ marginTop: 16 }}>
          Back to login
        </button>
      </div>
    </div>
  );
}
