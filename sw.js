// Nombre de la caché
const CACHE_NAME = 'gestor-permisos-v1.2';
const APP_VERSION = '1.2.0';

// Archivos a cachear (URLs absolutas para los recursos de CDN)
const ARCHIVOS_CACHE = [
  './',  // Página principal
  './index.html',
  
  // Recursos de CDN que queremos cachear
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// Evento 'install': se dispara cuando se instala el service worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  
  // Esperamos a que se abra la caché y se añadan los archivos
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cacheando archivos esenciales');
        return cache.addAll(ARCHIVOS_CACHE);
      })
      .then(() => {
        console.log('Service Worker: Instalación completada');
        // Forzar que el service worker se active inmediatamente
        return self.skipWaiting();
      })
  );
});

// Evento 'activate': se dispara cuando el service worker se activa
self.addEventListener('activate', event => {
  console.log('Service Worker: Activado');
  
  // Eliminar cachés antiguas si existen
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Borrando caché antigua', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Reclamar control sobre todas las pestañas abiertas
      return self.clients.claim();
    })
  );
});

// Evento 'fetch': intercepta las peticiones de red
self.addEventListener('fetch', event => {
  // Evitar peticiones a chrome-extension://
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Para las peticiones a la API de GitHub, no usar caché
  if (event.request.url.includes('api.github.com')) {
    // Network only para GitHub API
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Para las peticiones de CDNs externos, network-first
  if (event.request.url.includes('cdn.jsdelivr.net') || 
      event.request.url.includes('cdnjs.cloudflare.com') ||
      event.request.url.includes('unpkg.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la respuesta es válida, la devolvemos
          return response;
        })
        .catch(() => {
          // Si falla, intentamos devolver de la caché
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Para el resto de recursos (principalmente nuestra app): cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, lo devolvemos
        if (response) {
          return response;
        }
        
        // Si no está en caché, hacemos la petición a red
        return fetch(event.request)
          .then(response => {
            // Verificamos que la respuesta sea válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clonamos la respuesta porque sólo se puede consumir una vez
            const responseToCache = response.clone();
            
            // Abrimos la caché y guardamos la respuesta
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Si falla la red y no tenemos el recurso en caché,
            // podríamos devolver una página de error personalizada
            // Por ahora, simplemente devolvemos undefined
            console.log('Service Worker: Error en fetch para', event.request.url);
          });
      })
  );
});

// Evento 'message': para comunicación desde la página web
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Evento 'sync': para sincronización en segundo plano
self.addEventListener('sync', event