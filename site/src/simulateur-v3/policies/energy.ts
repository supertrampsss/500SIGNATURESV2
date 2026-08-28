import { delayedEvent, existingPolicy, policyDecision, standalonePolicy, type ExistingPolicyCopy } from "../policy-catalogue.ts";

const CHAPTER = "energy-climate-transport-agriculture";
const p = (copy: Omit<ExistingPolicyCopy, "chapterId">) => existingPolicy({ ...copy, chapterId: CHAPTER });
const nuclearPaths = ["engager-six-epr2-part-annuelle-de-l", "sortie-du-nucleaire-en-2040"];

export const ENERGY_DECISIONS = [
  p({
    id: "doubler-maprimerenov", kind: "gestion",
    title: "Faut-il doubler MaPrimeRénov' ?",
    context: "L'aide accélère les rénovations si artisans, contrôles et ménages suivent. Le coût budgétaire arrive avant les économies d'énergie.",
    adoptLabel: "Doubler l'enveloppe", adoptSummary: "Davantage de ménages sont aidés et l'État double presque sa dépense annuelle.",
    keepLabel: "Conserver l'enveloppe", keepSummary: "Le coût reste contenu et les rénovations avancent au rythme actuel.",
    beneficiaries: ["ménages rénovant", "artisans"], contributors: ["finances publiques"], sourceKeys: ["rte-futurs-2050", "budget-niches-2026"],
  }),
  p({
    id: "plan-ferroviaire-3-000-m-de-plus", kind: "gestion",
    title: "Faut-il ajouter trois milliards d'euros par an au ferroviaire ?",
    context: "Le réseau a besoin de renouvellement avant les nouvelles lignes. L'investissement améliore la capacité à terme et pèse immédiatement sur les crédits.",
    adoptLabel: "Financer le plan ferroviaire", adoptSummary: "Le réseau reçoit trois milliards de plus par an et les chantiers montent en charge.",
    keepLabel: "Conserver les crédits actuels", keepSummary: "La dépense n'augmente pas et les renouvellements restent priorisés dans l'enveloppe existante.",
    beneficiaries: ["voyageurs", "fret", "territoires"], contributors: ["finances publiques"], sourceKeys: ["rte-futurs-2050", "cour-finances-2025"],
  }),
  p({
    id: "supprimer-le-bonus-automobile-electrique", kind: "gestion",
    title: "Faut-il supprimer le bonus pour les voitures électriques ?",
    context: "Le bonus réduit le prix d'achat et soutient la demande. Le supprimer économise, mais ralentit les ventes si les modèles restent plus chers.",
    adoptLabel: "Supprimer le bonus", adoptSummary: "Le budget économise et les acheteurs paient le prix sans aide.",
    keepLabel: "Maintenir le bonus", keepSummary: "L'achat électrique reste subventionné et la dépense publique continue.",
    beneficiaries: ["finances publiques"], contributors: ["acheteurs de véhicules électriques", "filière automobile"], sourceKeys: ["budget-niches-2026", "rte-futurs-2050"],
  }),
  p({
    id: "relancer-le-leasing-social-de-vehicules-electriques", kind: "gestion",
    title: "Faut-il relancer le leasing social électrique ?",
    context: "La location aidée ouvre l'électrique aux ménages modestes. Le nombre de bénéficiaires reste limité par l'enveloppe et l'offre de véhicules éligibles.",
    adoptLabel: "Relancer le leasing social", adoptSummary: "Des ménages modestes accèdent à une voiture électrique et l'État subventionne chaque contrat.",
    keepLabel: "Ne pas relancer", keepSummary: "La dépense est évitée et l'accès aidé reste fermé à de nouveaux ménages.",
    beneficiaries: ["ménages modestes automobilistes", "filière électrique"], contributors: ["finances publiques"], sourceKeys: ["budget-niches-2026", "rte-futurs-2050"],
  }),
  standalonePolicy({
    id: "engager-six-epr2-part-annuelle-de-l", chapterId: CHAPTER, kind: "transformation",
    title: "Quel avenir pour le nucléaire ?",
    context: "Le parc actuel vieillit. Six, quatorze ou aucun nouveau réacteur engagent coûts, industrie et système électrique pour plusieurs décennies.",
    sourceKeys: ["rte-epr2-2026", "rte-futurs-2050"], evidenceLabel: "Trajectoires de production, calendrier industriel et besoins du système électrique.",
    evidenceNote: "Les montants annuels sont des hypothèses de montée en charge du jeu, distinctes du coût complet des programmes.", conflicts: nuclearPaths,
    options: [
      { id: "six", label: "Engager six EPR2", summary: "Le premier programme est lancé et sa montée en charge industrielle est financée.", budgetDelta: -2_000, beneficiaries: ["filière nucléaire", "sécurité d'approvisionnement future"], contributors: ["finances publiques", "consommateurs futurs"], uncertainty: "forte", indicatorEffects: { growth: 0.05, investment: 5, financialCredibility: -2 }, groupEffects: { businesses: 4 }, locks: nuclearPaths },
      { id: "fourteen", label: "Engager quatorze EPR2", summary: "Le programme maximal accélère le renouvellement du parc et concentre un risque industriel beaucoup plus élevé.", budgetDelta: -4_000, beneficiaries: ["filière nucléaire", "production pilotable future"], contributors: ["finances publiques", "consommateurs futurs"], uncertainty: "forte", indicatorEffects: { growth: 0.09, investment: 8, financialCredibility: -4 }, groupEffects: { businesses: 6 }, locks: nuclearPaths, scheduledEvents: [delayedEvent("epr-supply-chain", "La chaîne industrielle sature", "Les carnets de commandes dépassent les capacités disponibles et le calendrier glisse.", 3, "financialCredibility", -4)] },
      { id: "none", label: "Ne lancer aucun nouveau réacteur", summary: "La France mise sur le parc existant, les renouvelables, les flexibilités et de futurs choix technologiques.", budgetDelta: 0, beneficiaries: ["finances publiques à court terme"], contributors: ["filière nucléaire", "sécurité d'approvisionnement à long terme"], uncertainty: "forte", indicatorEffects: { investment: -4, financialCredibility: 1 }, groupEffects: { businesses: -2 } },
    ],
  }),
  p({
    id: "retablir-une-trajectoire-carbone-recettes-redistribuees", kind: "transformation",
    title: "Faut-il rétablir une taxe carbone intégralement redistribuée ?",
    context: "Le prix des énergies fossiles augmente, puis la recette revient aux ménages. Le montant moyen peut être neutre tout en créant de forts gagnants et perdants selon le logement et la voiture.",
    adoptLabel: "Rétablir la trajectoire carbone", adoptSummary: "Les énergies fossiles coûtent plus cher et la recette est reversée selon un barème politique.",
    keepLabel: "Ne pas relever la taxe", keepSummary: "Le prix fiscal des carburants reste stable et l'incitation supplémentaire disparaît.",
    beneficiaries: ["ménages sobres", "transition climatique"], contributors: ["ménages dépendants des fossiles"], sourceKeys: ["rte-futurs-2050", "cour-finances-2025"],
    event: delayedEvent("carbon-rural-revolt", "La redistribution arrive après la facture", "Les ménages dépendants de la voiture voient la hausse avant le versement et la contestation s'étend.", 1, "opinion", -6),
  }),
  p({
    id: "renforcer-la-taxe-sur-les-billets-d", kind: "transformation",
    title: "Faut-il augmenter la taxe sur les billets d'avion ?",
    context: "La taxe renchérit les vols et finance le budget ou la transition. Son effet dépend du prix, des correspondances et de la concurrence des aéroports voisins.",
    adoptLabel: "Augmenter la taxe", adoptSummary: "Les voyageurs aériens paient davantage et l'État encaisse la recette.",
    keepLabel: "Conserver la taxe actuelle", keepSummary: "Les billets n'augmentent pas pour ce motif et la recette supplémentaire disparaît.",
    beneficiaries: ["finances publiques", "transition climatique"], contributors: ["voyageurs", "compagnies aériennes"], sourceKeys: ["budget-recettes-2026", "rte-futurs-2050"],
  }),
  p({
    id: "doubler-le-soutien-a-l-agriculture-bio", kind: "transformation",
    title: "Faut-il doubler le soutien à l'agriculture biologique et aux haies ?",
    context: "L'aide soutient des pratiques environnementales et des exploitations fragilisées par la demande. Elle ne garantit pas à elle seule les débouchés.",
    adoptLabel: "Doubler le soutien", adoptSummary: "Les exploitations engagées reçoivent davantage d'aide et le budget agricole augmente.",
    keepLabel: "Conserver les aides actuelles", keepSummary: "La dépense n'augmente pas et les conversions restent au rythme du marché.",
    beneficiaries: ["agriculteurs biologiques", "biodiversité"], contributors: ["finances publiques"], sourceKeys: ["budget-niches-2026", "cour-finances-2025"],
  }),
  standalonePolicy({
    id: "sortie-du-nucleaire-en-2040", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il fermer tous les réacteurs nucléaires d'ici 2040 ?",
    context: "La production nucléaire est remplacée en quinze ans par renouvelables, stockage, réseaux, sobriété ou centrales d'appoint. Le calendrier concentre le risque de capacité.",
    sourceKeys: ["rte-futurs-2050", "rte-epr2-2026"], evidenceLabel: "Scénarios de mix électrique, besoins de réseau et sécurité d'approvisionnement.", conflicts: nuclearPaths,
    options: [
      { id: "adopt", label: "Sortir du nucléaire en 2040", summary: "Les réacteurs ferment selon un calendrier contraint et les alternatives doivent être construites avant chaque arrêt.", budgetDelta: -12_000, beneficiaries: ["filières renouvelables", "opposants au nucléaire"], contributors: ["finances publiques", "filière nucléaire", "réseau électrique"], uncertainty: "forte", indicatorEffects: { investment: 8, financialCredibility: -7, growth: -0.25 }, groupEffects: { businesses: -6 }, locks: nuclearPaths, scheduledEvents: [delayedEvent("winter-capacity-gap", "Un hiver sans marge", "Le retard des réseaux et du stockage oblige à maintenir des centrales thermiques plus longtemps.", 4, "publicServices", -8)] },
      { id: "keep", label: "Conserver une part nucléaire", summary: "Le parc est prolongé ou renouvelé selon les contrôles de sûreté et les besoins du réseau.", budgetDelta: 0, beneficiaries: ["filière nucléaire", "production pilotable"], contributors: ["gestion des déchets", "investissements de sûreté"], indicatorEffects: { financialCredibility: 2 } },
    ],
  }),
  standalonePolicy({
    id: "moratoire-sur-les-renouvelables", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il suspendre tout nouveau parc éolien et solaire ?",
    context: "Le moratoire stoppe les nouveaux projets pour protéger paysages et terres. La demande future doit alors être couverte par nucléaire, fossiles, importations ou sobriété.",
    sourceKeys: ["rte-futurs-2050", "rte-epr2-2026", "itm-50-decisions"], evidenceLabel: "Besoins de nouvelles capacités électriques selon les scénarios.",
    conflicts: ["sortie-du-nucleaire-en-2040"],
    options: [
      { id: "adopt", label: "Suspendre les nouveaux projets", summary: "Les paysages sont gelés et la trajectoire électrique perd ses nouvelles capacités renouvelables.", budgetDelta: 1_200, beneficiaries: ["riverains opposés aux projets"], contributors: ["filières renouvelables", "sécurité d'approvisionnement"], uncertainty: "forte", indicatorEffects: { investment: -8, growth: -0.12, opinion: 3 }, groupEffects: { businesses: -5, localAuthorities: -3 }, locks: ["sortie-du-nucleaire-en-2040"] },
      { id: "keep", label: "Poursuivre les appels d'offres", summary: "Les projets continuent sous autorisations locales et environnementales.", budgetDelta: 0, beneficiaries: ["filières renouvelables", "collectivités accueillantes"], contributors: ["riverains", "paysages"], indicatorEffects: { investment: 3 } },
    ],
  }),
  standalonePolicy({
    id: "interdire-les-voitures-thermiques-en-2030", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il interdire la vente de voitures thermiques dès 2030 ?",
    context: "L'échéance avance de cinq ans la bascule des ventes neuves. Bornes, production électrique, offre abordable et industrie automobile doivent suivre au même rythme.",
    sourceKeys: ["rte-futurs-2050", "rte-epr2-2026"], evidenceLabel: "Électrification des transports et demande d'électricité associée.",
    dependencies: ["relancer-le-leasing-social-de-vehicules-electriques"],
    options: [
      { id: "adopt", label: "Interdire les ventes en 2030", summary: "Les constructeurs basculent plus vite vers l'électrique et les acheteurs perdent l'option thermique neuve.", budgetDelta: -4_000, beneficiaries: ["filière électrique", "qualité de l'air"], contributors: ["automobilistes contraints", "industrie thermique"], uncertainty: "forte", indicatorEffects: { investment: 6, growth: -0.08, opinion: -7 }, groupEffects: { businesses: -4, lowIncomeHouseholds: -5 } },
      { id: "keep", label: "Conserver l'échéance européenne", summary: "La transition reste fixée à 2035 et laisse cinq années supplémentaires d'adaptation.", budgetDelta: 0, beneficiaries: ["automobilistes", "industrie thermique"], contributors: ["vitesse de décarbonation"], indicatorEffects: { opinion: 2 } },
    ],
  }),
  standalonePolicy({
    id: "nationaliser-les-autoroutes", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il reprendre les concessions autoroutières sous contrôle public ?",
    context: "L'État récupère péages, entretien et dette après indemnisation des concessionnaires. La rentabilité future dépend du prix de rachat et de la politique tarifaire.",
    sourceKeys: ["cour-finances-2025", "collectivites-chiffres-2025"], evidenceLabel: "Recettes de péage, contrats de concession et engagements publics.",
    options: [
      { id: "adopt", label: "Reprendre les concessions", summary: "L'État paie la sortie des contrats puis encaisse et fixe les péages.", budgetDelta: -18_000, beneficiaries: ["État à long terme", "usagers si les tarifs baissent"], contributors: ["finances publiques à court terme", "concessionnaires"], uncertainty: "forte", indicatorEffects: { investment: -2, financialCredibility: -4, opinion: 5 }, groupEffects: { businesses: -5 } },
      { id: "keep", label: "Aller au terme des concessions", summary: "Les contrats continuent et l'État prépare leur échéance sans indemnisation immédiate.", budgetDelta: 0, beneficiaries: ["finances publiques à court terme", "concessionnaires"], contributors: ["usagers des péages"], indicatorEffects: { financialCredibility: 1 } },
    ],
  }),
].map(policyDecision);
