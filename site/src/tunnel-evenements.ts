/** Les signaux anonymes du tunnel : aucun transport ni donnée personnelle. */

import type { Acte, ModeTunnel } from "./campagne.ts";
import type { Soutien } from "./mesures.ts";

export type EvenementTunnel =
  | { type: "partie_demarre"; mode: ModeTunnel }
  | { type: "decision"; acte: Acte; numero: number; verdict: "adopte" | "rejete" | "ajourne" }
  | { type: "crise"; soutien: Soutien }
  | { type: "partie_terminee"; mode: ModeTunnel; dossiers: number }
  | { type: "revanche" }
  | { type: "partage" };

export function emettreEvenement(detail: EvenementTunnel): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new CustomEvent("simulateur:evenement", { detail }));
}
