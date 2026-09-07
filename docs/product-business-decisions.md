# 500signatures : décisions produit et modèle économique

Document de travail du 7 septembre 2026. Les prix, volumes, temps et seuils ci-dessous
sont des hypothèses proposées, pas des données commerciales observées. Ce document
remplace les anciennes priorités économiques de `docs/mandats/STRATEGIE.md`.

## Décision

Construire un produit public gratuit qui fait comprendre les arbitrages et donne
envie de revenir. Valider d'abord un atelier payant pour les organismes de formation,
les associations et les équipes éditoriales. Transformer ensuite une demande
récurrente prouvée en prestation standardisée, puis éventuellement en abonnement.

La publicité est un complément éventuel. Le volume de trafic et les revenus réels
ne sont pas disponibles dans ce dépôt : aucune prévision de revenu publicitaire ni
valorisation du site ne peut être présentée comme établie.

## Décisions UX, DX et AX

| Décision | Effet utilisateur | Effet développeur et agent | Vérification |
|---|---|---|---|
| Quatre pays comparés : France, Allemagne, Espagne, Italie | Comparaison lisible, identique dans le texte et les courbes | Une liste partagée, aucune sélection cachée à reconstituer | Tests des pays, dates et unités |
| France en évidence même avec quatre courbes | Repérage immédiat de la série de référence | Style porté par la série, indépendant du nombre de voisins | Attribut de série testé, revue visuelle à effectuer |
| Dates et années fiscales déterministes en UTC | Même source et même mandat affichés quel que soit le lecteur | Fin des échecs de tests selon le fuseau de la machine | Tests existants rejoués dans plusieurs fuseaux |
| Validation locale distincte du pré-rendu avec données | Corrections plus faciles à vérifier avant intégration | Commande locale explicite, aucun téléchargement de production pour compiler le client | `npm run check:local` |
| Documentation du socle actuel | Moins de reprises fondées sur d'anciennes décisions | Entrée unique dans README, AGENTS et CONTRIBUTING | Liens et commandes contrôlés |
| Coûts complets dans le modèle économique | Monétisation compatible avec un accès public utile | Calcul reproductible, hypothèses modifiables, aucune facturation implicite | `npm run business:case` et tests du calcul |

La campagne nationale conserve ses 45 décisions sur cinq ans, le clic direct et les
sauvegardes. Les comparaisons ne doivent pas fusionner définitions nationales et
séries harmonisées. Le cadre externe Europe et le bouton d'ajout des pays restent
supprimés. Aucune modification commerciale ne change un score ou un chiffre observé.

## Ce qui est vendu

| Public | Valeur offerte | Première offre | À différer |
|---|---|---|---|
| Citoyen | Comprendre, comparer, jouer et citer les sources | Accès gratuit au produit existant | Abonnement grand public sans valeur supplémentaire démontrée |
| Organisme de formation, association | Faire travailler un groupe sur les arbitrages publics | Atelier animé, cadrage, support et débrief | Comptes élèves, suivi individuel, plateforme de formation complète |
| Rédaction, organisation | Expliquer une question précise avec une restitution réutilisable | Dossier adapté sur le socle existant, périmètre fermé | API commerciale, marque blanche complète, développements spécifiques illimités |

Le client paie le travail de préparation, la pédagogie, l'adaptation et le service.
Le simple accès aux mêmes données publiques ne constitue pas la valeur payante.
Le premier segment à tester est l'organisme de formation disposant d'un budget
d'animation ; le dossier éditorial reste une seconde offre, ouverte sur demande.

## Périmètre du pilote

**Atelier proposé : 1 200 € HT**, prix de test interne. Cadrage court, séance de
90 minutes à distance, utilisation de la campagne existante, support d'animation
et débrief collectif. Une organisation, une séance, un interlocuteur. Le devis
borne le public et la préparation ; déplacement et développement spécifique sont
exclus de cette hypothèse. La durée de séance n'est pas une promesse de finir la
campagne : le nombre de décisions est adapté au temps disponible.

**Dossier proposé : 2 400 € HT**, prix de test interne. Une question, données déjà
disponibles, jusqu'à trois graphiques et une note de restitution, un aller-retour
de corrections. Un connecteur, un hébergement client ou une enquête originale ne
sont pas inclus. La réutilisation est précisée selon les sources concernées.

Ces offres ne sont pas commercialisées par le site dans cette version. Aucun
paiement, formulaire de contact fictif, nouvel abonnement ou prospection automatique
n'est activé. Avant le premier devis : identifier le fournisseur qui facture,
le canal de contact, la disponibilité et le livrable exact. Un changement de ces
éléments doit mettre à jour le calcul et le devis, sans changer le moteur du jeu.

## Économie du pilote

Tous les montants sont HT et avant impôt. Hypothèse de valorisation du temps :
60 €/heure. Ce n'est ni une charge salariale observée ni une rémunération garantie.
La prospection inclut une quote-part des échanges qui ne se concluent pas.

| Hypothèse unitaire | Atelier | Dossier |
|---|---:|---:|
| Prix proposé | 1 200 € | 2 400 € |
| Préparation, réalisation et suivi | 6 h | 12 h |
| Prospection et échanges commerciaux | 3 h | 5 h |
| Coût du temps valorisé | 540 € | 1 020 € |
| Débours directs | 30 € | 90 € |
| Frais proportionnels, hypothèse de 2 % | 24 € | 48 € |
| Contribution après ces coûts | 606 € | 1 242 € |
| Marge contributive | 50,5 % | 51,75 % |
| Prix plancher pour 40 % de marge | 982,76 € | 1 913,79 € |

Coûts fixes mensuels proposés : 150 € de débours et 40 heures de maintenance,
données, rédaction et administration, soit 2 550 € au total. Le développement initial,
la fiscalité et le besoin en fonds de roulement ne sont pas inclus. Les frais de
paiement réels dépendront du canal retenu ; le taux proposé n'est pas un tarif fournisseur.

| Scénario mensuel hypothétique | CA | Contribution | Coûts fixes | Résultat économique | Temps total |
|---|---:|---:|---:|---:|---:|
| Aucune vente | 0 € | 0 € | 2 550 € | -2 550 € | 40 h |
| Un atelier | 1 200 € | 606 € | 2 550 € | -1 944 € | 49 h |
| Trois ateliers et un dossier | 6 000 € | 3 060 € | 2 550 € | 510 € | 84 h |
| Quatre ateliers et deux dossiers | 9 600 € | 4 908 € | 2 550 € | 2 358 € | 110 h |

Avec seulement des ateliers, cinq ventes mensuelles couvrent les coûts retenus.
Ce seuil dépend de toutes les hypothèses ; ce n'est pas un objectif de ventes acquis.
Le temps étant déjà valorisé, le résultat n'est pas assimilable au revenu personnel
disponible. Aucun abonnement récurrent ne figure dans ces scénarios.

Formules : contribution = prix × (1 - frais) - débours - coût horaire × heures
de réalisation et d'acquisition. Prix plancher = coûts unitaires hors frais /
(1 - frais - marge cible). Équilibre = arrondi supérieur des coûts fixes /
contribution unitaire positive. Une contribution négative n'a pas d'équilibre fini.

Recalcul depuis `site/` : `npm run business:case`. Les hypothèses vivent dans
`scripts/business-case.ts` et le calcul dans `scripts/business-model.ts`.
Les tests couvrent aussi l'absence de ventes, les offres déficitaires et les
hypothèses invalides. Remplacer les temps proposés par les temps réellement relevés
avant de décider d'augmenter la capacité.

## Validation commerciale

Plan proposé sur six semaines, à démarrer quand le contact et la disponibilité sont
définis. Aucun entretien ni contrat n'est présumé réalisé.

| Étape | Action utile | Preuve attendue | Décision suivante |
|---|---|---|---|
| Semaines 1 et 2 | Échanger avec cinq acheteurs potentiels du même segment | Problème récurrent, acheteur identifié, budget et calendrier discutés | Reformuler l'offre si le problème n'est pas reconnu |
| Semaines 3 et 4 | Proposer un pilote borné aux contacts qualifiés | Un pilote payé, temps commercial et prix accepté relevés | Livrer manuellement sur le produit existant |
| Semaines 5 et 6 | Réaliser et débriefer le pilote | Temps complet, marge, utilité comprise, demande de réachat ou recommandation | Standardiser ce qui se répète |
| Après trois pilotes payés | Comparer les besoins réellement communs | Deux clients demandent le même service récurrent | Étudier un abonnement limité à cette demande |

Seuils proposés : marge contributive d'au moins 40 % après temps commercial,
préparation dans le temps prévu et usage compréhensible sans correction du moteur.
Si l'offre dépasse durablement ces temps, réduire le périmètre ou revoir le prix.
Si aucun prospect n'identifie de budget, changer de segment avant de construire
un espace client. Une demande de modification partisane du score est refusée.

Le suivi commercial peut commencer par un registre manuel de rendez-vous, devis,
ventes, temps et réachat. Il n'exige aucun suivi des décisions personnelles de jeu.
Ne pas déduire des visites du site une intention d'achat ou une opinion politique.

## Publicité et financement complémentaire

Le jeu, les résultats et la méthode essentielle restent sans publicité. Un éventuel
partenariat éditorial est identifié, indépendant des scores et borné à une page
éligible. Les règles existantes de `site/src/mandats/operations.ts` restent en place,
avec publicité et mesure d'audience désactivées par défaut.

Le financement volontaire peut être complémentaire si la structure et les moyens
d'encaissement sont prêts. Ni dons, ni publicité, ni abonnement ne sont intégrés
au revenu attendu du pilote. L'indépendance éditoriale est aussi un actif économique.

## Repères externes, consultés le 7 septembre 2026

- [Datawrapper, offres et prix](https://www.datawrapper.de/pricing) combine un accès
  gratuit avec des fonctions et services professionnels payants. Cela appuie la
  séparation entre usage public et service professionnel, pas nos prix ni une
  preuve de demande pour 500signatures.
- [Our World in Data, financement](https://ourworldindata.org/funding) décrit un
  financement par subventions et soutiens. Ce modèle montre une autre manière de
  financer la gratuité, sans démontrer qu'elle serait suffisante ici.
- [CNIL, mesure d'audience](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience)
  expose les conditions propres aux solutions concernées. Le présent plan ne
  suppose pas qu'un outil serait automatiquement exempté de consentement.

La recommandation commerciale est une décision de conception fondée sur le produit
existant et ces repères. Elle doit être validée par les premiers clients, pas par
une extrapolation de leurs tarifs, de leurs audiences ou de leurs revenus.
