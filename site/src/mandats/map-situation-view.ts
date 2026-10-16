import { storyAgenda } from "./narrative-engine.ts";
import { PRESSURE_INCIDENTS } from "./pressure-content.ts";
import { escape } from "./sharing.ts";
import type { PressureFront, PressureSectorId } from "./pressure-types.ts";
import type { Game } from "./types.ts";

const sectorOrder: PressureSectorId[] = ["health", "housing", "transport", "energy", "education", "administration"];
const sectorNames: Record<PressureSectorId, string> = {
  health: "Santé", housing: "Logement", transport: "Transports",
  energy: "Eau et énergie", education: "Enseignement", administration: "Démarches publiques",
};
const shortNames: Record<PressureSectorId, string> = {
  ...sectorNames, energy: "Eau / énergie", administration: "Démarches",
};
const mobileNames: Record<PressureSectorId, string> = {
  ...shortNames, energy: "Énergie", education: "Éducation",
};
const stageNames = {
  stable: "Maîtrisé", watch: "À surveiller", strained: "Sous tension",
  disrupted: "Perturbé", crisis: "En crise",
} as const;
const trendNames = { improving: "en baisse", steady: "stable", worsening: "en hausse" } as const;
const trendShort = { improving: "baisse", steady: "stable", worsening: "hausse" } as const;
const trendSigns = { improving: "↓", steady: "→", worsening: "↑" } as const;
const number = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
const e = (value: string) => escape(value.replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim());
const availableFor = (game: Game) => new Set(game.politics?.ending || game.turn >= 30 ? [] : storyAgenda(game).map(item => item.id));
const activeGame = (game: Game) => game.version === 14 && game.mode === "national" && !!game.pressure;

function trendLabel(front: PressureFront): string {
  return front.pressure >= 100 && front.lastChange > .05 ? "retards en hausse" : `pression ${trendNames[front.trend]}`;
}

function periodDate(turn: number): string {
  if (turn > 30) return `${turn - 30} période${turn > 31 ? "s" : ""} après le mandat`;
  return `année ${Math.max(1, Math.ceil(turn / 6))}, période ${Math.max(1, (turn - 1) % 6 + 1)}`;
}

type News = { label: string; text: string; tone: "alert" | "watch" | "neutral" };

/** A saved-state headline, never a clock, scrolling ticker or simulated extra event. */
export function mapSituationNews(game: Game): string {
  if (!activeGame(game)) return "";
  const pressure = game.pressure!;
  const politics = game.politics;
  const fronts = Object.values(pressure.sectors).sort((a, b) => b.pressure - a.pressure);
  const incident = pressure.incidents?.find(item => item.status === "active")
    ?? pressure.incidents?.find(item => item.status === "contained");
  const politicalAlerts = {
    coalition: "Un accord de coalition reste à trouver.", censure: "Une motion de censure menace le gouvernement.",
    cabinet: "Un nouveau gouvernement doit être constitué.", scandal: "Une affaire fragilise le pouvoir.",
    destitution: "Une procédure de destitution est ouverte.", rupture: "La continuité du mandat est en jeu.",
  };
  let news: News;
  if (politics?.ending) news = { label: "MANDAT ACHEVÉ", text: politics.ending.reason, tone: "neutral" };
  else if (politics?.institutionalCrisis) {
    const crisis = politics.institutionalCrisis;
    news = { label: "CRISE INSTITUTIONNELLE", text: crisis.stage === "regime"
      ? "La continuité du mandat est en jeu."
      : `${crisis.remaining} décision${crisis.remaining > 1 ? "s" : ""} pour réparer la crise institutionnelle.`, tone: "alert" };
  } else if (politics?.pendingCrisis) news = { label: "ALERTE POLITIQUE", text: politicalAlerts[politics.pendingCrisis], tone: "alert" };
  else if (incident) news = {
    label: incident.status === "active" ? "CRISE ACTIVE" : "SECOURS EN PLACE",
    text: `${PRESSURE_INCIDENTS[incident.id].label}.`,
    tone: incident.status === "active" ? "alert" : "watch",
  };
  else {
    const front = fronts[0];
    news = { label: "FRONT À SUIVRE", text: `${sectorNames[front.id]} : ${stageNames[front.stage].toLocaleLowerCase("fr")} (${Math.round(front.pressure)}/100), ${trendLabel(front)}.`,
      tone: front.stage === "crisis" || front.stage === "disrupted" ? "alert" : front.stage === "stable" ? "neutral" : "watch" };
  }
  const next = pressure.programmes.filter(item => item.status === "preparing")
    .sort((a, b) => a.dueTurn - b.dueTurn || a.sourceTurn - b.sourceTurn)[0];
  const risk = fronts.filter(front => front.nextRiskIn !== undefined && front.nextRiskIn > 0)
    .sort((a, b) => a.nextRiskIn! - b.nextRiskIn!)[0];
  const horizon = politics?.ending || game.turn >= 30 ? ""
    : next ? next.dueTurn <= game.turn ? "Mise en place : échéance atteinte, mesure toujours en attente."
      : `Prochaine mise en place : ${periodDate(next.dueTurn)}, au plus tôt.`
    : risk ? `${sectorNames[risk.id]} : seuil suivant estimé dans ${risk.nextRiskIn} période${risk.nextRiskIn! > 1 ? "s" : ""}, si la tendance continue.` : "";
  return `<section class="map-situation-news" data-situation-news data-situation-turn="${game.turn}" data-news-tone="${news.tone}" aria-label="Fil de situation du pays : ${e(news.text)}${horizon ? ` ${e(horizon)}` : ""}"><span class="map-situation-news__label">${news.label}</span><div><p>${e(news.text)}</p>${horizon ? `<p class="map-situation-news__horizon">${e(horizon)}</p>` : ""}</div><button type="button" data-action="view" data-view="finance" aria-label="Consulter le bilan de la situation">Bilan<span aria-hidden="true">›</span></button><div class="map-situation-news__notice" data-situation-notice-slot></div></section>`;
}

function frontButton(front: PressureFront, available: boolean): string {
  const risingRetards = front.pressure >= 100 && front.lastChange > .05;
  const trend = risingRetards ? "worsening" : front.trend;
  const label = `${sectorNames[front.id]} : ${Math.round(front.pressure)} sur 100, ${stageNames[front.stage].toLocaleLowerCase("fr")}, ${trendLabel(front)}. ${available ? "Ouvrir ce front." : "Consulter le bilan."}`;
  return `<button type="button" class="map-situation-front" data-situation-sector="${front.id}" data-situation-front="${front.id}" data-pressure-stage="${front.stage}" data-pressure-trend="${front.trend}" data-pressure-level="${front.pressure}" ${available ? `data-action="story-select" data-story-id="pressure-${front.id}"` : `data-action="view" data-view="finance"`} aria-label="${e(label)}"><span class="map-situation-front__name"><span class="map-situation-front__name-full">${shortNames[front.id]}</span><span class="map-situation-front__name-mobile">${mobileNames[front.id]}</span></span><span class="map-situation-front__reading"><span class="map-situation-front__value"><strong>${Math.round(front.pressure)}</strong><small>/100</small></span><span class="map-situation-front__trend"><i aria-hidden="true">${trendSigns[trend]}</i>${risingRetards ? "retards" : trendShort[trend]}</span></span><meter min="0" max="100" value="${front.pressure}" aria-label="Pression simulée : ${Math.round(front.pressure)} sur 100">${Math.round(front.pressure)}/100</meter><span class="map-situation-front__stage">${stageNames[front.stage]}</span></button>`;
}

/** Six simultaneous sectors and the actual means available to the saved mandate. */
export function mapSituationDock(game: Game): string {
  if (!activeGame(game)) return "";
  const pressure = game.pressure!;
  const available = availableFor(game);
  const execution = pressure.execution;
  const politics = game.politics;
  const seats = politics?.blocs.reduce((total, bloc) => total + bloc.seats, 0) ?? 0;
  const coalition = politics?.blocs.filter(bloc => bloc.inGovernment).reduce((total, bloc) => total + bloc.seats, 0) ?? 0;
  const majority = Math.floor(seats / 2) + 1;
  return `<section class="map-situation-dock" data-situation-dock aria-label="Les six fronts du pays, indices de simulation"><div class="map-situation-dock__fronts">${sectorOrder.map(id => frontButton(pressure.sectors[id], available.has(`pressure-${id}`))).join("")}</div><div class="map-situation-dock__means"><button type="button" data-action="map-projects" data-situation-execution data-execution-used="${execution.used}" data-execution-capacity="${execution.capacity}" data-execution-waiting="${execution.waiting}" aria-label="Mise en œuvre : ${number(execution.used)} sur ${number(execution.capacity)} unités d’exécution mobilisées, ${execution.waiting} chantier${execution.waiting > 1 ? "s" : ""} en attente. Consulter les projets."><span>Exécution</span><strong>${number(execution.used)}<small> / ${number(execution.capacity)}</small></strong><span class="map-situation-dock__waiting">${execution.waiting} en attente</span></button>${politics ? `<button type="button" data-action="map-government" data-situation-coalition data-coalition-seats="${coalition}" data-coalition-majority="${majority}" aria-label="Coalition : ${coalition} sièges. Majorité absolue : ${majority} sièges sur ${seats}. Consulter le gouvernement."><span>Coalition</span><strong>${coalition}<small> / ${majority}</small></strong><span class="map-situation-dock__majority">majorité</span></button>` : ""}<span class="map-situation-dock__note">Indices simulés</span></div></section>`;
}
