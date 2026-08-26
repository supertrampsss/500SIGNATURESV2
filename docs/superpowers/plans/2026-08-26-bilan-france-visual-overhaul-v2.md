# Bilan France Visual Overhaul v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer `/bilan` en véritable couverture éditoriale conforme à la maquette 01, avec un hero composé, une équation visuelle, trois portes d'analyse et un corps narratif fini sur desktop comme sur mobile.

**Architecture:** Les renderers de données et leurs huit slots restent la frontière stable. `national.ts` produit le markup éditorial du hero et des introductions ; `index.html` compose les slots en trois chapitres ; `bilan-guide.css`, chargé après les styles historiques, possède tout le chrome et neutralise localement les cartes héritées. SPA et pré-rendu gardent exactement les mêmes renderers purs.

**Tech Stack:** TypeScript sans framework, HTML pré-rendu, CSS natif, tests Node `node:test`, Vite.

**Spec:** `docs/superpowers/specs/2026-08-26-bilan-france-visual-overhaul-v2-design.md`

## Global Constraints

- La maquette 01 est un contrat de composition, pas seulement une inspiration.
- Les valeurs, formules, millésimes et sources existants ne changent pas.
- Les IDs des huit slots de données restent uniques et identiques.
- `/bilan` comporte exactement trois portes d'analyse ; Europe est intégrée au chapitre dette.
- À 390 px : aucune largeur de page supérieure au viewport, aucune action principale sous 44 px.
- Aucun accordéon méthodologique ni interaction dépendante du survol.
- La feuille de bilan reste scoped sous `body[data-vue="bilan"]`, `#vue-bilan` ou `.bilan-*`.
- L'exécution utilise TDD, des commits fréquents et une revue après chaque tâche.

---

### Task 1: Construire le hero sémantique de la maquette 01

**Files:**
- Modify: `site/src/national.ts`
- Modify: `site/src/national.test.ts`

**Interfaces:**
- Consumes: `equationFrance(recettes, depenses)`, `montantLisible()`, `preuveDe()` et les séries déjà lues par `renduConclusionsBilan()`.
- Produces: markup `.bilan-verdict` composé de `.bilan-verdict__editorial`, `.bilan-verdict__totem`, `.bilan-equation` et `.bilan-verdict__secondaire`; introductions `.bilan-chapitre__intro` numérotées 01–03.

- [ ] **Step 1: Écrire les gardes rouges du hero**

Ajouter dans `national.test.ts` un test qui rend le fixture France et vérifie :

```ts
assert.match(html, /class="bilan-verdict__editorial"/);
assert.match(html, /class="bilan-verdict__totem"/);
assert.match(html, /Le verdict en un chiffre/);
assert.equal((html.match(/class="bilan-equation__terme"/g) ?? []).length, 3);
assert.match(html, /class="bilan-equation__signe"[^>]*>−</);
assert.match(html, /class="bilan-equation__signe"[^>]*>=</);
assert.match(html, /à financer sur l'année/);
assert.match(html, /data-numero="01"/);
assert.match(html, /data-numero="02"/);
assert.match(html, /data-numero="03"/);
```

Étendre les cas excédent et équilibre pour attendre respectivement « excédent sur l'année » et « comptes à l'équilibre ».

- [ ] **Step 2: Exécuter le test et observer l'échec**

Run:

```powershell
cd site
node --experimental-strip-types --test src/national.test.ts
```

Expected: FAIL sur les nouvelles classes et qualifications absentes.

- [ ] **Step 3: Remplacer le markup présentatif du verdict**

Dans `renduVerdict()`, produire cette structure avec les valeurs réelles :

```html
<div class="ui-conclusion bilan-verdict">
  <div class="bilan-verdict__editorial">…millesime, h2, définition…</div>
  <aside class="bilan-verdict__totem" aria-label="Verdict en un chiffre">…</aside>
  <div class="bilan-equation" aria-label="Recettes moins dépenses égale solde public">
    <div class="bilan-equation__terme">…Recettes et valeur…</div>
    <span class="bilan-equation__signe" aria-hidden="true">−</span>
    <div class="bilan-equation__terme">…Dépenses et valeur…</div>
    <span class="bilan-equation__signe" aria-hidden="true">=</span>
    <div class="bilan-equation__terme bilan-equation__terme--resultat">…Solde et valeur…</div>
  </div>
  <div class="bilan-verdict__secondaire">…phrase par 100 €, trajectoire, source…</div>
</div>
```

Modifier `introduction()` pour accepter `numero: "01" | "02" | "03"` et rendre `<div class="bilan-chapitre__intro" data-numero="…">` avec une surligne « Chapitre 01 » avant le `h2`.

- [ ] **Step 4: Vérifier les cas déficit, excédent, équilibre et données manquantes**

Run:

```powershell
cd site
node --experimental-strip-types --test src/bilan-guide.test.ts src/national.test.ts
```

Expected: PASS, aucune modification des montants ni de la phrase par 100 €.

- [ ] **Step 5: Committer**

```powershell
git add site/src/national.ts site/src/national.test.ts
git commit -m "Compose le hero editorial du bilan"
```

---

### Task 2: Réduire le shell à trois portes et trois chapitres

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/interface.test.ts`
- Modify: `site/scripts/prerendre.test.ts`

**Interfaces:**
- Consumes: les classes et introductions produites par Task 1 ; les huit IDs `bloc-*` existants.
- Produces: `.bilan-couverture__papier`, nav `.bilan-portes` à trois liens, trois sections `.bilan-chapitre`, Europe déplacée dans `#france-dette`, CTA final après le troisième chapitre.

- [ ] **Step 1: Remplacer les assertions de cinq ancres par le contrat des trois portes**

Dans `interface.test.ts` et `prerendre.test.ts`, vérifier :

```ts
assert.equal((bilan.match(/class="bilan-portes__lien"/g) ?? []).length, 3);
assert.match(bilan, /href="#france-entrees"/);
assert.match(bilan, /href="#france-sorties"/);
assert.match(bilan, /href="#france-dette"/);
assert.doesNotMatch(bilan, /href="#france-europe"/);
assert.ok(position("bloc-dette") < position("bloc-europe"));
assert.ok(position("bloc-europe") < bilan.indexOf('href="/simulateur"'));
```

Conserver les gardes d'unicité et de présence des huit slots.

- [ ] **Step 2: Exécuter les tests et observer l'échec**

Run:

```powershell
cd site
node --experimental-strip-types --test src/interface.test.ts scripts/prerendre.test.ts
```

Expected: FAIL car le gabarit possède encore cinq liens et une section Europe autonome.

- [ ] **Step 3: Recomposer `site/index.html` sans dupliquer les slots**

Appliquer cette hiérarchie :

```html
<section class="bilan-couverture" id="france-verdict">
  <div class="bilan-couverture__papier">
    <div id="conclusion-france-verdict"></div>
    <nav class="bilan-portes" aria-label="Les trois chapitres du bilan France">
      <!-- trois liens : titre + phrase courte -->
    </nav>
  </div>
</section>
<section class="bilan-chapitre" id="france-entrees">…slots entrées…</section>
<section class="bilan-chapitre" id="france-sorties">…slots sorties…</section>
<section class="bilan-chapitre" id="france-dette">
  …conclusion dette, bloc-dette puis bloc-europe…
</section>
<section class="bilan-action">…titre, phrase et CTA simulateur…</section>
```

Supprimer entièrement `#france-europe` et l'ancienne `.bilan-guide__nav`. Les phrases des portes sont fixes et pédagogiques ; les chiffres restent dans les renderers.

- [ ] **Step 4: Vérifier la parité SPA/pré-rendu**

Run:

```powershell
cd site
node --experimental-strip-types --test src/interface.test.ts scripts/prerendre.test.ts
npm run build
```

Expected: PASS ; `dist/bilan/index.html` contient trois portes, trois chapitres, huit slots et Europe après la dette.

- [ ] **Step 5: Committer**

```powershell
git add site/index.html site/src/interface.test.ts site/scripts/prerendre.test.ts
git commit -m "Recompose le bilan en trois chapitres"
```

---

### Task 3: Remplacer le dashboard historique par le système visuel v2

**Files:**
- Rewrite: `site/src/styles/bilan-guide.css`
- Modify: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: classes `.bilan-verdict*`, `.bilan-equation*`, `.bilan-portes*`, `.bilan-chapitre*`, `.bilan-action` des Tasks 1–2.
- Produces: tokens `--bilan-*`, header bleu nuit scoped, couverture papier, hero 2 colonnes, équation 5 colonnes, portes 3 colonnes, chapitres éditoriaux 2 colonnes, breakpoint 40rem mono-colonne.

- [ ] **Step 1: Écrire les gardes CSS de composition**

Remplacer les regex prescriptives de l'ancien hero dans `interface.test.ts` par des invariants :

```ts
assert.match(css, /body\[data-vue="bilan"\] \.entete/);
assert.match(css, /\.bilan-couverture__papier/);
assert.match(css, /\.bilan-verdict\s*\{[^}]*grid-template-columns/s);
assert.match(css, /\.bilan-equation\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) auto minmax\(0,1fr\) auto minmax\(0,1fr\)/s);
assert.match(css, /\.bilan-portes\s*\{[^}]*grid-template-columns:\s*repeat\(3/s);
assert.match(css, /\.bilan-chapitre\s*\{[^}]*grid-template-columns/s);
assert.match(css, /@media \(max-width:\s*40rem\)[\s\S]*#national[\s\S]*padding:\s*0/);
assert.match(css, /@media \(max-width:\s*40rem\)[\s\S]*\.bilan-portes[\s\S]*grid-template-columns:\s*1fr/);
assert.match(css, /min-height:\s*var\(--cible\)/);
```

- [ ] **Step 2: Exécuter le test et observer l'échec**

Run:

```powershell
cd site
node --experimental-strip-types --test src/interface.test.ts
```

Expected: FAIL sur le header, la couverture, les portes et les overrides mobile absents.

- [ ] **Step 3: Réécrire `bilan-guide.css` comme propriétaire de `/bilan`**

Définir sous `body[data-vue="bilan"]` et `#vue-bilan` :

```css
--bilan-encre: #0b1d36;
--bilan-papier: #fbf8f1;
--bilan-accent: #b7372f;
--bilan-fond: #e9edf2;
--bilan-ligne: #c9c0af;
```

Implémenter :

- header compact bleu nuit, recherche et sous-titre secondaires sur cette vue ;
- `#contenu` sans largeur dashboard et `#national` centré à 1180 px ;
- couverture papier avec padding généreux et ombre très légère ;
- hero 2 colonnes, totem blanc à filet rouge ;
- équation 5 colonnes sur la largeur complète ;
- portes 3 colonnes à filet supérieur bleu nuit, sans pilules ;
- chapitres 2 colonnes avec introduction latérale et preuves larges ;
- neutralisation locale de `.national`, `.ui-conclusion` et `.bloc` hérités ;
- hiérarchie distincte pour preuves dominantes et secondaires ;
- CTA final bleu nuit avec une seule action.

Au breakpoint `40rem`, poser explicitement `#national { margin: 0; padding: 0; }`, hero/équation/portes/chapitres en une colonne, signes de l'équation conservés, cibles de 44 px et zones de tableaux à défilement local.

- [ ] **Step 4: Vérifier CSS, tests ciblés et build**

Run:

```powershell
cd site
node --experimental-strip-types --test src/interface.test.ts src/national.test.ts scripts/prerendre.test.ts
npm run build
```

Expected: PASS, sans modification du rendu des autres vues.

- [ ] **Step 5: Committer**

```powershell
git add site/src/styles/bilan-guide.css site/src/interface.test.ts
git commit -m "Donne au bilan sa direction editoriale v2"
```

---

### Task 4: Prouver la fidélité réelle desktop et mobile

**Files:**
- Modify: `docs/verification/2026-08-26-verdict-france/verification-report.md`
- Replace: `docs/verification/2026-08-26-verdict-france/bilan-desktop-1440x900.jpg`
- Replace: `docs/verification/2026-08-26-verdict-france/bilan-mobile-390x844.jpg`
- Create: `docs/verification/2026-08-26-verdict-france/bilan-v2-hero-desktop-1440x900.jpg`
- Create: `docs/verification/2026-08-26-verdict-france/bilan-v2-hero-mobile-390x844.jpg`

**Interfaces:**
- Consumes: build de production des Tasks 1–3 et maquette `.superpowers/brainstorm/1847-1787723803/content/10-directions-france.html`.
- Produces: preuves versionnées de fidélité, métriques de largeur/hauteur/touch targets et validation finale.

- [ ] **Step 1: Exécuter la suite complète et le build**

Run:

```powershell
cd site
npm test
npm run build
```

Expected: 1 320 tests ou davantage, zéro échec ; pré-rendu `/bilan` réussi.

- [ ] **Step 2: Comparer le premier écran desktop à la maquette 01**

Servir `dist`, ouvrir la maquette et `/bilan` à 1440 × 900, puis vérifier : couverture papier contenue, texte à gauche, totem rouge à droite, équation sur une ligne, trois portes visibles et absence de panneau gris/nav à pilules.

- [ ] **Step 3: Vérifier tout le document desktop**

Contrôler les trois chapitres, Europe dans le troisième, historique 2000–2025, liens Eurostat, CTA final et absence de méthode dans le flux.

- [ ] **Step 4: Vérifier 390 × 844**

Mesurer `documentElement.clientWidth === documentElement.scrollWidth`, les trois portes et CTA à au moins 44 px, hero/équation/chapitres en une colonne et aucune règle héritée de marge/padding sur `#national`.

- [ ] **Step 5: Versionner les captures et le rapport**

Mettre à jour le rapport avec une matrice « maquette → rendu réel » et les métriques observées, puis :

```powershell
git add docs/verification/2026-08-26-verdict-france
git commit -m "Prouve la fidelite visuelle du bilan v2"
```

- [ ] **Step 6: Revue finale et publication**

Run:

```powershell
git diff --check
git status --short
```

Expected: aucune modification produit non commitée ; `.superpowers/brainstorm/` reste intact. Après revue finale approuvée, pousser `main`, attendre le workflow Cloudflare vert et recontrôler la page publique desktop/mobile.
