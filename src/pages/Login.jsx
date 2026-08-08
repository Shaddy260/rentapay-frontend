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
import { isStandalone } from '../utils/useInstallPrompt.js';
import './Login.css';

function describeError(err) {
  if (!(err instanceof ApiError)) {
    return { title: 'Something went wrong', detail: 'Please try again. If this keeps happening, contact RentaPay support.' };
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
        return { title: 'Incorrect email or password', detail: 'Double check both fields and try again.' };
      }
      if (err.status === 403) {
        if (err.raw?.subscriptionUnavailable) {
          return { title: 'RentaPay temporarily unavailable', detail: err.message };
        }
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
  const [identifier, setIdentifier] = useState(() => {
    try {
      return localStorage.getItem('rentapay_remembered_email') || '';
    } catch {
      return '';
    }
  });
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !!localStorage.getItem('rentapay_remembered_email');
    } catch {
      return false;
    }
  });
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [infoMessage, setInfoMessage] = useState('');
  const [showFaq, setShowFaq] = useState(false);
  const [biometricEntries, setBiometricEntries] = useState([]);
  const [biometricBusy, setBiometricBusy] = useState(false);
  // Section 3 (Login - Fingerprint Icon): discoverability tooltip that
  // shows only the first time this device has the fingerprint control
  // available to it - a plain localStorage flag remembers it's been
  // seen so it doesn't nag on every visit.
  const [showFingerprintTip, setShowFingerprintTip] = useState(false);
  const [accountPickerOptions, setAccountPickerOptions] = useState(null);
  const [pickerSource, setPickerSource] = useState('password');
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState(null);
  const [googleError, setGoogleError] = useState('');

  React.useEffect(() => {
    // DIRECT REQUEST: fingerprint login should only ever be offered
    // when RentaPay is actually running as the installed app
    // (standalone display mode) - not in a regular browser tab, even
    // if this device happens to have a biometric entry saved from a
    // time it WAS installed (e.g. someone opened the site directly in
    // Chrome later). isBiometricSupported() only checks whether the
    // device/browser has WebAuthn platform-authenticator support at
    // all - it says nothing about install state, so that check alone
    // isn't enough here.
    if (isBiometricSupported() && isStandalone()) setBiometricEntries(listBiometricEntries());
  }, []);

  // Once we know the fingerprint control is actually available on this
  // device (see effect above), show the "Use fingerprint" tooltip if
  // it hasn't been seen here before. Separate effect because
  // biometricEntries only becomes available asynchronously-ish above.
  React.useEffect(() => {
    if (biometricEntries.length === 0) return;
    try {
      if (localStorage.getItem('rentapay_fingerprint_tip_seen') === '1') return;
    } catch {
      // localStorage unavailable - fall through and show it once for
      // this session rather than silently never showing it at all.
    }
    setShowFingerprintTip(true);
  }, [biometricEntries]);

  // Auto-dismiss after a few seconds so the bubble doesn't linger
  // forever if the person never interacts with the control at all.
  React.useEffect(() => {
    if (!showFingerprintTip) return;
    const timer = setTimeout(() => dismissFingerprintTip(), 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFingerprintTip]);

  function dismissFingerprintTip() {
    setShowFingerprintTip(false);
    try {
      localStorage.setItem('rentapay_fingerprint_tip_seen', '1');
    } catch {
      // non-fatal - worst case the tip reappears next visit
    }
  }

  // Ask for location permission once, the first time the installed
  // app is opened - rather than waiting for a specific feature
  // (address search, nearby listings, etc.) to lazily trigger it deep
  // into the app. Only fires inside the installed app (isStandalone),
  // only once ever per device (localStorage flag), and is a silent
  // fire-and-forget - the actual coordinates aren't used here, this
  // call exists purely to surface the OS permission prompt early.
  React.useEffect(() => {
    if (!isStandalone()) return;
    if (!('geolocation' in navigator)) return;
    let alreadyAsked = false;
    try {
      alreadyAsked = localStorage.getItem('rentapay_location_permission_asked') === '1';
    } catch { /* non-fatal */ }
    if (alreadyAsked) return;
    try {
      localStorage.setItem('rentapay_location_permission_asked', '1');
    } catch { /* non-fatal */ }
    navigator.geolocation.getCurrentPosition(
      () => {},
      () => {},
      { timeout: 8000 }
    );
  }, []);

  const matchingBiometricEntries = biometricEntries;

  async function handleBiometricLogin({ silent = false } = {}) {
    setErrorInfo(null);
    setBiometricBusy(true);
    dismissFingerprintTip();
    try {
      const entry = await unlockWithBiometric();
      if (entry.phone) setIdentifier(entry.phone);

      await api.sessionCheck(entry.token);

      sessionStorage.setItem('rentapay_token', entry.token);
      sessionStorage.setItem('rentapay_role', entry.role);
      if (entry.phone) sessionStorage.setItem('rentapay_phone', entry.phone);
      if (entry.roleLevel) sessionStorage.setItem('rentapay_role_level', entry.roleLevel);
      else sessionStorage.removeItem('rentapay_role_level');
      sessionStorage.removeItem('rentapay_active_property_id');
      navigate(entry.role === 'landlord' || entry.role === 'manager' ? '/dashboard' : '/portal');
    } catch (err) {
      if (!silent || (err instanceof ApiError && err.lockedDown)) {
        setErrorInfo(
          err instanceof ApiError && err.lockedDown
            ? describeError(err)
            : { title: 'Fingerprint login failed', detail: 'Please log in with your email and password instead.' }
        );
      }
    } finally {
      setBiometricBusy(false);
    }
  }

  const autoPromptedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoPromptedRef.current) return;
    if (matchingBiometricEntries.length !== 1) return;
    autoPromptedRef.current = true;
    handleBiometricLogin({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingBiometricEntries]);

  React.useEffect(() => {
    const msg = sessionStorage.getItem('rentapay_logout_message');
    if (msg) {
      setErrorInfo({ title: 'You have been logged out', detail: msg });
      sessionStorage.removeItem('rentapay_logout_message');
    }
  }, []);

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

  function handleLoginResponse(res, { fallbackIdentifier } = {}) {
    try {
      if (rememberMe && fallbackIdentifier) localStorage.setItem('rentapay_remembered_email', fallbackIdentifier);
      else if (!rememberMe) localStorage.removeItem('rentapay_remembered_email');
    } catch {
      // localStorage unavailable (private browsing etc.) - remember-me is a convenience, not a hard requirement
    }

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
            form: { fullName: '', phone: res.phone || '', email: '', unitsCount: '', periodMonths: '' },
          })
        );
      } catch {
        // sessionStorage unavailable - fall back to step 0
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
      try {
        sessionStorage.setItem('rentapay_resume_setup', 'true');
        // FIX (direct request: "after completing one step and
        // submitted, even if one taps a back UI, next time he logs in
        // it should bring him to his last step"): the backend now
        // works out exactly which setup-wizard step to resume at from
        // real server records (does a property exist? is a payment
        // method already set?) instead of always sending everyone
        // back to the very first wizard step (Property). Stashed here
        // for RegisterFlow.jsx to read on mount, same mechanism it
        // already uses for the resumedFromLogin/paymentPending case
        // above.
        sessionStorage.setItem(
          'rentapay_register_progress',
          JSON.stringify({
            stepIndex: res.setupWizardStep ?? 3,
            landlordId: null,
            defaultPropertyId: res.setupWizardPropertyId || null,
            resumedFromLogin: true,
            form: { fullName: '', phone: res.phone || fallbackIdentifier || '', email: '', unitsCount: '', periodMonths: '' },
          })
        );
      } catch {
        // storage unavailable - RegisterFlow falls back to step 0
      }
      navigate('/register');
      return;
    }

    navigate(res.role === 'landlord' || res.role === 'manager' ? '/dashboard' : '/portal');
  }

  async function performLogin(pickedAccountType) {
    try {
      const res = await api.login(pickedAccountType ? { accountType: pickedAccountType, email: identifier, password } : { email: identifier, password });
      setPickerSource('password');
      handleLoginResponse(res, { fallbackIdentifier: identifier });
    } catch (err) {
      setErrorInfo(describeError(err));
    } finally {
      setLoading(false);
    }
  }

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
          <div className="login-page__hero-brand">
            <img className="login-page__hero-brand-logo" src="/logo.png" alt="" />
            RentaPay
          </div>
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

      <div className="login-page__mobile-banner">
        <img className="login-page__mobile-banner-logo" src="/logo.png" alt="" />
        <div>
          <div className="login-page__mobile-banner-brand">RentaPay</div>
          <div className="login-page__mobile-banner-tag">Rent &amp; property management, made simple</div>
        </div>
      </div>

      <div className="login-page__right">
        <div className="login-page__panel">
          <div className="login-page__brand login-page__brand--mobile">RentaPay</div>

          {/* Block 1: page identity - who this screen is for. */}
          <div className="login-page__block login-page__block--header">
            <div className="login-page__signin-divider">
              <span>Sign in to your account</span>
            </div>

            <h1>Welcome back</h1>
            <p className="login-page__intro">Log in to manage your property, or view your account and pay rent.</p>
          </div>

          {/* Block 2: the actual sign-in action - messages, oauth, and
              the email/password form. Kept visually separate from the
              header above and the secondary links below so the "Log
              in" button reads as the one thing this block asks you to do. */}
          <div className="login-page__block login-page__block--signin">
          {infoMessage && (
            <div className="login-page__error login-page__error--success" role="status">
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

          {accountPickerOptions && (
            <div className="login-page__account-picker" role="group" aria-label="Choose which account to log into">
              <p className="login-page__intro u-mb-3">
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
                  className="u-mb-2"
                >
                  Continue as {opt.label}
                </Button>
              ))}
              <button
                type="button"
                className="login-page__link-btn u-mt-2"
                onClick={() => { setAccountPickerOptions(null); setLoading(false); }}
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
                <span>or log in with email</span>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="identifier">Email address</label>
                  <div className="login-page__input-icon-wrap">
                    <span className="login-page__input-icon" aria-hidden="true">✉</span>
                    <input
                      id="identifier"
                      type="email"
                      required
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com"
                      className="login-page__input-with-icon"
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="password">Password</label>
                  <div className="login-page__input-icon-wrap">
                    <span className="login-page__input-icon" aria-hidden="true">🔒</span>
                    <PasswordInput
                      id="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="login-page__input-with-icon"
                    />
                  </div>
                </div>

                <div className="login-page__remember-forgot-row">
                  <label className="login-page__remember-me">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <Link to="/forgot-password" className="login-page__resend-link login-page__resend-link--inline">
                    Forgot password?
                  </Link>
                </div>

                <div className="login-page__submit-row">
                  {matchingBiometricEntries.length > 0 && (
                    <div className="login-page__fingerprint-wrap">
                      {showFingerprintTip && (
                        <span className="login-page__fingerprint-tip" role="status">
                          Use fingerprint
                        </span>
                      )}
                      <button
                        type="button"
                        className={`login-page__fingerprint-badge${biometricBusy ? ' login-page__fingerprint-badge--busy' : ''}`}
                        onClick={() => handleBiometricLogin({ silent: false })}
                        onFocus={dismissFingerprintTip}
                        disabled={biometricBusy}
                        aria-label={biometricBusy ? 'Waiting for fingerprint - touch the sensor to continue' : 'Log in with fingerprint'}
                        title={biometricBusy ? 'Touch the sensor to continue' : 'Log in with fingerprint'}
                      >
                        <span className="login-page__fingerprint-bracket" aria-hidden="true">{'{'}</span>
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 2a7 7 0 0 0-7 7v2c0 3 1 5.5 2 7" />
                          <path d="M12 2a7 7 0 0 1 7 7v2c0 1.5-.15 2.8-.4 4" />
                          <path d="M8.5 21c-1-2-1.5-4-1.5-7V9a5 5 0 0 1 10 0v3" />
                          <path d="M12 6.5a3.5 3.5 0 0 0-3.5 3.5v2c0 3.2.6 5.6 1.6 7.5" />
                          <path d="M15.5 10v2c0 1.7-.1 3-.35 4.2" />
                          <path d="M12 10a1.5 1.5 0 0 0-1.5 1.5V13c0 2.6.5 4.6 1.2 6" />
                        </svg>
                        <span className="login-page__fingerprint-bracket" aria-hidden="true">{'}'}</span>
                      </button>
                    </div>
                  )}
                  <Button type="submit" variant="primary" loading={loading} fullWidth>
                    Log in
                  </Button>
                </div>
              </form>
            </>
          )}
          </div>

          {/* Block 3: secondary actions and support - deliberately
              de-emphasized (outlined/plain, not solid primary) so
              "Log in" above remains the single dominant action on
              this screen. */}
          <div className="login-page__block login-page__block--footer login-page__footer-links">
            <div className="login-page__signin-divider login-page__signin-divider--tight">
              <span>Don&apos;t have an account?</span>
            </div>
            <Link to="/register" className="login-page__register-btn">
              <span aria-hidden="true">👤</span> Register as a landlord
            </Link>
            <p className="login-page__signup u-mt-3">
              Looking for a vacant unit? <Link to="/find-a-house">Browse listings</Link>
            </p>

            <div className="login-page__help-row">
              <HelpButton renderAs="login-page__help-link" />
              <button
                type="button"
                className="ghost-link"
                onClick={() => setShowFaq((v) => !v)}
              >
                {showFaq ? 'Hide FAQs ▲' : 'Frequently asked questions ▼'}
              </button>
            </div>
            {showFaq && <Faq audience="guest" />}

            <p className="login-page__legal-links">
              <Link to="/terms" className="ghost-link">Terms of Service</Link>
              {' · '}
              <Link to="/privacy" className="ghost-link">Privacy Policy</Link>
              {' · '}
              <Link to="/status" className="ghost-link">System Status</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
