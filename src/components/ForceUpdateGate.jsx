// src/components/ForceUpdateGate.jsx
//
// DIRECT REQUEST: "when there is an update, every user logging in the
// downloaded app should get a page to update the app, with a UI to
// update which redirects them to Play Store to our app, they should
// not be able to proceed into seeing the dashboard before updating no
// matter what."
//
// Scope is deliberately narrow: this ONLY ever enforces on the
// installed app (TWA "Add to Home Screen" / standalone display mode)
// with a logged-in session. A regular browser tab always gets the
// existing soft "Refresh" banner instead (see UpdateChecker.jsx) -
// nobody browsing rentapay.co.ke in Chrome should ever be told to go
// find it on the Play Store. Web content on a normal tab is always
// the live deploy anyway; the installed app is the one thing that can
// keep running an old shell until someone actually updates it.
//
// Mounted once, wrapping every route (see App.jsx) - not per-page -
// so it is truly impossible to route around: while blocked or still
// checking, NOTHING under it renders, including whichever dashboard
// the person's role would otherwise land on.
//
// Re-checks on every navigation (via useLocation - this runs inside
// BrowserRouter) so the moment Login.jsx calls navigate('/dashboard')
// right after storing a fresh token, this re-evaluates before that
// dashboard route ever paints - covering "every user logging in"
// without needing every login code path (password, biometric, TOTP
// verify) to remember to call something extra.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client.js';
import { compareVersions, isRunningStandaloneApp } from '../utils/appVersion.js';
import './ForceUpdateGate.css';

// Keep in sync with frontend/package.json "version". Bump this
// alongside any release an admin marks as the new required floor via
// the admin app-version settings, so CURRENT_APP_VERSION genuinely
// reflects what's running.
const CURRENT_APP_VERSION = '6.1.0';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // also re-check periodically while the app sits open

export default function ForceUpdateGate({ children }) {
  const location = useLocation();
  const standalone = isRunningStandaloneApp();
  const [status, setStatus] = useState('ok'); // 'ok' | 'checking' | 'blocked'
  const [info, setInfo] = useState(null);
  const inFlight = useRef(false);
  // FIX (direct request: "when a landlord navigates from dashboard to
  // settings and back... it shows an orange screen and loads... it
  // should transition without the skeletons at all"). The gate's own
  // full-screen "checking" state was designed for exactly one moment -
  // the first check right after login, before the dashboard has ever
  // painted. But because runCheck() re-fires on every location.pathname
  // change (see the effect below - that part is still correct and
  // needed, it's how a stale app gets caught even when Login.jsx
  // navigates instead of a hard reload), status was flipping back to
  // 'checking' on every single in-app navigation thereafter too - an
  // orange, z-index:999999 overlay unmounting the entire app tree
  // (including whatever page-level cache/data was already on screen)
  // for a routine tap between Dashboard and Settings, not just login.
  // hasCheckedOnce draws the line: the very first check after mount
  // still shows the full-screen holding state (correct - nothing has
  // painted yet at that point anyway), but every check after that runs
  // silently in the background. It can still flip status to 'blocked'
  // at any time if the person's version genuinely falls below the
  // floor - that hard block is real and intended, and stays instant
  // and unmissable when it happens. It just can no longer flash
  // 'checking' over content that's already legitimately on screen.
  const hasCheckedOnce = useRef(false);

  const runCheck = useCallback(() => {
    const token = localStorage.getItem('rentapay_token');
    // Not the installed app, or nobody's logged in yet (still on
    // Landing/Login) - never enforce here. Login.jsx storing a token
    // and navigating is what flips this on, via the location-change
    // effect below.
    if (!standalone || !token) {
      setStatus((prev) => (prev === 'blocked' ? 'ok' : prev));
      // No token (logged out) - reset so the *next* login gets its own
      // branded checking screen again, same as a fresh app open would.
      hasCheckedOnce.current = false;
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    if (!hasCheckedOnce.current) {
      setStatus((prev) => (prev === 'blocked' ? prev : 'checking'));
    }
    api
      .getAppVersionCheck()
      .then((res) => {
        setInfo(res);
        const outdated = res?.minSupportedVersion
          ? compareVersions(CURRENT_APP_VERSION, res.minSupportedVersion) < 0
          : false;
        setStatus(outdated ? 'blocked' : 'ok');
      })
      .catch(() => {
        // Fail open - a transient network/API hiccup must never lock
        // someone entirely out of the app they already have installed.
        setStatus((prev) => (prev === 'blocked' ? prev : 'ok'));
      })
      .finally(() => {
        inFlight.current = false;
        hasCheckedOnce.current = true;
      });
  }, [standalone]);

  // Re-check on every route change (covers the login -> dashboard
  // navigation) and on an interval / tab-resume while the app sits
  // open, mirroring UpdateChecker's own pattern.
  useEffect(() => {
    runCheck();
  }, [runCheck, location.pathname]);

  useEffect(() => {
    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);
    function onVisible() {
      if (document.visibilityState === 'visible') runCheck();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runCheck]);

  if (status === 'checking') {
    // Deliberately not the dashboard, not even for a frame - a blank
    // branded holding screen while the one quick version-check call
    // resolves, rather than letting the real route flash on screen
    // first and then get replaced.
    return (
      <div className="force-update-gate force-update-gate--checking" aria-busy="true">
        <div className="force-update-gate__spinner" aria-hidden="true" />
      </div>
    );
  }

  if (status === 'blocked') {
    const playStoreUrl = info?.playStoreUrl || 'https://play.google.com/store/apps/details?id=com.rentapay.app';
    return (
      <div
        className="force-update-gate force-update-gate--blocked"
        role="alertdialog"
        aria-modal="true"
        aria-label="Update required"
      >
        <div className="force-update-gate__card">
          <span className="force-update-gate__icon" aria-hidden="true">⬆️</span>
          <h1>Update required</h1>
          <p>
            {info?.updateMessage ||
              "A new version of RentaPay is required to continue. Please update the app to keep using it."}
          </p>
          <a
            className="force-update-gate__button"
            href={playStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Update on Google Play
          </a>
          <p className="force-update-gate__hint">After updating, reopen RentaPay from your home screen.</p>
        </div>
      </div>
    );
  }

  return children;
}
