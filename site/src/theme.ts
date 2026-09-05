export function brancherTheme(): void {
  const bouton = document.getElementById("theme-bascule");
  if (!bouton) return;
  const sombreSysteme = window.matchMedia("(prefers-color-scheme: dark)");
  const estSombre = () =>
    document.documentElement.dataset.theme === "sombre" ||
    (!document.documentElement.dataset.theme && sombreSysteme.matches);
  const peindre = () => bouton.setAttribute("aria-pressed", String(estSombre()));
  peindre();
  // Le système change d'avis (coucher du soleil, réglage) : tant que le
  // lecteur n'a pas tranché lui-même, la bascule le suit.
  sombreSysteme.addEventListener("change", peindre);
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

