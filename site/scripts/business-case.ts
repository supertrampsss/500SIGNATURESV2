import { evaluateBusinessCase, type AdvertisingCase } from './business-model.ts';

// Hypothèses de sensibilité, pas des benchmarks de marché ni des résultats observés.
const baseline: AdvertisingCase = {
  monthlyPageViews: 100_000, editorialShare: .7, slotsPerEditorialPage: 1.5,
  slotReachRate: .75, programmaticEligibilityRate: .7, fillRate: .9, netImpressionRpm: 4,
  directImpressions: 0, directNetCpm: 0, directSalesHours: 0,
  monthlyCashCost: 150, editorialHours: 40, adOperationsHours: 4, hourlyCost: 60,
};
const scenarios = [
  { name: 'Prudent', assumptions: { slotReachRate: .6, programmaticEligibilityRate: .5, fillRate: .75, netImpressionRpm: 2 } },
  { name: 'Central', assumptions: {} },
  { name: 'Favorable', assumptions: { slotReachRate: .85, programmaticEligibilityRate: .8, fillRate: .95, netImpressionRpm: 6 } },
];
console.log(JSON.stringify({
  status: 'Hypothèses mensuelles en euros hors taxes, avant coûts propres et impôts. Aucune audience ni recette mesurée.',
  baseline,
  scenarios: scenarios.map(s => ({ name: s.name, assumptions: { ...baseline, ...s.assumptions },
    volumes: [10_000, 100_000, 500_000, 1_000_000].map(monthlyPageViews => ({ monthlyPageViews,
      ...evaluateBusinessCase({ ...baseline, ...s.assumptions, monthlyPageViews }),
    })),
  })),
  pilotOneSlot: evaluateBusinessCase({ ...baseline, slotsPerEditorialPage: 1 }),
  directCampaignExample: evaluateBusinessCase({ ...baseline, directImpressions: 20_000, directNetCpm: 25, directSalesHours: 4 }),
}, null, 2));
