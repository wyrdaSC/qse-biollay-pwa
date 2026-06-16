// Service worker : stratégie "cache-first" pour un fonctionnement 100% hors-ligne.
//
// VERSIONNAGE : schéma "v2.x" depuis l'ajout de la couche serveur central
// (l'app hors-ligne seule était allée jusqu'à v15 sous l'ancien schéma incrémental v1..v15).
// Baseline = v2.0. À CHAQUE ajout/modification de fichier : incrémenter CACHE_VERSION
// (v2.1, v2.2, …) ET ajouter le(s) nouveau(x) fichier(s) à RESSOURCES — sinon les anciens
// fichiers restent servis depuis le cache (piège connu).

const CACHE_VERSION = "v2.0";
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
  "./js/forms-def.js",
  "./js/util.js",
  "./js/install.js",
  "./js/calculations.js",
  "./js/signature.js",
  "./js/pdf.js",
  "./js/views/home.js",
  "./js/views/form.js",
  "./js/views/consultation.js",
  "./js/views/historique.js",
  "./js/views/parametres.js",
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
