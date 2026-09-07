# Identité commune, septembre 2026

Direction validée : fond bleu profond, surfaces contrastées, accents dorés,
recettes et épargne vertes, dépenses et dette orangées. Un petit bouton vectoriel
bascule entre sombre et clair. Le choix existant est conservé et partagé entre
les documents, sans toucher aux sauvegardes du jeu.

La page France reprend la composition de la maquette approuvée : scène civique
interactive, solde annuel, flux puis chapitres et analyses complètes. Les cent
analyses actuellement publiées restent visibles, avec leur texte et leurs
comparaisons. L'invitation à prendre les décisions arrive après les analyses.

Territoires, Salaire, Mandats et les guides reprennent les mêmes couleurs,
typographies et quatre destinations. Les anciens liens du simulateur restent
compatibles, mais celui-ci ne figure plus dans la navigation principale.

Le contrôle visuel a notamment corrigé les anciennes couleurs imposées au
mandat clair, les couleurs inversées du budget territorial, le menu mobile et
les titres hérités. Le thème est chargé après les feuilles propres à chaque
page dans le site compilé ; les couleurs locales de France sont également
remappées. Le test de navigation contrôle le titre visible. La scène respecte les préférences de réduction des mouvements.

Captures du site exécuté, et non du prototype :

- [France, ordinateur](france-desktop.png)
- [Graphique France et Salaire, formats mobiles, sombre](mobile-charts-sombre.png)
- [Vote et fiche Bordeaux, formats mobiles, clair](mobile-clair.png)

Validation locale : 1 405 tests unitaires et compilation/prérendu réussis.
Contrôle navigateur : France, Bordeaux, Salaire et plusieurs votes nationaux,
en clair et sombre, ordinateur et cadres mobiles de 390 et 320 pixels.
Le WebGL du navigateur de contrôle est indisponible : le repli territorial est
fonctionnel. La suite Chromium/WebKit reste un gate CI avant fusion, les binaires
du navigateur de test n'étant pas téléchargeables dans l'environnement local.
