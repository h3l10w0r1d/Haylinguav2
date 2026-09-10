// public/sw.js — minimal service worker whose only job is receiving Web
// Push messages and showing them as a notification. Not a full offline/PWA
// cache worker — nothing here intercepts fetch(), so it can't break normal
// page loads if something in the push handler ever throws.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Payload wasn't JSON (shouldn't happen — backend/webpush.py always
    // sends JSON) — fall back to a generic notification rather than dropping it.
  }

  const title = data.title || "Haylingua";
  const options = {
    body: data.body || "",
    icon: "/web-app-manifest-192x192.png",
    badge: "/favicon-96x96.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the notification focuses an already-open Haylingua tab at that
// URL if one exists, instead of always spawning a new tab.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
