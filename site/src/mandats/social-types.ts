import type { Society } from "./types.ts";

export type SocialActor =
  "lyceens" | "salaries" | "retraites" | "agents" | "menages";
export type MovementStage = "petition" | "march" | "strike" | "negotiating";
export type SocialMovement = {
  id: string;
  actor: SocialActor;
  demand: string;
  grievance: string;
  status: "active" | "resolved";
  stage: MovementStage;
  pressure: number;
  causeTurn: number;
  sourceChoice: string;
  sourceTitle: string;
  startedTurn: number;
  causes: Array<{ turn: number; choice: string; title: string }>;
  dialogueDueTurn?: number;
  dialogueTurn?: number;
  dialogueExpired?: boolean;
  /** V14 keeps each financed agreement even when its implementation fails.
   * Rates use the financing year's prices; budget indexation is applied when
   * comparing them with a later proposal, never charged for a second time.
   */
  funding?: Record<string, { annualOperating: number; fundedTurn: number }>;
  commitment?: {
    fundedTurn: number;
    dueTurn: number;
    status: "pending" | "kept" | "broken";
    operating: number;
    deliveryEffect?: import("./types.ts").Effect;
  };
  resolvedTurn?: number;
  lastDetail: string;
};
export type SocialState = {
  movements: SocialMovement[];
  budget: {
    year: number;
    accruedOperating: number;
    accruedRevenue: number;
    operating: number;
    revenue: number;
  };
};
export type SocialChoice = {
  trigger?: {
    actor: SocialActor;
    demand: string;
    grievance: string;
    pressure: number;
  };
  response?: {
    movementId: string;
    /** Stable authored response ID, independent of the decision's turn prefix. */
    fundingId?: string;
    action:
      | "fund"
      | "dialogue"
      | "maintain"
      | "follow"
      | "suspend"
      | "redeploy"
      | "pilot";
    deliveryEffect?: import("./types.ts").Effect;
  };
};
export type SocialActorDefinition = {
  label: string;
  group: keyof Society;
  demand: string;
  art: string;
  disruption: string;
};
