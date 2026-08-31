# V3 flux continu, crises jouables et verdict unique

Date : 31 août 2026

Statut : validé par les retours utilisateur du 31 août 2026

Périmètre : simulateur V3, du premier dossier au verdict final

## 1. Objectif

Le simulateur doit donner la sensation d'un mandat continu. Un clic sur une option enregistre immédiatement le choix. Le jeu applique ensuite silencieusement les conséquences arrivées à échéance, interrompt le mandat uniquement lorsqu'un véritable conseil de crise exige un nouvel arbitrage, puis ouvre le dossier suivant. Une seule page de bilan subsiste : le verdict final.

## 2. Flux cible

Le parcours normal est :

1. dossier et deux options ;
2. clic sur une option, validation immédiate ;
3. application silencieuse des effets immédiats et différés arrivés à échéance ;
4. conseil de crise uniquement si un seuil est franchi ;
5. dossier suivant ;
6. verdict final après le dernier dossier.

Les écrans `decision_result`, `delayed_event` et `council` ne constituent plus des pauses visibles. Ils peuvent rester dans le schéma de sauvegarde pour restaurer les anciennes parties, mais le contrôleur les normalise avant rendu vers une scène encore visible.

## 3. Cartes de décision

Avant le choix, une option montre seulement :

- son intitulé ;
- son effet budgétaire annuel lorsque cet effet existe ;
- sa courte description de politique publique lorsqu'elle est nécessaire pour distinguer les options.

Les variations d'opinion, de confiance, de majorité, de marchés, de services ou de groupes ne sont pas affichées. Aucun remplacement qualitatif du type `sans contestation`, `risque limité` ou `mesure populaire` n'est ajouté. Ces effets restent calculés, historisés et révélés dans le verdict et le journal.

Le coût ou rendement budgétaire reste visible car il constitue la règle centrale du jeu.

## 4. Effets différés

Les effets arrivés à échéance sont résolus avant la détection d'une crise et avant le calcul d'un point annuel. Leur ordre reste : événements, promesses, crise, point annuel, transition de dossier.

La suppression de l'écran ne doit jamais supprimer la causalité. Chaque effet conserve sa source, son dossier, son échéance, son entrée de journal et son incidence sur le verdict.

Une sauvegarde ancienne restaurée en phase `delayed_event` est avancée automatiquement une seule fois. Un effet déjà présent dans l'historique ne peut pas être appliqué de nouveau.

## 5. Conseils de crise

Un conseil de crise possède toujours exactement deux réponses réellement différentes :

- maintenir la politique qui a causé la crise ;
- céder sur cette politique ou la réécrire de manière précise.

La concession doit viser une décision aggravante effectivement adoptée. Chaque paire `décision:option` susceptible de déclencher une crise possède au moins une concession correspondante dans le catalogue. L'AME doit notamment proposer le maintien de sa suppression ou son rétablissement.

Les boutons de crise n'affichent aucun delta politique chiffré avant le choix. La validation de scénario échoue si une cause possible ne possède pas de concession.

## 6. Verdict unique

Les points annuels continuent d'être calculés et sauvegardés, mais ne produisent plus la page `Le pays réagit à vos arbitrages`. Après le dernier dossier et après toute crise éventuelle, le joueur arrive directement au verdict final.

Le verdict final reste la seule synthèse plein écran. Le journal et les checkpoints annuels restent accessibles depuis ce verdict sans créer un second bilan obligatoire.

## 7. Jouabilité budgétaire

Le catalogue doit permettre d'atteindre un solde annuel nul ou positif par des choix cohérents et effectivement accessibles. Le contrôle porte sur le chemin réel du moteur, y compris les conflits, verrouillages, effets différés et crises, pas sur la somme brute des montants affichés.

Critères :

- au moins un chemin déterministe atteint 0 milliard d'euros ou mieux ;
- l'équilibre ne dépend pas d'une recette ponctuelle présentée comme annuelle ;
- le chemin d'équilibre exige plusieurs familles de mesures, pas un bouton magique ;
- les nouveaux dossiers correspondent à des propositions présentes dans le débat public et possèdent une source primaire ;
- un test calcule le meilleur solde accessible et empêche toute régression sous zéro ;
- les montants restent des ordres de grandeur prudents et documentés.

## 8. Compatibilité et accessibilité

- Les sauvegardes de schéma 4 restent restaurables.
- Les phases historiques invisibles sont normalisées sans double application.
- Les options restent des boutons accessibles au clavier et mesurent au moins 44 px.
- Le changement réel de dossier replace le focus sur son titre ; le clic sur une option ne remonte pas la page avant que la scène suivante soit prête.
- Aucun cadratin n'est introduit dans le texte visible.
- Aucun débordement horizontal n'est accepté à 390 px.

## 9. Recette

La livraison est acceptée si :

- aucune scène visible ne contient `Les effets annoncés arrivent à échéance` ;
- aucune scène visible ne contient `Le pays réagit à vos arbitrages` ;
- une partie terminée rend exactement un verdict ;
- les cartes ne contiennent aucun impact politique chiffré ou qualitatif ;
- chaque crise rend exactement deux choix applicables, y compris l'AME ;
- les effets différés et les checkpoints sont toujours présents dans l'état final ;
- au moins un parcours automatisé atteint un solde annuel nul ou positif ;
- les tests, le typage, le build et le contrôle visuel mobile réussissent.
