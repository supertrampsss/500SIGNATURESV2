# Audit de lancement de 500 Signatures

Audit du 3 octobre 2026. Périmètre : site public gratuit, données, Dossiers,
Salaires et Mandats. Il n'existe pas de souscription SaaS dans le produit actuel.

## Décision

La monétisation et la mesure produit ne sont pas prêtes. Le suivi de base
Cloudflare est présent dans les pages inspectées, mais ses données n'ont pas été
lues dans le compte. Aucun GA4 n'est intégré au code et l'accès Analytics manque
dans GSC Wizard. La présence d'un script ne prouve pas la collecte effective.

AdSense : les captures fournies par le propriétaire confirment une demande
d’examen le 19 septembre 2026 à 14:43, la propriété validée et un ads.txt
« Non autorisé ». Le site n’est pas encore approuvé. Le lien du compte confirme
l’identifiant public complet, désormais utilisé dans la configuration de publication.
L’accès direct au compte reste bloqué par la connexion Google.

Les corrections SEO et publicitaires de cette branche doivent passer les contrôles
GitHub, être déployées, puis être vérifiées en production avant d'être déclarées
livrées. L'indexation finale appartient à Google.

## Checklist priorisée

P0 : bloque la diffusion publicitaire ou laisse une erreur technique confirmée.
P1 : nécessaire pour piloter un lancement sérieux. P2 : amélioration après mesure.

| Priorité | Contrôle | Constat au début de l'audit | Traitement / preuve attendue |
|---|---|---|---|
| P0 | SDK publicitaire et consentement | AdSense chargé sur l'accueil avant choix visible | Chargeur statique retiré ; vérification du compte par meta ; SDK désactivé avant CMP configurée |
| P0 | Identité AdSense | Identifiant statique de 15 chiffres, incompatible avec la validation du dépôt | Identifiant réel confirmé par le lien du propriétaire : `ca-pub-6705187262207125` ; déploiement et ads.txt corrigés |
| P0 | Sitemap canonique | `/simulateur` redirige ; `/bilan` sans barre finale redirige ; pages publiques absentes | 33 URL statiques canoniques au build ; Mandats, méthode et confidentialité ajoutés ; alias retirés |
| P0 | Accueil et Ville | Même document initial ; absence de canonique | Documents et canoniques propres ; Ville lisible sans JavaScript |
| P0 | Navigation interne | Le titre d'accueil reste sur France/Ville | Titres, descriptions et partage mis à jour à chaque changement de vue |
| P0 | Pages inexistantes | Le repli SPA peut rendre une page publique sous une URL inventée | `404.html` avec `noindex` ; statut 404 à constater après publication |
| P1 | Search Console | Propriété vérifiée ; sitemap soumis pendant la session | Soumission confirmée, initialement en attente de lecture ; contrôler traitement et inspections après exploration |
| P1 | Indexation | 29 des 31 anciennes URL inconnues de Google, deux états historiques de redirection | Ne pas confondre découverte, impressions et indexation ; suivre les nouvelles adresses canoniques |
| P1 | AdSense : approbation | Captures du propriétaire : propriété validée, examen demandé le 19 septembre, site « En préparation », ads.txt « Non autorisé » | Approbation encore attendue ; republier ads.txt avec le bon identifiant et laisser Google relire |
| P1 | CMP | Aucun adaptateur certifié de consentement intégré | Choisir/configurer la CMP ; tester refus, accord, personnalisation et retrait avant une annonce |
| P1 | Densité publicitaire | Politique d'éligibilité existante, pas de placements réellement intégrés | Un placement éditorial initial ; zéro dans le jeu, les résultats et les sources essentielles |
| P1 | Analytics de base | Beacon Cloudflare configuré présent sur Accueil, France et Mandats inspectés | Ouvrir Web Analytics du projet Pages ; vérifier visites réelles, routes, appareils, pays et exclusions |
| P1 | GA4 | Aucun tag dans le code ou les pages inspectées ; scope Analytics absent de GSC Wizard | Connecter Analytics dans GSC Wizard puis sélectionner la bonne propriété ; connexion et collecte sont deux vérifications distinctes |
| P1 | Mesure produit | Journal Mandats local facultatif ; pas d'envoi automatique | Configurer une mesure consentie des étapes utiles ; événements et paramètres ci-dessous |
| P1 | Mesure publicitaire | Aucun volume livré ou revenu qualifié | Vérifier inventaire atteint, consentement, remplissage, impressions payées et revenu net ; éviter le double comptage |
| P1 | Confidentialité | Page existante, ancienne description du suivi incomplète | Texte aligné sur Cloudflare et la publicité désactivée ; compléter responsable, contact, durées et exercice des droits avec des informations réelles |
| P1 | Mentions de l'éditeur | Identité juridique/contact/hébergeur non validés dans l'audit | Demander les informations de publication exactes ; aucune identité ou adresse inventée |
| P1 | Sécurité HTTP | HTTPS fourni par Cloudflare ; en-têtes applicatifs non explicites | `nosniff`, anti-encadrement et permissions inutiles désactivées ; confirmer après déploiement |
| P1 | Erreurs et disponibilité | CI/build existants ; absence de preuve d'un dispositif d'alerte production | Contrôle HTTP public ajouté au déploiement ; supervision et destinataire d'alertes restent à configurer |
| P1 | Données et sauvegardes | Pré-rendu échoue si publication inaccessible ; parties sauvegardées localement avec export | Conserver ces garanties ; vérifier l'import/export et la restauration avec les parcours CI existants |
| P1 | Fonctionnement public | Accueil, France, recherche et fiche Bordeaux, entrée Mandats inspectés en production | Compléter navigation mobile/clavier, erreurs réseau et hors connexion via les tests existants |
| P1 | Accessibilité | Libellés, saut au contenu, navigation et réduction des animations existants | Ne pas déclarer une conformité RGAA globale ; contrôler les parcours, focus, contrastes et graphiques |
| P1 | Performances | Build : JS principal ~423 ko gzip, Mandats ~158 ko gzip | Lire LCP/INP/CLS réels dans Cloudflare ; analyser le chargement initial avant de découper les bundles |
| P1 | Liens et partage | Dossiers pré-rendus, sources et cartes de partage générées | Contrôle de canonique/H1/statut après déploiement ; test des liens de sources et aperçus sociaux |
| P2 | SEO des villes individuelles | Les fiches sont chargées dans l'explorateur | Définir des URL et documents propres si l'objectif est l'acquisition par nom de ville ; ne pas annoncer toutes les communes comme déjà indexables |
| P2 | Maillage et éditorial | France, Dossiers, questions et guides existent | Relier les contenus selon leurs sujets et demandes de recherche ; dates et données structurées exactes |
| P2 | Acquisition et coûts | Hypothèses commerciales documentées | Mesurer audience récurrente, coût réel et revenu ; aucune prévision traitée comme réalisée |

## Contrat de mesure à mettre en service

La base Cloudflare reste en place. Une instrumentation produit nouvelle ne doit
être activée qu'avec une configuration réelle et le consentement applicable.
La collecte des décisions détaillées, scores politiques, salaires, sauvegardes et
textes saisis est exclue. Les URL transmises doivent être nettoyées des paramètres
et fragments. Le journal local du jeu ne remplace pas un tableau de bord.

| Événement | Quand | Paramètres autorisés |
|---|---|---|
| `page_view` | Ouverture ou changement réel de page publique | Chemin canonique, catégorie de page ; aucune requête/fragments |
| `city_search_used` | Recherche menant à une fiche | Catégorie de parcours ; aucun texte recherché |
| `article_read` | Seuil de lecture défini et atteint une fois | Slug public du dossier ; seuil identique sur les appareils |
| `source_opened` | Activation d'un lien de source | Identifiant public de source, catégorie de page |
| `game_started` | Nouvelle partie effectivement créée | Version et mode ; aucun nom, seed, choix ou état sauvegardé |
| `game_completed` | Fin du parcours, une fois par partie | Version et mode ; aucun verdict politique ou score |
| `share_initiated` | Activation du partage | Catégorie de page ; aucun contenu de sauvegarde |
| `app_error` | Erreur utile au diagnostic | Code d'erreur et route nettoyée ; pas de texte libre ni corps de requête |

Tester la collecte, l'absence de doublons, le refus et le retrait dans le service
destinataire réel. Ne pas compter une décision de jeu comme une page vue.

## Extension de la checklist à un futur SaaS

| Domaine | Contrôles avant ouverture | 500 Signatures actuel |
|---|---|---|
| Comptes | Inscription, connexion, reset, MFA admin, fermeture de compte | Aucun compte lecteur ; non applicable |
| Autorisations | Isolation des clients, rôles, droits de chaque API | Pas de clients SaaS ; non applicable |
| Paiements | Prix, TVA, essais, remboursements, annulation, relances, webhooks idempotents | Pas d'abonnement ; non applicable |
| Données privées | Minimisation, chiffrement, export/effacement, conservation, prestataires | Ne pas transmettre les saisies et sauvegardes du lecteur |
| Exploitation | Sauvegarde et restauration vérifiées, rollback, erreurs, alertes, support | Contrôle de publication ajouté ; dispositifs d'alerte à compléter |
| Courriels | SPF/DKIM/DMARC, délivrabilité, liens de reset, notifications | Aucun envoi transactionnel lecteur ; non applicable |
| Anti-abus | Limites, quotas, rate limiting, fichiers téléversés, coût des API | Pas d'API payante lecteur ni uploads serveur identifiés |
| Qualité | Mobile, clavier, navigateur, réseau dégradé, parcours critiques | Suites existantes et parcours de lancement ajoutés |

## Vérifications et commandes

- `npm test` : 105 fichiers de tests exécutés, tous réussis localement.
- `npm run build` : types, client, pré-rendu sur données publiques, guides et hors connexion réussis.
- `validerIndexation(dist, 'https://500signatures.fr')` : 33 documents canoniques vérifiés après ajout des guides.
- Deux parcours E2E ajoutés : navigation et métadonnées sans publicité, Ville sans JavaScript. Captures produites par Playwright dans les artefacts CI.
- L'installation locale des moteurs Playwright a renvoyé une archive vide ; l'aperçu cloud local a été bloqué par le navigateur. Ces tests locaux n'ont donc pas été déclarés réussis ; les contrôles CI restent requis.
- `npm run check:production` : HTTP 200, canonique exacte, absence de noindex, titre/H1, absence de chargeur publicitaire initial, nosniff, sitemap/robots, vraie 404 et redirection historique.

### Références de configuration

- [Google : sitemap et URL canoniques](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google : contrôle des doublons](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Cloudflare : activation Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/)
- [Cloudflare : mesure des SPA](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/)
- [Cloudflare : les query strings ne sont pas journalisées par Web Analytics](https://developers.cloudflare.com/web-analytics/faq/)
- [Google : mesure GA4 des SPA et contrôle des doublons](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications)
- [Google : vérification d'un site AdSense, y compris par meta](https://support.google.com/adsense/answer/12169212?hl=fr)
- [Google : CMP certifiées pour publicité personnalisée](https://support.google.com/adsense/answer/13554116?hl=fr)

La checklist est un suivi technique et produit. Elle ne vaut pas audit juridique
ou certification de sécurité/accessibilité.
