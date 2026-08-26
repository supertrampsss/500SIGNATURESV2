import type { Indicateur } from "./donnees.ts";
import { formater } from "./echelle.ts";
import type { Insight } from "./insights.ts";
import { echapper } from "./texte.ts";

type OptionsRendu = {
  contexte: "france" | "territoire";
  nom?: string;
};

function valeurPreuve(
  indicateur: string,
  valeur: number,
  catalogue: Indicateur[],
): string {
  const unite = catalogue.find((fiche) => fiche.id === indicateur)?.unite;
  return formater(valeur, unite ?? "number", false);
}

function carte(insight: Insight, catalogue: Indicateur[]): string {
  const preuves = insight.preuves
    .map((preuve) => `<div>
      <dt>${echapper(preuve.libelle)} · ${echapper(preuve.periode)}</dt>
      <dd>${echapper(valeurPreuve(preuve.indicateur, preuve.valeur, catalogue))}</dd>
    </div>`)
    .join("");

  return `<li class="insight insight--${insight.famille}">
    <article>
      <p class="insight__surtitre">${echapper(insight.surtitre)}</p>
      <h3>${echapper(insight.titre)}</h3>
      <p class="insight__analyse">${echapper(insight.texte)}</p>
      <p class="insight__reserve"><span>À garder en tête</span> ${echapper(insight.reserve)}</p>
      <details class="insight__preuves">
        <summary>Vérifier les chiffres</summary>
        <dl>${preuves}</dl>
      </details>
    </article>
  </li>`;
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
    ? "Six faits pour déplacer le débat : ce que l'impôt ne rapporte pas, ce que le vote ne dépense pas toujours, et ce que les moyennes nationales dissimulent."
    : "Fiscalité, emploi, logement, sécurité, énergie : les séries sont croisées pour faire apparaître une trajectoire, pas seulement une valeur isolée.";

  return `<section class="insights insights--${options.contexte}" aria-labelledby="insights-${options.contexte}-titre">
    <header class="insights__entete">
      ${estFrance ? '<p class="insights__chapitre">Chapitre 04</p>' : '<p class="insights__chapitre">L’analyse</p>'}
      <h2 id="insights-${options.contexte}-titre">${echapper(titre)}</h2>
      <p>${echapper(introduction)}</p>
    </header>
    <ol class="insights__grille">
      ${insights.map((insight) => carte(insight, catalogue)).join("")}
    </ol>
    <p class="insights__methode"><a href="/sources/">Sources et méthode</a> · Les limites propres à chaque lecture restent affichées.</p>
  </section>`;
}
