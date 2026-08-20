/* Neuro App CHSC — offline shell.
   Cache-first for the app shell so the tools work at the bedside
   with no network. Nothing patient-related is ever cached or sent. */
const CACHE = 'neuro-chsc-v3';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './nihss.js',
  './manifest.webmanifest',
  './assets/chsc-800.jpg',
  './assets/chsc-1200.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // let fonts go to the network
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => caches.match('./index.html'))
    )
  );
});
