import { brancherApparitions } from "./apparition.ts";
import { VALEURS_PAIE } from "./recit-chapitres.ts";

const eurosRecit = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bouge = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Une scène épinglée : son étape suit la part de la section déjà parcourue. */
function etapeScene(scene: HTMLElement): number {
  const n = Number(scene.dataset.etapes) || 1;
  const boite = scene.getBoundingClientRect();
  const course = boite.height - innerHeight;
  const part = course > 40 ? -boite.top / course : (innerHeight * .5 - boite.top) / Math.max(1, boite.height);
  return Math.max(0, Math.min(n - 1, Math.floor(Math.max(0, Math.min(1, part)) * n * .999)));
}

function peindreScene(scene: HTMLElement, etape: number): void {
  if (scene.dataset.etape === String(etape)) return;
  scene.dataset.etape = String(etape);
  if (scene.dataset.scene === "repartir") {
    scene.querySelectorAll<HTMLElement>(".recit-case").forEach(c => c.classList.toggle("est-actif", c.dataset.poste === String(etape)));
    scene.querySelectorAll<HTMLElement>(".recit-postes li").forEach(li => li.classList.toggle("est-actif", li.dataset.poste === String(etape)));
    const ligne = scene.querySelector<HTMLElement>(`.recit-postes li[data-poste="${etape}"]`);
    const valeur = scene.querySelector<HTMLElement>("[data-focus-valeur]"), nom = scene.querySelector<HTMLElement>("[data-focus-nom]");
    if (ligne && valeur && nom) { valeur.textContent = ligne.querySelector("b")?.textContent ?? ""; nom.textContent = ligne.querySelector("span")?.textContent ?? ""; }
  } else if (scene.dataset.scene === "salaire") {
    scene.querySelectorAll<HTMLElement>(".recit-seg[data-part]").forEach(seg => seg.classList.toggle("est-parti", Number(seg.dataset.part) <= etape));
    scene.querySelectorAll<HTMLElement>(".recit-paie-etapes li").forEach(li => li.classList.toggle("est-actif", li.dataset.etape === String(etape)));
    const chiffre = scene.querySelector<HTMLElement>("[data-paie-valeur]");
    if (chiffre) chiffre.textContent = `${eurosRecit.format(VALEURS_PAIE[etape] ?? VALEURS_PAIE[3])}\u00a0€`;
  }
}

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
  const scenes = [...racine.querySelectorAll<HTMLElement>("[data-scene]")];
  const chapitres = [...racine.querySelectorAll<HTMLAnchorElement>("[data-recit-chapitre]")];
  const parrainages = racine.querySelector<HTMLElement>("[data-parrainages]");
  const mandats = document.getElementById("recit-mandats");
  const compteurFin = mandats?.querySelector<HTMLElement>("[data-parrainages-fin]");
  let compteurLance = false;
  if (compteurFin && bouge()) compteurFin.textContent = "0";
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
    scenes.forEach(scene => peindreScene(scene, etapeScene(scene)));
    let chapitre = "";
    for (const lien of chapitres) {
      const cible = document.getElementById(lien.dataset.recitChapitre ?? "");
      if (cible && cible.getBoundingClientRect().top <= seuil) chapitre = lien.dataset.recitChapitre ?? "";
    }
    chapitres.forEach(lien => lien.toggleAttribute("data-actif", lien.dataset.recitChapitre === chapitre));
    racine.toggleAttribute("data-suite", chapitre !== "");
    if (parrainages && mandats) {
      const distance = mandats.getBoundingClientRect().top - boite.top;
      const lu = Math.max(0, Math.min(1, (innerHeight * .6 - boite.top) / Math.max(1, distance)));
      parrainages.textContent = String(Math.round(lu * 500));
    }
    if (compteurFin && !compteurLance && mandats && mandats.getBoundingClientRect().top < innerHeight * .7) {
      compteurLance = true;
      if (bouge()) {
        const depart = performance.now();
        const tic = (t: number) => { const p = Math.min(1, (t - depart) / 1600); compteurFin.textContent = String(Math.round(500 * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tic); };
        requestAnimationFrame(tic);
      } else compteurFin.textContent = "500";
    }
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
    for (const scene of scenes) delete scene.dataset.etape;
    if (compteurFin) compteurFin.textContent = "500";
  } };
}
