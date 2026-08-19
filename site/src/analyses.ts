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
 * **Tous les exercices publiés, un par colonne.** Une seule valeur par
 * indicateur ne s'analyse pas : on ne peut ni voir une inflexion, ni situer la
 * dernière année. Les jeux n'ont pas le même calendrier — le recensement est
 * triennal, les finances locales annuelles —, chaque thème porte donc ses
 * propres colonnes, et une cellule vide est un exercice que la source ne
 * publie pas.
 *
 * **Aucun indicateur inventé.** Un thème sans donnée pour ce territoire ne
 * s'affiche pas ; un indicateur sans valeur ne produit pas une ligne à zéro.
 * L'absence se lit dans le nombre d'indicateurs annoncé, pas dans des tirets.
 *
 * **Les montants en millions d'euros**, comme partout sur le site.
 */

import { credits, rendreCredits } from "./credits-missions.ts";
import type { Indicateur, Territoire } from "./donnees.ts";
import { millions } from "./echelle.ts";

export type Rubrique = {
  theme: string;
  libelle: string;
  /** Les exercices publiés dans ce thème, du plus ancien au plus récent : ce
   *  sont les colonnes du tableau. Un indicateur qui n'en a qu'un laisse les
   *  autres cellules vides plutôt que de faire disparaître la colonne pour
   *  tous les autres. */
  exercices: string[];
  lignes: {
    id: string;
    libelle: string;
    /** La valeur lisible par exercice. Absente d'un exercice : la cellule est
     *  vide, et l'absence se voit. */
    valeurs: Record<string, string>;
    /** Le même nombre, avant mise en forme, dans l'unité de la source. Il sert
     *  à ce qui compare deux séries entre elles — l'écart entre les crédits
     *  votés et les crédits consommés d'une mission (`credits-missions.ts`) —
     *  ce qu'une chaîne déjà formatée ne permet pas : relire un montant dans
     *  son affichage, c'est le perdre. */
    brut: Record<string, number>;
  }[];
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
    // Une décimale, toujours. Ce tableau met un exercice par colonne : une
    // série s'y lit de gauche à droite, et `Intl` la laissait tomber sur les
    // comptes ronds — le taux de foncier bâti d'Ayguemorte-les-Graves se
    // lisait « 40,8 % | 42 % | 43 % | 43 % ». Sur les seules communes de la
    // Gironde, 773 séries mêlent ainsi valeurs rondes et décimales.
    return `${new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(valeur)} %`;
  }
  const decimales = Number.isInteger(valeur) ? 0 : 1;
  const nombre = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valeur);
  // « 39,1 pour_1000_habitants » recopiait le code interne de l'unité : le
  // signe pour mille se lit sans qu'il faille connaître le vocabulaire de la
  // source. Le dénominateur des cambriolages (des logements, pas des
  // habitants) reste distingué, faute de quoi il se lirait comme les autres
  // taux du même tableau — celui de la Sécurité, où les deux se côtoient.
  if (unite === "pour_1000_habitants") return `${nombre} ‰`;
  if (unite === "pour_1000_logements") return `${nombre} ‰ (logements)`;
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
    const valeurs: Record<string, string> = {};
    const brut: Record<string, number> = {};
    for (const [periode, valeur] of Object.entries(serie)) {
      if (typeof valeur !== "number" || !Number.isFinite(valeur)) continue;
      valeurs[periode] = valeurLisible(valeur, indicateur.unite);
      brut[periode] = valeur;
    }
    const periodes = Object.keys(valeurs);
    if (!periodes.length) continue;
    const theme = indicateur.theme ?? "autres";
    if (!parTheme.has(theme)) {
      parTheme.set(theme, {
        theme,
        libelle: libelles[theme] ?? theme,
        exercices: [],
        lignes: [],
      });
    }
    const rubrique = parTheme.get(theme)!;
    rubrique.lignes.push({ id: indicateur.id, libelle: indicateur.libelle, valeurs, brut });
    for (const periode of periodes) {
      if (!rubrique.exercices.includes(periode)) rubrique.exercices.push(periode);
    }
  }
  const rang = (theme: string) => {
    const place = ordre.indexOf(theme);
    return place === -1 ? ordre.length : place;
  };
  for (const rubrique of parTheme.values()) rubrique.exercices.sort();
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
    .map((r) => {
      // Les crédits des missions de l'État sortent de la liste pour retrouver
      // les deux colonnes qu'ils avaient perdues — voir `credits-missions.ts`,
      // qui reconnaît ses lignes lui-même et rend celles qu'il a prises. Ce
      // qu'il n'a pas pris reste ici, colonnes recalculées sur les seules
      // lignes restantes : un exercice qui n'existait que par les missions ne
      // doit pas laisser une colonne vide derrière lui.
      const missions = credits(r.lignes);
      const restantes = missions.retenus.size
        ? r.lignes.filter((l) => !missions.retenus.has(l.id))
        : r.lignes;
      const exercices = missions.retenus.size
        ? [...new Set(restantes.flatMap((l) => Object.keys(l.valeurs)))].sort()
        : r.exercices;
      const tableau = restantes.length
        ? `<div class="analyses__defilement" tabindex="0">
        <table class="analyses__table">
          <thead><tr><th scope="col">Indicateur</th>${exercices
            .map((e) => `<th scope="col">${echapper(e)}</th>`)
            .join("")}</tr></thead>
          <tbody>${restantes
            .map(
              (l) => `<tr><th scope="row">${echapper(l.libelle)}</th>${exercices
                .map(
                  (e) =>
                    `<td class="analyses__valeur">${
                      l.valeurs[e] === undefined ? "" : echapper(l.valeurs[e])
                    }</td>`,
                )
                .join("")}</tr>`,
            )
            .join("")}</tbody>
        </table>
        </div>`
        : "";
      return `<section class="analyses__theme" id="analyses-${echapper(r.theme)}">
        <h3>${echapper(r.libelle)}</h3>
        ${tableau}
        ${rendreCredits(missions)}
      </section>`;
    })
    .join("");
  return `<div class="analyses">
    <h2 class="analyses__titre">${echapper(nom)}</h2>
    <p class="analyses__compte">${compte} indicateurs renseignés, ${liste.length} thèmes.
      Un exercice par colonne : les jeux n'ont pas tous le même calendrier, et une cellule
      vide est un exercice que la source ne publie pas. Montants en millions d'euros (M€) :
      1 000 M€ font un milliard.</p>
    <nav class="analyses__sommaire" aria-label="Thèmes">${sommaire}</nav>
    ${sections}
  </div>`;
}

export function afficherAnalyses(cible: HTMLElement, nom: string, liste: Rubrique[]): void {
  cible.innerHTML = rendu(nom, liste);
}
