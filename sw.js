const CACHE_NAME = 'gestor-permisos-v2-robust';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.ico'
];

// Lista de recursos externos (CDNs) que intentaremos cachear
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// Instalación: Cacheamos lo crítico (local) y tratamos de cachear lo externo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Cachear archivos locales (CRÍTICO: Si falla, la instalación falla)
      await cache.addAll(ASSETS_TO_CACHE);
      
      // 2. Intentar cachear externos (OPCIONAL: Si falla, seguimos adelante)
      // Esto evita que el error de Tailwind rompa toda la PWA
      for (const url of EXTERNAL_ASSETS) {
        try {
          const req = new Request(url, { mode: 'no-cors' }); 
          const res = await fetch(req);
          await cache.put(req, res);
        } catch (e) {
          console.warn('Fallo al pre-cachear recurso externo:', url);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activación: Limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Fetch: Estrategia Stale-While-Revalidate para mayor robustez
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si está en caché, lo devolvemos
      if (cachedResponse) {
        return cachedResponse;
      }
      // Si no, lo pedimos a la red
      return fetch(event.request).then((networkResponse) => {
        // Y lo guardamos para la próxima (si es válido)
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors' && networkResponse.type !== 'opaque') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});