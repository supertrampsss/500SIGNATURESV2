/**
 * Page Salaires, au format du récit : une scène collée, des cartes qui défilent par-dessus
 * (runtime : recit/runtime.ts). Le salaire du profil OCDE, puis où va la dépense publique,
 * les retraites dans les budgets des ministères et l'évolution de la répartition.
 */
import { reclassementBercy, SOURCE_RECLASSEMENT_BERCY } from "./reclassement-bercy.ts";
import type { Territoire } from "./donnees.ts";
import { echapper } from "./texte.ts";
import { SOURCES } from "./recit/calculs.ts";
import { etapesPaie, fmt, rail, renduEtape, sources, vuePaie, type Etape } from "./recit/rendu.ts";
import type { LigneBarre } from "./recit/ville.ts";

/** OCDE, Taxing Wages 2026, France 2025 : célibataire sans enfant au salaire moyen, en % du coût employeur. */
export const PROFIL_TRAVAIL = [
  ['Revenu après prélèvements', 52.8],
  ['Cotisations salariales', 8.3],
  ['Impôt sur le revenu', 12.2],
  ['Cotisations patronales', 26.7],
] as const;

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
 [["vieillesse","survivants"],"Retraites"],[["maladie_invalidite"],"Arrêts maladie et invalidité"],[["chomage"],"Chômage"],[["famille"],"Famille et enfants"],[["exclusion"],"RSA et autres minima sociaux"],[["logement"],"Aides au logement"],
] as const;
const TRANSACTIONS = [
 ["remunerations","Rémunération des agents publics"],["transferts_nature","Soins et services remboursés"],["consommations","Achats de biens et de services"],["investissement","Investissement public"],["transferts_courants","Transferts courants"],["interets","Intérêts de la dette"],["subventions","Subventions aux entreprises"],["transferts_capital","Transferts en capital"],
] as const;
function repartitionDetaillee(series:Territoire["series"]) {
 const ids=[...PRESTATIONS.flatMap(([ids])=>ids.map(id=>"eurostat_apu_prestations_"+id)),...TRANSACTIONS.map(([id])=>"eurostat_apu_"+id),"eurostat_apu_prestations","eurostat_apu_depenses"];
 const year=Object.keys(series.eurostat_apu_depenses??{}).sort().reverse().find(y=>ids.every(id=>Number.isFinite(series[id]?.[y])&&series[id][y]>=0));
 if(!year)return null;
 const total=series.eurostat_apu_depenses[year],parent=series.eurostat_apu_prestations[year];
 const benefits=PRESTATIONS.map(([ids,label])=>({label,description:label === "Retraites" ? "Vieillesse, minima vieillesse et pensions de réversion" : "Prestations versées",amount:ids.reduce((sum,id)=>sum+series["eurostat_apu_prestations_"+id][year],0)}));
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

export const CHAPITRES_SALAIRES = [["paie", "Votre paie"], ["depense", "Où va l’argent"], ["ministeres", "Les ministères"], ["evolution", "Dans le temps"], ["mandats", "Mandats"]] as const;

const md = (n: number) => fmt(n / 1e9, n >= 1e10 ? 1 : 2);

/** Les postes de dépense, du plus lourd au plus léger ; au-delà de neuf, un seul « Tout le reste ». */
function lignesDepense(missions: { label: string; share: number }[]): LigneBarre[] {
  const tri = missions.slice().sort((a, b) => b.share - a.share);
  const tete = tri.slice(0, 9).map(m => ({ n: m.label, v: m.share * 100, t: `${fmt(m.share * 100, 2)} €`, c: "bleu" as const }));
  const reste = tri.slice(9).reduce((a, m) => a + m.share * 100, 0);
  return reste > 0 ? [...tete, { n: "Tout le reste", v: reste, t: `${fmt(reste, 2)} €`, c: "bleu" as const }] : tete;
}

/** Courbes des quatre premiers postes, en euros sur 100 € de dépense publique, sur la même échelle. */
function courbes(series: Territoire["series"]): { html: string; postes: { label: string; debut: [string, number]; fin: [string, number] }[] } | undefined {
  const histoire = historiqueRepartition(series);
  if (histoire.length < 2) return;
  const derniere = histoire.at(-1)!;
  const tete = derniere.missions.slice().sort((a, b) => b.share - a.share).slice(0, 4).map(m => m.label);
  const annees = histoire.map(h => Number(h.year));
  const lignes = tete.map(label => histoire.flatMap(h => { const m = h.missions.find(x => x.label === label); return m ? [[Number(h.year), m.share * 100] as [number, number]] : []; }));
  const max = Math.ceil(Math.max(...lignes.flat().map(p => p[1])) / 5) * 5;
  const [a0, a1] = [annees[0], annees.at(-1)!];
  const X = (a: number) => 40 + (a - a0) / Math.max(1, a1 - a0) * 380, Y = (v: number) => 20 + (1 - v / max) * 300;
  // Les noms se posent à droite des courbes, écartés d'au moins 18 unités pour ne jamais se chevaucher.
  const COURT: Record<string, string> = { "Rémunération des agents publics": "Agents publics", "Soins et services remboursés": "Soins remboursés", "Achats de biens et de services": "Achats", "Investissement public": "Investissement" };
  const places = lignes.map((pts, i) => ({ i, y: Y(pts.at(-1)![1]) })).sort((a, b) => a.y - b.y);
  places.forEach((p, j) => { if (j && p.y - places[j - 1].y < 18) p.y = places[j - 1].y + 18; });
  const yNom = Object.fromEntries(places.map(p => [p.i, p.y]));
  const grille = Array.from({ length: max / 5 + 1 }, (_, i) => i * 5).map(v => `<line x1="40" x2="420" y1="${Y(v)}" y2="${Y(v)}"/><text x="32" y="${Y(v) + 4}" text-anchor="end">${v} €</text>`).join("");
  const traces = lignes.map((pts, i) => `<g class="courbe" data-i="${i}"><path d="${pts.map(([a, v], j) => `${j ? "L" : "M"}${X(a).toFixed(1)},${Y(v).toFixed(1)}`).join("")}"/><circle cx="${X(pts.at(-1)![0])}" cy="${Y(pts.at(-1)![1])}" r="5"/><text x="${X(pts.at(-1)![0]) + 12}" y="${yNom[i] + 4}">${echapper(COURT[tete[i]] ?? tete[i])}</text></g>`).join("");
  const html = `<svg class="courbes" viewBox="0 0 640 350" role="presentation"><g class="grille">${grille}<text x="40" y="344">${a0}</text><text x="420" y="344" text-anchor="end">${a1}</text></g>${traces}</svg>`;
  return { html, postes: lignes.map((pts, i) => ({ label: tete[i], debut: [String(pts[0][0]), pts[0][1]], fin: [String(pts.at(-1)![0]), pts.at(-1)![1]] })) };
}

export function renduSalaires(series: Territoire["series"] = {}): string {
  const e: Etape[] = etapesPaie("paie");
  e.push({ chapitre: "paie", tableau: "paie", k: 4, titre: "Et <em>votre</em> fiche de paie&nbsp;?", desc: "Ces montants valent pour un salarié type. Le simulateur officiel de l’Urssaf calcule votre cas : temps partiel, cadre, heures supplémentaires…", contenu: `<a class="etape__lien" href="https://mon-entreprise.urssaf.fr/simulateurs/salaire-brut-net" rel="noreferrer noopener" target="_blank">Simuler mon salaire</a>` });

  const dep = repartitionCollective(series);
  if (dep) {
    const lignes = lignesDepense(dep.missions);
    const spec = (cle?: number) => ({ "data-barres": JSON.stringify({ lignes, legende: `Sur 100 € de dépense publique · ${dep.year}` }), ...(cle === undefined ? {} : { "data-cle": String(cle) }) });
    const t = "Sur 100 € de dépense publique, <em>où va l’argent&nbsp;?</em>";
    lignes.slice(0, 4).forEach((l, i) => e.push({ chapitre: "depense", tableau: "barres", k: i, titre: i ? t : "Ces cotisations et ces impôts, <em>où vont-ils&nbsp;?</em>", lib: `${l.n} · ${dep.year}`, valeur: l.v, decimales: 2, unite: "€", sous: "sur 100 € de dépense publique", ton: i ? undefined : "argile", desc: i ? undefined : "Ils rejoignent toutes les autres recettes publiques. Voici comment l’ensemble est dépensé.", attributs: spec(i) }));
    e.push({ chapitre: "depense", tableau: "barres", k: 9, titre: "Du plus lourd <em>au plus léger</em>.", desc: "Les prestations sont versées aux ménages ; les autres postes paient les services publics et leur financement.", attributs: spec() });
  }

  const { ministeres } = reclassementBercy();
  // Les ministères où les retraites pèsent au moins 5 % du budget : là où la mécanique se voit.
  const avec = ministeres.filter(m => m.retraites !== null && m.retraites / m.budget >= .05).sort((a, b) => b.budget - a.budget).slice(0, 8);
  const lignesMin: LigneBarre[] = avec.map(m => ({ n: m.nom.replace("Défense · Armées et anciens combattants", "Défense"), v: m.budget, p: m.retraites!, t: `${md(m.budget)} Md€`, s: `dont ${md(m.retraites!)} Md€ pour les retraites`, c: "bleu" }));
  const educ = ministeres.find(m => m.nom === "Éducation nationale");
  const specMin = (cle?: number) => ({ "data-barres": JSON.stringify({ lignes: lignesMin, legende: "Budget 2027, en milliards d’euros", repere: "Part qui paie des retraites", partie: true }), ...(cle === undefined ? {} : { "data-cle": String(cle) }) });
  if (educ?.retraites) e.push({ chapitre: "ministeres", tableau: "barres", k: 0, titre: "Dans chaque ministère, <em>une part paie des retraites</em>.", lib: "Éducation nationale · budget 2027", valeur: educ.retraites / 1e9, decimales: 1, unite: "Md€", sous: `sur ${md(educ.budget)} Md€, soit ${fmt(educ.retraites / educ.budget * 100)} €  sur 100 €`, ton: "argile", desc: "Les retraites des anciens agents sont payées par le budget de leur ministère.", attributs: specMin(lignesMin.findIndex(l => l.n === "Éducation nationale")) });
  e.push({ chapitre: "ministeres", tableau: "barres", k: 1, titre: "Intérieur, Défense, Justice : <em>même mécanique</em>.", desc: "La part hachurée est estimée à partir des documents budgétaires. Elle fait déjà partie des retraites de la dépense publique.", attributs: specMin() });

  const c = courbes(series);
  if (c) c.postes.slice(0, 3).forEach((p, i) => {
    const ecart = p.fin[1] - p.debut[1];
    e.push({ chapitre: "evolution", tableau: "courbes", k: i, titre: i ? `${echapper(p.label)} : <em>${ecart >= 0 ? "en hausse" : "en baisse"}</em>.` : `Depuis ${p.debut[0]}, <em>la répartition bouge</em>.`, lib: `${p.label} · ${p.fin[0]}`, valeur: p.fin[1], decimales: 2, unite: "€", sous: `${fmt(p.debut[1], 2)} € en ${p.debut[0]}, ${ecart >= 0 ? "+" : "−"}${fmt(Math.abs(ecart), 2)} €`, ton: ecart > 0 ? "argile" : "or" });
  });

  e.push({ chapitre: "mandats", tableau: "final", titre: "À vous de <em>trancher</em>.", desc: "Retraites, impôts, services publics : dans Mandats, chaque choix a un prix.", contenu: `<a class="final__cta" href="/mandats/">Commencer mon mandat</a><p class="final__note"><a href="/">Relire le récit</a></p>` });

  const html = e.map((x, i) => {
    const debut = e.findIndex(y => y.chapitre === x.chapitre) === i;
    return (debut ? `<span class="ancre" id="${x.chapitre}"></span>` : "") + renduEtape(x, i, i === 0, CHAPITRES_SALAIRES);
  }).join("");
  const scene = `<div class="recit__scene" aria-hidden="true">
    <div class="fond fond--hemi"><div class="plan"></div><div class="voile"></div></div>
    <div class="zone">${vuePaie()}<div class="viz viz--barres" data-viz="barres"></div>${c ? `<div class="viz viz--courbes" data-viz="courbes">${c.html}</div>` : ""}</div>
  </div>`;
  const liste = [SOURCES.ocde, SOURCES.eurostat, { nom: "Direction du Budget", titre: "Budgets des ministères et contributions aux pensions, PLF 2027", url: SOURCE_RECLASSEMENT_BERCY }, { nom: "Urssaf", titre: "Simulateur de salaire brut et net", url: "https://mon-entreprise.urssaf.fr/simulateurs/salaire-brut-net" }];
  return `<div class="recit recit--salaires" data-recit id="salaires-contenu">
    ${scene}
    <div class="recit__flux">${rail(CHAPITRES_SALAIRES)}${html}</div>
    ${sources(liste)}
  </div>`;
}
