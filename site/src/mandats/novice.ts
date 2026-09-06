import type { Choice, Dossier, Game } from './types.ts';
import { MUNICIPAL_COPY } from './novice-municipal.ts';
import { NATIONAL_COPY } from './novice-national.ts';
import { localProfile } from './local-campaign.ts';
type Copy = (typeof MUNICIPAL_COPY)[number];

/** Presentation is independent from the frozen rules used to replay saves. */
export function dossierCopy(g: Game, dossier: Dossier): Copy {
  if (g.version === 5) return [dossier.title, dossier.story, dossier.choices.map(c => c.title) as [string,string,string], dossier.choices.map(c => c.sacrifice) as [string,string,string]];
  const id = dossier.choices[0]?.id ?? '';
  const local = /^l4([0-5])([0-2])0$/.exec(id);
  if (g.version === 4 && g.city && local) return localCopy(g, Number(local[1]), Number(local[2]));
  const authored = /^[mn](\d{2})a$/.exec(id);
  const copy = g.version >= 3 && authored ? (g.mode === 'municipal' ? MUNICIPAL_COPY : NATIONAL_COPY)[Number(authored[1])-1] : undefined;
  return copy ?? [dossier.title, dossier.story, dossier.choices.map(c=>c.title) as [string,string,string], dossier.choices.map(c=>c.sacrifice) as [string,string,string]];
}
export function choiceCopy(g:Game,dossier:Dossier,choice:Choice) {
  const copy=dossierCopy(g,dossier), index=dossier.choices.findIndex(c=>c.id===choice.id);
  return index < 0 ? {title:choice.title,outcome:choice.description} : {title:copy[2][index],outcome:copy[3][index]};
}
function localCopy(g:Game,theme:number,stage:number):Copy {
 const p=localProfile(g.city!);
 switch(theme){
 case 0:return p.tight ? [
  ['Comment dégager de l’argent dans le budget ?','Comment continuer à payer les services ?','Que faire pour payer les prochaines dépenses ?'][stage],
  'Les comptes de départ laissent peu d’argent après les dépenses et les remboursements. La ville peut acheter moins ou augmenter les impôts.',
  [['Réduire les achats non essentiels','Réduire les dépenses des contrats','Continuer à limiter les achats'][stage],'Augmenter les impôts locaux','Garder le budget actuel'],
  ['Les agents achètent moins et doivent se passer de certaines fournitures.','Les contribuables paient davantage pour financer le budget municipal.','Les dépenses continuent sans recette supplémentaire pour les financer.']
 ] : [
  ['Que faire de l’argent encore disponible ?','Aider les habitants ou rénover les locaux ?','Que financer avant de passer la main ?'][stage],
  'Les comptes de départ laissent de l’argent après les dépenses et les remboursements. Vous pouvez l’utiliser ou le garder pour les imprévus.',
  ['Ajouter de l’aide en mairie','Rénover les bâtiments municipaux','Garder l’argent disponible'],
  ['Des agents aident les habitants à faire leurs démarches en mairie.','Les habitants utilisent des locaux rénovés. Les travaux réduisent le budget des autres projets.','Vous gardez l’argent pour les imprévus. L’accueil reste le même.']
 ];
 case 1:{const repay=p.debtPressure && g.city!.observed.debt>0;return [
  [repay?'Rembourser la dette ou faire des travaux ?':'Quels travaux financer en plus ?', 'Combien de nouveaux travaux financer ?', 'Quelle dette laisser après votre départ ?'][stage],
  repay?'La dette de départ pèse sur le budget. Rembourser davantage laisse moins d’argent pour améliorer les bâtiments.':'De nouveaux travaux améliorent les bâtiments, mais leur financement peut augmenter la dette.',
  [repay?'Rembourser davantage la dette':'Rénover des bâtiments municipaux','Faire des travaux plus limités','Ne pas ajouter de travaux'],
  [repay?'Vous remboursez plus de dette et gardez moins d’argent pour les travaux.':'La ville rénove ses bâtiments. Elle peut devoir emprunter pour payer les travaux.','La ville finance des travaux plus limités.','Les projets déjà prévus continuent. Les nouveaux attendent.']
 ];}
 case 2:return [
  ['Réparer les bâtiments ou attendre ?','Ajouter des travaux ou mieux entretenir ?','Quels bâtiments améliorer avant de partir ?'][stage],
  p.investmentShare>=.2?'Les comptes de départ prévoient déjà des travaux importants. Vous pouvez ajouter des réparations ou garder le programme prévu.':'Vous pouvez lancer de nouvelles réparations ou payer des agents pour entretenir les bâtiments plus souvent.',
  ['Ajouter des réparations aux bâtiments','Entretenir plus souvent les bâtiments','Finir les travaux déjà prévus'],
  ['Les agents réparent davantage de bâtiments cette année.','Les agents font de petites réparations plus souvent. La ville finance ce travail chaque année.','Les travaux prévus continuent. Les nouvelles réparations attendent.']
 ];
 case 3:{const training=p.personnelShare!==null&&p.personnelShare>=.5;return [
  ['Comment aider les agents à mieux vous accueillir ?','Comment améliorer le travail des équipes ?','Faut-il payer plus d’agents après votre départ ?'][stage],
  training?'Les comptes de départ consacrent déjà une somme importante aux salaires. La ville peut former les agents ou revoir leur travail.':'Les agents peuvent accueillir plus d’habitants si la ville recrute. Changer leurs horaires modifie aussi le service rendu.',
  [training?'Former les agents pendant un an':'Recruter des agents municipaux','Recruter un renfort limité','Redistribuer les tâches actuelles'],
  [training?'Les agents répondent mieux aux demandes dans un an. La formation n’est payée que cette année.':'Les agents supplémentaires peuvent traiter plus de demandes.','Les habitants bénéficient d’un renfort plus petit, à financer chaque année.','Les agents changent leurs permanences. Certains usagers perdent leur créneau.']
 ];}
 case 4:return [
  ['Faut-il demander plus aux contribuables ?','Comment payer les prochains services ?','Quels impôts après votre départ ?'][stage],
  p.tight?'Les comptes de départ laissent peu d’argent disponible. Vous pouvez augmenter les impôts ou réduire les achats des services.':'Les comptes de départ permettent un choix sur les impôts : les augmenter, les baisser ou garder le niveau prévu.',
  ['Augmenter les impôts locaux',p.tight?'Réduire les achats des services':'Réduire les impôts locaux','Garder les impôts actuels'],
  ['Les contribuables paient davantage pour financer le budget municipal.',p.tight?'Les services achètent moins pour éviter une hausse des impôts.':'Les contribuables paient moins. La ville doit financer ses services avec moins de recettes.','Les habitants paient autant. Les nouveaux services doivent trouver un autre financement.']
 ];
 default:{const context=p.tourist?'Le scénario prévoit plus de visiteurs à certaines périodes. Il faut pouvoir les accueillir.':p.mountain?'Le scénario prévoit des trajets difficiles en montagne pour rejoindre les services.':p.rural?'Le scénario prévoit des habitants éloignés des guichets. Il faut leur permettre de faire leurs démarches.':'Les habitants doivent pouvoir entrer dans les locaux et trouver de l’aide pour leurs démarches.';return [
  ['Comment rapprocher les services des habitants ?','Adapter les lieux ou ajouter une aide temporaire ?','Que financer pour les prochains usagers ?'][stage],
  context,
  ['Aménager les locaux d’accueil','Ajouter de l’aide pendant un an','Changer les permanences actuelles'],
  ['Les habitants entrent et circulent plus facilement dans les locaux.','Des agents aident les habitants pendant un an. Ce renfort s’arrête ensuite.','Les permanences changent. Certains habitants doivent venir à un autre moment.']
 ];}
 }
}

/** Amounts are in M€ locally and Md€ nationally; precision is kept in the detailed notes. */
export function shortMoney(value:number,mode:Game['mode']):string {
 const euros=Math.abs(value)*(mode==='municipal'?1e6:1e9);
 const divisor=euros>=1e9?1e9:euros>=1e6?1e6:euros>=1e3?1e3:1;
 const unit=divisor===1e9?'Md€':divisor===1e6?'M€':divisor===1e3?'k€':'€';
 return `${new Intl.NumberFormat('fr-FR',{maximumSignificantDigits:2}).format(euros/divisor)} ${unit}`;
}
export function choiceCosts(c:Choice,mode:Game['mode']):string[] {
 const result:string[]=[];
 const add=(value:number|undefined,positive:string,negative:string,annual=false)=>{if(value) result.push(`${value>0?positive:negative} : ≈${shortMoney(value,mode)}${annual?'/an':''}`);};
 add(c.effect.investment,'Travaux','Travaux évités');
 add(c.effect.operating,'Coût','Économie',true);
 add(c.effect.revenue,'Recettes en plus','Recettes en moins',true);
 add(c.effect.grants,'Aide reçue','Aide perdue');
 add(c.effect.repayment,'Remboursement en plus','Remboursement réduit');
 // Temporary funding ends later; don't describe its reversal as a second new cost.
 if(c.delayed){
  const later=c.delayed.effect, now=c.effect;
  if(later.revenue) result.push(`${later.revenue > 0 ? 'Puis recettes en plus' : 'Puis recettes en moins'} : ≈${shortMoney(later.revenue,mode)}/an dans ${c.delayed.after} an${c.delayed.after > 1 ? 's' : ''}`);
  if(later.operating && !(now.operating && Math.abs(now.operating+later.operating)<1e-8)) result.push(`${later.operating>0?'Puis coût':'Puis économie'} : ≈${shortMoney(later.operating,mode)}/an dans ${c.delayed.after} an${c.delayed.after>1?'s':''}`);
 }
 if(c.delayed && c.effect.operating && Math.abs(c.effect.operating+(c.delayed.effect.operating??0))<1e-8) return result.map(s=>s.replace('/an',c.delayed!.after===1?' cette année':` pendant ${c.delayed!.after} ans`));
 return result.length?result:['Sans dépense en plus'];
}
