# Révision éditoriale après le refus AdSense

Le 3 octobre 2026 à 18 h 43 CEST, AdSense a remplacé « En préparation » par
« Attention requise », avec le motif « Contenu à faible valeur informative ».
Ce motif est distinct de l'état ads.txt. Un fichier ads.txt correct ne garantit
pas l'approbation éditoriale. Ne pas supprimer puis réinscrire le site.

## Constats vérifiés

Les douze dossiers existants comportent un développement, des graphiques et
des références. Leurs développements représentent entre 430 et 1 122 mots.
Ce comptage est un inventaire, pas un seuil d'éligibilité Google. L'analyse
structurelle couvre les douze JSON ; elle ne certifie pas chaque affirmation
historique ni chaque lien externe.

| Défaut observé | Correction |
| --- | --- |
| Aucun pied de page général accessible depuis Dossiers | Pied de page des documents éditoriaux pré-rendus : navigation, sources et méthode, confidentialité, compte X public du projet |
| Les précautions de lecture sont stockées mais jamais rendues | Paragraphes visibles au pied de chacun des dossiers, avant les références ; aucun panneau ni repli |
| La une est figée sur un slug et annonce une signature « la semaine prochaine » | Sélection parmi les dossiers mis en avant selon leur publication ; mise à jour réelle de l'article Groenland |
| L'article Groenland dit que le texte n'est pas public et reste à signer | Signature du 22 septembre vérifiée, communiqué et PDF officiel ajoutés, calendrier corrigé et distinction avec l'entrée en vigueur conservée |
| Besoin d'un apport explicatif original sur le coût du travail | Nouveau dossier en base 100 avec calculs reproductibles, deux graphiques, comparaison limitée à France/Allemagne/Italie/Espagne, distinction taux moyen/taux marginal |

## Dossier coût du travail

Source numérique : OCDE, Taxing Wages 2026, tableaux 1.1 et 1.2, année 2025.
Profil : célibataire sans enfant au salaire moyen propre à chaque pays.

| Pays | Coin fiscal (%) | Part restante calculée, 100 moins le coin fiscal (%) |
| --- | ---: | ---: |
| France | 47,2 | 52,8 |
| Allemagne | 49,3 | 50,7 |
| Italie | 45,8 | 54,2 |
| Espagne | 41,4 | 58,6 |

Décomposition française : 26,7 + 8,3 + 12,2 + 52,8 = 100. Les trois premières
parts correspondent aux cotisations patronales, salariales et à l'impôt ; la
dernière est calculée. Brut normalisé : 73,3 ; net avant impôt : 65.
Les graphiques affichent des pourcentages du coût, pas des taux sur le brut.
Les sources Urssaf et Service Public documentent la lecture du bulletin et les
paramètres nécessaires à une simulation individuelle. L'article ne transforme
pas une moyenne OCDE en estimation universelle pour un net de 2 000 euros.

## Sources primaires consultées

- [OCDE : tableaux comparatifs](https://www.oecd.org/en/publications/taxing-wages-2026_3a5169ef-en/full-report/overview_d93131c3.html)
- [OCDE : règles françaises](https://www.oecd.org/en/publications/taxing-wages-2026_3a5169ef-en/full-report/france_ad2bf5c9.html)
- [Urssaf : calcul des cotisations](https://www.urssaf.fr/accueil/employeur/cotisations/comprendre-cotisations/calcul-cotisations-employeur.html)
- [Service Public : bulletin](https://www.service-public.gouv.fr/particuliers/vosdroits/F559?lang=fr)
- [Service Public : financement de la protection sociale](https://entreprendre.service-public.gouv.fr/vosdroits/F24013)
- [Urssaf : simulateur](https://mon-entreprise.urssaf.fr/simulateurs/salaire-brut-net)
- [Danemark : signature du 22 septembre](https://stm.dk/en/press/press-releases/agreement-between-greenland-denmark-and-the-united-states/)
- [Accord signé, texte anglais](https://stm.dk/media/fx1h4fqx/aftale_eng.pdf)
- [Google : contenu et expérience utilisateur](https://support.google.com/adsense/answer/10015918)

## Vérification et limites

Le build complet et les contrôles existants doivent réussir. Les parcours
« Dossiers : qualité » vérifient la lecture, les chiffres affichés, l'actualité
du Groenland, l'accès à la confidentialité, puis chaque article sans JavaScript,
ses précautions et l'absence de débordement sur les cinq formats existants.
Conserver les captures et rapports dans l'artefact du workflow Launch consent.

Les anciens parcours généraux contiennent des attentes obsolètes ; leur état
ne doit pas être présenté comme corrigé par cette révision. L'approbation
AdSense appartient à Google, sans garantie de délai ou de résultat. Une demande
de nouvel examen ne doit être faite qu'après déploiement et contrôle public.

## Origine des sujets et X

Le thème coût du travail figurait dans le plan du 26 septembre, associé à une
référence X déjà documentée. Les likes récents n'ont pas été consultés dans
cette révision : l'ouverture du profil redirige vers une connexion. Ne pas
présenter ce dossier comme issu d'une lecture complète du compte X, ni comme
la reprise d'une annonce politique récente non vérifiée.
