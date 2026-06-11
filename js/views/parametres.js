// Écran paramètres : gestion des chantiers et des participants (§8, Phase 7).
// Deux onglets affichés/masqués côté client (pas de sous-route).

import {
  listerChantiers,
  ajouterChantier,
  supprimerChantier,
  listerUtilisateurs,
  ajouterUtilisateur,
  supprimerUtilisateur,
} from "../db.js";
import { echapperHtml } from "../util.js";

let ongletActif = "chantiers";

export async function rendreParametres() {
  ongletActif = "chantiers";
  const ecran = document.getElementById("ecran");
  ecran.innerHTML = `<h1 class="page-title">Paramètres</h1><p class="vide">Chargement…</p>`;
  await rafraichir();
}

async function rafraichir() {
  const ecran = document.getElementById("ecran");
  const [chantiers, utilisateurs] = await Promise.all([listerChantiers(), listerUtilisateurs()]);

  ecran.innerHTML = `
    <h1 class="page-title">Paramètres</h1>
    <div class="onglets-param">
      <button type="button" class="onglet-param ${ongletActif === "chantiers" ? "actif" : ""}" data-onglet="chantiers">Chantiers</button>
      <button type="button" class="onglet-param ${ongletActif === "utilisateurs" ? "actif" : ""}" data-onglet="utilisateurs">Participants</button>
    </div>
    ${ongletActif === "chantiers" ? sectionChantiers(chantiers) : sectionUtilisateurs(utilisateurs)}
  `;

  brancherEvenements();
}

function sectionChantiers(chantiers) {
  const liste = chantiers.length
    ? `
      <ul class="liste-param">
        ${chantiers
          .map(
            (c) => `
              <li>
                <span>${echapperHtml(c.nom)}</span>
                <button type="button" class="bouton-icone" data-supprimer-chantier="${c.id}" title="Supprimer">✕</button>
              </li>
            `
          )
          .join("")}
      </ul>
    `
    : `<p class="vide">Aucun chantier. Les chantiers saisis dans les fiches s'ajoutent automatiquement ici.</p>`;

  return `
    <h2 class="page-subtitle">Chantiers enregistrés</h2>
    <form id="form-ajout-chantier" class="ligne-ajout">
      <input type="text" id="champ-nouveau-chantier" placeholder="Nom du chantier" required>
      <button type="submit" class="btn btn-principal">Ajouter</button>
    </form>
    ${liste}
  `;
}

function sectionUtilisateurs(utilisateurs) {
  const liste = utilisateurs.length
    ? `
      <ul class="liste-param">
        ${utilisateurs
          .map(
            (u) => `
              <li>
                <span>${echapperHtml(u.nom)}${u.role ? ` <em>— ${echapperHtml(u.role)}</em>` : ""}</span>
                <button type="button" class="bouton-icone" data-supprimer-utilisateur="${u.id}" title="Supprimer">✕</button>
              </li>
            `
          )
          .join("")}
      </ul>
    `
    : `<p class="vide">Aucun participant enregistré.</p>`;

  return `
    <h2 class="page-subtitle">Participants / signataires</h2>
    <form id="form-ajout-utilisateur" class="ligne-ajout">
      <input type="text" id="champ-nouveau-nom" placeholder="Nom et prénom" required>
      <input type="text" id="champ-nouveau-role" placeholder="Rôle (ex. Chef d'équipe)">
      <button type="submit" class="btn btn-principal">Ajouter</button>
    </form>
    ${liste}
  `;
}

function brancherEvenements() {
  document.querySelectorAll("[data-onglet]").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      ongletActif = bouton.dataset.onglet;
      rafraichir();
    });
  });

  const formChantier = document.getElementById("form-ajout-chantier");
  if (formChantier) {
    formChantier.addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const champ = document.getElementById("champ-nouveau-chantier");
      await ajouterChantier(champ.value);
      await rafraichir();
    });
  }

  document.querySelectorAll("[data-supprimer-chantier]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!confirm("Supprimer ce chantier ?")) return;
      await supprimerChantier(Number(bouton.dataset.supprimerChantier));
      await rafraichir();
    });
  });

  const formUtilisateur = document.getElementById("form-ajout-utilisateur");
  if (formUtilisateur) {
    formUtilisateur.addEventListener("submit", async (evenement) => {
      evenement.preventDefault();
      const nom = document.getElementById("champ-nouveau-nom");
      const role = document.getElementById("champ-nouveau-role");
      await ajouterUtilisateur(nom.value, role.value);
      await rafraichir();
    });
  }

  document.querySelectorAll("[data-supprimer-utilisateur]").forEach((bouton) => {
    bouton.addEventListener("click", async () => {
      if (!confirm("Supprimer ce participant ?")) return;
      await supprimerUtilisateur(Number(bouton.dataset.supprimerUtilisateur));
      await rafraichir();
    });
  });
}
