import type { CityBaseline } from './cities.ts';
import type { Choice, Dossier, Effect } from './types.ts';

/** Ruleset 4. Thresholds are game design assumptions, not legal limits or ratings.
 * Never change this ruleset after release: saved decisions are replayed against it. */
export type LocalProfile = ReturnType<typeof localProfile>;
export function localProfile(city: CityBaseline) {
  const o = city.observed, row = city.context?.years.find(r => r.year === city.year)?.values;
  const prior = city.context?.years.find(r => r.year === city.year - 1)?.values;
  const netShare = (o.savings - Math.min(o.repayment,o.debt)) / o.revenue;
  const debtYears = o.savings > 0 ? o.debt / o.savings : o.debt > 0 ? Infinity : 0;
  const savingsChange = prior?.savings && prior.savings > 0 ? (o.savings / prior.savings - 1) : null;
  return {
    netShare, debtYears, savingsChange,
    tight: netShare < .05, debtPressure: debtYears >= 8,
    investmentShare: o.investment / o.revenue,
    personnelShare: row?.personnel === undefined ? null : row.personnel / o.revenue,
    taxShare: row?.taxes === undefined ? null : row.taxes / o.revenue,
    salesShare: row?.sales === undefined ? null : row.sales / o.revenue,
    tourist: city.context?.flags.tourist === true,
    rural: city.context?.flags.rural === true,
    mountain: city.context?.flags.mountain === true,
  };
}
const n = (v:number) => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(v);
const pct = (v:number) => `${n(v*100)} %`;
const labels = { services:'Services', cohesion:'Cohésion', resilience:'Résilience', trust:'Confiance', assets:'Patrimoine' };
function option(title:string, description:string, effect:Effect, sacrifice:string, delayed?:Choice['delayed']):Choice {
  const benefits = Object.entries(labels).flatMap(([key,label]) => {
    const value = (delayed?.effect ?? effect)[key as keyof typeof labels];
    return value && value>0 ? [`${label} +${value}`] : [];
  });
  const saving=(delayed?.effect.operating??effect.operating??0)<0;
  return { id:'',title,description,effect,cost:'',sacrifice,benefit:benefits.slice(0,2).join(' · ') || (saving?'Marge de fonctionnement accrue':(effect.repayment??0)>0?'Dette future réduite':(effect.revenue??0)>0?'Recettes durables':'Marge préservée'),...(delayed?{delayed}: {}) };
}
function brief(category:string,title:string,evidence:string,context:string,choices:Choice[]):Dossier {
  return {category,title,story:`${evidence} ${context}`,advisor:'Diagnostic calculé sur les comptes publiés. Seuils, enveloppes et conséquences : hypothèses de jeu. Les variations ne prouvent ni leur cause ni l’état d’un équipement.',choices};
}
function savings(city:CityBaseline,p:LocalProfile,stage:number):Dossier {
  const fact=`En ${city.year}, l’épargne après remboursement représente ${pct(p.netShare)} des recettes de ${city.name}.`;
  const titles=p.tight?['Retrouver une marge avant de promettre','Financer la suite sans étouffer les services','Transmettre une marge de sécurité']:['À quoi employer votre marge de départ ?','Transformer la marge en services durables ?','Préserver la marge ou renforcer l’héritage ?'];
  const trim=[.18,.12,.08][stage], service=[.12,.18,.10][stage];
  return brief('Épargne locale',titles[stage],fact,'Cette photographie de départ guide le scénario. Les décisions déjà prises modifient votre marge de jeu.',p.tight?[
    option(['Réduire les achats non essentiels','Revoir les contrats récurrents','Prolonger l’effort de sobriété'][stage],'Diminuer durablement les charges, avec une moindre souplesse pour les services.',{operating:-trim,services:-1},'Moins de souplesse pour les équipes.'),
    option(['Financer une recette durable','Élargir l’effort de financement','Sécuriser les recettes futures'][stage],'Augmenter les recettes du scénario, sans calcul de taxe individuelle.',{revenue:service,trust:-2},'Un effort supplémentaire demandé aux contribuables.'),
    option('Stabiliser les engagements','Ne pas ajouter de charge ni de recette à ce dossier.',{},'La marge ne se reconstitue pas par ce choix.'),
  ]:[
    option(['Renforcer l’accueil municipal','Pérenniser l’accompagnement','Consolider les permanences'][stage],'Ajouter des moyens de proximité récurrents dans le scénario.',{operating:service,services:2,cohesion:1},'Une charge revient chaque année.'),
    option(['Améliorer les locaux existants','Financer un lot de réhabilitation','Livrer une dernière amélioration'][stage],'Une enveloppe hypothétique sur le parc municipal, sans diagnostic d’un bâtiment précis.',{investment:[.7,.9,.5][stage],assets:2,services:1},'Moins de moyens pour les autres projets.'),
    option('Conserver la marge','Ne prendre aucun engagement supplémentaire.',{},'Pas d’amélioration supplémentaire des services.'),
  ]);
}
function debt(city:CityBaseline,p:LocalProfile,stage:number):Dossier {
  const fact=city.observed.debt===0?`Les comptes ${city.year} de ${city.name} ne portent pas d’encours de dette.`:city.observed.savings===0?`L’épargne brute ${city.year} de ${city.name} est nulle : le ratio dette / épargne ne peut pas être calculé.`:`En ${city.year}, la dette représente ${n(p.debtYears)} années d’épargne brute à ${city.name}.`;
  const pressure=p.debtPressure;
  const titles=pressure?['Desserrer le poids de la dette','Financer un projet avec une dette héritée élevée','Quelle dette transmettre au mandat suivant ?']:['Emprunter pour quoi, et à quel rythme ?','Utiliser la capacité de financement ?','Dette ou patrimoine : le dernier arbitrage'];
  // Do not offer principal repayment when initial debt is zero; all choices stay reversible in the planner.
  const repay=Math.min(city.observed.debt/city.observed.revenue*100,[.3,.4,.25][stage]);
  return brief('Dette et financement',titles[stage],fact,'La capacité de désendettement est un ratio analytique. Ce n’est ni un plafond légal ni une durée contractuelle.',[
    pressure && repay>0
      ? option('Rembourser davantage de capital','Consacrer une part de l’épargne au remboursement. Disponible seulement si le budget le permet.',{repayment:repay},'Moins de ressources propres pour investir.')
      : option('Investir dans le parc existant','Financer un programme supplémentaire, dont le besoin résiduel peut être emprunté.',{investment:[.8,1,.6][stage],assets:2,resilience:1},'Le financement peut accroître la dette.'),
    option(pressure?'Limiter le nouveau chantier':'Choisir une tranche plus légère','Une enveloppe plus petite préserve davantage le financement.',{investment:[.2,.3,.15][stage],assets:1},'Une amélioration plus limitée.'),
    option('Ne pas ajouter de financement','Maintenir seulement les engagements déjà intégrés au plan annuel.',{},'Les nouveaux projets attendent.'),
  ]);
}
function investment(city:CityBaseline,p:LocalProfile,stage:number):Dossier {
  const high=p.investmentShare>=.2;
  const fact=`L’investissement ${city.year} représente ${pct(p.investmentShare)} des recettes de fonctionnement de ${city.name}.`;
  return brief('Programme local',(high?['Un programme déjà dense : où placer la suite ?','Absorber les chantiers avant d’en ouvrir d’autres','Terminer les projets ou ouvrir une nouvelle tranche ?']:['Quel premier effort d’investissement supplémentaire ?','Donner de la continuité aux travaux','Laisser un programme prêt à poursuivre'])[stage],fact,'Ce montant ne renseigne pas sur l’état du patrimoine. Les travaux proposés sont des enveloppes de simulation.',[
    option(high?'Ajouter une tranche ciblée':'Renforcer le programme de travaux','Engager une enveloppe supplémentaire sur les équipements municipaux.',{investment:(high?.4:.9)+stage*.1,assets:2},'L’enveloppe s’ajoute au programme hérité.'),
    option('Miser sur l’entretien courant','Ajouter des petites réparations récurrentes sans chantier lourd.',{operating:.1+stage*.02,assets:1},'Une charge durable pour le prochain budget.'),
    option(high?'Achever avant d’ajouter':'Conserver le rythme actuel','Garder le programme annuel sans engagement nouveau.',{},'Pas de progrès supplémentaire sur ce dossier.'),
  ]);
}
function personnel(city:CityBaseline,p:LocalProfile,stage:number):Dossier {
  const known=p.personnelShare!==null, high=known&&p.personnelShare!>=.5;
  const fact=known?`Les charges de personnel représentent ${pct(p.personnelShare!)} des recettes ${city.year} de ${city.name}.`:`Le scénario de ${city.name} ne dispose pas d’un montant exploitable de charges de personnel.`;
  const basis=known?p.personnelShare!*100:40;
  return brief('Équipes municipales',(high?['Améliorer l’accueil avec les équipes en place','Organiser les services avant de recruter','Transmettre une organisation soutenable']:['Quels moyens humains pour les services ?','Former les équipes ou renforcer les effectifs ?','Pérenniser les moyens de proximité'])[stage],fact,'Le ratio ne mesure ni l’efficacité des agents ni un sureffectif. Les périmètres et modes de gestion diffèrent entre communes.',[
    option(high?'Former et réorganiser':'Renforcer les permanences',high?'Financer un effort de formation ponctuel puis améliorer l’organisation.':'Ajouter une enveloppe de personnel récurrente.',high?{operating:basis*.002}:{operating:basis*.004,services:2},high?'L’amélioration attend l’année suivante.':'La masse salariale augmente durablement.',high?{after:1,label:`Organisation des équipes, étape ${stage+1} : le gain de service simulé entre en vigueur.`,effect:{operating:-basis*.002,services:2}}:undefined),
    option('Ajouter un renfort ciblé','Financer un renfort récurrent limité dans le scénario.',{operating:basis*.0015,services:1},'Une charge annuelle supplémentaire.'),
    option('Redéployer les permanences','Changer l’organisation sans modifier les effectifs.',{services:1,cohesion:-1},'Certains usagers perdent leur créneau.'),
  ]);
}
function tax(city:CityBaseline,p:LocalProfile,stage:number):Dossier {
  const known=p.taxShare!==null;
  const fact=known?`Les impôts locaux représentent ${pct(p.taxShare!)} des recettes ${city.year} de ${city.name}.`:`Les comptes de ${city.name} donnent les recettes globales, sans produit fiscal local exploitable dans cet instantané.`;
  const basis=known?p.taxShare!*100:40;
  const falling=p.savingsChange!==null&&p.savingsChange<-.1;
  return brief('Recettes communales',(falling?['Une épargne en recul : faut-il demander plus ?','Répartir l’effort fiscal dans la durée','Stabiliser les recettes avant la transmission']:['Fiscalité : préserver les recettes ou alléger l’effort ?','Qui finance les nouveaux services ?','Quel effort fiscal laisser après vous ?'])[stage],fact,`${falling?`L’épargne brute publiée a diminué de ${pct(-p.savingsChange!)} entre ${city.year-1} et ${city.year}. `:''}La variation de produit proposée est une hypothèse ; elle ne correspond pas à la même variation d’un taux ni d’une facture individuelle.`,[
    option('Renforcer le produit fiscal','Augmenter le produit fiscal simulé, sans attribuer cette hausse à une décision réelle de la ville.',{revenue:basis*.006,trust:-2},'Les contribuables concernés supportent un effort.'),
    option(p.tight?'Financer autrement':'Alléger le produit fiscal',p.tight?'Réduire les achats récurrents pour éviter une hausse de recettes.':'Réduire le produit fiscal, à financer sur la marge disponible.',p.tight?{operating:-.15,services:-1}:{revenue:-basis*.004,trust:2},p.tight?'Moins de souplesse pour les services.':'Moins de recettes pour les prochains exercices.'),
    option('Maintenir le produit prévu','Ne pas modifier les recettes sur ce dossier.',{},'Les autres choix doivent trouver leur financement.'),
  ]);
}
function proximity(city:CityBaseline,p:LocalProfile,stage:number):Dossier {
  const kind=p.tourist?'tourist':p.mountain?'mountain':p.rural?'rural':'general';
  const variants={
    tourist:{category:'Accueil et fréquentation',fact:`La publication OFGL classe ${city.name} parmi les communes touristiques.`,titles:['Accueillir les visiteurs sans oublier les habitants','Quels services pendant les périodes de fréquentation ?','Faire durer les équipements d’accueil'],large:'Aménager les espaces d’accueil',small:'Renforcer un accueil saisonnier',limit:'Ce classement ne mesure ni une surfréquentation ni les recettes touristiques.'},
    mountain:{category:'Services en montagne',fact:`La publication OFGL identifie ${city.name} comme commune de montagne.`,titles:['Préparer la continuité des services','Investir dans des équipements polyvalents','Organiser la continuité au-delà du mandat'],large:'Adapter les locaux municipaux',small:'Renforcer la coordination',limit:'Ce classement ne prouve pas une route dangereuse ou un équipement défaillant.'},
    rural:{category:'Proximité rurale',fact:`La publication OFGL identifie ${city.name} comme commune rurale.`,titles:['Rapprocher les permanences des habitants','Un lieu partagé ou des permanences mobiles ?','Ancrer les services de proximité'],large:'Aménager un accueil partagé',small:'Organiser des permanences mobiles',limit:'Ce classement ne mesure pas les distances ni un manque réel de services.'},
    general:{category:'Usages municipaux',fact:`Le scénario s’appuie sur les comptes de ${city.name}, sans diagnostic observé des besoins par quartier.`,titles:['Ouvrir davantage ou améliorer les locaux ?','Répartir les créneaux des équipements','Quel accès aux services transmettre ?'],large:'Améliorer les locaux existants',small:'Étendre les permanences',limit:'Les besoins et la fréquentation sont des hypothèses de jeu.'},
  };
  const v=variants[kind];
  return brief(v.category,v.titles[stage],v.fact,`${v.limit} Les projets relèvent ici d’un parc supposé communal.`,[
    option(v.large,'Ajouter une enveloppe de travaux sur les équipements du scénario.',{investment:[.5,.7,.4][stage],services:2,assets:1},'Une dépense immédiate pour un usage durable.'),
    option(v.small,'Financer un renfort pendant un exercice, puis revenir aux moyens précédents.',{operating:.12,services:1,cohesion:1},'Le renfort s’arrête après un an.',{after:1,label:`Renfort de proximité, étape ${stage+1} : fin des moyens et du gain temporaire.`,effect:{operating:-.12,services:-1,cohesion:-1}}),
    option('Réorganiser les moyens existants','Modifier les créneaux sans créer une capacité nouvelle.',{services:1,trust:-1},'Certains usages habituels sont déplacés.'),
  ]);
}
const themes=[savings,debt,investment,personnel,tax,proximity] as const;
const slots=[[0,2,5,6,7,11],[15,18,23,24,28,30],[32,34,36,39,41,44]] as const;
/** 18 tailored dossiers + 27 service/project situations = exactly 45 decisions.
 * The same financial topic returns at three distinct mandate stages. */
export function localDossiers(city:CityBaseline,base:readonly Dossier[]):Dossier[] {
  const p=localProfile(city);
  const priorities=[p.tight?10:3,p.debtPressure?9:2,p.investmentShare>=.2?7:4,p.personnelShare!==null&&p.personnelShare>=.5?8:1,p.savingsChange!==null&&p.savingsChange<-.1?9:2,p.tourist||p.rural||p.mountain?6:0];
  const order=themes.map((_,i)=>i).sort((a,b)=>priorities[b]-priorities[a]||a-b);
  const result=base.map(d=>({...d,story:`Situation de jeu : ${d.story}`,advisor:`${d.advisor} Aucun besoin local n’est attesté pour cet équipement par l’instantané financier.`}));
  for(let stage=0;stage<slots.length;stage++)for(let rank=0;rank<6;rank++) {
    const theme=order[rank],d=themes[theme](city,p,stage);
    d.choices=d.choices.map((c,i)=>({...c,id:`l4${theme}${stage}${i}`}));
    result[slots[stage][rank]]=d;
  }
  return result;
}
