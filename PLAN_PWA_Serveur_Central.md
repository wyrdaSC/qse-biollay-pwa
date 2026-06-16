# Plan de construction — Couche serveur centrale (QSE Biollay)

> **À l'attention de la future instance de Claude Code (Sonnet) qui implémentera cette couche.**
>
> Ce document **complète** `PLAN_PWA_VanillaJS.md` ; il ne le remplace pas. **Lis d'abord
> `PLAN_PWA_VanillaJS.md` en entier**, puis ce document, puis **parcours brièvement la
> structure réelle de `application-qse-pwa/`** (au minimum `js/db.js`, `js/router.js`,
> `js/app.js`, `js/views/form.js`, `js/views/consultation.js`, `js/views/parametres.js`,
> `js/views/home.js`, `index.html`, `service-worker.js`) avant de coder. Ces trois sources
> réunies sont **suffisantes** pour réaliser l'implémentation.
>
> **Où tu travailles :** ton répertoire courant **est `application-qse-pwa/`** (la racine du
> dépôt git). Les chemins de ce document (`js/db.js`, `service-worker.js`, etc.) sont donc
> **relatifs à toi**. Le prototype Flask de référence est le dossier **frère**
> `../application-qse/` (hors du dépôt). Le dépôt est sur la branche **`dev`** : tous les
> commits vont sur `dev` jusqu'à ce que la couche fonctionne, puis fusion/push vers `main`
> (la branche `main` sert aux premiers tests de l'app). Les deux documents de plan
> (`PLAN_PWA_VanillaJS.md` et celui-ci) sont à la **racine du dépôt**, à côté du `README.md`.
>
> Ce document décrit **uniquement la nouvelle couche « connectivité / serveur central »**
> ajoutée *autour* de l'application existante. **Le cœur hors-ligne de la PWA reste intact**
> et reste l'exigence n°1. On n'enlève rien à ce qui marche ; on ajoute une couche.

---

## Légende des marqueurs

Tout au long du document :

- 🔶 **DÉCISION** — choix que l'utilisateur (Sylvain) doit **confirmer avant ou pendant
  l'implémentation**. Ne pas trancher seul : remonter la question. Une recommandation est
  donnée à chaque fois.
- ⚠️ **POINT CRITIQUE** — facile à rater, fort impact (sécurité, perte de données,
  hors-ligne). À traiter avec soin et à vérifier explicitement.

---

## 0. Contexte et décisions déjà prises (ne pas les rouvrir)

**Problème.** La PWA fonctionne aujourd'hui en **silo** : chaque appareil a ses propres
données. Deux besoins remontés par l'utilisateur final imposent un serveur central :

1. **Données de référence partagées.** Les listes des *paramètres* (personnes/participants,
   chantiers, et **d'autres champs à venir**) doivent être **uniques et communes** à toutes
   les instances. Dans les formulaires, l'utilisateur ne pourra **que choisir parmi les
   entrées existantes** poussées par le serveur (plus de saisie libre).
2. **Stockage central des PDF.** L'envoi par email est abandonné (beaucoup d'ouvriers de
   terrain n'ont pas d'adresse, et l'email ne permet ni le suivi ni le tri quand 10 chantiers
   tournent en parallèle). À la place, **« publier »** une fiche **téléverse le PDF + les
   données structurées** sur le serveur.

**Décisions arrêtées avec l'utilisateur — à respecter, ne pas reproposer autre chose :**

1. **Le cœur hors-ligne de la PWA reste tel quel.** La connexion mobile (4G) est *« la
   plupart du temps »* disponible, **pas garantie**. Saisie, calculs, signature et génération
   PDF doivent continuer à fonctionner **100 % hors-ligne**. La couche serveur s'ajoute
   par-dessus, jamais à la place.
2. **Backend en Python**, hébergé sur **un serveur de l'entreprise** (l'entreprise en a
   déjà). **L'informaticien (IT) administre la machine** (OS, disponibilité, certificat
   **HTTPS**, sauvegardes) et fournit **un point d'accès HTTPS public**. **Sylvain développe
   et maintient le code back **et** front** ; il connaît Python.
   - 🔶 **DÉCISION (framework) :** **FastAPI** (recommandé — validation des entrées intégrée
     via Pydantic, doc OpenAPI auto, idéal pour une API JSON) **ou Flask** (le prototype
     d'origine `application-qse/` était en Flask ; parfaitement suffisant à cette échelle).
     Le présent document est **neutre vis-à-vis du framework** : il décrit endpoints, schéma
     et règles, valables pour l'un comme pour l'autre. Recommandation par défaut : FastAPI.
3. **Stockage serveur minimal et low-ops :** **SQLite** (un seul fichier, sauvegarde
   triviale) + **PDF stockés en fichiers sur disque** (chemin enregistré en base) +
   **données structurées de chaque fiche en JSON** en base. Pas de PostgreSQL, pas de
   stockage objet : surdimensionné pour l'échelle (≈ **10 appareils**, **≤ 50 PDF/jour**).
4. **Authentification obligatoire**, **un compte par personne**, **mots de passe hachés**,
   **HTTPS uniquement**. Deux rôles : **`manager`** et **`user`** (ouvrier de terrain).
5. **Le `mailto:` intégré est supprimé entièrement** : l'app ne déclenche **aucun** envoi
   d'email. En revanche, **le téléchargement du PDF reste disponible** — l'utilisateur peut
   récupérer le PDF et l'envoyer lui-même par email **depuis sa propre messagerie, hors de
   l'app**. (On retire l'automatisation `mailto`, pas la possibilité d'exporter le document.)

**Les trois non-négociables (même en version « simple ») :**

> ⚠️ **POINT CRITIQUE — Sécurité.** Les fiches sont des **documents qualité à valeur de
> preuve** (responsabilité chantier). Centraliser = créer un stock unique de documents +
> des identifiants. Trois règles ne se négocient pas :
> 1. **Mots de passe hachés** (argon2 ou bcrypt — jamais en clair, jamais de crypto maison).
> 2. **HTTPS uniquement** (le login en clair serait interceptable).
> 3. **Un compte nominatif par personne** (pas de mot de passe « manager » partagé — sinon
>    on perd la traçabilité, qui est précisément le but).

**Périmètre des rôles (arrêté) :**

- **Paramètres / données de référence :** le **manager** modifie ; l'**user** lit seulement
  (listes en lecture, choisies dans les formulaires).
- **Nouveaux chantiers : pré-création par le manager uniquement.** Un user sur un chantier
  non encore listé **ne peut pas** créer de fiche pour ce chantier tant qu'un manager ne l'a
  pas ajouté. **Risque opérationnel assumé par l'utilisateur** (décision arrêtée) : un manager
  peut **ajouter le chantier depuis sa propre app** (y compris sur téléphone) ; le cas se
  règle par **un simple appel téléphonique** entre l'ouvrier et le manager si un site neuf se
  présente. ⚠️ **Conséquences à implémenter :** (1) la **création/gestion de chantiers doit
  être possible depuis l'app pour un manager** (pas seulement depuis un poste de bureau —
  cf. §7) ; (2) UX explicite côté user quand la liste ne contient pas le site (§6) : message
  « Ce chantier n'existe pas encore — demandez à un responsable de l'ajouter », pas un champ
  vide silencieux.
- **Fiches publiées :** le **manager** peut **parcourir / filtrer / télécharger / supprimer**
  toutes les fiches. L'**user** voit **uniquement les siennes** (lecture + téléchargement),
  **ne peut ni les modifier ni les supprimer** une fois publiées. **Seul un manager
  supprime.** **Pas d'édition en place** du contenu d'une fiche publiée (voir le point
  d'intégrité ci-dessous).
- **Brouillons :** restent **locaux** sur l'appareil (IndexedDB), **modifiables** par leur
  auteur tant qu'ils ne sont pas publiés.

> ⚠️ **POINT CRITIQUE — Intégrité des signatures (raison du « pas d'édition »).** Une fiche
> porte **deux signatures** attestant de *mesures précises*. Modifier après coup les données
> et **régénérer** le PDF reviendrait à apposer une signature sur des valeurs jamais vues par
> le signataire → document trompeur, **sans valeur de preuve**. C'est pourquoi la correction
> se fait par **suppression (manager) + nouvelle publication** par l'ouvrier, **jamais** par
> réécriture. (Cette décision a aussi évité de devoir porter la génération PDF en Python : le
> PDF signé reste produit **côté client** et fait foi.)

---

## 0bis. État d'avancement (à mettre à jour à chaque session)

> **Rien de cette couche n'est encore implémenté** au démarrage. L'app existante (`v12` du
> service worker) est la base. Mettre à jour cette section à chaque phase (cf. le format
> détaillé du §0bis de `PLAN_PWA_VanillaJS.md`).

| Phase | État |
|---|---|
| S0 — Squelette backend + schéma | ⬜ à faire |
| S1 — Auth (comptes, login, token, hachage) | ⬜ à faire |
| S2 — Données de référence (API + sync + listes fermées) | ⬜ à faire |
| S3 — Publication + file d'attente hors-ligne | ⬜ à faire |
| S4 — Consultation / téléchargement / suppression (rôles) | ⬜ à faire |
| S5 — Gestion des paramètres par le manager | ⬜ à faire |
| S6 — Durcissement sécurité + CORS + config déploiement | ⬜ à faire |
| S7 — Tests et validation | ⬜ à faire |

---

## 1. Périmètre de cette couche (ce qu'on ajoute)

1. **Authentification + rôles** (`manager` / `user`), session conservée pour l'usage
   hors-ligne.
2. **Synchronisation des données de référence** depuis le serveur → les champs concernés
   deviennent des **listes déroulantes fermées** (plus d'auto-complétion en saisie libre).
3. **Publication** d'une fiche : génération PDF côté client (existant) **puis téléversement
   des données structurées + du PDF**, avec **file d'attente hors-ligne** et **retransmission
   automatique**.
4. **Consultation centralisée** : le manager parcourt/filtre/télécharge/supprime toutes les
   fiches ; l'user voit uniquement les siennes.

**Hors périmètre (ne pas faire) :** édition en place des fiches publiées ; régénération PDF
côté serveur ; synchronisation bidirectionnelle ; notifications push ; multi-entreprise.

---

## 2. Architecture d'ensemble

```
        APPAREIL (PWA, cœur hors-ligne inchangé)                    SERVEUR ENTREPRISE (HTTPS)
 ┌───────────────────────────────────────────────┐        ┌──────────────────────────────────┐
 │  index.html / views / calculations / pdf.js    │        │  API Python (FastAPI ou Flask)   │
 │  signature.js  (TOUT reste hors-ligne)         │        │   ├─ /auth        (login, token)  │
 │                                                │        │   ├─ /reference   (listes)       │
 │  js/auth.js   ── session + rôle (token caché)  │  HTTPS │   ├─ /fiches      (publier/lister │
 │  js/api.js    ── fetch + token + base URL ─────┼───────▶│   │                /télécharger/  │
 │  js/sync.js   ── sync référence + file upload  │ (JSON +│   │                supprimer)     │
 │                                                │  PDF)  │   └─ /settings    (CRUD manager)  │
 │  IndexedDB :                                   │        │                                  │
 │   ├─ fiches            (existant)              │        │  SQLite (users, chantiers,       │
 │   ├─ reference_cache   (NOUVEAU)               │        │   participants, fiches…)         │
 │   ├─ file_attente      (NOUVEAU, upload queue) │        │  PDF sur disque (hors webroot)   │
 │   └─ session           (NOUVEAU, token+rôle)   │        └──────────────────────────────────┘
 └───────────────────────────────────────────────┘
```

✅ **DÉCISION ARRÊTÉE — hébergement du front : option (A).** **Le backend Python sert aussi
les fichiers de la PWA** (même origine que l'API). **GitHub Pages est abandonné** (avec la
nouvelle version connectée). Conséquences, à appliquer telles quelles :

- **Pas de CORS** à gérer (même origine) → §11 simplifié.
- L'API est appelée en **chemin relatif** (`/api/...`) — **aucune URL à coder en dur** côté
  client.
- Tout derrière **le même HTTPS d'entreprise** fourni par l'IT, une seule URL à connaître.
- Le **hors-ligne reste intact** : le service worker met en cache les fichiers de la PWA
  servis par le backend, exactement comme avant.

> Note : le dépôt `application-qse-pwa/` restait connecté à GitHub (`wyrdaSC/qse-biollay-pwa`)
> pour les premiers tests sur la branche `main`. Le développement de cette couche se fait sur
> la branche **`dev`** ; on ne **publie plus** via GitHub Pages, on **sert la PWA depuis le
> serveur d'entreprise**.

---

## 3. Modèle de données serveur (SQLite)

> Schéma indicatif. L'implémenteur adapte les types au framework choisi (SQLAlchemy,
> `sqlite3` brut, SQLModel…). **Toutes** les tables ont `id INTEGER PRIMARY KEY` sauf mention.

```sql
-- Comptes d'authentification (rôles).  ⚠️ NE PAS confondre avec 'participants' (ci-dessous).
users (
  id, username TEXT UNIQUE NOT NULL, nom TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL,      -- 'manager' | 'user'
  actif INTEGER NOT NULL DEFAULT 1, created_at TEXT
)

-- Données de référence (poussées vers les apps). Extensibles : ajouter des tables du même
-- moule quand de nouveaux champs apparaîtront (cf. §7, conception générique).
chantiers (
  id, nom TEXT NOT NULL, actif INTEGER NOT NULL DEFAULT 1, created_at TEXT
)
participants (                 -- = la liste "utilisateurs" de l'app actuelle (auto-complétion)
  id, nom TEXT NOT NULL, role TEXT, actif INTEGER NOT NULL DEFAULT 1
)

-- Fiches publiées (données structurées + métadonnées + chemin du PDF).
fiches (
  id,
  client_uuid TEXT UNIQUE NOT NULL,    -- ⚠️ idempotence upload (voir §8)
  type TEXT, numero TEXT, chantier TEXT, localisation TEXT, date TEXT, controleur TEXT,
  nature_support TEXT, nature_revetement TEXT, type_preparation TEXT,
  data TEXT,                           -- JSON : contenu spécifique (mesures, critères…)
  signature_applicateur TEXT, signature_controleur TEXT,   -- data URL PNG base64
  conforme INTEGER,                    -- 1 | 0 | NULL
  statut TEXT,                         -- 'publie'  (côté serveur, toujours publié)
  author_user_id INTEGER NOT NULL REFERENCES users(id),    -- ⚠️ qui a publié (traçabilité, filtrage)
  pdf_path TEXT NOT NULL,              -- chemin du fichier sur disque (hors webroot)
  created_at TEXT, published_at TEXT
)
```

> ⚠️ **POINT CRITIQUE — collision de noms.** L'app actuelle a un *object store* IndexedDB
> nommé **`utilisateurs`** : c'est la **liste des participants** (nom + rôle, pour
> l'auto-complétion), **PAS** des comptes de connexion. Les **comptes d'auth** (`users`
> ci-dessus) sont un **concept nouveau**. Ne pas fusionner les deux. Côté serveur, la table
> des participants s'appelle `participants` pour éviter toute ambiguïté.

**Évolution du modèle existant (`fiches` côté IndexedDB, §4 de `PLAN_PWA`) :**
- Ajouter un champ **`author`** (identité du compte connecté) au moment de la création/publication.
- Ajouter **`client_uuid`** (généré localement à la création, ex. `crypto.randomUUID()`),
  réutilisé pour l'upload idempotent.
- **Statuts revus :** `brouillon` (local, modifiable) → `en_attente` (publié hors-ligne, en
  file d'upload) → `publie` (confirmé serveur, **lecture seule pour l'user**). Les anciens
  statuts `complet` / `envoye` disparaissent (liés à l'email supprimé). 🔶 **DÉCISION
  (migration) :** on suppose **aucune donnée réelle en production** à migrer (départ propre).
  Si ce n'est pas le cas, prévoir un mappage des anciens statuts. À confirmer.

---

## 4. Endpoints de l'API

> Toutes les routes (sauf `/auth/login`) exigent un **token valide**. Le **contrôle de rôle
> est fait côté serveur** sur chaque route — ⚠️ **ne jamais faire confiance au client** pour
> les droits.

| Méthode & route | Rôle | Rôle requis | Notes |
|---|---|---|---|
| `POST /auth/login` | identifiants → token | public | corps `{username, password}` → `{token, role, nom}` |
| `POST /auth/logout` | invalide la session | authentifié | selon stratégie token (§5) |
| `GET /reference` | listes de référence + version | authentifié | `{version, chantiers:[…], participants:[…], …}` |
| `POST /fiches` | **publier** une fiche | user/manager | données structurées **+ PDF**. **Idempotent** sur `client_uuid` |
| `GET /fiches` | lister/filtrer | user/manager | user → **les siennes** ; manager → **toutes**. Filtres : `chantier,type,date,author,conforme` |
| `GET /fiches/{id}/pdf` | télécharger le PDF | user (sienne) / manager | ⚠️ vérifier l'appartenance côté serveur |
| `DELETE /fiches/{id}` | supprimer | **manager seul** | supprime l'enregistrement **et** le fichier disque |
| `GET /settings` `POST/PUT/DELETE /settings/chantiers` `…/participants` | CRUD référence | **manager seul** | base de l'écran Paramètres (§7) |

🔶 **DÉCISION (transport du PDF) :** **multipart/form-data** (PDF en binaire + champ JSON)
**recommandé** — plus efficace que du JSON avec PDF en base64 (qui gonfle ~33 %). À cette
échelle l'un comme l'autre passe ; multipart par défaut.

⚠️ **POINT CRITIQUE — appartenance.** Sur `GET /fiches`, `GET /fiches/{id}/pdf` et
`DELETE`, **filtrer/vérifier par `author_user_id` côté serveur** pour un `user`. Un user ne
doit jamais pouvoir lister ou télécharger la fiche d'un autre en devinant un `id`.

⚠️ **POINT CRITIQUE — chemin de fichier.** Les PDF sont stockés **hors de la racine web** et
servis **uniquement** via `GET /fiches/{id}/pdf` (jamais par URL de fichier directe). Au
stockage, **ne pas** construire le chemin à partir d'entrées utilisateur (risque de
*path traversal*) : générer un nom interne (ex. `{id}.pdf` ou un UUID), garder le nom
« humain » seulement comme métadonnée d'affichage.

---

## 5. Authentification & rôles (détail)

**Flux de connexion :**
1. Premier lancement **en ligne obligatoire** (déjà le cas pour le cache du service worker) :
   l'utilisateur se connecte (username + mot de passe).
2. Le serveur vérifie le hash → renvoie un **token** + le **rôle** + le **nom**.
3. Le client **met en cache** token + rôle + nom dans IndexedDB (store `session`) → l'identité
   reste connue **hors-ligne**.
4. Toutes les requêtes ultérieures envoient le token (en-tête `Authorization`).
5. Déconnexion : efface la session locale (+ invalidation serveur selon stratégie).

🔶 **DÉCISION (type de token) :** **JWT signé** (sans état serveur, simple) **ou token opaque
stocké en base** (révocable). À cette échelle, JWT avec expiration raisonnable suffit ;
l'opaque facilite la révocation. Recommandation : commencer **simple** (JWT), revoir si la
révocation devient un besoin.

⚠️ **POINT CRITIQUE — expiration vs hors-ligne.** Un ouvrier peut rester **plusieurs jours
hors connexion** avec des fiches en file d'attente. Si le token expire pendant ce temps :
- la **publication locale (mise en file) doit rester possible** sans serveur (l'identité est
  déjà connue, la fiche attend) ;
- au retour du réseau, si le token a expiré, **redemander la connexion** puis vider la file.
- 🔶 **DÉCISION :** durée de validité du token (recommandé : **assez longue**, ex. plusieurs
  jours/semaines, pour éviter de bloquer le terrain) **et** comportement au réexpire
  (re-login transparent qui débloque la file). À confirmer.

🔶 **DÉCISION (provisionnement des comptes) :** qui crée les comptes ? Recommandé : un
**script d'amorçage** crée le **premier manager** ; ensuite les managers créent les autres
comptes via l'écran Paramètres (ou, version la plus simple pour démarrer, tous les comptes
sont créés par script/seed). À confirmer.

🔶 **DÉCISION (réinitialisation de mot de passe) :** pas de self-service email (email
supprimé). Recommandé : **le manager réinitialise** le mot de passe d'un user (valeur
temporaire). À confirmer.

⚠️ **POINT CRITIQUE — anti-bourrinage.** Le login étant exposé en HTTPS public, prévoir un
**rate-limit** simple sur `POST /auth/login` (ex. n tentatives/minute/IP) pour limiter le
bruteforce.

---

## 6. Couche « synchronisation des données de référence »

**Quand synchroniser :** à la **connexion**, puis à chaque **retour au premier plan de l'app
quand le réseau est disponible** (et/ou un bouton « rafraîchir » dans Paramètres). Stocker le
résultat dans IndexedDB (`reference_cache`), avec la `version`/horodatage renvoyé par
`/reference`.

**Usage dans les formulaires :** les champs concernés (au minimum **Chantier** et
**Contrôleur/participant**, plus les futurs champs) passent d'une **auto-complétion en saisie
libre** à une **liste déroulante fermée** alimentée par `reference_cache`. ⚠️ **POINT
CRITIQUE — changement d'UX dans `js/views/form.js`** : aujourd'hui ces champs sont des
`<input list="liste-chantiers">` / `list="liste-utilisateurs"` reliés à des `<datalist>`
(lignes ~75-96 et ~300 de `form.js`) — or **un `<datalist>` n'empêche PAS la saisie libre**.
Il faut les **remplacer par de vrais `<select>`** peuplés depuis `reference_cache` (idem pour
les champs *Nom* des deux zones de signature). Hors-ligne, on utilise **la dernière liste
mise en cache**.

⚠️ **POINT CRITIQUE — chantier absent (règle « manager pré-crée »).** Si le chantier voulu
n'est pas dans la liste, l'user **ne peut pas** le créer. L'UX doit être **explicite** : un
message du type « Ce chantier n'existe pas encore. Demandez à un responsable de l'ajouter
dans les paramètres. » plutôt qu'un champ vide silencieux. (Décision arrêtée ; voir la
mitigation au §0.)

**Conception générique (extensibilité).** L'utilisateur a annoncé **d'autres champs de
référence à venir**. Concevoir la sync et le rendu des `<select>` de façon **pilotée par
données** : une liste de « champs de référence » déclarés une fois (clé, libellé, endpoint),
plutôt qu'un traitement codé en dur par champ. Ajouter un futur champ = ajouter une entrée +
une table serveur du même moule, sans réécrire la mécanique.

---

## 7. Écran Paramètres côté manager (gestion de la référence)

« Version simple, sans véritable UI d'admin » (décision arrêtée). Concrètement :

- Réutiliser l'écran **Paramètres** existant (`js/views/parametres.js`), mais :
  - en **lecture seule** pour un `user` ;
  - en **CRUD contre le serveur** (`/settings/...`) pour un `manager` (ajout/suppression de
    chantiers, de participants, et création/gestion des comptes selon §5).
- 🔶 **DÉCISION (UI manager) :** **onglet/section Paramètres réservé au manager dans la PWA**
  (recommandé — rien de nouveau à héberger) **vs** page web séparée servie par le backend.
  Recommandé : tout dans la PWA.

> 💡 **Simplification clé (consultation depuis un ordinateur).** L'utilisateur veut que les
> managers accèdent aux fiches **« soit depuis un ordinateur, soit depuis l'app »**. Inutile
> de construire une seconde interface web : **la PWA s'ouvre déjà dans un navigateur de
> bureau** (Chrome/Edge sur PC). Le manager utilise **la même PWA** sur ordinateur. Une seule
> interface à maintenir.

---

## 8. Couche « publication + file d'attente hors-ligne »

**Renommage du flux :** le bouton **« Générer PDF »** devient **« Publier »**.

**Au clic sur Publier :**
1. Calculer la conformité (existant, `js/calculations.js`).
2. Générer le PDF **côté client** (existant, `js/pdf.js`) — **inchangé, fait foi**.
3. **Mettre en file d'attente** un travail d'upload `{ client_uuid, fiche (JSON), pdf (blob) }`
   dans IndexedDB (`file_attente`).
4. Passer le statut de la fiche à **`en_attente`** ; le brouillon devient **non modifiable**
   par l'user (cf. décision : lecture seule après publication).
5. **Tenter l'upload** immédiatement si en ligne ; sinon il restera en file.

**Retransmission (`js/sync.js`) :** vider la file quand le réseau revient.
- Déclencheurs : événement `online`, retour au premier plan, (optionnel) intervalle.
- 🔶 **DÉCISION (mécanisme) :** **Background Sync API** (rejoue même app fermée) **vs**
  **retry manuel** sur `online`/foreground. ⚠️ **Background Sync n'existe pas sur iOS/Safari**
  → **recommandé : retry manuel** (compatible iPhone), Background Sync en bonus si présent.
- Sur succès (`POST /fiches` → 200/201) : statut **`publie`**, retirer de la file.
- Sur échec réseau : **garder en file**, réessayer plus tard (backoff simple).

⚠️ **POINT CRITIQUE — idempotence.** La file peut **rejouer** un upload (perte de réponse,
double déclenchement). Le serveur **déduplique sur `client_uuid`** : si une fiche avec ce
`client_uuid` existe déjà, renvoyer **succès** (200) **sans** créer de doublon. Sans cela,
une mauvaise connexion crée des fiches en double.

⚠️ **POINT CRITIQUE — service worker et appels réseau.** Le service worker actuel est
**cache-first**. Il **ne doit pas** intercepter les appels à l'API avec une réponse en cache
périmée. Configurer le SW en **network-only** (ou network-first) pour les requêtes vers l'API
(les distinguer par préfixe d'URL/chemin). Sinon : tokens périmés, listes périmées, uploads
fantômes. **Penser aussi à incrémenter `CACHE_VERSION`** (piège connu, §11 de `PLAN_PWA`).

**Statut & droits après publication :**
- L'user : **voit** sa fiche (consultation + téléchargement PDF), **ne peut plus la modifier
  ni la supprimer**.
- Le manager : peut la **supprimer** (et seulement lui).
- **Brouillons** (`brouillon`) : restent locaux et **modifiables** tant que non publiés.

⚠️ **POINT CRITIQUE — taille d'upload.** Le PDF observé va de ~13 Ko à ~700 Ko (signatures
PNG incluses). À ≤ 50/jour, négligeable, mais utiliser **multipart** (§4) et ne pas bloquer
l'UI pendant l'envoi (upload en arrière-plan, l'app reste utilisable).

---

## 9. Couche « consultation centralisée »

Nouvel écran (ou extension de l'`historique` existant) **piloté par le rôle** :
- **user :** liste **ses** fiches publiées (`GET /fiches` filtré serveur) + ses brouillons
  locaux. Téléchargement PDF. Pas de suppression.
- **manager :** liste **toutes** les fiches, **filtres** par chantier / type / date / auteur /
  conformité, **téléchargement** PDF, **suppression** (avec `confirm()`).

Réutiliser le motif `.liste-fiches` / `.badge` et les filtres existants de
`js/views/historique.js`. La distinction « mes fiches locales (brouillons) » vs « fiches
serveur » doit être lisible (badge de statut : *Brouillon* / *En attente* / *Publiée*).

🔶 **DÉCISION (fiches locales déjà publiées) :** après publication confirmée, **garde-t-on la
copie locale** sur l'appareil de l'auteur (consultation hors-ligne) ou s'appuie-t-on sur le
serveur ? Recommandé : **garder la copie locale en lecture seule** (consultation hors-ligne
de ses propres fiches) ; le serveur reste la source de vérité pour la liste complète. À
confirmer.

---

## 10. Impact sur les fichiers existants de la PWA (carte d'intégration)

> L'implémenteur **lit ces fichiers** (accès complet) et y branche la couche. Indicatif :

**Nouveaux fichiers :**
- `js/api.js` — wrapper `fetch` : URL de base (config), ajout du token, gestion 401, JSON/multipart.
- `js/auth.js` — login/logout, état de session, rôle, garde « connecté ? ».
- `js/sync.js` — sync `/reference` + vidage de la `file_attente` (retry).
- `js/views/connexion.js` — écran de login (NOUVEAU).
- (éventuel) `js/views/fiches-serveur.js` — consultation centralisée si non fusionnée avec `historique.js`.

**Fichiers modifiés :**
- `index.html` — **garde-fou de connexion** (rediriger vers login si pas de session) ;
  charger les nouveaux modules ; **retirer tout reliquat email**.
- `js/db.js` — nouveaux stores `session`, `reference_cache`, `file_attente` ; champs `author`
  + `client_uuid` sur `fiches` ; statuts revus (`brouillon`/`en_attente`/`publie`). ⚠️ si
  ajout de stores → **bump de version IndexedDB** + `onupgradeneeded`.
- `js/router.js` — route `#/connexion` ; gardes de rôle (écrans manager).
- `js/app.js` — au démarrage : vérifier la session, lancer une sync si en ligne, brancher le
  retry de file sur l'événement `online`.
- `js/views/form.js` — **listes fermées** (Chantier/Contrôleur depuis `reference_cache`) ;
  bouton **« Publier »** (remplace « Générer PDF ») ; mode **lecture seule** si fiche publiée.
- `js/views/consultation.js` — **retirer le bouton `mailto` intégré** mais **conserver le
  bouton de téléchargement du PDF** (l'utilisateur l'enverra lui-même hors app) ; afficher
  le statut de publication ; **suppression visible pour le manager uniquement**.
- `js/views/parametres.js` — lecture seule (user) vs CRUD serveur (manager) ; gestion des
  comptes (selon §5).
- `js/views/home.js` — état connecté + nom/rôle ; menu adapté au rôle ; le compteur
  « non envoyées » devient **« à publier / en attente »**.
- `service-worker.js` — **network-only pour l'API** (§8) ; **incrémenter `CACHE_VERSION`**
  (schéma **`v2.x`**, baseline `v2.0` — cf. §11) ; ajouter les nouveaux fichiers JS à
  `RESSOURCES`.

---

## 11. Configuration & déploiement

- **URL de base de l'API** : le front étant **servi par le backend** (option A arrêtée, §2),
  l'API est appelée en **chemin relatif** (`/api/...`) → **aucune URL à coder en dur**, rien à
  configurer côté client. (Un `js/config.js` reste utile pour d'autres constantes éventuelles,
  mais pas pour l'URL de l'API.)
- ✅ **CORS : sans objet.** Même origine (front + API servis par le même serveur) → **pas de
  configuration CORS**. C'est l'intérêt principal de l'option A.
- **Versionnage du cache (service worker) :** schéma **`v2.x`** pour l'ère « serveur central »,
  **baseline `v2.0`** (l'app hors-ligne seule avait atteint `v15` sous l'ancien schéma).
  Incrémenter `CACHE_VERSION` (`v2.1`, `v2.2`, …) **à chaque** modification de fichiers mis en
  cache. ⚠️ Ne pas oublier — sinon les appareils continuent de servir l'ancienne version.
- **Stockage des PDF** : dossier sur disque **hors webroot**, inclus dans la **sauvegarde IT**
  (avec le fichier SQLite). ⚠️ Confirmer à l'IT que **base + dossier PDF** sont sauvegardés.
- **Lancement** : l'IT fait tourner le service (uvicorn/gunicorn pour FastAPI, ou serveur WSGI
  pour Flask) derrière le reverse-proxy HTTPS. Détail d'ops → IT.

---

## 12. Checklist sécurité (à valider en phase S6)

- [ ] Mots de passe **hachés** (argon2/bcrypt), jamais en clair.
- [ ] **HTTPS** partout ; refuser le HTTP.
- [ ] **Un compte par personne** ; pas de secret partagé.
- [ ] **Contrôle de rôle côté serveur** sur chaque route (jamais côté client seul).
- [ ] **Filtrage par auteur** pour les `user` (liste, téléchargement, suppression interdite).
- [ ] **Validation des entrées** (Pydantic/validation manuelle) sur tous les corps de requête.
- [ ] PDF **hors webroot**, servis uniquement via endpoint authentifié ; **pas de path traversal**.
- [ ] **Rate-limit** sur le login.
- [ ] **Idempotence** des uploads (`client_uuid`).
- [ ] Token : stockage, expiration, et comportement hors-ligne définis (§5).
- [ ] Service worker en **network-only** pour l'API (pas de réponse périmée servie).

---

## 13. Phases de construction (à exécuter dans l'ordre)

> Chaque phase ≈ une étape vérifiable. Valider le critère de fin avant la suivante. Mettre à
> jour le §0bis à chaque phase.

### Phase S0 — Squelette backend + schéma
Créer le projet Python (FastAPI ou Flask — 🔶 §0), le schéma SQLite (§3), un endpoint
« santé » (`GET /health`). Décider **hébergement front** (option A/B, §2). Faire tourner en
local en HTTPS (ou HTTP local + reverse-proxy de dev).
**Fin :** l'API démarre, la base se crée, `/health` répond.

### Phase S1 — Authentification + rôles
Table `users`, hachage (argon2/bcrypt), `POST /auth/login` → token, middleware
d'authentification + **contrôle de rôle**, rate-limit login. Côté client : `js/auth.js`,
`js/api.js`, écran `#/connexion`, store `session`, garde-fou de connexion dans `app.js`.
**Fin :** un manager et un user peuvent se connecter ; le rôle est connu côté client et
persiste hors-ligne ; les routes protégées refusent sans token.

### Phase S2 — Données de référence (API + sync + listes fermées)
`GET /reference` + CRUD `/settings/...` (manager). Côté client : `js/sync.js`,
`reference_cache`, formulaires en **listes fermées** (§6), message « chantier absent », écran
Paramètres en CRUD serveur pour le manager (§7).
**Fin :** un manager ajoute un chantier sur le serveur ; il apparaît en liste déroulante sur
un autre appareil après sync ; un user ne peut pas le modifier ; hors-ligne, la dernière
liste sert.

### Phase S3 — Publication + file d'attente hors-ligne
Bouton **« Publier »**, store `file_attente`, `POST /fiches` (multipart, **idempotent**),
retry sur `online`/foreground, statuts `en_attente`/`publie`, lecture seule après
publication. SW **network-only** pour l'API + bump `CACHE_VERSION`.
**Fin :** publier en ligne crée la fiche serveur (PDF + données) ; publier **hors-ligne** met
en file et **téléverse au retour du réseau** ; un double déclenchement **ne crée pas** de
doublon.

### Phase S4 — Consultation centralisée (rôles)
`GET /fiches` (filtré serveur), `GET /fiches/{id}/pdf`, `DELETE /fiches/{id}` (manager seul).
Écran de consultation piloté par rôle (§9), suppression de l'email dans
`consultation.js`.
**Fin :** un user ne voit/télécharge **que** ses fiches ; un manager voit **toutes**, filtre,
télécharge, supprime ; un user ne peut pas supprimer ni accéder à la fiche d'un autre.

### Phase S5 — Gestion des comptes et paramètres (manager)
Création/désactivation de comptes, réinitialisation de mot de passe (§5), finalisation du
CRUD référence (§7).
**Fin :** un manager gère comptes et listes de référence depuis l'app.

### Phase S6 — Durcissement sécurité + CORS + déploiement
Parcourir la **checklist §12**. Configurer CORS (si option B), reverse-proxy HTTPS,
sauvegardes (base + dossier PDF) avec l'IT.
**Fin :** checklist §12 verte ; déploiement documenté.

### Phase S7 — Tests et validation
Tests backend (auth, rôles, idempotence, filtrage par auteur, suppression). Validation
bout-en-bout : publication en ligne **et** hors-ligne (mode avion → retour réseau), rôles
manager/user, sync de référence. Validation manuelle sur **iPhone (Safari)** et **Android
(Chrome)** réels (comme la Phase 10 de `PLAN_PWA`, non automatisable ici).
**Fin :** §10 des critères d'acceptation (ci-dessous) satisfait.

---

## 14. Décisions à confirmer avant/pendant l'implémentation (récapitulatif des 🔶)

| # | Décision | Recommandation par défaut |
|---|---|---|
| 1 | **Framework** Flask vs FastAPI | **FastAPI** (Flask accepté) |
| 2 | ~~**Hébergement du front**~~ | ✅ **RÉSOLU : (A) servi par le backend** ; GitHub Pages abandonné, API en chemin relatif, pas de CORS |
| 3 | **Type de token** : JWT vs opaque en base | **JWT**, simple, revoir si révocation requise |
| 4 | **Durée du token + comportement au réexpire** (usage hors-ligne long) | **Validité longue** + re-login qui débloque la file |
| 5 | **Provisionnement des comptes** | seed du 1er manager, puis création par managers |
| 6 | **Réinitialisation de mot de passe** | **le manager réinitialise** (pas d'email) |
| 7 | **UI Paramètres manager** : dans la PWA vs page web séparée | **dans la PWA** |
| 8 | **Transport du PDF** : multipart vs base64 | **multipart** |
| 9 | **Mécanisme de retry** : Background Sync vs manuel | **manuel** (compat iOS) + Background Sync en bonus |
| 10 | **Migration** des fiches existantes | **aucune** (départ propre) — à confirmer |
| 11 | **Copie locale après publication** | **garder en lecture seule** (consultation hors-ligne) |

---

## 15. Pièges connus à éviter (spécifiques à cette couche)

- **Service worker cache-first qui « avale » l'API** → réponses périmées. Mettre l'API en
  **network-only**, et **toujours bumper `CACHE_VERSION`**.
- **CORS** oublié si le front reste sur GitHub Pages (option B). Préférer l'option A.
- **Uploads dupliqués** sans `client_uuid` idempotent (mauvaise connexion = doublons).
- **Token expiré hors-ligne** qui bloque le terrain : validité longue + re-login au retour.
- **Liste fermée qui bloque un chantier neuf** : message clair, mitigation « manager
  pré-crée » documentée — **ne pas** rouvrir en saisie libre.
- **Confusion `users` (auth) vs `participants` (`utilisateurs` IndexedDB existant)** :
  concepts distincts.
- **Édition d'une fiche signée** : interdite (intégrité de la signature). Correction =
  suppression manager + republication.
- **Hachage des mots de passe / HTTPS / comptes nominatifs** : les trois non-négociables,
  jamais contournés « pour aller vite ».
- **Path traversal** au stockage/téléchargement des PDF : noms internes, fichiers hors webroot.
- **Migration IndexedDB** (nouveaux stores/champs) sans bump de version → `onupgradeneeded`
  non déclenché.

---

## 16. Critères d'acceptation (cette couche est « finie » quand…)

- [ ] Connexion obligatoire ; rôle `manager`/`user` reconnu et **persistant hors-ligne**.
- [ ] Données de référence **poussées par le serveur** ; formulaires en **listes fermées** ;
      un manager les édite, un user non.
- [ ] **Publier** téléverse **données structurées + PDF** ; fonctionne **hors-ligne** (file
      d'attente) avec **retransmission automatique** au retour du réseau, **sans doublon**.
- [ ] Après publication : fiche **en lecture seule** pour l'user ; **seul le manager
      supprime**.
- [ ] Un **user** ne voit/télécharge **que ses** fiches ; un **manager** voit/filtre/télécharge
      **toutes** et supprime.
- [ ] **Aucun `mailto` intégré** dans l'app, mais le **téléchargement du PDF reste possible**
      (envoi manuel hors app).
- [ ] **HTTPS**, mots de passe **hachés**, **comptes nominatifs** ; contrôle de rôle **côté
      serveur**.
- [ ] Le **cœur hors-ligne d'origine reste intact** (saisie, calculs, signature, PDF sans
      réseau).
- [ ] Tests backend (auth, rôles, idempotence, filtrage par auteur) au vert.

---

*Fin du plan « couche serveur central ». À lire avec `PLAN_PWA_VanillaJS.md` (cœur de l'app)
et un survol de `application-qse-pwa/`. Les points 🔶 du §14 doivent être confirmés par
Sylvain ; les ⚠️ sont les zones à fort risque.*
