import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rendu } from './analyse-rendu.ts';
import { REPONSES_STATIQUES } from './questions.ts';

const article = JSON.parse(readFileSync(new URL('../analyses/fournitures-scolaires-prix-1990-2025.json', import.meta.url), 'utf8'));

test('fournitures : la lecture publique ne demande pas de déchiffrer une base statistique', () => {
  const html = rendu(article, []);
  const prose = html.slice(0, html.indexOf('id="sources"'));
  assert.doesNotMatch(prose, /base\s*100|sous-panier|points de base|113[,.]02|64[,.]70|provisoire/i);
  assert.match(prose, /211,10/);
  assert.match(prose, /211,10\s*€/);
  assert.doesNotMatch(prose, /M€/);
  assert.match(prose, /Caf/);
  assert.match(prose, /COPACEL/);
  assert.match(prose, /Confédération syndicale des familles/);
  for (const figure of article.dossier.visualisations) {
    const units = (figure.seriesIds ?? []).map((id: string) => article.dossier.series.find((s: {id: string}) => s.id === id).unit);
    assert.ok(units.every((unit: string) => !unit.startsWith('index_')));
  }
});

test('fournitures : la comparaison historique est calculée avec les observations Insee vérifiées', () => {
  // Série 001764363, réponse BDM consultée le 20 septembre 2026 : observations définitives.
  const ipc = article.dossier.series.find((s: {id: string}) => s.id === 'ipc-ensemble');
  assert.equal(ipc.observations.find((o: {period: string}) => o.period === '1990').value, 67.4);
  assert.equal(ipc.observations.find((o: {period: string}) => o.period === '2025').value, 120.95);
  const historic = article.dossier.preuves.find((p: {id: string}) => p.id === 'hausse-ensemble');
  assert.equal(historic.value, Math.round((120.95 / 67.4 - 1) * 100));
  const supplies = article.dossier.preuves.find((p: {id: string}) => p.id === 'hausse-fournitures');
  assert.equal(supplies.value, Math.round((113.02 / 64.7 - 1) * 100));
});

test('fournitures : le graphique en euros reprend les quatre rentrées publiées par Familles de France', () => {
  const series = article.dossier.series.find((s: {id: string}) => s.id === 'panier-sixieme');
  assert.ok(series);
  assert.equal(series.unit, 'EUR');
  assert.deepEqual(series.observations, [
    {period:'2022',value:208.12}, {period:'2023',value:226.33},
    {period:'2024',value:223.46}, {period:'2025',value:211.1},
  ]);
  assert.equal(series.sourceId, 'familles-france-rentree-2025');
  const chart = article.dossier.visualisations.find((v: {id: string}) => v.id === 'table-prix');
  assert.equal(chart.type, 'bar');
  assert.deepEqual(chart.preuveIds.map((id: string) => {
    const proof = article.dossier.preuves.find((p: {id: string}) => p.id === id);
    return {period:proof.period, value:proof.value};
  }), series.observations);
});

test('fournitures : la réponse courte utilise aussi le langage courant', () => {
  const answer = REPONSES_STATIQUES.find(q => q.slug === 'prix-fournitures-scolaires')!;
  assert.doesNotMatch(answer.reponse, /base 100|sous-panier|provisoire|113,02/i);
  assert.match(answer.reponse, /75 %/);
  assert.match(answer.reponse, /79 %/);
});
