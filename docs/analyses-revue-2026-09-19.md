# Analyses : refonte et choix éditoriaux du 19 septembre 2026

L’index et les dossiers reprennent la composition de France : papier clair,
encre verte, accent terre cuite, titres Spectral et navigation de lecture en
marge. Analyses est un lien natif du header, actif aussi dans les dossiers.
Les sources externes sont réunies dans la dernière section documentaire.
Chaque référence conserve les séries ou mesures qu’elle documente et sa date
de consultation. Les boutons de citation conservent la source exacte.

Les graphiques sont rendus au build. Les unités différentes ont des échelles
séparées. Les barres ne comparent que des instantanés explicitement regroupés
dans le contrat. Les tableaux complets restent accessibles sans JavaScript.

## Repérage sur X

Consultation manuelle le 19 septembre 2026, onglet Tendances de X et recherches
ouvertes depuis ces tendances. Les libellés visibles comprenaient Russie,
Poutine, Macron et Groenland. Cette observation dépend de la session et du
moment de consultation ; ce n’est pas un classement exhaustif ni un sondage.
Aucun tweet n’a été publié ou utilisé comme source des montants.

- Russie : [question sur le risque de guerre](https://x.com/JMMartini20/status/2100931718458847285),
  [discussion sur la préparation européenne](https://x.com/romainprieur/status/2101015688328441940).
  Angle retenu : mesurer les dépenses constatées, sans déduire une probabilité
  de conflit d’un budget. Le dossier Ukraine complète ce thème ; le montant du
  prêt n’est pas présenté comme un sujet classé séparément en tendance.
- Groenland : [annonce relayée par Cerfia](https://x.com/CerfiaFR/status/2101236626185687172),
  [question d’un lecteur](https://x.com/UmbriciusR/status/2101206724535349356),
  [discussion contradictoire](https://x.com/Mikaa_BM/status/2101197611029926316).
  Angle retenu : distinguer annonce, signature, entrée en vigueur et statut
  territorial, puis rappeler le périmètre de la coopération européenne.

## Dossiers ajoutés

1. `defense-europe-depenses-2024` : Eurostat, COFOG 2024, extraction du 20 août
   2026. 266 milliards dans l’UE ; 1,5 % du PIB européen ; 1,8 % en France.
   Les données provisoires sont signalées. Pas de mélange avec les définitions
   OTAN ni avec les crédits futurs annoncés.
2. `ukraine-pret-europeen-90-milliards` : Conseil de l’UE et SEAE. Enveloppe
   2026-2027, ventilation indicative 60/30, cumul de versements 11,6 milliards
   indiqué par la page officielle consultée le 19 septembre. Garantie et
   intérêts distingués du principal. Le cumul devra être redaté à la prochaine
   actualisation ; il ne se met pas à jour automatiquement.
3. `groenland-accord-securite-europe` : communiqué conjoint publié par le
   gouvernement danois le 18 septembre et Commission européenne. État avant
   la signature annoncée, sans extrapolation sur le contenu du futur accord.
   Les 225 millions de coopération civile sont une enveloppe 2021-2027,
   distincte des autres programmes et d’une dépense militaire annuelle.

Les URL primaires et dates figurent dans chaque JSON. Les chiffres monétaires
du contrôle historique restent en euros ; les preuves éditoriales déclarent
explicitement leurs millions ou milliards. La carte de partage convertit
cette échelle pour retrouver la bonne preuve et sa source.

## Rédaction

Relecture avec [Humanizer](https://github.com/blader/humanizer/blob/main/SKILL.md) :
phrases factuelles, aucune citation inventée, pas de superlatifs promotionnels,
incertitudes limitées aux points réellement non établis. Le choix d’un sujet
sur X n’accorde aucune valeur probante aux affirmations qui y circulent.

## Validation

Contrôle des 12 analyses sans erreur ; `npm run check` réussi (1 040 tests et
build de production) ; 40 tests Playwright éditoriaux réussis sur les cinq
profils existants ; inspection visuelle de l’index, d’un dossier, des sources
et du mode sombre. La navigation mobile est
adaptée aux cinq destinations plus au lien X déjà livré par une autre tâche.

La hauteur du header est mesurée pour éviter de masquer les sommaires fixes.
Le menu de Mandats conserve ses six liens et ses cibles tactiles ; le logo et
les espacements sont réduits pendant une partie sur téléphone. Les tests de
thème partagé incluent désormais Analyses.
