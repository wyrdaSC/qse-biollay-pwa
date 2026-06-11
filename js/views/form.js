// Formulaire générique : rend le formulaire d'un type de fiche donné
// (en-tête commun + corps spécifique + signatures + boutons d'action),
// piloté par js/forms-def.js.

import {
  FORM_TYPES,
  CHAMPS_COMMUNS,
  RECEPTION_CRITERES,
  COHESION_RUPTURES,
  ADHERENCE_RUPTURES,
  NB_MESURES_DEFAUT,
  AMBIANCE_COLONNES,
  SEUIL_XM,
  SEUIL_XM_S,
} from "../forms-def.js";
import { listerChantiers, listerUtilisateurs } from "../db.js";
import { echapperHtml } from "../util.js";

export async function rendreFormulaire(type, ficheExistante = null) {
  const ecran = document.getElementById("ecran");
  const info = FORM_TYPES[type];

  if (!info) {
    ecran.innerHTML = `<h1 class="page-title">Type de fiche inconnu</h1>`;
    return;
  }

  const entete = ficheExistante || {};
  const data = ficheExistante?.data || {};

  const [chantiers, utilisateurs] = await Promise.all([
    listerChantiers(),
    listerUtilisateurs(),
  ]);

  ecran.innerHTML = `
    <h1 class="page-title">${echapperHtml(info.label)} <small>${echapperHtml(info.sous_titre)}</small></h1>
    <form id="formulaire-fiche" novalidate>
      <section>
        <h2 class="page-subtitle">Informations générales</h2>
        <div class="grille-champs">
          ${CHAMPS_COMMUNS.map(([cle, label]) => champCommun(cle, label, entete)).join("")}
        </div>
      </section>

      <section>
        ${corpsSpecifique(type, data)}
      </section>

      <section>
        <h2 class="page-subtitle">Signatures</h2>
        ${zoneSignature("applicateur", "Applicateur", data)}
        ${zoneSignature("controleur", "Contrôleur extérieur", data)}
      </section>

      <div class="boutons-action">
        <button type="button" id="btn-brouillon" class="btn btn-secondaire">Enregistrer brouillon</button>
        <button type="button" id="btn-pdf" class="btn btn-principal">Générer PDF</button>
      </div>
    </form>

    <datalist id="liste-chantiers">
      ${chantiers.map((c) => `<option value="${echapperHtml(c.nom)}">`).join("")}
    </datalist>
    <datalist id="liste-utilisateurs">
      ${utilisateurs.map((u) => `<option value="${echapperHtml(u.nom)}">`).join("")}
    </datalist>
  `;

  brancherEvenements(type);
}

// --- En-tête commun ---------------------------------------------------------

function champCommun(cle, label, entete) {
  let valeur = entete[cle] ?? "";
  if (cle === "date" && !valeur) {
    valeur = new Date().toISOString().slice(0, 10);
  }
  const typeChamp = cle === "date" ? "date" : "text";
  let attrsListe = "";
  if (cle === "chantier") attrsListe = ' list="liste-chantiers"';
  if (cle === "controleur") attrsListe = ' list="liste-utilisateurs"';

  return `
    <div class="champ">
      <label for="champ-${cle}">${echapperHtml(label)}</label>
      <input type="${typeChamp}" id="champ-${cle}" data-champ="${cle}" value="${echapperHtml(valeur)}"${attrsListe}>
    </div>
  `;
}

// --- Corps spécifique --------------------------------------------------------

function corpsSpecifique(type, data) {
  switch (type) {
    case "reception":
      return corpsReception(data);
    case "cohesion":
      return corpsEssai(data, COHESION_RUPTURES, "A = garder ; A-Y, Y, Y-Z = éliminer");
    case "adherence":
      return corpsEssai(data, ADHERENCE_RUPTURES, "A, A-B, B = garder ; B-Y, Y, Y-Z = éliminer");
    case "ambiance":
      return corpsAmbiance(data);
    default:
      return "";
  }
}

// --- 6.1 Réception du support ------------------------------------------------

function corpsReception(data) {
  const remontee = data.remontee_humidite || "non";
  const criteres = data.criteres || {};
  const solutions = data.solutions || {};

  const lignes = RECEPTION_CRITERES.map((critere, i) => {
    const valeur = criteres[critere] || "";
    const solutionTexte = solutions[critere] || "";
    return `
      <tr>
        <td class="critere-libelle">${echapperHtml(critere)}</td>
        <td class="critere-radios">
          <label><input type="radio" name="critere-${i}" value="oui" data-critere-index="${i}" ${valeur === "oui" ? "checked" : ""}> Oui</label>
          <label><input type="radio" name="critere-${i}" value="non" data-critere-index="${i}" ${valeur === "non" ? "checked" : ""}> Non</label>
        </td>
        <td><input type="text" class="champ-solution" data-solution-index="${i}" placeholder="Si non, solutions" value="${echapperHtml(solutionTexte)}"></td>
      </tr>
    `;
  }).join("");

  return `
    <h2 class="page-subtitle">Réception du support</h2>
    <div class="champ">
      <label>Remontée d'humidité</label>
      <div class="radio-group">
        <label><input type="radio" name="remontee_humidite" value="oui" ${remontee === "oui" ? "checked" : ""}> Oui</label>
        <label><input type="radio" name="remontee_humidite" value="non" ${remontee === "non" ? "checked" : ""}> Non</label>
      </div>
    </div>
    <div class="tableau-conteneur">
      <table class="tableau-mesures">
        <thead>
          <tr><th>Critère</th><th>Conforme</th><th>Si non, solutions</th></tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
    <div class="badge-conformite" id="badge-conformite">Non évalué</div>
  `;
}

// --- 6.2 / 6.3 Essais d'arrachement (cohésion / adhérence) -------------------

function corpsEssai(data, ruptures, legende) {
  const mesures = data.mesures && data.mesures.length
    ? data.mesures
    : Array.from({ length: NB_MESURES_DEFAUT }, () => ({ rupture: "", si: "", fi: "" }));

  const lignes = mesures.map((m, i) => ligneEssai(m, i, ruptures)).join("");

  return `
    <h2 class="page-subtitle">Mesures</h2>
    <p class="legende">${echapperHtml(legende)}</p>
    <div class="tableau-conteneur">
      <table class="tableau-mesures" id="tableau-mesures">
        <thead>
          <tr>
            <th>N°</th><th>Type de rupture</th><th>Si (mm²)</th><th>Fi (N)</th>
            <th>xi (N/mm²)</th><th>Gardé</th>
          </tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
    <button type="button" class="btn btn-secondaire" id="btn-ajouter-mesure">Ajouter une mesure</button>
    <div class="bloc-resultats" id="bloc-resultats">
      <p>Mesures gardées : <span id="resultat-n">—</span></p>
      <p>Moyenne (xm) : <span id="resultat-xm">—</span> N/mm²</p>
      <p>Écart-type (s) : <span id="resultat-s">—</span></p>
      <p>xm − s : <span id="resultat-xm-s">—</span> N/mm²</p>
      <p class="seuils">Seuils : xm &gt; ${SEUIL_XM} et xm−s ≥ ${SEUIL_XM_S} N/mm²</p>
      <div class="badge-conformite" id="badge-conformite">Non évalué</div>
    </div>
  `;
}

function ligneEssai(mesure, index, ruptures) {
  const options = [
    `<option value=""></option>`,
    ...ruptures.map((r) => `<option value="${r}" ${mesure.rupture === r ? "selected" : ""}>${r}</option>`),
  ].join("");

  return `
    <tr data-mesure-index="${index}">
      <td>${index + 1}</td>
      <td><select data-champ="rupture">${options}</select></td>
      <td><input type="text" inputmode="decimal" data-champ="si" value="${echapperHtml(mesure.si ?? "")}"></td>
      <td><input type="text" inputmode="decimal" data-champ="fi" value="${echapperHtml(mesure.fi ?? "")}"></td>
      <td data-cell="xi">—</td>
      <td data-cell="garde">—</td>
    </tr>
  `;
}

// --- 6.4 Conditions d'ambiance ------------------------------------------------

function corpsAmbiance(data) {
  const mesures = data.mesures && data.mesures.length ? data.mesures : [ligneAmbianceVide()];
  const lignes = mesures.map((m, i) => ligneAmbiance(m, i)).join("");
  const enTetes = AMBIANCE_COLONNES.map((col) => `<th>${echapperHtml(col.label)}</th>`).join("");

  return `
    <h2 class="page-subtitle">Relevés</h2>
    <div class="tableau-conteneur">
      <table class="tableau-mesures" id="tableau-mesures">
        <thead>
          <tr>${enTetes}<th>Conf.</th><th></th></tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
    </div>
    <button type="button" class="btn btn-secondaire" id="btn-ajouter-mesure">Ajouter une mesure</button>
  `;
}

function ligneAmbianceVide() {
  const ligne = {};
  AMBIANCE_COLONNES.forEach((col) => { ligne[col.cle] = ""; });
  return ligne;
}

function ligneAmbiance(mesure, index) {
  const cellules = AMBIANCE_COLONNES.map((col) => {
    const valeur = mesure[col.cle] ?? "";
    if (col.cle === "date") {
      return `<td><input type="date" data-champ="${col.cle}" value="${echapperHtml(valeur)}"></td>`;
    }
    if (col.cle === "heure") {
      return `<td><input type="time" data-champ="${col.cle}" value="${echapperHtml(valeur)}"></td>`;
    }
    if (col.cle === "produit" || col.cle === "lot") {
      return `<td><input type="text" data-champ="${col.cle}" value="${echapperHtml(valeur)}"></td>`;
    }
    return `<td><input type="text" inputmode="decimal" data-champ="${col.cle}" value="${echapperHtml(valeur)}"></td>`;
  }).join("");

  return `
    <tr data-mesure-index="${index}">
      ${cellules}
      <td data-cell="conf">—</td>
      <td><button type="button" class="bouton-icone" data-action="supprimer-ligne" title="Supprimer la ligne">✕</button></td>
    </tr>
  `;
}

// --- Signatures ---------------------------------------------------------------

function zoneSignature(role, libelle, data) {
  const nom = data[`nom_${role}`] || "";
  const date = data[`date_${role}`] || "";

  return `
    <div class="signature-zone">
      <h3>${echapperHtml(libelle)}</h3>
      <div class="grille-champs">
        <div class="champ">
          <label>Nom</label>
          <input type="text" data-champ="nom_${role}" list="liste-utilisateurs" value="${echapperHtml(nom)}">
        </div>
        <div class="champ">
          <label>Date</label>
          <input type="date" data-champ="date_${role}" value="${echapperHtml(date)}">
        </div>
      </div>
      <div class="pad-signature-conteneur">
        <canvas class="pad-signature" data-pad="${role}" width="320" height="140"></canvas>
        <button type="button" class="btn btn-texte" data-effacer-pad="${role}">Effacer la signature</button>
      </div>
    </div>
  `;
}

// --- Évènements ----------------------------------------------------------------

function brancherEvenements(type) {
  const btnAjouter = document.getElementById("btn-ajouter-mesure");
  if (btnAjouter) {
    btnAjouter.addEventListener("click", () => ajouterMesure(type));
  }

  document.querySelectorAll('[data-action="supprimer-ligne"]').forEach((bouton) => {
    bouton.addEventListener("click", supprimerLigne);
  });
}

function supprimerLigne(evenement) {
  evenement.target.closest("tr").remove();
}

function ajouterMesure(type) {
  const tbody = document.querySelector("#tableau-mesures tbody");
  const index = tbody.children.length;

  let html;
  if (type === "ambiance") {
    html = ligneAmbiance(ligneAmbianceVide(), index);
  } else {
    const ruptures = type === "adherence" ? ADHERENCE_RUPTURES : COHESION_RUPTURES;
    html = ligneEssai({ rupture: "", si: "", fi: "" }, index, ruptures);
  }

  const modele = document.createElement("template");
  modele.innerHTML = html.trim();
  const nouvelleLigne = modele.content.firstElementChild;
  tbody.appendChild(nouvelleLigne);

  const boutonSupprimer = nouvelleLigne.querySelector('[data-action="supprimer-ligne"]');
  if (boutonSupprimer) {
    boutonSupprimer.addEventListener("click", supprimerLigne);
  }
}
