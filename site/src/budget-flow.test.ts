import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetFlow, buildBudgetFlowModel } from './budget-flow.ts';

const rows = [
  { label: 'Éducation nationale', budget: 89.088e9, retirement: 28.456e9, estimated: true },
  { label: 'Intérieur', budget: 34.239e9, retirement: 10.310e9, estimated: true },
  { label: 'Défense', budget: 74.681e9, retirement: 9.131e9, estimated: true },
];

test('Tous les rubans et le collecteur utilisent une seule échelle monétaire', () => {
  const model = buildBudgetFlowModel(rows);
  for (const row of model.rows) {
    assert.equal(row.budgetHeight, row.budget * model.euroScale);
    assert.equal(row.retirementHeight, row.retirement * model.euroScale);
    assert.equal(row.remainingHeight, row.remaining * model.euroScale);
    assert.ok(Math.abs(row.budgetHeight - row.retirementHeight - row.remainingHeight) < 1e-12);
  }
  assert.equal(model.collectorWidth, model.totalRetirement * model.euroScale);
  for (let i = 1; i < model.rows.length; i++) {
    assert.equal(model.rows[i].collectorLeft, model.rows[i - 1].collectorRight);
  }
  assert.ok(Math.abs(model.rows.reduce((sum, row) => sum + row.retirementHeight, 0) - model.collectorWidth) < 1e-12);
  for (const row of model.rows) {
    const bendEnd = row.retirementTop + Math.max(80, row.retirementHeight + 24);
    assert.ok(model.nodeTop - 12 > bendEnd, 'Chaque courbe descend avant de rejoindre la flèche commune.');
  }
});

test('Le total Retraites additionne les montants exacts avant leur arrondi', () => {
  const model = buildBudgetFlowModel(rows);
  assert.equal(model.totalRetirement, 47.897e9);
  assert.equal(model.totalBudget, 198.008e9);
  assert.equal(model.totalRemaining, 150.111e9);
  assert.deepEqual(model.rows.map(row => row.remaining), [60.632e9, 23.929e9, 65.550e9]);
  const html = budgetFlow(rows);
  assert.match(html, /data-total-retirement-eur="47897000000"/);
  assert.match(html, /≈ 47,9 Md€/);
  assert.match(html, /sur ces trois ministères/);
  assert.match(html, /Reclassement à total inchangé/);
});

test('Les petits flux restent proportionnels sans épaisseur minimum inventée', () => {
  const model = buildBudgetFlowModel([
    { label: 'Grand', budget: 100e9, retirement: 40e9 },
    { label: 'Petit', budget: 1e9, retirement: 1e6 },
  ]);
  assert.equal(model.rows[1].retirementHeight, .001);
  assert.ok(Math.abs(model.rows[1].remainingHeight - .999) < 1e-12);
  const zeros = buildBudgetFlowModel([{ label: 'Sans retraites', budget: 1e9, retirement: 0 }]);
  assert.equal(zeros.collectorWidth, 0);
  assert.equal(zeros.rows[0].retirementHeight, 0);
});

test('Une retraite inconnue ou un montant impossible ne peut pas produire un flux', () => {
  assert.throws(() => budgetFlow([]), RangeError);
  for (const row of [
    { budget: 1, retirement: null }, { budget: 0, retirement: 0 },
    { budget: -1, retirement: 0 }, { budget: Infinity, retirement: 0 },
    { budget: NaN, retirement: 0 }, { budget: 1, retirement: NaN },
    { budget: 1, retirement: Infinity }, { budget: 1, retirement: -1 },
    { budget: 1, retirement: 2 },
  ]) assert.throws(() => budgetFlow([{ label: 'Test', ...row }]), RangeError);
});

test('Le résumé accessible contient chaque montant et les deux mises en page restent distinctes', () => {
  const html = budgetFlow(rows);
  const summary = html.match(/aria-label="([^"]*)"/)?.[1] ?? '';
  for (const value of ['89,1', '28,5', '60,6', '34,2', '10,3', '23,9', '74,7', '9,1', '65,6', '47,9']) {
    assert.ok(summary.includes(`${value} Md€`), `Montant absent : ${value}`);
  }
  assert.match(html, /class="budget-flow__desktop" aria-hidden="true"/);
  assert.match(html, /class="budget-flow__mobile" aria-hidden="true"/);
  assert.equal((html.match(/data-budget-eur=/g) ?? []).length, 6);
  assert.doesNotMatch(html, /<img|data-tooltip|tabindex/);
});

test('Les libellés des ministères sont échappés dans le SVG, le HTML et le résumé', () => {
  const html = budgetFlow([{ label: '<img src=x onerror="x"> & budget', budget: 1e9, retirement: .25e9 }]);
  assert.doesNotMatch(html, /<img|onerror="x"/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&quot;x&quot;/);
  assert.match(html, /&amp; budget/);
  assert.doesNotMatch(html, /≈/);
});
