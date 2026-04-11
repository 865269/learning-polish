const CACHE = 'polish-v3';

// App shell — served network-first so updates deploy automatically
const SHELL = [
  './',
  './index.html',
  './srs.js',
  './app.js',
  './manifest.json',
];

// Chapter data — served cache-first (rarely changes, large-ish)
const DATA = [
  './data/chapter1.json',
  './data/chapter2.json',
  './data/chapter3.json',
  './data/chapter4.json',
  './data/chapter5.json',
  './data/chapter6.json',
  './data/chapter7.json',
  './data/chapter8.json',
  './data/chapter9.json',
  './data/chapter10.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([...SHELL, ...DATA])));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isData = url.pathname.includes('/data/');

  if (isData) {
    // Cache-first: serve cached chapter JSON, fall back to network
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  } else {
    // Network-first: always try to get fresh app shell, fall back to cache offline
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});
