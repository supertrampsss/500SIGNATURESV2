import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetComparison } from './budget-comparison.ts';

test('La comparaison donne les trois montants en Md€, sans pourcentage', () => {
  const html = budgetComparison([{ label: 'Éducation', budget: 89.4e9, retirement: 24.5e9 }]);
  assert.match(html, /<table/);
  assert.match(html, /scope="row">Éducation/);
  assert.match(html, /Budget/);
  assert.match(html, /Retraites/);
  assert.match(html, /Après reclassement/);
  assert.match(html, /89,4/);
  assert.match(html, /24,5/);
  assert.match(html, /64,9/);
  assert.equal((html.match(/class="budget-comparison__unit">Md€/g) ?? []).length, 3);
  assert.doesNotMatch(html, /100 %|≈|Estimation/);
});

test('Les 19 lignes restent présentes et les barres partagent une échelle absolue', () => {
  const html = budgetComparison(Array.from({ length: 19 }, (_, i) => ({ label: `Ministère ${i + 1}`, budget: (i + 1) * 1e9, retirement: 1e9 })));
  assert.equal((html.match(/scope="row"/g) ?? []).length, 19);
  assert.match(html, /data-budget-eur="1000000000"/);
  assert.match(html, /data-budget-eur="19000000000"/);
  assert.equal((html.match(/class="budget-comparison__row"/g) ?? []).length, 19);
  assert.match(html, /Même échelle/);
  assert.doesNotMatch(html, /<details|overflow-x|data-tooltip/);
});

test('Une retraite inconnue laisse également le montant après reclassement inconnu', () => {
  const html = budgetComparison([{ label: 'Ministère', budget: 12e9, retirement: null }]);
  assert.equal((html.match(/aria-label="Non disponible">—/g) ?? []).length, 2);
  assert.doesNotMatch(html, /budget-comparison__segment/);
  assert.match(html, /12,0/);
});

test('Les estimations sont signalées uniquement sur les deux montants concernés', () => {
  const html = budgetComparison([{ label: 'Défense', budget: 60e9, retirement: 8e9, estimated: true }]);
  assert.equal((html.match(/class="budget-comparison__approx"/g) ?? []).length, 2);
  assert.match(html, /≈ : estimation des retraites et du montant après reclassement/);
});

test('Les petits montants restent lisibles et un montant positif ne devient jamais zéro', () => {
  const html = budgetComparison([{ label: 'Petit ministère', budget: 20e6, retirement: 1e6 }, { label: 'Sans retraite', budget: 1e9, retirement: 0 }]);
  assert.match(html, /0,020/);
  assert.match(html, /0,0010/);
  assert.match(html, /class="budget-comparison__value">0<\/span>/);
  assert.doesNotMatch(html, />0,00</);
});

test('Les montants impossibles sont rejetés et les libellés échappés', () => {
  for (const row of [
    { budget: -1, retirement: 0 }, { budget: Infinity, retirement: 0 },
    { budget: 1, retirement: -1 }, { budget: 1, retirement: 2 },
    { budget: 1, retirement: NaN },
  ]) assert.throws(() => budgetComparison([{ label: 'Test', ...row }]), RangeError);
  assert.match(budgetComparison([{ label: '<Ministère & budget>', budget: 0, retirement: 0 }]), /&lt;Ministère &amp; budget&gt;/);
});
