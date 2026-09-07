import assert from "node:assert/strict";
import { test } from "node:test";
import { calculerSalaire, renduSalaires, STATUTS } from "./salaires.ts";

test("le module Salaires expose les quatre statuts", () => {
  assert.deepEqual(STATUTS, ["salarié", "fonctionnaire", "indépendant", "retraité"]);
});

test("le coût total est la somme du revenu et des prélèvements", () => {
  const calcul = calculerSalaire(2100, "salarié");
  assert.equal(Math.round(calcul.coutTotal), 3979);
  assert.equal(
    Math.round(calcul.coutTotal),
    Math.round(calcul.net + calcul.cotisationsSalariales + calcul.impot + calcul.cotisationsEmployeur),
  );
});

test("un montant invalide ne produit pas de nombre négatif", () => {
  const calcul = calculerSalaire(Number.NaN, "retraité");
  assert.equal(calcul.net, 0);
  assert.equal(calcul.coutTotal, 0);
});

test("le rendu est court et contient le détail local", () => {
  const html = renduSalaires();
  assert.match(html, /id="salaires-contenu"/);
  assert.match(html, /Voir le calcul/);
  assert.match(html, /data-statut="salarié"/);
  assert.match(html, /data-statut="retraité"/);
  assert.doesNotMatch(html, /sarahknafo/);
  assert.match(html, /hypothèses non calibrées/);
  assert.match(html, /data-coefficients/);
  assert.doesNotMatch(html, /Quand|Sources et méthode/);
});

test('la répartition collective couvre les dix missions au même exercice et refuse un total incohérent', async () => {
 const {repartitionCollective}=await import('./salaires.ts');
 const ids=['protection_sociale','sante','enseignement','services_generaux','affaires_economiques','ordre_securite','defense','culture','logement','environnement'];
 const series=Object.fromEntries(ids.map((id,i)=>['eurostat_fonction_'+id,{'2023':i+1,'2024':i+1}]));
 series.eurostat_depenses_publiques_pib={'2023':55,'2024':55};
 const data=repartitionCollective(series)!;
 assert.equal(data.year,'2024');assert.equal(data.missions.length,10);
 assert.ok(Math.abs(data.missions.reduce((sum,m)=>sum+m.share,0)-1)<1e-12);
 delete (series.eurostat_fonction_sante as Record<string,number>)['2024'];
 assert.equal(repartitionCollective(series)!.year,'2023');
 series.eurostat_depenses_publiques_pib['2023']=60;
 assert.equal(repartitionCollective(series),null);
 assert.equal(repartitionCollective({}),null);
});

test('les retraites et le chômage sont séparés sans compter deux fois les prestations', async()=>{
 const {repartitionCollective}=await import('./salaires.ts');
 const benefits=['vieillesse','survivants','maladie_invalidite','chomage','famille','exclusion','logement'];
 const other=['remunerations','transferts_nature','consommations','investissement','transferts_courants','interets','subventions','transferts_capital'];
 const series:Record<string,Record<string,number>>=Object.fromEntries([...benefits.map(id=>'eurostat_apu_prestations_'+id),...other.map(id=>'eurostat_apu_'+id)].map(id=>[id,{'2024':1}]));
 series.eurostat_apu_prestations={'2024':8};series.eurostat_apu_depenses={'2024':20};
 const data=repartitionCollective(series)!;
 assert.equal(data.missions.find(m=>m.label==='Retraites')!.share,.05);
 assert.equal(data.missions.find(m=>m.label==='Chômage')!.share,.05);
 assert.ok(Math.abs(data.missions.reduce((sum,m)=>sum+m.share,0)-1)<1e-12);
 series.eurostat_apu_prestations['2024']=6;
 assert.equal(repartitionCollective(series),null);
});

test('l’historique ne mélange pas des exercices incomplets ou des bases différentes',async()=>{
 const {historiqueRepartition}=await import('./salaires.ts');
 const ids=['protection_sociale','sante','enseignement','services_generaux','affaires_economiques','ordre_securite','defense','culture','logement','environnement'];
 const series:Record<string,Record<string,number>>=Object.fromEntries(ids.map((id,i)=>['eurostat_fonction_'+id,{'2000':i+1,'2001':i+1,'2002':i+1}]));
 series.eurostat_depenses_publiques_pib={'2000':55,'2001':55,'2002':55};delete series.eurostat_fonction_sante['2001'];
 const history=historiqueRepartition(series);
 assert.deepEqual(history.map(h=>h.year),['2000','2002']);
 for(const h of history)assert.ok(Math.abs(h.missions.reduce((sum,m)=>sum+m.share,0)-1)<1e-12);
 const html=renduSalaires(2100,'salarié',series);assert.match(html,/salary-history-choice/);assert.match(html,/Depuis 2000/);
});
