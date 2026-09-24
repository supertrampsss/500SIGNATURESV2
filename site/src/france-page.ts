/** France, maquette complète approuvée le 21 septembre 2026.
 * Un seul rendu pour le HTML publié et la navigation dans l'application.
 * Les séries restent la source des nombres ; la maquette fixe leur présentation.
 */
import type { Indicateur, Territoire } from './donnees.ts';
import type { Analyse } from './analyse-rendu.ts';
import type { FamilleInsight } from './insights.ts';
import { chiffres } from './ouverture.ts';
import { lignes as recettesEtat } from './recettes-etat.ts';
import { PROJECTION_DETTE, SOURCE_PROJECTION } from './tenable.ts';
import { insightsFrance } from './insights-france.ts';
import { questionsFrance } from './france-debats.ts';
import { cartesAvecSuite } from './insights-rendu.ts';
import { echapper as esc } from './texte.ts';
import { lienSource, type IndexSources } from './registre-sources.ts';
const source = (index: IndexSources | undefined, id: string) => { const fiche=index?.parIndicateur.get(id); return fiche?lienSource(fiche):'/sources/'; };

type Serie = Record<string, number>;
type Courbe = { nom: string; valeurs: Serie; couleur: string; pointilles?: boolean };
const BLEU = '#247bbd', ROUGE = '#c72b40';
const couleurs = ['#c83d50','#d77771','#5ea2c6','#78b7cf','#8aa794','#ddbd75','#cc854c','#bfcbd1','#80adc9','#77bdc7','#adb9bc'];
const paysNoms: Record<string,string> = { FR: 'France', DE: 'Allemagne', ES: 'Espagne', IT: 'Italie' };
const nombre = (v: number, d = 0) => new Intl.NumberFormat('fr-FR', {maximumFractionDigits:d}).format(v).replace('-', '−');
const milliards = (v: number) => `${nombre(v / 1e9)} Md€`;
const dernier = (s: Serie = {}): [string, number] | undefined => Object.entries(s).filter(([,v])=>Number.isFinite(v)).sort(([a],[b])=>a.localeCompare(b)).at(-1);
const commun = (series: Serie[]): string | undefined => Object.keys(series[0] ?? {}).filter(y=>series.every(s=>Number.isFinite(s?.[y]))).sort().at(-1);
const extrait = (s: Serie = {}, depuis = '2000', diviseur = 1): Serie => Object.fromEntries(Object.entries(s).filter(([y,v])=>/^\d{4}$/.test(y) && y >= depuis && Number.isFinite(v)).map(([y,v])=>[y,v/diviseur]));

function icone(nom: string): string {
  const traits: Record<string,string> = {
    recettes: '<rect x="3" y="14" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
    depenses: '<rect x="3" y="14" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
    solde: '<path d="M12 3v18M7 21h10M4 7h16M6 7l-4 8h8L6 7Zm12 0-4 8h8l-4-8Z"/>',
    dette: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v4c0 4 16 4 16 0V5M4 9v4c0 4 16 4 16 0V9M4 13v4c0 4 16 4 16 0v-4"/>',
    france: '<path d="m3 8 9-5 9 5H3ZM5 11v7m5-7v7m4-7v7m5-7v7M3 21h18"/>',
    redistribution: '<circle cx="8" cy="7" r="3"/><circle cx="18" cy="8" r="2"/><path d="M2 21v-5a6 6 0 0 1 12 0v5m3-8a5 5 0 0 1 5 5v3"/>',
    europe: '<circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/><path d="M15 8c-6-3-9 10 0 8M6 11h8m-8 3h7"/>',
    arbitrages: '<path d="M4 4h16v16H4zM8 8h8m-8 4h8m-8 4h5"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9 8c0-4 8-3 6 1-1 2-3 2-3 5m0 3v1"/>',
  };
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${traits[nom] ?? traits.arbitrages}</svg>`;
}

/** Axes à zéro, années positionnées selon leur date et ruptures des données conservées. */
function courbes(titre: string, series: Courbe[], options: {max?:number; unite?:string; hauteur?:number} = {}): string {
  const annees = [...new Set(series.flatMap(s=>Object.keys(s.valeurs)))].sort();
  if(annees.length < 2) return '';
  const w=600, h=options.hauteur ?? 230, gauche=48, droite=18, haut=16, bas=32;
  const minAn=Number(annees[0]), maxAn=Number(annees.at(-1));
  const maximum=options.max ?? Math.ceil(Math.max(...series.flatMap(s=>Object.values(s.valeurs))) / 10)*10;
  const max=maximum || 1;
  const x=(an:string)=>gauche+(Number(an)-minAn)/(maxAn-minAn)*(w-gauche-droite);
  const y=(v:number)=>h-bas-v/max*(h-haut-bas);
  const grille=Array.from({length:5},(_,i)=>{const v=max*i/4;return `<line x1="${gauche}" y1="${y(v)}" x2="${w-droite}" y2="${y(v)}"/><text x="${gauche-10}" y="${y(v)+4}" text-anchor="end">${nombre(v,1)}${options.unite??''}</text>`;}).join('');
  const ticks=annees.filter((a,i)=>i===0 || i===annees.length-1 || Number(a)%5===0);
  const axes=ticks.map(an=>`<line x1="${x(an)}" y1="${haut}" x2="${x(an)}" y2="${h-bas}"/><text x="${x(an)}" y="${h-8}" text-anchor="middle">${an}</text>`).join('');
  const traces=series.map(s=>{
    const pts=Object.entries(s.valeurs).sort(([a],[b])=>a.localeCompare(b));
    let precedent:number|undefined;
    const d=pts.map(([a,v])=>{const lettre=precedent===undefined || Number(a)-precedent>1?'M':'L';precedent=Number(a);return `${lettre}${x(a).toFixed(2)},${y(v).toFixed(2)}`;}).join(' ');
    return `<path d="${d}" stroke="${s.couleur}" stroke-width="2.4" fill="none"${s.pointilles?' stroke-dasharray="5 4"':''}/>${pts.map(([a,v])=>`<circle cx="${x(a)}" cy="${y(v)}" r="2.6" fill="${s.couleur}"><title>${esc(s.nom)} · ${a} : ${nombre(v,2)}${options.unite??''}</title></circle>`).join('')}`;
  }).join('');
  return `<figure class="fr-chart"><figcaption class="fr-legend">${series.map(s=>`<span><i style="--series:${s.couleur}"${s.pointilles?' class="fr-dashed"':''}></i>${esc(s.nom)}</span>`).join('')}</figcaption><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(titre)}"><g class="fr-chart-grid">${grille}${axes}</g>${traces}</svg></figure>`;
}

function distribution(france: Territoire): {annee:string; total:number; lignes:{nom:string;part:number}[]} | undefined {
  const s=france.series;
  const postes=[['eurostat_apu_prestations_vieillesse','Retraites'],['eurostat_apu_remunerations','Rémunérations des agents publics'],['eurostat_apu_transferts_nature','Soins et services remboursés'],['eurostat_apu_consommations','Achats de biens et services'],['eurostat_apu_investissement','Investissement'],['eurostat_apu_interets','Intérêts de la dette'],['eurostat_apu_prestations_chomage','Chômage'],['eurostat_apu_prestations_famille','Famille et enfants'],['eurostat_apu_prestations_exclusion','RSA et minima sociaux']];
  const annee=commun(['eurostat_apu_recettes','eurostat_apu_depenses',...postes.map(([id])=>id)].map(id=>s[id]??{}));
  if(!annee || !(s.eurostat_apu_recettes[annee]>0)) return;
  const recettes=s.eurostat_apu_recettes[annee], total=s.eurostat_apu_depenses[annee]/recettes*100;
  const lignes=postes.map(([id,nom])=>({nom,part:s[id][annee]/recettes*100}));
  lignes.push({nom:'Autres dépenses',part:total-lignes.reduce((a,l)=>a+l.part,0)});
  return {annee,total,lignes};
}

function redistribution(france:Territoire, indexSources?:IndexSources): string {
  const s=france.series;
  const ids=Array.from({length:9},(_,i)=>[`insee_niveau_vie_d${i+1}_avant_redistribution`,`insee_niveau_vie_d${i+1}`]);
  const an=commun(ids.flat().map(id=>s[id]??{}));
  if(!an)return '';
  const valeurs=ids.map(([a,b])=>[s[a][an],s[b][an]]);
  const max=Math.ceil(Math.max(...valeurs.flat())/20000)*20000;
  const y=(v:number)=>206-v/max*178;
  const grille=Array.from({length:5},(_,i)=>{const v=max*i/4;return `<line x1="48" y1="${y(v)}" x2="590" y2="${y(v)}"/><text x="38" y="${y(v)+4}" text-anchor="end">${nombre(v)}</text>`;}).join('');
  const barres=valeurs.map(([a,b],i)=>{const x=62+i*59;return `<rect x="${x}" y="${y(a)}" width="18" height="${206-y(a)}" fill="#88bce1"><title>Seuil du ${i+1}e décile avant : ${nombre(a)} €</title></rect><rect x="${x+20}" y="${y(b)}" width="18" height="${206-y(b)}" fill="${ROUGE}"><title>Seuil du ${i+1}e décile après : ${nombre(b)} €</title></rect><text x="${x+19}" y="229" text-anchor="middle">${i+1}${i===0?'er':'e'}</text>`;}).join('');
  const paire=(titre:string,a:number,b:number,unit:string)=>`<div class="fr-change"><span>${titre}</span><div><strong>${nombre(a,unit?0:2)}${unit}</strong><span class="fr-change-to">à</span><strong>${nombre(b,unit?0:2)}${unit}</strong></div>${unit?'<small>par an</small>':''}</div>`;
  return `<section id="france-complements" class="fr-panel fr-split fr-redistribution"><div id="bloc-redistribution"><h2>Redistribution : des revenus plus égalitaires</h2><p class="fr-subtitle">Seuils de niveau de vie par décile, en euros · ${an}</p><figure class="fr-chart"><figcaption class="fr-legend"><span><b style="--series:#88bce1"></b>Avant impôts et prestations</span><span><b style="--series:${ROUGE}"></b>Après</span></figcaption><svg viewBox="0 0 610 245" role="img" aria-label="Seuils des neuf déciles avant et après redistribution en ${an}"><g class="fr-chart-grid">${grille}</g><g class="fr-bar-labels">${barres}</g></svg></figure></div><aside><h3>Des écarts de revenus qui se réduisent</h3>${paire('Seuil du 1er décile',...valeurs[0] as [number,number],' €')}${paire('Seuil du 9e décile',...valeurs[8] as [number,number],' €')}${paire('Rapport entre les deux seuils',valeurs[8][0]/valeurs[0][0],valeurs[8][1]/valeurs[0][1],'')}<a class="fr-source" href="${source(indexSources,'insee_niveau_vie_d1')}">Source : INSEE</a></aside></section>`;
}

function histogramme(pays:Record<string,Territoire>,id:string,annee:string,titre:string):string {
  const lignes=Object.keys(paysNoms).filter(c=>Number.isFinite(pays[c]?.series[id]?.[annee])).map(c=>({code:c,valeur:pays[c].series[id][annee]})).sort((a,b)=>b.valeur-a.valeur);
  const max=Math.max(...lignes.map(l=>l.valeur))*1.18;
  return `<figure class="fr-histogram" data-fr-europe-chart="${id}" data-fr-active="${id==='eurostat_depenses_publiques_pib'}"><figcaption>${titre}</figcaption><svg viewBox="0 0 300 195" role="img" aria-label="${esc(titre)}, en pourcentage du PIB, ${annee}">${lignes.map(({code,valeur},i)=>`<rect x="${18+i*74}" y="${155-valeur/max*140}" width="43" height="${valeur/max*140}" fill="${code==='FR'?ROUGE:'#83b5de'}"/><text x="${39.5+i*74}" y="${146-valeur/max*140}" text-anchor="middle">${nombre(valeur,1)}</text><text class="fr-country" x="${39.5+i*74}" y="176" text-anchor="middle">${paysNoms[code]}</text>`).join('')}<line x1="4" y1="155" x2="298" y2="155" stroke="#a9b8c5"/></svg></figure>`;
}

const THEMES: {id:FamilleInsight; titre:string; image:string; alt:string; repere:string; texte:string}[] = [
  {id:'budget',titre:'Dette et budget',image:'budget',alt:'Pièces de monnaie',repere:'projection-charge-dette',texte:'Quel coût la dette fera-t-elle peser sur les prochains budgets ?'},
  {id:'fiscalite',titre:'Fiscalité',image:'fiscalite',alt:'Calculatrice et documents',repere:'tres-hauts-revenus',texte:'Qui paie l’impôt, et dans quelles proportions ?'},
  {id:'travail',titre:'Travail et entreprises',image:'travail',alt:'Travail en entreprise',repere:'taux-emploi',texte:'Emploi, compétitivité et recettes publiques.'},
  {id:'generation',titre:'Retraites et générations',image:'retraites',alt:'Mains d’une personne âgée',repere:'pauvrete-actifs-retraites',texte:'Qui bénéficie de la protection sociale selon son âge ?'},
  {id:'services',titre:'Niveau de vie et services publics',image:'services',alt:'Habitants dans un espace public',repere:'redistribution-ocde',texte:'Que change vraiment la redistribution ?'},
  {id:'logement',titre:'Logement',image:'logement',alt:'Immeubles d’habitation',repere:'protection-logement',texte:'Le logement, un enjeu social et budgétaire.'},
  {id:'securite',titre:'Sécurité et justice',image:'justice',alt:'Palais de justice',repere:'densite-carcerale',texte:'Sécurité, justice et cohésion sociale.'},
];

function arbitrages(analyses: ReturnType<typeof insightsFrance>,pays:Record<string,Territoire>,catalogue:Indicateur[]):string {
  const themes=[...THEMES];
  if(analyses.some(i=>i.famille==='environnement'))themes.push({id:'environnement',titre:'Énergie et environnement',image:'energie',alt:'Éoliennes',repere:'',texte:'Énergie et environnement.'});
  return `<section id="insights-france" class="fr-panel fr-arbitrages"><header class="fr-section-heading"><div><h2>Les arbitrages derrière les comptes</h2><p class="fr-subtitle">${themes.length===7?'Sept':themes.length} familles pour comprendre les choix publics</p></div><a href="/analyses/">Lire les dossiers</a></header><div class="fr-topics">${themes.map(t=>{
    const liste=analyses.filter(a=>a.famille===t.id);if(!liste.length)return '';
    const repere=liste.find(a=>a.id===t.repere)??liste[0];
    return `<details class="fr-topic" id="arbitrages-${t.id}"><summary><span class="fr-topic-title">${icone('arbitrages')}${t.titre}</span><img src="/france/${t.image}.jpg" alt="${t.alt}" loading="lazy" width="480" height="160"><strong>${esc(repere.titre)}</strong><span class="fr-topic-description">${t.texte}</span><span class="fr-topic-count">${liste.length} analyse${liste.length>1?'s':''}</span></summary><div class="fr-topic-content"><h3>${t.titre}</h3>${cartesAvecSuite(liste,4,catalogue,pays.FR.series)}</div></details>`;
  }).join('')}</div></section>`;
}

export function renduFrancePage(pays:Record<string,Territoire>,catalogue:Indicateur[],analyses:readonly Analyse[]=[], indexSources?:IndexSources):string {
  const france=pays.FR;if(!france)return '';const c=chiffres(france);if(!c)return '';
  const s=france.series, dette=dernier(s.insee_dette_apu_montant), rec=recettesEtat(france), dist=distribution(france);
  const valeurs=[['recettes','Recettes',c.recettes,`en ${c.fin}`],['depenses','Dépenses',c.depenses,`en ${c.fin}`],['solde','Solde public',c.recettes-c.depenses,`en ${c.fin}`],['dette','Dette publique',dette?.[1],dette?.[0].replace(/(\d{4})-Q(\d)/,'T$2 $1')??'']] as const;
  const navigation=[['france-verdict','france','Point de départ'],['france-entrees','recettes','Recettes'],['france-sorties','depenses','Dépenses'],['france-complements','redistribution','Redistribution'],['france-dette','dette','Dette'],['bloc-europe','europe','Europe'],['france-debats','question','Débats'],['insights-france','arbitrages','Arbitrages']];
  const secuAn=commun(['eurostat_secu_recettes_pib','eurostat_secu_depenses_pib','eurostat_secu_solde_pib','eurostat_pib_montant'].map(id=>s[id]??{}));
  const detteAn=commun(Object.keys(paysNoms).map(code=>pays[code]?.series.eurostat_dette_pib??{}));
  const detteObservee=extrait(s.eurostat_dette_pib,'2010');
  const finDette=dernier(detteObservee);
  const proj=Object.fromEntries(Object.entries(PROJECTION_DETTE).filter(([y])=>!finDette || y>finDette[0]));
  const projection=finDette && Object.keys(proj).length?{[finDette[0]]:finDette[1],...proj}:{};
  const anEurope=commun(Object.keys(paysNoms).flatMap(code=>['eurostat_depenses_publiques_pib','eurostat_prelevements_obligatoires_pib'].map(id=>pays[code]?.series[id]??{})));
  const fonctions=[['protection_sociale','Protection sociale'],['sante','Santé'],['services_generaux','Services publics généraux'],['affaires_economiques','Affaires économiques'],['enseignement','Enseignement'],['defense','Défense'],['ordre_securite','Ordre et sécurité publics'],['culture','Loisirs et culture'],['logement','Logement'],['environnement','Environnement']];
  const anFonctions=commun(fonctions.map(([id])=>s[`eurostat_fonction_${id}`]??{}));
  const dossier=analyses.find(a=>a.slug==='groenland-accord-securite-europe');
  const insights=insightsFrance(france,catalogue,pays);
  const formatCourt=(nom:string)=>nom==='Taxe sur la valeur ajoutée'?'TVA':nom==='Taxe sur les produits énergétiques (TICPE)'?'TICPE':nom.startsWith('Recettes sans impôt')?'Recettes non fiscales':nom==='Autres recettes fiscales'?'Autres impôts':nom;
  return `<div class="fr-page" data-france-design="maquette-complete-20260921">
    <section class="fr-hero" id="france-verdict"><img class="fr-hero-photo" src="/france/assemblee.jpg" alt="Façade de l'Assemblée nationale à Paris, surmontée du drapeau français" width="1280" height="850" fetchpriority="high"><div class="fr-hero-copy"><p class="fr-eyebrow">Comptes publics français · ${c.fin}</p><h1>Les comptes<br>de la France.</h1><p class="fr-hero-statement">La France ${c.emprunte>=0?'dépense':'encaisse'} ${nombre(Math.abs(c.emprunte)/1e9)} milliards<br class="fr-desktop-break"> d’euros de plus qu’elle ${c.emprunte>=0?'n’encaisse':'ne dépense'}.</p><p class="fr-hero-scope">État, collectivités et Sécurité sociale réunis.</p><a class="fr-button" href="#france-debats">Voir les débats</a></div><p class="fr-hero-note">Une démocratie<br>éclairée par<br>les chiffres.</p><a class="fr-photo-credit" href="#france-credits">Assemblée nationale, Paris</a></section>
    <nav class="fr-chapters" aria-label="Chapitres des comptes publics">${navigation.filter(([id])=>id!=='france-sorties'||!!dist).filter(([id])=>id!=='france-complements'||!!redistribution(france)).filter(([id])=>id!=='bloc-europe'||!!anEurope||!!anFonctions).map(([id,ico,label])=>`<a href="#${id}">${icone(ico)}<span>${label}</span></a>`).join('')}</nav>
    <section class="fr-keyfigures"><h2>Les chiffres clés de ${c.fin}</h2><div class="fr-keygrid">${valeurs.map(([ico,label,v,annee])=>`<article><span class="fr-icon fr-icon--${ico}">${icone(ico)}</span><div><h3>${label}</h3><strong>${v===undefined?'Non publié':milliards(v)}</strong><small>${annee}</small></div></article>`).join('')}</div></section>
    <div class="fr-content">
      <section class="fr-panel fr-split fr-revenue" id="france-entrees"><div id="bloc-ouverture"><h2>D’où vient l’argent ?</h2><p class="fr-subtitle">Évolution des recettes et des dépenses publiques</p><p class="fr-unit">En milliards d’euros, de ${c.exercices[0]} à ${c.fin}</p>${courbes('Recettes et dépenses publiques, en milliards d’euros',[{nom:'Recettes',valeurs:extrait(s.eurostat_apu_recettes,'2000',1e9),couleur:BLEU},{nom:'Dépenses',valeurs:extrait(s.eurostat_apu_depenses,'2000',1e9),couleur:ROUGE}],{max:Math.ceil(c.depenses/1e9/500)*500})}<a class="fr-source" href="${source(indexSources,'eurostat_apu_recettes')}">Source : Eurostat</a></div>${rec?`<aside id="bloc-recettes-etat"><h3>Composition des recettes de l’État</h3><p class="fr-unit">En milliards d’euros</p><table class="fr-table"><thead><tr><th scope="col"><span class="fr-sr">Recette</span></th><th scope="col">${rec.debut}</th><th scope="col">${rec.fin}</th></tr></thead><tbody>${rec.lignes.map(l=>`<tr><th scope="row">${esc(formatCourt(l.libelle))}</th><td>${nombre(l.avant/1e9)}</td><td>${nombre(l.apres/1e9)}</td></tr>`).join('')}</tbody></table><a class="fr-source" href="${source(indexSources,'etat_tva')}">Source : Direction du budget</a></aside>`:''}</section>
      ${dist?`<section class="fr-panel fr-spending" id="france-sorties"><div><h2>Où part-il ?</h2><p class="fr-subtitle">Pour 100 € de recettes, la France dépense <strong>${nombre(dist.total,2)} €</strong></p><div class="fr-stacked" role="img" aria-label="Répartition des ${nombre(dist.total,2)} euros de dépenses pour 100 euros de recettes en ${dist.annee}">${dist.lignes.map((l,i)=>`<span style="flex:${l.part};background:${couleurs[i]}"><span class="fr-sr">${l.nom} : ${nombre(l.part,2)} €</span></span>`).join('')}</div><a class="fr-source" href="${source(indexSources,'eurostat_apu_depenses')}">${dist.annee} · Eurostat</a></div><ul class="fr-spending-legend" id="bloc-cent-euros-apu">${dist.lignes.map((l,i)=>`<li><i style="background:${couleurs[i]}"></i><span>${l.nom}</span><strong>−${nombre(l.part,2)} €</strong></li>`).join('')}</ul></section>`:''}
      ${redistribution(france,indexSources)}
      <div class="fr-duo">
        ${secuAn?`<section class="fr-panel" id="bloc-secu"><h2>La Sécurité sociale en ${secuAn}</h2><p class="fr-unit">En pourcentage du PIB</p><div class="fr-metrics"><div><strong>${nombre(s.eurostat_secu_depenses_pib[secuAn],1)} %</strong><span>de dépenses</span></div><div><strong>${nombre(s.eurostat_secu_recettes_pib[secuAn],1)} %</strong><span>de recettes</span></div><div><strong>≈ ${milliards(Math.abs(s.eurostat_secu_solde_pib[secuAn]/100*s.eurostat_pib_montant[secuAn]))}</strong><span>${s.eurostat_secu_solde_pib[secuAn]<0?'de déficit':'d’excédent'}</span></div></div><p class="fr-unit">En % du PIB, de 2013 à ${secuAn}</p>${courbes('Recettes et dépenses de la Sécurité sociale',[{nom:'Dépenses',valeurs:extrait(s.eurostat_secu_depenses_pib,'2013'),couleur:ROUGE},{nom:'Recettes',valeurs:extrait(s.eurostat_secu_recettes_pib,'2013'),couleur:BLEU}],{max:32,unite:' %'})}<a class="fr-source" href="${source(indexSources,'eurostat_secu_depenses_pib')}">Source : Eurostat</a></section>`:''}
        <section class="fr-panel" id="france-dette"><div id="bloc-dette"><h2>La dette publique</h2><p class="fr-unit">En pourcentage du PIB${detteAn?` · ${detteAn}`:''} </p>${detteAn?`<div class="fr-metrics fr-metrics--four">${Object.entries(paysNoms).map(([code,nom])=>`<div><span>${nom}</span><strong>${nombre(pays[code].series.eurostat_dette_pib[detteAn],1)} %</strong><small>en ${detteAn}</small></div>`).join('')}</div>`:''}${courbes('Dette publique française et projection à politique inchangée',[{nom:'France',valeurs:detteObservee,couleur:ROUGE},...(Object.keys(projection).length?[{nom:'Projection 2030',valeurs:projection,couleur:ROUGE,pointilles:true}]:[])],{max:160,unite:' %'})}${Object.keys(projection).length?`<p class="fr-projection"><strong>${nombre(PROJECTION_DETTE['2030'],1)} % en 2030</strong><a href="${SOURCE_PROJECTION}">Projection à politique inchangée · juillet 2026</a></p>`:''}<a class="fr-source" href="${source(indexSources,'eurostat_dette_pib')}">Sources : Eurostat, INSEE, Direction du budget</a></div></section>
      </div>
      ${anEurope||anFonctions?`<section class="fr-panel fr-split fr-europe" id="bloc-europe"><div><h2>La France en Europe ${anEurope?`(${anEurope})`:''}</h2><p class="fr-unit">En pourcentage du PIB</p>${anEurope?`<div class="fr-europe-switch" role="group" aria-label="Comparaison européenne"><button type="button" data-fr-europe-tab="eurostat_depenses_publiques_pib" aria-pressed="true">Dépenses</button><button type="button" data-fr-europe-tab="eurostat_prelevements_obligatoires_pib" aria-pressed="false">Prélèvements</button></div><div class="fr-histograms">${histogramme(pays,'eurostat_depenses_publiques_pib',anEurope,'Dépenses publiques')}${histogramme(pays,'eurostat_prelevements_obligatoires_pib',anEurope,'Prélèvements obligatoires')}</div>`:''}<a class="fr-source" href="${source(indexSources,'eurostat_depenses_publiques_pib')}">Source : Eurostat</a></div><aside id="bloc-fonctions"${anFonctions?'':' hidden'}><h3>Dépenses publiques par fonction ${anFonctions?`(${anFonctions})`:''}</h3><p class="fr-unit">En pourcentage du PIB</p>${anFonctions?`<ul class="fr-functions">${fonctions.map(([id,nom],i)=>{const v=s[`eurostat_fonction_${id}`][anFonctions];return `<li><span>${nom}</span><div><i style="width:${v/25*100}%;background:${i===0?ROUGE:'#83b5de'}"></i></div><strong>${nombre(v,1)} %</strong></li>`;}).join('')}</ul>`:''}</aside></section>`:''}
      ${questionsFrance(insights)}
      ${arbitrages(insights,pays,catalogue)}
      ${dossier?`<section class="fr-feature" id="bilan-dossier-section"><a class="fr-feature-story" href="/analyses/${esc(dossier.slug)}/"><img src="/dossiers/groenland.jpg" alt="Montagnes et fjord au Groenland" width="400" height="300" loading="lazy"><div><p class="fr-eyebrow">Un dossier pour éclairer les chiffres</p><h2>${esc(dossier.titre)}</h2><p>Ressources, géopolitique, environnement : comprendre les enjeux d’aujourd’hui et de demain.</p><span class="fr-text-link">Lire le dossier</span></div></a><aside><span class="fr-icon">${icone('europe')}</span><h3>Des données pour<br>une démocratie plus proche.</h3><p>Comprendre les finances publiques pour un débat plus juste et plus serein.</p><a class="fr-button" href="/analyses/">Voir les dossiers</a></aside></section>`:''}
    </div>
    <footer class="fr-footer"><div class="fr-promises"><div><span class="fr-icon">${icone('france')}</span><p><strong>Des données fiables</strong><small>Sources publiques officielles</small></p></div><div><span class="fr-icon">${icone('recettes')}</span><p><strong>Des analyses indépendantes</strong><small>Pour un débat éclairé</small></p></div><div><span class="fr-icon">${icone('question')}</span><p><strong>Une information accessible</strong><small>À tous les citoyens</small></p></div></div><div class="fr-footer-bottom"><a class="fr-wordmark" href="/accueil/">500 Signatures</a><span>Des données pour une démocratie plus proche.</span><nav aria-label="Navigation de fin de page"><a href="/bilan">France</a><a href="/territoire">Villes</a><a href="/analyses/">Dossiers</a><a href="/mandats/">Mandats</a><a href="/sources/">Sources et méthode</a></nav></div><details id="france-credits" class="fr-credits"><summary>Crédits photographiques</summary><p>Assemblée nationale : <a href="https://commons.wikimedia.org/wiki/File:Assemblee_Nationale_fa%C3%A7ade.jpg">Funky Tee</a> · <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a> · cadrage adapté. Groenland : <a href="https://commons.wikimedia.org/wiki/File:Greenland_scenery.jpg">Jensbn</a> · CC BY 2.5. <a href="/france/credits.html">Photographies des thèmes</a>.</p></details></footer>
  </div>`;
}

/** Les permaliens ouvrent la famille contenant l'analyse demandée. */
export function brancherFrancePage(): void {
  document.addEventListener('click',evenement=>{
    const bouton=(evenement.target as Element | null)?.closest<HTMLButtonElement>('[data-fr-europe-tab]');
    if(!bouton)return;
    const id=bouton.dataset.frEuropeTab;
    document.querySelectorAll<HTMLButtonElement>('[data-fr-europe-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.frEuropeTab===id)));
    document.querySelectorAll<HTMLElement>('[data-fr-europe-chart]').forEach(g=>g.dataset.frActive=String(g.dataset.frEuropeChart===id));
  });
  const entete=document.querySelector<HTMLElement>('.entete');
  const nav=entete?.querySelector<HTMLElement>('.entete__nav');
  if(entete && nav && !entete.querySelector('.fr-menu')) {
    const bouton=document.createElement('button');
    bouton.className='fr-menu';
    bouton.type='button';
    bouton.setAttribute('aria-label','Ouvrir le menu');
    bouton.setAttribute('aria-controls',nav.id);
    bouton.setAttribute('aria-expanded','false');
    bouton.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    const fermer=()=>{bouton.setAttribute('aria-expanded','false');bouton.setAttribute('aria-label','Ouvrir le menu');delete entete.dataset.frMenu;};
    bouton.addEventListener('click',()=>{
      if(bouton.getAttribute('aria-expanded')==='true'){fermer();return;}
      bouton.setAttribute('aria-expanded','true');bouton.setAttribute('aria-label','Fermer le menu');entete.dataset.frMenu='ouvert';
    });
    entete.insertBefore(bouton,nav);
    nav.addEventListener('click',fermer);
    entete.addEventListener('keydown',e=>{if(e.key==='Escape'){fermer();bouton.focus();}});
  }
  const ouvrirAncre=()=>{
    let id:string;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    if(!id.startsWith('insight-') && !id.startsWith('arbitrages-'))return;
    const cible=document.getElementById(id);
    const detail=cible?.closest('details');
    if(detail){detail.open=true;requestAnimationFrame(()=>cible?.scrollIntoView({block:'start'}));}
  };
  ouvrirAncre();
  window.addEventListener('hashchange',ouvrirAncre);
}
