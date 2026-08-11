import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { api, ApiError } from '../api/client.js';
import './Login.css'; // reuses the same card styling - no need to fork it

/**
 * Super Admin login - lives at an unlinked route (see App.jsx), never
 * referenced from any public-facing nav, per blueprint 13.3:
 *   "Secret Admin URL - Hidden URL, not linked anywhere on platform."
 * Two steps: password, then a 5-minute-expiry OTP (matches backend
 * auth.controller.js adminLogin / adminVerifyOTP exactly).
 */
export default function AdminPortalAccess() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('password'); // 'password' | 'otp' | 'forgot' | 'reset'
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Direct request: "there should be a way an admin changes [their]
  // password from the admin login page... currently it's only
  // in-app... when requesting to change password just send the reset
  // code, don't ask admin to enter email, just send it already, and
  // move to the next page entering otp and new password and
  // confirmation." There's exactly one super-admin account, so
  // there's nothing to identify - tapping "Forgot password?" fires
  // the reset code immediately, no email field.
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleResendOtp() {
    setError('');
    setResending(true);
    try {
      await api.adminLogin({ password });
      setMessage('A new code has been sent.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend the code.');
    } finally {
      setResending(false);
    }
  }

  async function handleForgotPasswordTap() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.adminForgotPassword();
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
      await api.adminForgotPassword();
      setMessage('A new reset code has been sent.');
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
      const res = await api.adminLogin({ password });
      // Admin OTP can be turned off from the backend (.env
      // SUPER_ADMIN_OTP_ENABLED) while SMS/email isn't set up yet -
      // in that case adminLogin already returns a real token, so skip
      // the OTP screen entirely instead of waiting for a code.
      if (res && res.otpSkipped && res.token) {
        sessionStorage.setItem('rentapay_token', res.token);
        sessionStorage.setItem('rentapay_role', 'admin');
        navigate('/admin-dashboard');
        return;
      }
      setStage('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.adminVerifyOtp({ otp });
      sessionStorage.setItem('rentapay_token', res.token);
      sessionStorage.setItem('rentapay_role', 'admin');
      navigate('/admin-dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  const titles = {
    password: 'Restricted access',
    otp: 'Enter OTP',
    forgot: 'Restricted access',
    reset: 'Reset password',
  };
  const intros = {
    password: 'This area is for platform administration only.',
    otp: 'A code was sent to the admin phone. It expires in 5 minutes.',
    forgot: 'This area is for platform administration only.',
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

        {stage === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="adminOtp">OTP code</label>
              <input
                id="adminOtp"
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" loading={loading}>Verify</Button>
            <button type="button" className="login-page__resend-link" onClick={handleResendOtp} disabled={resending}>
              {resending ? 'Resending…' : "Didn't see the code? Resend"}
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
          </form>
        )}
      </div>
    </div>
  );
}
