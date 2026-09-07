import { timeChart } from './chart-studio.ts';
import type { Indicateur, Territoire } from './donnees.ts';
import type { Insight } from './insights.ts';

// Indices refer to distinct proof indicators, in the domain's declared order.
const RATIOS: Record<string, [number[], number, number, string]> = {
  'charge-dette-sur-ir': [[0],1,100,'€ pour 100 € d’impôt sur le revenu'],
  'impot-revenu-par-foyer': [[0],1,1,'€ par foyer'],
  'taux-epargne': [[0],1,100,'%'],
  'dette-sur-epargne': [[0],1,1,'années'],
  'poids-personnel': [[0],1,100,'%'],
  'interets-sur-impots': [[0],1,100,'%'],
  'retraites-pour-cent-jeunes': [[0],1,100,'pour 100 jeunes'],
  'chomage': [[1],0,100,'% des actifs'],
  'logements-vacants': [[1],0,100,'% des logements'],
  'part-logements-sociaux': [[0],1,100,'% des résidences principales'],
  'passoires-sociales': [[0],1,100,'% du parc étiqueté'],
  'poids-personnel-etat': [[0],1,100,'%'],
  'poids-impot-revenu': [[0],1,100,'%'],
  'dette-portee-par-etat': [[0],1,100,'%'],
  'protection-sociale-vieillesse-sante': [[0,1],2,100,'%'],
  'protection-sociale-vieillesse-famille': [[0],1,1,'fois'],
};
const UNITS: Record<string,string> = {count:'',annees:'ans',percent:'%',ratio:'',mwh:'MWh',pour_1000_habitants:'pour 1 000 habitants',pour_1000_logements:'pour 1 000 logements'};

export function insightChart(insight:Insight,catalogue:Indicateur[],data:Territoire['series']):string {
  if(insight.graphique) return timeChart({title:insight.graphique.titre,description:'',unit:insight.graphique.unite,series:insight.graphique.series,format:v=>`${v.toLocaleString('fr-FR',{maximumFractionDigits:1})} ${insight.graphique!.unite}`});
  const ids = [...new Set(insight.preuves.map(p=>p.indicateur))];
  const ratio = RATIOS[insight.id];
  if (ratio) {
    const [numerators,denominator,factor,unit] = ratio;
    const values = Object.fromEntries(Object.keys(data[ids[denominator]]??{}).flatMap(year=>{
      const bottom=data[ids[denominator]]?.[year];
      const top=numerators.map(i=>data[ids[i]]?.[year]);
      return bottom>0 && top.every(Number.isFinite) ? [[year,top.reduce((a,b)=>a+b,0)/bottom*factor]] : [];
    }));
    if(Object.keys(values).length<2)return '';
    return timeChart({title:insight.surtitre.split(' · ').at(-1)!,description:'',unit,series:[{name:'Évolution du ratio',values}],format:v=>`${v.toLocaleString('fr-FR',{maximumFractionDigits:1})} ${unit}`});
  }
  const indicators=ids.map(id=>catalogue.find(i=>i.id===id)).filter((i):i is Indicateur=>!!i && Object.keys(data[i.id]??{}).length>1);
  if(!indicators.length)return '';
  const unitRaw=indicators[0].unite;
  const cohort=indicators.some(i=>i.id.startsWith('insee_retraite_')); 
  const comparable=indicators.filter(i=>i.unite===unitRaw);
  const indexed=insight.id==='impots-face-depenses';
  const common=Object.keys(data[comparable[0].id]).sort().find(y=>comparable.every(i=>data[i.id]?.[y]>0));
  const max=Math.max(...comparable.flatMap(i=>Object.values(data[i.id])).filter(Number.isFinite).map(Math.abs));
  const scale=unitRaw==='EUR' ? max>=1e9?1e9:max>=1e6?1e6:1 : 1;
  const unit=indexed?'Base 100':unitRaw==='EUR' ? scale===1e9?'Md€':scale===1e6?'M€':'€' : UNITS[unitRaw]??unitRaw.replaceAll('_',' ');
  return timeChart({title:indexed?'Impôts et dépenses : la progression comparée':comparable.length>1?insight.surtitre:comparable[0].libelle,periodLabel:cohort?'Génération de naissance':undefined,description:indexed&&common?`Base 100 en ${common}`:'',unit,series:comparable.map(i=>({name:i.libelle,pointsOnly:cohort,values:Object.fromEntries(Object.entries(data[i.id]).filter(([y])=>!indexed||!!common&&y>=common).map(([y,v])=>[y,indexed&&common?v/data[i.id][common]*100:v/scale]))})),format:v=>`${v.toLocaleString('fr-FR',{maximumSignificantDigits:4})}${unit?' '+unit:''}`});
}
