# Reprise du dossier fournitures scolaires — 20 septembre 2026

## Contenu

Le dossier explique désormais les hausses récentes, les coûts du papier et de
l’énergie, les différences entre marques et magasins, les listes scolaires et
le financement des achats. Les deux illustrations affichent une hausse en
pourcentage et un panier en euros. La route et les ancres historiques restent
stables. La réponse courte et les descriptions de recherche sont cohérentes avec
le nouveau texte. Aucun autre dossier n’est réécrit.

Le contrôle visuel a aussi révélé que le formateur éditorial héritait de l’échelle
en millions d’euros des budgets publics. Un panier de 211,10 euros apparaissait
ainsi à 0,00 M€. Les montants éditoriaux en `EUR` sont désormais affichés en euros
avec leurs centimes. Le formateur des budgets publics reste inchangé. Une
régression unitaire et les assertions sur les quatre étiquettes du graphique
reproduisent le défaut avant correction et vérifient les montants ensuite.

## Vérification des chiffres

Lecture directe de la Banque de données macroéconomiques de l’Insee le
20 septembre 2026 (réponses `SERIES_BDM`), et non reprise des anciennes valeurs :

| Série | Année | Observation vérifiée |
| --- | --- | --- |
| 001765036, autres fournitures scolaires et de bureau | 1990 | 64,70 |
| 001765036 | 2015 | 100 |
| 001765036 | 2021 | 101,08 |
| 001765036 | 2025 | 113,02 |
| 001764363, ensemble des prix | 1990 | 67,40 |
| 001764363 | 2015 | 100 |
| 001764363 | 2025 | 120,95 |

Les valeurs d’ensemble 62,10 et 119,37 présentes dans l’ancien dossier ne
correspondent pas aux observations retournées. Le calcul corrigé donne environ
79 % depuis 1990, contre environ 75 % pour les autres fournitures. Les observations
2025 sont marquées `OBS_STATUS=A` et `OBS_QUAL=DEF`, pas provisoires.

Le panier Familles de France comprend du matériel scolaire et des articles de
sport. Sa rétrospective 2022–2025 est publiée page 10 du dossier de presse 2025 :
208,12 ; 226,33 ; 223,46 ; 211,10 euros. Le graphique ne transforme pas ces
montants en dépense de toutes les familles.

Les sources couvrent consommateurs (UFC-Que Choisir, Familles de France), familles
et revendications de gratuité (CSF), industrie papetière (COPACEL), administration
(Insee, Éducation nationale, Cnaf) et distribution (enquête du Monde). Le point de
vue des industriels et la demande de gratuité sont attribués, pas présentés comme
des conclusions consensuelles. Les chiffres de rentrée sont explicitement datés
de 2025 : le dossier ne les présente pas comme des prix de rentrée 2026.

## Relecture TypeSafe demandée par le propriétaire

Deux appels réels à `POST https://api.typesafe.ai/v1/systemone`, modèle retourné
`jev-1.13.0`, ont comparé l’état avant et après réécriture. Le dossier Groenland
était fourni comme référence de construction, avec des questions distinctes sur
le jargon, la répétition et l’apport concret de chaque section. Deux exemples
témoins opposaient une phrase en base statistique à une phrase en euros.

La probabilité renvoyée pour la présence de développements répétitifs est passée
de 0,52 à 0,15. Les deux anciennes sections sur les quantités et le réemploi
étaient signalées à 0,79 et 0,73 ; chaque section réécrite était à 0,17 ou moins.
Ces résultats guident la relecture : ils ne constituent pas une certification
de qualité ou de véracité. Jev n’a pas produit la prose et les calculs sont
vérifiés séparément. Consommation des deux appels : 11 155 jetons d’entrée et
476 jetons de sortie. La dernière précision de rédaction remplace « un peu plus
de 10 % » par « près de 12 % », conformément au calcul 2021–2025 (11,81 %).

Les identifiants d’API et leur stockage restent hors du dépôt, du navigateur
public et des journaux de CI. Aucun appel TypeSafe n’est ajouté au site publié.

## Contrôles reproductibles

- `node --experimental-strip-types --test src/fournitures-editorial.test.ts` depuis
  `site/` : quatre régressions, constatées en échec avant les corrections puis
  réussies après, portant sur les unités publiques, le calcul historique, le
  panier en euros et la réponse courte.
- `npm run check` depuis `site/` : tests unitaires, types et construction complète.
- `npm run test:mandats -- editorial-tabs.test.mjs` : parcours éditoriaux et
  captures du dossier fournitures, sur les profils configurés.
- `python -m plateforme.controle_analyses ../site/analyses` depuis `pipeline/` :
  validation déterministe des douze dossiers.

La publication doit être suivie d’une comparaison des textes réellement servis
avec le JSON validé ; une construction locale n’est pas une preuve de déploiement.
