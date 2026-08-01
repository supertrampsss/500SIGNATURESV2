/**
 * Séries dans le temps, sur la fiche d'un territoire.
 *
 * « Comment ça évolue chez moi ? » vient juste après « combien ». La série est
 * déjà publiée avec la fiche : la dessiner ne coûte rien de plus au serveur.
 *
 * Ce qui coûte, c'est de la dessiner honnêtement. **Une série est une
 * comparaison d'un territoire avec lui-même**, et la règle du périmètre s'y
 * applique comme entre deux territoires : une commune née d'une fusion en 2019
 * n'a pas la même surface avant et après, et « +18 % depuis 2016 » y compare
 * deux choses différentes. Les changements de périmètre sont donc marqués sur
 * le graphique, et l'évolution chiffrée n'est calculée que sur la partie de la
 * série qui porte sur le même territoire.
 *
 * Pas de bibliothèque : un SVG écrit à la main pèse quelques centaines
 * d'octets, se lit par un lecteur d'écran via son équivalent textuel, et ne
 * dépend de rien.
 */

export type Evenement = { type: string; date: string; avec: string };

const LARGEUR = 260;
const HAUTEUR = 56;

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** L'année où la série redevient comparable, ou null si elle l'est de bout en bout. */
export function ruptureDePerimetre(evenements: Evenement[], periodes: string[]): string | null {
  if (!evenements.length || periodes.length < 2) return null;
  const premiere = periodes[0];
  const derniere = periodes[periodes.length - 1];
  // Un événement daté du 1er janvier 2019 sépare l'exercice 2018 de 2019 : la
  // coupure porte sur l'année de l'événement.
  const annees = evenements
    .map((e) => e.date.slice(0, 4))
    .filter((annee) => annee > premiere && annee <= derniere)
    .sort();
  return annees.length ? annees[annees.length - 1] : null;
}

/** Évolution chiffrée, bornée au dernier périmètre constant. */
export function evolution(
  serie: Record<string, number>,
  periode: string,
  evenements: Evenement[] = [],
): string {
  const periodes = Object.keys(serie).sort();
  const valeurCourante = serie[periode];
  if (valeurCourante === undefined || periodes.length < 2) return "";
  const rupture = ruptureDePerimetre(evenements, periodes);
  const depuis = periodes.find((p) => (rupture ? p >= rupture : true));
  if (depuis === undefined || depuis === periode) return "";
  const depart = serie[depuis];
  if (!depart) return "";
  const variation = ((valeurCourante - depart) / Math.abs(depart)) * 100;
  const signe = variation >= 0 ? "+" : "";
  const reserve = rupture
    ? ` <span class="evolution__reserve">depuis le changement de périmètre</span>`
    : "";
  return `<span class="evolution">${signe}${variation.toFixed(
    1,
  )} % depuis ${echapper(depuis)}${reserve}</span>`;
}

/**
 * Points espacés régulièrement, par rang et non par date.
 *
 * C'est exact tant que la série est régulière, ce que sont toutes celles
 * publiées aujourd'hui : exercices annuels consécutifs, trimestres consécutifs.
 * Une série trouée — 2013 puis 2023, par exemple — serait déformée : les deux
 * points paraîtraient voisins. Les périodes coexistant sous deux formes
 * (`2024` et `2024-Q1`), les placer à leur date demanderait de savoir les lire
 * toutes ; d'ici là, les bornes sont écrites sous la courbe pour qu'on sache
 * quel intervalle on regarde.
 */
function points(valeurs: number[]): string {
  const bas = Math.min(...valeurs);
  const haut = Math.max(...valeurs);
  const amplitude = haut - bas || 1;
  return valeurs
    .map((valeur, i) => {
      const x = valeurs.length === 1 ? LARGEUR / 2 : (i / (valeurs.length - 1)) * LARGEUR;
      const y = HAUTEUR - ((valeur - bas) / amplitude) * HAUTEUR;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Courbe de la série, avec la rupture de périmètre matérialisée.
 * Rendu pur, sans DOM : c'est lui qui est testé.
 */
export function rendu(
  serie: Record<string, number>,
  evenements: Evenement[],
  formater: (valeur: number) => string,
): string {
  const periodes = Object.keys(serie).sort();
  if (periodes.length < 3) return ""; // deux points ne font pas une évolution
  const valeurs = periodes.map((p) => serie[p]);
  const rupture = ruptureDePerimetre(evenements, periodes);
  const indice = rupture ? periodes.indexOf(rupture) : -1;
  const marque =
    indice > 0
      ? `<line class="serie__rupture" x1="${((indice / (periodes.length - 1)) * LARGEUR).toFixed(
          1,
        )}" y1="0" x2="${((indice / (periodes.length - 1)) * LARGEUR).toFixed(
          1,
        )}" y2="${HAUTEUR}" />`
      : "";
  const avertissement = rupture
    ? `<p class="serie__avertissement">Périmètre modifié en ${echapper(
        rupture,
      )} : les valeurs antérieures ne portent pas sur le même territoire.</p>`
    : "";
  const resume = `${periodes[0]} : ${formater(valeurs[0])} — ${
    periodes[periodes.length - 1]
  } : ${formater(valeurs[valeurs.length - 1])}`;
  return `<div class="serie">
    <svg viewBox="0 0 ${LARGEUR} ${HAUTEUR}" class="serie__trace" role="img"
         aria-label="${echapper(`Évolution ${resume}`)}" preserveAspectRatio="none">
      ${marque}
      <polyline points="${points(valeurs)}" />
    </svg>
    <p class="serie__bornes"><span>${echapper(periodes[0])}</span><span>${echapper(
      periodes[periodes.length - 1],
    )}</span></p>
    ${avertissement}
  </div>`;
}
