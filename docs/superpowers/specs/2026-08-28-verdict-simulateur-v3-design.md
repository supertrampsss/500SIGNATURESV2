# Verdict final du simulateur V3

Date : 28 août 2026  
Statut : direction validée, prête pour revue de la spécification  
Périmètre : écran final de la campagne nationale de 96 décisions  
Référence : première planche du « Cabinet de crise », sans médaillon

## 1. Décision

Le verdict final devient un écran de résultat autonome, conçu comme la conclusion d'un mandat et non comme un tableau de bord générique. Il conserve la coque bleu nuit, le papier ivoire, les titres éditoriaux en serif et les accents rouges de la V3, mais possède sa propre composition, ses propres composants et sa propre hiérarchie.

Le verdict doit procurer trois sensations successives :

1. comprendre immédiatement l'issue du mandat ;
2. voir comment les choix ont produit cette issue ;
3. avoir envie de partager le résultat ou de rejouer autrement.

Le médaillon, le portrait et tout avatar institutionnel restent interdits. Aucun cadratin n'est utilisé dans l'interface.

## 2. Problème observé

L'écran actuel réutilise les composants génériques du Conseil et produit une grille uniforme :

- le titre est trop grand pour sa largeur et peut sortir de la zone visible ;
- le solde, la croissance, le pouvoir et l'opinion ont la même importance visuelle ;
- la grille ressemble à un tableau HTML brut ;
- les trois décisions décisives répètent souvent la même formulation sur deux lignes ;
- les crises et les réformes abandonnées sont réduites à une phrase comptable ;
- le résultat ne montre aucune trajectoire entre le début et la fin du mandat ;
- les actions finales arrivent trop tard dans la lecture ;
- la version mobile empile des blocs sans produire une fiche de résultat mémorable.

Le moteur calcule désormais les quatre valeurs. La refonte porte sur leur narration et leur représentation, pas sur les règles économiques ou politiques.

## 3. Approches étudiées

### A. La une de fin de mandat, retenue

Une couverture éditoriale forte ouvre le verdict. Le solde annuel domine, trois signaux compacts résument le pays, puis une trajectoire et trois décisions expliquent le résultat.

Avantages : mémorable, lisible en quelques secondes, cohérent avec la première planche validée, excellent potentiel de partage.

Risque : la hiérarchie doit rester contenue pour ne pas produire un titre spectaculaire mais vide.

### B. Le tableau de bord présidentiel

Toutes les variables sont réunies dans une grille dense avec jauges, groupes et historiques.

Avantages : exhaustif et facile à comparer entre parties.

Risque : froid, peu narratif, proche de l'écran actuel et médiocre sur mobile.

### C. L'affiche de jeu

Un score global, un rang et une illustration dominent la page, avec les détails relégués plus bas.

Avantages : très ludique et viral.

Risque : simplifie excessivement un mandat politique et contredit le refus d'un score idéologique unique.

La direction A est retenue et enrichie d'une petite trajectoire causale issue du moteur.

## 4. Architecture de l'écran

L'ordre du DOM et de lecture est identique sur toutes les tailles :

1. issue du mandat ;
2. score financier principal ;
3. croissance, pouvoir et opinion ;
4. trajectoire du mandat ;
5. trois décisions décisives ;
6. crises et réformes abandonnées, uniquement si elles existent ;
7. partage, revanche et retour vers France.

La barre de commandement de campagne reste visible, mais sa progression disparaît au verdict. Elle affiche seulement la marque, « Mandat terminé » et le retour vers France. Le bouton Pause disparaît.

## 5. Couverture du verdict

### 5.1 Bloc éditorial

Le bloc contient :

- le sourcil « Votre mandat » ;
- un titre de résultat construit par le moteur ;
- une phrase courte avec le nombre d'arbitrages réels, les dossiers devenus sans objet et les crises ;
- aucune seconde phrase méthodologique.

Le titre possède une largeur maximale de `13ch` sur ordinateur et `16ch` sur mobile. Sa taille est bornée pour rester entièrement visible à 320 px et à 1440 px. Il ne dépasse jamais quatre lignes à 390 px ni trois lignes à 1440 px.

### 5.2 Totem financier

Le solde annuel est le chiffre principal. Il est présenté dans un totem distinct :

- libellé « Solde annuel » ;
- valeur finale arrondie en milliards d'euros ;
- variation par rapport au déficit initial ;
- état verbal court : « équilibre », « déficit réduit », « déficit persistant » ou « déficit aggravé ».

La couleur complète la lecture mais ne la remplace pas. Le texte porte toujours le sens du résultat.

### 5.3 Trois signaux du pays

Croissance, pouvoir et opinion sont trois cartes compactes de second niveau. Chacune affiche :

- le libellé ;
- la valeur finale ;
- la variation depuis l'entrée en fonction ;
- une barre ou un repère de position accessible.

Le pouvoir utilise la majorité comme valeur principale et mentionne la capacité de réforme dans son libellé accessible. Il ne mélange pas les deux nombres dans le même grand chiffre.

Les trois signaux ne peuvent jamais être plus grands que le solde annuel.

## 6. Trajectoire du mandat

Une bande intitulée « Votre trajectoire » montre cinq états : début du mandat, fin du chapitre 2, fin du chapitre 4, fin du chapitre 6 et verdict.

Elle affiche deux lignes seulement :

- solde annuel ;
- pouvoir politique.

Les valeurs intermédiaires sont reconstruites à partir du registre causal et de `appliedAtDecision`. Le composant de rendu ne modifie pas l'état de campagne. Il prépare un modèle de vue déterministe à partir de l'état initial et des effets déjà enregistrés.

Sur ordinateur, la trajectoire est une ligne horizontale avec cinq jalons lisibles sans survol. Sur mobile, elle devient une liste verticale compacte. Aucun graphique ne dépend d'une infobulle.

Si une ancienne sauvegarde ne permet pas de reconstruire un point, celui-ci est omis. Aucune valeur n'est inventée.

## 7. Décisions décisives

Le titre de section devient « Les décisions qui ont changé le mandat ».

Chaque carte contient :

- son rang de 1 à 3 ;
- le choix effectivement retenu ;
- le chapitre concerné ;
- son effet annuel sur le solde lorsqu'il existe ;
- un second effet structurant parmi croissance, majorité ou opinion lorsqu'il existe ;
- son statut final si la réforme a été suspendue, amendée ou renversée.

La question du dossier n'est pas répétée lorsque son texte est identique ou presque identique au choix. Une seule formulation éditoriale est affichée.

Le classement privilégie l'impact absolu sur le solde annuel. En cas d'égalité ou d'absence d'effet budgétaire, il utilise l'amplitude cumulée sur croissance, majorité et opinion. Une décision devenue sans objet n'est jamais classée.

## 8. Crises et réformes abandonnées

Cette partie n'apparaît que si le mandat contient une crise ou une décision suspendue, amendée ou renversée.

Elle prend la forme d'un registre compact, pas d'une nouvelle grille de scores :

- nom de la crise ;
- décision qui l'a déclenchée ;
- choix de résolution ;
- réforme finalement abandonnée ou transformée.

Le cas vide n'affiche aucun bloc et aucune phrase « aucune crise ».

## 9. Actions finales

Trois actions terminent la fiche :

1. **Partager mon mandat**, action principale ;
2. **Prendre ma revanche**, action secondaire ;
3. **Revenir à France**, lien tertiaire.

Partager utilise `navigator.share` lorsque disponible, puis le presse-papiers, puis une invite de repli. Le texte partagé contient le solde, la croissance, le pouvoir, l'opinion et une URL vers le simulateur. Aucun partage ne doit révéler une information personnelle.

Les actions restent dans le flux du document. Elles ne sont pas fixées au bas de l'écran et ne masquent aucun contenu.

## 10. Composition desktop

À partir de 1024 px :

- largeur maximale de la fiche : 82rem ;
- grille d'ouverture asymétrique : environ 7 colonnes pour l'éditorial, 5 pour le totem financier ;
- les trois signaux s'alignent sous l'ouverture ;
- la trajectoire occupe toute la largeur ;
- les trois décisions forment trois cartes de même hauteur ;
- les actions tiennent sur une ligne lorsque leurs libellés le permettent.

Le papier ivoire reste le support principal. Les cadres sont limités au totem, aux signaux et aux décisions. La structure repose surtout sur la typographie, l'espace et des séparateurs fins.

## 11. Composition mobile

Le mobile à 390 px est la référence. Le résultat reste utilisable à 320 px.

- une seule colonne ;
- marge latérale minimale de 16 px ;
- aucun mot ou montant coupé artificiellement ;
- solde annuel visible dans le premier écran après le titre ;
- signaux regroupés dans une bande de trois lignes, pas trois grandes cartes ;
- trajectoire verticale sans défilement horizontal ;
- décisions empilées ;
- actions de 48 px minimum et pleine largeur ;
- aucun contenu essentiel dans un accordéon ;
- aucun carrousel ;
- aucun survol requis.

La page constitue la fiche partageable. La première livraison partage un texte court et son URL, sans produire une image personnalisée ni une capture illisible de la page entière.

## 12. Système visuel

La refonte réutilise exclusivement les variables V3 existantes :

- coque `--v3-shell` ;
- dossier `--v3-dossier` ;
- papier `--v3-paper` ;
- encre `--v3-ink` ;
- accent `--v3-red` ;
- succès `--v3-green` ;
- séparateur `--v3-rule` ;
- typographies `--serif` et `--sans` ;
- échelle d'espacement du site.

Les nouvelles classes sont limitées au composant verdict et préfixées par `.simulateur-v3__verdict-`. Aucun style global n'est modifié pour compenser un problème local.

Les nombres utilisent des chiffres tabulaires. Le solde est arrondi en milliards sans décimales, conformément aux règles éditoriales du site. La croissance conserve une décimale. Les scores politiques sont des entiers sur 100.

## 13. Mouvement

À l'arrivée sur le verdict :

- le titre et le solde apparaissent immédiatement ;
- les trois signaux peuvent se stabiliser en 240 ms ;
- la trajectoire peut se dessiner en 400 ms ;
- aucune animation ne retarde les actions.

Avec `prefers-reduced-motion: reduce`, toutes ces transitions sont supprimées.

## 14. Accessibilité

- un seul `h1` ;
- sections nommées avec des `h2` ;
- ordre DOM identique à l'ordre visuel ;
- valeurs et variations lisibles par lecteur d'écran ;
- aucune information portée seulement par rouge ou vert ;
- contraste WCAG 2.1 AA ;
- cibles tactiles de 44 px minimum, 48 px sur mobile ;
- focus visible sur les trois actions ;
- graphique de trajectoire accompagné d'une liste textuelle accessible ;
- texte partagé disponible sans dépendre de Web Share.

## 15. Architecture technique

Le moteur reste inchangé. Le rendu ajoute une préparation pure du verdict :

```ts
type MandateVerdictViewModel = {
  headline: string;
  summary: string;
  balance: VerdictMetric;
  signals: [VerdictMetric, VerdictMetric, VerdictMetric];
  trajectory: VerdictCheckpoint[];
  decisiveChoices: VerdictChoice[];
  aftermath: VerdictAftermath[];
};
```

`buildMandateVerdictViewModel(state, scenario)` calcule cette structure. `renderVerdict` ne trie plus et ne déduit plus directement les informations dans le gabarit HTML.

Le partage reçoit le même modèle de vue afin que la page, le texte copié et la carte partageable ne divergent pas.

## 16. États limites

- Solde positif : le signe et le mot « excédent » sont affichés explicitement.
- Croissance négative : la valeur reste lisible et le signal précise « récession ».
- Majorité ou opinion à 0 ou 100 : la jauge conserve une bordure et un libellé visible.
- Aucune crise : la section des crises n'est pas rendue.
- Moins de trois décisions classables : seules les décisions disponibles sont affichées.
- Libellé de décision long : maximum de quatre lignes sur mobile, puis composition fluide sans troncature de sens.
- Partage indisponible : le texte est présenté dans une invite de repli.

## 17. Vérification

### Tests de rendu

- le solde précède les trois signaux dans le DOM ;
- les quatre chiffres proviennent de l'état de campagne ;
- la variation utilise les valeurs initiales du moteur ;
- une décision n'est jamais répétée sur deux lignes identiques ;
- une décision suspendue porte son statut ;
- le bloc de crises disparaît dans le cas vide ;
- les trois actions existent dans le bon ordre ;
- aucun cadratin n'est servi.

### Tests du modèle de vue

- trajectoire reconstruite depuis le registre causal ;
- classement déterministe des décisions ;
- sauvegardes anciennes sans point intermédiaire ;
- valeurs extrêmes et arrondis ;
- partage construit avec les mêmes chiffres que l'écran.

### Contrôle visuel réel

Captures obligatoires :

- 1440 par 1000 px ;
- 1024 par 768 px ;
- 390 par 844 px ;
- 320 par 700 px.

Pour chaque format :

- titre entièrement visible ;
- aucun débordement horizontal ;
- aucun montant coupé ;
- solde clairement dominant ;
- actions visibles et utilisables ;
- concordance avec la première planche sans médaillon ;
- inspection visuelle, pas seulement tests DOM.

## 18. Critères d'acceptation

La refonte est terminée lorsque :

1. le verdict ne réutilise plus la grille générique du Conseil ;
2. le résultat et le solde se comprennent en moins de cinq secondes ;
3. croissance, pouvoir et opinion restent secondaires mais lisibles ;
4. la trajectoire explique l'évolution du mandat sans inventer de données ;
5. les trois décisions ne répètent plus leur question ;
6. crises et réformes abandonnées ne créent aucun bloc vide ;
7. partager, rejouer et revenir vers France fonctionnent ;
8. l'écran réel correspond à la direction validée sur desktop et mobile ;
9. aucun cadratin n'est présent ;
10. les tests, le build, le déploiement et le contrôle de production réussissent.

## 19. Hors périmètre

- modification des règles économiques ou politiques ;
- nouveau classement public ;
- compte utilisateur ;
- comparaison avec les autres joueurs ;
- illustration figurative ;
- refonte des dossiers, crises, conseils ou transitions de chapitre.
