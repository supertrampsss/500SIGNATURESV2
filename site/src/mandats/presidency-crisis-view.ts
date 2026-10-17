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
    return `<div class="pr-crisis-brief"><strong>${e(s.title)}</strong><p>${e(c.originReason ?? s.cause)}</p>${parent ? `<small>Conséquence de : ${e(crisisSpec(parent).title)}.</small>` : ''}<small>${c.status === 'contained' ? 'Le secours est temporaire. Une réponse durable reste possible.' : crisisSeverity(c, game.turn) > 1 ? e(s.worsening) : `Aggravation après ${c.deadline * 2} mois sans réponse opérationnelle.`}</small></div>`;
  }).join('');
}
/** Live vectors are separate from the approved artwork. Every layer comes from
 * saved incidents/programmes, including real delivery and temporary expiration. */
export function crisisEffects(game: Game): string {
  const effects = presidencyCrises(game).filter(c => c.status !== 'resolved' || c.resolvedPeriod !== undefined && game.turn - c.resolvedPeriod <= 1).map(c => {
    const [x, y] = crisisAnchor(c), severity = crisisSeverity(c, game.turn);
    const programme = game.pressure!.programmes.find(p => p.crisisId === c.id && p.status === 'preparing');
    const preparing = !!programme;
    const phase = c.status === 'resolved' ? 'recovery' : preparing ? 'intervention' : c.status;
    const totalWork = programme ? Math.max(1, (programme.delay ?? 1) * (programme.implementation ?? 1)) : 1;
    const progress = programme ? Math.max(0, Math.min(99, Math.round(100 * (1 - programme.remainingWork / totalWork)))) : 0;
    const operation = programme ? programme.lastDelayTurn === game.turn ? 'late' : progress > 0 ? 'working' : 'preparing' : 'none';
    const civil = ['greve','blocage','revolte','revolution'].includes(c.spec);
    const recovered = phase === 'recovery';
    const contained = c.status === 'contained';
    const relieved = recovered || contained;
    const windows = Array.from({length: 8}, (_, i) => `<rect class="pr-life-window" x="${(i % 4) * 10 - 18}" y="${Math.floor(i / 4) * 10 - 18}" width="5" height="6" style="--i:${i}"/>`).join('');
    // People and vehicles are screen-legible scene elements, not a population count.
    const people = Array.from({length: relieved ? 3 : severity * 3 + 3}, (_, i) => `<g transform="translate(${i % 6 * 9 - 24} ${18 + Math.floor(i / 6) * 10})"><g class="pr-life-person" style="--i:${i}"><circle r="2.3" cy="-4"/><path d="M0 0v7m-3-4h6"/></g></g>`).join('');
    const crowd = civil ? `<g class="pr-life-crowd">${Array.from({length: relieved ? 8 : c.spec === 'greve' ? 18 : 36},(_,i)=>`<g transform="translate(${(i%9)*7-28} ${Math.floor(i/9)*8-13})"><g class="pr-life-protester" style="--i:${i}"><circle r="2"/><path d="M0 3v5m-3-3h6"/>${i%5 === 0 ? '<path class="pr-life-placard" d="M3 3v-10h9v6H3"/>' : ''}</g></g>`).join('')}</g>` : '';
    const blockade = !recovered && (c.spec === 'port' || civil && c.spec !== 'greve') ? '<g class="pr-life-barricade"><path d="M-40 30h80m-76-5 8 10m12-10 8 10m12-10 8 10m12-10 8 10"/><path d="M-38 30v9m76-9v9"/></g>' : '';
    const smoke = c.status === 'active' && ((c.sector === 'energy' && severity >= 2) || ['revolte','revolution'].includes(c.spec)) ? `<g>${Array.from({length:4},(_,i)=>`<ellipse class="pr-life-smoke" cx="${i*11-18}" cy="-10" rx="11" ry="16" style="--i:${i}"/>`).join('')}<path class="pr-life-fire" d="M-8 6Q-13-6-4-12Q-7 0 1-4Q7-21 11-9Q23 9 7 12Z"/></g>` : '';
    const physicalResponse = ['energy','health','housing','transport'].includes(c.sector) && c.spec !== 'port';
    const work = preparing ? `<g class="pr-response-work" data-work-progress="${progress}"><title>${operation === 'late' ? 'Équipes partagées, intervention retardée' : progress ? 'Intervention en cours' : 'Préparation engagée'} : ${progress} % du travail effectué</title><rect x="-35" y="44" width="70" height="6"/><rect class="pr-response-progress" x="-35" y="44" width="${70 * progress / 100}" height="6"/><path class="pr-response-tools" d="m-7 34 14-14m-14 0 14 14"/>${physicalResponse ? '<path class="pr-response-route" d="M-110 50Q-50 50 0 0"/><g class="pr-response-vehicle"><rect x="-9" y="-5" width="18" height="10"/><path d="M-4 0h8m-4-4v8"/><circle cx="-5" cy="6" r="2"/><circle cx="5" cy="6" r="2"/></g>' : '<g class="pr-response-talk"><circle cx="-10" cy="26" r="4"/><circle cx="10" cy="26" r="4"/><path d="M-6 29h12"/></g>'}</g>` : '';
    const ship = c.spec === 'port' ? `<g class="pr-life-ship"><path class="pr-ship-hull" d="M-27 0L20-7 29-2 16 12-17 15Z"/><path class="pr-ship-deck" d="M-23-1L19-7 24-3 14 4-16 8Z"/><path class="pr-ship-cargo" d="M-9-5l10-2 0 7-10 2Zm13-2 10-2v7L4 0Z"/><path class="pr-ship-bridge" d="M-19-9l7-1v12l-7 2Z"/><path d="M-17-8v-6m-3 0h6"/><path class="pr-ship-detail" d="M-17-4h3m6 2 8-1m5-2 7-1"/><path class="pr-ship-wake" d="M-35 8h-20m23 6h-15"/></g>` : '';
    const traffic = ['transport','health'].includes(c.sector) ? '<path class="pr-life-road" d="M-50 32Q0 5 55 30"/><g class="pr-life-traffic"><rect x="-8" y="-4" width="16" height="8"/><circle cx="-4" cy="5" r="2"/><circle cx="5" cy="5" r="2"/></g>' : '';
    return `<g class="pr-life" data-crisis-effect="${e(c.id)}" data-phase="${phase}" data-service="${c.status}" data-operation="${operation}" data-kind="${e(c.spec)}" data-sector="${c.sector}" data-severity="${severity}" transform="translate(${x} ${y})"><title>${e(crisisSpec(c).title)} : ${recovered ? 'rétablissement, retards encore à résorber' : preparing ? `réponse engagée, ${progress} % du travail effectué` : contained ? 'secours temporaire en service' : 'perturbation active'}</title><g class="pr-life-scene"><ellipse class="pr-life-ground" rx="${48 + severity * 8}" ry="${24 + severity * 4}"/><ellipse class="pr-life-wave" rx="36" ry="20"/><ellipse class="pr-life-wave pr-life-wave--second" rx="36" ry="20"/>
      ${c.sector === 'energy' ? `<g class="pr-life-city">${windows}</g>` : ''}${crowd}${smoke}${!civil && c.sector !== 'energy' ? people : ''}${blockade}${ship}${traffic}
      ${c.sector === 'energy' && !relieved ? '<path class="pr-life-fault" d="m-10-26 7 12-8 8 16 10"/>' : ''}${work}
      ${recovered ? '<path class="pr-recovery-stroke" d="M-25 3Q0-25 25 3"/>' : ''}</g></g>`;
  });
  const routes = presidencyCrises(game).filter(c => c.parentId && c.status !== 'resolved').map(c => {
    const parent = presidencyCrises(game).find(p => p.id === c.parentId)!;
    if (!parent || parent.status !== 'active') return '';
    const [x1, y1] = crisisAnchor(parent), [x2, y2] = crisisAnchor(c);
    // A same-sector sequel is represented by its alert, without a zero-length route.
    if (parent.sector === c.sector) return '';
    return `<g class="pr-spread" data-crisis-route="${e(parent.id)}:${e(c.id)}"><title>Origine : ${e(crisisSpec(parent).title)} ; conséquence : ${e(crisisSpec(c).title)}</title><path d="M${x1} ${y1} Q${(x1 + x2) / 2 + 45} ${(y1 + y2) / 2 - 30} ${x2} ${y2}"/><path class="pr-spread__flow" d="M${x1} ${y1} Q${(x1 + x2) / 2 + 45} ${(y1 + y2) / 2 - 30} ${x2} ${y2}"/></g>`;
  });
  return routes.join('') + effects.join('');
}
