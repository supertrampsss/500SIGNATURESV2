# Mandats : contrat de la prochaine version

Décision propriétaire du 26 septembre 2026 : réaliser le brainstorm approuvé en un parcours cohérent et jouable, vérifier puis livrer. Les fichiers France/Villes de l'ancien checkout sont hors périmètre et restent intacts.

## Périmètre livré

- Version 11 du mandat national, cinq années et trente décisions au maximum. Les versions précédentes restent rejouables.
- Entrée immédiate dans une situation précise ; reprise prioritaire et contextualisée.
- Trois contextes déterministes, accessibles en un clic : coalition fragile, hôpital prioritaire, redressement. Le contexte est dérivé du seed, donc voyage avec le défi.
- Choix entre trois fronts au maximum, report avec échéance visible, sélection du front sans consommer une décision.
- Amendements concrets modifiant budget, personnes concernées et soutiens ; vote avant application.
- Promesses, personnages et réalisations persistants ; conséquences immédiates et différées, accomplissements possibles, causes identifiables.
- Six familles de scènes controversées : soins, industrie, énergie/mobilité, recrutement/intégration, intégrité du gouvernement, logement.
- Décor qui montre les réalisations effectivement financées, bloquées, livrées ou abandonnées.
- Une séquence continue : situation, carte cliquée, résultat, conséquence, prochain dossier. Pas de confirmation avant décision.
- Vote courant bref, scrutin crucial mis en scène, mouvement réduit respecté.
- Récap et ouverture de l'année suivante réunis. Bilan individualisé et vrai tournant à rejouer.
- Partage d'un dilemme jouable, même contexte extérieur au replay, sauvegarde locale protégée avant adoption d'un lien.
- Défis contextualisés et objectifs vérifiables, épilogue électoral déterministe reposant sur le mandat, presse fictive et personnages identifiés comme tels.
- Navigation du site toujours accessible, actions essentielles sans survol, une seule action principale par étape.

## Contrat de données entre modules

La version 11 utilise `Game.narrative?: NarrativeState`. L'état est reconstruit depuis le seed et les choix ; seul le front actuellement ouvert est un état de présentation validé et sérialisé en complément des choix. Aucun montant, résultat de vote ou état de promesse importé n'est tenu pour autoritaire.

API narrative-engine.ts :
- `storyAgenda(g)` retourne jusqu'à trois `{id,title,category,summary,art,urgency}`.
- `selectStoryAgenda(g,id)` retourne une nouvelle partie, sans avancer le temps ni modifier les comptes.
- `storyPhase(g)` retourne `agenda` ou `decision`.
- Le moteur intègre le dossier actif dans `domainFor(g)` ; `choicesFor` et `decide` restent les API de décision.
- Lors du replay, un identifiant de choix doit restaurer son front uniquement s'il était disponible à cet instant.

`NarrativeState` : `context`, `focus?`, `promises`, `projects`, `relationships`, `events`, `lastConsequences`.
Promesse : `{id,label,status:'active'|'kept'|'broken',causeTurn?,dueTurn?,targetProject?,keepWhen?,funded?,baseline?}`. Une promesse `project_delivered` est tenue uniquement quand son projet cible est livré. `programme_executed` exige que le choix d'origine ait effectivement engagé des crédits, que les effectifs publics restent au moins à 35 et que le gouvernement ne soit pas tombé à l'échéance. Réserver `services_improved` aux engagements dont le choix ou le service livré améliore réellement l'indicateur de services. Les promesses de contexte sont des options narratives tant qu'un choix ne les active pas.
Réalisation : `{id,kind,label,place,status:'funded'|'blocked'|'delivered'|'withdrawn',startedTurn,dueTurn,sourceChoice,deliveredTurn?,causeTurn?,note}`.
Interlocuteur : `{id,name,role,loyalty,stance,lastTurn?}`.
Événement causal : `{id,turn,kind,title,detail,causeTurn,weight}` avec index de décision base zéro.
Le moteur peut enrichir ces structures en concertation ; les vues lisent cet état et n'inventent aucun effet.

### Reprise des réalisations bloquées

- Tout projet `blocked` conserve un front de reprise/abandon prioritaire, indépendant du plafond par famille des scènes ordinaires. Une crise institutionnelle peut l'interrompre, mais la reprise redevient le premier front narratif dès que cette interruption cesse.
- Le front authored du projet est utilisé tant qu'il n'a pas déjà été tranché. Sinon, le moteur synthétise un front à partir du projet, sans état supplémentaire à sérialiser : `suivi-${hash32(project.id).toString(36)}-${failureTurn}`. Le hash est FNV-1a 32 bits sur l'identifiant du projet. Les choix sont `reprendre-${hash}` et `abandonner-${hash}`; le préfixe complet d'un choix reste sous 64 caractères.
- Le front n'est jamais reporté et reste disponible tant que le projet reste bloqué. Après un échec de reprise, `failureTurn` change à la prochaine livraison tentée et crée une nouvelle occurrence; un vote rejeté laisse le projet bloqué et le même front réapparaît à la décision suivante.
- Une reprise synthétique paie une tranche de coordination initiale de 0,05 Md€. Pour les réparations authored, on conserve leur investissement ou fonctionnement de base. Les moyens supplémentaires sont calculés à partir des capacités au moment du vote : `serviceBoost = max(0, ceil(seuilServices + 3 - (servicesCourants + effetServicesDeBase)))`, où le seuil vaut 45 pour la santé et 40 pour les autres projets; `staffBoost = max(0, ceil(38 - (agentsPublicsCourants + effetAgentsPublicsDeBase)))`. Le fonctionnement supplémentaire vaut `serviceBoost + 0,5 × staffBoost` Md€/an. Les points sont appliqués par les effets réels du choix; la marge de trois points couvre l'usure habituelle avant la nouvelle échéance, sans garantir la livraison. Ces coefficients sont des hypothèses de simulation, pas des coûts observés.
- Les véritables préconditions de livraison restent contrôlées à l'échéance : trésorerie non négative, cabinet en fonction, seuil de services et au moins 35 points d'agents publics. Une reprise n'invente ni crédits disponibles ni changement de gouvernement; si le motif persiste, le chantier se bloque à nouveau et peut être repris ou abandonné.

## Modes d'échec à traiter avant implémentation

1. Agenda consommant un tour sans acte, ou choix rejoué hors de son contexte disponible.
2. Recettes comptées deux fois, investissement abandonné conservant son rendement, effet d'un texte rejeté.
3. Bascule d'année appliquant deux fois un effet différé ou n'appliquant jamais une réalisation.
4. Promesse/personnage/décor contradictoire avec les décisions réellement adoptées.
5. Rechargement, export, import, lien partagé ou branche donnant un autre vote ou une autre trajectoire.
6. Défi partagé écrasant la sauvegarde locale avant action explicite.
7. Compteur de déficit affichant un excédent comme déficit, équilibre rendu impossible par les interruptions.
8. Une voie de crise sans sortie, ou toutes les réussites punies systématiquement.
9. Double clic, retour ou animation interrompue inscrivant une décision deux fois.
10. Choix essentiels hors écran, débordements à 320 px, résultat illisible, absence de navigation clavier.
11. Presse fictive ou personnages interprétés comme témoignages/observations réels.
12. Replay promettant un résultat contrefactuel non calculé.

## Validation et preuves

Parcours E2E : entrée et reprise ; deux ordres d'agenda ; amendement adopté/rejeté ; projet livré/bloqué/réparé ; promesse tenue/rompue ; trente décisions avec équilibre atteignable ; crise et fin anticipée ; export/reprise ; partage protégé ; replay causal ; contexte/défi ; épilogue final ; petit mobile, mobile, bureau et mouvement réduit.
Conserver scénarios, sauvegardes rejouables, captures et rapports. Inspecter les vrais écrans. Ne pas ajouter de tests unitaires après le code. Exécuter les tests existants et la compilation. Le workflow de livraison exige une PR vérifiée avant fusion.
