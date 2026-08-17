/**
 * Le palmarès : les mieux et les moins bien notées d'un échelon.
 *
 * La note vivait sur une fiche et dans le classement d'une fiche — deux
 * endroits où il faut d'abord savoir quel territoire on cherche. Un lecteur
 * qui vient demander « et les autres ? » n'avait aucune page à ouvrir.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI LES DEUX BOUTS, ET PAS UN CLASSEMENT ENTIER
 * ─────────────────────────────────────────────────────────────────────────
 * Trente-quatre mille lignes ne se lisent pas. Le haut et le bas se lisent, et
 * ce sont eux qu'on vient chercher. Entre les deux, la médiane est écrite :
 * sans elle, dix communes à 19/20 posées au-dessus de dix communes à 1/20
 * laissent croire que l'échelon se répartit en deux camps.
 *
 * **Le dénominateur est nommé, et ce n'est pas le nombre de territoires qui
 * existent.** « 10 meilleures sur 34 875 » serait faux : 34 778 communes
 * publient les trois séries de l'OFGL, les autres n'ont pas de note du tout.
 * Un rang se dit sur ceux qui publient, jamais sur ceux qui existent — c'est
 * la règle que `situation.ts` tient déjà.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUE LE PALMARÈS NE FAIT PAS
 * ─────────────────────────────────────────────────────────────────────────
 * Il ne mélange jamais deux échelons. Les barèmes sont propres à chacun
 * (`note.ts`), et un tableau qui poserait une commune à 18/20 à côté d'un
 * département à 18/20 inviterait à les comparer alors que les deux notes ne
 * sortent pas de la même grille.
 */

import { mention, type Note } from "./note.ts";

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Un territoire noté, tel que le palmarès le range. */
export type Ligne = { code: string; nom: string; note: Note };

export type Palmares = {
  /** Les mieux notées, de la meilleure à la moins bonne. */
  tete: Ligne[];
  /** Les moins bien notées, de la pire à la moins pire — le bas se lit en
   *  partant du bas, comme le haut se lit en partant du haut. */
  queue: Ligne[];
  /** Combien de territoires portent une note. Jamais combien il en existe. */
  effectif: number;
  /** La note médiane de l'échelon, pour que les deux bouts aient un milieu. */
  mediane: number;
  /** L'exercice des notes. Elles ne sont pas toutes du même millésime — une
   *  poignée de communes s'arrête un an plus tôt —, et c'est le millésime
   *  dominant qui est écrit, avec le compte de celles qui en diffèrent. */
  exercice: string;
  /** Combien de territoires sont notés sur un autre exercice que celui-là. */
  autresExercices: number;
};

/**
 * Range les territoires notés et prend les deux bouts.
 *
 * Le tri départage les ex æquo par le nom, sinon deux publications
 * successives des mêmes données rendraient deux palmarès différents — l'ordre
 * de `Object.keys` n'est pas une garantie, et un lecteur qui revient sur la
 * page verrait ses dix premières bouger sans que rien n'ait changé.
 */
export function palmares(lignes: Ligne[], combien = 10): Palmares | null {
  if (!lignes.length) return null;
  const rangees = [...lignes].sort(
    (a, b) => b.note.valeur - a.note.valeur || a.nom.localeCompare(b.nom, "fr"),
  );
  const valeurs = rangees.map((l) => l.note.valeur);
  const milieu = Math.floor((valeurs.length - 1) / 2);

  const exercices = new Map<string, number>();
  for (const l of rangees) {
    exercices.set(l.note.mesures.exercice, (exercices.get(l.note.mesures.exercice) ?? 0) + 1);
  }
  const [exercice, compte] = [...exercices].sort((a, b) => b[1] - a[1])[0];

  return {
    // Deux bouts qui ne se chevauchent pas : sous vingt territoires notés, le
    // haut et le bas montreraient deux fois les mêmes lignes, et le lecteur
    // lirait une commune à la fois parmi les meilleures et parmi les pires.
    tete: rangees.slice(0, Math.min(combien, Math.floor(rangees.length / 2))),
    queue: rangees.slice(-Math.min(combien, Math.floor(rangees.length / 2))).reverse(),
    effectif: rangees.length,
    mediane: valeurs[milieu],
    exercice,
    autresExercices: rangees.length - compte,
  };
}

/** Le nom de l'échelon, au pluriel, tel que la phrase du dénominateur le dit. */
const MAILLES: Record<string, string> = {
  commune: "communes",
  departement: "départements",
  region: "régions",
};

function rangee(ligne: Ligne, rang: number): string {
  const valeur = ligne.note.valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `<li>
    <button type="button" data-territoire="${echapper(ligne.code)}">
      <span class="palmares__rang nombre">${rang}</span>
      <span class="palmares__nom">${echapper(ligne.nom)}</span>
      <span class="palmares__note nombre">${echapper(valeur)}</span>
      <span class="palmares__mention">${echapper(mention(ligne.note.valeur))}</span>
    </button>
  </li>`;
}

/**
 * Les deux colonnes, et la phrase qui les tient.
 *
 * `niveau` sert le dénombrement — « sur 34 778 communes notées » — et rien
 * d'autre : le palmarès d'un échelon ne nomme jamais un autre échelon.
 */
export function rendrePalmares(resultat: Palmares | null, niveau: string): string {
  const maille = MAILLES[niveau];
  if (!resultat || !maille) return "";
  const { tete, queue, effectif, mediane, exercice, autresExercices } = resultat;
  const nombre = (n: number) => n.toLocaleString("fr-FR");
  const note = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `<section class="palmares" aria-labelledby="palmares-titre-${echapper(niveau)}">
    <h3 class="palmares__titre" id="palmares-titre-${echapper(niveau)}">Les ${echapper(
      maille,
    )} les mieux et les moins bien gérées</h3>
    <p class="palmares__cadrage">Note de gestion de l'exercice ${echapper(exercice)}, sur ${nombre(
      effectif,
    )} ${echapper(maille)} qui publient les trois séries de l'Observatoire des finances locales.${
      // Le millésime dominant est écrit ; celles qui en diffèrent sont
      // comptées plutôt que tues. Sans ce compte, la phrase daterait de
      // l'exercice le plus fréquent un tableau qui en mélange deux.
      autresExercices
        ? ` ${nombre(autresExercices)} ${
            autresExercices === 1 ? "est notée" : "sont notées"
          } sur l'exercice précédent, faute d'avoir publié celui-ci.`
        : ""
    } La note médiane est de ${note(mediane)} sur 20.</p>
    <div class="palmares__colonnes">
      <div class="palmares__colonne">
        <h4>Les mieux notées</h4>
        <ol class="palmares__liste">${tete.map((l, i) => rangee(l, i + 1)).join("")}</ol>
      </div>
      <div class="palmares__colonne">
        <h4>Les moins bien notées</h4>
        <ol class="palmares__liste palmares__liste--queue">${queue
          .map((l, i) => rangee(l, effectif - i))
          .join("")}</ol>
      </div>
    </div>
  </section>`;
}
