/**
 * Accès aux fichiers publiés. Le site ne parle jamais à une base de données :
 * il lit des fichiers versionnés servis par le CDN.
 */

const BASE = import.meta.env.VITE_DONNEES_URL ?? "https://pub-fc39d357004540a182a907aed4875ef5.r2.dev";

export type Territoire = {
  nom: string;
  parent: string | null;
  population: number | null;
  drapeaux: Record<string, unknown>;
  series: Record<string, Record<string, number>>;
};

export type EntreeRecherche = { c: string; n: string; l: string; p: string | null };

let racine = "";
const cache = new Map<string, Promise<unknown>>();

async function lire<T>(chemin: string): Promise<T> {
  if (!cache.has(chemin)) {
    cache.set(chemin, fetch(`${racine}/${chemin}`).then((r) => {
      if (!r.ok) throw new Error(`${chemin} indisponible (${r.status})`);
      return r.json();
    }));
  }
  return cache.get(chemin) as Promise<T>;
}

/** Lit la version publiée ; les lectures suivantes portent toutes sur elle. */
export async function initialiser(): Promise<string> {
  const { version } = await fetch(`${BASE}/data/derniere.json`).then((r) => r.json());
  racine = `${BASE}/data/${version}`;
  return version;
}

export const territoires = (niveau: string, lot: string) =>
  lire<Record<string, Territoire>>(`territoires/${niveau}/${lot}.json`);

/** L'index de recherche pèse deux mégaoctets : il n'est chargé qu'à la première frappe. */
export const indexRecherche = () => lire<EntreeRecherche[]>("recherche.json");
