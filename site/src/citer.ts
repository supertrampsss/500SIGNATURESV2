/**
 * « Citer » : la chaîne que la commande copie — le nombre, son unité, sa
 * source, son millésime et le permalien.
 *
 * Spec §13 : « C'est la réponse à la capture d'écran floue. » Une capture
 * montre un chiffre et rien d'autre ; celui qui la reçoit ne peut ni le dater,
 * ni le rattacher à un producteur, ni retrouver la page. Ce qui est copié ici
 * doit permettre de **retrouver le chiffre sans le site**, à la main, dans le
 * fichier du producteur.
 *
 * Fonction pure : ni DOM, ni réseau, ni horloge. Le geste — le presse-papiers —
 * est un canal **injecté** (`offrirCitation`), comme les deux canaux d'`offrir`
 * (partage.ts) : c'est ce qui rend le chemin éprouvable sous Node.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SANS SOURCE NI MILLÉSIME, IL N'Y A PAS DE CITATION
 * ─────────────────────────────────────────────────────────────────────────
 * `citer()` refuse de composer une chaîne à laquelle il manque l'un des cinq
 * éléments, exactement comme `exigerProvenance` refuse de peindre une carte
 * sans source (carte-og.ts). Un rendu qui ne connaît pas la provenance d'un
 * chiffre n'offre donc pas la commande : copier un nombre nu serait la capture
 * d'écran floue sous une autre forme, en plus commode.
 *
 * `citable()` est la même règle, rendue en booléen, pour que le module de rendu
 * décide **avant** de poser un bouton plutôt que de le laisser échouer au clic.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX RÈGLES DU SITE, DÉLÉGUÉES, JAMAIS RECOPIÉES
 * ─────────────────────────────────────────────────────────────────────────
 * **Le montant passe par `formater`** (echelle.ts) : millions d'euros, deux
 * décimales sous le million, espaces fines insécables, signe typographique.
 *
 * **Une variation se dit en points quand la grandeur est un taux**, et en
 * pourcentage sinon — y compris pour les taux que la source publie pour mille
 * et que l'écran montre en pourcentage. La règle vit dans `evolution-carte.ts`
 * (`modeVariation`, `formaterVariation`), avec ses tests. Recopiée ici, elle
 * finirait par dire autre chose que la carte : ce lot vient de corriger
 * exactement cette faute dans `carte-og.ts`, qui peignait un taux pour mille
 * en pourcentage et dix fois trop grand.
 */

import { formater } from "./echelle.ts";
import { formaterVariation, modeVariation } from "./evolution-carte.ts";

/** La variation citée à côté du niveau : de combien, et depuis quel exercice.
 *
 *  Les deux ensemble, jamais l'un sans l'autre — « +18,5 % » sans point de
 *  départ ne se vérifie nulle part, et c'est précisément ce qu'une citation
 *  existe pour éviter. */
export type VariationCitee = { valeur: number; depuis: string };

/**
 * Ce qu'un rendu doit savoir d'un chiffre pour qu'on puisse le citer.
 *
 * `valeur` et `unite` sont ceux du fichier publié, pas ceux de l'écran : le
 * formatage est le travail de ce module, et une chaîne toute faite reçue d'un
 * rendu aurait déjà pu perdre son unité.
 */
export type Citation = {
  /** Ce que le nombre est, en toutes lettres. Un nombre sans intitulé se cite
   *  aussi mal qu'un nombre sans date. */
  libelle: string;
  valeur: number;
  /** L'unité déclarée par le catalogue — `EUR`, `percent`, `count`… */
  unite: string;
  /** L'indicateur d'où vient la valeur, quand l'appelant le connaît : lui seul
   *  distingue un agrégat d'une valeur unitaire, que l'unité `EUR` confond
   *  (voir `formater`). */
  id?: string;
  /** Vrai quand la valeur est un ratio par habitant. */
  parHabitant?: boolean;
  /** Le dénominateur, nommé. **Obligatoire dès que `parHabitant` est vrai** :
   *  « 1 240 € par habitant » ne se vérifie pas tant qu'on ignore quelle
   *  population a servi à diviser, et deux dénominateurs plausibles coexistent
   *  sur ce site — la population municipale de l'INSEE et la population de
   *  référence de l'Observatoire des finances locales. */
  denominateur?: string;
  /** La variation, quand le chiffre en porte une à l'écran. */
  variation?: VariationCitee;
  /** L'intitulé de la source, tel que le producteur la nomme. */
  source: string;
  /** Le millésime du chiffre : l'exercice qu'il mesure, jamais la date à
   *  laquelle la page a été écrite. C'est la date que cherche celui qui veut
   *  retrouver la ligne dans le fichier du producteur. */
  millesime: string;
  /** L'adresse qui restitue l'état exact. Absolue : une citation circule hors
   *  du site, et un chemin relatif n'y mène plus. */
  permalien: string;
};

/** Les champs sans lesquels la citation ne se vérifie pas ailleurs. */
function manquants(citation: Citation): string[] {
  const champs: [string, string][] = [
    ["l'intitulé", citation.libelle],
    ["l'unité", citation.unite],
    ["la source", citation.source],
    ["le millésime", citation.millesime],
    ["le permalien", citation.permalien],
  ];
  const vides = champs.filter(([, valeur]) => !valeur.trim()).map(([nom]) => nom);
  if (!Number.isFinite(citation.valeur)) vides.push("le nombre");
  // Le par-habitant est le seul champ conditionnel : il n'est exigé que
  // lorsqu'il y a un ratio, et il l'est alors absolument.
  if (citation.parHabitant && !citation.denominateur?.trim()) vides.push("le dénominateur");
  return vides;
}

/**
 * Ce rendu peut-il citer honnêtement ce chiffre ?
 *
 * Appelée par le module de rendu avant de poser la commande. Un bouton qui
 * lèverait au clic est une promesse rompue ; un bouton absent est une limite
 * tenue.
 */
export function citable(citation: Citation): boolean {
  return manquants(citation).length === 0;
}

/** Ce que la citation dit d'un ratio : son dénominateur, entre parenthèses,
 *  juste après le nombre — là où on le lit, pas en note de bas de page. */
function ratio(citation: Citation): string {
  return citation.parHabitant ? ` par habitant (${citation.denominateur})` : "";
}

/** La variation, dans l'unité que la grandeur commande — points pour un taux,
 *  pourcentage sinon —, avec l'exercice d'où elle part. */
function evolution(citation: Citation): string {
  const { variation } = citation;
  if (!variation) return "";
  const dite = formaterVariation(variation.valeur, citation.unite, modeVariation(citation.unite));
  return ` (${dite} depuis ${variation.depuis})`;
}

/** Le point final d'un intitulé, retiré.
 *
 *  Les intitulés que les rendus tiennent sont souvent des phrases entières —
 *  `chiffres[].lecture` d'une analyse en est une par contrat
 *  (docs/analyses-schema.md). Recopiée telle quelle avant une parenthèse, la
 *  phrase écrivait « … en loi de finances. (exercice 2025). » : deux points,
 *  et le millésime rejeté après la fin de la phrase, là où l'œil ne le cherche
 *  plus. */
function sansPointFinal(texte: string): string {
  return texte.trim().replace(/\s*\.$/u, "");
}

/**
 * La citation, en trois lignes : le chiffre daté, sa source, son adresse.
 *
 * **Le nombre ouvre la citation**, avant son intitulé : c'est lui qu'on cite,
 * c'est lui que cherche l'œil de celui qui reçoit le collage, et les intitulés
 * du site sont des phrases entières — mis devant, ils repoussaient le chiffre
 * en fin de ligne, à l'endroit exact où une capture d'écran l'aurait coupé.
 *
 * Trois lignes et pas une phrase : collée dans un fil de discussion, une
 * citation doit se lire d'un coup d'œil, et la source ne doit pas se perdre au
 * milieu du texte. C'est la même économie que le résumé de `partage.ts`.
 */
export function citer(citation: Citation): string {
  const absents = manquants(citation);
  if (absents.length > 0) {
    throw new Error(
      `Citation sans ${absents.join(", ")} : ce qui est copié doit permettre de retrouver ` +
        "le chiffre sans le site.",
    );
  }
  const nombre = formater(citation.valeur, citation.unite, Boolean(citation.parHabitant), citation.id);
  return [
    `${nombre}${ratio(citation)}${evolution(citation)} — ${sansPointFinal(
      citation.libelle,
    )} (exercice ${citation.millesime}).`,
    `Source : ${sansPointFinal(citation.source)}.`,
    citation.permalien,
  ].join("\n");
}

/* --------------------------------------------------------------------------
 * Le geste : le presse-papiers, injecté
 * ----------------------------------------------------------------------- */

/** Le presse-papiers, passé en fonction ordinaire plutôt que lu dans
 *  `navigator` : c'est ce qui rend ce chemin éprouvable sous Node, comme les
 *  canaux d'`offrir` (partage.ts). */
export type Presse = (texte: string) => Promise<void>;

/** Ce qu'il est advenu du geste. Pas de `partagé` ici : « citer » copie, et
 *  un panneau de partage du système transformerait une citation en message. */
export type IssueCitation = "copié" | "indisponible";

/**
 * Copie la citation, ou dit qu'elle n'a pas pu l'être.
 *
 * Le presse-papiers manque (contexte non sécurisé) ou refuse (permission,
 * geste non reconnu comme volontaire) plus souvent qu'on ne le croit :
 * `indisponible` n'est pas une panne rare, c'est le cas que l'appelant doit
 * couvrir en affichant le texte à copier à la main.
 */
export async function offrirCitation(
  citation: Citation,
  presse?: Presse,
): Promise<IssueCitation> {
  if (!presse) return "indisponible";
  try {
    await presse(citer(citation));
    return "copié";
  } catch {
    return "indisponible";
  }
}
