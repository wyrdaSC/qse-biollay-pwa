# Plan de construction — Application QSE (PWA vanilla-JS, hors-ligne)

> **À l'attention de la future instance de Claude Code.**
> Ce document est **autosuffisant** : il contient tout le nécessaire pour construire
> l'application complète **sans poser de question préalable**. Lis-le en entier avant
> de commencer, puis exécute les phases dans l'ordre.
>
> Il **remplace** le choix technique du document d'origine `Plan_Developpement_Application_QSE.pdf`
> (qui proposait React) mais **réutilise tout son périmètre et ses spécifications**
> (les 4 fiches, les calculs, la mise en page PDF). Quand ce plan dit « identique au plan
> d'origine », c'est volontaire.

---

## 0. Contexte et décisions déjà prises (ne pas les rouvrir)

**Projet** : application pour Travaux Spéciaux Biollay SA, permettant aux chefs d'équipe et
conducteurs de travaux de remplir des **fiches de contrôle qualité** sur chantier
(téléphone/tablette), de **signer** numériquement, de **générer un PDF** et de l'**envoyer
par email**. Tout en **français**.

**Décisions arrêtées avec l'utilisateur (Sylvain Collet) — à respecter :**

1. **PWA en JavaScript « vanilla » (pas de framework).** Pas de React, **pas d'étape de
   build**, pas de npm/Vite/TypeScript. Uniquement des fichiers `.html`, `.css`, `.js`
   ouvrables et lisibles directement. Raison : le mainteneur connaît Python et un peu de
   C++, mais pas l'écosystème React ; il doit pouvoir relire et ajuster le code.
2. **Fonctionnement 100 % hors-ligne sur le téléphone**, sans serveur, sans compte, sans
   wifi sur le chantier. C'est l'exigence n°1 (un précédent prototype Flask a été écarté
   précisément parce qu'il imposait un serveur joignable en wifi).
3. **Option B « local uniquement »** du plan d'origine : stockage local, PDF téléchargé,
   email via `mailto:`. Pas de cloud (peut-être ajouté plus tard, ne pas le prévoir
   maintenant).
4. **Toutes les bibliothèques sont vendées localement** (copiées dans le dépôt), jamais
   chargées depuis un CDN à l'exécution — sinon l'app ne marcherait pas hors-ligne.

**Pourquoi ces choix (pour mémoire, ne pas reproposer autre chose) :** React = trop loin
des compétences du mainteneur ; Flask/Python = nécessite un serveur en marche (inadapté au
chantier) ; PyScript/Pyodide = trop lourd et immature ; Python natif sur téléphone = non
viable. Le compromis accepté est : ce n'est plus « du Python », la génération PDF et le
stockage passent en JavaScript.

**Un prototype Flask existe** dans `application-qse/` (même dossier parent). Il **n'est pas
la cible**, mais sa logique métier est correcte et **doit être portée telle quelle** :
- `application-qse/app/calculations.py` → règles de calcul et de conformité (référence exacte).
- `application-qse/app/forms_def.py` → libellés, critères, types de rupture, bornes.
- `application-qse/app/pdf_generator.py` → mise en page du PDF.
- `application-qse/app/static/js/signature.js` → pad de signature tactile (réutilisable quasi tel quel).
- `application-qse/tests/test_calculations.py` → cas de test à reproduire en JS.
Si ce dossier est présent, **lis ces fichiers** pour porter la logique sans la réinventer.

---

## 0bis. État d'avancement (à mettre à jour à chaque session)

> **À lire avant de commencer.** Reflète l'état réel du dépôt `application-qse-pwa/`,
> qui peut différer légèrement du plan ci-dessous (ajustements pris en cours de route,
> documentés ici pour ne pas les rouvrir).

**Phases terminées : 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11.** Toutes les phases prévues
pour la v1 sont faites (la Phase 12 « Extensibilité » est volontairement non
implémentée — cf. son intitulé « pour plus tard »). Reste un **test manuel par
l'utilisateur sur iPhone/Android physiques** (cf. notes Phase 10) et l'ajout des
captures d'écran réelles dans `docs/screenshots/` (cf. notes Phase 11).

Avancement détaillé :
- **Phase 0** : structure créée, `vendor/jspdf.umd.min.js` (jsPDF 2.5.2, téléchargé depuis
  jsdelivr — cdnjs renvoyait 404), `icons/icon.svg` copié depuis le prototype Flask.
- **Phase 1** : `index.html`, `manifest.webmanifest`, `service-worker.js` (cache-first
  versionné), `css/style.css`, `js/app.js`, `js/router.js` (squelette).
- **Phase 2** : `js/db.js` — wrapper IndexedDB complet (fiches/chantiers/utilisateurs),
  toutes les fonctions CRUD du §4, testées et persistance vérifiée.
- **Phase 3** : `js/router.js` complet (routes réelles), `js/views/home.js` (4 boutons,
  fiches récentes, compteur non envoyées), `js/forms-def.js` (FORM_TYPES uniquement à ce
  stade), `js/util.js` (nouveau, non prévu dans la structure §3 — fonction
  `echapperHtml` partagée par les vues).
- **Phase 4** : `js/forms-def.js` complété (CHAMPS_COMMUNS, RECEPTION_CRITERES, ruptures
  cohésion/adhérence, colonnes/bornes ambiance, seuils), `js/views/form.js` (formulaire
  générique pour les 4 types : en-tête commun + auto-complétion chantiers/contrôleurs,
  corps spécifique, tableaux de mesures avec ajout/suppression, zones de signature avec
  `<canvas>` présent mais pad **pas encore fonctionnel** — Phase 5). Boutons "Enregistrer
  brouillon" / "Générer PDF" présents dans le DOM mais **sans handler** (Phase 6).
- **Phase 5** : `js/calculations.js` (port exact de `calculations.py` — `versNombre`,
  `calculerXi`, `analyserEssai`, `conformiteReception`, `conformiteAmbianceLigne`,
  `conformiteAmbiance`), `js/signature.js` (pad de signature en module ES,
  `creerPadSignature` + `initialiserPads`, gère le rechargement d'une signature existante
  via `data-initial`). `js/views/form.js` : recalcul en temps réel branché sur
  `input`/`change` du formulaire — xi/gardé par ligne + xm/s/xm-s + badge conformité pour
  cohésion/adhérence (avec renumérotation des lignes), badge OK/NOK par ligne pour
  ambiance, badge conforme/non conforme en direct pour réception. Pads de signature
  initialisés et stockés dans `padsActuels` (réutilisé Phase 6). Tests de parité créés :
  `tests/test.html` + `tests/test-calculations.js` (17 cas, mêmes scénarios que
  `test_calculations.py`), tous verts. CSS : classes `.conforme`/`.non-conforme` pour les
  cellules `td[data-cell]` du tableau ambiance.
- **Phase 6** : `js/pdf.js` (génération PDF avec jsPDF, port manuel de `pdf_generator.py`),
  `js/views/consultation.js` (écran de consultation), boutons « Enregistrer brouillon » /
  « Générer PDF » de `js/views/form.js` branchés (enregistrement IndexedDB + calcul
  conformité + téléchargement PDF), nouvelle route `#/fiche/:id/modifier` dans
  `js/router.js`, `telechargerBlob` ajouté à `js/util.js`, `vendor/jspdf.umd.min.js` chargé
  en script classique dans `index.html`. Détails complets dans la section Phase 6
  ci-dessous.
- **Phase 7** : `js/views/historique.js` (liste de toutes les fiches, filtres « type » et
  « chantier » réinitialisés à chaque entrée sur l'écran, ré-affichage de la liste sans
  recharger la page, badge statut + badge conformité réutilisant `STATUT_LABELS` et le
  motif `.liste-fiches`/`.badge` de `home.js`). `js/views/parametres.js` (deux onglets
  client-side « Chantiers » / « Participants », formulaires d'ajout + listes avec bouton
  de suppression `.bouton-icone` + `confirm()`). `js/router.js` : routes `#/historique` et
  `#/parametres` branchées sur ces nouvelles vues (placeholders `rendreProvisoire`
  supprimés pour ces deux routes). `js/db.js` : `ajouterUtilisateur` corrigé pour ignorer
  les doublons (même nom), comme `ajouterChantier` — nécessaire car l'écran paramètres
  permet désormais d'en ajouter directement. CSS : `.filtres`/`.champ-filtre`,
  `.onglets-param`/`.onglet-param`, `.ligne-ajout`, `.liste-param`. Détails complets dans
  la section Phase 7 ci-dessous.
- **Phase 8** : `js/views/consultation.js` — corps du mailto aligné sur §9 (« en date du »
  + « IMPORTANT : pensez à joindre le fichier PDF préalablement téléchargé depuis
  l'application. »). Après clic sur « Envoyer par email » (et si la fiche n'est pas déjà
  « envoyée »), un écouteur `focus` (`{ once: true }`) déclenche un `confirm()` au retour
  sur l'app : si accepté, `definirStatut(fiche.id, "envoye")` puis ré-affichage de l'écran
  (le bouton « Marquer comme envoyée » disparaît). Le bouton manuel « Marquer comme
  envoyée » reste disponible pour les cas où l'envoi se fait autrement. Détails complets
  dans la section Phase 8 ci-dessous.
- **Phase 9** : nouveau `js/install.js` (écoute `beforeinstallprompt`/`appinstalled`,
  expose `installationDisponible()` / `lancerInstallation()`). `js/views/home.js` :
  bannière « Installer l'application sur cet appareil ? » (réutilise `.rappel`, nouvelle
  classe `.rappel--install`) affichée quand l'invite est disponible, avec écouteur
  `qse:installation-disponible` (`{ once: true }`) pour réafficher l'accueil si l'invite
  arrive après le premier rendu. `js/views/consultation.js` : si `navigator.onLine` est
  faux, le bouton « Envoyer par email » est visuellement désactivé (`.btn--desactive`,
  `aria-disabled="true"`) et un message « Fonction email indisponible hors connexion. »
  s'affiche ; le clic est ignoré tant que hors-ligne. Indicateur réseau (`#reseau`,
  Phase 1) et compteur de fiches non envoyées (`home.js`, Phase 3) déjà en place — pas de
  changement nécessaire. CSS : `.rappel--install`, `.btn--desactive`. Cache du service
  worker passé à `v9` (+ `js/install.js`) ; les 21 ressources de `RESSOURCES` (dont
  `vendor/jspdf.umd.min.js`) sont bien toutes dans le cache `qse-biollay-v9` (vérifié via
  `caches.open(...).keys()`). Détails complets dans la section Phase 9 ci-dessous.
- **Phase 10** : aucun fichier de code modifié. Suite `tests/test.html` (créée Phase 5,
  17 cas) rejouée : 17/17 OK. Validation manuelle de bout en bout en preview sur la fiche
  « Cohésion » (saisie, calculs en direct, signature tactile, enregistrement brouillon,
  génération PDF) : tout fonctionne. La validation sur iPhone/Android physiques reste un
  test manuel pour l'utilisateur (non réalisable dans cet environnement). Détails complets
  dans la section Phase 10 ci-dessous.
- **Refonte graphique (sur demande de l'utilisateur, après Phase 10)** : remplacement de
  la palette bleue par le **rouge Biollay `#E41F18`** (couleur exacte extraite de
  `Biollay-HR.png`/`icons/logo-biollay.png`, point échantillonné à la souris via
  `System.Drawing` en PowerShell). `css/style.css` : variables `--bleu`/`--bleu-clair`
  renommées `--marque: #E41F18` / `--marque-clair: #ff5248`, toutes les références mises
  à jour (titres, boutons, onglets actifs, cartes d'accueil, en-têtes de tableau, zones
  de signature). Barre du haut (`.topbar`) repensée : fond **blanc** + bordure basse
  rouge, le **logo Biollay est affiché tel quel** (filtre `brightness(0) invert(1)`
  supprimé — l'ancien fond bleu le rendait blanc). `.badge--complet` recoloré en ambre
  (`#ffe9cc`/`#9a4d00`) pour éviter un bleu résiduel. `icons/icon.svg` : fond et accent
  bleus → rouge `#E41F18`, gris bleuté → gris neutre. `manifest.webmanifest` :
  `theme_color` → `#E41F18`, `background_color` → `#ffffff`. `index.html` :
  `<meta name="theme-color">` → `#E41F18`. `js/pdf.js` : bandeaux d'en-tête/section du
  PDF (`BLEU` renommé `MARQUE`) passés en rouge `[228, 31, 24]`. `js/signature.js` :
  couleur du tracé de signature passée de l'ancien bleu à un gris-anthracite neutre
  (`#1c2530`, = `--texte`) — l'encre de signature n'a pas besoin d'être de la couleur de
  marque. Cache du service worker passé à `v10` (mêmes 21 ressources, contenu modifié) ;
  vérifié en preview (double rechargement) : `caches.keys()` → `["qse-biollay-v10"]`,
  topbar blanche avec logo non filtré (1240×472, `filter: none`) et bordure rouge,
  titres/boutons/onglets actifs en `rgb(228, 31, 24)`.

**Notes d'implémentation à connaître :**
- **Pas de Python sur cette machine** (`python -m http.server` ne fonctionne pas — stub
  Windows Store). Un petit serveur statique Node a été créé : `application-qse-pwa/_devserver.cjs`
  (sert le dossier sur le port 8000). Un `.claude/launch.json` (à la racine du projet, pas
  dans `application-qse-pwa/`) le référence sous le nom `qse-pwa` pour l'outil de preview.
- **Logo Biollay** : le fichier fourni par l'utilisateur (`Biollay-HR.png`, logo rouge
  "BIOLLAY Travaux Spéciaux") a été copié dans `icons/logo-biollay.png` et est utilisé dans
  la barre supérieure (`index.html`), affiché **tel quel** (rouge sur fond blanc, sans
  filtre — depuis la refonte graphique ci-dessus). Couleur exacte `#E41F18` reprise comme
  couleur de marque (`--marque`) dans toute l'app et dans le bandeau du PDF.
- **Cache du service worker** : **nouveau schéma de versionnage `v2.x`** depuis l'ajout de la
  couche serveur central (voir `PLAN_PWA_Serveur_Central.md`). L'app hors-ligne seule était
  allée jusqu'à `v15` sous l'ancien schéma incrémental (`v1`…`v15`, les notes de phases
  ci-dessous reflètent cet historique) ; la **baseline est désormais `v2.0`**. **Incrémenter
  `CACHE_VERSION` dans `service-worker.js` (`v2.1`, `v2.2`, …) et ajouter le(s) nouveau(x)
  fichier(s) à `RESSOURCES` à chaque modification** de fichiers JS/CSS — sinon l'ancienne
  version reste servie depuis le cache (piège connu, §11).
- **Git** : dépôt initialisé **dans `application-qse-pwa/`** (pas à la racine du projet
  parent, qui n'est pas un dépôt git). Remote `origin` =
  `https://github.com/wyrdaSC/qse-biollay-pwa.git`. Identité locale configurée :
  `Sylvain Collet <sylvain.collet@proton.me>`. 3 commits locaux à ce jour (un par
  phase/groupe de phases) ; **pas encore pushés** sauf action explicite de l'utilisateur —
  demander confirmation avant tout `git push`.
- **Vérification en preview** : `preview_screenshot` a été instable (timeouts répétés)
  pendant cette session — utiliser `preview_eval` (inspection du DOM, valeurs, longueurs
  de listes, etc.) comme méthode de vérification principale, ça fonctionne de façon fiable.
  Penser à recharger deux fois après un changement de `CACHE_VERSION` (le nouveau SW doit
  s'activer avant que le rechargement suivant serve les nouveaux fichiers).
- **Correction UX formulaire Réception (après Phase 11)** : la colonne « Si non, solution »
  affichait un bouton oui/non + un champ texte qui se superposaient (col trop étroite, mention
  « Oui » omniprésente). Correction appliquée : suppression complète de la colonne « Conforme »
  et des boutons radio ; le tableau passe à 2 colonnes (Critère / Si non, solutions).
  La conformité est **inférée** de la présence de texte dans le champ solution :
  texte vide → critère « oui » (OK), texte renseigné → critère « non » (échec) — logique
  portée dans `recalculerReception()` et `recupererDonneesReception()` dans `form.js`.
  Chaque ligne affiche un bouton `+ Solution` (dashed, couleur marque) ; le clic masque le
  bouton et affiche le champ `<input>`. Si une solution est déjà enregistrée, le champ est
  affiché directement (pas de bouton). CSS : `.critere-solution` (55 % de largeur, min 180 px),
  `.tableau-reception` (min 360 px), `.btn-solution-toggle`. Cache `v11` → `v12`.
- Après chaque test manuel impliquant IndexedDB, la base `QSEDatabase` a été nettoyée
  (`indexedDB.deleteDatabase("QSEDatabase")`) pour repartir propre — vérifier qu'elle est
  vide (ou contient uniquement de vraies données) avant de continuer.

---

## 1. Périmètre (version 1) — identique au plan d'origine

Quatre fiches de contrôle :

1. **Réception du support** (SIA 252)
2. **Cohésion superficielle du support** (essai d'arrachement)
3. **Adhérence sur le support** (essai d'arrachement)
4. **Conditions d'ambiance et d'environnement**

Champs communs à toutes les fiches : N° fiche · Chantier · Localisation · Date · Contrôleur ·
Nature du support · Nature du revêtement · Type de préparation · 2 signatures.

---

## 2. Choix techniques (à appliquer)

| Composant | Technologie | Détail |
|---|---|---|
| Type d'app | PWA installable | `manifest.webmanifest` + service worker, « Ajouter à l'écran d'accueil » |
| Langage | HTML + CSS + JavaScript ES2015+ « vanilla » | Aucune transpilation, aucun bundler |
| Architecture | SPA à routage par hash (`#/...`) | Un seul `index.html`, rendu des écrans en JS |
| Stockage local | **IndexedDB** (API native, wrapper maison) | Tables `fiches`, `chantiers`, `utilisateurs` |
| Hors-ligne | **Service Worker** stratégie *cache-first* | Toutes les ressources mises en cache au 1er chargement |
| Génération PDF | **jsPDF** (vendé localement) | `vendor/jspdf.umd.min.js`, voir Phase 5 |
| Signature | Canvas tactile maison | Porté de `signature.js` existant, export PNG base64 |
| Email | `mailto:` | Sujet/corps pré-remplis, PDF joint manuellement |
| Déploiement | Hébergement statique (GitHub Pages — cf. §0bis Phase 11) | `git push` republie, aucune commande de build |
| Langue | Français | Interface et PDF |
| Palette | Rouge Biollay `#E41F18`, blanc, gris clair (cf. §0bis) | Couleur reprise du logo `icons/logo-biollay.png` |

**Vendre jsPDF (obligatoire pour l'offline) :**
```
# depuis la racine du projet
mkdir vendor
# télécharger une fois la version UMD minifiée :
#   https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js
#   -> enregistrer dans vendor/jspdf.umd.min.js
```
> jsPDF expose `window.jspdf.jsPDF`. Le cœur suffit (texte, `rect`, `line`, `addImage` pour
> les PNG de signature). **Ne pas** dépendre du plugin autotable : dessiner les tableaux
> à la main (lignes + texte), comme le fait `pdf_generator.py`.

---

## 3. Structure des fichiers (aucun build)

```
application-qse-pwa/
├── index.html                  # Shell unique : <head>, conteneur d'écran, chargement des JS
├── manifest.webmanifest        # Métadonnées PWA (nom, icône, standalone, portrait)
├── service-worker.js           # Cache-first de toutes les ressources (offline)
├── README.md                   # Lancement, déploiement, organisation (à rédiger)
├── css/
│   └── style.css               # Style mobile-first, palette Biollay
├── js/
│   ├── app.js                  # Démarrage : enregistre le SW, lance le routeur
│   ├── router.js               # Routage par hash (#/...) -> rend l'écran voulu
│   ├── db.js                   # Wrapper IndexedDB (promesses) : CRUD fiches/chantiers/utilisateurs
│   ├── forms-def.js            # Définition des 4 types (champs, critères, ruptures, bornes)
│   ├── util.js                 # Fonctions utilitaires partagées (echapperHtml) — ajouté Phase 3
│   ├── install.js              # Invite d'installation (beforeinstallprompt) — ajouté Phase 9
│   ├── calculations.js         # xi, xm, écart-type, xm-s, conformité (port de calculations.py)
│   ├── signature.js            # Pad de signature tactile (canvas)
│   ├── pdf.js                  # Génération PDF via jsPDF (port de pdf_generator.py)
│   └── views/                  # Rendu de chaque écran (fonctions qui renvoient du HTML + branchent les events)
│       ├── home.js             #   accueil : 4 boutons, fiches récentes, compteur non envoyées
│       ├── form.js             #   formulaire générique pilote par forms-def.js
│       ├── consultation.js     #   fiche enregistrée : PDF / email / statut
│       ├── historique.js       #   liste filtrable
│       └── parametres.js       #   chantiers + participants
├── vendor/
│   └── jspdf.umd.min.js        # jsPDF vendé (offline)
├── icons/
│   ├── icon.svg                # Icône de l'app (réutiliser celle du prototype Flask)
│   └── logo-biollay.png        # Logo Biollay (fourni par l'utilisateur), utilisé dans la topbar et le PDF
├── _devserver.cjs              # Serveur statique Node pour le dev local (python indisponible)
└── .gitignore
```

> Garder les modules petits et **commentés en français**. Utiliser des modules ES
> (`<script type="module">`) ou de simples scripts globaux — au choix, mais rester
> cohérent. Recommandé : modules ES (`import`/`export`), supportés nativement par les
> navigateurs sans build.

---

## 4. Modèle de données (IndexedDB)

Base `QSEDatabase`, version 1. Trois magasins d'objets (object stores) :

```js
// store 'fiches' : keyPath 'id', autoIncrement true
{
  id,                       // auto
  type,                     // 'reception' | 'cohesion' | 'adherence' | 'ambiance'
  numero, chantier, localisation, date, controleur,
  nature_support, nature_revetement, type_preparation,
  data,                     // objet : contenu spécifique au formulaire (voir §6)
  signature_applicateur,    // data URL PNG base64 (ou '')
  signature_controleur,     // data URL PNG base64 (ou '')
  statut,                   // 'brouillon' | 'complet' | 'envoye'
  conforme,                 // true | false | null
  created_at, updated_at    // ISO string
}
// store 'chantiers' : keyPath 'id', autoIncrement -> { id, nom }
// store 'utilisateurs' : keyPath 'id', autoIncrement -> { id, nom, role }
```

`db.js` expose des fonctions à base de promesses : `ouvrir()`, `creerFiche(f)`,
`majFiche(id,f)`, `getFiche(id)`, `listerFiches({type,chantier})`, `supprimerFiche(id)`,
`definirStatut(id,statut)`, `compterNonEnvoyees()`, `listerChantiers()`,
`ajouterChantier(nom)` (ignorer si doublon), `supprimerChantier(id)`, idem utilisateurs.

---

## 5. Calculs et règles de conformité (RÉFÉRENCE EXACTE — porter à l'identique)

> Source de vérité : `application-qse/app/calculations.py`. Reproduire en JS et **couvrir
> par des tests** (Phase 10). Accepter la virgule décimale française en saisie.

**Contrainte d'arrachement** : `xi = Fi / Si` avec Fi en newtons (N), Si en mm² → résultat
en N/mm² = **MPa**. Si `Si <= 0` ou valeur manquante → `xi = null`.

**Essai (cohésion / adhérence)** — pour une liste de mesures `{rupture, si, fi}` et un
ensemble de types de rupture « à garder » :
- `xi` calculé pour chaque ligne ; une ligne est **gardée** si `rupture ∈ àGarder` et `xi != null`.
- `xm` = **moyenne** des `xi` gardés.
- `s` = **écart-type d'échantillon (n−1)** des `xi` gardés ; `s = 0` si moins de 2 mesures gardées.
- `xm_s = xm − s`.
- **Conforme** si : au moins 1 mesure gardée **ET** `xm > 1.5` **ET** `xm_s >= 1.0`.
- Si 0 mesure gardée → conformité = `null` (non évalué).

Ensembles « à garder » :
- **Cohésion** : garder `{A}` ; éliminer `A-Y`, `Y`, `Y-Z`. (Options de rupture : `A, A-Y, Y, Y-Z`.)
- **Adhérence** : garder `{A, A-B, B}` ; éliminer `B-Y`, `Y`, `Y-Z`. (Options : `A, A-B, B, B-Y, Y, Y-Z`.)

Seuils communs : `SEUIL_XM = 1.5` MPa, `SEUIL_XM_S = 1.0` MPa.

**Réception du support** — conforme si **tous** les critères sont à `oui` **ET** la remontée
d'humidité **n'est pas** `oui` (donc « non » = bon).

**Conditions d'ambiance — par ligne** : conforme si toutes les bornes numériques sont
respectées **ET** `T°C support >= T°C point de rosée + 3`. Si aucune valeur numérique n'est
saisie sur la ligne → `null` (ligne vide, ignorée). Bornes :

| Colonne (clé) | Borne min | Borne max |
|---|---|---|
| `hs` (Hs %) | — | 4 |
| `hr` (Hr %) | — | 75 |
| `t_air` (T°C air) | 10 | 30 |
| `t_support` (T°C support) | 10 | 30 |
| `t_produit` (T°C produit) | 10 | 30 |

(`t_rosee` n'a pas de borne propre mais sert à la règle support ≥ rosée + 3.)

**Conditions d'ambiance — global** : conforme si **toutes** les lignes non vides sont
conformes ; `null` si aucune ligne renseignée.

---

## 6. Spécification des 4 formulaires (réutilisée du plan d'origine)

Chaque formulaire = **en-tête commun** (les 8 champs du §1) + corps spécifique ci-dessous +
**2 zones de signature** (nom, date, canvas tactile) + boutons **« Enregistrer brouillon »**
et **« Générer PDF »**. Le contenu spécifique est stocké dans `fiche.data`.

### 6.1 Réception du support (SIA 252)
- Champ **« Remontée d'humidité »** : Oui / Non (défaut Non).
- Liste de **critères**, chacun avec **Oui/Non** + champ texte **« Si non, solutions »** :
  `Propre` · `Compact` · `Résistant aux chocs` · `Non fissuré` · `Exempt de laitance` ·
  `Sec en surface` · `Teneur en eau (méthode CM)` ·
  `Résistance arrachement ≥ 1.5 MPa (xm, xm-s ≥ 1.0 N/mm²)` · `Rugosité`.
- Signatures : **Contrôleur applicateur** + **Contrôleur extérieur**.
- `data` = `{ remontee_humidite, criteres:{<critère>:'oui'|'non'}, solutions:{<critère>:texte},
  nom_applicateur, date_applicateur, nom_controleur, date_controleur }`.

### 6.2 Cohésion superficielle du support
- **Tableau de 14 mesures** (lignes par défaut) : `N°`, `Type de rupture` (`A`/`A-Y`/`Y`/`Y-Z`),
  `Si` (mm²), `Fi` (N). Bouton « Ajouter une mesure ».
- **Calculs en temps réel** : `xi`, gardé/éliminé par ligne, puis `xm`, `s`, `xm-s` et **badge
  conformité** (vert/rouge) selon §5.
- **Légende** affichée : « A = garder ; A-Y, Y, Y-Z = éliminer ».
- 2 signatures (applicateur / extérieur).
- `data` = `{ mesures:[{rupture,si,fi}, ...], nom_applicateur, date_applicateur,
  nom_controleur, date_controleur }`.

### 6.3 Adhérence sur le support
- Identique à 6.2 **mais** types de rupture `A`/`A-B`/`B` (garder), `B-Y`/`Y`/`Y-Z` (éliminer).
- **Légende** : « A, A-B, B = garder ; B-Y, Y, Y-Z = éliminer ».
- Mêmes calculs, mêmes seuils, mêmes signatures, même structure `data`.

### 6.4 Conditions d'ambiance et d'environnement
- **Tableau de mesures répétables** (bouton « Ajouter une mesure », suppression par ligne)
  avec colonnes : `Date`, `Heure`, `Produit`, `N° lot`, `Hs %` (≤ 4), `Hr %` (≤ 75),
  `T°C air` (10–30), `T°C point de rosée`, `T°C support` (10–30 ET ≥ rosée+3), `T°C produit` (10–30).
- **Badge Conforme / Non conforme automatique par ligne** (voir §5).
- 2 zones de signature (Nom, Date, visa tactile).
- `data` = `{ mesures:[{date,heure,produit,lot,hs,hr,t_air,t_rosee,t_support,t_produit}, ...],
  nom_applicateur, date_applicateur, nom_controleur, date_controleur }`.

---

## 7. Mise en page du PDF (réutilisée du plan d'origine — porter depuis `pdf_generator.py`)

Générer **côté navigateur avec jsPDF**, format A4 portrait, en dessinant à la main. Structure
commune à chaque fiche :

1. **Bandeau d'en-tête** (rectangle bleu `#1A3557`) : logo texte **« BIOLLAY »** +
   sous-titre « Travaux Spéciaux SA » à gauche ; **titre de la fiche en MAJUSCULES** et
   **N° de fiche** à droite.
2. **Bloc général** : tableau clé/valeur des 8 champs communs.
3. **Corps spécifique** :
   - Réception → tableau `Critère | Oui/Non | Si non, solutions` + ligne « Remontée d'humidité ».
   - Cohésion/Adhérence → tableau `N° | Type rupture | Si | Fi | xi | Gardé`, puis légende,
     puis bloc résultats (`n` gardées, `xm`, `s`, `xm-s` avec rappel des seuils).
   - Ambiance → tableau des relevés (toutes les colonnes) + colonne « Conf. » (OK/NOK/—) par ligne.
4. **Badge résultat** : bandeau **CONFORME** (vert) / **NON CONFORME** (rouge) / **NON ÉVALUÉ** (gris).
5. **Signatures** : 2 colonnes (libellé, image PNG de la signature via `addImage`, Nom, Date).

**Nom du fichier** : `[TYPE]-[CHANTIER]-[DATE].pdf` (assaini : caractères non alphanumériques → `_`).

> ⚠️ Polices jsPDF (Helvetica) = jeu WinAnsi/Latin-1. Les accents français passent, mais
> remplacer les caractères hors Latin-1 avant écriture : `≥`→`>=`, `≤`→`<=`, `—`/`–`→`-`,
> `·`→`-`, etc. (même logique que la fonction `_lat()` de `pdf_generator.py`).

---

## 8. Phases de construction (prompts à exécuter dans l'ordre)

> Chaque phase ≈ une étape de travail. Vérifier le critère de fin avant de passer à la suivante.

### Phase 0 — Initialisation (aucun outil lourd) ✅ FAIT
Aucun Node, aucun npm. Créer le dossier `application-qse-pwa/` et la structure du §3.
Pour développer en local, servir le dossier en HTTP (les service workers ne fonctionnent pas
en `file://`) :
```
cd application-qse-pwa
python -m http.server 8000      # puis ouvrir http://localhost:8000
```
Vendre jsPDF dans `vendor/` (voir §2). Réutiliser l'icône SVG du prototype Flask
(`application-qse/app/static/icons/icon.svg`) dans `icons/`.

> ✅ Fait, avec une déviation : `python` est indisponible sur cette machine, donc le serveur
> de dev local est `_devserver.cjs` (Node, sans dépendance), lancé via `.claude/launch.json`
> (config "qse-pwa"). Voir §0bis pour les détails.

### Phase 1 — Shell, manifest, service worker ✅ FAIT
```
Crée index.html : <head> avec meta viewport (mobile, user-scalable=no), theme-color #1A3557,
lien manifest, lien CSS ; <body> avec une barre supérieure (titre « BIOLLAY QSE » + indicateur
réseau), un conteneur #ecran, une barre de navigation inférieure 3 onglets (Accueil / Historique
/ Paramètres), et le chargement des scripts JS (modules ES).
Crée manifest.webmanifest : name « QSE Biollay », display standalone, orientation portrait,
background_color et theme_color #1A3557, icône icons/icon.svg.
Crée service-worker.js : stratégie cache-first ; à l'install, mettre en cache index.html, le
CSS, tous les JS de js/ et js/views/, vendor/jspdf.umd.min.js, le manifest et l'icône ; au
fetch, répondre depuis le cache puis réseau en repli. Versionner le nom du cache.
Crée js/app.js : enregistre le service worker, met à jour l'indicateur réseau (online/offline),
lance le routeur.
Vérification : la page s'affiche, l'app s'installe (« Ajouter à l'écran d'accueil »), et
fonctionne après passage en mode avion (recharger hors-ligne).
```

> ✅ Fait. Logo Biollay intégré dans la topbar (`icons/logo-biollay.png`, passé en blanc via
> `filter: brightness(0) invert(1)`). Voir §0bis.

### Phase 2 — Stockage IndexedDB ✅ FAIT
```
Crée js/db.js : wrapper IndexedDB à base de promesses pour la base QSEDatabase (§4), avec les
stores fiches/chantiers/utilisateurs et toutes les fonctions CRUD listées au §4.
Vérification : depuis la console, créer/lire/lister/supprimer une fiche fonctionne et persiste
après rechargement.
```

> ✅ Fait et vérifié en direct dans le navigateur (CRUD complet, données de test nettoyées
> ensuite). Dépôt git créé pour `application-qse-pwa/` à cette étape — voir §0bis.

### Phase 3 — Routeur et écrans de base ✅ FAIT
```
Crée js/router.js : routage par hash. Routes :
  #/                         -> écran d'accueil
  #/fiche/nouvelle/:type     -> nouveau formulaire du type
  #/fiche/:id                -> consultation (ou édition si brouillon)
  #/historique               -> liste filtrable
  #/parametres               -> chantiers + participants
Le routeur appelle la fonction de rendu du module js/views correspondant et l'injecte dans #ecran.
Crée js/views/home.js : 4 boutons (un par type), liste des fiches récentes, compteur de fiches
non envoyées.
Vérification : la navigation entre écrans fonctionne, y compris via les boutons et la barre du bas.
```

> ✅ Fait. `/historique`, `/parametres` et `/fiche/:id` sont des écrans provisoires
> (« en cours de construction ») en attendant les phases suivantes.

### Phase 4 — forms-def.js + formulaire générique ✅ FAIT
```
Crée js/forms-def.js : exporte FORM_TYPES (label, sous-titre, par type), la liste des champs
communs, RECEPTION_CRITERES, les options de rupture cohésion/adhérence et les ensembles à garder,
les colonnes + bornes d'ambiance, les seuils. (Porter depuis forms_def.py.)
Crée js/views/form.js : rend dynamiquement le formulaire d'un type donné à partir de forms-def.js
(en-tête commun + corps spécifique selon §6 + 2 zones de signature + boutons brouillon/PDF).
Auto-complétion des chantiers et contrôleurs depuis IndexedDB.
Vérification : les 4 formulaires s'affichent et se remplissent.
```

> ✅ Fait. Les 4 types se rendent et se remplissent (vérifié en direct, ajout/suppression de
> lignes de mesures, options de rupture, légendes, saisie décimale avec virgule). Les boutons
> « Enregistrer brouillon » / « Générer PDF » existent dans le DOM mais n'ont **pas encore**
> de gestionnaire d'évènement (prévu Phase 6). Module `js/util.js` ajouté (non prévu dans le
> plan initial) pour `echapperHtml`.

### Phase 5 — Calculs, signatures, conformité en direct ✅ FAIT
```
Crée js/calculations.js : porte exactement calculations.py (§5), avec tests de parité.
Crée js/signature.js : pad de signature tactile sur canvas (porter signature.js existant),
export PNG base64, bouton Effacer, rechargement d'une signature existante.
Branche le recalcul en temps réel dans form.js : xi/gardé par ligne, xm/s/xm-s, badge
conformité (essais) ; badge par ligne (ambiance) ; conformité réception.
Vérification : saisir des mesures met à jour les résultats et le badge instantanément.
```

> ✅ Fait et vérifié en preview (mobile 375×812 — voir piège ci-dessous) : les 4 formulaires
> recalculent en direct (cohésion/adhérence : xi/gardé/xm/s/xm-s/badge ; ambiance : badge
> OK/NOK par ligne ; réception : badge conforme/non conforme). Pad de signature tactile
> fonctionnel (dessin, effacement, rechargement d'une signature existante via
> `data-initial`). 17/17 tests de parité OK dans `tests/test.html`.
>
> ⚠️ Piège rencontré : en viewport très étroit (`window.innerWidth` ~1px dans le
> préview par défaut), le canvas de signature se redimensionne à ~2px et le pad ne
> dessine rien d'utile. Toujours tester avec `preview_resize` (preset `mobile` ou plus
> large) avant de juger le pad de signature non fonctionnel.

### Phase 6 — Enregistrement et génération PDF ✅ FAIT
```
Dans form.js : « Enregistrer brouillon » -> statut 'brouillon' ; « Générer PDF » -> calcule
conforme via calculations.js, enregistre statut 'complet' dans IndexedDB, puis redirige vers
la consultation.
Crée js/pdf.js : génère le PDF avec jsPDF selon §7 (porter pdf_generator.py), renvoie un Blob.
Crée js/views/consultation.js : résumé de la fiche + badge ; boutons « Télécharger le PDF »
(lien download du Blob), « Envoyer par email » (mailto, §9), champ email destinataire,
« Marquer comme envoyée » (statut 'envoye'), « Modifier », « Supprimer ».
Vérification : le PDF se télécharge, s'ouvre correctement, contient signatures et badge.
```

> ✅ Fait et vérifié en preview (mobile 375×812). `index.html` charge désormais
> `vendor/jspdf.umd.min.js` en `<script>` classique (avant le module `app.js`) pour exposer
> `window.jspdf.jsPDF`. `js/pdf.js` porte `pdf_generator.py` à la main avec jsPDF (pas de
> plugin autotable) : en-tête bleu + titre + N° fiche, pied de page, `bloc_general` (tableau
> 2 colonnes des CHAMPS_COMMUNS), corps par type (réception : critères + remontée
> d'humidité ; cohésion/adhérence : tableau de mesures + légende + résultats xm/s/xm-s ;
> ambiance : tableau des relevés avec colonne Conf. OK/NOK colorée), badge résultat
> CONFORME/NON CONFORME/NON ÉVALUÉ, zones de signatures (image PNG + nom + date), saut de
> page automatique (`assurerEspace`) si le contenu dépasse la page, sanitisation Latin-1
> (`lat()` : ≥/≤/tirets longs/œ/apostrophe typographique/espace insécable/point médian).
> `nomFichier(fiche)` génère `type_chantier_date.pdf` (caractères non alphanumériques ->
> `_`).
>
> `js/views/form.js` : boutons « Enregistrer brouillon » / « Générer PDF » branchés
> (fonctions `recupererEntete` (par `id`, pour éviter toute ambiguïté avec les `data-champ`
> du tableau ambiance qui réutilisent la clé `date`), `recupererDonnees`,
> `calculerConformite`, `recupererSignature`, `enregistrerFiche`). « Générer PDF » calcule
> `conforme`, enregistre `statut: 'complet'`, génère **et télécharge immédiatement** le PDF,
> puis redirige vers `#/fiche/:id`. `ajouterChantier(entete.chantier)` appelé à
> l'enregistrement (dédoublonnage déjà géré par `db.js`). `ajouterUtilisateur` **non**
> appelé ici (pas de dédoublonnage côté `db.js` — risquerait de dupliquer la liste à chaque
> enregistrement ; à traiter en Phase 7/8 si besoin).
>
> `js/views/consultation.js` (nouveau) : résumé (N°, chantier, localisation, date,
> contrôleur, badge statut, badge conformité), « Télécharger le PDF »
> (`telechargerBlob`, nouvelle fonction dans `js/util.js`), « Envoyer par email » (mailto
> §9, champ destinataire optionnel), « Marquer comme envoyée » (masqué si déjà envoyée),
> « Modifier » (lien vers `#/fiche/:id/modifier`), « Supprimer » (confirm + retour accueil).
>
> `js/router.js` : route `#/fiche/:id` -> `rendreConsultation(Number(id))` ; nouvelle route
> `#/fiche/:id/modifier` -> charge la fiche via `getFiche` et appelle
> `rendreFormulaire(fiche.type, fiche)`.
>
> Cache du service worker passé à `v6` (+ `js/pdf.js`, `js/views/consultation.js`).
>
> ⚠️ Piège preview : `preview_click` ne déclenche pas toujours le clic sur les boutons en
> bas d'un long formulaire (probablement hors viewport, pas de scroll automatique) — utiliser
> `document.getElementById(...).click()` via `preview_eval` à la place. `preview_screenshot`
> est resté instable (timeouts) comme en Phase 5 ; vérification faite via `preview_eval` /
> `preview_snapshot`.
>
> Vérifié pour les 4 types de fiches : enregistrement brouillon, génération PDF (taille
> ~13 Ko, `application/pdf`), badge conformité (CONFORME/NON CONFORME), changement de
> statut vers « Envoyée », édition (`#/fiche/:id/modifier` recharge bien les valeurs),
> suppression (retour accueil, fiche disparue de la liste). Mailto testé (ne casse pas la
> page).

### Phase 7 — Historique et paramètres ✅ FAIT
```
Crée js/views/historique.js : liste des fiches, filtres par type et par chantier, badge de statut.
Crée js/views/parametres.js : gestion des chantiers (ajout/suppression) et des participants
(nom + rôle). Les chantiers saisis dans les fiches s'ajoutent automatiquement.
Vérification : filtres et CRUD fonctionnent et persistent.
```

> `js/views/historique.js` : `rendreHistorique()` réinitialise les filtres (type/chantier)
> à chaque entrée sur l'écran, affiche deux `<select>` (« Tous les types » + `FORM_TYPES`,
> « Tous les chantiers » + `listerChantiers()`), et une liste `.liste-fiches` (même motif
> que `home.js` : titre via `libelleType`, méta `chantier · date` + `Conforme`/`Non
> conforme` si `conforme` n'est pas `null`, badge `STATUT_LABELS`). Chaque changement de
> filtre appelle `listerFiches({ type, chantier })` et ré-affiche uniquement la liste
> (`#liste-historique`), sans recharger toute la vue. Message `.vide` si aucune fiche ne
> correspond.
>
> `js/views/parametres.js` : `rendreParametres()` affiche deux boutons d'onglet
> (« Chantiers » / « Participants », état `ongletActif` réinitialisé à `chantiers` à
> chaque entrée sur l'écran) et la section correspondante. Section Chantiers : formulaire
> d'ajout (`ajouterChantier`) + `.liste-param` avec bouton `.bouton-icone` (✕) +
> `confirm()` -> `supprimerChantier`. Section Participants : formulaire nom + rôle
> (`ajouterUtilisateur`) + même motif de liste -> `supprimerUtilisateur`. Tout repasse par
> une fonction `rafraichir()` commune qui recharge les deux listes depuis `db.js` et
> rebranche les événements.
>
> `js/db.js` : `ajouterUtilisateur(nom, role)` corrigé pour ignorer les doublons (même
> `nom`), sur le modèle de `ajouterChantier` — sans ce correctif, ajouter un participant
> plusieurs fois depuis l'écran paramètres aurait créé des doublons (le code précédent
> n'avait pas ce garde-fou car la fonction n'était pas encore appelée depuis l'UI).
>
> `js/router.js` : routes `#/historique` -> `rendreHistorique()` et `#/parametres` ->
> `rendreParametres()` (remplacement des `rendreProvisoire(...)`), nouveaux imports
> `rendreHistorique` / `rendreParametres`.
>
> CSS (`css/style.css`) : `.filtres`/`.champ-filtre` (ligne de `<select>` pour
> l'historique), `.onglets-param`/`.onglet-param` (boutons d'onglet, état `.actif`),
> `.ligne-ajout` (formulaire d'ajout en ligne), `.liste-param` (liste avec bouton de
> suppression aligné à droite, réutilise `.bouton-icone` déjà existant).
>
> Cache du service worker passé à `v7` (+ `js/views/historique.js`,
> `js/views/parametres.js`).
>
> Vérifié en preview (mobile 375×812) : écran historique avec liste vide puis avec deux
> fiches de types/chantiers/statuts différents — filtre par type et filtre par chantier
> fonctionnent tous les deux et se réinitialisent en changeant d'écran ; le filtre
> chantier ne propose que les chantiers présents dans le magasin `chantiers` (ajoutés via
> `ajouterChantier`, donc uniquement ceux passés par `form.js` ou par l'écran paramètres —
> pas les valeurs `chantier` saisies directement en base sans passer par
> `ajouterChantier`, ce qui est le comportement attendu). Écran paramètres : ajout d'un
> chantier et d'un participant (avec rôle), persistance après rechargement, bascule entre
> les deux onglets, suppression testée via la fonction (CRUD `db.js` déjà couvert en
> Phase 2). Données de test nettoyées après vérification.

### Phase 8 — Email (Option B, mailto:) ✅ FAIT
```
Bouton « Envoyer par email » : ouvre le client mail via mailto: avec
  sujet : « [QSE] [Type] — [Chantier] — [Date] »
  corps : message standard rappelant de JOINDRE le PDF préalablement téléchargé.
Si un email destinataire est saisi, l'insérer dans le mailto. Après envoi, proposer de marquer
la fiche « envoyée » (mise à jour du statut dans IndexedDB).
```

> Le bouton « Envoyer par email » et le champ destinataire optionnel existaient déjà
> depuis la Phase 6. Cette phase a aligné le corps du message sur le gabarit exact du §9
> (« en date du [date] » + « IMPORTANT : pensez à joindre le fichier PDF préalablement
> téléchargé depuis l'application. ») et ajouté la proposition de marquage « envoyée »
> après l'envoi : un écouteur `window.addEventListener("focus", ..., { once: true })` posé
> juste après `window.location.href = "mailto:..."` détecte le retour sur l'app (l'OS
> rebascule le focus quand l'utilisateur revient du client mail) et propose via
> `confirm()` de passer la fiche au statut `envoye`. N'est posé que si la fiche n'est pas
> déjà « envoyée ». Le bouton « Marquer comme envoyée » manuel (Phase 6) reste présent —
> pour les cas où l'envoi se fait par un autre moyen.
>
> Cache du service worker passé à `v8` (aucun nouveau fichier, juste invalidation du cache
> pour `js/views/consultation.js` modifié).
>
> Vérifié en preview (mobile 375×812) : création d'une fiche « complet » non envoyée,
> clic sur « Envoyer par email » (`window.location.href` correctement construit avec
> sujet/corps encodés conformes au §9), `dispatchEvent(new Event("focus"))` simulant le
> retour sur l'app -> `confirm()` affiché avec le bon message -> acceptation -> statut
> passé à `envoye` et bouton « Marquer comme envoyée » disparu après ré-affichage. Cas
> fiche déjà « envoyée » : aucun `confirm()` déclenché (écouteur non posé). Données de
> test nettoyées après vérification.

### Phase 9 — Finalisation PWA / hors-ligne ✅ FAIT
```
Vérifie que TOUTES les ressources (y compris vendor/jspdf.umd.min.js) sont en cache.
Indicateur réseau dans la barre. Hors-ligne : saisie, sauvegarde, calculs et génération PDF
fonctionnent ; bouton email peut être désactivé hors-ligne avec un message.
Écran d'accueil : afficher le nombre de fiches non envoyées. Proposer l'installation
(« Ajouter à l'écran d'accueil ») via l'événement beforeinstallprompt (Android).
```

> Indicateur réseau (`#reseau`, `.online`/`.offline`) et compteur de fiches non envoyées
> (bannière `.rappel` sur l'accueil) existaient déjà depuis les Phases 1 et 3 — rien à
> ajouter.
>
> Nouveau `js/install.js` : écoute `beforeinstallprompt` (annule l'invite native via
> `preventDefault()`, conserve l'événement) et `appinstalled` ; expose
> `installationDisponible()` et `lancerInstallation()` (appelle `.prompt()` puis attend
> `.userChoice`). `js/views/home.js` : si une invite est disponible, affiche une bannière
> « Installer l'application sur cet appareil ? » + bouton « Installer » (`.rappel
> .rappel--install`) au-dessus de la grille de boutons ; clic -> `lancerInstallation()`
> puis ré-affichage de l'accueil (la bannière disparaît si l'invite a été consommée). Comme
> `beforeinstallprompt` peut survenir après le premier rendu de l'accueil, un écouteur
> `qse:installation-disponible` (`{ once: true }`, événement custom dispatché par
> `install.js`) redéclenche `rendreAccueil()` si l'utilisateur est toujours sur `#/`. Sans
> objet sur Safari/iOS (API non supportée — la bannière ne s'affiche simplement jamais).
>
> `js/views/consultation.js` : si `navigator.onLine` est faux au moment du rendu, le lien
> « Envoyer par email » reçoit `.btn--desactive` (opacité réduite, `pointer-events: none`)
> + `aria-disabled="true"`, un message « Fonction email indisponible hors connexion. »
> s'affiche sous la légende existante, et le gestionnaire de clic retourne immédiatement
> sans construire de mailto si hors-ligne.
>
> CSS : `.rappel--install` (mise en page flex texte + bouton), `.btn--desactive`.
>
> Cache du service worker passé à `v9` (+ `js/install.js`, nouveau fichier non prévu dans
> la structure §3).
>
> Vérifié en preview (mobile 375×812, double rechargement après le passage à `v9`) :
> `caches.open("qse-biollay-v9").keys()` liste les 21 ressources attendues, y compris
> `vendor/jspdf.umd.min.js`. Bannière d'installation : `dispatchEvent(new
> Event("beforeinstallprompt"))` (avec `prompt`/`userChoice` simulés) déclenche bien
> l'affichage de la bannière sur l'accueil (réaffichage via l'écouteur
> `qse:installation-disponible`), et le clic sur « Installer » la fait disparaître.
> Hors-ligne (`navigator.onLine` redéfini à `false`) : écran de consultation affiche le
> bouton email désactivé + message, le clic ne fait rien (pas de `confirm`, pas de
> changement d'URL) ; en parallèle, création d'une fiche (« Enregistrer brouillon ») et
> génération d'un PDF (12,8 Ko, `application/pdf`) fonctionnent normalement hors-ligne.
> `navigator.onLine` restauré et données de test nettoyées après vérification.

### Phase 10 — Tests et validation ✅ FAIT
```
Crée des tests JS pour calculations.js (mêmes cas que tests/test_calculations.py) :
  xi=Fi/Si, moyenne xm, écart-type s, xm-s, conformité des 4 fiches (conforme/non conforme/limites).
Sans build : un fichier tests/test.html qui charge calculations.js et exécute des assertions en
affichant OK/ÉCHEC dans la page (ou via console.assert).
Validation manuelle : iPhone (Safari) + Android (Chrome) : installer la PWA, remplir une fiche
en mode avion, vérifier sauvegarde, PDF, signature tactile.
```

> `tests/test.html` + `tests/test-calculations.js` existaient déjà depuis la Phase 5 (17
> cas, mêmes scénarios que `test_calculations.py` + 1 cas supplémentaire pour
> `versNombre`). Rechargé en preview : **« 17 / 17 tests réussis »** (tout en vert) — rien
> à modifier côté code pour cette partie.
>
> Validation manuelle de bout en bout effectuée en preview (mobile 375×812), sur la fiche
> « Cohésion superficielle du support » (type non couvert en détail dans les phases
> précédentes) : remplissage de l'en-tête (numéro, chantier, localisation, contrôleur,
> nature du support/revêtement, type de préparation), saisie de 3 mesures avec rupture
> « A » (Si=500, Fi=900/950/850) → calcul en direct correct (xi = 1.80 / 1.90 / 1.70
> N/mm², 3 mesures gardées, xm = 1.80, s = 0.10, xm−s = 1.70, badge **Conforme**, seuils
> respectés). Signature tactile : tracé simulé (`mousedown`/`mousemove`/`mouseup`) sur le
> pad « Applicateur » → canvas non vide (1156 pixels non transparents), confirmant que
> `js/signature.js` capture bien le dessin. « Enregistrer brouillon » → fiche créée
> (`#/fiche/9`), écran de consultation affiche bien les données saisies, statut
> « Brouillon », badge « CONFORME ». « Télécharger le PDF » → blob généré
> (`application/pdf`, 736 Ko), aucune erreur console. Fiche de test et chantier
> « Chantier Test Phase10 » supprimés après vérification (IndexedDB nettoyée).
>
> **Limite de cet environnement** : la validation manuelle sur **iPhone (Safari)** et
> **Android (Chrome)** réels — installation de la PWA (« Ajouter à l'écran d'accueil »),
> remplissage d'une fiche en mode avion, vérification de la sauvegarde/PDF/signature
> tactile sur device — **ne peut pas être effectuée dans cet environnement** (pas
> d'accès à un téléphone physique). C'est un **test manuel restant à faire par
> l'utilisateur** avant la mise en production (Phase 11). Tout ce qui est automatisable
> (suite de tests JS, logique métier, persistance IndexedDB, génération PDF, pads de
> signature, mode hors-ligne déjà vérifié Phase 9) est validé.
>
> Aucun fichier de code modifié pour cette phase (cache `v9` inchangé) — pas de commit
> git nécessaire dans `application-qse-pwa/`.

### Phase 11 — Déploiement (hébergement statique gratuit) ✅ FAIT
```
Crée un README.md (lancement local, déploiement, organisation, comment ajouter une fiche).
Déploiement Netlify : glisser-déposer le dossier application-qse-pwa/ sur app.netlify.com
(ou connecter un dépôt Git). Aucune commande de build (publier le dossier tel quel).
Si routage par hash : aucune config SPA nécessaire. (Si un jour routage par chemin, ajouter une
redirection /* -> /index.html.)
Vérifier que le service worker est servi en HTTPS et que l'app s'installe depuis l'URL publique.
```

> **Ajustement (sur demande de l'utilisateur) : GitHub Pages au lieu de Netlify.** Le
> dépôt `application-qse-pwa/` est déjà connecté à
> `https://github.com/wyrdaSC/qse-biollay-pwa.git` ; pas besoin d'un compte/service
> tiers supplémentaire. GitHub Pages (Settings → Pages → *Deploy from a branch* →
> `main` / `/ (root)`) publie le dépôt tel quel (aucune commande de build), fournit
> HTTPS automatiquement (requis par le service worker / l'installation PWA), et
> fonctionne avec les chemins relatifs (`./...`) déjà utilisés partout malgré le
> sous-dossier `/qse-biollay-pwa/`. Routage par hash → aucune config SPA nécessaire
> (inchangé par rapport au plan d'origine).
>
> `README.md` créé à la racine de `application-qse-pwa/` : sommaire, section
> « Tester sur ordinateur (depuis le dépôt GitHub) » (ouvrir l'URL Pages, ou cloner +
> `node _devserver.cjs`), section déploiement GitHub Pages, section « Installer et
> utiliser sur téléphone / tablette » (Android/Chrome bannière d'installation,
> iOS/Safari « Sur l'écran d'accueil », rappel hors-ligne après premier chargement),
> guide d'utilisation complet de l'app (accueil, remplir une fiche, signature,
> consultation/email/marquage envoyée, historique, paramètres), organisation du projet,
> comment ajouter un nouveau type de fiche (Phase 12), tests, charte graphique + rappel
> sur l'incrémentation de `CACHE_VERSION`. Section « Captures d'écran » avec
> emplacements `docs/screenshots/*.png` à compléter par l'utilisateur : la capture
> automatique (`preview_screenshot`) a échoué (timeout) tout au long de cette session
> — vérification faite via `preview_eval`/DOM comme pour les phases précédentes.
>
> Aucun changement à `service-worker.js`/`RESSOURCES` pour cette phase au-delà de ceux
> déjà faits pour la refonte graphique (Phase « design », `v10`) : `README.md` et
> `docs/screenshots/` ne font pas partie des ressources mises en cache (documentation
> du dépôt, pas de l'app).

### Phase 12 — Extensibilité (pour plus tard, ne pas implémenter en v1)
Ajouter un type de fiche = ajouter une entrée dans `forms-def.js` (+ critères/bornes), gérer son
corps dans `form.js`, sa conformité dans `calculations.js`, son rendu dans `pdf.js`. Le bouton
apparaît automatiquement sur l'accueil. Cibles futures évoquées : réunions sécurité, audits de chantier.

---

## 9. Détails email (mailto:)

```
sujet = "[QSE] " + libelléType + " - " + chantier + " - " + date
corps = "Bonjour,\n\nVeuillez trouver ci-joint la fiche de contrôle « " + libelléType +
        " » pour le chantier " + chantier + " en date du " + date + ".\n\n" +
        "IMPORTANT : pensez à joindre le fichier PDF préalablement téléchargé depuis " +
        "l'application.\n\nCordialement"
href = "mailto:" + encodeURIComponent(destinataire||"") + "?subject=" +
        encodeURIComponent(sujet) + "&body=" + encodeURIComponent(corps)
```

---

## 10. Critères d'acceptation (la v1 est « finie » quand…)

- [ ] L'app s'installe sur iPhone (Safari) et Android (Chrome) et s'ouvre en plein écran.
- [ ] En **mode avion**, on peut créer, remplir, sauvegarder une fiche, calculer la conformité
      et **générer + télécharger le PDF**.
- [ ] Les 4 fiches fonctionnent avec leurs calculs et badges conformes au §5.
- [ ] Les signatures tactiles s'enregistrent et apparaissent dans le PDF.
- [ ] Les données persistent après fermeture (IndexedDB).
- [ ] Le bouton email ouvre le client mail pré-rempli ; le statut passe à « envoyée ».
- [ ] Aucune ressource n'est chargée depuis Internet à l'exécution (tout est vendé/caché).
- [ ] Les tests de calcul passent.
- [ ] Le code est en JS vanilla lisible, sans étape de build, et commenté en français.

---

## 11. Pièges connus à éviter

- **Service worker uniquement sur HTTP(S)/localhost** : tester via `python -m http.server`, pas en `file://`.
- **Tout vendre** : ne jamais référencer jsPDF (ni police, ni rien) depuis un CDN à l'exécution.
- **Accents dans le PDF** : assainir les caractères hors Latin-1 avant d'écrire (voir §7).
- **Écart-type** : utiliser la formule d'**échantillon (n−1)**, et `s = 0` si moins de 2 mesures gardées.
- **Mesures exclues** : ne **pas** inclure les ruptures éliminées dans la moyenne (voir §5).
- **Virgule décimale** : accepter `,` comme `.` en saisie (chantier suisse francophone).
- **Mettre à jour le cache du SW** à chaque évolution (changer la version du cache) sinon
  les anciens fichiers restent servis.

---

*Fin du plan. Ce document + le code de référence dans `application-qse/` suffisent à construire
l'application complète.*
