import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarFor, choicesFor, decide, domainFor, preview, start, startingGame } from './engine.ts';
import { decode, encode } from './storage.ts';
import { gameShell, mandateSetup, result, selection, yearBriefing, yearRecap } from './render.ts';
import { cardModel } from './cards.ts';

function legalNext(game: ReturnType<typeof start>) {
  const choice=choicesFor(game).find(c=>preview(game,c.id).game);
  assert.ok(choice, `No legal choice at turn ${game.turn}`);
  return decide(game,choice.id);
}

test('v9 is a five chapter national campaign with six decisions per year',()=>{
  let g=start('national',73,'services',9);
  assert.equal(domainFor(g).turns,30);
  assert.equal(domainFor(g).duration,'30 décisions · 5 années');
  assert.equal(calendarFor(g).slots,6);
  for(let turn=1;turn<=30;turn++){
    g=legalNext(g);
    const last=g.history.at(-1)!;
    assert.equal(last.closed,turn%6===0);
    if(turn%6===0)assert.equal(last.year,turn/6);
  }
  assert.equal(g.history.filter(t=>t.closed).length,5);
  assert.equal(g.turn,30);
  assert.equal(new Set(g.choices).size,30);
  assert.deepEqual(decode(encode(g)),g);
});

test('v9 keeps mission and seed deterministic for exact replay',()=>{
  let a=start('national',814,'resilience',9);
  for(let i=0;i<12;i++)a=legalNext(a);
  const replayed=a.choices.reduce((g,id)=>decide(g,id),startingGame(a));
  assert.deepEqual(replayed,a);
  assert.equal(replayed.seed,814);
  assert.equal(replayed.ambition,'resilience');
});

test('v9 onboarding offers three missions and annual recap gates chapters',()=>{
  let g=start('national',404,'equilibre',9);
  const setup=mandateSetup(g);
  assert.equal((setup.match(/data-action="choose-mission"/g)??[]).length,3);
  assert.match(setup,/Tenir le budget/);
  assert.match(setup,/Améliorer les services/);
  assert.match(setup,/Prévenir les pannes et les crises/);
  assert.equal((setup.match(/class="(?:[^"]* )?campaign-path__copy/g)??[]).length,5);
  const briefing=yearBriefing(g);
  assert.match(briefing,/Prise de fonctions/);
  assert.match(briefing,/Commencer l’année 1/);
  assert.match(briefing,/class="living-briefing__state"/);
  for(let i=0;i<6;i++)g=legalNext(g);
  const recap=yearRecap(g);
  assert.match(recap,/ANNÉE 1 ACHEVÉE/);
  assert.match(recap,/Entrer dans l’année 2/);
  assert.match(recap,/LES EFFETS DE L’ANNÉE/);
  assert.match(recap,/Services publics/);
  assert.match(recap,/Confiance/);
  assert.match(recap,/data-action="next-year"/);
  assert.match(recap,/CE QUE VOUS AVEZ ACCOMPLI/);
});

test('v9 final result is multidimensional without a global government score',()=>{
  let g=start('national',909,'equilibre',9);
  while(g.turn<domainFor(g).turns)g=legalNext(g);
  const html=result(g);
  assert.match(html.replace(/<[^>]+>/g, ' '),/Vous avez changé\s+le paysage/);
  assert.match(html,/Services/);
  assert.match(html,/Confiance/);
  assert.match(html,/Résilience/);
  assert.match(html,/data-action="branch-replay" data-turn="\d+"/);
  assert.match(html,/data-action="share"/);
  assert.match(html,/data-action="replay"/);
  assert.match(html,/data-action="open-plan"/);
  assert.match(html,/data-action="new-run"/);
  assert.match(html,/Journal du mandat · 30 décisions/);
  assert.match(html,/Simulation · scénario #909 · version 9/);
  assert.doesNotMatch(html,/class="score-number"|sans note globale/);
});


test('v9 challenge card carries the selected mission without player choices',()=>{
  const g=start('national',712,'services',9);
  const card=cardModel(g,'challenge');
  assert.equal(card.fields[0][1],'Améliorer les services');
  assert.match(card.fields[2][1],/sans note globale/);
  assert.match(card.fields[3][1],/Scénario 712 · 30 décisions/);
  assert.doesNotMatch(card.url,/#result=/);
});


test('v9 crisis dossiers break visually from ordinary decisions',()=>{
  let g=start('national',42,'equilibre',9);
  for(let i=0;i<5;i++)g=legalNext(g);
  g.society!.pensioners=20;
  const html=gameShell(g,'play','decision');
  assert.match(html,/crisis-dossier/);
  assert.match(html,/class="crisis-banner"/);
  assert.match(html,/SITUATION DE CRISE/);
});

test('landing archives expose replay progress without storing political choices',()=>{
  const html=selection(null,false,{
    completedRuns:3,
    endedRuns:0,
    seeds:[11,22,33],
    missions:['equilibre','services'],
    crisesEncountered:4,
    archives:[{seed:33,ambition:'services',completedAt:'2026-09-23T12:00:00.000Z',crises:2,services:63,cohesion:57,trust:54,resilience:61}],
  });
  assert.match(html,/VOS ARCHIVES/);
  assert.match(html,/3<\/strong><small>mandats archivés · 3 terminés · 0 interrompus/);
  assert.match(html,/Scénario #33/);
  assert.doesNotMatch(html,/r01a|r02b|choices/);
});
