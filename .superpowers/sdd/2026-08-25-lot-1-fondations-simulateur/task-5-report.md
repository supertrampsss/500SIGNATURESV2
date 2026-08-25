# Task 5 — Conséquences persistantes

## Résultat

Les télex et les crises portent désormais la classe
`.tunnel-evenement--persistant`. Ils restent entièrement pilotés par
`telexEnCours` ou `criseEnCours`, avec leurs seules actions explicites ; aucun
timer ni changement du moteur, de la persistance ou des gardes BFCache.

## RED

- Ajout du test `un télex ouvert occupe seul un écran d'événement persistant`.
- Commande : `node --experimental-strip-types --test --test-name-pattern="télex ouvert occupe seul" src/tunnel.test.ts`.
- Échec observé : absence de `tunnel-evenement--persistant` dans le rendu du
  télex ouvert.

## GREEN

- Les wrappers de télex et de crise reçoivent
  `.tunnel-evenement--persistant` et conservent `aria-live="assertive"`.
- Le test garantit qu'un télex à simple poursuite expose
  `data-action="poursuivre"` et aucune action ordinaire
  `data-geste="adopter"`.
- `tunnel.ts` est volontairement inchangé : le contrôleur et la machine d'état
  possédaient déjà les transitions explicites requises.

## Vérifications

- Test ciblé : 1/1 vert.
- `node --experimental-strip-types --test src/tunnel.test.ts src/tunnel-evenements.test.ts` : 90/90 verts.
- `npm test` : 1 239/1 239 verts.
- `git diff --check` : vert.

## Préoccupations

- Aucune. Les avertissements Node sur le type stripping sont préexistants et
  non bloquants.
