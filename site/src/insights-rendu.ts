import { insightChart } from "./insight-chart.ts";
import type { Indicateur, Territoire } from "./donnees.ts";
import type { FamilleInsight, Insight } from "./insights.ts";
import { echapper } from "./texte.ts";

type OptionsRendu = {
  contexte: "france" | "territoire";
  nom?: string;
  series?: Territoire["series"];
};

function carte(insight: Insight, niveauTitre: 3 | 4 = 3, catalogue: Indicateur[] = [], series: Territoire["series"] = {}): string {
  const chart = insightChart(insight,catalogue,series);
  return `<li class="insight insight--${insight.famille}">
    <article${chart ? ' data-expand-card' : ""}>
      <p class="insight__surtitre">${echapper(insight.surtitre)}</p>
      <h${niveauTitre}>${chart ? `<button type="button" data-expand-analysis aria-label="Agrandir : ${echapper(insight.titre)}">${echapper(insight.titre)}</button>` : echapper(insight.titre)}</h${niveauTitre}>
      <p class="insight__analyse">${echapper(insight.texte)}</p>
      ${chart}
      ${insight.comparaison ? `<p class="insight__comparaison">${echapper(insight.comparaison)}</p>` : ""}
    </article>
  </li>`;
}

/** Toutes les analyses restent visibles. */
function cartesAvecSuite(cartes: Insight[], niveauTitre: 3 | 4, catalogue: Indicateur[], series?: Territoire["series"]): string {
  return `<ol class="insights__grille">${cartes.map(insight => carte(insight,niveauTitre,catalogue,series)).join("")}</ol>`;
}

const THEMES_FRANCE: Array<{ famille: FamilleInsight; titre: string }> = [
  { famille: "budget", titre: "Dette et budget" },
  { famille: "fiscalite", titre: "Fiscalité" },
  { famille: "travail", titre: "Travail et entreprises" },
  { famille: "generation", titre: "Retraites et générations" },
  { famille: "services", titre: "Niveau de vie et services publics" },
  { famille: "logement", titre: "Logement" },
  { famille: "securite", titre: "Sécurité et justice" },
  { famille: "environnement", titre: "Énergie et environnement" },
];

function renduFranceParThemes(insights: Insight[], catalogue: Indicateur[], series?: Territoire["series"]): string {
  const themes = THEMES_FRANCE
    .map((theme) => ({ ...theme, insights: insights.filter(({ famille }) => famille === theme.famille) }))
    .filter(({ insights: cartes }) => cartes.length > 0);

  const sommaire = themes.map(({ famille, titre }) => `<li>
      <a href="#arbitrages-${famille}">
        <span>${echapper(titre)}</span>
      </a>
    </li>`).join("");

  const chapitres = themes.map(({ famille, titre, insights: cartes }) => `<section
      class="insights__theme insights__theme--${famille}"
      id="arbitrages-${famille}"
      aria-labelledby="arbitrages-${famille}-titre"
    >
      <header class="insights__theme-entete">
        <h3 id="arbitrages-${famille}-titre">${echapper(titre)}</h3>
      </header>
      ${cartesAvecSuite(cartes, 4, catalogue, series)}
    </section>`).join("");

  return `<nav class="insights__sommaire" id="insights-france-sommaire" aria-label="Thèmes des arbitrages">
    <ul>${sommaire}</ul>
  </nav>
  <div class="insights__themes">${chapitres}</div>`;
}

export function renduInsights(
  insights: Insight[],
  catalogue: Indicateur[],
  options: OptionsRendu,
): string {
  if (insights.length === 0) return "";
  const estFrance = options.contexte === "france";
  const titre = estFrance
    ? "Les arbitrages derrière les comptes"
    : `Ce que racontent les chiffres de ${options.nom ?? "ce territoire"}`;
  const introduction = estFrance
    ? "Les chiffres qui font débat."
    : "Quelques repères pour situer ce territoire.";

  return `<section class="insights insights--${options.contexte}" aria-labelledby="insights-${options.contexte}-titre">
    <header class="insights__entete">
      ${estFrance ? '' : '<p class="insights__chapitre">L’analyse</p>'}
      <h2 id="insights-${options.contexte}-titre">${echapper(titre)}</h2>
      <p>${echapper(introduction)}</p>
    </header>
    ${estFrance
      ? renduFranceParThemes(insights, catalogue, options.series)
      : cartesAvecSuite(insights, 3, catalogue, options.series)}
    <p class="insights__methode"><a href="/sources/">Sources et méthode</a></p>
  </section>`;
}
