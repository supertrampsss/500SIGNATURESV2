/**
 * Les quatre blocs qui ouvrent une fiche, sous les repères.
 *
 * Les repères posent quatre nombres : ce qui entre, ce qui sort, ce qui reste,
 * ce qui est dû. Ils ne disent pas **d'où vient le mouvement**, et c'est la
 * seule chose qu'aucune carte, aucun tableau et aucune puce ne montrent.
 *
 * Trois règles tiennent le module.
 *
 * **On décompose la variation, pas le stock.** « +25,5 % » est un résumé ;
 * « sur 74,9 M€ de hausse, 39,5 viennent des salaires » est une explication. Un
 * bloc pose donc le niveau, puis l'écart depuis l'exercice de référence, puis à
 * qui cet écart revient.
 *
 * **Une décomposition n'est écrite que si `provenance.ts` l'accepte**, c'est-à-
 * dire si les composantes somment au total aux deux exercices. Le refus est la
 * réponse par défaut, et il est silencieux : à la maille France, aucun des
 * indicateurs nationaux ne déclare de parent, les blocs y tiennent donc en une
 * phrase et n'écrivent pas qu'il leur manque quelque chose.
 *
 * **Le poste se dit en français, pas en nomenclature.** « Frais de personnel »
 * est exact et n'appelle aucune image ; « les salaires de ses agents » se lit.
 * Le terme comptable reste, sous le curseur, dans l'infobulle — c'est lui qu'on
 * retrouvera dans le tableau déplié et dans le fichier publié.
 */

import type { Indicateur } from "./donnees.ts";
import { millions } from "./echelle.ts";
import { provenance, type Part } from "./provenance.ts";
import { OUVERTURE } from "./reperes.ts";
import { accentuer } from "./traductions.ts";

export type Bloc = {
  /** Le titre, en Spectral, plus gros et plus foncé que son texte. */
  titre: string;
  /** Le corps, déjà en HTML : le gras y porte le montant, la part, le poste. */
  texte: string;
  /** Les indicateurs que le bloc a dits. Rien d'autre sur la fiche ne les redit. */
  cites: string[];
};

export type Entree = {
  niveau: string;
  nom: string;
  series: Record<string, Record<string, number>>;
  /** Les indicateurs de la maille, pour décomposer. Sans lui, aucun bloc ne
   *  décompose : ils n'inventent jamais une hiérarchie qu'ils n'ont pas lue. */
  catalogue: Indicateur[];
};

/**
 * Les agrégats de chaque maille, et la phrase qui ouvre le premier bloc.
 *
 * Les trois échelons locaux lisent les mêmes séries OFGL ; l'État a les
 * siennes, et son budget général ne « fait pas tourner des services » — il paie
 * aussi la dette, les pensions et ce qu'il reverse. La phrase change donc avec
 * la maille, les agrégats aussi, et rien d'autre.
 */
type Comptes = {
  depenses: string;
  recettes: string;
  /**
   * Le sujet de la première phrase.
   *
   * Une commune se pose sans article — « Bordeaux dépense » — et c'est la seule
   * maille où le nom le permette. « Gironde dépense » n'existe pas, et l'article
   * d'un département ne se déduit d'aucun nom : le Rhône, la Gironde, les
   * Landes, le Val-d'Oise. Les autres mailles prennent donc leur maille pour
   * sujet, ce qui est vrai partout et faux nulle part.
   */
  sujet: (nom: string) => string;
  /** Ce que ce budget paie : « pour faire tourner ses services » ne vaut pas
   *  pour un budget d'État, qui paie aussi la dette et ce qu'il reverse. */
  emploi: string;
  /** Le nom sous lequel les phrases reprennent le territoire : « la ville ». */
  beneficiaire?: string;
  epargne?: string;
  dette?: string;
  investissement?: string;
  concours?: string;
};

const OFGL = {
  depenses: "ofgl_depenses_fonctionnement",
  recettes: "ofgl_recettes_fonctionnement",
  emploi: "pour faire tourner ses services",
  epargne: "ofgl_epargne_brute",
  dette: "ofgl_encours_dette",
  investissement: "ofgl_depenses_d_investissement_hors_remb",
  concours: "ofgl_concours_de_l_etat",
} as const;

const COMPTES: Record<string, Comptes> = {
  commune: { ...OFGL, sujet: (nom) => nom, beneficiaire: "la ville" },
  departement: { ...OFGL, sujet: () => "Le département", beneficiaire: "le département" },
  region: { ...OFGL, sujet: () => "La région", beneficiaire: "la région" },
  pays: {
    depenses: "etat_depenses_nettes_bg",
    recettes: "etat_recettes_nettes_bg",
    sujet: () => "L'État",
    emploi: "sur son budget général",
  },
};

/**
 * Les postes, tels qu'une phrase les nomme.
 *
 * `provenance.ts` pose le poste nu — « Frais de personnel +39,5 M€ » — parce
 * qu'il ne peut pas deviner le genre et le nombre de soixante-dix intitulés de
 * source. Une phrase, elle, a besoin de l'article et de l'accord : la table les
 * porte pour les postes que les blocs peuvent nommer, et un poste absent de la
 * table n'est pas nommé du tout.
 */
const POSTES: Record<string, { nom: string; pluriel: boolean }> = {
  // Ce que le fonctionnement paie.
  ofgl_frais_personnel: { nom: "les salaires de ses agents", pluriel: true },
  ofgl_achats_et_charges_externes: { nom: "les achats, l'énergie et les prestataires", pluriel: true },
  ofgl_depenses_d_intervention: { nom: "les aides et subventions versées", pluriel: true },
  ofgl_charges_financieres: { nom: "les intérêts de la dette", pluriel: true },
  ofgl_travaux_en_regie: { nom: "les travaux faits en interne", pluriel: true },
  ofgl_autres_depenses_de_fonctionnement: { nom: "les autres dépenses de fonctionnement", pluriel: true },
  // Ce qui paie.
  ofgl_impots_et_taxes: { nom: "les impôts et taxes", pluriel: true },
  ofgl_impots_locaux: { nom: "la taxe foncière et les impôts des entreprises", pluriel: true },
  ofgl_autres_impots_et_taxes: { nom: "les autres impôts et taxes", pluriel: true },
  ofgl_fiscalite_reversee: { nom: "la fiscalité partagée avec l'intercommunalité", pluriel: false },
  ofgl_cvae: { nom: "la cotisation des entreprises sur la valeur ajoutée", pluriel: false },
  ofgl_concours_de_l_etat: { nom: "ce que l'État lui verse", pluriel: false },
  // « la dotation principale de l'État » dans une phrase qui vient d'écrire
  // « ce que l'État verse » écrivait l'État deux fois. C'est le seul endroit
  // d'où cette ligne peut être nommée, et le contexte y porte déjà l'État.
  ofgl_dotation_globale_de_fonctionnement: { nom: "la dotation principale", pluriel: false },
  ofgl_perequations_et_compensations_fiscales: { nom: "les compensations et la solidarité entre collectivités", pluriel: true },
  ofgl_autres_dotations_de_fonctionnement: { nom: "les autres dotations de l'État", pluriel: true },
  ofgl_ventes_de_biens_et_services: { nom: "ce que paient les usagers des services", pluriel: false },
  ofgl_subventions_recues_et_participations: { nom: "les subventions et participations reçues", pluriel: true },
  ofgl_autres_recettes_de_fonctionnement: { nom: "les autres recettes de fonctionnement", pluriel: true },
  // Ce que l'investissement achète.
  ofgl_depenses_d_equipement: { nom: "les dépenses d'équipement", pluriel: true },
  ofgl_subventions_d_equipement_versees: { nom: "les subventions d'équipement versées", pluriel: true },
  ofgl_autres_depenses_d_investissement: { nom: "les autres dépenses d'investissement", pluriel: true },
};

/** Un poste et sa formulation, ou rien : un poste que la table ne nomme pas ne
 *  se dit pas, plutôt que de sortir en nomenclature au milieu d'une phrase. */
type Poste = { id: string; nom: string; pluriel: boolean; terme: string; debut: number; fin: number; delta: number };

export function blocs(entree: Entree): Bloc[] {
  const comptes = COMPTES[entree.niveau];
  if (!comptes) return [];
  const cadre = { ...entree, comptes, terme: termes(entree.catalogue) };
  return [ouVaLArgent, quiPaie, ceQuIlReste, ceQueCaAPaye]
    .map((ecrire) => ecrire(cadre))
    .filter((bloc): bloc is Bloc => bloc !== null);
}

type Cadre = Entree & { comptes: Comptes; terme: (id: string) => string };

/* ---------------------------------------------------------------------------
 * Les quatre blocs.
 * ------------------------------------------------------------------------- */

/** « Le train de vie » : ce que coûte le fonctionnement, et d'où vient sa hausse.
 *
 *  Le titre ne nomme plus l'objet comptable mais la chose : les quatre repères
 *  en tête de fiche disent déjà « Ce qu'elle dépense », et « Où va l'argent »
 *  n'en était que le second nom. */
function ouVaLArgent(cadre: Cadre): Bloc | null {
  const { depenses, sujet, emploi } = cadre.comptes;
  const total = mesure(cadre.series, depenses);
  if (!total) return null;
  const phrases = [
    `${echapper(sujet(cadre.nom))} dépense ${gras(millions(total.fin))} par an ${emploi}${ecart(total)}.`,
  ];
  const cites = [depenses];

  const moteurs = partsDuMouvement(cadre, depenses, total)
    .slice(0, 3)
    .map((part) => poste(cadre, part))
    .filter((nomme): nomme is Poste => nomme !== null);
  const tete = moteurs[0];
  if (tete && total.delta !== null) {
    cites.push(tete.id);
    const passe = tete.pluriel ? "passent" : "passe";
    const trajet = `de ${sansSigle(tete.debut)} à ${millions(tete.fin)}`;
    const rapport = Math.abs(tete.delta) / Math.abs(total.delta);
    // Un poste peut bouger de plus que son total, quand d'autres vont en sens
    // inverse : à Ambérieu-en-Bugey, les achats reculent de 0,5 M€ pendant que
    // le fonctionnement ne baisse que de 0,02. « 3 010 % de cette baisse » est
    // juste et ne se lit pas ; la phrase dit alors le trajet, et dit pourquoi.
    phrases.push(
      rapport > 1
        ? `${capitale(gras(nommer(tete)))} ${passe} ${trajet}${poidsDit(tete.fin / total.fin)}, quand d'autres postes ${
            total.delta > 0 ? "reculent" : "augmentent"
          }.`
        : `${capitale(partDite(rapport))} de cette ${
            total.delta > 0 ? "augmentation" : "baisse"
          } tient ${gras(nommer(tete, a(tete.nom)))}, qui ${passe} ${trajet}${
            poidsDit(tete.fin / total.fin)
          }.`,
    );
  }
  // Un poste qui ne porte pas un vingtième du mouvement est un détail du
  // tableau déplié : « les autres dépenses de fonctionnement (+0,00 M€) » ne
  // répond à aucune question.
  const suite = tete && total.delta !== null
    ? moteurs.slice(1, 3).filter((p) => Math.abs(p.delta) >= Math.abs(total.delta!) * SEUIL_POSTE)
    : [];
  if (suite.length) {
    cites.push(...suite.map((p) => p.id));
    phrases.push(
      `${suite.length > 1 || suite[0].pluriel ? "Viennent" : "Vient"} ensuite ${suite
        .map((p, rang) => `${rang === 1 ? "puis " : ""}${gras(nommer(p))} (${apport(p.delta)})`)
        .join(", ")}.`,
    );
  }
  return { titre: "Le train de vie", texte: phrases.join(" "), cites };
}

/** « Qui règle l'addition » : d'où viennent les recettes qui ont augmenté, et ce que
 *  l'État verse pendant ce temps. */
function quiPaie(cadre: Cadre): Bloc | null {
  const { recettes, concours } = cadre.comptes;
  const total = mesure(cadre.series, recettes);
  if (!total) return null;
  const cites = [recettes];
  const phrases = [
    total.delta === null
      ? `Les recettes sont de ${gras(millions(total.fin))}.`
      : `Les recettes ${total.delta >= 0 ? "augmentent" : "diminuent"} de ${
          gras(millions(Math.abs(total.delta)))
        }.`,
  ];

  const tete = precise(cadre, partsDuMouvement(cadre, recettes, total)[0], total.arrivee);
  if (tete && total.delta !== null) {
    cites.push(tete.id);
    const apporte = tete.pluriel ? "apportent" : "apporte";
    const rapport = Math.abs(tete.delta) / Math.abs(total.delta);
    // Un poste peut porter plus que le mouvement entier : en Gironde, les
    // impôts et taxes montent de 569,4 M€ quand les recettes n'augmentent que
    // de 226,6, parce que d'autres lignes reculent en face. « 251 % » est
    // arithmétiquement juste et illisible ; la phrase dit alors le montant, et
    // dit pourquoi il dépasse.
    phrases.push(
      rapport > 1
        ? `${capitale(gras(nommer(tete)))} ${apporte} ${
            gras(`${millions(Math.abs(tete.delta))} de plus`)
          } qu'en ${OUVERTURE}, quand d'autres recettes reculent.`
        : `${capitale(gras(nommer(tete)))} en ${apporte} ${gras(part(rapport))}, soit ${
            millions(Math.abs(tete.delta))
          }.`,
    );
  }

  // Quand le concours de l'État est déjà le poste qui porte la hausse, la
  // clause qui suit le redirait mot pour mot : à Curgies, « ce que l'État lui
  // verse en apporte 59 % » puis « ce que l'État verse à la ville augmente ».
  const dejaDit = tete !== undefined && concours !== undefined
    && (tete.id === concours || descendDe(cadre, tete.id, concours));
  const etat = concours && !dejaDit ? ceQueLEtatVerse(cadre, concours, total) : null;
  if (etat) {
    cites.push(...etat.cites);
    phrases.push(etat.phrase);
  }
  return { titre: "Qui règle l'addition", texte: phrases.join(" "), cites };
}

/** « L'ardoise » : combien d'années d'épargne il faudrait pour rembourser
 *  la dette, aujourd'hui et à l'ouverture de la fenêtre. */
function ceQuIlReste(cadre: Cadre): Bloc | null {
  const { epargne, dette, beneficiaire } = cadre.comptes;
  if (!epargne || !dette || !beneficiaire) return null;
  const e = mesure(cadre.series, epargne);
  const d = mesure(cadre.series, dette);
  // Un rapport dette sur épargne ne se calcule pas quand l'épargne est nulle ou
  // négative : ce n'est pas un remboursement infiniment long, c'est un
  // remboursement impossible à ce rythme (voir `derives.ts`).
  if (!e || !d || e.fin <= 0 || e.arrivee !== d.arrivee) return null;
  const annees = d.fin / e.fin;
  const avant = e.debut !== null && e.debut > 0 && d.debut !== null ? d.debut / e.debut : null;
  return {
    titre: "L'ardoise",
    texte:
      `Il faudrait ${gras(`${annuites(annees)} d'épargne`)} pour rembourser les ${
        gras(millions(d.fin))
      } que ${beneficiaire} doit encore${
        avant === null ? "" : `, contre ${annuites(avant)} en ${OUVERTURE}`
      }.`,
    cites: [epargne, dette],
  };
}

/** « Ce qui sort de terre » : ce que l'investissement de l'année a financé.
 *
 *  C'est la seule distinction qui compte entre les deux colonnes de dépense :
 *  le fonctionnement se consomme, l'investissement reste debout. */
function ceQueCaAPaye(cadre: Cadre): Bloc | null {
  const { investissement, beneficiaire } = cadre.comptes;
  if (!investissement || !beneficiaire) return null;
  const total = mesure(cadre.series, investissement);
  if (!total || total.fin <= 0) return null;
  const cites = [investissement];
  const phrases = [
    `${capitale(beneficiaire)} a investi ${gras(millions(total.fin))} en ${total.arrivee}${
      total.debut === null ? "" : `, contre ${millions(total.debut)} en ${OUVERTURE}`
    }.`,
  ];
  // Ici la question est « ce que ça a payé », pas « d'où vient la hausse » : ce
  // qui compte est ce que l'année a acheté, donc le poids du poste dans le
  // montant, pas sa part du mouvement.
  const gros = plusGrosPoste(cadre, investissement, total.arrivee);
  // Un poste qui fait tout l'investissement ne le décompose pas : « les
  // dépenses d'équipement en font 0,12 M€, soit 100 % » répète le montant que
  // la phrase précédente vient d'écrire.
  if (gros && gros.fin < total.fin * TOUT_LE_MONTANT) {
    cites.push(gros.id);
    phrases.push(
      `${capitale(gras(nommer(gros)))} en ${gros.pluriel ? "font" : "fait"} ${
        gras(millions(gros.fin))
      }, soit ${part(gros.fin / total.fin)}.`,
    );
  }
  return { titre: "Ce qui sort de terre", texte: phrases.join(" "), cites };
}

/**
 * Ce que l'État verse, et sa ligne principale.
 *
 * Le concours de l'État n'est presque jamais assez gros pour compter comme un
 * moteur du mouvement des recettes ; il est pourtant la première question qu'on
 * pose. Il est donc dit pour lui-même, avec sa ligne majeure — la dotation
 * principale — quand elle pèse assez et va dans le même sens. À la région, où
 * la dotation globale a été remplacée par une fraction de TVA et ne vaut plus
 * que quelques milliers d'euros, elle ne pèse pas assez : la phrase s'arrête au
 * concours lui-même.
 */
function ceQueLEtatVerse(
  cadre: Cadre,
  concours: string,
  recettes: Mesure,
): { phrase: string; cites: string[] } | null {
  const total = mesure(cadre.series, concours);
  const beneficiaire = cadre.comptes.beneficiaire;
  if (!total || total.debut === null || total.delta === null) return null;
  if (!beneficiaire || recettes.delta === null || total.delta === 0) return null;
  const contraire = Math.sign(total.delta) !== Math.sign(recettes.delta);
  const ouvre = contraire ? "Pendant ce temps" : "Dans le même temps";
  const verbe = total.delta > 0 ? "augmente" : "diminue";
  const ligne = ligneMajeure(cadre, concours, total);
  if (!ligne) {
    return {
      phrase: `${ouvre}, ce que l'État verse ${a(beneficiaire)} ${verbe}, de ${
        sansSigle(total.debut)
      } à ${gras(millions(total.fin))}.`,
      cites: [concours],
    };
  }
  const bouge = ligne.delta >= 0
    ? (ligne.pluriel ? "progressent" : "progresse")
    : (ligne.pluriel ? "reculent" : "recule");
  return {
    phrase: `${ouvre}, ce que l'État verse ${a(beneficiaire)} ${verbe} : ${
      gras(nommer(ligne))
    } ${bouge} de ${sansSigle(ligne.debut)} à ${gras(millions(ligne.fin))}.`,
    cites: [concours, ligne.id],
  };
}

/* ---------------------------------------------------------------------------
 * Lire les séries et les décomposer.
 * ------------------------------------------------------------------------- */

/** Un agrégat au dernier exercice publié, et son écart depuis l'ouverture. */
type Mesure = { arrivee: string; fin: number; debut: number | null; delta: number | null };

/**
 * La fenêtre est 2019 et le dernier exercice publié, à toutes les mailles. Elle
 * se lit sur les exercices publiés, jamais sur un calendrier électoral.
 */
function mesure(series: Record<string, Record<string, number>>, id: string): Mesure | null {
  const serie = series[id];
  if (!serie) return null;
  const exercices = Object.keys(serie).sort();
  const arrivee = exercices[exercices.length - 1];
  if (arrivee === undefined) return null;
  const debut = arrivee > OUVERTURE ? serie[OUVERTURE] ?? null : null;
  const brut = debut === null ? null : serie[arrivee] - debut;
  // Un écart que le formateur écrit « 0,00 M€ » ne s'écrit pas : « soit
  // 0,00 M€ de moins qu'en 2019 » affirme un mouvement que le nombre nie, et
  // le rapporter à ses composantes donne « 3 010 % de cette baisse ».
  const delta = brut === null || Math.abs(brut) < ECART_MINIMUM ? null : brut;
  return { arrivee, fin: serie[arrivee], debut, delta };
}

/** Le demi-millier d'euros sous lequel `millions` rend « 0,00 M€ ». */
const ECART_MINIMUM = 5_000;

/** La lecture que `provenance.ts` attend. */
function lecture(cadre: Cadre) {
  return (id: string, exercice: string) => cadre.series[id]?.[exercice] ?? null;
}

/**
 * Les postes qui portent le mouvement, le plus gros d'abord, au plus trois.
 *
 * `provenance.ts` s'arrête dès qu'il a expliqué l'essentiel ; ici la phrase en
 * cite jusqu'à trois, parce que le troisième poste d'une hausse de fonctionnement
 * est encore une réponse à « où va l'argent ». Le contrôle de somme reste le
 * sien : sans lui, aucun poste n'est nommé.
 */
function partsDuMouvement(cadre: Cadre, parent: string, total: Mesure): Part[] {
  if (total.delta === null || total.delta === 0) return [];
  const p = provenance(parent, lecture(cadre), OUVERTURE, total.arrivee, cadre.catalogue);
  if (!p) return [];
  const sens = Math.sign(total.delta);
  return p.parts.filter((part) => Math.sign(part.delta) === sens);
}

/**
 * Le poste le plus lourd d'un agrégat, quel que soit son mouvement.
 *
 * Deux blocs ne posent pas la même question. « D'où vient la hausse » classe
 * par variation ; « ce que ça a payé » classe par montant, parce que ce qu'on a
 * acheté cette année ne dépend pas de ce qu'on achetait en 2019.
 */
function plusGrosPoste(cadre: Cadre, parent: string, arrivee: string): Poste | null {
  const p = provenance(parent, lecture(cadre), OUVERTURE, arrivee, cadre.catalogue);
  if (!p) return null;
  const gros = [...p.parts].sort((a, b) => b.fin - a.fin)[0];
  return gros ? poste(cadre, gros) : null;
}

/**
 * Un poste dont le mouvement est presque entièrement celui d'une seule de ses
 * composantes se remplace par elle.
 *
 * « Impôts et taxes +59,0 M€ » nomme un tiroir de nomenclature ; les 58,8 M€ qui
 * l'expliquent sont la taxe foncière et les impôts des entreprises, et c'est ce
 * mot-là que le lecteur cherchait. La descente s'arrête dès qu'aucune composante
 * ne domine, ou dès que `provenance.ts` refuse de décomposer.
 */
function precise(cadre: Cadre, tete: Part | undefined, arrivee: string): Poste | undefined {
  if (!tete) return undefined;
  // La chaîne du plus général au plus précis. Le nom se cherche ensuite depuis
  // le bas : un agrégat que la table sait dire vaut mieux qu'une composante
  // qu'elle ne sait pas nommer.
  const chaine = [tete];
  while (chaine.length <= DESCENTE_MAXIMUM) {
    const courant = chaine[chaine.length - 1];
    const p = provenance(courant.id, lecture(cadre), OUVERTURE, arrivee, cadre.catalogue);
    const dominante = p?.parts.find(
      (part) =>
        Math.sign(part.delta) === Math.sign(courant.delta) &&
        Math.abs(part.delta) >= Math.abs(courant.delta) * PART_DOMINANTE,
    );
    if (!dominante) break;
    chaine.push(dominante);
  }
  for (const part of [...chaine].reverse()) {
    const nomme = poste(cadre, part);
    if (nomme) return nomme;
  }
  return undefined;
}

/** La ligne majeure d'un agrégat : la plus lourde, si elle pèse assez et va
 *  dans le même sens que lui. Sinon la phrase s'en tient à l'agrégat. */
function ligneMajeure(cadre: Cadre, parent: string, total: Mesure): Poste | null {
  if (total.delta === null) return null;
  const p = provenance(parent, lecture(cadre), OUVERTURE, total.arrivee, cadre.catalogue);
  if (!p) return null;
  const majeure = [...p.parts].sort((a, b) => b.fin - a.fin)[0];
  if (!majeure || majeure.fin < total.fin * POIDS_LIGNE_MAJEURE) return null;
  if (Math.sign(majeure.delta) !== Math.sign(total.delta)) return null;
  return poste(cadre, majeure);
}

/** Un agrégat est-il sous un autre, de proche en proche ? La hiérarchie est
 *  celle que la source déclare, jamais une devinette sur les identifiants. */
function descendDe(cadre: Cadre, id: string, ancetre: string): boolean {
  const parents = new Map(cadre.catalogue.map((i) => [i.id, i.parent ?? null]));
  let courant = parents.get(id) ?? null;
  for (let saut = 0; courant && saut < DESCENTE_MAXIMUM; saut += 1) {
    if (courant === ancetre) return true;
    courant = parents.get(courant) ?? null;
  }
  return false;
}

/** Une composante devenue phrase, ou rien si la table ne sait pas la nommer. */
function poste(cadre: Cadre, part: Part): Poste | null {
  const dit = POSTES[part.id];
  if (!dit) return null;
  return { id: part.id, ...dit, terme: cadre.terme(part.id), debut: part.debut, fin: part.fin, delta: part.delta };
}

/** Le libellé de la source, celui qui reste dans l'infobulle et dans le fichier
 *  publié. Accentué : « Concours de l'Etat » est une faute à l'écran. */
function termes(catalogue: Indicateur[]): (id: string) => string {
  const par = new Map(catalogue.map((i) => [i.id, accentuer(i.libelle)]));
  return (id) => par.get(id) ?? "";
}

/** Au-delà, la descente change de sujet plus qu'elle ne précise. */
const DESCENTE_MAXIMUM = 3;

/** Ce qu'une composante doit porter du mouvement de son parent pour le
 *  remplacer : presque tout, sans quoi la précision devient un raccourci. */
const PART_DOMINANTE = 0.9;

/** Ce qu'une ligne doit peser dans son agrégat pour en être « la » ligne. */
const POIDS_LIGNE_MAJEURE = 0.4;

/** En deçà, un poste ne pèse pas assez sur le mouvement pour être cité après
 *  celui qui le porte. */
const SEUIL_POSTE = 0.05;

/** Au-delà, un poste est le montant entier : le nommer ne le décompose plus. */
const TOUT_LE_MONTANT = 0.99;

/* ---------------------------------------------------------------------------
 * Écrire les nombres et les accorder.
 * ------------------------------------------------------------------------- */

/** « , soit 74,9 M€ de plus qu'en 2019 », ou rien quand la fenêtre n'a pas de
 *  borne d'ouverture publiée. */
function ecart(total: Mesure): string {
  if (total.delta === null || total.delta === 0) return "";
  return `, soit ${gras(`${millions(Math.abs(total.delta))} de ${total.delta > 0 ? "plus" : "moins"}`)} qu'en ${OUVERTURE}`;
}

/** « +21,2 M€ », « −0,8 M€ » : le signe est l'information. */
function apport(valeur: number): string {
  return `${valeur >= 0 ? "+" : ""}${millions(valeur)}`;
}

/** Le nombre sans son sigle : « de 143,6 à 183,1 M€ » ne l'écrit qu'une fois. */
function sansSigle(valeur: number): string {
  return millions(valeur).replace(/\s*M€$/u, "");
}

/** Une part, en pourcentage entier : « 90 % », jamais « neuf dixièmes ». */
function part(rapport: number): string {
  return `${Math.round(rapport * 100)} %`;
}

/**
 * La part d'un mouvement, en pourcentage, sauf quand c'est la moitié.
 *
 * « La moitié de cette augmentation » se lit d'un coup là où « 53 % de cette
 * augmentation » demande un arrêt. C'est la seule fraction que le site écrit en
 * toutes lettres : au-delà de l'usage courant, « neuf dixièmes » est plus
 * obscur que « 90 % » et n'a aucune raison d'exister.
 */
function partDite(rapport: number): string {
  return rapport >= 0.45 && rapport < 0.55 ? "la moitié" : part(rapport);
}

/**
 * « : c'est un euro sur deux du budget de fonctionnement », ou rien.
 *
 * La clause ne s'écrit que si le poids tombe vraiment sur une fraction simple :
 * dire « un euro sur trois » d'un poste qui pèse 30 % arrondirait de trois
 * points au profit de la formule. Hors de ces bornes, la phrase s'arrête au
 * montant, qui se suffit.
 */
function poidsDit(poids: number): string {
  for (const [sur, mot] of [[2, "deux"], [3, "trois"], [4, "quatre"]] as const) {
    if (Math.abs(poids - 1 / sur) <= TOLERANCE_FRACTION) {
      return ` : c'est ${gras(`un euro sur ${mot}`)} du budget de fonctionnement`;
    }
  }
  return "";
}

/** Un euro sur deux se dit à un point près, pas à trois. */
const TOLERANCE_FRACTION = 0.01;

/** Une durée en années, à la décimale : « 8,6 années », « 0,4 année ». Le
 *  pluriel commence à deux, comme partout en français. */
function annuites(annees: number): string {
  const dit = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(annees);
  return `${dit} ${annees < 2 ? "année" : "années"}`;
}

/**
 * « à » suivi d'un article se contracte, et se distribue sur une énumération.
 *
 * « aux achats, l'énergie et les prestataires » n'est pas du français : chaque
 * terme de la liste porte sa préposition, « aux achats, à l'énergie et aux
 * prestataires ». La contraction se lit sur l'article que la table des postes
 * écrit — elle n'est jamais devinée sur un libellé de source, et un terme sans
 * article reste tel quel : « aux aides et subventions versées ».
 */
function a(nom: string): string {
  return nom
    .split(/(, | et )/u)
    .map((morceau, rang) => (rang % 2 === 0 ? contracter(morceau, rang === 0) : morceau))
    .join("");
}

function contracter(terme: string, premier: boolean): string {
  if (terme.startsWith("les ")) return `aux ${terme.slice(4)}`;
  if (terme.startsWith("le ")) return `au ${terme.slice(3)}`;
  if (terme.startsWith("la ") || terme.startsWith("l'")) return `à ${terme}`;
  // Sans article, un terme qui suit est en apposition du précédent et ne porte
  // pas de préposition : « aux aides et subventions versées ». Un terme qui
  // ouvre est une proposition entière, et la prend : « à ce que paient les
  // usagers des services ».
  return premier ? `à ${terme}` : terme;
}

/**
 * La majuscule de début de phrase, posée sur la première lettre du texte.
 *
 * Une phrase commence souvent par du balisage : `<strong><abbr title="Frais de
 * personnel">les salaires…`. Prendre le premier caractère de la chaîne mettait
 * la capitale sur le `s` de `strong`, et rien ne se voyait à l'écran.
 */
function capitale(texte: string): string {
  let fait = false;
  return texte.replace(/(<[^>]*>)|([^<]+)/gu, (bloc, balise, corps) => {
    if (balise || fait) return bloc;
    fait = true;
    return (corps as string).replace(/^./u, (premiere) => premiere.toLocaleUpperCase("fr-FR"));
  });
}

/** Le poste, avec son terme comptable en infobulle. `forme` sert aux positions
 *  où la phrase le décline : « aux salaires de ses agents ». */
function nommer(poste: Poste, forme = poste.nom): string {
  if (!poste.terme) return echapper(forme);
  return `<abbr title="${echapper(poste.terme)}">${echapper(forme)}</abbr>`;
}

/** Le gras porte ce qui fait exister la phrase : le montant, la part, le poste. */
function gras(contenu: string): string {
  return `<strong>${contenu}</strong>`;
}

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Les blocs, rendus.
 *
 * Le titre est en Spectral, plus gros et plus foncé que son texte : il était
 * écrit en petites capitales grises au-dessus d'un paragraphe à l'encre pleine,
 * si bien qu'on lisait la réponse avant la question. Voir `.bloc-lecture`.
 */
export function rendreBlocs(liste: Bloc[]): string {
  if (!liste.length) return "";
  return liste
    .map(
      ({ titre, texte }) => `<section class="bloc-lecture">
      <h3>${echapper(titre)}</h3>
      <p>${texte}</p>
    </section>`,
    )
    .join("");
}
