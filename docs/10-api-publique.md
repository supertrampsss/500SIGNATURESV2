# 10 — API publique

*Contrat des fichiers publiés. Dernière vérification : 1er août 2026.*

Il n'y a pas de serveur d'API : le jeu de données public **est** un ensemble de
fichiers JSON versionnés, servis par le CDN de Cloudflare R2. Le site les lit
comme n'importe qui d'autre — il n'a aucun accès privilégié à la base.

Ce choix est délibéré. Une API dynamique ajouterait un service à maintenir, un
quota à surveiller et un point de panne, pour un jeu de données qui change
quelques fois par semaine. Des fichiers immuables se mettent en cache, se
téléchargent, se rejouent et se vérifient par des tiers.

**Base** : `https://pub-fc39d357004540a182a907aed4875ef5.r2.dev`

## Garanties

| Garantie | Portée |
|---|---|
| **Immuabilité** | Un fichier sous `data/<version>/` n'est jamais réécrit. Une URL qui répond aujourd'hui répondra la même chose demain. |
| **Pointeur unique** | Seul `data/derniere.json` est réécrit. C'est le seul endroit où lire « quelle est la publication courante ». |
| **Atomicité par publication** | Tous les fichiers d'une version décrivent le même état de la base. Ne mélangez pas deux versions dans un même calcul. |
| **Aucune authentification** | Ni clé, ni quota, ni suivi. Merci de mettre en cache plutôt que de reboucler. |
| **Licence** | Licence Ouverte 2.0 (Etalab), comme les sources. Citer le producteur d'origine, indiqué dans `manifeste.json` pour chaque jeu. |

Ce qui n'est **pas** garanti : la stabilité du schéma. Des champs peuvent
apparaître ; un champ absent d'une publication ancienne ne vaut pas « zéro »
(voir `anomalies` dans `fraicheur.json`). Traitez l'absence comme une absence.

## Trouver la publication courante

```sh
BASE=https://pub-fc39d357004540a182a907aed4875ef5.r2.dev
V=$(curl -s $BASE/data/derniere.json | jq -r .version)   # ex. 2026-07-31T1814
```

## Fichiers

Toutes les URL ci-dessous sont préfixées par `$BASE/data/$V/`.

| Fichier | Contenu | Ordre de grandeur |
|---|---|---|
| `manifeste.json` | Version, date de génération, et pour chaque jeu : producteur, licence, URL source, date d'extraction réellement utilisée | 4 ko |
| `indicateurs.json` | Catalogue : identifiant, libellé, unité, thème, cadre comptable, sommabilité, définition grand public et technique, formule, badges, `geographie_courante` (le producteur recalcule-t-il son historique dans les communes d'aujourd'hui — si oui, une fusion ne coupe pas la série). `periodes` liste **toute** la série disponible ; `periodes_par_niveau` liste les périodes **cartographiées** — l'historique n'a pas la même profondeur à tous les niveaux, et une carte est bornée aux périodes récentes pour les séries longues. Les séries entières restent dans les fiches de territoire | 35 ko |
| `carte/<indicateur>/<niveau>/<période>.json` | `{code territoire: valeur}` — la couche que la carte peint | 100 ko à 700 ko |
| `territoires/<niveau>/<lot>.json` | Fiches : nom, parent, population, drapeaux, `evenements` (fusions et scissions subies, avec leur date — une série qui les enjambe ne porte pas sur le même territoire de bout en bout) et toutes les séries du territoire. Les communes sont réparties par département (`lot` = code de département), les autres niveaux tiennent dans `tous` | 10 ko à 3 Mo |
| `recherche.json` | Index de recherche : code, nom, niveau, parent | 2 Mo |
| `comparaisons.json` | Quartiles par groupe de communes semblables, et les critères qui définissent les groupes | 35 ko |
| `budget-etat.json` | Budget de l'État par exercice et par étape (voté, rectifié, exécuté), lignes, soldes, et ce que les contrôles ont mis en quarantaine | 41 ko |
| `fraicheur.json` | Pour chaque jeu : dernière extraction, retard sur la fréquence annoncée, statut du dernier chargement, contrôles en échec | 4 ko |
| `references.json` | Ce à quoi se compare un territoire : par indicateur, période et niveau, l'agrégat de l'ensemble — **communes de la région**, puis **communes de France**. `nature` vaut `agregat` (montant sommable : `total` et `habitants`, dont le rapport est la valeur par habitant de l'ensemble) ou `mediane` (taux et médianes, qui ne s'additionnent pas). La région de référence d'une commune est l'ensemble de ses communes, **jamais le budget du conseil régional** : ce serait comparer deux niveaux de gouvernement | 250 ko |
| `journal.json` | Journal des changements, du plus récent au plus ancien : type (`correction`, `methodology`, `break`, `revision`, `deprecation`), date d'annonce, exercice à partir duquel le changement vaut, description publique et détail technique. Un chiffre déjà publié qui a bougé se retrouve ici — c'est le fichier à consulter quand une valeur notée ne correspond plus | 3 ko |

Les tuiles vectorielles suivent le même principe, sous leur propre pointeur :

```sh
curl -s $BASE/geo/derniere.json     # {"cle": "geo/2026-07-31/territoires.pmtiles", …}
```

L'archive PMTiles (56 Mo, zooms 0-12) contient trois couches : `communes`,
`departements`, `regions`. Elle se lit en HTTP par plages d'octets — aucun
téléchargement complet n'est nécessaire.

## Exemples

Les dépenses de fonctionnement par habitant de Pessac en 2024 :

```sh
BASE=https://pub-fc39d357004540a182a907aed4875ef5.r2.dev
V=$(curl -s $BASE/data/derniere.json | jq -r .version)
curl -s "$BASE/data/$V/territoires/commune/33.json" \
  | jq '.["33318"] | {nom, population,
        depenses: .series.ofgl_depenses_fonctionnement["2024"]}'
```

Les cinq départements où la dette par habitant est la plus élevée :

```sh
paste <(curl -s "$BASE/data/$V/carte/ofgl_encours_dette/departement/2024.json") \
      <(curl -s "$BASE/data/$V/territoires/departement/tous.json") \
  | jq -s '.[0] as $d | .[1] as $t
      | [$d | to_entries[] | {code: .key, ratio: (.value / $t[.key].population),
                              nom: $t[.key].nom}]
      | sort_by(-.ratio) | .[:5]'
```

Où sont passés 100 € dépensés par l'État en 2025 :

```sh
curl -s "$BASE/data/$V/budget-etat.json" \
  | jq '.exercices["2025"].execute as $e
      | ($e.montants["Total dépenses nettes du budget général"]
         + $e.montants["Total prélèvements sur recettes"]) as $total
      | $e.montants | to_entries
      | map(select(.key | test("^(Dépenses|PSR|Dotation|Charges)")))
      | map({poste: .key, sur_cent: (.value / $total * 100 | . * 100 | round / 100)})
      | sort_by(-.sur_cent)'
```

## Avant de réutiliser

Trois règles, les mêmes que pour le site (docs/06) :

1. **Un chiffre ne voyage pas seul.** `indicateurs.json` porte l'unité, le
   cadre comptable, la définition et la formule. Republier une valeur sans son
   cadre comptable, c'est publier autre chose.
2. **Ne sommez pas ce qui n'est pas sommable.** `indicateurs.json` porte
   `sommable`. Les médianes, taux et indices ne s'additionnent pas, et deux
   niveaux géographiques peuvent se recouvrir — les établissements publics
   territoriaux sont inclus dans la Métropole du Grand Paris, la Métropole de
   Lyon et la Collectivité européenne d'Alsace sont publiées au niveau
   départemental sans être des départements. Ces cas portent un drapeau dans la
   fiche du territoire.
3. **Une comparaison suppose la même année, la même unité, le même périmètre.**
   Le comparateur du site refuse une comparaison entre niveaux différents ; une
   réutilisation devrait faire de même.
