/**
 * Bloc national : dette publique française et comparaison européenne.
 *
 * Deux avertissements sont structurels, pas décoratifs : les sous-secteurs de
 * dette ne s'additionnent pas au total, et un chiffre national ne se compare à
 * un autre pays que s'il vient d'une définition harmonisée (docs/00, §7).
 */

import type { Indicateur, Territoire } from "./donnees";
import { formater } from "./echelle";

const SOUS_SECTEURS = [
  "insee_dette_etat_montant",
  "insee_dette_asso_montant",
  "insee_dette_apul_montant",
  "insee_dette_odac_montant",
];

const VOISINS = ["FR", "DE", "ES", "IT", "NL", "EA20"];
const NOMS_PAYS: Record<string, string> = {
  FR: "France",
  DE: "Allemagne",
  ES: "Espagne",
  IT: "Italie",
  NL: "Pays-Bas",
  EA20: "Zone euro",
};

function derniere(serie: Record<string, number> | undefined): [string, number] | null {
  if (!serie) return null;
  const periodes = Object.keys(serie).sort();
  const derniereP = periodes[periodes.length - 1];
  return derniereP ? [derniereP, serie[derniereP]] : null;
}

/** Courbe SVG minimale : pas de bibliothèque, pas d'animation, axes lisibles. */
function courbe(serie: Record<string, number>, unite: string): string {
  const points = Object.entries(serie).sort(([a], [b]) => a.localeCompare(b));
  if (points.length < 2) return "";
  const valeurs = points.map(([, v]) => v);
  const min = Math.min(...valeurs);
  const max = Math.max(...valeurs);
  const etendue = max - min || 1;
  const largeur = 320;
  const hauteur = 90;
  const trace = points
    .map(([, v], i) => {
      const x = (i / (points.length - 1)) * largeur;
      const y = hauteur - ((v - min) / etendue) * hauteur;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const premier = points[0];
  const dernier = points[points.length - 1];
  return `
    <svg class="courbe" viewBox="0 0 ${largeur} ${hauteur}" role="img"
         aria-label="Évolution de ${premier[0]} (${formater(premier[1], unite, false)})
         à ${dernier[0]} (${formater(dernier[1], unite, false)})">
      <path d="${trace}" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
    <p class="courbe__bornes"><span>${premier[0]}</span><span>${dernier[0]}</span></p>`;
}

export function afficherNational(
  blocDette: HTMLElement,
  blocEurope: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const france = pays["FR"];
  if (!france) return false;
  const fiche = (id: string) => catalogue.find((i) => i.id === id);

  const totalPib = derniere(france.series["insee_dette_apu_part_pib"]);
  const total = derniere(france.series["insee_dette_apu_montant"]);
  if (total && totalPib) {
    const detail = SOUS_SECTEURS.map((id) => {
      const valeur = derniere(france.series[id]);
      const libelle = fiche(id)?.libelle ?? id;
      return valeur
        ? `<li><span>${libelle.replace("Dette de ", "").replace("Dette des ", "")}</span>
             <strong>${formater(valeur[1], "EUR", false)}</strong></li>`
        : "";
    }).join("");
    blocDette.innerHTML = `
      <h3>Dette publique</h3>
      <p class="bloc__chiffre">
        <strong>${formater(total[1], "EUR", false)}</strong>
        <span class="millesime">${total[0]}</span>
      </p>
      <p class="bloc__complement">soit <strong>${totalPib[1].toFixed(1)} %</strong> du produit
        intérieur brut</p>
      ${courbe(france.series["insee_dette_apu_part_pib"], "percent")}
      <h4>Qui la porte</h4>
      <ul class="repartition">${detail}</ul>
      <p class="avertissement">Ces montants sont ceux de la comptabilité nationale et
        couvrent toutes les administrations publiques. Le total n'est pas la somme
        exacte des lignes ci-dessus : la dette entre administrations est consolidée.</p>`;
  }

  const lignes = VOISINS.filter((code) => pays[code])
    .map((code) => {
      const series = pays[code].series;
      const cellule = (id: string, suffixe = " %") => {
        const valeur = derniere(series[id]);
        return valeur ? `${valeur[1].toFixed(1)}${suffixe}` : "—";
      };
      return `<tr${code === "FR" ? ' class="souligne"' : ""}>
        <th scope="row">${NOMS_PAYS[code] ?? code}</th>
        <td>${cellule("eurostat_dette_pib")}</td>
        <td>${cellule("eurostat_deficit_pib")}</td>
        <td>${cellule("eurostat_chomage")}</td>
      </tr>`;
    })
    .join("");
  const annee = derniere(pays["FR"].series["eurostat_dette_pib"])?.[0] ?? "";
  blocEurope.innerHTML = `
    <h3>La France et ses voisins</h3>
    <table class="comparaison">
      <caption>Année ${annee} · sources harmonisées Eurostat</caption>
      <thead><tr><th scope="col">Pays</th><th scope="col">Dette / PIB</th>
        <th scope="col">Déficit / PIB</th><th scope="col">Chômage</th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <p class="avertissement">Ces chiffres viennent d'Eurostat, qui applique la même
      définition à tous les pays : c'est ce qui rend la comparaison possible. Ils
      peuvent différer légèrement des chiffres publiés par chaque institut national.
      Un déficit est un nombre négatif.</p>`;
  return true;
}
