# 05 — Livrable 5 : moteur de questions en langage naturel

*Phase 3. Strictement relié aux données sourcées — le moteur est une interface
vers les tables validées, pas un générateur de réponses.*

> **État au 31/07/2026.** Le moteur n'est pas construit : il suppose le corpus
> d'évaluation et les seuils de la décision D10, qui n'est pas tranchée. En
> attendant, le site ne laisse pas le lecteur deviner ce qu'il sait faire — les
> six questions auxquelles il répond réellement sont écrites en tête de page,
> avec leur réponse courte et le lien vers la section qui la détaille
> (`site/src/questions.ts`). Une question hors périmètre n'y figure pas, et une
> réponse partielle porte sa réserve : « qui détient la dette » n'est pas une
> donnée publique détaillée, « où va l'argent » est une proportion et non le
> trajet d'un euro. Cette liste est le cahier des charges du futur moteur : ce
> qu'il devra savoir répondre avec la même prudence, sans rien promettre de
> plus.

## Architecture

```
question utilisateur
   │ 1. compréhension (Claude, sortie structurée contrainte)
   ▼
plan de requête structuré (JSON, schéma versionné)
   │ 2. validation déterministe (code, pas IA)
   ▼
exécution SQL sur vues pub.* uniquement (requêtes paramétrées, read-only)
   │ 3. habillage
   ▼
réponse : chiffres + citations + requête lisible + limites
```

1. **Compréhension** : le modèle traduit la question en un **plan de requête**
   au schéma strict :

```json
{
  "intent": "compare_series",
  "indicators": ["ofgl_depenses_fonctionnement_hab"],
  "territories": [
    {"level": "commune", "code": "33318"},
    {"level": "commune", "code": "33281"},
    {"level": "commune", "code": "33522"}
  ],
  "period": {"from": "2018", "to": "latest"},
  "normalization": "per_capita",
  "comparability_checks": ["same_vintage_path", "same_unit", "same_scope"]
}
```

   Le modèle choisit parmi les indicateurs **publiés** (catalogue embarqué dans le
   contexte), jamais parmi des tables libres. S'il ne trouve pas d'indicateur
   correspondant : intent `no_data`, avec la formulation de ce qui manque.

2. **Validation déterministe** (code) : indicateurs existants et publiés ;
   territoires résolus dans `geography_reference` ; période couverte ; contrôle
   de comparabilité (définition, périmètre, unité, année, ruptures) ; refus
   motivé sinon. Le plan validé est compilé vers des requêtes SQL **paramétrées,
   générées par gabarits** (un gabarit par intent : `point_value`, `series`,
   `compare_series`, `share_of_total`, `rank_in_group`, `eu_compare`,
   `budget_vs_execution`) — le modèle n'écrit jamais de SQL libre.

3. **Réponse** : valeurs + unités + millésimes ; citation de chaque dataset
   (producteur, jeu, extraction) ; la **requête affichée** (version lisible du
   plan + SQL) ; limites héritées (`methodology_notes`, flags) ; distinction
   observé / calculé (agrégat maison documenté) / estimé (badge).

## Règles impératives (contrat, testé en CI)

1. Le moteur interroge exclusivement `pub.*` (rôle SQL read-only dédié, RLS).
2. Toute réponse cite datasets, périodes, définitions, filtres.
3. Absence de donnée ⇒ « donnée non disponible » + pourquoi (jamais comblée).
4. Chiffres observés / calculés / estimés typographiquement distingués.
5. Toute nouvelle métrique composite demandée (« efficacité », « bonne
   gestion »…) ⇒ refus + explication + éventuelle proposition d'indicateurs
   officiels existants ; création d'une métrique composite = processus éditorial
   humain, pas une réponse de chat.
6. Aucune conclusion politique ni jugement de valeur ; les questions d'opinion
   reçoivent les données factuelles pertinentes et leurs limites.
7. Journalisation : question, plan, requêtes, réponse — pour audit et évaluation
   (sans identifiant utilisateur).

## Exemples cibles (tests d'acceptation)

| Question | Intent | Comportement attendu |
|---|---|---|
| « Compare les dépenses de fonctionnement par habitant de Pessac, Mérignac et Talence depuis 2018 » | `compare_series` | séries OFGL €/hab, même périmètre budgétaire, mention consolidé/principal |
| « Quelle part des recettes de l'État provient de la TVA ? » | `share_of_total` | Voies et moyens/exécution, année précisée, budgétaire vs CN signalé |
| « Comment la dette publique a-t-elle évolué depuis 2000 ? » | `series` | BDM Maastricht, Md€ **et** % PIB, sous-secteurs disponibles |
| « Compare le chômage en Nouvelle-Aquitaine avec l'Espagne et l'Allemagne » | `eu_compare` | refus région vs pays sans harmonisation → propose NUTS2 Eurostat (taux harmonisés, même trimestre) |
| « Quels secteurs créent le plus d'établissements dans la métropole bordelaise ? » | `rank_in_group` | créations par NAF, EPCI 243300316, flag micro-entrepreneurs |
| « Différence entre budget voté et exécuté pour l'éducation ? » | `budget_vs_execution` | mission « Enseignement scolaire », LFI vs exécution, AE et CP, année |
| « Ma commune est-elle bien gérée ? » | métrique composite | refus du jugement + indicateurs factuels (épargne brute, désendettement) + groupe de comparaison |
