// Run from repository root: node --experimental-strip-types docs/mandats-vdef/replay-routes.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { start, decide, isFinished } from '../../site/src/mandats/engine.ts';
import { strategyChoices, strategyOutcome } from '../../site/src/mandats/presidency-strategy-engine.ts';
import { strategyFinancialComparison } from '../../site/src/mandats/presidency-read-model.ts';
const folder=new URL('../../site/vdef-artifacts/routes/',import.meta.url);await mkdir(folder,{recursive:true});
const results=[];
for(const route of ['capacity','hybrid']) {
  const input=JSON.parse(await readFile(new URL(`../mandats-strategy-v17/${route === 'hybrid' ? 'organisation-hybrid' : route}-inputs.json`,import.meta.url),'utf8'));
  for(const seed of [0,1,2,47,73]) {
    let game=start('national',seed,input.ambition??'equilibre',17);const refused=[];
    for(const id of input.choices) {
      if(isFinished(game))break;
      if(id!=='live-tick') {
        const action=strategyChoices(game).find(c=>c.id===id);
        if(!action||action.presidencyOrder?.unavailable){refused.push({period:game.turn,id,reason:action?.presidencyOrder?.unavailable??'Action absente à cet état'});continue;}
      }
      game=decide(game,id);
    }
    while(!isFinished(game)&&game.turn<30)game=decide(game,'live-tick');
    const out=strategyOutcome(game),saved={version:17,mode:'national',seed,ambition:input.ambition??'equilibre',choices:game.choices};
    const votes=game.history.flatMap((row,index)=>row.vote?[{sourceJournalIndex:index,choice:game.choices[index],...row.vote}]:[]);
    const summary={route,seed,periods:game.turn,orders:game.choices.filter(c=>c!=='live-tick').length,status:out.status,objectives:out.objectives,refused,votes,financial:strategyFinancialComparison(game)};
    results.push(summary);await writeFile(new URL(`${route}-${seed}-inputs.json`,folder),JSON.stringify(saved));
  }
}
const hashes={};for(const file of ['engine.ts','presidency-strategy-engine.ts','presidency-strategy-content.ts','presidency-read-model.ts'])hashes[file]=createHash('sha256').update(await readFile(new URL(`../../site/src/mandats/${file}`,import.meta.url))).digest('hex');
await writeFile(new URL('summary.json',folder),JSON.stringify({generatedAt:new Date().toISOString(),method:'Reconstruction moteur des deux journaux archivés ; chaque ordre est vérifié légal, les refus sont conservés et le temps ordinaire termine le mandat. Aucune partie humaine.',hashes,results},null,2));
console.log(JSON.stringify(results.map(r=>({route:r.route,seed:r.seed,periods:r.periods,status:r.status,refusals:r.refused.length})),null,2));
