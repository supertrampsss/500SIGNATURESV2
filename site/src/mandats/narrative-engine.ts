import type { Choice, Effect, Game } from './types.ts';
import { NARRATIVE_FAMILIES, NARRATIVE_EVENTS, NARRATIVE_OPENINGS, NARRATIVE_CAST, NARRATIVE_PLACES } from './narrative-content.ts';
import type { NarrativeChoice, NarrativeContext, NarrativeEvent, NarrativeFamily, NarrativeState, StoryAgendaItem, NarrativeEpilogue } from './narrative-types.ts';
import type { NarrativeObjective } from './narrative-types.ts';
import { annualDeficit } from './national-deficit.ts';
import { politicalDossier } from './political-dilemmas.ts';
import { nationalAgendaDossiersV9 } from './national-agenda.ts';
import { resolveNarrativeConsequences } from './narrative-consequences.ts';

const contexts: NarrativeContext[] = ['coalition', 'hospital', 'redress'];
export function narrativeContextForSeed(seed: number): NarrativeContext { return contexts[seed % contexts.length]; }
function eventWasPlayed(g:Game,id:string):boolean{return g.choices.some(choice=>Array.from({length:g.turn},(_,turn)=>choice.startsWith(`n11-${turn}-${id}-`)).some(Boolean));}
const openingFor=(context:NarrativeContext)=>NARRATIVE_OPENINGS[context];
export function initialNarrative(seed:number):NarrativeState {
  const context=narrativeContextForSeed(seed),opening=openingFor(context);
  return {
    context, deferred:[], promises:[], promiseCandidates:opening.promiseCandidates.map(p=>({...p})), projects:[],
    relationships:NARRATIVE_CAST.map(person=>({...person,loyalty:50})), events:[{id:`opening-${context}`,turn:-1,kind:'opening',title:opening.title,detail:opening.body,causeTurn:-1,weight:1}],
    lastConsequences:[opening.body]
  };
}
function eligibleEvents(g:Game):Array<{family:NarrativeFamily;event:NarrativeEvent}> {
  const family=(id:string)=>NARRATIVE_FAMILIES.find(f=>f.id===id);
  const matches=(e:NarrativeEvent)=>!e.requiresProject&&!eventWasPlayed(g,e.id)&&!g.narrative?.retiredEvents?.includes(e.id)&&(!e.contexts||e.contexts.includes(g.narrative?.context??narrativeContextForSeed(g.seed)))&&(!e.turns||e.turns.includes(g.turn));
  const all=NARRATIVE_EVENTS.filter(matches).flatMap(event=>{const f=family(event.familyId);return f?[{family:f,event}]:[];});
  return all;
}
function stableHash(seed:number,turn:number,id:string):number { let h=(seed^Math.imul(turn+1,0x9e3779b1))>>>0;for(let i=0;i<id.length;i++){h=Math.imul(h^id.charCodeAt(i),0x85ebca6b);h^=h>>>13;}return h>>>0; }
function eventBody(g:Game,event:NarrativeEvent):string {
  const project=event.requiresProject&&g.narrative?.projects.find(item=>item.id===event.requiresProject);
  return project && !event.body.includes(project.note)?`${event.body}\n\n${project.note}`:event.body;
}
const repairFamilyByKind:Record<string,string>={hospital:'soins-hospitaliers',industry:'industrie-conditionnalite',energy:'transition-energetique-mobilite',housing:'logement',integrity:'integrite-ministerielle'};
function shortProjectKey(id:string):string {
  let hash=0x811c9dc5;
  for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),0x01000193);
  return (hash>>>0).toString(36);
}
function capacityRepairChoice(g:Game,choice:NarrativeChoice,kind:string):NarrativeChoice {
  const effect={...choice.effect,society:{...choice.effect.society}};
  const serviceThreshold=kind==='hospital'?45:40;
  const serviceBoost=Math.max(0,Math.ceil(serviceThreshold+3-(g.metrics.services+(effect.services??0))));
  const staffBoost=Math.max(0,Math.ceil(38-((g.society?.publicStaff??50)+(effect.society?.publicStaff??0))));
  const capacityOperating=Math.round((serviceBoost+staffBoost*0.5)*100)/100;
  effect.services=(effect.services??0)+serviceBoost;
  if(staffBoost)effect.society!.publicStaff=(effect.society?.publicStaff??0)+staffBoost;
  if(capacityOperating)effect.operating=(effect.operating??0)+capacityOperating;
  const number=(value:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(value);
  const costs=[effect.investment?`${number(effect.investment)} Md€ d’investissement ponctuel`:null,effect.operating?`${number(effect.operating)} Md€/an de fonctionnement`:null].filter(Boolean).join(' et ')||'aucun crédit nouveau';
  const description=serviceBoost||staffBoost?`${choice.description} La reprise renforce les équipes et les moyens d’exécution selon les besoins constatés.`:choice.description;
  return {...choice,effect,cost:costs,description};
}
function blockedProjectFront(g:Game):{event:NarrativeEvent;family:NarrativeFamily}|undefined {
  const project=(g.narrative?.projects??[]).filter(item=>item.status==='blocked')
    .sort((a,b)=>(a.failureTurn??a.resolvedTurn??a.dueTurn)-(b.failureTurn??b.resolvedTurn??b.dueTurn)||a.id.localeCompare(b.id))[0];
  if(!project)return undefined;
  const authored=NARRATIVE_EVENTS.find(item=>item.requiresProject===project.id&&item.requiresProjectStatus==='blocked'&&!eventWasPlayed(g,item.id));
  const family=NARRATIVE_FAMILIES.find(item=>item.id===(authored?.familyId??repairFamilyByKind[project.kind]));
  if(!family)return undefined;
  if(authored){
    const event={...authored,body:eventBody(g,authored),choices:authored.choices.map(item=>item.project?.action==='repair'?capacityRepairChoice(g,item,project.kind):item)};
    return {event,family};
  }
  const key=shortProjectKey(project.id),id=`suivi-${key}-${project.failureTurn??project.resolvedTurn??project.dueTurn}`;
  const dueAfter=2;
  const shell=(choiceId:string,title:string,description:string,cost:string,benefit:string,sacrifice:string,effect:Effect,action:'repair'|'withdraw'):NarrativeChoice=>({
    id:`${choiceId}-${key}`,title,description,cost,benefit,sacrifice,effect,
    ...(action==='repair'?{project:{id:project.id,kind:project.kind,label:project.label,place:project.place,dueAfter,action:'repair' as const}}:{project:{id:project.id,kind:project.kind,label:project.label,place:project.place,dueAfter:1,action:'withdraw' as const}}),
  });
  const repair=capacityRepairChoice(g,shell('reprendre','Financer la reprise du chantier',
    'Voter une tranche de reprise ajustée aux capacités réellement manquantes. La livraison restera conditionnée à une trésorerie suffisante et à un gouvernement en fonction.',
    '0,05 Md€ de coordination initiale, plus les moyens de capacité nécessaires',
    `Renforcer les équipes avant la nouvelle échéance de livraison. Les indicateurs de services et d’effectifs restent soumis au suivi du mandat.`,
    'Le chantier ne sera livré qu’après le vote et si les conditions réelles sont réunies.',{investment:0.05},'repair'),project.kind);
  const abandon=shell('abandonner','Abandonner le programme',
    'Clore le programme et informer les personnes qui attendaient sa livraison.',
    'Aucun crédit nouveau',
    'Aucune tranche supplémentaire ne sera engagée.',
    'La réalisation ne sera pas livrée ; les sommes déjà engagées ne sont pas récupérées.',
    {trust:-2,cohesion:-1},'withdraw');
  const place=NARRATIVE_PLACES.find(item=>item.id===project.place)?.name??project.place;
  return {family,event:{id,title:`Reprendre ou abandonner : ${project.label}`,familyId:family.id,body:`${project.label} reste bloqué à ${place}. ${project.note} Une reprise peut financer les capacités manquantes; la trésorerie et la continuité du gouvernement restent vérifiées à l’échéance.`,requiresProject:project.id,requiresProjectStatus:'blocked',choices:[repair,abandon]}};
}
function agendaEntries(g:Game) {
  if(g.version!==11||g.mode!=='national'||g.turn>=30)return [];
  const items:Array<{event?:NarrativeEvent;item:StoryAgendaItem;kind:'story'|'policy'|'institutional'}>=[];
  const institutional=politicalDossier(g);
  const crisis=!!g.politics?.pendingCrisis;
  const addInstitutional=()=>{if(institutional&&!items.some(x=>x.kind==='institutional'))items.push({kind:'institutional',item:{id:`institutional:${g.turn}`,title:institutional.title,category:'Institutions',summary:institutional.story,art:'institution',urgency:crisis?'À traiter avant le prochain vote':'Scrutin politique'}});};
  const addPolicy=()=>{if(g.turn<30&&!crisis&&!items.some(x=>x.kind==='policy')){const d=nationalAgendaDossiersV9(g)[g.turn];if(d)items.push({kind:'policy',item:{id:`policy:${g.turn}`,title:d.title,category:d.category,summary:d.story,art:'finance',urgency:'Arbitrage budgétaire de l’année'}});}};
  const addStory=(event:NarrativeEvent,family:NarrativeFamily,urgency=family.urgency,dueTurn?:number)=>{if(!items.some(x=>x.item.id===event.id))items.push({kind:'story',event,item:{id:event.id,title:event.title,category:family.category,summary:eventBody(g,event),art:family.art,urgency,...(dueTurn!==undefined?{dueTurn}:{})}});};
  if(crisis){addInstitutional();return items;}
  else if(g.turn===0&&g.narrative?.context==='coalition')addInstitutional();
  if(g.turn===0&&g.narrative?.context==='hospital'){
    const openingHealth=eligibleEvents(g).find(x=>x.family.id==='soins-hospitaliers');if(openingHealth)addStory(openingHealth.event,openingHealth.family);
  }
  addPolicy();
  if(institutional)addInstitutional();
  const blockedFront=blockedProjectFront(g);
  if(blockedFront)addStory(blockedFront.event,blockedFront.family);
  const slots=Math.max(0,3-items.length);
  const deferred=(g.narrative?.deferred??[]).filter(d=>d.expiresTurn>=g.turn&&d.dueTurn<=g.turn&&!eventWasPlayed(g,d.eventId)&&!g.narrative?.retiredEvents?.includes(d.eventId)).sort((a,b)=>a.expiresTurn-b.expiresTurn||a.dueTurn-b.dueTurn).slice(0,slots);
  for(const deferredItem of deferred){const event=NARRATIVE_EVENTS.find(x=>x.id===deferredItem.eventId),family=event&&NARRATIVE_FAMILIES.find(x=>x.id===event.familyId);if(event&&family){addStory({...event,body:`${eventBody(g,event)}\n\nDernier créneau : décision ${deferredItem.expiresTurn+1}. Si vous le dépassez, le dossier sort de l’agenda avec confiance −1 et cohésion −1.`},family,`À décider avant la décision ${deferredItem.expiresTurn+1}`,deferredItem.expiresTurn);}}
  const eligible=eligibleEvents(g).filter(x=>!items.some(i=>i.item.id===x.event.id)),seen=new Set<string>(items.flatMap(i=>i.kind==='story'&&i.event?[i.event.familyId]:[])),unique=eligible.filter(x=>{if(seen.has(x.family.id))return false;seen.add(x.family.id);return true;});
  const offset=unique.length?stableHash(g.seed,g.turn,'agenda')%unique.length:0;
  const remaining=Math.max(0,3-items.length),rotated=[...unique.slice(offset),...unique.slice(0,offset)].slice(0,remaining);
  items.push(...rotated.map(({family,event})=>({kind:'story' as const,event,item:{id:event.id,title:event.title,category:family.category,summary:eventBody(g,event),art:family.art,urgency:family.urgency}})));
  return items;
}
export function storyAgenda(g:Game):StoryAgendaItem[] { return agendaEntries(g).map(x=>x.item); }
export function storyPhase(g:Game):'agenda'|'decision' { return g.version===11&&g.narrative?.focus&&agendaEntries(g).some(x=>x.item.id===g.narrative!.focus)?'decision':'agenda'; }
export function selectStoryAgenda(g:Game,id:string):Game {
  if(g.version!==11||g.mode!=='national')throw new Error('L’agenda narratif concerne le mandat national v11.');
  if(!agendaEntries(g).some(x=>x.item.id===id))throw new Error('Ce dossier n’est pas disponible dans l’agenda.');
  const next=structuredClone(g);next.narrative={...next.narrative!,focus:id};return next;
}
export function selectPolicyAgenda(g:Game):Game{return selectStoryAgenda(g,`policy:${g.turn}`);}
export function selectInstitutionalAgenda(g:Game):Game{return selectStoryAgenda(g,`institutional:${g.turn}`);}
export function focusedNarrativeEvent(g:Game):NarrativeEvent|undefined { const event=agendaEntries(g).find(x=>x.item.id===g.narrative?.focus)?.event;return event?{...event,body:eventBody(g,event)}:undefined; }
export function focusedAgendaKind(g:Game):'story'|'policy'|'institutional'|undefined{return agendaEntries(g).find(x=>x.item.id===g.narrative?.focus)?.kind;}
export function storyContextOptions():Array<{context:NarrativeContext;seed:number}>{return contexts.map((context,seed)=>({context,seed}));}
export function narrativeObjectives(g:Game):NarrativeObjective[]{
  if(g.version!==11||g.mode!=='national'||!g.narrative)return [];
  const context=g.narrative.context;
  if(context==='coalition'){
    const seats=g.politics?.blocs.filter(b=>b.inGovernment).reduce((n,b)=>n+b.seats,0)??0;
    return [{id:'coalition-majority',label:'Conserver une majorité de gouvernement',complete:seats>=289,progress:`${seats} sièges sur 577`}];
  }
  if(context==='hospital'){
    const delivered=g.narrative.projects.filter(p=>p.status==='delivered'&&p.kind==='hospital').length;
    return [{id:'hospital-delivery',label:'Livrer un projet de santé',complete:delivered>0,progress:`${delivered} projet${delivered===1?'':'s'} livré${delivered===1?'':'s'}`}];
  }
  const deficit=annualDeficit(g);
  return [{id:'redress-balance',label:'Ramener le déficit annuel à l’équilibre',complete:deficit<=0,progress:deficit===0?'Équilibre atteint':`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Math.abs(deficit))} Md€ ${deficit<0?'d’excédent':'de déficit'}`}];
}
export function narrativeElectionOutcome(g:Game):NarrativeEpilogue|null {
  if(g.version!==11||!g.narrative||!g.politics)return null;
  const governmentSeats=g.politics.blocs.filter(b=>b.inGovernment).reduce((n,b)=>n+b.seats,0),legitimacy=Math.round(g.politics.legitimacy),trust=Math.round(g.metrics.trust);
  const lead=[...g.narrative.relationships].sort((a,b)=>b.loyalty-a.loyalty)[0];
  let kind:NarrativeEpilogue['kind'],title:string,detail:string;
  if(g.politics.ending&&g.politics.ending.kind!=='term_complete'){
    kind='transition';title=g.politics.ending.title;detail=`Le mandat s’achève après ${g.turn} décisions : ${g.politics.ending.reason}`;
  } else if(governmentSeats>=289&&legitimacy>=55&&trust>=50){
    kind='renewed';title='La majorité est reconduite';detail=`La coalition conserve ${governmentSeats} sièges. Légitimité ${legitimacy}/100 et confiance ${trust}/100 soutiennent une majorité stable dans cette simulation.`;
  } else if(governmentSeats>=289){
    kind='fragile_majority';title='La majorité garde les sièges, pas sa marge';detail=`${governmentSeats} sièges restent au gouvernement, avec une légitimité de ${legitimacy}/100 et une confiance de ${trust}/100. Un accord de coalition reste nécessaire.`;
  } else if(governmentSeats>0&&g.politics.cabinet==='cohabitation'){
    kind='no_majority';title='Une nouvelle coalition négocie';detail=`Le gouvernement ne rassemble que ${governmentSeats} sièges. Les blocs doivent négocier un nouvel accord.`;
  } else {
    kind='alternation';title='L’Assemblée change de majorité';detail=`Le gouvernement sortant totalise ${governmentSeats} sièges. Les blocs d’opposition peuvent former un autre accord.`;
  }
  const paper=g.narrative.context==='hospital'?'La Gazette des Rives':g.narrative.context==='redress'?'L’Écho des Tilleuls':'Le Courrier des Forges';
  return {kind,title,detail,governmentSeats,legitimacy,headline:`${paper} (journal fictif) : « ${title} après ${g.turn} décisions. »`,...(lead?{character:lead.name}:{})};
}
const prefix=(eventId:string,choiceId:string,turn:number)=>`n11-${turn}-${eventId}-${choiceId}`;
export function narrativeChoiceId(eventId:string,choiceId:string,turn:number):string{return prefix(eventId,choiceId,turn);}
export function choicesForNarrative(g:Game):Choice[] {
  const event=focusedNarrativeEvent(g);if(!event)return [];
  return event.choices.map(c=>toChoice(event,c,g.turn));
}
function toChoice(event:NarrativeEvent,c:NarrativeChoice,turn:number):Choice {
  const effect={...c.effect};if(c.amendment)for(const [k,v] of Object.entries(c.amendment.effect)){
    if(k==='society')effect.society={...effect.society,...v as object};else if(typeof v==='number'){const merged={...effect,[k]:((effect as Record<string,number|undefined>)[k]??0)+v};Object.assign(effect,merged);}
  }
  const political={...(c.political??{action:'enact' as const})};
  if(c.amendment?.support){political.supportDelta={...political.supportDelta,reformist:(political.supportDelta?.reformist??0)+c.amendment.support};}
  if(c.relationships)political.supportDelta={...political.supportDelta,...Object.fromEntries(Object.entries(c.relationships).map(([k,v])=>[k,(political.supportDelta?.[k as keyof typeof political.supportDelta]??0)+v]))};
  return {id:prefix(event.id,c.id,turn),title:c.title,description:c.description,cost:c.cost,benefit:c.benefit,sacrifice:c.sacrifice,effect,...(c.delayed?{delayed:c.delayed}:{}),political,amendment:c.amendment,
    narrative:{eventId:event.id,press:c.press,promise:c.promise,project:c.project,relationships:c.relationships}} as Choice;
}
export function narrativeEventByChoice(g:Game,id:string):NarrativeEvent|undefined {
  for(const {event} of agendaEntries(g))if(event&&event.choices.some(c=>prefix(event.id,c.id,g.turn)===id))return event;
  return undefined;
}
export function policyChoiceForId(g:Game,id:string):boolean{return nationalAgendaDossiersV9(g)[g.turn]?.choices.some(c=>c.id===id)??false;}
export function institutionalChoiceForId(g:Game,id:string):boolean{return politicalDossier(g)?.choices.some(c=>c.id===id)??false;}
export type NarrativeTransition = {state:NarrativeState; consequences:string[];effect:Effect};
export function applyNarrativeChoice(before:Game,after:Game,choice:Choice,event?:NarrativeEvent):NarrativeTransition {
  const resolved=resolveNarrativeConsequences(before,after,choice,event),state=resolved.state,consequences=resolved.consequences;
  const selected=before.narrative!.focus;
  state.deferred=(state.deferred??[]).filter(d=>d.eventId!==selected);
  for(const front of agendaEntries(before).filter(x=>x.kind==='story'&&x.event?.requiresProjectStatus!=='blocked'&&x.item.id!==selected))if(!state.deferred.some(d=>d.eventId===front.item.id))state.deferred.push({eventId:front.item.id,dueTurn:before.turn+1,expiresTurn:before.turn+4,originTurn:before.turn});
  if(before.politics?.pendingCrisis){for(const item of state.deferred)item.expiresTurn++;}
  else {
    const expired=state.deferred.filter(d=>d.expiresTurn<after.turn);
    for(const item of expired){
      const family=NARRATIVE_EVENTS.find(event=>event.id===item.eventId)?.familyId??'';
      consequences.push(`Dossier reporté puis arrivé à échéance : ${NARRATIVE_FAMILIES.find(f=>f.id===family)?.title??item.eventId}.`);
      state.events.push({id:`report-${item.eventId}-${after.turn}`,turn:after.turn,kind:'report',title:'Échéance reportée',detail:'Le dossier sort de l’agenda après son échéance.',causeTurn:item.originTurn,weight:-2,sourceEventId:item.eventId});
      state.retiredEvents=[...new Set([...(state.retiredEvents??[]),item.eventId])];
      resolved.effect.trust=(resolved.effect.trust??0)-1;resolved.effect.cohesion=(resolved.effect.cohesion??0)-1;
    }
    state.deferred=state.deferred.filter(d=>d.expiresTurn>=after.turn);
  }
  state.lastConsequences=consequences;state.focus=undefined;
  return {state,consequences,effect:resolved.effect};
}
export function initialPlace(seed:number):string { const opening=openingFor(narrativeContextForSeed(seed));return NARRATIVE_PLACES.find(p=>p.id===opening.place)?.name??opening.place; }
