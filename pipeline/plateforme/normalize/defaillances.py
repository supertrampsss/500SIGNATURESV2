"""Les défaillances d'entreprises par taille et par secteur (Banque de France).

Eurostat publie un **indice**, toutes entreprises confondues. C'est insuffisant
pour juger, et d'une façon qui trompe : l'essentiel des créations d'entreprises
sont des micro-entreprises, si bien qu'un agrégat mélange des fermetures
d'unités sans salarié et des fermetures d'entreprises qui en employaient.

La Banque de France publie le nombre, ventilé. Ce que ça change, au 30 juin
2026, en cumul sur douze mois comparé à la moyenne 2010-2019 :

| | juin 2026 | contre 2010-2019 |
|---|---|---|
| Microentreprises et taille indéterminée | 65 182 | +16,3 % |
| Très petites entreprises | 3 494 | **+73,7 %** |
| Petites entreprises | 1 529 | **+68,0 %** |
| Moyennes entreprises | 532 | **+61,7 %** |
| ETI et grandes entreprises | 66 | **+100,0 %** |
| **Ensemble** | **70 803** | +19,3 % |

L'agrégat affiche +19,3 % ; **hors micro-entreprises, la hausse est de 71,2 %**
— 5 621 défaillances contre 3 283 en moyenne sur la décennie 2010-2019. Le
chiffre d'ensemble est dominé par les micro-entreprises et cache le fait.

─────────────────────────────────────────────────────────────────────────────
UNE GRAINE, ET NON UN CONNECTEUR
─────────────────────────────────────────────────────────────────────────────
L'API Webstat de la Banque de France porte 81 séries de défaillances, avec la
profondeur mensuelle depuis 1991. Elle demande une **clé d'API enregistrée**,
que ce dépôt n'a pas : les quatre schémas d'authentification essayés rendent un
401. Le portail Explore ouvert, lui, expose les métadonnées de ces séries mais
`has_records: false` — son export CSV est vide.

Ce module lit donc le **Stat Info mensuel**, publication figée dont les deux
tableaux portent tout ce que le site montre. Conséquence à assumer : il n'y a
**pas de série temporelle**, mais trois points — la moyenne de la décennie
2010-2019, le cumul à juin 2025 et le cumul à juin 2026. Le jour où la clé
existe, ce module est remplacé par un vrai connecteur et la profondeur
mensuelle arrive avec.

─────────────────────────────────────────────────────────────────────────────
DEUX IDENTITÉS, DEUX CONTRÔLES
─────────────────────────────────────────────────────────────────────────────
1. **Les tailles somment exactement à l'ensemble** : 65 182 + 3 494 + 1 529 +
   532 + 66 = 70 803. Le chargement lève si ce n'est pas le cas — une taille
   mal recopiée passerait autrement pour une donnée.
2. **Les secteurs somment PLUS BAS**, et c'est la source qui le dit : « la ligne
   Ensemble comprend des unités légales dont le secteur d'activité n'est pas
   connu ». Le résidu vaut 173 unités à juin 2026. Le contrôle vérifie donc que
   la somme est inférieure à l'ensemble, et de moins d'un pour cent : au-delà,
   c'est une ligne oubliée et non des secteurs inconnus.

Usage : python -m plateforme.normalize.defaillances
"""

import csv
from pathlib import Path

from plateforme import entrepot
from plateforme.normalize.geo import MILLESIME

DATASET = "bdf-stat-info-defaillances"
GRAINE = Path(__file__).parents[3] / "infra/seed/bdf_defaillances.csv"

# Les trois colonnes du Stat Info, et la période que chacune porte. La moyenne
# décennale n'est pas un mois : sa période le dit en toutes lettres, plutôt que
# d'être rangée sous un millésime qu'elle n'a pas.
PERIODES = {
    "moyenne_2010_2019": "2010-2019",
    "cumul_2025_06": "2025-06",
    "cumul_2026_06": "2026-06",
}

# Le résidu des secteurs inconnus est réel mais petit : au-delà de ce seuil,
# c'est une ligne oubliée à la recopie.
TOLERANCE_SECTEURS = 0.01


def lire() -> list[dict]:
    with GRAINE.open(encoding="utf-8") as fichier:
        return list(csv.DictReader(fichier))


def controler(lignes: list[dict]) -> None:
    """Lève si les deux identités du Stat Info ne se referment pas."""
    for colonne in PERIODES:
        par_axe = {"taille": 0, "secteur": 0}
        ensemble = None
        for ligne in lignes:
            valeur = int(ligne[colonne])
            if ligne["cle"] == "ensemble":
                ensemble = valeur
                continue
            par_axe[ligne["axe"]] += valeur
        if ensemble is None:
            raise ValueError(f"{colonne} : aucune ligne « ensemble »")
        if par_axe["taille"] != ensemble:
            raise ValueError(
                f"{colonne} : les tailles somment à {par_axe['taille']} pour un ensemble"
                f" de {ensemble} — une taille est mal recopiée"
            )
        manque = ensemble - par_axe["secteur"]
        if manque < 0 or manque > ensemble * TOLERANCE_SECTEURS:
            raise ValueError(
                f"{colonne} : les secteurs somment à {par_axe['secteur']} pour un"
                f" ensemble de {ensemble}, soit {manque} d'écart — la source n'admet"
                " qu'un résidu d'unités au secteur inconnu, pas une ligne oubliée"
            )


def identifiant(ligne: dict) -> str:
    return f"bdf_defaillances_{ligne['axe']}_{ligne['cle']}"


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for ligne in lire():
            axe = "taille" if ligne["axe"] == "taille" else "secteur d'activité"
            public = (
                f"Le nombre d'entreprises qui ont déposé le bilan, cumulé sur douze"
                f" mois, pour la catégorie « {ligne['libelle']} » ({axe})."
                " Une défaillance est un jugement d'ouverture de redressement ou de"
                " liquidation judiciaire, relevé auprès des greffes."
            )
            technique = (
                f"Défaillances d'entreprises, unités légales, cumul sur douze mois,"
                f" ventilation par {axe} : {ligne['libelle']}. Source Banque de France,"
                " base Fiben, Stat Info mensuel de juin 2026. La période 2010-2019 est"
                " la moyenne des cumuls douze mois observés mensuellement sur la"
                " décennie."
            )
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level,
                     badges)
                values (?, ?, null, 'observed', array['Officiel','Banque de France'])
                returning definition_id
                """,
                (public, technique),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, geo_levels, time_granularity, published)
                values (?, ?, ?, 'entreprises', ?, 'count', false, array['pays'],
                        'cumul_12_mois', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    theme = excluded.theme, time_granularity = 'cumul_12_mois',
                    additive = false, published = true
                """,
                (identifiant(ligne), DATASET, definition, f"Défaillances : {ligne['libelle']}"),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def run(_store_spec: str = "") -> int:
    conn = entrepot.connect()
    lignes = lire()
    controler(lignes)
    declarer(conn)
    run_id = entrepot.start_run(conn, DATASET, "manual")
    try:
        total = 0
        for ligne in lignes:
            valeurs = [(periode, float(ligne[colonne])) for colonne, periode in PERIODES.items()]
            with conn.cursor() as curseur:
                curseur.execute(
                    "delete from core.observations where indicator_id = ?",
                    (identifiant(ligne),),
                )
                entrepot.copier(
                    conn,
                    "core.observations",
                    ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period",
                     "value", "run_id"],
                    (
                        (identifiant(ligne), "pays", "FR", MILLESIME, periode, valeur, run_id)
                        for periode, valeur in valeurs
                    ),
                )
            conn.commit()
            total += len(valeurs)
        entrepot.finish_run(conn, run_id, "success", rows_written=total)
        print(f"Défaillances : {total} observations sur {len(lignes)} séries")
        return 0
    except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
        entrepot.finish_run(conn, run_id, "failed", error=str(error))
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(run())
