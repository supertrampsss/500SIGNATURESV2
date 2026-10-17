import type { Game } from './types.ts';
import type { PressureSectorId } from './pressure-types.ts';
import { crisisSeverity, crisisSpec, presidencyCrises } from './presidency-crises.ts';
import { presidencyIcon as icon } from './presidency-icons.ts';

const e = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!);
export const CRISIS_ANCHORS: Record<PressureSectorId, [number, number]> = {
  health: [507, 62], housing: [430, 146], transport: [648, 270], energy: [705, 140], education: [240, 174], administration: [375, 315],
};
export function crisisAnchor(c: {spec:string;sector:PressureSectorId}): [number,number] {
  if(c.spec === 'port') return [720,425];
  if(['greve','blocage','revolte','revolution'].includes(c.spec)) return [440,195];
  return CRISIS_ANCHORS[c.sector];
}
export function crisisAlerts(game: Game): string {
  const crises = presidencyCrises(game).filter(c => c.status !== 'resolved') ?? [];
  return `<div class="pr-alerts" data-crisis-alerts aria-label="Incidents en cours">${crises.map(c => {
    const spec = crisisSpec(c), severity = crisisSeverity(c, game.turn);
    const programme = game.pressure!.programmes.find(p => p.crisisId === c.id && p.status === 'preparing');
    const containment = game.pressure!.programmes.find(p => p.crisisId === c.id && p.status === 'active');
    const due = c.status === 'contained' ? containment?.endsTurn : c.stageStartedPeriod !== undefined ? c.stageStartedPeriod + c.deadline : severity < 3 ? c.startedPeriod + c.deadline * severity : undefined;
    return `<button type="button" class="pr-alert" data-action="${c.id.startsWith('civil-') ? 'presidency-event' : 'presidency-sector'}" data-event="${e(c.id)}" data-sector="${c.sector}" data-crisis-id="${e(c.id)}" data-crisis-status="${c.status}" data-severity="${severity}">
      <span class="pr-alert__symbol">${icon(c.spec === 'port' ? 'port' : c.sector)}</span><span><strong>${e(spec.title)}</strong><small>${programme ? 'Intervention en préparation' : c.status === 'contained' ? 'Secours en service' : severity === 3 ? 'Perturbation critique' : c.parentId ? 'Propagation en cours' : 'Incident en cours'}</small></span>
      <span class="pr-alert__time"${due !== undefined ? ` data-crisis-due="${due}"` : ''}>${due !== undefined ? `${Math.max(0, due - game.turn) * 15} s` : 'Critique'}</span></button>`;
  }).join('') || '<p class="pr-calm">Les incidents sont levés. Les équipes résorbent les retards.</p>'}</div>`;
}
export function crisisBrief(game: Game, sector: PressureSectorId): string {
  return presidencyCrises(game).filter(c => c.sector === sector && c.status !== 'resolved').map(c => {
    const s = crisisSpec(c);
    const parent = c.parentId ? presidencyCrises(game).find(p => p.id === c.parentId) : undefined;
    return `<div class="pr-crisis-brief"><strong>${e(s.title)}</strong><p>${e(s.cause)}</p>${parent ? `<small>Conséquence de : ${e(crisisSpec(parent).title)}.</small>` : ''}<small>${c.status === 'contained' ? 'Le secours est temporaire. Une réponse durable reste possible.' : crisisSeverity(c, game.turn) > 1 ? e(s.worsening) : `Aggravation après ${c.deadline * 2} mois sans réponse opérationnelle.`}</small></div>`;
  }).join('');
}
/** Live vectors are separate from the approved artwork. Every layer comes from
 * saved incidents/programmes, including real delivery and temporary expiration. */
export function crisisEffects(game: Game): string {
  const effects = presidencyCrises(game).filter(c => c.status !== 'resolved' || c.resolvedPeriod === game.turn).map(c => {
    const [x, y] = crisisAnchor(c), severity = crisisSeverity(c, game.turn);
    const preparing = game.pressure!.programmes.some(p => p.crisisId === c.id && p.status === 'preparing');
    const phase = c.status === 'resolved' ? 'recovery' : preparing ? 'intervention' : c.status;
    const windows = Array.from({length: 8}, (_, i) => `<rect class="pr-life-window" x="${(i % 4) * 8 - 14}" y="${Math.floor(i / 4) * 9 - 12}" width="3" height="4" style="--i:${i}"/>`).join('');
    const people = Array.from({length: 8}, (_, i) => `<g class="pr-life-person" style="--i:${i}" transform="translate(${i * 5 - 20} ${20 + i % 2 * 5})"><circle r="1.5" cy="-3"/><path d="M0 0v5m-2-3h4"/></g>`).join('');
    const civil = ['greve','blocage','revolte','revolution'].includes(c.spec);
    const crowd = civil ? `<g class="pr-life-crowd">${Array.from({length: c.spec === 'greve' ? 22 : 65},(_,i)=>`<g transform="translate(${(i%13)*4-26} ${Math.floor(i/13)*4-5})"><circle r="1"/><path d="M0 1v3"/></g>`).join('')}<path class="pr-life-barricade" d="M-35 21h70m-62-4 5 8m8-8 5 8m8-8 5 8m8-8 5 8"/></g>` : '';
    const smoke = c.status === 'active' && ((c.sector === 'energy' && severity >= 2) || ['revolte','revolution'].includes(c.spec)) ? `<g>${Array.from({length:4},(_,i)=>`<ellipse class="pr-life-smoke" cx="${i*9-16}" cy="-9" rx="9" ry="13" style="--i:${i}"/>`).join('')}${['energy','transport'].includes(c.sector) || civil ? '<path class="pr-life-fire" d="M-8 6Q-13-6-4-12Q-7 0 1-4Q7-21 11-9Q23 9 7 12Z"/>' : ''}</g>` : '';
    const intervention = preparing ? '<path class="pr-response-route" d="M-110 50Q-50 50 0 0"/><g class="pr-response-vehicle"><rect x="-5" y="-3" width="10" height="6"/><path d="M-2 0h4m-2-2v4"/></g>' : '';
    return `<g class="pr-life" data-crisis-effect="${e(c.id)}" data-phase="${phase}" data-sector="${c.sector}" data-severity="${severity}" transform="translate(${x} ${y})"><title>${e(crisisSpec(c).title)} : ${phase === 'recovery' ? 'rétablissement' : phase === 'intervention' ? 'réponse en préparation' : c.status === 'contained' ? 'secours en service' : 'perturbation active'}</title><ellipse class="pr-life-ground" rx="54" ry="28"/><ellipse class="pr-life-wave" rx="36" ry="20"/><ellipse class="pr-life-wave pr-life-wave--second" rx="36" ry="20"/>
      <g class="pr-life-city">${windows}</g>${crowd}${smoke}${people}<path class="pr-life-road" d="M-50 32Q0 5 55 30"/><rect class="pr-life-traffic" x="-3" y="-2" width="6" height="4"/>
      ${c.sector === 'energy' && c.status === 'active' ? '<path class="pr-life-fault" d="m-10-26 7 12-8 8 16 10"/>' : ''}${intervention}
      ${phase === 'recovery' ? '<path class="pr-recovery-stroke" d="M-25 3Q0-25 25 3"/>' : ''}</g>`;
  });
  const routes = presidencyCrises(game).filter(c => c.parentId && c.status !== 'resolved').map(c => {
    const parent = presidencyCrises(game).find(p => p.id === c.parentId)!;
    if (parent.status !== 'active') return '';
    const [x1, y1] = crisisAnchor(parent), [x2, y2] = crisisAnchor(c);
    // A same-sector sequel is represented by its alert, without a zero-length route.
    if (parent.sector === c.sector) return '';
    return `<g class="pr-spread" data-crisis-route="${e(parent.id)}:${e(c.id)}"><title>Origine : ${e(crisisSpec(parent).title)} ; conséquence : ${e(crisisSpec(c).title)}</title><path d="M${x1} ${y1} Q${(x1 + x2) / 2 + 45} ${(y1 + y2) / 2 - 30} ${x2} ${y2}"/><path class="pr-spread__flow" d="M${x1} ${y1} Q${(x1 + x2) / 2 + 45} ${(y1 + y2) / 2 - 30} ${x2} ${y2}"/></g>`;
  });
  return routes.join('') + effects.join('');
}
