import React, { useEffect, useRef, useId } from 'react';

// FEATURE (item 2: "Google / Facebook login"). Loads Google's own
// Identity Services script once, then renders Google's own styled
// sign-in button into a div this component owns. Google's script (not
// this component) is what actually shows the account picker/popup and
// signs the token - this just wires whatever it hands back to
// `onCredential`.
//
// Deliberately NOT rendering our own custom-styled button that calls
// google.accounts.id.prompt() - Google's guidelines (and, practically,
// its anti-abuse heuristics) strongly favor rendering their button via
// renderButton() rather than trying to fully custom-skin the flow.
let gsiScriptPromise = null;
function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In. Check your internet connection.'));
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
}

/**
 * @param {(idToken: string) => void} onCredential - called with the
 *   raw Google ID token (a signed JWT) the moment someone completes
 *   Google's own sign-in flow. The caller sends this straight to the
 *   backend (`api.loginWithGoogle`) - it's never decoded/trusted here,
 *   since only the backend, holding GOOGLE_CLIENT_ID, can verify it's
 *   genuine.
 * @param {(message: string) => void} [onError]
 * @param {string} [text] - Google's button copy variant: 'signin_with' | 'continue_with'
 */
export default function GoogleSignInButton({ onCredential, onError, text = 'continue_with' }) {
  const containerRef = useRef(null);
  const domId = useId();
  // FIX (direct request: "the UI to log in with Google has been
  // wiped out"): root cause was VITE_GOOGLE_CLIENT_ID missing from
  // the deploy's env vars (.env.production only had VITE_BUILD_ID) -
  // this component was failing silently (console.warn + render
  // nothing), so a misconfigured deploy just showed no button at all
  // with no visible signal why. Surfacing it here so a missing env
  // var is loud instead of an invisible missing feature.
  const missingClientId = !import.meta.env.VITE_GOOGLE_CLIENT_ID;
  // Keep the latest callback in a ref so the Google SDK callback
  // (registered once, on mount) always calls the current version
  // rather than a stale closure from the first render.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      // Fails quietly rather than showing a broken/blank button - this
      // only ever happens if the deployment forgot to set the env var,
      // never as something a real visitor should have to think about.
      console.warn('[GoogleSignInButton] VITE_GOOGLE_CLIENT_ID is not set - the Google sign-in button will not render.');
      return;
    }

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) onCredentialRef.current?.(response.credential);
            else onErrorRef.current?.('Google sign-in did not return a credential. Please try again.');
          },
          // Skips One Tap's floating auto-prompt - this only renders
          // the explicit button below, so it never appears uninvited
          // on a screen someone hasn't chosen to sign in from.
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        const el = document.getElementById(domId);
        if (el) {
          window.google.accounts.id.renderButton(el, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text,
            shape: 'rectangular',
            width: 320,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) onErrorRef.current?.(err.message);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domId, text]);

  if (missingClientId) {
    // Only ever shown when a deploy forgot to set the env var - never
    // something a real visitor with a correctly configured build sees.
    return (
      <div className="google-signin-button google-signin-button--misconfigured" role="alert">
        Google sign-in is not configured for this deployment (missing VITE_GOOGLE_CLIENT_ID).
      </div>
    );
  }

  return <div ref={containerRef} id={domId} className="google-signin-button" />;
}
