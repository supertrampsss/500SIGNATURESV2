import assert from 'node:assert/strict';
import test from 'node:test';
import { choicesFor,decide,DOMAINS,start } from './engine.ts';
import { projectPlan } from './planner.ts';
import { cardModel,cardSVG,cardURL,dilemmaFromHash } from './cards.ts';
import { CARD_SIZES,challengeFromURL } from './sharing.ts';
import { entrySession } from './session.ts';
import { encode } from './storage.ts';
import { recordPilot,readPilot,setPilotConsent } from './telemetry.ts';
import { eligibleForReview,importInspiration,inspirationReport,reviewDraft } from './intelligence.ts';

test('planner uses frozen rules, compares the same year and never writes the saved game',()=>{
 for(const mode of ['municipal','national'] as const)for(const version of [1,2] as const){
  const g=decide(start(mode,42,'services',version),DOMAINS[mode].dossiers[0].choices[1].id),before=structuredClone(g);
  const ids=DOMAINS[mode].dossiers.map(d=>d.choices[1].id),p=projectPlan(g,ids);
  assert.equal(p.game.turn,DOMAINS[mode].turns);assert.equal(p.commonYear,1);assert.equal(p.alternative.turn,p.actual.turn);assert.deepEqual(g,before);
  assert.equal(projectPlan(g,['invalid']).game.turn,0);assert.ok(projectPlan(g,['invalid']).error);
 }
});
test('decision links reconstruct only the prior context and retain v1/v2 rules',()=>{
 for(const mode of ['municipal','national'] as const)for(const version of [1,2] as const){
  const g=decide(start(mode,42,'services',version),DOMAINS[mode].dossiers[0].choices[0].id);
  const url=new URL(cardURL(g,'decision','https://example.org'));
  const prior=dilemmaFromHash(url.hash)!;assert.equal(prior.turn,0);assert.equal(prior.version,version);assert.equal(prior.mode,mode);assert.equal(entrySession(url).screen,'play');
  assert.equal(challengeFromURL(new URL(cardURL(g,'challenge','https://example.org')))!.turn,0);
  assert.throws(()=>dilemmaFromHash('#dilemma='+encodeURIComponent('x'.repeat(3000))));
 }
});
test('all card types and sizes label simulation and render every legal decision without invalid values',()=>{
 for(const mode of ['municipal','national'] as const){
  let g=start(mode);
  while(g.turn<DOMAINS[mode].turns){
   for(const c of choicesFor(g)){let next;try{next=decide(g,c.id);}catch{continue;}
    for(const format of Object.keys(CARD_SIZES) as (keyof typeof CARD_SIZES)[]){
     const svg=cardSVG(next,'decision',format);assert.match(svg,/SIMULATION FICTIVE/);assert.doesNotMatch(svg,/undefined|NaN/);assert.match(svg,new RegExp(`width="${CARD_SIZES[format][0]}"`));
    }
    assert.ok(cardModel(next,'decision').alt.includes(c.title));
   }
   g=decide(g,DOMAINS[mode].dossiers[g.turn].choices[1].id);
  }
  assert.match(cardSVG(g,'result','landscape'),/HÉRITAGE SIMULÉ/);
  assert.match(cardSVG(g,'challenge','portrait'),/SANS VOS CHOIX/);
  assert.ok(!cardURL(g,'challenge','https://example.org').includes(encode(g)));
 }
});
test('pilot records nothing before consent, excludes decision data, expires export and erases on withdrawal',()=>{
 const data=new Map<string,string>();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};
 const now=new Date('2026-09-05T12:00:00Z');recordPilot(storage,'first_decision','municipal',now);assert.equal(data.size,0);
 setPilotConsent(storage,true);recordPilot(storage,'first_decision','municipal',now);assert.deepEqual(Object.keys(readPilot(storage,now)[0]),['event','mode','at']);
 assert.equal(readPilot(storage,new Date('2026-10-06')).length,0);setPilotConsent(storage,false);assert.equal(readPilot(storage,now).length,0);
});
test('inspiration imports require authorization and evidence; drafts stay human-controlled',()=>{
 assert.throws(()=>importInspiration(JSON.stringify({posts:[]})));
 assert.equal(inspirationReport(importInspiration(JSON.stringify({authorized:true,posts:[]}))).count,0);
 const post={url:'https://x.com/example/status/123',author:'example',date:'2026-09-01',language:'fr',summary:'Résumé neutre.',idea:'Hypothèse de produit.',topics:['mobile'],verification:'unverified',sources:[],novelty:3,relevance:4,confidence:2,sensitivity:0};
 const list=importInspiration(JSON.stringify({authorized:true,posts:[post]}));assert.equal(inspirationReport(list).opportunities[0].next,'research-first');assert.equal(inspirationReport(list).opportunities[0].approved,false);
 assert.throws(()=>importInspiration(JSON.stringify({authorized:true,posts:[{...post,verification:'verified'}]})));
 const draft={id:'1',thread:'t',account:'a',text:'Une explication sourcée.',sourceURLs:['https://www.insee.fr/'],status:'pending' as const};
 assert.equal(eligibleForReview(draft,[],{paused:true,blockedAccounts:[],optedOutAccounts:[]}),false);
 assert.equal(eligibleForReview(draft,[],{paused:false,blockedAccounts:[],optedOutAccounts:['a']}),false);
 assert.throws(()=>reviewDraft(draft,'approved',''));
 const approved=reviewDraft(draft,'approved','Source et contexte relus.');assert.equal(eligibleForReview(draft,[approved],{paused:false,blockedAccounts:[],optedOutAccounts:[]}),false);
});

test('offline updates await the new worker and preserve an active version on failure',async()=>{
 const {prepareOffline}=await import('./offline.ts');
 const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),windowDescriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
 class Worker extends EventTarget {state='installing';}
 const worker=new Worker();let updates=0;
 const registration={active:{},waiting:null,installing:worker,update:async()=>{updates++;}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{register:async()=>registration}}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:{isSecureContext:true}});
 try{
  let resolved=false;const preparation=prepareOffline().then(value=>{resolved=true;return value;});
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(resolved,false);assert.equal(updates,1);
  worker.state='installed';worker.dispatchEvent(new Event('statechange'));assert.deepEqual(await preparation,{update:true});
  worker.state='redundant';await assert.rejects(prepareOffline(),/téléchargement/);assert.ok(registration.active);
 }finally{
  if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else Reflect.deleteProperty(globalThis,'navigator');
  if(windowDescriptor)Object.defineProperty(globalThis,'window',windowDescriptor);else Reflect.deleteProperty(globalThis,'window');
 }
});
