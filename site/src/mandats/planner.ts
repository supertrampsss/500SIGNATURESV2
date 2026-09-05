import { choicesFor, decide, domainFor, calendarFor, startingGame, replayGame, score } from "./engine.ts";
import { escape as e } from "./sharing.ts";
import type { Game } from "./types.ts";

/** A sandbox owns its journal. It cannot mutate or persist the active mandate. */
export function projectPlan(reference: Game, ids: string[]) {
  let game = startingGame(reference);
  const states: Game[] = [game];
  let error: string | null = null;
  if (ids.length > domainFor(reference).turns) throw new Error("Plan trop long.");
  for (const id of ids) {
    if (!id) break;
    try { game = decide(game, id); states.push(game); }
    catch (err) { error = err instanceof Error ? err.message : "Choix impossible."; break; }
  }
  const commonYear = Math.min(reference.turn, game.turn);
  const actual = replayGame(reference, reference.choices.slice(0, commonYear));
  return { game, states, error, commonYear, actual, alternative: states[commonYear] };
}
const number = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
export function planner(reference: Game, ids: string[]) {
  const p = projectPlan(reference, ids), d = domainFor(reference);
  const fieldList = d.dossiers.map((dossier, i) => {
    const before = p.states[i];
    const choices = before ? choicesFor(before) : dossier.choices;
    return `<label class="plan-field"><span>Dossier ${i + 1} · ${e(dossier.category)}</span><select data-plan-year="${i}" ${!before ? "disabled" : ""}><option value="">Choisir un arbitrage</option>${choices.map(c => `<option value="${e(c.id)}" ${ids[i] === c.id ? "selected" : ""}>${e(c.title)}</option>`).join("")}</select></label>`;
  });
  const years = calendarFor(reference).years;
  const boundaries = reference.version >= 3 ? (reference.mode === "municipal" ? [0,8,16,24,31,38,45] : [0,9,18,27,36,45]) : Array.from({length:years+1},(_,i)=>i);
  const fields = Array.from({length:years},(_,i)=>`<details class="plan-year" ${p.game.turn >= boundaries[i] && p.game.turn < boundaries[i+1] || i === years-1 && p.game.turn === d.turns ? 'open' : ''}><summary>Année ${i+1}<span>${boundaries[i+1]-boundaries[i]} dossiers</span></summary>${fieldList.slice(boundaries[i],boundaries[i+1]).join('')}</details>`).join('');
  const comparison = ([['Dette', p.actual.finance.debt, p.alternative.finance.debt, d.unit], ['Services', p.actual.metrics.services, p.alternative.metrics.services, '/100'], ['Confiance', p.actual.metrics.trust, p.alternative.metrics.trust, '/100'], ['Patrimoine', p.actual.metrics.assets, p.alternative.metrics.assets, '/100'], ['Résilience', p.actual.metrics.resilience, p.alternative.metrics.resilience, '/100']] as const).map(([label, a, b, unit]) => `<div><dt>${label}</dt><dd><span>Votre mandat <strong>${number(a)} ${unit}</strong></span><span>Alternative <strong>${number(b)} ${unit}</strong></span><small>Écart : ${b - a > 0 ? '+' : ''}${number(b - a)} ${unit}</small></dd></div>`).join('');
  return `<article class="planner"><p class="eyebrow">ATELIER DE STRATÉGIE · MODÈLE V${reference.version}</p><h1 tabindex="-1">Et si vous aviez choisi autrement ?</h1><p>Explorez le même scénario avec la même priorité. Votre partie sauvegardée reste intacte. Chaque effet suit exactement les règles du jeu.</p><div class="planner-layout"><section><h2>Votre plan alternatif</h2><div class="plan-fields">${fields}</div><button class="button" data-action="plan-reset">Repartir de mon mandat</button>${p.error ? `<p class="choice-error" role="alert">Dossier ${p.game.turn + 1} : ${e(p.error)} Choisissez un autre arbitrage.</p>` : ''}</section><section><h2>Comparer à horizon identique</h2><p>Après ${p.commonYear} décisions. ${p.game.turn !== reference.turn ? `L’alternative compte ${p.game.turn} décisions, votre mandat ${reference.turn}. La comparaison s’arrête à leur dernier dossier commun.` : 'Même période, mêmes événements, mêmes pondérations.'}</p><dl class="plan-comparison">${comparison}</dl>${p.game.turn === d.turns ? `<p class="plan-score">Bilan du plan complet <strong>${score(p.game).total}/100</strong></p>` : `<p>Planifié : ${p.game.turn}/${d.turns} décisions. Complétez le plan pour voir son héritage.</p>`}<h3>Livraisons et comptes du plan</h3><ol class="plan-years">${p.game.history.map(t => `<li><strong>Année ${t.year} : ${e(t.title)}</strong><span>${reference.version >= 3 && !t.closed ? "Prévision" : "Clôture"} · dette ${number(t.ledger.debt)} ${d.unit} · investissement ${number(t.ledger.investment)} ${d.unit}</span><small>${e(t.event)}</small></li>`).join('') || '<li>Aucun arbitrage planifié.</li>'}</ol><p class="scope">Résultats simulés, pas des prévisions. Cet atelier ne donne aucune recommandation de politique publique.</p></section></div></article>`;
}
