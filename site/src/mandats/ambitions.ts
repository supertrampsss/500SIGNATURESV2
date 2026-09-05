import type { Ambition, Game } from "./types.ts";

export const AMBITIONS = {
  equilibre: { label: "Tenir le budget", short: "Équilibre", description: "La dette et le financement des projets comptent le plus dans votre bilan.", weights: { finances: .4, services: .2, cohesion: .2, resilience: .2 } },
  services: { label: "Améliorer les services", short: "Services", description: "Votre bilan dépend surtout des services rendus et de la confiance des habitants.", weights: { finances: .15, services: .4, cohesion: .35, resilience: .1 } },
  resilience: { label: "Prévenir les pannes et les crises", short: "Résilience", description: "L’entretien des équipements et la protection contre les crises comptent le plus dans votre bilan.", weights: { finances: .2, services: .15, cohesion: .15, resilience: .5 } },
} satisfies Record<Ambition, { label: string; short: string; description: string; weights: Record<string, number> }>;
export const ambitionFor = (g: Game) => AMBITIONS[g.ambition ?? "equilibre"];
