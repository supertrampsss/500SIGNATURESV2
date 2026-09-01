# Simulateur V11, 55 cartes et 45 par partie, plan d'implémentation

> **Pour les agents d'exécution :** utiliser `superpowers:subagent-driven-development` ou `superpowers:executing-plans`. Chaque modification de comportement suit un cycle test en échec, implémentation minimale, test au vert.

**Objectif :** publier une bibliothèque de 55 cartes vulgarisées et faire jouer exactement 45 cartes par partie, choisies selon les décisions du joueur.

**Architecture :** V10 reste lisible pour les anciennes sauvegardes. V11 possède un catalogue de 55 décisions, une copie joueur séparée des métadonnées du moteur et un plan de session persistant de 45 identifiants. Après chaque choix, seules les cartes futures devenues incompatibles sont remplacées par une candidate admissible du même thème.

**Technologies :** TypeScript, rendu HTML serveur local, CSS, tests `node:test`, Vite et Playwright.

## Contraintes globales

- La bibliothèque contient exactement 55 cartes.
- Une partie affiche exactement 45 cartes.
- Chaque partie contient 8 cartes communes, 3 cartes de synthèse et 34 cartes adaptatives.
- Une option est appliquée dès qu'elle est touchée.
- `Détails` n'applique aucun choix.
- Les montants viennent exclusivement des profils budgétaires.
- Aucun sigle n'apparaît sans explication immédiate.
- Aucun texte visible ne contient un cadratin ou les formulations interdites de la spécification.
- Une ancienne sauvegarde V10 n'est jamais convertie silencieusement en V11.

---

### Tâche 1 : contrat de copie joueur et panneau de détail

**Fichiers :**
- Modifier `site/src/simulateur-v3/types.ts`
- Modifier `site/src/simulateur-v3/render.ts`
- Modifier `site/src/simulateur-v3/controller.ts`
- Modifier `site/src/styles/simulateur-v3.css`
- Tester `site/src/simulateur-v3/render.test.ts`
- Tester `site/src/simulateur-v3/controller.test.ts`

**Produit :** `Decision.displayCopy` et `DecisionOption.displayCopy`, plus un panneau qui affiche uniquement les rubriques renseignées.

- [ ] Écrire un test qui exige la copie IR-CSG vulgarisée et la liste en langage courant de la carte de résidence.
- [ ] Vérifier que le test échoue parce que `displayCopy` n'existe pas.
- [ ] Ajouter les types `DecisionDisplayCopy`, `DecisionOptionDisplayCopy` et `DecisionOptionDetails`.
- [ ] Écrire un test qui ouvre `Détails`, vérifie que l'option n'est pas choisie, ferme par bouton et par Échap, puis contrôle le retour du focus.
- [ ] Vérifier l'échec du test sur l'action absente.
- [ ] Ajouter les actions `open-details` et `close-details` sans modifier `select`.
- [ ] Ajouter la feuille basse à 390 px et le panneau latéral à partir de 768 px.
- [ ] Exécuter les tests de rendu et de contrôleur jusqu'au vert.

### Tâche 2 : bibliothèque V11 de 55 cartes

**Fichiers :**
- Créer `site/src/simulateur-v3/scenario-v11-copy.ts`
- Créer `site/src/simulateur-v3/scenario-v11-catalogue.ts`
- Créer `site/src/simulateur-v3/scenario-v11-catalogue.test.ts`

**Produit :** `SCENARIO_V11_CATALOGUE`, version 11, avec exactement les questions et options du catalogue cible.

- [ ] Écrire un test qui exige 55 décisions uniques réparties dans les 8 thèmes.
- [ ] Écrire un test qui compare les titres et options aux 55 entrées attendues.
- [ ] Vérifier l'échec avant la création du catalogue.
- [ ] Définir les 55 copies visibles dans `scenario-v11-copy.ts`.
- [ ] Pour une carte directe, cloner l'option V10 et son `BudgetProfile`.
- [ ] Pour une carte fusionnée, cloner chaque option source dans une seule décision V11 et créer un maintien neutre unique.
- [ ] Conserver `transitionFlows` et `exclusiveScopeKeys` sans additionner deux options.
- [ ] Omettre toute rubrique distributive non supportée.
- [ ] Exécuter le test du catalogue jusqu'au vert.

### Tâche 3 : plan de session persistant de 45 cartes

**Fichiers :**
- Créer `site/src/simulateur-v3/adaptive-session.ts`
- Créer `site/src/simulateur-v3/adaptive-session.test.ts`
- Modifier `site/src/simulateur-v3/types.ts`
- Modifier `site/src/simulateur-v3/campaign.ts`
- Modifier `site/src/simulateur-v3/validation.ts`

**Interfaces :**
- `buildSessionPlan(catalogue: Scenario, seed: number): string[]`
- `refreshFutureSessionPlan(state: CampaignState, catalogue: Scenario): CampaignState`
- `CampaignState.sessionDecisionIds?: string[]`

- [ ] Écrire un test qui exige 45 identifiants uniques pour plusieurs graines.
- [ ] Exiger les 8 cartes communes et les 3 cartes de synthèse dans chaque plan.
- [ ] Exiger 34 cartes adaptatives et exactement 10 cartes non jouées.
- [ ] Vérifier l'échec avant l'implémentation.
- [ ] Construire le plan avec un tirage déterministe fondé sur la graine et une enveloppe par thème.
- [ ] Faire lire `currentDecision` dans `sessionDecisionIds` pour V11.
- [ ] Adapter `totalDecisions` et la position pour retourner 45 sur V11.
- [ ] Valider la présence, l'unicité et l'appartenance des 45 identifiants au catalogue.
- [ ] Exécuter les tests de session, campagne et validation jusqu'au vert.

### Tâche 4 : adaptation après chaque choix et retour arrière

**Fichiers :**
- Modifier `site/src/simulateur-v3/adaptive-session.ts`
- Modifier `site/src/simulateur-v3/campaign.ts`
- Modifier `site/src/simulateur-v3/controller.ts`
- Créer `site/src/simulateur-v3/adaptive-flow.test.ts`

**Produit :** une carte future incompatible est remplacée, sans écran sauté et sans changer les cartes déjà jouées.

- [ ] Écrire un test où un choix fiscal retire une réforme incompatible future et la remplace par une carte du même thème.
- [ ] Écrire un test où un choix énergétique incompatible est remplacé avant affichage.
- [ ] Écrire un test où `Retour` restaure le plan antérieur, le budget, les événements et les crises causées par le choix annulé.
- [ ] Vérifier les trois échecs.
- [ ] Enregistrer un instantané du plan avant chaque décision dans l'historique V11.
- [ ] Remplacer uniquement les identifiants futurs devenus inadmissibles.
- [ ] Interdire le remplacement d'une carte commune ou de synthèse.
- [ ] Restaurer le dernier instantané dans l'action `Retour`.
- [ ] Exécuter les tests de flux jusqu'au vert.

### Tâche 5 : crises V11

**Fichiers :**
- Créer `site/src/simulateur-v3/scenario-v11-crises.ts`
- Créer `site/src/simulateur-v3/scenario-v11-crises.test.ts`
- Modifier `site/src/main.ts`

**Produit :** au plus trois crises, toutes causées par des choix V11 présents et dotées d'au moins deux réponses applicables.

- [ ] Écrire un test qui refuse une règle visant un ancien identifiant.
- [ ] Écrire un test qui exige deux réponses applicables par crise.
- [ ] Écrire un test qui plafonne l'historique à trois crises.
- [ ] Vérifier les échecs.
- [ ] Remapper les causes vers les décisions fusionnées V11 et leurs nouvelles options.
- [ ] Conserver dans chaque plan les cartes nécessaires aux règles de crise actives.
- [ ] Appliquer réellement suspension, amendement ou annulation à la décision source.
- [ ] Exécuter les tests de crise jusqu'au vert.

### Tâche 6 : publication V11 et sauvegardes

**Fichiers :**
- Créer `site/src/simulateur-v3/scenario-v11.ts`
- Modifier `site/src/simulateur-v3/scenario-resolver.ts`
- Modifier `site/src/simulateur-v3/storage.ts`
- Modifier `site/src/simulateur-v3/storage.test.ts`
- Modifier `site/src/main.ts`

- [ ] Écrire un test qui résout V9, V10 et V11 sans ambiguïté.
- [ ] Écrire un test qui impose un nouveau départ lorsqu'une sauvegarde V10 rencontre V11.
- [ ] Écrire un test qui restaure une sauvegarde V11 avec son plan de 45 identifiants inchangé.
- [ ] Vérifier les échecs.
- [ ] Publier V11 comme scénario des nouvelles parties.
- [ ] Conserver V9 et V10 pour la lecture historique.
- [ ] Persister la graine et `sessionDecisionIds`.
- [ ] Exécuter les tests du résolveur et du stockage jusqu'au vert.

### Tâche 7 : validation éditoriale des 55 cartes

**Fichiers :**
- Modifier `site/src/simulateur-v3/validation.ts`
- Modifier `site/src/simulateur-v3/validation.test.ts`

- [ ] Écrire un test qui parcourt question, contexte, options, détails, crises et verdict.
- [ ] Exiger l'échec pour un sigle inexpliqué, un cadratin, un texte interdit ou une longueur dépassée.
- [ ] Vérifier l'échec sur des fixtures volontairement invalides.
- [ ] Implémenter la validation de toutes les surfaces visibles.
- [ ] Vérifier les 55 cartes V11 sans erreur.

### Tâche 8 : vérification finale et production

**Fichiers :**
- Tester l'ensemble de `site`
- Vérifier `site/src/styles/simulateur-v3.css`

- [ ] Exécuter `npm test`.
- [ ] Exécuter `npm run build`.
- [ ] Lancer le site local et jouer une partie complète sur au moins deux graines.
- [ ] Contrôler 390, 768 et 1280 px, sans débordement horizontal.
- [ ] Vérifier 55 cartes dans la bibliothèque et 45 décisions dans chaque verdict.
- [ ] Vérifier qu'un chemin compatible atteint un solde annuel nul ou positif.
- [ ] Committer sur `main`, pousser et attendre la fin du déploiement.
- [ ] Contrôler la production sur `https://500signatures.fr/simulateur?version=3`.
