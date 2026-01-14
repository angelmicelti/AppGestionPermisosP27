const CACHE_NAME = 'gestor-permisos-v4-static';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.ico'
];

// Usamos cdnjs que es mucho más estable y rápido
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Archivos locales
      await cache.addAll(ASSETS_TO_CACHE);
      
      // 2. Archivos externos (modo no-cors para evitar errores de bloqueo)
      for (const url of EXTERNAL_ASSETS) {
        try {
          const req = new Request(url, { mode: 'no-cors' });
          const res = await fetch(req);
          await cache.put(req, res);
        } catch (e) {
          console.warn('No se pudo cachear:', url);
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((networkResponse) => {
        // Cachear nuevas peticiones dinámicamente
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => console.log('Offline'));
    })
  );
});