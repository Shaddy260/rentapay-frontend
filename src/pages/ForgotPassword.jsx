import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
import './Login.css';

/**
 * Two-stage flow, deliberately NOT requiring a token (this is
 * precisely for someone who's locked out and can't get one):
 *  1. 'request' - phone + account type, sends a code by SMS.
 *  2. 'reset'   - code + new password, actually changes it.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [stage, setStage] = useState('request');
  const [accountType, setAccountType] = useState('landlord');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      const res = await api.requestPasswordReset({ accountType, phone });
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
      const res = await api.requestPasswordReset({ accountType, phone });
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
    try {
      await api.resetPassword({ accountType, phone, otp, newPassword });
      setMessage('Password reset. Redirecting you to log in...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay</div>
        <h1>Reset your password</h1>

        {stage === 'request' && (
          <>
            <p className="login-page__intro">Enter your phone number and we'll text you a code.</p>
            <div className="login-page__toggle" role="tablist" aria-label="Account type">
              <button type="button" role="tab" aria-selected={accountType === 'landlord'} className={accountType === 'landlord' ? 'is-active' : ''} onClick={() => setAccountType('landlord')}>
                Landlord
              </button>
              <button type="button" role="tab" aria-selected={accountType === 'manager'} className={accountType === 'manager' ? 'is-active' : ''} onClick={() => setAccountType('manager')}>
                Manager / Caretaker
              </button>
              <button type="button" role="tab" aria-selected={accountType === 'tenant'} className={accountType === 'tenant' ? 'is-active' : ''} onClick={() => setAccountType('tenant')}>
                Tenant
              </button>
            </div>
            <form onSubmit={handleRequestCode}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="phone">Phone number</label>
                <input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
              </div>
              {error && <p className="login-page__error" role="alert">{error}</p>}
              <Button type="submit" disabled={loading} fullWidth>
                {loading ? 'Sending...' : 'Send reset code'}
              </Button>
            </form>
          </>
        )}

        {stage === 'reset' && (
          <>
            {message && <p className="tenant-portal-hint" style={{ marginBottom: 12 }}>{message}</p>}
            <form onSubmit={handleReset}>
              <div className="form-field">
                <label className="form-field__label" htmlFor="otp">Reset code</label>
                <input id="otp" required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="newPassword">New password</label>
                <input id="newPassword" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="confirmPassword">Confirm new password</label>
                <input id="confirmPassword" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
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
