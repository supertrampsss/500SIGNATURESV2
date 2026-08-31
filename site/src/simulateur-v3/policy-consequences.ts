import type {
  EffectRule,
  GroupKey,
  IndicatorKey,
  PolicyHorizon,
  ScheduledEventRule,
  Uncertainty,
} from "./types.ts";

export type ExplicitEffect = number | {
  delta: number;
  timing?: EffectRule["timing"];
  duration?: EffectRule["duration"];
  explanation?: string;
};

export type PolicyConsequence = {
  mechanism: string;
  horizon: PolicyHorizon;
  legalConstraints: string[];
  budgetDuration: "annual" | "once";
  indicatorEffects: Partial<Record<IndicatorKey, ExplicitEffect>>;
  groupEffects: Partial<Record<GroupKey, ExplicitEffect>>;
  locks: string[];
  unlocks: string[];
  scheduledEvents?: ScheduledEventRule[];
  uncertainty?: Uncertainty;
};

type ConsequenceExtra = Partial<Pick<PolicyConsequence,
  "budgetDuration" | "locks" | "unlocks" | "scheduledEvents" | "uncertainty"
>>;

const immediate = { kind: "immediate" } as const;
const after = (count: number): PolicyHorizon => ({ kind: "after_decisions", count });
const year = (value: 1 | 2 | 3 | 4 | 5): PolicyHorizon => ({ kind: "mandate_year", year: value });

function consequence(
  mechanism: string,
  horizon: PolicyHorizon,
  legalConstraints: string[],
  indicatorEffects: PolicyConsequence["indicatorEffects"],
  groupEffects: PolicyConsequence["groupEffects"],
  extra: ConsequenceExtra = {},
): PolicyConsequence {
  return {
    mechanism,
    horizon,
    legalConstraints,
    budgetDuration: extra.budgetDuration ?? "annual",
    indicatorEffects,
    groupEffects,
    locks: extra.locks ?? [],
    unlocks: extra.unlocks ?? [],
    ...(extra.scheduledEvents ? { scheduledEvents: extra.scheduledEvents } : {}),
    ...(extra.uncertainty ? { uncertainty: extra.uncertainty } : {}),
  };
}

function event(
  id: string,
  title: string,
  body: string,
  afterDecisions: number,
  target: "indicator" | "group",
  key: IndicatorKey | GroupKey,
  delta: number,
): ScheduledEventRule {
  const effect = {
    id: `${id}:${target}:${key}`,
    target,
    key,
    delta,
    timing: immediate,
    duration: "once",
    explanation: body,
  } as EffectRule;
  return { id, title, body, afterDecisions, effects: [effect] };
}

const FLAT_TAXES = ["flat-tax-a-20-des-le-premier", "flat-tax-a-20-avec-abattement-protegeant"];
const FLAT_TAX_CONFLICTS = [
  "geler-le-bareme-de-l-impot-sur",
  "tranche-a-50-au-dela-de-250",
  "soumettre-les-revenus-du-capital-au-bareme",
];

const TAX_AND_WORK: Record<string, Record<string, PolicyConsequence>> = {
  "geler-le-bareme-de-l-impot-sur": {
    adopt: consequence("Laisser les seuils nominaux inchangés pendant une année fiscale afin que l'inflation augmente l'impôt dû à revenu réel constant.", year(1), ["Loi de finances", "Définir la référence d'inflation et la période de non-indexation", "Contrôler l'égalité devant les charges publiques"], { institutionalTrust: -2 }, { middleClasses: -2 }, { locks: FLAT_TAXES }),
    keep: consequence("Relever les seuils selon l'inflation observée afin de neutraliser la progression purement nominale des revenus.", immediate, [], { institutionalTrust: 1 }, { middleClasses: 1 }),
  },
  "porter-le-taux-normal-de-tva-a": {
    adopt: consequence("Relever à 21 % le taux appliqué à l'assiette actuellement au taux normal, avec des règles transitoires de facturation.", year(1), ["Loi de finances", "Directive TVA", "Définir la date d'exigibilité et les règles transitoires"], { opinion: -5 }, { lowIncomeHouseholds: -4, middleClasses: -3, businesses: -1 }),
    keep: consequence("Conserver le taux normal à 20 % et éviter le choc de prix associé au point supplémentaire.", immediate, [], { opinion: 1 }, { lowIncomeHouseholds: 1, middleClasses: 1 }),
  },
  "doubler-la-taxe-sur-les-rachats-d": {
    adopt: consequence("Doubler le taux de la taxe existante sans modifier son périmètre d'entreprises et d'opérations.", year(1), ["Loi de finances", "Définir assiette, seuils et règles anti-évitement"], { investment: 1 }, { businesses: -1 }, { uncertainty: "forte" }),
    keep: consequence("Maintenir le coût relatif actuel des rachats et la liberté d'allocation entre rachat, dividende et réinvestissement.", immediate, [], { investment: -1 }, { businesses: 1 }),
  },
  "raboter-l-avantage-successoral-de-l-assurance": {
    adopt: consequence("Réduire l'abattement ou relever le taux applicable aux capitaux décès pour les versements futurs.", year(1), ["Loi de finances", "Article 990 I du CGI", "Définir le traitement des primes antérieures", "Sécurité juridique"], { institutionalTrust: 1 }, { middleClasses: -1, retirees: -1 }, { locks: ["abolir-les-droits-de-succession"] }),
    keep: consequence("Conserver la règle de transmission distincte et sa stabilité pour les détenteurs de contrats de long terme.", immediate, [], { investment: 1 }, { middleClasses: 1, retirees: 1 }),
  },
  "tranche-a-50-au-dela-de-250": {
    adopt: consequence("Appliquer 50 % uniquement à la fraction du revenu imposable dépassant 250 000 euros selon une unité fiscale définie.", year(1), ["Loi de finances", "Préciser si le seuil est individuel ou par foyer", "Quotient familial", "Caractère non confiscatoire"], { institutionalTrust: 2, investment: -1 }, { businesses: -1 }, { locks: FLAT_TAXES, scheduledEvents: [event("tax-base-reaction", "L'assiette réagit à la nouvelle tranche", "Des contribuables modifient leurs versements et quelques départs médiatisés fragilisent le rendement attendu.", 2, "indicator", "financialCredibility", -2)] }),
    keep: consequence("Conserver la tranche supérieure et l'incitation marginale actuelle au-delà du seuil proposé.", immediate, [], { investment: 1 }, { businesses: 1 }),
  },
  "retablir-un-impot-sur-la-fortune-financiere": {
    adopt: consequence("Taxer le patrimoine financier net au-dessus d'un seuil avec des règles de dette, valorisation, liquidité et actifs professionnels.", year(2), ["Loi de finances", "Égalité et facultés contributives", "Valorisation et liquidité", "Liberté de circulation et conventions fiscales"], { investment: -2 }, { businesses: -2 }),
    keep: consequence("Laisser les actifs financiers hors de l'impôt sur la fortune et conserver l'imposition immobilière actuelle.", immediate, [], { investment: 1 }, { businesses: 1 }),
  },
  "soumettre-les-revenus-du-capital-au-bareme": {
    adopt: consequence("Remplacer la composante d'impôt sur le revenu du prélèvement forfaitaire par le barème progressif pour les revenus financiers couverts.", year(1), ["Loi de finances", "Définir le champ dividendes, intérêts et plus-values", "Préciser abattements, moins-values et prélèvements sociaux"], { investment: -2 }, { businesses: -1 }, { locks: FLAT_TAXES }),
    keep: consequence("Conserver le taux forfaitaire et la lisibilité du rendement après impôt de l'épargne financière.", immediate, [], { investment: 1 }, { businesses: 1 }),
  },
  "exonerer-de-droits-de-succession-jusqu-a": {
    adopt: consequence("Relever à 300 000 euros l'abattement en ligne directe par enfant et par donateur en précisant la période de rappel.", year(1), ["Loi de finances", "Distinguer dons et successions", "Préciser la période de rappel", "Égalité entre situations familiales"], { institutionalTrust: -2 }, { middleClasses: 2 }, { locks: ["abolir-les-droits-de-succession"] }),
    keep: consequence("Conserver les seuils et la progressivité actuels des transmissions.", immediate, [], { institutionalTrust: 1 }, { middleClasses: -1 }),
  },
  "flat-tax-a-20-des-le-premier": {
    adopt: consequence("Remplacer le barème de l'impôt sur le revenu par un taux de 20 % dès le premier euro taxable, sans seuil d'entrée.", year(1), ["Loi de finances", "Risque constitutionnel sur les facultés contributives", "Traiter les charges de famille et le revenu minimum", "Préciser assiette et prélèvements sociaux"], { opinion: -12, institutionalTrust: -6 }, { lowIncomeHouseholds: -10, middleClasses: -8, businesses: 2 }, { locks: ["flat-tax-a-20-avec-abattement-protegeant", ...FLAT_TAX_CONFLICTS], uncertainty: "forte" }),
    keep: consequence("Conserver le seuil d'entrée, les charges de famille et la progressivité des taux.", immediate, [], { opinion: 2, institutionalTrust: 2 }, { lowIncomeHouseholds: 2, middleClasses: 1 }),
  },
  "flat-tax-a-20-avec-abattement-protegeant": {
    adopt: consequence("Déduire un abattement chiffré par foyer ou part puis appliquer 20 % au revenu taxable restant.", year(1), ["Loi de finances", "Publier le montant de l'abattement", "Définir l'unité foyer ou part", "Respecter l'égalité et les charges de famille"], { investment: 2, institutionalTrust: -3 }, { businesses: 2 }, { locks: ["flat-tax-a-20-des-le-premier", ...FLAT_TAX_CONFLICTS], uncertainty: "forte" }),
    keep: consequence("Conserver la hausse des taux marginaux avec le revenu et le rendement actuel.", immediate, [], { institutionalTrust: 2 }, { businesses: -1 }),
  },
  "impot-plancher-de-2-sur-les-patrimoines": {
    adopt: consequence("Calculer un complément pour porter à 2 % l'imposition annuelle des patrimoines couverts après crédit des impôts patrimoniaux énumérés.", year(2), ["Loi de finances", "Facultés contributives et risque confiscatoire", "Revenus latents et liquidité", "Valorisation et liberté de circulation"], { institutionalTrust: 3, investment: -4 }, { businesses: -4 }, { uncertainty: "forte" }),
    keep: consequence("Conserver les règles actuelles de valorisation et de taxation sans complément annuel de 2 %.", immediate, [], { investment: 2 }, { businesses: 2 }),
  },
  "abolir-les-droits-de-succession": {
    adopt: consequence("Fixer à zéro les taux des droits de succession tout en conservant la déclaration et la valorisation des actifs.", year(1), ["Loi de finances", "Préciser le sort des donations", "Régimes transfrontaliers et conventions fiscales"], { institutionalTrust: -5 }, { lowIncomeHouseholds: -3, middleClasses: 2 }, { locks: ["exonerer-de-droits-de-succession-jusqu-a", "raboter-l-avantage-successoral-de-l-assurance"], scheduledEvents: [event("inheritance-wealth-gap", "L'écart patrimonial se creuse", "Les transmissions nettes d'impôt accroissent l'écart relatif entre héritiers et ménages sans patrimoine transmis.", 4, "group", "lowIncomeHouseholds", -3)] }),
    keep: consequence("Conserver les abattements, la progressivité et la recette sur les transmissions taxables.", immediate, [], { institutionalTrust: 2 }, { lowIncomeHouseholds: 1, middleClasses: -1 }),
  },
  "fiscaliser-les-heures-supplementaires-comme-le": {
    adopt: consequence("Supprimer l'exonération d'impôt sur le revenu des heures supplémentaires en distinguant explicitement les cotisations salariales.", year(1), ["Loi de finances", "Distinguer impôt sur le revenu et cotisations", "Définir le champ et le plafond des heures"], { employment: 1 }, { privateEmployees: -3, unions: -1 }),
    keep: consequence("Conserver le supplément de revenu net et l'incitation à prolonger les heures des salariés déjà en poste.", immediate, [], { employment: -1 }, { privateEmployees: 2, unions: 1 }),
  },
  "supprimer-les-allegements-de-cotisations-entre-2": {
    adopt: consequence("Supprimer les allègements de cotisations spécifiquement entre 2,5 et 3,5 SMIC.", year(1), ["Loi de financement de la sécurité sociale", "Définir la bande 2,5 à 3,5 SMIC", "Prévoir la transition de paie"], { employment: -1 }, { businesses: -2 }),
    keep: consequence("Conserver le coût du travail actuel dans la bande de salaires concernée.", immediate, [], { employment: 1 }, { businesses: 1 }),
  },
  "raboter-de-5-les-subventions-directes-aux": {
    adopt: consequence("Réduire de 5 % un inventaire déclaré de subventions directes discrétionnaires en excluant les engagements impossibles à réduire immédiatement.", year(1), ["Loi de finances", "Contrats de subvention", "Aides d'État et cofinancements européens", "Inventaire de l'assiette"], { investment: -2 }, { businesses: -2, localAuthorities: -1 }),
    keep: consequence("Honorer les dispositifs et engagements existants, notamment territoriaux et industriels.", immediate, [], { investment: 1 }, { businesses: 1, localAuthorities: 1 }),
  },
  "raboter-le-credit-d-impot-recherche-de": {
    adopt: consequence("Réduire le taux ou le plafond du crédit d'impôt recherche pour obtenir un recul agrégé de 10 % hors PME.", year(1), ["Loi de finances", "Définition des PME", "Sélectivité et aides d'État", "Publier le paramètre de réduction"], { investment: -3 }, { businesses: -2 }),
    keep: consequence("Conserver la stabilité du soutien fiscal aux dépenses de recherche éligibles.", immediate, [], { investment: 2 }, { businesses: 1 }),
  },
  "repousser-l-age-legal-a-65-ans": {
    adopt: consequence("Prolonger par cohorte la trajectoire actuelle vers 65 ans avec des règles de carrière longue, handicap, incapacité et pénibilité.", year(5), ["Loi ordinaire et sécurité sociale", "Transition par génération", "Égalité entre cohortes", "Carrières longues, handicap et pénibilité"], { employment: 2 }, { privateEmployees: -5, unions: -3 }, { locks: ["revenir-a-62-ans"], scheduledEvents: [event("senior-employment-test", "L'emploi des seniors devient le juge de paix", "Une partie des seniors bascule vers le chômage, l'invalidité ou la maladie et réduit l'effet emploi attendu.", 12, "indicator", "employment", -3)] }),
    keep: consequence("Poursuivre la montée en charge de la règle actuelle vers 64 ans.", immediate, [], { employment: 1 }, { privateEmployees: 2, unions: 1 }),
  },
  "revenir-a-62-ans": {
    adopt: consequence("Inverser le calendrier par cohorte et rétablir l'éligibilité à 62 ans sans diminuer les droits acquis.", year(5), ["Loi ordinaire et sécurité sociale", "Transition par génération", "Droits acquis", "Carrières longues et durée de cotisation"], { employment: -3 }, { privateEmployees: 4, retirees: 3 }, { locks: ["repousser-l-age-legal-a-65-ans"] }),
    keep: consequence("Poursuivre la montée vers 64 ans et les cotisations supplémentaires attendues.", immediate, [], { employment: 2 }, { privateEmployees: -2 }),
  },
  "desindexer-les-pensions-d-un-point": {
    adopt: consequence("Appliquer inflation moins un point à la revalorisation annuelle des pensions en précisant un éventuel plancher.", year(1), ["Loi de financement de la sécurité sociale", "Date de revalorisation", "Égalité en cas de plancher ou compensation"], { institutionalTrust: -2 }, { retirees: -6 }),
    keep: consequence("Appliquer la formule légale et préserver le pouvoir d'achat nominal relatif des pensions.", immediate, [], { institutionalTrust: 1 }, { retirees: 2 }),
  },
  "durcir-l-assurance-chomage-degressivite-duree": {
    adopt: consequence("Définir la cohorte, la réduction de durée, le seuil de dégressivité, son rythme, son plancher et la condition conjoncturelle.", year(2), ["Négociation des partenaires sociaux et agrément", "À défaut d'accord, décret de l'État", "Droits transitoires", "Plancher de revenu"], { employment: 1 }, { privateEmployees: -3, unions: -2, businesses: 1 }, { uncertainty: "forte" }),
    keep: consequence("Maintenir la convention et la fonction d'assurance du revenu pendant la recherche d'emploi.", immediate, [], { institutionalTrust: 1 }, { privateEmployees: 2, unions: 1 }),
  },
  "ouvrir-un-etage-de-capitalisation-collective": {
    adopt: consequence("Affecter une part chiffrée des cotisations à un véhicule collectif gouverné tout en finançant la transition des pensions courantes.", year(3), ["Loi", "Taux de cotisation affecté", "Garantie, gouvernance et portabilité", "Règles prudentielles", "Financement de la transition"], { investment: 3 }, { privateEmployees: -3, businesses: 1 }, { uncertainty: "forte" }),
    keep: consequence("Continuer à utiliser les cotisations obligatoires pour payer les pensions courantes sans nouvelle réserve investie.", immediate, [], { institutionalTrust: 1 }, { privateEmployees: 2 }),
  },
  "retablir-la-semaine-de-39-heures": {
    adopt: consequence("Fixer le seuil légal à 39 heures avec salaire mensuel de base inchangé lorsque contrats ou accords l'acceptent.", year(2), ["Loi sur la durée légale", "Durées maximales et repos", "Contrats individuels et accords collectifs", "Aucune baisse unilatérale du salaire contractuel"], { growth: 0.12, employment: -2 }, { businesses: 5, unions: -8, privateEmployees: -5 }, { uncertainty: "forte", scheduledEvents: [event("hours-wage-bargain", "Les négociations salariales bloquent plusieurs branches", "Les conflits sur la compensation des quatre heures retardent l'organisation du travail et certaines embauches.", 2, "indicator", "employment", -2)] }),
    keep: consequence("Conserver le seuil de déclenchement des heures supplémentaires et leur majoration actuelle.", immediate, [], { employment: 1 }, { privateEmployees: 2, unions: 2, businesses: -1 }),
  },
  "augmenter-le-smic-de-10": {
    adopt: consequence("Relever de 10 % le SMIC horaire par décret en conservant inchangé le barème des allègements de cotisations retenu par le chiffrage.", immediate, ["Décret selon le Code du travail", "Loi de financement si les allègements changent", "Rattrapage des minima conventionnels", "Préciser les régimes territoriaux"], { employment: -2 }, { lowIncomeHouseholds: 8, privateEmployees: 4, businesses: -6 }, { uncertainty: "forte" }),
    keep: consequence("Appliquer la formule légale fondée sur les prix et les salaires sans coup de pouce discrétionnaire.", immediate, [], { employment: 1 }, { lowIncomeHouseholds: -2, businesses: 2 }),
  },
  "allocation-sociale-unique": {
    adopt: consequence("Remplacer RSA, prime d'activité et APL par un barème de ménage publié avec calcul et versement automatiques.", year(3), ["Lois régissant chaque prestation", "Financement départemental du RSA", "Coordination européenne", "Protection des données", "Publier le barème et la transition"], { publicServices: 2, institutionalTrust: 2 }, { lowIncomeHouseholds: -1 }, { uncertainty: "forte", scheduledEvents: [event("single-benefit-losers", "Le premier versement révèle des perdants", "Certaines configurations familiales reçoivent moins avec le barème provisoire de la prestation unique.", 3, "group", "lowIncomeHouseholds", -3)] }),
    keep: consequence("Maintenir les objectifs, formulaires, effets de seuil et non-recours propres à chaque prestation.", immediate, [], { publicServices: -1, institutionalTrust: -1 }, { lowIncomeHouseholds: 1 }),
  },
};

const HEALTH_AND_SECURITY: Record<string, Record<string, PolicyConsequence>> = {
  "doubler-les-franchises-medicales": {
    adopt: consequence("Doubler les montants unitaires facturés aux patients sur les actes et produits concernés en conservant plafonds et exemptions.", immediate, ["Modifier le régime en LFSS ou par le texte d'application approprié", "Respecter exemptions et plafonds annuels", "Concilier la mesure avec la protection de la santé"], { publicServices: -2, opinion: -4 }, { lowIncomeHouseholds: -5, retirees: -3 }),
    keep: consequence("Conserver les montants, plafonds et exemptions actuels.", immediate, [], { publicServices: 1, institutionalTrust: 1 }, { lowIncomeHouseholds: 2, retirees: 1 }),
  },
  "imposer-generiques-et-biosimilaires-en-premiere-intention": {
    adopt: consequence("Rendre le générique ou biosimilaire l'option par défaut avec une exception médicale documentée et les leviers de remboursement associés.", after(2), ["Droit européen de mise sur le marché et pharmacovigilance", "Règles françaises de substitution", "Exception médicale et sécurité du patient"], { reformCapacity: 3, publicServices: 1 }, { businesses: -3 }),
    keep: consequence("Maintenir les incitations et facultés actuelles de substitution ainsi que la liberté de prescription encadrée.", immediate, [], { institutionalTrust: 1, publicServices: 1 }, { businesses: 2 }),
  },
  "derembourser-les-cures-thermales": {
    adopt: consequence("Retirer les cures thermales ordinaires du panier remboursable en conservant une voie exceptionnelle strictement médicale.", immediate, ["Modifier la liste des prestations selon la procédure applicable", "Respecter l'égalité entre assurés et indications médicales"], { publicServices: -1, opinion: -2 }, { localAuthorities: -5, retirees: -2 }),
    keep: consequence("Maintenir les indications et le taux de remboursement actuels.", immediate, [], { publicServices: 1 }, { localAuthorities: 3, retirees: 1 }),
  },
  "renforcer-le-controle-des-arrets-de-travail": {
    adopt: consequence("Cibler les contrôles selon le risque avec examen médical indépendant, notification contradictoire et voie de recours.", after(2), ["Secret médical", "RGPD et finalité du profilage", "Procédure contradictoire et recours", "Codes du travail et de la sécurité sociale"], { reformCapacity: 2, institutionalTrust: -1 }, { privateEmployees: -3, businesses: 2 }),
    keep: consequence("Conserver l'échantillonnage, la prescription et les recours actuels.", immediate, [], { institutionalTrust: 1, reformCapacity: -1 }, { privateEmployees: 1, businesses: -1 }),
  },
  "creer-5-000-postes-de-soignants": {
    adopt: consequence("Financer 5 000 emplois permanents, leur formation et leur affectation vers les territoires ou spécialités en pénurie.", after(3), ["Crédits LFSS et loi de finances", "Statuts de l'emploi hospitalier", "Diplômes, autorisations d'exercice et capacités de formation"], { publicServices: 4 }, { publicEmployees: 5, localAuthorities: 1 }),
    keep: consequence("Maintenir la trajectoire d'effectifs financée sans cohorte supplémentaire.", immediate, [], { publicServices: -2, opinion: -1 }, { publicEmployees: -2, localAuthorities: -1 }),
  },
  "loi-grand-age-50-000-recrutements": {
    adopt: consequence("Attribuer des subventions pluriannuelles conditionnées aux recrutements nets, à la formation et à la rétention en établissement et à domicile.", after(4), ["LFSS et concours CNSA", "Compétences et autonomie financière des départements", "Conventions collectives, statuts et qualifications"], { publicServices: 6, reformCapacity: 2 }, { publicEmployees: 6, localAuthorities: 3 }),
    keep: consequence("Conserver les enveloppes et ratios d'encadrement programmés.", immediate, [], { publicServices: -4, opinion: -2 }, { publicEmployees: -3, localAuthorities: -2 }),
  },
  "fusionner-agences-sanitaires-et-echelons-des-ars": {
    adopt: consequence("Fusionner des organismes et fonctions support identifiés tout en maintenant des guichets opérationnels régionaux.", year(3), ["Loi pour les organismes créés par la loi", "Consultation et garanties de transfert des agents", "Continuité des missions et données de santé"], { reformCapacity: 4, publicServices: -2 }, { publicEmployees: -5, localAuthorities: -4 }),
    keep: consequence("Maintenir les personnes morales, responsabilités régionales et circuits actuels.", immediate, [], { institutionalTrust: 1, reformCapacity: -2 }, { publicEmployees: 2, localAuthorities: 2 }),
  },
  "fiscalite-nutritionnelle-au-niveau-recommande": {
    adopt: consequence("Créer un barème d'accise gradué selon la teneur en sucre ou alcool avec un calendrier de taux publié.", after(2), ["Article 34 de la Constitution", "Droit européen des accises", "Classification non discriminatoire des produits"], { publicServices: 2, opinion: -2 }, { lowIncomeHouseholds: -3, businesses: -4 }),
    keep: consequence("Maintenir les taux et assiettes actuels.", immediate, [], { opinion: 1, publicServices: -1 }, { lowIncomeHouseholds: 1, businesses: 2 }),
  },
  "supprimer-l-aide-medicale-d-etat": {
    adopt: consequence("Abroger la couverture dédiée tout en conservant les soins d'urgence, de dignité et de santé publique légalement obligatoires.", immediate, ["Protection de la santé et de la dignité", "Obligations de soins urgents", "Protection des mineurs et engagements internationaux", "Modifier la facturation hospitalière"], { publicServices: -4, institutionalTrust: -2 }, { lowIncomeHouseholds: -7, publicEmployees: -3, localAuthorities: -2 }, { scheduledEvents: [event("ame-emergency-transfer", "Les urgences absorbent les soins retardés", "Les soins retardés se reportent vers l'hôpital et saturent davantage les services d'urgence.", 3, "indicator", "publicServices", -4)] }),
    keep: consequence("Maintenir l'éligibilité, le panier de soins et le canal de facturation existants.", immediate, [], { publicServices: 2, institutionalTrust: 1 }, { lowIncomeHouseholds: 4, publicEmployees: 1 }),
  },
  "verser-le-rsa-automatiquement-fin-du-non": {
    adopt: consequence("Croiser les données fiscales et sociales, prénotifier l'éligibilité, ouvrir le droit puis permettre correction, refus et recours.", after(2), ["Base législative et financement départemental", "RGPD, minimisation et finalité", "Notification, correction, recours et récupération des indus"], { reformCapacity: 5, institutionalTrust: 3 }, { lowIncomeHouseholds: 8, localAuthorities: -3 }),
    keep: consequence("Maintenir une demande initiée par l'allocataire et les échanges de données actuels.", immediate, [], { reformCapacity: -2, institutionalTrust: -1 }, { lowIncomeHouseholds: -4, localAuthorities: 1 }),
  },
  "porter-le-rsa-au-seuil-de": {
    adopt: consequence("Relever le barème national et l'indexer sur le seuil de pauvreté publié.", immediate, ["Barème légal du RSA", "Financement et compensation des départements", "Principe d'égalité"], { institutionalTrust: 2, opinion: 4 }, { lowIncomeHouseholds: 9, localAuthorities: -6 }),
    keep: consequence("Conserver le barème et l'indexation actuels.", immediate, [], { financialCredibility: 1, opinion: -2 }, { lowIncomeHouseholds: -4, localAuthorities: 2 }),
  },
  "assurance-maladie-publique-unique": {
    adopt: consequence("Créer un panier public universel et transférer par étapes contrats, remboursements, données et personnels.", year(4), ["LFSS et loi ordinaire", "Contrats d'assurance existants", "Liberté d'entreprendre et propriété", "Droit européen de l'assurance et de la concurrence", "Transfert des personnels et données de santé"], { publicServices: 6, reformCapacity: -5, institutionalTrust: 2 }, { middleClasses: 4, lowIncomeHouseholds: 4, businesses: -6 }, { uncertainty: "forte", scheduledEvents: [event("health-transition-billing", "La bascule administrative retarde les remboursements", "Les systèmes de facturation peinent à absorber le transfert et les délais de remboursement augmentent.", 2, "indicator", "publicServices", -4)] }),
    keep: consequence("Maintenir l'assurance maladie obligatoire et les complémentaires régulées.", immediate, [], { institutionalTrust: 1, reformCapacity: 1 }, { businesses: 3, middleClasses: -2 }),
  },
  "recruter-10-000-policiers-et-gendarmes": {
    adopt: consequence("Créer des emplois permanents, ouvrir les cohortes d'école et affecter des effectifs nets aux unités sous-dotées.", after(3), ["Crédits de la loi de finances et LOPMI", "Statuts civil et militaire", "Égalité de recrutement et formation"], { publicServices: 4, reformCapacity: -1 }, { publicEmployees: 5, localAuthorities: 2 }),
    keep: consequence("Conserver la trajectoire de recrutement et d'attrition actuelle.", immediate, [], { publicServices: -2, financialCredibility: 1 }, { publicEmployees: -2, localAuthorities: -1 }),
  },
  "construire-15-000-places-de-prison-supplementaires": {
    adopt: consequence("Acquérir les sites, passer les marchés, construire, recruter les surveillants et ouvrir progressivement les places.", year(4), ["Commande publique", "Urbanisme et environnement", "Normes constitutionnelles et CEDH de détention", "Crédits de fonctionnement et de personnel"], { publicServices: 3, reformCapacity: -3 }, { publicEmployees: 3, localAuthorities: -2 }),
    keep: consequence("Ne pas lancer le programme supplémentaire et conserver le parc programmé.", immediate, [], { publicServices: -4, financialCredibility: 1 }, { publicEmployees: -3, localAuthorities: 1 }),
  },
  "recruter-3-000-magistrats-et-greffiers": {
    adopt: consequence("Ouvrir des cohortes de magistrats et greffiers, les former puis les affecter aux juridictions à stocks élevés.", after(3), ["Statut organique de la magistrature", "Indépendance judiciaire", "Concours, formation et crédits"], { publicServices: 5, institutionalTrust: 3 }, { publicEmployees: 5 }),
    keep: consequence("Conserver la trajectoire d'effectifs et d'affectation actuelle.", immediate, [], { publicServices: -3, institutionalTrust: -2 }, { publicEmployees: -2 }),
  },
  "etendre-les-centres-de-retention-administrative": {
    adopt: consequence("Construire et doter des places supplémentaires sans supprimer l'examen individuel ni le contrôle du juge.", after(3), ["Directive Retour de l'Union", "Durées maximales CESEDA", "Nécessité et proportionnalité individuelles", "Contrôle juridictionnel et conditions CEDH"], { publicServices: 1, institutionalTrust: -2 }, { publicEmployees: 2, localAuthorities: -2 }),
    keep: consequence("Conserver la capacité et les alternatives à la rétention actuelles.", immediate, [], { institutionalTrust: 1, publicServices: -1 }, { publicEmployees: -1, localAuthorities: 1 }),
  },
  "reduire-les-delais-de-traitement-de-l": {
    adopt: consequence("Renforcer les moyens d'instruction et les outils de dossier sans réduire l'audience, l'instruction ni les droits de recours.", after(3), ["Droit européen de la procédure d'asile", "Non-refoulement", "Recours effectif", "Indépendance des organismes", "Protection des données"], { publicServices: 4, institutionalTrust: 2 }, { publicEmployees: 3, localAuthorities: 3 }),
    keep: consequence("Conserver les moyens, délais procéduraux et capacités de recours actuels.", immediate, [], { publicServices: -2, institutionalTrust: -1 }, { publicEmployees: -1, localAuthorities: -2 }),
  },
  "doubler-l-execution-des-eloignements-oqtf": {
    adopt: consequence("Financer escortes, documents de voyage, rétention ou alternatives, vols et cellules consulaires sans garantir le doublement des résultats.", after(2), ["Recours individuel", "Non-refoulement", "Vie privée et familiale CEDH", "Directive Retour", "Coopération consulaire"], { reformCapacity: 2, opinion: 2, institutionalTrust: -1 }, { publicEmployees: 2, europeanPartners: -2 }, { scheduledEvents: [event("consular-bottleneck", "Les laissez-passer limitent les éloignements", "La coopération consulaire ne suit pas le rythme des moyens administratifs engagés.", 2, "indicator", "reformCapacity", -3)] }),
    keep: consequence("Conserver les moyens et priorités d'exécution actuels.", immediate, [], { institutionalTrust: 1, reformCapacity: -2 }, { publicEmployees: -1, europeanPartners: 1 }),
  },
  "doubler-les-moyens-de-l-integration-francais": {
    adopt: consequence("Acheter des places supplémentaires de français et d'accompagnement vers l'emploi avec suivi des entrées et sorties.", after(3), ["Crédits et commande publique", "Égalité de traitement et non-discrimination", "RGPD pour le rapprochement avec l'emploi"], { employment: 2, publicServices: 3 }, { businesses: 3, localAuthorities: 3, lowIncomeHouseholds: 2 }),
    keep: consequence("Conserver les capacités de cours et d'orientation actuelles.", immediate, [], { employment: -1, publicServices: -2 }, { businesses: -2, localAuthorities: -2 }),
  },
  "supprimer-l-allocation-pour-demandeurs-d": {
    adopt: consequence("Supprimer l'allocation monétaire tout en fournissant les conditions matérielles d'accueil légalement obligatoires.", immediate, ["Directive européenne sur les conditions d'accueil", "Dignité et subsistance", "Protection de l'enfance", "Droits attachés à la procédure d'asile"], { publicServices: -4, institutionalTrust: -2 }, { lowIncomeHouseholds: -6, localAuthorities: -5 }),
    keep: consequence("Maintenir le montant, les critères et les sanctions actuels de l'allocation.", immediate, [], { publicServices: 2, institutionalTrust: 1 }, { lowIncomeHouseholds: 3, localAuthorities: 2 }),
  },
  "reserver-les-prestations-non-contributives-aux-nationaux": {
    adopt: consequence("Appliquer une condition de cinq ans de résidence régulière uniquement aux prestations pour lesquelles le droit supérieur le permet.", immediate, ["Égalité constitutionnelle des étrangers résidant durablement", "Libre circulation et coordination sociale européenne", "Égalité des réfugiés", "Dignité et non-discrimination"], { institutionalTrust: -6, reformCapacity: -3, opinion: 2 }, { lowIncomeHouseholds: -8, europeanPartners: -5, localAuthorities: -4 }, { uncertainty: "forte", scheduledEvents: [event("benefits-constitutional-review", "Le contrôle juridique réduit le périmètre", "Le juge écarte certaines catégories du dispositif et oblige l'administration à reprendre les dossiers concernés.", 2, "indicator", "institutionalTrust", -4)] }),
    keep: consequence("Maintenir les conditions de résidence et d'éligibilité propres à chaque prestation.", immediate, [], { institutionalTrust: 3, opinion: -1 }, { lowIncomeHouseholds: 4, europeanPartners: 3, localAuthorities: 2 }),
  },
  "quotas-annuels-d-immigration": {
    adopt: consequence("Faire voter des objectifs annuels indicatifs pour les admissions discrétionnaires de travail en excluant les admissions de droit.", year(3), ["Séparation des pouvoirs et examen individuel", "Convention de Genève", "Vie familiale CEDH", "Libre circulation et droit d'asile européen"], { reformCapacity: 3, opinion: 3, institutionalTrust: -1 }, { businesses: 2, europeanPartners: -2 }),
    keep: consequence("Maintenir les admissions par titre, motif et droit individuel.", immediate, [], { institutionalTrust: 2, reformCapacity: -1 }, { europeanPartners: 2, businesses: -1 }),
  },
  "peines-planchers-automatiques": {
    adopt: consequence("Instaurer une peine minimale avec possibilité de dérogation motivée par le juge.", immediate, ["Individualisation et proportionnalité des peines", "Indépendance judiciaire", "Procès équitable CEDH"], { opinion: 4, institutionalTrust: -3, publicServices: -4 }, { publicEmployees: -4 }),
    keep: consequence("Maintenir les fourchettes légales et l'individualisation par le juge.", immediate, [], { institutionalTrust: 2, publicServices: 1 }, { publicEmployees: 1 }),
  },
  "legaliser-et-taxer-le-cannabis": {
    adopt: consequence("Créer des licences de production et vente, une accise, un âge minimal, des plafonds de puissance et une traçabilité.", after(4), ["Conventions des Nations unies sur les stupéfiants", "Cadre européen de lutte contre le trafic", "Modifier les lois pénales, sanitaires et fiscales"], { reformCapacity: 4, publicServices: 2, opinion: -2 }, { businesses: 5, publicEmployees: 2 }),
    keep: consequence("Maintenir l'interdiction, les sanctions et les exceptions médicales actuelles.", immediate, [], { institutionalTrust: 1, reformCapacity: -2, publicServices: -1 }, { businesses: -3, publicEmployees: -2 }),
  },
};

const SOVEREIGNTY_AND_ENERGY: Record<string, Record<string, PolicyConsequence>> = {
  "porter-l-effort-de-defense-vers-3": {
    adopt: consequence("Ouvrir chaque année des crédits supplémentaires et accélérer commandes, stocks, recrutements et disponibilité prévus par la programmation militaire.", immediate, ["Loi de finances et programmation militaire", "Commande publique et contrats en cours"], { investment: 4, publicServices: 3, financialCredibility: -2 }, { businesses: 3, europeanPartners: 4, creditors: -2 }, { locks: ["etaler-la-marche-2026-de-la-programmation"] }),
    keep: consequence("Exécuter la trajectoire inférieure déjà votée sans ouvrir la marche supplémentaire.", immediate, ["Loi de finances et programmation militaire", "Commande publique et contrats en cours"], { financialCredibility: 1, investment: -2, publicServices: -2 }, { businesses: -1, europeanPartners: -2, creditors: 1 }),
  },
  "etaler-la-marche-2026-de-la-programmation": {
    adopt: consequence("Reprogrammer des commandes, stocks et recrutements au-delà du calendrier initial.", immediate, ["Loi de finances et programmation militaire", "Commande publique et contrats en cours"], { financialCredibility: 2, investment: -3, publicServices: -2 }, { businesses: -3, europeanPartners: -2, creditors: 2 }, { locks: ["porter-l-effort-de-defense-vers-3"] }),
    keep: consequence("Libérer les crédits au calendrier voté et exécuter les commandes prévues.", immediate, ["Loi de finances et programmation militaire", "Commande publique et contrats en cours"], { investment: 3, publicServices: 2, financialCredibility: -1 }, { businesses: 3, europeanPartners: 2, creditors: -1 }),
  },
  "doubler-la-reserve-operationnelle": {
    adopt: consequence("Signer davantage de contrats, former, équiper et convoquer les nouveaux réservistes.", after(2), ["Loi de finances et programmation militaire", "Statut, disponibilité et protection des réservistes"], { publicServices: 3, employment: 1 }, { businesses: -2, europeanPartners: 1 }),
    keep: consequence("Conserver le volume actuel de contrats et de journées de formation.", immediate, ["Loi de finances et programmation militaire", "Statut des réservistes"], { financialCredibility: 1, publicServices: -1 }, { businesses: 1 }),
  },
  "reduire-l-aide-publique-au-developpement-de": {
    adopt: consequence("Ne pas renouveler ou réduire les programmes bilatéraux et contributions modulables en honorant les conventions dues.", immediate, ["Engagements internationaux et conventions pluriannuelles d'aide"], { financialCredibility: 2 }, { europeanPartners: -4, creditors: 1 }),
    keep: consequence("Exécuter les programmes et contributions au niveau de référence.", immediate, ["Engagements internationaux et conventions pluriannuelles d'aide"], { financialCredibility: -1 }, { europeanPartners: 4, creditors: -1 }),
  },
  "service-militaire-volontaire-de-50-000": {
    adopt: consequence("Recruter des cohortes volontaires successives, construire l'encadrement et financer solde, formation et infrastructures.", after(3), ["Loi de finances et programmation militaire", "Volontariat, statut, droits et encadrement"], { publicServices: 4, employment: 1, reformCapacity: -2 }, { lowIncomeHouseholds: 2, businesses: -2, publicEmployees: 2 }, { locks: ["generaliser-le-service-national-universel"] }),
    keep: consequence("Concentrer les moyens sur les forces professionnelles et la réserve existante.", immediate, ["Loi de finances et programmation militaire", "Statut des réservistes"], { financialCredibility: 1, publicServices: -2 }, { businesses: 1, lowIncomeHouseholds: -1 }),
  },
  "doubler-les-moyens-du-renseignement-interieur": {
    adopt: consequence("Recruter des personnels habilités, acheter les systèmes nécessaires et renforcer simultanément les contrôles.", after(2), ["Crédits de la loi de finances", "Contrôle du renseignement, libertés fondamentales et données"], { publicServices: 4, institutionalTrust: -2 }, { publicEmployees: 2 }),
    keep: consequence("Poursuivre les recrutements et équipements déjà programmés sans doublement.", immediate, ["Contrôle du renseignement, libertés fondamentales et données"], { institutionalTrust: 1, publicServices: -2 }, { publicEmployees: -1 }),
  },
  "achats-militaires-europeens-prioritaires": {
    adopt: consequence("Inclure un critère européen juridiquement soutenable et accepter un surcoût ou délai lorsque l'autonomie stratégique le justifie.", after(2), ["Droit européen et national des achats de défense", "Sécurité d'approvisionnement et concurrence"], { investment: 5, publicServices: -1, financialCredibility: -1 }, { businesses: 4, europeanPartners: 4 }),
    keep: consequence("Attribuer chaque programme selon coût, délai, performance, sécurité et souveraineté sans préférence générale.", immediate, ["Droit européen et national des achats de défense"], { publicServices: 2, investment: -2 }, { businesses: -2, europeanPartners: -3 }),
  },
  "budget-europeen-de-defense": {
    adopt: consequence("Créer une ressource ou dette commune et attribuer les fonds à des programmes décidés collectivement, avec une économie nette française hypothétique de 2 000 millions d'euros.", after(3), ["Traités européens, ressources propres et contrôle budgétaire commun"], { financialCredibility: 3, reformCapacity: 2, publicServices: 2 }, { europeanPartners: 7, creditors: 1 }, { uncertainty: "forte", scheduledEvents: [event("eu-defense-veto", "Un partenaire retarde un programme commun", "Le partage des priorités retarde une capacité pourtant financée collectivement.", 3, "indicator", "reformCapacity", -3)] }),
    keep: consequence("Financer et arbitrer les capacités au niveau national.", immediate, ["Loi de finances et programmation militaire"], { reformCapacity: -2, financialCredibility: -1 }, { europeanPartners: -2, creditors: -1 }),
  },
  "sortir-de-l-euro": {
    adopt: consequence("Obtenir une base conventionnelle de retrait, voter la conversion, adapter banques et paiements puis laisser flotter la nouvelle monnaie.", after(1), ["Négociation européenne, continuité des contrats et protection des déposants"], { interestCost: { delta: 12_000, duration: "annual", explanation: "Le scénario retient une hausse annuelle de 12 000 millions d'euros de la charge d'intérêt." }, investment: -15, financialCredibility: -20, institutionalTrust: -8 }, { creditors: -20, europeanPartners: -15, businesses: -12, lowIncomeHouseholds: -8 }, { budgetDuration: "once", uncertainty: "forte", scheduledEvents: [event("currency-conversion", "La conversion perturbe les paiements", "Les banques limitent temporairement certains mouvements et les importations renchérissent.", 1, "indicator", "institutionalTrust", -10)] }),
    keep: consequence("Conserver la dénomination des contrats, les circuits Eurosystème et la politique monétaire de la BCE.", immediate, ["Cadre de l'Union économique et monétaire"], { financialCredibility: 3, investment: 2, institutionalTrust: 1 }, { creditors: 3, europeanPartners: 3, businesses: 2, lowIncomeHouseholds: 1 }),
  },
  "referendum-sur-la-sortie-de-l-ue": {
    adopt: consequence("Adopter la base du scrutin et ouvrir la campagne sans simuler à l'avance le résultat du vote.", immediate, ["Base constitutionnelle du référendum", "Organisation du scrutin", "La procédure de retrait ne commence qu'après un éventuel vote favorable"], { opinion: 4, financialCredibility: -10, institutionalTrust: -3 }, { businesses: -8, europeanPartners: -12 }, { budgetDuration: "once", uncertainty: "forte", scheduledEvents: [event("eu-referendum-market", "Les investissements attendent le vote", "Plusieurs décisions industrielles sont suspendues jusqu'au résultat et à ses suites.", 2, "indicator", "investment", -8)] }),
    keep: consequence("Ne pas ouvrir de procédure référendaire ou de retrait pendant le mandat.", immediate, [], { financialCredibility: 2, reformCapacity: 1 }, { europeanPartners: 3, businesses: 2 }),
  },
  "creer-une-armee-europeenne": {
    adopt: consequence("Conclure un accord de commandement commun et désigner les unités intégrées, avec une économie nette française hypothétique de 3 000 millions d'euros.", after(4), ["Traités, contrôle démocratique et règles nationales d'engagement des forces"], { reformCapacity: 5, publicServices: 4, financialCredibility: 2 }, { europeanPartners: 10, publicEmployees: 2 }, { uncertainty: "forte" }),
    keep: consequence("Maintenir le commandement national tout en poursuivant les coopérations et forces multinationales existantes.", immediate, ["Règles nationales et engagements internationaux des forces"], { publicServices: 2, reformCapacity: -2 }, { europeanPartners: -2, publicEmployees: 1 }),
  },
  "nationaliser-les-entreprises-strategiques": {
    adopt: consequence("Voter le périmètre, valoriser les titres, indemniser les actionnaires et transférer le contrôle à l'État.", after(3), ["Loi de nationalisation", "Juste indemnisation", "Droit européen de la concurrence et aides d'État"], { investment: -5, financialCredibility: -8, reformCapacity: -4 }, { businesses: -10, creditors: -5, publicEmployees: 3 }, { budgetDuration: "once", uncertainty: "forte" }),
    keep: consequence("Exercer les droits actionnariaux existants sans acquérir de nouveaux blocs.", immediate, ["Droit des participations publiques"], { financialCredibility: 2, investment: 1 }, { businesses: 3, creditors: 2 }),
  },
  "doubler-maprimerenov": {
    adopt: consequence("Augmenter l'enveloppe de rénovation, ouvrir davantage de dossiers et renforcer simultanément artisans agréés et contrôles.", after(2), ["Loi de finances", "Règles d'attribution, contrôle et lutte contre la fraude"], { investment: 5, publicServices: 1 }, { businesses: 3, lowIncomeHouseholds: 3, localAuthorities: 1 }),
    keep: consequence("Conserver les critères, plafonds et rythme de traitement actuels.", immediate, ["Règles existantes du dispositif"], { financialCredibility: 1, investment: -2 }, { businesses: -2, lowIncomeHouseholds: -2 }),
  },
  "plan-ferroviaire-3-000-m-de-plus": {
    adopt: consequence("Contractualiser le renouvellement du réseau avant de lancer les chantiers de capacité.", after(3), ["Loi de finances", "Contrats de performance, commande publique et règles ferroviaires"], { investment: 6, publicServices: 5 }, { businesses: 2, localAuthorities: 5 }),
    keep: consequence("Prioriser les renouvellements dans l'enveloppe existante.", immediate, ["Contrats et règles ferroviaires existants"], { financialCredibility: 1, publicServices: -3, investment: -2 }, { businesses: -1, localAuthorities: -3 }),
  },
  "supprimer-le-bonus-automobile-electrique": {
    adopt: consequence("Fermer les nouvelles attributions du bonus tout en honorant les dossiers acquis.", immediate, ["Loi de finances", "Droits acquis et règles de l'aide automobile"], { investment: -3, opinion: -2 }, { businesses: -3, lowIncomeHouseholds: -3, middleClasses: -2 }),
    keep: consequence("Poursuivre le barème et les attributions au niveau de référence.", immediate, ["Règles de l'aide automobile"], { investment: 2, opinion: 1 }, { businesses: 2, lowIncomeHouseholds: 2, middleClasses: 1 }),
  },
  "relancer-le-leasing-social-de-vehicules-electriques": {
    adopt: consequence("Ouvrir une fenêtre plafonnée de demandes et subventionner chaque contrat selon des critères sociaux et automobiles.", after(1), ["Loi de finances", "Règles de l'aide automobile et commande des véhicules"], { investment: 2, opinion: 3 }, { lowIncomeHouseholds: 6, businesses: 2 }),
    keep: consequence("Ne pas ouvrir de nouvelle fenêtre de contrats.", immediate, ["Règles de l'aide automobile"], { financialCredibility: 1, investment: -1 }, { lowIncomeHouseholds: -3, businesses: -1 }),
  },
  "engager-six-epr2-part-annuelle-de-l": {
    six: consequence("Commander et financer le premier programme, les études, sites et capacités industrielles sans promettre de production nouvelle pendant le mandat.", after(3), ["Loi de finances", "Autorisations nucléaires, sûreté, sites et commande"], { investment: 5, publicServices: 2, financialCredibility: -2 }, { businesses: 4, localAuthorities: 1 }, { locks: ["sortie-du-nucleaire-en-2040"], uncertainty: "forte" }),
    fourteen: consequence("Commander le programme maximal et financer une extension plus forte de la chaîne industrielle sans promettre de production nouvelle pendant le mandat.", after(3), ["Loi de finances", "Autorisations nucléaires, sûreté, sites et commande"], { investment: 8, publicServices: 3, financialCredibility: -4, reformCapacity: -3 }, { businesses: 6, localAuthorities: 2 }, { locks: ["sortie-du-nucleaire-en-2040"], uncertainty: "forte", scheduledEvents: [event("epr-supply-chain", "La chaîne industrielle sature", "Les carnets de commandes dépassent les capacités disponibles et le calendrier glisse.", 3, "indicator", "financialCredibility", -4)] }),
    none: consequence("Ne prendre aucun engagement de construction tout en exploitant le parc existant sous contrôle de sûreté.", immediate, ["Contrôle de sûreté et programmation du parc existant"], { financialCredibility: 1, reformCapacity: 2, investment: -4 }, { businesses: -3, localAuthorities: -1 }),
  },
  "retablir-une-trajectoire-carbone-recettes-redistribuees": {
    adopt: consequence("Relever les composantes fossiles puis verser un remboursement progressif séparé; les 4 000 millions d'euros sont une recette brute avant redistribution.", immediate, ["Loi de finances", "Assiette carbone et barème de remboursement", "Égalité et articulation européenne"], { investment: 3, institutionalTrust: -2 }, { lowIncomeHouseholds: 2, middleClasses: -3, businesses: -3, localAuthorities: -2 }, { uncertainty: "forte", scheduledEvents: [event("carbon-rural-revolt", "La facture précède le remboursement", "Les ménages dépendants de la voiture voient la hausse avant le versement et la contestation s'étend.", 1, "indicator", "opinion", -6)] }),
    keep: consequence("Geler la composante carbone supplémentaire et ne créer aucun nouveau remboursement.", immediate, ["Règles fiscales carbone existantes"], { opinion: 2, investment: -2 }, { middleClasses: 2, businesses: 2, localAuthorities: 1 }),
  },
  "renforcer-la-taxe-sur-les-billets-d": {
    adopt: consequence("Relever le tarif de la taxe passager à l'émission du billet sans prétendre taxer directement le carburant.", immediate, ["Loi de finances", "Droit européen et conventions applicables au transport aérien"], { employment: -1, investment: -1 }, { businesses: -2, middleClasses: -2, localAuthorities: -1 }),
    keep: consequence("Conserver le tarif et l'assiette existants.", immediate, ["Règles existantes de la taxe aérienne"], { investment: 1, opinion: 1 }, { businesses: 2, middleClasses: 1, localAuthorities: 1 }),
  },
  "doubler-le-soutien-a-l-agriculture-bio": {
    adopt: consequence("Augmenter le nombre ou le montant des contrats éligibles au bio et aux haies avec les contrôles agricoles correspondants.", after(2), ["Loi de finances", "Plan stratégique de la politique agricole commune et contrôles"], { investment: 2, publicServices: 2 }, { farmers: 5, localAuthorities: 2, businesses: 1 }),
    keep: consequence("Maintenir l'enveloppe et les règles actuelles.", immediate, ["Règles agricoles existantes"], { financialCredibility: 1, investment: -1 }, { farmers: -3, localAuthorities: -1, businesses: -1 }),
  },
  "sortie-du-nucleaire-en-2040": {
    adopt: consequence("Voter une programmation de fermeture conditionnée à la mise en service préalable des productions, réseaux, stockages et flexibilités de remplacement.", after(4), ["Loi de finances", "Programmation du parc nucléaire", "Autorisations et développement des capacités de remplacement"], { investment: 8, financialCredibility: -7, publicServices: -4 }, { businesses: -6, localAuthorities: 2 }, { locks: ["engager-six-epr2-part-annuelle-de-l", "moratoire-sur-les-renouvelables"], uncertainty: "forte", scheduledEvents: [event("winter-capacity-gap", "Un hiver met les capacités sous tension", "Le retard des réseaux et du stockage réduit la marge disponible pendant un hiver de forte demande.", 4, "indicator", "publicServices", -8)] }),
    keep: consequence("Prolonger ou renouveler les capacités uniquement après les contrôles de sûreté et selon les besoins du réseau.", immediate, ["Contrôle de sûreté et programmation du parc"], { publicServices: 3, financialCredibility: 2, investment: 2 }, { businesses: 3, localAuthorities: 1 }),
  },
  "moratoire-sur-les-renouvelables": {
    adopt: consequence("Arrêter prospectivement les nouveaux appels d'offres et permis sans annuler les droits et contrats acquis.", immediate, ["Droits acquis, contrats et autorisations renouvelables"], { investment: -8, publicServices: -5, opinion: 3 }, { businesses: -5, localAuthorities: -3 }, { locks: ["sortie-du-nucleaire-en-2040"], uncertainty: "forte" }),
    keep: consequence("Continuer les appels d'offres et autorisations locales et environnementales.", immediate, ["Règles d'autorisation des renouvelables"], { investment: 3, publicServices: 2, opinion: -1 }, { businesses: 3, localAuthorities: 2 }),
  },
  "interdire-les-voitures-thermiques-en-2030": {
    adopt: consequence("Notifier et voter une restriction nationale sur les ventes neuves puis financer bornes, adaptation industrielle et compensations ciblées.", after(2), ["Loi de finances", "Règlement européen sur les émissions et réception des véhicules", "Libre circulation, notification et proportionnalité"], { investment: 6, employment: -3, opinion: -7 }, { businesses: -4, lowIncomeHouseholds: -5, middleClasses: -4 }, { uncertainty: "forte" }),
    keep: consequence("Maintenir l'adaptation industrielle sur l'horizon européen 2035.", immediate, ["Cadre européen des émissions des véhicules"], { opinion: 2, investment: -2 }, { businesses: 3, lowIncomeHouseholds: 2, middleClasses: 2 }),
  },
  "nationaliser-les-autoroutes": {
    adopt: consequence("Résilier ou racheter les conventions, indemniser les concessionnaires et transférer péages, dette et entretien à un opérateur public.", after(3), ["Loi de finances", "Code de la commande publique", "Conventions, indemnisation et droit européen des concessions"], { financialCredibility: -4, investment: -2, opinion: 5, reformCapacity: -3 }, { businesses: -5, creditors: -2 }, { budgetDuration: "once", uncertainty: "forte" }),
    keep: consequence("Laisser courir les contrats, contrôler leur exécution et préparer la remise des actifs à l'échéance.", immediate, ["Conventions de concession et contrôle de leur exécution"], { financialCredibility: 1, institutionalTrust: 1 }, { businesses: 2, creditors: 1 }),
  },
};

const EDUCATION_AND_STATE: Record<string, Record<string, PolicyConsequence>> = {
  "revaloriser-les-enseignants-de-5": {
    adopt: consequence("Relever de 5 % la rémunération de tous les enseignants; l'effet de fidélisation apparaît après les premières affectations.", after(2), ["Décrets indiciaires ou indemnitaires", "Crédits annuels en loi de finances", "Dialogue social", "Régime du privé sous contrat"], { publicServices: 3, institutionalTrust: 2 }, { publicEmployees: 7, unions: 3 }),
    keep: consequence("Maintenir la grille; les difficultés de recrutement et d'affectation restent sans réponse salariale générale.", after(2), [], { publicServices: -2 }, { publicEmployees: -3, unions: -2 }),
  },
  "etendre-le-dedoublement-des-classes-au-cm1": {
    adopt: consequence("Affecter des postes et salles supplémentaires aux CM1 et CM2 de l'éducation prioritaire par vagues territoriales.", after(3), ["Ouvrir emplois et crédits", "Adapter carte scolaire et affectations", "Disposer de locaux communaux conformes"], { publicServices: 5 }, { publicEmployees: 2, localAuthorities: -2 }),
    keep: consequence("Conserver le dédoublement aux niveaux actuels et éviter de nouvelles contraintes immobilières.", after(3), [], { publicServices: -2 }, { localAuthorities: 1 }),
  },
  "recentrer-le-pass-culture": {
    adopt: consequence("Réduire les crédits individuels et réserver l'économie à des actions collectives ou des publics ciblés.", immediate, ["Modifier éligibilité, plafonds et conditions d'utilisation", "Ajuster crédits et conventions de mise en œuvre"], { publicServices: 2, opinion: -2 }, { businesses: -2 }),
    keep: consequence("Maintenir le crédit individuel et la liberté d'achat sans ciblage supplémentaire.", immediate, [], { publicServices: -1, opinion: 1 }, { businesses: 1 }),
  },
  "doubler-les-bourses-etudiantes-sur-criteres": {
    adopt: consequence("Doubler chaque échelon du barème social sans modifier les seuils d'entrée.", immediate, ["Modifier le barème réglementaire", "Ouvrir les crédits", "Traiter effets de seuil et égalité"], { publicServices: 4 }, { lowIncomeHouseholds: 8 }),
    keep: consequence("Maintenir les montants et seuils; la contrainte financière de poursuite des études persiste.", after(2), [], { publicServices: -2 }, { lowIncomeHouseholds: -4 }),
  },
  "financer-100-000-logements-sociaux-de-plus": {
    adopt: consequence("Ouvrir les aides à la pierre et l'avantage de TVA pour 100 000 agréments annuels supplémentaires; les livraisons restent conditionnées au foncier et aux chantiers.", year(5), ["Voter crédits et avantages en loi de finances", "Urbanisme, permis et foncier", "Financement du logement social et commande publique"], { investment: 7, employment: 2 }, { lowIncomeHouseholds: 4, businesses: 4, localAuthorities: -2 }, { uncertainty: "forte", scheduledEvents: [event("social-housing-delivery-gap", "Les agréments ne deviennent pas tous des logements", "Le foncier, les permis et les capacités de chantier retardent une partie des livraisons attendues.", 4, "indicator", "investment", -3)] }),
    keep: consequence("Maintenir les agréments actuels et éviter la charge locale supplémentaire tout en laissant la production sous la cible.", year(5), [], { investment: -3 }, { lowIncomeHouseholds: -3, businesses: -2, localAuthorities: 1 }),
  },
  "revaloriser-les-apl-de-5": {
    adopt: consequence("Augmenter de 5 % le barème versé aux bénéficiaires existants avant toute réaction des loyers.", immediate, ["Modifier le barème réglementaire", "Ouvrir les crédits nécessaires"], { institutionalTrust: 2 }, { lowIncomeHouseholds: 6, middleClasses: 1 }, { scheduledEvents: [event("housing-rent-capture", "Une partie de la hausse est absorbée par les loyers", "Dans les zones tendues, la faible offre permet à certains nouveaux loyers d'absorber une partie du gain versé.", 3, "group", "lowIncomeHouseholds", -2)] }),
    keep: consequence("Maintenir le barème; l'aide perd du terrain pour les ménages dont le loyer progresse.", after(2), [], { institutionalTrust: -1 }, { lowIncomeHouseholds: -3 }),
  },
  "ouvrir-200-000-places-de-creche": {
    adopt: consequence("Programmer locaux et fonctionnement avec les caisses et collectivités, sous condition de recrutement de professionnels qualifiés.", after(4), ["Autorisations d'ouverture et ratios d'encadrement", "Conventions et cofinancements locaux", "Qualification, sécurité et commande publique"], { employment: 4, publicServices: 5 }, { lowIncomeHouseholds: 3, businesses: 3, localAuthorities: -3 }, { uncertainty: "forte", scheduledEvents: [event("childcare-staff-shortage", "Les recrutements limitent les ouvertures", "Des locaux sont disponibles, mais le manque de professionnels retarde une partie des places annoncées.", 3, "indicator", "publicServices", -3)] }),
    keep: consequence("Maintenir la trajectoire actuelle; les files d'attente continuent de limiter l'activité de certains parents.", after(4), [], { employment: -2, publicServices: -3 }, { lowIncomeHouseholds: -2, businesses: -1, localAuthorities: 1 }),
  },
  "allocations-familiales-des-le-premier-enfant": {
    adopt: consequence("Ouvrir le même droit de base aux familles d'un enfant sous le régime de modulation retenu.", immediate, ["Modifier le Code de la sécurité sociale", "Financement en loi de financement", "Définir modulation et effets de seuil"], { institutionalTrust: 2 }, { lowIncomeHouseholds: 4, middleClasses: 3 }),
    keep: consequence("Maintenir l'ouverture au deuxième enfant; les familles d'un enfant restent hors de cette prestation.", immediate, [], { institutionalTrust: -1 }, { lowIncomeHouseholds: -2, middleClasses: -1 }),
  },
  "cheque-education-par-eleve": {
    adopt: consequence("Faire suivre à l'inscription une dotation nationale par élève vers l'établissement public ou privé choisi.", after(3), ["Modifier le Code de l'éducation et le financement", "Égalité, laïcité et liberté d'enseignement", "Obligations scolaires et immobilières locales", "Conditions d'aide au privé"], { reformCapacity: 5, institutionalTrust: -5, publicServices: -3 }, { publicEmployees: -5, localAuthorities: -4 }, { locks: ["supprimer-le-financement-public-du-prive"], uncertainty: "forte", scheduledEvents: [event("school-closures", "Le maillage scolaire se rétracte", "Des établissements perdent assez d'élèves et de dotations pour menacer la continuité scolaire dans des territoires fragiles.", 3, "indicator", "publicServices", -5)] }),
    keep: consequence("Conserver une allocation par réseau, territoire et besoins des élèves, indépendante des seuls flux d'inscription.", immediate, [], { institutionalTrust: 2, publicServices: 2 }, { publicEmployees: 2, localAuthorities: 2 }),
  },
  "supprimer-le-financement-public-du-prive": {
    adopt: consequence("Résilier progressivement les contrats et accueillir dans le public les élèves transférés; l'économie brute dépend de la capacité d'accueil.", after(2), ["Modifier les dispositions L442 du Code de l'éducation", "Traiter contrats et droits des personnels", "Garantir liberté d'enseignement et continuité", "Financer locaux et accueil publics"], { reformCapacity: -5, institutionalTrust: -3, publicServices: -4 }, { localAuthorities: -5, publicEmployees: -2 }, { locks: ["cheque-education-par-eleve"], uncertainty: "forte", scheduledEvents: [event("private-school-transfer-capacity", "Les transferts saturent une partie du public", "Les établissements publics d'accueil manquent temporairement de salles et de personnels dans plusieurs territoires.", 2, "indicator", "publicServices", -3)] }),
    keep: consequence("Maintenir rémunération publique et forfaits en contrepartie des obligations du contrat.", immediate, [], { publicServices: 2, institutionalTrust: 1 }, { localAuthorities: 2, publicEmployees: 1 }),
  },
  "generaliser-le-service-national-universel": {
    adopt: consequence("Créer une obligation pour toute la classe d'âge avec exemptions, séjour, mission, hébergement et encadrement nationaux.", after(4), ["Voter une loi sur obligation, exemptions, recours et sanctions", "Droits et sécurité des mineurs", "Crédits et marchés d'hébergement et transport"], { reformCapacity: -5, institutionalTrust: -2 }, { publicEmployees: -3 }, { locks: ["service-militaire-volontaire-de-50-000"], uncertainty: "forte", scheduledEvents: [event("snu-capacity-overload", "L'hébergement et l'encadrement saturent", "Le changement d'échelle dépasse temporairement les capacités d'accueil et de supervision disponibles.", 3, "indicator", "reformCapacity", -3)] }),
    keep: consequence("Maintenir le volontariat et la capacité d'accueil actuelle.", immediate, [], { reformCapacity: 1, institutionalTrust: 1 }, { publicEmployees: 1 }),
  },
  "autonomie-complete-des-etablissements": {
    adopt: consequence("Transférer le recrutement et l'enveloppe indemnitaire aux établissements dans une enveloppe fermée.", after(3), ["Modifier Code de l'éducation et statuts", "Fonction publique, égalité et non-discrimination", "Dialogue social et recours"], { reformCapacity: 7, publicServices: -3, institutionalTrust: -3 }, { publicEmployees: -8, unions: -9 }, { uncertainty: "forte", scheduledEvents: [event("teacher-market", "Les écarts de recrutement se creusent", "Les établissements difficiles doivent payer davantage sans toujours disposer de la même enveloppe.", 3, "indicator", "publicServices", -6)] }),
    keep: consequence("Maintenir corps, affectations et rémunérations nationaux avec des marges locales limitées.", immediate, [], { publicServices: 2, reformCapacity: -2 }, { publicEmployees: 4, unions: 3 }),
  },
  "geler-le-point-d-indice-en-2026": {
    adopt: consequence("Maintenir la valeur du point pendant l'année; la rétention se dégrade lors des recrutements suivants.", after(2), ["Fixer la valeur du point", "Traduire l'effet dans les budgets publics", "Dialogue social", "Autonomie des employeurs territoriaux"], { publicServices: -3, institutionalTrust: -2 }, { publicEmployees: -8, localAuthorities: 2 }),
    keep: consequence("Revaloriser selon la trajectoire retenue et financer la hausse chez les employeurs publics.", immediate, [], { publicServices: 2, institutionalTrust: 1 }, { publicEmployees: 5, localAuthorities: -1 }),
  },
  "deux-jours-de-carence-dans-la-fonction": {
    adopt: consequence("Porter à deux jours la retenue non indemnisée au début de l'arrêt avec les exceptions légales.", immediate, ["Modifier le régime de rémunération pendant l'arrêt", "Définir les exceptions médicales et maternité", "Dialogue social"], { publicServices: -2, institutionalTrust: -2 }, { publicEmployees: -6, unions: -4 }),
    keep: consequence("Maintenir un jour de carence et les exceptions actuelles.", immediate, [], { publicServices: 1, institutionalTrust: 1 }, { publicEmployees: 3, unions: 2 }),
  },
  "ne-pas-remplacer-un-depart-administratif-sur": {
    adopt: consequence("Supprimer un poste support sur trois au départ, hors enseignants et soignants; les tâches maintenues créent des files de traitement.", after(3), ["Plafonds d'emplois en loi de finances", "Droits statutaires et mobilités", "Ne pas étendre automatiquement aux employeurs autonomes"], { publicServices: -5, reformCapacity: -2 }, { publicEmployees: -5 }, { scheduledEvents: [event("administrative-backlog", "Les dossiers s'accumulent", "Les tâches non supprimées se reportent sur moins d'agents et les délais de traitement augmentent.", 3, "indicator", "institutionalTrust", -3)] }),
    keep: consequence("Arbitrer chaque remplacement selon la charge et préserver la capacité de traitement.", after(3), [], { publicServices: 2, reformCapacity: -1 }, { publicEmployees: 2 }),
  },
  "fermer-un-tiers-des-agences-et-operateurs": {
    adopt: consequence("Identifier les structures, supprimer ou transférer chaque mission puis reprendre contrats, dettes et agents.", after(2), ["Acte adapté au texte de création", "Transférer actifs, passifs, contrats et contentieux", "Droits des agents et continuité"], { reformCapacity: 3, publicServices: -5 }, { publicEmployees: -6 }, { uncertainty: "forte", scheduledEvents: [event("agency-mission-transfer", "Les missions changent d'adresse sans disparaître", "Plusieurs fonctions sont reprises par les ministères avec des coûts de transition et des délais pour les usagers.", 2, "indicator", "institutionalTrust", -3)] }),
    keep: consequence("Conserver les opérateurs et poursuivre les revues structure par structure.", immediate, [], { publicServices: 2, reformCapacity: -2 }, { publicEmployees: 2 }),
  },
  "diviser-par-deux-le-nombre-de-parlementaires": {
    adopt: consequence("Réviser la Constitution et les lois électorales, redécouper les sièges et réduire les effectifs des commissions.", year(5), ["Révision constitutionnelle et lois organiques", "Lois électorales et redécoupage", "Égalité du suffrage et représentation territoriale"], { institutionalTrust: -3, reformCapacity: -2, opinion: 3 }, { localAuthorities: -4, parliamentaryMajority: -3 }),
    keep: consequence("Maintenir les effectifs, commissions et représentation territoriale actuels.", immediate, [], { institutionalTrust: 2, reformCapacity: 2 }, { localAuthorities: 2, parliamentaryMajority: 2 }),
  },
  "supprimer-le-cese": {
    adopt: consequence("Abroger les dispositions constitutionnelles du CESE et transférer ou supprimer les consultations qui lui sont confiées.", year(5), ["Réviser les articles 69 à 71 de la Constitution", "Modifier les consultations légales", "Régler agents, biens, archives et saisines"], { institutionalTrust: -2, reformCapacity: 1 }, { unions: -3, businesses: -1 }),
    keep: consequence("Maintenir la voie consultative constitutionnelle et ses saisines.", immediate, [], { institutionalTrust: 1, reformCapacity: -1 }, { unions: 2, businesses: 1 }),
  },
  "ceder-des-participations-non-strategiques-de-l": {
    adopt: consequence("Vendre un portefeuille défini, affecter 2 000 millions d'euros au désendettement et renoncer aux dividendes futurs.", immediate, ["Autorisation législative si nécessaire", "Contraintes des services publics ou monopoles", "Valorisation, gouvernance et information des marchés"], { financialCredibility: 2, institutionalTrust: -1 }, { creditors: 2 }, { budgetDuration: "once", uncertainty: "forte" }),
    keep: consequence("Conserver les actifs, le contrôle, les risques et les dividendes futurs.", immediate, [], { institutionalTrust: 1 }, { creditors: -1 }),
  },
  "reduire-de-5-les-dotations-aux-collectivites": {
    adopt: consequence("Réduire les concours en loi de finances; les exécutifs locaux arbitrent ensuite entre investissement, service et recettes.", after(3), ["Voter la baisse en loi de finances", "Libre administration et autonomie financière", "Compensation des compétences transférées"], { investment: -2, publicServices: -3 }, { localAuthorities: -9, businesses: -3 }, { scheduledEvents: [event("local-investment-cut", "L'investissement local devient la variable d'ajustement", "Une partie des collectivités concentre la baisse sur les chantiers et commandes locales plutôt que sur les services courants.", 3, "indicator", "investment", -3)] }),
    keep: consequence("Maintenir les concours et les programmes locaux déjà financés.", immediate, [], { investment: 2, publicServices: 2 }, { localAuthorities: 4, businesses: 1 }),
  },
  "regle-d-or-constitutionnelle": {
    adopt: consequence("Inscrire une règle chiffrée, une méthode de calcul, des clauses d'exception et une procédure de correction opposable aux budgets futurs.", after(3), ["Révision constitutionnelle", "Définir solde, méthode et exceptions", "Articuler les règles européennes", "Désigner le contrôle et les conséquences"], { financialCredibility: 8, reformCapacity: -6 }, { creditors: 7, parliamentaryMajority: -6 }, { uncertainty: "forte", scheduledEvents: [event("golden-rule-recession", "Un ralentissement met la règle à l'épreuve", "Dans ce stress de scénario, la baisse des recettes force une correction procyclique faute de clause d'exception suffisante.", 3, "indicator", "growth", -0.35)] }),
    keep: consequence("Maintenir les règles européennes et législatives avec une marge contracyclique plus large.", immediate, [], { reformCapacity: 3, financialCredibility: -1 }, { parliamentaryMajority: 3, creditors: -1 }),
  },
  "supprimer-le-senat": {
    adopt: consequence("Passer au monocamérisme et transférer toutes les fonctions législatives à l'Assemblée nationale.", year(5), ["Révision constitutionnelle", "Adoption en termes identiques par le Sénat", "Réattribuer contrôle, nominations et représentation", "Organiser la transition"], { reformCapacity: 3, institutionalTrust: -6 }, { localAuthorities: -9, parliamentaryMajority: 3 }, { uncertainty: "forte" }),
    keep: consequence("Maintenir la seconde lecture et la représentation constitutionnelle des collectivités.", immediate, [], { institutionalTrust: 3, reformCapacity: -2 }, { localAuthorities: 5, parliamentaryMajority: -2 }),
  },
  "supprimer-les-departements": {
    adopt: consequence("Transférer bloc par bloc prestations sociales, collèges, routes, agents, dette et systèmes d'information.", after(3), ["Réviser ou appliquer l'article 72", "Lois de transfert des compétences, ressources et personnels", "Compensation et continuité des droits sociaux", "Traiter les statuts ultramarins"], {
      reformCapacity: { delta: 5, timing: immediate },
      publicServices: { delta: -6, timing: immediate },
      institutionalTrust: { delta: -6, timing: immediate, explanation: "Le catalogue place ce dossier trop tard pour matérialiser le stress de transfert à trois décisions; le score enregistre donc prudemment ce risque dès le choix." },
    }, {
      localAuthorities: { delta: -9, timing: immediate },
      publicEmployees: { delta: -5, timing: immediate },
    }, { uncertainty: "forte" }),
    keep: consequence("Maintenir l'échelon et ses compétences de proximité avec les doublons identifiés.", immediate, [], { publicServices: 3, reformCapacity: -2 }, { localAuthorities: 5, publicEmployees: 3 }),
  },
  "proportionnelle-integrale": {
    adopt: consequence("Élire la prochaine Assemblée sur des listes proportionnelles nationales avec seuil et règles de répartition explicites.", year(5), ["Loi électorale et dispositions organiques", "Définir seuil, listes et répartition", "Égalité du suffrage, pluralisme et parité", "Application à la prochaine élection"], { institutionalTrust: 5, majority: -10, reformCapacity: -4 }, { parliamentaryMajority: -8 }),
    keep: consequence("Conserver les circonscriptions et le scrutin majoritaire à la prochaine élection.", year(5), [], { majority: 4, institutionalTrust: -2 }, { parliamentaryMajority: 5 }),
  },
};

export const POLICY_CONSEQUENCES: Readonly<Record<string, Readonly<Record<string, PolicyConsequence>>>> = Object.freeze({
  ...TAX_AND_WORK,
  ...HEALTH_AND_SECURITY,
  ...SOVEREIGNTY_AND_ENERGY,
  ...EDUCATION_AND_STATE,
});

export function policyConsequence(decisionId: string, optionId: string): PolicyConsequence {
  const consequenceDefinition = POLICY_CONSEQUENCES[decisionId]?.[optionId];
  if (!consequenceDefinition) throw new Error(`Conséquence explicite absente : ${decisionId}:${optionId}`);
  return consequenceDefinition;
}
