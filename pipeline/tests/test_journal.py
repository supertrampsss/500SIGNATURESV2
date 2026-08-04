"""Un journal des changements est lu par quelqu'un qui a noté un chiffre qui a
bougé. Ces tests vérifient qu'il reste lisible et qu'il ne se réinvente pas à
chaque run."""

import csv
import datetime as dt
from pathlib import Path

import pytest

from plateforme import journal


def test_le_vocabulaire_est_celui_du_schema():
    """`change_type` porte une contrainte `check` : une valeur inventée ici
    ferait échouer l'insertion en production, pas en test."""
    migration = (
        Path(journal.__file__).parents[2] / "infra/entrepot/schema.sql"
    ).read_text(encoding="utf-8")
    for type_ in journal.TYPES_PERMIS:
        assert f"'{type_}'" in migration


def test_chaque_changement_declare_un_type_connu():
    for changement in journal.JOURNAL:
        assert changement.type in journal.TYPES_PERMIS, changement.public[:60]


def test_les_jeux_cites_existent_dans_le_registre():
    """`dataset_id` est une clé étrangère : un jeu inconnu bloque le run."""
    registre = (
        Path(journal.__file__).parents[2] / "infra/seed/dataset_registry.csv"
    )
    with registre.open(encoding="utf-8") as fichier:
        connus = {ligne["dataset_id"] for ligne in csv.DictReader(fichier)}
    for changement in journal.JOURNAL:
        if changement.jeu:
            assert changement.jeu in connus, changement.jeu


def test_les_dates_sont_figees_et_lisibles():
    """`announced_at` ne se recalcule jamais : un run qui le remettrait à
    aujourd'hui ferait paraître d'hier une correction d'il y a six mois."""
    for changement in journal.JOURNAL:
        dt.date.fromisoformat(changement.annonce)
        if changement.effet_au:
            dt.date.fromisoformat(changement.effet_au)


def test_chaque_changement_dit_ce_qu_il_change_pour_un_lecteur():
    """La description publique n'est pas un résumé technique : elle s'adresse à
    quelqu'un qui ne connaît ni la table ni le connecteur."""
    for changement in journal.JOURNAL:
        assert len(changement.public) > 80, changement.public
        for jargon in ("dataset_id", "core.observations", "run_id", "connecteur"):
            assert jargon not in changement.public, jargon


def test_une_synchronisation_remplace_sans_dupliquer():
    ordres: list[tuple[str, tuple | None]] = []

    class FauxCurseur:
        def execute(self, sql, params=None):
            ordres.append((sql, params))

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    class FausseConnexion:
        def cursor(self):
            return FauxCurseur()

        def commit(self):
            ordres.append(("commit", None))

    entrees = [
        journal.Changement(annonce="2026-01-01", type="correction", public="a"),
        journal.Changement(annonce="2026-02-01", type="deprecation", public="b"),
    ]
    assert journal.synchroniser(FausseConnexion(), entrees) == 2
    assert ordres[0][0].startswith("delete from meta.change_log")
    assert ordres[0][1] == (journal.AUTEUR,)
    inserts = [params for sql, params in ordres if "insert into meta.change_log" in sql]
    assert len(inserts) == 2
    # la date annoncée est celle déclarée, pas celle du run
    assert inserts[0][6] == "2026-01-01"


def test_un_type_hors_vocabulaire_est_refuse():
    entrees = [journal.Changement(annonce="2026-01-01", type="rectificatif", public="a")]
    with pytest.raises(ValueError, match="hors vocabulaire"):
        journal.synchroniser(None, entrees)
