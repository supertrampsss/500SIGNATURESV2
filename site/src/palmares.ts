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

/** Un territoire noté, tel que le palmarès le range.
 *
 *  `population` départage les ex æquo, et il y en a beaucoup : voir
 *  `palmares()`. Facultative — un territoire sans population publiée passe
 *  après ceux qui en ont une, il n'est pas écarté. */
export type Ligne = { code: string; nom: string; note: Note; population?: number | null };

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
  /** Combien partagent exactement la meilleure note, et la pire. La note est
   *  bornée à 20 et à 0 par construction : 2 102 communes atteignent 20 sur 20
   *  et 2 221 sont à 0. Sans ces deux nombres, dix noms tirés d'un paquet de
   *  deux mille passeraient pour « les dix meilleures de France ». */
  exAequoTete: number;
  exAequoQueue: number;
  /** Toutes les notes de l'échelon, pour que le rendu calcule un rang partagé
   *  sans refaire le tri. */
  valeurs: number[];
};

/**
 * Range les territoires notés et prend les deux bouts.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LES EX ÆQUO NE SONT PAS UN CAS LIMITE, C'EST LE CAS COURANT
 * ─────────────────────────────────────────────────────────────────────────
 * La note est bornée aux deux bouts : **2 102 communes valent exactement 20 sur
 * 20 et 2 221 valent exactement 0** (publication 2026-08-11T0807). Un premier
 * tri départageait par le nom, et « les dix communes les mieux gérées de
 * France » sortaient Abbans-Dessous, Ablaincourt-Pressoir, Ablancourt, Accons :
 * les quatre premières de l'alphabet parmi deux mille. Une liste comme celle-là
 * se fait démonter en une heure, et elle le mérite.
 *
 * Le tri départage donc **par population décroissante**, et le rendu **dit
 * combien partagent la note**. Une commune de quarante mille habitants à 20 sur
 * 20 apprend quelque chose ; un hameau de trente, non — non qu'il soit moins
 * bien géré, mais parce que son ratio bascule sur une seule opération.
 *
 * Le nom reste en dernier recours, sans quoi deux publications des mêmes
 * données rendraient deux palmarès différents : l'ordre de `Object.keys` n'est
 * pas une garantie, et un lecteur qui revient verrait ses dix premières bouger
 * sans que rien n'ait changé.
 */
export function palmares(lignes: Ligne[], combien = 10): Palmares | null {
  if (!lignes.length) return null;
  // **Le haut et le bas se trient séparément, et pas l'un à l'envers de
  // l'autre.** Un tri unique « note décroissante, population décroissante »
  // suivi d'un `slice(-N)` prend, parmi les derniers ex æquo, les MOINS
  // peuplés — l'inverse de ce que le cadrage annonce. Le bas se trie donc par
  // note croissante ET population décroissante : les plus grandes villes des
  // deux bouts, comme la phrase le dit.
  const parPopulation = (a: Ligne, b: Ligne) =>
    (b.population ?? -1) - (a.population ?? -1) || a.nom.localeCompare(b.nom, "fr");
  const meilleures = [...lignes].sort((a, b) => b.note.valeur - a.note.valeur || parPopulation(a, b));
  const pires = [...lignes].sort((a, b) => a.note.valeur - b.note.valeur || parPopulation(a, b));
  const rangees = meilleures;
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
    tete: meilleures.slice(0, Math.min(combien, Math.floor(rangees.length / 2))),
    queue: pires.slice(0, Math.min(combien, Math.floor(rangees.length / 2))),
    effectif: rangees.length,
    mediane: valeurs[milieu],
    exercice,
    autresExercices: rangees.length - compte,
    exAequoTete: valeurs.filter((v) => v === valeurs[0]).length,
    exAequoQueue: valeurs.filter((v) => v === valeurs[valeurs.length - 1]).length,
    valeurs,
  };
}

/**
 * L'échelon au pluriel, et son genre.
 *
 * **Le genre n'est pas un détail de style** : le titre s'écrit « les communes
 * les mieux et les moins bien gérées » et « les départements […] gérés ». Écrit
 * en dur au féminin, il donnait « les départements les mieux gérées » — la
 * faute exacte que le classement venait de corriger sur « 27 887 communes sont
 * mieux notés », réapparue dans un module neuf le jour où il est arrivé.
 */
const MAILLES: Record<string, { pluriel: string; feminin: boolean }> = {
  commune: { pluriel: "communes", feminin: true },
  departement: { pluriel: "départements", feminin: false },
  region: { pluriel: "régions", feminin: true },
};

/**
 * Le rang d'une note, à la convention du classement sportif.
 *
 * **Deux mille cent deux communes valent exactement 20 sur 20** : leur écrire
 * « 1re, 2e, 3e… » serait un rang inventé. Elles sont toutes premières, et dix
 * lignes qui affichent « 1 » disent au lecteur, mieux qu'une phrase, que le
 * plafond est encombré. C'est déjà la convention de `situation.ts`.
 */
export function rangs(lignes: Ligne[], toutes: number[]): number[] {
  return lignes.map((l) => 1 + toutes.filter((v) => v > l.note.valeur).length);
}

function rangee(ligne: Ligne, rang: number, vous?: string): string {
  const valeur = ligne.note.valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  // Le territoire dont on lit le groupe se reconnaît dans sa propre liste :
  // sans repère, dix noms de communes semblables se ressemblent tous, et
  // c'est justement celui-là qu'on est venu chercher.
  const sien = vous !== undefined && vous === ligne.code;
  return `<li${sien ? ' class="palmares__vous"' : ""}>
    <button type="button" data-territoire="${echapper(ligne.code)}"${
      sien ? ' aria-current="true"' : ""
    }>
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
  const { pluriel, feminin } = maille;
  const gere = feminin ? "gérées" : "gérés";
  const nombre = (n: number) => n.toLocaleString("fr-FR");
  const note = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const toutes = resultat.valeurs;
  const rangsTete = rangs(tete, toutes);
  const rangsQueue = rangs(queue, toutes);
  const exAequo = (combien: number, valeur: number, quoi: string) =>
    phraseExAequo(combien, valeur, quoi, pluriel);
  return `<section class="palmares" aria-labelledby="palmares-titre-${echapper(niveau)}">
    <h3 class="palmares__titre" id="palmares-titre-${echapper(niveau)}">Les ${echapper(
      pluriel,
    )} les mieux et les moins bien ${gere}</h3>
    <p class="palmares__cadrage">Note de gestion de l'exercice ${echapper(exercice)}, sur ${nombre(
      effectif,
    )} ${echapper(pluriel)} qui publient les trois séries de l'Observatoire des finances locales.${
      // Le millésime dominant est écrit ; celles qui en diffèrent sont
      // comptées plutôt que tues. Sans ce compte, la phrase daterait de
      // l'exercice le plus fréquent un tableau qui en mélange deux.
      autresExercices
        ? ` ${nombre(autresExercices)} ${
            autresExercices === 1 ? "est notée" : "sont notées"
          } sur l'exercice précédent, faute d'avoir publié celui-ci.`
        : ""
    } La note médiane est de ${note(mediane)} sur 20.${exAequo(
      resultat.exAequoTete,
      tete[0]?.note.valeur ?? 0,
      "en tête",
    )}${exAequo(resultat.exAequoQueue, queue[0]?.note.valeur ?? 0, "en bas")}</p>
    ${colonnes(tete, rangsTete, queue, rangsQueue, feminin)}
  </section>`;
}

/**
 * Les deux colonnes, et leurs deux titres accordés.
 *
 * « Les mieux notées » s'écrivait en dur au féminin, sous un titre qui venait
 * pourtant d'être corrigé : la page des départements portait « Les départements
 * les mieux et les moins bien gérés » puis, deux lignes plus bas, « Les mieux
 * notées ». C'est la troisième fois que ce participe tombe — le critère du
 * classement, le titre du palmarès, puis ses colonnes.
 */
function colonnes(
  tete: Ligne[],
  rangsTete: number[],
  queue: Ligne[],
  rangsQueue: number[],
  feminin: boolean,
  vous?: string,
): string {
  const note = feminin ? "notées" : "notés";
  return `<div class="palmares__colonnes">
      <div class="palmares__colonne">
        <h4>Les mieux ${note}</h4>
        <ol class="palmares__liste">${tete
          .map((l, i) => rangee(l, rangsTete[i], vous))
          .join("")}</ol>
      </div>
      <div class="palmares__colonne">
        <h4>Les moins bien ${note}</h4>
        <ol class="palmares__liste palmares__liste--queue">${queue
          .map((l, i) => rangee(l, rangsQueue[i], vous))
          .join("")}</ol>
      </div>
    </div>`;
}

/**
 * « 2 102 communes valent exactement 20,0 » — dit seulement quand elles sont
 * plusieurs, sinon la phrase apprendrait que la première est la première.
 *
 * **Elle est partagée par les deux palmarès**, et pas par élégance : le groupe
 * de communes semblables a d'abord été écrit sans elle, et il montrait cinq
 * communes à 20 sur 20 en tête des 635 semblables à Sare — dont 47 valent
 * exactement 20 — comme s'il s'agissait des cinq meilleures. C'est la faute
 * qui avait déjà coûté un correctif au palmarès de l'échelon, reproduite dans
 * un module neuf le jour de sa naissance.
 */
function phraseExAequo(
  combien: number,
  valeur: number,
  quoi: string,
  pluriel: string,
): string {
  if (combien <= 1) return "";
  const note = valeur.toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return ` ${combien.toLocaleString("fr-FR")} ${echapper(
    pluriel,
  )} valent exactement ${note} sur 20 : ce sont les plus peuplées d'entre elles qui sont montrées ${quoi}.`;
}

/** Le territoire dont on lit le groupe, tel que la phrase le nomme. */
export type Vous = { code: string; nom: string; note: Note };

/** « 1re », « 34e ». Le premier rang porte sa marque, les autres non — et les
 *  communes sont féminines, seule maille qui porte des critères de groupe. */
function ordinal(rang: number): string {
  return rang === 1 ? "1re" : `${rang}e`;
}

/**
 * Le palmarès du groupe de communes semblables.
 *
 * Même barème, même tri, mêmes colonnes que le palmarès de l'échelon : seule
 * change la population comparée. La phrase de cadrage porte ce qui fait la
 * différence — **les critères du groupe**, sans lesquels « 48 communes » ne
 * veut rien dire, et **la place du territoire dans son groupe**, qui est la
 * réponse qu'on est venu chercher.
 *
 * Le rang se lit sur les communes du groupe **qui portent une note**, jamais
 * sur celles qui existent : c'est la règle que `situation.ts` et le palmarès
 * tiennent déjà.
 */
export function rendreSemblables(
  resultat: Palmares | null,
  intitules: string[],
  vous: Vous,
): string {
  if (!resultat) return "";
  const { tete, queue, effectif, mediane, exercice, valeurs } = resultat;
  const nombre = (n: number) => n.toLocaleString("fr-FR");
  const note = (n: number) =>
    n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rang = 1 + valeurs.filter((v) => v > vous.note.valeur).length;
  const partagent = valeurs.filter((v) => v === vous.note.valeur).length;
  // Un rang partagé se dit : « 22e » quand deux communes du groupe valent
  // exactement la même note laisse croire à une place propre.
  const egalite =
    partagent > 1
      ? `, à égalité avec ${partagent === 2 ? "une autre" : `${nombre(partagent - 1)} autres`}`
      : "";
  return `<section class="palmares palmares--semblables" aria-labelledby="palmares-semblables">
    <h3 class="palmares__titre" id="palmares-semblables">Les communes semblables à ${echapper(
      vous.nom,
    )}</h3>
    <p class="palmares__cadrage">${nombre(effectif)} communes ${echapper(
      intitules.join(", "),
    )}, qui publient les trois séries de leurs comptes. Les critères de
    comparaison sont ceux de l'Observatoire des finances locales. Note de
    gestion de l'exercice ${echapper(exercice)}.${
      // Le millésime dominant est écrit ; celles qui en diffèrent sont
      // comptées plutôt que tues, comme au palmarès de l'échelon.
      resultat.autresExercices
        ? ` ${nombre(resultat.autresExercices)} ${
            resultat.autresExercices === 1 ? "est notée" : "sont notées"
          } sur l'exercice précédent.`
        : ""
    } ${echapper(vous.nom)} est ${ordinal(rang)} sur ${nombre(effectif)}, à ${note(
      vous.note.valeur,
    )} sur 20${egalite} ; la note médiane du groupe est de ${note(mediane)} sur 20.${phraseExAequo(
      resultat.exAequoTete,
      tete[0]?.note.valeur ?? 0,
      "en tête",
      "communes",
    )}${phraseExAequo(resultat.exAequoQueue, queue[0]?.note.valeur ?? 0, "en bas", "communes")}</p>
    ${colonnes(tete, rangs(tete, valeurs), queue, rangs(queue, valeurs), true, vous.code)}
  </section>`;
}
