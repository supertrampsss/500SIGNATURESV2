"""Unité locale ou unité légale : le même mot « entreprise », deux cartes
différentes. Ces tests attachent le choix fait au texte qui l'annonce, pour
qu'on ne puisse pas changer l'un sans l'autre."""

from plateforme.normalize import entreprises


def test_ce_sont_les_etablissements_qui_sont_comptes():
    """Compter les unités légales rattacherait au siège parisien les magasins
    d'une chaîne présente dans toute la France, et viderait la carte."""
    assert entreprises.MESURE == "UNIT_LOC"
    assert "unités locales" in entreprises.FICHE["technique"]
    assert "là où il travaille" in entreprises.FICHE["public"]
    assert "siège" in entreprises.FICHE["public"]


def test_la_fiche_annonce_un_stock_et_non_des_creations():
    """Un stock au 31 décembre et un flux de créations annuelles se confondent
    facilement et ne racontent pas la même chose."""
    assert "Stock" in entreprises.FICHE["technique"]
    assert "actives au 31 décembre" in entreprises.FICHE["technique"]


def test_seul_le_total_des_activites_est_charge():
    """Les sections d'activité multiplieraient le volume par dix pour une
    lecture que la fiche ne propose pas (contrainte de volume D6bis)."""
    assert entreprises.ACTIVITE == "_T"
    assert "toutes activités" in entreprises.FICHE["technique"]
    assert "toutes sections" in entreprises.FICHE["formule"]


def test_le_jeu_declare_est_celui_du_registre():
    """Le registre est la source d'autorité sur la licence et la cadence : un
    dataset_id inventé ici ne serait rattaché à rien."""
    import csv
    from pathlib import Path

    registre = Path(entreprises.__file__).parents[3] / "infra/supabase/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        jeux = {ligne["dataset_id"]: ligne for ligne in csv.DictReader(fichier)}
    assert entreprises.DATASET in jeux
    assert jeux[entreprises.DATASET]["target_tables"] == "core.observations"
