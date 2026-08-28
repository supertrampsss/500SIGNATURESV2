import { delayedEvent, existingPolicy, policyDecision, standalonePolicy, type ExistingPolicyCopy } from "../policy-catalogue.ts";

const CHAPTER = "state-institutions-territories";
const p = (copy: Omit<ExistingPolicyCopy, "chapterId">) => existingPolicy({ ...copy, chapterId: CHAPTER });
const institutions = ["diviser-par-deux-le-nombre-de-parlementaires", "supprimer-le-senat", "proportionnelle-integrale"];
const territories = ["reduire-de-5-les-dotations-aux-collectivites", "supprimer-les-departements"];

export const STATE_DECISIONS = [
  p({
    id: "geler-le-point-d-indice-en-2026", kind: "gestion",
    title: "Faut-il geler le point d'indice de la fonction publique ?",
    context: "Le gel économise par rapport à une revalorisation, mais réduit le salaire réel des agents lorsque les prix montent.",
    adoptLabel: "Geler le point", adoptSummary: "La masse salariale progresse moins vite et les agents perdent du pouvoir d'achat réel.",
    keepLabel: "Revaloriser selon la trajectoire", keepSummary: "Les rémunérations suivent davantage les prix et l'économie disparaît.",
    beneficiaries: ["finances publiques"], contributors: ["agents publics"], sourceKeys: ["cour-finances-2025", "collectivites-chiffres-2025"],
  }),
  p({
    id: "deux-jours-de-carence-dans-la-fonction", kind: "gestion",
    title: "Faut-il imposer deux jours de carence aux agents publics ?",
    context: "Les deux premiers jours d'arrêt ne sont pas payés. La dépense baisse et l'absentéisme peut reculer, au prix d'une perte de revenu pour les agents malades.",
    adoptLabel: "Imposer deux jours", adoptSummary: "Les agents financent leurs deux premiers jours d'arrêt et les employeurs publics économisent.",
    keepLabel: "Garder un seul jour de carence", keepSummary: "La protection des agents reste inchangée et l'économie n'est pas réalisée.",
    beneficiaries: ["employeurs publics", "finances publiques"], contributors: ["agents publics malades"], sourceKeys: ["cour-finances-2025", "collectivites-chiffres-2025"],
  }),
  p({
    id: "ne-pas-remplacer-un-depart-administratif-sur", kind: "gestion",
    title: "Faut-il ne pas remplacer un départ administratif sur trois ?",
    context: "La règle réduit progressivement les fonctions support. Sans suppression préalable de tâches, le travail se reporte sur les agents ou les usagers.",
    adoptLabel: "Ne pas remplacer un départ sur trois", adoptSummary: "Les effectifs administratifs diminuent et les services absorbent la charge restante.",
    keepLabel: "Remplacer selon les besoins", keepSummary: "Les postes sont arbitrés service par service et l'économie automatique disparaît.",
    beneficiaries: ["finances publiques"], contributors: ["agents restants", "usagers"], sourceKeys: ["cour-finances-2025"],
  }),
  p({
    id: "fermer-un-tiers-des-agences-et-operateurs", kind: "gestion",
    title: "Faut-il fermer un tiers des agences et opérateurs ?",
    context: "Le nombre de structures baisse vite sur le papier. Les missions, agents, contrats et dettes doivent être supprimés ou repris pour produire une économie réelle.",
    adoptLabel: "Fermer un tiers des structures", adoptSummary: "Les fonctions sont supprimées ou réintégrées et la transition engage des coûts avant les économies.",
    keepLabel: "Examiner agence par agence", keepSummary: "Les missions restent stables et les économies arrivent plus lentement.",
    beneficiaries: ["finances publiques", "lisibilité administrative"], contributors: ["agents", "usagers des agences fermées"], sourceKeys: ["cour-finances-2025"],
  }),
  p({
    id: "diviser-par-deux-le-nombre-de-parlementaires", kind: "transformation",
    title: "Faut-il diviser par deux le nombre de parlementaires ?",
    context: "La réforme est spectaculaire et l'économie minuscule face au déficit. Chaque élu représente davantage d'habitants et le travail en commission se concentre.",
    adoptLabel: "Diviser le nombre par deux", adoptSummary: "Le Parlement rétrécit fortement et l'économie reste surtout symbolique.",
    keepLabel: "Conserver les deux assemblées actuelles", keepSummary: "La représentation territoriale et les effectifs parlementaires restent inchangés.",
    beneficiaries: ["symbole de sobriété", "finances publiques"], contributors: ["représentation territoriale", "pluralisme"], sourceKeys: ["cour-finances-2025", "collectivites-chiffres-2025"], conflicts: institutions,
  }),
  p({
    id: "supprimer-le-cese", kind: "transformation",
    title: "Faut-il supprimer le Conseil économique, social et environnemental ?",
    context: "L'institution consultative disparaît. L'économie est inférieure à un dix-millième des dépenses publiques, mais le signal institutionnel est fort.",
    adoptLabel: "Supprimer le CESE", adoptSummary: "L'institution ferme et la société civile perd cette voie consultative nationale.",
    keepLabel: "Maintenir le CESE", keepSummary: "La consultation demeure et son faible coût reste au budget.",
    beneficiaries: ["finances publiques", "simplification symbolique"], contributors: ["organisations représentées"], sourceKeys: ["cour-finances-2025"],
  }),
  p({
    id: "ceder-des-participations-non-strategiques-de-l", kind: "transformation",
    title: "Faut-il vendre les participations publiques non stratégiques ?",
    context: "La vente réduit la dette une seule fois et supprime des dividendes futurs. Elle ne réduit le déficit annuel que si les intérêts évités dépassent les revenus perdus.",
    adoptLabel: "Vendre les participations", adoptSummary: "L'État encaisse immédiatement et perd le contrôle et les dividendes correspondants.",
    keepLabel: "Conserver le portefeuille", keepSummary: "L'État garde ses actifs, risques et dividendes, sans recette exceptionnelle.",
    beneficiaries: ["dette publique à court terme", "acheteurs"], contributors: ["patrimoine public", "dividendes futurs"], sourceKeys: ["cour-finances-2025"],
  }),
  p({
    id: "reduire-de-5-les-dotations-aux-collectivites", kind: "transformation",
    title: "Faut-il réduire de 5 % les dotations aux collectivités ?",
    context: "L'État améliore son solde, mais communes, départements et régions doivent réduire les dépenses, les investissements ou augmenter leurs recettes.",
    adoptLabel: "Réduire les dotations", adoptSummary: "Le budget de l'État économise et les collectivités répercutent la coupe sur leurs choix locaux.",
    keepLabel: "Maintenir les dotations", keepSummary: "Les budgets locaux sont préservés et l'État ne réalise pas l'économie.",
    beneficiaries: ["budget de l'État"], contributors: ["collectivités", "usagers locaux"], sourceKeys: ["ofgl-rapports", "collectivites-chiffres-2025"], conflicts: territories,
    event: delayedEvent("local-investment-cut", "Les chantiers locaux s'arrêtent", "Les collectivités concentrent la coupe sur l'investissement et les entreprises locales perdent des commandes.", 3, "investment", -5),
  }),
  standalonePolicy({
    id: "regle-d-or-constitutionnelle", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il inscrire l'équilibre budgétaire dans la Constitution ?",
    context: "Une règle d'or limite le déficit hors circonstances exceptionnelles. Elle impose de décider à l'avance comment traiter récession, guerre et investissement.",
    sourceKeys: ["cour-finances-2025", "eurostat-finances"], evidenceLabel: "Déficit structurel, dette et règles budgétaires européennes.",
    options: [
      { id: "adopt", label: "Inscrire la règle d'or", summary: "Gouvernement et Parlement doivent financer toute dépense nouvelle ou déclencher une clause d'exception.", budgetDelta: 8_000, beneficiaries: ["créanciers", "générations futures"], contributors: ["marge budgétaire en crise", "majorités politiques"], uncertainty: "forte", indicatorEffects: { financialCredibility: 10, reformCapacity: -5, opinion: -3 }, groupEffects: { creditors: 8, parliamentaryMajority: -5 }, scheduledEvents: [delayedEvent("golden-rule-recession", "La croissance cale sous la règle", "Le ralentissement réduit les recettes et force un nouvel ajustement en pleine baisse d'activité.", 3, "growth", -0.35)] },
      { id: "keep", label: "Conserver les règles actuelles", summary: "Les objectifs restent législatifs et européens, avec une flexibilité politique plus large.", budgetDelta: 0, beneficiaries: ["politique contracyclique"], contributors: ["crédibilité budgétaire"], indicatorEffects: { financialCredibility: -2 } },
    ],
  }),
  standalonePolicy({
    id: "supprimer-le-senat", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il supprimer le Sénat ?",
    context: "Le Parlement devient monocaméral. Les lois vont plus vite et la représentation spécifique des collectivités disparaît.",
    sourceKeys: ["collectivites-chiffres-2025", "cour-finances-2025"], evidenceLabel: "Organisation des institutions nationales et représentation des territoires.", conflicts: institutions,
    options: [
      { id: "adopt", label: "Supprimer le Sénat", summary: "L'Assemblée nationale devient l'unique chambre et les territoires perdent leur représentation dédiée.", budgetDelta: 350, beneficiaries: ["rapidité législative", "finances publiques"], contributors: ["représentation territoriale", "contre-pouvoir parlementaire"], uncertainty: "faible", indicatorEffects: { reformCapacity: 6, institutionalTrust: -5, opinion: 4 }, groupEffects: { localAuthorities: -8 }, locks: institutions },
      { id: "keep", label: "Conserver le bicamérisme", summary: "Les deux chambres continuent d'examiner les textes et de se contrôler.", budgetDelta: 0, beneficiaries: ["territoires", "contre-pouvoirs"], contributors: ["rapidité législative"], indicatorEffects: { institutionalTrust: 2 } },
    ],
  }),
  standalonePolicy({
    id: "supprimer-les-departements", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il supprimer les départements ?",
    context: "Leurs compétences sociales, routières et scolaires passent aux régions ou intercommunalités. Les élus disparaissent vite, les services et agents doivent être transférés sans rupture.",
    sourceKeys: ["ofgl-rapports", "collectivites-chiffres-2025"], evidenceLabel: "Compétences, budgets et personnels des départements.", conflicts: territories,
    options: [
      { id: "adopt", label: "Supprimer les départements", summary: "Les compétences sont redistribuées et les doublons espérés ne deviennent des économies qu'après la transition.", budgetDelta: 2_500, beneficiaries: ["régions", "simplification territoriale"], contributors: ["agents transférés", "territoires ruraux", "finances de transition"], uncertainty: "forte", indicatorEffects: { reformCapacity: 7, publicServices: -6, opinion: -2 }, groupEffects: { localAuthorities: -9, publicEmployees: -5 }, locks: territories, scheduledEvents: [delayedEvent("department-social-transfer", "Le transfert social se grippe", "Les systèmes d'aide sociale ne communiquent pas et les délais de paiement augmentent.", 1, "institutionalTrust", -6)] },
      { id: "keep", label: "Conserver les départements", summary: "Les compétences de proximité restent à cet échelon et les doublons persistent.", budgetDelta: 0, beneficiaries: ["continuité des services", "territoires ruraux"], contributors: ["simplification institutionnelle"], indicatorEffects: { publicServices: 2 } },
    ],
  }),
  standalonePolicy({
    id: "proportionnelle-integrale", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il élire l'Assemblée nationale à la proportionnelle intégrale ?",
    context: "Les sièges reflètent les voix nationales. La représentation gagne en fidélité et les majorités absolues deviennent plus rares.",
    sourceKeys: ["collectivites-chiffres-2025"], evidenceLabel: "Architecture institutionnelle et représentation politique.", conflicts: institutions,
    options: [
      { id: "adopt", label: "Passer à la proportionnelle intégrale", summary: "Chaque courant obtient des sièges proches de son poids et les gouvernements doivent former des coalitions.", budgetDelta: 0, beneficiaries: ["petits partis", "pluralisme"], contributors: ["stabilité majoritaire"], uncertainty: "moyenne", indicatorEffects: { institutionalTrust: 5, majority: -10, reformCapacity: -5 }, groupEffects: { parliamentaryMajority: -8 }, locks: institutions },
      { id: "keep", label: "Conserver le scrutin majoritaire", summary: "Les circonscriptions et la prime aux grands blocs sont maintenues.", budgetDelta: 0, beneficiaries: ["majorités cohérentes", "ancrage local"], contributors: ["représentation proportionnelle"], indicatorEffects: { majority: 3 } },
    ],
  }),
].map(policyDecision);
