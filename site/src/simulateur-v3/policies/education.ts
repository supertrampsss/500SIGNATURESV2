import { existingPolicy, policyDecision, standalonePolicy, type ExistingPolicyCopy } from "../policy-catalogue.ts";

const CHAPTER = "education-housing-family";
const p = (copy: Omit<ExistingPolicyCopy, "chapterId">) => existingPolicy({ ...copy, chapterId: CHAPTER });

export const EDUCATION_DECISIONS = [
  p({
    id: "revaloriser-les-enseignants-de-5", kind: "gestion",
    title: "Faut-il augmenter tous les enseignants de 5 % ?",
    context: "La hausse améliore immédiatement les rémunérations. Son effet sur l'attractivité dépend aussi des débuts de carrière, des conditions de travail et des affectations.",
    adoptLabel: "Augmenter de 5 %", adoptSummary: "Tous les enseignants gagnent davantage et l'État finance la hausse chaque année.",
    keepLabel: "Conserver la grille actuelle", keepSummary: "La masse salariale n'augmente pas et le décrochage d'attractivité reste à traiter autrement.",
    beneficiaries: ["enseignants"], contributors: ["finances publiques"], sourceKeys: ["depp-ecole-2025", "education-chiffres-2025"],
  }),
  p({
    id: "etendre-le-dedoublement-des-classes-au-cm1", kind: "gestion",
    title: "Faut-il étendre les classes dédoublées au CM1 et au CM2 ?",
    context: "Des classes plus petites mobilisent davantage de professeurs et de salles. Le ciblage en éducation prioritaire concentre les moyens sur les élèves les plus exposés.",
    adoptLabel: "Étendre le dédoublement", adoptSummary: "Les élèves concernés gagnent des classes plus petites et l'Éducation nationale finance les postes.",
    keepLabel: "Conserver le périmètre actuel", keepSummary: "Les moyens restent concentrés sur les niveaux déjà dédoublés.",
    beneficiaries: ["élèves de CM1 et CM2 en éducation prioritaire"], contributors: ["finances publiques", "autres besoins scolaires"], sourceKeys: ["depp-ecole-2025", "education-chiffres-2025"],
  }),
  p({
    id: "recentrer-le-pass-culture", kind: "gestion",
    title: "Faut-il recentrer fortement le pass Culture ?",
    context: "Le recentrage limite les achats individuels et privilégie des actions collectives ou des publics ciblés. L'économie reste faible face au budget de l'éducation.",
    adoptLabel: "Recentrer le pass", adoptSummary: "Les crédits individuels baissent et les actions jugées prioritaires sont conservées.",
    keepLabel: "Conserver le pass actuel", keepSummary: "Les jeunes gardent leur liberté d'achat et l'économie n'est pas réalisée.",
    beneficiaries: ["finances publiques", "actions culturelles ciblées"], contributors: ["jeunes utilisateurs"], sourceKeys: ["budget-niches-2026", "depp-ecole-2025"],
  }),
  p({
    id: "doubler-les-bourses-etudiantes-sur-criteres", kind: "gestion",
    title: "Faut-il doubler les bourses étudiantes sur critères sociaux ?",
    context: "La hausse réduit le besoin de travailler pendant les études pour les boursiers. Elle crée un coût récurrent et des écarts plus nets autour des seuils.",
    adoptLabel: "Doubler les bourses", adoptSummary: "Les étudiants modestes reçoivent davantage et le budget de l'État augmente fortement.",
    keepLabel: "Conserver le barème", keepSummary: "La dépense reste stable et les boursiers gardent le niveau d'aide actuel.",
    beneficiaries: ["étudiants boursiers"], contributors: ["finances publiques"], sourceKeys: ["education-chiffres-2025", "insee-france-sociale-2025"],
  }),
  p({
    id: "financer-100-000-logements-sociaux-de-plus", kind: "transformation",
    title: "Faut-il financer 100 000 logements sociaux supplémentaires par an ?",
    context: "L'aide accélère la construction si foncier, permis et entreprises suivent. Les crédits sont immédiats, les logements arrivent plusieurs années plus tard.",
    adoptLabel: "Financer 100 000 logements", adoptSummary: "Les bailleurs lancent davantage de programmes et l'État augmente ses aides à la pierre.",
    keepLabel: "Conserver la programmation", keepSummary: "La dépense n'augmente pas et la production reste au rythme actuel.",
    beneficiaries: ["demandeurs de logement social", "bâtiment", "collectivités"], contributors: ["finances publiques"], sourceKeys: ["budget-niches-2026", "ofgl-rapports"],
  }),
  p({
    id: "revaloriser-les-apl-de-5", kind: "transformation",
    title: "Faut-il augmenter les aides au logement de 5 % ?",
    context: "L'aide augmente le revenu disponible des locataires éligibles. Dans les zones tendues, une partie peut être absorbée par les loyers si l'offre ne suit pas.",
    adoptLabel: "Revaloriser les APL", adoptSummary: "Les allocataires reçoivent davantage et l'État augmente sa dépense annuelle.",
    keepLabel: "Conserver le barème", keepSummary: "La dépense reste stable et les aides ne rattrapent pas davantage les loyers.",
    beneficiaries: ["locataires allocataires"], contributors: ["finances publiques"], sourceKeys: ["drees-minima-2025", "insee-france-sociale-2025"],
  }),
  p({
    id: "ouvrir-200-000-places-de-creche", kind: "transformation",
    title: "Faut-il ouvrir 200 000 places de crèche ?",
    context: "Les places facilitent l'emploi des parents. Le bâtiment ne suffit pas: il faut recruter des professionnels déjà rares et partager le coût avec les collectivités.",
    adoptLabel: "Ouvrir 200 000 places", adoptSummary: "L'offre de garde augmente et État, CAF et collectivités financent personnel et locaux.",
    keepLabel: "Conserver la trajectoire", keepSummary: "La dépense n'augmente pas et les files d'attente restent fortes.",
    beneficiaries: ["jeunes enfants", "parents actifs"], contributors: ["finances sociales", "collectivités"], sourceKeys: ["drees-minima-2025", "ofgl-rapports"],
  }),
  p({
    id: "allocations-familiales-des-le-premier-enfant", kind: "transformation",
    title: "Faut-il verser les allocations familiales dès le premier enfant ?",
    context: "Le droit s'ouvre aux familles d'un seul enfant. La mesure élargit fortement le nombre de bénéficiaires sans cibler uniquement les ménages modestes.",
    adoptLabel: "Ouvrir dès le premier enfant", adoptSummary: "Les familles avec un enfant reçoivent une nouvelle allocation et la branche famille paie davantage.",
    keepLabel: "Conserver l'ouverture au deuxième enfant", keepSummary: "La dépense reste ciblée sur les familles plus nombreuses.",
    beneficiaries: ["familles avec un enfant"], contributors: ["finances sociales"], sourceKeys: ["drees-minima-2025"],
  }),
  standalonePolicy({
    id: "cheque-education-par-eleve", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il financer chaque élève par un chèque éducation ?",
    context: "La dotation suit l'élève vers l'établissement public ou privé choisi. La concurrence augmente, mais la ségrégation et la survie des écoles peu demandées deviennent des choix explicites.",
    sourceKeys: ["depp-ecole-2025", "education-chiffres-2025", "itm-50-decisions"], evidenceLabel: "Dépense par élève, résultats et écarts sociaux entre établissements.",
    options: [
      { id: "adopt", label: "Créer le chèque éducation", summary: "Le financement suit le choix des familles et les établissements perdant des élèves perdent aussi des moyens.", budgetDelta: -1_000, beneficiaries: ["familles mobiles", "établissements attractifs"], contributors: ["établissements évités", "mixité scolaire"], uncertainty: "forte" },
      { id: "keep", label: "Conserver le financement des établissements", summary: "Les moyens restent attribués par réseau, territoire et caractéristiques des élèves.", budgetDelta: 0, beneficiaries: ["maillage scolaire", "établissements fragiles"], contributors: ["liberté de financement des familles"] },
    ],
  }),
  standalonePolicy({
    id: "supprimer-le-financement-public-du-prive", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il supprimer le financement public de l'enseignement privé ?",
    context: "L'État ne paie plus les enseignants des établissements sous contrat. Les familles, fermetures ou transferts d'élèves vers le public absorbent le changement.",
    sourceKeys: ["depp-ecole-2025", "education-chiffres-2025"], evidenceLabel: "Effectifs et financement des établissements publics et privés sous contrat.",
    options: [
      { id: "adopt", label: "Supprimer le financement", summary: "Les établissements privés financent seuls leur fonctionnement et le public doit accueillir les élèves transférés.", budgetDelta: 3_000, beneficiaries: ["finances publiques selon le transfert"], contributors: ["familles du privé", "établissements privés", "écoles publiques d'accueil"], uncertainty: "forte" },
      { id: "keep", label: "Maintenir les contrats", summary: "L'État continue de payer les enseignants en échange des obligations du contrat.", budgetDelta: 0, beneficiaries: ["familles du privé", "continuité scolaire"], contributors: ["finances publiques"] },
    ],
  }),
  p({
    id: "generaliser-le-service-national-universel", kind: "rupture",
    title: "Faut-il rendre le service national universel obligatoire ?",
    context: "Une classe d'âge entière suit un séjour puis une mission. Hébergement, encadrement et logistique doivent être multipliés à une échelle proche de l'école.",
    adoptLabel: "Rendre le service obligatoire", adoptSummary: "Tous les jeunes accomplissent le parcours et l'État finance une organisation nationale massive.",
    keepLabel: "Conserver le volontariat", keepSummary: "Le dispositif reste limité aux volontaires et son coût demeure contenu.",
    beneficiaries: ["cohésion nationale", "structures d'accueil"], contributors: ["jeunes contraints", "finances publiques"], sourceKeys: ["education-chiffres-2025", "defense-lpm"],
  }),
  standalonePolicy({
    id: "autonomie-complete-des-etablissements", chapterId: CHAPTER, kind: "rupture",
    title: "Faut-il donner aux établissements la maîtrise du recrutement et des rémunérations ?",
    context: "Chefs d'établissement et conseils locaux recrutent et rémunèrent dans une enveloppe. L'adaptation locale augmente, tout comme les écarts entre établissements attractifs et difficiles.",
    sourceKeys: ["depp-ecole-2025", "education-chiffres-2025"], evidenceLabel: "Affectation des enseignants, résultats et inégalités territoriales.",
    options: [
      { id: "adopt", label: "Donner l'autonomie complète", summary: "Chaque établissement compose son équipe et ses primes dans son budget.", budgetDelta: 500, beneficiaries: ["établissements attractifs", "directions locales"], contributors: ["statut national", "établissements difficiles"], uncertainty: "forte" },
      { id: "keep", label: "Conserver l'affectation nationale", summary: "Les carrières et rémunérations restent nationales, avec des marges locales limitées.", budgetDelta: 0, beneficiaries: ["égalité statutaire", "enseignants"], contributors: ["autonomie locale"] },
    ],
  }),
].map(policyDecision);
