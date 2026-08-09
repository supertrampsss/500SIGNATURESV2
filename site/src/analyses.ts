/**
 * La page ANALYSES : tout ce que le site sait d'un territoire, en une page.
 *
 * La fiche de la carte répond à « comment va ma commune ? » en quinze lignes.
 * Elle ne peut pas porter les deux cents indicateurs sans devenir illisible, et
 * elle ne doit pas : un panneau qu'on déroule pendant trente secondes n'est plus
 * un panneau. Le lien « voir le détail complet » mène donc ici, où la contrainte
 * s'inverse — l'exhaustivité prime, thème par thème.
 *
 * Trois règles tenues d'un bout à l'autre.
 *
 * **Le dernier exercice de chaque indicateur, et son année écrite à côté.** Les
 * jeux n'ont pas le même calendrier : le recensement est triennal, les finances
 * locales annuelles. Afficher 2023 et 2025 côte à côte sans le dire laisserait
 * croire à une même photographie.
 *
 * **Aucun indicateur inventé.** Un thème sans donnée pour ce territoire ne
 * s'affiche pas ; un indicateur sans valeur ne produit pas une ligne à zéro.
 * L'absence se lit dans le nombre d'indicateurs annoncé, pas dans des tirets.
 *
 * **Les montants en millions d'euros.** Le par-habitant reste à la fiche, où il
 * sert à comparer ; ici on montre ce que le territoire pèse.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { millions } from "./echelle.ts";

export type Rubrique = {
  theme: string;
  libelle: string;
  lignes: { id: string; libelle: string; valeur: string; periode: string }[];
};

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Le nombre tel qu'il se lit dans son unité. Les euros passent en millions. */
export function valeurLisible(valeur: number, unite: string): string {
  if (unite === "EUR") return millions(valeur);
  if (unite === "percent") {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(valeur)} %`;
  }
  const decimales = Number.isInteger(valeur) ? 0 : 1;
  const nombre = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valeur);
  return unite && unite !== "count" ? `${nombre} ${unite}` : nombre;
}

/**
 * Ce que le site sait de ce territoire, rangé par thème.
 *
 * Rendu pur : c'est lui qui est testé. `libelles` donne le nom lisible d'un
 * thème ; un thème sans libellé garde son identifiant plutôt que de disparaître.
 */
export function rubriques(
  territoire: Territoire,
  catalogue: Indicateur[],
  libelles: Record<string, string>,
  ordre: string[] = [],
): Rubrique[] {
  const parTheme = new Map<string, Rubrique>();
  for (const indicateur of catalogue) {
    const serie = territoire.series[indicateur.id];
    if (!serie) continue;
    const periodes = Object.keys(serie).sort();
    const periode = periodes[periodes.length - 1];
    if (periode === undefined) continue;
    const valeur = serie[periode];
    if (valeur === undefined || !Number.isFinite(valeur)) continue;
    const theme = indicateur.theme ?? "autres";
    if (!parTheme.has(theme)) {
      parTheme.set(theme, { theme, libelle: libelles[theme] ?? theme, lignes: [] });
    }
    parTheme.get(theme)!.lignes.push({
      id: indicateur.id,
      libelle: indicateur.libelle,
      valeur: valeurLisible(valeur, indicateur.unite),
      periode,
    });
  }
  const rang = (theme: string) => {
    const place = ordre.indexOf(theme);
    return place === -1 ? ordre.length : place;
  };
  return [...parTheme.values()]
    .filter((r) => r.lignes.length)
    .sort((a, b) => rang(a.theme) - rang(b.theme) || a.libelle.localeCompare(b.libelle, "fr"));
}

/** Le nombre total d'indicateurs renseignés, pour l'annoncer sans le compter à la main. */
export function total(liste: Rubrique[]): number {
  return liste.reduce((somme, r) => somme + r.lignes.length, 0);
}

export function rendu(nom: string, liste: Rubrique[]): string {
  if (!liste.length) {
    return `<p class="analyses__vide">Aucune donnée publiée pour ${echapper(nom)}.</p>`;
  }
  const compte = total(liste);
  const sommaire = liste
    .map(
      (r) =>
        `<a href="#analyses-${echapper(r.theme)}">${echapper(r.libelle)} <span>${
          r.lignes.length
        }</span></a>`,
    )
    .join("");
  const sections = liste
    .map(
      (r) => `<section class="analyses__theme" id="analyses-${echapper(r.theme)}">
        <h3>${echapper(r.libelle)}</h3>
        <table class="analyses__table">
          <thead><tr><th scope="col">Indicateur</th><th scope="col">Dernière valeur</th>
            <th scope="col">Exercice</th></tr></thead>
          <tbody>${r.lignes
            .map(
              (l) => `<tr><th scope="row">${echapper(l.libelle)}</th>
                <td class="analyses__valeur">${echapper(l.valeur)}</td>
                <td class="analyses__periode">${echapper(l.periode)}</td></tr>`,
            )
            .join("")}</tbody>
        </table>
      </section>`,
    )
    .join("");
  return `<div class="analyses">
    <h2 class="analyses__titre">${echapper(nom)}</h2>
    <p class="analyses__compte">${compte} indicateurs renseignés, ${liste.length} thèmes.
      Chaque valeur est le dernier exercice publié de son indicateur : les jeux n'ont pas
      tous le même calendrier, et l'année est écrite à côté de chaque chiffre.</p>
    <nav class="analyses__sommaire" aria-label="Thèmes">${sommaire}</nav>
    ${sections}
  </div>`;
}

export function afficherAnalyses(cible: HTMLElement, nom: string, liste: Rubrique[]): void {
  cible.innerHTML = rendu(nom, liste);
}
