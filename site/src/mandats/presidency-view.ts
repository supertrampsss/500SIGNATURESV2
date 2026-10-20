import { crisisSeverity, crisisSpec, presidencyCrises } from "./presidency-crises.ts";
import { crisisAlerts, crisisBrief, crisisAnchor } from "./presidency-crisis-view.ts";
import type { Choice, Game } from "./types.ts";
import type { PressureProgramme, PressureSectorId } from "./pressure-types.ts";
import { presidencyActions, presidencyReforms, presidencyEvents, presidencyLinks, presidencyCreditsChoice, presidencyPoliticalActions, presidencyLedger, presidencyPriorityChoice, presidencyBudgetChoices } from "./presidency-api.ts";
import { STRATEGY_SECTORS } from "./presidency-strategy-content.ts";
import { strategyState, strategyOutcome, strategySupport } from "./presidency-strategy-engine.ts";
import { strategyObjectiveReading, strategyPoliticalReading, strategyWorkReading, strategySectorReading, strategyCausalReceipts, strategyLegislativeReceipts, strategyFinancialComparison } from "./presidency-read-model.ts";
import { start } from "./engine.ts";
import { NATIONAL_AGENDA } from "./national-agenda.ts";
import { presidencyIcon as icon } from "./presidency-icons.ts";

export type PresidencyPanel = "reforms" | "government" | "priorities" | "ending" | "bulletin";
export const PRESIDENCY_PLACES: Record<PressureSectorId, { x: number; y: number; place: string; label: string }> = {
  health: { x: 50.7, y: 11, place: "Lille", label: "Santé" },
  housing: { x: 43, y: 26, place: "Paris", label: "Logement" },
  transport: { x: 64.8, y: 48, place: "Lyon", label: "Transports" },
  energy: { x: 70.5, y: 25, place: "Strasbourg", label: "Énergie" },
  education: { x: 24, y: 31, place: "Rennes", label: "Éducation" },
  administration: { x: 37.5, y: 56, place: "Bordeaux", label: "Démarches" },
};
export const presidencySectorIds = Object.keys(PRESIDENCY_PLACES) as PressureSectorId[];
const e = (value: string | number): string => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const n = (value: number, digits = 1): string => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
const stageNames = { stable: "Maîtrisé", watch: "Vigilance", strained: "Sous tension", disrupted: "Perturbé", crisis: "En crise" };
const months = ["Janvier–février", "Mars–avril", "Mai–juin", "Juillet–août", "Septembre–octobre", "Novembre–décembre"];
const finished = (game: Game): boolean => game.turn >= 30 || Boolean(game.politics?.ending);
const durableInService = (programme: PressureProgramme): boolean => programme.status === "completed" && !programme.duration
  && (Boolean(programme.appliedCapacity) || Boolean(programme.appliedNeed));
const visibleProgramme = (programme: PressureProgramme): boolean => programme.status === "preparing" || programme.status === "active" || durableInService(programme);

export function presidencyDate(game: Game, compact = game.version === 17): string {
  return finished(game) ? "Mandat terminé" : compact ? `Année ${Math.floor(game.turn / 6) + 1}` : `${months[game.turn % 6]} · année ${Math.floor(game.turn / 6) + 1}`;
}

function resources(game: Game): string {
  const p = game.presidency;
  const execution = game.pressure?.execution;
  const work = game.version === 17 ? strategyWorkReading(game) : undefined;
  const seats = game.politics?.blocs.reduce((sum, bloc) => sum + bloc.seats, 0) ?? 577;
  const support = game.politics?.blocs.filter(bloc => bloc.inGovernment).reduce((sum, bloc) => sum + bloc.seats, 0) ?? 0;
  const politicalResource = game.version === 17 ? `<div class="pr-resource pr-resource--seats" title="Appuis politiques mobilisables ; coalition de ${support} sièges sur ${seats}">${icon("government")}<span><small>Appuis politiques</small><strong data-live-seats data-live-support>${n(strategySupport(game), 0)} <em>/ 100</em></strong><i style="--pr-value:${strategySupport(game)}%"></i></span></div>` : `<div class="pr-resource pr-resource--seats" title="Les soutiens à l’Assemblée ne garantissent pas chaque vote">${icon("government")}<span><small>Coalition</small><strong data-live-seats>${support} <em>/ ${seats}</em></strong><i style="--pr-value:${support / Math.max(1, seats) * 100}%"></i></span></div>`;
  return `<div class="pr-resource" title="Crédits encore disponibles dans votre autorisation de dépense">${icon("coins")}<span><small>Crédits</small><strong data-live-reserve>${n(p?.reserve ?? 0)} <em>Md€</em></strong></span></div>
    <div class="pr-resource pr-resource--teams" title="Mobilisation de la dernière période ; travail prévu des chantiers en préparation, distinct des équipes déjà mobilisées">${icon("people")}<span><small>Équipes mobilisées</small><strong data-live-teams>${n(execution?.used ?? 0)} <em>/ ${n(execution?.capacity ?? 0)}</em></strong>${work?.planned ? `<small data-work-planned>${n(work.planned)} prévues</small>` : ""}</span></div>
    ${politicalResource}`;
}

export function presidencyShell(game: Game): string {
  return `<section class="presidency" data-presidency data-version="${game.version}" data-turn="${game.turn}" aria-label="Mandats, présidence vivante">
    <div class="pr-backdrop" aria-hidden="true"></div>
    <header class="pr-header">
      <a class="pr-brand" href="/mandats/" aria-label="Mandats, accueil">MANDATS<span></span></a>
      <div class="pr-calendar"><strong data-live-date>${e(presidencyDate(game))}</strong><span data-live-period>Période ${Math.min(30, game.turn + 1)} / 30</span></div>
      <div class="pr-clock" data-live-clock data-presidency-clock data-paused="true" data-turn="${game.turn}">
        <button type="button" class="pr-clock__toggle" data-action="presidency-pause" aria-label="Démarrer le temps" title="Démarrer ou mettre en pause">${icon("play")}</button>
        <div class="pr-speeds" aria-label="Vitesse du temps">${[1, 2, 4].map(speed => `<button type="button" data-action="presidency-speed" data-speed="${speed}" aria-pressed="${speed === 1}">×${speed}</button>`).join("")}</div>
        <div class="pr-clock__track" aria-hidden="true"><span data-live-progress></span></div>${game.version === 17 ? `<span class="pr-clock__countdown" data-live-tick-countdown>30 s</span>` : ""}
      </div>
      <div class="pr-resources" data-live-resources>${resources(game)}</div>
      <button type="button" class="pr-sound" data-action="presidency-sound" aria-pressed="false" aria-label="Activer les sons">Son</button>
      <button class="pr-menu" type="button" data-action="presidency-menu" aria-label="Ma partie">${icon("menu")}</button>
    </header>
    ${game.version === 17 ? `<div class="pr-strategy-brief" data-live-objective>${presidencyObjective(game)}</div>` : ""}
    <div class="pr-country" role="region" aria-label="Carte de France">
      <div class="pr-world" data-presidency-world>
        <img class="pr-art" src="/mandats/art/presidency-france-v2.webp" alt="France illustrée : villes, réseaux, reliefs et littoraux" data-presidency-art decoding="async" fetchpriority="high">
        <svg class="pr-links" viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-label="Perturbations entre secteurs" data-live-links></svg>
        <svg class="pr-crisis-effects" viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-label="Incidents et interventions" data-live-crisis-effects></svg>

      </div>
      <svg class="pr-pin-leaders" aria-hidden="true" data-pin-leaders></svg>
      <div class="pr-pins" data-live-pins></div><div class="pr-event-pins" data-live-event-pins></div>
      <div class="pr-fan-anchor" data-live-fan${game.version === 17 ? ' data-fan-docked="true"' : ""} hidden></div>
      <button type="button" class="pr-mapview" data-action="presidency-mapview" aria-pressed="false">Vue France</button>
      <p class="pr-map-caption">Repères illustratifs · situation nationale</p>
    </div>
    <aside class="pr-sectors" aria-label="Pression sur les services publics" data-live-sectors></aside>
    <span class="pr-visually-hidden" data-live-status>En pause</span>
    <div class="pr-newswire" role="status"><strong>ACTUALITÉS</strong><i aria-hidden="true"></i><span data-live-headline>Le pays attend vos décisions.</span>${game.version === 17 ? '<button type="button" data-action="presidency-bulletin" aria-label="Lire le bulletin complet">Lire le bulletin ›</button>' : ""}</div>

    <div class="pr-notice-slot" data-live-notice-slot></div>
    <div class="pr-feedback" role="status" aria-live="polite" data-live-feedback hidden></div>
    <div class="pr-panel-host" data-live-panel hidden></div>
    <div class="pr-visually-hidden" aria-live="polite" data-live-announcement></div>
  </section>`;
}

export function presidencyReadings(game: Game, selected: PressureSectorId | null): string {
  return (game.version === 17 ? `<p class="pr-pressure-legend" data-strategy-pressure>PRESSION <span>100 = danger maximal</span></p>` : "") + presidencySectorIds.map(id => {
    const front = game.pressure?.sectors[id];
    if (!front) return "";
    if (game.version === 17) return strategyReading(game, id, selected);
    const trend = front.pressureChange > .35 ? `+${n(front.pressureChange, 0)}` : front.pressureChange < -.35 ? n(front.pressureChange, 0) : "=";
    return `<button type="button" class="pr-sector" data-live-sector="${id}" data-presidency-front="${id}" data-action="presidency-sector" data-sector="${id}" data-stage="${front.stage}" aria-pressed="${selected === id}" aria-label="${e(PRESIDENCY_PLACES[id].label)}, pression ${n(front.pressure, 0)} sur 100, ${e(stageNames[front.stage])}">
      <span class="pr-sector__icon">${icon(id)}</span><span class="pr-sector__reading"><span>${e(PRESIDENCY_PLACES[id].label)}</span><strong>${e(stageNames[front.stage])}<small aria-hidden="true">${trend === "=" ? "" : trend}</small></strong><i style="--pr-value:${front.pressure}%" aria-hidden="true"></i></span>
    </button>`;
  }).join("");
}

export function presidencyPins(game: Game, selected: PressureSectorId | null): string {
  if (game.version === 17) return strategyPins(game, selected);
  if (finished(game)) return '';
  return presidencySectorIds.flatMap(id => {
    const front = game.pressure!.sectors[id], place = PRESIDENCY_PLACES[id];
    const crises = presidencyCrises(game).filter(c => c.sector === id && !c.id.startsWith('civil-') && c.status !== 'resolved');
    const programme = game.pressure!.programmes.filter(p => p.sector === id && visibleProgramme(p)).at(-1);
    if (!crises.length && selected !== id && !['disrupted','crisis'].includes(front.stage)) return [];
    return (crises.length ? crises : [undefined]).map(crisis => {
      const [x,y] = crisis ? crisisAnchor(crisis) : [place.x*10,place.y*5.625];
      const work = crisis ? game.pressure!.programmes.find(p => p.crisisId === crisis.id && ['preparing','active'].includes(p.status)) : programme;
      const preparing = work?.status === 'preparing';
      const containment = crisis?.status === 'contained' ? game.pressure!.programmes.find(p => p.crisisId === crisis.id && p.crisisOutcome === 'contain' && p.status === 'active' && p.endsTurn !== undefined && p.endsTurn > game.turn) : undefined;
      const due = crisis?.status === 'contained' ? containment?.endsTurn : crisis?.status === 'active' && crisisSeverity(crisis,game.turn) < 3 ? (crisis.stageStartedPeriod ?? crisis.startedPeriod) + crisis.deadline * crisisSeverity(crisis,game.turn) : undefined;
      const status = preparing ? 'Intervention en préparation' : crisis?.status === 'contained' ? 'Secours temporaire' : crisis ? 'Intervention nécessaire' : work ? 'En service · suivi' : stageNames[front.stage];
      const title = crisis ? crisisSpec(crisis).title : place.label;
      return `<button type="button" class="pr-pin pr-board-pin" data-pin-key="${e(crisis?.id ?? id)}" data-map-x="${x/10}" data-map-y="${y/5.625}" data-live-pin="${id}"${crisis ? ` data-crisis-id="${e(crisis.id)}" data-crisis-status="${crisis.status}"` : ''} data-action="presidency-sector" data-sector="${id}" data-stage="${crisis?.status === 'active' ? 'crisis' : front.stage}" data-selected="${selected === id}" aria-label="${e(title)} : ${e(status)}" aria-pressed="${selected === id}"><span class="pr-pin__symbol">${icon(crisis?.spec === 'port' ? 'port' : id)}</span><span class="pr-pin__label"><b>${e(crisis?.spec === 'port' ? 'Marseille · port' : place.place)}</b><strong>${e(title)}</strong><small>${e(status)}</small></span>${due !== undefined ? `<span class="pr-pin__countdown" data-crisis-due="${due}">${Math.max(0,due-game.turn)*(game.version === 17 ? 30 : 15)} s</span>` : ''}${preparing ? `<span class="pr-pin__work" data-delivery-state="preparing">${icon('clock')}</span>` : ''}</button>`;
    });
  }).join('');
}

export function presidencyRoutes(game: Game): string {
  return presidencyLinks(game).map(link => {
    const from = PRESIDENCY_PLACES[link.from], to = PRESIDENCY_PLACES[link.to];
    return `<g data-live-link="${link.from}-${link.to}" data-capacity-loss="${link.loss}"><title>${e(link.label)} · ${n(link.loss)} unité${link.loss > 1 ? "s" : ""} de capacité perdue</title><path d="M${from.x * 10} ${from.y * 5.625} Q${(from.x + to.x) * 5 + 25} ${(from.y + to.y) * 2.8125 - 20} ${to.x * 10} ${to.y * 5.625}"/><circle cx="${to.x * 10}" cy="${to.y * 5.625}" r="4"/></g>`;
  }).join("");
}

export function presidencyFeed(game: Game): string {
  if (game.version === 17) return strategyFeed(game);
  const initiatives = game.presidency?.initiatives.slice(-4).reverse() ?? [];
  const crisis = finished(game) ? undefined : game.politics?.pendingCrisis;
  const alert = crisis ? `<button type="button" class="pr-institutional" data-action="presidency-event" data-event="political-${e(crisis)}">${icon("government")}<span>Crise politique · décider sur la carte</span></button>` : "";
  return alert + (initiatives.length ? `<ol>${initiatives.map(item => `<li data-live-initiative="${e(item.id)}" data-initiative-status="${item.status}"><span class="pr-feed__symbol" data-kind="${item.status}">${icon(item.sector ?? "government")}</span><div><p><strong>${e(item.title)}</strong></p><small>${item.actor === "government" ? "Gouvernement" : "Présidence"} · P${item.period + 1}${item.cost ? ` · ${n(item.cost)} Md€` : ""}</small><p class="pr-feed__detail">${e(item.detail)}</p></div></li>`).join("")}</ol>` : `<p class="pr-feed__empty">${game.presidency?.autonomy ? "Les ministères préparent leurs interventions." : "Les ministères attendent vos consignes."}</p>`);
}

function command(choice: Choice, compact = false, version = 16): string {
  if (version === 17) return strategyCommand(choice, compact);
  const order = choice.presidencyOrder;
  const unavailable = order?.unavailable;
  const kind = choice.pressure?.kind;
  const symbol = kind === "relief" ? "people" : kind === "programme" ? "government" : "link";
  const title = choice.title;
  const price = order && (order.cost > 0 || choice.pressure) ? `${n(order.cost,2)} Md€ engagés${order.delay ? ` · ${order.delay*2} mois minimum` : ''}` : choice.political?.vote ? 'Soumis au vote de l’Assemblée' : choice.cost;
  const benefit = /modifie la trajectoire|dossiers suivants/i.test(choice.benefit) ? '' : choice.benefit;
  return `<button type="button" class="pr-command${compact ? " pr-command--compact" : ""}" data-action="presidency-order" data-presidency-order data-live-action="${e(choice.id)}" data-order="${e(choice.id)}"${choice.pressure?.crisisId ? ` data-crisis-response="${e(choice.pressure.crisisId)}"` : ""}${unavailable ? ` disabled aria-disabled="true"` : ""}>
    ${icon(symbol)}<span class="pr-command__body"><strong>${e(title)}</strong><span class="pr-command__price">${e(price)}</span>${!compact ? `<span class="pr-command__description">${e(choice.description)}</span><span class="pr-command__description">${e(choice.cost)}</span><span class="pr-command__description">${e(choice.benefit)}</span><small>${e(choice.sacrifice)}</small>` : ""}${compact && !choice.pressure?.crisisId && choice.cost !== price ? `<span class="pr-command__fiscal">${e(choice.cost)}</span>` : ""}${compact && choice.sacrifice ? `<small class="pr-command__sacrifice">${e(choice.sacrifice)}</small>` : ""}${unavailable ? `<small class="pr-command__unavailable">${e(unavailable)}</small>` : compact ? `<small>${e(benefit)}${choice.pressure?.duration ? ` · Effet pendant ${choice.pressure.duration * 2} mois.` : ""}</small>` : ""}</span>
  </button>`;
}

export function presidencyFan(game: Game, sector: PressureSectorId): string {
  if (game.version === 17) return strategyFan(game, sector);
  const front = game.pressure?.sectors[sector];
  const actions = finished(game) ? [] : presidencyActions(game, sector);
  const responses = actions.filter(choice => choice.pressure?.crisisId);
  const ordinary = actions.filter(choice => !choice.pressure?.crisisId);
  const hasIncident = presidencyCrises(game).some(c => c.sector === sector && c.status !== "resolved");
  const actionMarkup = hasIncident ? `${responses.length ? `<div class="pr-fan__actions">${responses.map(choice => command(choice, true)).join("")}</div>` : '<p class="pr-fan__empty">Les équipes préparent la réponse déjà financée.</p>'}<details class="pr-sector-development"><summary>Développer ce secteur</summary><div class="pr-fan__actions">${ordinary.map(choice => command(choice, true)).join("")}</div></details>` : `<div class="pr-fan__actions">${ordinary.map(choice => command(choice, true)).join("") || '<p class="pr-fan__empty">Les interventions disponibles sont déjà engagées.</p>'}</div>`;
  return `<section class="pr-fan" data-presidency-commands aria-label="Commandes : ${e(PRESIDENCY_PLACES[sector].label)}"><header><span class="pr-fan__title">${icon(sector)}<strong>${e(PRESIDENCY_PLACES[sector].label)}</strong></span><button type="button" data-action="presidency-deselect" aria-label="Fermer les commandes">${icon("close")}</button></header>${crisisBrief(game, sector)}${sectorProgress(game,sector)}${actionMarkup}<div class="pr-sector-priority">${finished(game) ? "" : command(presidencyPriorityChoice(game,sector),true)}</div>${front ? `<footer>Retard : ${n(front.backlog)} · capacité : ${n(front.effectiveCapacity)} / période</footer>` : ""}</section>`;
}

function sectorProgress(game: Game, sector: PressureSectorId): string {
  const programmes = game.pressure!.programmes.filter(p => p.sector === sector && (p.status === 'preparing' || p.status === 'active'));
  return programmes.map(p => `<div class="pr-work-progress" data-live-programme="${e(p.id)}" data-programme-state="${p.status}"><strong>${e(p.label)}</strong><span>${p.status === 'preparing' ? `En préparation · ${n(p.remainingWork)} unités de travail restantes` : `En service${p.endsTurn !== undefined ? ` jusqu’à la période ${p.endsTurn + 1}` : ''}`}</span>${p.status === 'preparing' && game.turn >= p.dueTurn ? '<small>Les chantiers partagent les équipes disponibles. Le financement reste engagé.</small>' : ''}</div>`).join('');
}

function government(game: Game): string {
  if (game.version === 17) return strategyGovernment(game);
  const p = game.presidency;
  const vote = game.politics?.lastVote;
  const credits = presidencyCreditsChoice(game);
  const political = presidencyPoliticalActions(game);
  return `<p class="pr-panel__intro">Vos ministères partagent vos crédits et vos équipes. Les initiatives ordinaires sont limitées à 0,4 Md€ ; une priorité nationale les autorise à préparer un investissement plus important.</p>${political.length ? `<section class="pr-political" data-live-political><h3>Arbitrage institutionnel</h3>${political.map(choice => command(choice)).join("")}</section>` : ""}<div class="pr-cabinet-controls"><button type="button" class="pr-setting" data-action="presidency-order" data-presidency-order data-order="live-autonomy" aria-pressed="${p?.autonomy ?? false}"${finished(game) ? " disabled" : ""}><span>${icon("government")}<strong>Initiatives des ministres</strong></span><b>${p?.autonomy ? "Autorisées" : "Suspendues"}</b><small>${p?.autonomy ? "Les ministres peuvent engager les interventions opérationnelles permises par votre enveloppe." : "Les ministres exécutent les chantiers engagés ; vous décidez des nouveaux engagements."}</small></button><dl class="pr-budget"><div><dt>Autorisation de dépense</dt><dd>${n(p?.authorised ?? 0)} Md€</dd></div><div><dt>Engagements cumulés</dt><dd>${n(p?.spent ?? 0)} Md€</dd></div><div><dt>Crédits disponibles</dt><dd>${n(p?.reserve ?? 0)} Md€</dd></div></dl>${`<button type="button" class="pr-wide-action" data-action="presidency-order" data-presidency-order data-order="live-credits"${credits.presidencyOrder?.unavailable || finished(game) ? " disabled" : ""}>${icon("government")}<span><strong>Demander 10 Md€ de crédits supplémentaires</strong><small>${e(credits.presidencyOrder?.unavailable ?? "Autorisation soumise au vote de l’Assemblée · une demande par an")}</small></span></button>`}</div>${accountsAndTeams(game)}<h3>Chantiers et interventions</h3>${projects(game)}${vote ? `<section class="pr-vote" data-live-vote data-vote-passed="${vote.passed}"><h3>Dernier vote · ${vote.passed ? "Adopté" : "Rejeté"}</h3><p>${e(vote.title)}</p><dl><div><dt>Pour</dt><dd>${vote.for}</dd></div><div><dt>Contre</dt><dd>${vote.against}</dd></div><div><dt>Abstentions</dt><dd>${vote.abstain}</dd></div></dl>${vote.consequences.map(item => `<p class="pr-panel__note">${e(item)}</p>`).join("")}</section>` : ""}<p class="pr-panel__note">Les enveloppes et capacités sont des hypothèses de simulation. Ces crédits ne représentent pas la trésorerie de l’État.</p>`;
}

function accountsAndTeams(game: Game): string {
  const ledger = presidencyLedger(game), p = game.presidency!, execution = game.pressure!.execution;
  const closed = game.turn > 0 && game.turn % 6 === 0 && p.preparedYear === Math.floor(game.turn / 6);
  const calendarYear = Math.min(5, Math.floor(game.turn / 6) + 1);
  const year = game.version === 17 ? p.preparedYear : closed ? Math.ceil(game.turn / 6) : calendarYear;
  const accountDate = game.version === 17 ? (closed ? `Comptes clos de l’année ${year}` : `Prévision de l’année ${year}`) : `${closed ? "Exercice clos" : "Prévision annuelle"} · année ${year}`;
  const accountNote = game.version === 17 ? (closed ? (game.turn < 30 ? `L’année ${calendarYear} commence. Ces comptes enregistrent l’exercice de l’année ${year}, qui vient de se terminer.` : `Le mandat est terminé. Ces comptes enregistrent l’exercice clos de l’année ${year}.`) : `Prévision de l’exercice en cours, année ${year}. Les périodes écoulées sont comptabilisées ; les périodes restantes sont projetées aux conditions actuelles.`) : closed ? "Comptes enregistrés à la clôture de l’année." : "Les périodes écoulées sont comptabilisées ; les périodes restantes sont projetées aux conditions actuelles.";
  const spending = ledger.operating + ledger.interest + ledger.investment + ledger.grants;
  const lines: Array<[string, string, number]> = [
    ["revenue", "Recettes", ledger.revenue], ["spending", "Dépenses, intérêts inclus", spending],
    ["deficit", "Déficit", ledger.deficit], ["debt", "Dette en fin d’exercice", ledger.debt],
  ];
  return `<details class="pr-accounts" data-live-disclosure="accounts"><summary>Comptes et équipes</summary><div class="pr-accounts__body"><h3>${e(accountDate)}</h3><dl class="pr-accounts__numbers" data-live-accounts data-accounts-status="${closed ? "closed" : "forecast"}" data-accounts-year="${year}">${lines.map(([id, label, value]) => `<div><dt>${label}</dt><dd data-account="${id}" data-value="${value}">${n(value, 2)} <small>Md€</small></dd></div>`).join("")}</dl><p class="pr-panel__note">${e(accountNote)} L’autorisation de dépense ci-dessus reste distincte de ces comptes nationaux simulés.</p><h3>Équipes de mise en œuvre</h3><dl class="pr-accounts__numbers" data-live-execution><div><dt>Capacité mobilisée / disponible</dt><dd data-execution-used="${execution.used}" data-execution-capacity="${execution.capacity}">${n(execution.used, 2)} / ${n(execution.capacity, 2)}</dd></div>${game.version === 17 ? `<div><dt>Travail prévu pour la prochaine période</dt><dd data-execution-planned>${n(strategyWorkReading(game).planned,2)} unités demandées · capacité ${n(execution.capacity,2)}</dd></div><div><dt>Travail restant à préparer</dt><dd>${n(strategyWorkReading(game).remaining,2)} unités</dd></div>` : ""}<div><dt>Chantiers en attente de mise en service</dt><dd data-execution-waiting="${execution.waiting}">${n(execution.waiting, 0)}</dd></div></dl><p class="pr-panel__note">Le travail prévu partage la capacité disponible et peut attendre ; il ne s’ajoute pas à la mobilisation de la période écoulée. Unités d’exécution partagées entre les chantiers ; il ne s’agit pas d’un nombre d’agents publics.</p></div></details>`;
}

function projects(game: Game): string {
  const programmes = game.pressure?.programmes.filter(visibleProgramme) ?? [];
  const signed = (value: number) => `${value > 0 ? "+" : ""}${n(value)}`;
  return programmes.length ? `<ul class="pr-projects">${programmes.map(item => `<li data-live-programme="${e(item.id)}" data-programme-state="${item.status}"><span class="pr-projects__symbol">${icon(item.sector)}</span><div><strong>${e(item.label)}</strong><p>${item.status === "preparing" ? `En préparation · ${n(item.remainingWork)} unités de travail restantes · au plus tôt période ${item.dueTurn + 1}` : `En service${item.endsTurn === undefined ? (item.appliedCapacity ? " · capacité durable" : " · effet durable") : ` · fin période ${item.endsTurn + 1}`}`}</p>${item.status !== "preparing" && (item.appliedCapacity || item.appliedNeed) ? `<p data-applied-capacity="${item.appliedCapacity ?? 0}" data-applied-need="${item.appliedNeed ?? 0}">${[item.appliedCapacity ? `Capacité ${signed(item.appliedCapacity)}` : "", item.appliedNeed ? `Besoins ${signed(item.appliedNeed)}` : ""].filter(Boolean).join(" · ")} par période</p>` : ""}</div><span>${item.status === "preparing" ? "Préparation" : "En service"}</span></li>`).join("")}</ul>` : '<p class="pr-panel__note">Aucune intervention en préparation ou en service.</p>';
}

function reforms(game: Game): string {
  if (game.version === 17) return strategyReforms(game);
  const list = presidencyReforms(game);
  return `<p class="pr-panel__intro">Engagez un dossier quand vous le souhaitez. Les lois passent devant l’Assemblée ; un texte rejeté n’engage aucun de ses effets.</p>${lastVote(game)}<details class="pr-vote-help"><summary>Comprendre les soutiens avant un vote</summary><p>${e(strategyPoliticalReading(game))}</p></details><div class="pr-reforms">${list.map(reform => `<details class="pr-reform" data-live-reform="${e(reform.id)}"><summary><span>${icon("administration")}<strong>${e(reform.title)}</strong></span><span class="pr-reform__chevron" aria-hidden="true">+</span></summary><div class="pr-reform__choices">${reform.choices.map(choice => command(choice)).join("")}</div></details>`).join("") || `<p class="pr-panel__note">${finished(game) ? "Le mandat est terminé. Aucun nouveau dossier ne peut être engagé." : "Tous les dossiers de réforme disponibles ont été examinés."}</p>`}</div>${game.presidency?.reforms.length ? `<h3>Dossiers examinés</h3><ul class="pr-reform-history">${game.presidency.reforms.map(item => `<li><strong>${e(NATIONAL_AGENDA.find(reform => reform.id === item.id)?.dossier.title ?? item.id)}</strong><span>${item.adopted ? "Adopté" : "Rejeté"} · période ${item.period + 1}</span></li>`).join("")}</ul>` : ""}`;
}

function priorities(game: Game): string {
  if (game.version === 17) return strategyObjectives(game);
  const priority = game.presidency?.priority;
  return `<p class="pr-panel__intro">Une priorité oriente les prochaines initiatives de vos ministres. Elle reste active jusqu’à votre prochaine consigne.</p><div class="pr-priorities">${presidencySectorIds.map(id => `<button type="button" class="pr-priority" data-action="presidency-order" data-presidency-order data-presidency-priority="${id}" data-order="live-priority-${id}" aria-pressed="${priority === id}"${finished(game) ? " disabled" : ""}>${icon(id)}<strong>${e(PRESIDENCY_PLACES[id].label)}</strong><small>${priority === id ? "Priorité nationale · toucher pour retirer" : "Définir comme priorité nationale"}</small>${priority === id ? icon("check", "pr-priority__check") : ""}</button>`).join("")}</div><p class="pr-panel__note">${priority ? `${e(PRESIDENCY_PLACES[priority].label)} : le gouvernement privilégie ce secteur parmi ses interventions possibles, dans la limite de ses moyens.` : "Sans priorité nationale, le gouvernement intervient selon les tensions du pays."}</p>`;
}

export function presidencyPanel(game: Game, panel: PresidencyPanel, comparison = ""): string {
  if (game.version === 17) return strategyPanel(game, panel, comparison);
  const title = { reforms: "Les grandes réformes", government: "Votre gouvernement", priorities: "Le cap du mandat", bulletin: "Bulletin du pays", ending: game.politics?.ending?.title ?? "Cinq ans à la présidence" }[panel];
  const ending = `<p class="pr-ending-outcome" data-ending-kind="${game.politics?.ending?.kind ?? "term_complete"}">${game.politics?.ending && game.politics.ending.kind !== "term_complete" ? "Défaite · mandat interrompu" : "Mandat achevé · cinq ans à la présidence"}</p><p class="pr-panel__intro">${e(game.politics?.ending?.reason ?? "Le mandat est terminé. Voici le pays que vos choix et votre gouvernement ont façonné.")}</p>${game.politics?.ending?.causes.length ? `<ol class="pr-ending-causes">${game.politics.ending.causes.map(c=>`<li>${e(c)}</li>`).join("")}</ol>` : ""}<div class="pr-ending-readings">${presidencySectorIds.map(id => `<div>${icon(id)}<span>${e(PRESIDENCY_PLACES[id].label)}</span><strong>${n(game.pressure?.sectors[id].pressure ?? 0, 0)}<small> / 100</small></strong></div>`).join("")}</div><h3>Les dernières décisions</h3>${presidencyFeed(game)}${projects(game)}<button type="button" class="pr-wide-action" data-action="presidency-menu">${icon("menu")}<strong>Ma partie · exporter ou recommencer</strong></button>`;
  return `<div class="pr-panel-scrim" data-action="presidency-close"></div><section class="pr-panel" role="dialog" aria-modal="true" aria-labelledby="pr-panel-title" data-presidency-panel="${panel}"><header class="pr-panel__header"><div><p>Présidence de la République</p><h2 id="pr-panel-title" tabindex="-1">${e(title)}</h2></div><button type="button" data-action="presidency-close" aria-label="Fermer et revenir au pays">${icon("close")}</button></header><div class="pr-panel__body">${panel === "government" ? government(game) : panel === "reforms" ? reforms(game) : panel === "priorities" ? priorities(game) : ending}${comparison && (panel === "government" || panel === "ending") ? `<section class="pr-comparison" data-live-comparison>${comparison}</section>` : ""}</div><footer class="pr-panel__footer">${icon("pause")}<span>Le pays est en pause pendant votre lecture.</span></footer></section>`;
}

export { resources as presidencyResources };

export { crisisAlerts };

/** Reforms and institutional choices use the same board interaction as incidents. */
const eventNames = { reform:'Réforme', political:'Institutions', budget:'Budget', government:'Gouvernement', followup:'Suivi' };
export function presidencyEventPins(game: Game): string {
 return presidencyEvents(game).filter(event => game.version !== 17 || !['reform', 'followup', 'government'].includes(event.kind)).filter(event=>event.kind !== 'followup' || !presidencyCrises(game).some(c=>c.sector===event.sector && !c.id.startsWith('civil-') && c.status!=='resolved')).map((event,i)=>{
   const civil = event.id.startsWith('civil-');
   const shortTitle = event.kind === 'government' ? 'Matignon' : event.kind === 'reform' ? NATIONAL_AGENDA.find(r=>r.id===event.id)?.dossier.category ?? event.title : event.title;
   const x = civil ? 44 : event.kind === 'budget' ? 37 : event.kind === 'government' ? 48 : event.kind === 'political' || event.kind === 'reform' ? 44 : PRESIDENCY_PLACES[event.sector].x;
   const y = civil ? 34.7 : event.kind === 'budget' ? 57 : event.kind === 'government' ? 38 : event.kind === 'political' || event.kind === 'reform' ? 26 + i*3 : PRESIDENCY_PLACES[event.sector].y;
   const symbol = event.kind === 'budget' ? 'coins' : event.kind === 'reform' ? 'administration' : event.kind === 'followup' ? 'clock' : 'government';
   return `<button type="button" class="pr-pin pr-board-pin pr-event-pin" data-pin-key="${e(event.id)}" data-map-x="${x}" data-map-y="${y}" data-event-kind="${event.kind}" data-live-event-pin="${e(event.id)}"${civil ? ` data-crisis-id="${e(event.id)}"` : ''} data-action="presidency-event" data-event="${e(event.id)}" aria-label="${e(eventNames[event.kind])} : ${e(event.title)}"><span class="pr-pin__symbol">${icon(symbol)}</span><span class="pr-pin__label"><b>${e(eventNames[event.kind])}${event.kind === 'reform' ? ' · Assemblée' : ''}</b><strong>${e(shortTitle)}</strong><small>${event.kind === 'followup' ? 'Voir l’avancement' : event.kind === 'government' ? 'Ministres et engagements' : game.version === 17 && event.kind === 'budget' ? 'Option de financement' : 'Décision à prendre'}</small></span>${event.deadline !== undefined ? `<span class="pr-pin__countdown" data-crisis-due="${event.deadline}">${Math.max(0,event.deadline-game.turn)*(game.version === 17 ? 30 : 15)} s</span>` : ''}</button>`;
 }).join('');
}
export function presidencyEventAlerts(game: Game): string { return ''; }
export function presidencyEventFan(game: Game,id: string): string {
 const event=presidencyEvents(game).find(item=>item.id===id);
 if(!event) return '';
 if (game.version === 17) return `<section class="pr-fan pr-event-fan pr-strategy-fan" data-presidency-event="${e(id)}" aria-label="${e(event.title)}"><header><span class="pr-fan__title">${icon(event.kind === 'budget' ? 'coins' : 'government')}<strong>${e(event.title)}</strong></span><button type="button" data-action="presidency-deselect" aria-label="Fermer les commandes">${icon('close')}</button></header><div class="pr-event-brief"><p>${e(event.detail)}</p>${game.version === 17 && id === "s17-national-recovery" ? `<nav class="pr-strategy-sector-links" aria-label="Services en crise">${presidencySectorIds.filter(sector => strategySectorReading(game, sector).severity === "critical").map(sector => `<button type="button" data-action="presidency-sector" data-sector="${sector}">${icon(sector)}${e(PRESIDENCY_PLACES[sector].label)} · en crise</button>`).join("")}</nav><p>Les interventions sectorielles rétablissent les services. Un compromis de coalition soutient la capacité politique.</p>` : ""}${event.deadline !== undefined ? `<p>Fenêtre de redressement : ${Math.max(0, event.deadline - game.turn) * 2} mois.</p>` : ''}</div><div class="pr-fan__actions">${event.choices.map(choice => strategyCommand(choice, true)).join('')}</div>${lastVote(game)}</section>`;
 return `<section class="pr-fan pr-event-fan" data-presidency-event="${e(id)}" aria-label="${e(event.title)}"><header><span class="pr-fan__title">${icon(event.kind==='reform'?'administration':'government')}<strong>${e(eventNames[event.kind])}</strong></span><button type="button" data-action="presidency-deselect" aria-label="Fermer les commandes">${icon('close')}</button></header><div class="pr-event-brief"><strong>${e(event.title)}</strong>${event.reason ? `<p>${e(event.reason)}</p><details class="pr-event-context"><summary>Contexte et conséquences</summary><p>${e(event.detail)}</p></details>` : `<p>${e(event.detail)}</p>`}${event.progress !== undefined ? `<div class="pr-event-progress"><progress max="1" value="${event.progress}" aria-label="Avancement de l’intervention"></progress><span>${Math.round(event.progress*100)} % ${event.status === 'delivered' ? '· en service' : '· mise en œuvre'}</span></div>` : ''}</div><div class="pr-fan__actions">${event.choices.filter(choice=>event.kind !== 'government' || choice.id === 'live-autonomy').map(choice=>command(choice,true,game.version)).join('') || '<p class="pr-fan__empty">Votre décision est enregistrée. Suivez sa mise en œuvre sur la carte.</p>'}</div>${['government','budget'].includes(event.kind) ? lastVote(game) : ''}${event.kind === 'government' ? `<details class="pr-board-history"><summary>Préparer les moyens du gouvernement</summary>${presidencyBudgetChoices(game).map(choice=>command(choice,true,game.version)).join('')}</details>${accountsAndTeams(game)}${projects(game)}<details class="pr-board-history"><summary>Décisions récentes</summary>${presidencyFeed(game)}</details>` : ''}</section>`;
}

function lastVote(game: Game): string {
 const vote=game.politics?.lastVote;
 return vote ? `<section class="pr-vote pr-board-vote" data-live-vote data-vote-passed="${vote.passed}"><strong>${vote.passed ? 'Accord adopté' : 'Proposition rejetée'}</strong><p>${e(vote.title)}</p><span>${vote.for} pour · ${vote.against} contre · ${vote.abstain} abstentions</span><p>Seuil requis : ${vote.threshold} voix pour · majorité des suffrages exprimés pour une loi.</p>${vote.consequences.map(item => `<p>${e(item)}</p>`).join("")}<p>La discipline et les abstentions peuvent changer au prochain vote. Les appuis d’action ne garantissent pas une majorité.</p>${game.version === 17 ? `<p>${e(presidencyCreditsChoice(game).presidencyOrder?.unavailable ?? "Une demande d’autorisation peut être présentée cette année.")} ${strategyState(game).lastParliamentPeriod === game.turn ? "Prochain examen d’un autre texte : à partir de la prochaine période (deux mois), selon ses conditions." : "Un autre texte peut être présenté dès cette période, selon ses conditions."}</p>` : ""}${game.version === 17 ? `<details><summary>Résultat par groupe parlementaire</summary>${vote.groups.map(group => `<p><strong>${e(group.label)}</strong> : ${group.for} pour · ${group.against} contre · ${group.abstain} abstentions</p>`).join("")}</details>` : ""}</section>` : '';
}

/* V17 presentation reads saved strategy state. No progression or verdict rules live here. */
const strategyPhaseNames = { opening: "Prendre le cap", coordination: "Coordonner le pays", transformation: "Transformer", legacy: "Faire durer" };
const strategyStageNames = { normal: "Service assuré", warning: "Première alerte", accumulation: "Retards accumulés", organisation: "Organisation sous tension", conflict: "Conflit ouvert", national: "Arbitrage national" };

export function presidencyObjective(game: Game): string {
  if (game.version !== 17) return "";
  const state = strategyState(game), result = strategyOutcome(game);
  const priority = game.presidency?.priority;
  const objective = strategyObjectiveReading(game);
  return `<button type="button" class="pr-strategy-cap" data-action="presidency-panel" data-panel="priorities" aria-label="Objectifs du mandat et consignes persistantes"><span class="pr-strategy-cap__eyebrow" data-strategy-phase="${state.phase}"><span class="pr-strategy-cap__phase">${e(strategyPhaseNames[state.phase])}</span> <span>${result.objectives.filter(goal => goal.met).length} / ${result.objectives.length} objectifs actuellement atteints</span></span><strong>${e(objective.title)}</strong><small class="pr-strategy-cap__detail">${e(objective.detail)}</small><small>${priority ? `Priorité : ${e(PRESIDENCY_PLACES[priority].label)}` : "Les ministres gèrent le quotidien · choisissez votre cap"}</small></button><nav class="pr-strategy-controls" aria-label="Actions présidentielles"><button type="button" data-action="presidency-panel" data-panel="reforms">${icon("administration")}<span>Réformes</span></button><button type="button" data-action="presidency-panel" data-panel="government">${icon("government")}<span>Cabinet</span></button>${projectionControl()}<span id="pr-projection-description" class="pr-visually-hidden">Cette commande simule les périodes, ne donne aucun ordre. Le temps reste en pause après le prochain changement.</span></nav>`;
}

function strategyReading(game: Game, id: PressureSectorId, selected: PressureSectorId | null): string {
  const front = game.pressure!.sectors[id], sector = strategyState(game).sectors[id], reading = strategySectorReading(game, id);
  const trend = front.pressureChange > .35 ? `${icon("trend-up")} +${n(front.pressureChange, 1)}` : front.pressureChange < -.35 ? `${icon("trend-down")} ${n(front.pressureChange, 1)}` : icon("trend-steady");
  return `<button type="button" class="pr-sector" data-live-sector="${id}" data-presidency-front="${id}" data-action="presidency-sector" data-sector="${id}" data-stage="${front.stage}" data-strategy-stage="${sector.phase}" data-severity="${reading.severity}" data-trend="${reading.trend}" data-working="${reading.working}" aria-pressed="${selected === id}" aria-label="${e(PRESIDENCY_PLACES[id].label)}, pression ${n(front.pressure, 0)} sur 100, ${e(reading.limited ? "Limite opérationnelle" : strategyStageNames[sector.phase])}. 100 signifie danger maximal."><span class="pr-sector__icon">${icon(id)}</span><span class="pr-sector__reading"><span>${e(PRESIDENCY_PLACES[id].label)}</span><strong><b>${n(front.pressure, 0)}<em>/100</em></b><small aria-hidden="true">${trend}</small></strong><i style="--pr-value:${front.pressure}%" aria-hidden="true"></i><small class="pr-sector__stage">${e(reading.limited ? "Limite opérationnelle" : strategyStageNames[sector.phase])}</small></span></button>`;
}

function strategyCommand(choice: Choice, compact: boolean, primary = false): string {
  const order = choice.presidencyOrder, unavailable = order?.unavailable;
  const directive = /^live-(priority-|autonomy)/.test(choice.id);
  const delay = directive ? "Consigne immédiate" : order ? (order.delay ? `${order.delay * 2} mois minimum` : choice.political?.action === "enact" ? "Vote à l’Assemblée" : "Application sans chantier") : "Selon accord ou vote";
  const cost = directive ? "Aucun engagement immédiat" : order ? `${n(order.cost, 2)} Md€ engagés` : choice.cost;
  const actionTitle = choice.title;
  const distinct = (values: string[]) => [...new Set(values.filter(Boolean))];
  const extra = distinct([choice.sacrifice, choice.description]).filter(text => text !== choice.benefit && text !== choice.cost);
  const annual = choice.effect.operating ?? choice.effect.temporaryOperating;
  const fiscal = primary ? choice.cost.match(/\d+ points d’appui politique/)?.[0] ?? "" : choice.cost;
  const networkSector = choice.id.match(/^s17-(health|housing|transport|energy|education|administration)-network$/)?.[1] as PressureSectorId | undefined;
  const linkedSectors = networkSector ? STRATEGY_SECTORS[networkSector].network.spillovers?.map(item => PRESIDENCY_PLACES[item.sector].label).join(", ") : "";
  const primaryEffect = networkSector && compact ? `${choice.pressure?.capacity ? `Capacité +${n(choice.pressure.capacity)}. ` : ""}Liens : ${linkedSectors}.` : compact ? choice.benefit.split(/\.(?:\s+|$)/).filter(Boolean).slice(0, 2).join(". ") + "." : choice.benefit;
  return `<button type="button" class="pr-command pr-strategy-command${primary ? " pr-strategy-command--primary" : ""}${compact ? " pr-command--compact" : ""}" data-action="presidency-order" data-presidency-order data-live-action="${e(choice.id)}" data-order="${e(choice.id)}"${choice.pressure?.crisisId ? ` data-crisis-response="${e(choice.pressure.crisisId)}"` : ""}${unavailable ? " disabled aria-disabled=\"true\"" : ""}><span class="pr-command__body"><strong>${e(actionTitle)}</strong><span class="pr-command__price" data-order-cost>${e(cost)}</span><span class="pr-command__terms"><span data-order-delay>${e(delay)}</span>${!directive && order?.implementation ? `<span>${n(order.implementation)} unité${order.implementation > 1 ? "s" : ""} d’équipes</span>` : ""}</span>${annual !== undefined ? `<span class="pr-command__fiscal" data-order-annual>${annual < 0 ? "Économie" : "Puis"} ${n(Math.abs(annual), 2)} Md€/an${choice.pressure ? " à la mise en service" : ""}</span>` : ""}${!directive && fiscal && choice.cost !== cost ? `<span class="pr-command__fiscal">${e(fiscal)}</span>` : ""}<span class="pr-command__effect" data-order-effect>${e(primaryEffect)}</span>${!compact ? extra.map(text=>`<p class="pr-command__description">${e(text)}</p>`).join("") : ""}${unavailable ? `<small class="pr-command__unavailable">${e(unavailable)}</small>` : `<span class="pr-command__cta">${directive ? "Appliquer la consigne" : choice.political?.action === "enact" ? "Soumettre au vote" : "Engager cette intervention"} <span aria-hidden="true">→</span></span>`}</span></button>${compact && !directive && !primary ? `<details class="pr-strategy-action-details" data-live-disclosure="action-${e(choice.id)}"><summary>Effets, conditions et contreparties</summary>${distinct([...extra,choice.benefit]).filter(text=>text !== primaryEffect).map(text=>`<p>${e(text)}</p>`).join("")}</details>` : ""}`;
}

function strategyFan(game: Game, sectorId: PressureSectorId): string {
  const state = strategyState(game).sectors[sectorId], front = game.pressure!.sectors[sectorId];
  const reading = strategySectorReading(game, sectorId);
  const actions = finished(game) ? [] : presidencyActions(game, sectorId);
  const available = actions.filter(choice => !choice.presidencyOrder?.unavailable), unavailable = actions.filter(choice => choice.presidencyOrder?.unavailable);
  const routine = { idle: "Le ministère prépare ses moyens ordinaires.", preparing: "Les équipes préparent l’opération déléguée.", operational: "L’opération déléguée assure le quotidien.", limited: "Le secours atteint ses limites : une transformation est nécessaire." }[state.routine.status];
  const priority = game.presidency?.priority === sectorId;
  return `<section class="pr-fan pr-strategy-fan" data-fan-docked="true" data-presidency-commands aria-label="Commandes : ${e(PRESIDENCY_PLACES[sectorId].label)}"><header><span class="pr-fan__title">${icon(sectorId)}<span><small>${e(PRESIDENCY_PLACES[sectorId].label)}</small><strong>${e(STRATEGY_SECTORS[sectorId].label)}</strong></span></span><button type="button" data-action="presidency-deselect" aria-label="Fermer les commandes">${icon("close")}</button></header><div class="pr-strategy-situation" data-strategy-sector="${sectorId}" data-strategy-stage="${state.phase}"><p class="pr-strategy-situation__stage">${e(reading.limited ? "Limite opérationnelle" : strategyStageNames[state.phase])}<strong>Pression ${n(front.pressure, 0)} / 100</strong></p><p class="pr-strategy-situation__cause">${e(reading.reason)}</p></div><div class="pr-strategy-primary" data-strategy-primary>${available.slice(0, 2).map(choice => strategyCommand(choice, true, true)).join("")}</div><details class="pr-strategy-primary-details" data-live-disclosure="primary-${sectorId}"><summary>Comprendre les approches proposées</summary>${available.slice(0, 2).map(choice => `<section><strong>${e(choice.title)}</strong>${[...new Set([choice.description,choice.cost,choice.benefit,choice.sacrifice].filter(Boolean))].map(text=>`<p>${e(text)}</p>`).join("")}</section>`).join("")}</details><div class="pr-fan__actions">${available.slice(2).map(choice => strategyCommand(choice, true)).join("") || (!available.length ? '<p class="pr-fan__empty">Les engagements sont en cours. Leurs effets apparaissent à la livraison.</p>' : "")}</div>${unavailable.length ? `<details class="pr-strategy-locked" data-live-disclosure="locked-${sectorId}"><summary>Interventions engagées et autres conditions (${unavailable.length})</summary>${unavailable.map(choice => strategyCommand(choice, true)).join("")}</details>` : ""}<button type="button" class="pr-strategy-priority" data-action="presidency-order" data-presidency-order data-presidency-priority="${sectorId}" data-order="live-priority-${sectorId}" aria-pressed="${priority}"${finished(game) ? " disabled" : ""}>${icon(priority ? "check" : "government")}<span><strong>${priority ? "Priorité présidentielle active" : "Donner la priorité à ce secteur"}</strong><small>${priority ? "Consigne persistante · toucher pour retirer" : "Les équipes préparent ce secteur avant les autres chantiers ; les autres attendent."}</small><small class="pr-strategy-priority__terms"><span data-order-cost>Sans nouvel engagement</span> · <span data-order-delay>Consigne immédiate</span></small><small data-order-effect>Donne d’abord les équipes aux chantiers de ce secteur, sans augmenter les moyens disponibles.</small></span></button><div class="pr-strategy-ministry" data-strategy-routine="${state.routine.status}">${icon("government")}<span><strong>Votre ministère</strong><span>${e(routine)}</span>${state.routine.committed ? `<small>${n(state.routine.committed, 2)} Md€ engagés · ${n(state.routine.annualOperating, 2)} Md€ / an</small>` : ""}</span></div><details class="pr-strategy-explanation" data-live-disclosure="sector-${sectorId}"><summary>Causes, risques et moyens du secteur</summary><p>${e(state.cause)}</p><p class="pr-strategy-situation__warning">${e(reading.reason)}</p><p class="pr-strategy-forecast-note">${e(state.demandReason)} Charge supplémentaire annoncée en fin de mandat : +${n(state.demandForecast.at(-1) ?? 0, 1)} unités par période ; +${n(state.appliedDemand, 1)} actuellement.</p><dl><div><dt>Retard acquis</dt><dd>${n(front.backlog)}</dd></div><div><dt>Capacité effective / période</dt><dd>${n(front.effectiveCapacity)}</dd></div><div><dt>Fatigue des équipes</dt><dd>${n(front.fatigue, 0)} / 100</dd></div></dl><p>${e(state.minister.mandate)}</p>${state.transformations.length ? `<p>Transformations en service : ${state.transformations.map(item => e(item.title)).join(" ; ")}.</p>` : ""}</details>${sectorProgress(game, sectorId)}<footer>Pression : 100 = danger maximal · les chantiers partagent les équipes.</footer></section>`;
}

function strategyFeed(game: Game): string {
  const items = game.presidency?.initiatives ?? [];
  const receipts = strategyCausalReceipts(game);
  // A delegated operation is one ongoing activity, not a fresh presidential task on every renewal.
  const seen = new Set<string>();
  const material = items.slice().reverse().filter(item => {
    const key = `${item.actor}:${item.sector ?? "national"}:${item.title}:${item.status}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 6);
  return material.length ? `<ol class="pr-strategy-activity">${material.map(item => `<li data-live-initiative="${e(item.id)}" data-initiative-status="${item.status}"><span class="pr-feed__symbol" data-kind="${item.status}">${icon(item.sector ?? "government")}</span><div><strong>${e(item.title)}</strong><small>${item.actor === "government" ? "Ministère" : "Présidence"} · ${e(strategyEventDate(item.period))}${item.cost ? ` · ${n(item.cost, 2)} Md€` : ""}</small><p class="pr-feed__detail">${e(item.detail)}${item.status === "delivered" ? ` ${e(receipts.find(receipt=>receipt.choice===item.choice && receipt.deliveredPeriod===item.period)?.effect ?? "")}` : ""}</p></div></li>`).join("")}</ol>` : '<p class="pr-feed__empty">Le cabinet est constitué. Les ministres préparent les opérations ordinaires.</p>';
}

function strategyGovernment(game: Game): string {
  const state = strategyState(game), result = strategyOutcome(game);
  const autonomy = game.presidency?.autonomy;
  return `<p class="pr-panel__intro">Le quotidien est délégué. Vous fixez le cap et arbitrez les transformations ; les ministres utilisent les mêmes crédits et les mêmes équipes.</p><button type="button" class="pr-setting" data-action="presidency-order" data-presidency-order data-order="live-autonomy" aria-pressed="${autonomy}"${finished(game) ? " disabled" : ""}><span>${icon("government")}<strong>Initiatives ministérielles</strong></span><b>${autonomy ? "Autorisées" : "Suspendues"}</b><small>${autonomy ? "Les opérations ordinaires se poursuivent sans renouvellement manuel." : "Les chantiers déjà engagés continuent. Les nouveaux engagements attendent votre autorisation."}</small></button><div class="pr-strategy-ministers">${presidencySectorIds.map(id => { const sector = state.sectors[id]; return `<section data-strategy-minister="${id}"><h3>${icon(id)}${e(PRESIDENCY_PLACES[id].label)}</h3><p>${e(sector.minister.mandate)}</p><dl><div><dt>Compétence du cabinet</dt><dd>${n(sector.minister.competence, 0)} %</dd></div><div><dt>Mission déléguée</dt><dd>${e({ idle: "Préparation", preparing: "Mise en œuvre", operational: "En service", limited: "Arbitrage nécessaire" }[sector.routine.status])}</dd></div></dl></section>`; }).join("")}</div><h3>Moyens politiques</h3><dl class="pr-strategy-political"><div><dt>Appuis mobilisables</dt><dd>${n(strategySupport(game), 0)} / 100</dd></div><div><dt>Sièges de la coalition</dt><dd>${game.politics?.blocs.filter(bloc => bloc.inGovernment).reduce((sum, bloc) => sum + bloc.seats, 0) ?? 0} / 577</dd></div><div><dt>Confiance populaire</dt><dd>${n(game.metrics.trust, 0)} / 100</dd></div></dl><h3>Moyens et financement</h3><div class="pr-fan__actions">${[...new Map([presidencyCreditsChoice(game), ...presidencyBudgetChoices(game), ...presidencyPoliticalActions(game)].map(choice => [choice.id, choice])).values()].map(choice => strategyCommand(finished(game) ? {...choice,presidencyOrder:{...choice.presidencyOrder!,unavailable:"Mandat terminé · consultation uniquement."}} : choice, true)).join("")}</div><details class="pr-vote-help"><summary>Comprendre les soutiens avant un vote</summary><p>${e(strategyPoliticalReading(game))}</p></details>${lastVote(game)}${accountsAndTeams(game)}<h3>Interventions et transformations</h3>${projects(game)}<p class="pr-panel__note" data-strategy-ministerial>${e(result.ministries.detail)}</p><details class="pr-board-history" data-live-disclosure="activity"><summary>Activité récente · opérations regroupées</summary>${strategyFeed(game)}</details>`;
}

function strategyReforms(game: Game): string {
  const list = finished(game) ? NATIONAL_AGENDA.filter(entry=>entry.kind==='reform').map(entry=>({id:entry.id,title:entry.dossier.title,choices:entry.dossier.choices.map(raw=>({...raw,political:raw.political ?? {action:'enact' as const},presidencyOrder:{cost:0,delay:0,implementation:0,unavailable:'Mandat terminé · consultation uniquement.'}}))})) : presidencyReforms(game), state = strategyState(game);
  return `<p class="pr-panel__intro">Les réformes restent consultables. Les conditions et les engagements sont affichés avant la décision ; les effets arrivent après leur mise en œuvre.</p><nav class="pr-strategy-sector-links" aria-label="Accès aux transformations sectorielles">${presidencySectorIds.map(id => `<button type="button" data-action="presidency-sector" data-sector="${id}">${icon(id)}<span>${e(PRESIDENCY_PLACES[id].label)}</span></button>`).join("")}</nav>${lastVote(game)}<details class="pr-vote-help"><summary>Comprendre les soutiens avant un vote</summary><p>${e(strategyPoliticalReading(game))}</p></details><div class="pr-reforms">${list.map(reform => `<details class="pr-reform" data-live-reform="${e(reform.id)}"><summary><span>${icon("administration")}<strong>${e(reform.title)}</strong></span><span class="pr-reform__chevron" aria-hidden="true">+</span></summary><div class="pr-reform__choices">${reform.choices.map(choice => `${strategyCommand(choice, false)}${choice.political?.action === "enact" ? `<details class="pr-vote-help"><summary>Soutiens et facteurs de ce texte</summary><p>${e(strategyPoliticalReading(game,choice))}</p></details>` : ""}`).join("")}</div></details>`).join("") || '<p class="pr-panel__note">Les transformations des six secteurs restent accessibles ci-dessus.</p>'}</div>${state.commitments.length ? `<h3>Engagements du mandat</h3><ul class="pr-strategy-commitments">${state.commitments.filter(item => item.kind !== "routine").map(item => `<li><strong>${e(item.title)}</strong><span>${item.status === "delivered" ? "En service" : item.status === "preparing" ? "En préparation" : "Terminé"} · ${n(item.cost, 2)} Md€ engagés</span></li>`).join("")}</ul>` : ""}`;
}

function strategyObjectives(game: Game): string {
  const state = strategyState(game), result = strategyOutcome(game);
  const backlog = presidencySectorIds.filter(id => game.pressure!.sectors[id].backlog > 0).sort((a,b) => game.pressure!.sectors[b].backlog-game.pressure!.sectors[a].backlog);
  return `<p class="pr-panel__intro">Rétablir les services sans perdre les moyens de gouverner. Le temps écoulé ne constitue pas une victoire : les services, les retards, le financement et la capacité d’agir déterminent le bilan.</p><p class="pr-strategy-phase-note">${e(strategyPhaseNames[state.phase])} · ${e(state.phaseReason)}</p><div class="pr-strategy-objectives">${result.objectives.map(goal => `<section data-strategy-objective="${goal.id}" data-objective-state="${goal.met ? "met" : "unmet"}"><span>${icon(goal.met ? "check" : "clock")}</span><div><h3>${e(goal.title)}</h3><strong>${e(goal.current)}</strong><p>Cap à atteindre : ${e(goal.target)}</p></div></section>`).join("")}</div><h3>Retards par secteur · unités en attente</h3><nav class="pr-strategy-sector-links" aria-label="Secteurs responsables des retards">${backlog.map(id => `<button type="button" data-action="presidency-sector" data-sector="${id}" data-objective-backlog-sector="${id}">${e(PRESIDENCY_PLACES[id].label)} · ${n(game.pressure!.sectors[id].backlog,2)}</button>`).join("")}</nav><h3>Les besoins annoncés dès le départ</h3><p class="pr-panel__intro">Ces repères décrivent la situation actuelle. Ils sont à maintenir jusqu’à la fin des cinq ans. Les besoins connus ci-dessous évoluent indépendamment de vos clics ; les transformations peuvent les absorber.</p><div class="pr-strategy-forecasts">${presidencySectorIds.map(id => { const sector = state.sectors[id]; return `<section data-strategy-forecast="${id}"><strong>${e(PRESIDENCY_PLACES[id].label)}</strong><p>${e(sector.demandReason)}</p><dl>${sector.demandForecast.map((value, year) => `<div><dt>Année ${year + 1}</dt><dd>+${n(value, 1)} / période</dd></div>`).join("")}</dl></section>`; }).join("")}</div><h3>Consignes persistantes</h3>${prioritiesLegacyForStrategy(game)}<p class="pr-panel__note">Votre priorité reste active jusqu’à modification. Les équipes préparent d’abord les chantiers de ce secteur ; les autres attendent leur tour. Les transformations majeures requièrent un engagement présidentiel.</p>`;
}

function prioritiesLegacyForStrategy(game: Game): string {
  const priority = game.presidency?.priority;
  return `<div class="pr-priorities">${presidencySectorIds.map(id => `<button type="button" class="pr-priority" data-action="presidency-order" data-presidency-order data-presidency-priority="${id}" data-order="live-priority-${id}" aria-pressed="${priority === id}"${finished(game) ? " disabled" : ""}>${icon(id)}<strong>${e(PRESIDENCY_PLACES[id].label)}</strong><small>${priority === id ? "Priorité active · retirer" : "Donner la priorité"}</small>${priority === id ? icon("check", "pr-priority__check") : ""}</button>`).join("")}</div>`;
}

function strategyCausalEnding(game: Game): string {
  const finance = strategyFinancialComparison(game), inherited = start("national", game.seed, game.ambition ?? "equilibre", 17);
  const backlog = (g: Game) => presidencySectorIds.reduce((sum, id) => sum + g.pressure!.sectors[id].backlog, 0);
  const receipts = strategyCausalReceipts(game).filter(receipt => receipt.replayable).slice(-3);
  const laws = strategyLegislativeReceipts(game);
  return `<section class="pr-strategy-financial" data-strategy-financial-comparison><h3>La situation héritée et votre bilan</h3><dl><div><dt>Retards · unités de simulation</dt><dd>${n(backlog(inherited), 2)} → ${n(backlog(game), 2)}</dd></div><div><dt>Déficit annuel · Md€</dt><dd>${n(presidencyLedger(inherited).deficit, 2)} → ${n(finance.actual, 2)}</dd></div><div><dt>Référence au même horizon · Md€</dt><dd>${finance.comparable ? n(finance.reference!, 2) : 'Non comparable'}</dd></div></dl><p>La référence conserve le gouvernement autonome, sans nouvel ordre présidentiel. ${finance.comparable ? `Écart de déficit annuel : ${n(finance.delta!, 2)} Md€. Cette comparaison ne mesure pas l’effet isolé de chaque ordre.` : 'L’exercice, son statut comptable ou la durée de la référence diffèrent ; aucun écart n’est calculé.'}</p></section><section class="pr-strategy-receipts"><h3>Les arbitrages qui ont compté</h3><p class="pr-panel__note">Engagements et effets directs enregistrés. Les pressions dépendent aussi des besoins et du gouvernement.</p>${receipts.map(receipt => `<article data-causal-receipt="${e(receipt.id)}"><div class="pr-receipt-heading">${icon(receipt.sector)}<div><small>${e(PRESIDENCY_PLACES[receipt.sector].label)}</small><h4>${e(receipt.title)}</h4></div></div><ol><li>Engagé en période ${receipt.engagedPeriod + 1}</li><li>${receipt.deliveredPeriod !== undefined ? `Livré après ${receipt.deliveredPeriod} périodes écoulées` : 'En préparation · livraison attendue'}${receipt.status === 'expired' ? ' · effet temporaire terminé' : ''}</li><li>${e(receipt.effect)}</li></ol><p>${n(receipt.cost, 2)} Md€ engagés · ${n(receipt.annualOperating, 2)} Md€/an</p><button type="button" data-action="branch-replay" data-turn="${receipt.sourceJournalIndex}" data-source-choice="${e(receipt.choice)}">Rejouer cet arbitrage →</button></article>`).join('') || '<p>Aucun ordre présidentiel avec chantier enregistré.</p>'}${laws.length ? `<h3>Les décisions législatives</h3>${laws.map(law => `<article data-legislative-receipt="${e(law.id)}"><h4>${e(law.title)}</h4><p>${law.status === 'adopted' ? 'Adoptée' : 'Rejetée'} · ${e(law.effect)}</p><p>Charges ${n(law.annualOperating, 2)} Md€/an · recettes ${n(law.annualRevenue, 2)} Md€/an</p>${law.delayed ? `<p>Effet différé après ${law.delayed.duePeriod} périodes écoulées : ${e(law.delayed.label)}. Charges ${n(law.delayed.annualOperating, 2)} Md€/an · recettes ${n(law.delayed.annualRevenue, 2)} Md€/an.</p>` : ""}${law.replayable ? `<button type="button" data-action="branch-replay" data-turn="${law.sourceJournalIndex}" data-source-choice="${e(law.choice)}">Rejouer ce vote →</button>` : ''}</article>`).join('')}` : ''}</section>`;
}

function strategyEnding(game: Game): string {
  const result = strategyOutcome(game);
  return `<section class="pr-strategy-outcome" data-strategy-verdict="${result.status}"><p>${result.status === "success" ? "Réussite" : result.status === "mixed" ? "Bilan mitigé" : result.status === "failure" ? "Échec" : "Mandat en cours"}</p><h3>${e(result.title)}</h3><p>${e(result.summary)}</p></section><div class="pr-strategy-objectives">${result.objectives.map(goal => `<section data-strategy-objective="${goal.id}" data-objective-state="${goal.met ? "met" : "unmet"}"><span>${icon(goal.met ? "check" : "close")}</span><div><h3>${e(goal.title)}</h3><strong>${e(goal.current)}</strong><p>${goal.met ? "Atteint" : "Manqué"} · ${e(goal.target)}</p></div></section>`).join("")}</div>${strategyCausalEnding(game)}${result.causes.length ? `<h3>Ce qui explique ce bilan</h3><ul class="pr-strategy-list">${result.causes.map(cause => `<li>${e(cause)}</li>`).join("")}</ul>` : ""}<h3>Pression laissée sur les services</h3><p class="pr-panel__note">Ces valeurs indiquent le danger, pas une note : 100 / 100 = pression maximale.</p><div class="pr-ending-readings pr-strategy-ending-readings">${presidencySectorIds.map(id => `<div data-strategy-pressure="${id}">${icon(id)}<span>${e(PRESIDENCY_PLACES[id].label)}</span><strong>${n(game.pressure?.sectors[id].pressure ?? 0, 0)}<small> / 100</small></strong><small>${e(strategyStageNames[strategyState(game).sectors[id].phase])}</small></div>`).join("")}</div><h3>Transformations durables</h3><div data-strategy-transformations>${result.transforms.length ? `<ul class="pr-strategy-list">${result.transforms.map(item => `<li><strong>${e(item.title)}</strong> · ${e(PRESIDENCY_PLACES[item.sector].label)}, période ${item.period + 1}</li>`).join("")}</ul>` : '<p class="pr-panel__note">Aucune transformation durable livrée.</p>'}</div><h3>Dommages et engagements laissés</h3><ul class="pr-strategy-list" data-strategy-damages>${result.damages.map(item => `<li>${e(item)}</li>`).join("") || '<li>Aucun dommage majeur relevé par les indicateurs du modèle.</li>'}</ul><h3>Le rôle de votre gouvernement</h3><p class="pr-panel__intro" data-strategy-ministerial>${e(result.ministries.detail)} ${result.ministries.initiatives} initiative${result.ministries.initiatives > 1 ? "s" : ""} · ${n(result.ministries.cost, 2)} Md€ engagés.</p><details class="pr-board-history" data-live-disclosure="ending-activity"><summary>Décisions qui ont façonné le pays</summary>${strategyFeed(game)}</details><section class="pr-strategy-retry" data-strategy-retry><h3>Essayer une autre manière de gouverner</h3><p>${e(result.hint)}</p></section><div class="pr-strategy-ending-actions"><button type="button" class="pr-wide-action" data-action="new">${icon("play")}<strong>Recommencer autrement</strong></button><button type="button" class="pr-wide-action" data-action="export">${icon("administration")}<strong>Exporter la partie</strong></button></div>`;
}

function strategyPanel(game: Game, panel: PresidencyPanel, comparison: string): string {
  const title = { reforms: "Réformes et transformations", government: "Votre cabinet", priorities: "Le cap du mandat", ending: "Bilan du mandat", bulletin: "Bulletin du pays" }[panel];
  const content = panel === "bulletin" ? `${presidencyBulletin(game)}${!finished(game) ? `<div class="pr-projection-reader">${projectionControl(true)}</div>` : ""}` : panel === "government" ? strategyGovernment(game) : panel === "reforms" ? strategyReforms(game) : panel === "priorities" ? strategyObjectives(game) : strategyEnding(game);
  return `<div class="pr-panel-scrim" data-action="presidency-close"></div><section class="pr-panel pr-strategy-panel" role="dialog" aria-modal="true" aria-labelledby="pr-panel-title" data-presidency-panel="${panel}"><header class="pr-panel__header"><div><p>Présidence de la République</p><h2 id="pr-panel-title" tabindex="-1">${title}</h2></div><button type="button" data-action="presidency-close" aria-label="Fermer et revenir au pays">${icon("close")}</button></header><div class="pr-panel__body">${content}${comparison && (panel === "government" || panel === "ending") ? `<section class="pr-comparison" data-live-comparison>${comparison}</section>` : ""}</div><footer class="pr-panel__footer">${icon("pause")}<span>Le temps est suspendu pendant cette lecture.</span></footer></section>`;
}

function strategyPins(game: Game, selected: PressureSectorId | null): string {
  if (finished(game)) return "";
  return presidencySectorIds.map(id => {
    const reading = strategySectorReading(game, id), place = PRESIDENCY_PLACES[id];
    const label = reading.limited ? "Limite opérationnelle" : reading.severity === "critical" ? "En crise" : reading.severity === "warning" ? "À surveiller" : "Service assuré";
    return `<button type="button" class="pr-pin pr-sector-pin" data-pin-key="${id}" data-map-x="${place.x}" data-map-y="${place.y}" data-live-pin="${id}" data-action="presidency-sector" data-sector="${id}" data-stage="${game.pressure!.sectors[id].stage}" data-severity="${reading.severity}" data-trend="${reading.trend}" data-working="${reading.working}" data-selected="${selected === id}" aria-pressed="${selected === id}" aria-label="${e(place.label)} : ${label}, pression ${n(reading.pressure, 0)} sur 100${reading.working ? ', chantier en préparation' : ''}"><span class="pr-pin__symbol">${icon(id)}</span><span class="pr-pin__label"><strong>${e(place.label)}</strong><small>${label}${reading.working ? " · chantier" : ""}</small></span>${reading.working ? `<span class="pr-pin__work" aria-label="Chantier en préparation">${icon("clock")}</span>` : ""}</button>`;
  }).join("");
}

export function presidencyStrategyEffects(game: Game): string {
  if (game.version !== 17 || finished(game)) return "";
  return presidencySectorIds.map(id => {
    const place = PRESIDENCY_PLACES[id], reading = strategySectorReading(game, id);
    const title = `${place.label} : pression ${n(reading.pressure, 0)} sur 100, ${reading.trend === 'improving' ? 'en amélioration' : reading.trend === 'worsening' ? 'en aggravation' : 'stable'}${reading.working ? ', chantier en préparation' : ''}`;
    return `<g class="pr-strategy-map-state" data-strategy-map-sector="${id}" data-map-state="${reading.severity}" data-map-severity="${reading.severity}" data-map-trend="${reading.trend}" data-map-work="${reading.working}" transform="translate(${place.x * 10} ${place.y * 5.625})"><title>${e(title)}</title><circle class="pr-strategy-map-state__area" r="${reading.severity === 'critical' ? 36 : 23}"/><circle class="pr-strategy-map-state__ring" r="16"/><circle class="pr-strategy-map-state__centre" r="5"/>${reading.working ? '<path class="pr-strategy-map-state__work" d="M-8 -8H8V8H-8Z M0 -8V8 M-8 0H8"/>' : ''}</g>`;
  }).join("");
}


function strategyEventDate(period: number): string {
  const index = Math.max(0, Math.min(29, period));
  return `${months[index % 6]} · année ${Math.floor(index / 6) + 1}`;
}

/** A current state bulletin is not a new initiative. Old initiatives stay in Cabinet. */
export function presidencyHeadline(game: Game, speed = 1): string {
  if (game.version !== 17) return game.presidency?.lastEvents.at(-1) ?? game.presidency?.initiatives.at(-1)?.title ?? "Le pays attend vos décisions.";
  if (finished(game)) return `Bilan du mandat · ${strategyOutcome(game).title}.`;
  const state = strategyState(game);
  const fresh = game.presidency?.lastEvents.at(-1) ?? state.lastMaterialEvents.at(-1);
  if (fresh) return `${presidencyDate(game, false)} · ${fresh}`;
  const accelerated = speed === 4 ? " · ×4 : deux mois passent en 7,5 secondes." : ".";
  const faster = speed === 4 ? accelerated : " · Pour avancer plus vite, utilisez ×4.";
  const preparing = game.pressure?.programmes.filter(programme => programme.status === "preparing").length ?? 0;
  if (preparing) return `${preparing} chantier${preparing > 1 ? "s" : ""} en préparation${faster} Les équipes mettent en œuvre les engagements financés.`;
  const arbitration = presidencySectorIds.filter(id => ["organisation", "conflict", "national"].includes(state.sectors[id].phase));
  if (arbitration.length) return `${arbitration.length} secteur${arbitration.length > 1 ? "s" : ""} à arbitrer : ${arbitration.map(id => PRESIDENCY_PLACES[id].label).join(", ")}${accelerated}`;
  if (presidencySectorIds.every(id => state.sectors[id].phase === "normal")) return `Période calme : les services sont assurés${faster} Les objectifs restent à tenir jusqu’au bilan.`;
  const missed = strategyOutcome(game).objectives.filter(goal => !goal.met).length;
  return `${missed ? `${missed} repère${missed > 1 ? "s" : ""} du mandat à rétablir` : "Objectifs à suivre et besoins annoncés à préparer"}${accelerated} Le gouvernement assure les opérations courantes.`;
}

function projectionControl(full = false): string {
  return `<button type="button" data-action="presidency-project" aria-label="Avancer jusqu’au prochain changement" aria-describedby="pr-projection-description"${full ? ' class="pr-wide-action"' : ""}><span>${full ? "Avancer jusqu’au prochain changement" : "Avancer"}</span></button>`;
}

export function presidencyBulletin(game: Game): string {
  return `<section class="pr-strategy-bulletin" data-presidency-bulletin><p class="pr-panel__note">${e(presidencyDate(game, false))} · ${game.turn} période${game.turn > 1 ? "s" : ""} écoulée${game.turn > 1 ? "s" : ""}</p><h3>Le pays à cette période</h3><p>${e(presidencyHeadline(game))}</p><p class="pr-panel__intro">La commande Avancer simule les périodes, ne donne aucun ordre. Elle s’arrête au prochain changement enregistré ; le temps reste ensuite en pause.</p><h3>Événements et décisions enregistrés</h3>${strategyFeed(game)}<p class="pr-panel__note">Les coûts et conséquences sont des hypothèses de simulation.</p></section>`;
}
