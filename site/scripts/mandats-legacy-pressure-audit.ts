/** Published v13 legal inputs must keep their complete reconstructed state. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from '../src/mandats/storage.ts';

const fixture = JSON.parse(await readFile(new URL('../tests/fixtures/mandats-v13-compatibility.json', import.meta.url), 'utf8')) as {
  sourceCommit: string;
  cases: { name: string; input: unknown; hash: string }[];
};
const cases = fixture.cases.map(sample => {
  const game = decode(JSON.stringify(sample.input));
  const observed = createHash('sha256').update(JSON.stringify(game)).digest('hex');
  return { name: sample.name, turn: game.turn, expected: sample.hash, observed, passed: observed === sample.hash };
});
const passed = cases.every(sample => sample.passed);
await mkdir('pressure-artifacts/legacy', { recursive: true });
await writeFile('pressure-artifacts/legacy/report.json', JSON.stringify({ sourceCommit: fixture.sourceCommit, passed, cases }, null, 2));
process.stdout.write(`${cases.length} published v13 trajectories: ${cases.filter(sample => sample.passed).length} unchanged.\n`);
if (!passed) throw new Error('Une trajectoire publiée v13 a changé. Voir pressure-artifacts/legacy/report.json.');
