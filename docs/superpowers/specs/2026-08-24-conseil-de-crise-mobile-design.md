# Simulateur « Conseil de crise » — Spécification de conception

Date : 24 août 2026  
Statut : prêt pour revue utilisateur  
Périmètre : campagne nationale « Gouverner la France »

## 1. Intention

Transformer le simulateur budgétaire actuel en un jeu sérieux de décision publique qui permet d’abord de comprendre les arbitrages, puis d’essayer de « battre le système ».

La promesse produit est :

> Quinze décisions pour redresser les comptes sans perdre le pays.

L’expérience doit être tranchante sur les contradictions politiques et irréprochable sur les faits. La tension provient des choix, des gagnants, des perdants et des conséquences différées — jamais d’une déformation des données.

## 2. Décisions validées

- Campagne perfectionnée en premier : **Gouverner la France**.
- Expérience phare : **7 à 10 minutes**, 12 à 15 dilemmes.
- Les 72 mesures restent disponibles dans un futur mode **Conseil intégral**.
- Ton : **contradictoire, mordant et factuel**.
- Les seuils critiques déclenchent des crises, sans éliminer le joueur.
- Concept : **Salle de crise + débat contradictoire**.
- Architecture : **mobile-first, focus vertical**.
- Direction artistique : **République éditoriale**.
- Retour après une décision : séquence équilibrée d’environ 1,8 seconde.
- Verdict : bilan explicatif, puis défi de revanche.

## 3. Boucle de jeu

### 3.1 Entrée

1. Le joueur découvre la mission budgétaire et sa durée estimée.
2. Il signe une contrainte personnelle parmi plusieurs engagements difficiles : ne pas augmenter les impôts, protéger l’école et la santé, ne pas réduire les prestations, etc.
3. La partie explique que chaque promesse retire certaines solutions ou augmente le coût politique d’une rupture.

### 3.2 Trois actes

1. **Tenir ses promesses** — décisions lisibles, apprentissage des jauges.
2. **Affronter les résistances** — conséquences différées, télex et premières crises.
3. **Boucler le budget** — mesures plus difficiles, retour des ajournements et arbitrage final.

Chaque partie sélectionne 12 à 15 dossiers dans un corpus plus large selon les engagements, les décisions antérieures et les catégories déjà rencontrées. Une partie doit couvrir plusieurs familles de politiques publiques et éviter les séries monotones.

### 3.3 Décision

Chaque dossier contient :

- une contradiction formulée en une question courte ;
- deux choix principaux comparables sur le même écran ;
- les bénéficiaires et les perdants ;
- l’effet budgétaire et son degré d’incertitude ;
- les réactions prévisibles des soutiens ;
- un accès secondaire aux hypothèses et sources ;
- éventuellement l’ajournement, avec un coût futur explicite.

Après validation : enfoncement tactile, tampon de décision, évolution chiffrée, puis conséquence immédiate ou différée. Le joueur retrouve la main en moins de deux secondes hors crise.

### 3.4 Crises

Quatre soutiens structurent la partie : Opinion, Entreprises, Marchés et Territoires. Le franchissement d’un seuil critique déclenche un dilemme d’urgence, par exemple : mouvement social, fronde patronale, choc de financement ou fronde territoriale. Cette liste conserve le modèle éditorial déjà renseigné et testé sur les 96 mesures ; une jauge « Majorité » exigerait un nouveau modèle de réactions parlementaires et n’est pas simulée sans fondement.

Une crise ne termine pas automatiquement la partie. Elle impose une concession, une dépense, un risque supplémentaire ou la rupture d’un engagement. Les seuils, règles et effets sont identifiés comme mécaniques de jeu.

### 3.5 Verdict et rejouabilité

Le verdict final présente dans cet ordre :

1. résultat budgétaire ;
2. stabilité politique et soutiens restants ;
3. promesses tenues ou rompues ;
4. conséquences encore latentes ;
5. titre de mandat mémorable, mais non partisan ;
6. nouveau défi avec une contrainte supplémentaire ;
7. carte partageable et historique des décisions.

Le partage met en avant les compromis concrets. Il ne présente pas une orientation politique comme objectivement victorieuse.

## 4. Architecture d’interface

### 4.1 Mobile — expérience de référence

L’écran principal tient autant que possible dans une hauteur de téléphone :

- bandeau compact : progression, temps indicatif, déficit restant et soutiens critiques ;
- carte centrale : question, contradiction et deux conséquences résumées ;
- tiroir dépliable : arguments, gagnants, perdants, hypothèses et sources ;
- alerte contextuelle : crise proche ou conséquence différée ;
- barre d’action fixe : deux décisions principales, chacune avec une cible tactile d’au moins 44 px.

Aucun balayage n’est obligatoire. Les gestes peuvent accélérer l’usage, mais toutes les actions disposent d’un bouton explicite.

### 4.2 Desktop

Le desktop adapte le mobile dans une salle de crise à trois zones :

- soutiens et engagement à gauche ;
- dilemme contradictoire au centre ;
- trajectoire, conséquences et alertes à droite.

Le centre conserve la priorité visuelle. Les panneaux latéraux ne doivent pas devenir des tableaux de bord concurrents.

### 4.3 Direction artistique

La « République éditoriale » utilise :

- une **coque immersive bleu nuit** : fond de séance, panneaux latéraux,
  progression et alertes vivent dans cette salle de crise ;
- un **dossier central papier / ivoire** : le dilemme, ses preuves et ses
  actions restent la seule surface claire de la séance ;
- bleu institutionnel profond dans la coque, distinct du papier du dossier ;
- rouge sombre pour les décisions et alertes ;
- vert réservé aux améliorations vérifiables ;
- serif éditoriale pour les dilemmes et verdicts ;
- sans-serif très lisible pour les règles, chiffres et actions ;
- filets, doubles bordures et tampons avec parcimonie.

L’identité doit évoquer un dossier officiel vivant, sans copier l’esthétique historique de Septennat(s).

Les teintes des choix ne prennent jamais leur sens du verbe « adopter » ou
« rejeter ». Vert, rouge et neutre signalent exclusivement un effet objectif
sur le compteur ou une alerte explicitée par du texte ; les deux gestes restent
éditorialement symétriques.

## 5. Composants fonctionnels

- `GameShell` — route la phase active et fournit l’état de partie.
- `MissionIntro` — mission, durée, explication et engagement initial.
- `StatusStrip` — progression, objectif budgétaire et soutiens condensés.
- `SupportMeters` — valeurs, seuils et variations accessibles textuellement.
- `DilemmaCard` — question, contexte et choix.
- `ChoiceComparison` — gagnants, perdants, montants et réactions.
- `EvidenceDrawer` — sources, hypothèses, réserves et distinction faits/règles.
- `DecisionFeedback` — tampon et évolution animée.
- `ConsequenceTelex` — conséquence immédiate ou différée.
- `CrisisScene` — interruption exceptionnelle et arbitrage d’urgence.
- `ProgressTimeline` — trois actes et dossiers restants.
- `VerdictScreen` — bilan, titre, revanche et partage.
- `ShareCard` — visuel généré à partir de données non sensibles.

Chaque composant reçoit des données typées et ne calcule pas seul les règles économiques.

## 6. État et flux de données

L’état de partie contient au minimum :

- identifiant et version du scénario ;
- graine de sélection permettant de rejouer et tester la même partie ;
- engagement choisi ;
- acte et dossier courant ;
- décisions et ajournements ;
- déficit ou économies cumulées ;
- valeurs des quatre soutiens ;
- conséquences programmées ;
- crises déclenchées ;
- horodatage de sauvegarde.

À scénario, graine et décisions identiques, le moteur produit le même parcours et le même verdict. Il suit le flux : sélection du dossier → choix → application des effets → programmation ou résolution des conséquences → vérification des seuils → dossier suivant → verdict.

Les contenus doivent séparer explicitement :

- `evidence` : chiffres, fourchettes, source, date et réserves ;
- `gameEffects` : effets sur les jauges et règles de crise ;
- `editorial` : formulation du dilemme et arguments contradictoires.

Cette séparation empêche une règle ludique d’être présentée comme une prévision scientifique.

La sauvegarde locale doit permettre de reprendre une partie interrompue. Une version de scénario incompatible propose de recommencer sans afficher un état incohérent.

## 7. États dégradés

- Source indisponible : conserver le dossier si les données embarquées sont valides, signaler la date de référence.
- Donnée ou effet incomplet : exclure le dossier de la sélection plutôt que montrer une carte partielle.
- Rechargement en cours de décision : restaurer le dernier état confirmé, jamais un choix à moitié appliqué.
- Échec du partage : permettre de copier un résumé texte et de télécharger la carte localement.
- JavaScript ou stockage limité : afficher une explication claire et préserver l’accès aux sources.

## 8. Accessibilité et performance

- Contrastes conformes WCAG AA.
- Navigation complète au clavier et ordre de focus stable.
- Libellés textuels pour toutes les variations ; la couleur ne suffit jamais.
- Cibles tactiles de 44 px minimum.
- Respect de `prefers-reduced-motion`.
- Aucun son automatique ; option sonore explicite uniquement.
- Mise en page utilisable à 320 px de largeur.
- Chargement initial ciblé sous 200 Ko de JavaScript compressé pour le simulateur, hors dépendances déjà partagées.
- Pas d’image lourde nécessaire à la compréhension d’un dilemme.
- Animations basées sur opacité et transformation, sans bloquer l’interaction.

## 9. Mesure du succès

Indicateurs prioritaires :

- taux de démarrage après l’écran de mission ;
- taux d’achèvement des 15 dossiers ;
- durée médiane de partie ;
- taux d’ouverture des sources ;
- taux de revanche ;
- taux de partage du bilan ;
- abandon par dossier et par crise ;
- compréhension déclarée d’un arbitrage dans un test utilisateur court.

Les événements analytiques ne doivent pas enregistrer d’opinion politique nominative. Une partie peut être mesurée avec un identifiant anonyme et éphémère.

## 10. Vérification

### Tests unitaires

- effets budgétaires et soutiens ;
- programmation des conséquences ;
- déclenchement unique des crises ;
- ajournement et renchérissement ;
- génération déterministe du verdict ;
- migration ou invalidation d’une sauvegarde.

### Tests de composants

- affichage des deux choix et de leurs réserves ;
- tiroir de sources ;
- barre d’action mobile ;
- variations lisibles sans couleur ;
- états de chargement et d’erreur.

### Tests de parcours

- partie complète sur mobile ;
- reprise après rechargement ;
- crise déclenchée puis résolue ;
- ajournement qui revient dans l’acte III ;
- verdict, revanche et partage ;
- navigation clavier et réduction des animations.

### Matrice visuelle

- largeurs 320, 375, 390, 768, 1 024 et 1 440 px ;
- thèmes clair et sombre seulement si le produit conserve réellement les deux ;
- Chrome, Safari mobile et Firefox récents.

## 11. Critères d’acceptation

La première version est prête lorsque :

- une partie express complète comprend 12 à 15 dilemmes cohérents en trois actes ;
- chaque choix affiche coût, bénéficiaires, perdants et source ou réserve ;
- une décision produit un retour compréhensible en moins de deux secondes ;
- au moins une crise peut être déclenchée et résolue sans bloquer la partie ;
- une partie est reprenable après rechargement ;
- le verdict explique le résultat avant de proposer une revanche ;
- le parcours mobile fonctionne à 320 px, au clavier et avec animations réduites ;
- les tests du moteur et les parcours critiques passent.

## 12. Hors périmètre initial

- campagne « Diriger mon territoire » ;
- mode Conseil intégral de 72 mesures ;
- classement public nominatif ;
- comptes utilisateurs et synchronisation multi-appareils ;
- génération de contenu par IA pendant la partie ;
- simulation macroéconomique prédictive présentée comme certaine.

## 13. Prérequis d’implémentation

Le dépôt source n’est pas présent dans l’espace de travail actuel. Avant le plan d’implémentation, il faudra rendre le dépôt accessible localement ou fournir son URL Git. Le plan devra ensuite être adapté à la structure, aux composants et aux tests réellement existants.
