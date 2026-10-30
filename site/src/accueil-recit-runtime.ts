import { brancherApparitions } from "./apparition.ts";

/** Le document est lisible seul. Ce contrôleur ajoute le graphique partagé et
 * les sources sur place, sans prendre la main sur le défilement du navigateur. */
let montage: { racine: HTMLElement; detacher: () => void } | undefined;

export function brancherRecitAccueil(): void {
  const candidate = document.querySelector<HTMLElement>("#vue-accueil [data-recit]");
  const racine = candidate?.closest("[hidden]") ? null : candidate;
  if (montage?.racine === racine) return;
  montage?.detacher();
  montage = undefined;
  if (!racine) return;
  const panneaux = [...racine.querySelectorAll<HTMLElement>("[data-recit-panel]")];
  const liens = [...racine.querySelectorAll<HTMLAnchorElement>("[data-recit-step]")];
  const sources = racine.querySelector<HTMLDialogElement>(".recit-sources");
  const controleur = new AbortController();
  const { signal } = controleur;
  let attente = 0;
  let ouverture = racine.querySelector<HTMLElement>("[data-recit-source]");

  const mesurer = () => {
    attente = 0;
    if (!racine.isConnected || !racine.getClientRects().length) return;
    const seuil = Math.min(innerHeight * .5, 420);
    let etape = 0;
    for (const panneau of panneaux) {
      if (panneau.getBoundingClientRect().top <= seuil) etape = Number(panneau.dataset.recitPanel);
    }
    racine.dataset.step = String(etape);
    // Une étape vue le reste : ses titres se lèvent une fois, sans revenir.
    for (const panneau of panneaux) {
      if (panneau.getBoundingClientRect().top <= innerHeight * .85) panneau.dataset.vu = "";
    }
    const boite = racine.getBoundingClientRect();
    const parcours = Math.max(1, boite.height - innerHeight);
    racine.style.setProperty("--recit-progression", String(Math.min(1, Math.max(0, -boite.top / parcours))));
    liens.forEach((lien, index) => {
      if (index === etape) lien.setAttribute("aria-current", "step");
      else lien.removeAttribute("aria-current");
    });
  };
  const programmer = () => { if (!attente) attente = requestAnimationFrame(mesurer); };
  window.addEventListener("scroll", programmer, { passive: true, signal });
  window.addEventListener("resize", programmer, { passive: true, signal });
  window.addEventListener("pageshow", programmer, { signal });
  const suivreAncre = () => {
    if (location.hash === "#recit-sources" && sources && !sources.open) sources.showModal();
    programmer();
  };
  window.addEventListener("hashchange", suivreAncre, { signal });
  if (sources && typeof sources.showModal === "function") {
    sources.close();
    racine.querySelector("[data-recit-source]")?.addEventListener("click", (event) => {
      const clic = event as MouseEvent;
      if (clic.button !== 0 || clic.metaKey || clic.ctrlKey || clic.shiftKey || clic.altKey) return;
      event.preventDefault();
      ouverture = event.currentTarget as HTMLElement;
      sources.showModal();
    }, { signal });
    sources.querySelector("[data-recit-close]")?.addEventListener("click", () => sources.close(), { signal });
    sources.addEventListener("close", () => {
      // La fermeture du lien profond doit rester acquise si une publication
      // arrivée pendant la lecture remplace ensuite le document.
      if (sources.open) return;
      if (location.hash === "#recit-sources") {
        const adresse = new URL(location.href);
        adresse.hash = "";
        history.replaceState(history.state, "", adresse);
      }
      ouverture?.focus({ preventScroll: true });
    }, { signal });
  }
  racine.dataset.enhanced = "true";
  suivreAncre();
  mesurer();
  brancherApparitions(document.getElementById("vue-accueil") ?? document);
  montage = { racine, detacher: () => {
    controleur.abort();
    cancelAnimationFrame(attente);
    if (sources?.open) sources.close();
    delete racine.dataset.enhanced;
    for (const panneau of panneaux) delete panneau.dataset.vu;
  } };
}
