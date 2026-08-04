"""Archive des valeurs remplacées : « ce chiffre a été révisé » (docs/02 §C).

Publier des séries révisables sans garder trace des révisions ferait de chaque
rechargement une réécriture silencieuse de l'histoire. Un lecteur qui a cité le
taux de chômage d'un trimestre doit pouvoir constater, à la parution suivante,
qu'il a bougé — et de combien. C'est l'étape 3 du processus de correction de
docs/06 : la valeur remplacée reste accessible.

**Seules les valeurs qui changent sont archivées.** Un rechargement recharge
tout, et presque tout est identique au chargement précédent. Archiver chaque
ligne à chaque run multiplierait le volume par le nombre de runs (contrainte
D6bis : 500 Mo de plan Supabase) sans rien apprendre à personne. La comparaison
porte sur la valeur et son statut ; un drapeau de qualité qui bouge seul n'est
pas une révision du chiffre.

**Ce qui disparaît n'est pas archivé ici.** Une ligne présente hier et absente
du rechargement du jour peut être un retrait du producteur — ou simplement un
chargement partiel. Tant qu'un connecteur ne délimite pas exactement son
périmètre, archiver ces absences fabriquerait de fausses révisions. La
rétention (retention.py), elle, supprime en le disant.
"""

from plateforme import entrepot
from collections.abc import Iterable, Sequence

CLES = ("indicator_id", "geo_level", "geo_code", "geo_vintage", "period")


def remplacer(
    conn,
    run_id: str,
    indicateurs: Sequence[str],
    colonnes: Sequence[str],
    lignes: Iterable[tuple],
    niveaux: Sequence[str] | None = None,
) -> tuple[int, int]:
    """Remplace les observations des indicateurs, en archivant ce qui change.

    `lignes` : tuples ``(indicator_id, geo_level, geo_code, geo_vintage,
    period, *colonnes)`` — `colonnes` nomme la suite, p. ex. ``("value",
    "quality_flags")`` ; le `run_id` est ajouté à chaque ligne. `niveaux`
    restreint le remplacement à certains niveaux géographiques, pour les
    connecteurs qui chargent niveau par niveau.

    Retourne ``(écrites, révisées)``. La transaction n'est pas validée ici :
    l'appelant garde la main pour y joindre ses contrôles qualité.
    """
    filtre_ancien = " and o.geo_level = any($niveaux)" if niveaux else ""
    filtre = " and geo_level = any($niveaux)" if niveaux else ""
    # Un paramètre nommé qui n'apparaît dans aucune requête fait échouer DuckDB,
    # là où psycopg l'ignorait. `niveaux` n'entre donc dans le dictionnaire que
    # lorsque le filtre l'utilise.
    parametres = {"run": run_id, "indicateurs": list(indicateurs)}
    if niveaux:
        parametres["niveaux"] = list(niveaux)
    with conn.cursor() as curseur:
        # Table temporaire à l'image de la vraie : mêmes colonnes, mêmes
        # défauts (`variant = 'total'`, `value_status = 'normal'`), aucune
        # contrainte de clé étrangère à re-vérifier.
        # `like ... including defaults` n'existe pas sous DuckDB. Les colonnes se
        # copient par un select vide, et les deux défauts dont dépend le calcul
        # — `variant` et `value_status` — se posent explicitement : ils portent la
        # jointure entre l'ancien et le nouveau, une valeur nulle y ferait
        # passer une révision pour une disparition. `quality_flags` suit : la
        # colonne cible la refuse nulle, et sans son défaut la réinsertion
        # échouait sur toute la table.
        curseur.execute(
            "create temp table nouvelles_observations as"
            " select * from core.observations limit 0"
        )
        curseur.execute(
            "alter table nouvelles_observations alter column variant set default 'total'"
        )
        curseur.execute(
            "alter table nouvelles_observations alter column value_status set default 'normal'"
        )
        curseur.execute(
            "alter table nouvelles_observations alter column quality_flags set default []"
        )
        ecrites = entrepot.copier(
            curseur,
            "nouvelles_observations",
            [*CLES, *colonnes, "run_id"],
            ((*ligne, run_id) for ligne in lignes),
        )
        # L'archive d'abord, la valeur d'hier encore en place : c'est la
        # jointure entre l'ancien et le nouveau qui dit ce qui a changé.
        archive = f"""
            insert into core.observations_revisions
                (indicator_id, geo_level, geo_code, geo_vintage, period, variant,
                 old_value, old_status, run_id)
            select o.indicator_id, o.geo_level, o.geo_code, o.geo_vintage,
                   o.period, o.variant, o.value, o.value_status, $run
            from core.observations o
            join nouvelles_observations n
                 using (indicator_id, geo_level, geo_code, geo_vintage, period, variant)
            where o.indicator_id = any($indicateurs){filtre_ancien}
              and (o.value is distinct from n.value
                   or o.value_status is distinct from n.value_status)
            """
        curseur.execute(archive, entrepot.parametres_utiles(archive, parametres))
        # DuckDB n'expose pas de `rowcount` après un insert : on compte les
        # lignes archivées par ce run, ce qui est la même mesure et se lit mieux.
        revisees = curseur.execute(
            "select count(*) from core.observations_revisions where run_id = $run",
            {"run": run_id},
        ).fetchone()[0]
        purge = f"delete from core.observations where indicator_id = any($indicateurs){filtre}"
        curseur.execute(purge, entrepot.parametres_utiles(purge, parametres))
        curseur.execute(
            """
            insert into core.observations
                (indicator_id, geo_level, geo_code, geo_vintage, period, variant,
                 value, value_status, quality_flags, run_id)
            select indicator_id, geo_level, geo_code, geo_vintage, period, variant,
                   value, value_status, quality_flags, run_id
            from nouvelles_observations
            """
        )
        curseur.execute("drop table nouvelles_observations")
    return ecrites, revisees
