# MANDATS — corrections issues de l’essai joueur

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Une implémentation cohérente, revue indépendante, recette manuelle puis livraison.

**Goal:** corriger les obstacles observés dans l’essai graine 612 et vérifier la boucle complète jusqu’à la version publiée.

**Architecture:** garder le moteur v17 et ses valeurs. Les modèles de lecture fournissent les états cohérents ; le rendu expose le risque et l’objectif à traiter. Le placement résout les collisions avec les dimensions réelles des contrôles.

**Tech Stack:** TypeScript, rendu HTML existant, CSS, tests node:test et Playwright existants. Aucune dépendance nouvelle.

## Global Constraints

- Préserver les parties sauvegardées, liens, reconstruction des versions précédentes, hors connexion, pause et mouvement réduit.
- Ne changer ni les valeurs, ni les tirages, ni les règles de victoire du moteur v17 ; l’essai ne justifie pas un rééquilibrage numérique.
- Conserver la carte illustrée approuvée, les six secteurs accessibles, le temps autonome et les ministres dans les ressources communes.
- Français simple, commandes essentielles sans survol, information politique et financière issue du modèle ; aucune probabilité inventée.
- Aucun SDK, publicité, suivi ou partage social ajouté.
- Ne pas modifier la branche éditoriale de l’utilisateur. Travail dans le worktree existant, branche `codex/mandats-player-fixes-20261020` issue de `ba4f28c2`.
- L’utilisateur a explicitement autorisé correction, test, push, livraison et nouvelles itérations sans demande de confirmation.

## Diagnostic établi

L’essai original et son export sont dans `docs/mandats/essai-joueur-2026-10-20/`. Le modèle `strategySectorReading` ne tient pas compte du ministère `limited` lorsque la phase reste normale ; `strategyFan` affiche directement `state.warning`, produit par une autre condition. Le bandeau ne rend que le nombre d’objectifs atteints. `layoutPresidencyPins` place les six secteurs indépendamment, sans séparation des rectangles. Le vote détaillé est rendu dans Cabinet/Institutions, pas dans le contexte immédiat du vote législatif. Les contreparties du catalogue répètent des chaînes identiques provenant de description, bénéfice et sacrifice.

## Task 1 — cohérence des risques et de la décision, puis placement

**Ownership:** `site/src/mandats/presidency-read-model.ts`, `presidency-view.ts`, `presidency-board-layout.ts`, leurs tests, CSS présidence nécessaires et tests navigateur liés. Un petit module de lecture dédié est autorisé si cela garde les règles hors du rendu. Aucun changement de nombres ni de tirages dans le moteur.

**Interfaces:** conserver les exports actuels. Étendre le modèle de lecture pour rendre une raison d’alerte, un cap à maintenir/objectif à rétablir et des informations politiques factuelles. Utiliser les entrées du journal d’origine pour les reproductions, jamais un état artificiel pour la recette finale.

- [ ] Écrire les régressions avant correction : graine 612, préfixe original avant l’ordre logement P18, avant simplification P19, début P25, vote `r21a` à P6 et autorisations P21/P25. Le test doit échouer pour le défaut visé.
- [ ] Pour le ministère limité avec phase normale, la vue principale et le panneau annoncent la limite opérationnelle et ne disent plus que le service dispose d’une marge. Garder séparés pression, tendance, préparation et état d’organisation. Un chantier n’efface pas le risque.
- [ ] Afficher la nature et la valeur du ou des objectifs manqués directement dans le bandeau, avec accès au détail et aux secteurs responsables. Si tout est atteint avant la fin : annoncer le maintien jusqu’au bilan et les besoins futurs, sans suggérer une victoire acquise. Éviter une nouvelle longue liste permanente sur téléphone.
- [ ] Avant un vote, expliquer les soutiens effectivement connus et les facteurs réellement utilisés ; distinguer appuis d’action, sièges de coalition et voix. Après le vote, afficher immédiatement le résultat et l’accès à sa répartition au même endroit, avec les raisons vérifiables et l’échéance de la prochaine action. Ne créer ni chance affichée arbitraire, ni certitude inventée, ni accord politique absent des règles. Reproduire les résultats historiques inchangés.
- [ ] Supprimer les répétitions exactes de description/bénéfice/contrepartie dans les cartes et leurs détails. Garder toutes les conditions et coûts accessibles. La consultation après fin doit être cohérente avec le texte présenté ; les commandes de fin ne doivent pas redevenir exécutables.
- [ ] Indiquer clairement la préparation et le travail mobilisé/prévu avec les informations existantes, sans additionner à tort les équipes réservées et celles déjà utilisées. Exposer les quantités enregistrées des livraisons plutôt qu’une seule phrase générique lorsque les données existent.
- [ ] Corriger le placement à partir des rectangles réels : les six secteurs, les événements et le panneau ouvert ne masquent aucun nom ou contrôle. Préférer un placement déterministe avec repli compact dans l’espace disponible ; conserver les ancrages et l’accès aux événements regroupés. Tester 1280×720, 1024×768, 844×390, 390×844 et 320×568, panneau ouvert/fermé.
- [ ] Exécuter les tests ciblés après chaque correction, puis les unités et types. Pas d’ajout de test reproduisant seulement le code du correctif. Ajouter un cas navigateur qui mesure réellement les collisions à 1280×720 et un parcours qui vérifie le risque/objectif/vote rendu.
- [ ] Committer les changements et rédiger `.superpowers/sdd/player-fixes-implementer-report.md` : causes, fichiers, commandes, résultats, limites, commits. Ne pas lancer push/merge depuis l’implémenteur.

Commandes de référence depuis `site/` :

```powershell
node --experimental-strip-types --test src/mandats/presidency-read-model.test.ts
npm test
npm run check:types
```

Le test navigateur est intégré à `mandats-vdef.test.mjs` ou à la configuration stratégie existante pour que CI le découvre. Le parent lance le build exact puis les parcours sur ce build ; aucun relâchement des assertions/temps ou exclusion pour faire passer une régression.

## Task 2 — revue, recette et livraison (parent)

- [ ] Revue indépendante de conformité et qualité sur un paquet de diff complet. Corriger toute observation pertinente puis faire relire.
- [ ] `npm run check`, suite stratégie et suites présidence/boucles concernées ; conserver les rapports. Les autres contrôles requis restent dans CI.
- [ ] Recette manuelle par l’interface : vérifier les cas graine 612, puis jouer un mandat complet neuf différent, avec choix fondés sur la lecture du jeu. Parcours mobile au moins du départ jusqu’à une vraie livraison ; inspecter bureau intermédiaire, petit mobile et paysage. Utiliser la pause et les vitesses normales ; aucun journal injecté pour prétendre avoir joué.
- [ ] Si un défaut apparaît, reproduire, corriger, relire et rejouer la portion concernée ; achever le mandat complet sur la révision finale. Documenter sans transformer le ressenti d’un agent en étude externe.
- [ ] Rapport final distinguant défauts corrigés, résultats réels de partie, contrôles techniques et limites de l’échantillon.
- [ ] Push, PR attachée, contrôles requis, fusion autorisée, déploiement. Vérifier les fichiers publiés puis refaire les actions affectées sur la version publiée. Corriger toute régression encore constatée par la même boucle.

## Critère de sortie

Les défauts concrets observés ne sont plus reproduits, les contrôles requis et la revue passent, un mandat complet de la révision finale est achevé et la version publiée est vérifiée. Ne prétendre ni absence absolue de risque, ni plaisir validé par des joueurs externes.
