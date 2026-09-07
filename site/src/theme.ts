export function brancherTheme(): void {
  const bouton = document.getElementById("theme-bascule");
  if (!bouton) return;
  const estSombre = () => document.documentElement.dataset.theme !== "clair";
  const peindre = () => {
    bouton.setAttribute("aria-pressed", String(estSombre()));
    bouton.setAttribute("aria-label", estSombre() ? "Activer le mode clair" : "Activer le mode sombre");
    bouton.title = estSombre() ? "Mode clair" : "Mode sombre";
    bouton.innerHTML = `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">${estSombre() ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>' : '<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>'}</svg>`;
  };
  peindre();
  window.addEventListener("storage", (event) => {
    if (event.key !== "theme") return;
    document.documentElement.dataset.theme = event.newValue === "clair" ? "clair" : "sombre";
    peindre();
  });
  bouton.addEventListener("click", () => {
    const voulu = estSombre() ? "clair" : "sombre";
    document.documentElement.dataset.theme = voulu;
    try {
      localStorage.setItem("theme", voulu);
    } catch {
      // Rien à mémoriser : le choix vaut pour cette page, et c'est déjà ça.
    }
    peindre();
  });
}
