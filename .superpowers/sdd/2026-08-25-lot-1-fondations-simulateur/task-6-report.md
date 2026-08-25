# Task 6 — Verdict final

## RED

- Test ajouté : `le verdict hiérarchise le bilan en cinq blocs sans décorations concurrentes`.
- Commande : `node --experimental-strip-types --test --test-name-pattern="le verdict hiérarchise" src/tunnel.test.ts`
- Résultat initial : échec attendu, les cinq blocs `verdict__*` étaient absents.

## GREEN

- `renduVerdict` présente désormais, dans l'ordre, le résultat et l'objectif, le profil de mandat, les gestes décisifs, les soutiens et conséquences, puis les actions. Les quinze choix sont repliés dans `details.verdict__details`.
- Les décorations restent calculées et collectionnées pour compatibilité, sans rendu concurrent ; les attributs d'action de revanche, comparaison et partage sont présents, et le partage conserve son flux existant.
- CSS mobile-first ajouté : largeur bornée, contenus sécables, boutons de 44 px minimum et grille d'actions adaptée au bureau.
- Vérifications vertes : test ciblé, `src/tunnel.test.ts` (74/74), `npm test` (1239/1239), `npm run build`.

## Auto-revue

- `git diff --check` : propre.
- Aucun calcul de score, profil, soutien, sérialisation de défi ou logique de partage modifié.
- Avertissement Vite préexistant : chunk JavaScript supérieur à 500 kB ; build réussi.
