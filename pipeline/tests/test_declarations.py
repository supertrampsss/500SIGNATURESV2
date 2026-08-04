"""Chaque connecteur déclare ses fiches contre un vrai entrepôt DuckDB.

La déclaration est le premier geste de tout chargement : elle écrit la fiche de
l'indicateur, puis l'indicateur lui-même, avec un `on conflict` qui doit tenir
au second passage. C'est aussi le premier endroit où un run meurt — deux des
échecs du 4 août s'y sont produits, l'un sur une contrainte de longueur, l'autre
sur une sous-requête interdite dans un `do update set`.

Ces tests ne touchent pas au réseau : ils ouvrent un entrepôt vide, appellent
`declarer()` deux fois, et vérifient qu'il y a des indicateurs publiés, tous
avec une fiche. Trente secondes ici valent une demi-heure d'intégration
continue là-bas.
"""

import importlib

import pytest

from plateforme import entrepot, registry

# Les modules dont la déclaration ne dépend d'aucune donnée déjà chargée. `geo`,
# `geometries` et `maires` n'en ont pas : ils écrivent dans le référentiel, pas
# dans le catalogue.
MODULES = [
    "chomage", "cofog", "conjoncture", "dotations", "education", "entreprises",
    "etat", "europe", "fiscalite", "macro", "population", "revenus", "sante",
    "secu", "securite",
]


@pytest.fixture
def entrepot_neuf(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    yield conn
    conn.close()


def _declarer(nom, conn) -> None:
    """`macro` construit son plan avant de déclarer ; les autres se suffisent."""
    module = importlib.import_module(f"plateforme.normalize.{nom}")
    if nom == "macro":
        module.declarer(conn, module._plan())
    else:
        module.declarer(conn)


@pytest.mark.parametrize("nom", MODULES)
def test_le_connecteur_declare_ses_fiches(nom, entrepot_neuf):
    _declarer(nom, entrepot_neuf)
    declares = entrepot_neuf.execute(
        "select count(*) from core.indicators where dataset_id in"
        " (select dataset_id from meta.dataset_registry)"
    ).fetchone()[0]
    assert declares > 0, f"{nom} n'a déclaré aucun indicateur"
    orphelins = entrepot_neuf.execute(
        "select count(*) from core.indicators where definition_id is null"
    ).fetchone()[0]
    assert orphelins == 0, f"{nom} a déclaré un indicateur sans fiche"


@pytest.mark.parametrize("nom", MODULES)
def test_declarer_deux_fois_ne_casse_rien(nom, entrepot_neuf):
    """Le second passage emprunte le chemin `on conflict`, celui qui a fait
    tomber le rechargement de 8 h 53. Un chargement ordinaire le prend chaque
    semaine."""
    _declarer(nom, entrepot_neuf)
    avant = entrepot_neuf.execute("select count(*) from core.indicators").fetchone()[0]
    _declarer(nom, entrepot_neuf)
    apres = entrepot_neuf.execute("select count(*) from core.indicators").fetchone()[0]
    assert apres == avant, f"{nom} a dupliqué ses indicateurs au second passage"
    # Une fiche par indicateur : les orphelines sont ramassées, pas empilées.
    fiches = entrepot_neuf.execute(
        "select count(*) from core.indicator_definitions"
    ).fetchone()[0]
    assert fiches <= apres, f"{nom} a laissé {fiches - apres} fiches orphelines"
