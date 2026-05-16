const CACHE_VERSION = "uvci-calculatrice-v2";

// Fichiers indispensables au lancement rapide et au mode hors ligne.
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./pwa-install.js",
  "./manifest.json",
  "./logo.calc.uvci.jpeg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  // Precache l'application pour qu'elle puisse s'ouvrir sans connexion.
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // Nettoie les anciens caches quand une nouvelle version est deployee.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Les navigations HTML reviennent sur index.html en hors ligne.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copie = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("./index.html", copie));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Strategie cache-first pour les assets locaux, avec mise a jour en arriere-plan.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copie = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copie));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
