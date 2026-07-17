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
// one of the requirements for that prompt to appear. Deliberately still
// does NOT cache anything: no fetch handler here means every request
// always goes to the network, so a new deploy takes effect the moment
// someone reloads the installed app - never stuck showing old code.

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
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
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
