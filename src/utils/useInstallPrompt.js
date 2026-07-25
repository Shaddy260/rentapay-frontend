import { useEffect, useState } from 'react';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // iOS Safari's own flag
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(window.navigator.userAgent);
}

function isFirefox() {
  return /firefox/i.test(window.navigator.userAgent);
}

// FIX (direct request: "there is no download button to directly
// download the RentaPay App... it should be... visible everytime"):
// this used to hide the menu item/banner completely whenever
// `deferredPrompt` hadn't been captured - which is the normal case
// far more often than not. Chrome only ever fires
// `beforeinstallprompt` ONCE per page load, and only if its own
// install-eligibility heuristics happen to be satisfied at that
// exact moment (and never at all on Firefox, or once the person has
// already dismissed it recently) - so any component that mounts even
// slightly late, or any non-Chromium browser, permanently saw
// nothing. The button/menu-item should never just disappear; if
// there's no live native prompt to trigger, it now falls back to
// clear manual instructions for the browser actually in use, so
// there is always something to tap.
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    if (installed) return undefined;

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  // canOffer: true any time the app isn't already installed - there
  // is ALWAYS something to show the person (a real native prompt when
  // one is available, otherwise manual steps for their browser).
  const canOffer = !installed;
  // canPromptNatively: a real one-tap browser install dialog is ready
  // right now. When this is false but canOffer is true, the caller
  // should fall back to promptInstall()'s 'manual' steps instead.
  const canPromptNatively = !!deferredPrompt;

  async function promptInstall() {
    if (isIOS()) return 'ios-manual';
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return choice.outcome; // 'accepted' | 'dismissed'
    }
    // No live native prompt available (missed the one-time event,
    // already dismissed recently, or a browser - e.g. desktop Firefox -
    // that doesn't support this event at all). Tell the caller which
    // manual instructions to show.
    if (isAndroid()) return 'android-manual';
    if (isFirefox()) return 'firefox-manual';
    return 'desktop-manual';
  }

  return { canOffer, canPromptNatively, installed, isIOS: isIOS(), promptInstall };
}
