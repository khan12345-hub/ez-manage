// Ez-Manage Service Worker — handles browser push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Ez-Manage', body: event.data.text() };
  }

  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/favicon.ico',
    badge: payload.badge ?? '/favicon.ico',
    tag: payload.tag ?? 'ezmanage',
    data: { url: payload.url ?? '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(payload.title ?? 'Ez-Manage', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
