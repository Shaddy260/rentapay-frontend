import React, { useState } from 'react';
import { isStandalone } from '../utils/useInstallPrompt.js';
import './InstallAppBanner.css';

// FIX (direct request: "there is no option to download the app in
// the browser anymore... and it should be a TWA, not a PWA"):
// This used to drive the browser's native `beforeinstallprompt` PWA
// flow (via useInstallPrompt/promptInstall) - "install" just did an
// Add-to-Home-Screen of the web page. RentaPay now ships a real
// signed Android app (a Trusted Web Activity build - see
// DownloadApkMenuItem.jsx and public/downloads/README.txt), so the
// banner's job is simpler and more direct: hand the person the
// actual APK to download and install, exactly the same file/flow as
// the "Download the App" item in AccountMenu.
//
// iOS is the one exception: Apple doesn't support installing a TWA/
// APK at all, so on iPhone/iPad this still falls back to the "Add to
// Home Screen" Safari steps - that's the only real option there, not
// a downgrade back to the old PWA-install behavior.
const APK_PATH = '/downloads/app-release-signed.apk';

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

const DISMISS_KEY = 'rentapay_install_banner_dismissed_at';
const DISMISS_SNOOZE_DAYS = 14;

export default function InstallAppBanner() {
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showApkGuide, setShowApkGuide] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return !!dismissedAt && Date.now() - dismissedAt < DISMISS_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  // Only ever hides once the app is already installed as a standalone
  // app, or once the person dismissed it recently - never because a
  // one-time native prompt event was missed (there's no such event to
  // miss anymore; this is a plain file download).
  if (isStandalone() || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* non-fatal */ }
  }

  function handleTap() {
    if (isIOS()) {
      setShowIOSInstructions(true);
      return;
    }
    window.location.href = APK_PATH;
    setShowApkGuide(true);
  }

  return (
    <div className="install-app-banner install-app-banner--inline">
      <div className="install-app-banner__row">
        <span className="install-app-banner__icon">📲</span>
        <div className="install-app-banner__text">
          <strong>Get the RentaPay app</strong>
          <span>Faster access and instant payment alerts, right on your home screen.</span>
        </div>
        <button type="button" className="install-app-banner__cta" onClick={handleTap}>
          {isIOS() ? 'Install' : 'Download'}
        </button>
        <button type="button" className="install-app-banner__dismiss" aria-label="Dismiss" onClick={dismiss}>
          ✕
        </button>
      </div>

      {showIOSInstructions && (
        <div className="install-app-banner__ios-steps">
          <p>To install on iPhone/iPad:</p>
          <ol>
            <li>
              Tap the <strong>Share</strong> icon <span aria-hidden="true">⬆️</span> in Safari's toolbar
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>
            </li>
            <li>
              Tap <strong>Add</strong> in the top right
            </li>
          </ol>
          <button type="button" className="install-app-banner__cta install-app-banner__cta--ghost" onClick={() => setShowIOSInstructions(false)}>
            Got it
          </button>
        </div>
      )}
      {showApkGuide && (
        <div className="install-app-banner__ios-steps">
          <p>Almost there:</p>
          <ol>
            <li>Your download will finish in a few seconds</li>
            <li>Open it from your notification shade, or from your phone's Downloads</li>
            <li>
              Tap <strong>Install</strong> when prompted (you may need to allow installs from this browser first)
            </li>
          </ol>
          <button type="button" className="install-app-banner__cta install-app-banner__cta--ghost" onClick={() => setShowApkGuide(false)}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
