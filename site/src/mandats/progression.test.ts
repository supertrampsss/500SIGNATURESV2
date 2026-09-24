import test from "node:test";
import assert from "node:assert/strict";
import { decide, choicesFor, preview, start } from "./engine.ts";
import { PROGRESSION_KEY, crisisCount, readProgression, recordCompletedMandate } from "./progression.ts";

function memory(){
  const data=new Map<string,string>();
  return { getItem:(k:string)=>data.get(k)??null, setItem:(k:string,v:string)=>{data.set(k,v);}, data };
}
function next(game:ReturnType<typeof start>){
  const choice=choicesFor(game).find(c=>preview(game,c.id).game);
  assert.ok(choice);
  return decide(game,choice.id);
}

test("progression starts empty and ignores unfinished games",()=>{
  const storage=memory();
  const g=start("national",42,"equilibre",9);
  assert.deepEqual(readProgression(storage),{completedRuns:0,endedRuns:0,seeds:[],missions:[],crisesEncountered:0,archives:[]});
  recordCompletedMandate(storage,g);
  assert.equal(storage.data.has(PROGRESSION_KEY),false);
});

test("completed v9 mandates create a compact local archive",()=>{
  const storage=memory();
  let g=start("national",73,"services",9);
  while(g.turn<30)g=next(g);
  const p=recordCompletedMandate(storage,g,new Date("2026-09-23T12:00:00Z"));
  assert.equal(p.completedRuns,1);
  assert.equal(p.endedRuns,0);
  assert.equal(p.archives[0].outcome,"completed");
  assert.deepEqual(p.seeds,[73]);
  assert.deepEqual(p.missions,["services"]);
  assert.equal(p.archives[0].seed,73);
  assert.equal(p.archives[0].completedAt,"2026-09-23T12:00:00.000Z");
  assert.equal(p.archives[0].crises,crisisCount(g));
  assert.ok(storage.data.get(PROGRESSION_KEY)!.length<32000);
});
