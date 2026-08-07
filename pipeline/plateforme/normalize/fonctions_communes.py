"""À quoi sert l'argent d'une commune : les charges de fonctionnement par fonction.

Le site disait ce que la commune paie — 183 M€ de personnel, 86 M€ d'achats. Il ne
disait pas **à quoi ça sert**. « Achats et charges externes » ne se discute pas ;
« 23 M€ pour le sport, 32 M€ pour les écoles » se discute.

La source est le grand livre : les balances comptables des collectivités avec
présentation croisée nature-fonction, publiées par la DGFiP. Cinq millions de
lignes pour le seul exercice 2023, une par compte et par fonction et par budget.
On n'en charge que les dix totaux de premier niveau, agrégés **côté serveur** :
une commune pèse dix lignes, pas cent cinquante.

**Le périmètre n'est pas celui de l'OFGL, et c'est tout l'enjeu.** Le grand livre
donne 385,9 M€ de charges de classe 6 pour Bordeaux 2023 quand l'OFGL en publie
353,7. J'ai essayé de reconstituer la formule de l'OFGL — classe 6 moins les
contributions au fonds de compensation des charges territoriales, moins les
valeurs comptables des immobilisations cédées — et **elle ne ferme pas** : il
reste 31,5 M€ que rien de publié n'explique. L'OFGL neutralise autre chose sans
en publier la règle.

Publier les deux totaux côte à côte sans le dire donnerait deux réponses à la
même question. La décomposition porte donc une **onzième ligne**, négative, qui
nomme l'écart : « retraitements de l'OFGL, non détaillés par la source ». Les
onze redonnent alors exactement l'agrégat que le site publie déjà, et le lecteur
voit à la fois où va l'argent et ce qui sépare les deux comptages.

**Ce que la fonction dit et ne dit pas.** Elle décrit la destination de la
dépense telle que la commune la ventile dans ses comptes, selon la nomenclature
M14 ou M57. Deux communes peuvent ranger la même dépense sous deux fonctions
différentes ; les « services généraux » recouvrent l'administration et tout ce
qui n'est pas ventilable. Ce n'est pas une mesure de politique publique, c'est
une imputation comptable.

**Une commune sur sept seulement, et ce n'est pas un trou de collecte.** La
ventilation fonctionnelle n'est obligatoire qu'à partir de 3 500 habitants
(art. L. 2312-3 du code général des collectivités territoriales). En Gironde,
78 communes la produisent : ce sont 78 des 83 communes de 3 500 habitants et
plus, et aucune en dessous. Mesurée sur les communes soumises à l'obligation, la
couverture est de 94 % ; mesurée sur toutes les communes, elle serait de 15 % et
ferait passer une règle de droit pour un raté de collecte. C'est donc sur les
premières qu'elle est contrôlée.

Usage : python -m plateforme.normalize.fonctions_communes [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "dgfip-balances-fonction"
SOURCE = "data-economie"
EXERCICE = "2023"
JEU = f"balances-comptables-des-collectivites-et-des-epl-avec-fonction-{EXERCICE}"
BASE = f"https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/{JEU}/exports/csv"
THEME = "finances_locales"

# L'agrégat que cette décomposition explique. Les onze lignes doivent le
# redonner : c'est le contrôle, et c'est aussi ce qui permet au site de les
# proposer comme second axe de lecture du même total.
PARENT = "ofgl_depenses_fonctionnement"

# Les dix fonctions de premier niveau, communes aux nomenclatures M14 et M57.
# Le libellé est celui de l'instruction budgétaire, raccourci pour tenir dans
# une colonne : c'est un intitulé de plan comptable, pas une politique publique.
FONCTIONS = {
    "0": ("Services généraux et administration", "fonction_commune_services_generaux"),
    "1": ("Sécurité et salubrité publiques", "fonction_commune_securite"),
    "2": ("Enseignement et formation", "fonction_commune_enseignement"),
    "3": ("Culture", "fonction_commune_culture"),
    "4": ("Sport et jeunesse", "fonction_commune_sport"),
    "5": ("Interventions sociales et santé", "fonction_commune_social"),
    "6": ("Famille", "fonction_commune_famille"),
    "7": ("Logement", "fonction_commune_logement"),
    "8": ("Aménagement, services urbains, environnement", "fonction_commune_amenagement"),
    "9": ("Action économique", "fonction_commune_economie"),
}

RESIDU = "fonction_commune_retraitements_ofgl"

# Les codes de département de la DGFiP ne sont pas ceux de l'INSEE pour
# l'outre-mer : le grand livre range la Guadeloupe en 101 là où le code officiel
# géographique dit 971. Les traduire nommément, plutôt que de les laisser tomber
# au filtre du référentiel, est ce qui permet à la couverture de ne mesurer que
# les vrais ratés d'appariement.
OUTRE_MER = {"101": "971", "102": "972", "103": "973", "104": "974", "106": "976"}

TECHNIQUE = (
    "Balances comptables des collectivités et des établissements publics locaux"
    " avec présentation croisée nature-fonction, exercice 2023, publiées par la"
    " DGFiP. Budget principal des communes seul (cbudg=1, categ='Commune'),"
    " opérations budgétaires nettes au débit des comptes de classe 6, agrégées"
    " par le premier caractère du code fonction."
)

RESERVE = (
    " La fonction décrit la destination que la commune donne à la dépense dans"
    " ses propres comptes, selon la nomenclature M14 ou M57 : deux communes"
    " peuvent ranger la même dépense sous deux fonctions différentes, et les"
    " services généraux recouvrent l'administration et tout ce qui n'est pas"
    " ventilable. C'est une imputation comptable, pas une mesure de politique"
    " publique. Elle n'est obligatoire qu'à partir de 3 500 habitants"
    " (art. L. 2312-3 du CGCT) : en dessous de ce seuil la commune n'en publie pas,"
    " et ce bloc est absent de sa fiche. Le total de ces lignes est celui du grand"
    " livre, plus large que l'agrégat de l'OFGL publié par ailleurs ; l'écart figure"
    " en clair sous « retraitements de l'OFGL »."
)


def url(departement: str) -> str:
    """L'export agrégé côté serveur, département par département.

    Cinq millions de lignes ne se rapatrient pas pour en garder dix par commune.
    Le `group_by` de l'API fait la somme avant l'envoi ; découper par département
    garde chaque requête sous la minute et rend l'échec local plutôt que total.
    """
    from urllib.parse import urlencode

    return f"{BASE}?" + urlencode({
        "select": "ndept,insee,fonction,sum(obnetdeb) as debit",
        "group_by": "ndept,insee,fonction",
        "where": (
            f"categ='Commune' and cbudg='1' and startswith(compte,'6')"
            f" and ndept='{departement}'"
        ),
        "limit": -1,
    })


def code_insee(ndept: str, insee: str) -> str | None:
    """« 033 » + « 063 » -> « 33063 », « 02A » + « 247 » -> « 2A247 ».

    Le département de la DGFiP est cadré sur trois caractères par un zéro de
    tête, que la Corse n'a pas et que l'outre-mer remplace par un code à lui.
    """
    if len(insee) != 3 or not ndept:
        return None
    if ndept in OUTRE_MER:
        return f"{OUTRE_MER[ndept]}{insee[1:]}"
    departement = ndept[1:] if len(ndept) == 3 and ndept.startswith("0") else ndept
    return f"{departement}{insee}"


def lire(contenu: bytes) -> list[dict]:
    """L'export agrégé -> [{commune, fonction, montant}].

    Les lignes sans fonction sont gardées et rangées sous les services généraux :
    les écarter ferait manquer la somme au contrôle, et les compter ailleurs
    inventerait une destination que la source ne donne pas.
    """
    lignes = []
    for rangee in csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";"):
        code = code_insee((rangee.get("ndept") or "").strip(), (rangee.get("insee") or "").strip())
        montant = rangee.get("debit")
        if code is None or not montant:
            continue
        fonction = (rangee.get("fonction") or "").strip()
        lignes.append({
            "commune": code,
            "fonction": fonction[0] if fonction and fonction[0] in FONCTIONS else "0",
            "montant": round(float(montant), 2),
        })
    return lignes


def par_commune(lignes: list[dict]) -> dict[str, dict[str, float]]:
    """-> {commune: {fonction: montant}}, les dix fonctions sommées."""
    totaux: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for ligne in lignes:
        totaux[ligne["commune"]][ligne["fonction"]] += ligne["montant"]
    return {code: dict(fonctions) for code, fonctions in totaux.items()}


def agregats_ofgl(conn, communes) -> dict[str, float]:
    """Ce que le site publie déjà pour le même exercice et le même agrégat."""
    lignes = conn.execute(
        """
        select geo_code, value from core.observations
         where indicator_id = ? and geo_level = 'commune' and period = ?
           and value_status = 'normal' and variant = 'total'
        """,
        (PARENT, EXERCICE),
    ).fetchall()
    connues = set(communes)
    return {code: float(valeur) for code, valeur in lignes if code in connues}


def candidates(totaux: dict[str, dict[str, float]], ofgl: dict[str, float]) -> list[tuple]:
    """Les observations à écrire, résidu de rapprochement compris.

    Une commune dont l'agrégat OFGL n'est pas publié n'est pas écrite du tout :
    sans lui, le résidu ne se calcule pas, et publier dix fonctions dont la somme
    ne correspond à aucun total du site donnerait un second jeu de chiffres sur
    les mêmes lignes — exactement ce que ce site refuse.
    """
    sorties = []
    for code, fonctions in sorted(totaux.items()):
        total_ofgl = ofgl.get(code)
        if total_ofgl is None:
            continue
        grand_livre = sum(fonctions.values())
        for tete, (_libelle, identifiant) in FONCTIONS.items():
            montant = fonctions.get(tete)
            if montant is None:
                continue
            sorties.append((identifiant, "commune", code, EXERCICE, round(montant, 2)))
        sorties.append(
            (RESIDU, "commune", code, EXERCICE, round(total_ofgl - grand_livre, 2))
        )
    return sorties


def controler(sorties: list[tuple], ofgl: dict[str, float]) -> dict:
    """Les onze lignes doivent redonner l'agrégat que le site publie déjà.

    C'est le seul contrôle qui compte : il ne vérifie pas notre arithmétique — le
    résidu la ferme par construction — mais que chaque commune écrite a bien un
    agrégat de référence, et il mesure l'ampleur du retraitement. Un résidu qui
    dépasserait la moitié de l'agrégat signalerait un changement de périmètre à
    la source, pas un retraitement.
    """
    par_code: dict[str, float] = defaultdict(float)
    for _identifiant, _niveau, code, _periode, valeur in sorties:
        par_code[code] += valeur
    ecarts = [
        abs(somme - ofgl[code]) for code, somme in par_code.items() if code in ofgl
    ]
    residus = [
        abs(valeur) / abs(ofgl[code])
        for identifiant, _n, code, _p, valeur in sorties
        if identifiant == RESIDU and ofgl.get(code)
    ]
    residus.sort()
    if ecarts and max(ecarts) > 1.0:
        raise ValueError(
            f"la décomposition ne redonne pas l'agrégat de l'OFGL : écart maximal"
            f" de {max(ecarts):.2f} € sur {len(ecarts)} communes"
        )
    return {
        "communes": len(par_code),
        "residu_median": round(residus[len(residus) // 2], 4) if residus else None,
        "residu_maximal": round(residus[-1], 4) if residus else None,
    }


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for tete, (libelle, identifiant) in sorted(FONCTIONS.items()):
            publique = (
                f"Ce que la commune dépense au titre de « {libelle.lower()} » dans son"
                f" budget principal, hors investissement.{RESERVE}"
            )
            _ecrire_indicateur(curseur, identifiant, libelle, publique, tete)
        _ecrire_indicateur(
            curseur, RESIDU, "Retraitements de l'OFGL",
            "L'écart entre les charges du grand livre et l'agrégat de dépenses de"
            " fonctionnement que l'Observatoire des finances locales publie pour la"
            " même commune et le même exercice. L'OFGL neutralise certaines écritures"
            " sans publier la règle exacte : cette ligne nomme l'écart plutôt que de"
            " le répartir sur les fonctions, ce qui l'aurait rendu invisible.",
            None,
        )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def _ecrire_indicateur(curseur, identifiant, libelle, publique, tete) -> None:
    formule = (
        f"Somme des opérations budgétaires nettes au débit des comptes de classe 6"
        f" dont le code fonction commence par « {tete} »"
        if tete is not None
        else "Agrégat OFGL des dépenses de fonctionnement − somme des dix fonctions"
    )
    definition = curseur.execute(
        """
        insert into core.indicator_definitions
            (public_definition, technical_definition, formula, unit_notes,
             confidence_level, badges)
        values (?, ?, ?, 'euros courants', ?, array['Officiel','Donnée brute'])
        returning definition_id
        """,
        (publique, TECHNIQUE, formule, "observed" if tete is not None else "computed"),
    ).fetchone()[0]
    curseur.execute(
        """
        insert into core.indicators
            (indicator_id, dataset_id, definition_id, theme, label_fr, unit, additive,
             price_basis, accounting_frame, geo_levels, time_granularity, published)
        values (?, ?, ?, ?, ?, 'EUR', true, 'current', 'budgetaire',
                array['commune'], 'annuelle', true)
        on conflict (indicator_id) do update set
            definition_id = excluded.definition_id, label_fr = excluded.label_fr,
            theme = excluded.theme, unit = excluded.unit, published = true
        """,
        (identifiant, DATASET, definition, THEME, libelle),
    )


COLONNES = ("value",)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        departements = [
            code for (code,) in conn.execute(
                "select distinct geo_code from geo.geography_reference"
                " where geo_level = 'departement' and vintage = ?",
                (MILLESIME,),
            ).fetchall()
        ]
        # Le département de la DGFiP, pas celui de l'INSEE : le cadrage sur trois
        # caractères et les codes d'outre-mer sont les siens.
        inverse = {insee: dgfip for dgfip, insee in OUTRE_MER.items()}
        lignes: list[dict] = []
        for departement in sorted(departements):
            dgfip = inverse.get(departement) or departement.rjust(3, "0")
            contenu = telecharger(url(dgfip), timeout=300)
            entrepot.record_asset(
                conn, store, run_id, DATASET, SOURCE,
                f"balances-fonction-{EXERCICE}-{dgfip}.csv", contenu, url(dgfip), "text/csv",
            )
            lignes.extend(lire(contenu))
        entrepot.etape(f"{len(lignes)} lignes agrégées lues, exercice {EXERCICE}")

        totaux = par_commune(lignes)
        ofgl = agregats_ofgl(conn, totaux)
        entrepot.etape(
            f"{len(totaux)} communes au grand livre, {len(ofgl)} avec un agrégat OFGL"
        )
        gardees, ecartes = filtrer_territoires_connus(conn, candidates(totaux, ofgl))
        verifies = controler(gardees, ofgl)

        noms = [identifiant for _libelle, identifiant in FONCTIONS.values()] + [RESIDU]
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(noms), COLONNES,
            [
                (identifiant, niveau, code, MILLESIME, periode, valeur)
                for identifiant, niveau, code, periode, valeur in gardees
            ],
        )
        # La couverture se mesure sur les communes **soumises à l'obligation** de
        # ventilation, pas sur toutes : rapportée aux 34 772, elle dirait 15 % et
        # ferait passer une règle de droit pour un raté de collecte.
        soumises = {
            code for (code,) in conn.execute(
                """
                select o.geo_code from core.observations o
                 where o.indicator_id = 'insee_population_municipale'
                   and o.geo_level = 'commune' and o.variant = 'total'
                   and o.value >= 3500
                   and o.period = (select max(period) from core.observations
                                    where indicator_id = 'insee_population_municipale')
                """
            ).fetchall()
        }
        ecrites_par_commune = {code for _i, _n, code, _p, _v in gardees}
        parts = (
            couverture.controler(
                {"commune": float(len(soumises))},
                {"commune": float(len(soumises & ecrites_par_commune))},
            )
            if soumises
            else {}
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'les_dix_fonctions_redonnent_l_agregat_de_l_ofgl',
                    'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "exercice": EXERCICE,
                "seuil_obligation_habitants": 3500,
                "communes_soumises": len(soumises),
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 6) for n, p in sorted(parts.items())},
            }, ensure_ascii=False)),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites)
        print(
            f"fonctions communales : {ecrites} observations sur {verifies['communes']}"
            f" communes, exercice {EXERCICE} ; retraitement OFGL médian"
            f" {100 * (verifies['residu_median'] or 0):.1f} % de l'agrégat,"
            f" maximal {100 * (verifies['residu_maximal'] or 0):.1f} % ;"
            f" {revisees} révisées, {len(ecartes)} hors référentiel"
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
