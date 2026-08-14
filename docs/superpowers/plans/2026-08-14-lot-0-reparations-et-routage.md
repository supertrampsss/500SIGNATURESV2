# Lot 0 — Réparations et routage : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réparer le démarrage du site, donner à chaque vue une vraie adresse, et
rendre au produit les six modules qui dormaient sans appelant.

**Architecture :** Le site reste une application d'une seule page en TypeScript sans
framework. Un module pur `routes.ts` traduit une adresse en nom de vue et l'inverse ;
`main.ts` lit désormais `location.pathname` au lieu du fragment, et les anciennes
adresses à fragment sont réécrites vers leur chemin au démarrage. Cloudflare Pages
sert `index.html` pour tout chemin sans fichier, ce qui suffit à faire fonctionner les
chemins profonds sans pré-rendu — le pré-rendu viendra au lot 1, pour les métadonnées.

**Tech Stack :** TypeScript 5.9 strict, Vite 7, tests par le lanceur natif de Node
(`node --experimental-strip-types --test src/*.test.ts`), aucune dépendance de rendu.

**Spec de référence :** `docs/superpowers/specs/2026-08-14-arbitre-rejouable-design.md`,
sections 7.2 (routes), 16 (gestion des erreurs), 21 (tests), 23 (critères 1 à 5),
24 (lot 0).

## Global Constraints

Ces règles valent pour chaque tâche, sans être répétées dans les tâches.

- **Langue** : la documentation et l'interface sont en français ; le code, les
  identifiants et les messages de commit sont en anglais. Les commentaires de code de
  ce dépôt sont en français : suivre l'usage établi.
- **Unités** : tout montant s'affiche en millions d'euros, deux décimales sous le
  million ; jamais de k€ ni de Md€. Le par-habitant n'apparaît que dans les tableaux
  dépliés. Un taux varie en points, jamais en pourcentage.
- **Fenêtre** : 2019 au dernier exercice publié, à toutes les mailles, lue sur les
  exercices publiés et jamais sur un calendrier électoral.
- **Réserves** : aucune phrase qui invite le lecteur à se méfier d'un chiffre. Ce qui
  manque à un fichier se dit dans la légende du tableau, avec les chiffres.
- **Style** : ne toucher qu'à ce que la tâche demande. Ne pas reformater le code
  voisin, ne pas « améliorer » des commentaires existants, ne pas supprimer du code
  mort qui n'est pas nommé dans ce plan.
- **Tests** : les tests d'architecture (`interface.test.ts`, `vues.test.ts`) lisent les
  fichiers source en texte et verrouillent des décisions. Quand une tâche les modifie,
  l'assertion doit continuer à verrouiller la même décision sous sa nouvelle forme —
  **jamais l'assouplir ni la supprimer**.
- **Commande de test** : `cd site && npm test`. Elle doit passer à la fin de chaque
  tâche. Point de départ : 453 tests, 0 échec.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâches |
|---|---|---|
| `site/src/routes.ts` *(créé)* | Traduire une adresse en nom de vue et l'inverse. Aucune connaissance du document. | 2 |
| `site/src/routes.test.ts` *(créé)* | Tests du module ci-dessus. | 2 |
| `site/src/main.ts` *(modifié)* | Gardes de démarrage, lecture du chemin, écriture de l'adresse, navigation, peinture des vues rétablies. | 1, 3, 4, 5, 6, 7, 8 |
| `site/index.html` *(modifié)* | Conteneurs des vues, liens de navigation, conteneurs rendus aux modules rebranchés. | 3, 4, 5, 6, 8 |
| `site/src/interface.test.ts` *(modifié)* | Verrouillage des décisions d'architecture, mis à jour au fil des tâches. | 1, 3, 4, 5, 8 |
| `site/src/traductions.test.ts` *(rempli)* | Le fichier existe et pèse zéro octet. | 9 |
| `site/src/croiser.ts`, `croiser.test.ts` *(supprimés)* | Corrélations : retirés, motif en tâche 8. | 8 |
| `site/src/euros-constants.ts`, `euros-constants.test.ts` *(supprimés)* | Euros constants : retirés, motif en tâche 8. | 8 |

Aucune modification de `atelier.ts`, `simulateur.ts`, `simulateur-rendu.ts`,
`comparateur.ts`, `export.ts`, `journal.ts`, `fraicheur.ts`, `recapitulatif.ts` :
ces modules fonctionnent, il ne leur manque qu'un appelant ou un conteneur.

---

### Task 1: Réparer le démarrage

Le défaut le plus grave du dépôt. `brancherCommandes()` accroche un écouteur sur
`#exporter` (`main.ts:1864`) et sur `#comparateur` (`main.ts:1910`), deux
identifiants qui ont disparu d'`index.html` avec la vue DONNÉES. `$` rend `null`, et
`null.addEventListener` lève. L'appel est fait depuis `demarrer()` à la ligne 2862 :
l'exception remonte au `.catch` final, qui remplace la fiche par le panneau
« Les chiffres n'ont pas pu être chargés » — et **tout ce qui suit la ligne 2862 ne
s'exécute jamais** : les groupes de comparaison, la conjoncture, la dette, l'Europe,
les 100 €, les fonctions, la Sécurité sociale, l'État, les niches, le sommaire de la
vue, et le chargement des mailles parentes.

Quatre gardes identiques existent déjà ailleurs dans le fichier, pour exactement la
même raison (lignes 466, 514, 2018, 2929), et deux d'entre elles sont verrouillées par
un test. Ces deux-ci ont été oubliées.

**Files:**
- Modify: `site/src/main.ts:1864`, `site/src/main.ts:1910`
- Test: `site/src/interface.test.ts` (test existant « la vue DONNÉES est retirée, et
  ses anciens liens ne cassent pas »)

**Interfaces:**
- Consumes: rien.
- Produces: rien. Cette tâche ne change aucune signature ; elle rend seulement
  atteignable le code qui suit `brancherCommandes()`.

- [ ] **Step 1: Écrire le test qui échoue**

Dans `site/src/interface.test.ts`, dans le test existant
`test("la vue DONNÉES est retirée, et ses anciens liens ne cassent pas", ...)`,
compléter la liste des gardes attendues. Remplacer :

```ts
  for (const garde of [
    'if (!document.getElementById("tableau-donnees")) return;',
    'if (!document.getElementById("sources-contenu")) return;',
  ]) {
    assert.ok(MAIN.includes(garde), `garde manquante : ${garde}`);
  }
```

par :

```ts
  for (const garde of [
    'if (!document.getElementById("tableau-donnees")) return;',
    'if (!document.getElementById("sources-contenu")) return;',
  ]) {
    assert.ok(MAIN.includes(garde), `garde manquante : ${garde}`);
  }
  // Les écouteurs aussi. `brancherCommandes()` accrochait `#exporter` et
  // `#comparateur` sans garde : `$` rend `null`, `null.addEventListener` lève,
  // et l'exception remontait au `.catch` de `demarrer()` — tout ce qui suit
  // l'appel ne s'exécutait plus, blocs de Décryptages compris.
  for (const ecouteur of ["exporter", "comparateur"]) {
    assert.match(
      MAIN,
      new RegExp(`document\\.getElementById\\("${ecouteur}"\\)\\?\\.addEventListener`),
      `écouteur non gardé : #${ecouteur}`,
    );
  }
  assert.doesNotMatch(MAIN, /\$\("exporter"\)\.addEventListener/);
  assert.doesNotMatch(MAIN, /\$\("comparateur"\)\.addEventListener/);
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd site && npm test 2>&1 | grep -A5 "la vue DONNÉES est retirée"`
Expected: FAIL, avec `écouteur non gardé : #exporter`.

- [ ] **Step 3: Poser les deux gardes**

Dans `site/src/main.ts`, ligne 1864, remplacer `$("exporter").addEventListener("click", () => {`
par :

```ts
  // Le bouton d'export vivait dans la vue DONNÉES, retirée : sans lui, `$` rend
  // `null` et l'écouteur levait au démarrage, emportant tout ce que
  // `demarrer()` fait après cet appel. Même garde que `majTableau`.
  document.getElementById("exporter")?.addEventListener("click", () => {
```

Ligne 1910, remplacer `$("comparateur").addEventListener("click", (evenement) => {` par :

```ts
  document.getElementById("comparateur")?.addEventListener("click", (evenement) => {
```

Ne rien changer d'autre : les corps des deux écouteurs sont corrects et
redeviendront utiles à la tâche 5.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && npm test 2>&1 | tail -5`
Expected: `# pass 453`, `# fail 0`.

- [ ] **Step 5: Vérifier de visu que le site démarre entièrement**

Run: `cd site && npm run dev`
Ouvrir `http://localhost:5173/#decryptages`.
Expected: les blocs de la vue s'affichent — conjoncture, dette, Europe, les 100 €,
fonctions, Sécurité sociale, État, niches — et le sommaire les liste. Avant ce
correctif, la vue était vide et la fiche affichait le panneau d'échec.

- [ ] **Step 6: Commit**

```bash
git add site/src/main.ts site/src/interface.test.ts
git commit -m "Guard the two listeners whose elements no longer exist

brancherCommandes() attached click handlers to #exporter and #comparateur,
both removed from index.html along with the DONNEES view. getElementById
returns null, the listener threw, and the exception unwound demarrer() —
so everything after that call never ran: the comparison groups, every
national block on the Décryptages view, and the parent-level datasets the
territory sheet compares against. Four identical guards already exist in
this file; these two were missed."
```

---

### Task 2: `routes.ts`, le module pur

**Files:**
- Create: `site/src/routes.ts`
- Test: `site/src/routes.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `CHEMINS: Record<string, string>` — nom de vue → chemin.
  - `ALIAS: Record<string, string>` — ancien nom → nom de vue actuel.
  - `cheminDeVue(vue: string): string`
  - `vueDepuisAdresse(chemin: string, fragment: string): string | null`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `site/src/routes.test.ts` :

```ts
/**
 * Les adresses du site. Le chemin fait foi ; le fragment n'est lu que sur la
 * racine, pour les liens partagés avant que les chemins n'existent.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ALIAS, CHEMINS, cheminDeVue, vueDepuisAdresse } from "./routes.ts";

test("un chemin nomme sa vue", () => {
  assert.equal(vueDepuisAdresse("/territoire", ""), "territoire");
  assert.equal(vueDepuisAdresse("/simulateur", ""), "simulateur");
  assert.equal(vueDepuisAdresse("/reperes", ""), "reperes");
  assert.equal(vueDepuisAdresse("/detail", ""), "detail");
  assert.equal(vueDepuisAdresse("/methode", ""), "methode");
});

test("la racine sans fragment ne demande aucune vue", () => {
  // `null` et non « territoire » : l'appelant doit pouvoir distinguer « rien
  // n'est demandé » de « la vue territoire est demandée », pour laisser en
  // place ce qui est déjà affiché.
  assert.equal(vueDepuisAdresse("/", ""), null);
});

test("les anciens liens à fragment ouvrent ce qu'ils promettaient", () => {
  // `#carte` était une vue avant de devenir un mode de la vue territoire.
  assert.equal(vueDepuisAdresse("/", "#carte"), "territoire");
  // `#analyses` désignait les tableaux d'un territoire ; le nom est passé à
  // l'éditorial, les tableaux s'appellent désormais `detail`.
  assert.equal(vueDepuisAdresse("/", "#analyses"), "detail");
  assert.equal(vueDepuisAdresse("/", "#decryptages"), "reperes");
  // `#donnees` a été retiré : le lien ne doit pas laisser sur une page blanche.
  assert.equal(vueDepuisAdresse("/", "#donnees"), "territoire");
  assert.equal(vueDepuisAdresse("/", "#simulateur"), "simulateur");
});

test("une ancre interne n'est pas une vue", () => {
  // Le sommaire de la vue Repères vise `#bloc-etat` : le prendre pour une vue
  // inconnue renverrait le lecteur ailleurs au moment précis où il descend
  // dans ce qu'il lit.
  assert.equal(vueDepuisAdresse("/", "#bloc-etat"), null);
  assert.equal(vueDepuisAdresse("/reperes", "#bloc-niches"), "reperes");
});

test("un chemin inconnu ne nomme aucune vue", () => {
  assert.equal(vueDepuisAdresse("/inexistant", ""), null);
  assert.equal(vueDepuisAdresse("/analyses/taxe-zucman", ""), null);
});

test("le chemin d'une vue est stable", () => {
  for (const vue of Object.keys(CHEMINS)) {
    assert.equal(vueDepuisAdresse(cheminDeVue(vue), ""), vue);
  }
  // Une vue inconnue retombe sur la racine du site plutôt que de fabriquer
  // une adresse qui n'existe pas.
  assert.equal(cheminDeVue("inexistante"), "/territoire");
});

test("un alias ne désigne jamais un autre alias", () => {
  // Une chaîne d'alias se résoudrait à moitié : `vueDepuisAdresse` ne déréférence
  // qu'une fois.
  for (const cible of Object.values(ALIAS)) {
    assert.ok(cible in CHEMINS, `${cible} n'est pas une vue`);
  }
});

test("les segments s'accommodent des barres obliques", () => {
  assert.equal(vueDepuisAdresse("/simulateur/", ""), "simulateur");
  // Le comparateur de scénarios vit sous le simulateur : le premier segment
  // suffit à nommer la vue.
  assert.equal(vueDepuisAdresse("/simulateur/comparer", ""), "simulateur");
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd site && node --experimental-strip-types --test src/routes.test.ts`
Expected: FAIL — `Cannot find module './routes.ts'`.

- [ ] **Step 3: Écrire le module**

Créer `site/src/routes.ts` :

```ts
/**
 * Les adresses du site.
 *
 * Le site n'avait qu'une adresse — la racine — et portait sa vue dans le
 * fragment. Un fragment ne part pas au serveur : aucune page ne pouvait être
 * indexée, ni servie pré-rendue, ni partagée avec sa propre vignette. Chaque
 * vue a donc son chemin, et le fragment retrouve son seul rôle, l'ancre interne.
 *
 * Ce module ne connaît pas le document : il traduit une adresse en nom de vue et
 * l'inverse. C'est ce qui le rend testable sans navigateur.
 */

/** Les vues qui ont un chemin.
 *
 *  Le simulateur n'en est une que si un budget est publié : cette table décrit
 *  les chemins, `vuesConnues()` dans `main.ts` tranche ce qui est ouvrable. */
export const CHEMINS: Record<string, string> = {
  territoire: "/territoire",
  reperes: "/reperes",
  detail: "/detail",
  simulateur: "/simulateur",
  methode: "/methode",
};

/**
 * Les anciens noms, et ce qu'ils ouvrent aujourd'hui.
 *
 * `carte` était une vue avant de devenir un mode de la vue territoire.
 * `analyses` désignait les tableaux d'un territoire ; le nom sert désormais aux
 * analyses éditoriales, et les tableaux s'appellent `detail`. `decryptages` est
 * devenu `reperes`. `donnees` a été retiré. Un lien déjà partagé doit ouvrir ce
 * qu'il promettait, pas une page blanche.
 */
export const ALIAS: Record<string, string> = {
  carte: "territoire",
  analyses: "detail",
  decryptages: "reperes",
  donnees: "territoire",
};

/** Le chemin d'une vue. Une vue inconnue retombe sur la racine du site. */
export function cheminDeVue(vue: string): string {
  return CHEMINS[vue] ?? "/territoire";
}

/** Le nom de vue que porte un segment, alias résolus, sinon `null`. */
function vueDuNom(nom: string): string | null {
  const resolu = ALIAS[nom] ?? nom;
  return resolu in CHEMINS ? resolu : null;
}

/**
 * La vue que demande une adresse, ou `null` si elle n'en demande aucune.
 *
 * Le chemin fait foi. Le fragment n'est lu que sur la racine : c'est là que
 * vivent les liens partagés avant l'existence des chemins. `null` est une
 * réponse utile — une ancre interne ne nomme pas une vue, et l'appelant doit
 * pouvoir laisser en place celle qui est déjà affichée.
 */
export function vueDepuisAdresse(chemin: string, fragment: string): string | null {
  const segment = chemin.replace(/^\/+|\/+$/g, "").split("/")[0];
  if (segment) return vueDuNom(segment);
  const ancre = fragment.replace(/^#/, "");
  return ancre ? vueDuNom(ancre) : null;
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && node --experimental-strip-types --test src/routes.test.ts`
Expected: `# pass 8`, `# fail 0`.

- [ ] **Step 5: Vérifier que le typage tient**

Run: `cd site && npx tsc --noEmit`
Expected: aucune sortie. (`noUnusedLocals` est actif : un export non consommé ne
gêne pas, une variable locale inutilisée oui.)

- [ ] **Step 6: Commit**

```bash
git add site/src/routes.ts site/src/routes.test.ts
git commit -m "Add a pure module mapping addresses to view names

The view lived in the URL fragment, which never reaches the server: no page
could be indexed, pre-rendered, or shared with its own preview card. This
module is the translation layer — path to view name and back, with the old
fragment names kept as aliases so shared links keep their promise. It knows
nothing about the document, so it tests without a browser."
```

---

### Task 3: Le site passe aux chemins réels

Tâche atomique : on ne peut pas la faire à moitié. Tant que `ecrireUrl()` écrit
`?...` sans le chemin, le premier réglage dans le simulateur ramènerait le lecteur à
la racine ; tant que la navigation vise des fragments, un clic depuis `/simulateur`
n'irait nulle part. Les renommages de vues sont dans la même tâche parce que les
alias de la tâche 2 désignent déjà les nouveaux noms.

**Files:**
- Modify: `site/src/main.ts` (`basculerVue` 2324-2355, `ecrireUrl` 278-296,
  `VUES_PAGE` 2079, `VUES_ALIAS` 2084 supprimé, `peindreAnalyses` 2091,
  `preparerSimulateur` 2471-2474, `demarrer` 2527-2529)
- Modify: `site/index.html:54-58` (navigation), `:136` et `:165` (identifiants de vues)
- Modify: `site/src/interface.test.ts` (assertions de routage)

**Interfaces:**
- Consumes: `cheminDeVue`, `vueDepuisAdresse` de `routes.ts` (tâche 2).
- Produces: `document.body.dataset.vue` prend les valeurs `territoire`, `reperes`,
  `detail`, `simulateur`, `methode` — les tâches 4 à 8 s'y accrochent. Les conteneurs
  s'appellent `#vue-territoire`, `#vue-reperes`, `#vue-detail`, `#vue-simulateur`,
  `#vue-methode`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `site/src/interface.test.ts`, ajouter en tête, après les autres lectures de
fichier :

```ts
const ROUTES = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
```

Puis remplacer, dans le test
`test("la carte est un mode de la vue territoire, plus une entrée de menu", ...)`,
les deux assertions qui visaient `VUES_ALIAS` :

```ts
  assert.match(MAIN, /const VUES_ALIAS: Record<string, string> = \{ carte: "territoire" \};/);
  assert.match(MAIN, /if \(demandee === "carte"\) carteOuverte = true;/);
```

par :

```ts
  // La table des alias a rejoint `routes.ts`, où elle se teste sans navigateur.
  assert.match(ROUTES, /carte: "territoire"/);
  assert.match(MAIN, /if \(location\.hash === "#carte"\) carteOuverte = true;/);
```

Puis ajouter un test neuf :

```ts
test("chaque vue a une adresse, et les anciennes ouvrent la bonne", () => {
  // Le fragment ne part pas au serveur : tant que la vue y vivait, aucune page
  // ne pouvait être indexée ni servie pré-rendue.
  assert.match(MAIN, /vueDepuisAdresse\(location\.pathname, location\.hash\)/);
  // Le chemin est lu AVANT toute autre source : c'est lui qui fait foi.
  const corps = MAIN.slice(MAIN.indexOf("function basculerVue"), MAIN.indexOf("/**\n * Le sommaire"));
  assert.ok(corps.length > 200, "corps de basculerVue introuvable");
  assert.ok(
    corps.indexOf("vueDepuisAdresse(") < corps.indexOf("vuesConnues()"),
    "la vue doit être résolue avant d'être confrontée aux vues ouvrables",
  );
  // L'adresse écrite conserve le chemin : sans lui, le premier réglage dans le
  // simulateur renvoyait le lecteur à la racine.
  assert.match(MAIN, /history\.replaceState\(null, "", `\$\{location\.pathname\}\?\$\{p\}\$\{location\.hash\}`\)/);
  // Les boutons précédent/suivant du navigateur restituent la vue.
  assert.match(MAIN, /window\.addEventListener\("popstate", basculerVue\)/);
  // Un lien à fragment déjà partagé est réécrit vers son chemin, sans
  // rechargement et sans perdre les paramètres.
  assert.match(MAIN, /history\.replaceState\(null, "", `\$\{cheminDeVue\(vueDuFragment\)\}\$\{location\.search\}`\)/);
  // La navigation vise des chemins : un `href="#territoire"` cliqué depuis
  // `/simulateur` donnerait `/simulateur#territoire`, et le chemin l'emporte.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(balises, /href="#(territoire|reperes|detail|simulateur|methode)"/);
  assert.match(balises, /href="\/territoire" data-vue="territoire"/);
});

test("les vues renommées portent leur nouveau nom partout", () => {
  // « Analyses » désigne désormais les analyses éditoriales ; les tableaux d'un
  // territoire s'appellent « detail ». « Décryptages » est devenu « Repères ».
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(balises, /id="vue-detail"/);
  assert.match(balises, /id="vue-reperes"/);
  assert.doesNotMatch(balises, /id="vue-analyses"/);
  assert.doesNotMatch(balises, /id="vue-decryptages"/);
  // Et le nom retiré ne revient pas par la bande.
  assert.doesNotMatch(MAIN, /const VUES_PAGE = \[[^\]]*"donnees"/);
});
```

Enfin, dans le test `test("une vue longue dit ce qu'elle contient", ...)`, remplacer
`assert.match(PAGE, /id="sommaire-decryptages"/);` par
`assert.match(PAGE, /id="sommaire-reperes"/);` et
`assert.match(MAIN, /function peindreSommaireDecryptages\(\)/);` par
`assert.match(MAIN, /function peindreSommaireReperes\(\)/);`, et adapter les deux
bornes du `MAIN.slice` de ce test à `peindreSommaireReperes`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd site && npm test 2>&1 | tail -8`
Expected: FAIL sur les deux tests neufs et sur les tests modifiés.

- [ ] **Step 3: Renommer les conteneurs dans `index.html`**

Ligne 136 : `<div class="vue" id="vue-decryptages" hidden>` devient
`<div class="vue" id="vue-reperes" hidden>`.

Ligne 144 : `<nav class="sommaire-vue" id="sommaire-decryptages" aria-label="Sections de la page"></nav>`
devient `<nav class="sommaire-vue" id="sommaire-reperes" aria-label="Sections de la page"></nav>`.

Lignes 165-167 :

```html
    <div class="vue" id="vue-detail" hidden>
      <div id="detail"></div>
    </div>
```

- [ ] **Step 4: Remplacer la navigation par de vrais liens**

Lignes 54-58 d'`index.html` :

```html
      <nav class="entete__nav" aria-label="Vues">
        <a href="/territoire" data-vue="territoire">Territoire</a>
        <a href="/reperes" data-vue="reperes">Repères</a>
        <a href="/detail" data-vue="detail">Détail</a>
      </nav>
```

- [ ] **Step 5: Faire lire le chemin à `main.ts`**

Ajouter l'import en tête de `site/src/main.ts`, à côté des autres imports locaux :

```ts
import { cheminDeVue, vueDepuisAdresse } from "./routes.ts";
```

Remplacer `VUES_PAGE` (ligne 2079) et supprimer `VUES_ALIAS` (ligne 2084, commentaire
compris — la table vit désormais dans `routes.ts`) :

```ts
const VUES_PAGE = ["territoire", "detail", "reperes"] as const;
```

`methode` n'entre pas ici : son conteneur naît à la tâche 4, et une vue ouvrable
sans conteneur masquerait tout sans rien afficher. `routes.ts` connaît déjà son
chemin — `CHEMINS` décrit les adresses, `vuesConnues()` tranche ce qui est ouvrable —
si bien que `/methode` retombe proprement sur la vue territoire jusqu'à la tâche 4.

Remplacer les six premières lignes du corps de `basculerVue` (2325-2329) :

```ts
function basculerVue(): void {
  const demandee = vueDepuisAdresse(location.pathname, location.hash);
  // `#carte` ouvre la vue territoire ET déploie la carte : le lien tenait sa
  // promesse quand la carte était une vue, il la tient encore.
  if (location.hash === "#carte") carteOuverte = true;
  const cible = demandee ?? "";
```

Le reste du corps ne bouge pas, sauf les trois lignes de bascule des conteneurs, qui
suivent les renommages et accueillent la vue méthode (créée à la tâche 4) :

```ts
  $("vue-detail").hidden = vue !== "detail";
  if (vue === "detail") void peindreDetail();
  $("vue-reperes").hidden = vue !== "reperes";
```

Renommer `peindreAnalyses` en `peindreDetail` (ligne 2091) et, dans son corps,
`$("analyses")` en `$("detail")`. Renommer `peindreSommaireDecryptages` en
`peindreSommaireReperes` (ligne 2373) et, dans son corps, `"sommaire-decryptages"` en
`"sommaire-reperes"` ; mettre à jour ses deux appels (`grep -n peindreSommaireDecryptages src/main.ts`).

- [ ] **Step 6: Préserver le chemin à l'écriture de l'adresse**

Ligne 295 de `main.ts` :

```ts
  // Le chemin porte la vue, le fragment l'ancre interne : réécrire l'adresse
  // sans le chemin renverrait le lecteur du simulateur à la carte au premier
  // réglage.
  history.replaceState(null, "", `${location.pathname}?${p}${location.hash}`);
```

- [ ] **Step 7: Brancher `popstate`, la compatibilité et la navigation**

Dans `demarrer()`, remplacer les lignes 2527-2529 :

```ts
  etat = lireUrl();
  // Les liens partagés avant l'existence des chemins portent la vue dans le
  // fragment : on les réécrit vers leur chemin, sans rechargement et sans
  // toucher aux paramètres. Une ancre interne (`#bloc-etat`) n'est pas une vue
  // et reste intacte.
  const vueDuFragment = location.pathname === "/" ? vueDepuisAdresse("/", location.hash) : null;
  if (vueDuFragment) {
    history.replaceState(null, "", `${cheminDeVue(vueDuFragment)}${location.search}`);
  }
  window.addEventListener("hashchange", basculerVue);
  window.addEventListener("popstate", basculerVue);
  basculerVue();
```

Dans `brancherCommandes()`, juste avant `brancherRecherche(...)` (ligne 1901),
ajouter l'interception des clics de navigation :

```ts
  // La navigation change de vue sans recharger la page. Les modificateurs et le
  // clic du milieu sont laissés au navigateur : « ouvrir dans un nouvel onglet »
  // doit continuer de fonctionner sur un vrai lien.
  document.querySelector(".entete__nav")?.addEventListener("click", (evenement) => {
    const clic = evenement as MouseEvent;
    if (clic.button !== 0 || clic.metaKey || clic.ctrlKey || clic.shiftKey || clic.altKey) return;
    const lien = (clic.target as HTMLElement).closest<HTMLAnchorElement>("a[data-vue]");
    if (!lien) return;
    clic.preventDefault();
    // Les paramètres suivent : changer de vue ne doit pas perdre le territoire
    // choisi ni les réglages du simulateur.
    history.pushState(null, "", `${lien.pathname}${location.search}`);
    basculerVue();
  });
```

Dans `preparerSimulateur()` (lignes 2471-2474) :

```ts
  document
    .querySelector(".entete__nav")!
    .insertAdjacentHTML(
      "beforeend",
      `<a href="/simulateur" data-vue="simulateur">Simulateur</a>`,
    );
  if (vueDepuisAdresse(location.pathname, location.hash) === "simulateur") basculerVue();
```

- [ ] **Step 8: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && npm test 2>&1 | tail -5`
Expected: `# fail 0`. Si `vues.test.ts` échoue, vérifier qu'on n'a pas touché à
`p.set("vue", …)` : ce paramètre est le **cadrage de la carte**, pas la vue de page,
et il ne fait pas partie de cette tâche.

Run: `cd site && npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 9: Vérifier de visu les cinq chemins et la compatibilité**

Run: `cd site && npm run dev`

| À ouvrir | Attendu |
|---|---|
| `http://localhost:5173/reperes` | La vue Repères, ses blocs peints |
| `http://localhost:5173/simulateur` | L'atelier |
| `http://localhost:5173/#analyses` | L'adresse devient `/detail`, la vue Détail s'affiche |
| `http://localhost:5173/#carte` | L'adresse devient `/territoire`, carte déployée |
| `http://localhost:5173/#donnees` | L'adresse devient `/territoire` |
| `/reperes` puis clic sur une entrée du sommaire | Défile jusqu'au bloc, reste sur `/reperes` |
| `/simulateur`, régler une ligne | L'adresse reste `/simulateur?...`, jamais `/?...` |
| Naviguer entre trois vues puis « précédent » | Revient à la vue précédente |

- [ ] **Step 10: Commit**

```bash
git add site/src/main.ts site/index.html site/src/interface.test.ts
git commit -m "Give every view a real path

The view lived in the URL fragment, so no page reached the server as itself.
Paths now carry it: basculerVue reads location.pathname, ecrireUrl keeps the
path it was called on, popstate restores views, and the header links are real
anchors intercepted on click. Shared fragment links are rewritten to their
path at startup without a reload, so #analyses, #carte and #donnees still open
what they promised. The tables view is renamed detail — analyses now means the
editorial pages — and decryptages becomes reperes."
```

---

### Task 4: La page `/methode`, et le journal des corrections y revient

`journal.ts` et `fraicheur.ts` sont écrits, testés (8 tests chacun), et le pipeline
publie `journal.json` et `fraicheur.json` à chaque exécution. Aucun des deux n'a
d'appelant : ce que le site sait dire de ses propres corrections n'est affiché nulle
part. La spec en fait un élément de confiance de la page méthode.

**Files:**
- Modify: `site/index.html` (conteneur de la vue), `site/src/main.ts` (peinture)
- Test: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: `document.body.dataset.vue === "methode"` et `#vue-methode` (tâche 3) ;
  `afficherJournal(bloc: HTMLElement, changements: Changement[]): boolean` de
  `journal.ts` ; `afficherFraicheur(bloc: HTMLElement, jeux: Fraicheur[]): boolean` de
  `fraicheur.ts` ; `donnees.journal()` et `donnees.fraicheur()`.
- Produces: `peindreMethode(): Promise<void>`, appelée par `basculerVue`. Le lot 4
  enrichira cette vue ; le lot 1 y ajoutera la grille de verdicts.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `site/src/interface.test.ts` :

```ts
test("le site dit ce qu'il a corrigé et quand il a lu ses sources", () => {
  // Le pipeline publie `journal.json` et `fraicheur.json` à chaque exécution, et
  // les deux modules qui les rendent étaient écrits et testés sans être
  // appelés : le site savait dire ses corrections et ne les disait nulle part.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(balises, /id="vue-methode"/);
  assert.match(balises, /id="methode-journal"/);
  assert.match(balises, /id="methode-fraicheur"/);
  assert.match(MAIN, /async function peindreMethode\(\)/);
  assert.match(MAIN, /afficherJournal\(/);
  assert.match(MAIN, /afficherFraicheur\(/);
  // Un fichier absent laisse la page debout : c'est la règle du site partout
  // ailleurs, elle vaut ici.
  const corps = MAIN.slice(MAIN.indexOf("async function peindreMethode"));
  assert.match(corps.slice(0, 900), /catch/);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd site && npm test 2>&1 | grep -A5 "le site dit ce qu'il a corrigé"`
Expected: FAIL sur `id="vue-methode"`.

- [ ] **Step 3: Ajouter le conteneur de la vue**

Dans `site/index.html`, après le bloc `<div class="vue" id="vue-detail" hidden>…</div>`
et avant `</main>` :

```html
    <!-- La méthode : ce que le site a corrigé, et quand il a lu ses sources.
         Le lot 1 y ajoutera la grille des verdicts, le lot 4 les sources. -->
    <div class="vue" id="vue-methode" hidden>
      <section class="methode">
        <h2>Méthode</h2>
        <div class="bloc bloc--large" id="methode-fraicheur"></div>
        <div class="bloc bloc--large" id="methode-journal"></div>
      </section>
    </div>
```

- [ ] **Step 4: Ouvrir la vue et l'ajouter à la navigation**

Dans `site/src/main.ts`, ajouter `methode` aux vues ouvrables — la tâche 3 l'avait
laissée dehors, faute de conteneur :

```ts
const VUES_PAGE = ["territoire", "detail", "reperes", "methode"] as const;
```

Dans `index.html`, à la fin du `<nav class="entete__nav">` :

```html
        <a href="/methode" data-vue="methode">Méthode</a>
```

- [ ] **Step 5: Peindre la vue**

Ajouter les imports en tête de `main.ts`, avec les autres imports locaux :

```ts
import { afficherFraicheur } from "./fraicheur.ts";
import { afficherJournal } from "./journal.ts";
```

Ajouter la fonction, juste avant `function basculerVue()` :

```ts
/**
 * La page MÉTHODE.
 *
 * Deux fichiers publiés à chaque exécution du pipeline : ce que le site a
 * corrigé depuis la dernière fois, et à quelle date il a lu chaque source. Les
 * deux modules qui les rendent existaient, testés, sans être appelés.
 *
 * Peinte une seule fois : elle ne dépend d'aucune sélection.
 */
let methodePeinte = false;

async function peindreMethode(): Promise<void> {
  if (methodePeinte) return;
  methodePeinte = true;
  try {
    afficherFraicheur($("methode-fraicheur"), await donnees.fraicheur());
  } catch {
    // Fichier non publié : le bloc reste vide, la page tient.
  }
  try {
    afficherJournal($("methode-journal"), await donnees.journal());
  } catch {
    // Idem : rien à dire vaut mieux qu'une erreur à lire.
  }
}
```

Dans `basculerVue`, à côté des autres bascules de conteneurs :

```ts
  $("vue-methode").hidden = vue !== "methode";
  if (vue === "methode") void peindreMethode();
```

- [ ] **Step 6: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && npm test 2>&1 | tail -5`
Expected: `# fail 0`.

Run: `cd site && npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 7: Vérifier de visu**

Run: `cd site && npm run dev`, ouvrir `http://localhost:5173/methode`.
Expected: l'état de fraîcheur des jeux et le journal des changements s'affichent.
Si les fichiers ne sont pas publiés sur le bucket courant, la page s'affiche vide
sans erreur en console — c'est le comportement attendu.

- [ ] **Step 8: Commit**

```bash
git add site/index.html site/src/main.ts site/src/interface.test.ts
git commit -m "Bring the corrections journal and source freshness back on screen

The pipeline publishes journal.json and fraicheur.json on every run, and both
rendering modules were written and tested — with no caller. A site that says
what it corrected is the cheapest credibility it can buy, and it was saying it
nowhere. They now sit on the new /methode view, which later lots extend."
```

---

### Task 5: Le comparateur de territoires et l'export reviennent sur `/detail`

`comparateur.ts` (154 lignes, 5 exports) et `export.ts` (207 lignes, CSV au format
tableur français) sont importés par `main.ts` et parfaitement fonctionnels. Les
fonctions qui les alimentent — `majComparateur`, `majTableau`, `majTableauEvolution` —
existent et sont gardées. Il ne manque que les trois conteneurs, disparus avec la vue
DONNÉES. Les rendre à la vue `/detail`, qui est déjà la vue exhaustive d'un
territoire, rallume tout le circuit.

**Files:**
- Modify: `site/index.html` (vue `#vue-detail`)
- Modify: `site/src/main.ts` (`peindreDetail`)
- Test: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: `#vue-detail` et `peindreDetail()` (tâche 3) ; les gardes de la tâche 1.
- Produces: les conteneurs `#tableau-donnees`, `#exporter`, `#comparateur` existent à
  nouveau dans le document.

**Attention :** `majTableau` teste `#tableau-donnees` puis écrit dans `#exporter`
**sans le tester**. Ajouter l'un sans l'autre lève. Les deux vont ensemble.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `site/src/interface.test.ts` :

```ts
test("le détail d'un territoire porte son classement, son export et sa comparaison", () => {
  // Trois conteneurs disparus avec la vue DONNÉES, alors que tout le code qui
  // les remplit est resté : `majTableau`, `majTableauEvolution` et
  // `majComparateur` se taisaient faute d'endroit où écrire.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  const vue = balises.slice(balises.indexOf('id="vue-detail"'), balises.indexOf('id="vue-methode"'));
  assert.match(vue, /id="tableau-donnees"/);
  assert.match(vue, /id="exporter"/);
  assert.match(vue, /id="comparateur"/);
  // `majTableau` écrit dans `#exporter` sans le tester : les deux vont ensemble
  // ou pas du tout.
  assert.ok(
    vue.indexOf('id="tableau-donnees"') !== -1 && vue.indexOf('id="exporter"') !== -1,
    "le tableau et son bouton d'export doivent être posés ensemble",
  );
  // Le tableau est un tableau : `majTableau` y écrit un `<caption>`, un
  // `<thead>` et un `<tbody>`.
  assert.match(vue, /<table[^>]*id="tableau-donnees"/);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd site && npm test 2>&1 | grep -A5 "le détail d'un territoire porte"`
Expected: FAIL sur `id="tableau-donnees"`.

- [ ] **Step 3: Rendre les trois conteneurs**

Dans `site/index.html`, remplacer le bloc de la vue détail :

```html
    <div class="vue" id="vue-detail" hidden>
      <div id="detail"></div>

      <!-- Le classement de la couche affichée, son export et la comparaison de
           territoires vivaient dans la vue DONNÉES, retirée. Le code qui les
           remplit n'a jamais bougé : il lui manquait ces trois conteneurs. -->
      <section class="comparateur" id="comparateur" hidden></section>

      <section class="classement">
        <table id="tableau-donnees"></table>
        <button type="button" class="bouton-filet" id="exporter" hidden></button>
      </section>
    </div>
```

- [ ] **Step 4: Peindre au moment d'ouvrir la vue**

Dans `peindreDetail()` (`main.ts`), après `afficherAnalyses(...)`, ajouter :

```ts
  // Le comparateur suit la sélection : il n'a pas d'état propre, il relit
  // `etat.comparaison`, que l'adresse porte déjà.
  await majComparateur();
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && npm test 2>&1 | tail -5`
Expected: `# fail 0`.

Run: `cd site && npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 6: Vérifier de visu le circuit complet**

Run: `cd site && npm run dev`

1. Ouvrir `http://localhost:5173/territoire`, chercher « Bordeaux », ouvrir la fiche.
2. Aller sur `/detail`.
   Expected: les tableaux du territoire, puis le classement des territoires de la
   couche affichée, et le bouton « Télécharger en CSV (N territoires) ».
3. Cliquer le bouton.
   Expected: un fichier CSV se télécharge, séparateur `;`, virgule décimale.
4. Ouvrir `http://localhost:5173/detail?comparer=33063,33522&niveau=commune`.
   Expected: le tableau de comparaison s'affiche, chaque en-tête portant son « × ».
5. Cliquer un « × ».
   Expected: le territoire sort de la comparaison et de l'adresse.

- [ ] **Step 7: Commit**

```bash
git add site/index.html site/src/main.ts site/src/interface.test.ts
git commit -m "Give the ranking table, CSV export and comparator a home again

All three lost their containers when the DONNEES view was removed, but every
line that fills them stayed — majTableau, majTableauEvolution and
majComparateur have been guarded and silent ever since. They belong on the
detail view, which is already the exhaustive view of a territory. Note that
majTableau writes to #exporter without testing for it, so the table and its
button have to be added together."
```

---

### Task 6: Le récapitulatif en comptabilité nationale rejoint l'atelier

`recapitulatif.ts` est décrit comme livré dans les notes du projet — « une entrée du
sélecteur qui ne se règle pas : elle dit d'abord que les budgets ne s'additionnent
pas, puis montre le seul cadre qui les somme » — mais n'a jamais été branché après le
passage au format atelier. Le pipeline publie `comptabilite-nationale.json`.

C'est le seul endroit du site qui a le droit de sommer les trois budgets ; l'atelier,
lui, n'écrit jamais de total. Le récapitulatif se pose donc **à côté** de l'atelier,
dans son propre conteneur, sans toucher à `afficherAtelier` qui possède `#simu`.

**Files:**
- Modify: `site/index.html` (vue `#vue-simulateur`)
- Modify: `site/src/main.ts` (`ouvrirSimulateur`)
- Test: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: `afficherRecapitulatif(bloc: HTMLElement, recapitulatif: Recapitulatif): void`
  de `recapitulatif.ts` ; `donnees.recapitulatifNational()`.
- Produces: rien pour les tâches suivantes.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `site/src/interface.test.ts` :

```ts
test("le seul cadre qui somme les trois budgets est montré, à côté de l'atelier", () => {
  // L'atelier n'écrit jamais de total : entre le budget général et les régimes
  // de base circulent des dizaines de milliards que chacun compte de son côté.
  // La comptabilité nationale est le seul cadre qui les somme — publiée, et
  // jamais affichée.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(balises, /id="simu-recapitulatif"/);
  assert.match(MAIN, /afficherRecapitulatif\(/);
  // Il est posé à côté de l'atelier, pas dedans : `afficherAtelier` possède
  // `#simu` et le repeint entièrement à chaque réglage.
  assert.doesNotMatch(MAIN, /afficherAtelier\(\$\("simu-recapitulatif"\)/);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd site && npm test 2>&1 | grep -A5 "le seul cadre qui somme"`
Expected: FAIL sur `id="simu-recapitulatif"`.

- [ ] **Step 3: Ajouter le conteneur**

Dans `site/index.html`, lignes 161-163 :

```html
    <div class="vue" id="vue-simulateur" hidden>
      <section class="simu" id="simu"></section>
      <!-- À côté de l'atelier, jamais dedans : `afficherAtelier` possède `#simu`
           et le repeint à chaque réglage. Le récapitulatif, lui, ne se règle
           pas — c'est le seul cadre du site qui somme les trois budgets. -->
      <section class="simu-recapitulatif" id="simu-recapitulatif"></section>
    </div>
```

- [ ] **Step 4: Peindre le récapitulatif**

Ajouter l'import en tête de `main.ts` :

```ts
import { afficherRecapitulatif } from "./recapitulatif.ts";
```

À la fin de `ouvrirSimulateur()`, après l'appel à `afficherAtelier(...)` :

```ts
  // Le récapitulatif ne se règle pas : il dit ce que les budgets réglables ne
  // peuvent pas dire — leur somme, dans le seul cadre qui l'autorise.
  try {
    afficherRecapitulatif($("simu-recapitulatif"), await donnees.recapitulatifNational());
  } catch {
    // Fichier non publié : l'atelier reste entier.
  }
```

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && npm test 2>&1 | tail -5`
Expected: `# fail 0`.

Run: `cd site && npx tsc --noEmit`
Expected: aucune sortie.

- [ ] **Step 6: Vérifier de visu**

Run: `cd site && npm run dev`, ouvrir `http://localhost:5173/simulateur`, descendre
sous l'atelier.
Expected: le récapitulatif en comptabilité nationale, avec son écart et sa mention.
Régler une ligne du simulateur : le récapitulatif ne bouge pas — il n'est pas réglable.

- [ ] **Step 7: Commit**

```bash
git add site/index.html site/src/main.ts site/src/interface.test.ts
git commit -m "Show the one frame that is allowed to add the budgets up

recapitulatif.ts was written, published by the pipeline as
comptabilite-nationale.json, and never wired after the workshop rewrite. It
sits beside the workshop rather than inside it: afficherAtelier owns #simu and
repaints it on every adjustment, and this panel is not adjustable — it states
what the adjustable budgets cannot, their sum, in the only accounting frame
where that sum is legitimate."
```

---

### Task 7: Le paramètre `?mode=evolution` tient sa promesse

`lireUrl` lit `?mode=evolution` et `ecrireUrl` l'écrit ; `evolution-carte.ts`, ses
17 tests, `peindreEvolution` et `majTableauEvolution` sont intacts. Mais
`construireBarreMode()` ne contient plus qu'une ligne — `etat.mode = "niveau";` — qui
annule le mode juste après sa lecture. Un lien partagé promet donc une couche qu'il
n'ouvre pas.

**Le bouton ne revient pas.** Il a été retiré délibérément, avec sa raison écrite dans
le code : deux mots sans phrase pour désigner deux façons de peindre la même série, et
la carte peignait la moitié du temps une grandeur que le lecteur croyait être l'autre.
Cette décision tient. Ce qui change, c'est que le paramètre cesse de mentir à qui le
demande explicitement.

**Files:**
- Modify: `site/src/main.ts` (`construireBarreMode` 1604-1606 et son appel)
- Test: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: rien.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `site/src/interface.test.ts` :

```ts
test("le paramètre d'évolution ouvre ce qu'il promet, sans bouton pour le proposer", () => {
  // Le bouton a été retiré exprès : deux mots sans phrase pour deux façons de
  // peindre la même série, et la carte peignait la moitié du temps une
  // grandeur que le lecteur croyait être l'autre. Il ne revient pas.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(balises, /id="barre-mode"/);
  // Mais l'adresse porte toujours `mode=evolution`, lu et écrit : plus rien ne
  // doit l'annuler juste après sa lecture.
  assert.match(MAIN, /p\.get\("mode"\) === "evolution" \? "evolution" : "niveau"/);
  assert.doesNotMatch(MAIN, /function construireBarreMode\(\)/);
  // Le seul repli qui subsiste est celui qui a une raison comptable : une
  // évolution demande deux millésimes publiés à cette maille.
  assert.match(MAIN, /if \(periodes\.length < 2\) etat\.mode = "niveau";/);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd site && npm test 2>&1 | grep -A5 "le paramètre d'évolution"`
Expected: FAIL sur `function construireBarreMode\(\)`.

- [ ] **Step 3: Retirer la fonction qui annulait le mode**

Dans `site/src/main.ts`, supprimer la fonction `construireBarreMode` et le bloc de
commentaire qui la précède (lignes ~1590-1606), puis supprimer son appel :

```bash
cd site && grep -n "construireBarreMode" src/main.ts
```

Chaque occurrence disparaît. Ne pas toucher à la ligne
`if (periodes.length < 2) etat.mode = "niveau";` de `construireSelecteurs` : ce repli-là
a une raison comptable — une évolution demande deux millésimes publiés à cette maille.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && npm test 2>&1 | tail -5`
Expected: `# fail 0`.

Run: `cd site && npx tsc --noEmit`
Expected: aucune sortie. Si `noUnusedLocals` signale un import devenu inutile,
le retirer — c'est un orphelin créé par cette tâche.

- [ ] **Step 5: Vérifier de visu, y compris l'unité de la variation**

Run: `cd site && npm run dev`

1. Ouvrir `http://localhost:5173/territoire?mode=evolution&niveau=departement&indicateur=ofgl_depenses_fonctionnement`.
   Expected: la carte peint une variation, la légende dit qu'il s'agit d'une variation
   et nomme les deux millésimes.
2. Ouvrir la même adresse sur un **taux** (par exemple un indicateur dont l'unité est
   un pourcentage).
   Expected: la variation est exprimée **en points**, jamais en pourcentage — c'est la
   règle du projet, et `evolution-carte.ts` la porte déjà.
3. Ouvrir `/territoire` sans le paramètre.
   Expected: la carte peint un niveau, et aucun bouton ne propose autre chose.

- [ ] **Step 6: Commit**

```bash
git add site/src/main.ts site/src/interface.test.ts
git commit -m "Stop cancelling the evolution mode the URL still advertises

lireUrl reads mode=evolution and ecrireUrl writes it, but construireBarreMode
had been reduced to a single line that set the mode back to niveau right
after — so a shared link promised a layer it never opened, while the layer's
code and its seventeen tests sat unreachable. The button stays gone, and for
the reason written where it was removed: two bare words for two ways of
painting the same series, and readers took one for the other. Only the
accounting fallback remains, the one that needs two published vintages."
```

---

### Task 8: Retraits — `croiser.ts`, `euros-constants.ts`, `#palmares`

Trois éléments qui ne reviendront pas, chacun pour une raison propre. Ce sont les
seuls retraits de ce lot : tout autre code inutilisé reste en place.

**`croiser.ts`** (174 lignes, 11 tests) dessine un nuage de points et calcule un
coefficient de corrélation de Pearson. La charte du projet interdit de présenter une
corrélation comme une causalité, et un nuage de points assorti d'un « r » est
précisément l'écran où le lecteur fait cette lecture tout seul. Le module n'a jamais
été branché ; il ne doit pas l'être.

**`euros-constants.ts`** (90 lignes, 7 tests) déflate des montants par l'indice des
prix. Il introduit une seconde unité à côté du million d'euros courants, alors que les
règles d'affichage n'en admettent qu'une par colonne. Retiré ; il reviendra si une
décision explicite d'unité est prise, et `git` le garde entier.

**`#palmares`** est un conteneur présent dans `index.html` et stylé dans `style.css`,
que rien n'a jamais rempli.

**Files:**
- Delete: `site/src/croiser.ts`, `site/src/croiser.test.ts`,
  `site/src/euros-constants.ts`, `site/src/euros-constants.test.ts`
- Modify: `site/index.html:130` (retrait du conteneur)
- Test: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: rien.

- [ ] **Step 1: Vérifier qu'aucun de ces trois éléments n'est utilisé**

```bash
cd site && grep -rn "croiser\|euros-constants\|enEurosConstants\|facteurDePrix\|palmares" src/ index.html | grep -v "croiser.test.ts\|euros-constants.test.ts\|^src/croiser.ts\|^src/euros-constants.ts"
```

Expected: seulement `index.html` (le conteneur `#palmares`) et `src/style.css`
(ses règles). Si une autre référence apparaît, **arrêter** : le module n'est pas mort,
et ce plan est faux sur ce point.

- [ ] **Step 2: Écrire le test qui échoue**

Ajouter à `site/src/interface.test.ts` :

```ts
test("le site ne dessine pas de corrélations et ne mêle pas deux unités", () => {
  // Un nuage de points assorti d'un coefficient de Pearson est l'écran où le
  // lecteur lit une causalité tout seul : la charte l'interdit, le module n'a
  // jamais été branché, il est retiré.
  assert.doesNotMatch(MAIN, /from "\.\/croiser\.ts"/);
  // Les euros constants introduisaient une seconde unité à côté du million
  // d'euros courants, que les règles d'affichage n'admettent pas.
  assert.doesNotMatch(MAIN, /from "\.\/euros-constants\.ts"/);
  // Et le conteneur que rien n'a jamais rempli.
  const balises = PAGE.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(balises, /id="palmares"/);
});
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `cd site && npm test 2>&1 | grep -A5 "ne dessine pas de corrélations"`
Expected: FAIL sur `id="palmares"`.

- [ ] **Step 4: Retirer les quatre fichiers et le conteneur**

```bash
cd site && git rm src/croiser.ts src/croiser.test.ts src/euros-constants.ts src/euros-constants.test.ts
```

Dans `site/index.html`, supprimer la ligne 130 :
`<div class="palmares" id="palmares" hidden></div>`.

Dans `site/src/style.css`, supprimer le bloc de règles `.palmares` (repéré par
`grep -n "^\.palmares" src/style.css`) : ce sont des orphelins créés par ce retrait,
donc à nettoyer ici. Ne rien supprimer d'autre du CSS.

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && npm test 2>&1 | tail -5`
Expected: `# fail 0`, et le total de tests baisse de 18 (11 de `croiser`, 7
d'`euros-constants`).

Run: `cd site && npx tsc --noEmit && npm run build`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add -A site/
git commit -m "Remove the scatter plot, the constant-euro deflator and a dead container

croiser.ts drew a scatter plot with a Pearson coefficient — the exact screen
where a reader reads causation into correlation, which the project's charter
forbids. It was never wired and should not be. euros-constants.ts introduced a
second unit alongside current millions of euros, which the display rules do
not allow in one column; git keeps it whole if a unit decision is ever taken.
#palmares was styled and never filled."
```

---

### Task 9: `traductions.test.ts`

Le fichier existe et pèse zéro octet, alors que `traductions.ts` est utilisé en
production : c'est lui qui transforme le jargon comptable en français lisible, à
l'écran, sur chaque libellé d'indicateur.

**Files:**
- Modify: `site/src/traductions.test.ts` (vide)

**Interfaces:**
- Consumes: les exports de `site/src/traductions.ts`.
- Produces: rien.

Le module exporte `TRADUCTIONS: Record<string, string>` (la table des libellés
opaques), `accentuer(libelle: string): string` (les capitales que les nomenclatures
publiques n'accentuent pas, par table de mots entiers), et
`traduire(libelle: string): string` = `accentuer(TRADUCTIONS[libelle] ?? libelle)`.
Point de contrat à ne pas rater : **un libellé absent de la table passe quand même
par `accentuer`** — « Concours de l'Etat » n'est pas traduit mais ressort
« Concours de l'État ».

- [ ] **Step 1: Écrire les tests**

Écrire dans `site/src/traductions.test.ts` :

```ts
/**
 * Le jargon comptable traduit en français lisible. Le fichier existait, vide,
 * alors que chaque libellé d'indicateur passe par ce module avant l'écran.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { accentuer, TRADUCTIONS, traduire } from "./traductions.ts";

test("un sigle de comptable public se dit en français, sigle conservé", () => {
  // Le sigle reste entre parenthèses pour qui le connaît : la traduction
  // vulgarise sans effacer le vocabulaire de la source.
  assert.equal(traduire("FCTVA"), "TVA remboursée par l'État (FCTVA)");
  assert.equal(traduire("Dépenses d'intervention"), "Aides et subventions versées");
});

test("un libellé hors table ressort intact, à l'accentuation près", () => {
  // Le repli ne doit ni vider la chaîne ni lever : un indicateur nouveau
  // s'affiche sous son nom de source. Mais il passe quand même par
  // `accentuer` — c'est le contrat de `traduire`, pas un accident.
  assert.equal(traduire("Un libellé qui n'est dans aucune table"), "Un libellé qui n'est dans aucune table");
  assert.equal(traduire("Concours de l'Etat"), "Concours de l'État");
  assert.equal(traduire(""), "");
});

test("l'accentuation corrige des mots entiers, jamais une règle aveugle", () => {
  // Accentuer tout « Et » initial casserait « et » comme « Et si » : la table
  // ne porte que des mots entiers, bornés.
  assert.equal(accentuer("Etats et Etat"), "États et État");
  assert.equal(accentuer("et pourtant"), "et pourtant");
  // La faute de frappe de la nomenclature OFGL, corrigée en mot entier.
  assert.equal(accentuer("Taxe d'enlévement des ordures ménagères"), "Taxe d'enlèvement des ordures ménagères");
});

test("chaque traduction de la table est elle-même correctement accentuée", () => {
  // Une traduction dont la valeur porterait une capitale non accentuée
  // referait à l'écran la faute que la table existe pour corriger.
  for (const [source, cible] of Object.entries(TRADUCTIONS)) {
    assert.equal(cible, accentuer(cible), `« ${source} » se traduit par un libellé mal accentué`);
  }
});
```

- [ ] **Step 2: Lancer les tests**

Run: `cd site && node --experimental-strip-types --test src/traductions.test.ts`
Expected: `# pass 4`, `# fail 0`. Si le dernier test échoue, c'est un vrai défaut
d'une entrée de la table : corriger `traductions.ts` plutôt que d'assouplir le test.

- [ ] **Step 3: Lancer la suite entière**

Run: `cd site && npm test 2>&1 | tail -5`
Expected: `# fail 0`.

- [ ] **Step 4: Commit**

```bash
git add site/src/traductions.test.ts
git commit -m "Test the jargon-to-French translation module

The test file existed at zero bytes while every indicator label passes through
this module on its way to the screen. Covers real table entries, the contract
that unknown labels still get their capitals accented, the whole-word bounds
of that accenting, and that every translated value is itself well accented."
```

---

## Vérification du lot

À la fin des neuf tâches :

```bash
cd site && npm test && npx tsc --noEmit && npm run build
```

Expected: aucun échec, aucune erreur de typage, build réussi.

Puis, sur `npm run dev`, le parcours complet :

| Adresse | Attendu |
|---|---|
| `/` | La vue territoire, carte déployée, fiche de la France |
| `/reperes` | Les huit blocs nationaux et leur sommaire |
| `/detail` (après avoir choisi un territoire) | Les tableaux, le classement, l'export, la comparaison |
| `/simulateur` | L'atelier, et le récapitulatif en comptabilité nationale dessous |
| `/methode` | La fraîcheur des sources et le journal des corrections |
| `/#analyses`, `/#carte`, `/#donnees`, `/#decryptages` | Réécrits vers leur chemin, la bonne vue s'affiche |
| `/territoire?mode=evolution&niveau=departement` | Une carte de variation, en points pour un taux |

Critères d'acceptation de la spec couverts par ce lot : 1, 2, 3, 4, 5 (section 23).

## Ce que ce lot ne fait pas

Pas de pré-rendu, pas de métadonnées sociales, pas de `sitemap.xml`, pas de
`robots.txt`, et la balise `noindex` **reste en place** : le site s'ouvre au lot 4,
quand tout le reste est vérifié. Les chemins profonds fonctionnent malgré tout, parce
que Cloudflare Pages sert `index.html` pour tout chemin sans fichier — c'est aussi
pourquoi ce dépôt ne doit jamais recevoir de `404.html`, règle qui sera verrouillée
par un test au lot 4.

Les lots suivants ont leur propre plan : lot 1 (page Analyse et contrôle éditorial),
lot 2 (scénarios et comparaison), lot 3 (partage), lot 4 (accueil et lancement).
