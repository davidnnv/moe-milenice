// Service worker for the admin panel: only shows notifications and opens the panel on click.
// It does not cache anything.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).pathname.startsWith('/admin'));
      if (open) return open.focus();
      return self.clients.openWindow('/admin');
    })
  );
});
