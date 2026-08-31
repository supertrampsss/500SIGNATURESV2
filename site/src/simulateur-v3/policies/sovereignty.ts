import { existingPolicy, policyDecision, standalonePolicy, type ExistingPolicyCopy } from "../policy-catalogue.ts";

const CHAPTER = "defence-europe-sovereignty";
const p = (copy: Omit<ExistingPolicyCopy, "chapterId">) => existingPolicy({ ...copy, chapterId: CHAPTER });

export const SOVEREIGNTY_DECISIONS = [
  p({
    id: "porter-l-effort-de-defense-vers-3", kind: "gestion",
    title: "Faut-il porter l'effort de défense à 3 % du PIB ?",
    context: "La hausse accélère munitions, équipements et disponibilité. Elle représente plusieurs milliards récurrents à trouver dans un budget déjà déficitaire.",
    adoptLabel: "Viser 3 % du PIB", adoptSummary: "Les armées reçoivent des moyens supplémentaires et le déficit se creuse sans financement associé.",
    keepLabel: "Suivre la trajectoire actuelle", keepSummary: "La marche budgétaire reste plus basse et certaines capacités arrivent plus tard.",
    beneficiaries: ["armées", "industrie de défense", "alliés"], contributors: ["finances publiques"], sourceKeys: ["defense-lpm", "cour-finances-2025"],
  }),
  p({
    id: "etaler-la-marche-2026-de-la-programmation", kind: "gestion",
    title: "Faut-il étaler la hausse prévue par la programmation militaire ?",
    context: "Décaler la marche soulage le déficit immédiat. Les commandes, stocks et recrutements prévus sont alors repoussés ou réduits.",
    adoptLabel: "Étaler la hausse", adoptSummary: "Le budget économise maintenant et les armées reçoivent plus tard une partie des moyens promis.",
    keepLabel: "Tenir la programmation", keepSummary: "Les moyens arrivent au calendrier voté et l'État finance la marche prévue.",
    beneficiaries: ["finances publiques à court terme"], contributors: ["armées", "industrie de défense"], sourceKeys: ["defense-lpm"],
  }),
  p({
    id: "doubler-la-reserve-operationnelle", kind: "gestion",
    title: "Faut-il doubler la réserve opérationnelle ?",
    context: "La réserve renforce les effectifs mobilisables sans créer autant de postes permanents. Formation, équipement et disponibilité des employeurs restent nécessaires.",
    adoptLabel: "Doubler la réserve", adoptSummary: "Les armées disposent de davantage de renforts et financent leur formation et leurs périodes d'activité.",
    keepLabel: "Conserver la cible actuelle", keepSummary: "La dépense reste contenue et la capacité de mobilisation progresse moins vite.",
    beneficiaries: ["armées", "résilience nationale"], contributors: ["finances publiques", "employeurs"], sourceKeys: ["defense-lpm"],
  }),
  p({
    id: "reduire-l-aide-publique-au-developpement-de", kind: "gestion",
    title: "Faut-il réduire de moitié l'aide publique au développement ?",
    context: "La coupe produit une économie rapide. Elle réduit les programmes extérieurs et l'influence française dans les pays partenaires.",
    adoptLabel: "Réduire l'aide de moitié", adoptSummary: "Le budget économise et les programmes de développement français reculent fortement.",
    keepLabel: "Maintenir l'aide", keepSummary: "Les engagements extérieurs sont conservés et aucune économie n'est dégagée.",
    beneficiaries: ["finances publiques"], contributors: ["pays bénéficiaires", "influence diplomatique"], sourceKeys: ["budget-recettes-2026", "cour-finances-2025"],
  }),
  p({
    id: "service-militaire-volontaire-de-50-000", kind: "transformation",
    title: "Faut-il créer un service militaire volontaire de 50 000 jeunes ?",
    context: "Le dispositif forme et encadre une classe de volontaires. Il coûte bien plus qu'une réserve ciblée et ne devient une capacité militaire qu'après formation.",
    adoptLabel: "Créer le service volontaire", adoptSummary: "Cinquante mille jeunes suivent une formation militaire et l'État finance encadrement, solde et infrastructures.",
    keepLabel: "Conserver les dispositifs actuels", keepSummary: "La dépense est évitée et les armées restent concentrées sur recrutement et réserve.",
    beneficiaries: ["jeunes volontaires", "armées", "cohésion"], contributors: ["finances publiques"], sourceKeys: ["defense-lpm"],
  }),
  p({
    id: "doubler-les-moyens-du-renseignement-interieur", kind: "transformation",
    title: "Faut-il doubler les moyens du renseignement intérieur ?",
    context: "Effectifs, technologies et surveillance augmentent. La capacité de prévention progresse, avec des enjeux plus lourds de contrôle démocratique et de recrutement.",
    adoptLabel: "Doubler les moyens", adoptSummary: "Le renseignement gagne des capacités humaines et techniques sous un contrôle à renforcer.",
    keepLabel: "Maintenir la trajectoire", keepSummary: "La dépense reste contenue et la montée en puissance demeure progressive.",
    beneficiaries: ["services de renseignement", "sécurité nationale"], contributors: ["finances publiques", "vie privée"], sourceKeys: ["pap-police-2025", "lopmi-2023"],
    evidenceNote: "Les 300 millions d'euros par an sont une hypothèse incrémentale du jeu; les périmètres budgétaires du renseignement sont éclatés ou protégés et les sources ne chiffrent pas un doublement littéral.",
  }),
  standalonePolicy({
    id: "achats-militaires-europeens-prioritaires", chapterId: CHAPTER, kind: "transformation",
    title: "Faut-il réserver les grands achats militaires aux industriels européens ?",
    context: "La préférence européenne renforce une base industrielle commune. Elle peut réduire la concurrence, renchérir certains achats et exclure des équipements américains disponibles plus vite.",
    sourceKeys: ["directive-defense-2009-81", "defense-lpm", "commission-budget-ue"], evidenceLabel: "Programmation des équipements et coopération industrielle européenne.",
    evidenceNote: "Le surcoût de 1 500 millions d'euros est une hypothèse du jeu; la directive encadre l'accès au marché et l'article 346 TFUE ne permet une dérogation qu'au cas par cas.",
    options: [
      { id: "adopt", label: "Acheter européen en priorité", summary: "Les commandes soutiennent l'industrie européenne, même lorsqu'une offre extérieure est moins chère ou plus rapide.", budgetDelta: -1_500, beneficiaries: ["industrie européenne", "autonomie stratégique"], contributors: ["finances publiques", "fournisseurs non européens"], uncertainty: "forte" },
      { id: "keep", label: "Acheter au meilleur compromis", summary: "Chaque programme arbitre librement coût, délai, performance et souveraineté.", budgetDelta: 0, beneficiaries: ["budget d'équipement"], contributors: ["industrie européenne"] },
    ],
  }),
  standalonePolicy({
    id: "budget-europeen-de-defense", chapterId: CHAPTER, kind: "transformation",
    title: "Faut-il créer un budget européen de défense financé en commun ?",
    context: "Un emprunt ou impôt européen finance des capacités communes. La France mutualise la charge, mais partage la décision sur les priorités et les fournisseurs.",
    sourceKeys: ["tfue-article-311", "commission-budget-ue", "defense-lpm"], evidenceLabel: "Budget européen et besoins capacitaires des États membres.",
    evidenceNote: "Le gain français de 2 000 millions d'euros par an est une hypothèse nette du jeu, pas une conséquence automatique d'une nouvelle ressource propre ou d'un emprunt commun.",
    options: [
      { id: "adopt", label: "Mutualiser le financement", summary: "L'Union finance des capacités communes et la France cède une part du pilotage.", budgetDelta: 2_000, beneficiaries: ["armées européennes", "finances françaises"], contributors: ["contribuables européens", "autonomie nationale de décision"], uncertainty: "forte" },
      { id: "keep", label: "Garder des budgets nationaux", summary: "Chaque État conserve ses crédits et ses choix, avec moins de mutualisation.", budgetDelta: 0, beneficiaries: ["souveraineté nationale"], contributors: ["coopération européenne"] },
    ],
  }),
  standalonePolicy({
    id: "sortir-de-l-euro", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il sortir de l'euro et rétablir une monnaie nationale ?",
    context: "La France récupère son taux de change et une politique monétaire nationale. Contrats, dépôts, dette, inflation et relations européennes entrent dans une transition sans précédent.",
    sourceKeys: ["bce-euro", "eurostat-finances", "itm-50-decisions"], evidenceLabel: "Fonctionnement de l'euro, dette publique et intégration financière.",
    evidenceNote: "Le choc ponctuel de 35 milliards d'euros et la charge d'intérêt de 12 milliards par an sont des hypothèses de stress du jeu, pas des prévisions officielles.",
    options: [
      { id: "adopt", label: "Rétablir une monnaie nationale", summary: "Les contrats sont convertis et la nouvelle monnaie flotte, avec un risque immédiat sur les prix et le financement.", budgetDelta: -35_000, beneficiaries: ["secteurs exportateurs après dépréciation", "politique monétaire nationale"], contributors: ["épargnants", "importateurs", "finances publiques"], uncertainty: "forte" },
      { id: "keep", label: "Rester dans l'euro", summary: "La monnaie unique et la politique de la BCE restent le cadre monétaire français.", budgetDelta: 0, beneficiaries: ["épargnants", "importateurs", "stabilité financière"], contributors: ["autonomie monétaire nationale"] },
    ],
  }),
  standalonePolicy({
    id: "referendum-sur-la-sortie-de-l-ue", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il organiser un référendum sur la sortie de l'Union européenne ?",
    context: "Le vote tranche l'appartenance de la France à l'Union. La campagne ouvre immédiatement l'incertitude sur marché unique, budget, droit, frontières et monnaie.",
    sourceKeys: ["commission-budget-ue", "eurostat-finances", "itm-50-decisions"], evidenceLabel: "Intégration budgétaire et économique de la France dans l'Union européenne.",
    options: [
      { id: "adopt", label: "Organiser le référendum", summary: "La souveraineté européenne est remise au vote et l'incertitude économique commence avant même le résultat.", budgetDelta: -500, beneficiaries: ["souveraineté populaire"], contributors: ["stabilité politique", "entreprises exposées au marché unique"], uncertainty: "forte" },
      { id: "keep", label: "Rester dans l'Union sans référendum", summary: "L'appartenance à l'Union n'est pas remise en jeu pendant le mandat.", budgetDelta: 0, beneficiaries: ["stabilité juridique", "entreprises européennes"], contributors: ["partisans du référendum"] },
    ],
  }),
  standalonePolicy({
    id: "creer-une-armee-europeenne", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il intégrer une partie des armées dans une armée européenne ?",
    context: "Commandement, doctrine et capacités deviennent communs. L'échelle augmente, mais la France ne décide plus seule de l'emploi des unités intégrées.",
    sourceKeys: ["tue-article-42", "defense-lpm", "commission-budget-ue"], evidenceLabel: "Capacités militaires françaises et financement commun européen.",
    evidenceNote: "Le gain français de 3 000 millions d'euros par an est une hypothèse de mutualisation du jeu; il dépend des dépenses nationales réellement substituées et des coûts de transition.",
    options: [
      { id: "adopt", label: "Créer l'armée européenne", summary: "Des forces passent sous commandement commun et les États partagent dépenses et décisions d'engagement.", budgetDelta: 3_000, beneficiaries: ["capacités européennes", "mutualisation"], contributors: ["autonomie militaire nationale"], uncertainty: "forte" },
      { id: "keep", label: "Conserver des armées nationales", summary: "Les coopérations continuent sans transfert permanent du commandement.", budgetDelta: 0, beneficiaries: ["souveraineté militaire"], contributors: ["mutualisation européenne"] },
    ],
  }),
  standalonePolicy({
    id: "nationaliser-les-entreprises-strategiques", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il nationaliser les grandes entreprises stratégiques ?",
    context: "L'État prend le contrôle d'entreprises de l'énergie, des transports ou de la défense. Il récupère la stratégie et assume le prix d'achat, les dettes et les risques industriels.",
    sourceKeys: ["ddhc-article-17", "ape-portefeuille", "cour-finances-2025", "defense-lpm"], evidenceLabel: "Participations publiques, valorisations et enjeux de souveraineté industrielle.",
    evidenceNote: "Les 25 milliards d'euros sont une hypothèse de panier et de valorisation du jeu. La valeur du portefeuille APE existant n'est pas le prix des entreprises à acquérir.",
    options: [
      { id: "adopt", label: "Nationaliser les entreprises clés", summary: "L'État contrôle les décisions stratégiques et finance l'acquisition des actionnaires privés.", budgetDelta: -25_000, beneficiaries: ["État stratège", "salariés protégés"], contributors: ["finances publiques", "actionnaires privés"], uncertainty: "forte" },
      { id: "keep", label: "Conserver les participations actuelles", summary: "L'État garde ses leviers existants sans acheter de nouveaux blocs de contrôle.", budgetDelta: 0, beneficiaries: ["finances publiques", "actionnaires privés"], contributors: ["contrôle public"] },
    ],
  }),
].map(policyDecision);
