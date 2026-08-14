# Schéma des analyses

Une analyse est un fichier JSON dans `site/analyses/`, nommé
`<slug>.json`. Elle n'invente aucune donnée : elle **cite** des observations
déjà publiées par le pipeline (`indicateur`, `niveau`, `code`, `periode`),
oppose un chiffre couramment entendu à ces observations, et rend un verdict
factuel. Le contrôle déterministe de la tâche 2 refuse toute analyse dont un
montant `observe.valeur` ne correspond pas exactement — au centime — à la
valeur publiée dans les fichiers du dernier millésime de données.

Les montants stockés dans le fichier sont les **valeurs brutes publiées**, en
euros. La conversion en millions d'euros pour l'affichage est faite par le
site (tâche 3), jamais dans le fichier d'analyse.

## Champs

Tous les champs sont obligatoires sauf mention contraire.

| Champ | Type | Obligatoire | Sens |
|---|---|---|---|
| `slug` | chaîne | oui | Identifiant de l'analyse. Doit être strictement égal au nom du fichier JSON, sans l'extension `.json`. |
| `titre` | chaîne | oui | Titre affiché. Un montant qui y figure doit être adossé à une observation de `chiffres` (voir « Ce qu'une analyse ne fait jamais »). |
| `type` | énumération | oui | Nature de l'analyse. Voir « Types » ci-dessous. |
| `publie_le` | date `AAAA-MM-JJ` | oui | Date de première publication de l'analyse. |
| `themes` | liste de chaînes | oui | Thèmes libres utilisés pour le classement et la recherche du site (ex. `budget_etat`). |
| `budgets_concernes` | liste ⊂ `{etat, secu, collectivites, bareme}` | oui | Les budgets que l'analyse mobilise. Détermine, entre autres, où l'analyse peut être rejouée dans le simulateur. |
| `mise_en_avant` | booléen | oui | Si vrai, l'analyse peut être mise en avant sur le site (page d'accueil, section éditoriale). |
| `affirmation` | objet | oui | Le chiffre ou l'énoncé auquel l'analyse répond. Voir détail ci-dessous. |
| `affirmation.texte` | chaîne | oui | L'énoncé tel qu'entendu ou couramment répété. Pour un `decryptage`, il peut décrire l'ambiguïté elle-même plutôt qu'une déclaration attribuée. |
| `affirmation.auteur` | chaîne ou `null` | oui (peut être `null`) | La personne ou l'organisation à qui l'énoncé est attribué. `null` pour un `decryptage`, qui n'oppose pas de déclaration à un chiffre. Ne jamais inventer un auteur. |
| `affirmation.date` | date `AAAA-MM-JJ` ou `null` | oui (peut être `null` si `auteur` est `null`) | Date de la déclaration attribuée. `null` si `auteur` est `null` — il n'y a alors pas de déclaration à dater. |
| `affirmation.source` | objet `{titre, url, consulte_le}` | oui | La source de l'énoncé (même quand il n'a pas d'auteur individuel — par exemple un jeu de données ou une publication officielle). |
| `verdict` | objet | oui | Le verdict factuel. Voir détail ci-dessous. |
| `verdict.cran` | énumération | oui | `exact`, `hors_perimetre` ou `introuvable`. Voir « Crans ». |
| `verdict.confusion` | énumération | obligatoire si et seulement si `cran = hors_perimetre` | La confusion précise en cause. Voir « Confusions ». Absente (ou non pertinente) pour les autres crans. |
| `verdict.phrase` | chaîne | oui | Une phrase factuelle qui résume le verdict, sans jugement moral. |
| `chiffres` | liste non vide d'objets | oui | Les chiffres cités par l'analyse, chacun adossé à une observation publiée. Voir détail ci-dessous. |
| `chiffres[].dit` | chaîne | oui | Le chiffre tel qu'on l'entend couramment (arrondi, formulation courante). |
| `chiffres[].observe` | objet ou absent | dépend du registre — voir « Registres » | L'observation publiée à laquelle `dit` renvoie, quand `registre` en admet une. |
| `chiffres[].observe.indicateur` | chaîne | oui si `observe` est présent | Identifiant de l'indicateur dans le catalogue publié. |
| `chiffres[].observe.niveau` | chaîne | oui si `observe` est présent | Maille territoriale de l'observation (`pays`, `region`, `departement`, `commune`…). |
| `chiffres[].observe.code` | chaîne | oui si `observe` est présent | Code du territoire à cette maille (ex. `FR`). |
| `chiffres[].observe.periode` | chaîne | oui si `observe` est présent | Exercice ou période de l'observation (ex. `2025`). |
| `chiffres[].observe.valeur` | nombre | oui si `observe` est présent | La valeur brute publiée, en euros. Quand `observe` est renseigné, doit correspondre exactement à la valeur publiée pour cet indicateur, ce niveau, ce code et cette période — sans arrondi ni tolérance. |
| `chiffres[].valeur` | nombre ou absent | licite seulement pour `resultat_simulation`, `hypothese`, `interpretation` — voir « Registres » | Une grandeur déclarée en clair par l'analyse elle-même (résultat de simulateur, hypothèse chiffrée, interprétation), distincte de `observe.valeur` : elle ne référence aucune série publiée, mais entre dans la liste de référence de la garde anti-invention une fois déclarée, ce qui autorise la prose à la citer. |
| `chiffres[].registre` | énumération | oui | La nature de l'affirmation portée par ce chiffre. Voir « Registres ». |
| `chiffres[].lecture` | chaîne | oui | Ce que désigne précisément l'observation, en une phrase — ce qui distingue ce chiffre des autres chiffres cités. |
| `hypotheses` | liste de chaînes | oui (peut être vide) | Les hypothèses ou choix de périmètre qui conditionnent la lecture de l'analyse (ex. ce qu'une série inclut ou exclut). |
| `effets_indirects` | liste d'objets `{texte, auteur, source:{titre,url,consulte_le}}` | oui (peut être vide) | Des conséquences ou lectures indirectes rapportées, chacune attribuée à un auteur et une source réels. |
| `sources` | liste d'objets `{titre, url, consulte_le}` | oui | Les sources documentaires de l'analyse dans leur ensemble. |
| `simulateur` | objet `{budget, contrat, lecture}` | oui | Le rattachement de l'analyse au simulateur. `budget` peut être une chaîne vide quand aucun réglage du simulateur ne reproduit l'analyse. `contrat` identifie le réglage précis quand il existe. `lecture` explique comment lire l'analyse dans le simulateur. |
| `mises_a_jour` | liste d'objets `{date, quoi}` | oui (peut être vide) | Historique des révisions de l'analyse après sa première publication. Vide à la parution. |
| `verifie_contre` | chaîne | oui (peut être `""`) | La version de données (identifiant du millésime R2) contre laquelle le contrôle de la tâche 2 a vérifié les valeurs de `chiffres`. Chaîne vide avant le premier contrôle. |

## Types

- `verification_chiffre` — oppose un chiffre à une déclaration attribuée à une
  personne ou une organisation réelle.
- `analyse_mesure` — explique ce qu'une mesure budgétaire ou fiscale fait
  réellement, au-delà de son intitulé.
- `decryptage` — explique une ambiguïté ou une confusion à partir des séries
  publiées, sans opposer de déclaration attribuée (`affirmation.auteur` est
  alors `null`).
- `comparaison` — compare deux observations publiées entre elles (territoires,
  périodes, budgets), sous contrôle de définition et de périmètre.
- `analyse_programme` — analyse un programme ou une mission budgétaire en
  détail.
- `mise_a_jour` — documente une révision d'une analyse antérieure suite à une
  nouvelle publication de données.

## Crans

Le verdict ne porte que sur l'exactitude factuelle, jamais sur un jugement de
valeur.

- `exact` — le chiffre cité correspond à l'observation publiée, dans le bon
  périmètre.
- `hors_perimetre` — le chiffre cité est exact en lui-même, mais il est
  rapproché ou confondu avec une autre grandeur que celle qu'on croit lire.
  Le champ `confusion` précise laquelle.
- `introuvable` — le chiffre cité ne correspond à aucune observation publiée
  identifiable.

## Confusions

Applicables uniquement quand `verdict.cran = hors_perimetre`.

- `ae_cp` — confusion entre autorisations d'engagement et crédits de paiement.
- `brut_net` — confusion entre un montant brut et un montant net.
- `vote_execute` — confusion entre ce qui a été voté (budget voté, crédits
  ouverts) et ce qui a été effectivement exécuté (consommé, payé).
- `stock_flux` — confusion entre une grandeur de stock (ex. une dette à une
  date donnée) et une grandeur de flux (ex. une variation sur une période).
- `etat_apu` — confusion entre le périmètre de l'État et celui des
  administrations publiques au sens de la comptabilité nationale (APU), qui
  inclut aussi la sécurité sociale et les collectivités.
- `annuel_cumule` — confusion entre un montant annuel et un montant cumulé sur
  plusieurs exercices.
- `perimetre_geographique` — confusion entre deux mailles ou périmètres
  territoriaux différents (ex. une commune et son intercommunalité, un
  département et sa région).

## Registres

Chaque chiffre cité (`chiffres[].registre`) est classé selon la nature de
l'affirmation qu'il porte :

- `fait_comptable` — une valeur directement issue d'une écriture comptable ou
  budgétaire publiée (crédits votés, consommés, dépenses, recettes…).
- `donnee_officielle` — une donnée publiée par un producteur officiel
  (statistique, indicateur) qui n'est pas elle-même une écriture comptable.
- `resultat_simulation` — une valeur produite par le simulateur du site à
  partir de réglages donnés.
- `estimation_externe` — une estimation produite par un tiers (institut,
  organisme), non publiée par la source primaire elle-même.
- `hypothese` — une valeur ou un ordre de grandeur avancé sous hypothèse
  explicite, non observé directement.
- `interpretation` — une lecture ou un rapprochement des chiffres précédents,
  qui n'est pas elle-même une observation.

### `observe` selon le registre

Le registre détermine si `chiffres[].observe` est obligatoire, optionnel ou
interdit — le contrôle déterministe (tâche 2) applique cette règle à la
lettre :

- **`fait_comptable`** : `observe` est **obligatoire** et vérifié exactement.
  C'est le seul registre dont le sens même est « une observation que le
  pipeline a publiée » — l'exactitude est ce qui le rend vérifiable.
- **`donnee_officielle`** et **`estimation_externe`** : `observe` est
  **optionnel**. Absent, c'est la source (`sources[]`, avec `url` et
  `consulte_le`) qui tient lieu de vérification. Présent, il est vérifié
  exactement comme pour `fait_comptable` — citer une observation ne dispense
  jamais de la citer juste.
- **`resultat_simulation`**, **`hypothese`**, **`interpretation`** :
  `observe` est **interdit** — absent, ou explicitement `null` (les deux
  formes sont équivalentes pour le contrôle). Ces registres ne référencent
  aucune donnée publiée par construction (voir ci-dessus) ; laisser passer
  une observation ici l'introduirait comme référence invérifiable dans la
  garde anti-invention.

  Ce que ces trois registres **peuvent** porter, en revanche, c'est
  `chiffres[].valeur` : un nombre déclaré en clair, au niveau du chiffre et
  non dans `observe`. La garde anti-invention existe pour empêcher un
  montant d'apparaître de nulle part, pas pour empêcher le site d'énoncer
  une grandeur qu'il calcule lui-même — un résultat de simulateur, une
  hypothèse chiffrée, une interprétation. Une `valeur` ainsi déclarée entre
  dans la liste de référence de la garde (famille 4), et la prose peut alors
  citer ce chiffre (dans `verdict.phrase`, `titre`, `chiffres[].lecture`,
  `hypotheses[]`, `simulateur.lecture`). Ce qui reste interdit, c'est un
  montant en prose qu'aucun chiffre — `observe` ou `valeur` — ne déclare du
  tout.

  Pour **`resultat_simulation`** spécifiquement, une `valeur` déclarée exige
  en plus que `simulateur.budget` soit non vide : un résultat de simulateur
  que le lecteur ne peut pas rejouer n'est pas un résultat.

## Ce qu'une analyse ne fait jamais

- **Elle n'invente jamais une source, une citation ou un auteur.** Si aucune
  déclaration attribuée et vérifiée n'est disponible, `affirmation.auteur` et
  `affirmation.date` restent `null` et le type retenu est `decryptage` plutôt
  que `verification_chiffre`. Fabriquer une citation attribuée à une personne
  réelle est un faux — l'exact type de document que ce produit existe pour
  détecter.
- **Elle ne porte jamais de cran moral.** Le verdict n'a que trois valeurs
  possibles — `exact`, `hors_perimetre`, `introuvable` — toutes factuelles.
  Aucun cran n'exprime un jugement de valeur, une intention prêtée ou un degré
  de gravité.
- **Elle n'écrit jamais un montant dans sa prose sans l'adosser à une
  observation.** Tout nombre significatif qui apparaît dans `titre` ou dans
  `verdict.phrase` doit être celui d'une des observations listées dans
  `chiffres`. Le texte libre de `affirmation.texte` (ce que dit l'énoncé
  courant) fait exception, puisqu'il rapporte justement le chiffre tel qu'on
  l'entend — mais le verdict et le titre, eux, ne parlent que des chiffres
  observés.
