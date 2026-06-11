// Calculs et règles de conformité (port exact de
// application-qse/app/calculations.py — voir §5 du plan).
// Ce module fait foi pour les calculs affichés en temps réel dans
// js/views/form.js et pour la génération du PDF.

import { RECEPTION_CRITERES, AMBIANCE_COLONNES, SEUIL_XM, SEUIL_XM_S } from "./forms-def.js";

// Convertit une valeur en nombre, ou null si vide / non numérique.
// Accepte la virgule décimale (saisie francophone) comme le point.
export function versNombre(valeur) {
  if (valeur === null || valeur === undefined) return null;
  if (typeof valeur === "number") return valeur;
  const texte = String(valeur).trim().replace(",", ".");
  if (texte === "") return null;
  const nombre = Number(texte);
  return Number.isNaN(nombre) ? null : nombre;
}

// Contrainte d'arrachement xi = Fi / Si (N/mm² = MPa).
// Fi en newtons, Si en mm². Retourne null si données manquantes ou Si <= 0.
export function calculerXi(fi, si) {
  const f = versNombre(fi);
  const s = versNombre(si);
  if (f === null || s === null || s <= 0) return null;
  return f / s;
}

// Écart-type d'échantillon (n-1).
function ecartType(valeurs) {
  const n = valeurs.length;
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / n;
  const sommeCarres = valeurs.reduce((acc, v) => acc + (v - moyenne) ** 2, 0);
  return Math.sqrt(sommeCarres / (n - 1));
}

// Analyse un essai d'arrachement (cohésion ou adhérence).
//
// `mesures` : liste d'objets {rupture, si, fi}.
// `typesAGarder` : Set des types de rupture conservés dans la moyenne.
//
// Retourne { lignes, xm, ecart, xm_s, n_gardes, conforme } — voir §5 du plan.
export function analyserEssai(mesures, typesAGarder) {
  const lignes = [];
  const xiGardes = [];

  for (const mesure of mesures) {
    const rupture = (mesure.rupture || "").trim();
    const xi = calculerXi(mesure.fi, mesure.si);
    const garde = typesAGarder.has(rupture) && xi !== null;
    lignes.push({
      rupture,
      si: versNombre(mesure.si),
      fi: versNombre(mesure.fi),
      xi,
      garde,
    });
    if (garde) xiGardes.push(xi);
  }

  const n = xiGardes.length;
  if (n === 0) {
    return { lignes, xm: null, ecart: null, xm_s: null, n_gardes: 0, conforme: null };
  }

  const xm = xiGardes.reduce((a, b) => a + b, 0) / n;
  const ecart = n >= 2 ? ecartType(xiGardes) : 0;
  const xm_s = xm - ecart;
  const conforme = xm > SEUIL_XM && xm_s >= SEUIL_XM_S;

  return { lignes, xm, ecart, xm_s, n_gardes: n, conforme };
}

// Conformité de la fiche « Réception du support ».
// `reponses` : objet {nom_critere: "oui"|"non"}.
// Conforme si tous les critères sont à « oui » ET pas de remontée d'humidité.
export function conformiteReception(reponses, remonteeHumidite) {
  const tousOui = RECEPTION_CRITERES.every(
    (critere) => (reponses[critere] || "").toLowerCase() === "oui"
  );
  const pasHumidite = (remonteeHumidite || "").toLowerCase() !== "oui";
  return tousOui && pasHumidite;
}

// Conformité d'une ligne de relevé « Conditions d'ambiance ».
// Vérifie les bornes des colonnes numériques + la règle
// T°C support >= T°C point de rosée + 3.
// Retourne null si aucune valeur numérique n'est renseignée (ligne vide).
export function conformiteAmbianceLigne(ligne) {
  const valeurs = [];
  for (const col of AMBIANCE_COLONNES) {
    if (col.min === null && col.max === null) continue; // colonne non numérique
    valeurs.push([versNombre(ligne[col.cle]), col.min, col.max]);
  }

  if (valeurs.every(([v]) => v === null)) return null; // ligne sans aucune mesure

  for (const [v, mini, maxi] of valeurs) {
    if (v === null) return false; // mesure attendue mais manquante
    if (mini !== null && v < mini) return false;
    if (maxi !== null && v > maxi) return false;
  }

  // Règle additionnelle : T support >= T point de rosée + 3
  const tSupport = versNombre(ligne.t_support);
  const tRosee = versNombre(ligne.t_rosee);
  if (tSupport !== null && tRosee !== null && tSupport < tRosee + 3) return false;

  return true;
}

// Conformité globale : toutes les lignes renseignées doivent être conformes.
export function conformiteAmbiance(lignes) {
  const resultats = lignes.map(conformiteAmbianceLigne).filter((r) => r !== null);
  if (resultats.length === 0) return null;
  return resultats.every(Boolean);
}
