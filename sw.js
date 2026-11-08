/* Trackbase service worker
   What it does:
   - On first visit it saves the app files, so the app opens even with no internet.
   - For the app page itself it asks the network first (so you always get your newest version
     when online) and falls back to the saved copy when offline or the network is slow.
   - Icons and the manifest are served from the saved copy for speed.
   To force everyone onto a fresh cache after you change files, bump the number in CACHE. */
const CACHE = 'trackbase-v1';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-48.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  /* remove caches from older versions, then take control of open tabs */
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Try the network, but give up after `ms` so a bad connection doesn't hang the app. */
const timeout = (ms, p) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('timeout')), ms);
  p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; /* leave everything else alone */

  /* The app page: network first, saved copy as fallback. */
  if (req.mode === 'navigate') {
    event.respondWith(
      timeout(4000, fetch(req)).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  /* Icons, manifest: saved copy first, otherwise fetch and save. Only our own files are kept. */
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
