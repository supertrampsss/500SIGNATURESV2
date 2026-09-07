import test from 'node:test';
import assert from 'node:assert/strict';
import {start,choicesFor,decide,domainFor} from './engine.ts';
import {agendaEntry,NATIONAL_AGENDA} from './national-agenda.ts';
import {annualDeficit} from './national-deficit.ts';
import {encode,decode} from './storage.ts';
import {projectPlan} from './planner.ts';
const begin=(seed=42)=>start('national',seed,'equilibre',8);
const next=(g:ReturnType<typeof begin>,rank=0)=>decide(g,choicesFor(g)[rank].id);
test('agenda contains thirty reforms, twenty-five opportunities and fifteen substantive crises',()=>{
 assert.equal(NATIONAL_AGENDA.length,70);
 for(const [kind,total] of [['reform',30],['opportunity',25],['crisis',15]] as const)assert.equal(NATIONAL_AGENDA.filter(e=>e.kind===kind).length,total);
 assert.equal(new Set(NATIONAL_AGENDA.map(e=>e.dossier.title)).size,70);
 assert.equal(new Set(NATIONAL_AGENDA.flatMap(e=>e.dossier.choices.map(c=>c.id))).size,210);
 assert.doesNotMatch(JSON.stringify(NATIONAL_AGENDA),/Maintenir la réforme|Retirer la réduction/);
});
test('a difficult first vote applies once and leads directly to another reform',()=>{
 const g=next(begin());assert.equal(annualDeficit(g),138);
 assert.equal(agendaEntry(g).id,'r02');assert.equal(agendaEntry(g).kind,'reform');
 assert.equal(g.choices.length,1);assert.equal(g.society!.pensioners,50);
});
test('45 decisions preserve thirty reforms, bounded delayed crises, balance and deterministic saves',()=>{
 for(let seed=0;seed<12;seed++)for(const strategy of [0,1,2,3]){
  let g=begin(seed),crisisTurns:number[]=[],reforms=0,opportunities=0;
  while(g.turn<45){
   const entry=agendaEntry(g);
   if(entry.kind==='reform')reforms++;
   if(entry.kind==='opportunity')opportunities++;
   if(entry.kind==='crisis'){
    assert.ok(g.turn>=5);assert.ok(g.turn-g.choices.indexOf(entry.source+'a')>=5);
    if(crisisTurns.length)assert.ok(g.turn-crisisTurns.at(-1)!>=5);
    crisisTurns.push(g.turn);
   }
   g=next(g,strategy===3?g.turn%2:strategy);
   if(g.turn%9===0)assert.deepEqual(decode(encode(g)),g);
  }
  assert.equal(reforms,30);assert.ok(crisisTurns.length<=5);assert.equal(opportunities+crisisTurns.length,15);
  assert.equal(new Set(g.choices).size,45);
  if(strategy<2)assert.ok(annualDeficit(g)<=0,`${seed}: ${annualDeficit(g)}`);
  if(strategy===1||strategy===2)assert.equal(crisisTurns.length,0);
 }
});
test('opportunities depend on earlier choices; recovery cancels a latent crisis',()=>{
 let cut=begin(),tax=begin();while(cut.turn<5){cut=next(cut);tax=next(tax,1);}
 assert.notDeepEqual(cut.choices,tax.choices);
 // Threshold fixture at an eligible slot, after the source and waiting period.
 cut.society!.pensioners=30;assert.equal(agendaEntry(cut).kind,'crisis');
 cut.society!.pensioners=65;
 assert.notEqual(agendaEntry(cut).source,'r01');
});
test('closed branches reject imports and alternatives replay without mutating the mandate',()=>{
 let g=begin();while(g.turn<15)g=next(g);
 const frozen=encode(g),alternative=projectPlan(g,['r01b','r02b']);
 assert.equal(encode(g),frozen);assert.equal(alternative.game.turn,2);
 const future=NATIONAL_AGENDA.find(e=>e.id==='r30')!.dossier.choices[0].id;
 assert.throws(()=>decide(begin(),future));
 const forged=JSON.parse(encode(begin()));forged.choices=[future];assert.throws(()=>decode(JSON.stringify(forged)));
 const legacy=start('national',42,'equilibre',7);assert.match(domainFor(next(legacy)).dossiers[1].title,/compenser/);
});
test('residence is committed once with a delayed implementation and no confirmation card',()=>{
 let g=begin();while(agendaEntry(g).id!=='r07')g=next(g,2);
 g=next(g);assert.ok(g.pending.some(p=>p.effect.operating===-2));
 assert.notEqual(agendaEntry(g).source,'r07');assert.equal(agendaEntry(g).kind,'reform');
 assert.deepEqual(decode(encode(g)),g);
});
