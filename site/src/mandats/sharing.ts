import { ambitionFor } from "./ambitions.ts";
import { DOMAINS, domainFor, startingGame, score, start } from "./engine.ts";
import { decode, encode } from "./storage.ts";
import type { Ambition, Game, Mode } from "./types.ts";
export const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function challengeURL(g: Game, origin: string): string {
  const url = new URL("/mandats/", origin);
  url.searchParams.set("v", String(g.version));
  if (g.version !== 1) url.searchParams.set("ambition", g.ambition ?? "equilibre");
  url.searchParams.set("mode", g.mode); url.searchParams.set("seed", String(g.seed));
  if(g.version===3 && g.city){url.search="";url.hash="challenge="+encodeURIComponent(encode(startingGame(g)));}
  return url.href;
}
/** Fragment stays off server requests. User explicitly shares the decision history. */
export function resultURL(g: Game, origin: string): string { return `${new URL("/mandats/", origin).href}#result=${encodeURIComponent(encode(g))}`; }
export function sharedResult(hash: string): Game | null {
  if (!hash.startsWith("#result=")) return null;
  const g = decode(decodeURIComponent(hash.slice(8)));
  if (g.turn !== domainFor(g).turns) throw new Error("Le résultat partagé n'est pas un mandat terminé.");
  return g;
}
export function challengeFromURL(url: URL): Game | null {
  if(url.hash.startsWith("#challenge=")){const game=decode(decodeURIComponent(url.hash.slice(11)));if(game.turn)throw new Error("Un défi ne contient pas de décisions.");return game;}
  const mode = url.searchParams.get("mode");
  if (!mode) return null;
  if (!Object.hasOwn(DOMAINS, mode)) throw new Error("Ce mode n'existe pas.");
  const seed = url.searchParams.get("seed") ?? "42";
  if (!/^\d{1,4}$/.test(seed)) throw new Error("La graine du défi est invalide.");
  const version = url.searchParams.get("v") ?? "1";
  if (version !== "1" && version !== "2" && version !== "3") throw new Error("Version de défi inconnue.");
  const ambition = url.searchParams.get("ambition") ?? "equilibre";
  return start(mode as Mode, Number(seed), ambition as Ambition, Number(version) as 1 | 2 | 3);
}
export function shareText(g: Game): string {
  const s = score(g); const d = domainFor(g);
  return `Mandats · ${d.place}. ${s.legacy} : ${s.total}/100. ${g.version !== 1 ? `Priorité : ${ambitionFor(g).label}. ` : ""}Point fort : ${s.strength}. À améliorer : ${s.weakness}. Résultat de jeu, scénario simulé v${g.version}.`;
}
export const CARD_SIZES = { landscape: [1200, 630], square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920] } as const;
export function socialSVG(g: Game | null, format: keyof typeof CARD_SIZES = "landscape"): string {
  const [w, h] = CARD_SIZES[format]; const s = g ? score(g) : null;
  const tall = h > 900; const y = tall ? h * .22 : 195;
  const title = g ? domainFor(g).place : "Choisissez votre mandat";
  const line = (text: string, x: number, yy: number, size: number, fill = "#eef5f2") => `<text x="${x}" y="${yy}" fill="${fill}" font-family="sans-serif" font-size="${size}">${escape(text)}</text>`;
  const labels = { finances: "Finances", services: "Services", cohesion: g && g.version !== 1 ? "Cohésion / confiance" : "Cohésion", resilience: "Résilience / patrimoine" };
  const dimensions = s ? Object.entries(s.dimensions).map(([key, value], i) => {
    const x = tall ? 75 : 735; const yy = tall ? y + 330 + i * 55 : 270 + i * 55;
    return line(labels[key as keyof typeof labels], x, yy, 20, "#b3c5cc") + line(`${Math.round(value)}/100`, w - 180, yy, 23, "#a6ddc5");
  }).join("") : "";
  const mode = g ? `${g.mode === "municipal" ? "MANDAT MUNICIPAL" : "MANDAT NATIONAL"} · ${g.turn} TOURS${g.version !== 1 ? ` · PRIORITÉ ${ambitionFor(g).short.toLocaleUpperCase("fr")}` : ""}` : "UN JEU DE STRATÉGIE PUBLIQUE";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${escape(g ? shareText(g) : "Mandats : gouverner une ville ou la France. Simulation fictive.")}</title><rect width="${w}" height="${h}" fill="#101e28"/><rect x="40" y="40" width="${w - 80}" height="${h - 80}" rx="20" fill="#172c35" stroke="#47747d"/><path d="M65 ${h - 115}H${w - 65}" stroke="#47747d"/>${line("500 SIGNATURES  /  MANDATS", 75, 105, 26, "#a6ddc5")}${line(mode, 75, 145, 18, "#b3c5cc")}${line(title, 75, y + 15, 45)}${line(s ? `${s.total}/100` : "Une ville. Un pays.", 75, y + 115, 84)}${line(s ? s.legacy : "Des décisions qui engagent l'avenir.", 75, y + 175, 30)}${s ? line(`Point fort : ${s.strength}`, 75, y + 235, 20, "#a6ddc5") + line(`À améliorer : ${s.weakness}`, 75, y + 275, 20, "#f1c484") : ""}${dimensions}${line("À vous de gouverner : 500signatures.fr/mandats/", 75, h - 135, 18, "#a6ddc5")}${line(`SIMULATION FICTIVE · MODÈLE V${g?.version ?? 2} · AUCUNE PRÉDICTION`, 75, h - 70, 19, "#b3c5cc")}</svg>`;
}
