import type { Game } from './types.ts';
import type { PoliticalEnding, VoteGroup, VoteRecord } from './politics-types.ts';
import { annualDeficit } from './national-deficit.ts';
import { politicalVoteOutcome } from './political-motion.ts';

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const number = (value: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
const clampedCount = (value: number) => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
const statusName = (status: string) => status === 'for' ? 'Pour' : status === 'against' ? 'Contre' : status === 'abstain' ? 'Abstention' : 'Non détaillé';

function seatCoordinates(total: number): {x:number;y:number;index:number}[] {
  const rowCount = total > 700 ? 22 : 16;
  const rows = Array.from({length: rowCount}, (_, row) => Math.floor(total / rowCount) + (row < total % rowCount ? 1 : 0));
  const cx = 400, cy = 394, inner = 74, outer = 340;
  return rows.flatMap((count, row) => Array.from({length: count}, (_, seat) => {
    const radius = inner + (outer - inner) * row / Math.max(1, rows.length - 1);
    const angle = Math.PI + Math.PI * (seat + .5) / count;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, index: rows.slice(0,row).reduce((a,b)=>a+b,0)+seat };
  }));
}

type VoteStage = { chamber:string; total:number; for:number; against:number; abstain:number; threshold:number; passed:boolean; groups:VoteGroup[] };
function voteSeats(stage: VoteStage, election = false): {group: VoteGroup; status: 'for'|'against'|'abstain'|'seat'}[] {
  const output: {group: VoteGroup; status: 'for'|'against'|'abstain'|'seat'}[] = [];
  for (const group of stage.groups) {
    for (const status of (election ? ['seat'] as const : ['for', 'against', 'abstain'] as const)) {
      const count = clampedCount(election ? group.seats ?? 0 : status === 'seat' ? 0 : group[status]);
      for (let i = 0; i < count; i++) output.push({ group, status });
    }
  }
  return output;
}
function oneChamberMarkup(stage: VoteStage, index:number, election = false): string {
  // An election's seats are not the same thing as ballots. Omit its hemicycle unless
  // the engine has supplied a real seat allocation for every group.
  const seatCountKnown = !election || stage.groups.every(group => Number.isFinite(group.seats));
  const voters = voteSeats(stage, election), positions = seatCountKnown ? seatCoordinates(stage.total) : [];
  const radius = stage.total > 700 ? 3.0 : 4.1;
  const seats = positions.map(({x,y,index:seatIndex}) => {
    const vote = voters[seatIndex];
    const label = vote ? `${vote.group.label} · ${election ? 'siège obtenu' : statusName(vote.status)}` : 'Vote non détaillé dans ce relevé';
    const cls = vote ? election ? `seat--bloc seat--bloc-${vote.group.id}` : `seat--${vote.status}` : 'seat--undetailed';
    return `<circle class="vote-seat ${cls}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}" data-seat-index="${seatIndex}" data-stage-index="${index}" data-vote="${vote?.status ?? 'undetailed'}" data-bloc="${vote?.group.id ?? ''}" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label)}</title></circle>`;
  }).join('');
  const label = seatCountKnown ? `${number(stage.total)} sièges, ${escapeHtml(stage.chamber)}` : `${escapeHtml(stage.chamber)} · répartition des sièges non fournie`;
  const svg = seatCountKnown ? `<svg class="vote-hemicycle" viewBox="0 0 800 430" role="img" aria-label="${label}"><path class="hemicycle-floor" d="M60 394 A340 340 0 0 1 740 394 Z"/>${seats}<text x="400" y="376" text-anchor="middle" class="hemicycle-label">${escapeHtml(stage.chamber.toLocaleUpperCase('fr'))} · ${number(stage.total)}</text></svg>` : `<p class="vote-sequence__detail-note">Le nombre de sièges par groupe n’est pas fourni ; aucun hémicycle n’est simulé.</p>`;
  const note = voters.length === stage.total || !seatCountKnown ? '' : `<p class="vote-sequence__detail-note">${number(Math.max(0,stage.total-voters.length))} siège${stage.total-voters.length===1?'':'s'} sans détail dans le relevé.</p>`;
  const summary = election ? `<div class="vote-bloc-grid" aria-label="Sièges obtenus par groupe">${stage.groups.map(group=>`<span><i class="seat-swatch seat-swatch--${group.id}"></i>${escapeHtml(group.label)} <b data-seat-group="${escapeHtml(group.id)}" data-seat-stage="${index}">0</b></span>`).join('')}</div>` : `<div class="vote-tally" aria-live="polite" aria-atomic="true" data-tally-stage="${index}"><span><b data-tally="for">0</b> <small>pour</small></span><span><b data-tally="against">0</b> <small>contre</small></span><span><b data-tally="abstain">0</b> <small>abstentions</small></span></div>`;
  return `<section class="vote-stage" data-vote-stage="${index}"><h3>${escapeHtml(stage.chamber)}</h3>${svg}${note}${summary}${!election?`<p class="vote-stage__threshold">${stage.threshold?`Seuil : ${number(stage.threshold)} · `:''}<span data-stage-verdict>${stage.passed?'Résultat à révéler':'Résultat à révéler'}</span></p>`:''}</section>`;
}

/** SVG seat diagrams use only the exact chamber total and recorded group tallies. */
export function hemicycleMarkup(record: VoteRecord): string {
  const stages = record.stages?.length ? record.stages : [{chamber:record.chamber,total:record.total,for:record.for,against:record.against,abstain:record.abstain,threshold:record.threshold,passed:record.passed,groups:record.groups}];
  return stages.map((stage,index)=>oneChamberMarkup(stage,index,record.kind==='election')).join('');
}

/** Reveal saved vote counts, or actual post-election bloc seat totals. */
export function voteSequenceMarkup(record: VoteRecord): string {
  const election = record.kind === 'election';
  const stages = record.stages?.length ? record.stages : [{chamber:record.chamber,total:record.total,for:record.for,against:record.against,abstain:record.abstain,threshold:record.threshold,passed:record.passed,groups:record.groups}];
  const thresholdText = record.kind === 'censure' ? 'majorité des membres' : election ? 'Répartition des sièges après le scrutin' : `seuil constitutionnel · ${stages.length} étape${stages.length===1?'':'s'}`;
  return `<section class="political-vote ${election?'political-vote--election':''}" data-political-vote data-vote-id="${escapeHtml(record.id)}" data-vote-kind="${record.kind}" aria-labelledby="political-vote-title">
    <div class="political-vote__art" aria-hidden="true"><img src="/mandats/art/parliament.webp" alt="" loading="lazy"></div>
    <div class="political-vote__paper">
      <p class="political-vote__eyebrow">${election?'RÉSULTAT ÉLECTORAL':'SCRUTIN PUBLIC'} · ${escapeHtml(record.chamber)}</p>
      <h2 id="political-vote-title" tabindex="-1">${escapeHtml(record.title)}</h2>
      <p class="political-vote__threshold">${escapeHtml(thresholdText)}</p>
      <div class="political-vote__stages">${stages.map((stage,index)=>oneChamberMarkup(stage,index,election)).join('')}</div>
      <div class="political-vote__verdict" data-vote-verdict aria-live="polite"><strong>${election?'Résultats en cours':'Scrutin en cours'}</strong><span></span></div>
      <ul class="political-vote__consequences" role="list" hidden>${record.consequences.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <div class="political-vote__controls"><button type="button" data-political-action="accelerate">Accélérer</button><button type="button" data-political-action="skip">Passer l’animation</button><button type="button" data-political-action="continue" disabled>Continuer</button></div>
      <p class="political-vote__sr" data-vote-announcement role="status"></p>
    </div>
  </section>`;
}

export function politicalHud(game: Game): string {
  const politics = game.politics;
  if (game.version < 10 || game.mode !== 'national' || !politics) return '';
  const cabinet = politics.cabinet === 'cohabitation' ? 'Cohabitation' : politics.cabinet === 'fallen' ? 'Gouvernement censuré' : 'Gouvernement';
  const obligations = politics.commitments.filter(item=>item.status==='pending').sort((a,b)=>a.dueTurn-b.dueTurn);
  const coalitionSeats=politics.blocs.filter(bloc=>bloc.inGovernment).reduce((sum,bloc)=>sum+bloc.seats,0);
  const cabinetStatus=politics.cabinet==='cohabitation'?cabinet:politics.cabinet==='fallen'?cabinet:coalitionSeats>=289?'Majorité de coalition':'Majorité relative';
  const lastVote=politics.lastVote;
  const lastVoteMarkup=lastVote?(()=>{
    const outcome=politicalVoteOutcome(lastVote);
    const details=lastVote.kind==='election'
      ? `Coalition actuelle : ${cabinetStatus}, ${number(coalitionSeats)} sièges. Répartition enregistrée : ${lastVote.groups.map(group=>`${escapeHtml(group.label)} ${number(group.seats??0)}`).join(' · ')}.`
      : lastVote.stages?.length
        ? lastVote.stages.map(stage=>`${escapeHtml(stage.chamber)} : ${number(stage.for)} pour, ${number(stage.against)} contre, ${number(stage.abstain)} abstentions`).join(' · ')
        : `${number(lastVote.for)} pour · ${number(lastVote.against)} contre · ${number(lastVote.abstain)} abstentions`;
    return `<p class="political-hud__last-vote"><span>Dernier vote · ${escapeHtml(lastVote.title)}</span><strong>${escapeHtml(outcome.label)}<small>${details}</small></strong></p>`;
  })():'<p class="political-hud__last-vote">Aucun vote enregistré.</p>';
  return `<section class="political-hud" aria-label="État politique du mandat">
    <header class="political-hud__summary"><strong>${cabinetStatus}</strong><span><b>${number(coalitionSeats)}</b> sièges</span><span><b>${number(politics.legitimacy)}</b> légitimité</span><span><b>${number(politics.unrest)}</b> tension</span></header>
    <details class="political-hud__details"><summary>Groupes, engagements et dernier vote</summary>
      <div class="political-hud__detail-grid"><section class="political-hud__groups"><h3>Assemblée · ${number(politics.blocs.reduce((sum,bloc)=>sum+bloc.seats,0))} sièges</h3><ul>${politics.blocs.map(bloc=>`<li><span>${escapeHtml(bloc.label)}${bloc.inGovernment?' · soutien':' · opposition'}</span><strong>${number(bloc.seats)}</strong></li>`).join('')}</ul></section>
      <section class="political-hud__obligations"><h3>Engagements à tenir · ${number(obligations.length)}</h3>${obligations.length?`<ul>${obligations.map(item=>`<li><span>${escapeHtml(item.label)}</span><small>Échéance : décision ${item.dueTurn+1}</small></li>`).join('')}</ul>`:`<p>Aucun engagement en attente.</p>`}</section>
      ${lastVoteMarkup}</div>
    </details>
  </section>`;
}

export function politicalEnding(game: Game): string {
  if (game.version < 10 || game.mode !== 'national' || !game.politics?.ending) return '';
  const ending: PoliticalEnding = game.politics.ending;
  const stoppedEarly = ending.kind !== 'term_complete';
  return `<section class="result political-ending" aria-labelledby="political-ending-title">
    <div class="political-ending__art"><img src="/mandats/art/${ending.kind==='rupture'?'rupture':'council'}.webp" alt="" loading="lazy"></div>
    <div class="political-ending__copy"><p class="political-ending__eyebrow">${stoppedEarly?'MANDAT INTERROMPU':'FIN DU QUINQUENNAT'}</p><h1 id="political-ending-title" tabindex="-1">${escapeHtml(ending.title)}</h1><p>${escapeHtml(ending.reason)}</p>
      ${stoppedEarly?`<p class="political-ending__duration">Le mandat s’arrête à la décision ${number(ending.turn)}. Le bilan porte sur la période réellement jouée.</p>`:`<p class="political-ending__duration">Les cinq années du mandat sont achevées.</p>`}
      <section class="political-ending__snapshot" aria-label="État du pays au moment de l’arrêt"><h2>Le pays au moment de l’arrêt</h2><dl><div><dt>Déficit annuel</dt><dd>${number(Math.abs(annualDeficit(game)))} Md€</dd></div><div><dt>Services publics</dt><dd>${number(game.metrics.services)} / 100</dd></div><div><dt>Confiance</dt><dd>${number(game.metrics.trust)} / 100</dd></div><div><dt>Soutien au gouvernement</dt><dd>${number(game.politics!.blocs.filter(bloc=>bloc.inGovernment).reduce((sum,bloc)=>sum+bloc.seats,0))} sièges</dd></div></dl></section>
      ${game.pending.length?`<section class="political-ending__pending"><h2>Effets différés non encore appliqués</h2><p>Le mandat s’arrête avant leur échéance ; ils ne sont pas ajoutés au bilan.</p><ul>${game.pending.map(item=>`<li>${escapeHtml(item.label)} <small>prévu en année ${number(item.due+1)}</small></li>`).join('')}</ul></section>`:''}
      ${game.politics!.commitments.some(item=>item.status==='pending')?`<section class="political-ending__pending"><h2>Engagements politiques en attente</h2><ul>${game.politics!.commitments.filter(item=>item.status==='pending').map(item=>`<li>${escapeHtml(item.label)} <small>échéance : décision ${number(item.dueTurn+1)}</small></li>`).join('')}</ul></section>`:''}
      <section><h2>Ce qui a conduit à cette issue</h2><ul>${ending.causes.map(cause=>`<li>${escapeHtml(cause)}</li>`).join('')}</ul></section>
      <div class="political-ending__actions"><button class="political-ending__replay political-ending__replay--primary" type="button" data-action="open-replay-selection">Rejouer une décision</button><button class="political-ending__replay" type="button" data-action="replay">Rejouer ce scénario</button><button class="political-ending__tools" type="button" data-action="tools">Ma partie · exporter</button></div></div>
  </section>`;
}
