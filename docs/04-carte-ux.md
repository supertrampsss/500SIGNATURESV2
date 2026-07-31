# 04 — Livrable 4 : UX et carte interactive

*Le centre du produit est une carte de France qui **explique**, pas seulement
affiche. Design : installer le skill `taste-skill`
(`npx skills add https://github.com/Leonxlnx/taste-skill`) avant tout travail
d'interface — ticket T-13.*

## Stack cartographique

- **MapLibre GL JS** (open source, compatible Cloudflare, rendu vectoriel).
- **PMTiles sur R2** : un seul fichier d'archive de tuiles par couche
  (communes/EPCI/départements/régions × millésime), servi en range-requests via
  le CDN — pas de serveur de tuiles à exploiter.
- Fond de carte sobre auto-hébergé (tuiles vectorielles OpenMapTiles ou
  équivalent, licence et attribution affichées) ; OSM = fond de plan uniquement,
  jamais source de chiffres.
- Recherche : BAN (`api-adresse.data.gouv.fr`) pour l'adresse, index communal
  local (nom + code INSEE, avec anciennes communes) pour les territoires.

## Parcours utilisateur

1. **Arrivée** : France entière, un thème par défaut « neutre » (population),
   invitation « tapez votre commune ».
2. **Zoom progressif** : région → département → EPCI → commune ; le **niveau
   territorial s'adapte au zoom** mais reste forçable par le sélecteur. IRIS
   seulement là où un indicateur IRIS existe réellement (sinon niveau masqué).
3. **Sélecteurs** (toujours visibles, état encodé dans l'URL — tout écran est
   partageable) : thème (impôts, dépenses, dette, emploi, entreprises,
   population, sécurité, santé, école, logement, immobilier, transport, énergie,
   environnement) ; indicateur (dans le thème) ; période (slider des millésimes
   disponibles) ; niveau territorial ; déclinaison (total / par habitant / % du
   budget / évolution).
4. **Fiche territoriale** (panneau latéral, page dédiée partageable) :
   identité (population, EPCI, strate), blocs thématiques avec les indicateurs
   clés, séries temporelles, position dans le groupe de comparaison
   (distribution, médiane, quartiles — jamais un « rang » sec), liens sources.
5. **Comparateur 2–5 territoires** : mêmes indicateurs côte à côte + séries
   superposées. **Benchmark automatique** : « communes comparables » selon la
   méthodologie de strates publiée (doc 01 §3) — le groupe affiche ses critères
   et la liste de ses membres.
6. **Volet européen** : cartes et graphiques par pays (NUTS0, NUTS2 pour le
   chômage), uniquement sur `european_comparisons` (agrégats harmonisés).

## Représentations

- Choroplèthe par défaut (quantiles affichés, échelle visible, bornes fixes dans
  le temps pour les animations temporelles).
- Bulles (volumes absolus), barres/distributions (comparateur), **waterfall**
  (LFI → LFR → crédits → AE → CP → exécuté ; et bridge prélèvements → dépenses),
  flux (transferts État ↔ collectivités) — chaque forme uniquement là où elle est
  adaptée ; jamais de camembert pour des évolutions.
- Export : CSV du sous-ensemble affiché (avec colonnes source/millésime/unité),
  PNG de la vue, lien permanent.

## La carte explique — règles d'affichage (opposables)

| Règle | Implémentation |
|---|---|
| Chaque chiffre a une unité | l'unité vient de `indicators.unit`, jamais du front |
| Chaque ratio affiche son dénominateur | `denominator_indicator_id` rendu sous la valeur (« pour 1 000 hab., population municipale 2023 ») |
| Chaque comparaison révèle son année | badge millésime sur chaque série ; comparaison refusée si années différentes, avec message explicite |
| Chaque donnée : source, méthode, extraction, fiabilité | panneau **« D'où vient ce chiffre ? »** : producteur, jeu, date d'extraction (`raw_assets.fetched_at`), lien direct, badge de confiance |
| Panneau « Méthodologie et limites » | `methodology_notes` du producteur + limites (secret statistique, champ, rupture) |
| Panneau « Dernière mise à jour » | `pub.mv_freshness` : date + retard éventuel |
| Panneau « Comparabilité » | flags de rupture de série, changements de périmètre territorial (fusions), avertissements Filosofi 2 / réforme TH / VRS |
| Cartes de dépenses | 4 déclinaisons obligatoires : montant total, €/habitant, % du budget, évolution — et couverture territoriale affichée |
| Cartes de sécurité | taux normalisés uniquement, avertissement d'interprétation permanent, pas de classement |
| Cartes fiscales | agrégats uniquement ; les mailles sous secret n'affichent « non publiable » (jamais 0) ; aucune réidentification possible |
| Couleurs | échelles perceptuellement uniformes, divergentes autour de la médiane quand pertinent, pas de rouge = « mauvais », daltonisme testé |

## Mobile et accessibilité

- Mobile-first : la fiche territoire est l'écran principal sur mobile, la carte
  un mode secondaire plein écran.
- WCAG 2.1 AA : navigation clavier complète (y compris la carte : liste des
  territoires en alternative), contrastes vérifiés en CI, `prefers-reduced-motion`
  respecté, toutes les données cartographiques accessibles en tableau HTML
  équivalent (ce qui sert aussi le SEO et la citabilité).
- Performance : budget < 200 ko de JS initial hors moteur carte ; les PMTiles et
  JSON sont servis du CDN ; pas de requête base de données sur le chemin
  utilisateur au MVP.
