import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import { api, ApiError, storeSessionTokens } from '../api/client.js';
import { clearStaleAccountCaches } from '../utils/clearStaleCaches.js';
import './Login.css';

/**
 * OTP verification/resend page - for tenant accounts only.
 * (Manager/caretaker accounts are created by a landlord and never
 * self-verify. Landlord accounts no longer use OTP verification at
 * all - DIRECT REQUEST FIX: a landlord account is verified solely by
 * payment confirmation now, via Daraja or admin manual confirm - see
 * activateLandlordAfterPayment in auth.controller.js - so there is
 * nothing useful for a landlord to do on this page anymore. If a
 * landlord somehow lands here, resendOTP/verifyOTP will simply refuse:
 * "already verified" once payment's confirmed, or "payment not
 * confirmed yet" while it's still pending.)
 *
 * Reachable two ways:
 *  1. Standalone, for someone who's stuck at "Account not verified"
 *     with no other context - starts at the 'request' stage and asks
 *     for a phone number first.
 *  2. Handed off directly from Login.jsx, which already confirmed the
 *     password was correct and already knows the accountId - in that
 *     case we skip straight to 'enter-otp' with everything prefilled,
 *     no extra step required. This is what fixes the old "no matching
 *     account found" bug: accountId is never missing anymore because
 *     it always comes from a source that actually looked the account
 *     up, rather than being (optionally) filled in by a resend call
 *     someone could skip.
 */
export default function VerifyAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const handoff = location.state || {};

  const [phone, setPhone] = useState(handoff.phone || '');
  const [otp, setOtp] = useState('');
  const [accountId, setAccountId] = useState(handoff.accountId || null);
  const [stage, setStage] = useState(handoff.stage === 'enter-otp' && handoff.accountId ? 'enter-otp' : 'request');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(handoff.message || '');
  const [error, setError] = useState('');
  // Codes are only ever emailed - see sendEmail() in auth.controller.js
  // (there is no SMS delivery path for OTPs). Filled in from the
  // resend response so the copy below never claims a channel that
  // isn't actually being used.
  const [deliveryEmail, setDeliveryEmail] = useState(handoff.email || '');
  const accountType = 'tenant';

  async function handleResend(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.resendOTP({ accountType, phone });
      setAccountId(res.accountId);
      if (res.email) setDeliveryEmail(res.email);
      setMessage(res.email ? `A new code has been sent to ${res.email}.` : 'A new code has been sent to the email on your account.');
      setStage('enter-otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a new code.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.verifyOTP({ accountType, accountId, otp });

      // DIRECT REQUEST FIX ("after verifying, log the user in
      // automatically - don't make them enter their credentials
      // again"): verifyOTP now hands back a real session token, so
      // sign them straight in with it instead of bouncing to /login.
      if (res.token) {
        setMessage('Account verified! Taking you in…');
        clearStaleAccountCaches();
        storeSessionTokens(res.token, res.refreshToken);
        localStorage.setItem('rentapay_role', res.role || accountType);
        localStorage.setItem('rentapay_phone', res.phone || phone);
        if (res.roleLevel) localStorage.setItem('rentapay_role_level', res.roleLevel);
        else localStorage.removeItem('rentapay_role_level');
        localStorage.removeItem('rentapay_active_property_id');

        if (res.mustChangePassword) {
          navigate('/change-password');
          return;
        }
        navigate(res.role === 'landlord' || res.role === 'manager' ? '/dashboard' : '/portal');
        return;
      }

      // Fallback, in case the backend ever responds without a token
      // (e.g. an older deployment) - don't strand the person on a
      // "verified" screen with nowhere to go.
      setMessage('Account verified! You can log in now.');
      setTimeout(() => navigate('/login'), 1200);
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
        <h1>Verify your account</h1>
        <p className="login-page__intro">
          {stage === 'request'
            ? "Didn't get your code, or it expired? Request a new one below."
            : 'Enter the code we just sent you.'}
        </p>

        {error && (
          <div className="login-page__error" role="alert">
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        )}
        {message && !error && (
          <div className="login-page__error" role="status" style={{ background: '#EAF4E8', color: '#2D7D27' }}>
            <p>{message}</p>
          </div>
        )}

        {stage === 'request' ? (
          <form onSubmit={handleResend}>
            <div className="form-field">
              <label className="form-field__label" htmlFor="phone">Phone number on your account</label>
              <input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
            </div>
            <p className="tenant-portal-hint" style={{ margin: '-8px 0 12px' }}>We'll email your code to the address on file.</p>
            <Button type="submit" variant="primary" loading={loading}>Send verification code</Button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            {deliveryEmail ? (
              <p className="tenant-portal-hint" style={{ marginBottom: 12 }}>Code sent to {deliveryEmail}</p>
            ) : (
              <p className="tenant-portal-hint" style={{ marginBottom: 12 }}>Check the email on your account for your code.</p>
            )}
            <div className="form-field">
              <label className="form-field__label" htmlFor="otp">Verification code</label>
              <input id="otp" required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" loading={loading}>Verify</Button>
            <button type="button" className="login-page__resend-link" onClick={handleResend} disabled={loading}>
              Didn't see the code? Resend
            </button>
          </form>
        )}

        <p className="login-page__signup">
          <a href="/login">Back to login</a>
        </p>
      </div>
    </div>
  );
}
