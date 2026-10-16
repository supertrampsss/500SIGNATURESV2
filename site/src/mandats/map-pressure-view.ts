import { storyAgenda } from "./narrative-engine.ts";
import { escape } from "./sharing.ts";
import type { PressureFront, PressureProgramme, PressureSectorId } from "./pressure-types.ts";
import type { Game } from "./types.ts";

const names: Record<PressureSectorId, string> = {
  health: "Santé",
  housing: "Logement",
  transport: "Transports",
  energy: "Énergie",
  education: "Enseignement",
  administration: "Démarches publiques",
};
const stages = {
  stable: "Maîtrisé",
  watch: "À surveiller",
  strained: "Sous tension",
  disrupted: "Perturbé",
  crisis: "En crise",
} as const;
const trends = {
  improving: "Pression en baisse",
  steady: "Pression stable",
  worsening: "Pression en hausse",
} as const;
const number = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
const text = (value: string) => escape(value.replace(/[—–]/g, ", ").replace(/[←→↗↘↔›‹»«]/g, "").replace(/\s+/g, " ").trim());
const periodDate = (completedTurn: number) => completedTurn > 30
  ? `${completedTurn - 30} période${completedTurn > 31 ? "s" : ""} après le mandat`
  : `année ${Math.max(1, Math.ceil(completedTurn / 6))}, période ${Math.max(1, (completedTurn - 1) % 6 + 1)}`;

function pressureFront(front: PressureFront, selectable: boolean): string {
  const name = names[front.id];
  const trend = front.pressure >= 100 && front.lastChange > .05 ? "Retards en hausse" : trends[front.trend];
  const causes = [...new Set(front.causes.slice(-2).map(cause => cause.label))];
  const title = selectable
    ? `<button type="button" data-action="story-select" data-story-id="pressure-${front.id}" aria-label="Ouvrir le front ${name}">${name}<span aria-hidden="true">›</span></button>`
    : name;
  return `<li class="map-pressure__front" data-pressure-front="${front.id}" data-pressure-stage="${front.stage}" data-pressure-trend="${front.trend}" data-pressure-level="${front.pressure}">
    <header><div><h3>${title}</h3><p class="map-pressure__stage">${stages[front.stage]}</p></div><p class="map-pressure__index"><strong>${Math.round(front.pressure)}</strong><span>/ 100</span></p></header>
    <meter min="0" max="100" value="${front.pressure}" aria-label="Pression simulée sur ${name} : ${Math.round(front.pressure)} sur 100">${Math.round(front.pressure)}/100</meter>
    <p class="map-pressure__trend">${trend}<span>Attente ${front.lastChange > 0 ? "+" : ""}${number(front.lastChange)} cette période</span></p>
    <dl><div><dt>En attente</dt><dd>${number(front.backlog)}</dd></div><div><dt>Besoins / période</dt><dd>${number(front.incomingNeed)}</dd></div><div><dt>Capacité / période</dt><dd>${number(front.effectiveCapacity)}</dd></div></dl>
    <p class="map-pressure__units">Unités de besoin simulées.</p>
    ${front.nextRiskIn !== undefined && front.nextRiskIn > 0 ? `<p class="map-pressure__forecast">Seuil suivant estimé dans ${front.nextRiskIn} période${front.nextRiskIn > 1 ? "s" : ""}, si la tendance continue.</p>` : ""}
    ${causes.length ? `<ul class="map-pressure__causes">${causes.map(cause => `<li>${text(cause)}</li>`).join("")}</ul>` : ""}
  </li>`;
}

function deadlines(programmes: PressureProgramme[], turn: number): string {
  if (!programmes.length) return "";
  return `<section class="map-pressure__deliveries" aria-label="Échéances des mesures financées"><h3>À venir</h3><ol>${programmes.map((programme, index) => `<li${index === 0 ? " data-pressure-next-deadline" : ""}><strong>${text(programme.label)}</strong><span>Au plus tôt ${periodDate(programme.dueTurn)}${programme.dueTurn <= turn ? " · en attente de capacité d’exécution" : ""}.</span></li>`).join("")}</ol></section>`;
}

/** The compact disclosure leaves decisions first; all six saved fronts remain inspectable. */
export function mapPressureBoard(game: Game, compact = false): string {
  const pressure = game.pressure;
  if (!pressure) return "";
  const available = new Set(game.politics?.ending ? [] : storyAgenda(game).map(item => item.id));
  const fronts = Object.values(pressure.sectors).sort((a, b) => b.pressure - a.pressure);
  const strained = fronts.filter(front => front.stage !== "stable" && front.stage !== "watch").length;
  const accumulating = fronts.filter(front => front.lastChange > .05).length;
  const upcoming = pressure.programmes.filter(programme => programme.status === "preparing")
    .sort((a, b) => a.dueTurn - b.dueTurn || a.sourceTurn - b.sourceTurn);
  const count = strained ? `${strained} sous tension` : `${fronts.length} fronts suivis`;
  const summary = `<p class="map-pressure__summary"><strong>${strained} sous tension</strong><span>${accumulating} file${accumulating > 1 ? "s" : ""} en hausse</span></p>`;
  const body = `${summary}<ul class="map-pressure__fronts" aria-label="Les ${fronts.length} fronts du pays">${fronts.map(front => pressureFront(front, available.has(`pressure-${front.id}`))).join("")}</ul>
    <section class="map-pressure__execution" aria-label="Capacité de mise en œuvre"><div><h3>Mise en œuvre</h3><p>${pressure.execution.waiting ? `${pressure.execution.waiting} chantier${pressure.execution.waiting > 1 ? "s" : ""} en attente` : "Aucun chantier en attente"}</p></div><p class="map-pressure__execution-value"><strong>${number(pressure.execution.used)} / ${number(pressure.execution.capacity)}</strong><span>unités d’exécution mobilisées</span></p></section>
    ${deadlines(upcoming, game.turn)}
    <p class="map-pressure__method">Hypothèses du scénario. Une période dure deux mois et avance à chaque décision validée. Consulter un dossier ne consomme aucune période.</p>`;
  return `<section class="map-pressure${compact ? " map-pressure--compact" : ""}" data-pressure-board aria-label="Pressions et capacités du pays">${compact
    ? `<details class="map-pressure__details"><summary><strong>Pressions du pays</strong><span class="map-pressure__count${strained ? " map-pressure__count--alert" : ""}">${count}</span></summary><div class="map-pressure__body">${body}</div></details>`
    : `<header class="map-pressure__heading"><p>LES SIX FRONTS</p><h2>Pressions du pays</h2></header>${body}`}</section>`;
}
