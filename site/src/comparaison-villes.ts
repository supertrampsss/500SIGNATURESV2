/** Une comparaison courte avec des communes proches, à année et unité identiques. */
import type { IndexTerritoires } from "./repertoire.ts";
import { populationsDuRepertoire } from "./repertoire.ts";
import { groupeDe, intituleGroupe, type Groupe } from "./semblables.ts";

type Comptes = Record<string, Record<string, number>>;

const INDICATEURS = [
  { id: "ofgl_recettes_fonctionnement", libelle: "Recettes de fonctionnement" },
  { id: "ofgl_depenses_fonctionnement", libelle: "Dépenses de fonctionnement" },
  { id: "ofgl_encours_dette", libelle: "Dette en fin d’année" },
] as const;

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
});
const entier = new Intl.NumberFormat("fr-FR");
const pourcent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function echapper(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c] as string);
}

/** Dix communes au plus, dans la même catégorie publiée et à ± 35 % d'habitants. */
export function villesProches(index: IndexTerritoires, code: string): string[] {
  const groupe = groupeDe(index, code);
  return groupe ? selectionVillesProches(index, code, groupe) : [];
}

function selectionVillesProches(index: IndexTerritoires, code: string, groupe: Groupe): string[] {
  const rang = index.codes.indexOf(code);
  const population = index.population_municipale[rang];
  if (!population || population <= 0) return [];
  return index.codes
    .map((autre, i) => ({ code: autre, population: index.population_municipale[i] }))
    .filter((autre): autre is { code: string; population: number } =>
      autre.code !== code && groupe.codes.has(autre.code) &&
      autre.population !== null && autre.population > 0 &&
      Math.abs(autre.population / population - 1) <= 0.35)
    .sort((a, b) => Math.abs(a.population - population) - Math.abs(b.population - population) || a.code.localeCompare(b.code))
    .slice(0, 10)
    .map((autre) => autre.code);
}

function mediane(valeurs: number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
}

/** Les montants par habitant utilisent la population de référence de l'exercice. */
export function rendreComparaisonVilles(
  index: IndexTerritoires, code: string, exercice: string, comptes: Comptes,
): string {
  const groupe = groupeDe(index, code);
  if (!groupe) return '<p class="villes-paires__vide">Aucun groupe de communes comparables n’est publié pour cette ville.</p>';
  const proches = selectionVillesProches(index, code, groupe);
  if (proches.length < 3) return '<p class="villes-paires__vide">Moins de trois communes de la même catégorie ont une population à ± 35 % : la comparaison chiffrée n’est pas disponible.</p>';
  const habitants = populationsDuRepertoire(index, exercice);
  const cartes = INDICATEURS.map(({ id, libelle }) => {
    const couche = comptes[id] ?? {};
    const courant = couche[code];
    if (!Number.isFinite(courant) || !habitants[code] || courant < 0) return "";
    const pairs = proches
      .map((autre) => ({ code: autre, valeur: couche[autre] / habitants[autre] }))
      .filter(({ valeur }) => Number.isFinite(valeur) && valeur >= 0);
    if (pairs.length < 3) return "";
    const ville = courant / habitants[code];
    const reference = mediane(pairs.map(({ valeur }) => valeur));
    if (reference <= 0) return "";
    const ecart = (ville / reference - 1) * 100;
    const sens = Math.abs(ecart) < 0.05 ? "Au même niveau que la médiane" :
      `${pourcent.format(Math.abs(ecart))} % ${ecart > 0 ? "au-dessus" : "en dessous"} de la médiane`;
    return `<article class="villes-paires__carte">
      <h3>${libelle}</h3>
      <div class="villes-paires__montants"><p><span>Cette ville · par hab.</span><strong>${echapper(euros.format(ville))}</strong></p><p><span>Médiane de ${entier.format(pairs.length)} villes · par hab.</span><strong>${echapper(euros.format(reference))}</strong></p></div>
      ${proches.map((autre) => {
        const valeur = couche[autre] / habitants[autre];
        return `<p class="villes-paires__choisie" data-ville-compare="${echapper(autre)}" hidden><span>${echapper(index.noms[index.codes.indexOf(autre)] ?? autre)} · par hab.</span><strong>${Number.isFinite(valeur) && valeur >= 0 ? echapper(euros.format(valeur)) : "Non publié"}</strong></p>`;
      }).join("")}
      <p class="villes-paires__ecart">${echapper(sens)}</p>
    </article>`;
  }).filter(Boolean);
  if (!cartes.length) return '<p class="villes-paires__vide">Les comptes publiés ne permettent pas de calculer une médiane pour ces villes proches.</p>';
  const noms = proches.map((autre) => {
    const rang = index.codes.indexOf(autre);
    return `<li>${echapper(index.noms[rang] ?? autre)} · ${entier.format(index.population_municipale[rang] ?? 0)} hab.</li>`;
  }).join("");
  return `<section class="villes-paires" aria-label="Comparaison avec des villes de taille proche">
    <h3>Face à des villes de taille proche</h3>
    <p>${entier.format(proches.length)} communes retenues, dans la catégorie ${echapper(intituleGroupe(groupe))}, avec une population à ± 35 % de celle de cette ville.</p>
    <label class="villes-paires__select">Comparer avec une ville du groupe
      <select data-villes-comparer><option value="">Choisir une ville</option>${proches.map((autre) => `<option value="${echapper(autre)}">${echapper(index.noms[index.codes.indexOf(autre)] ?? autre)}</option>`).join("")}</select>
    </label>
    <div class="villes-paires__grille">${cartes.join("")}</div>
    <p class="villes-paires__methode">Montants en euros par habitant, exercice ${echapper(exercice)}. Écart calculé par rapport à la médiane des communes ayant publié chaque montant. Population municipale : INSEE${index.millesime_geographique ? `, référentiel ${index.millesime_geographique}` : ""} ; population de référence des ratios et comptes : OFGL. <a href="/sources/">Sources et méthode</a>.</p>
    <details><summary>Voir les villes retenues</summary><ul>${noms}</ul></details>
  </section>`;
}
