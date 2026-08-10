/**
 * Fiche territoire. Règle du produit (docs/04) : un chiffre ne s'affiche jamais
 * seul. Il porte son unité, son millésime, son dénominateur quand c'est un
 * ratio, et il est accompagné de sa source, de sa méthode et de ses limites.
 */

import type {
  AgregatsNationaux,
  Indicateur,
  Jeu,
  Quartiles,
  SubventionsCommune,
  Territoire,
} from "./donnees.ts";
import { formater, millions, parHabitantAUnSens, populationDeReference, pourcentage } from "./echelle.ts";
import {
  dernierPas,
  evolution,
  rendu as rendreSerie,
  ruptureDePerimetre,
} from "./serie.ts";
import { rendu as rendreAssociations } from "./associations.ts";
import { enEurosConstants } from "./euros-constants.ts";
import { rendu as rendreFeuilleDImpots } from "./feuille-impots.ts";
import { repartir, type Question } from "./fiche-questions.ts";
import {
  calendrierDe,
  fenetreRacontee,
  mandatEnCours,
  mandatRaconte,
  type Mandat,
} from "./mandat.ts";
import { rendu as rendrePont } from "./pont.ts";
import { rendu as rendreRatios } from "./ratios.ts";
import { recit, type Recit } from "./recit.ts";
import { provenanceSeule } from "./provenance.ts";
import { verdict, type Contexte, type Phrase, type Repere } from "./verdict.ts";
import { reperes, type References } from "./reference.ts";
import { traduire } from "./traductions.ts";
import {
  compteEcarts, lecture, memeSens, resumeEcarts, synthese,
} from "./synthese.ts";

const NIVEAUX: Record<string, string> = {
  commune: "Commune",
  // Paris, Lyon et Marseille n'existent que par arrondissement dans certaines
  // sources — la carte des loyers de l'ANIL, par exemple, dont les codes 75056,
  // 69123 et 13055 sont absents. Sans intitulé, leur fiche s'ouvrait sur le nom
  // technique de la maille.
  arrondissement_municipal: "Arrondissement municipal",
  departement: "Département",
  region: "Région",
  pays: "Niveau national",
};

/**
 * Échappement pur, sans DOM.
 *
 * La version précédente passait par `document.createElement`, ce qui avait deux
 * conséquences. Elle rendait ce module intestable hors navigateur — les
 * fonctions de rendu de ce fichier sont pourtant des fonctions pures, et c'est
 * ainsi que le reste du site les teste. Et `textContent` vers `innerHTML`
 * n'échappe pas les guillemets, alors qu'`echapper` est interpolé ici dans un
 * attribut `title="…"` : le motif est faux même si les valeurs qui y passent
 * aujourd'hui sont des millésimes. `questions.ts` et `conjoncture.ts`
 * échappaient déjà ainsi.
 */
function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Jeux dont la maille supérieure est une **collectivité**, pas un territoire.
 *
 * L'Observatoire des finances locales publie sous le code « 33 » le budget du
 * conseil départemental de la Gironde, pas la somme des communes qui s'y
 * trouvent. Comparer une commune à « son département » y confronte donc deux
 * collectivités qui n'exercent pas les mêmes compétences : les collèges, la
 * voirie départementale et le RSA ne sont pas payés par la même. C'est
 * exactement ce que le panneau de comparabilité interdit par ailleurs — et
 * c'est ainsi que l'épargne brute d'une commune se retrouvait « + 2 530 % » au
 * regard d'un conseil départemental dont l'épargne s'était effondrée.
 *
 * Le repère juste existe déjà pour ces jeux : la médiane des communes de la
 * région et de France, qui compare bien des communes à des communes. Il en va
 * de même des taux d'imposition, votés par chaque collectivité pour elle-même.
 */
const JEUX_COLLECTIVITE = new Set([
  "ofgl-communes",
  "ofgl-dotations-communes",
  "dgfip-fiscalite-particuliers",
]);

/**
 * Les jeux dont la commune est celle d'un siège, pas celle où l'argent agit.
 *
 * Les subventions de l'État aux associations sont imputées à l'adresse de
 * l'établissement bénéficiaire : une fédération nationale est comptée là où
 * elle a son siège, quelle que soit la commune où son action se mène. Paris
 * porte à ce titre 3 230 M€, soit 32,5 % du total, et les dix premières
 * communes 43,5 % — la fiche du jeu l'écrit déjà.
 *
 * Une carte qui dit où sont les sièges se lit. Un **écart à la médiane des
 * autres communes**, lui, ne se lit pas : il présente une adresse
 * administrative comme une intensité de financement. Bordeaux affichait ainsi
 * « +3 460 % au-dessus de la médiane des communes de la région », qui ne
 * mesure ni ce que reçoivent les Bordelais ni ce que l'État y dépense. C'est
 * exactement la comparaison sans contrôle de périmètre que ce site s'interdit.
 *
 * Le chiffre reste publié et la série reste tracée : c'est la comparaison
 * territoriale qui tombe, pas la donnée.
 */
const JEUX_AU_SIEGE = new Set(["plf-2023-effort-associations"]);

/**
 * Peut-on comparer ce chiffre à celui d'un territoire qui contient le nôtre ?
 *
 * Trois conditions, toutes nécessaires :
 *
 * 1. **La grandeur doit être normalisée.** Un volume — 130 cambriolages,
 *    65 000 habitants, 12 écoles — rapporté à son département donnera toujours
 *    un écart massivement négatif : il ne dit que la différence de taille.
 *    Seuls les taux, médianes, pourcentages et montants par habitant se
 *    comparent d'une maille à l'autre.
 * 2. **Les deux mailles doivent mesurer la même chose** : un territoire de part
 *    et d'autre, pas un territoire face à une collectivité.
 * 3. **Le chiffre doit porter sur le territoire, et non sur une adresse qui
 *    s'y trouve.** Un montant imputé au siège du bénéficiaire décrit une
 *    domiciliation, pas le territoire.
 */
function comparableAuxParents(indicateur: Indicateur, ratio: boolean): boolean {
  return (
    (ratio || indicateur.sommable === false) &&
    !JEUX_COLLECTIVITE.has(indicateur.jeu) &&
    !JEUX_AU_SIEGE.has(indicateur.jeu)
  );
}

/** Un chiffre imputé au siège ne se compare à rien de territorial — ni aux
 *  mailles qui contiennent la nôtre, ni à la médiane des autres communes, ni
 *  par sa densité. Les trois diraient la même chose de faux. */
export function comparableAuxAutresTerritoires(indicateur: Indicateur): boolean {
  return !JEUX_AU_SIEGE.has(indicateur.jeu);
}

/** Ce qu'il y a à dire d'un indicateur pour un territoire, calculé une seule
 *  fois : la valeur, sa période, sa série et ses points de comparaison. La
 *  ligne détaillée, la synthèse d'ouverture et le résumé d'un thème lisent tous
 *  ce même objet — c'est ce qui garantit qu'ils ne se contredisent pas. */
type Mesure = {
  periode: string;
  valeur: number;
  brut: number;
  ratio: boolean;
  denom: { valeur: number | null; exercice: string | null };
  /** La série telle qu'elle s'affiche (par habitant si c'est un ratio). */
  suivie: Record<string, number>;
  /** La même série en montants bruts. */
  brute: Record<string, number>;
  comparaisons: { libelle: string; valeur: number }[];
  /** Les valeurs publiées pour les mailles supérieures : « son département »,
   *  « sa région », « la France ». */
  parents: { libelle: string; valeur: number }[];
  /** Les médianes, avec le nom de leur ensemble : elles s'écrivent « la moitié
   *  des communes de la région sont en dessous de 756 € » plutôt qu'en
   *  vocabulaire de statisticien. */
  medianes: { ensemble: string; valeur: number }[];
  /** Un effectif rapporté à mille habitants, avec les mêmes densités calculées
   *  pour le département et la région. « 31 écoles » ne dit pas si c'est
   *  beaucoup ; « 0,46 école pour 1 000 habitants, 15 % au-dessus de son
   *  département » le dit. C'est la seule comparaison honnête pour un volume :
   *  les effectifs bruts, eux, ne mesurent que la taille du territoire. */
  densite: { valeur: number; comparaisons: { libelle: string; valeur: number }[] } | null;
  /** L'écart retenu pour le résumé du thème : celui de la valeur quand elle se
   *  compare, celui de sa densité sinon. Un seul champ, pour que le résumé ne
   *  choisisse pas lui-même ce qu'il compare. */
  ecart: { reference: string; pourcent: number } | null;
};

/**
 * Ce dont un chiffre est une part, quand aucune comparaison extérieure n'existe.
 *
 * Le budget de l'État et la dette publique n'ont pas d'équivalent européen
 * publié ici : aucun autre pays ne publie « son budget général », et la dette
 * INSEE n'est pas au même millésime que la dette Eurostat. Comparer les deux
 * serait exactement l'erreur que ce site existe pour ne pas commettre.
 *
 * Il reste un repère exact, tiré de la même source et du même exercice : la
 * part dans son total. « 51 600 M€ » ne dit pas grand-chose ; « 11,7 % des
 * dépenses nettes du budget général », si. Le libellé porte sa préposition :
 * « de la dette publique », « des recettes fiscales nettes ».
 *
 * Chaque appartenance ci-dessous a été vérifiée contre les chiffres publiés :
 * les quatre composantes de la dette somment au total à 0,003 % près, et
 * recettes fiscales + non fiscales font exactement les recettes nettes. Les
 * soldes n'y figurent pas — un solde n'est la part de rien — ni les
 * prélèvements sur recettes, dont l'imputation demande une convention
 * comptable que ce site n'a pas à trancher.
 */
const PART_DU_TOTAL: Record<string, { total: string; nom: string }> = {
  // « Ma taxe foncière, ça pèse combien dans ce que la commune encaisse ? »
  // Produits DGFiP rapportés aux recettes de fonctionnement OFGL : deux
  // sources, même exercice, et le périmètre est contrôlé — la somme des
  // produits DGFiP (foncier bâti + CFE + TH résidences secondaires) reste
  // contenue dans les impôts locaux OFGL, à moins de 7 % près sur
  // l'échantillon vérifié (l'écart est le non-bâti et les majorations).
  dgfip_produit_foncier_bati: {
    total: "ofgl_recettes_fonctionnement",
    nom: "des recettes de fonctionnement de la collectivité",
  },
  dgfip_produit_th_residences_secondaires: {
    total: "ofgl_recettes_fonctionnement",
    nom: "des recettes de fonctionnement de la collectivité",
  },
  insee_dette_etat_montant: { total: "insee_dette_apu_montant", nom: "de la dette publique" },
  insee_dette_asso_montant: { total: "insee_dette_apu_montant", nom: "de la dette publique" },
  insee_dette_apul_montant: { total: "insee_dette_apu_montant", nom: "de la dette publique" },
  insee_dette_odac_montant: { total: "insee_dette_apu_montant", nom: "de la dette publique" },
  etat_impot_revenu: { total: "etat_recettes_fiscales", nom: "des recettes fiscales nettes" },
  etat_impot_societes: { total: "etat_recettes_fiscales", nom: "des recettes fiscales nettes" },
  etat_tva: { total: "etat_recettes_fiscales", nom: "des recettes fiscales nettes" },
  etat_ticpe: { total: "etat_recettes_fiscales", nom: "des recettes fiscales nettes" },
  etat_charge_dette: {
    total: "etat_depenses_nettes_bg",
    nom: "des dépenses nettes du budget général",
  },
  etat_depenses_personnel: {
    total: "etat_depenses_nettes_bg",
    nom: "des dépenses nettes du budget général",
  },
  etat_recettes_fiscales: {
    total: "etat_recettes_nettes_bg",
    nom: "des recettes nettes du budget général",
  },
  etat_recettes_non_fiscales: {
    total: "etat_recettes_nettes_bg",
    nom: "des recettes nettes du budget général",
  },
  // Les dix fonctions COFOG dans la dépense publique totale. Vérifié sur
  // l'exercice 2023 : leur somme fait 56,90 % du PIB pour un total publié de
  // 56,9 % — l'identité se ferme au centième de point, ces parts sont exactes.
  // « La défense, c'est 3 % de la dépense publique » est la lecture qu'un
  // pourcentage de PIB seul ne donne pas.
  ...Object.fromEntries(
    [
      "eurostat_fonction_affaires_economiques",
      "eurostat_fonction_defense",
      "eurostat_fonction_enseignement",
      "eurostat_fonction_logement",
      "eurostat_fonction_culture",
      "eurostat_fonction_ordre_securite",
      "eurostat_fonction_environnement",
      "eurostat_fonction_protection_sociale",
      "eurostat_fonction_sante",
      "eurostat_fonction_services_generaux",
    ].map((id) => [
      id,
      { total: "eurostat_depenses_publiques_pib", nom: "de la dépense publique totale" },
    ]),
  ),
};

/** Les indicateurs qui *sont* une population. Leur densité vaut mille pour
 *  mille — « 1 011 pour 1 000 habitants » s'est affiché sous la population
 *  municipale, l'écart entre deux millésimes de la même grandeur habillé en
 *  ratio. Une population ne se rapporte pas à elle-même. */
const POPULATIONS = new Set(["insee_population_municipale", "ofgl_population_reference"]);

/** Les jeux dont les effectifs sont comptés **au lieu de travail**.
 *
 *  La densité « pour 1 000 habitants » suppose que les habitants soient le
 *  dénominateur de la grandeur. C'est vrai des logements, des chômeurs, des
 *  écoles ; c'est faux des postes salariés et des établissements employeurs,
 *  qui sont là où l'on travaille et non là où l'on dort. Bordeaux afficherait
 *  750 postes pour 1 000 habitants, une commune-dortoir voisine 30 : l'écart ne
 *  mesure pas une intensité d'emploi, il mesure la distance domicile-travail, et
 *  la phrase « rapporté à la population » le présenterait comme la première
 *  grandeur. Ces indicateurs restent sommables — c'est le dénominateur qui
 *  n'existe pas, pas l'additivité. */
const JEUX_AU_LIEU_DE_TRAVAIL = new Set(["melodi-flores-a5"]);

/** Les habitants du territoire sont-ils le dénominateur de cet effectif ?
 *
 *  Trois refus, pour trois raisons distinctes : ce qui n'est pas un effectif
 *  (une médiane, un taux) n'a pas de densité ; une population divisée par
 *  elle-même vaut mille pour mille ; et un effectif compté au lieu de travail
 *  n'a pas les résidents pour dénominateur. */
export function densiteRapportableAuxHabitants(indicateur: Indicateur): boolean {
  return (
    indicateur.unite === "count" &&
    !!indicateur.sommable &&
    !POPULATIONS.has(indicateur.id) &&
    !JEUX_AU_LIEU_DE_TRAVAIL.has(indicateur.jeu) &&
    // Quatre refus, donc : les habitants ne sont pas non plus le dénominateur
    // d'un effectif compté à l'adresse d'un siège.
    comparableAuxAutresTerritoires(indicateur)
  );
}

/** Population d'un territoire pour un ratio de densité : celle du millésime
 *  quand elle est publiée, la population légale sinon. */
function population(territoire: Territoire, periode: string): number | null {
  return populationDeReference(territoire, periode).valeur ?? territoire.population ?? null;
}

export function mesurer(
  indicateur: Indicateur,
  territoire: Territoire,
  periodeCarte: string,
  parHabitant: boolean,
  niveau: string,
  toutesReferences: References | null,
  comparateurs: { libelle: string; territoire: Territoire }[],
): Mesure | "absent" | "sans-population" {
  const serie = territoire.series[indicateur.id];
  // **Le dernier exercice publié de cet indicateur-là**, et rien d'autre.
  //
  // La règle était : la période de la carte si l'indicateur la possède, son
  // dernier millésime sinon. Elle contredisait le tableau posé juste en
  // dessous, qui montre toujours les derniers exercices. Sur Bordeaux, la
  // capacité de désendettement s'affichait à 5,1 ans — le ratio de 2021 —
  // au-dessus d'un tableau donnant 8,6 ans en 2025, avec une évolution de
  // −28,8 % qui était celle de 2021 contre 2020. Le bloc entier était
  // cohérent, avec la mauvaise année, et la dette de la ville paraissait
  // nettement plus soutenable qu'elle ne l'est.
  //
  // Rien ne justifiait cette priorité : l'année n'est plus un choix de
  // l'utilisateur depuis la refonte — la carte prend toujours le millésime le
  // plus récent de l'indicateur qu'elle peint. Faire porter cette période
  // d'un indicateur à l'autre ne synchronisait donc rien ; les jeux n'ont pas
  // le même calendrier, le recensement est triennal et les finances locales
  // annuelles.
  const millesimes = serie ? Object.keys(serie).sort() : [];
  const periode = millesimes[millesimes.length - 1];
  const brut = periode === undefined ? undefined : serie?.[periode];
  if (brut === undefined || serie === undefined) return "absent";
  const denom = populationDeReference(territoire, periode);
  const ratio = parHabitant && parHabitantAUnSens(indicateur);
  if (ratio && !denom.valeur) return "sans-population";
  const valeur = ratio ? brut / (denom.valeur as number) : brut;
  // Chaque exercice se divise par SA population, pas par celle d'aujourd'hui :
  // sinon les dépenses de 2022 se lisent rapportées aux habitants de 2025. La
  // courbe partage le dénominateur de la valeur affichée, sans quoi elle
  // raconterait autre chose.
  const suivie = ratio
    ? Object.fromEntries(
        Object.entries(serie).flatMap(([p, v]) => {
          const pop = populationDeReference(territoire, p).valeur;
          return pop ? [[p, v / pop] as [string, number]] : [];
        }),
      )
    : serie;
  // Les points de comparaison, calculés une fois : ils nourrissent la phrase
  // de lecture, les lignes tracées sur la courbe ET le résumé du thème — un
  // seul calcul, donc aucun risque que le texte dise autre chose que le dessin.
  // La valeur du département, de la région, de la France : publiée pour ces
  // mailles, donc disponible même sous secret de diffusion. Elle est lue au
  // même millésime que la valeur affichée, jamais à un autre.
  const parents = (comparableAuxParents(indicateur, ratio) ? comparateurs : []).flatMap((c) => {
    const brutParent = c.territoire.series[indicateur.id]?.[periode];
    if (brutParent === undefined) return [];
    const popParent = populationDeReference(c.territoire, periode).valeur;
    if (ratio && !popParent) return [];
    return [
      { libelle: c.libelle, valeur: ratio ? brutParent / (popParent as number) : brutParent },
    ];
  });
  const medianes = (
    comparableAuxAutresTerritoires(indicateur)
      ? reperes(
          toutesReferences?.[indicateur.id]?.[periode]?.[niveau],
          niveau,
          territoire.region ?? null,
          ratio,
        )
      : []
  ).map((r) => ({ ensemble: r.ensemble, valeur: r.valeur, libelle: r.libelle }));
  const comparaisons = [
    ...parents,
    ...medianes.map((m) => ({ libelle: m.libelle, valeur: m.valeur })),
  ];
  // La densité : pour un effectif, la seule grandeur qui se compare d'une
  // maille à l'autre. Elle n'a de sens que si l'effectif s'additionne — une
  // médiane de revenus « pour 1 000 habitants » ne voudrait rien dire — et
  // jamais pour une population, qui divisée par elle-même donne 1 000 : ce
  // « KPI » s'affichait, et n'était qu'une tautologie.
  const habitants = population(territoire, periode);
  const densite =
    densiteRapportableAuxHabitants(indicateur) && habitants
      ? {
          valeur: (brut / habitants) * 1000,
          comparaisons: comparateurs.flatMap((c) => {
            const brutParent = c.territoire.series[indicateur.id]?.[periode];
            const popParent = population(c.territoire, periode);
            if (brutParent === undefined || !popParent) return [];
            return [{ libelle: c.libelle, valeur: (brutParent / popParent) * 1000 }];
          }),
        }
      : null;
  // L'écart du résumé de thème vient de la valeur elle-même, jamais de sa
  // densité. La sécurité publie chaque phénomène deux fois — « cambriolages »
  // en taux et « cambriolages — nombre de faits » en effectif : compter aussi
  // l'écart de densité du second annoncerait « 12 indicateurs » là où il y a
  // six phénomènes, chacun pesé deux fois. La densité comparée reste affichée
  // sur la mesure, où elle répond à « est-ce beaucoup ? » sans rien compter.
  // De part et d'autre de zéro, l'écart relatif ne veut rien dire — un solde
  // déficitaire n'est pas « trois fois » un solde excédentaire. Il n'entre donc
  // pas dans le décompte du thème : mieux vaut résumer cinq indicateurs que six
  // dont un ment.
  const repere = comparaisons.find((c) => Number.isFinite(c.valeur) && c.valeur !== 0);
  // Le seuil est celui de la fiche entière (FACTEUR_ECART), plus serré que
  // celui des repères de lecture : « Autres dépenses de fonctionnement
  // +7 980 % » ne résumait pas un thème, il disait qu'une médiane régionale
  // est proche de zéro.
  const ecart =
    repere && ecartALEchelle(valeur, repere.valeur)
      ? {
          reference: repere.libelle,
          pourcent: ((valeur - repere.valeur) / Math.abs(repere.valeur)) * 100,
        }
      : null;
  return {
    periode, valeur, brut, ratio, denom, suivie, brute: serie, comparaisons,
    parents, medianes, densite, ecart,
  };
}

/**
 * Une mesure : un nom, un chiffre. Rien d'autre tant qu'on n'a pas demandé.
 *
 * La fiche montrait de tout, tout le temps — courbe, tableau, comparaison,
 * millésime — pour chacun des vingt-six indicateurs. Chaque ajout destiné à
 * rendre la lecture plus immédiate l'a rendue plus lourde : un second
 * pourcentage qu'il fallait démêler du premier, une barre, un libellé de
 * colonne. La densité ne s'obtient pas en comprimant ce qu'on affiche, mais en
 * n'affichant pas ce qu'on n'a pas demandé.
 *
 * Le détail — comparaison, courbe, tableau, source — se déplie sur la ligne
 * qu'on touche, et sur elle seule.
 */
function ligneIndicateur(
  indicateur: Indicateur,
  territoire: Territoire,
  periodeCarte: string,
  parHabitant: boolean,
  niveau: string,
  toutesReferences: References | null,
  /** Cet indicateur est celui peint sur la carte : il se signale d'un mot et
   *  porte le rang du territoire dans la couche. */
  surCarte = false,
  rang?: { position: number; total: number },
  comparateurs: { libelle: string; territoire: Territoire }[] = [],
  /** Cet indicateur a-t-il une couche à peindre ? Seul `main.ts` le sait — il
   *  connaît la maille affichée et les indicateurs reconstitués, qui n'ont pas
   *  de fichier de carte. */
  peintSurCarte?: (indicateur: Indicateur) => boolean,
  /** Le nombre qui accompagne ce taux, quand la source publie les deux. */
  jumeau?: Indicateur,
  /** Ce dont la ligne a besoin en plus d'elle-même : le déflateur national, et
   *  le catalogue pour attribuer sa variation à ses composantes publiées. */
  options?: { inflation?: Record<string, number>; catalogue?: Indicateur[] },
): string {
  const mesure = mesurer(
    indicateur, territoire, periodeCarte, parHabitant, niveau, toutesReferences, comparateurs,
  );
  // Une donnée absente n'écrit rien. « Non publié ici » occupait la place
  // d'un chiffre pour dire qu'il n'y en avait pas, sur des fiches où des
  // dizaines de lignes pouvaient le répéter.
  if (typeof mesure === "string") return "";
  const { periode, valeur, brut, ratio, suivie, brute } = mesure;
  const evenements = indicateur.geographie_courante ? [] : (territoire.evenements ?? []);
  const formate = (v: number) => formater(v, indicateur.unite, ratio);

  // Les comparaisons en français courant, et surtout : en euros.
  //
  // « La moitié des communes de la région sont en dessous de 291 € » se lisait
  // sous chaque ligne, deux fois — région puis France — et n'apprenait rien
  // qu'on puisse discuter. Un rang ne se conteste pas ; une somme, si. La
  // phrase dit donc ce que l'écart **pèse** : « 22,3 M€ de plus que si la
  // commune dépensait comme la médiane des communes de la région ». C'est le
  // même écart, converti dans la seule unité dont le lecteur ait l'usage.
  //
  // Une seule médiane, celle de la région : la seconde disait la même chose sur
  // un ensemble plus lointain, pour deux fois la place.
  const comparaisons = [
    ...mesure.parents.map(
      (c) => `${majuscule(c.libelle)} : ${formate(c.valeur)}.`,
    ),
    ...mesure.medianes.slice(0, 1).map((m) =>
      ecartEnEuros(valeur, m, indicateur, ratio, population(territoire, periode)) ??
      `La moitié des ${m.ensemble} sont en dessous de ${formate(m.valeur)}.`,
    ),
  ];
  if (mesure.densite) {
    const { valeur: densite, comparaisons: voisines } = mesure.densite;
    const repere = voisines.find((c) => Number.isFinite(c.valeur) && c.valeur > 0);
    // Au-delà d'un ordre de grandeur — ou d'un côté à l'autre de zéro — le
    // pourcentage ne compare plus : on pose les deux densités.
    const ecart = repere ? ecartRelatif(densite, repere.valeur) : null;
    comparaisons.unshift(
      `Par habitant : ${densiteLisible(densite)}${
        !repere
          ? ""
          : ecart
            ? ` (${ecart} vs ${repere.libelle})`
            : ` (${repere.libelle} : ${densiteLisible(repere.valeur)})`
      }.`,
    );
  }
  // Retirer les comparaisons laissait la ligne muette : un chiffre seul, sans
  // un mot, se lit comme une comparaison qu'on aurait oublié de faire. La
  // raison du refus vaut mieux que le silence.
  if (!comparableAuxAutresTerritoires(indicateur)) {
    comparaisons.push(
      "Ce montant est imputé à l'adresse du bénéficiaire, pas à la commune où l'action est menée :" +
        " il ne se compare pas d'un territoire à l'autre.",
    );
  }
  // Le nombre derrière le taux, au même millésime. Deux lignes voisines
  // disaient la même chose ; une phrase suffit, et elle nomme ce que la source
  // compte — des infractions, des victimes ou des personnes mises en cause,
  // qui ne s'additionnent pas entre eux.
  const compte = jumeau ? territoire.series[jumeau.id]?.[periode] : undefined;
  if (jumeau && compte !== undefined) {
    if (jumeau.id.endsWith("_credits_votes")) {
      // Un budget voté n'est pas une dépense réalisée : la ligne porte
      // l'exécuté, le voté la rejoint avec son écart d'exécution chiffré.
      const ecart = compte ? ((brut - compte) / Math.abs(compte)) * 100 : null;
      comparaisons.push(
        `Crédits votés : ${formater(compte, indicateur.unite, false)}${
          ecart !== null && Math.abs(ecart) >= 0.05
            ? ` ; exécution ${ecart >= 0 ? "+" : "−"}${pourcentage(Math.abs(ecart))} vs voté`
            : ""
        }.`,
      );
    } else {
      comparaisons.push(
        `En nombre : ${new Intl.NumberFormat("fr-FR").format(Math.round(compte))} ${
          NOM_DU_COMPTE[jumeau.id] ?? jumeau.unite_de_compte ?? "faits"
        } en ${periode}.`,
      );
    }
  }
  // À défaut de comparaison extérieure, la part dans son total : lue au même
  // millésime. Dans la même source elle est exacte par construction ; entre
  // deux sources, elle n'entre dans la table qu'après contrôle du périmètre
  // (voir les impôts locaux DGFiP dans les recettes OFGL).
  const part = PART_DU_TOTAL[indicateur.id];
  const totalPart = part ? territoire.series[part.total]?.[periode] : undefined;
  if (part && totalPart) {
    comparaisons.push(`Soit ${pourcentage((brut / totalPart) * 100)} ${part.nom}.`);
  }
  const evolutionDite = evolution(
    suivie, periode, evenements, false, croissanceAnnuelle(suivie), indicateur.unite,
  );
  // « +20,3 % depuis 2018 » est d'abord une évolution des prix : entre 2018 et
  // 2025, un euro a perdu près d'un cinquième de son pouvoir d'achat. Afficher
  // la hausse nue laisse le lecteur conclure de travers, et toujours dans le
  // même sens.
  const periodes = Object.keys(suivie).sort();
  const rupture = ruptureDePerimetre(evenements, periodes);
  const depart = periodes.find((p) => (rupture ? p >= rupture : true));
  const constants =
    depart && depart !== periode
      ? enEurosConstants(suivie, depart, periode, indicateur.unite, options?.inflation)
      : null;
  const phraseConstants = constants
    ? `<p class="mesure__phrase mesure__constants">Dont ${pourcentage(
        constants.inflation,
      )} de hausse des prix : ${
        constants.reel >= 0 ? "+" : "−"
      }${pourcentage(Math.abs(constants.reel))} en euros constants.</p>`
    : "";
  // Le sens du dernier mouvement, lisible sans rien ouvrir. L'évolution longue
  // reste dans le détail : elle demande de savoir depuis quand, ce qui ne tient
  // pas dans un résumé de ligne.
  //
  // Sur la série **brute**, comme le montant que la ligne affiche : un total qui
  // monte de 2 % pendant que la population monte de 3 % baisse par habitant, et
  // afficher l'un à côté de l'autre ferait deux lectures contradictoires sur la
  // même ligne. Le par-habitant a sa ligne à lui dans le tableau déplié.
  const pas = dernierPas(brute, indicateur.unite, evenements, periode);
  const pastille = pas
    ? `<span class="mesure__pas mesure__pas--${pas.sens}" title="${echapper(
        `de ${pas.depuis} à ${pas.jusqua}`,
      )}">${echapper(pas.texte)}</span>`
    : "";
  // D'où vient ce dernier mouvement, quand la source publie de quoi le dire.
  //
  // La pastille annonce « +12,4 % » et s'arrête là : le lecteur voyait le
  // mouvement sans jamais savoir ce qui l'avait produit, alors que les
  // composantes de l'agrégat sont publiées sur la même fiche. La phrase est
  // calculée sur **la fenêtre de la pastille**, pas sur la série entière —
  // répondre sur une autre période que celle affichée serait pire que se taire.
  // `provenance.ts` refuse dès que la somme des composantes ne redonne pas le
  // total aux deux exercices : la ligne n'écrit alors rien.
  const provenanceDite = pas && options?.catalogue
    ? provenanceSeule(
      indicateur.id,
      (id, exercice) => territoire.series?.[id]?.[exercice] ?? null,
      pas.depuis,
      pas.jusqua,
      options.catalogue,
    )
    : "";

  // La mesure peinte sur la carte s'ouvre d'emblée : c'est celle qu'on regarde,
  // son détail n'a pas à être demandé.
  return `<details class="mesure${surCarte ? " mesure--carte" : ""}" data-mesure="${
    indicateur.id
  }"${surCarte ? " open" : ""}>
    <summary>
      <span class="mesure__nom">${echapper(traduire(indicateur.libelle))}</span>
      <button type="button" class="mesure__info" data-info="${indicateur.id}"
        aria-expanded="false" aria-label="Que mesure cet indicateur ?">i</button>
      <!-- Le **total**, jamais le par-habitant. Un montant divisé par la
           population ne se lit pas seul : « 445 € » pour Bordeaux ne dit ni ce
           que la ville dépense, ni à combien d'habitants c'est rapporté, et se
           compare à un montant d'État sans que rien n'avertisse. Le
           par-habitant reste là où il sert et où il est nommé : la ligne « par
           hab. » du tableau déplié, et les comparaisons au groupe. -->
      <span class="mesure__valeur">${formater(brut, indicateur.unite, false)}</span>
      ${pastille}
      <!-- La définition sort en bulle par-dessus la fiche, elle ne pousse
           rien : dépliée dans le flux, elle décalait toute la liste sous elle
           à chaque fois qu'on demandait ce qu'un mot voulait dire. -->
      <span class="mesure__definition" role="tooltip" hidden>${echapper(
        indicateur.definition,
      )}${
        // Ce que compte le producteur, quand il le nomme. Sans cette ligne, rien
        // ne dit au lecteur qu'un cambriolage est une infraction et une violence
        // une victime — donc que les deux ne s'additionnent pas.
        indicateur.unite_de_compte
          ? ` <em class="mesure__compte">Compté en ${echapper(
              indicateur.unite_de_compte,
            )}.</em>`
          : ""
      }</span>
    </summary>
    <div class="mesure__detail">
      ${comparaisons
        .filter(Boolean)
        .map((phrase) => `<p class="mesure__phrase">${echapper(phrase)}</p>`)
        .join("")}
      ${evolutionDite ? `<p class="mesure__phrase">${evolutionDite}</p>` : ""}
      ${provenanceDite
        ? `<p class="mesure__phrase mesure__provenance">${echapper(provenanceDite)}</p>`
        : ""}
      ${phraseConstants}
      ${rendreSerie(suivie, evenements, formate, mesure.comparaisons, false,
        territoire.maire?.depuis)}
      ${miniTableau(suivie, indicateur, ratio, ratio ? brute : undefined)}
      ${
        rang && rang.total > 1
          ? `<p class="mesure__phrase">Rang ${new Intl.NumberFormat("fr-FR").format(
              rang.position,
            )} sur ${new Intl.NumberFormat("fr-FR").format(
              rang.total,
            )} territoires, du plus haut au plus bas.</p>`
          : ""
      }
      ${
        // Peindre la carte est devenu un geste à part.
        //
        // Ouvrir une mesure la portait sur la carte : un seul clic pour deux
        // intentions, ce qui était le but. Mais peindre relit une couche de
        // 34 772 territoires et réécrit la fiche entière — si bien que *lire*
        // un chiffre coûtait le prix de *cartographier* un chiffre, à chaque
        // ligne dépliée. Sur un thème à soixante-dix-neuf indicateurs, la
        // lecture devenait impraticable.
        //
        // Déplier ne fait donc plus rien d'autre que déplier. Le bouton reste
        // pour qui veut la carte, et il n'apparaît que là où il y a quelque
        // chose à peindre.
        surCarte
          ? ""
          : peintSurCarte?.(indicateur)
          ? `<button type="button" class="mesure__carte" data-carte="${echapper(
              indicateur.id,
            )}">Voir sur la carte</button>`
          : ""
      }
    </div>
  </details>`;
}

/**
 * Ce que l'écart à la médiane pèse, en euros.
 *
 * Un pourcentage ne se conteste pas — il est vrai ou faux, et de toute façon
 * abstrait. Une somme se conteste : elle a un ordre de grandeur qu'on peut
 * comparer à un budget, à un équipement, à un impôt. « 22,3 M€ de plus que la
 * médiane » est une phrase dont on peut faire quelque chose ; « au-dessus de
 * huit communes sur dix », non.
 *
 * La conversion n'a de sens que sur une grandeur monétaire. Sur un taux, une
 * densité ou un effectif, la phrase de médiane reste — c'est la fonction
 * appelante qui retombe dessus quand celle-ci renvoie `null`.
 *
 * L'écart se calcule dans l'unité **affichée** puis se ramène au total : si la
 * ligne montre des euros par habitant, il faut remultiplier par la population,
 * faute de quoi on annoncerait vingt-deux euros là où il y en a vingt-deux
 * millions.
 */
export function ecartEnEuros(
  valeur: number,
  mediane: { ensemble: string; valeur: number },
  indicateur: Indicateur,
  ratio: boolean,
  habitants: number | null,
): string | null {
  if (indicateur.unite !== "EUR" || !Number.isFinite(mediane.valeur)) return null;
  if (ratio && !habitants) return null;
  // « X de plus que si le montant était celui de la médiane » suppose que la
  // médiane soit une grandeur du même ordre. Face à une médiane à 0,13 € par
  // habitant — plus de la moitié des communes n'empruntent rien cette année-là
  // — le contrefactuel ne décrit plus rien, et de part et d'autre de zéro il
  // n'existe pas. La médiane se dit alors telle quelle : c'est la phrase que
  // l'appelant écrit quand celle-ci renvoie `null`.
  if (
    !memeSens(valeur, mediane.valeur) ||
    Math.abs(valeur) > Math.abs(mediane.valeur) * FACTEUR_ECART
  ) {
    return null;
  }
  const ecart = (valeur - mediane.valeur) * (ratio ? (habitants as number) : 1);
  // Sous 1 %, l'écart n'est pas une différence, c'est un arrondi : l'annoncer
  // en millions donnerait du poids à du bruit.
  if (!mediane.valeur || Math.abs(valeur - mediane.valeur) / Math.abs(mediane.valeur) < 0.01) {
    return `Au niveau de la médiane des ${mediane.ensemble}.`;
  }
  const somme = formater(Math.abs(ecart), "EUR", false);
  return ecart > 0
    ? `${somme} de plus que si le montant était celui de la médiane des ${mediane.ensemble}.`
    : `${somme} de moins que si le montant était celui de la médiane des ${mediane.ensemble}.`;
}

/** « son département » en tête de phrase. */
function majuscule(texte: string): string {
  return texte.charAt(0).toLocaleUpperCase("fr-FR") + texte.slice(1);
}

/** Croissance annuelle moyenne, en % par an — ce qu'une évolution brute sur
 *  plusieurs années ne dit pas : +35 % en trois ans, c'est +10,5 %/an. */
export function croissanceAnnuelle(serie: Record<string, number>): number | null {
  const periodes = Object.keys(serie).sort();
  if (periodes.length < 3) return null;
  const premiere = serie[periodes[0]];
  const derniere = serie[periodes[periodes.length - 1]];
  const annees = Number(periodes[periodes.length - 1].slice(0, 4)) - Number(periodes[0].slice(0, 4));
  if (!premiere || !annees || premiere <= 0 || derniere <= 0) return null;
  return ((derniere / premiere) ** (1 / annees) - 1) * 100;
}

/** Une densité lisible. « 0,5 école pour 1 000 habitants » ne se représente
 *  pas ; « 1 école pour 2 200 habitants » se voit. En dessous de 1, on
 *  retourne donc le rapport. */
function densiteLisible(densite: number): string {
  if (densite >= 1) {
    return `${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: densite < 10 ? 1 : 0,
    }).format(densite)} pour 1 000 hab.`;
  }
  // Zéro se dit. Renvoyer une chaîne vide laissait « Par habitant : . » sur
  // les communes qui n'ont ni école ni chômeur, alors que le zéro est
  // précisément ce qu'on vient lire — et c'est lui qui donne son sens à la
  // densité du département posée juste après.
  if (densite === 0) return "0 pour 1 000 hab.";
  if (densite < 0) return "";
  return `1 pour ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    1000 / densite,
  )} hab.`;
}

/** Les exercices récents en chiffres : 2022 | 2023 | 2024 | 2025. La courbe
 *  donne la forme, le tableau donne les nombres — demandé tel quel.
 *
 *  Le tableau commence en 2022 : au-delà il déborde de la colonne, et les
 *  premières années se trouvent alors coupées à l'affichage — on croit lire
 *  une série entière quand on n'en voit qu'un morceau tronqué. L'historique
 *  complet reste dans la courbe, qui, elle, ne coupe rien. */
const PREMIERE_ANNEE_TABLEAU = 2022;

/** Unités dont le libellé est trop long pour tenir dans chaque cellule : il
 *  est dit une fois, dans l'intitulé de la ligne. */
const UNITES_EN_TETE: Record<string, string> = {
  consultations_par_an: "consult./an",
};

/**
 * Ce que le tableau montre, en toutes lettres.
 *
 * Les périodes coexistent sous deux formes : l'exercice annuel (`2024`) et le
 * mois ou le trimestre (`2024-03`, `2024-Q1`). Le mot suit la forme — on ne
 * dit pas « 6 exercices » d'une série mensuelle — et le total publié suit,
 * quand il y a plus de points que de colonnes.
 */
export function fenetreLisible(periodes: string[], publiees: number): string {
  const mot = periodes.some((p) => /-Q/i.test(p))
    ? "trimestres"
    : periodes.some((p) => p.length > 4)
      ? "mois"
      : "exercices";
  return publiees > periodes.length
    ? `${periodes.length} derniers ${mot} sur ${publiees} publiés`
    : `${periodes.length} ${mot} publiés`;
}

function miniTableau(
  serie: Record<string, number>,
  indicateur: Indicateur,
  ratio: boolean,
  /** La même série en montants totaux, quand la première est un ratio : les
   *  deux lectures se lisent alors l'une sous l'autre, année par année. */
  totaux?: Record<string, number>,
): string {
  const toutes = Object.keys(serie).sort();
  const recentes = toutes.filter((p) => Number(p.slice(0, 4)) >= PREMIERE_ANNEE_TABLEAU);
  // Une série arrêtée avant 2022 garde ses dernières colonnes plutôt que de
  // disparaître : mieux vaut un tableau ancien, daté, qu'un tableau absent.
  const periodes = (recentes.length >= 2 ? recentes : toutes).slice(-6);
  if (periodes.length < 2) return "";
  // « total » n'a de sens que pour une grandeur qui s'additionne : sur un taux
  // de pauvreté, la ligne « total 12,4 % » laisserait croire à une somme.
  const intitule = ratio
    ? "par hab."
    : indicateur.unite === "EUR" || indicateur.unite === "count"
      ? "total"
      : "taux";
  // Une unité longue répétée dans chaque cellule — « 4,4 consult./an »,
  // trois fois par ligne — mange la largeur sans rien ajouter : elle passe
  // dans l'intitulé de la ligne, où elle est dite une fois.
  const suffixe = UNITES_EN_TETE[indicateur.unite];
  const cellule = (v: number) =>
    suffixe
      ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)
      : formater(v, indicateur.unite, ratio);
  const ligne = (libelle: string, valeurs: Record<string, number>, parHabitant: boolean) =>
    `<tr><th scope="row">${libelle}</th>${periodes
      .map(
        (p) =>
          `<td>${
            valeurs[p] === undefined
              ? "—"
              : parHabitant === ratio
                ? cellule(valeurs[p])
                : formater(valeurs[p], indicateur.unite, parHabitant)
          }</td>`,
      )
      .join("")}</tr>`;
  // Le tableau défile dans son propre cadre : à 393 px, quatre colonnes de
  // milliards débordaient du panneau et la dernière — la plus récente — était
  // coupée. La page, elle, ne défile jamais latéralement.
  //
  // Et il dit ce qu'il montre. Six colonnes sur dix-neuf points publiés, sans
  // un mot, se lisaient comme la série entière : le lecteur croyait voir tout
  // l'historique là où il n'en voyait que la fin. La légende nomme la fenêtre
  // et le nombre de points qui restent derrière ; la courbe, elle, les montre
  // tous.
  return `<div class="mini-serie__cadre"><table class="mini-serie">
    <caption class="mini-serie__fenetre">${echapper(fenetreLisible(periodes, toutes.length))}</caption>
    <thead><tr><td></td>${periodes
      .map((p) => `<th scope="col">${echapper(p)}</th>`)
      .join("")}</tr></thead>
    <tbody>
      ${ligne(suffixe ?? intitule, serie, ratio)}
      ${totaux ? ligne("total", totaux, false) : ""}
    </tbody>
  </table></div>`;
}

/**
 * L'indicateur qui ouvre un thème.
 *
 * Le premier de la liste n'est pas le plus parlant : sur la sécurité, l'ordre
 * du catalogue faisait entrer par « vols d'accessoires sur véhicules » — un
 * détail présenté comme le résumé du thème. Ce sont ces indicateurs-ci qui
 * ouvrent, parce qu'ils répondent à la question qu'on se pose vraiment. Un
 * thème absent de la table garde l'ordre du catalogue ; un indicateur listé ici
 * mais non publié pour ce territoire est simplement ignoré.
 */
const PHARES: Record<string, string[]> = {
  // Fiche d'un territoire.
  securite: ["ssmsi_cambriolages_taux", "ssmsi_violences_hors_famille_taux"],
  finances_locales: ["ofgl_depenses_fonctionnement", "ofgl_encours_dette"],
  revenus: ["insee_niveau_vie_median", "insee_taux_pauvrete", "cnaf_foyers_rsa"],
  population: ["insee_population_municipale"],
  // Combien de familles, et combien y élèvent seules leurs enfants : les deux
  // chiffres du thème qu'on vient chercher.
  famille: ["insee_familles", "insee_familles_monoparentales"],
  // Les deux catégories les plus nombreuses de France, et celles dont l'écart
  // dit le plus d'un territoire : ouvriers et cadres.
  professions: ["insee_pcs_cadres", "insee_pcs_ouvriers"],
  // Le parc, puis la question qu'on vient poser : combien de logements vides.
  // La part de propriétaires vient après, elle se lit sur un dénominateur.
  logement: ["insee_logements", "insee_logements_vacants"],
  education: ["menj_ecoles", "menj_colleges_lycees"],
  sante: ["drees_apl_generalistes"],
  // Le taux du BIT là où il existe — département et région — puis les chiffres
  // du recensement, seuls disponibles à la commune. Les deux ne mesurent pas la
  // même chose, et c'est leur fiche qui le dit.
  // Les inscrits France Travail d'abord là où ils existent : c'est le chiffre
  // le plus récent et le plus commenté. Le taux BIT reste devant aux mailles
  // où il est publié.
  emploi: [
    "insee_taux_chomage_localise",
    "dares_defm_abc",
    "insee_chomeurs_rp",
    "insee_actifs_occupes",
  ],
  // Les deux bouts de la distribution : c'est leur écart qui décrit un
  // territoire, pas le détail des niveaux intermédiaires.
  diplomes: ["insee_diplome_superieur", "insee_diplome_aucun"],
  // Le stock avant le flux : « combien d'entreprises ici » se répond par les
  // établissements présents, pas par les immatriculations de l'année — qui,
  // elles, sont comptées au siège et non là où l'activité se fait.
  entreprises: ["insee_etablissements_actifs", "insee_creations_entreprises"],
  // Les deux secteurs qui emploient partout, et dont l'écart dit d'un
  // territoire s'il vit de son marché ou de ses services publics.
  secteurs_salaries: [
    "insee_effectifs_salaries_services_marchands",
    "insee_effectifs_salaries_administration_sante_social",
  ],
  secteurs_etablissements: [
    "insee_etablissements_employeurs_services_marchands",
    "insee_etablissements_employeurs_administration_sante_social",
  ],
  // Le total plutôt qu'un domaine : « combien d'équipements chez moi »
  // avant « combien de terrains de sport ».
  equipements: ["insee_equipements_total"],
  // Le parc avant sa composition : « combien de voitures ici », puis la part
  // qui roule à l'électrique.
  transports: ["sdes_parc_voitures", "sdes_part_voitures_electriques"],
  // Le flux consommé d'abord ; la part destinée à l'habitat le précise.
  environnement: ["cerema_espaces_consommes", "cerema_espaces_consommes_habitat"],
  // La surpopulation avant l'effectif : « la prison d'ici déborde-t-elle »
  // se répond par une densité, pas par un nombre de détenus.
  justice: ["justice_densite_carcerale", "justice_personnes_detenues"],
  // Les capacités avant les établissements : « combien de lits ici » se répond
  // par des chambres et des emplacements, pas par un nombre d'enseignes. Les
  // deux hébergements les plus répandus ouvrent ; le troisième suit.
  tourisme: ["insee_hotels_chambres", "insee_campings_emplacements"],
  // Le taux avant les effectifs : « a-t-on voté chez moi » se répond par
  // une part, pas par un nombre d'inscrits qui ne dit que la taille.
  elections: ["elections_taux_participation", "elections_inscrits"],
  // Les filles avant les garçons : aucune raison de principe, sinon que
  // les deux se lisent ensemble et qu'il faut bien un ordre.
  prenoms: [
    "insee_prenom_premier_effectif_filles",
    "insee_prenom_premier_effectif_garcons",
  ],
  // Le taux global, celui qui figure sur l'avis d'imposition : la part
  // communale seule ne dit pas ce que paie le propriétaire. L'identifiant écrit
  // ici ne correspondait à aucun indicateur publié — le thème s'ouvrait donc
  // dans l'ordre du catalogue, sur la part communale.
  impots_locaux: ["dgfip_taux_tfb_global", "dgfip_taux_tfb_commune"],
  // Fiche nationale. Ces thèmes n'avaient pas de phare : ils s'ouvraient sur le
  // premier identifiant du catalogue — « Charge de la dette de l'État » pour le
  // budget, « Affaires économiques » pour les fonctions — c'est-à-dire sur une
  // ligne parmi quinze, présentée comme le résumé du thème.
  dette: ["insee_dette_apu_part_pib", "insee_dette_apu_montant"],
  budget_etat: ["etat_solde_budgetaire", "etat_depenses_nettes_bg"],
  depenses_fiscales: ["depense_fiscale_totale", "depense_fiscale_impot_revenu"],
  fonctions: ["eurostat_depenses_publiques_pib"],
  // Le total des prestations d'abord, le solde ensuite : « 932 milliards »
  // situe le lecteur, « −0,4 point de PIB » ne situe personne.
  securite_sociale: ["drees_protection_sociale_total", "eurostat_secu_solde_pib"],
  energie: ["ore_conso_electricite", "ore_conso_gaz"],
  macro: ["eurostat_inflation_ipch", "eurostat_croissance_pib"],
  europe: ["eurostat_dette_pib", "eurostat_chomage"],
};

/**
 * Les rubriques : quatre entrées pour vingt-six thèmes.
 *
 * Vingt-six onglets sur une seule ligne, c'est une barre qu'il faut faire
 * défiler pour savoir ce qu'elle contient : le lecteur ne voit jamais l'offre
 * entière, donc il ne cherche que ce qu'il apercevait déjà. Deux niveaux la
 * rendent lisible d'un coup d'œil — quatre entrées tiennent sans défilement, et
 * chacune ouvre au plus neuf thèmes.
 *
 * Le découpage suit la question posée, pas la source. Les revenus des ménages
 * sont rangés avec les habitants et non avec l'argent public : « combien
 * gagne-t-on ici » n'est pas « où va l'impôt », et les confondre ferait lire
 * un salaire comme une dépense publique. L'ordre à l'intérieur d'une rubrique
 * reste celui de ce qu'on vient chercher, l'argent en premier.
 *
 * Un thème absent de cette table n'est pas écarté : il se range dans la
 * dernière rubrique. C'est la même règle que pour les libellés — une liste
 * écrite en dur avait déjà fait disparaître des données publiées.
 */
const RUBRIQUES: { cle: string; libelle: string; themes: string[] }[] = [
  {
    cle: "argent",
    libelle: "Argent public",
    themes: [
      "finances_locales",
      "impots_locaux",
      "budget_etat",
      "depenses_fiscales",
      "dette",
      "fonctions",
      "securite_sociale",
      // Les subventions de l'État aux associations sont de l'argent public qui
      // sort, pas un trait du cadre de vie : c'est à ce titre qu'elles se
      // rangent ici. La règle de repli les avait mises dans la dernière
      // rubrique, ce qui était un défaut de table et non une décision.
      "vie_associative",
      "macro",
      "europe",
    ],
  },
  {
    cle: "habitants",
    libelle: "Habitants",
    themes: ["population", "revenus", "famille", "diplomes", "elections", "prenoms"],
  },
  {
    cle: "travail",
    libelle: "Travail",
    themes: [
      "emploi",
      "professions",
      "entreprises",
      "secteurs_salaries",
      "secteurs_etablissements",
    ],
  },
  {
    cle: "cadre",
    libelle: "Cadre de vie",
    themes: [
      "logement", "sante", "education", "securite", "justice", "energie",
      "transports", "environnement", "equipements", "tourisme",
    ],
  },
];

/** La rubrique d'un thème. Un thème inconnu tombe dans la dernière, il ne
 *  disparaît pas. */
export function rubriqueDuTheme(theme: string): string {
  const trouvee = RUBRIQUES.find((r) => r.themes.includes(theme));
  return (trouvee ?? RUBRIQUES[RUBRIQUES.length - 1]).cle;
}

/**
 * L'ordre des thèmes dans la fiche.
 *
 * L'ordre alphabétique faisait ouvrir un site sur l'argent public par
 * « Éducation », et reléguait les finances locales au quatrième écran. Celui-ci
 * découle des rubriques, pour qu'il n'y ait qu'une seule table à tenir à jour :
 * deux listes séparées se seraient contredites au premier thème ajouté. Un
 * thème absent se range à la fin, par ordre alphabétique.
 */
export const ORDRE_THEMES = RUBRIQUES.flatMap((r) => r.themes);

/**
 * Ce qu'un thème montre d'emblée. Le reste se déplie.
 *
 * Soixante-dix-neuf lignes de comptes locaux, ce n'est pas de la richesse,
 * c'est un déversement de la nomenclature comptable — sous-totaux de
 * sous-totaux compris. On les faisait défiler sans rien en retenir : à ce
 * compte-là, publier davantage revient à publier moins.
 *
 * Le thème s'ouvre donc sur les lignes qui **répondent à une question**, et le
 * reste passe derrière « Tout le détail ». Rien n'est retiré : ce qui n'est pas
 * retenu est à un clic, dans l'ordre du catalogue.
 *
 * Le choix des finances locales se lit à côté de ce qui est déjà affiché
 * au-dessus. Recettes, charges, épargne, dette, investissement figurent dans
 * l'enchaînement et dans les six rapports : les répéter en tête du thème aurait
 * fait trois fois le même chiffre sur un écran. Ce qui est retenu ici est
 * exactement ce que ni l'un ni les autres ne montrent — la composition de la
 * dépense, et d'où vient l'argent.
 *
 * Un thème absent de cette table s'affiche entier : la règle est une réponse à
 * l'abondance, pas un filtre par défaut.
 */
/**
 * Les lignes qui redisent une autre ligne du même thème, repliées d'office.
 *
 * « Population active » est la somme des occupés et des chômeurs, tous deux
 * affichés ; l'IPC double l'IPCH qui sert de déflateur au site entier ; la
 * consommation effective double la dépense de consommation, le concept usuel.
 * Rien n'est supprimé : tout reste derrière « Tout le détail ».
 */
const REPLIES = new Set([
  "insee_actifs",
  "insee_inactifs",
  "insee_population_15_64_ans",
  "insee_inflation_ipc",
  "insee_conso_menages_effective",
]);

const RETENUS: Record<string, string[]> = {
  finances_locales: [
    "ofgl_frais_personnel",
    "ofgl_achats_et_charges_externes",
    "ofgl_depenses_d_intervention",
    "ofgl_subventions_aux_personnes_de_droit_prive",
    "ofgl_depenses_d_equipement",
    "ofgl_impots_locaux",
    "ofgl_dotation_globale_de_fonctionnement",
    "ofgl_perequations_et_compensations_fiscales",
  ],
  // Le taux global est celui de l'avis d'imposition ; la part communale seule
  // ne dit pas ce que paie le propriétaire, et les deux côte à côte se lisaient
  // comme deux impôts. Le non-bâti concerne une minorité de contribuables.
  impots_locaux: [
    "dgfip_taux_tfb_global",
    "dgfip_produit_foncier_bati",
    "dgfip_produit_cfe",
    "dgfip_produit_th_residences_secondaires",
  ],
};

/**
 * Les jumeaux : le taux et le nombre d'un même phénomène.
 *
 * La sécurité publiait trente-deux lignes pour seize phénomènes — un taux et
 * un nombre pour chacun, l'un sous l'autre, disant deux fois la même chose.
 * C'est le doublon le plus visible du site. Le taux reste la ligne, parce
 * qu'il se compare ; le nombre le rejoint dans son détail, en une phrase, avec
 * ce que la source compte au juste — des infractions, des victimes ou des
 * personnes mises en cause, qui ne s'additionnent pas entre eux.
 */
export function jumeaux(indicateurs: Indicateur[]): Map<string, Indicateur> {
  const parId = new Map(indicateurs.map((i) => [i.id, i]));
  const paires = new Map<string, Indicateur>();
  for (const indicateur of indicateurs) {
    if (indicateur.id.endsWith("_nombre")) {
      const taux = parId.get(`${indicateur.id.slice(0, -"_nombre".length)}_taux`);
      if (taux && taux.theme === indicateur.theme) paires.set(taux.id, indicateur);
    }
    // Le budget voté rejoint le budget exécuté : deux lignes muettes l'une sur
    // l'autre pour chaque mission de l'État, alors que la seule information
    // du voté est son écart à l'exécuté — et il est chiffré dans la phrase.
    if (indicateur.id.endsWith("_credits_votes")) {
      const consommes = parId.get(
        `${indicateur.id.slice(0, -"_credits_votes".length)}_credits_consommes`,
      );
      if (consommes) paires.set(consommes.id, indicateur);
    }
  }
  // Les paires que la convention de nommage n'attrape pas : même phénomène,
  // deux comptages, la capacité reste la ligne et l'autre devient une phrase.
  for (const [principal, second] of PAIRES_EXPLICITES) {
    const p = parId.get(principal);
    const s = parId.get(second);
    if (p && s && p.theme === s.theme) paires.set(principal, s);
  }
  return paires;
}

/** [ligne affichée, comptage replié en phrase]. */
const PAIRES_EXPLICITES: [string, string][] = [
  ["insee_hotels_chambres", "insee_hotels"],
  ["insee_campings_emplacements", "insee_campings"],
  ["insee_hebergements_collectifs_lits", "insee_hebergements_collectifs"],
  // Votants = inscrits × participation : la troisième ligne n'apprend rien.
  ["elections_taux_participation", "elections_votants"],
  ["etat_subventions_associations", "etat_subventions_associations_etablissements"],
];

/** Ce que compte le jumeau replié, quand ce n'est pas dans ses métadonnées. */
const NOM_DU_COMPTE: Record<string, string> = {
  insee_hotels: "hôtels",
  insee_campings: "campings",
  insee_hebergements_collectifs: "hébergements collectifs",
  elections_votants: "votants",
  etat_subventions_associations_etablissements: "établissements bénéficiaires",
};

function ordonnerThemes(themes: string[]): string[] {
  const rang = (t: string) => {
    const place = ORDRE_THEMES.indexOf(t);
    return place === -1 ? ORDRE_THEMES.length : place;
  };
  return [...themes].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, "fr"));
}

/**
 * Les onglets : une rubrique et, dedans, un thème à la fois.
 *
 * Empilés, les thèmes faisaient cinq écrans de défilement et il fallait
 * traverser sept thèmes pour atteindre le huitième. En onglets, la hauteur de
 * la fiche ne dépend plus du nombre d'indicateurs : cinquante de plus n'y
 * changeraient rien.
 *
 * La barre des thèmes d'une rubrique existe dans le document même quand elle
 * ne s'affiche pas — c'est elle qui dit quel thème ouvrir en changeant de
 * rubrique. Une rubrique d'un seul thème garde donc sa barre, marquée
 * `data-seul` : un onglet unique, toujours enfoncé, ne se clique pas, mais
 * l'ouverture de la rubrique doit quand même savoir où aller.
 */
export function ongletsThemes(
  themes: string[],
  actif: string,
  libelleTheme?: (theme: string) => string,
): string {
  if (themes.length < 2) return "";
  const rubriques = RUBRIQUES.map((r) => r.cle).filter((cle) =>
    themes.some((t) => rubriqueDuTheme(t) === cle),
  );
  const rubriqueActive = rubriqueDuTheme(actif);
  const barreRubriques =
    rubriques.length < 2
      ? ""
      : `<nav class="onglets-rubriques" aria-label="Rubriques de la fiche">${rubriques
          .map((cle) => {
            const libelle = RUBRIQUES.find((r) => r.cle === cle)?.libelle ?? cle;
            return `<button type="button" data-rubrique="${echapper(
              cle,
            )}" aria-pressed="${cle === rubriqueActive}">${echapper(libelle)}</button>`;
          })
          .join("")}</nav>`;
  const barresThemes = rubriques
    .map((cle) => {
      const siens = themes.filter((t) => rubriqueDuTheme(t) === cle);
      return `<nav class="onglets-themes" data-rubrique="${echapper(cle)}"${
        siens.length < 2 ? " data-seul" : ""
      }${cle === rubriqueActive ? "" : " hidden"} aria-label="Thèmes de la rubrique">${siens
        .map(
          (t) =>
            `<button type="button" data-theme="${echapper(t)}" aria-pressed="${
              t === actif
            }">${echapper(libelleTheme?.(t) ?? t)}</button>`,
        )
        .join("")}</nav>`;
    })
    .join("");
  return `${barreRubriques}${barresThemes}`;
}

/**
 * « Ce total est notre somme, pas un chiffre publié. »
 *
 * Un total national obtenu en additionnant dix-huit régions n'est pas de la
 * même nature qu'un chiffre que le producteur publie lui-même. Le taire
 * reviendrait à faire passer notre calcul pour sa mesure — et le périmètre
 * change aussi : nos sommes portent sur la France entière, outre-mer compris,
 * alors que beaucoup de chiffres nationaux publiés ailleurs s'arrêtent à la
 * métropole. Les deux ne se comparent pas.
 *
 * La phrase n'apparaît que sur les thèmes concernés, et seulement si au moins
 * un indicateur du thème en relève : ailleurs, elle serait du bruit.
 *
 * **Et seulement sur la fiche France.** La somme des régions n'existe qu'au
 * niveau national : c'est là, et là seulement, qu'un total du site remplace un
 * total de la source. La mention s'affichait pourtant sur le thème Logement
 * d'une fiche communale — le chiffre de la commune, lui, vient bien du
 * producteur — où elle jetait un doute sur une donnée qu'elle ne concerne pas.
 */
export function mentionAgregat(
  liste: Indicateur[],
  agregats: AgregatsNationaux | null | undefined,
  /** Obligatoire : c'est l'oubli de ce paramètre qui a mis la mention sur des
   *  fiches communales. */
  niveau: string,
): string {
  if (niveau !== "pays") return "";
  if (!agregats?.indicateurs?.length) return "";
  const concernes = liste.filter((i) => agregats.indicateurs.includes(i.id));
  if (!concernes.length) return "";
  return `<p class="theme-groupe__agregat">${
    concernes.length === liste.length ? "Ces totaux sont" : `${concernes.length} de ces totaux sont`
  } la somme des ${agregats.regions_attendues} régions, calculée par ce site et non publiée
  telle quelle : ${echapper(agregats.perimetre)}. Un taux n'y figure pas : il ne s'additionne
  pas d'une région à l'autre.</p>`;
}

/** Les indicateurs d'un thème, les phares d'abord. */
function ordonnerTheme(theme: string, liste: Indicateur[]): Indicateur[] {
  const phares = PHARES[theme] ?? [];
  const rang = (i: Indicateur) => {
    const place = phares.indexOf(i.id);
    return place === -1 ? phares.length : place;
  };
  return [...liste].sort((a, b) => rang(a) - rang(b));
}

/**
 * Le thème dans son ensemble, en une phrase.
 *
 * Un thème ne s'additionne pas : sommer cambriolages, vols de véhicules et
 * personnes mises en cause mêlerait des victimes, des véhicules et des auteurs
 * dans un seul nombre — trois unités, trois périmètres, aucune signification.
 * Ce qui s'agrège sans mentir, c'est l'écart au repère : sans unité, donc
 * comparable d'un indicateur à l'autre. La phrase dit alors du thème entier ce
 * qu'aucun de ses indicateurs ne dit seul.
 */
function ecartsDuTheme(
  liste: Indicateur[],
  territoire: Territoire,
  periodeCarte: string,
  parHabitant: boolean,
  niveau: string,
  references: References | null,
  comparateurs: { libelle: string; territoire: Territoire }[],
  minimum: number,
): { ecarts: { libelle: string; ecart: number }[]; reference: string } | null {
  // Un seul repère pour tout le thème, sinon on compterait des écarts pris
  // sur des références différentes : le premier comparateur disponible, ou la
  // médiane à défaut. Pour un effectif, l'écart est celui de la densité —
  // calculé dans `mesurer`, pas ici, pour que le résumé et la fiche disent
  // exactement le même chiffre.
  const ecarts = liste.flatMap((indicateur) => {
    const mesure = mesurer(
      indicateur, territoire, periodeCarte, parHabitant, niveau, references, comparateurs,
    );
    if (typeof mesure === "string" || !mesure.ecart) return [];
    return [
      {
        libelle: traduire(indicateur.libelle),
        reference: mesure.ecart.reference,
        ecart: mesure.ecart.pourcent,
      },
    ];
  });
  if (ecarts.length < minimum) return null;
  // Les écarts pris sur des repères différents ne se comptent pas ensemble :
  // on ne garde que ceux qui partagent la référence la plus fréquente.
  const comptes = new Map<string, number>();
  for (const e of ecarts) comptes.set(e.reference, (comptes.get(e.reference) ?? 0) + 1);
  const reference = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const retenus = ecarts.filter((e) => e.reference === reference);
  return retenus.length < minimum ? null : { ecarts: retenus, reference };
}

function resumeTheme(
  liste: Indicateur[],
  territoire: Territoire,
  periodeCarte: string,
  parHabitant: boolean,
  niveau: string,
  references: References | null,
  comparateurs: { libelle: string; territoire: Territoire }[],
): string {
  const groupe = ecartsDuTheme(
    liste, territoire, periodeCarte, parHabitant, niveau, references, comparateurs, 2,
  );
  if (!groupe) return "";
  const phrase = resumeEcarts(groupe.ecarts, groupe.reference);
  return phrase ? `<p class="theme-groupe__resume">${echapper(phrase)}</p>` : "";
}

/**
 * La synthèse d'ouverture : ce qu'on retiendrait de ce territoire.
 *
 * **Un thème, une ligne — tous les thèmes.** L'écriture précédente parcourait
 * une liste d'indicateurs fixée à la main et n'en gardait que les quatre
 * premiers. Comme cette liste rangeait les finances en tête, les quatre places
 * étaient toujours prises par la population, les dépenses, la dette et le
 * niveau de vie : la sécurité, la santé et l'éducation venaient après le
 * couperet et **ne s'affichaient jamais**, sur aucun territoire. Ce n'était pas
 * un arbitrage éditorial, c'était une troncature — et elle penchait toujours du
 * même côté. Le nombre de lignes suit désormais le nombre de thèmes publiés
 * pour ce territoire ; aucun thème ne peut plus être écarté par le rang qu'on
 * lui a donné.
 *
 * **C'est le thème qui ouvre la ligne, pas l'indicateur.** Écrite en tête, la
 * mesure phare tenait lieu de titre : « Cambriolages de logement 0,56 % »
 * donnait la délinquance d'une région pour un seul de ses six phénomènes,
 * choisi par nous. Le thème nommé d'abord, l'ambiguïté disparaît — on sait de
 * quel domaine chaque ligne parle, et que tous y sont.
 *
 * Un thème dont un indicateur porte la question qu'on se pose vraiment — « que
 * dépense ma commune ? », « quel niveau de vie ? » — montre ce chiffre. La
 * sécurité n'en a pas : cambriolages, violences, vols de véhicules sont six
 * phénomènes indépendants, et aucun ne représente les autres. Sa ligne porte
 * donc le décompte du thème entier, en une proposition. La forme longue de ce
 * décompte — avec l'écart le plus marqué — reste sous les onglets, à sa place :
 * elle s'affichait ici *et* là, mot pour mot, à trois centimètres d'intervalle.
 */
const SANS_MESURE_PHARE = new Set([
  // Six phénomènes indépendants, aucun ne parlant pour les autres. Mettre les
  // cambriolages en tête revient à décider que c'est cela, la sécurité.
  "securite",
]);

/**
 * Les thèmes qui n'entrent pas dans « L'essentiel ».
 *
 * Quatorze lignes d'ouverture, ce n'est plus une synthèse, c'est une table des
 * matières. Les chambres d'hôtel, le nombre d'équipements ou les salariés par
 * secteur ne sont l'essentiel d'aucune commune : ils restent à un clic, dans
 * leur onglet. Ce qui reste répond aux questions qu'on vient poser — l'argent,
 * les impôts, les revenus, la population, la sécurité, la santé, le logement,
 * l'emploi.
 */
const SYNTHESE_EXCLUS = new Set([
  "tourisme",
  "equipements",
  "famille",
  "professions",
  "diplomes",
  "entreprises",
  "secteurs_salaries",
  "secteurs_etablissements",
  "prenoms",
  "vie_associative",
]);

/** Un libellé d'indicateur enchaîné après le nom du thème : « Finances locales
 *  — dépenses de fonctionnement ». Les sigles gardent leur casse — « PIB par
 *  habitant » ne devient pas « pIB par habitant ». */
function enMinusculeInitiale(texte: string): string {
  return /^[A-ZÀÂÉÈÊÎÔÛÇ][a-zàâéèêîïôûùç]/.test(texte)
    ? texte[0].toLocaleLowerCase("fr") + texte.slice(1)
    : texte;
}

function syntheseTerritoire(
  indicateurs: Indicateur[],
  territoire: Territoire,
  periode: string,
  parHabitant: boolean,
  comparateurs: { libelle: string; territoire: Territoire }[],
  references: References | null,
  niveau: string,
  libelleTheme?: (theme: string) => string,
): string {
  const parTheme = new Map<string, Indicateur[]>();
  for (const indicateur of indicateurs) {
    parTheme.set(indicateur.theme, [...(parTheme.get(indicateur.theme) ?? []), indicateur]);
  }
  const faits = ordonnerThemes([...parTheme.keys()]).flatMap((theme) => {
    if (SYNTHESE_EXCLUS.has(theme)) return [];
    const liste = ordonnerTheme(theme, parTheme.get(theme) as Indicateur[]);
    const nomTheme = libelleTheme?.(theme) ?? theme;
    if (SANS_MESURE_PHARE.has(theme)) {
      const groupe = ecartsDuTheme(
        liste, territoire, periode, parHabitant, niveau, references, comparateurs, 2,
      );
      const compte = groupe ? compteEcarts(groupe.ecarts, groupe.reference) : "";
      // Sans repère, pas de décompte — et le thème disparaissait de l'ouverture,
      // ce qui est exactement ce qu'on cherchait à corriger. C'est le cas de la
      // sécurité d'une région : le SSMSI ne publie rien au niveau national et
      // n'a aucune médiane dans le fichier de repères, si bien qu'une région
      // n'a personne à qui se comparer. On montre alors la mesure phare, sous le
      // nom du thème, en disant que le repère manque plutôt qu'en l'inventant.
      if (compte) {
        return [{ id: theme, texte: `<strong>${echapper(nomTheme)}</strong> : ${echapper(compte)}` }];
      }
    }
    // Le premier indicateur du thème réellement mesuré ici, phares d'abord :
    // un phare non publié pour ce territoire laisse la place au suivant plutôt
    // que de faire disparaître le thème.
    for (const indicateur of liste) {
      // **L'ouverture montre la masse, jamais le par-habitant.** Un montant se
      // lit en millions d'euros partout sur le site ; le par-habitant vit dans
      // les tableaux qu'on déplie, où il a la place d'être nommé.
      const mesure = mesurer(
        indicateur, territoire, periode, false, niveau, references, comparateurs,
      );
      if (typeof mesure === "string") continue;
      // Mais la comparaison, elle, n'a de sens qu'à l'habitant : « 369,0 M€
      // contre 1,2 M€ pour la commune médiane » ne dirait que la différence de
      // taille. On garde donc la masse pour le chiffre et le par-habitant pour
      // l'écart, en l'écrivant dans la phrase pour qu'aucun des deux ne passe
      // pour l'autre.
      const compare = parHabitantAUnSens(indicateur)
        ? mesurer(indicateur, territoire, periode, true, niveau, references, comparateurs)
        : mesure;
      const rapporte = typeof compare === "string" ? mesure : compare;
      const { valeur } = mesure;
      const ratio = rapporte.ratio;
      const comparaisons = rapporte.comparaisons;
      // Un effectif ne se compare pas d'une maille à l'autre : « 171 777
      // logements » face à un département ne dirait que la différence de
      // taille, et `lecture` rend donc une phrase vide. Sa densité, elle, se
      // compare — c'est même la seule grandeur qui le fasse, et la ligne
      // détaillée l'affiche déjà. Elle manquait ici : huit des quatorze lignes
      // de l'ouverture n'étaient qu'un nombre nu, sur une fiche dont tout
      // l'objet est de dire si un chiffre est beaucoup.
      const formate = (v: number) => formater(v, indicateur.unite, ratio);
      // « Dépenses de fonctionnement 19 512 € par habitant. +2 280 % vs la
      // médiane régionale (819 €) » : le pourcentage mesure la petitesse de la
      // médiane, pas la commune. Les repères hors d'échelle sont retirés avant
      // que `lecture` n'en tire un rapport ; s'il n'en reste aucun, le repère
      // se pose tel quel à côté du chiffre plutôt que de disparaître.
      const situation =
        lecture(rapporte.valeur, reperesALEchelle(rapporte.valeur, comparaisons), formate) ||
        lectureDeDensite(rapporte.densite) ||
        contreLeRepere(comparaisons, formate);
      // Un nombre nu ne situe pas : « salariés 100 521 » dit la taille de la
      // ville, que la population dit déjà. Sans comparaison, pas de ligne —
      // sauf la population elle-même, dont la taille est l'information.
      if (!situation && !POPULATIONS.has(indicateur.id)) continue;
      // « Population — population municipale » : quand le libellé de la mesure
      // reprend déjà celui du thème, le thème ne s'écrit pas deux fois.
      const redite = indicateur.libelle
        .toLocaleLowerCase("fr")
        .startsWith(nomTheme.toLocaleLowerCase("fr"));
      // Le gras porte le **chiffre**, pas le nom du thème.
      //
      // C'était l'inverse, et un résumé où seuls les intitulés ressortent se
      // balaie sans rien apprendre : on relit « Sécurité sociale »,
      // « Conjoncture », « Dette » — des mots qu'on connaissait déjà — et les
      // nombres, qui sont l'information, se noient dans la ligne. Un seul gras
      // par ligne : deux n'en font ressortir aucun.
      const entete = redite
        ? echapper(indicateur.libelle)
        : `${echapper(nomTheme)} : ${echapper(enMinusculeInitiale(indicateur.libelle))}`;
      return [
        {
          id: theme,
          // Le millésime reste au survol, pas dans la phrase : quatre dates
          // dans quatre lignes d'ouverture cassaient la lecture pour redire ce
          // que le lecteur sait — c'est le dernier chiffre publié.
          texte: `${entete} <strong title="Millésime ${echapper(
            mesure.periode,
          )}">${echapper(formater(valeur, indicateur.unite, false))}</strong>. ${
            situation ? `${ratio ? "Par habitant, " : ""}${echapper(situation)}` : ""
          }`.trim(),
        },
      ];
    }
    return [];
  });
  // Le plafond suit le nombre de thèmes : c'est lui qui a fait disparaître la
  // sécurité quand il était fixé à quatre.
  const lignes = synthese(faits, faits.length);
  if (!lignes.length) return "";
  // Un titre, pas un `<span>` en petites capitales. C'est le premier bloc de la
  // fiche : au clavier et au lecteur d'écran, il n'existait pas. Le niveau suit
  // celui des autres sections de la fiche — le nom du territoire est en `h2`,
  // les rapports et le pont en `h3` — et la classe reste, c'est elle qui porte
  // le style.
  // Le lien vers la page ANALYSES ferme le bloc. Il remplace le « Tout voir /
  // 187 indicateurs » qui posait un compte brut à côté d'un titre sans rien
  // relier : un nombre n'est pas une invitation, et le lecteur ne savait pas où
  // il allait. La page, elle, existe et porte le détail complet, thème par
  // thème.
  return `<div class="synthese">
    <h3 class="synthese__titre">L'essentiel</h3>
    <ul>${lignes.map((l) => `<li>${l}</li>`).join("")}</ul>
    <a class="synthese__tout" href="#analyses">Voir le détail complet</a>
  </div>`;
}

/** Ce qu'un comparateur désigne : une maille, et le code du territoire qui la
 *  porte pour cette fiche. `parent` publié est le département d'une commune,
 *  `region` sa région (voir la requête de `publish.territoires`).
 *
 *  Les libellés sont écrits par l'appelant. Un libellé qu'on ne sait pas
 *  résoudre, ou un code absent, ne produit pas de bouton : le nom reste écrit
 *  en clair, comme avant. Mieux vaut un texte que le mauvais lien. */
function mailleDuComparateur(
  libelle: string,
  territoire: Territoire,
  niveau: string,
): { code: string; niveau: string } | null {
  if (libelle === "la France") return { code: "FR", niveau: "pays" };
  if (libelle === "sa région") {
    return territoire.region ? { code: territoire.region, niveau: "region" } : null;
  }
  if (libelle === "son département") {
    return niveau === "commune" && territoire.parent
      ? { code: territoire.parent, niveau: "departement" }
      : null;
  }
  return null;
}

/** Le nom d'un territoire parent, en bouton quand on sait où il mène.
 *
 *  Le contrat avec `main.ts` tient dans les deux attributs : `data-code` et
 *  `data-niveau` sur `.fiche__parent`, quel que soit l'endroit de la fiche où
 *  le bouton se trouve. C'est un seul gestionnaire, par délégation. */
function boutonParent(
  parent: { libelle: string; territoire: Territoire },
  maille: { code: string; niveau: string } | null,
): string {
  const nom = echapper(parent.territoire.nom);
  return maille
    ? `<button type="button" class="fiche__parent" data-code="${echapper(
        maille.code,
      )}" data-niveau="${echapper(maille.niveau)}">${nom}</button>`
    : nom;
}

/** Les mailles dont on sait dire « c'est mesuré là », dans l'ordre où on les
 *  propose : la plus proche d'abord. */
const OU_C_EST_MESURE: Record<string, string> = {
  departement: "au département",
  region: "à la région",
  pays: "au niveau national",
};

/**
 * Le thème n'a rien ici : où est-ce mesuré, et comment y aller.
 *
 * Le renvoi n'est pas déduit du catalogue mais **vérifié sur les chiffres** :
 * un indicateur peut déclarer le département dans ses niveaux sans qu'aucune
 * valeur n'y soit publiée. On cherche donc, de la maille la plus proche à la
 * plus lointaine, celle dont la série porte réellement quelque chose pour l'un
 * des indicateurs du thème. Aucune ne le porte : rien n'est écrit, et le thème
 * perd son onglet plutôt que d'en donner un vers du blanc.
 */
function renvoiVersLaMaillePorteuse(
  liste: Indicateur[],
  territoire: Territoire,
  niveau: string,
  comparateurs: { libelle: string; territoire: Territoire }[],
): string | null {
  for (const comparateur of comparateurs) {
    const maille = mailleDuComparateur(comparateur.libelle, territoire, niveau);
    const ou = maille ? OU_C_EST_MESURE[maille.niveau] : undefined;
    if (!maille || !ou) continue;
    const mesure = liste.some((i) => {
      const serie = comparateur.territoire.series?.[i.id];
      return serie !== undefined && Object.keys(serie).length > 0;
    });
    if (!mesure) continue;
    return `<p class="theme-groupe__ailleurs">Ce thème n'est pas mesuré ici, mais ${ou} : ${boutonParent(
      comparateur,
      maille,
    )}</p>`;
  }
  return null;
}

/* ------------------------------------------------------------------------ *
 * L'ouverture de la fiche : le récit, le verdict, et le corps par questions.
 *
 * Le panneau publiait cent quatre-vingt-dix-huit indicateurs au même niveau
 * visuel, rangés sous les intitulés du plan comptable. Ce qui suit ne retire
 * rien : la fiche d'avant est intacte derrière « Tout voir ». Ce qui change,
 * c'est ce qu'on voit en premier — une phrase qui dit le bilan, trois à cinq
 * chiffres qui la soutiennent, puis des questions en français.
 * ------------------------------------------------------------------------ */

/** Chaque maille sur son propre calendrier : `calendrierDe` rend celui de
 *  l'assemblée qui vote ce budget-là, et `null` pour le pays, dont le budget
 *  est voté chaque année par un Parlement au calendrier propre. */

/** Les quatre questions dont les indicateurs sont des comptes. Ce sont leurs
 *  millésimes, et eux seuls, qui bornent un mandat : un recensement publié tous
 *  les cinq ans ne dit rien de ce qu'une équipe a dépensé. */
const QUESTIONS_D_ARGENT = new Set(["depenses", "recettes", "impots", "dette"]);

/**
 * Les exercices que les comptes atteignent vraiment.
 *
 * Deux façons de se tromper de fenêtre, et la fiche France les cumulait :
 *
 * 1. **Mélanger les granularités.** La dette publique est publiée par
 *    trimestre. « 2026-Q1 » se range après « 2026 » dans un tri de chaînes, et
 *    la fenêtre d'un bilan budgétaire finissait sur un trimestre. Un trimestre
 *    n'est pas un exercice : il ne borne rien.
 * 2. **Finir sur un exercice que presque rien ne porte.** Au niveau France, dix
 *    séries sur cent quatre-vingt-dix vont jusqu'à 2026 — ce sont les dépenses
 *    fiscales, prévues au PLF, pas des comptes exécutés. La fenêtre finissait
 *    donc en 2026, où toutes les autres séries sont muettes : chaque règle du
 *    verdict lisait `null` à l'arrivée et renonçait. La fiche nationale
 *    n'affichait pas une phrase, faute d'une année où lire ses chiffres.
 *
 * Le seuil de couverture n'est pas délicat, et c'est ce qui le rend tenable :
 * mesuré sur la France, 2026 est porté par 6 % des séries et 2025 par 85 % de
 * ce que porte le mieux couvert. Aucun seuil entre les deux ne change la
 * réponse. Là où toutes les séries couvrent les mêmes exercices — l'OFGL d'une
 * commune — la règle ne retire rien.
 */
const COUVERTURE_MINIMALE = 0.5;

function exercicesQueLesComptesAtteignent(
  indicateurs: Indicateur[],
  territoire: Territoire,
): string[] {
  const couverture = new Map<string, number>();
  for (const indicateur of indicateurs) {
    for (const exercice of Object.keys(territoire.series?.[indicateur.id] ?? {})) {
      if (!/^\d{4}$/.test(exercice)) continue;
      couverture.set(exercice, (couverture.get(exercice) ?? 0) + 1);
    }
  }
  if (!couverture.size) return [];
  const meilleure = Math.max(...couverture.values());
  const exercices = [...couverture.keys()].sort();
  // L'arrivée est le dernier exercice réellement couvert ; tout ce qui vient
  // après est une prévision isolée, et tout ce qui vient avant reste dans la
  // fenêtre — un exercice ancien moins bien couvert qu'un autre n'en fait pas
  // moins partie de l'historique.
  const arrivee = exercices.filter(
    (ex) => (couverture.get(ex) ?? 0) >= meilleure * COUVERTURE_MINIMALE,
  ).pop();
  return arrivee === undefined ? [] : exercices.filter((ex) => ex <= arrivee);
}

/** Combien de lignes une question montre en mode « L'essentiel ». Au-delà, on
 *  retombe dans le déversement que cette refonte corrige : c'est « Tout voir »
 *  qui porte l'exhaustivité, pas l'ouverture. */
const LIGNES_PAR_QUESTION = 6;

/**
 * Combien de phrases le verdict affiche : cinq au plus.
 *
 * `verdict.ts` en propose six par défaut, deux par sujet, et sa raison est
 * écrite — trois questions valent mieux qu'une posée trois fois. La maquette
 * retenue en demande trois à cinq : au sixième rang, la phrase est déjà le
 * second fait d'un sujet déjà traité, et l'ouverture de la fiche redevient une
 * liste. Cinq laisse les trois sujets s'exprimer et en double deux.
 *
 * On en demande donc huit au module, dont les trois que le récit a déjà dites
 * seront retirées : voir `phrasesQuiCompletent`.
 */
const PHRASES_DE_VERDICT = 5;

/**
 * Le verdict dit ce que le récit n'a pas dit.
 *
 * Les deux lisent les mêmes faits, classés pareil : sans filtre, la première
 * puce répète mot pour mot la première phrase du paragraphe, et la fiche
 * s'ouvre sur un doublon là où on lui reproche déjà d'en avoir trop. Les faits
 * cités par le récit sortent donc du verdict, qui reprend la liste où le
 * paragraphe l'a laissée.
 *
 * Le filtre porte sur `vers`, l'indicateur : deux phrases du même indicateur
 * disent le même fait, quelle que soit la formulation.
 */
export function phrasesQuiCompletent(phrases: Phrase[], deja: string[]): Phrase[] {
  const dites = new Set(deja);
  return phrases.filter((p) => !dites.has(p.vers)).slice(0, PHRASES_DE_VERDICT);
}

/** La série de population qui sert de dénominateur au site : celle de l'OFGL,
 *  publiée chaque exercice. Le recensement, lui, ne l'est que tous les cinq
 *  ans — il ne peut pas mesurer une variation sur une fenêtre de mandat. */
const POPULATION_DU_MANDAT = "ofgl_population_reference";

/**
 * L'inflation cumulée entre deux exercices, en pourcentage.
 *
 * `insee_inflation_ipc` publie, mois par mois, le glissement sur douze mois de
 * l'indice des prix. La moyenne des douze mois d'une année est la hausse
 * moyenne des prix de cette année-là sur la précédente : c'est la définition de
 * l'inflation annuelle publiée par l'INSEE, et c'est elle qui se compose. On
 * multiplie donc les années **postérieures** à l'exercice de référence —
 * l'inflation de 2019 s'est produite avant lui et n'appartient pas à la
 * fenêtre. De 2019 à 2025, cela vaut +16,1 %.
 *
 * Une seule année manquante rend `null` : un cumul amputé d'un exercice se
 * lirait comme un cumul complet et sous-estimerait la hausse. Une donnée
 * absente n'écrit rien.
 */
export function inflationCumulee(
  ipc: Record<string, number> | undefined,
  reference: string,
  fin: string,
): number | null {
  if (!ipc) return null;
  const debut = Number(reference);
  const terme = Number(fin);
  if (!Number.isFinite(debut) || !Number.isFinite(terme) || terme <= debut) return null;
  let facteur = 1;
  for (let annee = debut + 1; annee <= terme; annee += 1) {
    const mois = Object.entries(ipc)
      .filter(([cle]) => cle.startsWith(`${annee}-`))
      .map(([, valeur]) => valeur)
      .filter((v) => Number.isFinite(v));
    if (mois.length < 12) return null;
    facteur *= 1 + mois.reduce((somme, v) => somme + v, 0) / mois.length / 100;
  }
  return (facteur - 1) * 100;
}

/** La variation de population sur la fenêtre, en pourcentage. Sans les deux
 *  bornes, rien : une hausse de dépenses ne se corrige pas d'une démographie
 *  qu'on ne connaît qu'à moitié. */
function variationPopulation(
  territoire: Territoire,
  reference: string,
  fin: string,
): number | null {
  const serie = territoire.series?.[POPULATION_DU_MANDAT];
  const depart = serie?.[reference];
  const arrivee = serie?.[fin];
  if (!depart || !arrivee || depart <= 0) return null;
  return ((arrivee - depart) / depart) * 100;
}

/** Le mois et l'année d'une date ISO, en français : « mars 2026 ». */
function moisEtAnnee(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/**
 * Le récit : ce que ce mandat a fait, en un titre et un paragraphe.
 *
 * C'est la pièce la plus importante de la fiche, et la seule qui parle avant
 * qu'on ait cliqué. Rien n'y est écrit à la main : le titre et le paragraphe
 * viennent de `recit.ts`, qui les compose à partir des séries publiées.
 */
function rendreRecit(histoire: Recit | null): string {
  if (!histoire) return "";
  return `<section class="recit">
    <h3 class="recit__titre">${echapper(histoire.titre)}</h3>
    <p class="recit__paragraphe">${echapper(histoire.paragraphe)}</p>
  </section>`;
}

/**
 * Le verdict : trois à cinq phrases chiffrées, chacune vers son détail.
 *
 * Une phrase dont l'indicateur cité n'a pas de ligne dans cette fiche n'est pas
 * cliquable : rien de cliquable ne mène à une section vide. Elle reste écrite —
 * le fait est vrai — mais elle ne promet pas un détail qui n'existe pas.
 */
function rendreVerdict(phrases: Phrase[], aUneLigne: (id: string) => boolean): string {
  if (!phrases.length) return "";
  const lignes = phrases
    .map((phrase) => {
      const texte = echapper(phrase.texte);
      const corps = aUneLigne(phrase.vers)
        ? `<button type="button" class="verdict__vers" data-verdict-vers="${echapper(
            phrase.vers,
          )}">${texte}</button>`
        : `<span class="verdict__texte">${texte}</span>`;
      return `<li class="verdict__phrase verdict__phrase--${echapper(phrase.sens)}">${corps}</li>`;
    })
    .join("");
  return `<ul class="verdict">${lignes}</ul>`;
}

/**
 * Le corps rangé par questions.
 *
 * Chaque question est un dépliant : elle montre son intitulé, et ses lignes
 * quand on l'ouvre. La première s'ouvre d'emblée — une fiche qui s'ouvre tout
 * plié demande un clic pour prouver qu'elle contient quelque chose.
 *
 * Une question dont aucune ligne ne s'écrit ne s'affiche pas. C'est la même
 * règle que partout : une donnée absente n'écrit rien, et un intitulé cliquable
 * qui ouvre du blanc est pire qu'un intitulé manquant.
 */
function rendreQuestions(
  indicateurs: Indicateur[],
  dessine: (indicateur: Indicateur) => string,
  rangDuTheme: (indicateur: Indicateur) => number,
  /** La phrase qui répond à la question et le pont qui l'explique, écrite sur
   *  la grosse masse de la question — pas sur sa première ligne. */
  ouvrir: (candidats: Indicateur[]) => string = () => "",
): string {
  const sections = repartir(indicateurs)
    .map(({ question, indicateurs: liste }) => {
      const ordonnes = teteDeLaQuestion(question, liste, rangDuTheme);
      const lignes = ordonnes.map(dessine).filter(Boolean).slice(0, LIGNES_PAR_QUESTION);
      return { question, lignes, phrase: ouvrir(ordonnes) };
    })
    .filter((s) => s.lignes.length > 0);
  if (!sections.length) return "";
  return `<div class="questions-fiche">${sections
    .map(
      ({ question, lignes, phrase }, index) => `<details class="question-fiche" data-question="${echapper(
        question.cle,
      )}"${index === 0 ? " open" : ""}>
        <summary aria-expanded="${index === 0}">${echapper(question.intitule)}</summary>
        <div class="question-fiche__corps">${phrase}${
          lignes.slice(0, CHIFFRES_EN_TETE).join("")
        }${
          // Le reste derrière un pli. Une question qui déverse six lignes
          // chiffrées répond six fois, et le lecteur repart sans réponse : la
          // phrase répond, trois chiffres la soutiennent, le reste attend
          // qu'on le demande.
          lignes.length > CHIFFRES_EN_TETE
            ? `<details class="question-fiche__reste">
                <summary>${lignes.length - CHIFFRES_EN_TETE} autre${
                  lignes.length - CHIFFRES_EN_TETE > 1 ? "s" : ""
                } mesure${lignes.length - CHIFFRES_EN_TETE > 1 ? "s" : ""}</summary>
                ${lignes.slice(CHIFFRES_EN_TETE).join("")}
              </details>`
            : ""
        }</div>
      </details>`,
    )
    .join("")}</div>`;
}

/** Trois chiffres sous la phrase, pas six. C'est le nombre que l'œil prend
 *  d'un coup, et au-delà la liste redevient le déversement qu'elle était. */
const CHIFFRES_EN_TETE = 3;

/**
 * La phrase qui répond à une question, et le pont qui explique son évolution.
 *
 * « Où va l'argent ? » recevait pour toute réponse six lignes chiffrées : le
 * lecteur voyait des masses et leur variation, sans jamais lire ce qui les
 * relie. La phrase pose l'agrégat de tête d'un bout à l'autre de la fenêtre —
 * 2019 et 2025, les deux millésimes que les autres phrases nomment déjà — et
 * `provenance.ts` y accroche la décomposition de cette variation, quand la
 * source publie de quoi l'établir et que les composantes redonnent le total.
 *
 * Rien n'est écrit sans les deux bouts : une masse dont un exercice manque n'a
 * pas d'évolution à raconter.
 */
function phraseDeLaQuestion(
  candidats: Indicateur[],
  territoire: Territoire,
  fenetre: { reference: string; arrivee: string } | null,
  catalogue: Indicateur[],
): string {
  if (!fenetre) return "";
  const lire = (id: string, exercice: string) => territoire.series?.[id]?.[exercice] ?? null;
  // **La grosse masse, pas la première ligne.** L'ordre d'affichage met en tête
  // ce qui se lit bien — « Services généraux et administration » à Bordeaux —
  // et cette ligne-là n'a pas de composantes publiées : la phrase posait un
  // montant sans jamais pouvoir l'expliquer. On prend donc le plus gros montant
  // de la question qui sache se décomposer, et à défaut le plus gros tout court.
  const mesurables = candidats
    .filter((i) => i.unite === "EUR")
    .map((i) => ({ i, fin: lire(i.id, fenetre.arrivee), debut: lire(i.id, fenetre.reference) }))
    .filter((c) => c.debut !== null && c.fin !== null && c.debut !== 0)
    .sort((a, b) => Math.abs(b.fin!) - Math.abs(a.fin!));
  if (!mesurables.length) return "";
  const avecPont = mesurables.find(
    (c) => provenanceSeule(c.i.id, lire, fenetre.reference, fenetre.arrivee, catalogue) !== "",
  );
  const choisi = avecPont ?? mesurables[0];
  const tete = choisi.i;
  const debut = choisi.debut as number;
  const fin = choisi.fin as number;
  // **Pas de pourcentage sur une base négative.** Un solde public qui passe de
  // −58 à −153 Md€ ne varie pas de « −162 % » : le déficit a presque triplé,
  // mais le rapport de deux nombres négatifs ne dit ni ce sens ni cette
  // ampleur. `verdict.ts` écarte déjà ces séries pour la même raison ; ici la
  // phrase reste, et c'est l'écart en euros qui la termine.
  const ecart = ((fin - debut) / Math.abs(debut)) * 100;
  const variation = debut > 0
    ? `soit ${ecart >= 0 ? "+" : "−"}${Math.abs(ecart).toLocaleString("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} %`
    : `soit ${fin - debut >= 0 ? "+" : "−"}${millions(Math.abs(fin - debut))}`;
  const trajet = `${echapper(traduire(tete.libelle))} : ${millions(debut)} en ${
    fenetre.reference
  }, ${millions(fin)} en ${fenetre.arrivee}, ${variation}`;
  const pont = provenanceSeule(tete.id, lire, fenetre.reference, fenetre.arrivee, catalogue);
  return `<p class="question-fiche__phrase"><strong>${trajet}.</strong>${
    pont ? ` ${echapper(pont)}` : ""
  }</p>`;
}

/** Les indicateurs d'une question, dans l'ordre où elle se lit : la tête
 *  déclarée d'abord, puis le reste par thème et par mesure phare. On en tire
 *  plus que nécessaire — une ligne sans valeur ici ne s'écrit pas, et couper
 *  avant de dessiner ferait une question vide là où il y avait de quoi la
 *  remplir. */
function teteDeLaQuestion(
  question: Question,
  liste: Indicateur[],
  rangDuTheme: (indicateur: Indicateur) => number,
): Indicateur[] {
  const tete = new Map(question.tete.map((id, index) => [id, index]));
  return [...liste].sort((a, b) => {
    const ta = tete.get(a.id) ?? Infinity;
    const tb = tete.get(b.id) ?? Infinity;
    if (ta !== tb) return ta - tb;
    return rangDuTheme(a) - rangDuTheme(b);
  });
}

/**
 * Une ligne, et une seule, sur le mandat qui vient de commencer.
 *
 * Les élections générales de mars 2026 ont installé des équipes dont aucun
 * exercice n'est publié : les comptes s'arrêtent à 2025. Le lecteur qui voit
 * « Maire depuis mars 2026 » au-dessus d'un bilan 2019-2025 doit savoir en un
 * coup d'œil que le second ne juge pas le premier. Une ligne suffit à le dire,
 * et un paragraphe pédagogique la ferait sauter.
 */
function ligneMandatEnCours(
  raconte: Mandat | null,
  aujourdhui: string,
  calendrier: string[],
): string {
  const encours = mandatEnCours(aujourdhui, calendrier);
  if (!raconte || raconte.debut === encours.debut) return "";
  return `<p class="fiche__mandat">Le mandat ouvert en ${echapper(
    moisEtAnnee(encours.debut),
  )} n'a pas encore de comptes publiés.</p>`;
}

/** La bascule des deux vitesses. « Tout voir » dit ce qu'il rouvre : un bouton
 *  qui cache cent quarante lignes doit annoncer leur nombre. */
function rendreVitesses(tout: boolean, lignes: number): string {
  return `<nav class="fiche__vitesses" aria-label="Niveau de détail">
    <button type="button" data-vitesse="essentiel" aria-pressed="${!tout}">L'essentiel</button>
    <button type="button" data-vitesse="tout" aria-pressed="${tout}">Tout voir<span
      class="fiche__vitesses-compte">${lignes} indicateurs</span></button>
  </nav>`;
}

export function afficherFiche(
  cible: HTMLElement,
  options: {
    niveau: string;
    territoire: Territoire;
    indicateurs: Indicateur[];
    jeux: Jeu[];
    periode: string;
    parHabitant: boolean;
    /** L'indicateur affiché sur la carte : seul à recevoir courbe et repères. */
    principal?: string;
    /** Faux quand la fiche ne correspond pas à ce que la carte peint — la
     *  fiche nationale d'accueil, dont aucune série n'est cartographiée.
     *  Écrire « sur la carte » enverrait alors chercher ce qui n'y est pas. */
    marquerCarte?: boolean;
    /** Position du territoire dans la couche affichée, si elle est chargée. */
    rang?: { position: number; total: number };
    /** Libellé lisible d'un thème (la table vit dans main.ts). */
    libelleTheme?: (theme: string) => string;
    /** Territoires de comparaison (son département, sa région, la France) :
     *  leurs valeurs se tracent sur chaque courbe. Ce sont des chiffres
     *  publiés pour ces mailles, pas des médianes — ils existent donc même
     *  là où le secret de diffusion interdit toute médiane communale. */
    comparateurs?: { libelle: string; territoire: Territoire }[];
    comparaison?: string;
    /** Absent des publications antérieures aux repères : la fiche s'affiche
     *  alors sans eux, plutôt que de refuser de s'afficher. */
    references?: References | null;
    /** Où se tient la commune parmi ses semblables, indicateur par indicateur
     *  et exercice par exercice — la cascade de `comparaisons.json`. C'est ce
     *  qui décide quels faits du mandat sortent du lot. Absent au département
     *  et à la région, qui n'ont pas de strate publiée. */
    semblables?: (indicateur: string, exercice: string) => Repere | null;
    /** Cet indicateur a-t-il une couche à peindre ? Sans ce prédicat, aucune
     *  mesure ne propose la carte — c'est le repli sûr. */
    peintSurCarte?: (indicateur: Indicateur) => boolean;
    /** Les associations subventionnées de cette commune. Chargées à part, par
     *  département : absentes, le thème garde son seul agrégat. */
    associations?: SubventionsCommune;
    /** Les indicateurs dont la valeur nationale est notre somme des régions.
     *  Absents, aucune mention n'est faite — plutôt qu'une mention fausse. */
    agregats?: AgregatsNationaux | null;
    /** L'indice des prix national, pour dire ce qu'une évolution doit à
     *  l'inflation. Absent, la phrase n'est pas écrite. */
    inflation?: Record<string, number>;
    /** L'IPC national mensuel (`insee_inflation_ipc`), d'où se tire l'inflation
     *  cumulée sur la fenêtre du mandat. Ce module est pur : il ne va pas la
     *  chercher, on la lui donne. Absent, le récit se passe du repère des prix
     *  plutôt que d'en inventer un. */
    serieInflation?: Record<string, number>;
    /** La date du jour, en ISO court. Elle décide quel mandat se raconte :
     *  écrite ici, les tests sont déterministes. */
    aujourdhui?: string;
    /** Vrai quand le lecteur a demandé « Tout voir ». Par défaut, la fiche
     *  s'ouvre sur l'essentiel. */
    tout?: boolean;
  },
): void {
  const { territoire, indicateurs, periode, parHabitant, niveau } = options;
  const references = options.references ?? null;
  const principal = options.principal ?? indicateurs[0]?.id;
  const enTete = indicateurs.find((i) => i.id === principal);
  // Tout le catalogue est déjà là — les séries du territoire arrivent en un
  // seul fichier. Les thèmes se suivent donc dans le panneau, valeurs
  // comprises : il n'y a plus rien à sélectionner ailleurs pour voir un
  // chiffre, on fait défiler. Cliquer une ligne la porte sur la carte.
  const groupes = new Map<string, Indicateur[]>();
  // Le thème complet, celui de la carte compris : le résumé d'un thème porte
  // sur tous ses indicateurs, y compris celui qui est déjà affiché en tête.
  // L'exclure du calcul aurait donné « 13 indicateurs comparés » sous un titre
  // qui en annonce 14.
  const parTheme = new Map<string, Indicateur[]>();
  for (const indicateur of indicateurs) {
    parTheme.set(indicateur.theme, [...(parTheme.get(indicateur.theme) ?? []), indicateur]);
    if (indicateur.id === principal) continue;
    groupes.set(indicateur.theme, [...(groupes.get(indicateur.theme) ?? []), indicateur]);
  }
  // L'onglet ouvert est celui de l'indicateur peint sur la carte : la fiche
  // s'ouvre sur ce que le lecteur regarde déjà.
  const themeActif = enTete?.theme ?? ordonnerThemes([...parTheme.keys()])[0] ?? "";
  // Le nombre qui double chaque taux rejoint le taux : trente-deux lignes de
  // sécurité pour seize phénomènes, c'était le doublon le plus visible du site.
  //
  // Mais seulement là où le taux existe. Au niveau France, la délinquance n'a
  // que ses effectifs — un taux ne s'additionne pas, la moyenne de dix-huit
  // taux régionaux n'est pas le taux national. Replier le nombre derrière un
  // taux absent aurait vidé le thème entier : le doublon disparaissait, et la
  // mesure avec lui.
  const paires = new Map(
    [...jumeaux(indicateurs)].filter(([taux]) => territoire.series?.[taux] !== undefined),
  );
  const doubles = new Set(paires.values());
  // Une ligne n'est dessinée qu'une fois : la même chaîne sert au corps par
  // questions et au corps par thèmes. Sans cette mémoire, les deux vitesses
  // recalculaient deux fois cent quarante séries, courbes et mini-tableaux
  // compris — le prix d'une seconde fiche pour un mode qu'on ne regarde pas.
  const dessinees = new Map<string, string>();
  const dessine = (indicateur: Indicateur): string => {
    const deja = dessinees.get(indicateur.id);
    if (deja !== undefined) return deja;
    const html = ligneIndicateur(
      indicateur, territoire, periode, parHabitant, niveau, references,
      indicateur.id === principal && options.marquerCarte !== false,
      indicateur.id === principal ? options.rang : undefined,
      options.comparateurs,
      options.peintSurCarte,
      paires.get(indicateur.id),
      { inflation: options.inflation, catalogue: options.indicateurs },
    );
    dessinees.set(indicateur.id, html);
    return html;
  };
  const comparateurs = options.comparateurs ?? [];
  const sections =
    ordonnerThemes([...parTheme.keys()])
      .flatMap((theme) => {
        const liste = ordonnerTheme(theme, parTheme.get(theme) as Indicateur[]).filter(
          (i) => !doubles.has(i),
        );
        // Ce que le thème montre d'emblée, et ce qu'il garde derrière un pli.
        // L'indicateur peint sur la carte reste toujours visible : le replier
        // cacherait celui qu'on est en train de regarder.
        // L'ordre de la table est celui de la lecture — ce que la collectivité
        // dépense d'abord, d'où vient l'argent ensuite — et non l'ordre du
        // catalogue, qui est alphabétique et ne raconte rien.
        const retenus = RETENUS[theme];
        // Les lignes-identités passent derrière le pli même sans liste RETENUS :
        // « population active » redit « occupés + chômeurs », deux inflations
        // côte à côte se lisent comme une erreur.
        const visibles = liste.filter((i) => i.id === principal || !REPLIES.has(i.id));
        const devant = retenus
          ? visibles
              .filter((i) => retenus.includes(i.id) || i.id === principal)
              .sort(
                (a, b) =>
                  (retenus.indexOf(a.id) + 1 || retenus.length + 1) -
                  (retenus.indexOf(b.id) + 1 || retenus.length + 1),
              )
          : visibles;
        const derriere = liste.filter((i) => !devant.includes(i));
        // Les lignes réellement écrites, pas celles qu'on a essayé d'écrire :
        // une mesure sans valeur ici rend une chaîne vide, et « 12 autres
        // lignes » en annonçait alors trois.
        const lignesDevant = devant.map(dessine).filter(Boolean);
        const lignesDerriere = derriere.map(dessine).filter(Boolean);
        const associations =
          theme === "vie_associative" ? rendreAssociations(options.associations) : "";
        // Une donnée absente n'écrit rien, et cela vaut pour la navigation.
        // L'onglet « Justice » s'affichait sur chaque fiche communale et
        // ouvrait une section blanche : la densité carcérale n'est mesurée
        // qu'au département. Ni onglet muet, ni cul-de-sac — le thème renvoie
        // vers la maille qui porte la donnée quand elle existe au-dessus, et
        // disparaît quand elle n'existe nulle part.
        if (!lignesDevant.length && !lignesDerriere.length && !associations) {
          const renvoi = renvoiVersLaMaillePorteuse(liste, territoire, niveau, comparateurs);
          return renvoi ? [{ theme, contenu: renvoi }] : [];
        }
        const suite = lignesDerriere.length
          ? `<details class="theme-groupe__suite">
              <summary>Tout le détail <span class="theme-groupe__compte">${
                lignesDerriere.length
              } autre${lignesDerriere.length > 1 ? "s lignes" : " ligne"}</span></summary>
              ${lignesDerriere.join("")}
            </details>`
          : "";
        return [
          {
            theme,
            contenu: `
          ${resumeTheme(
            liste, territoire, periode, parHabitant, niveau, references, comparateurs,
          )}
          ${mentionAgregat(liste, options.agregats, niveau)}
          ${associations}
          ${lignesDevant.join("")}
          ${suite}
        `,
          },
        ];
      });
  // L'onglet ouvert doit exister : si le thème de la carte n'a plus de section
  // — aucune de ses mesures n'est publiée ici — c'est le premier thème restant
  // qui s'ouvre, plutôt qu'un panneau vide.
  const themesRetenus = sections.map((s) => s.theme);
  const ouvert = themesRetenus.includes(themeActif) ? themeActif : themesRetenus[0] ?? themeActif;
  const mesures = sections
    .map(
      (s) =>
        `<section class="theme-groupe" data-theme="${echapper(s.theme)}"${
          s.theme === ouvert ? "" : " hidden"
        }>${s.contenu}</section>`,
    )
    .join("");
  // Situer le territoire plutôt que l'identifier. Le code INSEE figurait ici
  // pour départager les homonymes — il y a trois Sainte-Marie et douze
  // Saint-Martin — mais « 69123 » ne dit cela à personne : il fallait déjà
  // connaître la réponse pour la lire. La maille du dessus la donne en clair.
  // C'est le premier comparateur : département pour une commune, région pour
  // un département. Au-dessus, c'est la France, qui ne situe rien.
  //
  // Et cliquable : « Gironde » écrit en gris obligeait à retaper le nom du
  // département dans la recherche pour y monter. C'est un bouton, avec le code
  // et la maille de la cible ; le gestionnaire vit dans main.ts, par délégation.
  const dessus = comparateurs[0];
  const situe =
    dessus && dessus.libelle !== "la France"
      ? ` · ${boutonParent(dessus, mailleDuComparateur(dessus.libelle, territoire, niveau))}`
      : "";

  /* ---- L'ouverture : le mandat raconté, le récit, le verdict, les questions.
     Tout ce qui suit est calculé après les sections de thèmes, parce que le
     verdict a besoin de savoir quelles lignes existent : une phrase ne renvoie
     jamais vers une section vide. ---- */
  const aujourdhui = options.aujourdhui ?? new Date().toISOString().slice(0, 10);
  // Les exercices qui bornent un mandat sont ceux des comptes, pas ceux du
  // recensement : la fenêtre d'un bilan financier se lit sur des exercices
  // budgétaires. Ce sont exactement les indicateurs que les quatre questions
  // d'argent rassemblent.
  const calendrier = calendrierDe(niveau);
  const exercicesDesComptes = exercicesQueLesComptesAtteignent(
    repartir(indicateurs)
      .filter(({ question }) => QUESTIONS_D_ARGENT.has(question.cle))
      .flatMap(({ indicateurs: liste }) => liste),
    territoire,
  );
  // Une maille qui n'élit pas d'assemblée n'a pas de mandat — mais elle a des
  // exercices. Le pays était la seule fiche du site sans récit et sans ses deux
  // vitesses, pour une raison qui n'en justifiait qu'une : plaquer une
  // législature sur un budget serait faux, ne rien raconter ne l'est pas moins.
  // La fenêtre est alors comptable, et les phrases disent « depuis 2019 ».
  const raconte = !exercicesDesComptes.length
    ? null
    : calendrier
      ? mandatRaconte(exercicesDesComptes, aujourdhui, calendrier)
      : fenetreRacontee(exercicesDesComptes);
  const contexte: Contexte | null = raconte
    ? {
        mandat: raconte,
        series: territoire.series ?? {},
        inflation: inflationCumulee(
          options.serieInflation,
          raconte.exerciceReference,
          raconte.exerciceFin,
        ),
        population: variationPopulation(
          territoire,
          raconte.exerciceReference,
          raconte.exerciceFin,
        ),
        nom: territoire.nom,
        avecPreposition: niveau === "commune" || niveau === "arrondissement_municipal",
        semblables: options.semblables,
        // « Sur le mandat » n'a de sens que là où une élection l'a ouvert.
        fenetre: calendrier ? "sur le mandat" : `depuis ${raconte.exerciceReference}`,
        // De quoi attribuer la variation d'un agrégat à ses composantes. La
        // liste est celle des indicateurs de la maille : une composante qui n'y
        // est pas fait échouer le contrôle de somme, donc rien ne s'affiche
        // plutôt qu'une attribution amputée.
        catalogue: options.indicateurs,
      }
    : null;
  const histoire = contexte ? recit(contexte) : null;
  const phrases = contexte
    ? phrasesQuiCompletent(verdict(contexte, PHRASES_DE_VERDICT + 3), histoire?.cites ?? [])
    : [];
  // `dessinees` s'est remplie en construisant les sections de thèmes : elle dit
  // exactement quelles lignes la fiche écrit, et donc où un renvoi peut mener.
  const aUneLigne = (id: string) => Boolean(dessinees.get(id));
  const rangDuTheme = (indicateur: Indicateur) => {
    const place = ORDRE_THEMES.indexOf(indicateur.theme);
    const phares = PHARES[indicateur.theme] ?? [];
    const rang = phares.indexOf(indicateur.id);
    return (place === -1 ? ORDRE_THEMES.length : place) * 1000 +
      (rang === -1 ? phares.length : rang);
  };
  const fenetreDuPont = raconte
    ? { reference: raconte.exerciceReference, arrivee: raconte.exerciceFin }
    : null;
  const corpsQuestions = rendreQuestions(
    indicateurs.filter((i) => !doubles.has(i) && !REPLIES.has(i.id)),
    dessine,
    rangDuTheme,
    (candidats) => phraseDeLaQuestion(candidats, territoire, fenetreDuPont, options.indicateurs),
  );
  // La feuille d'impôts descend en bas de fiche.
  //
  // Elle occupait la troisième place de l'ouverture, entre le bilan et les
  // questions, alors qu'elle ne répond à aucune des quatre : c'est une
  // estimation de ce qu'un foyer paie, pas un compte de la collectivité. Elle
  // repoussait vers le bas ce que le lecteur vient chercher.
  const feuille = rendreFeuilleDImpots(territoire);
  const essentiel = `${rendreRecit(histoire)}${rendreVerdict(phrases, aUneLigne)}${corpsQuestions}`;
  // Deux vitesses partout où il y a deux vitesses à offrir.
  //
  // La condition était « un bilan à raconter » : sans récit ni verdict, pas de
  // bouton. La France, les départements et les régions gardaient donc une
  // interface à eux, non parce qu'ils n'ont rien à montrer — la fiche France
  // porte cent quatre-vingt-dix séries — mais parce que le paragraphe rédigé
  // manquait. C'était confondre la mise en page et le texte : le récit demande
  // des règles écrites sur des séries que toutes les mailles n'ont pas, la
  // séparation « L'essentiel / Tout voir », elle, ne demande que d'avoir
  // quelque chose à mettre des deux côtés.
  //
  // La condition porte donc sur ce qu'il y a à voir : une ouverture — récit,
  // verdict, feuille d'impôts ou questions — et un détail derrière. Là où l'un
  // des deux manque, la fiche reste d'un seul tenant plutôt que d'ouvrir un
  // onglet vide, ce qui reste la règle du site.
  const ouverture = Boolean(histoire) || phrases.length > 0
    || Boolean(feuille) || corpsQuestions.trim().length > 0;
  const deuxVitesses = ouverture && mesures.trim().length > 0;
  const lignesEcrites = [...dessinees.values()].filter(Boolean).length;

  cible.innerHTML = `
    <h2 class="fiche__titre">${echapper(territoire.nom)}</h2>
    <p class="fiche__meta">${NIVEAUX[niveau] ?? niveau}${situe}${
      // La population porte sa définition en infobulle et rien d'autre : elle
      // était soulignée en pointillé, c'est-à-dire habillée en lien, alors
      // qu'aucun clic ne mène nulle part. La classe dit au style de ne pas
      // souligner celle-ci (voir `.fiche__habitants`).
      territoire.population
        ? ` · <abbr class="fiche__habitants" title="Population municipale (INSEE). Les montants par habitant utilisent la population de référence de l'Observatoire des finances locales : détail dans Sources et méthode.">${new Intl.NumberFormat(
            "fr-FR",
          ).format(territoire.population)} hab.</abbr>`
        : ""
    }</p>
    ${
      territoire.maire
        ? `<p class="fiche__maire">Maire : <strong>${echapper(territoire.maire.nom)}</strong>${
            territoire.maire.depuis
              ? ` <span>depuis ${echapper(
                  new Date(territoire.maire.depuis).toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric",
                  }),
                )}</span>`
              : ""
          }</p>`
        : ""
    }
    ${calendrier ? ligneMandatEnCours(raconte, aujourdhui, calendrier) : ""}
    ${deuxVitesses ? rendreVitesses(options.tout === true, lignesEcrites) : ""}
    ${
      // Ce que le lecteur voit d'abord : une phrase qui dit le bilan, les
      // chiffres qui la soutiennent, ce qu'il paie, puis les questions.
      deuxVitesses ? `<div class="fiche__essentiel" data-corps="essentiel">${essentiel}</div>` : ""
    }
    ${
      // Et la fiche d'avant, intacte, derrière « Tout voir » : synthèse,
      // position dans le groupe, rapports, enchaînement. Rien n'en est retiré —
      // c'est la condition pour que la refonte ne coûte aucune donnée.
      `<div class="fiche__tout"${deuxVitesses ? ' data-corps="tout"' : ""}>
        ${syntheseTerritoire(
          indicateurs, territoire, periode, parHabitant,
          options.comparateurs ?? [], references, niveau, options.libelleTheme,
        )}
        ${
          // « Où se situe cette commune parmi ses semblables » est l'une des
          // questions les plus posées : elle était en dernier, repliée, après
          // cinq écrans de défilement. Elle se lit maintenant avec la synthèse.
          options.comparaison ?? ""
        }
        ${
          // Les comptes en rapports, avant le détail des masses : « 62 millions
          // de dette » ne dit que la taille de la collectivité, « onze ans
          // d'épargne » dit sa situation.
          rendreRatios(territoire, niveau)
        }
        ${
          // Puis l'enchaînement lui-même, replié : les rapports disent si ça
          // tient, le pont dit où l'argent passe.
          rendrePont(territoire, indicateurs)
        }
      </div>`
    }
    ${
      // Les thèmes qui ont une section, et eux seuls : un onglet cliquable
      // n'ouvre jamais du blanc. Les barres restent enfants directs de `.fiche`
      // — c'est leur `order` qui les remonte sous le nom du territoire, et un
      // enfant d'enfant n'est plus un élément flex.
      ongletsThemes(themesRetenus, ouvert, options.libelleTheme)
    }
    <div class="mesures"${deuxVitesses ? ' data-corps="tout"' : ""}>${mesures}</div>
    ${feuille ? `<section class="feuille-impots">${feuille}</section>` : ""}
  `;
}

/**
 * « 641 pour 1 000 habitants, contre 505 pour son département. »
 *
 * La lecture de repli d'un effectif, pour l'ouverture de la fiche. Elle ne dit
 * rien de plus que la ligne détaillée du même indicateur — c'est la règle de la
 * synthèse : ne rien affirmer qui ne soit ailleurs dans le panneau, chiffre à
 * l'appui.
 *
 * Elle ne remplace jamais une comparaison directe : elle n'apparaît que là où
 * il n'y en a pas, c'est-à-dire sur les grandeurs qui ne se comparent qu'une
 * fois rapportées aux habitants.
 */
export function lectureDeDensite(
  densite: { valeur: number; comparaisons: { libelle: string; valeur: number }[] } | null,
): string {
  if (!densite) return "";
  const repere = densite.comparaisons.find((c) => Number.isFinite(c.valeur) && c.valeur > 0);
  if (!repere) return "";
  // Le pourcentage, pas les deux densités côte à côte : « 653 pour 1 000 hab.,
  // contre 568 pour 1 000 hab. pour son département » demandait une
  // soustraction de tête pour arriver à ce que « +15 % » dit tout seul.
  const ecart = ecartRelatif(densite.valeur, repere.valeur);
  if (ecart) return `${ecart} vs ${repere.libelle}, par habitant.`;
  // Sauf quand le pourcentage ne compare plus rien : les deux densités, alors,
  // et le lecteur voit l'écart de ses yeux.
  const ici = densiteLisible(densite.valeur);
  return ici ? `${ici} ici, ${densiteLisible(repere.valeur)} pour ${repere.libelle}.` : "";
}

/** « +15 % » — l'écart relatif signé, arrondi à l'entier. */
function signeEcart(valeur: number, repere: number): string {
  const ecart = ((valeur - repere) / repere) * 100;
  return `${ecart >= 0 ? "+" : "−"}${Math.round(Math.abs(ecart))}\u202f%`;
}

/**
 * L'écart relatif, quand il compare encore quelque chose.
 *
 * `repereComparable` (synthese.ts) refuse déjà les rapports où le repère est
 * cent fois plus petit que la valeur : passé ce facteur, le pourcentage mesure
 * la petitesse du dénominateur et non la position du territoire. Sur une
 * micro-commune, cent est encore trop lâche. Rochefourchat, deux habitants,
 * affichait « +2 280 % vs la médiane » (facteur 24) et « +1 178 % » dans son
 * groupe (facteur 13) : exacts, et illisibles.
 *
 * Un ordre de grandeur suffit ici. Le seuil est plus serré que celui des
 * repères de lecture parce que ces écarts-ci s'affichent **seuls** : `lecture`
 * écrit « +24 % vs la médiane (866 €) » et pose donc le repère à côté du
 * pourcentage, là où `signeEcart` écrivait « +2 280 % » et rien d'autre.
 *
 * De part et d'autre de zéro, il n'y a pas d'écart relatif du tout. Un effectif
 * nul face à un repère positif donnait « −100 % » sous chaque ligne d'une
 * commune de deux habitants : « chômeurs 0, −100 % vs son département »
 * n'apprend rien que le zéro ne dise déjà, et le signe suggère une baisse là où
 * il n'y a qu'une absence.
 *
 * `null` : l'appelant pose alors les deux chiffres côte à côte, ou se tait.
 */
const FACTEUR_ECART = 10;

function ecartALEchelle(valeur: number, repere: number): boolean {
  return (
    Number.isFinite(valeur) && Number.isFinite(repere) && repere !== 0 &&
    memeSens(valeur, repere) &&
    Math.abs(valeur) <= Math.abs(repere) * FACTEUR_ECART
  );
}

function ecartRelatif(valeur: number, repere: number): string | null {
  return ecartALEchelle(valeur, repere) ? signeEcart(valeur, repere) : null;
}

/** Les repères qu'on peut encore convertir en pourcentage, pour les fonctions
 *  de `synthese.ts` qui s'en chargent elles-mêmes. Un repère de signe opposé
 *  n'est pas écarté : `lecture` sait le dire en posant les deux chiffres, et
 *  c'est ce qu'on veut. Seule l'échelle est en cause. */
function reperesALEchelle(
  valeur: number,
  comparaisons: { libelle: string; valeur: number }[],
): { libelle: string; valeur: number }[] {
  return comparaisons.filter(
    (c) =>
      !Number.isFinite(c.valeur) || c.valeur === 0 ||
      !memeSens(valeur, c.valeur) ||
      ecartALEchelle(valeur, c.valeur),
  );
}

/** Le repère posé à côté du chiffre, sans pourcentage. La tournure est celle
 *  que `lecture` emploie déjà pour deux grandeurs de signes opposés : une
 *  seule forme dans toute la fiche pour « voici les deux nombres ». */
function contreLeRepere(
  comparaisons: { libelle: string; valeur: number }[],
  formate: (v: number) => string,
): string {
  const repere = comparaisons.find((c) => Number.isFinite(c.valeur) && c.valeur !== 0);
  return repere ? `Contre ${formate(repere.valeur)} pour ${repere.libelle}.` : "";
}

/**
 * La valeur d'une commune, ramenée à la base sur laquelle les quartiles de son
 * groupe ont été calculés.
 *
 * Le dénominateur est **la population de référence de l'OFGL de l'exercice**,
 * jamais la population municipale du recensement. Ce sont deux nombres
 * différents pour la même commune la même année — définitions et millésimes
 * distincts — et la publication calcule les quartiles avec le premier. Le site
 * plaçait la commune avec le second : deux grandeurs sur un seul axe.
 *
 * L'écart n'est pas théorique. Sur les 534 communes de la Gironde en 2025, 43
 * — une sur douze — changeaient de quartile selon le dénominateur retenu. La
 * Brède passait du deuxième au troisième : 888 € par habitant contre 1 000 €.
 * Sur Bordeaux l'écart était de quatre euros, assez petit pour n'avoir jamais
 * alerté.
 *
 * -> undefined quand la commune n'a pas de population de référence pour cet
 * exercice : la publication l'écarte alors du calcul des quartiles, et la
 * placer quand même serait la comparer à un groupe dont elle ne fait pas
 * partie.
 */
export function valeurComparable(
  territoire: Territoire,
  indicateur: string,
  periode: string,
  base: { base: "par_habitant" | "pour_mille" | "valeur" } | undefined,
): number | undefined {
  const brut = territoire.series[indicateur]?.[periode];
  if (brut === undefined) return undefined;
  if (base?.base === "valeur") return brut;
  const habitants = territoire.series["ofgl_population_reference"]?.[periode];
  if (!habitants) return undefined;
  return (brut / habitants) * (base?.base === "pour_mille" ? 1000 : 1);
}

/**
 * Le groupe le plus fin qui existe pour cette commune, et les critères qui le
 * définissent.
 *
 * La publication calcule plusieurs découpages du même ensemble : cinq critères,
 * puis trois, puis deux. Un découpage fin compare mieux — une station de
 * montagne face à des stations de montagne — mais laisse sans groupe les
 * communes trop singulières, dont la strate tombe sous le seuil de vingt. Les
 * essayer dans l'ordre donne à chacune le meilleur repère qu'elle puisse avoir,
 * plutôt que le même repère grossier pour toutes ou aucun repère pour les
 * atypiques.
 *
 * Les critères retenus sont renvoyés avec les quartiles : ils ne sont pas les
 * mêmes d'une commune à l'autre, et l'affichage doit dire lesquels ont servi.
 */
export function groupeDeLaCommune(
  territoire: Territoire,
  parIndicateur: Record<string, Quartiles> | undefined,
  cascade: string[][],
): { quartiles: Quartiles; criteres: string[] } | undefined {
  if (!parIndicateur) return undefined;
  const drapeaux = (territoire.drapeaux ?? {}) as Record<string, string>;
  for (const [rang, criteres] of cascade.entries()) {
    const cle = `${rang}:${criteres.map((c) => drapeaux[c] ?? "").join("|")}`;
    const quartiles = parIndicateur[cle];
    if (quartiles) return { quartiles, criteres };
  }
  return undefined;
}

/**
 * Position d'une commune parmi ses semblables. Le groupe est défini par des
 * critères publiés par l'OFGL, affichés avec le résultat : sans eux, « communes
 * comparables » ne veut rien dire. Aucun classement, aucun jugement — une
 * position dans une distribution, et le nombre de communes qui la composent.
 */
export function positionDansGroupe(
  territoire: Territoire,
  quartiles: { n: number; q1: number; mediane: number; q3: number } | undefined,
  valeurComparee: number | undefined,
  criteres: string[],
  /** Ce à quoi se rapportent les quartiles. Une dépense et un nombre de
   *  logements se comparent à l'habitant ; une médiane de revenus et un taux de
   *  pauvreté se comparent tels qu'ils sont publiés. Sans cette base, les trois
   *  quartiles s'affichaient en euros par habitant quoi qu'ils mesurent —
   *  c'est ainsi qu'un taux de pauvreté de 11 % se serait lu « 11 € ». */
  base: { base: "par_habitant" | "pour_mille" | "valeur"; unite: string } = {
    base: "par_habitant",
    unite: "EUR",
  },
): string {
  if (!quartiles || valeurComparee === undefined) return "";
  void criteres;
  const ecrire =
    base.base === "pour_mille"
      ? densiteLisible
      : (v: number) => formater(v, base.unite, base.base === "par_habitant");
  const situation =
    valeurComparee < quartiles.q1
      ? "dans le quart le plus bas"
      : valeurComparee > quartiles.q3
        ? "dans le quart le plus haut"
        : "dans la moitié centrale";
  // Une phrase, pas un tableau. Les quatre lignes de quartiles demandaient de
  // savoir ce qu'est un quartile ; « +67 % vs la médiane, dans le quart le
  // plus haut » se comprend sans. Les critères du groupe et la réserve sur
  // l'intercommunalité sont sur la page « Données » — écrits ici, ils
  // faisaient six lignes de texte avant le premier chiffre du panneau.
  // Passé un ordre de grandeur, le pourcentage ne situe plus la commune, il
  // dit que la médiane de son groupe est quasi nulle : « Parmi 959 communes
  // semblables : +1 178 % » sur une commune de deux habitants. Les deux
  // chiffres, alors, et rien d'autre.
  const ecart = quartiles.mediane ? ecartRelatif(valeurComparee, quartiles.mediane) : null;
  const relatif = ecart
    ? `${ecart} vs la médiane (${ecrire(quartiles.mediane)}), `
    : `ici ${ecrire(valeurComparee)}, médiane ${ecrire(quartiles.mediane)} : `;
  return `<section class="position">
    <p class="position__phrase">Parmi <strong>${quartiles.n}</strong> communes semblables :
      ${relatif}<strong>${situation}</strong>.</p>
  </section>`;
}
