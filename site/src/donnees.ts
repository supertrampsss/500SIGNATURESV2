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

export const urlTuiles = () => cleTuiles;
