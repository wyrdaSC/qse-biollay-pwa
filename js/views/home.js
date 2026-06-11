// Écran d'accueil : 4 boutons (un par type de fiche), fiches récentes,
// compteur de fiches non envoyées.

import { FORM_TYPES } from "../forms-def.js";
import { listerFiches, compterNonEnvoyees } from "../db.js";
import { echapperHtml } from "../util.js";

const STATUT_LABELS = {
  brouillon: "Brouillon",
  complet: "Complet",
  envoye: "Envoyée",
};

const NB_RECENTES = 5;

export async function rendreAccueil() {
  const ecran = document.getElementById("ecran");
  ecran.innerHTML = `<h1 class="page-title">Accueil</h1><p class="vide">Chargement…</p>`;

  const [fiches, nonEnvoyees] = await Promise.all([
    listerFiches(),
    compterNonEnvoyees(),
  ]);

  const cartes = Object.entries(FORM_TYPES)
    .map(
      ([type, info]) => `
        <a class="carte-fiche" href="#/fiche/nouvelle/${type}">
          <span class="carte-fiche__label">${echapperHtml(info.label)}</span>
          <span class="carte-fiche__sous">${echapperHtml(info.sous_titre)}</span>
        </a>
      `
    )
    .join("");

  const recentes = fiches.slice(0, NB_RECENTES);
  const liste = recentes
    .map((f) => {
      const titre = FORM_TYPES[f.type]?.label || f.type;
      const meta = [f.chantier, f.date].filter(Boolean).join(" · ") || "—";
      return `
        <li>
          <a href="#/fiche/${f.id}">
            <span class="liste-fiches__titre">${echapperHtml(titre)}</span>
            <span class="liste-fiches__meta">${echapperHtml(meta)}</span>
            <span class="badge badge--${f.statut}">${STATUT_LABELS[f.statut] || f.statut}</span>
          </a>
        </li>
      `;
    })
    .join("");

  const rappel =
    nonEnvoyees > 0
      ? `<div class="rappel">${nonEnvoyees} fiche${nonEnvoyees > 1 ? "s" : ""} non envoyée${nonEnvoyees > 1 ? "s" : ""}</div>`
      : "";

  ecran.innerHTML = `
    <h1 class="page-title">Accueil</h1>
    ${rappel}
    <div class="grille-boutons">${cartes}</div>
    <h2 class="page-subtitle">Fiches récentes</h2>
    ${recentes.length ? `<ul class="liste-fiches">${liste}</ul>` : `<p class="vide">Aucune fiche enregistrée pour l'instant.</p>`}
  `;
}
