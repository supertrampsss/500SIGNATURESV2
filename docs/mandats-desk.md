# MANDATS : le bureau du pouvoir

La v17 nationale adopte la direction « Le bureau du pouvoir » choisie le 29 octobre 2026 : table en noyer, carte illustrée en relief, dossier ivoire et accès permanents aux grandes réformes, au gouvernement et au bilan. Le sujet conseillé est directement actionnable sur ordinateur. Sur téléphone, la vue initiale conserve le pays et ses six secteurs.

L'implémentation locale et le nettoyage sont vérifiés. La version n'est pas encore publiée. Le contrôle complet du pré-rendu éditorial et les parcours WebKit restent bloqués par la politique réseau de cet environnement ; les résultats locaux ne remplacent pas ces contrôles requis.

## Vérifications finales

Le client final utilise le cache `8eb0cc45c612f23b`, avec 37 ressources. Les sources et fichiers compilés n'ont pas changé pendant les derniers parcours. Le [relevé de vérification](mandats-desk/verification.json) conserve leurs empreintes, les commandes, rapports, entrées et limites de chaque exécution.

| Contrôle après nettoyage | Résultat |
| --- | --- |
| `npm run check:local` | 1 158 tests réussis ; types applicatifs, scripts et fonctions vérifiés ; client compilé |
| Bureau, quatre formats Chromium | 14 réussites, 2 omissions voulues du cas de focus propre au téléphone |
| Vdef ciblé, quatre formats Chromium | 20 réussites, dont aperçu partagé en paysage, six repères, rectangles, objectifs et vote conservé |
| Compatibilité v12 | 5 réussites, 1 omission voulue : illustration, clavier sans WebGL et reprise d'un mouvement hors connexion |
| Export, rechargement, import v16, rejeu et hors connexion v17 | 3 réussites, 1 omission voulue ; livraison ministérielle réelle hors connexion |
| Total navigateur final | 42 réussites sur 46 cas sélectionnés, 4 omissions prévues, aucun échec ni résultat instable |

Les quatre omissions évitent de répéter sur ordinateur des parcours spécifiques au téléphone ou un cycle hors connexion déjà exécuté sur mobile. Les contrôles de visibilité complète et de cible cliquable sont restés stricts.

Les audits bornés du modèle ont aussi réussi : v17, 36 trajectoires, 114 branches et 138 539 contrôles d'invariants ; v16, 69 trajectoires, 652 branches et 140 420 contrôles. La fixture historique v16 conserve ses 13 trajectoires et 572 transitions. Les sources du modèle auditées correspondent toujours aux sources finales. Deux stratégies présidentielles complètes ont abouti avec des compromis financiers et de services différents.

Une ouverture de 183 secondes a été jouée en temps réel à ×1 avant les derniers ajustements de présentation. Un investissement santé de 4,98 Md€ a été engagé sans avance du calendrier, puis livré à la période 3. Le parcours atteint la période 5, consulte le Bilan et reprend le pays, sans erreur JavaScript ni débordement horizontal observé. Vidéo et entrées légales : `site/desk-artifacts/playthrough/`. Cette observation par agent et les audits bornés ne constituent ni un test utilisateur humain, ni une validation du plaisir de jeu, ni une exploration exhaustive des trajectoires.

Les essais intermédiaires ont permis de corriger le défilement des choix, les collisions de repères, le focus après une décision consommée, les détails du gouvernement et l'accès au bulletin dans un aperçu partagé en paysage. Des attentes de tests liées à l'ancienne présentation ont été adaptées en conservant les montants, objectifs, cibles réelles et sauvegardes contrôlés. Leurs échecs et reprises restent dans le relevé ; ils ne décrivent pas l'état final.

## Décider avec moins de gestes

À partir de 651 px de large, le dossier conseillé s'ouvre dès l'arrivée. Le téléphone conserve d'abord la vue générale. Une réponse s'engage par un clic sur sa carte, avec son coût, son délai et ses effets visibles, sans confirmation supplémentaire. Sélectionner de nouveau le secteur ou l'événement actif maintient sa lecture ; la fermeture reste explicite.

Grandes réformes conserve les six accès sectoriels, retire les accordéons qui répétaient leurs interventions structurelles et déplie le premier sujet national actionnable. Les autres lois restent accessibles.

| Intention depuis la vue initiale | Avant cette revue | Parcours retenu |
| --- | --- | --- |
| Répondre au sujet conseillé sur ordinateur ou paysage | Ouvrir puis choisir : 2 clics | Choisir dans le dossier ouvert : 1 clic |
| Répondre au sujet conseillé sur téléphone | Ouvrir puis choisir : 2 clics | 2 clics, en conservant la vue générale |
| Décider sur le premier sujet national actionnable | Ouvrir les réformes, déplier, choisir : 3 clics | Ouvrir les réformes puis choisir : 2 clics |
| Changer de secteur puis agir | Choisir le secteur puis la réponse : 2 clics | 2 clics ; le secteur actif ne referme plus le dossier |

Ces comptes excluent la lecture et le défilement éventuel. Une ouverture ne donne aucun ordre et ne dépense pas de crédits.

## Périmètre et nettoyage

Les chiffres et événements de la référence sont fictifs. Tous les textes, dates, repères, réponses et montants du jeu restent des éléments HTML issus de l'état sauvegardé. Le déficit provient des comptes annuels simulés ; la confiance est affichée sur 100. Les illustrations ne contiennent aucun contrôle ni valeur de partie. Le [manifeste des illustrations](mandats-desk/artwork.json) conserve leur provenance.

La nouvelle présentation est limitée à `.presidency--desk`, en v17. Les règles du mandat, son financement, ses votes et sa durée de cinq ans sont conservés ; atteindre la dernière période ne suffit pas à atteindre les objectifs. Les versions explicites 1 à 16, les sauvegardes, les liens, le rejeu et les parcours municipaux conservent leurs règles.

Le [manifeste du nettoyage](mandats-desk/cleanup.json) recense 153 fichiers suivis retirés, soit 111 904 223 octets, dont 44 modules 3D inaccessibles depuis les entrées Vite et leurs ressources ou recettes exclusives. Ce volume mesure les fichiers retirés, pas un gain réseau constaté chez les joueurs. Six dépendances directes inutilisées ont été retirées : Babylon core/loaders, Delaunator, Earcut et les deux paquets de types associés. Earcut reste nécessaire transitivement à MapLibre. Aucun test n'a été supprimé.

Les imports, scripts, workflows et points d'entrée ont été rapprochés du manifeste sans consommateur actif résiduel relevé. `npm ls --depth=0`, les types et `git diff --check` ont réussi. Le placement v17 devenu inaccessible, les imports répétés et les sélecteurs sans élément correspondant ont été retirés. La feuille du bureau compte 679 lignes après retrait de 48 lignes inutilisées ; deux règles anciennes qui masquaient le bulletin en paysage ont été supprimées. Les deux décors SVG orphelins ont quitté le cache, qui garde les illustrations du bureau.

Une revue statique indépendante n'a pas relevé d'anomalie supplémentaire. Elle a vérifié les consommateurs, les dépendances et le lockfile, l'identité du type `VisualState` déplacé et la conservation des règles et formats de sauvegarde. Elle complète les parcours navigateur sans constituer une preuve exhaustive d'absence de régression.

## Référence et captures réelles

La [référence retenue](mandats-desk/reference.png) est conservée avec les captures du client final dans Chromium. Les PNG ont été convertis en WebP qualité 95, sans recadrage, redimensionnement ni retouche. Le relevé contient les empreintes des originaux et conversions, les dimensions et les entrées de rejeu.

| Vue | Capture | Entrées légales |
| --- | --- | --- |
| Avant refonte, 1672 × 941 | [Commit e4dd50a](mandats-desk/bureau-avant.webp) | [JSON](mandats-desk/bureau-avant-inputs.json) |
| Dossier conseillé ouvert, 1672 × 941 | [Bureau ordinateur](mandats-desk/bureau-ordinateur.webp) | [JSON](mandats-desk/bureau-ordinateur-inputs.json) |
| Vue initiale, 390 × 844 | [Bureau mobile](mandats-desk/bureau-mobile.webp) | [JSON](mandats-desk/bureau-mobile-inputs.json) |
| Investissement santé, 320 × 568 | [Dossier petit téléphone](mandats-desk/dossier-petit-telephone.webp) | [JSON](mandats-desk/dossier-petit-telephone-inputs.json) |
| Comptes en cours de mandat, 1672 × 941 | [Bilan ordinateur](mandats-desk/bilan-ordinateur.webp) | [JSON](mandats-desk/bilan-ordinateur-inputs.json) |

L'avant utilise la seed 1092, l'après la seed 0 : ces images comparent la composition visuelle, sans prétendre montrer une trajectoire identique. Les quatre images après refonte correspondent au cache final et ont été inspectées.

## Risques qui ont guidé les parcours

1. Recopier les chiffres fictifs de la maquette : rapprocher le déficit et la confiance du décodeur public, puis d'une autre trajectoire.
2. Couper un dernier choix ou couvrir les réformes sur 320 px : ouvrir une crise réelle, défiler et vérifier la cible complète.
3. Perdre la pause ou le focus : la lecture détaillée et les panneaux suspendent le temps ; le dossier sectoriel simple garde le comportement v17, sans rattrapage à la reprise.
4. Afficher un ordre avant sauvegarde ou l'engager deux fois : vérifier l'écriture durable, les échecs de stockage, l'unicité et le coût réellement engagé.
5. Oublier l'art du bureau dans le cache : recharger hors connexion et observer une livraison financée.
6. Casser un ancien mandat par une couche CSS : conserver les règles versionnées et rejouer les parcours historiques.
7. Confondre Bilan et fin du mandat : consulter les comptes ne doit ni terminer la partie ni avancer le calendrier.
8. Superposer les repères : mesurer les rectangles réels sur plusieurs trajectoires et formats. Les petits jetons gardent des noms accessibles et six raccourcis visibles.
9. Déclencher une décision à l'ouverture directe : vérifier un seul engagement explicite, sans avance du calendrier, et conserver la vue initiale du téléphone.
10. Perdre un secteur ou une loi en retirant les doublons : vérifier les six accès et le premier sujet national actionnable, sans retirer les autres sujets.
11. Refermer un sujet actif par une nouvelle sélection : maintenir la lecture en v17 et garder la fermeture explicite.
12. Couvrir le bulletin par l'adoption d'un aperçu : conserver le bandeau dans le dossier défilant et vérifier les quatre formats, sans changer le bandeau historique.
13. Retirer un ancien chemin encore utilisé : vérifier tous ses consommateurs, y compris scripts et ressources hors connexion. L'absence d'appel depuis la nouvelle vue ne suffit pas à prouver qu'un module est mort.

## Reproduire et limites de l'environnement

Depuis `site/`, construire le client et son cache avant les parcours :

```sh
npm run check:local
node --experimental-strip-types scripts/mandats-assets.ts
node --experimental-strip-types scripts/mandats-offline.ts
npx playwright test --config playwright.desk.config.ts
npx playwright test --config playwright.vdef.config.ts
npx playwright test --config playwright.strategy.config.ts
```

Les configurations complètes comprennent WebKit. Les exécutions locales ont sélectionné les projets Chromium et utilisé `MANDATS_CHROMIUM_EXECUTABLE=/usr/bin/chromium`, version 151.0.7922.173. Les rapports détaillés précisent phases, sélections et formats ; le workflow CI conserve leurs artefacts. Les contrôles généraux prescrits par [AGENTS.md](../AGENTS.md) restent applicables.

`npm run check` s'arrête au pré-rendu éditorial, faute d'accès à `pub-fc39d357004540a182a907aed4875ef5.r2.dev/data/derniere.json`. Le téléchargement WebKit depuis `cdn.playwright.dev` est également refusé par la politique réseau. Aucun pré-rendu complet ni résultat WebKit local réussi n'est revendiqué.

La politique effective ne charge que le preset `package_managers`, sans hôte personnalisé. Le brouillon prévoyant R2, le CDN Playwright et l'API GitHub n'est pas publié. Le fetch Git public a réussi ; l'API GitHub reste hors politique active. Cela ne permet pas de conclure que les identifiants sont invalides. L'état de publication est distinct des tests locaux : aucun déploiement en production n'est validé par ce document, et les contrôles requis ne doivent pas être contournés.
