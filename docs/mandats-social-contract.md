# Mandats v12 : mobilisations sociales

La version 12 devient la version des nouvelles parties nationales. Les liens explicitement versionnés et les sauvegardes v11 conservent leur moteur. Les manifestations lycéennes évoquées par le propriétaire motivent ce travail ; aucune revendication ou mesure de participation des événements actuels n'est attribuée sans source vérifiée. Le lycée, les collectifs et la presse du scénario sont fictifs.

## Parcours et règles

- Un dossier d'enseignement permet de préserver les postes, de regrouper des classes ou d'accompagner une réorganisation. Le regroupement adopté peut provoquer une mobilisation lycéenne. Un texte rejeté ne produit ni économie, ni dégradation du service, ni mouvement causé par son application.
- Les pertes importantes subies par les salariés, retraités, agents publics ou ménages modestes peuvent produire des mouvements distincts. Une amélioration d'un autre groupe n'annule pas leur préjudice.
- Chaque mouvement conserve les décisions qui l'ont provoqué, une revendication, une pression et une phase. La mobilisation peut évoluer vers une manifestation, une grève ou des blocages. Ces noms décrivent un scénario, sans convertir un indice en nombre réel de participants.
- Les mouvements continuent d'évoluer lorsqu'un autre dossier ou une crise institutionnelle occupe l'agenda. Le suivi visible reste compact ; le détail et le retour à la décision d'origine vivent dans le Bilan.
- Les réponses dépendent du sujet. Pour les lycées : suspendre le regroupement, redéployer les personnels avec une perte de moyens ailleurs, ou conduire une expérimentation datée. Pour les salariés : reconversions, partage du temps de travail ou négociation de branche. Pour les retraités : indexation, petites pensions ou calendrier négocié. Pour les agents : recrutements, réaffectations ou organisation pilote. Pour les ménages : tarif essentiel, aide au logement ou maintien des économies. Leurs bénéficiaires, coûts, sacrifices et délais diffèrent ; aider les retraités ne crée pas artificiellement des enseignants.
- Un financement adopté engage des crédits une seule fois. Le mouvement ne se résout qu'à l'échéance et si les capacités d'exécution sont présentes. Une concertation répétée ne repousse pas indéfiniment la même échéance.
- Les perturbations ont des effets de services/confiance et des coûts budgétaires temporaires. Ces coûts entrent dans le plan annuel et la clôture une seule fois ; ils ne s'empilent pas dans les dépenses ou recettes structurelles. Les coefficients sont des hypothèses du jeu.
- La pression affecte le soutien parlementaire et la légitimité ; les conséquences institutionnelles suivent les votes et les règles existantes. Une manifestation ne destitue pas directement le président.
- Trente décisions au maximum, cinq années, choix validé en un clic, verdict bref, mouvement réduit, sauvegarde immédiate et hors connexion restent les contrats du jeu.
- Aucun état social importé n'est autoritaire : reconstruction depuis la version, le seed et les identifiants de choix.

## Modes d'échec et preuves à produire avant livraison

1. Texte rejeté provoquant malgré tout le mouvement ou une concession rejetée le faisant disparaître.
2. Mobilisation effacée en choisissant un autre dossier, en rechargeant ou en changeant d'année.
3. Même concession débitée deux fois, promesse non financée tenue, délai de concertation remis à zéro à chaque clic.
4. Coûts temporaires permanents, dette clôturée deux fois, effets appliqués par l'animation ou le décor.
5. Sauvegarde falsifiée imposant une pression, un résultat de vote ou un mouvement résolu ; export, import, partage et rejeu divergents.
6. Mouvement sans sortie, réparation impossible après un manque de moyens, agenda de plus de trois fronts ou crise institutionnelle contournée.
7. Choix hors écran à 320/390 px, rassemblement décoratif sans correspondance avec l'état, animation contraire au mouvement réduit.
8. Nouveau moteur appliqué à un ancien lien v11, ou nouveau jeu restant en v11.

Les tests E2E couvrent les décisions adoptées/rejetées, l'escalade en traitant d'autres fronts, le financement puis la résolution, les perturbations budgétaires, le rejeu causal, l'export/import et le hors connexion. Les quatre parcours de `site/tests/fixtures/mandats-mobilisations-v12.json` proviennent de décisions réelles du moteur ; le parcours navigateur les importe puis vote une réponse spécifique à chaque acteur. Retenir rapports, captures, seed, viewport et entrées de rejeu dans `site/social-artifacts/`.
