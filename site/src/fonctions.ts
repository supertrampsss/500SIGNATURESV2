/**
 * Que finance la dépense publique — santé, école, retraites, défense.
 *
 * C'est la question fondatrice du produit, et elle ne se répond pas avec le
 * budget de l'État : la santé est surtout payée par la Sécurité sociale,
 * l'école en partie par les collectivités. Ce bloc montre donc l'ensemble des
 * administrations publiques (COFOG, secteur S13), en % du PIB — et face à
 * l'Allemagne et à la zone euro, sur la même définition, parce qu'un chiffre
 * de dépense publique sans point de comparaison ne dit rien.
 *
 * Le module « 100 € » à côté raconte autre chose : le seul budget de l'État,
 * par nature de dépense. Les deux se complètent et le texte le dit.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LE DÉNOMINATEUR EST LE PIB, PAS LES RECETTES
 * ─────────────────────────────────────────────────────────────────────────
 * Le bloc voisin, dans le même chapitre, rapporte les dépenses aux
 * **recettes** — « pour 100 € encaissés, 109,77 € sortent », et l'écart est le
 * déficit. Celui-ci les rapporte au **PIB**, parce que c'est ainsi qu'Eurostat
 * publie la nomenclature et que c'est la seule forme comparable entre pays.
 *
 * Deux dénominateurs à un écran d'intervalle, c'est le genre de confusion que
 * le dépôt refuse ailleurs. La parade n'est pas de convertir — une conversion
 * produirait des nombres publiés nulle part — mais de nommer l'unité dans la
 * phrase d'ouverture, dans chaque valeur affichée et sous le tableau.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA SOMME DES DIX EST LA DÉPENSE TOTALE, ET ON LE VÉRIFIE
 * ─────────────────────────────────────────────────────────────────────────
 * Les dix fonctions couvrent toute la dépense publique : leur somme doit
 * retomber sur le total publié séparément (57,2 contre 57,3 % du PIB en 2024,
 * l'écart étant celui des arrondis). Au-delà d'un demi-point, les deux séries
 * ne disent pas le même exercice, et le bloc s'efface plutôt que d'afficher
 * une décomposition qui ne se referme pas.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ÉVOLUTION SE DIT EN POINTS, JAMAIS EN POURCENTS
 * ─────────────────────────────────────────────────────────────────────────
 * Passer de 24,4 % à 23,7 % du PIB, c'est −0,7 **point**, pas −2,9 %. Les deux
 * énoncés sont vrais et le second ne veut rien dire d'utile ici : il compare
 * un ratio à lui-même. La colonne d'évolution porte des points, et le mot est
 * écrit sous le tableau.
 */

import type { Indicateur, Territoire } from "./donnees.ts";
import { tableauAccessible } from "./dataviz.ts";
import { pourcentage } from "./echelle.ts";
import { nomPays } from "./pays-noms.ts";

export const FONCTIONS = [
  "eurostat_fonction_protection_sociale",
  "eurostat_fonction_sante",
  "eurostat_fonction_services_generaux",
  "eurostat_fonction_affaires_economiques",
  "eurostat_fonction_enseignement",
  "eurostat_fonction_ordre_securite",
  "eurostat_fonction_defense",
  "eurostat_fonction_culture",
  "eurostat_fonction_logement",
  "eurostat_fonction_environnement",
];
export const TOTAL = "eurostat_depenses_publiques_pib";

/**
 * Ce que chaque fonction contient réellement.
 *
 * Les intitulés du catalogue sont ceux d'Eurostat : exacts, et illisibles.
 * « Services généraux » ne dit rien à personne — c'est pourtant là que vit la
 * charge de la dette, ce que le lecteur cherche justement ailleurs. Chaque
 * glose est prise dans la définition de la fonction, jamais inventée ; une
 * fonction sans glose s'affiche sans, plutôt que de bloquer le bloc.
 */
const GLOSES: Record<string, string> = {
  eurostat_fonction_protection_sociale: "retraites, chômage, famille, exclusion, logement",
  eurostat_fonction_sante: "soins, hôpitaux, médicaments",
  eurostat_fonction_services_generaux: "administration, diplomatie, et la charge de la dette",
  eurostat_fonction_affaires_economiques:
    "transports, énergie, agriculture, aides aux entreprises",
  eurostat_fonction_enseignement: "de la maternelle à l'université",
  eurostat_fonction_ordre_securite: "police, justice, pompiers, prisons",
  eurostat_fonction_defense: "forces armées et équipement militaire",
  eurostat_fonction_culture: "sport, culture, audiovisuel public",
  eurostat_fonction_logement: "urbanisme, eau, éclairage public",
  eurostat_fonction_environnement: "déchets, eaux usées, air",
};

/** L'écart toléré, en points de PIB, entre la somme des dix fonctions et le
 *  total publié à part. Au-delà, la décomposition ne se referme pas. */
const TOLERANCE = 0.5;

/* Les repères de comparaison. Leur nom vient de `pays-noms.ts`, qui les
   porte tous les quarante-huit : la publication nomme un pays par son code
   (`normalize/europe.py` écrit `name = code`), et trois modules du site
   recopiaient chacun sa petite table de traduction. */
const COMPARES: [string, string][] = [
  ["DE", nomPays("DE")],
  ["EA20", nomPays("EA20")],
];

function echapper(texte: string): string {
  return texte.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function derniere(serie: Record<string, number> | undefined): [string, number] | null {
  if (!serie) return null;
  const periodes = Object.keys(serie).sort();
  const p = periodes[periodes.length - 1];
  return p ? [p, serie[p]] : null;
}

/** Un écart en points de PIB, avec son signe typographique. « = » plutôt que
 *  « +0,0 » : un zéro signé se lit comme une hausse minuscule. */
function points(ecart: number): string {
  if (Math.abs(ecart) < 0.05) return "=";
  const ecrit = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(ecart));
  return `${ecart > 0 ? "+" : "−"}${ecrit}`;
}

/**
 * Le premier exercice que les dix fonctions publient toutes avec le total.
 *
 * C'est le point de départ de la colonne d'évolution. Un départ qui ne serait
 * pas commun aux onze séries comparerait deux périmètres et appellerait ça une
 * tendance. `null` quand ce départ n'existe pas ou vaut l'exercice d'arrivée :
 * une colonne d'écarts tous nuls se lirait comme une structure figée.
 */
function departCommun(france: Territoire, arrivee: string): string | null {
  const total = france.series[TOTAL];
  if (!total) return null;
  const communs = Object.keys(total)
    .filter((an) => FONCTIONS.every((id) => france.series[id]?.[an] !== undefined))
    .sort();
  const depart = communs[0];
  return depart && depart !== arrivee ? depart : null;
}

/** Rendu pur, sans DOM : c'est lui qui est testé. */
export function rendu(
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): string {
  const france = pays["FR"];
  const total = derniere(france?.series?.[TOTAL]);
  if (!france || !total) return "";
  const [annee, totalFr] = total;
  const libelle = (id: string) => catalogue.find((i) => i.id === id)?.libelle ?? id;
  const valeur = (code: string, id: string): number | undefined =>
    pays[code]?.series?.[id]?.[annee];

  const retenues = FONCTIONS.map((id) => ({ id, fr: valeur("FR", id) })).filter(
    (l): l is { id: string; fr: number } => l.fr !== undefined,
  );
  // La décomposition doit se refermer sur le total publié à part : dix parts
  // dont la somme ne retombe pas dessus décrivent deux exercices, et le
  // lecteur additionnerait des nombres qui ne s'additionnent pas.
  if (retenues.length < FONCTIONS.length) return "";
  if (Math.abs(retenues.reduce((s, l) => s + l.fr, 0) - totalFr) > TOLERANCE) return "";

  const depart = departCommun(france, annee);
  const lignes = retenues
    .sort((a, b) => b.fr - a.fr)
    .map(({ id, fr }) => {
      const barres = `<span class="fonction__barre" style="width:${((fr / totalFr) * 100).toFixed(
        1,
      )}%"></span>`;
      const autres = COMPARES.map(([code]) => {
        const v = valeur(code, id);
        return `<td>${v === undefined ? "—" : echapper(pourcentage(v, true))}</td>`;
      }).join("");
      const avant = depart === null ? undefined : france.series[id]?.[depart];
      const glose = GLOSES[id];
      return `<tr>
        <th scope="row">${echapper(libelle(id))}${
          glose ? `<span class="fonction__glose">${echapper(glose)}</span>` : ""
        }</th>
        <td class="fonction__fr"><span class="fonction__piste">${barres}</span>
          <strong>${echapper(pourcentage(fr, true))}</strong></td>
        ${autres}
        ${depart === null ? "" : `<td class="evolution">${avant === undefined ? "" : points(fr - avant)}</td>`}
      </tr>`;
    })
    .join("");

  const totauxCompares = COMPARES.map(([code, nom]) => {
    const v = valeur(code, TOTAL);
    return v === undefined ? "" : ` · ${echapper(nom)} : ${echapper(pourcentage(v))}`;
  }).join("");
  const tableau = `<table class="fonctions" tabindex="0">
    <thead><tr><th scope="col">Fonction</th><th scope="col">France</th>
      ${COMPARES.map(([, nom]) => `<th scope="col">${echapper(nom)}</th>`).join("")}
      ${depart === null ? "" : `<th scope="col" class="evolution">Depuis ${echapper(depart)}</th>`}
    </tr></thead>
    <tbody>${lignes}</tbody>
  </table>`;
  const maximum = Math.max(...retenues.flatMap(({ id, fr }) => [fr, ...COMPARES.map(([code]) => valeur(code, id) ?? 0)]));
  const comparatif = `<figure class="dataviz dataviz--fonctions" data-chart-system="lieflat" aria-label="Comparaison des dépenses publiques par fonction">
    <figcaption><strong>La France comparée à ses voisins</strong><span>En % du PIB</span></figcaption>
    <div class="dataviz__fonctions-legende"><span>● France</span>${COMPARES.map(([, nom], i) => `<span>${i === 0 ? "○" : "◆"} ${echapper(nom)}</span>`).join("")}</div>
    <ol>${retenues.sort((a, b) => b.fr - a.fr).map(({ id, fr }) => {
      const autres = COMPARES.map(([code, nom], i) => {
        const v = valeur(code, id);
        return v === undefined ? "" : `<i class="dataviz__fonction-point dataviz__fonction-point--${i + 1}" style="left:${(v / maximum * 100).toFixed(2)}%" title="${echapper(nom)} : ${echapper(pourcentage(v, true))}"></i>`;
      }).join("");
      return `<li><span>${echapper(libelle(id))}</span><span class="dataviz__fonction-rail"><i class="dataviz__fonction-point dataviz__fonction-point--fr" style="left:${(fr / maximum * 100).toFixed(2)}%" title="France : ${echapper(pourcentage(fr, true))}"></i>${autres}</span><strong>${echapper(pourcentage(fr, true))}</strong></li>`;
    }).join("")}</ol>
  </figure>`;

  return `
    <h3 class="sous-titre">À quoi ça sert</h3>
    <p class="bloc__complement">Le tableau du dessus dit de quelle
      <strong>nature</strong> est la dépense : des pensions, des salaires, des
      achats. Celui-ci dit à quoi elle <strong>sert</strong> : un salaire
      d'infirmière est de la santé, un salaire de professeur de l'enseignement,
      et la lecture par nature les met dans la même ligne.
      En ${echapper(annee)}, les administrations publiques françaises (État,
      collectivités et Sécurité sociale réunis) ont dépensé <strong>${
        echapper(pourcentage(totalFr))
      } du produit intérieur brut</strong>${totauxCompares}.</p>
    ${comparatif}
    ${tableauAccessible("Voir les chiffres", tableau)}
    <p class="bloc__complement">Source : Eurostat.</p>
`;
}

export function afficherFonctions(
  bloc: HTMLElement,
  pays: Record<string, Territoire>,
  catalogue: Indicateur[],
): boolean {
  const html = rendu(pays, catalogue);
  if (!html) return false;
  bloc.innerHTML = html;
  // Le cadre est peut-être REPLIÉ : le pré-rendu replie ce qu'il ne peut pas
  // écrire, et rien ne le rouvrait. Un bloc dont les séries sont publiées
  // APRÈS le dernier déploiement restait alors invisible à tout lecteur —
  // écrit, peint, et caché. Qui remplit un cadre le déplie.
  bloc.hidden = false;
  return true;
}
