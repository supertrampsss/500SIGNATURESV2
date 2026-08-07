"""La consommation d'énergie : des dizaines de lignes par commune, et des zéros
qui n'en sont pas.

La fixture est un extrait **réel** de l'API `/lines` de l'Agence ORE (relevé du
7 août 2026) : les 141 lignes de Paris 2024 et les 120 lignes
d'Ambérieu-en-Bugey (01004) pour 2018 et 2024 — chaque tranche commune × année
est complète, opérateurs, catégories et secteurs NAF compris. C'est ce qui
permet de confronter deux chemins indépendants vers le même chiffre : la somme
locale des lignes brutes d'un côté, et de l'autre l'agrégat que le serveur a
rendu le même jour (`values_agg`, relevé ici en dur). Une colonne décalée ou
une tranche amputée les fait diverger ; aucun total interne ne le verrait.

Le connecteur, lui, ne lit jamais les lignes brutes : il consomme la réponse
`values_agg`. Les tests la reconstruisent donc depuis la fixture, dans la forme
exacte relevée sur l'API — `aggs` imbriqués département puis commune,
`total_other` par niveau, `metric: 0` quand toutes les valeurs d'une commune
sont secrétisées. Quatre lignes de la fixture n'ont **pas** de valeur : le
secret statistique retient la consommation, la ligne existe quand même.
"""

import csv
import json
import math
from collections import defaultdict
from pathlib import Path

import pytest

from plateforme import couverture
from plateforme.normalize import energie as e

FIXTURES = Path(__file__).parent / "fixtures"

# Les agrégats rendus par le serveur (values_agg et metric_agg, relevés le
# 7 août 2026) pour les tranches que la fixture couvre en entier. C'est le
# côté indépendant du rapprochement : ces nombres ne sortent pas de la fixture.
SERVEUR = {
    ("75056", "Electricité", "2024"): 12_146_787.009,
    ("75056", "Gaz", "2024"): 8_182_579.494,
    ("01004", "Electricité", "2018"): 91_251.909,
    ("01004", "Gaz", "2018"): 77_307.369,
    ("01004", "Electricité", "2024"): 78_768.595,
    ("01004", "Gaz", "2024"): 62_008.728,
}


def _lignes() -> list[dict]:
    with (FIXTURES / "ore_conso_commune_sample.csv").open(encoding="utf-8") as fichier:
        return list(csv.DictReader(fichier))


@pytest.fixture(scope="module")
def lignes():
    return _lignes()


def _reponse(lignes: list[dict], filiere: str, annee: str) -> bytes:
    """La réponse values_agg telle que le serveur la rend, depuis les lignes brutes.

    La forme est relevée sur l'API réelle : un niveau par département, un
    niveau par commune, `total_other` à chaque niveau, et un `metric` qui somme
    les valeurs présentes — une ligne secrétisée n'en apporte aucune, si bien
    qu'une commune entièrement secrétisée sort avec `metric: 0`.
    """
    par_departement: dict[str, dict[str, list[float | None]]] = defaultdict(
        lambda: defaultdict(list)
    )
    total = 0
    for ligne in lignes:
        if ligne["filiere"] != filiere or ligne["annee"] != annee:
            continue
        total += 1
        par_departement[ligne["code_departement"]][ligne["code_commune"]].append(
            float(ligne["conso_totale_mwh"]) if ligne["conso_totale_mwh"] else None
        )
    aggs = []
    for departement, communes in sorted(par_departement.items()):
        buckets = [
            {
                "total": len(valeurs),
                "value": code,
                "results": [],
                "metric": math.fsum(v for v in valeurs if v is not None),
            }
            for code, valeurs in sorted(communes.items())
        ]
        aggs.append(
            {
                "total": sum(bucket["total"] for bucket in buckets),
                "value": departement,
                "results": [],
                "metric": math.fsum(bucket["metric"] for bucket in buckets),
                "total_values": len(buckets),
                "total_other": 0,
                "aggs": buckets,
            }
        )
    return json.dumps(
        {"total": total, "total_values": len(aggs), "total_other": 0, "aggs": aggs}
    ).encode()


def _mailles(lignes: list[dict]) -> dict[tuple[str, str], dict[str, float]]:
    """Les quatre tranches de la fixture, passées par le vrai chemin de lecture."""
    return {
        (indicateur, annee): e.lire(_reponse(lignes, filiere, annee))
        for indicateur, filiere in e.FILIERES.items()
        for annee in ("2018", "2024")
    }


def test_le_temoin_se_relit_depuis_la_fixture(lignes):
    """Paris, électricité, résidentiel, 2024 : le chiffre publié par l'Agence
    ORE est 3 573 119 MWh. Deux lignes le portent — Enedis, et un second
    opérateur dont la valeur est secrétisée."""
    temoins = [
        ligne
        for ligne in lignes
        if ligne["code_commune"] == "75056"
        and ligne["filiere"] == "Electricité"
        and ligne["annee"] == "2024"
        and ligne["code_categorie_consommation"] == "RES"
    ]
    assert len(temoins) == 2
    valeurs = [float(t["conso_totale_mwh"]) for t in temoins if t["conso_totale_mwh"]]
    assert valeurs == [3_573_119.455]
    (enedis,) = [t for t in temoins if t["conso_totale_mwh"]]
    assert enedis["operateur"] == "Enedis"
    assert int(enedis["nb_sites"]) == 1_358_011


def test_une_ligne_secretisee_existe_sans_valeur(lignes):
    """Le secret statistique de la source : la ligne est publiée, sa
    consommation non. Quatre lignes de l'extrait sont dans ce cas, et les
    mailles secrétisées se comptent dans une colonne dédiée."""
    sans_valeur = [ligne for ligne in lignes if not ligne["conso_totale_mwh"]]
    assert len(sans_valeur) == 4
    assert all(not ligne["nb_sites"] for ligne in sans_valeur)
    secretisees = sum(
        int(ligne["nombre_de_mailles_secretisees"] or 0)
        for ligne in lignes
        if ligne["code_commune"] == "01004"
    )
    assert secretisees == 4


def test_l_agregation_multi_lignes_rejoint_l_agregat_du_serveur(lignes):
    """Le rapprochement central : sommer localement les lignes brutes d'une
    tranche complète retombe, au kWh, sur l'agrégat que le serveur a rendu le
    même jour. Une tranche amputée ou une colonne décalée divergerait ici sans
    faire bouger aucun total interne."""
    verifies = 0
    for filiere in e.FILIERES.values():
        for annee in ("2018", "2024"):
            communes = e.lire(_reponse(lignes, filiere, annee))
            for code, mwh in communes.items():
                assert mwh == pytest.approx(SERVEUR[(code, filiere, annee)], abs=0.001)
                verifies += 1
    # Paris n'entre dans la fixture qu'en 2024 : six tranches commune × année ×
    # filière, pas huit.
    assert verifies == 6


def test_la_troncature_est_refusee(lignes):
    """`total_other` est la seule trace d'une commune que l'agrégat n'a pas
    rendue : le laisser passer perdrait des communes sans qu'aucune somme ne
    proteste."""
    reponse = json.loads(_reponse(lignes, "Electricité", "2024"))
    tronquee = {**reponse, "total_other": 3}
    with pytest.raises(ValueError, match="départements non rendus"):
        e.lire(json.dumps(tronquee).encode())
    reponse["aggs"][0]["total_other"] = 2
    with pytest.raises(ValueError, match="communes non rendues"):
        e.lire(json.dumps(reponse).encode())


def test_une_commune_entierement_secretisee_n_est_pas_publiee_a_zero(lignes):
    """31 communes sortent du serveur avec une somme à zéro en électricité
    2024 : toutes leurs valeurs sont secrétisées. Publier ce zéro affirmerait
    qu'on n'y consomme rien — la commune ne doit pas être publiée."""
    secretisees = [
        ligne
        for ligne in lignes
        if ligne["code_commune"] == "01004"
        and ligne["filiere"] == "Electricité"
        and ligne["annee"] == "2024"
        and not ligne["conso_totale_mwh"]
    ]
    assert secretisees, "la fixture porte des lignes secrétisées"
    communes = e.lire(_reponse(secretisees, "Electricité", "2024"))
    assert "01004" not in communes
    assert communes == {}


def test_les_arrondissements_se_replient_sur_leur_commune():
    """Les millésimes 2011-2017 de la source codent Paris, Lyon et Marseille
    par arrondissement. La fenêtre chargée n'en porte aucun, mais si la source
    y revenait, les laisser tels quels publierait Paris presque à zéro — le
    défaut que `couverture.py` raconte pour les logements sociaux."""
    contenu = json.dumps(
        {
            "total": 3,
            "total_values": 1,
            "total_other": 0,
            "aggs": [
                {
                    "total": 3,
                    "value": "75",
                    "results": [],
                    "metric": 30.0,
                    "total_values": 2,
                    "total_other": 0,
                    "aggs": [
                        {"total": 2, "value": "75101", "results": [], "metric": 10.0},
                        {"total": 1, "value": "75056", "results": [], "metric": 20.0},
                    ],
                }
            ],
        }
    ).encode()
    assert e.lire(contenu) == {"75056": 30.0}


def _france(communes: int, total_mwh: float) -> dict[str, float]:
    """Une France synthétique : le contrôle regarde la somme et le compte,
    pas les codes."""
    return {f"{i:05d}": total_mwh / communes for i in range(communes)}


def test_le_controle_bloquant_passe_sur_une_france_vraisemblable():
    verifies = e.controler(
        {
            ("ore_conso_electricite", "2024"): _france(35_000, 400e6),
            ("ore_conso_gaz", "2024"): _france(9_800, 360e6),
        }
    )
    assert verifies["dernier_millesime"] == "2024"
    assert verifies["electricite_france_twh"] == 400.0
    assert verifies["communes_dernier_millesime"] == 35_000
    assert verifies["mailles"]["ore_conso_gaz/2024"] == 9_800


def test_le_controle_bloquant_mord_sur_une_somme_invraisemblable():
    """Une colonne lue en kWh, un département compté deux fois : rien à
    l'intérieur de la réponse ne le voit, seule la comparaison au monde le
    peut. 300 TWh comme 500 TWh doivent lever."""
    with pytest.raises(e.ConsommationInvraisemblable, match="TWh"):
        e.controler({("ore_conso_electricite", "2024"): _france(35_000, 300e6)})
    with pytest.raises(e.ConsommationInvraisemblable, match="TWh"):
        e.controler({("ore_conso_electricite", "2024"): _france(35_000, 500e6)})
    # Le contrôle porte sur le dernier millésime : un 2024 défaillant ne se
    # rachète pas avec un 2023 correct.
    with pytest.raises(e.ConsommationInvraisemblable, match="2024"):
        e.controler(
            {
                ("ore_conso_electricite", "2023"): _france(35_000, 400e6),
                ("ore_conso_electricite", "2024"): _france(35_000, 300e6),
            }
        )
    with pytest.raises(e.ConsommationInvraisemblable, match="aucune maille"):
        e.controler({})


def test_le_controle_bloquant_mord_sur_des_communes_manquantes():
    """Un agrégat qui rend 12 000 communes a perdu des départements en route :
    la somme peut rester plausible si les gros sont là, le compte, non."""
    with pytest.raises(e.ConsommationInvraisemblable, match="communes distinctes"):
        e.controler({("ore_conso_electricite", "2024"): _france(33_000, 400e6)})


def test_l_url_demande_l_agregat_au_serveur():
    adresse = e.url("ore_conso_electricite", "2024")
    assert adresse.startswith(e.BASE + "/values_agg?")
    assert "field=code_departement%3Bcode_commune" in adresse
    assert "agg_size=1000%3B1000" in adresse
    assert "metric_field=conso_totale_mwh" in adresse
    assert "annee%3A%222024%22" in adresse
    assert "Electricit%C3%A9" in adresse
    assert "Gaz" in e.url("ore_conso_gaz", "2018")


def test_la_couverture_se_mesure_en_megawattheures(lignes):
    """Trois codes perdus ne pèsent rien s'ils portent trois hameaux, et tout
    s'ils portent Paris : la couverture compte l'énergie, pas les codes."""
    candidates = e.lignes_a_ecrire(_mailles(lignes))
    lus = e.masse_par_maille(candidates)
    assert set(lus) == {"commune"}
    assert lus["commune"] == pytest.approx(sum(SERVEUR.values()), abs=0.01)
    couverture.controler(lus, lus)
    with pytest.raises(couverture.CouvertureInsuffisante):
        couverture.controler(lus, {"commune": lus["commune"] * 0.5})


def test_les_fiches_portent_les_reserves():
    """Trois réserves qu'aucun chiffre ne laisse deviner : toutes catégories de
    consommateurs confondues, secret statistique, autoconsommation absente."""
    for identifiant, (_, publique, formule) in e.INDICATEURS.items():
        assert len(publique.split()) <= 50, identifiant
        assert "mégawattheures" in publique, identifiant
        assert "secret statistique" in publique, identifiant
        assert "toutes catégories de consommateurs" in formule, identifiant
    assert "autoconsommation" in e.INDICATEURS["ore_conso_electricite"][1]
    assert "sans réseau de gaz" in e.INDICATEURS["ore_conso_gaz"][1]
    assert "nombre_de_mailles_secretisees" in e.TECHNIQUE
    assert "minorants" in e.TECHNIQUE
    assert "n'est pas publiée" in e.TECHNIQUE
    assert "autoconsommation" in e.TECHNIQUE


def _semer_le_jeu(conn) -> None:
    """Le jeu au registre : sans lui, la clé étrangère du run refuse de
    démarrer et l'indicateur pendrait à un `dataset_id` orphelin."""
    conn.execute(
        "insert or ignore into meta.dataset_registry (dataset_id, source_id, title,"
        " priority) values (?, ?, 'Agence ORE - consommation annuelle d''electricite"
        " et de gaz par commune', 'P2')",
        (e.DATASET, e.SOURCE),
    )


def test_declarer_puis_redeclarer_contre_un_vrai_entrepot(entrepot_seme):
    _semer_le_jeu(entrepot_seme)
    e.declarer(entrepot_seme)
    e.declarer(entrepot_seme)
    publies = dict(entrepot_seme.execute(
        "select indicator_id, unit from core.indicators where dataset_id = ?",
        (e.DATASET,),
    ).fetchall())
    assert publies == {"ore_conso_electricite": "mwh", "ore_conso_gaz": "mwh"}
    themes = {theme for (theme,) in entrepot_seme.execute(
        "select theme from core.indicators where dataset_id = ?", (e.DATASET,)
    ).fetchall()}
    assert themes == {"energie"}
    # Des MWh ne sont ni en euros courants ni dans une comptabilité : recopier
    # les colonnes d'un montant mentirait sur la nature de la grandeur.
    cadres = dict(entrepot_seme.execute(
        "select indicator_id, coalesce(price_basis, '') || '/' ||"
        " coalesce(accounting_frame, '') from core.indicators where dataset_id = ?",
        (e.DATASET,),
    ).fetchall())
    assert cadres == {"ore_conso_electricite": "/", "ore_conso_gaz": "/"}
    (orphelines,) = entrepot_seme.execute(
        "select count(*) from core.indicator_definitions d where not exists"
        " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
    ).fetchone()
    assert orphelines == 0


def test_l_ecriture_reelle_contre_un_vrai_entrepot(entrepot_seme, lignes):
    from plateforme import entrepot, revisions
    from plateforme.normalize.ofgl import filtrer_territoires_connus

    _semer_le_jeu(entrepot_seme)
    e.declarer(entrepot_seme)
    for code, nom in (("75056", "Paris"), ("01004", "Ambérieu-en-Bugey")):
        entrepot_seme.execute(
            "insert into geo.geography_reference (geo_level, geo_code, vintage, name,"
            " parent_level, parent_code, flags) values ('commune', ?, ?, ?,"
            " 'departement', ?, '{}')",
            (code, e.MILLESIME, nom, code[:2]),
        )
    run_id = entrepot.start_run(entrepot_seme, e.DATASET, "manual")
    candidates = e.lignes_a_ecrire(_mailles(lignes))
    gardees, ecartes = filtrer_territoires_connus(entrepot_seme, candidates)
    assert not ecartes, "les deux communes de la fixture sont au référentiel"
    ecrites, revisees = revisions.remplacer(
        entrepot_seme, run_id, sorted(e.FILIERES), e.COLONNES,
        [
            (indicateur, niveau, code, e.MILLESIME, periode, valeur)
            for indicateur, niveau, code, periode, valeur in gardees
        ],
    )
    entrepot_seme.commit()
    # Paris n'entre qu'en 2024 : deux communes × deux filières × deux années,
    # moins les deux tranches parisiennes de 2018.
    assert (ecrites, revisees) == (6, 0)
    (paris,) = entrepot_seme.execute(
        "select value from core.observations"
        " where indicator_id = 'ore_conso_electricite'"
        " and geo_code = '75056' and period = '2024'"
    ).fetchone()
    assert paris == pytest.approx(12_146_787.009, abs=0.001)
    (gaz,) = entrepot_seme.execute(
        "select value from core.observations where indicator_id = 'ore_conso_gaz'"
        " and geo_code = '01004' and period = '2018'"
    ).fetchone()
    assert gaz == pytest.approx(77_307.369, abs=0.001)
    # Recharger la même parution remplace sans archiver : rien n'a changé,
    # rien ne doit passer pour une révision.
    ecrites, revisees = revisions.remplacer(
        entrepot_seme, run_id, sorted(e.FILIERES), e.COLONNES,
        [
            (indicateur, niveau, code, e.MILLESIME, periode, valeur)
            for indicateur, niveau, code, periode, valeur in gardees
        ],
    )
    entrepot_seme.commit()
    assert (ecrites, revisees) == (6, 0)
    (total,) = entrepot_seme.execute(
        "select count(*) from core.observations where indicator_id like 'ore_conso%'"
    ).fetchone()
    assert total == 6
