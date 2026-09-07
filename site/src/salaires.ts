import { timeChart } from "./chart-studio.ts";
import type { Territoire } from "./donnees.ts";
import { echapper } from "./texte.ts";

export const STATUTS = ["salarié", "fonctionnaire", "indépendant", "retraité"] as const;
export type Statut = (typeof STATUTS)[number];

type Taux = {
  /** Part estimée du montant reçu correspondant aux cotisations salariales. */
  cotisationsSalariales: number;
  /** Part estimée du montant reçu correspondant à l'impôt sur le revenu. */
  impot: number;
  /** Part estimée du montant reçu correspondant aux cotisations employeur. */
  cotisationsEmployeur: number;
};

/**
 * Ordres de grandeur éditoriaux, séparés par statut.
 *
 * Le montant saisi est le revenu qui arrive sur le compte. Ces coefficients ne
 * remplacent pas une fiche de paie individuelle : la page affiche donc
 * explicitement « estimation » et renvoie vers les sources officielles. Leur
 * intérêt est de rendre visible l'écart net/coût total, comme le parcours
 * public de référence, sans prétendre calculer une situation personnelle.
 */
const TAUX: Record<Statut, Taux> = {
  salarié: { cotisationsSalariales: 0.281, impot: 0.071, cotisationsEmployeur: 0.5428 },
  fonctionnaire: { cotisationsSalariales: 0.205, impot: 0.071, cotisationsEmployeur: 0.365 },
  indépendant: { cotisationsSalariales: 0.235, impot: 0.071, cotisationsEmployeur: 0.434 },
  retraité: { cotisationsSalariales: 0.061, impot: 0.071, cotisationsEmployeur: 0.0 },
};

export type CalculSalaire = {
  net: number;
  cotisationsSalariales: number;
  impot: number;
  cotisationsEmployeur: number;
  coutTotal: number;
};

const entier = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formaterSalaire(valeur: number): string {
  return `${entier.format(Math.max(0, Math.round(valeur)))} €`;
}

export function calculerSalaire(net: number, statut: Statut): CalculSalaire {
  const montant = Number.isFinite(net) ? Math.max(0, net) : 0;
  const taux = TAUX[statut];
  const cotisationsSalariales = montant * taux.cotisationsSalariales;
  const impot = montant * taux.impot;
  const cotisationsEmployeur = montant * taux.cotisationsEmployeur;
  return {
    net: montant,
    cotisationsSalariales,
    impot,
    cotisationsEmployeur,
    coutTotal: montant + cotisationsSalariales + impot + cotisationsEmployeur,
  };
}

function statutValide(value: string | null): Statut {
  return (STATUTS as readonly string[]).includes(value ?? "") ? (value as Statut) : "salarié";
}

function montantDepuisChamp(value: string): number | null {
  const normalise = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalise)) return null;
  const montant = Number(normalise);
  return Number.isFinite(montant) && montant <= 1_000_000 ? montant : null;
}

function libelleStatut(statut: Statut): string {
  return statut.charAt(0).toUpperCase() + statut.slice(1);
}

const LIGNES = [
  ["net", "Revenu reçu"],
  ["cotisationsSalariales", "Cotisations liées au revenu"],
  ["impot", "Impôt sur le revenu"],
  ["cotisationsEmployeur", "Cotisations employeur"],
] as const;

function libelleLigne(cle: string, statut: Statut, defaut: string): string {
  if (cle === "cotisationsEmployeur" && statut === "indépendant") return "Autres cotisations du modèle";
  return defaut;
}

function coefficients(statut: Statut): string {
  const taux = TAUX[statut];
  return `Cotisations liées au revenu : × ${taux.cotisationsSalariales.toLocaleString("fr-FR")}. Impôt : × ${taux.impot.toLocaleString("fr-FR")}. ${statut === "indépendant" ? "Autres cotisations" : "Cotisations employeur"} : × ${taux.cotisationsEmployeur.toLocaleString("fr-FR")}.`;
}

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
function graphiqueRepartition(label:string,values:Record<string,number>) {
 return timeChart({title:label,description:"Part de ce poste dans les dépenses publiques, à périmètre comparable.",unit:"% des dépenses publiques",series:[{name:label,values}],format:v=>`${v.toLocaleString("fr-FR",{maximumFractionDigits:1})} %`});
}
function evolutionAllocation(series:Territoire["series"]):string {
 const history=historiqueRepartition(series);if(history.length<2)return "";
 const latest=history.at(-1)!;
 const data=Object.fromEntries(latest.missions.map(m=>[m.label,Object.fromEntries(history.flatMap(h=>{const entry=h.missions.find(v=>v.label===m.label);return entry?[[h.year,entry.share*100]]:[];}))]));
 const first=latest.missions[0].label;
 return `<section class="salary-history" data-salary-history="${echapper(JSON.stringify(data))}"><h2>Comment la répartition a changé</h2><p>Depuis ${history[0].year}, quelle part de 100 € de dépenses publiques va à chaque poste ? Les parts observées sont indépendantes du salaire saisi.</p><label for="salary-history-choice">Poste de dépense</label><select id="salary-history-choice">${latest.missions.map(m=>`<option>${echapper(m.label)}</option>`).join("")}</select><div data-salary-history-chart>${graphiqueRepartition(first,data[first])}</div><p class="salaires__sources">${latest.basis}. Même périmètre d’une année à l’autre. Les années manquantes ne sont pas interpolées.</p></section>`;
}

function allocation(calcul:CalculSalaire,series:Territoire["series"]):string {
 const data=repartitionCollective(series);
 if(!data)return `<section class="salaires__allocation"><h2>Ce que financent les prélèvements</h2><p>Retraites, santé, chômage, éducation et services publics.</p><a href="/bilan/#bloc-fonctions">Consulter la répartition publiée des dépenses publiques</a></section>`;
 const total=calcul.coutTotal-calcul.net;
 return `<section class="salaires__allocation"><header><p class="salaires__eyebrow">Ce que finance l'effort collectif</p><h2>Où vont vos prélèvements ?</h2><p>Vos <strong data-allocation-total>${formaterSalaire(total)}</strong> de prélèvements estimés, répartis selon la structure des dépenses publiques de ${data.year}.</p></header><ol class="salary-missions">${data.missions.map(m=>`<li><div><h3>${m.label}</h3><p>${m.description}</p></div><strong data-allocation-share="${m.share}">${formaterSalaire(total*m.share)}</strong><span class="salary-mission-bar" style="--share:${m.share*100}%" aria-hidden="true"></span></li>`).join("")}</ol><p class="salaires__sources">Répartition indicative : elle applique une moyenne nationale à votre estimation, sans retracer l'affectation de vos cotisations. ${data.basis}, ${data.year}. <a href="/bilan/#bloc-fonctions">Données et évolution</a> · <a href="/sources/">Sources et méthode</a></p></section>`;
}

export function renduSalaires(net = 2100, statut: Statut = "salarié", series: Territoire["series"] = {}): string {
  const calcul = calculerSalaire(net, statut);
  return `<section class="salaires" id="salaires-contenu">
    <header class="salaires__entree"><p class="salaires__eyebrow">Salaires & revenus</p>
    <h1>Votre revenu,<br> décomposé.</h1>
    <p class="salaires__intro">Explorez le poids des prélèvements avec un modèle pédagogique simplifié.</p></header>
    <div class="salaires__atelier">
    <form class="salaires__form" id="salaires-form">
      <div class="salaires__statuts" role="group" aria-label="Votre statut">${STATUTS.map(option => `<button type="button" class="salaires__statut" data-statut="${option}" aria-pressed="${option === statut}">${libelleStatut(option)}</button>`).join("")}</div>
      <label for="salaires-net" class="salaires__label">Votre net mensuel après impôt</label>
      <div class="salaires__montant"><input id="salaires-net" name="net" inputmode="decimal" autocomplete="off" maxlength="14" value="${echapper(formaterSalaire(net).replace(" €", ""))}" aria-describedby="salaires-aide salaires-erreur"><span aria-hidden="true">€</span><small>/ mois</small></div>
      <p class="salaires__aide" id="salaires-aide">Le montant qui arrive sur votre compte.</p>
      <p id="salaires-erreur" class="salaires__erreur" role="status" hidden></p>
      <p class="salaires__reserve">Estimation selon votre statut.</p>
    </form>
    <section class="salaires__resultat" aria-labelledby="salaires-resultat-label" data-salaires-statut="${statut}">
      <div class="salaires__total"><p id="salaires-resultat-label">Coût total estimé</p><h2 id="salaires-resultat-titre">${formaterSalaire(calcul.coutTotal)}</h2><p>par mois · ${libelleStatut(statut).toLowerCase()}</p></div>
      <div class="salaires__barre" aria-hidden="true">${LIGNES.map(([cle],i)=>`<span class="salaires__segment salaires__segment--${i}" data-segment="${cle}" style="width:${calcul.coutTotal ? calcul[cle]/calcul.coutTotal*100 : 0}%"></span>`).join("")}</div>
      <dl class="salaires__ventilation">${LIGNES.map(([cle,label],i)=>`<div><dt><i class="salaires__cle salaires__segment--${i}" aria-hidden="true"></i><span data-label="${cle}">${libelleLigne(cle,statut,label)}</span></dt><dd data-salaires="${cle}">${formaterSalaire(calcul[cle])}</dd></div>`).join("")}</dl>
      <p class="visuellement-cache" id="salaires-annonce" role="status"></p>
    </section></div>
    <details class="salaires__detail"><summary>Voir le calcul</summary><p>Chaque composante est calculée à partir du revenu saisi, puis additionnée. Les montants sont arrondis à l'euro à l'écran.</p><p data-coefficients>${coefficients(statut)}</p><p>Ces coefficients sont des hypothèses non calibrées sur un barème annuel. Ils ne constituent ni un calcul officiel ni une estimation personnalisée. Le modèle ne reconstitue pas un salaire brut.</p><p class="salaires__sources"><a href="https://www.urssaf.fr/accueil/outils-documentation/simulateurs.html" rel="noreferrer">Calculer une situation avec l'Urssaf</a> · <a href="https://www.insee.fr/fr/statistiques/8376872?sommaire=8376908" rel="noreferrer">Consulter les salaires observés par l'Insee</a></p></details>
    ${allocation(calcul,series)}
    ${evolutionAllocation(series)}
  </section>`;
}

export function brancherSalaires(root: HTMLElement): void {
  const formulaire = root.querySelector<HTMLFormElement>("#salaires-form");
  const resultat = root.querySelector<HTMLElement>("[data-salaires-statut]");
  const champ = root.querySelector<HTMLInputElement>("#salaires-net");
  const erreur = root.querySelector<HTMLElement>("#salaires-erreur");
  if (!formulaire || !resultat || !champ || !erreur) return;
  const history=root.querySelector<HTMLElement>('[data-salary-history]');
  history?.querySelector('select')?.addEventListener('change',event=>{
    const label=(event.target as HTMLSelectElement).value;
    const data=JSON.parse(history.dataset.salaryHistory!);
    history.querySelector('[data-salary-history-chart]')!.innerHTML=graphiqueRepartition(label,data[label]);
  });
  let selection = statutValide(resultat.dataset.salairesStatut ?? null);
  let annonce: ReturnType<typeof setTimeout>;
  const afficher = () => {
    for (const bouton of root.querySelectorAll<HTMLButtonElement>(".salaires__statut")) bouton.setAttribute("aria-pressed", String(bouton.dataset.statut === selection));
    const montant = montantDepuisChamp(champ.value);
    champ.setAttribute("aria-invalid", String(montant === null));
    erreur.hidden = montant !== null;
    erreur.textContent = montant === null ? "Saisissez un montant de 0 à 1 000 000 €, avec deux décimales au maximum. Le résultat précédent est conservé." : "";
    if (montant === null) return;
    const calcul = calculerSalaire(montant, selection);
    const collective = calcul.coutTotal-calcul.net;
    const totalCollective=root.querySelector<HTMLElement>("[data-allocation-total]");
    if(totalCollective)totalCollective.textContent=formaterSalaire(collective);
    for(const element of root.querySelectorAll<HTMLElement>("[data-allocation-share]"))element.textContent=formaterSalaire(collective*Number(element.dataset.allocationShare));
    resultat.dataset.salairesStatut = selection;
    resultat.querySelector("h2")!.textContent = formaterSalaire(calcul.coutTotal);
    resultat.querySelector(".salaires__total p:last-child")!.textContent = `par mois · ${selection}`;
    for (const [cle,label] of LIGNES) {
      resultat.querySelector<HTMLElement>(`[data-salaires="${cle}"]`)!.textContent = formaterSalaire(calcul[cle]);
      resultat.querySelector<HTMLElement>(`[data-segment="${cle}"]`)!.style.width = `${calcul.coutTotal ? calcul[cle]/calcul.coutTotal*100 : 0}%`;
      resultat.querySelector<HTMLElement>(`[data-label="${cle}"]`)!.textContent = libelleLigne(cle,selection,label);
    }
    root.querySelector<HTMLElement>("[data-coefficients]")!.textContent = coefficients(selection);
    clearTimeout(annonce);
    annonce = setTimeout(() => { root.querySelector<HTMLElement>("#salaires-annonce")!.textContent = `Coût total estimé : ${formaterSalaire(calcul.coutTotal)} par mois.`; }, 400);
  };
  formulaire.addEventListener("submit", event => event.preventDefault());
  formulaire.addEventListener("input", afficher);
  formulaire.addEventListener("click", event => {
    const bouton = (event.target as HTMLElement).closest<HTMLButtonElement>(".salaires__statut");
    if (bouton) { selection = statutValide(bouton.dataset.statut ?? null); afficher(); }
  });
}
