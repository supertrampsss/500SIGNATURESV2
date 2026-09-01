# Simulateur adaptatif de 45 décisions

Date : 1er septembre 2026

Statut : conception consolidée, à valider avant plan d'implémentation

Périmètre : simulateur, catalogue de décisions, crises et verdict final

## 1. Résultat attendu

Le simulateur devient une partie lisible et rejouable. Il montre exactement 45 décisions choisies dans une bibliothèque de 55 dilemmes. Les décisions suivantes dépendent des choix précédents. Deux parties peuvent donc traiter des sujets différents, tout en partageant les mêmes règles et le même déficit de départ.

Le joueur ne lit plus un programme de 60 à 96 questions. Il construit une trajectoire. Une décision ferme des options, en ouvre d'autres et peut provoquer jusqu'à trois crises réellement liées à ses choix.

Cette spécification remplace, pour le flux et la longueur de la partie, les règles de 60, 72 ou 96 dossiers des spécifications antérieures. Elle conserve leurs exigences de traçabilité budgétaire, de causalité, d'accessibilité et de verdict unique lorsqu'elles ne la contredisent pas.

## 2. Principes verrouillés

- Une partie montre exactement 45 décisions.
- La bibliothèque contient exactement 55 dilemmes relus.
- Une option est validée dès qu'elle est touchée.
- Il n'existe ni confirmation, ni écran `Décision enregistrée`, ni écran de bilan annuel.
- Il n'existe ni introduction de chapitre, ni page d'ouverture de dossier.
- Un bouton `Retour` annule réellement la dernière décision et tous ses effets.
- Les détails sont consultables avant le choix sans sélectionner l'option.
- Les montants budgétaires sont visibles avant le choix.
- Les variations d'opinion, de confiance, de majorité et de marchés ne sont pas visibles avant le choix.
- Une crise interrompt la partie seulement lorsqu'un choix précis l'a causée.
- La partie contient au plus trois crises.
- Une crise a toujours au moins deux réponses réellement applicables.
- Le verdict final est le seul bilan obligatoire.
- `Recommencer` efface la partie et repart du début sans donner d'indice.
- Aucun cadratin n'apparaît dans un texte visible.

## 3. Flux d'une partie

Le parcours est :

1. mission courte avec le déficit de départ et l'action `Commencer` ;
2. décision ;
3. toucher une option ;
4. appliquer le choix et ouvrir directement la décision suivante ;
5. conseil de crise uniquement si une règle causale se déclenche ;
6. verdict après la trente-cinquième décision et la dernière crise éventuelle.

Le changement de décision remplace le dossier dans la même scène. Il ne recharge pas la page et ne remonte pas le document au sommet. Le nouveau titre reçoit le focus avec `preventScroll` afin que le lecteur d'écran soit informé sans provoquer de saut visuel.

Le bouton `Retour` restaure la carte précédente, retire son écriture budgétaire, ses effets immédiats, ses événements programmés, ses verrous et toute crise qui n'aurait plus de cause. Il n'est pas disponible après le verdict, où `Recommencer` crée une nouvelle partie.

## 4. Composition des 45 décisions

### 4.1 Huit cartes communes

Chaque partie contient une carte commune par thème :

1. réunir l'impôt sur le revenu et la CSG ;
2. choisir l'âge de départ à la retraite ;
3. choisir qui finance davantage les soins ;
4. réorganiser ou non les collectivités ;
5. choisir entre salaires enseignants et classes moins chargées ;
6. choisir où renforcer police, justice ou prisons ;
7. choisir l'avenir du nucléaire ;
8. fixer le rythme du budget militaire.

Elles ne sont pas forcément montrées dans cet ordre. Le moteur peut rapprocher une carte commune d'une décision qui la rend immédiatement compréhensible.

### 4.2 Trente-quatre cartes adaptatives

Après chaque décision, le moteur recalcule les cartes admissibles selon :

- les choix déjà faits ;
- les dépendances et incompatibilités ;
- les thèmes encore trop peu représentés ;
- les choix budgétaires déjà utilisés ;
- la graine de partie, qui rend un défi partageable et reproductible.

Une partie contient de trois à cinq cartes par thème. Le moteur ne choisit pas une carte pour aider le joueur à atteindre l'équilibre. Il choisit une suite cohérente et variée. Il ne donne donc aucun indice caché sur le meilleur chemin.

Exemples de cohérence :

- si le prélèvement IR-CSG unique est choisi, une deuxième réforme incompatible du barème ne peut plus apparaître ;
- le choix de la retraite à 62, au régime actuel ou à 65 ans modifie l'admissibilité des cartes sur l'indexation et la capitalisation ;
- une fermeture du nucléaire interdit un moratoire sur les renouvelables tant qu'aucun remplacement électrique n'est financé ;
- sortir de l'euro modifie les options disponibles sur la défense européenne et le référendum européen ;
- une même assiette fiscale ne peut jamais financer deux décisions.

Une carte rendue sans objet est remplacée par une autre carte admissible du même thème. Le joueur ne voit ni dossier sauté, ni mention `sans objet`.

### 4.3 Trois cartes de synthèse

Trois décisions relient plusieurs thèmes :

- augmenter le revenu tiré du travail ;
- taxer davantage les énergies fossiles ;
- partager davantage la défense en Europe.

Leur contexte et leurs options admissibles reflètent les décisions antérieures. Elles restent des cartes de choix normales, pas des bilans intermédiaires.

## 5. Catalogue relu

Le catalogue final, avec les 55 questions, leurs options et leurs besoins de validation, est défini dans :

`docs/superpowers/reviews/2026-09-01-catalogue-cible-55-v2.md`.

La copie complète de chaque carte est définie dans :

- `docs/superpowers/reviews/2026-09-01-copy-deck-fiscalite-travail-sante.md` pour les cartes 1 à 22 ;
- `docs/superpowers/reviews/2026-09-01-copy-deck-etat-ecole-securite.md` pour les cartes 23 à 42 ;
- `docs/superpowers/reviews/2026-09-01-copy-deck-energie-souverainete.md` pour les cartes 43 à 55.

Les trois revues thématiques conservent la trace des 96 cartes sources et expliquent chaque fusion, séparation, absorption ou retrait.

Une fusion crée une nouvelle décision et un nouveau chiffrage. Les montants des anciennes cartes ne sont jamais additionnés mécaniquement.

## 6. Contrat d'une carte

### 6.0 Écart avec le rendu actuel

Le rendu actuel montre le titre, une première phrase coupée du contexte, le libellé, le résumé et le montant. Il ne montre pas les champs techniques qui recensent les bénéficiaires, les contributeurs, les contraintes juridiques ou l'incertitude. Une carte peut donc satisfaire les tests de données tout en restant incompréhensible pour le joueur.

Les remplacements V10 emploient en plus un générateur commun qui produit des résumés et conséquences génériques. Ce générateur ne peut pas être conservé pour la copie visible. Chaque option retenue reçoit un texte propre. Le rendu ne raccourcit plus silencieusement les libellés et ne coupe plus un contexte pour compenser une copie trop longue.

### 6.1 Carte fermée

Une carte affiche uniquement :

- le thème et la position `12 sur 45` ;
- la question ;
- une phrase de contexte ;
- deux ou trois options, exceptionnellement quatre ;
- pour chaque option, un titre court, une phrase qui décrit le résultat et le montant budgétaire.

La question vise 8 mots et ne dépasse jamais 10 mots ou 72 caractères. Le contexte contient une seule phrase de 150 caractères maximum. Un titre d'option ne dépasse pas 7 mots ou 52 caractères. La phrase de résultat ne dépasse pas 110 caractères.

La phrase de résultat dit ce qui arrive, elle ne qualifie pas la mesure. Exemples :

- `Les pensions augmentent d'un point de moins que les prix.`
- `Les contribuables paient un point de TVA supplémentaire sur les produits au taux normal.`
- `L'État vend les participations nommées et renonce à leurs dividendes futurs.`

Les personnes et organisations sont nommées. `Progressivité fiscale`, `neutralité`, `transition` ou `finances publiques` ne sont pas présentées comme des gagnants ou perdants.

### 6.2 Détail avant le choix

Un contrôle `Détails` distinct de l'option ouvre une feuille basse sur mobile et un panneau latéral sur grand écran. Ouvrir ce détail ne sélectionne rien.

Le panneau contient seulement les rubriques qui disposent d'un contenu établi, dans cet ordre :

1. `Ce qui change` ;
2. `Comment ça marche` ;
3. `Qui paie` ;
4. `Qui gagne ou perd`, uniquement lorsque cette information est établie ;
5. `Quand` ;
6. `Sources et calcul`.

Une rubrique vide est omise. L'interface ne remplace jamais une information absente par une réserve, une auto-critique ou une phrase méthodologique.

La fermeture par Échap ou par le bouton ferme le panneau et rend le focus au contrôle qui l'a ouvert. Les autres options restent lisibles derrière le panneau sur grand écran.

### 6.3 Exemple fiscal autorisé

Pour l'option de prélèvement IR-CSG unique, la carte peut dire :

`Un seul barème progressif remplace l'impôt sur le revenu, la CSG et la CRDS.`

Avant microsimulation, la copie visible s'arrête au mécanisme du prélèvement. La rubrique distributive est absente. Après microsimulation, le verdict peut afficher les effets calculés par catégorie de revenu.

## 7. Preuve des affirmations

Une phrase visible sur un gagnant, un perdant ou un payeur référence une affirmation supportée. Quatre bases sont admises :

- effet mécanique de la règle ;
- distribution publiée par une source primaire ;
- microsimulation identifiée ;
- hypothèse de scénario explicitement signalée dans le détail.

Une phrase contenant `gagne`, `perd`, `paie plus`, `paie moins`, `bénéficie`, `revenu augmente` ou `revenu baisse` doit être reliée à l'une de ces bases. Sans base, la phrase et sa rubrique sont omises sans commentaire.

Les branches de maintien ont leur propre texte et leurs propres conséquences. Elles ne sont jamais générées en inversant automatiquement une liste de gagnants et de contributeurs.

## 8. Montants budgétaires

Le montant affiché vient uniquement du profil budgétaire du moteur. Il n'est jamais ressaisi dans la copie éditoriale.

Le rendu distingue :

- le rendement ou coût annuel, par exemple `+18 Md€/an à partir de l'année 3` ;
- le coût ou produit ponctuel, par exemple `-2 Md€ une fois au lancement`.

Lorsqu'une option possède les deux, les deux sont affichés. Une vente d'actifs ne réduit jamais artificiellement le déficit annuel. Un coût de transition n'est jamais masqué derrière un rendement à terme.

Les milliards sont affichés sans décimales. Les montants inférieurs à un milliard sont affichés en millions.

## 9. Interaction de décision

La totalité de l'option est un bouton. Un toucher sur la surface choisit immédiatement l'option. Le contrôle `Détails` est un second bouton imbriqué visuellement mais pas techniquement dans le bouton de choix.

Après le choix :

- l'état est sauvegardé ;
- les effets immédiats sont appliqués ;
- les effets différés sont programmés ;
- le moteur vérifie une crise ;
- la carte suivante remplace la carte actuelle.

Il n'existe aucun écran de validation, aucun bouton `Confirmer`, aucun message `Décision enregistrée` et aucun écran séparé d'effets différés.

Une animation de 160 à 220 ms peut expliquer le remplacement de la carte. Elle est supprimée avec `prefers-reduced-motion`.

## 10. Crises

Une crise est une conséquence jouable, pas un résumé. Elle doit afficher :

- la décision et l'option qui l'ont déclenchée ;
- ce qui se passe maintenant ;
- le coût budgétaire immédiat éventuel ;
- deux réponses ou davantage ;
- pour chaque réponse, ce qui est cédé, suspendu ou maintenu ;
- ce que cette réponse change pour la suite.

Les variations politiques numériques restent cachées. En revanche, le joueur doit comprendre l'effet réel de chaque réponse. `Maintenir le cap` seul est interdit. Pour l'AME, par exemple, une crise doit permettre soit de maintenir la suppression avec ses conséquences, soit de rétablir précisément l'AME.

Une concession modifie réellement la décision source : suspension, amendement ou annulation. Elle ne se limite pas à retirer des points d'opinion. Si le joueur revient en arrière sur la cause, la crise et ses effets sont retirés.

## 11. Verdict unique

Le verdict affiche :

- `Résultat du mandat` ;
- le score, par exemple `142 / 153 Md€` ;
- une barre de progression ;
- le montant qui reste à financer, s'il existe ;
- `Conséquences` ;
- les trois choix qui ont le plus pesé ;
- le record personnel ;
- `Recommencer` ;
- éventuellement `Défier un proche`.

Le score est plafonné au déficit initial. Si la partie produit un excédent, le score reste `153 / 153 Md€` et une ligne séparée indique l'excédent.

Le verdict ne contient pas `Composition du résultat`, `Déficit supprimé`, `mission accomplie`, `Où pourriez-vous faire autrement ?`, ni une liste de branches conseillées. Le joueur recommence sans être guidé.

Les conséquences distributives suivent le même contrat de preuve que les cartes. Sans résultat calculé, aucune phrase distributive n'est affichée.

## 12. Modèle éditorial cible

Le modèle actuel est complété par une copie explicitement liée à ses preuves :

```ts
type SupportedClaim = {
  id: string;
  subjectKey: string;
  direction:
    | "pays_more"
    | "pays_less"
    | "receives_more"
    | "receives_less"
    | "service_improves"
    | "service_declines"
    | "exposed_to_risk";
  basis:
    | { kind: "mechanical"; sourceKeys: string[] }
    | { kind: "published_distribution"; sourceKeys: string[] }
    | { kind: "microsimulation"; modelKey: string; sourceKeys: string[] }
    | { kind: "scenario_assumption"; sourceKeys: string[]; caveat: string };
};

type DecisionCardCopy = {
  question: string;
  context: string;
  options: Array<{
    shortLabel: string;
    outcome: { text: string; claimRefs: string[] };
    details: {
      whatChanges: string;
      howItWorks: string;
      whoPays: Array<{ text: string; claimRefs: string[] }>;
      whoGainsOrLoses: Array<{ text: string; claimRefs: string[] }>;
      conditions: string[];
    };
    claims: SupportedClaim[];
  }>;
};
```

Les anciens champs techniques `beneficiaries` et `contributors` peuvent rester pendant la migration du moteur. Ils ne génèrent aucune phrase visible.

## 13. Validation éditoriale automatique

Un validateur parcourt toutes les surfaces visibles : question, contexte, options, détail, crises, événements, journal et verdict.

Il échoue si :

- une longueur maximale est dépassée ;
- deux options deviennent identiques après normalisation ;
- deux options utilisent le même résumé ;
- un nombre budgétaire est écrit à la main dans la copie ;
- une affirmation distributive n'a pas de preuve ;
- un sigle n'est pas développé à sa première occurrence ;
- une option annuelle masque un flux ponctuel ;
- un libellé est raccourci silencieusement au rendu ;
- un texte visible contient `audité`, `documenté`, `concret`, `crédible`, `effet distributif`, `conséquence institutionnelle`, `impact à préciser`, `selon un périmètre`, `mettre en œuvre`, `ne pas modifier` ou un cadratin.

Le validateur signale aussi le jargon comme `assiette`, `décote`, `recouvrement`, `non contributif` ou `back-office`. Ces termes restent possibles dans les sources, mais doivent être traduits dans l'interface.

## 14. Solvabilité et rejouabilité

Le moteur doit prouver au moins un chemin de 45 décisions compatible qui atteint un solde annuel nul ou positif. Ce chemin :

- n'utilise aucune recette ponctuelle comme rendement annuel ;
- ne cumule aucune assiette deux fois ;
- respecte tous les verrous et toutes les crises ;
- emploie plusieurs familles de recettes et d'économies ;
- reste invisible du joueur.

Des tests par graines couvrent des profils différents : davantage de recettes, davantage d'économies, investissement public élevé, rupture européenne et compromis. Chaque graine produit exactement 45 décisions et aucune combinaison physiquement, juridiquement ou budgétairement impossible.

Le lien de défi encode la version du scénario, la graine et le score à battre. Il n'encode pas les réponses du joueur précédent.

## 15. Mobile et accessibilité

La référence est un écran de 390 px de large.

- Le header de mandat tient sur deux lignes maximum.
- La première option entière et le début de la suivante sont visibles sans défilement excessif.
- Toute cible tactile mesure au moins 44 par 44 px.
- Aucun texte utile n'est tronqué.
- Aucun débordement horizontal n'est accepté.
- Le détail occupe une feuille basse avec un titre fixe et un contenu défilable.
- Le bouton `Retour` reste accessible sans masquer la question.
- Les états focus, sélection, erreur et désactivation ne dépendent pas de la couleur seule.
- La navigation au clavier et le lecteur d'écran permettent de choisir, ouvrir le détail, revenir en arrière et répondre à une crise.

## 16. Compatibilité

Le passage à 45 décisions impose une nouvelle version de scénario. Une ancienne sauvegarde n'est pas continuée dans le nouveau moteur. L'utilisateur peut la consulter dans son ancien journal ou commencer une nouvelle partie. Elle n'est jamais convertie en retirant silencieusement des décisions.

Le code peut conserver temporairement les anciennes phases de sauvegarde, mais elles ne produisent plus de scène visible dans une nouvelle partie.

## 17. Recette finale

La conception est réalisée lorsque :

- la bibliothèque contient exactement 55 cartes validées ;
- une partie montre exactement 45 cartes ;
- 8 cartes communes et 3 cartes de synthèse sont toujours présentes ;
- les 34 autres cartes dépendent réellement des choix ;
- un choix incompatible retire ou remplace les cartes concernées ;
- toucher une option avance sans confirmation et sans saut en haut de page ;
- `Retour` inverse entièrement la dernière décision ;
- aucune page de résultat, de chapitre ou d'année n'interrompt le flux ;
- chaque crise possède au moins deux choix qui changent réellement l'état ;
- au moins un chemin compatible atteint l'équilibre ;
- le verdict est unique et suit la copie verrouillée ;
- les 55 cartes passent le validateur éditorial ;
- toutes les affirmations par catégorie de revenu possèdent une microsimulation ou une source distributive ;
- les tests, le build et un contrôle visuel réel à 390, 768 et 1280 px réussissent.
