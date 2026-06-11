// Gestion de l'invite d'installation PWA (« Ajouter à l'écran d'accueil »),
// via l'événement beforeinstallprompt (Chrome/Android — non supporté par Safari/iOS).

let evenementDiffere = null;
let dejaInstalle = false;

window.addEventListener("beforeinstallprompt", (evenement) => {
  evenement.preventDefault();
  evenementDiffere = evenement;
  window.dispatchEvent(new Event("qse:installation-disponible"));
});

window.addEventListener("appinstalled", () => {
  dejaInstalle = true;
  evenementDiffere = null;
  window.dispatchEvent(new Event("qse:installation-disponible"));
});

export function installationDisponible() {
  return !dejaInstalle && evenementDiffere !== null;
}

export async function lancerInstallation() {
  if (!evenementDiffere) return false;
  evenementDiffere.prompt();
  const choix = await evenementDiffere.userChoice;
  evenementDiffere = null;
  return choix.outcome === "accepted";
}
