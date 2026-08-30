// Service Worker — handles Web Push notifications
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'הבדואים מנחשים';
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
  const targetUrl = event.notification.data?.url || '/WorldCUP-BET/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('WorldCUP-BET') && 'focus' in client) {
          // אפליקציה פתוחה — שלח הודעה ישירה במקום שינוי URL
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
          return client.focus();
        }
      }
      // אפליקציה סגורה — פתח עם URL param
      return clients.openWindow(targetUrl);
    })
  );
});
