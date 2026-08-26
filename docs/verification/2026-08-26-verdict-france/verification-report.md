# Vérification visuelle — Bilan France v2

Date : 26 août 2026
Révision contrôlée : `a2f1a58`
Contrat de référence : maquette **01 — « Le verdict d'abord »**, dans
`.superpowers/brainstorm/1847-1787723803/content/10-directions-france.html`,
et spécification v2
`docs/superpowers/specs/2026-08-26-bilan-france-visual-overhaul-v2-design.md`.

## Périmètre et captures

Les captures viennent du rendu de production de `/bilan`. Les deux captures de
page entière vérifient le parcours complet ; les deux captures de hero isolent
la comparaison du premier écran avec la maquette 01.

| Vue | Capture | Dimensions du fichier |
| --- | --- | --- |
| Bilan, bureau, page entière | [bilan-desktop-1440x900.jpg](bilan-desktop-1440x900.jpg) | 1 429 × 7 793 px |
| Bilan, mobile, page entière | [bilan-mobile-390x844.jpg](bilan-mobile-390x844.jpg) | 380 × 10 239 px |
| Bilan, bureau, hero | [bilan-hero-desktop-1440x900.jpg](bilan-hero-desktop-1440x900.jpg) | 1 430 × 894 px |
| Bilan, mobile, hero | [bilan-hero-mobile-390x844.jpg](bilan-hero-mobile-390x844.jpg) | 380 × 822 px |

La différence entre les viewports demandés (1 440 et 390 px) et les largeurs
des captures correspond à la barre de défilement du navigateur : les métriques
ci-dessous portent donc sur la largeur utile réellement rendue.

## Comparaison maquette 01 → rendu réel

La maquette 01 est appliquée comme **contrat de composition** : elle ne demande
pas la copie de ses données fictives, mais la même hiérarchie de lecture et la
même grammaire visuelle avec les chiffres et sources réels.

| Contrat de la maquette 01 | Rendu réel v2 | Résultat |
| --- | --- | --- |
| Chrome bleu nuit compact au-dessus d'une couverture distincte | L'en-tête Bilan est bleu nuit et la couverture est une grande surface papier chaude sur un fond froid. | Conforme |
| Conclusion éditoriale à gauche | Le verdict « La France dépense 152,51 milliards d'euros de plus qu'elle n'en encaisse » ouvre le hero dans sa colonne éditoriale. | Conforme |
| Chiffre-totem à droite, carte blanche et accent rouge | Le totem « Le verdict en un chiffre », bordé de rouge, présente le solde et sa qualification « à financer sur l'année ». | Conforme |
| Équation lisible sur une ligne | Bureau : Recettes − Dépenses = Solde public est une équation horizontale complète, avec les signes visibles et le solde rouge. | Conforme |
| Trois portes d'analyse sous le calcul | Les libellés approuvés sont exactement « D'où vient l'argent ? », « Où part-il ? » et « Pourquoi la dette monte ? ». Europe est une preuve du troisième chapitre, jamais une porte. | Conforme |
| Récit éditorial, pas tableau de bord | Les panneaux gris verticaux de chiffres et la navigation héritée à pilules ont disparu ; les filets, le papier et l'espace structurent la page. | Conforme |

## Mesures navigateur et parcours complet

| Vérification | Bureau 1 440 × 900 | Mobile 390 × 844 | Résultat |
| --- | --- | --- | --- |
| Largeur de page | `innerWidth = 1440`, `clientWidth = scrollWidth = 1430` | `innerWidth = 390`, `clientWidth = scrollWidth = 380` | Aucun débordement horizontal |
| Hauteur document | 7 794 px | 10 239 px | Captures de page entière archivées |
| Couverture / hero | Papier, hero en deux colonnes : éditorial à gauche et totem rouge à droite | Couverture dans la colonne utile, titre puis totem, sans chevauchement | Conforme |
| Équation | Cinq éléments sur une rangée (trois termes et deux signes) | Étapes verticales avec signes conservés | Conforme |
| Portes et chapitres | 3 portes : « D'où vient l'argent ? », « Où part-il ? », « Pourquoi la dette monte ? » ; 3 chapitres | Les mêmes 3 portes sont empilées ; 3 chapitres | Conforme |
| Europe | Preuve intégrée à la partie dette, sans libellé de porte Europe | Preuve intégrée au troisième chapitre, sans libellé de porte Europe | Conforme |
| Ancienne navigation / ancienne section Europe | — | `legacyNav = 0`, `#france-europe = 0` | Absentes |
| Action finale | CTA après le troisième chapitre | CTA mesurée à 44 px de haut | Conforme |

Le parcours desktop et mobile conserve ainsi trois chapitres seulement, ouverts
par les portes « D'où vient l'argent ? », « Où part-il ? » et « Pourquoi la
dette monte ? ». L'Europe reste une preuve dans le troisième chapitre : aucun
libellé de porte ne mentionne Europe, qui ne constitue ni un écran ni une
navigation autonome.

## Conclusion

La comparaison visuelle du premier écran, complétée par les captures intégrales
et les mesures de DOM, confirme le contrat v2 de la maquette 01 sur `/bilan` :
couverture éditoriale papier, header bleu nuit, conclusion et totem, équation,
trois portes et flux de lecture à trois chapitres. Les vérifications de suite de
tests, build et intégrité Git sont consignées dans le rapport d'exécution de la
tâche.
