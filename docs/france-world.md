# France : scène de mandat

Cette étape se concentre sur la France. Le mode municipal reste en place sans changement. Les 45 décisions, leur contenu et les règles financières sont conservés.

Le monde national est une maquette procédurale de la France métropolitaine. Ses quatre profils ne sont pas des régions administratives. Le bâti ne représente pas des chantiers réels. Aucune tuile, photographie ou donnée personnelle n'est demandée par le rendu.

La scène reprend les états du moteur : les investissements en attente restent des chantiers, les projets livrés deviennent des équipements. La fiscalité ne fait pas apparaître de bâtiments. La vue initiale restaure les indicateurs de départ. Le dernier groupe de huit programmes est représenté pour limiter la densité ; le journal conserve tous les engagements.

Sur téléphone, la scène occupe une bande de 165 px avant le dossier. Les commandes territoriales restent dans Territoire. Sur ordinateur, la scène et les décisions sont côte à côte. Les profils du territoire restent des boutons HTML accessibles. La rotation à la souris est facultative, le tactile conserve le défilement vertical.

Three.js est chargé à la demande dans un module indépendant (environ 143 ko gzip au premier build). Aucun chargement 3D ne bloque la première décision. Le canvas persiste entre les tours. Pas de boucle d'animation au repos ; suspension hors écran et onglet masqué ; DPR plafonné à 1,5 sur petite scène et 2 sur grande scène. La vue illustrée reste disponible si WebGL échoue et hors ligne. La 3D n'est pas un prérequis de la sauvegarde hors ligne.

Les tests couvrent les 45 transitions, la sauvegarde/restauration, les livraisons, la vue héritée, la réutilisation du canvas, les profils accessibles et le parcours complet sans WebGL. Les captures CI utilisent Chromium avec un rendu logiciel ; elles ne remplacent pas une mesure de consommation sur un téléphone physique. Le benchmark Afterlight reste un objectif de qualité, pas une équivalence certifiée.
