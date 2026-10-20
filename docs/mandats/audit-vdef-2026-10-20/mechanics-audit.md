# Audit mécanique MANDATS v17 — 20 octobre 2026

Référence exclusive : `origin/main` `791a26a4d2c692252f84cc443bf5c277cb3ac8a2`, dont PR #209 `0b4a4096`. L'ancienne copie v8 a été écartée. Aucun changement au moteur ou à l'interface.

Preuve reproductible : `node --experimental-strip-types docs/mandats/audit-vdef-2026-10-20/mechanics-replay.mjs`. Résultats complets et empreintes sources : `preuves-game-design.json`. Ce sont des replays légaux du moteur, pas des parties navigateur ni des essais humains. Les deux journaux de référence sont ceux déjà conservés dans `docs/mandats-strategy-v17/`.

## Verdict

La v17 est une simulation de flux et de chantiers cohérente. Elle possède de vrais délais, une file partagée, des crédits finis et des résultats qui interdisent de gagner par le seul calendrier. Sa faiblesse de jeu reste la progression des décisions : un bon départ résout une grande partie des choix, tandis que la politique et le budget annuel différencient peu l'inaction et la bonne gestion. Rien ici ne prouve un taux de rétention ou un ressenti humain.

Les priorités ci-dessous distinguent défaut observé, déséquilibre possible et limite de preuve. P1 = à traiter avant de promettre une version définitive ; P2 = à éprouver ou clarifier.

## Huit constats

### 1. P1 — Une longue fin de mandat sans nouvelle décision utile (observé)

Preuve : replay canonique capacité graine 47 : dernier ordre P16, dernière livraison P19, victoire P30. Quatorze périodes sans ordre représentent 7 minutes à ×1 ; onze après livraison, 5 min 30. La voie hybride termine ses commandes P24 et livre P26. Le moteur n'ajoute volontairement pas de catastrophe après réussite. Références : `docs/mandats-strategy-v17.md:185`, `site/src/mandats/presidency-runtime.ts:12`, journaux et résultats de ce dossier.

Conséquence joueur : on peut avoir résolu le problème stratégique alors qu'une part importante de la durée nominale reste à attendre. La vitesse ×4 réduit le coût temporel, sans créer de décision.

Recommandation vDef : permettre de conclure volontairement par une projection explicite quand aucune livraison, échéance ou nouvelle décision utile n'est attendue avant la fin ; montrer les mêmes comptes et risques résiduels. Conserver l'observation détaillée en option. Ne pas ajouter de catastrophe pour meubler.

Acceptation : la fin accélérée reproduit strictement les 30 ticks sauvegardés ; les livraisons et dégradations restent visibles ; sur ce journal, aucune attente passive de 5 min 30 n'est nécessaire pour obtenir le bilan.

### 2. P2 — La progression n'offre qu'un véritable déblocage structurel par secteur (hypothèse de conception à éprouver)

Preuve : `presidency-strategy-engine.ts:110` à `128` propose toujours les cinq mêmes familles. Capacité et organisation sont disponibles dès l'ouverture ; réseau exige une transformation livrée. Accord et rattrapage exigent surtout une dégradation. Les 30 lois sont toutes consultables dès le départ (`:134` à `141`). La phase globale est calculée à `:267` à `269`, mais ne débloque aucune famille d'action. Les gains des premiers chantiers ont été déplacés vers leur réseau : `presidency-strategy-content.ts:37` à `45`.

Conséquence joueur : la progression favorise la répétition « fondation puis réseau » ; la dernière partie transforme davantage les valeurs à surveiller que la nature du choix. Les secteurs ont des coûts et interactions distincts : il ne faut pas les qualifier d'identiques.

Recommandation vDef : donner aux réseaux livrés une orientation réversible de leurs capacités entre besoins réellement présents, avec un coût et un délai explicites. La fin porterait alors sur une allocation différente, pas une nouvelle catastrophe ni six achats obligatoires.

Acceptation : deux états comparables de début et de fin proposent au moins une décision utile de nature différente ; sa modification affecte réellement le secteur bénéficiaire et celui qui cède la capacité, sans créer d'équipes.

### 3. P1 — L'objectif financier est atteint sans décision dans les sept départs examinés (déséquilibre observé, pas victoire par inaction)

Preuve : replays sans aucun ordre, graines 0, 1, 2, 19, 47, 143, 9999 : objectif finances atteint 7/7, déficit final de 131,22 à 133,59 Md€ contre 153 hérités. Six résultats sont des échecs, le départ 0 est mitigé : les autres objectifs empêchent bien une victoire automatique. La croissance nominale des recettes dépasse l'indexation des charges (`presidency-strategy-engine.ts:66` à `73`), et l'objectif compare au déficit de départ (`:384`).

Conséquence joueur : le repère « financer dans la durée » peut récompenser surtout la trajectoire macroéconomique héritée ; une bonne part des réformes fiscales est évitable pour le gagner. La réserve et les votes restent, eux, contraignants.

Recommandation vDef : comparer aussi les dépenses et engagements au scénario hérité sans intervention, et afficher le coût annuel complet des décisions livrées/engagées. Déterminer ensuite en playtest s'il faut recalibrer le seuil de victoire.

Acceptation : le bilan explique séparément amélioration héritée et contribution des choix ; une politique de surengagement peut perdre ce repère même avec la croissance nominale du scénario ; aucune clôture passée n'est réécrite.

### 4. P2 — Les lois redistributives ont peu de prise sur le pouvoir politique (observé)

Preuve légale : graine 3, P0, loi `r05b` adoptée ; ménages aisés 65→62, mais appuis 70,2566→70,2566, légitimité 58→58 et tension 18→18. La v17 enregistre directement votes/refus à `presidency-strategy-engine.ts:363` à `373` ; la variation des appuis vient des transformations et des perturbations de service (`:222`, `:246`, `:327`), pas d'une relation politique durable au contenu de la loi. L'inaction conserve aussi l'objectif gouvernemental dans 7/7 replays malgré l'échec des services.

Conséquence joueur : gouverner ressemble davantage à dépenser des points d'appui pour les chantiers qu'à maintenir une coalition autour de choix politiques. Un vote existe bien ; son absence de suite persistante réduit la portée de l'arbitrage.

Recommandation vDef : définir, comme hypothèse de jeu explicite, quelles décisions effectivement adoptées et livrées modifient les engagements des groupes ; fournir une négociation ciblée plutôt qu'un reçu politique uniforme. Ne pas inventer de comportement électoral réel.

Acceptation : deux lois aux bénéficiaires et contributeurs distincts produisent des suites politiques distinctes et expliquées ; un texte rejeté ne modifie jamais ses effets matériels ; une même négociation ne se répète pas gratuitement.

### 5. P2 — Le plafond annuel ministériel affiché est une contrainte impossible à atteindre (preuve analytique)

Preuve : compétences générées 58–88, plafond `0,3 + compétence × 0,002`, coût de l'unique convention `0,12 + (100 − compétence) × 0,002`. Donc coût 0,144–0,204 Md€/an, toujours inférieur au plafond 0,416–0,476. `presidency-strategy-engine.ts:230` à `233`, `:345` à `347`. Ce plafond n'est pas modifiable dans les choix v17. Le Cabinet l'affiche comme délégation annuelle (`presidency-view.ts:296`). Les coûts effectifs restent réellement prélevés dans la réserve partagée.

Conséquence joueur : un nombre visible suggère un levier de délégation qui ne contraint aucun départ normal. La compétence a, elle, un vrai effet sur capacité et coût.

Recommandation vDef : retirer ce plafond de l'information prioritaire ou créer des consignes bornées qui le rendent effectivement utile ; conserver coût engagé et capacité livrée.

Acceptation : toute limite présentée au joueur possède au moins un cas légal atteignable et une décision qui dépend d'elle ; sinon elle reste une information secondaire explicitée comme plafond non atteint.

### 6. P2 — Les grandes lois réemploient une pénalité sociale presque uniforme (constat de conception)

Preuve actuelle : hors retraite et exception résidence, les coupes des racines reçoivent toutes services −2, cohésion −2, confiance −1 et groupe concerné −6 (`national-branches.ts:45` à `49`), alors que les choix vont de « supprimer un poste public sur cinq en deux ans » (`national-reforms.ts:24`) à la réduction de programmes de recherche. Les économies et effets physiques explicitement mappés diffèrent bien : ils ne doivent pas être décrits comme uniformes. La hausse de TVA de quatre points ne change les groupes que de −2/−3/−1 (`national-reforms.ts:39` à `43`), et les lois fiscales ne passent pas par la file physique.

Conséquence joueur : des décisions politiquement et socialement très différentes réemploient le même signal abstrait ; le jeu enseigne surtout une différence de rendement et de groupe ciblé. Il est difficile d'anticiper une conséquence propre à la politique choisie.

Recommandation vDef : écrire pour chaque grande réforme une incidence matérielle identifiable, des groupes touchés et une temporalité adaptés au scénario ; garder les chiffres comme hypothèses de jeu, sans prétendre à un chiffrage réel. Utiliser les interactions sectorielles existantes plutôt qu'ajouter des jauges.

Acceptation : deux réformes radicales de nature différente produisent des suites qualitativement et quantitativement distinctes, documentées et retraçables ; chaque montant social a une raison de réglage ; aucun vote refusé ne déclenche ces effets.
### 7. P2 — La capacité de rebond après refus budgétaire reste insuffisamment démontrée hors graines de réglage (limite documentée)

Preuve conservée : le holdout 19/143/9999 échoue au critère de deux voies gagnantes sur deux départs. Une adaptation par réaffectation fait gagner capacité 19 et organisation 143 ; capacité 143 reste mitigée après quatre refus. `docs/mandats-strategy-v17.md:205` à `214`, fichiers `audit-holdout-initial.json` et `holdout-adaptive-redeployment.json`. Une demande fixe de 10 Md€ n'est possible qu'une fois par année ; réaffectation 1,2 Md€ (`presidency-strategy-engine.ts:154` à `160`). Cela ne prouve aucune impossibilité de gagner autrement.

Conséquence joueur : un refus annuel peut surtout produire une attente, particulièrement quand l'autre compromis politique a déjà été consommé. La voie gagnante de secours n'est pas toujours lisible depuis les moyens affichés.

Recommandation vDef : éprouver une demande plus petite ciblée sur un projet ou un financement phasé, avec contrepartie réelle et passage parlementaire conservé ; signaler les réponses encore réalisables après le refus.

Acceptation : rejouer les trois holdouts avec stratégie fixée avant le test et publier succès comme échecs ; pour chaque refus, le joueur peut comprendre au moins une réponse encore légale ou le délai incompressible. Ne pas garantir artificiellement la victoire sur toutes les graines.

### 8. P2 — La validation du plaisir et de la compréhension reste à faire (limite de preuve)

Preuve : les documents distinguent correctement parties d'agent et essais humains (`docs/mandats-strategy-v17.md:71` à `75`, `:155` à `160`). Les deux observations complètes viennent de la même graine 47, et la voie dite organisation devient hybride. L'audit technique couvre 36 trajectoires et 138 539 invariants, sans mesurer l'intérêt d'attendre ni la compréhension autonome (`docs/mandats-strategy-v17/audit-model.json`).

Conséquence : on peut qualifier la cohérence du modèle, pas affirmer « amusant », « addictif » ou « prêt vDef » à partir de cette preuve.

Recommandation vDef : faire jouer l'ouverture puis un mandat sans assistance ; noter, séparément, observations et interprétations : premier ordre compris, différence financement/livraison, traitement d'un refus, compréhension du bilan, segments où l'on attend volontairement. Conserver tous les paramètres comme hypothèses tant que ces observations manquent.

Acceptation : recueillir des sessions humaines externes avec journaux et verbatims consentis ; publier les incompréhensions et changements de réglage. Aucun seuil de rétention ou d'engagement n'est inventé dans cet audit.

## Ce qui fonctionne et doit être conservé

- Les replays capacité/hybride aboutissent bien à deux résultats gagnants, avec dépenses, appuis, retards et délais distincts.
- L'inaction ne gagne dans aucun des sept départs relus.
- Un ordre ne consomme pas de temps ; une livraison réclame des périodes et les quatre unités d'exécution communes.
- Les dépenses engagées, taux annuels et coûts temporaires sont séparés ; les transformations physiques attendent leur livraison.
- Un refus parlementaire n'accorde ni crédits ni effets matériels ; les sauvegardes sont reconstruites à partir des entrées versionnées.
- Le bilan actuel ne compense plus un effondrement des services par un bon score financier. Les critiques historiques v8 ne s'appliquent pas à cette version.

## Non testé dans ce sous-audit

Aucun nouveau test navigateur, rendu visuel, réseau hors ligne, pause, stockage ou clavier n'a été exécuté ici. Les 138 539 invariants proviennent de la preuve canonique conservée, non d'un nouveau lancement du script intégral. Les deux routes et sept départs sans ordre ont été recalculés au commit indiqué ; les journaux de lois ponctuelles sont dans `preuves-game-design.json`. Aucun équilibre exhaustif de toutes les combinaisons n'est revendiqué.
