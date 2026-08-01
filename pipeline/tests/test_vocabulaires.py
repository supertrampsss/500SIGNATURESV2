"""Les vocabulaires contraints par le schéma le sont aussi dans le code.

Une valeur littérale passée à `start_run` n'est vérifiée qu'au moment où la
base la refuse — c'est-à-dire en production, au milieu d'un chargement. Ce test
relit les migrations pour en extraire les valeurs permises et vérifie que le
code n'en invente pas d'autres.
"""

import re
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
MIGRATIONS = RACINE / "infra/supabase/migrations"
CODE = RACINE / "pipeline/plateforme"


def valeurs_autorisees(colonne: str) -> set[str]:
    """Extrait `check (colonne in ('a','b'))` des migrations."""
    motif = re.compile(rf"{colonne}\s+text\s+check\s*\(\s*{colonne}\s+in\s*\(([^)]*)\)", re.S)
    for fichier in MIGRATIONS.glob("*.sql"):
        trouve = motif.search(fichier.read_text(encoding="utf-8"))
        if trouve:
            return set(re.findall(r"'([^']+)'", trouve.group(1)))
    raise AssertionError(f"contrainte introuvable pour {colonne}")


def test_les_declencheurs_du_code_existent_dans_le_schema():
    permis = valeurs_autorisees("trigger")
    assert permis, "aucune valeur de déclencheur lue dans les migrations"
    utilises = set()
    for fichier in CODE.rglob("*.py"):
        utilises |= set(
            re.findall(r"start_run\([^)]*?,\s*\"([a-z_]+)\"\s*\)", fichier.read_text(encoding="utf-8"))
        )
    assert utilises, "aucun appel à start_run trouvé — le test ne vérifie plus rien"
    assert utilises <= permis, f"déclencheurs inconnus du schéma : {sorted(utilises - permis)}"
