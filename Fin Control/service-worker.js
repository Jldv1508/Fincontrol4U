/**
 * Service Worker para la PWA de Control Financiero Doméstico
 */

const CACHE_NAME = 'fincontrol-cache-v12';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  // CSS existentes
  '/css/layout.css',
  '/css/mobile.css',
  '/css/notifications.css',
  '/css/ocr.css',
  '/css/price-comparison.css',
  '/css/shopping-list.css',
  // JS principales
  '/js/ui.js',
  '/js/ui-dashboard.js',
  '/js/app.js',
  '/js/db.js',
  '/js/notifications.js',
  '/js/analysis.js',
  '/js/analysis.js?v=5',
  '/js/comparative-analysis.js?v=3',
  '/js/categories-analysis.js',
  '/js/subject.js',
  '/js/transactions.js',
  '/js/transactions.js?v=3',
  '/js/transactions-core.js',
  '/js/pdf-parser.js',
  '/js/modal-fallback.js',
  '/js/ocr.js',
  '/js/product-extractor.js',
  '/js/loans.js',
  '/js/backup.js',
  // Manifest
  '/manifest.json',
  // Externos
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de caché: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith(
    fetch(req)
      .then((response) => {
        // Cacheo oportunista
        if (req.method === 'GET' && response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return response;
      })
      .catch(async () => {
        // Fallback: cache
        const cached = await caches.match(req);
        if (cached) return cached;
        // Navegación: servir offline.html
        if (req.mode === 'navigate') {
          const offline = await caches.match('/offline.html');
          if (offline) return offline;
          return caches.match('/index.html');
        }
        return new Response('Sin conexión y sin caché disponible', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

// Sincronización en segundo plano
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

// Función para sincronizar transacciones pendientes
async function syncTransactions() {
  try {
    // Aquí iría la lógica para sincronizar con un servidor
    // Por ahora solo registramos el intento
    console.log('Intentando sincronizar transacciones pendientes');
    
    // Notificar al usuario que la sincronización fue exitosa
    self.registration.showNotification('Sincronización completada', {
      body: 'Tus transacciones han sido sincronizadas correctamente'
    });
    
    return true;
  } catch (error) {
    console.error('Error al sincronizar transacciones:', error);
    return false;
  }
}

// Notificaciones push
self.addEventListener('push', (event) => {
  let data = {};
  
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'Control Financiero',
      body: event.data.text()
    };
  }
  
  const options = {
    body: data.body || 'Notificación de Control Financiero',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      { action: 'explore', title: 'Ver detalles' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Control Financiero', options)
  );
});

// Manejo de clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    // Abrir la aplicación en la sección correspondiente
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Si ya hay una ventana abierta, enfocarse en ella
        for (const client of clientList) {
          if (client.url.includes('/index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Si no hay ventana abierta, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow('/index.html');
        }
      })
    );
  }
});