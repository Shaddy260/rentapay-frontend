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
  const [status, setStatus] = useState('ok'); // 'ok' | 'blocked'
  const [info, setInfo] = useState(null);
  const inFlight = useRef(false);

  const runCheck = useCallback(() => {
    const token = localStorage.getItem('rentapay_token');
    // Not the installed app, or nobody's logged in yet (still on
    // Landing/Login) - never enforce here. Login.jsx storing a token
    // and navigating is what flips this on, via the location-change
    // effect below.
    if (!standalone || !token) {
      setStatus((prev) => (prev === 'blocked' ? 'ok' : prev));
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    // FIX (direct request: no blank/skeleton holding screens anywhere -
    // content should already be on screen while checks like this run
    // in the background). This used to flip to a full-screen
    // 'checking' state on the very first run, blocking even the
    // login page itself behind a blank spinner. It no longer sets
    // any intermediate status at all - status only ever changes here
    // if the check comes back 'blocked', which is the one case that
    // still needs a hard, unmissable interrupt (see the render below).
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

  // FIX (direct request: "it loads like this before showing the login
  // page - this is not right, it is not supposed to load but land
  // directly on the page... loading should happen in the background
  // with content already displayed, not empty pages/skeletons").
  // This full-screen 'checking' holding state used to render ABOVE
  // everything - including the login page itself - on every cold app
  // open where a token (even a stale/expired one) was still sitting
  // in localStorage, exactly the tan/peach spinner screen being
  // reported. That was a deliberate earlier design (see the version-
  // check comment above runCheck), but it's the opposite of what's
  // being asked for now: the version check should run silently
  // in the background against whatever the app would already be
  // showing (Login, Dashboard, whatever the route resolves to) -
  // never blocking first paint. The only state that still needs a
  // hard, unmissable full-screen interrupt is 'blocked', where the
  // installed app is genuinely below the required version floor -
  // that one stays, further down.
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
