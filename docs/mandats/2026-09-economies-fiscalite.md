# Économies et diversité fiscale du mandat national

La campagne v3/v4 proposait une baisse directe des charges dans 10 dossiers sur 45.
Les nouvelles parties nationales v5 en proposent une dans chaque dossier : trois
cartes, validation en un clic, une contrepartie visible pour chaque économie.
Une économie existante est précisée ; sinon elle remplace le choix passif.

Les leviers fiscaux distinguent niches, revenu, patrimoine, contrôle fiscal,
petites taxes, crédit d’impôt recherche, TVA, bénéfices exceptionnels, successions,
émissions, revenus du capital, transactions, cotisations, aviation et boissons sucrées.
Quatre mesures abaissent les prélèvements. Les contrôles coûtent immédiatement et
rapportent après un an. La contribution exceptionnelle s’éteint après un an.
Les cartes affichent les recettes différées.

## Hypothèses

Les montants sont des paramètres fictifs en milliards annuels, sans chiffrage
officiel ni description du droit en vigueur. Les économies portent sur des postes
distincts du fonctionnement hérité. Elles ne déduisent jamais un chantier refusé
ni une aide temporaire dont l’expiration est déjà programmée.
Une réduction de transfert interne ne suffit pas à économiser au niveau consolidé :
le scénario représente la réduction des prestations finales correspondantes.
Les éventuels frais de mise en œuvre sont inclus dans les montants nets, sauf
pour le contrôle fiscal dont le coût est affiché séparément.
Chaque économie affecte défavorablement au moins un indice de jeu.
Le modèle ne prédit pas les comportements fiscaux, les prix, l’emploi ou les économies
réalisables. Les cinq clôtures annuelles sont conservées.

## Compatibilité et vérification

Les sauvegardes et défis v1 à v4 gardent leurs règles et leurs résultats.
Le cache des dossiers sépare les versions. Les communes restent en v4.
Aucune sauvegarde n’est effacée ; un nouveau mandat national utilise v5.

Régressions : économie effective dans chacun des 45 dossiers, diversité fiscale,
coût puis rendement du contrôle, extinction unique de la contribution temporaire,
parcours complets pour trois stratégies et trois graines, sauvegarde à chaque clôture,
partage des résultats et maintien des règles v3/v4.

Inspection Chromium du premier dossier sur ordinateur et dans des cadres de 390 et
320 pixels : intitulés, conséquences et coûts lisibles, sans débordement horizontal.
Une économie s’applique directement et ouvre le dossier suivant. Les cadres ne
simulent pas iOS. La CI couvre les parcours complets sur Chromium et WebKit.
