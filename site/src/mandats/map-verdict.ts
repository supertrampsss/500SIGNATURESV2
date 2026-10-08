import type { Game } from "./types.ts";
import { cleanGameText } from "./map-view.ts";
import { escape } from "./sharing.ts";

/** Presents a saved result while leaving the country visible. */
export function showMapDecisionVerdict(game: Game, onDismiss: () => void) {
  const last = game.history.at(-1);
  if (!last) return;
  const vote = last.vote,
    label =
      vote?.kind === "law"
        ? `Texte ${vote.passed ? "adopté" : "rejeté"}`
        : "Décision enregistrée";
  const detail =
    vote?.kind === "law" && !vote.passed
      ? "Le financement et les effets du texte ne sont pas appliqués."
      : (game.narrative?.lastConsequences.find(
          (text) => !text.startsWith("Compromis"),
        ) ??
        last.messages[0] ??
        last.title);
  const element = document.createElement("aside");
  element.className = "map-decision-receipt";
  element.dataset.decisionVerdict =
    vote?.kind === "law" && !vote.passed ? "rejected" : "accepted";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.innerHTML = `<div><strong>${escape(label)}</strong><p>${escape(cleanGameText(detail))}</p></div><button type="button" data-action="dismiss-verdict">Fermer</button>`;
  document.body.append(element);
  let disposed = false;
  const timer = window.setTimeout(dismiss, 1800);
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(timer);
    document.removeEventListener("keydown", onEscape);
    element.remove();
  }
  function dismiss() {
    if (!disposed) {
      dispose();
      onDismiss();
    }
  }
  function onEscape(event: KeyboardEvent) {
    if (event.key === "Escape") dismiss();
  }
  document.addEventListener("keydown", onEscape);
  element.addEventListener("focusin", () => clearTimeout(timer));
  return { dispose, dismiss };
}
