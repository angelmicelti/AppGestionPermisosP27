// Nombre de la caché - CAMBIA ESTE NÚMERO CADA VEZ QUE ACTUALICES
const CACHE_NAME = 'gestor-permisos-v1.20';  // <-- Cambia el número de versión
const APP_VERSION = '1.20';

// Archivos a cachear
const ARCHIVOS_CACHE = [
  './',
  './index.html',
  // Mantén los recursos de CDN aquí
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

// --- ESTRATEGIA DE ACTUALIZACIÓN MEJORADA ---

// Evento 'install'
self.addEventListener('install', event => {
  console.log('[SW] Instalando versión:', APP_VERSION);
  
  // Fuerza la activación inmediata, incluso con pestañas abiertas
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando archivos esenciales');
        return cache.addAll(ARCHIVOS_CACHE);
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting(); // Doble seguridad
      })
  );
});

// Evento 'activate'
self.addEventListener('activate', event => {
  console.log('[SW] Activado versión:', APP_VERSION);
  
  event.waitUntil(
    // Limpiar todas las cachés antiguas
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Reclamar control inmediatamente sobre todas las pestañas
      return self.clients.claim();
    }).then(() => {
      // Enviar mensaje a todas las pestañas para recargar
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// Evento 'fetch' - ESTRATEGIA DE ACTUALIZACIÓN AGGRESIVA
self.addEventListener('fetch', event => {
  // Para index.html, siempre intenta red primero (para obtener actualizaciones)
  if (event.request.url.includes('/index.html') || 
      event.request.mode === 'navigate') {
    console.log('[SW] Fetch para HTML, usando network-first');
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si hay respuesta de red, actualiza la caché
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // Si falla la red, usa la caché
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Para recursos estáticos de CDN, usa cache-first pero con validación
  if (event.request.url.includes('cdn.jsdelivr.net') || 
      event.request.url.includes('cdnjs.cloudflare.com') ||
      event.request.url.includes('unpkg.com')) {
    
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Siempre hacer fetch en segundo plano para actualizar
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              // Actualizar caché con nueva versión
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
              return networkResponse;
            })
            .catch(() => {}); // Ignorar errores en fetch de fondo
          
          // Devolver caché inmediatamente, pero actualizar en segundo plano
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }
  
  // Para API de GitHub, network only
  if (event.request.url.includes('api.github.com')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Para el resto, cache-first normal
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// Escuchar mensajes desde la página web
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Verificar actualizaciones
    self.registration.update()
      .then(() => {
        console.log('[SW] Actualización verificada');
      });
  }
});

// Verificar actualizaciones cada 1 hora
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-updates') {
    console.log('[SW] Verificando actualizaciones periódicas');
    self.registration.update();
  }
});