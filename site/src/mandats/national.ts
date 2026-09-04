import type { Domain, Finance, Ledger } from "./types.ts";
import { clamp } from "./types.ts";

/** Consolidated APU scenario, in synthetic billions. Internal transfers excluded. */
export function nationalBudget(f: Finance): Ledger {
  const interest = f.debt * f.rate;
  const deficit = f.operating + interest + f.investment - f.revenue;
  const debt = f.debt + deficit + f.stockFlow;
  if (debt < 0) throw new Error("Ce scénario ne modélise pas une position nette créditrice.");
  return { revenue: f.revenue, operating: f.operating, interest, savings: f.revenue - f.operating - interest, repayment: 0, investment: f.investment, grants: 0, borrowing: deficit, cashChange: 0, deficit, debt, gdp: f.gdp * (1 + f.growth) * (1 + f.deflator) };
}
export const national: Domain = {
  id: "national", label: "Gouverner la France", place: "France · scénario fictif", role: "Gouvernement national", duration: "5 tours · 3 à 5 min", turns: 5, unit: "Md€",
  intro: "Des services sous tension, une dette héritée et des besoins d'investissement. Fiscalité, énergie, cohésion : vous disposez de cinq années pour choisir une trajectoire.",
  scope: "Scénario fictif portant sur les administrations publiques consolidées (APU), et non le seul budget de l'État. Les leviers supposent une coordination abstraite entre État, organismes sociaux et collectivités. Aucun montant ne représente la situation actuelle de la France.",
  objectives: ["Préserver les services et la cohésion", "Limiter la progression de la dette rapportée au PIB", "Réduire la vulnérabilité aux chocs énergétiques"],
  initial: () => ({ finance: { revenue: 1490, operating: 1500, investment: 40, debt: 3200, cash: 0, rate: .018, marketRate: .035, repayment: 0, grants: 0, gdp: 2800, growth: .012, deflator: .018, stockFlow: 0 }, metrics: { services: 57, cohesion: 52, resilience: 39, trust: 52, assets: 59 }, areas: [ { id: "metropoles", name: "Métropoles", need: "Logement et services", services: 69, resilience: 48, x: 49, y: 28 }, { id: "industrie", name: "Bassins industriels", need: "Énergie et reconversion", services: 49, resilience: 25, x: 68, y: 44 }, { id: "rural", name: "Espaces ruraux", need: "Accès aux services", services: 39, resilience: 43, x: 34, y: 55 }, { id: "littoraux", name: "Territoires littoraux", need: "Adaptation climatique", services: 55, resilience: 32, x: 53, y: 75 } ] }),
  dossiers: [
    { category: "Fiscalité", title: "Donner des moyens, à quel prix ?", story: "Les recettes ne couvrent pas les dépenses héritées. Un choix fiscal agit immédiatement sur le solde et durablement sur les ménages ou les entreprises.", advisor: "Conseil budgétaire · Les rendements sont des hypothèses fixes de scénario, pas des estimations fiscales.", choices: [
      { id: "assiette", title: "Élargir l'assiette fiscale", description: "Réduire des exemptions dans ce scénario simplifié.", cost: "+30 Md€ de recettes par an", benefit: "Déficit réduit", sacrifice: "Confiance −6", effect: { revenue: 30, trust: -6, cohesion: 3 } },
      { id: "neutre", title: "Maintenir la fiscalité", description: "Conserver les règles et traiter la dépense ensuite.", cost: "Recettes inchangées", benefit: "Stabilité immédiate", sacrifice: "Besoin de financement inchangé", effect: { trust: 2 } },
      { id: "allegement", title: "Alléger les prélèvements", description: "Réduire la charge des contribuables, avec moins de recettes garanties.", cost: "−20 Md€ de recettes par an", benefit: "Confiance +7", sacrifice: "Dette accrue, croissance non garantie", effect: { revenue: -20, trust: 7, cohesion: 2 } },
    ] },
    { category: "Services publics", title: "Réparer le quotidien ou préparer demain ?", story: "Les espaces ruraux peinent à maintenir l'accès aux services. Un programme immédiat aide rapidement ; la modernisation prend du temps.", advisor: "Coordination des services · Le périmètre APU inclut ici plusieurs financeurs, sans compter deux fois leurs transferts.", choices: [
      { id: "acces", title: "Renforcer l'accès aux services", description: "Soutenir durablement les capacités de proximité.", cost: "+15 Md€ de charges par an", benefit: "Services +12, cohésion +8", sacrifice: "Un déficit plus élevé", effect: { operating: 15, services: 12, cohesion: 8, area: "rural" } },
      { id: "moderniser", title: "Moderniser les infrastructures", description: "Investir aujourd'hui pour livrer dans deux ans.", cost: "25 Md€ d'investissement", benefit: "Services +14 à la livraison", sacrifice: "Effet différé et dette immédiate", effect: { investment: 25 }, delayed: { after: 2, label: "Les infrastructures modernisées entrent en service : 3 Md€/an de charges évitées dans le modèle.", effect: { services: 14, operating: -3, assets: 12, area: "rural" } } },
      { id: "stabiliser", title: "Stabiliser les moyens", description: "Maintenir l'offre héritée et limiter la hausse des charges.", cost: "Pas de dépense supplémentaire", benefit: "Solde préservé", sacrifice: "Les difficultés d'accès persistent", effect: { trust: -3, cohesion: -2 } },
    ] },
    { category: "Crise énergétique", title: "Protéger tout de suite, transformer ensuite ?", story: "Un choc énergétique touche les bassins industriels. Une aide protège l'activité cette année ; un investissement réduit l'exposition future.", advisor: "Conseil énergie · Le choc et ses effets sont hypothétiques. Une production électrique ne détermine pas seule le prix final.", choices: [
      { id: "energie", title: "Investir dans la sobriété et les réseaux", description: "Accélérer l'efficacité énergétique. Livraison l'an prochain.", cost: "30 Md€ d'investissement", benefit: "Résilience +20 à la livraison", sacrifice: "Peu de protection immédiate", effect: { investment: 30 }, delayed: { after: 1, label: "Le programme énergétique réduit l'exposition des bassins industriels.", effect: { resilience: 20, assets: 8, operating: -4, growth: .002, area: "industrie" } } },
      { id: "bouclier", title: "Déployer une aide ciblée", description: "Soutenir les acteurs les plus exposés pendant l'année du choc.", cost: "18 Md€ cette année", benefit: "Cohésion +9, confiance +6", sacrifice: "Aucune transformation structurelle", effect: { operating: 18, cohesion: 9, trust: 6 }, delayed: { after: 1, label: "L'aide énergétique temporaire arrive à son terme.", effect: { operating: -18 } } },
      { id: "adapter", title: "Accompagner sans nouveau budget", description: "Réorienter l'appui existant et préserver les ressources.", cost: "Aucune enveloppe supplémentaire", benefit: "Déficit contenu", sacrifice: "Cohésion −5 pendant le choc", effect: { cohesion: -5, trust: -3 } },
    ] },
    { category: "Dette & financement", title: "Les intérêts prennent de la place", story: "Les emprunts renouvelés coûtent davantage. Ajuster brutalement les dépenses peut fragiliser les services ; attendre transmet la charge aux années suivantes.", advisor: "Conseil financier · Le taux moyen converge progressivement vers le taux de marché, pas instantanément sur toute la dette.", choices: [
      { id: "consolider", title: "Réduire les dépenses courantes", description: "Une correction budgétaire rapide dans le modèle.", cost: "−25 Md€ de charges par an", benefit: "Déficit réduit", sacrifice: "Services −9, cohésion −6", effect: { operating: -25, services: -9, cohesion: -6, trust: -4 } },
      { id: "progressif", title: "Ajuster progressivement", description: "Échelonner l'effort avec une correction plus modeste.", cost: "−10 Md€ de charges par an", benefit: "Services mieux préservés", sacrifice: "Dette plus longue à stabiliser", effect: { operating: -10, services: -3, trust: -2 } },
      { id: "soutenir", title: "Préserver l'intégralité des moyens", description: "Accepter le besoin de financement pour soutenir les services.", cost: "Dépenses inchangées", benefit: "Services +3, confiance +3", sacrifice: "Charge d'intérêts persistante", effect: { services: 3, trust: 3 } },
    ] },
    { category: "Héritage national", title: "Quelle capacité d'action pour demain ?", story: "L'ultime arbitrage ne résume pas le mandat. La dette, les services et les investissements livrés composent ensemble votre héritage.", advisor: "Bilan de mandat · Les scores sont des indices de jeu, pas une recommandation politique.", choices: [
      { id: "resilience", title: "Adapter les territoires exposés", description: "Renforcer les infrastructures des territoires littoraux.", cost: "24 Md€ d'investissement", benefit: "Résilience +12, patrimoine +8", sacrifice: "Dette accrue", effect: { investment: 24, resilience: 12, assets: 8, area: "littoraux" } },
      { id: "equilibre", title: "Conforter les recettes", description: "Constituer une marge budgétaire durable.", cost: "+15 Md€ de recettes par an", benefit: "Trajectoire financière améliorée", sacrifice: "Confiance −4", effect: { revenue: 15, trust: -4 } },
      { id: "cohesion", title: "Préserver la cohésion", description: "Pérenniser un programme d'accès aux services.", cost: "+8 Md€ de charges par an", benefit: "Cohésion +10, services +5", sacrifice: "Engagement de dépense récurrente", effect: { operating: 8, cohesion: 10, services: 5, area: "rural" } },
    ] },
  ],
  event: (g) => g.turn === 2 ? { label: "Choc énergétique : exposition inégale", effect: { services: -4, cohesion: -(8 + g.seed % 4) * (1 - g.metrics.resilience / 100), growth: -.006 } } : g.turn === 3 ? { label: "Reprise partielle après le choc", effect: { growth: .004, trust: 1 } } : { label: "Les engagements antérieurs se poursuivent", effect: {} },
  settle: nationalBudget,
  prepare: (f) => ({ ...f, investment: 40, grants: 0, repayment: 0, rate: f.rate + .2 * (f.marketRate - f.rate) }),
  sustainability: (g) => clamp(65 - (g.finance.debt / g.finance.gdp * 100 - 3200 / 2800 * 100) * 3),
};
