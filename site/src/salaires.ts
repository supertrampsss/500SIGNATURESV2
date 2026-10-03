import { timeChart } from "./chart-studio.ts";
import type { Territoire } from "./donnees.ts";
import { echapper } from "./texte.ts";

// OCDE, Taxing Wages 2026, tableau 1.2 : France, données 2025.
// Célibataire sans enfant au salaire moyen, composantes en % du coût employeur.
// Base de lecture fixe : aucun montant personnel n'est extrapolé.
const PROFIL_TRAVAIL = [
  ['Revenu après prélèvements',52.8],
  ['Cotisations salariales',8.3],
  ['Impôt sur le revenu',12.2],
  ['Cotisations patronales',26.7],
] as const;
const eurosProfil = new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
function formaterProfil(valeur:number):string {return `${eurosProfil.format(valeur)} €`;}

const MISSIONS = [
 ["protection_sociale","Retraites et prestations sociales","Pensions, chômage, famille, pauvreté et aides au logement"],
 ["sante","Santé","Soins, hôpitaux et médicaments"],
 ["enseignement","Éducation","Écoles, collèges, lycées et universités"],
 ["services_generaux","Administration et intérêts de la dette","Services généraux des administrations publiques"],
 ["affaires_economiques","Économie et transports","Transports, agriculture, énergie et aides aux entreprises"],
 ["ordre_securite","Sécurité et justice","Police, justice, pompiers et prisons"],
 ["defense","Défense","Forces armées et équipements"],
 ["culture","Culture, sport et loisirs","Équipements et activités collectives"],
 ["logement","Logement et équipements collectifs","Aménagement et équipements des territoires"],
 ["environnement","Environnement","Déchets, eaux usées et protection de la nature"],
] as const;
const PRESTATIONS = [
 ["vieillesse","Retraites"],["survivants","Pensions de réversion"],["maladie_invalidite","Arrêts maladie et invalidité"],["chomage","Chômage"],["famille","Famille et enfants"],["exclusion","RSA et autres minima sociaux"],["logement","Aides au logement"],
] as const;
const TRANSACTIONS = [
 ["remunerations","Rémunération des agents publics"],["transferts_nature","Soins et services remboursés"],["consommations","Achats de biens et de services"],["investissement","Investissement public"],["transferts_courants","Transferts courants"],["interets","Intérêts de la dette"],["subventions","Subventions aux entreprises"],["transferts_capital","Transferts en capital"],
] as const;
function repartitionDetaillee(series:Territoire["series"]) {
 const ids=[...PRESTATIONS.map(([id])=>"eurostat_apu_prestations_"+id),...TRANSACTIONS.map(([id])=>"eurostat_apu_"+id),"eurostat_apu_prestations","eurostat_apu_depenses"];
 const year=Object.keys(series.eurostat_apu_depenses??{}).sort().reverse().find(y=>ids.every(id=>Number.isFinite(series[id]?.[y])&&series[id][y]>=0));
 if(!year)return null;
 const total=series.eurostat_apu_depenses[year],parent=series.eurostat_apu_prestations[year];
 const benefits=PRESTATIONS.map(([id,label])=>({label,description:"Prestations versées",amount:series["eurostat_apu_prestations_"+id][year]}));
 const transactions=TRANSACTIONS.map(([id,label])=>({label,description:"Dépenses des administrations publiques",amount:series["eurostat_apu_"+id][year]}));
 const benefitRest=parent-benefits.reduce((sum,m)=>sum+m.amount,0);
 const rest=total-parent-transactions.reduce((sum,m)=>sum+m.amount,0);
 if(total<=0||benefitRest<0||rest<0)return null;
 return {year,basis:"Eurostat, comptes des administrations publiques et prestations par fonction",missions:[...benefits,...transactions,{label:"Autres prestations",description:"Prestations non ventilées dans les catégories ci-dessus",amount:benefitRest},{label:"Autres dépenses",description:"Solde des dépenses publiées",amount:rest}].sort((a,b)=>b.amount-a.amount).map(m=>({label:m.label,description:m.description,share:m.amount/total}))};
}
export function repartitionCollective(series: Territoire["series"] = {}) {
 const detailed=repartitionDetaillee(series);if(detailed)return detailed;
 const ids=MISSIONS.map(([id])=>"eurostat_fonction_"+id);
 const year=Object.keys(series[ids[0]]??{}).sort().reverse().find(y=>ids.every(id=>Number.isFinite(series[id]?.[y])&&series[id][y]>=0));
 if(!year)return null;
 const total=ids.reduce((sum,id)=>sum+series[id][year],0);
 const official=series.eurostat_depenses_publiques_pib?.[year];
 if(total<=0||!Number.isFinite(official)||Math.abs(total-official)>.5)return null;
 return {year,basis:"Eurostat, dépenses des administrations publiques par fonction (COFOG)",missions:MISSIONS.map(([id,label,description])=>({label,description,share:series["eurostat_fonction_"+id][year]/total}))};
}
export function historiqueRepartition(series:Territoire["series"]) {
 const latest=repartitionCollective(series);if(!latest)return [];
 const years=[...new Set(Object.values(series).flatMap(s=>Object.keys(s)))].filter(y=>/^\d{4}$/.test(y)).sort();
 return years.flatMap(year=>{
   const exact=Object.fromEntries(Object.entries(series).map(([id,values])=>[id,Number.isFinite(values[year])?{[year]:values[year]}:{}]));
   const data=repartitionCollective(exact);
   return data?.year===year && data.basis===latest.basis ? [data] : [];
 });
}
function graphiqueRepartition(postes:Array<{label:string;values:Record<string,number>}>) {
 const titre=postes.length===1 ? postes[0].label : "Les principaux postes de dépense";
 return timeChart({title:titre,description:"Part de 100 € de dépenses publiques consacrée à chaque poste, à périmètre comparable.",unit:"Part des dépenses publiques",series:postes.map(({label,values})=>({name:label,values})),format:v=>`${v.toLocaleString("fr-FR",{maximumFractionDigits:1})} €`});
}
function evolutionAllocation(series:Territoire["series"]):string {
 const history=historiqueRepartition(series);if(history.length<2)return "";
 const latest=history.at(-1)!;
 const data=Object.fromEntries(latest.missions.map(m=>[m.label,Object.fromEntries(history.flatMap(h=>{const entry=h.missions.find(v=>v.label===m.label);return entry?[[h.year,entry.share*100]]:[];}))]));
 const principaux=latest.missions.slice().sort((a,b)=>b.share-a.share).slice(0,4);
 const selection=principaux[0]?.label ?? latest.missions[0].label;
 const seriesPrincipales=principaux.map(m=>({label:m.label,values:data[m.label]}));
 return `<section class="salary-history" id="salary-history" data-salary-history="${echapper(JSON.stringify(data))}"><h2>Comment la répartition a changé</h2><p>Depuis ${history[0].year}, quelle part de 100 € de dépenses publiques va à chaque poste ? Les parts observées décrivent la dépense collective de chaque année.</p><div class="salary-history__controls"><label for="salary-history-choice">Poste de dépense</label><select id="salary-history-choice">${latest.missions.map(m=>`<option>${echapper(m.label)}</option>`).join("")}</select><button type="button" class="salary-history__share" data-salary-history-share>Partager le graphique</button><span class="salary-history__share-status" role="status" aria-live="polite"></span></div><div data-salary-history-chart>${graphiqueRepartition(seriesPrincipales.length ? seriesPrincipales : [{label:selection,values:data[selection]}])}</div><p class="salaires__sources">${latest.basis}.</p></section>`;
}

function allocation(series:Territoire['series']):string {
 const data=repartitionCollective(series);
 if(!data)return `<section class="salaires__allocation"><h2>Sur 100 € de dépenses publiques</h2><p>Les comptes publiés montrent les sommes consacrées aux retraites, à la santé, à l’éducation et aux autres missions.</p><a href="/bilan/#bloc-fonctions">Consulter les dépenses publiques</a></section>`;
 return `<section class="salaires__allocation" aria-labelledby="allocation-titre"><header><p class="salaires__eyebrow">La dépense collective</p><h2 id="allocation-titre">Sur 100 € de dépenses publiques</h2><p>La répartition de ${data.year} décrit l’ensemble des administrations publiques. Cette base de 100 € est indépendante du profil salarial présenté plus haut.</p></header><ol class="salary-missions">${data.missions.map(m=>`<li><div><h3>${m.label}</h3><p>${m.description}</p></div><strong data-allocation-share="${m.share}">${formaterProfil(100*m.share)}</strong><span class="salary-mission-bar" style="--share:${m.share*100}%" aria-hidden="true"></span></li>`).join('')}</ol><p class="salaires__sources">${data.basis}, ${data.year}. Les impôts, les cotisations et l’emprunt participent au financement public ; cette répartition décrit les dépenses, sans affecter les prélèvements d’une personne à chaque poste. Les valeurs affichées sont arrondies au centime. <a href="/bilan/#bloc-fonctions">Consulter les comptes</a> · <a href="/sources/">Sources et méthode</a></p></section>`;
}

export function renduSalaires(series:Territoire['series']={}):string {
 return `<section class="salaires" id="salaires-contenu">
  <header class="salaires__entree"><p class="salaires__eyebrow">Salaires et revenus</p><h1>Du coût du travail au revenu reçu.</h1><p class="salaires__intro">Un repère sourcé pour comprendre le passage entre coût employeur, salaire brut et revenu après prélèvements.</p></header>
  <div class="salaires__atelier">
   <section class="salaires__profil" aria-labelledby="profil-titre"><h2 id="profil-titre">Un profil statistique précis</h2><p><strong>Célibataire sans enfant au salaire moyen français, en 2025.</strong> L’OCDE publie les prélèvements de ce profil. Nous ramenons le coût employeur à 100 € pour en montrer les composantes.</p><p>Le salaire brut représente 73,30 € et le net avant impôt 65,00 € sur cette base. Le revenu après prélèvements représente 52,80 €.</p><p>Les règles et la situation du ménage modifient le résultat d’une personne. Ce profil statistique ne permet pas de reconstituer votre paie à partir du seul net reçu.</p><p><a class="salaires__outil" href="https://mon-entreprise.urssaf.fr/simulateurs/salaire-brut-net" rel="noreferrer">Calculer avec l’Urssaf</a></p><p>Le simulateur officiel permet de renseigner les caractéristiques d’une situation salariée. Les hypothèses du calcul sont à vérifier dans cet outil.</p></section>
   <section class="salaires__resultat" aria-labelledby="profil-resultat"><div class="salaires__total"><p>Pour 100 € de coût employeur</p><h2 id="profil-resultat">52,80 €</h2><p>de revenu après prélèvements · profil OCDE 2025</p></div><div class="salaires__barre" aria-hidden="true">${PROFIL_TRAVAIL.map(([_,part],i)=>`<span class="salaires__segment salaires__segment--${i}" style="width:${part}%"></span>`).join('')}</div><dl class="salaires__ventilation">${PROFIL_TRAVAIL.map(([label,part],i)=>`<div><dt><i class="salaires__cle salaires__segment--${i}" aria-hidden="true"></i>${label}</dt><dd>${formaterProfil(part)}</dd></div>`).join('')}</dl><p class="salaires__sources"><a href="https://www.oecd.org/en/publications/taxing-wages-2026_3a5169ef-en/full-report/overview_d93131c3.html" rel="noreferrer">OCDE, Taxing Wages 2026, tableau 1.2</a> · année 2025, consulté le 3 octobre 2026. Les parts sont rapportées au coût employeur et totalisent 100 %.</p></section>
  </div>
  <section class="salaires__lecture"><h2>Lire les différents montants</h2><p>Le coût employeur comprend le brut et les cotisations patronales. Les cotisations salariales sont ensuite déduites du brut pour obtenir le net avant impôt. Le prélèvement d’impôt intervient pour passer au montant versé.</p><p><a href="/analyses/cout-travail-cent-euros-net-2025/">Lire le dossier et la comparaison européenne</a> · <a href="https://www.service-public.gouv.fr/particuliers/vosdroits/F559?lang=fr" rel="noreferrer">Lire les lignes d’un bulletin de paie</a></p></section>
  ${allocation(series)}
  ${evolutionAllocation(series)}
  <section class="salaires__detail"><h2>Deux bases de lecture</h2><p>La première décompose un coût employeur de 100 € pour le seul profil OCDE indiqué. La seconde répartit 100 € de dépenses publiques entre les postes observés dans les comptes. Elles décrivent des périmètres différents : aucune affectation personnelle de cotisations n’est calculée.</p></section>
 </section>`;
}

export function brancherSalaires(root: HTMLElement): void {
  const history=root.querySelector<HTMLElement>('[data-salary-history]');
  const choixPoste=history?.querySelector<HTMLSelectElement>('select');
  const afficherPoste=(label:string)=>{
    if(!history)return;
    const data=JSON.parse(history.dataset.salaryHistory!);
    history.querySelector('[data-salary-history-chart]')!.innerHTML=graphiqueRepartition([{label,values:data[label]}]);
  };
  if (choixPoste && typeof window !== "undefined") {
    const partage=new URLSearchParams(window.location.search).get("poste");
    if (partage && Array.from(choixPoste.options).some(option=>option.value===partage)) {
      choixPoste.value=partage;
      afficherPoste(partage);
    }
  }
  choixPoste?.addEventListener('change',event=>{
    const label=(event.target as HTMLSelectElement).value;
    afficherPoste(label);
  });
  history?.querySelector<HTMLButtonElement>('[data-salary-history-share]')?.addEventListener('click',async()=>{
    const url=new URL('/salaires/',window.location.origin);url.hash='salary-history';
    const label=choixPoste?.value;
    if(label)url.searchParams.set('poste',label);
    const status=history.querySelector<HTMLElement>('.salary-history__share-status');
    try {
      if (typeof navigator.share === 'function') { await navigator.share({title:'Comment la répartition a changé',url:url.href}); }
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url.href); }
      else throw new Error('clipboard unavailable');
      if(status)status.textContent='Lien copié.';
    } catch { if(status)status.textContent=`Lien : ${url.href}`; }
  });
}
