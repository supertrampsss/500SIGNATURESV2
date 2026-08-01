from plateforme.connectors import ofgl
from plateforme.normalize.ofgl import POPULATION, observations

CSV = (
    "﻿exer;com_code;siren;agregat;montant;ptot\n"
    "2024;33318;213303180;Dépenses de fonctionnement;91000000.5;67000\n"
    "2024;33318;213303180;Encours de dette;42000000.0;67000\n"
    "2017;33318;213303180;Encours de dette;38000000.0;66000\n"
    # budget absent : OFGL laisse le montant vide, ce n'est pas un zéro
    "2024;33999;213339990;Encours de dette;;120\n"
).encode()

# Cas réel : Saint-Jean-d'Hermine, commune nouvelle de 2025. Sous le code
# actuel, chaque commune d'origine garde sa ligne pour les exercices antérieurs.
CSV_COMMUNE_NOUVELLE = (
    "﻿exer;com_code;siren;agregat;montant;ptot\n"
    "2024;85223;218502235;Encours de dette;3007635.87;3013\n"
    "2024;85223;218502334;Encours de dette;892787.8;633\n"
    "2024;85223;218502235;Dépenses de fonctionnement;2500000.0;3013\n"
    "2024;85223;218502334;Dépenses de fonctionnement;700000.0;633\n"
).encode()


def test_url_export_filtre_sur_les_agregats():
    url = ofgl.url_export("commune", ["Encours de dette"])
    assert "ofgl-base-communes-consolidee" in url
    assert "limit=-1" in url  # export complet, jamais la pagination de /records
    assert "Encours%20de%20dette" in url


def test_lire_ecarte_les_montants_absents():
    lignes = ofgl.lire(CSV, "commune")
    assert len(lignes) == 3  # la ligne sans montant est écartée
    premiere = lignes[0]
    assert premiere["indicator_id"] == "ofgl_depenses_fonctionnement"
    assert premiere["value"] == 91000000.5
    assert premiere["geo_level"] == "commune"


def test_observations_deduplique_la_population_et_respecte_la_borne():
    montants, populations = observations(ofgl.lire(CSV, "commune"), depuis=2018)
    assert len(montants) == 2  # l'exercice 2017 est hors borne
    # la population est répétée sur chaque agrégat : une seule observation par
    # territoire et exercice
    assert populations == [(POPULATION, "commune", "33318", "2024", 67000)]


def test_commune_nouvelle_somme_ses_communes_d_origine():
    # Publier une seule ligne annoncerait la moitié de la dette réelle.
    montants, populations = observations(
        ofgl.lire(CSV_COMMUNE_NOUVELLE, "commune"), depuis=2018
    )
    valeurs = {ligne[0]: ligne[4] for ligne in montants}
    assert valeurs["ofgl_encours_dette"] == 3007635.87 + 892787.8
    assert valeurs["ofgl_depenses_fonctionnement"] == 3200000.0
    # la population additionne les budgets distincts, pas les lignes
    assert populations == [(POPULATION, "commune", "85223", "2024", 3013 + 633)]
