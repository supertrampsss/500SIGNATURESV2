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
  beneficiaires: {
    siren: string;
    nom: string;
    programme: string;
    objet: string | null;
    montant: number;
  }[];
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

export const comparaisons = () => lire<Comparaisons>("comparaisons.json");
export const budgetEtat = () => lire<BudgetEtat>("budget-etat.json");
export const depensesFiscales = () => lire<DepensesFiscales>("depenses-fiscales.json");
export const subventions = (lot: string) =>
  lire<Record<string, SubventionsCommune>>(`subventions/commune/${lot}.json`);
export const fraicheur = () => lire<Fraicheur[]>("fraicheur.json");
export const journal = () => lire<Changement[]>("journal.json");
export const references = () => lire<import("./reference.ts").References>("references.json");

export const urlTuiles = () => cleTuiles;

/** Racine publique des fichiers publiés : le site n'a pas d'accès privilégié,
 *  ce que lit la carte est ce que peut lire n'importe qui (docs/10). */
export const racinePubliee = () => `${BASE}/data`;
