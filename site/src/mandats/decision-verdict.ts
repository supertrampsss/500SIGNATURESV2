import type { Game } from './types.ts';
import { politicalVoteOutcome } from './political-motion.ts';
import { escape } from './sharing.ts';

/** A transient receipt of an already saved decision. Closing it never advances the game. */
export function showDecisionVerdict(game: Game, onDismiss: () => void) {
  const last = game.history.at(-1);
  if (!last) return;
  const vote = last.vote;
  const outcome = vote ? politicalVoteOutcome(vote) : null;
  const label = vote?.kind === 'law' ? `Texte ${vote.passed ? 'adopté' : 'rejeté'}` : outcome?.label ?? 'Décision prise';
  const stage = vote?.stages?.at(-1) ?? vote;
  const fmt = (value: number) => new Intl.NumberFormat('fr-FR').format(value);
  const tally = stage && vote?.kind !== 'election'
    ? `<p class="decision-verdict__tally"><span><b>${fmt(stage.for)}</b> pour</span><span><b>${fmt(stage.against)}</b> contre</span><span><b>${fmt(stage.abstain)}</b> abst.</span></p>` : '';
  const element = document.createElement('dialog');
  element.className = 'decision-verdict';
  element.dataset.decisionVerdict = outcome?.adverse ? 'rejected' : 'accepted';
  element.setAttribute('aria-labelledby', 'decision-verdict-title');
  element.setAttribute('aria-describedby', 'decision-verdict-subject');
  element.innerHTML = `<button class="decision-verdict__close" type="button" data-action="dismiss-verdict" aria-label="Fermer le résultat">Fermer</button>
    <p class="decision-verdict__chamber">${escape(vote?.kind === 'election' ? 'Élections législatives' : stage?.chamber ?? 'Votre décision')}</p>
    <h2 id="decision-verdict-title" tabindex="-1" autofocus>${escape(label)}</h2>
    <p class="decision-verdict__subject" id="decision-verdict-subject">${escape(last.title)}</p>${tally}`;
  document.body.append(element);
  let timer: number | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (timer !== undefined) window.clearTimeout(timer);
    element.removeEventListener('cancel', cancel);
    element.removeEventListener('keydown', pauseForKeyboard);
    element.close();
    element.remove();
  };
  const dismiss = () => { if (!disposed) { dispose(); onDismiss(); } };
  const cancel = (event: Event) => { event.preventDefault(); dismiss(); };
  const pauseForKeyboard = (event: KeyboardEvent) => {
    // A player exploring the receipt with Tab controls when to leave it.
    if (event.key === 'Tab' && timer !== undefined) window.clearTimeout(timer);
  };
  element.addEventListener('cancel', cancel);
  element.addEventListener('keydown', pauseForKeyboard);
  element.showModal();
  timer = window.setTimeout(dismiss, 1800);
  return { dismiss, dispose };
}
