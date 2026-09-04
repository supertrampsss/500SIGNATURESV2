export type Destination = {
  cle: "france" | "territoires" | "simuler" | "salaires";
  href: string;
  libelle: string;
  /** Les pages éditoriales restent de vrais liens : elles rechargent leur
   * document pré-rendu au lieu de passer par la SPA. */
  native?: boolean;
};

export const DESTINATIONS: readonly Destination[] = [
  { cle: "france", href: "/bilan", libelle: "France" },
  { cle: "territoires", href: "/territoire", libelle: "Territoires" },
  { cle: "salaires", href: "/salaires", libelle: "Salaires", native: true },
  { cle: "simuler", href: "/simulateur", libelle: "Simuler" },
];

function normaliserChemin(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Annule un lien désactivé, sinon prépare la navigation interne demandée. */
export function intercepterNavigation(clic: MouseEvent): Destination | null {
  const lien = (clic.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-vue]");
  if (!lien) return null;
  if (lien.dataset.vue === "salaires") return null;
  if (lien.getAttribute("aria-disabled") === "true") {
    clic.preventDefault();
    return null;
  }
  if (clic.button !== 0 || clic.metaKey || clic.ctrlKey || clic.shiftKey || clic.altKey) return null;
  const destination = DESTINATIONS.find(({ cle }) => cle === lien.dataset.vue);
  if (!destination) return null;
  clic.preventDefault();
  return destination;
}

/** Rend la seule navigation primaire du site, indépendamment du document. */
export function renduNavigation(pathname: string, simulateurDisponible: boolean): string {
  const chemin = normaliserChemin(pathname);
  return DESTINATIONS.map(({ cle, href, libelle }) => {
    const destination = DESTINATIONS.find((candidate) => candidate.cle === cle)!;
    if (destination.native) {
      const courant = chemin === href ? ' aria-current="page"' : "";
      return `<a href="${href}"${courant}>${libelle}</a>`;
    }
    const estSimulateurIndisponible = cle === "simuler" && !simulateurDisponible;
    const courant = chemin === href && !estSimulateurIndisponible ? ' aria-current="page"' : "";
    const indisponible = estSimulateurIndisponible ? ' aria-disabled="true" tabindex="-1"' : "";
    return `<a href="${href}" data-vue="${cle}"${courant}${indisponible}>${libelle}</a>`;
  }).join("") + '<a href="/mandats/">Mandats</a>';
}
