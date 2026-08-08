"""RSA et prime d'activité par commune (CNAF, data.caf.fr).

Combien de foyers de ma commune vivent avec le RSA, et ce que la CAF leur a
versé : la photo de décembre de chaque année, commune par commune, de 2020 à
2024. Une ligne par commune et par millésime — 174 452 lignes.

**Le montant est mensuel, pas annuel, et le dire est non négociable.** La source
donne ce qui a été versé au titre du seul mois de décembre. Multiplié par douze
de tête, il donnerait un ordre de grandeur ; publié sans le mot « mois », il
serait lu comme un budget annuel et se tromperait d'un facteur douze.

**Régime CAF seul.** La MSA, qui sert les mêmes prestations au monde agricole,
n'est pas dans ce fichier. Une commune rurale n'est pas à zéro parce que
personne n'y touche le RSA, mais parce que ses allocataires sont ailleurs.

**Des foyers, pas des personnes.** Un foyer regroupe l'allocataire, son conjoint
et ses personnes à charge : compter des personnes couvertes donnerait presque le
double (colonnes indnbp de la source, non chargées).

**Le secret statistique arrondit tout.** Les foyers sont arrondis au multiple de
5, les montants à la centaine d'euros — vérifié sur la parution entière. Et les
allocataires que la CAF ne sait pas rattacher à une commune sont agrégés sous un
code vide : ils sont écartés nommément, avec leur masse, jamais répartis.

**Le contrôle qui bloque** compare la somme communale France entière, prestation
par prestation et millésime par millésime, au national **exact** du jeu mensuel
`s_ben_nat` — même producteur, même API, valeurs non arrondies. L'arrondi et les
non-localisés font un écart mesuré entre 0,01 % et 0,61 % selon la série ; la
tolérance est à 1,5 %. Une colonne décalée, un fichier tronqué ou un champ lu
dans la mauvaise unité la crèvent immédiatement.

Usage : python -m plateforme.normalize.cnaf [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import re
import urllib.parse
from collections import defaultdict

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, commune_mere, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "cnaf-prestations-communal"
SOURCE = "data-caf"
BASE = "https://data.caf.fr/api/explore/v2.1/catalog/datasets"
JEU = "s_ben_com_f"
JEU_NATIONAL = "s_ben_nat"

THEME = "revenus"

# Chaque indicateur publié et la colonne de la source qui le porte. Les autres
# prestations du fichier (allocations familiales, logement, PAJE…) et les
# personnes couvertes (indnbp) ne sont pas chargées : quatre séries qui
# répondent à « qui vit des minima ici » plutôt que vingt-quatre qui noient.
MESURES = {
    "cnaf_foyers_rsa": "indfoy_rsa",
    "cnaf_montants_rsa": "indmtt_rsa",
    "cnaf_foyers_prime_activite": "indfoy_ppa",
    "cnaf_montants_prime_activite": "indmtt_ppa",
}

# La photo est celle de décembre : la période publiée est l'année, et la fiche
# dit « au 31 décembre ». Un autre mois dans le fichier communal casserait cette
# équivalence en silence — la lecture le refuse.
MOIS = "-12"

# Ce qu'un code commune de la source a le droit d'être : cinq chiffres, ou la
# Corse (2A004, 2B033). Le reste — code vide des allocataires non localisés,
# codes masqués type « 04XXX » si une parution en réintroduit — est écarté
# nommément avec sa masse, jamais réparti sur les communes.
CODE_COMMUNE = re.compile(r"\d{5}|2[AB]\d{3}")

# Tolérance du rapprochement avec le national exact. L'arrondi au multiple de 5
# (foyers), à la centaine d'euros (montants) et les non-localisés pèsent entre
# 0,01 % et 0,61 % selon la prestation et le millésime, mesuré sur les cinq
# parutions ; 1,5 % absorbe ce bruit sans laisser passer un fichier tronqué.
ECART_MAXIMAL = 0.015

INDICATEURS = {
    "cnaf_foyers_rsa": (
        "Foyers allocataires du RSA",
        "Les foyers de la commune qui perçoivent le RSA au 31 décembre, au"
        " régime CAF seul : la MSA, qui couvre le monde agricole, manque. Un"
        " foyer regroupe allocataire, conjoint et personnes à charge : ce n'est"
        " pas le nombre de personnes couvertes.",
        "count",
        "Foyers allocataires du RSA au 31 décembre, régime CAF",
    ),
    "cnaf_montants_rsa": (
        "RSA versé dans le mois",
        "Ce que la CAF a versé en RSA aux foyers de la commune au titre du mois"
        " de décembre. C'est un montant mensuel, pas un montant annuel ; les"
        " versements de la MSA, régime agricole, n'y sont pas.",
        "EUR",
        "RSA versé au titre du mois de décembre, régime CAF",
    ),
    "cnaf_foyers_prime_activite": (
        "Foyers allocataires de la prime d'activité",
        "Les foyers de la commune qui perçoivent la prime d'activité au"
        " 31 décembre, au régime CAF seul : la MSA, qui couvre le monde"
        " agricole, manque. Un foyer regroupe allocataire, conjoint et personnes"
        " à charge : ce n'est pas le nombre de personnes couvertes.",
        "count",
        "Foyers allocataires de la prime d'activité au 31 décembre, régime CAF",
    ),
    "cnaf_montants_prime_activite": (
        "Prime d'activité versée dans le mois",
        "Ce que la CAF a versé en prime d'activité aux foyers de la commune au"
        " titre du mois de décembre. C'est un montant mensuel, pas un montant"
        " annuel ; les versements de la MSA, régime agricole, n'y sont pas.",
        "EUR",
        "Prime d'activité versée au titre du mois de décembre, régime CAF",
    ),
}

TECHNIQUE = (
    "Fichier « Toutes prestations [Communal] » de la CNAF (data.caf.fr, jeu"
    " s_ben_com_f), photo au 31 décembre de chaque année, 2020 à 2024, publiée"
    " sous l'année. Champ : allocataires du **régime des CAF seul**. La MSA,"
    " qui sert les mêmes prestations au monde agricole, n'y est pas. L'unité"
    " est le **foyer allocataire** (l'allocataire, son conjoint, ses personnes"
    " à charge) et non la personne couverte : les personnes sont plus"
    " nombreuses que les foyers. Les **montants sont ceux du seul mois de"
    " décembre**, pas de l'année. Secret statistique : les foyers sont arrondis"
    " au multiple de 5 et les montants à la centaine d'euros, si bien que les"
    " sommes de communes portent un léger bruit d'arrondi. La somme France"
    " entière reste à moins de 0,7 % du national exact publié par la CNAF"
    " (jeu s_ben_nat), qui sert de contrôle bloquant à 1,5 %. Les allocataires"
    " non rattachés à une commune sont agrégés par la source sous un code vide"
    " et écartés nommément, jamais répartis. Paris, Lyon et Marseille, codés"
    " par arrondissement, sont repliés sur leur commune."
)


class EcartNationalExcessif(RuntimeError):
    """La somme des communes ne retrouve plus le national exact de la CNAF."""


def url() -> str:
    champs = "dtreffre,numcomdo,nomcom," + ",".join(MESURES.values())
    return (
        f"{BASE}/{JEU}/exports/csv?select={urllib.parse.quote(champs)}"
        "&delimiter=%3B"
    )


def url_national() -> str:
    champs = "dtreffre," + ",".join(MESURES.values())
    return (
        f"{BASE}/{JEU_NATIONAL}/exports/csv?select={urllib.parse.quote(champs)}"
        "&delimiter=%3B"
    )


def lire(contenu: bytes) -> list[dict]:
    """CSV communal -> [{annee, commune, <indicateur>: valeur…}].

    Le fichier communal ne porte que des décembres ; un autre mois signifierait
    que la période publiée — l'année — ne désigne plus la photo du 31 décembre,
    et la lecture s'arrête plutôt que de publier un chiffre daté de travers.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes = []
    for rang in lecteur:
        date = (rang.get("dtreffre") or "").strip()
        if not date.endswith(MOIS):
            raise ValueError(
                f"dtreffre « {date} » : le fichier communal ne devait porter que"
                " des décembres, la période annuelle publiée ne veut plus rien dire"
            )
        lignes.append({
            "annee": date[:4],
            "commune": (rang.get("numcomdo") or "").strip(),
            **{ind: float(rang[champ]) for ind, champ in MESURES.items()},
        })
    return lignes


def lire_national(contenu: bytes) -> dict[str, dict[str, float]]:
    """CSV national mensuel -> {année: {indicateur: valeur exacte de décembre}}.

    Le jeu national est mensuel et remonte à 2016 : seuls ses décembres servent,
    ce sont eux que le fichier communal photographie.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    return {
        rang["dtreffre"][:4]: {
            ind: float(rang[champ]) for ind, champ in MESURES.items()
        }
        for rang in lecteur
        if (rang.get("dtreffre") or "").endswith(MOIS)
    }


def sommes_france(lignes: list[dict]) -> dict[str, dict[str, float]]:
    """{année: {indicateur: somme France entière}}, non-localisés compris.

    Tout ce qui a été lu entre dans la somme, y compris le code vide : c'est la
    France entière de la source qui se compare au national, pas la partie qu'on
    sait placer sur une carte.
    """
    sommes: dict[str, dict[str, float]] = defaultdict(lambda: dict.fromkeys(MESURES, 0.0))
    for ligne in lignes:
        for ind in MESURES:
            sommes[ligne["annee"]][ind] += ligne[ind]
    return dict(sommes)


def controler_national(
    sommes: dict[str, dict[str, float]],
    national: dict[str, dict[str, float]],
    tolerance: float = ECART_MAXIMAL,
) -> dict[str, dict[str, float]]:
    """-> écart relatif par année et indicateur. Lève au premier dépassement.

    Aucun total interne ne peut voir ce que ce rapprochement voit : un fichier
    tronqué, une colonne décalée ou un champ lu dans la mauvaise unité rendent
    une somme parfaitement cohérente avec elle-même — et fausse. Le national
    exact vient d'un autre jeu du même producteur, c'est le deuxième monde.
    """
    if not sommes:
        raise EcartNationalExcessif("aucune somme communale : rien n'a été lu")
    ecarts: dict[str, dict[str, float]] = {}
    for annee in sorted(sommes):
        if annee not in national:
            raise EcartNationalExcessif(
                f"décembre {annee} absent du jeu national {JEU_NATIONAL} :"
                " impossible de vérifier ce millésime avant de le publier"
            )
        ecarts[annee] = {}
        for ind in MESURES:
            attendu = national[annee][ind]
            ecart = abs(sommes[annee][ind] - attendu) / attendu
            if ecart > tolerance:
                raise EcartNationalExcessif(
                    f"{ind} en {annee} : {sommes[annee][ind]:.0f} en somme"
                    f" communale contre {attendu:.0f} au national exact, soit"
                    f" {100 * ecart:.2f} % d'écart pour {100 * tolerance:.1f} %"
                    " tolérés. L'arrondi n'explique pas ça : lecture tronquée,"
                    " colonne décalée ou mauvaise unité."
                )
            ecarts[annee][ind] = round(ecart, 5)
    return ecarts


def par_commune(lignes: list[dict]) -> tuple[list[tuple], dict[str, dict]]:
    """-> (observations candidates, ce qui est écarté par motif).

    Les arrondissements de Paris, Lyon et Marseille se replient sur leur
    commune — la source ne code que par arrondissement, et laisser 75101 tel
    quel publierait Paris à zéro. Les codes vides ou masqués sont écartés avec
    leur masse : les répartir fabriquerait des allocataires que personne n'a
    localisés.
    """
    sommes: dict[tuple[str, str], dict[str, float]] = defaultdict(
        lambda: dict.fromkeys(MESURES, 0.0)
    )
    masques: dict[str, float] = dict.fromkeys(MESURES, 0.0)
    masques["lignes"] = 0
    for ligne in lignes:
        code = ligne["commune"]
        if not CODE_COMMUNE.fullmatch(code):
            masques["lignes"] += 1
            for ind in MESURES:
                masques[ind] += ligne[ind]
            continue
        code = commune_mere(code) or code
        cible = sommes[(code, ligne["annee"])]
        for ind in MESURES:
            cible[ind] += ligne[ind]

    candidates = [
        (ind, "commune", code, annee, valeurs[ind])
        for (code, annee), valeurs in sorted(sommes.items())
        for ind in sorted(MESURES)
    ]
    ecartes = {"code_masque_ou_vide": masques} if masques["lignes"] else {}
    return candidates, ecartes


def foyers_par_maille(candidates: list[tuple]) -> dict[str, float]:
    """Les foyers par maille, pour les deux côtés de la couverture.

    La couverture se mesure en foyers — RSA et prime d'activité confondus — et
    non en codes : une commune perdue ne pèse pas un trente-quatre-millième du
    total, elle pèse ses allocataires. Les montants n'entrent pas : mélanger des
    foyers et des euros ferait une part que rien ne mesure.
    """
    par_maille: dict[str, float] = defaultdict(float)
    for ind, niveau, _, _, valeur in candidates:
        if ind in ("cnaf_foyers_rsa", "cnaf_foyers_prime_activite"):
            par_maille[niveau] += valeur
    return dict(par_maille)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for identifiant, (libelle, publique, unite, formule) in sorted(INDICATEURS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (
                    publique,
                    TECHNIQUE,
                    formule,
                    "euros versés au titre du seul mois de décembre,"
                    " arrondis à la centaine"
                    if unite == "EUR"
                    else "foyers allocataires, arrondis au multiple de 5",
                ),
            ).fetchone()[0]
            # Sommable, malgré l'arrondi au multiple de 5 : c'est un bruit sans
            # biais, mesuré sous 0,7 % sur la somme France entière des cinq
            # millésimes, et refuser l'addition priverait les mailles
            # département et région d'un chiffre juste à cent fois mieux que la
            # tolérance du contrôle. La fiche technique porte la réserve.
            monetaire = unite == "EUR"
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, geo_levels, time_granularity, published)
                values (?, ?, ?, ?, ?, ?, true, ?, array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id,
                    label_fr = excluded.label_fr,
                    theme = excluded.theme, published = true
                """,
                (
                    identifiant, DATASET, definition, THEME, libelle, unite,
                    "current" if monetaire else None,
                ),
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
        entrepot.etape(f"{len(contenu) // 1024} Ko communaux reçus")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "prestations-communal.csv",
            contenu, adresse, "text/csv",
        )
        lignes = lire(contenu)
        entrepot.etape(f"{len(lignes)} lignes commune-millésime lues")

        adresse_nat = url_national()
        contenu_nat = telecharger(adresse_nat, timeout=120)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "prestations-national.csv",
            contenu_nat, adresse_nat, "text/csv",
        )
        ecarts = controler_national(sommes_france(lignes), lire_national(contenu_nat))
        entrepot.etape(
            f"somme communale à moins de {100 * ECART_MAXIMAL:.1f} % du national"
            f" exact sur {len(ecarts)} millésimes"
        )

        candidates, masques = par_commune(lignes)
        gardees, ecartes = filtrer_territoires_connus(conn, candidates)
        ecrites, revisees = revisions.remplacer(
            conn, run_id, sorted(INDICATEURS), COLONNES,
            [
                (ind, niveau, code, MILLESIME, annee, valeur)
                for ind, niveau, code, annee, valeur in gardees
            ],
        )
        parts = couverture.controler(
            foyers_par_maille(candidates), foyers_par_maille(gardees)
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'somme_communale_egale_national_exact', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "ecarts_relatifs": ecarts,
                "ecartes": masques,
                "hors_referentiel": len(ecartes),
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites
        )
        annees = sorted(ecarts)
        print(
            f"prestations CAF : {ecrites} observations, millésimes"
            f" {annees[0]}-{annees[-1]}, {len(INDICATEURS)} indicateurs ;"
            f" {masques.get('code_masque_ou_vide', {}).get('lignes', 0)} lignes"
            f" non localisées écartées, {len(ecartes)} codes hors référentiel,"
            f" {revisees} valeurs révisées"
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
