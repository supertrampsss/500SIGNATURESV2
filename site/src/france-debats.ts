import type { Insight } from "./insights.ts";
import { SOURCES_ARBITRAGES } from "./insights-sources.ts";
import { echapper } from "./texte.ts";

/** Une question visible mène à une analyse déjà publiée dans les thèmes. */
const QUESTIONS = [
  {
    question: "Les hauts revenus contribuent-ils assez ?",
    sujet: "Fiscalité",
    conflit: "Taxer davantage les plus hauts revenus ou élargir l’effort à davantage de contribuables : qui doit payer le redressement ?",
    preuves: ["tres-hauts-revenus", "ir-foyers-imposes"],
  },
  {
    question: "Faut-il demander davantage aux retraités pour soulager les actifs ?",
    sujet: "Générations",
    conflit: "Préserver les pensions ou limiter les prélèvements sur le travail : la protection d’une génération peut déplacer l’effort sur une autre.",
    preuves: ["pauvrete-actifs-retraites", "majoration-trois-enfants"],
  },
  {
    question: "Réduire les aides, augmenter les impôts ou laisser la dette grossir ?",
    sujet: "Dette",
    conflit: "Réduire les dépenses touche leurs bénéficiaires. Augmenter les recettes touche les contribuables. Reporter l’effort laisse davantage d’intérêts à financer.",
    preuves: ["projection-charge-dette"],
  },
  {
    question: "Faut-il réduire la redistribution pour baisser les prélèvements ?",
    sujet: "Services publics",
    conflit: "Baisser les prélèvements laisse davantage de revenu avant redistribution. Réduire les aides et les services change ensuite ce que chacun reçoit.",
    preuves: ["redistribution-ocde"],
  },
] as const;

export function questionsFrance(insights: Insight[]): string {
  const parId = new Map(insights.map((insight) => [insight.id, insight]));
  const sources = new Map(SOURCES_ARBITRAGES.map((source) => [source.id, source]));
  const questions = QUESTIONS.map(({ question, sujet, preuves, conflit }) => {
    const analyses = preuves.map((id) => parId.get(id)).filter((insight): insight is Insight => !!insight);
    if (!analyses.length) return "";
    const principale = analyses[0];
    return `<article class="fr-debate">
      <p class="fr-debate__theme">${echapper(sujet)}</p>
      <h3>${echapper(question)}</h3>
      <p>${echapper(conflit)}</p>
      <ul>${analyses.map(({ titre, sourceIds }) => {
        const source = sourceIds?.map((id) => sources.get(id)).find(Boolean);
        return `<li>${echapper(titre)}${source ? `<a class="fr-debate__source" href="${echapper(source.url)}" target="_blank" rel="noopener noreferrer">${echapper(source.institution)} · ${echapper(source.millesime)}</a>` : ""}</li>`;
      }).join("")}</ul>
      <div class="fr-debate__suite"><a href="#insight-${echapper(principale.id)}">Lire les chiffres</a></div>
    </article>`;
  }).filter(Boolean);
  if (!questions.length) return "";
  return `<section id="france-debats" class="fr-panel fr-debats" aria-labelledby="france-debats-titre">
    <header><p class="fr-eyebrow">LE DÉBAT PUBLIC</p><h2 id="france-debats-titre">Les questions qui divisent.</h2><p>Des questions franches. Les chiffres pour en débattre.</p></header>
    <div class="fr-debats__grille">${questions.join("")}</div>
  </section>`;
}
