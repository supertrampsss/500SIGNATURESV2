import {
  calendarFor,
  choicesFor,
  domainFor,
  preview,
  storyContextOptions,
  narrativeElectionOutcome,
} from "./engine.ts";
import { annualDeficit } from "./national-deficit.ts";
import {
  mapState,
  markerLabel,
  placeForTopic,
  MAP_PLACES,
  mapSourcePosition,
} from "./map-state.ts";
import { FRANCE_OUTLINES } from "./map-geography.ts";
import { escape } from "./sharing.ts";
import { focusedNarrativeEvent } from "./narrative-engine.ts";
import { iconForTopic, mapIcon, toneForTopic } from "./map-icons.ts";
import type { MapIcon } from "./map-icons.ts";
import type { Choice, Game } from "./types.ts";
import type { StoryAgendaItem } from "./narrative-types.ts";
import type { PressureFront, PressureSectorId, PressureStage } from "./pressure-types.ts";
import { isPressureIncidentId, PRESSURE_INCIDENTS } from "./pressure-content.ts";

const referenceMapUrl = new URL("./textures/reference-map.svg", import.meta.url).href;

export const cleanGameText = (text: string) =>
  text
    .replace(/[—–]/g, ", ")
    .replace(/[←→↗↘↔›‹»«]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const e = (text: string) => escape(cleanGameText(text));
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0];
const pressureNames: Record<PressureSectorId, string> = {
  health: "Santé", housing: "Logement", transport: "Transports",
  energy: "Énergie", education: "Enseignement", administration: "Démarches publiques",
};
const pressureStages = {
  stable: "Maîtrisé", watch: "À surveiller", strained: "Sous tension",
  disrupted: "Perturbé", crisis: "En crise",
} as const;
const pressureTrends = { improving: "Pression en baisse", steady: "Pression stable", worsening: "Pression en hausse" } as const;
const pressureTrendLabel = (pressure: number, lastChange: number, trend: PressureFront["trend"]) =>
  pressure >= 100 && lastChange > .05 ? "Retards en hausse" : pressureTrends[trend];
const pressureIcons: Record<PressureSectorId, MapIcon> = { health: "health", housing: "housing", transport: "industry", energy: "energy", education: "school", administration: "institution" };
const capacityNames: Record<PressureSectorId, string> = {
  health: "Capacité de soins", housing: "Capacité d’attribution", transport: "Capacité d’entretien",
  energy: "Capacité d’intervention", education: "Capacité d’enseignement", administration: "Capacité d’instruction",
};
function topicIcon(item: StoryAgendaItem): MapIcon {
  return item.id.startsWith("pressure-") ? pressureIcons[item.id.slice(9) as PressureSectorId] ?? iconForTopic(item) : iconForTopic(item);
}
function topicTone(item: StoryAgendaItem & { urgent?: boolean; pressureStage?: PressureStage; incidentStatus?: string }): "red" | "gold" | "blue" {
  if (item.pressureStage) return item.pressureStage === "disrupted" || item.pressureStage === "crisis" ? "red" : item.pressureStage === "stable" ? "blue" : "gold";
  if (item.incidentStatus === "contained") return "gold";
  return toneForTopic(item);
}
const simulatedNumber = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
const periodDate = (completedTurn: number) => completedTurn > 30
  ? `${completedTurn - 30} période${completedTurn > 31 ? "s" : ""} après le mandat`
  : `année ${Math.max(1, Math.ceil(completedTurn / 6))}, période ${Math.max(1, (completedTurn - 1) % 6 + 1)}`;

function pressureFront(front: PressureFront, selectable: boolean): string {
  const causes = [...new Set(front.causes.slice(-2).map(cause => cause.label))];
  const forecast = front.nextRiskIn !== undefined && front.nextRiskIn > 0
    ? `<p class="map-pressure__forecast">Seuil suivant estimé dans ${front.nextRiskIn} période${front.nextRiskIn > 1 ? "s" : ""}, si la tendance continue.</p>`
    : "";
  return `<li class="map-pressure__front" data-pressure-front="${front.id}" data-pressure-stage="${front.stage}" data-pressure-trend="${front.trend}" data-pressure-level="${front.pressure}"><header>${selectable ? `<button type="button" data-action="story-select" data-story-id="pressure-${front.id}" aria-label="Ouvrir le front ${pressureNames[front.id]}">${pressureNames[front.id]}</button>` : `<strong>${pressureNames[front.id]}</strong>`}<span>${pressureStages[front.stage]} · ${pressureTrendLabel(front.pressure, front.lastChange, front.trend)}</span></header><meter min="0" max="100" value="${front.pressure}" aria-label="Pression simulée sur ${pressureNames[front.id]} : ${Math.round(front.pressure)} sur 100">${Math.round(front.pressure)}/100</meter><dl><div><dt>En attente</dt><dd>${simulatedNumber(front.backlog)}</dd></div><div><dt>Besoins / période</dt><dd>${simulatedNumber(front.incomingNeed)}</dd></div><div><dt>Capacité / période</dt><dd>${simulatedNumber(front.effectiveCapacity)}</dd></div></dl><p class="map-pressure__units">Unités de besoin simulées · attente ${front.lastChange > 0 ? "+" : ""}${simulatedNumber(front.lastChange)} cette période · pression ${Math.round(front.pressure)}/100.</p>${forecast}${causes.map(cause => `<p class="map-pressure__cause">${e(cause)}</p>`).join("")}</li>`;
}

/** Every sector remains inspectable even when only the first priorities are open. */
export function mapPressureBoard(game: Game, compact = false): string {
  const pressure = game.pressure;
  if (!pressure) return "";
  const available = new Set(mapState(game).agenda.map(item => item.id));
  const fronts = Object.values(pressure.sectors).sort((a, b) => b.pressure - a.pressure);
  const accumulating = fronts.filter(front => front.lastChange > .05).length;
  const strained = fronts.filter(front => front.stage !== "stable" && front.stage !== "watch").length;
  const upcoming = pressure.programmes.filter(programme => programme.status === "preparing")
    .sort((a, b) => a.dueTurn - b.dueTurn || a.sourceTurn - b.sourceTurn);
  return `<section class="map-pressure${compact ? " map-pressure--compact" : ""}" data-pressure-board aria-label="Pressions et capacités du pays"><header><h2>Pressions du pays</h2><strong>${fronts.length} fronts suivis</strong></header><p class="map-pressure__summary"><b>${strained} sous tension</b> · ${accumulating} file${accumulating > 1 ? "s" : ""} en hausse</p>${compact ? "" : `<ul class="map-pressure__priorities">${fronts.slice(0, 3).map(front => `<li data-pressure-stage="${front.stage}"><span>${pressureNames[front.id]}</span><strong>${pressureStages[front.stage]}</strong><small>${pressureTrendLabel(front.pressure, front.lastChange, front.trend)}</small></li>`).join("")}</ul>`}<details class="map-pressure__details"><summary>Tous les fronts du pays</summary><ul>${fronts.map(front => pressureFront(front, available.has(`pressure-${front.id}`))).join("")}</ul><p class="map-pressure__execution"><strong>Mise en œuvre : ${simulatedNumber(pressure.execution.used)} / ${simulatedNumber(pressure.execution.capacity)}</strong> unités d’exécution mobilisées${pressure.execution.waiting ? ` · ${pressure.execution.waiting} chantier${pressure.execution.waiting > 1 ? "s" : ""} en attente` : ""}.</p><p class="map-pressure__units">Hypothèses du scénario. Le temps avance à chaque décision validée ; consulter un dossier ne consomme aucune période.</p></details>${upcoming[0] ? `<p class="map-pressure__next" data-pressure-next-deadline><strong>Prochaine mise en place</strong>${e(upcoming[0].label)} · au plus tôt ${periodDate(upcoming[0].dueTurn)}${upcoming[0].dueTurn <= game.turn ? " · en attente de capacité d’exécution" : ""}.</p>` : ""}</section>`;
}

function pressureChoice(choice: Choice): string {
  const pressure = choice.pressure;
  if (!pressure) return "";
  const effects = [
    pressure.capacity ? `${capacityNames[pressure.sector]} ${pressure.capacity > 0 ? "+" : ""}${simulatedNumber(pressure.capacity)}` : "",
    pressure.need ? `besoins ${pressure.need > 0 ? "+" : ""}${simulatedNumber(pressure.need)}` : "",
    pressure.backlog ? `attente ${pressure.backlog > 0 ? "+" : ""}${simulatedNumber(pressure.backlog)}` : "",
    pressure.fatigue ? `fatigue ${pressure.fatigue > 0 ? "+" : ""}${simulatedNumber(pressure.fatigue)} points` : "",
  ].filter(Boolean);
  if (!effects.length) return `<span class="map-choice__simulation">${pressure.kind === "defer" || pressure.kind === "maintain" ? "Le front continue d’évoluer pendant cette période." : "Les capacités existantes sont mobilisées."}</span>`;
  const timing = pressure.socialMovementId ? "à la mise en œuvre de l’engagement social"
    : pressure.projectId ? "à la livraison effective du projet"
    : pressure.delay ? `au plus tôt dans ${pressure.delay} période${pressure.delay > 1 ? "s" : ""}` : "dès cette période";
  return `<span class="map-choice__simulation">${e(effects.join(" · "))} · unités simulées${pressure.capacity || pressure.need || pressure.backlog ? "" : " de fatigue"}.<small>${timing}${pressure.duration ? `, pendant ${pressure.duration} période${pressure.duration > 1 ? "s" : ""}` : ""}${pressure.implementation ? ` · ${pressure.implementation} unité${pressure.implementation > 1 ? "s" : ""} d’exécution` : ""}.</small></span>`;
}

/** A persistent record distinguishes a vote from the other events of its period. */
function lastPressureReceipt(game: Game): string {
  const last = game.history.at(-1), pressure = game.pressure;
  if (!last || !pressure) return "";
  const vote = last.vote;
  const verdict = vote?.kind === "law" ? `Texte ${vote.passed ? "adopté" : "rejeté"}` : "Décision enregistrée";
  const decision = [...new Set(pressure.lastDecision.map(cleanGameText))];
  const world = [...new Set(pressure.lastWorld.map(cleanGameText))];
  return `<details class="map-last-result" data-pressure-receipt><summary>Dernière décision · ${verdict}</summary><p class="map-last-result__title">${e(last.title)}</p><section data-pressure-decision-effects><h3>Votre décision</h3>${vote?.kind === "law" ? `<p>${vote.for} pour · ${vote.against} contre · ${vote.abstain} abstentions.</p>` : ""}${vote?.kind === "law" && !vote.passed ? "<p>Le financement et les effets du texte ne sont pas appliqués.</p>" : ""}${decision.length ? `<ul>${decision.map(text => `<li>${e(text)}</li>`).join("")}</ul>` : "<p>Aucun changement direct des capacités de ces six secteurs.</p>"}</section><section data-pressure-world-effects><h3>Pendant cette période</h3>${world.length ? `<ul>${world.map(text => `<li>${e(text)}</li>`).join("")}</ul>` : "<p>Aucun autre événement de pression à signaler.</p>"}</section></details>`;
}
// The agenda identifies the problem; opening it retains the full question and choices.
const agendaEventTitles: Record<string, string> = {
  "soins-garde-nuit": "Équipes de nuit incomplètes",
  "soins-lits-aval": "Patients sans relais",
  "soins-desert-medical": "Consultations trop éloignées",
  "industrie-aide-contre-emplois": "Aide avant les embauches",
  "industrie-commandes-locales": "PME et marchés publics",
  "industrie-site-pollue": "Sol industriel à vérifier",
  "energie-bus-usine": "Bus du soir sans chauffeur",
  "energie-menages-captifs": "Chauffage sans solution",
  "energie-reseau-partage": "Financer le raccordement",
  "recrutement-postes-vacants": "Postes vacants, horaires réduits",
  "integration-diplomes": "Diplômes étrangers en attente",
  "integration-logement-travail": "Recrues sans logement",
  "integrite-interets": "Marché public à vérifier",
  "integrite-alerte": "Alerte sur un marché public",
  "integrite-pieces": "Contrat et confidentialité",
  "logement-expulsions": "Expulsions imminentes",
  "logement-vacants": "Logements vides et attente",
  "logement-construction": "Logements ou parc près de la gare",
  "suite-soins-service-bloque": "Travaux hospitaliers bloqués",
  "suite-industrie-site-bloque": "Dépollution en retard",
  "suite-energie-recharge-bloquee": "Recharge des bus bloquée",
  "suite-recrutement-residence-bloquee": "Résidence des recrues en retard",
  "suite-integrite-audit-bloque": "Audit du marché en retard",
  "suite-logement-programme-bloque": "Logements de la gare en retard",
  "ia-usine": "Automatisation de l’usine",
  "eau-equipes": "Fuite d’eau et réserves basses",
  "cyber-hopital": "Cyberattaque à l’hôpital",
  "port-bloque": "Grève au port",
  "science-stockage": "Stockage d’énergie à tester",
  "chaleur-ecoles": "Écoles face aux fortes chaleurs",
  "logements-vacants": "Emplois loin des logements",
  "ia-services": "IA pour les démarches publiques",
  "education-lycees": "Classes à regrouper",
};
function agendaTitle(item: Pick<StoryAgendaItem, "id" | "title">, game: Game): string {
  const movement = game.social?.movements.find(
    (candidate) => candidate.id === item.id && candidate.status === "active",
  );
  if (movement) {
    return {
      lyceens: "Mobilisation lycéenne",
      salaries: "Salariés mobilisés",
      retraites: "Retraités mobilisés",
      agents: "Agents publics mobilisés",
      menages: "Ménages modestes mobilisés",
    }[movement.actor];
  }
  if (item.id.startsWith("institutional:") && item.title === "Le prélèvement sur les patrimoines finance l’hôpital.") {
    return "Patrimoines et hôpital";
  }
  if (item.id.startsWith("policy:") && item.title === "Faut-il réduire les pensions pour diminuer le déficit ?") {
    return "Pensions et déficit";
  }
  return agendaEventTitles[item.id] ?? item.title;
}
const agendaTitleClass = (title: string) => title.length > 64
  ? "map-agenda__item--long-title"
  : title.length > 18 ? "map-agenda__item--medium-title" : "";
function agendaCard(item: ReturnType<typeof mapState>["agenda"][number], index: number, game: Game): string {
  const title = agendaTitle(item, game);
  const state = item.pressureStage
    ? `${pressureStages[item.pressureStage]} · ${pressureTrendLabel(item.pressureLevel ?? 0, item.pressureStockChange ?? 0, item.pressureTrend ?? "steady")}`
    : item.incidentStatus === "contained" ? "Secours opérationnel · perturbation contenue" : item.urgent ? "Urgent" : "";
  return `<button class="map-agenda__item map-tone--${topicTone(item)} ${agendaTitleClass(title)} ${item.urgent ? "map-agenda__item--urgent" : ""} ${index === 0 ? "map-agenda__item--primary" : ""}" data-action="story-select" data-story-id="${e(item.id)}" aria-label="${e(item.title)} · ${e(item.label)}${state ? ` · ${state}` : ""}"><span class="map-topic-icon">${mapIcon(topicIcon(item))}</span><span class="map-agenda__copy"><strong>${e(title)}</strong><span class="map-agenda__meta">${e(item.label)}${state ? ` · <b>${state}</b>` : ""}</span></span><svg class="map-agenda__chevron" viewBox="0 0 12 20" aria-hidden="true"><path d="m3 3 6 7-6 7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>${index === 0 ? '<span class="map-agenda__action" aria-hidden="true">Ouvrir le sujet</span>' : ""}</button>`;
}
function fallbackMap() {
  const paths = FRANCE_OUTLINES.map(
    (outline) =>
      outline
        .map(([lon, lat], i) => {
          const { x, z } = mapSourcePosition(lon, lat);
          return `${i ? "L" : "M"}${500 + x * 72},${450 - z * 72}`;
        })
        .join(" ") + "Z",
  );
  return `<svg data-map-fallback class="mandate-map__fallback" viewBox="0 0 1000 920" role="img" aria-label="Carte de France simplifiée : les sujets restent accessibles"><defs><linearGradient id="country-ground" x2="0.8" y2="1"><stop stop-color="#b7b78d"/><stop offset="1" stop-color="#7f936b"/></linearGradient></defs>${paths.map((path) => `<path d="${path}" fill="url(#country-ground)" stroke="#e3d7ac" stroke-width="2"/>`).join("")}</svg>`;
}
export function mapWorld(game: Game | null): string {
  const state = mapState(game);
  return `<section class="mandate-map" data-mandate-map data-renderer="loading" data-movements="${state.movements.length}" tabindex="0" aria-label="Carte de France et sujets du mandat. Utilisez les flèches pour déplacer la carte et les boutons pour zoomer.">
    ${fallbackMap()}<div class="mandate-map__artboard" data-map-artboard><img class="mandate-map__illustration" data-map-illustration src="${e(referenceMapUrl)}" width="1268" height="801" alt="Carte illustrée de la France : villes, campagnes, montagnes et ports" draggable="false" decoding="async" fetchpriority="high"><div class="mandate-map__effects" data-map-effects aria-live="off"></div></div>
    <div class="mandate-map__markers" data-map-markers>${state.markers
      .map((item, index) => {
        const { x, z } = item.id.startsWith("policy:") ? { x: 0, z: 0 } :
          mapSourcePosition(MAP_PLACES[item.place].lon, MAP_PLACES[item.place].lat);
        return `<button class="map-marker map-tone--${topicTone(item)} ${item.urgent ? "map-marker--urgent" : ""} ${state.selected === item.id ? "is-selected" : ""}" data-map-marker="${e(item.id)}" data-action="story-select" data-story-id="${e(item.id)}" style="left:${50 + x * 7.2 + index * 2}%;top:${49 - z * 7.8 + index * 5}%" aria-label="${e(item.title)}${item.id.startsWith("policy:") ? " · portée nationale" : ` · ${e(markerLabel(item))}`}" aria-pressed="${state.selected === item.id}">${item.urgent ? `<span class="map-marker__subject" aria-hidden="true">${e(game ? agendaTitle(item, game) : item.title)}</span>` : ""}<svg class="map-marker__leader" data-map-leader viewBox="0 0 1 1" aria-hidden="true"><path /></svg><span class="map-marker__point" aria-hidden="true">${mapIcon(topicIcon(item))}</span><span class="map-marker__anchor" data-map-anchor aria-hidden="true"></span><span class="map-marker__label">${e(item.label)}</span></button>`;
      })
      .join(
        "",
      )}${state.tracking.map((item) => `<button class="map-marker map-marker--tracking map-tone--blue" data-map-marker="${e(item.id)}" data-action="map-track" data-track-id="${e(item.id)}" aria-label="${e(item.title)} · ${e(item.label)} · En préparation"><svg class="map-marker__leader" data-map-leader viewBox="0 0 1 1" aria-hidden="true"><path /></svg><span class="map-marker__point" aria-hidden="true">${mapIcon("project")}</span><span class="map-marker__anchor" data-map-anchor aria-hidden="true"></span><span class="map-marker__label">${e(item.label)}<small>En préparation</small></span></button>`).join("")}</div>
    <button class="map-expand" data-map-toggle aria-expanded="false">Déplier la carte</button><div class="map-camera" aria-label="Déplacement et zoom de la carte"><div class="map-camera__zoom"><button data-action="map-camera" data-camera="in" aria-label="Agrandir la carte">+</button><button data-action="map-camera" data-camera="out" aria-label="Réduire la carte">−</button></div><button class="map-camera__overview" data-action="map-camera" data-camera="reset">${mapIcon("locate")}<span>Vue France</span></button></div>
    <p class="map-geography-note">France · situations simulées</p>
    <p class="map-render-status" data-map-status role="status">La carte se prépare.</p>
  </section>`;
}
function mapHeader(game: Game | null) {
  const reading = (label: string, value: number, icon: "institution" | "people", tone: "blue" | "red") => {
    const score = Math.max(0, Math.min(100, Math.round(value)));
    return `<span class="map-game__metric map-game__metric--${tone}" aria-label="${label} ${score} sur 100">${mapIcon(icon)}<span class="map-game__metric-copy"><span class="map-game__metric-title">${label}<strong>${score}</strong></span><span class="map-game__bar" style="--map-reading:${score}%" aria-hidden="true"></span></span></span>`;
  };
  let status = "";
  if (game) {
    const calendar = calendarFor(game), year = calendar.year;
    const deficit = annualDeficit(game);
    const sustainability = Math.max(0, Math.min(100, Math.round(domainFor(game).sustainability(game))));
    const budgetDescription = `${deficit > 0 ? "Déficit" : deficit < 0 ? "Excédent" : "Équilibre"} annuel ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Math.abs(deficit))} milliards d’euros, soutenabilité ${sustainability} sur 100`;
    const budgetValue = `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Math.abs(deficit))} Md€`;
    status = `<span class="map-game__calendar"><span class="map-game__year">Année ${year} / 5<small>Période ${calendar.slot} / ${calendar.slots}</small></span><span class="map-game__years" aria-hidden="true">${Array.from({ length: 5 }, (_, index) => `<i${index + 1 === year ? ' class="is-current"' : index + 1 < year ? ' class="is-complete"' : ""}></i>`).join("")}</span></span>${reading("Services", game.metrics.services, "institution", "blue")}${reading("Confiance", game.metrics.trust, "people", "red")}<button class="map-game__budget" data-action="view" data-view="finance" aria-label="État du pays" aria-describedby="map-budget-description">${mapIcon("budget")}<span class="map-game__metric-copy"><span class="map-game__budget-title">${deficit > 0 ? "Déficit" : deficit < 0 ? "Excédent" : "Équilibre"}<strong>${budgetValue}</strong></span><span class="map-game__bar" style="--map-reading:${sustainability}%" aria-hidden="true"></span></span><span class="map-game__budget-compact">${deficit > 0 ? "Déficit" : "Solde"}<strong>${budgetValue}</strong></span></button><span id="map-budget-description" class="map-visually-hidden">${budgetDescription}</span>`;
  }
  return `<header class="map-game__header"><a href="/mandats/" class="map-game__brand" aria-label="Accueil Mandats">MANDATS</a><div class="map-game__status${game ? "" : " map-game__status--empty"}">${status}<button class="map-game__tools" data-action="tools" aria-label="Ma partie" title="Ma partie">${mapIcon("settings")}<span class="map-game__tools-label">Ma partie</span></button></div></header>`;
}
function mapFooter(active: "country" | "finance" | null): string {
  return `<footer class="map-game__footer"><nav aria-label="Vues du mandat"><button data-action="view" data-view="decision"${active === "country" ? ' aria-current="page"' : ""}>${mapIcon("country")}<span>Pays</span></button><button data-action="map-government" aria-haspopup="dialog">${mapIcon("institution")}<span>Gouvernement</span></button><button data-action="map-projects" aria-haspopup="dialog">${mapIcon("project")}<span>Projets</span></button><button data-action="view" data-view="finance"${active === "finance" ? ' aria-current="page"' : ""}>${mapIcon("balance")}<span>Bilan</span></button></nav><p class="map-game__fiction">Scénario fictif</p></footer>`;
}
export function mapEntry(saved: Game | null): string {
  const contexts = {
    coalition: "Une coalition fragile",
    hospital: "Un hôpital à sauver",
    redress: "Des comptes à redresser",
  };
  return `<section class="map-game map-game--entry">${mapHeader(null)}${mapWorld(null)}<section class="map-entry"><p class="map-entry__kicker">GOUVERNER LA FRANCE</p><h1 tabindex="-1">Tenir cinq ans.</h1><p>Des sujets apparaissent dans le pays. Vos décisions changent leur suite.</p>${saved ? `<button class="map-primary" data-action="resume">Reprendre</button><p class="map-entry__saved">Année ${calendarFor(saved).year} · ${saved.turn} décisions enregistrées</p>` : ""}<button class="${saved ? "map-secondary" : "map-primary"}" data-action="new-run">${saved ? "Nouveau mandat" : "Commencer un mandat"}</button><details class="map-entry__contexts"><summary>Choisir une situation de départ</summary>${storyContextOptions()
    .map(
      (item) =>
        `<button data-action="start-context" data-context="${item.context}">${contexts[item.context]}</button>`,
    )
    .join(
      "",
    )}</details><a href="/mandats/methode/">Règles et méthode</a></section></section>`;
}
export function mapGame(game: Game, shared = false): string {
  const markers = mapState(game).agenda;
  const primary = markers.find(item => item.urgent) ?? markers[0];
  const agenda = primary ? [primary, ...markers.filter(item => item.id !== primary.id)] : markers;
  const focus = agenda.find((item) => item.id === game.narrative?.focus);
  const event = focus ? focusedNarrativeEvent(game) : undefined;
  const choices = focus ? choicesFor(game) : [];
  const place = focus ? MAP_PLACES[placeForTopic(focus)] : undefined;
  const summary = focus ? firstSentence(focus.summary) : "";
  const incident = focus && game.version >= 14 && isPressureIncidentId(focus.id)
    ? { spec: PRESSURE_INCIDENTS[focus.id], contained: focus.incidentStatus === "contained" } : undefined;
  const incidentReading = incident
    ? `<p class="map-subject__deadline" data-map-incident>${incident.contained ? "Secours opérationnel ; la perturbation reste à résoudre." : "Crise active ; aucune réponse n’est encore opérationnelle."} Capacité effective réduite de ${simulatedNumber(incident.contained ? incident.spec.containedLoss : incident.spec.capacityLoss)} unité par période (hypothèse de simulation). Les retards acquis restent à rattraper.</p>`
    : "";
  const details = focus
    ? `<details class="map-subject__details"><summary>Voir les détails</summary><p>${e(focus.summary)}</p>${choices.map((choice) => `<section><h3>${e(choice.title)}</h3><p>${e(choice.description)}</p><p>${e(choice.cost)}</p><p>${e(choice.benefit)}</p>${choice.delayed ? `<p>Après ${choice.delayed.after} année${choice.delayed.after > 1 ? "s" : ""} : ${e(choice.delayed.label)}</p>` : ""}</section>`).join("")}<p class="map-fiction-note">Événement fictif du scénario. ${focus.id.startsWith("policy:") || focus.id.startsWith("institutional:") ? "Décision de portée nationale." : `${e(place!.name)} sert de repère géographique ; les personnes et organismes sont simulés.`}</p></details>`
    : "";
  const urgent =
    focus?.dueTurn !== undefined
      ? `<p class="map-subject__deadline">Échéance : ${periodDate(focus.dueTurn + 1)}.</p>`
      : focus?.id.startsWith("mvt-")
        ? `<p class="map-subject__deadline">${e(String(focus.urgency))}</p>`
        : "";
  return `<section class="map-game map-game--playing ${focus ? "map-game--focused" : ""}" data-map-game data-turn="${game.turn}">${mapHeader(game)}${mapWorld(game)}
    <section class="map-subject ${focus ? "" : "map-subject--agenda"}" ${focus ? "data-map-decision" : "data-map-agenda"}>${mapPressureBoard(game, !!focus)}${focus ? "" : lastPressureReceipt(game)}
      ${
        focus
          ? `<p class="map-subject__eyebrow map-tone--${topicTone(focus)}"><span class="map-topic-icon">${mapIcon(topicIcon(focus))}</span>${e(focus.label)}</p><header><h1 tabindex="-1">${e(event?.title ?? focus.title)}</h1><button data-action="map-close" aria-label="Fermer le sujet">Fermer</button></header><p class="map-subject__intro">${e(summary)}</p>${urgent}${incidentReading}<div class="map-choices">${choices
              .map((choice) => {
                const error = preview(game, choice.id).error;
                return `<button class="choice map-choice" data-action="choose" data-choice="${e(choice.id)}" ${error ? "disabled" : ""}><strong>${e(choice.title)}</strong><span>${e(choice.sacrifice)}</span>${pressureChoice(choice)}<span class="map-choice__footer"><small>${e(choice.cost)}</small><span class="map-choice__action" aria-hidden="true">Choisir</span></span>${error ? `<span class="choice-error">${e(error)}</span>` : ""}</button>`;
              })
              .join(
                "",
              )}</div>${focus.id.startsWith("policy:") ? "" : `<button class="map-inspect" data-action="map-inspect" data-place="${placeForTopic(focus)}">Voir le lieu</button>`}${details}`
          : `<h1 tabindex="-1" class="map-agenda__heading">À traiter</h1><div class="map-agenda">${agenda.slice(0, game.pressure ? 3 : agenda.length).map((item, index) => agendaCard(item, index, game)).join("")}</div>${game.pressure && agenda.length > 3 ? `<details class="map-other-dossiers"><summary>Autres dossiers (${agenda.length - 3})</summary><div class="map-agenda">${agenda.slice(3).map((item, index) => agendaCard(item, index + 3, game)).join("")}</div></details>` : ""}<ul class="map-agenda__legend" aria-label="Repères de la carte"><li class="map-tone--red"><span class="map-topic-icon">${mapIcon("people")}</span>Urgent</li><li class="map-tone--gold"><span class="map-topic-icon">${mapIcon("health")}</span>À surveiller</li><li class="map-tone--blue"><span class="map-topic-icon">${mapIcon("industry")}</span>Projet</li></ul>`
      }
      ${focus ? lastPressureReceipt(game) : ""}${shared ? '<p class="map-fiction-note">Parcours partagé. Votre sauvegarde reste intacte.</p>' : ""}
    </section>${mapFooter("country")}
  </section>`;
}

const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
function countryReadings(game: Game): string {
  const balance = game.history.at(-1)?.ledger.deficit ?? annualDeficit(game);
  return `<dl class="map-readings"><div><dt>${balance < 0 ? "Excédent annuel" : "Déficit annuel"}</dt><dd>${amount.format(Math.abs(balance))}<small>Md€</small></dd></div><div><dt>Services publics</dt><dd>${Math.round(game.metrics.services)}<small>/ 100</small></dd></div><div><dt>Confiance</dt><dd>${Math.round(game.metrics.trust)}<small>/ 100</small></dd></div></dl>`;
}
function commitments(game: Game): string {
  const projects = game.narrative?.projects ?? [],
    movements = game.social?.movements ?? [];
  const projectNames = {
    funded: "En préparation",
    blocked: "Bloqué",
    delivered: "Livré",
    withdrawn: "Abandonné",
  } as const;
  return `<details class="map-subject__details"><summary>Projets et engagements</summary>${projects.length ? `<ul>${projects.map((item) => `<li><strong>${e(item.label)}</strong><p>${projectNames[item.status]} · ${e(item.note)}</p></li>`).join("")}</ul>` : "<p>Aucun projet engagé.</p>"}${movements.map((item) => `<p>${e(item.demand)} : ${item.status === "resolved" ? "mobilisation résolue" : item.commitment?.status === "pending" ? "moyens votés, mise en place attendue" : "mobilisation active"}.</p>`).join("")}${(game.narrative?.promises ?? []).map((item) => `<p>${e(item.label)} : ${({ active: "en cours", kept: "tenue", broken: "rompue" } as const)[item.status]}.</p>`).join("")}</details>`;
}
export function mapYear(game: Game): string {
  const year = game.history.at(-1)!.year,
    decisions = game.history.filter((item) => item.year === year);
  return `<section class="map-game map-game--playing">${mapHeader(game)}${mapWorld(game)}<section class="map-subject map-summary" data-map-year><p class="map-entry__kicker">ANNÉE ${year} ACHEVÉE</p><h1 tabindex="-1">Le mandat continue.</h1><p class="map-subject__intro">Les décisions de cette année restent inscrites dans le pays.</p>${countryReadings(game)}${mapPressureBoard(game, true)}${lastPressureReceipt(game)}<button class="map-primary" data-action="next-year">Reprendre le mandat</button>${commitments(game)}<details class="map-subject__details"><summary>Les ${decisions.length} décisions de l’année</summary><ol>${decisions.map((item) => `<li>${e(item.title)}</li>`).join("")}</ol></details></section>${mapFooter("country")}</section>`;
}
export function mapResult(game: Game, shared = false): string {
  const complete = game.politics?.ending?.kind === "term_complete",
    epilogue = narrativeElectionOutcome(game);
  return `<section class="map-game map-game--playing">${mapHeader(null)}${mapWorld(game)}<article class="map-subject map-summary map-result" data-map-result><p class="map-entry__kicker">${shared ? "MANDAT PARTAGÉ" : complete ? "CINQ ANS ACCOMPLIS" : "MANDAT INTERROMPU"}</p><h1 tabindex="-1">${complete ? "Vous avez tenu cinq ans." : e(game.politics?.ending?.title ?? "Le mandat s’achève.")}</h1><p class="map-subject__intro">${complete ? `${game.turn} décisions. Le pays garde leurs conséquences.` : e(game.politics?.ending?.reason ?? `${game.turn} décisions enregistrées.`)}</p>${countryReadings(game)}${mapPressureBoard(game, true)}${lastPressureReceipt(game)}<button class="map-primary" data-action="new-run">Nouveau mandat</button><button class="map-secondary" data-action="open-replay-selection">Rejouer un tournant du mandat</button><button class="map-inspect" data-action="view" data-view="finance">Consulter le bilan complet</button>${commitments(game)}${epilogue ? `<details class="map-subject__details"><summary>La suite politique</summary><h3>${e(epilogue.title)}</h3><p>${e(epilogue.detail)}</p></details>` : ""}<details class="map-subject__details"><summary>Partager ou retrouver ce scénario</summary><button class="map-secondary" data-action="share">Partager cet héritage</button><button class="map-secondary" data-action="replay">Rejouer exactement ce défi</button><p>Scénario ${game.seed} · version ${game.version} · simulation.</p></details></article>${mapFooter("country")}</section>`;
}
export function mapReview(
  game: Game,
  accounts: string,
  journal: string,
): string {
  return `<section class="map-game map-game--playing">${mapHeader(game)}${mapWorld(game)}<section class="map-subject map-summary" data-map-review><header><h1 tabindex="-1">État du pays</h1><button data-action="view" data-view="decision">Revenir au mandat</button></header>${countryReadings(game)}${mapPressureBoard(game)}${lastPressureReceipt(game)}<details class="map-subject__details"><summary>Comptes et indicateurs</summary>${accounts}</details><details class="map-subject__details"><summary>Les effets sur les territoires</summary>${game.areas.map((item) => `<button class="map-secondary" data-action="area" data-area="${item.id}">${e(item.name)} · services ${Math.round(item.services)}/100</button>`).join("")}</details>${commitments(game)}<details class="map-subject__details"><summary>Le journal de vos décisions</summary>${journal}</details></section>${mapFooter("finance")}</section>`;
}
export function mapReplay(game: Game, content: string): string {
  return `<section class="map-game map-game--playing">${mapHeader(null)}${mapWorld(game)}<section class="map-subject map-summary map-replay">${content}</section>${mapFooter(null)}</section>`;
}
