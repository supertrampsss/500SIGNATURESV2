"""Les vocabulaires contraints par le schéma le sont aussi dans le code.

Une valeur littérale passée à `start_run` n'est vérifiée qu'au moment où la
base la refuse — c'est-à-dire en production, au milieu d'un chargement. Ce test
relit le schéma pour en extraire les valeurs permises et vérifie que le
code n'en invente pas d'autres.
"""

import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
SCHEMA = RACINE / "infra/entrepot/schema.sql"
CODE = RACINE / "pipeline/plateforme"


def valeurs_autorisees(colonne: str) -> set[str]:
    """Extrait `check (colonne in ('a','b'))` du schéma."""
    motif = re.compile(rf"{colonne}\s+text\s+check\s*\(\s*{colonne}\s+in\s*\(([^)]*)\)", re.S)
    for fichier in [SCHEMA]:
        trouve = motif.search(fichier.read_text(encoding="utf-8"))
        if trouve:
            return set(re.findall(r"'([^']+)'", trouve.group(1)))
    raise AssertionError(f"contrainte introuvable pour {colonne}")


def test_les_declencheurs_du_code_existent_dans_le_schema():
    permis = valeurs_autorisees("trigger")
    assert permis, "aucune valeur de déclencheur lue dans le schéma"
    utilises = set()
    for fichier in CODE.rglob("*.py"):
        utilises |= set(
            re.findall(r"start_run\([^)]*?,\s*\"([a-z_]+)\"\s*\)", fichier.read_text(encoding="utf-8"))
        )
    assert utilises, "aucun appel à start_run trouvé — le test ne vérifie plus rien"
    assert utilises <= permis, f"déclencheurs inconnus du schéma : {sorted(utilises - permis)}"


def test_les_jeux_a_geographie_recalculee_existent_dans_le_registre():
    """Un `dataset_id` mal orthographié dans `GEOGRAPHIE_COURANTE` ne lèverait
    aucune erreur : il rendrait simplement l'exception inopérante, et le site
    signalerait des ruptures sur une série qui n'en a pas."""
    import csv

    from plateforme.publish import GEOGRAPHIE_COURANTE

    registre = RACINE / "infra/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        connus = {ligne["dataset_id"] for ligne in csv.DictReader(fichier)}
    assert GEOGRAPHIE_COURANTE <= connus, GEOGRAPHIE_COURANTE - connus
