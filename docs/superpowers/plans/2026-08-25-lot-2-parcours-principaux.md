# Lot 2 — Parcours principaux Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l’accueil, le bilan France et la fiche territoriale en trois parcours guidés qui donnent leur conclusion avant le détail.

**Architecture:** Réutiliser les données et modules de calcul existants, ajouter trois modèles de présentation purs, puis les monter depuis `main.ts` et le pré-rendu. La carte et les tableaux restent disponibles, mais passent derrière un briefing textuel prioritaire.

**Tech Stack:** TypeScript 5.9, Vite 7, MapLibre 5, CSS natif, tests `node:test`, pré-rendu Node.

**Spec:** `docs/superpowers/specs/2026-08-25-refonte-interface-site-design.md`

## Global Constraints

- Chaque page répond d’abord à une question en une phrase et quelques chiffres.
- L’accueil présente trois portes : France, Territoires, Simuler.
- Le bilan France suit quatre questions et garde les tableaux en profondeur secondaire.
- Un territoire commence par un diagnostic, quatre chiffres maximum et deux actions.
- La carte est secondaire sur mobile et repliée derrière « Voir sur la carte ».
- Les comparaisons nomment leur groupe de pairs.
- Les anciennes URLs et le pré-rendu restent compatibles.
- Tous les graphiques conservent une conclusion textuelle et un tableau accessible.

---

### Task 1: Accueil à trois portes

**Files:**
- Modify: `site/src/accueil.ts`
- Modify: `site/src/accueil.test.ts`
- Modify: `site/src/accueil-montage.test.ts`
- Modify: `site/scripts/prerendre.test.ts`
- Create: `site/src/styles/accueil-parcours.css`
- Modify: `site/src/main.ts`

**Interfaces:**
- Conserve: `rendu(donnees: DonneesAccueil): string`, `MESSAGE_PRINCIPAL`, `exemplesTerritoires`.
- Produit: `renduPortes(): string` et classes `.accueil-portes`, `.accueil-porte--france|territoires|simuler`.

- [ ] **Step 1: Write the failing home hierarchy test**

```ts
test("l'accueil ouvre les trois parcours avant les contenus récents", () => {
  const html = rendu({ analyses: [], catalogue: [], territoires: [], alea: 0, producteurs: [] });
  const france = html.indexOf("Comprendre la France");
  const territoires = html.indexOf("Explorer mon territoire");
  const simuler = html.indexOf("Prendre les commandes");
  const actualite = html.indexOf("Analyses récentes");
  assert.ok(france > -1 && territoires > france && simuler > territoires);
  assert.ok(actualite === -1 || simuler < actualite);
  assert.match(html, /href="\/bilan"/);
  assert.match(html, /href="\/territoire"/);
  assert.match(html, /href="\/simulateur"/);
});
```

- [ ] **Step 2: Run the focused tests**

Run: `cd site; node --experimental-strip-types --test src/accueil.test.ts src/accueil-montage.test.ts`  
Expected: FAIL on missing three-door copy/order.

- [ ] **Step 3: Recompose `accueil.rendu`**

Ordre exact : promesse + recherche, trois portes, équation nationale, analyse récente, territoire contextualisé, défi simulateur, nouveautés. Réutiliser `renduVerdictDuMoment`, `renduChezVous` et `renduAnalysesRecentes`; ne pas dupliquer leurs calculs.

- [ ] **Step 4: Add responsive styling**

Créer et importer `accueil-parcours.css`. Une colonne à moins de 40rem, trois cartes à partir de 60rem, un seul CTA visuellement dominant : Simuler.

- [ ] **Step 5: Verify dynamic and prerendered home parity**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="accueil|trois parcours" src/accueil.test.ts src/accueil-montage.test.ts scripts/prerendre.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add site/src/accueil.ts site/src/accueil.test.ts site/src/accueil-montage.test.ts site/src/styles/accueil-parcours.css site/src/main.ts site/scripts/prerendre.test.ts
git commit -m "Ouvre l'accueil sur trois parcours"
```

### Task 2: Modèle pur de l’équation France

**Files:**
- Create: `site/src/bilan-guide.ts`
- Create: `site/src/bilan-guide.test.ts`
- Modify: `site/src/ouverture.ts`

**Interfaces:**
- Consumes: données déjà calculées par `ouverture.ts`.
- Produces:

```ts
export type EquationFrance = {
  recettesPour100: 100;
  depensesPour100: number;
  deficitPour100: number;
  phrase: string;
};
export function equationFrance(recettes: number, depenses: number): EquationFrance;
```

- [ ] **Step 1: Write failing arithmetic and copy tests**

```ts
test("l'équation ramène dépenses et déficit à 100 euros encaissés", () => {
  assert.deepEqual(equationFrance(1000, 1097.7), {
    recettesPour100: 100,
    depensesPour100: 109.77,
    deficitPour100: 9.77,
    phrase: "Pour 100 € encaissés, la France en dépense 109,77.",
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd site; node --experimental-strip-types --test src/bilan-guide.test.ts`  
Expected: FAIL because module is absent.

- [ ] **Step 3: Implement guarded calculation**

Retourner des nombres arrondis à deux décimales. Lever `RangeError("Les recettes doivent être strictement positives")` pour recettes `<= 0`; tester ce cas.

- [ ] **Step 4: Run the unit test**

Run: `cd site; node --experimental-strip-types --test src/bilan-guide.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add site/src/bilan-guide.ts site/src/bilan-guide.test.ts site/src/ouverture.ts
git commit -m "Modélise l'équation nationale"
```

### Task 3: Rendre le bilan France guidé

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/national.ts`
- Modify: `site/src/national.test.ts`
- Modify: `site/src/main.ts`
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/scripts/prerendre.test.ts`
- Create: `site/src/styles/bilan-guide.css`

**Interfaces:**
- Consumes: `equationFrance`, peintres existants `afficherOuverture`, `afficherRecettesEtat`, `afficherCentEurosApu`, `afficherFonctions`, `afficherRedistribution`, `afficherSecu`, `afficherTenable`, `afficherNational`.
- Produit: quatre sections `#france-entrees`, `#france-sorties`, `#france-dette`, `#france-verdict` et un sommaire court.

- [ ] **Step 1: Write failing structure tests**

```ts
test("le bilan répond à quatre questions dans l'ordre", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const ids = ["france-entrees", "france-sorties", "france-dette", "france-verdict"];
  assert.deepEqual(ids.map((id) => html.indexOf(`id="${id}"`)).every((x, i, a) => x > -1 && (!i || x > a[i - 1]!)), true);
});
```

- [ ] **Step 2: Run national and prerender tests**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="quatre questions|bilan" src/national.test.ts scripts/prerendre.test.ts`  
Expected: FAIL on new IDs.

- [ ] **Step 3: Reorder the existing painters into four questions**

Ne supprimer aucun calcul. Monter les recettes dans Entrées, fonctions/cent-euros/redistribution dans Sorties, dette/tenable dans Dette, comparaison européenne et synthèse dans Verdict. Chaque section commence par `.ui-conclusion` et place les détails dans `<details class="bilan-details">` lorsque le tableau dépasse quatre lignes.

- [ ] **Step 4: Update prerender injection**

Faire produire exactement la même hiérarchie par `scripts/prerendre.ts`. Garder `/bilan` canonique et tous les alias existants.

- [ ] **Step 5: Add guided-reading CSS and test**

Importer `bilan-guide.css`; largeur de lecture, ancrages visibles, tableaux scrollables dans leur propre cadre, pas la page. Run: `cd site; node --experimental-strip-types --test src/national.test.ts scripts/prerendre.test.ts; npm run build`  
Expected: PASS and successful build.

- [ ] **Step 6: Commit**

```powershell
git add site/index.html site/src/national.ts site/src/national.test.ts site/src/main.ts site/src/styles/bilan-guide.css site/scripts/prerendre.ts site/scripts/prerendre.test.ts
git commit -m "Guide la lecture du bilan France"
```

### Task 4: Construire le briefing territorial pur

**Files:**
- Create: `site/src/briefing-territorial.ts`
- Create: `site/src/briefing-territorial.test.ts`
- Modify: `site/src/fiche.ts`

**Interfaces:**
- Consumes: `Territoire`, catalogue d’`Indicateur`, valeurs déjà indexées, sortie de `situation` et groupe de `semblables`.
- Produces:

```ts
export type ChiffreBriefing = { id: string; libelle: string; valeur: string; comparaison?: string };
export type BriefingTerritorial = { diagnostic: string; chiffres: ChiffreBriefing[]; groupe: string };
export type EntreeBriefing = {
  territoire: Territoire;
  exercice: string;
  chiffres: readonly { id: string; libelle: string; unite: string; valeur: number; comparaison?: string }[];
  diagnostic: string;
  groupe: string;
};
export function briefingTerritorial(entree: EntreeBriefing): BriefingTerritorial;
export function renduBriefing(briefing: BriefingTerritorial, territoire: Territoire): string;
```

- [ ] **Step 1: Write the four-number limit test**

```ts
test("le briefing expose au plus quatre chiffres et nomme ses pairs", () => {
  const territoire = { nom: "Paris", parent: "75", population: 2_100_000, drapeaux: {}, series: {} };
  const briefing = briefingTerritorial({
    territoire,
    exercice: "2025",
    diagnostic: "Paris dépense davantage que les communes comparables.",
    groupe: "communes de plus de 100 000 habitants",
    chiffres: [
      { id: "ofgl_recettes_fonctionnement", libelle: "Recettes", unite: "EUR", valeur: 10_000_000_000 },
      { id: "ofgl_depenses_fonctionnement", libelle: "Dépenses", unite: "EUR", valeur: 9_000_000_000 },
      { id: "ofgl_encours_dette", libelle: "Dette", unite: "EUR", valeur: 8_000_000_000 },
      { id: "ofgl_epargne_brute", libelle: "Épargne brute", unite: "EUR", valeur: 1_000_000_000 },
      { id: "serie_secondaire", libelle: "Secondaire", unite: "EUR", valeur: 5 },
    ],
  });
  assert.ok(briefing.chiffres.length > 0 && briefing.chiffres.length <= 4);
  assert.match(briefing.diagnostic, /[.!?]$/);
  assert.ok(briefing.groupe.trim().length > 0);
});
```

- [ ] **Step 2: Run the new test**

Run: `cd site; node --experimental-strip-types --test src/briefing-territorial.test.ts`  
Expected: FAIL because module is absent.

- [ ] **Step 3: Implement deterministic priority rules**

Priorité : recettes de fonctionnement, dépenses de fonctionnement, encours de dette, épargne brute. Ignorer une série absente plutôt que d’inventer zéro. Construire le diagnostic à partir de `situation` et mentionner explicitement l’exercice.

- [ ] **Step 4: Render semantic briefing markup**

`renduBriefing` produit un `header`, une liste de quatre `dl`, la mention « Comparé aux … », puis les liens `Comparer` et `Simuler ce territoire` avec URL complète.

- [ ] **Step 5: Run test**

Run: `cd site; node --experimental-strip-types --test src/briefing-territorial.test.ts src/fiche.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add site/src/briefing-territorial.ts site/src/briefing-territorial.test.ts site/src/fiche.ts
git commit -m "Construit le briefing territorial"
```

### Task 5: Monter le briefing et rendre la carte secondaire

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/main.ts`
- Modify: `site/src/interface.test.ts`
- Create: `site/src/styles/territoire-briefing.css`

**Interfaces:**
- Consumes: `briefingTerritorial`, `renduBriefing`, carte MapLibre existante et `adresseTerritoire`.
- Produit: `#briefing-territorial`, bouton `#afficher-carte` avec `aria-expanded`, conteneur carte `#cadre-carte`.

- [ ] **Step 1: Write failing DOM contract tests**

```ts
test("le territoire place le briefing avant la carte repliable", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf('id="briefing-territorial"') < html.indexOf('id="cadre-carte"'));
  assert.match(html, /id="afficher-carte"[^>]*aria-expanded="false"/);
});
```

- [ ] **Step 2: Run the test**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="briefing avant" src/interface.test.ts`  
Expected: FAIL on missing elements.

- [ ] **Step 3: Recompose the territory view without changing map initialization**

Insérer le briefing avant `.atelier`. Entourer la carte de `#cadre-carte`; sur mobile elle est masquée jusqu’au clic, sur desktop elle est visible mais secondaire. Le bouton met à jour `hidden` et `aria-expanded`; ne détruire ni recréer la carte.

- [ ] **Step 4: Add topic navigation and detail hierarchy**

Dans la fiche, rendre les rubriques Budget, Fiscalité, Dette, Services, Trajectoire sous forme d’ancres/onglets qui déplacent le focus vers des sections existantes. Garder les tableaux et comparateurs actuels sous le briefing.

- [ ] **Step 5: Run territory regressions and build**

Run: `cd site; node --experimental-strip-types --test src/fiche.test.ts src/interface.test.ts src/routes.test.ts src/comparateur.test.ts src/semblables.test.ts; npm run build`  
Expected: PASS and successful build.

- [ ] **Step 6: Commit**

```powershell
git add site/index.html site/src/main.ts site/src/interface.test.ts site/src/styles/territoire-briefing.css
git commit -m "Place le diagnostic avant la carte"
```

### Task 6: Vérification globale du lot 2

**Files:**
- Modify only if verification exposes a defect in Lot 2 files.

**Interfaces:**
- Produces: Lot 2 independently deployable on top of Lot 1.

- [ ] **Step 1: Run all checks**

Run: `cd site; npm test; npm run build; git diff --check`  
Expected: all tests PASS and build completes.

- [ ] **Step 2: Inspect the three journeys**

At 320, 390, 768 and 1280 CSS px, verify `/`, `/bilan`, and `/territoire?niveau=commune&territoire=75056`. Confirm first-screen conclusion, no horizontal page scroll, map disclosure, keyboard focus restoration and readable tables.

- [ ] **Step 3: Commit verification fixes**

```powershell
git add site
git commit -m "Vérifie les parcours d'accueil France et territoires"
```
