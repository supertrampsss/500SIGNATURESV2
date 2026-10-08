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
