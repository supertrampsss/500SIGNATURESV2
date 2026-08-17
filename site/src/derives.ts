/**
 * Indicateurs calculés à partir de ceux qui sont publiés.
 *
 * Un chiffre brut répond rarement à la question qu'on se pose. « 4,2 M€
 * d'encours de dette » ne dit pas si la commune peut la rembourser ; « huit
 * années d'épargne » le dit. Ce module ne charge aucune donnée nouvelle : il
 * combine des séries déjà publiées, avec les mêmes garanties que les autres
 * mesures — une définition grand public, une définition technique, une formule
 * écrite, et le refus de produire un nombre quand il n'aurait pas de sens.
 *
 * Trois règles tiennent tout le module :
 *
 * 1. **Toutes les entrées, ou rien.** Un exercice où l'une des séries manque ne
 *    produit pas de valeur. Sommer ce qui est là et présenter le résultat comme
 *    un total serait un sous-comptage déguisé en mesure.
 * 2. **Même composition partout.** Les agrégats de délinquance ne retiennent que
 *    les phénomènes publiés à *toutes* les mailles. Un agrégat communal à trois
 *    phénomènes et un agrégat départemental à seize porteraient le même nom sans
 *    mesurer la même chose, et se compareraient pourtant sur la fiche.
 * 3. **Une seule unité de compte par somme.** Le SSMSI ne compte pas ses classes
 *    de la même façon : un cambriolage est une infraction, une violence est une
 *    victime, un fait de stupéfiants est une personne mise en cause. Les
 *    additionner produirait un nombre de logements, de personnes et d'auteurs
 *    dans une seule case. Chaque agrégat ci-dessous ne réunit que des classes
 *    comptées à l'identique, et le dit.
 * 4. **Un dénominateur nul arrête le calcul.** Aucune division n'est tentée sur
 *    une valeur nulle ou négative quand le rapport perdrait son sens.
 */

import type { Indicateur } from "./donnees.ts";

export type Derive = {
  id: string;
  libelle: string;
  theme: string;
  unite: string;
  niveaux: string[];
  definition: string;
  definition_technique: string;
  formule: string;
  /** Séries nécessaires. Toutes obligatoires : voir règle 1. */
  entrees: string[];
  /**
   * Les séries qui sont **additionnées** entre elles, quand il y en a. Le
   * catalogue porte l'unité de compte de chacune, telle que son producteur la
   * publie ; si deux d'entre elles ne comptent pas la même chose, l'agrégat
   * n'est pas produit. La règle 3 cesse ainsi d'être une phrase dans un
   * commentaire : c'est le code qui la tient, et un changement chez le
   * producteur la déclenche sans que personne ait à y penser.
   */
  sommees?: string[];
  calcul: (v: Record<string, number>) => number | null;
};

/** Vrai si les séries additionnées comptent toutes la même chose. */
export function sommeHomogene(derive: Derive, connus: Map<string, Indicateur>): boolean {
  if (!derive.sommees) return true;
  const unites = new Set(
    derive.sommees.map((id) => connus.get(id)?.unite_de_compte ?? null),
  );
  // Une unité inconnue ne vaut pas accord : le producteur qui ne dit pas ce
  // qu'il compte ne permet pas d'affirmer que deux séries sont additionnables.
  return unites.size === 1 && !unites.has(null);
}

/** Population du millésime, dénominateur des agrégats de délinquance. */
const POPULATION = "ofgl_population_reference";

/**
 * Le socle commun de la délinquance : les phénomènes que le SSMSI publie à la
 * commune **comme** au département et à la région, et qu'il compte de la même
 * façon.
 *
 * Deux filtres, l'un après l'autre. Le service publie seize classes, mais dix
 * seulement à partir du département — le secret statistique protège les communes
 * où quelques faits suffiraient à identifier des personnes. Bâtir l'agrégat sur
 * ce qui est disponible à chaque maille donnerait à Lyon un « atteintes aux
 * biens » de trois phénomènes et au Rhône un de six, sous le même nom, comparés
 * l'un à l'autre dans la même phrase.
 *
 * Restent six classes communes. Mais elles ne se comptent pas pareil, et ce
 * n'est plus une lecture de nos définitions : le SSMSI publie l'unité de compte
 * **en colonne de ses bases**, et le chargement la reprend telle quelle. Des six
 * classes communales, une seule est comptée en infractions (les cambriolages) ;
 * les vols de véhicules sont comptés en véhicules — un vol peut en emporter
 * plusieurs —, les vols sans violence en victimes entendues, les trois violences
 * en victimes.
 *
 * Il n'existe donc **pas** d'agrégat « atteintes aux biens » homogène à la
 * commune : un seul phénomène n'est pas un agrégat. Il s'en construit un au
 * département et à la région, où les dégradations volontaires — comptées en
 * infractions elles aussi — rejoignent les cambriolages. La version communale
 * qui additionnait cambriolages et vols de véhicules mélangeait deux unités ;
 * elle est retirée.
 */
const BIENS = ["ssmsi_cambriolages_nombre", "ssmsi_degradations_nombre"];
const PERSONNES = [
  "ssmsi_violences_intrafamiliales_nombre",
  "ssmsi_violences_hors_famille_nombre",
  "ssmsi_violences_sexuelles_nombre",
];
const STUPEFIANTS = ["ssmsi_usage_stupefiants_nombre", "ssmsi_trafic_stupefiants_nombre"];

/** Faits d'une famille rapportés à mille habitants du même exercice. */
function pourMille(phenomenes: string[]) {
  return (v: Record<string, number>): number | null => {
    const habitants = v[POPULATION];
    if (!habitants || habitants <= 0) return null;
    return (phenomenes.reduce((somme, id) => somme + v[id], 0) / habitants) * 1000;
  };
}

/** Part d'un montant dans un autre, en pourcentage. */
function part(numerateur: string, denominateur: string) {
  return (v: Record<string, number>): number | null => {
    const bas = v[denominateur];
    if (!bas || bas <= 0) return null;
    return (v[numerateur] / bas) * 100;
  };
}

const LOCAL = ["commune", "departement", "region"];

export const DERIVES: Derive[] = [
  {
    id: "derive_desendettement",
    libelle: "Capacité de désendettement",
    theme: "finances_locales",
    unite: "ans",
    niveaux: LOCAL,
    definition:
      "Nombre d'années qu'il faudrait à la collectivité pour rembourser toute sa" +
      " dette si elle y consacrait chaque année la totalité de ce qu'elle met de" +
      " côté. C'est le repère que les financiers publics regardent en premier.",
    definition_technique:
      "Encours de dette au 31 décembre divisé par l'épargne brute du même" +
      " exercice. Non calculée lorsque l'épargne brute est nulle ou négative : la" +
      " collectivité ne dégage alors rien pour rembourser, et le rapport n'a pas" +
      " de valeur : ce n'est pas un remboursement infiniment long, c'est un" +
      " remboursement impossible à ce rythme. La loi de programmation 2018-2022" +
      " retenait un plafond indicatif de 12 ans pour les communes ; ce site ne" +
      " reprend pas ce seuil, qui n'a jamais eu de portée contraignante pour" +
      " elles.",
    formule: "Encours de dette ÷ Épargne brute",
    entrees: ["ofgl_encours_dette", "ofgl_epargne_brute"],
    calcul: (v) => {
      const epargne = v.ofgl_epargne_brute;
      if (!epargne || epargne <= 0) return null;
      return v.ofgl_encours_dette / epargne;
    },
  },
  {
    id: "derive_taux_epargne",
    libelle: "Taux d'épargne brute",
    theme: "finances_locales",
    unite: "percent",
    niveaux: LOCAL,
    definition:
      "Part des recettes de fonctionnement qui reste une fois les services payés." +
      " C'est ce qui finance les investissements et le remboursement de la dette.",
    definition_technique:
      "Épargne brute divisée par les recettes réelles de fonctionnement du même" +
      " exercice, en pourcentage. Peut être négative : la collectivité dépense" +
      " alors plus pour fonctionner qu'elle n'encaisse.",
    formule: "Épargne brute ÷ Recettes de fonctionnement",
    entrees: ["ofgl_epargne_brute", "ofgl_recettes_fonctionnement"],
    calcul: part("ofgl_epargne_brute", "ofgl_recettes_fonctionnement"),
  },
  {
    id: "derive_effort_investissement",
    libelle: "Effort d'investissement",
    theme: "finances_locales",
    unite: "percent",
    niveaux: LOCAL,
    definition:
      "Ce que la collectivité consacre à ses équipements, rapporté à ce qu'elle" +
      " encaisse pour fonctionner. Un chiffre très variable d'une année à l'autre :" +
      " un seul équipement livré suffit à le faire bondir.",
    definition_technique:
      "Dépenses réelles d'investissement, remboursements d'emprunts compris," +
      " divisées par les recettes réelles de fonctionnement du même exercice.",
    formule: "Dépenses d'investissement ÷ Recettes de fonctionnement",
    entrees: ["ofgl_depenses_investissement", "ofgl_recettes_fonctionnement"],
    calcul: part("ofgl_depenses_investissement", "ofgl_recettes_fonctionnement"),
  },
  {
    id: "derive_rigidite",
    libelle: "Part des salaires dans les dépenses de fonctionnement",
    theme: "finances_locales",
    unite: "percent",
    niveaux: LOCAL,
    definition:
      "Part du budget de fonctionnement qui va à la rémunération des agents." +
      " C'est la dépense la plus difficile à réduire d'une année sur l'autre :" +
      " plus elle est élevée, moins la collectivité a de marge de manœuvre à court" +
      " terme.",
    definition_technique:
      "Frais de personnel divisés par les dépenses réelles de fonctionnement du" +
      " même exercice. Ne comprend pas le personnel des satellites (associations" +
      " subventionnées, délégataires de service public), dont la rémunération" +
      " apparaît en subventions ou en achats : deux communes qui font le même" +
      " métier, l'une en régie et l'autre en délégation, n'auront pas le même" +
      " ratio sans que l'une soit plus économe que l'autre.",
    formule: "Frais de personnel ÷ Dépenses de fonctionnement",
    entrees: ["ofgl_frais_personnel", "ofgl_depenses_fonctionnement"],
    calcul: part("ofgl_frais_personnel", "ofgl_depenses_fonctionnement"),
  },
  {
    id: "derive_interets_sur_recettes",
    libelle: "Part des recettes absorbée par les intérêts de la dette",
    theme: "finances_locales",
    unite: "percent",
    niveaux: LOCAL,
    definition:
      "Sur 100 € encaissés pour fonctionner, ce qui part en intérêts de la dette" +
      " avant toute dépense de service. Ne comprend pas le remboursement de la" +
      " dette elle-même.",
    definition_technique:
      "Charges financières divisées par les recettes réelles de fonctionnement du" +
      " même exercice. Les charges financières sont des intérêts payés ; le" +
      " remboursement du capital figure en section d'investissement et ne s'y" +
      " additionne pas.",
    formule: "Charges financières ÷ Recettes de fonctionnement",
    entrees: ["ofgl_charges_financieres", "ofgl_recettes_fonctionnement"],
    calcul: part("ofgl_charges_financieres", "ofgl_recettes_fonctionnement"),
  },
  {
    id: "derive_part_dgf",
    libelle: "Part de la dotation de l'État dans les recettes",
    theme: "finances_locales",
    unite: "percent",
    niveaux: ["commune"],
    definition:
      "Part du budget de fonctionnement qui vient de la dotation globale versée" +
      " par l'État, plutôt que des impôts locaux ou des services rendus.",
    definition_technique:
      "Dotation globale de fonctionnement perçue, divisée par les recettes" +
      " réelles de fonctionnement du même exercice. La DGF n'est publiée qu'à la" +
      " commune : ce ratio n'existe pas aux autres mailles.",
    formule: "Dotation globale de fonctionnement ÷ Recettes de fonctionnement",
    entrees: ["dgcl_dotation_globale_fonctionnement", "ofgl_recettes_fonctionnement"],
    calcul: part("dgcl_dotation_globale_fonctionnement", "ofgl_recettes_fonctionnement"),
  },
  {
    id: "derive_part_non_communale_tfb",
    libelle: "Part du foncier bâti décidée hors de la commune",
    theme: "impots_locaux",
    unite: "percent",
    niveaux: ["commune"],
    definition:
      "Points de taxe foncière que la commune ne vote pas elle-même : la part de" +
      " l'intercommunalité et des taxes spéciales. Le propriétaire les paie" +
      " pourtant sur le même avis d'imposition.",
    definition_technique:
      "Taux global de taxe foncière sur les propriétés bâties moins le taux voté" +
      " par la commune, en points de pourcentage. Ce n'est pas une part relative :" +
      " c'est une différence de deux taux.",
    formule: "Taux global de taxe foncière − Taux communal",
    entrees: ["dgfip_taux_tfb_global", "dgfip_taux_tfb_commune"],
    calcul: (v) => v.dgfip_taux_tfb_global - v.dgfip_taux_tfb_commune,
  },
  {
    id: "derive_atteintes_biens",
    libelle: "Atteintes aux biens (2 phénomènes)",
    theme: "securite",
    unite: "pour_1000_habitants",
    // Pas de maille communale : au communal, une seule des six classes publiées
    // est comptée en infractions, et un phénomène seul n'est pas un agrégat.
    niveaux: ["departement", "region"],
    definition:
      "Cambriolages de logement et dégradations volontaires enregistrés," +
      " rapportés aux habitants. Deux phénomènes que la statistique publique" +
      " compte de la même façon, en infractions, et qui peuvent donc" +
      " s'additionner.",
    definition_technique:
      "Somme des infractions enregistrées par la police et la gendarmerie pour" +
      " les cambriolages de logement et les destructions et dégradations" +
      " volontaires, divisée par la population de référence du même exercice." +
      " Les deux classes sont comptées en infractions par le SSMSI, qui publie" +
      " cette unité dans ses bases : c'est la condition de la somme. Les vols de" +
      " véhicules en sont exclus (le SSMSI les dénombre en véhicules, et un vol" +
      " peut en emporter plusieurs), comme les vols sans violence, comptés en" +
      " victimes entendues. Publié à partir du département : les dégradations ne" +
      " figurent pas dans la base communale. Les cambriolages sont ici rapportés" +
      " aux habitants et non aux logements, contrairement au taux publié par le" +
      " SSMSI pour ce seul phénomène : c'est le prix d'un dénominateur unique." +
      " Mesure les faits portés à la connaissance des forces de l'ordre, pas" +
      " l'intégralité des faits commis.",
    formule: "(Cambriolages + Dégradations) ÷ Population",
    entrees: [...BIENS, POPULATION],
    calcul: pourMille(BIENS),
    sommees: BIENS,
  },
  {
    id: "derive_atteintes_personnes",
    libelle: "Victimes de violences (3 phénomènes)",
    theme: "securite",
    unite: "pour_1000_habitants",
    niveaux: ["commune", "departement", "region"],
    definition:
      "Nombre de victimes de violences intrafamiliales, de violences physiques" +
      " hors famille et de violences sexuelles enregistrées, rapporté aux" +
      " habitants. Ce sont des victimes dénombrées, pas des faits : la statistique" +
      " publique compte ces trois classes de cette façon, et c'est ce qui permet" +
      " de les additionner.",
    definition_technique:
      "Somme des victimes enregistrées pour les violences intrafamiliales, les" +
      " violences physiques hors cadre familial et les violences sexuelles," +
      " divisée par la population de référence du même exercice. Les trois classes" +
      " sont comptées en victimes par la source : c'est la condition de la somme." +
      " Elles dépendent fortement de la propension à porter plainte, qui a" +
      " augmenté sur la période, et la sous-déclaration des violences sexuelles" +
      " reste massive : une hausse enregistrée n'est pas nécessairement une hausse" +
      " des faits commis.",
    formule:
      "(Victimes de violences intrafamiliales + hors famille + sexuelles) ÷ Population",
    entrees: [...PERSONNES, POPULATION],
    calcul: pourMille(PERSONNES),
    sommees: PERSONNES,
  },
  {
    id: "derive_stupefiants",
    libelle: "Personnes mises en cause pour stupéfiants",
    theme: "securite",
    unite: "pour_1000_habitants",
    niveaux: ["departement", "region"],
    definition:
      "Nombre de personnes mises en cause pour usage ou pour trafic de" +
      " stupéfiants, rapporté aux habitants. Ce ne sont ni des faits ni des" +
      " condamnations. Attention : ces infractions sont révélées par l'activité des" +
      " services, pas par des plaintes : un chiffre élevé peut signaler des" +
      " contrôles plus nombreux autant qu'un trafic plus intense.",
    definition_technique:
      "Somme des personnes mises en cause pour usage et pour trafic de" +
      " stupéfiants, divisée par la population de référence du même exercice. Les" +
      " deux classes sont comptées en personnes mises en cause par la source :" +
      " c'est la condition de la somme, et c'est aussi ce qui interdit d'ajouter" +
      " ce total aux agrégats comptés en faits ou en victimes. Une personne mise" +
      " en cause n'est ni condamnée ni jugée. Le SSMSI qualifie lui-même ces" +
      " infractions de « révélées par l'action des services » : leur nombre dépend" +
      " d'abord des moyens engagés et des priorités locales. Non publié à la" +
      " commune.",
    formule: "(Mis en cause pour usage + Mis en cause pour trafic) ÷ Population",
    entrees: [...STUPEFIANTS, POPULATION],
    calcul: pourMille(STUPEFIANTS),
    sommees: STUPEFIANTS,
  },
  {
    id: "derive_dette_locale_en_revenu",
    libelle: "Dette locale rapportée au revenu",
    theme: "finances_locales",
    unite: "mois",
    niveaux: ["commune", "departement", "region"],
    definition:
      "Dette de la collectivité par habitant, exprimée en mois de niveau de vie" +
      " médian du territoire. Ce n'est pas une somme due par chaque habitant :" +
      " c'est une façon de mesurer le poids de la dette à l'échelle des revenus" +
      " locaux.",
    definition_technique:
      "Encours de dette divisé par la population de référence, puis rapporté au" +
      " niveau de vie médian annuel et multiplié par douze. Les deux sources" +
      " diffèrent (OFGL et Filosofi) et leurs millésimes ne coïncident pas" +
      " toujours : seuls les exercices où les deux sont publiées produisent une" +
      " valeur. Le niveau de vie est une médiane de ménages, la dette une somme de" +
      " collectivité : le rapport est une mise en perspective, pas une charge" +
      " individuelle.",
    formule: "(Encours de dette ÷ Population) ÷ Niveau de vie médian × 12",
    entrees: ["ofgl_encours_dette", POPULATION, "insee_niveau_vie_median"],
    calcul: (v) => {
      const habitants = v[POPULATION];
      const revenu = v.insee_niveau_vie_median;
      if (!habitants || habitants <= 0 || !revenu || revenu <= 0) return null;
      return (v.ofgl_encours_dette / habitants / revenu) * 12;
    },
  },
  {
    id: "derive_charge_dette_sur_impots",
    libelle: "Part des impôts absorbée par les intérêts de la dette",
    theme: "budget_etat",
    unite: "percent",
    niveaux: ["pays"],
    definition:
      "Sur 100 € d'impôts encaissés par l'État, ce qui part en intérêts de la" +
      " dette avant toute dépense. Ne comprend pas le remboursement du capital.",
    definition_technique:
      "Charge de la dette de l'État divisée par les recettes fiscales nettes du" +
      " même exercice. La charge de la dette est un intérêt payé, pas un" +
      " remboursement de capital : les deux relèvent de cadres comptables" +
      " distincts et ne s'additionnent pas.",
    formule: "Charge de la dette ÷ Recettes fiscales nettes",
    entrees: ["etat_charge_dette", "etat_recettes_fiscales"],
    calcul: part("etat_charge_dette", "etat_recettes_fiscales"),
  },
  {
    id: "derive_psr_total",
    libelle: "Prélèvements sur recettes, total",
    theme: "budget_etat",
    unite: "EUR",
    niveaux: ["pays"],
    definition:
      "Ce que l'État prélève sur ses propres recettes pour le reverser aux" +
      " collectivités locales et à l'Union européenne, avant même de disposer de" +
      " son budget. Les deux versements sont publiés séparément ; leur somme ne" +
      " l'est pas.",
    definition_technique:
      "Somme du prélèvement sur recettes au profit des collectivités" +
      " territoriales et du prélèvement au profit de l'Union européenne. Ces" +
      " montants ne sont pas des dépenses du budget général : ils en sont" +
      " déduits en amont, ce qui explique qu'on ne les retrouve pas dans les" +
      " dépenses nettes.",
    formule: "PSR collectivités + PSR Union européenne",
    entrees: ["etat_psr_collectivites", "etat_psr_union_europeenne"],
    calcul: (v) => v.etat_psr_collectivites + v.etat_psr_union_europeenne,
  },
  {
    id: "derive_social_pib",
    libelle: "Santé et protection sociale réunies",
    theme: "fonctions",
    unite: "percent",
    niveaux: ["pays"],
    definition:
      "Ce que la santé et la protection sociale représentent ensemble dans" +
      " l'économie du pays. Les deux premiers postes de la dépense publique" +
      " française, additionnés.",
    definition_technique:
      "Somme des fonctions COFOG « Santé » et « Protection sociale », toutes deux" +
      " exprimées en pourcentage du produit intérieur brut. Deux fonctions" +
      " distinctes de la même nomenclature et de la même unité : leur somme est" +
      " licite et vaut bien la part de ces deux postes dans le PIB.",
    formule: "Santé + Protection sociale",
    entrees: ["eurostat_fonction_sante", "eurostat_fonction_protection_sociale"],
    calcul: (v) => v.eurostat_fonction_sante + v.eurostat_fonction_protection_sociale,
  },
];

/**
 * Les séries calculées pour un territoire, à ajouter aux siennes.
 *
 * Un exercice n'est retenu que si **toutes** les entrées y sont publiées : le
 * calcul ne comble jamais un trou par la valeur de l'année d'à côté.
 */
export function seriesDerivees(
  series: Record<string, Record<string, number>>,
  niveau: string,
  catalogue: Indicateur[] = [],
): Record<string, Record<string, number>> {
  const sortie: Record<string, Record<string, number>> = {};
  const connus = new Map(catalogue.map((i) => [i.id, i]));
  for (const derive of DERIVES) {
    if (!derive.niveaux.includes(niveau)) continue;
    if (connus.size && !sommeHomogene(derive, connus)) continue;
    if (derive.entrees.some((id) => !series[id])) continue;
    const exercices = derive.entrees
      .map((id) => Object.keys(series[id]))
      .reduce((a, b) => a.filter((periode) => b.includes(periode)));
    const serie: Record<string, number> = {};
    for (const periode of exercices) {
      const entrees: Record<string, number> = {};
      for (const id of derive.entrees) entrees[id] = series[id][periode];
      const valeur = derive.calcul(entrees);
      if (valeur !== null && Number.isFinite(valeur)) serie[periode] = valeur;
    }
    if (Object.keys(serie).length) sortie[derive.id] = serie;
  }
  return sortie;
}

/**
 * Les fiches des indicateurs calculés, à ajouter au catalogue.
 *
 * Un calcul dont une entrée n'est pas au catalogue n'apparaît pas : mieux vaut
 * un indicateur absent qu'un indicateur annoncé qui ne produira jamais rien.
 */
/** Les identifiants calculés, pour les distinguer partout où l'origine compte —
 *  la carte, par exemple, qui n'a pas de couche à peindre pour eux. */
export const IDS_DERIVES = new Set(DERIVES.map((d) => d.id));

export function indicateursDerives(catalogue: Indicateur[]): Indicateur[] {
  const connus = new Map(catalogue.map((i) => [i.id, i]));
  return DERIVES.filter(
    (d) => d.entrees.every((id) => connus.has(id)) && sommeHomogene(d, connus),
  ).map((derive) => {
    // Les millésimes possibles sont ceux communs aux entrées : annoncer 2018 sur
    // un ratio dont une composante commence en 2020 ferait chercher une valeur
    // qui n'existera jamais.
    const periodes = derive.entrees
      .map((id) => (connus.get(id) as Indicateur).periodes)
      .reduce((a, b) => a.filter((p) => b.includes(p)));
    const niveaux = derive.niveaux.filter((niveau) =>
      derive.entrees.every((id) => (connus.get(id) as Indicateur).niveaux.includes(niveau)),
    );
    return {
      id: derive.id,
      libelle: derive.libelle,
      unite: derive.unite,
      theme: derive.theme,
      // Un ratio, un taux ou une part ne s'additionne pas et ne se ramène pas à
      // l'habitant : c'est ce drapeau qui l'empêche partout ailleurs.
      sommable: false,
      cadre_comptable: null,
      niveaux,
      definition: derive.definition,
      definition_technique: derive.definition_technique,
      formule: derive.formule,
      confiance: "derived",
      badges: ["Calculé par ce site"],
      // Le jeu de la première entrée, pas un jeu « calculs » inventé. Deux
      // raisons, et la seconde est un piège évité : la source réelle du chiffre
      // reste nommée dans l'onglet Données ; et les règles de comparabilité
      // attachées au jeu continuent de s'appliquer. La capacité de
      // désendettement d'une commune hérite ainsi de l'interdiction de se
      // comparer au conseil départemental — qui n'exerce pas les mêmes
      // compétences — alors qu'un agrégat de délinquance, lui, se compare bien à
      // son département, qui est un territoire.
      jeu: (connus.get(derive.entrees[0]) as Indicateur).jeu,
      // Et par la même occasion les mailles dont ce jeu-là n'est pas la source :
      // hériter du jeu sans ses exceptions ferait dire à un dérivé communal ce
      // que son entrée dit déjà correctement à la maille département.
      jeu_par_niveau: (connus.get(derive.entrees[0]) as Indicateur).jeu_par_niveau,
      periodes,
    };
  });
}
