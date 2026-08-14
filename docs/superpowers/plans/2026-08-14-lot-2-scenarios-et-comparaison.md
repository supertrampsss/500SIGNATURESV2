# Lot 2 — Scénarios et comparaison : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au lecteur de quoi construire un budget, le garder, le rejouer et le
mettre en regard d'un autre — le sien, celui qu'on lui a envoyé, ou celui d'une analyse.

**Architecture :** Un scénario est l'état encodé du simulateur, plus un nom, une date et
le millésime sur lequel il a été construit. Rien ne quitte le navigateur : `localStorage`
et l'URL, pas de compte, pas de serveur. Trois modules purs — cycle de vie, alignement de
deux états, rendu — testés comme des chaînes, sur le modèle du reste du site.

**Tech Stack :** TypeScript 5.9 strict, Vite 7, tests Node natifs. Aucun framework.

**Spec de référence :** `docs/superpowers/specs/2026-08-14-arbitre-rejouable-design.md`,
sections 7.2-7.3 (routes, modules), 11 (scénarios), 12 (comparaison), 15.4 (scénarios de
référence), 21 (tests), 24 (lot 2).

**Base :** `main` après le lot 1. 501 tests site, 1 825 pipeline.

## Global Constraints

- **Langue** : interface et documentation en français ; identifiants et messages de
  commit en anglais ; commentaires en français, expliquant *pourquoi*.
- **Unités** : montants en millions d'euros, via `formater()` de `echelle.ts`. Les
  décimales n'apparaissent que sous 1 M€ ; au-dessus, arrondi à l'entier. **Les
  séparateurs sont des espaces fines insécables (U+202F)** : toute valeur attendue dans
  un test se produit en **appelant `formater`**, jamais en tapant la chaîne. Ce piège a
  coûté trois fausses alertes au lot 1.
- **Un taux varie en points**, jamais en pourcentage.
- **Aucune réserve qui s'excuse.**
- **Les budgets ne s'additionnent pas.** Entre le budget général et les régimes de base
  circulent des dizaines de milliards que chacun compte de son côté. Ce qui s'additionne,
  ce sont les **écarts** — l'effort. Aucune vue de ce lot n'écrit un total de dépense
  publique.
- **La comparaison ne juge pas.** Pas de gagnant, pas de note, pas de classement. Elle
  montre deux colonnes et leurs écarts.
- **Rien ne quitte le navigateur.** Pas de compte, pas de serveur, pas d'appel tiers.
  `localStorage` indisponible (navigation privée) : les scénarios vivent la session,
  l'interface le dit, la page tient. C'est déjà le comportement du thème.
- **Style** : ne toucher qu'à ce que la tâche demande ; suivre les motifs existants.
- **Tests** : `cd site && npm test` (501 au départ, 0 échec), `npx tsc --noEmit` et
  `npx tsc -p tsconfig.scripts.json --noEmit` silencieux, `npm run build` réussi.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâches |
|---|---|---|
| `site/src/scenarios.ts` *(créé)* | Cycle de vie d'un scénario, dépôt de stockage injecté. | 1 |
| `site/src/comparaison.ts` *(créé)* | Aligner deux états en lignes comparables. | 2 |
| `site/src/scenarios-rendu.ts` *(créé)* | Barre de scénarios et tableau de comparaison. | 3 |
| `site/src/main.ts` *(modifié)* | Montage, paramètres d'URL, route de comparaison. | 4 |
| `site/index.html` *(modifié)* | Conteneur `#scenarios`. | 4 |
| `site/src/style.css` *(modifié)* | Habillage de la barre et du tableau. | 3 |
| `site/scripts/prerendre.ts` *(modifié)* | Écrit les scénarios de référence. | 6 |

`atelier.ts`, `simulateur.ts` et `simulateur-rendu.ts` **ne sont pas modifiés** : le
moteur ne change pas, et `afficherAtelier` est déjà ré-entrant.

---

### Task 1: `scenarios.ts`, le cycle de vie

**Files:**
- Create: `site/src/scenarios.ts`, `site/src/scenarios.test.ts`

**Interfaces:**
- Consumes: rien. Le module ne connaît ni le document ni `localStorage` — il reçoit un
  dépôt, ce qui le rend testable sans navigateur, comme `routes.ts`.
- Produces:
  - `export type Scenario = { nom: string; budget: string; contrat: string; cree_le: string; modifie_le: string; exercice: string }`
  - `export type Depot = { lire(): string | null; ecrire(contenu: string): void }`
  - `lister(depot): Scenario[]` · `enregistrer(depot, s): Scenario[]` ·
    `renommer(depot, nom, nouveau): Scenario[]` · `dupliquer(depot, nom): Scenario[]` ·
    `supprimer(depot, nom): Scenario[]`
  - `export const NOM_MAX = 60`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `site/src/scenarios.test.ts`. Le dépôt de test est un objet en mémoire —
`{ valeur: null as string | null, lire() {...}, ecrire(c) {...} }`. Couvrir :

1. une liste vide sur un dépôt vide ;
2. enregistrer puis lister rend le scénario, avec `cree_le` et `modifie_le` ;
3. enregistrer un nom déjà pris **remplace** l'existant et met `modifie_le` à jour, sans
   dupliquer l'entrée — c'est « Enregistrer » sur un scénario ouvert ;
4. un nom de plus de `NOM_MAX` caractères est **tronqué**, pas rejeté : le lecteur ne
   doit pas perdre son travail sur une limite d'affichage ;
5. un nom vide ou fait d'espaces est refusé (le module rend la liste inchangée) ;
6. `dupliquer` crée « Copie de X », et une seconde duplication ne collisionne pas ;
7. `renommer` vers un nom déjà pris ne détruit pas l'autre ;
8. `supprimer` retire, et supprimer un nom absent ne lève pas ;
9. **un dépôt dont le contenu est illisible** (JSON invalide, ou une enveloppe d'une
   version inconnue) rend une liste vide au lieu de lever — un stockage corrompu ne doit
   pas empêcher d'ouvrir le simulateur ;
10. **un dépôt dont `ecrire` lève** (quota, navigation privée stricte) ne fait pas échouer
    l'appel : la liste rendue reflète l'opération, la persistance seule est perdue. Le
    test doit vérifier qu'aucune exception ne sort du module.

L'enveloppe stockée porte une version (`{ v: 1, scenarios: [...] }`) : sans elle, un
changement de forme ultérieur casserait silencieusement les scénarios déjà enregistrés.

- [ ] **Step 2: Lancer les tests, les voir échouer**

Run: `cd site && node --experimental-strip-types --test src/scenarios.test.ts`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Écrire le module**

Pur, sans DOM. Docstring de tête en français disant pourquoi le dépôt est injecté et
pourquoi l'enveloppe est versionnée. Chaque fonction rend la **nouvelle liste**, ce qui
rend l'appelant trivial et le module testable sans état caché.

- [ ] **Step 4: Vérifier**

Run: `cd site && npm test` — 0 échec. `npx tsc --noEmit` — silencieux.

- [ ] **Step 5: Commit**

```bash
git add site/src/scenarios.ts site/src/scenarios.test.ts
git commit -m "Add the scenario lifecycle, with its storage injected

A scenario is the simulator's encoded state plus a name, a date and the
vintage it was built on. The module knows neither the document nor
localStorage — it takes a depot — which is what lets it be tested without a
browser. Unreadable storage yields an empty list rather than throwing, and a
depot whose write fails costs persistence, not the page."
```

---

### Task 2: `comparaison.ts`, l'alignement de deux états

**Files:**
- Create: `site/src/comparaison.ts`, `site/src/comparaison.test.ts`

**Interfaces:**
- Consumes: de `atelier.ts` — `plan(volets, etat): LigneAtelier[]`, `effort(volets, etat)`,
  `gestes(volets, etat)`, `decoder(chaine, volets)`, les types `Volet` et `EtatAtelier`.
  **Ne rien réimplémenter de ce qui est là.**
- Produces:
  - `export type Colonne = { nom: string; etat: EtatAtelier; effort: number; gestes: number }`
  - `export type LigneComparee = { volet: string; code: string; libelle: string; base: number; cellules: (number | null)[] }`
    — `cellules[i]` est l'écart en euros de la colonne *i*, ou `null` si cette colonne ne
    touche pas la ligne.
  - `export function comparer(volets: readonly Volet[], colonnes: Colonne[]): LigneComparee[]`

- [ ] **Step 1: Écrire les tests qui échouent**

Couvrir :

1. deux colonnes qui règlent la même ligne : une seule ligne comparée, deux cellules
   non nulles ;
2. une ligne réglée par une seule colonne : l'autre cellule vaut `null` — **et pas
   zéro** : « non touché » et « touché à zéro » ne sont pas la même décision, et un
   tableau qui les confond ment ;
3. l'alignement se fait sur la paire `(volet, code)`, pas sur le libellé : deux volets
   emploient les mêmes codes (`D-PRE` existe dans chaque branche) et un index par code
   seul les confondrait ;
4. le tri est par **écart absolu décroissant**, tous volets confondus ;
5. une colonne sans aucun réglage produit une liste vide plutôt que de lever ;
6. la référence — l'état neutre — n'ajoute aucune ligne à elle seule ;
7. `effort` et `gestes` de chaque colonne viennent d'`atelier.ts`, pas d'un calcul
   parallèle : le test compare à un appel direct de ces fonctions.

- [ ] **Step 2: Voir les tests échouer, puis écrire le module**

Le module ne rend aucun HTML et ne formate aucun montant : il aligne, il ordonne, il
rend des nombres. Le formatage est le travail de la tâche 3.

- [ ] **Step 3: Vérifier et commiter**

Run: `cd site && npm test && npx tsc --noEmit`

```bash
git add site/src/comparaison.ts site/src/comparaison.test.ts
git commit -m "Align two simulator states into comparable lines

Alignment is on the (volet, code) pair, never the label: the same codes recur
across volets — D-PRE exists in every branch — and a code-only index would
merge them. A line one column never touched holds null rather than zero,
because 'untouched' and 'set to zero' are different decisions and a table
that conflates them lies."
```

---

### Task 3: `scenarios-rendu.ts`, la barre et le tableau

**Files:**
- Create: `site/src/scenarios-rendu.ts`, `site/src/scenarios-rendu.test.ts`
- Modify: `site/src/style.css`

**Interfaces:**
- Consumes: `Scenario` de `scenarios.ts` ; `LigneComparee` et `Colonne` de
  `comparaison.ts` ; `formater` de `echelle.ts` ; `echapper` de `texte.ts`.
- Produces: `renduBarre(scenarios, courant): string` et
  `renduComparaison(colonnes, lignes): string`.

- [ ] **Step 1: Écrire les tests qui échouent**

Couvrir :

1. la barre liste les scénarios, le courant marqué ;
2. **un nom est échappé** — un scénario nommé `<script>` ne produit pas de balise ;
3. la barre sans scénario invite à enregistrer plutôt que d'afficher une liste vide ;
4. le tableau porte une colonne par comparable, avec en tête le nom, l'effort et le
   nombre de gestes ;
5. **une cellule `null` se distingue à l'écran d'un écart nul** — texte différent, et le
   test l'exige explicitement ;
6. les montants passent par `formater` : l'attendu se calcule **en appelant `formater`** ;
7. la légende du tableau dit l'unité — « Montants en millions d'euros » — comme
   `exercices.ts` et la page d'analyse ;
8. **aucun total de dépense n'est écrit** : le module n'émet jamais la somme de deux
   colonnes ; verrouiller par une assertion sur le source du module ;
9. **aucun gagnant** : le module n'émet ni « meilleur », ni « pire », ni note, ni rang ;
   assertion sur le source également ;
10. deux scénarios construits sur des exercices différents le disent en tête du tableau.

- [ ] **Step 2: Écrire le module et son habillage**

Fonctions pures rendant des chaînes, sur le modèle de `analyse-rendu.ts`. Pour le CSS :
suivre `.analyse-rendu__*`, jetons de design existants uniquement, jamais une couleur ou
un espacement en dur — les tests d'architecture le vérifient.

- [ ] **Step 3: Vérifier et commiter**

```bash
git add site/src/scenarios-rendu.ts site/src/scenarios-rendu.test.ts site/src/style.css
git commit -m "Render the scenario bar and the comparison table

A cell no column touched reads differently from a cell set to zero. The table
states its unit in the caption, names no winner, and never writes the sum of
two columns — the budgets it shows do not add up, and only the gaps do."
```

---

### Task 4: Le montage, l'adresse, la route

**Files:**
- Modify: `site/index.html` (conteneur `#scenarios`), `site/src/main.ts`,
  `site/src/routes.ts` *(si la route l'exige — voir ci-dessous)*, `site/src/interface.test.ts`

**Interfaces:**
- Consumes: les trois modules précédents ; `afficherAtelier` **inchangé** — recharger un
  scénario est un ré-appel, la fonction est déjà ré-entrante (`montage?.abort()`).
- Produces: les paramètres d'URL `nom`, `face`, `face-nom`, lus et écrits comme
  `budget` et `contrat` le sont déjà dans `lireUrl`/`ecrireUrl`.

**Le point à trancher.** `routes.ts` résout par **premier segment**, donc
`/simulateur/comparer` rend déjà `simulateur`. Décider si la comparaison est une vue
distincte ou un mode de la vue simulateur, l'implémenter, et dire pourquoi dans le
rapport. Le plus simple — un mode, commandé par la présence de `face` dans l'adresse —
évite une entrée de menu pour un écran qui n'a de sens qu'avec deux scénarios en main.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `interface.test.ts` : le conteneur `#scenarios` existe et précède `#simu` ;
`lireUrl` lit `nom`, `face`, `face-nom` ; `ecrireUrl` les écrit quand ils sont non vides ;
recharger un scénario passe par un ré-appel d'`afficherAtelier` et **non** par une
modification d'`atelier.ts`.

- [ ] **Step 2: Brancher**

Monter la barre dans `#scenarios` à l'ouverture du simulateur ; le dépôt réel enveloppe
`localStorage` dans un `try`/`catch`, comme le thème (`main.ts`), et l'échec dégrade en
scénarios de session — l'interface le dit.

- [ ] **Step 3: Vérifier de bout en bout**

Run: `cd site && npm test && npx tsc --noEmit && npm run build`

Puis, en lisant le code, tracer et consigner : ouvrir `/simulateur`, régler, enregistrer,
recharger la page, retrouver le scénario ; ouvrir un lien portant `face` et voir deux
colonnes ; supprimer et constater que l'adresse ne porte plus le scénario supprimé.

- [ ] **Step 4: Commit**

```bash
git add site/index.html site/src/main.ts site/src/interface.test.ts
git commit -m "Mount the scenario bar and read a comparison from the address

Reloading a scenario is a re-call of afficherAtelier, which is already
re-entrant — the engine does not change. localStorage is wrapped the way the
theme wraps it: when it is unavailable the scenarios last the session and the
interface says so, rather than the page breaking."
```

---

### Task 5: La transposition sur l'exercice courant

Un scénario enregistré sur un exercice révolu doit se rejouer sur l'exercice courant :
les réglages sont des **coefficients**, donc ils se transposent. Ce qui ne se transpose
pas, ce sont les lignes disparues de la nomenclature — et elles doivent être **dites**,
jamais perdues en silence.

**Files:**
- Modify: `site/src/scenarios.ts`, `site/src/scenarios-rendu.ts`, et leurs tests

**Interfaces:**
- Produces: `transposer(scenario, volets): { etat: EtatAtelier; disparues: string[] }`

- [ ] **Step 1: Écrire les tests qui échouent**

1. un scénario dont toutes les lignes existent encore se transpose sans perte, et
   `disparues` est vide ;
2. une ligne absente de la nomenclature courante **figure dans `disparues`** avec son
   code, et n'entre pas dans l'état ;
3. le rendu affiche la liste des lignes disparues quand elle n'est pas vide — assertion
   sur la sortie, pas sur le source ;
4. un scénario dont **toutes** les lignes ont disparu se charge quand même, en disant que
   rien n'a pu être repris : la page ne doit pas rester muette.

- [ ] **Step 2: Implémenter, vérifier, commiter**

```bash
git commit -m "Replay a scenario built on a past exercise

The adjustments are coefficients, so they transpose. What does not transpose
is a line the nomenclature has dropped, and those are listed on screen rather
than silently discarded — a scenario that quietly loses half its decisions is
worse than one that refuses to load."
```

---

### Task 6: Les scénarios de référence

La troisième nature de comparable : le budget voté, et les chiffrages issus des analyses.
C'est ce qui referme la boucle entre l'éditorial et l'outil.

**Écart de spec assumé, à consigner dans le rapport.** La spec §15.4 dit « le pipeline
publie » ce fichier, mais §7.4 pose que les analyses suivent leur flux propre et
**n'entrent jamais dans l'entrepôt**. Les deux ne peuvent pas tenir ensemble : les
chiffrages viennent des analyses. Le fichier est donc produit au build, dans
`prerendre.ts`, à partir des analyses **déjà contrôlées** — même flux, même garantie, et
le pipeline n'a pas à connaître un objet éditorial. Si l'utilisateur préfère l'autre
lecture, c'est un changement de spec, pas de code.

**Files:**
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/src/main.ts` (charger le fichier comme comparable)

- [ ] **Step 1: Produire le fichier**

`dist/simulateur/scenarios-reference.json` : une entrée neutre — le budget voté, tous
réglages à zéro, donc `budget: ""` — plus une entrée par analyse dont `simulateur.budget`
est non vide, portant le titre de l'analyse, son slug et son lien.

**Ne rien inventer** : une analyse sans réglage n'engendre pas d'entrée. Le fichier peut
ne contenir que l'entrée neutre, et c'est un état valide.

- [ ] **Step 2: L'offrir à la comparaison**

Le charger à l'ouverture du simulateur ; ses entrées apparaissent parmi les comparables,
distinguées de celles du lecteur. Un fichier absent ne casse rien — même règle que
partout ailleurs sur le site.

- [ ] **Step 3: Vérifier et commiter**

Vérifier sur l'artefact construit que le fichier existe et que son entrée neutre porte un
budget vide. Puis :

```bash
git commit -m "Publish the reference scenarios the comparison compares against

The voted budget as the neutral state, and one entry per analysis that carries
a simulator setting — which is what closes the loop between the editorial layer
and the tool. Generated at build time from the already-controlled analyses
rather than by the pipeline: the analyses never enter the warehouse, so the
warehouse has no business knowing about them."
```

---

## Vérification du lot

```bash
cd site && npm test && npx tsc --noEmit && npx tsc -p tsconfig.scripts.json --noEmit && npm run build
cd pipeline && python -m pytest -q && ruff check plateforme/ tests/
cd /home/user/500SIGNATURESV2 && python -m plateforme.controle_analyses site/analyses
```

Attendu : aucun échec, build réussi, contrôle en sortie 0 — le lot ne touche pas au
pipeline, ses suites doivent rester exactement où le lot 1 les a laissées.

| Vérification | Attendu |
|---|---|
| Un scénario enregistré survit à un rechargement | le dépôt fonctionne |
| Un lien portant `face` ouvre deux colonnes | la comparaison est partageable |
| Une ligne touchée par une seule colonne se distingue d'un écart nul | le tableau ne ment pas |
| Aucune vue n'écrit un total de dépense publique | les budgets ne s'additionnent pas |
| `dist/simulateur/scenarios-reference.json` existe | la boucle éditorial ↔ outil est fermée |
| `localStorage` refusé : la page tient et le dit | dégradation annoncée |

## Ce que ce lot ne fait pas

Pas de carte sociale ni d'image de partage — c'est le lot 3, qui prendra la vignette de
comparaison décrite en spec §13. Pas de compte, pas de serveur, pas de galerie publique
de scénarios : la décision D8 reste reportée. Et la balise `noindex` reste en place
jusqu'au lot 4.
