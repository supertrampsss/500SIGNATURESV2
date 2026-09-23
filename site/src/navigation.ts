export type Destination = {
  cle: "accueil" | "france" | "territoires" | "simuler" | "salaires" | "analyses";
  href: string;
  libelle: string;
  /** Les ateliers thématiques restent accessibles, mais ne concurrencent pas
   * les quatre destinations qui structurent le produit public. */
  secondaire?: boolean;
  /** Les pages éditoriales restent de vrais liens : elles rechargent leur
   * document pré-rendu au lieu de passer par la SPA. */
  native?: boolean;
};

export const DESTINATIONS: readonly Destination[] = [
  { cle: "accueil", href: "/accueil/", libelle: "Accueil", native: true },
  { cle: "france", href: "/bilan/", libelle: "France" },
  { cle: "territoires", href: "/territoire", libelle: "Ville" },
  { cle: "salaires", href: "/salaires/", libelle: "Salaires", native: true, secondaire: true },
  { cle: "analyses", href: "/analyses/", libelle: "Dossiers", native: true },
  { cle: "simuler", href: "/simulateur", libelle: "Simuler" },
];

/** Le logo et les retours de ligne font varier la hauteur réelle du menu. */
export function suivreHauteurEntete(): void {
  const entete = document.querySelector<HTMLElement>(".entete");
  if (!entete) return;
  const mesurer = () => document.documentElement.style.setProperty(
    "--decalage-entete", `${Math.ceil(entete.getBoundingClientRect().height)}px`,
  );
  mesurer();
  new ResizeObserver(mesurer).observe(entete);
}

function normaliserChemin(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Annule un lien désactivé, sinon prépare la navigation interne demandée. */
export function intercepterNavigation(clic: MouseEvent): Destination | null {
  const lien = (clic.target as HTMLElement | null)?.closest<HTMLAnchorElement>("a[data-vue]");
  if (!lien) return null;
  if (DESTINATIONS.some(d => d.cle === lien.dataset.vue && d.native)) return null;
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
  const primaires = new Set(["accueil","france","territoires","analyses"]);
  return DESTINATIONS.filter(({ cle }) => primaires.has(cle)).map(({ cle, href, libelle }) => {
    const destination = DESTINATIONS.find((candidate) => candidate.cle === cle)!;
    if (destination.native) {
      const courant = (chemin === normaliserChemin(href) || (cle === "accueil" && chemin === "/") || (cle === "analyses" && chemin.startsWith("/analyses/"))) ? ' aria-current="page"' : "";
      return `<a href="${href}"${courant}>${libelle}</a>`;
    }
    const estSimulateurIndisponible = cle === "simuler" && !simulateurDisponible;
    const courant = chemin === normaliserChemin(href) && !estSimulateurIndisponible ? ' aria-current="page"' : "";
    const indisponible = estSimulateurIndisponible ? ' aria-disabled="true" tabindex="-1"' : "";
    return `<a href="${href}" data-vue="${cle}"${courant}${indisponible}>${libelle}</a>`;
  }).join("") + `<a href="/mandats/"${chemin === "/mandats" ? ' aria-current="page"' : ""}>Mandats</a>`;
}

export function brancherMenuNavigation(): void {
  const entete=document.querySelector<HTMLElement>(".entete");
  const nav=document.querySelector<HTMLElement>(".entete__nav");
  if(!entete||!nav||entete.querySelector(".fr-menu")) return;
  const bouton=document.createElement("button");
  bouton.type="button";
  bouton.className="fr-menu";
  bouton.setAttribute("aria-expanded","false");
  bouton.setAttribute("aria-label","Ouvrir le menu");
  bouton.innerHTML='<span aria-hidden="true"></span><span aria-hidden="true"></span>';
  entete.insertBefore(bouton,nav);
  bouton.addEventListener("click",()=>{
    const ouvert=entete.dataset.frMenu==="ouvert";
    if(ouvert){ delete entete.dataset.frMenu; bouton.setAttribute("aria-expanded","false"); bouton.setAttribute("aria-label","Ouvrir le menu"); }
    else { entete.dataset.frMenu="ouvert"; bouton.setAttribute("aria-expanded","true"); bouton.setAttribute("aria-label","Fermer le menu"); }
  });
}
