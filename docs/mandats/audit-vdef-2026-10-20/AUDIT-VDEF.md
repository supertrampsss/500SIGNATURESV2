# MANDATS — audit v17 et cible vDef
20 octobre 2026 · Game Designer, Narrative Designer, Technical Artist, revue UX et ImageGen.

## Verdict
**La v17 a une base de jeu cohérente, mais ne mérite pas encore l’étiquette « version définitive ».** Il faut achever une seule boucle lisible : comprendre le pays → décider un compromis → voir sa préparation → constater sa livraison → comprendre son héritage → vouloir rejouer.

La carte approuvée, le temps autonome, le gouvernement opérationnel et les ressources partagées constituent la bonne direction. La recommandation est de **consolider cette version**, avec des corrections mesurables de lisibilité, de rythme, de conséquences et de bilan. Une nouvelle refonte graphique complète ferait perdre le bénéfice des dernières décisions.

**Limite :** cet audit combine code, replays déterministes et observation d’agent ; il ne contient aucun test de joueurs externes et ne certifie ni plaisir, ni rétention, ni recette complète sur appareils physiques.

## 1. Référence exacte : l’ancienne version est exclue
- Code : `origin/main 791a26a4d2c692252f84cc443bf5c277cb3ac8a2`, après la PR #209 (`0b4a4096`, fusionnée le 20 octobre).
- Production consultée : https://500signatures.fr/mandats/.
- Bundle `mandats-D3iOPgbZ.js` : **même SHA-256 en production et dans notre build local**. Preuve : [reference-version.json](reference-version.json).
- Version nouvelle partie : **v17**, trente périodes de deux mois, trente secondes à ×1 par période, environ quinze minutes actives pour cinq ans. Les ordres présidentiels n’avancent pas ce compteur ; les initiatives ministérielles sont déclenchées lors du passage des périodes et ne constituent pas un quota de décisions du joueur.
- Les premières lectures de la branche locale `codex/dossiers-maquette` étaient obsolètes. Leurs chiffres, captures et critiques v8 sont exclus.
- Contrat applicable au code courant : [AGENTS.md](../../../AGENTS.md) et [stratégie v17](../../mandats-strategy-v17.md). La vDef ne rétablit pas la file de 45 décisions. Préserver les règles versionnées demandées par le contrat actuel.

## 2. Ce qui fonctionne
1. Les dépenses, les équipes disponibles, le soutien politique et les délais ont de vrais effets.
2. Financer une intervention ne la livre pas instantanément ; le gouvernement partage la même file et la même réserve.
3. Deux parcours conservés aboutissent à des réussites avec des compromis distincts. La seconde voie est hybride ; nous ne la présentons pas comme organisation pure.
4. L’inaction ne gagne dans aucun des sept départs recalculés : six échecs et un résultat mitigé.
5. Une défaillance majeure n’est plus compensée artificiellement par un score financier.
6. La carte possède déjà une identité forte ; le jeu dispose de pause, vitesses, export et reconstruction versionnée. Leur présence ne remplace pas une recette complète.

## 3. Constats prioritaires
P1 : condition pour présenter la vDef. P2 : amélioration ou équilibrage à éprouver. Aucun incident de perte de partie ou panne générale n’est établi par cet audit.

| ID / priorité | Constat prouvé | Recommandation et résultat attendu |
| --- | --- | --- |
| A01 · P1 | L’accueil promet encore « 30 décisions maximum ». Les deux journaux de référence comptent chacun 30 périodes **et 16 ordres**, soit 46 entrées. `render.ts:98–103`, `main.ts:617`. | Expliquer immédiatement le temps, le gouvernement et les ordres. Reprise : année/période et nombre d’ordres séparés. Aucun quota de 30 décisions dans une nouvelle partie. |
| A02 · P1 | Un secteur en chantier ou en amélioration est choisi avant le mode critique pour le repère cartographique. `presidency-view.ts:343`. | Trois couches indépendantes : **gravité**, **tendance**, **chantier**. Une pression 90 reste visiblement dangereuse même avec un chantier et une amélioration. |
| A03 · P1 | Focus jaune `#fff2a3` quasi confondu avec les surfaces ivoire : contraste calculé d’environ 1:1. `presidency.css:42–44`. | Double contour ou marine sur ivoire, clair sur marine. Parcourir toute la partie au clavier, secteurs, choix, dialogues et replay compris. |
| A04 · P1 | Le parcours capacité s’achève P30 après un dernier ordre P16 et une dernière livraison P19 : **11 périodes, soit 5 min 30 à ×1**, après livraison. | Reconnaître le maintien réussi ; proposer une projection contrôlée jusqu’au prochain événement pertinent ou au bilan, sans sauter le calcul ni un arbitrage utile. Une catastrophe de remplissage est exclue. Cette commande serait une évolution à valider, pas une fonction déjà présente. |
| A05 · P2 | Le catalogue structurel progresse essentiellement de fondation vers réseau ; le renouvellement des choix en fin de partie reste à éprouver. `presidency-strategy-engine.ts:110–141`. | D’abord éprouver le rythme avec les options existantes. Si nécessaire, introduire une allocation limitée après livraison, avec bénéficiaire, sacrifice et délai réels. Aucun achat obligé dans les six secteurs. |
| A06 · P1 | L’alerte de rupture nationale demande de rétablir des services mais propose uniquement les choix politiques. `presidency-strategy-engine.ts:143–152,186`. | Nommer les secteurs critiques et ouvrir directement leurs commandes existantes. Distinguer consolidation des appuis et rétablissement des services. |
| A07 · P2 | Les cartes principales remplacent les intitulés concrets par « Renforcer les capacités » / « Réorganiser les services ». Le détail contient l’enjeu précis. `presidency-view.ts:263–278`. | Titres sectoriels courts, une phrase concrète, puis engagement, charge annuelle, équipes, délai et effet. Toute la carte reste activable en un geste, sans nouvelle confirmation. |
| A08 · P2 | Les livraisons emploient un reçu générique ; le bilan énumère surtout états et transformations. `presidency-strategy-engine.ts:250,394`, `presidency-view.ts:281–290,316`. | Reçu daté propre à la mesure, puis deux ou trois chaînes ordre → livraison → état du service. Attribuer uniquement ce que le journal et les deltas établissent. Replay directement depuis cet arbitrage. |
| A09 · P2 | Le cap indique « limites actuelles · à tenir 5 ans » et disparaît lorsque les commandes mobiles sont ouvertes. `presidency-view.ts:249`, `presidency-strategy.css:217–220`. | « 3/4 objectifs actuellement atteints ». Garder une ligne d’accès aux objectifs pendant le choix ; préciser que le bilan est final, que le redressement reste possible. |
| A10 · P2 | L’actualité est tronquée sur une ligne et n’est pas ouvrable ; constat visible sur les captures mobiles. `presidency-view.ts:76`, `presidency-reference.css:54`. | Bulletin ouvrable, texte complet et daté, pause pendant lecture détaillée ; même information accessible au clavier et au lecteur d’écran. |
| A11 · P2 | Les anneaux de début de partie ne sont pas des boutons ; leurs étiquettes n’apparaissent qu’à certaines phases. Le bandeau inférieur reste le vrai accès. `presidency-view.ts:331–337`. | Six repères HTML actionnables, même calmes ; développer uniquement les états importants. Un repère doit annoncer et faire la même chose. |
| A12 · P2 | Dans les sept replays sans ordre, finances et gouvernement satisfont leurs objectifs malgré les services et retards insuffisants. Le déficit final se situe entre 131,22 et 133,59 Md€, contre 153 au départ. | Montrer la contribution du scénario hérité et celle des choix. Éprouver le seuil financier et les conséquences politiques avec un contre-factuel ; ne pas annoncer que l’inaction gagne. |
| A13 · P2 | Une loi redistributive adoptée modifie des groupes sociaux mais ne modifie pas durablement les appuis/légitimité/tension dans le cas reproduit. Plusieurs coupes reprennent des pénalités sociales uniformes. | Donner aux grandes lois des effets matériels, temporels et politiques propres, documentés comme hypothèses de simulation. Préserver les votes, limites et refus. |
| A14 · P2 | Le plafond ministériel est toujours supérieur au coût de l’unique opération normale sur la plage de compétences générée. | Le reléguer en détail tant qu’aucun choix légal ne le rend contraignant. Garder le coût réel et les moyens effectivement engagés au premier plan. |
| A15 · P2 | Le bilan réaffiche un montant en Md€/an comme un montant en « Md€ engagés ». `presidency-view.ts:316`. | Corriger l’unité : charge annuelle durable. Ne produire un coût cumulé qu’à partir des périodes réellement financées. |
| A16 · P2 | Les preuves hors graines de réglage ne démontrent pas deux routes gagnantes pour chaque départ ; une trajectoire reste mitigée après quatre refus budgétaires. | Publier réussites et échecs ; montrer les réponses légales après refus. Tester financement phasé ou demande ciblée avant tout changement de règle. Aucune victoire garantie par graine. |
| A17 · P2 / risque | Étiquettes à 8–12 px, géométrie fixe ; safe-area iPhone non prise en compte explicitement dans le bas v17. | Mesurer les libellés et regroupements ; nom et gravité conservés ; intégrer safe-area. Recette sur iPhone installé et agrandissement de texte. Le chevauchement physique n’est pas démontré ici. |
| A18 · P3 | Même carte WebP de 860 110 octets pour tous les appareils ; bundle Mandats de 941,20 ko et CSS de 351,41 ko avant gzip dans notre build. | Profiler avant optimisation ; dériver des tailles de la carte approuvée, puis étudier chargement des modules historiques. Aucun ralentissement utilisateur n’a été mesuré. |

Détails mécaniques, preuves et limites : [audit du Game Designer](mechanics-audit.md) et [résultats reproductibles](preuves-game-design.json).

## 4. Décision recommandée
| Option | Gain | Risque / arbitrage |
| --- | --- | --- |
| A · Retouches visuelles | Rapide, respecte les assets. | Ne traite pas rythme, causalité et progression : insuffisant pour une vDef. |
| **B · Consolider la v17** | **Achève le jeu déjà approuvé, avec une seule boucle compréhensible.** | Exige de recetter ensemble règles, états visuels, mobile et bilan. **Recommandé.** |
| C · Nouveau moteur ou nouvelle carte | Liberté maximale. | Repart de zéro sur les choix récents et ouvre de nouvelles incohérences : disproportionné à ce stade. |

La consolidation protège UX, DX et AX : mêmes événements et commandes, vues plus explicites, responsabilités existantes préservées, critères de recette lisibles. Les nouvelles règles proposées restent des options de conception ; cet audit ne les active pas.

## 5. Contrat de la cible vDef
### Comprendre en une minute
Texte d’entrée proposé :

> Cinq ans pour transformer le pays.
> Le temps avance ; votre gouvernement assure le quotidien avec les mêmes moyens que vos projets.
> Choisissez les transformations, suivez leur livraison et gardez les moyens de gouverner.

Repères : « 30 périodes de deux mois · environ 15 minutes actives à ×1, hors pauses et lectures ». Éviter « 30 décisions ». Une suggestion de premier secteur découle de l’état réel du scénario ; aucun tutoriel de cinq fenêtres obligatoire.

### Décider sans déchiffrer
La carte reste le plateau principal. Conserver Réformes, Cabinet, six secteurs, pause, vitesse et ressources. Pour chaque décision :
1. problème concret et état actuel ;
2. mesure sectorielle nommée ;
3. engagement initial, charge récurrente, équipes et délai minimal séparés ;
4. effet attendu et sacrifice compréhensibles ;
5. un geste engage ; reçu explicite « financé / en préparation », puis effet seulement à livraison.

Sur mobile, un panneau peut occuper la zone centrale pour lire et décider. Ne pas rétablir la navigation rejetée, ni exiger une minicarte décorative si elle repousse les commandes. Cap compact, sortie Pays, six secteurs et pause restent accessibles.

### Sentir le pays évoluer
- Gravité : mot et contour/halo ; couleur secondaire.
- Tendance : flèche et variation réelle.
- Travail : pictogramme et progression indépendants de la gravité.
- Livraison : reçu court, daté, propre à la mesure.
- Répit : état stabilisé, pas catastrophe ajoutée après réussite.
- Pause, onglet masqué et réduction des mouvements : même information sans ambiance animée ; le visuel ne commande jamais le moteur.

### Terminer avec une histoire et un choix
Verdict réel, quatre objectifs, comparaisons héritage/fin, deux ou trois décisions marquantes, charges laissées et dommages éventuels. Rejouer un ordre reste distinct d’exporter ou recommencer. Un bilan financier favorable ne doit jamais blanchir l’effondrement des services.

## 6. Maquettes ImageGen
**Ces images sont des propositions de direction, pas des captures de changements intégrés.** La carte sert de référence visuelle ; les textes, boutons et valeurs devront rester des vrais éléments HTML/SVG dans le produit.

- [01 · Plateau ordinateur](maquettes/01-plateau-desktop.png) : carte dominante, danger et secteur nommé, comparaison des deux transformations.
- [02 · Arbitrage mobile, version affinée](maquettes/02-arbitrage-mobile-v2.png) : deux cartes comparables, vignettes retirées, objectif qualifié et commande Reprendre explicite.
- [03 · Bilan causal](maquettes/03-bilan-causal.png) : objectifs, compromis et accès direct au replay. Les valeurs proviennent du parcours hybride graine 47, pas d’une partie inventée.
- [Galerie visuelle](index.html) · [prompts initiaux et références](imagegen-prompts.json) · [affinage mobile](imagegen-mobile-refinement.json). La première proposition mobile reste une variante de travail ; la galerie présente la v2.

**Points à corriger avant intégration des images :**
- Les maquettes utilisent parfois le bordeaux pour « à surveiller » : réserver une distinction ambre/critique claire dans les vrais états.
- Les vignettes d’hôpital sont facultatives sur ordinateur ; la proposition mobile v2 les retire pour donner la place aux prix, conséquences et cibles tactiles.
- Les 3/10 appuis, la charge annuelle et le sens des effets doivent tous rester visibles ; la maquette desktop n’expose pas tous ces détails.
- Le cap 4/4 doit être qualifié « actuellement atteints » ; la pause doit annoncer l’action possible « Reprendre » avec un état distinct.
- Le panneau mobile dessiné n’est pas une preuve de conformité à 390×844 ou 320×568. Une vraie intégration et une recette restent nécessaires.
- Le bilan dessiné ne ventile pas les effets de chaque ordre isolément : il décrit des étapes réellement enregistrées. Ne pas inventer une causalité contrefactuelle.

## 7. Ordre de livraison
| Lot | Contenu | Porte de sortie |
| --- | --- | --- |
| 1 · Cohérence | A01, A02, A03, A06, A15 : promesse, état critique, focus, crise, unités. | Pas de contradiction entre entrée, commande, état et bilan ; navigation clavier complète. |
| 2 · Boucle lisible | A07–A11, A17 : noms concrets, retours, objectifs, actualités, repères et mobile. | Un nouvel arrivant peut expliquer ce qu’il engage, quand cela livrera et comment le constater. |
| 3 · Profondeur et rythme | A04, A05, A12–A14, A16 : maintien, progression, politique, finances. | Parcours de début et fin réellement différents ; aucune attente imposée après résolution ; routes et refus publiés sans filtrer les échecs. |
| 4 · Gel vDef | Recette multi-appareils, sauvegardes, partage, offline, accessibilité, parties humaines. | Tous les critères ci-dessous validés sur le même commit, puis gel du périmètre. |

Ne pas commencer par remplacer l’illustration ou ajouter de nouvelles jauges. Évaluer les changements de règles séparément des corrections de présentation afin de garder une cause identifiable à chaque résultat.

## 8. Définition de « terminé »
- [ ] Une seule promesse v17 : temps, ordres, gouvernement et victoire décrits correctement.
- [ ] Les six secteurs sont consultables en tout état ; aucun signal de carte ne paraît actionnable sans l’être.
- [ ] Gravité, tendance, financement, attente et livraison restent distincts.
- [ ] Coûts, unités, temporalités et conditions sont lisibles avant engagement ; refus et erreurs expliqués.
- [ ] Aucun double engagement, aucune équipe dupliquée, pas d’effet matériel au seul financement.
- [ ] Clavier, focus, texte agrandi, absence de hover requis et reduced-motion inspectés dans les vrais écrans.
- [ ] Desktop, 390×844, 320×568, paysage et WebKit vérifiés ; iPhone installé pour safe-area.
- [ ] Pause, onglet masqué, reprise, quota de stockage, export/import, liens versionnés, replay et offline recettés.
- [ ] Ouverture jouée sans assistance, au moins deux approches complètes comparées, holdouts publiés.
- [ ] Bilan relié aux ordres et livraisons ; charge annuelle distincte du montant total ; zéro victoire par effondrement compensé.
- [ ] Des joueurs externes comprennent la boucle et les compromis ; noter aussi ennui, hésitations et abandons.
- [ ] Aucun ajout de publicité, suivi, publication sociale ou modification des données observées par effet de bord.

**Ces cases sont les critères futurs de la vDef ; elles ne sont pas réputées validées par la livraison du présent audit.**

## 9. Travail effectué et preuves
- Revue indépendante du code par trois agents spécialisés ; ancienne branche explicitement exclue.
- Inspection en production : plateau desktop 1440×1000, plateau mobile 390×844, catalogue de transformations.
- Inspection de la copie actuelle : mobile 390×844 mesuré, engagement santé, attente, livraison, initiatives ministérielles et Cabinet ; partie arrêtée en pause à la période 15 affichée, après 14 périodes écoulées. [Export réel](partie-agent-mobile-seed47.json).
- Graine 47, ordre `s17-health-organisation`, puis quatorze `live-tick` ; export effectué par l’interface. Cette partie partielle ne remplace pas un mandat complet joué.
- Sur ce parcours, crédits 18 → 16,6 au financement, appuis 70 → 60, aucun temps consommé par l’ordre ; P15, la transformation est en service et le gouvernement a livré ses propres organisations. Captures 04 à 07.
- Deux parcours complets **reconstruits** et sept départs sans ordre **recalculés** ; ce sont des replays moteur, distincts des observations navigateur.
- Build client et types exécutés sur la copie actuelle. Le build complet éditorial, toutes les suites E2E, les appareils physiques et l’offline n’ont pas été rejoués pour cet audit documentaire.
- Audit borné du moteur relancé : consulter [verification.json](verification.json) pour son résultat exact, le nombre de contrôles et ses limites.
- [Captures réelles](captures/) · [audit mécanique](mechanics-audit.md) · [preuves chiffrées](preuves-game-design.json) · [script de reproduction](mechanics-replay.mjs).

Outils de conception : skills brainstorming, design:design-critique, dispatching-parallel-agents, imagegen et verification-before-completion ; agents Game Designer, Narrative Designer et Technical Artist. ImageGen intégré, sans remplacement automatique d’un asset produit.

Aucun moteur, règle de partie, CSS produit ou donnée observée n’a été modifié. Le livrable est l’audit, sa cible de conception et trois maquettes reviewables.
