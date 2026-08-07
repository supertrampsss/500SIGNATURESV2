"""Ce que les médecins libéraux d'un département prescrivent (CNAM, SNDS).

Un médecin de ville coûte peu en consultation et beaucoup en ordonnance : les
médecins libéraux ont prescrit **60,5 Md€ de soins exécutés en ville en 2024**,
pour 30,5 Md€ d'honoraires perçus la même année. La source les ventile par
département d'exercice et par poste — médicaments, dispositifs médicaux,
biologie, soins infirmiers, kinésithérapie, transports, indemnités
journalières, autres — de 2010 à 2024.

**Le périmètre est la moitié de l'information.** Ce sont des prescriptions
*exécutées en ville*, faites par des professionnels *libéraux*, hors hôpital,
tous régimes d'assurance maladie. Ce n'est donc ni la dépense d'assurance
maladie du département, ni ce que consomment ses habitants : c'est ce que ses
prescripteurs libéraux ont prescrit. Un département qui concentre les
spécialistes prescrit pour des patients qui n'y habitent pas ; un département
dont l'offre est hospitalière prescrit peu sans se soigner moins. La fiche le
dit avant toute lecture territoriale.

**Le piège du code 999.** La source publie une ligne « FRANCE » et dix-huit
lignes « Tout département », une par région — toutes portant `departement =
"999"`. Les deux libellés diffèrent, le code non. Filtrer sur le seul libellé,
ou sur le seul code, double les montants : la ligne France ne s'identifie que
par le **couple** `region = "99"` et `departement = "999"`.

**Un montant absent n'est pas un montant nul.** Le secret statistique masque
les cases de moins de cinq professionnels (« NS ») : 64 783 lignes du jeu
complet, soit 15,4 %. La colonne entière y est vide ; la ligne doit être
absente, jamais lue comme un zéro.

**Le contrôle qui bloque.** La source publie le même argent trois fois :
en total France, en huit postes, et en cent-un départements. Les trois doivent
coïncider — vérifié sur 2024 à 60 453 601 998 € pour les deux premières et
60 453 602 004 € pour la troisième, six euros d'arrondis sur soixante
milliards.

Usage : python -m plateforme.normalize.prescriptions [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import urllib.parse
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "cnam-prescriptions"
SOURCE = "data-ameli"
BASE = "https://data.ameli.fr/api/explore/v2.1/catalog/datasets"
JEU = "prescriptions"

# Le jeu ne couvre que les médecins, spécialité par spécialité ; « Ensemble des
# médecins » est l'agrégat que la source calcule elle-même. Additionner les
# spécialités à la main donnerait le même ordre de grandeur en perdant les
# cases masquées par le secret statistique.
PROFESSION = "Ensemble des médecins"

# La ligne France entière, et elle seule. Les dix-huit lignes régionales
# « Tout département » portent le même code 999 avec un libellé différent :
# les compter comme des départements doublerait la masse.
FRANCE = ("99", "999")
NON_DEPARTEMENT = "999"

POSTE_TOTAL = "total"
POSTES = ("1", "2", "3", "4", "5", "6", "7", "8")

# Six euros d'écart sur soixante milliards, c'est l'arrondi de la source ; six
# millions, c'est une erreur de lecture. Le seuil relatif sépare les deux.
TOLERANCE = 1e-7

INDICATEUR = "cnam_prescriptions_medecins_ville"
THEME = "sante"

LIBELLE = "Prescriptions des médecins libéraux exécutées en ville"

PUBLIQUE = (
    "Ce que les médecins libéraux installés dans le département ont prescrit et"
    " qui a été délivré en ville : médicaments, dispositifs médicaux, analyses,"
    " soins infirmiers, kinésithérapie, transports, indemnités journalières."
    " C'est la prescription de ses médecins, pas la dépense de santé de ses"
    " habitants."
)

TECHNIQUE = (
    "Montant total des prescriptions des médecins libéraux, CNAM, issu du"
    " système national des données de santé (SNDS), en euros courants."
    " **Périmètre : soins exécutés en ville, prescrits par des professionnels"
    " libéraux (hors hôpital), tous régimes d'assurance maladie.** Le chiffre"
    " est rattaché au département d'exercice du prescripteur, pas au domicile"
    " du patient ni au lieu d'exécution : il ne se lit ni comme la dépense"
    " d'assurance maladie du département, ni comme la consommation de soins de"
    " ses habitants. Champ : médecins actifs au 31 décembre, exerçant en"
    " libéral, en métropole et dans les cinq départements d'outre-mer."
    " Le secret statistique masque les cases de moins de cinq professionnels"
    " (« NS ») : ces lignes sont absentes, elles ne valent pas zéro. Deux jeux"
    " voisins de la même source ne mesurent pas cela : `honoraires` donne ce"
    " que les professionnels perçoivent, dépassements compris (4,54 Md€ de"
    " dépassements pour l'ensemble des médecins en 2024), qui n'est pas de"
    " l'argent public ; `depenses` n'a aucune dimension géographique, ses"
    " colonnes `dep_niv_1` et `dep_niv_2` désignant des postes de dépense et"
    " non des départements."
)


class TotauxDivergents(RuntimeError):
    """Les postes, les départements et la France ne décrivent plus la même masse."""


def url() -> str:
    """L'export filtré sur l'agrégat « Ensemble des médecins ».

    `annee` est de type date : un filtre `where=annee=2024` échoue sur
    `IncompatibleTypesInComparisonFilter`, il s'écrirait `where=year(annee)=2024`.
    Tout l'historique étant chargé d'un coup, le filtre ne porte que sur la
    profession. Seules les colonnes `_integer` sont demandées : les colonnes de
    même nom sans suffixe sont de type texte et portent « NS » et « NC ».
    """
    select = (
        "annee,profession_sante,region,departement,poste_prescription,"
        "montant_total_prescription_integer"
    )
    where = f'profession_sante="{PROFESSION}"'
    return (
        f"{BASE}/{JEU}/exports/csv"
        f"?select={urllib.parse.quote(select)}"
        f"&where={urllib.parse.quote(where)}"
        "&delimiter=%3B"
    )


def lire(contenu: bytes) -> list[tuple[str, str, str, str, float]]:
    """-> [(exercice, code région, code département, poste, montant)].

    La profession est refiltrée ici alors que l'export la filtre déjà : si la
    modalité était renommée côté source, le `where` ne ramènerait plus
    l'agrégat mais toutes les spécialités, et les contrôles internes du jeu
    passeraient quand même — chaque spécialité vérifiant séparément ses postes
    et ses départements. C'est la seule garde qui voit ce cumul.

    Un montant vide est du secret statistique : la ligne est écartée, pas
    ramenée à zéro.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes = []
    for rang in lecteur:
        if (rang.get("profession_sante") or "").strip() != PROFESSION:
            continue
        brut = (rang.get("montant_total_prescription_integer") or "").strip()
        if not brut:
            continue
        lignes.append((
            (rang.get("annee") or "").strip()[:4],
            (rang.get("region") or "").strip(),
            (rang.get("departement") or "").strip(),
            (rang.get("poste_prescription") or "").strip(),
            float(brut),
        ))
    return lignes


def controler(lignes) -> dict:
    """La France, ses huit postes et ses cent-un départements : la même masse.

    Trois agrégations indépendantes du même argent, exercice par exercice. Un
    poste lu deux fois, une ligne régionale prise pour un département ou un
    « NS » compté zéro ferait diverger au moins l'une des trois — et l'écart
    d'arrondi que la source laisse (six euros sur soixante milliards) reste
    trois ordres de grandeur sous le seuil.
    """
    france: dict[tuple[str, str], float] = defaultdict(float)
    departements: dict[str, float] = defaultdict(float)
    codes: dict[str, set[str]] = defaultdict(set)
    for exercice, region, departement, poste, montant in lignes:
        if (region, departement) == FRANCE:
            france[(exercice, poste)] += montant
        elif departement != NON_DEPARTEMENT and poste == POSTE_TOTAL:
            departements[exercice] += montant
            codes[exercice].add(departement)
    france = dict(france)
    exercices = sorted(e for e, poste in france if poste == POSTE_TOTAL)
    if not exercices:
        raise TotauxDivergents(
            "aucune ligne France entière (region 99, departement 999, poste total) :"
            " le jeu ne porte plus l'agrégat sur lequel tout se vérifie"
        )
    ecarts = []
    for exercice in exercices:
        total = france[(exercice, POSTE_TOTAL)]
        absents = [poste for poste in POSTES if (exercice, poste) not in france]
        if absents:
            raise TotauxDivergents(
                f"{exercice} : postes {', '.join(absents)} absents de la ligne"
                " France — le découpage en huit postes a changé"
            )
        sommes = {
            "les huit postes": sum(france[(exercice, poste)] for poste in POSTES),
            f"les {len(codes[exercice])} départements": departements[exercice],
        }
        for quoi, somme in sommes.items():
            if abs(somme - total) > TOLERANCE * abs(total):
                ecarts.append(f"{exercice}, {quoi} : {somme - total:+,.0f} €")
    if ecarts:
        raise TotauxDivergents(
            f"{len(ecarts)} agrégations ne retrouvent pas le total France, par"
            f" exemple {ecarts[0]} (tolérance {TOLERANCE:.0e} en relatif)."
        )
    return {
        "exercices": exercices,
        "france_dernier_exercice": france[(exercices[-1], POSTE_TOTAL)],
        "departements_par_exercice": {e: len(codes[e]) for e in exercices},
    }


def par_departement(lignes) -> list[tuple]:
    """-> les observations : le poste `total` de chaque vrai département."""
    totaux: dict[tuple[str, str], float] = defaultdict(float)
    for exercice, _, departement, poste, montant in lignes:
        if departement == NON_DEPARTEMENT or poste != POSTE_TOTAL:
            continue
        totaux[(departement, exercice)] += montant
    return [
        (INDICATEUR, "departement", departement, exercice, montant)
        for (departement, exercice), montant in sorted(totaux.items())
    ]


def masse_par_maille(candidates) -> dict[str, float]:
    """Les euros lus puis les euros reconnus : la couverture se mesure en argent."""
    par_maille: dict[str, float] = defaultdict(float)
    for _, niveau, _, _, montant in candidates:
        par_maille[niveau] += montant
    return dict(par_maille)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        definition = curseur.execute(
            """
            insert into core.indicator_definitions
                (public_definition, technical_definition, formula, unit_notes,
                 confidence_level, badges)
            values (?, ?, 'CNAM, jeu prescriptions, poste « total », ensemble des'
                    ' médecins libéraux', 'euros courants', 'observed',
                    array['Officiel','Donnée brute'])
            returning definition_id
            """,
            (PUBLIQUE, TECHNIQUE),
        ).fetchone()[0]
        curseur.execute(
            """
            insert into core.indicators
                (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                 additive, price_basis, geo_levels, time_granularity, published)
            values (?, ?, ?, ?, ?, 'EUR', true, 'current', array['departement'],
                    'annuelle', true)
            on conflict (indicator_id) do update set
                definition_id = excluded.definition_id,
                label_fr = excluded.label_fr,
                theme = excluded.theme, published = true
            """,
            (INDICATEUR, DATASET, definition, THEME, LIBELLE),
        )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


COLONNES = ("value",)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        adresse = url()
        contenu = telecharger(adresse, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"{JEU}.csv", contenu,
            adresse, "text/csv",
        )
        lignes = lire(contenu)
        entrepot.etape(f"{JEU} : {len(lignes)} lignes de l'ensemble des médecins")
        verifies = controler(lignes)
        entrepot.etape(
            f"{len(verifies['exercices'])} exercices vérifiés : postes et"
            " départements retrouvent la France"
        )
        candidates = par_departement(lignes)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, [INDICATEUR], COLONNES,
            [
                (identifiant, niveau, code, MILLESIME, exercice, montant)
                for identifiant, niveau, code, exercice, montant in gardees
            ],
        )
        parts = couverture.controler(
            masse_par_maille(candidates), masse_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'postes_et_departements_retrouvent_la_france',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites,
        )
        exercices = verifies["exercices"]
        print(
            f"prescriptions : {ecrites} observations, exercices"
            f" {exercices[0]}-{exercices[-1]}, "
            f"{verifies['france_dernier_exercice'] / 1e9:.1f} Md€ prescrits en"
            f" {exercices[-1]}, {revisees} révisées"
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
