// Formulaire générique : rend le formulaire d'un type de fiche donné
// (en-tête commun + corps spécifique + signatures + boutons d'action),
// piloté par js/forms-def.js.

import {
  FORM_TYPES,
  CHAMPS_COMMUNS,
  RECEPTION_CRITERES,
  COHESION_RUPTURES,
  COHESION_GARDER,
  ADHERENCE_RUPTURES,
  ADHERENCE_GARDER,
  NB_MESURES_DEFAUT,
  AMBIANCE_COLONNES,
  SEUIL_XM,
  SEUIL_XM_S,
} from "../forms-def.js";
import { listerChantiers, listerUtilisateurs, creerFiche, majFiche, ajouterChantier } from "../db.js";
import { echapperHtml, telechargerBlob } from "../util.js";
import {
  analyserEssai,
  conformiteReception,
  conformiteAmbiance,
  conformiteAmbianceLigne,
} from "../calculations.js";
import { initialiserPads } from "../signature.js";
import { genererPdf, nomFichier } from "../pdf.js";

// Pads de signature de l'écran courant (réutilisés en Phase 6 pour l'enregistrement).
let padsActuels = {};

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
        ${zoneSignature("applicateur", "Applicateur", data, entete)}
        ${zoneSignature("controleur", "Contrôleur extérieur", data, entete)}
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

  brancherEvenements(type, ficheExistante);
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
  const solutions = data.solutions || {};

  const lignes = RECEPTION_CRITERES.map((critere, i) => {
    const solutionTexte = solutions[critere] || "";
    const tdSolution = solutionTexte
      ? `<input type="text" class="champ-solution" data-solution-index="${i}" placeholder="Décrire la solution…" value="${echapperHtml(solutionTexte)}">`
      : `<button type="button" class="btn-solution-toggle" data-solution-index="${i}">+ Solution</button>
         <input type="text" class="champ-solution" data-solution-index="${i}" placeholder="Décrire la solution…" value="" hidden>`;

    return `
      <tr>
        <td class="critere-libelle">${echapperHtml(critere)}</td>
        <td class="critere-solution">${tdSolution}</td>
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
      <table class="tableau-mesures tableau-reception">
        <thead>
          <tr><th>Critère</th><th class="th-solution">Si non, solutions</th></tr>
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

function zoneSignature(role, libelle, data, entete) {
  const nom = data[`nom_${role}`] || "";
  const date = data[`date_${role}`] || "";
  const signatureExistante = entete[`signature_${role}`] || "";
  const attrInitial = signatureExistante ? ` data-initial="${echapperHtml(signatureExistante)}"` : "";

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
        <canvas class="pad-signature" data-pad="${role}" width="320" height="140"${attrInitial}></canvas>
        <button type="button" class="btn btn-texte" data-effacer-pad="${role}">Effacer la signature</button>
      </div>
    </div>
  `;
}

// --- Évènements ----------------------------------------------------------------

function brancherEvenements(type, ficheExistante) {
  const btnAjouter = document.getElementById("btn-ajouter-mesure");
  if (btnAjouter) {
    btnAjouter.addEventListener("click", () => {
      ajouterMesure(type);
      recalculer(type);
    });
  }

  brancherSuppressions(type);
  brancherTogglesSolution();

  const formulaire = document.getElementById("formulaire-fiche");
  formulaire.addEventListener("input", () => recalculer(type));
  formulaire.addEventListener("change", () => recalculer(type));

  padsActuels = initialiserPads(document.getElementById("ecran"));

  document.getElementById("btn-brouillon").addEventListener("click", () => {
    enregistrerFiche(type, ficheExistante, "brouillon");
  });
  document.getElementById("btn-pdf").addEventListener("click", () => {
    enregistrerFiche(type, ficheExistante, "complet");
  });

  recalculer(type);
}

function brancherTogglesSolution() {
  document.querySelectorAll(".btn-solution-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.nextElementSibling;
      btn.hidden = true;
      input.hidden = false;
      input.focus();
    });
  });
}

function brancherSuppressions(type) {
  document.querySelectorAll('[data-action="supprimer-ligne"]').forEach((bouton) => {
    bouton.addEventListener("click", (evenement) => {
      evenement.target.closest("tr").remove();
      recalculer(type);
    });
  });
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
    boutonSupprimer.addEventListener("click", (evenement) => {
      evenement.target.closest("tr").remove();
      recalculer(type);
    });
  }
}

// --- Calculs et conformité en temps réel ---------------------------------------

function recalculer(type) {
  switch (type) {
    case "reception":
      recalculerReception();
      break;
    case "cohesion":
      recalculerEssai(COHESION_GARDER);
      break;
    case "adherence":
      recalculerEssai(ADHERENCE_GARDER);
      break;
    case "ambiance":
      recalculerAmbiance();
      break;
  }
}

function formatNombre(valeur, decimales = 2) {
  return valeur === null || valeur === undefined ? "—" : valeur.toFixed(decimales);
}

function majBadge(element, conforme) {
  if (!element) return;
  element.classList.remove("conforme", "non-conforme");
  if (conforme === null || conforme === undefined) {
    element.textContent = "Non évalué";
  } else if (conforme) {
    element.textContent = "Conforme";
    element.classList.add("conforme");
  } else {
    element.textContent = "Non conforme";
    element.classList.add("non-conforme");
  }
}

function recalculerEssai(typesAGarder) {
  const tbody = document.querySelector("#tableau-mesures tbody");
  const lignes = [...tbody.querySelectorAll("tr")];

  const mesures = lignes.map((ligne) => ({
    rupture: ligne.querySelector('[data-champ="rupture"]').value,
    si: ligne.querySelector('[data-champ="si"]').value,
    fi: ligne.querySelector('[data-champ="fi"]').value,
  }));

  const resultat = analyserEssai(mesures, typesAGarder);

  lignes.forEach((ligne, index) => {
    ligne.children[0].textContent = String(index + 1);
    const { xi, garde } = resultat.lignes[index];
    ligne.querySelector('[data-cell="xi"]').textContent = formatNombre(xi);
    ligne.querySelector('[data-cell="garde"]').textContent =
      xi === null ? "—" : (garde ? "Oui" : "Non");
  });

  document.getElementById("resultat-n").textContent = String(resultat.n_gardes);
  document.getElementById("resultat-xm").textContent = formatNombre(resultat.xm);
  document.getElementById("resultat-s").textContent = formatNombre(resultat.ecart);
  document.getElementById("resultat-xm-s").textContent = formatNombre(resultat.xm_s);

  majBadge(document.getElementById("badge-conformite"), resultat.conforme);
}

function recalculerAmbiance() {
  const tbody = document.querySelector("#tableau-mesures tbody");

  tbody.querySelectorAll("tr").forEach((ligne) => {
    const valeurs = {};
    AMBIANCE_COLONNES.forEach((col) => {
      const champ = ligne.querySelector(`[data-champ="${col.cle}"]`);
      if (champ) valeurs[col.cle] = champ.value;
    });

    const conforme = conformiteAmbianceLigne(valeurs);
    const cellule = ligne.querySelector('[data-cell="conf"]');
    cellule.classList.remove("conforme", "non-conforme");
    if (conforme === null) {
      cellule.textContent = "—";
    } else if (conforme) {
      cellule.textContent = "OK";
      cellule.classList.add("conforme");
    } else {
      cellule.textContent = "NOK";
      cellule.classList.add("non-conforme");
    }
  });
}

function recalculerReception() {
  const reponses = {};
  RECEPTION_CRITERES.forEach((critere, i) => {
    const solution = document.querySelector(`input[data-solution-index="${i}"]`);
    reponses[critere] = solution && solution.value.trim() ? "non" : "oui";
  });

  const remontee = document.querySelector('input[name="remontee_humidite"]:checked');
  const conforme = conformiteReception(reponses, remontee ? remontee.value : "non");

  majBadge(document.getElementById("badge-conformite"), conforme);
}

// --- Enregistrement et génération PDF (§8, Phase 6) -----------------------------

// Lit les champs d'en-tête communs (par id, pour éviter toute ambiguïté avec
// les data-champ de même nom dans le tableau « ambiance »).
function recupererEntete() {
  const entete = {};
  CHAMPS_COMMUNS.forEach(([cle]) => {
    const champ = document.getElementById(`champ-${cle}`);
    entete[cle] = champ ? champ.value.trim() : "";
  });
  return entete;
}

function recupererSignatureMeta() {
  const meta = {};
  ["applicateur", "controleur"].forEach((role) => {
    meta[`nom_${role}`] = document.querySelector(`[data-champ="nom_${role}"]`).value.trim();
    meta[`date_${role}`] = document.querySelector(`[data-champ="date_${role}"]`).value;
  });
  return meta;
}

function recupererDonneesReception() {
  const reponses = {};
  const solutions = {};
  RECEPTION_CRITERES.forEach((critere, i) => {
    const solution = document.querySelector(`input[data-solution-index="${i}"]`);
    const texte = solution ? solution.value.trim() : "";
    solutions[critere] = texte;
    reponses[critere] = texte ? "non" : "oui";
  });

  const remontee = document.querySelector('input[name="remontee_humidite"]:checked');
  return {
    remontee_humidite: remontee ? remontee.value : "non",
    criteres: reponses,
    solutions,
  };
}

function recupererMesuresEssai() {
  const tbody = document.querySelector("#tableau-mesures tbody");
  return [...tbody.querySelectorAll("tr")].map((ligne) => ({
    rupture: ligne.querySelector('[data-champ="rupture"]').value,
    si: ligne.querySelector('[data-champ="si"]').value.trim(),
    fi: ligne.querySelector('[data-champ="fi"]').value.trim(),
  }));
}

function recupererMesuresAmbiance() {
  const tbody = document.querySelector("#tableau-mesures tbody");
  return [...tbody.querySelectorAll("tr")].map((ligne) => {
    const mesure = {};
    AMBIANCE_COLONNES.forEach((col) => {
      const champ = ligne.querySelector(`[data-champ="${col.cle}"]`);
      mesure[col.cle] = champ ? champ.value.trim() : "";
    });
    return mesure;
  });
}

function recupererDonnees(type) {
  let data;
  switch (type) {
    case "reception":
      data = recupererDonneesReception();
      break;
    case "cohesion":
    case "adherence":
      data = { mesures: recupererMesuresEssai() };
      break;
    case "ambiance":
      data = { mesures: recupererMesuresAmbiance() };
      break;
    default:
      data = {};
  }
  Object.assign(data, recupererSignatureMeta());
  return data;
}

function calculerConformite(type, data) {
  switch (type) {
    case "reception":
      return conformiteReception(data.criteres, data.remontee_humidite);
    case "cohesion":
      return analyserEssai(data.mesures, COHESION_GARDER).conforme;
    case "adherence":
      return analyserEssai(data.mesures, ADHERENCE_GARDER).conforme;
    case "ambiance":
      return conformiteAmbiance(data.mesures);
    default:
      return null;
  }
}

// Récupère la signature dessinée, ou celle déjà enregistrée si le pad n'a pas été modifié.
function recupererSignature(role, ficheExistante) {
  const pad = padsActuels[role];
  if (pad && !pad.estVide()) return pad.versDataUrl();
  return ficheExistante?.[`signature_${role}`] || "";
}

async function enregistrerFiche(type, ficheExistante, statut) {
  const entete = recupererEntete();
  const data = recupererDonnees(type);
  const conforme = calculerConformite(type, data);

  const fiche = {
    type,
    ...entete,
    data,
    signature_applicateur: recupererSignature("applicateur", ficheExistante),
    signature_controleur: recupererSignature("controleur", ficheExistante),
    statut,
    conforme,
  };

  await ajouterChantier(entete.chantier);

  const sauvegardee = ficheExistante?.id
    ? await majFiche(ficheExistante.id, fiche)
    : await creerFiche(fiche);

  if (statut === "complet") {
    const blob = await genererPdf(sauvegardee);
    telechargerBlob(blob, nomFichier(sauvegardee));
  }

  window.location.hash = `#/fiche/${sauvegardee.id}`;
}
