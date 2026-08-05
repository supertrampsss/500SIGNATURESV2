"""Les couches départementale et régionale se construisent par union des
communes membres : si l'emboîtement ou le rattachement est faux, la carte
colorie un territoire avec les chiffres d'un autre.

Il y avait ici une couche intercommunale, construite de la même façon. Elle a
été retirée du produit — 1 266 territoires et 557 fichiers de carte par
publication pour un découpage sur lequel aucune question du site ne porte. Le
dernier test de ce fichier veille à ce qu'elle ne revienne pas par une porte de
derrière : une entrée de zoom oubliée suffirait à faire réapparaître une couche
dont plus rien n'alimente les données."""

from plateforme.normalize import geometries


def carre(code: str, x: int) -> dict:
    """Une commune carrée de 1×1 posée en (x, 0)."""
    return {
        "type": "Feature",
        "properties": {"code": code},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]],
        },
    }


def test_le_departement_est_exactement_l_union_de_ses_communes():
    from shapely.geometry import shape

    entites = [carre("33001", 0), carre("33002", 1), carre("34001", 5)]
    cadre = {"33001": ("33", "75"), "33002": ("33", "75"), "34001": ("34", "76")}
    couches = geometries.fusionner(entites, cadre)

    par_code = {e["properties"]["code"]: e for e in couches["departements"]}
    assert set(par_code) == {"33", "34"}
    # l'union de deux carrés adjacents de 1×1 fait exactement 2 — ni trou ni
    # recouvrement : la garantie d'emboîtement
    assert shape(par_code["33"]["geometry"]).area == 2.0


def test_la_region_est_exactement_l_union_de_ses_departements():
    from shapely.geometry import shape

    entites = [carre("33001", 0), carre("34001", 1)]
    cadre = {"33001": ("33", "76"), "34001": ("34", "76")}
    couches = geometries.fusionner(entites, cadre)

    assert [e["properties"]["code"] for e in couches["regions"]] == ["76"]
    assert shape(couches["regions"][0]["geometry"]).area == 2.0


def test_les_collectivites_a_statut_particulier_portent_leur_nom():
    """Une carte qui affiche « 67A » au survol n'apprend rien. Le libellé est
    porté par la couche, pas laissé au code départemental."""
    couches = geometries.fusionner(
        [carre("67001", 0), carre("69123", 5)],
        {"67001": ("67A", "44"), "69123": ("691", "84")},
    )
    noms = {e["properties"]["code"]: e["properties"]["nom"] for e in couches["departements"]}
    assert noms["67A"] == "Collectivité européenne d'Alsace"
    assert noms["691"] == "Métropole de Lyon"


def test_une_commune_sans_rattachement_ne_dessine_rien():
    """Inventer un département pour une commune que le référentiel ne rattache
    pas fabriquerait un territoire qui n'existe pas."""
    couches = geometries.fusionner([carre("29083", 0)], {})
    assert couches["departements"] == []
    assert couches["regions"] == []


def test_chaque_couche_a_sa_plage_de_zoom():
    assert set(geometries.COUCHES) == set(geometries.ZOOM)
    for bas, haut in geometries.ZOOM.values():
        assert bas < haut
    # la maille départementale apparaît avant la maille communale : c'est elle
    # qui rend la carte lisible entre la région et la commune
    assert geometries.ZOOM["departements"][0] < geometries.ZOOM["communes"][0]


def test_l_intercommunalite_n_est_cartographiee_nulle_part():
    from plateforme import publish

    assert "epcis" not in geometries.COUCHES
    assert "epcis" not in geometries.ZOOM
    assert "epci" not in publish.NIVEAUX_CARTOGRAPHIES
    assert "epci" not in publish.NIVEAUX
    assert publish.NIVEAUX_CARTOGRAPHIES <= set(publish.NIVEAUX)
