import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renduFrancePage } from './france-page.ts';
import { insightsFrance } from './insights-france.ts';
import { indexerSources } from './registre-sources.ts';
import type { Territoire, Indicateur } from './donnees.ts';

const territoire=(series:Territoire['series']):Territoire=>({nom:'France',parent:null,population:null,drapeaux:{},series});
function donnees():Record<string,Territoire> {
  const series:Territoire['series']={
    eurostat_apu_recettes:{'2024':1000e9,'2025':1100e9},
    eurostat_apu_depenses:{'2024':1200e9,'2025':1250e9},
    eurostat_pib_montant:{'2024':2000e9,'2025':2200e9},
    insee_dette_apu_montant:{'2025-Q4':3000e9,'2026-Q1':3100e9},
    eurostat_dette_pib:{'2024':110,'2025':115},
    eurostat_secu_recettes_pib:{'2024':25,'2025':26},
    eurostat_secu_depenses_pib:{'2024':26,'2025':27},
    eurostat_secu_solde_pib:{'2024':-1,'2025':-1},
  };
  for(const id of ['prestations_vieillesse','remunerations','transferts_nature','consommations','investissement','interets','prestations_chomage','prestations_famille','prestations_exclusion']) {
    series['eurostat_apu_'+id]={'2024':50e9};
  }
  for(let i=1;i<=9;i++) {
    series[`insee_niveau_vie_d${i}_avant_redistribution`]={'2024':i*10000};
    series[`insee_niveau_vie_d${i}`]={'2024':i*8000+4000};
  }
  for(const id of ['tva','impot_revenu','impot_societes','ticpe','recettes_fiscales','recettes_non_fiscales','recettes_nettes_bg']) {
    series['etat_'+id]={'2017':100e9,'2025':120e9};
  }
  for(const id of ['protection_sociale','sante','services_generaux','affaires_economiques','enseignement','defense','ordre_securite','culture','logement','environnement']) {
    series['eurostat_fonction_'+id]={'2024':4};
  }
  const pays={FR:territoire(series)} as Record<string,Territoire>;
  for(const [i,code] of ['FR','DE','ES','IT'].entries()) {
    pays[code]??=territoire({});
    Object.assign(pays[code].series,{
      eurostat_depenses_publiques_pib:{'2024':55-i*2},
      eurostat_prelevements_obligatoires_pib:{'2024':45-i*2},
      eurostat_dette_pib:{'2024':110-i*10,'2025':115-i*10},
    });
  }
  return pays;
}

test('France : tous les chapitres de la maquette sont rendus une fois, dans l’ordre',()=>{
  const html=renduFrancePage(donnees(),[]);
  const ids=['france-verdict','france-entrees','france-sorties','france-complements','bloc-secu','france-dette','bloc-europe','insights-france'];
  const positions=ids.map(id=>{
    assert.equal(html.split(`id="${id}"`).length-1,1,id);
    return html.indexOf(`id="${id}"`);
  });
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
  assert.match(html,/class="fr-table"/);
  assert.match(html,/class="fr-stacked"/);
  assert.equal((html.match(/class="fr-histogram"/g)??[]).length,2);
});

test('France : les montants proviennent des séries, pas des chiffres de la maquette',()=>{
  const html=renduFrancePage(donnees(),[]);
  assert.match(html,/150 milliards/);
  assert.match(html,/3\s100 Md€/);
  assert.match(html,/T1 2026/);
  assert.doesNotMatch(html,/153 milliards|3\s536 Md€/);
});

test('France : la répartition des dépenses utilise une seule année commune',()=>{
  const html=renduFrancePage(donnees(),[]);
  assert.match(html,/Répartition des 120 euros[^"<>]*en 2024/);
  assert.match(html,/Autres dépenses/);
  assert.doesNotMatch(html,/Répartition[^"<>]*en 2025/);
});

test('France : la redistribution compare les deux situations d’une même année et neuf seuils',()=>{
  const html=renduFrancePage(donnees(),[]);
  assert.match(html,/Seuils des neuf déciles avant et après redistribution en 2024/);
  assert.equal((html.match(/<title>Seuil du \de décile/g)??[]).length,18);
  assert.match(html,/Avant impôts et prestations/);
  assert.doesNotMatch(html,/Seuil du 10e/);
});

test('France : toutes les analyses calculées restent accessibles et leurs ancres sont uniques',()=>{
  const pays=donnees();
  const catalogue=Object.keys(pays.FR.series).map(id=>({id,libelle:id,unite:'€',niveaux:['pays'],periodes:['2024','2025']})) as Indicateur[];
  const attendues=insightsFrance(pays.FR,catalogue,pays);
  assert.ok(attendues.length>0, 'Le jeu d’essai doit produire des analyses à préserver');
  const html=renduFrancePage(pays,catalogue);
  for(const analyse of attendues)assert.equal(html.split(`id="insight-${analyse.id}"`).length-1,1,analyse.id);
  const images=[...html.matchAll(/src="(\/france\/[^"<>]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(images).size,images.length);
});

test('France : les débats sont accessibles dès le premier écran et renvoient aux analyses',()=>{
  const html=renduFrancePage(donnees(),[]);
  assert.match(html,/class="fr-button" href="#france-debats">Voir les débats/);
  assert.match(html,/href="#france-debats"[^>]*>.*Débats/s);
  assert.match(html,/id="france-debats"/);
  assert.match(html,/href="#insight-tres-hauts-revenus"/);
});

test('France : les liens de sources pointent les fiches réellement indexées',()=>{
  const index=indexerSources([{id:'source-france-test',nom:'Comptes publics',institution:'Eurostat',url:'https://example.test/comptes',statut:'publie',pages:['/bilan'],indicateurs:['eurostat_apu_recettes','eurostat_depenses_publiques_pib']}]);
  const html=renduFrancePage(donnees(),[],[],index);
  assert.equal((html.match(/href="\/sources\/#source-france-test"/g)??[]).length,2);
});

test('France : un jeu incomplet ne produit ni montant inventé ni ancre morte',()=>{
  const pays=donnees();
  delete pays.FR.series.eurostat_apu_interets;
  delete pays.FR.series.insee_niveau_vie_d9;
  delete pays.FR.series.eurostat_secu_solde_pib;
  const html=renduFrancePage(pays,[]);
  assert.doesNotMatch(html,/id="france-sorties"|id="france-complements"|id="bloc-secu"/);
  for(const ancre of html.matchAll(/href="#([^"]+)"/g))assert.ok(html.includes(`id="${ancre[1]}"`),ancre[1]);
  assert.doesNotMatch(html,/NaN|Infinity|undefined/);
  assert.equal(renduFrancePage({},[]),'');
});

test('France : aucune interpolation graphique au-dessus d’une année manquante',()=>{
  const pays=donnees();
  pays.FR.series.eurostat_apu_recettes={'2020':900e9,'2022':1000e9,'2024':1050e9,'2025':1100e9};
  const html=renduFrancePage(pays,[]);
  const recettes=html.match(/<path d="([^"]*)" stroke="#247bbd"/);
  assert.ok(recettes);
  assert.equal((recettes[1].match(/M/g)??[]).length,3);
});
