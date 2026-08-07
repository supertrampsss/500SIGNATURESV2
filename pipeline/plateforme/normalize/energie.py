"""Ce que la commune consomme d'électricité et de gaz (Agence ORE).

Le site dit ce que la commune dépense et ce qu'elle encaisse. Il ne disait rien
de ce qu'elle consomme. La consommation d'énergie est la grandeur physique la
plus parlante d'un territoire — elle sépare la commune-dortoir de la
commune-usine — et les gestionnaires de réseaux la publient commune par commune,
en mégawattheures livrés, sous Licence Ouverte 2.0.

**Une commune, ce sont des dizaines de lignes.** La source croise opérateur
(136), filière, catégorie de consommation (RES, PRO, ENT, AGRI…) et secteur
NAF : Paris 2024 fait 141 lignes, pas deux. Publier une ligne au premier degré
donnerait la consommation d'un guichet, pas celle d'une commune — tout se somme
par commune × année × filière.

**L'agrégation se fait côté serveur, et ce choix est mesuré.** Le fichier brut
(`/raw`) pèse 839 Mo — 3,4 millions de lignes, 47 colonnes, quatorze
millésimes, sans filtre possible. Le flux paginé (`/lines`) ramènerait encore
~2,4 millions de lignes en ~240 pages pour 2018-2024. L'agrégat serveur
(`/values_agg`) rend la somme directement ; son plafond de 1 000 valeurs par
niveau interdit la commune en un appel (34 990 communes), mais pas le couple
département → commune : 101 départements, 890 communes au plus dans le plus
gros (Pas-de-Calais). Quatorze réponses de ~2 Mo remplacent 839 Mo, et chaque
niveau porte un `total_other` qui dit s'il a tronqué — zéro exigé, sinon des
communes disparaîtraient sans bruit.

**Un zéro n'est pas une valeur, c'est le secret statistique.** Dans les
petites mailles, la source retient la consommation (Informations
Commercialement Sensibles) : la ligne existe, sa valeur non. Une commune dont
toutes les lignes sont retenues sort du serveur avec une somme à zéro — 31
communes en électricité 2024. Publier ce zéro affirmerait qu'on n'y consomme
rien ; ces communes ne sont pas publiées.

**Ce que le chiffre ne dit pas.** C'est l'énergie livrée par les réseaux :
l'autoconsommation photovoltaïque n'y est pas, ni le fioul ni le bois. Et une
commune sans réseau de gaz n'a pas de valeur gaz — 9 823 communes gazières
contre 34 912 électrifiées en 2024.

Usage : python -m plateforme.normalize.energie [--store r2:plateforme-raw]
"""

import argparse
import json
import math
import urllib.parse
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import fetch
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, commune_mere, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "ore-conso-energie-communal"
SOURCE = "agence-ore"
JEU = "consommation-annuelle-d-electricite-et-gaz-par-commune"
BASE = f"https://opendata.agenceore.fr/data-fair/api/v1/datasets/{JEU}"

# Sept millésimes et pas quatorze : la source remonte à 2011, mais l'entrepôt
# n'a pas vocation à porter 900 000 observations pour une série dont la lecture
# courante s'arrête à l'ordre de grandeur décennal. ~490 000 observations au
# plus (35 000 communes × 7 ans × 2 filières), moins les communes sans gaz.
ANNEES = tuple(str(annee) for annee in range(2018, 2025))

THEME = "energie"
UNITE = "mwh"

FILIERES = {
    "ore_conso_electricite": "Electricité",
    "ore_conso_gaz": "Gaz",
}

INDICATEURS = {
    "ore_conso_electricite": (
        "Électricité consommée dans l'année",
        "L'électricité livrée dans l'année aux consommateurs de la commune, en"
        " mégawattheures : logements, commerces, industrie et agriculture"
        " confondus. L'autoconsommation photovoltaïque n'y est pas. Dans les"
        " petites communes, le secret statistique retient une partie des"
        " valeurs.",
        "Somme des consommations d'électricité livrées, tous opérateurs, toutes"
        " catégories de consommateurs et tous secteurs confondus, par commune et"
        " par année",
    ),
    "ore_conso_gaz": (
        "Gaz consommé dans l'année",
        "Le gaz livré dans l'année aux consommateurs de la commune raccordés au"
        " réseau, en mégawattheures : logements, commerces et industrie"
        " confondus. Une commune sans réseau de gaz n'a pas de valeur. Le secret"
        " statistique retient une partie des petites valeurs.",
        "Somme des consommations de gaz livrées, tous opérateurs, toutes"
        " catégories de consommateurs et tous secteurs confondus, par commune et"
        " par année",
    ),
}

TECHNIQUE = (
    "Consommation annuelle d'électricité et de gaz livrée par les réseaux,"
    " par commune, en mégawattheures (MWh). Source : Agence ORE, jeu"
    " « Consommation annuelle d'électricité et gaz par commune », Licence"
    " Ouverte 2.0, millésimes 2018 à 2024 ventilés sur le dernier référentiel"
    " communal INSEE. La source croise 136 opérateurs, la filière, la catégorie"
    " de consommation (résidentiel, professionnel, entreprise, agriculture…) et"
    " le secteur NAF : tout est sommé par commune × année × filière, toutes"
    " catégories de consommateurs confondues. **Secret statistique** : dans les"
    " petites mailles, la valeur est retenue au titre des informations"
    " commercialement sensibles (colonne source"
    " `nombre_de_mailles_secretisees`) — les totaux communaux sont donc des"
    " minorants là où des mailles sont secrétisées, et une commune dont toute"
    " la consommation est retenue n'est pas publiée plutôt que publiée à zéro."
    " **Périmètre** : énergie livrée par les réseaux publics ;"
    " l'autoconsommation (photovoltaïque notamment) n'y figure pas, ni les"
    " énergies hors réseau. Une commune sans réseau de gaz n'a pas de valeur"
    " gaz. Repères : électricité France entière 2023 ≈ 402,6 TWh ; Paris 2024,"
    " électricité résidentielle, 3 573 119 MWh."
)

# Contrôle bloquant sur le dernier millésime. La somme France entière de
# l'électricité est connue à 10 % près (RTE publie ~400 TWh soutirés par an) :
# un agrégat qui en rendrait 40 lit une mauvaise colonne, un qui en rendrait
# 4 000 double-compte. Et un chargement qui rend 12 000 communes au lieu de
# 35 000 a perdu des départements en route — c'est le défaut que `total_other`
# attrape bucket par bucket, et que ce contrôle attrape en dernier ressort.
ELEC_FRANCE_MINIMUM_MWH = 380_000_000.0  # 380 TWh
ELEC_FRANCE_MAXIMUM_MWH = 460_000_000.0  # 460 TWh
COMMUNES_MINIMUM = 34_000


class ConsommationInvraisemblable(RuntimeError):
    """Les mailles lues ne ressemblent pas à la consommation de la France."""


def url(indicateur: str, annee: str) -> str:
    parametres = urllib.parse.urlencode(
        {
            "field": "code_departement;code_commune",
            "agg_size": "1000;1000",
            "metric": "sum",
            "metric_field": "conso_totale_mwh",
            "qs": f'filiere:"{FILIERES[indicateur]}" AND annee:"{annee}"',
        }
    )
    return f"{BASE}/values_agg?{parametres}"


def lire(contenu: bytes) -> dict[str, float]:
    """Une réponse values_agg -> {code commune: MWh livrés}.

    Chaque niveau d'agrégat annonce dans `total_other` ce qu'il n'a pas rendu :
    zéro exigé, car une troncature ici est une commune qui disparaît sans
    qu'aucun total interne ne bouge. Les millésimes 2011-2017 de la source
    codent Paris, Lyon et Marseille par arrondissement : le repli sur la
    commune ne coûte rien sur 2018-2024 (aucun arrondissement) et évite le
    Paris-à-zéro du répertoire des logements sociaux si la source y revenait.
    Une somme à zéro est une consommation entièrement secrétisée, pas une
    consommation nulle : la commune n'est pas publiée.
    """
    reponse = json.loads(contenu)
    if reponse.get("total_other"):
        raise ValueError(
            f"agrégat tronqué : {reponse['total_other']} départements non rendus"
        )
    communes: dict[str, float] = defaultdict(float)
    for departement in reponse["aggs"]:
        if departement.get("total_other"):
            raise ValueError(
                f"agrégat tronqué : département {departement['value']},"
                f" {departement['total_other']} communes non rendues"
            )
        for commune in departement["aggs"]:
            code = commune_mere(commune["value"]) or commune["value"]
            communes[code] += commune.get("metric") or 0.0
    return {code: mwh for code, mwh in communes.items() if mwh > 0.0}


def controler(mailles: dict[tuple[str, str], dict[str, float]]) -> dict:
    """La France entière doit ressembler à la France entière.

    `mailles` : {(indicateur, année): {commune: MWh}}. Les contrôles internes —
    `total_other` par niveau — comparent la réponse à elle-même ; celui-ci la
    compare au monde : la somme électrique du dernier millésime est un chiffre
    public (~400 TWh), et la France a ~35 000 communes électrifiées.
    """
    if not mailles:
        raise ConsommationInvraisemblable("aucune maille lue")
    derniere = max(annee for _, annee in mailles)
    electricite = mailles.get(("ore_conso_electricite", derniere), {})
    total = math.fsum(electricite.values())
    if not ELEC_FRANCE_MINIMUM_MWH <= total <= ELEC_FRANCE_MAXIMUM_MWH:
        raise ConsommationInvraisemblable(
            f"électricité France entière {derniere} : {total / 1e6:.1f} TWh, hors"
            f" de l'intervalle [{ELEC_FRANCE_MINIMUM_MWH / 1e6:.0f},"
            f" {ELEC_FRANCE_MAXIMUM_MWH / 1e6:.0f}] TWh attendu. La colonne"
            " sommée n'est pas des MWh, ou des pans entiers du territoire"
            " manquent ou se comptent deux fois."
        )
    communes = {
        code
        for (_, annee), par_commune in mailles.items()
        if annee == derniere
        for code in par_commune
    }
    if len(communes) < COMMUNES_MINIMUM:
        raise ConsommationInvraisemblable(
            f"{len(communes)} communes distinctes sur le millésime {derniere},"
            f" moins que les {COMMUNES_MINIMUM} attendues : des départements"
            " entiers manquent à l'agrégat."
        )
    return {
        "dernier_millesime": derniere,
        "electricite_france_twh": round(total / 1e6, 2),
        "communes_dernier_millesime": len(communes),
        "mailles": {
            f"{indicateur}/{annee}": len(par_commune)
            for (indicateur, annee), par_commune in sorted(mailles.items())
        },
    }


COLONNES = ("value",)


def lignes_a_ecrire(mailles: dict[tuple[str, str], dict[str, float]]) -> list[tuple]:
    """-> [(indicateur, niveau, code, période, MWh)], arrondi au kWh."""
    return [
        (indicateur, "commune", code, annee, round(mwh, 3))
        for (indicateur, annee), par_commune in sorted(mailles.items())
        for code, mwh in sorted(par_commune.items())
    ]


def masse_par_maille(lignes: list[tuple]) -> dict[str, float]:
    """Les MWh par maille : la couverture compte l'énergie, pas les codes.

    Trois codes perdus ne pèsent rien s'ils portent trois hameaux, et tout
    s'ils portent Paris — même raisonnement que les euros des subventions.
    """
    par_maille: dict[str, list[float]] = defaultdict(list)
    for _, niveau, _, _, valeur in lignes:
        par_maille[niveau].append(valeur)
    return {niveau: math.fsum(valeurs) for niveau, valeurs in par_maille.items()}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, publique, formule) in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, 'mégawattheures (MWh) livrés dans l''année',
                        'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE, formule),
            ).fetchone()[0]
            # Des MWh ne sont ni en euros courants ni dans une comptabilité :
            # `price_basis` et `accounting_frame` restent nuls plutôt que de
            # prêter un cadre comptable à une grandeur physique.
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr,
                     unit, additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, ?, true, array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, THEME, libelle, UNITE),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        mailles: dict[tuple[str, str], dict[str, float]] = {}
        for indicateur in sorted(FILIERES):
            for annee in ANNEES:
                adresse = url(indicateur, annee)
                contenu = fetch(adresse, timeout=300).content
                entrepot.record_asset(
                    conn, store, run_id, DATASET, SOURCE,
                    f"{indicateur}-{annee}.json", contenu, adresse,
                    "application/json",
                )
                mailles[(indicateur, annee)] = lire(contenu)
            entrepot.etape(
                f"{indicateur} : {sum(len(mailles[(indicateur, a)]) for a in ANNEES)}"
                f" mailles commune × année lues"
            )
        verifies = controler(mailles)
        candidates = lignes_a_ecrire(mailles)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(FILIERES), COLONNES,
            [
                (indicateur, niveau, code, MILLESIME, periode, valeur)
                for indicateur, niveau, code, periode, valeur in gardees
            ],
        )
        # La couverture se mesure en MWh : c'est le rattachement des codes ORE
        # au référentiel qu'elle contrôle, et une commune fusionnée depuis le
        # millésime source pèse ce qu'elle consomme, pas un 35-millième.
        parts = couverture.controler(
            masse_par_maille(candidates), masse_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'consommation_vraisemblable_et_rattachee', 'blocker',
                    true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "hors_referentiel": sorted(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            }, ensure_ascii=False)),
        )
        conn.commit()
        lues = sum(len(par_commune) for par_commune in mailles.values())
        entrepot.finish_run(
            conn, run_id, "success", rows_read=lues, rows_written=ecrites
        )
        print(
            f"consommation d'énergie {ANNEES[0]}-{ANNEES[-1]} : {ecrites}"
            f" observations, électricité {verifies['electricite_france_twh']} TWh"
            f" sur {verifies['communes_dernier_millesime']} communes en"
            f" {verifies['dernier_millesime']}, {revisees} valeurs révisées"
        )
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
