/** Lie la visibilité de la navigation à la durée d'une séance immersive. */
export function demarrerSessionImmersive(cadre: HTMLElement, surQuitter?: () => void): () => void {
  document.body.dataset.session = "active";
  let active = true;
  const demonter = () => {
    if (!active) return;
    active = false;
    delete document.body.dataset.session;
    cadre.removeEventListener("click", clic);
  };
  const clic = (evenement: MouseEvent) => {
    if (!(evenement.target as HTMLElement).closest(".tunnel__quitter")) return;
    demonter();
    surQuitter?.();
  };
  cadre.addEventListener("click", clic);
  return demonter;
}
