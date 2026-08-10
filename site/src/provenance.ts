/**
 * D'où vient une hausse, d'où vient une baisse.
 *
 * « Les dépenses de fonctionnement passent de 254,7 M€ à 312,1 M€, soit
 * +22,5 % » dit qu'il s'est passé quelque chose, et rien de plus. La source
 * publie pourtant les composantes de cet agrégat : le lecteur n'a aucune raison
 * d'aller les chercher dans un tableau déplié pour apprendre que les trois
 * quarts du mouvement sont des frais de personnel.
 *
 * Ce module attribue la variation d'un agrégat à ses composantes publiées. Il
 * refuse plus souvent qu'il n'accepte, et c'est le point :
 *
 * **UNE ATTRIBUTION N'EST VALIDE QUE SI LES COMPOSANTES SOMMENT AU TOTAL AUX
 * DEUX EXERCICES.** Une décomposition qui tient à l'arrivée mais pas au départ
 * attribue au premier poste venu la part que la source ne publiait pas encore.
 * Et une décomposition partielle — « Dépenses d'intervention » n'a que des
 * composantes choisies, sans poste « autres » — attribuerait à l'APA un
 * mouvement qui vient d'ailleurs. Dans les deux cas : rien plutôt qu'un
 * coupable désigné au hasard.
 *
 * **LES ENFANTS DÉCLARÉS NE SONT PAS TOUJOURS UNE PARTITION.** L'OFGL range
 * sous « Dépenses totales » le fonctionnement, l'investissement *et* « Dépenses
 * totales hors remb », qui recoupe les deux : les sommer compte près de deux
 * fois le budget. Ces enfants-là ne sont pas des composantes, ce sont **des
 * variantes de périmètre du total lui-même**, et le module les écarte — non
 * parce que leur nom le dit, mais parce qu'il vérifie sur les séries du
 * territoire l'identité qui le prouve : « total hors remboursements » vaut
 * exactement « total moins remboursements ». Si l'identité ne tient pas ici,
 * l'exclusion ne s'applique pas et la décomposition est refusée comme une autre.
 *
 * Vérifié sur les 534 communes de la Gironde et tous leurs exercices publiés :
 * l'identité tient 3 738 fois sur 3 738, des deux côtés du budget.
 */

import type { Indicateur } from "./donnees.ts";
import { millions } from "./echelle.ts";
import { traduire } from "./traductions.ts";

/** L'écart toléré entre la somme des composantes et leur total, en part du
 *  total. Les montants OFGL sont publiés à l'euro : ce qui dépasse un demi
 *  pourcent n'est pas un arrondi, c'est un périmètre différent. */
const TOLERANCE = 0.005;

/**
 * Les variantes de périmètre, et l'identité qui prouve chacune.
 *
 * `variante` vaut `total − moins`. Quand c'est vérifié sur les séries du
 * territoire, `variante` n'est pas une composante de `total` : c'est le même
 * agrégat sur un périmètre plus étroit, et il ne peut pas entrer dans une somme
 * avec ses frères sans compter deux fois les mêmes euros.
 */
const VARIANTES: { variante: string; total: string; moins: string }[] = [
  {
    variante: "ofgl_depenses_totales_hors_remb",
    total: "ofgl_depenses_totales",
    moins: "ofgl_remboursements_d_emprunts_hors_gad",
  },
  {
    variante: "ofgl_recettes_totales_hors_emprunts",
    total: "ofgl_recettes_totales",
    moins: "ofgl_emprunts_hors_gad",
  },
];

/** Une composante et ce qu'elle a fait entre les deux exercices. */
export type Part = {
  id: string;
  libelle: string;
  debut: number;
  fin: number;
  /** Ce que la composante a ajouté au total, en euros. */
  delta: number;
};

export type Provenance = {
  /** La variation du total, en euros. */
  delta: number;
  /** Toutes les composantes, la plus grosse contribution d'abord. */
  parts: Part[];
  /** Celles qui vont dans le sens du mouvement et en font l'essentiel. */
  moteurs: Part[];
  /** Celles qui vont en sens inverse et pèsent assez pour être dites. */
  freins: Part[];
};

/** La lecture d'une série, telle que `verdict.ts` la fournit déjà. */
type Lecture = (id: string, exercice: string) => number | null;

/** Une variante prouvée sur ce territoire, ou pas de variante du tout. */
function estVariante(id: string, lire: Lecture, exercices: string[]): boolean {
  const regle = VARIANTES.find((v) => v.variante === id);
  if (!regle) return false;
  return exercices.every((ex) => {
    const total = lire(regle.total, ex);
    const moins = lire(regle.moins, ex);
    const variante = lire(regle.variante, ex);
    if (total === null || moins === null || variante === null || total === 0) return false;
    return Math.abs(total - moins - variante) <= Math.abs(total) * TOLERANCE;
  });
}

/**
 * Ce qui, dans le mouvement d'un agrégat, vient de chacune de ses composantes.
 *
 * `null` dès qu'une condition manque : moins de deux composantes lisibles aux
 * deux exercices, ou une somme qui ne redonne pas le total. Le refus est la
 * réponse par défaut.
 */
export function provenance(
  parent: string,
  lire: Lecture,
  reference: string,
  arrivee: string,
  catalogue: Indicateur[],
): Provenance | null {
  const exercices = [reference, arrivee];
  const totalDebut = lire(parent, reference);
  const totalFin = lire(parent, arrivee);
  if (totalDebut === null || totalFin === null || totalDebut === 0 || totalFin === 0) return null;

  const parts: Part[] = [];
  for (const indicateur of catalogue) {
    if (indicateur.parent !== parent) continue;
    if (estVariante(indicateur.id, lire, exercices)) continue;
    const debut = lire(indicateur.id, reference);
    const fin = lire(indicateur.id, arrivee);
    // Absente des deux côtés, la composante n'est pas publiée pour ce
    // territoire : les travaux en régie n'existent pas à Bordeaux. L'écarter ne
    // cache rien, puisque le contrôle de somme ci-dessous refuserait le trou
    // qu'elle laisserait. Lisible d'un seul côté, en revanche, elle fausserait
    // l'attribution des deux : c'est alors toute la décomposition qui tombe.
    if (debut === null && fin === null) continue;
    if (debut === null || fin === null) return null;
    parts.push({ id: indicateur.id, libelle: traduire(indicateur.libelle), debut, fin, delta: fin - debut });
  }
  // Une composante unique ne décompose rien : elle répète le total ou en tait
  // le reste.
  if (parts.length < 2) return null;

  for (const [ex, total] of [[reference, totalDebut], [arrivee, totalFin]] as const) {
    const somme = parts.reduce((s, p) => s + (ex === reference ? p.debut : p.fin), 0);
    if (Math.abs(somme - total) > Math.abs(total) * TOLERANCE) return null;
  }

  const delta = totalFin - totalDebut;
  const classees = [...parts].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { delta, parts: classees, ...moteursEtFreins(classees, delta) };
}

/** Ce qui pousse dans le sens du mouvement, ce qui le retient. */
function moteursEtFreins(parts: Part[], delta: number): { moteurs: Part[]; freins: Part[] } {
  if (delta === 0) return { moteurs: [], freins: [] };
  const sens = Math.sign(delta);
  const moteurs: Part[] = [];
  let cumul = 0;
  for (const p of parts) {
    if (Math.sign(p.delta) !== sens) continue;
    // Assez de postes pour expliquer l'essentiel du mouvement, jamais plus de
    // trois : au-delà, la phrase récite le tableau qui est déjà dépliable.
    if (cumul >= Math.abs(delta) * PART_EXPLIQUEE || moteurs.length >= 3) break;
    moteurs.push(p);
    cumul += Math.abs(p.delta);
  }
  // Un frein n'est cité que s'il pèse assez pour changer la lecture : sans lui,
  // le mouvement aurait été sensiblement plus fort.
  const freins = parts
    .filter((p) => Math.sign(p.delta) === -sens && Math.abs(p.delta) >= Math.abs(delta) * SEUIL_FREIN)
    .slice(0, 1);
  return { moteurs, freins };
}

/** Ce qu'il faut avoir nommé pour que la phrase ait répondu à la question. */
const PART_EXPLIQUEE = 0.7;

/** En deçà, un poste à contre-courant n'est qu'un détail du tableau. */
const SEUIL_FREIN = 0.2;

/** « +12,4 M€ », « −0,8 M€ » : le signe est l'information. */
function apport(valeur: number): string {
  return `${valeur >= 0 ? "+" : ""}${millions(valeur)}`;
}

/**
 * « frais de personnel +12,4 M€, achats et charges externes +3,1 M€ ».
 *
 * Sans article, et c'est voulu. « des frais de personnel » et « de la dotation
 * globale » ne se déduisent d'aucun libellé de source : il faudrait deviner le
 * genre et le nombre de soixante-dix intitulés, et se tromper sur quelques-uns.
 * Le poste posé nu avec son apport ne se trompe jamais, et se lit aussi bien.
 *
 * Le libellé reste tel que la source l'écrit, capitale comprise. Le passer en
 * minuscules donnait « concours de l'état » : une minuscule à État est une
 * faute, et aucune règle mécanique ne distingue le nom propre du reste.
 */
function enumerer(parts: Part[]): string {
  return parts.map((p) => `${p.libelle} ${apport(p.delta)}`).join(", ");
}

/**
 * La clause qui répond à « d'où ça vient ? », ou rien.
 *
 * « ; la hausse vient surtout de deux postes : frais de personnel +12,4 M€,
 * achats et charges externes +3,1 M€ ; un poste la retient : charges
 * financières −0,8 M€ ». Elle s'ajoute à une phrase qui a déjà posé le total et
 * sa variation : elle ne les répète pas.
 */
export function provenanceDite(
  parent: string,
  lire: Lecture,
  reference: string,
  arrivee: string,
  catalogue: Indicateur[],
): string {
  const p = provenance(parent, lire, reference, arrivee, catalogue);
  if (!p || !p.moteurs.length) return "";
  const mot = p.delta >= 0 ? "la hausse" : "la baisse";
  const combien = p.moteurs.length === 1 ? "d'un poste" : `de ${NOMBRES[p.moteurs.length]} postes`;
  return ` ; ${mot} vient surtout ${combien} : ${enumerer(p.moteurs)}${freinDit(p)}`;
}

/**
 * La même chose en phrase entière, pour une ligne de mesure.
 *
 * « D'où vient la hausse : Frais de personnel +39,5 M€, Achats et charges
 * externes +21,2 M€. » La clause du récit s'accroche à une phrase qui a déjà
 * posé les millésimes ; ici la ligne les porte ailleurs, et la phrase se tient
 * seule.
 */
export function provenanceSeule(
  parent: string,
  lire: Lecture,
  reference: string,
  arrivee: string,
  catalogue: Indicateur[],
): string {
  const p = provenance(parent, lire, reference, arrivee, catalogue);
  if (!p || !p.moteurs.length) return "";
  const mot = p.delta >= 0 ? "la hausse" : "la baisse";
  return `D'où vient ${mot} : ${enumerer(p.moteurs)}${freinDit(p)}.`;
}

/** « ; un poste la retient : Charges financières −0,8 M€ ». */
function freinDit(p: Provenance): string {
  if (!p.freins.length) return "";
  return ` ; un poste ${p.delta >= 0 ? "la retient" : "la freine"} : ${enumerer(p.freins)}`;
}

/** Deux et trois s'écrivent, au plus trois moteurs sont cités. */
const NOMBRES: Record<number, string> = { 2: "deux", 3: "trois" };
