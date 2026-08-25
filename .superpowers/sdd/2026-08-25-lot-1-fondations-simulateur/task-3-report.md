# Task 3 — Présenter la mission sans bruit

## RED

- Le test `la mission expose le déficit, les deux modes et une seule entrée` a été renforcé dans `site/src/tunnel.test.ts`.
- Il vérifie le titre du déficit, la définition imposée, les 15 et 96 mesures, l'état `aria-pressed`, un unique `data-action="commencer"` et l'absence de langage d'engagement, de contrat, de décompte, de pied technique ou de décoration.
- Commande exécutée : `node --experimental-strip-types --test src/tunnel.test.ts --test-name-pattern="la mission expose"`.
- Échec observé et attendu : la définition historique du déficit ne correspondait pas à la définition imposée.

## GREEN

- `renduMission` est ramené à un titre, le montant, la définition exacte, les deux modes et le CTA centré.
- Les actions `mode-express`, `mode-integral` et `commencer` sont conservées ; les modes restent simultanément visibles et marqués via `aria-pressed`.
- `styles/tunnel-cabinet.css`, importée après la navigation, présente le dossier ivoire dans la salle navy, avec Spectral/Public Sans déjà définies par les fondations. L'état actif repose sur son fond et son contraste, sans pseudo-élément ni marqueur latéral. Les cibles font au moins 44 px.
- Commande GREEN ciblée : `node --experimental-strip-types --test --test-name-pattern="la mission expose" src/tunnel.test.ts` — 1/1 vert.

## Vérifications

- `node --experimental-strip-types --test src/tunnel.test.ts src/interface.test.ts` — 220/220 verts.
- `npm test` — 1 238/1 238 verts.
- `npm run build` — succès (TypeScript, Vite et pré-rendu). Vite conserve son avertissement préexistant sur la taille d'un chunk (> 500 kB).
- `git diff --check` — aucune erreur d'espacement.

## Auto-revue

- Périmètre limité à l'entrée de mission et à sa feuille de style dédiée ; aucun changement des règles de décision ni du modèle.
- Le rendu ne contient qu'un CTA de démarrage et n'ajoute ni engagement, ni compte à rebours, ni footer technique, ni décoration.
- La cascade de la feuille dédiée est volontairement placée après navigation et surcharge l'ancien état actif par `[aria-pressed="true"]`.
