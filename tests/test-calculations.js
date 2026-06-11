// Tests de parité avec application-qse/tests/test_calculations.py (§5, Phase 5/10).
// Aucune dépendance : assertions maison, résultat affiché dans tests/test.html.

import {
  versNombre,
  calculerXi,
  analyserEssai,
  conformiteReception,
  conformiteAmbianceLigne,
  conformiteAmbiance,
} from "../js/calculations.js";
import { COHESION_GARDER, ADHERENCE_GARDER, RECEPTION_CRITERES } from "../js/forms-def.js";

const resultatsEl = document.getElementById("resultats");
let total = 0;
let echecs = 0;

function test(nom, fn) {
  total += 1;
  const li = document.createElement("li");
  try {
    fn();
    li.textContent = "OK — " + nom;
    li.className = "ok";
  } catch (erreur) {
    echecs += 1;
    li.textContent = "ÉCHEC — " + nom + " : " + erreur.message;
    li.className = "echec";
  }
  resultatsEl.appendChild(li);
}

function presque(a, b, msg) {
  if (Math.abs(a - b) > 1e-9) throw new Error(msg || `${a} != ${b}`);
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "assertion échouée");
}

// --- versNombre / calculerXi --------------------------------------------------

test("calculerXi : calcul simple (1500/1000 = 1.5)", () => {
  presque(calculerXi(1500, 1000), 1.5);
});

test("calculerXi : virgule décimale", () => {
  presque(calculerXi("1500", "1000,0"), 1.5);
});

test("calculerXi : Si nul ou manquant -> null", () => {
  assert(calculerXi(1500, 0) === null, "Si=0 devrait donner null");
  assert(calculerXi(null, 1000) === null, "fi manquant devrait donner null");
  assert(calculerXi(1500, "") === null, "si manquant devrait donner null");
});

test("versNombre : valeur vide ou invalide -> null", () => {
  assert(versNombre("") === null);
  assert(versNombre(null) === null);
  assert(versNombre("abc") === null);
});

// --- Essai cohésion -------------------------------------------------------------

test("essai cohésion : conforme (xm=2, s=0, xm-s=2)", () => {
  const mesures = [
    { rupture: "A", si: 1000, fi: 2000 },
    { rupture: "A", si: 1000, fi: 2000 },
    { rupture: "A", si: 1000, fi: 2000 },
  ];
  const res = analyserEssai(mesures, COHESION_GARDER);
  assert(res.n_gardes === 3, "n_gardes attendu 3");
  presque(res.xm, 2.0);
  presque(res.ecart, 0.0);
  presque(res.xm_s, 2.0);
  assert(res.conforme === true, "attendu conforme");
});

test("essai cohésion : non conforme (moyenne faible)", () => {
  const mesures = [
    { rupture: "A", si: 1000, fi: 1000 },
    { rupture: "A", si: 1000, fi: 1000 },
  ];
  const res = analyserEssai(mesures, COHESION_GARDER);
  assert(res.conforme === false, "attendu non conforme");
});

test("essai cohésion : exclusion des ruptures non gardées", () => {
  const mesures = [
    { rupture: "A", si: 1000, fi: 2000 },
    { rupture: "Y", si: 1000, fi: 100 },
  ];
  const res = analyserEssai(mesures, COHESION_GARDER);
  assert(res.n_gardes === 1, "n_gardes attendu 1");
  presque(res.xm, 2.0);
});

test("essai cohésion : aucune mesure -> conforme null", () => {
  const res = analyserEssai([], COHESION_GARDER);
  assert(res.conforme === null, "attendu null");
  assert(res.n_gardes === 0, "n_gardes attendu 0");
});

// --- Essai adhérence -------------------------------------------------------------

test("essai adhérence : A, A-B, B conservés", () => {
  const mesures = [
    { rupture: "A", si: 1000, fi: 2000 },
    { rupture: "A-B", si: 1000, fi: 2000 },
    { rupture: "B", si: 1000, fi: 2000 },
    { rupture: "Y", si: 1000, fi: 100 },
  ];
  const res = analyserEssai(mesures, ADHERENCE_GARDER);
  assert(res.n_gardes === 3, "n_gardes attendu 3");
  assert(res.conforme === true, "attendu conforme");
});

// --- Réception du support ---------------------------------------------------------

function tousOui() {
  const reponses = {};
  RECEPTION_CRITERES.forEach((critere) => { reponses[critere] = "oui"; });
  return reponses;
}

test("réception : conforme (tout oui, pas d'humidité)", () => {
  assert(conformiteReception(tousOui(), "non") === true, "attendu conforme");
});

test("réception : un critère à non -> non conforme", () => {
  const reponses = tousOui();
  reponses[RECEPTION_CRITERES[0]] = "non";
  assert(conformiteReception(reponses, "non") === false, "attendu non conforme");
});

test("réception : remontée d'humidité -> non conforme", () => {
  assert(conformiteReception(tousOui(), "oui") === false, "attendu non conforme");
});

// --- Conditions d'ambiance ----------------------------------------------------------

function ligneOk() {
  return { hs: 2, hr: 60, t_air: 20, t_rosee: 10, t_support: 20, t_produit: 18 };
}

test("ambiance : ligne conforme", () => {
  assert(conformiteAmbianceLigne(ligneOk()) === true, "attendu conforme");
});

test("ambiance : Hs trop élevé (> 4 %)", () => {
  const ligne = ligneOk();
  ligne.hs = 5;
  assert(conformiteAmbianceLigne(ligne) === false, "attendu non conforme");
});

test("ambiance : T support < T rosée + 3", () => {
  const ligne = ligneOk();
  ligne.t_rosee = 18; // support (20) < 18 + 3 = 21
  assert(conformiteAmbianceLigne(ligne) === false, "attendu non conforme");
});

test("ambiance : ligne vide -> null", () => {
  assert(conformiteAmbianceLigne({ date: "2026-06-11", produit: "X" }) === null, "attendu null");
});

test("ambiance : conformité globale", () => {
  const lignes = [ligneOk(), ligneOk()];
  assert(conformiteAmbiance(lignes) === true, "attendu conforme");
  lignes[1].hr = 90;
  assert(conformiteAmbiance(lignes) === false, "attendu non conforme");
});

// --- Résumé -------------------------------------------------------------------------

const resumeEl = document.getElementById("resume");
resumeEl.textContent = `${total - echecs} / ${total} tests réussis`;
resumeEl.className = echecs ? "echec" : "ok";
if (echecs) resumeEl.textContent += ` — ${echecs} échec(s)`;
