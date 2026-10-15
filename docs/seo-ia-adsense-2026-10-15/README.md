# Preuves de vérification SEO et accès IA

Le 15 octobre 2026, comparaison de la production avant livraison et du build
local sur `codex/seo-ia-adsense-20261015`. Aucune capture de messagerie ou de
compte privé n’est conservée ici.

- [Accueil avant, 390 px](before-home-390.png) et [après](after-home-390.png).
- [Guide avant, 1 440 px](before-guide-1440.png) et [après](after-guide-1440.png).
- [Accueil sans JavaScript, 320 px](static-home-320.png).
- [Ville sans JavaScript, 390 px](static-ville-390.png).
- [Métadonnées des 35 pages publiques avant modification](before-public.json).
- [Pages du build et contenu du guide IA](built-pages-and-llms.json).
- [Parcours ciblés : 61 réussis, quatre répétitions ignorées](browser-final.log).
- [En-tête : trois formats réussis](header-final.log).
- [Pages complètes sans script : entrées et observations](static-readerviews.json).

Les captures avant/après sont de vraies pages entières. L’accès à Google
Analytics a été refusé avant les captures avec script. Les relevés sans script
portent sur l’accueil, Ville et le guide à 1 440 × 900, 390 × 844 et 320 × 640,
dans Chromium système. Les aides sont aussi ouvertes par action native dans les
tests navigateur, avec clavier et sans script, sur Chromium et WebKit.

Pour reproduire depuis `site/`, Node 22 ou plus récent et navigateurs Playwright
installés :

```sh
ADSENSE_PUBLISHER_ID=ca-pub-6705187262207125 npm run check
npx playwright test --config playwright.mandats.config.ts --grep 'SEO :|Audience :|Lancement :|Dossiers : qualité|Confiance :'
npx playwright test --config playwright.header.config.ts
```

Dans cet environnement, `NODE_USE_ENV_PROXY=1` permet au build de lire les données
publiques ; les exécutables ont été indiqués avec
`MANDATS_CHROMIUM_EXECUTABLE=/usr/bin/chromium` et
`MANDATS_WEBKIT_EXECUTABLE=/workspace/mandats-browser-libs/run-webkit.sh`.
Les rapports HTML complets et entrées de rejeu restent dans les répertoires
locaux de validation et seront aussi joints aux workflows GitHub.

Ces résultats vérifient les pages et les parcours. Ils ne mesurent pas les
visites réelles et ne prouvent ni indexation, ni classement, ni acceptation AdSense.
