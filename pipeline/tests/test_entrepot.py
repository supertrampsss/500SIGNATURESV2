"""L'entrepôt DuckDB : schéma, lineage, chargement en masse, intégrité.

Ces tests tournent sans base distante, en CI comme en local. C'est le premier
effet de la migration : les huit fichiers de tests qui exigeaient un Postgres
joignable — et qui étaient donc sautés partout sauf dans un job dédié — peuvent
désormais s'exécuter partout, gratuitement, en moins d'une seconde.
"""

import json

import pytest

from plateforme import entrepot


class StoreMemoire:
    """Un bucket en mémoire : `put`/`get`, ce dont l'entrepôt a besoin."""

    def __init__(self):
        self.objets: dict[str, bytes] = {}

    def put(self, cle: str, contenu: bytes, overwrite: bool = False) -> None:
        self.objets[cle] = contenu

    def get(self, cle: str) -> bytes | None:
        return self.objets.get(cle)


@pytest.fixture
def conn(tmp_path):
    connexion = entrepot.connect(tmp_path / "entrepot.duckdb")
    connexion.execute(
        """
        insert into meta.source_registry (source_id, name, producer, access_category, license)
        values ('ofgl', 'OFGL', 'OFGL', 'A', 'Licence Ouverte 2.0')
        """
    )
    connexion.execute(
        """
        insert into meta.dataset_registry (dataset_id, source_id, title, priority)
        values ('ofgl-communes', 'ofgl', 'Comptes des communes', 'P0')
        """
    )
    yield connexion
    connexion.close()


def test_le_schema_s_applique_deux_fois_sans_erreur(tmp_path):
    # Le schéma est rejoué à chaque ouverture : c'est ce qui fait de schema.sql
    # la seule description de la structure, sans registre de migrations à tenir.
    chemin = tmp_path / "e.duckdb"
    entrepot.connect(chemin).close()
    connexion = entrepot.connect(chemin)
    tables = connexion.execute(
        """select count(*) from information_schema.tables
           where table_schema in ('meta','geo','core','fin')"""
    ).fetchone()[0]
    assert tables == 16
    connexion.close()


def test_un_run_se_trace_du_debut_a_la_fin(conn):
    run = entrepot.start_run(conn, "ofgl-communes", trigger="manual")
    assert conn.execute(
        "select status from meta.ingestion_runs where run_id = ?", [run]
    ).fetchone() == ("running",)
    entrepot.finish_run(conn, run, "success", rows_read=10, rows_written=8)
    statut, lus, ecrits, fin = conn.execute(
        "select status, rows_read, rows_written, finished_at from meta.ingestion_runs where run_id = ?",
        [run],
    ).fetchone()
    assert (statut, lus, ecrits) == ("success", 10, 8)
    assert fin is not None


def test_un_echec_se_trace_meme_apres_une_ecriture_avortee(conn):
    run = entrepot.start_run(conn, "ofgl-communes")
    entrepot.finish_run(conn, run, "failed", error="connexion refusée")
    (details,) = conn.execute(
        "select error_details from meta.ingestion_runs where run_id = ?", [run]
    ).fetchone()
    assert json.loads(details)["message"] == "connexion refusée"


def test_un_contenu_deja_archive_ne_l_est_pas_deux_fois(conn):
    # La détection de changement du projet tient à cette contrainte : même
    # contenu, même sha, conflit, donc pas de retraitement — et surtout pas de
    # second fichier écrit dans le bucket pour rien.
    store = StoreMemoire()
    run = entrepot.start_run(conn, "ofgl-communes")
    contenu = b"exer;montant\n2024;42\n"
    premier = entrepot.record_asset(
        conn, store, run, "ofgl-communes", "ofgl", "comptes.csv", contenu, "https://x"
    )
    assert premier.unchanged is False
    assert len(store.objets) == 1
    second = entrepot.record_asset(
        conn, store, run, "ofgl-communes", "ofgl", "comptes.csv", contenu, "https://x"
    )
    assert second.unchanged is True
    assert second.key is None
    assert len(store.objets) == 1, "le fichier a été réécrit alors que rien n'a changé"


def test_un_contenu_different_est_archive(conn):
    store = StoreMemoire()
    run = entrepot.start_run(conn, "ofgl-communes")
    for contenu in (b"a", b"b"):
        assert (
            entrepot.record_asset(
                conn, store, run, "ofgl-communes", "ofgl", "c.csv", contenu, "https://x"
            ).unchanged
            is False
        )
    assert len(store.objets) == 2


def _territoire_et_indicateur(conn, run):
    conn.execute(
        """insert into geo.geography_reference (geo_level, geo_code, vintage, name)
           values ('commune', '69123', 2025, 'Lyon')"""
    )
    definition = conn.execute(
        """insert into core.indicator_definitions (public_definition, confidence_level)
           values ('Ce que la collectivité dépense chaque année pour ses services.', 'observed')
           returning definition_id"""
    ).fetchone()[0]
    conn.execute(
        """insert into core.indicators
             (indicator_id, dataset_id, definition_id, theme, label_fr, unit, additive, published)
           values ('ofgl_depenses', 'ofgl-communes', ?, 'finances_locales',
                   'Dépenses de fonctionnement', 'EUR', true, true)""",
        [definition],
    )


def test_le_chargement_en_masse_ecrit_ce_qu_on_lui_donne(conn):
    run = entrepot.start_run(conn, "ofgl-communes")
    _territoire_et_indicateur(conn, run)
    lignes = [
        ("ofgl_depenses", "commune", "69123", 2025, str(annee), "total", 1000.0 + annee, run)
        for annee in range(2018, 2026)
    ]
    ecrites = entrepot.copier(
        conn,
        "core.observations",
        ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "variant", "value", "run_id"],
        lignes,
        lot=3,  # plusieurs lots, pour couvrir le découpage
    )
    assert ecrites == 8
    assert conn.execute("select count(*) from core.observations").fetchone()[0] == 8


def test_une_publication_sans_fiche_est_refusee(conn):
    # La règle de docs/06 vit dans le schéma, pas dans le code appelant : un
    # indicateur publié sans définition ne peut pas exister.
    entrepot.start_run(conn, "ofgl-communes")
    with pytest.raises(Exception, match="[Cc]onstraint|CHECK"):
        conn.execute(
            """insert into core.indicators
                 (indicator_id, dataset_id, theme, label_fr, unit, published)
               values ('x', 'ofgl-communes', 't', 'X', 'EUR', true)"""
        )


def test_une_definition_de_plus_de_cinquante_mots_est_refusee(conn):
    with pytest.raises(Exception, match="[Cc]onstraint|CHECK"):
        conn.execute(
            """insert into core.indicator_definitions (public_definition, confidence_level)
               values (?, 'observed')""",
            [" ".join(["mot"] * 51)],
        )


def test_une_valeur_absente_doit_dire_pourquoi(conn):
    # Le secret statistique est une ligne, pas une absence (docs/02 §F).
    run = entrepot.start_run(conn, "ofgl-communes")
    _territoire_et_indicateur(conn, run)
    conn.execute(
        """insert into core.observations
             (indicator_id, geo_level, geo_code, geo_vintage, period, value, value_status, run_id)
           values ('ofgl_depenses', 'commune', '69123', 2025, '2024', null, 'confidential', ?)""",
        [run],
    )
    with pytest.raises(Exception, match="[Cc]onstraint|CHECK"):
        conn.execute(
            """insert into core.observations
                 (indicator_id, geo_level, geo_code, geo_vintage, period, value, value_status, run_id)
               values ('ofgl_depenses', 'commune', '69123', 2025, '2023', null, 'normal', ?)""",
            [run],
        )


def test_l_integrite_signale_une_observation_sans_run(conn):
    # Ce que la clé étrangère garantissait sous Postgres, et que DuckDB ne peut
    # pas contraindre entre schémas : la vérification le rattrape.
    run = entrepot.start_run(conn, "ofgl-communes")
    _territoire_et_indicateur(conn, run)
    assert entrepot.verifier_integrite(conn) == []
    conn.execute(
        """insert into core.observations
             (indicator_id, geo_level, geo_code, geo_vintage, period, value, run_id)
           values ('ofgl_depenses', 'commune', '69123', 2025, '2024', 1.0,
                   '00000000-0000-0000-0000-000000000000')"""
    )
    orphelins = entrepot.verifier_integrite(conn)
    assert ("core.observations", "run_id", 1) in orphelins


def test_la_mediane_se_calcule_comme_sous_postgres(conn):
    # `percentile_cont ... within group` porte les repères de references.json :
    # la moitié des communes en dessous de tant. Si cette construction changeait
    # de sens, tous les repères du site changeraient sans prévenir.
    run = entrepot.start_run(conn, "ofgl-communes")
    _territoire_et_indicateur(conn, run)
    conn.execute("create temp table v (x double)")
    conn.executemany("insert into v values (?)", [[1.0], [2.0], [3.0], [4.0], [100.0]])
    (mediane,) = conn.execute(
        "select percentile_cont(0.5) within group (order by x)::double from v"
    ).fetchone()
    assert mediane == 3.0


def test_la_table_de_passage_suit_une_chaine_de_fusions(conn):
    # docs/00 principe 6 : toute comparaison inter-millésimes passe par là. La
    # fonction SQL de Postgres est devenue une macro DuckDB ; la récursion, elle,
    # doit donner exactement le même résultat.
    conn.executemany(
        """insert into geo.geography_history
             (event_type, event_date, from_level, from_code, from_vintage,
              to_level, to_code, to_vintage, population_share)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            ["fusion", "2015-01-01", "commune", "99060", 2014, "commune", "99001", 2015, None],
            ["fusion", "2016-01-01", "commune", "99001", 2015, "commune", "99002", 2016, None],
        ],
    )
    arrivee = conn.execute(
        "select geo_code, population_share from geo.passage('commune', '99060', 2014, 2016)"
    ).fetchall()
    assert arrivee == [("99002", 1.0)]
    # Une commune inconnue de l'historique se retrouve elle-même : elle n'a pas
    # bougé, ce n'est pas une absence de donnée.
    assert conn.execute(
        "select geo_code from geo.passage('commune', '99999', 2014, 2016)"
    ).fetchall() == [("99999",)]


def test_l_entrepot_fait_l_aller_retour_avec_le_bucket(tmp_path):
    store = StoreMemoire()
    chemin = tmp_path / "e.duckdb"
    connexion = entrepot.connect(chemin)
    connexion.execute(
        """insert into meta.source_registry (source_id, name, producer, access_category, license)
           values ('x', 'X', 'X', 'A', 'LO 2.0')"""
    )
    connexion.close()  # DuckDB écrit son fichier à la fermeture
    octets = entrepot.televerser(store, chemin)
    assert octets > 0

    chemin.unlink()
    assert entrepot.telecharger(store, chemin) is True
    rouvert = entrepot.connect(chemin)
    assert rouvert.execute("select count(*) from meta.source_registry").fetchone() == (1,)
    rouvert.close()


def test_un_bucket_vide_ne_fait_pas_echouer_le_premier_run(tmp_path):
    # Le tout premier chargement n'a pas d'entrepôt à rapatrier.
    assert entrepot.telecharger(StoreMemoire(), tmp_path / "absent.duckdb") is False


def test_la_taille_de_l_entrepot_se_lit_en_octets(conn):
    # `pragma database_size` rend « 12.3 MiB », pas un nombre : la conversion
    # remplace `pg_database_size`, dont le journal se sert pour dire de combien
    # un chargement a fait grossir l'entrepôt.
    assert entrepot.taille(conn) >= 0
    assert entrepot._octets("12.5 MiB") == 13107200
    assert entrepot._octets("0 bytes") == 0
    assert entrepot._octets(None) == 0
    assert entrepot._octets("unité inconnue") == 0


class StoreStrict(StoreMemoire):
    """Un magasin qui se comporte comme les vrais : `get` lève quand la clé
    n'existe pas, et `put` refuse d'écraser sans qu'on le demande."""

    def get(self, cle: str) -> bytes:
        if cle not in self.objets:
            raise FileNotFoundError(cle)
        return self.objets[cle]

    def put(self, cle: str, contenu: bytes, overwrite: bool = False) -> None:
        if cle in self.objets and not overwrite:
            raise RuntimeError(f"snapshot déjà présent : {cle}")
        self.objets[cle] = contenu


def test_un_bucket_neuf_ne_fait_pas_echouer_le_premier_run(tmp_path):
    # Les deux magasins signalent l'absence par une exception, chacune la
    # sienne. Le tout premier chargement n'a pas d'entrepôt à rapatrier : c'est
    # un cas normal, pas une panne.
    assert entrepot.telecharger(StoreStrict(), tmp_path / "absent.duckdb") is False


def test_l_entrepot_s_ecrase_a_chaque_run(tmp_path):
    # L'immutabilité protège les snapshots bruts, matière première de la
    # reproductibilité. L'entrepôt est l'état courant : il se réécrit, et c'est
    # le versionnement du bucket qui garde les états antérieurs.
    store = StoreStrict()
    chemin = tmp_path / "e.duckdb"
    entrepot.connect(chemin).close()
    entrepot.televerser(store, chemin)
    entrepot.televerser(store, chemin)  # ne doit pas lever
    assert len(store.objets) == 1
