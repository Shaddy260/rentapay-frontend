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

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const { publicKey } = await api.getVapidPublicKey();
      if (!publicKey) return; // backend has no VAPID keys set up yet

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.subscribePush(subscription.toJSON(), token);
  } catch (err) {
    // Never let a push-setup failure surface to the person using the
    // app - same "never blocks the real feature" philosophy as
    // notify.service.js on the backend.
    console.warn('[push] initPushSubscription failed (non-blocking):', err.message);
  }
}
