# 500signatures : produit et financement publicitaire

Décision du propriétaire, 7 septembre 2026 : **la publicité est le modèle économique
central du site**. L'accès à la lecture, aux outils et au jeu reste gratuit.
Ce document remplace les anciennes priorités économiques de
`docs/mandats/STRATEGIE.md` et la proposition d'ateliers payants.

Les volumes, tarifs et coûts ci-dessous sont des **hypothèses de travail**.
Aucun export d'audience, compte de régie validé, revenu ou contrat publicitaire
n'est disponible dans le dépôt. « Central » désigne un scénario de calcul, pas une
prévision statistique ni un RPM constaté sur 500signatures.

## Décisions UX, DX et AX conservées

| Décision | Effet utilisateur | Effet développeur et agent |
|---|---|---|
| France, Allemagne, Espagne et Italie seulement, données comparables | Courbes lisibles et cohérentes avec le texte | Liste partagée `PAYS_VISIBLES` |
| France en évidence dès quatre courbes | Série de référence repérable | Style indépendant du nombre de voisins |
| Dates et années fiscales en UTC | Source identique quel que soit le lecteur | Tests reproductibles dans plusieurs fuseaux |
| `check:local` distinct du pré-rendu complet | Corrections plus fiables | Contrôle local explicite, mêmes contrôles complets en CI |
| Une règle publicitaire et un calcul documentés | Densité limitée, scores et chiffres indépendants des annonceurs | Routes autorisées, plafonds et hypothèses testables |

La campagne nationale conserve ses 45 décisions sur cinq ans, le clic direct,
la position de lecture et les sauvegardes. Le cadre externe Europe et le bouton
d'ajout des pays restent supprimés.

## Où : des emplacements précis, peu nombreux

**Démarrage : une annonce maximum par page éditoriale admissible.**
Après validation, deux au maximum sur les pages longues, avec au moins deux
hauteurs d'écran de contenu entre elles. Salaires reste limité à une seule.
Le premier écran présente toujours le site et une réponse utile.

| Parcours actuel | Emplacement initial | Extension éventuelle | Zone protégée |
|---|---|---|---|
| France, `/bilan` | Après le chapitre Recettes complet, `#france-entrees` | Après le chapitre Europe complet, `.europe-unifiee`, avant les analyses thématiques | En-tête, conclusion, sommaire, intérieur des courbes, légendes et sources |
| Salaires, `/salaires/` | Après l'explication complète de la répartition, `.salaires__allocation` | Aucune | Saisie, statut, résultat et détail du calcul |
| Dossier, `/analyses/<slug>/` | Après la première démonstration complète : texte, graphique, légende et source | Après le corps éditorial, avant les blocs méthode et sources, si la longueur le permet | Titre, réponse en 30 secondes, graphique et commandes |
| Mandats, anciens simulateurs et résultats | Aucun | Aucune | Partie, bilan, partage et reprise |
| Territoires | Aucun au lancement | Réexamen après mesure du parcours | Carte, recherche, fiche et comparateur |
| Accueil, index, réponses courtes, méthode, sources | Aucun au lancement | Réexamen éditorial, jamais automatique | Accès aux références et aux fonctionnalités |

Les dossiers courts n'ont pas de deuxième emplacement. Un repère absent ou une
page trop courte supprime l'opportunité publicitaire, sans inventer un bloc de
contenu. Un retour depuis Mandats peut mener vers France ou un dossier utile :
cette vraie lecture peut être monétisée, sans écran publicitaire intermédiaire.

Ces choix privilégient la lecture répétée et la confiance, nécessaires à la valeur
de l'audience. Aucun annonceur ne finance une conclusion, une position politique,
un score du jeu ou la modification d'une donnée.

## Quand et comment : règles d'affichage

- **Dans le flux uniquement** : pas de plein écran, fenêtre surgissante, bandeau
  collant, vidéo automatique, son, compte à rebours ou publicité récompensée.
- Libellé visible **« Publicité »**. Pour une vente directe : **« Publicité · Nom
  de l'annonceur »**. La création reste distincte des cartes de données et des
  boutons du site, sans se déguiser en recommandation éditoriale.
- Proposition initiale : bannière horizontale statique, environ **320 × 100 px
  sur mobile**, **728 × 90 px sur ordinateur**, dans un conteneur adapté. Si le
  format ne rentre pas, utiliser un format réellement pris en charge ou supprimer
  l'emplacement ; ne pas comprimer ni rogner une annonce de régie. Une création
  directe peut être une ligne de texte, un logo et un lien, avec dimensions stables.
- Chargement asynchrone lorsque le lecteur approche à **300 px** de l'emplacement.
  Pas de chargement publicitaire global au démarrage du jeu. La première annonce
  ne précède pas le contenu utile et reste sous le premier écran.
- **Un chargement par emplacement et par navigation réelle**. Pas de
  rafraîchissement minuté, ni au changement de salaire, d'année, de pays, d'ancre,
  de thème visuel ou de décision du jeu. Aucun identifiant persistant n'est
  nécessaire pour cette règle de rendu.
- Réserver les dimensions avant une requête autorisée. Ne pas insérer ou retirer
  une annonce au-dessus de la position de lecture. Si un accord arrive en cours
  de lecture, attendre une future zone sous l'écran ou la prochaine navigation.
  Sans campagne ou sans autorisation, aucun grand cadre vide initial. En cas
  d'absence de remplissage, ne pas replier une zone déjà visible sous le doigt.
- Chaque espace vendu directement **remplace** un espace de régie. Il n'ajoute
  ni troisième bloc ni deuxième couche. Une campagne expirée disparaît au prochain
  rendu ; les créations commerciales ne font pas partie du cache hors connexion.

La réservation d'espace répond au risque de décalage de mise en page décrit par
[web.dev](https://web.dev/articles/optimize-cls?hl=fr). La séparation des commandes
et des annonces évite les clics accidentels visés par les
[règles de placement AdSense](https://support.google.com/adsense/answer/1346295?hl=en).

## Quoi vendre, à qui, par quel canal

**Deux canaux, tous deux publicitaires :**

1. **Régie au lancement**, avec AdSense comme premier candidat à tester, sous réserve
   d'acceptation du site. Blocs manuels uniquement ; placements automatiques,
   ancres, vignettes et autres formats superposés désactivés. Une seule régie au
   départ, sans empilement de prestataires. Comparer ensuite le revenu net réel et
   les performances avant d'en changer.
2. **Vente directe d'espaces**, pour augmenter la valeur du même inventaire :
   éditeurs de livres, presse, formations, événements culturels ou pédagogiques,
   outils de données et de travail. Les noms de secteurs sont des cibles de
   prospection, pas des partenaires acquis. Commencer avec un annonceur par
   campagne, une création statique et un périmètre éditorial défini.

Exclure de la charte commerciale la propagande de partis ou de candidats, les paris,
les placements spéculatifs, les promesses financières trompeuses et les créations
qui imitent une alerte ou un service public. C'est un choix éditorial pour ce site.
Ne pas cibler à partir des arbitrages du joueur, du salaire saisi, de ses scores ou
d'une opinion politique supposée. Aucun de ces éléments n'est envoyé à une régie.

**Offre directe à tester : 25 € HT pour 1 000 impressions livrées**, soit **500 € HT
pour 20 000 impressions**, sur environ quatre semaines si l'inventaire le permet.
Ce prix est une hypothèse commerciale, pas un prix de marché constaté.
Le contrat précise les pages, les dates, la création et la définition d'impression.
Ne promettre un volume qu'après mesure sur ces emplacements. En cas de sous-livraison,
facturer le réalisé ou convenir d'un prolongement ; ne pas doubler les annonces.

Une campagne statique servie par le site sans pixel ni suivi permet une expérience
plus simple. Le comptage et la facturation restent à instrumenter et à vérifier :
un téléchargement de fichier HTML ne prouve pas qu'une annonce a été vue. Si la
mesure nécessaire exige des traceurs, recueillir l'accord correspondant. À défaut,
vendre une période de présence avec rapport d'audience agrégé explicitement estimé,
sans prétendre facturer des impressions mesurées.

## Consentement sans pression

AdSense et publicité « non personnalisée » ne signifient pas absence de traceurs.
La [CNIL, question 34](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ)
distingue l'affichage contextuel de ses outils de mesure, de limitation de fréquence
et de lutte contre la fraude, qui peuvent nécessiter un consentement.

Pour le lancement programmatique retenu : gestion du consentement avant tout
chargement publicitaire soumis à accord, choix « Accepter », « Refuser » et
« Personnaliser » d'accès équivalent, retrait accessible et absence de demandes
répétées de page en page. Le refus conserve tout le contenu et le jeu accessibles.
La CMP de Google est un candidat pour éviter de développer un faux bandeau maison.

Vérifier la configuration selon les régions effectivement servies.
[Google impose une CMP certifiée intégrée au TCF pour la publicité personnalisée
dans l'EEE, au Royaume-Uni et en Suisse](https://support.google.com/adsense/answer/13554116?hl=fr).
Cette certification ne constitue pas une validation juridique globale.
Le présent choix produit est plus simple à contrôler : pas de requête programmatique
sans accord, indépendamment des variantes de diffusion proposées par la régie.
La publicité directe sans suivi est un chemin distinct à examiner selon sa
réalisation effective, pas un moyen de contourner un refus.

## Combien : calculer les impressions, puis les euros

Les revenus dépendent notamment du trafic, de sa provenance, des thèmes et des
placements ; [Google ne donne pas de rendement garanti](https://support.google.com/adsense/answer/9902?hl=en-GB).
Les taux suivants sont des **hypothèses de sensibilité**, sans attribution à Google
ni à un benchmark du marché français.

**Pages vues** = vraies lectures du site, y compris celles sans publicité, hors
robots et trafic interne autant que la mesure le permet. Une décision, un filtre
ou un déplacement sur la carte ne devient pas une page vue.

Formule programmatique :

```text
espaces atteints = pages vues × part éditoriale × emplacements moyens × taux d'approche
impressions payées = (espaces atteints - impressions directes) × éligibilité × remplissage
revenu régie = impressions payées / 1 000 × RPM net des impressions
revenu direct = impressions directes / 1 000 × CPM direct
revenu total = revenu régie + revenu direct
```

Le taux d'approche est la part des emplacements dont le lecteur atteint la zone de
chargement. Ce n'est pas la visibilité publicitaire « Active View ». Le taux
d'éligibilité est la part restante techniquement et contractuellement monétisable
par la régie : accord, blocage et autres restrictions. Le remplissage ne s'applique
qu'aux demandes éligibles. Les valeurs peuvent produire des nombres d'impressions
fractionnaires : ce sont des espérances de calcul, pas des compteurs facturés.

Le **RPM net des impressions** est le revenu éditeur par 1 000 impressions payées.
Le **RPM de toutes les pages du site** rapporte le revenu aux pages avec et sans
publicité. Ne pas les confondre avec le RPM des seules pages comptabilisées par une
régie : [définition du RPM](https://support.google.com/adsense/answer/190515?hl=fr).
Le RPM net retenu inclut déjà les frais de régie ; ne pas lui retirer une seconde
fois la [part des intermédiaires AdSense](https://support.google.com/adsense/answer/180195?hl=fr).
Le consentement, le blocage et le remplissage ne sont pas remultipliés après un
RPM de page déjà mesuré sur le même périmètre.

### Scénarios avec une ou deux annonces, moyenne de 1,5

Hypothèses communes : 70 % des pages dans les parcours éditoriaux admissibles,
1,5 emplacement moyen sur ces pages après extension. Ce mélange reste à mesurer.
Les 30 % restants ne génèrent pas d'inventaire publicitaire dans ce modèle.

| Hypothèse | Prudent | Central | Favorable |
|---|---:|---:|---:|
| Emplacements approchés | 60 % | 75 % | 85 % |
| Éligibilité programmatique | 50 % | 70 % | 80 % |
| Remplissage après éligibilité | 75 % | 90 % | 95 % |
| RPM net de 1 000 impressions payées | 2 € | 4 € | 6 € |
| RPM résultant de toutes les pages du site | 0,47 € | 1,98 € | 4,07 € |

**Revenu mensuel de régie, après sa commission, avant les coûts propres et les
impôts, hors vente directe :**

| Pages vues mensuelles, tout le site | Prudent | Central | Favorable |
|---|---:|---:|---:|
| 10 000 | 5 € | 20 € | 41 € |
| 100 000 | 47 € | 198 € | 407 € |
| 500 000 | 236 € | 992 € | 2 035 € |
| 1 000 000 | 473 € | 1 985 € | 4 070 € |

Arrondis à l'euro, calcul sans arrondi intermédiaire. Ces scénarios ne constituent
ni un plancher ni un plafond : sans audience, remplissage, accord ou acceptation
par une régie, le revenu peut être nul.

**Au lancement avec une seule annonce**, le scénario central donne 132 € par mois
pour 100 000 pages vues, soit les deux tiers du scénario à 1,5 emplacement, à
audience et taux inchangés. L'extension ne doit pas être présumée autorisée par le
seul besoin de revenu.

### Exemple de vente directe sans double comptage

Pour 100 000 pages mensuelles dans le scénario central étendu :

| Élément | Calcul | Revenu |
|---|---|---:|
| Espaces approchés | 100 000 × 70 % × 1,5 × 75 % | 78 750 opportunités |
| Campagne directe supposée vendue et livrée | 20 000 × 25 € / 1 000 | 500 € |
| Régie sur le reliquat | 58 750 × 70 % × 90 % × 4 € / 1 000 | 148,05 € |
| Total mensuel | Direct + reliquat régie | **648,05 €** |

Le total n'est pas 500 € + 198,45 €, puisque la campagne remplace des impressions
de régie. Il suppose un acheteur réel et 20 000 impressions effectivement livrées
selon le contrat, dans les emplacements prévus. Une campagne unique de quatre
semaines ne prouve aucun revenu récurrent.

### Ce qui reste après les coûts

Budget de travail proposé : **150 €/mois** d'hébergement, données, outils et frais
administratifs, plus **40 h** de rédaction/maintenance et **4 h** d'exploitation
publicitaire à **60 €/h**, soit **2 790 €/mois** de coût économique.
Ce temps valorisé n'est pas une charge salariale observée. Ajouter 4 h par campagne
directe dans l'exemple, pour la prospection, la création et le suivi : **3 030 €**.
Remplacer ces hypothèses par les factures et temps relevés ; le développement
initial, la fiscalité et le décalage d'encaissement ne sont pas inclus.

| Cas mensuel hypothétique | Revenu | Solde après 150 € de débours | Résultat après temps valorisé |
|---|---:|---:|---:|
| 100 000 pages, régie centrale étendue | 198,45 € | 48,45 € | -2 591,55 € |
| 100 000 pages, une campagne directe + reliquat régie | 648,05 € | 498,05 € | -2 381,95 € |
| 1 000 000 pages, régie centrale étendue | 1 984,50 € | 1 834,50 € | -805,50 € |

Dans le scénario central étendu, environ **76 000 pages/mois** couvrent seulement
les 150 € de débours et **1,41 million** couvrent le coût économique retenu, sans
vente directe. Le résultat économique n'est pas le salaire disponible.

La publicité automatique finance d'abord une partie de l'exploitation. La vente
directe et une audience récurrente permettent de viser davantage sans augmenter
la densité. Acheter du trafic au-dessus du revenu net marginal par visite
détruirait cette économie. À titre d'hypothèse, deux vraies pages par visite à
1,98 € de RPM ne rapportent qu'environ **0,004 € par visite** avant coûts propres :
priorité à la recherche naturelle, aux liens utiles, à la qualité et au retour
des lecteurs, sans objectifs de clics publicitaires.

## Quand lancer et quoi mesurer

| Étape | Action | Décision fondée sur les résultats |
|---|---|---|
| Préparation | Obtenir les vues mensuelles par route, mobile/ordinateur et pays ; vérifier les accès à la régie, l'identité de paiement et les mentions du site | Remplacer les hypothèses d'audience, choisir un premier emplacement ayant du contenu réel |
| Pilote | Une annonce sur France, puis Salaires et dossiers admissibles ; consentement et retrait testés ; placements automatiques désactivés | Vérifier revenu net, erreurs, lisibilité et interaction sur téléphone |
| Après 28 jours complets | Comparer les mêmes routes et appareils à une période comparable, en signalant saisonnalité et changements éditoriaux | Éviter toute conclusion causale tirée d'un simple avant/après |
| Extension | Tester uniquement le deuxième emplacement des longues pages, avec un groupe comparable si le volume le permet | Garder l'ajout si la contribution augmente sans dégrader les parcours |
| Vente directe | Présenter un dossier annonceur avec audience mesurée, emplacements, format, charte et rapport exemple | Vendre un volume soutenable, vérifier le taux de renouvellement et tout le temps commercial |

Tableau de bord utile : pages admissibles, espaces approchés, demandes autorisées,
remplissage, impressions payées, revenu net, RPM des impressions et de toutes les
pages, retours des lecteurs, accès aux sources, démarrages de parties et erreurs.
La visibilité publicitaire, lorsqu'elle est mesurée, est un indicateur séparé.
Ne transmettre ni salaires ni décisions pour mesurer ces parcours. Une instrumentation
nouvelle doit respecter son propre régime de consentement ; les compteurs de code
ou les tests locaux ne remplacent pas les données d'audience.

Seuils produit proposés pour le pilote : CLS au 75e percentile ≤ 0,1 et pas de
hausse supérieure à 0,02 liée aux annonces ; pas de ralentissement manifeste des
commandes ; alerte si la lecture ou les démarrages de parties reculent de plus de
5 % sur un échantillon comparable. Ce sont des garde-fous de gestion, pas une
preuve statistique automatique. Avec trop peu de trafic, conserver une annonce.
En cas de gêne, désactiver l'emplacement concerné et vérifier la cause.

## État du code et chemin d'activation

**Livré dans cette modification :**

- Les corrections UX/DX/AX décrites plus haut.
- `site/src/advertising-policy.ts` : liste des vrais parcours, un emplacement
  proposé par défaut, plafond de deux en extension, refus des routes inconnues.
- `site/src/mandats/operations.ts` réutilise cette règle pour l'éligibilité
  programmatique et conserve publicité/mesure désactivées par défaut.
- `site/scripts/business-model.ts` et `business-case.ts` : calcul pur des revenus,
  dilution, inventaire remplacé, coûts et équilibre. Recalcul : depuis `site/`,
  **`npm run business:case`**.
- Tests de la politique, du consentement logique, du plafond, de l'absence de
  revenu, du double comptage, des taux invalides et des coûts.

**Pas encore une diffusion publicitaire active.** Le module est un contrat
exécutable, pas un chargeur de régie : ses identifiants d'emplacements ne posent
pas encore de blocs dans les pages. Le rendu, le branchement CMP, la révocation,
la mesure et les campagnes doivent être intégrés avec une configuration réelle.

Prochaine tranche de mise en service : identifiants validés de l'éditeur et de
ses blocs, CMP choisie, texte de confidentialité et `ads.txt` fourni par la régie.
Puis un unique adaptateur de rendu doit appliquer la politique partagée et les
repères de la table ; aucune intégration au moteur ou aux sauvegardes.
La campagne directe nécessite une création, une destination, des dates et un
contrat réels. Aucun faux annonceur, identifiant publicitaire inventé, contact
fictif, paiement ni prospection automatique n'est ajouté.

Vérifier avant diffusion : consentement refusé/accordé/retiré, changement de route,
absence de remplissage, format étroit, erreur de régie et mode hors connexion.
La désactivation de la configuration doit supprimer les requêtes et conserver le
site utilisable. La politique seule ne prouve ni l'absence de requêtes d'un futur
SDK ni la qualité visuelle d'une annonce réelle.
