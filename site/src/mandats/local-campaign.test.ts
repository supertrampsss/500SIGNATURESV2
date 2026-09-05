import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCity, validateCityBaseline } from './cities.ts';
import type { CityBaseline } from './cities.ts';
import { extractCityContext, validCityContext } from './city-context.ts';
import { localProfile } from './local-campaign.ts';
import { start, decide, choicesFor, preview, domainFor, score, calendarFor, startingGame } from './engine.ts';
import { encode, decode } from './storage.ts';
import { challengeURL, challengeFromURL, resultURL, sharedResult } from './sharing.ts';
import { gameShell } from './render.ts';
import type { Game } from './types.ts';
const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/editorial-publication.json',import.meta.url),'utf8'));
async function bordeaux():Promise<CityBaseline> {
  const original=globalThis.fetch;
  globalThis.fetch=(async(url:string|URL|Request)=>{
    const path=String(url);
    if(path.includes('geo.api.gouv.fr'))return Response.json({});
    if(path.endsWith('/derniere.json'))return Response.json({version:fixture.publication});
    if(path.endsWith('/index.json'))return Response.json(fixture.index_commune);
    if(path.endsWith('/manifeste.json'))return Response.json({jeux:fixture.jeux});
    return Response.json(fixture.communes);
  }) as typeof fetch;
  try{return await loadCity('33063');}finally{globalThis.fetch=original;}
}
function next(g:Game,index=0):Game {
  const candidates=choicesFor(g).map(c=>preview(g,c.id).game).filter((x):x is Game=>!!x);
  assert.ok(candidates.length,`No recovery at ${g.turn+1}: ${g.choices}`);
  return candidates[index%candidates.length];
}
/** Synthetic financial cases, same revenue: differences cannot come from monetary scaling. */
function profile(base:CityBaseline,room:boolean,debtFree=false):CityBaseline {
  const revenue=100e6,operating=room?72e6:94e6,debt=debtFree?0:room?20e6:70e6,financialCharges=debt*.03;
  const o={revenue,operating,debt,savings:revenue-operating,financialCharges,repayment:debtFree?0:4e6,investment:room?8e6:30e6,grants:1e6};
  return {...base,name:'Commune fictive de test',observed:o,mappedFinance:{...base.mappedFinance,revenue:100,operating:(operating-financialCharges)/1e6,debt:debt/1e6,rate:debtFree?.035:.03,marketRate:debtFree?.035:.03,repayment:o.repayment/1e6,investment:o.investment/1e6,grants:1},context:{version:1,years:[{year:base.year-1,values:{savings:room?27e6:10e6}},{year:base.year,values:{revenue:100e6,savings:o.savings,debt:o.debt,investment:o.investment,personnel:room?30e6:60e6,taxes:room?20e6:65e6}}],flags:{tourist:!room,rural:room,mountain:false}}};
}

test('local context: observed history and nullable flags, no invented demographic trend',async()=>{
 const city=await bordeaux();
 assert.equal(city.context?.years.length,4);
 assert.equal(city.context?.years[0].values.savings,60165131.11);
 assert.equal(city.context?.years.at(-1)?.values.personnel,183054742.68);
 assert.equal(city.context?.flags.tourist,true);
 assert.ok(Object.isFrozen(city.context?.years));
 assert.ok(validateCityBaseline(city));
 assert.ok(localProfile(city).tight);
 assert.ok(localProfile(city).debtPressure);
 assert.ok(localProfile(city).savingsChange! < -.1);
 const missing=extractCityContext({ofgl_recettes_fonctionnement:{'2025':1}},undefined,2025);
 assert.deepEqual(missing.flags,{tourist:null,rural:null,mountain:null});
 assert.equal(missing.years[0].values.personnel,undefined);
 const invalid=structuredClone(city.context!);invalid.years[0].values.revenue=NaN;
 assert.equal(validateCityBaseline({...city,context:invalid}),false);
 assert.equal(validCityContext({...city.context,years:[city.context!.years.at(-1),city.context!.years[0]]},city.year,city.observed),false);
 assert.equal(validateCityBaseline({...city,context:{...city.context,flags:{tourist:'Oui'}}}),false);
 assert.equal(validateCityBaseline({...city,context:{...city.context,years:[]}}),false);
});

test('same financial size, different observed profiles: topics, order, options and effects change',async()=>{
 const base=await bordeaux(),tight=profile(base,false),room=profile(base,true);
 assert.ok(validateCityBaseline(tight)&&validateCityBaseline(room));
 const a=domainFor(start('municipal',42,'equilibre',4,tight));
 const b=domainFor(start('municipal',42,'equilibre',4,room));
 assert.notEqual(a.dossiers[0].title,b.dossiers[0].title);
 const localA=a.dossiers.filter(d=>d.choices[0].id.startsWith('l4'));
 const localB=b.dossiers.filter(d=>d.choices[0].id.startsWith('l4'));
 assert.equal(localA.length,18);assert.equal(localB.length,18);
 assert.notDeepEqual(localA.map(d=>d.choices.map(c=>c.title)),localB.map(d=>d.choices.map(c=>c.title)));
 assert.notDeepEqual(localA.map(d=>d.choices.map(c=>c.effect)),localB.map(d=>d.choices.map(c=>c.effect)));
 assert.ok(localA.some(d=>d.title.includes('visiteurs')));
 assert.ok(localB.some(d=>d.title.includes('permanences des habitants')));
 for(const d of [a,b]){
  assert.equal(d.turns,45);assert.equal(d.dossiers.length,45);
  assert.equal(new Set(d.dossiers.map(x=>x.title)).size,45);
  assert.equal(new Set(d.dossiers.flatMap(x=>x.choices.map(c=>c.id))).size,135);
  for(const dossier of d.dossiers)assert.equal(dossier.choices.length,3);
 }
});

test('local campaigns: 45 decisions, six annual closures, recovery and deterministic offline replay',async()=>{
 const city=await bordeaux(),withoutContext={...city};delete withoutContext.context;
 for(const baseline of [city,profile(city,false),profile(city,true),profile(city,true,true),withoutContext])for(let seed=0;seed<4;seed++){
  let g=start('municipal',seed,'resilience',4,baseline),random=seed+1;
  while(g.turn<45){
   const before=g,cal=calendarFor(g);
   random=(Math.imul(random,1664525)+1013904223)>>>0;
   g=next(g,random);
   assert.equal(g.history.at(-1)?.closed,cal.isYearEnd);
   assert.ok(g.finance.debt>=0&&g.finance.cash>=-1e-8);
   if(!cal.isYearEnd){assert.equal(g.finance.debt,before.finance.debt);assert.equal(g.finance.cash,before.finance.cash);}
   assert.deepEqual(g.city,baseline);
   if([3,17,32,45].includes(g.turn))assert.deepEqual(decode(encode(g)),g);
  }
  assert.equal(g.history.filter(h=>h.closed).length,6);
  assert.deepEqual(g.history.reduce((counts,h)=>{counts[h.year-1]++;return counts;},[0,0,0,0,0,0]),[8,8,8,7,7,7]);
  assert.ok(score(g).total>=0&&score(g).total<=100);
  assert.equal(choicesFor(g).length,0);
  assert.throws(()=>decide(g,'l4000'),/terminé/);
 }
});

test('v3 remains a different, replayable 45-decision campaign',async()=>{
 const city=await bordeaux();
 let old=start('municipal',42,'equilibre',3,city);
 const originalTitle=domainFor(old).dossiers[0].title;
 assert.equal(originalTitle,'Les premières pluies dans les classes');
 while(old.turn<45)old=next(old);
 assert.deepEqual(decode(encode(old)),old);
 assert.equal(domainFor(start('municipal',42,'equilibre',3,city)).dossiers[0].title,originalTitle);
 assert.notEqual(domainFor(start('municipal',42,'equilibre',4,city)).dossiers[0].title,originalTitle);
 // Pre-context snapshots remain accepted, with no additional request or inferred observation.
 const legacyCity={...city};delete legacyCity.context;
 const saved=encode(start('municipal',42,'equilibre',3,legacyCity));
 assert.equal(decode(saved).city?.context,undefined);
});

test('v4 challenge/result links carry the local context and retain the 45-decision horizon',async()=>{
 const city=await bordeaux();let g=start('municipal',7,'services',4,city);
 for(let i=0;i<10;i++)g=next(g);
 const challenge=challengeFromURL(new URL(challengeURL(g,'https://example.org')))!;
 assert.deepEqual(challenge,startingGame(g));
 assert.equal(domainFor(challenge).turns,45);
 while(g.turn<45)g=next(g);
 assert.deepEqual(sharedResult(new URL(resultURL(g,'https://example.org')).hash),g);
 const bad=JSON.parse(encode(g));bad.city.context.years.at(-1).values.revenue++;
 assert.throws(()=>decode(JSON.stringify(bad)),/Instantané/);
 bad.city.context=city.context;bad.choices[0]='m01a';assert.throws(()=>decode(JSON.stringify(bad)),/dossier/);
});

test('local evidence stays below the one-click choices with no intermediate disclosure',async()=>{
 const g=start('municipal',42,'equilibre',4,await bordeaux());
 const html=gameShell(g,'play','decision');
 assert.match(html,/1\/45/);assert.match(html,/Année 1\/6/);
 assert.equal((html.match(/data-action="choose"/g)??[]).length,3);
 assert.doesNotMatch(html,/<details/);
 assert.ok(html.indexOf('Source locale')>html.indexOf('data-action="choose"'));
 assert.match(html,/comptes 2025/);
 assert.doesNotMatch(html,/Les premières pluies dans les classes/);
});

test('national v4 remains a full 45-decision, five-year campaign',()=>{
 let g=start('national',42,'equilibre',4);
 while(g.turn<45)g=next(g);
 assert.equal(g.history.filter(h=>h.closed).length,5);
 assert.deepEqual(decode(encode(g)),g);
});

test('temporary support shows its immediate benefit, training shows its delayed delivery',async()=>{
 const city=profile(await bordeaux(),false);
 const dossiers=domainFor(start('municipal',42,'equilibre',4,city)).dossiers;
 const support=dossiers.flatMap(d=>d.choices).find(c=>c.id==='l4501')!;
 assert.match(support.benefit,/Services \+1/);
 assert.doesNotMatch(support.benefit,/Marge|livraison/);
 assert.equal(support.delayed?.effect.operating,-support.effect.operating!);
 assert.equal(support.delayed?.effect.services,-support.effect.services!);
 const training=dossiers.flatMap(d=>d.choices).find(c=>c.id==='l4300')!;
 assert.match(training.benefit,/Services \+2 à la livraison/);
 assert.equal(training.effect.services,undefined);
});

test('novice presentation covers all 18 local dossiers without turning financial data into a building diagnosis',async()=>{
 const {dossierCopy,choiceCopy}=await import('./novice.ts');
 const base=await bordeaux();
 for(const city of [base,profile(base,true),profile(base,false),profile(base,true,true)]){
  const g=start('municipal',42,'equilibre',4,city);
  const local=domainFor(g).dossiers.filter(d=>d.choices[0].id.startsWith('l4'));
  assert.equal(local.length,18);
  for(const d of local){const copy=dossierCopy(g,d);assert.notEqual(copy[0],d.title);assert.ok(copy[0].length<=65);assert.ok(copy[1].length<=165);for(const c of d.choices){const text=choiceCopy(g,d,c);assert.ok(text.title&&text.outcome);assert.doesNotMatch(text.title,/tranche|enveloppe|conforter/i);}}
 }
});
