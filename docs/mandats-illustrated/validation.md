# Carte illustrée : livraison du 15 octobre 2026

La carte utilise désormais l’illustration approuvée. Son relief, ses bâtiments,
ses villes et ses ports proviennent de cette image. Les anciens repères ont été
retirés localement pour laisser les sujets et conséquences de la vraie partie
apparaître par-dessus. Aucun moteur 3D ni modèle GLB n’est chargé par ce parcours.

[Comparaison complète](comparaison.html) · [Provenance de l’image](art-provenance.json)

## Rendu observé

Les captures viennent du navigateur à 1672 × 941, 390 × 844 et 320 × 740,
ainsi que de WebKit à 390 × 844 avec une densité de 2. Elles comprennent le
démarrage, le sujet des lycées ouvert, puis la mobilisation produite par le choix
de regroupement. Les fichiers JSON voisins gardent l’URL, les entrées sauvegardées,
les erreurs, les dimensions et les empreintes des ressources réellement reçues.
Ces captures ne présentent aucune erreur JavaScript ni débordement horizontal.

La maquette montre une autre année, d’autres scores et d’autres sujets : ces
valeurs illustratives ne remplacent pas celles calculées par le jeu. Sur mobile,
la carte entière conserve ses proportions et le panneau passe dessous. Le zoom
agrandit une illustration fixe ; les bâtiments ne sont plus des objets 3D.

## Contrôles exécutés

| Contrôle | Résultat | Preuve |
|---|---|---|
| Tests existants et types | 1 082 tests réussis, trois vérifications TypeScript | [Journal](reports/unit.log) et [build](reports/build.log) |
| Build complet | Pré-rendu, guides et 35 ressources hors connexion générés | [Journal](reports/build.log) |
| Parcours de carte | 23 réussis, 9 exclusions prévues, aucun échec | [Rapport](reports/rework.json), [journal](reports/rework.log) |
| Conséquences sociales | 13 réussis, 3 exclusions prévues, aucun échec | [Rapport](reports/social.json), [journal](reports/social.log) |
| Souris, clavier et toucher | 24 observations et assertions, aucune erreur | [Relevé](interactions.json) |

Les parcours couvrent les cinq années, les mobilisations, les projets, la reprise,
le rejeu, une image différée ou en échec et le cache hors connexion. Le changement
de support remplace les contrôles GPU par ceux de l’illustration ; les délais et
les configurations des parcours restent identiques. La fermeture d’un sujet
conserve le focus, y compris après un redimensionnement qui replace les repères.

La suite carte précède le dernier ajustement typographique des titres à 21 px ;
les captures finales et la suite sociale utilisent le build après cet ajustement.
La CI de la PR rejoue les suites et les 300 cas généraux Mandats/éditorial sur le
commit publié. Son résultat et le déploiement restent distincts de ces succès locaux.

## Reproduire

Depuis `site/`, lancer `npm ci`, `npm run check`, puis les configurations Playwright
`playwright.rework.config.ts` et `playwright.social.config.ts`. Les rapports complets
restent sous `site/rework-artifacts/` et `site/social-artifacts/` ; la CI les archive.
Le proxy réseau de l’environnement local nécessite `NODE_USE_ENV_PROXY=1` pour le
pré-rendu des données publiques. WebKit local utilise les bibliothèques Debian
extraites dans l’espace de travail ; les moteurs natifs restent utilisés.

Le [pilote de captures](capture.mjs) prend `MANDATS_PREVIEW_URL` (port 4194 par
défaut), `MANDATS_CHROMIUM_EXECUTABLE` et `MANDATS_WEBKIT_EXECUTABLE` si nécessaire.
Il ouvre `mode=national&v=12&seed=0&ambition=equilibre`, sélectionne les lycées et
choisit le regroupement via les vrais contrôles. Les décisions passent par le moteur normal, sans injection de sauvegarde.
