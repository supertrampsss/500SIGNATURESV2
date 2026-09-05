/** An experimental three-decision game. Credits and indexes are fictional units. */
export type State = {
  readonly version: 1;
  readonly turn: 0 | 1 | 2 | 3;
  readonly choices: readonly string[];
  readonly budget: number;
  readonly comfort: number;
  readonly industry: number;
  readonly insulation: boolean;
  readonly pending: boolean;
};

export type Choice = {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly cost: number;
  readonly disabled: boolean;
};

type Option = Omit<Choice, "disabled">;

const OPTIONS: readonly (readonly Option[])[] = [
  [
    { id: "chauffer", title: "Protéger les logements", cost: 24,
      detail: "24 crédits de jeu. Des logements plus chauds. Les usines ralentissent." },
    { id: "produire", title: "Soutenir les usines", cost: 20,
      detail: "20 crédits de jeu. Les usines tournent davantage. Les foyers chauffent moins." },
    { id: "partager", title: "Partager les restrictions", cost: 0,
      detail: "0 crédit de jeu. Moins de chauffage et de production. Vous gardez votre budget." },
  ],
  [
    { id: "isoler", title: "Isoler des logements", cost: 30,
      detail: "30 crédits de jeu. Chantier livré avant le deuxième hiver : moins de chauffage nécessaire." },
    { id: "reseau", title: "Renforcer le réseau", cost: 24,
      detail: "24 crédits de jeu. Les usines résisteront mieux aux pénuries du prochain hiver." },
    { id: "entretenir", title: "Entretenir et économiser", cost: 0,
      detail: "0 crédit de jeu. Quelques réparations. Les logements restent mal isolés." },
  ],
  [
    { id: "foyers", title: "Réserver l’énergie aux foyers", cost: 16,
      detail: "16 crédits de jeu. Plus de chauffage dans les logements. Les usines ralentissent." },
    { id: "ateliers", title: "Préserver les ateliers", cost: 14,
      detail: "14 crédits de jeu. Les ateliers restent actifs. Les logements sont moins chauffés." },
    { id: "sobriete", title: "Prolonger les restrictions", cost: 0,
      detail: "0 crédit de jeu. Chacun consomme moins. Vous ne dépensez rien de plus." },
  ],
];

function freeze(state: State): State {
  return Object.freeze({ ...state, choices: Object.freeze([...state.choices]) });
}

export const INITIAL: State = freeze({
  version: 1, turn: 0, choices: [], budget: 60, comfort: 50, industry: 50,
  insulation: false, pending: false,
});

/** All three options stay visible, including unaffordable options. */
export function choices(state: State): Choice[] {
  return (OPTIONS[state.turn] ?? []).map(option => Object.freeze({
    ...option, disabled: option.cost > state.budget,
  }));
}

const clamp = (value: number) => Math.max(0, Math.min(100, value));

/** A spring decision includes the passage of months: works arrive at turn 2. */
export function decide(state: State, id: string): State {
  if (state.turn >= 3) throw new Error("Les trois décisions sont terminées.");
  const option = choices(state).find(choice => choice.id === id);
  if (!option) throw new Error("Ce choix n’est pas proposé à cette saison.");
  if (option.disabled) throw new Error("La réserve de crédits de jeu est insuffisante.");

  let comfort = state.comfort;
  let industry = state.industry;
  let insulation = state.insulation;
  switch (id) {
    case "chauffer": comfort += 22; industry -= 6; break;
    case "produire": comfort -= 6; industry += 22; break;
    case "partager": comfort -= 10; industry -= 8; break;
    case "isoler": comfort += 18; industry += 4; insulation = true; break;
    case "reseau": comfort += 4; industry += 15; break;
    case "entretenir": comfort += 4; industry += 2; break;
    case "foyers": comfort += 18; industry -= 4; break;
    case "ateliers": comfort -= 5; industry += 17; break;
    case "sobriete": comfort -= 6; industry -= 4; break;
  }
  if (state.turn === 1) {
    // A second cold spell follows the spring works, before the final choice.
    comfort -= insulation ? 6 : id === "reseau" ? 11 : 14;
    industry -= insulation ? 8 : id === "reseau" ? 5 : 12;
  }
  return freeze({
    version: 1, turn: (state.turn + 1) as State["turn"],
    choices: [...state.choices, id], budget: state.budget - option.cost,
    comfort: clamp(comfort), industry: clamp(industry), insulation, pending: false,
  });
}

/** Accept only complete canonical v1 snapshots, reconstructed from choice IDs. */
export function restore(raw: unknown): State | null {
  try {
    const value: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const saved = value as Record<string, unknown>;
    const keys = ["version", "turn", "choices", "budget", "comfort", "industry", "insulation", "pending"];
    if (Object.keys(saved).length !== keys.length || !keys.every(key => Object.hasOwn(saved, key))) return null;
    if (saved.version !== 1 || !Number.isInteger(saved.turn) || (saved.turn as number) < 0 || (saved.turn as number) > 3) return null;
    if (!Array.isArray(saved.choices) || saved.choices.length !== saved.turn || !saved.choices.every(id => typeof id === "string")) return null;
    let state = INITIAL;
    for (const id of saved.choices) state = decide(state, id);
    // Serialized indexes cannot grant extra resources or change delivered works.
    for (const key of keys) {
      if (key !== "choices" && saved[key] !== state[key as keyof State]) return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function scene(state: State): {
  season: "winter" | "spring" | "winter-return";
  warmth: number;
  activity: number;
  construction: boolean;
  renovated: boolean;
  caption: string;
} {
  return {
    season: state.turn === 0 ? "winter" : state.turn === 1 ? "spring" : "winter-return",
    warmth: state.comfort / 100,
    activity: state.industry / 100,
    construction: state.pending,
    renovated: state.insulation,
    caption: state.turn === 0 ? "Premier hiver : le froid oblige à partager l’énergie."
      : state.turn === 1 ? "Le printemps arrive. Les travaux choisis ici prendront plusieurs mois."
      : state.insulation ? "Deuxième hiver : les travaux du printemps sont livrés, les logements sont isolés."
      : state.choices[1] === "reseau" ? "Deuxième hiver : le réseau renforcé au printemps soutient l’activité."
      : "Deuxième hiver : l’entretien aide, mais les bâtiments restent exposés au froid.",
  };
}

export function summary(state: State): { title: string; benefit: string; tradeoff: string } {
  if (state.turn < 3) return {
    title: "L’épisode continue",
    benefit: `Il reste ${state.budget} crédits de jeu pour les prochaines décisions.`,
    tradeoff: "Le bilan sera établi après le deuxième hiver ; aucun résultat n’est encore définitif.",
  };
  const last = state.choices[2];
  return {
    title: state.insulation ? "Des logements mieux préparés"
      : state.choices[1] === "reseau" ? "Un réseau prêt pour le retour du froid"
      : "Une réserve préservée, un hiver contraint",
    benefit: `${state.insulation ? "L’isolation livrée au deuxième hiver amortit le froid."
      : state.choices[1] === "reseau" ? "Le réseau renforcé amortit la baisse d’activité."
      : "L’entretien conserve des crédits pour la suite."} ${state.budget} crédits de jeu restent en réserve.`,
    tradeoff: `${last === "foyers" ? "La priorité finale aux foyers réduit l’activité industrielle."
      : last === "ateliers" ? "La priorité finale aux ateliers réduit le confort des foyers."
      : "Les restrictions finales réduisent le confort et l’activité."} Confort : ${state.comfort}/100 ; industrie : ${state.industry}/100. Ce sont des indices de jeu.`,
  };
}
