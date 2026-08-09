"""La délinquance enregistrée est la donnée la plus sensible du site : un taux
avec le mauvais dénominateur ou une ligne sous secret publiée par erreur ferait
dire aux chiffres ce qu'ils ne disent pas. Ces tests portent sur les fixtures
réelles du SSMSI (Gironde/Creuse, Pessac/Paris/Bordeaux)."""

from pathlib import Path

import pytest

from plateforme.normalize import securite

FIXTURES = Path(__file__).parent / "fixtures"


def lignes(nom: str) -> list[str]:
    return (FIXTURES / nom).read_text(encoding="utf-8-sig").splitlines()


def test_la_base_departementale_reelle_se_referme_sans_ecart():
    gardees, ecartees, _ = securite.lire(lignes("ssmsi_dep_sample.csv"), "departement")
    assert ecartees == {}
    # 2 départements × 2 années × 16 classes retenues (les découpages AFD de
    # l'usage de stupéfiants recouvrent l'agrégat : les charger doublerait)
    assert len(gardees) == 64
    classes = {g["classe"] for g in gardees}
    assert "Usage de stupéfiants" in classes
    assert "Usage de stupéfiants (AFD)" not in classes


def test_pessac_porte_les_chiffres_publies_par_le_ssmsi():
    gardees, ecartees, couverture = securite.lire(lignes("ssmsi_com_sample.csv"), "commune")
    assert ecartees == {}
    pessac = [
        g for g in gardees if g["code"] == "33318" and g["classe"] == "Cambriolages de logement"
    ]
    assert pessac == [
        {"classe": "Cambriolages de logement", "code": "33318", "annee": "2025",
         "nombre": 355, "taux": 10.2266504}
    ]
    assert {securite.CLASSES[g["classe"]][4] for g in gardees} == {True}


def test_le_secret_de_diffusion_est_compte_jamais_publie():
    """01001 (petite commune) montre les deux faces du secret : ses classes
    fréquentes sont sous `ndiff` et ne produisent rien, mais ses zéros
    *diffusés* sur les classes rares (vols avec armes) sont des données — le
    SSMSI ne censure que là où un compte non nul identifierait quelqu'un."""
    gardees, _, couverture = securite.lire(lignes("ssmsi_com_sample.csv"), "commune")
    ndiff = sum(c["ndiff"] for c in couverture.values())
    assert ndiff > 0, "la fixture doit contenir des lignes sous secret (petites communes)"
    par_classe = {(g["code"], g["classe"]): g for g in gardees}
    # la ligne ndiff (cambriolages à 01001) ne produit aucune observation…
    assert ("01001", "Cambriolages de logement") not in par_classe
    # …même quand la source y joint des taux « complément d'information »
    assert ("01001", "Violences sexuelles") not in par_classe
    # et le zéro diffusé, lui, est publié : l'absence de vol avec arme se dit
    assert par_classe[("01001", "Vols avec armes")]["nombre"] == 0


def test_le_mauvais_denominateur_est_detecte_ligne_a_ligne():
    """Le taux des cambriolages se rapporte aux logements — constaté sur les
    données. Une ligne dont le taux correspondrait à la population (le
    dénominateur « évident ») doit être écartée : c'est ce contrôle qui
    détecterait un changement de convention chez le producteur."""
    entete = ('"CODGEO_2026";"annee";"indicateur";"unite_de_compte";"nombre";'
              '"taux_pour_mille";"est_diffuse";"insee_pop";"insee_pop_millesime";'
              '"insee_log";"insee_log_millesime";"complement_info_nombre";"complement_info_taux"')
    # 355 / 67339 hab × 1000 = 5,27 — le taux « par habitant » d'un chiffre
    # que la source rapporte aux 34713 logements (10,23)
    fausse = ('"33318";"2025";"Cambriolages de logement";"Infraction";"355";'
              '"5,2718337";"diff";"67339";"2023";"34713";"2022";"NA";"NA"')
    gardees, ecartees, _ = securite.lire([entete, fausse], "commune")
    assert gardees == []
    assert list(ecartees) == ["33318/Cambriolages de logement/2025"]
    assert "logements" in str(ecartees["33318/Cambriolages de logement/2025"])


ENTETE_COM = ('"CODGEO_2026";"annee";"indicateur";"unite_de_compte";"nombre";'
              '"taux_pour_mille";"est_diffuse";"insee_pop";"insee_pop_millesime";'
              '"insee_log";"insee_log_millesime";"complement_info_nombre";"complement_info_taux"')
LIGNE_COM = ('"33318";"{a}";"Vols de véhicule";"Véhicule";"100";"2,0000000";"diff";'
             '"50000";"2023";"25000";"2022";"NA";"NA"')


def test_l_historique_communal_entier_est_charge():
    """La régression du 4 août : la maille communale ne portait plus que la
    dernière année diffusée, et une fiche qui ne porte qu'une année ne peut
    afficher aucune évolution. Les dix millésimes reviennent."""
    fichier = [ENTETE_COM] + [LIGNE_COM.format(a=a) for a in ("2023", "2024", "2025")]
    gardees, _, _ = securite.lire(fichier, "commune")
    assert [g["annee"] for g in gardees] == ["2023", "2024", "2025"]


def test_la_lecture_rend_un_lot_par_millesime():
    """C'est ce découpage qui borne la mémoire : 5,2 millions de lignes
    communales tenues d'un bloc coûtaient 1,8 Go de résident."""
    fichier = [ENTETE_COM] + [LIGNE_COM.format(a=a) for a in ("2023", "2023", "2024")]
    lots = [(annee, len(gardees)) for annee, gardees, _, _ in
            securite.lire_par_annee(fichier, "commune")]
    assert lots == [("2023", 2), ("2024", 1)]


def test_un_fichier_non_groupe_par_annee_rouvre_un_millesime():
    """Le contrat sur lequel repose l'écriture en flux : les lots suivent
    l'ordre du fichier, ils ne le trient pas. La base départementale, elle,
    est groupée par département — d'où la lecture d'un bloc pour ces mailles,
    et la garde du run qui refuse une année rouverte au niveau communal."""
    fichier = [ENTETE_COM] + [LIGNE_COM.format(a=a) for a in ("2025", "2023", "2025")]
    assert [annee for annee, _, _, _ in securite.lire_par_annee(fichier, "commune")] == [
        "2025", "2023", "2025"
    ]
    # `lire` réunit tout : l'ordre du fichier ne lui enlève aucune ligne.
    gardees, _, _ = securite.lire(fichier, "commune")
    assert sorted(g["annee"] for g in gardees) == ["2023", "2025", "2025"]


def test_les_arrondissements_ne_comptent_pas_deux_fois_leur_ville():
    """Le scénario du premier chargement réel : la base liste Marseille (13055)
    ET ses arrondissements (132xx). Les sommer ensemble dépassait le total des
    Bouches-du-Rhône, et le contrôle écartait Marseille de la carte."""
    communes = [
        {"classe": "Cambriolages de logement", "code": "13055", "annee": "2025",
         "nombre": 4346, "taux": 1},
        {"classe": "Cambriolages de logement", "code": "13201", "annee": "2025",
         "nombre": 366, "taux": 1},
        {"classe": "Cambriolages de logement", "code": "13001", "annee": "2025",
         "nombre": 1000, "taux": 1},
    ]
    departements = [
        {"classe": "Cambriolages de logement", "code": "13", "annee": "2025",
         "nombre": 8586, "taux": 1},
    ]
    gardees, depassements = securite.controler_somme_communale(communes, departements)
    assert depassements == {}
    assert {g["code"] for g in gardees} == {"13055", "13201", "13001"}


def test_une_ecartee_est_rendue_avec_le_millesime_qui_la_porte():
    """Tous les millésimes étant chargés, une ligne qui ne se referme pas est
    signalée sur son année à elle, et n'emporte pas les autres."""
    fausse_2016 = ('"02268";"2016";"Cambriolages de logement";"Infraction";"10";'
                   '"99,0000000";"diff";"1000";"2016";"500";"2016";"NA";"NA"')
    bonne_2025 = ('"02268";"2025";"Cambriolages de logement";"Infraction";"10";'
                  '"20,0000000";"diff";"1000";"2023";"500";"2022";"NA";"NA"')
    gardees, ecartees, _ = securite.lire([ENTETE_COM, fausse_2016, bonne_2025], "commune")
    assert [g["annee"] for g in gardees] == ["2025"]
    assert list(ecartees) == ["02268/Cambriolages de logement/2016"]


def test_la_somme_des_communes_ne_depasse_pas_le_departement():
    communes = [
        {"classe": "Vols de véhicule", "code": "33318", "annee": "2025", "nombre": 60, "taux": 1},
        {"classe": "Vols de véhicule", "code": "33063", "annee": "2025", "nombre": 50, "taux": 1},
        {"classe": "Homicides", "code": "97101", "annee": "2025", "nombre": 1, "taux": 0.1},
    ]
    departements = [
        {"classe": "Vols de véhicule", "code": "33", "annee": "2025", "nombre": 100, "taux": 1},
        {"classe": "Homicides", "code": "971", "annee": "2025", "nombre": 5, "taux": 0.1},
    ]
    gardees, depassements = securite.controler_somme_communale(communes, departements)
    # 60 + 50 > 100 : le couple Gironde/vols est écarté entier ; la Guadeloupe
    # (code sur trois chiffres) reste — la borne tient aussi outre-mer
    assert [g["code"] for g in gardees] == ["97101"]
    assert list(depassements) == ["33/Vols de véhicule/2025"]


def test_les_fiches_tiennent_la_charte_et_disentent_les_pieges():
    for classe, (_, _, publique, _, _) in securite.CLASSES.items():
        assert len(publique.split()) <= 50, f"{classe} : fiche trop longue pour la base"
    assert "sous-déclaration" in securite.CLASSES["Violences sexuelles"][2]
    assert "mis en cause n'est pas un condamné" in securite.CLASSES["Usage de stupéfiants"][2]
    assert "1 000 logements" in securite.CLASSES["Cambriolages de logement"][2]


def test_trente_deux_indicateurs_sans_doublon():
    ids = securite.tous_les_indicateurs()
    assert len(ids) == len(set(ids)) == 32


def test_le_jeu_est_au_registre():
    import csv

    registre = Path(securite.__file__).parents[3] / "infra/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        lignes_registre = {r["dataset_id"]: r for r in csv.DictReader(fichier)}
    assert securite.DATASET in lignes_registre
    # le secret de diffusion est déclaré : c'est lui qui explique les absences
    assert lignes_registre[securite.DATASET]["statistical_secrecy"] == "true"


def test_declarer_passe_les_contraintes_de_la_base(tmp_path):
    """32 fiches déclarées contre le schéma réel — la contrainte des 50 mots a
    déjà arrêté un connecteur en production ; celle-ci passe ici d'abord."""
    from plateforme import entrepot, registry

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    registry.sync(conn)
    try:
        securite.declarer(conn)
        publies = {
            ligne[0]
            for ligne in conn.execute(
                "select indicator_id from core.indicators where dataset_id = ?",
                (securite.DATASET,),
            ).fetchall()
        }
        assert publies == set(securite.tous_les_indicateurs())
    finally:
        entrepot.annuler(conn)
        conn.execute("delete from core.indicators where dataset_id = ?", (securite.DATASET,))
        conn.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
        conn.commit()
        conn.close()


def test_l_ecriture_en_flux_garde_tous_les_millesimes(entrepot_seme):
    """Le chemin qui a régressé, contre un vrai entrepôt : `remplacer` purge
    puis réécrit tout le jeu, et il est appelé une seule fois pour les trois
    mailles et les dix millésimes. Un second appel effacerait le premier."""
    from plateforme import entrepot

    securite.declarer(entrepot_seme)
    entrepot_seme.execute(
        "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
        " parent_level, parent_code, flags) values"
        " ('commune', '33318', ?, 'Pessac', 'departement', '33', '{}'),"
        " ('departement', '33', ?, 'Gironde', null, null, '{}')",
        (securite.MILLESIME, securite.MILLESIME),
    )
    run_id = entrepot.start_run(entrepot_seme, securite.DATASET, "manual")
    annees = [str(a) for a in range(2016, 2026)]
    lots = [
        ("commune", [{"classe": "Vols de véhicule", "code": "33318", "annee": annee,
                      "nombre": 100, "taux": 2.0}])
        for annee in annees
    ]
    # Un territoire hors référentiel doit être compté, pas écrit ni fatal.
    lots.append(("commune", [{"classe": "Vols de véhicule", "code": "99999", "annee": "2025",
                              "nombre": 7, "taux": 1.0}]))
    ecrites, faits, hors_referentiel, _ = securite.ecrire(entrepot_seme, run_id, iter(lots))
    entrepot_seme.commit()

    assert ecrites == 2 * len(annees), "un taux et un nombre par millésime"
    assert hors_referentiel == 1
    assert faits == {"commune": 100 * len(annees)}
    publiees = [
        periode for (periode,) in entrepot_seme.execute(
            "select period from core.observations where indicator_id ="
            " 'ssmsi_vols_vehicules_taux' and geo_code = '33318' order by period"
        ).fetchall()
    ]
    assert publiees == annees


def test_l_unite_de_compte_est_celle_que_publie_le_producteur():
    """Ce que compte le SSMSI n'est pas la même chose d'une classe à l'autre, et
    ce n'est pas à nous de le deviner : la colonne `unite_de_compte` est dans ses
    trois bases. La fiche doit dire exactement ce qu'elle dit."""
    import csv
    from collections import defaultdict

    chemin = FIXTURES / "ssmsi_dep_sample.csv"
    with chemin.open(encoding="utf-8") as fichier:
        publiees = defaultdict(set)
        for rang in csv.DictReader(fichier, delimiter=";"):
            publiees[rang["indicateur"]].add(rang["unite_de_compte"])
    couvertes = {c: u for c, u in publiees.items() if c in securite.CLASSES}
    assert couvertes, "la fixture ne couvre aucune classe chargée"
    for classe, unites in couvertes.items():
        assert unites == {securite.UNITES_DE_COMPTE[classe]}, classe
    # Quatre unités bien distinctes, et pas une seule « unité de compte de la
    # source » : c'est la différence entre pouvoir additionner et ne pas pouvoir.
    assert set(securite.UNITES_DE_COMPTE.values()) == {
        "Infraction", "Victime", "Victime entendue", "Mis en cause", "Véhicule"
    }
    assert set(securite.PLURIELS) == set(securite.UNITES_DE_COMPTE.values())
    # Ajouter une classe sans dire ce qu'elle compte doit se voir ici, pas au
    # milieu d'un chargement.
    assert set(securite.UNITES_DE_COMPTE) == set(securite.CLASSES)


def test_un_changement_d_unite_chez_le_producteur_arrete_le_chargement():
    """Passer de « infraction » à « victime » change la grandeur mesurée, donc
    toute comparaison avec les années précédentes. Ça ne doit pas se charger en
    silence."""
    entete = ('"Code_departement";"Code_region";"annee";"indicateur";"unite_de_compte";'
              '"nombre";"taux_pour_mille";"insee_pop";"insee_pop_millesime";'
              '"insee_log";"insee_log_millesime"')
    ligne = ('"33";"75";"2024";"Cambriolages de logement";"Victime";"100";'
             '"1,0000000";"100000";"2023";"100000";"2022"')
    with pytest.raises(securite.UniteDeCompteChangee) as erreur:
        securite.lire([entete, ligne], "departement")
    assert "Cambriolages de logement" in str(erreur.value)
    assert "Victime" in str(erreur.value)


def test_le_libelle_elide_devant_une_voyelle():
    """« Cambriolages de logement — nombre de infractions » s'affichait tel quel
    sur la fiche. Le libellé se construit depuis l'unité de compte du SSMSI, et
    « infractions » est la seule qui commence par une voyelle — aujourd'hui."""
    assert securite.de("infractions") == "d'infractions"
    assert securite.de("victimes") == "de victimes"
    assert securite.de("véhicules") == "de véhicules"
    assert securite.de("personnes mises en cause") == "de personnes mises en cause"
    # Toutes les unités du jeu passent par là : aucune ne doit produire un
    # libellé fautif.
    for unite in securite.UNITES_DE_COMPTE.values():
        rendu = securite.de(securite.PLURIELS[unite])
        assert rendu.startswith("de ") or rendu.startswith("d'"), rendu
