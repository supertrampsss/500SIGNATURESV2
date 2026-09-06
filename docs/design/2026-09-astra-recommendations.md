# Reprise ASTRA et recommandations X

## Contexte produit

500 signatures explique les finances publiques et permet de simuler des décisions.
Public francophone, téléphone en priorité. Le contrat actuel reste dans `AGENTS.md` :
45 décisions sur cinq ans, validation directe, position de lecture conservée,
sources distinctes des hypothèses et sauvegardes compatibles.
La référence graphique reste `larashero3-dotcom/lieflat-charts` ; aucune reprise de code.

## Publications lues le 6 septembre 2026

| Source | Proposition | Application dans ce dépôt |
|---|---|---|
| [MaxForAI](https://x.com/maxforai/status/2096131966647279660) | Contexte expérimental avec notes et historique recherchable | Option préparée dans `.codex/config.toml`. Activation effective non vérifiable dans Work. |
| [Machina, réglages](https://x.com/EXM7777/status/2096599803300123077) | Raisonnement faible, fenêtre à un million de tokens, compaction à 400 000, instructions globales vides | Raisonnement `low` préparé pour le client local. Limites laissées au modèle ; instructions conservées. |
| [Machina, prompt](https://x.com/EXM7777/status/2096343368121164050) | Examiner l’historique, séparer faits et interprétations, identifier le travail répété et suivre les résultats | Adaptation au projet : état du travail, décisions et preuves consignés ici. Pas d’analyse personnelle ni de collecte de conversations sans rapport. |
| [Sarvesh, SEO](https://x.com/bloggersarvesh/status/2095896040155340809) | Contexte, audit de pages, titres, extraits, maillage et performances de recherche | Métadonnées précisées sur les pages existantes. Les tâches Google Business Profile concernent des commerces locaux, pas le produit décrit. |

La [documentation officielle Codex](https://learn.chatgpt.com/docs/config-file/config-reference)
confirme l’option expérimentale et la nécessité d’une connexion ChatGPT éligible.
Le fichier de configuration prépare les prochaines sessions d’un client compatible ;
il ne modifie pas une tâche Work en cours. Aucun client `codex` n’est disponible ici
pour confirmer son chargement. Aucune économie de quota n’a été mesurée.
La documentation décrit les limites de contexte et de compaction comme des paramètres,
sans établir que les valeurs du tweet conviennent à cette session.

## Changements SEO

Les titres France, Analyses et Salaires nomment désormais leur sujet et 500 signatures.
La description France et celle de l’index Questions sont plus concises et destinées
au lecteur. Quatorze descriptions spécifiques remplacent les longs verdicts dans
les métadonnées des analyses et réponses. Les verdicts complets restent dans les pages.
Les liens canoniques, sources, routes et liens internes existants sont préservés.

L’audit local initial couvre les HTML de `site/dist`. Il relève des descriptions
atteignant 576 caractères encodés et un titre identique entre la réponse sur le premier
achat immobilier et son analyse détaillée. La correction des extraits évite de tronquer
automatiquement un verdict. La longueur est un choix éditorial, pas une garantie SEO.
Les deux H1 du document France correspondent aux vues France et Territoires du shell ;
le simple comptage du HTML ne démontre pas deux titres visibles.

Les guides et le jeu Mandats portent encore `noindex` pendant validation.
Cette consigne existante est conservée. Aucun classement, volume de recherche, CTR,
gain de trafic ni délai de résultat n’est disponible. Les audits GSC et SEMrush
nécessitent les données de ces comptes ; ils ne sont pas remplacés par des estimations.
Les pages communales doivent apporter des données réellement disponibles, pas des
textes générés en série à partir de noms de villes.

## État de reprise

Branche : `feat/france-territoires-charts`.
Avant cette reprise : trois commits de refonte et corrections des graphiques,
puis modifications non commitées de `data-studio.css` et `editorial-tabs.test.mjs`.
Ces deux modifications préexistantes sont conservées, sans les attribuer à ce lot.
Le dernier `npm run check` avant les modifications SEO passait.
La première installation des navigateurs avait été refusée par le contrôle automatique.
Le propriétaire a ensuite explicitement demandé de débloquer cette validation.
Le téléchargement Chromium a expiré ; il a été arrêté. La vérification directe
ci-dessous utilise le navigateur intégré déjà disponible.
Le lot SEO passe `npm run check` : 1 379 tests, vérifications TypeScript,
compilation Vite, pré-rendu des pages, guides et ressources hors connexion.
Les quatorze extraits passent aussi un contrôle direct de longueur et d’injection
des métadonnées. La configuration est syntaxiquement valide en TOML.
Le HTML final de 19 pages éditoriales présente des descriptions de 155 caractères
au maximum, des extraits Open Graph cohérents et les canoniques attendues.
Aucune analyse ou réponse pré-rendue n’est sans lien entrant dans ce corpus HTML.
Ce contrôle ne mesure pas l’indexation effective par Google.
Aucune nouvelle publication ni fusion n’a été réalisée pendant cette reprise.

## Validation visuelle débloquée le 6 septembre 2026

Contrôle direct dans Chromium, via l’aperçu supervisé, sur les données chargées par
le site. France et Bordeaux inspectés sur ordinateur. France, Bordeaux et Paris
inspectés dans des cadres de 390 et 320 pixels, avec et sans thème sombre.
Ces cadres vérifient les mises en page responsives ; ils ne simulent pas iOS ou le tactile.

- France : commandes Home/End, années 2000 et 2025 correctement reflétées.
- Territoires : vues Budget, Dette et Investissement activables, recherche Bordeaux fonctionnelle.
- Bordeaux à 390 pixels : passage clavier de 2022 à 2023, position de lecture
  maintenue à 857 pixels pendant la modification.
- Deux défauts trouvés et corrigés : unité du graphique secondaire communal
  et débordement des barres secondaires à 320 pixels.
- Le graphique communal utilise maintenant des millions sur l’axe et la légende,
  sans changer les montants. Un test de régression couvre ce cas.
- Largeurs finales mesurées : 310/310 et 380/380 pixels pour contenu/défilement,
  les barres de défilement du navigateur occupant les 10 pixels restants des cadres.
- La carte WebGL est indisponible dans ce navigateur ; les fiches et graphiques
  restent utilisables. Safari, gestes tactiles, appareils physiques et suite
  Playwright complète ne sont pas validés par cette inspection.

Le fichier temporaire de cadres de validation a été supprimé du projet.
Les finitions de thème préexistantes sont conservées. La validation unitaire
après correction passe 1 380 tests, avec zéro échec.
