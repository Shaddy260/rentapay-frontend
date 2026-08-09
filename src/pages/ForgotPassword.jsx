import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { api, ApiError } from '../api/client.js';
import './Login.css';

/**
 * Two-stage flow, deliberately NOT requiring a token (this is
 * precisely for someone who's locked out and can't get one):
 *  1. 'request' - registered email only. A reset code is sent to that
 *     same email IF an account exists for it (the response never
 *     reveals whether it does, to avoid leaking which emails are
 *     registered).
 *  2. 'reset'   - code + new password, actually changes it.
 *
 * FIX (direct request: "change such that it only asks for the email
 * and not phone number... otp send to the email if has an account
 * with us"): this used to also accept a phone number as the lookup
 * key. Removed entirely - email only, on both stages, matching the
 * backend (auth.controller.js's requestPasswordReset/resetPassword).
 */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [stage, setStage] = useState('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // PASSWORD RESET UNIFICATION: no account-type tabs - the backend
  // figures out which account(s) this email belongs to. This only
  // ever gets populated in the dual-role case (the same reset code
  // was valid on more than one account type), same pattern as
  // Login.jsx's picker.
  const [accountPickerOptions, setAccountPickerOptions] = useState(null);

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      const res = await api.requestPasswordReset({ email });
      setMessage(res.message || 'A new code has been sent, if that email is registered with us.');
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
      const res = await api.requestPasswordReset({ email });
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
      const res = await api.resetPassword(
        pickedAccountType ? { accountType: pickedAccountType, email, otp, newPassword } : { email, otp, newPassword }
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
            <p className="login-page__intro">
              Enter the email you registered with. If it has an account with us, we'll send a reset code to it.
            </p>
            <form onSubmit={handleRequestCode}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
              This code is valid for more than one RentaPay account on this email. Which one are you resetting?
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
