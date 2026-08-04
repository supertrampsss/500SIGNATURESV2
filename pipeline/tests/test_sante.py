"""L'APL est un indicateur modélisé et sensible : publier des « consultations
par habitant » qui n'en seraient plus (changement d'unité du producteur) ou des
valeurs aberrantes ferait dire au site où sont les déserts médicaux avec un
chiffre faux. Le classeur de test reproduit la structure réelle de la DREES."""

import io
from pathlib import Path

import pytest

from plateforme.normalize import sante


def classeur(
    unite: str = "En nombre de consultations/visites accessibles par an par habitant standardisé",
    lignes: list[tuple] | None = None,
) -> bytes:
    import openpyxl

    livre = openpyxl.Workbook()
    livre.remove(livre.active)
    for millesime in ("2023", "2024"):
        feuille = livre.create_sheet(f"APL {millesime}")
        feuille.append(["Indicateur d'accessibilité potentielle localisée (APL)"])
        feuille.append([])
        feuille.append([f"Millésime : {millesime}"])
        feuille.append(["Sources : Activité des médecins généralistes…"])
        feuille.append(["Code commune INSEE", "Commune", "APL aux médecins généralistes",
                        "APL aux médecins généralistes de 65 ans ou moins",
                        "Population standardisée 2022 pour la médecine générale"])
        feuille.append([None, None, unite, unite, "En nombre d'habitants standardisés"])
        for rangee in lignes or [
            ("33318", "Pessac", "3.2", "3.0", "70000"),
            ("23001", "Ahun", "1.4", "1.2", "1500"),
        ]:
            feuille.append(list(rangee))
    tampon = io.BytesIO()
    livre.save(tampon)
    return tampon.getvalue()


def test_le_classeur_reel_se_lit_par_reperes_pas_par_positions():
    lignes, ecartees = sante.lire(classeur())
    assert ecartees == {}
    assert ("33318", "2023", 3.2, 70000.0) in lignes
    assert ("33318", "2024", 3.2, 70000.0) in lignes
    assert ("23001", "2024", 1.4, 1500.0) in lignes
    # la colonne « 65 ans ou moins » ne fuit pas dans l'indicateur principal
    assert all(valeur != 3.0 for _, _, valeur, _ in lignes)


def test_un_changement_d_unite_du_producteur_bloque_le_chargement():
    """Si la DREES publiait autre chose que des consultations par habitant
    standardisé sous le même en-tête, charger sans bloquer publierait un
    chiffre qui a changé de sens."""
    with pytest.raises(ValueError, match="unité annoncée a changé"):
        sante.lire(classeur(unite="En équivalents temps plein pour 10 000 habitants"))


def test_les_valeurs_illisibles_ou_aberrantes_sont_ecartees_et_comptees():
    lignes, ecartees = sante.lire(
        classeur(lignes=[("33318", "Pessac", "3.2", "", "70000"),
                         ("23001", "Ahun", "n/a", "", "1500"),
                         ("01001", "X", "150.0", "", "800"),
                         ("05085", "Ribeyret", "40.033", "", "60")])
    )
    # 40 consultations existent (village alpin, peu d'habitants standardisés) :
    # le plafond vise les artefacts de lecture, pas les vraies valeurs hautes
    assert {code for code, _, _, _ in lignes} == {"33318", "05085"}
    assert ecartees["23001/2023"].startswith("valeur illisible")
    assert ecartees["01001/2024"].startswith("hors plage plausible")


def test_les_arrondissements_s_agregent_a_leur_commune_par_moyenne_ponderee():
    """La DREES ne publie Paris, Lyon et Marseille que par arrondissement, et
    documente elle-même l'agrégation : moyenne pondérée par la population
    standardisée. 2×100k à 2,0 et 4,0 sur 300k -> 3,5."""
    agregees = sante.agreger_arrondissements([
        ("13201", "2024", 2.0, 100000.0),
        ("13202", "2024", 4.0, 300000.0),
        ("33318", "2024", 3.2, 70000.0),
    ])
    assert ("13055", "2024", 3.5) in agregees
    assert ("33318", "2024", 3.2) in agregees
    assert all(code not in ("13201", "13202") for code, _, _ in agregees)


def test_un_arrondissement_sans_population_bloque_l_agregation_de_sa_ville():
    agregees = sante.agreger_arrondissements([
        ("75101", "2024", 2.0, None),
        ("75102", "2024", 4.0, 500000.0),
    ])
    # moyenne impossible à pondérer : pas de valeur inventée pour Paris
    assert agregees == []


def test_la_fiche_tient_la_charte_et_nomme_le_seuil():
    assert len(sante.FICHE["public"].split()) <= 50
    assert "2,5" in sante.FICHE["public"]
    assert "modélisé" in sante.FICHE["technique"]


def test_le_jeu_est_au_registre():
    import csv

    registre = Path(sante.__file__).parents[3] / "infra/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        jeux = {r["dataset_id"] for r in csv.DictReader(fichier)}
    assert sante.DATASET in jeux


def test_declarer_passe_les_contraintes_de_la_base(tmp_path):
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    try:
        sante.declarer(conn)
        publie = conn.execute(
            "select unit, theme from core.indicators where indicator_id = ?",
            (sante.INDICATEUR,),
        ).fetchone()
        assert publie == ("consultations_par_an", "sante")
    finally:
        entrepot.annuler(conn)
        conn.execute("delete from core.indicators where dataset_id = ?", (sante.DATASET,))
        conn.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
        conn.commit()
        conn.close()
