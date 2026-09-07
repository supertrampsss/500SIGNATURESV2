import { evaluateBusinessCase, minimumPrice, offerEconomics, type Offer } from './business-model.ts';

// Hypothèses de travail proposées, pas des ventes, des coûts ou des prix observés.
const offers: Offer[] = [
  { id: 'atelier', price: 1200, deliveryHours: 6, acquisitionHours: 3, cashCost: 30, feeRate: .02 },
  { id: 'dossier', price: 2400, deliveryHours: 12, acquisitionHours: 5, cashCost: 90, feeRate: .02 },
];
const hourlyCost = 60, fixedCashCost = 150, editorialHours = 40;
const scenarios = [
  { name: 'Aucune vente', quantities: [0, 0] },
  { name: 'Premier atelier', quantities: [1, 0] },
  { name: 'Trois ateliers et un dossier', quantities: [3, 1] },
  { name: 'Quatre ateliers et deux dossiers', quantities: [4, 2] },
];
console.log(JSON.stringify({
  status: 'Hypothèses proposées. Aucun revenu observé. Montants HT avant impôt.',
  assumptions: { hourlyCost, fixedCashCost, editorialHours, targetMargin: .4 },
  offers: offers.map(offer => ({...offer, ...offerEconomics(offer, hourlyCost), priceFloor: minimumPrice(offer, hourlyCost, .4)})),
  scenarios: scenarios.map(s => ({ name: s.name, ...evaluateBusinessCase({
    hourlyCost, fixedCashCost, editorialHours, offers: offers.map((offer, i) => ({...offer, quantity: s.quantities[i]})),
  }) })),
}, null, 2));
