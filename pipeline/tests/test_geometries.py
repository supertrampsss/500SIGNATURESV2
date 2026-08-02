"""La couche intercommunale se construit par union des communes membres : si
l'emboîtement ou l'appartenance est faux, la carte colorie un territoire avec
les chiffres d'un autre."""

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


def test_l_epci_est_exactement_l_union_de_ses_membres():
    from shapely.geometry import shape

    entites = [carre("33001", 0), carre("33002", 1), carre("34001", 5)]
    appartenance = {"33001": "200000001", "33002": "200000001", "34001": "200000002"}
    noms = {"200000001": "CC du Test"}
    couche = geometries.fusionner_epci(entites, appartenance, noms)

    par_code = {e["properties"]["code"]: e for e in couche}
    assert set(par_code) == {"200000001", "200000002"}
    assert par_code["200000001"]["properties"]["nom"] == "CC du Test"
    # sans libellé au référentiel, le code fait foi plutôt qu'un trou
    assert par_code["200000002"]["properties"]["nom"] == "200000002"
    # l'union de deux carrés adjacents de 1×1 fait exactement 2 — ni trou ni
    # recouvrement : la garantie d'emboîtement
    assert shape(par_code["200000001"]["geometry"]).area == 2.0


def test_une_commune_hors_epci_ne_dessine_rien():
    """Quatre îles mono-communales n'appartiennent à aucun EPCI : les inventer
    fabriquerait un territoire qui n'existe pas."""
    couche = geometries.fusionner_epci([carre("29083", 0)], {}, {})
    assert couche == []


def test_l_appartenance_ignore_les_communes_sans_epci(monkeypatch):
    class FausseReponse:
        def json(self):
            return [
                {"code": "33001", "codeEpci": "200000001"},
                {"code": "29083"},  # île sans EPCI : pas de champ codeEpci
            ]

    monkeypatch.setattr(geometries, "fetch", lambda url, timeout=0: FausseReponse())
    assert geometries.appartenance_epci() == {"33001": "200000001"}


def test_chaque_couche_a_sa_plage_de_zoom():
    assert set(geometries.COUCHES) == set(geometries.ZOOM)
    for bas, haut in geometries.ZOOM.values():
        assert bas < haut
    # la maille intercommunale apparaît avant la maille communale : c'est elle
    # qui rend la carte lisible entre le département et la commune
    assert geometries.ZOOM["epcis"][0] < geometries.ZOOM["communes"][0]


def test_la_publication_cartographie_le_niveau_epci():
    from plateforme import publish

    assert "epci" in publish.NIVEAUX_CARTOGRAPHIES
    assert publish.NIVEAUX_CARTOGRAPHIES <= set(publish.NIVEAUX)
