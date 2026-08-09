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

/** Le taux voté par le conseil municipal, publié par la DGFiP : ce qui, dans
 *  le produit des impôts locaux, relève d'une décision locale. */
const TAUX_FONCIER = "dgfip_taux_tfb_commune";

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

/**
 * Où se tient le territoire parmi ses semblables, pour un indicateur et un
 * exercice — tel que `comparaisons.json` le publie.
 *
 * `valeur` est celle du territoire ramenée à la base sur laquelle les quartiles
 * ont été calculés (le plus souvent par habitant, avec la population de
 * référence de l'OFGL de l'exercice). Comparer autre chose à ces quartiles
 * mettrait deux grandeurs sur un seul axe.
 */
export type Repere = {
  valeur: number;
  q1: number;
  mediane: number;
  q3: number;
  /** Nombre de communes du groupe : « 25 communes semblables » n'a pas le même
   *  poids que « 8 982 ». */
  n: number;
  /** Les critères qui définissent le groupe, à afficher avec le résultat. */
  criteres: string[];
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
  /** Le nom prend-il une préposition ? Vrai pour une commune (« À Bordeaux »),
   *  faux ailleurs : « À Gironde » n'existe pas, et « dans le Rhône » ne se
   *  déduit d'aucun nom. */
  avecPreposition?: boolean;
  /** Le groupe de communes semblables, quand la maille en a un. Absent au
   *  département et à la région : ces mailles n'ont pas de strate publiée, et
   *  les règles y retombent sur les seuils absolus. */
  semblables?: (indicateur: string, exercice: string) => Repere | null;
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
  /** Ce que le groupe de communes semblables a fait sur la même fenêtre, ou
   *  null quand la maille n'a pas de groupe publié. */
  groupe: Groupe | null;
};

/** La bande du groupe où se tient le territoire : les quartiles publiés la
 *  découpent, rien d'autre. */
type Bande = "bas" | "centre" | "haut";

/** Ce que les communes semblables ont fait sur la fenêtre du mandat. */
type Groupe = {
  n: number;
  criteres: string[];
  /** Évolution de la médiane du groupe entre la référence et l'arrivée, en %. */
  evolution: number;
  /** La médiane du groupe à l'arrivée, sur la base des quartiles. */
  mediane: number;
  /** Où se tenait le territoire à la référence, où il se tient à l'arrivée. */
  depart: Bande;
  arrivee: Bande;
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
 *  s'alignent au lieu d'alterner « 25,5 % » et « 26 % ».
 *
 *  Une valeur qui s'arrondit à zéro perd son signe : les impôts locaux d'une
 *  région valent zéro depuis la réforme, et « -0,0 % » se lisait comme un
 *  chiffre négatif minuscule au lieu de rien du tout. */
function nombre(valeur: number, decimales = 1): string {
  const facteur = 10 ** decimales;
  const propre = Math.round(valeur * facteur) === 0 ? 0 : valeur;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
    .format(propre)
    .replace("-", "−");
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
function aLieu(nom: string, avecPreposition = true): string {
  // Hors commune, aucune préposition ne se déduit du nom : on dit « en
  // Gironde » mais « dans le Rhône », « dans les Hauts-de-Seine » mais « à
  // Paris ». Le nom se pose donc seul, en tête de titre — toujours
  // grammatical, et c'est la forme d'un titre de toute façon.
  if (!avecPreposition) return nom;
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
 * Le cadre, ou le groupe quand il existe.
 *
 * Les prix et la population situent un chiffre faute de mieux. Les communes
 * semblables le situent mieux : leur médiane a subi la même inflation, la même
 * réforme de fiscalité et la même conjoncture, et ce qu'il en reste est propre
 * au territoire. Quand le groupe est publié, il remplace donc le cadre — il ne
 * s'y ajoute pas, une phrase ne porte pas deux repères.
 */
function repereDit(f: Faits): string {
  if (!f.groupe) return cadre(f);
  const { n, evolution } = f.groupe;
  const semblables = `${new Intl.NumberFormat("fr-FR").format(n)} commune${n > 1 ? "s" : ""}`;
  const mouvement =
    Math.abs(evolution) < 0.05
      ? "n'ont pas bougé en médiane"
      : `ont ${sensDuVerbe(evolution, "gagné", "perdu")} ${part(Math.abs(evolution))} en médiane`;
  return `, quand ses ${semblables} semblables ${mouvement}${positionDite(f)}`;
}

/** « dans le quart le plus haut de ses semblables », quand le territoire y est.
 *  Une position, pas un classement : le groupe et son effectif sont dits. */
function positionDite(f: Faits): string {
  if (!f.groupe || f.groupe.arrivee === "centre") return "";
  const ou = f.groupe.arrivee === "haut" ? "le plus haut" : "le plus bas";
  return ` ; en ${f.arrivee} la commune est dans le quart ${ou} de son groupe, dont la`
    + ` médiane est à ${montantOuNombre(f.groupe.mediane)}`;
}

/** La médiane d'un groupe est publiée par habitant : elle se lit en euros, pas
 *  en millions. */
function montantOuNombre(valeur: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(valeur)}${FINE}€`
    + " par habitant";
}

/**
 * « quand les concours de l'État, qui la contiennent, passent de 136,5 M€ à
 * 120,7 M€, soit −11,6 % ».
 *
 * Une composante qui s'effondre ne dit pas ce qu'a fait l'ensemble dont elle
 * fait partie. Sur Paris, la dotation globale de fonctionnement tombe de
 * 73,3 M€ à 0,12 M€ — l'écrêtement a fini par dépasser la dotation — tandis que
 * les concours de l'État tiennent à 120,7 M€, les péréquations ayant doublé.
 * Les deux chiffres sont publiés ; n'en écrire qu'un laissait conclure que
 * l'État avait cessé de financer la capitale.
 */
function agregatContenant(f: Faits, id: string, libelle: string): string {
  const debut = f.valeur(id, f.reference);
  const fin = f.valeur(id, f.arrivee);
  if (debut === null || fin === null || debut <= 0) return "";
  return (
    ` ; ${libelle}, qui la contiennent, passent de ${montant(debut)} à ${montant(fin)},`
    + ` soit ${variation(((fin - debut) / debut) * 100)}`
  );
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
      + ` ${variation(f.ecart)}${autonome ? repereDit(f) : ""}.`,
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
        + ` ${variation(f.ecart)}${autonome ? repereDit(f) : ""}${poids}.`
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
    // Le total encaissé monte pour deux raisons qui ne se confondent pas : le
    // taux voté par le conseil, et la matière imposable. Le site publie le
    // premier — c'est le taux communal de taxe foncière — et l'écrire répond à
    // la question que le total pose, là où l'ancienne rédaction se contentait
    // d'annoncer que le total ne la tranchait pas.
    texte: (f, autonome) => {
      const tauxDebut = f.valeur(TAUX_FONCIER, f.reference);
      const tauxFin = f.valeur(TAUX_FONCIER, f.arrivee);
      const vote =
        tauxDebut === null || tauxFin === null
          ? ""
          : ` ; le taux communal de taxe foncière voté est passé de ${part(tauxDebut)} à`
            + ` ${part(tauxFin)}`;
      return (
        `Ce que les impôts locaux rapportent passe ${trajet(f, autonome)}, soit`
        + ` ${variation(f.ecart)}${autonome ? repereDit(f) : ""}${vote}.`
      );
    },
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
        + ` ${variation(f.ecart)}${autonome ? repereDit(f) : ""}${delai}.`
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
      + ` ${trajet(f, autonome)}, soit ${variation(f.ecart)}${autonome ? repereDit(f) : ""}.`,
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
      + ` ${variation(f.ecart)}${autonome ? repereDit(f) : ""}.`,
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
      // **Nommer la DGF, pas « ce que l'État verse ».** Les deux se
      // confondaient, et sur Paris la phrase devenait fausse : la dotation
      // globale de fonctionnement y tombe de 73,3 M€ en 2019 à 0,12 M€ en 2025
      // — l'écrêtement au titre de la contribution au redressement des finances
      // publiques a fini par dépasser la dotation elle-même —, mais les
      // concours de l'État, eux, passent de 136,5 à 120,7 M€ parce que les
      // péréquations et compensations ont doublé. Écrire « la dotation versée
      // par l'État recule de 99,8 % » laissait entendre que l'État avait cessé
      // de financer la capitale. Le chiffre était juste, la phrase mentait.
      return (
        `La dotation globale de fonctionnement passe ${trajet(f, autonome)}, soit`
        + ` ${variation(f.ecart)}${reel}`
        + `${agregatContenant(f, "ofgl_concours_de_l_etat", "les concours de l'État")}.`
      );
    },
    titre: (f) =>
      f.inflation === null
        ? `${f.lieu}, la dotation globale de fonctionnement a`
          + ` ${sensDuVerbe(f.ecart, "augmenté", "reculé")} de ${part(Math.abs(f.ecart))}`
        : `${f.lieu}, la dotation globale de fonctionnement a`
          + ` ${sensDuVerbe(pouvoirDAchat(f), "gagné", "perdu")}`
          + ` ${part(Math.abs(pouvoirDAchat(f)))} de pouvoir d'achat sur le mandat`,
  },
];

/** Dans quelle bande du groupe se tient le territoire : les quartiles publiés
 *  la découpent, aucun seuil de notre main. */
function bandeDe(repere: Repere): Bande {
  if (repere.valeur < repere.q1) return "bas";
  if (repere.valeur > repere.q3) return "haut";
  return "centre";
}

/**
 * Ce fait sort-il du lot ?
 *
 * Deux façons de sortir, l'une et l'autre lues dans les quartiles publiés du
 * groupe et dans rien d'autre : se tenir hors de l'interquartile à l'arrivée —
 * dans le quart le plus haut ou le plus bas de ses semblables — ou avoir changé
 * de quart pendant le mandat. Aucun seuil n'est choisi ici : c'est la
 * dispersion du groupe qui fixe la barre, et elle n'est pas la même d'un
 * indicateur à l'autre.
 *
 * Le seuil absolu qu'elle remplace ne pouvait pas faire ce travail. Mesuré sur
 * les 534 communes de la Gironde entre 2019 et 2025, l'écart d'une commune à
 * l'évolution médiane de son groupe vaut 10 points en médiane sur les dépenses
 * de fonctionnement et 75 sur les dépenses d'équipement : une barre unique
 * laissait passer toutes les secondes et retenait presque aucune des premières.
 * La règle des quarts retient 60 % des couples commune×règle et ne laisse que
 * deux communes sur 534 sans aucun fait à raconter.
 */
function sortDuLot(groupe: Groupe): boolean {
  return groupe.arrivee !== "centre" || groupe.arrivee !== groupe.depart;
}

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
  const groupeDe = (indicateur: string): Groupe | null => {
    const depart = contexte.semblables?.(indicateur, mandat.exerciceReference!);
    const arrivee = contexte.semblables?.(indicateur, mandat.exerciceFin!);
    if (!depart || !arrivee || depart.mediane <= 0 || depart.valeur <= 0) return null;
    return {
      n: arrivee.n,
      criteres: arrivee.criteres,
      evolution: (arrivee.mediane / depart.mediane - 1) * 100,
      mediane: arrivee.mediane,
      depart: bandeDe(depart),
      arrivee: bandeDe(arrivee),
    };
  };

  const retenus: Fait[] = [];
  for (const gabarit of GABARITS) {
    const brutDebut = valeur(gabarit.vers, mandat.exerciceReference);
    const brutFin = valeur(gabarit.vers, mandat.exerciceFin);
    if (brutDebut === null || brutFin === null) continue;

    let debut = brutDebut;
    let fin = brutFin;
    let ecart: number;
    let attendu = neutre;
    // Le groupe ne sert pas les règles de structure : une part de recettes n'a
    // pas de quartiles publiés, et il n'y a rien à comparer.
    const groupe = gabarit.ratio ? null : groupeDe(gabarit.vers);
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
      if (groupe) {
        // Le groupe a subi la même inflation, la même réforme et la même
        // conjoncture : ce qu'il a fait est l'attendu, et la démographie propre
        // au territoire s'y ajoute puisque la médiane est publiée par habitant.
        attendu =
          ((1 + groupe.evolution / 100) * (1 + (contexte.population ?? 0) / 100) - 1) * 100;
        if (!sortDuLot(groupe)) continue;
      } else if (Math.max(Math.abs(ecart), Math.abs(ecart - attendu)) < SEUIL_VARIATION) {
        // Sans groupe — département, région — la barre reste absolue : bouger
        // beaucoup, ou s'écarter de ce que les prix et la population imposaient.
        continue;
      }
    }

    const f: Faits = {
      lieu: aLieu(contexte.nom, contexte.avecPreposition !== false),
      reference: mandat.exerciceReference,
      arrivee: mandat.exerciceFin,
      debut,
      fin,
      ecart,
      inflation: contexte.inflation,
      population: contexte.population,
      valeur,
      groupe,
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
  // **Le cadre une fois, pas à chaque puce.** Chaque phrase autonome se termine
  // par « quand les prix ont monté de 16,1 % et la population de 5,0 % ». Écrite
  // une fois, cette queue situe le chiffre ; écrite quatre fois de suite, elle
  // fait de la liste entière un gabarit — quatre lignes bâties à l'identique,
  // dont l'œil ne retient plus que la répétition. Les indicateurs et les chiffres
  // étaient pourtant tous différents : c'est la charpente qui se voyait.
  //
  // `recit.ts` applique déjà cette règle à son paragraphe. La liste la reprend :
  // la première phrase pose les millésimes, et le cadre revient à la première
  // qui sache le porter — une part de recettes n'a pas d'inflation à nommer, une
  // masse en euros courants, si.
  let cadreDit = false;
  return faitsRetenus(contexte, maximum).map((f, rang) => {
    const autonome = rang === 0 || (!cadreDit && f.cadre);
    if (autonome && f.cadre) cadreDit = true;
    return {
      texte: autonome ? f.texte : f.bref,
      sens: f.sens,
      vers: f.vers,
      saillance: f.saillance,
    };
  });
}
