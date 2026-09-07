import assert from 'node:assert/strict';
import test from 'node:test';
import { adPlacements, programmaticAdAllowed } from './advertising-policy.ts';

test('the pilot has one slot per editorial page and expansion cannot exceed two', () => {
  assert.deepEqual(adPlacements('/bilan'), ['france-after-revenue']);
  assert.deepEqual(adPlacements('/bilan/', true), ['france-after-revenue', 'france-after-europe']);
  assert.equal(adPlacements('/salaires/', true).length, 1);
  assert.equal(adPlacements('/analyses/dette-publique/', true).length, 2);
});

test('gameplay, results, tools, sources, unknown routes and lookalikes stay protected', () => {
  for (const path of ['/', '/mandats/', '/mandats/methode/', '/simulateur', '/resultats/abc/',
    '/territoire', '/sources/', '/methode/', '/questions/dette/', '/analyses/',
    '/bilan/unknown', '/salaires/resultats/', '/analyses/../mandats/', '//bilan',
    '/comprendre/dette/', '/rapports/dette/']) {
    assert.deepEqual(adPlacements(path, true), [], path);
    assert.equal(programmaticAdAllowed(path, true, true), false, path);
  }
});

test('programmatic consent and activation are independent requirements', () => {
  assert.equal(programmaticAdAllowed('/bilan', false, true), false);
  assert.equal(programmaticAdAllowed('/bilan', true, false), false);
  assert.equal(programmaticAdAllowed('/bilan', true, true), true);
});
