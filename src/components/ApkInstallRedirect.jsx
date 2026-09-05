import { useEffect } from 'react';

// FIX (direct request: "the pops should be disabled... should no
// longer pop but stay silent, the only visible download ui should be
// the one located at the lower point of the landing page"): this
// used to swallow Chrome's native `beforeinstallprompt` and then pop
// its own competing banner pointing at the APK. It still needs to
// swallow the native event (otherwise Chrome's own "Add to Home
// Screen" banner shows up instead, which is worse), but it no longer
// renders anything of its own - DownloadAppSection's footer card is
// now the single, deliberate download entry point.
export default function ApkInstallRedirect() {
  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      // Silently cancel Chrome's default install UI. Deliberately
      // never call e.prompt() and never surface any banner here.
      e.preventDefault();
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  return null;
}
