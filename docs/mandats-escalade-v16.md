# Escalade civile et réformes spontanées v16

Hypothèses de défaillance écrites avant implémentation, 17 octobre 2026.

- L’inaction doit pouvoir terminer le mandat avant cinq ans. La défaite exige une crise civile durable, une succession annoncée de grève, blocage, révolte puis révolution, avec un délai permettant une réponse réelle.
- Aucun tirage ne destitue automatiquement le président. Une censure concerne le gouvernement. Une démission présidentielle est un choix explicite ; une rupture révolutionnaire est une hypothèse du jeu, pas une procédure juridique.
- Le secours temporaire suspend l’escalade seulement pendant sa livraison effective. Une commande sans équipes disponibles ne résout rien. Les réponses utilisent les crédits et programmes existants.
- Les réformes apparaissent spontanément sur le pays, sans navigation obligatoire. La sélection est reproductible avec la graine ; le catalogue facultatif reste disponible. Une réforme déjà décidée ne réapparaît pas.
- Un rechargement/export rejoue les mêmes événements et ne duplique ni vote ni dépense. Les anciennes versions ne reçoivent aucun nouvel événement.
- Une réussite doit créer une accalmie mesurable. La variété n’est pas une garantie de rencontrer toutes les catastrophes dans chaque partie.

Vérification attendue par parcours légaux : inaction jusqu’à rupture, réponse durable jusqu’à accalmie, réponse temporaire puis rechute, réformes spontanées et vote rejeté, sauvegarde/rejeu exact. Les tests isolés de trajectoire sont écrits avant les fonctions concernées.

## Règles livrées

Le temps, les incidents locaux et les stocks restent la cause des mouvements : au moins deux périodes de problèmes locaux arrivés à échéance (trois pour certaines graines), et pression moyenne ou tension sociale de 35 minimum. L’inaction entretient la tension et fragilise la légitimité. La crise civile progresse de grève à blocage, révolte puis crise révolutionnaire ; chaque étape laisse deux à quatre périodes selon la graine. Le même identifiant conserve l’accord déjà engagé lors d’une escalade. L’origine reste fixe ; `stageStartedPeriod` date la nouvelle étape.

La médiation financée utilise une équipe et ne suspend l’escalade que lorsqu’elle est livrée. L’accord durable mobilise de une à trois équipes selon le stade pendant quatre mois minimum ; sa livraison ferme la crise, réduit la tension de 18 et restaure 9 de légitimité (hypothèses de simulation). Une accalmie de quatre périodes suit. Les retards de services ne sont jamais effacés. Un cabinet peut démissionner devant la révolte ; le président continue. La révolution non réglée à l’échéance cause une rupture et bloque les décisions. La démission présidentielle volontaire est une décision directement dans cet événement, avec fin immédiate.

Les réformes arrivent par une permutation calculée de la graine et de l’état : une dès le début, puis une tous les trois ou quatre intervalles, deux visibles au maximum. Elles restent disponibles jusqu’à arbitrage, sans pénalité temporelle inventée. Le catalogue facultatif conserve l’accès aux autres textes. Les votes rejetés engagent zéro moyen proposé. Tous les tirages sont reproductibles hors ligne ; ce n’est pas un tirage indépendant à chaque rechargement.

## Preuves reproductibles

Avant implémentation, `presidency-escalation.test.ts` échouait car `presidencyEvents` n’existait pas. Après implémentation, les quatre parcours pré-écrits passent, ainsi que les quatre parcours d’incidents antérieurs. La vérification des types passe.

Depuis `site/`, `node --experimental-strip-types scripts/mandats-escalation-audit.ts` vérifie 16 parcours légaux : cinq graines (0, 1, 2, 17, 99), inaction jusqu’à rupture, accords jusqu’au terme, démission pendant la révolution, puis médiation temporaire et rechute. Chacun vérifie export/reconstruction exacte et arrêt des commandes après fin. Les commandes permettant le replay et les étapes horodatées sont conservées dans [mandats-escalade-parcours.json](mandats-escalade-parcours.json). Une stratégie qui finance les réponses durables aux incidents a également atteint les trente périodes sur 0, 1 et 2, avec huit incidents résolus et 2,38 à 2,77 Md€ restants.

Le modèle borné existant reçoit une stratégie `civil-recovery` et le rattrapage tardif répond aussi aux crises civiles annoncées. La réserve du journal vérifie désormais que chaque période conservée peut se terminer jusqu’à la vraie fin du mandat, y compris la défaite anticipée : l’inaction n’a plus une victoire garantie à trente périodes.

Limites : les coefficients civils sont des choix de difficulté, pas des statistiques observées. La progression révolutionnaire est une abstraction du jeu. Les parcours bornés ne démontrent ni difficulté parfaite ni absence de toutes les séquences problématiques ; les fenêtres, coûts et équipes sont visibles pour permettre un arbitrage concret.

Les choix civils varient aussi dans leurs moyens : médiation locale et accord horaires/effectifs au stade grève ; couloirs de livraison et réouverture des dépôts au blocage ; conciliation territoriale et pacte de services à la révolte ; conciliation nationale très courte et accord sous contrôle indépendant pendant la révolution. Les investissements durables progressent de 0,4 à 1,6 Md€, les coûts annuels de 0,3 à 0,9 Md€, les équipes de une à trois. Les secours temporaires durent respectivement quatre, quatre, six et deux mois. Aucun de ces intitulés ne promet une réforme constitutionnelle sans procédure.

Le dernier audit général sur les sources différenciées a parcouru **69 trajectoires, 673 branches et 137 301 invariants, sans anomalie**, avec les mêmes empreintes de sources au début et à la fin. Les six anciennes trajectoires v15 (118 périodes) conservent leurs valeurs numériques. Rapport avec empreintes : [mandats-escalade-modele.json](mandats-escalade-modele.json). Les sorties détaillées restent sous `site/presidency-artifacts/escalation-cabinet-final/` et le journal de cette exécution sous `/workspace/scratch/dfd933967793/escalation-cabinet-final.log`.

Dernière correction causale : la démission civile du cabinet conserve sa propre période dans l’état canonique. L’événement de nomination ne peut donc plus annoncer une motion de censure adoptée quand aucun scrutin n’a eu lieu. Le marqueur est retiré lorsque la crise du cabinet est quittée. Le test a d’abord reproduit le faux récit de censure puis vérifié la démission réelle et le replay exact. Huit tests de trajectoire passent désormais.
