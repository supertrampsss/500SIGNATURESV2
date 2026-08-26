# Verdict France Editorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer `/bilan` en analyse éditoriale mobile-first qui affiche d’abord le verdict, rend le calcul et les explications visibles, compare la France dans le temps et en Europe, déporte la méthode vers une page dédiée et retire le briefing territorial redondant.

**Architecture:** Conserver les renderers de données existants, qui sont déjà pré-rendus et alimentés par les séries publiées, mais remplacer leur orchestration par un récit éditorial. `national.ts` produit le verdict et les introductions de chapitres ; `index.html` fixe leur ordre et montre directement les blocs analytiques ; `bilan-guide.css` porte la nouvelle hiérarchie. La page `/sources/` devient la page dédiée « Sources et méthode » en combinant méthode et registre sans réintroduire ces contenus dans `/bilan`.

**Tech Stack:** TypeScript, HTML pré-rendu, CSS natif, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-08-26-verdict-france-editorial-design.md`

## Global Constraints

- Mobile-first à 390 px, sans débordement horizontal ni interaction dépendante du survol.
- Le verdict, son millésime, sa signification et l’équation sont visibles sans clic.
- Les calculs et séries publiés restent la source de vérité ; aucun chiffre n’est écrit en dur dans le rendu de production.
- Les explications principales restent visibles ; seuls les détails de méthode vivent sur la page dédiée.
- Les comparaisons européennes utilisent les mêmes séries Eurostat et le même exercice par colonne.
- Le briefing territorial supérieur redondant disparaît sans supprimer les données détaillées de la fiche.
- Chaque lot suit le cycle test rouge, implémentation minimale, test vert, puis commit.

---

### Task 1: Verdict éditorial et calcul visible

**Files:**
- Modify: `site/src/national.test.ts`
- Modify: `site/src/national.ts`

**Interfaces:**
- Consumes: `chiffres(france: Territoire | undefined): Ouverture | null`, `equationFrance(recettes, depenses)` et l’index de sources existant.
- Produces: `renduConclusionsBilan(pays, indexSources): ConclusionsBilan`, avec `verdict` comme hero éditorial et les trois autres valeurs comme introductions analytiques.

- [ ] **Step 1: Write the failing test**

Ajouter un test qui vérifie que `verdict` contient le millésime calculé, une phrase de type « dépense 152,51 milliards d’euros de plus qu’elle n’encaisse », le montant du solde, l’équation Recettes/Dépenses/Solde, et un lien « Sources et méthode » ; vérifier aussi l’absence de « Comprendre le calcul » et des anciennes barres de progression.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/national.test.ts`

Expected: FAIL parce que le rendu actuel commence par « Quel verdict raisonnable ? » et masque encore la preuve derrière « Comprendre le calcul ».

- [ ] **Step 3: Write minimal implementation**

Remplacer les quatre cartes récapitulatives par :

```ts
return {
  verdict: renduVerdict(ouverture, dettePib, deficitPib, indexSources),
  entrees: introduction("D'où vient l'argent ?", analyseRecettes, sourceRecettes),
  sorties: introduction("Où part-il ?", analyseDepenses, sourceDepenses),
  dette: introduction("Pourquoi la dette monte-t-elle ?", analyseDette, sourceDette),
};
```

Le hero calcule tous ses nombres depuis `chiffresOuverture` et `equationFrance`. La référence courte pointe vers `/sources/` ou vers l’ancre déterministe existante.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/national.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/national.ts site/src/national.test.ts
git commit -m "Refond le verdict editorial du bilan France"
```

### Task 2: Parcours d’analyse ouvert et comparaison européenne stable

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/interface.test.ts`
- Modify: `site/src/europe-comparaison.test.ts`
- Modify: `site/src/europe-comparaison.ts`
- Modify: `site/src/styles/bilan-guide.css`

**Interfaces:**
- Consumes: les quatre fragments `ConclusionsBilan` et les renderers existants `ouverture`, `recettes-etat`, `cent-euros-apu`, `fonctions`, `redistribution`, `secu`, `tenable`, `europe-comparaison`.
- Produces: un DOM `/bilan` ordonné verdict → navigation → recettes → dépenses → dette → Europe → simulateur, sans `<details class="bilan-details">`.

- [ ] **Step 1: Write the failing tests**

Dans `interface.test.ts`, vérifier que `conclusion-france-verdict` précède les autres chapitres, qu’aucun `summary` « Comprendre le calcul » ne subsiste et que les blocs analytiques sont directement descendants des sections. Dans `europe-comparaison.test.ts`, vérifier la présence de France, Allemagne, Belgique, Luxembourg, Espagne, Italie, Union européenne et zone euro quand leurs séries existent.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/interface.test.ts src/europe-comparaison.test.ts`

Expected: FAIL sur l’ordre du verdict, les accordéons et les repères européens manquants.

- [ ] **Step 3: Write minimal implementation**

Réordonner les sections dans `index.html`, retirer les accordéons et garder les blocs directement visibles. Stabiliser la sélection européenne dans `europe-comparaison.ts` sur `EU27_2020`, `EA20`, `FR`, `DE`, `BE`, `LU`, `ES`, `IT`. Refaire `bilan-guide.css` en mise en page éditoriale : largeur de lecture, hero, équation, chapitres espacés, blocs sans ombre ni multiplication de cadres, tableaux mobiles défilables.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/interface.test.ts src/europe-comparaison.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/index.html site/src/interface.test.ts site/src/europe-comparaison.ts site/src/europe-comparaison.test.ts site/src/styles/bilan-guide.css
git commit -m "Ouvre le parcours d analyse du bilan"
```

### Task 3: Page dédiée « Sources et méthode »

**Files:**
- Modify: `site/src/methode-rendu.test.ts`
- Modify: `site/src/methode-rendu.ts`
- Modify: `site/scripts/prerendre.test.ts`
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/src/accueil.test.ts`
- Modify: `site/src/accueil.ts`
- Modify: `site/src/styles/registre-sources.css`

**Interfaces:**
- Consumes: `renduSources`, `renduMethode`, `renduGrille`, `renduRegistre` et les fiches construites au build.
- Produces: `renduSourcesEtMethode(jeux, fiches): string`, page autonome pré-rendue à `/sources/`, et liens internes qui n’envoient plus vers `/bilan#methode-sources`.

- [ ] **Step 1: Write the failing tests**

Vérifier que la page `/sources/` annonce « Sources et méthode », contient la méthode avant le registre, conserve les ancres de chaque fiche, et que le bilan ne contient plus `methode-sources`. Vérifier que les liens de confiance de l’accueil pointent vers `/sources/`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/methode-rendu.test.ts src/accueil.test.ts scripts/prerendre.test.ts`

Expected: FAIL parce que la méthode n’est pas rendue dans `/sources/` et que l’ancien pied de bilan subsiste.

- [ ] **Step 3: Write minimal implementation**

Composer la page :

```ts
export function renduSourcesEtMethode(jeux: readonly Jeu[], fiches: readonly FicheSource[]): string {
  return `<main class="sources-methode">
    <header class="sources-methode__entete">
      <p class="sources-methode__eyebrow">Transparence</p>
      <h1>Sources et méthode</h1>
      <p>Retrouvez l’origine des chiffres, leurs définitions et les contrôles appliqués.</p>
    </header>
    <section id="methode">${renduMethode()}${renduGrille()}</section>
    ${renduRegistre(fiches)}
  </main>`;
}
```

Utiliser cette fonction dans `injecterRegistre`, renommer les métadonnées de page, retirer l’attribution de `/bilan` et remplacer les liens historiques de l’accueil.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/methode-rendu.test.ts src/accueil.test.ts scripts/prerendre.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/methode-rendu.ts site/src/methode-rendu.test.ts site/scripts/prerendre.ts site/scripts/prerendre.test.ts site/src/accueil.ts site/src/accueil.test.ts site/src/styles/registre-sources.css
git commit -m "Dedie une page aux sources et a la methode"
```

### Task 4: Suppression du briefing territorial supérieur

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/interface.test.ts`
- Modify: `site/src/main.ts`
- Modify: `site/src/style.css`

**Interfaces:**
- Consumes: la navigation thématique territoriale, la carte repliable et la fiche détaillée existantes.
- Produces: une page territoriale qui commence par ses commandes d’analyse, sans `#briefing-territorial` ni appel à `renduBriefing`.

- [ ] **Step 1: Write the failing test**

Remplacer le test qui exige le briefing par un test vérifiant son absence du gabarit et de l’orchestration, tout en conservant les cinq thèmes et la commande « Voir sur la carte ».

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/interface.test.ts`

Expected: FAIL parce que le cadre et `monterBriefingTerritorial` existent encore.

- [ ] **Step 3: Write minimal implementation**

Retirer le cadre de `index.html`, les imports et l’appel de montage dans `main.ts`, puis retirer l’import CSS devenu inutile de `style.css`. Conserver `briefing-territorial.ts` si ses fonctions de navigation thématique restent consommées.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/interface.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/index.html site/src/interface.test.ts site/src/main.ts site/src/style.css
git commit -m "Retire le briefing territorial redondant"
```

### Task 5: Pré-rendu, régression et conformité visuelle

**Files:**
- Modify: `docs/superpowers/specs/2026-08-26-verdict-france-editorial-design.md`
- Modify: `docs/superpowers/plans/2026-08-26-verdict-france-editorial-implementation.md`

**Interfaces:**
- Consumes: le site construit et servi localement.
- Produces: preuves de build, tests, contrôle visuel desktop/mobile et spécification alignée sur l’URL réelle `/sources/`.

- [x] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: toutes les suites PASS, zéro échec.

- [x] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: TypeScript, Vite et pré-rendu terminent avec le code 0 ; `dist/bilan/index.html` et `dist/sources/index.html` existent.

- [x] **Step 3: Verify desktop rendering**

Servir `dist`, ouvrir `/bilan`, comparer visuellement au mockup 01 et vérifier à 1440 × 900 : verdict en premier, calcul visible, chapitres ouverts, historique et Europe lisibles, aucune méthode dans le flux.

Preuve durable : [rapport de vérification visuelle](../../verification/2026-08-26-verdict-france/verification-report.md#bilan--desktop-1440--900).

- [x] **Step 4: Verify mobile rendering**

Vérifier `/bilan`, `/sources/` et une URL `/territoire?...` à 390 × 844 : aucun débordement horizontal, aucun texte tronqué, sources accessibles, briefing absent et actions tactiles.

Preuve durable : [rapport de vérification visuelle](../../verification/2026-08-26-verdict-france/verification-report.md#mobile--sources--territoire-390--844).

- [x] **Step 5: Update documentation and commit**

Cocher les tâches réellement vérifiées, aligner la spec sur l’URL `/sources/`, puis :

```bash
git add docs/superpowers/specs/2026-08-26-verdict-france-editorial-design.md docs/superpowers/plans/2026-08-26-verdict-france-editorial-implementation.md
git commit -m "Documente la refonte editoriale du bilan"
```
