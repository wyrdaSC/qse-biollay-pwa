// Définitions des types de fiches de contrôle.
// Phase 3 : uniquement FORM_TYPES (libellés pour l'accueil).
// Le reste (critères, types de rupture, bornes, seuils) sera ajouté en Phase 4.

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
