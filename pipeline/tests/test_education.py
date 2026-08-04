"""L'école du quotidien : le zéro d'une commune sans école est une donnée, un
« à fermer » n'est pas un « ouvert », et un service administratif n'est pas une
école. Les valeurs de champ viennent des facettes réelles du portail."""



from plateforme.normalize import education

ENTETE = "identifiant_de_l_etablissement;code_commune;type_etablissement;etat"


def csv_annuaire(lignes: list[str]) -> bytes:
    return ("\n".join([ENTETE, *lignes])).encode("utf-8")


def test_le_comptage_filtre_par_type_et_par_etat():
    comptes, lus = education.compter(csv_annuaire([
        "0331111A;33318;Ecole;OUVERT",
        "0331112B;33318;Ecole;OUVERT",
        "0331113C;33318;Collège;OUVERT",
        "0331114D;33318;Lycée;OUVERT",
        "0331115E;33318;Ecole;A FERMER",          # encore ouvert sur le papier, plus pour longtemps
        "0331116F;33318;Service Administratif;OUVERT",  # pas une école
        "0331117G;33318;EREA;OUVERT",             # hors champ, dit dans le module
        "0331118H;2A004;Ecole;OUVERT",
    ]))
    assert lus == 8
    assert comptes["ecoles"] == {"33318": 2, "2A004": 1}
    assert comptes["colleges_lycees"] == {"33318": 2}


def test_les_arrondissements_comptent_pour_leur_commune():
    """Paris affichait « 0 école » : l'annuaire code par arrondissement, et le
    zéro écrit — honnête dans son intention — était faux. Un établissement du
    9e arrondissement est un établissement de Paris."""
    comptes, _ = education.compter(csv_annuaire([
        "0751111A;75109;Ecole;OUVERT",
        "0751112B;75120;Ecole;OUVERT",
        "0131113C;13201;Collège;OUVERT",
        "0691114D;69385;Lycée;OUVERT",
    ]))
    assert comptes["ecoles"] == {"75056": 2}
    assert comptes["colleges_lycees"] == {"13055": 1, "69123": 1}


def test_un_code_commune_illisible_ne_compte_pas():
    comptes, _ = education.compter(csv_annuaire(["X;331;Ecole;OUVERT", "Y;;Ecole;OUVERT"]))
    assert comptes["ecoles"] == {}


def test_les_fiches_tiennent_la_charte_et_disent_le_zero():
    for indicateur, (_, publique) in education.INDICATEURS.items():
        assert len(publique.split()) <= 50, f"{indicateur} : fiche trop longue pour la base"
    assert "Zéro est une information" in education.INDICATEURS["menj_ecoles"][1]
    assert "carte scolaire" in education.INDICATEURS["menj_colleges_lycees"][1]


def test_le_jeu_est_au_registre():
    import csv
    from pathlib import Path

    racine = Path(education.__file__).parents[3] / "infra/supabase/seed"
    with (racine / "dataset_registry.csv").open(encoding="utf-8") as fichier:
        jeux = {r["dataset_id"]: r["source_id"] for r in csv.DictReader(fichier)}
    assert jeux.get(education.DATASET) == education.SOURCE
    with (racine / "source_registry.csv").open(encoding="utf-8") as fichier:
        sources = {r["source_id"] for r in csv.DictReader(fichier)}
    assert education.SOURCE in sources


def test_ecrire_donne_une_ligne_a_chaque_commune_zero_compris(tmp_path):
    """L'invariant central : l'univers vient du référentiel, pas de l'annuaire.
    Une commune sans école reçoit un 0 écrit, jamais une absence."""
    from collections import Counter

    from plateforme import entrepot
    from plateforme.normalize.geo import MILLESIME

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        education.declarer(conn)
        for code, nom in (("T1E", "Avec école"), ("T2E", "Sans école")):
            conn.execute(
                "insert into geo.geography_reference (geo_level, geo_code, vintage, name)"
                " values ('commune', ?, ?, ?)",
                (code, MILLESIME, nom),
            )
        conn.commit()
        run_id = entrepot.start_run(conn, education.DATASET)
        comptes = {"ecoles": Counter({"T1E": 3}), "colleges_lycees": Counter()}
        ecrites, _, hors = education.ecrire(conn, run_id, comptes)
        conn.commit()
        valeurs = dict(
            conn.execute(
                "select geo_code, value from core.observations"
                " where indicator_id = 'menj_ecoles' and geo_code in ('T1E','T2E')"
            ).fetchall()
        )
        assert {c: float(v) for c, v in valeurs.items()} == {"T1E": 3.0, "T2E": 0.0}
        assert hors == 0
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
            "delete from geo.geography_reference where geo_code in ('T1E','T2E')"
        )
        conn.execute("delete from meta.ingestion_runs where dataset_id = ?", (education.DATASET,))
        conn.commit()
        conn.close()
