# Vérification de Mandats

Date : 4 septembre 2026. Portée : tranche jouable dans `500SIGNATURESV2`, pas audit de certification ni étude utilisateurs.

## Automatisation

- `npm test` : **1 312 tests réussis, 0 échec**. La suite comprend les tests historiques et les nouveaux invariants Mandats.
- `npm run build` : vérifications TypeScript de l'application, scripts et fonctions, compilation Vite, génération PNG et pré-rendu historique. Build réussi.
- `git diff --check` : aucun problème d'espaces détecté.
- Aucune nouvelle dépendance de production. Entrée Mandats isolée du bundle cartographique historique.
- Le test de parcours explore les choix légaux des deux campagnes à la graine par défaut. Il ne constitue pas une preuve d'équilibrage ni une exploration de toutes les graines possibles.
- Règles vérifiées : conservation comptable municipale, contraintes d'épargne, capital/intérêts distincts, lien déficit/dette/PIB, transmission des taux, livraison différée une seule fois, déterminisme, import/replay, états de fin, récupération, liens et cartes, rendu, consentement/ads et triage X.

## Parcours navigateur observés

Navigateur contrôlé de bureau ; cadre iframe **390 × 844 CSS** pour l'inspection mobile. Ce cadre utilise les mêmes media queries que le téléphone mais ne simule pas un matériel mobile, Safari, les performances réseau ou les gestes tactiles.

1. Accès au jeu par le lien natif du site existant.
2. Sélection des deux modes et lecture des briefings.
3. Municipal : rénovation des écoles, renforcement des recettes, îlots de fraîcheur, entretien des équipements, projet cofinancé, rénovation finale.
4. Visites des vues Territoire et Finances pendant la campagne, puis retour aux décisions.
5. Reprise de sauvegarde après actualisation pendant le mandat.
6. Bilan municipal atteint : 79/100 pour ce parcours précis ; ce résultat est une sortie fictive du modèle.
7. Ouverture du dialogue de partage ; avertissement sur l'accès aux choix ; téléchargement PNG 1200×630 avec confirmation visible.
8. Changement de mode, national : assiette fiscale, modernisation, sobriété/réseaux, ajustement progressif, adaptation des territoires.
9. Bilan national atteint : 59/100, dette/PIB 117,3 % pour ce scénario fictif ; aucune interprétation prédictive.
10. Reprise du bilan national sur le grand écran : carte et trajectoire persistantes, score et dimensions à droite.
11. Cartes de résultat finales rasterisées en 1200×630 et 1080×1080 puis inspectées visuellement : texte lisible, quatre dimensions, mode, tours, lien du jeu et mention de simulation. Les quatre formats sont disponibles dans le code ; portrait et story ne font pas l'objet d'une validation visuelle exhaustive dans cette session.

Le téléchargement navigateur a été exercé sur la carte municipale, puis sur la carte nationale finale enrichie des quatre dimensions ; le rendu de ces dimensions a également été vérifié par rasterisation avec le même générateur SVG. Le navigateur n'a envoyé aucun message ni publié de contenu social.

## Mesures et limites

Le bundle propre au jeu est de l'ordre de 17 Ko gzip ; la feuille de style de l'ordre de 5,3 Ko gzip. Le build conserve un avertissement sur le gros bundle historique du site, qui reste dans l'entrée principale. Le budget total d'une page doit aussi compter polices, HTML et ressources communes. Aucun score Lighthouse, LCP, INP ou CLS terrain n'est revendiqué.

À effectuer avant lancement public : tests iOS Safari/Android réels ; VoiceOver/TalkBack ; contraste mesuré et zoom 200 % ; focus sur tous les flux ; matrice de navigateurs ; compréhension de la simulation et de la visibilité des liens ; étude de stratégies dominantes ; revue indépendante des finances ; vérification des en-têtes de production et des previews sociaux sur les plateformes.

## Références et accès

Septennats et La Bataille du Budget : observations d'introduction et d'états accessibles, pas deux campagnes complètes ni benchmarks mobiles mesurés. Vidéo X : composition d'un état observable, pas analyse complète des transitions. Likes X : aucun corpus accessible. lieflat-charts : référence de visualisation seulement, aucun code repris.

## Activation

Aucun déploiement public, aucune fusion sur `main`, aucun tag publicitaire, aucune collecte analytique de décisions, aucun compte social créé, aucune réponse X envoyée. Les nouvelles pages gardent `noindex` pendant la validation. OG personnel côté serveur, synchronisation cloud, visualisation de ville vivante et planification avancée sont des étapes futures.
