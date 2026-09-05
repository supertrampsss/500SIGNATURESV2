import test from 'node:test';
import assert from 'node:assert/strict';
import { start, domainFor } from './engine.ts';
import { dossierCopy, choiceCopy, choiceCosts, shortMoney } from './novice.ts';
import { MUNICIPAL_COPY } from './novice-municipal.ts';
import { NATIONAL_COPY } from './novice-national.ts';
import { gameShell } from './render.ts';
import type { Choice } from './types.ts';
for(const mode of ['municipal','national'] as const)test(`${mode}: every authored decision has concise, complete novice copy`,()=>{
 const g=start(mode,42,'equilibre',3),d=domainFor(g),copy=mode==='municipal'?MUNICIPAL_COPY:NATIONAL_COPY;
 assert.equal(copy.length,45);
 for(const dossier of d.dossiers){
  const c=dossierCopy(g,dossier);assert.notEqual(c[0],dossier.title);
  assert.ok(c[0].length<=65);assert.ok(c[1].length<=160);
  for(const choice of dossier.choices){const text=choiceCopy(g,dossier,choice);assert.ok(text.title.length>0&&text.title.length<=48);assert.ok(text.outcome.length>0&&text.outcome.length<=120);}
 }
 const html=gameShell(g,'play','decision');const primary=html.split('<article class="dossier">')[1].split('</article>')[0];
 assert.doesNotMatch(primary,/Patrimoine \+|class="tradeoff"|class="choice-index"|<details/);
 assert.doesNotMatch(html,/class="pulse"/);assert.match(html,/Décision 1\/45/);
 assert.match(gameShell(g,'play','territory'),/class="pulse"/);
});
test('readable amounts retain scale and recurring or temporary timing',()=>{
 assert.equal(shortMoney(1.669,'municipal'),'1,7 M€');assert.equal(shortMoney(.417,'municipal'),'420 k€');assert.equal(shortMoney(.417,'national'),'420 M€');
 const c:Choice={id:'test',title:'',description:'',cost:'',benefit:'',sacrifice:'',effect:{operating:.417}};
 assert.deepEqual(choiceCosts(c,'municipal'),['Coût : ≈420 k€/an']);
 c.delayed={after:1,label:'Fin aide',effect:{operating:-.417}};
 assert.deepEqual(choiceCosts(c,'municipal'),['Coût : ≈420 k€ cette année']);
 c.effect={investment:1.669,grants:.4};c.delayed={after:2,label:'Ouverture',effect:{operating:.1}};
 assert.deepEqual(choiceCosts(c,'municipal'),['Travaux : ≈1,7 M€','Aide reçue : ≈400 k€','Puis coût : ≈100 k€/an dans 2 ans']);
});
test('legacy campaigns keep their original meaning and recovery choices stay explained',()=>{
 const g=start('municipal',42,'equilibre',2),d=domainFor(g).dossiers[0];assert.equal(dossierCopy(g,d)[0],d.title);
 const recovery={...d.choices[0],id:'recovery',title:'Réduire les dépenses',description:'Moins de moyens pour les services.'};
 assert.equal(choiceCopy(g,d,recovery).outcome,recovery.description);
});

test('repayment copy does not promise lower net debt when borrowing may offset it',()=>{
 const g=start('municipal',42,'equilibre',3);
 for(const d of domainFor(g).dossiers)for(const c of d.choices)if(c.effect.repayment){assert.doesNotMatch(choiceCopy(g,d,c).outcome,/Moins de dette|dette baisse/);assert.match(choiceCopy(g,d,c).outcome,/rembours/);}
});
