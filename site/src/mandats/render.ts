import { SOCIETY_LABELS } from './national-society.ts';
import { annualDeficit, DEFICIT_SOURCE } from './national-deficit.ts';
import { nationalMandateHeading, nationalCommandPulse, nationalDecisionImpact } from "./national-command.ts";
import { nationalScene } from "./national-scene.ts";
import { dossierCopy, choiceCopy, choiceCosts } from "./novice.ts";
import { icon } from "./icons.ts";
import { planner } from "./planner.ts";
import { AMBITIONS, ambitionFor } from "./ambitions.ts";
import { deliveryFeed, world, worldArt } from "./world.ts";
import type { WorldOptions } from "./world.ts";
import { choicesFor, domainFor, calendarFor, startingGame, preview, score } from "./engine.ts";
import { escape as e } from "./sharing.ts";
import type { Game } from "./types.ts";
import { crisisCount } from "./progression.ts";
import type { MandateProgression } from "./progression.ts";
export type Screen = "select" | "mandate" | "play" | "year" | "result";
export type View = "decision" | "territory" | "finance" | "journal" | "plan";
export const n = (v: number, digits = 1) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(v);
const button = (action: string, label: string, cls = "button") => `<button class="${cls}" data-action="${action}">${label}</button>`;
const eyebrow = (text: string) => `<p class="eyebrow">${text}</p>`;
const V9_CHAPTERS = [
  { title: "Prise de fonctions", intro: "Vous fixez le cap et engagez les premières réformes. Les effets les plus lourds ne sont pas encore tous visibles." },
  { title: "Premières conséquences", intro: "Les choix de la première année commencent à produire leurs effets. Les marges de manœuvre se déplacent." },
  { title: "Le point de bascule", intro: "Les décisions accumulées transforment le scénario. Certaines tensions peuvent désormais devenir des crises." },
  { title: "Les choix qui engagent", intro: "Le temps restant se réduit. Les arbitrages de cette année pèseront directement sur l’héritage du mandat." },
  { title: "L’héritage", intro: "Dernière année. Vous arbitrez ce qui doit encore changer et ce qui sera transmis à la fin du mandat." },
] as const;
const v9Chapter = (g: Game) => V9_CHAPTERS[Math.max(0, Math.min(4, calendarFor(g).year - 1))];

const signedDelta = (value:number, digits=0) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${n(Math.abs(value),digits)}`;

function missionPulse(g:Game):string {
  if(g.version<9)return "";
  const mission=ambitionFor(g), initial=startingGame(g);
  if((g.ambition??"equilibre")==="equilibre"){
    const start=Math.abs(annualDeficit(initial)), current=Math.abs(annualDeficit(g)), delta=current-start;
    return `<section class="mission-pulse" aria-label="Suivi de votre mission"><span class="mission-pulse__label">MISSION · ${e(mission.label)}</span><strong>Déficit ${n(current)} Md€</strong><small>Depuis le départ : ${signedDelta(delta,1)} Md€</small></section>`;
  }
  if(g.ambition==="services"){
    return `<section class="mission-pulse" aria-label="Suivi de votre mission"><span class="mission-pulse__label">MISSION · ${e(mission.label)}</span><strong>Services ${Math.round(g.metrics.services)}/100</strong><small>Services ${signedDelta(g.metrics.services-initial.metrics.services)} pts · confiance ${signedDelta(g.metrics.trust-initial.metrics.trust)} pts</small></section>`;
  }
  return `<section class="mission-pulse" aria-label="Suivi de votre mission"><span class="mission-pulse__label">MISSION · ${e(mission.label)}</span><strong>Résilience ${Math.round(g.metrics.resilience)}/100</strong><small>Résilience ${signedDelta(g.metrics.resilience-initial.metrics.resilience)} pts · équipements ${signedDelta(g.metrics.assets-initial.metrics.assets)} pts</small></section>`;
}

function campaignPath(g:Game, compact=false):string {
  if(g.version<9)return "";
  const calendar=calendarFor(g);
  return `<ol class="campaign-path ${compact?"campaign-path--compact":""}" aria-label="Chapitres du mandat">${V9_CHAPTERS.map((chapter,i)=>{
    const year=i+1, completed=year<=calendar.completedYears, current=year===calendar.year&&g.turn<30;
    const state=completed?"completed":current?"current":"locked";
    const marker=completed?icon("check"):current?`${calendar.slot}/6`:"";
    return `<li class="${state}"><span class="campaign-path__marker">${marker}</span><span class="campaign-path__copy"><small>ANNÉE ${year}</small><strong>${e(chapter.title)}</strong></span></li>`;
  }).join("")}</ol>`;
}

function archivesBlock(progression?:MandateProgression):string {
  if(!progression?.completedRuns)return "";
  const recent=[...progression.archives].reverse().slice(0,3);
  return `<section class="mandate-archives" aria-labelledby="mandate-archives-title">
    <div class="mandate-archives__heading"><div>${eyebrow("VOS ARCHIVES")}<h2 id="mandate-archives-title">Vos mandats laissent une trace.</h2></div><p>Chaque campagne terminée enrichit vos archives locales et vous permet d’explorer d’autres scénarios.</p></div>
    <div class="mandate-archives__stats">
      <span><strong>${progression.completedRuns}</strong><small>mandat${progression.completedRuns>1?"s":""} terminé${progression.completedRuns>1?"s":""}</small></span>
      <span><strong>${progression.seeds.length}</strong><small>scénario${progression.seeds.length>1?"s":""} exploré${progression.seeds.length>1?"s":""}</small></span>
      <span><strong>${progression.crisesEncountered}</strong><small>crise${progression.crisesEncountered>1?"s":""} rencontrée${progression.crisesEncountered>1?"s":""}</small></span>
      <span><strong>${progression.missions.length}/3</strong><small>missions jouées</small></span>
    </div>
    <div class="mandate-archives__runs">${recent.map(a=>`<article><span>Scénario #${a.seed}</span><strong>${e(AMBITIONS[a.ambition].label)}</strong><small>${a.crises} crise${a.crises>1?"s":""} · services ${a.services}/100 · résilience ${a.resilience}/100</small></article>`).join("")}</div>
  </section>`;
}

/** A schematic choropleth, not an illustration or a real district boundary. */
export function territoryMap(g: Game, small = false): string {
  const shapes = g.mode === "municipal" ? ["M40 200 260 175 235 390 50 380Z", "M70 40 340 40 325 190 260 175 40 200Z", "M360 55 550 100 545 355 270 390 310 220Z"] : ["M245 30 385 65 375 190 260 185 195 100Z", "M390 80 520 145 480 285 380 235 375 190Z", "M95 125 195 100 260 185 225 310 105 280Z", "M225 310 260 185 380 235 480 285 390 390 285 370Z"];
  return `<svg class="territory-map ${small ? "map-small" : ""}" viewBox="0 0 600 420" role="img" aria-label="Carte schématique : ${g.areas.map(a => `${e(a.name)}, services ${Math.round(a.services)} sur 100`).join(" ; ")}"><path d="M0 60H600M0 120H600M0 180H600M0 240H600M0 300H600M0 360H600M60 0V420M120 0V420M180 0V420M240 0V420M300 0V420M360 0V420M420 0V420M480 0V420M540 0V420" fill="none" stroke="currentColor" stroke-opacity=".07"/>${shapes.map((s, i) => `<path d="${s}" fill="${g.mode === "municipal" ? "#3d8474" : "#496982"}" fill-opacity="${.25 + g.areas[i].services / 180}" stroke="#91b5b7" stroke-width="1.5"/>`).join("")}${g.mode === "municipal" ? '<path d="M370 -10C340 70 360 120 328 195S280 310 244 430" stroke="#426e86" stroke-width="16" fill="none"/><path d="M370 -10C340 70 360 120 328 195S280 310 244 430" stroke="#7aa6b8" stroke-width="1" fill="none"/>' : '<path d="M292 100 420 184 320 330 178 230Z" stroke="#94c4dd" stroke-dasharray="5 7" fill="none" opacity=".7"/>'}${g.areas.map((a, i) => { const x = g.mode === "municipal" ? [145, 207, 427][i] : [295, 427, 175, 325][i]; const y = g.mode === "municipal" ? [285, 110, 235][i] : [100, 178, 210, 320][i]; return `<g><circle cx="${x}" cy="${y}" r="${7 + a.services / 9}" fill="#d7f2dd" fill-opacity=".12"/><circle cx="${x}" cy="${y}" r="5" fill="${a.services >= 60 ? "#b9e7c5" : "#edc488"}"/>${small ? "" : `<text x="${x}" y="${y + 32}" text-anchor="middle" fill="#f2f7f4" font-size="14" font-family="Source Sans 3, sans-serif">${e(a.name)}</text><text x="${x}" y="${y + 51}" text-anchor="middle" fill="#b8cbd1" font-size="12" font-family="Source Sans 3, sans-serif">Services ${Math.round(a.services)}/100</text>`}</g>`; }).join("")}</svg>`;
}
export function selection(saved: Game | null, light = false, progression?: MandateProgression): string {
  return `<section class="mandate-selection mandate-home">
    <section class="mandate-home-hero" aria-labelledby="mandate-home-title">
      <div class="mandate-home-copy">
        ${eyebrow("SIMULER · ARBITRER · COMPRENDRE")}
        <h1 id="mandate-home-title" tabindex="-1">Prenez les rênes<br>du pays.</h1>
        <p class="lead">Incarnez le gouvernement et pilotez la France pendant cinq ans. Faites des choix, gérez les équilibres, affrontez les crises et voyez leurs effets.</p>
        <div class="mandate-home-actions">
          <button class="mandate-home-primary" data-action="mode" data-mode="national" aria-label="Gouverner la France">Commencer mon mandat</button>
          <a class="mandate-home-secondary" href="#mandate-concept">Découvrir le concept</a>
        </div>
      </div>
      <div class="mandate-home-visual">
        <div class="mandate-home-art">${worldArt("national", { light })}</div>
      </div>
    </section>
    ${saved ? `<div class="resume mandate-home-resume"><span><strong>Partie sauvegardée.</strong> ${e(domainFor(saved).place.replace(" · scénario fictif", ""))} · ${saved.turn}/${domainFor(saved).turns} décisions</span>${button("resume", "Reprendre", "button compact")}</div>` : ""}
    <section class="mandate-home-features" aria-label="Ce que vous ferez pendant le mandat">
      <article><span class="mandate-feature-icon">${icon("decision")}</span><div><h2>Prenez des décisions</h2><p>Réformes, fiscalité, services publics : arbitrez parmi des options documentées.</p></div></article>
      <article><span class="mandate-feature-icon mandate-feature-icon--red">${icon("finance")}</span><div><h2>Gérez les équilibres</h2><p>Chaque décision produit des effets croisés sur les comptes et la société.</p></div></article>
      <article><span class="mandate-feature-icon">${icon("journal")}</span><div><h2>Affrontez les crises</h2><p>Réagissez à des événements économiques, sociaux et internationaux.</p></div></article>
      <article><span class="mandate-feature-icon mandate-feature-icon--red">${icon("plan")}</span><div><h2>Voyez l’impact de vos choix</h2><p>Suivez l’évolution du déficit, de la dette et de la confiance au fil du mandat.</p></div></article>
    </section>
    ${archivesBlock(progression)}
    <section class="mandate-home-preview" id="mandate-concept" aria-labelledby="mandate-preview-title">
      <div class="mandate-home-preview-copy">
        ${eyebrow("UNE EXPÉRIENCE IMMERSIVE")}
        <h2 id="mandate-preview-title">Un mandat, des choix,<br>des conséquences.</h2>
        <p>Une simulation politique fondée sur des données publiques et des scénarios documentés. Explorez la complexité de l’action publique et mesurez l’impact de vos décisions, année après année.</p>
        <ul class="mandate-home-proofs">
          <li>Des données publiques</li>
          <li>Des scénarios documentés</li>
          <li>Une approche pédagogique</li>
        </ul>
      </div>
      <div class="mandate-preview-window" aria-label="Aperçu du simulateur Mandats">
        <header><strong>Mon mandat</strong><span>2027 · année 1/5</span></header>
        <div class="mandate-preview-body">
          <nav aria-label="Aperçu de la navigation"><span aria-current="page">Vue d’ensemble</span><span>Décisions</span><span>Événements</span><span>Indicateurs</span></nav>
          <div class="mandate-preview-main">
            <h3>Année 2027</h3>
            <p>Vos priorités pour la première année de mandat.</p>
            <div class="mandate-preview-metrics"><div><span>Déficit public</span><strong>153 Md€</strong></div><div><span>Dette publique</span><strong>111 %</strong></div><div><span>Confiance</span><strong>48 / 100</strong></div></div>
            <section class="mandate-preview-decision"><span>PROCHAINE DÉCISION</span><strong>Réformer l’assurance chômage</strong><small>Emploi & travail · décision 1/30</small></section>
          </div>
        </div>
      </div>
    </section>
  </section>`;
}

function nationalPlayHeader(g: Game): string {
  const calendar = calendarFor(g);
  const deficit = Math.abs(annualDeficit(g));
  const debtRatio = g.finance.gdp ? g.finance.debt / g.finance.gdp * 100 : 0;
  const chapter = g.version >= 9 ? v9Chapter(g) : null;
  return `<section class="mandat-play-hero ${chapter ? `v9-chapter v9-chapter-${calendar.year}` : ""}" aria-label="Votre mandat">
    <div><p class="eyebrow">${chapter ? `ANNÉE ${calendar.year}/5 · ${e(chapter.title).toLocaleUpperCase("fr")}` : "MANDATS"}</p><h2>${chapter ? e(chapter.title) : "Faites les choix qui comptent."}</h2><p>${chapter ? e(chapter.intro) : "Incarnez le gouvernement et relevez les défis du quinquennat. Des choix concrets, des conséquences visibles."}</p></div>
  </section>
  ${campaignPath(g)}
  ${missionPulse(g)}
  <section class="mandat-play-status mobile-mandate-context" aria-label="État du mandat">
    <div class="mandat-play-year"><span>Progression</span><strong>Année ${calendar.year}/${calendar.years}</strong><i aria-hidden="true">${Array.from({length:calendar.years},(_,i)=>`<b class="${i < calendar.year ? "done" : ""}"></b>`).join("")}</i></div>
    <div><span>Déficit public</span><strong>${n(deficit)} Md€</strong></div>
    <div><span>Dette publique</span><strong>${n(debtRatio)} %</strong><small>du PIB</small></div>
    <div><span>Confiance citoyenne</span><strong>${Math.round(g.metrics.trust)} / 100</strong></div>
  </section>`;
}

export function pulse(g: Game): string {
  const d = domainFor(g);
  const financeValue = g.mode === "municipal" ? `${n(g.finance.cash)} M€` : g.version >= 6 ? `${n(Math.abs(annualDeficit(g)))} Md€` : `${n(g.finance.debt / g.finance.gdp * 100)} %`;
  return `<div class="pulse" aria-label="État du mandat"><div><span>${g.mode === "municipal" ? "Trésorerie" : g.version < 6 ? "Dette / PIB" : annualDeficit(g) < 0 ? "Excédent annuel" : "Déficit annuel"}</span><strong>${financeValue}</strong></div>${g.mode === "municipal" ? `<div><span>Services</span><strong>${Math.round(g.metrics.services)}<small>/100</small></strong></div><div><span>Résilience</span><strong>${Math.round(g.metrics.resilience)}<small>/100</small></strong></div>` : ""}<div class="pulse-year"><span>${e(d.role.split(" et")[0])}</span><strong>${g.turn}/${d.turns}<small> décisions</small></strong></div></div>`;
}
export function mandateSetup(g: Game, opts: WorldOptions = {}): string {
  const missions=(Object.entries(AMBITIONS) as [keyof typeof AMBITIONS,(typeof AMBITIONS)[keyof typeof AMBITIONS]][]).map(([key,mission]) => `<button class="mission-card" data-action="choose-mission" data-ambition="${key}"><span class="mission-icon">${key==="equilibre"?icon("finance"):key==="services"?icon("decision"):icon("plan")}</span><strong>${e(mission.label)}</strong><span>${e(mission.description)}</span><small>Choisir cette mission</small></button>`).join("");
  return `<section class="v9-mission">
    <div class="v9-mission-visual">${worldArt("national",opts)}<div><p>Votre mandat commence ici</p><strong>France · 5 années · 30 décisions</strong></div></div>
    <article class="v9-mission-copy">
      ${eyebrow("CHOISISSEZ VOTRE MISSION")}
      <h1 tabindex="-1">Quel cap voulez-vous tenir pendant cinq ans ?</h1>
      <p class="lead">Le même pays, trois priorités de jeu. Votre mission change la lecture du bilan, pas les faits de départ ni les décisions disponibles.</p>
      <div class="mission-grid" role="group" aria-label="Mission du mandat">${missions}</div>
      <div class="mission-campaign-preview"><span>Votre campagne</span>${campaignPath(g,true)}</div>
      <div class="mission-baseline">
        <span><small>Déficit de départ</small><strong>153 Md€</strong></span>
        <span><small>Services</small><strong>${Math.round(g.metrics.services)}/100</strong></span>
        <span><small>Confiance</small><strong>${Math.round(g.metrics.trust)}/100</strong></span>
        <span><small>Scénario</small><strong>#${g.seed}</strong></span>
      </div>
      <button class="text-button" data-action="new">Retour</button>
    </article>
  </section>`;
}
function decision(g: Game): string {
  const d = domainFor(g), dossier = d.dossiers[g.turn], copy=dossierCopy(g,dossier);
  const crisis=g.version>=9&&dossier.category==="Conséquence sociale";
  // Les notes internes du dossier ne doivent pas apparaître dans le parcours.
  // Elles alourdissaient la lecture de la décision sans aider à choisir.
  const context = "";
  return `<article class="${crisis?"dossier crisis-dossier":"dossier"}">${crisis?`<div class="crisis-banner"><span>CRISE</span><strong>Les conséquences de vos choix reviennent dans le jeu.</strong></div>`:""}${g.mode === "national" ? `<div class="mobile-decision-feedback" role="status">${nationalDecisionImpact(g).slice(0,2).map(item=>`<span>${e(item.label.replace(" cette année", ""))}</span>`).join("")}</div>` : ""}${eyebrow(`${crisis?"SITUATION DE CRISE":g.mode === "national" ? e(dossier.category) : "Situation de jeu"} <span class="campaign-position">${g.version >= 9 ? `Année ${calendarFor(g).year} · décision ${calendarFor(g).slot}/${calendarFor(g).slots}` : `Décision ${g.turn + 1}/${d.turns}`}</span>`)}<h1 tabindex="-1">${e(copy[0])}</h1><p class="story">${e(copy[1])}</p>${context}<div class="choices">${choicesFor(g).map((c,index) => { const p=preview(g,c.id), text=choiceCopy(g,dossier,c); const detail = [c.benefit !== "La décision modifie la trajectoire et les dossiers suivants." && c.benefit !== text.outcome ? `<span><b>Effet immédiat</b> ${e(c.benefit)}</span>` : "", c.sacrifice !== text.outcome ? `<span><b>Arbitrage</b> ${e(c.sacrifice)}</span>` : "", c.delayed ? `<span><b>Dans ${c.delayed.after} an${c.delayed.after > 1 ? "s" : ""}</b> ${e(c.delayed.label)}</span>` : ""].filter(Boolean).join(""); const consequences = g.mode === "national" && detail ? `<span class="choice-consequences">${detail}</span>` : ""; return `<button class="choice" data-action="choose" data-choice="${c.id}" ${p.error ? "disabled" : ""}><span class="choice-top"><span class="choice-key">${String.fromCharCode(65+index)}</span><strong>${e(text.title)}</strong></span><span class="choice-outcome">${e(text.outcome)}</span>${consequences}<span class="choice-facts">${choiceCosts(c,g.mode).map(cost=>`<span class="cost">${e(cost)}</span>`).join("")}</span>${p.error ? `<span class="choice-error">${e(p.error)}</span>` : ""}</button>`; }).join("")}</div></article>`;
}
export function finance(g: Game): string {
  const d = domainFor(g); const last = g.history.at(-1); const l = last?.ledger; const provisional = g.version >= 3 && last && !last.closed;
  const rows = l ? [["Recettes", l.revenue], ["Dépenses courantes hors intérêts", l.operating], ["Intérêts", l.interest], ["Épargne brute", l.savings], ["Investissement", l.investment], ["Subventions d'investissement", l.grants], ["Capital remboursé", l.repayment], ["Financement nouveau", l.borrowing], ["Dette en fin d'année", l.debt]] as const : [["Recettes héritées", g.finance.revenue], ["Dépenses courantes héritées", g.finance.operating], ["Dette héritée", g.finance.debt]] as const;
  return `<article class="finance-panel">${eyebrow(`COMPTES DU MANDAT · ${d.unit}`)}<h1 tabindex="-1">Le budget de votre mandat.</h1><p>${g.mode === "municipal" ? "L'épargne finance d'abord le remboursement. L'emprunt complète seulement le financement des investissements." : "Le déficit inclut les intérêts et l'investissement. Il accroît la dette ; le ratio dépend aussi du PIB nominal."}</p>${provisional ? `<p class="finance-status">Prévision de l’année ${last.year}. Les comptes seront arrêtés après le dernier dossier de l’année.</p>` : ""}${trajectory(g)}<dl class="ledger">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${n(value)} <small>${d.unit}</small></dd></div>`).join("")}</dl>${g.mode === "national" ? `<p class="finance-note">Déficit de l’année : <strong>${n(annualDeficit(g))} Md€</strong>. PIB nominal du scénario : ${n(l?.gdp ?? g.finance.gdp)} Md€. Taux moyen de la dette : ${n(g.finance.rate * 100, 2)} %.</p>` : `<p class="finance-note">Trésorerie : <strong>${n(g.finance.cash)} M€</strong>. La capacité de désendettement est un indicateur analytique, pas un plafond légal unique.</p>`}${g.mode === "national" && g.version >= 6 ? `<p class="finance-note">Point de départ du jeu : 153 Md€, arrondi du déficit public de 2025 (152,5 Md€), pour l’ensemble des administrations publiques. <a href="${DEFICIT_SOURCE}" target="_blank" rel="noopener noreferrer">Insee, publication du 29 mai 2026</a>. Les autres montants et les effets des décisions sont simulés.</p>${g.version >= 7 ? `<p class="finance-note">Chaque nouvelle année, les recettes suivent l’activité nominale du scénario et les charges courantes suivent les prix. Les réformes modifient ensuite ces budgets. Les situations sociales dégradées peuvent créer des charges d’urgence ou réduire les recettes.</p>` : ""}` : ""}<section class="page-notes"><h2>Comptes année par année</h2><div class="year-ledgers">${g.history.filter(t => g.version < 3 || t.closed).map(t => `<section><h3>Année ${t.year}</h3><p>${e(t.title)}</p><dl><div><dt>Recettes</dt><dd>${n(t.ledger.revenue)} ${d.unit}</dd></div><div><dt>Dette</dt><dd>${n(t.ledger.debt)} ${d.unit}</dd></div><div><dt>Services</dt><dd>${Math.round(t.metrics.services)}/100</dd></div></dl></section>`).join("") || "<p>Vos premiers comptes apparaîtront après une clôture annuelle.</p>"}</div></section></article>`;
}
export function trajectory(g: Game): string {
  const base = startingGame(g).finance.debt; const values = [base, ...g.history.filter(t => g.version < 3 || t.closed).map(t => t.ledger.debt)];
  const min = Math.min(...values) * .9, max = Math.max(...values) * 1.05;
  const points = values.map((v, i) => `${20 + i * 360 / Math.max(1, values.length - 1)},${105 - (v - min) / Math.max(1, max - min) * 80}`).join(" ");
  return `<figure class="trajectory"><figcaption>Trajectoire de dette <span>${n(values.at(-1)!)} ${domainFor(g).unit}</span></figcaption><svg viewBox="0 0 400 135" role="img" aria-label="Dette du scénario par année : ${values.map(v => n(v)).join(", ")} ${domainFor(g).unit}"><path d="M20 112H380" stroke="#44616d"/><polyline points="${points}" stroke="var(--design-red)" stroke-width="3" fill="none"/>${points.split(" ").map(point=>{const [x,y]=point.split(",");return `<circle cx="${x}" cy="${y}" r="4" fill="var(--design-red)"/>`;}).join("")}<text x="20" y="132" fill="var(--design-muted)" font-size="11">Héritage</text><text x="380" y="132" text-anchor="end" fill="var(--design-muted)" font-size="11">Année ${calendarFor(g).completedYears}</text></svg><p>Échelle ajustée à la trajectoire, départ différent de zéro.</p></figure>`;
}
export function societyPanel(g: Game): string {
  if (!g.society) return '';
  return `<section class="governance-indicators society-panel"><h2>Qui bénéficie de vos décisions ?</h2><p>Conditions matérielles simulées sur 100 : revenus, accès aux services et moyens d’activité. Ces indices ne mesurent pas des intentions de vote.</p><dl>${Object.entries(SOCIETY_LABELS).map(([key,label])=>`<div><dt>${label}</dt><dd>${Math.round(g.society![key as keyof typeof SOCIETY_LABELS])}<small>/100</small></dd></div>`).join('')}</dl></section>`;
}
export function governanceIndicators(g: Game): string {
  const labels = { services: "Services", cohesion: "Cohésion", trust: "Confiance", resilience: "Résilience", assets: "Patrimoine" } as const;
  return `<section class="governance-indicators" aria-labelledby="indicators-title"><h2 id="indicators-title">Les indicateurs du jeu</h2><p>Indices de simulation sur 100. La confiance représente un état du jeu, pas une intention de vote.</p><dl>${Object.entries(labels).map(([key, label]) => `<div><dt>${label}</dt><dd>${Math.round(g.metrics[key as keyof typeof labels])}<small>/100</small></dd></div>`).join("")}</dl></section>`;
}
export function territory(g: Game, opts: WorldOptions = {}): string {
  return `<article class="territory-panel">${eyebrow("LE TERRITOIRE EN DÉTAIL")}<h1 tabindex="-1">Les services et les équipements.</h1><p>${g.city ? "Les effets de vos choix sur les quartiers du mandat." : g.mode === "municipal" ? "Trois quartiers, des besoins différents. Les effets d'un projet ciblé apparaissent à sa livraison." : "Les effets de vos choix sur quatre profils territoriaux."}</p><div class="mobile-territory-world">${g.mode === "national" ? nationalScene(g, opts) : world(g, opts)}</div>${governanceIndicators(g)}${societyPanel(g)}${g.mode === "municipal" ? territoryMap(g) : ""}<div class="area-list">${g.areas.map(a => `<section><h2>${e(a.name)}</h2><p>${e(a.need)}</p><div class="area-meters"><label>Services <strong>${Math.round(a.services)}/100</strong><meter min="0" max="100" value="${a.services}">${Math.round(a.services)}</meter></label><label>Résilience <strong>${Math.round(a.resilience)}/100</strong><meter min="0" max="100" value="${a.resilience}">${Math.round(a.resilience)}</meter></label></div></section>`).join("")}</div></article>`;
}
function journal(g: Game): string {
  const years = [...new Set(g.history.map(t => t.year))];
  return `<article class="journal">${eyebrow("DÉCISIONS PRISES")}<h1 tabindex="-1">Vos décisions.</h1>${g.turn ? button("share-decision","Partager cette décision","text-button") : ""}${years.map(year => `<details class="journal-year" ${year === years.at(-1) ? 'open' : ''}><summary>Année ${year}<span>${g.history.filter(t=>t.year===year).length} décision(s)</span></summary>${g.history.filter(t=>t.year===year).map(t=>`<section><h2>${e(domainFor(g).dossiers.flatMap(d=>d.choices.some(c=>c.id===t.choice)?[choiceCopy(g,d,d.choices.find(c=>c.id===t.choice)!).title]:[])[0] ?? t.title)}</h2>${t.event ? `<p class="event-label">${e(t.event)}</p>` : ''}<ul>${t.messages.map(m=>`<li>${e(m)}</li>`).join('')}</ul></section>`).join('')}</details>`).join('') || '<p>Le premier dossier vous attend. Chaque décision sera conservée ici.</p>'}<h2>Prochaines échéances</h2>${g.pending.length ? `<ul>${g.pending.map(p => `<li>Année ${p.due + 1} : ${e(p.label)}</li>`).join("")}</ul>` : "<p>Aucun effet différé en attente.</p>"}</article>`;
}

function turnFeedback(g: Game): string {
  if (!g.turn) return "";
  const last=g.history.at(-1)!;
  return `<div class="turn-feedback"><span class="turn-confirmation">${icon("check")} ${g.version >= 3 && !last.closed ? `Décision ${g.turn} prise` : `Année ${last.year} terminée`}</span><button class="text-button" data-action="view" data-view="finance">Voir les effets</button></div>`;
}

export function yearRecap(g: Game): string {
  const last=g.history.at(-1);
  if(!last?.closed) return gameShell(g,"play","decision");
  const previous=[...g.history].reverse().find(t=>t.closed&&t.year===last.year-1);
  const initial=startingGame(g);
  const beforeMetrics=previous?.metrics??initial.metrics;
  const beforeDeficit=previous?.ledger.deficit??annualDeficit(initial);
  const delta=(value:number) => `${value>0?"+":value<0?"−":""}${n(Math.abs(value))}`;
  const yearDecisions=g.history.filter(t=>t.year===last.year);
  const due=g.pending.filter(p=>p.due===last.year).slice(0,3);
  const chapter=V9_CHAPTERS[last.year-1]!;
  const nextChapter=last.year<5?V9_CHAPTERS[last.year]:null;
  const crisesThisYear=yearDecisions.filter(t=>/^k\d+[abc]$/.test(t.choice)).length;
  const milestoneCount=yearDecisions.length;
  const pendingCount=g.pending.filter(p=>p.due>=last.year).length;
  return `<section class="year-recap v9-chapter-${last.year}">
    <header class="year-recap-hero">
      ${eyebrow(`FIN DE L’ANNÉE ${last.year} · ${e(chapter.title).toLocaleUpperCase("fr")}`)}
      <h1 tabindex="-1">Un an de décisions. Voici ce qui a changé.</h1>
      <p>Les comptes de l’année sont clôturés. Les conséquences différées restent actives pour la suite du mandat.</p>
    </header>
    ${campaignPath(g,true)}
    ${missionPulse(g)}
    <section class="chapter-milestones" aria-label="Jalons du chapitre"><span><strong>Chapitre ${last.year}/5 terminé</strong><small>${milestoneCount} décisions archivées</small></span><span><strong>${crisesThisYear}</strong><small>crise${crisesThisYear>1?"s":""} rencontrée${crisesThisYear>1?"s":""} cette année</small></span><span><strong>${pendingCount}</strong><small>conséquence${pendingCount>1?"s":""} encore en attente</small></span><span><strong>#${g.seed}</strong><small>scénario en cours</small></span></section>
    <div class="year-recap-grid">
      <section class="year-recap-metrics" aria-label="Évolution de l'année">
        <article><span>Solde annuel</span><strong>${last.ledger.deficit<0?"Excédent":"Déficit"} ${n(Math.abs(last.ledger.deficit))} Md€</strong><small>${delta(last.ledger.deficit-beforeDeficit)} Md€ sur l’année</small></article>
        <article><span>Services publics</span><strong>${Math.round(last.metrics.services)}/100</strong><small>${delta(last.metrics.services-beforeMetrics.services)} pts</small></article>
        <article><span>Confiance</span><strong>${Math.round(last.metrics.trust)}/100</strong><small>${delta(last.metrics.trust-beforeMetrics.trust)} pts</small></article>
        <article><span>Résilience</span><strong>${Math.round(last.metrics.resilience)}/100</strong><small>${delta(last.metrics.resilience-beforeMetrics.resilience)} pts</small></article>
      </section>
      <section class="year-recap-story">
        <h2>Les décisions de l’année</h2>
        <ol>${yearDecisions.map(t=>`<li><span>${e(t.title)}</span>${t.event&&t===yearDecisions.at(-1)?`<small>${e(t.event)}</small>`:""}</li>`).join("")}</ol>
      </section>
      <section class="year-recap-next">
        <h2>${last.year<5?`Année ${last.year+1} · ${e(nextChapter!.title)}`:"Votre héritage est prêt"}</h2>
        ${last.year<5 ? (due.length?`<ul>${due.map(p=>`<li>${e(p.label)}</li>`).join("")}</ul>`:"<p>Les effets de vos choix continueront de modifier le scénario.</p>") : "<p>Cinq années sont terminées. Le bilan final rassemble votre trajectoire sans réduire le mandat à une note unique.</p>"}
        <button class="button primary" data-action="${last.year<5?"next-year":"show-result"}">${last.year<5?`Passer à l’année ${last.year+1}`:"Voir mon héritage"}</button>
      </section>
    </div>
  </section>`;
}

function deficitResult(g: Game): string {
  const initial = annualDeficit(startingGame(g)), final = annualDeficit(g), reduction = initial - final;
  return `<p class="lead deficit-result">Déficit de départ : ${n(initial)} Md€.<br>${final < 0 ? 'Excédent' : 'Déficit'} annuel en fin de mandat : <strong>${n(Math.abs(final))} Md€</strong>.<br>${reduction >= 0 ? 'Amélioration' : 'Dégradation'} du solde annuel : ${n(Math.abs(reduction))} Md€. ${final <= 0 ? 'Équilibre atteint.' : 'Objectif : revenir à 0 Md€ de déficit.'}</p>`;
}
export function result(g: Game, shared = false): string {
  const s = score(g); const d = domainFor(g);
  if(g.version>=9){
    const mission=ambitionFor(g), crises=crisisCount(g);
    const closedYears=g.history.filter(t=>t.closed);
    return `<article class="result v9-result">${eyebrow(`${shared ? "HÉRITAGE PARTAGÉ" : "VOTRE HÉRITAGE"} · ${e(d.place.replace(" · scénario fictif", ""))}`)}<h1 tabindex="-1">Cinq années de choix, une trajectoire à relire.</h1><p class="lead">Mission de départ : <strong>${e(mission.label)}</strong>. Le bilan présente les résultats du scénario selon plusieurs dimensions, sans note globale.</p>${campaignPath(g,true)}<section class="final-run-stats" aria-label="Statistiques de cette campagne"><span><strong>30</strong><small>décisions</small></span><span><strong>5</strong><small>chapitres terminés</small></span><span><strong>${crises}</strong><small>crise${crises>1?"s":""} rencontrée${crises>1?"s":""}</small></span><span><strong>#${g.seed}</strong><small>scénario</small></span></section>${deficitResult(g)}<div class="score-dimensions"><div><span>Services publics</span><strong>${Math.round(g.metrics.services)}/100</strong><meter min="0" max="100" value="${g.metrics.services}"></meter></div><div><span>Cohésion</span><strong>${Math.round(g.metrics.cohesion)}/100</strong><meter min="0" max="100" value="${g.metrics.cohesion}"></meter></div><div><span>Confiance</span><strong>${Math.round(g.metrics.trust)}/100</strong><meter min="0" max="100" value="${g.metrics.trust}"></meter></div><div><span>Résilience</span><strong>${Math.round(g.metrics.resilience)}/100</strong><meter min="0" max="100" value="${g.metrics.resilience}"></meter></div></div>${societyPanel(g)}<section class="campaign-memory"><h2>La mémoire de votre mandat</h2><ol>${closedYears.map(t=>`<li><span>Année ${t.year}</span><strong>${e(V9_CHAPTERS[t.year-1]?.title??`Chapitre ${t.year}`)}</strong><small>${e(t.title)}${t.event?` · ${e(t.event)}`:""}</small></li>`).join("")}</ol></section><div class="result-actions">${button("share", "Partager mon héritage", "button primary")}${button("replay", "Rejouer exactement ce défi", "button")}${button("open-plan", "Comparer une autre stratégie", "button")}${button("new-run", "Nouveau mandat", "button")}</div><section class="page-notes score-explanation"><h2>Relire le mandat</h2><p class="scope">Scénario #${g.seed}. Rejouer le même défi conserve ce contexte et les mêmes règles. Nouveau mandat crée un autre scénario. Les indicateurs sont ceux de la simulation et ne constituent ni une note de gouvernement ni une intention de vote.</p></section><section class="page-notes">${journal(g)}</section></article>`;
  }
  return `<article class="result">${eyebrow(`${shared ? "RÉSULTAT PARTAGÉ" : "BILAN DU MANDAT"} · ${e(d.place.replace(" · scénario fictif", ""))}`)}<h1 tabindex="-1">${s.legacy}</h1>${g.mode === "national" && g.version >= 6 ? deficitResult(g) : ""}<p class="score-number">${s.total}<span>/100</span></p><p class="lead">Votre force : <strong>${s.strength.toLocaleLowerCase("fr")}</strong>.<br>Le prochain chantier : <strong>${s.weakness.toLocaleLowerCase("fr")}</strong>.</p><div class="score-dimensions">${Object.entries(s.dimensions).map(([key, v]) => `<div><span>${({ finances: "Finances durables", services: "Services", cohesion: g.version === 1 ? "Cohésion" : "Cohésion & confiance", resilience: "Résilience & patrimoine" })[key]}</span><strong>${Math.round(v)}/100</strong><meter min="0" max="100" value="${v}">${Math.round(v)}</meter></div>`).join("")}</div>${societyPanel(g)}<div class="result-actions">${button("share", "Partager mon héritage", "button primary")}${button("replay", "Rejouer le même défi", "button")}${button("open-plan", "Comparer une autre stratégie", "button")}${button("new", "Changer de mandat", "text-button")}</div><section class="page-notes score-explanation"><h2>Comprendre mon score</h2><p class="scope">${g.version === 1 ? "Chaque dimension pèse 25 %." : `${g.ambition && g.ambition !== "equilibre" ? `Ancienne priorité : ${ambitionFor(g).label}. ` : ""}Finances ${ambitionFor(g).weights.finances * 100} %, services ${ambitionFor(g).weights.services * 100} %, cohésion/confiance ${ambitionFor(g).weights.cohesion * 100} %, résilience ${ambitionFor(g).weights.resilience * 100} %.`} ${s.terminalPenalty ? `Charges non livrées : −${s.terminalPenalty} point.` : ""} Le score exprime les règles du jeu, pas la qualité réelle d'un gouvernement ni une intention de vote.</p></section><section class="page-notes">${journal(g)}</section></article>`;
}
export function gameShell(g: Game, screen: Screen, view: View, shared = false, opts: WorldOptions = {}, planIds: string[] = g.choices): string {
  const content = screen === "result" ? result(g, shared) : ({ decision: () => g.turn === domainFor(g).turns ? result(g, shared) : decision(g), territory: () => territory(g, opts), finance: () => `<div class="mandate-review">${finance(g)}${territory(g, opts).replace(/<h1/g,"<h2").replace(/<\/h1>/g,"</h2>")}${journal(g)}</div>`, journal: () => journal(g), plan: () => planner(g, planIds) })[view]();
  const calendar = calendarFor(g);
  const timeline = g.version >= 9 ? "" : `<ol class="mandate-timeline" aria-label="Progression du mandat">${Array.from({ length: calendar.years }, (_, i) => `<li class="${i < calendar.completedYears ? "completed" : i === calendar.year - 1 ? "current" : ""}"><span>${i < calendar.completedYears ? icon("check") : i + 1}</span><small>AN ${i + 1}</small></li>`).join("")}</ol>`;
  const tabs = screen === "play" ? `<nav class="game-tabs" aria-label="Vues du mandat"><button data-action="view" data-view="decision" ${view === "decision" ? 'aria-current="page"' : ""}>${icon("decision")}Décider</button><button data-action="view" data-view="finance" ${["finance","territory","journal"].includes(view) ? 'aria-current="page"' : ""}>${icon("finance")}Bilan</button><button data-action="tools">${icon("journal")}Ma partie</button></nav>` : "";
  const nationalDecisionHome = g.mode === "national" && screen === "play" && view === "decision";
  const mandateHeading = g.mode === "national" ? (nationalDecisionHome ? nationalPlayHeader(g) : nationalMandateHeading(g)) : `<div class="mobile-mandate-context"><span>${e(domainFor(g).place)}</span><strong>Année ${calendar.year}/${calendar.years}</strong></div>`;
  return `${screen === "play" && view === "decision" ? "" : pulse(g)}${mandateHeading}<div class="game-grid" data-screen="${screen}" data-view="${view}"><aside class="strategic-panel"><div class="world-heading"><div>${eyebrow(g.mode === "municipal" ? "VOTRE VILLE" : "LA FRANCE")}<h2>${e(domainFor(g).place)}</h2></div></div>${g.mode === "national" ? `<div class="national-command-world">${nationalScene(g, opts)}${nationalCommandPulse(g)}</div>` : world(g, opts)}${timeline}<div class="strategic-underlay"><div class="strategic-metrics"><span>Confiance <strong>${Math.round(g.metrics.trust)}<small>/100</small></strong></span><span>Patrimoine <strong>${Math.round(g.metrics.assets)}<small>/100</small></strong></span><button class="text-button" data-action="light-mode" aria-pressed="${!!opts.light}">${opts.light ? "Vue illustrée" : "Vue légère"}</button></div>${deliveryFeed(g)}${trajectory(g)}</div></aside><div class="game-content">${tabs}${content}${view === "decision" && g.city ? `<p class="decision-source">Source locale : <a href="${e(g.city.provenance.source)}">${e(g.city.provenance.producer)} · comptes ${g.city.year}</a></p>` : ""}${screen === "play" && view === "decision" && g.turn < domainFor(g).turns ? turnFeedback(g) : ""}</div></div>`;
}
