# Cap initial et identité typographique

Date : 5 septembre 2026. Correction après retour utilisateur : le cap est un choix structurant, pas une option secondaire.

- Après le choix ville/pays, trois cartes visibles permettent de sélectionner explicitement le cap. Leur activation ouvre le premier dossier et sauvegarde cette priorité. Aucun cap n’est présélectionné par simple ouverture de l’écran ; la sauvegarde existante n’est remplacée qu’au choix du cap.
- Le sélecteur disparaît ensuite des dossiers. Reprendre conserve le cap déjà choisi ; rejouer le même défi conserve ses règles. Les défis partagés conservent le cap de leur lien. Les décisions continuent de s’enchaîner sans bilan intermédiaire obligatoire.
- Barlow Semi Condensed SemiBold pour les titres, Source Sans 3 variable pour le texte et les chiffres. WOFF2 auto-hébergés, 234 628 octets, licences et sources versionnées dans public/mandats/fonts. Les anciennes polices restent disponibles pour le site principal.
- Pictogrammes SVG cohérents pour les vues, le cap et les confirmations. Suppression des flèches décoratives des cartes, du signe raccourci clavier dans Atelier et des caractères utilisés comme icônes. Libellés accessibles conservés.
- Les tests du parcours couvrent le choix obligatoire du cap, sa sauvegarde et son absence dans les dossiers suivants, en plus des campagnes, du partage et de la reprise existants. Les résultats de la révision finale sont consignés dans sa PR. Aucun calcul de simulation modifié.

---

# Lisibilité et continuité des décisions

Date : 5 septembre 2026. Ajustement demandé après la livraison mobile.

- Le choix du mode ouvre directement le premier dossier. Le cap peut être changé dans un détail facultatif, avant la première décision, et se conserve au rechargement.
- Une carte engage le choix et affiche immédiatement le dossier suivant, ou le bilan final. Les anciens écrans obligatoires de briefing et résolution sont retirés du parcours.
- Le retour annuel tient dans un bandeau replié. Événement, comptes, effets complets et partage restent accessibles dans ce détail et dans le journal.
- Une phrase de contexte, puis titre/coût/bénéfice/compromis sur chaque carte. Les dates de livraison utiles restent visibles. Descriptions et conseils sont disponibles à la demande. Les explications du score et les autres priorités ne concurrencent plus les actions du bilan.
- 1 328 tests unitaires réussis après modification du parcours ; les tests navigateur existants sont adaptés au parcours direct et complétés par une vérification du cap persistant et des effets facultatifs. Leur résultat final figure dans la PR de cette livraison.
- Inspection supervisée à 390 px : ouverture du premier dossier depuis le choix municipal, engagement d’une rénovation puis affichage direct de « Qui finance la suite du mandat ? ». Aucun coefficient, version de règle ou calcul financier modifié.

---

# Complétion mobile, atelier et partage

Date : 5 septembre 2026. Livraison suivie dans la PR 77 ; registre courant : [TO-DO.md](TO-DO.md). Les sections suivantes restent historiques, notamment leurs anciens statuts de déploiement.

- Build complet réussi ; 1 327 tests sur la première révision. Le test supplémentaire de cycle de mise à jour porte la suite à 1 328 tests ; les 28 tests Mandats ciblés passent localement.
- CI 33944522291, job site 101248092953 : 26 parcours navigateur réussis sans reprise, 4 exclusions intentionnelles du même cycle service worker sur les autres profils. Les deux campagnes, le téléchargement PNG vérifié, l’import sur contexte neuf, les fichiers invalides, la reprise, le comparateur, le mouvement réduit et le repli de copie sont exécutés sur Chromium tactile 390/320, WebKit iPhone/paysage et Chromium bureau. Le cycle hors connexion est exercé une fois sous Chromium tactile.
- La révision finale ajoute un contrôle des illustrations légères hors connexion et un parcours des guides dans chaque profil. La CI de la tête de PR est le registre faisant foi pour ces contrôles supplémentaires.
- Revue indépendante du code : correction de l’attente d’un worker en téléchargement et version du cache liée aussi au générateur pour protéger l’ancienne copie lors d’un échec. Aucun moteur ou coefficient v1/v2 modifié.
- Inspection navigateur supervisée : atelier à 390 px sans débordement ; plan et comparaison côte à côte sur bureau ; dialogue de décision et formats accessibles sur téléphone. Carte décision nationale 1200 × 630 rasterisée et inspectée.
- Bundle Mandats : environ 25 Ko gzip de JavaScript et 10 Ko gzip de CSS, hors illustrations et polices. Préparation hors connexion limitée à 13 ressources du jeu. Aucun indicateur Core Web Vitals terrain ou test sur téléphone physique revendiqué.
- Quatre guides HTML sourcés, noindex pendant validation ; méthodologie mise à jour pour les caches, le journal local opt-in et la visibilité des liens de dilemme.
- Restent externes : appareils physiques et lecteurs d’écran réels, compréhension par des joueurs, revue indépendante des finances, corpus X autorisé, accès aux comptes et fournisseurs. Aucune publicité, collecte distante ou publication X activée.

---

# Consolidation des parcours et de l’accessibilité

Date : 4 septembre 2026, après la refonte v2 décrite plus bas.

- `npm test` : **1 322 tests réussis, zéro échec**. Quatre tests supplémentaires couvrent l’adoption des défis v1/v2 et la reprise après sérialisation, l’import/rejeu depuis un résultat, la navigation entre résultats et les valeurs complètes du score dans la vue Territoire.
- Build complet TypeScript/Vite/PNG/pré-rendu réussi. Après la protection finale des ancres, TypeScript et le bundle Vite ont été revérifiés. Aucun calcul de simulation ni score v1/v2 modifié.
- Les URL de défi et de résultat sont consommées à la prise de contrôle locale. Le démarrage, la reprise et l’import partagent une transition qui remet également la carte sur l’état courant. L’ouverture d’un résultat dans le même onglet est traitée sans écraser la sauvegarde ; les ancres ordinaires ne réinitialisent pas la partie.
- Contrôle navigateur sur bureau : campagne municipale terminée ; défi → décision → rechargement → reprise en année 2 ; résultat partagé → autre priorité → démarrage → rechargement → reprise. Un choix reste engagé en une seule activation.
- Contrôle clavier : Vue légère conserve son focus dans le panneau ; depuis Ma partie, le focus retourne à ce bouton. Le dialogue utilise son titre visible comme nom accessible. Le repli de copie place le focus sur le lien sélectionnable. Après export PNG 1200 × 630, la confirmation apparaît dans la région de statut du dialogue, sans sortir de la fenêtre modale.
- Cadre CSS 390 px, municipal : les cinq indices sont visibles et lisibles dans Territoire, dont Confiance 58 et Patrimoine 55 après réparation. Largeur utile et contenu : 375 px, sans débordement.
- Cadre CSS 320 px, national : après élargissement de l’assiette fiscale, Confiance 44 et Patrimoine 57, avec les autres indices à jour. Largeur utile et contenu : 305 px, sans débordement. Le lien « Aller au jeu » conserve la partie et sa vue.
- L’import est couvert par la transition et la reconstruction déterministe automatisées ; le sélecteur de fichier n’a pas été testé dans cette passe navigateur. Pas de test sur téléphone physique, Safari ou lecteur d’écran réel revendiqué. Les vérifications antérieures restent consignées ci-dessous.

---

# Vérification de la refonte visuelle et du modèle v2

Date : 4 septembre 2026. La section v1 ci-dessous est conservée comme historique. Les chiffres de performance et scores de v1 ne décrivent pas la nouvelle version.

- `npm test` : **1 318 tests réussis, zéro échec**.
- `npm run build` : TypeScript application/scripts/fonctions, Vite, génération PNG et pré-rendu réussis.
- Six tests nouveaux couvrent les scores v1 exacts et leur copie fiscale, les priorités et liens v2, les livraisons visuelles, le choc énergétique tardif, trésorerie/confiance/engagements futurs et l'exploration des chemins légaux pour toutes les classes de graines d'événements.
- Pour les trois intensités municipales et les quatre nationales, chaque priorité produit une meilleure trajectoire différente. Aucun état exploré n'est bloqué sans possibilité de redressement. Il s'agit d'une vérification de ce scénario étroit, pas d'un équilibrage AAA général.
- Sauvegardes et anciens liens v1 : moteur original conservé, scores inchangés dans deux fixtures exactes. Nouvelles parties v2 : priorité enregistrée et incluse dans les défis, résultats et cartes.
- Trois illustrations originales générées puis optimisées en six WebP. Ville héritée, ville rénovée à caméra constante, relief national illustratif. Aucun ajout de dépendance de production.
- Bundle Mandats : **20,34 Ko gzip** ; CSS Mandats et méthodologie : **9,30 Ko gzip** ; HTML jeu : **1,41 Ko gzip**, hors polices et images.
- Images 768 px : **59 832 à 77 822 octets** chacune. Images 1 536 px : **233 154 à 263 080 octets**. Les couches municipales réutilisent la même image rénovée et son cache.
- Le gros bundle historique reste isolé et conserve son avertissement de build. Aucun LCP/INP/CLS terrain ni niveau de performance sur téléphone physique n'est revendiqué.

## Observations v2

Les captures [ville](captures/ville-v2.jpg) et [national](captures/national-v2.jpg) proviennent du navigateur de vérification, pas d'une maquette générée. Elles montrent le code exécuté.

Parcours municipal terminé sur bureau et cadre 390 px : écoles, taux stables, îlots de fraîcheur, entretien, projet cofinancé, patrimoine final. Les écoles ne changent visuellement qu'en année 3. Les berges et le centre changent en année 4. Le bouton avant/maintenant rétablit l'image et les indices initiaux. La vue légère est activable depuis « Ma partie » sur le cadre mobile et conserve les détails territoriaux.

Le parcours national Résilience est terminé sur bureau (61/100) et le parcours Services sur cadre 390 px (58/100). Ces scores sont des sorties fictives sous des priorités différentes et ne sont pas directement comparables. Le deuxième choc énergétique et l’expiration de l’aide temporaire sont visibles dans le journal. Le retour à la vue Finances ne change pas le tour ni les décisions.

Les cartes nationales 1200×630 et 1080×1350 ont été rasterisées et inspectées après ajout de la priorité et des labels v2. Elles distinguent simulation, version et priorité. Les anciennes vérifications du téléchargement restent listées dans l'historique.

Le cadre 320 px réserve 15 px à la barre de défilement du navigateur de bureau : largeur utile 305 px. Après suppression d’une largeur minimale héritée, l’accueil, le bilan, les décisions et les territoires ont une largeur de contenu égale à ces 305 px, sans débordement horizontal. Le cadre 390 px a 375 px utiles ; la vue Finances ne déborde pas non plus.

Les animations sont désactivées par `prefers-reduced-motion`. Les marqueurs ont une cible de 44 px et un nom accessible, le clavier active les choix, les dialogues utilisent le mécanisme modal natif. Ces contrôles ne valent pas une certification WCAG ni une campagne VoiceOver/TalkBack.

Les données restent fictives. La carte nationale est une illustration, les profils ne sont pas des régions administratives. Les couches de ville expriment des projets de quartier sans représenter chaque chantier. La méthode v2 publie les pondérations, formules, seuils et limites. Aucun compte, publicité, traceur ni réponse sociale n'est activé.

---

# Vérification initiale de Mandats v1

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
