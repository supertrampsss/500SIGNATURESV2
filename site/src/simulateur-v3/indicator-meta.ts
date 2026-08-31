import type { IndicatorKey } from "./types.ts";

export type IndicatorMeta = {
  label: string;
  unit: "M€" | "% du PIB" | "% par an" | "indice de jeu";
  bounds?: { min?: number; max?: number };
  precision: number;
  epsilon: number;
  priority: number;
};

export const INDICATOR_META = {
  annualBalance: {
    label: "Solde public annuel",
    unit: "M€",
    precision: 0,
    epsilon: 1,
    priority: 120,
  },
  debtToGdp: {
    label: "Dette publique",
    unit: "% du PIB",
    bounds: { min: 0 },
    precision: 1,
    epsilon: 0.05,
    priority: 110,
  },
  interestCost: {
    label: "Charge d'intérêt annuelle",
    unit: "M€",
    bounds: { min: 0 },
    precision: 0,
    epsilon: 1,
    priority: 70,
  },
  growth: {
    label: "Croissance nominale annuelle",
    unit: "% par an",
    precision: 2,
    epsilon: 0.01,
    priority: 105,
  },
  employment: {
    label: "Emploi",
    unit: "indice de jeu",
    precision: 0,
    epsilon: 1,
    priority: 100,
  },
  investment: {
    label: "Investissement",
    unit: "indice de jeu",
    precision: 0,
    epsilon: 1,
    priority: 95,
  },
  publicServices: {
    label: "Services publics",
    unit: "indice de jeu",
    bounds: { min: 0, max: 100 },
    precision: 0,
    epsilon: 1,
    priority: 90,
  },
  majority: {
    label: "Pouvoir",
    unit: "indice de jeu",
    bounds: { min: 0, max: 100 },
    precision: 0,
    epsilon: 1,
    priority: 80,
  },
  reformCapacity: {
    label: "Capacité de réforme",
    unit: "indice de jeu",
    bounds: { min: 0, max: 100 },
    precision: 0,
    epsilon: 1,
    priority: 75,
  },
  opinion: {
    label: "Opinion",
    unit: "indice de jeu",
    bounds: { min: 0, max: 100 },
    precision: 0,
    epsilon: 1,
    priority: 85,
  },
  institutionalTrust: {
    label: "Confiance institutionnelle",
    unit: "indice de jeu",
    bounds: { min: 0, max: 100 },
    precision: 0,
    epsilon: 1,
    priority: 88,
  },
  financialCredibility: {
    label: "Crédibilité financière",
    unit: "indice de jeu",
    bounds: { min: 0, max: 100 },
    precision: 0,
    epsilon: 1,
    priority: 87,
  },
} as const satisfies Record<IndicatorKey, IndicatorMeta>;
