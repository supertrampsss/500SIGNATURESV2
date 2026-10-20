import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { strategyStart, strategyDecide, strategyOutcome, strategyState, strategyLedger, strategySupport, strategyReforms } from '../../../site/src/mandats/presidency-strategy-engine.ts';
const root = new URL('../../../', import.meta.url);
const report = { commit: execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(), command: 'node --experimental-strip-types docs/mandats/audit-vdef-2026-10-20/mechanics-replay.mjs', type: 'Replays du moteur, sans navigateur ni joueur humain', routes: [], inaction: [], adoptedLaw: null, ministries: [] };
for (const name of ['capacity','organisation-hybrid']) {
  const data=JSON.parse(await readFile(new URL(`docs/mandats-strategy-v17/${name}-inputs.json`,root),'utf8'));
  let g=strategyStart(data.seed,data.ambition),lastOrder=0;
  for(const id of data.choices){if(id!=='live-tick')lastOrder=g.turn;g=strategyDecide(g,id);}
  report.routes.push({name,inputs:data,seed:data.seed,lastOrder,lastDelivery:Math.max(...strategyState(g).commitments.filter(c=>c.kind!=='routine').map(c=>c.deliveredPeriod??0)),outcome:strategyOutcome(g),deficit:strategyLedger(g).deficit,support:strategySupport(g),fronts:Object.values(g.pressure.sectors).map(s=>({id:s.id,pressure:s.pressure,backlog:s.backlog,lastChange:s.lastChange,incomingNeed:s.incomingNeed,effectiveCapacity:s.effectiveCapacity}))});
}
for(const seed of [0,1,2,19,47,143,9999]){
  let g=strategyStart(seed);while(g.turn<30&&!g.politics.ending)g=strategyDecide(g,'live-tick');
  report.inaction.push({seed,inputs:g.choices,period:g.turn,outcome:strategyOutcome(g).status,initialDeficit:strategyState(g).initialDeficit,deficit:strategyLedger(g).deficit,objectives:strategyOutcome(g).objectives,cabinet:g.politics.cabinet,support:strategySupport(g)});
}
{
 const g=strategyStart(3),c=strategyReforms(g).flatMap(r=>r.choices).find(c=>c.id==='r05b'),after=strategyDecide(g,c.id);
 report.adoptedLaw={seed:3,id:c.id,title:c.title,passed:after.politics.lastVote.passed,affluent:[g.society.affluent,after.society.affluent],support:[strategySupport(g),strategySupport(after)],legitimacy:[g.politics.legitimacy,after.politics.legitimacy],unrest:[g.politics.unrest,after.politics.unrest]};
}
report.ministries=Object.entries(strategyState(strategyStart(47)).sectors).map(([id,s])=>({id,competence:s.minister.competence,annualLimit:s.minister.annualLimit,annualCost:Math.round((.12+(100-s.minister.competence)*.002)*1000)/1000}));
report.sources=Object.fromEntries(await Promise.all(['presidency-strategy-engine.ts','presidency-strategy-content.ts','pressure-engine.ts','pressure-content.ts','politics.ts'].map(async name=>[name,createHash('sha256').update(await readFile(new URL(`site/src/mandats/${name}`,root))).digest('hex')])));
await writeFile(new URL('preuves-game-design.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({commit:report.commit,routes:report.routes.map(r=>({name:r.name,lastOrder:r.lastOrder,lastDelivery:r.lastDelivery,status:r.outcome.status})),inaction:report.inaction.map(r=>({seed:r.seed,status:r.outcome,finance:r.objectives[2].met,government:r.objectives[3].met})),adoptedLaw:report.adoptedLaw}));
