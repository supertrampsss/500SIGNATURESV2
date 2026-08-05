"""Retire l'intercommunalité de l'entrepôt : territoires, observations, lineage.

Le niveau a été retiré du produit. Le code ne l'écrit plus, mais l'entrepôt le
contient encore : le supprimer du code ne supprime pas ce qui y a été écrit, et
un fichier de un gigaoctet fait l'aller-retour avec le bucket à chaque run de CI.

Mesuré avant retrait : 1 266 territoires, ≈ 719 000 observations sur 102 des 207
indicateurs, 557 fichiers de carte à chaque publication et 15 Mo pour le seul
`territoires/epci/tous.json`.

**Ce qui est supprimé, et pourquoi seulement cela.**

Les données du niveau — territoires, observations, révisions — n'ont plus de
lecteur : rien ne les publie, rien ne les interroge.

Le lineage de deux jeux l'accompagne : `geo-api-epci` et `ofgl-gfp` n'ont plus
de connecteur. Sans cette suppression, `meta.dataset_registry` continuerait de
les déclarer et `alertes.py` les signalerait en retard de fraîcheur chaque jour
un peu plus — une alerte permanente sur des jeux qu'on a décidé de ne plus
charger n'est pas une alerte, c'est du bruit qui masque les vraies.

Les instantanés bruts, eux, **restent dans le bucket**. Ils sont immuables par
principe : ce qui a été téléchargé un jour reste vérifiable, même si on ne s'en
sert plus. C'est l'index qui disparaît, pas la matière.

**Ce qui n'est pas touché.** Le vocabulaire `geo_level` de `schema.sql` liste
toujours `'epci'`, à côté de six autres niveaux jamais chargés. Y toucher
changerait l'empreinte du schéma, et `entrepot.connect()` refuserait alors
d'ouvrir l'entrepôt existant — un rechargement complet pour retirer un mot d'une
contrainte que plus rien ne franchit.

Idempotent : une seconde exécution ne supprime rien et le dit.

Usage : python -m plateforme.retrait_interco [--sec]
"""

import argparse

from plateforme import entrepot

NIVEAU = "epci"

# Jeux dont l'intercommunalité était la seule raison d'être. `ofgl-communes`,
# `ofgl-departements` et `ofgl-regions` restent : seul le jeu des groupements à
# fiscalité propre disparaît.
JEUX_RETIRES = ("geo-api-epci", "ofgl-gfp")

# L'ordre compte : `entrepot.verifier_integrite` contrôle après coup les
# rattachements que DuckDB ne contraint pas. Supprimer un run avant les
# observations qui le citent laisserait des orphelins — et le run suivant
# échouerait sur un défaut qu'on aurait créé nous-mêmes.
SUPPRESSIONS = [
    ("core.observations", "delete from core.observations where geo_level = $niveau"),
    (
        "core.observations_revisions",
        "delete from core.observations_revisions where geo_level = $niveau",
    ),
    (
        "fin.public_budget_lines",
        "delete from fin.public_budget_lines where budget_id in"
        " (select budget_id from fin.public_budgets where geo_level = $niveau)",
    ),
    ("fin.public_budgets", "delete from fin.public_budgets where geo_level = $niveau"),
    ("geo.geography_reference", "delete from geo.geography_reference where geo_level = $niveau"),
    ("meta.raw_assets", "delete from meta.raw_assets where list_contains($jeux, dataset_id)"),
    (
        "meta.data_quality_checks",
        "delete from meta.data_quality_checks where list_contains($jeux, dataset_id)",
    ),
    ("meta.change_log", "delete from meta.change_log where list_contains($jeux, dataset_id)"),
    (
        "meta.ingestion_runs",
        "delete from meta.ingestion_runs where list_contains($jeux, dataset_id)",
    ),
    (
        "meta.dataset_registry",
        "delete from meta.dataset_registry where list_contains($jeux, dataset_id)",
    ),
]


def blocages(conn) -> list[str]:
    """Ce qui rendrait le retrait destructeur, vérifié **avant** d'écrire.

    DuckDB ne contraint pas ces rattachements : `entrepot.verifier_integrite`
    les relit après coup, et à ce moment-là la suppression est déjà faite. Un
    contrôle a posteriori ne protège de rien — il constate. Celui-ci refuse.

    Le cas réel qu'il garde : les indicateurs de l'OFGL sont tous déclarés sous
    `ofgl-communes`, quel que soit le niveau chargé. `ofgl-gfp` n'en porte donc
    aucun, et le catalogue publié ne bouge pas. Si cette convention changeait,
    supprimer le jeu emporterait des indicateurs encore observés ailleurs.
    """
    empeche = []
    for table, colonne in (
        ("core.indicators", "dataset_id"),
        ("fin.public_budgets", "dataset_id"),
    ):
        requete = (
            f"select count(*) from {table} where list_contains($jeux, {colonne})"
            f"{' and geo_level <> $niveau' if table == 'fin.public_budgets' else ''}"
        )
        restants = conn.execute(requete, _parametres(requete)).fetchone()[0]
        if restants:
            empeche.append(f"{table}.{colonne} : {restants} lignes citent encore ces jeux")
    return empeche


def _parametres(requete: str) -> dict:
    """DuckDB refuse un paramètre nommé que la requête n'emploie pas : chacune
    ne reçoit donc que les siens."""
    tous = {"niveau": NIVEAU, "jeux": list(JEUX_RETIRES)}
    return {nom: valeur for nom, valeur in tous.items() if f"${nom}" in requete}


def compter(conn) -> dict[str, int]:
    """Ce que chaque suppression retirerait, avant de la faire."""
    return {
        table: conn.execute(
            requete.replace("delete from", "select count(*) from", 1), _parametres(requete)
        ).fetchone()[0]
        for table, requete in SUPPRESSIONS
    }


def indicateurs_vides(conn) -> list[str]:
    """Indicateurs qui n'auraient plus aucune observation après le retrait.

    Aucun n'est attendu : les connecteurs chargent l'intercommunalité **en plus**
    des communes, jamais seule. S'il en apparaît un, c'est une perte réelle de
    catalogue et elle doit se voir — pas se découvrir sur le site.
    """
    return [
        indicateur
        for (indicateur,) in conn.execute(
            """
            select i.indicator_id from core.indicators i
             where not exists (
                   select 1 from core.observations o
                    where o.indicator_id = i.indicator_id and o.geo_level <> $niveau)
             order by i.indicator_id
            """,
            {"niveau": NIVEAU},
        ).fetchall()
    ]


def run(sec: bool = False) -> int:
    conn = entrepot.connect()
    try:
        avant = compter(conn)
        total = sum(avant.values())
        for table, nombre in avant.items():
            print(f"  {table} : {nombre}")
        perdus = indicateurs_vides(conn)
        if perdus:
            print(f"  ATTENTION — {len(perdus)} indicateurs n'existent qu'à ce niveau :")
            for indicateur in perdus:
                print(f"    {indicateur}")
        empeche = blocages(conn)
        for motif in empeche:
            print(f"  BLOCAGE — {motif}")
        if sec:
            print(f"à sec : {total} lignes seraient supprimées, rien n'a été écrit")
            return 1 if empeche else 0
        if empeche:
            raise RuntimeError("retrait refusé : " + " ; ".join(empeche))
        if not total:
            print("rien à retirer : l'entrepôt ne contient plus d'intercommunalité")
            return 0

        taille_avant = entrepot.taille(conn)
        for _, requete in SUPPRESSIONS:
            conn.execute(requete, _parametres(requete))
        conn.commit()

        orphelins = entrepot.verifier_integrite(conn)
        if orphelins:
            raise RuntimeError(
                "retrait annulé : il reste des rattachements rompus "
                + ", ".join(f"{t}.{c} ({n})" for t, c, n in orphelins)
            )
        # Le fichier n'est réécrit qu'au checkpoint : sans lui, l'entrepôt
        # renvoyé au bucket pèserait toujours ce qu'il pesait avant.
        conn.execute("force checkpoint")
        taille_apres = entrepot.taille(conn)
        print(
            f"retrait : {total} lignes supprimées, entrepôt"
            f" {taille_avant // 1024 // 1024} -> {taille_apres // 1024 // 1024} Mo"
        )
        return 0
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sec", action="store_true", help="compte sans supprimer"
    )
    return run(parser.parse_args().sec)


if __name__ == "__main__":
    raise SystemExit(main())
