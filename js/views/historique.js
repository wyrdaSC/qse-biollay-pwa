// Écran historique : liste de toutes les fiches, filtrable par type et par
// chantier (§8, Phase 7).

import { FORM_TYPES, libelleType } from "../forms-def.js";
import { listerFiches, listerChantiers } from "../db.js";
import { echapperHtml } from "../util.js";

const STATUT_LABELS = {
  brouillon: "Brouillon",
  complet: "Complet",
  envoye: "Envoyée",
};

let filtreType = "";
let filtreChantier = "";

export async function rendreHistorique() {
  filtreType = "";
  filtreChantier = "";

  const ecran = document.getElementById("ecran");
  ecran.innerHTML = `<h1 class="page-title">Historique</h1><p class="vide">Chargement…</p>`;

  const chantiers = await listerChantiers();

  const optionsType = Object.entries(FORM_TYPES)
    .map(([code, info]) => `<option value="${code}">${echapperHtml(info.label)}</option>`)
    .join("");
  const optionsChantier = chantiers
    .map((c) => `<option value="${echapperHtml(c.nom)}">${echapperHtml(c.nom)}</option>`)
    .join("");

  ecran.innerHTML = `
    <h1 class="page-title">Historique</h1>
    <div class="filtres">
      <select id="filtre-type" class="champ-filtre">
        <option value="">Tous les types</option>
        ${optionsType}
      </select>
      <select id="filtre-chantier" class="champ-filtre">
        <option value="">Tous les chantiers</option>
        ${optionsChantier}
      </select>
    </div>
    <div id="liste-historique"></div>
  `;

  document.getElementById("filtre-type").addEventListener("change", (evenement) => {
    filtreType = evenement.target.value;
    rafraichirListe();
  });
  document.getElementById("filtre-chantier").addEventListener("change", (evenement) => {
    filtreChantier = evenement.target.value;
    rafraichirListe();
  });

  await rafraichirListe();
}

async function rafraichirListe() {
  const conteneur = document.getElementById("liste-historique");
  const fiches = await listerFiches({ type: filtreType, chantier: filtreChantier });

  if (!fiches.length) {
    conteneur.innerHTML = `<p class="vide">Aucune fiche ne correspond à ces filtres.</p>`;
    return;
  }

  conteneur.innerHTML = `
    <ul class="liste-fiches">
      ${fiches
        .map((f) => {
          let meta = [f.chantier || "Sans chantier", f.date || "—"].join(" · ");
          if (f.conforme !== null && f.conforme !== undefined) {
            meta += " · " + (f.conforme ? "Conforme" : "Non conforme");
          }
          return `
            <li>
              <a href="#/fiche/${f.id}">
                <span class="liste-fiches__titre">${echapperHtml(libelleType(f.type))}</span>
                <span class="liste-fiches__meta">${echapperHtml(meta)}</span>
                <span class="badge badge--${f.statut}">${STATUT_LABELS[f.statut] || f.statut}</span>
              </a>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}
