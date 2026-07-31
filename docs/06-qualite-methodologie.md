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

## Processus de correction

1. Anomalie détectée (check, signalement) → issue GitHub.
2. Diagnostic ; si le chiffre publié change : entrée `change_log`
   (`description_public`), re-run, republication des exports.
3. La page de l'indicateur affiche « corrigé le … » avec l'ancienne valeur
   accessible (`observations_revisions`).
4. Une correction du producteur (révision de série) est distinguée d'une
   correction de notre chaîne — deux `change_type` différents.

## Écriture éditoriale

- Niveau d'interprétation : les explications sont **attribuées** (INSEE, Cour des
  comptes, HCFP…) via `citations` ; le site n'affirme rien en son nom propre.
- Désaccords entre sources sérieuses : affichés, nommés, jamais arbitrés.
- Vocabulaire : lexique public (impôt/taxe/cotisation, AE/CP, Maastricht…)
  maintenu dans `methodology_notes (scope='domain')` et lié depuis chaque page.
