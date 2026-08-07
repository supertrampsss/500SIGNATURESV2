"""Les exonérations de cotisations : la même masse, publiée trois fois.

La fixture est l'extrait réel des **trois** jeux `exos-secteur-prive-*` de
l'Urssaf — départemental, régional, France entière — sur les vingt-deux
exercices, empilés dans un seul fichier. L'empilement est le seul écart avec
les exports : chaque ligne y garde sa colonne géographique d'origine, vide
pour les deux autres mailles, et c'est précisément ce que `maille()` lit sur
un export réel, où une seule des deux colonnes existe.

Le fichier entier sert de fixture, comme pour les droits de mutation : le
contrôle qui compte ici — Σ départements = Σ régions = France entière — ne se
satisfait pas d'un échantillon, et aucune erreur de lecture ne le passe par
hasard. Il attraperait notamment le piège de cette source : le jeu voisin
`exos-champ-large-*`, qui porte les mêmes colonnes et 1,6 % de masse en plus.
"""

from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import exonerations as x

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def lignes():
    return x.lire((FIXTURES / "urssaf_exonerations_sample.csv").read_bytes())


@pytest.fixture(scope="module")
def observations(lignes):
    return x.par_departement(lignes)


def _par_indicateur(observations) -> dict[tuple[str, str], float]:
    totaux: dict[tuple[str, str], float] = {}
    for identifiant, _, _, annee, montant in observations:
        totaux[(identifiant, annee)] = totaux.get((identifiant, annee), 0.0) + montant
    return totaux


def test_les_trois_ventilations_coincident(lignes):
    """16 738 lignes départementales, 4 197 régionales, 890 nationales : trois
    cardinalités pour le même argent."""
    par_maille = x.masses(lignes)
    assert set(par_maille) == {"departement", "region", "france"}
    assert [len([1 for ligne in lignes if ligne[0] == niveau])
            for niveau in ("departement", "region", "france")] == [16_738, 4_197, 890]

    verifies = x.controler(lignes)
    assert verifies["exercices_verifies"] == 22
    assert verifies["masse_totale"] == 1_000_708_444_570.604
    # 0,62 € sur 1 000,7 Md€ : le dernier bit de la mantisse, pas un périmètre.
    assert verifies["ecart_maximal_euros"] == 0.618


def test_le_seuil_est_relatif_et_non_une_egalite(lignes):
    """Une égalité exacte ferait échouer un run parfaitement juste : la source
    agrège les mêmes doubles dans trois ordres différents."""
    assert x.TOLERANCE == 1e-9
    premiere = lignes[0]
    assert premiere[0] == "departement"
    # Un euro de plus sur les 18,9 Md€ de son exercice reste sous le seuil ;
    # c'est voulu, et c'est l'ordre de grandeur du bruit de la source.
    tolerable = [(*premiere[:4], premiere[4] + 1.0), *lignes[1:]]
    x.controler(tolerable)
    masse = x.masses(lignes)["departement"][premiere[2]]
    assert 1.0 / masse < x.TOLERANCE


def test_le_controle_bloque_sur_le_champ_large(lignes):
    """Le piège de cette source : `exos-champ-large-*` porte les mêmes colonnes
    et 1,6 % de masse en plus — 81,922 Md€ contre 80,631 en 2024. Charger le
    mauvais jeu à une seule maille ne casse rien d'autre que ce contrôle."""
    champ_large = [
        (niveau, code, annee, categorie, montant * 1.016 if niveau == "region" else montant)
        for niveau, code, annee, categorie, montant in lignes
    ]
    with pytest.raises(x.MassesDivergentes, match="divergent"):
        x.controler(champ_large)


def test_le_controle_bloque_si_une_maille_manque_ou_perd_un_exercice(lignes):
    with pytest.raises(x.MassesDivergentes, match="maille"):
        x.controler([ligne for ligne in lignes if ligne[0] != "france"])
    tronquees = [
        ligne for ligne in lignes
        if not (ligne[0] == "region" and ligne[2] == "2019")
    ]
    with pytest.raises(x.MassesDivergentes, match="d'un seul côté"):
        x.controler(tronquees)


def test_l_annee_est_une_date_dans_la_source():
    """`annee` est typée `date` : l'API des enregistrements rend
    « 2024-01-01 » et ne se filtre que par `where=annee=date'2024-01-01'`,
    l'export CSV rend « 2024 »."""
    assert x.exercice("2024-01-01") == "2024"
    assert x.exercice("2024") == "2024"
    assert x.exercice(None) == ""


def test_les_champs_sont_demandes_par_leur_nom_jamais_par_leur_libelle(lignes):
    """Le libellé du premier champ porte un U+FEFF collé devant — « ﻿Année ».
    Un export par libellés le ferait entrer dans l'en-tête ; le fichier, lui,
    est lu en `utf-8-sig`."""
    adresse = x.url(*x.JEUX["departement"])
    assert "use_labels" not in adresse
    assert "annee" in adresse and "﻿" not in adresse
    assert x.JEUX["departement"][0] in adresse
    # Le BOM du fichier ne survit pas au décodage : sans quoi la première
    # colonne s'appellerait « ﻿annee » et aucune année ne serait lue.
    assert {ligne[2] for ligne in lignes} == {str(an) for an in range(2004, 2026)}


def test_les_montants_negatifs_sont_conserves(lignes, observations):
    """Quatre régularisations d'exercices antérieurs, jusqu'à −45 443 €. Un
    contrôle « montant ≥ 0 » rejetterait de la donnée juste."""
    negatives = [ligne for ligne in lignes if ligne[4] < 0]
    assert len(negatives) > 0
    assert min(ligne[4] for ligne in negatives) == -45_443.0
    # Elles ne rendent aucune observation publiée négative, mais elles y entrent.
    assert all(montant > 0 for _, _, _, _, montant in observations)


def test_les_totaux_annuels_publies(observations):
    """Les six derniers exercices, en milliards d'euros."""
    totaux = _par_indicateur(observations)
    attendus = {
        "2020": 58.928, "2021": 64.774, "2022": 73.527,
        "2023": 80.356, "2024": 80.631, "2025": 78.801,
    }
    for annee, milliards in attendus.items():
        assert round(totaux[("urssaf_exonerations_total", annee)] / 1e9, 3) == milliards


def test_les_allegements_generaux_sont_inclus_dans_le_total(observations):
    """Le second indicateur est une part du premier : 924,35 Md€ cumulés sur
    1 000,71, soit 92,4 %. Les additionner compterait deux fois."""
    totaux = _par_indicateur(observations)
    total = sum(v for (identifiant, _), v in totaux.items()
                if identifiant == "urssaf_exonerations_total")
    generaux = sum(v for (identifiant, _), v in totaux.items()
                   if identifiant == "urssaf_exonerations_allegements_generaux")
    assert round(generaux / 1e9, 2) == 924.35
    assert 0.923 < generaux / total < 0.924
    for annee in ("2004", "2015", "2024", "2025"):
        assert (totaux[("urssaf_exonerations_allegements_generaux", annee)]
                < totaux[("urssaf_exonerations_total", annee)])


def test_cent_departements_sans_mayotte_et_la_corse_en_deux(observations):
    """La source ne sert jamais Mayotte, sur aucun des vingt-deux exercices, et
    distingue les deux départements corses. Cent codes, stables."""
    codes = {code for _, _, code, _, _ in observations}
    assert len(codes) == 100
    assert {"2A", "2B", "971", "974"} <= codes
    assert "976" not in codes
    par_annee: dict[str, set[str]] = {}
    for _, _, code, annee, _ in observations:
        par_annee.setdefault(annee, set()).add(code)
    assert {len(c) for c in par_annee.values()} == {100}


def test_les_fiches_nomment_le_perimetre_et_refusent_les_confusions():
    """Une exonération n'est ni une dépense budgétaire, ni une recette, ni une
    dépense fiscale — le site publie déjà ces dernières sous
    `depense_fiscale_*`."""
    assert "secteur privé" in x.TECHNIQUE
    assert x.JEU_ECARTE in x.TECHNIQUE
    assert "non perçue" in x.TECHNIQUE
    assert "ni un crédit budgétaire" in x.TECHNIQUE
    assert "ni une dépense fiscale" in x.TECHNIQUE
    assert "Mayotte (976) est absente" in x.TECHNIQUE
    assert "régularisations" in x.TECHNIQUE
    assert "ne s'additionnent pas" in x.TECHNIQUE
    assert "incluse" in x.INDICATEURS["urssaf_exonerations_allegements_generaux"][1]
    for identifiant, (_, publique, _) in x.INDICATEURS.items():
        assert len(publique.split()) <= 50, identifiant
    # Le jeu voisin n'est nommé que pour être écarté.
    assert x.JEU_ECARTE not in {jeu for jeu, _ in x.JEUX.values()}


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    x.declarer(entrepot_seme)
    x.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (x.DATASET,),
    ).fetchall())
    assert set(publies) == set(x.INDICATEURS)
    assert set(publies.values()) == {"EUR"}
    (theme, additif) = entrepot_seme.execute(
        "select theme, additive from core.indicators"
        " where indicator_id = 'urssaf_exonerations_total'"
    ).fetchone()
    assert (theme, additif) == ("emploi", True)
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, observations):
    """Le jeu vient du registre versionné : sans sa ligne dans
    `infra/seed/dataset_registry.csv`, `verifier_integrite` compterait chaque
    run comme orphelin."""
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    (connu,) = entrepot_seme.execute(
        "select count(*) from meta.dataset_registry where dataset_id = ?",
        (x.DATASET,),
    ).fetchone()
    assert connu == 1, "le jeu doit être déclaré dans infra/seed/dataset_registry.csv"
    x.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('departement', '33', ?,"
        " 'Gironde', null, null, '{}')",
        (x.MILLESIME,),
    )
    run_id = entrepot.start_run(entrepot_seme, x.DATASET, "manual")
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, observations)
    ecrites, _ = revisions.remplacer(
        entrepot_seme, run_id, sorted(x.INDICATEURS), x.COLONNES,
        [
            (identifiant, niveau, code, x.MILLESIME, annee, montant)
            for identifiant, niveau, code, annee, montant in gardees
        ],
    )
    entrepot.finish_run(entrepot_seme, run_id, "success", rows_written=ecrites)
    entrepot_seme.commit()
    assert ecrites == 44, "deux indicateurs sur vingt-deux exercices, un département"
    assert len(ecartes) == 99, "les autres départements ne sont pas au référentiel"
    (valeur,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'urssaf_exonerations_total' and geo_code = '33'"
        " and period = '2024'"
    ).fetchone()
    assert round(valeur, 2) == 2_099_918_222.47
    assert entrepot.verifier_integrite(entrepot_seme) == []


def test_la_couverture_se_mesure_en_euros(observations):
    """Compter les codes ferait peser Mayotte absente autant que l'Île-de-France."""
    lus = x.masse_par_maille(observations)
    assert round(lus["departement"] / 1e9, 3) == 1000.708
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"departement": lus["departement"] * 0.5})
