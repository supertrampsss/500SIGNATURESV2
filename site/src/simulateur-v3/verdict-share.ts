import { offrir, resume, type Canaux, type Issue, type Partage } from "../partage.ts";
import { INDICATOR_META } from "./indicator-meta.ts";
import type { MandateVerdictViewModel } from "./verdict.ts";

export type VerdictShareChannels = Canaux & {
  proposer?: (message: string, value: string) => void;
};

export type VerdictShareIssue = Issue | "proposé";

function formatBillions(value: number): string {
  const billions = Math.round(value / 1_000);
  return `${billions} ${Math.abs(billions) === 1 ? "milliard" : "milliards"} d'euros`;
}

function formatGrowth(value: number): string {
  return value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function buildVerdictShare(view: MandateVerdictViewModel, url: string): Partage {
  const growth = view.signals.find((signal) => signal.key === "growth")?.value ?? 0;
  const majority = view.signals.find((signal) => signal.key === "majority")?.value ?? 0;
  const opinion = view.signals.find((signal) => signal.key === "opinion")?.value ?? 0;
  return {
    titre: "Mon mandat sur Où va l'argent public",
    permalien: url,
    lignes: [
      `${view.headline} Solde annuel : ${formatBillions(view.annualBalance)}.`,
      `${INDICATOR_META.growth.label} ${formatGrowth(growth)} %, Pouvoir ${Math.round(majority)} / 100, Opinion ${Math.round(opinion)} / 100.`,
    ],
    compact: null,
    image: null,
  };
}

export async function offerVerdictShare(
  share: Partage,
  channels: VerdictShareChannels,
): Promise<VerdictShareIssue> {
  const issue = await offrir(share, channels);
  if (issue !== "indisponible" || !channels.proposer) return issue;
  channels.proposer("Copiez votre verdict", resume(share));
  return "proposé";
}
