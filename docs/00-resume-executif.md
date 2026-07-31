# 00 — Résumé exécutif

*31 juillet 2026 — étude préalable, aucun code applicatif à ce stade.*

## 1. Ce que le benchmark établit

Le socle de données nécessaire au produit existe, il est **majoritairement ouvert,
gratuit et sous Licence Ouverte 2.0 (Etalab)**, et l'essentiel du MVP est accessible
**sans clé d'API** :

- **INSEE** : Melodi (JSON, sans clé — revenus/pauvreté Filosofi à la commune,
  recensement, populations historiques 1968→, comptes nationaux) et BDM (SDMX,
  sans clé — dette et déficit Maastricht, PIB, inflation, chômage localisé,
  ~150 000 séries). Seule Sirene exige une clé (gratuite).
- **OFGL** (Observatoire des finances et de la gestion publique locales) : finances
  des communes, EPCI, départements, régions — agrégats comptables harmonisés à la
  commune depuis ~2013-2016, API Opendatasoft sans clé. C'est la meilleure source
  du marché pour le comparateur territorial ; les comptes individuels DGFiP la
  complètent.
- **data.economie.gouv.fr** (MEF/DGFiP/Direction du Budget) : budget de l'État voté
  (PLF/LFI par mission-programme-action, AE/CP), exécution annuelle, situation
  mensuelle, dépenses fiscales, opérateurs — API Opendatasoft sans clé.
- **Eurostat** : API de diffusion JSON-stat/SDMX sans clé, définitions harmonisées
  (dette/déficit Maastricht, COFOG, chômage, PIB en SPA) ; géométries NUTS via GISCO.
- **IGN / Géoplateforme + BAN** : géométries administratives (Admin Express COG),
  géocodage (api-adresse), référentiel COG INSEE avec historique des fusions.

Un échantillon d'endpoints critiques a été **testé en HTTP le 31/07/2026**
(statuts consignés dans le registre, colonne « Vérif. »). Les points durs connus :
volumétrie (Sirene ~28 M d'établissements, DVF ~5 M de mutations/an), ruptures
méthodologiques (Filosofi 2 non comparable avant/après 2022, rebasements des comptes
nationaux), secret statistique (petites communes), et l'impossibilité structurelle
de géolocaliser la majorité des dépenses de l'État.

## 2. Principes et limites de la promesse « de l'impôt à l'euro dépensé »

Ces principes sont opposables ; toute page du produit doit pouvoir les citer.

1. **Universalité budgétaire.** Hors affectations explicites (comptes d'affectation
   spéciale, taxes affectées, CSG → sécurité sociale), les recettes ne financent pas
   une dépense particulière. Le produit ne simule **jamais** une affectation
   individuelle « votre euro est allé à X ». Il visualise un **bridge de masses** :
   prélèvements obligatoires → recettes par sous-secteur d'administration (État,
   ASSO, APUL, UE) → budgets votés → crédits ouverts → engagements → paiements →
   exécution → politiques publiques (mission/COFOG) → territoires *quand la donnée
   officielle le permet*. Chaque maillon du bridge a une source officielle
   identifiée dans le registre ; chaque rupture de traçabilité est affichée.
2. **Trois comptabilités, jamais confondues.** Comptabilité budgétaire (AE/CP,
   encaissements-décaissements), comptabilité générale de l'État (droits constatés,
   bilan), comptabilité nationale (S13, Maastricht, COFOG). Chaque chiffre porte son
   référentiel ; les écarts entre référentiels (déficit budgétaire ≠ déficit
   notifié) sont documentés, pas gommés.
3. **Voté ≠ ouvert ≠ engagé ≠ payé ≠ exécuté.** La chaîne LFI → LFR → crédits
   ouverts → AE → CP → exécution constatée (loi relative aux résultats de la
   gestion) est un waterfall affiché tel quel, chaque barre avec sa source.
4. **Impôt ≠ taxe ≠ cotisation ≠ contribution ≠ redevance ≠ dépense fiscale.**
   Le module « 100 € de prélèvements » décompose par catégorie de prélèvement et
   par administration destinataire, montre le déficit comme financement par la
   dette, et distingue destination comptable, économique et territoriale.
5. **La géolocalisation de la dépense est partielle — et le produit le dit.**
   Territorialisable aujourd'hui : finances locales (commune), dotations de l'État
   aux collectivités (commune), commande publique (acheteur/titulaire), une partie
   des subventions et des fonds européens. Non territorialisable : l'essentiel des
   paiements du budget de l'État et les prestations sociales individuelles. Chaque
   indicateur affiche son **taux de couverture territoriale**.
6. **Historisation territoriale obligatoire.** Aucune série communale comparée
   entre millésimes sans table de passage COG (fusions/scissions). Contrainte de
   schéma, pas une bonne pratique optionnelle.
7. **Comparer = contrôler définition, périmètre, unité, année.** Le comparateur
   refuse une comparaison non conforme plutôt que d'afficher un résultat faux.
   Les comparaisons UE n'utilisent que des agrégats harmonisés (Eurostat).
8. **Aucun score composite, aucun jugement.** Pas de note globale, pas de
   classement « bien/mal géré » : des indicateurs officiels, leurs définitions et
   des groupes de comparaison transparents.

## 3. Décision d'architecture (résumé)

Détail dans [03-architecture.md](03-architecture.md). En une phrase par couche :

- **Collecte** : connecteurs déterministes (TypeScript/Workers pour les API légères,
  Python pour les volumes) → snapshots immuables horodatés + SHA-256 dans **R2**.
- **Entrepôt** : **Supabase PostgreSQL + PostGIS** = registre des sources, lineage,
  référentiel géographique historisé, observations normalisées, contrôles qualité.
- **Diffusion** : la carte et les fiches lisent des **exports statiques versionnés**
  (JSON/PMTiles sur Pages/R2 + cache Cloudflare) générés depuis la base — pas de
  requête SQL sur le chemin critique utilisateur au MVP.
- **API publique** : phase 3, versionnée, OpenAPI, une fois le lineage complet.
- **IA** : FABLE5 orchestre et surveille, Opus 5 investigue ; publication toujours
  derrière des contrôles déterministes et une validation humaine.

## 4. Ce que le MVP livre (8–12 semaines)

Carte France entière → commune, fiches territoire, comparateur, pour : population
et démographie, revenus/pauvreté, finances locales (dépenses, dette, dotations),
budget de l'État agrégé (voté vs exécuté par mission), dette et macro nationales,
emploi/chômage, entreprises (stocks/créations), comparaisons UE (dette, déficit,
chômage, PIB/hab en SPA) — chaque chiffre avec panneau « D'où vient ce chiffre ? ».

### État d'avancement au 31 juillet 2026

En ligne : le référentiel géographique (COG 2025, y compris Métropole de Lyon,
Collectivité européenne d'Alsace et établissements publics territoriaux du Grand
Paris), les finances locales de l'OFGL des quatre niveaux, les groupes de
comparaison entre communes semblables, la dette publique par sous-secteur
(INSEE, base 2020), les comparaisons européennes (Eurostat) et le **budget de
l'État de 2013 à 2025, voté, rectifié et exécuté** — le pont recettes → dépenses
→ solde, avec l'écart entre la loi de finances et l'exécution.

Restent à livrer : le budget de l'État par mission et programme (destination des
crédits, et non plus seulement leur nature), les revenus et la pauvreté
communaux, le moteur de questions en langage naturel et l'API publique
versionnée. Le détail par mission suppose les jeux PLF, un par exercice, dont
l'identifiant change chaque année.
