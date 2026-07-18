import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import HelpButton from '../components/HelpButton.jsx';
import Faq from '../components/Faq.jsx';
import { api, ApiError } from '../api/client.js';
import { isBiometricSupported, listBiometricEntries, unlockWithBiometric } from '../utils/biometricAuth.js';
import './Login.css';

/**
 * Maps an ApiError to copy a non-technical person can act on.
 * Kept as a pure function (not inline JSX) so it's easy to unit test
 * and so Login.jsx doesn't accumulate a wall of nested ternaries.
 */
function describeError(err) {
  if (!(err instanceof ApiError)) {
    return { title: 'Something went wrong', detail: err?.message || 'An unknown error occurred.' };
  }

  switch (err.kind) {
    case 'network':
      return {
        title: 'Can\u2019t reach the server',
        detail: 'Please check your internet connection and try again. If the problem continues, contact RentaPay support.',
      };
    case 'parse':
      return {
        title: 'Something went wrong',
        detail: 'The server sent back an unexpected response. Please try again, and contact RentaPay support if this keeps happening.',
      };
    case 'http':
      if (err.status === 401) {
        return { title: 'Incorrect phone number or password', detail: 'Double check both fields and try again.' };
      }
      if (err.status === 403) {
        return { title: 'Account suspended', detail: err.message };
      }
      if (err.status === 423) {
        return { title: 'Account temporarily locked', detail: err.message };
      }
      if (err.status === 503) {
        return { title: 'Platform temporarily unavailable', detail: err.message, action: 'lockdown' };
      }
      if (err.status >= 500) {
        return { title: 'Server error', detail: 'Something went wrong on our end. Please try again shortly.' };
      }
      return { title: 'Login failed', detail: err.message };
    default:
      return { title: 'Login failed', detail: err.message };
  }
}

export default function Login() {
  const navigate = useNavigate();
  // Caretaker is shown as its own tab for clarity (matches how
  // landlords think about their team), but logs in exactly like a
  // Property Manager underneath - both are property_managers rows,
  // the backend tells them apart via role_level after login.
  const [accountType, setAccountType] = useState('landlord'); // 'landlord' | 'manager' | 'tenant' (caretaker also sends 'manager')
  // Display-only - both tabs submit accountType='manager', this just
  // controls which of the two looks highlighted.
  const [managerTabShown, setManagerTabShown] = useState('manager'); // 'manager' | 'caretaker'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [showFaq, setShowFaq] = useState(false);
  const [biometricEntries, setBiometricEntries] = useState([]);
  const [biometricBusy, setBiometricBusy] = useState(false);

  React.useEffect(() => {
    if (isBiometricSupported()) setBiometricEntries(listBiometricEntries());
  }, []);

  // Which enrolled fingerprint entries (if any) apply to the tab the
  // person currently has selected. A "manager" tab entry only counts
  // for the currently-shown manager sub-tab (Property Manager vs
  // Caretaker) - same distinction the password login already enforces.
  const matchingBiometricEntries = React.useMemo(() => {
    return biometricEntries.filter((e) => {
      if (e.role !== accountType) return false;
      if (accountType === 'manager') return (e.roleLevel || 'manager') === managerTabShown;
      return true;
    });
  }, [biometricEntries, accountType, managerTabShown]);

  async function handleBiometricLogin({ silent = false } = {}) {
    setErrorInfo(null);
    setBiometricBusy(true);
    try {
      const entry = await unlockWithBiometric();
      // Auto-fill the phone field regardless of outcome, so if
      // anything below fails the person isn't staring at a blank form.
      if (entry.phone) setPhone(entry.phone);

      // FIX ("fingerprint login flickers back to the login screen
      // after a few seconds during a lockdown"): this used to release
      // the stored token and navigate straight to /dashboard or
      // /portal without asking the backend anything first. Password
      // login already checks lockdown/account-suspension INSIDE
      // login() before a token is ever handed back; biometric login
      // skipped that entirely, so a locked-down platform (or a
      // revoked/suspended account whose old token still sits in this
      // device's vault) only surfaced once the dashboard's first data
      // fetch failed a moment later - which is exactly what looked
      // like a flicker. session-check runs the same verifyToken
      // middleware every other authenticated route uses, so any
      // lockdown/suspension/expired-token failure is caught HERE and
      // shown with the same banner the password path uses, before
      // ever navigating anywhere.
      await api.sessionCheck(entry.token);

      sessionStorage.setItem('rentapay_token', entry.token);
      sessionStorage.setItem('rentapay_role', entry.role);
      if (entry.phone) sessionStorage.setItem('rentapay_phone', entry.phone);
      if (entry.roleLevel) sessionStorage.setItem('rentapay_role_level', entry.roleLevel);
      else sessionStorage.removeItem('rentapay_role_level');
      // Same reasoning as the password-login path above: a fresh
      // login should never carry forward an apartment id remembered
      // from whatever account last used this browser.
      sessionStorage.removeItem('rentapay_active_property_id');
      navigate(entry.role === 'landlord' || entry.role === 'manager' ? '/dashboard' : '/portal');
    } catch (err) {
      // A silent (auto-triggered) attempt that the person simply didn't
      // respond to, or that the browser blocked, should never show a
      // scary error banner before they've done anything - they just
      // fall through to the normal phone/password form below.
      //
      // A lockdown, however, should ALWAYS be shown even on a silent
      // attempt - it's not something the person can "just try again"
      // past, and staying silent about it is exactly the confusing
      // bounce-back behavior this fix exists to remove.
      if (!silent || (err instanceof ApiError && err.lockedDown)) {
        setErrorInfo(
          err instanceof ApiError && err.lockedDown
            ? describeError(err)
            : { title: 'Fingerprint login failed', detail: err.message || 'Please log in with your phone number and password instead.' }
        );
      }
    } finally {
      setBiometricBusy(false);
    }
  }

  // AUTO-TRIGGER: the whole point of fingerprint login is that a
  // returning person shouldn't have to tap anything extra to kick off
  // the sensor prompt - land on the tab that matches their enrolled
  // device and the OS prompt should pop up on its own. Fires once per
  // tab selection (not on every re-render) and only when there's
  // exactly one matching enrollment, so it's never guessing between
  // two different accounts on the same device/role.
  const autoPromptedForRef = React.useRef(null);
  React.useEffect(() => {
    const tabKey = accountType === 'manager' ? `manager:${managerTabShown}` : accountType;
    if (autoPromptedForRef.current === tabKey) return;
    if (matchingBiometricEntries.length !== 1) return;
    autoPromptedForRef.current = tabKey;
    handleBiometricLogin({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType, managerTabShown, matchingBiometricEntries]);

  // FIX ("when I delete a landlord/manager/tenant, they should be
  // logged out immediately and shown a message, not just silently
  // unable to log back in"): the backend's live account-status check
  // (auth.middleware.js) rejects their very next request with a
  // specific message and stores it in sessionStorage right before
  // bouncing here; surface it once, then clear it so it doesn't
  // reappear on a normal future logout.
  React.useEffect(() => {
    const msg = sessionStorage.getItem('rentapay_logout_message');
    if (msg) {
      setErrorInfo({ title: 'You have been logged out', detail: msg });
      sessionStorage.removeItem('rentapay_logout_message');
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorInfo(null);
    setLoading(true);

    try {
      const res = await api.login({ accountType, phone, password });

      // FIX: an unverified account used to come back as a plain 403
      // with no way to get to the OTP screen with a usable accountId
      // (verify-account.jsx required a separate "resend" step just to
      // learn it, and skipping that step is exactly what caused "no
      // matching account found" when someone pasted in the OTP they'd
      // already been texted). The backend now sends the OTP itself
      // and hands back everything the OTP screen needs directly.
      if (res.needsVerification) {
        navigate('/verify-account', {
          state: { accountType: res.accountType, accountId: res.accountId, phone: res.phone, stage: 'enter-otp', message: res.message },
        });
        return;
      }

      // Token storage: kept in memory + sessionStorage rather than
      // localStorage, since this is a financial app and we'd rather
      // the session not silently persist forever on a shared machine.
      sessionStorage.setItem('rentapay_token', res.token);
      sessionStorage.setItem('rentapay_role', res.role);
      sessionStorage.setItem('rentapay_phone', phone);
      // FIX ("a manager/caretaker granted access to a non-primary
      // apartment gets told they don't have access, instead of being
      // dropped straight into the apartment they DO have access to"):
      // this key remembers which apartment the dashboard was last
      // showing so a reload doesn't reset to the first one - but it
      // was never cleared between logins, so a browser that last
      // showed some OTHER apartment (the landlord's own default one,
      // a different manager's assignment, an old session) would carry
      // that id straight into this brand new login and get rejected
      // by the backend's assignment check before the "just pick my
      // first assigned property" fallback ever got a chance to run.
      // A fresh login should always start from a clean slate.
      sessionStorage.removeItem('rentapay_active_property_id');
      // FIX: nothing used to persist whether a logged-in manager
      // account was actually a full Property Manager or a limited
      // Caretaker - the frontend had no way to tell them apart after
      // login, so caretaker-only restrictions (hide the Property
      // Managers settings section, block rent edits, etc.) couldn't be
      // enforced client-side at all.
      if (res.roleLevel) sessionStorage.setItem('rentapay_role_level', res.roleLevel);
      else sessionStorage.removeItem('rentapay_role_level');

      // Persistent "renew now" banner support: an expired subscription
      // no longer blocks login (see auth.controller.js) - it just
      // needs to be visible everywhere until the landlord renews.
      if (res.subscriptionExpired) sessionStorage.setItem('rentapay_subscription_expired', 'true');
      else sessionStorage.removeItem('rentapay_subscription_expired');

      // FIX ("caretaker logs in with the Property Manager tab selected,
      // or vice versa, and it just... works"): accountType='manager' is
      // shared by both tabs, so the backend alone can't tell which tab
      // the person actually clicked - it only knows the real roleLevel
      // once credentials check out. Enforce the match here: if they
      // picked the wrong one of the two manager tabs for who they
      // actually are, treat it exactly like a failed login rather than
      // quietly letting them in under the wrong tab.
      if (accountType === 'manager' && res.roleLevel && res.roleLevel !== managerTabShown) {
        setErrorInfo({
          title: 'Wrong tab for this account',
          detail: `Please try the ${res.roleLevel === 'caretaker' ? 'Caretaker' : 'Property Manager'} tab instead.`,
        });
        setLoading(false);
        return;
      }

      if (res.mustChangePassword) {
        navigate('/change-password');
        return;
      }

      if (res.role === 'landlord' && !res.setupWizardComplete) {
        navigate('/register'); // resume setup wizard
        return;
      }

      // Property managers use the same portal as the landlord who
      // added them (scoped to that landlord's data) - never the
      // tenant portal.
      navigate(res.role === 'landlord' || res.role === 'manager' ? '/dashboard' : '/portal');
    } catch (err) {
      setErrorInfo(describeError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">RentaPay</div>
        <h1>Welcome back</h1>
        <p className="login-page__intro">Log in to manage your property, or view your account and pay rent.</p>

        <div className="login-page__toggle" role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            aria-selected={accountType === 'landlord'}
            className={accountType === 'landlord' ? 'is-active' : ''}
            onClick={() => setAccountType('landlord')}
          >
            Landlord
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={accountType === 'manager' && managerTabShown === 'manager'}
            className={accountType === 'manager' && managerTabShown === 'manager' ? 'is-active' : ''}
            onClick={() => { setAccountType('manager'); setManagerTabShown('manager'); }}
          >
            Property Manager
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={accountType === 'manager' && managerTabShown === 'caretaker'}
            className={accountType === 'manager' && managerTabShown === 'caretaker' ? 'is-active' : ''}
            onClick={() => { setAccountType('manager'); setManagerTabShown('caretaker'); }}
          >
            Caretaker
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={accountType === 'tenant'}
            className={accountType === 'tenant' ? 'is-active' : ''}
            onClick={() => setAccountType('tenant')}
          >
            Tenant
          </button>
        </div>

        {errorInfo && errorInfo.action === 'lockdown' ? (
          <div className="login-page__lockdown-banner" role="alert">
            <span className="login-page__lockdown-icon">⚠</span>
            <strong>Platform Temporarily Unavailable</strong>
            <p>{errorInfo.detail}</p>
          </div>
        ) : errorInfo && (
          <div className="login-page__error" role="alert">
            <strong>{errorInfo.title}</strong>
            <p>{errorInfo.detail}</p>
            {errorInfo.action === 'verify' && (
              <a href="/verify-account" className="login-page__resend-link">Verify your account now →</a>
            )}
          </div>
        )}

        {matchingBiometricEntries.length > 0 && (
          <div className="login-page__biometric" role="group" aria-label="Fingerprint login">
            <button
              type="button"
              className="login-page__biometric-btn"
              onClick={() => handleBiometricLogin({ silent: false })}
              disabled={biometricBusy}
            >
              <span className="login-page__biometric-icon" aria-hidden="true">👆</span>
              {biometricBusy ? 'Waiting for fingerprint…' : 'Log in with fingerprint'}
            </button>
            <p className="login-page__biometric-hint">
              {biometricBusy ? 'Touch the sensor on this device to continue.' : `Fingerprint login is set up on this device for this ${managerTabShown === 'caretaker' ? 'caretaker' : accountType} account.`}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-field__label" htmlFor="phone">Phone number</label>
            <input
              id="phone"
              required
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="2547XXXXXXXX"
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <p style={{ textAlign: 'right', margin: '0 0 var(--space-4) 0' }}>
            <Link to="/forgot-password" className="login-page__resend-link" style={{ display: 'inline', marginTop: 0 }}>
              Forgot password?
            </Link>
          </p>

          <Button type="submit" variant="primary" loading={loading}>
            Log in
          </Button>
        </form>

        <p className="login-page__signup">
          Don&apos;t have an account? <Link to="/register">Sign up as a landlord</Link>
        </p>

        <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
          <HelpButton renderAs="login-page__help-link" />
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <button
            type="button"
            className="ghost-link"
            style={{ display: 'block', margin: '0 auto' }}
            onClick={() => setShowFaq((v) => !v)}
          >
            {showFaq ? 'Hide FAQs ▲' : 'Frequently asked questions ▼'}
          </button>
          {showFaq && <Faq audience="guest" />}
        </div>

        {/* Intentionally no admin login link/button here.
            Admin access lives at a separate, unlinked route
            (see App.jsx) per blueprint 13.3: "Secret Admin URL —
            hidden URL, not linked anywhere on platform." */}

        <p style={{ marginTop: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--text-xs)' }}>
          <Link to="/terms" className="ghost-link">Terms of Service</Link>
          {' · '}
          <Link to="/privacy" className="ghost-link">Privacy Policy</Link>
          {' · '}
          <Link to="/status" className="ghost-link">System Status</Link>
        </p>
      </div>
    </div>
  );
}
