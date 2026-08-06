"""Écoles, collèges et lycées par commune (annuaire MENJ) vers core.observations.

« Ma commune a-t-elle encore son école ? » — la fermeture d'une école rurale
est un fait de vie communal autant qu'une ligne de budget. L'annuaire de
l'éducation nationale recense chaque établissement avec sa commune, son type,
son statut et son état : deux comptages en sortent, les écoles du premier
degré, et les collèges et lycées réunis.

**Zéro est une donnée.** Une commune sans école n'est pas une commune sans
information : la ligne vaut 0, elle est écrite, et la carte la colorie. La
laisser absente l'afficherait « donnée non disponible » — le contraire de ce
qu'on sait. C'est le référentiel géographique qui fournit l'univers des
communes, jamais l'annuaire seul.

**Un comptage se lit chez soi, pas en palmarès.** Paris a des centaines
d'écoles parce qu'elle a des centaines de milliers d'habitants : ces
indicateurs n'ont pas de repère de comparaison (publish.py), et la fiche le
dit. Public et privé sous contrat sont comptés ensemble, la définition le dit
aussi. Ils ont en revanche un **groupe de communes semblables**, qui les
rapporte aux habitants — et c'est là que la période a longtemps tout cassé.

**La période vient de la source, pas de l'horloge.** Elle valait
`datetime.now().year`, ce qui a trois défauts et non un seul. Le premier est
visible : au 5 août 2026 l'annuaire était publié en période « 2026 » quand
toutes les populations s'arrêtent à 2025, si bien que la requête des quartiles
ne trouvait aucun dénominateur et qu'aucune comparaison ne sortait — en
silence. Le deuxième est pire : le même instantané, rejoué en janvier suivant,
aurait porté une autre période, et le site aurait affiché deux millésimes
identiques comme s'ils décrivaient deux rentrées. Le troisième est de principe :
une valeur qui dépend de l'heure du runner n'est pas reproductible depuis son
instantané, ce qui est toute la promesse de cette chaîne.

L'annuaire est un **répertoire vivant**, sans année scolaire dans ses lignes ;
mais le portail date sa propre mise à jour (`data_processed`), et cette date-là
est archivée avec l'extraction. La période est l'année scolaire qu'elle décrit :
celle qui a commencé en septembre. Une extraction d'août 2026 décrit donc la
rentrée 2025, encore en cours, et non une rentrée 2026 qui n'a pas eu lieu.

Usage : python -m plateforme.normalize.education [--store r2:plateforme-raw]
"""

import json
import argparse
import csv
import io
from collections import Counter
from datetime import datetime


from plateforme import entrepot, revisions
from plateforme.connectors import ods
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, commune_mere, departement_cog, make_store

DATASET = "menj-annuaire-education"
SOURCE = "data-education"
BASE = "https://data.education.gouv.fr/api/explore/v2.1"
JEU = "fr-en-annuaire-education"

# Valeurs constatées sur les facettes du portail, jamais supposées :
# type_etablissement 'Ecole' (47 947), 'Collège' (9 057), 'Lycée' (5 576) ;
# etat 'OUVERT'. Les EREA, services administratifs et centres d'orientation
# ne sont ni des écoles ni des collèges-lycées : hors champ.
TYPES = {"Ecole": "ecoles", "Collège": "colleges_lycees", "Lycée": "colleges_lycees"}

PLANCHER_ECOLES = 30_000  # en dessous, ce n'est plus l'annuaire qu'on lit

INDICATEURS = {
    "menj_ecoles": (
        "Écoles",
        "Le nombre d'écoles maternelles et élémentaires ouvertes dans la commune,"
        " publiques et privées sous contrat comptées ensemble. Zéro est une"
        " information : beaucoup de communes rurales n'ont plus d'école. Un"
        " nombre se lit pour sa commune, pas en palmarès entre villes de"
        " tailles différentes.",
    ),
    "menj_colleges_lycees": (
        "Collèges et lycées",
        "Le nombre de collèges et de lycées ouverts dans la commune, publics et"
        " privés sous contrat réunis. La carte scolaire dépasse la commune : un"
        " zéro dit qu'on étudie ailleurs, pas qu'on n'étudie pas.",
    ),
}


# Mailles chargées, et la colonne de l'annuaire qui porte chacune. Les codes
# départementaux sont ceux du Code officiel géographique — 67, 68 et 69 —, et
# non le cadre de l'OFGL qui leur substitue l'Alsace et la métropole lyonnaise.
# C'est déjà le cadre de tous les jeux INSEE du site : les décès sont publiés
# sur 101 départements, l'OFGL sur 97. Deux cadres cohabitent, chacun cohérent
# avec sa source.
COLONNES_GEO = {
    "commune": "code_commune",
    "departement": "code_departement",
    "region": "code_region",
}


def url_export() -> str:
    colonnes = ",".join(
        ["identifiant_de_l_etablissement", *COLONNES_GEO.values(), "type_etablissement", "etat"]
    )
    return f"{ods.export_url(BASE, JEU)}?select={colonnes}"


def url_metadonnees() -> str:
    """La fiche du jeu, qui porte la date de dernière mise à jour des données."""
    return f"{BASE}/catalog/datasets/{JEU}"


def annee_scolaire(horodatage: str) -> str:
    """Date de mise à jour du portail -> année scolaire qu'elle décrit.

    L'année scolaire est celle de sa rentrée : une extraction du 6 août 2026
    décrit la rentrée 2025, encore en cours, pas la rentrée 2026 qui n'a pas eu
    lieu. La bascule est fixée au 1er septembre — c'est une convention, elle est
    écrite dans la fiche technique, et elle vaut mieux que l'année civile qui
    coupe une année scolaire en deux.
    """
    date = datetime.fromisoformat(horodatage.replace("Z", "+00:00"))
    return str(date.year if date.month >= 9 else date.year - 1)


def date_de_la_source(contenu: bytes) -> str:
    """`data_processed` de la fiche du jeu, ou l'échec plutôt qu'une supposition.

    Se rabattre sur l'horloge en cas d'absence rendrait le défaut invisible le
    jour où le portail change de format : mieux vaut que le run s'arrête.
    """
    metas = (json.loads(contenu).get("metas") or {}).get("default") or {}
    date = metas.get("data_processed") or metas.get("modified")
    if not date:
        raise ValueError(
            f"le portail ne date plus le jeu {JEU} : ni data_processed ni modified"
        )
    return str(date)


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, (libelle, publique) in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (
                    publique,
                    "Annuaire de l'éducation nationale (MENJ), établissements à l'état"
                    " OUVERT, comptés par les codes commune, département et région que"
                    " porte chaque établissement. Le département suit le Code officiel"
                    " géographique (101 départements, dont le Bas-Rhin et le Haut-Rhin"
                    " distincts) et non le cadre de l'OFGL. L'annuaire est un répertoire"
                    " vivant, sans année scolaire dans ses lignes : la période retenue"
                    " est l'année scolaire que décrit la date de mise à jour publiée par"
                    " le portail, l'année de sa rentrée de septembre.",
                    f"MENJ, annuaire {JEU}, comptage par territoire",
                ),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, 'education', ?, 'count', true,
                        array['commune','departement','region'], 'annuelle', true)
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


# Longueur attendue d'un code, par maille. Un code court est un code tronqué
# par un tableur quelque part en amont : « 1 » pour l'Ain plutôt que « 01 ».
LONGUEURS = {"commune": 5, "departement": (2, 3), "region": (2,)}


def compter(contenu: bytes) -> tuple[dict[str, dict[str, Counter]], int]:
    """CSV d'export -> comptages par maille et par famille, et le total lu.

    Seuls les établissements OUVERT comptent : un établissement « à fermer »
    est encore ouvert administrativement mais le compter figerait le passé.

    Les trois mailles sont comptées **du même établissement au même moment**,
    depuis les colonnes que l'annuaire porte lui-même. C'est ce qui rend le
    contrôle bloquant possible : trois totaux tirés d'un seul parcours doivent
    coïncider, et s'ils divergent c'est qu'un code est tombé.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    comptes: dict[str, dict[str, Counter]] = {
        niveau: {"ecoles": Counter(), "colleges_lycees": Counter()} for niveau in COLONNES_GEO
    }
    lus = 0
    for rang in lecteur:
        lus += 1
        if (rang.get("etat") or "").strip().upper() != "OUVERT":
            continue
        famille = TYPES.get((rang.get("type_etablissement") or "").strip())
        if not famille:
            continue
        for niveau, colonne in COLONNES_GEO.items():
            code = (rang.get(colonne) or "").strip()
            if niveau == "departement":
                # « 033 » chez le producteur, « 33 » au référentiel. Voir
                # geo.departement_cog : charger le code brut ne fait rien
                # échouer, il vide simplement la carte départementale.
                code = departement_cog(code)
            if niveau == "commune" and len(code) == 5:
                # L'annuaire code Paris, Lyon et Marseille par arrondissement :
                # sans rattachement à la commune, Paris affichait « 0 école » —
                # un zéro honnêtement écrit, et faux. Troisième source,
                # troisième variante du même piège PLM ; le rattachement vit
                # dans geo.commune_mere.
                code = commune_mere(code) or code
            longueurs = LONGUEURS[niveau]
            if len(code) in (longueurs if isinstance(longueurs, tuple) else (longueurs,)):
                comptes[niveau][famille][code] += 1
    return comptes, lus


def univers(conn, niveau: str) -> list[str]:
    """Les territoires qui doivent recevoir une ligne, zéro compris.

    Les collectivités à statut particulier — Alsace, métropole de Lyon — sont
    écartées à la maille départementale : elles appartiennent au cadre de
    l'OFGL, pas à celui du Code officiel géographique dans lequel l'annuaire
    code ses établissements. Leur écrire un zéro afficherait « aucune école en
    Alsace », ce qui serait faux, et le laisser vide est ici la bonne réponse —
    le Bas-Rhin et le Haut-Rhin portent le chiffre.
    """
    return [
        code for (code,) in conn.execute(
            """
            select geo_code from geo.geography_reference
            where geo_level = $niveau and vintage = $millesime
              and json_extract_string(flags, '$.statut_particulier') is null
            """,
            {"niveau": niveau, "millesime": MILLESIME},
        ).fetchall()
    ]


def ecrire(
    conn, run_id: str, comptes: dict[str, dict[str, Counter]], periode: str
) -> tuple[int, int, int, dict[str, int]]:
    """Tous les territoires du référentiel reçoivent une ligne — zéro compris.

    Renvoie aussi, par maille, le nombre d'établissements **réellement écrits** :
    c'est lui que `controler_couverture` compare au nombre lu. Un code que le
    référentiel ignore disparaît ici sans bruit, et c'est ce silence qu'il faut
    mesurer.
    """
    lignes = []
    hors_referentiel = 0
    reconnus: dict[str, int] = {}
    for niveau in COLONNES_GEO:
        connus = univers(conn, niveau)
        attendus = set(connus)
        for indicateur, famille in (("menj_ecoles", "ecoles"),
                                    ("menj_colleges_lycees", "colleges_lycees")):
            compte = comptes[niveau][famille]
            for code in connus:
                lignes.append(
                    (indicateur, niveau, code, MILLESIME, periode, compte.get(code, 0))
                )
        reconnus[niveau] = sum(
            valeur
            for famille in comptes[niveau].values()
            for code, valeur in famille.items()
            if code in attendus
        )
        hors_referentiel += sum(
            1
            for famille in comptes[niveau].values()
            for code in famille
            if code not in attendus
        )
    ecrites, revisees = revisions.remplacer(
        conn, run_id, list(INDICATEURS), ("value",), lignes
    )
    return ecrites, revisees, hors_referentiel, reconnus


class TotauxDivergents(RuntimeError):
    """Les trois mailles ne comptent pas le même annuaire."""


# Part du fichier qu'une maille doit retrouver dans le référentiel. En dessous,
# c'est que les codes ne parlent pas la même langue que lui. Le seuil laisse
# passer les collectivités que le référentiel départemental ne porte pas —
# Saint-Pierre-et-Miquelon, Wallis, la Polynésie, la Nouvelle-Calédonie — sans
# laisser passer un format de code qui aurait glissé.
COUVERTURE_MINIMALE = 0.95


class CouvertureInsuffisante(RuntimeError):
    """Trop de codes de la source sont inconnus du référentiel."""


def controler_couverture(
    comptes: dict[str, dict[str, Counter]], reconnus: dict[str, int]
) -> dict[str, float]:
    """Contrôle bloquant : ce qu'on écrit couvre bien ce qu'on a lu.

    Le contrôle des totaux vérifie que le fichier est cohérent avec lui-même.
    Il ne dit rien de l'accord entre ses codes et les nôtres — et c'est
    précisément là qu'un défaut est passé en production : des codes
    départementaux zéro-padés, cohérents entre eux, inconnus du référentiel, et
    une carte départementale à 1 511 écoles au lieu de 47 109. Ce contrôle-ci
    compare ce qui est écrit à ce qui est lu, maille par maille.
    """
    parts = {}
    for maille, familles in comptes.items():
        lu = sum(sum(compte.values()) for compte in familles.values())
        part = reconnus[maille] / lu if lu else 1.0
        parts[maille] = part
        if part < COUVERTURE_MINIMALE:
            raise CouvertureInsuffisante(
                f"{maille} : {reconnus[maille]} sur {lu} retrouvés au référentiel"
                f" ({100 * part:.1f} %) — les codes de la source ne sont pas au"
                " format du Code officiel géographique"
            )
    return parts


def controler(comptes: dict[str, dict[str, Counter]]) -> dict[str, dict[str, int]]:
    """Contrôle bloquant : les trois mailles totalisent le même annuaire.

    Chaque établissement porte sa commune, son département et sa région dans la
    même ligne : les trois comptages sortent d'un seul parcours et doivent donc
    coïncider exactement. Un écart ne peut venir que d'un code tombé — tronqué,
    vide, hors référentiel —, et c'est précisément ce qu'aucun total isolé ne
    montrerait. Le comptage communal, lui, exclut les codes à quatre chiffres et
    rattache les arrondissements de Paris, Lyon et Marseille : c'est le seul
    endroit où les trois peuvent légitimement diverger, et le contrôle porte
    donc sur les deux mailles que rien ne retouche.
    """
    totaux = {
        niveau: {famille: sum(compte.values()) for famille, compte in familles.items()}
        for niveau, familles in comptes.items()
    }
    for famille in ("ecoles", "colleges_lycees"):
        if totaux["departement"][famille] != totaux["region"][famille]:
            raise TotauxDivergents(
                f"{famille} : {totaux['departement'][famille]} au département contre"
                f" {totaux['region'][famille]} à la région — un code géographique est tombé"
            )
    return totaux


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        avant = garde_fou_volume(conn)
        # La fiche du jeu d'abord : c'est elle qui date la donnée, et cette date
        # décide de la période. L'archiver la rend vérifiable après coup — sans
        # quoi la période resterait une affirmation du code.
        url_meta = url_metadonnees()
        metadonnees = telecharger(url_meta, timeout=120)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "annuaire-education-fiche.json",
            metadonnees, url_meta, "application/json",
        )
        publiee = date_de_la_source(metadonnees)
        periode = annee_scolaire(publiee)
        entrepot.etape(f"annuaire publié le {publiee} -> année scolaire {periode}")

        url = url_export()
        contenu = telecharger(url, timeout=600)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "annuaire-education.csv", contenu, url,
            "text/csv",
        )
        comptes, lus = compter(contenu)
        total_ecoles = sum(comptes["commune"]["ecoles"].values())
        if total_ecoles < PLANCHER_ECOLES:
            raise ValueError(
                f"{total_ecoles} écoles lues, plancher {PLANCHER_ECOLES} :"
                " le format de l'annuaire a dû changer"
            )
        totaux = controler(comptes)
        ecrites, revisees, hors_referentiel, reconnus = ecrire(
            conn, run_id, comptes, periode
        )
        # Après l'écriture mais avant la validation : la transaction n'est pas
        # committée ici, un refus laisse donc l'entrepôt intact.
        couverture = controler_couverture(comptes, reconnus)
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'totaux_et_couverture_aux_trois_mailles', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "etablissements_lus": lus,
                "periode": periode,
                "publiee": publiee,
                "totaux": totaux,
                "couverture": {m: round(p, 4) for m, p in couverture.items()},
                "hors_referentiel": hors_referentiel,
            })),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=lus, rows_written=ecrites)
        apres = entrepot.taille(conn)
        print(
            f"éducation {periode} : {ecrites} observations ({total_ecoles} écoles,"
            f" {sum(comptes['commune']['colleges_lycees'].values())} collèges-lycées),"
            f" {hors_referentiel} hors référentiel, {revisees} valeurs révisées"
        )
        print(f"volume base : {avant // 1024 // 1024} -> {apres // 1024 // 1024} Mo")
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
