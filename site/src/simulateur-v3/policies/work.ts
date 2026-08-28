import { delayedEvent, existingPolicy, policyDecision, standalonePolicy, type ExistingPolicyCopy } from "../policy-catalogue.ts";

const CHAPTER = "work-wages-pensions";
const p = (copy: Omit<ExistingPolicyCopy, "chapterId">) => existingPolicy({ ...copy, chapterId: CHAPTER });
const retirementPaths = ["repousser-l-age-legal-a-65-ans", "revenir-a-62-ans", "ouvrir-un-etage-de-capitalisation-collective"];

export const WORK_DECISIONS = [
  p({
    id: "fiscaliser-les-heures-supplementaires-comme-le", kind: "gestion",
    title: "Faut-il fiscaliser les heures supplémentaires comme le salaire ?",
    context: "L'exonération augmente le revenu net des salariés qui font des heures supplémentaires. La supprimer restaure l'assiette de l'impôt, mais réduit ce gain immédiat.",
    adoptLabel: "Fiscaliser les heures supplémentaires", adoptSummary: "Les heures supplémentaires entrent dans l'impôt et rapportent davantage au budget.",
    keepLabel: "Maintenir l'exonération", keepSummary: "Le supplément de revenu reste défiscalisé et l'État conserve la dépense fiscale.",
    beneficiaries: ["finances publiques"], contributors: ["salariés effectuant des heures supplémentaires"], sourceKeys: ["budget-niches-2026"],
  }),
  p({
    id: "supprimer-les-allegements-de-cotisations-entre-2", kind: "gestion",
    title: "Faut-il supprimer les allègements au-dessus de 2,5 SMIC ?",
    context: "Les allègements réduisent le coût du travail. Leur effet sur l'emploi est mieux établi près du SMIC et plus discuté pour les salaires élevés.",
    adoptLabel: "Supprimer les allègements supérieurs", adoptSummary: "Les entreprises cotisent davantage sur les hauts salaires et le budget social récupère une recette.",
    keepLabel: "Conserver les allègements", keepSummary: "Le coût du travail reste inchangé pour les entreprises, sans économie budgétaire.",
    beneficiaries: ["finances sociales"], contributors: ["employeurs de salariés au-dessus de 2,5 SMIC"], sourceKeys: ["cour-securite-sociale-2025"],
  }),
  p({
    id: "raboter-de-5-les-subventions-directes-aux", kind: "gestion",
    title: "Faut-il réduire de 5 % les subventions directes aux entreprises ?",
    context: "Les aides couvrent des objectifs très différents. Une coupe uniforme économise vite, mais frappe aussi des dispositifs territoriaux ou industriels jugés prioritaires.",
    adoptLabel: "Réduire toutes les aides de 5 %", adoptSummary: "Le budget économise immédiatement et chaque dispositif absorbe la même coupe.",
    keepLabel: "Conserver les aides", keepSummary: "Les entreprises aidées gardent leur soutien et l'État ne dégage aucune économie.",
    beneficiaries: ["finances publiques"], contributors: ["entreprises subventionnées", "territoires industriels"], sourceKeys: ["budget-niches-2026", "cour-finances-2025"],
  }),
  p({
    id: "raboter-le-credit-d-impot-recherche-de", kind: "gestion",
    title: "Faut-il réduire de 10 % le crédit d'impôt recherche ?",
    context: "Le crédit d'impôt soutient la recherche privée, mais son efficacité varie selon la taille des entreprises et la nature des projets.",
    adoptLabel: "Réduire le crédit d'impôt", adoptSummary: "Les grands bénéficiaires perdent une partie de l'aide et le budget récupère la dépense fiscale.",
    keepLabel: "Maintenir le crédit d'impôt", keepSummary: "La stabilité du soutien à la recherche privée est préservée, sans économie.",
    beneficiaries: ["finances publiques"], contributors: ["grandes entreprises de recherche"], sourceKeys: ["budget-niches-2026"],
  }),
  p({
    id: "repousser-l-age-legal-a-65-ans", kind: "transformation",
    title: "Faut-il porter l'âge légal de départ à 65 ans ?",
    context: "Le système gagne des cotisations et verse certaines pensions plus tard. L'effort se concentre sur les actifs qui ne peuvent pas partir avant l'âge légal.",
    adoptLabel: "Porter l'âge légal à 65 ans", adoptSummary: "L'équilibre des retraites s'améliore à terme et les actifs concernés travaillent plus longtemps.",
    keepLabel: "Ne pas aller jusqu'à 65 ans", keepSummary: "L'âge actuel est conservé et le besoin de financement reste plus élevé.",
    beneficiaries: ["finances sociales", "cotisants futurs"], contributors: ["actifs proches de la retraite"], sourceKeys: ["cor-2025"], conflicts: retirementPaths,
    event: delayedEvent("senior-employment-test", "L'emploi des seniors devient le juge de paix", "Les économies attendues baissent car une partie des seniors bascule vers le chômage ou l'invalidité.", 3, "employment", -3),
  }),
  p({
    id: "revenir-a-62-ans", kind: "transformation",
    title: "Faut-il rétablir l'âge légal à 62 ans ?",
    context: "Le départ plus précoce rend du temps aux actifs concernés, mais accroît le nombre d'années de pension et le besoin de financement.",
    adoptLabel: "Rétablir 62 ans", adoptSummary: "Les générations concernées partent plus tôt et les comptes de retraite se dégradent durablement.",
    keepLabel: "Conserver l'âge actuel", keepSummary: "La réforme en vigueur poursuit sa montée en charge et limite le déficit futur.",
    beneficiaries: ["actifs proches de la retraite"], contributors: ["finances sociales", "cotisants futurs"], sourceKeys: ["cor-2025"], conflicts: retirementPaths,
  }),
  p({
    id: "desindexer-les-pensions-d-un-point", kind: "transformation",
    title: "Faut-il indexer les pensions un point sous l'inflation ?",
    context: "La désindexation produit une économie immédiate et cumulative. Elle réduit le pouvoir d'achat de tous les retraités, y compris les petites pensions si aucune compensation n'est prévue.",
    adoptLabel: "Sous-indexer d'un point", adoptSummary: "Les pensions progressent moins vite que les prix et les comptes sociaux économisent plusieurs milliards.",
    keepLabel: "Indexer sur l'inflation", keepSummary: "Le pouvoir d'achat des pensions est préservé et l'économie disparaît.",
    beneficiaries: ["finances sociales"], contributors: ["retraités"], sourceKeys: ["cor-2025"],
  }),
  p({
    id: "durcir-l-assurance-chomage-degressivite-duree", kind: "transformation",
    title: "Faut-il raccourcir et rendre dégressive l'assurance chômage ?",
    context: "Des droits plus courts réduisent la dépense et renforcent l'incitation à reprendre un emploi. Ils diminuent aussi la protection quand les offres manquent.",
    adoptLabel: "Durcir les droits", adoptSummary: "Les allocations baissent plus vite et l'Unédic économise, au risque d'augmenter la précarité.",
    keepLabel: "Conserver les droits", keepSummary: "La protection des demandeurs d'emploi est maintenue et l'économie n'est pas réalisée.",
    beneficiaries: ["finances sociales", "employeurs qui recrutent"], contributors: ["demandeurs d'emploi de longue durée"], sourceKeys: ["cour-securite-sociale-2025", "insee-france-sociale-2025"],
  }),
  p({
    id: "ouvrir-un-etage-de-capitalisation-collective", kind: "rupture",
    title: "Faut-il ajouter une retraite obligatoire par capitalisation ?",
    context: "Une partie des cotisations finance un portefeuille collectif au lieu des pensions courantes. La transition oblige une génération à financer simultanément les deux étages.",
    adoptLabel: "Créer l'étage de capitalisation", adoptSummary: "Les actifs accumulent des réserves investies, tandis que l'État finance le trou de transition.",
    keepLabel: "Rester en répartition intégrale", keepSummary: "Les cotisations continuent de payer les pensions courantes, sans nouvelle réserve financière.",
    beneficiaries: ["actifs futurs", "marchés de capitaux"], contributors: ["finances publiques pendant la transition"], sourceKeys: ["cor-2025", "itm-50-decisions"], conflicts: retirementPaths,
  }),
  standalonePolicy({
    id: "retablir-la-semaine-de-39-heures", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il rétablir la durée légale à 39 heures ?",
    context: "La durée légale passe de 35 à 39 heures. Sans hausse proportionnelle du salaire mensuel, le coût horaire baisse. Avec compensation, le gain de compétitivité se réduit.",
    sourceKeys: ["insee-france-sociale-2025", "itm-50-decisions"], evidenceLabel: "Durée du travail, salaires et emploi.",
    options: [
      { id: "adopt", label: "Passer à 39 heures", summary: "Quatre heures redeviennent ordinaires et le partage du gain entre salariés et employeurs devient central.", budgetDelta: 2_000, beneficiaries: ["employeurs", "finances publiques"], contributors: ["salariés sans compensation intégrale"], uncertainty: "forte", indicatorEffects: { growth: 0.12, employment: -2, opinion: -8 }, groupEffects: { businesses: 5, unions: -8 }, scheduledEvents: [delayedEvent("hours-wage-bargain", "Les salaires rouvrent le conflit", "La négociation sur la compensation des quatre heures bloque plusieurs branches.", 2, "majority", -4)] },
      { id: "keep", label: "Conserver 35 heures", summary: "Les heures au-delà de 35 restent supplémentaires et le droit actuel ne change pas.", budgetDelta: 0, beneficiaries: ["salariés"], contributors: ["employeurs"], indicatorEffects: { opinion: 2 } },
    ],
  }),
  standalonePolicy({
    id: "augmenter-le-smic-de-10", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il augmenter immédiatement le SMIC de 10 % ?",
    context: "La hausse augmente le salaire brut au bas de l'échelle. Son coût se partage entre employeurs, prix, emploi et allègements de cotisations.",
    sourceKeys: ["insee-france-sociale-2025", "cour-securite-sociale-2025"], evidenceLabel: "Salaires, emploi et allègements au voisinage du SMIC.",
    options: [
      { id: "adopt", label: "Augmenter le SMIC de 10 %", summary: "Les salariés au SMIC gagnent davantage et les secteurs à faible marge absorbent le choc.", budgetDelta: -3_000, beneficiaries: ["salariés au SMIC"], contributors: ["employeurs", "finances publiques"], uncertainty: "forte", indicatorEffects: { opinion: 7, employment: -3, growth: 0.03 }, groupEffects: { lowIncomeHouseholds: 8, businesses: -6 } },
      { id: "keep", label: "Conserver l'indexation actuelle", summary: "Le SMIC suit les prix et les salaires, sans coup de pouce exceptionnel.", budgetDelta: 0, beneficiaries: ["employeurs"], contributors: ["salariés au SMIC"], indicatorEffects: { opinion: -3 } },
    ],
  }),
  standalonePolicy({
    id: "allocation-sociale-unique", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il fusionner les aides dans une allocation sociale unique ?",
    context: "RSA, prime d'activité et aides au logement seraient regroupés dans un barème unique. La simplicité crée nécessairement des gagnants et des perdants si l'enveloppe reste constante.",
    sourceKeys: ["drees-minima-2025", "cour-securite-sociale-2025"], evidenceLabel: "Montants, publics et articulation des prestations de solidarité.",
    dependencies: ["verser-le-rsa-automatiquement-fin-du-non"],
    options: [
      { id: "adopt", label: "Créer l'allocation unique", summary: "Le versement devient automatique et lisible, mais certains ménages perdent au nouveau barème.", budgetDelta: 1_000, beneficiaries: ["allocataires en non-recours", "administration"], contributors: ["perdants du nouveau barème"], uncertainty: "forte", indicatorEffects: { reformCapacity: 5, institutionalTrust: 2 }, groupEffects: { lowIncomeHouseholds: 2 }, scheduledEvents: [delayedEvent("single-benefit-losers", "Les perdants se découvrent", "Le premier versement révèle des baisses importantes pour certaines configurations familiales.", 3, "opinion", -5)] },
      { id: "keep", label: "Conserver des aides distinctes", summary: "Chaque prestation garde son objectif, avec les mêmes démarches et effets de seuil.", budgetDelta: 0, beneficiaries: ["allocataires protégés par les règles actuelles"], contributors: ["non-recourants", "administration"], indicatorEffects: { reformCapacity: -2 } },
    ],
  }),
].map(policyDecision);
