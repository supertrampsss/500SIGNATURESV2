import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reclassementBercy, renduReclassementBercy } from './reclassement-bercy.ts';

test('Bercy : les transferts sont retirés des ministères et réunis une seule fois', () => {
  const r = reclassementBercy();
  assert.deepEqual(r.ministeres.map(m => [m.brut, m.retraites, m.horsRetraites]), [
    [89.1e9, 28.5e9, 60.6e9], [34.2e9, 10.4e9, 23.8e9],
  ]);
  assert.equal(r.retraites, 38.9e9);
  assert.equal(r.total, 123.3e9);
  assert.equal(r.ministeres.reduce((s, m) => s + m.horsRetraites, r.retraites), r.total);
  const html = renduReclassementBercy();
  assert.equal((html.match(/scope="row">Retraites</g) ?? []).length, 1);
  assert.match(html, /deux ministères/);
  assert.match(html, /PLF 2027/);
  assert.doesNotMatch(html, /Autres dépenses/);
});
