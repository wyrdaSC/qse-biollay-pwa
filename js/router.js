// Routeur par hash (#/...).
// Phase 1 : squelette minimal qui affiche un écran d'attente et met en
// surbrillance l'onglet actif. Les vraies routes seront branchées en Phase 3.

const ECRAN = () => document.getElementById("ecran");

function rendreProvisoire(titre) {
  ECRAN().innerHTML = `
    <h1 class="page-title">${titre}</h1>
    <p class="vide">Écran en cours de construction (Phase 3).</p>
  `;
}

// Met à jour la classe "actif" sur l'onglet correspondant à la route.
function majOngletActif(route) {
  document.querySelectorAll(".tabbar__item").forEach((lien) => {
    lien.classList.toggle("actif", lien.dataset.route === route);
  });
}

function rendre() {
  // On ne garde que le premier segment de la route pour l'instant
  // (#/, #/historique, #/parametres, ...).
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const segment = "/" + (hash.split("/")[1] || "");

  switch (segment) {
    case "/historique":
      majOngletActif("/historique");
      rendreProvisoire("Historique");
      break;
    case "/parametres":
      majOngletActif("/parametres");
      rendreProvisoire("Paramètres");
      break;
    case "/fiche":
      majOngletActif("");
      rendreProvisoire("Fiche");
      break;
    default:
      majOngletActif("/");
      rendreProvisoire("Accueil");
  }
}

export function demarrerRouteur() {
  window.addEventListener("hashchange", rendre);
  if (!window.location.hash) {
    window.location.hash = "#/";
  }
  rendre();
}
