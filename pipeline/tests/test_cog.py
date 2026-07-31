from plateforme.connectors import cog

# Extraits réels du COG 2025 (v_commune / v_mvt_commune).
COMMUNES = [
    {"TYPECOM": "COM", "COM": "33318", "REG": "75", "DEP": "33", "LIBELLE": "Pessac",
     "COMPARENT": ""},
    {"TYPECOM": "COMD", "COM": "49382", "REG": "52", "DEP": "49", "LIBELLE": "Vaulandry",
     "COMPARENT": "49018"},
    {"TYPECOM": "ARM", "COM": "75101", "REG": "11", "DEP": "75", "LIBELLE": "Paris 1er",
     "COMPARENT": "75056"},
]

MOUVEMENTS = [
    # Cas réel : Le Fresne-sur-Loire quitte la Loire-Atlantique pour le
    # Maine-et-Loire (nouveau code), puis fusionne l'année suivante.
    {"MOD": "41", "DATE_EFF": "2015-12-31", "TYPECOM_AV": "COM", "COM_AV": "44060",
     "TYPECOM_AP": "COM", "COM_AP": "49382"},
    {"MOD": "32", "DATE_EFF": "2016-01-01", "TYPECOM_AV": "COM", "COM_AV": "49382",
     "TYPECOM_AP": "COM", "COM_AP": "49160"},
    # Même mouvement vu côté statut : la commune devient déléguée en gardant son
    # code. Ce n'est pas un déplacement de périmètre.
    {"MOD": "32", "DATE_EFF": "2016-01-01", "TYPECOM_AV": "COM", "COM_AV": "49382",
     "TYPECOM_AP": "COMD", "COM_AP": "49382"},
    # La commune survivante garde son code : aucun passage à enregistrer.
    {"MOD": "32", "DATE_EFF": "2016-01-01", "TYPECOM_AV": "COM", "COM_AV": "49160",
     "TYPECOM_AP": "COM", "COM_AP": "49160"},
    # Scission (codes fictifs) : deux communes rétablies à partir d'une seule.
    {"MOD": "21", "DATE_EFF": "2024-01-01", "TYPECOM_AV": "COM", "COM_AV": "14697",
     "TYPECOM_AP": "COM", "COM_AP": "14001"},
    {"MOD": "21", "DATE_EFF": "2024-01-01", "TYPECOM_AV": "COM", "COM_AV": "14697",
     "TYPECOM_AP": "COM", "COM_AP": "14002"},
]


def test_territoires_exclut_communes_deleguees():
    territoires = cog.territoires(COMMUNES, 2025)
    codes = {t["geo_code"]: t for t in territoires}
    assert "49382" not in codes  # commune déléguée : portée par sa commune parente
    assert codes["33318"]["geo_level"] == "commune"
    assert codes["33318"]["parent_code"] == "33"
    arrondissement = codes["75101"]
    assert arrondissement["geo_level"] == "arrondissement_municipal"
    assert arrondissement["parent_code"] == "75056"


def test_mouvements_ne_gardent_que_les_changements_de_perimetre():
    evenements = cog.mouvements(MOUVEMENTS)
    # survivant et passage au statut de commune déléguée écartés
    assert len(evenements) == 4
    fusion = next(e for e in evenements if e["event_type"] == "fusion")
    assert (fusion["from_code"], fusion["to_code"]) == ("49382", "49160")
    assert (fusion["from_vintage"], fusion["to_vintage"]) == (2015, 2016)
    changement = next(e for e in evenements if e["event_type"] == "changement_code")
    assert (changement["from_code"], changement["to_code"]) == ("44060", "49382")


def test_parts_de_scission_au_prorata_de_la_population():
    evenements = cog.parts_de_scission(
        cog.mouvements(MOUVEMENTS), {"14001": 300, "14002": 100}
    )
    scissions = {e["to_code"]: e["population_share"] for e in evenements
                 if e["event_type"] == "scission"}
    assert scissions == {"14001": 0.75, "14002": 0.25}
    # une fusion transfère l'intégralité du territoire : aucune part à calculer
    assert all("population_share" not in e for e in evenements if e["event_type"] == "fusion")


def test_parts_de_scission_partage_egal_si_population_inconnue():
    # Une part nulle rendrait le passage faux et viole la contrainte du schéma.
    evenements = cog.parts_de_scission(cog.mouvements(MOUVEMENTS), {"14001": 300})
    scissions = {e["to_code"]: e["population_share"] for e in evenements
                 if e["event_type"] == "scission"}
    assert scissions == {"14001": 0.5, "14002": 0.5}
