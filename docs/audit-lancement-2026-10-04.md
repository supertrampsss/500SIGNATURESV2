# Audit de lancement du 4 octobre 2026

## Résultat et périmètre

Relecture des 13 dossiers publiés, rapprochement des chiffres principaux avec leurs sources primaires, vérification des périodes, unités et limites. Cette revue n'est pas une certification de chaque phrase ou de chaque source secondaire. Les dates de consultation ont été modifiées seulement pour les sources effectivement consultées.

Les corrections portent sur la lecture et le fonctionnement du site. Elles ne permettent pas de garantir l'approbation AdSense. Le motif communiqué par Google est « contenu à faible valeur informative ». Le nombre de mots et l'existence de visites ne suffisent pas à déterminer l'éligibilité.

## Revue des dossiers

| Dossier | Vérification principale | Résultat |
|---|---|---|
| Âge du premier achat | PDF Insee « Les conditions de logement en France », figure par génération : 33,5 ans pour la génération 1952, 38 pour 1964. Distinction cohortes / âge des acheteurs d'une année. | Chiffres centraux cohérents. |
| Prélèvements 2024 | Eurostat gov_10a_taxag, D2_D5_D91_D61_M_D995, S13, PC_GDP, 2024 : France 45,2 %, Danemark 45,4 %, UE 40,2 %, jeu actualisé le 21 juillet 2026. | Périmètre incluant les cotisations imputées explicité. Les valeurs plus anciennes de la publication d'octobre 2025 ne remplacent pas celles du jeu courant. |
| Coût du travail | OECD Taxing Wages 2026, données 2025, célibataire sans enfant au salaire moyen : net France 52,8 %, employeur 26,7 %, salarié 8,3 %, IR 12,2 %. Comparaisons Allemagne, Italie, Espagne. | Profil et dénominateur déjà corrigés, valeurs confirmées. |
| Défense France 2025 | Rapport du Sénat : 59,946 Md€ votés, 62,124 Md€ consommés. | Mention « pensions comprises » ajoutée. Ce périmètre diffère des crédits de défense hors pensions souvent cités. |
| Défense Europe | Eurostat COFOG GF02 : UE 266 Md€ en 2024, 232 en 2023, 176 en 2020. | Valeurs et distinction avec les données EDA cohérentes. |
| Électricité exportée | Bilan RTE 2025 : solde 92,3 TWh contre 89 en 2024, prix spot français 59 €/MWh. CRE : TRVE 239 €/MWh contre 281 en 2024. | Distinction spot, contrats et facture conservée. Une valorisation indicative n'est pas une recette contractuelle. |
| Fournitures scolaires | Séries annuelles Insee 001765036 : 64,7 en 1990, 113,02 en 2025 ; 001764363 : 67,4 puis 120,95. Familles de France 2025 : 211,10 € contre 223,46 €. | Variations centrales et panier courant confirmés. Les paniers d'associations ne sont pas des séries strictement comparables entre eux. |
| Groenland | Communiqué danois du 22 septembre et accord signé. | Signature distinguée de l'entrée en vigueur ; aucun statut de projet non signé à rétablir. |
| Dépense publique | Insee 2025 : 57,3 % du PIB et 1 714,2 Md€, hausse de 2,5 %. 2024 : 57 %. 2013 : 58,6 %. | Années et évolution déjà corrigées, confirmées. |
| Gaz des ménages | Eurostat nrg_pc_202, ménages D2 20 à 199 GJ, France : TTC 0,1008 €/kWh en 2022 S2, 0,1436 en 2025 S2 ; hors taxes 0,0754 et 0,0998. | Hausse et décomposition taxes / hors taxes confirmées. |
| Retraites | Eurostat gov_10a_exp D62/GF1002 : 362 178,4 M€ ; gov_10a_main : rémunérations 363 038 M€, recettes 1 503 590,1 M€, 2024. | Référence du chiffre principal corrigée vers gov_10a_exp. Prestations en espèces liées à la vieillesse, minima compris et survie exclue, explicitées. |
| Satisfaction de vie | Insee 2024 : 7,2/10. Insee 2023 : 7,8 pour le cinquième le plus aisé, 6,6 pour le moins aisé. | Millésimes, population et ruptures d'enquête distingués. |
| Ukraine | Page du Conseil consultée le 4 octobre, mise à jour le 24 septembre : 14,9 Md€ versés, dont 3,2 d'aide macrofinancière et 11,7 pour la défense, sur un prêt de 90 Md€. | Ancienne valeur 11,6 actualisée à 14,9, soit 16,6 %. Date de consultation distincte d'une date de décision. |

Les URL primaires restent reliées à chaque dossier. Les définitions et les précautions figurent en fin d'article, accessibles sans JavaScript.

## Corrections de fonctionnement

- Accueil : conserver le contenu publié et les liens lorsqu'une requête de données échoue ; ajouter l'alerte sans remplacer la page.
- Dossiers : afficher un état vide pour une recherche sans résultat, permettre d'effacer les filtres et rendre le focus au champ. Les filtres restent cachés sans JavaScript ; les 13 dossiers restent lisibles.
- Mandats : supprimer le débordement de l'ancien bandeau national ; réduire la hauteur de la scène sur téléphone court pour garder le premier choix accessible. Aucun changement des règles, des sauvegardes ou des fins politiques.
- Parcours automatisés : actualiser les attentes obsolètes vers les compositions publiées, ouvrir le menu mobile et faire un choix de consentement lorsque la bannière recouvre un contrôle.

## Analytics : réception réelle

Propriété GA4 557190574, identifiant G-TYHM099XE8. Test effectué dans un navigateur connecté à Analytics et sur le site public : acceptation de la mesure d'audience, visite de /analyses/, puis du dossier de défense française. Le rapport Pages en temps réel reçoit un utilisateur actif et deux vues pour ces deux chemins. Il s'agit de visites de validation, pas d'une preuve d'audience organique.

La capture du rapport est conservée sous analytics-validation-20261004.jpg. Les tests du consentement vérifient séparément l'absence de chargement avant accord et la révocation. Aucune activation publicitaire n'est ajoutée.

## Search Console : état constaté

Inspection des 35 URL du sitemap via la propriété sc-domain:500signatures.fr :

- 1 URL « Submitted and indexed » : /bilan/.
- 17 URL « Discovered - currently not indexed ».
- 16 URL « URL is unknown to Google ».
- 1 URL « Page with redirect » : la racine, selon une exploration du 14 septembre.

La racine répond actuellement HTTP 200 avec une canonique vers elle-même. L'ancien état de Google n'est pas un test du comportement actuel. Les résultats exacts, URL par URL, sont dans [indexation-2026-10-04.json](indexation-2026-10-04.json). Une page techniquement indexable peut rester non indexée : la découverte, l'exploration et la décision d'inclusion appartiennent à Google.

L'audit en ligne de la racine, /bilan/, /analyses/ et /a-propos/ trouve HTTP 200, canonique propre et aucun obstacle critique, élevé ou moyen. Les observations de faible sévérité sur les images décoratives à alt vide, les titres d'une vue cachée et la taille HTML non compressée ne constituent pas à elles seules des défauts d'indexation. Les pages de dossier possèdent leurs données structurées Article.

## Éditeur et contact

Le propriétaire conserve la présentation du projet et les contacts actuels GitHub et X. Ne pas inventer de nom personnel, d'adresse, d'e-mail ni de formulaire sans destinataire. /a-propos/ explique le projet, les corrections et l'assistance IA.

## Validation et limites

Validation locale : 1 082 tests unitaires réussis et build complet, avec pré-rendu des dossiers, guides et bundle hors connexion. Les rapports de navigateur sont produits dans les dossiers d'artefacts habituels. La validation définitive des navigateurs, notamment WebKit, appartient à la CI liée à la PR ; consulter son résultat avant de fusionner.

La correction est réversible par retour du commit. Les règles de Mandats et le stockage ne migrent pas. Les risques résiduels sont l'évolution ultérieure des sources, les décisions d'indexation et d'approbation de Google, et les différences de rendu non couvertes par les parcours testés.

