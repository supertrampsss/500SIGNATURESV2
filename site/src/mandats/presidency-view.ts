import { crisisSeverity, crisisSpec, presidencyCrises } from "./presidency-crises.ts";
import { crisisAlerts, crisisBrief, crisisAnchor } from "./presidency-crisis-view.ts";
import type { Choice, Game } from "./types.ts";
import type { PressureProgramme, PressureSectorId } from "./pressure-types.ts";
import { presidencyActions, presidencyReforms, presidencyEvents, presidencyLinks, presidencyCreditsChoice, presidencyPoliticalActions, presidencyLedger } from "./presidency-engine.ts";
import { NATIONAL_AGENDA } from "./national-agenda.ts";
import { presidencyIcon as icon } from "./presidency-icons.ts";

export type PresidencyPanel = "reforms" | "government" | "priorities" | "ending";
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
const stageNames = { stable: "Maîtrisé", watch: "À surveiller", strained: "Sous tension", disrupted: "Perturbé", crisis: "En crise" };
const months = ["Janvier–février", "Mars–avril", "Mai–juin", "Juillet–août", "Septembre–octobre", "Novembre–décembre"];
const finished = (game: Game): boolean => game.turn >= 30 || Boolean(game.politics?.ending);
const durableInService = (programme: PressureProgramme): boolean => programme.status === "completed" && !programme.duration
  && (Boolean(programme.appliedCapacity) || Boolean(programme.appliedNeed));
const visibleProgramme = (programme: PressureProgramme): boolean => programme.status === "preparing" || programme.status === "active" || durableInService(programme);

export function presidencyDate(game: Game): string {
  return finished(game) ? "Mandat terminé" : `${months[game.turn % 6]} · année ${Math.floor(game.turn / 6) + 1}`;
}

function resources(game: Game): string {
  const p = game.presidency;
  const execution = game.pressure?.execution;
  const seats = game.politics?.blocs.reduce((sum, bloc) => sum + bloc.seats, 0) ?? 577;
  const support = game.politics?.blocs.filter(bloc => bloc.inGovernment).reduce((sum, bloc) => sum + bloc.seats, 0) ?? 0;
  return `<div class="pr-resource" title="Crédits encore disponibles dans votre autorisation de dépense">${icon("coins")}<span><small>Crédits</small><strong data-live-reserve>${n(p?.reserve ?? 0)} <em>Md€</em></strong></span></div>
    <div class="pr-resource pr-resource--teams" title="Capacité d’exécution utilisée sur la période">${icon("people")}<span><small>Équipes mobilisées</small><strong data-live-teams>${n(execution?.used ?? 0)} <em>/ ${n(execution?.capacity ?? 0)}</em></strong></span></div>
    <div class="pr-resource pr-resource--seats" title="Les soutiens à l’Assemblée ne garantissent pas chaque vote">${icon("government")}<span><small>Coalition</small><strong data-live-seats>${support} <em>/ ${seats}</em></strong><i style="--pr-value:${support / Math.max(1, seats) * 100}%"></i></span></div>`;
}

export function presidencyShell(game: Game): string {
  return `<section class="presidency" data-presidency data-turn="${game.turn}" aria-label="Mandats, présidence vivante">
    <div class="pr-backdrop" aria-hidden="true"></div>
    <header class="pr-header">
      <a class="pr-brand" href="/mandats/" aria-label="Mandats, accueil">MANDATS<span></span></a>
      <div class="pr-calendar"><strong data-live-date>${e(presidencyDate(game))}</strong><span data-live-period>Période ${Math.min(30, game.turn + 1)} / 30</span></div>
      <div class="pr-clock" data-live-clock data-presidency-clock data-paused="true" data-turn="${game.turn}">
        <button type="button" class="pr-clock__toggle" data-action="presidency-pause" aria-label="Démarrer le temps" title="Démarrer ou mettre en pause">${icon("play")}</button>
        <div class="pr-speeds" aria-label="Vitesse du temps">${[1, 2, 4].map(speed => `<button type="button" data-action="presidency-speed" data-speed="${speed}" aria-pressed="${speed === 1}">×${speed}</button>`).join("")}</div>
        <div class="pr-clock__track" aria-hidden="true"><span data-live-progress></span></div>
      </div>
      <div class="pr-resources" data-live-resources>${resources(game)}</div>
      <button type="button" class="pr-sound" data-action="presidency-sound" aria-pressed="false" aria-label="Activer les sons">Son</button>
      <button class="pr-menu" type="button" data-action="presidency-menu" aria-label="Ma partie">${icon("menu")}</button>
    </header>
    <div class="pr-country" role="region" aria-label="Carte de France">
      <div class="pr-world" data-presidency-world>
        <img class="pr-art" src="/mandats/art/presidency-france-v2.webp" alt="France illustrée : villes, réseaux, reliefs et littoraux" data-presidency-art decoding="async" fetchpriority="high">
        <svg class="pr-links" viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-label="Perturbations entre secteurs" data-live-links></svg>
        <svg class="pr-crisis-effects" viewBox="0 0 1000 562.5" preserveAspectRatio="none" aria-label="Incidents et interventions" data-live-crisis-effects></svg>
        <div class="pr-pins" data-live-pins></div><div class="pr-event-pins" data-live-event-pins></div>
      </div>
      <div class="pr-fan-anchor" data-live-fan hidden></div>
      <button type="button" class="pr-mapview" data-action="presidency-mapview" aria-pressed="false">Vue France</button>
      <p class="pr-map-caption">Repères illustratifs · situation nationale</p>
    </div>
    <aside class="pr-sectors" aria-label="Les six secteurs du pays" data-live-sectors></aside>
    <aside class="pr-feed" aria-label="Fil du gouvernement"><header><span class="pr-feed__live" aria-hidden="true"></span><h2>Situation du pays</h2><span data-live-status>En pause</span></header><div data-live-crisis-alerts></div><div data-live-events></div><div data-live-feed data-presidency-feed></div></aside>
    <div class="pr-newswire" role="status"><strong>ACTUALITÉS</strong><i aria-hidden="true"></i><span data-live-headline>Le pays attend vos décisions.</span></div>
    <nav class="pr-navigation" aria-label="Commandes présidentielles">${([["reforms", "administration", "Réformes"], ["government", "government", "Gouvernement"], ["priorities", "target", "Priorités"]] as const).map(([panel, symbol, label]) => `<button type="button" data-action="presidency-panel" data-panel="${panel}"${panel === "reforms" ? ' class="pr-navigation__reforms"' : ""}>${icon(symbol)}<span>${label}</span></button>`).join("")}</nav>
    <div class="pr-notice-slot" data-live-notice-slot></div>
    <div class="pr-feedback" role="status" aria-live="polite" data-live-feedback hidden></div>
    <div class="pr-panel-host" data-live-panel hidden></div>
    <div class="pr-visually-hidden" aria-live="polite" data-live-announcement></div>
  </section>`;
}

export function presidencyReadings(game: Game, selected: PressureSectorId | null): string {
  return presidencySectorIds.map(id => {
    const front = game.pressure?.sectors[id];
    if (!front) return "";
    const trend = front.pressureChange > .35 ? `+${n(front.pressureChange, 0)}` : front.pressureChange < -.35 ? n(front.pressureChange, 0) : "=";
    return `<button type="button" class="pr-sector" data-live-sector="${id}" data-presidency-front="${id}" data-action="presidency-sector" data-sector="${id}" data-stage="${front.stage}" aria-pressed="${selected === id}" aria-label="${e(PRESIDENCY_PLACES[id].label)}, pression ${n(front.pressure, 0)} sur 100, ${e(stageNames[front.stage])}">
      <span class="pr-sector__icon">${icon(id)}</span><span class="pr-sector__reading"><span>${e(PRESIDENCY_PLACES[id].label)}</span><strong>${n(front.pressure, 0)}<small aria-hidden="true">${trend}</small></strong><i style="--pr-value:${front.pressure}%" aria-hidden="true"></i></span>
    </button>`;
  }).join("");
}

export function presidencyPins(game: Game, selected: PressureSectorId | null): string {
  return presidencySectorIds.map(id => {
    const p = PRESIDENCY_PLACES[id], front = game.pressure?.sectors[id];
    if (!front) return "";
    const programme = game.pressure?.programmes.filter(item => item.sector === id && visibleProgramme(item)).at(-1);
    const preparing = programme?.status === "preparing";
    const crisis = game.presidency?.crises?.find(c => c.sector === id && c.status !== "resolved");
    const anchor = crisis ? crisisAnchor(crisis) : [p.x*10,p.y*5.625];
    const place = crisis?.spec === "port" ? "Marseille" : crisis && ["greve","blocage","revolte","revolution"].includes(crisis.spec) ? "Paris · pays" : p.place;
    const pinStage = crisis?.status === "active" ? crisisSeverity(crisis, game.turn) > 1 ? "crisis" : "disrupted" : front.stage;
    const label = crisis ? crisisSpec(crisis).title : p.label;
    const due = crisis?.status === 'active' ? (crisis.stageStartedPeriod ?? crisis.startedPeriod) + crisis.deadline * (crisis.stageStartedPeriod !== undefined ? 1 : Math.min(2,crisisSeverity(crisis,game.turn))) : undefined;
    return `<button type="button" class="pr-pin" data-live-pin="${id}" data-action="presidency-sector" data-sector="${id}" data-stage="${pinStage}" data-selected="${selected === id}" style="--pr-x:${anchor[0]/10}%;--pr-y:${anchor[1]/5.625}%" aria-label="${e(p.label)} : ${e(stageNames[front.stage])}, ouvrir les commandes" aria-pressed="${selected === id}"><span class="pr-pin__ring" aria-hidden="true"></span><span class="pr-pin__symbol">${icon(crisis?.spec === "port" ? "port" : id)}</span><span class="pr-pin__label">${`<b>${e(place)}</b>`}${e(label)}<small>${programme ? preparing ? "Équipes en préparation" : durableInService(programme) ? "Effet durable en service" : "Renfort en service" : crisis ? "Intervention nécessaire" : e(stageNames[front.stage])}</small></span>${due !== undefined && due > game.turn ? `<span class="pr-pin__countdown" data-crisis-due="${due}">${(due-game.turn)*15} s</span>` : ""}${programme ? `<span class="pr-pin__work" data-delivery-state="${programme.status}" aria-label="${preparing ? "Intervention en préparation" : "Intervention en service"}">${icon(preparing ? "clock" : "check")}</span>` : ""}</button>`;
  }).join("");
}

export function presidencyRoutes(game: Game): string {
  return presidencyLinks(game).map(link => {
    const from = PRESIDENCY_PLACES[link.from], to = PRESIDENCY_PLACES[link.to];
    return `<g data-live-link="${link.from}-${link.to}" data-capacity-loss="${link.loss}"><title>${e(link.label)} · ${n(link.loss)} unité${link.loss > 1 ? "s" : ""} de capacité perdue</title><path d="M${from.x * 10} ${from.y * 5.625} Q${(from.x + to.x) * 5 + 25} ${(from.y + to.y) * 2.8125 - 20} ${to.x * 10} ${to.y * 5.625}"/><circle cx="${to.x * 10}" cy="${to.y * 5.625}" r="4"/></g>`;
  }).join("");
}

export function presidencyFeed(game: Game): string {
  const initiatives = game.presidency?.initiatives.slice(-4).reverse() ?? [];
  const crisis = game.politics?.pendingCrisis;
  const alert = crisis ? `<button type="button" class="pr-institutional" data-action="presidency-event" data-event="political-${e(crisis)}">${icon("government")}<span>Crise politique · décider sur la carte</span></button>` : "";
  return alert + (initiatives.length ? `<ol>${initiatives.map(item => `<li data-live-initiative="${e(item.id)}" data-initiative-status="${item.status}"><span class="pr-feed__symbol" data-kind="${item.status}">${icon(item.sector ?? "government")}</span><div><p><strong>${e(item.title)}</strong></p><small>${item.actor === "government" ? "Gouvernement" : "Présidence"} · P${item.period + 1}${item.cost ? ` · ${n(item.cost)} Md€` : ""}</small><p class="pr-feed__detail">${e(item.detail)}</p></div></li>`).join("")}</ol>` : `<p class="pr-feed__empty">${game.presidency?.autonomy ? "Les ministères préparent leurs interventions." : "Les ministères attendent vos consignes."}</p>`);
}

function command(choice: Choice, compact = false): string {
  const order = choice.presidencyOrder;
  const unavailable = order?.unavailable;
  const kind = choice.pressure?.kind;
  const symbol = kind === "relief" ? "people" : kind === "programme" ? "government" : "link";
  const title = choice.title;
  return `<button type="button" class="pr-command${compact ? " pr-command--compact" : ""}" data-action="presidency-order" data-presidency-order data-live-action="${e(choice.id)}" data-order="${e(choice.id)}"${choice.pressure?.crisisId ? ` data-crisis-response="${e(choice.pressure.crisisId)}"` : ""}${unavailable ? ` disabled aria-disabled="true"` : ""}>
    ${icon(symbol)}<span class="pr-command__body"><strong>${e(title)}</strong><span class="pr-command__price">${order ? `${compact ? "" : "Engagement : "}${n(order.cost, 2)} Md€${order.delay ? ` · ${order.delay * 2} mois minimum` : " · sans délai de préparation"}` : e(choice.cost)}</span>${!compact ? `<span class="pr-command__description">${e(choice.description)}</span><span class="pr-command__description">${e(choice.cost)}</span><span class="pr-command__description">${e(choice.benefit)}</span><small>${e(choice.sacrifice)}</small>` : ""}${compact && choice.pressure?.crisisId ? `<small class="pr-command__sacrifice">${e(choice.sacrifice)}</small>` : ""}${unavailable ? `<small class="pr-command__unavailable">${e(unavailable)}</small>` : compact ? `<small>${e(choice.benefit)}${choice.pressure?.duration ? ` · Effet pendant ${choice.pressure.duration * 2} mois.` : ""}</small>` : ""}</span>
  </button>`;
}

export function presidencyFan(game: Game, sector: PressureSectorId): string {
  const front = game.pressure?.sectors[sector];
  const actions = finished(game) ? [] : presidencyActions(game, sector);
  const responses = actions.filter(choice => choice.pressure?.crisisId);
  const ordinary = actions.filter(choice => !choice.pressure?.crisisId);
  const hasIncident = presidencyCrises(game).some(c => c.sector === sector && c.status !== "resolved");
  const actionMarkup = hasIncident ? `${responses.length ? `<div class="pr-fan__actions">${responses.map(choice => command(choice, true)).join("")}</div>` : '<p class="pr-fan__empty">Les équipes préparent la réponse déjà financée.</p>'}<details class="pr-sector-development"><summary>Développer ce secteur</summary><div class="pr-fan__actions">${ordinary.map(choice => command(choice, true)).join("")}</div></details>` : `<div class="pr-fan__actions">${ordinary.map(choice => command(choice, true)).join("") || '<p class="pr-fan__empty">Les interventions disponibles sont déjà engagées.</p>'}</div>`;
  return `<section class="pr-fan" data-presidency-commands aria-label="Commandes : ${e(PRESIDENCY_PLACES[sector].label)}"><header><span class="pr-fan__title">${icon(sector)}<strong>${e(PRESIDENCY_PLACES[sector].label)}</strong></span><button type="button" data-action="presidency-deselect" aria-label="Fermer les commandes">${icon("close")}</button></header>${crisisBrief(game, sector)}${actionMarkup}${front ? `<footer>Retard : ${n(front.backlog)} · capacité : ${n(front.effectiveCapacity)} / période</footer>` : ""}</section>`;
}

function government(game: Game): string {
  const p = game.presidency;
  const vote = game.politics?.lastVote;
  const credits = presidencyCreditsChoice(game);
  const political = presidencyPoliticalActions(game);
  return `<p class="pr-panel__intro">Vos ministères partagent vos crédits et vos équipes. Les initiatives ordinaires sont limitées à 0,4 Md€ ; une priorité nationale les autorise à préparer un investissement plus important.</p>${political.length ? `<section class="pr-political" data-live-political><h3>Arbitrage institutionnel</h3>${political.map(choice => command(choice)).join("")}</section>` : ""}<div class="pr-cabinet-controls"><button type="button" class="pr-setting" data-action="presidency-order" data-presidency-order data-order="live-autonomy" aria-pressed="${p?.autonomy ?? false}"${finished(game) ? " disabled" : ""}><span>${icon("government")}<strong>Initiatives des ministres</strong></span><b>${p?.autonomy ? "Autorisées" : "Suspendues"}</b><small>${p?.autonomy ? "Les ministres peuvent engager les interventions opérationnelles permises par votre enveloppe." : "Les ministres exécutent les chantiers engagés ; vous décidez des nouveaux engagements."}</small></button><dl class="pr-budget"><div><dt>Autorisation de dépense</dt><dd>${n(p?.authorised ?? 0)} Md€</dd></div><div><dt>Engagements cumulés</dt><dd>${n(p?.spent ?? 0)} Md€</dd></div><div><dt>Crédits disponibles</dt><dd>${n(p?.reserve ?? 0)} Md€</dd></div></dl>${`<button type="button" class="pr-wide-action" data-action="presidency-order" data-presidency-order data-order="live-credits"${credits.presidencyOrder?.unavailable || finished(game) ? " disabled" : ""}>${icon("government")}<span><strong>Demander 10 Md€ de crédits supplémentaires</strong><small>${e(credits.presidencyOrder?.unavailable ?? "Autorisation soumise au vote de l’Assemblée · une demande par an")}</small></span></button>`}</div>${accountsAndTeams(game)}<h3>Chantiers et interventions</h3>${projects(game)}${vote ? `<section class="pr-vote" data-live-vote data-vote-passed="${vote.passed}"><h3>Dernier vote · ${vote.passed ? "Adopté" : "Rejeté"}</h3><p>${e(vote.title)}</p><dl><div><dt>Pour</dt><dd>${vote.for}</dd></div><div><dt>Contre</dt><dd>${vote.against}</dd></div><div><dt>Abstentions</dt><dd>${vote.abstain}</dd></div></dl>${vote.consequences.map(item => `<p class="pr-panel__note">${e(item)}</p>`).join("")}</section>` : ""}<p class="pr-panel__note">Les enveloppes et capacités sont des hypothèses de simulation. Ces crédits ne représentent pas la trésorerie de l’État.</p>`;
}

function accountsAndTeams(game: Game): string {
  const ledger = presidencyLedger(game), p = game.presidency!, execution = game.pressure!.execution;
  const closed = game.turn > 0 && game.turn % 6 === 0 && p.preparedYear === Math.floor(game.turn / 6);
  const year = closed ? Math.ceil(game.turn / 6) : Math.min(5, Math.floor(game.turn / 6) + 1);
  const spending = ledger.operating + ledger.interest + ledger.investment + ledger.grants;
  const lines: Array<[string, string, number]> = [
    ["revenue", "Recettes", ledger.revenue], ["spending", "Dépenses, intérêts inclus", spending],
    ["deficit", "Déficit", ledger.deficit], ["debt", "Dette en fin d’exercice", ledger.debt],
  ];
  return `<details class="pr-accounts" data-live-disclosure="accounts"><summary>Comptes et équipes</summary><div class="pr-accounts__body"><h3>${closed ? "Exercice clos" : "Prévision annuelle"} · année ${year}</h3><dl class="pr-accounts__numbers" data-live-accounts data-accounts-status="${closed ? "closed" : "forecast"}">${lines.map(([id, label, value]) => `<div><dt>${label}</dt><dd data-account="${id}" data-value="${value}">${n(value, 2)} <small>Md€</small></dd></div>`).join("")}</dl><p class="pr-panel__note">${closed ? "Comptes enregistrés à la clôture de l’année." : "Les périodes écoulées sont comptabilisées ; les périodes restantes sont projetées aux conditions actuelles."} L’autorisation de dépense ci-dessus reste distincte de ces comptes nationaux simulés.</p><h3>Équipes de mise en œuvre</h3><dl class="pr-accounts__numbers" data-live-execution><div><dt>Capacité mobilisée / disponible</dt><dd data-execution-used="${execution.used}" data-execution-capacity="${execution.capacity}">${n(execution.used, 2)} / ${n(execution.capacity, 2)}</dd></div><div><dt>Chantiers en attente de mise en service</dt><dd data-execution-waiting="${execution.waiting}">${n(execution.waiting, 0)}</dd></div></dl><p class="pr-panel__note">Unités d’exécution partagées entre les chantiers ; il ne s’agit pas d’un nombre d’agents publics.</p></div></details>`;
}

function projects(game: Game): string {
  const programmes = game.pressure?.programmes.filter(visibleProgramme) ?? [];
  const signed = (value: number) => `${value > 0 ? "+" : ""}${n(value)}`;
  return programmes.length ? `<ul class="pr-projects">${programmes.map(item => `<li data-live-programme="${e(item.id)}" data-programme-state="${item.status}"><span class="pr-projects__symbol">${icon(item.sector)}</span><div><strong>${e(item.label)}</strong><p>${item.status === "preparing" ? `En préparation · ${n(item.remainingWork)} unités de travail restantes · au plus tôt période ${item.dueTurn + 1}` : `En service${item.endsTurn === undefined ? (item.appliedCapacity ? " · capacité durable" : " · effet durable") : ` · fin période ${item.endsTurn + 1}`}`}</p>${item.status !== "preparing" && (item.appliedCapacity || item.appliedNeed) ? `<p data-applied-capacity="${item.appliedCapacity ?? 0}" data-applied-need="${item.appliedNeed ?? 0}">${[item.appliedCapacity ? `Capacité ${signed(item.appliedCapacity)}` : "", item.appliedNeed ? `Besoins ${signed(item.appliedNeed)}` : ""].filter(Boolean).join(" · ")} par période</p>` : ""}</div><span>${item.status === "preparing" ? "Préparation" : "En service"}</span></li>`).join("")}</ul>` : '<p class="pr-panel__note">Aucune intervention en préparation ou en service.</p>';
}

function reforms(game: Game): string {
  const list = presidencyReforms(game);
  return `<p class="pr-panel__intro">Engagez un dossier quand vous le souhaitez. Les lois passent devant l’Assemblée ; un texte rejeté n’engage aucun de ses effets.</p><div class="pr-reforms">${list.map(reform => `<details class="pr-reform" data-live-reform="${e(reform.id)}"><summary><span>${icon("administration")}<strong>${e(reform.title)}</strong></span><span class="pr-reform__chevron" aria-hidden="true">+</span></summary><div class="pr-reform__choices">${reform.choices.map(choice => command(choice)).join("")}</div></details>`).join("") || `<p class="pr-panel__note">${finished(game) ? "Le mandat est terminé. Aucun nouveau dossier ne peut être engagé." : "Tous les dossiers de réforme disponibles ont été examinés."}</p>`}</div>${game.presidency?.reforms.length ? `<h3>Dossiers examinés</h3><ul class="pr-reform-history">${game.presidency.reforms.map(item => `<li><strong>${e(NATIONAL_AGENDA.find(reform => reform.id === item.id)?.dossier.title ?? item.id)}</strong><span>${item.adopted ? "Adopté" : "Rejeté"} · période ${item.period + 1}</span></li>`).join("")}</ul>` : ""}`;
}

function priorities(game: Game): string {
  const priority = game.presidency?.priority;
  return `<p class="pr-panel__intro">Une priorité oriente les prochaines initiatives de vos ministres. Elle reste active jusqu’à votre prochaine consigne.</p><div class="pr-priorities">${presidencySectorIds.map(id => `<button type="button" class="pr-priority" data-action="presidency-order" data-presidency-order data-presidency-priority="${id}" data-order="live-priority-${id}" aria-pressed="${priority === id}"${finished(game) ? " disabled" : ""}>${icon(id)}<strong>${e(PRESIDENCY_PLACES[id].label)}</strong><small>${priority === id ? "Priorité nationale · toucher pour retirer" : "Définir comme priorité nationale"}</small>${priority === id ? icon("check", "pr-priority__check") : ""}</button>`).join("")}</div><p class="pr-panel__note">${priority ? `${e(PRESIDENCY_PLACES[priority].label)} : le gouvernement privilégie ce secteur parmi ses interventions possibles, dans la limite de ses moyens.` : "Sans priorité nationale, le gouvernement intervient selon les tensions du pays."}</p>`;
}

export function presidencyPanel(game: Game, panel: PresidencyPanel, comparison = ""): string {
  const title = { reforms: "Les grandes réformes", government: "Votre gouvernement", priorities: "Le cap du mandat", ending: game.politics?.ending?.title ?? "Cinq ans à la présidence" }[panel];
  const ending = `<p class="pr-ending-outcome" data-ending-kind="${game.politics?.ending?.kind ?? "term_complete"}">${game.politics?.ending && game.politics.ending.kind !== "term_complete" ? "Défaite · mandat interrompu" : "Mandat achevé · cinq ans à la présidence"}</p><p class="pr-panel__intro">${e(game.politics?.ending?.reason ?? "Le mandat est terminé. Voici le pays que vos choix et votre gouvernement ont façonné.")}</p><div class="pr-ending-readings">${presidencySectorIds.map(id => `<div>${icon(id)}<span>${e(PRESIDENCY_PLACES[id].label)}</span><strong>${n(game.pressure?.sectors[id].pressure ?? 0, 0)}<small> / 100</small></strong></div>`).join("")}</div>${projects(game)}<button type="button" class="pr-wide-action" data-action="presidency-menu">${icon("menu")}<strong>Ma partie · exporter ou recommencer</strong></button>`;
  return `<div class="pr-panel-scrim" data-action="presidency-close"></div><section class="pr-panel" role="dialog" aria-modal="true" aria-labelledby="pr-panel-title" data-presidency-panel="${panel}"><header class="pr-panel__header"><div><p>Présidence de la République</p><h2 id="pr-panel-title" tabindex="-1">${e(title)}</h2></div><button type="button" data-action="presidency-close" aria-label="Fermer et revenir au pays">${icon("close")}</button></header><div class="pr-panel__body">${panel === "government" ? government(game) : panel === "reforms" ? reforms(game) : panel === "priorities" ? priorities(game) : ending}${comparison && (panel === "government" || panel === "ending") ? `<section class="pr-comparison" data-live-comparison>${comparison}</section>` : ""}</div><footer class="pr-panel__footer">${icon("pause")}<span>Le pays est en pause pendant votre lecture.</span></footer></section>`;
}

export { resources as presidencyResources };

export { crisisAlerts };

/** Reforms and institutional choices use the same board interaction as incidents. */
export function presidencyEventPins(game: Game): string {
 return presidencyEvents(game).map((event,i)=>`<button type="button" class="pr-pin pr-event-pin${event.kind === 'political' ? ' pr-event-pin--political' : ''}" data-live-event-pin="${e(event.id)}" data-action="presidency-event" data-event="${e(event.id)}" style="--pr-x:${event.kind === 'political' ? event.id.startsWith('civil-') ? 44 : 49 : i%2 ? 28 : 52}%;--pr-y:${event.kind === 'political' ? event.id.startsWith('civil-') ? 34.7 : 20 : i%2 ? 70 : 55}%" aria-label="${e(event.title)}, ouvrir cet événement"><span class="pr-pin__symbol">${icon(event.kind === 'reform' ? 'administration':'government')}</span><span class="pr-pin__label"><b>${event.kind === 'reform' ? 'Réforme proposée':'Crise politique'}</b>${e(event.title)}</span></button>`).join('');
}
export function presidencyEventAlerts(game: Game): string {
 return presidencyEvents(game).filter(event=>!presidencyCrises(game).some(c=>c.id===event.id)).map(event=>`<button type="button" class="pr-alert pr-event-alert" data-action="presidency-event" data-event="${e(event.id)}"><span class="pr-alert__symbol">${icon(event.kind === 'reform' ? 'administration':'government')}</span><span><strong>${e(event.title)}</strong><small>${event.kind === 'reform' ? 'Réforme à arbitrer sur la carte':'Décision institutionnelle'}</small></span></button>`).join('');
}
export function presidencyEventFan(game: Game,id: string): string {
 const event=presidencyEvents(game).find(item=>item.id===id);
 if(!event) return '';
 return `<section class="pr-fan pr-event-fan" data-presidency-event="${e(id)}" aria-label="${e(event.title)}"><header><span class="pr-fan__title">${icon(event.kind==='reform'?'administration':'government')}<strong>${event.kind==='reform'?'Réforme proposée':'Crise politique'}</strong></span><button type="button" data-action="presidency-deselect" aria-label="Fermer les commandes">${icon('close')}</button></header><div class="pr-event-brief"><strong>${e(event.title)}</strong>${e(event.detail)}<small>Le pays continue. Vous pouvez mettre le temps en pause pour décider.</small></div><div class="pr-fan__actions">${event.choices.map(choice=>command(choice,true)).join('') || '<p class="pr-fan__empty">Une intervention est déjà engagée.</p>'}</div></section>`;
}
