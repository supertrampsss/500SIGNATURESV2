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

from plateforme import entrepot, publish, registry
from plateforme.normalize.geo import MILLESIME
from plateforme.store import LocalStore

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
    # Un EPCI à cheval sur deux départements : pas de parent, mais une région.
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values ('epci', '200030435', ?, ?,"
        " null, null, '{\"departements\":[\"32\",\"40\"],\"region\":\"75\"}')",
        (MILLESIME, "CC d'Aire-sur-l'Adour"),
    )
    # Et un EPCI d'un seul département : le rattachement ordinaire.
    conn.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code) values ('epci', '243300316', ?,"
        " 'Bordeaux Métropole', 'departement', '33')",
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

    epci = lire("territoires/epci/tous.json")
    assert epci["243300316"]["parent"] == "33"
    assert epci["243300316"]["region"] == "75"
    # À cheval sur deux départements : pas de parent, mais la région tient.
    assert epci["200030435"]["parent"] is None
    assert epci["200030435"]["region"] == "75"

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
    assert budget["exercices"]["2024"]["vote"]["montants"] == {
        "Enseignement scolaire": 63600000000.0
    }

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
