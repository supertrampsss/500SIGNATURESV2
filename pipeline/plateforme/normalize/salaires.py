"""Salaires du privé au lieu de travail (INSEE, base Tous salariés).

« Combien gagne-t-on ici ? » n'avait pas de réponse sur ce site. Ce module en
donne une, et elle n'est pas celle qu'on croit : le chiffre publié est le
**salaire net mensuel moyen en équivalent temps plein des salariés du privé, au
lieu de travail**. Cinq réserves gouvernent sa lecture, et chacune est une
raison de se tromper.

**Au lieu de travail, pas de résidence.** Une commune d'emploi affiche le
salaire de ceux qui y travaillent, jamais de ceux qui y vivent. La Défense paie
des cadres qui habitent ailleurs ; un village-dortoir n'affiche que les salaires
de sa boulangerie. C'est l'inverse du niveau de vie médian déjà publié ici
(Filosofi, au lieu de résidence), et les deux ne se comparent pas.

**La moyenne, et rien d'autre.** La source ne diffuse pas de médiane à ce niveau
géographique : `DERA_MEASURE=...MEDIANE` renvoie une erreur. Une moyenne de
salaires est tirée par le haut par les rémunérations élevées, et il n'existe
aucun substitut — surtout pas le niveau de vie de Filosofi, qui mesure un revenu
disponible par unité de consommation, pas un salaire.

**Le secret statistique, deux fois.** Les zones de moins de 2 000 habitants ne
sont pas diffusées du tout : elles sont **absentes**, pas nulles, et seules
5 461 communes sur les 34 875 du Code officiel géographique 2025 sont servies —
5 579 territoires en tout aux quatre mailles publiées ici, sur les 12 368 que le
jeu couvre tous zonages confondus. Certaines zones au-dessus du seuil sont
en plus *blanchies* — la source les liste avec `CONF_STATUS = "C"` et sans
valeur. Celles-là sont écrites comme des observations `confidential` : le secret
est une ligne, pas une absence (docs/02 §F). Le contrôle de couverture se mesure
donc sur ce que la source sert, jamais sur le référentiel entier.

**Deux millésimes, jamais empilés.** Chaque parution porte l'année N et l'année
N-1 rétropolée à méthode constante : le 2022 servi aujourd'hui n'est pas le 2022
publié l'an dernier. Le chargement remplace les deux années à chaque run plutôt
que d'ajouter la nouvelle à côté des anciennes.

**Euros courants.** Aucune déflation : une hausse entre 2022 et 2023 mêle
salaires et prix.

**Le nom du total national est trompeur, et il y en a deux.** La source publie
`2025-FRANCE-FM` *et* `2025-FRANCE-F`. `FM` est la France métropolitaine
(2 742,43 € en 2023) ; `F` est le champ complet du jeu, France hors Mayotte
(2 734,76 €), le seul cohérent avec les départements et régions publiés ici, qui
incluent la Guadeloupe, la Martinique, la Guyane et La Réunion. C'est `F` qui
devient le pays `FR` ; `FM` est écarté, faute de territoire correspondant au
référentiel.

**Le contrôle qui bloque.** Paris est à la fois une commune et un département :
`2025-COM-75056` et `2025-DEP-75` doivent porter la même valeur au centième
près, année après année. Un millésime géographique qui glisse ou un préfixe mal
lu casse cette égalité immédiatement, là où aucun total interne à la source ne
le verrait.

Le thème est `emploi` et non `revenus` : ce chiffre décrit les emplois situés
sur le territoire, pas les revenus de ses habitants. L'afficher à côté du niveau
de vie médian inviterait précisément la confusion que la première réserve
interdit.

Usage : python -m plateforme.normalize.salaires [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import couverture, entrepot, revisions
from plateforme.connectors import melodi
from plateforme.connectors.insee import MELODI_BASE, clean_geo
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "melodi-salaires-eqtp"
SOURCE = "insee-melodi"
JEU = "DS_BTS_SAL_EQTP_SEX_AGE"

# La seule mesure du jeu. La médiane n'existe pas : la demander renvoie 400.
MESURE = "SALAIRE_NET_EQTP_MENSUEL_MOYENNE"

TOUS = "_T"  # valeur du total, pour SEX comme pour AGE
FEMMES, HOMMES = "F", "M"
SEXES = (TOUS, FEMMES, HOMMES)

# Statut de confidentialité de l'observation. `LIBRE` vaut « F » comme le sexe
# féminin vaut « F » : deux dimensions, deux codes homonymes, et une confusion
# qui publierait les salaires des femmes sous le nom de tout le monde.
LIBRE, BLANCHI = "F", "C"

# Préfixes de zonage retenus. Le jeu en publie huit autres — aires
# d'attraction, bassins de vie, unités urbaines, zones d'emploi, EPCI,
# arrondissements, arrondissements municipaux : aucun n'a d'équivalent dans le
# référentiel du site.
NIVEAUX = {"COM": "commune", "DEP": "departement", "REG": "region"}
FRANCE_HORS_MAYOTTE = "F"
FRANCE_METROPOLE = "FM"
PAYS = "FR"

# La source sert onze communes **deux fois** — 06018, 13019, 31547, 33312,
# 44015, 44209, 56165, 58086, 74298, 83016, 87050 —, la même valeur à deux
# précisions : 2 038,779062 et 2 038,77906173258. Sans arrondi, laquelle des
# deux l'emporte dépend de l'ordre des pages, et chaque rechargement archiverait
# une révision qui n'en est pas une. Six décimales sont la précision de toutes
# les autres observations du jeu : l'arrondi fait coïncider les jumelles sans
# toucher à rien d'autre.
DECIMALES = 6

SALAIRE = "insee_salaire_net_eqtp_mensuel"
ECART = "insee_ecart_salaire_femmes_hommes"

INDICATEURS = {
    SALAIRE: {
        "libelle": "Salaire net mensuel moyen (équivalent temps plein)",
        "unite": "EUR",
        "public": "Le salaire net moyen d'un salarié du privé à temps plein, là où"
        " il travaille et non là où il vit. Une commune d'emploi affiche donc le"
        " salaire de ceux qui y viennent travailler. En euros courants par mois,"
        " non corrigés de l'inflation.",
        "formule": "Salaire net moyen en équivalent temps plein, tous âges et tous sexes",
        "notes": "euros courants par mois, équivalent temps plein",
    },
    ECART: {
        "libelle": "Écart de salaire entre femmes et hommes",
        "unite": "percent",
        "public": "De combien le salaire moyen des hommes dépasse celui des femmes,"
        " en pourcentage, sur ce territoire. C'est un écart entre deux moyennes à"
        " temps plein : il mêle métiers, secteurs et ancienneté, et ne mesure pas"
        " un écart à poste égal.",
        "formule": "(salaire moyen des hommes - salaire moyen des femmes) / salaire"
        " moyen des hommes × 100",
        "notes": "pourcentage du salaire moyen des hommes",
    },
}

THEME = "emploi"
COLONNES = ("value", "value_status")

TECHNIQUE = (
    "Base Tous salariés de l'INSEE (jeu DS_BTS_SAL_EQTP_SEX_AGE), salaire net"
    " mensuel moyen en équivalent temps plein, dimensions AGE=_T et SEX=_T. Le"
    " champ est celui des salariés du **secteur privé**, contrats aidés et de"
    " professionnalisation compris, **hors apprentis, stagiaires, salariés"
    " agricoles et salariés des particuliers employeurs** : ce n'est ni le"
    " salaire de tous les actifs, ni celui de la fonction publique. Les salaires"
    " sont comptés **au lieu de travail** et non au lieu de résidence : le"
    " chiffre d'une commune décrit les emplois qui s'y trouvent, pas les revenus"
    " de ses habitants, et ne se compare donc pas au niveau de vie médian de"
    " Filosofi. La source ne diffuse que la moyenne : il n'existe pas de médiane"
    " à ces mailles. Secret statistique : les zones de moins de 2 000 habitants"
    " ne sont pas diffusées et sont absentes de la série ; certaines zones"
    " au-dessus du seuil sont blanchies (CONF_STATUS = C) et sont écrites sans"
    " valeur, au statut confidential. L'INSEE avertit que ces données ne sont ni"
    " expertisées ni validées en dessous du département. Chaque parution rediffuse"
    " l'année N-1 rétropolée à méthode constante : elle ne coïncide pas avec"
    " l'année N-1 publiée l'an passé, et deux millésimes de fichiers ne s'empilent"
    " pas. Montants en euros courants, non déflatés. Le total national publié est"
    " le code GEO 2025-FRANCE-F, France hors Mayotte, et non 2025-FRANCE-FM qui"
    " est la France métropolitaine seule. L'écart femmes-hommes est calculé sur"
    " ces mêmes moyennes à temps plein : il agrège des différences de métier, de"
    " secteur, de temps de travail converti et d'ancienneté, et ne mesure pas un"
    " écart de rémunération à poste égal."
)

# Paris est à la fois une commune et un département : les deux mailles décrivent
# exactement le même territoire, et la source doit y publier la même valeur.
PARIS_COMMUNE = ("commune", "75056")
PARIS_DEPARTEMENT = ("departement", "75")


class MailleGeographiqueIncoherente(RuntimeError):
    """Paris commune et Paris département ne portent plus la même valeur."""


def url(sexe: str) -> str:
    return f"{MELODI_BASE}/data/{JEU}?AGE={TOUS}&SEX={sexe}"


def territoire(brut: str) -> tuple[str, str] | None:
    """'2025-COM-75056' -> ('commune', '75056'), sinon None.

    Les deux codes nationaux sont traités ici plutôt que plus loin : `FM` est la
    France métropolitaine, `F` la France hors Mayotte, c'est-à-dire le champ du
    jeu et le seul agrégat cohérent avec les départements d'outre-mer publiés à
    la maille départementale. Les prendre l'un pour l'autre écrirait deux
    valeurs différentes sous le même pays.
    """
    morceaux = brut.split("-")
    if len(morceaux) < 3:
        return None
    prefixe = morceaux[1]
    if prefixe == "FRANCE":
        return ("pays", PAYS) if morceaux[2] == FRANCE_HORS_MAYOTTE else None
    niveau = NIVEAUX.get(prefixe)
    return (niveau, clean_geo(brut)) if niveau else None


def lire(observations: list[dict], sexe: str) -> dict[tuple, tuple[float | None, str]]:
    """-> {(niveau, code, période): (valeur, statut)} pour un sexe donné.

    Une zone blanchie garde sa ligne, sans valeur : le secret statistique est un
    fait publiable, une absence ne l'est pas. Une zone sous le seuil de 2 000
    habitants, elle, n'apparaît nulle part et n'a rien à écrire. Les onze
    communes servies en double se referment sur une seule valeur par l'arrondi.
    """
    lignes: dict[tuple, tuple[float | None, str]] = {}
    for observation in observations:
        dimensions = observation.get("dimensions", {})
        if dimensions.get("SEX") != sexe or dimensions.get("AGE") != TOUS:
            continue
        if dimensions.get("DERA_MEASURE") != MESURE:
            continue
        cible = territoire(dimensions.get("GEO", ""))
        if cible is None:
            continue
        cle = (*cible, dimensions.get("TIME_PERIOD"))
        statut = observation.get("attributes", {}).get("CONF_STATUS")
        valeur = (
            observation.get("measures", {}).get("OBS_VALUE_NIVEAU") or {}
        ).get("value")
        if statut == BLANCHI:
            lignes[cle] = (None, "confidential")
        elif statut == LIBRE and valeur is not None:
            lignes[cle] = (round(float(valeur), DECIMALES), "normal")
    return lignes


def controler_paris(lignes: dict[tuple, tuple[float | None, str]]) -> dict:
    """Paris commune et Paris département portent la même valeur, ou rien ne sort.

    Aucune identité interne à la source ne détecterait un millésime géographique
    qui glisse ou un préfixe mal découpé : les totaux resteraient cohérents entre
    eux et la carte sortirait fausse. Ce contrôle compare deux mailles dont on
    sait, en dehors de la source, qu'elles décrivent le même territoire.
    """
    periodes = sorted(
        {periode for (niveau, code, periode) in lignes if (niveau, code) == PARIS_COMMUNE}
    )
    if not periodes:
        raise MailleGeographiqueIncoherente(
            "Paris commune est absent de ce qui a été lu : le contrôle ne contrôle rien"
        )
    verifiees = {}
    for periode in periodes:
        commune = lignes.get((*PARIS_COMMUNE, periode))
        departement = lignes.get((*PARIS_DEPARTEMENT, periode))
        if departement is None:
            raise MailleGeographiqueIncoherente(
                f"Paris département est absent en {periode} alors que Paris commune"
                " est servi : les deux mailles ne décrivent plus le même territoire."
            )
        if commune != departement:
            raise MailleGeographiqueIncoherente(
                f"Paris en {periode} : la commune 75056 vaut {commune}, le département"
                f" 75 vaut {departement}. Même territoire, deux valeurs — millésime"
                " géographique ou découpage du code GEO en défaut."
            )
        verifiees[periode] = commune[0]
    return {"periodes_verifiees": len(periodes), "paris": verifiees}


def ecarts(
    femmes: dict[tuple, tuple[float | None, str]],
    hommes: dict[tuple, tuple[float | None, str]],
) -> dict[tuple, tuple[float | None, str]]:
    """-> {(niveau, code, période): (écart en %, statut)}.

    L'écart n'existe que là où les deux moyennes sont diffusées ; là où l'une
    est blanchie, la ligne reste, sans valeur, comme le salaire lui-même.
    """
    lignes: dict[tuple, tuple[float | None, str]] = {}
    for cle in set(femmes) & set(hommes):
        (salaire_f, statut_f), (salaire_h, statut_h) = femmes[cle], hommes[cle]
        if statut_f == "normal" and statut_h == "normal" and salaire_h:
            lignes[cle] = ((salaire_h - salaire_f) / salaire_h * 100, "normal")
        else:
            lignes[cle] = (None, "confidential")
    return lignes


def candidates(tous: dict, gaps: dict) -> list[tuple]:
    """-> [(indicateur, niveau, code, période, valeur, statut)], avant référentiel."""
    return [
        (identifiant, niveau, code, periode, valeur, statut)
        for identifiant, mesures in ((SALAIRE, tous), (ECART, gaps))
        for (niveau, code, periode), (valeur, statut) in sorted(mesures.items())
    ]


def lignes_a_ecrire(retenues: list[tuple]) -> list[tuple]:
    return [
        (identifiant, niveau, code, MILLESIME, periode, valeur, statut)
        for identifiant, niveau, code, periode, valeur, statut in retenues
    ]


def par_maille(lignes: list[tuple]) -> dict[str, int]:
    """Observations de salaire par maille — les deux côtés de la couverture.

    Un salaire moyen ne s'additionne pas : la couverture se compte en
    observations servies, jamais en euros. Et elle se mesure sur ce que la
    source sert, non sur le référentiel entier — 5 461 communes sur 34 875
    passent le seuil de diffusion, et c'est la source qui décide, pas nous.
    """
    totaux: dict[str, int] = {}
    for identifiant, niveau, _, _, _, _ in lignes:
        if identifiant == SALAIRE:
            totaux[niveau] = totaux.get(niveau, 0) + 1
    return totaux


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, fiche in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, ?, array['Officiel','Donnée brute','Secret statistique'])
                returning definition_id
                """,
                (
                    fiche["public"], TECHNIQUE, fiche["formule"], fiche["notes"],
                    "observed" if identifiant == SALAIRE else "computed",
                ),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, ?, false, ?,
                        array['commune','departement','region','pays'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, additive = false, published = true
                """,
                (
                    identifiant, DATASET, definition, THEME, fiche["libelle"],
                    fiche["unite"], "current" if fiche["unite"] == "EUR" else None,
                ),
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
        for sexe in SEXES:
            observations = melodi.pages(JEU, {"AGE": TOUS, "SEX": sexe}, page_max=8)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE, f"salaires-sexe-{sexe}.json",
                json.dumps({"observations": observations}, ensure_ascii=False).encode(),
                url(sexe), "application/json",
            )
            lus[sexe] = lire(observations, sexe)
            entrepot.etape(f"sexe {sexe} : {len(lus[sexe])} territoires-années")
        verifies = controler_paris(lus[TOUS])
        entrepot.etape(f"Paris commune = Paris département sur {verifies['periodes_verifiees']} années")

        proposees = candidates(lus[TOUS], ecarts(lus[FEMMES], lus[HOMMES]))
        gardees, ecartes = filtrer_territoires_connus(conn, proposees)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES, lignes_a_ecrire(gardees)
        )
        parts = couverture.controler(par_maille(proposees), par_maille(gardees))
        blanchies = sum(1 for ligne in gardees if ligne[5] == "confidential")
        periodes = sorted({cle[2] for cle in lus[TOUS]})
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'paris_commune_et_departement_coincident', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "premiere_annee": periodes[0],
                "derniere_annee": periodes[-1],
                "territoires_servis": len({(cle[0], cle[1]) for cle in lus[TOUS]}),
                "observations_blanchies": blanchies,
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lus[TOUS]), rows_written=ecrites
        )
        print(
            f"salaires : {ecrites} observations, {periodes[0]} à {periodes[-1]},"
            f" {blanchies} blanchies par le secret, {revisees} révisées ;"
            f" Paris commune = Paris département sur {verifies['periodes_verifiees']} années"
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
