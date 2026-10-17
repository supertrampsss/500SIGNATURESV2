# Mandats : décisions sur la carte et boucles suivies

17 octobre 2026. Mise en œuvre du diagnostic [mobile et boucles](mandats-audit-plan-mobile-boucles.md).

## Problème corrigé

Le téléphone cachait les noms des événements et une grande partie du pays derrière un panneau. Les trois onglets séparaient les décisions de leurs conséquences. Le bouton de nomination pouvait soumettre plusieurs fois un vote identique rejeté, tout en affichant un message laissant croire à une nomination. Deux réformes ignorées bloquaient l’arrivée des suivantes. Les effets animés étaient trop petits et souvent hors du cadrage.

## Comportement livré

- Carte pleine largeur, noms visibles, repères séparés et groupes ouvrables quand le téléphone ne peut pas tout afficher. Glisser le pays déplace le cadrage ; Vue France montre toute l’illustration. Ouvrir une crise recentre le lieu sur mobile.
- Réformes, institutions, budget et suivi apparaissent sur le pays. Les trois anciens onglets ont disparu. Matignon donne accès aux ministres et aux comptes ; les priorités sont dans les fiches sectorielles.
- Pressions qualifiées en clair. Une intervention en préparation ne porte plus une coche verte de succès. Les crédits engagés sont distingués des conséquences budgétaires d’une réforme.
- Chaque décision retourne son résultat réel. Un refus indique le vote ; une intervention indique qu’elle attend encore sa livraison. Une nomination n’est proposée qu’après accord adopté et est enregistrée une seule fois.
- Réformes proposées selon le contexte, reportables une fois, retirables ou expirantes. Après rejet, une autre orientation peut revenir après consultations. Les suivis regroupent les programmes du même secteur, avec progression réelle.
- Crises tirées selon la graine, la saison, les fragilités et la prévention. La pression civile peut reculer lorsque ses causes sont traitées. Les réponses supplémentaires du port, du numérique hospitalier et de l’électricité offrent d’autres arbitrages de coût, délai et équipes.
- Budget : demander une enveloppe, réaffecter une partie de l’investissement général une fois par année ou suspendre les nouveaux engagements. Aucun revenu n’est créé par une autorisation.
- Fin explicite : bilan causal, temps arrêté, aucune commande de priorité encore active après la fin.

## Animations

Les scènes distinguent incident actif, préparation, travail, retard, secours temporaire et reprise. Foule, files, barrières, navire, circulation et progression ont une taille perceptible sur téléphone. Les bateaux ne repartent qu’après résolution effective. Les secours ne font pas disparaître artificiellement la cause. Les effets restent suspendus avec le temps ; le mode mouvement réduit conserve les informations et les changements d’état.

L’illustration de référence reste le fond. Les effets sont des couches vectorielles pilotées par les données ; les bâtiments peints ne sont pas reconstruits en 3D. Les lieux illustrent des secteurs nationaux, pas des statistiques locales inventées.

## Vérification

Les preuves sont conservées dans [mandats-mobile-boucles](mandats-mobile-boucles/). Le rapport final des parcours navigateur accompagne les captures, les vidéos Chromium/WebKit et leurs commandes sauvegardées. WebKit est testé avec un viewport mobile, sans prétendre à une capture sur un iPhone physique.

Le modèle a été exploré sur 69 trajectoires et 652 branches, avec 140 420 invariants vérifiés sans problème détecté. Les six parcours témoins v15 conservent leurs 118 périodes. Les 16 parcours d’escalade passent sans affaiblir leurs assertions. L’audit supplémentaire couvre 96 parcours et conserve les graines, stratégies, votes, réformes et empreintes sources dans [mandats-loops-audit.json](mandats-loops-audit.json).

Ces parcours ne prouvent ni une difficulté parfaite ni une exploration exhaustive. Sur les 24 graines examinées, l’inaction perd et les trois stratégies actives atteignent le terme. Les secours restent une stratégie très efficace. Le catalogue conserve douze incidents locaux, chacun utilisé au maximum une fois par mandat ; l’extension porte sur les réponses, les conditions et les suites, et ne prétend pas à des événements illimités.

## Reproduire

Depuis `site/` : `npm run check`, puis `npx playwright test --config playwright.mobile-boucles.config.ts`. Le paramètre `MANDATS_LOOPS_PHASE` sépare les rapports de chaque vérification. Les exécutables Chromium et WebKit peuvent être fournis par les variables déjà utilisées dans les suites existantes.

L’audit de boucles se lance par `node --experimental-strip-types scripts/mandats-loops-audit.ts`. Les audits modèle et escalade conservent leurs commandes documentées dans les contrats précédents.
