import { useEffect, useRef } from 'react';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';

// FEATURE (direct request): "After a user logs in, if there is no
// activity for 30 minutes, the session should automatically expire
// and log the user out. On the next attempt to access the app,
// display a clear message: 'Session expired. Please log in again.'"
//
// Mounted once, app-wide, inside the router (see App.jsx) so it
// applies identically to every portal (landlord, tenant, manager,
// caretaker, admin) rather than being wired into each page
// separately. Only actually does anything while a session token
// exists - nothing runs on the public login/landing/listings pages
// where there's no session to expire in the first place.
//
// Reuses the exact same sessionStorage handoff the lockdown-logout
// path already uses (see api/client.js: rentapay_logout_message +
// Login.jsx reading it back as infoMessage), so this shows the same
// kind of banner on the login screen rather than inventing a second,
// inconsistent mechanism.
const TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'wheel'];

export default function InactivityLogout() {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    function hasSession() {
      return !!localStorage.getItem('rentapay_token');
    }

    function expireSession() {
      if (!hasSession()) return;
      localStorage.removeItem('rentapay_token');
      localStorage.removeItem('rentapay_role');
      localStorage.removeItem('rentapay_role_level');
      localStorage.removeItem('rentapay_phone');
      localStorage.removeItem('rentapay_active_property_id');
      localStorage.setItem('rentapay_logout_message', 'Session expired. Please log in again.');
      navigate('/login', { replace: true });
    }

    function armTimer(delayMs) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!hasSession()) return;
      timerRef.current = setTimeout(expireSession, delayMs);
    }

    function onActivity() {
      lastActivityRef.current = Date.now();
      armTimer(TIMEOUT_MS);
    }

    // Browsers throttle/pause setTimeout in a backgrounded tab, so a
    // laptop lid closed for over 30 minutes might not fire the timer
    // exactly on schedule. Checking real elapsed time the moment the
    // tab becomes visible again catches that case immediately instead
    // of only on the next click/keystroke.
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= TIMEOUT_MS) {
        expireSession();
      } else {
        armTimer(TIMEOUT_MS - elapsed);
      }
    }

    armTimer(TIMEOUT_MS);
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
