"""Le catalogue des agrégats OFGL est une donnée, pas un filtre caché.

Cinq agrégats sur soixante-douze étaient chargés, et ce choix vivait dans un
dictionnaire Python sans la liste de ce qu'il écartait ni le motif : en lisant le
code, on ne pouvait pas savoir que « Frais de personnel » existait et n'était pas
pris. Ces tests vérifient que le catalogue reste complet, que la sélection s'y lit,
et qu'un agrégat sans définition arrête le chargement au lieu d'être publié muet.
"""

import csv
import json

import pytest

from plateforme.connectors import ofgl
from plateforme.normalize import ofgl as normalisation

NIVEAUX = ("commune", "epci", "departement", "region")


def test_le_catalogue_liste_tous_les_agregats_publies():
    lignes = ofgl.catalogue()
    assert len(lignes) == 72
    # Chaque ligne dit ce qu'elle coûte et si elle est prise : sans ces deux
    # colonnes, la sélection redeviendrait un choix invisible.
    for ligne in lignes:
        assert ligne["charge"] in {"oui", "non"}, ligne["agregat"]
        assert int(ligne["lignes"]) > 0, ligne["agregat"]
        assert ligne["niveaux"], ligne["agregat"]
        assert set(ligne["niveaux"].split(",")) <= set(NIVEAUX), ligne["agregat"]


def test_les_identifiants_sont_uniques_et_prefixes():
    identifiants = [ligne["indicateur"] for ligne in ofgl.catalogue()]
    assert len(set(identifiants)) == len(identifiants)
    assert all(i.startswith("ofgl_") for i in identifiants)


def test_seuls_les_agregats_marques_oui_sont_charges():
    retenus = ofgl.agregats()
    attendus = {ligne_cat["agregat"] for ligne_cat in ofgl.catalogue() if ligne_cat["charge"] == "oui"}
    assert set(retenus) == attendus
    assert len(retenus) >= 5


def test_une_maille_ne_demande_que_ses_propres_agregats():
    # Les allocations RSA, APA et les DMTO n'existent qu'au département et à la
    # région : les demander à l'export communal ferait porter à la requête un
    # filtre qui n'y correspond à rien.
    for niveau in NIVEAUX:
        for agregat in ofgl.agregats_du_niveau(niveau):
            ligne = next(c for c in ofgl.catalogue() if c["agregat"] == agregat)
            assert niveau in ligne["niveaux"].split(","), (niveau, agregat)


def test_chaque_agregat_charge_a_une_fiche_et_un_libelle():
    fiches, noms = normalisation.fiches(), normalisation.libelles()
    for identifiant in ofgl.agregats().values():
        grand_public, technique, formule = fiches[identifiant]
        assert len(grand_public) > 40, identifiant
        assert len(technique) > 40, identifiant
        assert formule, identifiant
        assert noms[identifiant], identifiant


def test_un_agregat_sans_definition_arrete_le_chargement(tmp_path):
    # L'OFGL publie trois agrégats sans les commenter. Les charger reviendrait à
    # afficher un montant que personne, nous compris, ne saurait expliquer.
    chemin = tmp_path / "agregats.csv"
    with open(chemin, "w", newline="", encoding="utf-8") as fichier:
        ecrivain = csv.DictWriter(
            fichier,
            fieldnames=[
                "agregat", "indicateur", "niveaux", "lignes",
                "charge", "chemin", "definition_ofgl", "formule_ofgl",
            ],
        )
        ecrivain.writeheader()
        # Un agrégat que l'OFGL ajouterait demain sans le commenter, et pour
        # lequel personne n'aurait encore écrit de fiche.
        ecrivain.writerow({
            "agregat": "Agrégat inédit", "indicateur": "ofgl_agregat_inedit",
            "niveaux": "commune", "lignes": "1", "charge": "oui",
            "chemin": "", "definition_ofgl": "", "formule_ofgl": "R + D",
        })
    lignes = ofgl.catalogue(chemin)
    assert lignes[0]["definition_ofgl"] == ""
    with pytest.raises(normalisation.DefinitionManquante, match="Agrégat inédit"):
        normalisation.fiches_depuis(lignes)


def test_les_agregats_non_commentes_par_l_ofgl_disent_qui_les_definit():
    # L'OFGL publie trois agrégats sans commentaire. Leur définition est écrite
    # ici, à partir de la formule comptable qu'il publie bien — ce n'est donc pas
    # une supposition, mais ce n'est pas non plus sa documentation. La fiche doit
    # le dire, sans quoi le lecteur croirait lire le producteur.
    muets = [ligne_cat["agregat"] for ligne_cat in ofgl.catalogue() if not ligne_cat["definition_ofgl"]]
    assert set(muets) == {
        "Crédits de trésorerie",
        "Fonds de roulement",
        "Produit des cessions d'immobilisations",
    }
    fiches = normalisation.fiches()
    retenus = ofgl.agregats()
    for agregat in muets:
        _, technique, formule = fiches[retenus[agregat]]
        assert "rédigée par ce site" in technique, agregat
        assert formule, agregat


def test_les_agregats_se_chargent_par_lots_bornes():
    """Demander les 72 agrégats d'un coup pour les communes rendrait un CSV de
    1,5 Go, que le connecteur transforme ligne à ligne en dictionnaires : vingt
    millions d'objets Python sur un runner qui a sept gigaoctets. Le découpage
    borne la mémoire sans rien changer au résultat."""
    from plateforme.normalize import ofgl as normalisation

    assert normalisation.LOT_AGREGATS <= 12
    retenus = ofgl.agregats_du_niveau("commune")
    lots = -(-len(retenus) // normalisation.LOT_AGREGATS)
    assert lots >= 2, "un seul lot : le découpage ne sert plus à rien"
    # L'union des lots redonne exactement la sélection : aucun agrégat perdu
    # entre deux passages.
    noms = list(retenus)
    decoupes = [
        noms[d : d + normalisation.LOT_AGREGATS]
        for d in range(0, len(noms), normalisation.LOT_AGREGATS)
    ]
    assert [nom for lot in decoupes for nom in lot] == noms


def test_chaque_fiche_publique_tient_dans_la_limite():
    """Le schéma refuse une définition publique de plus de 50 mots, et il a
    raison — une fiche est un repère, pas une notice. Mais il la refusait au
    milieu du chargement : le run du 4 août est mort après trois minutes sur les
    137 mots de la définition des DMTO, alors que le compte se fait hors réseau,
    en une milliseconde, à partir du seul fichier de sélection."""
    from plateforme.normalize import ofgl as normalisation

    trop_longues = {
        indicateur: len(publique.split())
        for indicateur, (publique, _, _) in normalisation.fiches().items()
        if len(publique.split()) > normalisation.MOTS_MAXIMUM
    }
    assert not trop_longues, trop_longues


def test_un_agregat_verbeux_sans_resume_arrete_le_chargement():
    """Ajouter un agrégat dont l'OFGL écrit une définition-fleuve doit se voir
    tout de suite, avec le nom de l'agrégat et le nombre de mots — pas se
    traduire par un `CHECK constraint failed` vingt minutes plus tard."""
    from plateforme.normalize import ofgl as normalisation

    catalogue = [
        {
            "agregat": "Agrégat bavard", "indicateur": "ofgl_agregat_bavard",
            "niveaux": "commune", "lignes": "1", "charge": "oui", "chemin": "",
            "definition_ofgl": " ".join(["mot"] * 60), "formule_ofgl": "A + B",
        }
    ]
    with pytest.raises(normalisation.ResumeManquant) as erreur:
        normalisation.fiches_depuis(catalogue)
    assert "Agrégat bavard" in str(erreur.value)
    assert "60 mots" in str(erreur.value)


def test_le_texte_entier_du_producteur_survit_dans_la_fiche_technique():
    """Résumer la fiche publique ne doit rien retrancher au public : la
    définition de l'OFGL, réserves comprises, reste lisible sur le site."""
    from plateforme.normalize import ofgl as normalisation

    fiches = normalisation.fiches()
    for indicateur in normalisation.RESUMES_PUBLICS:
        publique, technique, _ = fiches[indicateur]
        assert publique == normalisation.RESUMES_PUBLICS[indicateur]
        assert len(technique.split()) > normalisation.MOTS_MAXIMUM, indicateur
    # Les deux ruptures de série de 2024 sont dites des deux côtés : c'est ce
    # qu'un lecteur doit savoir avant de comparer 2023 à 2024.
    for indicateur in ("ofgl_depenses_d_intervention",
                       "ofgl_subventions_recues_et_participations"):
        publique, technique, _ = fiches[indicateur]
        assert "Rupture de série en 2024" in publique, indicateur
        assert "Rupture de série en 2024" in technique, indicateur


def test_declarer_les_73_fiches_contre_un_vrai_entrepot(tmp_path):
    """Le pas exact où le rechargement du 4 août est mort. Il ne touche pas au
    réseau : les fiches viennent du fichier de sélection, l'entrepôt est neuf.
    Deux passages, parce que le second emprunte le chemin `on conflict` — celui
    qui unit les niveaux au lieu de les écraser."""
    from plateforme import entrepot, registry
    from plateforme.normalize import ofgl as normalisation

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        normalisation.declarer_indicateurs(conn, ["commune"])
        attendus = set(normalisation.fiches())
        declares = {
            code for (code,) in conn.execute(
                "select indicator_id from core.indicators where published"
            ).fetchall()
        }
        assert declares == attendus
        # Chaque indicateur porte sa fiche : sans elle le site afficherait un
        # montant sans dire de quoi il parle.
        (sans_fiche,) = conn.execute(
            "select count(*) from core.indicators where definition_id is null"
        ).fetchone()
        assert sans_fiche == 0

        normalisation.declarer_indicateurs(conn, ["departement", "region"])
        (niveaux,) = conn.execute(
            "select geo_levels from core.indicators where indicator_id ="
            " 'ofgl_depenses_fonctionnement'"
        ).fetchone()
        assert sorted(niveaux) == ["commune", "departement", "region"]
        # Une fiche par indicateur, pas une par passage : les orphelines sont
        # ramassées.
        (definitions,) = conn.execute(
            "select count(*) from core.indicator_definitions"
        ).fetchone()
        assert definitions == len(attendus)
    finally:
        conn.close()


def test_les_criteres_de_comparaison_s_ajoutent_aux_drapeaux(tmp_path):
    """Le pas où le rechargement du 4 août est mort, après 642 212 observations.

    `flags = flags || criteres` fusionne deux objets JSON sous PostgreSQL ; sous
    DuckDB, `||` concatène deux chaînes, et « {} » suivi de « {"rural":…} » ne
    se relit pas. Le test de binding ne pouvait pas l'attraper : il saute les
    requêtes qui portent sur une table temporaire, et l'expression est
    parfaitement typée — c'est son *sens* qui change de moteur à moteur.

    Il vérifie aussi que la fusion garde ce qui était là : le rattachement d'un
    territoire ne doit pas disparaître sous les critères de l'OFGL.
    """
    from plateforme import entrepot, registry
    from plateforme.normalize import ofgl as normalisation
    from plateforme.normalize.geo import MILLESIME

    conn = entrepot.connect(tmp_path / "entrepot.duckdb")
    try:
        registry.sync(conn)
        conn.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values ('commune', '33063', ?, 'Bordeaux',"
            " 'departement', '33', '{\"statut_particulier\": true}')",
            (MILLESIME,),
        )
        conn.commit()
        ecrits = normalisation.enregistrer_criteres(
            conn,
            [
                {
                    "geo_code": "33063", "period": "2024",
                    "criteres": {"tranche_population": "4", "rural": "Non"},
                },
                {
                    "geo_code": "33063", "period": "2025",
                    "criteres": {"tranche_population": "5", "rural": "Non"},
                },
            ],
        )
        assert ecrits == 1
        (drapeaux,) = conn.execute(
            "select flags from geo.geography_reference where geo_code = '33063'"
        ).fetchone()
        drapeaux = json.loads(drapeaux)
        # L'exercice le plus récent l'emporte.
        assert drapeaux["tranche_population"] == "5"
        assert drapeaux["rural"] == "Non"
        assert drapeaux["criteres_source"] == "OFGL"
        # Et ce qui était déjà là est toujours là.
        assert drapeaux["statut_particulier"] is True
    finally:
        conn.close()
