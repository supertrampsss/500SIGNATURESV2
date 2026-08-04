"""T-12 — Finances locales OFGL vers core.indicators / core.observations.

Usage : python -m plateforme.normalize.ofgl [--niveaux commune,epci,departement,region]
                                            [--depuis 2018] [--store r2:plateforme-raw]
"""

import json
import argparse


from plateforme import entrepot
from plateforme.limites import garde_fou_volume
from plateforme.connectors import ofgl
from plateforme.http import fetch
from plateforme.normalize.geo import MILLESIME, make_store

JEUX = {
    "commune": "ofgl-communes",
    "epci": "ofgl-gfp",
    "departement": "ofgl-departements",
    "region": "ofgl-regions",
}

POPULATION = "ofgl_population_reference"

# Fiche de chaque indicateur (docs/06 : définition grand public ≤ 50 mots,
# définition technique, formule, unité, niveau de confiance).
# Fiches rédigées à la main : celles des agrégats qui ouvrent la fiche
# territoire et qu'on veut lisibles par quelqu'un qui n'a jamais vu un budget
# communal. Les autres agrégats chargés reprennent la documentation de l'OFGL
# — définition et formule comptable publiées par le producteur — plutôt qu'une
# reformulation de notre cru : voir `fiches()` plus bas.
FICHES_REDIGEES = {
    "ofgl_depenses_fonctionnement": (
        "Ce que la collectivité dépense chaque année pour faire tourner ses services :"
        " personnel, achats, subventions versées, intérêts de sa dette."
        " N'inclut pas les investissements.",
        "Dépenses réelles de fonctionnement de l'exercice, budget principal et budgets"
        " annexes consolidés (agrégat OFGL « Dépenses de fonctionnement »).",
        "Dépenses de fonctionnement",
    ),
    "ofgl_recettes_fonctionnement": (
        "Ce que la collectivité encaisse chaque année pour financer son fonctionnement :"
        " impôts locaux, dotations de l'État, produits des services rendus."
        " N'inclut pas les emprunts.",
        "Recettes réelles de fonctionnement de l'exercice, budget principal et budgets"
        " annexes consolidés (agrégat OFGL « Recettes de fonctionnement »).",
        "Recettes de fonctionnement",
    ),
    "ofgl_depenses_investissement": (
        "Ce que la collectivité consacre chaque année à ses équipements durables —"
        " bâtiments, voirie, matériel — et au remboursement du capital de sa dette.",
        "Dépenses réelles d'investissement de l'exercice, remboursements d'emprunts"
        " compris (agrégat OFGL « Dépenses d'investissement »).",
        "Dépenses d'investissement",
    ),
    "ofgl_epargne_brute": (
        "Ce qui reste des recettes de fonctionnement une fois payées les dépenses de"
        " fonctionnement. Cette somme finance les investissements et le remboursement"
        " de la dette.",
        "Recettes réelles de fonctionnement moins dépenses réelles de fonctionnement"
        " (agrégat OFGL « Epargne brute »). Peut être négative.",
        "Recettes de fonctionnement − Dépenses de fonctionnement",
    ),
    "ofgl_encours_dette": (
        "Capital que la collectivité doit encore rembourser à ses prêteurs au"
        " 31 décembre. Ne comprend pas les intérêts restant à payer.",
        "Encours de dette au 31 décembre de l'exercice, budget principal et budgets"
        " annexes consolidés (agrégat OFGL « Encours de dette »).",
        "Encours de dette au 31/12",
    ),
    "ofgl_frais_personnel": (
        "Ce que la collectivité paie chaque année à ses agents : salaires, primes"
        " et cotisations. C'est presque toujours le premier poste de son budget de"
        " fonctionnement.",
        "Frais de personnel de l'exercice, budget principal et budgets annexes"
        " consolidés (agrégat OFGL « Frais de personnel »). Rémunérations et"
        " charges sociales comprises ; ne comprend pas le personnel des"
        " satellites — associations subventionnées, délégataires — dont la"
        " dépense apparaît ailleurs.",
        "Frais de personnel",
    ),
    "ofgl_charges_financieres": (
        "Les intérêts que la collectivité paie sur sa dette. Ce n'est pas le"
        " remboursement de la dette elle-même, qui figure dans les dépenses"
        " d'investissement : c'est le prix de l'emprunt.",
        "Charges financières de l'exercice, budget principal et budgets annexes"
        " consolidés (agrégat OFGL « Charges financières »). Intérêts payés, à ne"
        " pas additionner avec le remboursement du capital : les deux relèvent de"
        " sections comptables différentes.",
        "Charges financières",
    ),
    "ofgl_epargne_nette": (
        "Ce qui reste à la collectivité une fois payés le fonctionnement et le"
        " remboursement de sa dette. C'est ce qu'elle peut réellement consacrer à"
        " de nouveaux équipements sans emprunter.",
        "Épargne brute moins le remboursement du capital de la dette (agrégat"
        " OFGL « Epargne nette »). Peut être négative : la collectivité emprunte"
        " alors pour rembourser.",
        "Épargne brute − Remboursement du capital",
    ),
    # Trois agrégats que l'OFGL publie sans les commenter. Leur définition est
    # écrite ici, par nous, à partir de la formule comptable que l'OFGL publie
    # bien — c'est elle qui dit exactement quels comptes les composent. Elles ne
    # sont donc pas des suppositions, mais elles ne sont pas non plus de la
    # documentation officielle : la fiche le dit.
    "ofgl_credits_de_tresorerie": (
        "Emprunts à très court terme mobilisés pour couvrir un décalage entre les"
        " encaissements et les décaissements. Ils ne financent aucun investissement"
        " et se remboursent dans l'année.",
        "Solde créditeur du compte 519 (concours financiers à court terme)."
        " À ne pas confondre avec l'encours de dette, qui porte les emprunts"
        " souscrits pour investir. Définition rédigée par ce site à partir de la"
        " formule comptable publiée par l'OFGL, qui ne commente pas cet agrégat.",
        "SC519 (concours financiers à court terme)",
    ),
    "ofgl_fonds_de_roulement": (
        "Ce que la collectivité a en réserve à la clôture de l'exercice, une fois"
        " ses immobilisations financées. C'est une marge de trésorerie, pas un"
        " résultat de l'année.",
        "Comptes de stocks, de tiers et comptes financiers, nets de leurs"
        " dépréciations, augmentés des intérêts courus et des opérations sur"
        " capital remboursable in fine. Grandeur de bilan, arrêtée au 31 décembre :"
        " elle ne s'additionne pas d'une année sur l'autre. Définition rédigée par"
        " ce site à partir de la formule comptable publiée par l'OFGL, qui ne"
        " commente pas cet agrégat.",
        "Stocks + tiers + comptes financiers − dépréciations (+ intérêts courus)",
    ),
    "ofgl_produit_des_cessions_d_immobilisations": (
        "Ce que la collectivité encaisse en vendant un bien qu'elle possédait —"
        " terrain, bâtiment, véhicule. Une recette exceptionnelle : elle ne se"
        " reproduit pas l'année suivante, et vendre un bien n'est pas produire une"
        " ressource durable.",
        "Solde créditeur du compte 775 (produits des cessions d'éléments d'actif)."
        " Exclu des recettes de fonctionnement par l'OFGL, précisément parce qu'il"
        " n'est pas récurrent. Définition rédigée par ce site à partir de la"
        " formule comptable publiée par l'OFGL, qui ne commente pas cet agrégat.",
        "CN775 (produits des cessions d'éléments d'actif)",
    ),
    POPULATION: (
        "Population utilisée par l'Observatoire des finances locales pour calculer ses"
        " montants par habitant. La reprendre garantit que nos ratios par habitant"
        " reproduisent exactement les siens.",
        "Population totale (colonne ptot) associée par l'OFGL à chaque territoire et"
        " exercice.",
        "Population totale retenue par l'OFGL",
    ),
}

LIBELLES_REDIGES = {
    "ofgl_depenses_fonctionnement": "Dépenses de fonctionnement",
    "ofgl_recettes_fonctionnement": "Recettes de fonctionnement",
    "ofgl_depenses_investissement": "Dépenses d'investissement",
    "ofgl_epargne_brute": "Épargne brute",
    "ofgl_encours_dette": "Encours de dette",
    "ofgl_frais_personnel": "Frais de personnel",
    "ofgl_charges_financieres": "Charges financières (intérêts de la dette)",
    "ofgl_epargne_nette": "Épargne nette",
    POPULATION: "Population de référence OFGL",
}


# La fiche publique tient en 50 mots (docs/06, contrainte vérifiée par le
# schéma). Treize définitions de l'OFGL dépassent — jusqu'à 137 mots pour les
# DMTO. On ne les tronque pas : couper au cinquantième mot ferait tomber, pour
# deux d'entre elles, la rupture de série de 2024, qui est précisément ce qu'un
# lecteur doit savoir avant de comparer 2023 à 2024. Le texte du producteur est
# donc gardé **entier** dans la définition technique, et la fiche publique est
# un résumé écrit ici, fidèle, qui garde les réserves.
MOTS_MAXIMUM = 50

RESUMES_PUBLICS = {
    "ofgl_autres_depenses_d_investissement":
        "Solde des dépenses réelles d'investissement hors emprunts : ce qui n'est"
        " ni remboursement d'emprunt, ni dépense d'équipement, ni subvention"
        " d'équipement versée. On y trouve notamment les opérations sur"
        " immobilisations financières et pour compte de tiers.",
    "ofgl_autres_impots_et_taxes":
        "Produits fiscaux autres que ceux de la fiscalité directe locale, nets des"
        " reversements versés par la collectivité à ce titre et augmentés des"
        " reversements qu'elle perçoit. Sous-poste des impôts et taxes.",
    "ofgl_autres_recettes_d_investissement":
        "Solde des recettes réelles d'investissement hors emprunts : ce qui n'est"
        " ni emprunt, ni FCTVA, ni dotation ou subvention reçue. Peut comprendre"
        " des opérations sur immobilisations financières ou pour compte de tiers.",
    "ofgl_depenses_d_intervention":
        "Aides et subventions versées par la collectivité à des tiers :"
        " particuliers, associations, autres collectivités. L'un des postes des"
        " dépenses de fonctionnement. Rupture de série en 2024 : la consolidation"
        " avec les budgets annexes a changé de règle (voir la définition technique).",
    "ofgl_dmto_apres_pereq":
        "Droits de mutation à titre onéreux perçus sur les ventes immobilières,"
        " après les prélèvements et redistributions du fonds de péréquation."
        " Publiés pour les départements — dont Paris et la Métropole de Lyon —,"
        " pas pour les communes ni les groupements.",
    "ofgl_dmto_avant_pereq":
        "Droits de mutation à titre onéreux perçus sur les ventes immobilières,"
        " avant le fonds de péréquation : ni ses prélèvements ni ses"
        " redistributions n'y figurent. Publiés pour les départements — dont Paris"
        " et la Métropole de Lyon —, pas pour les communes ni les groupements.",
    "ofgl_emprunts_hors_gad":
        "Emprunts et dettes mobilisés par la collectivité dans l'année, hors"
        " gestion active de la dette : les lignes de trésorerie et les emprunts de"
        " refinancement, équilibrés en recettes et en dépenses, en sont exclus.",
    "ofgl_fiscalite_reversee":
        "Reversements de fiscalité reçus par la collectivité, diminués de ceux"
        " qu'elle verse, hors fonds de péréquation. Le montant est négatif quand"
        " elle reverse plus qu'elle ne reçoit. Sous-poste des impôts locaux.",
    "ofgl_fonds_de_soutien_aux_emprunts_a_risque":
        "Aides restant à recevoir au 31 décembre au titre des emprunts à risque"
        " dont les indemnités de remboursement anticipé ont été capitalisées. En"
        " analyse financière, ce montant peut être retranché de l'encours de dette.",
    "ofgl_impots_locaux":
        "Produit de la fiscalité directe locale sur les ménages et les entreprises"
        " — taxes foncières, taxe d'habitation, CVAE —, net des reversements versés"
        " par la collectivité et augmenté de ceux qu'elle perçoit. Sous-poste des"
        " impôts et taxes.",
    "ofgl_remboursements_d_emprunts_hors_gad":
        "Dette remboursée par la collectivité dans l'année, hors gestion active de"
        " la dette : les mouvements sur lignes de trésorerie et les réaménagements"
        " refinancés, équilibrés en recettes et en dépenses, en sont exclus.",
    "ofgl_subventions_recues_et_participations":
        "Contributions versées par des tiers à la collectivité pour financer les"
        " services qu'elle assure. Sous-poste des recettes de fonctionnement."
        " Rupture de série en 2024 : la consolidation avec les budgets annexes a"
        " changé de règle (voir la définition technique).",
    "ofgl_variation_du_fonds_de_roulement":
        "Différence entre les recettes réelles et les dépenses réelles de l'année."
        " Elle se décompose entre ce qui vient hors dette — capacité ou besoin de"
        " financement — et le flux net de dette.",
}


class ResumeManquant(RuntimeError):
    """Une définition de l'OFGL trop longue pour la fiche publique, sans résumé.

    Le chargement s'arrête là plutôt que de laisser le schéma refuser l'insertion
    après vingt minutes de téléchargement — et plutôt que de publier une fiche
    coupée au milieu d'une phrase.
    """


class DefinitionManquante(RuntimeError):
    """Un agrégat retenu dont ni nous ni l'OFGL n'avons écrit la définition.

    Trois agrégats sur les 72 sont dans ce cas — crédits de trésorerie, fonds de
    roulement, produit des cessions d'immobilisations : l'OFGL les publie sans
    les commenter. Les charger sans définition reviendrait à afficher un montant
    que personne, nous compris, ne saurait expliquer. Le chargement s'arrête donc
    net, et la définition se rédige avant.
    """


def fiches() -> dict[str, tuple[str, str, str]]:
    """Fiche de chaque agrégat retenu : grand public, technique, formule."""
    return fiches_depuis(ofgl.catalogue())


def fiches_depuis(catalogue: list[dict]) -> dict[str, tuple[str, str, str]]:
    sortie = dict(FICHES_REDIGEES)
    for ligne in catalogue:
        if ligne["charge"] != "oui" or ligne["indicateur"] in sortie:
            continue
        definition = ligne["definition_ofgl"].strip()
        if not definition:
            raise DefinitionManquante(
                f"{ligne['agregat']} : aucune définition, ni chez nous ni à l'OFGL."
                " Rédiger la fiche avant de le charger (docs/06)."
            )
        # Le chemin OFGL situe l'agrégat dans la hiérarchie des comptes :
        # « Dépenses totales > Dépenses de fonctionnement > » dit qu'il en est
        # un sous-poste, donc qu'il ne s'ajoute pas à son propre total.
        chemin = ligne["chemin"].strip().rstrip(">").strip()
        technique = definition + (
            f" Sous-poste de : {chemin}." if chemin else ""
        ) + " Définition publiée par l'Observatoire des finances et de la gestion"
        technique += " publique locales ; agrégat calculé par lui à partir des balances"
        technique += " comptables de la DGFiP."
        public = definition
        if len(public.split()) > MOTS_MAXIMUM:
            public = RESUMES_PUBLICS.get(ligne["indicateur"], "")
            if not public:
                raise ResumeManquant(
                    f"{ligne['agregat']} : définition de {len(definition.split())} mots,"
                    f" la fiche publique en admet {MOTS_MAXIMUM}. Écrire son résumé"
                    " dans RESUMES_PUBLICS avant de le charger (docs/06)."
                )
        sortie[ligne["indicateur"]] = (public, technique, ligne["formule_ofgl"] or chemin)
    return sortie


def libelles() -> dict[str, str]:
    """Libellé d'affichage : le nôtre quand il est rédigé, celui de l'OFGL sinon."""
    sortie = dict(LIBELLES_REDIGES)
    for ligne in ofgl.catalogue():
        if ligne["charge"] == "oui":
            sortie.setdefault(ligne["indicateur"], ligne["agregat"])
    return sortie


def declarer_indicateurs(conn, niveaux: list[str]) -> None:
    """Crée ou met à jour les fiches. Sans fiche complète, le schéma refuse la
    publication (docs/02 §C) — la définition précède donc toujours la donnée."""
    with conn.cursor() as cur:
        toutes, noms = fiches(), libelles()
        for indicateur, (grand_public, technique, formule) in toutes.items():
            population = indicateur == POPULATION
            definition = cur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed', array['Officiel','Donnée brute'])
                returning definition_id
                """,
                (grand_public, technique, formule),
            ).fetchone()[0]
            cur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, price_basis, accounting_frame, geo_levels,
                     time_granularity, published)
                values (?, 'ofgl-communes', ?, ?, ?, ?, true, ?, ?, ?, 'annuelle', true)
                on conflict (indicator_id) do update set
                    definition_id = excluded.definition_id,
                    -- Union et non remplacement : un chargement portant sur les
                    -- seules communes ne doit pas faire disparaître du catalogue
                    -- les départements déjà chargés. Le niveau réel est de toute
                    -- façon recalculé depuis les données à la publication.
                    -- En expression et non en sous-requête : DuckDB refuse un
                    -- select dans un `do update set`.
                    geo_levels = list_sort(list_distinct(
                        core.indicators.geo_levels || excluded.geo_levels
                    )),
                    published = true
                """,
                (
                    indicateur,
                    definition,
                    "population" if population else "finances_locales",
                    noms[indicateur],
                    "count" if population else "EUR",
                    None if population else "current",
                    None if population else "budgetaire",
                    niveaux,
                ),
            )
        # Une fiche remplacée ne doit pas survivre en orphelin.
        cur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def observations(lignes: list[dict], depuis: int) -> tuple[list[tuple], list[tuple]]:
    """-> (montants, populations) prêts pour COPY.

    Les montants sont sommés par territoire et exercice : une commune nouvelle
    porte encore une ligne par commune d'origine (cf. connectors/ofgl.py). La
    population l'est aussi, mais sur les budgets distincts — OFGL la répète sur
    chaque agrégat, la sommer telle quelle la multiplierait par cinq.
    """
    montants: dict[tuple, float] = {}
    populations: dict[tuple, dict[str, int]] = {}
    for ligne in lignes:
        if int(ligne["period"]) < depuis:
            continue
        cle = (ligne["geo_level"], ligne["geo_code"], ligne["period"])
        montant_cle = (ligne["indicator_id"], *cle)
        montants[montant_cle] = montants.get(montant_cle, 0.0) + ligne["value"]
        if ligne["population"] is not None:
            populations.setdefault(cle, {})[ligne["budget"]] = ligne["population"]
    return (
        [(*cle, valeur) for cle, valeur in montants.items()],
        [(POPULATION, *cle, sum(budgets.values())) for cle, budgets in populations.items()],
    )


def enregistrer_criteres(conn, lignes: list[dict]) -> int:
    """Range les critères de comparaison de l'OFGL dans le référentiel.

    Ils décrivent le territoire, pas une mesure : leur place est dans
    `geography_reference.flags`, d'où le comparateur les lira pour constituer
    un groupe de communes semblables (docs/01 §3).
    """
    derniers: dict[str, dict] = {}
    for ligne in lignes:
        if ligne["criteres"]:
            # On garde l'exercice le plus récent : les critères évoluent.
            precedent = derniers.get(ligne["geo_code"])
            if precedent is None or ligne["period"] >= precedent["periode"]:
                derniers[ligne["geo_code"]] = {
                    "periode": ligne["period"],
                    "criteres": ligne["criteres"],
                }
    if not derniers:
        return 0
    # Une seule instruction plutôt que 34 875 : autant d'allers-retours
    # dépassaient le délai maximum d'une requête.
    with conn.cursor() as curseur:
        curseur.execute("create temp table _criteres (code text primary key, flags json)")
        entrepot.copier(
            curseur,
            "_criteres",
            ["code", "flags"],
            (
                (code, json.dumps({**valeur["criteres"], "criteres_source": "OFGL"}))
                for code, valeur in derniers.items()
            ),
        )
        curseur.execute(
            # `||` fusionne deux objets JSON sous PostgreSQL ; sous DuckDB il
            # concatène deux chaînes, et « {} » suivi de « {"rural":…} » ne se
            # relit pas. `json_merge_patch` fait la fusion, et garde ce que les
            # drapeaux portaient déjà — le rattachement d'une intercommunalité,
            # par exemple, ne doit pas disparaître sous les critères de l'OFGL.
            """
            update geo.geography_reference g
               set flags = json_merge_patch(g.flags, c.flags)
            from _criteres c
            where g.geo_level = 'commune' and g.geo_code = c.code and g.vintage = ?
            """,
            (MILLESIME,),
        )
        curseur.execute("drop table _criteres")
    conn.commit()
    return len(derniers)


def filtrer_territoires_connus(conn, lignes: list[tuple]) -> tuple[list[tuple], set[str]]:
    """Écarte les territoires absents du référentiel plutôt que de faire échouer le
    run entier. Les codes écartés sont renvoyés : une couverture incomplète est une
    information à publier, pas à taire (docs/03 §6)."""
    niveaux = sorted({ligne[1] for ligne in lignes})
    connus = {
        (niveau, code)
        for niveau, code in conn.execute(
            "select geo_level, geo_code from geo.geography_reference"
            " where geo_level = any(?) and vintage = ?",
            (niveaux, MILLESIME),
        ).fetchall()
    }
    gardees = [ligne for ligne in lignes if (ligne[1], ligne[2]) in connus]
    ecartes = {f"{ligne[1]}:{ligne[2]}" for ligne in lignes if (ligne[1], ligne[2]) not in connus}
    return gardees, ecartes


def ecrire(conn, run_id: str, lignes: list[tuple]) -> int:
    """Remplace les observations des indicateurs et territoires concernés."""
    with conn.cursor() as cur:
        indicateurs = sorted({ligne[0] for ligne in lignes})
        niveaux = sorted({ligne[1] for ligne in lignes})
        cur.execute(
            "delete from core.observations where indicator_id = any(?) and geo_level = any(?)",
            (indicateurs, niveaux),
        ).fetchall()
        # Écriture par lots : une seule instruction pour 420 000 lignes dépasse
        # le délai maximum, chaque vérification de clé étrangère prenant un verrou.
        LOT = 100_000
        for debut in range(0, len(lignes), LOT):
            entrepot.copier(
                conn,
                "core.observations",
                ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value", "run_id"],
                (
                    (indicateur, niveau, code, MILLESIME, periode, valeur, run_id)
                    for indicateur, niveau, code, periode, valeur in lignes[debut : debut + LOT]
                ),
            )
    conn.commit()
    return len(lignes)


def controler_coherence(conn, run_id: str, niveau: str) -> bool:
    """Épargne brute = recettes − dépenses de fonctionnement, par construction.

    Contrôle déterministe : si l'identité comptable ne tient pas, le chargement
    est faux et ne doit pas être publié (docs/03 §2). Tolérance à l'euro pour
    les arrondis de la source.
    """
    ecarts = conn.execute(
        """
        select count(*) from (
            select o.geo_code, o.period,
                   sum(o.value) filter (where indicator_id = 'ofgl_recettes_fonctionnement')
                 - sum(o.value) filter (where indicator_id = 'ofgl_depenses_fonctionnement')
                 - sum(o.value) filter (where indicator_id = 'ofgl_epargne_brute') as ecart
            from core.observations o
            where o.geo_level = ? and o.indicator_id in
                ('ofgl_recettes_fonctionnement','ofgl_depenses_fonctionnement','ofgl_epargne_brute')
            group by 1, 2
        ) t where abs(ecart) > 1
        """,
        (niveau,),
    ).fetchone()[0]
    conn.execute(
        """
        insert into meta.data_quality_checks
            (run_id, dataset_id, check_name, severity, passed, observed)
        values (?, ?, 'epargne_brute_egale_recettes_moins_depenses', 'blocker', ?,
                json_object('territoires_en_ecart', ?))
        """,
        (run_id, JEUX[niveau], ecarts == 0, ecarts),
    )
    conn.commit()
    return ecarts == 0


# Nombre d'agrégats traités en un passage. L'OFGL en publie 72 : demander les 72
# d'un coup pour les communes rendrait un CSV de 1,5 Go, que le connecteur
# transforme ligne à ligne en dictionnaires — vingt millions d'objets Python, soit
# plusieurs gigaoctets, sur un runner qui en a sept. Le découpage borne la mémoire
# sans rien changer au résultat : chaque lot est téléchargé, écrit, puis oublié.
LOT_AGREGATS = 8


def run(niveaux: list[str], depuis: int, store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer_indicateurs(conn, niveaux)
    total = 0
    for niveau in niveaux:
        # Mesuré à chaque niveau : le précédent vient d'écrire, et c'est ce
        # connecteur qui porte l'essentiel du volume de l'entrepôt.
        garde_fou_volume(conn)
        dataset_id = JEUX[niveau]
        run_id = entrepot.start_run(conn, dataset_id, "manual")
        try:
            # Chaque maille ne connaît pas les mêmes agrégats : les allocations
            # RSA, APA et les DMTO n'existent qu'au département et à la région.
            agregats = list(ofgl.agregats_du_niveau(niveau))
            ecrites = 0
            for debut in range(0, len(agregats), LOT_AGREGATS):
                lot = agregats[debut : debut + LOT_AGREGATS]
                rang = debut // LOT_AGREGATS + 1
                url = ofgl.url_export(niveau, lot)
                contenu = fetch(url, timeout=600).content
                entrepot.record_asset(
                    conn, store, run_id, dataset_id, "ofgl",
                    f"{niveau}-{rang:02d}.csv", contenu, url, "text/csv",
                )
                brutes = ofgl.lire(contenu, niveau)
                del contenu
                # Les critères de comparaison sont les mêmes dans tous les lots :
                # une fois suffit, sur le premier.
                if niveau == "commune" and debut == 0:
                    print(f"critères de comparaison : {enregistrer_criteres(conn, brutes)} communes")
                montants, populations = observations(brutes, depuis)
                del brutes
                lignes, ecartes = filtrer_territoires_connus(conn, montants + populations)
                ecrites += ecrire(conn, run_id, lignes)
                alerte = f" — {len(ecartes)} hors référentiel" if ecartes else ""
                print(f"  {niveau} lot {rang} ({len(lot)} agrégats) : {len(lignes)} lignes{alerte}")
                del montants, populations, lignes
            # Le contrôle porte sur trois agrégats qui peuvent tomber dans des
            # lots différents : il attend donc que le niveau soit entier.
            if not controler_coherence(conn, run_id, niveau):
                raise ValueError(
                    f"{niveau} : l'épargne brute ne se déduit pas des recettes et dépenses"
                )
            entrepot.finish_run(conn, run_id, "success", rows_written=ecrites)
            print(f"{niveau} : {ecrites} observations")
            total += ecrites
        except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
            entrepot.finish_run(conn, run_id, "failed", error=str(error))
            raise
    conn.close()
    print(f"total : {total} observations")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--niveaux", default="commune,epci,departement,region")
    parser.add_argument("--depuis", type=int, default=2018)
    parser.add_argument("--store", default=".snapshots")
    args = parser.parse_args()
    return run(args.niveaux.split(","), args.depuis, args.store)


if __name__ == "__main__":
    raise SystemExit(main())
