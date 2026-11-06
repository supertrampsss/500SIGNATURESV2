import type { EntreeRecherche } from "../donnees.ts";

export type CodesPostaux = Record<string, string[]>;

/** Les mots restent distincts : « Saint-Émilion », « saint emilion » et « Émilion » se retrouvent. */
export const normaliserRecherche = (texte: string) => texte.normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, " ").trim();

/** Ne choisit jamais à la place du lecteur ; conserve le total avant la limite d'affichage. */
export function rechercherCommunes(index: EntreeRecherche[], saisie: string, postaux: CodesPostaux = {}) {
  const q = normaliserRecherche(saisie);
  if (q.length < 2) return { resultats: [] as EntreeRecherche[], total: 0 };
  const mots = q.split(" ");
  const codes = new Set(postaux[q] ?? []);
  const correspondances = index.filter(e => e.l === "commune" && (
    e.c.toLowerCase() === q || codes.has(e.c) || mots.every(mot => normaliserRecherche(e.n).split(" ").some(n => n.startsWith(mot)))
  )).sort((a, b) => Number(normaliserRecherche(b.n) === q) - Number(normaliserRecherche(a.n) === q)
    || a.n.length - b.n.length || a.n.localeCompare(b.n, "fr") || a.c.localeCompare(b.c));
  return { resultats: correspondances.slice(0, 8), total: correspondances.length };
}

/** Un seul résultat peut s'ouvrir directement ; une liste ambiguë exige un choix explicite. */
export function communeChoisie(resultats: EntreeRecherche[], total: number, actif: number): EntreeRecherche | undefined {
  return actif >= 0 ? resultats[actif] : total === 1 ? resultats[0] : undefined;
}
