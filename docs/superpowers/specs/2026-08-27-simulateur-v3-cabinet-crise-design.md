# Simulateur V3 « Cabinet de crise »

Date : 27 août 2026  
Statut : prêt pour revue utilisateur  
Périmètre : campagne nationale de 96 décisions  
Référence visuelle : première planche validée, sans médaillon ni portrait

## 1. Objet de cette spécification

Cette spécification remplace les choix historiques incompatibles avec la V3, en particulier :

- le mode express de 15 mesures ;
- la sélection entre plusieurs longueurs de campagne ;
- les engagements signés avant de commencer ;
- le plein écran qui masque toute la navigation du site ;
- les boutons d'action qui répètent les cartes de décision ;
- les concessions de crise qui ne modifient aucune politique ;
- les dossiers dont les conséquences affichent « Impact : à préciser » ;
- les fenêtres de résultat trop rapides pour être lues ;
- les médaillons, portraits et avatars institutionnels.

La V3 doit faire du simulateur un jeu sérieux de stratégie politique, compréhensible sur mobile, mémorable, rejouable et factuellement défendable.

## 2. Promesse produit

Le joueur gouverne réellement la France pendant cinq ans. Chaque décision modifie les comptes, l'économie, les rapports de force et la confiance. Certaines conséquences sont immédiates. D'autres reviennent plus tard et peuvent déclencher une crise.

La phrase d'entrée est :

> La France emprunte 153 milliards d'euros cette année. Vous avez cinq ans pour reprendre le contrôle sans perdre le pays.

Un seul bouton lance la partie : **Prendre mes fonctions**.

Le produit ne prétend pas prédire exactement le futur. Il rend visibles des mécanismes, des ordres de grandeur, des dépendances et des arbitrages.

## 3. Principes non négociables

### 3.1 Une seule campagne

- 96 décisions.
- 8 chapitres de 12 décisions.
- Une progression sauvegardée automatiquement.
- Une partie peut être interrompue et reprise.
- Aucun mode express.
- Aucun engagement préalable qui retire des mesures de la campagne.

### 3.2 Chaque choix doit être complet

Aucun dossier n'est publié sans :

- un effet budgétaire ou une fourchette explicitement justifiée ;
- un horizon temporel ;
- un mécanisme de transmission ;
- des bénéficiaires ;
- des contributeurs ou perdants ;
- des risques et effets secondaires ;
- les dépendances avec d'autres décisions ;
- au moins une source datée ;
- un niveau d'incertitude compréhensible.

La mention « Impact : à préciser » est interdite.

### 3.3 Le jeu possède une mémoire

Une décision confirmée devient un fait politique. Elle ne peut pas être annulée gratuitement. Elle peut seulement être suspendue, amendée ou renversée par une décision ultérieure, avec des conséquences budgétaires et politiques explicites.

### 3.4 La tension vient des arbitrages

Le jeu peut être radical, conflictuel et polémique. Il ne doit pas manipuler les données, favoriser un camp ou présenter une règle ludique comme une certitude économique.

### 3.5 Zéro cadratin

Le caractère cadratin est interdit dans toute l'interface et tout le contenu éditorial. Cette règle concerne :

- les titres ;
- les boutons ;
- les analyses ;
- les événements ;
- les cartes de partage ;
- les contenus importés ou générés ;
- les textes alternatifs et libellés accessibles.

Les formulations utilisent des points, des deux-points, des parenthèses ou des phrases séparées.

## 4. Architecture de navigation

### 4.1 Site général

Le site conserve un en-tête cohérent entre ses espaces :

- marque « Où va l'argent public » ;
- France ;
- Territoires ;
- Simuler.

La recherche globale disparaît de France et du simulateur. La recherche de territoire reste contextuelle dans Territoires.

La route `/` redirige vers `/bilan`. L'ancienne page d'accueil n'est plus une destination.

### 4.2 Dans le simulateur

Le simulateur ne masque plus totalement l'identité du site. Il utilise une barre de commandement compacte :

- marque tricolore abstraite ;
- mandat en cours ;
- chapitre ;
- progression ;
- action Pause.

Quitter renvoie vers `/bilan`, jamais vers l'ancienne page d'accueil.

Sur mobile, cette barre remplace l'en-tête général pendant la partie. Hors partie, la navigation principale mobile reste disponible.

## 5. Direction visuelle

### 5.1 Référence

La référence est la première planche validée :

- coque bleu nuit ;
- dossier ivoire ;
- titres éditoriaux en serif ;
- données et commandes en sans-serif ;
- accents rouge, or et tricolore ;
- cartes de choix fines et directement actionnables ;
- tableau de situation compact en bas du dossier sur desktop ;
- mise en page verticale sur mobile.

Tous les médaillons, visages, bustes, portraits, pièces et avatars sont supprimés. Ils sont remplacés par une marque tricolore minimale ou un pictogramme institutionnel abstrait.

### 5.2 Hiérarchie

L'ordre de lecture est toujours :

1. le dilemme ;
2. les choix ;
3. les conséquences essentielles ;
4. l'état du mandat ;
5. les preuves et explications détaillées.

Le tableau de bord ne doit jamais concurrencer la décision principale.

### 5.3 Mouvement

Les animations servent uniquement à expliquer un changement d'état :

- sélection d'une option ;
- confirmation ;
- tampon de décision ;
- variation d'un indicateur ;
- déclenchement d'une crise ;
- changement de chapitre.

Aucune animation ne bloque la lecture. `prefers-reduced-motion` supprime tous les mouvements non essentiels.

## 6. Parcours complet

### 6.1 Entrée en fonction

L'écran présente la mission, l'horizon de cinq ans et les quatre objectifs :

- réduire le déficit ;
- préserver l'activité ;
- conserver une capacité politique d'action ;
- maintenir la confiance du pays.

Il ne contient ni choix de mode, ni engagement, ni texte méthodologique long.

### 6.2 Premier dossier tutoriel

Le premier dossier apprend à jouer sans tutoriel séparé. Les éléments apparaissent dans leur ordre d'usage. Une seule aide contextuelle explique que les cartes sont cliquables et que les effets peuvent être différés.

### 6.3 Introduction de chapitre

Chaque chapitre commence par une transition courte :

- titre ;
- quatre domaines concernés ;
- situation de départ ;
- tension politique dominante ;
- groupes déjà mobilisés.

Le bouton unique est **Ouvrir le premier dossier** ou **Poursuivre le mandat**.

### 6.4 Décision principale

Chaque écran présente :

- le numéro du dossier et la progression ;
- une question forte ;
- deux à quatre options ;
- les conséquences principales visibles sans déplier ;
- un accès secondaire à l'analyse et aux sources.

Chaque carte entière est un bouton. Aucune rangée de boutons ne répète les cartes.

Sur desktop, les options sont comparées horizontalement lorsque leur nombre et leur longueur le permettent. Sur mobile, elles sont empilées verticalement.

### 6.5 Confirmation

Le premier toucher sélectionne une carte et révèle sa confirmation dans la même surface. Le joueur peut confirmer ou revenir au dossier.

Le texte de confirmation est :

> Vous engagez la France sur cette trajectoire.

Après confirmation, la décision est persistée, puis le jeu applique les effets immédiats et programme les effets futurs.

### 6.6 Retour de décision

Il n'existe plus de fenêtre fugace. Le dossier confirmé affiche durablement :

- le choix retenu ;
- l'effet immédiat ;
- l'effet attendu plus tard ;
- l'indicateur qui a changé ;
- le prochain événement éventuel.

Le joueur passe au dossier suivant quand il a terminé sa lecture.

### 6.7 Journal du mandat

Le journal conserve :

- les 96 arbitrages ;
- les effets immédiats ;
- les effets programmés ;
- les décisions contestées ;
- les crises ;
- les promesses faites en cours de mandat ;
- les suspensions, amendements et renversements.

Chaque ligne résume le mécanisme, par exemple :

> Retraite à 64 ans adoptée. Économie progressive à partir de 2029.

### 6.8 Conseil

Toutes les quatre décisions, le Conseil présente un bilan condensé :

- finances ;
- économie réelle ;
- pouvoir ;
- confiance.

Chaque variation est reliée aux décisions qui l'ont causée. Le joueur peut ouvrir le journal, mais l'écran reste un moment de synthèse, pas un tableau de bord exhaustif.

### 6.9 Crise

Une crise est déclenchée par une combinaison traçable de décisions et d'états. Elle cite son déclencheur principal et ses facteurs aggravants.

Une concession modifie réellement le mandat. Elle peut :

- suspendre une réforme ;
- rétablir une exception ;
- réduire l'ampleur d'une mesure ;
- financer une compensation ;
- accélérer une autre politique ;
- accepter une élection, une censure ou une dissolution.

Le maintien du cap reste possible, mais il augmente un risque politique explicite.

### 6.10 Événement différé

Un événement différé rappelle la décision qui l'a causé et explique le mécanisme. Il peut modifier les comptes, l'économie, les groupes ou les choix encore disponibles.

### 6.11 Fin de chapitre

La fin de chapitre présente :

- les décisions prises ;
- les effets acquis ;
- les effets encore futurs ;
- les gagnants et perdants dominants ;
- la contradiction laissée ouverte.

### 6.12 Pause et reprise

Pause propose :

- reprendre ;
- ouvrir le journal ;
- recommencer la campagne ;
- quitter vers France.

La sauvegarde est automatique après chaque confirmation et chaque résolution de crise.

### 6.13 Verdict

Le verdict raconte un mandat. Il présente dans cet ordre :

1. une phrase de synthèse ;
2. la trajectoire financière ;
3. l'état économique et social ;
4. la capacité politique finale ;
5. les décisions structurantes ;
6. les réformes abandonnées sous pression ;
7. les crises traversées ;
8. une comparaison anonyme avec les autres parties ;
9. une carte partageable ;
10. une revanche avec une stratégie différente.

Le verdict ne réduit pas le mandat à un score unique. Le score peut exister comme résumé ludique, mais l'explication garde la priorité.

## 7. Système de jeu

### 7.1 Variables visibles

Le tableau de situation utilise quatre familles :

#### Finances

- solde annuel ;
- dette rapportée au PIB ;
- charge d'intérêt ;
- dépenses ou recettes différées.

#### Pays

- croissance ;
- emploi ;
- investissement ;
- qualité ou disponibilité des services essentiels.

#### Pouvoir

- majorité ;
- cohésion gouvernementale ;
- capacité de réforme ;
- risque de censure ou de dissolution.

#### Confiance

- opinion ;
- confiance institutionnelle ;
- tension sociale ;
- crédibilité financière.

L'interface n'affiche que les indicateurs utiles à la décision courante. Les autres restent disponibles dans le Conseil et le journal.

### 7.2 Groupes

Douze groupes nourrissent les rapports de force :

- ménages modestes ;
- classes moyennes ;
- retraités ;
- salariés du public ;
- salariés du privé ;
- syndicats ;
- entreprises ;
- agriculteurs ;
- collectivités ;
- investisseurs et créanciers ;
- partenaires européens ;
- majorité parlementaire.

Ils ne sont pas tous transformés en jauges permanentes. Ils apparaissent lorsque leurs réactions deviennent politiquement pertinentes.

### 7.3 Types d'effets

Chaque choix peut produire :

- un effet immédiat ;
- un effet annuel récurrent ;
- un coût d'investissement temporaire ;
- un effet différé ;
- un effet conditionnel ;
- un changement de règle ;
- un verrou ou un déverrouillage de décision ;
- un risque de crise ;
- une promesse politique.

### 7.4 Causalité

Chaque variation doit conserver une liste de causes. Une crise ou un verdict peut donc expliquer :

- la décision déclencheuse ;
- les décisions aggravantes ;
- l'état qui a franchi un seuil ;
- la conséquence appliquée.

Le moteur reste déterministe à scénario, décisions et graine identiques.

### 7.5 Victoire et défaite

Il n'existe pas une victoire idéologique unique. Les fins possibles comprennent :

- redressement durable ;
- équilibre obtenu au prix d'une récession ;
- croissance sans maîtrise de la dette ;
- mandat paralysé ;
- censure ;
- dissolution ;
- crise de financement ;
- explosion sociale ;
- victoire électorale ;
- défaite électorale ;
- redressement inachevé mais crédible.

Une fin anticipée reste possible uniquement pour une crise institutionnelle majeure. Elle doit être préparée par plusieurs signaux et jamais surgir comme une punition arbitraire.

## 8. Architecture éditoriale des 96 décisions

Les mesures existantes ne sont pas sacrées. Elles peuvent être corrigées, fusionnées, supprimées ou remplacées.

Chaque chapitre contient :

- 4 décisions de gestion ;
- 4 transformations structurelles ;
- 4 ruptures.

Les huit chapitres sont :

1. Impôts, patrimoine et transmission ;
2. Travail, salaires et retraites ;
3. Santé et protection sociale ;
4. Sécurité, immigration et justice ;
5. Défense, Europe et souveraineté ;
6. Énergie, climat, transports et agriculture ;
7. Éducation, logement et famille ;
8. État, institutions et territoires.

Les décisions de rupture peuvent changer les règles de la suite, par exemple : sortie de l'euro, nationalisation, suppression du Sénat, référendum institutionnel, retraite par capitalisation, fermeture nucléaire accélérée ou programme massif de réacteurs.

## 9. Sources et méthode

### 9.1 Séparation des couches

Le contenu sépare trois catégories :

- `evidence` : faits, montants, fourchettes, dates, sources et réserves ;
- `gameEffects` : effets ludiques, seuils, groupes et crises ;
- `editorial` : formulation du dilemme et arguments contradictoires.

Une réaction politique simulée est toujours identifiable comme règle du jeu.

### 9.2 Socle de sources

Le socle privilégie les sources primaires :

- INSEE ;
- Eurostat ;
- lois de finances et documents budgétaires ;
- Cour des comptes ;
- Conseil d'orientation des retraites ;
- RTE ;
- ministères et administrations compétentes ;
- rapports parlementaires ;
- autorités administratives indépendantes.

Les instituts, think tanks et contributions politiques servent à identifier des scénarios et contre-arguments. Ils ne remplacent pas une source primaire pour les données centrales.

### 9.3 Archive de la République

Un dossier peut présenter un précédent historique très court. L'analyse complète reste dans le journal ou la page Sources et méthode afin de ne pas polluer la décision.

## 10. Modèle de données cible

### 10.1 Décision

Une décision contient au minimum :

```ts
type Decision = {
  id: string;
  version: number;
  chapterId: string;
  title: string;
  context: string;
  options: DecisionOption[];
  evidence: EvidenceBlock[];
  historicalPrecedent?: HistoricalPrecedent;
  dependencies: string[];
  conflicts: string[];
};
```

### 10.2 Option

```ts
type DecisionOption = {
  id: string;
  label: string;
  summary: string;
  budgetEffects: TimedBudgetEffect[];
  countryEffects: TimedCountryEffect[];
  politicalEffects: TimedPoliticalEffect[];
  beneficiaries: string[];
  contributors: string[];
  risks: RiskRule[];
  scheduledEvents: ScheduledEventRule[];
  promises: PromiseRule[];
  locks: string[];
  unlocks: string[];
  uncertainty: "faible" | "moyenne" | "forte";
};
```

### 10.3 État de campagne

```ts
type CampaignState = {
  schemaVersion: number;
  scenarioVersion: number;
  seed: number;
  phase: CampaignPhase;
  chapterIndex: number;
  decisionIndex: number;
  decisions: DecisionRecord[];
  indicators: IndicatorState;
  groups: GroupState;
  scheduledEvents: ScheduledEvent[];
  activePromises: PoliticalPromise[];
  activeCrises: CrisisState[];
  causalLedger: CausalEntry[];
  savedAt: string;
};
```

### 10.4 Migration

Les anciennes sauvegardes V2 ne sont pas silencieusement converties en V3, car les règles et la campagne changent. L'interface propose de commencer le nouveau mandat. Les anciens liens de défi reçoivent une page d'explication et un accès à la V3.

## 11. Composants cibles

- `SimulatorShell` : navigation et phase active ;
- `MandateIntro` : entrée en fonction ;
- `CommandBar` : mandat, chapitre, progression et Pause ;
- `ChapterIntro` : ouverture de chapitre ;
- `DecisionScene` : dossier principal ;
- `DecisionOptionCard` : option entièrement cliquable ;
- `DecisionConfirmation` : confirmation intégrée ;
- `EvidencePanel` : analyse et sources ;
- `MandateHUD` : quatre familles d'indicateurs ;
- `DecisionResult` : retour persistant ;
- `MandateJournal` : décisions et causalité ;
- `CouncilScene` : synthèse toutes les quatre décisions ;
- `CrisisScene` : crise et concessions réelles ;
- `DelayedEventScene` : conséquence différée ;
- `ChapterVerdict` : fin de chapitre ;
- `PauseMenu` : reprise, journal, recommencer et quitter ;
- `MandateVerdict` : fin de campagne ;
- `ShareCard` : résultat partageable.

Les composants affichent des données préparées par le moteur. Ils ne calculent pas eux-mêmes les règles économiques ou politiques.

## 12. Mobile

Le mobile à 390 px est la référence de conception. Le produit reste utilisable à 320 px.

### 12.1 Contraintes

- aucune largeur horizontale parasite ;
- cibles tactiles de 44 px minimum ;
- cartes lisibles sans zoom ;
- action principale accessible dans le flux naturel ;
- pas de barre fixe qui masque le contenu ;
- en-tête de partie compact ;
- montants courts et unités cohérentes ;
- détails secondaires dépliables ;
- aucun geste obligatoire.

### 12.2 Densité

La carte mobile affiche avant confirmation :

- libellé ;
- coût ou gain ;
- horizon ;
- deux ou trois domaines affectés ;
- risque principal.

Les gagnants, perdants, mécanismes et sources sont disponibles dans l'analyse, sans cacher le choix essentiel.

## 13. Accessibilité

- WCAG 2.1 AA minimum ;
- navigation complète au clavier ;
- focus visible ;
- ordre de lecture logique ;
- état sélectionné annoncé aux technologies d'assistance ;
- aucune information portée uniquement par la couleur ;
- montants prononçables par lecteur d'écran ;
- contrastes vérifiés sur bleu nuit, ivoire, rouge et or ;
- animations réduites ;
- aucun son automatique ;
- messages d'erreur reliés à l'action concernée.

## 14. Performance

- les données de chapitre sont chargées à la demande ;
- les illustrations sont légères et non indispensables à la compréhension ;
- l'écran de décision reste interactif pendant les transitions ;
- les animations utilisent principalement opacité et transformation ;
- les sauvegardes locales sont courtes, versionnées et compressibles ;
- aucune bibliothèque graphique lourde n'est ajoutée sans bénéfice mesuré.

## 15. Analytics respectueux

Les événements utiles sont :

- démarrage ;
- décision affichée ;
- option ouverte ;
- analyse ouverte ;
- choix confirmé ;
- abandon ;
- reprise ;
- crise déclenchée ;
- concession ;
- chapitre terminé ;
- campagne terminée ;
- partage ;
- revanche.

Aucune opinion politique nominative n'est enregistrée. Les parcours utilisent un identifiant anonyme et limité dans le temps.

## 16. Impact sur le dépôt actuel

Les principaux points déjà identifiés sont :

- `site/src/tunnel-rendu.ts` : entrée, écrans, mode express, lien de sortie et verdict ;
- `site/src/tunnel-modele.ts` : état, engagements, pile, crises, concessions, sauvegarde et défi ;
- `site/src/campagne.ts` : ordre express et structure de campagne ;
- `site/src/mesures.ts` : corpus des décisions ;
- `site/src/dilemmes.ts` : complétude éditoriale ;
- `site/src/main.ts` : activation du plein écran et navigation ;
- `site/src/style.css` et `site/src/styles/tunnel-cabinet.css` : coque, responsive et états ;
- tests `tunnel.test.ts`, `campagne.test.ts` et `interface.test.ts` : hypothèses V2 à remplacer.

Le travail doit distinguer quatre chantiers : moteur V3, corpus éditorial, interface V3 et migration.

## 17. Vérification

### 17.1 Tests unitaires

- application unique des effets ;
- effets récurrents et différés ;
- causalité ;
- déclenchement des crises ;
- concession qui modifie réellement une décision ;
- verrouillage et déverrouillage ;
- sauvegarde et reprise ;
- verdict déterministe ;
- détection du cadratin interdit.

### 17.2 Tests de composants

- carte entièrement cliquable ;
- confirmation intégrée ;
- analyse et sources ;
- variation lisible sans couleur ;
- journal ;
- crise ;
- pause ;
- verdict ;
- états vides et dégradés.

### 17.3 Tests de parcours

- campagne complète de 96 décisions ;
- reprise après rechargement ;
- passage des huit chapitres ;
- crise résolue par concession ;
- crise résolue par maintien du cap ;
- événement différé ;
- fin anticipée institutionnelle ;
- verdict et revanche ;
- sortie vers `/bilan` ;
- ancien lien V2 reçu ;
- navigation clavier ;
- réduction des animations.

### 17.4 Matrice visuelle

- 320, 375, 390, 768, 1024 et 1440 px ;
- Chrome, Firefox et Safari mobile récents ;
- aucune barre horizontale ;
- aucun contenu masqué par l'en-tête ;
- concordance visuelle avec la première planche sans médaillon.

## 18. Critères d'acceptation

La V3 est prête lorsque :

- il n'existe qu'une campagne de 96 décisions ;
- les 96 décisions sont complètes et sourcées ;
- aucune option n'affiche « Impact : à préciser » ;
- chaque carte de choix est directement cliquable ;
- aucune action dupliquée n'apparaît sous les cartes ;
- la navigation du site reste identifiable ;
- Pause et quitter fonctionnent ;
- quitter mène à `/bilan` ;
- chaque crise cite ses causes ;
- chaque concession modifie une politique ou un engagement réel ;
- les décisions confirmées sont persistantes ;
- la campagne est reprenable ;
- les effets différés reviennent au bon moment ;
- le verdict explique le mandat avant tout partage ;
- l'interface fonctionne à 320 px ;
- les tests d'accessibilité critiques passent ;
- aucun cadratin n'est présent dans les contenus servis ;
- le réel correspond à la maquette validée sur les écrans de référence.

## 19. Hors périmètre de la première livraison

- campagne territoriale jouable ;
- comptes utilisateurs ;
- synchronisation multi-appareils ;
- classement public nominatif ;
- génération de décisions par intelligence artificielle pendant une partie ;
- prédiction macroéconomique présentée comme certaine ;
- application mobile native.

## 20. Séquence de livraison recommandée

1. Socle V3 et migration de l'état ;
2. coque, navigation et écran de décision ;
3. journal, Conseil et effets différés ;
4. crises et concessions réelles ;
5. verdict et partage ;
6. reconstruction et validation des 96 décisions ;
7. audit mobile, accessibilité et concordance visuelle ;
8. déploiement progressif.

Le nouveau moteur et l'interface peuvent être développés avec un petit corpus représentatif. La mise en production ne doit toutefois pas exposer la V3 tant que les 96 décisions ne satisfont pas le contrat éditorial.
