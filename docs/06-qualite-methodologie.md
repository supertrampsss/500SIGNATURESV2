# 06 — Livrable 6 : qualité, méthodologie, éditorial

## Charte de publication

Tout chiffre publié porte, en machine (`meta.*`, `core.*`) et à l'écran :

| Champ | Origine |
|---|---|
| Source primaire (toujours prioritaire sur toute source secondaire) | `source_registry` / `dataset_registry` |
| Date de publication par le producteur | `raw_assets.producer_last_modified` |
| Date d'extraction | `raw_assets.fetched_at` |
| Licence | `source_registry.license` |
| Version (du jeu et de la transformation) | `raw_assets.content_sha256`, `transformations.version` |
| Niveau territorial et millésime géographique | clé `(geo_level, geo_code, geo_vintage)` |
| Période | `observations.period` |
| Unité | `indicators.unit` |
| Ajustement saisonnier | `indicators.seasonal_adjustment` |
| Euros courants / constants / SPA | `indicators.price_basis` |
| Population de référence (dénominateur) | `denominator_indicator_id` |
| Méthode de calcul | `methodology_notes.formula` |
| Arrondis | règle globale : arrondi affiché ≠ arrondi stocké ; le stocké est brut |
| Marges d'erreur | `quality_flags` + note (enquêtes : IC affiché ou « enquête ») |
| Secret statistique | `value_status = 'confidential'` rendu « non publiable » |
| Rupture de série | `quality_flags = break_in_series` + note + trait visuel sur les courbes |
| Avertissements de comparabilité | panneau comparabilité (doc 04) |
| Historique des corrections | `change_log` (page publique) |

## Fiche indicateur — 10 points obligatoires

Chaque indicateur publié expose : 1) définition grand public ≤ 50 mots
(contrainte en base) ; 2) définition technique ; 3) formule ; 4) unité ;
5) source (+ lien) ; 6) période couverte ; 7) limites ; 8) lien de
téléchargement/endpoint du producteur ; 9) date de dernière mise à jour ;
10) niveau de confiance (`observed|computed|estimated`).
Un indicateur sans fiche complète **ne peut pas** passer `published = true`
(check de publication).

## Badges (vocabulaire contrôlé `indicator_definitions.badges`)

| Badge | Attribution (déterministe) |
|---|---|
| Officiel | source `access_category` A–D d'un producteur public |
| Donnée brute | valeur reprise sans transformation autre que typage/jointure géo |
| Donnée retraitée | agrégat ou normalisation maison — formule affichée |
| Estimation | valeur modélisée par le producteur (APL, loyers) ou cas-type (OpenFisca) |
| Comparaison harmonisée UE | issue de `european_comparisons` (Eurostat/OCDE) |
| Mise à jour récente | extraction < 30 jours |
| Série interrompue | `break_in_series` présent sur la période affichée |
| Comparabilité limitée | secret > seuil, couverture partielle, périmètre mouvant |

## Approximations assumées (à déclarer sur chaque chiffre concerné)

| Approximation | Où | Méthode et limite |
|---|---|---|
| **Périmètres qui se recouvrent** | `geo.geography_reference.flags` | Deux niveaux publiés ne sont pas toujours disjoints : les établissements publics territoriaux du Grand Paris (drapeau `type: EPT`) sont inclus dans la Métropole du Grand Paris ; la Métropole de Lyon et la Collectivité européenne d'Alsace (drapeau `statut_particulier`) sont publiées au niveau départemental sans être des départements. **Ne jamais additionner** deux niveaux qui se recouvrent ; les totaux nationaux se calculent sur un seul niveau à la fois. |
| Historique des finances communales | `core.observations` | Chargé depuis 2020 en base, pour tenir dans le plan gratuit (décision D6). Les exercices 2018-2019 sont archivés dans R2 et se rechargent en une commande au passage au plan payant. La borne réelle de chaque série est publiée avec l'indicateur. |
| Répartition d'une **scission** de commune | `geo.geography_history.population_share` | Une commune rétablie récupère une part du territoire d'origine, calculée au prorata des **populations actuelles** des successeurs. La population d'aujourd'hui n'est pas celle de l'année du mouvement : la part est donc approchée. Quand la population d'un successeur est inconnue, le partage est égal. Les **fusions ne sont pas concernées** (part de 1, exacte). Tout indicateur dont la série traverse une scission porte le badge « Comparabilité limitée ». |
| Budget de l'État : exercice en cours | `fin.public_budgets` | Seuls les exercices **clos** sont publiés. Les situations mensuelles portent un cumul depuis le 1ᵉʳ janvier : le cumul de mai ne se compare ni à une année entière, ni au même cumul d'une autre année sans le dire. L'exercice en cours n'est donc pas publié tant que sa colonne de décembre n'existe pas. |

## Contrôles bloquants et quarantaine

Deux façons de refuser un chiffre, aux conséquences différentes.

- **Contrôle bloquant** : une identité comptable qui ne se referme pas fait
  échouer le run. Rien n'est publié, la trace reste dans `ingestion_runs`.
  Exemples : l'épargne brute d'une collectivité doit être la différence entre
  ses recettes et ses dépenses de fonctionnement ; le solde budgétaire de
  l'État doit se déduire de ses recettes, de ses dépenses, de ses prélèvements
  sur recettes et de ses soldes annexes.
- **Quarantaine** : quand seule une partie du jeu est en cause, elle n'est pas
  publiée et le reste l'est. Un contrôle `warning` en garde la trace dans
  `data_quality_checks`, et l'export dit ce qui manque et pourquoi — une
  décomposition absente doit s'expliquer, pas disparaître.

Ces contrôles ont trouvé deux défauts réels dans le fichier des situations
mensuelles budgétaires de la DGFiP :

1. la colonne « Exécution » des textes législatifs porte, pour 2019 à 2021, les
   dépenses nettes de l'exercice précédent — jusqu'à 53 Md€ d'écart. L'exécution
   est donc lue dans les séries mensuelles, jamais dans ce fichier ;
2. la répartition des prélèvements sur recettes de la LFI 2022 y est corrompue
   (les deux lignes portent des montants qui ne sont pas les leurs, alors que
   leur total est juste). Le total est publié, la décomposition non.

## Séries dans le temps et changements de périmètre

Une série est une comparaison d'un territoire avec lui-même : la règle du
périmètre s'y applique comme entre deux territoires. Une commune née d'une
fusion n'a pas la même surface avant et après, et « +18 % depuis 2016 » y
compare deux choses différentes.

**Mais tous les producteurs ne se comportent pas pareil, et confondre les deux
cas produit une erreur dans un sens ou dans l'autre :**

| Cas | Exemple | Ce que fait le site |
|---|---|---|
| Le producteur **recalcule** l'historique dans la géographie d'aujourd'hui | Populations légales INSEE : les millésimes 2013 et 2023 couvrent les mêmes 34 858 communes, Vire Normandie (née en 2016 de huit communes) porte 17 951 habitants **dès 2013**, et la somme 2013 vaut 65,56 M, c'est-à-dire la France de 2013 | Rien à signaler : la série est comparable de bout en bout |
| Le producteur publie les valeurs **telles qu'elles étaient** | Comptes OFGL : le budget 2024 d'une commune est celui de la commune telle qu'elle existait en 2024 | Rupture marquée sur la courbe, évolution chiffrée bornée au dernier périmètre constant |

La liste des jeux recalculés est déclarée dans `plateforme/publish.py`
(`GEOGRAPHIE_COURANTE`) et exportée par indicateur dans `indicateurs.json`. Le
**défaut est « non recalculé »** : rater une rupture ferait publier une
comparaison fausse, en inventer une fait douter à tort — la seconde erreur est
la moins grave, et se corrige en vérifiant puis en déclarant le jeu.

Seules les **fusions et scissions** coupent une série. Un changement de nom ou
de code ne déplace aucune frontière ; le signaler ferait douter d'une série qui
n'a rien de douteux.

## Processus de correction

1. Anomalie détectée (check, signalement) → issue GitHub.
2. Diagnostic ; si le chiffre publié change : entrée `change_log`
   (`description_public`), re-run, republication des exports.
3. La page de l'indicateur affiche « corrigé le … » avec l'ancienne valeur
   accessible (`observations_revisions`).
4. Une correction du producteur (révision de série) est distinguée d'une
   correction de notre chaîne — deux `change_type` différents.

**État au 01/08/2026.** L'étape 2 est en place : le journal est déclaré dans
`plateforme/journal.py`, synchronisé à chaque publication et servi par
`journal.json` ; le site l'affiche du plus récent au plus ancien, détail
technique replié. Les entrées écrites par la plateforme portent
`author = 'plateforme'`, la synchronisation ne touche qu'à celles-là.

L'étape 3 ne l'est pas : `core.observations_revisions` n'a pas d'écrivain, donc
aucune valeur individuelle ne porte encore « corrigé le … ». Écrire *toutes* les
valeurs remplacées à chaque rechargement doublerait le volume, ce que D6bis
interdit ; il faudra n'archiver que celles qui changent réellement. Tant que ce
n'est pas fait, une correction se lit au niveau du jeu, pas de la cellule — et
c'est ce que le site dit, plutôt que d'afficher une mention qu'il ne peut pas
justifier.

## Écriture éditoriale

- Niveau d'interprétation : les explications sont **attribuées** (INSEE, Cour des
  comptes, HCFP…) via `citations` ; le site n'affirme rien en son nom propre.
- Désaccords entre sources sérieuses : affichés, nommés, jamais arbitrés.
- Vocabulaire : lexique public (impôt/taxe/cotisation, AE/CP, Maastricht…)
  maintenu dans `methodology_notes (scope='domain')` et lié depuis chaque page.
