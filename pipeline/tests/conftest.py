"""Outils partagés par les tests.

`Resultat` reproduit le contrat de DuckDB : `execute()` rend un objet à
interroger, pas une liste. Les simulations de connexion doivent le suivre, sans
quoi elles valideraient du code qui échoue en production — c'est exactement ce
qui est arrivé pendant la migration, où trois faux connecteurs rendaient
directement une liste et laissaient passer des boucles qui ne matérialisaient
jamais leur résultat.
"""


class Resultat:
    def __init__(self, lignes):
        self.lignes = list(lignes)

    def fetchall(self):
        return self.lignes

    def fetchone(self):
        return self.lignes[0] if self.lignes else None


import pytest  # noqa: E402


@pytest.fixture
def entrepot_seme(tmp_path):
    """Un entrepôt neuf avec les registres appliqués, comme en production.

    Les tests d'intégration citent des jeux réels — `menj-annuaire-education`,
    `eurostat-prc-hicp-manr` — et tracent un run pour eux. Sous Postgres, le
    registre était semé par le job de CI avant que les tests ne tournent ; sur un
    fichier neuf, il faut le semer ici, sans quoi la clé étrangère du run refuse
    un jeu que le registre ne connaît pas. Semer plutôt que relâcher la
    contrainte : c'est elle qui garantit qu'aucune observation ne vient d'un jeu
    non déclaré.
    """
    from plateforme import entrepot, registry

    connexion = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(connexion)
    yield connexion
    connexion.close()
