// Définitions des 4 types de fiches de contrôle (port de forms_def.py).
// Centralise les métadonnées partagées par le routeur, le formulaire générique,
// les calculs et la génération PDF.

// Champs d'en-tête communs à toutes les fiches : [clé, libellé].
export const CHAMPS_COMMUNS = [
  ["numero", "N° de fiche"],
  ["chantier", "Chantier"],
  ["localisation", "Localisation"],
  ["date", "Date"],
  ["controleur", "Contrôleur"],
  ["nature_support", "Nature du support"],
  ["nature_revetement", "Nature du revêtement"],
  ["type_preparation", "Type de préparation"],
];

// --- Fiche 1 : Réception du support (SIA 252) ------------------------------
// Critères évalués Oui/Non (+ champ « Si non, solutions »).
export const RECEPTION_CRITERES = [
  "Propre",
  "Compact",
  "Résistant aux chocs",
  "Non fissuré",
  "Exempt de laitance",
  "Sec en surface",
  "Teneur en eau (méthode CM)",
  "Résistance arrachement ≥ 1.5 MPa (xm, xm-s ≥ 1.0 N/mm²)",
  "Rugosité",
];

// --- Fiches 2 & 3 : essais d'arrachement (cohésion / adhérence) ------------
// Types de rupture à CONSERVER dans le calcul de la moyenne (les autres sont
// éliminés).
export const COHESION_RUPTURES = ["A", "A-Y", "Y", "Y-Z"];
export const COHESION_GARDER = new Set(["A"]);

export const ADHERENCE_RUPTURES = ["A", "A-B", "B", "B-Y", "Y", "Y-Z"];
export const ADHERENCE_GARDER = new Set(["A", "A-B", "B"]);

export const NB_MESURES_DEFAUT = 14; // tableau de 14 mesures par défaut

// Seuils de conformité communs aux deux essais d'arrachement.
export const SEUIL_XM = 1.5; // MPa : moyenne minimale
export const SEUIL_XM_S = 1.0; // MPa : (moyenne - écart-type) minimal

// --- Fiche 4 : Conditions d'ambiance ---------------------------------------
// Colonnes du tableau de mesures répétables + bornes de conformité
// (null = pas de borne de ce côté).
export const AMBIANCE_COLONNES = [
  { cle: "date", label: "Date", min: null, max: null },
  { cle: "heure", label: "Heure", min: null, max: null },
  { cle: "produit", label: "Produit", min: null, max: null },
  { cle: "lot", label: "N° lot", min: null, max: null },
  { cle: "hs", label: "Hs %", min: null, max: 4 },
  { cle: "hr", label: "Hr %", min: null, max: 75 },
  { cle: "t_air", label: "T°C air", min: 10, max: 30 },
  { cle: "t_rosee", label: "T°C point de rosée", min: null, max: null },
  { cle: "t_support", label: "T°C support", min: 10, max: 30 },
  { cle: "t_produit", label: "T°C produit", min: 10, max: 30 },
];

// Registre principal des types de fiches.
export const FORM_TYPES = {
  reception: {
    label: "Réception du support",
    sous_titre: "SIA 252",
  },
  cohesion: {
    label: "Cohésion superficielle du support",
    sous_titre: "Essai d'arrachement",
  },
  adherence: {
    label: "Adhérence sur le support",
    sous_titre: "Essai d'arrachement",
  },
  ambiance: {
    label: "Conditions d'ambiance et d'environnement",
    sous_titre: "Relevés",
  },
};

export function libelleType(typeCode) {
  return FORM_TYPES[typeCode]?.label || typeCode;
}
