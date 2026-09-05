# France : un seul mandat jouable

La scène animée appartient désormais au jeu national de 45 décisions sur cinq années. Le parcours expérimental « Deux hivers », son économie en crédits et sa sauvegarde séparée sont retirés. Son ancienne URL rejoint `/mandats/?mode=national&v=4`.

## Règles conservées

- Le moteur national, les décisions, les montants en Md€, les événements et les clôtures annuelles ne changent pas.
- Les sauvegardes et les défis explicitement versionnés conservent leurs règles. L’entrée directe `?mode=national` ouvre la version 4 ; les anciens défis avec une graine et sans version restent historiques.
- L’argent affiché appartient à un scénario fictif portant sur les administrations publiques consolidées. Il ne s’agit pas des comptes actuels de la France.
- Une décision se prend en un clic. Les explications longues restent après les choix ; finances, territoire, journal et comparaison restent accessibles dans le même mandat.

## Scène

Le décor illustré et ses déplacements sont intégrés au moteur national. Lumières et activité visuelle expriment les indices de services et d’état des équipements. Ils ne mesurent ni chauffage réel ni emploi. Seuls des investissements positifs effectivement choisis alimentent les travaux ; les délais restent comptés en années. Un investissement annulé ne devient pas un chantier livré.

Le même SVG et la même image restent montés entre les décisions et les vues. Aucun WebGL n’est nécessaire. La vue légère, la préférence de mouvement réduit, l’onglet masqué et la sortie du champ arrêtent l’animation. Les visuels et le module sont inclus dans la préparation explicite hors connexion.

## Vérification

Tests de transition et de sauvegarde sur les 45 décisions ; tests navigateur de fin de mandat, montants, état visuel, SVG persistant, mouvement réduit, pause, absence de WebGL, ancienne URL et reprise hors connexion. Formats : 320 px, 390 px, iPhone WebKit, paysage WebKit, bureau 1280 px. Les captures servent à vérifier la lisibilité ; elles ne constituent pas une validation utilisateur du niveau visuel.
