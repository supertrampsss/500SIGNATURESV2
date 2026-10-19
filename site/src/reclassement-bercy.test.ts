import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclassementBercy, renduReclassementBercy } from './reclassement-bercy.ts';
test('Bercy : tous les ministères, Défense comprise, conservent chacun 100 %', () => {
 const r = reclassementBercy();
 assert.equal(r.ministeres.length, 19);
 assert.equal(new Set(r.ministeres.map(m => m.nom)).size,19);
 assert.ok(r.ministeres.some(m => m.nom.includes('Défense')));
 for(const m of r.ministeres) {
  assert.ok(m.partRetraites >= 0 && m.partRetraites <= 100);
  assert.equal(m.partRetraites + (100-m.partRetraites),100);
 }
 const html = renduReclassementBercy();
 assert.equal((html.match(/class="stacked-percent__row"/g) ?? []).length,19);
 assert.equal((html.match(/--part">Retraites</g) ?? []).length,1);
 assert.match(html,/PLF 2027/);
 assert.doesNotMatch(html,/123,3|deux ministères|hors retraites|La ligne Retraites réunit/);
});
