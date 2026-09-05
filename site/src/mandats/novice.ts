import type { Choice, Dossier, Game } from './types.ts';
import { MUNICIPAL_COPY } from './novice-municipal.ts';
import { NATIONAL_COPY } from './novice-national.ts';
import { localProfile } from './local-campaign.ts';
type Copy = (typeof MUNICIPAL_COPY)[number];

/** Presentation is independent from the frozen rules used to replay saves. */
export function dossierCopy(g: Game, dossier: Dossier): Copy {
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
  ['Comment retrouver de l’argent pour agir ?','Comment financer la suite des services ?','Comment laisser un budget moins serré ?'][stage],
  'Le budget de départ laisse peu d’argent après les dépenses et les remboursements. Réduire les achats ou demander plus aux contribuables ?',
  [['Réduire les achats non essentiels','Réduire les dépenses des contrats','Continuer à limiter les achats'][stage],'Augmenter les recettes fiscales','Garder le budget actuel'],
  ['Des économies chaque année ; moins de moyens pour les équipes.','Plus d’argent pour la ville ; les contribuables paient davantage.','Pas de nouvel effort ; ce choix ne crée pas d’argent disponible.']
 ] : [
  ['Que faire de l’argent encore disponible ?','Plus d’aide aux habitants ou de meilleurs locaux ?','Que financer avant de passer la main ?'][stage],
  'Les comptes de départ laissent de l’argent pour agir. Un service doit être payé chaque année ; des travaux se paient une fois.',
  ['Renforcer l’aide en mairie','Améliorer les bâtiments municipaux','Garder l’argent disponible'],
  ['Plus d’accompagnement ; une dépense à financer chaque année.','Des locaux plus pratiques ; moins d’argent pour les autres projets.','Une réserve conservée ; pas de service supplémentaire.']
 ];
 case 1:{const repay=p.debtPressure && g.city!.observed.debt>0;return [
  [repay?'Rembourser la dette ou faire des travaux ?':'Quels travaux financer en plus ?', 'Quelle place donner aux nouveaux travaux ?', 'Quelle dette laisser après votre départ ?'][stage],
  repay?'La dette de départ pèse sur le budget. Rembourser davantage laisse moins d’argent pour améliorer les bâtiments.':'De nouveaux travaux améliorent les bâtiments, mais leur financement peut augmenter la dette.',
  [repay?'Rembourser davantage la dette':'Rénover des bâtiments municipaux','Faire des travaux plus limités','Ne pas ajouter de travaux'],
  [repay?'Moins de dette ; cet argent ne finance pas de travaux.':'Des bâtiments améliorés ; un emprunt peut être nécessaire.','Une facture plus petite ; moins de bâtiments améliorés.','Pas de nouvelle dépense ; les nouveaux projets attendent.']
 ];}
 case 2:return [
  ['Réparer les bâtiments ou attendre ?','Ajouter des travaux ou mieux entretenir ?','Quels bâtiments améliorer avant de partir ?'][stage],
  p.investmentShare>=.2?'Des travaux occupent déjà une part importante du budget de départ. Ajouter des réparations ou finir ce qui est prévu ?':'Vous pouvez réparer davantage de bâtiments ou renforcer les petites réparations régulières.',
  ['Ajouter des réparations aux bâtiments','Entretenir plus souvent les bâtiments','Finir les travaux déjà prévus'],
  ['Les bâtiments s’améliorent ; de nouveaux travaux sont à financer.','Des réparations plus régulières ; une dépense revient chaque année.','Pas de dépense en plus ; les nouvelles réparations attendent.']
 ];
 case 3:{const training=p.personnelShare!==null&&p.personnelShare>=.5;return [
  ['Comment aider les agents à mieux vous accueillir ?','Comment améliorer le travail des équipes ?','Quels moyens laisser aux équipes municipales ?'][stage],
  training?'Les salaires prennent une place importante dans les comptes de départ. Former les agents ou réorganiser leur travail ?':'Vous pouvez renforcer les équipes ou changer leur organisation pour mieux accueillir les habitants.',
  [training?'Former les agents pendant un an':'Renforcer les équipes municipales','Ajouter un peu d’aide aux équipes','Redistribuer les tâches actuelles'],
  [training?'Un meilleur service dans un an ; la formation est payée cette année.':'Plus de capacité de service ; des salaires à financer chaque année.','Un peu plus de service ; une dépense revient chaque année.','Le service change sans recrutement ; certains publics y perdent.']
 ];}
 case 4:return [
  ['Faut-il demander plus aux contribuables ?','Comment payer les prochains services ?','Quel effort fiscal laisser pour la suite ?'][stage],
  p.tight?'Le budget de départ est serré. Une hausse des recettes apporte de l’argent ; réduire les achats diminue les moyens des services.':'Vous pouvez augmenter les recettes fiscales, les réduire ou garder le niveau actuel.',
  ['Augmenter les recettes fiscales',p.tight?'Réduire les achats des services':'Réduire les recettes fiscales','Garder les recettes fiscales actuelles'],
  ['Plus d’argent pour la ville ; les contribuables paient davantage.',p.tight?'Des économies ; les services disposent de moins de moyens.':'Les contribuables paient moins ; la ville reçoit moins d’argent.','Pas de changement pour les contribuables ; aucune recette nouvelle.']
 ];
 default:{const kind=p.tourist?'les périodes de forte fréquentation':p.mountain?'les contraintes de montagne':p.rural?'les distances entre les habitants et les services':'les besoins des habitants';return [
  ['Comment rapprocher les services des habitants ?','Adapter les lieux ou ajouter une aide temporaire ?','Quelle amélioration laisser aux habitants ?'][stage],
  `Le scénario tient compte de ${kind}. Adapter les lieux ou ajouter de l’accompagnement pendant un an ?`,
  ['Adapter les lieux de service','Ajouter de l’aide pendant un an','Réorganiser les moyens existants'],
  ['Des lieux plus pratiques ; les travaux doivent être financés.','Plus d’accompagnement cette année ; l’aide prend fin dans un an.','Le service est réorganisé ; certains habitants doivent changer leurs habitudes.']
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
 add(c.effect.repayment,'Dette remboursée','Remboursement réduit');
 // Temporary funding ends later; don't describe its reversal as a second new cost.
 if(c.delayed){
  const later=c.delayed.effect, now=c.effect;
  if(later.operating && !(now.operating && Math.abs(now.operating+later.operating)<1e-8)) result.push(`${later.operating>0?'Puis coût':'Puis économie'} : ≈${shortMoney(later.operating,mode)}/an dans ${c.delayed.after} an${c.delayed.after>1?'s':''}`);
 }
 if(c.delayed && c.effect.operating && Math.abs(c.effect.operating+(c.delayed.effect.operating??0))<1e-8) return result.map(s=>s.replace('/an',c.delayed!.after===1?' cette année':` pendant ${c.delayed!.after} ans`));
 return result.length?result:['Sans dépense en plus'];
}
