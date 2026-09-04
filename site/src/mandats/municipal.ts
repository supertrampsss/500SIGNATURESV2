import type { Domain, Finance, Ledger } from "./types.ts";
import { clamp } from "./types.ts";

/** All financial inputs are synthetic millions, not the accounts of a real city. */
export function municipalBudget(f: Finance): Ledger {
  const interest = f.debt * f.rate;
  const savings = f.revenue - f.operating - interest;
  const repayment = f.repayment;
  if (repayment > f.debt) throw new Error("Le remboursement dépasse la dette restante.");
  if (savings < 0) throw new Error(`Fonctionnement déficitaire de ${(-savings).toFixed(1)} M€ : choisissez une recette ou une dépense compatible.`);
  // Conservative model gate: principal is covered by current own savings only.
  if (savings < repayment) throw new Error(`Épargne insuffisante pour rembourser le capital : il manque ${(repayment - savings).toFixed(1)} M€.`);
  const fundingGap = f.investment + repayment - savings - f.grants - f.cash;
  const borrowing = Math.max(0, fundingGap);
  if (borrowing > f.investment) throw new Error("L'emprunt ne peut financer que l'investissement.");
  const cashChange = savings + f.grants + borrowing - f.investment - repayment;
  return { revenue: f.revenue, operating: f.operating, interest, savings, repayment, investment: f.investment, grants: f.grants, borrowing, cashChange, deficit: 0, debt: f.debt + borrowing - repayment, gdp: 0 };
}

export const municipal: Domain = {
  id: "municipal", label: "Gouverner une ville", place: "Val-sur-Rive", role: "Maire et équipe municipale", duration: "6 tours · 4 à 6 min", turns: 6, unit: "M€",
  intro: "Une ville, trois quartiers, six années. Les écoles vieillissent, les étés deviennent difficiles et chaque projet engage les budgets suivants. Quel héritage laisserez-vous ?",
  scope: "Ville fictive. Budget communal simplifié, en millions d'euros. Les quartiers, montants et impacts sont des hypothèses de jeu. Les règles distinguent fonctionnement, investissement et remboursement du capital.",
  objectives: ["Préserver des services au-dessus de 60/100", "Améliorer la résilience sans épuiser l'épargne", "Ne pas laisser l'entretien se dégrader"],
  initial: () => ({ finance: { revenue: 100, operating: 86, debt: 60, cash: 8, rate: .035, repayment: 4, investment: 4, grants: 2, gdp: 0, growth: 0, deflator: 0, marketRate: .035, stockFlow: 0 }, metrics: { services: 58, cohesion: 55, resilience: 34, trust: 58, assets: 52 }, areas: [ { id: "rives", name: "Les Rives", need: "Chaleur et espaces publics", services: 52, resilience: 28, x: 29, y: 66 }, { id: "centre", name: "Le Centre", need: "Équipements vieillissants", services: 70, resilience: 43, x: 51, y: 36 }, { id: "hauts", name: "Les Hauts", need: "Écoles et accès aux services", services: 42, resilience: 31, x: 77, y: 54 } ] }),
  dossiers: [
    { category: "Écoles & patrimoine", title: "Rénover maintenant, ou tenir encore ?", story: "Aux Hauts, les salles de classe surchauffent. Une rénovation prend deux ans. Une réparation permet de passer l'hiver, mais laisse la facture énergétique intacte.", advisor: "Direction des bâtiments · La rénovation porte sur les locaux, pas sur les enseignants.", choices: [
      { id: "ecoles", title: "Rénover les écoles", description: "Isolation, ventilation et cours ombragées. Deux ans de travaux.", cost: "12 M€ d'investissement", benefit: "Services +12 à la livraison", sacrifice: "Trésorerie engagée aujourd'hui", effect: { investment: 12, trust: 3 }, delayed: { after: 2, label: "Les écoles des Hauts ouvrent après rénovation : services améliorés et 1,5 M€/an économisés.", effect: { operating: -1.5, services: 12, resilience: 9, assets: 14, area: "hauts" } } },
      { id: "reparer", title: "Réparer l'essentiel", description: "Toitures et sécurité d'abord. Le confort attendra.", cost: "3 M€ d'investissement", benefit: "Patrimoine +5 immédiatement", sacrifice: "Pas d'économie d'énergie", effect: { investment: 3, assets: 5, services: 3, area: "hauts" } },
      { id: "reporter", title: "Reporter le chantier", description: "Conserver les moyens pour un autre besoin cette année.", cost: "Aucun chantier supplémentaire", benefit: "Préserver la trésorerie", sacrifice: "Entretien plus coûteux dans deux ans", effect: { trust: -4, assets: -5 }, delayed: { after: 2, label: "La réparation différée devient urgente : 2 M€/an de charges supplémentaires.", effect: { operating: 2, assets: -6, services: -4, area: "hauts" } } },
    ] },
    { category: "Recettes & pouvoir d'achat", title: "Qui finance la suite du mandat ?", story: "Les projets ont besoin de recettes durables. Une hausse fiscale donne de la marge, mais pèse sur les propriétaires. Une baisse est populaire, mais permanente.", advisor: "Direction financière · Les recettes choisies se prolongent jusqu'à la fin du mandat.", choices: [
      { id: "recettes", title: "Renforcer les recettes locales", description: "Ajuster la fiscalité dans le cadre simplifié du scénario.", cost: "+4 M€ de recettes par an", benefit: "Marge d'investissement accrue", sacrifice: "Confiance −6, cohésion −3", effect: { revenue: 4, trust: -6, cohesion: -3 } },
      { id: "stabilite", title: "Maintenir les taux", description: "Préserver l'équilibre actuel, avec moins de projets possibles.", cost: "Recettes inchangées", benefit: "Visibilité pour les habitants", sacrifice: "Aucune marge supplémentaire", effect: { trust: 2 } },
      { id: "baisse", title: "Alléger la fiscalité", description: "Rendre du pouvoir d'achat et réduire durablement les recettes.", cost: "−3 M€ de recettes par an", benefit: "Confiance +7", sacrifice: "Moins de capacité d'autofinancement", effect: { revenue: -3, trust: 7, cohesion: 2 } },
    ] },
    { category: "Crise climatique", title: "La chaleur met les quartiers à l'épreuve", story: "Un été très chaud est annoncé. Les Rives disposent de peu d'ombre. L'aide d'urgence protège cette année ; l'adaptation met du temps à porter ses fruits.", advisor: "Services de proximité · La gravité du choc dépend de votre résilience et de la graine du scénario.", choices: [
      { id: "ombre", title: "Créer des îlots de fraîcheur", description: "Désimperméabiliser et planter. Livraison l'an prochain.", cost: "8 M€ d'investissement", benefit: "Résilience +18 à la livraison", sacrifice: "Protection incomplète cet été", effect: { investment: 8, trust: 2 }, delayed: { after: 1, label: "Les îlots de fraîcheur des Rives sont livrés.", effect: { resilience: 18, cohesion: 5, assets: 5, area: "rives" } } },
      { id: "urgence", title: "Ouvrir des refuges frais", description: "Accueillir les habitants fragiles et renforcer les équipes chaque été.", cost: "+2 M€ de charges par an", benefit: "Résilience +9 dès maintenant", sacrifice: "Une charge récurrente", effect: { operating: 2, resilience: 9, cohesion: 6, area: "rives" } },
      { id: "mobilisation", title: "Mobiliser le réseau existant", description: "Adapter les horaires et coordonner les associations.", cost: "Sans nouveau programme", benefit: "Préserver les moyens financiers", sacrifice: "Protection plus limitée", effect: { resilience: 3, trust: -2, area: "rives" } },
    ] },
    { category: "Services & livraison", title: "Ouvrir plus, ou entretenir mieux ?", story: "Le Centre réclame un nouvel équipement. Les équipes alertent : chaque ouverture ajoute des charges, chaque bâtiment existant a besoin d'entretien.", advisor: "Direction des services · Un seul nouveau programme peut être lancé cette année.", choices: [
      { id: "maison", title: "Ouvrir une maison des services", description: "Regrouper l'accueil municipal aux Hauts, dès l'an prochain.", cost: "14 M€ puis +2 M€/an", benefit: "Services +15 à la livraison", sacrifice: "Coût durable de fonctionnement", effect: { investment: 14, trust: 3 }, delayed: { after: 1, label: "La maison des services ouvre aux Hauts : +2 M€/an de fonctionnement.", effect: { operating: 2, services: 15, cohesion: 9, area: "hauts" } } },
      { id: "entretien", title: "Remettre les équipements à niveau", description: "Réhabiliter les bâtiments existants du Centre.", cost: "7 M€ d'investissement", benefit: "Patrimoine +14, services +5", sacrifice: "Pas de nouvel équipement", effect: { investment: 7, assets: 14, services: 5, area: "centre" } },
      { id: "equipes", title: "Renforcer l'accueil de proximité", description: "Augmenter les amplitudes d'ouverture avec les bâtiments actuels.", cost: "+1 M€ de charges par an", benefit: "Services +7, cohésion +5", sacrifice: "Patrimoine inchangé", effect: { operating: 1, services: 7, cohesion: 5, area: "hauts" } },
    ] },
    { category: "Investissement & subventions", title: "Une aide à saisir, un projet à financer", story: "Une enveloppe de cofinancement est proposée pour rénover les espaces publics des Rives. L'aide finance uniquement ce chantier, pas les dépenses courantes.", advisor: "Direction financière · Une subvention n'efface ni votre part du financement ni les futurs coûts.", choices: [
      { id: "subvention", title: "Engager le projet cofinancé", description: "Espaces accessibles, sols perméables et cheminements piétons.", cost: "12 M€ dont 6 M€ subventionnés", benefit: "Résilience +10, services +8", sacrifice: "6 M€ restent à financer", effect: { investment: 12, grants: 6, resilience: 10, services: 8, assets: 6, area: "rives" } },
      { id: "petitprojet", title: "Réduire le périmètre", description: "Traiter les accès prioritaires avec un chantier plus petit.", cost: "4 M€ sans subvention", benefit: "Services +5", sacrifice: "Une transformation limitée", effect: { investment: 4, services: 5, assets: 4, area: "rives" } },
      { id: "epargne", title: "Garder une réserve", description: "Renoncer à l'aide pour préserver votre marge de manœuvre.", cost: "Aucun chantier supplémentaire", benefit: "Trésorerie disponible", sacrifice: "Les besoins des Rives attendent", effect: { trust: -3 } },
    ] },
    { category: "Héritage", title: "Que laissez-vous à votre successeur ?", story: "Dernière année. Votre bilan comptera les services, la résilience, les finances et l'état des équipements, y compris les engagements qui dépassent le mandat.", advisor: "Conseil municipal · Aucun score ne prédit une élection.", choices: [
      { id: "dette", title: "Accélérer le désendettement", description: "Rembourser 4 M€ de capital supplémentaire sur vos ressources propres.", cost: "4 M€ de remboursement", benefit: "Dette et intérêts futurs réduits", sacrifice: "Pas de nouveau projet", effect: { repayment: 4, trust: 2 } },
      { id: "renover", title: "Transmettre un patrimoine solide", description: "Réhabiliter les équipements les plus usés.", cost: "9 M€ d'investissement", benefit: "Patrimoine +16, services +4", sacrifice: "Mobiliser la capacité de financement", effect: { investment: 9, assets: 16, services: 4, area: "centre" } },
      { id: "solidarite", title: "Renforcer les services essentiels", description: "Pérenniser l'accompagnement et l'accueil de proximité.", cost: "+1 M€ de charges par an", benefit: "Cohésion +10, services +6", sacrifice: "Charge transmise au mandat suivant", effect: { operating: 1, cohesion: 10, services: 6, area: "hauts" } },
    ] },
  ],
  event: (g) => g.turn === 2 ? { label: "Canicule : les services s'adaptent", effect: { services: -(7 + g.seed % 3) * (1 - g.metrics.resilience / 100), trust: -3 } } : g.turn === 4 ? { label: "Usure des équipements : votre entretien compte", effect: { services: -Math.max(0, 65 - g.metrics.assets) / 6, trust: -1 } } : { label: "L'année suit son cours", effect: {} },
  settle: municipalBudget,
  prepare: (f) => ({ ...f, investment: 4, grants: 2, repayment: Math.min(4, f.debt) }),
  sustainability: (g) => clamp(55 + (60 - g.finance.debt) * .65 + (g.finance.revenue - g.finance.operating - g.finance.debt * g.finance.rate - 4) * 2),
};
