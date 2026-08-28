# Verdict Simulateur V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox markers for execution tracking.

**Goal:** Remplacer le verdict actuel du simulateur V3 par un écran de fin éditorial, lisible et partageable, dont chaque chiffre et chaque récit proviennent réellement de la campagne terminée.

**Architecture:** Introduire un modèle de vue pur dédié au verdict, le rendre avec une structure HTML propre au verdict, puis brancher le partage sur le même modèle de vue. Les styles restent confinés sous `.simulateur-v3__verdict-*`. Le contrôleur conserve la gestion des gestes navigateur et reçoit des dépendances injectables pour les tests.

**Tech Stack:** TypeScript, Vitest, HTML sémantique, CSS responsive, API Web Share, Clipboard API, Vite.

## Global Constraints

- Ne jamais afficher de cadratin ou de demi-cadratin dans l'interface.
- Ne pas modifier les composants globaux ni les pages France et Territoires.
- Ne jamais inventer une donnée de trajectoire. Toute valeur intermédiaire vient du journal causal.
- Afficher les milliards sans décimale, la croissance avec une décimale et les scores politiques en entiers.
- Garantir zéro débordement horizontal à 320 px.
- Respecter `prefers-reduced-motion`.
- Conserver les changements utilisateurs existants et le dossier `.superpowers/brainstorm/` non suivi.

---

## Task 1: Construire le modèle de vue du verdict

**Files:**

- Create: `site/src/simulateur-v3/verdict.ts`
- Create: `site/src/simulateur-v3/verdict.test.ts`
- Read: `site/src/simulateur-v3/campaign.ts`
- Read: `site/src/simulateur-v3/types.ts`

- [ ] **Step 1: Écrire les tests du modèle de vue**

Créer des cas couvrant le solde, les trois signaux, les cinq jalons, le classement des choix, les crises et l'absence de séquence vide.

```ts
test("reconstruit cinq jalons et termine sur les indicateurs réels", () => {
  const state = completedCampaign();
  const view = buildMandateVerdictViewModel(state, scenario, crisisRules);

  expect(view.trajectory.map((point) => point.decisionCount)).toEqual([0, 24, 48, 72, 96]);
  expect(view.trajectory.at(-1)).toMatchObject({
    annualBalance: state.indicators.annualBalance,
    majority: state.indicators.majority,
  });
});

test("ne répète pas le titre du dossier dans les choix décisifs", () => {
  const view = buildMandateVerdictViewModel(completedCampaign(), scenario, crisisRules);
  expect(view.decisiveChoices.every((choice) => choice.label !== choice.question)).toBe(true);
});
```

- [ ] **Step 2: Vérifier que les nouveaux tests échouent**

Run: `npm test -- --run site/src/simulateur-v3/verdict.test.ts`

Expected: échec car `verdict.ts` n'existe pas encore.

- [ ] **Step 3: Définir les types du modèle de vue**

```ts
export type VerdictSignal = {
  key: "growth" | "majority" | "opinion";
  label: string;
  value: number;
  initialValue: number;
  delta: number;
  descriptor: string;
};

export type VerdictCheckpoint = {
  decisionCount: number;
  label: string;
  annualBalance: number;
  majority: number;
};

export type MandateVerdictViewModel = {
  headline: string;
  summary: string;
  annualBalance: number;
  annualBalanceDelta: number;
  signals: VerdictSignal[];
  trajectory: VerdictCheckpoint[];
  decisiveChoices: VerdictChoice[];
  aftermath: VerdictAftermath[];
};
```

- [ ] **Step 4: Implémenter la reconstruction causale**

Partir de `INITIAL_INDICATORS`, ordonner les entrées du journal par `appliedAtDecision` puis par position d'origine, appliquer les deltas jusqu'aux jalons 24, 48, 72 et 96, puis utiliser les indicateurs réels pour le dernier point.

```ts
const CHECKPOINTS = [0, 24, 48, 72, 96] as const;

function reconstructAt(state: CampaignState, decisionCount: number): IndicatorState {
  return orderedLedger(state.causalLedger)
    .filter((entry) => entry.target === "indicator" && entry.appliedAtDecision <= decisionCount)
    .reduce(applyIndicatorEntry, { ...INITIAL_INDICATORS });
}
```

- [ ] **Step 5: Implémenter le classement et les suites du mandat**

Classer les décisions non remplacées par amplitude budgétaire, puis par amplitude du second effet structurel. Résoudre les libellés depuis le scénario et les crises depuis `crisisRules`. Ne rien afficher si aucune crise ni réforme modifiée n'existe.

- [ ] **Step 6: Exécuter les tests ciblés**

Run: `npm test -- --run site/src/simulateur-v3/verdict.test.ts`

Expected: tous les tests du modèle de vue passent.

- [ ] **Step 7: Commit**

```powershell
git add site/src/simulateur-v3/verdict.ts site/src/simulateur-v3/verdict.test.ts
git commit -m "feat(simulateur-v3): modeliser le verdict du mandat"
```

---

## Task 2: Remplacer le rendu générique par la scène finale

**Files:**

- Modify: `site/src/simulateur-v3/render.ts`
- Modify: `site/src/simulateur-v3/render.test.ts`

- [ ] **Step 1: Écrire les assertions du nouveau rendu**

```ts
test("rend un verdict éditorial sans la grille générique", () => {
  const html = renderSimulatorV3(verdictState(), scenario, { crisisRules });

  expect(html).toContain("simulateur-v3__verdict-hero");
  expect(html).toContain("simulateur-v3__verdict-signals");
  expect(html).toContain("simulateur-v3__verdict-trajectory");
  expect(html).toContain("simulateur-v3__verdict-choices");
  expect(html).not.toContain("simulateur-v3__situation-grid");
  expect(html).not.toMatch(/[–—]/u);
});

test("offre le partage, le nouveau mandat et le retour à France", () => {
  const html = renderSimulatorV3(verdictState(), scenario, { crisisRules });
  expect(html).toContain('data-v3-action="share-verdict"');
  expect(html).toContain('data-v3-action="restart"');
  expect(html).toContain('href="/bilan"');
});
```

- [ ] **Step 2: Vérifier que les tests de rendu échouent**

Run: `npm test -- --run site/src/simulateur-v3/render.test.ts`

Expected: échec sur les nouvelles classes et la nouvelle action.

- [ ] **Step 3: Extraire les petits renderers du verdict**

Ajouter dans `render.ts` des fonctions privées pour le totem, les signaux, la trajectoire, les choix et les suites. Chaque fonction reçoit uniquement le segment correspondant du modèle de vue.

```ts
function renderVerdictSignal(signal: VerdictSignal): string {
  return `<li class="simulateur-v3__verdict-signal simulateur-v3__verdict-signal--${signal.key}">
    <span class="simulateur-v3__verdict-signal-label">${escapeHtml(signal.label)}</span>
    <strong>${formatVerdictSignal(signal)}</strong>
    <span>${formatSignedDelta(signal.delta, signal.key === "growth" ? 1 : 0)} depuis le début</span>
  </li>`;
}
```

- [ ] **Step 4: Composer la scène finale complète**

La structure finale doit contenir, dans cet ordre : couverture, signaux, trajectoire, trois choix, suites éventuelles, actions.

```html
<article class="simulateur-v3__verdict">
  <header class="simulateur-v3__verdict-hero">...</header>
  <section class="simulateur-v3__verdict-signals" aria-label="État du mandat">...</section>
  <section class="simulateur-v3__verdict-trajectory" aria-labelledby="v3-trajectory-title">...</section>
  <section class="simulateur-v3__verdict-choices" aria-labelledby="v3-choices-title">...</section>
  <footer class="simulateur-v3__verdict-actions">...</footer>
</article>
```

- [ ] **Step 5: Rendre la trajectoire accessible sans dépendre de la couleur**

Chaque point porte son numéro de décision, le solde et la majorité en texte. Le point final porte le libellé `Verdict final`.

- [ ] **Step 6: Exécuter les tests ciblés**

Run: `npm test -- --run site/src/simulateur-v3/render.test.ts`

Expected: tous les tests de rendu passent.

- [ ] **Step 7: Commit**

```powershell
git add site/src/simulateur-v3/render.ts site/src/simulateur-v3/render.test.ts
git commit -m "feat(simulateur-v3): composer la scene finale du mandat"
```

---

## Task 3: Brancher un partage fidèle au verdict

**Files:**

- Create: `site/src/simulateur-v3/verdict-share.ts`
- Create: `site/src/simulateur-v3/verdict-share.test.ts`
- Modify: `site/src/simulateur-v3/controller.ts`
- Modify: `site/src/simulateur-v3/controller.test.ts`
- Reuse: `site/src/partage.ts`

- [ ] **Step 1: Écrire les tests du texte partageable**

```ts
test("résume le résultat sans répéter le lien", () => {
  const payload = buildVerdictShare(viewModel, "https://example.test/simulateur?version=3");
  expect(payload.lignes).toHaveLength(2);
  expect(payload.lignes.join(" ")).toContain("Solde annuel");
  expect(payload.lignes.join(" ")).toContain("Opinion");
  expect(payload.lignes.join(" ")).not.toContain(payload.permalien);
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npm test -- --run site/src/simulateur-v3/verdict-share.test.ts`

Expected: échec car le module n'existe pas encore.

- [ ] **Step 3: Construire un objet `Partage` depuis le modèle de vue**

```ts
export function buildVerdictShare(view: MandateVerdictViewModel, url: string): Partage {
  return {
    titre: "Mon mandat sur Où va l'argent public",
    permalien: url,
    lignes: [
      `${view.headline} Solde annuel : ${formatBillions(view.annualBalance)}.`,
      `Croissance ${formatPercent(view.signals[0].value)}, pouvoir ${formatScore(view.signals[1].value)}, opinion ${formatScore(view.signals[2].value)}.`,
    ],
    compact: null,
    image: null,
  };
}
```

- [ ] **Step 4: Injecter les canaux de partage dans le contrôleur**

Étendre les dépendances sans lire directement les API dans les tests.

```ts
export type SimulatorV3Dependencies = {
  // dépendances existantes
  shareChannels?: Canaux;
  currentUrl?: () => string;
};
```

Au clic `share-verdict`, reconstruire le même modèle de vue que le rendu, appeler `offrir`, émettre `verdict_shared` uniquement pour les issues `partagé` ou `copié`, et conserver l'écran en place.

- [ ] **Step 5: Tester le geste depuis le contrôleur**

```ts
test("partage le verdict sans redémarrer ni naviguer", async () => {
  const copied: string[] = [];
  mountSimulatorV3(host, scenario, {
    storage,
    currentUrl: () => "https://example.test/simulateur?version=3",
    shareChannels: { copier: async (text) => { copied.push(text); } },
  });

  host.click("share-verdict");
  await Promise.resolve();
  expect(copied).toHaveLength(1);
  expect(storageState().phase).toBe("verdict");
});
```

- [ ] **Step 6: Exécuter les tests de partage et de contrôleur**

Run: `npm test -- --run site/src/simulateur-v3/verdict-share.test.ts site/src/simulateur-v3/controller.test.ts`

Expected: tous les tests passent.

- [ ] **Step 7: Commit**

```powershell
git add site/src/simulateur-v3/verdict-share.ts site/src/simulateur-v3/verdict-share.test.ts site/src/simulateur-v3/controller.ts site/src/simulateur-v3/controller.test.ts
git commit -m "feat(simulateur-v3): partager le verdict du mandat"
```

---

## Task 4: Construire la direction visuelle responsive du verdict

**Files:**

- Modify: `site/src/styles/simulateur-v3.css`
- Modify: `site/src/simulateur-v3/interface.test.ts`

- [ ] **Step 1: Ajouter les contrats CSS aux tests d'interface**

```ts
test("le verdict utilise ses propres composants responsive", () => {
  expect(css).toContain(".simulateur-v3__verdict-hero");
  expect(css).toContain(".simulateur-v3__verdict-signals");
  expect(css).toContain(".simulateur-v3__verdict-trajectory");
  expect(css).toContain(".simulateur-v3__verdict-choice");
  expect(css).toContain("@media (prefers-reduced-motion: reduce)");
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npm test -- --run site/src/simulateur-v3/interface.test.ts`

Expected: échec sur les nouveaux sélecteurs.

- [ ] **Step 3: Poser la couverture asymétrique**

Desktop : grille 7 colonnes sur 5, titre éditorial à gauche, solde sous forme de totem à droite. Mobile : titre, totem puis synthèse, sans hauteur minimale forcée.

```css
.simulateur-v3__verdict-hero {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(17rem, 5fr);
  gap: clamp(1.5rem, 4vw, 4.5rem);
  padding: clamp(1.5rem, 4vw, 4rem);
  background: var(--v3-paper);
  border-top: 0.35rem solid var(--v3-red);
}
```

- [ ] **Step 4: Styliser signaux, trajectoire et choix**

Les signaux deviennent trois blocs compacts. La trajectoire utilise une ligne continue sur desktop et un axe vertical sur mobile. Les trois choix sont numérotés avec une hiérarchie forte et sans répéter leur question.

- [ ] **Step 5: Styliser les actions et les états d'interaction**

Le partage est le bouton principal, le nouveau mandat est secondaire, France est un lien tertiaire. Toutes les cibles font au moins 48 px de haut avec `:focus-visible` explicite.

- [ ] **Step 6: Ajouter les ruptures 1024, 390 et 320 px**

À 42 rem, empiler la couverture. À 24.5 rem, passer tous les signaux et les choix sur une colonne. Protéger tous les nombres et libellés avec `min-width: 0`, `overflow-wrap: anywhere` uniquement sur les textes libres, et aucune largeur fixe supérieure au viewport.

- [ ] **Step 7: Réduire les mouvements**

```css
@media (prefers-reduced-motion: reduce) {
  .simulateur-v3__verdict * {
    scroll-behavior: auto;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 8: Exécuter les tests ciblés**

Run: `npm test -- --run site/src/simulateur-v3/interface.test.ts site/src/simulateur-v3/render.test.ts`

Expected: tous les tests passent.

- [ ] **Step 9: Commit**

```powershell
git add site/src/styles/simulateur-v3.css site/src/simulateur-v3/interface.test.ts
git commit -m "style(simulateur-v3): mettre en scene le verdict final"
```

---

## Task 5: Vérifier le produit réel, corriger, fusionner et déployer

**Files:**

- Modify if needed: `site/src/simulateur-v3/*.ts`
- Modify if needed: `site/src/styles/simulateur-v3.css`
- Record: `docs/superpowers/specs/2026-08-28-verdict-simulateur-v3-design.md`

- [ ] **Step 1: Exécuter tous les tests et le build**

Run: `npm test`

Expected: suite complète verte.

Run: `npm run build`

Expected: build Vite terminé sans erreur.

- [ ] **Step 2: Scanner les chaînes interdites et les placeholders**

Run: `rg -n "[–—]|TODO|TBD|placeholder|à compléter" site/src/simulateur-v3 site/src/styles/simulateur-v3.css`

Expected: aucune chaîne d'interface interdite ou incomplète dans le périmètre modifié.

- [ ] **Step 3: Ouvrir une campagne isolée sur l'origine locale**

Démarrer Vite puis utiliser `http://127.0.0.1:5173/simulateur?version=3` afin de ne pas écraser la sauvegarde du navigateur sur `localhost` ou en production. Parcourir les 96 décisions avec les interludes et crises jusqu'au verdict.

- [ ] **Step 4: Contrôler visuellement quatre viewports**

Capturer et inspecter le verdict à :

- 1440 x 1000
- 1024 x 768
- 390 x 844
- 320 x 700

Vérifier la fidélité au modèle validé, le contraste, les retours à la ligne, les cibles de 48 px, la trajectoire, l'absence de texte répété et zéro débordement horizontal.

- [ ] **Step 5: Vérifier les valeurs dynamiques avec deux campagnes différentes**

Rejouer avec des choix opposés et confirmer que le solde, la croissance, le pouvoir, l'opinion, la trajectoire et les trois choix changent. Vérifier aussi le texte copié par le bouton de partage.

- [ ] **Step 6: Corriger toute divergence puis relancer les contrôles**

Après chaque correction, relancer les tests ciblés, `npm test`, `npm run build` et les quatre captures.

- [ ] **Step 7: Commit de vérification si nécessaire**

```powershell
git add site/src/simulateur-v3 site/src/styles/simulateur-v3.css
git commit -m "fix(simulateur-v3): aligner le verdict reel sur la maquette"
```

- [ ] **Step 8: Fusionner sur `main` et pousser**

```powershell
git switch main
git merge --no-ff feature/v3-verdict-design
git push origin main
```

- [ ] **Step 9: Attendre le déploiement et vérifier la production**

Contrôler le workflow GitHub Actions déclenché par le push. Une fois vert, ouvrir `https://plateforme-9sz.pages.dev/simulateur?version=3`, atteindre le verdict, puis refaire les vérifications desktop et mobile. Ne déclarer le chantier terminé que si le réel correspond à la maquette et si les données changent selon la campagne.

