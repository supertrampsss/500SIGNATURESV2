import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchCities, loadCity, validateCityBaseline, financeForCity, scaleForCity } from './cities.ts';
import { municipalBudget } from './municipal.ts';

const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/editorial-publication.json', import.meta.url), 'utf8'));

test('commune loader: provenance, one vintage, no duplicate charges, immutable offline snapshot', async t => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  let communes = structuredClone(fixture.communes);
  let centerResponse: unknown = { centre: { type: 'Point', coordinates: [-0.58, 44.84] } };
  globalThis.fetch = (async (url: string | URL | Request) => {
    const path = String(url);
    requests.push(path);
    if (path.includes('geo.api.gouv.fr')) return Response.json(centerResponse);
    if (path.endsWith('/derniere.json')) return Response.json({ version: fixture.publication });
    if (path.endsWith('/index.json')) return Response.json({ ...fixture.index_commune,
      codes: [...fixture.index_commune.codes, '2A004', '97105'], noms: [...fixture.index_commune.noms, 'Ajaccio', 'Basse-Terre'],
      parents: [...fixture.index_commune.parents, '2A', '971'], population_municipale: [...fixture.index_commune.population_municipale, 75000, 10000],
    });
    if (path.endsWith('/manifeste.json')) return Response.json({ jeux: fixture.jeux });
    if (/\/territoires\/commune\/(33|75|2A|971)\.json$/.test(path)) return Response.json(communes);
    throw new Error(`Unexpected fetch ${path}`);
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  assert.deepEqual(await searchCities('b'), []);
  assert.equal(requests.length, 0);
  assert.equal((await searchCities('Bordéaux'))[0].code, '33063');
  assert.equal((await searchCities('75056'))[0].name, 'Paris');
  assert.equal((await searchCities('2a'))[0].code, '2A004');
  assert.equal((await searchCities('Basse terre'))[0].department, '971');
  const city = await loadCity('33063');
  assert.equal(city.year, 2025);
  assert.equal(city.population, 267991);
  assert.equal(city.observed.revenue, 417137958.52);
  assert.equal(city.observed.operating, 369011621.25);
  assert.equal(city.center?.longitude, -0.58);
  assert.equal(city.provenance.licence, 'Licence Ouverte 2.0');
  assert.equal(city.mappedFinance.cash, 0);
  const ledger = municipalBudget(financeForCity(city));
  assert.ok(Math.abs(ledger.savings * 1e6 - city.observed.savings) < 0.0001);
  assert.ok(Math.abs(ledger.interest * 1e6 - city.observed.financialCharges) < 0.0001);
  assert.equal(ledger.investment * 1e6, city.observed.investment);
  assert.equal(scaleForCity(city), city.observed.revenue / 1e8);
  assert.ok(Object.isFrozen(city) && Object.isFrozen(city.observed) && Object.isFrozen(city.assumptions));
  assert.ok(validateCityBaseline(JSON.parse(JSON.stringify(city))));
  assert.equal('maire' in city, false);
  assert.equal('series' in city, false);
  assert.equal(requests.filter(p => p.includes('/territoires/commune/') && !p.endsWith('/index.json')).length, 1);

  const invalid = structuredClone(city);
  invalid.mappedFinance.cash = 100;
  assert.equal(validateCityBaseline(invalid), false);
  assert.equal(validateCityBaseline({ ...city, center: { longitude: 181, latitude: 0 } }), false);
  assert.equal(validateCityBaseline({ ...city, year: 1990 }), false);
  assert.equal(validateCityBaseline(null), false);
  assert.throws(() => financeForCity(invalid));
  const frozenFinance = financeForCity(city);
  frozenFinance.revenue = 0;
  assert.equal(city.mappedFinance.revenue, 417.13795852);

  // Missing latest-year input falls back to the latest COMPLETE year, never to zero.
  delete communes['33063'].series.ofgl_encours_dette['2025'];
  const older = await loadCity('33063');
  assert.equal(older.year, 2024);
  assert.equal(older.observed.debt, communes['33063'].series.ofgl_encours_dette['2024']);
  delete communes['33063'].series.ofgl_encours_dette;
  await assert.rejects(loadCity('33063'), /comptes disponibles/);
  communes = structuredClone(fixture.communes);
  communes['33063'].series.ofgl_epargne_brute['2025'] = 0;
  await assert.rejects(loadCity('33063'), /comptes disponibles/);
  communes = structuredClone(fixture.communes);
  communes['33063'].series.ofgl_remboursements_d_emprunts_hors_gad['2025'] = 100_000_000;
  await assert.rejects(loadCity('33063'), /comptes disponibles/);

  communes = structuredClone(fixture.communes);
  communes['33063'].series.ofgl_encours_dette['2025'] = 0;
  communes['33063'].series.ofgl_remboursements_d_emprunts_hors_gad['2025'] = 0;
  const debtFree = await loadCity('33063');
  assert.equal(debtFree.mappedFinance.rate, 0.035);
  assert.equal(debtFree.mappedFinance.operating, debtFree.observed.operating / 1e6);
  assert.ok(Math.abs(municipalBudget(financeForCity(debtFree)).savings * 1e6 - debtFree.observed.savings) < 0.0001);
  communes = structuredClone(fixture.communes);
  centerResponse = {};
  const paris = await loadCity('75056');
  assert.equal(paris.name, 'Paris');
  assert.equal(paris.center, null);
  assert.ok(requests.some(p => p.endsWith('/commune/75.json')));
  assert.ok(validateCityBaseline(paris));
  // French overseas and Corsican codes use their actual departmental lots.
  communes['2A004'] = { ...communes['33063'], nom: 'Ajaccio' };
  communes['97105'] = { ...communes['33063'], nom: 'Basse-Terre' };
  await loadCity('2A004');
  await loadCity('97105');
  assert.ok(requests.some(p => p.endsWith('/commune/2A.json')));
  assert.ok(requests.some(p => p.endsWith('/commune/971.json')));
  await assert.rejects(loadCity('../33'), /Code INSEE/);
  await assert.rejects(loadCity('99999'), /ne figure pas/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(searchCities('Bordeaux', controller.signal), { name: 'AbortError' });
  await assert.rejects(loadCity('33063', controller.signal), { name: 'AbortError' });
});
