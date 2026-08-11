/**
 * Accès aux fichiers publiés. Le site ne parle jamais à une base de données :
 * il lit des fichiers versionnés servis par le CDN (docs/03 §3).
 */

const BASE = import.meta.env.VITE_DONNEES_URL ?? "https://pub-fc39d357004540a182a907aed4875ef5.r2.dev";

export type Indicateur = {
  id: string;
  libelle: string;
  unite: string;
  theme: string;
  sommable: boolean;
  cadre_comptable: string | null;
  niveaux: string[];
  definition: string;
  definition_technique: string;
  formule: string;
  confiance: string;
  badges: string[];
  jeu: string;
  periodes: string[];
  /** Périodes réellement disponibles à chaque niveau (docs/10). */
  periodes_par_niveau?: Record<string, string[]>;
  /**
   * Ce que le producteur compte, quand il le nomme : « infractions »,
   * « victimes », « personnes mises en cause », « véhicules ». Deux séries qui
   * ne comptent pas la même chose ne s'additionnent pas — c'est ce champ qui
   * permet au site de le vérifier plutôt que de l'affirmer.
   */
  unite_de_compte?: string | null;
  /** L'agrégat qui contient celui-ci, quand la source en déclare un. C'est ce
   *  qui permet d'ouvrir un total sur ses composantes plutôt que de les aligner
   *  à côté de lui. Absent des publications antérieures à la hiérarchie. */
  parent?: string | null;
  /** L'agrégat que cet indicateur décompose **par destination** — à quoi sert
   *  l'argent, plutôt que ce qu'on achète. Les deux axes décrivent le même
   *  total et ne s'additionnent jamais entre eux. */
  parent_fonction?: string | null;
  /** Le producteur recalcule l'historique dans la géographie d'aujourd'hui : une
   *  fusion de communes ne coupe pas cette série. Absent = non recalculé. */
  geographie_courante?: boolean;
};

export type Jeu = {
  id: string;
  titre: string;
  producteur: string;
  licence: string;
  url: string;
  extraction: string;
};

export type Manifeste = { version: string; genere_le: string; jeux: Jeu[] };

export type Territoire = {
  nom: string;
  parent: string | null;
  population: number | null;
  drapeaux: Record<string, unknown>;
  series: Record<string, Record<string, number>>;
  /** Fusions et scissions subies : une série qui les enjambe change de sujet.
   *  Absent des publications antérieures à ce champ. */
  evenements?: { type: string; date: string; avec: string }[];
  /** Région d'appartenance : l'ensemble auquel le territoire se compare. */
  region?: string | null;
  /** Maire en exercice (RNE). Nom et prise de fonction seulement : ni date de
   *  naissance, ni sexe, ni profession ne sont chargés. */
  maire?: { nom: string; depuis: string | null };
};

export type EntreeRecherche = { c: string; n: string; l: string; p: string | null };

let racine = "";
let cleTuiles = "";
const cache = new Map<string, Promise<unknown>>();

async function lire<T>(chemin: string): Promise<T> {
  if (!cache.has(chemin)) {
    cache.set(
      chemin,
      fetch(`${racine}/${chemin}`).then((r) => {
        if (!r.ok) throw new Error(`${chemin} indisponible (${r.status})`);
        return r.json();
      }),
    );
  }
  return cache.get(chemin) as Promise<T>;
}

export async function initialiser(): Promise<Manifeste> {
  const [donnees, tuiles] = await Promise.all([
    fetch(`${BASE}/data/derniere.json`).then((r) => r.json()),
    fetch(`${BASE}/geo/derniere.json`).then((r) => r.json()),
  ]);
  racine = `${BASE}/data/${donnees.version}`;
  cleTuiles = `${BASE}/${tuiles.cle}`;
  return lire<Manifeste>("manifeste.json");
}

export const indicateurs = () => lire<Indicateur[]>("indicateurs.json");

export const valeursCarte = (indicateur: string, niveau: string, periode: string) =>
  lire<Record<string, number>>(`carte/${indicateur}/${niveau}/${periode}.json`);

export const territoires = (niveau: string, lot: string) =>
  lire<Record<string, Territoire>>(`territoires/${niveau}/${lot}.json`);

/** L'index léger d'une maille : noms et dénominateurs, sans les séries. C'est
 *  ce que lit la carte ; les lots ci-dessus ne servent plus qu'aux fiches.
 *  Absent des publications antérieures à ce fichier — l'appelant retombe alors
 *  sur les lots. */
export const indexTerritoires = (niveau: string) =>
  lire<import("./repertoire.ts").IndexTerritoires>(`territoires/${niveau}/index.json`);

/** L'index de recherche pèse deux mégaoctets : il n'est chargé qu'à la première frappe. */
export const indexRecherche = () => lire<EntreeRecherche[]>("recherche.json");

export type Comparaisons = {
  criteres: string[];
  /** Les jeux de critères, du plus fin au plus large. La fiche essaie les rangs
   *  dans l'ordre et retient le premier groupe qui existe pour sa commune :
   *  cinq critères pour une commune ordinaire, trois pour une commune atypique,
   *  et aucune ne perd son repère en gagnant en finesse. Absent des versions
   *  publiées avant la cascade — `criteres` sert alors de rang unique. */
  cascade?: string[][];
  /** Ce à quoi se rapportent les quartiles d'un indicateur : une dépense ou un
   *  effectif se comparent à l'habitant, une médiane ou un taux se comparent
   *  tels qu'ils sont publiés. Sans cette indication, l'affichage formaterait
   *  un taux de pauvreté en euros par habitant. */
  bases?: Record<string, { base: "par_habitant" | "pour_mille" | "valeur"; unite: string }>;
  groupes: Record<string, Record<string, Record<string, Quartiles>>>;
};
export type Quartiles = { n: number; q1: number; mediane: number; q3: number };

export type Fraicheur = {
  jeu: string;
  titre: string;
  priorite: string;
  frequence: string | null;
  derniere_extraction: string | null;
  retard_jours: number | null;
  dernier_run: string | null;
  controles_echoues: number;
  /** Absent des publications antérieures à ce champ : distinct d'une liste vide. */
  anomalies?: Anomalie[];
  /** Chiffres déjà publiés dont la valeur a changé lors d'un rechargement des
   *  90 derniers jours. Absent des publications antérieures : « non suivi »
   *  n'est pas « zéro révision ». */
  valeurs_revisees_90j?: number;
};

/** Un contrôle en échec au dernier chargement : ce qui n'a pas été publié. */
export type Anomalie = {
  nom: string;
  severite: string;
  constat: Record<string, unknown> | null;
};

export type EtapeBudget = { cle: string; libelle: string };
export type LigneBudget = {
  libelle: string;
  cote: "depense" | "recette" | null;
  titre: string | null;
  agregat: boolean;
  /** Total qui contient cette ligne, ou null pour une tête de rubrique. */
  parent: string | null;
  indicateur: string | null;
};
export type MontantsEtape = {
  solde: number | null;
  solde_comptes_speciaux: number | null;
  solde_budgets_annexes: number | null;
  montants: Record<string, number>;
};
export type BudgetEtat = {
  etapes: EtapeBudget[];
  lignes: LigneBudget[];
  exercices: Record<string, Record<string, MontantsEtape>>;
  quarantaine: Record<string, string[]>;
};

/** Une dépense fiscale, dispositif par dispositif : un impôt non perçu. */
export type Dispositif = {
  numero: string;
  libelle: string;
  mission: string | null;
  montants: Record<string, number>;
};
export type DepensesFiscales = {
  exercices: string[];
  /** L'exercice constaté ; les autres sont des prévisions du même document. */
  realise: string | null;
  dispositifs: Dispositif[];
};

/**
 * Les associations subventionnées d'une commune, la plus dotée d'abord.
 *
 * Publié par département, comme les fiches : cinquante-trois mille lignes en un
 * fichier feraient télécharger la France entière pour lire une commune. Absent
 * des publications antérieures — le bloc ne s'affiche alors pas, la fiche
 * s'affiche quand même.
 */
export type SubventionsCommune = {
  exercice: string;
  /** Le total versé au titre de chaque programme budgétaire, du plus gros au
   *  plus petit. « À quelles associations » appelle « au titre de quoi » : le
   *  programme est la seule typologie du jaune qui soit un vocabulaire
   *  contrôlé. Absent des publications antérieures. */
  programmes?: { code: string; libelle: string; mission: string; montant: number }[];
  beneficiaires: {
    siren: string;
    nom: string;
    programme: string;
    objet: string | null;
    montant: number;
  }[];
};

/**
 * Ce que la fiche France doit à nos additions plutôt qu'à une source.
 *
 * Un total national obtenu en sommant dix-huit régions n'est pas un chiffre
 * publié par le producteur : c'est notre calcul, et le dire fait partie du
 * chiffre. Le périmètre aussi — France entière, outre-mer compris, alors que
 * beaucoup de chiffres nationaux publiés ailleurs s'arrêtent à la métropole.
 */
export type AgregatsNationaux = {
  regions_attendues: number;
  perimetre: string;
  indicateurs: string[];
  ecartes: { indicateur: string; periode: string; regions_manquantes: string[] }[];
};

/** Une entrée du journal public : un chiffre a bougé, ou a cessé d'être servi. */
export type Changement = {
  annonce: string;
  type: string;
  jeu: string | null;
  indicateur: string | null;
  effet_au: string | null;
  public: string;
  technique: string | null;
};

/**
 * Le simulateur du budget de l'État : un arbre réglable par exercice, et
 * l'index qui dit lesquels sont publiés.
 *
 * Ces deux fichiers sont les seuls que le site ne demande **pas** au démarrage.
 * L'arbre du PLF pèse plus de cent kilo-octets pour une page que la plupart des
 * lecteurs n'ouvriront pas : il n'est chargé qu'à l'ouverture du simulateur.
 * L'index, lui, est minuscule, et sans lui rien ne dirait s'il y a un
 * simulateur à proposer.
 */
export const simulateurIndex = () => lire<unknown>("simulateur/index.json");
export const simulateurBudget = (exercice: string) =>
  lire<import("./simulateur.ts").Budget>(`simulateur/etat-${exercice}.json`);

/**
 * Le budget de la Sécurité sociale : le même simulateur, une autre matière.
 *
 * Son index est distinct de celui de l'État, et ce n'est pas une commodité de
 * nommage : le PLFSS et le PLF ne portent pas les mêmes exercices, et le site
 * doit pouvoir proposer l'un quand l'autre manque.
 */
export const simulateurIndexSecu = () => lire<unknown>("simulateur/index-secu.json");

/**
 * Les cinq branches des régimes de base, chacune dans son fichier.
 *
 * **Un fichier par branche, et aucun fichier qui les rassemble.** Additionner
 * les cinq donnerait 19 019 M€ de charges de trop : un transfert entre branches
 * est compté en charge chez l'une et en produit chez l'autre, et la
 * consolidation le retire des deux côtés. Le site n'a donc pas de total à
 * charger, parce qu'il n'y en a pas.
 *
 * Ce que l'on a le droit de faire, en revanche, est vérifié à l'ingestion : les
 * cinq **soldes** font exactement le solde consolidé. Régler la branche
 * vieillesse déplace donc le solde de la Sécurité sociale d'autant, et c'est ce
 * qui rend les retraites simulables.
 *
 * L'index liste des clés `branche-exercice` — « vieillesse-2026 » — parce que
 * les branches n'ont aucune raison de porter toutes les mêmes exercices.
 */
export const simulateurIndexBranches = () => lire<unknown>("simulateur/index-branches.json");
export const simulateurBranche = (cle: string) =>
  lire<import("./simulateur.ts").Budget>(`simulateur/branche-${cle}.json`);

/** Le barème de l'impôt sur le revenu : la distribution des foyers fiscaux par
 *  tranche de revenu, et ce que chaque tranche d'un barème refait rapporterait.
 *  Ce n'est pas un budget — ni dépenses, ni recettes, ni solde — d'où un
 *  fichier et un index à lui. */
export const simulateurIndexBareme = () => lire<unknown>("simulateur/index-bareme.json");
export const simulateurBareme = (exercice: string) =>
  lire<import("./bareme.ts").Bareme>(`simulateur/bareme-${exercice}.json`);

/** Le récapitulatif en comptabilité nationale. Un seul fichier, sans index :
 *  il porte lui-même son exercice, et il pèse quelques centaines d'octets. */
export const recapitulatifNational = () =>
  lire<import("./recapitulatif.ts").Recapitulatif>("simulateur/comptabilite-nationale.json");
export const simulateurBudgetSecu = (exercice: string) =>
  lire<import("./simulateur.ts").Budget>(`simulateur/secu-${exercice}.json`);

/** Le budget d'un échelon de collectivités, agrégé sur tous ses territoires.
 *
 *  Un fichier par échelon, et **aucun fichier « collectivités locales »** : les
 *  trois ne s'additionnent pas — transferts croisés entre échelons, et les
 *  intercommunalités ne sont plus publiées dans ce jeu de données. Le site n'a
 *  donc pas de total à charger, parce qu'il n'y en a pas. */
export const simulateurCollectivites = (echelon: string) =>
  lire<import("./simulateur.ts").Budget>(`simulateur/collectivites-${echelon}.json`);

/** Les bénéficiaires nommés d'un programme budgétaire. Absent des publications
 *  antérieures : le tiroir ne s'ouvre alors pas, plutôt que d'échouer. */
export type SubventionsProgramme = {
  exercice: string;
  plafond: number;
  programmes: Record<
    string,
    {
      libelle: string;
      mission: string;
      declare: number;
      beneficiaires_total: number;
      beneficiaires: { siren: string; nom: string; objet: string | null; montant: number }[];
    }
  >;
};
export const subventionsParProgramme = () =>
  lire<SubventionsProgramme>("subventions/programme.json");

export const comparaisons = () => lire<Comparaisons>("comparaisons.json");
export const budgetEtat = () => lire<BudgetEtat>("budget-etat.json");
export const depensesFiscales = () => lire<DepensesFiscales>("depenses-fiscales.json");
export const subventions = (lot: string) =>
  lire<Record<string, SubventionsCommune>>(`subventions/commune/${lot}.json`);
export const fraicheur = () => lire<Fraicheur[]>("fraicheur.json");
export const journal = () => lire<Changement[]>("journal.json");

export const urlTuiles = () => cleTuiles;
