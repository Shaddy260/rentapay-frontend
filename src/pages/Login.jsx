import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import HeroPhotoBackground from '../components/HeroPhotoBackground.jsx';
import HelpButton from '../components/HelpButton.jsx';
import { getRememberedActiveProperty } from '../utils/activeProperty.js';
import { finalizeLogin } from '../utils/finalizeLogin.js';
import GoogleSignInButton from '../components/GoogleSignInButton.jsx';
import LockoutCountdown from '../components/LockoutCountdown.jsx';
import { api, ApiError, storeSessionTokens } from '../api/client.js';
import { isBiometricSupported, listBiometricEntries, unlockWithBiometric } from '../utils/biometricAuth.js';
import { isStandalone } from '../utils/useInstallPrompt.js';
import { getAllDeviceTrustTokens } from '../utils/deviceTrust.js';
import './Login.css';

// FIX (direct request: "mailbox icon is blocking the first or second
// letter of the emails"): the email/password field icons used to be
// plain Unicode emoji characters (✉ / 🔒) rendered as text. Emoji
// glyph width is NOT fixed - it depends entirely on the device's/
// OEM's emoji font (Samsung, Xiaomi, and stock Android all ship
// different emoji sets, several of which render ✉ as a much wider,
// full-color glyph than a plain text symbol) - so a left-padding
// value tuned to look right on one device can still let a wide
// emoji render eat into that padding on another. Fixed-size inline
// SVGs render identically everywhere, which is the only way to
// actually guarantee the icon never encroaches on the input text
// again, regardless of device or emoji font.
// FIX (direct request): remove the mail icon from the email field
// FIX (direct request: "lock icon is blocking the password") - the
// LockIcon component that used to render inside the password field
// has been removed entirely (see the password form-field below); it
// is no longer referenced anywhere in this file.

function describeError(err) {
  if (!(err instanceof ApiError)) {
    return { title: 'Something went wrong', detail: 'Please try again. If this keeps happening, contact RentaPay support.' };
  }

  switch (err.kind) {
    case 'network':
      return {
        // FIX (direct request: "change to something like 'could not
        // reach RentaPay. Check your internet connection and try
        // again'"): the old copy ("Can't reach the server") was
        // generic backend-engineer phrasing that doesn't name the
        // product - this now matches the requested wording.
        title: 'Could not reach RentaPay',
        detail: 'Check your internet connection and try again. If the problem continues, contact RentaPay support.',
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
        return { title: 'Account temporarily locked', detail: err.message, lockedUntil: err.raw?.lockedUntil || null };
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
  const location = useLocation();
  const [identifier, setIdentifier] = useState(() => {
    if (location.state?.prefillIdentifier) return location.state.prefillIdentifier;
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
  // FIX (direct request): removed the in-page FAQ toggle entirely -
  // it wasn't rendering usably on this screen. HelpButton above still
  // covers "I need help" without it.
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
      // FIX (direct request): show the email that was actually used
      // to log in, not the phone number - only fall back to phone if
      // this device's biometric entry was enrolled before email was
      // tracked, or the account genuinely has no email on file.
      if (entry.email) setIdentifier(entry.email);
      else if (entry.phone) setIdentifier(entry.phone);

      await api.sessionCheck(entry.token);

      storeSessionTokens(entry.token, entry.refreshToken);
      localStorage.setItem('rentapay_role', entry.role);
      if (entry.phone) localStorage.setItem('rentapay_phone', entry.phone);
      if (entry.email) localStorage.setItem('rentapay_email', entry.email);
      if (entry.roleLevel) localStorage.setItem('rentapay_role_level', entry.roleLevel);
      else localStorage.removeItem('rentapay_role_level');
      // Restore this account's last-viewed apartment (persists across
      // logins, unlike sessionStorage alone) so Dashboard.jsx's load()
      // opens straight back into it - including if it has since
      // expired - instead of falling back to the first property.
      {
        const remembered = getRememberedActiveProperty(entry.email || entry.phone);
        if (remembered) localStorage.setItem('rentapay_active_property_id', remembered);
        else localStorage.removeItem('rentapay_active_property_id');
      }
      navigate(entry.role === 'landlord' || entry.role === 'manager' ? '/dashboard' : entry.role === 'brand_ambassador' ? '/ba-portal' : '/portal');
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
    const msg = localStorage.getItem('rentapay_logout_message');
    if (msg) {
      setErrorInfo({ title: 'You have been logged out', detail: msg });
      localStorage.removeItem('rentapay_logout_message');
    }
  }, []);

  React.useEffect(() => {
    const msg = localStorage.getItem('rentapay_info_message');
    if (msg) {
      setInfoMessage(msg);
      localStorage.removeItem('rentapay_info_message');
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

    // OPTIONAL 2FA (direct request): this account turned on
    // authenticator-app 2FA for itself (see the settings toggle built
    // on twoFactor.controller.js) - password is already confirmed
    // correct, just needs the second factor before a token is issued.
    if (res.needsTotp) {
      navigate('/verify-login-totp', {
        state: { accountType: res.accountType, accountId: res.accountId, fallbackIdentifier: identifier },
      });
      return;
    }

    if (res.paymentPending) {
      try {
        // localStorage (not sessionStorage) so this survives the
        // person closing the app entirely while a manual payment is
        // still awaiting admin confirmation - see RegisterFlow.jsx's
        // STORAGE_KEY comment.
        localStorage.setItem(
          'rentapay_register_progress',
          JSON.stringify({
            stepIndex: 1,
            landlordId: res.landlordId,
            checkoutRequestId: res.checkoutRequestId,
            amountDue: res.amountDue,
            defaultPropertyId: null,
            resumedFromLogin: true,
            savedAt: Date.now(),
            form: { fullName: '', phone: res.phone || '', email: '', unitsCount: '', periodMonths: '' },
          })
        );
      } catch {
        // localStorage unavailable - fall back to step 0
      }
      navigate('/register');
      return;
    }

    finalizeLogin(navigate, res, { fallbackIdentifier });
  }

  async function performLogin(pickedAccountType) {
    try {
      const deviceTokens = getAllDeviceTrustTokens();
      const res = await api.login(
        pickedAccountType
          ? { accountType: pickedAccountType, email: identifier, password, deviceTokens }
          : { email: identifier, password, deviceTokens }
      );
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
      {/* REDESIGN (direct request): full-bleed rotating background of
          the same 3 property photos used on the landing page hero,
          behind a centered glass card - replacing the old split
          "solid color panel + form" layout. */}
      <HeroPhotoBackground
        wrapClassName="login-page__photo-bg"
        photoClassName="login-page__photo"
        overlayClassName="login-page__photo-overlay"
      />


      <div className="login-page__right">
        <div className="login-page__panel">
          {/* REDESIGN (direct request): logo badge + "Sign In" title,
              centered, replacing the old wordmark/tagline header -
              matches the reference screenshot's lockup. */}
          <div className="login-page__block login-page__block--header">
            <div className="login-page__logo-badge" aria-hidden="true">
              <img src="/logo.png" alt="" />
            </div>
            <h1 className="login-page__title">Sign In</h1>
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
              {errorInfo.lockedUntil ? (
                <p>
                  <LockoutCountdown until={errorInfo.lockedUntil} onExpire={() => setErrorInfo(null)} />
                </p>
              ) : (
                <p>{errorInfo.detail}</p>
              )}
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
              <form onSubmit={handleSubmit}>
                {/* FIX (direct request: "email field appears at the
                    sides and sometimes at the top, should always be
                    at the top"): the column stacking here comes from
                    .form-field's `flex-direction: column` in a
                    separate stylesheet - on a slow load there's a
                    brief window before that rule has applied where
                    label and input can render inline instead. Pinning
                    the stacking directly as an inline style guarantees
                    it can never flash unstyled, regardless of
                    stylesheet load timing. */}
                <div className="form-field" style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="form-field__label" htmlFor="identifier" style={{ display: 'block', width: '100%' }}>Email</label>
                  <input
                    id="identifier"
                    type="email"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="form-field" style={{ display: 'flex', flexDirection: 'column' }}>
                  <label className="form-field__label" htmlFor="password" style={{ display: 'block', width: '100%' }}>Password</label>
                  {/* Password visibility toggle (the eye icon) is
                      built into PasswordInput - already shared by
                      every password field in the app (signup, change
                      password, reset password, etc), not something
                      new added just for this page. */}
                  {/* FIX (direct request: "lock icon is blocking the
                      password" - same crowding problem the email
                      field's mail icon had, now confirmed on the
                      password field too). Dropping the icon wrapper
                      entirely, same fix as the email field above. */}
                  <PasswordInput
                    id="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                  />
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
                    Sign In {!loading && <span aria-hidden="true">→</span>}
                  </Button>
                </div>
              </form>

              <div className="login-page__divider">
                <span>or</span>
              </div>

              <div className="login-page__oauth">
                <GoogleSignInButton
                  onCredential={(idToken) => performGoogleLogin(idToken)}
                  onError={(msg) => setGoogleError(msg)}
                />
                {googleError && <p className="login-page__oauth-error">{googleError}</p>}
              </div>
            </>
          )}
          </div>

          {/* Block 3: secondary actions and support - deliberately
              de-emphasized (outlined/plain, not solid primary) so
              "Sign In" above remains the single dominant action on
              this screen. */}
          <div className="login-page__block login-page__block--footer login-page__footer-links">
            <p className="login-page__signup login-page__signup--create-account">
              Don&apos;t have an account? <Link to="/register">Create Account</Link>
            </p>
            <p className="login-page__signup u-mt-3">
              Looking for a vacant unit? <Link to="/find-a-house">Browse listings</Link>
            </p>

            <div className="login-page__help-row">
              <HelpButton renderAs="login-page__help-link" />
            </div>

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
