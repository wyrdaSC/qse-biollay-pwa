// Wrapper IndexedDB à base de promesses pour la base "QSEDatabase".
// Trois magasins : fiches, chantiers, utilisateurs (voir §4 du plan).

const DB_NAME = "QSEDatabase";
const DB_VERSION = 1;

let dbPromise = null;

// Ouvre (et met en cache) la connexion à la base, en créant les magasins
// au besoin lors de la première ouverture.
export function ouvrir() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const requete = indexedDB.open(DB_NAME, DB_VERSION);

    requete.onupgradeneeded = (evenement) => {
      const db = evenement.target.result;

      if (!db.objectStoreNames.contains("fiches")) {
        const fiches = db.createObjectStore("fiches", { keyPath: "id", autoIncrement: true });
        fiches.createIndex("type", "type");
        fiches.createIndex("chantier", "chantier");
        fiches.createIndex("statut", "statut");
      }

      if (!db.objectStoreNames.contains("chantiers")) {
        db.createObjectStore("chantiers", { keyPath: "id", autoIncrement: true });
      }

      if (!db.objectStoreNames.contains("utilisateurs")) {
        db.createObjectStore("utilisateurs", { keyPath: "id", autoIncrement: true });
      }
    };

    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });

  return dbPromise;
}

// Transforme une IDBRequest en promesse.
function promesseRequete(requete) {
  return new Promise((resolve, reject) => {
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

// Raccourci pour obtenir un object store dans une nouvelle transaction.
async function magasin(nom, mode) {
  const db = await ouvrir();
  return db.transaction(nom, mode).objectStore(nom);
}

function maintenant() {
  return new Date().toISOString();
}

// --------------------------------------------------------------------------
// Fiches
// --------------------------------------------------------------------------

export async function creerFiche(f) {
  const store = await magasin("fiches", "readwrite");
  const horodatage = maintenant();
  const fiche = {
    ...f,
    statut: f.statut || "brouillon",
    conforme: f.conforme ?? null,
    created_at: horodatage,
    updated_at: horodatage,
  };
  const id = await promesseRequete(store.add(fiche));
  return { ...fiche, id };
}

export async function majFiche(id, f) {
  const db = await ouvrir();
  const store = db.transaction("fiches", "readwrite").objectStore("fiches");
  const existante = await promesseRequete(store.get(id));
  if (!existante) throw new Error(`Fiche ${id} introuvable`);

  const fiche = { ...existante, ...f, id, updated_at: maintenant() };
  await promesseRequete(store.put(fiche));
  return fiche;
}

export async function getFiche(id) {
  const store = await magasin("fiches", "readonly");
  return promesseRequete(store.get(id));
}

export async function listerFiches({ type, chantier } = {}) {
  const store = await magasin("fiches", "readonly");
  const toutes = await promesseRequete(store.getAll());
  return toutes
    .filter((f) => !type || f.type === type)
    .filter((f) => !chantier || f.chantier === chantier)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function supprimerFiche(id) {
  const store = await magasin("fiches", "readwrite");
  return promesseRequete(store.delete(id));
}

export async function definirStatut(id, statut) {
  return majFiche(id, { statut });
}

export async function compterNonEnvoyees() {
  const toutes = await listerFiches();
  return toutes.filter((f) => f.statut !== "envoye").length;
}

// --------------------------------------------------------------------------
// Chantiers
// --------------------------------------------------------------------------

export async function listerChantiers() {
  const store = await magasin("chantiers", "readonly");
  const tous = await promesseRequete(store.getAll());
  return tous.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

// Ajoute un chantier, sans rien faire s'il existe déjà (nom identique).
export async function ajouterChantier(nom) {
  nom = (nom || "").trim();
  if (!nom) return;

  const db = await ouvrir();
  const store = db.transaction("chantiers", "readwrite").objectStore("chantiers");
  const existants = await promesseRequete(store.getAll());
  if (existants.some((c) => c.nom === nom)) return;

  return promesseRequete(store.add({ nom }));
}

export async function supprimerChantier(id) {
  const store = await magasin("chantiers", "readwrite");
  return promesseRequete(store.delete(id));
}

// --------------------------------------------------------------------------
// Utilisateurs (participants / signataires)
// --------------------------------------------------------------------------

export async function listerUtilisateurs() {
  const store = await magasin("utilisateurs", "readonly");
  const tous = await promesseRequete(store.getAll());
  return tous.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

// Ajoute un participant, sans rien faire s'il existe déjà (nom identique).
export async function ajouterUtilisateur(nom, role) {
  nom = (nom || "").trim();
  if (!nom) return;

  const db = await ouvrir();
  const store = db.transaction("utilisateurs", "readwrite").objectStore("utilisateurs");
  const existants = await promesseRequete(store.getAll());
  if (existants.some((u) => u.nom === nom)) return;

  return promesseRequete(store.add({ nom, role: (role || "").trim() }));
}

export async function supprimerUtilisateur(id) {
  const store = await magasin("utilisateurs", "readwrite");
  return promesseRequete(store.delete(id));
}
