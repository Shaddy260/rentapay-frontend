import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import HelpButton from '../components/HelpButton.jsx';
import Faq from '../components/Faq.jsx';
import InstallAppBanner from '../components/InstallAppBanner.jsx';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
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
        return { title: 'Incorrect phone/email or password', detail: 'Double check both fields and try again.' };
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

// Login now accepts either a phone number or an email address in the
// same field (email is mandatory on every account, so it's always a
// valid way to sign in, alongside the phone number people are used
// to). Detected purely by shape - an '@' means it's an email, anything
// else is treated as a phone number - so there's no separate toggle
// for the person to think about.
function isEmailLike(value) {
  return typeof value === 'string' && value.includes('@');
}

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [showFaq, setShowFaq] = useState(false);
  const [biometricEntries, setBiometricEntries] = useState([]);
  const [biometricBusy, setBiometricBusy] = useState(false);
  // LOGIN UNIFICATION: role is auto-detected from the phone number by
  // the backend now - there's no tab to pick it from anymore. This
  // only ever gets set in the rare dual-role case (e.g. someone who is
  // both a landlord and a property manager on the same number), when the backend
  // can't tell which account they meant and asks. `null` = no picker
  // showing; otherwise the list of { accountType, id, label } options
  // the backend returned.
  const [accountPickerOptions, setAccountPickerOptions] = useState(null);
  // Which flow produced the current account-picker options, so
  // "Continue as X" re-submits through the right endpoint (password
  // login needs the password again; Google login just needs the same
  // ID token re-sent with accountType attached).
  const [pickerSource, setPickerSource] = useState('password'); // 'password' | 'google'
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState(null);
  const [googleError, setGoogleError] = useState('');

  React.useEffect(() => {
    if (isBiometricSupported()) setBiometricEntries(listBiometricEntries());
  }, []);

  // Fingerprint entries are stored per-device with whichever role they
  // were enrolled under. Since there's no tab to filter by anymore,
  // every enrolled entry on this device is a candidate - if there's
  // more than one, the person just gets more than one fingerprint
  // button (rare: it means this device has biometric login set up for
  // more than one account).
  const matchingBiometricEntries = biometricEntries;

  async function handleBiometricLogin({ silent = false } = {}) {
    setErrorInfo(null);
    setBiometricBusy(true);
    try {
      const entry = await unlockWithBiometric();
      // Auto-fill the identifier field regardless of outcome, so if
      // anything below fails the person isn't staring at a blank form.
      if (entry.phone) setIdentifier(entry.phone);

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
            : { title: 'Fingerprint login failed', detail: err.message || 'Please log in with your phone number/email and password instead.' }
        );
      }
    } finally {
      setBiometricBusy(false);
    }
  }

  // AUTO-TRIGGER: the whole point of fingerprint login is that a
  // returning person shouldn't have to tap anything extra to kick off
  // the sensor prompt - it should pop up on its own on page load. Only
  // fires once, and only when there's exactly one enrolled entry on
  // this device, so it's never guessing between two different accounts.
  const autoPromptedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoPromptedRef.current) return;
    if (matchingBiometricEntries.length !== 1) return;
    autoPromptedRef.current = true;
    handleBiometricLogin({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingBiometricEntries]);

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

  // Same handoff pattern as the logout message above, but for
  // neutral/positive notices (e.g. RegisterFlow sending someone here
  // after their subscription payment was confirmed) that shouldn't be
  // styled or titled like a forced-logout error.
  React.useEffect(() => {
    const msg = sessionStorage.getItem('rentapay_info_message');
    if (msg) {
      setInfoMessage(msg);
      sessionStorage.removeItem('rentapay_info_message');
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorInfo(null);
    setLoading(true);
    await performLogin();
  }

  // Shared by password login, its account-picker re-submit, and Google
  // login - every one of these ends up with the same shape of backend
  // response (token+role, needsAccountPicker, needsVerification,
  // paymentPending), so the "what do we do with it" logic only needs
  // to exist once.
  function handleLoginResponse(res, { fallbackIdentifier } = {}) {
    if (res.needsAccountPicker) {
      setAccountPickerOptions(res.options);
      setLoading(false);
      return;
    }
    setAccountPickerOptions(null);

    if (res.needsVerification) {
      navigate('/verify-account', {
        state: { accountType: res.accountType, accountId: res.accountId, phone: res.phone, email: res.email, stage: 'enter-otp', message: res.message },
      });
      return;
    }

    if (res.paymentPending) {
      try {
        sessionStorage.setItem(
          'rentapay_register_progress',
          JSON.stringify({
            stepIndex: 1,
            landlordId: res.landlordId,
            checkoutRequestId: res.checkoutRequestId,
            amountDue: res.amountDue,
            defaultPropertyId: null,
            resumedFromLogin: true,
            form: { fullName: '', phone: res.phone || '', email: '', unitsCount: 5, periodMonths: 1 },
          })
        );
      } catch {
        // sessionStorage unavailable - RegisterFlow will just start
        // from step 0 instead of resuming exactly at the payment
        // screen, which is a reasonable degradation.
      }
      navigate('/register');
      return;
    }

    sessionStorage.setItem('rentapay_token', res.token);
    sessionStorage.setItem('rentapay_role', res.role);
    sessionStorage.setItem('rentapay_phone', res.phone || fallbackIdentifier || '');
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
      navigate('/register'); // resume setup wizard
      return;
    }

    navigate(res.role === 'landlord' || res.role === 'manager' ? '/dashboard' : '/portal');
  }

  // Shared by the normal submit and by the account-picker re-submit
  // (which attaches accountType to resolve the dual-role case).
  async function performLogin(pickedAccountType) {
    try {
      const credentialField = isEmailLike(identifier) ? { email: identifier } : { phone: identifier };
      const res = await api.login(pickedAccountType ? { accountType: pickedAccountType, ...credentialField, password } : { ...credentialField, password });
      setPickerSource('password');
      handleLoginResponse(res, { fallbackIdentifier: identifier });
    } catch (err) {
      setErrorInfo(describeError(err));
    } finally {
      setLoading(false);
    }
  }

  // FEATURE (item 2: "Google / Facebook login"). GoogleSignInButton
  // hands back a signed Google ID token the moment someone completes
  // Google's own sign-in flow; this just forwards it to the backend
  // (which does the actual verification) and reuses the exact same
  // post-login handling as password login. `pickedAccountType` is only
  // ever passed on the dual-role re-submit below.
  async function performGoogleLogin(idToken, pickedAccountType) {
    setErrorInfo(null);
    setGoogleError('');
    setLoading(true);
    setPendingGoogleIdToken(idToken);
    try {
      const res = await api.loginWithGoogle(pickedAccountType ? { idToken, accountType: pickedAccountType } : { idToken });
      setPickerSource('google');
      handleLoginResponse(res);
    } catch (err) {
      setErrorInfo(describeError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleAccountPick(option) {
    setLoading(true);
    setErrorInfo(null);
    if (pickerSource === 'google' && pendingGoogleIdToken) {
      performGoogleLogin(pendingGoogleIdToken, option.accountType);
    } else {
      performLogin(option.accountType);
    }
  }

  return (
    <div className="login-page">
      <InstallAppBanner />

      <div className="login-page__hero" aria-hidden="true">
        <div className="login-page__hero-blob login-page__hero-blob--a" />
        <div className="login-page__hero-blob login-page__hero-blob--b" />
        <div className="login-page__hero-content">
          <div className="login-page__hero-brand">RentaPay</div>
          <h2 className="login-page__hero-title">Management made simple.</h2>
          <p className="login-page__hero-tagline">
            The easiest way for Kenyan landlords and tenants to manage rent,
            payments, and everything in between — all in one place.
          </p>
          <ul className="login-page__hero-points">
            <li>
              <span className="login-page__hero-point-icon">💳</span>
              <span>Collect rent instantly via M-Pesa</span>
            </li>
            <li>
              <span className="login-page__hero-point-icon">🏠</span>
              <span>Manage every property from one dashboard</span>
            </li>
            <li>
              <span className="login-page__hero-point-icon">🔒</span>
              <span>Bank-grade security for every transaction</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="login-page__panel">
        <div className="login-page__brand login-page__brand--mobile">RentaPay</div>
        <h1>Welcome back</h1>
        <p className="login-page__intro">Log in to manage your property, or view your account and pay rent.</p>

        {infoMessage && (
          <div className="login-page__error" role="status" style={{ background: '#EAF4E8', color: '#2D7D27' }}>
            <p>{infoMessage}</p>
          </div>
        )}

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

        {matchingBiometricEntries.length > 0 && !accountPickerOptions && (
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
              {biometricBusy ? 'Touch the sensor on this device to continue.' : 'Fingerprint login is set up on this device.'}
            </p>
          </div>
        )}

        {/* Dual-role account picker: only ever shown when this
            phone/email + password matched more than one account type.
            Everyone else never sees this - login just goes straight through. */}
        {accountPickerOptions && (
          <div className="login-page__account-picker" role="group" aria-label="Choose which account to log into">
            <p className="login-page__intro" style={{ marginBottom: 'var(--space-3)' }}>
              This has more than one RentaPay account. Which one would you like to log into?
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

        {!accountPickerOptions && (
        <>
        <div className="login-page__oauth">
          <GoogleSignInButton
            onCredential={(idToken) => performGoogleLogin(idToken)}
            onError={(msg) => setGoogleError(msg)}
          />
          {googleError && <p className="login-page__oauth-error">{googleError}</p>}
        </div>

        <div className="login-page__divider">
          <span>or log in with phone/email</span>
        </div>
        </>
        )}

        {!accountPickerOptions && (
        <form onSubmit={handleSubmit}>
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
          <div className="form-field">
            <label className="form-field__label" htmlFor="password">Password</label>
            <PasswordInput
              id="password"
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
        )}

        <p className="login-page__signup">
          Don&apos;t have an account? <Link to="/register">Sign up as a landlord</Link>
        </p>
        <p className="login-page__signup">
          Looking for a vacant unit? <Link to="/find-a-house">Browse listings</Link> — free, no account needed.
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
