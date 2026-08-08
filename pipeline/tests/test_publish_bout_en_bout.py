"""La publication entière, contre un vrai entrepôt DuckDB.

`publish.py` a été écrit pour PostgreSQL et n'avait jamais été *exécuté* contre
DuckDB : ses tests portaient sur des fonctions prises une par une, jamais sur
`publier()` d'un bout à l'autre. Deux requêtes contenaient un `).fetchall()`
tombé dans la chaîne SQL lors de la migration, une troisième employait
l'opérateur `?` de PostgreSQL — que DuckDB lit comme un paramètre de requête
préparée. Rien de tout cela n'était visible sans lancer la publication.

Ce test remplit un entrepôt minuscule mais représentatif — les cinq niveaux,
un montant sommable, un taux, un budget d'État, un mouvement de commune — et
publie. Il ne vérifie pas seulement que ça passe : il relit les fichiers
déposés et contrôle ce qu'ils contiennent.
"""

import json

import pytest

from plateforme import entrepot, publish, registry
from plateforme.normalize.geo import MILLESIME
from plateforme.store import ImmutabilityError, LocalStore

# Deux communes du même département, pour que la médiane et le groupe de
# comparaison aient de quoi se calculer sans être un cas dégénéré.
COMMUNES = [("33063", "Bordeaux", 260958), ("33281", "Mérignac", 72099)]


def _remplir(conn) -> None:
    registry.sync(conn)
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code) values ('pays', 'FR', ?, 'France', null, null)",
        (MILLESIME,),
    )
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code) values ('region', '75', ?, 'Nouvelle-Aquitaine',"
        " 'pays', 'FR')",
        (MILLESIME,),
    )
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code) values ('departement', '33', ?, 'Gironde',"
        " 'region', '75')",
        (MILLESIME,),
    )
    for code, nom, population in COMMUNES:
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, population, flags) values ('commune', ?, ?, ?,"
            " 'departement', '33', ?,"
            " '{\"tranche_population\":\"50 000 à 100 000\",\"rural\":false,"
            "\"outre_mer\":false}')",
            (code, MILLESIME, nom, population),
        )

    conn.execute(
        "insert into geo.geography_history (event_type, event_date, from_level,"
        " from_code, from_vintage, to_level, to_code, to_vintage)"
        " values ('fusion', date '2019-01-01', 'commune', '33281', ?, 'commune',"
        " '33063', ?)",
        (MILLESIME - 1, MILLESIME),
    )

    definition = conn.execute(
        "insert into core.indicator_definitions (public_definition, technical_definition,"
        " confidence_level) values ('Dépenses de fonctionnement de la commune.',"
        " 'Compte administratif, section de fonctionnement.', 'observed')"
        " returning definition_id"
    ).fetchone()[0]
    for indicateur, libelle, unite, sommable in [
        ("ofgl_depenses_fonctionnement", "Dépenses de fonctionnement", "EUR", True),
        ("ofgl_population_reference", "Population de référence", "count", True),
        ("dgfip_taux_tfb_global", "Taux de taxe foncière", "percent", False),
    ]:
        conn.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, accounting_frame, geo_levels, time_granularity, published)
            values (?, 'ofgl-communes', ?, 'finances_locales', ?, ?, ?, 'budgetaire',
                    array['commune'], 'annuelle', true)
            """,
            (indicateur, definition, libelle, unite, sommable),
        )

    run_id = entrepot.start_run(conn, "ofgl-communes")
    valeurs = {
        "33063": {"ofgl_depenses_fonctionnement": 5.4e8, "dgfip_taux_tfb_global": 45.2},
        "33281": {"ofgl_depenses_fonctionnement": 1.1e8, "dgfip_taux_tfb_global": 38.7},
    }
    for code, _, population in COMMUNES:
        for indicateur, valeur in valeurs[code].items():
            # Trois exercices insérés dans le désordre : le catalogue doit les
            # rendre triés, sinon le sélecteur d'année du site propose 2021
            # après 2023.
            for rang, periode in enumerate(("2023", "2021", "2022")):
                conn.execute(
                    "insert into core.observations (indicator_id, geo_level, geo_code,"
                    " geo_vintage, period, value, run_id) values (?, 'commune', ?, ?,"
                    " ?, ?, ?)",
                    (indicateur, code, MILLESIME, periode, valeur - rang, run_id),
                )
        for periode in ("2021", "2022", "2023"):
            conn.execute(
                "insert into core.observations (indicator_id, geo_level, geo_code,"
                " geo_vintage, period, value, run_id) values"
                " ('ofgl_population_reference', 'commune', ?, ?, ?, ?, ?)",
                (code, MILLESIME, periode, float(population), run_id),
            )
    entrepot.finish_run(conn, run_id, "success")

    budget = conn.execute(
        "insert into fin.public_budgets (geo_level, geo_code, geo_vintage, budget_type,"
        " entity_kind, fiscal_year, accounting_frame, stage, balance, run_id)"
        " values ('pays', 'FR', ?, 'LFI', 'etat', 2024, 'budgetaire', 'vote',"
        " -146900000000.0, ?) returning budget_id",
        (MILLESIME, run_id),
    ).fetchone()[0]
    conn.execute(
        "insert into fin.public_budget_lines (budget_id, fiscal_year, side, line_kind,"
        " label, cp) values (?, 2024, 'depense', 'credit', 'Enseignement scolaire',"
        " 63600000000.0)",
        (budget,),
    )
    # Une dépense fiscale, portée par l'État sans être une ligne de son budget.
    niches = conn.execute(
        "insert into fin.public_budgets (geo_level, geo_code, geo_vintage, budget_type,"
        " entity_kind, fiscal_year, accounting_frame, stage, dataset_id, run_id)"
        " values ('pays', 'FR', ?, 'PLF', 'etat', 2026, 'budgetaire', 'execute',"
        " 'plf-depenses-fiscales', ?) returning budget_id",
        (MILLESIME, run_id),
    ).fetchone()[0]
    conn.execute(
        "insert into fin.public_budget_lines (budget_id, fiscal_year, side, mission,"
        " chapitre, line_kind, amount, label) values (?, 2026, 'depense',"
        " 'Recherche et enseignement supérieur', '200302', 'depense_fiscale',"
        " 8041000000.0, 'Crédit d''impôt en faveur de la recherche')",
        (niches,),
    )
    conn.commit()


def test_publier_produit_un_jeu_complet(tmp_path):
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        _remplir(conn)
        store = LocalStore(str(tmp_path / "publie"))
        fichiers = publish.publier(conn, store, "2026-01-01T0000")
        assert fichiers > 0
    finally:
        conn.close()

    racine = tmp_path / "publie" / "data" / "2026-01-01T0000"
    lire = lambda nom: json.loads((racine / nom).read_text())  # noqa: E731

    # Le pointeur ne bouge qu'après tout le reste : s'il pointe, tout est là.
    pointeur = json.loads((tmp_path / "publie" / "data" / "derniere.json").read_text())
    assert pointeur == {"version": "2026-01-01T0000"}

    catalogue = {i["id"]: i for i in lire("indicateurs.json")}
    assert set(catalogue) == {
        "ofgl_depenses_fonctionnement", "ofgl_population_reference", "dgfip_taux_tfb_global"
    }
    # `synchroniser_niveaux` relit les niveaux depuis les observations : une
    # liste transformée en chaîne par un `coalesce` mal typé se verrait ici.
    assert catalogue["ofgl_depenses_fonctionnement"]["niveaux"] == ["commune"]
    assert catalogue["ofgl_depenses_fonctionnement"]["periodes"] == ["2021", "2022", "2023"]

    carte = lire("carte/ofgl_depenses_fonctionnement/commune/2023.json")
    assert carte == {"33063": 5.4e8, "33281": 1.1e8}

    communes = lire("territoires/commune/33.json")
    assert communes["33063"]["nom"] == "Bordeaux"
    assert communes["33063"]["region"] == "75"
    assert communes["33063"]["series"]["dgfip_taux_tfb_global"]["2023"] == 45.2
    # Le mouvement de périmètre voyage avec le territoire, pas dans un fichier
    # à part : une série ne se lit pas sans lui.
    assert communes["33063"]["evenements"][0]["type"] == "fusion"

    references = lire("references.json")
    repere = references["dgfip_taux_tfb_global"]["2023"]["commune"]
    assert repere["nature"] == "mediane"
    assert repere["france"]["n"] == 2
    assert repere["france"]["mediane"] == (45.2 + 38.7) / 2
    assert "75" in repere["regions"]

    agregat = references["ofgl_depenses_fonctionnement"]["2023"]["commune"]
    assert agregat["nature"] == "agregat"
    # Rapport agrégé : somme des montants sur somme des populations, pas une
    # moyenne de moyennes.
    assert agregat["france"]["total"] == 6.5e8
    assert agregat["france"]["habitants"] == 260958 + 72099

    budget = lire("budget-etat.json")
    assert budget["exercices"]["2024"]["vote"]["solde"] == -146900000000.0
    # La dépense fiscale insérée plus haut n'entre pas dans le pont du budget :
    # un impôt non perçu n'est pas une ligne de dépense, et l'y laisser
    # tomberait dans la colonne qui se referme sur le solde.
    assert budget["exercices"]["2024"]["vote"]["montants"] == {
        "Enseignement scolaire": 63600000000.0
    }
    assert "2026" not in budget["exercices"]

    niches = lire("depenses-fiscales.json")
    assert niches["exercices"] == ["2026"]
    assert niches["realise"] == "2026"
    assert niches["dispositifs"] == [{
        "numero": "200302",
        "libelle": "Crédit d'impôt en faveur de la recherche",
        "mission": "Recherche et enseignement supérieur",
        "montants": {"2026": 8041000000.0},
    }]

    # Fraîcheur, journal, comparaisons, manifeste et recherche : leur seule
    # présence prouve que leurs requêtes s'exécutent sous DuckDB.
    assert isinstance(lire("fraicheur.json"), list)
    assert isinstance(lire("journal.json"), list)
    assert lire("comparaisons.json")["criteres"] == publish.CRITERES_GROUPE
    assert lire("manifeste.json")["version"] == "2026-01-01T0000"
    assert {t["c"] for t in lire("recherche.json")} >= {"33063", "FR", "75", "33"}


def test_une_publication_amputee_ne_remplace_pas_le_site_en_ligne(tmp_path):
    """Le garde-fou tient sur un entrepôt neuf autant que sur un entrepôt plein."""
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        _remplir(conn)
        store = LocalStore(str(tmp_path / "publie"))
        publish.publier(conn, store, "2026-01-01T0000")
        conn.execute("update core.indicators set published = false")
        conn.commit()
        try:
            publish.publier(conn, store, "2026-01-02T0000")
        except RuntimeError as erreur:
            assert "publication refusée" in str(erreur)
        else:
            raise AssertionError("un catalogue vidé aurait dû être refusé")
        # Le pointeur n'a pas bougé : le site en ligne est intact.
        pointeur = json.loads((tmp_path / "publie" / "data" / "derniere.json").read_text())
        assert pointeur == {"version": "2026-01-01T0000"}
    finally:
        conn.close()


def test_le_secret_statistique_ne_masque_que_les_mailles_ou_il_mord(tmp_path):
    """La sécurité n'avait de repère nulle part, à aucune maille. Le motif était
    bon — l'ensemble communal du SSMSI est censuré, les petits comptes masqués,
    et une médiane calculée dessus mentirait sur son périmètre — mais il ne vaut
    qu'à la commune. Au département, la source publie 101 départements sur 101 ;
    une fiche régionale ne pouvait donc se comparer à rien, faute d'une règle
    posée par jeu là où elle se pose par maille."""
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        _remplir(conn)
        definition = conn.execute(
            "insert into core.indicator_definitions (public_definition, confidence_level)"
            " values ('Cambriolages enregistrés pour 1 000 logements.', 'observed')"
            " returning definition_id"
        ).fetchone()[0]
        conn.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, geo_levels, time_granularity, published)
            values ('ssmsi_cambriolages_taux', 'ssmsi-delinquance', ?, 'securite',
                    'Cambriolages', 'pour_1000_logements', false,
                    array['commune','departement'], 'annuelle', true)
            """,
            (definition,),
        )
        run_id = entrepot.start_run(conn, "ssmsi-delinquance")
        for niveau, code, valeur in (
            ("commune", "33063", 7.1), ("commune", "33281", 5.4), ("departement", "33", 6.2),
        ):
            conn.execute(
                "insert into core.observations (indicator_id, geo_level, geo_code,"
                " geo_vintage, period, value, run_id) values ('ssmsi_cambriolages_taux',"
                " ?, ?, ?, '2023', ?, ?)",
                (niveau, code, MILLESIME, valeur, run_id),
            )
        entrepot.finish_run(conn, run_id, "success")
        conn.commit()

        store = LocalStore(str(tmp_path / "publie"))
        publish.publier(conn, store, "2026-01-01T0000")
        references = json.loads(
            (tmp_path / "publie" / "data" / "2026-01-01T0000" / "references.json").read_text()
        )
        repere = references["ssmsi_cambriolages_taux"]["2023"]
        assert "departement" in repere, "aucun repère départemental : la fiche régionale reste muette"
        assert repere["departement"]["nature"] == "mediane"
        assert "commune" not in repere, "médiane calculée sur un ensemble communal censuré"
    finally:
        conn.close()


def test_les_drapeaux_sortent_en_objet_pas_en_chaine(tmp_path):
    """Le défaut qui rendait muette la question la plus posée du site.

    DuckDB rend une colonne `json` en texte. Publiés tels quels, les drapeaux
    faisaient lire `territoire.drapeaux["tranche_population"]` sur une chaîne :
    `undefined`, donc une clé de groupe « || », donc aucun groupe trouvé, donc
    pas de bloc « parmi N communes semblables ». Rien ne le signalait — un
    groupe introuvable n'est pas une erreur, c'est une absence.
    """
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        _remplir(conn)
        sortie = publish.territoires(conn, "commune")
        bordeaux = sortie["33063"]
        assert isinstance(bordeaux["drapeaux"], dict), type(bordeaux["drapeaux"])
        # Et la clé du groupe doit se construire, pas se réduire à des barres.
        cle = "|".join(
            str(bordeaux["drapeaux"].get(critere, ""))
            for critere in publish.CRITERES_GROUPE
        )
        assert cle.strip("|"), cle
    finally:
        conn.close()


# Paris et son 1er arrondissement : la commune mère et sa sous-entité, avec la
# même strate de comparaison. C'est le piège que ce fixture pose exprès — si un
# agrégat cessait de filtrer sur le niveau, les deux tomberaient dans le même sac.
PARIS = ("75056", "Paris", 2_145_906, 8.0e9)
PARIS_1ER = ("75101", "Paris 1er Arrondissement", 16_266, 3.0e8)
STRATE_PARIS = (
    '{"tranche_population":"plus de 200 000","rural":false,"outre_mer":false}'
)


def _semer_paris(conn) -> None:
    """Ajoute Paris, son département, sa région et son 1er arrondissement.

    L'arrondissement porte une observation du **même** indicateur additif que sa
    commune mère : c'est ce qui rend le double comptage visible s'il survient.
    """
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code) values ('region', '11', ?, 'Île-de-France',"
        " 'pays', 'FR')",
        (MILLESIME,),
    )
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code) values ('departement', '75', ?, 'Paris',"
        " 'region', '11')",
        (MILLESIME,),
    )
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, population, flags) values ('commune', ?, ?, ?,"
        f" 'departement', '75', ?, '{STRATE_PARIS}')",
        (PARIS[0], MILLESIME, PARIS[1], PARIS[2]),
    )
    # Le COG rattache un arrondissement municipal à sa **commune**, pas à un
    # département : c'est ce chaînon supplémentaire que `territoires()` remonte
    # pour lui trouver une région.
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, population, flags) values"
        f" ('arrondissement_municipal', ?, ?, ?, 'commune', ?, ?, '{STRATE_PARIS}')",
        (PARIS_1ER[0], MILLESIME, PARIS_1ER[1], PARIS[0], PARIS_1ER[2]),
    )

    run_id = entrepot.start_run(conn, "ofgl-communes")
    for niveau, (code, _, population, depense) in (
        ("commune", PARIS),
        ("arrondissement_municipal", PARIS_1ER),
    ):
        for indicateur, valeur in (
            ("ofgl_depenses_fonctionnement", depense),
            ("ofgl_population_reference", float(population)),
        ):
            conn.execute(
                "insert into core.observations (indicator_id, geo_level, geo_code,"
                " geo_vintage, period, value, run_id) values (?, ?, ?, ?, '2023', ?, ?)",
                (indicateur, niveau, code, MILLESIME, valeur, run_id),
            )
    entrepot.finish_run(conn, run_id, "success")
    conn.commit()


def test_un_arrondissement_municipal_est_publie_sans_etre_compte_deux_fois(
    tmp_path, monkeypatch
):
    """Les 45 arrondissements de Paris, Lyon et Marseille étaient en base et
    invisibles : `loyers.py` y écrit, `publish.py` ne connaissait pas le niveau.
    La fiche de Paris 1er n'existait pas.

    Les publier ne doit rien ajouter nulle part ailleurs. Paris et ses
    arrondissements coexistent dans le référentiel ; les additionner compterait
    deux fois la plus grande ville de France. Le test le vérifie là où ça
    pourrait arriver : l'agrégat France, l'agrégat régional, et les quartiles du
    groupe de communes semblables.
    """
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        _remplir(conn)
        _semer_paris(conn)
        store = LocalStore(str(tmp_path / "publie"))
        publish.publier(conn, store, "2026-01-01T0000")

        # Les quartiles se calculent hors publication : le seuil de vingt
        # communes ne peut pas être atteint par un fixture, on l'abaisse pour
        # que le groupe de Paris existe et se compte.
        monkeypatch.setattr(publish, "GROUPE_MINIMAL", 1)
        quartiles = publish.comparaisons(conn)["groupes"]
    finally:
        conn.close()

    racine = tmp_path / "publie" / "data" / "2026-01-01T0000"
    lire = lambda nom: json.loads((racine / nom).read_text())  # noqa: E731

    # 1. La fiche sort, avec sa région remontée par-dessus sa commune mère.
    arrondissements = lire("territoires/arrondissement_municipal/tous.json")
    paris_1er = arrondissements[PARIS_1ER[0]]
    assert paris_1er["nom"] == PARIS_1ER[1]
    assert paris_1er["parent"] == PARIS[0]
    assert paris_1er["region"] == "11", "la région d'un arrondissement est celle de sa commune"
    assert paris_1er["series"]["ofgl_depenses_fonctionnement"]["2023"] == PARIS_1ER[3]

    # 2. Elle est trouvable : sans entrée d'index, la fiche n'a pas de porte.
    index = {t["c"]: t for t in lire("recherche.json")}
    assert index[PARIS_1ER[0]]["l"] == "arrondissement_municipal"
    assert index[PARIS_1ER[0]]["n"] == PARIS_1ER[1]

    # 3. Aucune couche de carte : il n'existe pas de tuiles d'arrondissements
    # (`normalize/geometries.py` n'en construit que trois), et un fichier que
    # rien ne peut peindre est un fichier de trop.
    assert not (racine / "carte" / "ofgl_depenses_fonctionnement"
                / "arrondissement_municipal").exists()

    # 4. Aucun agrégat n'a vu passer l'arrondissement.
    references = lire("references.json")["ofgl_depenses_fonctionnement"]["2023"]
    assert "arrondissement_municipal" not in references
    france = references["commune"]["france"]
    assert france["n"] == 3, "trois communes : Bordeaux, Mérignac, Paris"
    assert france["total"] == 5.4e8 + 1.1e8 + PARIS[3]
    assert france["habitants"] == 260958 + 72099 + PARIS[2]
    # L'agrégat régional le plus exposé : la seule commune d'Île-de-France est
    # Paris, et son arrondissement porte la même région.
    ile_de_france = references["commune"]["regions"]["11"]
    assert ile_de_france["n"] == 1
    assert ile_de_france["total"] == PARIS[3]

    # 5. Et les quartiles du groupe de communes semblables non plus : la strate
    # de Paris ne contient que Paris, pas Paris plus son 1er arrondissement.
    groupe_de_paris = [
        bloc
        for cle, bloc in quartiles["ofgl_depenses_fonctionnement"]["2023"].items()
        if "plus de 200 000" in cle
    ]
    assert groupe_de_paris, "la strate de Paris devrait exister"
    assert all(bloc["n"] == 1 for bloc in groupe_de_paris)
    # La médiane est la dépense par habitant de Paris seule ; y ajouter
    # l'arrondissement la déplacerait.
    assert all(
        bloc["mediane"] == round(PARIS[3] / PARIS[2], 2) for bloc in groupe_de_paris
    )


def test_une_version_deja_publiee_n_est_jamais_ecrasee(tmp_path):
    """Les fichiers d'une publication ne sont plus contrôlés un par un : sur une
    version neuve, ce `HEAD` avant chaque `PUT` doublait le coût réseau de deux
    mille écritures sans jamais rien trouver. Le contrôle tient en une clé, en
    tête — mais il tient."""
    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        _remplir(conn)
        store = LocalStore(str(tmp_path / "publie"))
        publish.publier(conn, store, "2026-01-01T0000")
        with pytest.raises(ImmutabilityError, match="existe déjà"):
            publish.publier(conn, store, "2026-01-01T0000")
        # Et une version neuve passe, elle.
        assert publish.publier(conn, store, "2026-01-01T0001") > 0
    finally:
        conn.close()


def _semer_deux_regions(conn, indicateur="ssmsi_cambriolages_nombre", jeu="ssmsi-delinquance"):
    """Deux régions au référentiel, et un indicateur additif qui les couvre.

    Deux suffisent : le contrôle porte sur « toutes les régions attendues », pas
    sur leur nombre.
    """
    from plateforme import entrepot

    # `_remplir` a déjà posé la Nouvelle-Aquitaine : seule l'Île-de-France
    # s'ajoute, et le référentiel en compte alors deux.
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code) values ('region', '11', ?, 'Île-de-France',"
        " 'pays', 'FR')",
        (MILLESIME,),
    )
    definition = conn.execute(
        "insert into core.indicator_definitions (public_definition, technical_definition,"
        " confidence_level) values ('Cambriolages enregistrés.', 'Base SSMSI.',"
        " 'observed') returning definition_id"
    ).fetchone()[0]
    conn.execute(
        """
        insert into core.indicators
            (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
             additive, geo_levels, time_granularity, published)
        values (?, ?, ?, 'securite', 'Cambriolages', 'count', true,
                array['region'], 'annuelle', true)
        """,
        (indicateur, jeu, definition),
    )
    run_id = entrepot.start_run(conn, jeu)
    for code, valeur in (("75", 12_000.0), ("11", 30_000.0)):
        conn.execute(
            "insert into core.observations (indicator_id, geo_level, geo_code,"
            " geo_vintage, period, value, run_id) values (?, 'region', ?, ?, '2025', ?, ?)",
            (indicateur, code, MILLESIME, valeur, run_id),
        )
    entrepot.finish_run(conn, run_id, "success")
    return run_id


def test_la_france_recoit_la_somme_des_regions(tmp_path):
    """« Pourquoi n'y a-t-il pas la sécurité au niveau France ? »

    La fiche nationale n'affichait que ce qu'une source publie déjà au niveau
    France. Tout ce qui se mesure territoire par territoire y manquait, alors
    que la donnée est là, complète, une maille plus bas.
    """
    conn = entrepot.connect(tmp_path / "e.duckdb")
    _remplir(conn)
    _semer_deux_regions(conn)
    conn.commit()
    totaux, methode = publish.agregats_nationaux(conn)
    assert totaux["ssmsi_cambriolages_nombre"]["2025"] == 42_000.0
    assert methode["regions_attendues"] == 2
    assert methode["ecartes"] == []
    assert methode["perimetre"] == "France entière, outre-mer compris"
    conn.close()


def test_une_region_manquante_annule_le_total_national(tmp_path):
    """Une somme à laquelle il manque une région est un total national faux, et
    rien dans le nombre ne le dirait."""
    conn = entrepot.connect(tmp_path / "e.duckdb")
    _remplir(conn)
    _semer_deux_regions(conn)
    conn.execute("delete from core.observations where geo_code = '11' and geo_level = 'region'")
    conn.commit()
    totaux, methode = publish.agregats_nationaux(conn)
    assert "ssmsi_cambriolages_nombre" not in totaux
    assert methode["ecartes"] == [
        {"indicateur": "ssmsi_cambriolages_nombre", "periode": "2025",
         "regions_manquantes": ["11"]}
    ]
    conn.close()


def test_un_taux_ne_se_somme_pas_d_une_region_a_l_autre(tmp_path):
    """La moyenne de dix-huit taux régionaux n'est pas le taux national : elle
    ignore que les régions n'ont pas le même poids."""
    conn = entrepot.connect(tmp_path / "e.duckdb")
    _remplir(conn)
    _semer_deux_regions(conn)
    conn.execute("update core.indicators set additive = false, unit = 'percent'"
                 " where indicator_id = 'ssmsi_cambriolages_nombre'")
    conn.commit()
    totaux, _ = publish.agregats_nationaux(conn)
    assert totaux == {}
    conn.close()


def test_les_comptes_des_collectivites_ne_font_pas_un_total_national(tmp_path):
    """Le refus qui compte, et il est de principe.

    `ofgl_depenses_fonctionnement` au niveau commune est la somme des budgets
    communaux, au niveau région celle des budgets régionaux : deux grandeurs
    différentes, dont le « total national » n'existe qu'en additionnant tous les
    échelons — intercommunalités comprises, que ce site ne publie plus. Un
    nombre présenté comme « la dépense de fonctionnement en France » serait
    amputé sans le dire.
    """
    conn = entrepot.connect(tmp_path / "e.duckdb")
    _remplir(conn)
    _semer_deux_regions(conn, indicateur="ofgl_depenses_regionales", jeu="ofgl-communes")
    conn.commit()
    totaux, _ = publish.agregats_nationaux(conn)
    assert totaux == {}
    assert "ofgl-communes" not in publish.JEUX_QUI_PAVENT_LA_FRANCE
    conn.close()


def test_une_valeur_publiee_par_la_source_prime_sur_notre_somme(tmp_path):
    """Notre calcul ne recouvre jamais une mesure du producteur."""
    conn = entrepot.connect(tmp_path / "e.duckdb")
    _remplir(conn)
    run_id = _semer_deux_regions(conn)
    conn.execute(
        "insert into core.observations (indicator_id, geo_level, geo_code, geo_vintage,"
        " period, value, run_id) values ('ssmsi_cambriolages_nombre', 'pays', 'FR', ?,"
        " '2025', 41000.0, ?)",
        (MILLESIME, run_id),
    )
    conn.commit()
    totaux, methode = publish.agregats_nationaux(conn)
    assert totaux == {}
    assert methode["indicateurs"] == []
    conn.close()


def test_la_hierarchie_de_l_ofgl_est_publiee_avec_le_catalogue():
    """La colonne était là depuis le premier jour et n'était lue nulle part.

    Le site alignait soixante-dix-neuf agrégats à plat, dont des totaux et leurs
    propres composantes, sans que rien ne dise lesquels contenaient lesquels.
    C'est pourtant la seule chose qui manquait pour répondre à « et dans ces
    369 millions de charges, il y a quoi ».
    """
    arbre = publish.hierarchie_ofgl()
    assert arbre["ofgl_frais_personnel"] == "ofgl_depenses_fonctionnement"
    assert arbre["ofgl_impots_locaux"] == "ofgl_impots_et_taxes"
    # Deux niveaux : les impôts locaux sont dans les impôts et taxes, qui sont
    # dans les recettes de fonctionnement.
    assert arbre["ofgl_impots_et_taxes"] == "ofgl_recettes_fonctionnement"
    # Une racine ne se range sous rien : l'épargne brute est un solde, pas une
    # composante d'un total.
    assert "ofgl_epargne_brute" not in arbre
    # Et rien ne se contient soi-même, ce qui ferait boucler l'affichage.
    assert not [cle for cle, parent in arbre.items() if cle == parent]


def test_aucun_agregat_n_est_son_propre_ancetre(tmp_path):
    """Un cycle dans l'arbre ferait tourner l'ouverture des composantes sans fin."""
    arbre = publish.hierarchie_ofgl()
    for depart in arbre:
        vus = {depart}
        courant = arbre.get(depart)
        while courant is not None:
            assert courant not in vus, f"cycle sur {depart}"
            vus.add(courant)
            courant = arbre.get(courant)

def test_les_fiches_gardent_la_serie_entiere_quand_la_carte_se_borne(tmp_path):
    """Dix-neuf mois de série mensuelle : la fiche les porte tous, la carte
    n'en peint que les douze derniers.

    La borne `PERIODES_CARTOGRAPHIEES` protège le nombre de fichiers de carte,
    pas les courbes : appliquée aux séries de fiche, elle a servi 12 mois de
    population carcérale quand l'entrepôt en portait 19 — sans qu'aucun
    affichage ne dise l'amputation.
    """
    conn = entrepot.connect(str(tmp_path / "entrepot.duckdb"))
    _remplir(conn)
    definition = conn.execute(
        "insert into core.indicator_definitions (public_definition,"
        " technical_definition, confidence_level) values ('Personnes détenues.',"
        " 'Statistique mensuelle DGAP.', 'observed') returning definition_id"
    ).fetchone()[0]
    conn.execute(
        """
        insert into core.indicators
            (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
             additive, geo_levels, time_granularity, published)
        values ('justice_personnes_detenues', 'ofgl-communes', ?, 'justice',
                'Personnes détenues', 'count', true, array['commune'],
                'mensuelle', true)
        """,
        (definition,),
    )
    run_id = entrepot.start_run(conn, "ofgl-communes")
    periodes = [f"{annee}-{mois:02d}" for annee in (2025, 2026)
                for mois in range(1, 13)][:19]
    for rang, periode in enumerate(periodes):
        conn.execute(
            "insert into core.observations (indicator_id, geo_level, geo_code,"
            " geo_vintage, period, value, run_id) values"
            " ('justice_personnes_detenues', 'commune', '33063', ?, ?, ?, ?)",
            (MILLESIME, periode, 500.0 + rang, run_id),
        )
    entrepot.finish_run(conn, run_id, "success")
    conn.commit()

    store = LocalStore(str(tmp_path / "publication"))
    version = "2026-01-01T0000"
    publish.publier(conn, store, version)
    racine = tmp_path / "publication" / "data" / version

    fiches = json.loads((racine / "territoires" / "commune" / "33.json").read_text())
    serie = fiches["33063"]["series"]["justice_personnes_detenues"]
    assert len(serie) == 19 and serie["2025-01"] == 500.0

    cartes = sorted((racine / "carte" / "justice_personnes_detenues" / "commune").iterdir())
    assert len(cartes) == publish.PERIODES_CARTOGRAPHIEES
    assert cartes[0].name == "2025-08.json" and cartes[-1].name == "2026-07.json"

    catalogue = json.loads((racine / "indicateurs.json").read_text())
    fiche = next(i for i in catalogue if i["id"] == "justice_personnes_detenues")
    assert fiche["periodes_par_niveau"]["commune"][0] == "2025-08"

