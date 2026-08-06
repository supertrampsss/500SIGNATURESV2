"""Ce que ma commune encaisse, impôt par impôt (REI, DGFiP republié par l'OFGL).

Le site publiait un total — « impôts locaux » de l'OFGL — et des taux. Il ne
disait pas **d'où vient l'argent** : combien rapporte le foncier bâti, combien
le non bâti, combien la taxe d'habitation qui reste, combien la fiscalité
économique. Ce module le dit, commune par commune.

**La taxe d'habitation sur les résidences principales n'existe plus.** Elle a
été supprimée pour tous les ménages en 2023. Ce qui subsiste sous ce nom est la
taxe sur les **résidences secondaires** et celle sur les logements vacants :
publier « taxe d'habitation » sans le préciser laisserait croire à un
effondrement du produit, alors que c'est l'impôt lui-même qui a changé de
périmètre. L'identifiant et le libellé portent donc la mention.

**La CFE est le plus souvent perçue par l'intercommunalité, pas par la
commune.** La source ne donne un produit communal qu'à 12 100 couples
commune-exercice, contre 69 829 pour le foncier bâti. Une commune sans produit
de CFE n'est pas une commune sans entreprises : c'est une commune qui a
transféré sa fiscalité économique. La fiche le dit, faute de quoi la carte
serait lue à l'envers.

**Ce n'est pas le total des impôts locaux.** L'OFGL publie déjà cet agrégat sur
son propre périmètre ; ces quatre produits n'en sont pas la décomposition
exacte, et les additionner pour le retrouver serait une reconstruction, pas une
mesure. Chacun se lit pour lui-même.

**Le contrôle qui bloque.** La source publie, pour le même impôt et la même
commune, la base nette, le taux voté et le produit. Leur produit doit se
retrouver : à Bordeaux en 2025, 512 239 528 € de base au taux de 48,48 % font
248,3 M€ contre 248,4 M€ publiés — l'écart vient du lissage, que la source
publie aussi. Le contrôle admet donc un pour cent, et il attraperait un taux ou
une base lus sur la mauvaise ligne, ce qu'aucun total ne montrerait.

Usage : python -m plateforme.normalize.impots_locaux [--store r2:plateforme-raw]
"""

import argparse
import csv
import io
import json
import urllib.parse

from plateforme import couverture, entrepot
from plateforme.http import telecharger
from plateforme.limites import garde_fou_volume
from plateforme.normalize.geo import MILLESIME, make_store
from plateforme.normalize.ofgl import filtrer_territoires_connus

DATASET = "ofgl-rei"
SOURCE = "ofgl"
BASE = "https://data.ofgl.fr/api/explore/v2.1/catalog/datasets/rei"

# Le REI décrit vingt-cinq dispositifs fiscaux sous dix catégories et quatorze
# destinataires. Seul ce qui revient à la **commune** est chargé : la même base
# nourrit aussi l'intercommunalité, le département et les chambres consulaires,
# et tout lire ferait compter le même euro plusieurs fois.
DESTINATAIRE = "Commune"

# Libellé de variable de la source -> (identifiant, libellé publié).
PRODUITS = {
    "FB - COMMUNE / MONTANT RÉEL": (
        "dgfip_produit_foncier_bati", "Produit de la taxe foncière (bâti)",
    ),
    "FNB - COMMUNE / MONTANT RÉEL": (
        "dgfip_produit_foncier_non_bati", "Produit de la taxe foncière (non bâti)",
    ),
    "TH - COMMUNE / MONTANT RÉEL THS": (
        "dgfip_produit_th_residences_secondaires",
        "Produit de la taxe d'habitation sur les résidences secondaires",
    ),
    "CFE - COMMUNE / PRODUIT RÉEL": (
        "dgfip_produit_cfe", "Produit de la cotisation foncière des entreprises",
    ),
}

# Les trois lignes du foncier bâti que le contrôle confronte.
BASE_FB = "FB - COMMUNE / BASE NETTE"
TAUX_FB = "FB - COMMUNE / TAUX VOTÉ"
LISSAGE_FB = "FB - COMMUNE / LISSAGE - MONTANT"
PRODUIT_FB = "FB - COMMUNE / MONTANT RÉEL"

# Le contrôle porte sur la **distribution** des écarts, pas sur chaque commune.
# Mesuré sur les 69 673 couples commune-exercice de la source : écart médian
# 0,006 %, neuf communes sur dix sous 0,11 %, quatre-vingt-dix-neuf sur cent
# sous 0,64 % — mais une queue qui va jusqu'à 13 %, sur 308 communes au-dessus
# de 1 %. La source applique des corrections qu'elle n'expose pas toutes ; bloquer
# le chargement entier sur la commune la plus atypique serait une fausse alerte.
# Ce qu'on exige, c'est que l'identité tienne en masse et au total — ce qui suffit
# à attraper un taux ou une base lus sur la mauvaise ligne, défaut qui décalerait
# toutes les communes à la fois.
ECART_MEDIAN_MAXIMUM = 0.001  # 0,1 %, seize fois la médiane observée
PART_MINIMALE_SOUS_UN_POURCENT = 0.99
ECART_AGREGE_MAXIMUM = 0.005  # 0,5 % sur la somme France

THEME = "impots_locaux"

PUBLIQUE = {
    "dgfip_produit_foncier_bati": "Ce que la commune encaisse en un an au titre de la"
    " taxe foncière sur les propriétés bâties — l'impôt que paient les propriétaires"
    " de logements, de bureaux et de locaux.",
    "dgfip_produit_foncier_non_bati": "Ce que la commune encaisse au titre de la taxe"
    " foncière sur les propriétés non bâties : terres agricoles, bois, terrains. Un"
    " produit faible dans une commune urbaine est normal, pas une anomalie.",
    "dgfip_produit_th_residences_secondaires": "Ce que la commune encaisse au titre de"
    " la taxe d'habitation. Elle ne porte plus que sur les résidences secondaires :"
    " celle des résidences principales a été supprimée pour tous en 2023.",
    "dgfip_produit_cfe": "Ce que la commune encaisse au titre de la cotisation foncière"
    " des entreprises. La plupart des communes n'en perçoivent rien parce que leur"
    " intercommunalité la lève à leur place : zéro ne veut pas dire aucune entreprise.",
}

TECHNIQUE = (
    "Recensement des éléments d'imposition à la fiscalité directe locale (REI),"
    " produit par la DGFiP et republié par l'Observatoire des finances et de la"
    " gestion publique locales. Sont chargés les seuls produits revenant à la"
    " **commune** : la même base décrit aussi ce qui revient à l'intercommunalité,"
    " au département et aux chambres consulaires, et les additionner compterait le"
    " même euro plusieurs fois. La taxe d'habitation ne porte plus que sur les"
    " résidences secondaires, celle des résidences principales ayant été supprimée"
    " pour l'ensemble des ménages en 2023 : une série qui enjambe cette date ne"
    " décrit pas le même impôt. La cotisation foncière des entreprises est le plus"
    " souvent perçue par l'intercommunalité, et une commune sans produit n'est pas"
    " une commune sans entreprises. Ces quatre produits ne sont pas la décomposition"
    " exacte de l'agrégat « impôts locaux » publié par ailleurs sur ce site, qui"
    " porte un autre périmètre ; les additionner pour le retrouver serait une"
    " reconstruction et non une mesure. La source couvre les exercices 2024 et 2025."
    " Quelques valeurs sont couvertes par le secret statistique et ne sont pas"
    " diffusées : elles sont absentes plutôt que nulles."
)


class IdentiteRompue(RuntimeError):
    """Base et taux ne retrouvent plus le produit publié."""


def url(variables: tuple[str, ...]) -> str:
    """L'export CSV du REI, restreint aux seules lignes utiles.

    Le jeu compte 22,7 millions d'enregistrements ; la clause `where`
    appartient donc à la requête. La demander en entier pour ne garder ensuite
    que 0,7 % des lignes ferait télécharger des centaines de mégaoctets pour
    rien — et l'API tronquerait bien avant.
    """
    listes = ", ".join(f"'{variable}'" for variable in variables)
    clause = f"destinataire='{DESTINATAIRE}' and varlib in ({listes})"
    return (
        f"{BASE}/exports/csv?where={urllib.parse.quote(clause)}"
        "&select=annee,idcom,varlib,valeur,secret_statistique&delimiter=;"
    )


def lire(contenu: bytes) -> dict[tuple, float]:
    """-> {(code commune, exercice, variable): valeur}.

    Une valeur sous secret statistique est absente, pas nulle : la source la
    masque, et écrire zéro à sa place inventerait une commune sans impôt.
    """
    # `utf-8-sig` et non `utf-8` : l'export de l'OFGL commence par un BOM, qui
    # se colle au nom de la première colonne. Lu sans lui, `annee` revient vide
    # et les deux exercices s'écrasent sous la même clé — la base d'une année se
    # retrouve alors comparée au produit de l'autre. C'est le contrôle
    # base × taux qui l'a signalé, aucun total ne l'aurait montré.
    lecteur = csv.DictReader(io.StringIO(contenu.decode("utf-8-sig")), delimiter=";")
    lignes: dict[tuple, float] = {}
    for rang in lecteur:
        valeur = (rang.get("valeur") or "").strip()
        if not valeur or (rang.get("secret_statistique") or "").strip():
            continue
        code = (rang.get("idcom") or "").strip()
        if not code:
            continue
        lignes[(code, (rang.get("annee") or "").strip(), rang["varlib"])] = float(valeur)
    return lignes


def ecarts_relatifs(lignes: dict[tuple, float]) -> list[float]:
    """L'écart relatif entre le produit publié et base × taux + lissage."""
    ecarts = []
    for code, annee, variable in lignes:
        if variable != PRODUIT_FB:
            continue
        base = lignes.get((code, annee, BASE_FB))
        taux = lignes.get((code, annee, TAUX_FB))
        produit = lignes[(code, annee, variable)]
        if base is None or taux is None or not produit:
            continue
        attendu = base * taux / 100 + lignes.get((code, annee, LISSAGE_FB), 0.0)
        ecarts.append(abs(attendu - produit) / abs(produit))
    return sorted(ecarts)


def controler(lignes: dict[tuple, float]) -> dict[str, float]:
    """Base × taux, plus le lissage, retrouve le produit du foncier bâti.

    Le contrôle confronte trois lignes de la source entre elles au lieu de
    comparer un total à sa somme : un taux lu sur la ligne du département, ou
    une base prise sur un autre impôt, décalerait **toutes** les communes à la
    fois, et c'est cela qu'on cherche. Il porte donc sur la distribution — la
    médiane et la part sous un pour cent — et sur la somme France, pas sur
    chaque commune prise isolément : la source applique des corrections qu'elle
    n'expose pas toutes, et trois cents communes s'écartent légitimement.
    """
    ecarts = ecarts_relatifs(lignes)
    if not ecarts:
        raise IdentiteRompue("aucune commune n'a pu être vérifiée")
    mediane = ecarts[len(ecarts) // 2]
    part = sum(1 for ecart in ecarts if ecart <= 0.01) / len(ecarts)
    attendu = somme = 0.0
    for code, annee, variable in lignes:
        if variable != PRODUIT_FB:
            continue
        base = lignes.get((code, annee, BASE_FB))
        taux = lignes.get((code, annee, TAUX_FB))
        if base is None or taux is None:
            continue
        attendu += base * taux / 100 + lignes.get((code, annee, LISSAGE_FB), 0.0)
        somme += lignes[(code, annee, variable)]
    agrege = abs(attendu - somme) / somme if somme else 1.0
    if mediane > ECART_MEDIAN_MAXIMUM:
        raise IdentiteRompue(
            f"écart médian de {100 * mediane:.3f} % entre le produit publié et"
            f" base × taux, au-delà des {100 * ECART_MEDIAN_MAXIMUM:.1f} % admis."
            " Une ligne est lue de travers pour l'ensemble des communes."
        )
    if part < PART_MINIMALE_SOUS_UN_POURCENT:
        raise IdentiteRompue(
            f"seules {100 * part:.1f} % des communes retrouvent leur produit à un"
            f" pour cent près, contre {100 * PART_MINIMALE_SOUS_UN_POURCENT:.0f} %"
            " attendus."
        )
    if agrege > ECART_AGREGE_MAXIMUM:
        raise IdentiteRompue(
            f"la somme France s'écarte de {100 * agrege:.2f} % :"
            f" {attendu:.0f} € contre {somme:.0f} € publiés."
        )
    return {
        "communes_verifiees": len(ecarts),
        "ecart_median": round(mediane, 6),
        "part_sous_un_pourcent": round(part, 5),
        "ecart_agrege": round(agrege, 6),
    }


def valeurs_publiees(lignes: dict[tuple, float]) -> list[tuple]:
    return [
        (PRODUITS[variable][0], "commune", code, annee, valeur)
        for (code, annee, variable), valeur in sorted(lignes.items())
        if variable in PRODUITS
    ]


def foncier_par_maille(candidates) -> dict[str, float]:
    """Le produit du foncier bâti écrit, pour les deux côtés de la couverture."""
    par_maille: dict[str, float] = {}
    for cle, niveau, _, _, valeur in candidates:
        if cle == PRODUITS[PRODUIT_FB][0]:
            par_maille[niveau] = par_maille.get(niveau, 0.0) + valeur
    return par_maille


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for variable, (identifiant, libelle) in sorted(PRODUITS.items()):
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, unit_notes,
                     confidence_level, badges)
                values (?, ?, ?, 'euros courants', 'observed',
                        array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (PUBLIQUE[identifiant], TECHNIQUE, f"REI, variable « {variable} »"),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, ?, ?, ?, ?, 'EUR', true, 'current', 'budgetaire',
                        array['commune'], 'annuelle', true)
                on conflict (indicator_id) do update set
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


def ecrire(conn, run_id: str, lignes: dict[tuple, float]) -> tuple[int, int, dict[str, float]]:
    candidates = valeurs_publiees(lignes)
    gardees, ecartes = filtrer_territoires_connus(conn, candidates)
    noms = [identifiant for identifiant, _ in PRODUITS.values()]
    with conn.cursor() as curseur:
        curseur.execute(
            "delete from core.observations where indicator_id = any(?)", (noms,)
        )
        entrepot.copier(
            conn,
            "core.observations",
            ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value",
             "run_id"],
            (
                (cle, niveau, code, MILLESIME, periode, valeur, run_id)
                for cle, niveau, code, periode, valeur in gardees
            ),
        )
    return len(gardees), len(ecartes), foncier_par_maille(gardees)


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        garde_fou_volume(conn)
        variables = (*PRODUITS, BASE_FB, TAUX_FB, LISSAGE_FB)
        adresse = url(variables)
        contenu = telecharger(adresse, timeout=900)
        entrepot.etape(f"{len(contenu) // 1024} Ko reçus")
        entrepot.record_asset(
            conn, store, run_id, DATASET, SOURCE, "rei-communes.csv", contenu,
            adresse, "text/csv",
        )
        lignes = lire(contenu)
        entrepot.etape(f"{len(lignes)} valeurs lues")
        if not lignes:
            raise ValueError("aucune valeur lue")
        verifies = controler(lignes)
        ecrites, ecartes, reconnus = ecrire(conn, run_id, lignes)
        entrepot.etape(f"{ecrites} observations écrites")
        lus = foncier_par_maille(valeurs_publiees(lignes))
        parts = couverture.controler(lus, reconnus)
        exercices = sorted({annee for _, annee, _ in lignes})
        conn.execute(
            """
            insert into meta.data_quality_checks
                (run_id, dataset_id, check_name, severity, passed, observed)
            values (?, ?, 'base_fois_taux_retrouve_le_produit', 'blocker', true, ?)
            """,
            (run_id, DATASET, json.dumps({
                **verifies,
                "exercices": exercices,
                "couverture": {n: round(p, 4) for n, p in sorted(parts.items())},
                "hors_referentiel": ecartes,
            })),
        )
        conn.commit()
        entrepot.finish_run(
            conn, run_id, "success", rows_read=len(lignes), rows_written=ecrites
        )
        print(
            f"impôts locaux : {ecrites} observations, exercices"
            f" {', '.join(exercices)}, {len(PRODUITS)} indicateurs,"
            f" {ecartes} hors référentiel ;"
            f" {verifies['communes_verifiees']} communes vérifiées,"
            f" écart médian {100 * verifies['ecart_median']:.3f} %"
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
