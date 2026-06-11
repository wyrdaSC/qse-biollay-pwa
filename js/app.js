// Point d'entrée de l'application :
// - enregistre le service worker (mode hors-ligne)
// - met à jour l'indicateur réseau (en ligne / hors-ligne)
// - démarre le routeur

import { demarrerRouteur } from "./router.js";

function majIndicateurReseau() {
  const el = document.getElementById("reseau");
  if (!el) return;
  const enLigne = navigator.onLine;
  el.classList.toggle("online", enLigne);
  el.classList.toggle("offline", !enLigne);
  el.title = enLigne ? "En ligne" : "Hors-ligne";
}

function enregistrerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((erreur) => {
      console.error("Échec de l'enregistrement du service worker :", erreur);
    });
  });
}

window.addEventListener("online", majIndicateurReseau);
window.addEventListener("offline", majIndicateurReseau);

majIndicateurReseau();
enregistrerServiceWorker();
demarrerRouteur();
