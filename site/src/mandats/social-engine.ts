import { clamp } from "./types.ts";
import type { Choice, Effect, Game } from "./types.ts";
import type { NarrativeEventRecord } from "./narrative-types.ts";
import type {
  SocialActor,
  SocialActorDefinition,
  SocialMovement,
  SocialState,
} from "./social-types.ts";

export const SOCIAL_ACTORS: Record<SocialActor, SocialActorDefinition> = {
  lyceens: {
    label: "Lycéens",
    group: "publicStaff",
    demand: "Classes moins chargées et maintien des enseignements",
    art: "school",
    disruption: "Des cours sont perturbés par les blocages.",
  },
  salaries: {
    label: "Salariés",
    group: "workers",
    demand: "Préserver les revenus et les conditions de travail",
    art: "industry",
    disruption: "La grève perturbe l’activité et les recettes.",
  },
  retraites: {
    label: "Retraités",
    group: "pensioners",
    demand: "Préserver le revenu des retraites",
    art: "nation",
    disruption: "Les mobilisations se prolongent dans plusieurs bassins.",
  },
  agents: {
    label: "Agents publics",
    group: "publicStaff",
    demand: "Des équipes et des moyens pour assurer le service",
    art: "hospital",
    disruption: "Les services fonctionnent avec des équipes réduites.",
  },
  menages: {
    label: "Ménages modestes",
    group: "vulnerable",
    demand: "Préserver l’accès aux services et aux aides",
    art: "housing",
    disruption: "Les difficultés d’accès mobilisent les collectifs locaux.",
  },
};

export function initialSocialState(): SocialState {
  return {
    movements: [],
    budget: {
      year: 1,
      accruedOperating: 0,
      accruedRevenue: 0,
      operating: 0,
      revenue: 0,
    },
  };
}

export function activeSocialMovements(game: Game): SocialMovement[] {
  return (game.social?.movements ?? [])
    .filter((item) => item.status === "active")
    .sort(
      (a, b) =>
        b.pressure - a.pressure ||
        a.startedTurn - b.startedTurn ||
        a.id.localeCompare(b.id),
    );
}

export function movementPhase(movement: SocialMovement): string {
  if (movement.status === "resolved") return "Engagement tenu";
  if (movement.stage === "negotiating")
    return movement.commitment?.status === "pending"
      ? "Concession financée"
      : "Concertation en cours";
  if (movement.stage === "strike")
    return movement.actor === "lyceens"
      ? "Blocages des lycées"
      : movement.actor === "retraites" || movement.actor === "menages"
        ? "Mobilisation durable"
        : "Grève";
  return movement.stage === "march" ? "Manifestations" : "Mobilisation";
}

function annualDisruption(movements: SocialMovement[]) {
  // Fictional annual run rates. A decision is one sixth of a playable year.
  const totals = { operating: 0, revenue: 0 };
  for (const movement of movements.filter((item) => item.status === "active")) {
    if (movement.stage === "strike") {
      totals.operating += 0.6;
      totals.revenue -= movement.actor === "retraites" ? 0.3 : 1.2;
    } else if (movement.stage === "march") totals.operating += 0.12;
    else if (movement.stage === "negotiating") totals.operating += 0.06;
  }
  return totals;
}

export type SocialTransition = {
  state: SocialState;
  effect: Effect;
  events: NarrativeEventRecord[];
  messages: string[];
  unrest: number;
  legitimacy: number;
  support: number;
};

/** Derives all mobilisation state from a real decision and its actual ballot. */
export function advanceSocialMovements(
  before: Game,
  afterChoice: Game,
  choice: Choice,
  adopted: boolean,
): SocialTransition {
  const state = structuredClone(before.social ?? initialSocialState());
  const result: SocialTransition = {
    state,
    effect: {},
    events: [],
    messages: [],
    unrest: 0,
    legitimacy: 0,
    support: 0,
  };
  const turn = before.turn + 1;
  const year = Math.floor(before.turn / 6) + 1;
  const slot = (before.turn % 6) + 1;
  if (state.budget.year !== year)
    state.budget = {
      year,
      accruedOperating: 0,
      accruedRevenue: 0,
      operating: 0,
      revenue: 0,
    };
  const spent = annualDisruption(state.movements);
  state.budget.accruedOperating += spent.operating / 6;
  state.budget.accruedRevenue += spent.revenue / 6;

  function record(
    movement: SocialMovement,
    title: string,
    detail: string,
    weight: number,
    causeTurn = movement.causeTurn,
  ) {
    result.messages.push(detail);
    result.events.push({
      id: `${movement.id}-${turn}-${result.events.length}`,
      turn,
      kind: "mobilization",
      title,
      detail,
      causeTurn,
      weight,
    });
    movement.lastDetail = detail;
  }

  for (const movement of state.movements.filter(
    (item) => item.status === "active",
  )) {
    const response =
      choice.social?.response?.movementId === movement.id && adopted
        ? choice.social.response
        : undefined;
    const previousStage = movement.stage;
    const actor = SOCIAL_ACTORS[movement.actor];
    if (
      response &&
      ["fund", "suspend", "redeploy", "pilot"].includes(response.action) &&
      movement.commitment?.status !== "pending"
    ) {
      movement.commitment = {
        fundedTurn: before.turn,
        dueTurn: turn + (response.action === "pilot" ? 3 : 2),
        status: "pending",
        operating: choice.effect.operating ?? 0,
        deliveryEffect: response.deliveryEffect,
      };
      movement.pressure = clamp(movement.pressure - 18);
      record(
        movement,
        `${actor.label} : une concession financée`,
        `Les crédits sont votés. ${movement.demand} : le collectif attend la mise en œuvre avant de clore le mouvement.`,
        2,
        before.turn,
      );
    } else if (
      response?.action === "dialogue" &&
      movement.dialogueDueTurn === undefined
    ) {
      movement.dialogueTurn = before.turn;
      movement.dialogueDueTurn = turn + 2;
      movement.pressure = clamp(movement.pressure - 6);
      record(
        movement,
        `${actor.label} : une concertation annoncée`,
        `Une concertation est ouverte avec les ${actor.label.toLocaleLowerCase("fr")}. Une réponse financée est attendue avant la décision ${movement.dialogueDueTurn}.`,
        1,
        before.turn,
      );
    } else if (response?.action === "maintain") {
      movement.pressure = clamp(movement.pressure + 14);
      record(
        movement,
        `${actor.label} : la décision est maintenue`,
        `Le gouvernement maintient son choix. La revendication « ${movement.demand} » reste sans concession.`,
        -2,
        before.turn,
      );
    } else if (
      !movement.commitment ||
      movement.commitment.status !== "pending"
    ) {
      // Another agenda front, even an institutional crisis, does not freeze the movement.
      movement.pressure = clamp(
        movement.pressure +
          (movement.dialogueDueTurn !== undefined &&
          turn < movement.dialogueDueTurn
            ? 3
            : 12),
      );
    }

    if (
      movement.commitment?.status === "pending" &&
      turn >= movement.commitment.dueTurn
    ) {
      const executable =
        afterChoice.metrics.services >= 40 &&
        (afterChoice.society?.publicStaff ?? 65) >= 35 &&
        afterChoice.politics?.cabinet !== "fallen";
      if (executable) {
        movement.commitment.status = "kept";
        movement.status = "resolved";
        movement.resolvedTurn = turn;
        result.effect.trust = (result.effect.trust ?? 0) + 2;
        const delivered = movement.commitment.deliveryEffect;
        for (const key of [
          "services",
          "cohesion",
          "trust",
          "resilience",
          "assets",
        ] as const) {
          if (delivered?.[key])
            result.effect[key] = (result.effect[key] ?? 0) + delivered[key]!;
        }
        if (delivered?.society)
          for (const [key, value] of Object.entries(delivered.society)) {
            const group = key as keyof NonNullable<Effect["society"]>;
            result.effect.society ??= {};
            result.effect.society[group] =
              (result.effect.society[group] ?? 0) + (value ?? 0);
          }
        if (delivered?.areaEffects)
          for (const [area, changes] of Object.entries(delivered.areaEffects)) {
            result.effect.areaEffects ??= {};
            const current = result.effect.areaEffects[area] ?? {};
            result.effect.areaEffects[area] = {
              services: (current.services ?? 0) + (changes.services ?? 0),
              resilience: (current.resilience ?? 0) + (changes.resilience ?? 0),
            };
          }
        record(
          movement,
          `${actor.label} : l’engagement est tenu`,
          `${movement.demand} : les moyens votés sont mis en œuvre. Le collectif met fin au mouvement.`,
          4,
          movement.commitment.fundedTurn,
        );
        continue;
      }
      movement.commitment.status = "broken";
      movement.pressure = clamp(movement.pressure + 18);
      record(
        movement,
        `${actor.label} : les moyens n’arrivent pas`,
        `L’engagement financé n’a pas pu être mis en œuvre : les capacités de service ou la continuité du gouvernement manquent. La mobilisation reprend.`,
        -4,
        movement.commitment.fundedTurn,
      );
    }
    if (
      movement.dialogueDueTurn !== undefined &&
      turn >= movement.dialogueDueTurn &&
      !movement.dialogueExpired &&
      !movement.commitment
    ) {
      movement.dialogueExpired = true;
      movement.pressure = Math.max(65, clamp(movement.pressure + 18));
      result.legitimacy -= 2;
      record(
        movement,
        `${actor.label} : la concertation reste sans réponse`,
        `L’échéance de concertation est passée sans concession financée. Les ${actor.label.toLocaleLowerCase("fr")} prolongent le mouvement.`,
        -3,
        movement.dialogueTurn,
      );
    }
    movement.stage =
      movement.commitment?.status === "pending" ||
      (movement.dialogueDueTurn !== undefined &&
        !movement.dialogueExpired &&
        turn < movement.dialogueDueTurn)
        ? "negotiating"
        : movement.pressure >= 65
          ? "strike"
          : movement.pressure >= 40
            ? "march"
            : "petition";
    if (movement.stage !== previousStage && movement.stage !== "negotiating")
      record(
        movement,
        `${actor.label} : ${movementPhase(movement).toLocaleLowerCase("fr")}`,
        `${movement.demand}. ${movement.stage === "strike" ? actor.disruption : "Les rassemblements s’élargissent autour de cette revendication."}`,
        -3,
      );
    if (movement.stage === "strike") {
      result.effect.services = (result.effect.services ?? 0) - 0.5;
      result.effect.trust = (result.effect.trust ?? 0) - 0.5;
      result.unrest += 1.5;
      result.support -= 1;
      result.legitimacy -= 0.5;
      result.messages.push(`${actor.label} : ${actor.disruption}`);
    } else if (movement.stage === "march") result.unrest += 0.5;
  }

  if (adopted) {
    const triggers: Array<{
      actor: SocialActor;
      demand: string;
      grievance: string;
      pressure: number;
    }> = [];
    if (choice.social?.trigger) triggers.push(choice.social.trigger);
    for (const actor of [
      "salaries",
      "retraites",
      "agents",
      "menages",
    ] as const) {
      const definition = SOCIAL_ACTORS[actor];
      const pain = -(choice.effect.society?.[definition.group] ?? 0);
      // Explicit school cuts have their own student grievance; no duplicate generic staff movement.
      if (
        pain >= 5 &&
        !(actor === "agents" && choice.social?.trigger?.actor === "lyceens")
      )
        triggers.push({
          actor,
          demand: definition.demand,
          grievance: `La décision « ${choice.title} » dégrade leurs conditions dans le scénario.`,
          pressure: Math.min(55, 25 + pain * 2),
        });
    }
    for (const trigger of triggers) {
      let movement = state.movements.find(
        (item) => item.actor === trigger.actor && item.status === "active",
      );
      if (movement) {
        movement.causes.push({
          turn: before.turn,
          choice: choice.id,
          title: choice.title,
        });
        movement.pressure = clamp(movement.pressure + 8);
        record(
          movement,
          `${SOCIAL_ACTORS[trigger.actor].label} : une nouvelle décision contestée`,
          trigger.grievance,
          -3,
          before.turn,
        );
      } else {
        movement = {
          id: `mvt-${trigger.actor}-${before.turn}`,
          actor: trigger.actor,
          demand: trigger.demand,
          grievance: trigger.grievance,
          status: "active",
          stage: trigger.pressure >= 40 ? "march" : "petition",
          pressure: trigger.pressure,
          causeTurn: before.turn,
          sourceChoice: choice.id,
          sourceTitle: choice.title,
          startedTurn: turn,
          causes: [
            { turn: before.turn, choice: choice.id, title: choice.title },
          ],
          lastDetail: trigger.grievance,
        };
        state.movements.push(movement);
        record(
          movement,
          `${SOCIAL_ACTORS[trigger.actor].label} : la mobilisation commence`,
          trigger.grievance,
          -3,
        );
      }
    }
  }
  const forecast = annualDisruption(state.movements);
  const remaining = (6 - slot) / 6;
  state.budget.operating =
    state.budget.accruedOperating + forecast.operating * remaining;
  state.budget.revenue =
    state.budget.accruedRevenue + forecast.revenue * remaining;
  return result;
}
