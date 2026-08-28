# Header Journal et flux V3 continu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le header actuel par la variante « Journal de bord », réserver la recherche à Territoires et supprimer l'écran de verdict intermédiaire entre les chapitres V3.

**Architecture:** Le moteur de campagne devient responsable de la transition directe entre chapitres et normalise les anciennes sauvegardes. Le gabarit déplace l'unique combobox dans la vue Territoires ; `navigation.css` et les règles de chrome de `style.css` portent le nouveau header sans variante par page.

**Tech Stack:** TypeScript, HTML, CSS, Node test runner, Vite, Cloudflare Pages.

## Global Constraints

- Aucun écran « Le pays vous présente l'addition » entre deux chapitres.
- Le verdict final reste l'unique bilan complet de la partie.
- Un seul champ `#recherche`, placé dans la vue Territoires.
- Navigation limitée à France, Territoires et Simuler.
- Cibles tactiles d'au moins 44 px et focus visible.
- Aucun débordement horizontal à 390 px.
- Aucun cadratin ajouté au texte visible.
- Les anciens permaliens V2 restent compatibles.

---

### Task 1: Transition V3 directe entre chapitres

**Files:**
- Modify: `site/src/simulateur-v3/campaign.test.ts`
- Modify: `site/src/simulateur-v3/campaign.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`
- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`
- Modify: `site/src/simulateur-v3/controller.ts`

**Interfaces:**
- Consumes: `CampaignState`, `Scenario`, `currentDecision()`.
- Produces: `advanceAfterResult(state, scenario): CampaignState` qui ne renvoie jamais `chapter_verdict`, et `normalizeChapterTransition(state, scenario): CampaignState` pour les sauvegardes historiques.

- [ ] **Step 1: Écrire les tests rouges du moteur**

Ajouter à `campaign.test.ts` :

```ts
test("la douzième décision ouvre directement le chapitre suivant", () => {
  const state = campaignAfterDecisions(12, { phase: "decision_result", chapterIndex: 0, decisionIndex: 11 });
  const next = advanceAfterResult(state, SCENARIO_V3_PREVIEW);
  assert.equal(next.phase, "chapter_intro");
  assert.equal(next.chapterIndex, 1);
  assert.equal(next.decisionIndex, 0);
});

test("une sauvegarde historique au verdict de chapitre avance sans écran intermédiaire", () => {
  const legacy = campaignAfterDecisions(12, { phase: "chapter_verdict", chapterIndex: 0, decisionIndex: 11 });
  const next = normalizeChapterTransition(legacy, SCENARIO_V3_PREVIEW);
  assert.equal(next.phase, "chapter_intro");
  assert.equal(next.chapterIndex, 1);
});
```

- [ ] **Step 2: Vérifier l'échec attendu**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/campaign.test.ts`

Expected: FAIL car la transition produit encore `chapter_verdict` et `normalizeChapterTransition` n'existe pas.

- [ ] **Step 3: Implémenter la transition et la normalisation**

Dans `campaign.ts`, remplacer la branche de fin de chapitre et exporter la normalisation :

```ts
function nextChapter(state: CampaignState): CampaignState {
  return {
    ...state,
    chapterIndex: state.chapterIndex + 1,
    decisionIndex: 0,
    phase: "chapter_intro",
  };
}

export function normalizeChapterTransition(state: CampaignState, scenario: Scenario): CampaignState {
  if (state.phase !== "chapter_verdict") return state;
  if (state.decisions.length >= scenario.decisions.length) return { ...state, phase: "verdict" };
  return nextChapter(state);
}

function advanceOneScreen(state: CampaignState, scenario: Scenario): CampaignState {
  if (state.phase === "chapter_verdict") return normalizeChapterTransition(state, scenario);
  if (state.phase === "chapter_intro") return { ...state, phase: "decision" };
  if (state.phase === "council") return { ...state, decisionIndex: state.decisionIndex + 1, phase: "decision" };
  const completedDecisions = state.decisions.length;
  if (completedDecisions === scenario.decisions.length) return { ...state, phase: "verdict" };
  if (completedDecisions > 0 && completedDecisions % 12 === 0) return nextChapter(state);
  return { ...state, decisionIndex: state.decisionIndex + 1, phase: "decision" };
}
```

- [ ] **Step 4: Retirer le rendu et la commande intermédiaires**

Dans `render.ts`, supprimer `chapterLedger()`, `renderChapterVerdict()` et le cas `chapter_verdict` du routeur de rendu. Ajouter au test :

```ts
test("aucune scène ne présente une addition de fin de chapitre", () => {
  assert.doesNotMatch(SOURCE_RENDER, /Le pays vous présente l'addition|renderChapterVerdict/);
});
```

Dans `controller.ts`, normaliser l'état restauré avant le premier rendu et retirer `chapter_verdict` des actions `continue` :

```ts
state = normalizeChapterTransition(state, scenario);

if (action === "continue" && ["decision_result", "delayed_event", "council"].includes(state.phase)) {
  state = advanceAfterResult(state, scenario);
  commit();
}
```

- [ ] **Step 5: Lancer les tests V3 ciblés**

Run: `cd site && node --experimental-strip-types --test src/simulateur-v3/campaign.test.ts src/simulateur-v3/render.test.ts src/simulateur-v3/controller.test.ts src/simulateur-v3/storage.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/src/simulateur-v3/campaign.ts site/src/simulateur-v3/campaign.test.ts site/src/simulateur-v3/render.ts site/src/simulateur-v3/render.test.ts site/src/simulateur-v3/controller.ts site/src/simulateur-v3/controller.test.ts
git commit -m "Supprimer le verdict intermédiaire des chapitres V3"
```

### Task 2: Déplacer l'unique recherche dans Territoires

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/interface.test.ts`
- Modify: `site/src/accueil-montage.test.ts`
- Modify: `site/src/styles/territoire-briefing.css`

**Interfaces:**
- Consumes: `brancherRecherche(champ, suggestions)` et les identifiants `recherche`, `suggestions`.
- Produces: `.territoire-recherche` dans `#vue-territoire`, sans modifier le contrat TypeScript de la recherche.

- [ ] **Step 1: Écrire les tests rouges de structure**

Ajouter à `interface.test.ts` :

```ts
test("le header ne contient plus la recherche, qui vit une seule fois dans Territoires", () => {
  const header = PAGE.slice(PAGE.indexOf('<header class="entete">'), PAGE.indexOf("</header>") + 9);
  const territoire = PAGE.slice(PAGE.indexOf('id="vue-territoire"'), PAGE.indexOf('id="vue-bilan"'));
  assert.doesNotMatch(header, /id="recherche"|entete__recherche/);
  assert.match(territoire, /class="territoire-recherche"/);
  assert.match(territoire, /<h2>Comprendre mon territoire<\/h2>/);
  assert.equal((PAGE.match(/id="recherche"/g) ?? []).length, 1);
  assert.equal((PAGE.match(/id="suggestions"/g) ?? []).length, 1);
});
```

- [ ] **Step 2: Vérifier l'échec attendu**

Run: `cd site && node --experimental-strip-types --test src/interface.test.ts src/accueil-montage.test.ts`

Expected: FAIL car la recherche est encore dans `.entete`.

- [ ] **Step 3: Déplacer le bloc HTML sans le dupliquer**

Retirer `.entete__recherche` du header et placer ceci immédiatement dans `#vue-territoire` :

```html
<section class="territoire-recherche" aria-labelledby="territoire-recherche-titre">
  <div>
    <p class="territoire-recherche__surtitre">Territoires</p>
    <h2 id="territoire-recherche-titre">Comprendre mon territoire</h2>
  </div>
  <div class="recherche territoire-recherche__champ">
    <label for="recherche" class="visuellement-cache">Rechercher un territoire</label>
    <input id="recherche" type="search" autocomplete="off" role="combobox"
      aria-expanded="false" aria-controls="suggestions" aria-autocomplete="list"
      placeholder="Rechercher une commune, un département ou une région" />
    <ul id="suggestions" role="listbox" aria-label="Territoires trouvés" hidden></ul>
  </div>
</section>
```

- [ ] **Step 4: Ajouter le style du module Territoires**

Dans `territoire-briefing.css` :

```css
.territoire-recherche {
  display: grid;
  grid-template-columns: minmax(15rem, .8fr) minmax(20rem, 1.2fr);
  align-items: end;
  gap: var(--espace-6);
  padding: var(--espace-6) var(--gouttiere);
  background: var(--chrome-encre);
  color: var(--chrome-sur-encre);
}
.territoire-recherche h2 { margin: 0; color: inherit; font-family: var(--serif); }
.territoire-recherche__surtitre { margin: 0 0 var(--espace-2); text-transform: uppercase; letter-spacing: .12em; font-weight: 800; }
.territoire-recherche__champ { width: 100%; }
@media (max-width: 40rem) {
  .territoire-recherche { grid-template-columns: 1fr; padding: var(--espace-5); }
}
```

- [ ] **Step 5: Vérifier les tests de recherche**

Run: `cd site && node --experimental-strip-types --test src/interface.test.ts src/accueil-montage.test.ts`

Expected: PASS, avec exactement un champ et les mêmes identifiants.

- [ ] **Step 6: Commit**

```bash
git add site/index.html site/src/interface.test.ts site/src/accueil-montage.test.ts site/src/styles/territoire-briefing.css
git commit -m "Réserver la recherche à la page Territoires"
```

### Task 3: Construire le header « Journal de bord »

**Files:**
- Modify: `site/index.html`
- Modify: `site/src/style.css`
- Modify: `site/src/styles/navigation.css`
- Modify: `site/src/styles/simulateur-v3.css`
- Modify: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: navigation injectée dans `#navigation-principale`, `aria-current`, `data-vue`, `data-session`.
- Produces: `.entete__coeur`, `.entete__signature`, navigation pilule desktop et onglets mobile.

- [ ] **Step 1: Écrire les tests rouges du nouveau chrome**

Ajouter à `interface.test.ts` :

```ts
test("le header journal porte sa signature et une navigation en pilule", () => {
  assert.match(PAGE, /class="entete__signature">Les comptes publics, enfin lisibles</);
  assert.match(CSS, /\.entete__nav\s*\{[^}]*background:\s*var\(--chrome-papier-creuse\)/s);
  assert.match(CSS, /\.entete__nav a\[aria-current="page"\][^{]*\{[^}]*background:\s*var\(--chrome-encre\)/s);
});

test("sur mobile les trois destinations restent visibles sans barre flottante basse", () => {
  const navigation = NAVIGATION_CSS.match(/@media \(max-width:\s*39\.999rem\)[\s\S]*/)?.[0] ?? "";
  assert.match(navigation, /grid-template-columns:\s*repeat\(3/);
  assert.doesNotMatch(navigation, /position:\s*fixed|bottom:\s*0/);
});
```

- [ ] **Step 2: Vérifier l'échec attendu**

Run: `cd site && node --experimental-strip-types --test src/interface.test.ts`

Expected: FAIL sur la signature et la barre mobile encore fixée en bas.

- [ ] **Step 3: Mettre à jour le gabarit de marque**

Dans `index.html` :

```html
<header class="entete">
  <a class="entete__marque" href="/bilan" aria-label="Où va l'argent public, revenir à France">
    <span class="entete__nom">Où va l'argent public</span>
    <span class="entete__signature">Les comptes publics, enfin lisibles</span>
  </a>
  <nav class="entete__nav" id="navigation-principale" aria-label="Navigation principale"></nav>
  <button type="button" class="bascule-theme" id="theme-bascule" aria-pressed="false"
    title="Basculer entre le rendu clair et le rendu sombre">
    <span class="visuellement-cache">Basculer le thème</span>
    <span class="bascule-theme__icone" aria-hidden="true"></span>
  </button>
</header>
```

- [ ] **Step 4: Appliquer le style desktop**

Dans `style.css`, remplacer les règles de header par :

```css
.entete {
  display: grid;
  grid-template-columns: minmax(13rem, 1fr) auto auto;
  align-items: center;
  gap: var(--espace-4);
  min-height: var(--haut-entete);
  padding: var(--espace-3) var(--gouttiere);
  background: var(--chrome-papier);
  border-bottom: 1px solid var(--chrome-trait);
  position: sticky;
  top: 0;
  z-index: 30;
}
.entete__marque { color: var(--chrome-encre); text-decoration: none; }
.entete__nom { display: block; font: 650 var(--texte-xl)/1.1 var(--serif); }
.entete__signature { display: block; margin-top: .12rem; color: var(--chrome-encre-douce); font-size: var(--texte-xs); }
.entete__nav { display: flex; gap: var(--espace-1); padding: var(--espace-1); background: var(--chrome-papier-creuse); border-radius: var(--rayon-pilule); }
.entete__nav a { min-height: var(--cible); display: grid; place-items: center; padding-inline: var(--espace-5); color: var(--chrome-encre-douce); border-radius: var(--rayon-pilule); text-decoration: none; }
.entete__nav a[aria-current="page"] { color: var(--chrome-sur-encre); background: var(--chrome-encre); }
```

- [ ] **Step 5: Remplacer la barre mobile basse**

Dans `navigation.css` :

```css
@media (max-width: 39.999rem) {
  .entete { grid-template-columns: 1fr auto; padding: var(--espace-2) var(--espace-4) 0; }
  .entete__signature { display: none; }
  .entete__nav {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    padding: 0;
    background: transparent;
    border-radius: 0;
  }
  .entete__nav a { border-radius: 0; border-bottom: 3px solid transparent; }
  .entete__nav a[aria-current="page"] { color: var(--chrome-encre); background: transparent; border-bottom-color: var(--argile); }
  body[data-vue="simulateur"][data-session="active"] .entete { display: none; }
}
```

Dans `simulateur-v3.css`, conserver la barre de commandement V3 comme unique chrome pendant la session et retirer les anciennes surcharges visuelles du header global V3.

- [ ] **Step 6: Lancer les tests de chrome**

Run: `cd site && node --experimental-strip-types --test src/interface.test.ts src/routes.test.ts src/simulateur-v3/controller.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add site/index.html site/src/style.css site/src/styles/navigation.css site/src/styles/simulateur-v3.css site/src/interface.test.ts
git commit -m "Installer le header Journal de bord"
```

### Task 4: Vérification intégrée et déploiement

**Files:**
- Modify only if a test exposes a regression in a file already listed above.

**Interfaces:**
- Consumes: build Vite, pré-rendu, routeur, Cloudflare Pages.
- Produces: production vérifiée sur `https://500signatures.fr`.

- [ ] **Step 1: Vérifier l'absence de cadratins ajoutés au texte visible**

Run: `rg -n "—" site/index.html site/src/simulateur-v3 site/src/styles/navigation.css site/src/styles/territoire-briefing.css`

Expected: aucune nouvelle occurrence dans le texte visible modifié ; les occurrences historiques dans les tests ou commentaires ne bloquent pas ce lot.

- [ ] **Step 2: Lancer toute la suite du site**

Run: `cd site && npm test`

Expected: 0 échec.

- [ ] **Step 3: Construire la version de production**

Run: `cd site && npm run build`

Expected: TypeScript, Vite et pré-rendu terminent avec le code 0.

- [ ] **Step 4: Contrôler le navigateur local**

Vérifier à 1280 px et 390 px :

```js
({
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  searchCount: document.querySelectorAll("#recherche").length,
  headerSearchCount: document.querySelectorAll(".entete #recherche").length,
  navItems: document.querySelectorAll(".entete__nav a").length,
})
```

Expected sur Territoires : `{ overflow: 0, searchCount: 1, headerSearchCount: 0, navItems: 3 }`.

Expected sur France et Simuler : `headerSearchCount: 0`, aucun champ visible et aucun débordement.

- [ ] **Step 5: Vérifier une transition de chapitre V3**

Jouer ou injecter un état de fin de chapitre et confirmer que le DOM passe de la dernière décision à une scène `.simulateur-v3__chapter-intro`, sans `.simulateur-v3__chapter-verdict`.

- [ ] **Step 6: Commit final si nécessaire**

```bash
git add site/index.html site/src
git commit -m "Finaliser le header et le rythme du simulateur"
```

- [ ] **Step 7: Publier et vérifier Cloudflare**

Run: `git push origin main`, puis attendre le workflow `Deploy site`.

Contrôler en production :

- `https://500signatures.fr/bilan`
- `https://500signatures.fr/territoire`
- `https://500signatures.fr/simulateur`

Expected : nouveau header, recherche uniquement dans Territoires, V3 par défaut, zéro écran Addition, zéro débordement à 390 px.
