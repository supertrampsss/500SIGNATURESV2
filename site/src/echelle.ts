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

/**
 * L'unité d'un taux européen, écrite une fois.
 *
 * Elle est posée ici et retirée par le tableau des voisins, qui la porte déjà
 * dans l'intitulé de sa colonne. Une constante partagée plutôt que deux
 * chaînes tapées à la main : celle-ci contient une espace fine insécable, et
 * deux littéraux qui ne diffèrent que par un blanc invisible se lisent
 * identiques — c'est le piège qui a faussé dix vérifications de ce dépôt.
 */
export const SUFFIXE_POUR_100000 = " pour 100 000 habitants";

/**
 * Un taux, une décimale au plus.
 *
 * `decimaleFixe` en impose une exactement — « 1,0 % » et non « 1 % ». Elle ne
 * sert qu'aux COLONNES qu'on vient comparer : `Intl` laisse tomber la décimale
 * d'un compte rond, et le tableau des fonctions publiques alignait « 1 » sous
 * « 23,7 » et « 1,4 », tandis que celui de la Sécu mettait « 21 » à côté de
 * « 20,9 » et de « 0,0 pt » — trois formats sur une même ligne, `points()`
 * (secu.ts) posant déjà ce minimum de son côté.
 *
 * Hors tableau elle reste absente, et c'est voulu : une variation de carte
 * s'écrit « +12 % », et une variation qui s'arrondit à zéro « 0 % » sans
 * signe — deux décisions que des tests tiennent (evolution-carte.test.ts).
 */
export function pourcentage(valeur: number, decimaleFixe = false): string {
  return moins(
    `${new Intl.NumberFormat("fr-FR", {
      ...(decimaleFixe ? { minimumFractionDigits: 1 } : {}),
      maximumFractionDigits: 1,
    }).format(sansZeroNegatif(valeur, 1))} %`,
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
      `${classes} Dénominateur : population de référence de l'Observatoire des finances locales.` +
      " Une commune touristique dépense pour une population bien plus nombreuse que" +
      " ses habitants permanents, qui sont le dénominateur."
    );
  }
  if (unite === "percent") {
    return `${classes} Taux en pourcentage : ils ne s'additionnent pas et ne se ramènent pas à l'habitant.`;
  }
  if (unite === "mwh") {
    return (
      `${classes} Consommation en mégawattheures, toutes catégories de consommateurs` +
      " confondues (ménages, entreprises, industrie) : une commune industrielle" +
      " consomme sans que ses habitants y soient pour rien."
    );
  }
  if (unite === "m2") {
    return (
      `${classes} Surface consommée en hectares (1 ha = 10 000 m²). La dernière` +
      " année est provisoire et sous-estimée : elle est révisée au millésime" +
      " suivant."
    );
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
      " source), le bon dénominateur des cambriolages : pas la population."
    );
  }
  if (unite === "indice") {
    return (
      `${classes} Indice de Gini du niveau de vie après impôts et prestations,` +
      " de 0 (tous les revenus égaux) à 100 (une seule personne touche tout)."
    );
  }
  if (unite === "ratio") {
    return (
      `${classes} Rapport entre la masse des revenus des 20 % les plus aisés et` +
      " celle des 20 % les plus modestes, après impôts et prestations."
    );
  }
  if (unite === "annees") {
    return `${classes} Âge en années, avec sa décimale : les écarts se jouent en mois.`;
  }
  // Les faits enregistrés d'Eurostat comptent **pour cent mille habitants**
  // quand ceux du SSMSI comptent pour mille : deux unités, deux séries, et
  // aucune conversion silencieuse de l'une vers l'autre. Ce qui varie d'un
  // pays à l'autre, ici, n'est pas seulement la délinquance : c'est aussi ce
  // que chaque police enregistre.
  if (unite === "pour_100000_habitants") {
    return (
      `${classes} Faits enregistrés par la police pour 100 000 habitants,` +
      " classification internationale ICCS. Un fait non déclaré n'y figure pas," +
      " et les pratiques d'enregistrement diffèrent d'un pays à l'autre."
    );
  }
  if (unite === "consultations_par_an") {
    return (
      `${classes} Consultations de médecin généraliste accessibles par an et par` +
      " habitant standardisé, calculé par la DREES : un indicateur modélisé, pas un comptage." +
      " En dessous de 2,5, la DREES parle de sous-densité."
    );
  }
  if (unite === "€/m²/mois") {
    return (
      `${classes} Loyer d'annonce au mètre carré, charges comprises, pour un` +
      " logement vide. Il n'est mesuré que là où la source a assez d'annonces ;" +
      " ailleurs la commune reste grise plutôt que d'afficher le loyer du" +
      " voisinage."
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
  return `${classes} Montants en millions d'euros courants (M€).`;
}

/**
 * La mention d'unité que porte tout ce qui aligne des montants du site hors de
 * la page qui les explique — une carte de partage, la description d'un lien,
 * un résumé collé ailleurs.
 *
 * « Santé 1 643 M€ » se lit « 1 643 milliards » par qui n'a pas le nez sur le
 * sigle. La phrase vit ici, au même endroit que `millions()` qui produit ce
 * sigle : elle en est la lecture en toutes lettres, et deux formulations de la
 * même règle se corrigeraient séparément — c'était le cas, `carte-og.ts` et
 * `apercu-scenario.ts` en portant chacun la sienne, à un point près.
 *
 * Sans ponctuation finale : les deux appelants ne la posent pas au même
 * endroit d'une phrase. `apercu-scenario.ts` en fait une phrase à elle seule
 * et lui ajoute son point ; `carte-og.ts` la prolonge d'un exercice.
 */
export const MENTION_MILLIONS = "Montants en millions d'euros";

/**
 * Montant en millions d'euros, deux décimales sous le million.
 *
 * **Une seule échelle pour tous les montants du site.** Les montants passaient
 * de « 196 k€ » à « 30,8 M€ » à « 441,2 Md€ » selon leur taille : trois unités
 * dans une même colonne, qu'il fallait convertir de tête pour comparer deux
 * communes. Le million est l'unité de la dépense publique locale, et c'est
 * celle que le site tient partout — la page ANALYSES la tenait déjà.
 *
 * « 0 M€ » pour 340 000 € effacerait le montant ; « 0,34 M€ » le garde lisible.
 * Au-delà du million, la décimale suffit — personne ne lit le second chiffre
 * après la virgule sur 183,1 M€ — et au-delà du milliard, aucune.
 */
/**
 * Un montant écrit pour quelqu'un qui n'est pas du métier.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI « 3 536 100 M€ » N'EST PAS UN CHIFFRE LISIBLE
 * ─────────────────────────────────────────────────────────────────────────
 * La règle « tout en millions » existe pour qu'une colonne se compare d'une
 * ligne à l'autre, et elle est juste pour une commune : 417,14 M€ se lit. À la
 * maille de l'État elle produit « 380 390 M€ », « 441 194 M€ », « 3 536 100 M€ »
 * — sept chiffres, un sigle de deux lettres, et la question que tout lecteur
 * se pose devant l'écran : millions ou milliards ? Il faut connaître le métier
 * pour savoir que 3 536 100 M€ est une dette de trois mille cinq cents
 * milliards. Un site qui existe pour rendre les comptes publics lisibles ne
 * peut pas demander ça.
 *
 * Deux corrections, et une seule idée : **le lecteur ne doit convertir
 * rien du tout**.
 *
 * 1. L'échelle suit le montant — millions en dessous du millier de millions,
 *    milliards au-delà. Un chiffre garde au plus quatre rangs significatifs.
 * 2. L'unité s'écrit **en toutes lettres**. « Md€ » n'est pas plus clair que
 *    « M€ » pour qui ne l'a jamais lu ; « milliards d'euros » l'est pour tout
 *    le monde.
 *
 * Les millions et les milliards sont arrondis à l'entier : à cette échelle,
 * les décimales donnent une fausse précision et cassent la lecture.
 *
 * `millions()` reste, et reste employée là où la place manque et où l'unité
 * est déjà dite par ailleurs : une cellule de tableau sous une légende qui
 * nomme l'unité, une carte de partage, un export.
 */
export function montantLisible(valeur: number): string {
  const absolu = Math.abs(valeur);
  const [diviseur, mot] =
    absolu >= 1e9 ? [1e9, "milliards d'euros"] : [1e6, "millions d'euros"];
  const echelle = valeur / diviseur;
  const decimales = 0;
  return moins(
    `${new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(sansZeroNegatif(echelle, decimales))}\u00a0${mot}`,
  );
}

export function millions(valeur: number): string {
  const m = valeur / 1e6;
  const absolu = Math.abs(m);
  const decimales = absolu < 1 ? 2 : absolu < 1000 ? 1 : 0;
  return moins(
    `${new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(sansZeroNegatif(m, decimales))} M€`,
  );
}

/**
 * Les montants en euros qui ne sont pas des agrégats.
 *
 * Une valeur unitaire — ce que gagne une personne en un mois — n'entre pas
 * dans la règle des M€, qui est faite pour comparer des masses budgétaires
 * entre elles. Nommer les séries concernées vaut mieux qu'un seuil de
 * grandeur : le budget d'une petite commune est lui aussi un petit nombre, et
 * il reste un agrégat.
 */
const VALEURS_UNITAIRES = new Set([
  "insee_salaire_net_eqtp_mensuel",
  // Les dix-huit déciles du niveau de vie, avant et après redistribution : ce
  // qu'une personne a pour vivre en un an. « 0,01 M€ » y serait la même faute
  // que « 0,00 M€ » sur un salaire mensuel, à un rang près.
  ...Array.from({ length: 9 }, (_, i) => `insee_niveau_vie_d${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `insee_niveau_vie_d${i + 1}_avant_redistribution`),
  // Et les pensions mensuelles moyennes : « 0,00 M€ » y serait la faute exacte
  // que le salaire mensuel a déjà corrigée.
  "drees_pension_moyenne_brute",
  "drees_pension_moyenne_brute_femmes",
  "drees_pension_moyenne_brute_hommes",
  "drees_pension_moyenne_nette",
]);

export function formater(
  valeur: number,
  unite: string,
  parHabitant: boolean,
  /** L'indicateur d'où vient la valeur, quand l'appelant le connaît : lui seul
   *  distingue un agrégat d'une valeur unitaire, que l'unité `EUR` confond. */
  id?: string,
): string {
  // Un seul point de sortie pour la typographie du signe : les six chemins de
  // formatage ci-dessous produisaient chacun le trait d'union d'`Intl`.
  return moins(formaterNombre(valeur, unite, parHabitant, id));
}

function formaterNombre(
  valeur: number,
  unite: string,
  parHabitant: boolean,
  id?: string,
): string {
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
  // `rate` est l'ancienne unité du taux de participation, corrigée dans le
  // connecteur mais encore présente dans les publications antérieures : sans
  // cette branche, le site affichait « 58,1 rate ».
  if (unite === "percent" || unite === "rate") {
    return pourcentage(valeur);
  }
  // La consommation d'espaces se publie en mètres carrés entiers. Au-delà de
  // l'hectare, l'échelle monte : « 3 117 494 m² » ne se lit pas, « 312 ha »
  // se lit — et un hectare, c'est un terrain de rugby et demi.
  if (unite === "m2") {
    const absolu = Math.abs(valeur);
    const nombre = (v: number, d: number) =>
      new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v);
    if (absolu >= 1e5) return moins(`${nombre(valeur / 1e4, 0)} ha`);
    if (absolu >= 1e4) return moins(`${nombre(valeur / 1e4, 1)} ha`);
    return moins(`${nombre(valeur, 0)} m²`);
  }
  // L'énergie se publie en mégawattheures. Au-delà du millier, l'échelle
  // monte d'un cran : « 3 573 119 MWh » ne se lit pas, « 3,6 TWh » se lit.
  if (unite === "mwh") {
    const absolu = Math.abs(valeur);
    const nombre = (v: number, d: number) =>
      new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d }).format(v);
    if (absolu >= 1e6) return moins(`${nombre(valeur / 1e6, 1)}\u202fTWh`);
    if (absolu >= 1e3) return moins(`${nombre(valeur / 1e3, 1)}\u202fGWh`);
    return moins(`${nombre(valeur, 1)}\u202fMWh`);
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
  // Un indice et un rapport ne sont pas des effectifs : arrondis à l'entier,
  // « 30,4 » devient « 30 » et « 4,74 » devient « 5 ». C'est la règle de la
  // décimale d'une colonne, appliquée à deux mesures qui bougent de quelques
  // dixièmes par an et dont l'écart entre pays se joue à cet endroit-là.
  if (unite === "indice") {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(valeur);
  }
  if (unite === "ratio") {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valeur);
  }
  // Un âge de départ à la retraite se lit avec sa décimale et son unité : la
  // série bouge de quelques dixièmes d'année par réforme, et « 63 ans » à côté
  // de « 62,3 ans » cesserait d'aligner la colonne.
  if (unite === "annees") {
    return `${new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(valeur)} ans`;
  }
  // Un taux pour cent mille habitants ne se convertit ni en pourcentage — un
  // homicide vaudrait « 0,00 % » — ni en pour mille comme les séries du SSMSI,
  // qui ont leur propre dénominateur. Il s'écrit tel qu'Eurostat le publie, et
  // son unité tient dans la cellule : une colonne de nombres nus, sous un
  // intitulé qui dit « pour 100 000 habitants », se relit ailleurs sans lui.
  if (unite === "pour_100000_habitants") {
    // La décimale est **fixe**, et pas seulement maximale : le tableau des
    // voisins peignait « Allemagne 94 » entre « 295,5 » et « 166,8 », un compte
    // rond dont `Intl` laisse tomber la décimale. Sixième formateur du dépôt
    // pris à cette faute. Cette unité-ci ne s'affiche jamais seule — elle vit
    // dans une colonne de pays ou une série d'années —, donc la décimale y est
    // toujours voulue, sans option.
    return `${new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(valeur)}${SUFFIXE_POUR_100000}`;
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
  // Un montant qui n'est pas un agrégat se lit en euros, pas en millions.
  //
  // La règle « tous les montants en M€ » existe pour qu'une colonne de
  // montants publics se compare d'une ligne à l'autre. Appliquée à un salaire
  // mensuel, elle affichait « Salaire net mensuel moyen : 0,00 M€ », deux
  // exercices de suite, avec « +4 % » à côté d'un chiffre nul : le seul
  // affichage du site où la variation ne se rattachait à aucune valeur
  // lisible. Ce n'est pas un agrégat de finances publiques mais une valeur
  // unitaire, du même genre que le par-habitant juste en dessous — et elle se
  // lit comme lui, en euros, comme une somme qu'on tient dans la main.
  if (VALEURS_UNITAIRES.has(id ?? "")) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(sansZeroNegatif(valeur, 0));
  }
  // Le par-habitant est l'exception, et une seule ligne le porte : le
  // récapitulatif de la fiche. Un ratio en millions d'euros — « 0,00 M€ par
  // habitant » — n'aurait aucun sens ; il se lit en euros, comme une somme
  // qu'on tient dans la main.
  if (parHabitant) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(sansZeroNegatif(valeur, 0));
  }
  return millions(valeur);
}
