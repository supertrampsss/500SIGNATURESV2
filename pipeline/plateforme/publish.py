"""T-17 — Exports statiques : Supabase -> fichiers JSON publiés dans R2.

La carte ne requête jamais la base : elle lit des fichiers versionnés servis par
le CDN (docs/03 §3). Ces fichiers *sont* le jeu de données public — les
republier ne coûte rien et les rend vérifiables par des tiers.

Chaque publication vit sous `data/<version>/`, immuable. Seul
`data/derniere.json` est réécrit : c'est le pointeur que le site interroge.

Usage : python -m plateforme.publish [--publication r2:plateforme-published]
"""

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path
from datetime import UTC, datetime

from plateforme import entrepot
from plateforme import journal as journal_declare
from plateforme.connectors import smb
from plateforme.normalize.geo import make_store
from plateforme.store import Flux, ImmutabilityError

# Les arrondissements municipaux sont publiés, mais jamais agrégés.
#
# Paris, Lyon et Marseille existent **deux fois** dans le référentiel : la
# commune entière (75056, 69123, 13055) et ses 45 arrondissements, que le COG
# rattache à leur commune mère et non à un département. Des connecteurs y
# écrivent — la carte des loyers de l'ANIL ne connaît les trois villes que par
# arrondissement. Ces observations étaient en base sans être publiées : la fiche
# de Paris 1er n'existait pas.
#
# Le niveau entre donc dans `NIVEAUX`, qui commande les fiches de territoire et
# l'index de recherche. Il n'entre **pas** dans `NIVEAUX_CARTOGRAPHIES` : il n'y
# a pas de couche de tuiles pour les arrondissements (`normalize/geometries.py`
# n'en construit que trois), et publier des fichiers de carte que rien ne peut
# peindre ne rendrait service à personne.
#
# Cette seconde exclusion vaut aussi garde-fou contre le double comptage. Les
# deux seuls calculs qui additionnent des territoires ne peuvent pas voir un
# arrondissement : `_quartiles_du_groupe` filtre `o.geo_level = 'commune'`, et
# `references()` ne parcourt que les niveaux cartographiés plus `pays`. Un
# arrondissement ne s'ajoute donc jamais à sa commune mère — ni dans l'agrégat
# France, ni dans une médiane régionale, ni dans un quartile de comparaison.
NIVEAUX = ["commune", "arrondissement_municipal", "departement", "region", "pays"]

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
    # Compté avant d'écrire : DuckDB ne renvoie pas de `rowcount` après un
    # `update`, et annoncer « -1 indicateurs recalés » ne renseignerait personne.
    modifies = conn.execute(
        """
        select count(*) from core.indicators i
        where i.geo_levels is distinct from coalesce((
            select list_sort(list_distinct(list(o.geo_level))) from core.observations o
             where o.indicator_id = i.indicator_id), [])
        """
    ).fetchone()[0]
    conn.execute(
        """
        update core.indicators i
        set geo_levels = coalesce((
            select list_sort(list_distinct(list(o.geo_level))) from core.observations o
             where o.indicator_id = i.indicator_id), [])
        where i.geo_levels is distinct from coalesce((
            select list_sort(list_distinct(list(o.geo_level))) from core.observations o
             where o.indicator_id = i.indicator_id), [])
        """
    )
    conn.commit()
    return modifies


# Jeux dont le producteur **recalcule** l'historique dans la géographie
# d'aujourd'hui. Une fusion de communes ne coupe pas ces séries : les valeurs
# anciennes portent déjà sur le territoire actuel, et signaler une rupture
# reviendrait à déclarer incomparable une série qui ne l'est pas.
#
# Vérifié, pas supposé, sur les données publiées le 01/08/2026 : les millésimes
# 2013 et 2023 des populations légales couvrent les mêmes 34 858 communes, Vire
# Normandie (née en 2016 de huit communes) porte 17 951 habitants dès 2013 —
# le territoire entier, pas l'une des huit — et la somme 2013 vaut 65,56 M,
# c'est-à-dire la France de 2013. Les comptes de l'OFGL, eux, sont ceux de la
# commune telle qu'elle existait l'année-là : leur série se coupe.
#
# Le défaut est « non recalculé ». Rater une rupture ferait publier une
# comparaison fausse ; en inventer une fait douter à tort — mais l'erreur reste
# du côté de la prudence, et se corrige en ajoutant le jeu ici, une fois vérifié.
GEOGRAPHIE_COURANTE = {"melodi-populations-historiques"}


def hierarchie_ofgl() -> dict[str, str]:
    """-> {indicateur: son agrégat parent}, d'après le catalogue de l'OFGL.

    L'OFGL publie ses agrégats avec leur place dans l'arbre comptable — « Dépenses
    totales > Dépenses de fonctionnement > » pour les frais de personnel. La
    colonne est dans `infra/seed/ofgl_agregats.csv` depuis le premier jour et
    n'était lue nulle part : le site affichait donc soixante-dix-neuf agrégats à
    plat, dont des totaux et leurs propres composantes, sans que rien ne dise
    lesquels contenaient lesquels.

    C'est pourtant la seule chose qui manquait pour répondre à « et dans ces
    369 millions de charges, il y a quoi ». Vérifié sur les comptes publiés : à
    chaque niveau, les composantes redonnent leur parent au centième de pour
    cent près.
    """
    from plateforme.connectors.ofgl import catalogue

    lignes = [ligne for ligne in catalogue() if ligne["charge"] == "oui"]
    par_libelle = {ligne["agregat"]: ligne["indicateur"] for ligne in lignes}
    arbre: dict[str, str] = {}
    for ligne in lignes:
        maillons = [m.strip() for m in ligne["chemin"].split(">") if m.strip()]
        # Le dernier maillon du chemin est le parent direct. Un chemin vide est
        # une racine — épargne, encours de dette, soldes : ils ne se rangent
        # sous rien.
        parent = par_libelle.get(maillons[-1]) if maillons else None
        if parent and parent != ligne["indicateur"]:
            arbre[ligne["indicateur"]] = parent
    return arbre


# Le second axe de lecture d'un total : par fonction plutôt que par nature.
#
# Les charges de fonctionnement d'une commune se décomposent de deux façons — ce
# qu'elle achète (personnel, achats, intérêts) et à quoi ça sert (écoles, sport,
# culture). Les deux décrivent le même total et ne s'additionnent pas entre
# elles ; les ranger sous le même `parent` les aurait fait sommer au double.
# L'axe fonctionnel a donc son propre champ, et le site propose l'un ou l'autre.
def hierarchie_fonctionnelle() -> dict[str, str]:
    """-> {indicateur de fonction: l'agrégat qu'il décompose}."""
    from plateforme.normalize.fonctions_communes import FONCTIONS, PARENT, RESIDU

    identifiants = [identifiant for _libelle, identifiant in FONCTIONS.values()]
    return {identifiant: PARENT for identifiant in [*identifiants, RESIDU]}


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
               d.formula, d.confidence_level, d.badges, i.dataset_id, d.unit_notes,
               (select array_agg(distinct o.period order by o.period)
                  from core.observations o where o.indicator_id = i.indicator_id) as periodes
        from core.indicators i
        left join core.indicator_definitions d on d.definition_id = i.definition_id
        where i.published order by i.theme, i.label_fr
        """
    ).fetchall()
    arbre = hierarchie_ofgl()
    fonctionnel = hierarchie_fonctionnelle()
    return [
        {
            "id": ligne[0], "libelle": ligne[1], "unite": ligne[2], "theme": ligne[3],
            "sommable": ligne[4], "base_prix": ligne[5], "cadre_comptable": ligne[6],
            "niveaux": ligne[7], "definition": ligne[8], "definition_technique": ligne[9],
            "formule": ligne[10], "confiance": ligne[11], "badges": ligne[12],
            "jeu": ligne[13], "periodes": ligne[15] or [],
            # Ce que compte l'indicateur, quand le producteur le nomme : une
            # infraction, une victime, une personne mise en cause. Deux séries
            # d'unités différentes ne s'additionnent pas, et le site s'en sert
            # pour refuser de le faire.
            "unite_de_compte": ligne[14],
            "periodes_par_niveau": cartographiees.get(ligne[0], {}),
            "geographie_courante": ligne[13] in GEOGRAPHIE_COURANTE,
            # L'agrégat qui contient celui-ci, quand la source en déclare un.
            # C'est ce qui permet d'ouvrir un total sur ses composantes plutôt
            # que de les aligner à côté de lui.
            "parent": arbre.get(ligne[0]),
            # L'agrégat que cet indicateur décompose **par destination**. Il ne
            # s'additionne jamais avec les composantes par nature du même total :
            # ce sont deux lectures du même euro.
            "parent_fonction": fonctionnel.get(ligne[0]),
        }
        for ligne in lignes
    ]


def couples_publies(conn, niveau: str, borne: bool = True) -> list[tuple[str, str]]:
    """(indicateur, période) à publier pour ce niveau, périodes récentes d'abord.

    La borne `PERIODES_CARTOGRAPHIEES` protège le volume des fichiers de
    carte : un fichier par période et par indicateur, 34 875 entrées au
    communal. Le niveau `pays` n'est pas cartographié et ses séries portent
    les courbes de conjoncture — une inflation mensuelle depuis 2013 fait 156
    périodes, et la tronquer à 12 amputerait le graphique sans le dire :
    `borne=False` publie la profondeur entière.
    """
    par_indicateur: dict[str, list[str]] = defaultdict(list)
    plafond = PERIODES_CARTOGRAPHIEES if borne else float("inf")
    for indicateur, periode in conn.execute(
        """
        select distinct o.indicator_id, o.period
        from core.observations o join core.indicators i using (indicator_id)
        where o.geo_level = ? and i.published and o.value_status = 'normal'
          and o.variant = 'total'
        order by 1, 2 desc
        """,
        (niveau,),
    ).fetchall():
        if len(par_indicateur[indicateur]) < plafond:
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
    # Profondeur entière à tous les niveaux : les fiches portent les courbes,
    # et c'est l'appelant qui borne ce qu'il cartographie. Borner ici amputait
    # les séries de fiche en silence.
    for indicateur, periode in couples_publies(conn, niveau, borne=False):
        for code, valeur in conn.execute(
            """
            select o.geo_code, o.value from core.observations o
            where o.geo_level = ? and o.indicator_id = ? and o.period = ?
              and o.value_status = 'normal' and o.variant = 'total'
            """,
            (niveau, indicateur, periode),
        ).fetchall():
            valeurs[indicateur][periode][code] = float(valeur)
    return valeurs


# Critères du groupe de comparaison, repris de la classification de l'OFGL.
# Trois critères suffisent à constituer des groupes lisibles ; en ajouter
# davantage produirait des groupes d'une poignée de communes, où la position
# d'un territoire ne voudrait plus rien dire.
# Les critères du groupe de communes semblables, du plus fin au plus large.
#
# Trois critères donnaient des groupes justes mais grossiers : une station de
# montagne et une ville de plaine de même taille tombaient ensemble, alors que
# l'OFGL publie précisément le caractère montagnard et touristique de chaque
# commune — ils étaient déjà dans les drapeaux, inutilisés.
#
# Les ajouter tous ferait l'erreur inverse. Chaque critère multiplie le nombre
# de strates, et une strate de trois communes ne compare plus rien : le seuil de
# vingt les ferait simplement disparaître, et la commune perdrait le repère
# qu'elle avait. C'est le défaut classique du sur-découpage, et il est
# silencieux — un groupe absent ne s'affiche pas, il ne se signale pas.
#
# D'où la cascade. Le groupe le plus fin est calculé, et aussi les plus larges ;
# la fiche prend le premier qui existe pour sa commune. Une commune ordinaire est
# comparée à ses semblables sur cinq critères, une commune atypique retombe sur
# trois, et aucune ne perd son repère. Les critères retenus sont affichés avec le
# résultat : « comparée à 40 communes de 100 000 à 200 000 habitants, urbaines,
# non touristiques » ne veut pas dire la même chose que « à 8 982 communes ».
CASCADE_CRITERES = [
    ["tranche_population", "rural", "outre_mer", "montagne", "touristique"],
    ["tranche_population", "rural", "outre_mer"],
    ["tranche_population", "outre_mer"],
]
CRITERES_GROUPE = CASCADE_CRITERES[-1]

# En dessous, un groupe ne compare plus : il décrit une poignée de communes dont
# la médiane bouge d'un tiers si l'une d'elles change de politique.
GROUPE_MINIMAL = 20

# Les jeux dont les effectifs sont comptés **au lieu de travail**.
#
# La règle « un effectif additif se rapporte à mille habitants » vaut pour ce
# qui décrit les habitants : des logements, des chômeurs, des familles. Elle ne
# vaut pas pour ce qui décrit l'activité posée sur le territoire. Bordeaux
# compte 201 045 postes salariés pour 268 000 habitants ; une commune-dortoir
# voisine en compte quelques centaines pour dix mille habitants. Rapporter les
# uns et les autres à leurs résidents ne mesure pas une intensité d'emploi,
# cela mesure l'écart entre là où l'on travaille et là où l'on dort — et
# l'affiche comme si c'était la première grandeur.
#
# Ces indicateurs restent additifs : ils s'additionnent bel et bien d'une
# commune à l'autre, et le catalogue ne doit pas mentir là-dessus pour obtenir
# un effet d'affichage. C'est le **dénominateur** qui n'existe pas, pas la
# sommabilité. Leurs quartiles se comparent donc en valeur, à l'intérieur d'une
# strate qui borne déjà la taille des communes.
JEUX_AU_LIEU_DE_TRAVAIL = ("melodi-flores-a5",)


def base_de_comparaison(additif: bool, unite: str, jeu: str) -> str:
    """Sur quelle grandeur les quartiles d'un indicateur se comparent.

    Le SQL des quartiles applique la même règle : les deux doivent dire la
    même chose, sans quoi les nombres publiés seraient calculés sur une base et
    formatés sur une autre.
    """
    if not additif or jeu in JEUX_AU_LIEU_DE_TRAVAIL:
        return "valeur"
    return "par_habitant" if unite == "EUR" else "pour_mille"


def comparaisons(conn) -> dict:
    """Quartiles par groupe de communes semblables, calculés à la publication.

    Répondre à « ma commune est-elle comme les communes qui lui ressemblent ? »
    suppose un groupe défini publiquement. Les critères viennent de l'OFGL, pas
    d'un découpage maison, et sont affichés avec le résultat. C'est le repère le
    plus juste dont dispose ce site : la médiane des communes de la région met
    Bordeaux et un village de deux cents habitants dans le même sac, la strate
    « ville de deux cent mille habitants, urbaine, métropole » compare ce qui est
    comparable.

    **Ce qui se divise par la population, et ce qui ne se divise pas.** Une
    dépense, un effectif de logements, un nombre de chômeurs sont des grandeurs
    qui s'additionnent : les comparer entre communes suppose de les rapporter aux
    habitants. Une médiane de niveau de vie, un taux d'imposition, un taux de
    cambriolage ne s'additionnent pas — ils se comparent tels qu'ils sont
    publiés. C'est la colonne `additive` du catalogue qui tranche, et non l'unité.

    Trois bases, donc. Un montant additif se rapporte à **l'habitant** — c'est
    l'usage des finances locales. Un effectif additif se rapporte à **mille
    habitants**, comme partout ailleurs sur ce site : quarante logements vacants
    pour mille habitants se lit, 0,04 par habitant ne se lit pas. Le reste se
    compare **tel quel**.

    La règle précédente était l'unité : `unit = 'EUR'`. Elle laissait entrer le
    niveau de vie médian, qui est en euros sans être additif, et le divisait par
    le nombre d'habitants. Les quartiles publiés du 5 août donnaient, pour la
    strate des communes rurales de trois à cinq mille habitants, « médiane
    31,76 € » — un niveau de vie médian divisé par une population, c'est-à-dire
    rien. Elle écartait dans le même mouvement tout ce qui n'est pas de l'argent :
    le logement vacant, le chômage, les familles monoparentales, les diplômes
    n'avaient pas de groupe de comparaison, alors que ce sont les questions où il
    manque le plus.

    -> {"criteres": [...], "bases": {indicateur: {"base", "unite"}},
        "groupes": {indicateur: {période: {groupe: {n, q1, mediane, q3}}}}}

    `bases` dit, pour chaque indicateur, si les quartiles sont par habitant ou
    dans l'unité publiée : sans lui, l'affichage ne peut pas les formater sans
    se tromper d'unité.
    """
    lignes = []
    for rang, criteres in enumerate(CASCADE_CRITERES):
        lignes.extend(
            (rang, *ligne) for ligne in _quartiles_du_groupe(conn, criteres)
        )
    resultat: dict = defaultdict(lambda: defaultdict(dict))
    bases: dict = {}
    for rang, indicateur, periode, groupe, additif, unite, jeu, effectif, q1, mediane, q3 in lignes:
        resultat[indicateur][periode][f"{rang}:{groupe}"] = {
            "n": effectif,
            "q1": round(float(q1), 2),
            "mediane": round(float(mediane), 2),
            "q3": round(float(q3), 2),
        }
        bases[indicateur] = {
            "base": base_de_comparaison(additif, unite, jeu),
            "unite": unite,
        }
    return {
        # Le rang du groupe est dans sa clé : « 0:… » pour les cinq critères,
        # « 1:… » pour trois. La fiche essaie les rangs dans l'ordre et prend le
        # premier qui existe — c'est ce qui garantit qu'aucune commune ne perd
        # son repère en gagnant en finesse.
        "cascade": CASCADE_CRITERES,
        # Conservé pour les versions du site déployées avant la cascade : elles
        # lisent une liste plate et n'ont que faire des rangs.
        "criteres": CRITERES_GROUPE,
        "bases": bases,
        "groupes": resultat,
    }


def _quartiles_du_groupe(conn, criteres: list[str]) -> list[tuple]:
    """Quartiles par groupe, pour un jeu de critères donné."""
    return conn.execute(
        f"""
        with base as (
            select o.indicator_id, o.period, i.additive, i.unit, i.dataset_id,
                   concat_ws('|', {", ".join(
                       f"json_extract_string(g.flags, '$.{c}')" for c in criteres)})
                     as groupe,
                   -- Même règle que `base_de_comparaison` : un effectif compté
                   -- au lieu de travail n'a pas les résidents pour
                   -- dénominateur, et se compare donc en valeur.
                   case when not i.additive
                          or i.dataset_id in ({", ".join(
                              f"'{jeu}'" for jeu in JEUX_AU_LIEU_DE_TRAVAIL)})
                        then o.value
                        when i.unit = 'EUR' then o.value / nullif(pop.value, 0)
                        else o.value / nullif(pop.value, 0) * 1000
                   end as compare
            from core.observations o
            join core.indicators i using (indicator_id)
            join geo.geography_reference g
              on g.geo_level = o.geo_level and g.geo_code = o.geo_code
             and g.vintage = o.geo_vintage
            left join core.observations pop
              on pop.indicator_id = 'ofgl_population_reference'
             and pop.geo_level = o.geo_level and pop.geo_code = o.geo_code
             and pop.period = o.period
            where o.geo_level = 'commune' and i.published
              and o.value_status = 'normal'
              and json_extract_string(g.flags, '$.tranche_population') is not null
        )
        select indicator_id, period, groupe, additive, unit, dataset_id, count(*),
               percentile_cont(0.25) within group (order by compare),
               percentile_cont(0.5) within group (order by compare),
               percentile_cont(0.75) within group (order by compare)
        from base where compare is not null
        group by 1, 2, 3, 4, 5, 6 having count(*) >= {GROUPE_MINIMAL}
        """
    ).fetchall()


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
          -- Les trois étapes de la page sont celles d'une loi de finances :
          -- votée, rectifiée, exécutée. Les budgets de type `PLF` portent les
          -- chiffrages d'annexes — les dépenses fiscales — qui n'ont ni solde
          -- ni ligne à montrer ici ; les laisser entrer ouvrirait un exercice
          -- vide dans le sélecteur.
          and budget_type in ('LFI', 'LFR')
        order by fiscal_year, stage
        """
    ).fetchall():
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
          -- Les dépenses fiscales sont portées par l'État sans être des lignes
          -- de son budget : ce sont des impôts non perçus. Les laisser entrer
          -- ici les ferait tomber dans le pont recettes → dépenses → solde, où
          -- elles n'ont pas de place et fausseraient la lecture.
          and l.line_kind <> 'depense_fiscale'
        """
    ).fetchall():
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


def depenses_fiscales(conn) -> dict:
    """Ce que l'État renonce à percevoir, dispositif par dispositif.

    Le fichier ne porte que le détail : les totaux par impôt sont des
    indicateurs comme les autres et voyagent avec eux. Les dispositifs sont
    triés par coût décroissant du dernier exercice publié — c'est la seule
    lecture utile d'une liste de quatre cent cinquante-sept lignes, et elle
    répond à la question que le lecteur pose : lesquelles coûtent cher.
    """
    dispositifs: dict[str, dict] = {}
    exercices: set[str] = set()
    realises: set[str] = set()
    for annee, etape, numero, libelle, mission, montant in conn.execute(
        """
        select b.fiscal_year, b.stage, l.chapitre, l.label, l.mission, l.amount
        from fin.public_budget_lines l join fin.public_budgets b using (budget_id)
        where l.line_kind = 'depense_fiscale'
        """
    ).fetchall():
        exercice = str(annee)
        exercices.add(exercice)
        # Un même document publie un exercice constaté et des prévisions. Le
        # site doit pouvoir les distinguer, faute de quoi il annoncerait au
        # présent ce qui n'a pas encore eu lieu.
        if etape == "execute":
            realises.add(exercice)
        dispositif = dispositifs.setdefault(numero, {
            "numero": numero, "libelle": libelle, "mission": mission, "montants": {},
        })
        dispositif["montants"][exercice] = float(montant)
    if not dispositifs:
        return {"exercices": [], "realise": None, "dispositifs": []}
    dernier = max(exercices)
    return {
        "exercices": sorted(exercices),
        "realise": max(realises) if realises else None,
        "dispositifs": sorted(
            dispositifs.values(),
            key=lambda d: -d["montants"].get(dernier, 0.0),
        ),
    }


def _montant_publie(valeur) -> float | int:
    """Un euro entier s'écrit sans décimale : deux octets de moins par nœud, et
    mille lignes de moins à lire quand on ouvre le fichier à la main."""
    montant = round(float(valeur), 2)
    return int(montant) if montant == int(montant) else montant


def simulateur(conn) -> dict[str, dict]:
    """Le budget de l'État réglable ligne à ligne : un fichier par exercice.

    L'arbre est reconstruit depuis `fin.state_budget_detail`, où il est porté par
    `parent_code` : une feuille est un nœud que personne ne réclame comme parent,
    à n'importe quelle profondeur — une action sans sous-action en est une, comme
    une sous-action. C'est ce qui distingue une feuille dans le fichier publié,
    pas son niveau.

    Le tri est par montant décroissant à chaque étage. Ce n'est pas un détail
    d'affichage : une nomenclature triée par code met « Action extérieure de
    l'État » devant « Enseignement scolaire », et le lecteur qui cherche où sont
    les masses ouvre trente missions avant d'en trouver une qui pèse.

    Les groupes de recettes sortent dans l'ordre du barème : ce qui s'ajoute
    d'abord, ce qui se retranche ensuite, chaque bloc du plus lourd au plus léger.
    """
    exercices: dict[str, dict] = {}
    # La clé porte le côté du budget : les codes de mission (« RD ») et les codes
    # de famille de recettes (« RF ») viennent de deux nomenclatures qui ne se
    # sont jamais parlé, et rien n'interdit qu'elles se croisent un jour. Sans le
    # côté dans la clé, les lignes d'une famille tomberaient sous une mission.
    enfants: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    racines: dict[str, list[dict]] = defaultdict(list)
    tous: list[tuple[str, str, dict]] = []
    groupes: dict[tuple[str, str], dict] = {}
    for annee, loi, cote, niveau, code, parent, libelle, montant, signe, mesure, devise in (
        conn.execute(
            """
            select fiscal_year, law, side, node_level, code, parent_code, label,
                   amount, sign, measure, currency
            from fin.state_budget_detail order by fiscal_year, side, code
            """
        ).fetchall()
    ):
        exercice = str(annee)
        if niveau == "famille":
            groupes[(exercice, code)] = {
                "t": libelle, "signe": int(signe), "lignes": [],
                "poids": _montant_publie(montant),
            }
            continue
        noeud = {"c": code, "l": libelle, "v": _montant_publie(montant)}
        if cote == "recette":
            enfants[(exercice, cote, parent)].append(noeud)
            continue
        exercices.setdefault(
            exercice, {"exercice": exercice, "loi": loi, "mesure": mesure, "unite": devise}
        )
        tous.append((exercice, code, noeud))
        if parent:
            enfants[(exercice, cote, parent)].append(noeud)
        else:
            racines[exercice].append(noeud)

    def par_valeur(noeud: dict) -> float:
        return -noeud["v"]

    for exercice, code, noeud in tous:
        lignes = enfants.get((exercice, "depense", code))
        if lignes:
            noeud["enfants"] = sorted(lignes, key=par_valeur)
    recettes: dict[str, list[dict]] = defaultdict(list)
    for (exercice, code), groupe in sorted(
        groupes.items(), key=lambda item: (-item[1]["signe"], -item[1]["poids"])
    ):
        recettes[exercice].append(
            {
                "t": groupe["t"],
                "signe": groupe["signe"],
                "lignes": sorted(enfants.get((exercice, "recette", code), []), key=par_valeur),
            }
        )
    return {
        exercice: {
            **budget,
            "depenses": sorted(racines[exercice], key=par_valeur),
            "recettes": recettes[exercice],
        }
        for exercice, budget in sorted(exercices.items())
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
            "valeurs_revisees_90j": revisees,
        }
        for (
            jeu, titre, priorite, frequence, extraction, retard, statut, controles, revisees,
            anomalies,
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
                   -- Chiffres déjà publiés qui ont bougé lors d'un rechargement
                   -- récent : la révision est un fait public, pas un secret
                   -- d'atelier (docs/02 §C).
                   (select count(*) from core.observations_revisions v
                      join meta.ingestion_runs r on r.run_id = v.run_id
                     where r.dataset_id = d.dataset_id
                       and v.superseded_at > now() - interval '90 days'),
                   -- Les contrôles du dernier run seulement : un défaut corrigé
                   -- par le producteur ne doit pas rester affiché indéfiniment.
                   (select json_group_array(json_object(
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
        ).fetchall()
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
        ).fetchall()
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
        where to_level = $niveau and event_type in ('fusion','scission')
        union all
        select from_code, event_type, event_date, to_code from geo.geography_history
        where from_level = $niveau and event_type in ('fusion','scission')
        """,
        {"niveau": niveau},
    ).fetchall():
        portee[code].append({"type": type_, "date": date.isoformat(), "avec": autre})
    return {
        code: sorted(liste, key=lambda e: e["date"]) for code, liste in portee.items()
    }


def references(conn, cartographiees: dict[str, dict[str, list[str]]]) -> dict:
    """Ce à quoi se compare un territoire : l'ensemble dont il fait partie.

    **La région de référence d'une commune n'est pas le conseil régional.** Le
    budget d'une région est celui d'une autre collectivité, qui exerce d'autres
    compétences ; y rapporter une commune comparerait deux niveaux de
    gouvernement. La référence est donc l'agrégat des **communes** de la même
    région, puis de toutes les communes de France — et le libellé le dit.

    Deux natures de référence, parce que deux natures de grandeur :

    - un montant qui s'additionne donne un **rapport agrégé** : somme des
      montants sur somme des populations. C'est la dépense par habitant de
      l'ensemble, pas une moyenne de moyennes — laquelle serait tirée par les
      milliers de communes minuscules qui pèsent chacune autant que Paris.
    - un taux ou une médiane ne s'additionne pas : la référence est la **médiane
      des territoires**, et rien d'autre n'aurait de sens.
    """
    sortie: dict = defaultdict(lambda: defaultdict(dict))
    # Les pays ne sont pas cartographiés — il n'y a pas de couche `pays` — donc
    # `cartographiees` les ignore. Sans ce complément, une fiche nationale
    # n'aurait aucun repère, alors que c'est précisément là qu'on veut savoir
    # « et les autres pays ? ».
    par_indicateur = defaultdict(lambda: defaultdict(list))
    for indicateur, niveau, periodes in (
        (i, n, p) for i, niveaux in cartographiees.items() for n, p in niveaux.items()
    ):
        par_indicateur[indicateur][niveau] = list(periodes)
    for indicateur, periode in couples_publies(conn, "pays", borne=False):
        par_indicateur[indicateur]["pays"].append(periode)

    # Les comptages sommables (établissements, écoles) n'ont pas de repère : la
    # médiane brute compare des territoires de tailles sans rapport — Marseille
    # et ses 4 346 faits contre une médiane à 10 donnait « +43 360 % », un
    # chiffre vrai qui ne dit rien. Un comptage se compare par taux ; le taux,
    # quand il existe, est un indicateur à part entière.
    masque = mailles_masquees(conn)
    for indicateur, sommable, unite, jeu in conn.execute(
        """
        select i.indicator_id, i.additive, i.unit, i.dataset_id
        from core.indicators i
        join meta.dataset_registry d using (dataset_id)
        where i.published and not (i.additive and i.unit = 'count')
        """
    ).fetchall():
        for niveau, periodes in par_indicateur.get(indicateur, {}).items():
            if niveau in masque.get(jeu, ()):
                continue
            for periode in periodes:
                calcul = _reference_par_region(conn, indicateur, niveau, periode, sommable, unite)
                if calcul:
                    sortie[indicateur][periode][niveau] = calcul
    return sortie


# Le secret statistique ne mord pas à toutes les mailles, et c'est vérifiable
# plutôt que supposé.
#
# **SSMSI.** Le dictionnaire des variables de la source ne porte l'indicatrice
# `est_diffuse` que dans la colonne « Communale » : seules les communes sont
# masquées, et selon un critère qui porte sur la valeur elle-même — moins de
# cinq faits sur trois années. Les basses valeurs disparaissent donc en bloc, et
# une médiane des communes visibles est tirée vers le haut d'un montant inconnu.
# Constaté : médiane nationale des cambriolages à 0 ‰ en face de Marseille.
# Aux mailles départementale et régionale, la source publie tout — 101
# départements sur 101, 18 régions sur 18, vérifié le 4 août sur les fichiers en
# ligne. Une médiane y porte sur l'ensemble entier et se compare honnêtement.
#
# **Filosofi.** L'INSEE masque les communes trop petites, pour la même raison et
# avec le même effet de sélection.
#
# Un jeu sous secret non listé ici est masqué partout : se taire ne vaut pas
# autorisation.
NIVEAUX_SOUS_SECRET = {
    "ssmsi-delinquance": {"commune"},
    "melodi-filosofi-cc": {"commune"},
}


def mailles_masquees(conn) -> dict[str, set[str]]:
    """-> {jeu: mailles où le secret interdit de calculer un repère}."""
    return {
        jeu: NIVEAUX_SOUS_SECRET.get(jeu, set(NIVEAUX))
        for (jeu,) in conn.execute(
            "select dataset_id from meta.dataset_registry where statistical_secrecy"
        ).fetchall()
    }


def _reference_par_region(conn, indicateur, niveau, periode, sommable, unite) -> dict | None:
    """Agrège les territoires d'un niveau, par région d'appartenance puis en tout.

    La région d'une commune est le parent de son parent ; celle d'un département
    est son parent ; une région est sa propre région. `population` vient de la
    référence OFGL de l'exercice quand elle existe, du référentiel sinon — le
    même dénominateur que le site.
    """
    lignes = conn.execute(
        """
        with territoire as (
            select g.geo_code, g.population,
                   case $niveau
                     when 'region' then g.geo_code
                     when 'pays' then null
                     when 'departement' then g.parent_code
                     -- Reste la commune, dont la région est le parent de son
                     -- parent. Le référentiel garantit ce chaînon : une commune
                     -- sans département n'existe pas au COG.
                     else (select d.parent_code from geo.geography_reference d
                            where d.geo_level = 'departement' and d.geo_code = g.parent_code
                              and d.vintage = g.vintage)
                   end as region
              from geo.geography_reference g
             where g.geo_level = $niveau
               and g.vintage = (select max(vintage) from geo.geography_reference
                                 where geo_level = $niveau)
        )
        select t.region, o.value,
               coalesce(p.value, t.population) as habitants
          from core.observations o
          join territoire t on t.geo_code = o.geo_code
          left join core.observations p
                 on p.indicator_id = 'ofgl_population_reference'
                and p.geo_level = o.geo_level and p.geo_code = o.geo_code
                and p.period = o.period and p.variant = 'total'
         where o.indicator_id = $indicateur and o.geo_level = $niveau
           and o.period = $periode and o.value_status = 'normal' and o.variant = 'total'
        """,
        {"niveau": niveau, "indicateur": indicateur, "periode": periode},
    ).fetchall()
    if not lignes:
        return None

    def agreger(sous_ensemble):
        valeurs = [float(v) for _, v, _ in sous_ensemble]
        # Deux médianes, parce que la fiche affiche l'une ou l'autre : celle des
        # montants bruts et celle des montants par habitant. Les confondre
        # mettrait 328 659 € en face de 871 € — deux échelles sans rapport.
        bloc: dict = {"n": len(valeurs), "mediane": _mediane(valeurs)}
        par_habitant = [float(v) / float(h) for _, v, h in sous_ensemble if h]
        if par_habitant:
            bloc["mediane_habitant"] = _mediane(par_habitant)
        if sommable and unite == "EUR":
            habitants = sum(float(h) for _, _, h in sous_ensemble if h)
            if habitants:
                bloc["total"] = sum(valeurs)
                bloc["habitants"] = habitants
        return bloc

    par_region: dict = defaultdict(list)
    for ligne in lignes:
        if ligne[0]:
            par_region[ligne[0]].append(ligne)
    return {
        "nature": "agregat" if (sommable and unite == "EUR") else "mediane",
        "france": agreger(lignes),
        "regions": {code: agreger(membres) for code, membres in par_region.items()},
    }


def _mediane(valeurs: list[float]) -> float:
    tri = sorted(valeurs)
    milieu = len(tri) // 2
    return tri[milieu] if len(tri) % 2 else (tri[milieu - 1] + tri[milieu]) / 2


def maires(conn) -> dict[str, dict]:
    """Le maire en exercice de chaque commune.

    Ni date de naissance, ni sexe, ni catégorie socio-professionnelle : la
    source les porte, la table ne les charge pas, et l'export ne peut donc pas
    les laisser fuir.
    """
    try:
        lignes = conn.execute(
            "select geo_code, surname, given_name, since from geo.commune_officials"
            " where role = 'maire'"
        ).fetchall()
    except Exception:  # noqa: BLE001 — table absente tant que 0010 n'est pas appliquée
        entrepot.annuler(conn)
        return {}
    return {
        code: {"nom": f"{prenom} {nom}".strip(), "depuis": depuis.isoformat() if depuis else None}
        for code, nom, prenom, depuis in lignes
    }


def _objet(valeur) -> dict:
    """Une colonne JSON de DuckDB -> un objet, jamais une chaîne.

    DuckDB rend `json` en texte. Le contrat publié dit un objet ; le publier en
    chaîne ne casse rien visiblement — le site lit une clé absente et n'affiche
    pas le bloc — et c'est bien pour cela que le défaut a tenu.
    """
    if isinstance(valeur, dict):
        return valeur
    if not valeur:
        return {}
    try:
        decode = json.loads(valeur)
    except (TypeError, ValueError):
        return {}
    return decode if isinstance(decode, dict) else {}


def programmes_budgetaires() -> dict[str, dict[str, str]]:
    """-> {numéro: {programme, mission}}, la nomenclature budgétaire figée.

    Le jaune des associations ne porte que le **numéro** du programme au titre
    duquel l'argent est versé. « 177 », ce n'est pas une réponse ; « Hébergement,
    parcours vers le logement et insertion des personnes vulnérables », si — et
    c'est la seule typologie disponible qui soit un vocabulaire contrôlé. Les
    2 362 objets de convention, eux, ne se regroupent pas.

    Figée en fichier de graine plutôt que lue en ligne à la publication : le
    dépôt doit pouvoir se rejouer sans réseau, et une nomenclature qui changerait
    entre deux publications ferait bouger des libellés sans qu'aucun commit ne le
    montre.
    """
    chemin = Path(__file__).resolve().parents[2] / "infra/seed/programmes_budgetaires.csv"
    if not chemin.exists():
        return {}
    with chemin.open(encoding="utf-8", newline="") as fichier:
        return {
            ligne["numero"]: {"programme": ligne["programme"], "mission": ligne["mission"]}
            for ligne in csv.DictReader(fichier)
        }


def subventions_nominatives(conn) -> dict[str, dict[str, dict]]:
    """Les associations subventionnées, par département puis par commune.

    Un agrégat de 353 € par habitant ne répond pas à la question qu'on vient
    poser — *à quelles associations* — et demande de croire sur parole. Le jaune
    budgétaire est le seul document public qui descende jusqu'au bénéficiaire
    nommé : le publier sans les noms revenait à le citer sans le montrer.

    Réparti par département, comme les fiches : cinquante-trois mille lignes en
    un fichier feraient télécharger la France entière pour lire une commune. Un
    même bénéficiaire peut apparaître deux fois s'il reçoit au titre de deux
    programmes ; les montants sont sommés par bénéficiaire, et le programme
    dominant est nommé.

    Les montants sont ceux de l'établissement bénéficiaire, à l'adresse de son
    siège. Le site le dit, et refuse d'en tirer une comparaison territoriale.
    """
    lignes = conn.execute(
        """
        select geo_code, beneficiary_siren,
               any_value(beneficiary_name) as nom,
               arg_max(programme, amount) as programme,
               arg_max(purpose, amount) as objet,
               sum(amount) as montant,
               max(fiscal_year) as exercice
        from fin.public_subsidies
        where geo_level = 'commune'
        group by geo_code, beneficiary_siren
        order by geo_code, sum(amount) desc, beneficiary_siren
        """
    ).fetchall()
    if not lignes:
        return {}
    # Le lot est le département, déduit du code commune comme ailleurs : 97x
    # pour l'outre-mer, les deux premiers chiffres sinon.
    nomenclature = programmes_budgetaires()
    lots: dict[str, dict[str, dict]] = defaultdict(dict)
    # Le total par programme : « à quelles associations » appelle « au titre de
    # quoi ». Un numéro ne répond pas ; le libellé de la nomenclature, si.
    parts: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for code, siren, nom, programme, objet, montant, exercice in lignes:
        lot = code[:3] if code.startswith("97") else code[:2]
        commune = lots[lot].setdefault(
            code, {"exercice": str(exercice), "beneficiaires": [], "programmes": []}
        )
        commune["beneficiaires"].append({
            "siren": siren,
            "nom": nom,
            "programme": programme,
            "objet": objet,
            "montant": round(montant, 2),
        })
        parts[code][programme] += montant
    for communes in lots.values():
        for code, commune in communes.items():
            commune["programmes"] = [
                {
                    "code": numero,
                    # Un numéro absent de la nomenclature garde son numéro plutôt
                    # que de disparaître : c'est un programme supprimé depuis, pas
                    # un versement qui n'aurait pas eu lieu.
                    "libelle": nomenclature.get(numero, {}).get("programme")
                    or f"Programme {numero}",
                    "mission": nomenclature.get(numero, {}).get("mission") or "",
                    "montant": round(total, 2),
                }
                for numero, total in sorted(
                    parts[code].items(), key=lambda x: -x[1]
                )
            ]
    return lots


def subventions_par_programme(conn, plafond: int = 50) -> dict:
    """Les bénéficiaires nommés, rassemblés par programme budgétaire.

    Le simulateur règle le budget de l'État programme par programme, et la
    question qui vient ensuite est « qui touche cet argent ». La réponse existe
    — le jaune budgétaire descend au bénéficiaire nommé — mais elle n'était
    publiée que **par commune** : le simulateur, qui est national, ne pouvait pas
    la lire.

    **Ce fichier ne décompose rien, et c'est la règle qui le gouverne.** Les
    subventions nominatives déclarées ne redonnent pas le total du programme
    dont elles relèvent : le jaune ne couvre pas tous les versements, et les
    crédits d'un programme financent bien autre chose que des associations. Le
    fichier publie donc, pour chaque programme, le total **des subventions
    déclarées** et le nombre de bénéficiaires — jamais une part du programme —,
    et l'affichage doit les présenter comme un tiroir à part, pas comme une
    décomposition. Publier `part_du_programme` ici serait offrir le chiffre qui
    fait mentir la page.

    Les bénéficiaires sont bornés aux `plafond` plus gros : la queue est longue
    (des milliers de versements de quelques milliers d'euros) et le fichier est
    lu par un simulateur qui s'ouvre sur téléphone. Le compte total dit ce que
    la liste ne montre pas.
    """
    lignes = conn.execute(
        """
        select programme, beneficiary_siren,
               any_value(beneficiary_name) as nom,
               arg_max(purpose, amount) as objet,
               sum(amount) as montant
        from fin.public_subsidies
        where geo_level = 'commune'
        group by programme, beneficiary_siren
        order by programme, sum(amount) desc, beneficiary_siren
        """
    ).fetchall()
    if not lignes:
        return {}
    nomenclature = programmes_budgetaires()
    exercice = conn.execute(
        "select max(fiscal_year) from fin.public_subsidies where geo_level = 'commune'"
    ).fetchone()[0]
    par_programme: dict[str, dict] = {}
    for programme, siren, nom, objet, montant in lignes:
        entree = par_programme.setdefault(
            programme,
            {
                # Un numéro absent de la nomenclature garde son numéro : c'est un
                # programme supprimé depuis, pas un versement qui n'a pas eu lieu.
                "libelle": nomenclature.get(programme, {}).get("programme")
                or f"Programme {programme}",
                "mission": nomenclature.get(programme, {}).get("mission") or "",
                "declare": 0.0,
                "beneficiaires_total": 0,
                "beneficiaires": [],
            },
        )
        entree["declare"] += montant
        entree["beneficiaires_total"] += 1
        if len(entree["beneficiaires"]) < plafond:
            entree["beneficiaires"].append(
                {"siren": siren, "nom": nom, "objet": objet, "montant": round(montant, 2)}
            )
    for entree in par_programme.values():
        entree["declare"] = round(entree["declare"], 2)
    return {
        "exercice": str(exercice),
        "plafond": plafond,
        "programmes": par_programme,
    }


# Les jeux dont les codes régionaux **pavent la France** : chaque territoire y
# est compté une fois et une seule, si bien que la somme des régions est le
# total national.
#
# La liste est courte et le refus est le défaut, pour une raison qu'un exemple
# suffit à donner : le code `69` ne désigne pas le même territoire selon la
# source. Pour l'INSEE et le SSMSI c'est le Rhône entier ; pour l'OFGL c'est le
# département du Rhône **hors** Métropole de Lyon, qui a son propre code. Une
# règle générale qui sommerait « tous les départements » serait donc fausse pour
# l'un ou pour l'autre, sans que rien ne le signale.
#
# Et pour les comptes des collectivités, le problème est plus profond qu'un
# code : `ofgl_depenses_fonctionnement` au niveau commune est la somme des
# budgets communaux, au niveau région celle des budgets régionaux. Ce sont deux
# grandeurs différentes, et leur « total national » n'existe qu'en additionnant
# tous les échelons — intercommunalités comprises, que ce site ne publie plus.
# Un nombre présenté comme « la dépense de fonctionnement en France » serait
# alors amputé sans le dire. Aucun jeu de l'OFGL n'entre donc ici.
JEUX_QUI_PAVENT_LA_FRANCE = frozenset({
    "ssmsi-delinquance",
    "melodi-flores-a5",
    "melodi-bpe",
    "rpls-logement-social",
    "menj-annuaire-education",
    "anct-fonds-europeens-2021-2027",
    "melodi-side-creations",
})


def agregats_nationaux(conn) -> tuple[dict[str, dict[str, float]], dict]:
    """-> ({indicateur: {periode: total}}, ce que la méthode doit dire).

    La fiche nationale n'affichait que ce qu'une source publie déjà au niveau
    France : le budget de l'État, la dette, Eurostat. Tout ce qui est mesuré
    territoire par territoire — la délinquance, les équipements, le logement
    social — y manquait, alors que la donnée est là, complète, une maille plus
    bas. « Pourquoi n'y a-t-il pas la sécurité au niveau France » est une
    question à laquelle il n'y avait pas de bonne réponse.

    L'agrégat est la **somme des régions**, et trois conditions le gouvernent.

    **L'indicateur doit s'additionner.** Un taux ne se somme pas : la moyenne
    de dix-huit taux régionaux n'est pas le taux national, elle ignore que les
    régions n'ont pas le même poids. Seuls les indicateurs déclarés additifs
    sont agrégés ; les taux restent absents et leur numérateur, lui, apparaît.

    **Les régions doivent paver la France.** Toutes celles du référentiel
    doivent porter une valeur pour cette période — pas 95 %, toutes. Une somme à
    laquelle il manque une région est un total national faux, et rien dans le
    nombre ne le dirait. Le contrôle est écrit dans le fichier de méthode plutôt
    que supposé.

    **Le jeu doit avoir une géographie statistique**, ce que `JEUX_QUI_PAVENT_LA_FRANCE`
    déclare jeu par jeu, avec la raison du refus pour les autres.

    Le total porte sur la **France entière, outre-mer compris** — dix-huit
    régions, dont cinq d'outre-mer. Beaucoup de chiffres nationaux publiés
    ailleurs portent sur la France métropolitaine seule : les deux ne se
    comparent pas, et la fiche le dit.
    """
    attendues = {
        code for (code,) in conn.execute(
            """
            select geo_code from geo.geography_reference
             where geo_level = 'region'
               and vintage = (select max(vintage) from geo.geography_reference
                               where geo_level = 'region')
            """
        ).fetchall()
    }
    if not attendues:
        return {}, {"regions_attendues": 0, "indicateurs": [], "ecartes": []}

    deja = {
        indicateur for (indicateur,) in conn.execute(
            "select distinct indicator_id from core.observations where geo_level = 'pays'"
        ).fetchall()
    }
    additifs = {
        indicateur: jeu for indicateur, jeu in conn.execute(
            "select indicator_id, dataset_id from core.indicators"
            " where additive and published"
        ).fetchall()
    }

    totaux: dict[str, dict[str, float]] = defaultdict(dict)
    ecartes: list[dict] = []
    for indicateur, periodes in valeurs_par_niveau(conn, "region").items():
        jeu = additifs.get(indicateur)
        if indicateur in deja or jeu is None or jeu not in JEUX_QUI_PAVENT_LA_FRANCE:
            continue
        for periode, codes in periodes.items():
            manquantes = attendues - set(codes)
            if manquantes:
                ecartes.append({
                    "indicateur": indicateur, "periode": periode,
                    "regions_manquantes": sorted(manquantes),
                })
                continue
            # Seules les régions attendues : une entrée du référentiel qui n'y
            # serait plus compterait deux fois le même territoire.
            totaux[indicateur][periode] = sum(codes[code] for code in attendues)

    methode = {
        "regions_attendues": len(attendues),
        "perimetre": "France entière, outre-mer compris",
        "indicateurs": sorted(totaux),
        "ecartes": sorted(ecartes, key=lambda e: (e["indicateur"], e["periode"])),
    }
    return dict(totaux), methode


def territoires(conn, niveau: str) -> dict[str, dict]:
    changements = evenements(conn, niveau)
    elus = maires(conn) if niveau == "commune" else {}
    return {
        code: {
            "nom": nom,
            "parent": parent,
            # La région d'appartenance : sans elle, le site ne saurait pas à quel
            # ensemble comparer un territoire.
            "region": region,
            "population": population,
            # Les drapeaux sortent de DuckDB en texte JSON. Publiés tels quels,
            # le site lisait `territoire.drapeaux["tranche_population"]` sur une
            # chaîne et obtenait `undefined` : la clé du groupe de comparaison
            # se construisait à « || », aucun groupe ne correspondait, et le
            # bloc « parmi N communes semblables » ne s'affichait jamais. La
            # question la plus posée du site est restée muette depuis la
            # migration, sans que rien ne le signale — un objet vide n'est pas
            # une erreur, c'est une absence.
            "drapeaux": _objet(drapeaux),
            "evenements": changements.get(code, []),
            **({"maire": elus[code]} if code in elus else {}),
        }
        for code, nom, parent, region, population, drapeaux in conn.execute(
            """
            select g.geo_code, g.name, g.parent_code,
                   case $niveau
                     when 'region' then g.geo_code
                     when 'departement' then g.parent_code
                     -- Un arrondissement municipal a pour parent sa commune,
                     -- pas un département : sa région est celle de sa commune
                     -- mère, soit un chaînon de plus. Sans ce cas, les 45
                     -- arrondissements sortaient avec `region: null` et la
                     -- fiche n'avait plus d'ensemble auquel se rapporter.
                     when 'arrondissement_municipal' then (
                        select d.parent_code from geo.geography_reference d
                         where d.geo_level = 'departement' and d.vintage = g.vintage
                           and d.geo_code = (
                             select c.parent_code from geo.geography_reference c
                              where c.geo_level = 'commune' and c.geo_code = g.parent_code
                                and c.vintage = g.vintage))
                     else (select d.parent_code from geo.geography_reference d
                            where d.geo_level = 'departement' and d.geo_code = g.parent_code
                              and d.vintage = g.vintage)
                   end as region,
                   g.population, g.flags
            from geo.geography_reference g
            where g.geo_level = $niveau and g.vintage = (select max(vintage)
                from geo.geography_reference where geo_level = $niveau)
            """,
            {"niveau": niveau},
        ).fetchall()
    }


# Le dénominateur des cartes « par habitant » : la population de référence de
# l'exercice, publiée par l'OFGL avec les comptes qu'elle divise. Elle change
# d'un exercice à l'autre — une dépense de 2022 se rapporte aux habitants de
# 2022 — et c'est ce qui oblige l'index à porter une valeur par période.
DENOMINATEUR = "ofgl_population_reference"


def index_territoires(conn, niveau: str, entites: dict[str, dict], valeurs: dict) -> dict:
    """L'index léger d'une maille : de quoi peindre et classer, sans les séries.

    Peindre une couche « par habitant » ne demande que deux choses par
    territoire : son **nom** — colonne du tableau, infobulle, étiquette — et sa
    **population de référence** pour l'exercice affiché, qui est le
    dénominateur. Le site allait les chercher dans les fiches : cent un fichiers
    départementaux, plusieurs centaines de mégaoctets de séries complètes,
    téléchargés et analysés pour en extraire deux champs. Les fiches restent ce
    qu'elles sont — un lot par département, chargé quand on ouvre un
    territoire — mais la carte n'en dépend plus.

    Format colonnaire : un tableau par champ, tous rangés dans l'ordre de
    `codes`. Répéter les noms de clés 34 875 fois coûtait un mégaoctet pour ne
    rien dire de plus, et le lecteur d'un fichier tabulaire lit des colonnes.

    Ce que porte l'en-tête, parce qu'aucun chiffre ne se publie sans :
    - `denominateur` : l'indicateur dont viennent les populations de référence,
      décrit dans `indicateurs.json` (source, définition, licence) ;
    - `periodes` : les millésimes de ce dénominateur, dans l'ordre des valeurs
      de `population_reference` ;
    - `unite` : des habitants, pour les deux populations ;
    - `millesime_geographique` : le millésime du référentiel INSEE d'où sortent
      les noms, les rattachements et la population municipale.
    """
    (millesime,) = conn.execute(
        "select max(vintage) from geo.geography_reference where geo_level = ?",
        (niveau,),
    ).fetchone()
    reference = valeurs.get(DENOMINATEUR, {})
    periodes = sorted(reference)
    codes = sorted(entites)

    def compter(valeur):
        # Un effectif s'écrit en entier : « 785.0 » coûte deux octets de plus
        # que « 785 », trente-quatre mille fois par période.
        if valeur is None:
            return None
        return int(valeur) if float(valeur).is_integer() else valeur

    return {
        "denominateur": DENOMINATEUR,
        "periodes": periodes,
        "unite": "habitants",
        "millesime_geographique": millesime,
        "codes": codes,
        "noms": [entites[code]["nom"] for code in codes],
        "parents": [entites[code]["parent"] for code in codes],
        "population_municipale": [compter(entites[code]["population"]) for code in codes],
        "population_reference": [
            [compter(reference[periode].get(code)) for periode in periodes] for code in codes
        ],
    }


# Perte au-delà de laquelle une publication est refusée. Un chargement partiel
# retire toujours quelques indicateurs — un producteur qui décale un millésime,
# une classe sous secret statistique — mais pas le cinquième du catalogue.
PERTE_MAXIMALE = 0.2


def controler_avant_publication(conn, store) -> None:
    """Refuse d'écraser le pointeur avec un jeu nettement amputé.

    Le pointeur `data/derniere.json` est la seule chose que le site lit pour
    savoir quoi afficher. Le réécrire vers une publication vide ou tronquée fait
    disparaître le site en une commande, sans erreur nulle part : les fichiers
    déposés sont valides, ils sont simplement presque vides.

    Ce garde-fou n'existait pas. Il aurait dû : le jour où l'entrepôt est devenu
    un fichier neuf, republier avant de l'avoir rempli aurait suffi. On compare
    donc le catalogue qu'on s'apprête à publier à celui qui est en ligne, et on
    s'arrête plutôt que de le remplacer par moins.
    """
    try:
        pointeur = json.loads(store.get("data/derniere.json"))
        publies = json.loads(store.get(f"data/{pointeur['version']}/indicateurs.json"))
    except Exception:  # noqa: BLE001
        return  # rien en ligne : la première publication n'a rien à préserver
    avant = len(publies)
    (apres,) = conn.execute("select count(*) from core.indicators where published").fetchone()
    if avant and apres < avant * (1 - PERTE_MAXIMALE):
        raise RuntimeError(
            f"publication refusée : {apres} indicateurs contre {avant} en ligne"
            f" (version {pointeur['version']}). Un entrepôt incomplet ne doit pas"
            " remplacer un site complet — recharger avant de republier."
        )


def controler_version_libre(store, racine: str) -> None:
    """Une publication n'écrase pas une publication.

    Chaque fichier était protégé par un contrôle d'immutabilité : un `HEAD`
    avant chaque `PUT`, soit deux allers-retours par fichier et deux mille
    fichiers. Sur une version neuve — l'horodatage du run — ce contrôle ne peut
    jamais rien trouver : il payait le prix d'une garantie qu'il n'exerçait pas.

    Le vrai risque tient en une clé : deux publications à la même minute, ou une
    republication de la même version. Il se vérifie une fois, ici, sur le
    manifeste — le premier fichier déposé. Le reste écrit sans redemander.

    La garantie d'immutabilité des instantanés bruts, elle, ne bouge pas : c'est
    une autre racine, un autre écrivain, et `Flux` n'y est pas employé.
    """
    manifeste = f"{racine}/manifeste.json"
    try:
        store.get(manifeste)
    except Exception:  # noqa: BLE001 — absent est le cas normal, et il se dit ainsi
        return
    raise ImmutabilityError(
        f"publication refusée : {racine} existe déjà. Deux publications ne"
        " peuvent pas partager une version — relancer avec un horodatage neuf."
    )


def publier(conn, store, version: str) -> int:
    controler_avant_publication(conn, store)
    racine = f"data/{version}"
    controler_version_libre(store, racine)
    with Flux(store, overwrite=True) as flux:
        _ecrire(conn, flux, racine, version)
        fichiers, octets = flux.fichiers, flux.octets
    # Le pointeur en dernier, et seulement lui hors du flux : c'est le geste qui
    # rend la publication visible, et il ne doit pas partir en même temps que
    # les fichiers qu'il désigne. Tant qu'il n'a pas bougé, une publication
    # interrompue n'est qu'une version que personne ne lit.
    store.put("data/derniere.json", _json({"version": version}), overwrite=True)
    print(f"publication {version} : {fichiers} fichiers, {octets // 1024 // 1024} Mio")
    return fichiers


def _ecrire(conn, flux, racine: str, version: str) -> None:
    """Tout le jeu publié, sauf le pointeur. Séparé de `publier` pour que le
    flux se referme — et attende ses écritures — avant que le pointeur ne bouge."""

    def deposer(chemin: str, charge) -> None:
        flux.deposer(f"{racine}/{chemin}", _json(charge))

    deposer("manifeste.json", manifeste(conn, version))
    recales = synchroniser_niveaux(conn)
    if recales:
        print(f"catalogue : {recales} indicateurs recalés sur les niveaux réellement présents")
    # Le journal est déclaré en code : publier est le moment où ce que dit le
    # dépôt devient ce que voit le public. Le synchroniser ici empêche l'export
    # de dériver de la déclaration.
    print(f"journal : {journal_declare.synchroniser(conn)} changements déclarés")

    # Les sommes régionales, calculées avant la boucle : elles rejoignent les
    # séries de la France, qui n'en avait aucune pour tout ce qui se mesure
    # territoire par territoire.
    nationaux, methode_nationale = agregats_nationaux(conn)
    print(
        f"agrégats nationaux : {len(nationaux)} indicateurs sommés sur"
        f" {methode_nationale['regions_attendues']} régions,"
        f" {len(methode_nationale['ecartes'])} écartés faute d'une région"
    )

    recherche = []
    cartographiees: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for niveau in NIVEAUX:
        entites = territoires(conn, niveau)
        valeurs = valeurs_par_niveau(conn, niveau)

        if niveau in NIVEAUX_CARTOGRAPHIES:
            for indicateur, periodes in valeurs.items():
                # Seule la carte est bornée aux périodes récentes : un fichier
                # par période et par indicateur. Les fiches, elles, reçoivent
                # la profondeur entière — la borne les amputait en silence dès
                # la première série mensuelle communale (19 mois de prisons
                # publiés, 12 servis), et rognait déjà le parc automobile
                # (16 millésimes) et la consommation d'espaces (14).
                recentes = sorted(periodes)[-PERIODES_CARTOGRAPHIEES:]
                cartographiees[indicateur][niveau] = recentes
                for periode in recentes:
                    deposer(f"carte/{indicateur}/{niveau}/{periode}.json", periodes[periode])

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
            propres = {k: v for k, v in series.items() if v}
            if niveau == "pays" and code == "FR":
                # Jamais par-dessus : une valeur publiée par la source prime sur
                # notre somme, toujours. `agregats_nationaux` écarte déjà les
                # indicateurs présents au niveau pays ; la garde reste ici pour
                # que l'ordre des deux ne puisse pas s'inverser en silence.
                for indicateur, periodes in nationaux.items():
                    propres.setdefault(indicateur, periodes)
            groupes[lot][code] = {**entite, "series": propres}
            recherche.append({"c": code, "n": entite["nom"], "l": niveau, "p": entite["parent"]})

        for lot, contenu in groupes.items():
            deposer(f"territoires/{niveau}/{lot}.json", contenu)

        # L'index de la maille, après les lots dont il est l'extrait : noms et
        # dénominateurs seuls, pour que peindre une carte ne demande plus de
        # télécharger les séries de tous les territoires de France.
        index = index_territoires(conn, niveau, entites, valeurs)
        deposer(f"territoires/{niveau}/index.json", index)

    # Le catalogue est déposé après la boucle : il annonce les périodes dont la
    # couche a réellement été écrite.
    deposer("indicateurs.json", indicateurs(conn, cartographiees))
    deposer("recherche.json", recherche)
    deposer("comparaisons.json", comparaisons(conn))
    deposer("budget-etat.json", budget_etat(conn))
    deposer("depenses-fiscales.json", depenses_fiscales(conn))
    # Un fichier par exercice : le simulateur en ouvre un seul à la fois, et le
    # plus récent (105 Ko compacts pour 2025) est déjà à la limite de ce qu'on
    # peut demander à un téléphone. L'index dit lesquels existent, du plus récent
    # au plus ancien : c'est lui que le site lit d'abord.
    budgets = simulateur(conn)
    for exercice, budget in budgets.items():
        deposer(f"simulateur/etat-{exercice}.json", budget)
    deposer("simulateur/index.json", sorted(budgets, reverse=True))
    deposer("agregats-nationaux.json", methode_nationale)
    for lot, contenu in subventions_nominatives(conn).items():
        deposer(f"subventions/commune/{lot}.json", contenu)
    # Les mêmes versements, rassemblés par programme : c'est ce que lit le
    # simulateur, qui règle un budget national et ne peut pas ouvrir cent un
    # fichiers départementaux pour dire qui touche quoi.
    par_programme = subventions_par_programme(conn)
    if par_programme:
        deposer("subventions/programme.json", par_programme)
    deposer("fraicheur.json", fraicheur(conn))
    deposer("journal.json", journal(conn))
    deposer("references.json", references(conn, cartographiees))
    print(f"catalogue : {len(recherche)} territoires publiés")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--publication", default=".published")
    parser.add_argument("--version", default=datetime.now(UTC).strftime("%Y-%m-%dT%H%M"))
    args = parser.parse_args()
    conn = entrepot.connect()
    try:
        publier(conn, make_store(args.publication), args.version)
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
