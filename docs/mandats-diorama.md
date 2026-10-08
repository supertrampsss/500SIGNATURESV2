# MANDATS : référence du diorama 3D

## Références visuelles

Le 8 octobre 2026, le propriétaire a explicitement confirmé cette maquette avec la consigne : « C’est elle donc tu rapproches systématiquement de ça quand tu penses avoir terminé ».

[![Maquette principale confirmée : France miniature, interface bleu nuit et ivoire](mandats-diorama/reference-ordinateur.png)](mandats-diorama/reference-ordinateur.png)

La [référence principale](mandats-diorama/reference-ordinateur.png) est la première carte sur ordinateur : en-tête MANDATS bleu nuit, panneau ivoire « À traiter », mobilisation lycéenne à Lyon, marqueurs à Lille, Nantes et Marseille, navigation en bas. La France est une miniature riche en architectures, reliefs, végétation et activités, entourée d'une mer bleu profond. La lumière est chaude et les titres utilisent une typographie à empattements.

Le fichier conservé reproduit cette maquette originale. Il remplace la proposition ultérieure charbon et menthe qui avait été désignée à tort comme référence principale. La [précédente étude mobile](mandats-diorama/reference-mobile.png) reste un complément pour la concision des sujets et des réponses ; son style ne remplace pas la direction artistique de l'image confirmée. Les adaptations mobiles doivent conserver cette direction avec une lecture simple.

La maquette est une référence artistique. Les captures de validation doivent provenir du navigateur exécutant le jeu. Le code, le moteur de jeu et les contrôles HTML fournissent les interactions et les conséquences.

Les exigences ultérieures du propriétaire restent applicables : lecture simple, peu d'informations simultanées, choix direct, aucun cadratin, aucune flèche ni aucun chevron. Les jauges, onglets et flèches présents dans certaines maquettes ne constituent donc pas des éléments à reproduire systématiquement.

## Critères observables

| Aspect | Référence à retrouver dans le rendu réel |
| --- | --- |
| Composition | La France constitue le sujet principal. Son relief reste lisible, les côtes sont reconnaissables et la Corse reste visible au cadrage initial. Le cadrage s'adapte à la surface disponible. |
| Profondeur | L'inclinaison révèle les façades, les reliefs et les vallées. Les bâtiments et arbres sont ancrés au sol par un éclairage et des ombres cohérents. Une inspection change réellement le point de vue dans une scène 3D. |
| Territoire | Forêts groupées, champs, tissus urbains, fleuves, routes et littoral forment un ensemble. Leur répartition évite un semis uniforme de primitives isolées. Les reliefs comportent des crêtes et des variations de pente. |
| Villes | Les agglomérations présentent plusieurs silhouettes, des quartiers, des rues et des repères architecturaux. Un petit village identique posé sur une dalle ne suffit pas à représenter chaque métropole. |
| Matières | Couleurs nuancées et détails perceptibles sur le sol, la pierre, les toitures et l'eau. Les surfaces conservent une unité artistique avec la lumière chaude, la végétation et les tons marins des références. |
| Interface | L'en-tête bleu nuit, le panneau ivoire, les titres à empattements et les urgences rouges retrouvent la direction de la maquette confirmée. La composition garde la carte dominante et les sujets immédiatement repérables. |
| Eau et environnement | La mer présente des variations lisibles autour des côtes. L'environnement contribue à la composition, avec des territoires voisins discrets plutôt qu'une grande surface uniforme. |
| Netteté | Le framebuffer conserve au moins la résolution CSS dans le parcours de référence, y compris sur écran à forte densité et après redimensionnement. Les étiquettes restent des contrôles HTML lisibles et accessibles. |
| Lecture | Un sujet ouvert affiche son problème et des réponses distinctes avec un sacrifice concret. Les détails restent consultables à la demande. La carte accompagne la décision sans repousser les choix plusieurs écrans plus bas. |
| Activité | Les mobilisations, projets et livraisons apparaissent à partir des décisions réellement enregistrées. Leur lecture reste possible sans animation. |

## Comparaison obligatoire avant de conclure

Pour chaque itération visuelle :

1. Conserver une capture réelle du jeu sur ordinateur, avec le viewport, le navigateur, la version et les entrées de partie permettant de la reproduire.
2. Présenter cette capture à côté de la maquette principale confirmée. Comparer la composition complète, puis des vues rapprochées des villes, reliefs, forêts, côtes, eau et matières.
3. Examiner également les captures à 390 et 320 pixels et un sujet ouvert : l'adaptation doit préserver la direction artistique, la lisibilité et l'accès aux réponses.
4. Documenter les écarts visibles selon les critères ci-dessus. Tant que le rendu reste sensiblement éloigné de la maquette, poursuivre le travail ou annoncer explicitement une étape intermédiaire. Le travail visuel ne peut pas être présenté comme terminé.

Un succès de compilation ou la seule présence d'un contexte WebGL ne valide pas la fidélité artistique. Le rendu livré dans la correction du diorama reste trop éloigné de la maquette confirmée ; les captures ci-dessous documentent cet état intermédiaire.

## Causes établies sur le rendu précédent

Le moteur Babylon utilise le niveau de mise à l'échelle comme un diviseur. L'ancienne formule augmentait ce diviseur avec la largeur et la densité de l'écran. Le parcours réel ajouté avant correction reproduit, à DPR 2, un canvas de **636 × 535 pixels** affiché dans une surface de **1060 × 892 pixels CSS**. Le navigateur agrandit ce résultat, ce qui explique une partie du flou.

Le décor précédent utilise principalement des couleurs unies et n'a pas d'ombres portées. Un éclairage hémisphérique important réduit les contrastes de volume. Les montagnes sont des bosses régulières ; les villes partagent les mêmes petites maisons sur une dalle rectangulaire ; arbres et champs sont distribués avec peu de composition territoriale. Leur accumulation ne produit pas la richesse visible dans les références.

Le monde statique dispose déjà de fusions de meshes par matériau. Les personnes des foules restent composées de plusieurs meshes chacune. Des effets ou ombres supplémentaires doivent tenir compte de ce coût, particulièrement quand plusieurs mobilisations sont actives.

## Correction réalisée

Le terrain est reconstruit avec des crêtes, des vallées, des falaises stratifiées et des faces rocheuses. Les Alpes, les Pyrénées et la Corse ont des profils distincts. Les forêts forment des massifs ; les champs deviennent des parcelles irrégulières, avec un grain local et quelques sillons. Les fleuves et routes suivent des courbes. Les villes réunissent plusieurs rues et silhouettes de bâtiments, des toits en pente, des fenêtres, des monuments et des ports. Les petites localités intermédiaires relient le paysage aux agglomérations.

L'eau utilise un shader local avec variations de profondeur, vagues fines et reflet de lumière. Les pays voisins sont construits depuis les contours Natural Earth, avec une lumière et une palette discrètes. Leur décor apporte un contexte géographique. Il ne crée aucun sujet hors du périmètre du jeu.

Une lumière directionnelle chaude projette les ombres des bâtiments et du terrain. Les ombres statiques sont recalculées quand un projet change ; les personnes, véhicules et parties mobiles des grues sont exclus de ce cache. Les parties des foules partagent des modèles instanciés. Les décors sont fusionnés par matériau et attributs compatibles pour préserver leurs textures ; la scène initiale compte 37 groupes statiques.

Le framebuffer tient compte du DPR avec un budget de pixels, tout en conservant au moins la résolution CSS même lorsque la cadence demande un allègement. La caméra ajuste le cadrage à la surface disponible, conserve la Corse et recalcule ce cadrage avec « Recentrer ». Un déplacement manuel, y compris à la molette, conserve ce cadrage au redimensionnement. Les villes et projets sont ancrés sur la hauteur du terrain. Le canvas persiste entre les décisions. La carte occupe toute la largeur disponible, avec des marqueurs ponctuels et leurs étiquettes HTML.

Les textures, modèles et shaders sont générés localement, sans requête vers un service graphique. Les contours France et pays voisins viennent de [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), données du domaine public distribuées par [world-atlas 2.0.2](https://github.com/topojson/world-atlas). Les reliefs, parcelles, bâtiments et positions secondaires sont un décor de simulation, pas des données cadastrales ou un relevé d'équipements.

Cette correction augmente la profondeur, la netteté et la variété du rendu réel. Elle reste un diorama procédural : la finesse des matériaux, la densité architecturale et la richesse des modèles n'égalent pas encore les images de référence. Les captures du navigateur, et non les maquettes, montrent le résultat livré.

## Captures comparatives du navigateur

Les vues initiales utilisent la version 12, seed 0, ambition `equilibre`, sans décision. Le viewport et le framebuffer figurent dans les JSON portant le même nom que chaque vue.

| Format | Avant correction | Après correction | Sujet ouvert |
| --- | --- | --- | --- |
| Ordinateur, 1779 × 1016 | [Avant](mandats-diorama/screens/avant-desktop.png) | [Après](mandats-diorama/screens/apres-desktop.png) | [Lycées](mandats-diorama/screens/apres-desktop-sujet.png) |
| Téléphone, 390 × 844, DPR 2 | [Avant](mandats-diorama/screens/avant-mobile.png) | [Après](mandats-diorama/screens/apres-mobile.png) | [Lycées](mandats-diorama/screens/apres-mobile-sujet.png) |
| Téléphone, 320 × 740, DPR 2 | [Avant](mandats-diorama/screens/avant-compact.png) | [Après](mandats-diorama/screens/apres-compact.png) | [Lycées](mandats-diorama/screens/apres-compact-sujet.png) |
| WebKit, 390 × 844, DPR 2 | | [Après](mandats-diorama/screens/apres-webkit.png) | [Lycées](mandats-diorama/screens/apres-webkit-sujet.png) |

[L'inspection d'une mobilisation lycéenne](mandats-diorama/screens/inspection-mobilisation.png) montre les façades et les personnes dans le jeu. Les [entrées de cette partie](mandats-diorama/screens/inspection-mobilisation.json) sont importables : le regroupement adopté provoque le mouvement, puis « Voir le lieu » ouvre le cadrage rapproché. Aucun solde, vote ou mouvement dérivé n'a été injecté pour la capture.

La [vue nationale avec un chantier financé à Rennes](mandats-diorama/screens/inspection-chantier.png) utilise une autre partie réelle, seed 1, après l'adoption de `renover-service`. Ses [entrées importables](mandats-diorama/screens/inspection-chantier.json) reconstruisent le projet `service-rives`. La grue représente son statut financé, avant livraison ; cette capture ne montre pas une inspection rapprochée du chantier. Le marqueur d'un projet ouvre son suivi ; le contrôle « Voir le lieu » concerne le sujet ouvert.

## Contrats techniques à préserver

- Le moteur déterministe, les votes, le financement, les délais, les sauvegardes et le rejeu conservent leurs règles. La scène traduit cet état.
- Ouvrir un sujet, déplacer la caméra, inspecter un lieu, redimensionner ou reprendre une partie ne consomme aucune décision.
- Le canvas et la caméra persistent entre les choix. Le changement de décor ne remonte pas tout le jeu.
- Le mouvement réduit présente le même état sans déplacement imposé ni boucle décorative. Un onglet masqué suspend le rendu.
- Sans WebGL ou après perte du contexte, la carte de repli et les choix restent utilisables au clavier et au toucher.
- Chaque nouveau média local et chaque shader nécessaire rejoint la préparation hors connexion. Le précache actuel découvre les imports JavaScript ; les URL de textures doivent être incluses explicitement.
- Les nouvelles représentations géographiques, textures et modèles documentent leur provenance. Le décor ne présente pas un chantier simulé comme un équipement réel observé.

## Validation et reproduction

Le test `a high density display keeps the 3D map sharp through resize and saved resume` de `site/tests/mandats-rework.test.mjs` utilise un vrai contexte DPR 2 et mouvement réduit. Il vérifie la résolution du canvas, la sélection des sujets depuis les marqueurs, la persistance du canvas après redimensionnement, puis une décision réellement sauvegardée, rechargée et reprise sans tour supplémentaire. Il conserve des captures et un JSON comprenant le viewport, le framebuffer, le DPR et les entrées permettant de rejouer la partie.

Son exécution contre le serveur de développement sur le code précédent échoue effectivement sur la résolution. La preuve initiale est conservée sous `/workspace/mandats-verification/dpr-before/`, avec rapport HTML, trace, capture et données de reproduction. Le même parcours contrôle maintenant aussi le zoom molette puis le redimensionnement sur ordinateur. Avant correction, ce cadrage passe réellement d'un rayon 17 à 23,6 ; cette seconde régression est conservée sous `/workspace/mandats-verification/wheel-resize-before/`.

Les parcours rework et sociaux s'exécutent sur bureau, 390 px, 320 px et WebKit. Ils conservent la carte initiale, un sujet ouvert, une mobilisation, un chantier, une inspection rapprochée et une reprise de sauvegarde. Le parcours hors connexion utilise le précache reconstruit. Le test de perte réelle WebGL finance une rénovation adoptée après la perte, ouvre un autre sujet depuis la carte de repli, puis reprend la sauvegarde en 3D avec le même projet, vote et tour. Il collecte les erreurs de page. Les rapports sont dans `site/rework-artifacts/` et `site/social-artifacts/`, ainsi que dans les artefacts du contrôle CI `rework-e2e`.

Le 8 octobre 2026, `npm run check` réussit sur le code corrigé : 1 082 tests existants, contrôles TypeScript, build et précache de 78 ressources. Le bundle Mandats atteint 515,19 kB gzip ; le build conserve son avertissement de taille. Aucun média distant ni nouvelle dépendance n'est ajouté.

Une [mesure de chargement sur le build produit](mandats-diorama/runtime-desktop.json) conserve le profil, les empreintes des assets, les temps de navigation, les ressources transférées et les métriques CDP : premier rendu Babylon observé après 6,24 secondes, environ 898 kB encodés pour 23 ressources, mémoire JavaScript utilisée de 105,55 MiB. Cette observation unique concerne Chromium headless avec SwiftShader, sur la machine cloud et une origine locale ; elle ne prédit pas le temps de chargement ou la consommation totale sur un téléphone.

Les captures réellement inspectées montrent un framebuffer de 1399 × 948 sur ordinateur DPR 1, de 780 × 760 pour 390 × 379,8 pixels CSS sur téléphone DPR 2, de 640 × 622 pour 320 × 310,8 pixels CSS au format compact, et de 780 × 760 dans WebKit DPR 2. Ces quatre captures ne produisent aucune erreur de page. Les textes et choix restent lisibles ; le troisième choix du format 320 px demande un court défilement. WebKit interdit le port 4190 avant le chargement du jeu : utiliser 4180 pour les suites et 4191 pour une preview de capture.

Les mesures Chromium avec SwiftShader documentent le fonctionnement du navigateur de test. Le temps de rendu d'une capture, qui peut inclure la préparation des ombres et shaders, ne mesure pas une cadence stable. La mémoire JavaScript ne couvre pas la mémoire GPU. Un téléphone physique reste nécessaire pour conclure sur la fluidité mobile ; l'attrait et la difficulté du jeu demandent des parties avec des joueurs.
