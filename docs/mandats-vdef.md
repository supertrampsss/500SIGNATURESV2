# MANDATS vDef — livraison du 20 octobre 2026

Développement terminé, revues indépendantes par tâche et revue globale approuvées. Cette page rassemble le périmètre et les preuves ; les rapports et le statut de la PR de livraison attestent la recette intégrale et la fusion.

## Périmètre

Consolidation de la présidence v17 : trente périodes de deux mois, trente secondes par période à ×1, ordres indépendants du calendrier et gouvernement autonome. La carte approuvée, le moteur numérique, les journaux et les règles des parties antérieures sont conservés.

- Six secteurs nommés et actionnables ; gravité, tendance et chantier indépendants.
- Décisions concrètes, engagement, charge annuelle, équipes, délai et effets lisibles ; une carte valide en un geste.
- Objectifs accessibles pendant les arbitrages, bulletin complet en pause et commande directe « Avancer » jusqu'au prochain changement enregistré par le moteur.
- Projection enregistrée en une sauvegarde avant publication ; bilan avec vrais reçus et rejeu de l'ordre d'origine, archive et restauration sur échec.

Le défilement conserve la lecture sur mobile. En paysage bas, l'en-tête du panneau défile aussi pour laisser toute la place aux commandes. Les six cibles restent séparées et mesurent au moins 44 px ; calendrier et légende utilisent au moins 12 px.

## Couverture de l'audit A01–A18

| Réf. | Livraison ou décision documentée |
| --- | --- |
| A01 | Entrée et reprise distinguent périodes et ordres ; durée et autonomie explicites. |
| A02 | La gravité reste visible pendant travaux et amélioration. |
| A03 | Focus contrasté, restitution après lecture et projection, navigation clavier. |
| A04 | Projection contrôlée : ticks canoniques, arrêt au changement utile, maintien en pause. |
| A05 | Catalogue et règles conservés ; la projection réduit l'attente après les livraisons. Le renouvellement des stratégies reste à éprouver avec des joueurs. |
| A06 | Secteurs réellement critiques nommés et reliés à leurs commandes ; compromis politiques distincts. |
| A07 | Titres sectoriels authentiques et conditions lisibles avant engagement. |
| A08 | Reçus datés reliés aux programmes livrés et au véritable indice de l'ordre dans le journal. |
| A09 | « Objectifs actuellement atteints » accessibles avec le panneau ouvert. |
| A10 | Bulletin complet daté, détails lisibles et pause maintenue après fermeture. |
| A11 | Six boutons cartographiques disponibles dès le départ ; placement contrôlé, y compris en paysage. |
| A12 | Référence simulée sans ordres présidentiels, ministres autonomes conservés, même horizon et statut comptable. Comparaison indisponible si ces conditions divergent. |
| A13 | Votes et effets législatifs enregistrés présentés avec leur temporalité. Les conséquences politiques numériques restent celles de v17. |
| A14 | Moyens et coût ministériels réels privilégiés dans le Cabinet. |
| A15 | Engagements en Md€ et charges annuelles en Md€/an séparés. |
| A16 | Deux journaux reconstruits sur cinq graines ; réussites, bilans mitigés et refus conservés. Aucun succès garanti par graine. |
| A17 | Cibles tactiles, textes secondaires, défilement unique, safe-area et cinq formats de recette. L'iPhone installé reste à vérifier physiquement. |
| A18 | Illustration approuvée inchangée ; poids des bundles relevé pendant le build. Le profilage sur appareils réels reste à faire. |

Les reçus décrivent les effets directs enregistrés ; la variation entière d'un indicateur n'est pas attribuée à un seul ordre. Les comptes, hypothèses de simulation et données observées gardent leurs rôles respectifs.

## Preuves reproductibles

- `npm run check` : 1 142 tests réussis, types, build, pré-rendu et génération hors connexion. [Synthèse mécanique](mandats-vdef/model-summary.json) et [provenance des sources](mandats-vdef/model-provenance.json) : 36 trajectoires, 114 branches, 138 539 contrôles, aucune anomalie détectée ; 13 trajectoires historiques et 572 transitions inchangées.
- [Reconstruction des deux journaux](mandats-vdef/replay-routes.mjs) : `node --experimental-strip-types docs/mandats-vdef/replay-routes.mjs`. [Résultats](mandats-vdef/routes-summary.json) : six réussites, quatre bilans mitigés sur les graines 0, 1, 2, 47 et 73. Chaque ordre est vérifié légal ; les refus et votes sont conservés. Ce sont des reconstructions du moteur.
- Recette navigateur : `playwright.vdef.config.ts`, `playwright.strategy.config.ts`, `playwright.mobile-boucles.config.ts` et suite Mandats. La commande CI existante `playwright.strategy.config.ts` exécute les 48 cas historiques inchangés, puis les 115 cas vDef sur cinq projets dédiés ; ses artefacts contiennent les deux suites. La configuration vDef autonome utilise les mêmes cinq formats. Les rapports locaux sont dans `site/vdef-artifacts/`, `site/strategy-artifacts/`, `site/loops-artifacts/` et les artefacts de la PR. Captures, vidéos, traces et exports permettent de distinguer assertion automatisée et inspection visuelle.
- Formats : 1672×941, 390×844, 320×568, 844×390 et WebKit mobile. Quota, touche maintenue, double activation, pause, onglet masqué, export/import, rejeu et fonctionnement hors connexion font partie de la recette.

Les avertissements de taille Vite et d'exécution expérimentale TypeScript de Node 22 figurent dans les journaux. Le poids ne constitue pas une mesure de lenteur utilisateur.

## Captures réelles et traçabilité

- [Avant](mandats-vdef/captures/avant-desktop.png) et [après sur ordinateur](mandats-vdef/captures/apres-desktop.png), [arbitrage](mandats-vdef/captures/apres-arbitrage-desktop.png), [bilan](mandats-vdef/captures/apres-bilan.png).
- [Mobile 390 px](mandats-vdef/captures/apres-mobile.png), [compact 320 px](mandats-vdef/captures/apres-compact.png) et [paysage 844×390](mandats-vdef/captures/apres-paysage.png). Ces captures montrent le jeu implémenté ; les concepts ImageGen restent dans l’audit.
- [Empreintes du build et provenance des contrôles](mandats-vdef/build-evidence.json). Les captures ordinateur proviennent de la recette finale ; celles des trois formats mobiles de la recette runtime approuvée, avant le seul garde clavier de sept lignes, sans changement de présentation.
- Inspection manuelle du build final : reprise sauvegardée, coûts/délais Santé, temps ×1, bulletin daté, projection de deux périodes arrêtée sur nouvelle alerte et maintien en pause. Les premières minutes et trajectoires complètes sont aussi parcourues automatiquement ; aucune session de joueur externe n’est prétendue.

La tentative locale de suites intégrales simultanées a saturé la mémoire disponible (moins de 0,6 Go) : des délais ont été dépassés et les runs interrompus. Ils ne sont pas comptés comme réussites. Les configurations intégrales, dont les cinq formats vDef, sont exécutées par les contrôles CI de la PR, sur des jobs séparés. Le harnais vDef fige l’horloge avant navigation ; aucun délai ni assertion n’est assoupli pour compenser la charge.

Le jeton GitHub ne permet pas de modifier les workflows : le raccordement utilise leur configuration déjà exécutée. Aucun workflow ni droit n’est modifié ; les contrôles historiques sont conservés. Le correctif du harnais passe 10 cas sur cinq formats ; le raccordement CI passe 10 cas supplémentaires avec les noms de projets de la CI.

## Publication et limites

La publication est attestée séparément par le workflow `Deploy site` et la vérification du bundle servi sur `https://500signatures.fr/mandats/`. Les contrôles de la PR restent les portes de fusion.

Les tests avec des joueurs externes, l'iPhone installé et les performances sur appareils physiques restent à réaliser. La compréhension, le plaisir et la rétention ne sont pas mesurés par ces simulations et parcours automatisés.

Conception : [audit et trois maquettes ImageGen](mandats/audit-vdef-2026-10-20/AUDIT-VDEF.md), expertises Game Designer, Narrative Designer et Technical Artist ; intégration avec les workflows de planification, TDD, revue indépendante et vérification visuelle.
