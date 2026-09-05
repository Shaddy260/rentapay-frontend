// src/utils/finalizeLogin.js
//
// Extracted from Login.jsx's handleLoginResponse so the OPTIONAL
// per-account 2FA second step (VerifyLoginTotp.jsx) can finish a
// login with the exact same session-storage/navigation logic as a
// normal one-step login, once verifyLoginTotp() returns the same
// response shape login() itself would have returned with no 2FA
// involved.
import { getRememberedActiveProperty } from './activeProperty.js';
import { clearStaleAccountCaches } from './clearStaleCaches.js';
import { storeSessionTokens } from '../api/client.js';

export function finalizeLogin(navigate, res, { fallbackIdentifier } = {}) {
  // Must run BEFORE anything else below - see clearStaleCaches.js for
  // why: a previous account's cached dashboard/property data must be
  // gone before this new session's token/role are written, or a page
  // could still seed its initial render from the old data for a
  // moment.
  clearStaleAccountCaches();

  // SECURITY FIX (JWT-theft review, Sept 2026): stores both the
  // short-lived access token and the refresh token that lets the app
  // silently renew it - see storeSessionTokens/api/client.js.
  storeSessionTokens(res.token, res.refreshToken);
  localStorage.setItem('rentapay_role', res.role);
  localStorage.setItem('rentapay_phone', res.phone || fallbackIdentifier || '');

  const emailLooking = res.email || (fallbackIdentifier && fallbackIdentifier.includes('@') ? fallbackIdentifier : '');
  if (emailLooking) localStorage.setItem('rentapay_email', emailLooking);
  else localStorage.removeItem('rentapay_email');

  const identifier = res.email || res.phone || fallbackIdentifier;
  const remembered = identifier ? getRememberedActiveProperty(identifier) : null;
  if (remembered) localStorage.setItem('rentapay_active_property_id', remembered);
  else localStorage.removeItem('rentapay_active_property_id');

  if (res.roleLevel) localStorage.setItem('rentapay_role_level', res.roleLevel);
  else localStorage.removeItem('rentapay_role_level');

  if (res.subscriptionExpired) localStorage.setItem('rentapay_subscription_expired', 'true');
  else localStorage.removeItem('rentapay_subscription_expired');

  if (res.mustChangePassword) {
    navigate('/change-password');
    return;
  }

  if (res.role === 'landlord' && !res.setupWizardComplete) {
    try {
      localStorage.setItem('rentapay_resume_setup', 'true');
      localStorage.setItem(
        'rentapay_register_progress',
        JSON.stringify({
          stepIndex: res.setupWizardStep ?? 3,
          landlordId: null,
          defaultPropertyId: res.setupWizardPropertyId || null,
          resumedFromLogin: true,
          savedAt: Date.now(),
          form: { fullName: '', phone: res.phone || fallbackIdentifier || '', email: '', unitsCount: '', periodMonths: '' },
        })
      );
    } catch {
      // storage unavailable - RegisterFlow falls back to step 0
    }
    navigate('/register');
    return;
  }

  if (res.role === 'brand_ambassador') {
    navigate('/ba-portal');
    return;
  }

  navigate(res.role === 'landlord' || res.role === 'manager' ? '/dashboard' : '/portal');
}
