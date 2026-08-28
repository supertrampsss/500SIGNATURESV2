# Header « Journal de bord » et continuité du simulateur V3

## Objectif

Moderniser la navigation globale sans encombrer les pages et supprimer l'interruption de fin de chapitre qui casse le rythme du simulateur.

Le changement porte sur deux composants liés par un même principe : ne montrer une commande que lorsqu'elle est utile.

## 1. Flux du simulateur V3

### Comportement retenu

- L'écran de fin de chapitre intitulé « Le pays vous présente l'addition » disparaît entièrement.
- Après la résolution de la dernière décision d'un chapitre, le moteur prépare immédiatement le chapitre suivant.
- L'introduction du chapitre suivant reste affichée. Elle marque le changement de thème sans produire un récapitulatif intermédiaire.
- Après la dernière décision du huitième chapitre, le verdict final reste l'unique bilan complet de la partie.
- Les effets, crises, décisions devenues sans objet et métriques continuent d'être calculés. Seul leur écran récapitulatif intermédiaire est retiré.

### Transitions

1. Le joueur choisit la dernière décision du chapitre.
2. Les effets de cette décision sont appliqués et sauvegardés.
3. Les incompatibilités et conséquences sont résolues selon les règles existantes.
4. Si un chapitre reste à jouer, l'introduction suivante s'affiche directement.
5. Sinon, le verdict final s'affiche.

Le moteur ne doit jamais laisser persister un état `chapterVerdict` visible ou restaurable. Une ancienne sauvegarde située sur cet état doit avancer vers l'introduction suivante ou le verdict final.

## 2. Header global « Journal de bord »

### Desktop

Le header forme une barre compacte sur fond clair :

- marque « Où va l'argent public » à gauche ;
- signature courte « Les comptes publics, enfin lisibles » sous la marque lorsque la largeur le permet ;
- navigation France, Territoires, Simuler à droite dans une pilule neutre ;
- destination active remplie en bleu nuit ;
- bascule de thème conservée comme commande séparée, visuellement secondaire ;
- aucune recherche dans le header.

Le header reste collant mais ne doit pas masquer les ancres. Il ne reçoit ni grande ombre, ni bordure décorative rouge, ni fond bleuté global.

### Mobile

- première ligne compacte : marque et bascule de thème ;
- seconde ligne : trois destinations de largeur égale ;
- destination active indiquée par le texte renforcé et un filet rouge ;
- aucune icône ambiguë ni menu hamburger pour seulement trois destinations ;
- hauteur totale suffisamment faible pour préserver l'espace de lecture.

### Session V3 active

Quand la partie V3 a commencé, sa barre de commandement remplace le header global. Il n'y a jamais deux navigations superposées. Le lien de sortie du simulateur ramène vers France.

## 3. Recherche réservée à Territoires

L'unique champ existant et sa liste de suggestions sont déplacés dans la page Territoires. Aucun second moteur de recherche n'est créé.

### Position et contenu

- le module se place au début du contenu Territoires, avant la carte et la fiche ;
- titre : « Comprendre mon territoire » ;
- champ : « Rechercher une commune, un département ou une région » ;
- les suggestions, la navigation clavier et l'ouverture d'une fiche conservent leur comportement actuel ;
- après sélection, le module peut devenir plus compact mais le champ reste immédiatement accessible.

La recherche n'est pas rendue sur France, Simuler, Sources, Analyses ou les pages éditoriales.

## 4. Design system

Le composant réutilise les tokens actuels : bleu nuit, papier, rouge éditorial, espaces, rayons et focus. Les nouvelles règles sont regroupées dans la feuille de navigation, sans styles en ligne ni variante locale par page.

États à couvrir :

- lien normal, survolé, actif et focus clavier ;
- thème clair et sombre ;
- desktop, tablette et 390 px ;
- header global, Territoires avec recherche et session V3 active.

## 5. Accessibilité

- `nav` conserve le nom « Navigation principale » ;
- la page courante utilise `aria-current="page"` ;
- cibles tactiles d'au moins 44 px ;
- ordre clavier : marque, destinations, thème, puis contenu ;
- focus visible sur tous les liens et contrôles ;
- le déplacement du champ conserve son `label`, son rôle de combobox et sa liste associée ;
- aucun état ne dépend uniquement de la couleur.

## 6. Vérification

### Tests automatisés

- aucune scène V3 ne contient « Le pays vous présente l'addition » ;
- la fin d'un chapitre mène à l'introduction suivante ;
- la fin du dernier chapitre mène au verdict final ;
- une ancienne sauvegarde de fin de chapitre est migrée ;
- le header ne contient aucun champ de recherche ;
- le champ `#recherche` existe une seule fois et uniquement dans la vue Territoires ;
- les trois destinations et l'état actif restent corrects ;
- aucun débordement horizontal à 390 px.

### Contrôle visuel

- France desktop et mobile ;
- Territoires avant et après sélection ;
- Simuler avant la partie et pendant une partie V3 ;
- thème clair et sombre ;
- ancres non masquées par le header collant.

## Hors périmètre

- modification des 96 décisions ;
- modification des calculs de score ou de crise ;
- ajout d'une quatrième destination au header ;
- nouveau moteur de recherche ;
- refonte de la carte Territoires.
