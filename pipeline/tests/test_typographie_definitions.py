"""Aucun tiret cadratin ni demi-cadratin dans les définitions publiées.

Les cinq champs déclarés ici — `label_fr`, `public_definition`,
`technical_definition`, `formula`, `unit_notes` — sont rendus mot pour mot sur
la page « Sources et méthode » et dans les infobulles « i » de chaque mesure.
La règle produit est simple : zéro « — » (U+2014) et zéro « – » (U+2013) à
l'écran. La publication du 8 août en portait 604 sur 212 indicateurs.

Le contrôle passe par l'entrepôt plutôt que par une lecture des sources : c'est
la seule manière de voir aussi ce qu'un connecteur assemble à la volée (les
fiches de secteurs, construites par f-string) et ce qui vient du catalogue semé
(`infra/seed/ofgl_agregats.csv`, que l'OFGL alimente). Les commentaires et les
docstrings des modules, qui ne s'affichent nulle part, n'entrent pas dans le
champ — et ce test ne les voit pas.

Le signe moins des nombres est U+2212 (« −5 »), les plages de dates et les noms
composés portent des traits d'union : rien de tout cela n'est visé.
"""

import importlib
import inspect
import pathlib

import pytest

from plateforme import entrepot, registry

CADRATINS = {"—": "tiret cadratin", "–": "tiret demi-cadratin"}

CHAMPS_PUBLIES = (
    "label_fr",
    "public_definition",
    "technical_definition",
    "formula",
    "unit_notes",
)

# `geo`, `geometries` et `maires` écrivent dans le référentiel, pas dans le
# catalogue : ils n'ont pas de `declarer`. `ofgl` déclare par niveau de
# collectivité, sous un autre nom.
NIVEAUX_OFGL = ["commune", "departement", "region", "epci"]


def _modules() -> list[str]:
    dossier = pathlib.Path(__file__).resolve().parent.parent / "plateforme" / "normalize"
    return sorted(p.stem for p in dossier.glob("*.py") if p.stem != "__init__")


def _declarer(nom: str, conn) -> bool:
    """-> a déclaré. `macro` construit son plan avant, sans réseau."""
    module = importlib.import_module(f"plateforme.normalize.{nom}")
    if nom == "ofgl":
        module.declarer_indicateurs(conn, NIVEAUX_OFGL)
        return True
    if not hasattr(module, "declarer"):
        return False
    parametres = list(inspect.signature(module.declarer).parameters)[1:]
    if not parametres:
        module.declarer(conn)
    elif parametres == ["plan"] and hasattr(module, "_plan"):
        module.declarer(conn, module._plan())
    else:
        return False
    return True


@pytest.fixture(scope="module")
def catalogue_declare(tmp_path_factory):
    """Le catalogue entier, déclaré une fois dans un entrepôt neuf.

    Un seul entrepôt pour tous les connecteurs : chaque `declarer` est
    idempotent et ramasse ses propres fiches orphelines, et les ouvrir un par un
    coûterait dix fois le temps de ce test.
    """
    conn = entrepot.connect(tmp_path_factory.mktemp("entrepot") / "entrepot.duckdb")
    registry.sync(conn)
    for nom in _modules():
        _declarer(nom, conn)
    lignes = conn.execute(
        """
        select i.indicator_id, i.label_fr, d.public_definition, d.technical_definition,
               d.formula, d.unit_notes
        from core.indicators i
        left join core.indicator_definitions d using (definition_id)
        """
    ).fetchall()
    yield lignes
    conn.close()


def test_le_catalogue_declare_est_bien_peuple(catalogue_declare):
    """Sans cette garde, un catalogue vide rendrait le test suivant vert à vide."""
    assert len(catalogue_declare) > 300, (
        f"{len(catalogue_declare)} indicateurs déclarés : le contrôle typographique"
        " ne porterait plus sur le catalogue réel"
    )


def test_aucun_cadratin_dans_les_definitions_publiees(catalogue_declare):
    fautes = []
    for ligne in catalogue_declare:
        identifiant, valeurs = ligne[0], ligne[1:]
        for champ, valeur in zip(CHAMPS_PUBLIES, valeurs, strict=True):
            for signe, nom in CADRATINS.items():
                if valeur and signe in valeur:
                    extrait = valeur[max(0, valeur.index(signe) - 60):][:130]
                    fautes.append(f"{identifiant}.{champ} : {nom} dans « …{extrait}… »")
    assert not fautes, (
        f"{len(fautes)} champ(s) publié(s) portent un tiret cadratin ou demi-cadratin."
        " Reponctuer la phrase (deux-points, virgules, parenthèses ou point selon ce"
        " qu'elle demande), puis redéclarer le module :\n" + "\n".join(sorted(fautes))
    )
