/* ICONOS Panel — Service Worker
   Maneja Web Push y caché mínima para PWA instalable. */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ICONOS Panel", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "ICONOS Panel";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag,
    data: { url: data.url || "/panel" },
    requireInteraction: false,
  };

  // Si el push incluye `badgeCount`, actualizar el badge nativo del PWA
  // (el icono de la app en escritorio/Android muestra el número como Slack/WhatsApp).
  const tareas = [self.registration.showNotification(title, options)];
  if (typeof data.badgeCount === "number" && self.navigator && "setAppBadge" in self.navigator) {
    tareas.push(self.navigator.setAppBadge(data.badgeCount).catch(() => {}));
  }
  event.waitUntil(Promise.all(tareas));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/panel";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
