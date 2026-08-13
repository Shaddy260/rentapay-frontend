import React, { useEffect, useState } from 'react';
import './ApkInstallRedirect.css';

// FEATURE (direct request: redirect Chrome's native "Install app"
// prompt to promote the TWA APK instead). RentaPay ships a real
// signed Android app (see DownloadAppSection.jsx / public/downloads),
// which is the fuller, fully-branded experience - proper app
// notifications, no browser chrome, etc. The manifest + service
// worker are still kept alive and correct (required for the TWA/
// Bubblewrap build to work at all), but we don't want Chrome's own
// generic "Add to Home Screen" banner competing with that - so this
// swallows the browser's automatic prompt and shows our own banner
// pointing straight at the APK instead.
//
// Scoped to just this one job: listen for `beforeinstallprompt`,
// cancel Chrome's default UI, and show a same-or-more-prominent
// fixed banner. It does NOT touch the existing `useInstallPrompt`
// hook or the manual "Install app" menu item flows elsewhere in the
// app - those are a separate, user-initiated path and are left as-is.
const APK_PATH = '/downloads/rentapay.apk';
const DISMISS_KEY = 'rentapay_apk_prompt_dismissed';

export default function ApkInstallRedirect() {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      // Stop Chrome's own install banner from appearing - we're
      // replacing it with our APK banner below, not letting both show.
      e.preventDefault();

      let alreadyDismissed = false;
      try {
        alreadyDismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
      } catch {
        alreadyDismissed = false;
      }

      // Keep the event around in case it's ever needed later, but we
      // deliberately never call e.prompt() - that would trigger the
      // native PWA install flow we're trying to steer people away from.
      setDeferredEvent(e);
      if (!alreadyDismissed) setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* non-fatal - worst case the banner reappears this session */
    }
  }

  return (
    <div className="apk-install-redirect" role="dialog" aria-label="Install RentaPay">
      <div className="apk-install-redirect__row">
        <span className="apk-install-redirect__icon" aria-hidden="true">📲</span>
        <div className="apk-install-redirect__text">
          <strong>Install RentaPay</strong>
          <span>Get the full app experience on your phone.</span>
        </div>
        <a
          href={APK_PATH}
          download="RentaPay.apk"
          className="apk-install-redirect__cta"
          onClick={dismiss}
        >
          Download
        </a>
        <button
          type="button"
          className="apk-install-redirect__dismiss"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Exported for callers that might want to know whether a native
// prompt event was captured (unused for now - deliberately not
// wired up to anything that would call .prompt() on it).
export { DISMISS_KEY };
