"""Logement social par territoire (RPLS, SDES) vers core.observations.

« Combien de logements sociaux dans ma commune ? » — et la réponse ne vient pas
du recensement. Le parc social du recensement est **déclaré par les ménages** :
on demande aux habitants s'ils logent dans un HLM, et beaucoup se trompent dans
un sens comme dans l'autre. Le répertoire des logements locatifs des bailleurs
sociaux, lui, part des **bailleurs** et de leurs logements, un par un. C'est ce
répertoire qui fait foi pour la loi SRU, et les deux chiffres diffèrent
franchement pour la même commune la même année. Les deux sont publiés ici, et
chaque fiche nomme l'autre — les confondre ferait dire à une commune qu'elle
respecte ou viole une obligation légale sur la foi du mauvais comptage.

**On ne télécharge pas les adresses.** Le fichier source décrit chaque logement
par son numéro de voie, son étage, ses coordonnées X/Y et son IRIS : 73
colonnes, 5,4 millions de lignes. Rien de tout cela n'est nécessaire pour
compter par commune, et l'API du SDES sait ne servir que les colonnes
demandées. Quatre sont demandées ; les adresses ne quittent jamais le serveur du
producteur, et l'instantané archivé n'en contient aucune. C'est la règle des
données agrégées appliquée en amont plutôt qu'après coup.

**Les passoires thermiques, et ce qui manque pour les compter.** L'étiquette
énergie F ou G désigne les logements les plus coûteux à chauffer, et la loi
organise leur sortie progressive de la location. Le répertoire la porte — mais
douze pour cent des logements n'en ont aucune, et un logement sans étiquette
n'est pas un logement bien classé. L'indicateur compte donc les F et G *parmi
les logements étiquetés*, et sa fiche donne la part du parc qui échappe au
comptage. Publier un taux sur le parc entier ferait passer une absence de
diagnostic pour une bonne performance.

**Le contrôle qui bloque.** Chaque logement porte sa commune, son département
et sa région sur la même ligne : les trois comptages sortent d'un seul parcours
et doivent coïncider exactement. Un écart ne peut venir que d'un code tombé, et
aucun total pris isolément ne le montrerait.

Usage : python -m plateforme.normalize.logement_social [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
from collections import Counter

from plateforme import couverture, entrepot, revisions
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, commune_mere, departement_cog, make_store

DATASET = "rpls-logement-social"
SOURCE = "sdes"
BASE = "https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1"
FICHIER = "f3c2f2cb-8fb1-40fd-8733-964247744c9a"

# Millésime du répertoire, au 1er janvier. Le SDES en publie plusieurs sous le
# même identifiant de fichier ; celui-ci est déclaré par la fiche du fichier
# (`millesime`), et c'est lui qu'on charge. Les millésimes antérieurs ne sont
# plus servis à cette adresse — vérifié le 6 août 2026, une demande de
# `2023-01` rend six lignes.
MILLESIME_RPLS = "2025-01"
PERIODE = MILLESIME_RPLS[:4]

# Les quatre seules colonnes demandées. Le fichier en compte 73, dont le numéro
# de voie, l'étage et les coordonnées de chaque logement : ne pas les demander
# vaut mieux que les recevoir puis les jeter.
COLONNES = ["DEPCOM", "DEP_CODE", "REG_CODE", "DPEENERGIE"]

MAILLES = {"commune": "DEPCOM", "departement": "DEP_CODE", "region": "REG_CODE"}
LONGUEURS = {"commune": (5,), "departement": (2, 3), "region": (2,)}

# Étiquettes énergie que la loi désigne comme les plus mauvaises. « E » n'en est
# pas : le calendrier légal porte sur G puis F, et y ajouter E de notre propre
# chef ferait dire au chiffre autre chose que ce que la loi dit.
PASSOIRES = {"F", "G"}

# Plancher de vraisemblance : la France compte environ 5,4 millions de logements
# locatifs sociaux. En dessous de quatre millions, ce n'est plus le répertoire
# qu'on lit — c'est un fichier tronqué ou un format qui a changé.
PLANCHER = 4_000_000

INDICATEURS = {
    "rpls_logements_sociaux": (
        # Le libellé nomme la source, pas seulement l'objet. Il a longtemps
        # voisiné avec « Logements du parc social » du recensement, et les deux
        # se lisaient comme un doublon alors qu'ils comptent deux choses. Le
        # recensement n'est plus publié ; le libellé garde la précision, parce
        # que c'est elle qui dit pourquoi ce chiffre-là fait foi.
        "Logements sociaux (répertoire des bailleurs)",
        "Le nombre de logements locatifs sociaux du territoire, comptés un par un"
        " chez les bailleurs. C'est le comptage qui fait foi pour la loi SRU. Le"
        " parc social du recensement, déclaré par les habitants, donne un autre"
        " chiffre.",
    ),
    "rpls_logements_sociaux_etiquetes": (
        "Logements sociaux avec étiquette énergie",
        "Le nombre de logements sociaux dont le diagnostic de performance"
        " énergétique est connu. Environ un sur huit n'en a pas : il ne peut ni"
        " être compté parmi les passoires, ni supposé bien classé.",
    ),
    "rpls_logements_sociaux_passoires": (
        "Logements sociaux très mal isolés (F ou G)",
        "Le nombre de logements sociaux classés F ou G au diagnostic énergétique :"
        " les plus chers à chauffer, que la loi retire progressivement de la"
        " location. À rapporter aux logements étiquetés, pas au parc entier.",
    ),
}

TECHNIQUE = (
    "Répertoire des logements locatifs des bailleurs sociaux (RPLS, SDES), données"
    f" détaillées au logement au 1er janvier {PERIODE}, agrégées par ce site aux"
    " codes commune, département et région que porte chaque logement. Le"
    " département suit le Code officiel géographique. Le répertoire recense les"
    " logements des bailleurs sociaux : il ne se confond ni avec le parc social"
    " déclaré au recensement, ni avec l'inventaire SRU arrêté par le préfet."
)


class TotauxDivergents(RuntimeError):
    """Les trois mailles ne comptent pas le même répertoire."""


def url_export(millesime: str = MILLESIME_RPLS) -> str:
    """Export CSV restreint aux colonnes utiles, pour le millésime voulu."""
    return (
        f"{BASE}/datafiles/{FICHIER}/csv"
        f"?columns={','.join(COLONNES)}&millesime={millesime}&withColumnName=true"
    )


def url_fiche() -> str:
    return f"{BASE}/datafiles/{FICHIER}"


def compter(contenu: bytes) -> tuple[dict[str, dict[str, Counter]], int]:
    """CSV du répertoire -> comptages par maille, et le nombre de logements lus.

    Trois comptages par maille : le parc, la part du parc qui porte une étiquette
    énergie, et les logements classés F ou G. Les trois sortent d'un seul
    parcours — c'est ce qui rend le contrôle bloquant possible.
    """
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    comptes: dict[str, dict[str, Counter]] = {
        maille: {"parc": Counter(), "etiquetes": Counter(), "passoires": Counter()}
        for maille in MAILLES
    }
    lus = 0
    for rang in lecteur:
        lus += 1
        etiquette = (rang.get("DPEENERGIE") or "").strip().upper()
        for maille, colonne in MAILLES.items():
            code = (rang.get(colonne) or "").strip()
            if maille == "departement":
                code = departement_cog(code)
            elif maille == "commune" and len(code) == 5:
                # Quatrième source, quatrième fois le même piège. Le répertoire
                # code Paris, Lyon et Marseille par arrondissement ; sans
                # rattachement, Paris sortait à zéro logement social quand il en
                # compte 250 640, et aucun contrôle interne au fichier ne le
                # voyait — les totaux départementaux, eux, étaient justes.
                code = commune_mere(code) or code
            if len(code) not in LONGUEURS[maille]:
                continue
            comptes[maille]["parc"][code] += 1
            if etiquette:
                comptes[maille]["etiquetes"][code] += 1
                if etiquette in PASSOIRES:
                    comptes[maille]["passoires"][code] += 1
    return comptes, lus


def controler(comptes: dict[str, dict[str, Counter]]) -> dict[str, dict[str, int]]:
    """Contrôle bloquant : les trois mailles totalisent le même répertoire.

    Le total communal peut légitimement être inférieur — un logement dont le code
    commune est tombé garde son département —, mais le département et la région
    n'ont aucune raison de diverger. Un écart signale un code géographique perdu.
    """
    totaux = {
        maille: {mesure: sum(compte.values()) for mesure, compte in mesures.items()}
        for maille, mesures in comptes.items()
    }
    for mesure in ("parc", "etiquetes", "passoires"):
        if totaux["departement"][mesure] != totaux["region"][mesure]:
            raise TotauxDivergents(
                f"{mesure} : {totaux['departement'][mesure]} au département contre"
                f" {totaux['region'][mesure]} à la région —"
                " un code géographique est tombé"
            )
    if totaux["departement"]["passoires"] > totaux["departement"]["etiquetes"]:
        raise TotauxDivergents(
            "plus de passoires que de logements étiquetés : les deux comptages ne"
            " portent pas sur le même ensemble"
        )
    return totaux


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
                (publique, TECHNIQUE, f"RPLS {PERIODE}, comptage de logements par territoire"),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, 'logement', ?, 'count', true,
                        array['commune','departement','region'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
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


def univers(conn, niveau: str) -> list[str]:
    """Les territoires qui doivent recevoir une ligne, zéro compris.

    Zéro logement social est une information — c'est même le cœur du débat SRU.
    L'univers vient donc du référentiel, jamais du répertoire. Les collectivités
    à statut particulier sont écartées à la maille départementale : le répertoire
    code au Code officiel géographique, où l'Alsace n'existe pas.
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


MESURES = (
    ("rpls_logements_sociaux", "parc"),
    ("rpls_logements_sociaux_etiquetes", "etiquetes"),
    ("rpls_logements_sociaux_passoires", "passoires"),
)


def ecrire(
    conn, run_id: str, comptes: dict[str, dict[str, Counter]]
) -> tuple[int, int, int, dict[str, int]]:
    """Renvoie aussi, par maille, le nombre de logements **réellement écrits**.

    C'est lui que `couverture.controler` compare au nombre lu : un code que le
    référentiel ignore disparaît ici sans bruit, et c'est ce silence qu'il faut
    mesurer.
    """
    lignes = []
    hors_referentiel = 0
    reconnus: dict[str, int] = {}
    for maille in MAILLES:
        connus = univers(conn, maille)
        attendus = set(connus)
        for indicateur, mesure in MESURES:
            compte = comptes[maille][mesure]
            for code in connus:
                lignes.append(
                    (indicateur, maille, code, MILLESIME, PERIODE, compte.get(code, 0))
                )
        reconnus[maille] = sum(
            valeur for code, valeur in comptes[maille]["parc"].items() if code in attendus
        )
        hors_referentiel += sum(
            1 for code in comptes[maille]["parc"] if code not in attendus
        )
    ecrites, revisees = revisions.remplacer(
        conn, run_id, list(INDICATEURS), ("value",), lignes
    )
    return ecrites, revisees, hors_referentiel, reconnus


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        avant = garde_fou_volume(conn)
        fiche = telecharger(url_fiche(), timeout=120)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"rpls-{PERIODE}-fiche.json", fiche,
            url_fiche(), "application/json",
        )
        entrepot.etape(f"millésime {MILLESIME_RPLS}, quatre colonnes sur soixante-treize")

        url = url_export()
        contenu = telecharger(url, timeout=900)
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, f"rpls-{PERIODE}.csv", contenu, url,
            "text/csv",
        )
        entrepot.etape(f"{len(contenu) // 1024 // 1024} Mo reçus, comptage en cours")

        comptes, lus = compter(contenu)
        if lus < PLANCHER:
            raise ValueError(
                f"{lus} logements lus, plancher {PLANCHER} : le fichier est tronqué"
                " ou son format a changé"
            )
        totaux = controler(comptes)
        ecrites, revisees, hors_referentiel, reconnus = ecrire(conn, run_id, comptes)
        # Après l'écriture, avant la validation : un refus laisse l'entrepôt
        # intact. C'est ce contrôle qui a rattrapé Paris à zéro logement social.
        parts = couverture.controler(
            {maille: totaux[maille]["parc"] for maille in MAILLES}, reconnus
        )
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'totaux_et_couverture_aux_trois_mailles', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                "logements_lus": lus,
                "millesime": MILLESIME_RPLS,
                "totaux": totaux,
                "couverture": {m: round(v, 4) for m, v in parts.items()},
                "hors_referentiel": hors_referentiel,
            })),
        )
        conn.commit()
        entrepot.finish_run(conn, run_id, "success", rows_read=lus, rows_written=ecrites)
        apres = entrepot.taille(conn)
        parc = totaux["commune"]["parc"]
        etiquetes = totaux["commune"]["etiquetes"]
        passoires = totaux["commune"]["passoires"]
        print(
            f"logement social {PERIODE} : {ecrites} observations, {parc} logements,"
            f" {passoires} passoires sur {etiquetes} étiquetés"
            f" ({100 * passoires / etiquetes:.1f} %),"
            f" {100 * (lus - etiquetes) / lus:.1f} % du parc sans étiquette"
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
