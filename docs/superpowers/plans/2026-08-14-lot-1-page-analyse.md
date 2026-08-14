# Lot 1 — Page Analyse et système éditorial : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au site son étage éditorial — des analyses qui opposent un chiffre
annoncé au chiffre des comptes, rendent un verdict factuel, se rejouent dans le
simulateur, et qu'aucune machine ne laisse publier si un seul de leurs montants ne
correspond pas aux données publiées.

**Architecture :** Une analyse est un fichier JSON versionné dans le dépôt. Elle ne
crée aucune donnée : elle **référence** des observations déjà publiées. Un contrôle
Python déterministe vérifie chaque montant contre les fichiers publiés et bloque le
déploiement en cas d'écart. Un module de rendu pur produit le HTML, et un script Node
lancé après `vite build` en fait des pages statiques — les fonctions de rendu étant
pures, le pré-rendu n'est qu'un appelant de plus.

**Tech Stack :** TypeScript 5.9 strict, Vite 7, tests Node natifs côté site ; Python
3.11, pytest, ruff côté pipeline.

**Spec de référence :** `docs/superpowers/specs/2026-08-14-arbitre-rejouable-design.md`,
sections 7.2-7.4 (routes, modules, flux), 9 (page Analyse), 14 (système éditorial),
15.2-15.3 (schéma et contrôle), 21 (tests), 23 (critères), 24 (lot 1).

**Base :** `main` à `0de64c0`, lot 0 fusionné. 458 tests côté site, 0 échec.

## Global Constraints

- **Langue** : documentation et interface en français ; code, identifiants et messages
  de commit en anglais. Les commentaires de code sont en français et expliquent
  *pourquoi*, en citant le défaut qui a motivé la règle.
- **Unités** : tout montant s'affiche en millions d'euros ; jamais de k€ ni de Md€. Le
  fichier d'analyse stocke la **valeur publiée brute** ; c'est l'affichage qui
  convertit, via `formater()` de `echelle.ts`. Vérifié dans le dépôt, pour éviter la
  lecture erronée que ce plan a d'abord faite : « deux décimales **sous** le million »
  veut dire que les décimales n'apparaissent que pour un montant inférieur à 1 M€
  (`0,43 M€`, `0,06 M€`) ; au-dessus, `millions()` arrondit à l'entier —
  `59946338573` donne `59 946 M€` et `62123736749.91` donne `62 124 M€`.
  Le séparateur de milliers et l'espace avant `M€` sont des **espaces fines
  insécables** (U+202F) : une comparaison de chaîne écrite avec une espace ordinaire
  échouera. Ne jamais reformater un montant à la main.
- **Un taux varie en points**, jamais en pourcentage.
- **Aucune réserve qui s'excuse.** Ce qui manque à un fichier se dit dans la légende du
  tableau, avec les chiffres, jamais après eux.
- **Aucun cran de verdict moral.** `exact`, `hors_perimetre`, `introuvable` : rien
  d'autre. « Trompeur », « mensonger », « exagéré » qualifient une intention et sont
  invérifiables.
- **Interdiction absolue d'inventer une source.** Aucune citation, aucun auteur, aucune
  URL ne doit être fabriqué, même à titre d'exemple ou de fixture « réaliste ». Une
  analyse dont l'affirmation n'est pas vérifiable dans une source réelle est un faux
  document — exactement ce que ce produit existe pour combattre. Les fixtures de test
  emploient des sources manifestement fictives (`example.invalid`) ou des documents
  officiels réellement consultés.
- **Style** : ne toucher qu'à ce que la tâche demande ; suivre les motifs existants.
- **Tests** : `cd site && npm test` (458 au départ, 0 échec) et
  `cd pipeline && python -m pytest` doivent passer à la fin de chaque tâche.
  `cd site && npx tsc --noEmit` silencieux, `npm run build` réussi.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâches |
|---|---|---|
| `site/analyses/<slug>.json` *(créé)* | Les analyses, versionnées dans le dépôt. | 1 |
| `docs/analyses-schema.md` *(créé)* | Le schéma, en prose, avec le sens de chaque champ. | 1 |
| `pipeline/plateforme/controle_analyses.py` *(créé)* | Contrôle déterministe, exécutable en ligne de commande. | 2 |
| `pipeline/tests/test_controle_analyses.py` *(créé)* | Tests du contrôle, fixtures justes et fausses. | 2 |
| `site/src/analyse-rendu.ts` *(créé)* | Rendu pur d'une analyse et de l'index éditorial. | 3 |
| `site/src/analyse-rendu.test.ts` *(créé)* | Tests du rendu. | 3 |
| `site/scripts/prerendre.ts` *(créé)* | Génère les pages statiques après `vite build`. | 4 |
| `site/src/main.ts` *(modifié)* | Ne peint aucune vue sur une page éditoriale pré-rendue. | 5 |
| `site/src/methode-rendu.ts` *(créé)* | La grille de verdicts publiée sur `/methode`. | 6 |
| `.github/workflows/deploy.yml`, `cron.yml` *(modifiés)* | Contrôle bloquant au déploiement, re-vérification après publication. | 7 |

`atelier.ts`, `simulateur.ts`, `simulateur-rendu.ts`, `routes.ts` et `publish.py` ne
sont pas modifiés.

---

### Task 1: Le schéma d'analyse, et la première analyse réelle

Le schéma se définit en écrivant un vrai fichier, pas en le décrivant à vide.

**Le sujet.** Le catalogue publie, pour chaque mission du budget de l'État, deux
séries : les crédits **votés** et les crédits **consommés**. Pour la Défense en 2025,
à la maille `pays`, code `FR` :

| Indicateur | Valeur publiée (€) |
|---|---|
| `etat_mission_defense_credits_votes` | `59946338573.0` |
| `etat_mission_defense_credits_consommes` | `62123736749.91` |

Deux montants, tous deux exacts, tous deux couramment appelés « le budget de la
Défense » — séparés de 2 177,40 M€. C'est la confusion `vote_execute` de la grille,
sur des chiffres que le site publie déjà.

**Le type est `decryptage`, et c'est délibéré.** Une `verification_chiffre` oppose un
chiffre à une déclaration attribuée. Nous n'en avons aucune de vérifiée sous la main,
et **il est interdit d'en inventer une** : une citation fabriquée attribuée à une
personne réelle est un faux, et le produit entier existe pour combattre cela. La
première analyse explique donc l'ambiguïté elle-même, à partir des deux séries
publiées. Les vérifications attribuées viendront quand la veille trouvera de vraies
déclarations.

**Files:**
- Create: `site/analyses/defense-credits-votes-consommes-2025.json`
- Create: `docs/analyses-schema.md`

**Interfaces:**
- Consumes: rien.
- Produces: le schéma que les tâches 2, 3 et 4 lisent. Champs, tous obligatoires sauf
  mention contraire :
  - `slug` (égal au nom de fichier sans extension), `titre`, `type` ∈
    {`verification_chiffre`, `analyse_mesure`, `decryptage`, `comparaison`,
    `analyse_programme`, `mise_a_jour`}, `publie_le` (AAAA-MM-JJ), `themes` (liste),
    `budgets_concernes` (liste ⊂ {`etat`,`secu`,`collectivites`,`bareme`}),
    `mise_en_avant` (booléen)
  - `affirmation` : `texte`, `auteur` (**peut être `null`** — un décryptage n'oppose
    pas une déclaration), `date` (peut être `null` si `auteur` est `null`), `source`
    (`titre`, `url`, `consulte_le`)
  - `verdict` : `cran` ∈ {`exact`,`hors_perimetre`,`introuvable`}, `confusion`
    (obligatoire si et seulement si `cran` = `hors_perimetre`, ∈ {`ae_cp`, `brut_net`,
    `vote_execute`, `stock_flux`, `etat_apu`, `annuel_cumule`,
    `perimetre_geographique`}), `phrase`
  - `chiffres` : liste non vide de `{dit, observe:{indicateur,niveau,code,periode,valeur},
    registre, lecture}`, `registre` ∈ {`fait_comptable`, `donnee_officielle`,
    `resultat_simulation`, `estimation_externe`, `hypothese`, `interpretation`}
  - `hypotheses` (liste de chaînes), `effets_indirects` (liste de
    `{texte, auteur, source:{titre,url,consulte_le}}`), `sources` (liste de
    `{titre,url,consulte_le}`)
  - `simulateur` : `{budget, contrat, lecture}` — `budget` peut être `""` quand aucun
    réglage ne reproduit l'analyse
  - `mises_a_jour` : liste de `{date, quoi}`, vide à la parution
  - `verifie_contre` : la version de données contrôlée, `""` avant le premier contrôle

- [ ] **Step 1: Écrire le fichier d'analyse**

Créer `site/analyses/defense-credits-votes-consommes-2025.json`. Les deux valeurs
`observe.valeur` doivent être **exactement** celles du tableau ci-dessus — le contrôle
de la tâche 2 n'admet aucune tolérance.

```json
{
  "slug": "defense-credits-votes-consommes-2025",
  "titre": "Le budget de la Défense : deux chiffres publiés, deux sens",
  "type": "decryptage",
  "publie_le": "2026-08-14",
  "themes": ["budget_etat"],
  "budgets_concernes": ["etat"],
  "mise_en_avant": true,
  "affirmation": {
    "texte": "Le budget de la Défense pour 2025 est cité tantôt autour de 59,9 milliards d'euros, tantôt autour de 62,1 milliards. Les deux montants sont publiés, et ils ne désignent pas la même chose.",
    "auteur": null,
    "date": null,
    "source": {
      "titre": "Situation mensuelle budgétaire de l'État, exercice 2025",
      "url": "https://www.data.economie.gouv.fr/explore/dataset/situation-mensuelle-budget-etat/",
      "consulte_le": "2026-08-14"
    }
  },
  "verdict": {
    "cran": "hors_perimetre",
    "confusion": "vote_execute",
    "phrase": "Les deux montants existent. L'un est ce que le Parlement a voté, l'autre ce qui a été effectivement consommé."
  },
  "chiffres": [
    {
      "dit": "environ 59,9 milliards d'euros",
      "observe": {
        "indicateur": "etat_mission_defense_credits_votes",
        "niveau": "pays",
        "code": "FR",
        "periode": "2025",
        "valeur": 59946338573.0
      },
      "registre": "fait_comptable",
      "lecture": "Les crédits votés : l'autorisation donnée par le Parlement en loi de finances."
    },
    {
      "dit": "environ 62,1 milliards d'euros",
      "observe": {
        "indicateur": "etat_mission_defense_credits_consommes",
        "niveau": "pays",
        "code": "FR",
        "periode": "2025",
        "valeur": 62123736749.91
      },
      "registre": "fait_comptable",
      "lecture": "Les crédits consommés : ce que la mission a effectivement dépensé sur l'exercice."
    }
  ],
  "hypotheses": [
    "Les deux séries portent sur la mission Défense au sens de la nomenclature budgétaire, hors comptes spéciaux et hors budgets annexes."
  ],
  "effets_indirects": [],
  "sources": [
    {
      "titre": "Situation mensuelle budgétaire de l'État, exercice 2025",
      "url": "https://www.data.economie.gouv.fr/explore/dataset/situation-mensuelle-budget-etat/",
      "consulte_le": "2026-08-14"
    }
  ],
  "simulateur": {
    "budget": "",
    "contrat": "",
    "lecture": "Le simulateur règle les crédits votés du budget général : c'est la première des deux séries qu'il fait varier."
  },
  "mises_a_jour": [],
  "verifie_contre": ""
}
```

- [ ] **Step 2: Vérifier les deux valeurs contre les données publiées**

Ne pas croire le plan sur parole — le contrôle de la tâche 2 refusera un écart d'un
centime.

```bash
BASE=https://pub-fc39d357004540a182a907aed4875ef5.r2.dev
V=$(curl -s $BASE/data/derniere.json | python3 -c 'import sys,json;print(json.load(sys.stdin)["version"])')
curl -s "$BASE/data/$V/territoires/pays/tous.json" | python3 -c "
import json,sys
s=json.load(sys.stdin)['FR']['series']
for i in ['etat_mission_defense_credits_votes','etat_mission_defense_credits_consommes']:
    print(i, s[i]['2025'])
"
```

Expected: les deux valeurs du tableau ci-dessus. **Si elles diffèrent, c'est le
fichier d'analyse qu'il faut corriger, jamais le contrôle** : une nouvelle publication
de données a pu réviser la série, et l'analyse doit recopier ce qui est publié.

- [ ] **Step 3: Écrire le schéma en prose**

Créer `docs/analyses-schema.md`, en français : un tableau champ par champ (nom, type,
obligatoire, sens), la liste fermée des crans et des confusions avec ce que chacune
désigne, la liste fermée des registres, et une section « Ce qu'une analyse ne fait
jamais » reprenant les trois interdits — inventer une source, porter un cran moral,
écrire un montant dans la prose sans l'adosser à une observation.

- [ ] **Step 4: Commit**

```bash
git add site/analyses/ docs/analyses-schema.md
git commit -m "Add the analysis schema and the first real analysis

The schema is defined by writing an actual file rather than describing an
empty one. The subject is the Défense mission, whose voted and consumed
credits are both published and both routinely called the defence budget —
59 946.34 M€ against 62 123.74 M€ for 2025. That is the vote_execute
confusion from the verdict grid, on figures the site already publishes.

Its type is decryptage, deliberately: a verification opposes a figure to an
attributed statement, we have none verified, and inventing one would be
forging the exact kind of document this product exists to catch."
```

---

### Task 2: Le contrôle déterministe

C'est la pièce qui remplace la relecture humaine (décision D11). Elle doit être
sévère : un contrôle qui laisse passer un chiffre faux ne vaut rien.

**Files:**
- Create: `pipeline/plateforme/controle_analyses.py`
- Test: `pipeline/tests/test_controle_analyses.py`

**Interfaces:**
- Consumes: le schéma de la tâche 1 ; les fichiers publiés sur R2.
- Produces: `python -m plateforme.controle_analyses <répertoire> [--version <v>]`,
  code de sortie 0 si tout passe, 1 sinon, avec un rapport lisible sur la sortie
  standard. Fonction `controler(analyses: list[dict], donnees: Donnees) -> list[Erreur]`
  où `Donnees` est un protocole injectable — c'est ce qui rend le contrôle testable
  hors réseau, comme les connecteurs du pipeline.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `pipeline/tests/test_controle_analyses.py`. Couvrir, chacun avec sa fixture :

1. une analyse conforme passe sans erreur ;
2. un `slug` différent du nom de fichier échoue ;
3. un `cran` hors liste échoue ;
4. `cran = hors_perimetre` sans `confusion` échoue ; avec une `confusion` hors liste
   échoue ; une `confusion` présente sur un autre cran échoue ;
5. une `observe.valeur` qui diffère d'un centime de la valeur publiée échoue — c'est
   le cœur du contrôle ;
6. un indicateur absent du catalogue échoue ; un indicateur non publié à la maille
   invoquée échoue ;
7. un nombre ≥ 1 000 présent dans `titre`, `verdict.phrase` ou une `lecture` sans
   correspondre à un chiffre référencé échoue — **et un millésime (1900-2100) ne
   déclenche pas l'erreur**. La garde porte sur la prose que **le site écrit**, et
   sur elle seule : `affirmation.texte` en est exclu, et un test doit le verrouiller.
   C'est délibéré — l'affirmation est la citation de ce qui circule, elle contient par
   nature le montant contesté, et exiger qu'il soit référencé rendrait impossible
   d'examiner un chiffre faux, qui est précisément l'objet du produit ;
8. un `registre` valant `donnee_officielle` ou `estimation_externe` sans URL ni date
   de consultation échoue ;
9. une analyse conforme rend `verifie_contre` égal à la version contrôlée.

Les fixtures emploient des URL en `example.invalid` : elles doivent être
manifestement fictives, jamais des adresses plausibles.

Pour la garde anti-invention (cas 7), écrire au moins un cas où le montant apparaît
dans la prose **formaté à la française** (« 59 946,34 ») et un où il apparaît en
milliards (« 59,9 milliards ») : le contrôle doit accepter le second, qui est une
lecture arrondie légitime du montant référencé, et refuser un montant qui ne
correspond à aucune observation. Documenter cette frontière dans le module, car c'est
elle qui décide ce que l'IA a le droit d'écrire.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd pipeline && python -m pytest tests/test_controle_analyses.py -x`
Expected: FAIL — `ModuleNotFoundError: plateforme.controle_analyses`.

- [ ] **Step 3: Écrire le module**

`pipeline/plateforme/controle_analyses.py`. Structure attendue :

- une docstring de tête en français qui dit ce que le contrôle garantit et ce qu'il ne
  garantit pas — il vérifie l'arithmétique et les références, pas la pertinence du
  sujet ni la justesse du raisonnement ;
- les listes fermées (`CRANS`, `CONFUSIONS`, `REGISTRES`, `TYPES`) en constantes ;
- `class Erreur(NamedTuple)` : `slug`, `champ`, `message` ;
- un protocole `Donnees` avec `catalogue()` et `serie(indicateur, niveau, code)` —
  l'implémentation réseau lit `data/derniere.json` puis les fichiers de la version,
  l'implémentation de test rend des dictionnaires ;
- `controler(analyses, donnees)` qui applique les six familles de contrôles de la
  spec §15.3 et rend la liste des erreurs ;
- `main()` avec `argparse`, qui charge le répertoire, appelle `controler`, imprime le
  rapport et sort en 1 s'il y a une erreur.

Suivre les conventions du pipeline : `ruff` avec les règles du projet, pas de
dépendance nouvelle, `httpx` pour le réseau comme les connecteurs.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd pipeline && python -m pytest tests/test_controle_analyses.py -v`
Expected: tous passent.

Run: `cd pipeline && ruff check plateforme/controle_analyses.py tests/test_controle_analyses.py`
Expected: aucune erreur.

- [ ] **Step 5: Lancer le contrôle sur la vraie analyse, en réseau**

Run: `cd pipeline && python -m plateforme.controle_analyses ../site/analyses`
Expected: sortie 0, aucune erreur. Si une erreur apparaît, **corriger l'analyse**, pas
le contrôle.

- [ ] **Step 6: Lancer la suite complète du pipeline**

Run: `cd pipeline && python -m pytest -q 2>&1 | tail -3`
Expected: aucun échec nouveau.

- [ ] **Step 7: Commit**

```bash
git add pipeline/plateforme/controle_analyses.py pipeline/tests/test_controle_analyses.py
git commit -m "Add the deterministic control that gates analyses

This is what replaces prior human proof-reading for editorial analyses
(decision D11): a reviewer cannot check every quoted amount against the
published files by hand, and a machine checks all of them, on every data
publication. Exact match, no tolerance — an analysis copies what is
published, it does not round or recompute.

The anti-invention guard is the part that matters most: any number of 1000
or more appearing in the title, the verdict sentence or a reading must map
to a referenced observation, or the control fails."
```

---

### Task 3: Le rendu d'une analyse

**Files:**
- Create: `site/src/analyse-rendu.ts`
- Test: `site/src/analyse-rendu.test.ts`

**Interfaces:**
- Consumes: `formater(valeur, unite, parHabitant, id?)` de `echelle.ts` ; `echapper` et
  `emphase` de `texte.ts`. **Réutiliser ces fonctions, ne pas réécrire de formatage.**
- Produces:
  - `export type Analyse = { … }` — le type du schéma de la tâche 1.
  - `export function rendu(analyse: Analyse, catalogue: Indicateur[]): string`
  - `export function renduIndex(analyses: Analyse[]): string`
  - `export const LIBELLE_CRAN: Record<string, string>` et
    `export const LIBELLE_CONFUSION: Record<string, string>`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `site/src/analyse-rendu.test.ts`. Couvrir :

1. les quatre étages sont présents dans la sortie (express, détail, interactif, preuve) ;
2. le cran s'affiche avec sa formulation de la spec §9.2 — `exact` → « Le chiffre est
   celui des comptes », `hors_perimetre` → « Le chiffre existe, mais pas pour ce qu'il
   désigne », `introuvable` → « Aucune ligne publiée ne porte ce montant » ;
3. **un cran `hors_perimetre` nomme toujours sa confusion à l'écran** — le rendu d'une
   analyse `hors_perimetre` contient le libellé de la confusion ;
4. **les montants s'affichent en millions d'euros** : le rendu de la valeur
   `59946338573.0` contient la chaîne que produit `formater(59946338573, "EUR", false)`,
   soit `59 946 M€` **avec des espaces fines insécables U+202F** — écrire l'attendu en
   appelant `formater`, jamais en recopiant une chaîne à la main, sans quoi le test
   comparera des espaces différentes et échouera pour une mauvaise raison. Le rendu
   **ne contient ni « Md » ni « milliard » comme unité d'affichage** ; le mot peut
   figurer dans le texte de l'affirmation, qui est une citation de ce qui circule et
   non un montant que le site produit ;
5. le texte de l'affirmation est échappé — une analyse dont le texte contient
   `<script>` ne produit pas de balise ;
6. un `auteur` à `null` ne produit pas « par null » ni de mention d'auteur vide ;
7. les effets indirects, s'il y en a, sont rendus **avec leur auteur et leur source**,
   et distingués des chiffres calculés par une classe CSS différente ;
8. `simulateur.budget` vide ne produit **aucun** bouton « Rejouer le calcul » — un
   bouton qui n'ouvre aucun réglage est un lien mort ;
9. `simulateur.budget` non vide produit un lien vers `/simulateur?budget=…` ;
10. l'index trie par `publie_le` décroissant et marque les analyses ayant des
    `mises_a_jour` ;
11. aucune sortie ne contient de réserve qui s'excuse : la fonction ne doit jamais
    émettre les gabarits « ces chiffres ne disent pas », « leur fiabilité est
    inégale » — verrouiller par une assertion sur le module lui-même.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `cd site && node --experimental-strip-types --test src/analyse-rendu.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Écrire le module**

`site/src/analyse-rendu.ts`, fonctions pures rendant des chaînes, sur le modèle de
`etat.ts` et `analyses.ts`. Points de vigilance, à porter en commentaires français :

- tout texte venant du fichier passe par `echapper()` avant d'entrer dans le gabarit ;
- les montants passent par `formater(valeur, unite, false, indicateur)`, l'unité étant
  lue **dans le catalogue**, jamais dans l'analyse ;
- l'étage 4 rend le chemin de calcul comme une suite cliquable jusqu'au fichier publié ;
- les incertitudes et ce qui manque se disent dans la légende du tableau, avec les
  chiffres — jamais en bloc de réserve après eux.

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `cd site && node --experimental-strip-types --test src/analyse-rendu.test.ts`
Expected: tous passent.

Run: `cd site && npx tsc --noEmit`
Expected: silencieux.

- [ ] **Step 5: Commit**

```bash
git add site/src/analyse-rendu.ts site/src/analyse-rendu.test.ts
git commit -m "Render an analysis in four storeys

Express, detail, interactive, proof — the same template for every type, so a
hurried reader stops at the first and an expert reaches the published file
the figure came from. Amounts go through the site's own formatter with the
unit read from the catalogue rather than from the analysis, and a
hors_perimetre verdict always names the confusion it rests on."
```

---

### Task 4: Le pré-rendu des pages

**Files:**
- Create: `site/scripts/prerendre.ts`
- Modify: `site/package.json` (script `build`)

**Interfaces:**
- Consumes: `rendu` et `renduIndex` de `analyse-rendu.ts` ; `decoder` de `atelier.ts`
  pour valider les liens de simulateur.
- Produces: `dist/analyses/index.html` et `dist/analyses/<slug>/index.html`.

- [ ] **Step 1: Écrire le script**

`site/scripts/prerendre.ts`, exécuté par `node --experimental-strip-types` après
`vite build`. Il :

1. lit `dist/index.html` — le shell construit, avec ses assets hachés en chemins
   absolus, donc valides depuis `/analyses/<slug>/` ;
2. lit tous les `site/analyses/*.json` ;
3. pour chacun, injecte dans le shell : `<title>`, `<meta name="description">`,
   `<link rel="canonical">`, le HTML de `rendu(...)` dans `<main>`, et
   `data-page="editorial"` sur `<body>` ;
4. écrit `dist/analyses/<slug>/index.html` et `dist/analyses/index.html` ;
5. **valide les liens de simulateur** : pour chaque analyse dont `simulateur.budget`
   est non vide, décoder avec le vrai `decoder()` d'`atelier.ts` contre les fichiers
   publiés ; un lien qui n'ouvre aucun réglage fait **échouer le build**.

Pas de sitemap ni de `robots.txt` ici : ils appartiennent au lot 4, avec la levée de
l'indexation.

- [ ] **Step 2: Chaîner le script au build**

Dans `site/package.json` :

```json
"build": "tsc --noEmit && vite build && node --experimental-strip-types scripts/prerendre.ts"
```

- [ ] **Step 3: Vérifier la sortie**

Run: `cd site && npm run build`
Expected: build réussi, et :

```bash
cd site && ls dist/analyses/ dist/analyses/defense-credits-votes-consommes-2025/
```
Expected: `index.html` dans les deux.

```bash
cd site && python3 -c "
p='dist/analyses/defense-credits-votes-consommes-2025/index.html'
h=open(p,encoding='utf-8').read()
print('montant voté présent :', '59 946 M€' in h)
print('montant consommé présent :', '62 124 M€' in h)
"
```
Expected: `True` deux fois — la page porte les deux montants formatés, sans
JavaScript. En Python et non `grep` : les espaces sont des fines insécables U+202F,
qu'un motif tapé à la main ne reproduit pas.

```bash
cd site && grep -o 'data-page="[^"]*"' dist/analyses/defense-credits-votes-consommes-2025/index.html
```
Expected: `data-page="editorial"`.

- [ ] **Step 4: Prouver que la validation des liens mord**

Ajouter temporairement `"budget": "etat/inexistant:-10"` à l'analyse, relancer
`npm run build`, constater l'échec, puis **révertir la sonde** et vérifier que le
build repasse. Consigner les deux sorties dans le rapport.

- [ ] **Step 5: Commit**

```bash
git add site/scripts/prerendre.ts site/package.json
git commit -m "Generate static pages for analyses after the build

The site's render functions are pure, so pre-rendering is one more caller
rather than a framework. Each analysis becomes a real page that reads without
JavaScript, which is what makes it indexable and shareable. A simulator link
that decodes to no adjustment fails the build: a replay button that opens
nothing is worse than no button."
```

---

### Task 5: Une page éditoriale ne se fait pas repeindre

Une page pré-rendue sert le shell de l'application. Au démarrage, `basculerVue()`
résout `/analyses/<slug>` — que `routes.ts` ne reconnaît pas comme une vue, à dessein —
retombe sur `territoire`, et **masque le contenu pré-rendu**. La page arriverait
lisible puis se viderait sous les yeux du lecteur.

**Files:**
- Modify: `site/src/main.ts` (`demarrer`, `basculerVue`)
- Test: `site/src/interface.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Dans `site/src/interface.test.ts` :

```ts
test("une page éditoriale pré-rendue n'est pas repeinte par la vue territoire", () => {
  // Une page d'analyse sert le shell de l'application : sans garde,
  // `basculerVue` ne reconnaît pas son chemin, retombe sur la vue territoire
  // et masque le contenu déjà écrit dans le HTML. La page arriverait lisible
  // puis se viderait sous les yeux du lecteur.
  assert.match(MAIN, /document\.body\.dataset\.page === "editorial"/);
  const corps = MAIN.slice(MAIN.indexOf("function basculerVue"));
  assert.ok(
    corps.indexOf('dataset.page === "editorial"') < corps.indexOf("dataset.vue = vue"),
    "la garde doit précéder toute peinture de vue",
  );
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd site && node --experimental-strip-types --test src/interface.test.ts`
Expected: FAIL.

- [ ] **Step 3: Poser la garde**

En tête de `basculerVue()`, avant toute écriture :

```ts
  // Une page éditoriale est pré-rendue : son contenu est déjà dans le HTML, et
  // aucune vue de l'application ne doit le masquer. L'en-tête, la recherche et
  // le thème restent branchés — c'est le reste de la page qui ne bouge pas.
  if (document.body.dataset.page === "editorial") return;
```

- [ ] **Step 4: Rendre l'index atteignable**

Sans entrée de menu, `/analyses/` n'existe que pour qui en connaît l'adresse. Ajouter
le lien dans le `<nav class="entete__nav">` d'`index.html`, **en première position** —
c'est le point d'entrée éditorial du site :

```html
        <a href="/analyses/">Analyses</a>
```

**Sans `data-vue`, délibérément.** L'intercepteur de clics ne capture que les liens
qui en portent un ; celui-ci doit donc provoquer un chargement de page complet, ce qui
est exactement le comportement voulu pour une page statique servie par le serveur.
Ajouter une assertion dans `interface.test.ts` verrouillant l'absence de `data-vue`
sur ce lien, avec le motif en commentaire.

- [ ] **Step 5: Vérifier**

Run: `cd site && npm test 2>&1 | tail -4` — 0 échec.
Run: `cd site && npx tsc --noEmit` — silencieux.

```bash
cd site && npm run build && python3 -c "
h=open('dist/analyses/defense-credits-votes-consommes-2025/index.html',encoding='utf-8').read()
print('montants présents :', '59 946 M€' in h and '62 124 M€' in h)
print('page éditoriale :', 'data-page=\"editorial\"' in h)
"
```
Expected: `True` deux fois.

- [ ] **Step 6: Commit**

```bash
git add site/src/main.ts site/src/interface.test.ts
git commit -m "Leave pre-rendered editorial pages alone

An analysis page serves the app shell, so basculerVue would resolve its path
to no known view, fall back to the territory view, and hide the content
already written into the HTML — the page would arrive readable and then empty
itself in front of the reader."
```

---

### Task 6: La grille de verdicts sur `/methode`

La spec place la grille au lot 1, avec les analyses qu'elle sert : elle rend le critère
public et vérifiable.

**Files:**
- Create: `site/src/methode-rendu.ts`, `site/src/methode-rendu.test.ts`
- Modify: `site/index.html` (conteneur), `site/src/main.ts` (`peindreMethode`)

- [ ] **Step 1: Écrire les tests qui échouent**

Couvrir : les trois crans figurent avec leur formulation ; les sept confusions figurent
avec ce que chacune désigne ; le critère de choix des sujets est écrit ; les sept
registres d'énoncés figurent, et le septième dit que l'opinion n'existe pas sur le site.

- [ ] **Step 2: Écrire le module et le brancher**

`methode-rendu.ts` exporte `renduGrille(): string`, pure et sans donnée d'entrée — la
grille est du texte de référence, pas un calcul. Ajouter un conteneur
`<div class="bloc bloc--large" id="methode-grille"></div>` dans la vue `#vue-methode`,
**avant** les blocs de fraîcheur et de journal, et le peindre dans `peindreMethode()`.

Attention : `peindreMethode` attend `prete` avant tout `fetch`. La grille ne fetch
rien — la peindre **avant** l'attente, pour qu'elle s'affiche même si les données
tardent.

- [ ] **Step 3: Vérifier et commiter**

Run: `cd site && npm test` — 0 échec. `npx tsc --noEmit` — silencieux.

```bash
git add site/src/methode-rendu.ts site/src/methode-rendu.test.ts site/index.html site/src/main.ts
git commit -m "Publish the verdict grid on /methode

Three factual notches, seven named confusions, seven registers of statement,
and the subject-selection criterion in plain words. A grid a reader can hold
the site to is what makes the verdicts checkable rather than assertions."
```

---

### Task 7: Le contrôle entre dans la chaîne

Un contrôle qui ne tourne pas automatiquement ne garantit rien.

**Files:**
- Modify: `.github/workflows/deploy.yml`, `.github/workflows/cron.yml`

- [ ] **Step 1: Bloquer le déploiement**

Dans `deploy.yml`, après l'installation du pipeline (`pip install -e ./pipeline`, déjà
présente) et **avant** `npm run build` :

```yaml
      - name: Contrôler les analyses
        run: python -m plateforme.controle_analyses site/analyses
```

- [ ] **Step 2: Re-vérifier après publication**

Dans `cron.yml`, après l'étape `publish` et avant `alerter`, rejouer le contrôle sans
faire échouer le job — une révision de données ne doit pas casser le rafraîchissement,
elle doit ouvrir une alerte :

```yaml
      - name: Re-contrôler les analyses publiées
        id: analyses
        continue-on-error: true
        run: python -m plateforme.controle_analyses site/analyses
```

et faire remonter son résultat à l'étape `alerter` existante, selon le mécanisme
qu'elle emploie déjà. **Lire `alerter/action.yml` avant d'écrire cette étape** :
brancher sur le mécanisme existant, ne pas en inventer un second.

- [ ] **Step 3: Vérifier la syntaxe des workflows**

```bash
python3 -c "import yaml,sys
for f in ['.github/workflows/deploy.yml','.github/workflows/cron.yml']:
    yaml.safe_load(open(f)); print(f,'OK')"
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/cron.yml
git commit -m "Run the analysis control in the pipeline that matters

Blocking before every deployment: a wrong figure never reaches the site.
Non-blocking after every data publication, raising an alert instead: a
revision upstream should not break the refresh, it should tell us which
analysis it invalidated."
```

---

## Vérification du lot

```bash
cd site && npm test && npx tsc --noEmit && npm run build
cd pipeline && python -m pytest -q && ruff check plateforme/ tests/
cd pipeline && python -m plateforme.controle_analyses ../site/analyses
```

Attendu : aucun échec, build réussi, contrôle en sortie 0.

Puis, sur la sortie du build :

| Vérification | Attendu |
|---|---|
| `dist/analyses/index.html` existe | l'index éditorial est une vraie page |
| la page de l'analyse contient `59 946 M€` et `62 124 M€` (U+202F) | l'analyse se lit sans JavaScript |
| la page contient le libellé de la confusion `vote_execute` | un cran hors périmètre nomme toujours ce qui sépare les deux chiffres |
| la page ne contient ni « Md » ni « milliard » comme unité d'affichage | la règle d'unité tient |
| un `budget` invalide fait échouer le build | la validation des liens mord |

Critères d'acceptation de la spec couverts par ce lot : ceux de la section 23 relatifs
à la page Analyse, au contrôle déterministe et à la grille de verdicts.

## Ce que ce lot ne fait pas

Pas de scénarios ni de comparaison (lot 2), pas de carte sociale ni de partage
(lot 3), pas de sitemap, pas de `robots.txt`, et la balise `noindex` **reste en
place** (lot 4). Une seule analyse est publiée : le but de ce lot est la chaîne
complète — schéma, contrôle, rendu, page, grille —, pas le volume éditorial.
