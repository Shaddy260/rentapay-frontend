// public/sw.js
//
// "Live push" service worker. Only handles two things:
//   1. `push`            - shows the OS/browser notification for an
//      urgent-tier event (payment-confirmation requests, vacate
//      notices, tenant messages) sent from webpush.service.js.
//   2. `notificationclick` - focuses an already-open RentaPay tab if
//      there is one, otherwise opens a new one, landing on the URL
//      the backend included in the push payload.
//
// Deliberately does nothing else (no caching, no offline support) -
// this app isn't a full PWA, this file exists purely to satisfy the
// browser's requirement that push notifications be handled by a
// registered service worker.

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
      icon: '/favicon.ico',
      badge: '/favicon.ico',
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
