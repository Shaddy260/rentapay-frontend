import { useEffect, useState } from 'react';
import './InstallAppButton.css';

// FIX (direct request: "the link when opened in other phones in their
// browsers eg chrome does not show the option to download my app"):
// the PWA install *infrastructure* (manifest.json, icons, sw.js
// registered in main.jsx) was already all in place - the browser was
// technically installable the whole time - but nothing in the app
// ever listened for the `beforeinstallprompt` event or gave anyone a
// visible button to tap. Chrome only shows its own install UI (⋮ menu
// -> "Install app") if you know to look for it, which most people
// never do. This makes it an explicit, visible button instead.
//
// iOS Safari never fires beforeinstallprompt at all (Apple's PWA
// install flow is manual, Share -> Add to Home Screen, with no
// programmatic trigger) - detected separately below so iOS users get
// correct instructions instead of a button that would silently do
// nothing.
function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function InstallAppButton({ variant = 'inline' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return undefined;
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (isIos()) {
      setShowIosHelp((v) => !v);
      return;
    }
    if (!deferredPrompt) {
      // Chrome/Android hasn't fired the event yet (e.g. criteria not
      // met yet, or already dismissed once this session) - fall back
      // to telling people where to find it themselves rather than a
      // button that does nothing when tapped.
      setShowIosHelp((v) => !v); // reuses the same "how to" panel, generic wording below covers both
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className={`install-app install-app--${variant}`}>
      <button type="button" className="install-app__btn" onClick={handleClick}>
        📲 Download the RentaPay app
      </button>
      {showIosHelp && (
        <p className="install-app__help">
          {isIos()
            ? <>Tap the <strong>Share</strong> icon in Safari, then <strong>"Add to Home Screen"</strong>.</>
            : <>Open your browser menu (⋮ or ⋯) and choose <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.</>}
        </p>
      )}
    </div>
  );
}
