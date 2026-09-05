import { DOMAINS } from "./engine.ts";
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
    const c = DOMAINS[g.mode].dossiers[index]?.choices.find(c => c.id === id);
    if (!c || (!(c.effect.investment ?? 0) && id !== "reporter")) return [];
    const due = index + 1 + (c.delayed?.after ?? 0);
    return [{ id, title: c.title, area: c.delayed?.effect.area ?? c.effect.area ?? "", started: index + 1, due, state: id === "reporter" ? "risk" : due > g.turn ? "planned" : "delivered", recent: due === g.turn }];
  });
}
export function deliveredLayers(g: Game): string[] {
  const delivered = projects(g).filter(p => p.state === "delivered").map(p => p.id);
  return [delivered.includes("ecoles") ? "schools" : "", delivered.some(id => ["ombre", "subvention"].includes(id)) ? "river" : "", delivered.some(id => ["entretien", "renover"].includes(id)) ? "civic" : ""].filter(Boolean);
}
export function worldArt(mode: Mode, opts: { light?: boolean; inherited?: boolean; layers?: string[] } = {}): string {
  if (opts.light) return `<div class="world-light"><span>${mode === "municipal" ? "Val-sur-Rive" : "France"}</span><p>Vue légère · les quartiers et leurs indicateurs restent accessibles.</p></div>`;
  const asset = mode === "municipal" ? "city-inherited" : "national-relief";
  return `<picture><source srcset="/mandats/art/${asset}-768.webp 768w, /mandats/art/${asset}-1536.webp 1536w" sizes="(max-width: 820px) 100vw, 65vw" type="image/webp"><img class="world-image" src="/mandats/art/${asset}-768.webp" width="1536" height="1024" alt="${mode === "municipal" ? "Maquette illustrée de Val-sur-Rive, ville fictive traversée par un fleuve" : "Relief illustré de la France, support des profils territoriaux fictifs"}" decoding="async"></picture>${mode === "municipal" && !opts.inherited ? (opts.layers ?? []).map(layer => `<picture class="world-upgrade upgrade-${layer}"><source srcset="/mandats/art/city-renewed-768.webp 768w, /mandats/art/city-renewed-1536.webp 1536w" sizes="(max-width: 820px) 100vw, 65vw"><img src="/mandats/art/city-renewed-768.webp" width="1536" height="1024" alt="" decoding="async"></picture>`).join("") : ""}`;
}
export function world(g: Game, opts: WorldOptions = {}): string {
  const plan = opts.inherited ? [] : projects(g); const areas = opts.inherited ? DOMAINS[g.mode].initial().areas : g.areas; const shock = !opts.inherited && (g.turn === 3 || (g.mode === "national" && g.version === 2 && g.turn === 5));
  const modeName = g.mode === "municipal" ? "Val-sur-Rive" : "France";
  const layers = deliveredLayers(g);
  const pins = opts.interactive === false ? "" : areas.map((a, i) => {
    const point = AREA_POINTS[g.mode][i]; const project = plan.filter(p => p.area === a.id).at(-1);
    const state = project?.state ?? (a.services < 45 ? "risk" : "stable");
    return `<button class="world-pin pin-${state}" style="--x:${point.x}%;--y:${point.y}%" data-action="area" data-area="${a.id}" aria-label="${e(a.name)} : services ${Math.round(a.services)} sur 100${project ? `, ${e(project.title)}, ${project.state === "planned" ? `livraison année ${project.due}` : "voir le suivi"}` : ""}"><span class="pin-core" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><span class="pin-label">${e(a.name)}<small>${project?.state === "planned" ? `En chantier · an ${project.due}` : `${Math.round(a.services)} / 100 services`}</small></span></button>`;
  }).join("");
  return `<div class="world-scene world-${g.mode} ${shock ? "world-shock" : ""} ${opts.inherited ? "is-inherited" : ""}" data-world-turn="${g.turn}"><div class="world-canvas">${worldArt(g.mode, { ...opts, layers })}<div class="world-vignette" aria-hidden="true"></div>${pins}</div><div class="world-topline"><span>${opts.inherited ? "LE TERRITOIRE HÉRITÉ" : g.turn ? `FIN DE L'ANNÉE ${g.turn}` : "VOTRE PRISE DE FONCTIONS"}</span><span>${shock ? (g.mode === "municipal" ? "Canicule" : "Choc énergétique") : "Scénario fictif"}</span></div>${opts.interactive === false ? "" : `<div class="world-bottomline"><span>${modeName}<small>${g.mode === "municipal" ? "3 quartiers · un avenir commun" : "4 profils · des effets différents"}</small></span><button class="world-control" data-action="world-view" aria-pressed="${!!opts.inherited}">${opts.inherited ? "Voir maintenant" : "Avant / maintenant"}</button></div>`}</div>`;
}
export function deliveryFeed(g: Game): string {
  const recent = projects(g).filter(p => p.recent && p.state === "delivered");
  const pending = projects(g).filter(p => p.state === "planned");
  return `<div class="delivery-feed">${recent.map(p => `<div class="delivery delivered"><span class="delivery-symbol" aria-hidden="true">✓</span><span><small>EN SERVICE CETTE ANNÉE</small><strong>${e(p.title)}</strong></span></div>`).join("")}${pending.map(p => `<div class="delivery"><span class="delivery-symbol" aria-hidden="true">${Math.max(1, p.due - g.turn)}</span><span><small>LIVRAISON · ANNÉE ${p.due}</small><strong>${e(p.title)}</strong></span></div>`).join("")}${!recent.length && !pending.length ? '<p class="delivery-empty">Chaque décision prépare la suite du mandat.</p>' : ""}</div>`;
}
