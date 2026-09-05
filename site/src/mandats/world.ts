import { icon } from "./icons.ts";
import { domainFor, calendarFor, startingGame } from "./engine.ts";
import { escape as e } from "./sharing.ts";
import type { Game, Mode } from "./types.ts";

export type WorldOptions = { interactive?: boolean; light?: boolean; inherited?: boolean };
export type Project = { id: string; title: string; area: string; started: number; due: number; state: "planned" | "delivered" | "risk"; recent: boolean };
const AREA_POINTS: Record<Mode, { x: number; y: number }[]> = {
  municipal: [{ x: 27, y: 54 }, { x: 70, y: 71 }, { x: 70, y: 32 }],
  national: [{ x: 47, y: 28 }, { x: 69, y: 43 }, { x: 32, y: 56 }, { x: 49, y: 76 }],
};
export function projects(g: Game): Project[] {
  return g.choices.flatMap((id, index) => {
    const c = domainFor(g).dossiers[index]?.choices.find(c => c.id === id);
    if (!c || (!(c.effect.investment ?? 0) && id !== "reporter")) return [];
    const started = g.version >= 3 ? g.history[index].year : index + 1;
    const due = started + (c.delayed?.after ?? 0);
    const completed = g.version >= 3 ? calendarFor(g).completedYears : g.turn;
    const last = g.history.at(-1);
    const isPending = g.version >= 3 ? !!c.delayed && g.pending.some(p=>p.label === c.delayed!.label) : due > completed;
    const isRecent = g.version >= 3 ? (c.delayed ? !!last?.messages.includes(c.delayed.label) : index === g.turn - 1) : due === completed;
    return [{ id, title: c.title, area: c.delayed?.effect.area ?? c.effect.area ?? "", started, due, state: id === "reporter" ? "risk" : isPending ? "planned" : "delivered", recent: isRecent }];
  });
}
export function deliveredLayers(g: Game): string[] {
  const delivered = projects(g).filter(p => p.state === "delivered").map(p => p.id);
  return [delivered.some(id => ["ecoles", "m01a"].includes(id)) ? "schools" : "", delivered.some(id => ["ombre", "subvention", "m17a"].includes(id)) ? "river" : "", delivered.some(id => ["entretien", "renover", "m05a", "m38a"].includes(id)) ? "civic" : ""].filter(Boolean);
}
export function worldArt(mode: Mode, opts: { light?: boolean; inherited?: boolean; layers?: string[] } = {}): string {
  if (opts.light) return `<div class="world-light"><span>${mode === "municipal" ? "Val-sur-Rive" : "France"}</span><p>Vue légère · les quartiers et leurs indicateurs restent accessibles.</p></div>`;
  const asset = mode === "municipal" ? "city-inherited" : "national-relief";
  return `<picture><source srcset="/mandats/art/${asset}-768.webp 768w, /mandats/art/${asset}-1536.webp 1536w" sizes="(max-width: 820px) 100vw, 65vw" type="image/webp"><img class="world-image" src="/mandats/art/${asset}-768.webp" width="1536" height="1024" alt="${mode === "municipal" ? "Maquette illustrée de Val-sur-Rive, ville fictive traversée par un fleuve" : "Relief illustré de la France, support des profils territoriaux fictifs"}" decoding="async"></picture>${mode === "municipal" && !opts.inherited ? (opts.layers ?? []).map(layer => `<picture class="world-upgrade upgrade-${layer}"><source srcset="/mandats/art/city-renewed-768.webp 768w, /mandats/art/city-renewed-1536.webp 1536w" sizes="(max-width: 820px) 100vw, 65vw"><img src="/mandats/art/city-renewed-768.webp" width="1536" height="1024" alt="" decoding="async"></picture>`).join("") : ""}`;
}
export function world(g: Game, opts: WorldOptions = {}): string {
  if (g.city) return realCityWorld(g, opts);
  const plan = opts.inherited ? [] : projects(g); const areas = opts.inherited ? startingGame(g).areas : g.areas; const shock = !opts.inherited && (g.version >= 3 ? /canicule|énergétique/i.test(g.history.at(-1)?.event ?? "") : g.turn === 3 || (g.mode === "national" && g.version === 2 && g.turn === 5));
  const modeName = domainFor(g).place; const calendar = calendarFor(g);
  const layers = deliveredLayers(g);
  const pins = opts.interactive === false ? "" : areas.map((a, i) => {
    const point = AREA_POINTS[g.mode][i]; const project = plan.filter(p => p.area === a.id).at(-1);
    const state = project?.state ?? (a.services < 45 ? "risk" : "stable");
    return `<button class="world-pin pin-${state}" style="--x:${point.x}%;--y:${point.y}%" data-action="area" data-area="${a.id}" aria-label="${e(a.name)} : services ${Math.round(a.services)} sur 100${project ? `, ${e(project.title)}, ${project.state === "planned" ? `livraison année ${project.due}` : "voir le suivi"}` : ""}"><span class="pin-core" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span class="pin-label">${e(a.name)}<small>${project?.state === "planned" ? `En chantier · an ${project.due}` : `${Math.round(a.services)} / 100 services`}</small></span></button>`;
  }).join("");
  return `<div class="world-scene world-${g.mode} ${shock ? "world-shock" : ""} ${opts.inherited ? "is-inherited" : ""}" data-world-turn="${g.turn}"><div class="world-canvas">${worldArt(g.mode, { ...opts, layers })}<div class="world-vignette" aria-hidden="true"></div>${pins}</div><div class="world-topline"><span>${opts.inherited ? "LE TERRITOIRE HÉRITÉ" : g.turn ? (g.version >= 3 ? `ANNÉE ${calendar.year} · DÉCISION ${g.turn}` : `FIN DE L’ANNÉE ${g.turn}`) : "VOTRE PRISE DE FONCTIONS"}</span><span>${shock ? (g.mode === "municipal" ? "Canicule" : "Choc énergétique") : g.city ? "Maquette de simulation" : "Scénario fictif"}</span></div>${opts.interactive === false ? "" : `<div class="world-bottomline"><span>${e(modeName)}<small>${g.mode === "municipal" ? g.city ? "Profils de quartiers simulés" : "3 quartiers · un avenir commun" : "4 profils · des effets différents"}</small></span><button class="world-control" data-action="world-view" aria-pressed="${!!opts.inherited}">${opts.inherited ? "Voir maintenant" : "Avant / maintenant"}</button></div>`}</div>`;
}
export function deliveryFeed(g: Game): string {
  const recent = projects(g).filter(p => p.recent && p.state === "delivered").slice(-2);
  const allPending = projects(g).filter(p => p.state === "planned"); const pending = allPending.slice(0,2);
  return `<div class="delivery-feed">${recent.map(p => `<div class="delivery delivered"><span class="delivery-symbol">${icon("check")}</span><span><small>EN SERVICE CETTE ANNÉE</small><strong>${e(p.title)}</strong></span></div>`).join("")}${pending.map(p => `<div class="delivery"><span class="delivery-symbol" aria-hidden="true">${Math.max(1, p.due - calendarFor(g).completedYears)}</span><span><small>LIVRAISON · ANNÉE ${p.due}</small><strong>${e(p.title)}</strong></span></div>`).join("")}${allPending.length > 2 ? `<p class="delivery-empty">${allPending.length - 2} autres programmes dans le journal.</p>` : ""}${!recent.length && !pending.length ? '<p class="delivery-empty">Aucun projet en attente.</p>' : ""}</div>`;
}

/** Actual geographic renderer is mounted lazily by the application. */
function realCityWorld(g: Game, opts: WorldOptions): string {
  const city = g.city!;
  const plan = opts.inherited ? [] : projects(g);
  const delivered = plan.filter(p=>p.state === "delivered").length;
  return `<section class="city-world" aria-label="${e(city.name)}, votre commune"><div class="city-world-heading"><p class="eyebrow">COMPTES OBSERVÉS · ${city.year}</p><h2>${e(city.name)}</h2><p>${new Intl.NumberFormat("fr-FR").format(city.population)} habitants · INSEE ${e(city.code)}</p></div>${city.center ? `<div class="city-world-map" data-city-map="${e(city.code)}"></div>` : '<p class="city-world-map">Coordonnées cartographiques indisponibles. Les indicateurs et la partie restent accessibles.</p>'}<div class="city-project-progress"><label>Programmes du jeu livrés <strong>${delivered}/${plan.length}</strong><progress max="${Math.max(1,plan.length)}" value="${delivered}">${delivered} sur ${plan.length}</progress></label><p>Suivi simulé. Les projets ne modifient pas les bâtiments de la carte.</p></div></section>`;
}
