import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateBusinessCase, minimumPrice, offerEconomics, type Offer } from './business-model.ts';

const workshop: Offer = {id:'atelier', price:1200, deliveryHours:6, acquisitionHours:3, cashCost:30, feeRate:.02};
const dossier: Offer = {id:'dossier', price:2400, deliveryHours:12, acquisitionHours:5, cashCost:90, feeRate:.02};

test('the business case includes sales time, delivery, editorial work and fees once', () => {
  const result = evaluateBusinessCase({hourlyCost:60, fixedCashCost:150, editorialHours:40,
    offers:[{...workshop,quantity:3},{...dossier,quantity:1}]});
  assert.deepEqual(result, {revenue:6000, contribution:3060, fixedCost:2550, result:510,
    hours:84, breakEvenByOffer:{atelier:5,dossier:3}});
  assert.equal(offerEconomics(workshop,60).contribution,606);
});

test('zero sales preserve fixed costs and unprofitable offers have no finite break-even', () => {
  const result = evaluateBusinessCase({hourlyCost:60,fixedCashCost:150,editorialHours:40,offers:[{...workshop,price:100,quantity:0}]});
  assert.equal(result.result,-2550);
  assert.equal(result.breakEvenByOffer.atelier,null);
  assert.equal(offerEconomics({...workshop,price:0},60).margin,null);
});

test('a price floor achieves the requested margin including transaction fees', () => {
  const floor = minimumPrice(workshop,60,.4);
  assert.ok(Math.abs(floor - 982.7586206896552) < .000001);
  assert.ok(Math.abs(offerEconomics({...workshop,price:floor},60).margin! - .4) < .000001);
});

test('invalid assumptions cannot produce plausible forecasts', () => {
  for (const value of [NaN,Infinity,-1]) assert.throws(()=>offerEconomics({...workshop,deliveryHours:value},60));
  assert.throws(()=>minimumPrice(workshop,60,.99));
  assert.throws(()=>evaluateBusinessCase({hourlyCost:60,fixedCashCost:0,editorialHours:0,offers:[{...workshop,quantity:.5}]}));
  assert.throws(()=>evaluateBusinessCase({hourlyCost:60,fixedCashCost:0,editorialHours:0,offers:[{...workshop,quantity:1},{...workshop,quantity:1}]}));
});
