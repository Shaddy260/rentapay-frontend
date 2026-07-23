import React, { useState } from 'react';
import { useInstallPrompt } from '../utils/useInstallPrompt.js';
import './InstallAppBanner.css';

const MANUAL_STEPS = {
  'android-manual': {
    title: 'Install on Android',
    steps: [
      'Tap the ⋮ menu in the top right of your browser',
      'Tap "Install app" (or "Add to Home screen")',
      'Confirm by tapping "Install"',
    ],
  },
  'firefox-manual': {
    title: 'Install RentaPay',
    steps: [
      'Look for an install icon at the right of the address bar (or the ⋮ menu)',
      'Choose "Install" - on desktop Firefox this may not be offered; Chrome or Edge give the smoothest install',
      'Alternatively, bookmark this page for quick access',
    ],
  },
  'desktop-manual': {
    title: 'Install RentaPay',
    steps: [
      'Look for the install icon (a small monitor with a down arrow) at the right of your address bar',
      'Or open your browser\'s ⋮ menu and choose "Install RentaPay…"',
      'Confirm by clicking "Install"',
    ],
  },
};

// Direct request: "it should be written somewhere in app and on login
// page to download the app" / "there is no download button... it
// should be... visible everytime." Now login-page-only - every portal
// gets the equivalent "Download the App" entry inside its
// account/side menu instead (see AccountMenu.jsx / PortalSidebar items
// in Dashboard/TenantPortal/ScoutPortal/AdminDashboard), both driven
// by the same shared useInstallPrompt hook. Only hides once the app
// is already installed - otherwise it's always here and always
// clickable, falling back to manual instructions for the browser
// actually in use when there's no live native prompt.
const DISMISS_KEY = 'rentapay_install_banner_dismissed_at';
const DISMISS_SNOOZE_DAYS = 14;

export default function InstallAppBanner() {
  const { canOffer, isIOS, promptInstall } = useInstallPrompt();
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [manualSteps, setManualSteps] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return !!dismissedAt && Date.now() - dismissedAt < DISMISS_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  if (!canOffer || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* non-fatal */ }
  }

  async function handleTap() {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    const result = await promptInstall();
    if (result === 'android-manual' || result === 'firefox-manual' || result === 'desktop-manual') {
      setManualSteps(MANUAL_STEPS[result]);
    }
  }

  return (
    <div className="install-app-banner install-app-banner--inline">
      <div className="install-app-banner__row">
        <span className="install-app-banner__icon">📲</span>
        <div className="install-app-banner__text">
          <strong>Get the RentaPay app</strong>
          <span>Faster access, and payment/tenant alerts as real notifications - not a browser tab.</span>
        </div>
        <button type="button" className="install-app-banner__cta" onClick={handleTap}>
          Install
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
      {manualSteps && (
        <div className="install-app-banner__ios-steps">
          <p>{manualSteps.title}:</p>
          <ol>
            {manualSteps.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <button type="button" className="install-app-banner__cta install-app-banner__cta--ghost" onClick={() => setManualSteps(null)}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
