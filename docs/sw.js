const CACHE = 'polish-v2';
const ASSETS = [
  './',
  './index.html',
  './srs.js',
  './app.js',
  './manifest.json',
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
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
