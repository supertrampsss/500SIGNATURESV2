import { nationalPolicyDossiers } from './national-policy.ts';
import { localDossiers } from './local-campaign.ts';
import { longDossiers, CAMPAIGN_THREADS } from './campaign-content.ts';
import { calendarFor } from './calendar.ts';
import { municipal } from './municipal.ts';
import { national } from './national.ts';
import { financeForCity, validateCityBaseline } from './cities.ts';
import { clamp } from './types.ts';
import type { Ambition, Choice, Domain, Effect, Finance, Game, Mode } from './types.ts';
import type { CityBaseline } from './cities.ts';

const BASE = { municipal, national };
const compiled = { municipal: longDossiers("municipal"), national: longDossiers("national") };
const nationalV5 = nationalPolicyDossiers();
const dossierCache = new Map<string, Domain["dossiers"]>();
const financial = ['revenue','operating','investment','grants','repayment'] as const;
function scaledEffect(effect:Effect, scale:number):Effect {
  const result={...effect};
  for(const key of financial)if(result[key]!==undefined)result[key]=result[key]!*scale;
  return result;
}
function costFor(c:Choice):string {
  const labels={revenue:'de recettes/an',operating:'de charges/an',investment:"d'investissement",grants:'de subvention',repayment:'de remboursement'};
  const n=(v:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(v);
  const parts=financial.filter(k=>c.effect[k]).map(k=>`${c.effect[k]!>0?'+':''}${n(c.effect[k]!)} M€ ${labels[k]}`);
  if(c.delayed?.effect.operating)parts.push(`${c.delayed.effect.operating>0?'+':''}${n(c.delayed.effect.operating)} M€/an à la livraison`);
  return parts.length?parts.join(' · '):'Sans enveloppe supplémentaire';
}
export function campaignDomain(g:Game):Domain {
  const base=BASE[g.mode], initial=()=>{
    const state=base.initial();
    if(g.city) {
      state.finance=financeForCity(g.city);
      state.areas=state.areas.map((a,i)=>({...a,name:['Zone de proximité','Zone d’équipements','Zone résidentielle'][i],need:'Zone de jeu hypothétique, sans diagnostic local observé'}));
    }
    return state;
  };
  const scale=g.city?initial().finance.revenue/100:1;
  const cacheKey=g.version === 4 && g.city ? `4:${JSON.stringify(g.city)}` : `${g.version}:${g.mode}:${scale}`;
  let dossiers=dossierCache.get(cacheKey);
  if(!dossiers){
  const source = g.version === 4 && g.city ? localDossiers(g.city,compiled[g.mode]) : g.version === 5 ? nationalV5 : compiled[g.mode];
  dossiers=source.map(d=>({...d,choices:d.choices.map(c=>{
    const result={...c,effect:scaledEffect(c.effect,scale),...(c.delayed?{delayed:{...c.delayed,effect:scaledEffect(c.delayed.effect,scale)}}:{})};
    return g.city?{...result,cost:costFor(result)}:result;
  })}));
  if(dossierCache.size>=32)dossierCache.delete(dossierCache.keys().next().value!);
  dossierCache.set(cacheKey,dossiers);
  }
  const current=dossiers[g.turn];
  const thread=CAMPAIGN_THREADS[g.mode].find(t=>t.followUps.includes(g.turn));
  if(current && thread && dossiers.some(d=>d.choices.some(c=>c.id===thread.launchChoice))){
    dossiers=dossiers.slice();
    dossiers[g.turn]={...current,story:`${g.choices.includes(thread.launchChoice)?thread.underway:thread.absent} ${current.story}`};
  }
  return {...base,turns:45,duration:`45 décisions · ${g.mode==='municipal'?6:5} années`,place:g.city?.name??base.place,
    intro:g.city?`Vous prenez les commandes de ${g.city.name}, à partir des comptes publiés de ${g.city.year}. Les décisions et leurs effets constituent une simulation.`:base.intro,
    scope:g.city?'Comptes de départ observés ; coûts, zones, indicateurs et conséquences hypothétiques. Aucun diagnostic des habitants ni prévision électorale.':base.scope,
    initial,dossiers,
    prepare:(f:Finance)=>{
      const inherited=initial().finance;
      return {...f,investment:inherited.investment,grants:inherited.grants,repayment:Math.min(inherited.repayment,f.debt),...(g.mode==='national'?{rate:f.rate+.2*(f.marketRate-f.rate)}:{})};
    },
    sustainability:(current:Game)=>{
      const initialFinance=initial().finance;
      if(g.mode==='national')return base.sustainability(current);
      const ratio=(f:Finance)=>(f.debt-f.cash)/Math.max(1e-6,f.revenue);
      const margin=(f:Finance)=>(f.revenue-f.operating-f.debt*f.rate)/Math.max(1e-6,f.revenue);
      return clamp(60+35*(ratio(initialFinance)-ratio(current.finance))+100*(margin(current.finance)-margin(initialFinance)));
    }
  };
}
export function startCampaign(mode:Mode,seed:number,ambition:Ambition,city?:CityBaseline,version:3|4|5=3):Game {
  if(city && mode!=='municipal')throw new Error('Une commune appartient au mandat municipal.');
  if(city && !validateCityBaseline(city))throw new Error('Instantané communal invalide.');
  const g:Game={version,mode,seed,ambition,turn:0,...BASE[mode].initial(),pending:[],history:[],choices:[],...(city?{city:structuredClone(city)}:{})};
  Object.assign(g,campaignDomain(g).initial());
  return g;
}
function apply(g:Game,e:Effect) {
  for(const key of [...financial,'growth'] as const)g.finance[key]+=e[key]??0;
  for(const key of ['services','cohesion','resilience','trust','assets'] as const)g.metrics[key]=clamp(g.metrics[key]+(e[key]??0));
  for(const a of g.areas)if(!e.area||a.id===e.area){a.services=clamp(a.services+(e.services??0));a.resilience=clamp(a.resilience+(e.resilience??0));}
}
function prepared(game:Game) {
  const g=structuredClone(game),cal=calendarFor(g),messages:string[]=[];
  if(cal.slot===1){
    g.finance=campaignDomain(g).prepare(g.finance);
    for(const due of g.pending.filter(p=>p.due===cal.year-1)){apply(g,due.effect);messages.push(due.label);}
    g.pending=g.pending.filter(p=>p.due>cal.year-1);
    apply(g,{services:-1,assets:-2});
  }
  return {g,cal,messages};
}
function recovery(game:Game):Choice {
  const {g}=prepared(game);
  const reduction=Math.max(g.finance.revenue*.015,g.finance.operating+g.finance.debt*g.finance.rate+g.finance.repayment-g.finance.revenue+g.finance.revenue*.01);
  return {id:'redressement-v3',title:'Réorganiser les services pour rétablir le budget',description:'Réduire durablement les charges du plan annuel. Le service et la confiance en subissent le coût.',cost:`−${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(reduction)} M€/an de charges`,benefit:'Un budget à nouveau finançable',sacrifice:'Services −5 · confiance −4',effect:{operating:-Math.min(g.finance.operating,reduction),services:-5,trust:-4,cohesion:-2}};
}
function transition(game:Game,choice:Choice):Game {
  const {g,cal,messages}=prepared(game),d=campaignDomain(game);
  apply(g,choice.effect);
  if(choice.delayed)g.pending.push({due:cal.year-1+choice.delayed.after,label:choice.delayed.label,effect:{...choice.delayed.effect}});
  let event='Le plan annuel évolue. Les comptes ne sont pas encore clôturés.';
  if(cal.isYearEnd){
    // The original annual event schedule is retained, with annual rather than decision time.
    const shock=BASE[g.mode].event({...g,turn:cal.year-1});
    apply(g,shock.effect);event=shock.label;
  }
  const ledger=d.settle(g.finance);
  if(cal.isYearEnd){
    g.finance.debt=ledger.debt;g.finance.cash+=ledger.cashChange;g.finance.gdp=ledger.gdp;
    if(g.finance.cash < -1e-8)throw new Error('Financement incomplet.');
    messages.push(`Exercice ${cal.year} clôturé. Intérêts, dette et trésorerie comptabilisés une seule fois.`);
  }
  messages.push(choice.benefit,`Compromis : ${choice.sacrifice}.`);
  if(choice.delayed)messages.push(`Livraison prévue en année ${cal.year+choice.delayed.after}.`);
  g.history.push({year:cal.year,closed:cal.isYearEnd,choice:choice.id,title:choice.title,messages,event,ledger,metrics:structuredClone(g.metrics),areas:structuredClone(g.areas)});
  g.choices.push(choice.id);g.turn++;
  return g;
}
export function campaignChoices(g:Game):Choice[] {
  const choices=campaignDomain(g).dossiers[g.turn]?.choices??[];
  if(!choices.length)return [];
  const legal=choices.some(c=>{try{transition(g,c);return true;}catch{return false;}});
  return legal?choices:[...choices,recovery(g)];
}
export function decideCampaign(g:Game,id:string):Game {
  if(g.turn>=45)throw new Error('Ce mandat est terminé.');
  const choice=campaignChoices(g).find(c=>c.id===id);
  if(!choice)throw new Error("Cette décision n'appartient pas au dossier.");
  return transition(g,choice);
}
