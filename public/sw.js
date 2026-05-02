// Service Worker — handles Web Push notifications
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'מונדיאל הימורים';
  const options = {
    body: data.body || '',
    icon: '/WorldCUP-BET/icon.svg',
    badge: '/WorldCUP-BET/icon.svg',
    dir: 'rtl',
    lang: 'he',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: { url: data.url || '/WorldCUP-BET/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('WorldCUP-BET') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/WorldCUP-BET/');
    })
  );
});
