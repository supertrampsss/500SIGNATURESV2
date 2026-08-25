import type { Territoire } from "./donnees.ts";
import { formater } from "./echelle.ts";

export type ChiffreBriefing = {
  id: string;
  libelle: string;
  valeur: string;
  comparaison?: string;
};

export type BriefingTerritorial = {
  diagnostic: string;
  chiffres: ChiffreBriefing[];
  groupe: string;
};

type BriefingAvecExercice = BriefingTerritorial & { exercice: string };

export type EntreeBriefing = {
  territoire: Territoire;
  exercice: string;
  chiffres: readonly {
    id: string;
    libelle: string;
    unite: string;
    valeur: number;
    comparaison?: string;
  }[];
  diagnostic: string;
  groupe: string;
};

const PRIORITES = [
  "ofgl_recettes_fonctionnement",
  "ofgl_depenses_fonctionnement",
  "ofgl_encours_dette",
  "ofgl_epargne_brute",
];

function phrase(texte: string): string {
  const nettoye = texte.trim();
  return /[.!?…]$/u.test(nettoye) ? nettoye : `${nettoye}.`;
}

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (caractere) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        caractere
      ] as string,
  );
}

export function briefingTerritorial(entree: EntreeBriefing): BriefingTerritorial {
  const chiffres = PRIORITES.flatMap((id) => {
    const chiffre = entree.chiffres.find((candidat) => candidat.id === id);
    if (!chiffre || !Number.isFinite(chiffre.valeur)) return [];
    return [{
      id: chiffre.id,
      libelle: chiffre.libelle,
      valeur: formater(chiffre.valeur, chiffre.unite, false, chiffre.id),
      ...(chiffre.comparaison === undefined ? {} : { comparaison: chiffre.comparaison }),
    }];
  });
  const briefing: BriefingAvecExercice = {
    diagnostic: phrase(entree.diagnostic),
    chiffres,
    groupe: entree.groupe,
    exercice: entree.exercice,
  };
  return briefing;
}

export function renduBriefing(briefing: BriefingTerritorial, territoire: Territoire): string {
  const nom = encodeURIComponent(territoire.nom);
  const chiffres = briefing.chiffres
    .map(
      (chiffre) => `<div>
        <dt>${echapper(chiffre.libelle)}</dt>
        <dd>${echapper(chiffre.valeur)}${
          chiffre.comparaison === undefined ? "" : ` <span>${echapper(chiffre.comparaison)}</span>`
        }</dd>
      </div>`,
    )
    .join("");
  return `<section class="briefing-territorial">
    <header>
      <h2>Briefing de ${echapper(territoire.nom)}</h2>
      <p>${echapper(briefing.diagnostic)}</p>
      <p>Communes comparables : ${echapper(briefing.groupe)}</p>
    </header>
    <dl>${chiffres}</dl>
    <p>Exercice ${echapper((briefing as Partial<BriefingAvecExercice>).exercice ?? "")}</p>
    <p class="briefing-territorial__actions">
      <a href="/comparateur?territoire=${nom}">Comparer</a>
      <a href="/simulateur?territoire=${nom}">Simuler ce territoire</a>
    </p>
  </section>`;
}
