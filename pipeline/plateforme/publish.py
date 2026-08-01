"""T-17 — Exports statiques : Supabase -> fichiers JSON publiés dans R2.

La carte ne requête jamais la base : elle lit des fichiers versionnés servis par
le CDN (docs/03 §3). Ces fichiers *sont* le jeu de données public — les
republier ne coûte rien et les rend vérifiables par des tiers.

Chaque publication vit sous `data/<version>/`, immuable. Seul
`data/derniere.json` est réécrit : c'est le pointeur que le site interroge.

Usage : python -m plateforme.publish [--publication r2:plateforme-published]
"""

import argparse
import json
from collections import defaultdict
from datetime import UTC, datetime

from plateforme import db
from plateforme import journal as journal_declare
from plateforme.connectors import smb
from plateforme.normalize.geo import make_store

NIVEAUX = ["commune", "epci", "departement", "region", "pays"]

# Seuls ces niveaux ont des tuiles : produire des couches de carte pour les
# autres coûterait des centaines de fichiers que rien ne viendrait lire.
NIVEAUX_CARTOGRAPHIES = {"commune", "departement", "region"}

# Une carte montre une période à la fois, et personne ne consulte le chômage du
# troisième trimestre 1982 en choroplèthe. Publier 177 trimestres a fait passer
# la publication de cinq minutes à plus d'une heure : un fichier et une requête
# par période et par niveau. Les séries longues restent **entières** dans les
# fiches de territoire, qui portent toutes les périodes pour les courbes ; seule
# la carte est bornée aux périodes récentes.
PERIODES_CARTOGRAPHIEES = 12


def _json(charge) -> bytes:
    return json.dumps(charge, ensure_ascii=False, separators=(",", ":")).encode()


def manifeste(conn, version: str) -> dict:
    """Matière du panneau « D'où vient ce chiffre ? » : pour chaque jeu, son
    producteur, sa licence et la date d'extraction réellement utilisée."""
    jeux = conn.execute(
        """
        select d.dataset_id, d.title, s.producer, s.license, d.endpoint_url,
               max(a.fetched_at) as extraction
        from meta.dataset_registry d
        join meta.source_registry s using (source_id)
        join meta.raw_assets a on a.dataset_id = d.dataset_id
        group by 1, 2, 3, 4, 5 order by 1
        """
    ).fetchall()
    return {
        "version": version,
        "genere_le": datetime.now(UTC).isoformat(timespec="seconds"),
        "jeux": [
            {
                "id": jeu, "titre": titre, "producteur": producteur, "licence": licence,
                "url": url, "extraction": extraction.isoformat(timespec="seconds"),
            }
            for jeu, titre, producteur, licence, url, extraction in jeux
        ],
    }


def synchroniser_niveaux(conn) -> int:
    """Recale `geo_levels` sur les données réellement présentes.

    Le catalogue dit au site à quels niveaux un indicateur existe ; s'il se
    trompe, le sélecteur de niveau se vide et la carte n'a plus rien à peindre.
    Plutôt que de faire confiance à ce que chaque connecteur déclare — un
    chargement partiel avait suffi à effacer trois niveaux — la vérité est
    relue depuis `core.observations` avant chaque publication.
    """
    modifies = conn.execute(
        """
        update core.indicators i
        set geo_levels = coalesce(niveaux.presents, '{}')
        from (
            select ind.indicator_id,
                   (select array_agg(distinct o.geo_level order by o.geo_level)
                      from core.observations o
                     where o.indicator_id = ind.indicator_id) as presents
            from core.indicators ind
        ) as niveaux
        where niveaux.indicator_id = i.indicator_id
          and i.geo_levels is distinct from coalesce(niveaux.presents, '{}')
        """
    ).rowcount
    conn.commit()
    return modifies


def indicateurs(conn, cartographiees: dict[str, dict[str, list[str]]]) -> list[dict]:
    """La fiche en 10 points (docs/06) accompagne chaque indicateur publié.

    `cartographiees` dit, pour chaque indicateur et chaque niveau, les périodes
    dont la couche existe vraiment : c'est ce que le sélecteur d'année du site
    doit proposer, sans quoi il enverrait le lecteur sur un fichier absent.
    """
    lignes = conn.execute(
        """
        select i.indicator_id, i.label_fr, i.unit, i.theme, i.additive, i.price_basis,
               i.accounting_frame, i.geo_levels, d.public_definition, d.technical_definition,
               d.formula, d.confidence_level, d.badges, i.dataset_id,
               (select array_agg(distinct o.period order by o.period)
                  from core.observations o where o.indicator_id = i.indicator_id) as periodes
        from core.indicators i
        left join core.indicator_definitions d on d.definition_id = i.definition_id
        where i.published order by i.theme, i.label_fr
        """
    ).fetchall()
    return [
        {
            "id": ligne[0], "libelle": ligne[1], "unite": ligne[2], "theme": ligne[3],
            "sommable": ligne[4], "base_prix": ligne[5], "cadre_comptable": ligne[6],
            "niveaux": ligne[7], "definition": ligne[8], "definition_technique": ligne[9],
            "formule": ligne[10], "confiance": ligne[11], "badges": ligne[12],
            "jeu": ligne[13], "periodes": ligne[14] or [],
            "periodes_par_niveau": cartographiees.get(ligne[0], {}),
        }
        for ligne in lignes
    ]


def couples_publies(conn, niveau: str) -> list[tuple[str, str]]:
    """(indicateur, période) à cartographier pour ce niveau, périodes récentes
    d'abord bornées à `PERIODES_CARTOGRAPHIEES`."""
    par_indicateur: dict[str, list[str]] = defaultdict(list)
    for indicateur, periode in conn.execute(
        """
        select distinct o.indicator_id, o.period
        from core.observations o join core.indicators i using (indicator_id)
        where o.geo_level = %s and i.published and o.value_status = 'normal'
          and o.variant = 'total'
        order by 1, 2 desc
        """,
        (niveau,),
    ):
        if len(par_indicateur[indicateur]) < PERIODES_CARTOGRAPHIEES:
            par_indicateur[indicateur].append(periode)
    return [
        (indicateur, periode)
        for indicateur in sorted(par_indicateur)
        for periode in sorted(par_indicateur[indicateur])
    ]


def valeurs_par_niveau(conn, niveau: str) -> dict[str, dict[str, dict[str, float]]]:
    """-> {indicateur: {periode: {code: valeur}}}.

    Interrogé indicateur par indicateur : lire 1,3 million de lignes d'un seul
    curseur faisait tomber la connexion sur une instance de plan gratuit. Les
    valeurs sous secret statistique ne sont pas exportées comme des zéros :
    elles sont absentes, et la fiche de l'indicateur dit pourquoi.

    La carte n'affiche que la variante `total` : une série déclinée par sexe ou
    par âge y donnerait plusieurs valeurs pour un même territoire, dont une
    seule survivrait au hasard de l'écriture.
    """
    valeurs: dict = defaultdict(lambda: defaultdict(dict))
    for indicateur, periode in couples_publies(conn, niveau):
        for code, valeur in conn.execute(
            """
            select o.geo_code, o.value from core.observations o
            where o.geo_level = %s and o.indicator_id = %s and o.period = %s
              and o.value_status = 'normal' and o.variant = 'total'
            """,
            (niveau, indicateur, periode),
        ):
            valeurs[indicateur][periode][code] = float(valeur)
    return valeurs


# Critères du groupe de comparaison, repris de la classification de l'OFGL.
# Trois critères suffisent à constituer des groupes lisibles ; en ajouter
# davantage produirait des groupes d'une poignée de communes, où la position
# d'un territoire ne voudrait plus rien dire.
CRITERES_GROUPE = ["tranche_population", "rural", "outre_mer"]


def comparaisons(conn) -> dict:
    """Quartiles par groupe de communes semblables, calculés à la publication.

    Répondre à « ma commune dépense-t-elle plus que les communes comparables ? »
    suppose un groupe défini publiquement. Les critères viennent de l'OFGL, pas
    d'un découpage maison, et sont affichés avec le résultat. Les montants sont
    ramenés par habitant : comparer des totaux entre communes de tailles
    différentes n'aurait aucun sens.
    """
    lignes = conn.execute(
        f"""
        with base as (
            select o.indicator_id, o.period,
                   concat_ws('|', {", ".join(f"g.flags->>'{c}'" for c in CRITERES_GROUPE)})
                     as groupe,
                   o.value / nullif(pop.value, 0) as par_habitant
            from core.observations o
            join core.indicators i using (indicator_id)
            join geo.geography_reference g
              on g.geo_level = o.geo_level and g.geo_code = o.geo_code
             and g.vintage = o.geo_vintage
            join core.observations pop
              on pop.indicator_id = 'ofgl_population_reference'
             and pop.geo_level = o.geo_level and pop.geo_code = o.geo_code
             and pop.period = o.period
            where o.geo_level = 'commune' and i.published and i.unit = 'EUR'
              and o.value_status = 'normal' and g.flags ? 'tranche_population'
        )
        select indicator_id, period, groupe, count(*),
               percentile_cont(0.25) within group (order by par_habitant),
               percentile_cont(0.5) within group (order by par_habitant),
               percentile_cont(0.75) within group (order by par_habitant)
        from base where par_habitant is not null
        group by 1, 2, 3 having count(*) >= 20
        """
    ).fetchall()
    resultat: dict = defaultdict(lambda: defaultdict(dict))
    for indicateur, periode, groupe, effectif, q1, mediane, q3 in lignes:
        resultat[indicateur][periode][groupe] = {
            "n": effectif,
            "q1": round(float(q1), 2),
            "mediane": round(float(mediane), 2),
            "q3": round(float(q3), 2),
        }
    return {"criteres": CRITERES_GROUPE, "groupes": resultat}


ETAPES_BUDGET = {
    "vote": "Voté — loi de finances initiale",
    "rectifie": "Rectifié — dernière loi de finances rectificative",
    "execute": "Exécuté",
}


def budget_etat(conn) -> dict:
    """Le budget de l'État vu par la loi, puis par l'exécution.

    Les montants des trois étapes viennent du même fichier et de la même
    nomenclature : l'écart entre ce qui a été voté et ce qui a été dépensé se
    lit directement, sans rapprocher deux documents qui ne se ressemblent pas.
    Les lignes marquées `agregat` récapitulent leurs voisines : les additionner
    compterait deux fois.
    """
    exercices: dict = defaultdict(dict)
    for annee, etape, solde, comptes, annexes in conn.execute(
        """
        select fiscal_year, stage, balance, special_accounts_balance,
               annexed_budgets_balance
        from fin.public_budgets where entity_kind = 'etat'
        order by fiscal_year, stage
        """
    ):
        exercices[str(annee)][etape] = {
            "solde": float(solde) if solde is not None else None,
            "solde_comptes_speciaux": float(comptes) if comptes is not None else None,
            "solde_budgets_annexes": float(annexes) if annexes is not None else None,
            "montants": {},
        }
    for annee, etape, libelle, montant in conn.execute(
        """
        select b.fiscal_year, b.stage, l.label, coalesce(l.cp, l.amount)
        from fin.public_budget_lines l join fin.public_budgets b using (budget_id)
        where b.entity_kind = 'etat' and l.label is not null
        """
    ):
        exercices[str(annee)][etape]["montants"][libelle] = float(montant)

    # Ce que les contrôles ont refusé de publier fait partie du jeu publié :
    # une décomposition absente doit dire pourquoi elle l'est.
    quarantaine = conn.execute(
        """
        select observed from meta.data_quality_checks
        where dataset_id = 'execution-budget-etat'
          and check_name = 'decomposition_des_totaux'
        order by ran_at desc limit 1
        """
    ).fetchone()
    return {
        "etapes": [{"cle": cle, "libelle": libelle} for cle, libelle in ETAPES_BUDGET.items()],
        "lignes": smb.ordre_de_lecture(),
        "exercices": exercices,
        "quarantaine": (quarantaine[0] if quarantaine else {}) or {},
    }


def fraicheur(conn) -> list[dict]:
    """État public de chaque jeu : dernière mise à jour, retard, contrôles.

    La transparence opérationnelle fait partie du produit (docs/03 §6) : un
    chiffre vieux de deux ans doit se voir, pas se deviner.
    """
    return [
        {
            "jeu": jeu,
            "titre": titre,
            "priorite": priorite,
            "frequence": frequence,
            "derniere_extraction": extraction.isoformat(timespec="seconds") if extraction else None,
            "retard_jours": retard,
            "dernier_run": statut,
            "controles_echoues": controles,
            "anomalies": anomalies or [],
        }
        for (
            jeu, titre, priorite, frequence, extraction, retard, statut, controles, anomalies
        ) in conn.execute(
            """
            select d.dataset_id, d.title, d.priority, d.update_frequency,
                   max(a.fetched_at) as extraction,
                   case when d.expected_freshness_days is null then null
                        else greatest(0, extract(day from now() - max(a.fetched_at))::int
                                       - d.expected_freshness_days) end,
                   (select r.status from meta.ingestion_runs r
                     where r.dataset_id = d.dataset_id order by r.started_at desc limit 1),
                   (select count(*) from meta.data_quality_checks c
                     where c.dataset_id = d.dataset_id and not c.passed and c.severity = 'blocker'),
                   -- Les contrôles du dernier run seulement : un défaut corrigé
                   -- par le producteur ne doit pas rester affiché indéfiniment.
                   (select jsonb_agg(jsonb_build_object(
                             'nom', c.check_name, 'severite', c.severity, 'constat', c.observed))
                      from meta.data_quality_checks c
                     where c.dataset_id = d.dataset_id and not c.passed
                       and c.run_id = (select r.run_id from meta.ingestion_runs r
                                        where r.dataset_id = d.dataset_id
                                        order by r.started_at desc limit 1))
            from meta.dataset_registry d
            join meta.raw_assets a on a.dataset_id = d.dataset_id
            group by d.dataset_id, d.title, d.priority, d.update_frequency,
                     d.expected_freshness_days
            order by d.dataset_id
            """
        )
    ]


def journal(conn) -> list[dict]:
    """Ce qui a changé depuis la mise en ligne, du plus récent au plus ancien.

    Un lecteur qui a noté un chiffre l'an dernier doit pouvoir savoir s'il a
    bougé, et pourquoi (docs/02 §1). L'export sert aussi de preuve : il est
    publié avec les données, pas à côté.
    """
    return [
        {
            "annonce": annonce.date().isoformat(),
            "type": type_,
            "jeu": jeu,
            "indicateur": indicateur,
            "effet_au": effet.isoformat() if effet else None,
            "public": public,
            "technique": technique,
        }
        for annonce, type_, jeu, indicateur, effet, public, technique in conn.execute(
            """
            select announced_at, change_type, dataset_id, indicator_id,
                   effective_date, description_public, description_technical
            from meta.change_log
            order by announced_at desc, change_id desc
            """
        )
    ]


def evenements(conn, niveau: str) -> dict[str, list[dict]]:
    """Changements de périmètre par territoire, à la date où ils prennent effet.

    Une série dans le temps est une comparaison d'un territoire avec lui-même :
    la règle du périmètre s'y applique comme entre deux territoires. Une commune
    née d'une fusion en 2019 n'a pas la même surface avant et après, et afficher
    « +18 % depuis 2016 » sur ce dos-là compare deux choses différentes.

    Les fusions et scissions seules sont exportées. Un changement de nom ou de
    code ne déplace aucune frontière : le signaler ferait douter d'une série qui
    n'a rien de douteux.
    """
    portee: dict[str, list[dict]] = defaultdict(list)
    for code, type_, date, autre in conn.execute(
        """
        select to_code, event_type, event_date, from_code from geo.geography_history
        where to_level = %(niveau)s and event_type in ('fusion','scission')
        union all
        select from_code, event_type, event_date, to_code from geo.geography_history
        where from_level = %(niveau)s and event_type in ('fusion','scission')
        """,
        {"niveau": niveau},
    ):
        portee[code].append({"type": type_, "date": date.isoformat(), "avec": autre})
    return {
        code: sorted(liste, key=lambda e: e["date"]) for code, liste in portee.items()
    }


def territoires(conn, niveau: str) -> dict[str, dict]:
    changements = evenements(conn, niveau)
    return {
        code: {
            "nom": nom,
            "parent": parent,
            "population": population,
            "drapeaux": drapeaux,
            "evenements": changements.get(code, []),
        }
        for code, nom, parent, population, drapeaux in conn.execute(
            """
            select geo_code, name, parent_code, population, flags
            from geo.geography_reference
            where geo_level = %s and vintage = (select max(vintage)
                from geo.geography_reference where geo_level = %s)
            """,
            (niveau, niveau),
        )
    }


def publier(conn, store, version: str) -> int:
    racine = f"data/{version}"
    fichiers = 0

    def deposer(chemin: str, charge) -> None:
        nonlocal fichiers
        store.put(f"{racine}/{chemin}", _json(charge))
        fichiers += 1

    deposer("manifeste.json", manifeste(conn, version))
    recales = synchroniser_niveaux(conn)
    if recales:
        print(f"catalogue : {recales} indicateurs recalés sur les niveaux réellement présents")
    # Le journal est déclaré en code : publier est le moment où ce que dit le
    # dépôt devient ce que voit le public. Le synchroniser ici empêche l'export
    # de dériver de la déclaration.
    print(f"journal : {journal_declare.synchroniser(conn)} changements déclarés")

    recherche = []
    cartographiees: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for niveau in NIVEAUX:
        entites = territoires(conn, niveau)
        valeurs = valeurs_par_niveau(conn, niveau)

        if niveau in NIVEAUX_CARTOGRAPHIES:
            for indicateur, periodes in valeurs.items():
                cartographiees[indicateur][niveau] = sorted(periodes)
                for periode, codes in periodes.items():
                    deposer(f"carte/{indicateur}/{niveau}/{periode}.json", codes)

        # Fiches : les communes sont réparties par département — un fichier par
        # commune ferait 34 875 objets à déposer à chaque publication.
        groupes: dict[str, dict] = defaultdict(dict)
        for code, entite in entites.items():
            lot = entite["parent"] if niveau == "commune" and entite["parent"] else "tous"
            series = {
                indicateur: {
                    periode: codes[code] for periode, codes in periodes.items() if code in codes
                }
                for indicateur, periodes in valeurs.items()
            }
            groupes[lot][code] = {**entite, "series": {k: v for k, v in series.items() if v}}
            recherche.append({"c": code, "n": entite["nom"], "l": niveau, "p": entite["parent"]})

        for lot, contenu in groupes.items():
            deposer(f"territoires/{niveau}/{lot}.json", contenu)

    # Le catalogue est déposé après la boucle : il annonce les périodes dont la
    # couche a réellement été écrite.
    deposer("indicateurs.json", indicateurs(conn, cartographiees))
    deposer("recherche.json", recherche)
    deposer("comparaisons.json", comparaisons(conn))
    deposer("budget-etat.json", budget_etat(conn))
    deposer("fraicheur.json", fraicheur(conn))
    deposer("journal.json", journal(conn))
    store.put("data/derniere.json", _json({"version": version}), overwrite=True)
    print(f"publication {version} : {fichiers} fichiers, {len(recherche)} territoires")
    return fichiers


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--publication", default=".published")
    parser.add_argument("--version", default=datetime.now(UTC).strftime("%Y-%m-%dT%H%M"))
    args = parser.parse_args()
    conn = db.connect()
    try:
        publier(conn, make_store(args.publication), args.version)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
