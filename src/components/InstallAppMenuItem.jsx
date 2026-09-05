import React, { useState } from 'react';
import { useInstallPrompt } from '../utils/useInstallPrompt.js';
import './InstallAppMenuItem.css';

const MANUAL_STEPS = {
  'android-manual': {
    title: 'Install on Android',
    steps: [
      <>Tap the <strong>⋮</strong> menu in the top right of your browser</>,
      <>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>)</>,
      <>Confirm by tapping <strong>Install</strong></>,
    ],
  },
  'firefox-manual': {
    title: 'Install RentaPay',
    steps: [
      <>Look for an install icon at the right of the address bar (or the <strong>⋮</strong> menu)</>,
      <>Choose <strong>Install</strong> (on desktop Firefox this may not be offered - Chrome or Edge give the smoothest install)</>,
      <>Alternatively, bookmark this page for quick access</>,
    ],
  },
  'desktop-manual': {
    title: 'Install RentaPay',
    steps: [
      <>Look for the install icon (a small monitor with a down arrow) at the right of your address bar</>,
      <>Or open your browser's <strong>⋮</strong> menu and choose <strong>Install RentaPay…</strong></>,
      <>Confirm by clicking <strong>Install</strong></>,
    ],
  },
};

// Direct request: "include it in the menu bar in all the portals" /
// "there is no download button... it should be... visible everytime".
// A single line item, styled to match whatever menu it's dropped
// into (AccountMenu's dropdown items, or PortalSidebar's item list)
// rather than carrying its own box styling like InstallAppBanner
// does. Renders nothing ONLY once the app is already installed
// (running standalone) - otherwise it's always visible and always
// clickable, falling back to manual steps for whatever browser is in
// use when there's no live native install prompt to trigger.
export default function InstallAppMenuItem({ as: Component = 'button', className = '', onClick, children }) {
  const { canOffer, isIOS, promptInstall } = useInstallPrompt();
  const [manualSteps, setManualSteps] = useState(null);

  if (!canOffer) return null;

  async function handleClick() {
    const result = await promptInstall();
    if (result === 'ios-manual') {
      setManualSteps({
        title: 'Install on iPhone/iPad',
        steps: [
          <>Tap the <strong>Share</strong> icon <span aria-hidden="true">⬆️</span> in Safari's toolbar</>,
          <>Scroll down and tap <strong>Add to Home Screen</strong></>,
          <>Tap <strong>Add</strong> in the top right</>,
        ],
      });
      return;
    }
    if (result === 'android-manual' || result === 'firefox-manual' || result === 'desktop-manual') {
      setManualSteps(MANUAL_STEPS[result]);
      return;
    }
    // 'accepted' or 'dismissed' from a real native prompt
    onClick?.();
  }

  return (
    <>
      <Component type={Component === 'button' ? 'button' : undefined} className={className} onClick={handleClick}>
        {children || '📲 Download the App'}
      </Component>
      {manualSteps && (
        <div className="install-app-menu-item__ios-modal" onClick={() => setManualSteps(null)}>
          <div className="install-app-menu-item__ios-modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>{manualSteps.title}</h4>
            <ol>
              {manualSteps.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <button type="button" onClick={() => setManualSteps(null)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
