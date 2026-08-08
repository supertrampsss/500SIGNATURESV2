/**
 * Les phrases chiffrées d'un bilan de mandat.
 *
 * La barre latérale alignait vingt mesures et laissait le lecteur seul devant :
 * « 369 M€ » ne dit pas si c'est beaucoup, « +25,5 % » ne dit pas si c'est plus
 * que les prix. Ce module écrit les quelques phrases que ces nombres portent, et
 * rien d'autre.
 *
 * Quatre règles gouvernent tout ce qui sort d'ici :
 *
 * 1. **Aucun adjectif non calculable.** « Explosé », « dérive », « inquiétant »
 *    sont des jugements déguisés en constats : deux lecteurs ne mettent pas le
 *    même seuil derrière. On écrit le chiffre et son cadre — « +63,7 % quand les
 *    prix ont monté de 16,1 % » — et le lecteur conclut.
 * 2. **Aucune faute nommée.** Une variation est un écart, pas une erreur. Une
 *    dépense qui monte peut payer une compétence transférée, une école ouverte
 *    ou un contrat d'énergie renouvelé ; les comptes ne disent pas lequel, donc
 *    les phrases non plus.
 * 3. **Le cadre voyage avec le chiffre.** Une masse en euros courants sur six
 *    ans est d'abord une histoire de prix et de population. Les deux sont
 *    nommés dans la phrase quand ils sont connus, jamais supposés quand ils
 *    manquent.
 * 4. **Une série incomplète n'écrit rien.** Il faut la valeur à l'exercice de
 *    référence *et* à l'exercice de fin. Un trou ne se comble pas par
 *    l'exercice voisin : ce serait comparer deux fenêtres sous un seul titre.
 *
 * Les règles sont une **table de gabarits** : chaque ligne déclare la série
 * qu'elle lit, le sujet dont elle relève, ce qu'une hausse dit des comptes, et
 * les deux formes de sa phrase. Le moteur, lui, ne connaît aucun indicateur —
 * il calcule les mêmes faits pour toutes les lignes et applique les mêmes
 * seuils. Ajouter un indicateur, c'est ajouter une ligne.
 */

import type { Mandat } from "./mandat.ts";
import { montant } from "./pont.ts";

/** Espace fine insécable : la typographie française avant une unité. */
const FINE = " ";

/** Les recettes qui font tourner les services : le dénominateur commun. */
const RECETTES = "ofgl_recettes_fonctionnement";

export type Phrase = {
  /** Le texte, déjà écrit, sans balise. */
  texte: string;
  /** Ce que ça dit des finances : « tend » (dégrade), « detend » (améliore),
   *  « neutre ». Sert à colorer la puce, jamais à juger la politique. */
  sens: "tend" | "detend" | "neutre";
  /** L'identifiant d'indicateur vers lequel la phrase renvoie. */
  vers: string;
  /** Poids de saillance, pour trier et pour choisir le titre du récit. */
  saillance: number;
};

export type Contexte = {
  mandat: Mandat;
  series: Record<string, Record<string, number>>;
  /** Inflation cumulée en % sur la fenêtre du mandat, ou null si inconnue. */
  inflation: number | null;
  /** Variation de population en % sur la même fenêtre, ou null. */
  population: number | null;
  /** Nom du territoire, pour les phrases qui le nomment. */
  nom: string;
};

type Sens = Phrase["sens"];

/**
 * Trois sujets, parce que le lecteur pose trois questions.
 *
 * Qui paie, combien coûte le fonctionnement, et ce qu'on construit avec ce qui
 * reste. Le classement par saillance seul répondait trois fois à la même : à
 * Bordeaux, l'épargne nette, l'encours de dette et les dépenses d'équipement
 * arrivaient en tête et racontaient un unique fait — un investissement financé
 * par l'emprunt — sous trois formulations. Le sujet sert à n'en retenir qu'une
 * à la fois, jusqu'à ce que les autres questions aient eu leur réponse.
 */
type Sujet = "financement" | "exploitation" | "investissement";

const SUJETS: Sujet[] = ["financement", "exploitation", "investissement"];

/**
 * En deçà de quoi une variation ne se commente pas, en % sur toute la fenêtre.
 *
 * La maison ne commente pas les écarts sous 5 % : « à ce niveau, la différence
 * tient au périmètre comptable autant qu'à la réalité » (synthese.ts). Sur six
 * exercices, ce seuil doit doubler : entre l'exercice de référence et le dernier
 * du mandat, une commune a pu changer de régime de TVA, internaliser un service,
 * intégrer une compétence, et chacun de ces retraitements déplace quelques
 * points sans que rien ait bougé sur le terrain. Dix points sur six ans, soit
 * environ 1,6 % par an, est le premier niveau où la variation survit à ces
 * retraitements.
 */
const SEUIL_VARIATION = 10;

/**
 * En deçà de quoi un déplacement de structure ne se commente pas, en points.
 *
 * La part des impôts locaux dans les recettes bouge d'un point ou deux au gré
 * des réformes de fiscalité locale, sans qu'aucune décision locale l'ait voulu :
 * la suppression de la taxe d'habitation a été compensée aux communes par la
 * part départementale de la taxe foncière, avec un coefficient correcteur qui ne
 * tombe jamais juste.
 *
 * Le seuil a été **mesuré**, pas choisi : sur les 534 communes de la Gironde,
 * la part des impôts locaux dans les recettes de fonctionnement se déplace de
 * +4,7 points en médiane entre 2019 et 2025, et 65 % des communes dépassent
 * trois points. À trois points, la phrase décrivait donc la réforme nationale
 * dans deux communes sur trois, en la faisant passer pour une inflexion locale.
 * Huit points est le troisième quartile de cette même mesure : au-delà, le
 * déplacement excède ce que la réforme produit chez la moitié des communes, et
 * la phrase redevient un fait propre au territoire.
 */
const SEUIL_POINTS = 8;

/** Les faits calculés d'une ligne, tels que ses deux formulations les lisent. */
type Faits = {
  /** Le territoire, préposition comprise : « À Bordeaux », « Au Havre ». */
  lieu: string;
  /** L'exercice de référence, celui d'avant le mandat. */
  reference: string;
  /** Le dernier exercice du mandat. */
  arrivee: string;
  /** La valeur à la référence : un montant, ou une part en % si `ratio`. */
  debut: number;
  /** La même à l'arrivée. */
  fin: number;
  /** Variation en % pour un niveau, écart en points pour une part. */
  ecart: number;
  inflation: number | null;
  population: number | null;
  /** La valeur d'une série à un exercice, pour les clauses facultatives. */
  valeur: (id: string, exercice: string) => number | null;
};

type Gabarit = {
  /** L'identifiant d'indicateur lu, et celui vers lequel la phrase renvoie. */
  vers: string;
  sujet: Sujet;
  /** Quand il est là, la ligne mesure une **part** de cette série, en points. */
  ratio?: string;
  /** Ce qu'une hausse dit des comptes de la collectivité. */
  sensHausse: Sens;
  /** La forme autonome nomme-t-elle déjà les prix et la population ? */
  cadre: boolean;
  /** La phrase. `autonome` porte les millésimes et le cadre ; la forme brève
   *  s'appuie sur une phrase précédente qui les a déjà posés. */
  texte: (f: Faits, autonome: boolean) => string;
  /** La même chose en titre, sans point final. */
  titre: (f: Faits) => string;
};

/** « 5 » -> « 5,0 » : une décimale partout, pour que deux phrases voisines
 *  s'alignent au lieu d'alterner « 25,5 % » et « 26 % ». */
function nombre(valeur: number, decimales = 1): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valeur);
}

/** « +25,5 % ». Le signe moins typographique, pas le trait d'union du clavier. */
function variation(valeur: number): string {
  return `${valeur >= 0 ? "+" : "−"}${nombre(Math.abs(valeur))}${FINE}%`;
}

/** « 60,9 % » : une part n'a pas de signe, elle a un niveau. */
function part(valeur: number): string {
  return `${nombre(valeur)}${FINE}%`;
}

/** « +5,4 points ». */
function points(valeur: number): string {
  const absolu = Math.abs(valeur);
  return `${valeur >= 0 ? "+" : "−"}${nombre(absolu)} point${absolu >= 2 ? "s" : ""}`;
}

/** « augmenté » / « reculé » : le verbe suit le signe, et rien d'autre. */
function sensDuVerbe(ecart: number, hausse: string, baisse: string): string {
  return ecart >= 0 ? hausse : baisse;
}

/**
 * Le nom du territoire précédé de sa préposition.
 *
 * « À Le Havre » et « À Les Sables-d'Olonne » ne s'écrivent pas. L'article
 * fait partie du nom officiel dans le répertoire des communes, et il se
 * contracte : au, aux. Les autres articles ne se contractent pas — « À La
 * Rochelle », « À L'Haÿ-les-Roses » sont corrects tels quels.
 */
function aLieu(nom: string): string {
  if (nom.startsWith("Le ")) return `Au ${nom.slice(3)}`;
  if (nom.startsWith("Les ")) return `Aux ${nom.slice(4)}`;
  return `À ${nom}`;
}

/** « quand les prix ont monté de 16,1 % et la population de 5,0 % ». */
function cadre(f: Faits): string {
  if (f.inflation === null) return "";
  const prix = `quand les prix ont monté de ${part(f.inflation)}`;
  if (f.population === null) return `, ${prix}`;
  const mouvement = f.population >= 0 ? "et la population de" : "et la population reculé de";
  return `, ${prix} ${mouvement} ${part(Math.abs(f.population))}`;
}

/** « de 294,1 M€ en 2019 à 369,0 M€ en 2025 », ou sans les millésimes quand
 *  une phrase précédente les a posés. */
function trajet(f: Faits, autonome: boolean): string {
  return autonome
    ? `de ${montant(f.debut)} en ${f.reference} à ${montant(f.fin)} en ${f.arrivee}`
    : `de ${montant(f.debut)} à ${montant(f.fin)}`;
}

/**
 * La table des gabarits.
 *
 * Chaque ligne est une phrase possible et rien de plus : elle ne décide ni de
 * son seuil, ni de son rang, ni de son ordre. Les traductions y sont écrites en
 * toutes lettres — « épargne nette » ne veut rien dire hors d'une direction
 * financière, « ce qui reste une fois les charges et le remboursement de la
 * dette payés » se comprend partout.
 */
const GABARITS: Gabarit[] = [
  {
    // La part des impôts locaux dans les recettes de fonctionnement : la seule
    // ligne qui dise **qui** paie plutôt que **combien** est payé.
    vers: "ofgl_impots_locaux",
    sujet: "financement",
    ratio: RECETTES,
    // Une recette fiscale en hausse renforce les comptes et pèse sur celui qui
    // la paie. Colorer la puce trancherait entre les deux ; le site ne tranche
    // pas, il donne les deux chiffres.
    sensHausse: "neutre",
    cadre: false,
    texte: (f, autonome) => {
      const masse = f.valeur(RECETTES, f.arrivee);
      const deplaces =
        masse === null ? "" : `, soit ${montant((Math.abs(f.ecart) / 100) * masse)} `
          + `${f.ecart >= 0 ? "de plus" : "de moins"} qu'au poids qu'ils avaient avant le mandat`;
      return (
        `Les impôts locaux couvrent ${part(f.fin)} des recettes de fonctionnement`
        + `${autonome ? ` en ${f.arrivee}` : ""}, contre ${part(f.debut)} en ${f.reference} : `
        + `${points(f.ecart)}${deplaces}.`
      );
    },
    // Descriptif, et rien de plus. « Le financement s'est déplacé vers le
    // contribuable local » énoncerait une cause locale là où la réforme de la
    // fiscalité de 2021 déplace déjà la part de plusieurs points partout : le
    // titre dit ce que montrent les comptes, pas qui l'a décidé.
    titre: (f) =>
      `${f.lieu}, les impôts locaux financent ${part(f.fin)} du budget,`
      + ` contre ${part(f.debut)} avant le mandat`,
  },
  {
    vers: "ofgl_depenses_fonctionnement",
    sujet: "exploitation",
    sensHausse: "tend",
    cadre: true,
    texte: (f, autonome) =>
      `Les dépenses de fonctionnement, ce que la collectivité paie chaque année pour`
      + ` faire tourner ses services, passent ${trajet(f, autonome)}, soit`
      + ` ${variation(f.ecart)}${autonome ? cadre(f) : ""}.`,
    titre: (f) =>
      `${f.lieu}, les dépenses de fonctionnement ont ${sensDuVerbe(f.ecart, "augmenté", "reculé")}`
      + ` de ${part(Math.abs(f.ecart))} sur le mandat`,
  },
  {
    vers: "ofgl_frais_personnel",
    sujet: "exploitation",
    sensHausse: "tend",
    cadre: true,
    texte: (f, autonome) => {
      const depensesFin = f.valeur("ofgl_depenses_fonctionnement", f.arrivee);
      const depensesDebut = f.valeur("ofgl_depenses_fonctionnement", f.reference);
      const poids =
        depensesFin === null || depensesDebut === null || depensesFin <= 0 || depensesDebut <= 0
          ? ""
          : ` ; ils pèsent ${part((f.fin / depensesFin) * 100)} des dépenses de fonctionnement`
            + `, contre ${part((f.debut / depensesDebut) * 100)} en ${f.reference}`;
      return (
        `Les frais de personnel passent ${trajet(f, autonome)}, soit`
        + ` ${variation(f.ecart)}${autonome ? cadre(f) : ""}${poids}.`
      );
    },
    titre: (f) =>
      `${f.lieu}, les frais de personnel ont ${sensDuVerbe(f.ecart, "augmenté", "reculé")}`
      + ` de ${part(Math.abs(f.ecart))} sur le mandat`,
  },
  {
    vers: "ofgl_impots_locaux",
    sujet: "financement",
    sensHausse: "neutre",
    cadre: true,
    // Le total encaissé ne se décompose pas ici : la publication ne sépare pas
    // ce qui vient des taux votés de ce qui vient des bases et du nombre de
    // contribuables. La phrase le dit plutôt que de laisser conclure.
    texte: (f, autonome) =>
      `Ce que les impôts locaux rapportent passe ${trajet(f, autonome)}, soit`
      + ` ${variation(f.ecart)}${autonome ? cadre(f) : ""} ; ce total ne dit pas ce qui vient`
      + ` des taux votés et ce qui vient du nombre de contribuables.`,
    titre: (f) =>
      `${f.lieu}, ce que les impôts locaux rapportent a`
      + ` ${sensDuVerbe(f.ecart, "augmenté", "reculé")} de ${part(Math.abs(f.ecart))} sur le mandat`,
  },
  {
    vers: "ofgl_encours_dette",
    sujet: "investissement",
    sensHausse: "tend",
    cadre: true,
    texte: (f, autonome) => {
      const epargneFin = f.valeur("ofgl_epargne_brute", f.arrivee);
      const epargneDebut = f.valeur("ofgl_epargne_brute", f.reference);
      // Sans épargne, il n'y a pas de durée de remboursement : ce n'est pas un
      // remboursement infiniment long, c'est un remboursement impossible à ce
      // rythme. La clause disparaît plutôt que d'afficher un nombre.
      const delai =
        epargneFin === null || epargneFin <= 0 || epargneDebut === null || epargneDebut <= 0
          ? ""
          : ` ; au rythme de ce que la collectivité met de côté chaque année, il faudrait`
            + ` ${nombre(f.fin / epargneFin)}${FINE}ans pour la rembourser, contre`
            + ` ${nombre(f.debut / epargneDebut)}${FINE}ans en ${f.reference}`;
      return (
        `L'encours de dette passe ${trajet(f, autonome)}, soit`
        + ` ${variation(f.ecart)}${autonome ? cadre(f) : ""}${delai}.`
      );
    },
    titre: (f) =>
      `${f.lieu}, l'encours de dette a ${sensDuVerbe(f.ecart, "augmenté", "reculé")}`
      + ` de ${part(Math.abs(f.ecart))} sur le mandat`,
  },
  {
    vers: "ofgl_depenses_d_equipement",
    sujet: "investissement",
    // Investir n'améliore ni ne dégrade les comptes : c'est un choix, dont le
    // financement se lit dans la dette et l'épargne, pas ici.
    sensHausse: "neutre",
    cadre: true,
    texte: (f, autonome) =>
      `Les dépenses d'équipement, les travaux et les achats durables de l'année, passent`
      + ` ${trajet(f, autonome)}, soit ${variation(f.ecart)}${autonome ? cadre(f) : ""} ;`
      + ` une année d'investissement ne résume pas le mandat.`,
    titre: (f) =>
      `${f.lieu}, les dépenses d'équipement de l'année ont`
      + ` ${sensDuVerbe(f.ecart, "augmenté", "reculé")} de ${part(Math.abs(f.ecart))} depuis`
      + ` ${f.reference}`,
  },
  {
    vers: "ofgl_epargne_nette",
    sujet: "investissement",
    sensHausse: "detend",
    cadre: true,
    texte: (f, autonome) =>
      `Ce qui reste une fois les charges et le remboursement de la dette payés, et qui`
      + ` finance les investissements sans emprunter, passe ${trajet(f, autonome)}, soit`
      + ` ${variation(f.ecart)}${autonome ? cadre(f) : ""}.`,
    titre: (f) =>
      `${f.lieu}, ce qui reste pour investir sans emprunter a`
      + ` ${sensDuVerbe(f.ecart, "augmenté", "reculé")} de ${part(Math.abs(f.ecart))} sur le mandat`,
  },
  {
    vers: "ofgl_dotation_globale_de_fonctionnement",
    sujet: "financement",
    sensHausse: "detend",
    cadre: true,
    texte: (f, autonome) => {
      // Une dotation quasi stable en euros courants a perdu le prix de six ans
      // d'inflation : c'est le fait, et il ne se voit pas dans « −2,2 % ».
      const reel =
        f.inflation === null
          ? ""
          : ` ; une fois les prix pris en compte, elle a`
            + ` ${sensDuVerbe(pouvoirDAchat(f), "gagné", "perdu")}`
            + ` ${part(Math.abs(pouvoirDAchat(f)))} de pouvoir d'achat`;
      return (
        `La dotation versée par l'État passe ${trajet(f, autonome)}, soit`
        + ` ${variation(f.ecart)}${reel}.`
      );
    },
    titre: (f) =>
      f.inflation === null
        ? `${f.lieu}, la dotation versée par l'État a`
          + ` ${sensDuVerbe(f.ecart, "augmenté", "reculé")} de ${part(Math.abs(f.ecart))}`
        : `${f.lieu}, la dotation versée par l'État a`
          + ` ${sensDuVerbe(pouvoirDAchat(f), "gagné", "perdu")}`
          + ` ${part(Math.abs(pouvoirDAchat(f)))} de pouvoir d'achat sur le mandat`,
  },
];

/** La variation une fois les prix retirés, en %. */
function pouvoirDAchat(f: Faits): number {
  return ((1 + f.ecart / 100) / (1 + (f.inflation ?? 0) / 100) - 1) * 100;
}

/** L'inverse d'un sens : ce qu'une baisse dit quand la hausse disait ceci. */
function inverse(sens: Sens): Sens {
  if (sens === "tend") return "detend";
  if (sens === "detend") return "tend";
  return "neutre";
}

/** Un fait retenu : la phrase pour la barre latérale, et le titre pour le récit. */
export type Fait = Phrase & {
  /** Le titre que cette règle écrirait, sans point final. */
  titre: string;
  /** La forme brève, pour une phrase qui en suit une autre. */
  bref: string;
  sujet: Sujet;
  /** La forme autonome nomme-t-elle déjà les prix et la population ? */
  cadre: boolean;
};

/**
 * Ce qu'une évolution mécanique aurait donné, en %.
 *
 * Une commune qui gagne 5 % d'habitants pendant que les prix montent de 16,1 %
 * dépense 21,9 % de plus sans avoir rien décidé. C'est ce niveau-là que les
 * phrases donnent à voir, et c'est lui qui sert à trier : une variation qui s'y
 * colle n'apprend rien, une variation qui s'en écarte est le fait du mandat.
 */
function evolutionNeutre(contexte: Contexte): number {
  const prix = 1 + (contexte.inflation ?? 0) / 100;
  const habitants = 1 + (contexte.population ?? 0) / 100;
  return (prix * habitants - 1) * 100;
}

/**
 * Les faits que les séries publiées permettent d'écrire, les plus saillants
 * d'abord.
 *
 * La saillance se mesure en **euros déplacés par rapport à l'évolution
 * mécanique**, rapportés à une année de recettes de fonctionnement : c'est la
 * seule unité qui mette sur le même plan une ligne de 400 M€ et une ligne de
 * 14 M€, sans que la première gagne d'avance et sans qu'une variation
 * impressionnante sur une masse minuscule prenne la tête d'une fiche.
 *
 * L'encours de dette est un solde de bilan et non un flux de l'année ; le
 * rapporter aux recettes annuelles n'en fait pas un flux pour autant, c'est le
 * ratio dette sur recettes que tout le monde emploie, et le nombre ne sort
 * jamais d'ici : il ne sert qu'à ranger des phrases.
 *
 * Quand les recettes ne sont pas publiées, toutes les règles basculent ensemble
 * sur l'écart en points : l'échelle change, l'ordre reste comparable au sein
 * d'une même fiche.
 */
export function faits(contexte: Contexte): Fait[] {
  const { mandat } = contexte;
  if (!mandat.exerciceFin || !mandat.exerciceReference) return [];
  const neutre = evolutionNeutre(contexte);
  const valeur = (id: string, exercice: string): number | null => {
    const v = contexte.series[id]?.[exercice];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const recettes = valeur(RECETTES, mandat.exerciceFin);

  const retenus: Fait[] = [];
  for (const gabarit of GABARITS) {
    const brutDebut = valeur(gabarit.vers, mandat.exerciceReference);
    const brutFin = valeur(gabarit.vers, mandat.exerciceFin);
    if (brutDebut === null || brutFin === null) continue;

    let debut = brutDebut;
    let fin = brutFin;
    let ecart: number;
    let attendu = neutre;
    if (gabarit.ratio) {
      const denDebut = valeur(gabarit.ratio, mandat.exerciceReference);
      const denFin = valeur(gabarit.ratio, mandat.exerciceFin);
      if (denDebut === null || denFin === null || denDebut <= 0 || denFin <= 0) continue;
      debut = (brutDebut / denDebut) * 100;
      fin = (brutFin / denFin) * 100;
      ecart = fin - debut;
      // Une part n'a pas d'inflation : elle ne se compare qu'à elle-même.
      attendu = 0;
      if (Math.abs(ecart) < SEUIL_POINTS) continue;
    } else {
      // Une grandeur nulle ou négative au départ n'a pas de variation en
      // pourcentage : une épargne nette qui passe de −2 à −1 M€ s'améliore, et
      // « +50 % » dirait le contraire. Ces cas ne produisent pas de phrase.
      if (debut <= 0) continue;
      ecart = ((fin - debut) / debut) * 100;
      // Deux façons d'être remarquable : bouger beaucoup, ou s'écarter beaucoup
      // de ce que les prix et la population imposaient. Une dotation stable en
      // euros courants relève du second cas et vaut d'être dite.
      if (Math.max(Math.abs(ecart), Math.abs(ecart - attendu)) < SEUIL_VARIATION) continue;
    }

    const f: Faits = {
      lieu: aLieu(contexte.nom),
      reference: mandat.exerciceReference,
      arrivee: mandat.exerciceFin,
      debut,
      fin,
      ecart,
      inflation: contexte.inflation,
      population: contexte.population,
      valeur,
    };

    // Les euros que la ligne a déplacés par rapport à l'évolution mécanique.
    const deplaces = gabarit.ratio
      ? (Math.abs(ecart) / 100) * (recettes ?? 0)
      : Math.abs(brutFin - brutDebut * (1 + attendu / 100));
    // Toutes les règles se pèsent à la même aune. Un rang qui ferait passer
    // « qui paie » avant « combien » était un arbitrage éditorial, et la mesure
    // l'a condamné : le déplacement de structure est majoritairement l'effet
    // d'une réforme nationale, il n'a pas à commander le titre.
    const saillance =
      recettes !== null && recettes > 0
        ? (deplaces / recettes) * 100
        : Math.abs(ecart - attendu);

    retenus.push({
      texte: gabarit.texte(f, true),
      bref: gabarit.texte(f, false),
      titre: gabarit.titre(f),
      sens: ecart >= 0 ? gabarit.sensHausse : inverse(gabarit.sensHausse),
      vers: gabarit.vers,
      saillance,
      sujet: gabarit.sujet,
      cadre: gabarit.cadre,
    });
  }
  return retenus.sort((a, b) => b.saillance - a.saillance);
}

/**
 * Au plus deux faits par sujet, trois sujets : six phrases.
 *
 * La barre latérale n'a pas été jugée trop longue, elle a été jugée illisible —
 * « y'a trop d'infos on sait pas quoi en faire ». Six phrases qui répondent à
 * trois questions valent mieux que six qui répondent trois fois à la même.
 */
const PHRASES_PAR_DEFAUT = 6;

/**
 * Les faits retenus, un sujet après l'autre.
 *
 * Un tour donne la parole au meilleur fait de chaque sujet, dans l'ordre de
 * saillance ; le tour suivant reprend là où il s'est arrêté. Ainsi « qui paie »,
 * « combien coûte le fonctionnement » et « ce qu'on construit » sont tous servis
 * avant qu'un sujet parle deux fois.
 */
function tourAtour(candidats: Fait[], maximum: number): Fait[] {
  const restants = new Map(SUJETS.map((s) => [s, candidats.filter((f) => f.sujet === s)]));
  const choisis: Fait[] = [];
  while (choisis.length < maximum) {
    const tour = SUJETS.map((s) => restants.get(s)?.shift()).filter((f): f is Fait => !!f);
    if (!tour.length) break;
    for (const fait of tour.sort((a, b) => b.saillance - a.saillance)) {
      if (choisis.length < maximum) choisis.push(fait);
    }
  }
  return choisis;
}

/** Les faits retenus pour la fiche, diversifiés puis reclassés par saillance. */
export function faitsRetenus(contexte: Contexte, maximum = PHRASES_PAR_DEFAUT): Fait[] {
  return tourAtour(faits(contexte), maximum).sort((a, b) => b.saillance - a.saillance);
}

/** Au plus `maximum` phrases, les plus saillantes d'abord. */
export function verdict(contexte: Contexte, maximum = PHRASES_PAR_DEFAUT): Phrase[] {
  return faitsRetenus(contexte, maximum).map((f) => ({
    texte: f.texte,
    sens: f.sens,
    vers: f.vers,
    saillance: f.saillance,
  }));
}
