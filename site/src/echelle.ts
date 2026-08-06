/**
 * Échelle de couleurs. Règle du produit (docs/04) : aucune couleur porteuse de
 * jugement — pas de rouge « mauvais », pas de vert « bon ». Une seule teinte,
 * du clair au foncé, qui dit « peu » et « beaucoup », rien d'autre.
 *
 * Les classes sont des quantiles : elles répartissent les territoires en parts
 * égales, ce qui évite qu'une poignée de valeurs extrêmes écrase toute la carte.
 * Les bornes sont affichées ; sans elles, une carte choroplèthe est un argument
 * caché.
 */

export const PALETTE = [
  "#eef3f8",
  "#cfe0ee",
  "#a9c8e0",
  "#7fadd0",
  "#548fbd",
  "#2f6fa6",
  "#1b4f77",
];

export type Echelle = { bornes: number[]; couleurs: string[] };

export function quantiles(valeurs: number[], classes = PALETTE.length): Echelle {
  const tri = valeurs.filter(Number.isFinite).sort((a, b) => a - b);
  if (tri.length === 0) return { bornes: [], couleurs: [] };
  const brutes: number[] = [];
  for (let i = 1; i < classes; i += 1) {
    brutes.push(tri[Math.floor((i / classes) * tri.length)]);
  }
  // Une distribution massée sur une valeur — la moitié des communes ont zéro
  // cambriolage — produit des quantiles égaux : la légende lisait « moins de
  // 0 ‰ · 0 ‰ – 0 ‰ · 0 ‰ – 0 ‰ … », quatre classes identiques et illisibles.
  // Les bornes se dédupliquent, une borne au niveau du minimum disparaît (sa
  // classe serait vide), et les couleurs restantes s'étalent sur la palette
  // pour garder le contraste clair-foncé.
  const bornes = [...new Set(brutes)].filter((borne) => borne > tri[0]);
  const nombre = bornes.length + 1;
  const couleurs =
    nombre >= PALETTE.length
      ? PALETTE.slice(0, nombre)
      : Array.from(
          { length: nombre },
          (_, i) => PALETTE[Math.round((i * (PALETTE.length - 1)) / Math.max(1, nombre - 1))],
        );
  return { bornes, couleurs };
}

/** Expression MapLibre : couleur d'un territoire selon sa valeur jointe. */
export function expressionCouleur(
  valeurs: Record<string, number>,
  echelle: Echelle,
  parHabitant: boolean,
  populations: Record<string, number>,
): unknown {
  const paires: unknown[] = [];
  for (const [code, brut] of Object.entries(valeurs)) {
    const population = populations[code];
    if (parHabitant && !population) continue; // pas de dénominateur, pas de ratio
    const valeur = parHabitant ? brut / population : brut;
    let index = echelle.bornes.findIndex((borne) => valeur < borne);
    if (index === -1) index = echelle.couleurs.length - 1;
    paires.push(code, echelle.couleurs[index]);
  }
  // « Donnée non disponible » se voit : gris neutre, jamais la couleur du zéro.
  return paires.length
    ? ["match", ["get", "code"], ...paires, "#d9d9d9"]
    : "#d9d9d9";
}

/** Un montant ne se ramène à l'habitant que s'il s'additionne.
 *
 *  Un budget communal divisé par la population donne une dépense par habitant.
 *  Un **niveau de vie médian** divisé par la population ne donne rien : c'est
 *  déjà une valeur par personne, et une médiane ne s'additionne pas. La règle
 *  suit donc la sommabilité déclarée de l'indicateur, pas sa seule unité.
 */
export function parHabitantAUnSens(indicateur: {
  unite: string;
  sommable?: boolean;
}): boolean {
  return indicateur.unite === "EUR" && indicateur.sommable !== false;
}

/** Indicateur portant, exercice par exercice, le dénominateur que l'OFGL
 *  lui-même utilise. Il est publié comme les autres séries. */
const POPULATION_OFGL = "ofgl_population_reference";

/** Le dénominateur d'un « par habitant » est la population de **l'exercice
 *  considéré**, pas celle d'aujourd'hui.
 *
 *  La fiche divisait toute la série par une population unique, celle du
 *  référentiel géographique courant : les dépenses de 2022 d'une commune se
 *  lisaient rapportées à ses habitants de 2025. L'écart est de quelques pour
 *  cent sur un territoire stable, beaucoup plus sur un territoire qui a fusionné
 *  — et l'étiquette annonçait « référence OFGL 2025 » un nombre qui ne venait
 *  pas de l'OFGL.
 *
 *  Repli sur la population du référentiel quand la série manque : mieux vaut un
 *  dénominateur approché qu'un trou, et l'étiquette dira lequel a servi. */
export function populationDeReference(
  territoire: { population: number | null; series?: Record<string, Record<string, number>> },
  periode: string,
): { valeur: number | null; exercice: string | null } {
  const serie = territoire.series?.[POPULATION_OFGL];
  const propre = serie?.[periode];
  if (propre) return { valeur: propre, exercice: periode };
  return { valeur: territoire.population, exercice: null };
}

/** Typographie française du pourcentage, définie une fois : espace fine
 *  insécable avant le signe, virgule décimale, et surtout **pas**
 *  `style: "percent"` — les valeurs publiées sont déjà en points de
 *  pourcentage, le multiplier par cent les rendrait absurdes. */
/** Une valeur qui s'arrondit à zéro s'affiche « 0 », jamais « −0 » : le signe
 *  d'un zéro n'informe personne et fait douter de tout le reste. */
function sansZeroNegatif(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) === 0 ? 0 : valeur;
}

/**
 * Le signe moins typographique (U+2212), pas le trait d'union du clavier.
 *
 * `Intl` produit « -4,1 » avec un trait d'union quand les phrases composées ici
 * portent « −53 % ». Les deux se côtoyaient à l'écran, dans deux dessins et
 * deux largeurs. Une seule forme partout.
 */
export function moins(texte: string): string {
  return texte.replace("-", "−");
}

export function pourcentage(valeur: number): string {
  return moins(
    `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      sansZeroNegatif(valeur, 1),
    )} %`,
  );
}

/** La note sous la légende dit ce que sont les nombres qu'on vient de lire.
 *
 *  Elle était écrite en dur — « Montants en euros courants » — et s'affichait
 *  donc aussi sous une échelle de taux de pauvreté. Une légende qui se trompe
 *  d'unité est pire qu'une légende absente : elle affirme. */
export function noteEchelle(unite: string, parHabitant: boolean): string {
  const classes = "Classes de valeurs égales en nombre de territoires.";
  if (parHabitant) {
    // Le principal facteur de confusion des dépenses communales par habitant, et
    // il se voit sur la carte : le littoral et la montagne ressortent d'abord.
    return (
      `${classes} Dénominateur : population de référence OFGL de l'exercice.` +
      " Une commune touristique dépense pour une population bien plus nombreuse que" +
      " ses habitants permanents, qui sont le dénominateur."
    );
  }
  if (unite === "percent") {
    return `${classes} Taux en pourcentage : ils ne s'additionnent pas et ne se ramènent pas à l'habitant.`;
  }
  // Les taux de délinquance enregistrée (SSMSI) : le dénominateur fait partie
  // de l'unité — cambriolages pour 1 000 logements, le reste pour 1 000
  // habitants — et la note doit nommer le bon, sinon elle affirme un chiffre
  // deux fois trop petit ou trop grand.
  if (unite === "pour_1000_habitants") {
    return (
      `${classes} Faits enregistrés en % des habitants (dénominateur INSEE de la` +
      " source). Mesure les faits portés à la connaissance des forces de l'ordre," +
      " pas l'intégralité des faits commis."
    );
  }
  if (unite === "pour_1000_logements") {
    return (
      `${classes} Faits enregistrés en % des logements (dénominateur INSEE de la` +
      " source), le bon dénominateur des cambriolages — pas la population."
    );
  }
  if (unite === "consultations_par_an") {
    return (
      `${classes} Consultations de médecin généraliste accessibles par an et par` +
      " habitant standardisé (APL, DREES) — un indicateur modélisé, pas un comptage." +
      " En dessous de 2,5, la DREES parle de sous-densité."
    );
  }
  if (unite === "jours") {
    return (
      `${classes} Délai global de paiement moyen, en jours. La loi en accorde` +
      " trente aux collectivités ; un délai court suppose de la trésorerie et" +
      " n'est pas en soi une vertu budgétaire."
    );
  }
  if (unite === "count") return `${classes} Effectifs, en nombre d'unités.`;
  return `${classes} Montants en euros courants.`;
}

export function formater(valeur: number, unite: string, parHabitant: boolean): string {
  // Un seul point de sortie pour la typographie du signe : les six chemins de
  // formatage ci-dessous produisaient chacun le trait d'union d'`Intl`.
  return moins(formaterNombre(valeur, unite, parHabitant));
}

function formaterNombre(valeur: number, unite: string, parHabitant: boolean): string {
  if (unite === "count") {
    return new Intl.NumberFormat("fr-FR").format(Math.round(valeur));
  }
  // Un taux n'est pas une somme d'argent. Sans cette branche, tout ce qui
  // n'était pas un effectif tombait dans le chemin devise : un taux de pauvreté
  // de 51 % s'affichait « 51 € », légende comprise. C'est l'erreur que ce site
  // existe pour ne pas commettre.
  //
  // Les valeurs sont déjà exprimées en pourcentage (12,4 vaut 12,4 %), donc pas
  // de `style: "percent"`, qui multiplierait par cent. Espace fine insécable
  // avant le signe, comme le veut l'usage français.
  if (unite === "percent") {
    return pourcentage(valeur);
  }
  // Les taux pour mille de la source s'affichent en **pourcentage** : le ‰
  // se lit « %0 » pour beaucoup de lecteurs, ce qui est pire que cryptique.
  // La conversion est exacte (÷ 10) ; la note de légende nomme le
  // dénominateur, car « % des logements » n'est pas « % des habitants ».
  if (unite === "pour_1000_habitants" || unite === "pour_1000_logements") {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(
      sansZeroNegatif(valeur / 10, 2),
    )} %`;
  }
  // APL : des consultations par an et par habitant — l'abréviation garde la
  // cellule lisible, la légende porte la définition complète.
  if (unite === "consultations_par_an") {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      valeur,
    )} consult./an`;
  }
  // Repli honnête : une unité que ce module ne connaît pas s'affiche telle
  // quelle, à côté du nombre. Le bug du taux de pauvreté en euros venait de ce
  // que le repli était la devise — un affichage faux mais plausible, donc
  // invisible. Une unité inconnue doit se voir tout de suite.
  if (unite !== "EUR") {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      valeur,
    )} ${unite}`;
  }
  const options: Intl.NumberFormatOptions = {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: parHabitant ? 0 : 0,
  };
  // Un budget d'État se lit en milliards, un budget communal en millions :
  // « 441 194,3 M€ » est exact et illisible.
  if (!parHabitant && Math.abs(valeur) >= 1e9) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      valeur / 1e9,
    )} Md€`;
  }
  if (!parHabitant && Math.abs(valeur) >= 1e6) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      valeur / 1e6,
    )} M€`;
  }
  // Le budget d'une petite commune se lit en k€ : « 195 924 € » est exact
  // et illisible, « 196 k€ » se compare d'un coup d'œil.
  if (!parHabitant && Math.abs(valeur) >= 1e4) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
      valeur / 1e3,
    )} k€`;
  }
  return new Intl.NumberFormat("fr-FR", options).format(sansZeroNegatif(valeur, 0));
}
