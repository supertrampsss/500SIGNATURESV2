import test from 'node:test';
import assert from 'node:assert/strict';
import { hemicycleMarkup, politicalEnding, politicalHud, voteSequenceMarkup } from './politics-view.ts';
import { politicalVoteOutcome } from './political-motion.ts';
import type { Game } from './types.ts';
import type { PoliticalState, VoteRecord } from './politics-types.ts';

const vote: VoteRecord = {
  id: 'budget-1', kind: 'law', title: 'Le budget de transition', chamber: 'Assemblée nationale', total: 577,
  for: 301, against: 251, abstain: 25, threshold: 277, passed: true,
  groups: [
    {id:'presidential',label:'Présidentiels',for:150,against:15,abstain:5},
    {id:'reformist',label:'Réformistes',for:80,against:20,abstain:5},
    {id:'social',label:'Sociaux',for:20,against:150,abstain:5},
    {id:'conservative',label:'Conservateurs',for:40,against:55,abstain:5},
    {id:'regional',label:'Régionaux',for:11,against:11,abstain:5},
  ], consequences: ['Le financement hospitalier est voté.', 'La coalition conserve sa majorité.'],
};
const politics: PoliticalState = {
  blocs: [
    {id:'presidential',label:'Présidentiels',seats:170,loyalty:65,inGovernment:true},
    {id:'reformist',label:'Réformistes',seats:105,loyalty:55,inGovernment:true},
    {id:'social',label:'Sociaux',seats:175,loyalty:25,inGovernment:false},
    {id:'conservative',label:'Conservateurs',seats:100,loyalty:40,inGovernment:false},
    {id:'regional',label:'Régionaux',seats:27,loyalty:50,inGovernment:false},
  ], legitimacy:61, unrest:43, cabinet:'stable', commitments:[{id:'hospital',label:'Financer les hôpitaux',dueTurn:7,status:'pending'}], votes:[vote], lastVote:vote, scandalExposure:0, misconduct:0,
};
function game(overrides: Partial<Game> = {}): Game {
  return {version:10,mode:'national',seed:1,turn:6,finance:{revenue:1,operating:1,debt:1,cash:0,rate:0,repayment:0,investment:0,grants:0,gdp:1,growth:0,deflator:0,marketRate:0,stockFlow:0},metrics:{services:50,cohesion:50,resilience:50,trust:50,assets:50},areas:[],pending:[],history:[],choices:[],politics,...overrides};
}

test('vote sequence renders all 577 seats and labels the committed result and consequences', () => {
  const markup = voteSequenceMarkup(vote);
  assert.equal((markup.match(/class="vote-seat /g) ?? []).length, 577);
  assert.match(markup, /data-vote="for"/);
  assert.match(markup, /data-vote="against"/);
  assert.match(markup, /data-vote="abstain"/);
  assert.match(markup, /Le budget de transition/);
  assert.match(markup, /Le financement hospitalier est voté\./);
  assert.match(markup, /political-vote__consequences" hidden/);
  assert.match(markup, /data-vote-kind="law"/);
  assert.match(markup, /id="political-vote-title" tabindex="-1"/);
  assert.match(markup, /Scrutin en cours/);
  assert.doesNotMatch(markup, />Adopté</);
  assert.match(markup, /data-political-action="continue" disabled/);
});

test('political HUD reports coalition, legitimacy, tension, group seats, and pending obligations', () => {
  const markup = politicalHud(game({politics}));
  assert.match(markup, /Majorité relative/);
  assert.match(markup, /275<\/b> sièges/);
  assert.match(markup, /légitimité/);
  assert.match(markup, /tension/);
  assert.match(markup, /Financer les hôpitaux/);
  assert.match(markup, /décision 8/);
  assert.equal(politicalHud(game({version:9, politics})), '');
});

test('early ending explains actual causes and period played without claiming five years', () => {
  const markup = politicalEnding(game({pending:[{due:2,label:'Livraison école',effect:{services:3}}],politics:{...politics,commitments:[{id:'health',label:'Maintenir le financement hospitalier',dueTurn:11,status:'pending'}],ending:{kind:'rupture',title:'Départ négocié',reason:'La crise institutionnelle ne se résout pas.',turn:9,causes:['Légitimité effondrée','Cabinet sans majorité']}}}));
  assert.match(markup, /MANDAT INTERROMPU/);
  assert.match(markup, /décision 9/);
  assert.match(markup, /période réellement jouée/);
  assert.match(markup, /Déficit annuel/);
  assert.match(markup, /Soutien au gouvernement/);
  assert.match(markup, /Effets différés non encore appliqués/);
  assert.match(markup, /Livraison école/);
  assert.match(markup, /année 3/);
  assert.match(markup, /Maintenir le financement hospitalier/);
  assert.doesNotMatch(markup, /Les cinq années du mandat sont achevées/);
  assert.match(markup, /Légitimité effondrée/);
  assert.match(markup, /data-action="replay"/);
  assert.match(markup, /class="result political-ending"/);
  assert.match(markup, /data-action="open-replay-selection"/);
  assert.match(markup, /data-action="tools"/);
});

test('seat renderer never fabricates votes if the supplied breakdown is incomplete', () => {
  const incomplete = {...vote, groups: vote.groups.slice(0,1)};
  const markup = hemicycleMarkup(incomplete);
  assert.equal((markup.match(/class="vote-seat /g) ?? []).length, 577);
  assert.match(markup, /sièges sans détail dans le relevé/);
  assert.match(markup, /Vote non détaillé dans ce relevé/);
});


test('chamber diagrams use the supplied total and sequential stages rather than assuming 577', () => {
  const stage = (chamber:string,total:number) => ({chamber,total,for:Math.floor(total/2),against:Math.floor(total/3),abstain:total-Math.floor(total/2)-Math.floor(total/3),threshold:Math.ceil(total*2/3),passed:true,groups:[{id:'presidential' as const,label:'Groupe',for:Math.floor(total/2),against:Math.floor(total/3),abstain:total-Math.floor(total/2)-Math.floor(total/3)}]});
  const staged:VoteRecord={...vote,kind:'destitution',chamber:'Procédure en trois étapes',total:925,stages:[stage('Assemblée nationale',577),stage('Sénat',348),stage('Haute Cour',925)]};
  const markup=voteSequenceMarkup(staged);
  assert.equal((markup.match(/class="vote-seat /g)??[]).length,577+348+925);
  assert.match(markup,/SÉNAT · 348/);
  assert.match(markup,/HAUTE COUR · 925/);
  assert.equal((markup.match(/class="vote-stage"/g)??[]).length,3);
});

test('election seat diagrams show seats by bloc and never the ballot for/against tally', () => {
  const election:VoteRecord={...vote,kind:'election',title:'Élections législatives',chamber:'Élections législatives',for:0,against:0,abstain:0,threshold:0,passed:true,groups:[
    {id:'presidential',label:'Présidentiels',for:0,against:0,abstain:0,seats:220},
    {id:'reformist',label:'Réformistes',for:0,against:0,abstain:0,seats:126},
    {id:'social',label:'Sociaux',for:0,against:0,abstain:0,seats:105},
    {id:'conservative',label:'Conservateurs',for:0,against:0,abstain:0,seats:92},
    {id:'regional',label:'Régionaux',for:0,against:0,abstain:0,seats:34},
  ]};
  const markup=voteSequenceMarkup(election);
  assert.equal((markup.match(/class="vote-seat /g)??[]).length,577);
  assert.match(markup,/data-seat-group="presidential"/);
  assert.match(markup,/aria-label="Sièges obtenus par groupe"/);
  assert.doesNotMatch(markup,/data-tally="for"/);
  assert.match(markup,/Répartition des sièges après le scrutin/);
});

test('censure and destitution verdicts name the actual government outcome', () => {
  assert.deepEqual(politicalVoteOutcome({...vote,kind:'censure',passed:true}),{label:'Gouvernement renversé',announcement:'La motion de censure est adoptée : le gouvernement est renversé.',adverse:true});
  assert.equal(politicalVoteOutcome({...vote,kind:'censure',passed:false}).label,'Gouvernement maintenu');
  assert.equal(politicalVoteOutcome({...vote,kind:'destitution',passed:true}).label,'Destitution prononcée');
  assert.equal(politicalVoteOutcome({...vote,kind:'destitution',passed:false}).label,'Procédure arrêtée');
});
