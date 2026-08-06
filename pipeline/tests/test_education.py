"""L'école du quotidien : le zéro d'une commune sans école est une donnée, un
« à fermer » n'est pas un « ouvert », et un service administratif n'est pas une
école. Les valeurs de champ viennent des facettes réelles du portail.

Et la période ne vient pas de l'horloge. Elle valait `datetime.now().year` : le
5 août 2026, l'annuaire sortait en période « 2026 » quand toutes les populations
s'arrêtent à 2025, si bien que le groupe de communes semblables ne trouvait
aucun dénominateur et ne s'affichait pas — sans un mot. Rejoué en janvier, le
même instantané aurait porté une autre période et fabriqué deux rentrées
identiques. Les tests qui suivent tiennent les deux bouts : la période sort de
la date que le portail publie, et les trois mailles comptent le même annuaire.
"""


from plateforme.normalize import education

ENTETE = (
    "identifiant_de_l_etablissement;code_commune;code_departement;code_region;"
    "type_etablissement;etat"
)


def csv_annuaire(lignes: list[str]) -> bytes:
    return ("\n".join([ENTETE, *lignes])).encode("utf-8")


def test_le_comptage_filtre_par_type_et_par_etat():
    comptes, lus = education.compter(csv_annuaire([
        "0331111A;33318;033;75;Ecole;OUVERT",
        "0331112B;33318;033;75;Ecole;OUVERT",
        "0331113C;33318;033;75;Collège;OUVERT",
        "0331114D;33318;033;75;Lycée;OUVERT",
        "0331115E;33318;033;75;Ecole;A FERMER",          # ouvert sur le papier seulement
        "0331116F;33318;033;75;Service Administratif;OUVERT",  # pas une école
        "0331117G;33318;033;75;EREA;OUVERT",             # hors champ, dit dans le module
        "0331118H;2A004;02A;94;Ecole;OUVERT",
    ]))
    assert lus == 8
    assert comptes["commune"]["ecoles"] == {"33318": 2, "2A004": 1}
    assert comptes["commune"]["colleges_lycees"] == {"33318": 2}


def test_les_trois_mailles_sortent_du_meme_parcours():
    """C'est ce qui rend le contrôle bloquant possible : chaque établissement
    porte ses trois codes sur la même ligne."""
    comptes, _ = education.compter(csv_annuaire([
        "A;33318;033;75;Ecole;OUVERT",
        "B;40001;040;75;Ecole;OUVERT",
        "C;2A004;02A;94;Ecole;OUVERT",
    ]))
    # Le producteur écrit « 033 », le référentiel « 33 » : sans normalisation la
    # carte départementale sortait vide, et rien ne le signalait.
    assert comptes["departement"]["ecoles"] == {"33": 1, "40": 1, "2A": 1}
    assert comptes["region"]["ecoles"] == {"75": 2, "94": 1}


def test_les_arrondissements_comptent_pour_leur_commune():
    """Paris affichait « 0 école » : l'annuaire code par arrondissement, et le
    zéro écrit — honnête dans son intention — était faux. Un établissement du
    9e arrondissement est un établissement de Paris."""
    comptes, _ = education.compter(csv_annuaire([
        "0751111A;75109;075;11;Ecole;OUVERT",
        "0751112B;75120;075;11;Ecole;OUVERT",
        "0131113C;13201;013;93;Collège;OUVERT",
        "0691114D;69385;069;84;Lycée;OUVERT",
    ]))
    assert comptes["commune"]["ecoles"] == {"75056": 2}
    assert comptes["commune"]["colleges_lycees"] == {"13055": 1, "69123": 1}
    # Le rattachement ne déplace que la commune : le département et la région de
    # l'établissement sont ceux que la source publie, et ils ne bougent pas.
    assert comptes["departement"]["ecoles"] == {"75": 2}


def test_un_code_illisible_ne_compte_pas_a_sa_maille_mais_compte_aux_autres():
    """Les mailles sont indépendantes : un établissement dont le code commune
    est tombé garde son département. C'est le comportement juste, et c'est
    précisément pourquoi le contrôle bloquant ne compare pas la commune aux
    deux autres — elle seule perd des lignes et rattache des arrondissements."""
    comptes, _ = education.compter(csv_annuaire([
        "X;331;033;75;Ecole;OUVERT",      # commune tronquée, département bon
        "Y;;033;75;Ecole;OUVERT",         # commune vide, département bon
        "Z;33318;3;75;Ecole;OUVERT",     # commune bonne, département tronqué
    ]))
    assert comptes["commune"]["ecoles"] == {"33318": 1}
    assert comptes["departement"]["ecoles"] == {"33": 2}
    assert comptes["region"]["ecoles"] == {"75": 3}


def test_la_periode_est_l_annee_scolaire_de_la_source_pas_l_annee_de_l_horloge():
    """Une extraction d'août décrit la rentrée en cours, pas celle qui n'a pas
    encore eu lieu. La bascule est au 1er septembre."""
    assert education.annee_scolaire("2026-08-06T05:01:16.150000+00:00") == "2025"
    assert education.annee_scolaire("2026-09-01T00:00:00+00:00") == "2026"
    assert education.annee_scolaire("2026-01-15T00:00:00Z") == "2025"
    assert education.annee_scolaire("2025-12-31T23:59:00+00:00") == "2025"


def test_la_date_vient_de_la_fiche_du_portail():
    import json

    fiche = json.dumps(
        {"metas": {"default": {"data_processed": "2026-08-06T05:01:16.150000+00:00"}}}
    ).encode()
    assert education.date_de_la_source(fiche).startswith("2026-08-06")
    # `modified` en secours, si le portail cesse de publier data_processed.
    fiche = json.dumps({"metas": {"default": {"modified": "2026-03-01T00:00:00Z"}}}).encode()
    assert education.date_de_la_source(fiche).startswith("2026-03-01")


def test_un_portail_qui_ne_date_plus_rien_arrete_le_run():
    """Se rabattre sur l'horloge rendrait le défaut invisible : la période
    redeviendrait une valeur qui dépend de l'heure du runner."""
    import json

    import pytest

    with pytest.raises(ValueError, match="ne date plus"):
        education.date_de_la_source(json.dumps({"metas": {"default": {}}}).encode())


def test_un_code_geographique_tombe_arrete_le_run():
    """Le contrôle bloquant : trois totaux tirés d'un seul parcours doivent
    coïncider. Un département vide fait diverger le total départemental du
    total régional, et aucun total pris isolément ne le montrerait."""
    from collections import Counter

    import pytest

    comptes = {
        "commune": {"ecoles": Counter({"33318": 2}), "colleges_lycees": Counter()},
        "departement": {"ecoles": Counter({"33": 1}), "colleges_lycees": Counter()},
        "region": {"ecoles": Counter({"75": 2}), "colleges_lycees": Counter()},
    }
    with pytest.raises(education.TotauxDivergents, match="code géographique est tombé"):
        education.controler(comptes)


def test_les_fiches_tiennent_la_charte_et_disent_le_zero():
    for indicateur, (_, publique) in education.INDICATEURS.items():
        assert len(publique.split()) <= 50, f"{indicateur} : fiche trop longue pour la base"
    assert "Zéro est une information" in education.INDICATEURS["menj_ecoles"][1]
    assert "carte scolaire" in education.INDICATEURS["menj_colleges_lycees"][1]


def test_le_jeu_est_au_registre():
    import csv
    from pathlib import Path

    racine = Path(education.__file__).parents[3] / "infra/seed"
    with (racine / "dataset_registry.csv").open(encoding="utf-8") as fichier:
        jeux = {r["dataset_id"]: r["source_id"] for r in csv.DictReader(fichier)}
    assert jeux.get(education.DATASET) == education.SOURCE
    with (racine / "source_registry.csv").open(encoding="utf-8") as fichier:
        sources = {r["source_id"] for r in csv.DictReader(fichier)}
    assert education.SOURCE in sources


def test_ecrire_donne_une_ligne_a_chaque_territoire_zero_compris(tmp_path):
    """L'invariant central : l'univers vient du référentiel, pas de l'annuaire.
    Un territoire sans école reçoit un 0 écrit, jamais une absence — et les
    collectivités à statut particulier n'en reçoivent aucun, parce qu'elles
    appartiennent à un autre cadre départemental que celui de l'annuaire."""
    from collections import Counter

    from plateforme import entrepot, registry
    from plateforme.normalize.geo import MILLESIME

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    try:
        education.declarer(conn)
        for niveau, code, nom in (
            ("commune", "T1E", "Avec école"),
            ("commune", "T2E", "Sans école"),
            ("departement", "T9", "Département de test"),
            ("region", "T8", "Région de test"),
        ):
            conn.execute(
                "insert into geo.geography_reference (geo_level, geo_code, vintage, name)"
                " values (?, ?, ?, ?)",
                (niveau, code, MILLESIME, nom),
            )
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name, flags)"
            " values ('departement', 'T7A', ?, 'Collectivité à statut particulier',"
            " '{\"statut_particulier\":true}')",
            (MILLESIME,),
        )
        conn.commit()
        run_id = entrepot.start_run(conn, education.DATASET)
        comptes = {
            "commune": {"ecoles": Counter({"T1E": 3}), "colleges_lycees": Counter()},
            "departement": {"ecoles": Counter({"T9": 3}), "colleges_lycees": Counter()},
            "region": {"ecoles": Counter({"T8": 3}), "colleges_lycees": Counter()},
        }
        _, _, hors, reconnus = education.ecrire(conn, run_id, comptes, "2025")
        conn.commit()
        valeurs = {
            (n, c): float(v)
            for n, c, v in conn.execute(
                "select geo_level, geo_code, value from core.observations"
                " where indicator_id = 'menj_ecoles'"
            ).fetchall()
        }
        assert valeurs == {
            ("commune", "T1E"): 3.0,
            ("commune", "T2E"): 0.0,
            ("departement", "T9"): 3.0,
            ("region", "T8"): 3.0,
        }
        assert ("departement", "T7A") not in valeurs
        assert hors == 0
        # Tout ce qui a été lu est retrouvé au référentiel : c'est ce que
        # `controler_couverture` exige, et ce qui manquait le 6 août.
        assert reconnus == {"commune": 3, "departement": 3, "region": 3}
        from plateforme import couverture

        assert couverture.controler({"commune": 3, "departement": 3, "region": 3}, reconnus) == {
            "commune": 1.0, "departement": 1.0, "region": 1.0
        }
        (periode,) = conn.execute(
            "select distinct period from core.observations where indicator_id = 'menj_ecoles'"
        ).fetchone()
        assert periode == "2025"
    finally:
        entrepot.annuler(conn)
        conn.execute(
            "delete from core.observations where indicator_id = any(?)",
            (list(education.INDICATEURS),),
        )
        conn.execute("delete from core.indicators where dataset_id = ?", (education.DATASET,))
        conn.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
        conn.execute(
            "delete from geo.geography_reference where geo_code in"
            " ('T1E','T2E','T9','T8','T7A')"
        )
        conn.execute("delete from meta.ingestion_runs where dataset_id = ?", (education.DATASET,))
        conn.commit()
        conn.close()


def test_des_codes_inconnus_du_referentiel_arretent_le_run():
    """Le défaut du 6 août, en un test. Les codes départementaux du producteur
    sont zéro-padés — « 033 » quand le référentiel dit « 33 ». Chargés tels
    quels, ils sont parfaitement cohérents entre eux : la somme des départements
    égale la somme des régions, le contrôle des totaux passe. Ils ne
    correspondent simplement à aucun territoire connu, et la carte
    départementale est sortie avec 1 511 écoles au lieu de 47 109, la Gironde à
    zéro. Aucun contrôle interne au fichier ne pouvait le voir."""
    from collections import Counter

    import pytest

    comptes = {
        "commune": {"ecoles": Counter({"33318": 100}), "colleges_lycees": Counter()},
        "departement": {"ecoles": Counter({"033": 100}), "colleges_lycees": Counter()},
        "region": {"ecoles": Counter({"75": 100}), "colleges_lycees": Counter()},
    }
    from plateforme import couverture

    # Les codes se ressemblent, les totaux coïncident : le premier contrôle passe.
    education.controler(comptes)
    # Mais rien n'a été retrouvé au référentiel côté département.
    with pytest.raises(couverture.CouvertureInsuffisante, match="format"):
        couverture.controler(
            {"commune": 100, "departement": 100, "region": 100},
            {"commune": 100, "departement": 0, "region": 100},
        )


def test_la_couverture_tolere_les_collectivites_hors_referentiel_departemental():
    """Saint-Pierre-et-Miquelon, Wallis, la Polynésie et la Nouvelle-Calédonie
    ont des écoles et ne sont pas des départements : leurs établissements sont
    lus et non écrits, et c'est normal. Le seuil ne doit pas s'en émouvoir."""
    from plateforme import couverture

    # 1 000 écoles lues au département, 990 rattachées : les dix autres sont en
    # Nouvelle-Calédonie, qui a des écoles et n'est pas un département français.

    parts = couverture.controler(
        {"commune": 1000, "departement": 1000, "region": 1000},
        {"commune": 1000, "departement": 990, "region": 1000},
    )
    assert parts["departement"] == 0.99
