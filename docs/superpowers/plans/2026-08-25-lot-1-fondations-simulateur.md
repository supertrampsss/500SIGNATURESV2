# Lot 1 — Fondations et simulateur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Installer le système d’interface commun et livrer le simulateur « cabinet contemporain » mobile-first sans modifier ses règles budgétaires.

**Architecture:** Conserver la SPA TypeScript/Vite et le moteur pur du tunnel. Ajouter des feuilles CSS focalisées importées après la feuille historique, extraire la navigation dans un rendu pur testable, puis simplifier uniquement `tunnel-rendu.ts`; `tunnel-modele.ts` reste la source des règles et de la persistance.

**Tech Stack:** TypeScript 5.9, Vite 7, HTML sémantique, CSS natif, tests `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-25-refonte-interface-site-design.md`

## Global Constraints

- Mobile est le format de référence ; aucune décision ne doit demander un défilement horizontal.
- Navigation globale : Accueil, France, Territoires, Simuler.
- Les libellés et l’ordre des boutons du simulateur doivent correspondre aux deux options.
- Aucun dialogue fugace après une décision ; les événements majeurs persistent jusqu’à une action.
- Les engagements préalables restent supprimés et « Prendre mes fonctions » reste centré.
- Toute zone tactile mesure au moins 44 × 44 px.
- La couleur n’est jamais le seul porteur de sens et `prefers-reduced-motion` est respecté.
- Les anciennes URLs restent compatibles.
- Aucun nouveau framework UI et aucune modification des règles de calcul budgétaire.

---

### Task 1: Fondations CSS isolées

**Files:**
- Create: `site/src/styles/fondations.css`
- Modify: `site/src/main.ts`
- Modify: `site/src/interface.test.ts`

**Interfaces:**
- Consumes: tokens historiques de `site/src/style.css` et polices auto-hébergées.
- Produces: tokens `--ui-*`, classes `.ui-conclusion`, `.ui-action`, `.ui-tiroir`, `.ui-visually-hidden` disponibles aux lots suivants.

- [ ] **Step 1: Write the failing structure test**

Ajouter à `interface.test.ts` :

```ts
test("les fondations déclarent les deux régimes et les cibles tactiles", () => {
  const css = readFileSync(new URL("./styles/fondations.css", import.meta.url), "utf8");
  assert.match(css, /--ui-nuit:\s*#10213a/i);
  assert.match(css, /--ui-papier:\s*#fbf7ee/i);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  for (const etat of ["chargement", "vide", "erreur", "perime"])
    assert.match(css, new RegExp(`\\.ui-etat--${etat}`));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd site; node --experimental-strip-types --test src/interface.test.ts`  
Expected: FAIL with `ENOENT ... styles/fondations.css`.

- [ ] **Step 3: Add the focused stylesheet and import it last**

Créer le fichier avec les variables validées, les focus visibles, la cible minimale, les surfaces clair/sombre, les quatre états fonctionnels et la réduction de mouvement. Les erreurs de champ utilisent `.ui-erreur-champ` immédiatement après le contrôle et `aria-describedby`. Dans `main.ts`, après `import "./style.css"`, ajouter :

```ts
import "./styles/fondations.css";
```

- [ ] **Step 4: Run the focused test and typecheck**

Run: `cd site; node --experimental-strip-types --test src/interface.test.ts; npx tsc --noEmit`  
Expected: PASS, puis exit 0.

- [ ] **Step 5: Commit**

```powershell
git add site/src/styles/fondations.css site/src/main.ts site/src/interface.test.ts
git commit -m "Pose les fondations visuelles communes"
```

### Task 2: Navigation globale à quatre destinations

**Files:**
- Create: `site/src/navigation.ts`
- Create: `site/src/navigation.test.ts`
- Create: `site/src/styles/navigation.css`
- Modify: `site/index.html`
- Modify: `site/src/main.ts`
- Modify: `site/src/routes.ts`
- Modify: `site/src/routes.test.ts`

**Interfaces:**
- Produces: `DESTINATIONS: readonly Destination[]`, `renduNavigation(pathname: string, simulateurDisponible: boolean): string`.
- `Destination = { cle: "accueil" | "france" | "territoires" | "simuler"; href: string; libelle: string }`.
- Les liens SPA portent `data-vue`; l’accueil est un lien normal vers `/`.

- [ ] **Step 1: Write failing navigation tests**

```ts
test("la navigation garde quatre destinations dans un ordre stable", () => {
  assert.deepEqual(DESTINATIONS.map(({ libelle }) => libelle),
    ["Accueil", "France", "Territoires", "Simuler"]);
  const html = renduNavigation("/bilan", true);
  assert.match(html, /href="\/bilan"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, />Analyses</);
});
```

Ajouter dans `routes.test.ts` l’attendu `cheminDeVue("bilan") === "/bilan"` afin de garder l’URL historique derrière le libellé France.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd site; node --experimental-strip-types --test src/navigation.test.ts src/routes.test.ts`  
Expected: FAIL because `navigation.ts` does not exist.

- [ ] **Step 3: Implement the pure navigation and mount it**

```ts
export const DESTINATIONS = [
  { cle: "accueil", href: "/", libelle: "Accueil" },
  { cle: "france", href: "/bilan", libelle: "France" },
  { cle: "territoires", href: "/territoire", libelle: "Territoires" },
  { cle: "simuler", href: "/simulateur", libelle: "Simuler" },
] as const;
```

Remplacer les liens écrits en dur de `index.html` par un conteneur `#navigation-principale`; le remplir au démarrage et après disponibilité du budget. Garder la délégation existante sur `a[data-vue]`. Rendre Simuler désactivé avec `aria-disabled="true"` tant que le budget n’est pas disponible, au lieu de retirer la destination.

- [ ] **Step 4: Add desktop and mobile navigation CSS**

Importer `./styles/navigation.css` après `fondations.css`. À `max-width: 40rem`, fixer la barre en bas avec quatre colonnes, `padding-bottom: env(safe-area-inset-bottom)` et réserver sa hauteur dans `body`; masquer cette barre pendant `body[data-vue="simulateur"][data-session="active"]`.

- [ ] **Step 5: Run navigation, route, and interface tests**

Run: `cd site; node --experimental-strip-types --test src/navigation.test.ts src/routes.test.ts src/interface.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add site/index.html site/src/navigation.ts site/src/navigation.test.ts site/src/styles/navigation.css site/src/main.ts site/src/routes.ts site/src/routes.test.ts
git commit -m "Unifie la navigation du site"
```

### Task 3: Présenter la mission sans bruit

**Files:**
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/tunnel.test.ts`
- Create: `site/src/styles/tunnel-cabinet.css`
- Modify: `site/src/main.ts`

**Interfaces:**
- Consumes: `renduMission(etat: EtatTunnel, missionEuros: number): string` inchangé.
- Produces: HTML `.tunnel-mission` avec déficit, explication courte, deux modes et CTA centré.

- [ ] **Step 1: Tighten the mission rendering test**

```ts
test("la mission annonce le déficit, les deux durées et un seul départ", () => {
  const html = renduMission(etatInitial(), MISSION);
  assert.match(html, /Le déficit à combler/);
  assert.match(html, /15 mesures/);
  assert.match(html, /96 mesures/);
  assert.equal((html.match(/data-action="commencer"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /engagement|contrat|chronomètre/i);
});
```

- [ ] **Step 2: Run the test**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="mission annonce" src/tunnel.test.ts`  
Expected: FAIL until the new copy and structure are present.

- [ ] **Step 3: Simplify `renduMission`**

Garder les actions `mode-express`, `mode-integral` et `commencer`. Employer :

```html
<p class="tunnel-mission__explication">Le déficit mesure ce que les administrations publiques dépensent au-delà de leurs recettes sur une année.</p>
```

Ne rendre aucun engagement, pied méthodologique ou décoration.

- [ ] **Step 4: Style the contemporary cabinet entry**

Créer `tunnel-cabinet.css`, l’importer après les autres CSS et centrer `.tunnel__commencer`. Supprimer visuellement tout pseudo-élément latéral sur `.tunnel__mode--actif`; l’état actif repose sur fond, contraste et `aria-pressed`.

- [ ] **Step 5: Run tunnel and interface tests**

Run: `cd site; node --experimental-strip-types --test src/tunnel.test.ts src/interface.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add site/src/tunnel-rendu.ts site/src/tunnel.test.ts site/src/styles/tunnel-cabinet.css site/src/main.ts
git commit -m "Clarifie l'entrée du conseil"
```

### Task 4: Transformer la décision en arbitrage éclair

**Files:**
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/tunnel.test.ts`
- Modify: `site/src/styles/tunnel-cabinet.css`

**Interfaces:**
- Conserve: `renduConseil(etat, missionEuros)` et les attributs `data-geste="adopter|rejeter|ajourner|annuler"` attendus par `afficherTunnel`.
- Produit: `renduOptionDecision(camp, mesure, dilemme): string` interne, avec un libellé identique à l’action correspondante.

- [ ] **Step 1: Write failing contract tests for option/action parity**

```ts
test("une décision mobile ne duplique ni les jauges ni les libellés", () => {
  const html = renduConseil(conseil(), MISSION);
  assert.equal((html.match(/class="tunnel-decision__option/g) ?? []).length, 2);
  assert.equal((html.match(/class="tunnel-decision__soutiens/g) ?? []).length, 0);
  assert.equal((html.match(/data-details="preuve"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Chiffrage, hypothèses et source|Chaque décision modifie/);
});
```

Conserver le test existant qui compare ordre et libellés des camps/boutons.

- [ ] **Step 2: Run the focused tests**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="décision mobile|même ordre" src/tunnel.test.ts`  
Expected: FAIL on the new classes.

- [ ] **Step 3: Implement the compact decision markup**

Dans `renduConseil`, remplacer les trois colonnes et `renduComparaison` visible par : bandeau mission compact, dossier central, deux options courtes, puis deux boutons dans le même ordre. Limiter chaque option à `libelle`, montant, `argument` et deux pastilles au maximum. Placer toutes les réactions et gagnants/perdants restants dans :

```html
<details class="tunnel-decision__details" data-details="preuve">
  <summary>Voir les conséquences et le chiffrage</summary>
  …
</details>
```

- [ ] **Step 4: Implement mobile-first layout**

À `max-width: 40rem`, utiliser `100dvh`, une barre de mission compacte, un dossier flexible et une barre d’action collée au bas du composant mais au-dessus des zones sûres. À partir de `60rem`, centrer le dossier à largeur maximale lisible et rendre les jauges dans un tiroir latéral optionnel, pas une colonne obligatoire.

- [ ] **Step 5: Run tunnel tests and full test suite**

Run: `cd site; node --experimental-strip-types --test src/tunnel.test.ts; npm test`  
Expected: all tunnel tests and 1,229+ total tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add site/src/tunnel-rendu.ts site/src/tunnel.test.ts site/src/styles/tunnel-cabinet.css
git commit -m "Rend les arbitrages lisibles sur mobile"
```

### Task 5: Persister uniquement les conséquences importantes

**Files:**
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/tunnel.ts`
- Modify: `site/src/tunnel.test.ts`

**Interfaces:**
- Conserve: `telexEnCours`, `criseEnCours`, `data-action="poursuivre"`, `data-telex`, `data-crise`.
- Produit: `renduEvenementPersistant(etat: EtatTunnel): string` interne.

- [ ] **Step 1: Add persistent-event tests**

```ts
test("un télex reste une étape explicite jusqu'à poursuivre", () => {
  const etat = { ...conseil(), telexEnCours: TELEX[0]!.id };
  const html = renduConseil(etat, MISSION);
  assert.match(html, /tunnel-evenement--persistant/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /data-action="poursuivre"|data-telex=/);
  assert.doesNotMatch(html, /data-geste="adopter"/);
});
```

- [ ] **Step 2: Run the focused test**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="télex reste" src/tunnel.test.ts`  
Expected: FAIL because `tunnel-evenement--persistant` is absent.

- [ ] **Step 3: Separate ordinary feedback from major event rendering**

Faire évoluer `renduConseil` pour que les variations ordinaires n’ajoutent aucune scène. Lorsqu’un télex ou une crise existe, rendre uniquement la carte d’événement et son action explicite. Ne pas ajouter de minuteur.

- [ ] **Step 4: Run controller regression tests**

Run: `cd site; node --experimental-strip-types --test src/tunnel.test.ts src/tunnel-evenements.test.ts`  
Expected: PASS, including BFCache and single-decision guards.

- [ ] **Step 5: Commit**

```powershell
git add site/src/tunnel-rendu.ts site/src/tunnel.ts site/src/tunnel.test.ts
git commit -m "Réserve les interruptions aux vraies conséquences"
```

### Task 6: Recomposer le verdict final

**Files:**
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/tunnel.test.ts`
- Modify: `site/src/styles/tunnel-cabinet.css`

**Interfaces:**
- Conserve: `bilanVerdict`, `renduVerdict`, actions `revanche`, `partager`, `expert`, `details`.
- Produit: cinq blocs `.verdict__resultat`, `.verdict__mandat`, `.verdict__gestes`, `.verdict__stabilite`, `.verdict__actions`.

- [ ] **Step 1: Write the five-block test**

```ts
test("le verdict hiérarchise résultat, mandat, gestes, stabilité et suite", () => {
  const html = renduVerdict({ ...conseil(), phase: "verdict" }, MISSION);
  for (const classe of ["resultat", "mandat", "gestes", "stabilite", "actions"])
    assert.match(html, new RegExp(`verdict__${classe}`));
  assert.doesNotMatch(html, /Vos décorations|Collection :|La mission est calculée/);
  assert.match(html, /<details[^>]*class="verdict__details"/);
});
```

- [ ] **Step 2: Run the test**

Run: `cd site; node --experimental-strip-types --test --test-name-pattern="verdict hiérarchise" src/tunnel.test.ts`  
Expected: FAIL on missing five-block structure.

- [ ] **Step 3: Recompose `renduVerdict` without changing `bilanVerdict`**

Afficher le résultat, une phrase de profil, trois gestes maximum, quatre soutiens compacts, puis les actions. Replier les quinze décisions dans `<details class="verdict__details">`. Retirer du rendu principal collection/décorations et paragraphe technique ; conserver les données internes pour compatibilité.

- [ ] **Step 4: Run tunnel tests**

Run: `cd site; node --experimental-strip-types --test src/tunnel.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add site/src/tunnel-rendu.ts site/src/tunnel.test.ts site/src/styles/tunnel-cabinet.css
git commit -m "Hiérarchise le verdict du conseil"
```

### Task 7: Événements d’usage sans opinion politique

**Files:**
- Create: `site/src/evenements-interface.ts`
- Create: `site/src/evenements-interface.test.ts`
- Modify: `site/src/main.ts`

**Interfaces:**
- Produit:

```ts
export type EvenementInterface =
  | { type: "navigation"; destination: "accueil" | "france" | "territoires" | "simuler" }
  | { type: "preuve_ouverte"; contexte: "france" | "territoire" | "analyse" | "simulateur" }
  | { type: "territoire_recherche" }
  | { type: "simulateur_abandon"; dossier: number };
export function emettreInterface(detail: EvenementInterface): void;
```

- Consomme: événement existant `simulateur:evenement`; ne transmet aucune mesure adoptée/rejetée.

- [ ] **Step 1: Write the privacy contract test**

```ts
test("les événements d'interface ne peuvent pas porter un choix politique", () => {
  const source = readFileSync(new URL("./evenements-interface.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /mesureId|adopte|rejete|tampon/);
  assert.match(source, /interface:evenement/);
});
```

- [ ] **Step 2: Run the test**

Run: `cd site; node --experimental-strip-types --test src/evenements-interface.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement local typed events**

```ts
export function emettreInterface(detail: EvenementInterface): void {
  document.dispatchEvent(new CustomEvent("interface:evenement", { detail }));
}
```

Brancher navigation, ouverture d’un tiroir de preuve, recherche territoriale et sortie d’une session. Ne pas ajouter de transport réseau, cookie ou identifiant ; un collecteur futur pourra écouter ce contrat après décision de conformité.

- [ ] **Step 4: Run event and simulator regression tests**

Run: `cd site; node --experimental-strip-types --test src/evenements-interface.test.ts src/tunnel-evenements.test.ts src/tunnel.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add site/src/evenements-interface.ts site/src/evenements-interface.test.ts site/src/main.ts
git commit -m "Définit les événements d'usage respectueux des choix"
```

### Task 8: Vérification globale du lot 1

**Files:**
- Modify only if a verification exposes a defect in the files above.

**Interfaces:**
- Produces: Lot 1 independently deployable.

- [ ] **Step 1: Run all automated checks**

Run: `cd site; npm test; npm run build; git diff --check`  
Expected: all tests PASS, build completes, no whitespace errors.

- [ ] **Step 2: Verify keyboard and mobile behavior in the browser**

Run: `cd site; npm run dev -- --host 127.0.0.1`.

Check `/`, `/bilan`, `/territoire`, `/simulateur` at 320, 390, 768 and 1280 CSS px. Verify focus order, 44 px targets, no horizontal scroll, safe-area clearance, reduced motion, one-screen decision comprehension, persistent crises and exact option/button parity.

- [ ] **Step 3: Commit verification fixes**

```powershell
git add site
git commit -m "Vérifie le socle et le simulateur mobile"
```
