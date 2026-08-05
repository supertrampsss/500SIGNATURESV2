"""Équipements et services par commune (INSEE, base permanente) vers observations.

« Qu'est-ce qu'il y a près de chez moi ? » est une question de service public
autant qu'une question de commerce, et la base permanente des équipements y
répond commune par commune : santé, écoles, commerces, transports, sport,
tourisme, services aux particuliers.

**Sept domaines et leur total, pas deux cent trente-six types.** La base
descend jusqu'à l'orthophoniste et au terrain de pétanque. Charger ce détail
ferait 1,3 million de lignes communales pour une lecture que personne ne fait ;
les sept domaines et leur total en font 180 000 et répondent à la question. Le
détail reste chez le producteur, et la fiche donne le lien.

**Un équipement n'est pas une capacité.** Un hypermarché compte pour un, une
supérette aussi. Un cabinet de groupe compte pour un, comme un médecin seul.
Le dénombrement dit ce qui existe, pas ce que ça pèse — la fiche le dit, et
c'est pour cela qu'aucun ratio « équipements par habitant » n'est calculé ici
comme s'il mesurait un niveau de service.

**Ne pas additionner avec nos écoles.** Le domaine « enseignement » de cette
base et les écoles de l'annuaire du ministère comptent des choses différentes,
sur des périmètres différents. Les deux sont publiés, aucun n'est agrégé à
l'autre.

**Le contrôle qui bloque.** La somme des sept domaines doit égaler le total
publié, territoire par territoire. Vérifié sur Bordeaux au moment d'écrire ce
module : 6 460 + 2 356 + 452 + 4 740 + 316 + 248 + 285 = 14 857, exactement le
total de la source.

Usage : python -m plateforme.normalize.equipements [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import zipfile

from plateforme import entrepot
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-bpe"
SOURCE = "insee-melodi"
JEU = "DS_BPE"
URL = "https://api.insee.fr/melodi/file/DS_BPE/DS_BPE_2025_CSV_FR"

NIVEAUX = {"COM": "commune", "EPCI": "epci", "DEP": "departement", "REG": "region"}

# Les sept domaines de la nomenclature, plus le total. Les libellés sont ceux
# du producteur, repris tels quels : renommer « Services pour les particuliers »
# en « services publics » ferait dire à la donnée autre chose que ce qu'elle dit
# — le domaine contient aussi bien la poste que le coiffeur.
DOMAINES = {
    "_T": ("insee_equipements_total", "Équipements, tous domaines"),
    "A": ("insee_equipements_services", "Services pour les particuliers"),
    "B": ("insee_equipements_commerces", "Commerces"),
    "C": ("insee_equipements_enseignement", "Enseignement"),
    "D": ("insee_equipements_sante", "Santé et action sociale"),
    "E": ("insee_equipements_transports", "Transports et déplacements"),
    "F": ("insee_equipements_sport_culture", "Sports, loisirs et culture"),
    "G": ("insee_equipements_tourisme", "Tourisme"),
}
TOTAL = "_T"

PUBLIQUE = {
    "_T": "Le nombre total d'équipements et de services recensés dans la commune :"
    " commerces, écoles, cabinets médicaux, arrêts de transport, terrains de sport,"
    " hébergements touristiques. Un équipement compte pour un, quelle que soit sa"
    " taille.",
    "A": "Les services de proximité : poste, banque, garage, restaurant, coiffeur,"
    " pompes funèbres, gendarmerie. Le domaine mêle services publics et commerces de"
    " service — c'est le découpage de la statistique publique, pas le nôtre.",
    "B": "Les commerces recensés dans la commune, de l'hypermarché à la supérette."
    " Chacun compte pour un : le nombre ne dit rien des surfaces ni des chiffres"
    " d'affaires.",
    "C": "Les établissements d'enseignement recensés, de la maternelle au supérieur,"
    " formation continue comprise. À ne pas confondre avec le nombre d'écoles de"
    " l'annuaire du ministère, qui compte sur un autre périmètre.",
    "D": "Les équipements de santé et d'action sociale : médecins, infirmiers,"
    " pharmacies, hôpitaux, crèches, maisons de retraite. Un cabinet de groupe"
    " compte pour un, comme un praticien seul.",
    "E": "Les équipements de transport recensés : gares, arrêts, aires de"
    " covoiturage, bornes de recharge. Le nombre ne dit rien de la fréquence de"
    " passage.",
    "F": "Les équipements de sport, de loisirs et de culture : terrains, salles,"
    " piscines, bibliothèques, cinémas, salles de spectacle.",
    "G": "Les équipements touristiques recensés : hôtels, campings, offices de"
    " tourisme, villages vacances. Le nombre ne dit rien du nombre de lits.",
}

TECHNIQUE = (
    "Base permanente des équipements, millésime 2025, mesure « nombre"
    " d'équipements » agrégée au domaine — la base descend à deux cent trente-six"
    " types, non chargés ici. Un dénombrement, pas une capacité : la taille de"
    " l'équipement n'entre pas dans le compte. La nomenclature évolue d'un"
    " millésime à l'autre (la police change de code entre 2024 et 2025, six types"
    " apparaissent), ce qui interdit de comparer deux millésimes sans vérifier le"
    " périmètre."
)


class TotalIncoherent(RuntimeError):
    """La somme des domaines ne fait pas le total publié par la source."""


def lire(archive: bytes) -> list[dict]:
    """CSV zippé de la base permanente -> totaux par domaine et par territoire.

    Ne garde que les lignes d'agrégat : sous-domaine et type à « _T ». Les
    lignes de détail portent le même domaine et se compteraient deux fois.
    """
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.DictReader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            return [
                {
                    "domaine": rang["FACILITY_DOM"],
                    "niveau": NIVEAUX[rang["GEO_OBJECT"]],
                    "code": rang["GEO"],
                    "periode": rang["TIME_PERIOD"],
                    "valeur": float(rang["OBS_VALUE"]),
                }
                for rang in lecteur
                if rang["GEO_OBJECT"] in NIVEAUX
                and rang["FACILITY_SDOM"] == "_T"
                and rang["FACILITY_TYPE"] == "_T"
                and rang["FACILITY_DOM"] in DOMAINES
                and rang["OBS_VALUE"]
            ]


def controler(lignes: list[dict], tolerance: int = 0) -> dict[str, float]:
    """La somme des sept domaines contre le total, territoire par territoire.

    -> les écarts constatés. Lève dès qu'il y en a un : un domaine manquant ou
    compté deux fois se verrait ici, et nulle part ailleurs.
    """
    sommes: dict[tuple, float] = {}
    totaux: dict[tuple, float] = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"])
        if ligne["domaine"] == TOTAL:
            totaux[cle] = ligne["valeur"]
        else:
            sommes[cle] = sommes.get(cle, 0.0) + ligne["valeur"]
    ecarts = {
        f"{niveau}:{code}:{periode}": sommes.get((niveau, code, periode), 0.0) - total
        for (niveau, code, periode), total in totaux.items()
        if abs(sommes.get((niveau, code, periode), 0.0) - total) > tolerance
    }
    if ecarts:
        detail = ", ".join(f"{c} : {e:+.0f}" for c, e in sorted(ecarts.items())[:5])
        raise TotalIncoherent(
            f"la somme des domaines ne fait pas le total publié ({len(ecarts)}"
            f" territoires, dont {detail}). Un domaine manque ou compte deux fois."
        )
    return ecarts


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for domaine, (indicateur, libelle) in DOMAINES.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, 'équipements', 'observed',
                        array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (
                    PUBLIQUE[domaine],
                    TECHNIQUE,
                    f"Nombre d'équipements du domaine « {libelle} »"
                    if domaine != TOTAL
                    else "Somme des sept domaines",
                ),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, 'equipements', ?, 'count', true,
                        array['commune','epci','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (indicateur, DATASET, definition, libelle),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int]:
    candidates = [
        (DOMAINES[ligne["domaine"]][0], ligne["niveau"], ligne["code"],
         ligne["periode"], ligne["valeur"])
        for ligne in lignes
    ]
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    indicateurs = [nom for nom, _ in DOMAINES.values()]
    with conn.cursor() as curseur:
        curseur.execute(
            "delete from core.observations where indicator_id = any(?)", (indicateurs,)
        )
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "run_id"],
            (
                (cle, niveau, code, MILLESIME, periode, valeur, run_id)
                for cle, niveau, code, periode, valeur in gardees
            ),
        )
    conn.commit()
    return len(gardees), len(ecartes)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        archive = telecharger(URL, timeout=300)
        entrepot.etape(f"archive de {len(archive) / 1e6:.0f} Mo téléchargée")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "bpe.zip", archive, URL,
            "application/zip",
        )
        lignes = lire(archive)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucun équipement lu")
        controler(lignes)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'somme_des_domaines_egale_le_total', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "territoires": len({(x["niveau"], x["code"]) for x in lignes}),
                "domaines": len(DOMAINES) - 1,
            })),
        )
        conn.commit()
        ecrites, ecartes = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        periodes = sorted({ligne["periode"] for ligne in lignes})
        print(
            f"équipements : {ecrites} observations, millésime {periodes[-1]},"
            f" {len(DOMAINES)} indicateurs, {ecartes} hors référentiel"
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
