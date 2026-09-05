import { choicesFor, decide, DOMAINS, replay, score, start } from "./engine.ts";
import { escape as e } from "./sharing.ts";
import type { Game } from "./types.ts";

/** A sandbox owns its journal. It cannot mutate or persist the active mandate. */
export function projectPlan(reference: Game, ids: string[]) {
  let game = start(reference.mode, reference.seed, reference.ambition, reference.version);
  const states: Game[] = [game];
  let error: string | null = null;
  if (ids.length > DOMAINS[reference.mode].turns) throw new Error("Plan trop long.");
  for (const id of ids) {
    if (!id) break;
    try { game = decide(game, id); states.push(game); }
    catch (err) { error = err instanceof Error ? err.message : "Choix impossible."; break; }
  }
  const commonYear = Math.min(reference.turn, game.turn);
  const actual = replay(reference.mode, reference.seed, reference.choices.slice(0, commonYear), reference.version, reference.ambition);
  return { game, states, error, commonYear, actual, alternative: states[commonYear] };
}
const number = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
export function planner(reference: Game, ids: string[]) {
  const p = projectPlan(reference, ids), d = DOMAINS[reference.mode];
  const fields = d.dossiers.map((dossier, i) => {
    const before = p.states[i];
    const choices = before ? choicesFor(before) : dossier.choices;
    return `<label class="plan-field"><span>Année ${i + 1} · ${e(dossier.category)}</span><select data-plan-year="${i}" ${!before ? "disabled" : ""}><option value="">Choisir un arbitrage</option>${choices.map(c => `<option value="${e(c.id)}" ${ids[i] === c.id ? "selected" : ""}>${e(c.title)}</option>`).join("")}</select></label>`;
  }).join("");
  const comparison = ([['Dette', p.actual.finance.debt, p.alternative.finance.debt, d.unit], ['Services', p.actual.metrics.services, p.alternative.metrics.services, '/100'], ['Confiance', p.actual.metrics.trust, p.alternative.metrics.trust, '/100'], ['Patrimoine', p.actual.metrics.assets, p.alternative.metrics.assets, '/100'], ['Résilience', p.actual.metrics.resilience, p.alternative.metrics.resilience, '/100']] as const).map(([label, a, b, unit]) => `<div><dt>${label}</dt><dd><span>Votre mandat <strong>${number(a)} ${unit}</strong></span><span>Alternative <strong>${number(b)} ${unit}</strong></span><small>Écart : ${b - a > 0 ? '+' : ''}${number(b - a)} ${unit}</small></dd></div>`).join('');
  return `<article class="planner"><p class="eyebrow">ATELIER DE STRATÉGIE · MODÈLE V${reference.version}</p><h1 tabindex="-1">Et si vous aviez choisi autrement ?</h1><p>Explorez le même scénario avec la même priorité. Votre partie sauvegardée reste intacte. Chaque effet suit exactement les règles du jeu.</p><div class="planner-layout"><section><h2>Votre plan alternatif</h2><div class="plan-fields">${fields}</div><button class="button" data-action="plan-reset">Repartir de mon mandat</button>${p.error ? `<p class="choice-error" role="alert">Année ${p.game.turn + 1} : ${e(p.error)} Choisissez un autre arbitrage.</p>` : ''}</section><section><h2>Comparer à horizon identique</h2><p>Fin de l’année ${p.commonYear}. ${p.game.turn !== reference.turn ? `L’alternative atteint l’année ${p.game.turn}, votre mandat l’année ${reference.turn}. La comparaison s’arrête à leur dernière année commune.` : 'Même période, mêmes événements, mêmes pondérations.'}</p><dl class="plan-comparison">${comparison}</dl>${p.game.turn === d.turns ? `<p class="plan-score">Bilan du plan complet <strong>${score(p.game).total}/100</strong></p>` : `<p>Planifié : ${p.game.turn}/${d.turns} années. Complétez le plan pour voir son héritage.</p>`}<h3>Livraisons et comptes du plan</h3><ol class="plan-years">${p.game.history.map(t => `<li><strong>Année ${t.year} : ${e(t.title)}</strong><span>Dette ${number(t.ledger.debt)} ${d.unit} · investissement ${number(t.ledger.investment)} ${d.unit}</span><small>${e(t.event)}</small></li>`).join('') || '<li>Aucun arbitrage planifié.</li>'}</ol><p class="scope">Résultats simulés, pas des prévisions. Cet atelier ne donne aucune recommandation de politique publique.</p></section></div></article>`;
}
