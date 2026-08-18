"""Comparaisons européennes (Eurostat) vers core.observations, niveau pays.

Doctrine du produit (docs/00, §7) : pour comparer des pays, **Eurostat prime
sur les sources nationales**. Les définitions y sont harmonisées, ce qui est la
seule condition qui rende une comparaison honnête. Un chiffre national et un
chiffre Eurostat portant le même nom ne sont pas interchangeables : ils sont
publiés séparément, jamais mélangés dans une même série.

Les drapeaux d'Eurostat sont conservés : `b` signale une rupture de série,
`p` une valeur provisoire, `e` une estimation. Une courbe qui enjambe une
rupture doit le dire plutôt que de laisser croire à une évolution réelle.

Usage : python -m plateforme.normalize.europe [--store r2:plateforme-raw]
"""

import argparse
import json

from plateforme import entrepot
from plateforme.connectors import eurostat
from plateforme.connectors.jsonstat import decoder
from plateforme.http import telecharger
from plateforme.normalize.geo import MILLESIME, make_store

DATASET_PAR_JEU = {
    "gov_10dd_edpt1": "eurostat-gov-10dd-edpt1",
    "nama_10_pc": "eurostat-nama-10-pc",
    "une_rt_a": "eurostat-une-rt-a",
    "spr_exp_pens": "eurostat-spr-exp-pens",
    "ilc_di12": "eurostat-ilc-di12",
    "ilc_di11": "eurostat-ilc-di11",
    "crim_off_cat": "eurostat-crim-off-cat",
    "gov_10a_main": "eurostat-gov-10a-main",
    "gov_10a_exp": "eurostat-gov-10a-exp",
    # Le tableau de bord d'un bilan : ce qui manquait pour que chaque chapitre
    # ait son axe du temps, et non un seul millésime.
    "nama_10_gdp": "eurostat-nama-10-gdp",
    "demo_gind": "eurostat-demo-gind",
    "irt_lt_mcby_a": "eurostat-irt-lt-mcby-a",
    "sts_rb_q": "eurostat-sts-rb-q",
    "lfsi_emp_a": "eurostat-lfsi-emp-a",
    "nasa_10_ki": "eurostat-nasa-10-ki",
    "sts_inpr_a": "eurostat-sts-inpr-a",
    "prc_hicp_aind": "eurostat-prc-hicp-aind",
}

# Les comptes des administrations publiques sont publiés en **millions**
# d'euros ; le site publie en euros, comme la dette et le budget de l'État.
MILLION = 1_000_000

# Agrégats retenus, avec les filtres qui les rendent comparables entre pays.
INDICATEURS = {
    "eurostat_dette_pib": {
        "jeu": "gov_10dd_edpt1",
        "params": {"na_item": "GD", "sector": "S13", "unit": "PC_GDP", "freq": "A"},
        "libelle": "Dette publique en % du PIB (définition européenne)",
        "public": "La dette de toutes les administrations publiques rapportée à la"
        " richesse produite en un an, calculée de la même façon dans chaque pays"
        " de l'Union.",
        "technique": "Dette brute consolidée au sens du protocole sur la procédure"
        " concernant les déficits excessifs, secteur S13, en % du PIB.",
        "unite": "percent",
    },
    "eurostat_deficit_pib": {
        "jeu": "gov_10dd_edpt1",
        "params": {"na_item": "B9", "sector": "S13", "unit": "PC_GDP", "freq": "A"},
        "libelle": "Déficit ou excédent public en % du PIB",
        "public": "L'écart d'une année entre ce que les administrations publiques"
        " encaissent et ce qu'elles dépensent. Un chiffre négatif est un déficit,"
        " qui se finance par l'emprunt.",
        "technique": "Capacité (+) ou besoin (−) de financement des administrations"
        " publiques, secteur S13, en % du PIB, au sens de Maastricht.",
        "unite": "percent",
    },
    "eurostat_pib_habitant_spa": {
        "jeu": "nama_10_pc",
        "params": {"na_item": "B1GQ", "unit": "CP_PPS_EU27_2020_HAB", "freq": "A"},
        "libelle": "PIB par habitant en standards de pouvoir d'achat",
        "public": "La richesse produite par habitant, corrigée des écarts de prix"
        " entre pays. C'est ce qui permet de comparer des niveaux de vie sans être"
        " trompé par le coût de la vie.",
        "technique": "Produit intérieur brut par habitant en standards de pouvoir"
        " d'achat, base UE27 2020.",
        "unite": "count",
    },
    "eurostat_chomage": {
        "jeu": "une_rt_a",
        # Le jeu mensuel (une_rt_m) n'a pas de fréquence annuelle, et la classe
        # d'âge s'y nomme Y15-74 : « TOTAL » n'existe pas et renvoie du vide.
        "params": {"age": "Y15-74", "sex": "T", "unit": "PC_ACT", "freq": "A"},
        "libelle": "Taux de chômage harmonisé",
        "public": "La part des personnes sans emploi qui en cherchent un activement,"
        " mesurée selon la définition du Bureau international du travail, identique"
        " dans tous les pays.",
        "technique": "Taux de chômage au sens du BIT, 15-74 ans, tous sexes,"
        " en % de la population active.",
        "unite": "percent",
    },
    # ── Les retraites, comparées ─────────────────────────────────────────────
    #
    # La France dépense pour ses retraites une part de sa richesse que le débat
    # public cite constamment sans jamais la poser à côté de celle des voisins.
    # ESSPROS est le seul cadre qui rende la comparaison honnête : il compte les
    # mêmes prestations partout, quels que soient les régimes qui les servent —
    # ce qui est exactement le piège d'une comparaison faite sur des chiffres
    # nationaux, où « retraites » désigne quarante-deux régimes ici et un fonds
    # de pension ailleurs.
    #
    # Deux séries et pas une : le total des pensions comprend la réversion,
    # l'invalidité et les préretraites, quand « vieillesse » ne compte que la
    # pension de droit direct. Les confondre déplace le chiffre français de
    # plusieurs points de PIB.
    "eurostat_retraites_pib": {
        "jeu": "spr_exp_pens",
        "params": {"spdepb": "TOTAL", "spdepm": "TOTAL", "unit": "PC_GDP", "freq": "A"},
        "libelle": "Dépenses de pensions en % du PIB",
        "public": "Tout ce qu'un pays verse en pensions (retraite de droit direct,"
        " réversion, invalidité, préretraite), rapporté à la richesse qu'il produit"
        " en un an. Les prestations sont comptées de la même façon dans chaque pays,"
        " quels que soient les régimes qui les servent.",
        "technique": "Dépenses de pensions au sens du SESPROS, toutes catégories et"
        " sous condition de ressources comprises, en % du PIB.",
        "unite": "percent",
    },
    "eurostat_retraites_vieillesse_pib": {
        "jeu": "spr_exp_pens",
        "params": {"spdepb": "OLD", "spdepm": "TOTAL", "unit": "PC_GDP", "freq": "A"},
        "libelle": "Pensions de vieillesse en % du PIB",
        "public": "La seule retraite de droit direct, sans la réversion ni"
        " l'invalidité ni les préretraites, rapportée à la richesse produite en un an.",
        "technique": "Dépenses de pensions de vieillesse (catégorie OLD) au sens du"
        " SESPROS, en % du PIB.",
        "unite": "percent",
    },
    # ── Les inégalités, comparées ────────────────────────────────────────────
    #
    # Deux mesures, parce qu'aucune ne suffit : l'indice de Gini résume toute la
    # distribution en un nombre, le rapport interquintile dit combien les 20 %
    # les plus aisés touchent de plus que les 20 % les plus modestes. Le premier
    # bouge peu et se lit mal, le second se lit sans mode d'emploi.
    "eurostat_gini": {
        "jeu": "ilc_di12",
        "params": {"age": "TOTAL", "statinfo": "GINI_HND", "freq": "A"},
        "libelle": "Indice de Gini du niveau de vie",
        "public": "Zéro si tout le monde touchait le même revenu, cent si une seule"
        " personne touchait tout. Il porte sur le niveau de vie après impôts et"
        " prestations, sur une échelle de 0 à 100.",
        "technique": "Coefficient de Gini du revenu disponible équivalisé, tous âges,"
        " enquête EU-SILC, échelle 0-100.",
        # Ni un effectif ni un pourcentage : un indice sur 0-100, qui bouge de
        # quelques dixièmes d'une année à l'autre. Publié en `count`, il
        # s'afficherait « 30 » là où la source écrit 30,4 — et une colonne lue
        # d'un pays à l'autre cesserait de s'aligner.
        "unite": "indice",
    },
    "eurostat_rapport_interquintile": {
        "jeu": "ilc_di11",
        "params": {"age": "TOTAL", "sex": "T", "unit": "RAT", "freq": "A"},
        "libelle": "Rapport interquintile S80/S20 du niveau de vie",
        "public": "Combien de fois les 20 % de personnes les plus aisées touchent"
        " ce que touchent les 20 % les plus modestes, après impôts et prestations.",
        "technique": "Rapport S80/S20 du revenu disponible équivalisé, tous âges,"
        " tous sexes, enquête EU-SILC.",
        # Un rapport, pas un compte : 4,74 arrondi à 5 ferait disparaître
        # l'écart que la mesure existe pour dire.
        "unite": "ratio",
    },
    # ── La délinquance, comparée ─────────────────────────────────────────────
    #
    # Le site publie déjà, commune par commune, les faits que la police et la
    # gendarmerie **enregistrent** (SSMSI). Ces deux séries-ci les posent en
    # regard des autres pays, et pas dans la même unité : Eurostat compte pour
    # cent mille habitants quand le SSMSI compte pour mille. Les deux ne se
    # mélangent donc jamais dans une même colonne — et un taux enregistré reste
    # un taux enregistré : il dépend de ce qui est déclaré et de ce que chaque
    # police consigne, ce qui varie plus d'un pays à l'autre que d'une commune
    # à l'autre. L'homicide est la classe la moins exposée à cet écart, et c'est
    # pourquoi il ouvre la série.
    "eurostat_homicides_100k": {
        "jeu": "crim_off_cat",
        "params": {"iccs": "ICCS0101", "unit": "P_HTHAB", "freq": "A"},
        "libelle": "Homicides volontaires enregistrés pour 100 000 habitants",
        "public": "Les homicides volontaires que la police enregistre en un an,"
        " rapportés à cent mille habitants. C'est la classe la moins dépendante"
        " du dépôt de plainte, donc la plus comparable d'un pays à l'autre.",
        "technique": "Infractions enregistrées par la police, classification ICCS"
        " 0101 (intentional homicide), pour 100 000 habitants.",
        "unite": "pour_100000_habitants",
    },
    # ── Pour 100 € encaissés, ce qui ressort ─────────────────────────────────
    #
    # « Où va l'argent public » a deux réponses déjà publiées ici — les 100 € du
    # budget de l'État, les 100 € de prestations sociales — et il en manquait la
    # plus large : celle de **toutes** les administrations publiques, État,
    # collectivités et Sécurité sociale ensemble, en comptabilité nationale.
    #
    # **Pourquoi Eurostat et non le cube de l'INSEE**, alors que celui-ci
    # remonte à 1959 et qu'il est déjà chargé pour le solde : ses agrégats
    # totaux ne se referment pas. Mesuré à nouveau le 17 août 2026, son `OTR`
    # donne **2 034 Md€** de ressources en 2024 quand la statistique publique en
    # annonce 1 504 — l'écart vient d'un périmètre de consolidation que la
    # source ne documente pas, et `apu.py` refuse déjà ces totaux pour cette
    # raison. Sans total fiable, aucune part n'est calculable.
    #
    # Ici l'identité se referme à l'euro : TR − TE = B9, soit
    # 1 503 590,1 − 1 672 708,2 = −169 118,1, exactement le solde que le site
    # publie depuis l'INSEE. Les deux sources disent le même déficit ; c'est ce
    # qui autorise à composer les parts sur celle qui donne aussi les totaux.
    "eurostat_apu_recettes": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "TR", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Recettes des administrations publiques",
        "public": "Tout ce qu'encaissent en un an l'État, les collectivités, la"
        " Sécurité sociale et les organismes qu'ils financent : impôts, cotisations,"
        " ventes de services et transferts reçus.",
        "technique": "Total des recettes des administrations publiques (S13), TR au"
        " sens du SEC 2010, en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_depenses": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "TE", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Dépenses des administrations publiques",
        "public": "Tout ce que dépensent en un an les administrations publiques."
        " La différence avec leurs recettes est le déficit public.",
        "technique": "Total des dépenses des administrations publiques (S13), TE au"
        " sens du SEC 2010, en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_impots_production": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D2REC", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Impôts sur la production et les importations",
        "public": "La TVA, les taxes sur les carburants, les impôts fonciers des entreprises : ce qui est prélevé sur ce qui est produit ou vendu, pas sur les revenus.",
        "technique": "Impôts sur la production et les importations reçus par les administrations publiques (D.2), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_impots_revenu": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D5REC", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Impôts sur le revenu et le patrimoine",
        "public": "L'impôt sur le revenu, la CSG, l'impôt sur les sociétés, la taxe d'habitation et la taxe foncière des ménages.",
        "technique": "Impôts courants sur le revenu, le patrimoine, etc. reçus par les administrations publiques (D.5), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_cotisations": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D61REC", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Cotisations sociales",
        "public": "Ce que salariés et employeurs versent pour la retraite, la maladie, le chômage et la famille.",
        "technique": "Cotisations sociales nettes reçues par les administrations publiques (D.61), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_prestations": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D62PAY", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Prestations sociales en espèces",
        "public": "Les retraites, les allocations chômage et familiales, le RSA : ce qui est versé directement aux personnes.",
        "technique": "Prestations sociales autres que transferts sociaux en nature (D.62), en euros courants.",
        "unite": "EUR",
    },
    # ─────────────────────────────────────────────────────────────────────
    # CE QUE RECOUVRE « PRESTATIONS SOCIALES EN ESPÈCES »
    # ─────────────────────────────────────────────────────────────────────
    # Le poste le plus lourd de la dépense publique est aussi le plus muet :
    # « retraites, chômage, allocations » met dans un seul nombre trois choses
    # qui n'ont ni le même montant, ni le même public, ni le même débat. La
    # retraite y pèse **neuf fois** le chômage — 362,2 Md€ contre 40,7 en
    # 2024 — et l'ordre des mots du libellé ne le dit pas. Deux fonctions
    # manquaient d'ailleurs au trio, et chacune vaut plus que le chômage : les
    # pensions de réversion (40,3) et les arrêts maladie et l'invalidité (50,3).
    #
    # `gov_10a_main` ne le décompose pas : il ne porte que la transaction
    # entière (D62PAY). La ventilation vit dans `gov_10a_exp`, qui croise la
    # transaction avec la fonction (COFOG) — même producteur, même secteur
    # S13, même unité, et **la transaction s'y nomme `D62` et non `D62PAY`**.
    #
    # DEUX MESURES AVANT DE PUBLIER, les deux faites le 17 août 2026 :
    #
    # 1. La ventilation se referme. Sept fonctions de protection sociale plus
    #    trois postes hors protection sociale (bourses, culture, santé) font
    #    561 878,3 M€ en 2024 contre 561 878,4 déclarés au total : 0,1 M€
    #    d'arrondi. Le site n'a donc pas à inventer de reste — il le calcule.
    #
    # 2. Elle ne dit PAS la même année que le jeu principal, et l'écart n'est
    #    pas nul. `D62PAY` (jeu principal) contre `D62` total (jeu par
    #    fonction) : identiques à l'euro jusqu'en 2022, puis +1 248,8 M€ en
    #    2023 et +1 806,9 M€ en 2024, soit 0,24 % et 0,32 %. Deux millésimes
    #    d'un même compte, publiés à deux dates. La ventilation s'arrête à
    #    2024 quand le jeu principal donne 2025.
    #
    # D'où la règle que le site tient : le tableau de ventilation porte **son
    # propre exercice et son propre total**, jamais les parts du tableau
    # principal redistribuées à la main sur des clés d'une autre année.
    **{
        f"eurostat_apu_prestations_{cle}": {
            "jeu": "gov_10a_exp",
            "params": {
                "sector": "S13",
                "na_item": "D62",
                "cofog99": cofog,
                "unit": "MIO_EUR",
                "freq": "A",
            },
            "facteur": MILLION,
            "libelle": libelle,
            "public": public,
            "technique": "Prestations sociales en espèces (D.62) versées par les"
            f" administrations publiques au titre de la fonction {cofog} de la"
            " nomenclature COFOG, en euros courants.",
            "unite": "EUR",
        }
        for cle, cofog, libelle, public in (
            (
                "vieillesse",
                "GF1002",
                "Prestations en espèces : vieillesse",
                "Les pensions de retraite de droit direct, et les minima"
                " vieillesse. C'est le premier poste de la dépense publique"
                " française, très loin devant les autres prestations.",
            ),
            (
                "maladie_invalidite",
                "GF1001",
                "Prestations en espèces : maladie et invalidité",
                "Les indemnités journalières d'arrêt maladie, les pensions"
                " d'invalidité et les rentes d'accident du travail : de l'argent"
                " versé, distinct des soins remboursés.",
            ),
            (
                "chomage",
                "GF1005",
                "Prestations en espèces : chômage",
                "Les allocations versées aux demandeurs d'emploi.",
            ),
            (
                "survivants",
                "GF1003",
                "Prestations en espèces : survivants",
                "Les pensions de réversion, versées au conjoint survivant.",
            ),
            (
                "famille",
                "GF1004",
                "Prestations en espèces : famille et enfants",
                "Les allocations familiales, la prestation d'accueil du jeune"
                " enfant, le complément de libre choix de mode de garde.",
            ),
            (
                "exclusion",
                "GF1007",
                "Prestations en espèces : lutte contre l'exclusion",
                "Le RSA et les autres minima sociaux qui ne relèvent ni de la"
                " vieillesse, ni de l'invalidité, ni du chômage.",
            ),
            (
                "logement",
                "GF1006",
                "Prestations en espèces : logement",
                "La part des aides au logement versée en espèces. L'essentiel"
                " des aides au logement passe par d'autres canaux et n'est pas"
                " compté ici.",
            ),
        )
    },
    # Le total de la ventilation, qui n'est PAS le poste du tableau principal :
    # même transaction, autre millésime, et l'écart est mesuré ci-dessus. Il est
    # publié parce que sans lui le site ne peut pas nommer ce que les sept
    # fonctions laissent dehors — les prestations versées au titre de
    # l'éducation, de la culture et de la santé, qui ne sont pas de la
    # protection sociale et pèsent 6,2 Md€.
    "eurostat_apu_prestations_ventilees": {
        "jeu": "gov_10a_exp",
        "params": {
            "sector": "S13",
            "na_item": "D62",
            "cofog99": "TOTAL",
            "unit": "MIO_EUR",
            "freq": "A",
        },
        "facteur": MILLION,
        "libelle": "Prestations sociales en espèces, toutes fonctions",
        "public": "Le même total que « prestations sociales en espèces », mais"
        " lu dans le jeu qui le ventile par fonction : c'est lui qui sert de"
        " dénominateur à la ventilation.",
        "technique": "Prestations sociales en espèces (D.62), toutes fonctions"
        " COFOG confondues, en euros courants. Diffère de D62PAY du jeu"
        " gov_10a_main de 0,3 % sur les exercices récents : deux millésimes.",
        "unite": "EUR",
    },

    # ═════════════════════════════════════════════════════════════════════
    # LE TABLEAU DE BORD D'UN BILAN
    # ═════════════════════════════════════════════════════════════════════
    # Un bilan se lit sur une durée, pas sur un instantané. Les séries des
    # administrations publiques donnaient déjà trente ans de profondeur ; ce
    # qui manquait était le DÉNOMINATEUR — le PIB en euros et la population —
    # et les mesures qui disent si la trajectoire tient : ce que la dette
    # coûte, combien d'entreprises tombent, combien de gens travaillent.
    #
    # Deux d'entre elles ferment un trou mesuré : sans PIB en niveau, aucun
    # « % du PIB » ne peut être calculé par le site — il ne peut que reprendre
    # celui que la source publie déjà ; et sans population, les seize séries de
    # sécurité restent des nombres bruts sans dénominateur national.
    "eurostat_pib_montant": {
        "jeu": "nama_10_gdp",
        "params": {"na_item": "B1GQ", "unit": "CP_MEUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Produit intérieur brut",
        "public": "La valeur de tout ce qui est produit en un an dans le pays."
        " C'est la mesure à laquelle on rapporte la dette, le déficit et la"
        " dépense publique pour les comparer d'un pays à l'autre.",
        "technique": "PIB aux prix courants du marché (B1GQ), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_population": {
        "jeu": "demo_gind",
        "params": {"indic_de": "JAN", "freq": "A"},
        "libelle": "Population au 1er janvier",
        "public": "Le nombre d'habitants au premier jour de l'année. C'est le"
        " dénominateur de tout ce qui se lit « par habitant ».",
        "technique": "Population totale au 1er janvier, estimation Eurostat.",
        "unite": "count",
    },
    # ─────────────────────────────────────────────────────────────────────
    # CE QUE LA DETTE COÛTE, ET CE QU'ELLE COÛTERA
    # ─────────────────────────────────────────────────────────────────────
    # Le taux à l'émission n'est pas le taux payé : la charge d'intérêt porte
    # un stock d'ancienne dette contractée moins cher. L'écart entre les deux
    # est donc la charge à venir, mécaniquement, même à taux stables — et il ne
    # se voit qu'en publiant les deux.
    "eurostat_taux_10_ans": {
        "jeu": "irt_lt_mcby_a",
        "params": {"int_rt": "MCBY", "freq": "A"},
        "libelle": "Taux d'intérêt à 10 ans",
        "public": "Le taux auquel l'État emprunte sur dix ans. Il monte quand"
        " les prêteurs jugent le pays plus risqué, et chaque nouvelle dette est"
        " contractée à ce prix-là.",
        "technique": "Taux d'intérêt à long terme des obligations d'État, critère"
        " de convergence de Maastricht, moyenne annuelle.",
        "unite": "percent",
    },
    # ─────────────────────────────────────────────────────────────────────
    # LE TISSU PRODUCTIF
    # ─────────────────────────────────────────────────────────────────────
    # Eurostat ne publie qu'un INDICE, toutes entreprises confondues. C'est la
    # limite de cette source, et elle compte : l'essentiel des créations sont
    # des micro-entreprises, si bien qu'un indice global mélange des ouvertures
    # sans salarié et des fermetures d'entreprises qui en employaient. Le
    # nombre par taille et par secteur vient de la Banque de France
    # (`normalize/defaillances.py`), et c'est lui qu'il faut lire pour juger.
    "eurostat_defaillances": {
        "jeu": "sts_rb_q",
        "params": {"indic_bt": "BKRT", "s_adj": "SCA", "unit": "I21",
                   "nace_r2": "B-S_X_O_S94", "freq": "Q"},
        "libelle": "Défaillances d'entreprises",
        "public": "Le nombre d'entreprises qui déposent le bilan, rapporté à"
        " l'année 2021. Toutes tailles confondues, micro-entreprises comprises.",
        "technique": "Déclarations de faillite, indice base 2021 = 100,"
        " corrigé des variations saisonnières et des jours ouvrables,"
        " sections B à S de la NACE hors administration publique.",
        "unite": "indice",
    },
    "eurostat_creations_entreprises_indice": {
        "jeu": "sts_rb_q",
        "params": {"indic_bt": "REG", "s_adj": "SCA", "unit": "I21",
                   "nace_r2": "B-S_X_O_S94", "freq": "Q"},
        "libelle": "Créations d'entreprises",
        "public": "Le nombre d'entreprises immatriculées, rapporté à 2021."
        " À lire avec les défaillances : les deux courbes ensemble disent si le"
        " tissu se renouvelle ou se vide.",
        "technique": "Immatriculations d'entreprises, indice base 2021 = 100,"
        " corrigé des variations saisonnières et des jours ouvrables.",
        "unite": "indice",
    },
    "eurostat_production_industrielle": {
        "jeu": "sts_inpr_a",
        "params": {"nace_r2": "B-D", "s_adj": "CA", "unit": "I21", "freq": "A"},
        "libelle": "Production industrielle",
        "public": "Ce que l'industrie produit, rapporté à l'année 2021.",
        "technique": "Indice de production industrielle, base 2021 = 100,"
        " sections B à D de la NACE, corrigé des jours ouvrables.",
        "unite": "indice",
    },
    # ─────────────────────────────────────────────────────────────────────
    # L'EMPLOI, DES DEUX CÔTÉS
    # ─────────────────────────────────────────────────────────────────────
    # Le chômage seul ne dit pas l'emploi : les deux peuvent monter ensemble,
    # quand la population active grossit plus vite que les emplois créés. Le
    # taux d'emploi est donc publié à côté, et le chômage des jeunes à part —
    # il est du double de celui de l'ensemble, et l'écart avec les voisins y est
    # bien plus large que sur le taux général.
    "eurostat_taux_emploi": {
        "jeu": "lfsi_emp_a",
        "params": {"indic_em": "EMP_LFS", "sex": "T", "age": "Y20-64",
                   "unit": "PC_POP", "freq": "A"},
        "libelle": "Taux d'emploi des 20-64 ans",
        "public": "La part des 20-64 ans qui ont un emploi. C'est le pendant du"
        " taux de chômage, et les deux ne bougent pas toujours dans le même sens.",
        "technique": "Taux d'emploi, 20-64 ans, tous sexes, enquête sur les forces"
        " de travail, en % de la population du même âge.",
        "unite": "percent",
    },
    "eurostat_chomage_jeunes": {
        "jeu": "une_rt_a",
        # La classe d'âge se nomme Y15-24 ici. `Y_LT25` n'existe pas dans ce jeu
        # et rend une série vide sans lever — même piège que « TOTAL ».
        "params": {"age": "Y15-24", "sex": "T", "unit": "PC_ACT", "freq": "A"},
        "libelle": "Taux de chômage des 15-24 ans",
        "public": "La part des jeunes actifs sans emploi qui en cherchent un."
        " Elle vaut environ le double du taux de chômage de l'ensemble.",
        "technique": "Taux de chômage au sens du BIT, 15-24 ans, tous sexes,"
        " en % de la population active du même âge.",
        "unite": "percent",
    },
    # ─────────────────────────────────────────────────────────────────────
    # LES MÉNAGES ET LES ENTREPRISES
    # ─────────────────────────────────────────────────────────────────────
    # Ces quatre séries remontent à 1949 pour trois d'entre elles. Elles disent
    # ce que les comptes publics ne disent pas : ce que les gens font de leur
    # revenu, et ce que les entreprises font de leur marge.
    "eurostat_taux_epargne_menages": {
        "jeu": "nasa_10_ki",
        "params": {"na_item": "SRG_S14", "unit": "PC", "freq": "A"},
        "libelle": "Taux d'épargne des ménages",
        "public": "La part du revenu que les ménages n'ont pas dépensée. Elle monte"
        " quand ils sont inquiets, et ce qui est épargné n'est pas consommé.",
        "technique": "Taux d'épargne brut des ménages (B8G rapporté au revenu"
        " disponible brut ajusté), en %.",
        "unite": "percent",
    },
    "eurostat_dette_menages_revenu": {
        "jeu": "nasa_10_ki",
        "params": {"na_item": "DIR_S14", "unit": "PC", "freq": "A"},
        "libelle": "Dette des ménages rapportée à leur revenu",
        "public": "Ce que les ménages doivent, rapporté à ce qu'ils gagnent en un an."
        " À ne pas confondre avec la dette publique : celle-ci est privée.",
        "technique": "Ratio d'endettement brut des ménages (passifs AF4 rapportés"
        " au revenu disponible brut ajusté), en %.",
        "unite": "percent",
    },
    "eurostat_marge_entreprises": {
        "jeu": "nasa_10_ki",
        "params": {"na_item": "B2G_B3G_RAT_S11", "unit": "PC", "freq": "A"},
        "libelle": "Taux de marge des entreprises",
        "public": "Ce qui reste aux entreprises non financières une fois payés les"
        " salaires et les impôts sur la production, rapporté à ce qu'elles produisent.",
        "technique": "Excédent brut d'exploitation et revenu mixte des sociétés non"
        " financières rapportés à leur valeur ajoutée brute, en %.",
        "unite": "percent",
    },
    "eurostat_investissement_entreprises_pib": {
        "jeu": "nasa_10_ki",
        "params": {"na_item": "P51G_RAT_GDP_BUS", "unit": "PC", "freq": "A"},
        "libelle": "Investissement des entreprises en % du PIB",
        "public": "Ce que les entreprises consacrent chaque année à leurs machines,"
        " leurs bâtiments et leurs logiciels. C'est ce qui prépare la production"
        " de demain.",
        "technique": "Formation brute de capital fixe des sociétés (S11 et S12)"
        " rapportée au PIB, en %.",
        "unite": "percent",
    },
    # ─────────────────────────────────────────────────────────────────────
    # L'INFLATION, PAR CE QUE LES GENS ACHÈTENT
    # ─────────────────────────────────────────────────────────────────────
    # « 2,4 % » est une moyenne qui ne ressemble à personne : sur la même
    # période l'énergie et l'alimentation ont fait bien davantage. Les trois
    # séries sont des INDICES et non des taux, ce qui est délibéré — un indice
    # se cumule (« +54 % depuis 2021 »), un taux annuel ne se cumule pas sans
    # se tromper.
    **{
        f"eurostat_prix_{cle}": {
            "jeu": "prc_hicp_aind",
            "params": {"coicop": coicop, "unit": "INX_A_AVG", "freq": "A"},
            "libelle": libelle,
            "public": public,
            "technique": "Indice des prix à la consommation harmonisé (IPCH),"
            f" poste {coicop}, moyenne annuelle, base 2015 = 100.",
            "unite": "indice",
        }
        for cle, coicop, libelle, public in (
            ("ensemble", "CP00", "Prix à la consommation, ensemble",
             "Le niveau général des prix. C'est la moyenne dont on tire le taux"
             " d'inflation, et elle recouvre des postes très différents."),
            ("energie", "NRG", "Prix de l'énergie",
             "Carburants, gaz, électricité, fioul. C'est le poste qui a le plus"
             " bougé, et celui qui entraîne les autres."),
            ("alimentation", "FOOD", "Prix de l'alimentation",
             "Ce qu'on achète pour manger. Le poste que les ménages voient"
             " le plus souvent, et celui qui pèse le plus sur les revenus modestes."),
            ("sous_jacente", "TOT_X_NRG_FOOD", "Prix hors énergie et alimentation",
             "Tout le reste. On le regarde à part parce que l'énergie et"
             " l'alimentation dépendent de prix mondiaux que le pays ne fixe pas."),
        )
    },
    "eurostat_apu_transferts_nature": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D632PAY", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Soins et services remboursés",
        "public": "Ce que les administrations achètent pour les ménages et leur fournissent : remboursements de soins, médicaments, transports sanitaires.",
        "technique": "Transferts sociaux en nature de production marchande acquise (D.632), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_remunerations": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D1PAY", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Rémunération des agents publics",
        "public": "Les salaires et cotisations employeur de tous les agents publics : enseignants, soignants, policiers, agents des collectivités.",
        "technique": "Rémunération des salariés versée par les administrations publiques (D.1), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_consommations": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "P2", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Achats de biens et de services",
        "public": "Ce que les administrations achètent pour fonctionner : fournitures, énergie, entretien, prestations extérieures.",
        "technique": "Consommation intermédiaire des administrations publiques (P.2), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_interets": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D41PAY", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Intérêts de la dette",
        "public": "Ce que coûte chaque année la dette publique, hors remboursement du capital.",
        "technique": "Intérêts versés par les administrations publiques (D.41), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_investissement": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "P51G", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Investissement",
        "public": "Les routes, les écoles, les hôpitaux, les équipements : ce qui est construit ou acheté pour durer.",
        "technique": "Formation brute de capital fixe des administrations publiques (P.51g), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_subventions": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D3PAY", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Subventions",
        "public": "Ce qui est versé aux entreprises pour abaisser leurs coûts de production ou leurs prix de vente.",
        "technique": "Subventions versées par les administrations publiques (D.3), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_transferts_courants": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D7PAY", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Transferts courants versés",
        "public": "Les versements à d'autres administrations, à l'Union européenne, aux associations et à la coopération internationale.",
        "technique": "Autres transferts courants versés par les administrations publiques (D.7), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_apu_transferts_capital": {
        "jeu": "gov_10a_main",
        "params": {"sector": "S13", "na_item": "D9PAY", "unit": "MIO_EUR", "freq": "A"},
        "facteur": MILLION,
        "libelle": "Transferts en capital",
        "public": "Les aides à l'investissement versées aux entreprises, aux ménages et aux autres administrations.",
        "technique": "Transferts en capital à payer par les administrations publiques (D.9), en euros courants.",
        "unite": "EUR",
    },
    "eurostat_cambriolages_100k": {
        "jeu": "crim_off_cat",
        "params": {"iccs": "ICCS05012", "unit": "P_HTHAB", "freq": "A"},
        "libelle": "Cambriolages de logement enregistrés pour 100 000 habitants",
        "public": "Les cambriolages de résidence que la police enregistre en un an,"
        " rapportés à cent mille habitants. Un fait non déclaré n'y figure pas.",
        "technique": "Infractions enregistrées par la police, classification ICCS"
        " 05012 (burglary of private residential premises), pour 100 000 habitants.",
        "unite": "pour_100000_habitants",
    },
}

# Drapeaux Eurostat -> signalements du modèle (docs/06).
DRAPEAUX = {"b": "break_in_series", "p": "provisional", "e": "estimated", "d": "definition_differs"}


def declarer(conn) -> None:
    with conn.cursor() as curseur:
        for indicateur, fiche in INDICATEURS.items():
            definition = curseur.execute(
                """
                insert into core.indicator_definitions
                    (public_definition, technical_definition, formula, confidence_level, badges)
                values (?, ?, ?, 'observed',
                        array['Officiel','Comparaison harmonisée UE'])
                returning definition_id
                """,
                (fiche["public"], fiche["technique"], f"Eurostat, jeu {fiche['jeu']}"),
            ).fetchone()[0]
            curseur.execute(
                """
                insert into core.indicators
                    (indicator_id, dataset_id, definition_id, theme, label_fr, unit,
                     additive, accounting_frame, geo_levels, time_granularity, published)
                values (?, ?, ?, 'europe', ?, ?, false, 'nationale',
                        array['pays'], 'annuelle', true)
                on conflict (indicator_id) do update set unit = excluded.unit,
                    definition_id = excluded.definition_id, label_fr = excluded.label_fr,
                    published = true
                """,
                (indicateur, DATASET_PAR_JEU[fiche["jeu"]], definition, fiche["libelle"],
                 fiche["unite"]),
            )
        curseur.execute(
            "delete from core.indicator_definitions d where not exists"
            " (select 1 from core.indicators i where i.definition_id = d.definition_id)"
        )
    conn.commit()


def enregistrer_pays(conn, codes: set[str]) -> set[str]:
    """Les pays deviennent des territoires du référentiel. Les agrégats
    (zone euro, UE27) en font partie : ce sont des repères légitimes, mais ils
    ne s'additionnent pas aux pays qui les composent."""
    with conn.cursor() as curseur:
        curseur.executemany(
            """
            insert into geo.geography_reference (geo_level, geo_code, vintage, name, flags)
            values ('pays', ?, ?, ?, ?)
            on conflict (geo_level, geo_code, vintage) do nothing
            """,
            [
                (code, MILLESIME, code, json.dumps({"agregat": True} if len(code) > 2 else {}))
                for code in sorted(codes)
            ],
        )
    conn.commit()
    return {
        code
        for (code,) in conn.execute(
            "select geo_code from geo.geography_reference where geo_level = 'pays'"
            " and vintage = ?",
            (MILLESIME,),
        ).fetchall()
    }


def run(store_spec: str) -> int:
    conn = entrepot.connect()
    store = make_store(store_spec)
    declarer(conn)
    total = 0
    for indicateur, fiche in INDICATEURS.items():
        dataset_id = DATASET_PAR_JEU[fiche["jeu"]]
        run_id = entrepot.start_run(conn, dataset_id, "manual")
        try:
            url = eurostat.data_url(fiche["jeu"], fiche["params"])
            contenu = telecharger(url, timeout=300)
            entrepot.record_asset(
                conn, store, run_id, dataset_id, "eurostat", f"{indicateur}.json",
                contenu, url, "application/json",
            )
            points = decoder(json.loads(contenu))
            pays = enregistrer_pays(conn, {p["geo"] for p in points})
            facteur = fiche.get("facteur", 1)
            lignes = [
                (indicateur, "pays", p["geo"], MILLESIME, p["time"], p["valeur"] * facteur,
                 [DRAPEAUX[p["statut"]]] if p.get("statut") in DRAPEAUX else [], run_id)
                for p in points
                if p["geo"] in pays
            ]
            with conn.cursor() as curseur:
                curseur.execute(
                    "delete from core.observations where indicator_id = ?", (indicateur,)
                )
                entrepot.copier(
                    conn,
                    "core.observations",
                    ["indicator_id", "geo_level", "geo_code", "geo_vintage", "period", "value", "quality_flags", "run_id"],
                    (ligne for ligne in lignes),
                )
            conn.commit()
            entrepot.finish_run(conn, run_id, "success", rows_written=len(lignes))
            total += len(lignes)
            print(f"{indicateur} : {len(lignes)} observations, {len({ligne[2] for ligne in lignes})} pays")
        except Exception as error:  # noqa: BLE001 — tout échec finit tracé dans le lineage
            entrepot.finish_run(conn, run_id, "failed", error=str(error))
            raise
    conn.close()
    print(f"Europe : {total} observations")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", default=".snapshots")
    return run(parser.parse_args().store)


if __name__ == "__main__":
    raise SystemExit(main())
