/**
 * L'atelier : tous les budgets sur une seule page, un seul plan, un seul total.
 *
 * Le simulateur montrait un budget à la fois, choisi dans une barre de
 * pastilles. On ne peut pas se prendre pour le premier ministre en réglant
 * l'État sans voir la Sécurité sociale, ni décider des retraites sans savoir ce
 * qu'on vient de faire à l'impôt sur le revenu. Les budgets se suivent
 * maintenant dans une même page, et les gestes s'additionnent en un total.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CE QUI S'ADDITIONNE ET CE QUI NE S'ADDITIONNE PAS
 * ─────────────────────────────────────────────────────────────────────────
 *
 * **Les budgets ne s'additionnent pas.** Le budget général de l'État porte
 * 594 036 M€ de crédits, les régimes de base 676 925 M€ de charges, et les deux
 * ne font pas 1 271 Md€ : entre eux circulent des transferts que chacun compte
 * de son côté — 8 049 M€ reçus de l'État, 6 900 M€ de cotisations prises en
 * charge par l'État, 91 352 M€ de recettes fiscales affectées. Ce module
 * n'écrit donc **aucun total de dépense publique**, et n'expose aucune fonction
 * qui en produirait un.
 *
 * **Les gestes, eux, s'additionnent.** Un geste est un écart : couper 10 000 M€
 * ici et lever 5 000 M€ là font 15 000 M€ d'effort, et cette somme est exacte
 * parce qu'un écart ne porte aucun périmètre. C'est le seul total que l'atelier
 * calcule, et il s'appelle « votre effort », jamais « le solde ».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEUX BUDGETS QUI SE TOUCHENT BOUGENT ENSEMBLE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les mettre l'un sous l'autre ne suffit pas. Posés côte à côte sans lien, le
 * barème de l'impôt sur le revenu et la ligne « Impôt sur le revenu » des
 * recettes de l'État étaient deux commandes du même impôt : régler l'une ne
 * déplaçait pas l'autre, et l'écran donnait deux réponses à la même question.
 *
 * **Le barème pilote la ligne qu'il calcule.** Un point de barème déplace les
 * 120 191 M€ inscrits au budget de l'État dans la proportion exacte où il
 * déplace le rendement simulé, et la ligne perd sa commande à elle. Le
 * *niveau* ne se transporte pas — 224 507 M€ simulés contre 120 191 M€
 * inscrits, parce que le simulateur ignore quotient familial, décote et
 * réductions — mais la *proportion*, si. C'est elle qu'on transporte.
 *
 * **Un transfert conserve l'euro, pas le pourcentage.** Ce que l'État cesse de
 * verser aux collectivités, les collectivités cessent de le recevoir : l'écart
 * se répartit entre les trois échelons au prorata de ce que chacun reçoit,
 * seule clé que les fichiers publient. Le pourcentage, lui, ne se transporte
 * pas : 44 189 M€ de prélèvements sur recettes côté État ne recouvrent pas les
 * 28 907 M€ de « concours de l'État » que l'OFGL compte côté collectivités.
 *
 * Conséquence, et c'est tout l'intérêt : couper la dotation globale
 * n'améliore rien d'ensemble. L'État gagne, les collectivités perdent autant,
 * et l'effort total ne bouge pas d'un euro.
 *
 * **Ce qui n'a pas de ligne en face reste nommé, faute de mieux.** Les 8 049 M€
 * que la Sécurité sociale reçoit de l'État et les 6 900 M€ de cotisations
 * qu'il prend en charge sont, côté État, dilués dans les crédits de plusieurs
 * missions ; aucun fichier publié ne dit lesquelles. `transferts()` le dit à
 * l'écran plutôt que d'ajuster en douce une ligne choisie au hasard.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * UN JEU DE RÉGLAGES PAR VOLET
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les nomenclatures ne se sont jamais parlé : « 146 » est un programme de la
 * Défense et « D-PRE » un poste de la Sécurité sociale, mais rien ne garantit
 * qu'un code de l'État ne se retrouve pas à l'identique chez les collectivités.
 * Chaque volet garde donc **sa propre table de réglages**, ce qui rend la
 * collision impossible par construction plutôt que par convention de nommage.
 */

import {
  ecartAuReel,
  effectif,
  plan as planDuBudget,
  chercher as chercherDansIndex,
  PREFIXE_RECETTE,
  type Budget,
  type Entree,
  type Index,
  type LignePlan,
  type Reglages,
} from "./simulateur.ts";
import { rendement, type Bareme, type Taux } from "./bareme.ts";

/** Un budget réglable : l'État, une branche, un échelon de collectivités. */
export type VoletBudget = {
  genre: "budget";
  cle: string;
  /** Ce que le titre de section annonce : « Le budget de l'État ». */
  nom: string;
  budget: Budget;
  index: Index;
};

/**
 * Un barème réglable tranche par tranche.
 *
 * Ce n'est pas un budget — ni dépenses, ni recettes, ni solde — mais il produit
 * un écart en euros comme les autres, et c'est à ce titre qu'il entre dans le
 * total. L'assiette simulée est le revenu fiscal de référence du foyer : le
 * niveau ne se compare pas ligne à ligne à l'impôt réellement émis, l'écart si.
 */
export type VoletBareme = {
  genre: "bareme";
  cle: string;
  nom: string;
  bareme: Bareme;
  /**
   * Le barème en vigueur, celui d'où l'on part.
   *
   * La contribution d'un volet est **ce que le lecteur change**, pas l'écart
   * entre le modèle et la réalité. Mesurée contre l'impôt réellement émis, elle
   * vaudrait −91 719 M€ avant le moindre geste : le simulateur n'applique ni
   * quotient familial, ni décote, ni réductions, et cet écart-là est celui de la
   * méthode, pas d'une décision. Mesurée contre le barème de départ, elle vaut
   * zéro tant qu'on n'a touché à rien.
   */
  depart: Taux;
  /**
   * La ligne de recette que ce barème commande, dans un autre volet.
   *
   * Sans elle, l'écran porte deux commandes du même impôt : les tranches ici,
   * un pourcentage là, et rien qui dise laquelle fait foi.
   */
  pilote: { volet: string; code: string };
};

export type Volet = VoletBudget | VoletBareme;

/** L'état de l'atelier : une table de réglages par volet, jamais une seule. */
export type EtatAtelier = {
  budgets: Map<string, Reglages>;
  baremes: Map<string, Taux>;
};

export function etatVide(): EtatAtelier {
  return { budgets: new Map(), baremes: new Map() };
}

/** Les réglages d'un volet, créés à la demande. */
export function reglagesDe(etat: EtatAtelier, volet: VoletBudget): Reglages {
  let table = etat.budgets.get(volet.cle);
  if (!table) {
    table = new Map();
    etat.budgets.set(volet.cle, table);
  }
  return table;
}

/** Les taux réglés d'un barème, initialisés au barème en vigueur : un écran de
 *  départ à zéro ne rapporterait rien et n'apprendrait rien. */
export function tauxDe(etat: EtatAtelier, volet: VoletBareme): Taux {
  let table = etat.baremes.get(volet.cle);
  if (!table) {
    table = new Map(volet.depart);
    etat.baremes.set(volet.cle, table);
  }
  return table;
}

/**
 * Ce qu'un volet apporte au total, en euros. Positif : le solde s'améliore.
 *
 * **Un barème n'apporte rien de son côté** : son effet est déjà dans le budget
 * dont il pilote une recette. Le compter ici le compterait deux fois — une
 * fois sur ses 224 507 M€ simulés, une fois sur les 120 191 M€ inscrits.
 */
export function contribution(
  volet: Volet,
  etat: EtatAtelier,
  volets: readonly Volet[],
): number {
  if (volet.genre !== "budget") return 0;
  return ecartAuReel(volet.budget, reglagesEffectifs(volet, etat, volets));
}

/**
 * **Votre effort**, en euros : la somme des écarts, et rien d'autre.
 *
 * Ce n'est pas un solde. Les soldes votés ne s'additionnent pas ; les écarts,
 * si. Chaque volet garde son propre solde, affiché dans sa section.
 */
export function effort(volets: readonly Volet[], etat: EtatAtelier): number {
  return volets.reduce((somme, volet) => somme + contribution(volet, etat, volets), 0);
}

/** Le nombre de gestes, tous volets confondus. */
export function gestes(volets: readonly Volet[], etat: EtatAtelier): number {
  return volets.reduce(
    (n, volet) =>
      n +
      (volet.genre === "budget"
        ? reglagesDe(etat, volet).size
        : compterTranchesChangees(volet, etat)),
    0,
  );
}

/** Les tranches dont le taux s'écarte du barème en vigueur. Une tranche remise
 *  à sa valeur d'origine n'est pas un geste. */
function compterTranchesChangees(volet: VoletBareme, etat: EtatAtelier): number {
  const taux = tauxDe(etat, volet);
  let n = 0;
  for (const tranche of volet.bareme.tranches) {
    if ((taux.get(tranche.b) ?? 0) !== (volet.depart.get(tranche.b) ?? 0)) n += 1;
  }
  return n;
}

export type LigneAtelier = LignePlan & { volet: VoletBudget; externe: Externe | null };

/**
 * Le plan, tous volets confondus, le geste le plus lourd d'abord.
 *
 * Il liste ce qui bouge, pas ce qu'on a cliqué : la ligne d'impôt sur le revenu
 * que le barème pilote et le concours de l'État qu'une coupe de dotation
 * entraîne y figurent, avec le nom de ce qui les commande.
 */
export function plan(volets: readonly Volet[], etat: EtatAtelier): LigneAtelier[] {
  return volets
    .flatMap((volet) => {
      if (volet.genre !== "budget") return [];
      const venus = externes(volet, etat, volets);
      return planDuBudget(volet.index, reglagesEffectifs(volet, etat, volets)).map((ligne) => ({
        ...ligne,
        volet,
        externe: venus.get(ligne.entree.code) ?? null,
      }));
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export type TrouveAtelier = { entree: Entree; volet: VoletBudget };

/**
 * La recherche traverse les budgets.
 *
 * Chercher « logement » doit trouver l'aide au logement de l'État *et* les
 * prestations de la branche famille : le lecteur cherche un sujet, pas une
 * nomenclature. Les résultats sont répartis entre volets plutôt que pris dans
 * l'ordre, sans quoi les mille lignes de l'État noieraient les trente de la
 * Sécurité sociale.
 */
export function chercher(
  volets: readonly Volet[],
  requete: string,
  parVolet = 6,
): TrouveAtelier[] {
  return volets.flatMap((volet) =>
    volet.genre === "budget"
      ? chercherDansIndex(volet.index, requete, parVolet).map((entree) => ({ entree, volet }))
      : [],
  );
}

/* --------------------------------------------------------------------------
 * Ce qui commande une ligne depuis un autre volet
 * ----------------------------------------------------------------------- */

/** Ce qu'un autre volet impose à une ligne, et de la part de qui. */
export type Externe = {
  /** Points de pourcentage, à ajouter à ce que le lecteur a réglé lui-même. */
  pourcentage: number;
  /** Le volet où aller le régler : la ligne y renvoie. */
  volet: string;
  /** Le groupe nominal que la ligne affiche : « le barème, plus bas », « le
   *  budget de l'État ». Les phrases se construisent autour, à l'écran. */
  dit: string;
  /** Vrai si la ligne n'a plus de commande à elle. Un impôt calculé par un
   *  barème n'a pas aussi un curseur : ce serait deux réponses possibles. */
  exclusif: boolean;
};

/**
 * Un prélèvement qui finance un autre budget.
 *
 * `prefixe` désigne le groupe de recettes du payeur par la nomenclature, pas
 * par son intitulé : le chapitre 31 des recettes de l'État est celui des
 * prélèvements au profit des collectivités territoriales, le 32 celui de
 * l'Union européenne. Un intitulé se réécrit d'un exercice à l'autre, un
 * chapitre non.
 */
type Passage = {
  depuis: string;
  prefixe: string;
  vers: { volet: string; code: string }[];
  dit: string;
};

const PASSAGES: Passage[] = [
  {
    depuis: "etat",
    prefixe: "31",
    vers: [
      { volet: "collectivites-commune", code: `${PREFIXE_RECETTE}ofgl_concours_de_l_etat` },
      { volet: "collectivites-departement", code: `${PREFIXE_RECETTE}ofgl_concours_de_l_etat` },
      { volet: "collectivites-region", code: `${PREFIXE_RECETTE}ofgl_concours_de_l_etat` },
    ],
    dit: "le budget de l'État",
  },
];

/** Ce que le barème fait à la ligne qu'il pilote, en points de pourcentage.
 *  C'est une proportion, jamais un niveau : voir l'en-tête du module. */
export function pourcentagePilote(volet: VoletBareme, etat: EtatAtelier): number {
  const depart = rendement(volet.bareme, volet.depart);
  if (depart === 0) return 0;
  const taux = etat.baremes.get(volet.cle) ?? volet.depart;
  return (rendement(volet.bareme, taux) / depart - 1) * 100;
}

/** Ce que le payeur gagne sur tout un groupe de recettes, en euros. Positif :
 *  il verse moins, donc son solde s'améliore d'autant. */
function gainDuGroupe(volet: VoletBudget, reglages: Reglages, prefixe: string): number {
  const groupe = volet.budget.recettes.find((g) =>
    g.lignes.length > 0 && g.lignes.every((l) => l.c.startsWith(prefixe)),
  );
  if (!groupe) return 0;
  const somme = (table: Reglages) =>
    groupe.lignes.reduce((s, l) => s + effectif(l, table, PREFIXE_RECETTE), 0);
  return groupe.signe * (somme(reglages) - somme(new Map()));
}

/**
 * Les lignes d'un volet que commande un autre volet.
 *
 * Deux sources, et deux arithmétiques différentes : le barème transporte une
 * proportion, un transfert transporte un euro. La clé de répartition d'un
 * transfert est le montant que chaque receveur touche déjà — la seule que les
 * fichiers publient — ce qui donne le même pourcentage à tous les receveurs et
 * conserve l'euro à la somme.
 *
 * Les clés ne dépendent pas des valeurs : une ligne commandée de l'extérieur
 * l'est au repos comme après un geste, à zéro point près. C'est ce qui permet à
 * l'écran de poser son afficheur une fois pour toutes plutôt que d'en faire
 * apparaître un en cours de route.
 */
export function externes(
  volet: VoletBudget,
  etat: EtatAtelier,
  volets: readonly Volet[],
): Map<string, Externe> {
  const table = new Map<string, Externe>();

  for (const autre of volets) {
    if (autre.genre !== "bareme" || autre.pilote.volet !== volet.cle) continue;
    table.set(autre.pilote.code, {
      pourcentage: pourcentagePilote(autre, etat),
      volet: autre.cle,
      dit: "le barème, plus bas",
      exclusif: true,
    });
  }

  for (const transfert of PASSAGES) {
    const recu = transfert.vers.find((l) => l.volet === volet.cle);
    if (!recu) continue;
    const payeur = volets.find((v) => v.cle === transfert.depuis);
    if (!payeur || payeur.genre !== "budget") continue;
    const gain = gainDuGroupe(payeur, reglagesDe(etat, payeur), transfert.prefixe);
    const assiette = transfert.vers.reduce((s, l) => s + baseDeLaLigne(volets, l), 0);
    if (assiette === 0) continue;
    table.set(recu.code, {
      pourcentage: (-100 * gain) / assiette,
      volet: payeur.cle,
      dit: transfert.dit,
      exclusif: false,
    });
  }

  return table;
}

function baseDeLaLigne(
  volets: readonly Volet[],
  ligne: { volet: string; code: string },
): number {
  const volet = volets.find((v) => v.cle === ligne.volet);
  if (!volet || volet.genre !== "budget") return 0;
  return volet.index.get(ligne.code)?.base ?? 0;
}

/**
 * Les réglages d'un volet, ceux du lecteur et ceux qui lui viennent d'ailleurs.
 *
 * C'est cette table-là qui calcule et qui s'affiche. Une ligne pilotée perd le
 * réglage propre du lecteur — elle n'a pas de commande — les autres l'ajoutent
 * au pourcentage venu d'en face.
 */
export function reglagesEffectifs(
  volet: VoletBudget,
  etat: EtatAtelier,
  volets: readonly Volet[],
): Reglages {
  const propres = reglagesDe(etat, volet);
  const venus = externes(volet, etat, volets);
  if (venus.size === 0) return propres;
  const table = new Map(propres);
  for (const [code, externe] of venus) {
    const propre = externe.exclusif ? 0 : (propres.get(code) ?? 0);
    const valeur = propre + externe.pourcentage;
    if (valeur === 0) table.delete(code);
    else table.set(code, valeur);
  }
  return table;
}

/* --------------------------------------------------------------------------
 * Les transferts que personne ne peut propager
 * ----------------------------------------------------------------------- */

/**
 * Les gestes dont la contrepartie ne peut pas être propagée.
 *
 * Les prélèvements sur recettes au profit des collectivités, eux, se propagent
 * — voir `PASSAGES`. Ce qui reste ici n'a pas de ligne en face : les 8 049 M€
 * que la Sécurité sociale reçoit de l'État et les 6 900 M€ de cotisations
 * qu'il prend en charge sont, côté État, dilués dans les crédits de plusieurs
 * missions, et aucun fichier publié ne dit lesquelles. Choisir laquelle
 * encaisse la coupe serait décider à la place du lecteur ; l'écran le dit.
 */
const SANS_CONTREPARTIE: Record<string, { dit: string }> = {
  "rR-TRF-ETA": { dit: "le budget de l'État" },
  "rR-COT-ETA": { dit: "le budget de l'État" },
};

export type Transfert = { libelle: string; dit: string; volet: string };

/** Les gestes posés sur une ligne dont la contrepartie reste à faire. */
export function transferts(volets: readonly Volet[], etat: EtatAtelier): Transfert[] {
  const trouves: Transfert[] = [];
  for (const volet of volets) {
    if (volet.genre !== "budget") continue;
    for (const code of reglagesDe(etat, volet).keys()) {
      const sans = SANS_CONTREPARTIE[code];
      if (!sans) continue;
      const entree = volet.index.get(code);
      if (entree) trouves.push({ libelle: entree.libelle, dit: sans.dit, volet: volet.cle });
    }
  }
  return trouves;
}

/* --------------------------------------------------------------------------
 * L'état dans l'adresse
 * ----------------------------------------------------------------------- */

const SEPARATEUR_VOLET = "/";

/**
 * `etat/146:-20,vieillesse/D-PRE:-5,ir/11294:45`
 *
 * La clé du volet précède le code, séparée par une barre oblique : sans elle,
 * deux nomenclatures qui partagent un code régleraient la même ligne dans deux
 * budgets. Les anciens liens, qui ne portaient pas de volet, ne règlent donc
 * plus rien — un lien partagé avant ce changement ouvre un atelier vierge
 * plutôt qu'un budget réglé au hasard.
 */
export function encoder(volets: readonly Volet[], etat: EtatAtelier): string {
  return volets
    .flatMap((volet) => {
      if (volet.genre === "budget") {
        return [...reglagesDe(etat, volet)].map(
          ([code, valeur]) => `${volet.cle}${SEPARATEUR_VOLET}${code}:${valeur}`,
        );
      }
      // **Seulement les tranches déplacées.** La table d'un barème part pleine,
      // au barème en vigueur : l'encoder telle quelle mettait ses vingt-cinq
      // tranches dans l'adresse, et « Copier le lien » rendait 1 400 signes
      // pour un geste. Une tranche remise à sa valeur d'origine sort du lien,
      // et une tranche ramenée à zéro y entre — c'est le départ qui fait foi,
      // pas la présence dans la table.
      const taux = tauxDe(etat, volet);
      return volet.bareme.tranches.flatMap((tranche) => {
        const valeur = taux.get(tranche.b) ?? 0;
        if (valeur === (volet.depart.get(tranche.b) ?? 0)) return [];
        return [`${volet.cle}${SEPARATEUR_VOLET}${tranche.b}:${valeur}`];
      });
    })
    .join(",");
}

export function decoder(chaine: string, volets: readonly Volet[]): EtatAtelier {
  const etat = etatVide();
  const parCle = new Map(volets.map((volet) => [volet.cle, volet]));
  for (const morceau of chaine.split(",")) {
    const barre = morceau.indexOf(SEPARATEUR_VOLET);
    const separateur = morceau.lastIndexOf(":");
    if (barre < 0 || separateur < barre) continue;
    const volet = parCle.get(morceau.slice(0, barre));
    if (!volet) continue;
    const code = morceau.slice(barre + 1, separateur);
    const valeur = Number(morceau.slice(separateur + 1));
    if (!Number.isFinite(valeur)) continue;
    // Zéro n'est pas un réglage dans un budget — « réglé à 0 % » et « pas
    // réglé » y sont la même chose. Dans un barème, si : une tranche mise à
    // zéro s'écarte du barème en vigueur, et c'est un geste.
    if (volet.genre === "budget") {
      if (valeur !== 0 && volet.index.has(code)) reglagesDe(etat, volet).set(code, borner(valeur));
    } else {
      const borne = Number(code);
      if (volet.bareme.tranches.some((t) => t.b === borne)) {
        const table = tauxDe(etat, volet);
        const taux = Math.max(0, Math.min(100, valeur));
        // La table d'un barème ne garde pas les zéros : « pas de taux » et
        // « taux nul » y sont la même chose, et c'est le départ qui dit si
        // c'était un geste.
        if (taux === 0) table.delete(borne);
        else table.set(borne, taux);
      }
    }
  }
  return etat;
}

function borner(valeur: number): number {
  return Math.max(-100, Math.min(100, Math.round(valeur)));
}
