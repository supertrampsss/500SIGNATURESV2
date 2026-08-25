# Lot 3 — Preuve et sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer les dossiers de vérification et un registre de sources consultable, traçable et pré-rendu.

**Architecture:** Étendre le rendu pur des analyses sans casser les quatre JSON publiés, dériver les six verdicts éditoriaux depuis le contrat existant, puis agréger analyses, indicateurs et manifeste dans un nouveau registre de sources statique. Le pré-rendu écrit `/analyses/`, chaque dossier et `/sources/`.

**Tech Stack:** TypeScript 5.9, Vite 7, HTML/CSS natifs, JSON éditorial, tests `node:test`, pré-rendu Node.

**Spec:** `docs/superpowers/specs/2026-08-25-refonte-interface-site-design.md`

## Global Constraints

- Une analyse donne son verdict en dix secondes puis expose son chemin de preuve.
- Un verdict n’est pas réduit à vrai/faux lorsque l’écart porte sur le périmètre, l’année ou l’interprétation.
- L’index montre affirmation, nombre publié, verdict, sujet, date, périmètre et fraîcheur avant le clic.
- Toute source pointe vers une publication primaire identifiable.
- Le registre distingue publié, provisoire, estimation et règle de jeu.
- Les quatre analyses JSON existantes restent valides sans migration obligatoire.
- `/analyses/<slug>/` et les anciennes URLs restent stables.
- Les pages pré-rendues conservent canonical, métadonnées sociales, sitemap et robots.

---

### Task 1: Qualification éditoriale stable des verdicts

**Files:**
- Modify: `site/src/analyse-rendu.ts`
- Modify: `site/src/analyse-rendu.test.ts`

**Interfaces:**
- Consumes: `Analyse`, `verdict.cran`, `verdict.confusion`, chiffres observés.
- Produces:

```ts
export type QualificationVerdict =
  | "confirme" | "ordre_grandeur" | "contexte_manquant"
  | "perimetre_trompeur" | "non_demontre" | "contredit";
export function qualificationVerdict(analyse: Analyse): QualificationVerdict;
export const LIBELLE_QUALIFICATION: Record<QualificationVerdict, string>;
```

- [ ] **Step 1: Write the mapping tests**

```ts
test("la qualification distingue exactitude, périmètre et absence de preuve", () => {
  assert.equal(qualificationVerdict(analyseMinimale({ verdict: { cran: "exact", phrase: "Exact." } })), "confirme");
  assert.equal(qualificationVerdict(DEFENSE), "perimetre_trompeur");
  assert.equal(qualificationVerdict(analyseMinimale({ verdict: { cran: "introuvable", phrase: "Absent." } })), "non_demontre");
  assert.equal(LIBELLE_QUALIFICATION.perimetre_trompeur, "Périmètre trompeur");
});
```

- [ ] **Step 2: Run the focused test**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="qualification distingue" src/analyse-rendu.test.ts`  
Expected: FAIL on missing exports.

- [ ] **Step 3: Implement exhaustive mapping**

Mapper `exact` vers `confirme`, `introuvable` vers `non_demontre`, les confusions de périmètre/exercice/nature vers leur qualification précise. Employer une garde `assertNever` pour toute nouvelle confusion non couverte. Ne pas modifier le JSON source.

- [ ] **Step 4: Run all analysis tests**

Run: `cd site; node --experimental-strip-types --test src/analyse-rendu.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add site/src/analyse-rendu.ts site/src/analyse-rendu.test.ts
git commit -m "Qualifie les verdicts éditoriaux"
```

### Task 2: Index en dossiers de vérification

**Files:**
- Modify: `site/src/analyse-rendu.ts`
- Modify: `site/src/analyse-rendu.test.ts`
- Modify: `site/src/main.ts`
- Create: `site/src/styles/dossiers-verification.css`

**Interfaces:**
- Conserve: `renduIndex`, `filtrerAnalyses`, `brancherFiltresAnalyses`.
- Produit: cartes `.dossier-index` avec `data-theme`, `data-verdict`, `data-perimetre`, `data-texte` pour les filtres existants.

- [ ] **Step 1: Write the card-content test**

```ts
test("une carte d'index donne affirmation chiffre verdict et fraîcheur", () => {
  const html = renduIndex([DEFENSE], CATALOGUE);
  assert.match(html, /dossier-index__affirmation/);
  assert.match(html, /dossier-index__chiffre/);
  assert.match(html, /dossier-index__verdict/);
  assert.match(html, /dossier-index__fraicheur/);
  assert.match(html, /data-theme=/);
});
```

- [ ] **Step 2: Run the focused test**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="carte d'index" src/analyse-rendu.test.ts`  
Expected: FAIL on new structure.

- [ ] **Step 3: Rework `carteDeLAnalyse` and `renduIndex`**

Rendre affirmation, premier chiffre observé formaté, libellé de qualification, thèmes, date, périmètre et badge de mise à jour. Conserver les attributs nécessaires au filtre et un lien unique couvrant le titre.

- [ ] **Step 4: Make secondary filters a mobile drawer**

Dans `main.ts`, ajouter un bouton `aria-expanded` qui contrôle le conteneur existant `.analyses-filtres`. À partir de 60rem, afficher les filtres sans bouton. Décrire l’état vide avec un bouton « Effacer les filtres ».

- [ ] **Step 5: Run analysis and interface tests**

Run: `cd site; node --experimental-strip-types --test src/analyse-rendu.test.ts src/interface.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add site/src/analyse-rendu.ts site/src/analyse-rendu.test.ts site/src/main.ts site/src/styles/dossiers-verification.css
git commit -m "Transforme les analyses en dossiers de vérification"
```

### Task 3: Page d’analyse en dossier de preuve

**Files:**
- Modify: `site/src/analyse-rendu.ts`
- Modify: `site/src/analyse-rendu.test.ts`
- Modify: `site/src/styles/dossiers-verification.css`
- Modify: `site/scripts/prerendre.test.ts`

**Interfaces:**
- Conserve: `rendu(analyse, catalogue): string`, liens de citation et simulation.
- Produit: sections `.dossier-preuve__verdict`, `__confrontation`, `__chemin`, `__donnees`, `__limites`, `__sources`.

- [ ] **Step 1: Write the ordered-proof test**

```ts
test("le dossier place verdict confrontation et preuve dans cet ordre", () => {
  const html = rendu(DEFENSE, CATALOGUE);
  const classes = ["verdict", "confrontation", "chemin", "donnees", "limites", "sources"];
  const positions = classes.map((nom) => html.indexOf(`dossier-preuve__${nom}`));
  assert.ok(positions.every((position, i) => position > -1 && (!i || position > positions[i - 1]!)));
});
```

- [ ] **Step 2: Run the test**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="dossier place" src/analyse-rendu.test.ts`  
Expected: FAIL on new class structure.

- [ ] **Step 3: Recompose the renderer**

Utiliser les données existantes : affirmation dans Confrontation, `verdict` et qualification dans Verdict, `chiffres` dans Données, `hypotheses` et `effets_indirects` dans Limites, `sources` dans Sources. Construire le chemin de preuve avec trois étapes minimales : indicateur, périmètre, millésime. Garder le tableau accessible et son unité.

- [ ] **Step 4: Keep citation, canonical and OG behavior intact**

Ne modifier ni slug ni route. Ajouter au test de pré-rendu une assertion que la nouvelle classe apparaît dans `dist/analyses/<slug>/index.html` et que canonical/OG sont inchangés.

- [ ] **Step 5: Run analysis and prerender tests**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="analyse|dossier" src/analyse-rendu.test.ts scripts/prerendre.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add site/src/analyse-rendu.ts site/src/analyse-rendu.test.ts site/src/styles/dossiers-verification.css site/scripts/prerendre.test.ts
git commit -m "Hiérarchise les dossiers de preuve"
```

### Task 4: Modèle du registre des sources

**Files:**
- Create: `site/src/registre-sources.ts`
- Create: `site/src/registre-sources.test.ts`

**Interfaces:**
- Consumes: `Jeu[]`, `Indicateur[]`, `Analyse[]`.
- Produces:

```ts
export type StatutSource = "publie" | "provisoire" | "estimation" | "regle_jeu";
export type FicheSource = {
  id: string; nom: string; statut: StatutSource; institution: string;
  url: string; serie?: string; millesime?: string; perimetre?: string;
  unite?: string; transformation?: string; formule?: string;
  verifieLe?: string; pages: string[];
};
export function construireRegistre(entree: {
  jeux: readonly Jeu[]; indicateurs: readonly Indicateur[]; analyses: readonly Analyse[];
}): FicheSource[];
export function filtrerRegistre(fiches: readonly FicheSource[], requete: string, statut?: StatutSource): FicheSource[];
```

- [ ] **Step 1: Write provenance and deduplication tests**

```ts
test("le registre fusionne une source primaire et liste ses pages", () => {
  const jeu = { id: "insee", titre: "Comptes nationaux", producteur: "Insee", licence: "Licence Ouverte", url: "https://insee.fr/source", extraction: "2026-08-20" };
  const indicateur = { id: "deficit", libelle: "Déficit public", unite: "EUR", jeu: "insee", periodes: ["2025"], formule: "recettes - dépenses" } as Indicateur;
  const analyse = { slug: "test", sources: [{ titre: "Comptes nationaux", url: "https://insee.fr/source#tableau", consulte_le: "2026-08-21" }], chiffres: [] } as unknown as Analyse;
  const fiches = construireRegistre({ jeux: [jeu], indicateurs: [indicateur], analyses: [analyse] });
  const insee = fiches.find((fiche) => fiche.url === "https://insee.fr/source");
  assert.ok(insee);
  assert.equal(insee.institution, "Insee");
  assert.deepEqual(insee.pages.sort(), ["/analyses/test/", "/bilan"]);
});
```

- [ ] **Step 2: Run the test**

Run: `cd site; node --experimental-strip-types --test src/registre-sources.test.ts`  
Expected: FAIL because module is absent.

- [ ] **Step 3: Implement deterministic source aggregation**

Normaliser les URLs sans fragment pour dédupliquer, trier par nom puis millésime, conserver la publication primaire, et attribuer `estimation`/`regle_jeu` aux mesures du simulateur qui ne proviennent pas d’un indicateur publié. Ne jamais fabriquer une formule absente : laisser le champ omis.

- [ ] **Step 4: Implement accent-insensitive filtering**

Normaliser avec `normalize("NFD").replace(/\p{Diacritic}/gu, "")`, puis filtrer nom, institution, série et périmètre. Ajouter les tests « déficit »/« deficit » et statut.

- [ ] **Step 5: Run tests**

Run: `cd site; node --experimental-strip-types --test src/registre-sources.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add site/src/registre-sources.ts site/src/registre-sources.test.ts
git commit -m "Construit le registre des sources"
```

### Task 5: Pré-rendre `/sources/`

**Files:**
- Modify: `site/scripts/prerendre.ts`
- Modify: `site/scripts/prerendre.test.ts`
- Modify: `site/src/methode-rendu.ts`
- Modify: `site/src/methode-rendu.test.ts`
- Modify: `site/index.html`
- Create: `site/src/styles/registre-sources.css`
- Modify: `site/src/main.ts`

**Interfaces:**
- Consumes: `construireRegistre`, manifeste/catalogue/analyses déjà chargés par le pré-rendu.
- Produces: `renduRegistre(fiches: readonly FicheSource[]): string`, document `/sources/index.html`, entrée sitemap `/sources/`.

- [ ] **Step 1: Write failing render and build tests**

```ts
test("le registre rend recherche filtres et fiches normalisées", () => {
  const html = renduRegistre([{
    id: "insee-deficit-2025", nom: "Déficit public 2025", statut: "publie",
    institution: "Insee", url: "https://insee.fr/source", serie: "deficit",
    millesime: "2025", perimetre: "Administrations publiques", unite: "EUR",
    formule: "recettes - dépenses", verifieLe: "2026-08-21", pages: ["/bilan"],
  }]);
  assert.match(html, /type="search"/);
  assert.match(html, /data-statut="publie"/);
  assert.match(html, /Insee/);
  assert.match(html, /Voir la publication/);
});
```

Dans `prerendre.test.ts`, attendre `sources/index.html` et `/sources/` dans le sitemap.

- [ ] **Step 2: Run focused tests**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="registre|sources" src/methode-rendu.test.ts scripts/prerendre.test.ts`  
Expected: FAIL on missing renderer/output.

- [ ] **Step 3: Implement semantic registry rendering**

Chaque fiche est un `<article>` avec statut textuel, institution, série, millésime, périmètre, unité, transformations, formule, vérification, pages utilisatrices et lien primaire. Les champs absents ne rendent pas de ligne vide.

- [ ] **Step 4: Write `/sources/` during prerender**

Ajouter une fonction `injecterRegistre(gabarit, fiches)` analogue aux injections existantes, avec title, description, canonical et OG propres. Ajouter `/sources/` au sitemap. Garder `/methode` comme alias historique vers `/bilan`.

- [ ] **Step 5: Add search/filter controller and CSS**

Brancher un contrôleur minimal sur la page pré-rendue qui filtre les articles par `data-texte` et `data-statut`, met à jour le compte et affiche un état vide. CSS : une colonne mobile, deux colonnes desktop, statuts textuels et focus visible.

- [ ] **Step 6: Run full source/prerender tests and build**

Run: `cd site; node --experimental-strip-types --test src/methode-rendu.test.ts src/registre-sources.test.ts scripts/prerendre.test.ts; npm run build`  
Expected: PASS and `dist/sources/index.html` exists.

- [ ] **Step 7: Commit**

```powershell
git add site/index.html site/src/methode-rendu.ts site/src/methode-rendu.test.ts site/src/styles/registre-sources.css site/src/main.ts site/scripts/prerendre.ts site/scripts/prerendre.test.ts
git commit -m "Publie le registre des sources"
```

### Task 6: Relier chaque chiffre à sa preuve

**Files:**
- Modify: `site/src/registre-sources.ts`
- Modify: `site/src/registre-sources.test.ts`
- Modify: `site/src/analyse-rendu.ts`
- Modify: `site/src/fiche.ts`
- Modify: `site/src/national.ts`

**Interfaces:**
- Produit: `lienSource(id: string): string` retournant `/sources/#<id-encode>`.
- Consomme: identifiants déterministes de `FicheSource`.

- [ ] **Step 1: Write the two-interaction provenance test**

```ts
test("une provenance mène à la fiche exacte du registre", () => {
  assert.equal(lienSource("insee-deficit-2025"), "/sources/#insee-deficit-2025");
  const html = rendu(analyseMinimale(), CATALOGUE);
  assert.match(html, /href="\/sources\/#source-de-test"/);
});
```

- [ ] **Step 2: Run provenance tests**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="provenance mène" src/registre-sources.test.ts src/analyse-rendu.test.ts`  
Expected: FAIL on missing exact link.

- [ ] **Step 3: Add stable source links to renderers**

Depuis les composants France, Territoires et Analyses, ajouter « Comprendre le calcul » ou « Source » vers la fiche précise. Conserver le lien primaire dans la fiche du registre ; ne pas remplacer les citations existantes.

- [ ] **Step 4: Run affected tests**

Run: `cd site; node --experimental-strip-types --test src/registre-sources.test.ts src/analyse-rendu.test.ts src/fiche.test.ts src/national.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add site/src/registre-sources.ts site/src/registre-sources.test.ts site/src/analyse-rendu.ts site/src/fiche.ts site/src/national.ts
git commit -m "Relie les chiffres à leur preuve"
```

### Task 7: Vérification globale du lot 3

**Files:**
- Modify only if verification exposes a defect in Lot 3 files.

**Interfaces:**
- Produces: Lot 3 independently deployable on top of Lots 1 and 2.

- [ ] **Step 1: Run all checks**

Run: `cd site; npm test; npm run build; git diff --check`  
Expected: all tests PASS, all static documents generated, no whitespace errors.

- [ ] **Step 2: Inspect proof journeys**

At 320, 390, 768 and 1280 CSS px, verify `/analyses/`, every `/analyses/<slug>/`, and `/sources/`. Test keyboard filtering, no-result state, deep links to a source, tables, focus, reduced motion, canonical and social metadata.

- [ ] **Step 3: Commit verification fixes**

```powershell
git add site
git commit -m "Vérifie les dossiers et le registre des sources"
```
