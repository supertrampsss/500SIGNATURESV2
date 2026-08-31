# V3 impact, analyses et questions pré-rendues

Date : 30 août 2026

Statut : validé pour implémentation avec l'addendum design

Addendum design obligatoire : `2026-08-30-v3-direction-design-addendum.md`

Dépôt cible : dépôt existant `500SIGNATURESV2`

Périmètre : simulateur, expérience mobile, analyses France et questions en langage naturel

Exclusion explicite : aucune collecte, connexion ou exploitation de X

## 1. Décision produit

La V3 transforme le simulateur actuel en une campagne courte et causale :

- 60 arbitrages structurants sont joués pendant une partie ;
- les 96 décisions existantes sont conservées comme bibliothèque éditoriale ;
- les sujets non joués alimentent les variantes, les conséquences différées et les décisions de crise ;
- les effets se propagent pendant un mandat de cinq ans au lieu d'être additionnés une seule fois ;
- l'interface rend le choix compréhensible avant d'exposer les explications ;
- cinq nouvelles analyses sont publiées avec des sources primaires et des limites explicites ;
- un espace de questions donne des réponses pré-rendues sans appel à un modèle en production.

Cette spécification remplace les décisions incompatibles des documents antérieurs, notamment :

- l'obligation de jouer les 96 décisions dans une seule partie ;
- le défilement public de 100 analyses complètes sans mécanisme de découverte ;
- le moteur de questions reposant sur une compréhension par modèle à chaque demande ;
- les effets politiques générés automatiquement à partir d'un autre indicateur ;
- le bilan principalement déterminé par le seul solde budgétaire.

Le projet reste dans le dépôt V2. La mention V3 désigne une évolution du produit, pas un nouveau dépôt, un fork ou une nouvelle application.

## 2. Objectifs et non-objectifs

### 2.1 Objectifs

- Permettre de terminer une partie sans devoir lire 96 dossiers.
- Créer des choix politiquement distincts et mécaniquement conséquents.
- Faire apparaître les effets immédiats, différés et conditionnels.
- Rendre le premier écran de décision utilisable à 390 px sans surcharge.
- Ajouter les cinq analyses demandées sans inventer de causalité ni de série.
- Offrir une expérience de questions familière, stable et presque sans coût marginal.
- Conserver la traçabilité des données et l'accès aux preuves.

### 2.2 Non-objectifs

- Prédire précisément le résultat réel d'un programme politique.
- Utiliser un modèle génératif pour répondre en direct aux visiteurs.
- Fabriquer un indice propriétaire de qualité de vie.
- Déduire l'âge des acquéreurs à partir de DVF.
- Présenter l'arrêt du nucléaire allemand comme cause unique d'un prix de l'électricité.
- Collecter des données depuis X.

## 3. Architecture de l'expérience

La V3 possède quatre espaces complémentaires :

1. **Campagne** : 60 arbitrages, événements, crises et verdict.
2. **Bibliothèque des mesures** : les 96 sujets existants, consultables sans obligation de les jouer.
3. **Analyses France** : sélection éditoriale, recherche, filtres et dossiers sourcés.
4. **Questions** : recherche conversationnelle dans un corpus de réponses validées.

La campagne reste la porte d'entrée ludique. La bibliothèque explique les politiques. Les analyses documentent le réel. Les questions rendent ces contenus accessibles sans connaître la structure du site.

## 4. Campagne de 60 arbitrages

### 4.1 Structure

La campagne comprend huit chapitres de sept ou huit arbitrages. Chaque chapitre couvre une tension différente du mandat. Un bilan intermédiaire et une possibilité de pause sont proposés à la fin de chaque chapitre.

| Chapitre | Nombre | Noyaux obligatoires |
|---|---:|---|
| Urgence budgétaire | 8 | trajectoire du déficit, dépenses de l'administration, financement de l'effort initial |
| Travail et production | 8 | retraites, assurance chômage, temps de travail et salaire minimum |
| Fiscalité et redistribution | 8 | impôt sur le revenu, patrimoine et capital, TVA et fiscalité de consommation |
| Services publics | 8 | santé, école, effectifs et rémunération publics |
| Énergie et climat | 7 | place du nucléaire, gaz, chauffage et carbone, renouvelables et réseaux |
| Logement et générations | 7 | accession à la propriété, construction et loyers, transmission et solidarité entre générations |
| Autorité et institutions | 7 | immigration, sécurité et justice, représentation et organisation territoriale |
| Europe et souveraineté | 7 | règles et budget européens, défense, industrie, commerce et protections stratégiques |

Cette liste définit les tensions à couvrir. Les intitulés publics et les options sont soumis aux contrôles éditoriaux du projet avant publication.

### 4.2 Options

Un arbitrage propose deux à quatre options. La cible habituelle est trois options :

- continuité ou prudence ;
- réforme structurelle ;
- rupture assumée.

Une option n'est publiable que si elle diffère réellement des autres sur au moins deux dimensions parmi :

- effet budgétaire ;
- calendrier ;
- bénéficiaires et contributeurs ;
- mécanisme économique ;
- faisabilité politique ;
- dépendance européenne ou juridique ;
- risque d'exécution.

Les options dominées, les faux choix et les reformulations d'un même scénario sont refusés.

### 4.3 Réemploi des 96 décisions

Les 96 décisions actuelles deviennent un catalogue versionné. Chaque entrée reçoit un rôle :

- arbitrage principal ;
- sous-mesure d'une option ;
- décision conditionnelle ;
- réponse à une crise ;
- contenu de bibliothèque uniquement.

Aucune mesure n'est supprimée uniquement parce qu'elle ne figure pas dans les 60 arbitrages. Les 36 autres sujets alimentent en priorité les sous-mesures, décisions conditionnelles, réponses aux crises et contenus de bibliothèque. Les anciennes progressions sauvegardées restent lisibles. Une migration de version empêche qu'une partie V2 soit silencieusement interprétée comme une partie V3.

## 5. Modèle causal du mandat

### 5.1 État typé

Les unités sont déclarées dans les types et ne sont jamais interchangeables.

| Domaine | Exemples d'état | Unités attendues |
|---|---|---|
| Finances | solde annuel, dette, charge d'intérêt | milliards d'euros, pourcentage du PIB |
| Économie | activité, emploi, recettes associées | indice, taux, milliards d'euros |
| Ménages | pouvoir d'achat, coût de l'énergie, accès aux services | indice ou unité documentée |
| Politique | confiance, majorité, capacité de réforme | score borné et explicitement ludique |
| Énergie | production, importations, émissions, sécurité | unité physique ou indice documenté |
| Services publics | capacité, délai, couverture | indicateur propre au service |

Un score politique n'est jamais présenté comme une statistique observée. Un indicateur économique n'est jamais converti mécaniquement en opinion ou en majorité.

### 5.2 Temps

Le mandat est calculé de T0 à T+5. Chaque option possède :

- un coût ou rendement initial ;
- un profil annuel ;
- une date d'entrée en vigueur ;
- une éventuelle montée en charge ;
- une durée ;
- des conditions d'activation ;
- un niveau d'incertitude ;
- une ou plusieurs références.

À chaque point de passage, le moteur :

1. applique les effets arrivés à échéance ;
2. recalcule le solde annuel ;
3. met à jour la dette et la charge d'intérêt ;
4. applique uniquement les rétroactions explicitement modélisées ;
5. évalue les conditions de crise ;
6. écrit une trace causale dans le journal.

Les paramètres ne prétendent pas être des prévisions. Ils matérialisent des mécanismes et des ordres de grandeur documentés.

### 5.3 Conséquences

Chaque conséquence est de l'un des types suivants :

- immédiate ;
- différée ;
- récurrente ;
- conditionnelle ;
- compensatoire ;
- irréversible pendant la partie.

Chaque variation visible doit pouvoir répondre à la question : « quelles décisions ont produit ce résultat ? »

### 5.4 Crises

Une partie rencontre quatre à huit crises selon les décisions et l'état du pays, avec au maximum une crise majeure par chapitre. Une crise n'est pas tirée au hasard sans justification. Elle déclare :

- son déclencheur principal ;
- ses facteurs aggravants ;
- les options de réponse disponibles ;
- les politiques suspendues, amendées ou accélérées ;
- les effets immédiats et futurs de la réponse.

Les groupes concernés et les dépendances déclarées dans le catalogue participent réellement aux conditions et aux résultats.

### 5.5 Verdict

Le verdict présente séparément :

- finances publiques ;
- économie réelle ;
- ménages et services publics ;
- énergie et climat ;
- stabilité politique ;
- cohérence entre les décisions.

Il n'existe pas de classement global principalement dicté par le budget. Le résumé final explique les tensions résolues, les problèmes déplacés et les principaux effets différés encore en cours.

## 6. Interface compacte

### 6.1 Règle des trois profondeurs

Chaque écran suit la même hiérarchie :

1. **5 secondes** : comprendre la question et distinguer les options.
2. **30 secondes** : lire le mécanisme, le coût, le gagnant et le risque.
3. **Preuves** : consulter hypothèses, méthode, réserves et sources.

Les informations du niveau 3 ne sont jamais injectées par défaut dans le niveau 1.

### 6.2 Écran de décision mobile

À 390 px :

- barre de mandat sur deux lignes maximum ;
- titre de dossier compris entre 30 et 32 px ;
- contexte limité à deux lignes avant développement ;
- aucune grande illustration au-dessus des options ;
- carte fermée limitée au nom, au budget, à un impact principal et à un risque ;
- détail dans un volet, pas dans toutes les cartes simultanément ;
- tableau de situation limité aux indicateurs modifiés ;
- focus et position de défilement replacés au début du nouveau dossier.

Le bouton de confirmation reste dans la carte sélectionnée. Après confirmation, le résultat reste lisible jusqu'à une action explicite du joueur.

### 6.3 Analyses France

La page France ne déroule plus l'intégralité du catalogue :

- environ huit analyses mises en avant ;
- recherche par titre, question et mot-clé ;
- filtres thématiques ;
- catalogue chargé et rendu progressivement ;
- une seule analyse longue ouverte à la fois ;
- accès direct à une route autonome pour partager un dossier.

Le nombre exact de cartes n'est plus un contrat produit. Le contenu peut dépasser 100 analyses sans modifier la promesse de l'interface.

### 6.4 Journal

Le journal n'est plus une liste plate de 96 lignes. Il est regroupé par chapitre et par année du mandat. Chaque groupe affiche un résumé, puis permet de développer les décisions et chaînes causales.

## 7. Cinq nouvelles analyses

Chaque sujet possède :

- une carte courte ;
- une route autonome pré-rendue ;
- au moins un graphique si la série le permet ;
- une définition ;
- les périodes réellement disponibles ;
- une réserve méthodologique ;
- les références de sources associées à chaque preuve.

### 7.1 Nucléaire allemand et prix de l'énergie

Question : que montre la chronologie allemande, et que ne permet-elle pas de conclure seule ?

Le dossier sépare :

- calendrier de production nucléaire ;
- mix et production d'électricité ;
- prix de gros lorsque la série est comparable ;
- prix payé par les ménages dans une tranche constante ;
- taxes ;
- prix du gaz ;
- comparaison avec plusieurs voisins européens.

La sortie du nucléaire n'est pas présentée comme cause unique d'une variation de prix. Les corrélations, chocs communs et mécanismes documentés sont distingués.

Sources prioritaires : Eurostat pour le mix et les prix harmonisés, puis producteurs publics allemands ou européens lorsque nécessaires.

### 7.2 Fournitures scolaires

Question : les prix des fournitures scolaires ont-ils augmenté plus vite que l'ensemble des prix ?

La série principale est l'indice Insee `09.5.4.9.2 Autres fournitures scolaires et de bureau`, comparé à l'indice général sur une base temporelle commune.

Le dossier ne transforme pas un indice de prix en coût total de la rentrée. Il précise que vêtements, transport, cantine, équipement informatique et quantités achetées ne sont pas couverts par cette seule série.

### 7.3 Prix du gaz

Question : comment la facture unitaire du gaz des ménages a-t-elle évolué, et quelle part vient des taxes ?

La série principale est Eurostat `nrg_pc_202` :

- tranche de consommation constante ;
- prix toutes taxes comprises ;
- prix hors taxes lorsque disponible ;
- fréquence semestrielle ;
- comparaison européenne homogène.

La consommation de gaz déjà chargée dans le site ne sert pas de proxy au prix.

### 7.4 Âge d'achat de la résidence principale

Question : les ménages achètent-ils leur résidence principale plus tard ?

Le dossier utilise les vagues disponibles des enquêtes logement et publie d'abord des répartitions par tranche d'âge. Il distingue :

- acquéreur récent ;
- accédant à la propriété ;
- primo-accédant ;
- propriétaire occupant.

DVF ne contient pas l'âge de l'acquéreur et ne permet pas de produire cette série. Une moyenne annuelle n'est publiée que si une source la mesure directement avec une définition stable. Les points disponibles ne sont pas interpolés pour fabriquer une continuité.

### 7.5 Qualité de vie

Question : la satisfaction dans la vie et certaines conditions objectives évoluent-elles dans le même sens ?

Le dossier publie séparément :

- satisfaction déclarée dans la vie ;
- niveau de vie ;
- santé perçue ou autre indicateur disponible et comparable ;
- logement ;
- emploi ;
- sécurité lorsque la source mesure effectivement cette dimension.

Les notes de satisfaction sont présentées en points sur leur échelle, pas comme des pourcentages. Aucun score composite maison ne fusionne ces dimensions.

## 8. Questions pré-rendues sans coût de modèle en production

### 8.1 Promesse

L'utilisateur écrit une question en français et reçoit une réponse courte, validée, sourcée et reliée à une analyse. L'interface peut être conversationnelle, mais son moteur de production est une recherche locale déterministe.

### 8.2 Corpus versionné

Une entrée suit un schéma de ce type :

```ts
type QuestionReponse = {
  id: string
  questionCanonique: string
  variantes: string[]
  motsCles: string[]
  reponseCourte: string
  reponseDetaillee?: string
  limites: string
  analyseIds: string[]
  indicateurIds: string[]
  sourceIds: string[]
  versionDonnees: string
  revuLe: string
}
```

Les réponses sont générées au build ou rédigées dans le dépôt. Un modèle peut aider l'équipe à proposer des variantes de question ou un premier brouillon, mais le résultat est relu, validé et commité avant publication.

### 8.3 Résolution locale

Le navigateur applique successivement :

1. normalisation de la question ;
2. correspondance exacte avec une variante ;
3. recherche textuelle pondérée sur questions et mots-clés ;
4. contrôle d'un seuil minimal ;
5. réponse validée ou proposition de trois questions proches.

Une correspondance insuffisante produit :

> Nous n'avons pas encore de réponse validée à cette question.

Le site ne complète pas la réponse librement. Il peut proposer les sujets proches réellement présents dans le corpus.

### 8.4 Territorialisation

Les réponses territoriales utilisent des gabarits déterministes sur les données déjà publiées. Elles n'inventent ni explication ni causalité. Si les millésimes, unités ou périmètres ne sont pas comparables, la réponse le dit et refuse la comparaison.

### 8.5 Coût, sécurité et confidentialité

- Aucun appel OpenAI ou autre modèle depuis le navigateur.
- Aucune clé de modèle dans le site.
- Aucun coût en tokens par question publique.
- Les fichiers de réponses sont statiques, versionnés et compatibles avec le pré-rendu.
- Une éventuelle collecte de questions sans réponse est désactivée par défaut, anonymisée si elle est activée et soumise aux règles de consentement du site.

## 9. Données, sources et publication

Les cinq nouveaux dossiers et le corpus de questions respectent la charte de `docs/06-qualite-methodologie.md`.

Les nouvelles sources sont inscrites au registre avant publication. Les connecteurs produisent des données versionnées, jamais des valeurs copiées manuellement dans le rendu. Chaque preuve conserve : source, période, unité, définition, extraction, réserve et version.

Références initiales :

- Eurostat, énergie en Europe : <https://ec.europa.eu/eurostat/web/interactive-publications/energy-2026>
- Eurostat, prix du gaz des ménages `nrg_pc_202` : <https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_202/de>
- Insee, indice des fournitures scolaires `001765036` : <https://www.insee.fr/fr/statistiques/serie/001765036>
- Insee, profil des acquéreurs récents : <https://www.insee.fr/fr/statistiques/5371267?sommaire=5371304>
- Insee, satisfaction dans la vie : <https://www.insee.fr/fr/statistiques/8617446?sommaire=8617661>
- Eurostat, satisfaction dans la vie `ilc_pw01` : <https://ec.europa.eu/eurostat/product?code=ilc_pw01&mode=view>

Ces liens amorcent l'ingestion. La publication reste bloquée si la définition, la période ou la comparabilité ne sont pas suffisantes.

## 10. Compatibilité et migrations

- Le code reste dans l'arborescence actuelle du dépôt.
- Le catalogue des 96 décisions conserve ses identifiants lorsque leur sens ne change pas.
- Le format de sauvegarde reçoit une version explicite.
- Une sauvegarde V2 peut être consultée ou recommencée, mais n'est pas convertie silencieusement.
- Les anciennes routes d'analyse restent valides.
- Les routes pré-rendues figurent dans le sitemap.
- Les aperçus sociaux et métadonnées restent déterministes.
- Les tests qui imposent exactement 96 décisions jouées ou exactement 100 cartes visibles sont remplacés par les nouveaux contrats produit.

## 11. Accessibilité et performance

- Navigation complète au clavier.
- Focus visible et replacé après changement de dossier.
- Libellés accessibles pour options, détails et graphiques.
- Respect de `prefers-reduced-motion`.
- Pas d'information portée seulement par la couleur.
- Pas de chargement d'un modèle ou d'un index distant pour les questions.
- Chargement progressif du catalogue d'analyses.
- Pré-rendu utilisable sans JavaScript pour les dossiers et réponses canoniques.
- Aucun débordement horizontal à 390 px.

## 12. Contrats de validation

### 12.1 Simulateur

- Une nouvelle partie contient exactement 60 arbitrages principaux.
- Les huit chapitres contiennent quatre groupes de huit arbitrages et quatre groupes de sept arbitrages.
- Les 96 sujets restent accessibles dans la bibliothèque.
- La dette et la charge d'intérêt évoluent dans le temps lorsque les règles documentées l'exigent.
- Une conséquence visible possède une cause consultable.
- Les dépendances et groupes déclarés sont consommés par le moteur ou retirés du schéma.
- Une crise modifie réellement l'état ou une politique.
- Le verdict expose plusieurs dimensions sans classement budgétaire unique.

### 12.2 Interface

- Le choix, l'impact principal et le risque sont visibles sans ouvrir le détail.
- Le changement de dossier replace le focus et le défilement.
- Le tableau de situation ne répète pas les indicateurs inchangés.
- Le journal est groupé, repliable et lisible sur mobile.
- La page France n'affiche pas le catalogue complet au chargement initial.

### 12.3 Analyses

- Les cinq nouveaux sujets possèdent une route autonome.
- Chaque chiffre visible référence une source et un millésime.
- L'analyse allemande distingue prix de gros, prix des ménages, taxes, gaz et mix.
- L'analyse scolaire ne présente pas l'indice comme un panier complet.
- L'analyse du gaz ne confond pas prix et consommation.
- L'analyse immobilière ne fabrique pas d'âge moyen avec DVF.
- L'analyse de qualité de vie ne fabrique pas de score composite.

### 12.4 Questions

- Une question couverte renvoie une réponse pré-rendue et ses sources.
- Une paraphrase validée retrouve la même réponse canonique.
- Une question hors périmètre ne reçoit aucune réponse générée.
- Aucun test end-to-end ne nécessite une clé de modèle.
- Le build et le site fonctionnent sans service d'intelligence artificielle externe.

## 13. Ordre de réalisation recommandé

1. Contrats, migrations et modèle causal.
2. Sélection et adaptation des 60 arbitrages.
3. Écran de décision compact, journal et verdict multidimensionnel.
4. Ingestion et publication des cinq analyses.
5. Corpus de questions et recherche locale.
6. Vérification mobile, accessibilité, pré-rendu et non-régression.

Chaque lot reste déployable séparément dans le dépôt V2. La bascule publique vers la V3 intervient seulement lorsque les sauvegardes, le parcours complet et les contenus sourcés ont passé leurs contrôles.
