# Analyses croisées France et Territoires — conception

## Décision

La plateforme doit devenir une référence d'analyse sans transformer ses pages en
catalogue de graphiques. Les données déjà publiées alimentent donc une nouvelle
couche d'**insights vérifiables** : un constat, les chiffres qui le prouvent, la
limite de lecture et un accès à la source. Cette couche complète le bilan France
et la fiche Territoires ; elle ne remplace ni les tableaux exhaustifs ni les
dossiers éditoriaux signés.

Le chantier global est décomposé en quatre sous-systèmes indépendants :

1. moteur d'insights sur les séries déjà publiées ;
2. analyses France automatiques et dossiers éditoriaux ;
3. analyses territoriales croisées et comparatives ;
4. nouveaux pipelines pour les données absentes : projets, marchés, audits,
   organismes satellites et promesses électorales.

Le présent incrément couvre entièrement les trois premiers points lorsque les
données existent déjà. Le quatrième ne doit jamais être simulé.

## Principes éditoriaux

- Un insight répond à une question précise, jamais à un thème générique.
- Son titre porte le verdict ; son corps explique le calcul en deux phrases au
  maximum.
- Les chiffres proviennent exclusivement de `Territoire.series` et du catalogue
  publié.
- Une comparaison n'est rendue que si unité, période et maille sont compatibles.
- Une corrélation n'est jamais formulée comme une causalité.
- Une série mono-période peut situer un niveau mais ne produit pas de tendance.
- Une rupture de signe, un dénominateur nul ou une période non commune annule le
  constat concerné.
- La méthode complète reste sur `/sources/`; l'écran ne montre qu'une réserve de
  lecture courte et utile.

## Architecture

### Contrat commun

`site/src/insights.ts` expose les primitives pures :

```ts
type PreuveInsight = {
  indicateur: string;
  periode: string;
  valeur: number;
  libelle: string;
};

type Insight = {
  id: string;
  famille: "budget" | "fiscalite" | "generation" | "travail" |
    "logement" | "services" | "securite" | "environnement";
  surtitre: string;
  titre: string;
  texte: string;
  reserve: string;
  preuves: PreuveInsight[];
};
```

Le même fichier fournit les opérations sûres : dernière valeur, période commune,
variation, écart, ratio et classement. Elles rendent `null` quand le calcul ne
peut pas être défendu.

### France

`site/src/insights-france.ts` compose au maximum six constats :

- montant et composition des dépenses fiscales ;
- missions dont l'exécution s'écarte le plus du vote ;
- évolution du rapport cotisants/retraité ;
- écart de pension entre femmes et hommes ;
- évolution récente des défaillances d'entreprises ;
- effet mesuré de la redistribution sur l'inégalité.

Les constats sont placés dans une quatrième section du bilan : **Les arbitrages
derrière les comptes**. Ils complètent les trois chapitres comptables par des
angles de débat, sans dupliquer leurs chiffres.

### Territoires

`site/src/insights-territoire.ts` choisit au maximum cinq constats parmi les
données réellement disponibles :

- fiscalité contre évolution du revenu ;
- emploi et chômage ;
- tension du logement ;
- évolution d'un indicateur de sécurité homogène ;
- consommation d'énergie ou d'espace ;
- densité d'équipements et services ;
- trajectoire financière quand elle apporte un fait non déjà dit par la fiche.

Un sélecteur privilégie la profondeur temporelle, la récence et la diversité des
familles. Deux constats de sécurité ne peuvent pas évincer le logement ou
l'emploi.

### Rendu

`site/src/insights-rendu.ts` est partagé par les deux pages. Il produit une grille
de cartes éditoriales à largeur de lecture bornée. Chaque carte contient :

1. famille ;
2. verdict ;
3. explication ;
4. chiffres de preuve ;
5. réserve courte si nécessaire.

Sur mobile, les cartes forment une colonne sans carrousel horizontal. Les
preuves restent visibles ; aucun contenu essentiel ne dépend d'un survol.

## Données et erreurs

Les générateurs reçoivent les séries déjà chargées. Ils n'effectuent aucun
`fetch`, ce qui garantit le même rendu au pré-rendu et dans le navigateur. Une
série absente supprime uniquement l'insight qu'elle aurait alimenté. Une page
sans insight reste valide et n'affiche aucun cadre vide.

Les identifiants cités par chaque insight sont conservés dans `preuves` afin de
retrouver leur source, de contrôler les valeurs et de produire ultérieurement
une carte sociale sans recopier les nombres.

## Intégration

- `/bilan` reçoit un conteneur après le chapitre Dette et avant l'appel au
  simulateur.
- La fiche d'un territoire reçoit son conteneur après les quatre blocs de
  lecture et leur tableau d'évolution, avant les classements.
- `/detail` demeure la vue exhaustive et ne duplique pas les cartes.
- Les pages pré-rendues portent le même HTML que la SPA.

## Tests et critères d'acceptation

- Chaque opération de calcul est testée sur période absente, zéro, changement de
  signe et valeur valide.
- Chaque insight possède un test positif et un test d'absence.
- Aucun titre ou texte ne contient un nombre qui n'est pas présent dans ses
  preuves ou dérivé explicitement de celles-ci.
- Le rendu échappe tous les textes, garde les preuves visibles et ne rend pas de
  section vide.
- Le bilan pré-rendu contient les insights France sans JavaScript.
- Une fiche Paris montre au moins quatre familles lorsque la publication du
  22 août 2026 est utilisée.
- À 390 px, aucune carte ne déborde horizontalement et les nombres ne se
  superposent pas.
- La suite complète des tests, le build et une inspection visuelle desktop et
  mobile doivent réussir avant publication.

## Hors périmètre de cet incrément

Les coûts de projets, contrats fournisseurs, avis d'audit, comptes d'organismes
satellites et promesses électorales exigent des sources nouvelles. Leur interface
ne sera pas maquettée avec des exemples fictifs : chaque fonctionnalité suivra
son propre contrat d'ingestion et son propre contrôle de qualité.
