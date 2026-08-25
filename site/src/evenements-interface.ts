/** Les gestes d'interface, locaux et sans transport ni préférence politique. */

export type EvenementInterface =
  | { type: "navigation"; destination: "accueil" | "france" | "territoires" | "simuler" }
  | { type: "preuve_ouverte"; contexte: "france" | "territoire" | "analyse" | "simulateur" }
  | { type: "territoire_recherche" }
  | { type: "simulateur_abandon"; dossier: number };

export function emettreInterface(detail: EvenementInterface): void {
  document.dispatchEvent(new CustomEvent("interface:evenement", { detail }));
}
