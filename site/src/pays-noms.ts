/**
 * Le nom français des pays et des agrégats européens.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI CETTE TABLE EST DANS LE SITE ET NON DANS LES DONNÉES
 * ─────────────────────────────────────────────────────────────────────────
 * `normalize/europe.py` écrit le référentiel des pays avec `name = code` : la
 * publication porte donc « DE » comme nom de l'Allemagne, pour les
 * quarante-huit territoires de la maille pays. Le site s'en tirait avec une
 * table de six noms posée dans `national.ts`, ce qui suffisait tant qu'on ne
 * comparait la France qu'à cinq voisins.
 *
 * Traduire un code ISO en français est une affaire d'affichage, pas de
 * donnée : la source ne publie pas de libellé français, et en fabriquer un
 * dans l'entrepôt reviendrait à faire dire à un producteur ce qu'il ne dit
 * pas. La table vit donc ici, du même côté que `traductions.ts`, qui traduit
 * déjà la nomenclature comptable pour les mêmes raisons.
 *
 * Les agrégats — zone euro, Union européenne — sont marqués : ils se lisent
 * comme des repères, jamais comme des voisins, et ils ne s'additionnent pas
 * aux pays qui les composent.
 */

export type Pays = { nom: string; agregat: boolean };

export const PAYS: Record<string, Pays> = {
  FR: { nom: "France", agregat: false },
  DE: { nom: "Allemagne", agregat: false },
  AT: { nom: "Autriche", agregat: false },
  BE: { nom: "Belgique", agregat: false },
  BG: { nom: "Bulgarie", agregat: false },
  CY: { nom: "Chypre", agregat: false },
  HR: { nom: "Croatie", agregat: false },
  DK: { nom: "Danemark", agregat: false },
  ES: { nom: "Espagne", agregat: false },
  EE: { nom: "Estonie", agregat: false },
  FI: { nom: "Finlande", agregat: false },
  EL: { nom: "Grèce", agregat: false },
  HU: { nom: "Hongrie", agregat: false },
  IE: { nom: "Irlande", agregat: false },
  IS: { nom: "Islande", agregat: false },
  IT: { nom: "Italie", agregat: false },
  LV: { nom: "Lettonie", agregat: false },
  LT: { nom: "Lituanie", agregat: false },
  LU: { nom: "Luxembourg", agregat: false },
  MT: { nom: "Malte", agregat: false },
  NO: { nom: "Norvège", agregat: false },
  NL: { nom: "Pays-Bas", agregat: false },
  PL: { nom: "Pologne", agregat: false },
  PT: { nom: "Portugal", agregat: false },
  CZ: { nom: "Tchéquie", agregat: false },
  RO: { nom: "Roumanie", agregat: false },
  GB: { nom: "Royaume-Uni", agregat: false },
  UK: { nom: "Royaume-Uni", agregat: false },
  SK: { nom: "Slovaquie", agregat: false },
  SI: { nom: "Slovénie", agregat: false },
  SE: { nom: "Suède", agregat: false },
  CH: { nom: "Suisse", agregat: false },
  TR: { nom: "Turquie", agregat: false },
  RS: { nom: "Serbie", agregat: false },
  ME: { nom: "Monténégro", agregat: false },
  MK: { nom: "Macédoine du Nord", agregat: false },
  AL: { nom: "Albanie", agregat: false },
  BA: { nom: "Bosnie-Herzégovine", agregat: false },
  XK: { nom: "Kosovo", agregat: false },
  MD: { nom: "Moldavie", agregat: false },
  UA: { nom: "Ukraine", agregat: false },
  JP: { nom: "Japon", agregat: false },
  US: { nom: "États-Unis", agregat: false },
  // Les agrégats. « EA » est la zone euro, « EU » l'Union : le nombre qui suit
  // est le nombre d'États membres à la date de la série, et il change quand
  // l'ensemble change. On l'écrit, parce que « zone euro » tout court ne dit
  // pas si la Croatie en fait partie.
  EA: { nom: "Zone euro", agregat: true },
  EA12: { nom: "Zone euro (12 pays)", agregat: true },
  EA19: { nom: "Zone euro (19 pays)", agregat: true },
  EA20: { nom: "Zone euro (20 pays)", agregat: true },
  EA21: { nom: "Zone euro (21 pays)", agregat: true },
  EU27_2020: { nom: "Union européenne (27 pays)", agregat: true },
  EU28: { nom: "Union européenne (28 pays)", agregat: true },
  EU15: { nom: "Union européenne (15 pays)", agregat: true },
  EU: { nom: "Union européenne", agregat: true },
  EEA: { nom: "Espace économique européen", agregat: true },
};

/** Le nom d'un territoire de la maille pays. Un code inconnu se rend tel quel :
 *  un code visible se corrige, un pays effacé ne se voit pas. */
export function nomPays(code: string): string {
  return PAYS[code]?.nom ?? code;
}

/** Vrai pour la zone euro et l'Union — les repères, pas les voisins. */
export function estAgregat(code: string): boolean {
  return PAYS[code]?.agregat ?? code.length > 2;
}
