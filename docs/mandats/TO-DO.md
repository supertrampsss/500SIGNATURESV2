# Registre de livraison de Mandats

Actualisé le 5 septembre 2026. Ce registre remplace les statuts de livraison historiques de STRATEGIE.md ; les décisions de conception et sources de ce dossier restent consultables. « Livré » décrit une fonctionnalité exécutée, jamais une certification AAA ou un résultat d’étude utilisateur.

| Sujet | Réalisation | Statut |
|---|---|---|
| Deux modes jouables | Six tours municipaux, cinq nationaux ; moteurs et règles distincts ; sauvegardes v1/v2 conservées | Livré en production, PR 76 |
| Monde visuel | Ville héritée et rénovations livrées ; relief national ; avant/maintenant ; vue légère | Livré en production, PR 76 |
| Mobile : première décision | Choix du mode, puis cap initial explicite ; cap conservé sans sélecteur dans les dossiers ; cartes lisibles, effets annuels dépliables et enchaînement direct | Cap initial et identité revus après PR 78 |
| Mobile : import et menus | Import depuis l’accueil, champ fichier adapté aux petits écrans ; erreurs dans le dialogue ; focus explicite | Implémenté dans cette livraison |
| Mobile : installation | Manifest, icônes, instructions iPhone/Android ; aucune obligation d’installation | Implémenté dans cette livraison |
| Mobile : hors connexion | Téléchargement volontaire des ressources du jeu ; cache isolé ; suppression et mise à jour explicites ; sauvegarde locale conservée | Cycle hors connexion réussi en CI Chromium tactile ; mise à jour couverte par test ciblé |
| Mobile : tests des moteurs | Chromium tactile 390/320, WebKit iPhone et paysage, Chromium bureau ; parcours, import, partage, comparaison | 26 parcours réussis sur la première révision (CI 33944522291) ; contrôle de la tête finale dans PR 77 |
| Appareils physiques | iPhone/Safari/VoiceOver, Android/TalkBack, réseau réel, autonomie et mémoire | Nécessite appareils et personnes ; aucune émulation n’est présentée comme preuve matérielle |
| Atelier de stratégie | Plan annuel alternatif, comparaison à année identique, comptes/livraisons ; partie privée inchangée | Implémenté sur téléphone et bureau |
| Cartes | Héritage, décision, défi ; quatre formats PNG ; description copiable ; SVG accessible et aperçu local | Implémenté |
| Liens de dilemme | Journal antérieur validé et rejoué ; reprise avant le choix ; avertissement de visibilité | Implémenté, règles v1/v2 conservées |
| OG personnel serveur | Les liens fragment conservent les choix hors requête HTTP ; carte personnelle téléchargée localement | Différé : stockage/publication/rétention/retrait et service à définir avant de transmettre des parcours au serveur |
| Guides | Quatre guides sourcés, index, liens entre guides et mode adapté, canonical, Article/CollectionPage, date réelle | Préparés et accessibles ; noindex conservé pendant validation |
| SEO à grande échelle | Villes réelles, pages de comparaison, étude de requêtes et demandes Search Console | Conditionné à des données fiables, à la validation produit et aux accès comptes ; aucune page de ville fabriquée |
| Pilote produit | Journal local opt-in des étapes, export volontaire sans choix ni score ni identifiant | Implémenté ; aucune transmission réseau, aucun résultat de pilote inventé |
| Validation finance | Formules ouvertes et tests ; scénarios explicitement fictifs | Revue indépendante et calibration observée à organiser, sans la simuler par une validation de code |
| Données observées | Producteurs et concepts documentés ; séparation fait/hypothèse/résultat | Baseline réelle à réconcilier et faire relire avant nouvelle version de règles |
| Veille likes X | Import hors ligne d’un export autorisé ; validation des URL/champs ; clusters tracés ; backlog non approuvé | Outil local livré ; aucun corpus propriétaire reçu, donc aucun rapport de thèmes prétendument observés |
| Réponses X | Triage en pause, contrôle sources/opt-out/doublons/contexte ; revue humaine et journal | Fonctions locales livrées ; aucune API X ou publication autonome branchée |
| Comptes, newsletter, partenariats | Positionnement, calendrier et règles documentés dans STRATEGIE.md | Accès et identité d’exploitation nécessaires ; aucun compte/contact créé sans ces éléments |
| Consentement et publicité | Jeu sans régie ; aucune collecte facultative distante ; opt-in local du pilote, révocation et export | Activation d’une CMP/régie uniquement après fournisseur choisi et pilote validé |
| Communes réelles et mandat long | 45 décisions réparties sur les années, ville sélectionnée et carte réactive | Priorité demandée après essai ; cadrage détaillé dans MANDAT-LONG-VILLES-REELLES.md ; non livré |
| Communauté et scénarios créateurs | Contrats et trajectoire d'évolution documentés | Conditionnés à la validation produit et aux ressources de modération |

## Critères de passage encore réels

Le pilote doit mesurer compréhension du choix Ville/France, explication d’un compromis, complétion, partage et envie de rejouer. Les seuils de STRATEGIE.md sont des objectifs proposés, pas des résultats. Aucun compte social, publicité, publication automatisée ou donnée observée inventée n’est activé pour masquer un prérequis manquant.

## Outil de veille hors ligne

Depuis `site/` : `node --experimental-strip-types scripts/mandats-intelligence.ts export-autorise.json rapport.json`.

Le fichier d’entrée comporte `authorized: true` et `posts: []`. Chaque publication renseigne URL de statut X, auteur, date, langue, résumé neutre, idée, thèmes autorisés, statut de vérification, sources et scores de 0 à 5. Le programme refuse les doublons, les statuts « verified » sans sources et les formats non bornés. Le rapport est un brouillon d’opportunités ; aucune idée n’est approuvée et aucune action n’est effectuée sur X. Un tableau vide produit un rapport vide, pas des thèmes inventés.

Les scores et thèmes sont fournis par la relecture humaine de l’export, ils ne sont pas inférés automatiquement des opinions d’un compte. La possession d’un fichier ne suffit pas à établir un droit de réutilisation : l’opérateur doit disposer de l’autorisation et respecter les conditions de sa source. Ce programme ne cherche ni ne contourne aucun accès privé.

## Onglets de données, prolongement du 5 septembre 2026

- [x] Salaires : atelier autonome, quatre statuts, décomposition, coefficients explicites et validation de saisie.
- [x] France : couverture chiffrée, navigation dans les chapitres, conservation des sources et des graphiques complets.
- [x] Territoires : recherche compacte après sélection, quatre repères datés, diagnostic local et repli sans WebGL.
- [x] Identité typographique partagée et navigation à cinq destinations sur mobile.
- [ ] Calibrer un véritable moteur de paie par statut avant de présenter des estimations individuelles.
- [ ] Découper le bundle historique France/Territoires et réduire le CSS partagé.
- [ ] Étendre le hors connexion aux données territoriales uniquement avec sélection explicite, gestion des versions et budget de stockage.

Voir `docs/design/2026-09-05-editorial-rework.md` et la CI de la pull request pour la vérification du lot.

## Nouvelle priorité après essai : profondeur et villes réelles

Le retour utilisateur remplace l'objectif de rester sur cinq/six décisions. Voir [le cadrage du mandat long](MANDAT-LONG-VILLES-REELLES.md), qui distingue précisément les constats du code, les décisions produit et les fonctionnalités à construire.

- [ ] Séparer les décisions des clôtures annuelles dans un moteur v3 ; préserver les versions v1/v2.
- [ ] Écrire et équilibrer 45 dossiers par mandat, avec variantes liées aux décisions antérieures.
- [ ] Sélectionner une vraie commune depuis l'accueil municipal ou sa fiche Territoires.
- [ ] Rapprocher les comptes sources et figer un instantané financier par partie.
- [ ] Adapter coûts, compétences et difficultés au profil de la commune, sans données sociales fictives présentées comme observées.
- [ ] Produire un pilote géographique 3D fidèle à Bordeaux puis une chaîne réutilisable.
- [ ] Afficher chantiers, livraisons et effets territoriaux sur la carte, avec repli léger complet.
- [ ] Préparer le jeu et la ville choisie hors connexion avec volume annoncé et contrôle de version.
- [ ] Adapter le planificateur, le journal, les cartes partagées et les tests au calendrier long.
