import { movementPhase, SOCIAL_ACTORS } from "./social-engine.ts";
import { escape } from "./sharing.ts";
import type { Game } from "./types.ts";

export function renderSocialHistory(game: Game): string {
  const movements = game.social?.movements ?? [];
  if (!movements.length) return "";
  const budget = game.social!.budget;
  const costs = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  return `<section class="social-history" data-social-history aria-labelledby="social-history-title"><p class="eyebrow">LE PAYS RÉAGIT</p><h2 id="social-history-title">Mobilisations sociales</h2>
    <p>Collectifs fictifs, effets calculés à partir de vos décisions.</p>
    <ul>${movements.map((item) => `<li data-movement-status="${item.status}"><div class="social-history__heading"><strong>${escape(SOCIAL_ACTORS[item.actor].label)}</strong><span>${escape(movementPhase(item))}</span></div><h3>${escape(item.demand)}</h3><p>${escape(item.lastDetail)}</p><p class="social-history__cause">Décision ${item.causeTurn + 1} · ${escape(item.sourceTitle)}</p>${item.commitment ? `<p>${item.commitment.status === "kept" ? "Engagement tenu" : item.commitment.status === "broken" ? "Engagement non tenu" : `Mise en œuvre attendue à la décision ${item.commitment.dueTurn}`} · ${costs.format(item.commitment.operating)} Md€/an de crédits votés.</p>` : ""}<button type="button" class="text-button" data-action="branch-replay" data-turn="${item.causeTurn}">Rejouer avant cette mobilisation</button></li>`).join("")}</ul>
    <p class="social-history__costs">Perturbations dans le plan de l’année ${budget.year} : ${costs.format(budget.operating)} Md€ de charges, ${costs.format(Math.abs(budget.revenue))} Md€ de recettes en moins. Ce plan inclut les coûts déjà subis et les perturbations prévues pour les décisions restantes. Hypothèses de simulation ; les montants restent distincts des crédits de concession.</p>
  </section>`;
}
