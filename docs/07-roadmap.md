# 07 — Livrable 7 : roadmap

## MVP — 8 à 12 semaines

**Fonctionnalités** : carte France → commune (choroplèthe, 4 déclinaisons),
recherche BAN/commune, fiche territoire, comparateur 2–5 territoires + groupe de
comparaison v1 (strate + densité + niveau de vie), pages nationales (budget de
l'État voté vs exécuté par mission, dette, macro), volet UE v1 (4 indicateurs
harmonisés), panneaux de traçabilité complets, dashboard de fraîcheur public,
exports CSV/lien.

**Sources** (toutes P0 du registre) : COG + Admin Express + table d'appartenance
+ GISCO ; Melodi (Filosofi, populations, RP clés, SIDE) ; BDM (dette, PIB, IPC,
chômage localisé) ; OFGL (4 niveaux) + dotations ; data.economie (PLF/LFI +
exécution) ; AFT/encours ; Sirene stocks ; Eurostat (gov_10dd_edpt1, gov_10a_exp,
nama_10_pc, une_rt_m) ; data.gouv.fr + connecteur ODS générique. DVF : inclus
seulement si la charge reste maîtrisable après S6 (sinon phase 2, décision D8).

**Dépendances** : projet Supabase + PostGIS ; R2 ; clé INSEE Sirene ;
tippecanoe en CI ; skill design installé avant le front.

**Risques principaux** : sous-estimation du nettoyage OFGL/DGFiP ; volumétrie
Sirene ; tuiles communales (taille) ; disponibilité d'un relecteur humain pour
les validations.

**Charge estimée** : ~2 ETP développement (1 data/back, 1 front/carto) + relecture
méthodo ponctuelle. Découpage : S1-2 socle (repo, CI, Supabase, R2, migrations,
registre) ; S3-5 connecteurs P0 + geo ; S5-7 exports + tuiles ; S6-9 front carte +
fiches ; S9-11 comparateur + UE + qualité ; S11-12 durcissement, staging→prod.

**Tests d'acceptation (échantillon)** :
- Rejouer une ingestion depuis un snapshot R2 ⇒ mêmes chiffres (reproductibilité).
- Fiche de 5 communes-tests (dont une fusionnée, une ultramarine, une sous secret
  Filosofi) : chaque chiffre a source/millésime/unité/dénominateur ; la commune
  fusionnée affiche une série continue via `geo.passage`.
- Waterfall LFI→exécution 2024 = totaux des documents officiels (±0,5 %).
- Comparateur refuse une comparaison inter-années avec message explicite.
- Dashboard fraîcheur : 100 % des jeux P0 verts ; couper une source ⇒ alerte < 24 h.
- Lighthouse a11y ≥ 95 ; carte utilisable au clavier.

**Critères de passage en phase 2** : tous les tests d'acceptation verts 2 semaines
consécutives en prod ; < 1 correction de chiffre publiée/mois ; base des coûts
d'infra ≤ budget fixé ; backlog de dette technique < 10 tickets bloquants.

## Phase 2 — approfondissement (3–6 mois)

**Fonctionnalités** : budgets détaillés (comptes individuels, REI, dépenses
fiscales, PLRG, situation mensuelle), santé (Ameli/DREES/APL/FINESS), éducation
(établissements, effectifs, IPS), sécurité (SSMSI + BAAC, verrous d'affichage),
marchés publics (DECP nettoyées), subventions (jaunes), transport/énergie (conso
communale, SNCF), environnement (artificialisation), immobilier (DVF si reporté,
Sitadel, RPLS), emploi fin (URSSAF, France Travail, salaires BTS), module
**« 100 € de prélèvements »** (comptes nationaux + OpenFisca cas-types étiquetés),
groupes de comparaison v2 (tourisme, littoral/montagne, centralité).

**Dépendances** : clé France Travail (OAuth) ; pipeline de dédoublonnage DECP ;
relecture méthodo santé/éducation/sécurité (formulations sensibles).

**Risques** : qualité DECP ; charge de nettoyage des comptes individuels ;
sensibilité éditoriale sécurité/éducation (IPS) — mitigation : verrous du doc 04
+ revue humaine systématique.

**Tests d'acceptation** : totaux DECP après nettoyage documentés (part rejetée
publiée) ; module 100 € validé par recalcul contre les comptes nationaux ; chaque
domaine sensible a sa page méthodo relue.

**Critères de passage** : couverture P1 ≥ 80 % ; fraîcheur verte ; audit externe
informel (un journaliste data + un économiste) sans erreur factuelle relevée.

## Phase 3 — plateforme (6–12 mois)

**Fonctionnalités** : API publique versionnée + OpenAPI + quotas ; moteur de
questions (doc 05) ; flux complexes (transferts État↔collectivités↔UE en
Sankey) ; données européennes territorialisées (NUTS2/3) ; alertes territoriales
(abonnement à une commune) ; datasets dérivés publiés (agrégats réutilisables) ;
analyses avancées et simulations **explicitement étiquetées** ; balances
comptables détaillées ; satellites (SDIS, syndicats).

**Dépendances** : lineage complet stable (pré-requis API) ; Supabase Auth pour
l'admin ; évaluation du moteur de questions sur corpus de test avant ouverture.

**Risques** : coût d'exploitation API ; qualité des réponses NL (mitigation :
gabarits SQL fermés, refus par défaut) ; charge de support.

**Critères de sortie** : API stable 3 mois, p95 < 300 ms sur cache ; moteur de
questions ≥ 95 % de réponses correctes sur le corpus de recette, 0 invention
détectée ; documentation réutilisateur complète.
