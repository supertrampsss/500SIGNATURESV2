# Audit du front et plan d'amélioration

*8 août 2026. Audit mené sur le build de production branché sur les données
réelles publiées (version 2026-08-08T0635), aux viewports 1440×900 et 390×844,
avec mesures dans le DOM (tailles calculées, boîtes, contrastes en luminance
relative WCAG), croisé avec un audit du code (tokens, échelles, structure).*

## Lecture de design

Site civique de données publiques, dont la monnaie est la **confiance** : le
langage visuel juste est sobre, dense sans être touffu, sans aucun effet
démonstratif. En termes de curseurs : variance faible, mouvement minimal,
densité moyenne-haute. Ce cadrage **valide l'identité actuelle** (encre
`#0f1b2e` sur papier `#fbfaf6`, Spectral pour les titres, Public Sans pour le
texte) : le plan ci-dessous ne propose pas de refonte visuelle, il corrige ce
qui trahit cette identité en pratique.

## Ce qui tient, à ne pas casser

1. **La discipline éditoriale des chiffres** : chaque valeur porte son écart
   chiffré et son référentiel, les définitions vivent en infobulle sans pousser
   la mise en page, les aria-labels des courbes énoncent valeurs et repères.
   C'est l'ossature de la confiance.
2. **La palette et le couple typographique** : identité sobre, institutionnelle
   sans être administrative ; l'argile et le doré restent parcimonieux ; aucune
   dérive décorative. Corriger le gris doux **sans** introduire de couleur.
3. **Les patterns de repli** : « L'essentiel » en puces, « Tout le détail »,
   le pont ouvert d'emblée avec ses plis récursifs qui bouclent comptablement,
   la légende escamotable. La logique « montrer peu, tout garder accessible »
   est la bonne ; le problème n'est jamais le pli, c'est sa **découvrabilité**.

## Constats, par priorité

### P0 : bugs et violations des règles produit

| # | Constat | Preuve |
|---|---|---|
| 1 | **Mobile : toucher la poignée du tiroir sélectionne la commune sous le doigt.** Fiche Bordeaux → fiche « Civray » au premier tap, avec rechargement de lot : le lecteur perd son territoire en voulant redimensionner. Reproduit deux fois. | captures `audit/91`, `audit/92` |
| 2 | **17 s de chargement de lot sans aucun retour visuel** : l'ancienne fiche reste figée, pas de squelette, pas d'état occupé ; le lecteur croit que le clic n'a pas marché. | `audit/31` identique à `audit/01` |
| 3 | **Tirets cadratins dans l'UI rendue** (title du document, « 100 € du budget de l'État — exercice 2025 », légendes des donuts « TVA — 25,29 € », descriptions FAQ, pied de page, notes) et **markdown brut non rendu** (`**crédits de paiement**` affiché avec ses astérisques) page Données. Deux règles produit violées. | `audit/41`, dump texte |
| 4 | **Onglet Justice affiché et vide sur les fiches communales** (la mesure n'existe qu'au département) : un onglet cliquable vers une section blanche, sans indication de changer d'échelle. « Une donnée absente n'écrit rien » doit valoir pour la navigation aussi. | `audit/13` |
| 5 | **Collision à 1440 px** : la rangée de pilules Métropole…Mayotte passe sous le panneau et recouvre la dernière ligne de la fiche. | `audit/01` |

### P1 : navigation et découvrabilité

| # | Constat | Piste |
|---|---|---|
| 6 | **Les 4 rubriques et les 26 thèmes sont à 2 282 px de scroll** dans la fiche : un lecteur ne découvre jamais l'étendue du contenu. | Rendre la barre de rubriques **collante** sous l'en-tête de fiche (les onglets existent déjà ; c'est leur position, pas leur design, qui est en cause). |
| 7 | **Aucun sélecteur d'indicateur pour la carte** : elle ne se pilote que par « Voir sur la carte », caché dans le détail déplié d'une mesure. « La carte du chômage » ne se trouve pas. | Un sélecteur d'indicateur près de la légende (liste par thème), qui réutilise le mécanisme existant. |
| 8 | **Comparateur inaccessible** : uniquement par paramètre d'URL `?comparer=`, aucun bouton n'y mène. | Une action « Comparer » dans l'en-tête de fiche. |
| 9 | **Barres de pilules tronquées sans affordance** (thèmes : 893 px pour 761 visibles ; mobile : 960 pour 351 ; DOM mobile pareil). | Dégradé de bord + marge de dépassement visible (pattern standard d'overflow). |
| 10 | **L'en-tête de fiche n'est pas navigable** : « Gironde » n'est pas un lien, remonter à la maille supérieure exige la recherche. Avec le #4, atteindre « Densité carcérale » depuis Bordeaux = 6 clics + une saisie + ~17 s. | « Commune · [Gironde] · … » cliquable ; et l'onglet vide (#4) renvoie explicitement vers la maille qui porte la donnée. |
| 11 | **Fermer la fiche ne ferme rien** : retour à la fiche France, carte laissée en maille commune (France pointilliste illisible). | Définir l'état « fiche fermée » : carte remontée à la maille lisible. |

### P2 : lisibilité et accessibilité

| # | Constat | Piste |
|---|---|---|
| 12 | **Le gris doux `#6e7d73` échoue AA partout** : 4,34:1 sur blanc (seuil 4,5), 3,83:1 sur carreaux `#f2f1ec`, porté par des corps de 9,9 à 13,6 px (sous-titres, lectures des rapports, phrases de mesure, légende, pilules inactives). | **Un seul assombrissement du token** (≈ `#5c6a61`) corrige des dizaines d'échecs d'un coup, sans changer l'identité. |
| 13 | **29 tailles de police distinctes** (audit code), dont une nappe sous 12 px (9,92 / 10,88 / 11,2 / 11,52 / 11,84). | Échelle typographique tokenisée de ~8 crans, plancher 0,75 rem pour tout texte porteur d'information. |
| 14 | **Cibles tactiles sous 44 px généralisées** : « i » 16 px, pilules 27, onglets 29, poignée 25, « Voir sur la carte » 26 de haut. | Zone de frappe étendue (padding/pseudo-élément), sans grossir le dessin. |
| 15 | Focus clavier : l'en-tête garde l'outline navigateur par défaut quand tout le reste a le focus or 2 px ; le Tab entre dans le canvas de la carte ; la poignée mobile n'a pas d'`aria-expanded` ; « L'ESSENTIEL » n'est pas un heading. | Aligner, exclure le canvas de l'ordre de tabulation, compléter l'ARIA. |
| 16 | **Carreaux des 6 rapports en mobile** : lecture 10,88 px et évolution 9,92 px à 3,83:1 dans des carreaux de 172 px. | Avec #12 et #13 ; raccourcir les textes de lecture (116-139 caractères par carreau aujourd'hui). |
| 17 | **Décryptages : ~140 caractères par ligne** (paragraphes sur 1 013 px). | `max-width` de lecture ~70ch. |
| 18 | **« Sources et méthode » : 500 000 caractères, 94 plis, sans sommaire.** La page qui fonde la confiance est infranchissable. | Sommaire ancré par thème + champ de filtre ; le contenu ne change pas. |

### P3 : fondations (dette de système)

| # | Constat | Piste |
|---|---|---|
| 19 | Pas d'échelle d'espacement (84 paddings distincts), rayons en trois systèmes non documentés (999 px, tokens 12/8 px, et 2/3/6 px en dur), points de rupture en trois unités (60rem, 640px, 40rem). | Compléter les tokens : espacement en 8 crans, règle de rayon écrite (999 = pilule interactive, 12 = carte, 8 = champ ; supprimer les valeurs en dur), points de rupture unifiés. |
| 20 | **Google Fonts en `<link>`** : bloquant au rendu et **non conforme CNIL** (transfert hors UE) pour un site civique français. Spectral et Public Sans sont sous licence libre. | Auto-héberger les deux familles (woff2 + `font-display: swap`). |
| 21 | **Monolithes** : `main.ts` 1 977 lignes, `fiche.ts` 1 729, `style.css` 3 391. La logique pure est bien extraite et testée (pont, ratios, série, évolution-carte) ; c'est l'orchestration DOM et la feuille de style qui concentrent la dette. | Extraction par surface (carte, panneau, décryptages, données) au fil des chantiers ci-dessus, jamais en refonte sèche. |
| 22 | **Pas de mode sombre** (aucun `prefers-color-scheme`). | À trancher : l'assumer comme choix (papier institutionnel unique) ou l'inscrire au backlog. Recommandation : l'assumer, le documenter, et s'assurer que le fond est peint explicitement. |
| 23 | `--accent` est identique à `--encre` : le site n'a pas de couleur d'action distincte, l'or ne sert qu'au focus. | Choix à documenter : soit l'assumer (l'action se marque par la forme, pas la couleur), soit promouvoir l'argile en accent d'action unique. Pas d'urgence. |

### P4 : raffinements

| # | Constat |
|---|---|
| 24 | Pont : la variation rendue sous le montant fait zigzaguer le scan vertical ; l'indentation des plis (11 px, triangle minuscule) distingue mal les niveaux 2 et 3. |
| 25 | Extrêmes non amortis sur micro-communes : « +2 280 % vs la médiane », « −100 % » sur des zéros (Rochefourchat, 2 hab.) décrédibilisent la lecture. Borner l'affichage (« sans commune mesure » existe déjà pour les repères : l'étendre). |
| 26 | Légende : bornes tronquées (« par h… »), pastille repliée sans étiquette, millésime visible uniquement là. |
| 27 | Mini-tableaux : 6 colonnes visibles sur 19 points sans indice de défilement ; libellé « 100 premiers territoires » affiché quand il y en a 17. |
| 28 | Note d'agrégat national (« somme des 18 régions ») affichée sur une fiche communale (thème Logement). |
| 29 | Sections quasi vides (Énergie, Transports, Environnement : 2 mesures chacune) : accepté pour l'instant, elles grandiront avec les données ; à regrouper si elles stagnent. |

## Plan d'exécution

Cinq lots, chacun livrable et vérifiable indépendamment (tests site + passe
navigateur aux deux viewports + contrastes remesurés) :

- **Lot A, bugs (P0)** : poignée mobile, retour visuel de chargement, purge
  cadratins + rendu du gras dans les notes, onglets vides masqués ou
  redirigeants, collision des pilules à 1440. *Critère : les 5 preuves de
  l'audit ne se reproduisent plus.*
- **Lot B, navigation (P1)** : rubriques collantes, sélecteur d'indicateur de
  carte, bouton Comparer, affordance de débordement, en-tête de fiche
  navigable, état fiche fermée. *Critère : « Densité carcérale » atteignable
  en 3 clics depuis Bordeaux ; les 26 thèmes visibles sans scroll.*
- **Lot C, lisibilité (P2)** : token gris assombri, échelle typographique,
  cibles tactiles, focus/ARIA, largeur de lecture, sommaire des Sources.
  *Critère : zéro paire de contraste sous AA sur les gabarits audités ; zéro
  texte porteur d'information sous 12 px.*
- **Lot D, fondations (P3)** : polices auto-hébergées, tokens d'espacement et
  de rayon, points de rupture unifiés, décisions documentées (mode sombre,
  accent), extractions de modules au fil de l'eau.
- **Lot E, raffinements (P4)** : au fil des chantiers voisins.

Ordre recommandé : A seul d'abord (petit et urgent), puis B et C en parallèle,
D porté par B/C (les tokens se posent en corrigeant), E opportuniste.

*Captures de l'audit : `scratchpad/audit/` de la session (préfixe `audit/`
dans les tableaux). Constats de code : `site/src/style.css` (tokens :root),
`site/index.html` (polices), comptages du 8 août 2026.*
