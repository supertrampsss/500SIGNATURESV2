import type { Indicateur } from "./donnees.ts";
import type { FamilleInsight, Insight } from "./insights.ts";
import { echapper } from "./texte.ts";

type OptionsRendu = {
  contexte: "france" | "territoire";
  nom?: string;
};

function carte(insight: Insight, niveauTitre: 3 | 4 = 3): string {
  return `<li class="insight insight--${insight.famille}">
    <article>
      <p class="insight__surtitre">${echapper(insight.surtitre)}</p>
      <h${niveauTitre}>${echapper(insight.titre)}</h${niveauTitre}>
      <p class="insight__analyse">${echapper(insight.texte)}</p>
      ${insight.comparaison ? `<p class="insight__comparaison">${echapper(insight.comparaison)}</p>` : ""}
    </article>
  </li>`;
}

/** Garde une première lecture courte sans retirer les cartes du document.
 * Les cartes suivantes restent dans le DOM : elles sont simplement repliées
 * derrière une action locale, ce qui conserve les ancres et l'accessibilité. */
function cartesAvecSuite(cartes: Insight[], niveauTitre: 3 | 4): string {
  const visibles = cartes.slice(0, 3).map((insight) => carte(insight, niveauTitre)).join("");
  const suite = cartes.slice(3);
  if (suite.length === 0) return `<ol class="insights__grille">${visibles}</ol>`;
  return `<ol class="insights__grille">${visibles}</ol>
    <details class="insights__more">
      <summary>Voir les autres</summary>
      <ol class="insights__grille">${suite.map((insight) => carte(insight, niveauTitre)).join("")}</ol>
    </details>`;
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

function renduFranceParThemes(insights: Insight[]): string {
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
      ${cartesAvecSuite(cartes, 4)}
    </section>`).join("");

  return `<nav class="insights__sommaire" id="insights-france-sommaire" aria-label="Thèmes des arbitrages">
    <ul>${sommaire}</ul>
  </nav>
  <div class="insights__themes">${chapitres}</div>`;
}

export function renduInsights(
  insights: Insight[],
  _catalogue: Indicateur[],
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
      ${estFrance ? '<p class="insights__chapitre">Chapitre 04</p>' : '<p class="insights__chapitre">L’analyse</p>'}
      <h2 id="insights-${options.contexte}-titre">${echapper(titre)}</h2>
      <p>${echapper(introduction)}</p>
    </header>
    ${estFrance
      ? renduFranceParThemes(insights)
      : cartesAvecSuite(insights, 3)}
    <p class="insights__methode"><a href="/sources/">Sources et méthode</a></p>
  </section>`;
}
