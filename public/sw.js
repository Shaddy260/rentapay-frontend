// public/sw.js
//
// Handles two things:
//   1. `push`            - shows the OS/browser notification for an
//      urgent-tier event (payment-confirmation requests, vacate
//      notices, tenant messages) sent from webpush.service.js.
//   2. `notificationclick` - focuses an already-open RentaPay tab if
//      there is one, otherwise opens a new one, landing on the URL
//      the backend included in the push payload.
//
// Also registered unconditionally at app startup (see main.jsx) so the
// browser will offer "Install app" - a registered service worker is
// one of the requirements for that prompt to appear. A `fetch` handler
// is present below (required for Chrome to generate a real WebAPK, see
// comment there), but it deliberately does NOT cache anything: every
// request still always goes straight to the network, so a new deploy
// takes effect the moment someone reloads the installed app - never
// stuck showing old code.

// Required for Chrome/Android to treat this as a full installable PWA
// (WebAPK) rather than a plain bookmark shortcut. Without a `fetch`
// listener present, Chrome still lets people "Add to Home Screen", but
// it does NOT generate a real WebAPK - and pushes from a non-WebAPK
// install get attributed to "Chrome" + the site's origin instead of
// the app's own name/icon. This is why notifications currently show
// as "Chrome · rentapay.co.ke" instead of "RentaPay".
//
// This handler is deliberately a no-op passthrough: it does not cache
// or intercept anything, so every request still always hits the
// network exactly as before. It exists purely to satisfy the
// installability check.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  let data = { title: 'RentaPay', body: '', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Fall back to the defaults above if the payload isn't JSON.
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      // DIRECT FIX: Android's status-bar/lockscreen notification icon
      // (as opposed to the larger icon shown in the shade) must be a
      // white silhouette on a transparent background - Android masks
      // it into a simple shape itself. icon-192.png is a full-color
      // image with an opaque background and no transparency at all,
      // so Android/Chrome couldn't derive a usable badge from it and
      // silently fell back to Chrome's own logo there instead - which
      // is why notifications showed the RentaPay icon in the
      // expanded shade but a plain Chrome icon on the lockscreen.
      badge: '/icon-badge-monochrome.png',
      data: { url: data.url || '/' },
      // FIX (direct request: "notifications... should not land in
      // silently unnoticed"): these two used to be left unset
      // entirely, which is fine on some devices but on others quietly
      // defaults to no vibration at all. Now driven by the sender's
      // stored notification_style (see webpush.service.js) instead of
      // leaving it to chance.
      silent: !!data.silent,
      vibrate: data.vibrate || undefined,
      // Keeps the notification on screen until the person actually
      // dismisses or taps it, instead of auto-disappearing after a
      // few seconds unread - same reasoning as the vibrate/silent fix
      // above, this is about not letting something important slip by
      // unnoticed.
      requireInteraction: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
