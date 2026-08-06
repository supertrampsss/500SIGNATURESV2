"""Le logement social opposable : compter des logements, pas des déclarations.

Le parc social du recensement est déclaré par les habitants ; le RPLS part des
bailleurs et de leurs logements. Les deux chiffres diffèrent pour la même
commune la même année, et c'est le second qui fait foi pour la loi SRU. Les
tests qui suivent tiennent trois choses : les adresses ne sont jamais demandées,
les passoires thermiques se comptent parmi les logements étiquetés et non sur le
parc entier, et un code géographique qui ne parle pas la langue du référentiel
arrête le run.
"""

from collections import Counter

import pytest

from plateforme.normalize import logement_social as ls

ENTETE = "DEPCOM;DEP_CODE;REG_CODE;DPEENERGIE"


def csv_rpls(lignes: list[str]) -> bytes:
    return ("\n".join([ENTETE, *lignes])).encode("utf-8")


def test_l_export_ne_demande_jamais_les_adresses():
    """Le fichier décrit chaque logement par son numéro de voie, son étage et
    ses coordonnées. Ne pas les demander vaut mieux que les recevoir puis les
    jeter : elles ne quittent pas le serveur du producteur."""
    url = ls.url_export()
    for interdit in ("NUMVOIE", "NOMVOIE", "ETAGE", "LIEUDIT", "CODEPOSTAL", "X", "Y",
                     "PLG_IRIS2024_CODE", "QUALITE_XY"):
        assert interdit not in url, interdit
    assert "columns=DEPCOM,DEP_CODE,REG_CODE,DPEENERGIE" in url
    assert f"millesime={ls.MILLESIME_RPLS}" in url


def test_le_comptage_sort_les_trois_mailles_d_un_seul_parcours():
    comptes, lus = ls.compter(csv_rpls([
        "33063;33;75;C",
        "33063;33;75;F",
        "33281;33;75;G",
        "40001;40;75;",
        "97101;971;01;D",
    ]))
    assert lus == 5
    assert comptes["commune"]["parc"] == {"33063": 2, "33281": 1, "40001": 1, "97101": 1}
    assert comptes["departement"]["parc"] == {"33": 3, "40": 1, "971": 1}
    assert comptes["region"]["parc"] == {"75": 4, "01": 1}


def test_un_logement_sans_etiquette_n_est_pas_un_logement_bien_classe():
    """Douze pour cent du parc n'a aucun diagnostic. Les compter au dénominateur
    des passoires ferait passer une absence de diagnostic pour une bonne
    performance ; l'indicateur des étiquetés est publié pour cela."""
    comptes, _ = ls.compter(csv_rpls([
        "33063;33;75;F",
        "33063;33;75;",
        "33063;33;75;",
        "33063;33;75;C",
    ]))
    assert comptes["commune"]["parc"] == {"33063": 4}
    assert comptes["commune"]["etiquetes"] == {"33063": 2}
    assert comptes["commune"]["passoires"] == {"33063": 1}


def test_seules_les_etiquettes_que_la_loi_designe_comptent():
    """« E » n'est pas une passoire au sens du calendrier légal, qui porte sur G
    puis F. L'y ajouter de notre propre chef ferait dire au chiffre autre chose
    que ce que dit la loi."""
    comptes, _ = ls.compter(csv_rpls([
        "33063;33;75;E",
        "33063;33;75;F",
        "33063;33;75;G",
    ]))
    assert comptes["commune"]["passoires"] == {"33063": 2}


def test_un_code_geographique_tombe_arrete_le_run():
    comptes = {
        "commune": {"parc": Counter({"33063": 5}), "etiquetes": Counter(), "passoires": Counter()},
        "departement": {"parc": Counter({"33": 4}), "etiquetes": Counter(), "passoires": Counter()},
        "region": {"parc": Counter({"75": 5}), "etiquetes": Counter(), "passoires": Counter()},
    }
    with pytest.raises(ls.TotauxDivergents, match="code géographique est tombé"):
        ls.controler(comptes)


def test_plus_de_passoires_que_d_etiquetes_arrete_le_run():
    """Si les deux comptages divergent dans ce sens, ils ne portent pas sur le
    même ensemble — et le taux publié serait supérieur à cent pour cent."""
    comptes = {
        niveau: {
            "parc": Counter({code: 10}),
            "etiquetes": Counter({code: 2}),
            "passoires": Counter({code: 5}),
        }
        for niveau, code in (("commune", "33063"), ("departement", "33"), ("region", "75"))
    }
    with pytest.raises(ls.TotauxDivergents, match="même ensemble"):
        ls.controler(comptes)


def test_les_fiches_tiennent_la_charte_et_nomment_l_autre_comptage():
    for indicateur, (_, publique) in ls.INDICATEURS.items():
        assert len(publique.split()) <= 50, f"{indicateur} : fiche trop longue pour la base"
    assert "SRU" in ls.INDICATEURS["rpls_logements_sociaux"][1]
    assert "recensement" in ls.INDICATEURS["rpls_logements_sociaux"][1]
    assert "pas au parc entier" in ls.INDICATEURS["rpls_logements_sociaux_passoires"][1]
    assert "recensement" in ls.TECHNIQUE and "SRU" in ls.TECHNIQUE


def test_le_jeu_est_au_registre():
    import csv
    from pathlib import Path

    racine = Path(ls.__file__).parents[3] / "infra/seed"
    with (racine / "dataset_registry.csv").open(encoding="utf-8") as fichier:
        jeux = {r["dataset_id"]: r for r in csv.DictReader(fichier)}
    jeu = jeux.get(ls.DATASET)
    assert jeu and jeu["source_id"] == ls.SOURCE
    # Aucune donnée personnelle : ce sont des logements, jamais des occupants.
    assert jeu["personal_data"] == "false"
    with (racine / "source_registry.csv").open(encoding="utf-8") as fichier:
        sources = {r["source_id"] for r in csv.DictReader(fichier)}
    assert ls.SOURCE in sources


def test_ecrire_donne_une_ligne_a_chaque_territoire_zero_compris(tmp_path):
    """Zéro logement social est une information — c'est même le cœur du débat
    SRU. L'univers vient du référentiel, jamais du répertoire."""
    from plateforme import entrepot, registry
    from plateforme.normalize.geo import MILLESIME

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    try:
        ls.declarer(conn)
        for niveau, code, nom in (
            ("commune", "L1", "Avec logements sociaux"),
            ("commune", "L2", "Sans logement social"),
            ("departement", "L9", "Département de test"),
            ("region", "L8", "Région de test"),
        ):
            conn.execute(
                "insert into geo.geography_reference (geo_level, geo_code, vintage, name)"
                " values (?, ?, ?, ?)",
                (niveau, code, MILLESIME, nom),
            )
        conn.commit()
        run_id = entrepot.start_run(conn, ls.DATASET)
        comptes = {
            "commune": {
                "parc": Counter({"L1": 40}),
                "etiquetes": Counter({"L1": 30}),
                "passoires": Counter({"L1": 3}),
            },
            "departement": {
                "parc": Counter({"L9": 40}),
                "etiquetes": Counter({"L9": 30}),
                "passoires": Counter({"L9": 3}),
            },
            "region": {
                "parc": Counter({"L8": 40}),
                "etiquetes": Counter({"L8": 30}),
                "passoires": Counter({"L8": 3}),
            },
        }
        _, _, hors, reconnus = ls.ecrire(conn, run_id, comptes)
        conn.commit()
        valeurs = {
            (i, n, c): float(v)
            for i, n, c, v in conn.execute(
                "select indicator_id, geo_level, geo_code, value from core.observations"
                " where indicator_id like 'rpls_%' order by 1, 2, 3"
            ).fetchall()
        }
        assert valeurs[("rpls_logements_sociaux", "commune", "L1")] == 40.0
        assert valeurs[("rpls_logements_sociaux", "commune", "L2")] == 0.0
        assert valeurs[("rpls_logements_sociaux_passoires", "commune", "L1")] == 3.0
        assert valeurs[("rpls_logements_sociaux", "region", "L8")] == 40.0
        assert hors == 0
        assert reconnus == {"commune": 40, "departement": 40, "region": 40}
    finally:
        entrepot.annuler(conn)
        conn.execute(
            "delete from core.observations where indicator_id = any(?)", (list(ls.INDICATEURS),)
        )
        conn.execute("delete from core.indicators where dataset_id = ?", (ls.DATASET,))
        conn.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
        conn.execute(
            "delete from geo.geography_reference where geo_code in ('L1','L2','L9','L8')"
        )
        conn.execute("delete from meta.ingestion_runs where dataset_id = ?", (ls.DATASET,))
        conn.commit()
        conn.close()


def test_paris_lyon_et_marseille_comptent_pour_leur_commune():
    """Quatrième source, quatrième fois le même piège — et la seule des quatre
    qui soit passée en production. Le répertoire code par arrondissement ; sans
    rattachement, Paris sortait à zéro logement social quand il en compte
    250 640. Les totaux départementaux, eux, étaient justes : aucun contrôle
    interne au fichier ne pouvait le voir."""
    comptes, _ = ls.compter(csv_rpls([
        "75109;75;11;C",
        "75120;75;11;F",
        "13201;13;93;D",
        "69385;69;84;",
    ]))
    assert comptes["commune"]["parc"] == {"75056": 2, "13055": 1, "69123": 1}
    assert comptes["commune"]["passoires"] == {"75056": 1}


def test_les_codes_departementaux_sont_ramenes_au_format_du_cog():
    comptes, _ = ls.compter(csv_rpls(["33063;033;75;C", "20004;02A;94;D"]))
    assert comptes["departement"]["parc"] == {"33": 1, "2A": 1}


def test_une_couverture_trop_faible_arrete_le_run():
    """Le contrôle qui aurait rattrapé Paris : 5 031 372 logements écrits à la
    commune sur 5 416 826 lus, soit 92,9 % — sous le seuil."""
    from plateforme import couverture

    with pytest.raises(couverture.CouvertureInsuffisante, match="arrondissements"):
        couverture.controler(
            {"commune": 5_416_826, "departement": 5_416_826, "region": 5_416_826},
            {"commune": 5_031_372, "departement": 5_416_826, "region": 5_416_826},
        )
