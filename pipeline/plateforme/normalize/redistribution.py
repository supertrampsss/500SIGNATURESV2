"""Ce que la redistribution change, décile par décile (INSEE, ERFS rétropolée).

Le site dit ce que l'État encaisse et ce qu'il dépense ; il ne disait pas ce que
cet argent-là **fait** aux revenus. L'INSEE publie, de 1996 à 2024, les neuf
déciles du niveau de vie **avant** et **après** impôts et prestations : c'est la
seule série qui répond à « à quoi sert la redistribution » par des chiffres et
non par une opinion.

En 2024, le premier décile passe de 9 970 € à 13 970 € par an, le neuvième de
58 710 € à 48 580 €, et le rapport entre les deux de 5,89 à 3,48. La bascule est
au **troisième décile** : en dessous la redistribution ajoute, au-dessus elle
retranche. La série tient sur vingt-neuf exercices, ce qui est la seule façon de
voir si elle redistribue plus ou moins qu'avant.

**Le jeu rétropolé, et pas l'autre.** L'INSEE publie les deux. Le non rétropolé
porte **deux valeurs** pour 1996, 2010, 2012 et 2020 — une comparable à l'amont,
une à l'aval de chaque rupture de méthode — ce qui interdit d'en faire une série
continue sans choisir arbitrairement. Le rétropolé recale tout sur la méthode
courante : vingt-neuf exercices, une valeur par exercice, mesuré.

**France métropolitaine, et le site le dit.** L'ERFS ne couvre pas les DROM : la
définition publique le nomme, parce qu'une série nationale qui exclut deux
millions de personnes sans le dire est une comparaison dont on ne contrôle pas
le périmètre.

**Pas d'indice de Gini ici, et c'est un refus.** L'ERFS le publie (0,378 avant,
0,302 après en 2024), mais le site porte déjà un Gini européen, sur l'échelle
0-100 d'EU-SILC et sur un autre champ. Deux indices du même nom, sur deux
échelles et deux périmètres, posés sur les mêmes pages, se liraient comme un
seul et se contrediraient. Le rapport interdécile dit la même chose et se lit
sans mode d'emploi : « les 10 % les plus aisés touchaient 5,89 fois le premier
décile avant redistribution, 3,48 fois après ».

Usage : python -m plateforme.normalize.redistribution [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import entrepot
from plateforme.connectors import insee, melodi
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "melodi-erfs-retropole"
SOURCE = "insee-melodi"
JEU = "DS_ERFS_RETROPOLE"

# Le code géographique porte le millésime du zonage en préfixe
# (« 2026-FRANCE-FM ») : on reconnaît le champ par son suffixe, sans quoi le
# connecteur cesserait de trouver quoi que ce soit le jour où l'INSEE avance
# d'un millésime.
CHAMP = "FRANCE-FM"

# Les dimensions de croisement, ramenées au total. Sans ce filtre, la médiane
# arrive soixante-dix-sept fois — une par tranche d'âge et par statut d'emploi —
# et la dernière lue écraserait les autres sous la même clé.
TOTAUX = {"AGE": "_T", "EMPSTA_ENQ": "_T", "TPH": "_T", "MUN_DENSITY_LEVEL": "_T"}

# Le cinquième décile n'a pas de code `D5_SL` : c'est la médiane, et l'INSEE la
# nomme ainsi. La confondre avec un décile absent ferait un trou au milieu du
# tableau, à l'endroit où le lecteur se place lui-même.
def _mesure(decile: int, avant: bool) -> str:
    base = "MED_SL" if decile == 5 else f"D{decile}_SL"
    return f"{base}_BR" if avant else base


RANGS = {
    1: "10 % les plus modestes",
    2: "20 % les plus modestes",
    3: "30 % les plus modestes",
    4: "40 % les plus modestes",
    5: "moitié la plus modeste",
    6: "40 % les plus aisés",
    7: "30 % les plus aisés",
    8: "20 % les plus aisés",
    9: "10 % les plus aisés",
}


def _fiche_decile(decile: int, avant: bool) -> dict:
    seuil = "médian" if decile == 5 else f"{decile}e décile"
    moment = "avant impôts et prestations" if avant else "après impôts et prestations"
    return {
        "mesure": _mesure(decile, avant),
        "libelle": (
            f"Niveau de vie {seuil}, {'avant' if avant else 'après'} redistribution"
        ),
        "unite": "EUR",
        "public": (
            f"Le niveau de vie annuel qui sépare les {RANGS[decile]} du reste,"
            f" {moment}. Le niveau de vie rapporte le revenu du ménage au nombre de"
            " personnes qu'il fait vivre, un enfant comptant pour moins qu'un adulte."
        ),
        "technique": (
            f"{'MED_SL' if decile == 5 else f'D{decile}'} du niveau de vie,"
            f" enquête Revenus fiscaux et sociaux rétropolée, France métropolitaine,"
            f" {'revenu avant redistribution' if avant else 'revenu disponible'},"
            " euros courants annuels."
        ),
        "formule": None,
    }


INDICATEURS: dict[str, dict] = {}
for _decile in range(1, 10):
    INDICATEURS[f"insee_niveau_vie_d{_decile}"] = _fiche_decile(_decile, avant=False)
    INDICATEURS[f"insee_niveau_vie_d{_decile}_avant_redistribution"] = _fiche_decile(
        _decile, avant=True
    )
# ═════════════════════════════════════════════════════════════════════════
# CE QUE LE JEU PORTE ET QUE LE CONNECTEUR JETAIT
# ═════════════════════════════════════════════════════════════════════════
# `DS_ERFS_RETROPOLE` publie 44 mesures ; ce module n'en lisait que vingt. Les
# déciles disent la forme de la distribution, mais pas combien de gens sont
# pauvres, ni de combien la redistribution resserre l'écart. Ces trois familles
# le disent, et elles sont dans le jeu déjà chargé — aucun connecteur neuf,
# aucun appel de plus : la même page d'observations, d'autres identifiants.
#
# LE GINI EST SUR 0-1 ICI, ET SUR 0-100 CHEZ EUROSTAT. Le site publie déjà
# `eurostat_gini` sur l'échelle centésimale, sur un autre champ et une autre
# enquête. Les deux ne se posent donc PAS sur le même écran sans dire laquelle
# est laquelle — c'est la raison pour laquelle celui-ci porte « France
# métropolitaine » dans son libellé, et pourquoi son unité est un ratio et non
# un indice : deux nombres nommés « Gini » sur une même page se liraient comme
# un seul.
def _fiche_pauvrete(seuil: int, mesure: str, libelle: str, unite: str,
                    public: str, technique: str) -> dict:
    return {"mesure": mesure, "libelle": libelle, "unite": unite,
            "public": public, "technique": technique, "formule": None}


for _seuil in (50, 60):
    INDICATEURS[f"insee_taux_pauvrete_{_seuil}"] = _fiche_pauvrete(
        _seuil, f"PR_MD{_seuil}",
        f"Taux de pauvreté au seuil de {_seuil} % du niveau de vie médian",
        "percent",
        f"La part de la population dont le niveau de vie est inférieur à {_seuil} %"
        " du niveau de vie médian, après impôts et prestations. Le seuil à 60 % est la"
        " convention européenne, celui à 50 % la convention française.",
        f"Taux de pauvreté monétaire au seuil de {_seuil} % de la médiane, ERFS"
        " rétropolée, France métropolitaine, revenu disponible.",
    )
    INDICATEURS[f"insee_personnes_pauvres_{_seuil}"] = _fiche_pauvrete(
        _seuil, f"NUM_PER_MD{_seuil}",
        f"Personnes sous le seuil de pauvreté à {_seuil} %",
        "count",
        f"Le nombre de personnes vivant sous le seuil de {_seuil} % du niveau de vie"
        " médian. Un taux se discute, un nombre de personnes se compte.",
        f"Effectif de personnes pauvres au seuil de {_seuil} %, ERFS rétropolée,"
        " France métropolitaine. La source compte en MILLIERS ; la série est"
        " publiée en personnes.",
    )
    # Le producteur compte en milliers : « 9 817 » est 9,8 millions de personnes.
    # Publier le nombre brut donnerait « 9 817 personnes pauvres en France », un
    # chiffre faux et parfaitement plausible — c'est exactement la faute que le
    # connecteur des retraites a déjà coûtée sur les effectifs de retraités.
    INDICATEURS[f"insee_personnes_pauvres_{_seuil}"]["facteur"] = 1_000
    INDICATEURS[f"insee_seuil_pauvrete_{_seuil}"] = _fiche_pauvrete(
        _seuil, f"PT_MD{_seuil}",
        f"Seuil de pauvreté à {_seuil} % du niveau de vie médian",
        "EUR",
        f"Le revenu mensuel en dessous duquel une personne est comptée pauvre au"
        f" seuil de {_seuil} %. Un montant, et non un taux.",
        f"Seuil de pauvreté monétaire à {_seuil} % de la médiane, ERFS rétropolée,"
        " France métropolitaine, euros courants mensuels.",
    )
    INDICATEURS[f"insee_intensite_pauvrete_{_seuil}"] = _fiche_pauvrete(
        _seuil, f"PI_MD{_seuil}",
        f"Intensité de la pauvreté au seuil de {_seuil} %",
        "percent",
        "De combien le niveau de vie des personnes pauvres est en dessous du seuil."
        " Un taux de pauvreté dit combien de gens ; l'intensité dit à quel point.",
        f"Intensité de la pauvreté au seuil de {_seuil} %, écart relatif entre la"
        " médiane des personnes pauvres et le seuil, ERFS rétropolée, France"
        " métropolitaine.",
    )

# L'indice de Gini et le rapport interquintile, AVANT et APRÈS. Publier l'un
# sans l'autre laisserait croire que la France est inégalitaire ou égalitaire ;
# les deux ensemble mesurent ce que la redistribution FAIT, qui est la question.
for _cle, _mesure, _moment, _apres in (
    ("", "GI_SL", "après impôts et prestations", True),
    ("_avant_redistribution", "GI_SL_BR", "avant impôts et prestations", False),
):
    INDICATEURS[f"insee_gini{_cle}"] = {
        "mesure": _mesure,
        "libelle": f"Indice de Gini du niveau de vie, {'après' if _apres else 'avant'}"
        " redistribution (France métropolitaine)",
        "unite": "ratio",
        "public": "Zéro si tout le monde avait le même niveau de vie, un si une seule"
        f" personne avait tout. Mesuré {_moment}.",
        "technique": f"Indice de Gini du niveau de vie ({_mesure}), ERFS rétropolée,"
        " France métropolitaine, échelle 0-1. À ne pas confondre avec"
        " `eurostat_gini`, qui porte sur l'enquête EU-SILC et l'échelle 0-100.",
        "formule": None,
    }

for _cle, _mesure, _apres in (("", "S80S20_SL", True),
                              ("_avant_redistribution", "S80S20_SL_BR", False)):
    INDICATEURS[f"insee_rapport_interquintile{_cle}"] = {
        "mesure": _mesure,
        "libelle": f"Rapport interquintile S80/S20, {'après' if _apres else 'avant'}"
        " redistribution",
        "unite": "ratio",
        "public": "Combien de fois les 20 % les plus aisés touchent de plus que les"
        f" 20 % les plus modestes, {'après' if _apres else 'avant'} impôts et"
        " prestations.",
        "technique": f"Rapport interquintile de masse ({_mesure}), ERFS rétropolée,"
        " France métropolitaine.",
        "formule": "S80 / S20",
    }

INDICATEURS["insee_rapport_interdecile"] = {
    "mesure": "IR_D9_D1_SL",
    "libelle": "Rapport interdécile D9/D1, après redistribution",
    "unite": "ratio",
    "public": "Combien de fois le niveau de vie qui ouvre les 10 % les plus aisés"
    " vaut celui qui ferme les 10 % les plus modestes, après impôts et prestations.",
    "technique": "Rapport D9/D1 du niveau de vie, ERFS rétropolée, France"
    " métropolitaine, revenu disponible.",
    "formule": "D9 / D1",
}
INDICATEURS["insee_rapport_interdecile_avant_redistribution"] = {
    "mesure": "IR_D9_D1_SL_BR",
    "libelle": "Rapport interdécile D9/D1, avant redistribution",
    "unite": "ratio",
    "public": "Le même rapport, mesuré sur les revenus avant impôts et prestations :"
    " l'écart entre les deux est ce que la redistribution resserre.",
    "technique": "Rapport D9/D1 du niveau de vie, ERFS rétropolée, France"
    " métropolitaine, revenu avant redistribution.",
    "formule": "D9 / D1",
}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed',
                        array['Officiel','France métropolitaine'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"], fiche["formule"]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, geo_levels, time_granularity, published)
                values (?, ?, ?, 'revenus', ?, ?, false, ?, array['pays'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, additive = false, published = true
                """,
                (
                    indicateur, DATASET, definition, fiche["libelle"], fiche["unite"],
                    "current" if fiche["unite"] == "EUR" else None,
                ),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def valeurs_nationales(observations: list[dict], mesure: str) -> list[tuple[str, float]]:
    """-> [(période, valeur)] pour la France métropolitaine, croisements exclus.

    Trois filtres, et chacun a sa raison : le champ (les zonages d'étude
    voisinent dans le même jeu), la mesure (une requête peut en ramener
    plusieurs), et les totaux (sans eux, une même période revient une fois par
    tranche d'âge). Une période qui arriverait deux fois lève plutôt que de
    laisser la dernière lue écraser les autres — c'est exactement le piège du
    jeu non rétropolé, et rien ne doit le rendre silencieux ici.
    """
    retenues: dict[str, float] = {}
    for observation in observations:
        dimensions = observation.get("dimensions", {})
        if not str(dimensions.get("GEO", "")).endswith(CHAMP):
            continue
        if dimensions.get("ERFS_MEASURE") != mesure:
            continue
        if any(dimensions.get(cle) != valeur for cle, valeur in TOTAUX.items()):
            continue
        valeur = (observation.get("measures", {}).get("OBS_VALUE_NIVEAU") or {}).get("value")
        if valeur is None:
            continue  # une mesure non diffusée n'est pas une mesure à zéro
        periode = dimensions.get("TIME_PERIOD")
        if periode in retenues and retenues[periode] != valeur:
            raise ValueError(
                f"{mesure} : deux valeurs pour {periode}"
                f" ({retenues[periode]} et {valeur}) — rupture de série non traitée"
            )
        retenues[periode] = float(valeur)
    return sorted(retenues.items())


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        observations = melodi.pages(JEU, {})
        url = f"{insee.MELODI_BASE}/data/{JEU}"
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "erfs-retropole.json",
            json.dumps({"observations": observations}).encode(), url, "application/json",
        )
        total = 0
        for indicateur, fiche in INDICATEURS.items():
            lignes = valeurs_nationales(observations, fiche["mesure"])
            with conn.cursor() as curseur:
                curseur.execute(
                    "delete from core.observations where indicator_id = ?", (indicateur,)
                )
                entrepot.copier(
                    conn,
                    "core.observations",
                    ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period",
                     "value", "run_id"],
                    (
                        (indicateur, "pays", "FR", MILLESIME, periode,
                         valeur * fiche.get("facteur", 1), run_id)
                        for periode, valeur in lignes
                    ),
                )
            conn.commit()
            total += len(lignes)
            print(f"{indicateur} : {len(lignes)} exercices")
        entrepot.finish_run(conn, run_id, "success", rows_written=total)
        print(f"Redistribution : {total} observations")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
