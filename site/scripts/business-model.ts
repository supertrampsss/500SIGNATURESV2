/** Internal planning only. These calculations do not set public prices or collect money. */
export type Offer = {
  id: string;
  price: number;
  deliveryHours: number;
  acquisitionHours: number;
  cashCost: number;
  feeRate: number;
};
export type BusinessCase = {
  hourlyCost: number;
  fixedCashCost: number;
  editorialHours: number;
  offers: Array<Offer & { quantity: number }>;
};

function nonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}: finite non-negative value required`);
}

export function offerEconomics(offer: Offer, hourlyCost: number) {
  for (const [key, value] of Object.entries(offer)) {
    if (key !== 'id') nonNegative(value as number, key);
  }
  nonNegative(hourlyCost, 'hourlyCost');
  if (offer.feeRate >= 1) throw new Error('feeRate must be below 1');
  const hours = offer.deliveryHours + offer.acquisitionHours;
  const labour = hours * hourlyCost;
  const cash = offer.cashCost + offer.price * offer.feeRate;
  const contribution = offer.price - cash - labour;
  return { hours, labour, cash, contribution, margin: offer.price > 0 ? contribution / offer.price : null };
}

export function minimumPrice(offer: Offer, hourlyCost: number, targetMargin: number): number {
  nonNegative(targetMargin, 'targetMargin');
  const costs = offerEconomics(offer, hourlyCost);
  const denominator = 1 - offer.feeRate - targetMargin;
  if (denominator <= 0) throw new Error('target margin and fees leave no room for delivery costs');
  return (costs.labour + offer.cashCost) / denominator;
}

export function evaluateBusinessCase(input: BusinessCase) {
  nonNegative(input.fixedCashCost, 'fixedCashCost');
  nonNegative(input.editorialHours, 'editorialHours');
  nonNegative(input.hourlyCost, 'hourlyCost');
  const ids = new Set<string>();
  const lines = input.offers.map(offer => {
    if (!offer.id || ids.has(offer.id)) throw new Error('offer ids must be unique and non-empty');
    ids.add(offer.id);
    if (!Number.isSafeInteger(offer.quantity) || offer.quantity < 0) throw new Error('quantity must be a non-negative integer');
    return { ...offer, ...offerEconomics(offer, input.hourlyCost) };
  });
  const revenue = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const contribution = lines.reduce((sum, line) => sum + line.contribution * line.quantity, 0);
  const deliveryAndSalesHours = lines.reduce((sum, line) => sum + line.hours * line.quantity, 0);
  const fixedCost = input.fixedCashCost + input.editorialHours * input.hourlyCost;
  return {
    revenue, contribution, fixedCost, result: contribution - fixedCost,
    hours: deliveryAndSalesHours + input.editorialHours,
    breakEvenByOffer: Object.fromEntries(lines.map(line => [line.id,
      line.contribution > 0 ? Math.ceil(fixedCost / line.contribution) : null])),
  };
}
