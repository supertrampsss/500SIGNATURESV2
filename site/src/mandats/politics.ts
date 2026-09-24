import type { Choice, Game } from './types.ts';
import type { PoliticalAction, PoliticalChoice, PoliticalResolution, PoliticalState, VoteGroup, VoteRecord } from './politics-types.ts';

const seedRand=(seed:number,turn:number,s:string)=>{
  let h=(seed^Math.imul(turn+1,0x9e3779b1))>>>0;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x85ebca6b);h^=h>>>13;}
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
  return (h>>>0)/4294967296;
};
const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
const SEATS=[151,114,105,107,100];
const IDS=['presidential','reformist','social','conservative','regional'] as const;
const LABELS=['Majorité présidentielle','Réformistes','Gauche sociale','Conservateurs','Territoires'] as const;
function allocate(seed:number,social=50,legitimacy=55):number[]{
  const weights=[28,21,18,18,15].map((v,i)=>Math.max(4,v+(i===2?(50-social)*.18:0)+(i===0?(legitimacy-55)*.12:0)+(seedRand(seed,0,`seat-${i}`)-.5)*7));
  const sum=weights.reduce((a,b)=>a+b,0), raw=weights.map(w=>577*w/sum), out=raw.map(Math.floor);
  const remainder=577-out.reduce((a,b)=>a+b,0),order=raw.map((v,i)=>[v-out[i],i] as const).sort((a,b)=>b[0]-a[0]);
  for(let n=0;n<remainder;n++)out[order[n][1]]++;
  return out;
}
export function initialPolitics(seed:number):PoliticalState {
  return {blocs:IDS.map((id,i)=>({id,label:LABELS[i],seats:SEATS[i],loyalty:[78,60,46,38,45][i],inGovernment:i<2})),legitimacy:58,unrest:18,cabinet:'stable',commitments:[],votes:[],scandalExposure:0,misconduct:0,failedBills:0,emergencyUses:0};
}
function apportion(blocs:PoliticalState['blocs'],total:number):number[] {
  const denominator=blocs.reduce((n,b)=>n+b.seats,0),raw=blocs.map(b=>total*b.seats/denominator),seats=raw.map(Math.floor);
  const order=raw.map((x,i)=>[x-seats[i],i] as const).sort((a,b)=>b[0]-a[0]);
  for(let i=0,n=total-seats.reduce((a,b)=>a+b,0);i<n;i++)seats[order[i][1]]++;
  return seats;
}
function tallyGroups(before:PoliticalState,choice:Choice,seed:number,turn:number,kind:'law'|'censure'|'election'|'destitution',total:number,socialMood:number,stage:string,membership?:number[]):VoteGroup[] {
  const action=choice.political?.action, seats=membership??apportion(before.blocs,total);
  if(kind==='election'){
    const elected=allocate(seed,socialMood,before.legitimacy);
    return before.blocs.map((b,i)=>({id:b.id,label:b.label,for:0,against:0,abstain:0,seats:elected[i]}));
  }
  const pain=(id:string)=>{
    const effect=choice.effect.society??{};
    const ties:Record<string,Array<keyof typeof effect>>={presidential:['businesses','affluent'],reformist:['workers','businesses','publicStaff'],social:['workers','pensioners','vulnerable','newcomers','publicStaff'],conservative:['businesses','affluent','pensioners'],regional:['workers','publicStaff','newcomers']};
    const groups=ties[id]??[];
    return groups.length?groups.reduce((n,k)=>n+(effect[k]??0),0)/groups.length:0;
  };
  return before.blocs.map((b,i)=>{
    let probability=(b.inGovernment?.63:.39)+(b.loyalty-50)/300+Math.max(-.18,Math.min(.18,pain(b.id)*.025));
    probability+=(choice.effect.services??0)*.009+(choice.effect.cohesion??0)*.006+(choice.effect.trust??0)*.004;
    if(action==='coalition_bargain'&&b.id==='reformist')probability+=.25;
    if(action==='reject_bargain'&&b.id==='reformist')probability-=.28;
    if(action==='coalition_government')probability=b.inGovernment?.22:.78;
    if(kind==='censure')probability=(b.inGovernment?.13:.70)+(50-before.legitimacy)/260;
    if(kind==='destitution')probability=(b.inGovernment?.10:.48)+before.misconduct*(b.inGovernment?.075:.04);
    if(kind==='law'||kind==='censure')probability+=(seedRand(seed,turn,`${choice.id}:${b.id}:${stage}:discipline`)-.5)*.36;
    probability=clamp(probability,.04,.96);
    const turnout=.91+seedRand(seed,turn,`${choice.id}:${b.id}:${stage}:turnout`)*.09;
    const forN=Math.min(seats[i],Math.round(seats[i]*probability*turnout));
    const againstRate=.91-probability*.22+seedRand(seed,turn,`${choice.id}:${b.id}:${stage}:against`)*.08;
    const againstN=Math.min(seats[i]-forN,Math.round((seats[i]-forN)*againstRate));
    return {id:b.id,label:b.label,for:forN,against:againstN,abstain:seats[i]-forN-againstN};
  });
}
function vote(before:PoliticalState,choice:Choice,seed:number,turn:number,kind:'law'|'censure'|'election'|'destitution',socialMood=50,title=choice.title):VoteRecord {
  const stages:NonNullable<VoteRecord['stages']>=[];
  let sizes:number[]=[], names:string[]=[];
  if(kind==='destitution') {sizes=[577,348,925];names=['Assemblée nationale — proposition de réunion','Sénat — proposition de réunion','Haute Cour — destitution'];}
  else {sizes=[before.blocs.reduce((n,b)=>n+b.seats,0)];names=[kind==='election'?'Résultat des élections législatives':'Assemblée nationale'];}
  let groups:VoteGroup[]=[],passed=true;
  // A dissolution renews the Assembly only; retain the scenario’s Senate composition.
  const assemblySeats=apportion(before.blocs,577),senateSeats=apportion(initialPolitics(seed).blocs,348);
  for(let i=0;i<sizes.length;i++){
    const membership=kind==='destitution'?(i===0?assemblySeats:i===1?senateSeats:assemblySeats.map((n,j)=>n+senateSeats[j])):undefined;
    groups=tallyGroups(before,choice,seed,turn,kind,sizes[i],socialMood,`stage-${i}`,membership);
    const yes=groups.reduce((n,g)=>n+g.for,0),no=groups.reduce((n,g)=>n+g.against,0),abstain=groups.reduce((n,g)=>n+g.abstain,0);
    const electedSeats=kind==='election'?groups.reduce((n,g)=>n+(g.seats??0),0):0;
    const stageTotal=kind==='election'?electedSeats:sizes[i];
    const threshold=kind==='election'?0:kind==='law'?Math.floor((yes+no)/2)+1:kind==='censure'?Math.floor(sizes[i]/2)+1:Math.ceil(sizes[i]*2/3);
    const stagePassed=kind==='election'||yes>=threshold;
    stages.push({chamber:names[i],total:stageTotal,for:yes,against:no,abstain,threshold,passed:stagePassed,groups});
    if(!stagePassed){passed=false;break;}
  }
  const last=stages.at(-1)!;
  return {id:`${kind}-${turn}-${choice.id}`,kind,title,chamber:names.length>1?'Procédure en trois étapes':names[0],total:last.total,for:last.for,against:last.against,abstain:last.abstain,threshold:last.threshold,passed,groups:last.groups,consequences:[],...(kind==='destitution'?{stages}:{})};
}
export function resolvePoliticalChoice(before:PoliticalState, choice:Choice, seed=0, turn=0,socialMood=50):PoliticalResolution {
  const meta=choice.political??{action:'enact' as const};
  const action:PoliticalAction=meta.action;
  if(action==='dissolve'&&before.lastDissolutionTurn!==undefined&&turn-before.lastDissolutionTurn<6)throw new Error('Une nouvelle dissolution n’est pas disponible avant un an.');
  const consequences:string[]=[];let record:VoteRecord|undefined;
  const expired=before.commitments.filter(c=>c.status==='pending'&&c.dueTurn<=turn&&before.pendingCrisis===undefined);
  if(expired.length)consequences.push(`Engagement non tenu : ${expired.map(c=>c.label).join(', ')}. La légitimité, la tension et les soutiens baissent.`);
  const kind=meta.vote??(action==='censure'?'censure':action==='destitute'?'destitution':action==='dissolve'?'election':action==='enact'||action==='coalition_bargain'?'law':undefined);
  if(kind&&!(kind==='destitution'&&before.misconduct<6))record=vote(before,choice,seed,turn,kind,socialMood);
  if(kind==='destitution'&&!record)consequences.push('La procédure ne peut pas avancer : aucun manquement grave n’est établi.');
  const accepted=record?.passed??true;
  let effective:Choice=structuredClone(choice);
  if(meta.breakCommitment==='wealth-hospital'&&!before.commitments.some(c=>c.id==='wealth-hospital'&&(c.status==='pending'||c.status==='honored'))){
    effective.effect={...effective.effect};
    if((effective.effect.revenue??0)<0)delete effective.effect.revenue;
    if((effective.effect.operating??0)<0)delete effective.effect.operating;
    consequences.push('Aucune mesure fiscale ou hospitalière non votée n’est retirée.');
  }
  // An unpassed law has no fiscal, social, project or delayed implementation effects.
  if(record?.kind==='law'&&!accepted){effective={...effective,effect:{},delayed:undefined};consequences.push('Texte rejeté : aucune recette, dépense, mesure sociale ni livraison prévue n’est appliquée.');}
  else if(record?.kind==='law')consequences.push('Texte adopté : ses effets sont appliqués et financés.');
  if(action==='coalition_bargain'&&accepted)consequences.push('Le compromis maintient l’appui du groupe pivot.');
  if(action==='reject_bargain'&&accepted)consequences.push('Le choix de maintenir la mesure fiscale fragilise l’accord parlementaire.');
  if(record?.kind==='censure')consequences.push(record.passed?'La motion de censure est adoptée : le gouvernement tombe, le mandat présidentiel continue.':'La motion de censure échoue ; le gouvernement reste en place, avec un coût politique.');
  if(record?.kind==='destitution')consequences.push(record.passed?'Les deux assemblées saisissent la Haute Cour, qui adopte la destitution aux deux tiers.':'La procédure s’arrête à la première étape qui n’atteint pas les deux tiers des membres de l’assemblée concernée.');
  if(action==='cover_up')consequences.push('La dissimulation accroît l’exposition au scandale.');
  if(meta.breakCommitment&&before.commitments.some(c=>c.id===meta.breakCommitment&&(c.status==='pending'||c.status==='honored'))&&(!record||record.passed))consequences.push('L’engagement correspondant est rompu ; ses recettes, crédits et soutiens sont retirés.');
  if(action==='publish_scandal')consequences.push('La publication des preuves ouvre la procédure et coûte des soutiens au gouvernement.');
  if(action==='dissolve')consequences.push('Une élection redistribue les 577 sièges ; la majorité peut changer.');
  if(action==='negotiate_rupture')consequences.push('Une transition négociée met fin au mandat avant son terme.');
  if(action==='emergency_rule')consequences.push('Les pouvoirs d’urgence réduisent les contre-pouvoirs et aggravent la contestation.');
  if(record)record.consequences=[...consequences];
  return {choice:effective,...(record?{vote:record}:{}),consequences};
}
export function applyPoliticalResolution(before:PoliticalState, after:Game, originalChoice:Choice, resolution:PoliticalResolution, seed=0, turn=0):PoliticalState {
  const p=structuredClone(before),m:PoliticalChoice=originalChoice.political??{action:'enact'};
  if(resolution.vote){p.lastVote=resolution.vote;p.votes.push(resolution.vote);}
  const expired=before.commitments.filter(c=>c.status==='pending'&&c.dueTurn<=turn&&before.pendingCrisis===undefined);
  p.commitments=p.commitments.map(c=>expired.some(e=>e.id===c.id)?{...c,status:'broken'}:c);
  if(expired.length){p.legitimacy=clamp(p.legitimacy-4*expired.length);p.unrest=clamp(p.unrest+4*expired.length);p.blocs=p.blocs.map(b=>({...b,loyalty:clamp(b.loyalty-4*expired.length)}));}
  p.legitimacy=clamp(p.legitimacy+(m.legitimacy??0));p.unrest=clamp(p.unrest+(m.unrest??0));p.misconduct=clamp(p.misconduct+(m.misconduct??0),0,10);
  const adopted=!resolution.vote||resolution.vote.passed;
  if(m.commitment&&adopted)p.commitments.push({...m.commitment,status:'pending'});
  if(m.breakCommitment&&adopted){const c=p.commitments.find(x=>x.id===m.breakCommitment&&(x.status==='pending'||x.status==='honored'));if(c){c.status='broken';p.legitimacy=clamp(p.legitimacy-7);p.unrest=clamp(p.unrest+6);}}
  p.blocs=p.blocs.map(b=>({...b,loyalty:clamp(b.loyalty+(m.supportDelta?.[b.id]??0))}));
  if(m.action==='coalition_bargain'&&resolution.vote?.passed){const ally=p.blocs.find(b=>b.id==='reformist');if(ally)ally.loyalty=clamp(ally.loyalty+12);if(before.pendingCrisis==='censure')p.failedBills=0;p.pendingCrisis=undefined;}
  if(m.commitment?.id==='wealth-hospital'&&resolution.vote?.passed)p.pendingCrisis='coalition';
  if(m.action==='reject_bargain'&&(!resolution.vote||resolution.vote.passed)){const ally=p.blocs.find(b=>b.id==='reformist');if(ally){ally.loyalty=clamp(ally.loyalty-20);ally.inGovernment=false;}p.commitments=p.commitments.map(c=>c.id==='wealth-hospital'&&c.status==='pending'?{...c,status:'honored'}:c);p.pendingCrisis='censure';}
  if(m.action==='censure'){p.failedBills=0;if(resolution.vote?.passed){p.cabinet='fallen';p.pendingCrisis='cabinet';}else{p.legitimacy=clamp(p.legitimacy-4);p.unrest=clamp(p.unrest+4);p.pendingCrisis=p.misconduct>=6?'destitution':undefined;}}
  if(m.action==='confidence'&&p.pendingCrisis==='censure'){p.pendingCrisis=undefined;p.failedBills=0;}
  if(m.action==='coalition_government'&&adopted){p.cabinet='cohabitation';p.pendingCrisis=undefined;p.blocs=p.blocs.map(b=>({...b,inGovernment:(resolution.vote?.groups.find(g=>g.id===b.id)?.for??0)>(resolution.vote?.groups.find(g=>g.id===b.id)?.against??0)}));}
  if(m.action==='dissolve'&&resolution.vote?.passed){const old=p.blocs.map(b=>b.seats),ns=p.blocs.map(b=>resolution.vote!.groups.find(g=>g.id===b.id)?.seats??b.seats),governmentHasMajority=ns[0]+ns[1]>=289;p.blocs=p.blocs.map((b,i)=>({...b,seats:ns[i],inGovernment:i===0||i===1,loyalty:clamp(b.loyalty+(ns[i]>old[i]?6:-5))}));p.lastDissolutionTurn=turn;p.cabinet=governmentHasMajority?'stable':'fallen';p.pendingCrisis=governmentHasMajority?undefined:'cabinet';}
  if(m.action==='publish_scandal'){p.scandalExposure=0;p.pendingCrisis='censure';}
  if(m.action==='cover_up'){p.scandalExposure=clamp(p.scandalExposure+2,0,10);p.pendingCrisis='scandal';}
  if(m.action==='destitute'&&resolution.vote?.passed)p.ending={kind:'destitution',title:'Destitution',reason:'La Haute Cour a adopté la destitution aux deux tiers de ses membres.',turn,causes:['Manquement institutionnel grave','Votes des deux assemblées','Décision de la Haute Cour']};
  if(m.action==='negotiate_rupture')p.ending={kind:'rupture',title:'Transition anticipée',reason:'La rupture a été négociée avec les institutions.',turn,causes:[`Légitimité ${p.legitimacy}`,`Contestations ${p.unrest}`,'Transition négociée']};
  if(m.action==='emergency_rule'){
    p.legitimacy=clamp(p.legitimacy-12);p.unrest=clamp(p.unrest+18);p.emergencyUses++;
    if(p.emergencyUses>=2)p.ending={kind:'rupture',title:'Rupture institutionnelle',reason:'Après deux décisions d’urgence, les institutions ne parviennent plus à maintenir un gouvernement.',turn,causes:[`Légitimité ${p.legitimacy}`,`Contestations ${p.unrest}`,'Pouvoirs d’urgence répétés']};
    else p.pendingCrisis=undefined;
  }
  const applied=resolution.choice.effect;
  const socialPain=Object.values(applied.society??{}).reduce((sum,n)=>sum+n,0);
  const servicesPain=applied.services??0,trustPain=applied.trust??0;
  const unrestDelta=(-socialPain/3)-servicesPain*.45-trustPain*.3;
  p.unrest=clamp(p.unrest+unrestDelta);
  if(resolution.vote?.kind==='law'){
    if(!resolution.vote.passed){p.failedBills++;p.legitimacy=clamp(p.legitimacy-2);p.unrest=clamp(p.unrest+3);}
    else p.failedBills=0;
  }
  if(p.failedBills>=2&&p.pendingCrisis===undefined)p.pendingCrisis='censure';
  if(p.cabinet==='stable'&&p.unrest>=70&&p.legitimacy<=35&&p.pendingCrisis===undefined)p.pendingCrisis='censure';
  if(p.cabinet==='fallen'&&p.unrest>=88&&p.legitimacy<=18&&p.pendingCrisis!==undefined)p.pendingCrisis='rupture';
  if(p.misconduct>=6&&p.pendingCrisis===undefined)p.pendingCrisis='destitution';
  if(p.unrest>=88&&p.legitimacy<=18&&p.cabinet==='fallen')p.pendingCrisis='rupture';
  if(turn>=29&&!p.ending)p.ending={kind:'term_complete',title:'Fin du mandat',reason:'Les trente décisions prévues ont été jouées.',turn,causes:[]};
  return p;
}
