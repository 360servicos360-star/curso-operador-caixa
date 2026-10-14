// Service Worker — cache offline-first com estratégia stale-while-revalidate
const CACHE_NAME = 'oc-cache-v1';
const APP_SHELL = [
  '/',
  'index.html',
  'styles.css',
  'app.js',
  'products.json',
  'README.md'
];

// Instalação: pre-cache do app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL.map(url => new Request(url, {cache: 'no-cache'}))).catch(err=>{
        // Alguns hosts não permitem  '/' na cache; tentamos sem
        return cache.addAll(['index.html','styles.css','app.js','products.json']).catch(()=>{});
      });
    })
  );
  self.skipWaiting();
});

// Activation: remove caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Fetch: serve da cache primeiro e faz revalidação em background (stale-while-revalidate)
self.addEventListener('fetch', event => {
  // Ignore requests to other origins
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navigation requests => serve index.html (SPA) from cache then network
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then(cached => {
        const fetchPromise = fetch(req).then(networkRes => {
          caches.open(CACHE_NAME).then(cache => cache.put('index.html', networkRes.clone()));
          return networkRes;
        }).catch(()=>cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // For other requests: try cache, then network, then fallback
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(networkRes => {
        // Atualiza cache em segundo plano
        caches.open(CACHE_NAME).then(cache => {
          cache.put(req, networkRes.clone()).catch(()=>{});
        });
        return networkRes.clone();
      }).catch(()=>{})
      return cached || fetchPromise || new Response('', {status:404});
    })
  );
});
