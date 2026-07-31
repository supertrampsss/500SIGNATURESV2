/**
 * Fiche territoire. Règle du produit (docs/04) : un chiffre ne s'affiche jamais
 * seul. Il porte son unité, son millésime, son dénominateur quand c'est un
 * ratio, et il est accompagné de sa source, de sa méthode et de ses limites.
 */

import type { Indicateur, Jeu, Territoire } from "./donnees";
import { formater } from "./echelle";

const NIVEAUX: Record<string, string> = {
  commune: "Commune",
  epci: "Intercommunalité",
  departement: "Département",
  region: "Région",
};

function echapper(texte: string): string {
  const noeud = document.createElement("span");
  noeud.textContent = texte;
  return noeud.innerHTML;
}

function evolution(serie: Record<string, number>, periode: string): string {
  const annees = Object.keys(serie).sort();
  const premiere = annees[0];
  if (!premiere || premiere === periode || serie[periode] === undefined) return "";
  const depart = serie[premiere];
  if (!depart) return "";
  const variation = ((serie[periode] - depart) / Math.abs(depart)) * 100;
  const signe = variation >= 0 ? "+" : "";
  return `<span class="evolution">${signe}${variation.toFixed(1)} % depuis ${premiere}</span>`;
}

function ligneIndicateur(
  indicateur: Indicateur,
  territoire: Territoire,
  periode: string,
  parHabitant: boolean,
): string {
  const serie = territoire.series[indicateur.id];
  const brut = serie?.[periode];
  if (brut === undefined) {
    return `<div class="mesure mesure--absente">
      <dt>${echapper(indicateur.libelle)}</dt>
      <dd>Donnée non disponible pour ${periode}</dd>
    </div>`;
  }
  const population = territoire.population;
  const ratio = parHabitant && indicateur.unite === "EUR";
  if (ratio && !population) {
    return `<div class="mesure mesure--absente">
      <dt>${echapper(indicateur.libelle)}</dt>
      <dd>Population inconnue : le montant par habitant n'est pas calculable</dd>
    </div>`;
  }
  const valeur = ratio ? brut / (population as number) : brut;
  const denominateur = ratio
    ? `<span class="denominateur">par habitant — population ${new Intl.NumberFormat(
        "fr-FR",
      ).format(population as number)} (référence OFGL ${periode})</span>`
    : "";
  return `<div class="mesure">
    <dt>${echapper(indicateur.libelle)}</dt>
    <dd>
      <strong>${formater(valeur, indicateur.unite, ratio)}</strong>
      <span class="millesime">${periode}</span>
      ${denominateur}
      ${evolution(serie, periode)}
    </dd>
  </div>`;
}

function panneauSource(indicateurs: Indicateur[], jeux: Jeu[]): string {
  const utilises = new Set(indicateurs.map((i) => i.jeu));
  const lignes = jeux
    .filter((jeu) => utilises.has(jeu.id))
    .map(
      (jeu) => `<li>
        <strong>${echapper(jeu.titre)}</strong><br />
        ${echapper(jeu.producteur)} — ${echapper(jeu.licence)}<br />
        Extraction du ${new Date(jeu.extraction).toLocaleDateString("fr-FR")} ·
        <a href="${echapper(jeu.url)}" rel="noreferrer">fichier source</a>
      </li>`,
    )
    .join("");
  return `<details class="panneau">
    <summary>D'où vient ce chiffre ?</summary>
    <ul class="sources">${lignes}</ul>
  </details>`;
}

function panneauMethode(indicateurs: Indicateur[]): string {
  const lignes = indicateurs
    .map(
      (i) => `<li>
        <strong>${echapper(i.libelle)}</strong> — ${echapper(i.definition)}
        <br /><span class="technique">${echapper(i.definition_technique)}</span>
        <br /><span class="formule">Calcul : ${echapper(i.formule)}</span>
      </li>`,
    )
    .join("");
  return `<details class="panneau">
    <summary>Méthodologie et limites</summary>
    <ul class="methodes">${lignes}</ul>
    <p class="avertissement">
      Ces montants sont ceux des comptes exécutés, budgets principaux et annexes
      consolidés. Un budget voté n'est pas une dépense réalisée. Les montants par
      habitant utilisent la population retenue par l'Observatoire des finances
      locales, afin que nos ratios reproduisent exactement les siens.
    </p>
  </details>`;
}

function panneauComparabilite(territoire: Territoire, niveau: string): string {
  const avertissements: string[] = [];
  const drapeaux = territoire.drapeaux ?? {};
  if ((drapeaux as Record<string, unknown>).type === "EPT") {
    avertissements.push(
      "Établissement public territorial : son périmètre est inclus dans celui de la Métropole du Grand Paris. Ne pas additionner les deux.",
    );
  }
  if ((drapeaux as Record<string, unknown>).statut_particulier) {
    avertissements.push(
      "Collectivité à statut particulier : elle exerce les compétences d'un département sans en être un au Code officiel géographique.",
    );
  }
  if (niveau === "commune") {
    avertissements.push(
      "Les communes nouvelles portent l'historique de leurs communes d'origine, additionné sous le code actuel.",
    );
  }
  avertissements.push(
    "Comparer deux territoires suppose la même année, la même unité et le même périmètre budgétaire.",
  );
  return `<details class="panneau">
    <summary>Comparabilité</summary>
    <ul>${avertissements.map((a) => `<li>${echapper(a)}</li>`).join("")}</ul>
  </details>`;
}

export function afficherFiche(
  cible: HTMLElement,
  options: {
    code: string;
    niveau: string;
    territoire: Territoire;
    indicateurs: Indicateur[];
    jeux: Jeu[];
    periode: string;
    parHabitant: boolean;
    comparaison?: string;
  },
): void {
  const { territoire, indicateurs, jeux, periode, parHabitant, niveau } = options;
  const mesures = indicateurs
    .map((indicateur) => ligneIndicateur(indicateur, territoire, periode, parHabitant))
    .join("");
  cible.innerHTML = `
    <h2 class="fiche__titre">${echapper(territoire.nom)}</h2>
    <p class="fiche__meta">${NIVEAUX[niveau] ?? niveau} · code ${echapper(options.code)}${
      territoire.population
        ? ` · ${new Intl.NumberFormat("fr-FR").format(territoire.population)} habitants`
        : ""
    }</p>
    <dl class="mesures">${mesures}</dl>
    ${options.comparaison ?? ""}
    ${panneauSource(indicateurs, jeux)}
    ${panneauMethode(indicateurs)}
    ${panneauComparabilite(territoire, niveau)}
  `;
}

/**
 * Position d'une commune parmi ses semblables. Le groupe est défini par des
 * critères publiés par l'OFGL, affichés avec le résultat : sans eux, « communes
 * comparables » ne veut rien dire. Aucun classement, aucun jugement — une
 * position dans une distribution, et le nombre de communes qui la composent.
 */
export function positionDansGroupe(
  territoire: Territoire,
  quartiles: { n: number; q1: number; mediane: number; q3: number } | undefined,
  valeurParHabitant: number | undefined,
  criteres: string[],
): string {
  if (!quartiles || valeurParHabitant === undefined) return "";
  const drapeaux = (territoire.drapeaux ?? {}) as Record<string, string>;
  const lisible: Record<string, string> = {
    tranche_population: "strate de population",
    rural: "caractère rural",
    outre_mer: "outre-mer",
  };
  const description = criteres
    .map((c) => `${lisible[c] ?? c} : ${drapeaux[c] ?? "non renseigné"}`)
    .join(" · ");
  const situation =
    valeurParHabitant < quartiles.q1
      ? "sous le quart inférieur"
      : valeurParHabitant > quartiles.q3
        ? "au-dessus du quart supérieur"
        : "dans la moitié centrale";
  return `<details class="panneau">
    <summary>Comparaison avec des communes semblables</summary>
    <p>Parmi <strong>${quartiles.n}</strong> communes du même groupe, cette commune se situe
      <strong>${situation}</strong> de la distribution.</p>
    <ul class="quartiles">
      <li><span>1<sup>er</sup> quartile</span><strong>${formater(quartiles.q1, "EUR", true)}</strong></li>
      <li><span>Médiane</span><strong>${formater(quartiles.mediane, "EUR", true)}</strong></li>
      <li><span>3<sup>e</sup> quartile</span><strong>${formater(quartiles.q3, "EUR", true)}</strong></li>
      <li><span>Cette commune</span><strong>${formater(valeurParHabitant, "EUR", true)}</strong></li>
    </ul>
    <p class="avertissement">Groupe constitué sur des critères publiés par l'Observatoire
      des finances locales — ${echapper(description)} — et non sur un découpage propre à ce
      site. Une position dans la distribution ne dit rien de la qualité de la gestion :
      les compétences exercées, la géographie et les choix politiques diffèrent d'une
      commune à l'autre.</p>
  </details>`;
}
