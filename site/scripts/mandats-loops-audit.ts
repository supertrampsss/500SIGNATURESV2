/** Legal-input scenario exploration; not exhaustive gameplay or visual proof. */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { startPresidency, decidePresidency, presidencyActions, presidencyEvents, presidencyPoliticalActions, presidencyCreditsChoice } from '../src/mandats/presidency-engine.ts';
import { presidencyCrises } from '../src/mandats/presidency-crises.ts';
import { encode, decode } from '../src/mandats/storage.ts';
import type { Choice } from '../src/mandats/types.ts';
const policies=['inaction','resolve','temporary','reforms'] as const;
const rows: Array<Record<string,unknown>>=[], issues: string[]=[];
const available=(c:Choice)=>!c.presidencyOrder?.unavailable;
for(let seed=0;seed<24;seed++)for(const policy of policies){
 let g=decidePresidency(startPresidency(seed),'live-autonomy');
 const seen=new Set<string>(), civils=new Set<string>(); let rejected=0, blocked=0, credits=0;
 const order=(id:string)=>{const before=g;try{g=decidePresidency(g,id);if(g.politics?.lastVote?.id!==before.politics?.lastVote?.id&&!g.politics?.lastVote?.passed)rejected++;}catch{blocked++;}};
 while(g.turn<30&&!g.politics!.ending){
  for(const e of presidencyEvents(g).filter(e=>e.kind==='reform'))seen.add(e.id);
  if(policy!=='inaction'){
   const institution=presidencyPoliticalActions(g).filter(available).find(c=>c.id==='live-cabinet-appoint'||c.political?.action==='coalition_government');
   if(institution)order(institution.id);
   if(g.presidency!.reserve<1.5&&available(presidencyCreditsChoice(g))){order('live-credits');credits++;}
   const crises=presidencyCrises(g).filter(c=>c.status!=='resolved').sort((a,b)=>Number(b.id.startsWith('civil-'))-Number(a.id.startsWith('civil-'))||a.startedPeriod-b.startedPeriod);
   for(const c of crises){
    const responses=presidencyActions(g,c.sector).filter(x=>x.pressure?.crisisId===c.id&&available(x));
    const choice=responses.find(x=>x.pressure?.crisisOutcome===(policy==='temporary'?'contain':'resolve'))??responses[0];
    if(choice)order(choice.id);
   }
   if(policy==='reforms'){
    const event=presidencyEvents(g).find(e=>e.kind==='reform');
    const choice=event?.choices.find(c=>available(c)&&!c.id.startsWith('live-reform-'));
    if(choice)order(choice.id);
   }
  }
  if(!g.politics!.ending)order('live-tick');
  if(g.presidency!.civic?.crisis)civils.add(g.presidency!.civic.crisis.spec);
  if(g.presidency!.reserve<-.00001)issues.push(`negative reserve ${seed}/${policy}`);
 }
 if(JSON.stringify(decode(encode(g)))!==JSON.stringify(g))issues.push(`replay differs ${seed}/${policy}`);
 rows.push({seed,policy,period:g.turn,ending:g.politics?.ending?.kind??'term_complete',reformsSeen:seen.size,reformsDecided:g.presidency!.reforms.length,expired:g.presidency!.reformArchive?.filter(x=>x.outcome==='expired').length??0,civilStages:[...civils],crises:g.presidency!.crises?.map(c=>({id:c.id,status:c.status,reason:c.originReason})),credits,rejected,blocked,inputs:g.choices});
}
const sources=['presidency-engine.ts','presidency-crises.ts','presidency-types.ts'].map(file=>({file,sha256:createHash('sha256').update(readFileSync(`src/mandats/${file}`)).digest('hex')}));
const report={generatedAt:new Date().toISOString(),scope:'24 seeds × 4 legal policies; not exhaustive',sources,issues,summary:policies.map(policy=>({policy,journeys:rows.filter(r=>r.policy===policy).length,success:rows.filter(r=>r.policy===policy&&r.ending==='term_complete').length,loss:rows.filter(r=>r.policy===policy&&r.ending!=='term_complete').length})),rows};
writeFileSync('../docs/mandats-loops-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({journeys:rows.length,issues,summary:report.summary}));
if(issues.length)process.exitCode=1;
