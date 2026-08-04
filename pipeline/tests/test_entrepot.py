"""L'entrepôt DuckDB : schéma, lineage, chargement en masse, intégrité.

Ces tests tournent sans base distante, en CI comme en local. C'est le premier
effet de la migration : les huit fichiers de tests qui exigeaient un Postgres
joignable — et qui étaient donc sautés partout sauf dans un job dédié — peuvent
désormais s'exécuter partout, gratuitement, en moins d'une seconde.
"""

import json

import pytest

import duckdb

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
    # 16 tables du modèle, plus la table d'empreinte du schéma.
    assert tables == 17
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


def test_une_table_referencee_se_met_a_jour_par_upsert(conn):
    """DuckDB exécute `insert ... on conflict` comme un delete suivi d'un insert,
    et le delete se heurte à la clé étrangère qui pointe vers la ligne. Le
    registre des sources, celui des jeux et le catalogue d'indicateurs sont
    pourtant réécrits à chaque run et référencés par tout le reste : sans le
    retrait de ces clés entrantes, la deuxième ingestion échouait — la première
    passait, puisque rien ne référençait encore rien."""
    from plateforme import registry

    run = entrepot.start_run(conn, "ofgl-communes")  # référence dataset_registry
    entrepot.record_asset(
        conn, StoreMemoire(), run, "ofgl-communes", "ofgl", "c.csv", b"x", "https://x"
    )
    registry.sync(conn)  # doit passer alors que le jeu est déjà référencé
    assert conn.execute("select count(*) from meta.dataset_registry").fetchone()[0] > 0


def test_un_indicateur_deja_observe_se_redeclare(conn):
    # Même piège sur le catalogue : `declarer_indicateurs` réécrit la fiche à
    # chaque run, et `core.observations` référence l'indicateur.
    run = entrepot.start_run(conn, "ofgl-communes")
    _territoire_et_indicateur(conn, run)
    conn.execute(
        """insert into core.observations
             (indicator_id, geo_level, geo_code, geo_vintage, period, value, run_id)
           values ('ofgl_depenses', 'commune', '69123', 2025, '2024', 1.0, ?)""",
        [run],
    )
    conn.execute(
        """insert into core.indicators
             (indicator_id, dataset_id, theme, label_fr, unit, published)
           values ('ofgl_depenses', 'ofgl-communes', 'finances_locales', 'Autre', 'EUR', false)
           on conflict (indicator_id) do update set label_fr = excluded.label_fr"""
    )
    assert conn.execute(
        "select label_fr from core.indicators where indicator_id = 'ofgl_depenses'"
    ).fetchone() == ("Autre",)
    assert entrepot.verifier_integrite(conn) == []


def test_un_schema_qui_a_change_arrete_l_ouverture(tmp_path, monkeypatch):
    """`create table if not exists` ne touche pas une table déjà là : une
    contrainte retirée du fichier reste en place dans un entrepôt existant, et
    le code tourne contre une structure qui n'est plus celle qu'il décrit.
    L'échec se lisait alors comme un bug du code alors que le schéma était bon."""
    chemin = tmp_path / "e.duckdb"
    entrepot.connect(chemin).close()

    autre = tmp_path / "autre-schema.sql"
    autre.write_text(
        entrepot.SCHEMA.read_text(encoding="utf-8") + "\n-- une virgule de plus\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(entrepot, "SCHEMA", autre)
    with pytest.raises(entrepot.SchemaDivergent, match="autre schéma"):
        entrepot.connect(chemin)


def test_copier_rend_exactement_ce_qu_on_lui_donne(tmp_path):
    """L'écriture en masse passe par un CSV : elle doit être transparente.

    Le nul et la chaîne vide sont deux choses différentes — `entity_siren` vaut
    la chaîne vide par défaut et sa contrainte l'exige non nulle. Les guillemets,
    les virgules et les retours à la ligne se rencontrent dans les noms de
    communes et d'élus. Les listes portent les drapeaux de qualité.
    """
    import datetime

    conn = duckdb.connect(str(tmp_path / "e.duckdb"))
    conn.execute(
        "create table t (texte text, vide text, nombre double, entier smallint,"
        " oui boolean, jour date, moment timestamptz, doc json, drapeaux text[])"
    )
    cas = [
        ("normal", "", 1.5, 3, True, datetime.date(2019, 1, 1),
         datetime.datetime(2026, 8, 4, 12, 0, tzinfo=datetime.UTC),
         '{"a": 1}', ["rupture"]),
        (None, None, None, None, None, None, None, None, None),
        ('Sainte-"Marie", sur mer', "x", -0.5, 0, False, datetime.date(2000, 2, 29),
         None, "{}", []),
        ("retour\nà la ligne", "\\N", 1e15, -1, None, None, None, "{}",
         ["avec, virgule", "accentué é"]),
    ]
    ecrites = entrepot.copier(
        conn, "t",
        ["texte", "vide", "nombre", "entier", "oui", "jour", "moment", "doc", "drapeaux"],
        cas,
    )
    assert ecrites == len(cas)
    relu = conn.execute("select * from t").fetchall()
    assert len(relu) == len(cas)
    for attendu, obtenu in zip(cas, relu, strict=True):
        for a, o in zip(attendu, obtenu, strict=True):
            if isinstance(a, str) and a.startswith("{"):
                a, o = json.loads(a), json.loads(o)
            elif isinstance(a, list):
                o = list(o)
            assert a == o, f"{a!r} est revenu {o!r}"
    conn.close()


def test_copier_decoupe_en_lots_sans_rien_perdre(tmp_path):
    """Le découpage borne le fichier temporaire ; il ne doit rien changer au
    résultat, ni perdre le reste après le dernier lot plein."""
    conn = duckdb.connect(str(tmp_path / "e.duckdb"))
    conn.execute("create table t (n integer)")
    ecrites = entrepot.copier(conn, "t", ["n"], ((i,) for i in range(2503)), lot=100)
    assert ecrites == 2503
    (compte,) = conn.execute("select count(*) from t").fetchone()
    (somme,) = conn.execute("select sum(n) from t").fetchone()
    assert compte == 2503
    assert somme == sum(range(2503))
    conn.close()


def test_copier_ne_laisse_pas_de_fichier_derriere_lui(tmp_path, monkeypatch):
    """Un rechargement complet écrit vingt millions de lignes : un fichier
    temporaire oublié par lot remplirait le disque du runner."""
    import tempfile as _t

    bac = tmp_path / "temporaires"
    bac.mkdir()
    monkeypatch.setattr(_t, "tempdir", str(bac))
    conn = duckdb.connect(str(tmp_path / "e.duckdb"))
    conn.execute("create table t (n integer)")
    entrepot.copier(conn, "t", ["n"], ((i,) for i in range(500)), lot=100)
    assert list(bac.iterdir()) == []
    conn.close()


def test_copier_refuse_un_guillemet_dans_une_liste_plutot_que_de_le_perdre(tmp_path):
    """Deux niveaux de quotage se superposent — celui du littéral de liste et
    celui du CSV — et un guillemet à l'intérieur d'un élément ressort effacé.
    Une valeur altérée en silence est le pire des résultats : on s'arrête."""
    conn = duckdb.connect(str(tmp_path / "e.duckdb"))
    conn.execute("create table t (drapeaux text[])")
    with pytest.raises(ValueError, match="guillemet dans un élément de liste"):
        entrepot.copier(conn, "t", ["drapeaux"], [(['avec "guillemets"'],)])
    conn.close()


def test_copier_ecrit_dans_la_vraie_table_des_observations(tmp_path):
    """Les premiers tests de `copier` employaient une table jouet aux types
    simples, et laissaient passer le défaut qui compte : DuckDB *devine* les
    types du CSV depuis ses premières lignes et refuse le chargement quand sa
    devinette diffère de la table. Une période « 2024 » quotée prise pour un
    entier, une liste vide prise pour du texte, un identifiant de run pris pour
    du texte plutôt qu'un UUID — trois désaccords sur `core.observations`, la
    table la plus écrite du pipeline. Il faut donc l'écrire, elle."""
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name)"
            " values ('commune', '33063', 2026, 'Bordeaux')"
        )
        run_id = entrepot.start_run(conn, "ofgl-communes")
        conn.commit()
        lignes = [
            ("insee_deces_domicilies", "commune", "33063", 2026, str(2000 + a),
             float(a), ["inclut_une_commune_rattachee"] if a % 3 == 0 else [], run_id)
            for a in range(1000)
        ]
        ecrites = entrepot.copier(
            conn, "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "quality_flags", "run_id"],
            lignes,
        )
        assert ecrites == 1000
        (compte,) = conn.execute("select count(*) from core.observations").fetchone()
        assert compte == 1000
        # La période reste du texte : « 2000 », pas 2000.
        (periode,) = conn.execute(
            "select period from core.observations order by period limit 1"
        ).fetchone()
        assert periode == "2000"
        # Les drapeaux restent une liste, et seuls ceux qui en portaient en ont.
        (avec,) = conn.execute(
            "select count(*) from core.observations where len(quality_flags) > 0"
        ).fetchone()
        assert avec == len([a for a in range(1000) if a % 3 == 0])
        # Le run_id reste un UUID, pas une chaîne.
        (relu,) = conn.execute("select run_id from core.observations limit 1").fetchone()
        assert str(relu) == str(run_id)
    finally:
        conn.close()
