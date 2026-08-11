/**
 * « Où ça se situe » : le rang du territoire dans sa maille.
 *
 * Un montant seul ne dit pas s'il est grand. Les blocs le comparent à
 * lui-même — 2019 contre 2025 —, jamais aux autres territoires du même
 * échelon, et c'est le seul fait qu'aucune partie de la fiche ne porte.
 *
 * **Un rang n'est pas une note.** Le tableau ne dit ni bien ni mal, il dit une
 * position et le sens du classement. « 412e sur 34 875 » se vérifie ; « la
 * ville dépense beaucoup » ne se vérifie pas.
 *
 * **Le rang se calcule par habitant, et le montant s'affiche avec lui.** Classer
 * 34 875 communes sur leurs montants bruts revient à les classer par
 * population : le dénominateur sert donc au classement. Et le montant qui a
 * produit le rang se lit à côté de lui — « 265e » sans « 1 377 € par habitant »
 * demande de croire sur parole.
 *
 * **Le sens du classement se dit en comptant, pas en le nommant.** « De la plus
 * élevée à la plus faible » demande de tenir le fil jusqu'au rang pour savoir
 * si l'on dépense beaucoup ou peu. « 264 communes dépensent plus » se lit d'un
 * coup et ne s'interprète pas. Le compte de celles qui dépensent moins est
 * parti avec : il se déduit du rang, et il doublait la hauteur du bloc.
 *
 * **Une ligne par critère, rang en tête.** Le bloc tenait sur trois lignes par
 * critère — intitulé et montant, phrase de comptage, « voir le classement » —
 * soit douze lignes pour quatre chiffres. Le rang ouvre maintenant la ligne
 * comme un index, la phrase se glisse sous l'intitulé, et la ligne entière
 * ouvre le classement.
 *
 * **Le classement s'ouvre.** Un rang appelle la question « et les autres ? ».
 * Le pli montre les dix premiers, le voisinage immédiat et les trois derniers ;
 * chaque ligne ouvre la fiche du territoire. Trente-quatre mille lignes ne se
 * peignent pas, et personne ne veut la 12 000e.
 *
 * **Le millésime est dans le titre, et rien d'autre sous le bloc.** Une phrase
 * de méthode en pied disait « par habitant » une cinquième fois, après quatre
 * intitulés qui le portent déjà. Ne reste que l'exercice, sans lequel un
 * classement ne se vérifie pas.
 *
 * **Un territoire qui ne publie pas la valeur n'a pas de rang**, et la ligne
 * n'est pas écrite. On ne le compte pas non plus dans le dénombrement : « 412e
 * sur 34 875 » se dit sur les territoires qui publient, pas sur ceux qui
 * existent.
 */

export type Critere = {
  /** Ce que la ligne mesure, tel qu'elle se lit. */
  libelle: string;
  /** La valeur de chaque territoire, ou `null` s'il ne la publie pas. */
  valeur: (code: string) => number | null;
  /** Le verbe qui dit ce que fait un territoire mieux classé : « dépensent
   *  plus », « doivent plus ». C'est lui qui remplace « de la plus élevée à la
   *  plus faible », que personne ne sait lire jusqu'au bout. */
  dessus: string;
  /** Son contraire : « dépensent moins ». */
  dessous: string;
  /** Comment s'écrit une valeur de ce critère. */
  ecrire: (valeur: number) => string;
};

/** Un territoire dans le classement, tel que le pli l'affiche. */
export type Place = {
  code: string;
  nom: string;
  rang: number;
  valeur: string;
  vous: boolean;
  /** Vrai si le pli a sauté des places juste avant celle-ci. Se lit sur les
   *  positions et non sur les rangs : deux ex æquo 1er suivis d'un 3e ne sont
   *  pas un trou, ils sont la convention du classement. */
  apresUnTrou: boolean;
};

export type Rang = {
  libelle: string;
  rang: number;
  effectif: number;
  dessus: string;
  dessous: string;
  /** La valeur du territoire, écrite. */
  valeur: string;
  /** Le haut du classement, le voisinage et le bas. */
  extrait: Place[];
};

export type Entree = {
  code: string;
  /** Tous les codes de la maille, y compris ceux qui ne publient rien. */
  codes: string[];
  /** Le nom de chaque code, pour le pli du classement. */
  noms: Record<string, string>;
  criteres: Critere[];
};

/**
 * Le rang du territoire sur chaque critère, du plus élevé au plus bas.
 *
 * Les ex æquo prennent le même rang, celui du premier d'entre eux : deux
 * communes à 1 377 € sont 412e toutes les deux, et la suivante est 414e. C'est
 * la convention du classement sportif, et c'est celle qu'on attend.
 */
export function situation(entree: Entree): Rang[] {
  return entree.criteres
    .map(({ libelle, valeur, dessus, dessous, ecrire }) => {
      const mienne = valeur(entree.code);
      if (mienne === null || !Number.isFinite(mienne)) return null;
      const publiees = entree.codes
        .map((code) => [code, valeur(code)] as const)
        .filter((p): p is readonly [string, number] => p[1] !== null && Number.isFinite(p[1]))
        .sort((a, b) => b[1] - a[1]);
      if (publiees.length < 2) return null;
      const rang = publiees.filter(([, v]) => v > mienne).length + 1;
      return {
        libelle,
        rang,
        effectif: publiees.length,
        dessus,
        dessous,
        valeur: ecrire(mienne),
        extrait: extraire(publiees, entree, ecrire),
      };
    })
    .filter((r): r is Rang => r !== null);
}

/** Combien de places le pli montre en tête, et de part et d'autre de la vôtre.
 *  Court exprès : douze lignes tiennent sous l'œil, vingt-cinq repoussent la
 *  suite de la fiche hors de l'écran. */
const TETE = 5;
const VOISINS = 2;
const QUEUE = 2;

/**
 * Le haut du classement, votre voisinage, la fin — et les trous nommés.
 *
 * Trente-quatre mille lignes ne se peignent pas, et la 12 000e n'intéresse
 * personne. Les trois tranches se recouvrent quand le territoire est en tête :
 * la déduplication par rang les recolle sans faire de trou artificiel.
 */
function extraire(
  triees: readonly (readonly [string, number])[],
  entree: Entree,
  ecrire: (valeur: number) => string,
): Place[] {
  const rangs = new Map<number, number>();
  let precedente: number | null = null;
  let dernierRang = 0;
  triees.forEach(([, v], index) => {
    if (precedente === null || v !== precedente) dernierRang = index + 1;
    precedente = v;
    rangs.set(index, dernierRang);
  });
  const mien = triees.findIndex(([code]) => code === entree.code);
  const gardes = new Set<number>();
  for (let i = 0; i < Math.min(TETE, triees.length); i++) gardes.add(i);
  for (let i = mien - VOISINS; i <= mien + VOISINS; i++) {
    if (i >= 0 && i < triees.length) gardes.add(i);
  }
  for (let i = Math.max(0, triees.length - QUEUE); i < triees.length; i++) gardes.add(i);
  const ordonnees = [...gardes].sort((a, b) => a - b);
  return ordonnees.map((index, position) => {
    const [code, valeur] = triees[index]!;
    return {
      code,
      nom: entree.noms[code] ?? code,
      rang: rangs.get(index)!,
      valeur: ecrire(valeur),
      vous: code === entree.code,
      apresUnTrou: position > 0 && index > ordonnees[position - 1]! + 1,
    };
  });
}

const MAILLES: Record<string, string> = {
  commune: "communes",
  departement: "départements",
  region: "régions",
};

const nombre = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export function rendreSituation(liste: Rang[], niveau: string, exercice: string): string {
  const maille = MAILLES[niveau];
  if (!liste.length || !maille) return "";
  const lignes = liste
    .map(
      ({ libelle, rang, effectif, dessus, valeur, extrait }) => `<li>
        <details class="situation__pli">
          <summary>
            <span class="situation__rang nombre">${nombre(rang)}<sup>${
              rang === 1 ? "er" : "e"
            }</sup></span>
            <span class="situation__quoi">${echapper(libelle)}<em>${
              rang === 1
                ? `aucune ${maille.replace(/s$/, "")} ne fait plus`
                : `${nombre(rang - 1)} ${maille} ${echapper(dessus)}`
            }, sur ${nombre(effectif)}</em></span>
            <span class="situation__valeur nombre">${echapper(valeur)}</span>
          </summary>
          <ol class="situation__classement">${extrait
            .map(
              (place) => `${
                place.apresUnTrou
                  ? `<li class="situation__saut" aria-hidden="true">…</li>`
                  : ""
              }<li${place.vous ? ' class="situation__vous"' : ""}>
                <button type="button" data-territoire="${echapper(place.code)}">
                  <span class="situation__place nombre">${nombre(place.rang)}</span>
                  <span class="situation__nom">${echapper(place.nom)}</span>
                  <span class="situation__montant nombre">${echapper(place.valeur)}</span>
                </button>
              </li>`,
            )
            .join("")}</ol>
        </details>
      </li>`,
    )
    .join("");
  return `<section class="bloc-lecture bloc-lecture--situation">
    <h3>Où ça se situe<span class="situation__exercice">${echapper(exercice)}</span></h3>
    <ol class="situation">${lignes}</ol>
  </section>`;
}
