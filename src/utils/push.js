// src/utils/push.js
//
// "Live push" frontend half. Registers public/sw.js, asks the browser
// for the notification permission, and subscribes the resulting
// PushSubscription with the backend (POST /api/push/subscribe) so
// notify.service.js / webpush.service.js can reach this device for
// the urgent tier (payment-confirmation requests, vacate notices,
// tenant messages).
//
// Safe to call on every portal load: it no-ops quietly if the browser
// doesn't support push, the person has already denied/dismissed the
// permission prompt, or the backend has no VAPID keys configured -
// none of that should ever block the rest of the app from working.

import { api } from '../api/client.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the service worker, requests notification permission if
 * not already decided, and subscribes with the backend. Call once per
 * portal session, after a token is available (e.g. in a useEffect
 * keyed on `token`).
 */
function isRunningStandalone() {
  if (typeof window === 'undefined') return false;
  // display-mode: standalone = installed PWA/TWA. iOS Safari doesn't
  // support that media query, hence the navigator.standalone fallback.
  return (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator?.standalone === true
  );
}

const STANDALONE_SUBSCRIPTION_FLAG = 'rentapay_push_subscribed_standalone';

export async function initPushSubscription(token) {
  if (!token) return;
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return; // unsupported browser - quiet no-op

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    // Don't re-prompt someone who already said no - only ask if the
    // permission is still in its initial, undecided state.
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }
    if (Notification.permission !== 'granted') return;

    // DIRECT REQUEST: "users will mostly interact with the platform
    // from the browser first before installing the app" - a
    // subscription created in a regular browser tab keeps showing
    // "Chrome" branding forever once installed, since the check below
    // (`if (!subscription)`) never re-subscribes if one already
    // exists. This auto-detects "I'm running installed right now, but
    // my subscription was never confirmed as created from inside the
    // installed app" and silently swaps it for a fresh one - no
    // button, no prompt, just fixes itself the first time someone
    // opens the installed app after having used the browser before.
    // The flag lives in localStorage (not sessionStorage) specifically
    // so it survives across logout/login and isn't re-triggered every
    // session once fixed.
    const standalone = isRunningStandalone();
    const alreadyFixed = window.localStorage?.getItem(STANDALONE_SUBSCRIPTION_FLAG) === 'true';
    let subscription = await registration.pushManager.getSubscription();

    if (standalone && subscription && !alreadyFixed) {
      try {
        await subscription.unsubscribe();
      } catch {
        // Non-fatal - proceed to create a new one regardless.
      }
      subscription = null;
    }

    if (!subscription) {
      const { publicKey } = await api.getVapidPublicKey();
      if (!publicKey) return; // backend has no VAPID keys set up yet

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.subscribePush(subscription.toJSON(), token);
    if (standalone) {
      window.localStorage?.setItem(STANDALONE_SUBSCRIPTION_FLAG, 'true');
    }
  } catch (err) {
    // Never let a push-setup failure surface to the person using the
    // app - same "never blocks the real feature" philosophy as
    // notify.service.js on the backend.
    console.warn('[push] initPushSubscription failed (non-blocking):', err.message);
  }
}

/**
 * Manual fallback for the auto-fix in initPushSubscription() above.
 * REMOVED (spec item 13): the "Fix notifications on this device"
 * button that called this has been removed entirely from the product
 * (landlord Settings and tenant portal) and was resubscribePush()'s
 * only caller, so the function itself is removed too rather than
 * left as dead code. The auto-fix in initPushSubscription() above
 * still runs on its own and is unaffected.
 */
