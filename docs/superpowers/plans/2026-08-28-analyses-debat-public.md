# Analyses issues du débat public : plan d'implémentation

> Ce plan applique la conception approuvée dans `docs/superpowers/specs/2026-08-28-analyses-debat-public-design.md`.

**Objectif :** remplacer dix cartes France génériques par dix analyses vérifiées et ajouter trois analyses Territoires sans changer l'interface ni dépasser 100 cartes France.

**Architecture :** un module de données décrit les publications officielles externes ; un module France construit les nouvelles cartes statiques ou dérivées des séries existantes ; le catalogue générique perd dix entrées. La page Sources rend les nouvelles références une seule fois. Les analyses Territoires restent calculées dans leur module actuel.

**Pile :** TypeScript, fonctions de rendu HTML pures, tests Node, Vite.

### Tâche 1 : enregistrer les sources externes

**Fichiers :**
- Créer : `site/src/insights-sources.ts`
- Modifier : `site/src/insights.ts`
- Modifier : `site/src/methode-rendu.ts`
- Tester : `site/src/methode-rendu.test.ts`

1. Écrire un test qui exige une section dédiée et les liens officiels.
2. Ajouter le type optionnel `sourceIds` aux cartes.
3. Définir les sources officielles avec un identifiant stable.
4. Rendre la section dans Sources et méthode, sans l'ajouter aux cartes.
5. Exécuter le test ciblé.

### Tâche 2 : construire les dix analyses France

**Fichiers :**
- Créer : `site/src/insights-france-debat.ts`
- Créer : `site/src/insights-france-debat.test.ts`
- Modifier : `site/src/insights-france.ts`
- Modifier : `site/src/insights-france-catalogue.ts`
- Modifier : `site/src/insights-france-generiques.test.ts`
- Modifier : `site/src/insights-france.test.ts`

1. Écrire les tests des huit faits officiels, du ratio dette sur IR et du rattrapage polonais.
2. Implémenter les cartes avec titres courts, sources et preuves.
3. Brancher les cartes avant le catalogue générique.
4. Retirer dix recettes génériques faibles et mettre à jour les totaux attendus.
5. Vérifier que les données de référence produisent exactement 100 cartes et huit thèmes.

### Tâche 3 : ajouter les trois analyses Territoires

**Fichiers :**
- Modifier : `site/src/insights-territoire.ts`
- Modifier : `site/src/insights-territoire.test.ts`

1. Ajouter des fixtures pour le logement social, les générations et l'impôt par foyer.
2. Écrire les attentes de calcul et de classement.
3. Implémenter les trois ratios avec contrôles d'unités et de période commune.
4. Enrichir la carte des intérêts avec sa trajectoire.
5. Exécuter le test ciblé.

### Tâche 4 : vérifier, intégrer et déployer

**Fichiers :**
- Modifier si nécessaire : tests ou styles uniquement si la vérification révèle une régression.

1. Exécuter `npm test` dans `site`.
2. Exécuter `npm run build` dans `site`.
3. Contrôler l'absence de cadratin dans les nouveaux textes affichés.
4. Fusionner la branche de travail dans `main` et pousser.
5. Attendre la fin du workflow de déploiement.
6. Vérifier la production sur ordinateur et à 390 px : 100 cartes France, huit thèmes, aucun débordement horizontal, page Sources accessible et trois nouvelles cartes Territoires.
