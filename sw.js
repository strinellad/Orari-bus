const CACHE_NAME = "orari-bus-v1";

// File dell'app stessa (guscio statico): questi vengono messi in cache subito
// all'installazione, così l'app si apre anche offline.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Orari, calendario scolastico, logica app: tutto vive dentro index.html,
  // quindi "cache-first, poi rete" basta a farli funzionare offline.
  const isAppShell = url.origin === self.location.origin;

  const isMapTile = url.hostname === "tile.openstreetmap.org";

  // Tile della mappa: vengono scaricate apposta dal pulsante "Modalità offline" dell'app,
  // quindi qui usiamo "cache-first" — se già presenti, si evita del tutto la rete (più
  // veloce e funziona anche offline); altrimenti si scaricano ora e si mettono in cache.
  if (isMapTile) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req, { mode: "no-cors" })
          .then((res) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone())).catch(() => {});
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Routing (OSRM) e notizie RSS: qui usiamo "rete, con fallback alla cache" perché sono
  // dati che cambiano (traffico, avvisi) — meglio i più recenti quando la rete c'è.
  if (!isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
