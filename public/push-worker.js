// Manejo de notificaciones push (Decisión 9). Archivo fuente aparte del
// service worker principal (public/sw.js) a propósito: ese lo genera
// next-pwa/Workbox en cada build (está en .gitignore) y no debe editarse a
// mano — este archivo se referencia vía la opción `importScripts` de
// next-pwa en next.config.js, que lo inyecta dentro del service worker
// generado. Ambos comparten el mismo `self`, así que estos listeners
// conviven sin problema con el cacheo de Workbox.

self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Caudall', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Caudall';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
