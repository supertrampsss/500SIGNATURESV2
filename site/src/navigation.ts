export type Destination = {
  cle: "accueil" | "france" | "territoires" | "simuler";
  href: string;
  libelle: string;
};

export const DESTINATIONS: readonly Destination[] = [
  { cle: "accueil", href: "/", libelle: "Accueil" },
  { cle: "france", href: "/bilan", libelle: "France" },
  { cle: "territoires", href: "/territoire", libelle: "Territoires" },
  { cle: "simuler", href: "/simulateur", libelle: "Simuler" },
];

/** Rend la seule navigation primaire du site, indépendamment du document. */
export function renduNavigation(pathname: string, simulateurDisponible: boolean): string {
  return DESTINATIONS.map(({ cle, href, libelle }) => {
    const estSimulateurIndisponible = cle === "simuler" && !simulateurDisponible;
    const courant = pathname === href && !estSimulateurIndisponible ? ' aria-current="page"' : "";
    const indisponible = estSimulateurIndisponible ? ' aria-disabled="true" tabindex="-1"' : "";
    return `<a href="${href}" data-vue="${cle}"${courant}${indisponible}>${libelle}</a>`;
  }).join("");
}
