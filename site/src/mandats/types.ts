export type Mode = "municipal" | "national";
export type Metrics = { services: number; cohesion: number; resilience: number; trust: number; assets: number };
export type Area = { id: string; name: string; need: string; services: number; resilience: number; x: number; y: number };
export type Finance = {
  revenue: number; operating: number; debt: number; cash: number; rate: number;
  repayment: number; investment: number; grants: number; gdp: number;
  growth: number; deflator: number; marketRate: number; stockFlow: number;
};
export type Effect = {
  revenue?: number; operating?: number; investment?: number; grants?: number; repayment?: number;
  services?: number; cohesion?: number; resilience?: number; trust?: number; assets?: number;
  growth?: number; area?: string;
};
export type Choice = {
  id: string; title: string; description: string; cost: string; benefit: string; sacrifice: string;
  effect: Effect; delayed?: { after: number; label: string; effect: Effect };
};
export type Dossier = { category: string; title: string; story: string; advisor: string; choices: Choice[] };
export type Ledger = { revenue: number; operating: number; interest: number; savings: number; repayment: number; investment: number; grants: number; borrowing: number; cashChange: number; deficit: number; debt: number; gdp: number };
export type Pending = { due: number; label: string; effect: Effect };
export type Turn = { year: number; choice: string; title: string; messages: string[]; event: string; ledger: Ledger; metrics: Metrics; areas: Area[] };
export type Game = {
  version: 1; mode: Mode; seed: number; turn: number; finance: Finance; metrics: Metrics;
  areas: Area[]; pending: Pending[]; history: Turn[]; choices: string[];
};
export type Domain = {
  id: Mode; label: string; place: string; role: string; duration: string; turns: number; unit: string;
  intro: string; scope: string; objectives: string[]; initial: () => Omit<Game, "version" | "mode" | "seed" | "turn" | "pending" | "history" | "choices">;
  dossiers: Dossier[]; event: (game: Game) => { label: string; effect: Effect };
  prepare: (finance: Finance) => Finance;
  settle: (finance: Finance) => Ledger; sustainability: (game: Game) => number;
};
export const clamp = (n: number) => Math.max(0, Math.min(100, n));
