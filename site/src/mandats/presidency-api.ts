/** Views share a board; every saved version keeps its own simulation. */
import type { Game, Choice } from './types.ts';
import type { PressureSectorId } from './pressure-types.ts';
import * as legacy from './presidency-engine.ts';
import { strategyActions, strategyReforms, strategyEvents, strategyLedger,
  strategyPriorityChoice, strategyBudgetChoices, strategyCreditsChoice } from './presidency-strategy-engine.ts';

export type { PresidencyEvent } from './presidency-engine.ts';
export { strategyOutcome } from './presidency-strategy-engine.ts';
export const presidencyActions = (game: Game, sector: PressureSectorId) => game.version === 17 ? strategyActions(game, sector) : legacy.presidencyActions(game, sector);
export const presidencyReforms = (game: Game) => game.version === 17 ? strategyReforms(game) : legacy.presidencyReforms(game);
export const presidencyEvents = (game: Game) => game.version === 17 ? strategyEvents(game) : legacy.presidencyEvents(game);
export const presidencyLedger = (game: Game) => game.version === 17 ? strategyLedger(game) : legacy.presidencyLedger(game);
export const presidencyPriorityChoice = (game: Game, sector: PressureSectorId) => game.version === 17 ? strategyPriorityChoice(game, sector) : legacy.presidencyPriorityChoice(game, sector);
export const presidencyBudgetChoices = (game: Game) => game.version === 17 ? strategyBudgetChoices(game) : legacy.presidencyBudgetChoices(game);
export const presidencyCreditsChoice = (game: Game) => game.version === 17 ? strategyCreditsChoice(game) : legacy.presidencyCreditsChoice(game);
export function presidencyPoliticalActions(game: Game): Choice[] {
  return game.version === 17 ? strategyEvents(game).filter(event => event.kind === 'political').flatMap(event => event.choices) : legacy.presidencyPoliticalActions(game);
}
export const presidencyFeedback = (game: Game) => legacy.presidencyFeedback(game);
// Links only read recorded physical causes. They never execute a legacy order.
export const presidencyLinks = (game: Game) => legacy.presidencyLinks(game.version === 17 ? { ...game, version: 16 } : game);
