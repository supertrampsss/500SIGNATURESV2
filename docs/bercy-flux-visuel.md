# Budgets ministériels : flux vers les retraites

Maquette approuvée par le propriétaire le 20 octobre 2026 : [référence](bercy-flux-reference/reference.png).

Le graphique traduit la maquette en éléments vectoriels et textes calculés. Les flux bleus restent propres à chaque ministère ; seules les branches rouges rejoignent la destination Retraites. L’Éducation nationale, l’Intérieur et la Défense forment la sélection validée. Le total affiché concerne ces trois ministères, avec les cotisations salariales estimées ; il ne représente pas toutes les retraites françaises. Les montants viennent des données monétaires archivées, sans conversion du dessin ImageGen.

La page conserve le tableau des 19 ministères après le visuel. La donnée complète de l’Enseignement supérieur reste indisponible. France, Salaires et le dossier partagent la même représentation. Le dossier utilise des références de preuves explicites pour sa sélection, sans dépendre de son URL ni de l’ordre implicite des lignes.

Le rendu ordinateur présente les crédits initiaux à gauche, les crédits après reclassement dans des flèches bleues et les branches rouges vers un seul total. Les épaisseurs utilisent une échelle monétaire commune ; les labels restent lisibles même pour les petites branches. Une composition mobile propre conserve les montants en texte et la destination commune, sans réduire le dessin ordinateur jusqu’à rendre ses lettres illisibles.

Charte : Spectral et Source Sans 3, marine #092d58, rouge #c52438, panneaux #fffefa sur fond #f5f4ed. Aucun fond photographique ou texte du graphique n’est incorporé dans une image raster.

La capture WebKit Windows a révélé que Source Sans 3 variable restait en graisse 200, malgré les poids CSS et l’axe `wght` explicites. Le graphique charge donc deux instances statiques latines de la même police (400 et 700, 44 256 octets ensemble), renommées Budget Flux Sans conformément à sa licence OFL. Le [script de régénération](bercy-flux-reference/generate-fonts.py) et la provenance dans `site/public/mandats/fonts/SOURCES.md` rendent ce choix reproductible ; les autres composants gardent leurs polices.

Contrôles : conservation budget = retraites + reste pour chaque ministère ; total de la sélection calculé depuis ses seules lignes ; références et unités du dossier ; maintien des 19 lignes et de la donnée absente ; montants visibles, absence de débordement et inspection des captures sur ordinateur, petit téléphone, Chromium et WebKit. Compilation et contrôles CI restent nécessaires avant fusion et publication.

Captures réelles : [avant](bercy-flux-reference/before-desktop.png),
[après sur ordinateur](bercy-flux-reference/after-desktop.png),
[après sur téléphone](bercy-flux-reference/after-mobile.png).
Le tableau de l’ancienne version reste présent sous le nouveau graphique.

Validation locale du 20 octobre 2026 : `npm run check` (1 127 tests unitaires et
compilation complète), contrôle Python des 14 dossiers et parcours des trois pages
à 320, 390 et 1 280 px (montants exacts, polices et absence de débordement).
Les 15 parcours Playwright passent sur Android, iPhone WebKit, écran compact,
mode paysage et ordinateur. Les captures ci-dessus correspondent au rendu réel.
