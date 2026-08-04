"""La délinquance enregistrée est la donnée la plus sensible du site : un taux
avec le mauvais dénominateur ou une ligne sous secret publiée par erreur ferait
dire aux chiffres ce qu'ils ne disent pas. Ces tests portent sur les fixtures
réelles du SSMSI (Gironde/Creuse, Pessac/Paris/Bordeaux)."""

from pathlib import Path


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
    gardees, ecartees, couverture = securite.lire(
        lignes("ssmsi_com_sample.csv"), "commune", seulement_derniere_annee=True
    )
    assert ecartees == {}
    pessac = [
        g for g in gardees if g["code"] == "33318" and g["classe"] == "Cambriolages de logement"
    ]
    assert pessac == [
        {"classe": "Cambriolages de logement", "code": "33318", "annee": "2025",
         "nombre": 355, "taux": 10.2266504}
    ]
    # les seize classes passent au communal (D6ter), uniquement la dernière année
    assert all(g["annee"] == "2025" for g in gardees)
    assert {securite.CLASSES[g["classe"]][4] for g in gardees} == {True}


def test_le_secret_de_diffusion_est_compte_jamais_publie():
    """01001 (petite commune) montre les deux faces du secret : ses classes
    fréquentes sont sous `ndiff` et ne produisent rien, mais ses zéros
    *diffusés* sur les classes rares (vols avec armes) sont des données — le
    SSMSI ne censure que là où un compte non nul identifierait quelqu'un."""
    gardees, _, couverture = securite.lire(
        lignes("ssmsi_com_sample.csv"), "commune", seulement_derniere_annee=True
    )
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


def test_la_derniere_annee_est_retenue_meme_en_desordre():
    entete = ('"CODGEO_2026";"annee";"indicateur";"unite_de_compte";"nombre";'
              '"taux_pour_mille";"est_diffuse";"insee_pop";"insee_pop_millesime";'
              '"insee_log";"insee_log_millesime";"complement_info_nombre";"complement_info_taux"')
    ligne = ('"33318";"{a}";"Vols de véhicule";"Véhicule";"100";"{t}";"diff";'
             '"50000";"2023";"25000";"2022";"NA";"NA"')
    melange = [entete, ligne.format(a="2025", t="2,0000000"),
               ligne.format(a="2023", t="2,0000000"), ligne.format(a="2024", t="2,0000000")]
    gardees, _, _ = securite.lire(melange, "commune", seulement_derniere_annee=True)
    assert [g["annee"] for g in gardees] == ["2025"]


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


def test_les_ecartees_des_annees_non_chargees_sont_purgees():
    """Le bruit d'arrondi de 2016 polluait le contrôle publié alors que seule
    la dernière année est chargée au niveau communal."""
    entete = ('"CODGEO_2026";"annee";"indicateur";"unite_de_compte";"nombre";'
              '"taux_pour_mille";"est_diffuse";"insee_pop";"insee_pop_millesime";'
              '"insee_log";"insee_log_millesime";"complement_info_nombre";"complement_info_taux"')
    fausse_2016 = ('"02268";"2016";"Cambriolages de logement";"Infraction";"10";'
                   '"99,0000000";"diff";"1000";"2016";"500";"2016";"NA";"NA"')
    bonne_2025 = ('"02268";"2025";"Cambriolages de logement";"Infraction";"10";'
                  '"20,0000000";"diff";"1000";"2023";"500";"2022";"NA";"NA"')
    gardees, ecartees, _ = securite.lire(
        [entete, fausse_2016, bonne_2025], "commune", seulement_derniere_annee=True
    )
    assert [g["annee"] for g in gardees] == ["2025"]
    assert ecartees == {}, "l'écartée de 2016 ne concerne pas l'année chargée"


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

    registre = Path(securite.__file__).parents[3] / "infra/supabase/seed/dataset_registry.csv"
    with registre.open(encoding="utf-8") as fichier:
        lignes_registre = {r["dataset_id"]: r for r in csv.DictReader(fichier)}
    assert securite.DATASET in lignes_registre
    # le secret de diffusion est déclaré : c'est lui qui explique les absences
    assert lignes_registre[securite.DATASET]["statistical_secrecy"] == "true"


def test_declarer_passe_les_contraintes_de_la_base(tmp_path):
    """32 fiches déclarées contre le schéma réel — la contrainte des 50 mots a
    déjà arrêté un connecteur en production ; celle-ci passe ici d'abord."""
    from plateforme import entrepot

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        securite.declarer(conn)
        publies = {
            ligne[0]
            for ligne in conn.execute(
                "select indicator_id from core.indicators where dataset_id = ?",
                (securite.DATASET,),
            )
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
