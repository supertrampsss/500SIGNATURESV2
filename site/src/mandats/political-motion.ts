import type { VoteRecord } from './politics-types.ts';

export interface PoliticalMotionClock {
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
}
const browserClock: PoliticalMotionClock = {
  set: (callback, delay) => window.setTimeout(callback, delay),
  clear: handle => window.clearTimeout(handle as number),
};
export type PoliticalMotionOptions = { clock?: PoliticalMotionClock; reducedMotion?: boolean; onContinue?: () => void };
const fmt = (value:number) => new Intl.NumberFormat('fr-FR').format(value);
export function politicalVoteOutcome(record: VoteRecord): { label: string; announcement: string; adverse: boolean } {
  if(record.kind==='censure') return record.passed
    ? {label:'Gouvernement renversé',announcement:'La motion de censure est adoptée : le gouvernement est renversé.',adverse:true}
    : {label:'Gouvernement maintenu',announcement:'La motion de censure est rejetée : le gouvernement est maintenu.',adverse:false};
  if(record.kind==='destitution') return record.passed
    ? {label:'Destitution prononcée',announcement:'La procédure aboutit : la destitution est prononcée.',adverse:true}
    : {label:'Procédure arrêtée',announcement:'La procédure de destitution s’arrête : le seuil constitutionnel n’est pas atteint.',adverse:false};
  if(record.kind==='election') return {label:'Nouvelle répartition des sièges',announcement:'Résultats électoraux enregistrés.',adverse:false};
  return record.passed
    ? {label:'Adopté',announcement:'Le texte est adopté.',adverse:false}
    : {label:'Rejeté',announcement:'Le texte est rejeté.',adverse:true};
}

/** Reveal only the already-persisted tally; the animation cannot change game state. */
export function mountPoliticalMotion(root: ParentNode, record: VoteRecord, options: PoliticalMotionOptions = {}): () => void {
  const section = root instanceof Element && root.matches('[data-political-vote]') ? root : root.querySelector<HTMLElement>('[data-political-vote]');
  if (!section) return () => {};
  const clock = options.clock ?? browserClock;
  const reduced = options.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const seats = [...section.querySelectorAll<SVGCircleElement>('.vote-seat')];
  const stages = record.stages?.length ? record.stages : [{chamber:record.chamber,total:record.total,for:record.for,against:record.against,abstain:record.abstain,threshold:record.threshold,passed:record.passed,groups:record.groups}];
  const election = record.kind === 'election';
  const controls = (action:string) => section.querySelector<HTMLButtonElement>(`[data-political-action="${action}"]`);
  const accelerate = controls('accelerate'), skip = controls('skip'), proceed = controls('continue');
  const announcement = section.querySelector<HTMLElement>('[data-vote-announcement]');
  const verdict = section.querySelector<HTMLElement>('[data-vote-verdict]');
  let cursor = 0, timer: unknown, disposed = false, completed = false, settling = false;
  const normalDelay = Math.max(7, Math.min(22, 1900 / Math.ceil(Math.max(1,seats.length) / 6)));
  let delay = normalDelay;
  const revealFinish = () => {
    if (disposed || completed) return;
    completed = true;
    for (const seat of seats) seat.dataset.revealed = 'true';
    stages.forEach((stage,index)=>{
      for (const key of ['for','against','abstain'] as const) {
        const node=section.querySelector<HTMLElement>(`[data-tally-stage="${index}"] [data-tally="${key}"]`);
        if(node)node.textContent=fmt(stage[key]);
      }
      for(const group of stage.groups) {
        const node=section.querySelector<HTMLElement>(`.vote-bloc-grid [data-seat-stage="${index}"][data-seat-group="${group.id}"]`);
        if(node)node.textContent=fmt(group.seats??0);
      }
      const stageVerdict=section.querySelector<HTMLElement>(`[data-vote-stage="${index}"] [data-stage-verdict]`);
      if(stageVerdict)stageVerdict.textContent=stage.passed?'Seuil atteint':'Seuil non atteint';
    });
    if (accelerate) accelerate.hidden = true;
    if (skip) skip.hidden = true;
    if (proceed) proceed.disabled = false;
    const title=verdict?.querySelector('strong'), detail=verdict?.querySelector('span');
    const outcome=politicalVoteOutcome(record);
    if(verdict){verdict.dataset.adverse=String(outcome.adverse);verdict.dataset.passed=String(record.passed);}
    if (election) {
      if(title)title.textContent=outcome.label;
      if(detail)detail.textContent=stages.at(-1)!.groups.map(group=>`${group.label} ${fmt(group.seats??0)}`).join(' · ');
    } else {
      if(title)title.textContent=stages.length>1&&record.kind!=='destitution'?(record.passed?'Procédure aboutie':'Procédure arrêtée'):outcome.label;
      if(detail)detail.textContent=stages.length>1?`${stages.at(-1)!.chamber} · ${record.passed?'seuil atteint':'seuil non atteint'}`:`${fmt(record.for)} voix pour · ${fmt(record.against)} contre · ${fmt(record.abstain)} abstentions`;
    }
    section.querySelector<HTMLElement>('.political-vote__consequences')?.removeAttribute('hidden');
    if (announcement) announcement.textContent = election
      ? `${outcome.announcement} ${stages.at(-1)!.groups.map(group=>`${group.label} ${group.seats??0} sièges`).join(', ')}.`
      : `${outcome.announcement} Résultat enregistré${stages.length>1?` après ${stages.length} étapes`:''}.`;
  };
  const revealBatch = () => {
    if (disposed || completed) return;
    if(cursor>=seats.length) {
      if(!settling) { settling=true; timer=clock.set(revealFinish, reduced?0:delay<=3?220:520); }
      return;
    }
    const batch = delay <= 3 ? 48 : 6;
    let added = 0;
    while (cursor < seats.length && added < batch) {
      const seat = seats[cursor++]; seat.dataset.revealed = 'true';
      const stage=seat.dataset.stageIndex??'0', key=seat.dataset.vote;
      if(election) {
        const group=seat.dataset.bloc;
        const node=section.querySelector<HTMLElement>(`.vote-bloc-grid [data-seat-stage="${stage}"][data-seat-group="${group}"]`);
        if(node)node.textContent=fmt((Number(node.textContent?.replace(/\D/g,''))||0)+1);
      } else if (key === 'for' || key === 'against' || key === 'abstain') {
        const node=section.querySelector<HTMLElement>(`[data-tally-stage="${stage}"] [data-tally="${key}"]`);
        if(node)node.textContent=fmt((Number(node.textContent?.replace(/\D/g,''))||0)+1);
      }
      added++;
    }
    if (cursor >= seats.length) { settling=true; timer=clock.set(revealFinish, reduced?0:delay<=3?220:520); }
    else timer = clock.set(revealBatch, delay);
  };
  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLButtonElement>('[data-political-action]')?.dataset.politicalAction;
    if (action === 'accelerate' && !completed) { delay = 2; settling=false; if (timer !== undefined) clock.clear(timer); timer = clock.set(revealBatch, 0); }
    if (action === 'skip' && !completed) { if (timer !== undefined) clock.clear(timer); revealFinish(); }
    if (action === 'continue' && completed) options.onContinue?.();
  };
  section.addEventListener('click', onClick);
  if (reduced) revealFinish(); else timer = clock.set(revealBatch, 0);
  return () => { disposed = true; if(timer !== undefined) clock.clear(timer); section.removeEventListener('click', onClick); };
}
