# Accueil : les comptes prennent forme

Direction validée le 30 octobre 2026 : « le récit que l’on manipule ». Le parcours initial présente les recettes, les dépenses puis leur écart, avant un accès direct au détail des dépenses, aux salaires, aux communes et aux dossiers. Mandats conserve le bureau du pouvoir et ses règles.

## Contrat

Le même montant occupe la même échelle aux trois étapes. Les chiffres viennent du dernier exercice annuel commun aux deux séries Eurostat publiées, sans dépendre d’un autre jeu de données. Les fractions graphiques restent exactes avant arrondi. Un déficit, un excédent et un équilibre ont un sens et un texte distincts. Le déficit ne se confond pas avec la variation de dette.

Le HTML publié contient déjà les trois étapes, leurs chiffres et les sources. JavaScript ajoute une scène partagée aux grands écrans et une fenêtre de sources. Le défilement reste natif. Les outils sont accessibles immédiatement dans la navigation. Aucune animation ne conditionne une action. Aucune source, année ou quantité fictive ne remplace une donnée absente.

## Échecs à prévenir

- Publication incomplète, année différente, valeur non finie ou recettes nulles : ne pas fabriquer un ratio.
- Ratio faible, élevé, fraction ou petit solde : ne pas tronquer le graphique ou inverser son signe par arrondi.
- Panne réseau au démarrage : conserver les chiffres déjà publiés dans le document.
- Même publication : ne pas recréer le DOM ni déplacer la lecture.
- Téléphone compact, paysage, zoom, mouvement réduit, JavaScript désactivé : laisser lire les trois étapes et accéder aux liens.
- Fenêtre de sources longue : conserver sa fermeture et la lecture au clavier, restaurer le focus sans déplacer la page.
- Ancres, retour arrière et navigation de la SPA : conserver le document et éviter les contrôleurs dupliqués.
- Départ vers Mandats : ne modifier ni sa sauvegarde, ni ses règles, ni son illustration validée.

## Vérification

Modèle numérique testé sur les vrais cas de données. Suite navigateur dédiée pour l’interface, les sources et les replis ; vérifications éditoriales et navigation partagée ; suite Mandats pour la non-régression. Comparaison des captures réelles ordinateur et téléphone à la proposition retenue. Les résultats effectifs et les limites sont ajoutés après exécution, sans déduire la qualité d’usage ou l’engagement de tests techniques.

## Direction et données retenues

Les références [ordinateur](accueil-recit/reference-ordinateur.png) et [téléphone](accueil-recit/reference-telephone.png) sont les captures du prototype approuvé. Leurs chiffres illustrent l’exercice 2024. Le rendu final utilise le dernier exercice commun disponible : 2025 à la publication `2026-10-03T1006`, avec 1 561 626 100 000 € de recettes et 1 714 137 200 000 € de dépenses, soit 109,77 € pour 100 € de recettes.

La barre de lecture reste accessible pendant les trois étapes. Sur téléphone, elle tient sur une ligne ; les totaux annuels suivent le graphique. Le mode paysage partage l’espace entre texte et graphique. Le choix de mesure d’audience facultatif reste en bas du document, sans recouvrir le récit et sans chargement de Google avant acceptation.

## Nettoyage

Les neuf anciens rendus/exportations d’accueil sans consommateurs, le tirage d’un territoire d’exemple et les types/constantes qui ne servaient qu’à eux ont été retirés. Le pré-rendu ne charge plus de régions pour construire une section inexistante. Les tests exclusifs à ces anciens composants sont retirés ; les contrats de routage, de publication, de sources et de métadonnées restent vérifiés. 375 lignes de styles des anciens composants `story-*` ont également été supprimées. Aucun moteur, scénario ou stockage de Mandats n’est modifié par ce récit.

## État de validation local

`NODE_USE_ENV_PROXY=1 npm run check` : 1 131 tests réussis, vérifications TypeScript et pré-rendu complet sur la vraie publication R2 réussis. Les captures intermédiaires ont révélé puis permis de corriger la densité mobile, le texte passant derrière l’en-tête des sources et le bandeau qui recouvrait la page. Les rapports navigateur définitifs et la publication sont consignés à la fin de la livraison.

Comparaison finale : [ordinateur](accueil-recit/ordinateur.png), [dépenses](accueil-recit/depenses.png), [téléphone](accueil-recit/telephone.png), [petit téléphone](accueil-recit/petit-telephone.png), [paysage](accueil-recit/paysage.png). Les trois derniers formats ont été relus avec la vraie publication, sans données substituées ni acceptation de mesure d’audience : aucun débordement horizontal ou erreur JavaScript observé. À 390 × 844, texte, graphique, légende et montant annuel tiennent au premier écran ; le petit format 320 × 568 garde un défilement normal pour terminer le graphique et sa légende.

La suite finale du récit compte **75 parcours réussis sur 75**, sans test ignoré ni relance automatique : Android Chromium, iPhone WebKit, petit écran Chromium, paysage WebKit et ordinateur Chromium. Elle vérifie les fractions réellement peintes, les sources, le retour de focus, les liens directs, une publication retardée pendant la lecture, le HTML sans JavaScript, les pannes, le mouvement réduit, les excédents et l’équilibre. La molette sur le fond est exercée dans Chromium ; Playwright ne simule pas cette action dans WebKit mobile, où le verrou de défilement et les autres interactions sont contrôlés. Les trois contrôles de navigation partagée passent également à 320, 390 et 1 440 px.

La vérification générale locale consolidée couvre 277 réussites et 73 exclusions prévues par les projets. Les anciens libellés et destinations corrigés ont été retestés sur les cinq formats, puis paysage et ordinateur ont été repris entièrement sur le build final : 114 réussites et 26 exclusions. Il ne s’agit pas d’une exécution unique sur un seul commit ; la CI du commit livré est la preuve globale correspondante. [Relevé consolidé](accueil-recit/browser-verification.json).

Un dernier contrôle clavier a relevé le contraste trop faible du contour cuivre sur l’ivoire. Le contour brun utilisé sur les surfaces claires atteint un rapport mesuré de 5,34 à 5,96 ; les cinq parcours de consultation des sources repassent après cette correction. Le build complet réussit également. Les contrôles de déploiement et les mesures réelles d’usage restent distincts de cette validation locale.
