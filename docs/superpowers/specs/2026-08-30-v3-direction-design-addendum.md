# V3 direction design, densité et causalité

Date : 30 août 2026

Statut : addendum obligatoire à la spécification V3

Dépôt cible : dépôt existant `500SIGNATURESV2`

Périmètre : simulateur, page France, analyses longues et réponses pré-rendues

## 1. Design read

Refonte préservée d'un simulateur civique grand public, avec un langage éditorial institutionnel, une tension de jeu sérieuse et une densité maîtrisée.

Curseurs retenus : variance 5, motion 3, densité 5.

La direction reste celle d'un cabinet de crise et d'un dossier d'État. Elle ne devient ni une application bancaire générique, ni un jeu illustré, ni un faux assistant conversationnel.

## 2. Diagnostic vérifié sur l'interface publiée

L'identité actuelle est forte et mérite d'être conservée : fond bleu nuit, papier ivoire, accent rouge, titres Spectral et texte Public Sans. Le problème principal n'est pas la marque. Il vient de la composition et du rythme.

Les écrans observés présentent cinq défauts structurants :

1. la taille des titres et des chiffres porte presque toute la hiérarchie ;
2. les options utilisent de grandes cartes symétriques avec une illustration, plusieurs effets et une jauge avant même la sélection ;
3. le tableau de situation complet est répété après chaque dossier ;
4. la confirmation fait immédiatement passer au dossier suivant, sans temps de lecture causal ;
5. la page France expose un document très long puis un catalogue dense, sans hiérarchie de découverte suffisante.

La V3 corrige ces problèmes sans remplacer les fondations techniques ni l'identité éditoriale.

## 3. Système visuel verrouillé

### 3.1 Couleurs

Les couleurs existantes deviennent le contrat visuel du produit, mais elles ne restent pas dupliquées dans plusieurs feuilles. Une seule couche de primitives racine porte les valeurs. Les régimes `--ui-*`, `--bilan-*` et `--v3-*` deviennent des alias sémantiques ou sont supprimés lorsqu'ils répètent la même valeur.

| Rôle | Jeton existant | Usage |
|---|---|---|
| Coque | `--v3-shell: #071425` | fond du mandat et écrans de crise |
| Coque secondaire | `--v3-shell-soft: #10233f` | séparation de niveau, jamais décoration gratuite |
| Dossier | `--v3-dossier: #f8f2e7` | surface éditoriale principale |
| Papier | `--v3-paper: #fffdf8` | détail, preuve et réponse |
| Encre | `--v3-ink: #12233d` | texte principal |
| Texte secondaire | `--v3-muted: #526177` | contexte et réserves |
| Filet | `--v3-rule: #cbbda5` | tableaux, séparateurs et groupes |
| Action | `--v3-red: #a7352f` | seul accent interactif |
| Positif | `--v3-green: #17634f` | signal sémantique positif uniquement |
| Attention | `--v3-gold: #d5a43c` | seuil ou alerte, jamais second accent d'action |

Les dégradés décoratifs du simulateur sont supprimés. Une surface est plate, un filet sépare les niveaux et une ombre n'apparaît que sous le dossier principal. Les couleurs rouge, verte et or ne codent jamais seules une information.

Le thème suit un contrat explicite : France, Territoires et les analyses respectent le choix clair ou sombre ; le mandat V3 reste une salle bleu nuit contenant un dossier ivoire ; l'impression reste claire. Aucun bloc isolé ne change de thème au milieu d'une page.

### 3.2 Typographie

- Spectral reste réservée aux titres éditoriaux, aux verdicts et aux chiffres structurants.
- Public Sans reste utilisée pour les contrôles, les explications, les données et la navigation.
- Un titre de décision mesure 26 à 32 px sur mobile et 32 à 40 px sur grand écran.
- Le texte courant mesure au moins 16 px avec une hauteur de ligne de 1,45 à 1,6.
- La prose éditoriale reste comprise entre 60 et 66 caractères par ligne. Les graphiques, tableaux et équations peuvent utiliser toute la largeur utile.
- Les nombres utilisent des chiffres tabulaires dès qu'ils doivent être comparés.
- Un titre ne dépasse pas 20 caractères de largeur utile sur mobile et 28 caractères sur grand écran.

### 3.3 Formes et profondeur

- Les dossiers, tableaux et surfaces éditoriales restent carrés.
- Les boutons, champs et contrôles utilisent le rayon existant de 8 px.
- La forme pilule est réservée à un statut court ou à un filtre sélectionnable. Elle ne sert pas à chaque métadonnée.
- Les cartes imbriquées n'ont pas d'ombre. Le dossier principal possède au maximum une ombre de scène.
- Les séparateurs de 1 px et les espaces définissent les groupes avant les fonds colorés.

### 3.4 Images et graphiques

Les grandes illustrations décoratives sont retirées des décisions. Elles prennent la place des arbitrages sans ajouter de preuve. Les visuels de confiance sont les graphiques exacts, les chronologies et les comparaisons sourcées. Aucun visuel généré n'est utilisé pour représenter une donnée publique.

## 4. Composition du simulateur

### 4.0 Navigation et entrée dans le mandat

La navigation globale conserve les trois destinations France, Territoires et Simuler. Elle utilise le même motif actif sur grand écran et mobile : texte renforcé et filet d'accent, sans pilule. La marque renvoie à l'accueil.

Le header global reste visible sur l'introduction du simulateur. Il est remplacé par la barre de mandat seulement après le démarrage de la session. La barre de mandat contient alors une sortie explicite vers France.

### 4.1 Barre de mandat

La barre reste visible et ne dépasse pas 64 px sur grand écran et 84 px sur mobile, répartis sur deux lignes maximum. Elle contient seulement :

- le solde annuel ;
- le chapitre ;
- la position sur 60 ;
- Pause.

La progression utilise un filet discret. Les indicateurs de croissance, services, majorité, réforme, opinion et marchés ne sont plus répétés dans cette barre.

### 4.2 Écran de mission

Sur grand écran, le dossier utilise une grille asymétrique : mission et promesse à gauche, déficit initial et action à droite. Sur mobile, la composition devient une seule colonne.

Le premier écran respecte les limites suivantes :

- 65 mots maximum avant l'action principale ;
- un seul chiffre dominant ;
- deux objectifs visibles, les autres après l'action ou dans un développement ;
- l'action principale entièrement visible à 390 x 844 px ;
- aucune moitié de bouton arbitraire sur grand écran.

### 4.3 Introduction de chapitre

L'introduction présente une tension, pas une page de couverture. Elle contient un titre, une phrase de situation, deux à quatre domaines en liste simple, une ligne de fracture et une action. Le dossier tient dans un écran courant sur grand écran et ne dépasse pas 90 mots.

### 4.4 Décision en trois profondeurs

Sur grand écran, la question occupe quatre colonnes et les options huit colonnes. Les options sont des lignes comparables empilées, pas deux ou trois grandes cartes égales. Elles mesurent de 148 à 176 px et tiennent ensemble dans un viewport de 900 px. Sur mobile, la question et les options forment une colonne. Une option fermée mesure de 128 à 160 px ; le premier choix entier et le début du suivant sont visibles à 390 x 844 px.

Chaque option fermée montre exactement :

1. le nom ;
2. le coût ou rendement annuel ;
3. l'effet principal ;
4. le niveau de risque.

La sélection n'applique aucun effet. Elle ouvre un seul niveau de détail sous l'option choisie : mécanisme, calendrier, gagnants, contributeurs et effets secondaires. Le bouton de confirmation apparaît dans ce niveau, avec les actions Modifier et Confirmer et voir l'impact. Les hypothèses, réserves et sources restent dans un volet de preuve distinct.

Les autres options demeurent visibles pendant la lecture du détail afin de préserver la comparaison. Un seul détail peut être ouvert à la fois.

### 4.5 Résultat causal obligatoire

Une confirmation ne passe jamais directement au dossier suivant. Elle remplace le contenu variable du même écran par un état de résultat persistant, sans ajouter une page ni une interaction intermédiaire. Cet état contient :

- la décision enregistrée ;
- deux ou trois métriques réellement modifiées ;
- une phrase de mécanisme ;
- l'échéance du prochain effet différé, si elle existe ;
- une action explicite vers le dossier suivant.

Le résultat n'affiche aucun indicateur inchangé. Chaque variation donne accès à sa cause. Cet état est indispensable pour rendre les décisions plus impactantes sans amplifier artificiellement les chiffres.

### 4.6 Conseil, crise et conséquence différée

Le conseil de situation regroupe quatre signaux maximum et les relie aux décisions récentes. Une crise utilise une surface bleu nuit plate, un filet rouge et un libellé clair. Elle n'emploie ni panorama décoratif, ni nouvelle palette.

Une crise présente dans cet ordre : cause, enjeu immédiat, réponses possibles, concessions, calendrier. Les réponses sont des lignes comparables et suivent les mêmes règles de sélection qu'une décision.

### 4.7 Journal et verdict

Le journal est regroupé par chapitre puis par année. Chaque groupe fermé montre un résumé en une phrase, le nombre de décisions et les effets encore actifs. Une seule chaîne causale est ouverte à la fois.

Le verdict ne produit pas de note globale. Il présente séparément six dimensions sous forme de liste éditoriale asymétrique : finances, économie réelle, ménages et services, énergie et climat, stabilité politique, cohérence. Les jauges décoratives sont remplacées par une valeur, un delta, un qualificatif et les deux causes principales.

## 5. Page France et analyses

### 5.1 Préserver le récit principal

Le grand dossier France conserve son ouverture éditoriale et ses chapitres. La modification concerne la découverte des analyses, pas la suppression du récit budgétaire existant.

### 5.2 Sélection éditoriale

La zone d'analyses affiche huit dossiers mis en avant, un par grand thème, selon une composition asymétrique :

- un dossier principal sur deux tiers de la largeur ;
- deux dossiers secondaires empilés sur le tiers restant ;
- cinq liens compacts sous cette ouverture.

Sur mobile, ces huit entrées deviennent une liste. Elles ne sont pas rendues comme huit cartes lourdes.

Une navigation locale relie Vue d'ensemble, Dossiers et Questions. Elle évite d'ajouter une quatrième destination à la navigation primaire.

### 5.3 Recherche et catalogue

- Le champ possède un libellé visible au-dessus.
- Les filtres sont des onglets textuels ou des cases, avec un seul niveau de sélection.
- Le catalogue complet possède sa route `/analyses/`.
- Douze résultats maximum sont rendus au premier affichage.
- Une action explicite charge les résultats suivants.
- Le nombre total d'analyses n'est pas mis en scène comme objectif produit.
- Les états vide, erreur et absence de résultat proposent une sortie utile.

### 5.4 Dossier long

Un dossier autonome suit cet ordre :

1. réponse courte ;
2. définition et périmètre ;
3. graphique ou chronologie principale ;
4. comparaison ou facteurs ;
5. limites ;
6. sources.

Sur grand écran, la réponse et le chiffre ou graphique principal forment une ouverture asymétrique. Les graphiques occupent la largeur utile. Les sources sont reliées à la preuve concernée, puis regroupées en fin de dossier.

Le schéma de contenu représente les séries comme des séries, pas comme une succession de chiffres ponctuels. Chaque preuve et chaque série possède son propre `sourceId`, son unité, sa période et sa définition. Le rendu ne peut jamais attribuer automatiquement `sources[0]` à toutes les preuves.

## 6. Questions pré-rendues

L'espace de questions reprend le geste d'une conversation sans imiter un assistant génératif. Il se présente comme un bureau de réponses validées.

L'écran contient :

- un titre qui annonce clairement des réponses validées et sourcées ;
- un champ de question avec libellé visible ;
- cinq questions suggérées maximum ;
- une seule feuille de réponse ;
- une réponse courte visible immédiatement ;
- des développements pour méthode, limites et sources.

Les avatars, bulles de chat, indicateurs de frappe, faux flux de texte et promesses de réponse universelle sont interdits. Les quatre états sont `exact`, `matched`, `ambiguous` et `unsupported`. Une question ambiguë n'affiche aucune réponse et propose deux ou trois questions canoniques. Une question non couverte reçoit un refus explicite et trois suggestions maximum. Aucun appel à un modèle n'est déclenché en production.

Après résolution, l'adresse utilise l'identifiant canonique de la réponse, par exemple `/questions/prix-du-gaz/`. La question brute n'est jamais placée dans l'URL. L'index sans JavaScript liste les questions canoniques et leurs liens, sans empiler toutes les réponses.

## 7. Interaction et accessibilité

- Toutes les cibles tactiles mesurent au moins 44 x 44 px.
- Tous les contrôles possèdent un état repos, survol, focus, sélection, désactivation et erreur si applicable.
- Le focus visible utilise un contour contrasté et n'est jamais masqué par la barre de mandat.
- La sélection n'est jamais indiquée par la seule couleur.
- Les options forment un `fieldset` avec des radios ou des boutons `aria-pressed` et les effets sont liés par `aria-describedby`.
- La progression utilise un élément `progress` ou `role="progressbar"`.
- Le changement de dossier replace le défilement et le focus sur son titre.
- Le détail sélectionné peut être fermé avec Échap et son contrôle récupère le focus.
- Les graphiques possèdent un résumé textuel et les tableaux restent accessibles.
- `prefers-reduced-motion` supprime toutes les transitions non indispensables.
- Un journal vide, une baseline indisponible, un échec de sauvegarde et une source inaccessible possèdent chacun un état explicite et une action utile.

## 8. Motion

La motion sert uniquement à expliquer un changement d'état :

- sélection d'une option : 160 à 200 ms ;
- ouverture du détail : 180 à 220 ms ;
- passage au résultat : 220 à 260 ms ;
- mise en évidence d'un delta : une seule variation de couleur ou de position, sans comptage animé.

Il n'y a ni animation d'ambiance, ni parallaxe, ni apparition échelonnée des cartes.

## 9. Critères de recette design

La passe n'est terminée que si les contrôles suivants réussissent :

- aucune barre de défilement horizontale à 390, 768 et 1280 px ;
- action principale visible sur l'écran de mission à 390 x 844 px ;
- titre de décision entre 26 et 32 px à 390 px ;
- aucune illustration de décision visible ;
- une option fermée contient quatre informations, pas davantage ;
- un seul détail d'option ouvert à la fois ;
- résultat causal persistant avant le dossier suivant ;
- au plus trois métriques dans ce résultat ;
- barre de mandat sur deux lignes maximum à 390 px ;
- navigation entièrement utilisable au clavier ;
- contraste WCAG AA pour les textes et contrôles ;
- version réduite utilisable avec `prefers-reduced-motion` ;
- aucune variable CSS utilisée sans définition ;
- aucune couleur d'option déterminée par `:first-child` ou `:nth-child` ;
- thème cohérent du début à la fin de chaque page ;
- actif de navigation identique sur grand écran et mobile ;
- page France limitée à huit mises en avant et douze résultats initiaux ;
- chacun des huit grands thèmes possède au moins une mise en avant ;
- permalien canonique fonctionnel sans JavaScript pour chaque dossier et chaque réponse ;
- aucune question brute dans une URL ;
- réponse pré-rendue sans avatar, bulle, frappe simulée ou appel réseau vers un modèle ;
- vérification visuelle des écrans mission, chapitre, décision fermée, détail, résultat, crise, journal, verdict, France, dossier long et questions.

## 10. Conséquence sur les plans

Cet addendum est un prérequis des plans :

- `2026-08-30-v3-interface-compacte.md` ;
- `2026-08-30-v3-cinq-analyses.md` ;
- `2026-08-30-v3-questions-prerendues.md`.

En cas de conflit, les règles de densité, de résultat causal, de composition asymétrique et d'absence de faux chat définies ici prévalent.
