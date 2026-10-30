/**
 * Apparitions au défilement, partagées par l'accueil, France, Villes et Salaires.
 *
 * Le document reste complet sans ce module : rien n'est masqué par le CSS seul.
 * Seuls les blocs encore sous la ligne de flottaison au branchement passent en
 * attente, puis apparaissent quand ils entrent dans l'écran. Les tracés de
 * courbes se dessinent à ce moment-là. Mouvement réduit : aucun effet.
 */
const SELECTEUR = [
  ".recit-explorer", ".recit-questions > a", ".recit-mandats", ".recit-method", ".usage-faq",
  ".fr-keyfigures", ".fr-panel", ".fr-topic", ".fr-section-heading",
  ".salaires__resultat", ".salaires__ventilation", ".salary-missions", ".salaires__detail",
  ".territoire-recherche + *",
].join(",");

let observateur: IntersectionObserver | undefined;

function tracer(bloc: Element): void {
  for (const chemin of bloc.querySelectorAll<SVGGeometryElement>("svg path, svg polyline")) {
    const style = getComputedStyle(chemin);
    if (style.fill !== "none" || style.stroke === "none" || typeof chemin.getTotalLength !== "function") continue;
    const longueur = chemin.getTotalLength();
    if (!longueur || longueur > 6000) continue;
    chemin.style.strokeDasharray = `${longueur}`;
    chemin.style.strokeDashoffset = `${longueur}`;
    chemin.getBoundingClientRect();
    chemin.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1)";
    chemin.style.strokeDashoffset = "0";
    chemin.addEventListener("transitionend", () => {
      chemin.style.removeProperty("stroke-dasharray");
      chemin.style.removeProperty("stroke-dashoffset");
      chemin.style.removeProperty("transition");
    }, { once: true });
  }
}

function montrer(bloc: HTMLElement): void {
  bloc.dataset.apparition = "vu";
  tracer(bloc);
}

export function brancherApparitions(racine: ParentNode = document): void {
  if (typeof IntersectionObserver !== "function") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  observateur ??= new IntersectionObserver((entrees) => {
    for (const entree of entrees) {
      if (!entree.isIntersecting) continue;
      observateur?.unobserve(entree.target);
      montrer(entree.target as HTMLElement);
    }
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
  const blocs = [...racine.querySelectorAll<HTMLElement>(SELECTEUR)].filter((bloc) => !bloc.dataset.apparition);
  let rang = 0;
  for (const bloc of blocs) {
    if (!bloc.getClientRects().length) continue;
    if (bloc.getBoundingClientRect().top < innerHeight * 0.92) { bloc.dataset.apparition = "vu"; continue; }
    bloc.dataset.apparition = "attente";
    bloc.style.setProperty("--apparition-delai", `${(rang++ % 3) * 90}ms`);
    observateur.observe(bloc);
  }
}
