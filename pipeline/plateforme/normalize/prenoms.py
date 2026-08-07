"""Prénoms attribués aux nouveau-nés (INSEE) — ce qui se charge, et ce qui ne
se charge pas encore.

Le fichier des prénoms est le jeu ouvert le plus consulté de l'INSEE : pour
chaque année depuis 1900, chaque département et chaque sexe, le nombre de
naissances portant chaque prénom. Ce module en tire l'effectif du **prénom le
plus donné**, garçons et filles séparément, du département à la France.

**Le prénom lui-même n'est pas publié, et c'est une limite du modèle, pas un
choix.** Un indicateur de ce site porte une valeur numérique ; « Gabriel » est
une chaîne, et il n'existe aujourd'hui aucune place pour un fait textuel attaché
à un territoire. Ce module publie donc combien d'enfants portent le prénom de
tête, sans pouvoir dire lequel. Le publier demanderait d'ouvrir le modèle à des
faits textuels — décision qui dépasse ce chargement, et qui est écrite dans le
plan plutôt que contournée par un bricolage.

**Les effectifs départementaux sont arrondis à la dizaine.** C'est la source qui
arrondit, pour protéger le secret : 130 naissances en Gironde signifie « entre
125 et 134 », pas 130. Un écart de dix entre deux départements ne veut donc rien
dire, et la fiche l'écrit.

**Un prénom trop rare n'apparaît pas du tout.** La source ne diffuse un prénom
dans un département que s'il y est assez fréquent ; les autres sont regroupés
hors nomenclature. Cela ne touche pas le prénom de tête, mais interdit de lire
ces chiffres comme un dénombrement complet des naissances.

**Le contrôle qui bloque.** Le rang est une affirmation de la source, et ce
module en dépend entièrement : si `RANK` ne voulait pas dire ce qu'on croit,
l'indicateur publierait l'effectif d'un prénom quelconque. Le contrôle compare
donc le premier au second — l'effectif du rang 1 ne peut pas être inférieur à
celui du rang 2 — sur chaque territoire, sexe et année où les deux existent.

Usage : python -m plateforme.normalize.prenoms [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme.connectors import melodi
from plateforme.connectors.insee import MELODI_BASE, clean_geo
from plateforme import entrepot, revisions
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store

DATASET = "melodi-prenoms"
SOURCE = "insee-melodi"
JEU = "DS_PRENOM"

PREMIER, SECOND = "1", "2"

# Préfixe de zonage -> niveau du référentiel. La France entière entre aussi :
# elle nourrit la fiche nationale, où les séries longues ont leur place.
NIVEAUX = {"DEP": "departement", "REG": "region", "FRANCE": "pays"}

# Sexe -> (identifiant, libellé, fiche publique).
SEXES = {
    "M": (
        "insee_prenom_premier_effectif_garcons",
        "Naissances portant le prénom de garçon le plus donné",
        "Combien de garçons ont reçu, cette année-là et sur ce territoire, le prénom"
        " masculin le plus attribué. La source arrondit ces effectifs à la dizaine au"
        " département : un écart de dix ne veut rien dire.",
    ),
    "F": (
        "insee_prenom_premier_effectif_filles",
        "Naissances portant le prénom de fille le plus donné",
        "Combien de filles ont reçu, cette année-là et sur ce territoire, le prénom"
        " féminin le plus attribué. La source arrondit ces effectifs à la dizaine au"
        " département : un écart de dix ne veut rien dire.",
    ),
}

THEME = "prenoms"
COLONNES = ("value",)

TECHNIQUE = (
    "Fichier des prénoms de l'INSEE, naissances domiciliées en France, par année,"
    " département et sexe. La valeur publiée est l'effectif du prénom de rang 1,"
    " c'est-à-dire du prénom le plus attribué sur ce territoire cette année-là ; le"
    " prénom lui-même n'est pas publié, le modèle d'indicateurs de ce site ne"
    " portant que des valeurs numériques. Les effectifs départementaux sont arrondis"
    " à la dizaine par la source, au titre du secret statistique : un écart de dix"
    " entre deux territoires n'est pas interprétable. Un prénom trop rare dans un"
    " département n'est pas diffusé et se retrouve regroupé hors nomenclature ; ces"
    " chiffres ne sont donc pas un dénombrement complet des naissances, et ne"
    " doivent pas être lus comme tels. Le rang est celui que la source publie ; le"
    " chargement vérifie qu'il ordonne bien les effectifs en comparant le premier"
    " prénom au second."
)


class RangIncoherent(RuntimeError):
    """Le rang publié n'ordonne plus les effectifs."""


def url(rang: str) -> str:
    return f"{MELODI_BASE}/data/{JEU}?RANK={rang}&maxResult=10000"


def lire(observations: list[dict]) -> dict[tuple, float]:
    """-> {(niveau, code, période, sexe): effectif}.

    Les zonages sans équivalent dans le référentiel sont écartés ici : la source
    en publie d'autres que le département, la région et la France.
    """
    lignes: dict[tuple, float] = {}
    for observation in observations:
        dimensions = observation.get("dimensions", {})
        brut = dimensions.get("GEO", "")
        morceaux = brut.split("-")
        niveau = NIVEAUX.get(morceaux[1]) if len(morceaux) > 2 else None
        sexe = dimensions.get("SEX")
        if niveau is None or sexe not in SEXES:
            continue
        valeur = (
            observation.get("measures", {}).get("OBS_VALUE_NIVEAU") or {}
        ).get("value")
        if valeur is None:
            continue
        code = "FR" if niveau == "pays" else clean_geo(brut)
        lignes[(niveau, code, dimensions["TIME_PERIOD"], sexe)] = float(valeur)
    return lignes


def controler(premiers: dict[tuple, float], seconds: dict[tuple, float]) -> dict[str, int]:
    """L'effectif du rang 1 ne descend pas sous celui du rang 2.

    Tout ce module repose sur le sens de `RANK` : sans ce contrôle, un rang qui
    signifierait autre chose ferait publier l'effectif d'un prénom quelconque
    sous le nom de « prénom le plus donné », et rien ne le signalerait.
    """
    if not premiers:
        raise RangIncoherent("aucun prénom de rang 1 : la requête n'a rien rendu")
    communs = sorted(set(premiers) & set(seconds))
    if not communs:
        raise RangIncoherent(
            "aucun couple rang 1 / rang 2 à comparer : le contrôle ne contrôle rien"
        )
    for cle in communs:
        if premiers[cle] < seconds[cle]:
            niveau, code, periode, sexe = cle
            raise RangIncoherent(
                f"{niveau} {code} en {periode} ({sexe}) : le prénom de rang 1 compte"
                f" {premiers[cle]:.0f} naissances contre {seconds[cle]:.0f} pour le"
                " rang 2. Le rang n'ordonne pas les effectifs."
            )
    return {"le_rang_un_domine_le_rang_deux": len(communs)}


def lignes_a_ecrire(premiers: dict[tuple, float]) -> list[tuple]:
    return [
        (SEXES[sexe][0], niveau, code, MILLESIME, periode, valeur)
        for (niveau, code, periode, sexe), valeur in sorted(premiers.items())
    ]


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for _, (identifiant, libelle, publique) in sorted(SEXES.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, 'Effectif du prénom de rang 1', 'naissances',
                        'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (publique, TECHNIQUE),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, 'count', false,
                        array['departement','region','pays'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (identifiant, DATASET, definition, THEME, libelle),
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
    garde_fou_volume(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        lus = {}
        for rang in (PREMIER, SECOND):
            observations = melodi.pages(JEU, {"RANK": rang}, page_max=8)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"prenoms-rang-{rang}.json",
                json.dumps({"observations": observations}, ensure_ascii=False).encode(),
                url(rang), "application/json",
            )
            lus[rang] = lire(observations)
            entrepot.etape(f"rang {rang} : {len(lus[rang])} territoires-années")
        verifies = controler(lus[PREMIER], lus[SECOND])
        lignes = lignes_a_ecrire(lus[PREMIER])
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [s[0] for s in SEXES.values()], COLONNES, lignes
        )
        periodes = sorted({cle[2] for cle in lus[PREMIER]})
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'le_rang_un_domine_le_rang_deux', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "premiere_annee": periodes[0],
                "derniere_annee": periodes[-1],
                "territoires": len({(cle[0], cle[1]) for cle in lus[PREMIER]}),
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lus[PREMIER]), rows_written=ecrites
        )
        print(
            f"prénoms : {ecrites} observations, {periodes[0]} à {periodes[-1]},"
            f" {revisees} valeurs révisées ;"
            f" {verifies['le_rang_un_domine_le_rang_deux']} rangs vérifiés"
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
