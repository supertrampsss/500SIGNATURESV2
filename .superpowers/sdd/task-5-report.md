# Task 5 - Moteur V3 : crises et concessions traçables

## Réalisé

- Ajout de `crises.ts` : détection déterministe des crises selon le seuil, les décisions aggravantes réellement confirmées, l'ordre déclaré des règles et les crises déjà résolues.
- Les concessions ne sont proposées que lorsqu'elles visent une décision encore active (`confirmed` ou `amended`). Elles appliquent effectivement `suspended`, `amended` ou `reversed` au registre de décision et portent l'identifiant de la crise.
- La résolution conserve une trace complète : choix retenu, crise clôturée, identifiant résolu une seule fois et effets dans le journal causal avec `sourceType: "crisis"`.
- `hold-course` est réservé, applique son coût politique sans modifier de décision et renvoie à la lecture du résultat.

## TDD

- RED constaté : le test de crise échouait avec `ERR_MODULE_NOT_FOUND` sur `crises.ts`.
- GREEN vérifié après l'implémentation : 8/8 tests ciblés, dont les contrats fournis et les cas d'ordre des règles, crise déjà résolue/active, décision amendée, amendement, renversement, historique et causalité.

## Vérifications

- `node --experimental-strip-types --test --test-name-pattern="crise|concession|maintenir le cap" src/simulateur-v3/*.test.ts` - 12/12.
- `node --experimental-strip-types --test src/simulateur-v3/*.test.ts` - 51/51.
- `npm test` - 1 406/1 406.
- `npm run build` - succès.

## Auto-revue

- Les fonctions conservent l'immuabilité : les registres de décision, l'historique et le journal causal ne sont clonés que lorsqu'ils changent.
- La concession demandée est validée dans les offres réellement disponibles avant toute écriture ; une résolution inconnue ou obsolète est refusée.
- Une crise active n'est jamais écrasée et une crise déjà résolue ne peut être redéclenchée.
- `git diff --check` est propre.

## Note

- Le build Vite signale le chunk client existant supérieur à 500 kB ; il termine néanmoins avec succès et cette tâche n'ajoute pas de dépendance ni de bundle applicatif.
