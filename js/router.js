// Routeur par hash (#/...).
// Routes :
//   #/                         -> écran d'accueil
//   #/fiche/nouvelle/:type     -> nouveau formulaire du type
//   #/fiche/:id                -> consultation (ou édition si brouillon)
//   #/historique               -> liste filtrable
//   #/parametres               -> chantiers + participants

import { rendreAccueil } from "./views/home.js";
import { rendreFormulaire } from "./views/form.js";

const ECRAN = () => document.getElementById("ecran");

// Affiche un écran provisoire pour les routes pas encore implémentées.
function rendreProvisoire(titre) {
  ECRAN().innerHTML = `
    <h1 class="page-title">${titre}</h1>
    <p class="vide">Écran en cours de construction.</p>
  `;
}

// Met en surbrillance l'onglet de la barre du bas correspondant à la route
// (chaîne vide = aucun onglet actif, par ex. sur un formulaire).
function majOngletActif(route) {
  document.querySelectorAll(".tabbar__item").forEach((lien) => {
    lien.classList.toggle("actif", lien.dataset.route === route);
  });
}

const ROUTES = [
  {
    motif: /^\/$/,
    gestion: () => {
      majOngletActif("/");
      rendreAccueil();
    },
  },
  {
    motif: /^\/historique$/,
    gestion: () => {
      majOngletActif("/historique");
      rendreProvisoire("Historique");
    },
  },
  {
    motif: /^\/parametres$/,
    gestion: () => {
      majOngletActif("/parametres");
      rendreProvisoire("Paramètres");
    },
  },
  {
    motif: /^\/fiche\/nouvelle\/(\w+)$/,
    gestion: (m) => {
      majOngletActif("");
      rendreFormulaire(m[1]);
    },
  },
  {
    motif: /^\/fiche\/(\d+)$/,
    gestion: (m) => {
      majOngletActif("");
      rendreProvisoire(`Fiche n°${m[1]}`);
    },
  },
];

function rendre() {
  const hash = window.location.hash.replace(/^#/, "") || "/";

  for (const route of ROUTES) {
    const correspondance = hash.match(route.motif);
    if (correspondance) {
      route.gestion(correspondance);
      return;
    }
  }

  // Route inconnue -> retour à l'accueil.
  majOngletActif("/");
  rendreAccueil();
}

export function demarrerRouteur() {
  window.addEventListener("hashchange", rendre);
  if (!window.location.hash) {
    window.location.hash = "#/";
  }
  rendre();
}
