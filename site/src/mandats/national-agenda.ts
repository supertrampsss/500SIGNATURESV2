import { NATIONAL_CATALOGUE } from './national-branches.ts';
import { REFORMS } from './national-reforms.ts';
import { campaignCost } from './campaign-content.ts';
import type { Choice, Dossier, Effect, Game, Society } from './types.ts';

type Topic = [string, string, keyof Society, string, number, string, string, number, keyof Society, string];
type Entry = { id: string; kind: 'reform'|'opportunity'|'crisis'; dossier: Dossier; source?: string; group?: keyof Society };
const advisor = 'Enveloppes distinctes et rendements hypothétiques du jeu. Les conséquences sociales continuent de modifier le budget, même sans carte de crise.';
const option=(id:string,title:string,effect:Effect,sacrifice:string):Choice=>({id,title,effect,sacrifice,description:sacrifice,benefit:'La mesure est appliquée.',cost:campaignCost(effect,undefined,'Md€')});
function topic(id:string,t:Topic,kind:Entry['kind'],source?:string):Entry {
 const [category,title,group,cut,saving,harm,tax,yieldValue,payer,service]=t;
 return {id,kind,source,group,dossier:{category,title,story:`Vous arbitrez les moyens consacrés à ${service}. Chaque option engage le budget et les personnes concernées.`,advisor,choices:[
  option(id+'a',cut,{operating:-saving,society:{[group]:-3},services:-1},harm),
  option(id+'b',tax,{revenue:yieldValue,society:{[payer]:-2},trust:-1},'Les contributeurs ciblés disposent de moins de revenus.'),
  option(id+'c','Renforcer '+service,{operating:2,society:{[group]:4},services:1},'Le service progresse, pour 2 Md€/an de dépenses supplémentaires.'),
 ]}};
}
const extra:Topic[]=[
 ['Achats publics','Faut-il centraliser les achats publics ?','publicStaff','Réduire les achats dispersés',4,'Les services disposent de moins de liberté dans leurs achats.','Financer les achats par une contribution des grands fournisseurs',3,'businesses','la qualité des équipements publics'],
 ['Apprentissage','Comment financer les contrats d’apprentissage ?','workers','Réserver les aides aux premières qualifications',3,'Certains employeurs et apprentis perdent le soutien.','Faire contribuer davantage les grandes entreprises',4,'businesses','l’accompagnement des apprentis'],
 ['Formation','Quels organismes de formation faut-il financer ?','workers','Arrêter les formations aux résultats insuffisants',3,'Des offres disparaissent et les transitions sont plus difficiles.','Relever la contribution formation des employeurs',3,'businesses','les reconversions professionnelles'],
 ['Transport','Qui doit financer les transports du quotidien ?','workers','Réduire les subventions aux lignes peu fréquentées',3,'Des voyageurs perdent une desserte.','Relever la contribution transport des employeurs',4,'businesses','les transports du quotidien'],
 ['Agriculture','Comment répartir les soutiens agricoles ?','businesses','Plafonner les aides nationales aux grandes exploitations',2,'Les exploitations concernées financent moins de projets.','Créer une contribution sur les très grandes exploitations',2,'businesses','la transition des petites exploitations'],
 ['Numérique','Faut-il mutualiser les systèmes informatiques de l’État ?','publicStaff','Fermer les outils redondants',3,'La transition perturbe les équipes.','Faire contribuer les grandes plateformes numériques',3,'businesses','les services numériques publics'],
 ['Patrimoine public','Que faire des bâtiments publics sous-utilisés ?','publicStaff','Réduire les surfaces louées et les frais de gestion',2,'Les équipes partagent des locaux plus restreints.','Relever la contribution des grands bailleurs professionnels',2,'businesses','l’entretien des bâtiments publics'],
 ['Sport','Quels équipements sportifs soutenir ?','workers','Arrêter les financements des équipements surdimensionnés',2,'Certains territoires renoncent à leurs projets.','Relever les prélèvements sur les paris sportifs',2,'businesses','le sport de proximité'],
 ['Administration','Faut-il supprimer les opérateurs aux missions redondantes ?','publicStaff','Fusionner les opérateurs et réduire leurs moyens',3,'Des emplois et des expertises sont supprimés.','Financer leurs missions par une contribution sur les hauts patrimoines',3,'affluent','l’expertise publique'],
 ['Fiscalité patrimoniale','Comment répartir l’effort sur le patrimoine ?','affluent','Supprimer des aides patrimoniales peu ciblées',3,'Les ménages concernés perdent ces soutiens.','Relever le prélèvement sur les très hauts patrimoines',5,'affluent','l’accompagnement des transmissions modestes'],
];
const opportunities:Topic[]=[
 ['Autonomie','Comment organiser l’aide à domicile ?','pensioners','Réserver les interventions subventionnées aux dépendances lourdes',2,'Les autres retraités financent davantage leur aide.','Faire contribuer les pensions les plus élevées',2,'pensioners','l’aide à domicile'],
 ['Guichets','Quel avenir pour les démarches administratives ?','publicStaff','Regrouper les permanences peu fréquentées',2,'Les usagers se déplacent davantage.','Financer des guichets par une contribution des grandes entreprises',2,'businesses','l’accueil administratif'],
 ['Pouvoir d’achat','Faut-il cibler les tarifs sociaux sur les produits essentiels ?','vulnerable','Resserrer les critères des tarifs sociaux',2,'Certains ménages sortent du dispositif.','Financer les tarifs sociaux par une contribution sur les hauts revenus',2,'affluent','l’accès aux produits essentiels'],
 ['Industrie','Comment soutenir la relocalisation industrielle ?','businesses','Réserver les financements aux sites déjà engagés',2,'De nouveaux projets ne sont plus accompagnés.','Faire contribuer les grands groupes importateurs',2,'businesses','la relocalisation industrielle'],
 ['Prévention','Qui finance la prévention en santé ?','vulnerable','Réduire les campagnes de prévention généralistes',2,'La couverture de prévention diminue.','Relever les prélèvements sur les produits sucrés',2,'workers','la prévention en santé'],
 ['Prestations','Faut-il simplifier les aides sociales ?','vulnerable','Fusionner les guichets et réduire leurs frais',2,'La transition complique temporairement les demandes.','Financer un accès unique par les revenus du capital',2,'affluent','l’accès aux droits sociaux'],
 ['Intégration','Comment soutenir l’apprentissage du français ?','newcomers','Cibler les cours financés sur les publics prioritaires',1,'Certains nouveaux résidents financent leurs cours.','Faire contribuer les entreprises recrutant à l’étranger',1,'businesses','l’apprentissage du français'],
 ['Vie locale','Qui finance les activités locales ?','workers','Réduire les aides aux événements non prioritaires',2,'Des événements disparaissent.','Créer une contribution des grands organisateurs commerciaux',2,'businesses','les activités locales'],
 ['Seniors','Comment adapter les emplois aux fins de carrière ?','workers','Limiter les aides aux reconversions des seniors',2,'Les transitions sont plus difficiles.','Faire contribuer les employeurs aux aménagements de fin de carrière',2,'businesses','l’emploi des seniors'],
 ['Soins','Comment organiser les transports sanitaires ?','vulnerable','Regrouper les trajets sanitaires programmés',2,'Les patients attendent davantage.','Financer les transports sanitaires par les contrats de complémentaire',2,'workers','les transports sanitaires'],
 ['Carrières','Comment recruter dans les métiers publics en tension ?','publicStaff','Réduire les dispositifs de recrutement généralistes',2,'Les recrutements se concentrent sur moins de métiers.','Financer les recrutements par une contribution sur les bénéfices',2,'businesses','les recrutements publics'],
 ['Emploi','Comment accompagner le retour à l’emploi ?','workers','Réserver l’accompagnement intensif aux plus éloignés de l’emploi',2,'Les autres demandeurs sont moins accompagnés.','Faire contribuer les entreprises aux parcours de retour à l’emploi',2,'businesses','le retour à l’emploi'],
 ['Énergie','Comment accompagner la conversion énergétique ?','businesses','Réserver les aides aux conversions les plus rentables',2,'Certains usagers restent sans solution financée.','Relever les prélèvements sur les usages professionnels les plus polluants',2,'businesses','la conversion énergétique'],
 ['Logement','Comment remettre les logements vacants en location ?','vulnerable','Réduire les subventions de remise en location',2,'Moins de logements sont rénovés.','Relever les prélèvements sur la vacance durable',2,'affluent','la remise en location'],
 ['Communes','Comment mutualiser les équipements des communes ?','publicStaff','Partager les équipements et réduire les doublons',2,'L’accès à certains équipements s’éloigne.','Faire contribuer les propriétaires de grands patrimoines fonciers',2,'affluent','les équipements communaux'],
 ['Innovation','Comment financer les jeunes entreprises innovantes ?','businesses','Limiter les subventions aux projets déjà cofinancés',2,'Des projets risqués ne sont plus soutenus.','Réduire les avantages fiscaux des investisseurs les plus aisés',2,'affluent','les jeunes entreprises innovantes'],
 ['Petite enfance','Comment développer les places en crèche ?','workers','Réduire les aides aux structures les plus coûteuses',2,'Des places ferment dans les structures concernées.','Financer les crèches par une contribution des grandes entreprises',2,'businesses','les places en crèche'],
 ['Information','Comment financer l’information locale ?','workers','Réduire les aides à la presse sans couverture locale',2,'Certains titres perdent leur financement.','Faire contribuer les plateformes de publicité',2,'businesses','l’information locale'],
 ['Coopération','Quels projets internationaux poursuivre ?','businesses','Concentrer les financements sur les programmes évalués',2,'Les autres programmes s’arrêtent.','Réduire les exonérations des grandes activités internationales',2,'businesses','la coopération internationale'],
 ['Infrastructures','Comment choisir les infrastructures prioritaires ?','workers','Écarter les projets à faible fréquentation prévue',2,'Des territoires perdent leurs projets.','Faire contribuer les grands utilisateurs professionnels',2,'businesses','les infrastructures prioritaires'],
 ['Justice','Comment financer l’accès à la justice ?','vulnerable','Resserrer les plafonds d’aide juridictionnelle',2,'Des justiciables financent davantage leur défense.','Relever la contribution sur les grandes opérations juridiques',2,'businesses','l’accès à la justice'],
 ['Éducation','Quels moyens consacrer au soutien scolaire ?','vulnerable','Cibler les moyens sur les établissements les plus fragiles',2,'Les autres établissements perdent des moyens.','Réduire les avantages fiscaux du soutien scolaire des foyers aisés',2,'affluent','le soutien scolaire'],
 ['Eau','Comment financer la rénovation des réseaux d’eau ?','workers','Réduire les subventions aux réseaux les moins dégradés',2,'Des rénovations sont reportées.','Faire contribuer davantage les grands consommateurs industriels',2,'businesses','les réseaux d’eau'],
 ['Handicap','Comment financer l’accessibilité des services ?','vulnerable','Cibler les adaptations sur les services les plus fréquentés',2,'Certains lieux restent difficiles d’accès.','Faire contribuer les grandes entreprises aux adaptations',2,'businesses','l’accessibilité des services'],
 ['Sécurité','Comment répartir les moyens de sécurité ?','publicStaff','Réduire les fonctions de soutien non prioritaires',2,'Les équipes disposent de moins de soutien.','Relever les prélèvements sur les grands contrats de sécurité privée',2,'businesses','la présence des services de sécurité'],
];
const reforms:Entry[]=NATIONAL_CATALOGUE.slice(0,20).map((d,i)=>({id:REFORMS[i].id,kind:'reform',group:REFORMS[i].group,dossier:{...structuredClone(d),advisor}}));
// The hypothetical residence reform is committed in one vote, with a delayed yield.
const residence=reforms[6].dossier;
residence.story='Dans ce scénario, le cadre juridique serait modifié avec exemptions avant application. Le rendement retenu est une hypothèse de jeu, sans attribution de 9 Md€ à cette seule règle.';
residence.choices[0]={...residence.choices[0],title:'Instaurer le délai dans un cadre juridique modifié',effect:{investment:.2,operating:.5,trust:-2},sacrifice:'Préparation : 0,2 Md€ ponctuels, gestion : 0,5 Md€/an. La restriction réduit ensuite les aides.',description:'La transition dure un an. Les personnes exemptées conservent leurs droits.',delayed:{after:1,label:'La restriction des aides entre en vigueur : 2 Md€/an de charges en moins, avec 0,5 Md€/an de gestion maintenus. Hypothèse du jeu.',effect:{operating:-2,society:{newcomers:-8,vulnerable:-2},cohesion:-2}}};
residence.choices[0].cost=campaignCost(residence.choices[0].effect,residence.choices[0].delayed,'Md€');
reforms.push(...extra.map((t,i)=>topic('r'+(21+i),t,'reform')));
const unlocked=opportunities.map((t,i)=>topic('u'+String(i).padStart(2,'0'),t,'opportunity',i<20?REFORMS[i].id:undefined));
const crisisTitles=['Les retraités réduisent leurs dépenses essentielles : comment intervenir ?','Les délais aux guichets s’allongent : comment assurer l’accueil ?','Les ménages réduisent leurs achats essentiels : quelle réponse ?','Des entreprises suspendent leurs projets : quel soutien cibler ?','Le renoncement aux soins progresse : quelle réponse apporter ?','Les demandes d’aide d’urgence augmentent : comment intervenir ?','L’accès aux aides se dégrade pour les nouveaux résidents : quelle réponse ?','Des activités associatives ferment : comment maintenir les services essentiels ?','Des seniors restent sans emploi : comment les accompagner ?','L’accès à l’hôpital se dégrade : quels moyens de proximité financer ?','Des postes publics restent vacants : comment attirer des candidats ?','Des chômeurs arrivent en fin de droits : quelle protection financer ?','Des entreprises peinent à convertir leur énergie : quelle réponse ?','Les impayés de loyer augmentent : comment intervenir ?','Des communes perdent des accueils de proximité : quelle réponse ?'];
const crises:Entry[]=crisisTitles.map((title,i)=>{
 const r=REFORMS[i];return {id:'k'+i,kind:'crisis',source:r.id,group:r.group,dossier:{category:'Conséquence sociale',title,story:'Les effets de plusieurs décisions se cumulent. Une intervention ciblée devient possible ; la réforme votée reste appliquée.',advisor,choices:[
  option('k'+i+'a','Cibler l’urgence dans les moyens existants',{society:{[r.group]:1},trust:-1},'Certains besoins restent sans réponse. Aucun nouveau gain budgétaire.'),
  option('k'+i+'b','Financer une aide ciblée par une contribution des hauts revenus',{operating:2,revenue:3,society:{[r.group]:4,affluent:-2}},'Les ménages aisés financent l’intervention.'),
  option('k'+i+'c','Renforcer immédiatement les moyens',{operating:3,society:{[r.group]:6},services:1},'L’intervention ajoute 3 Md€/an au budget.'),
 ]}};
});
export const NATIONAL_AGENDA:readonly Entry[]=[...reforms,...unlocked,...crises];
const entryForChoice=(id:string)=>NATIONAL_AGENDA.find(e=>e.dossier.choices.some(c=>c.id===id));
const tie=(seed:number,id:string)=>{let n=seed>>>0;for(const c of id)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n/4294967296;};
/** 30 reforms occupy two slots out of three. The 15 remaining slots have 0–5 crises.
 * No queue is persisted: eligibility is recomputed, so recovery cancels a latent crisis.
 * IDs preserve history; importing and planning replay decisions through the same selector. */
export function agendaEntry(g:Game):Entry {
 if(g.turn%3!==2)return reforms[Math.floor(g.turn/3)*2+g.turn%3];
 const played=g.choices.map(entryForChoice),used=new Set(played.map(e=>e?.id));
 const crisisTurns=played.flatMap((e,i)=>e?.kind==='crisis'?[i]:[]);
 const lastCrisis=crisisTurns.at(-1)??-100;
 const eligible=crises.filter(e=>{
  const sourceTurn=g.choices.indexOf(e.source+'a');
  return !used.has(e.id)&&sourceTurn>=0&&g.turn-sourceTurn>=5&&g.turn>=5&&g.turn-lastCrisis>=5&&crisisTurns.length<5&&g.society![e.group!]<(e.group==='newcomers'?55:e.group==='pensioners'?50:45);
 });
 if(eligible.length)return eligible.sort((a,b)=>g.society![a.group!]-g.society![b.group!]||tie(g.seed,a.id)-tie(g.seed,b.id))[0];
 const recent=played.slice(-2).map(e=>e?.dossier.category);
 const candidates=unlocked.filter(e=>!used.has(e.id)&&(!e.source||used.has(e.source)));
 const priority=(e:Entry)=>(e.source?(g.choices.includes(e.source+'a')?40:g.choices.includes(e.source+'b')?20:10):0)+(e.group?Math.max(0,60-g.society![e.group]):0)-(recent.includes(e.dossier.category)?50:0)+tie(g.seed,e.id);
 const result=candidates.sort((a,b)=>priority(b)-priority(a))[0];
 if(!result)throw new Error('Agenda sans dossier disponible.');
 return result;
}
export function nationalAgendaDossiers(g:Game):Dossier[] {
 return Array.from({length:45},(_,slot)=>{
  if(g.choices[slot]){const e=entryForChoice(g.choices[slot]);if(!e)throw new Error('Dossier historique inconnu.');return e.dossier;}
  if(slot!==g.turn)return reforms[0].dossier; // Non-actionable future previews are hidden by the planner.
  const e=agendaEntry(g);
  const origin=e.source?g.history.find(h=>h.choice.startsWith(e.source!)&&h.choice.length===e.source!.length+1)?.title:undefined;
  return origin?{...e.dossier,story:`Après « ${origin} ». ${e.dossier.story}`}:e.dossier;
 });
}
