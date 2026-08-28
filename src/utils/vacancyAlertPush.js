// src/utils/vacancyAlertPush.js
//
// DIRECT REQUEST: real browser push notifications for vacancies,
// available to ANY visitor - no account, no login. Mirrors
// utils/push.js's shape (same VAPID/subscribe dance, same sw.js) but
// talks to the anonymous /public/vacancy-alerts/* endpoints instead
// of the logged-in-only /push/* ones, and is never called
// automatically on page load - only from an explicit tap on the
// VacancyAlertOptIn widget's "Enable" button, since asking the
// browser for notification permission uninvited is exactly the kind
// of behavior that gets a site's permission prompts auto-blocked.

import { api } from '../api/client.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Requests notification permission (this WILL show the browser's
 * native prompt - only call from a direct user tap) and subscribes
 * this browser for anonymous vacancy alerts, optionally scoped to a
 * county. Returns 'granted' | 'denied' | 'unsupported' | 'error'.
 */
export async function subscribeToVacancyAlerts(county) {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return 'denied';
    }
    if (Notification.permission !== 'granted') return 'denied';

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const { publicKey } = await api.getVacancyAlertVapidPublicKey();
      if (!publicKey) return 'error';
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.subscribeVacancyAlerts(subscription.toJSON(), county || null);
    return 'granted';
  } catch (err) {
    console.warn('[vacancyAlertPush] subscribe failed (non-blocking):', err.message);
    return 'error';
  }
}

/** Best-effort unsubscribe, e.g. if the visitor changes their mind from the county picker. */
export async function unsubscribeFromVacancyAlerts() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await api.unsubscribeVacancyAlerts(subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    console.warn('[vacancyAlertPush] unsubscribe failed (non-blocking):', err.message);
  }
}
