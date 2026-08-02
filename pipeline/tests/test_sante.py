"""L'APL est un indicateur modélisé et sensible : publier des « consultations
par habitant » qui n'en seraient plus (changement d'unité du producteur) ou des
valeurs aberrantes ferait dire au site où sont les déserts médicaux avec un
chiffre faux. Le classeur de test reproduit la structure réelle de la DREES."""

import io
import os
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
                        "APL aux médecins généralistes de 65 ans ou moins"])
        feuille.append([None, None, unite, unite])
        for rangee in lignes or [
            ("33318", "Pessac", "3.2", "3.0"),
            ("23001", "Ahun", "1.4", "1.2"),
        ]:
            feuille.append(list(rangee))
    tampon = io.BytesIO()
    livre.save(tampon)
    return tampon.getvalue()


def test_le_classeur_reel_se_lit_par_reperes_pas_par_positions():
    lignes, ecartees = sante.lire(classeur())
    assert ecartees == {}
    assert ("33318", "2023", 3.2) in lignes and ("33318", "2024", 3.2) in lignes
    assert ("23001", "2024", 1.4) in lignes
    # la colonne « 65 ans ou moins » ne fuit pas dans l'indicateur principal
    assert all(valeur != 3.0 for _, _, valeur in lignes)


def test_un_changement_d_unite_du_producteur_bloque_le_chargement():
    """Si la DREES publiait autre chose que des consultations par habitant
    standardisé sous le même en-tête, charger sans bloquer publierait un
    chiffre qui a changé de sens."""
    with pytest.raises(ValueError, match="unité annoncée a changé"):
        sante.lire(classeur(unite="En équivalents temps plein pour 10 000 habitants"))


def test_les_valeurs_illisibles_ou_aberrantes_sont_ecartees_et_comptees():
    lignes, ecartees = sante.lire(
        classeur(lignes=[("33318", "Pessac", "3.2", ""), ("23001", "Ahun", "n/a", ""),
                         ("01001", "X", "99.9", "")])
    )
    assert {code for code, _, _ in lignes} == {"33318"}
    assert ecartees["23001/2023"].startswith("valeur illisible")
    assert ecartees["01001/2024"].startswith("hors plage plausible")


def test_la_fiche_tient_la_charte_et_nomme_le_seuil():
    assert len(sante.FICHE["public"].split()) <= 50
    assert "2,5" in sante.FICHE["public"]
    assert "modélisé" in sante.FICHE["technique"]


def test_le_jeu_est_au_registre():
    import csv

    registre = Path(sante.__file__).parents[3] / "infra/supabase/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        jeux = {r["dataset_id"] for r in csv.DictReader(fichier)}
    assert sante.DATASET in jeux


@pytest.mark.skipif(
    not os.environ.get("PLATEFORME_TEST_DB"), reason="PLATEFORME_TEST_DB non défini"
)
def test_declarer_passe_les_contraintes_de_la_base():
    from plateforme import db

    conn = db.connect(os.environ["PLATEFORME_TEST_DB"])
    try:
        sante.declarer(conn)
        publie = conn.execute(
            "select unit, theme from core.indicators where indicator_id = %s",
            (sante.INDICATEUR,),
        ).fetchone()
        assert publie == ("consultations_par_an", "sante")
    finally:
        conn.rollback()
        conn.execute("delete from core.indicators where dataset_id = %s", (sante.DATASET,))
        conn.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
        conn.commit()
        conn.close()
