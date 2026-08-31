# Simulateur V3 : doctrine fiscale et économies intégrées

Date : 31 août 2026

Statut : conception validée dans la conversation, à relire avant plan d'implémentation

Périmètre : catalogue de 96 dossiers, campagne de 60 dossiers, chiffrages, incompatibilités et trajectoire budgétaire

## 1. Résultat attendu

Le simulateur doit permettre de conduire une refonte fiscale, sociale et administrative ambitieuse sans créer de mode spécial, de paquet préfabriqué ni de bouton d'équilibre. Chaque réforme reste un dossier politique normal, rangé dans l'un des huit chapitres existants et soumis au même choix que les autres.

Le parcours le plus exigeant mais cohérent doit ajouter environ 39 milliards d'euros d'amélioration annuelle au solde par rapport au catalogue actuel. Ce montant correspond à la borne haute crédible effectivement atteignable pendant le mandat, après prise en compte des recouvrements, des comportements, des frais de fonctionnement récurrents et des incompatibilités. Il ne s'agit ni d'une somme sur cinq exercices, ni d'un rendement théorique à dix ans.

Cette doctrine complète la spécification `2026-08-31-v3-flux-continu-design.md`, qui reste la référence pour le déroulement, les crises, l'exigence d'un solde nul ou positif et le verdict unique. Elle remplace seulement les sections 4.1, 4.2, 4.3 et 12.1 de `2026-08-30-v3-impact-analyses-questions-design.md`, ainsi que les anciens invariants de campagne 96 fois 12 du plan de reconstruction. Les pauses et bilans de fin de chapitre de la section 4.1 sont supprimés ; les checkpoints restent calculés sans écran. Les sections consacrées aux analyses, aux questions, au verdict et à l'accessibilité restent applicables lorsqu'elles ne contredisent pas le flux continu du 31 août.

## 2. Invariants produit

- La bibliothèque contient exactement 96 dossiers.
- Chaque dossier possède exactement deux options, soit 192 options dans la bibliothèque.
- La campagne active en joue exactement 60, répartis entre les huit chapitres existants selon la topologie `8, 8, 8, 8, 7, 7, 7, 7`.
- La campagne active contient exactement 120 options.
- Les nouvelles réformes structurantes appartiennent à la campagne active. Elles ne sont pas cachées dans une variante ou une campagne secondaire.
- Il n'existe aucun paquet nommé `État simple`, `Retour à l'équilibre`, `Plan de rupture` ou équivalent.
- Une réforme est une décision atomique avec exactement deux options réelles, une source primaire, un mécanisme, un calendrier, des gagnants, des contributeurs et des effets causaux.
- Un clic choisit immédiatement l'option. Le flux continu, les conseils de crise et le verdict unique restent inchangés.
- Aucun cadratin n'est introduit dans le texte visible.

## 3. Sens des montants budgétaires

### 3.1 Effet affiché

Le montant montré sur une carte est le changement annuel récurrent du solde lorsque la réforme fonctionne à plein régime pendant le mandat. Une valeur positive améliore le solde, une valeur négative le dégrade.

L'interface ne mentionne pas `à cinq ans`. Elle affiche simplement, selon le cas, `+3 milliards d'euros par an`, `-900 millions d'euros par an` ou `Solde public inchangé`. Les milliards sont arrondis sans décimales quand cela ne détruit pas l'information ; les montants inférieurs à un milliard sont affichés en millions.

### 3.2 Borne haute crédible

Pour chaque option ambitieuse, le jeu retient la borne haute qui respecte simultanément les conditions suivantes :

1. la réforme peut être votée, déployée et produire cet effet au plus tard au checkpoint final du mandat ;
2. l'assiette de départ est documentée par une source publique primaire ;
3. le rendement est diminué des pertes comportementales plausibles et des frais récurrents ;
4. le rendement ne dépend pas de la disparition instantanée d'agents, de contrats, de bâtiments ou de droits acquis ;
5. aucun montant déjà attribué à un autre dossier n'est repris ;
6. aucune recette ponctuelle n'est transformée en rendement annuel ;
7. aucune économie arrivée seulement après le mandat n'est retenue.

Une borne haute est une hypothèse de scénario, pas une prévision certaine. L'analyse du dossier doit le dire sans polluer la carte de choix.

### 3.3 Coûts de transition

Le contrat budgétaire actuel doit évoluer. Une option peut avoir :

- un flux annuel récurrent, `runRateMillions` ;
- zéro, un ou plusieurs coûts ponctuels datés, `transitionFlows` ;
- éventuellement une recette ponctuelle datée, séparée du flux annuel.

Les coûts de transfert d'agents, d'indemnisation, de migration informatique, de travaux immobiliers ou de déploiement fiscal sont appliqués une seule fois à la bonne année. Ils diminuent la trajectoire et augmentent la dette si le solde ne les absorbe pas. Ils ne sont pas lissés artificiellement dans le rendement annuel.

Le montant annuel cible de 39 milliards d'euros est déjà net des charges récurrentes. Les coûts ponctuels restent en plus visibles dans les checkpoints et dans le registre causal.

## 4. Doctrine fiscale et sociale

### 4.1 Impôt personnel unifié

Le scénario de rupture remplace l'impôt sur le revenu, la CSG, la CRDS et les prélèvements personnels non contributifs par un prélèvement personnel unique. Les véritables cotisations ouvrant des droits à retraite, chômage, invalidité ou indemnités restent identifiées séparément.

Le prélèvement personnel respecte les règles suivantes :

- tout revenu personnel d'activité, de remplacement ou de capital supporte un taux positif dès le premier euro ;
- la courbe est continue et progressive, sans quelques méga-tranches arbitraires ;
- le taux marginal augmente sans saut brutal ;
- les revenus de même nature économique sont traités de manière cohérente ;
- le prélèvement est individualisé, avec des paramètres familiaux explicites et auditables ;
- le calibrage initial est neutre pour les finances publiques ;
- aucun crédit d'impôt remboursable, impôt négatif ou dividende en espèces n'est créé.

Les taux exacts ne sont pas figés par cette spécification. Ils doivent être calibrés par microsimulation afin de retrouver le rendement consolidé de l'IR et des prélèvements fusionnés, tout en réduisant les effets de seuil. Une série de taux illustrative ne peut jamais être copiée directement dans le catalogue sans cette calibration.

### 4.2 Travail et prime d'activité

La prime d'activité est supprimée progressivement en tant que chèque séparé. Son enveloppe est entièrement réemployée pour diminuer les prélèvements sur les premiers revenus du travail et améliorer le salaire net sur la fiche de paie. Cette transformation est neutre pour le solde : les 10,3 milliards d'euros versés en 2024 ne sont pas comptés comme économie.

Le salarié continue de payer le prélèvement personnel positif prévu dès le premier euro. Le gain vient de la diminution parallèle d'autres prélèvements sur le travail, pas d'un versement de l'État. Le travail supplémentaire doit toujours augmenter le revenu disponible.

Les prestations de dernier recours, versées à une personne sans revenu autonome suffisant, sont définies nettes. Les taxer pour leur reverser ensuite le même montant créerait une boucle administrative sans contribution économique réelle.

### 4.3 Ce que les actifs reçoivent

La réforme ne se limite pas à prélever davantage. Elle fournit trois contreparties lisibles :

- davantage de salaire net directement sur la paie pour les revenus du travail modestes ;
- la disparition de demandes séparées, régularisations et effets de seuil liés au couple impôt et prime d'activité ;
- une courbe publiée permettant de calculer à l'avance le prélèvement de chaque euro supplémentaire gagné.

## 5. Dossiers structurants et chiffrage cible

Les valeurs ci-dessous sont les cibles hautes du scénario retenu. Elles totalisent 38 500 millions d'euros par an. Elles ne peuvent être inscrites dans le catalogue qu'après création de l'entrée nominative correspondante dans le registre de chiffrage, avec assiette, millésime, calcul net, délai et coûts de transition. Les options moins ambitieuses peuvent retenir une partie du gisement, mais aucune combinaison compatible de ces 18 dossiers ne peut dépasser ce sous-total. Les autres dossiers de campagne conservent leurs propres effets et ne sont pas compris dans ce plafond.

| `chapterId` existant | Dossier à créer ou refondre | Effet annuel cible | Règle de périmètre |
|---|---|---:|---|
| `taxes-assets-transmission` | Unifier IR, CSG et prélèvements personnels dans un barème continu dès le premier revenu | 0 M€ | Réforme calibrée à rendement constant ; elle remplace les variantes de flat tax et les modifications isolées du barème. |
| `taxes-assets-transmission` | Supprimer un panier documenté de niches fiscales des ménages et du capital | +5 000 M€ | Liste nominative tirée de l'Évaluation des voies et moyens ; exclusion du CIR, des niches sociales, des niches brunes et des mesures déjà intégrées au barème unifié. |
| `taxes-assets-transmission` | Exploiter la facturation électronique contre la fraude à la TVA | +2 700 M€ | Objectif public de 3 000 M€ diminué des frais récurrents et d'une marge d'exécution ; aucune économie privée de conformité n'est portée au solde public. |
| `work-wages-pensions` | Remplacer la prime d'activité par une baisse des prélèvements sur le travail | 0 M€ | Enveloppe intégralement recyclée ; aucun dividende cash et aucune économie fictive. |
| `work-wages-pensions` | Cibler les aides à l'apprentissage sur les formations et contrats à effet d'emploi démontré | +3 000 M€ | Aides employeurs et exonérations d'apprentis uniquement ; exclusion de toute ligne reprise dans les aides générales aux entreprises. |
| `work-wages-pensions` | Supprimer les subventions directes aux entreprises insuffisamment évaluées | +3 000 M€ | Subventions budgétaires identifiées seulement ; exclusion de l'apprentissage, du CIR, des exonérations sociales et des tarifs énergétiques. |
| `work-wages-pensions` | Recentrer le CIR et les niches fiscales bénéficiant aux entreprises | +4 000 M€ | Dispositifs fiscaux nommés, avec maintien des dépenses de recherche additionnelles démontrées ; aucun chevauchement avec les subventions directes. |
| `work-wages-pensions` | Recentrer les allègements et exonérations sociales | +6 000 M€ | Suppression ciblée au-dessus des bas salaires et des exemptions peu évaluées ; exclusion de l'apprentissage et des prélèvements personnels fusionnés. |
| `health-social-protection` | Généraliser les médicaments comparables les moins coûteux et mutualiser les achats | +1 800 M€ | Médicaments, biosimilaires et achats hospitaliers définis ; pas de baisse uniforme de l'ONDAM. |
| `health-social-protection` | Réduire les arrêts évitables et responsabiliser la prescription | +1 200 M€ | Contrôles, prévention et prescription ; exclusion des absences des agents publics comptées dans le chapitre État. |
| `health-social-protection` | Renforcer le recouvrement de la fraude sociale | +800 M€ | Hypothèse de gain net additionnel, bloquée jusqu'à documentation d'un taux de recouvrement ; détection, redressement et recouvrement ne sont jamais additionnés. |
| `health-social-protection` | Unifier l'instruction et le versement des prestations de solidarité | +400 M€ | Économie de back-office seulement ; aucun retrait de droit, aucun gain lié au non-recours et aucune prime d'activité déjà recyclée. |
| `state-institutions-territories` | Clarifier les compétences et supprimer les doublons territoriaux | +3 000 M€ | Non-remplacements effectivement réalisables ; exclusion des achats, bâtiments, absences et opérateurs chiffrés séparément. |
| `state-institutions-territories` | Mutualiser et professionnaliser les achats publics | +2 500 M€ | Part réalisable des plafonds État et collectivités ; gains déjà nets des mêmes marchés touchés par les autres réformes. |
| `state-institutions-territories` | Rationaliser les opérateurs d'ingénierie territoriale | +200 M€ | Périmètre IGF Cerema, ANCT et ADEME ; aucune fermeture générique d'un tiers des agences. |
| `state-institutions-territories` | Réduire les surfaces et loyers publics | +1 000 M€ | Loyers et entretien récurrents évités ; produits de cession traités séparément comme ponctuels. |
| `state-institutions-territories` | Réduire le coût des absences dans les trois fonctions publiques | +900 M€ | Hypothèse haute de remplacement et prévention ; incompatibilité avec un second chiffrage des jours de carence sur les mêmes arrêts. |
| `energy-climate-transport-agriculture` | Supprimer un panier documenté de niches fiscales brunes | +3 000 M€ | Tarifs réduits et remboursements nommés ; exclusion des aides budgétaires, du bonus automobile et de la taxe carbone. |

Le numérique n'a pas de cagnotte autonome. Il peut être le moyen de réaliser un autre dossier, mais il ne produit un effet budgétaire que lorsqu'un cas audité isole une recette ou une dépense effectivement évitée.

### 5.1 Contrat canonique d'intégration

Les positions ci-dessous sont les emplacements réservés dans la campagne. Chaque dossier possède exactement les options `adopt` et `keep`. L'option `keep` a un flux budgétaire nul et ne revendique aucune clé de périmètre. Les `transitionFlows` non nuls doivent être chiffrés dans le registre avant toute modification du catalogue.

| Position | `decisionId` cible | `chapterId` | Option de référence | `runRateMillions` | Premier effet plein | `exclusiveScopeKeys` | Source de départ |
|---:|---|---|---|---:|---|---|---|
| 1 | `unifier-ir-csg-bareme-continu` | `taxes-assets-transmission` | `adopt` | 0 | sans effet budgétaire | aucune | `dgfip-ir-2024`, `ccss-csg-2025`, `cgi-197` |
| 2 | `supprimer-niches-fiscales-menages-capital` | `taxes-assets-transmission` | `adopt` | 5 000 | année 2 | `tax-exp-household-capital-selected` | `evm-2026` |
| 3 | `facturation-electronique-controle-tva` | `taxes-assets-transmission` | `adopt` | 2 700 | année 2 | `vat-fraud-einvoice` | `plan-antifraude-facturation-electronique` |
| 9 | `recentrer-allegements-exonerations-sociales` | `work-wages-pensions` | `adopt` | 6 000 | année 2 | `social-exemptions-selected` | `plfss-2025-annexe-4` |
| 10 | `cibler-aides-apprentissage` | `work-wages-pensions` | `adopt` | 3 000 | année 2 | `apprenticeship-aid-selected`, `apprenticeship-exemption-selected` | `plfss-2026-annexe-9`, `pap-travail-2026` |
| 11 | `supprimer-subventions-directes-entreprises` | `work-wages-pensions` | `adopt` | 3 000 | année 2 | `business-budget-subsidies-selected` | `hcsp-aides-entreprises-2025` |
| 12 | `recentrer-cir-niches-fiscales-entreprises` | `work-wages-pensions` | `adopt` | 4 000 | année 2 | `tax-exp-business-selected`, `tax-exp-cir-selected` | `evm-2026` |
| 16 | `remplacer-prime-activite-prelevements-travail` | `work-wages-pensions` | `adopt` | 0 | sans effet budgétaire | aucune | `cnaf-prime-activite-2024` |
| 17 | `medicaments-comparables-achats-sante` | `health-social-protection` | `adopt` | 1 800 | année 3 | `health-drugs-procurement-selected` | `ccss-ondam-2025` |
| 18 | `reduire-arrets-evitables-prescription` | `health-social-protection` | `adopt` | 1 200 | année 3 | `health-sick-leave-selected` | `ccss-ondam-2025` |
| 19 | `recouvrer-fraude-sociale-additionnelle` | `health-social-protection` | `adopt` | 800 | année 3 | `social-fraud-additional-recovery` | `urssaf-fraude-2024`, `cnaf-fraude-2024` |
| 20 | `unifier-instruction-prestations-solidarite` | `health-social-protection` | `adopt` | 400 | année 3 | `benefits-backoffice-selected` | `budget-programme-304`, `cnaf-gestion` |
| 46 | `supprimer-niches-fiscales-brunes` | `energy-climate-transport-agriculture` | `adopt` | 3 000 | année 5 | `tax-exp-brown-selected` | `evm-2026` |
| 54 | `clarifier-competences-doublons-territoriaux` | `state-institutions-territories` | `adopt` | 3 000 | année 5 | `local-competency-staff-overlap` | `igf-collectivites-2024`, `senat-ravignon` |
| 55 | `mutualiser-achats-publics` | `state-institutions-territories` | `adopt` | 2 500 | année 5 | `public-procurement-selected` | `dae-2025`, `igf-collectivites-2024` |
| 56 | `rationaliser-operateurs-ingenierie-territoriale` | `state-institutions-territories` | `adopt` | 200 | année 5 | `territorial-engineering-operators` | `igf-ingenierie-territoriale-2025` |
| 57 | `reduire-surfaces-loyers-publics` | `state-institutions-territories` | `adopt` | 1 000 | année 5 | `public-property-rent-maintenance` | `die-2025` |
| 58 | `reduire-cout-absences-fonctions-publiques` | `state-institutions-territories` | `adopt` | 900 | année 5 | `public-workforce-absence-replacement` | `dgafp-temps-2024`, `igf-igas-absences` |

Le premier effet plein est comptabilisé au checkpoint indiqué, sans prorata infra-annuel. Les coûts ponctuels antérieurs sont néanmoins appliqués à leur checkpoint propre.

Le plan d'implémentation doit compléter ce tableau par, pour chaque option `adopt`, le détail des lignes officielles retenues, le calcul brut, la décote comportementale, les charges récurrentes et chaque `transitionFlow`. Tant que cette annexe de chiffrage ne justifie pas une ligne, cette ligne est bloquée pour le code. Si le total documenté est inférieur à 38 500 M€, il faut soit réduire honnêtement la cible, soit identifier un autre dossier public distinct ; il est interdit de gonfler une ligne existante.

## 6. Catalogue et campagne

### 6.1 Maintien des compteurs

La refonte se fait à effectif constant : 96 dossiers et 192 options en bibliothèque, 60 dossiers dans la campagne. Les dossiers redondants, symboliques ou faiblement budgétaires passent en bibliothèque ou sont remplacés. Les nouveaux dossiers structurants ci-dessus entrent tous dans la campagne active.

Les huit chapitres et leurs tailles ne changent pas. Le plan d'implémentation doit reprendre la liste exacte des 60 identifiants définie en section 6.3 avant toute modification de `campaign-topology.ts`.

### 6.2 Réemploi des dossiers existants

Un identifiant existant peut être conservé seulement si le sujet reste le même. Les dossiers suivants doivent être refondus plutôt que dupliqués :

- les deux flat tax et les modifications isolées du barème sont remplacées dans la campagne par le prélèvement personnel progressif unifié ;
- `allocation-sociale-unique` devient la simplification sans dividende cash et sans impôt négatif ;
- les dossiers apprentissage, subventions directes, CIR, allègements sociaux, génériques, arrêts de travail et opérateurs sont réécrits sur des périmètres auditables ;
- les coupes institutionnelles surtout symboliques, comme la suppression du CESE ou la division du nombre de parlementaires, restent éventuellement dans la bibliothèque mais ne prennent pas la place des économies structurelles dans la campagne.
- la redistribution de la taxe carbone désigne une baisse explicite de prélèvements sur le travail ou un financement de transition, jamais un chèque forfaitaire en espèces.

Un changement de sujet impose un nouvel identifiant et la suppression propre de l'ancien contrat causal. Aucun alias trompeur n'est autorisé.

Les 18 substitutions suivantes maintiennent le catalogue à 96 dossiers :

| Ancien `decisionId` retiré du scénario 10 | Nouveau `decisionId` |
|---|---|
| `geler-le-bareme-de-l-impot-sur` | `facturation-electronique-controle-tva` |
| `flat-tax-a-20-des-le-premier` | `unifier-ir-csg-bareme-continu` |
| `flat-tax-a-20-avec-abattement-protegeant` | `supprimer-niches-fiscales-menages-capital` |
| `supprimer-les-allegements-de-cotisations-entre-2` | `recentrer-allegements-exonerations-sociales` |
| `fiscaliser-les-heures-supplementaires-comme-le` | `cibler-aides-apprentissage` |
| `raboter-de-5-les-subventions-directes-aux` | `supprimer-subventions-directes-entreprises` |
| `raboter-le-credit-d-impot-recherche-de` | `recentrer-cir-niches-fiscales-entreprises` |
| `allocation-sociale-unique` | `remplacer-prime-activite-prelevements-travail` |
| `imposer-generiques-et-biosimilaires-en-premiere-intention` | `medicaments-comparables-achats-sante` |
| `renforcer-le-controle-des-arrets-de-travail` | `reduire-arrets-evitables-prescription` |
| `derembourser-les-cures-thermales` | `recouvrer-fraude-sociale-additionnelle` |
| `verser-le-rsa-automatiquement-fin-du-non` | `unifier-instruction-prestations-solidarite` |
| `interdire-les-voitures-thermiques-en-2030` | `supprimer-niches-fiscales-brunes` |
| `reduire-de-5-les-dotations-aux-collectivites` | `clarifier-competences-doublons-territoriaux` |
| `geler-le-point-d-indice-en-2026` | `mutualiser-achats-publics` |
| `fermer-un-tiers-des-agences-et-operateurs` | `rationaliser-operateurs-ingenierie-territoriale` |
| `diviser-par-deux-le-nombre-de-parlementaires` | `reduire-surfaces-loyers-publics` |
| `deux-jours-de-carence-dans-la-fonction` | `reduire-cout-absences-fonctions-publiques` |

Les anciens identifiants restent disponibles uniquement dans le scénario historique nécessaire à la lecture des sauvegardes. Ils ne figurent plus dans la bibliothèque du scénario 10.

### 6.3 Liste canonique des 60 dossiers

Cette liste remplace `CAMPAIGN_DECISION_IDS`. Son ordre est normatif.

1. `taxes-assets-transmission`, positions 1 à 8 :
   `unifier-ir-csg-bareme-continu`,
   `supprimer-niches-fiscales-menages-capital`,
   `facturation-electronique-controle-tva`,
   `porter-le-taux-normal-de-tva-a`,
   `doubler-la-taxe-sur-les-rachats-d`,
   `retablir-un-impot-sur-la-fortune-financiere`,
   `exonerer-de-droits-de-succession-jusqu-a`,
   `abolir-les-droits-de-succession`.
2. `work-wages-pensions`, positions 9 à 16 :
   `recentrer-allegements-exonerations-sociales`,
   `cibler-aides-apprentissage`,
   `supprimer-subventions-directes-entreprises`,
   `recentrer-cir-niches-fiscales-entreprises`,
   `repousser-l-age-legal-a-65-ans`,
   `desindexer-les-pensions-d-un-point`,
   `durcir-l-assurance-chomage-degressivite-duree`,
   `remplacer-prime-activite-prelevements-travail`.
3. `health-social-protection`, positions 17 à 24 :
   `medicaments-comparables-achats-sante`,
   `reduire-arrets-evitables-prescription`,
   `recouvrer-fraude-sociale-additionnelle`,
   `unifier-instruction-prestations-solidarite`,
   `creer-5-000-postes-de-soignants`,
   `loi-grand-age-50-000-recrutements`,
   `supprimer-l-aide-medicale-d-etat`,
   `assurance-maladie-publique-unique`.
4. `security-immigration-justice`, positions 25 à 32 :
   `recruter-10-000-policiers-et-gendarmes`,
   `construire-15-000-places-de-prison-supplementaires`,
   `recruter-3-000-magistrats-et-greffiers`,
   `doubler-l-execution-des-eloignements-oqtf`,
   `supprimer-l-allocation-pour-demandeurs-d`,
   `reserver-les-prestations-non-contributives-aux-nationaux`,
   `quotas-annuels-d-immigration`,
   `legaliser-et-taxer-le-cannabis`.
5. `defence-europe-sovereignty`, positions 33 à 39 :
   `porter-l-effort-de-defense-vers-3`,
   `doubler-la-reserve-operationnelle`,
   `service-militaire-volontaire-de-50-000`,
   `doubler-les-moyens-du-renseignement-interieur`,
   `sortir-de-l-euro`,
   `referendum-sur-la-sortie-de-l-ue`,
   `creer-une-armee-europeenne`.
6. `energy-climate-transport-agriculture`, positions 40 à 46 :
   `doubler-maprimerenov`,
   `plan-ferroviaire-3-000-m-de-plus`,
   `engager-six-epr2-part-annuelle-de-l`,
   `retablir-une-trajectoire-carbone-recettes-redistribuees`, dont la redistribution est réécrite selon la règle sans chèque en espèces,
   `sortie-du-nucleaire-en-2040`,
   `moratoire-sur-les-renouvelables`,
   `supprimer-niches-fiscales-brunes`.
7. `education-housing-family`, positions 47 à 53 :
   `revaloriser-les-enseignants-de-5`,
   `doubler-les-bourses-etudiantes-sur-criteres`,
   `financer-100-000-logements-sociaux-de-plus`,
   `revaloriser-les-apl-de-5`,
   `cheque-education-par-eleve`,
   `supprimer-le-financement-public-du-prive`,
   `autonomie-complete-des-etablissements`.
8. `state-institutions-territories`, positions 54 à 60 :
   `clarifier-competences-doublons-territoriaux`,
   `mutualiser-achats-publics`,
   `rationaliser-operateurs-ingenierie-territoriale`,
   `reduire-surfaces-loyers-publics`,
   `reduire-cout-absences-fonctions-publiques`,
   `regle-d-or-constitutionnelle`,
   `proportionnelle-integrale`.

Les 36 autres dossiers restent consultables dans la bibliothèque. Ils ne peuvent pas être injectés dynamiquement dans la campagne en cours.

## 7. Incompatibilités et absence de double compte

Le moteur doit empêcher les combinaisons incohérentes, pas seulement corriger leur somme à la fin.

### 7.1 Verrous fiscaux

Le prélèvement personnel unifié remplace dans la campagne active les dossiers suivants :

- le gel isolé du barème ;
- la création isolée d'une tranche à 50 % ;
- l'intégration isolée du capital au barème ;
- les deux variantes de flat tax à 20 %.

Les variantes retirées restent consultables uniquement dans le scénario historique, pas dans la bibliothèque du scénario 10. Les modifications isolées du capital ou de la tranche supérieure qui restent dans les 36 dossiers de bibliothèque ne sont pas des cibles de `locks`, puisqu'elles ne figurent pas dans les 60 dossiers actifs. Les impôts sur le patrimoine et les successions restent indépendants.

### 7.2 Verrous sociaux

La transformation de la prime d'activité rend sans objet toute allocation sociale unique qui la compterait encore et toute mesure qui revendiquerait son enveloppe comme économie. L'automatisation du RSA ou des APL ne doit jamais être présentée comme source d'économie par diminution du non-recours.

### 7.3 Registre de périmètres exclusifs

Chaque ligne budgétaire officielle reçoit un seul propriétaire dans un registre de périmètres :

- apprentissage exclu des aides générales et des niches sociales ;
- CIR exclu du panier général de niches fiscales ;
- niches brunes exclues du panier fiscal général ;
- prime d'activité exclue des économies de prestations ;
- fraude TVA attribuée à la facturation électronique ;
- fraude sociale limitée aux encaissements sociaux additionnels ;
- achats exclus des économies de millefeuille et d'immobilier ;
- surfaces libérées exclues de toute seconde économie de télétravail ;
- absences publiques exclues des économies de santé et des non-remplacements territoriaux ;
- produits de cession exclus des loyers annuels évités.

Le test de meilleur parcours doit utiliser les `locks`, les échéances et les coûts de transition réels. Une simple somme des montants du catalogue est interdite.

## 8. Registre de chiffrage

Un registre typé, distinct du texte éditorial, doit documenter chaque option budgétaire avec au minimum :

- `baseYear` : millésime de l'assiette ;
- `baseAmountMillions` : coût ou recette observé ;
- `baseNature` : réalisé, prévision, objectif, notifié ou recouvré ;
- `scope` : assiette exacte ;
- `grossActionMillions` : gain brut du scénario ;
- `behavioralOffsetMillions` : réaction économique retranchée ;
- `recurringOperatingCostMillions` : coût annuel du dispositif ;
- `runRateMillions` : effet annuel net retenu ;
- `transitionFlows` : flux ponctuels par année ;
- `sourceKeys` : sources primaires directes ;
- `estimateStatus` : observé, évaluation ex ante ou hypothèse de scénario ;
- `uncertainty` : faible, moyenne ou forte ;
- `exclusiveScopeKeys` : lignes interdites aux autres dossiers.

Le compilateur refuse un flux budgétaire déclaré par une option de politique sans entrée de registre, un total de niches sans liste nominative, un montant de fraude notifié présenté comme encaissé, ou deux options simultanément sélectionnables de décisions distinctes revendiquant le même `exclusiveScopeKey`. Deux options alternatives d'un même dossier peuvent partager une clé. Une option de maintien au profil nul ne revendique aucune clé budgétaire.

## 9. Présentation des dossiers

La carte de décision reste sobre. Elle montre :

- le titre ;
- la courte description du mécanisme ;
- deux options réellement différentes ;
- l'effet annuel sur le solde ;
- rien sur l'opinion, la confiance, les marchés ou les groupes avant le choix.

Le détail `Voir l'analyse et les sources` peut expliquer le périmètre, l'assiette officielle, le calcul net et l'incertitude. Il ne doit pas répéter des sous-explications génériques ni occuper l'espace principal.

Les valeurs annuelles sont formulées de manière concrète. `+3 milliards d'euros par an` est préféré à `+3,0 Md€ à maturité`. Les coûts ponctuels apparaissent dans l'analyse et dans la trajectoire, sans être confondus avec le chiffre principal.

## 10. Évolution technique

Le nouveau contrat est :

```ts
type BudgetTransitionFlow = {
  id: string;
  amountMillions: number;
  timing: EffectTiming;
  sourceKey: string;
};

type BudgetProfile = {
  estimateKey: string | null;
  runRateMillions: number;
  runRateTiming: EffectTiming | null;
  transitionFlows: BudgetTransitionFlow[];
  exclusiveScopeKeys: string[];
};
```

Une option peut déclarer au plus un flux annuel et plusieurs flux ponctuels. `estimateKey` est obligatoire et typé sur le registre lorsque `runRateMillions` est non nul ou lorsque `transitionFlows` n'est pas vide. `runRateTiming` est obligatoire pour un flux annuel non nul et vaut `null` dans un profil entièrement nul. La jointure du registre est `decisionId:optionId:estimateKey`.

Un flux ponctuel possède un identifiant causal unique dans tout le scénario, ne peut précéder la décision et ne peut dépasser le checkpoint 60. Une option à flux annuel nul peut porter un coût de transition, à condition de le sourcer. Il n'existe aucun prorata infra-annuel : un flux récurrent prend son effet plein au checkpoint déclaré. `mandate_year: 1..5` se convertit respectivement aux checkpoints 16, 32, 39, 53 et 60. `after_decisions: n` se convertit au premier checkpoint dont le nombre de décisions terminées atteint l'échéance calculée. Les flux des positions 46 et 54 à 58 utilisent explicitement `runRateTiming: { kind: "mandate_year", year: 5 }`.

Le modèle doit passer du couple `budgetDelta` et `budgetDuration` à un profil budgétaire explicite. Une migration de schéma est nécessaire afin de restaurer les anciennes parties sans réappliquer les effets.

Le compilateur peut continuer à produire un effet `annualBalance` récurrent pour le flux annuel, mais il doit aussi produire les flux ponctuels datés. Le validateur doit autoriser au plus un flux récurrent et plusieurs flux ponctuels aux identifiants uniques. Chaque flux doit se retrouver dans le registre causal et dans un seul checkpoint.

La version de scénario passe de 9 à 10 et la version de schéma de 4 à 5. La migration v4 vers v5 s'exécute avant validation et possède un registre dédié. Les anciennes options dont le sens, le `decisionId`, le `optionId` et l'assiette n'ont pas changé sont migrées automatiquement vers un profil simple. Une décision remplacée n'est jamais réinterprétée silencieusement avec le nouveau contrat.

Un résolveur charge le scénario figé correspondant à `scenarioVersion`. Le bundle conserve au minimum `SCENARIO_V9` pour rendre les parties terminées. Une partie active est marquée `restart_required` si un identifiant remplacé apparaît directement ou indirectement dans ses décisions, verrous, événements, promesses, crises ou écritures causales. Elle est préservée mais ne peut pas continuer sous le scénario 10. Aucun effet déjà matérialisé n'est rejoué.

Les références de `scenario-crises.ts` sont auditées lors du changement de version. Toute référence vers un identifiant remplacé est soit migrée vers une cause sémantiquement identique, soit supprimée avec un test prouvant que la crise conserve deux causes et deux réponses applicables.

La crise actuellement liée à la flat tax est réécrite autour du prélèvement personnel unifié, avec deux réponses applicables : conserver la fusion ou renverser la décision et maintenir les prélèvements séparés. Le renversement applique ses propres coûts ponctuels sourcés et annule les flux futurs non matérialisés de cette décision. Cette règle étend explicitement le moteur de crise afin qu'une décision `reversed` retire aussi ses événements et flux futurs encore en file. La crise de réforme de l'État est reliée aux nouveaux dossiers territoriaux, opérateurs et absences qui l'aggravent réellement. Aucune crise ne référence un dossier sorti des 60.

## 11. Critères d'acceptation

La conception est correctement implémentée si :

1. le catalogue contient exactement 96 dossiers uniques et 192 options ; la campagne contient exactement 60 dossiers et 120 options dans l'ordre canonique ;
2. les 18 dossiers structurants ci-dessus appartiennent au `chapterId` déclaré et sont jouables dans la campagne ;
3. aucun écran ne propose un paquet ou un mode spécial ;
4. le prélèvement personnel unifié n'engendre ni crédit remboursable, ni versement cash, ni rendement budgétaire artificiel ;
5. la disparition de la prime d'activité est compensée avec une différence inférieure ou égale à 1 M€ dans le registre par une baisse des prélèvements sur le travail ;
6. le parcours doctrinal de référence, défini par les 18 options `adopt` ci-dessus, atteint exactement 38 500 M€ de `runRateMillions` au checkpoint 60, après application des verrous et des échéances ; ses coûts ponctuels ont bien affecté la trajectoire ;
7. aucune combinaison compatible de ces seules 18 options ne dépasse 38 500 M€ ; ce plafond ne s'applique pas aux autres dossiers du catalogue ;
8. au moins un parcours compatible de l'ensemble de la campagne atteint un solde annuel nul ou positif au checkpoint 60 ;
9. les coûts de transition sont appliqués une seule fois et restent présents après sauvegarde et restauration ;
10. les flux annuels persistent à partir de leur date d'entrée en vigueur ;
11. les recettes ponctuelles disparaissent du rythme annuel suivant ;
12. les verrous rendent les dossiers incompatibles `superseded` avant rendu ;
13. chaque flux budgétaire déclaré par une option de politique possède une source, une assiette, un millésime, une nature et une décomposition nette ;
14. la somme automatisée par `exclusiveScopeKeys` détecte toute collision de périmètre ;
15. le verdict final reste unique et le journal retrace les 60 arbitrages ;
16. aucune carte de décision n'affiche de pilule d'opinion, confiance, marchés, groupes ou autre impact non budgétaire avant le choix ;
17. aucun texte visible n'emploie de cadratin ;
18. un test navigateur à 390 par 844 vérifie pour les phases critiques que `scrollWidth` ne dépasse pas `clientWidth`.

## 12. Sources institutionnelles de cadrage

- [DGFiP, impôt sur le revenu 2024](https://www.impots.gouv.fr/dgfip-statistiques-limpot-sur-le-revenu-2024-ete-plus-dynamique-que-les-revenus) : 92 Md€ d'IR établi, 19,6 millions de foyers avec impôt net sur 41,5 millions.
- [Code général des impôts, article 197](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542636/2026-05-21) : barème légal de référence ; le prélèvement progressif dès le premier revenu est une hypothèse normative du jeu.
- [Commission des comptes de la Sécurité sociale, octobre 2025](https://www.securite-sociale.fr/files/live/sites/SSFR/files/medias/CCSS/2025/CCSS_octobre%202025_VDEF.pdf) : CSG, ONDAM et comptes sociaux.
- [Cnaf, dépenses de prime d'activité 2024](https://caf.fr/professionnels/etudes-et-international/5-en-2024-les-depenses-de-prime-d-activite-augmentent-de-14) : 10,3 Md€ versés.
- [PLFSS 2025, annexe 4](https://www.securite-sociale.fr/files/live/sites/SSFR/files/medias/PLFSS/2025/PLFSS2025_Annexe04.pdf) et [PLFSS 2026, annexe 9](https://www.securite-sociale.fr/files/live/sites/SSFR/files/medias/PLFSS/2026/PLFSS2026-Annexe09-GenerationXBOOK_avec%20couverture.pdf) : allègements, exonérations et apprentissage.
- [Budget de l'État, Évaluation des voies et moyens 2026](https://www.budget.gouv.fr/documentation/file-download/30586) : dépenses fiscales et liste des dispositifs.
- [Haut-commissariat à la stratégie et au plan, aides aux entreprises](https://www.strategie-plan.gouv.fr/publications/les-aides-aux-entreprises-en-france-de-quoi-parle-t) : périmètres comparés des aides budgétaires, fiscales et sociales.
- [IGF, masse salariale et achats des collectivités](https://www.igf.finances.gouv.fr/igf/accueil/nos-activites/rapports-de-missions/liste-de-tous-les-rapports-de-mi/masse-salariale-et-achats-et-cha.html) : emplois et achats locaux.
- [Sénat, coût de l'enchevêtrement des compétences](https://www.senat.fr/rap/a25-749/a25-7490.html) : plafond de coût de coordination, qui ne doit pas être confondu avec une économie récupérable intégralement.
- [Direction des achats de l'État, rapport 2025](https://www.economie.gouv.fr/files/files/directions_services/dae/media-document/Rapport_activite_2025_en_telechargement.pdf) : assiette et objectifs de gains achats.
- [Direction de l'immobilier de l'État, bilan 2025](https://immobilier-etat.gouv.fr/sinformer/actualites/rapport-activite-2025-die-special-10-ans/) : surfaces, cessions et économies récurrentes.
- [DGAFP, temps de travail 2024](https://www.fonction-publique.gouv.fr/files/files/publications/vue-rapport-annuel/ra_2025_vue_temps_organisation_temps_travail.pdf) et [IGF-IGAS, absences](https://www.igf.finances.gouv.fr/igf/accueil/nos-activites/rapports-de-missions/liste-de-tous-les-rapports-de-mi/revue-de-depenses-relative-a-la.html) : temps, carence et remplacement.
- [Ministère de l'Économie, plan antifraude](https://www.economie.gouv.fr/actualites/35-mesures-pour-agir-contre-les-fraudes-aux-finances-publiques) : objectif de recettes TVA lié à la facturation électronique.
- [DGFiP, contrôle fiscal 2024](https://www.economie.gouv.fr/files/files/directions_services/dgfip/Rapport/2024/ra_2024.pdf), [Urssaf, travail dissimulé](https://presse.economie.gouv.fr/resultats-historiques-dans-la-lutte-contre-le-travail-dissimule/) et [Cnaf, fraude](https://caf.fr/professionnels/actualites/detecter-la-fraude-c-est-proteger-la-solidarite) : distinction entre détection, redressement et encaissement.

## 13. Hors périmètre de cette conception

- le choix définitif des taux du barème, qui dépend d'une microsimulation ;
- l'ajout d'un nouveau chapitre ou d'une campagne alternative ;
- un dividende universel, un impôt négatif ou un crédit remboursable ;
- la promesse que toute dépense fiscale ou toute fraude devient une recette ;
- une économie générique attribuée au numérique sans cas audité ;
- un produit de cession présenté comme une économie annuelle ;
- toute valeur atteinte seulement après la fin du mandat.
