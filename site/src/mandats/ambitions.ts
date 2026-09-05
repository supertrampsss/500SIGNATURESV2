import type { Ambition, Game } from "./types.ts";

export const AMBITIONS = {
  equilibre: { label: "Un équilibre durable", short: "Équilibre", description: "Garder de la marge sans laisser un territoire fragile.", weights: { finances: .4, services: .2, cohesion: .2, resilience: .2 } },
  services: { label: "Le quotidien d'abord", short: "Services", description: "Améliorer les services et préserver la confiance.", weights: { finances: .15, services: .4, cohesion: .35, resilience: .1 } },
  resilience: { label: "Préparer demain", short: "Résilience", description: "Transformer les équipements et réduire l'exposition aux crises.", weights: { finances: .2, services: .15, cohesion: .15, resilience: .5 } },
} satisfies Record<Ambition, { label: string; short: string; description: string; weights: Record<string, number> }>;
export const ambitionFor = (g: Game) => AMBITIONS[g.ambition ?? "equilibre"];
