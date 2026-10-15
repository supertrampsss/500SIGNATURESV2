# Référencement, accès IA et préparation AdSense — 15 octobre 2026

## État constaté avant correction

Les 35 URL du sitemap public répondent HTTP 200, avec une canonique propre et un
H1 visible. Les requêtes de contrôle portant les agents Googlebot, OAI-SearchBot,
ChatGPT-User et PerplexityBot reçoivent aussi HTTP 200 ; ce contrôle ne simule pas
leurs adresses IP. `robots.txt` autorise l’exploration. `llms.txt` répond 404.
`ads.txt` publie le compte réel `pub-6705187262207125`.

La capture Search Console fournie pendant cet audit indique 25 pages détectées
mais non indexées, trois pages avec redirection, deux exclues par `noindex`, zéro
doublon avec une canonique Google différente et zéro page explorée non indexée.
Les URL d’exemple ne sont pas disponibles : une ancienne adresse redirigée ou une
page technique exclue peut être normale. Les 35 pages du sitemap ne portent pas
de `noindex` dans leur HTML initial. Il ne faut pas supprimer des redirections
utiles pour faire disparaître un état de rapport.

AdSense a notifié un nouveau refus le 13 octobre. Le propriétaire confirme le
motif actuel « Contenu à faible valeur informative ». Ce refus ne se résout pas
par le seul fichier ads.txt. Les annonces sont désactivées ; aucun adaptateur de
diffusion, bloc publicitaire réel ou branchement CMP certifié n’est déployé.

Le connecteur GSC Wizard refuse les lectures car son abonnement a expiré. Cela
empêche de confirmer l’indexation et les performances actuelles dans Google.
Ne pas présenter les anciennes inspections du 4 octobre comme l’état actuel.

## Risques à vérifier avant livraison

- Le guide IA peut annoncer une adresse absente, redirigée ou non canonique,
  dériver du corpus publié ou confondre simulation et données observées.
- Un changement de contenu peut disparaître après le montage JavaScript,
  masquer la recherche Ville ou casser un lien du menu compact.
- Une FAQ peut répéter du texte sans aider le lecteur, imposer un défilement
  avant l’outil, ou devenir illisible au clavier et à 320 px.
- Un guide Mandats peut encore envoyer vers une ancienne campagne sans le dire,
  ou décrire un nombre de décisions différent de la campagne actuelle.
- Les liens internes peuvent encore privilégier une variante qui redirige.
- Une balise de vérification AdSense peut être confondue avec une autorisation
  de diffusion, ou le consentement Analytics avec une CMP publicitaire.

Les vérifications portent sur les fichiers publiés, les réponses HTTP, les liens
et les vrais parcours navigateur. Elles ne constituent pas une promesse de
classement, de citation par une IA, d’approbation AdSense ou de revenu.

## Règles de contenu appliquées

La page France reste le pilier des finances publiques, relié aux dossiers sur
la dépense, les prélèvements, les retraites et la défense. Les réponses courtes
et les dossiers gardent leurs intentions distinctes. Aucun volume de recherche,
trafic, auteur expert ou témoignage n’est inventé. Les pages d’usage existantes
sont renforcées ; aucun ensemble de pages quasi identiques n’est créé.

Les introductions disent ce que le lecteur peut réellement faire. Les questions
répondent aux difficultés de lecture, d’utilisation et de vérification. Les
sources, périodes et hypothèses restent explicites. Le jeu conserve la carte
illustrée approuvée et ses règles.

## Carte thématique et intentions

500 Signatures est un service gratuit de lecture des données publiques et un
jeu de simulation politique. L’objectif de conversion est d’ouvrir un outil,
de lire un dossier ou de vérifier une source. Le vocabulaire d’achat SaaS n’est
pas transposé artificiellement à ce projet.

Ces expressions sont des hypothèses sémantiques, sans volumes mesurés. Les H1
ci-dessous sont ceux des pages publiées. Les dix clusters détaillés et les
treize dossiers de soutien sont documentés dans
[le plan éditorial du 4 octobre](seo-editorial-2026-10-04.md).

| Type de page et adresse | H1 | Expression ciblée | Intention principale |
|---|---|---|---|
| Pilier, `/bilan/` | Les comptes de la France. | budget et dette publique France | Information : lire les comptes nationaux |
| Outil, `/territoire/` | Les comptes de votre ville, en clair. | budget d’une commune | Usage : trouver une commune et son exercice |
| Outil, `/salaires/` | Du coût du travail au revenu reçu. | coût employeur salaire net | Usage : lire la décomposition d’un profil |
| Index, `/analyses/` | Dossiers | analyses de données publiques | Exploration : choisir une question documentée |
| Réponses, `/questions/` | Comprendre les chiffres du quotidien | chiffres du quotidien France | Information : obtenir une réponse bornée et sa source |
| Jeu, `/mandats/` | Prenez les rênes du pays. | jeu de simulation politique gratuit | Usage : commencer une partie |
| Guide, `/mandats/comprendre/` | Comment jouer à Mandats ? | règles Mandats simulation politique | Information : comprendre la campagne avant de jouer |
| Document de confiance, `/sources/` | Sources | sources données publiques 500 Signatures | Vérification : retrouver producteurs, périodes et limites |

Le pilier France renvoie aux dossiers sur les dépenses, les prélèvements, les
retraites et la défense. Les réponses courtes conduisent au dossier détaillé et
à ses graphiques. Les aides d’accueil et Ville relient le besoin pratique aux
sources. Le guide de jeu renvoie aux données observées pour les lire séparément
des conséquences fictives. Une variante de formulation ne crée pas une nouvelle
URL.

## Briefs appliqués aux pages d’usage

**Accueil.** L’introduction répond désormais directement : « 500 Signatures
permet de lire les comptes publics de la France et des communes, de comprendre
les chiffres du quotidien et de jouer un mandat politique simulé. L’accès est
gratuit. » Le H1 visuel validé est conservé. Les trois portes France, Ville et
Dossiers précèdent le jeu. En fin de page, les questions traitent la recherche
d’une commune, la citation d’un chiffre, la simulation et l’accès sans compte.

**Ville.** La réponse d’entrée nomme recettes, dépenses, dette et population,
puis demande une recherche de commune. La FAQ explique la sélection dans les
résultats, les comparaisons à exercice et périmètre identiques et la différence
entre valeur absente et zéro. Le vocabulaire utile est « exercice », « par
habitant », « intercommunalité », « source » et « couverture ». Aucun exemple de
ville n’est sélectionné à la place du lecteur. Sans JavaScript, le besoin de
l’activer pour l’outil est indiqué, avec accès aux sources et comptes nationaux.

**Guide Mandats.** Le premier paragraphe décrit le jeu gratuit et ses trente
décisions possibles sur cinq ans. Les H2 distinguent conséquences d’un choix,
repères de finances publiques et questions sur le jeu. Les H3 répondent à la
durée, au compte, au transfert de sauvegarde, au hors connexion et au caractère
fictif. Les liens ouvrent la campagne nationale actuelle ; les anciens scénarios
municipaux sont nommés comme tels et leur indisponibilité est explicite. Le vocabulaire reste celui du produit : vote,
projet, promesse, mobilisation, effet immédiat ou différé.

## Critique concrète et corrections

- L’accroche d’accueil, seule, n’expliquait pas l’usage. Une phrase concrète
  décrit maintenant les trois fonctions et la gratuité.
- L’aperçu de mandat pouvait être lu comme une mesure réelle. Il porte désormais
  « Exemple fictif de mandat ».
- Le guide d’entrée présentait quatre notions budgétaires sans expliquer la
  campagne actuelle. Il donne maintenant le déroulement, les conséquences et
  les réponses pratiques avant de conduire au jeu. Les quatre guides renvoient
  à la campagne nationale disponible et expliquent l’indisponibilité du mandat
  communal, au lieu d’inviter à un parcours bloqué.
- Les pages d’entrée Ville et accueil ne répondaient pas aux principales
  difficultés de vérification. Les aides ajoutées traitent ces cas, sans
  remplissage destiné à atteindre un nombre arbitraire de mots.
- Le contrôle navigateur a révélé une mise en page d’accueil dépendante de
  JavaScript malgré son texte pré-rendu. Le HTML initial porte maintenant son
  état visuel et la navigation issue du module partagé. Ville reçoit le même
  traitement. Les liens et les dépliants restent utilisables sans script.
- Certaines ancres internes pointaient vers une adresse qui redirige. Les
  liens publics France et Ville concernés visent leur canonique avec slash.
- La page projet évoquait encore un examen AdSense en cours. Elle décrit
  désormais seulement le fait vérifiable : les annonces ne sont pas diffusées.

Les dossiers sourcés et les outils interactifs constituent la valeur propre du
site. Ces améliorations rendent cette valeur plus accessible ; elles ne prouvent
ni l’intérêt utilisateur dans la durée ni l’acceptation par l’équipe AdSense.

## Préparation technique et limites Google

Le build produit `llms.txt` depuis les 35 pages du sitemap final et vérifie leur
titre, description, canonique et absence de `noindex`. Le guide distingue données
observées et simulation. Les données structurées d’accueil décrivent le site et
le projet avec leurs liens publics existants, sans expert ou évaluation inventés.
Le contrôle de production refuse désormais un guide absent ou divergent du
sitemap. Les FAQ visibles sont du HTML natif ; elles ne dépendent pas de JSON-LD.

Pour Search Console, il reste à examiner les URL concernées par les trois
redirections et les deux exclusions, puis à contrôler la réexploration des 25
pages découvertes. Le sitemap et les canoniques ne forcent pas l’indexation.
Le connecteur étant bloqué, aucune nouvelle soumission ni demande d’indexation
dans le compte Google n’est annoncée comme réalisée.

Pour AdSense, le compte de publication et `ads.txt` sont correctement déclarés.
Le refus pour faible valeur informative reste le statut connu. Un nouveau
réexamen relève de Google après la publication des améliorations ; aucun succès
n’est acquis. Avant la diffusion effective, il faut aussi configurer de vrais
blocs, intégrer le consentement publicitaire requis et vérifier les appels réseau,
les espaces vides et la stabilité du rendu. La mesure d’audience facultative
existante n’est pas une CMP AdSense. Le jeu et ses résultats restent sans publicité.

## Validation locale

- `NODE_USE_ENV_PROXY=1 ADSENSE_PUBLISHER_ID=ca-pub-6705187262207125 npm run check` :
  1 082 tests réussis, aucun échec, trois contrôles TypeScript et build complet.
- Parcours SEO, audience, lancement et confiance dans cinq formats Chromium et
  WebKit : 61 réussis, quatre répétitions du contrôle HTTP ignorées. Les 35 pages
  sont contrôlées une fois, plutôt que cinq fois pour le même corpus statique.
- En-tête partagé : trois parcours réussis, 320 px, 390 px et 1 440 px, avec
  navigation répétée et accès au site depuis le menu du jeu.
- Dernier contrôle SEO et parcours des quatre guides : 16 réussis, quatre
  répétitions HTTP ignorées. Contrat des destinations publiques : deux réussis.
- Inspection des pages complètes accueil, Ville et guide, avec et sans
  JavaScript, sur ordinateur, 390 px et 320 px. Les captures et les mesures
  publiques sont conservées dans [les preuves locales](seo-ia-adsense-2026-10-15/README.md).

Les premiers essais ont révélé le défaut de style sans script et des attentes de
tests visant encore les anciennes ancres. Le style pré-rendu a été corrigé et
les attentes alignées sur les URL canoniques. Aucun délai ni mécanisme de
validation n’a été relâché. Le thème clair du guide est aussi déclaré dans son
HTML initial pour garder sa lisibilité sans script.

Le déploiement et les vérifications publiques après fusion sont des étapes
distinctes ; leur résultat est à lire dans la PR et le workflow de déploiement.
Les performances réelles, impressions et clics ne sont pas accessibles ici. Une
limite de taille de bundle signalée par Vite demeure ; le build seul ne permet
pas de conclure aux Core Web Vitals des visiteurs.

## Références vérifiées

- [Google : optimisation pour ses fonctions d’IA](https://developers.google.com/search/docs/appearance/ai-features).
- [Mises à jour Google : précisions llms.txt et retrait des résultats FAQ, juin 2026](https://developers.google.com/search/updates#june-2026).
- [OpenAI : OAI-SearchBot, GPTBot et ChatGPT-User](https://developers.openai.com/api/docs/bots).
- [AdSense : contenu original et expérience utilisateur](https://support.google.com/adsense/answer/10015918?hl=fr).
- [AdSense : exigences de CMP pour les annonces personnalisées](https://support.google.com/adsense/answer/13554116?hl=fr).

`llms.txt` est un guide de lecture pour les services qui le consultent. Google
indique qu’il n’améliore ni ne dégrade son classement. Les FAQ restent utiles au
lecteur ; aucun résultat enrichi FAQ Google n’est promis.
