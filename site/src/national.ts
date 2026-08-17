/**
 * Bloc national : dette publique française et comparaison européenne.
 *
 * Deux avertissements sont structurels, pas décoratifs : les sous-secteurs de
 * dette ne s'additionnent pas au total, et un chiffre national ne se compare à
 * un autre pays que s'il vient d'une définition harmonisée (docs/00, §7).
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { nomPays } from "./pays-noms.ts";
import { formater, SUFFIXE_POUR_100000 } from "./echelle.ts";

const SOUS_SECTEURS = [
  "insee_dette_etat_montant",
  "insee_dette_asso_montant",
  "insee_dette_apul_montant",
  "insee_dette_odac_montant",
];

const VOISINS = ["FR", "DE", "ES", "IT", "NL", "EA20"];

/**
 * Les pensions, dans le tableau des voisins.
 *
 * « La France dépense trop pour ses retraites » est une phrase qu'on entend
 * sans jamais le chiffre qui la juge, et ce chiffre n'a de sens qu'à côté de
 * ceux des voisins : un pays qui verse ses pensions par des fonds privés en
 * dépense peu au sens public sans que ses retraités touchent moins. Le
 * SESPROS compte les mêmes prestations partout, quels que soient les régimes
 * qui les servent — c'est la seule base qui rende la comparaison honnête.
 *
 * Le total, et non la seule vieillesse : réversion, invalidité et préretraite
 * sont des pensions, et les retrancher déplacerait le chiffre français de
 * plusieurs points de PIB sans que la colonne le dise. La série de la seule
 * vieillesse est publiée à côté, sur la fiche de la France.
 */
const RETRAITES = "eurostat_retraites_pib";

/** Et la vieillesse seule, à côté du total.
 *
 *  Publier une série qu'aucun écran ne montre est le défaut que le registre
 *  appelle « les séries invisibles » : celle-ci l'était, seule des six séries
 *  européennes neuves. Elle a sa colonne parce qu'elle apprend quelque chose —
 *  la part des pensions qui n'est pas de la retraite de droit direct varie
 *  beaucoup d'un pays à l'autre, et c'est elle qui rend deux totaux
 *  comparables ou non. */
const VIEILLESSE = "eurostat_retraites_vieillesse_pib";


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

/**
 * Rendu pur du bloc DETTE, sans DOM : c'est lui qui est testé.
 *
 * Chaîne vide dans les deux cas où le bloc ne s'écrivait pas : pas de France
 * publiée, ou pas de total de dette — en montant ET en part de PIB, car le
 * bloc pose les deux l'un sous l'autre et n'en montre pas un seul.
 */
export function renduDette(
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): string {
  const france = pays["FR"];
  if (!france) return "";
  const fiche = (id: string) => catalogue.find((i) => i.id === id);

  const totalPib = derniere(france.series["insee_dette_apu_part_pib"]);
  const total = derniere(france.series["insee_dette_apu_montant"]);
  if (!total || !totalPib) return "";

  const detail = SOUS_SECTEURS.map((id) => {
    const valeur = derniere(france.series[id]);
    const libelle = fiche(id)?.libelle ?? id;
    return valeur
      ? `<li><span>${libelle.replace("Dette de ", "").replace("Dette des ", "")}</span>
             <strong>${formater(valeur[1], "EUR", false)}</strong></li>`
      : "";
  }).join("");
  return `
      <h3>Dette publique</h3>
      <p class="bloc__chiffre">
        <strong>${formater(total[1], "EUR", false)}</strong>
        <span class="millesime">${total[0]}</span>
      </p>
      <p class="bloc__complement">soit <strong>${formater(totalPib[1], "percent", false)}</strong>
        du produit intérieur brut</p>
      ${courbe(france.series["insee_dette_apu_part_pib"], "percent")}
      <h4>Qui la porte</h4>
      <ul class="repartition">${detail}</ul>
`;
}

/**
 * Rendu pur du bloc EUROPE, sans DOM : c'est lui qui est testé.
 *
 * Chaîne vide dans le seul cas où le bloc ne s'écrivait pas : pas de France
 * publiée. Un voisin absent du lot perd sa ligne, un voisin sans valeur garde
 * la sienne en tirets — c'est le tableau qui le dit, pas ce module.
 */
export function renduEurope(pays: Record<string, Territoire>): string {
  if (!pays["FR"]) return "";
  const lignes = VOISINS.filter((code) => pays[code])
    .map((code) => {
      const series = pays[code].series;
      const cellule = (id: string) => {
        const valeur = derniere(series[id]);
        return valeur ? formater(valeur[1], "percent", false) : "—";
      };
      return `<tr${code === "FR" ? ' class="souligne"' : ""}>
        <th scope="row">${nomPays(code)}</th>
        <td>${cellule("eurostat_dette_pib")}</td>
        <td>${cellule("eurostat_deficit_pib")}</td>
        <td>${cellule("eurostat_chomage")}</td>
        <td>${cellule(RETRAITES)}</td>
        <td>${cellule(VIEILLESSE)}</td>
      </tr>`;
    })
    .join("");
  const annee = derniere(pays["FR"].series["eurostat_dette_pib"])?.[0] ?? "";
  // Les pensions ne sortent pas du même millésime que la dette : le SESPROS
  // publie deux ans après l'exercice, la dette dans l'année. Dater toute la
  // colonne de l'année du tableau ferait dire à ce chiffre ce qu'il ne dit
  // pas ; son année est donc écrite dans son intitulé, une fois.
  const anneeRetraites = derniere(pays["FR"].series[RETRAITES])?.[0] ?? "";
  return `
    <h3>La France et ses voisins</h3>
    <table class="comparaison" tabindex="0">
      <caption>Année ${annee} · sources harmonisées Eurostat</caption>
      <thead><tr><th scope="col">Pays</th><th scope="col">Dette / PIB</th>
        <th scope="col">Déficit / PIB</th><th scope="col">Chômage</th>
        <th scope="col">Pensions / PIB${
          anneeRetraites ? ` <span class="millesime">${anneeRetraites}</span>` : ""
        }</th>
        <th scope="col">dont vieillesse</th></tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    ${renduVieQuotidienne(pays)}
    <p class="avertissement">Ces chiffres viennent d'Eurostat, qui applique la même
      définition à tous les pays : c'est ce qui rend la comparaison possible. Ils
      peuvent différer légèrement des chiffres publiés par chaque institut national.
      Un déficit est un nombre négatif.</p>`;
}

/**
 * Ce que la comparaison européenne dit d'autre que des finances publiques.
 *
 * Le tableau des voisins ne portait que de l'argent public, et le site ne
 * disait donc rien de deux questions qu'il porte pourtant commune par commune :
 * qui vit avec quoi, et ce que la police enregistre. Les deux se comparent chez
 * Eurostat, et nulle part ailleurs honnêtement.
 *
 * **Aucune colonne ne partage le millésime des autres** : l'enquête EU-SILC
 * publie l'année même, la statistique de police deux ans après. Chaque intitulé
 * porte donc le sien, et la légende ne date rien — une année en tête de tableau
 * aurait daté quatre chiffres de trois millésimes différents.
 *
 * **Les faits enregistrés d'Eurostat comptent pour cent mille habitants** quand
 * ceux que le site publie par commune (SSMSI) comptent pour mille. Les deux ne
 * se mélangent jamais : l'unité est dans l'intitulé, et la conversion n'est
 * faite nulle part.
 */
const VIE_QUOTIDIENNE: [id: string, titre: string, unite: string][] = [
  ["eurostat_gini", "Indice de Gini", "indice"],
  ["eurostat_rapport_interquintile", "Rapport S80/S20", "ratio"],
  ["eurostat_homicides_100k", "Homicides pour 100 000 habitants", "pour_100000_habitants"],
  [
    "eurostat_cambriolages_100k",
    "Cambriolages de logement pour 100 000 habitants",
    "pour_100000_habitants",
  ],
];

function renduVieQuotidienne(pays: Record<string, Territoire>): string {
  const colonnes = VIE_QUOTIDIENNE.filter(([id]) => derniere(pays["FR"].series[id]));
  // Un tableau d'une seule colonne n'est pas une comparaison : tant que la
  // publication ne porte pas ces séries, ce second tableau n'existe pas.
  if (!colonnes.length) return "";
  const lignes = VOISINS.filter((code) => pays[code])
    .map((code) => {
      const series = pays[code].series;
      const cellules = colonnes
        .map(([id, , unite]) => {
          const valeur = derniere(series[id]);
          // Le nombre seul : l'unité est dans l'intitulé de la colonne, et
          // « 295,5 pour 100 000 habitants » répété six fois ferait une
          // cellule plus large que le tableau.
          const ecrit = valeur
            ? formater(valeur[1], unite, false).replace(SUFFIXE_POUR_100000, "")
            : "—";
          return `<td>${ecrit}</td>`;
        })
        .join("");
      return `<tr${code === "FR" ? ' class="souligne"' : ""}>
        <th scope="row">${nomPays(code)}</th>${cellules}
      </tr>`;
    })
    .join("");
  const entetes = colonnes
    .map(([id, titre]) => {
      const annee = derniere(pays["FR"].series[id])?.[0] ?? "";
      return `<th scope="col">${titre}${
        annee ? ` <span class="millesime">${annee}</span>` : ""
      }</th>`;
    })
    .join("");
  return `
    <h4>Niveau de vie et faits enregistrés</h4>
    <table class="comparaison" tabindex="0">
      <caption>Millésime en tête de colonne · sources harmonisées Eurostat</caption>
      <thead><tr><th scope="col">Pays</th>${entetes}</tr></thead>
      <tbody>${lignes}</tbody>
    </table>
    <p class="avertissement">Un fait enregistré n'est pas un fait commis : ce que la
      police consigne dépend de ce qui lui est déclaré, et les pratiques
      d'enregistrement diffèrent d'un pays à l'autre plus qu'elles ne diffèrent
      d'une commune à l'autre.</p>`;
}

/**
 * L'enveloppe DOM : elle pose les deux chaînes et rend ce qu'elle rendait.
 *
 * Deux rendus purs plutôt qu'un seul, parce que ce bloc-ci n'en est pas un :
 * la dette et l'Europe vivent dans deux cadres distincts du gabarit, à deux
 * endroits de la grille, et chacun peut être vide sans l'autre. Une fonction
 * unique rendant une chaîne aurait collé les deux dans le même cadre ; une
 * fonction rendant un couple aurait obligé chaque appelant à le défaire.
 *
 * Le retour reste ce qu'il était — « la France est-elle publiée ? » — et c'est
 * exactement ce que dit `renduEurope`, vide dans ce seul cas.
 */
export function afficherNational(
  blocDette: HTMLElement,
  blocEurope: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const dette = renduDette(pays, catalogue);
  if (dette) blocDette.innerHTML = dette;
  const europe = renduEurope(pays);
  if (europe) blocEurope.innerHTML = europe;
  // Le cadre est peut-être REPLIÉ : le pré-rendu replie ce qu'il ne peut pas
  // écrire, et rien ne le rouvrait. Un bloc dont les séries sont publiées
  // APRÈS le dernier déploiement restait alors invisible à tout lecteur —
  // écrit, peint, et caché. Qui remplit un cadre le déplie.
  if (dette) blocDette.hidden = false;
  if (europe) blocEurope.hidden = false;
  return europe !== "";
}
