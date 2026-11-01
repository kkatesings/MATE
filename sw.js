const CACHE_NAME = 'mate-shell-v3';
const APP_SHELL = [
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './src/data.js',
  './src/i18n.js',
  './src/firebase-config.js',
  './src/privacy-config.js',
  './src/analytics.js',
  './src/matt.js',
  './src/cloud-sync.js',
  './src/screens.js',
  './src/app.js',
  './icons/mate-192.svg',
  './icons/mate-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('mate-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request)
      .then(response => {
        if (!response.ok) return response;
        return caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()).then(() => response));
      })
      .catch(() => caches.match(new URL('./index.html', self.registration.scope).href).then(cached => cached || Response.error())));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (!response.ok) return response;
    return caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()).then(() => response));
  })));
});
