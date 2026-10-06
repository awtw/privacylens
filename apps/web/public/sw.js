// PrivacyLens service worker: cache-first for same-origin assets so the app works offline after first load.
const CACHE = 'privacylens-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './favicon.svg', './icon-192.png', './icon-512.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  // Page asks to precache a list of URLs (OCR assets) so they are available offline before first use.
  if (e.data?.type === 'precache') {
    e.waitUntil(
      caches.open(CACHE).then((c) => Promise.all(e.data.urls.map((u) => c.add(u).catch(() => {})))).then(() => {
        e.source?.postMessage({ type: 'precached' });
      }),
    );
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: false }).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => (req.mode === 'navigate' ? caches.match('./') : Response.error())),
    ),
  );
});
