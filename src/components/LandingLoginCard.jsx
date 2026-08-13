import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from './Button.jsx';
import PasswordInput from './PasswordInput.jsx';
import { api, ApiError } from '../api/client.js';
import LockoutCountdown from './LockoutCountdown.jsx';
import './LandingLoginCard.css';

/**
 * DIRECT REQUEST: a visible, easily-spotted login form right on the
 * landing page itself - not just a "Log in" link that takes someone
 * to a separate /login page. Sits in the hero, next to the headline,
 * so a returning user can log in without any extra navigation.
 *
 * Deliberately a lean subset of Login.jsx's full flow (no biometric
 * unlock, no Google button, no fingerprint-tip logic) - this card's
 * job is the common case: email/phone + password, in and out fast.
 * Anything that needs more UI than a plain success/redirect - the
 * multi-account picker, or a not-yet-verified account - hands off to
 * the full /login page (prefilling what was already typed here)
 * rather than duplicating that machinery in miniature.
 */
export default function LandingLoginCard() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState(null);

  function describeError(err) {
    if (!(err instanceof ApiError)) return 'Something went wrong. Please try again.';
    if (err.kind === 'network') return 'Can\u2019t reach the server. Check your connection and try again.';
    if (err.kind === 'http' && err.status === 401) return 'Incorrect email/phone or password.';
    if (err.kind === 'http' && err.status === 423) return null; // rendered via LockoutCountdown instead
    return err.message || 'Login failed. Please try again.';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLockedUntil(null);
    setLoading(true);
    try {
      const res = await api.login({ email: identifier, password });

      if (res.needsAccountPicker || res.needsVerification || res.paymentPending) {
        // Cases with extra steps/UI beyond a plain redirect are
        // handled by the full Login page - hand off there instead of
        // re-implementing the picker/verification/payment-resume UI
        // here too.
        navigate('/login', { state: { prefillIdentifier: identifier } });
        return;
      }

      sessionStorage.setItem('rentapay_token', res.token);
      sessionStorage.setItem('rentapay_role', res.role);
      sessionStorage.setItem('rentapay_phone', res.phone || identifier || '');
      sessionStorage.removeItem('rentapay_active_property_id');
      if (res.roleLevel) sessionStorage.setItem('rentapay_role_level', res.roleLevel);
      else sessionStorage.removeItem('rentapay_role_level');
      if (res.subscriptionExpired) sessionStorage.setItem('rentapay_subscription_expired', 'true');
      else sessionStorage.removeItem('rentapay_subscription_expired');

      if (res.mustChangePassword) {
        navigate('/change-password');
        return;
      }
      if (res.role === 'landlord' && !res.setupWizardComplete) {
        navigate('/register');
        return;
      }
      if (res.role === 'brand_ambassador') {
        navigate('/ba-portal');
        return;
      }
      navigate(res.role === 'landlord' || res.role === 'manager' ? '/dashboard' : '/portal');
    } catch (err) {
      if (err instanceof ApiError && err.status === 423 && err.raw?.lockedUntil) {
        setLockedUntil(err.raw.lockedUntil);
      } else {
        setError(describeError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing-login-card" id="login">
      <h2 className="landing-login-card__title">Log in</h2>
      <form onSubmit={handleSubmit} className="landing-login-card__form">
        <div className="form-field">
          <label className="form-field__label" htmlFor="landingLoginIdentifier">Email or phone</label>
          <input
            id="landingLoginIdentifier"
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@example.com or 07XXXXXXXX"
          />
        </div>
        <div className="form-field">
          <label className="form-field__label" htmlFor="landingLoginPassword">Password</label>
          <PasswordInput
            id="landingLoginPassword"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="landing-login-card__error" role="alert">{error}</p>}
        {lockedUntil && (
          <p className="landing-login-card__error" role="alert">
            <LockoutCountdown until={lockedUntil} onExpire={() => setLockedUntil(null)} />
          </p>
        )}
        <Button type="submit" variant="primary" loading={loading} fullWidth>
          Log in
        </Button>
      </form>
      <p className="landing-login-card__footer">
        New to RentaPay? <Link to="/register">Get started</Link>
      </p>
    </div>
  );
}
