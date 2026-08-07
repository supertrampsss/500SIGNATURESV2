"""Établissements employeurs et salariés par grand secteur (INSEE, FLORES).

« De quoi vit ma commune ? » — le site savait dire combien d'établissements y
sont présents, pas ce qu'on y fait ni combien de personnes y travaillent. Ce
module apporte les deux, ventilés en cinq grands secteurs. Trois mots doivent
être tenus, faute de quoi le chiffre publié contredirait ceux déjà en ligne.

**Employeur n'est pas actif.** Le site publie déjà les établissements actifs :
6 625 344 en France en 2024. Ce jeu-ci n'en compte que 2 411 570, parce qu'il
retient les seuls établissements qui ont employé quelqu'un dans l'année. Près de
deux tiers des établissements actifs n'emploient personne — auto-entrepreneurs,
sociétés sans salarié, holdings. Les deux chiffres sont justes, aucun ne remplace
l'autre, et chaque fiche nomme celui d'à côté.

**Un poste n'est pas une personne.** L'effectif compte les postes présents la
dernière semaine de décembre : une personne qui occupe deux emplois salariés est
comptée deux fois, un emploi à mi-temps compte pour un. Ce n'est ni un équivalent
temps plein ni un nombre d'habitants qui travaillent.

**Le lieu de travail, pas le domicile.** Un établissement et ses postes sont
comptés là où ils sont, quand les actifs du recensement — déjà publiés — sont
comptés là où ils habitent. Une commune de bureaux compte des milliers de
salariés qui n'y dorment pas ; une commune-dortoir fait l'inverse. Rapporter ces
salariés à la population du territoire ne donne donc pas un taux d'emploi.

**Les contrôles qui bloquent.** Deux identités de la source, vérifiées au moment
d'écrire ce module. Les cinq secteurs font le total, pour chaque mesure et
chaque territoire : 69 980 vérifications, écart nul. Et les communes, les
départements et les régions font chacun la France entière : 2 411 570
établissements et 26 604 745 postes, à l'unité près sur les trois mailles. La
première attrape un détail lu comme un total, la seconde un territoire tombé.

Usage : python -m plateforme.normalize.secteurs [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import zipfile

from plateforme import couverture, entrepot
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-flores-a5"
SOURCE = "insee-melodi"
JEU = "DS_FLORES_A5"
URL = "https://api.insee.fr/melodi/file/DS_FLORES_A5/DS_FLORES_A5_2024_CSV_FR"

NIVEAUX = {"COM": "commune", "DEP": "departement", "REG": "region"}
TOTAL = "_T"

# France entière, Mayotte comprise — et non « FM », la métropole, qui vaut
# 2 344 770 établissements contre 2 411 570. Les deux sont dans le fichier sous
# le même `GEO_OBJECT` : prendre la mauvaise ferait manquer les communes
# d'outre-mer, qui sont chargées.
FRANCE = "F"

# La seule forme légale publiée, et le filtre est explicite : si la source
# ventilait un jour les versants de la fonction publique à côté de leur
# ensemble, une lecture sans filtre compterait deux fois les mêmes postes.
FORME = "1T9X7"

# Les tranches d'effectifs sont servies avec leur total sur la même dimension.
# Seul le total est lu — les neuf tranches somment au total, et les charger
# reviendrait à compter chaque établissement deux fois.
TRANCHE = "_T"

MESURES = {
    "UNIT_LOC": ("insee_etablissements_employeurs", "Établissements employeurs",
                 "entreprises", "établissements employeurs", "secteurs_etablissements"),
    "EMPL3112": ("insee_effectifs_salaries", "Effectifs salariés",
                 "entreprises", "postes salariés au 31 décembre", "secteurs_salaries"),
}

# Secteur A5 -> (suffixe d'identifiant, libellé, ce que le secteur contient).
SECTEURS = {
    "AZ": ("agriculture", "Agriculture, sylviculture et pêche",
           "exploitations agricoles, sylviculture, pêche et aquaculture"),
    "BE": ("industrie", "Industrie",
           "usines et ateliers, industries extractives, énergie, eau et déchets"),
    "FZ": ("construction", "Construction",
           "bâtiment et travaux publics"),
    "GU": ("services_marchands", "Services principalement marchands",
           "commerce, transport, hébergement, information, finance, immobilier"
           " et services aux entreprises"),
    "OQ": ("administration_sante_social",
           "Administration, enseignement, santé et action sociale",
           "administration publique, écoles, hôpitaux et action sociale,"
           " publics comme privés"),
}

DRAPEAU_REGROUPEMENT = "inclut_une_commune_rattachee"
STATUTS_REGROUPES = {"W"}

TOLERANCE = 0.5

PUBLIQUE = {
    "insee_etablissements_employeurs": "Le nombre d'établissements qui ont employé au"
    " moins un salarié dans l'année : magasins, ateliers, bureaux, chantiers. Ce n'est"
    " pas le nombre d'établissements actifs, publié à côté et près de trois fois plus"
    " élevé : la plupart des établissements n'emploient personne.",
    "insee_effectifs_salaries": "Le nombre de postes salariés présents sur le territoire"
    " la dernière semaine de décembre, comptés là où l'on travaille et non là où l'on"
    " habite. Une personne qui occupe deux postes est comptée deux fois.",
}

TECHNIQUE = (
    "Fichier localisé des rémunérations et de l'emploi salarié (FLORES), millésime"
    " 2024, en cinq grands secteurs d'activité (nomenclature A5). Champ :"
    " établissements employeurs durant l'année et actifs la dernière semaine de"
    " décembre, hors secteur de la défense et hors particuliers employeurs, France"
    " entière — Mayotte comprise, contrairement aux jeux du recensement publiés ici."
    " L'unité de compte des effectifs est le poste, pas la personne ni l'équivalent"
    " temps plein : un salarié qui occupe deux postes est compté deux fois, un"
    " mi-temps compte pour un. Les établissements sont comptés au lieu de travail,"
    " comme les postes, et non au domicile du salarié ni au siège de l'entreprise :"
    " ces effectifs ne sont donc pas comparables aux actifs du recensement, comptés"
    " au lieu de résidence, et ne se rapportent pas à la population du territoire."
    " Un établissement peut être employeur et n'avoir aucun salarié la dernière"
    " semaine de décembre : 259 789 sont dans ce cas en 2024, soit 10,8 % du total."
    " Un seul millésime est publié : la source déclare que la comparabilité entre"
    " deux millésimes n'est pas garantie, faute de quoi une série serait fabriquée"
    " ici. La source recommande la prudence sur les petits effectifs aux mailles"
    " fines. Les communes issues d'une scission postérieure à la production des"
    " données sont décrites sur leur périmètre d'avant scission."
)


class IdentiteRompue(RuntimeError):
    """Une somme de la source ne fait plus son total."""


class TotalIncoherent(RuntimeError):
    """Une maille entière ne fait plus le total France."""


def identifiant(mesure: str, secteur: str | None) -> str:
    """L'identifiant publié pour un couple (mesure, secteur). `None` = tous secteurs."""
    racine = MESURES[mesure][0]
    return racine if secteur is None else f"{racine}_{SECTEURS[secteur][0]}"


def lire(archive: bytes) -> list[dict]:
    """CSV zippé de FLORES -> une valeur par territoire, mesure et secteur."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            objet, geo, mesure = (
                colonne["GEO_OBJECT"], colonne["GEO"], colonne["FLORES_MEASURE"],
            )
            activite, forme, tranche = (
                colonne["ACTIVITY"], colonne["LEGAL_FORM_WITH_PUBLIC"],
                colonne["NUMBER_EMPL"],
            )
            periode, valeur, statut = (
                colonne["TIME_PERIOD"], colonne["OBS_VALUE"], colonne["OBS_STATUS"],
            )
            return [
                {
                    "niveau": NIVEAUX[rang[objet]],
                    "code": rang[geo],
                    "periode": rang[periode],
                    "mesure": rang[mesure],
                    "secteur": rang[activite],
                    "valeur": float(rang[valeur]),
                    "drapeaux": (
                        [DRAPEAU_REGROUPEMENT]
                        if rang[statut] in STATUTS_REGROUPES
                        else []
                    ),
                }
                for rang in lecteur
                if rang[objet] in NIVEAUX
                and rang[forme] == FORME
                and rang[tranche] == TRANCHE
                and rang[mesure] in MESURES
                and (rang[activite] in SECTEURS or rang[activite] == TOTAL)
                and rang[valeur]
            ]


def controler(lignes: list[dict], tolerance: float = TOLERANCE) -> dict[str, int]:
    """Les cinq secteurs font le total, mesure par mesure et territoire par
    territoire. Lève au premier écart.

    C'est le contrôle qui attraperait une hiérarchie servie à plat : lire le
    détail *et* le total compterait chaque établissement deux fois, et la somme
    des parts vaudrait alors le double du total publié.

    **Un groupe incomplet est une identité rompue, pas un cas à sauter.** Un
    territoire qui a son total mais perd un secteur passerait sans bruit : ses
    onze autres indicateurs seraient publiés, le contrôle des mailles ne somme
    que les totaux et ne verrait rien, et un secteur manquerait sur la fiche
    sans que rien ne l'ait signalé. La source sert les six lignes pour les
    41 770 territoires qu'elle publie — mesuré au chargement du 6 août, aucun
    groupe incomplet — et un jour où ce ne serait plus vrai est un jour où il
    faut regarder, pas continuer.
    """
    table: dict[tuple, dict[str, float]] = {}
    for ligne in lignes:
        cle = (ligne["niveau"], ligne["code"], ligne["periode"], ligne["mesure"])
        table.setdefault(cle, {})[ligne["secteur"]] = ligne["valeur"]
    verifies = 0
    for (niveau, code, periode, mesure), valeurs in table.items():
        manquants = [s for s in (TOTAL, *SECTEURS) if s not in valeurs]
        if manquants:
            raise IdentiteRompue(
                f"groupe incomplet : {niveau} {code} en {periode}, mesure {mesure},"
                f" n'a pas {', '.join(manquants)}. Les secteurs publiés seraient"
                " amputés sans que la somme des mailles le montre."
            )
        ecart = sum(valeurs[s] for s in SECTEURS) - valeurs[TOTAL]
        if abs(ecart) > tolerance:
            raise IdentiteRompue(
                f"les cinq secteurs ne font pas le total : {niveau} {code} en"
                f" {periode}, mesure {mesure}, s'écarte de {ecart:+.0f}"
                f" ({sum(valeurs[s] for s in SECTEURS):.0f} contre {valeurs[TOTAL]:.0f})."
            )
        verifies += 1
    if not verifies:
        raise IdentiteRompue("aucun territoire n'a pu être vérifié")
    return {"les_cinq_secteurs_font_le_total": verifies}


def controler_totaux(
    lignes: list[dict], totaux: dict[str, float], tolerance: float = TOLERANCE
) -> dict[str, dict[str, float]]:
    """Chaque maille chargée fait la France entière, mesure par mesure.

    Les trois mailles couvrent le même territoire : une somme qui décroche
    signale un code tombé du référentiel ou un zonage lu par erreur, ce
    qu'aucun total pris isolément ne montrerait.
    """
    sommes: dict[str, dict[str, float]] = {}
    for ligne in lignes:
        if ligne["secteur"] != TOTAL:
            continue
        sommes.setdefault(ligne["mesure"], {}).setdefault(ligne["niveau"], 0.0)
        sommes[ligne["mesure"]][ligne["niveau"]] += ligne["valeur"]
    for mesure, total in totaux.items():
        for niveau, somme in sorted(sommes.get(mesure, {}).items()):
            if abs(somme - total) > tolerance:
                raise TotalIncoherent(
                    f"la somme des {niveau}s ne fait pas le total France pour"
                    f" {mesure} : {somme:.0f} contre {total:.0f}"
                    f" ({somme - total:+.0f}). Un territoire n'est plus rattaché."
                )
    return sommes


def totaux_france(archive: bytes) -> dict[str, float]:
    """{mesure: total France entière} — le repère des contrôles de somme."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zip_:
        nom = next(n for n in zip_.namelist() if n.endswith("_data.csv"))
        with zip_.open(nom) as fichier:
            lecteur = csv.reader(
                io.TextIOWrapper(fichier, encoding="utf-8"), delimiter=";"
            )
            colonne = {nom_: rang for rang, nom_ in enumerate(next(lecteur))}
            return {
                rang[colonne["FLORES_MEASURE"]]: float(rang[colonne["OBS_VALUE"]])
                for rang in lecteur
                if rang[colonne["GEO_OBJECT"]] == "FRANCE"
                and rang[colonne["GEO"]] == FRANCE
                and rang[colonne["LEGAL_FORM_WITH_PUBLIC"]] == FORME
                and rang[colonne["NUMBER_EMPL"]] == TRANCHE
                and rang[colonne["ACTIVITY"]] == TOTAL
                and rang[colonne["FLORES_MEASURE"]] in MESURES
                and rang[colonne["OBS_VALUE"]]
            }


def fiches() -> dict[str, dict[str, str]]:
    """{identifiant: {libelle, theme, public, formule, unite}} — tout ce qui est publié."""
    publiees = {}
    for mesure, (_, libelle, theme, unite, theme_secteur) in MESURES.items():
        publiees[identifiant(mesure, None)] = {
            "libelle": libelle,
            "theme": theme,
            "public": PUBLIQUE[identifiant(mesure, None)],
            "formule": f"Nombre de « {libelle} », tous secteurs d'activité",
            "unite": unite,
        }
        for secteur, (_, nom, contenu) in SECTEURS.items():
            publiees[identifiant(mesure, secteur)] = {
                "libelle": nom,
                "theme": theme_secteur,
                "public": (
                    f"Les établissements employeurs du secteur « {nom} » — {contenu} —"
                    " comptés là où ils travaillent, et non au siège de l'entreprise."
                    if mesure == "UNIT_LOC"
                    else f"Les postes salariés du secteur « {nom} » — {contenu} —"
                    " comptés sur le lieu de travail. Une personne qui occupe deux"
                    " postes est comptée deux fois."
                ),
                "formule": f"Nombre de « {libelle} » du secteur A5 « {nom} »",
                "unite": unite,
            }
    return publiees


def valeurs_publiees(lignes: list[dict]) -> list[tuple]:
    """-> [(indicateur, niveau, code, période, valeur, drapeaux)]."""
    return [
        (
            identifiant(ligne["mesure"], None if ligne["secteur"] == TOTAL else ligne["secteur"]),
            ligne["niveau"], ligne["code"], ligne["periode"], ligne["valeur"],
            ligne["drapeaux"],
        )
        for ligne in lignes
    ]


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for cle, fiche in fiches().items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (fiche["public"], TECHNIQUE, fiche["formule"], fiche["unite"]),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'count', true,
                        array['commune','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (cle, DATASET, definition, fiche["theme"], fiche["libelle"]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def etablissements_par_maille(candidates) -> dict[str, float]:
    """Combien d'établissements employeurs porte chaque maille, tous secteurs.

    Sert des deux côtés du contrôle de couverture : sur ce que la source a
    donné, puis sur ce que le référentiel a reconnu. Comptés en établissements
    et non en codes — trois codes perdus ne pèsent rien s'ils portent trois
    établissements, et tout s'ils portent Paris.
    """
    total = MESURES["UNIT_LOC"][0]
    par_maille: dict[str, float] = {}
    for cle, niveau, _, _, valeur in candidates:
        if cle == total:
            par_maille[niveau] = par_maille.get(niveau, 0.0) + valeur
    return par_maille


def ecrire(conn, run_id: str, lignes: list[dict]) -> tuple[int, int, dict[str, float]]:
    """Renvoie aussi, par maille, les établissements **réellement écrits**.

    `filtrer_territoires_connus` écarte sans bruit ce que le référentiel ignore :
    c'est ce silence que le contrôle de couverture mesure.
    """
    valeurs = valeurs_publiees(lignes)
    candidates = [(cle, niveau, code, periode, valeur)
                  for cle, niveau, code, periode, valeur, _ in valeurs]
    drapeaux = {
        (cle, niveau, code, periode): marques
        for cle, niveau, code, periode, _, marques in valeurs
        if marques
    }
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = list(fiches())
    with conn.cursor() as curseur:
        curseur.execute(
            "delete from core.observations where indicator_id = any(?)", (noms,)
        )
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "quality_flags", "run_id"],
            (
                (cle, niveau, code, MILLESIME, periode, valeur,
                 drapeaux.get((cle, niveau, code, periode), []), run_id)
                for cle, niveau, code, periode, valeur in gardees
            ),
        )
    return len(gardees), len(ecartes), etablissements_par_maille(gardees)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        archive = telecharger(URL, timeout=900)
        entrepot.etape(f"archive de {len(archive) / 1e6:.0f} Mo téléchargée")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "flores-a5.zip", archive, URL,
            "application/zip",
        )
        lignes = lire(archive)
        entrepot.etape(f"{len(lignes)} lignes lues")
        if not lignes:
            raise ValueError("aucun établissement lu")
        verifies = controler(lignes)
        totaux = totaux_france(archive)
        if set(totaux) != set(MESURES):
            raise TotalIncoherent(f"totaux France incomplets : {sorted(totaux)}")
        sommes = controler_totaux(lignes, totaux)
        ecrites, ecartes, reconnus = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        # Après l'écriture, avant la validation : un refus laisse l'entrepôt
        # intact. Les identités ci-dessus comparent la source à elle-même et ne
        # verraient pas des codes qui ratent le référentiel — ce contrôle-ci le
        # voit, en établissements et non en codes.
        parts = couverture.controler(sommes["UNIT_LOC"], reconnus)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'identites_des_secteurs_et_couverture', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "france_entiere": {m: round(v) for m, v in sorted(totaux.items())},
                "sommes_par_maille": {
                    m: {n: round(s) for n, s in sorted(niveaux.items())}
                    for m, niveaux in sorted(sommes.items())
                },
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
                "hors_referentiel": ecartes,
            })),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        print(
            f"secteurs d'activité : {ecrites} observations, {len(fiches())} indicateurs,"
            f" {ecartes} hors référentiel ; France entière :"
            f" {totaux['UNIT_LOC']:.0f} établissements employeurs,"
            f" {totaux['EMPL3112']:.0f} postes salariés"
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
