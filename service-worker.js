// Service worker : stratégie "cache-first" pour un fonctionnement 100% hors-ligne.
//
// IMPORTANT : à chaque ajout/modification de fichier, incrémenter CACHE_VERSION
// pour forcer la mise à jour du cache (sinon les anciens fichiers restent servis).

const CACHE_VERSION = "v2";
const CACHE_NAME = `qse-biollay-${CACHE_VERSION}`;

// Liste de toutes les ressources nécessaires au fonctionnement hors-ligne.
const RESSOURCES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/router.js",
  "./js/db.js",
  "./vendor/jspdf.umd.min.js",
  "./icons/icon.svg",
  "./icons/logo-biollay.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(RESSOURCES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((nom) => nom !== CACHE_NAME)
          .map((nom) => caches.delete(nom))
      )
    )
  );
  self.clients.claim();
});

// Cache-first : on répond depuis le cache, sinon on va sur le réseau
// (et on met à jour le cache pour la prochaine fois).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((reponseEnCache) => {
      if (reponseEnCache) return reponseEnCache;

      return fetch(event.request)
        .then((reponseReseau) => {
          const copie = reponseReseau.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
          return reponseReseau;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
