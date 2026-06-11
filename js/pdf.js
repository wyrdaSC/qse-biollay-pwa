// Génération du PDF avec jsPDF (vendé dans vendor/jspdf.umd.min.js, voir §7
// du plan — port de application-qse/app/pdf_generator.py).
// jsPDF est chargé en script classique dans index.html et expose `window.jspdf.jsPDF`.

import {
  FORM_TYPES,
  CHAMPS_COMMUNS,
  RECEPTION_CRITERES,
  COHESION_GARDER,
  ADHERENCE_GARDER,
  AMBIANCE_COLONNES,
  SEUIL_XM,
  SEUIL_XM_S,
} from "./forms-def.js";
import { analyserEssai, conformiteAmbianceLigne } from "./calculations.js";

const BLEU = [26, 53, 87];
const VERT = [34, 139, 34];
const ROUGE = [192, 57, 43];
const GRIS = [240, 240, 240];
const GRIS_TEXTE = [120, 120, 120];

const ENTREPRISE_NOM = "BIOLLAY";
const ENTREPRISE_SOUS_TITRE = "Travaux Spéciaux SA";

const LARGEUR_PAGE = 210;
const HAUTEUR_PAGE = 297;
const MARGE = 15;
const LARGEUR_UTILE = LARGEUR_PAGE - 2 * MARGE;
const Y_DEBUT_CONTENU = 32;
const Y_MAX = HAUTEUR_PAGE - 18; // réserve la place du pied de page

// Rend un texte compatible avec l'encodage WinAnsi des polices standard de
// jsPDF : remplace les caractères absents (≥, ≤, tirets longs, etc.).
function lat(texte) {
  if (texte === null || texte === undefined) return "";
  const remplacements = {
    "≥": ">=",
    "≤": "<=",
    "—": "-",
    "–": "-",
    "’": "'",
    "œ": "oe",
    " ": " ",
    "·": "-",
  };
  let resultat = String(texte);
  for (const [avant, apres] of Object.entries(remplacements)) {
    resultat = resultat.split(avant).join(apres);
  }
  return resultat;
}

// Formate un nombre (ou "-" si null).
function fmt(valeur, decimales = 2) {
  return valeur === null || valeur === undefined ? "-" : valeur.toFixed(decimales);
}

// --- Mise en page bas niveau -----------------------------------------------

// Vérifie qu'il reste assez de place ; sinon ajoute une page et redessine l'en-tête.
function assurerEspace(ctx, hauteur) {
  if (ctx.y + hauteur > Y_MAX) {
    ctx.doc.addPage();
    dessinerEntete(ctx);
  }
}

// Bandeau d'en-tête bleu : logo texte + titre de la fiche + N° de fiche.
function dessinerEntete(ctx) {
  const { doc, titre, numero } = ctx;

  doc.setFillColor(...BLEU);
  doc.rect(0, 0, LARGEUR_PAGE, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(lat(ENTREPRISE_NOM), MARGE, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(lat(ENTREPRISE_SOUS_TITRE), MARGE, 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(lat(titre.toUpperCase()), LARGEUR_PAGE - MARGE, 12, { align: "right" });

  if (numero) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(lat(`N° de fiche : ${numero}`), LARGEUR_PAGE - MARGE, 19, { align: "right" });
  }

  doc.setTextColor(0, 0, 0);
  ctx.y = Y_DEBUT_CONTENU;
}

// Bandeau de titre de section (fond bleu, texte blanc).
function titreSection(ctx, texte) {
  assurerEspace(ctx, 12);
  ctx.y += 2;
  ctx.doc.setFillColor(...BLEU);
  ctx.doc.rect(MARGE, ctx.y, LARGEUR_UTILE, 7, "F");
  ctx.doc.setTextColor(255, 255, 255);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(11);
  ctx.doc.text(lat(texte), MARGE + 2, ctx.y + 5);
  ctx.doc.setTextColor(0, 0, 0);
  ctx.y += 7 + 1;
}

// Dessine une ligne de tableau : cellules bordées, alignement et couleurs au choix.
function dessinerLigneTableau(ctx, cellules, largeurs, options = {}) {
  const { doc } = ctx;
  const hauteur = options.hauteur || 7;
  const align = options.align || largeurs.map(() => "left");
  const couleurs = options.couleurs || largeurs.map(() => null);

  doc.setFont("helvetica", options.gras ? "bold" : "normal");
  doc.setFontSize(options.fontSize || 9);

  let x = MARGE;
  cellules.forEach((texte, i) => {
    const largeur = largeurs[i];
    if (options.fond) {
      doc.setFillColor(...options.fond);
      doc.rect(x, ctx.y, largeur, hauteur, "FD");
    } else {
      doc.rect(x, ctx.y, largeur, hauteur, "S");
    }

    const al = align[i] || "left";
    let tx = x + 2;
    if (al === "center") tx = x + largeur / 2;
    else if (al === "right") tx = x + largeur - 2;

    if (couleurs[i]) doc.setTextColor(...couleurs[i]);
    doc.text(lat(String(texte ?? "")), tx, ctx.y + hauteur - 2, { align: al });
    if (couleurs[i]) doc.setTextColor(0, 0, 0);

    x += largeur;
  });

  ctx.y += hauteur;
}

// --- Briques communes --------------------------------------------------------

// Tableau clé/valeur des champs d'en-tête communs (§1).
function blocGeneral(ctx) {
  titreSection(ctx, "Informations générales");

  const { doc, fiche } = ctx;
  const largeurLabel = 45;
  const largeurVal = LARGEUR_UTILE / 2 - largeurLabel;
  const paires = CHAMPS_COMMUNS.map(([cle, libelle]) => [libelle, fiche[cle]]);

  for (let i = 0; i < paires.length; i += 2) {
    assurerEspace(ctx, 7);
    let x = MARGE;
    for (let j = 0; j < 2 && i + j < paires.length; j++) {
      const [libelle, valeur] = paires[i + j];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setFillColor(...GRIS);
      doc.rect(x, ctx.y, largeurLabel, 7, "FD");
      doc.text(lat(libelle), x + 1, ctx.y + 5);

      doc.setFont("helvetica", "normal");
      doc.rect(x + largeurLabel, ctx.y, largeurVal, 7, "S");
      doc.text(lat(valeur || ""), x + largeurLabel + 1, ctx.y + 5);

      x += largeurLabel + largeurVal;
    }
    ctx.y += 7;
  }
  ctx.y += 2;
}

// Bandeau résultat CONFORME / NON CONFORME / NON ÉVALUÉ.
function badgeResultat(ctx, conforme) {
  assurerEspace(ctx, 14);
  ctx.y += 2;

  let couleur;
  let texte;
  if (conforme === null || conforme === undefined) {
    couleur = GRIS_TEXTE;
    texte = "NON EVALUE";
  } else if (conforme) {
    couleur = VERT;
    texte = "CONFORME";
  } else {
    couleur = ROUGE;
    texte = "NON CONFORME";
  }

  ctx.doc.setFillColor(...couleur);
  ctx.doc.rect(MARGE, ctx.y, LARGEUR_UTILE, 12, "F");
  ctx.doc.setTextColor(255, 255, 255);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(13);
  ctx.doc.text(lat(`RESULTAT : ${texte}`), LARGEUR_PAGE / 2, ctx.y + 8, { align: "center" });
  ctx.doc.setTextColor(0, 0, 0);
  ctx.y += 12 + 2;
}

// Deux colonnes de signature : libellé, image PNG, nom, date.
function zonesSignatures(ctx, fiche, labelGauche, labelDroite) {
  assurerEspace(ctx, 46);
  titreSection(ctx, "Signatures");

  const { doc } = ctx;
  const data = fiche.data || {};
  const col = LARGEUR_UTILE / 2;
  const y0 = ctx.y;

  const infos = [
    [labelGauche, fiche.signature_applicateur, data.nom_applicateur || "", data.date_applicateur || ""],
    [labelDroite, fiche.signature_controleur, data.nom_controleur || "", data.date_controleur || ""],
  ];

  infos.forEach(([label, signature, nom, date], i) => {
    const x = MARGE + i * col;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(lat(label), x, y0 + 4);

    doc.rect(x, y0 + 6, col - 5, 22, "S");
    if (signature) {
      try {
        doc.addImage(signature, "PNG", x + 1, y0 + 7, col - 7, 20);
      } catch {
        // signature illisible -> on laisse le cadre vide
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(lat(`Nom : ${nom}`), x, y0 + 34);
    doc.text(lat(`Date : ${date}`), x, y0 + 39);
  });

  ctx.y = y0 + 42;
}

// Pied de page (toutes les pages, appelé en fin de génération).
function dessinerPiedToutesPages(doc) {
  const nbPages = doc.getNumberOfPages();
  for (let i = 1; i <= nbPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...GRIS_TEXTE);
    doc.text(
      lat(`${ENTREPRISE_NOM} QSE - Document généré localement`),
      LARGEUR_PAGE / 2,
      HAUTEUR_PAGE - 8,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
  }
}

// --- Corps spécifiques par type de fiche (§6 / §7) ---------------------------

function corpsReception(ctx, fiche) {
  const data = fiche.data || {};

  titreSection(ctx, "Remontée d'humidité");
  assurerEspace(ctx, 7);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(9);
  ctx.doc.text(
    lat(`Remontée d'humidité : ${(data.remontee_humidite || "-").toUpperCase()}`),
    MARGE,
    ctx.y + 5
  );
  ctx.y += 7;

  titreSection(ctx, "Critères de réception du support");
  const reponses = data.criteres || {};
  const solutions = data.solutions || {};
  const largeurs = [95, 20, LARGEUR_UTILE - 115];

  assurerEspace(ctx, 7);
  dessinerLigneTableau(ctx, ["Critère", "Oui/Non", "Si non, solutions"], largeurs, {
    gras: true,
    fond: GRIS,
    align: ["left", "center", "left"],
  });

  for (const critere of RECEPTION_CRITERES) {
    assurerEspace(ctx, 7);
    const rep = (reponses[critere] || "").toUpperCase();
    dessinerLigneTableau(ctx, [critere, rep || "-", solutions[critere] || ""], largeurs, {
      fontSize: 8,
      align: ["left", "center", "left"],
    });
  }
}

function corpsEssai(ctx, fiche, typesGarder, legende) {
  const data = fiche.data || {};
  const mesures = data.mesures || [];
  const res = analyserEssai(mesures, typesGarder);

  titreSection(ctx, "Mesures d'arrachement");
  const largeurs = [15, 35, 35, 35, 40, 20];
  const entetes = ["N°", "Type rupture", "Si (mm²)", "Fi (N)", "xi = Fi/Si (MPa)", "Gardé"];

  assurerEspace(ctx, 7);
  dessinerLigneTableau(ctx, entetes, largeurs, {
    gras: true,
    fond: GRIS,
    fontSize: 8,
    align: largeurs.map(() => "center"),
  });

  res.lignes.forEach((ligne, i) => {
    assurerEspace(ctx, 6);
    dessinerLigneTableau(
      ctx,
      [String(i + 1), ligne.rupture || "-", fmt(ligne.si), fmt(ligne.fi), fmt(ligne.xi), ligne.garde ? "Oui" : "Non"],
      largeurs,
      { hauteur: 6, fontSize: 8, align: largeurs.map(() => "center") }
    );
  });

  ctx.y += 2;
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(8);
  const lignesLegende = ctx.doc.splitTextToSize(lat("Légende : " + legende), LARGEUR_UTILE);
  lignesLegende.forEach((ligneTexte) => {
    assurerEspace(ctx, 5);
    ctx.doc.text(ligneTexte, MARGE, ctx.y + 4);
    ctx.y += 5;
  });

  titreSection(ctx, "Résultats du calcul");
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(9);
  const lignesCalc = [
    `Nombre de mesures conservées : ${res.n_gardes}`,
    `Moyenne xm = ${fmt(res.xm)} MPa  (seuil > ${SEUIL_XM} MPa)`,
    `Écart-type s = ${fmt(res.ecart)} MPa`,
    `xm - s = ${fmt(res.xm_s)} MPa  (seuil >= ${SEUIL_XM_S} MPa)`,
  ];
  lignesCalc.forEach((texte) => {
    assurerEspace(ctx, 6);
    ctx.doc.text(lat(texte), MARGE, ctx.y + 4);
    ctx.y += 6;
  });
}

function corpsAmbiance(ctx, fiche) {
  const data = fiche.data || {};
  const lignes = data.mesures || [];

  titreSection(ctx, "Relevés des conditions d'ambiance");

  const largeurConf = 16;
  const largeurCol = (LARGEUR_UTILE - largeurConf) / AMBIANCE_COLONNES.length;
  const largeurs = AMBIANCE_COLONNES.map(() => largeurCol).concat([largeurConf]);
  const entetes = AMBIANCE_COLONNES.map((col) => col.label).concat(["Conf."]);

  assurerEspace(ctx, 8);
  dessinerLigneTableau(ctx, entetes, largeurs, {
    gras: true,
    fond: GRIS,
    fontSize: 6,
    hauteur: 8,
    align: largeurs.map(() => "center"),
  });

  for (const ligne of lignes) {
    assurerEspace(ctx, 6);
    const conforme = conformiteAmbianceLigne(ligne);
    let txtConf = "-";
    let couleurConf = GRIS_TEXTE;
    if (conforme === true) {
      txtConf = "OK";
      couleurConf = VERT;
    } else if (conforme === false) {
      txtConf = "NOK";
      couleurConf = ROUGE;
    }

    const valeurs = AMBIANCE_COLONNES.map((col) => ligne[col.cle] ?? "").concat([txtConf]);
    const couleurs = AMBIANCE_COLONNES.map(() => null).concat([couleurConf]);

    dessinerLigneTableau(ctx, valeurs, largeurs, {
      hauteur: 6,
      fontSize: 6,
      align: largeurs.map(() => "center"),
      couleurs,
    });
  }
}

// --- Point d'entrée -------------------------------------------------------------

// Génère le PDF d'une fiche et renvoie un Blob.
export async function genererPdf(fiche) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const info = FORM_TYPES[fiche.type] || {};
  const ctx = { doc, y: 0, fiche, titre: info.label || fiche.type, numero: fiche.numero || "" };

  dessinerEntete(ctx);
  blocGeneral(ctx);

  switch (fiche.type) {
    case "reception":
      corpsReception(ctx, fiche);
      badgeResultat(ctx, fiche.conforme);
      zonesSignatures(ctx, fiche, "Contrôleur applicateur", "Contrôleur extérieur");
      break;
    case "cohesion":
      corpsEssai(ctx, fiche, COHESION_GARDER, "A = garder ; A-Y, Y, Y-Z = éliminer.");
      badgeResultat(ctx, fiche.conforme);
      zonesSignatures(ctx, fiche, "Contrôleur applicateur", "Contrôleur extérieur");
      break;
    case "adherence":
      corpsEssai(ctx, fiche, ADHERENCE_GARDER, "A, A-B, B = garder ; B-Y, Y, Y-Z = éliminer.");
      badgeResultat(ctx, fiche.conforme);
      zonesSignatures(ctx, fiche, "Contrôleur applicateur", "Contrôleur extérieur");
      break;
    case "ambiance":
      corpsAmbiance(ctx, fiche);
      badgeResultat(ctx, fiche.conforme);
      zonesSignatures(ctx, fiche, "Signataire 1", "Signataire 2");
      break;
    default:
      break;
  }

  dessinerPiedToutesPages(doc);
  return doc.output("blob");
}

// Nom de fichier : [TYPE]-[CHANTIER]-[DATE].pdf, assaini (§7).
export function nomFichier(fiche) {
  const brut = `${fiche.type}-${fiche.chantier || ""}-${fiche.date || ""}`;
  const assaini = brut.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${assaini || "fiche"}.pdf`;
}
