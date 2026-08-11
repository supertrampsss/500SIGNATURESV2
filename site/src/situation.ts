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
 * **Le rang se calcule par habitant, la valeur ne s'affiche pas pour autant.**
 * Classer 34 875 communes sur leurs montants bruts revient à les classer par
 * population. Le dénominateur sert donc au classement ; la colonne montre le
 * rang, pas le montant par habitant, qui n'a sa place que dans un tableau
 * déplié.
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
  /**
   * Le sens du classement, en toutes lettres et d'un bout à l'autre.
   *
   * La phrase porte les deux extrémités parce qu'aucune moitié ne s'accorde
   * seule : « de le plus élevé à la plus faible » est ce que donne un bout
   * variable collé à un bout figé.
   */
  sens: string;
};

export type Rang = { libelle: string; rang: number; effectif: number; sens: string };

export type Entree = {
  code: string;
  /** Tous les codes de la maille, y compris ceux qui ne publient rien. */
  codes: string[];
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
    .map(({ libelle, valeur, sens }) => {
      const mienne = valeur(entree.code);
      if (mienne === null || !Number.isFinite(mienne)) return null;
      const publiees = entree.codes
        .map(valeur)
        .filter((v): v is number => v !== null && Number.isFinite(v));
      if (publiees.length < 2) return null;
      return {
        libelle,
        rang: publiees.filter((v) => v > mienne).length + 1,
        effectif: publiees.length,
        sens,
      };
    })
    .filter((r): r is Rang => r !== null);
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
      ({ libelle, rang, effectif, sens }) => `<li>
        <span class="situation__quoi">${echapper(libelle)}</span>
        <b class="situation__rang">${nombre(rang)}<sup>${rang === 1 ? "er" : "e"}</sup></b>
        <em class="situation__sur">sur ${nombre(
          effectif,
        )} ${maille} qui publient ce chiffre, ${echapper(sens)}</em>
      </li>`,
    )
    .join("");
  return `<section class="bloc-lecture bloc-lecture--situation">
    <h3>Où ça se situe</h3>
    <ol class="situation">${lignes}</ol>
    <p class="situation__legende">Exercice ${echapper(
      exercice,
    )}. Les trois premiers rangs se calculent par habitant : classer les montants bruts reviendrait à classer les territoires par population.</p>
  </section>`;
}
