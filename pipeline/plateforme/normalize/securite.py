"""Délinquance enregistrée (SSMSI, ministère de l'Intérieur) vers core.observations.

« Ma commune est-elle sûre ? » est la question sociale territoriale la plus
posée, et le site n'y répondait pas. Les bases statistiques du SSMSI donnent,
par commune, département et région, les crimes et délits **enregistrés** par la
police et la gendarmerie — comptages agrégés sous Licence Ouverte : aucune
donnée individuelle, policière ou judiciaire, ne transite ici.

**Enregistré n'est pas subi.** Un fait non déclaré n'existe pas dans ces bases.
La sous-déclaration varie énormément selon l'infraction — massive pour les
violences sexuelles et intrafamiliales, faible pour les vols de voiture
(l'assurance exige la plainte). Une hausse peut dire une libération de la
parole autant qu'une aggravation. Chaque fiche le dit.

**Le dénominateur dépend de la classe, et il est vérifié.** Les cambriolages se
rapportent à 1 000 *logements*, tout le reste à 1 000 *habitants* — constaté
sur les données, pas supposé : chaque ligne recalcule nombre/dénominateur et
s'écarte si le taux publié ne se referme pas. Publier « pour 1 000 habitants »
un taux calculé pour 1 000 logements doublerait le chiffre sans prévenir.

**Périmètre choisi par la contrainte de volume (D6bis).** La base communale
fait 5,2 millions de lignes ; le plan Supabase n'en absorbe pas tant. Au niveau
communal : six classes phares, dernière année, valeurs diffusées seulement
(le secret de diffusion du SSMSI, `ndiff`, couvre ~46 % des lignes — la
couverture est mesurée et enregistrée par classe, jamais devinée). Aux niveaux
départemental et régional : seize classes, tout l'historique 2016-2025. Les
sous-découpages « Usage de stupéfiants (AFD) / (hors AFD) » sont exclus : ils
recouvrent l'agrégat déjà chargé. Un garde-fou mesure la taille de la base
avant d'écrire et refuse de dépasser le plan.

Usage : python -m plateforme.normalize.securite [--store r2:plateforme-raw]
"""

import argparse
import csv
import gzip
import io
import json
from collections import defaultdict
from collections.abc import Iterable

from psycopg.types.json import Jsonb

from plateforme import db, revisions
from plateforme.limites import garde_fou_volume
from plateforme.http import fetch
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "ssmsi-delinquance"
SOURCE = "data-gouv"
DATASET_DATAGOUV = "621df2954fa5a3b5a023e23c"
API_DATAGOUV = "https://www.data.gouv.fr/api/1"

TOLERANCE_TAUX = 0.02  # le taux est publié à 7 décimales : l'écart honnête est infime

COL_CODE = {"commune": "CODGEO_2026", "departement": "Code_departement", "region": "Code_region"}

COMMUNAL = True  # lisibilité de la table ci-dessous

# classe SSMSI -> (slug, libellé, définition publique ≤ 50 mots, dénominateur,
#                  présent au niveau communal)
CLASSES = {
    "Cambriolages de logement": (
        "cambriolages", "Cambriolages de logement",
        "Les cambriolages de logement enregistrés par la police et la gendarmerie,"
        " rapportés à 1 000 logements. Un fait non déclaré n'est pas compté : ce"
        " chiffre suit les plaintes et signalements, pas l'intégralité des"
        " cambriolages commis.",
        "logements", COMMUNAL,
    ),
    "Vols de véhicule": (
        "vols_vehicules", "Vols de véhicules",
        "Les vols de voitures, motos et autres véhicules enregistrés, pour 1 000"
        " habitants. Comptés là où le vol est commis : une commune très fréquentée"
        " — gare, zone commerciale — voit son taux gonflé par rapport à sa seule"
        " population résidente.",
        "population", COMMUNAL,
    ),
    "Vols sans violence contre des personnes": (
        "vols_sans_violence", "Vols sans violence",
        "Vols à la tire, à l'étalage ou d'objets, sans violence ni menace, pour"
        " 1 000 habitants. Très dépendants du dépôt de plainte et de la"
        " fréquentation des lieux : centres-villes et zones commerçantes"
        " concentrent les faits enregistrés.",
        "population", COMMUNAL,
    ),
    "Violences physiques hors cadre familial": (
        "violences_hors_famille", "Violences physiques (hors famille)",
        "Coups et blessures volontaires hors du cadre familial, en victimes"
        " enregistrées pour 1 000 habitants. Mesure les faits portés à la"
        " connaissance des forces de l'ordre — pas toutes les violences subies.",
        "population", COMMUNAL,
    ),
    "Violences physiques intrafamiliales": (
        "violences_intrafamiliales", "Violences intrafamiliales",
        "Violences physiques au sein de la famille, en victimes enregistrées pour"
        " 1 000 habitants. Longtemps très sous-déclarées : une hausse peut"
        " refléter une libération de la parole et un meilleur accueil des"
        " plaintes autant qu'une aggravation des violences.",
        "population", COMMUNAL,
    ),
    "Violences sexuelles": (
        "violences_sexuelles", "Violences sexuelles",
        "Violences sexuelles enregistrées, en victimes pour 1 000 habitants. La"
        " sous-déclaration reste massive : ce chiffre suit les plaintes"
        " déposées, pas la réalité des violences, et son évolution dit d'abord"
        " celle du dépôt de plainte.",
        "population", COMMUNAL,
    ),
    "Homicides": (
        "homicides", "Homicides",
        "Homicides enregistrés, en victimes. Un événement rare est instable d'une"
        " année à l'autre à l'échelle d'un département : lire la tendance sur"
        " plusieurs années, jamais un écart isolé.",
        "population", not COMMUNAL,
    ),
    "Tentatives d'homicide": (
        "tentatives_homicide", "Tentatives d'homicide",
        "Tentatives d'homicide enregistrées, en victimes. Série sensible aux"
        " requalifications juridiques au moment de l'enregistrement des faits.",
        "population", not COMMUNAL,
    ),
    "Vols avec armes": (
        "vols_armes", "Vols avec armes",
        "Vols commis avec une arme — à feu, blanche ou par destination —"
        " enregistrés, pour 1 000 habitants.",
        "population", not COMMUNAL,
    ),
    "Vols violents sans arme": (
        "vols_violents", "Vols violents sans arme",
        "Vols commis avec violence mais sans arme, enregistrés pour 1 000"
        " habitants.",
        "population", not COMMUNAL,
    ),
    "Vols dans les véhicules": (
        "vols_dans_vehicules", "Vols dans les véhicules",
        "Vols d'objets à l'intérieur des véhicules, enregistrés pour 1 000"
        " habitants.",
        "population", not COMMUNAL,
    ),
    "Vols d'accessoires sur véhicules": (
        "accessoires_vehicules", "Vols d'accessoires sur véhicules",
        "Vols d'accessoires sur véhicules — roues, carburant, catalyseurs —"
        " enregistrés pour 1 000 habitants.",
        "population", not COMMUNAL,
    ),
    "Destructions et dégradations volontaires": (
        "degradations", "Destructions et dégradations",
        "Destructions et dégradations volontaires enregistrées, pour 1 000"
        " habitants. Le vandalisme du quotidien en fait partie ; la série dépend"
        " fortement du signalement.",
        "population", not COMMUNAL,
    ),
    "Escroqueries et fraudes aux moyens de paiement": (
        "escroqueries", "Escroqueries et fraudes",
        "Escroqueries et fraudes aux moyens de paiement, en victimes enregistrées"
        " pour 1 000 habitants. Une part croissante se commet en ligne : le lieu"
        " d'enregistrement n'est pas toujours celui du préjudice.",
        "population", not COMMUNAL,
    ),
    "Trafic de stupéfiants": (
        "trafic_stupefiants", "Trafic de stupéfiants",
        "Personnes mises en cause pour trafic de stupéfiants, pour 1 000"
        " habitants. Mesure l'activité des services autant que le trafic : plus"
        " de contrôles produit plus de mis en cause. Un mis en cause n'est pas"
        " un condamné.",
        "population", not COMMUNAL,
    ),
    "Usage de stupéfiants": (
        "usage_stupefiants", "Usage de stupéfiants",
        "Personnes mises en cause pour usage de stupéfiants, pour 1 000"
        " habitants. Reflète largement l'intensité des contrôles policiers sur"
        " la voie publique. Un mis en cause n'est pas un condamné.",
        "population", not COMMUNAL,
    ),
}

UNITES_TAUX = {"population": "pour_1000_habitants", "logements": "pour_1000_logements"}


def indicateur_taux(classe: str) -> str:
    return f"ssmsi_{CLASSES[classe][0]}_taux"


def indicateur_nombre(classe: str) -> str:
    return f"ssmsi_{CLASSES[classe][0]}_nombre"


def tous_les_indicateurs() -> list[str]:
    return [f(c) for c in CLASSES for f in (indicateur_taux, indicateur_nombre)]


def url_courante(titre_prefixe: str, format_: str) -> str:
    """L'URL du fichier change à chaque édition semestrielle : elle se lit dans
    le catalogue data.gouv au moment du run, jamais en dur."""
    catalogue = fetch(f"{API_DATAGOUV}/datasets/{DATASET_DATAGOUV}/", timeout=60).json()
    for ressource in catalogue["resources"]:
        if ressource["title"].startswith(titre_prefixe) and ressource.get("format") == format_:
            return ressource["url"]
    raise ValueError(f"ressource « {titre_prefixe} » ({format_}) absente du catalogue SSMSI")


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for classe, (_slug, libelle, publique, denominateur, communal) in CLASSES.items():
            niveaux = (
                ["commune", "departement", "region"] if communal else ["departement", "region"]
            )
            technique = (
                f"Base statistique SSMSI, classe « {classe} », unité de compte de la"
                f" source, dénominateur {denominateur} INSEE du millésime indiqué par"
                " la source. Faits enregistrés par police et gendarmerie : ni une"
                " mesure exhaustive de la délinquance, ni des condamnations."
            )
            for indicateur, libelle_complet, unite in (
                (indicateur_taux(classe), libelle, UNITES_TAUX[denominateur]),
                (indicateur_nombre(classe), f"{libelle} — nombre de faits", "count"),
            ):
                definition = curseur.execute(
                    """
                    insert into core.indicator_definitions
                        (public_definition, technical_definition, formula,
                         confidence_level, badges)
                    values (%s, %s, %s, 'observed', array['Officiel','Donnée brute'])
                    returning definition_id
                    """,
                    (publique, technique, f"SSMSI, base {classe}"),
                ).fetchone()[0]
                curseur.execute(
                    """
                    insert into core.indicators
                        (indicator_id, dataset_id, definition_id, theme, label_fr,
                         unit, additive, geo_levels, time_granularity, published)
                    values (%s, %s, %s, 'securite', %s, %s, %s, %s, 'annuelle', true)
                    on conflict (indicator_id) do update set
                        definition_id = excluded.definition_id,
                        label_fr = excluded.label_fr, theme = excluded.theme,
                        published = true
                    """,
                    (indicateur, DATASET, definition, libelle_complet, unite,
                     unite == "count", niveaux),
                )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def lire(
    lignes_texte: Iterable[str], niveau: str, seulement_derniere_annee: bool = False
) -> tuple[list[dict], dict, dict]:
    """CSV SSMSI (`;`) -> lignes vérifiées, écartées, couverture de diffusion.

    L'identité `taux = nombre / dénominateur × 1000` est recalculée ligne à
    ligne avec le dénominateur déclaré pour la classe : une ligne qui ne se
    referme pas est écartée et comptée — c'est elle qui détecterait un
    changement de dénominateur chez le producteur.
    """
    lecteur = csv.DictReader(lignes_texte, delimiter=";")
    colonne_code = COL_CODE[niveau]
    gardees: list[dict] = []
    ecartees: dict[str, object] = {}
    couverture: dict[str, dict[str, int]] = defaultdict(lambda: {"diff": 0, "ndiff": 0})
    annee_max = ""
    for rang in lecteur:
        classe = (rang.get("indicateur") or "").strip()
        if classe not in CLASSES:
            continue
        communal = CLASSES[classe][4]
        if niveau == "commune" and not communal:
            continue
        annee = (rang.get("annee") or "").strip()
        if seulement_derniere_annee:
            if annee > annee_max:
                # Nouvelle année plus récente : tout ce qui précède est
                # obsolète — lignes gardées, écartées et couverture comprises.
                # Sans la purge des écartées, le contrôle publiait le bruit
                # d'arrondi d'années qu'on ne charge même pas.
                annee_max = annee
                gardees = [g for g in gardees if g["annee"] == annee_max]
                ecartees = {
                    cle: motif for cle, motif in ecartees.items()
                    if cle.endswith(f"/{annee_max}")
                }
                for compte in couverture.values():
                    compte["diff"] = compte["ndiff"] = 0
            if annee < annee_max:
                continue
        code = (rang.get(colonne_code) or "").strip()
        if rang.get("est_diffuse", "diff").strip() == "ndiff" or rang.get("nombre") == "NA":
            couverture[classe]["ndiff"] += 1
            continue
        couverture[classe]["diff"] += 1
        try:
            nombre = int(rang["nombre"])
            taux = float(rang["taux_pour_mille"].replace(",", "."))
            denominateur = float(
                rang["insee_log"] if CLASSES[classe][3] == "logements" else rang["insee_pop"]
            )
        except (KeyError, ValueError):
            ecartees[f"{code}/{classe}/{annee}"] = "valeur illisible"
            continue
        if not denominateur:
            ecartees[f"{code}/{classe}/{annee}"] = "denominateur nul"
            continue
        recalcul = nombre / denominateur * 1000
        if abs(recalcul - taux) > TOLERANCE_TAUX:
            ecartees[f"{code}/{classe}/{annee}"] = (
                f"taux {taux} != {round(recalcul, 4)} ({CLASSES[classe][3]})"
            )
            continue
        gardees.append(
            {"classe": classe, "code": code, "annee": annee, "nombre": nombre, "taux": taux}
        )
    return gardees, ecartees, dict(couverture)


def est_arrondissement_municipal(code: str) -> bool:
    """Paris, Lyon et Marseille figurent dans la base **deux fois** : la commune
    entière (75056, 69123, 13055) et ses arrondissements (751xx, 6938x, 132xx).
    Les additionner ensemble compte deux fois les trois plus grandes villes —
    au premier chargement réel, la borne départementale écartait pour cela
    Paris, Lyon, Marseille et toutes les communes de leurs départements."""
    return (
        "13201" <= code <= "13216"
        or "69381" <= code <= "69389"
        or "75101" <= code <= "75120"
    )


def controler_somme_communale(
    communes: list[dict], departements: list[dict]
) -> tuple[list[dict], dict]:
    """Les faits diffusés des communes d'un département ne peuvent pas dépasser
    le total départemental de la même classe et de la même année. Une violation
    signale un défaut de lecture : les communes du couple sont écartées."""
    totaux = {
        (d["code"], d["classe"], d["annee"]): d["nombre"] for d in departements
    }
    sommes: dict[tuple, int] = defaultdict(int)
    for c in communes:
        if est_arrondissement_municipal(c["code"]):
            continue  # déjà compté dans le total de sa commune
        sommes[(c["code"][:3] if c["code"].startswith("97") else c["code"][:2],
                c["classe"], c["annee"])] += c["nombre"]
    fautifs = {
        cle: {"somme_communes": somme, "total_departement": totaux[cle]}
        for cle, somme in sommes.items()
        if cle in totaux and somme > totaux[cle]
    }
    if not fautifs:
        return communes, {}
    exclus = {(cle[0], cle[1], cle[2]) for cle in fautifs}
    gardees = [
        c for c in communes
        if (c["code"][:3] if c["code"].startswith("97") else c["code"][:2],
            c["classe"], c["annee"]) not in exclus
    ]
    return gardees, {f"{d}/{cl}/{an}": detail for (d, cl, an), detail in fautifs.items()}


def ecrire(conn, run_id: str, par_niveau: dict[str, list[dict]]) -> tuple[int, int, int]:
    candidates = []
    for niveau, lignes in par_niveau.items():
        for ligne in lignes:
            candidates.append(
                (indicateur_taux(ligne["classe"]), niveau, ligne["code"], ligne["annee"],
                 ligne["taux"])
            )
            candidates.append(
                (indicateur_nombre(ligne["classe"]), niveau, ligne["code"], ligne["annee"],
                 ligne["nombre"])
            )
    gardees, hors_referentiel = filtrer_territoires_connus(conn, candidates)
    ecrites, revisees = revisions.remplacer(
        conn, run_id, tous_les_indicateurs(), ("value",),
        (
            (cle, niveau, code, MILLESIME, periode, valeur)
            for cle, niveau, code, periode, valeur in gardees
        ),
    )
    return ecrites, len(hors_referentiel), revisees


def run(store_spec: str) -> int:
    conn = db.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = db.start_run(conn, DATASET, "manual")
    try:
        taille = garde_fou_volume(conn)
        par_niveau: dict[str, list[dict]] = {}
        ecartees_total: dict[str, object] = {}
        couvertures: dict[str, dict] = {}

        url_com = url_courante("COM - Base statistique communale", "csv.gz")
        contenu_com = fetch(url_com, timeout=900).content
        db.record_asset(
            conn, store, run_id, DATASET, SOURCE, "delinquance-communale.csv.gz",
            contenu_com, url_com, "application/gzip",
        )
        texte = io.TextIOWrapper(io.BytesIO(gzip.decompress(contenu_com)), encoding="utf-8-sig")
        par_niveau["commune"], ecartees, couvertures["commune"] = lire(
            texte, "commune", seulement_derniere_annee=True
        )
        ecartees_total.update(ecartees)

        for niveau, prefixe in (
            ("departement", "DEP - Base statistique départementale"),
            ("region", "REG - Base statistique régionale"),
        ):
            url = url_courante(prefixe, "csv")
            contenu = fetch(url, timeout=300).content
            db.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"delinquance-{niveau}.csv",
                contenu, url, "text/csv",
            )
            par_niveau[niveau], ecartees, couvertures[niveau] = lire(
                io.TextIOWrapper(io.BytesIO(contenu), encoding="utf-8-sig"), niveau
            )
            ecartees_total.update(ecartees)

        if not par_niveau["commune"] or not par_niveau["departement"]:
            raise ValueError("base SSMSI vide après lecture : le format a dû changer")

        par_niveau["commune"], depassements = controler_somme_communale(
            par_niveau["commune"], par_niveau["departement"]
        )

        ecrites, hors_referentiel, revisees = ecrire(conn, run_id, par_niveau)

        annee_communale = max(ligne["annee"] for ligne in par_niveau["commune"])
        diffusion = {
            classe: round(
                compte["diff"] / (compte["diff"] + compte["ndiff"]) * 100, 1
            )
            for classe, compte in couvertures["commune"].items()
            if compte["diff"] + compte["ndiff"]
        }
        with conn.cursor() as curseur:
            curseur.execute(
                """
                insert into meta.data_quality_checks
                    (run_id, dataset_id, check_name, severity, passed, observed)
                values (%s, %s, 'identite_taux_egal_nombre_sur_denominateur', %s, %s, %s)
                """,
                (run_id, DATASET, "warning" if ecartees_total else "info",
                 not ecartees_total,
                 Jsonb({"ecartees": dict(list(ecartees_total.items())[:20]),
                        "total": len(ecartees_total)})),
            )
            curseur.execute(
                """
                insert into meta.data_quality_checks
                    (run_id, dataset_id, check_name, severity, passed, observed)
                values (%s, %s, 'somme_des_communes_bornee_par_le_departement', %s, %s, %s)
                """,
                (run_id, DATASET, "warning" if depassements else "info", not depassements,
                 Jsonb(dict(list(depassements.items())[:10]))),
            )
            curseur.execute(
                """
                insert into meta.data_quality_checks
                    (run_id, dataset_id, check_name, severity, passed, observed)
                values (%s, %s, 'couverture_diffusion_communale', 'info', true, %s)
                """,
                (run_id, DATASET,
                 Jsonb({"annee": annee_communale, "pct_diffuse_par_classe": diffusion})),
            )
        conn.commit()
        db.finish_run(
            conn, run_id, "success",
            rows_read=sum(len(v) for v in par_niveau.values()), rows_written=ecrites,
        )
        apres = conn.execute("select pg_database_size(current_database())").fetchone()[0]
        print(
            f"sécurité : {ecrites} observations ({annee_communale} au niveau communal),"
            f" {len(ecartees_total)} lignes écartées, {len(depassements)} couples"
            f" commune-département écartés, {hors_referentiel} hors référentiel,"
            f" {revisees} valeurs révisées"
        )
        print(f"volume base : {taille // 1024 // 1024} -> {apres // 1024 // 1024} Mo")
        print("diffusion communale (%) :", json.dumps(diffusion, ensure_ascii=False))
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        db.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
