# Task 4 — Arbitrage éclair mobile

## Résultat

L'écran de décision ordinaire tient désormais dans une scène compacte : bandeau
mission (reste à trouver et progression), dossier ivoire (question et tension),
deux options avec conséquence budgétaire et politique/sociale, puis les deux
actions dans le même ordre. Les détails sont repliés dans un élément natif
`details`, sans modifier les gestes ni le moteur.

## RED

- Ajout du test `le conseil express rend un arbitrage éclair avec ses preuves à la demande`.
- Commande : `node --experimental-strip-types --test --test-name-pattern="arbitrage éclair" src/tunnel.test.ts`
- Échec observé : `0 !== 2` pour les options `tunnel-decision__option` attendues.

## GREEN

- Deux options `tunnel-decision__option`, sans panneau de soutiens visible.
- Une seule preuve repliable `data-details="preuve"`, qui contient gagnants,
  perdants, réactions complémentaires et précision de chiffrage.
- Les boutons gardent `data-geste="adopter|rejeter|ajourner|annuler"` et leur
  libellé est exactement celui de l'option correspondante, dans le même ordre.
- CSS mobile : cibles de 44 px, actions au-dessus de la safe area, `100dvh`
  en plein écran sous 40 rem ; dossier centré à partir de 60 rem.

## Vérifications

- Tests ciblés : 3/3 verts.
- `node --experimental-strip-types --test src/tunnel.test.ts` : 73/73 verts.
- `npm test` : 1 238/1 238 verts.
- `npm run build` : vert.

## Préoccupations

- Vite conserve son avertissement de taille de chunk JavaScript (> 500 kB),
  sans lien avec cette tâche.
- Le rendu a été vérifié structurellement et par build ; aucune capture sur un
  appareil physique n'a été produite dans ce worktree.
