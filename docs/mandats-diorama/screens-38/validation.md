# Itération 38, maison intégrée et carte encore non conforme

Le 11 octobre 2026, la branche `codex/mandats-reference-3d-20261008` reprend
l'atelier CC0 du 9 octobre. Cette étape adopte une maison finie à ses deux adresses
existantes de Besançon. Elle ne termine pas la reconstruction du diorama national.

## Export et intégration

- Détail : 1 481 triangles, une primitive, atlas 512 pixels.
- Distance : 695 triangles, une primitive, atlas 128 pixels. L'ancien candidat à
  287 triangles est écarté après constat de trous sur la planche Babylon.
- GLB de maison : 487 872 octets, SHA256
  `e41d5ca2596b152a98a95e63b06f89b04786df1c0a14526808280b51e4ecc600`.
- Kit composé : 11 597 372 octets, soit 487 660 octets de plus que le kit initial.
  Les 70 autres racines actives, les tableaux d'origine et leur préfixe binaire
  restent identiques. Les données de l'ancienne maison restent inutilisées dans
  le buffer ; aucune compression générale du kit n'est revendiquée.
- Deux générations Blender produisent le même GLB. Une composition depuis le
  commit initial `5cf6fcf4b0783188e21e27e38f9666ba0ff9946f` reproduit le kit et
  ses métadonnées octet par octet.

L'[audit strict](house-atlas-audit.json) contrôle les dimensions identiques des
deux niveaux, le pied Y=0, les nombres de triangles, les normales, les six images
embarquées et le contrat des canaux PBR. Le [contrôle physique et de caméra](placement-and-lod.json)
utilise les vrais constructeurs de terrain et de villes et le GLB distribué, dans
une scène isolée explicitement distincte du jeu. Il retrouve les deux adresses,
les 781 maisons de la scène et le passage entre les deux niveaux malgré leurs
matériaux différents. Les pieds restent 0,003 et 0,004293 unité au-dessus du
maximum du terrain sous leur emprise, dans la marge d'appui existante.
L'[inspection des raccords](lod-pair-audit.json) parcourt les 46 paires actives
des quatre kits : seule `maison_alsace_01` demande le nouveau raccord entre deux
matières distinctes. Pour les autres paires, le chargeur garde son critère existant de matière partagée.

## Construction et parcours

`NODE_USE_ENV_PROXY=1 npm run check` réussit sur le nouvel export final, après
la correction de l'occlusion : 1 082 tests, contrôles TypeScript, construction,
pré-rendu éditorial et 147 ressources hors connexion, version `c71c7b88a530f451`.
Le [journal complet](check.log) et sa [section build](build-final.log) sont conservés.
Les scripts Python passent la compilation syntaxique et `git diff --check`.

Les quatre suites originales sont terminées sur le build final, après correction
de l'occlusion. Les délais et assertions restent inchangés.

- `rework` : 23 réussites, 0 échecs, 9 omissions prévues, 0 résultat instable ; code de sortie 0.
- `social` : 13 réussites, 0 échecs, 3 omissions prévues, 0 résultat instable ; code de sortie 0.
- `header` : 3 réussites, 0 échecs, 0 omissions prévues, 0 résultat instable ; code de sortie 0.
- `mandats` : 235 réussites, 0 échecs, 65 omissions prévues, 0 résultat instable ; code de sortie 0.

Les [résultats détaillés et empreintes](browser-summary.json) et les rapports
originaux [rework](rework-report.json), [social](social-report.json),
[header](header-report.json) et [mandats](mandats-report.json) sont conservés avec
leurs journaux. Les omissions viennent des conditions originales de projet,
notamment les cycles hors connexion et les scénarios longs réservés à un profil.
La suite rework vérifie DPR 2, redimensionnement et reprise, mandat complet et
rejeu, mobilisation et livraison, GLB retardés ou indisponibles, WebGL indisponible
ou perdu et jeu 3D hors connexion. La suite social couvre financement différé,
rejets de lois, imports falsifiés et mobilisation persistante. Header couvre
navigation publique répétée et accès au site depuis Ma partie aux trois formats.
Test:mandats couvre les parcours généraux et les liens historiques sur cinq profils.
Les captures, entrées et rapports HTML complets restent également dans les dossiers
`site/rework-artifacts/`, `site/social-artifacts/`, `site/header-artifacts/` et
`site/playwright-report-mandats/`. Les contrôles CI seront déclenchés par le push.

## Conditions de reproduction

Machine cloud Debian 13, Node 24.19.0, Python 3.12.14, Blender 4.3.2 et
Playwright 1.62.1. Chromium utilise `/usr/bin/chromium`, version 154.0.8037.57,
avec SwiftShader. WebKit 26.5 utilise le navigateur Playwright 2336 et les
bibliothèques Debian installées dans un répertoire utilisateur. Son exécutable
est indiqué par le mécanisme existant `MANDATS_WEBKIT_EXECUTABLE`, sans changer
les configurations du dépôt. Le [wrapper effectivement utilisé](webkit-local-executable.sh)
est conservé. Ces navigateurs cloud ne mesurent pas la fluidité
sur un téléphone physique.

```bash
cd site
MANDATS_CHROMIUM_EXECUTABLE=/usr/bin/chromium MANDATS_WEBKIT_EXECUTABLE=/workspace/mandats-browser-libs/run-webkit.sh npx playwright test --config playwright.rework.config.ts
MANDATS_CHROMIUM_EXECUTABLE=/usr/bin/chromium MANDATS_WEBKIT_EXECUTABLE=/workspace/mandats-browser-libs/run-webkit.sh npx playwright test --config playwright.social.config.ts
MANDATS_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx playwright test --config playwright.header.config.ts
MANDATS_CHROMIUM_EXECUTABLE=/usr/bin/chromium MANDATS_WEBKIT_EXECUTABLE=/workspace/mandats-browser-libs/run-webkit.sh PLAYWRIGHT_JSON_OUTPUT_NAME=/workspace/mandats-iteration38/mandats-report.json PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report-mandats npm run test:mandats -- --reporter=list,html,json
```

Le dernier appel ajoute seulement le rapport JSON au parcours habituel.
Les configurations originales restent celles du dépôt. Les suites sont lancées
successivement afin de ne pas cumuler leurs scènes 3D sur le GPU logiciel.

## Captures réellement examinées

La [comparaison 38](../comparaison-38.html) conserve la référence originale intacte,
les vues avant/après et les diagnostics de maison. Les quatre vues natives finales
utilisent une nouvelle session Chromium à 1 672 × 941, DPR 1, mouvement réduit,
version 12, graine 0, ambition `equilibre` et zéro décision. Elles utilisent les
contrôles HTML natifs, sans interception réseau, injection de caméra ou d'état.
Leurs JSON consignent les empreintes des corps JS/CSS effectivement reçus et les
ressources. Aucun échec JavaScript, requête ou HTTP n'est enregistré. Le message
de console d'information Babylon reste consigné.

Les vues préalables utilisent le kit initial, version
`architecture.glb?v=bf89b1435204c6ab`. Leur champ générique `productionBuild`
porte le nom de la session d'itération 38 ; ce champ ne les transforme pas en
captures du kit final. Leurs ressources et empreintes identifient le build initial.
Le [résumé des captures](capture-summary.json) conserve leurs SHA et cette distinction.

À 390 pixels, la carte et les titres restent lisibles et les trois réponses sont
accessibles ; la troisième demande un défilement. Le diorama conserve ses limites
artistiques visibles sur ordinateur : cathédrale trop massive, reliefs anguleux,
contexte et végétation répétitifs, campagne et ports moins fins que la maquette.
Les raccords du toit du nouveau modèle distant restent perfectibles.

Le [contrôle de cuisson AO](ao-correction.json) distingue le premier export de la version finale : les deux niveaux sont masqués l’un pour l’autre pendant la cuisson. La première suite rework, avant cette correction, avait 23 réussites et neuf omissions ; les résultats ci-dessus proviennent des nouvelles exécutions après la reconstruction corrigée.

Le verdict artistique est **NONCONFORM**. La PR reste en brouillon. Les succès de
construction et d'appui ne constituent pas une validation de la carte complète.
