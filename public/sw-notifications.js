// Service Worker Notification Handler for Clara PWA
// Handles native device notification interactions (Android, iOS PWA, Windows, macOS)

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If Clara is already open in a tab or standalone window, bring it to the foreground
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // If Clara was closed, open the app
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
