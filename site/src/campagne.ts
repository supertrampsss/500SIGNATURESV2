/** La campagne express : quinze dossiers, cinq par acte, toujours jouables. */

import { MESURES } from "./mesures.ts";

export type Acte = 1 | 2 | 3;
export type ModeTunnel = "express" | "integral";

/** Sept dossiers par acte : même avec les quatre contrats, cinq survivent. */
export const EXPRESS_PAR_ACTE = {
  1: [
    "flat-tax-a-20-avec-abattement-protegeant",
    "exonerer-de-droits-de-succession-jusqu-a",
    "raboter-de-5-les-subventions-directes-aux",
    "achever-la-suppression-de-la-cvae",
    "aligner-la-csg-des-retraites-aises-sur",
    "reconduire-la-surtaxe-des-grandes-entreprises",
    "desindexer-les-pensions-d-un-point",
  ],
  2: [
    "repousser-l-age-legal-a-65-ans",
    "supprimer-l-aide-medicale-d-etat",
    "porter-l-effort-de-defense-vers-3",
    "plan-ferroviaire-3-000-m-de-plus",
    "privatiser-l-audiovisuel-public",
    "doubler-les-franchises-medicales",
    "revaloriser-les-enseignants-de-5",
  ],
  3: [
    "geler-le-point-d-indice-en-2026",
    "fermer-un-tiers-des-agences-et-operateurs",
    "ceder-des-participations-non-strategiques-de-l",
    "doubler-les-moyens-contre-la-fraude-fiscale",
    "reduire-l-aide-publique-au-developpement-de",
    "porter-le-taux-normal-de-tva-a",
    "reduire-de-5-les-dotations-aux-collectivites",
  ],
} as const;

const BLOQUEES_PAR = new Map(MESURES.map((m) => [m.id, m.bloqueePar ?? []]));

/** Un générateur déterministe local : aucune dépendance au hasard global. */
function alea(graine: number): () => number {
  let x = graine | 0;
  return () => {
    x |= 0;
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function melanger<T>(elements: readonly T[], graine: number): T[] {
  const resultat = [...elements];
  const hasard = alea(graine);
  for (let i = resultat.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [resultat[i], resultat[j]] = [resultat[j]!, resultat[i]!];
  }
  return resultat;
}

/** L'acte auquel appartient un dossier express. */
export function acteDe(id: string): Acte | undefined {
  for (const acte of [1, 2, 3] as const) if (EXPRESS_PAR_ACTE[acte].includes(id as never)) return acte;
  return undefined;
}

/** Quinze dossiers distincts, filtrés par contrats et mélangés acte par acte. */
export function ordreExpress(engagements: readonly string[], graine: number): string[] {
  return ([1, 2, 3] as const).flatMap((acte) =>
    melanger(
      EXPRESS_PAR_ACTE[acte].filter((id) => !BLOQUEES_PAR.get(id)?.some((cle) => engagements.includes(cle))),
      graine + acte,
    ).slice(0, 5),
  );
}
