# Conseil de crise mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le tunnel actuel de 96 mesures en une campagne express mobile-first de 15 dilemmes, en conservant le mode intégral, les règles budgétaires vérifiées, les quatre soutiens, les télex et le partage.

**Architecture:** Conserver TypeScript natif, Vite et le rendu HTML par fonctions pures. Scinder `tunnel.ts` en moteur, rendu et contrôleur avant d'ajouter une sélection express déterministe, un catalogue éditorial structuré, le retour animé, des crises sans élimination et le verdict de revanche.

**Tech Stack:** TypeScript 5.9, Vite 7, Node test runner, CSS natif, sessionStorage/localStorage, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-08-24-conseil-de-crise-mobile-design.md`

## Global Constraints

- La campagne express dure 7 à 10 minutes et contient exactement 15 dossiers, cinq par acte.
- Le mode intégral conserve les 96 mesures et reste accessible depuis la mission.
- Aucun framework ni dépendance de production supplémentaire.
- Les quatre soutiens restent Opinion, Entreprises, Territoires et Marchés ; leurs variations sont des règles de jeu identifiées comme telles.
- Les données factuelles, les effets ludiques et la rédaction éditoriale restent séparés.
- Le mobile à 320 px est la surface de référence ; toute action principale mesure au moins 44 px.
- `prefers-reduced-motion: reduce` supprime rotations et transitions sans retirer le retour textuel.
- Aucun son automatique et aucune opinion politique nominative transmise.
- Les tests ciblés de référence passent : `node --experimental-strip-types --test src/tunnel.test.ts src/mission.test.ts` donne 42/42.
- Le `npm test` initial échoue sur Windows avec 38 erreurs de chemins `C:\C:\...`; la Task 1 corrige ce défaut de portabilité avant les changements fonctionnels.

---

## File Structure

- `site/src/tunnel-modele.ts` — état, transitions, soutiens, télex, crises, score et sélection de campagne.
- `site/src/tunnel-rendu.ts` — HTML pur de la mission, du HUD, du dilemme, des événements et du verdict.
- `site/src/tunnel-retour.ts` — calcul et orchestration du retour de décision, avec variante reduced-motion.
- `site/src/tunnel.ts` — façade compatible, sauvegarde, partage, contrôleur DOM et réexports.
- `site/src/campagne.ts` — pools des trois actes et sélection déterministe de 15 dossiers.
- `site/src/dilemmes.ts` — rédaction contradictoire structurée pour les 21 dossiers candidats.
- `site/src/tunnel.test.ts` — garanties d'intégration et compatibilité des imports historiques.
- `site/src/campagne.test.ts` — sélection, engagements, graine et actes.
- `site/src/dilemmes.test.ts` — couverture éditoriale et séparation faits/règles.
- `site/src/tunnel-retour.test.ts` — deltas et états du retour de décision.
- `site/src/style.css` — République éditoriale, mobile-first, desktop et reduced-motion.
- `site/scripts/deploiement.test.ts` et `site/scripts/prerendre.test.ts` — chemins de tests portables Windows/Linux.

---

### Task 1: Rendre la suite de tests portable sur Windows

**Files:**
- Modify: `site/scripts/deploiement.test.ts:20-27`
- Modify: `site/scripts/prerendre.test.ts:18-72,437-440`

**Interfaces:**
- Consumes: URLs `import.meta.url` et chemins web commençant par `/`.
- Produces: chemins disque via `fileURLToPath()` et chemins web via `path.posix`.

- [ ] **Step 1: Vérifier l'échec de référence**

Run: `cd site && node --experimental-strip-types --test scripts/deploiement.test.ts scripts/prerendre.test.ts`

Expected: FAIL avec au moins un chemin `C:\C:\...` et `\\simulateur\\carte.png`.

- [ ] **Step 2: Corriger la conversion d'URL en chemin disque**

Dans les deux fichiers, ajouter :

```ts
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
```

Remplacer les deux occurrences de `path.dirname(new URL(import.meta.url).pathname)`.

- [ ] **Step 3: Réserver `path.posix` aux adresses web**

Dans `prerendre.test.ts`, remplacer les deux assertions concernées par :

```ts
assert.equal(path.posix.join("/", parNature("Simulateur").chemin, "carte.png"), IMAGE_SCENARIO);
assert.equal(path.posix.join("/", parNature("Bilan").chemin), CHEMINS.bilan);
```

- [ ] **Step 4: Relancer toute la suite**

Run: `cd site && npm test`

Expected: PASS, 0 échec. Si un autre test construit une URL avec `path.join`, appliquer la même règle locale `path.posix.join` et relancer jusqu'à 0 échec.

- [ ] **Step 5: Commit**

```bash
git add site/scripts/deploiement.test.ts site/scripts/prerendre.test.ts
git commit -m "test: rendre les chemins portables sur Windows"
```

---

### Task 2: Scinder le tunnel sans changer son comportement

**Files:**
- Create: `site/src/tunnel-modele.ts`
- Create: `site/src/tunnel-rendu.ts`
- Modify: `site/src/tunnel.ts`
- Modify: `site/src/tunnel.test.ts`

**Interfaces:**
- Consumes: `Mesure`, `Soutien`, `CONTRATS`, `PALIERS`, `millions()`.
- Produces: toutes les signatures actuellement importées depuis `./tunnel.ts`; `tunnel.ts` reste la façade publique.

- [ ] **Step 1: Poser le test de compatibilité de façade**

Ajouter à `tunnel.test.ts` :

```ts
test("la façade du tunnel conserve le moteur, les rendus et le contrôleur", async () => {
  const facade = await import("./tunnel.ts");
  assert.equal(typeof facade.commencer, "function");
  assert.equal(typeof facade.renduConseil, "function");
  assert.equal(typeof facade.afficherTunnel, "function");
});
```

- [ ] **Step 2: Vérifier que le test passe avant extraction**

Run: `cd site && node --experimental-strip-types --test src/tunnel.test.ts`

Expected: PASS. Ce test protège la compatibilité pendant les déplacements.

- [ ] **Step 3: Extraire le moteur pur**

Déplacer vers `tunnel-modele.ts` les types et fonctions pures de `tunnel.ts` : `Tampon`, `Phase`, `EtatTunnel`, constantes de règles, tables des télex, `pile`, `etatInitial`, transitions, compteurs, soutiens, paliers, profil, défi et décorations. Exporter aussi un lookup sûr :

```ts
export function mesureParId(id: string): Mesure | undefined {
  return PAR_ID.get(id);
}
```

- [ ] **Step 4: Extraire les rendus purs**

Déplacer vers `tunnel-rendu.ts` `echapper`, `compteur`, `renduSoutiens`, `renduMission`, `renduConseil`, `renduVerdict`, `rendu` et leurs helpers privés. Importer uniquement les fonctions publiques de `tunnel-modele.ts`.

- [ ] **Step 5: Réduire `tunnel.ts` à la façade et au contrôleur**

Conserver dans `tunnel.ts` la sauvegarde, la collection locale, `adresseDefi`, `bilanTexte`, `reprendre` et `afficherTunnel`. Ajouter des réexports explicites :

```ts
export * from "./tunnel-modele.ts";
export * from "./tunnel-rendu.ts";
```

- [ ] **Step 6: Vérifier types et comportement**

Run: `cd site && npx tsc --noEmit && node --experimental-strip-types --test src/tunnel.test.ts src/mission.test.ts`

Expected: PASS, mêmes 42 tests métier plus le test de façade.

- [ ] **Step 7: Commit**

```bash
git add site/src/tunnel.ts site/src/tunnel-modele.ts site/src/tunnel-rendu.ts site/src/tunnel.test.ts
git commit -m "refactor: séparer moteur rendu et contrôleur du tunnel"
```

---

### Task 3: Construire la campagne express déterministe en trois actes

**Files:**
- Create: `site/src/campagne.ts`
- Create: `site/src/campagne.test.ts`
- Modify: `site/src/tunnel-modele.ts`
- Modify: `site/src/tunnel.ts`
- Modify: `site/src/tunnel-rendu.ts`

**Interfaces:**
- Consumes: `MESURES`, engagements de `mission.ts`.
- Produces: `ModeTunnel`, `Acte`, `EXPRESS_PAR_ACTE`, `ordreExpress(engagements, graine)`, état version 2.

- [ ] **Step 1: Écrire les tests de sélection**

Créer `campagne.test.ts` avec :

```ts
test("chaque combinaison d'engagements conserve cinq dossiers par acte", () => {
  const cles = CONTRATS.map((c) => c.cle);
  for (let masque = 0; masque < 2 ** cles.length; masque++) {
    const engagements = cles.filter((_, i) => masque & (1 << i));
    const ordre = ordreExpress(engagements, 20260824);
    assert.equal(ordre.length, 15);
    assert.equal(new Set(ordre).size, 15);
    for (const acte of [1, 2, 3] as const) {
      assert.equal(ordre.filter((id) => acteDe(id) === acte).length, 5);
    }
  }
});

test("la même graine donne la même campagne et une autre change l'ordre", () => {
  assert.deepEqual(ordreExpress([], 12), ordreExpress([], 12));
  assert.notDeepEqual(ordreExpress([], 12), ordreExpress([], 13));
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd site && node --experimental-strip-types --test src/campagne.test.ts`

Expected: FAIL, module `campagne.ts` absent.

- [ ] **Step 3: Déclarer les pools validés**

Créer trois pools de sept identifiants, dont cinq restent disponibles même avec les quatre engagements :

```ts
export const EXPRESS_PAR_ACTE = {
  1: [
    "flat-tax-a-20-avec-abattement-protegeant",
    "exonerer-de-droits-de-succession-jusqu-a",
    "raboter-de-5-les-subventions-directes-aux",
    "achever-la-suppression-de-la-cvae",
    "aligner-la-csg-des-retraites-aises-sur",
    "reconduire-la-surtaxe-des-grandes-entreprises",
    "desindexer-les-pensions-d-un-point",
  ],
  2: [
    "repousser-l-age-legal-a-65-ans",
    "supprimer-l-aide-medicale-d-etat",
    "porter-l-effort-de-defense-vers-3",
    "plan-ferroviaire-3-000-m-de-plus",
    "privatiser-l-audiovisuel-public",
    "doubler-les-franchises-medicales",
    "revaloriser-les-enseignants-de-5",
  ],
  3: [
    "geler-le-point-d-indice-en-2026",
    "fermer-un-tiers-des-agences-et-operateurs",
    "ceder-des-participations-non-strategiques-de-l",
    "doubler-les-moyens-contre-la-fraude-fiscale",
    "reduire-l-aide-publique-au-developpement-de",
    "porter-le-taux-normal-de-tva-a",
    "reduire-de-5-les-dotations-aux-collectivites",
  ],
} as const;
```

- [ ] **Step 4: Implémenter le mélange stable**

Utiliser une graine entière 32 bits et un Fisher-Yates local :

```ts
function alea(graine: number): () => number {
  let x = graine | 0;
  return () => {
    x |= 0;
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Filtrer avec `bloqueePar`, mélanger chaque acte avec `graine + acte`, prendre cinq entrées et concaténer les actes.

- [ ] **Step 5: Versionner l'état**

Étendre `EtatTunnel` :

```ts
export type ModeTunnel = "express" | "integral";
export type Acte = 1 | 2 | 3;

export type EtatTunnel = {
  version: 2;
  mode: ModeTunnel;
  graine: number;
  // champs existants inchangés
};
```

`etatInitial()` crée `mode: "express"`. Une sauvegarde historique sans version est restaurée en `mode: "integral"` avec son ordre intact. Le défi v2 utilise exactement `v2~<mode>~<graine-base36>~<score-base36>~<engagements-CSV-encodés>` ; `decoderDefi()` valide chaque segment, ignore une graine invalide et continue de lire l'ancien format `score~engagements`.

- [ ] **Step 6: Brancher les deux modes sur la mission**

Ajouter `data-action="mode-integral"` et afficher « Conseil intégral · 96 mesures » comme action secondaire. `commencer()` utilise `ordreExpress()` en express et `pile()` en intégral.

- [ ] **Step 7: Vérifier**

Run: `cd site && npx tsc --noEmit && node --experimental-strip-types --test src/campagne.test.ts src/tunnel.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add site/src/campagne.ts site/src/campagne.test.ts site/src/tunnel-modele.ts site/src/tunnel.ts site/src/tunnel-rendu.ts site/src/tunnel.test.ts
git commit -m "feat: ajouter la campagne express en trois actes"
```

---

### Task 4: Structurer les 21 dilemmes contradictoires

**Files:**
- Create: `site/src/dilemmes.ts`
- Create: `site/src/dilemmes.test.ts`
- Modify: `site/src/tunnel-rendu.ts`

**Interfaces:**
- Consumes: identifiants de `EXPRESS_PAR_ACTE` et faits de `MESURES`.
- Produces: `DilemmeEditorial`, `dilemmeDe(id)`.

- [ ] **Step 1: Écrire le test de couverture éditoriale**

```ts
test("chaque candidat express possède deux choix contradictoires complets", () => {
  const ids = Object.values(EXPRESS_PAR_ACTE).flat();
  assert.equal(Object.keys(DILEMMES).length, ids.length);
  for (const id of ids) {
    const d = DILEMMES[id];
    assert.ok(d.question.endsWith("?"), id);
    assert.ok(d.contradiction.length >= 45, id);
    for (const choix of [d.adopter, d.rejeter]) {
      assert.ok(choix.libelle.length >= 4, id);
      assert.ok(choix.gagnants.length, id);
      assert.ok(choix.perdants.length, id);
    }
  }
});
```

- [ ] **Step 2: Définir le contrat éditorial**

```ts
export type CoteDilemme = {
  libelle: string;
  argument: string;
  gagnants: string[];
  perdants: string[];
};

export type DilemmeEditorial = {
  question: string;
  contradiction: string;
  adopter: CoteDilemme;
  rejeter: CoteDilemme;
};
```

Construire chaque côté avec ce helper afin que l'argument soit déterministe et jamais laissé à compléter :

```ts
function cote(libelle: string, gagnants: string[], perdants: string[]): CoteDilemme {
  return {
    libelle,
    argument: `${gagnants.join(" et ")} en bénéficient ; ${perdants.join(" et ")} en supportent le coût.`,
    gagnants,
    perdants,
  };
}
```

- [ ] **Step 3: Renseigner la matrice éditoriale complète**

Utiliser la matrice ci-dessous. Les formulations finales reprennent ces sens sans ajouter de chiffre absent de `Mesure.effet`, `precision` ou `detail`.

| ID | Question | Adopter : gagnants / perdants | Rejeter : gagnants / perdants |
|---|---|---|---|
| flat-tax-a-20-avec-abattement-protegeant | Baisser la flat tax tout en protégeant les revenus modestes ? | détenteurs de capital / budget public | budget public / détenteurs de capital |
| exonerer-de-droits-de-succession-jusqu-a | Exonérer les successions jusqu'à 300 000 € par enfant ? | héritiers concernés / budget public | budget public / héritiers concernés |
| raboter-de-5-les-subventions-directes-aux | Réduire de 5 % les subventions directes aux entreprises ? | budget public / entreprises aidées | entreprises aidées / contribuables |
| achever-la-suppression-de-la-cvae | Achever la suppression de la CVAE ? | entreprises redevables / finances publiques et territoires | finances publiques et territoires / entreprises redevables |
| aligner-la-csg-des-retraites-aises-sur | Aligner la CSG des retraités aisés sur celle des actifs ? | actifs et budget social / retraités aisés | retraités aisés / actifs et budget social |
| reconduire-la-surtaxe-des-grandes-entreprises | Reconduire la surtaxe des grandes entreprises ? | budget public / grandes entreprises | grandes entreprises / contribuables |
| desindexer-les-pensions-d-un-point | Désindexer les pensions d'un point ? | budget social / retraités | retraités / futurs budgets sociaux |
| repousser-l-age-legal-a-65-ans | Repousser l'âge légal à 65 ans ? | finances sociales / actifs proches de la retraite | actifs proches de la retraite / finances sociales |
| supprimer-l-aide-medicale-d-etat | Supprimer l'aide médicale d'État ? | budget à court terme / bénéficiaires et hôpitaux | bénéficiaires et prévention / budget public |
| porter-l-effort-de-defense-vers-3 | Porter l'effort de défense vers 3 % du PIB ? | armées et industrie de défense / autres budgets | autres budgets / armées et industrie de défense |
| plan-ferroviaire-3-000-m-de-plus | Ajouter 3 milliards par an au ferroviaire ? | voyageurs et territoires / budget public | budget public / voyageurs et territoires |
| privatiser-l-audiovisuel-public | Privatiser l'audiovisuel public ? | budget public et acteurs privés / service public audiovisuel | service public audiovisuel / budget public |
| doubler-les-franchises-medicales | Doubler les franchises médicales ? | assurance maladie / patients | patients / assurance maladie |
| revaloriser-les-enseignants-de-5 | Revaloriser les enseignants de 5 % ? | enseignants et attractivité scolaire / budget public | budget public / enseignants et attractivité scolaire |
| geler-le-point-d-indice-en-2026 | Geler le point d'indice en 2026 ? | budget public / agents publics | agents publics / budget public |
| fermer-un-tiers-des-agences-et-operateurs | Fermer un tiers des agences et opérateurs ? | budget public / agents et services concernés | services concernés / budget public |
| ceder-des-participations-non-strategiques-de-l | Céder des participations non stratégiques de l'État ? | dette à court terme / dividendes futurs et contrôle public | dividendes futurs et contrôle public / dette à court terme |
| doubler-les-moyens-contre-la-fraude-fiscale | Doubler les moyens contre la fraude fiscale et sociale ? | contribuables conformes et budget public / fraudeurs | fraudeurs / budget public et contribuables conformes |
| reduire-l-aide-publique-au-developpement-de | Réduire de moitié l'aide publique au développement ? | budget national / pays bénéficiaires et influence diplomatique | pays bénéficiaires et influence diplomatique / budget national |
| porter-le-taux-normal-de-tva-a | Porter le taux normal de TVA à 21 % ? | budget public / consommateurs | consommateurs / budget public |
| reduire-de-5-les-dotations-aux-collectivites | Réduire de 5 % les dotations aux collectivités ? | budget de l'État / collectivités et services locaux | collectivités et services locaux / budget de l'État |

Pour `libelle`, employer le premier verbe concret de la question côté adopter et son contraire explicite côté rejeter : « Baisser / Maintenir », « Exonérer / Conserver », « Réduire / Maintenir », « Supprimer / Conserver », « Aligner / Refuser », « Reconduire / Arrêter », « Désindexer / Indexer », « Repousser / Maintenir », « Supprimer / Conserver », « Porter / Maintenir », « Ajouter / Refuser », « Privatiser / Conserver », « Doubler / Maintenir », « Revaloriser / Refuser », « Geler / Revaloriser », « Fermer / Conserver », « Céder / Conserver », « Doubler / Maintenir », « Réduire / Maintenir », « Augmenter / Maintenir », « Réduire / Maintenir », dans l'ordre exact du tableau.

- [ ] **Step 4: Vérifier la frontière éditoriale**

Le test doit aussi vérifier que `dilemmes.ts` ne contient aucun nombre monétaire :

```ts
assert.doesNotMatch(JSON.stringify(DILEMMES), /\d+[.,]?\d*\s*(M€|Md€|€)/);
```

Les montants restent lus depuis `Mesure`.

- [ ] **Step 5: Exposer le dilemme au rendu**

`renduConseil()` utilise `dilemmeDe(mesure.id)` en express. Le mode intégral conserve le rendu générique actuel si aucun dilemme éditorial n'existe.

- [ ] **Step 6: Vérifier et commit**

Run: `cd site && npx tsc --noEmit && node --experimental-strip-types --test src/dilemmes.test.ts src/tunnel.test.ts`

```bash
git add site/src/dilemmes.ts site/src/dilemmes.test.ts site/src/tunnel-rendu.ts site/src/tunnel.test.ts
git commit -m "feat: écrire les dilemmes contradictoires de la campagne"
```

---

### Task 5: Livrer le rendu mobile-first « République éditoriale »

**Files:**
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/tunnel.test.ts`
- Modify: `site/src/style.css:8186-end`

**Interfaces:**
- Consumes: `DilemmeEditorial`, `EtatTunnel`, `Mesure`, soutiens calculés.
- Produces: `renduBarreEtat`, `renduComparaison`, `renduPreuve`, `renduConseil`, `renduVerdict`.

- [ ] **Step 1: Écrire les assertions structurelles du mobile**

```ts
test("le conseil express rend l'état, les deux camps, la preuve et la barre d'action", () => {
  const html = renduConseil(commencer(etatInitial()), MISSION);
  assert.match(html, /tunnel__etat-compact/);
  assert.match(html, /tunnel__comparaison/);
  assert.match(html, /tunnel__camp--adopter/);
  assert.match(html, /tunnel__camp--rejeter/);
  assert.match(html, /<details class="tunnel__preuve"/);
  assert.match(html, /tunnel__actions-fixes/);
  assert.match(html, /Acte 1/);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd site && node --experimental-strip-types --test src/tunnel.test.ts`

Expected: FAIL sur `tunnel__etat-compact`.

- [ ] **Step 3: Recomposer le rendu express**

Ordre DOM : lien Quitter, barre compacte, question, contradiction, deux camps, preuve repliable, alerte contextuelle, actions fixes, lien Ajourner/Annuler. Chaque camp affiche argument, gagnants, perdants, montant/réactions venant du moteur.

La preuve utilise :

```html
<details class="tunnel__preuve">
  <summary>Chiffrage, hypothèses et source</summary>
  <p><!-- Mesure.detail --></p>
  <p><!-- Mesure.precision si présente --></p>
  <p>Les réactions des soutiens sont des règles du jeu.</p>
</details>
```

- [ ] **Step 4: Remplacer les styles du tunnel par des règles mobile-first**

À la base, une colonne et un fond ivoire. À `min-width: 60rem`, grille `13rem minmax(0, 42rem) 15rem`. Utiliser les tokens existants et ces couleurs déjà validées : `#fbfaf6`, `#0f1b2e`, `#8f3329`, `#315f4e`, `#c7c0b0`.

Garanties CSS explicites :

```css
.tunnel__actions-fixes button { min-height: 44px; }
.tunnel__camp { min-width: 0; }
.tunnel__carte { max-width: 42rem; margin-inline: auto; }
@media (min-width: 60rem) {
  .tunnel__scene { grid-template-columns: 13rem minmax(0, 42rem) 15rem; }
}
@media (prefers-reduced-motion: reduce) {
  .tunnel * { scroll-behavior: auto; animation-duration: 0.01ms !important; }
}
```

- [ ] **Step 5: Vérifier type, tests et build**

Run: `cd site && npx tsc --noEmit && node --experimental-strip-types --test src/tunnel.test.ts src/dilemmes.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add site/src/tunnel-rendu.ts site/src/tunnel.test.ts site/src/style.css
git commit -m "feat: refaire le conseil en mobile-first éditorial"
```

---

### Task 6: Ajouter le retour de décision de 1,8 seconde

**Files:**
- Create: `site/src/tunnel-retour.ts`
- Create: `site/src/tunnel-retour.test.ts`
- Modify: `site/src/tunnel.ts`
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/style.css`

**Interfaces:**
- Consumes: état avant/après, `missionEuros`, verdict adopté/rejeté.
- Produces: `impactDecision(avant, apres, missionEuros)`, `jouerRetour(cadre, impact, terminer)`.

- [ ] **Step 1: Tester le calcul pur des deltas**

```ts
test("l'impact écrit le budget et chaque variation de soutien", () => {
  const avant = commencer(etatInitial());
  const apres = tamponner(avant, "adopte");
  const impact = impactDecision(avant, apres, MISSION);
  assert.equal(impact.verdict, "adopte");
  assert.notEqual(impact.resteAvant, impact.resteApres);
  assert.ok(impact.soutiens.some((s) => s.delta !== 0));
});
```

- [ ] **Step 2: Implémenter le calcul et le rendu textuel**

Le retour contient quatre états : `engagement`, `tampon`, `impact`, `consequence`. Chaque delta écrit son signe et sa valeur ; aucune information ne dépend uniquement de la couleur.

- [ ] **Step 3: Orchestrer sans bloquer reduced-motion**

```ts
export function jouerRetour(
  cadre: HTMLElement,
  impact: ImpactDecision,
  terminer: () => void,
): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cadre.innerHTML = renduImpact(impact);
    cadre.focus();
    setTimeout(terminer, 400);
    return;
  }
  // classes à 0, 180, 650 et 1400 ms ; terminer à 1800 ms
}
```

Le cadre possède `tabindex="-1"`, `role="status"` et `aria-live="polite"` afin que les 400 ms reduced-motion laissent le retour textuel être annoncé. Empêcher un second clic pendant la séquence avec `aria-busy="true"` et l'attribut `inert` sur les anciennes actions.

- [ ] **Step 4: Vérifier**

Run: `cd site && npx tsc --noEmit && node --experimental-strip-types --test src/tunnel-retour.test.ts src/tunnel.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add site/src/tunnel-retour.ts site/src/tunnel-retour.test.ts site/src/tunnel.ts site/src/tunnel-rendu.ts site/src/style.css
git commit -m "feat: mettre en scène l'impact des décisions"
```

---

### Task 7: Remplacer la défaite immédiate par des crises jouables

**Files:**
- Modify: `site/src/tunnel-modele.ts`
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/tunnel.test.ts`

**Interfaces:**
- Consumes: soutien tombé à `SEUIL_CENSURE` ou moins.
- Produces: `criseEnCours`, `crisesVues`, `verifierCrise()`, `trancherCrise()`.

- [ ] **Step 1: Remplacer le test de censure**

Écrire :

```ts
test("un soutien au tapis ouvre une crise et la partie continue après l'issue", () => {
  const enCrise = verifierCrise(etatAvecOpinionA10(), MISSION);
  assert.equal(enCrise.phase, "conseil");
  assert.equal(enCrise.criseEnCours, "opinion");
  const repris = trancherCrise(enCrise, "conceder", MISSION);
  assert.equal(repris.phase, "conseil");
  assert.equal(repris.criseEnCours, undefined);
  assert.ok(soutiens(repris, MISSION).find((s) => s.cle === "opinion")!.valeur > 10);
});
```

- [ ] **Step 2: Étendre l'état**

```ts
criseEnCours?: Soutien;
crisesVues: Soutien[];
criseSurcout: number;
criseSoutiens: Partial<Record<Soutien, number>>;
```

La restauration d'une ancienne sauvegarde initialise `crisesVues: []`, `criseSurcout: 0` et `criseSoutiens: {}`. `missionRestante()` inclut `criseSurcout` et `soutiens()` additionne `criseSoutiens`, comme ils le font déjà pour les télex.

- [ ] **Step 3: Définir deux issues par soutien**

Chaque crise possède `conceder` et `tenir`. Pour l'issue choisie, calculer d'abord les jauges courantes, appliquer son delta nominal, puis remplacer le delta du soutien concerné par `Math.max(deltaNominal, 15 - valeurCourante)` : la nouvelle valeur est donc exactement au moins 15, sans modifier les décisions passées. Cumuler ce delta dans `criseSoutiens` et le coût dans `criseSurcout`.

| Soutien | Crise | Concéder : coût / réactions | Tenir : coût / réactions |
|---|---|---|---|
| Opinion | Mouvement social | -2 000 M€ / Opinion +8, Entreprises -2 | -500 M€ / Opinion +3, Territoires -3 |
| Entreprises | Fronde patronale | -1 500 M€ / Entreprises +8, Opinion -2 | 0 M€ / Entreprises +3, Marchés -3 |
| Territoires | Fronde territoriale | -1 200 M€ / Territoires +8, Marchés -2 | -200 M€ / Territoires +3, Opinion -3 |
| Marchés | Choc de financement | -2 500 M€ / Marchés +8, Opinion -3 | -800 M€ / Marchés +3, Entreprises -3 |

- [ ] **Step 4: Remplacer `verifierCensure`**

`verifierCrise` choisit le premier soutien sous le seuil qui n'est ni déjà traité ni en cours. Une crise vue ne se redéclenche pas dans la même partie. Supprimer le verdict `Censuré` et l'action Annuler qui lui était propre.

- [ ] **Step 5: Rendre la crise**

Réutiliser le pattern contradictoire du télex avec `aria-live="assertive"`, deux issues, coût, soutiens gagnants/perdants et bouton de décision de 44 px.

- [ ] **Step 6: Vérifier toutes les branches**

Run: `cd site && node --experimental-strip-types --test src/tunnel.test.ts`

Expected: PASS, y compris une simulation « tout rejeter » qui termine sans boucle et avec au plus quatre crises.

- [ ] **Step 7: Commit**

```bash
git add site/src/tunnel-modele.ts site/src/tunnel-rendu.ts site/src/tunnel.test.ts
git commit -m "feat: transformer les seuils critiques en crises jouables"
```

---

### Task 8: Refaire le verdict, la revanche et les événements de mesure

**Files:**
- Create: `site/src/tunnel-evenements.ts`
- Create: `site/src/tunnel-evenements.test.ts`
- Modify: `site/src/tunnel-rendu.ts`
- Modify: `site/src/tunnel.ts`
- Modify: `site/src/tunnel.test.ts`
- Modify: `site/src/style.css`

**Interfaces:**
- Consumes: état final et mission.
- Produces: `bilanVerdict()`, `nouvelleContrainte()`, `emettreEvenement()`.

- [ ] **Step 1: Tester la hiérarchie du verdict**

```ts
test("le verdict explique avant de relancer", () => {
  const html = renduVerdict(partieTerminee(), MISSION);
  assert.ok(html.indexOf("Votre mandat") < html.indexOf("Relever le défi"));
  assert.match(html, /Promesses tenues/);
  assert.match(html, /Conséquences encore ouvertes/);
  assert.match(html, /Voir mes 15 choix/);
});
```

- [ ] **Step 2: Produire un bilan structuré**

`bilanVerdict()` retourne : montant trouvé, reste, soutiens, engagements tenus/rompus, crises traversées, reports, trois plus gros gestes et titre de profil. Le titre reste descriptif et non partisan.

- [ ] **Step 3: Proposer une revanche déterministe**

`nouvelleContrainte()` choisit le premier engagement absent dans l'ordre `sans-impot`, `sans-prestation`, `ecole-sante`, `sans-collectivites`. Si les quatre sont déjà signés, la revanche conserve les engagements et change la graine.

- [ ] **Step 4: Conserver le partage existant**

Le bouton principal devient « Relever le défi » et génère une URL v2 portant mode, graine, engagements et score. « Partager le bilan » utilise d'abord Web Share si disponible, puis copie le texte actuel. « Voir mes 15 choix » déplie l'historique dans la page.

- [ ] **Step 5: Émettre des événements anonymes sans transport**

```ts
export type EvenementTunnel =
  | { type: "partie_demarre"; mode: ModeTunnel }
  | { type: "decision"; acte: Acte; numero: number; verdict: "adopte" | "rejete" | "ajourne" }
  | { type: "crise"; soutien: Soutien }
  | { type: "partie_terminee"; mode: ModeTunnel; dossiers: number }
  | { type: "revanche" }
  | { type: "partage" };

export function emettreEvenement(detail: EvenementTunnel): void {
  document.dispatchEvent(new CustomEvent("simulateur:evenement", { detail }));
}
```

Aucun identifiant utilisateur ni liste de choix n'est envoyé. Un futur outil analytique pourra écouter cet événement sans modifier le moteur.

- [ ] **Step 6: Vérifier et commit**

Run: `cd site && npx tsc --noEmit && node --experimental-strip-types --test src/tunnel-evenements.test.ts src/tunnel.test.ts`

```bash
git add site/src/tunnel-evenements.ts site/src/tunnel-evenements.test.ts site/src/tunnel-rendu.ts site/src/tunnel.ts site/src/tunnel.test.ts site/src/style.css
git commit -m "feat: expliquer le mandat et proposer la revanche"
```

---

### Task 9: Vérification responsive, accessibilité et non-régression

**Files:**
- Modify if needed: `site/src/style.css`
- Modify if needed: tests touched by failures discovered in this task

**Interfaces:**
- Consumes: application complète.
- Produces: build vérifié et matrice de parcours passée.

- [ ] **Step 1: Lancer les contrôles automatisés**

Run:

```bash
cd site
npx tsc --noEmit
npm test
npm run build
```

Expected: trois commandes PASS, 0 échec.

- [ ] **Step 2: Démarrer le build local**

Run: `cd site && npm run dev -- --host 127.0.0.1`

Ouvrir `/simulateur` et tester 320×568, 375×812, 390×844, 768×1024, 1024×768 et 1440×900.

- [ ] **Step 3: Vérifier le parcours express**

À 390 px : signer deux engagements, démarrer, vérifier 15 dossiers/3 actes, adopter/rejeter/ajourner, déclencher une crise, recharger, reprendre, terminer, ouvrir l'historique, copier le bilan et lancer la revanche.

- [ ] **Step 4: Vérifier accessibilité et gestes**

Parcourir mission, conseil, crise et verdict uniquement avec Tab/Entrée/Espace. Vérifier focus visible, ordre logique, aucun focus derrière une séquence `aria-busy`, libellés des deltas, cibles de 44 px et aucune information portée par la couleur seule.

- [ ] **Step 5: Vérifier reduced-motion**

Activer `prefers-reduced-motion: reduce`, poser trois décisions et confirmer : aucun tampon tournant, aucun délai de 1,8 seconde, mais le texte d'impact est annoncé et la carte suivante est accessible.

- [ ] **Step 6: Vérifier le mode intégral**

Depuis la mission, ouvrir « Conseil intégral · 96 mesures » et confirmer que les 96 cartes, exclusions, télex, chrono, sauvegarde, défi et verdict historiques restent utilisables.

- [ ] **Step 7: Vérifier le budget frontend**

Après `npm run build`, mesurer le principal fichier JS de `site/dist/assets/`. La modification ne doit pas ajouter plus de 40 Ko compressés et aucune image lourde ne doit être requise par le tunnel.

- [ ] **Step 8: Commit de finition**

```bash
git add site/src site/scripts
git commit -m "test: valider le conseil de crise sur mobile"
```

---

## Execution Notes

- Exécuter dans un worktree dédié créé au démarrage de l'implémentation.
- Utiliser un worker TERRA par tâche, avec revue du respect du plan puis revue de qualité avant la tâche suivante.
- Ne pas pousser ni déployer sans demande explicite ; livrer d'abord le diff, les tests et le build local.
- La spécification a été commitée localement dans `83c5260` avant ce plan.
