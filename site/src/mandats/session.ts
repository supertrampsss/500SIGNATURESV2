import { DOMAINS } from "./engine.ts";
import { challengeFromURL, sharedResult } from "./sharing.ts";
import type { Game } from "./types.ts";

/** A shared URL is an entry point, never the address of an adopted local save. */
export function clearEntryLink(browserHistory: Pick<History, "replaceState">): void {
  browserHistory.replaceState(null, "", "/mandats/");
}

/** Beginning, resuming and importing use the same private-session transition. */
export function localSession(game: Game, browserHistory: Pick<History, "replaceState">) {
  clearEntryLink(browserHistory);
  return {
    g: game,
    shared: false,
    inherited: false,
    screen: game.turn === DOMAINS[game.mode].turns ? "result" as const : "play" as const,
    view: "decision" as const,
  };
}

/** Also resolves same-document result navigation; never writes a local save. */
export function entrySession(url: URL) {
  const result = sharedResult(url.hash);
  const challenge = result ? null : challengeFromURL(url);
  return {
    g: result ?? challenge,
    shared: !!result,
    inherited: false,
    screen: result ? "result" as const : challenge ? "briefing" as const : "select" as const,
    view: "decision" as const,
  };
}
