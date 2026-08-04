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

import { pourcentage } from "./echelle.ts";

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
  courte = false,
  /** Le rythme annuel de la même évolution. Il occupait un encadré à lui seul,
   *  sous une ligne qui disait déjà « +275,8 % depuis 2022 » : deux fois la
   *  même chose, dans deux dessins. Il tient ici entre parenthèses. */
  parAn?: number | null,
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
  // Forme courte : le pourcentage seul, la fenêtre au survol. Répéter
  // « depuis 2022 » sous chaque ligne d'une fiche était du bruit — la fenêtre
  // reste dite, ligne par ligne, dans l'infobulle (elle peut différer d'une
  // série à l'autre : rupture de périmètre, historique plus court).
  if (courte) {
    const titre = rupture
      ? `depuis ${echapper(depuis)}, après le changement de périmètre`
      : `depuis ${echapper(depuis)}`;
    return `<span class="evolution" title="${titre}">${signe}${pourcentage(variation)}</span>`;
  }
  const reserve = rupture
    ? ` <span class="evolution__reserve">depuis le changement de périmètre</span>`
    : "";
  // Sous 0,05 point, le rythme annuel n'ajoute rien à « stable » : un encadré
  // « +0 % par an » sous une ligne « +0 % depuis 2022 » était deux fois rien.
  const rythme =
    parAn !== undefined && parAn !== null && Math.abs(parAn) >= 0.05
      ? ` <span class="evolution__rythme">${parAn > 0 ? "+" : ""}${pourcentage(
          parAn,
        )}/an</span>`
      : "";
  return `<span class="evolution">${signe}${pourcentage(variation)} depuis ${echapper(
    depuis,
  )}${rythme}${reserve}</span>`;
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
function points(valeurs: number[], bornes?: [number, number]): string {
  const bas = bornes ? bornes[0] : Math.min(...valeurs);
  const haut = bornes ? bornes[1] : Math.max(...valeurs);
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
export type Repere = { libelle: string; valeur: number };

export function rendu(
  serie: Record<string, number>,
  evenements: Evenement[],
  formater: (valeur: number) => string,
  /** Médianes de comparaison, tracées comme des lignes sur la courbe : « +57 %
   *  par rapport aux communes de la région » écrit en toutes lettres ne disait
   *  pas à quoi la courbe se comparait. Une ligne, si. */
  reperes: Repere[] = [],
  /** Faux quand la valeur de chaque repère est déjà écrite en toutes lettres
   *  au-dessus du dessin. Sur la fiche, « La moitié des régions de France sont
   *  en dessous de 92 € » précédait de trois centimètres une légende « ---- la
   *  médiane des régions de France : 92 € » : le même nombre deux fois, dont
   *  une en langage de graphique. La ligne, elle, reste — c'est elle qui situe
   *  la courbe d'un coup d'œil. */
  legende = true,
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
  // Un repère très éloigné écrase la courbe : à Pessac, la dette du
  // département (1 060 €) contre 866 € communaux tassait la série en trait
  // plat. Un repère n'entre donc dans l'échelle que s'il reste à moins d'une
  // amplitude de la série ; au-delà il n'est pas tracé, et sa valeur est dite
  // en légende — mieux vaut un repère absent du dessin qu'une courbe illisible
  // ou qu'une ligne au bord qui mentirait sur l'écart.
  const finis = reperes.filter((r) => Number.isFinite(r.valeur));
  const basSerie = Math.min(...valeurs);
  const hautSerie = Math.max(...valeurs);
  const marge = (hautSerie - basSerie || Math.abs(hautSerie) * 0.2 || 1) * 1.5;
  const utiles = finis.filter(
    (r) => r.valeur >= basSerie - marge && r.valeur <= hautSerie + marge,
  );
  const horsEchelle = finis.filter((r) => !utiles.includes(r));
  const toutes = [...valeurs, ...utiles.map((r) => r.valeur)];
  const bornes: [number, number] = [Math.min(...toutes), Math.max(...toutes)];
  const y = (valeur: number) =>
    HAUTEUR - ((valeur - bornes[0]) / (bornes[1] - bornes[0] || 1)) * HAUTEUR;
  const lignes = utiles
    .map(
      (r, i) => `<line class="serie__repere" x1="0" y1="${y(r.valeur).toFixed(1)}"
        x2="${LARGEUR}" y2="${y(r.valeur).toFixed(1)}"
        stroke-dasharray="${i === 0 ? "4 3" : "1 3"}" />`,
    )
    .join("");
  const etiquettes = [
    ...utiles.map(
      (r) => `<span class="serie__repere-nom">${echapper(r.libelle)} :
        ${echapper(formater(r.valeur))}</span>`,
    ),
    ...horsEchelle.map(
      (r) => `<span class="serie__repere-nom serie__repere-nom--loin"
        title="Trop éloigné pour être tracé sans écraser la courbe">${echapper(r.libelle)} :
        ${echapper(formater(r.valeur))}</span>`,
    ),
  ].join("");
  return `<div class="serie">
    <svg viewBox="0 0 ${LARGEUR} ${HAUTEUR}" class="serie__trace" role="img"
         aria-label="${echapper(
           `Évolution ${resume}${
             utiles.length
               ? `. Repères : ${utiles.map((r) => `${r.libelle} ${formater(r.valeur)}`).join(", ")}`
               : ""
           }`,
         )}" preserveAspectRatio="none">
      ${marque}${lignes}
      <polyline points="${points(valeurs, bornes)}" />
    </svg>
    ${legende && etiquettes ? `<p class="serie__reperes">${etiquettes}</p>` : ""}
    <p class="serie__bornes"><span>${echapper(periodes[0])}</span><span>${echapper(
      periodes[periodes.length - 1],
    )}</span></p>
    ${avertissement}
  </div>`;
}
