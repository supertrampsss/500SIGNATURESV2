# Prototype 07, proportions et fidélité à la référence

Build complet servi sur `http://127.0.0.1:4191`. Captures du 8 octobre 2026 à 1672 × 941, contexte Chromium neuf, réduction des animations. [Référence confirmée](../reference-ordinateur.png).

Sept vues prises par les commandes visibles du jeu : national, Paris, Seine, retour national, Lyon, Alpes, retour final. Version 12, national, seed 0, ambition équilibre, aucune décision avant ou après. Aucun état dérivé ou pose de caméra injectés. La fermeture institutionnelle fonctionne et restaure le focus au marqueur Assemblée. Le navigateur est fermé.

Tous les secteurs : zéro pageerror, zéro warning/erreur console, zéro réponse HTTP en erreur, zéro requête échouée, pas de débordement horizontal. Modèles servis avec leurs versions de contenu architecture `f8e0fc41499a6063` et vegetation `22d88978198973b2`. Diagnostic réel : 525 maisons, 5 904 instances statiques, 25 lots. Aucun groupe de maisons ou d'arbres manifestement absent au national après sélection du LOD.

## Comparaison 05, 06, 07

| Version | Gain constaté dans les PNG | Limite persistante |
| --- | --- | --- |
| 05 | Neige blanche visible, forêt de contexte en volume, gares distinctes. | Pays aplati, bâtiments trop fins, sommets en pointes répétées. |
| 06 | Pays plus haut dans le cadre, monument mieux proportionné, massifs plus larges et neige répartie sur plusieurs versants. | Les champs dominent encore ; le gain de hauteur des maisons se lit surtout en inspection. |
| 07 | La largeur accrue rend les façades plus visibles et les maisons plus présentes au national. Paris et les quartiers du sud ont davantage de volume. Le rapport maisons/cathédrale est meilleur. | Beaucoup de bâtiments restent isolés et les champs dominent toujours les grandes masses. Le relief et les côtes restent plus lisses que la référence. |

La version 07 est la meilleure des trois sur les proportions urbaines. Son nombre de maisons inférieur n'est pas, à lui seul, un critère de réussite. Le gain est visible dans les vues [nationale](ordinateur.png), [Paris](paris.png) et [Alpes](alpes.png). Aucun chevauchement massif de maisons ou disparition de quartier n'est constaté dans ces vues ; ce jugement visuel ne remplace pas les contrôles d'empreinte du runtime.

## Avis strict

La carte ne correspond pas encore à la richesse graphique de la maquette. La référence présente des quartiers compacts avec des façades immédiatement lisibles au national, des masses boisées continues, des montagnes rocheuses aux arêtes cassées et un littoral très sculpté. Le prototype conserve davantage de parcelles plates, de maisons séparées, de flancs rocheux lisses et de surfaces vertes uniformes chez les voisins. Les arbres rapprochés ont également une silhouette plus simplifiée.

Les proportions 07 constituent une amélioration concrète à conserver. Les prochains gains artistiques viendraient de la composition des grandes masses et de la sculpture des reliefs et côtes, davantage que d'une augmentation du nombre de petits détails. Les tests techniques réussis ne démontrent ni la fidélité à la référence ni la fluidité avec animations actives sur tous les appareils.
