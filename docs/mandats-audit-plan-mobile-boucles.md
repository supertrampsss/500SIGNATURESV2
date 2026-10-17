# Mandats : état des lieux et plan de refonte du jeu

17 octobre 2026. Document de conception, pas une livraison de code. Fondé sur les deux captures utilisateur visibles dans la conversation et la lecture du moteur v16 et de son interface. Aucune nouvelle validation Safari en production n’a été effectuée pour cet audit. Les causes exactes de la partie photographiée nécessitent son export ; on distingue ci-dessous les défauts établis des hypothèses.

## 1. Diagnostic

La carte a progressé graphiquement, mais le jeu reste organisé autour de panneaux et de commandes. Les événements ne rendent pas assez visibles leurs causes, leur progression ni le résultat des décisions. Ajouter davantage de textes et de crises à cette structure amplifierait la confusion.

| Constat | Preuve et conséquence | Priorité |
|---|---|---|
| Carte peu lisible sur téléphone | `presidency-reference.css` cache les libellés des repères et des événements sous 650 px. Le panneau d’alertes mesure 150 px de large et jusqu’à 240 px de haut, au-dessus du pays. | P0 |
| Peu de place pour jouer | En mobile : en-tête de 112 px, bas réservé de 184 px, puis panneau de décision. La vue France conserve une image paysage dans un espace vertical, avec des bandes vides visibles sur la capture. | P0 |
| Navigation encore séparée | `presidencyShell` affiche toujours Réformes, Gouvernement, Priorités. Ces accès doivent disparaître selon la nouvelle demande. | P0 |
| Signification des indicateurs ambiguë | « Santé 100 » signifie pression maximale, pas santé excellente. Le mot pression n’est explicite que dans le libellé accessible. Les coches signalent un programme en service, même si une crise reste active. | P0 |
| Retour de décision insuffisant | `presidency-runtime.ts`, fonction `order`, affiche surtout le titre de la dernière initiative. Le détail « texte rejeté » existe dans le moteur mais ne constitue pas le retour principal. | P0 |
| Nomination potentiellement répétable | La nomination est traitée comme un accord soumis au vote. Un rejet laisse le gouvernement tombé et l’action disponible. Il faut distinguer nomination, négociation et vote ; une répétition identique ne doit pas être présentée comme une nouvelle nomination réussie. | P0 |
| Réformes discrètes et bloquées en attente | `advanceReformEvents` propose une réforme puis attend 3 ou 4 périodes, soit 45 à 60 secondes à ×1. Deux propositions en attente empêchent toute nouvelle arrivée. Arrêt des propositions à la période 28. | P1 |
| Aléatoire limité | Sélection par graine et pression déjà présente, mais cadence régulière et escalade civile toujours grève → blocage → révolte → révolution. La variation des délais ne change pas suffisamment les histoires. | P1 |
| Carte surtout symbolique | Six secteurs nationaux associés à six lieux fixes ; les positions des réformes sont deux emplacements alternés, sans lien territorial fort. Il ne faut pas laisser croire qu’une simulation locale détaillée existe déjà. | P1 |
| Fin peu concluante dans la capture | « Mandat terminé », crise à 0 s et anciennes alertes encore visibles : le résultat devrait remplacer les actions périmées et expliquer immédiatement la défaite. | P0 |

### Reproduction du défaut de nomination

Exécution directe du moteur, sans état fabriqué : `startPresidency(7)`, commande `live-autonomy`, neuf `live-tick`, puis répétition de `pol-cabinet-cohabitation`. Treize tentatives sont acceptées à la même période 9. Toutes sont rejetées et le cabinet reste tombé. La tension passe de 54,123 après la première à 90,123 après la treizième ; le dossier en attente devient alors `rupture`. La quatorzième tentative est refusée comme indisponible. Il s’agit d’une crise institutionnelle ouverte, pas d’une fin de partie déjà constatée par cette reproduction.

Le problème est donc confirmé : le même vote peut être répété sans temps écoulé et pénalise le joueur à chaque clic, pendant que le retour affiche « Nommer… ». Cela ne prouve pas que la partie photographiée avait cette graine, mais reproduit légalement le défaut signalé.

## 2. Animations : présentes, mais insuffisantes

Le code produit des ondes, flux pointillés, petits véhicules, files de personnes, lumières, fumée, flammes et effets de rétablissement (`presidency-crisis-view.ts`, `presidency-crises.css`, `presidency-reference.css`). Il ne transforme pas réellement les bâtiments ou les routes peints dans l’image.

Plusieurs objets sont minuscules : véhicules de 6 × 4 unités et personnes de quelques unités dans un canevas de 1 000 unités. À 390 px en vue France, un véhicule est de l’ordre de 2,3 × 1,6 px. Les symboles et panneaux peuvent recouvrir les effets situés sous eux. Le groupe de foule et les barricades n’ont pas de mouvement propre. Les fumées ne concernent que certaines crises. Les effets s’arrêtent en pause, dans les panneaux de lecture et en fin de partie ; la seconde capture montre justement un mandat terminé. Cela n’explique pas à lui seul l’absence perçue pendant toute la partie.

Conclusion : leur présence technique ne valide pas la promesse d’une carte vivante. Il faut une preuve vidéo sur téléphone, sans zoom de montage, où l’on distingue les changements et leur signification.

## 3. Contrat de la prochaine version

1. Toute décision de jeu arrive sur la carte au lieu pertinent : réforme, gouvernement, budget, priorité ou crise. Supprimer les trois onglets du bas. Le menu ne conserve que partie, réglages, aide et historique.
2. Une carte d’événement indique en quelques mots : ce qui arrive, pourquoi maintenant, ce qui est menacé et le temps disponible. Chaque choix indique coût, délai, bénéfice et contrepartie concrets.
3. Toute action produit un état durable et un retour visible. Une commande reçue ne vaut ni vote gagné, ni intervention livrée, ni problème résolu.
4. Une crise peut se stabiliser, s’étendre, rechuter, changer de nature ou disparaître. L’escalade nationale ne doit pas être une suite automatique de quatre cases.
5. La pression comporte des respirations réelles. Le joueur peut perdre après des avertissements compréhensibles et peut comprendre comment il aurait pu éviter cette issue.

## 4. Boucle commune complète

**Conditions → apparition → décision → résultat immédiat → préparation → exécution → effets observés → suivi → clôture ou nouvelle branche.**

Chaque événement conserve un identifiant unique, son origine, ses conditions d’éligibilité, ses échéances, les décisions acceptées et les effets déjà appliqués. États distincts : à décider, proposé, refusé, engagé, en préparation, en cours, livré, sous surveillance, résolu, expiré ou échoué. Les variantes n’utilisent que les états qui ont du sens pour elles.

- Valider une décision la sauvegarde une seule fois ; double clic, réouverture et rechargement ne doublent ni coût ni effet.
- Une action engagée devient un suivi sur la carte, avec échéance et cause d’un éventuel retard.
- Un échec ouvre une vraie autre possibilité : négocier, modifier, attendre un changement documenté ou renoncer. Aucun bouton identique immédiatement répétable à l’infini.
- Les ressources manquantes conduisent à une décision budgétaire contextuelle, pas à une carte de commandes toutes inactives.
- La fin de partie retire les commandes, gèle les échéances et ouvre un bilan causal : décision, avertissement, occasion manquée, issue.

### Gouvernement

Vacance ou démission → consultations → candidat et coalition proposés → nomination enregistrée → programme politique et soutiens → gouvernement en fonction → décisions et exécution → éventuelle censure ou nouvelle démission causée par un nouvel événement.

Séparer l’acte de nomination du vote sur un accord politique. Une proposition refusée affiche les voix et les appuis manquants. Refaire exactement la même proposition sans changement est indisponible, avec explication. Un nouveau gouvernement reçoit une identité et une date d’entrée en fonction ; il ne disparaît pas silencieusement. Sa capacité d’exécution et ses initiatives changent effectivement.

### Réformes

Problème ou opportunité → proposition visible → choix politique → négociation éventuelle → vote → rejet explicite ou adoption → financement → déploiement → effets sectoriels et sociaux → bilan et éventuelle contestation.

Le rejet n’engage aucun effet. L’adoption ne signifie pas que les services sont déjà améliorés. Chaque réforme propose des branches réellement différentes, par exemple montée en charge progressive, ciblage territorial, compensation ou renoncement. Toute proposition laissée en attente dispose d’un suivi, d’un report explicite ou d’une expiration expliquée : elle ne bloque pas silencieusement le reste du jeu.

## 5. Carte mobile et compréhension

- Conserver l’illustration validée. Recomposer le cadrage et les couches, sans remplacer l’image par une carte simplifiée.
- Viser au moins 60 % de la hauteur utile pour le pays hors décision ouverte ; mesurer sur 390 px et 320 px avec les barres du navigateur.
- Enlever le panneau permanent qui cache le nord-est. Les alertes sont des repères nommés, ancrés sur la carte. Les événements hors champ ont un indicateur de bord actionnable.
- Éviter les collisions et regrouper les événements proches avec un nombre et un déploiement au toucher. Ne jamais masquer silencieusement une urgence pour respecter un quota visuel.
- Chaque repère porte un court libellé, un état et, si nécessaire, une échéance. Couleur et forme distinguent crise, proposition, intervention et résultat.
- Les priorités se choisissent au lieu concerné ; le gouvernement à Matignon, les votes à l’Assemblée, les moyens nationaux sur un repère budgétaire. Afficher les conséquences nationales comme nationales.
- Ouvrir une décision concise ancrée au contexte, sans formulaire ou catalogue plein écran. Conserver visible la zone touchée et le résultat après choix. Les détails restent secondaires.
- Remplacer les chiffres nus par « Pression santé : critique » et une tendance compréhensible. Une coche signifie uniquement « terminé », avec la portée exacte ; un chantier actif porte un symbole d’intervention.
- Les commandes essentielles gardent des cibles d’au moins 44 px. Préserver clavier, lecteurs d’écran et lecture sans mouvement.

## 6. Animation à chaque étape

| État | Changement visible | Sens et persistance |
|---|---|---|
| Apparition | Repère se déploie, onde localisée et court titre | Attire une fois l’attention, reste repérable ensuite |
| Aggravation | Zone affectée s’étend, densité des files ou barrages augmente | Rend le risque visible avant l’échec |
| Propagation | Flux parcourt une liaison puis un second foyer apparaît | Montre la cause réelle enregistrée dans le moteur |
| Ordre enregistré | Retour immédiat de coût et statut | Ne montre jamais déjà le problème résolu |
| Préparation | Marqueur de travail et progression lisible | Explique l’attente et les équipes mobilisées |
| Intervention | Convois sur des routes cohérentes, équipes au lieu concerné | Distingue intervention et succès |
| Réforme adoptée | Vote lisible à l’Assemblée puis jalons sur les zones concernées | Distingue adoption et déploiement |
| Rétablissement | Trafic reprend, files diminuent, lumières reviennent, zone rouge recule | Accompagne les effets effectifs et conserve les retards restants |
| Rechute | Retrait du secours puis retour local de la perturbation | Explique l’expiration plutôt qu’un nouveau hasard |
| Rupture | Changement de scène institutionnelle et résultat central | Termine clairement la partie |

Les véhicules et personnages gardent une taille perceptible à l’échelle de l’écran ; limiter leur nombre plutôt que les réduire à quelques pixels. Les mouvements de la simulation suivent la pause. Les retours de commande restent lisibles même à l’arrêt. En mouvement réduit, garder les changements d’état, les flèches et les titres sans pulsations. Aucun effet décoratif ne doit inventer une conséquence.

ImageGen pourra fournir des variantes d’éléments visuels si nécessaires, après validation des états à représenter. L’animation et les valeurs restent pilotées par le moteur. Une nouvelle belle image seule ne corrigera pas ces défauts.

## 7. Aléatoire et rythme

Conserver une graine sauvegardée et des tirages reproductibles. Proposer un directeur d’événements qui combine : conditions du pays, choix précédents, saison, fragilités, conflits actifs, familles récemment vues et capacité de lecture du joueur.

- Tirage pondéré parmi des événements éligibles, jamais parmi tout le catalogue sans contexte.
- Délais variables dans une plage, variantes de lieu, acteurs, causes et contreparties. Une histoire différente doit modifier les décisions et les suites, pas seulement le titre.
- Mémoire anti-répétition par famille et période de répit après résolution ; une rechute reste possible avec une cause nommée.
- Alternance d’urgences, opportunités, réformes et résultats. Une période calme permet d’anticiper plutôt que d’attendre passivement.
- Réserver des fenêtres aux réformes pour qu’elles restent visibles pendant les crises. Ne pas garantir artificiellement une révolution dans chaque partie.
- Plafonner les nouvelles sollicitations simultanées, sans effacer les conséquences des crises existantes.
- Ne pas tirer à nouveau un vote au rechargement ou au clic répété. Enregistrer la raison de chaque apparition pour le bilan et le diagnostic.

Les cadences, probabilités et objectifs de fréquence seront des paramètres de conception à mesurer en partie, pas des propriétés prétendument réalistes déjà établies.

## 8. Scénarios à réaliser et vérifier de bout en bout

| Départ | Branches du joueur | Suites visibles | Issues |
|---|---|---|---|
| Port bloqué | Négocier, détourner les livraisons, temporiser | Convois reroutés, coûts, pénuries liées aux stocks, échéance de l’accord | Reprise, rechute, extension logistique |
| Hôpital saturé | Renfort temporaire, capacité durable, transfert | Préparation, files, patients transférés, autres sites sous tension | Retour progressif, secours expiré, crise sanitaire élargie |
| Panne électrique | Réparation urgente, délestage ciblé, rénovation | Quartiers coupés, équipes, retour partiel, activités touchées | Rétablissement ou cascade vers transports et soins |
| Réforme sensible | Négocier une compensation, réduire le périmètre, maintenir le texte, retirer | Vote, budget, calendrier, gagnants et perdants, réaction sociale | Adoption et livraison, rejet, contestation ou compromis |
| Gouvernement démissionnaire | Coalition, autre candidat, dissolution éligible | Consultations, nomination unique, nouvelle composition, reprise d’exécution | Gouvernement stable, minoritaire ou blocage explicite |
| Grève sectorielle | Accord, service prioritaire, attente | Mobilisation qui se réduit ou s’étend selon causes et réponse | Apaisement, blocages régionaux, conflit national |
| Révolte nationale | Accord durable, médiation limitée, démission présidentielle | Négociation, concessions, accalmie ou radicalisation | Maintien du mandat, départ volontaire ou rupture |
| Budget épuisé | Redéployer, demander une enveloppe, différer | Vote, arbitrage entre chantiers, délais modifiés | Programme financé, rejet budgétaire ou retard assumé |
| Deux urgences liées | Prioriser la cause ou protéger la conséquence | Équipes partagées, livraison partielle, propagation identifiable | Compromis coûteux, stabilisation ou aggravation |
| Période d’accalmie | Réformer, prévenir, conserver une réserve | Chantiers anticipés et vulnérabilité réduite | Meilleure résistance au choc suivant, coût d’opportunité |

Chaque ligne doit couvrir réussite, réponse tardive, abandon, manque de moyens, rechargement pendant l’action et résultat final. La difficulté doit venir des arbitrages et des conséquences, pas d’une interface qui cache les informations.

## 9. Ordre d’exécution

1. **Fiabilité des actions.** Reproduire la nomination répétée, corriger les transitions et le retour des votes, verrouiller les effets uniques, clarifier la fin de partie. Produire les séquences avant/après.
2. **Composition mobile.** Retirer les trois onglets, déplacer toutes leurs fonctions de jeu vers les événements contextuels, traiter collisions, hors-champ, cadrage et vocabulaire. Vérifier qu’aucune action utile ne devient introuvable.
3. **Une boucle de référence complète.** Réaliser port → décision → préparation → intervention → rétablissement/rechute avec animations lisibles sur téléphone. Valider ce niveau avant de multiplier les familles.
4. **Réformes et institutions.** Construire les parcours complets, résultat du vote, déploiement, suivi des promesses et changement effectif du gouvernement.
5. **Variété et directeur d’événements.** Ajouter les branches et contraintes d’éligibilité, puis calibrer les cadences sur les scénarios précédents.
6. **Équilibrage et livraison.** Jouer plusieurs stratégies et graines, corriger les répétitions et impasses, vérifier les parcours existants et publier avec les preuves visuelles.

## 10. Critères de sortie

- À 320 et 390 px : aucune décision cachée, aucun chevauchement bloquant ; les trois anciens onglets ont disparu ; chaque fonction reste accessible au moment utile.
- En quelques secondes, on identifie le problème, son emplacement, l’urgence et l’intervention éventuelle. Faire relire une partie sans explication orale ; les captures seules ne prouvent pas ce critère.
- Quinze tentatives de la même nomination ne produisent jamais quinze nominations ou quinze effets. Un rejet est nommé comme tel ; une nouvelle tentative demande un changement explicite.
- Une action financée montre son suivi jusqu’à son issue, y compris si les équipes manquent, si le gouvernement tombe ou si la partie est rechargée.
- Une réforme proposée est visible et ne reste pas indéfiniment dans une file qui empêche tout renouvellement.
- Vidéos réelles mobile Safari et Chromium : apparition, propagation, préparation, livraison et accalmie discernables sans son ni agrandissement. Captures avant/après et replay conservés.
- Parcours avec mouvement réduit, pause, ×1/×2/×4, hors ligne, export/rechargement, fin anticipée et fin normale.
- Exploration reproductible de graines et stratégies : noter fréquences, répétitions, périodes sans décisions, délais de réponse, budgets et causes des défaites. Conserver aussi les échecs, pas uniquement les parties réussies.
- Rapporter séparément validité du moteur, lisibilité, perception des animations et état du déploiement. Le nombre de tests passants ne vaut pas validation du plaisir de jeu.

## Décision de périmètre

Ce document prépare la refonte demandée. Aucun changement de gameplay, aucune nouvelle animation et aucun déploiement ne sont inclus dans cet audit. La priorité est de rendre une boucle entière fiable et visible avant d’étendre le contenu.
