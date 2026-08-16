# Les fontes de la rasterisation

Ces fichiers ne sont **pas servis aux visiteurs**. Le navigateur reçoit les
`.woff2` de `site/public/polices/`, déclarés en `@font-face` dans
`src/style.css` ; ceux-ci ne servent qu'au build, à `scripts/rasteriser.ts`,
qui doit donner à resvg les octets d'une fonte — resvg ne connaît aucune police
système, et un texte rendu sans fonte fournie sort invisible.

Ils vivent donc sous `scripts/` et non sous `public/` : `public/` est recopié
tel quel dans `dist/`, et y poser un mégaoctet de TTF ferait télécharger aux
lecteurs des fontes que leur navigateur n'utilise pas.

Les `.woff2` du site ne conviennent pas ici pour deux raisons : ce sont des
sous-ensembles routés par `unicode-range`, et `fontdb`, sur lequel resvg
s'appuie, ne décode pas le woff2. Il faut la fonte complète, en TTF.

## PublicSans-Regular.ttf

C'est la fonte de corps du site — la carte de partage doit ressembler au site
dont elle porte l'adresse.

| | |
|---|---|
| Origine | <https://raw.githubusercontent.com/uswds/public-sans/main/fonts/ttf/PublicSans-Regular.ttf> |
| Version | 2.001 (table `name`, identifiant 5) |
| Octets | 84 836 |
| SHA-256 | `b577e9bc9887284e90aae5ad0699689ce36b5cd96207efbec68f77f8aed88379` |
| Licence | SIL Open Font License 1.1, `PublicSans-LICENSE.md` ci-contre, copié depuis <https://raw.githubusercontent.com/uswds/public-sans/main/LICENSE.md> |
| Modifications | aucune ; le fichier est celui du dépôt amont, octet pour octet |

Public Sans est un dérivé de Libre Franklin publié par la GSA ; la licence
ci-contre l'explique et conclut que l'ensemble s'utilise sous les termes de
l'OFL 1.1, qui autorise la redistribution.

La version statique **Regular** est prise à l'amont plutôt qu'à `google/fonts`,
qui ne publie plus que la fonte variable `PublicSans[wght].ttf` : son instance
par défaut est `wght = 100`, c'est-à-dire le Thin, et une carte rendue avec une
graisse Thin ne serait pas celle du site.

### Ce que la fonte couvre, et ce qu'elle ne couvre pas

Vérifié sur ce fichier : les accents français, les ligatures `œ`/`Œ`, les
guillemets `«` `»`, l'apostrophe courbe, le signe `€`, le signe moins `−`
(U+2212) que pose `moins()` — tous présents.

**U+202F, l'espace fine insécable que `formater()` pose entre les groupes de
chiffres, est absente de la fonte** (comme des huit `.woff2` du site). Le texte
sort quand même juste : rustybuzz, le façonneur de resvg, connaît les espaces
d'Unicode et fabrique l'avance manquante — U+202F reçoit la moitié de l'avance
de l'espace ordinaire, soit 0,1217 em ici, sans qu'aucun glyphe soit peint. Ce
n'est pas une supposition : `scripts/rasteriser.test.ts` le mesure sur les
pixels, et distingue ce repli d'un caractère réellement absent, qui lui sort en
carré `.notdef`.

## Spectral n'est pas ici

Le site l'emploie pour ses titres, mais `src/carte-og.ts` ne dessine qu'avec
une seule famille (`font-family="sans-serif"`, voir la constante `POLICE`).
Embarquer une seconde fonte que rien ne demande ferait un mégaoctet de plus
dans le dépôt sans changer une image. Le jour où une carte réclamera Spectral,
elle s'ajoutera ici de la même façon : fichier amont non modifié, licence à
côté, empreinte consignée.
