import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
import './Login.css';

/**
 * OTP verification/resend page - for tenant/scout accounts only.
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

  const [accountType, setAccountType] = useState(handoff.accountType && handoff.accountType !== 'landlord' ? handoff.accountType : 'tenant');
  const [phone, setPhone] = useState(handoff.phone || '');
  const [otp, setOtp] = useState('');
  const [accountId, setAccountId] = useState(handoff.accountId || null);
  const [stage, setStage] = useState(handoff.stage === 'enter-otp' && handoff.accountId ? 'enter-otp' : 'request');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(handoff.message || '');
  const [error, setError] = useState('');

  async function handleResend(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await api.resendOTP({ accountType, phone });
      setAccountId(res.accountId);
      setMessage('A new code has been sent to your phone (and email, if you provided one).');
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
      await api.verifyOTP({ accountType, accountId, otp });
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

        <div className="login-page__toggle" role="tablist" aria-label="Account type" style={handoff.accountId ? { display: 'none' } : undefined}>
          <button type="button" role="tab" aria-selected={accountType === 'tenant'} className={accountType === 'tenant' ? 'is-active' : ''} onClick={() => setAccountType('tenant')}>
            Tenant
          </button>
          <button type="button" role="tab" aria-selected={accountType === 'scout'} className={accountType === 'scout' ? 'is-active' : ''} onClick={() => setAccountType('scout')}>
            Scout
          </button>
        </div>

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
              <label className="form-field__label" htmlFor="phone">Phone number</label>
              <input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
            </div>
            <Button type="submit" variant="primary" loading={loading}>Send verification code</Button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            {phone && <p className="tenant-portal-hint" style={{ marginBottom: 12 }}>Code sent to {phone}</p>}
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
