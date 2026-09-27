/** Une comparaison courte avec des communes proches, à année et unité identiques. */
import type { IndexTerritoires } from "./repertoire.ts";
import { populationsDuRepertoire } from "./repertoire.ts";
import { groupeDe, intituleGroupe, type Groupe } from "./semblables.ts";

type Comptes = Record<string, Record<string, number>>;

const INDICATEURS = [
  { id: "ofgl_recettes_fonctionnement", libelle: "Recettes de fonctionnement", objet: "les recettes de fonctionnement" },
  { id: "ofgl_depenses_fonctionnement", libelle: "Dépenses de fonctionnement", objet: "les dépenses de fonctionnement" },
  { id: "ofgl_encours_dette", libelle: "Dette en fin d’année", objet: "la dette en fin d’année" },
] as const;

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
});
const entier = new Intl.NumberFormat("fr-FR");

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
  const nom = index.noms[index.codes.indexOf(code)] ?? "Cette ville";
  const comparaisons = INDICATEURS.map(({ id, libelle, objet }) => {
    const couche = comptes[id] ?? {};
    const courant = couche[code];
    if (!Number.isFinite(courant) || !habitants[code] || courant < 0) return null;
    const pairs = proches
      .map((autre) => ({ code: autre, valeur: couche[autre] / habitants[autre] }))
      .filter(({ valeur }) => Number.isFinite(valeur) && valeur >= 0);
    if (pairs.length < 3) return null;
    const ville = courant / habitants[code];
    const reference = mediane(pairs.map(({ valeur }) => valeur));
    if (reference <= 0) return null;
    const ecart = (ville / reference - 1) * 100;
    const difference = Math.round(ville) - Math.round(reference);
    return { id, libelle, objet, couche, pairs, ville, reference, ecart, difference };
  }).filter((valeur): valeur is NonNullable<typeof valeur> => valeur !== null);
  if (!comparaisons.length) return '<p class="villes-paires__vide">Les comptes publiés ne permettent pas de calculer une médiane pour ces villes proches.</p>';
  const marquante = [...comparaisons].sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))[0];
  const variation = marquante.difference === 0 ? "un montant proche de la médiane" :
    `${euros.format(Math.abs(marquante.difference))} ${marquante.difference > 0 ? "de plus" : "de moins"} par habitant`;
  const cartes = comparaisons.map(({ libelle, couche, pairs, ville, reference, difference }) => `<article class="villes-paires__carte">
      <h3>${libelle}</h3>
      <div class="villes-paires__montants"><p><span>${echapper(nom)} · par hab.</span><strong>${echapper(euros.format(ville))}</strong></p><p><span>Médiane de ${entier.format(pairs.length)} villes</span><strong>${echapper(euros.format(reference))}</strong></p></div>
      ${proches.map((autre) => {
        const valeur = couche[autre] / habitants[autre];
        return `<p class="villes-paires__choisie" data-ville-compare="${echapper(autre)}" hidden><span>${echapper(index.noms[index.codes.indexOf(autre)] ?? autre)} · par hab.</span><strong>${Number.isFinite(valeur) && valeur >= 0 ? echapper(euros.format(valeur)) : "Non publié"}</strong></p>`;
      }).join("")}
      <p class="villes-paires__ecart">Écart : ${difference === 0 ? "0 €" : `${difference > 0 ? "+" : "−"}${echapper(euros.format(Math.abs(difference)))}`} par habitant</p>
    </article>`);
  const noms = proches.map((autre) => {
    const rang = index.codes.indexOf(autre);
    return `<li>${echapper(index.noms[rang] ?? autre)} · ${entier.format(index.population_municipale[rang] ?? 0)} hab.</li>`;
  }).join("");
  return `<section class="villes-paires" aria-label="Comparaison avec des villes de taille proche">
    <p class="villes-paires__groupe">${entier.format(proches.length)} communes de même catégorie et de population proche · comptes ${echapper(exercice)}.</p>
    <div class="villes-paires__lecture"><span>Ce que montre la comparaison</span><p>À ${echapper(nom)}, l’écart le plus marqué concerne ${echapper(marquante.objet)} : ${echapper(euros.format(marquante.ville))} contre ${echapper(euros.format(marquante.reference))} pour la médiane, soit ${echapper(variation)}.</p></div>
    <div class="villes-paires__grille">${cartes.join("")}</div>
    <label class="villes-paires__select">Comparer directement avec une ville
      <select data-villes-comparer><option value="">Choisir une ville</option>${proches.map((autre) => `<option value="${echapper(autre)}">${echapper(index.noms[index.codes.indexOf(autre)] ?? autre)}</option>`).join("")}</select>
    </label>
    <p class="villes-paires__methode">Une dette plus élevée ne suffit pas à juger la capacité de remboursement. Montants en euros par habitant · Sources : <a href="/sources/">INSEE et OFGL</a>.</p>
    <details><summary>Quelles villes sont comparées ?</summary><p>Catégorie ${echapper(intituleGroupe(groupe))} ; population à ± 35 % de cette ville. Médiane des communes ayant publié chaque montant. Population municipale : INSEE${index.millesime_geographique ? `, référentiel ${index.millesime_geographique}` : ""} ; comptes et population de référence : OFGL.</p><ul>${noms}</ul></details>
  </section>`;
}
