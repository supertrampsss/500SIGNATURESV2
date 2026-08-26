# Lot 3 — Sources et méthode

## Réalisé

- La page canonique `/sources/` est désormais titrée « Sources et méthode ».
- Son rendu autonome assemble les jeux du manifeste, la méthode, la grille de
  verdicts puis le registre des fiches, en conservant les identifiants de
  fiches pour les liens profonds.
- La bande de confiance de l'accueil pointe vers `/sources/`.
- Le cadre `#methode-sources` et son attribution ont disparu de `/bilan/`.
- Le pré-rendu fournit les métadonnées propres de la page Sources et méthode et
  le bilan ne reçoit plus que ses contenus France.

## TDD et vérifications

- RED observé : `npm test -- src/methode-rendu.test.ts src/accueil.test.ts scripts/prerendre.test.ts` a échoué sur le nouveau contrat de page /sources/ et l'ancien branchement du pré-rendu.
- GREEN : les tests ciblés passent (116 tests).
- Suite complète : `npm test` — 1 312 tests, 0 échec.
- Build : `npm run build` passe ; contrôle des documents pré-rendus confirmé :
  titre et ordre dans `dist/sources/index.html`, absence du cadre dans
  `dist/bilan/index.html`.
- `git diff --check` passe ; les seuls avertissements du build restent le poids
  historique du chunk Vite et l'avertissement expérimental Node.

## Réserve

Aucune réserve fonctionnelle.
