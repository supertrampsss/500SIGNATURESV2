# Agenda national v8 et parcours mobile

La v7 imposait une suite à chacune des vingt grandes réformes. La v8 applique chaque
vote une seule fois et réserve les réactions à des conséquences différées.

Le catalogue contient 30 réformes, 25 décisions débloquées et 15 crises possibles.
Une partie joue 45 dossiers : 30 réformes et 15 autres décisions, dont 0 à 5 crises.
Deux emplacements sur trois accueillent une réforme ; le troisième sélectionne un
dossier éligible selon les choix, les conditions sociales et la graine du scénario.
Les identifiants déjà joués sont exclus. Aucune crise ne sert à confirmer ou retirer
le vote précédent. Les rendements restent des hypothèses du jeu.

Une crise nécessite le vote de sa réforme source, cinq décisions de délai, un seuil
social franchi et cinq décisions de distance avec la dernière crise. Les seuils
sont 50 pour les retraités, 55 pour les nouveaux résidents et 45 pour les autres
groupes : paramètres de simulation, pas des mesures observées. L’éligibilité est
recalculée ; un redressement annule une crise latente. Les effets sociaux sur le
budget continuent même lorsqu’aucune carte n’apparaît. Les décisions débloquées
priorisent les sujets affectés par les choix, puis les besoins et la diversité.

La réforme de résidence est votée une seule fois dans un scénario juridique
explicitement modifié : coût préparatoire ponctuel, coût de gestion annuel, puis
économie hypothétique après un an. Aucun gain de 9 Md€ ne lui est attribué.

La présentation mobile conserve le style et réduit le décor à 104 px, condense le
budget, remonte la question, rend les cartes lisibles sans troncature et présente
l’effet précédent au-dessus de la nouvelle question. Le contexte long reste sous
les cartes. Les onglets restent au bas de l’écran. Si le joueur a fait défiler la
question hors de l’écran, le vote ramène la prochaine question dans la zone de
lecture, sans retourner en haut de page. Les règles CSS sont limitées au mobile.

Les sauvegardes et défis v1 à v7 restent rejouables selon leurs règles. Les nouvelles
parties nationales démarrent en v8. Les tests couvrent 45 choix, le plafond et les
délais des crises, les branches fermées, la reprise, l’atelier et les chemins vers
l’équilibre sur les douze combinaisons de crises annuelles. Le test navigateur joue
dix choix différents et contrôle la question, la navigation et la sauvegarde.
