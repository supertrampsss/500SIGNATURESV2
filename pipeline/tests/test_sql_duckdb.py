"""Toutes les requêtes du pipeline, passées au parseur et au binder de DuckDB.

La migration de PostgreSQL vers DuckDB a laissé derrière elle des requêtes qui
ne pouvaient pas fonctionner et que rien ne lisait :

- deux `).fetchall()` tombés *dans* la chaîne SQL au moment de convertir des
  boucles `for ligne in cur` — invisibles à la lecture, fatals à l'exécution ;
- l'opérateur `?` de PostgreSQL (« cette clé existe-t-elle dans le JSON ? »),
  que DuckDB lit comme le marqueur d'un paramètre de requête préparée ;
- un `coalesce(liste, '{}')`, littéral de tableau PostgreSQL, qui sous DuckDB
  transforme silencieusement une liste de niveaux en chaîne de caractères.

Chacune a coûté un aller-retour d'intégration continue de plusieurs minutes,
alors que le parseur de DuckDB les refuse en une milliseconde, hors réseau et
sans données. Ce test le fait pour toutes les requêtes du dépôt à la fois.

Deux niveaux d'exigence :

- **parser** — toute requête, y compris celles construites par f-string ;
- **binder** — les requêtes littérales qui ne sont pas du DDL sont en plus
  *préparées*, ce qui vérifie que colonnes, tables et fonctions existent.

Le DDL et les tables temporaires échappent au second niveau : `prepare` les
refuse par nature, pas parce qu'elles seraient fautives.
"""

import ast
import pathlib

import pytest

from plateforme import entrepot

RACINE = pathlib.Path(__file__).resolve().parents[1] / "plateforme"

# `prepare` ne s'applique qu'aux requêtes : le DDL et les commandes de
# maintenance se lancent, ils ne se préparent pas.
NON_PREPARABLES = (
    "create", "drop", "alter", "pragma", "force", "checkpoint", "vacuum",
    "analyze", "attach", "detach", "begin", "commit", "rollback", "install",
    "load", "set", "reset", "copy", "export", "import",
)


def _requetes() -> list[tuple[str, int, str, bool]]:
    """-> (fichier, ligne, sql, littérale) pour chaque `execute(...)` du pipeline."""
    trouvees = []
    for chemin in sorted(RACINE.rglob("*.py")):
        arbre = ast.parse(chemin.read_text())
        for noeud in ast.walk(arbre):
            if not isinstance(noeud, ast.Call):
                continue
            fonction = noeud.func
            if not isinstance(fonction, ast.Attribute):
                continue
            if fonction.attr not in {"execute", "executemany", "sql"} or not noeud.args:
                continue
            argument = noeud.args[0]
            if isinstance(argument, ast.Constant) and isinstance(argument.value, str):
                trouvees.append((chemin.name, noeud.lineno, argument.value, True))
            elif isinstance(argument, ast.JoinedStr):
                # Les trous d'une f-string sont bouchés par un identifiant :
                # on vérifie la charpente de la requête, pas ce qu'on y
                # injecte. `x1` passe partout où le trou tient une colonne,
                # une table ou une expression.
                texte = "".join(
                    p.value if isinstance(p, ast.Constant) else "x1" for p in argument.values
                )
                trouvees.append((chemin.name, noeud.lineno, texte, False))
    return trouvees


REQUETES = _requetes()


def test_le_pipeline_contient_bien_des_requetes():
    """Garde-fou du garde-fou : une extraction cassée rendrait ce test vert et
    vide, ce qui est pire que pas de test du tout."""
    assert len(REQUETES) > 100


@pytest.mark.parametrize(
    "fichier, ligne, sql", [(f, n, s) for f, n, s, _ in REQUETES],
    ids=[f"{f}:{n}" for f, n, _, _ in REQUETES],
)
def test_chaque_requete_est_lisible_par_duckdb(fichier, ligne, sql, entrepot_neuf):
    entrepot_neuf.extract_statements(sql)


@pytest.mark.parametrize(
    "fichier, ligne, sql",
    [
        (f, n, s) for f, n, s, litterale in REQUETES
        if litterale and not s.strip().lower().startswith(NON_PREPARABLES)
    ],
    ids=[
        f"{f}:{n}" for f, n, s, litterale in REQUETES
        if litterale and not s.strip().lower().startswith(NON_PREPARABLES)
    ],
)
def test_chaque_requete_se_lie_au_schema(fichier, ligne, sql, entrepot_neuf):
    """Colonnes, tables et fonctions existent vraiment dans le schéma publié."""
    if "nouvelles_observations" in sql or "_criteres" in sql:
        pytest.skip("table temporaire créée par la requête qui précède")
    entrepot_neuf.execute("prepare _verification as " + sql.strip().rstrip(";"))
    entrepot_neuf.execute("deallocate _verification")


@pytest.fixture(scope="module")
def entrepot_neuf(tmp_path_factory):
    """Un entrepôt vide mais complet : le schéma, sans une ligne de données."""
    conn = entrepot.connect(tmp_path_factory.mktemp("sql") / "entrepot.duckdb")
    yield conn
    conn.close()


def test_aucun_fetchall_sur_autre_chose_qu_un_curseur():
    """La conversion de PostgreSQL vers DuckDB a ajouté des `.fetchall()` au
    mauvais endroit.

    Sous psycopg, `for ligne in curseur` parcourt le résultat ; sous DuckDB,
    `execute()` rend la connexion et il faut appeler `.fetchall()`. La reprise
    de ces boucles a collé l'appel sur ce qui les précédait plutôt que sur
    l'`execute` : un tuple de valeurs dans `maires.ecrire`, un `dict(...)` dans
    la lecture des libellés de `geometries`. Ni le parseur SQL ni les tests de
    déclaration ne
    peuvent le voir — c'est du Python, et il ne casse qu'à l'exécution, sur la
    ligne où on ne l'attend pas.
    """
    curseurs = {"fetchall", "fetchone", "fetchmany", "rowcount"}
    suspects = []
    for chemin in sorted(RACINE.rglob("*.py")):
        for noeud in ast.walk(ast.parse(chemin.read_text())):
            cible = None
            if (
                isinstance(noeud, ast.Call)
                and isinstance(noeud.func, ast.Attribute)
                and noeud.func.attr in curseurs
            ):
                cible = noeud.func.value
            elif isinstance(noeud, ast.Attribute) and noeud.attr == "rowcount":
                cible = noeud.value
            if cible is None:
                continue
            # Licite : sur le résultat d'un execute(), ou sur une variable qui
            # tient un curseur.
            licite = isinstance(cible, ast.Name) or (
                isinstance(cible, ast.Call)
                and isinstance(cible.func, ast.Attribute)
                and cible.func.attr in {"execute", "executemany", "sql", "cursor"}
            )
            if not licite:
                suspects.append(f"{chemin.name}:{noeud.lineno} sur un {type(cible).__name__}")
    assert not suspects, suspects
