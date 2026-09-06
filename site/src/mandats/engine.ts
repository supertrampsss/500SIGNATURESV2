import * as legacy from "./legacy/engine.ts";
import { ambitionFor } from "./ambitions.ts";
import { municipal } from "./municipal.ts";
import { national } from "./national.ts";
import { clamp } from "./types.ts";
import type { Ambition, Choice, Domain, Effect, Game, Mode } from "./types.ts";
import type { CityBaseline } from './cities.ts';
import { campaignDomain, campaignChoices, decideCampaign, startCampaign } from './campaign.ts';
export { calendarFor } from './calendar.ts';

export const DOMAINS: Record<Mode, Domain> = { municipal, national };
export function domainFor(g:Game):Domain { return g.version >= 3?campaignDomain(g):DOMAINS[g.mode]; }
export function startingGame(g:Game):Game { return start(g.mode,g.seed,g.ambition,g.version,g.city); }
export function replayGame(g:Game,ids:string[]):Game { return replay(g.mode,g.seed,ids,g.version,g.ambition,g.city); }
const RECOVERY: Choice = { id: "redressement", title: "Réduire les charges pour rétablir l'équilibre", description: "Suspendre des prestations et renoncer au nouveau projet de l'année.", cost: "−6 M€ de charges par an", benefit: "Rétablir la capacité de remboursement", sacrifice: "Services −10, confiance −8", effect: { operating: -6, services: -10, trust: -8, cohesion: -4 } };
export function choicesFor(g: Game): Choice[] {
  if(g.version >= 3)return campaignChoices(g);
  if (g.version === 1) return legacy.choicesFor(g);
  const choices = DOMAINS[g.mode].dossiers[g.turn]?.choices ?? [];
  return choices.length && choices.every(c => !preview(g, c.id).game) ? [...choices, RECOVERY] : choices;
}
export function start(mode: Mode, seed = 42, ambition: Ambition = "equilibre", version: 1 | 2 | 3 | 4 | 5 = 2, city?:CityBaseline): Game {
  if (version === 1) return legacy.start(mode, seed);
  if (version === 5 && (mode !== "national" || city)) throw new Error("La version 5 concerne uniquement le mandat national.");
  if (!["equilibre", "services", "resilience"].includes(ambition)) throw new Error("Priorité invalide.");
  if (!Object.hasOwn(DOMAINS, mode) || !Number.isInteger(seed) || seed < 0 || seed > 9999) throw new Error("Scénario invalide.");
  if(version >= 3)return startCampaign(mode,seed,ambition,city,version as 3 | 4 | 5);
  return { version: 2, ambition, mode, seed, turn: 0, ...DOMAINS[mode].initial(), pending: [], history: [], choices: [] };
}
function apply(g: Game, e: Effect) {
  for (const key of ["revenue", "operating", "investment", "grants", "repayment", "growth"] as const) g.finance[key] += e[key] ?? 0;
  for (const key of ["services", "cohesion", "resilience", "trust", "assets"] as const) g.metrics[key] = clamp(g.metrics[key] + (e[key] ?? 0));
  for (const area of g.areas) if (!e.area || area.id === e.area) {
    area.services = clamp(area.services + (e.services ?? 0));
    area.resilience = clamp(area.resilience + (e.resilience ?? 0));
  }
}
/** Pure transition. Choices are IDs in the frozen scenario, never arbitrary effects. */
export function decide(game: Game, choiceId: string): Game {
  if(game.version >= 3)return decideCampaign(game,choiceId);
  if (game.version === 1) return legacy.decide(game, choiceId);
  const d = DOMAINS[game.mode];
  if (game.turn >= d.turns) throw new Error("Ce mandat est terminé.");
  const choice = d.dossiers[game.turn].choices.find(c => c.id === choiceId) ?? (choiceId === RECOVERY.id && d.dossiers[game.turn].choices.every(c => !preview(game, c.id).game) ? RECOVERY : undefined);
  if (!choice) throw new Error("Cette décision n'appartient pas à ce tour.");
  const g = structuredClone(game);
  g.finance = d.prepare(g.finance);
  const messages: string[] = [];
  for (const due of g.pending.filter(p => p.due === g.turn)) { apply(g, due.effect); messages.push(due.label); }
  g.pending = g.pending.filter(p => p.due > g.turn);
  apply(g, { services: -1, assets: -2 });
  apply(g, choice.effect);
  if (choice.delayed) g.pending.push({ due: g.turn + choice.delayed.after, label: choice.delayed.label, effect: choice.delayed.effect });
  const event = d.event(g);
  apply(g, event.effect);
  const ledger = d.settle(g.finance);
  g.finance.debt = ledger.debt;
  g.finance.cash += ledger.cashChange;
  g.finance.gdp = ledger.gdp;
  if (g.finance.cash < -1e-8) throw new Error("Financement incomplet : la trésorerie ne peut être négative.");
  messages.push(choice.benefit, `Arbitrage accepté : ${choice.sacrifice.toLocaleLowerCase("fr")}.`);
  if (choice.delayed) messages.push(`Effet attendu : année ${g.turn + choice.delayed.after + 1}.`);
  g.history.push({ year: g.turn + 1, choice: choice.id, title: choice.title, messages, event: event.label, ledger, metrics: structuredClone(g.metrics), areas: structuredClone(g.areas) });
  g.choices.push(choice.id);
  g.turn++;
  return g;
}
export function preview(g: Game, id: string): { game: Game | null; error: string | null } {
  try { return { game: decide(g, id), error: null }; } catch (e) { return { game: null, error: e instanceof Error ? e.message : "Décision invalide." }; }
}
export function score(g: Game) {
  if (g.version === 1) return legacy.score(g);
  const dimensions = { finances: domainFor(g).sustainability(g), services: g.metrics.services, cohesion: .7 * g.metrics.cohesion + .3 * g.metrics.trust, resilience: (g.metrics.resilience + g.metrics.assets) / 2 };
  const costScale=g.version >= 3 && g.city ? g.city.observed.revenue/100_000_000 : 1;
  const terminalPenalty = g.pending.filter(p => (p.effect.operating ?? 0) > 0).reduce((sum, p) => sum + Math.min(5, (p.effect.operating ?? 0)/costScale), 0);
  const total = Math.round(clamp(Object.entries(dimensions).reduce((sum, [key, value]) => sum + value * ambitionFor(g).weights[key as keyof typeof dimensions], 0) - terminalPenalty));
  const labels: Record<string, string> = { finances: "Finances", services: "Services", cohesion: "Cohésion & confiance", resilience: "Résilience & patrimoine" };
  const ordered = Object.entries(dimensions).sort((a, b) => b[1] - a[1]);
  return { total, dimensions, terminalPenalty, strength: labels[ordered[0][0]], weakness: labels[ordered.at(-1)![0]], legacy: g.mode === "national" ? (total >= 50 ? "Une trajectoire consolidée" : total >= 40 ? "Un cap à renforcer" : "Un mandat sous tension") : (total >= 70 ? "Un héritage solide" : total >= 55 ? "Un équilibre à consolider" : "Un mandat sous tension") };
}
export function replay(mode: Mode, seed: number, ids: string[], version: 1 | 2 | 3 | 4 | 5 = 2, ambition: Ambition = "equilibre", city?:CityBaseline): Game {
  if (!Object.hasOwn(DOMAINS, mode) || !Array.isArray(ids) || ids.length > (version >= 3?45:DOMAINS[mode].turns)) throw new Error("Journal trop long.");
  return ids.reduce((g, id) => decide(g, id), start(mode, seed, ambition, version,city));
}
