import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import { api, ApiError } from '../api/client.js';
import './Login.css';

// Phase 4 step 1: the dedicated public /scout route - "Are you a
// Scout? Sign up" next to the normal login form. Sign-up here is
// deliberately just fullName + phone + password; OTP verify happens
// next (handed off to the existing VerifyAccount.jsx page, exactly
// like landlord/tenant registration already does), and county
// selection + payment happens AFTER that, once the Scout can log in -
// see ScoutPortal.jsx.
export default function ScoutSignup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.registerScout({ fullName, phone, password });
      // Hand off to the shared OTP-verify screen with everything it
      // needs prefilled, same pattern Login.jsx uses for an unverified
      // account - no separate Scout-specific OTP page needed.
      navigate('/verify-account', {
        state: { accountType: 'scout', accountId: res.accountId, phone: res.phone, stage: 'enter-otp', message: res.message },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay Scout</div>
        <h1>Sign up as a Scout</h1>
        <p className="login-page__intro">
          Hunt vacant units, subscribe to the counties you work in, and earn a fee for every renter you place -
          all through the platform, with no phone numbers handed out.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="fullName">Full name</label>
            <input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="phone">Phone number</label>
            <input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="password">Password</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="login-page__error" role="alert">{error}</p>}
          <Button type="submit" variant="primary" loading={loading} fullWidth>
            Continue
          </Button>
        </form>

        <p className="login-page__signup">
          Already have a Scout account? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}
