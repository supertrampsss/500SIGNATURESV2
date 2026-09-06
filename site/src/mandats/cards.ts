import { choiceCopy } from "./novice.ts";
import { choicesFor, domainFor, replayGame, calendarFor, score } from "./engine.ts";
import { CARD_SIZES, challengeURL, escape as e, resultURL, shareText } from "./sharing.ts";
import { decode, encode } from "./storage.ts";
import { ambitionFor } from "./ambitions.ts";
import type { Game } from "./types.ts";
export type CardKind = "result" | "decision" | "challenge";
export function cardModel(g: Game, kind: CardKind) {
  const d = domainFor(g);
  if (kind === 'decision') {
    if (!g.turn) throw new Error('Prenez une décision avant de la partager.');
    const previous = replayGame(g,g.choices.slice(0,-1));
    const c = choicesFor(previous).find(c => c.id === g.choices.at(-1))!;
    const text=choiceCopy(previous,domainFor(previous).dossiers[previous.turn],c);
    const deadline = c.delayed ? `${c.delayed.effect.revenue ? (c.delayed.effect.revenue > 0 ? 'Recette supplémentaire' : 'Fin de la recette temporaire') : 'Livraison'} en année ${calendarFor(previous).year + c.delayed.after}` : 'Effet immédiat, selon les règles';
    const url = `${new URL('/mandats/', 'https://500signatures.fr').href}#dilemma=${encodeURIComponent(encode(previous))}`;
    return { label: `DÉCISION DE JEU · ANNÉE ${g.history.at(-1)?.year ?? g.turn}`, title: text.title, fields: [['Coût du choix', c.cost], ['Effet annoncé', c.benefit], ['Compromis', c.sacrifice], ['Délai', deadline]], url, alt: `Décision de jeu, ${d.place}, année ${g.history.at(-1)?.year ?? g.turn}. ${text.title}. ${c.cost}. ${c.benefit}. Compromis : ${c.sacrifice}. ${c.delayed ? `${deadline}.` : ''} Le lien restitue les décisions antérieures pour rejouer ce dilemme. Simulation fictive v${g.version}.` };
  }
  if (kind === 'challenge') {
    return { label:'DÉFI JOUABLE · SANS VOS CHOIX', title:g.mode === 'municipal' ? `Quel avenir pour ${d.place} ?` : 'Quel cap pour le pays ?', fields: [['Votre mission', d.objectives[0]], ['Durée', d.duration], ['Bilan', g.version === 1 ? 'Quatre critères, règles v1' : !g.ambition || g.ambition === 'equilibre' ? 'Finances, services, habitants, équipements' : `Ancienne priorité : ${ambitionFor(g).label}`], ['Même point de départ', `Scénario ${g.seed} · ${d.turns} tours`]], url:challengeURL(g, 'https://500signatures.fr'), alt:`Défi de jeu, ${d.place}. ${d.objectives[0]}. ${d.duration}. ${g.ambition && g.ambition !== 'equilibre' ? `Ancienne priorité : ${ambitionFor(g).label}.` : 'Bilan sur quatre critères.'} Scénario ${g.seed}, simulation fictive v${g.version}. Le lien ne contient aucune décision du joueur.` };
  }
  const s = score(g);
  return { label:`HÉRITAGE SIMULÉ · ${s.total}/100`, title:s.legacy, fields: [['Finances', `${Math.round(s.dimensions.finances)}/100`], ['Services', `${Math.round(s.dimensions.services)}/100`], ['Cohésion et confiance', `${Math.round(s.dimensions.cohesion)}/100`], ['Résilience et patrimoine', `${Math.round(s.dimensions.resilience)}/100`]], url:resultURL(g, 'https://500signatures.fr'), alt:shareText(g) };
}
export function cardURL(g: Game, kind: CardKind, origin: string) {
  const url = new URL(cardModel(g, kind).url); const target = new URL('/mandats/', origin);
  target.search = url.search; target.hash = url.hash; return target.href;
}
export function dilemmaFromHash(hash: string): Game | null {
  if (!hash.startsWith('#dilemma=')) return null;
  const game = decode(decodeURIComponent(hash.slice(9)));
  if (game.turn >= domainFor(game).turns) throw new Error("Ce dilemme est déjà terminé.");
  return game;
}
function wrap(text: string, max: number): string[] {
  const lines: string[] = []; let current = '';
  for (const word of text.split(/\s+/)) { if (current && (current + ' ' + word).length > max) { lines.push(current); current = word; } else current += (current ? ' ' : '') + word; }
  if (current) lines.push(current); return lines;
}
export function cardSVG(g: Game, kind: CardKind, format: keyof typeof CARD_SIZES) {
  const m = cardModel(g, kind), [w,h] = CARD_SIZES[format], tall = h > 900;
  const titleSize = tall ? 49 : 39, gap = tall ? (h - 650)/3 : 104;
  const label = (text:string,x:number,y:number,size:number,color='#f4f0e7') => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="${color}">${e(text)}</text>`;
  const title = wrap(m.title, tall ? 31 : 48).map((line,i)=>label(line,72,218+i*(titleSize+8),titleSize)).join('');
  const fields = m.fields.map(([name,value],i)=>{
    const x = tall ? 72 : 72+(i%2)*550, y = tall ? 340+i*gap : 325+Math.floor(i/2)*gap;
    return label(name.toLocaleUpperCase('fr'),x,y,17,'#aac7c9')+wrap(value,tall ? 61 : 42).map((line,j)=>label(line,x,y+32+j*26,21)).join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${e(m.alt)}</title><rect width="${w}" height="${h}" fill="#09151b"/><rect x="30" y="30" width="${w-60}" height="${h-60}" rx="24" fill="#142e35" stroke="#50727b"/><path d="M${w-310} 30V150H${w-30}" fill="none" stroke="#e8c69b" opacity=".35"/>${label('MANDATS  /  500 SIGNATURES',72,97,25,'#e8c69b')}${label(m.label,72,145,19,'#bdd3d4')}${title}${fields}<path d="M72 ${h-139}H${w-72}" stroke="#50727b"/>${label('À vous de jouer : 500signatures.fr/mandats/',72,h-102,21,'#e8c69b')}${label(`${domainFor(g).place} · Modèle v${g.version}`,72,h-69,18,'#bdd3d4')}${label('SIMULATION FICTIVE · AUCUNE PRÉDICTION',72,h-43,16,'#bdd3d4')}</svg>`;
}
