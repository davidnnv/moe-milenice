// Мое Милениче — service worker.
// The site opens even without internet (cached shell); bookings/admin data always go to Supabase (never cached).
// Also shows new-booking notifications for the admin panel.
const VERSION = 'mm-v1';
const SHELL = ['/', '/manifest.webmanifest', '/theme-init.js', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
const DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', (e) => {
  e.waitUntil((DEV ? Promise.resolve() : caches.open(VERSION).then((c) => c.addAll(SHELL))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (DEV) return; // never cache while developing
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase etc. always live

  // Pages: network first, offline → the saved app
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Code, styles, icons, photos: cache first (file names change with every new version)
  if (/^\/(assets|icons|photos)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).pathname.startsWith('/admin'));
      if (open) return open.focus();
      return self.clients.openWindow(target);
    })
  );
});
