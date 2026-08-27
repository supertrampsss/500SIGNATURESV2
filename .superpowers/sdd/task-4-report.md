# Task 4 — Moteur V3 : effets et causalité

## Réalisé

- Ajout de `effects.ts` : application immuable des effets immédiats, planification des effets différés, événements et promesses, confirmation atomique, verrous et déverrouillages.
- Journal causal déterministe, avec la cause lisible de chaque variation.
- Résolution des événements et promesses échus, avec transfert des événements dans `eventHistory`.
- Extension de l'état V3 et de sa validation : les sources du journal causal sont désormais vérifiées contre les décisions confirmées, événements en attente ou historiques, promesses, et crises.
- Tests de persistance JSON après confirmation et après événement résolu.

## TDD

- RED constaté pour le module d'effets absent.
- RED constaté pour les invariants de persistance (source causale de décision invalide et historique d'événements absent).
- GREEN vérifié par les tests ciblés et la suite V3.

## Vérifications

- `node --experimental-strip-types --test --test-name-pattern="effets immédiats|effet différé|conserve sa cause|promesse|verrou" src/simulateur-v3/effects.test.ts src/simulateur-v3/campaign.test.ts` — 7/7.
- `node --experimental-strip-types --test src/simulateur-v3/*.test.ts` — 34/34.
- `npm test` — 1391/1391.
- `npm run build` — succès.

## Auto-revue

- Les branches non modifiées conservent leurs références (indicateurs, groupes et listes) ; seule la branche concernée est clonée.
- Les effets différés ne passent jamais par `applyEffect` avant leur résolution.
- Les événements résolus quittent la file et restent auditables dans `eventHistory`.
- `git diff --check` est propre.
